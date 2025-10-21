"use client";

import { useCallback, useState } from "react";
import BN from "bignumber.js";
import { ethers } from "ethers";
import {
    usePushChain,
    usePushChainClient,
    usePushWalletContext,
} from "@pushchain/ui-kit";
import {
    NonfungiblePositionManagerABI,
    UniswapV3FactoryABI,
    UniswapV3PoolABI,
    ERC20ABI
} from "@/abis";
import { CHAIN_CONFIG, CONTRACTS, type Token } from "@/lib/contracts";
import {
    fetchPositions as fetchStoredPositions,
    upsertPositions,
    writeLocalTokenIds,
    readLocalTokenIds,
} from "@/lib/positionsStore";

const rpcProvider = new ethers.JsonRpcProvider(CHAIN_CONFIG.rpcUrl);

const positionManager = new ethers.Contract(
    CONTRACTS.V3_POSITION_MANAGER,
    NonfungiblePositionManagerABI,
    rpcProvider
);

// Minimal ERC-721 view for ownerOf (the main ABI may omit it)
const positionManagerOwnerView = new ethers.Contract(
    CONTRACTS.V3_POSITION_MANAGER,
    ["function ownerOf(uint256 tokenId) view returns (address)"],
    rpcProvider
);

const v3Factory = new ethers.Contract(
    CONTRACTS.V3_FACTORY,
    UniswapV3FactoryABI,
    rpcProvider
);

const MAX_APPROVAL = ethers.MaxUint256;
const DEFAULT_FEE_TIER = CONTRACTS.V3_FEE_TIER; // 500 = 0.05%

// Tick math helpers
const MIN_TICK = -887272;
const MAX_TICK = 887272;
const TICK_SPACING = 10; // For 0.05% fee tier

function nearestUsableTick(tick: number, tickSpacing: number): number {
    const rounded = Math.round(tick / tickSpacing) * tickSpacing;
    if (rounded < MIN_TICK) return MIN_TICK;
    if (rounded > MAX_TICK) return MAX_TICK;
    return rounded;
}

interface Position {
    tokenId: bigint;
    token0: string;
    token1: string;
    fee: number;
    tickLower: number;
    tickUpper: number;
    liquidity: bigint;
    tokensOwed0: bigint;
    tokensOwed1: bigint;
}

interface MintPositionParams {
    token0: Token;
    token1: Token;
    amount0Desired: string;
    amount1Desired: string;
    feeTier?: number;
    tickLower?: number;
    tickUpper?: number;
    slippageBps?: number;
    deadlineMinutes?: number;
}

interface IncreaseLiquidityParams {
    tokenId: bigint;
    amount0Desired: string;
    amount1Desired: string;
    token0Decimals: number;
    token1Decimals: number;
    slippageBps?: number;
    deadlineMinutes?: number;
}

interface RemoveLiquidityParams {
    tokenId: bigint;
    liquidityPercentage: number; // 0-100
    slippageBps?: number;
    deadlineMinutes?: number;
}

interface CollectFeesParams {
    tokenId: bigint;
}

export function useLiquidityV3() {
    const { connectionStatus } = usePushWalletContext();
    const { pushChainClient } = usePushChainClient();
    const { PushChain } = usePushChain();

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isWalletConnected = connectionStatus === "connected";
    const account = pushChainClient?.universal.account ?? undefined;

    const toUnits = useCallback((amount: string, decimals: number) => {
        return ethers.parseUnits(amount || "0", decimals);
    }, []);

    const formatUnits = useCallback((value: bigint, decimals: number) => {
        return ethers.formatUnits(value, decimals);
    }, []);

    const ensureAllowance = useCallback(
        async (token: Token, owner: string, requiredAmount: bigint) => {
            const tokenContract = new ethers.Contract(
                token.address,
                ERC20ABI,
                rpcProvider
            );

            const currentAllowance: bigint = await tokenContract.allowance(
                owner,
                CONTRACTS.V3_POSITION_MANAGER
            );

            if (currentAllowance >= requiredAmount) {
                return;
            }

            const approveTx = await pushChainClient!.universal.sendTransaction({
                to: token.address as `0x${string}`,
                data: PushChain.utils.helpers.encodeTxData({
                    abi: ERC20ABI,
                    functionName: "approve",
                    args: [CONTRACTS.V3_POSITION_MANAGER, MAX_APPROVAL],
                }),
                value: BigInt(0),
            });

            await approveTx.wait();
        },
        [pushChainClient, PushChain]
    );

    const getUserPositions = useCallback(
        async (): Promise<Position[]> => {
            if (!account) {
                console.log("❌ No account connected");
                return [];
            }

            console.log("🔍 Fetching positions for account:", account);

            try {
                // WORKAROUND path + DB: Fetch from Supabase and merge with localStorage, then optionally reconstruct
                const dbSeed = await fetchStoredPositions(account);
                let tokenIds: string[] = dbSeed.map((p) => p.tokenId);
                const localIds = readLocalTokenIds(account);
                for (const id of localIds) {
                    if (!tokenIds.includes(id)) tokenIds.push(id);
                }

                if (tokenIds.length === 0) {
                    console.log("� No stored positions found (DB/local), reconstructing from logs");
                    // Fallback pass 1: scan Transfer(from=0x0, to=account) in chunks to reconstruct minted NFTs
                    try {
                        const transferTopic = ethers.id("Transfer(address,address,uint256)");
                        const zeroTopic = ethers.zeroPadValue(ethers.ZeroAddress, 32);
                        const toTopic = ethers.zeroPadValue(account, 32);

                        const latest = await rpcProvider.getBlockNumber();
                        const maxRange = 9000; // below 10k limit per RPC
                        const maxDepth = Number(process.env.NEXT_PUBLIC_POSITIONS_LOOKBACK_BLOCKS || 400000);
                        const startBound = Math.max(0, latest - maxDepth);
                        let end = latest;
                        let recovered: string[] = [];

                        while (end >= startBound) {
                            const start = Math.max(startBound, end - maxRange);
                            const fromBlockHex = "0x" + start.toString(16);
                            const toBlockHex = "0x" + end.toString(16);
                            const logs = await rpcProvider.getLogs({
                                address: CONTRACTS.V3_POSITION_MANAGER,
                                fromBlock: fromBlockHex as any,
                                toBlock: toBlockHex as any,
                                topics: [transferTopic, zeroTopic, toTopic],
                            } as any);
                            for (const log of logs) {
                                if (log.topics && log.topics.length >= 4) {
                                    try {
                                        const id = BigInt(log.topics[3]).toString();
                                        if (!recovered.includes(id)) recovered.push(id);
                                    } catch { }
                                }
                            }
                            end = start - 1; // Move window backward
                            if (recovered.length > 0) break; // break early if found
                        }

                        // Fallback pass 2: if still nothing, scan any Transfer(to=account) and filter by current owner
                        if (recovered.length === 0) {
                            console.log("🔁 No mints found; scanning any Transfer(to=account) and verifying current owner...");
                            let end2 = latest;
                            const anyRecovered: string[] = [];
                            while (end2 >= startBound) {
                                const start = Math.max(startBound, end2 - maxRange);
                                const logs = await rpcProvider.getLogs({
                                    address: CONTRACTS.V3_POSITION_MANAGER,
                                    fromBlock: ("0x" + start.toString(16)) as any,
                                    toBlock: ("0x" + end2.toString(16)) as any,
                                    topics: [transferTopic, null, toTopic],
                                } as any);
                                for (const log of logs) {
                                    if (log.topics && log.topics.length >= 4) {
                                        try {
                                            const id = BigInt(log.topics[3]).toString();
                                            if (!anyRecovered.includes(id)) anyRecovered.push(id);
                                        } catch { }
                                    }
                                }
                                end2 = start - 1;
                                if (anyRecovered.length > 0) break;
                            }

                            if (anyRecovered.length > 0) {
                                // Verify current owner to avoid stale transfers
                                const verified: string[] = [];
                                for (const id of anyRecovered) {
                                    try {
                                        const ownerNow: string = await positionManager.ownerOf(BigInt(id));
                                        if (ownerNow.toLowerCase() === account.toLowerCase()) {
                                            verified.push(id);
                                        }
                                    } catch { }
                                }
                                recovered = verified;
                            }
                        }

                        if (recovered.length > 0) {
                            tokenIds = recovered;
                            writeLocalTokenIds(account, tokenIds);
                            console.log(`💾 Recovered ${tokenIds.length} tokenIds from logs (last ${maxDepth} blocks)`);
                        }
                    } catch (scanErr) {
                        console.warn("⚠️ Failed to reconstruct positions from logs:", scanErr);
                    }
                }

                // Always scan a recent window for any new transfers to the account and merge
                try {
                    const transferTopic = ethers.id("Transfer(address,address,uint256)");
                    const toTopic = ethers.zeroPadValue(account, 32);
                    const latest = await rpcProvider.getBlockNumber();
                    const recentDepth = Number(process.env.NEXT_PUBLIC_POSITIONS_RECENT_LOOKBACK || 50000);
                    const start = Math.max(0, latest - recentDepth);
                    const logs = await rpcProvider.getLogs({
                        address: CONTRACTS.V3_POSITION_MANAGER,
                        fromBlock: ("0x" + start.toString(16)) as any,
                        toBlock: ("0x" + latest.toString(16)) as any,
                        topics: [transferTopic, null, toTopic],
                    } as any);
                    const discovered: string[] = [];
                    for (const log of logs) {
                        if (!log.topics || log.topics.length < 4) continue;
                        try {
                            const id = BigInt(log.topics[3]).toString();
                            if (!tokenIds.includes(id)) discovered.push(id);
                        } catch { }
                    }
                    if (discovered.length > 0) {
                        // Verify current owner to avoid stale transfers
                        const verified: string[] = [];
                        for (const id of discovered) {
                            try {
                                const ownerNow: string = await positionManager.ownerOf(BigInt(id));
                                if (ownerNow.toLowerCase() === account.toLowerCase()) verified.push(id);
                            } catch { }
                        }
                        if (verified.length > 0) {
                            tokenIds.push(...verified);
                            writeLocalTokenIds(account, Array.from(new Set(tokenIds)));
                        }
                    }
                } catch (e) {
                    console.warn("⚠️ Recent transfer scan failed:", e);
                }

                if (tokenIds.length === 0) {
                    return [];
                }



                console.log("📊 Found stored token IDs:", tokenIds);

                const positions: Position[] = [];

                for (const tokenId of tokenIds) {
                    console.log(`📍 Fetching position for token ID: ${tokenId}...`);

                    try {
                        // Log current owner for debugging visibility issues
                        try {
                            const ownerNow = await positionManagerOwnerView.ownerOf(BigInt(tokenId));
                            console.log(`  - ownerOf(${tokenId}):`, ownerNow);
                        } catch (ownErr) {
                            console.warn(`  - ownerOf(${tokenId}) failed`, ownErr);
                        }

                        const position = await positionManager.positions(BigInt(tokenId));
                        console.log(`  - Position data:`, {
                            token0: position[2],
                            token1: position[3],
                            fee: position[4].toString(),
                            liquidity: position[7].toString(),
                        });

                        // Only add if position has liquidity
                        // Upsert snapshot to DB (active or closed)
                        try {
                            await upsertPositions([
                                {
                                    owner: account,
                                    chainId: CHAIN_CONFIG.chainId,
                                    tokenId: tokenId,
                                    token0: position[2],
                                    token1: position[3],
                                    fee: Number(position[4]),
                                    tickLower: Number(position[5]),
                                    tickUpper: Number(position[6]),
                                    liquidity: position[7].toString(),
                                    tokensOwed0: position[10].toString(),
                                    tokensOwed1: position[11].toString(),
                                    pool: null,
                                    status: position[7] > 0n ? "active" : "closed",
                                },
                            ]);
                        } catch { }

                        if (position[7] > BigInt(0)) {
                            positions.push({
                                tokenId: BigInt(tokenId),
                                token0: position[2],
                                token1: position[3],
                                fee: Number(position[4]),
                                tickLower: Number(position[5]),
                                tickUpper: Number(position[6]),
                                liquidity: position[7],
                                tokensOwed0: position[10],
                                tokensOwed1: position[11],
                            });
                        } else {
                            console.log(`  - Position ${tokenId} has zero liquidity, skipping`);
                        }
                    } catch (err) {
                        console.error(`  - Error fetching position ${tokenId}:`, err);
                    }
                }

                console.log(`✅ Found ${positions.length} active positions`);
                return positions;
            } catch (err) {
                console.error("❌ Error getting user positions:", err);
                return [];
            }
        },
        [account]
    );

    // Persist a fresh snapshot for a position ID into Supabase
    const snapshotPosition = useCallback(
        async (tokenId: bigint) => {
            if (!account) return;
            try {
                const p = await positionManager.positions(tokenId);
                await upsertPositions([
                    {
                        owner: account,
                        chainId: CHAIN_CONFIG.chainId,
                        tokenId: tokenId.toString(),
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
                    },
                ]);
            } catch (e) {
                console.warn("snapshotPosition failed", e);
            }
        },
        [account]
    );

    // Precise sqrtPrice calculation using bignumber.js to match Uniswap's encodePriceSqrt
    const calculateSqrtPriceX96 = (
        priceRatio: number,
        token0Decimals: number,
        token1Decimals: number
    ): bigint => {
        BN.config({ EXPONENTIAL_AT: 999999, DECIMAL_PLACES: 40 });

        // priceRatio is token1/token0 in human readable terms
        const ratio = new BN(priceRatio.toString());
        const token0Factor = new BN(10).pow(token0Decimals);
        const token1Factor = new BN(10).pow(token1Decimals);
        const baseUnitRatio = ratio.multipliedBy(token1Factor).dividedBy(token0Factor);
        const sqrtPriceTimesQ96 = baseUnitRatio
            .sqrt()
            .multipliedBy(new BN(2).pow(96))
            .integerValue(BN.ROUND_FLOOR)
            .toString();
        return BigInt(sqrtPriceTimesQ96);
    };

    // Helper to compute human-readable price from slot0 sqrtPriceX96 and token decimals
    const humanPriceFromSqrt = (
        sqrtPriceX96: bigint,
        token0Decimals: number,
        token1Decimals: number
    ): number => {
        // price(token1/token0) = (sqrtPriceX96 / Q96)^2 * 10^(dec0-dec1)
        const Q96 = new BN(2).pow(96);
        const sqrtBN = new BN(sqrtPriceX96.toString());
        const ratio = sqrtBN.dividedBy(Q96);
        const price = ratio.pow(2);
        const scale = new BN(10).pow(token0Decimals - token1Decimals);
        return price.multipliedBy(scale).toNumber();
    };

    // Sort addresses lexicographically and return tuple
    const sortAddresses = (a: string, b: string): [string, string] => {
        const [x, y] = [a.toLowerCase(), b.toLowerCase()].sort();
        return [x, y];
    };

    // Create and initialize a new pool
    const createPool = useCallback(
        async (
            token0: Token,
            token1: Token,
            feeTier: number = DEFAULT_FEE_TIER,
            initialPrice: number = 1.0 // Price of token1 in terms of token0
        ) => {
            if (!pushChainClient || !account) {
                throw new Error("Wallet not connected");
            }

            console.log(`🏊 Creating pool for ${token0.symbol}/${token1.symbol} with fee ${feeTier}`);
            console.log(`├─ Initial price (token1/token0): ${initialPrice}`);

            try {
                // Step 1: Create the pool via Factory
                console.log("├─ Step 1: Creating pool via Factory...");
                const createPoolTx = await pushChainClient.universal.sendTransaction({
                    to: CONTRACTS.V3_FACTORY as `0x${string}`,
                    data: PushChain.utils.helpers.encodeTxData({
                        abi: UniswapV3FactoryABI,
                        functionName: "createPool",
                        args: [
                            token0.address,
                            token1.address,
                            feeTier,
                        ],
                    }),
                    value: BigInt(0),
                });

                const createReceipt = await createPoolTx.wait();
                console.log(`├─ Pool created via Factory (tx: ${createPoolTx.hash})`);

                // Step 2: Get the pool address
                console.log("├─ Step 2: Getting pool address...");
                const poolAddress: string = await v3Factory.getPool(
                    token0.address,
                    token1.address,
                    feeTier
                );

                if (poolAddress === ethers.ZeroAddress) {
                    throw new Error("Pool creation failed - pool address is zero");
                }

                console.log(`├─ Pool address: ${poolAddress}`);

                // Step 3: Initialize the pool with starting price
                console.log("├─ Step 3: Initializing pool...");
                const sqrtPriceX96 = calculateSqrtPriceX96(
                    initialPrice,
                    token0.decimals,
                    token1.decimals
                );
                console.log(`├─ SqrtPriceX96: ${sqrtPriceX96.toString()}`);

                const initializeTx = await pushChainClient.universal.sendTransaction({
                    to: poolAddress as `0x${string}`,
                    data: PushChain.utils.helpers.encodeTxData({
                        abi: UniswapV3PoolABI,
                        functionName: "initialize",
                        args: [sqrtPriceX96],
                    }),
                    value: BigInt(0),
                });

                const initReceipt = await initializeTx.wait();
                console.log(`└─ ✅ Pool initialized successfully (tx: ${initializeTx.hash})`);

                // Verify initialization
                const poolContract = new ethers.Contract(
                    poolAddress,
                    UniswapV3PoolABI,
                    rpcProvider
                );
                const slot0 = await poolContract.slot0();
                console.log(`📊 Pool State:`);
                console.log(`├─ SqrtPriceX96: ${slot0[0].toString()}`);
                console.log(`└─ Current Tick: ${slot0[1].toString()}`);

                return initializeTx;
            } catch (err) {
                console.error("❌ Error creating pool:", err);
                throw err;
            }
        },
        [pushChainClient, account, PushChain]
    );

    const getPoolInfo = useCallback(
        async (
            token0: Token,
            token1: Token,
            feeTier: number = DEFAULT_FEE_TIER
        ) => {
            try {
                // Always query using sorted addresses to match pool ordering
                const [sorted0, sorted1] = sortAddresses(token0.address, token1.address);
                const poolAddress: string = await v3Factory.getPool(
                    sorted0,
                    sorted1,
                    feeTier
                );

                if (poolAddress === ethers.ZeroAddress) {
                    return {
                        exists: false,
                        poolAddress: ethers.ZeroAddress,
                        sqrtPriceX96: BigInt(0),
                        tick: 0,
                        liquidity: BigInt(0),
                    };
                }

                const poolContract = new ethers.Contract(
                    poolAddress,
                    UniswapV3PoolABI,
                    rpcProvider
                );

                // Get pool state from slot0
                const slot0 = await poolContract.slot0();

                // Map decimals to sorted order (dec0 = decimals of sorted0, dec1 = decimals of sorted1)
                const dec0 = token0.address.toLowerCase() === sorted0 ? token0.decimals : token1.decimals;
                const dec1 = token0.address.toLowerCase() === sorted1 ? token0.decimals : token1.decimals;

                let humanPrice: number | null = null;
                try {
                    humanPrice = humanPriceFromSqrt(slot0[0], dec0, dec1);
                } catch (e) {
                    humanPrice = null;
                }

                return {
                    exists: true,
                    poolAddress,
                    sqrtPriceX96: slot0[0],
                    tick: Number(slot0[1]),
                    liquidity: BigInt(0), // Liquidity not available in minimal ABI
                    humanPrice,
                };
            } catch (err) {
                console.error("Error getting pool info:", err);
                throw err;
            }
        },
        []
    );

    const mintPosition = useCallback(
        async ({
            token0,
            token1,
            amount0Desired,
            amount1Desired,
            feeTier = DEFAULT_FEE_TIER,
            tickLower,
            tickUpper,
            slippageBps = 50,
            deadlineMinutes = 20,
        }: MintPositionParams) => {
            if (!isWalletConnected || !account) {
                throw new Error("Wallet not connected");
            }

            setLoading(true);
            setError(null);

            try {
                console.log("💰 ADDING LIQUIDITY TO POOL");
                console.log("=".repeat(50));

                // Store input token info before any sorting
                const inputToken0 = token0;
                const inputToken1 = token1;
                const inputAmount0 = toUnits(amount0Desired, token0.decimals);
                const inputAmount1 = toUnits(amount1Desired, token1.decimals);

                console.log(`├─ Input Token0: ${inputToken0.symbol} (${inputToken0.address})`);
                console.log(`├─ Input Token1: ${inputToken1.symbol} (${inputToken1.address})`);
                console.log(`├─ Input Amount0: ${amount0Desired} ${inputToken0.symbol}`);
                console.log(`├─ Input Amount1: ${amount1Desired} ${inputToken1.symbol}`);

                // Sort tokens to match Uniswap's token0/token1 order
                const sortedTokens = [token0.address.toLowerCase(), token1.address.toLowerCase()].sort();
                const sortedToken0Address = sortedTokens[0];
                const sortedToken1Address = sortedTokens[1];

                // Determine which input token maps to which sorted position
                let sortedToken0: Token;
                let sortedToken1: Token;
                let poolAmount0Desired: bigint;
                let poolAmount1Desired: bigint;

                if (token0.address.toLowerCase() === sortedToken0Address) {
                    // Input order matches sorted order
                    sortedToken0 = token0;
                    sortedToken1 = token1;
                    poolAmount0Desired = inputAmount0;
                    poolAmount1Desired = inputAmount1;
                } else {
                    // Input order is swapped
                    sortedToken0 = token1;
                    sortedToken1 = token0;
                    poolAmount0Desired = inputAmount1;
                    poolAmount1Desired = inputAmount0;
                }

                console.log(`├─ Pool Token0 (sorted): ${sortedToken0.symbol} (${sortedToken0.address})`);
                console.log(`├─ Pool Token1 (sorted): ${sortedToken1.symbol} (${sortedToken1.address})`);
                console.log(`├─ Pool Amount0: ${poolAmount0Desired.toString()} base units`);
                console.log(`├─ Pool Amount1: ${poolAmount1Desired.toString()} base units`);

                // Get pool info using SORTED token addresses
                const poolInfo = await getPoolInfo(sortedToken0, sortedToken1, feeTier);

                let currentTick: number;

                if (!poolInfo.exists) {
                    console.log("├─ Pool does not exist, creating it...");

                    // For new pools, initialize price from the intended ratio implied by user inputs
                    // Compute human amounts mapped to sorted order
                    const humanAmountInput0 = new BN(amount0Desired || "0");
                    const humanAmountInput1 = new BN(amount1Desired || "0");
                    const humanSorted0 = token0.address.toLowerCase() === sortedToken0Address ? humanAmountInput0 : humanAmountInput1;
                    const humanSorted1 = token0.address.toLowerCase() === sortedToken0Address ? humanAmountInput1 : humanAmountInput0;

                    let initialPrice = 1.0; // fallback
                    if (humanSorted0.gt(0) && humanSorted1.gt(0)) {
                        const ratio = humanSorted1.dividedBy(humanSorted0);
                        // Guard extremes
                        if (ratio.isFinite() && ratio.gt(0) && ratio.lte("1e12") && ratio.gte("1e-12")) {
                            initialPrice = ratio.toNumber();
                        }
                    }

                    console.log(`├─ Creating pool with initial price (token1/token0): ${initialPrice}`);
                    console.log(`├─ Token0: ${sortedToken0.symbol}, Token1: ${sortedToken1.symbol}`);

                    // Create and initialize the pool with SORTED tokens
                    await createPool(sortedToken0, sortedToken1, feeTier, initialPrice);

                    // CRITICAL: Wait for pool to be properly initialized (matching pool-manager.js)
                    console.log("├─ Waiting for pool initialization...");
                    await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay

                    // Fetch pool info again after creation
                    const newPoolInfo = await getPoolInfo(sortedToken0, sortedToken1, feeTier);
                    if (!newPoolInfo.exists) {
                        throw new Error("Failed to create pool");
                    }
                    currentTick = newPoolInfo.tick;
                    console.log(`├─ Pool created successfully, current tick: ${currentTick}`);
                } else {
                    currentTick = poolInfo.tick;
                    console.log("├─ Pool already exists!");
                    console.log(`├─ Current tick: ${currentTick}`);
                    console.log(`├─ Current sqrtPriceX96: ${poolInfo.sqrtPriceX96.toString()}`);

                    // Calculate current human-readable price with decimals
                    const price = humanPriceFromSqrt(
                        poolInfo.sqrtPriceX96,
                        // Use sorted tokens' decimals to align with pool order
                        token0.address.toLowerCase() < token1.address.toLowerCase() ? token0.decimals : token1.decimals,
                        token0.address.toLowerCase() < token1.address.toLowerCase() ? token1.decimals : token0.decimals
                    );
                    console.log(`├─ Current price (token1/token0 human): ${price}`);

                    // Detect extreme or obviously wrong price
                    if (!isFinite(price) || price <= 0 || price > 1e8) {
                        throw new Error(
                            `Pool price is extreme (tick: ${currentTick}, price: ${price.toFixed(6)}). ` +
                            `This pool was likely initialized incorrectly. ` +
                            `Please use a different fee tier (try 0.3% or 1%) to create a new pool with correct pricing.`
                        );
                    }
                }

                // Approve tokens using SORTED token order (matching pool-manager.js pattern)
                console.log("├─ Approving tokens for Position Manager...");
                await ensureAllowance(sortedToken0, account, poolAmount0Desired);
                await ensureAllowance(sortedToken1, account, poolAmount1Desired);

                // Calculate tick range based on fee tier (matching pool-manager.js)
                const tickSpacing = feeTier === 500 ? 10 : feeTier === 3000 ? 60 : 200;
                const baseTickRange = feeTier === 500 ? 2000 : feeTier === 3000 ? 5000 : 10000;
                const tickRange = Math.max(baseTickRange, tickSpacing * 50);

                const lowerTick = tickLower ?? Math.floor((currentTick - tickRange) / tickSpacing) * tickSpacing;
                const upperTick = tickUpper ?? Math.ceil((currentTick + tickRange) / tickSpacing) * tickSpacing;

                console.log("├─ Tick range calculation:");
                console.log(`├─ Current tick: ${currentTick}`);
                console.log(`├─ Tick spacing: ${tickSpacing}`);
                console.log(`├─ Tick range: [${lowerTick}, ${upperTick}]`);

                // Validate ticks are within bounds
                if (lowerTick < MIN_TICK || upperTick > MAX_TICK) {
                    throw new Error(`Tick range out of bounds: [${lowerTick}, ${upperTick}]. Must be within [${MIN_TICK}, ${MAX_TICK}]`);
                }

                // Calculate minimum amounts with slippage
                const amount0Min = BigInt(1); // Minimal slippage protection for testing
                const amount1Min = BigInt(1);

                const deadline = Math.floor(Date.now() / 1000) + deadlineMinutes * 60;

                // Use SORTED tokens in mint params (critical!)
                const mintParams = {
                    token0: sortedToken0.address,
                    token1: sortedToken1.address,
                    fee: feeTier,
                    tickLower: lowerTick,
                    tickUpper: upperTick,
                    amount0Desired: poolAmount0Desired,
                    amount1Desired: poolAmount1Desired,
                    amount0Min,
                    amount1Min,
                    recipient: account,
                    deadline: BigInt(deadline),
                };

                console.log("├─ Minting position with params:");
                console.log(`├─ Token0: ${sortedToken0.symbol} (${mintParams.token0})`);
                console.log(`├─ Token1: ${sortedToken1.symbol} (${mintParams.token1})`);
                console.log(`├─ Fee: ${mintParams.fee}`);
                console.log(`├─ Amount0Desired: ${mintParams.amount0Desired.toString()}`);
                console.log(`├─ Amount1Desired: ${mintParams.amount1Desired.toString()}`);

                const tx = await pushChainClient!.universal.sendTransaction({
                    to: CONTRACTS.V3_POSITION_MANAGER as `0x${string}`,
                    data: PushChain.utils.helpers.encodeTxData({
                        abi: NonfungiblePositionManagerABI,
                        functionName: "mint",
                        args: [mintParams],
                    }),
                    value: BigInt(0),
                });

                console.log("├─ Transaction sent:", tx.hash);
                const receipt = await tx.wait();
                console.log("└─ ✅ Position minted successfully!");

                // Extract token ID from Transfer event
                const transferTopic = ethers.id("Transfer(address,address,uint256)");
                const transferLog = receipt.logs?.find((log: any) => log.topics[0] === transferTopic);

                if (transferLog && transferLog.topics[3]) {
                    const tokenId = BigInt(transferLog.topics[3]);
                    console.log("🎫 Minted position NFT #" + tokenId.toString());

                    // Persist token ID locally
                    const existing = readLocalTokenIds(account);
                    if (!existing.includes(tokenId.toString())) {
                        existing.push(tokenId.toString());
                        writeLocalTokenIds(account, existing);
                        console.log("💾 Saved token ID to localStorage");
                    }
                    // Upsert minimal row to DB immediately
                    await upsertPositions([
                        {
                            owner: account,
                            chainId: CHAIN_CONFIG.chainId,
                            tokenId: tokenId.toString(),
                            status: "active",
                        },
                    ]);
                    try {
                        // Notify UI listeners that positions changed
                        window.dispatchEvent(new Event('v3-positions-updated'));
                    } catch { }
                } else {
                    console.warn("⚠️  Could not extract token ID from receipt");
                    try {
                        // Trigger UI to reload positions via log fallback
                        window.dispatchEvent(new Event('v3-positions-updated'));
                    } catch { }
                }

                return tx;
            } catch (err) {
                console.error("❌ Liquidity addition failed:", err);
                const errorMessage = (err as Error).message;
                setError(errorMessage);
                throw err;
            } finally {
                setLoading(false);
            }
        },
        [
            isWalletConnected,
            account,
            pushChainClient,
            PushChain,
            toUnits,
            ensureAllowance,
            getPoolInfo,
            createPool,
        ]
    );

    const increaseLiquidity = useCallback(
        async ({
            tokenId,
            amount0Desired,
            amount1Desired,
            token0Decimals,
            token1Decimals,
            slippageBps = 50,
            deadlineMinutes = 20,
        }: IncreaseLiquidityParams) => {
            if (!isWalletConnected || !account) {
                throw new Error("Wallet not connected");
            }

            setLoading(true);
            setError(null);

            try {
                const amount0 = toUnits(amount0Desired, token0Decimals);
                const amount1 = toUnits(amount1Desired, token1Decimals);

                const amount0Min = (amount0 * BigInt(10000 - slippageBps)) / BigInt(10000);
                const amount1Min = (amount1 * BigInt(10000 - slippageBps)) / BigInt(10000);

                const deadline = Math.floor(Date.now() / 1000) + deadlineMinutes * 60;

                const increaseParams = {
                    tokenId,
                    amount0Desired: amount0,
                    amount1Desired: amount1,
                    amount0Min,
                    amount1Min,
                    deadline: BigInt(deadline),
                };

                const tx = await pushChainClient!.universal.sendTransaction({
                    to: CONTRACTS.V3_POSITION_MANAGER as `0x${string}`,
                    data: PushChain.utils.helpers.encodeTxData({
                        abi: NonfungiblePositionManagerABI,
                        functionName: "increaseLiquidity",
                        args: [increaseParams],
                    }),
                    value: BigInt(0),
                });

                await tx.wait();
                // snapshot after liquidity increase
                try { await snapshotPosition(tokenId); } catch { }
                return tx;
            } catch (err) {
                console.error("Increase liquidity failed:", err);
                const errorMessage = (err as Error).message;
                setError(errorMessage);
                throw err;
            } finally {
                setLoading(false);
            }
        },
        [isWalletConnected, account, pushChainClient, PushChain, toUnits]
    );

    const removeLiquidity = useCallback(
        async ({
            tokenId,
            liquidityPercentage,
            slippageBps = 50,
            deadlineMinutes = 20,
        }: RemoveLiquidityParams) => {
            if (!isWalletConnected || !account) {
                throw new Error("Wallet not connected");
            }

            setLoading(true);
            setError(null);

            try {
                const position = await positionManager.positions(tokenId);
                const totalLiquidity = position[7]; // liquidity field

                // Compute portion to remove, rounding up to avoid 0-liquidity reverts
                const pct = BigInt(Math.max(0, Math.min(100, Math.floor(liquidityPercentage))));
                let liquidityToRemove = (totalLiquidity * pct + 99n) / 100n; // ceil divide by 100
                if (pct > 0n && liquidityToRemove === 0n) {
                    liquidityToRemove = 1n;
                }
                if (liquidityToRemove > totalLiquidity) {
                    liquidityToRemove = totalLiquidity;
                }

                const deadline = Math.floor(Date.now() / 1000) + deadlineMinutes * 60;

                const decreaseParams = {
                    tokenId,
                    liquidity: liquidityToRemove,
                    amount0Min: BigInt(0), // Could calculate based on slippage
                    amount1Min: BigInt(0),
                    deadline: BigInt(deadline),
                };

                const tx = await pushChainClient!.universal.sendTransaction({
                    to: CONTRACTS.V3_POSITION_MANAGER as `0x${string}`,
                    data: PushChain.utils.helpers.encodeTxData({
                        abi: NonfungiblePositionManagerABI,
                        functionName: "decreaseLiquidity",
                        args: [decreaseParams],
                    }),
                    value: BigInt(0),
                });

                await tx.wait();

                // After decreasing, collect the tokens
                await collectFees({ tokenId });

                // snapshot after liquidity decrease (may be closed)
                try { await snapshotPosition(tokenId); } catch { }

                return tx;
            } catch (err) {
                console.error("Remove liquidity failed:", err);
                const errorMessage = (err as Error).message;
                setError(errorMessage);
                throw err;
            } finally {
                setLoading(false);
            }
        },
        [isWalletConnected, account, pushChainClient, PushChain]
    );

    const collectFees = useCallback(
        async ({ tokenId }: CollectFeesParams) => {
            if (!isWalletConnected || !account) {
                throw new Error("Wallet not connected");
            }

            setLoading(true);
            setError(null);

            try {
                // INonfungiblePositionManager.collect expects uint128 for amount0Max/amount1Max
                // Using uint256 max here causes an out-of-bounds encoding error in ethers v6
                const MAX_UINT128 = (1n << 128n) - 1n;
                const collectParams = {
                    tokenId,
                    recipient: account,
                    amount0Max: MAX_UINT128,
                    amount1Max: MAX_UINT128,
                };

                const tx = await pushChainClient!.universal.sendTransaction({
                    to: CONTRACTS.V3_POSITION_MANAGER as `0x${string}`,
                    data: PushChain.utils.helpers.encodeTxData({
                        abi: NonfungiblePositionManagerABI,
                        functionName: "collect",
                        args: [collectParams],
                    }),
                    value: BigInt(0),
                });

                await tx.wait();
                // snapshot after collect (owed resets; liquidity unchanged)
                try { await snapshotPosition(tokenId); } catch { }
                return tx;
            } catch (err) {
                console.error("Collect fees failed:", err);
                const errorMessage = (err as Error).message;
                setError(errorMessage);
                throw err;
            } finally {
                setLoading(false);
            }
        },
        [isWalletConnected, account, pushChainClient, PushChain]
    );

    return {
        // State
        loading,
        error,
        isWalletConnected,
        account,

        // V3 Functions
        getUserPositions,
        getPoolInfo,
        createPool,
        mintPosition,
        increaseLiquidity,
        removeLiquidity,
        collectFees,

        // Utilities
        toUnits,
        formatUnits,
    };
}
