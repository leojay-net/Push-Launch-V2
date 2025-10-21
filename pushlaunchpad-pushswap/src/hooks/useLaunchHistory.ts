"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ethers, type EventLog } from "ethers";
import { LaunchpadABI } from "@/abis";
import { CHAIN_CONFIG, CONTRACTS } from "@/lib/contracts";
import { readCache, writeCache, type CachedLaunches, isStale } from "@/lib/cache";
import { getSupabase } from "@/lib/supabase";

const rpcProvider = new ethers.JsonRpcProvider(CHAIN_CONFIG.rpcUrl);

const launchpadReadContract = new ethers.Contract(
    CONTRACTS.LAUNCHPAD,
    LaunchpadABI,
    rpcProvider
);

const launchTokenAbi = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function mediaURI() view returns (string)",
];

const parseNumericEnv = (value: string | undefined, fallback: number) => {
    if (!value) return fallback;

    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const DEFAULT_START_BLOCK = parseNumericEnv(
    process.env.NEXT_PUBLIC_LAUNCHPAD_START_BLOCK,
    0
);

const LOOKBACK_BLOCKS = parseNumericEnv(
    process.env.NEXT_PUBLIC_LAUNCHPAD_LOOKBACK_BLOCKS,
    9000
);

const LOG_BATCH_SIZE = Math.max(
    1000,
    Math.min(
        parseNumericEnv(process.env.NEXT_PUBLIC_LAUNCHPAD_LOG_BATCH, 5000),
        9500
    )
);

interface LaunchData {
    token: string;
    name: string;
    symbol: string;
    mediaURI?: string;
    dev: string;
    quoteAsset: string;
    timestamp: number;
    blockNumber: number;
    raised: bigint;
    raisedFormatted: string;
    baseSold: bigint;
    progress: number;
    status: "active" | "completed";
}

interface UseLaunchHistoryResult {
    launches: LaunchData[];
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    clearLocal: () => void;
}

const EMPTY_LAUNCHES: LaunchData[] = [];

const CACHE_KEY = "pushlaunchpad:launches:v1";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL for refresh heuristics

export function useLaunchHistory(): UseLaunchHistoryResult {
    const [launches, setLaunches] = useState<LaunchData[]>(EMPTY_LAUNCHES);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [latestScannedBlock, setLatestScannedBlock] = useState<number>(0);

    const fetchLaunches = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const bondingSupply: bigint = await launchpadReadContract.BONDING_SUPPLY();
            const filter = launchpadReadContract.filters.TokenLaunched?.();

            if (!filter) {
                throw new Error("TokenLaunched event filter unavailable");
            }

            const latestBlock = await rpcProvider.getBlockNumber();

            // 1) Prime from Supabase (if available) for durability across devices
            const supabase = getSupabase();
            let dbItems: LaunchData[] = [];
            let dbLatestBlock = 0;
            if (supabase) {
                const { data, error: dbErr } = await supabase
                    .from("launches")
                    // postgres folds unquoted identifiers to lower-case; alias to camelCase for client
                    .select("token,name,symbol,dev,quoteAsset:quoteasset,timestamp,blockNumber:blocknumber,raised,baseSold:basesold,progress,status,latestBlock:latestblock")
                    .order("blocknumber", { ascending: false })
                    .throwOnError();
                if (!dbErr && data && Array.isArray(data)) {
                    dbItems = data.map((row: any) => ({
                        token: row.token,
                        name: row.name,
                        symbol: row.symbol,
                        // mediaURI is not persisted in DB; it's enriched from chain when scanning
                        mediaURI: undefined,
                        dev: row.dev,
                        quoteAsset: row.quoteAsset,
                        timestamp: Number(row.timestamp) || 0,
                        blockNumber: Number(row.blockNumber) || 0,
                        raised: BigInt(row.raised ?? 0),
                        raisedFormatted: row.raised ? ethers.formatUnits(BigInt(row.raised), CHAIN_CONFIG.decimals) : "0",
                        baseSold: BigInt(row.baseSold ?? 0),
                        progress: Number(row.progress) || 0,
                        status: row.status === "active" ? "active" : "completed",
                    }));
                    // latestBlock column may be present per-row; capture max
                    dbLatestBlock = Math.max(
                        0,
                        ...data.map((r: any) => Number(r.latestBlock || r.blockNumber || 0))
                    );
                }
            }

            // 2) Initialize from cache for instant UI and decide scanning window
            let cached: CachedLaunches<LaunchData> | null = readCache<LaunchData>(CACHE_KEY);
            if (cached && isStale(cached.updatedAt, CACHE_TTL_MS)) {
                // stale cache: keep items for fallback UI, but we'll rescan broadly
                cached = { ...cached, latestBlock: Math.max(0, cached.latestBlock) };
            }

            // Determine scan start: if we have a cache, resume from cache.latestBlock+1
            // Else, use DEFAULT_START_BLOCK or a lookback window.
            const resumeBlock = Math.max(cached?.latestBlock ?? 0, dbLatestBlock);
            const windowStart = DEFAULT_START_BLOCK
                ? Math.max(0, DEFAULT_START_BLOCK)
                : Math.max(0, latestBlock - LOOKBACK_BLOCKS);
            const startBlock = resumeBlock > 0 ? Math.min(resumeBlock + 1, latestBlock) : windowStart;

            const events: EventLog[] = [];
            let fromBlock = startBlock;

            while (fromBlock <= latestBlock) {
                const toBlock = Math.min(
                    fromBlock + LOG_BATCH_SIZE - 1,
                    latestBlock
                );

                const chunk = (await launchpadReadContract.queryFilter(
                    filter,
                    fromBlock,
                    toBlock
                )) as EventLog[];

                if (chunk.length) {
                    events.push(...chunk);
                }

                if (toBlock >= latestBlock) {
                    break;
                }

                fromBlock = toBlock + 1;
            }

            // Parse new events (may be empty) and merge with cached

            const parsed = await Promise.all(
                events.map(async (event): Promise<LaunchData | null> => {
                    try {
                        const args = event.args as unknown as {
                            dev: string;
                            token: string;
                            quoteAsset: string;
                            bondingCurve: string;
                            timestamp: bigint;
                        };

                        const launchTokenContract = new ethers.Contract(
                            args.token,
                            launchTokenAbi,
                            rpcProvider
                        );

                        const [name, symbol, mediaURI, quoteRaised, baseSold, launchMeta] =
                            await Promise.all([
                                launchTokenContract.name(),
                                launchTokenContract.symbol(),
                                launchTokenContract.mediaURI().catch(() => ""),
                                launchpadReadContract.quoteBoughtByCurve(args.token),
                                launchpadReadContract.baseSoldFromCurve(args.token),
                                launchpadReadContract.launches(args.token),
                            ]);

                        const raisedFormatted = ethers.formatUnits(
                            quoteRaised,
                            CHAIN_CONFIG.decimals
                        );

                        const progress = bondingSupply
                            ? Number((baseSold * BigInt(10000)) / bondingSupply) / 100
                            : 0;

                        const summary: LaunchData = {
                            token: args.token,
                            name,
                            symbol,
                            mediaURI: mediaURI || undefined,
                            dev: args.dev,
                            quoteAsset: args.quoteAsset,
                            timestamp: Number(args.timestamp),
                            blockNumber: event.blockNumber ?? 0,
                            raised: quoteRaised,
                            raisedFormatted,
                            baseSold,
                            progress: progress > 100 ? 100 : progress,
                            status: launchMeta.active ? "active" : "completed",
                        };

                        return summary;
                    } catch (innerError) {
                        console.error("Failed to parse launch event", innerError);
                        return null;
                    }
                })
            );

            const newItems = parsed.filter(Boolean) as LaunchData[];

            // Merge strategy: index by token address (1:1 mapping per launch)
            const map = new Map<string, LaunchData>();
            // Seed with cached items first
            if (cached?.items?.length) {
                for (const item of cached.items) {
                    map.set(item.token.toLowerCase(), item);
                }
            }
            // Seed with DB items (prefer DB over local cache where both exist)
            if (dbItems.length) {
                for (const item of dbItems) {
                    map.set(item.token.toLowerCase(), item);
                }
            }
            // Overlay with newly parsed (newer wins)
            for (const item of newItems) {
                map.set(item.token.toLowerCase(), item);
            }

            // Compose list and sort by timestamp desc
            let merged = Array.from(map.values()).sort(
                (a, b) => b.timestamp - a.timestamp
            );

            // Always refresh live metrics for active tokens so bonding progress stays current
            // even when no new TokenLaunched events occur.
            // We only touch: raised, raisedFormatted, baseSold, progress, status.
            if (merged.length) {
                const active = merged.filter((m) => m.status === "active");
                if (active.length) {
                    // Chunk to avoid overloading RPC
                    const chunkSize = 10;
                    const updatedMap = new Map<string, LaunchData>(
                        merged.map((m) => [m.token.toLowerCase(), m])
                    );
                    for (let i = 0; i < active.length; i += chunkSize) {
                        const chunk = active.slice(i, i + chunkSize);
                        // For each token, read quoteBought, baseSold, and launch meta.active
                        const chunkUpdates = await Promise.all(
                            chunk.map(async (m) => {
                                try {
                                    const [quoteRaised, baseSold, launchMeta] = await Promise.all([
                                        launchpadReadContract.quoteBoughtByCurve(m.token),
                                        launchpadReadContract.baseSoldFromCurve(m.token),
                                        launchpadReadContract.launches(m.token),
                                    ]);
                                    const bondingSupply: bigint = await launchpadReadContract.BONDING_SUPPLY();
                                    const progress = bondingSupply
                                        ? Number((baseSold * BigInt(10000)) / bondingSupply) / 100
                                        : 0;
                                    const raisedFormatted = ethers.formatUnits(
                                        quoteRaised,
                                        CHAIN_CONFIG.decimals
                                    );
                                    const next: LaunchData = {
                                        ...m,
                                        raised: quoteRaised,
                                        raisedFormatted,
                                        baseSold,
                                        progress: progress > 100 ? 100 : progress,
                                        status: launchMeta.active ? "active" : "completed",
                                    };
                                    return next;
                                } catch (e) {
                                    // On failure, keep previous entry
                                    return m;
                                }
                            })
                        );
                        for (const u of chunkUpdates) {
                            updatedMap.set(u.token.toLowerCase(), u);
                        }
                    }
                    merged = Array.from(updatedMap.values()).sort(
                        (a, b) => b.timestamp - a.timestamp
                    );
                }
            }

            setLaunches(merged);

            // Persist cache with the latest scanned block (we scanned up to latestBlock)
            writeCache<LaunchData>(CACHE_KEY, {
                items: merged,
                latestBlock: latestBlock,
                updatedAt: Date.now(),
            });
            setLatestScannedBlock(latestBlock);

            // Upsert into Supabase for cross-device persistence
            if (supabase && merged.length) {
                // Map to DB column names (lowercase) to avoid identifier casing issues
                const rows = merged.map((m) => ({
                    token: m.token,
                    name: m.name,
                    symbol: m.symbol,
                    dev: m.dev,
                    quoteasset: m.quoteAsset,
                    timestamp: m.timestamp,
                    blocknumber: m.blockNumber,
                    raised: m.raised.toString(),
                    basesold: m.baseSold.toString(),
                    progress: m.progress,
                    status: m.status,
                    latestblock: latestBlock,
                }));
                await supabase
                    .from("launches")
                    .upsert(rows, { onConflict: "token" });
            }
        } catch (err) {
            console.error("Failed to fetch launch history", err);
            setError((err as Error).message);
            // On error, try to fall back to cache if present
            const cached = readCache<LaunchData>(CACHE_KEY);
            if (cached?.items?.length) {
                setLaunches(cached.items);
                setLatestScannedBlock(cached.latestBlock);
                // Try DB fallback as well if present
                const supabase = getSupabase();
                if (supabase) {
                    const { data, error: dbErr } = await supabase
                        .from("launches")
                        .select("token,name,symbol,dev,quoteAsset:quoteasset,timestamp,blockNumber:blocknumber,raised,baseSold:basesold,progress,status")
                        .order("blocknumber", { ascending: false })
                        .throwOnError();
                    if (dbErr) console.error("Supabase launches fallback error:", dbErr);
                    if (data && Array.isArray(data) && data.length) {
                        const dbItems: LaunchData[] = data.map((row: any) => ({
                            token: row.token,
                            name: row.name,
                            symbol: row.symbol,
                            mediaURI: undefined,
                            dev: row.dev,
                            quoteAsset: row.quoteAsset,
                            timestamp: Number(row.timestamp) || 0,
                            blockNumber: Number(row.blockNumber) || 0,
                            raised: BigInt(row.raised ?? 0),
                            raisedFormatted: row.raised ? ethers.formatUnits(BigInt(row.raised), CHAIN_CONFIG.decimals) : "0",
                            baseSold: BigInt(row.baseSold ?? 0),
                            progress: Number(row.progress) || 0,
                            status: row.status === "active" ? "active" : ("completed" as const),
                        }));
                        setLaunches(dbItems);
                    }
                }
            } else {
                setLaunches(EMPTY_LAUNCHES);
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        // Prime from cache synchronously for immediate UI
        const cached = readCache<LaunchData>(CACHE_KEY);
        if (cached?.items?.length) {
            setLaunches(cached.items);
            setLatestScannedBlock(cached.latestBlock);
            setLoading(false); // we'll trigger a background refresh below
        }
        // Always refresh to capture new events; if we had cache, it will be incremental
        fetchLaunches();
    }, [fetchLaunches]);

    const memoizedLaunches = useMemo(() => launches, [launches]);

    return {
        launches: memoizedLaunches,
        loading,
        error,
        refresh: fetchLaunches,
        clearLocal: () => writeCache(CACHE_KEY, { items: [], latestBlock: 0, updatedAt: Date.now() }),
    };
}
