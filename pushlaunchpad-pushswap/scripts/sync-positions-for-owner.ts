import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';
import { NonfungiblePositionManagerABI } from '../src/abis';
import { CHAIN_CONFIG, CONTRACTS } from '../src/lib/contracts';

type Args = { owner?: string; from?: number; to?: number | 'latest'; batch?: number; depth?: number };

function parseArgs(): Args {
    const out: Args = {};
    const argv = process.argv.slice(2);
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--owner') out.owner = argv[++i];
        else if (a === '--from') out.from = Number(argv[++i]);
        else if (a === '--to') {
            const v = argv[++i];
            out.to = v === 'latest' ? 'latest' : Number(v);
        } else if (a === '--batch') out.batch = Number(argv[++i]);
        else if (a === '--depth') out.depth = Number(argv[++i]);
    }
    return out;
}

async function main() {
    const { owner = process.env.OWNER, from, to = 'latest', batch = 8000, depth } = parseArgs();
    if (!owner) throw new Error('Provide --owner 0xYourAddress or set OWNER env');

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error('Missing Supabase env');
    const db = createClient(url, key);

    const rpc = new ethers.JsonRpcProvider(CHAIN_CONFIG.rpcUrl);
    const latest = await rpc.getBlockNumber();
    const toBlock = to === 'latest' ? latest : Math.min(Number(to), latest);
    let fromBlock = typeof from === 'number' && from >= 0 ? from : Math.max(0, toBlock - (depth ?? Number(process.env.POSITIONS_LOOKBACK_BLOCKS || 500000)));

    const positionManager = new ethers.Contract(CONTRACTS.V3_POSITION_MANAGER, NonfungiblePositionManagerABI, rpc);
    const positionOwnerView = new ethers.Contract(CONTRACTS.V3_POSITION_MANAGER, ["function ownerOf(uint256) view returns (address)"], rpc);

    console.log(`Sync positions for ${owner.toLowerCase()} in [${fromBlock}, ${toBlock}] (batch=${batch})`);
    const transferTopic = ethers.id('Transfer(address,address,uint256)');
    const toTopic = ethers.zeroPadValue(owner.toLowerCase(), 32);

    const found = new Set<string>();
    let scanned = 0;
    while (fromBlock <= toBlock) {
        const end = Math.min(fromBlock + batch - 1, toBlock);
        const logs = await rpc.getLogs({
            address: CONTRACTS.V3_POSITION_MANAGER,
            fromBlock: ('0x' + fromBlock.toString(16)) as any,
            toBlock: ('0x' + end.toString(16)) as any,
            topics: [transferTopic, null, toTopic],
        } as any);
        for (const log of logs) {
            try {
                const id = BigInt(log.topics[3]).toString();
                found.add(id);
            } catch { }
        }
        scanned += logs.length;
        console.log(`Scanned [${fromBlock}, ${end}] -> +${logs.length}`);
        fromBlock = end + 1;
    }

    console.log(`Candidate tokenIds: ${found.size}`);
    const verified: string[] = [];
    for (const id of found) {
        try {
            const currentOwner: string = await positionOwnerView.ownerOf(BigInt(id));
            console.log(`ownerOf(${id}) = ${currentOwner}`);
            if (currentOwner.toLowerCase() === owner.toLowerCase()) verified.push(id);
        } catch (e) {
            console.warn(`ownerOf(${id}) call failed`, e);
        }
    }
    console.log(`Verified owned tokenIds: ${verified.length}`);

    let upserts = 0;
    for (const id of verified) {
        try {
            const p = await positionManager.positions(BigInt(id));
            const row = {
                owner: owner.toLowerCase(),
                chainid: CHAIN_CONFIG.chainId,
                tokenid: Number(id),
                token0: p[2],
                token1: p[3],
                fee: Number(p[4]),
                ticklower: Number(p[5]),
                tickupper: Number(p[6]),
                liquidity: p[7].toString(),
                tokensowed0: p[10].toString(),
                tokensowed1: p[11].toString(),
                pool: null,
                status: p[7] > 0n ? 'active' : 'closed',
                lastseenblock: toBlock,
                updatedat: new Date().toISOString(),
            };
            const { error } = await db.from('positions').upsert(row);
            if (error) throw error;
            upserts++;
        } catch (e) {
            console.warn(`Failed to upsert position ${id}:`, e);
        }
    }
    console.log(`Upserts: ${upserts}`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
