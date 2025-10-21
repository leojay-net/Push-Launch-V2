"use client";

import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import { ArrowDownUp, Settings, Info, AlertCircle } from "lucide-react";
import Card from "../ui/Card";
import Input from "../ui/Input";
import Button from "../ui/Button";
import Badge from "../ui/Badge";
import TokenSelector from "@/components/dex/TokenSelector";
import SlippageSettings from "@/components/dex/SlippageSettings";
import { formatNumber } from "@/lib/utils";
import { COMMON_TOKENS, CONTRACTS, type Token } from "@/lib/contracts";
import { useDexV3 } from "@/hooks/useDexV3";
import { useLaunchHistory } from "@/hooks/useLaunchHistory";
import { useNotification } from "@/components/ui/Notification";

interface TokenBalance {
    raw: bigint;
    formatted: string;
}

interface SwapInterfaceProps {
    preSelectedToken?: string | null;
}

export default function SwapInterface({ preSelectedToken }: SwapInterfaceProps) {
    const {
        getSwapQuote,
        swap,
        loading,
        error,
        isWalletConnected,
        getPoolInfo,
    } = useDexV3();

    const { launches } = useLaunchHistory();
    const { addNotification } = useNotification();

    const [fromToken, setFromToken] = useState<Token | null>(null);
    const [toToken, setToToken] = useState<Token | null>(null);
    const [fromAmount, setFromAmount] = useState<string>("");
    const [toAmount, setToAmount] = useState<string>("");
    const [minimumReceived, setMinimumReceived] = useState<string>("0");
    const [priceImpact, setPriceImpact] = useState<number | null>(null);
    const [quoteError, setQuoteError] = useState<string | null>(null);
    const [isQuoting, setIsQuoting] = useState(false);
    const [balances, setBalances] = useState<{ from: TokenBalance; to: TokenBalance }>(
        {
            from: { raw: BigInt(0), formatted: "0" },
            to: { raw: BigInt(0), formatted: "0" },
        }
    );
    const [showFromTokenSelector, setShowFromTokenSelector] = useState(false);
    const [showToTokenSelector, setShowToTokenSelector] = useState(false);
    const [showSlippageSettings, setShowSlippageSettings] = useState(false);
    const [slippage, setSlippage] = useState(0.5);

    const slippageBps = useMemo(() => Math.round(slippage * 100), [slippage]);

    // Track if tokens have been initialized to prevent re-initialization
    const [tokensInitialized, setTokensInitialized] = useState(false);

    // Initialize tokens based on URL parameter
    useEffect(() => {
        // Only initialize once
        if (tokensInitialized) return;

        if (preSelectedToken && ethers.isAddress(preSelectedToken)) {
            // Check if it's a graduated token
            const graduatedToken = launches.find(
                l => l.status === "completed" && l.token.toLowerCase() === preSelectedToken.toLowerCase()
            );

            if (graduatedToken) {
                // Set graduated token as toToken (user will swap WPC for it)
                setToToken({
                    address: graduatedToken.token,
                    symbol: graduatedToken.symbol,
                    name: graduatedToken.name,
                    decimals: 18,
                });
                // Set WPC as fromToken
                const wpc = COMMON_TOKENS.find(t => t.symbol === "WPC");
                if (wpc) {
                    setFromToken(wpc);
                }
                setTokensInitialized(true);
            }
        } else if (!tokensInitialized) {
            // Default initialization
            setFromToken(COMMON_TOKENS[0] ?? null);
            setToToken(
                COMMON_TOKENS[1]?.address !== COMMON_TOKENS[0]?.address
                    ? COMMON_TOKENS[1] ?? null
                    : null
            );
            setTokensInitialized(true);
        }
    }, [preSelectedToken, launches, tokensInitialized, setFromToken, setToToken]);

    useEffect(() => {
        let cancelled = false;

        const fetchBalances = async () => {
            if (!isWalletConnected) {
                setBalances({
                    from: { raw: BigInt(0), formatted: "0" },
                    to: { raw: BigInt(0), formatted: "0" },
                });
                return;
            }

            try {
                const [fromBalance, toBalance] = await Promise.all([
                    fromToken ? getTokenBalance(fromToken) : Promise.resolve({ raw: BigInt(0), formatted: "0" }),
                    toToken ? getTokenBalance(toToken) : Promise.resolve({ raw: BigInt(0), formatted: "0" }),
                ]);

                if (!cancelled) {
                    setBalances({
                        from: fromBalance,
                        to: toBalance,
                    });
                }
            } catch (err) {
                console.error("Failed to fetch balances", err);
            }
        };

        fetchBalances();

        return () => {
            cancelled = true;
        };
    }, [fromToken, toToken, getTokenBalance, isWalletConnected, loading]);

    useEffect(() => {
        let cancelled = false;

        const runQuote = async () => {
            if (!fromToken || !toToken) {
                setToAmount("");
                setMinimumReceived("0");
                setPriceImpact(null);
                setQuoteError(null);
                return;
            }

            if (fromToken.address.toLowerCase() === toToken.address.toLowerCase()) {
                setToAmount("");
                setMinimumReceived("0");
                setPriceImpact(null);
                setQuoteError("Please select two different tokens");
                return;
            }

            if (!fromAmount || parseFloat(fromAmount) <= 0) {
                setToAmount("");
                setMinimumReceived("0");
                setPriceImpact(null);
                setQuoteError(null);
                return;
            }

            setIsQuoting(true);
            setQuoteError(null);

            try {
                const quote = await quoteExactInput({
                    amountIn: fromAmount,
                    path: [fromToken, toToken],
                });

                if (cancelled) return;

                const rawOut = quote.rawAmounts[quote.rawAmounts.length - 1];
                const formattedOut = quote.formatted[quote.formatted.length - 1];
                setToAmount(formattedOut);

                const minOut =
                    (rawOut * BigInt(10000 - slippageBps)) / BigInt(10000);
                setMinimumReceived(
                    ethers.formatUnits(minOut, toToken.decimals)
                );

                try {
                    const pairInfo = await getPairInfo(fromToken, toToken);
                    if (
                        !cancelled &&
                        pairInfo.exists &&
                        pairInfo.reserveA !== undefined &&
                        pairInfo.reserveB !== undefined
                    ) {
                        const reserveAFloat = parseFloat(
                            ethers.formatUnits(pairInfo.reserveA, fromToken.decimals)
                        );
                        const reserveBFloat = parseFloat(
                            ethers.formatUnits(pairInfo.reserveB, toToken.decimals)
                        );

                        if (reserveAFloat > 0 && reserveBFloat > 0) {
                            const idealRate = reserveBFloat / reserveAFloat;
                            const actualRate =
                                parseFloat(formattedOut) / parseFloat(fromAmount);
                            const impact =
                                idealRate === 0
                                    ? 0
                                    : ((idealRate - actualRate) / idealRate) * 100;
                            const impactClamped = Number.isFinite(impact)
                                ? Math.max(impact, 0)
                                : null;
                            setPriceImpact(impactClamped);
                        } else {
                            setPriceImpact(null);
                        }
                    } else if (!cancelled) {
                        setPriceImpact(null);
                    }
                } catch (err) {
                    console.warn("Failed to compute price impact", err);
                    if (!cancelled) {
                        setPriceImpact(null);
                    }
                }
            } catch (err) {
                if (!cancelled) {
                    setQuoteError((err as Error).message);
                    setToAmount("");
                    setMinimumReceived("0");
                    setPriceImpact(null);
                }
            } finally {
                if (!cancelled) {
                    setIsQuoting(false);
                }
            }
        };

        runQuote();

        return () => {
            cancelled = true;
        };
    }, [
        fromAmount,
        fromToken,
        toToken,
        quoteExactInput,
        slippageBps,
        getPairInfo,
    ]);

    // When fromToken changes, clear toToken if no direct pair exists
    useEffect(() => {
        let cancelled = false;
        const checkPair = async () => {
            if (!fromToken || !toToken) return;
            try {
                const info = await getPairInfo(fromToken, toToken);
                if (!cancelled && !info.exists) {
                    setToToken(null);
                }
            } catch {
                if (!cancelled) setToToken(null);
            }
        };
        checkPair();
        return () => { cancelled = true; };
    }, [fromToken]);

    const handleSwapTokens = () => {
        setFromToken(toToken);
        setToToken(fromToken);
        setFromAmount(toAmount);
        setToAmount(fromAmount);
    };

    const handleMax = () => {
        if (balances.from.formatted !== "0") {
            setFromAmount(balances.from.formatted);
        }
    };

    const handleSwap = async () => {
        if (!fromToken || !toToken || !fromAmount) {
            return;
        }

        try {
            await swapExactTokensForTokens({
                amountIn: fromAmount,
                minAmountOut: minimumReceived,
                path: [fromToken, toToken],
            });

            setFromAmount("");
            setToAmount("");
            setMinimumReceived("0");
            setPriceImpact(null);

            if (isWalletConnected) {
                const [fromBalance, toBalance] = await Promise.all([
                    getTokenBalance(fromToken),
                    getTokenBalance(toToken),
                ]);
                setBalances({ from: fromBalance, to: toBalance });
            }

            addNotification({
                type: "success",
                title: "Swap Successful",
                message: `Successfully swapped ${fromAmount} ${fromToken.symbol} for ${toToken.symbol}`,
            });
        } catch (err) {
            addNotification({
                type: "error",
                title: "Swap Failed",
                message: (err as Error).message,
            });
        }
    };

    const isInsufficientInput = !fromAmount || parseFloat(fromAmount) <= 0;
    const isInsufficientTokens =
        !fromToken ||
        !toToken ||
        (fromToken && toToken &&
            fromToken.address.toLowerCase() === toToken.address.toLowerCase());

    const swapButtonLabel = useMemo(() => {
        if (!isWalletConnected) return "Connect Wallet";
        if (isInsufficientTokens) return "Select Tokens";
        if (isInsufficientInput) return "Enter Amount";
        if (isQuoting || loading) return "Fetching Quote...";
        return "Swap";
    }, [
        isWalletConnected,
        isInsufficientTokens,
        isInsufficientInput,
        isQuoting,
        loading,
    ]);

    const isSwapDisabled =
        !isWalletConnected ||
        isInsufficientTokens ||
        isInsufficientInput ||
        isQuoting ||
        loading;

    return (
        <>
            <Card variant="elevated">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-semibold text-gray-900">Swap</h2>
                    <button
                        onClick={() => setShowSlippageSettings(true)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <Settings className="w-5 h-5 text-gray-600" />
                    </button>
                </div>

                <div className="space-y-2 mb-2">
                    <label className="text-sm text-gray-600">From</label>
                    <div className="relative">
                        <Input
                            type="number"
                            placeholder="0.0"
                            value={fromAmount}
                            onChange={(e) => setFromAmount(e.target.value)}
                            inputSize="lg"
                            className="pr-32"
                        />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowFromTokenSelector(true)}
                            >
                                {fromToken ? (
                                    <span className="font-medium">{fromToken.symbol}</span>
                                ) : (
                                    "Select Token"
                                )}
                            </Button>
                        </div>
                    </div>
                    {fromToken && (
                        <div className="flex justify-between text-sm text-gray-500">
                            <span>Balance: {formatNumber(balances.from.formatted)}</span>
                            <button
                                type="button"
                                onClick={handleMax}
                                className="text-emerald-600 hover:text-emerald-700 font-medium"
                            >
                                MAX
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex justify-center -my-2 relative z-10">
                    <button
                        onClick={handleSwapTokens}
                        className="p-2 bg-white border-4 border-gray-50 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        <ArrowDownUp className="w-5 h-5 text-gray-600" />
                    </button>
                </div>

                <div className="space-y-2 mb-6">
                    <label className="text-sm text-gray-600">To</label>
                    <div className="relative">
                        <Input
                            type="number"
                            placeholder="0.0"
                            value={toAmount}
                            onChange={(e) => setToAmount(e.target.value)}
                            inputSize="lg"
                            className="pr-32"
                            disabled
                        />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowToTokenSelector(true)}
                            >
                                {toToken ? (
                                    <span className="font-medium">{toToken.symbol}</span>
                                ) : (
                                    "Select Token"
                                )}
                            </Button>
                        </div>
                    </div>
                    {toToken && (
                        <div className="text-sm text-gray-500">
                            <span>Balance: {formatNumber(balances.to.formatted)}</span>
                        </div>
                    )}
                </div>

                {(quoteError || error) && (
                    <div className="flex items-start gap-2 bg-red-50 text-red-700 text-sm rounded-lg p-3 mb-4">
                        <AlertCircle className="w-4 h-4 mt-0.5" />
                        <span>{quoteError ?? error}</span>
                    </div>
                )}

                {fromToken && toToken && fromAmount && toAmount && !quoteError && (
                    <div className="bg-gray-50 rounded-lg p-4 space-y-2 mb-6">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Rate</span>
                            <span className="font-medium">
                                1 {fromToken.symbol} =
                                {" "}
                                {formatNumber(
                                    (
                                        parseFloat(toAmount || "0") /
                                        parseFloat(fromAmount || "1")
                                    ).toString()
                                )} {toToken.symbol}
                            </span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Price Impact</span>
                            <Badge
                                variant={priceImpact !== null && priceImpact > 5 ? "danger" : "success"}
                                size="sm"
                            >
                                {priceImpact !== null
                                    ? `${priceImpact.toFixed(2)}%`
                                    : "< 0.01%"}
                            </Badge>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Minimum Received</span>
                            <span className="font-medium">
                                {formatNumber(minimumReceived)} {toToken.symbol}
                            </span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Slippage Tolerance</span>
                            <span className="font-medium">{slippage}%</span>
                        </div>
                    </div>
                )}

                <Button
                    variant="primary"
                    fullWidth
                    size="lg"
                    onClick={handleSwap}
                    loading={loading}
                    disabled={isSwapDisabled}
                >
                    {swapButtonLabel}
                </Button>

                <div className="mt-4 flex items-start gap-2 text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
                    <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-600" />
                    <p>
                        Swaps are executed via Uniswap V3 Swap Router (0.05% fee tier) and universal transactions.
                        Ensure you have granted token approvals before swapping.
                    </p>
                </div>
            </Card>

            <TokenSelector
                isOpen={showFromTokenSelector}
                onClose={() => setShowFromTokenSelector(false)}
                onSelect={(token: Token) => {
                    setFromToken(token);
                    setShowFromTokenSelector(false);
                }}
                excludeToken={toToken}
                pairWith={null}
                requireExistingPair={false}
            />

            <TokenSelector
                isOpen={showToTokenSelector}
                onClose={() => setShowToTokenSelector(false)}
                onSelect={(token: Token) => {
                    setToToken(token);
                    setShowToTokenSelector(false);
                }}
                excludeToken={fromToken}
                pairWith={fromToken}
                requireExistingPair={true}
            />

            <SlippageSettings
                isOpen={showSlippageSettings}
                onClose={() => setShowSlippageSettings(false)}
                slippage={slippage}
                onSlippageChange={setSlippage}
            />
        </>
    );
}
