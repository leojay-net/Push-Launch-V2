"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import {
    usePushChain,
    usePushChainClient,
    usePushWalletContext,
} from "@pushchain/ui-kit";
import { CHAIN_CONFIG, CONTRACTS } from "@/lib/contracts";
import { LaunchpadABI, ERC20ABI } from "@/abis";

const rpcProvider = new ethers.JsonRpcProvider(CHAIN_CONFIG.rpcUrl);

const launchpadReadContract = new ethers.Contract(
    CONTRACTS.LAUNCHPAD,
    LaunchpadABI,
    rpcProvider
);

export interface TokenInfo {
    address: string;
    name: string;
    symbol: string;
    totalSupply: bigint;
    bondingSupply: bigint;
    baseSold: bigint;
    quoteBought: bigint;
    progress: number;
    isActive: boolean;
    quoteAsset: string;
}

export interface TradeQuote {
    amountIn: string;
    amountOut: string;
    amountInBigInt: bigint;
    amountOutBigInt: bigint;
    priceImpact: number;
}

export function useLaunchpadTrading(tokenAddress: string | null) {
    const { connectionStatus } = usePushWalletContext();
    const { pushChainClient } = usePushChainClient();
    const { PushChain } = usePushChain();

    const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isFetchingInfo, setIsFetchingInfo] = useState(false);

    const isWalletConnected = connectionStatus === "connected";
    const account = pushChainClient?.universal.account;

    const fetchTokenInfo = useCallback(async () => {
        if (!tokenAddress) return;

        setIsFetchingInfo(true);
        setError(null);

        try {
            const tokenContract = new ethers.Contract(
                tokenAddress,
                ERC20ABI,
                rpcProvider
            );

            const [launchData, name, symbol, totalSupply, baseSold, quoteBought] =
                await Promise.all([
                    launchpadReadContract.launches(tokenAddress),
                    tokenContract.name(),
                    tokenContract.symbol(),
                    launchpadReadContract.TOTAL_SUPPLY(),
                    launchpadReadContract.baseSoldFromCurve(tokenAddress),
                    launchpadReadContract.quoteBoughtByCurve(tokenAddress),
                ]);

            const bondingSupply: bigint =
                await launchpadReadContract.BONDING_SUPPLY();

            const progress = bondingSupply
                ? Number((baseSold * BigInt(10000)) / bondingSupply) / 100
                : 0;

            setTokenInfo({
                address: tokenAddress,
                name,
                symbol,
                totalSupply,
                bondingSupply,
                baseSold,
                quoteBought,
                progress: progress > 100 ? 100 : progress,
                isActive: launchData.active,
                quoteAsset: launchData.quote,
            });
        } catch (err) {
            console.error("Failed to fetch token info", err);
            setError((err as Error).message);
        } finally {
            setIsFetchingInfo(false);
        }
    }, [tokenAddress]);

    useEffect(() => {
        if (tokenAddress) {
            fetchTokenInfo();
        }
    }, [tokenAddress, fetchTokenInfo]);

    const quoteBuy = useCallback(
        async (baseAmount: string): Promise<TradeQuote | null> => {
            if (!tokenAddress || !baseAmount) return null;

            try {
                const baseAmountBigInt = ethers.parseUnits(baseAmount, 18);
                const quoteAmount: bigint =
                    await launchpadReadContract.quoteQuoteForBase(
                        tokenAddress,
                        baseAmountBigInt,
                        true
                    );

                const currentPrice =
                    tokenInfo && tokenInfo.baseSold > BigInt(0)
                        ? Number(tokenInfo.quoteBought) / Number(tokenInfo.baseSold)
                        : 0;

                const newPrice =
                    baseAmountBigInt > BigInt(0)
                        ? Number(quoteAmount) / Number(baseAmountBigInt)
                        : 0;

                const priceImpact =
                    currentPrice > 0 ? ((newPrice - currentPrice) / currentPrice) * 100 : 0;

                return {
                    amountIn: baseAmount,
                    amountOut: ethers.formatUnits(quoteAmount, CHAIN_CONFIG.decimals),
                    amountInBigInt: baseAmountBigInt,
                    amountOutBigInt: quoteAmount,
                    priceImpact,
                };
            } catch (err) {
                console.error("Failed to quote buy", err);
                return null;
            }
        },
        [tokenAddress, tokenInfo]
    );

    const quoteSell = useCallback(
        async (baseAmount: string): Promise<TradeQuote | null> => {
            if (!tokenAddress || !baseAmount) return null;

            try {
                const baseAmountBigInt = ethers.parseUnits(baseAmount, 18);
                const quoteAmount: bigint =
                    await launchpadReadContract.quoteQuoteForBase(
                        tokenAddress,
                        baseAmountBigInt,
                        false
                    );

                const currentPrice =
                    tokenInfo && tokenInfo.baseSold > BigInt(0)
                        ? Number(tokenInfo.quoteBought) / Number(tokenInfo.baseSold)
                        : 0;

                const newPrice =
                    baseAmountBigInt > BigInt(0)
                        ? Number(quoteAmount) / Number(baseAmountBigInt)
                        : 0;

                const priceImpact =
                    currentPrice > 0 ? ((newPrice - currentPrice) / currentPrice) * 100 : 0;

                return {
                    amountIn: baseAmount,
                    amountOut: ethers.formatUnits(quoteAmount, CHAIN_CONFIG.decimals),
                    amountInBigInt: baseAmountBigInt,
                    amountOutBigInt: quoteAmount,
                    priceImpact,
                };
            } catch (err) {
                console.error("Failed to quote sell", err);
                return null;
            }
        },
        [tokenAddress, tokenInfo]
    );

    const buy = useCallback(
        async (baseAmount: string, slippageBps: number = 100) => {
            if (!pushChainClient || !account || !tokenAddress) {
                throw new Error("Wallet not connected");
            }

            if (!tokenInfo?.isActive) {
                throw new Error("Token bonding is not active");
            }

            setLoading(true);
            setError(null);

            try {
                const baseAmountBigInt = ethers.parseUnits(baseAmount, 18);
                const maxQuote: bigint = await launchpadReadContract.quoteQuoteForBase(
                    tokenAddress,
                    baseAmountBigInt,
                    true
                );

                const maxQuoteWithSlippage =
                    (maxQuote * BigInt(10000 + slippageBps)) / BigInt(10000);

                const quoteContract = new ethers.Contract(
                    tokenInfo.quoteAsset,
                    ERC20ABI,
                    rpcProvider
                );

                const currentAllowance: bigint = await quoteContract.allowance(
                    account,
                    CONTRACTS.LAUNCHPAD
                );

                if (currentAllowance < maxQuoteWithSlippage) {
                    const approveTx = await pushChainClient.universal.sendTransaction({
                        to: tokenInfo.quoteAsset as `0x${string}`,
                        data: PushChain.utils.helpers.encodeTxData({
                            abi: ERC20ABI,
                            functionName: "approve",
                            args: [CONTRACTS.LAUNCHPAD, ethers.MaxUint256],
                        }),
                        value: BigInt(0),
                    });

                    await approveTx.wait();
                }

                const buyTx = await pushChainClient.universal.sendTransaction({
                    to: CONTRACTS.LAUNCHPAD as `0x${string}`,
                    data: PushChain.utils.helpers.encodeTxData({
                        abi: LaunchpadABI,
                        functionName: "buy",
                        args: [
                            {
                                account: account,
                                token: tokenAddress,
                                recipient: account,
                                amountOutBase: baseAmountBigInt,
                                maxAmountInQuote: maxQuoteWithSlippage,
                            },
                        ],
                    }),
                    value: BigInt(0),
                });

                await buyTx.wait();
                await fetchTokenInfo();

                return buyTx;
            } catch (err) {
                console.error("Buy transaction failed", err);
                setError((err as Error).message);
                throw err;
            } finally {
                setLoading(false);
            }
        },
        [
            pushChainClient,
            account,
            tokenAddress,
            tokenInfo,
            PushChain,
            fetchTokenInfo,
        ]
    );

    const sell = useCallback(
        async (baseAmount: string, slippageBps: number = 100) => {
            if (!pushChainClient || !account || !tokenAddress) {
                throw new Error("Wallet not connected");
            }

            if (!tokenInfo?.isActive) {
                throw new Error("Token bonding is not active");
            }

            setLoading(true);
            setError(null);

            try {
                const baseAmountBigInt = ethers.parseUnits(baseAmount, 18);
                const minQuote: bigint = await launchpadReadContract.quoteQuoteForBase(
                    tokenAddress,
                    baseAmountBigInt,
                    false
                );

                const minQuoteWithSlippage =
                    (minQuote * BigInt(10000 - slippageBps)) / BigInt(10000);

                const tokenContract = new ethers.Contract(
                    tokenAddress,
                    ERC20ABI,
                    rpcProvider
                );

                const currentAllowance: bigint = await tokenContract.allowance(
                    account,
                    CONTRACTS.LAUNCHPAD
                );

                if (currentAllowance < baseAmountBigInt) {
                    const approveTx = await pushChainClient.universal.sendTransaction({
                        to: tokenAddress as `0x${string}`,
                        data: PushChain.utils.helpers.encodeTxData({
                            abi: ERC20ABI,
                            functionName: "approve",
                            args: [CONTRACTS.LAUNCHPAD, ethers.MaxUint256],
                        }),
                        value: BigInt(0),
                    });

                    await approveTx.wait();
                }

                const sellTx = await pushChainClient.universal.sendTransaction({
                    to: CONTRACTS.LAUNCHPAD as `0x${string}`,
                    data: PushChain.utils.helpers.encodeTxData({
                        abi: LaunchpadABI,
                        functionName: "sell",
                        args: [
                            account,
                            tokenAddress,
                            account,
                            baseAmountBigInt,
                            minQuoteWithSlippage,
                        ],
                    }),
                    value: BigInt(0),
                });

                await sellTx.wait();
                await fetchTokenInfo();

                return sellTx;
            } catch (err) {
                console.error("Sell transaction failed", err);
                setError((err as Error).message);
                throw err;
            } finally {
                setLoading(false);
            }
        },
        [
            pushChainClient,
            account,
            tokenAddress,
            tokenInfo,
            PushChain,
            fetchTokenInfo,
        ]
    );

    return useMemo(
        () => ({
            tokenInfo,
            isFetchingInfo,
            loading,
            error,
            isWalletConnected,
            account,
            buy,
            sell,
            quoteBuy,
            quoteSell,
            refreshTokenInfo: fetchTokenInfo,
        }),
        [
            tokenInfo,
            isFetchingInfo,
            loading,
            error,
            isWalletConnected,
            account,
            buy,
            sell,
            quoteBuy,
            quoteSell,
            fetchTokenInfo,
        ]
    );
}
