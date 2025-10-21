import { getSupabase } from "@/lib/supabase";

export interface StoredPosition {
    owner: string;
    tokenId: string; // stringified bigint
    chainId: number;
    token0?: string | null;
    token1?: string | null;
    fee?: number | null;
    tickLower?: number | null;
    tickUpper?: number | null;
    liquidity?: string | null; // stringified bigint
    tokensOwed0?: string | null;
    tokensOwed1?: string | null;
    pool?: string | null;
    status?: "active" | "closed";
    lastSeenBlock?: number | null;
}

const STORAGE_PREFIX = "v3_positions_";

export function readLocalTokenIds(owner: string): string[] {
    if (typeof window === "undefined") return [];
    const key = STORAGE_PREFIX + owner.toLowerCase();
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    try {
        const arr = JSON.parse(raw);
        return Array.isArray(arr) ? (arr as string[]) : [];
    } catch {
        return [];
    }
}

export function writeLocalTokenIds(owner: string, tokenIds: string[]): void {
    if (typeof window === "undefined") return;
    const key = STORAGE_PREFIX + owner.toLowerCase();
    try {
        window.localStorage.setItem(key, JSON.stringify(tokenIds));
    } catch { }
}

export async function upsertPositions(rows: StoredPosition[]): Promise<void> {
    const supabase = getSupabase();
    if (!supabase || !rows.length) return;
    const { error } = await supabase.from("positions").upsert(
        rows.map((r) => ({
            owner: r.owner.toLowerCase(),
            chainid: r.chainId,
            tokenid: Number(r.tokenId),
            token0: r.token0 ?? null,
            token1: r.token1 ?? null,
            fee: r.fee ?? null,
            ticklower: r.tickLower ?? null,
            tickupper: r.tickUpper ?? null,
            liquidity: r.liquidity ?? null,
            tokensowed0: r.tokensOwed0 ?? null,
            tokensowed1: r.tokensOwed1 ?? null,
            pool: r.pool ?? null,
            status: r.status ?? "active",
            lastseenblock: r.lastSeenBlock ?? null,
            updatedat: new Date().toISOString(),
        }))
    );
    if (error) throw error;
}

export async function fetchPositions(owner: string): Promise<StoredPosition[]> {
    const supabase = getSupabase();
    if (!supabase) return [];
    const { data, error } = await supabase
        .from("positions")
        .select("owner, chainId:chainid, tokenId:tokenid, token0, token1, fee, tickLower:ticklower, tickUpper:tickupper, liquidity, tokensOwed0:tokensowed0, tokensOwed1:tokensowed1, pool, status, lastSeenBlock:lastseenblock")
        .eq("owner", owner.toLowerCase())
        .order("tokenid", { ascending: true });
    if (error || !data) return [];
    return data.map((d: any) => ({
        owner: d.owner,
        chainId: Number(d.chainId),
        tokenId: String(d.tokenId),
        token0: d.token0,
        token1: d.token1,
        fee: d.fee,
        tickLower: d.tickLower,
        tickUpper: d.tickUpper,
        liquidity: d.liquidity,
        tokensOwed0: d.tokensOwed0,
        tokensOwed1: d.tokensOwed1,
        pool: d.pool,
        status: d.status,
        lastSeenBlock: d.lastSeenBlock,
    }));
}
