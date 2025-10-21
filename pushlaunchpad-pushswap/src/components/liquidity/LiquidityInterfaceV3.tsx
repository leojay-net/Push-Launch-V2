"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { ethers } from "ethers";
import { Plus, Minus, Info, Droplets, TrendingUp, ChevronDown } from "lucide-react";
import Card from "../ui/Card";
import Input from "../ui/Input";
import Button from "../ui/Button";
import Badge from "../ui/Badge";
import TokenSelector from "../dex/TokenSelector";
import { useNotification } from "../ui/Notification";
import { COMMON_TOKENS, CHAIN_CONFIG, type Token } from "@/lib/contracts";
import { formatNumber } from "@/lib/utils";
import { useLiquidityV3 } from "@/hooks/useLiquidityV3";
import { ERC20ABI } from "@/abis";
import Loader from "@/components/ui/Loader";

const rpcProvider = new ethers.JsonRpcProvider(CHAIN_CONFIG.rpcUrl);

type LiquidityMode = "add" | "manage";

interface TokenBalance {
    raw: bigint;
    formatted: string;
}

export default function LiquidityInterfaceV3() {
    const { addNotification } = useNotification();
    const {
        mintPosition,
        increaseLiquidity,
        removeLiquidity,
        collectFees,
        getUserPositions,
        getPoolInfo,
        loading,
        error,
        isWalletConnected,
        account,
    } = useLiquidityV3();

    const [mode, setMode] = useState<LiquidityMode>("add");
    const [tokenA, setTokenA] = useState<Token | null>(COMMON_TOKENS[0] || null);
    const [tokenB, setTokenB] = useState<Token | null>(COMMON_TOKENS[1] || null);
    const [amountA, setAmountA] = useState("");
    const [amountB, setAmountB] = useState("");
    const [balances, setBalances] = useState<{ a: TokenBalance; b: TokenBalance }>({
        a: { raw: BigInt(0), formatted: "0" },
        b: { raw: BigInt(0), formatted: "0" },
    });
    const [positions, setPositions] = useState<any[]>([]);
    const [positionsLoading, setPositionsLoading] = useState<boolean>(false);
    const [selectedPosition, setSelectedPosition] = useState<any | null>(null);
    const [removePercentage, setRemovePercentage] = useState("100");
    const [poolExists, setPoolExists] = useState(true);
    const [priceRange, setPriceRange] = useState({ min: "", max: "" });
    const [showTokenASelector, setShowTokenASelector] = useState(false);
    const [showTokenBSelector, setShowTokenBSelector] = useState(false);

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

    // Load balances
    useEffect(() => {
        if (!isWalletConnected || loading) return;

        const fetchBalances = async () => {
            try {
                const [balanceA, balanceB] = await Promise.all([
                    tokenA
                        ? getTokenBalance(tokenA)
                        : Promise.resolve({ raw: BigInt(0), formatted: "0" }),
                    tokenB
                        ? getTokenBalance(tokenB)
                        : Promise.resolve({ raw: BigInt(0), formatted: "0" }),
                ]);

                setBalances({ a: balanceA, b: balanceB });
            } catch (err) {
                console.error("Error fetching balances:", err);
            }
        };

        fetchBalances();
    }, [tokenA, tokenB, getTokenBalance, isWalletConnected, loading]);

    // Load user positions
    useEffect(() => {
        if (!isWalletConnected) return;

        const loadPositions = async () => {
            try {
                setPositionsLoading(true);
                const userPositions = await getUserPositions();
                setPositions(userPositions);
            } catch (err) {
                console.error("Error loading positions:", err);
            } finally {
                setPositionsLoading(false);
            }
        };

        loadPositions();
    }, [isWalletConnected, getUserPositions, loading]);

    // Check if pool exists
    useEffect(() => {
        if (!tokenA || !tokenB) return;

        const checkPool = async () => {
            try {
                const poolInfo = await getPoolInfo(tokenA, tokenB);
                setPoolExists(poolInfo.exists);
            } catch (err) {
                console.error("Error checking pool:", err);
                setPoolExists(false);
            }
        };

        checkPool();
    }, [tokenA, tokenB, getPoolInfo]);

    const handleAddLiquidity = async () => {
        if (!tokenA || !tokenB || !amountA || !amountB) return;

        try {
            await mintPosition({
                token0: tokenA,
                token1: tokenB,
                amount0Desired: amountA,
                amount1Desired: amountB,
            });

            addNotification({
                type: "success",
                title: "Success",
                message: `Added liquidity: ${amountA} ${tokenA.symbol} + ${amountB} ${tokenB.symbol}`,
            });

            // Refresh data
            const [balanceA, balanceB] = await Promise.all([
                getTokenBalance(tokenA),
                getTokenBalance(tokenB),
            ]);
            setBalances({ a: balanceA, b: balanceB });

            const userPositions = await getUserPositions();
            setPositions(userPositions);

            // Reset form
            setAmountA("");
            setAmountB("");
        } catch (err) {
            console.error("Add liquidity failed:", err);
            addNotification({
                type: "error",
                title: "Error",
                message: `Failed to add liquidity: ${(err as Error).message}`,
            });
        }
    };

    const handleRemoveLiquidity = async () => {
        if (!selectedPosition) return;

        try {
            await removeLiquidity({
                tokenId: selectedPosition.tokenId,
                liquidityPercentage: parseFloat(removePercentage),
            });

            addNotification({
                type: "success",
                title: "Success",
                message: `Removed ${removePercentage}% of liquidity`,
            });

            // Refresh positions
            const userPositions = await getUserPositions();
            setPositions(userPositions);
            setSelectedPosition(null);
        } catch (err) {
            console.error("Remove liquidity failed:", err);
            addNotification({
                type: "error",
                title: "Error",
                message: `Failed to remove liquidity: ${(err as Error).message}`,
            });
        }
    };

    const handleCollectFees = async (tokenId: bigint) => {
        try {
            await collectFees({ tokenId });

            addNotification({
                type: "success",
                title: "Success",
                message: "Fees collected successfully",
            });

            // Refresh positions
            const userPositions = await getUserPositions();
            setPositions(userPositions);
        } catch (err) {
            console.error("Collect fees failed:", err);
            addNotification({
                type: "error",
                title: "Error",
                message: `Failed to collect fees: ${(err as Error).message}`,
            });
        }
    };

    const canAddLiquidity = useMemo(() => {
        if (!isWalletConnected) return false;
        if (!tokenA || !tokenB) return false;
        if (!amountA || !amountB) return false;
        if (!poolExists) return false;
        if (parseFloat(amountA) === 0 || parseFloat(amountB) === 0) return false;

        const amount0BigInt = ethers.parseUnits(amountA, tokenA.decimals);
        const amount1BigInt = ethers.parseUnits(amountB, tokenB.decimals);

        if (amount0BigInt > balances.a.raw || amount1BigInt > balances.b.raw) {
            return false;
        }

        return true;
    }, [isWalletConnected, tokenA, tokenB, amountA, amountB, balances, poolExists]);

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            {/* Mode Selector */}
            <div className="flex gap-2">
                <Button
                    variant={mode === "add" ? "primary" : "outline"}
                    onClick={() => setMode("add")}
                    className="flex-1"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Liquidity
                </Button>
                <Button
                    variant={mode === "manage" ? "primary" : "outline"}
                    onClick={() => setMode("manage")}
                    className="flex-1"
                >
                    <Droplets className="w-4 h-4 mr-2" />
                    Manage Positions
                </Button>
            </div>

            {mode === "add" ? (
                <Card>
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">
                        Add Liquidity V3
                    </h2>

                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
                        <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                        <div className="text-xs text-blue-800">
                            <p className="font-semibold mb-1">V3 Concentrated Liquidity</p>
                            <p>
                                Your liquidity will be concentrated around the current price
                                (±10% range) for optimal capital efficiency. You'll receive an NFT
                                representing your position.
                            </p>
                        </div>
                    </div>

                    {!poolExists && tokenA && tokenB && (
                        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
                            <Info className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-yellow-800">
                                No V3 pool exists for this pair. Pool must be created before adding
                                liquidity.
                            </p>
                        </div>
                    )}

                    <div className="space-y-4">
                        {/* Token A Input */}
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-sm font-medium text-gray-700">
                                    Token A
                                </label>
                                {isWalletConnected && tokenA && (
                                    <span className="text-xs text-gray-500">
                                        Balance: {formatNumber(balances.a.formatted)}
                                    </span>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <Input
                                        type="number"
                                        placeholder="0.0"
                                        value={amountA}
                                        onChange={(e) => setAmountA(e.target.value)}
                                        disabled={loading}
                                    />
                                </div>
                                <Button
                                    variant="outline"
                                    onClick={() => setShowTokenASelector(true)}
                                    className="min-w-[120px]"
                                >
                                    {tokenA ? (
                                        <span className="flex items-center gap-1">
                                            {tokenA.symbol}
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

                        {/* Token B Input */}
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-sm font-medium text-gray-700">
                                    Token B
                                </label>
                                {isWalletConnected && tokenB && (
                                    <span className="text-xs text-gray-500">
                                        Balance: {formatNumber(balances.b.formatted)}
                                    </span>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <Input
                                        type="number"
                                        placeholder="0.0"
                                        value={amountB}
                                        onChange={(e) => setAmountB(e.target.value)}
                                        disabled={loading}
                                    />
                                </div>
                                <Button
                                    variant="outline"
                                    onClick={() => setShowTokenBSelector(true)}
                                    className="min-w-[120px]"
                                >
                                    {tokenB ? (
                                        <span className="flex items-center gap-1">
                                            {tokenB.symbol}
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

                        {/* Price Range Info */}
                        {tokenA && tokenB && poolExists && (
                            <div className="p-3 bg-gray-50 rounded-lg">
                                <div className="flex items-center gap-2 mb-2">
                                    <TrendingUp className="w-4 h-4 text-gray-600" />
                                    <span className="text-sm font-medium text-gray-700">
                                        Price Range
                                    </span>
                                </div>
                                <p className="text-xs text-gray-600">
                                    Full range (±10% from current price)
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                    Fee Tier: 0.05%
                                </p>
                            </div>
                        )}
                    </div>

                    {error && (
                        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-sm text-red-800">{error}</p>
                        </div>
                    )}

                    <div className="mt-6">
                        {!isWalletConnected ? (
                            <Button fullWidth size="lg" disabled>
                                Connect Wallet
                            </Button>
                        ) : !tokenA || !tokenB ? (
                            <Button fullWidth size="lg" disabled>
                                Select Tokens
                            </Button>
                        ) : !poolExists ? (
                            <Button fullWidth size="lg" disabled>
                                Pool Does Not Exist
                            </Button>
                        ) : !canAddLiquidity ? (
                            <Button fullWidth size="lg" disabled>
                                {!amountA || !amountB
                                    ? "Enter Amounts"
                                    : "Insufficient Balance"}
                            </Button>
                        ) : (
                            <div className="relative">
                                <Button
                                    fullWidth
                                    size="lg"
                                    onClick={handleAddLiquidity}
                                    disabled={loading}
                                >
                                    {loading ? "Adding Liquidity..." : "Add Liquidity"}
                                </Button>
                                {loading && (
                                    <div className="absolute inset-0 grid place-items-center bg-white/60 rounded-lg">
                                        <Loader size={28} label="Preparing wallet..." />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </Card>
            ) : (
                <div className="space-y-4">
                    <Card>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">
                            Your Positions
                        </h2>
                        {positionsLoading && (
                            <div className="mb-4">
                                <Loader size={18} label="Refreshing..." />
                            </div>
                        )}

                        {!isWalletConnected ? (
                            <div className="text-center py-8">
                                <p className="text-gray-600">Connect wallet to view positions</p>
                            </div>
                        ) : positionsLoading ? (
                            <div className="text-center py-12">
                                <Loader size={28} label="Loading positions..." />
                            </div>
                        ) : positions.length === 0 ? (
                            <div className="text-center py-8">
                                <Droplets className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                                <p className="text-gray-600">No liquidity positions found</p>
                                <p className="text-sm text-gray-500 mt-1">
                                    Add liquidity to create your first position
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {positions.map((position, idx) => (
                                    <div
                                        key={idx}
                                        className="p-4 border border-gray-200 rounded-lg hover:border-blue-500 transition-colors"
                                    >
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <p className="font-semibold text-gray-900">
                                                    Position #{position.tokenId.toString()}
                                                </p>
                                                <p className="text-sm text-gray-600">
                                                    Fee: {position.fee / 10000}%
                                                </p>
                                            </div>
                                            <Badge variant="success">Active</Badge>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                                            <div>
                                                <p className="text-gray-600">Liquidity</p>
                                                <p className="font-medium">
                                                    {position.liquidity.toString()}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-gray-600">Tick Range</p>
                                                <p className="font-medium">
                                                    {position.tickLower} to {position.tickUpper}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex gap-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => setSelectedPosition(position)}
                                                className="flex-1"
                                            >
                                                <Minus className="w-4 h-4 mr-1" />
                                                Remove
                                            </Button>
                                            <div className="relative flex-1">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleCollectFees(position.tokenId)}
                                                    disabled={loading}
                                                    className="w-full"
                                                >
                                                    Collect Fees
                                                </Button>
                                                {loading && (
                                                    <div className="absolute inset-0 grid place-items-center bg-white/60 rounded-lg">
                                                        <Loader size={20} label="Collecting..." />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>

                    {/* Remove Liquidity Modal */}
                    {selectedPosition && (
                        <Card>
                            <h3 className="text-lg font-bold text-gray-900 mb-4">
                                Remove Liquidity
                            </h3>
                            <p className="text-sm text-gray-600 mb-4">
                                Position #{selectedPosition.tokenId.toString()}
                            </p>

                            <div className="mb-4">
                                <label className="text-sm font-medium text-gray-700 mb-2 block">
                                    Amount to Remove: {removePercentage}%
                                </label>
                                <input
                                    type="range"
                                    min="1"
                                    max="100"
                                    value={removePercentage}
                                    onChange={(e) => setRemovePercentage(e.target.value)}
                                    className="w-full"
                                />
                                <div className="flex justify-between text-xs text-gray-500 mt-1">
                                    <span>1%</span>
                                    <span>25%</span>
                                    <span>50%</span>
                                    <span>75%</span>
                                    <span>100%</span>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => setSelectedPosition(null)}
                                    className="flex-1"
                                >
                                    Cancel
                                </Button>
                                <div className="relative flex-1">
                                    <Button
                                        onClick={handleRemoveLiquidity}
                                        disabled={loading}
                                        className="w-full"
                                    >
                                        {loading ? "Removing..." : "Remove Liquidity"}
                                    </Button>
                                    {loading && (
                                        <div className="absolute inset-0 grid place-items-center bg-white/60 rounded-lg">
                                            <Loader size={24} label="Confirm in wallet" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </Card>
                    )}
                </div>
            )}

            {/* Token Selectors */}
            <TokenSelector
                isOpen={showTokenASelector}
                onClose={() => setShowTokenASelector(false)}
                onSelect={(token) => {
                    setTokenA(token);
                    setShowTokenASelector(false);
                }}
                excludeToken={tokenB}
            />

            <TokenSelector
                isOpen={showTokenBSelector}
                onClose={() => setShowTokenBSelector(false)}
                onSelect={(token) => {
                    setTokenB(token);
                    setShowTokenBSelector(false);
                }}
                excludeToken={tokenA}
            />
        </div>
    );
}
