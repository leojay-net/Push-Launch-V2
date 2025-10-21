"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { ethers } from "ethers";
import { ArrowDownUp, Settings, Info, AlertCircle, ChevronDown } from "lucide-react";
import Card from "../ui/Card";
import Input from "../ui/Input";
import Button from "../ui/Button";
import Badge from "../ui/Badge";
import TokenSelector from "@/components/dex/TokenSelector";
import SlippageSettings from "@/components/dex/SlippageSettings";
import { formatNumber, normalizeAmountToDecimals, safeParseUnits } from "@/lib/utils";
import { COMMON_TOKENS, CONTRACTS, type Token, CHAIN_CONFIG } from "@/lib/contracts";
import { useDexV3 } from "@/hooks/useDexV3";
import { useLaunchHistory } from "@/hooks/useLaunchHistory";
import { useNotification } from "@/components/ui/Notification";
import { ERC20ABI } from "@/abis";
import Loader from "@/components/ui/Loader";

const rpcProvider = new ethers.JsonRpcProvider(CHAIN_CONFIG.rpcUrl);

interface TokenBalance {
    raw: bigint;
    formatted: string;
}

interface SwapInterfaceProps {
    preSelectedToken?: string | null;
}

export default function SwapInterfaceV3({ preSelectedToken }: SwapInterfaceProps) {
    const {
        getSwapQuote,
        swap,
        loading,
        error,
        isWalletConnected,
        getPoolInfo,
        account,
    } = useDexV3();

    const { launches } = useLaunchHistory();
    const { addNotification } = useNotification();

    const [fromToken, setFromToken] = useState<Token | null>(null);
    const [toToken, setToToken] = useState<Token | null>(null);
    const [fromAmount, setFromAmount] = useState<string>("");
    const [toAmount, setToAmount] = useState<string>("0");
    const [minimumReceived, setMinimumReceived] = useState<string>("0");
    const [priceImpact, setPriceImpact] = useState<number | null>(null);
    const [quoteError, setQuoteError] = useState<string | null>(null);
    const [isQuoting, setIsQuoting] = useState(false);
    const [balances, setBalances] = useState<{ from: TokenBalance; to: TokenBalance }>({
        from: { raw: BigInt(0), formatted: "0" },
        to: { raw: BigInt(0), formatted: "0" },
    });
    const [slippageBps, setSlippageBps] = useState<number>(50); // 0.5% default
    const [showSettings, setShowSettings] = useState(false);
    const [tokensInitialized, setTokensInitialized] = useState(false);
    const [poolExists, setPoolExists] = useState<boolean>(true);
    const [showFromTokenSelector, setShowFromTokenSelector] = useState(false);
    const [showToTokenSelector, setShowToTokenSelector] = useState(false);

    // Fixed fee tier for swaps (0.05% - matches our deployment)
    const feeTier = 500;

    // Get token balance
    const getTokenBalance = useCallback(
        async (token: Token): Promise<TokenBalance> => {
            if (!account) {
                return { raw: BigInt(0), formatted: "0" };
            }

            try {
                const tokenContract = new ethers.Contract(
                    token.address,
                    ERC20ABI,
                    rpcProvider
                );
                const balance: bigint = await tokenContract.balanceOf(account);
                return {
                    raw: balance,
                    formatted: ethers.formatUnits(balance, token.decimals),
                };
            } catch (err) {
                console.error("Error getting balance:", err);
                return { raw: BigInt(0), formatted: "0" };
            }
        },
        [account]
    );

    // Initialize tokens from preSelectedToken or default
    useEffect(() => {
        if (tokensInitialized) return;

        if (preSelectedToken && ethers.isAddress(preSelectedToken)) {
            // Check if it's a graduated token
            const graduatedToken = launches.find(
                (l) =>
                    l.status === "completed" &&
                    l.token.toLowerCase() === preSelectedToken.toLowerCase()
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
                const wpc = COMMON_TOKENS.find((t) => t.symbol === "WPC");
                if (wpc) {
                    setFromToken(wpc);
                }
                setTokensInitialized(true);
            }
        } else if (COMMON_TOKENS.length >= 2 && !tokensInitialized) {
            setFromToken(COMMON_TOKENS[0]);
            setToToken(COMMON_TOKENS[1]);
            setTokensInitialized(true);
        }
    }, [preSelectedToken, launches, tokensInitialized]);

    // Fetch balances
    useEffect(() => {
        if (!isWalletConnected || loading) return;

        const fetchBalances = async () => {
            try {
                const [fromBalance, toBalance] = await Promise.all([
                    fromToken
                        ? getTokenBalance(fromToken)
                        : Promise.resolve({ raw: BigInt(0), formatted: "0" }),
                    toToken
                        ? getTokenBalance(toToken)
                        : Promise.resolve({ raw: BigInt(0), formatted: "0" }),
                ]);

                setBalances({ from: fromBalance, to: toBalance });
            } catch (err) {
                console.error("Error fetching balances:", err);
            }
        };

        fetchBalances();
    }, [fromToken, toToken, getTokenBalance, isWalletConnected, loading]);

    // Check if pool exists (when fee tier changes)
    useEffect(() => {
        if (!fromToken || !toToken) return;

        const checkPool = async () => {
            try {
                const poolInfo = await getPoolInfo(fromToken, toToken, feeTier);
                setPoolExists(poolInfo.exists);
                if (!poolInfo.exists) {
                    setQuoteError(`No ${feeTier / 10000}% fee tier pool exists for this pair`);
                } else {
                    setQuoteError(null);
                }
            } catch (err) {
                console.error("Error checking pool:", err);
                setPoolExists(false);
            }
        };

        checkPool();
    }, [fromToken, toToken, feeTier, getPoolInfo]);

    // Get quote when fromAmount changes
    useEffect(() => {
        if (!fromToken || !toToken || !fromAmount || parseFloat(fromAmount) === 0) {
            setToAmount("0");
            setMinimumReceived("0");
            setPriceImpact(null);
            setQuoteError(null);
            return;
        }

        if (!poolExists) {
            setQuoteError("No liquidity pool exists for this pair");
            return;
        }

        const getQuote = async () => {
            setIsQuoting(true);
            setQuoteError(null);

            try {
                // Normalize before quoting to avoid underflow in downstream parse
                const normalizedIn = fromToken ? normalizeAmountToDecimals(fromAmount, fromToken.decimals) : fromAmount;
                const quote = await getSwapQuote({
                    amountIn: normalizedIn || "0",
                    tokenIn: fromToken,
                    tokenOut: toToken,
                    feeTier: feeTier,
                });

                if (quote) {
                    setToAmount(quote.amountOutFormatted);
                    setPriceImpact(quote.priceImpact);

                    // Calculate minimum received safely in base units (BigInt) and floor
                    const bps = BigInt(10000 - slippageBps);
                    const minOutBigInt = (quote.amountOut * bps) / 10000n;
                    const minOutFormatted = ethers.formatUnits(minOutBigInt, toToken.decimals);
                    setMinimumReceived(minOutFormatted);
                } else {
                    setToAmount("0");
                    setMinimumReceived("0");
                    setPriceImpact(null);
                }
            } catch (err) {
                console.error("Quote error:", err);
                setQuoteError((err as Error).message);
                setToAmount("0");
                setMinimumReceived("0");
            } finally {
                setIsQuoting(false);
            }
        };

        const debounce = setTimeout(getQuote, 500);
        return () => clearTimeout(debounce);
    }, [fromAmount, fromToken, toToken, feeTier, slippageBps, getSwapQuote, poolExists]);

    // Check if swap is possible
    const canSwap = useMemo(() => {
        if (!isWalletConnected) return false;
        if (!fromToken || !toToken) return false;
        if (!fromAmount || fromAmount.trim() === "" || parseFloat(fromAmount) === 0) return false;
        if (!poolExists) return false;
        if (parseFloat(toAmount) === 0) return false;

        try {
            const parsed = safeParseUnits(fromAmount, fromToken.decimals);
            if (parsed == null) return false;
            const amountBigInt = parsed;
            if (amountBigInt > balances.from.raw) return false;
        } catch (err) {
            // Invalid number format
            return false;
        }

        return true;
    }, [isWalletConnected, fromToken, toToken, fromAmount, toAmount, balances, poolExists]);

    // Handle swap tokens
    const handleSwapTokens = () => {
        const temp = fromToken;
        setFromToken(toToken);
        setToToken(temp);
        setFromAmount(toAmount);
    };

    // Handle max button
    const handleMax = () => {
        if (fromToken && balances.from.formatted) {
            setFromAmount(balances.from.formatted);
        }
    };

    // Execute swap
    const handleSwap = async () => {
        if (!fromToken || !toToken || !canSwap) return;

        try {
            await swap({
                amountIn: fromAmount,
                minAmountOut: minimumReceived,
                tokenIn: fromToken,
                tokenOut: toToken,
                feeTier: feeTier,
            });

            addNotification({
                type: "success",
                title: "Swap Successful",
                message: `Successfully swapped ${fromAmount} ${fromToken.symbol} for ${toAmount} ${toToken.symbol}`,
            });

            // Refresh balances
            const [fromBalance, toBalance] = await Promise.all([
                getTokenBalance(fromToken),
                getTokenBalance(toToken),
            ]);
            setBalances({ from: fromBalance, to: toBalance });

            // Reset form
            setFromAmount("");
            setToAmount("0");
            setMinimumReceived("0");
        } catch (err) {
            console.error("Swap failed:", err);
            addNotification({
                type: "error",
                title: "Swap Failed",
                message: `Swap failed: ${(err as Error).message}`,
            });
        }
    };

    const pricePerToken = useMemo(() => {
        if (!fromAmount || !toAmount || parseFloat(fromAmount) === 0 || parseFloat(toAmount) === 0) {
            return null;
        }
        return (parseFloat(toAmount) / parseFloat(fromAmount)).toFixed(6);
    }, [fromAmount, toAmount]);

    return (
        <div className="max-w-md mx-auto">
            <Card>
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-900">Swap V3</h2>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowSettings(true)}
                    >
                        <Settings className="w-5 h-5" />
                    </Button>
                </div>

                {!poolExists && fromToken && toToken && (
                    <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
                        <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-yellow-800">
                            No V3 liquidity pool exists for this pair. Pool may not have been created yet.
                        </p>
                    </div>
                )}

                <div className="space-y-2">
                    {/* From Token */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-sm font-medium text-gray-700">From</label>
                            {isWalletConnected && fromToken && (
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500">
                                        Balance: {formatNumber(balances.from.formatted)}
                                    </span>
                                    <Button size="sm" variant="ghost" onClick={handleMax}>
                                        MAX
                                    </Button>
                                </div>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <Input
                                    type="number"
                                    placeholder="0.0"
                                    value={fromAmount}
                                    onChange={(e) => {
                                        const v = e.target.value;
                                        if (!fromToken) { setFromAmount(v); return; }
                                        const normalized = normalizeAmountToDecimals(v, fromToken.decimals);
                                        // Allow transient invalid states for UX (like trailing '.')
                                        if (v.endsWith('.') && normalized && !normalized.includes('.')) {
                                            setFromAmount(`${normalized}.`);
                                        } else {
                                            setFromAmount(normalized ?? v.replace(/[^\d.]/g, ''));
                                        }
                                    }}
                                    disabled={loading}
                                />
                            </div>
                            <Button
                                variant="outline"
                                onClick={() => setShowFromTokenSelector(true)}
                                className="min-w-[120px]"
                            >
                                {fromToken ? (
                                    <span className="flex items-center gap-1">
                                        {fromToken.symbol}
                                        <ChevronDown className="w-4 h-4" />
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1">
                                        Select
                                        <ChevronDown className="w-4 h-4" />
                                    </span>
                                )}
                            </Button>
                        </div>
                    </div>

                    {/* Swap Button */}
                    <div className="flex justify-center -my-2 relative z-10">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleSwapTokens}
                            disabled={loading}
                            className="rounded-full p-2 bg-white border-2 border-gray-200 hover:border-blue-500"
                        >
                            <ArrowDownUp className="w-4 h-4" />
                        </Button>
                    </div>

                    {/* To Token */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-sm font-medium text-gray-700">To</label>
                            {isWalletConnected && toToken && (
                                <span className="text-xs text-gray-500">
                                    Balance: {formatNumber(balances.to.formatted)}
                                </span>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <Input
                                    type="number"
                                    placeholder="0.0"
                                    value={toAmount}
                                    disabled
                                    className="bg-gray-50"
                                />
                                {isQuoting && (
                                    <div className="mt-1">
                                        <Loader size={16} />
                                    </div>
                                )}
                            </div>
                            <Button
                                variant="outline"
                                onClick={() => setShowToTokenSelector(true)}
                                className="min-w-[120px]"
                            >
                                {toToken ? (
                                    <span className="flex items-center gap-1">
                                        {toToken.symbol}
                                        <ChevronDown className="w-4 h-4" />
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1">
                                        Select
                                        <ChevronDown className="w-4 h-4" />
                                    </span>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Swap Info */}
                {fromToken && toToken && parseFloat(fromAmount) > 0 && parseFloat(toAmount) > 0 && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg space-y-2">
                        {pricePerToken && (
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-600">Price</span>
                                <span className="font-medium text-gray-900">
                                    1 {fromToken.symbol} = {pricePerToken} {toToken.symbol}
                                </span>
                            </div>
                        )}
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-600">Minimum Received</span>
                            <span className="font-medium text-gray-900">
                                {formatNumber(minimumReceived)} {toToken.symbol}
                            </span>
                        </div>
                        {priceImpact !== null && (
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-600">Price Impact</span>
                                <Badge
                                    variant={
                                        priceImpact > 5
                                            ? "danger"
                                            : priceImpact > 1
                                                ? "warning"
                                                : "success"
                                    }
                                >
                                    {priceImpact.toFixed(2)}%
                                </Badge>
                            </div>
                        )}
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-600">Fee Tier</span>
                            <span className="font-medium text-gray-900">0.05%</span>
                        </div>
                    </div>
                )}

                {quoteError && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-800">{quoteError}</p>
                    </div>
                )}

                {error && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-800">{error}</p>
                    </div>
                )}

                {/* Swap Button */}
                <div className="mt-6">
                    {!isWalletConnected ? (
                        <Button fullWidth size="lg" disabled>
                            Connect Wallet to Swap
                        </Button>
                    ) : !fromToken || !toToken ? (
                        <Button fullWidth size="lg" disabled>
                            Select Tokens
                        </Button>
                    ) : !poolExists ? (
                        <Button fullWidth size="lg" disabled>
                            No Pool Available
                        </Button>
                    ) : !canSwap ? (
                        <Button fullWidth size="lg" disabled>
                            {!fromAmount || fromAmount.trim() === "" || parseFloat(fromAmount) === 0
                                ? "Enter Amount"
                                : (() => {
                                    try {
                                        const parsed = safeParseUnits(fromAmount, fromToken.decimals);
                                        if (parsed == null) return "Invalid Amount";
                                        return balances.from.raw < parsed
                                            ? "Insufficient Balance"
                                            : "Invalid Amount";
                                    } catch {
                                        return "Invalid Amount";
                                    }
                                })()}
                        </Button>
                    ) : (
                        <div className="relative">
                            <Button
                                fullWidth
                                size="lg"
                                onClick={handleSwap}
                                disabled={loading || isQuoting}
                            >
                                {loading ? "Swapping..." : isQuoting ? "Getting Quote..." : "Swap"}
                            </Button>
                            {loading && (
                                <div className="absolute inset-0 grid place-items-center bg-white/60 rounded-lg">
                                    <Loader size={28} label="Preparing wallet..." />
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Info Footer */}
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
                    <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-blue-800">
                        Swaps are executed via Uniswap V3 with 0.05% fee tier and universal transactions.
                    </p>
                </div>
            </Card>

            {/* Token Selectors */}
            <TokenSelector
                isOpen={showFromTokenSelector}
                onClose={() => setShowFromTokenSelector(false)}
                onSelect={(token) => {
                    setFromToken(token);
                    setShowFromTokenSelector(false);
                }}
                excludeToken={toToken}
            />

            <TokenSelector
                isOpen={showToTokenSelector}
                onClose={() => setShowToTokenSelector(false)}
                onSelect={(token) => {
                    setToToken(token);
                    setShowToTokenSelector(false);
                }}
                excludeToken={fromToken}
            />

            {/* Slippage Settings Modal */}
            <SlippageSettings
                isOpen={showSettings}
                onClose={() => setShowSettings(false)}
                slippage={slippageBps / 100}
                onSlippageChange={(val) => setSlippageBps(val * 100)}
            />
        </div>
    );
}
