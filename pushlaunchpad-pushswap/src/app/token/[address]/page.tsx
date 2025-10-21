"use client";

import { use, useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
    ArrowLeft,
    TrendingUp,
    Loader2,
    RefreshCw,
    ExternalLink,
    AlertCircle,
    CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import Layout from "@/components/layout/Layout";
import Card, { CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Badge from "@/components/ui/Badge";
import { formatAddress } from "@/lib/utils";
import { useLaunchpadTrading } from "@/hooks/useLaunchpadTrading";
import { ethers } from "ethers";

const QUOTE_SYMBOL = "WPC";

export default function TokenPage({
    params,
}: {
    params: Promise<{ address: string }>;
}) {
    const { address: tokenAddress } = use(params);
    const router = useRouter();

    const {
        tokenInfo,
        isFetchingInfo,
        loading,
        error,
        isWalletConnected,
        buy,
        sell,
        quoteBuy,
        quoteSell,
        refreshTokenInfo,
    } = useLaunchpadTrading(tokenAddress);

    const [tradeMode, setTradeMode] = useState<"buy" | "sell">("buy");
    const [inputAmount, setInputAmount] = useState("");
    const [outputAmount, setOutputAmount] = useState("");
    const [priceImpact, setPriceImpact] = useState<number>(0);
    const [isQuoting, setIsQuoting] = useState(false);
    const [txSuccess, setTxSuccess] = useState(false);

    const handleQuote = useCallback(
        async (amount: string) => {
            if (!amount || !tokenInfo || !tokenInfo.isActive) {
                setOutputAmount("");
                setPriceImpact(0);
                return;
            }

            setIsQuoting(true);

            try {
                const quote =
                    tradeMode === "buy"
                        ? await quoteBuy(amount)
                        : await quoteSell(amount);

                if (quote) {
                    setOutputAmount(quote.amountOut);
                    setPriceImpact(quote.priceImpact);
                } else {
                    setOutputAmount("");
                    setPriceImpact(0);
                }
            } catch (err) {
                console.error("Quote failed", err);
                setOutputAmount("");
                setPriceImpact(0);
            } finally {
                setIsQuoting(false);
            }
        },
        [tradeMode, quoteBuy, quoteSell, tokenInfo]
    );

    useEffect(() => {
        if (inputAmount) {
            const timeoutId = setTimeout(() => {
                handleQuote(inputAmount);
            }, 500);

            return () => clearTimeout(timeoutId);
        } else {
            setOutputAmount("");
            setPriceImpact(0);
        }
    }, [inputAmount, handleQuote]);

    const handleTrade = async () => {
        if (!inputAmount || !isWalletConnected) return;

        setTxSuccess(false);

        try {
            if (tradeMode === "buy") {
                await buy(inputAmount, 100);
            } else {
                await sell(inputAmount, 100);
            }

            setTxSuccess(true);
            setInputAmount("");
            setOutputAmount("");
            setPriceImpact(0);

            setTimeout(() => setTxSuccess(false), 5000);
        } catch (err) {
            console.error("Trade failed", err);
        }
    };

    const switchMode = (mode: "buy" | "sell") => {
        setTradeMode(mode);
        setInputAmount("");
        setOutputAmount("");
        setPriceImpact(0);
    };

    if (isFetchingInfo) {
        return (
            <Layout>
                <div className="container mx-auto max-w-6xl px-4 py-8">
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                        <span className="ml-3 text-lg text-gray-600">
                            Loading token info...
                        </span>
                    </div>
                </div>
            </Layout>
        );
    }

    if (!tokenInfo) {
        return (
            <Layout>
                <div className="container mx-auto max-w-6xl px-4 py-8">
                    <div className="text-center py-20">
                        <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">
                            Token Not Found
                        </h2>
                        <p className="text-gray-600 mb-6">
                            The token at {formatAddress(tokenAddress)} could not be loaded.
                        </p>
                        <Button onClick={() => router.push("/launchpad")}>
                            Back to Launchpad
                        </Button>
                    </div>
                </div>
            </Layout>
        );
    }

    const progressValue = Math.min(Math.max(tokenInfo.progress, 0), 100);
    const statusVariant = tokenInfo.isActive ? "info" : "success";
    const statusLabel = tokenInfo.isActive ? "Active" : "Graduated";

    return (
        <Layout>
            <div className="container mx-auto max-w-6xl px-4 py-8">
                {/* Header */}
                <div className="mb-8">
                    <Link
                        href="/launchpad"
                        className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-emerald-600 mb-4 transition"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to Launchpad
                    </Link>

                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <h1 className="text-3xl font-bold text-gray-900">
                                    {tokenInfo.name}
                                </h1>
                                <Badge variant="primary" size="lg">
                                    {tokenInfo.symbol}
                                </Badge>
                                <Badge variant={statusVariant} size="sm" dot>
                                    {statusLabel}
                                </Badge>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">
                                {formatAddress(tokenInfo.address)}
                            </p>
                            <div className="flex items-center gap-4">
                                <a
                                    href={`https://donut.push.network/address/${tokenInfo.address}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                                >
                                    View on Explorer
                                    <ExternalLink className="w-3 h-3" />
                                </a>
                                {!tokenInfo.isActive && (
                                    <Link
                                        href={`/dex?token=${tokenAddress}`}
                                        className="inline-flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                                    >
                                        Trade on DEX
                                        <ExternalLink className="w-3 h-3" />
                                    </Link>
                                )}
                            </div>
                        </div>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={refreshTokenInfo}
                            disabled={isFetchingInfo}
                        >
                            {isFetchingInfo ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <RefreshCw className="h-4 w-4" />
                            )}
                            <span className="ml-2">Refresh</span>
                        </Button>
                    </div>
                </div>

                {/* Success Message */}
                {txSuccess && (
                    <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 flex items-center gap-3">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                        <span className="text-emerald-700">
                            Transaction successful! Token info updated.
                        </span>
                    </div>
                )}

                <div className="grid gap-6 lg:grid-cols-3">
                    {/* Stats Panel */}
                    <div className="lg:col-span-1">
                        <Card variant="elevated">
                            <CardHeader>
                                <CardTitle>Token Stats</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div>
                                        <p className="text-sm text-gray-600 mb-1">Bonding Progress</p>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-2xl font-bold text-gray-900">
                                                {progressValue.toFixed(1)}%
                                            </span>
                                            <Badge variant={tokenInfo.isActive ? "info" : "success"}>
                                                {tokenInfo.isActive ? "Bonding" : "Graduated"}
                                            </Badge>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-3">
                                            <div
                                                className="bg-emerald-500 h-3 rounded-full transition-all duration-500"
                                                style={{ width: `${progressValue}%` }}
                                            />
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t border-gray-200">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm text-gray-600">Total Raised</span>
                                            <span className="font-semibold text-gray-900">
                                                {ethers.formatUnits(
                                                    tokenInfo.quoteBought,
                                                    18
                                                )}{" "}
                                                {QUOTE_SYMBOL}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm text-gray-600">Tokens Sold</span>
                                            <span className="font-semibold text-gray-900">
                                                {(
                                                    Number(ethers.formatUnits(tokenInfo.baseSold, 18)) /
                                                    1_000_000
                                                ).toFixed(2)}
                                                M
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-gray-600">Total Supply</span>
                                            <span className="font-semibold text-gray-900">
                                                {(
                                                    Number(ethers.formatUnits(tokenInfo.totalSupply, 18)) /
                                                    1_000_000_000
                                                ).toFixed(0)}
                                                B
                                            </span>
                                        </div>
                                    </div>

                                    {!tokenInfo.isActive && (
                                        <div className="pt-4 border-t border-gray-200">
                                            <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
                                                <p className="font-medium mb-1">✅ Graduated to DEX</p>
                                                <p className="text-xs">
                                                    This token has completed bonding and is now trading on
                                                    the DEX.
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Trading Panel */}
                    <div className="lg:col-span-2">
                        <Card variant="elevated">
                            <CardHeader>
                                <CardTitle>
                                    {tokenInfo.isActive ? "Trade Token" : "Trading Paused"}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {!tokenInfo.isActive ? (
                                    <div className="text-center py-8">
                                        <TrendingUp className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                                        <p className="text-gray-600 mb-4">
                                            Bonding has completed. Trade this token on the DEX.
                                        </p>
                                        <Button onClick={() => router.push("/")}>
                                            Go to DEX
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        {/* Buy/Sell Toggle */}
                                        <div className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 p-1 text-sm font-medium">
                                            <button
                                                type="button"
                                                onClick={() => switchMode("buy")}
                                                className={`rounded-full px-6 py-2 transition ${tradeMode === "buy"
                                                    ? "bg-emerald-600 text-white shadow"
                                                    : "text-gray-600 hover:text-emerald-600"
                                                    }`}
                                            >
                                                Buy
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => switchMode("sell")}
                                                className={`rounded-full px-6 py-2 transition ${tradeMode === "sell"
                                                    ? "bg-red-600 text-white shadow"
                                                    : "text-gray-600 hover:text-red-600"
                                                    }`}
                                            >
                                                Sell
                                            </button>
                                        </div>

                                        {/* Input */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                {tradeMode === "buy" ? "Amount to Buy" : "Amount to Sell"}
                                            </label>
                                            <Input
                                                type="number"
                                                placeholder="0.0"
                                                value={inputAmount}
                                                onChange={(e) => setInputAmount(e.target.value)}
                                                disabled={loading}
                                            />
                                            <p className="mt-1 text-xs text-gray-500">
                                                {tradeMode === "buy"
                                                    ? `${tokenInfo.symbol} tokens`
                                                    : `${tokenInfo.symbol} tokens`}
                                            </p>
                                        </div>

                                        {/* Output */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                {tradeMode === "buy" ? "You Pay" : "You Receive"}
                                            </label>
                                            <div className="relative">
                                                <Input
                                                    type="text"
                                                    value={
                                                        isQuoting
                                                            ? "Calculating..."
                                                            : outputAmount || "0.0"
                                                    }
                                                    disabled
                                                    readOnly
                                                />
                                                {isQuoting && (
                                                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                                        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                                                    </div>
                                                )}
                                            </div>
                                            <p className="mt-1 text-xs text-gray-500">{QUOTE_SYMBOL}</p>
                                        </div>

                                        {/* Price Impact */}
                                        {priceImpact !== 0 && (
                                            <div className="rounded-lg bg-gray-50 p-3">
                                                <div className="flex items-center justify-between text-sm">
                                                    <span className="text-gray-600">Price Impact</span>
                                                    <span
                                                        className={`font-medium ${Math.abs(priceImpact) > 5
                                                            ? "text-red-600"
                                                            : "text-emerald-600"
                                                            }`}
                                                    >
                                                        {priceImpact > 0 ? "+" : ""}
                                                        {priceImpact.toFixed(2)}%
                                                    </span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Error */}
                                        {error && (
                                            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                                                {error}
                                            </div>
                                        )}

                                        {/* Trade Button */}
                                        <Button
                                            onClick={handleTrade}
                                            disabled={!isWalletConnected || loading || !inputAmount || !outputAmount}
                                            fullWidth
                                            size="lg"
                                            variant={tradeMode === "buy" ? "primary" : "danger"}
                                        >
                                            {loading ? (
                                                <>
                                                    <Loader2 className="h-5 w-5 animate-spin" />
                                                    <span className="ml-2">Processing...</span>
                                                </>
                                            ) : !isWalletConnected ? (
                                                "Connect Wallet"
                                            ) : (
                                                `${tradeMode === "buy" ? "Buy" : "Sell"} ${tokenInfo.symbol}`
                                            )}
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </Layout>
    );
}
