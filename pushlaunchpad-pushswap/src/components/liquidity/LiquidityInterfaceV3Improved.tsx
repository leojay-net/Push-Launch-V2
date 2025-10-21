"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { ethers } from "ethers";
import { Plus, Minus, Info, Droplets, TrendingUp, ChevronDown, Settings } from "lucide-react";
import Card from "../ui/Card";
import Input from "../ui/Input";
import Button from "../ui/Button";
import Badge from "../ui/Badge";
import TokenSelector from "../dex/TokenSelector";
import FeeTierSelector from "./FeeTierSelector";
import PriceChart from "./PriceChart";
import { useNotification } from "../ui/Notification";
import { COMMON_TOKENS, CHAIN_CONFIG, type Token } from "@/lib/contracts";
import { formatNumber } from "@/lib/utils";
import { useLiquidityV3 } from "@/hooks/useLiquidityV3";
import { ERC20ABI } from "@/abis";
import Loader from "@/components/ui/Loader";

const rpcProvider = new ethers.JsonRpcProvider(CHAIN_CONFIG.rpcUrl);

type LiquidityMode = "new" | "positions";
type PriceRangeMode = "full" | "custom";

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

    // Mode & Step State
    const [mode, setMode] = useState<LiquidityMode>("new");
    const [currentStep, setCurrentStep] = useState<number>(1);

    // Token Selection
    const [tokenA, setTokenA] = useState<Token | null>(null);
    const [tokenB, setTokenB] = useState<Token | null>(null);
    const [showTokenASelector, setShowTokenASelector] = useState(false);
    const [showTokenBSelector, setShowTokenBSelector] = useState(false);

    // Fee Tier
    const [feeTier, setFeeTier] = useState<number>(500); // 0.05% default

    // Price Range
    const [priceRangeMode, setPriceRangeMode] = useState<PriceRangeMode>("full");
    const [minPrice, setMinPrice] = useState("");
    const [maxPrice, setMaxPrice] = useState("");

    // Amounts
    const [amountA, setAmountA] = useState("");
    const [amountB, setAmountB] = useState("");

    // Balances
    const [balances, setBalances] = useState<{ a: TokenBalance; b: TokenBalance }>({
        a: { raw: BigInt(0), formatted: "0" },
        b: { raw: BigInt(0), formatted: "0" },
    });

    // Positions
    const [positions, setPositions] = useState<any[]>([]);
    const [positionsLoading, setPositionsLoading] = useState<boolean>(false);
    const [selectedPosition, setSelectedPosition] = useState<any | null>(null);
    const [removePercentage, setRemovePercentage] = useState("100");
    const [isAdding, setIsAdding] = useState<boolean>(false);

    // Pool State
    const [poolExists, setPoolExists] = useState(true);
    const [currentPrice, setCurrentPrice] = useState<string | null>(null);

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
        if (!isWalletConnected) {
            console.log("⚠️ Wallet not connected, skipping position load");
            return;
        }

        const loadPositions = async () => {
            try {
                console.log("🔄 Loading user positions...");
                setPositionsLoading(true);
                const userPositions = await getUserPositions();
                console.log("📦 Received positions:", userPositions.length);
                setPositions(userPositions);
            } catch (err) {
                console.error("❌ Error loading positions:", err);
            } finally {
                setPositionsLoading(false);
            }
        };

        loadPositions();

        const onPositionsUpdated = () => {
            loadPositions();
        };
        window.addEventListener('v3-positions-updated', onPositionsUpdated);
        return () => {
            window.removeEventListener('v3-positions-updated', onPositionsUpdated);
        };
    }, [isWalletConnected, getUserPositions, loading]);

    // Check if pool exists and get current price
    useEffect(() => {
        if (!tokenA || !tokenB) return;

        const checkPool = async () => {
            try {
                const poolInfo = await getPoolInfo(tokenA, tokenB, feeTier);
                setPoolExists(poolInfo.exists);
                if (poolInfo.exists && poolInfo.sqrtPriceX96) {
                    if ((poolInfo as any).humanPrice && isFinite((poolInfo as any).humanPrice)) {
                        setCurrentPrice(((poolInfo as any).humanPrice as number).toFixed(6));
                    } else {
                        setCurrentPrice(null);
                    }
                }
            } catch (err) {
                console.error("Error checking pool:", err);
                setPoolExists(false);
            }
        };

        checkPool();
    }, [tokenA, tokenB, feeTier, getPoolInfo]);

    // Auto-calculate Token B amount when Token A changes (for existing pools)
    useEffect(() => {
        if (!poolExists || !currentPrice || !amountA || amountA === "0" || !tokenA || !tokenB) {
            return;
        }

        try {
            const price = parseFloat(currentPrice);
            const amount = parseFloat(amountA);

            if (!isNaN(price) && !isNaN(amount) && price > 0) {
                // Calculate amount B based on current pool price
                // For symmetric range around current price, ratio should match price
                const calculatedAmountB = (amount * price).toFixed(Math.min(tokenB.decimals, 6));
                console.log(`💡 Pool exists - Auto-calculated ${tokenB.symbol}: ${amountA} ${tokenA.symbol} × ${price} = ${calculatedAmountB} ${tokenB.symbol}`);

                // Update amountB (but allow user to override by typing)
                if (!document.activeElement || (document.activeElement as HTMLElement).id !== 'amountB-input') {
                    setAmountB(calculatedAmountB);
                }
            }
        } catch (err) {
            console.error("Error auto-calculating amount B:", err);
        }
    }, [amountA, currentPrice, poolExists, tokenA, tokenB]);

    // Auto-calculate Token A amount when Token B changes (for existing pools)
    useEffect(() => {
        if (!poolExists || !currentPrice || !amountB || amountB === "0" || !tokenA || !tokenB) {
            return;
        }

        try {
            const price = parseFloat(currentPrice);
            const amount = parseFloat(amountB);

            if (!isNaN(price) && !isNaN(amount) && price > 0) {
                // Calculate amount A based on current pool price
                const calculatedAmountA = (amount / price).toFixed(Math.min(tokenA.decimals, 6));
                console.log(`💡 Pool exists - Auto-calculated ${tokenA.symbol}: ${amountB} ${tokenB.symbol} ÷ ${price} = ${calculatedAmountA} ${tokenA.symbol}`);

                // Update amountA (but allow user to override by typing)
                if (!document.activeElement || (document.activeElement as HTMLElement).id !== 'amountA-input') {
                    setAmountA(calculatedAmountA);
                }
            }
        } catch (err) {
            console.error("Error auto-calculating amount A:", err);
        }
    }, [amountB, currentPrice, poolExists, tokenA, tokenB]);

    const handleAddLiquidity = async () => {
        if (!tokenA || !tokenB || !amountA || !amountB) return;

        try {
            setIsAdding(true);
            await mintPosition({
                token0: tokenA,
                token1: tokenB,
                amount0Desired: amountA,
                amount1Desired: amountB,
                feeTier,
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
            setMode("positions");
        } catch (err) {
            console.error("Add liquidity failed:", err);
            addNotification({
                type: "error",
                title: "Error",
                message: `Failed to add liquidity: ${(err as Error).message}`,
            });
        } finally {
            setIsAdding(false);
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

    const canProceedToStep2 = useMemo(() => {
        // Can proceed as long as both tokens are selected and they're different
        if (!tokenA || !tokenB) {
            console.log('❌ Cannot proceed: Missing tokens', { tokenA: tokenA?.symbol, tokenB: tokenB?.symbol });
            return false;
        }
        // Prevent same token pair
        if (tokenA.address.toLowerCase() === tokenB.address.toLowerCase()) {
            console.log('❌ Cannot proceed: Same token selected');
            return false;
        }
        console.log('✅ Can proceed to step 2', { tokenA: tokenA.symbol, tokenB: tokenB.symbol });
        return true;
    }, [tokenA, tokenB]);

    const canAddLiquidity = useMemo(() => {
        if (!isWalletConnected) return false;
        if (!tokenA || !tokenB) return false;
        if (!amountA || !amountB) return false;
        // Pool can be created if it doesn't exist
        if (parseFloat(amountA) === 0 || parseFloat(amountB) === 0) return false;

        try {
            const amount0BigInt = ethers.parseUnits(amountA, tokenA.decimals);
            const amount1BigInt = ethers.parseUnits(amountB, tokenB.decimals);

            if (amount0BigInt > balances.a.raw || amount1BigInt > balances.b.raw) {
                return false;
            }
        } catch {
            return false;
        }

        return true;
    }, [isWalletConnected, tokenA, tokenB, amountA, amountB, balances, poolExists]);

    return (
        <div className="max-w-2xl mx-auto space-y-6 relative">
            {isAdding && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-sm" />
                    <div className="relative z-10">
                        <Loader size={64} />
                    </div>
                </div>
            )}
            {/* Mode Tabs */}
            <div className="flex gap-2">
                <Button
                    variant={mode === "new" ? "primary" : "outline"}
                    onClick={() => {
                        setMode("new");
                        setCurrentStep(1);
                    }}
                    className="flex-1"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    New Position
                </Button>
                <Button
                    variant={mode === "positions" ? "primary" : "outline"}
                    onClick={() => setMode("positions")}
                    className="flex-1"
                >
                    <Droplets className="w-4 h-4 mr-2" />
                    Your Positions
                </Button>
            </div>

            {mode === "new" ? (
                <Card>
                    {/* Steps Indicator */}
                    <div className="mb-6">
                        <div className="flex items-center">
                            <div className="flex items-center">
                                <div className={`
                                    w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                                    ${currentStep >= 1 ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'}
                                `}>
                                    1
                                </div>
                                <div className="ml-2">
                                    <div className="text-sm font-medium">Step 1</div>
                                    <div className="text-xs text-gray-600">Select token pair and fees</div>
                                </div>
                            </div>

                            <div className={`flex-1 h-0.5 mx-4 ${currentStep >= 2 ? 'bg-blue-500' : 'bg-gray-200'}`} />

                            <div className="flex items-center">
                                <div className={`
                                    w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                                    ${currentStep >= 2 ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'}
                                `}>
                                    2
                                </div>
                                <div className="ml-2">
                                    <div className="text-sm font-medium">Step 2</div>
                                    <div className="text-xs text-gray-600">Set price range and deposit amounts</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {currentStep === 1 ? (
                        <>
                            <h2 className="text-2xl font-bold text-gray-900 mb-6">
                                Select Pair
                            </h2>

                            {/* Token Selection */}
                            <div className="space-y-4 mb-6">
                                <div>
                                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                                        Token Pair
                                    </label>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            onClick={() => setShowTokenASelector(true)}
                                            className="flex-1 justify-between"
                                        >
                                            {tokenA ? (
                                                <span>{tokenA.symbol}</span>
                                            ) : (
                                                <span className="text-gray-500">Select</span>
                                            )}
                                            <ChevronDown className="w-4 h-4" />
                                        </Button>
                                        <span className="text-gray-400 self-center">/</span>
                                        <Button
                                            variant="outline"
                                            onClick={() => setShowTokenBSelector(true)}
                                            className="flex-1 justify-between"
                                        >
                                            {tokenB ? (
                                                <span>{tokenB.symbol}</span>
                                            ) : (
                                                <span className="text-gray-500">Select</span>
                                            )}
                                            <ChevronDown className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {/* Fee Tier Selection */}
                            {tokenA && tokenB && (
                                <div className="mb-6">
                                    <FeeTierSelector
                                        selectedTier={feeTier}
                                        onSelectTier={setFeeTier}
                                    />
                                </div>
                            )}

                            {/* Pool Status */}
                            {tokenA && tokenB && !poolExists && (
                                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                    <div className="flex items-start gap-2">
                                        <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                                        <div>
                                            <p className="text-sm font-medium text-blue-900">You are creating a new pool</p>
                                            <p className="text-xs text-blue-800 mt-1">
                                                This pool doesn't exist yet. You'll be the first liquidity provider!
                                                The pool will be initialized when you add liquidity.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {tokenA && tokenB && poolExists && (
                                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                        <p className="text-sm text-green-800">
                                            Pool exists • Add liquidity to earn fees
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Continue Button */}
                            <Button
                                fullWidth
                                size="lg"
                                onClick={() => setCurrentStep(2)}
                                disabled={!canProceedToStep2}
                            >
                                {!tokenA || !tokenB
                                    ? "Select Tokens"
                                    : tokenA.address.toLowerCase() === tokenB.address.toLowerCase()
                                        ? "Select Different Tokens"
                                        : !poolExists
                                            ? "Continue (Create New Pool)"
                                            : "Continue"}
                            </Button>
                        </>
                    ) : (
                        <>
                            {/* Step 2: Set Price Range & Deposit */}
                            <div className="mb-6">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentStep(1)}
                                    className="mb-4"
                                >
                                    ← Back
                                </Button>

                                {tokenA && tokenB && (
                                    <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                                        <span className="font-medium">{tokenA.symbol} / {tokenB.symbol}</span>
                                        <Badge variant="info">{feeTier / 10000}%</Badge>
                                        {poolExists && (
                                            <Badge variant="success">Pool exists</Badge>
                                        )}
                                    </div>
                                )}
                            </div>

                            <h3 className="text-lg font-bold text-gray-900 mb-4">
                                Set Price Range
                            </h3>

                            {/* Price Chart */}
                            <div className="mb-6">
                                <PriceChart
                                    currentPrice={currentPrice}
                                    minPrice={priceRangeMode === "custom" ? minPrice : undefined}
                                    maxPrice={priceRangeMode === "custom" ? maxPrice : undefined}
                                    token0Symbol={tokenA?.symbol}
                                    token1Symbol={tokenB?.symbol}
                                />
                            </div>

                            {/* Price Range Mode Selection */}
                            <div className="mb-6">
                                <div className="flex gap-2 mb-4">
                                    <Button
                                        variant={priceRangeMode === "full" ? "primary" : "outline"}
                                        onClick={() => setPriceRangeMode("full")}
                                        className="flex-1"
                                    >
                                        Full Range
                                    </Button>
                                    <Button
                                        variant={priceRangeMode === "custom" ? "primary" : "outline"}
                                        onClick={() => setPriceRangeMode("custom")}
                                        className="flex-1"
                                    >
                                        Custom Range
                                    </Button>
                                </div>

                                {priceRangeMode === "full" ? (
                                    <div className="p-4 bg-gray-50 rounded-lg">
                                        <p className="text-sm text-gray-600 mb-2">
                                            Full range allows you to concentrate your liquidity within specific price bounds, enhancing capital
                                            efficiency but requiring more active management.
                                        </p>
                                        {currentPrice && (
                                            <p className="text-xs text-gray-500">
                                                Current price: {currentPrice} {tokenB?.symbol} per {tokenA?.symbol}
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-sm text-gray-700 mb-1 block">Min price</label>
                                            <Input
                                                type="number"
                                                placeholder="0.0"
                                                value={minPrice}
                                                onChange={(e) => setMinPrice(e.target.value)}
                                            />
                                            <p className="text-xs text-gray-500 mt-1">
                                                {tokenB?.symbol} per {tokenA?.symbol}
                                            </p>
                                        </div>
                                        <div>
                                            <label className="text-sm text-gray-700 mb-1 block">Max price</label>
                                            <Input
                                                type="number"
                                                placeholder="∞"
                                                value={maxPrice}
                                                onChange={(e) => setMaxPrice(e.target.value)}
                                            />
                                            <p className="text-xs text-gray-500 mt-1">
                                                {tokenB?.symbol} per {tokenA?.symbol}
                                            </p>
                                        </div>
                                        {currentPrice && (
                                            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                                <p className="text-xs text-blue-800">
                                                    Market price: {currentPrice} {tokenB?.symbol} per {tokenA?.symbol}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <h3 className="text-lg font-bold text-gray-900 mb-4">
                                Deposit Amounts
                            </h3>

                            {/* Deposit Amounts */}
                            <div className="space-y-4 mb-6">
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-sm font-medium text-gray-700">
                                            {tokenA?.symbol}
                                        </label>
                                        {isWalletConnected && tokenA && (
                                            <span className="text-xs text-gray-500">
                                                Balance: {formatNumber(balances.a.formatted)}
                                            </span>
                                        )}
                                    </div>
                                    <Input
                                        id="amountA-input"
                                        type="number"
                                        placeholder="0.0"
                                        value={amountA}
                                        onChange={(e) => setAmountA(e.target.value)}
                                        disabled={loading}
                                    />
                                </div>

                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-sm font-medium text-gray-700">
                                            {tokenB?.symbol}
                                        </label>
                                        {isWalletConnected && tokenB && (
                                            <span className="text-xs text-gray-500">
                                                Balance: {formatNumber(balances.b.formatted)}
                                            </span>
                                        )}
                                    </div>
                                    <Input
                                        id="amountB-input"
                                        type="number"
                                        placeholder="0.0"
                                        value={amountB}
                                        onChange={(e) => setAmountB(e.target.value)}
                                        disabled={loading}
                                    />
                                    {poolExists && currentPrice && amountA && parseFloat(amountA) > 0 && (
                                        <p className="text-xs text-gray-500 mt-1">
                                            ≈ {amountB} {tokenB?.symbol} at current price ({currentPrice})
                                        </p>
                                    )}
                                </div>
                            </div>

                            {error && (
                                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                                    <p className="text-sm text-red-800">{error}</p>
                                </div>
                            )}

                            {/* Add Liquidity Button */}
                            {!isWalletConnected ? (
                                <Button fullWidth size="lg" disabled>
                                    Connect Wallet
                                </Button>
                            ) : !canAddLiquidity ? (
                                <Button fullWidth size="lg" disabled>
                                    {!amountA || !amountB
                                        ? "Enter Amounts"
                                        : "Insufficient Balance"}
                                </Button>
                            ) : (
                                <Button
                                    fullWidth
                                    size="lg"
                                    onClick={handleAddLiquidity}
                                    disabled={loading}
                                >
                                    {loading
                                        ? "Adding Liquidity..."
                                        : !poolExists
                                            ? "Create Pool & Add Liquidity"
                                            : "Add Liquidity"}
                                </Button>
                            )}
                        </>
                    )}
                </Card>
            ) : (
                /* Your Positions View */
                <div className="space-y-4">
                    <Card>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">
                            Your Positions
                        </h2>
                        {/* Only show the small refresher when not in full-page loading */}
                        {!positionsLoading && loading && (
                            <div className="mb-4">
                                <Loader size={18} label="Refreshing..." />
                            </div>
                        )}

                        {!isWalletConnected ? (
                            <div className="text-center py-12">
                                <Droplets className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                <p className="text-gray-600 mb-2">Connect wallet to view positions</p>
                                <p className="text-sm text-gray-500">
                                    Your liquidity positions will appear here
                                </p>
                            </div>
                        ) : positionsLoading ? (
                            <div className="text-center py-12">
                                <Loader size={28} label="Loading positions..." />
                            </div>
                        ) : positions.length === 0 ? (
                            <div className="text-center py-12">
                                <Droplets className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                <p className="text-gray-600 mb-2">No liquidity positions found</p>
                                <p className="text-sm text-gray-500 mb-6">
                                    Add liquidity to create your first position
                                </p>
                                <Button onClick={() => setMode("new")}>
                                    <Plus className="w-4 h-4 mr-2" />
                                    New Position
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {positions.map((position, idx) => (
                                    <div
                                        key={idx}
                                        className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-300 transition-all"
                                    >
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <p className="font-bold text-lg">
                                                    Position #{position.tokenId.toString()}
                                                </p>
                                                <p className="text-sm text-gray-600">
                                                    Fee: {position.fee / 10000}%
                                                </p>
                                            </div>
                                            <Badge variant="success">In Range</Badge>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                                            <div>
                                                <p className="text-gray-600 text-xs">Liquidity</p>
                                                <p className="font-medium">{position.liquidity.toString()}</p>
                                            </div>
                                            <div>
                                                <p className="text-gray-600 text-xs">Price Range</p>
                                                <p className="font-medium text-xs">
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
                            <h3 className="text-xl font-bold text-gray-900 mb-4">
                                Remove Liquidity
                            </h3>
                            <p className="text-sm text-gray-600 mb-4">
                                Position #{selectedPosition.tokenId.toString()}
                            </p>

                            <div className="mb-6">
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-sm font-medium text-gray-700">
                                        Amount to Remove
                                    </label>
                                    <span className="text-2xl font-bold text-blue-600">
                                        {removePercentage}%
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="1"
                                    max="100"
                                    value={removePercentage}
                                    onChange={(e) => setRemovePercentage(e.target.value)}
                                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                />
                                <div className="flex justify-between text-xs text-gray-500 mt-2">
                                    <button onClick={() => setRemovePercentage("25")} className="hover:text-blue-600">25%</button>
                                    <button onClick={() => setRemovePercentage("50")} className="hover:text-blue-600">50%</button>
                                    <button onClick={() => setRemovePercentage("75")} className="hover:text-blue-600">75%</button>
                                    <button onClick={() => setRemovePercentage("100")} className="hover:text-blue-600">Max</button>
                                </div>
                            </div>

                            <div className="flex gap-3">
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
