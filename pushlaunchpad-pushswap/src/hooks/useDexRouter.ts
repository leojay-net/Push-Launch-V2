"use client";

import { useCallback, useMemo, useState } from "react";
import { ethers } from "ethers";
import {
    usePushChain,
    usePushChainClient,
    usePushWalletContext,
} from "@pushchain/ui-kit";
import { RouterABI, ERC20ABI } from "@/abis";
import { CHAIN_CONFIG, CONTRACTS, type Token } from "@/lib/contracts";

const rpcProvider = new ethers.JsonRpcProvider(CHAIN_CONFIG.rpcUrl);

const routerReadContract = new ethers.Contract(
    CONTRACTS.ROUTER,
    RouterABI,
    rpcProvider
);

const FACTORY_ABI = [
    "function getPair(address tokenA, address tokenB) external view returns (address)"
];

const PAIR_ABI = [
    "function token0() view returns (address)",
    "function token1() view returns (address)",
    "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address owner) view returns (uint256)"
];

const factoryReadContract = new ethers.Contract(
    CONTRACTS.FACTORY,
    FACTORY_ABI,
    rpcProvider
);

const pairInterface = new ethers.Interface(PAIR_ABI);

const MAX_APPROVAL = ethers.MaxUint256;

interface SwapQuoteParams {
    amountIn: string;
    path: Token[];
}

interface SwapQuote {
    rawAmounts: bigint[];
    formatted: string[];
}

interface SwapParams {
    amountIn: string;
    minAmountOut: string;
    path: Token[];
    deadlineMinutes?: number;
}

interface AddLiquidityParams {
    tokenA: Token;
    tokenB: Token;
    amountADesired: string;
    amountBDesired: string;
    slippageBps: number;
    deadlineMinutes?: number;
}

interface RemoveLiquidityParams {
    tokenA: Token;
    tokenB: Token;
    liquidityAmount: string;
    slippageBps: number;
    deadlineMinutes?: number;
}

interface PairInfo {
    exists: boolean;
    pairAddress: string;
    reserveA?: bigint;
    reserveB?: bigint;
    reserveAFormatted?: string;
    reserveBFormatted?: string;
    totalSupply?: bigint;
    totalSupplyFormatted?: string;
    lpBalance?: bigint;
    lpBalanceFormatted?: string;
}

export function useDexRouter() {
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
                CONTRACTS.ROUTER
            );

            if (currentAllowance >= requiredAmount) {
                return;
            }

            const approveTx = await pushChainClient!.universal.sendTransaction({
                to: token.address as `0x${string}`,
                data: PushChain.utils.helpers.encodeTxData({
                    abi: ERC20ABI,
                    functionName: "approve",
                    args: [CONTRACTS.ROUTER, MAX_APPROVAL],
                }),
                value: BigInt(0),
            });

            await approveTx.wait();
        },
        [pushChainClient, PushChain]
    );

    const getPairInfo = useCallback(
        async (tokenA: Token, tokenB: Token): Promise<PairInfo> => {
            try {
                const pairAddress: string = await factoryReadContract.getPair(
                    tokenA.address,
                    tokenB.address
                );

                if (pairAddress === ethers.ZeroAddress) {
                    return {
                        exists: false,
                        pairAddress,
                    };
                }

                const pairContract = new ethers.Contract(
                    pairAddress,
                    pairInterface,
                    rpcProvider
                );

                const [token0, _token1, reserves, totalSupply]: [
                    string,
                    string,
                    { reserve0: bigint; reserve1: bigint; blockTimestampLast: number },
                    bigint
                ] = await Promise.all([
                    pairContract.token0(),
                    pairContract.token1(),
                    pairContract.getReserves(),
                    pairContract.totalSupply(),
                ]);

                const lpBalance: bigint = account
                    ? await pairContract.balanceOf(account)
                    : BigInt(0);

                const isTokenA0 =
                    tokenA.address.toLowerCase() === token0.toLowerCase();

                const reserveA = isTokenA0 ? reserves.reserve0 : reserves.reserve1;
                const reserveB = isTokenA0 ? reserves.reserve1 : reserves.reserve0;

                return {
                    exists: true,
                    pairAddress,
                    reserveA,
                    reserveB,
                    reserveAFormatted: formatUnits(reserveA, tokenA.decimals),
                    reserveBFormatted: formatUnits(reserveB, tokenB.decimals),
                    totalSupply,
                    totalSupplyFormatted: formatUnits(totalSupply, 18),
                    lpBalance,
                    lpBalanceFormatted: formatUnits(lpBalance, 18),
                };
            } catch (err) {
                console.error("Failed to fetch pair info", err);
                throw err;
            }
        },
        [account, formatUnits]
    );

    const quoteExactInput = useCallback(
        async ({ amountIn, path }: SwapQuoteParams): Promise<SwapQuote> => {
            const addresses = path.map((token) => token.address);
            const amountInUnits = toUnits(amountIn, path[0].decimals);
            const rawAmounts: bigint[] = await routerReadContract.getAmountsOut(
                amountInUnits,
                addresses
            );

            const formatted = rawAmounts.map((value, index) =>
                formatUnits(value, path[index].decimals)
            );

            return { rawAmounts, formatted };
        },
        [formatUnits, toUnits]
    );

    const getTokenBalance = useCallback(
        async (token: Token) => {
            if (!account) {
                return {
                    raw: BigInt(0),
                    formatted: "0",
                };
            }

            const tokenContract = new ethers.Contract(
                token.address,
                ERC20ABI,
                rpcProvider
            );

            const balance: bigint = await tokenContract.balanceOf(account);
            return {
                raw: balance,
                formatted: formatUnits(balance, token.decimals),
            };
        },
        [account, formatUnits]
    );

    const swapExactTokensForTokens = useCallback(
        async ({
            amountIn,
            minAmountOut,
            path,
            deadlineMinutes = 20,
        }: SwapParams) => {
            if (!pushChainClient || !isWalletConnected || !account) {
                throw new Error("Wallet not connected");
            }

            setLoading(true);
            setError(null);

            try {
                const amountInUnits = toUnits(amountIn, path[0].decimals);
                const minOutUnits = toUnits(
                    minAmountOut,
                    path[path.length - 1].decimals
                );

                await ensureAllowance(path[0], account, amountInUnits);

                const deadline =
                    Math.floor(Date.now() / 1000) + deadlineMinutes * 60;

                const tx = await pushChainClient.universal.sendTransaction({
                    to: CONTRACTS.ROUTER as `0x${string}`,
                    data: PushChain.utils.helpers.encodeTxData({
                        abi: RouterABI,
                        functionName: "swapExactTokensForTokens",
                        args: [
                            amountInUnits,
                            minOutUnits,
                            path.map((token) => token.address),
                            account,
                            deadline,
                        ],
                    }),
                    value: BigInt(0),
                });

                await tx.wait();
                return tx;
            } catch (err) {
                console.error("Swap failed", err);
                setError((err as Error).message);
                throw err;
            } finally {
                setLoading(false);
            }
        },
        [
            pushChainClient,
            isWalletConnected,
            account,
            toUnits,
            ensureAllowance,
            PushChain,
        ]
    );

    const addLiquidity = useCallback(
        async ({
            tokenA,
            tokenB,
            amountADesired,
            amountBDesired,
            slippageBps,
            deadlineMinutes = 20,
        }: AddLiquidityParams) => {
            if (!pushChainClient || !isWalletConnected || !account) {
                throw new Error("Wallet not connected");
            }

            setLoading(true);
            setError(null);

            try {
                const amountAUnits = toUnits(amountADesired, tokenA.decimals);
                const amountBUnits = toUnits(amountBDesired, tokenB.decimals);

                await Promise.all([
                    ensureAllowance(tokenA, account, amountAUnits),
                    ensureAllowance(tokenB, account, amountBUnits),
                ]);

                const amountAMin = (amountAUnits * BigInt(10000 - slippageBps)) / BigInt(10000);
                const amountBMin = (amountBUnits * BigInt(10000 - slippageBps)) / BigInt(10000);
                const deadline =
                    Math.floor(Date.now() / 1000) + deadlineMinutes * 60;

                const tx = await pushChainClient.universal.sendTransaction({
                    to: CONTRACTS.ROUTER as `0x${string}`,
                    data: PushChain.utils.helpers.encodeTxData({
                        abi: RouterABI,
                        functionName: "addLiquidity",
                        args: [
                            tokenA.address,
                            tokenB.address,
                            amountAUnits,
                            amountBUnits,
                            amountAMin,
                            amountBMin,
                            account,
                            deadline,
                        ],
                    }),
                    value: BigInt(0),
                });

                await tx.wait();
                return tx;
            } catch (err) {
                console.error("Add liquidity failed", err);
                setError((err as Error).message);
                throw err;
            } finally {
                setLoading(false);
            }
        },
        [
            pushChainClient,
            isWalletConnected,
            account,
            toUnits,
            ensureAllowance,
            PushChain,
        ]
    );

    const removeLiquidity = useCallback(
        async ({
            tokenA,
            tokenB,
            liquidityAmount,
            slippageBps,
            deadlineMinutes = 20,
        }: RemoveLiquidityParams) => {
            if (!pushChainClient || !isWalletConnected || !account) {
                throw new Error("Wallet not connected");
            }

            setLoading(true);
            setError(null);

            try {
                const pairInfo = await getPairInfo(tokenA, tokenB);

                if (!pairInfo.exists || !pairInfo.pairAddress) {
                    throw new Error("Liquidity pool does not exist");
                }

                if (
                    pairInfo.reserveA === undefined ||
                    pairInfo.reserveB === undefined ||
                    pairInfo.totalSupply === undefined
                ) {
                    throw new Error("Failed to fetch pool reserves");
                }

                const pairAddress = pairInfo.pairAddress;
                const liquidityUnits = toUnits(liquidityAmount, 18);

                const pairToken = new ethers.Contract(
                    pairAddress,
                    ERC20ABI,
                    rpcProvider
                );

                const currentAllowance: bigint = await pairToken.allowance(
                    account,
                    CONTRACTS.ROUTER
                );

                if (currentAllowance < liquidityUnits) {
                    const approveTx = await pushChainClient.universal.sendTransaction({
                        to: pairAddress as `0x${string}`,
                        data: PushChain.utils.helpers.encodeTxData({
                            abi: ERC20ABI,
                            functionName: "approve",
                            args: [CONTRACTS.ROUTER, MAX_APPROVAL],
                        }),
                        value: BigInt(0),
                    });
                    await approveTx.wait();
                }

                const amountAExpected =
                    (pairInfo.reserveA * liquidityUnits) / pairInfo.totalSupply;
                const amountBExpected =
                    (pairInfo.reserveB * liquidityUnits) / pairInfo.totalSupply;

                const amountAMin =
                    (amountAExpected * BigInt(10000 - slippageBps)) / BigInt(10000);
                const amountBMin =
                    (amountBExpected * BigInt(10000 - slippageBps)) / BigInt(10000);
                const deadline =
                    Math.floor(Date.now() / 1000) + deadlineMinutes * 60;

                const tx = await pushChainClient.universal.sendTransaction({
                    to: CONTRACTS.ROUTER as `0x${string}`,
                    data: PushChain.utils.helpers.encodeTxData({
                        abi: RouterABI,
                        functionName: "removeLiquidity",
                        args: [
                            tokenA.address,
                            tokenB.address,
                            liquidityUnits,
                            amountAMin,
                            amountBMin,
                            account,
                            deadline,
                        ],
                    }),
                    value: BigInt(0),
                });

                await tx.wait();
                return tx;
            } catch (err) {
                console.error("Remove liquidity failed", err);
                setError((err as Error).message);
                throw err;
            } finally {
                setLoading(false);
            }
        },
        [
            pushChainClient,
            isWalletConnected,
            account,
            toUnits,
            PushChain,
        ]
    );

    return useMemo(
        () => ({
            loading,
            error,
            isWalletConnected,
            account,
            quoteExactInput,
            swapExactTokensForTokens,
            addLiquidity,
            removeLiquidity,
            getPairInfo,
            getTokenBalance,
            refreshPairInfo: getPairInfo,
        }),
        [
            loading,
            error,
            isWalletConnected,
            account,
            quoteExactInput,
            swapExactTokensForTokens,
            addLiquidity,
            removeLiquidity,
            getPairInfo,
            getTokenBalance,
        ]
    );
}
