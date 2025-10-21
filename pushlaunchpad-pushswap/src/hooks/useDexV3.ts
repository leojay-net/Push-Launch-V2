"use client";

import { useCallback, useState } from "react";
import { ethers } from "ethers";
import { safeParseUnits } from "@/lib/utils";
import {
    usePushChain,
    usePushChainClient,
    usePushWalletContext,
} from "@pushchain/ui-kit";
import { SwapRouterV3ABI, UniswapV3FactoryABI, UniswapV3PoolABI, ERC20ABI, QuoterV2ABI } from "@/abis";
import { CHAIN_CONFIG, CONTRACTS, type Token } from "@/lib/contracts";

const rpcProvider = new ethers.JsonRpcProvider(CHAIN_CONFIG.rpcUrl);

const swapRouterV3 = new ethers.Contract(
    CONTRACTS.V3_SWAP_ROUTER,
    SwapRouterV3ABI,
    rpcProvider
);

const quoterV2 = new ethers.Contract(
    CONTRACTS.QUOTER_V2,
    QuoterV2ABI,
    rpcProvider
);

const v3Factory = new ethers.Contract(
    CONTRACTS.V3_FACTORY,
    UniswapV3FactoryABI,
    rpcProvider
);

const MAX_APPROVAL = ethers.MaxUint256;
const DEFAULT_FEE_TIER = CONTRACTS.V3_FEE_TIER; // 500 = 0.05%

interface SwapQuoteParams {
    amountIn: string;
    tokenIn: Token;
    tokenOut: Token;
    feeTier?: number;
}

interface SwapQuote {
    amountOut: bigint;
    amountOutFormatted: string;
    sqrtPriceX96After: bigint;
    priceImpact: number;
}

interface SwapParams {
    amountIn: string;
    minAmountOut: string;
    tokenIn: Token;
    tokenOut: Token;
    feeTier?: number;
    deadlineMinutes?: number;
}

interface PoolInfo {
    exists: boolean;
    poolAddress: string;
    token0: string;
    token1: string;
    fee: number;
    sqrtPriceX96?: bigint;
    tick?: number;
    liquidity?: bigint;
    price?: string;
}

export function useDexV3() {
    const { connectionStatus } = usePushWalletContext();
    const { pushChainClient } = usePushChainClient();
    const { PushChain } = usePushChain();

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isWalletConnected = connectionStatus === "connected";
    const account = pushChainClient?.universal.account ?? undefined;

    const toUnits = useCallback((amount: string, decimals: number) => {
        const parsed = safeParseUnits(amount || "0", decimals);
        return parsed ?? 0n;
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
                CONTRACTS.V3_SWAP_ROUTER
            );

            if (currentAllowance >= requiredAmount) {
                return;
            }

            const approveTx = await pushChainClient!.universal.sendTransaction({
                to: token.address as `0x${string}`,
                data: PushChain.utils.helpers.encodeTxData({
                    abi: ERC20ABI,
                    functionName: "approve",
                    args: [CONTRACTS.V3_SWAP_ROUTER, MAX_APPROVAL],
                }),
                value: BigInt(0),
            });

            await approveTx.wait();
        },
        [pushChainClient, PushChain]
    );

    const getPoolInfo = useCallback(
        async (
            tokenA: Token,
            tokenB: Token,
            feeTier: number = DEFAULT_FEE_TIER
        ): Promise<PoolInfo> => {
            try {
                const poolAddress: string = await v3Factory.getPool(
                    tokenA.address,
                    tokenB.address,
                    feeTier
                );

                if (poolAddress === ethers.ZeroAddress) {
                    return {
                        exists: false,
                        poolAddress: ethers.ZeroAddress,
                        token0: tokenA.address,
                        token1: tokenB.address,
                        fee: feeTier,
                    };
                }

                const poolContract = new ethers.Contract(
                    poolAddress,
                    UniswapV3PoolABI,
                    rpcProvider
                );

                // Get pool state from slot0 and token addresses
                const [slot0, token0, token1] = await Promise.all([
                    poolContract.slot0(),
                    poolContract.token0(),
                    poolContract.token1(),
                ]);

                const sqrtPriceX96 = slot0[0];
                const tick = slot0[1];

                // Calculate human-readable price from sqrtPriceX96
                // price = (sqrtPriceX96 / 2^96) ^ 2
                const Q96 = BigInt(2) ** BigInt(96);
                const priceRatio = Number(sqrtPriceX96) / Number(Q96);
                const price = (priceRatio ** 2).toFixed(8);

                return {
                    exists: true,
                    poolAddress,
                    token0,
                    token1,
                    fee: feeTier,
                    sqrtPriceX96,
                    tick,
                    liquidity: BigInt(0), // Liquidity not available in minimal ABI
                    price,
                };
            } catch (err) {
                console.error("Error getting pool info:", err);
                throw err;
            }
        },
        []
    );

    const getSwapQuote = useCallback(
        async ({
            amountIn,
            tokenIn,
            tokenOut,
            feeTier = DEFAULT_FEE_TIER,
        }: SwapQuoteParams): Promise<SwapQuote | null> => {
            try {
                if (!amountIn || parseFloat(amountIn) === 0) {
                    return null;
                }

                const amountInBigInt = toUnits(amountIn, tokenIn.decimals);

                const poolInfo = await getPoolInfo(tokenIn, tokenOut, feeTier);
                if (!poolInfo.exists) {
                    throw new Error(`No pool found for ${tokenIn.symbol}/${tokenOut.symbol} at fee tier ${feeTier}`);
                }

                // Use Uniswap V3 QuoterV2 for accurate quoting via static call
                const [amountOut, sqrtPriceX96After] = await quoterV2.quoteExactInputSingle.staticCall([
                    tokenIn.address,
                    tokenOut.address,
                    amountInBigInt,
                    feeTier,
                    0n, // sqrtPriceLimitX96
                ]);

                const amountOutFormatted = formatUnits(amountOut, tokenOut.decimals);

                // We can compute a naive price impact later; for now set to 0.0 as placeholder
                const priceImpact = 0.0;

                return {
                    amountOut,
                    amountOutFormatted,
                    sqrtPriceX96After,
                    priceImpact,
                };
            } catch (err) {
                console.error("Error getting swap quote:", err);
                setError((err as Error).message);
                return null;
            }
        },
        [toUnits, formatUnits, getPoolInfo]
    );

    const swap = useCallback(
        async ({
            amountIn,
            minAmountOut,
            tokenIn,
            tokenOut,
            feeTier = DEFAULT_FEE_TIER,
            deadlineMinutes = 20,
        }: SwapParams) => {
            if (!isWalletConnected || !account) {
                throw new Error("Wallet not connected");
            }

            setLoading(true);
            setError(null);

            try {
                const amountInBigInt = toUnits(amountIn, tokenIn.decimals);
                const minAmountOutBigInt = toUnits(minAmountOut, tokenOut.decimals);

                // Ensure token approval
                await ensureAllowance(tokenIn, account, amountInBigInt);

                // Calculate deadline
                const deadline = Math.floor(Date.now() / 1000) + deadlineMinutes * 60;

                // Build swap params for exactInputSingle
                const swapParams = {
                    tokenIn: tokenIn.address,
                    tokenOut: tokenOut.address,
                    fee: feeTier,
                    recipient: account,
                    deadline: BigInt(deadline),
                    amountIn: amountInBigInt,
                    amountOutMinimum: minAmountOutBigInt,
                    sqrtPriceLimitX96: BigInt(0), // No price limit
                };

                const swapTx = await pushChainClient!.universal.sendTransaction({
                    to: CONTRACTS.V3_SWAP_ROUTER as `0x${string}`,
                    data: PushChain.utils.helpers.encodeTxData({
                        abi: SwapRouterV3ABI,
                        functionName: "exactInputSingle",
                        args: [swapParams],
                    }),
                    value: BigInt(0),
                });

                await swapTx.wait();
                return swapTx;
            } catch (err) {
                console.error("Swap failed:", err);
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
        ]
    );

    return {
        // State
        loading,
        error,
        isWalletConnected,
        account,

        // V3 Functions
        getPoolInfo,
        getSwapQuote,
        swap,

        // Utilities
        toUnits,
        formatUnits,
    };
}
