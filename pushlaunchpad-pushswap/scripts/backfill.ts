/*
 Backfill historical launches and positions into Supabase.
 Usage:
   NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
   NODE_OPTIONS=--loader=ts-node/esm \
   node --no-warnings --loader ts-node/esm scripts/backfill.ts --from 0 --to latest

 Or add an npm script and run `npm run backfill -- --from 0 --to latest`.
*/

import 'dotenv/config';
// Gracefully handle stdout EPIPE (e.g., when piping to `head`)
process.stdout.on('error', (err: any) => {
    if (err && (err as any).code === 'EPIPE') {
        try { process.exit(0); } catch { }
    }
});
import { createClient } from "@supabase/supabase-js";
import { ethers, type EventLog } from "ethers";
import { LaunchpadABI, NonfungiblePositionManagerABI } from "../src/abis";
import { CHAIN_CONFIG, CONTRACTS } from "../src/lib/contracts";

type Args = { from?: number; to?: number | "latest"; batch?: number };

function parseArgs(): Args {
    const res: Args = {};
    const argv = process.argv.slice(2);
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === "--from") res.from = Number(argv[++i]);
        else if (a === "--to") {
            const v = argv[++i];
            res.to = v === "latest" ? "latest" : Number(v);
        } else if (a === "--batch") res.batch = Number(argv[++i]);
    }
    return res;
}

async function main() {
    const { from = 0, to = "latest", batch = 8000 } = parseArgs();

    const rpc = new ethers.JsonRpcProvider(CHAIN_CONFIG.rpcUrl);
    const latestBlock = await rpc.getBlockNumber();
    const toBlock = to === "latest" ? latestBlock : Math.min(Number(to), latestBlock);
    const fromBlock = Math.max(0, Number(from));

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnon) {
        throw new Error("Supabase env NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY required");
    }
    const db = createClient(supabaseUrl, supabaseAnon);

    console.log(`Backfill window: blocks [${fromBlock}, ${toBlock}] (batch=${batch})`);

    // Contracts
    const launchpad = new ethers.Contract(CONTRACTS.LAUNCHPAD, LaunchpadABI, rpc);
    const posManager = new ethers.Contract(CONTRACTS.V3_POSITION_MANAGER, NonfungiblePositionManagerABI, rpc);

    // 1) Backfill Launches
    const lpFilter = launchpad.filters.TokenLaunched?.();
    if (!lpFilter) throw new Error("Launchpad TokenLaunched filter unavailable");

    let lpFrom = fromBlock;
    const launchEvents: EventLog[] = [];
    while (lpFrom <= toBlock) {
        const lpTo = Math.min(lpFrom + batch - 1, toBlock);
        const chunk = (await launchpad.queryFilter(lpFilter, lpFrom, lpTo)) as EventLog[];
        launchEvents.push(...chunk);
        console.log(`Launch events scanned [${lpFrom}, ${lpTo}] -> +${chunk.length}`);
        lpFrom = lpTo + 1;
    }

    // Fetch bonding supply once for progress calc
    let bondingSupply: bigint = 0n;
    try { bondingSupply = await launchpad.BONDING_SUPPLY(); } catch { }

    for (const ev of launchEvents) {
        try {
            const args = ev.args as unknown as {
                dev: string;
                token: string;
                quoteAsset: string;
                bondingCurve: string;
                timestamp: bigint;
            };

            // Minimal token ABI for metadata
            const tokenAbi = [
                "function name() view returns (string)",
                "function symbol() view returns (string)",
                "function mediaURI() view returns (string)",
            ];
            const token = new ethers.Contract(args.token, tokenAbi, rpc);
            const [name, symbol, mediaURI, quoteRaised, baseSold, launchMeta] = await Promise.all([
                token.name(),
                token.symbol(),
                token.mediaURI().catch(() => ""),
                launchpad.quoteBoughtByCurve(args.token),
                launchpad.baseSoldFromCurve(args.token),
                launchpad.launches(args.token),
            ]);

            const raisedFormatted = ethers.formatUnits(quoteRaised, CHAIN_CONFIG.decimals);
            const progress = bondingSupply > 0n
                ? Number((baseSold * 10000n) / bondingSupply) / 100
                : 0;

            const row = {
                token: args.token,
                name,
                symbol,
                dev: args.dev,
                quoteasset: args.quoteAsset,
                timestamp: Number(args.timestamp),
                blocknumber: ev.blockNumber ?? 0,
                raised: quoteRaised.toString(),
                basesold: baseSold.toString(),
                progress: isFinite(progress) ? progress : 0,
                status: launchMeta.active ? "active" : "completed",
                latestblock: ev.blockNumber ?? 0,
            };

            await db.from("launches").upsert(row);
        } catch (e) {
            console.warn("Failed to upsert launch row:", e);
        }
    }

    console.log(`Launch backfill done: ${launchEvents.length} events.`);

    // 2) Backfill Positions via Transfer(from=0x0) mints
    const transferTopic = ethers.id("Transfer(address,address,uint256)");
    const zeroTopic = ethers.zeroPadValue(ethers.ZeroAddress, 32);
    let pmFrom = fromBlock;
    let minted = 0;
    while (pmFrom <= toBlock) {
        const pmTo = Math.min(pmFrom + batch - 1, toBlock);
        const logs = await rpc.getLogs({
            address: CONTRACTS.V3_POSITION_MANAGER,
            fromBlock: "0x" + pmFrom.toString(16),
            toBlock: "0x" + pmTo.toString(16),
            topics: [transferTopic, zeroTopic], // from=0x0, any to
        } as any);

        for (const log of logs) {
            try {
                const to = ethers.getAddress("0x" + log.topics[2].slice(26));
                const tokenId = BigInt(log.topics[3]).toString();
                // Fetch details
                const p = await posManager.positions(BigInt(tokenId));
                const row = {
                    owner: to.toLowerCase(),
                    chainId: CHAIN_CONFIG.chainId,
                    tokenId: Number(tokenId),
                    token0: p[2],
                    token1: p[3],
                    fee: Number(p[4]),
                    tickLower: Number(p[5]),
                    tickUpper: Number(p[6]),
                    liquidity: p[7].toString(),
                    tokensOwed0: p[10].toString(),
                    tokensOwed1: p[11].toString(),
                    pool: null,
                    status: p[7] > 0n ? "active" : "closed",
                    lastSeenBlock: log.blockNumber,
                };
                await db.from("positions").upsert(row);
                minted++;
            } catch (e) {
                console.warn("Failed to upsert position row:", e);
            }
        }
        console.log(`Positions scanned [${pmFrom}, ${pmTo}] -> +${logs.length}`);
        pmFrom = pmTo + 1;
    }

    console.log(`Positions backfill done: ${minted} mints processed.`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
