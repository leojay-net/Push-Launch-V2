"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Minus, Info } from "lucide-react";
import { usePushWalletContext } from "@pushchain/ui-kit";
import Card from "../ui/Card";
import Input from "../ui/Input";
import Button from "../ui/Button";
import Badge from "../ui/Badge";
import TokenSelector from "../dex/TokenSelector";
import { useNotification } from "../ui/Notification";
import { COMMON_TOKENS, type Token } from "@/lib/contracts";
import { formatNumber } from "@/lib/utils";
import { useDexRouter } from "@/hooks/useDexRouter";

type LiquidityMode = "add" | "remove";

export default function LiquidityInterface() {
  const { connectionStatus } = usePushWalletContext();
  const { addNotification } = useNotification();

  const [mode, setMode] = useState<LiquidityMode>("add");
  const [tokenA, setTokenA] = useState<Token | null>(COMMON_TOKENS[0] || null);
  const [tokenB, setTokenB] = useState<Token | null>(null);
  const [amountA, setAmountA] = useState("");
  const [amountB, setAmountB] = useState("");
  const [lpTokenAmount, setLpTokenAmount] = useState("");
  const [showTokenSelector, setShowTokenSelector] = useState<"a" | "b" | null>(null);

  const { addLiquidity, removeLiquidity, getPairInfo, getTokenBalance, isWalletConnected, loading, error } = useDexRouter();
  const [autoQuote, setAutoQuote] = useState(false);
  const [reserves, setReserves] = useState<{ a: number; b: number } | null>(null);
  const [balanceA, setBalanceA] = useState<string>("0");
  const [balanceB, setBalanceB] = useState<string>("0");

  const stepFromDecimals = (decimals: number | undefined) => {
    const d = Math.max(0, Math.min(18, decimals ?? 18));
    return d === 0 ? "1" : `0.${"0".repeat(d - 1)}1`;
  };

  const clampDecimals = (val: string, decimals: number | undefined) => {
    if (!val || !val.includes(".")) return val;
    const d = Math.max(0, Math.min(18, decimals ?? 18));
    const [i, f] = val.split(".");
    return f.length > d ? `${i}.${f.slice(0, d)}` : val;
  };

  // Derived pool state
  const [lpBalance, setLpBalance] = useState<string>("0");
  const [totalSupply, setTotalSupply] = useState<string>("0");
  const [pooledTokenA, setPooledTokenA] = useState<string>("0");
  const [pooledTokenB, setPooledTokenB] = useState<string>("0");
  const poolShare = useMemo(() => {
    const ts = parseFloat(totalSupply || "0");
    const lb = parseFloat(lpBalance || "0");
    if (ts > 0 && lb >= 0) return ((lb / ts) * 100).toFixed(2);
    return "0.00";
  }, [totalSupply, lpBalance]);

  // Load pair reserves when tokens change, to know whether to auto-quote
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setReserves(null);
      setAutoQuote(false);
      if (!tokenA || !tokenB) return;
      try {
        const info = await getPairInfo(tokenA, tokenB);
        if (cancelled) return;
        if (info.exists && info.reserveA && info.reserveB) {
          const a = parseFloat(info.reserveAFormatted || "0");
          const b = parseFloat(info.reserveBFormatted || "0");
          console.log(`[Liquidity] Pair ${tokenA.symbol}/${tokenB.symbol} - Reserve A: ${a}, Reserve B: ${b}`);
          if (a > 0 && b > 0) {
            setReserves({ a, b });
            setAutoQuote(true);
            // If user already entered amountA, refresh amountB with quote
            if (amountA) {
              const q = (parseFloat(amountA || "0") * b) / a;
              console.log(`[Liquidity] Auto-quote: ${amountA} ${tokenA.symbol} -> ${q} ${tokenB.symbol}`);
              setAmountB(q ? q.toFixed(6) : "");
            }
          }
        }
      } catch {
        // ignore
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [tokenA, tokenB, getPairInfo, amountA]);

  const handleAmountAChange = (value: string) => {
    const v = clampDecimals(value, tokenA?.decimals);
    setAmountA(v);
    if (!value || isNaN(parseFloat(value))) {
      setAmountB("");
      return;
    }
    if (autoQuote && reserves && tokenA && tokenB) {
      const q = (parseFloat(v || "0") * reserves.b) / reserves.a;
      console.log(`[Liquidity] Quote ${v} ${tokenA.symbol} -> ${q} ${tokenB.symbol} (reserves: ${reserves.a}:${reserves.b})`);
      // Use appropriate precision based on token B decimals
      const decimals = tokenB.decimals ?? 18;
      setAmountB(q ? q.toFixed(Math.min(decimals, 8)) : "");
    }
  };

  const handleAmountBChange = (value: string) => {
    const v = clampDecimals(value, tokenB?.decimals);
    setAmountB(v);
  };

  const handleAddLiquidity = async () => {
    if (connectionStatus !== "connected" || !tokenA || !tokenB || !amountA || !amountB) return;

    try {
      await addLiquidity({
        tokenA,
        tokenB,
        amountADesired: amountA,
        amountBDesired: amountB,
        slippageBps: 50, // 0.5%
        deadlineMinutes: 20,
      });
      setAmountA("");
      setAmountB("");
      addNotification({
        type: 'success',
        title: 'Liquidity Added',
        message: `Successfully added ${amountA} ${tokenA.symbol} and ${amountB} ${tokenB.symbol} to the pool`,
        duration: 5000,
      });
    } catch (e) {
      const error = e as Error;
      addNotification({
        type: 'error',
        title: 'Add Liquidity Failed',
        message: error?.message || 'An error occurred while adding liquidity',
        duration: 7000,
      });
    }
  };

  const handleRemoveLiquidity = async () => {
    if (connectionStatus !== "connected" || !tokenA || !tokenB || !lpTokenAmount) return;
    try {
      await removeLiquidity({
        tokenA,
        tokenB,
        liquidityAmount: lpTokenAmount,
        slippageBps: 50,
        deadlineMinutes: 20,
      });
      setLpTokenAmount("");
      addNotification({
        type: 'success',
        title: 'Liquidity Removed',
        message: `Successfully removed ${lpTokenAmount} LP tokens from ${tokenA.symbol}/${tokenB.symbol} pool`,
        duration: 5000,
      });
    } catch (e) {
      const error = e as Error;
      addNotification({
        type: 'error',
        title: 'Remove Liquidity Failed',
        message: error?.message || 'An error occurred while removing liquidity',
        duration: 7000,
      });
    }
  };

  const selectToken = (token: Token) => {
    if (showTokenSelector === "a") {
      setTokenA(token);
    } else if (showTokenSelector === "b") {
      setTokenB(token);
    }
    setShowTokenSelector(null);
  };

  // Load wallet balances for selected tokens
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!isWalletConnected) {
        setBalanceA("0");
        setBalanceB("0");
        return;
      }
      try {
        const [ba, bb] = await Promise.all([
          tokenA ? getTokenBalance(tokenA) : Promise.resolve({ formatted: "0", raw: BigInt(0) }),
          tokenB ? getTokenBalance(tokenB) : Promise.resolve({ formatted: "0", raw: BigInt(0) }),
        ]);
        if (!cancelled) {
          setBalanceA(ba.formatted);
          setBalanceB(bb.formatted);
        }
      } catch {
        if (!cancelled) {
          setBalanceA("0");
          setBalanceB("0");
        }
      }
    };
    run();
    return () => { cancelled = true; };
  }, [tokenA, tokenB, isWalletConnected, getTokenBalance]);

  // Recompute LP and pooled amounts whenever pair info changes
  useEffect(() => {
    if (!tokenA || !tokenB || !reserves) {
      setLpBalance("0");
      setTotalSupply("0");
      setPooledTokenA("0");
      setPooledTokenB("0");
      return;
    }
    const reload = async () => {
      try {
        const info = await getPairInfo(tokenA, tokenB);
        const ts = parseFloat(info.totalSupplyFormatted || "0");
        const lb = parseFloat(info.lpBalanceFormatted || "0");
        setTotalSupply(ts.toString());
        setLpBalance(lb.toString());
        if (ts > 0 && lb >= 0) {
          const pooledA = (reserves.a * lb) / ts;
          const pooledB = (reserves.b * lb) / ts;
          setPooledTokenA(pooledA.toString());
          setPooledTokenB(pooledB.toString());
        } else {
          setPooledTokenA("0");
          setPooledTokenB("0");
        }
      } catch {
        setTotalSupply("0");
        setLpBalance("0");
        setPooledTokenA("0");
        setPooledTokenB("0");
      }
    };
    reload();
  }, [tokenA, tokenB, reserves, getPairInfo]);

  return (
    <>
      <Card variant="elevated" padding="lg">
        {/* Mode Toggle */}
        <div className="flex gap-2 mb-6 p-1 bg-gray-100 rounded-lg">
          <button
            onClick={() => setMode("add")}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${mode === "add"
              ? "bg-white text-emerald-600 shadow-sm"
              : "text-gray-600 hover:text-gray-900"
              }`}
          >
            <Plus className="h-4 w-4" />
            Add Liquidity
          </button>
          <button
            onClick={() => setMode("remove")}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${mode === "remove"
              ? "bg-white text-red-600 shadow-sm"
              : "text-gray-600 hover:text-gray-900"
              }`}
          >
            <Minus className="h-4 w-4" />
            Remove Liquidity
          </button>
        </div>

        {mode === "add" ? (
          <>
            {/* Token A Input */}
            <div className="space-y-2 mb-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Token A</span>
                {tokenA && connectionStatus === "connected" && (
                  <span className="text-gray-500">Balance: {formatNumber(balanceA)}</span>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="0.0"
                  value={amountA}
                  onChange={(e) => handleAmountAChange(e.target.value)}
                  className="flex-1 text-2xl"
                  inputSize="lg"
                  step={stepFromDecimals(tokenA?.decimals)}
                />
                <Button
                  variant="outline"
                  onClick={() => setShowTokenSelector("a")}
                  className="min-w-[140px]"
                >
                  {tokenA ? tokenA.symbol : "Select Token"}
                </Button>
                {tokenA && (
                  <Button variant="ghost" onClick={() => setAmountA(balanceA)}>MAX</Button>
                )}
              </div>
            </div>

            {/* Plus Icon */}
            <div className="flex justify-center my-4">
              <div className="p-2 rounded-lg bg-gray-100">
                <Plus className="h-5 w-5 text-gray-600" />
              </div>
            </div>

            {/* Token B Input */}
            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Token B</span>
                {tokenB && connectionStatus === "connected" && (
                  <span className="text-gray-500">Balance: {formatNumber(balanceB)}</span>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="0.0"
                  value={amountB}
                  onChange={(e) => handleAmountBChange(e.target.value)}
                  className="flex-1 text-2xl"
                  inputSize="lg"
                  disabled={autoQuote}
                  step={stepFromDecimals(tokenB?.decimals)}
                />
                <Button
                  variant="outline"
                  onClick={() => setShowTokenSelector("b")}
                  className="min-w-[140px]"
                >
                  {tokenB ? tokenB.symbol : "Select Token"}
                </Button>
                {tokenB && !autoQuote && (
                  <Button variant="ghost" onClick={() => setAmountB(balanceB)}>MAX</Button>
                )}
              </div>
            </div>

            {/* Pool Status Info */}
            {tokenA && tokenB && autoQuote && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-blue-700">
                  <Info className="h-4 w-4" />
                  <span>Adding to existing pool • Ratio auto-calculated</span>
                </div>
              </div>
            )}
            {tokenA && tokenB && !autoQuote && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-amber-700">
                  <Info className="h-4 w-4" />
                  <span>Creating new pool • You set the initial price</span>
                </div>
              </div>
            )}

            {/* Pool Info */}
            {amountA && amountB && tokenA && tokenB && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Prices</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">
                    1 {tokenA.symbol} =
                  </span>
                  <span className="font-medium">
                    {(parseFloat(amountB) / parseFloat(amountA)).toFixed(6)} {tokenB.symbol}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">
                    1 {tokenB.symbol} =
                  </span>
                  <span className="font-medium">
                    {(parseFloat(amountA) / parseFloat(amountB)).toFixed(6)} {tokenA.symbol}
                  </span>
                </div>
                <div className="pt-2 border-t border-gray-200">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Share of Pool</span>
                    <Badge variant="primary">{poolShare}%</Badge>
                  </div>
                </div>
              </div>
            )}

            {/* Add Button */}
            <Button
              variant="primary"
              fullWidth
              size="lg"
              className="mt-6"
              onClick={handleAddLiquidity}
              disabled={
                connectionStatus !== "connected" ||
                !tokenA ||
                !tokenB ||
                !amountA ||
                !amountB ||
                parseFloat(amountA) <= 0 ||
                parseFloat(amountB) <= 0 ||
                loading
              }
            >
              {connectionStatus !== "connected"
                ? "Connect Wallet"
                : !tokenA || !tokenB
                  ? "Select Tokens"
                  : !amountA || !amountB
                    ? "Enter Amounts"
                    : loading
                      ? "Submitting..."
                      : "Add Liquidity"}
            </Button>

            {error && (
              <div className="mt-3 text-sm text-red-600">{error}</div>
            )}
          </>
        ) : (
          <>
            {/* Remove Liquidity Mode */}
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-2">Your Liquidity Position</div>
                {tokenA && tokenB && connectionStatus === "connected" ? (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-lg">
                          {tokenA.symbol}/{tokenB.symbol}
                        </span>
                      </div>
                      <Badge variant="primary">{poolShare}% Share</Badge>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Pooled {tokenA.symbol}:</span>
                        <span className="font-medium">{formatNumber(parseFloat(pooledTokenA))}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Pooled {tokenB.symbol}:</span>
                        <span className="font-medium">{formatNumber(parseFloat(pooledTokenB))}</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-gray-200">
                        <span className="text-gray-600">Your LP Tokens:</span>
                        <span className="font-medium">{formatNumber(parseFloat(lpBalance))}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-gray-500">
                    {connectionStatus !== "connected"
                      ? "Connect your wallet to view liquidity positions"
                      : "Select tokens to view your liquidity"}
                  </p>
                )}
              </div>

              {/* LP Token Amount Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Amount to Remove</span>
                  {connectionStatus === "connected" && (
                    <button
                      onClick={() => setLpTokenAmount(lpBalance)}
                      className="text-emerald-600 hover:text-emerald-700 font-medium"
                    >
                      MAX
                    </button>
                  )}
                </div>
                <Input
                  type="number"
                  placeholder="0.0"
                  value={lpTokenAmount}
                  onChange={(e) => setLpTokenAmount(e.target.value)}
                  className="text-2xl"
                  inputSize="lg"
                  helperText={`LP Tokens (${tokenA?.symbol || "?"}/${tokenB?.symbol || "?"})`}
                  step={stepFromDecimals(18)}
                />
              </div>

              {/* You will receive */}
              {lpTokenAmount && parseFloat(lpTokenAmount) > 0 && tokenA && tokenB && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <div className="text-sm font-medium text-emerald-900 mb-3">
                    You will receive:
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-emerald-700">{tokenA.symbol}</span>
                      <span className="font-semibold text-emerald-900">
                        {formatNumber(
                          parseFloat(lpBalance || "0") > 0
                            ? (parseFloat(pooledTokenA || "0") * parseFloat(lpTokenAmount || "0")) /
                            parseFloat(lpBalance || "1")
                            : 0
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-emerald-700">{tokenB.symbol}</span>
                      <span className="font-semibold text-emerald-900">
                        {formatNumber(
                          parseFloat(lpBalance || "0") > 0
                            ? (parseFloat(pooledTokenB || "0") * parseFloat(lpTokenAmount || "0")) /
                            parseFloat(lpBalance || "1")
                            : 0
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Remove Button */}
              <Button
                variant="danger"
                fullWidth
                size="lg"
                onClick={handleRemoveLiquidity}
                disabled={
                  connectionStatus !== "connected" ||
                  !tokenA ||
                  !tokenB ||
                  !lpTokenAmount ||
                  parseFloat(lpTokenAmount) <= 0 ||
                  parseFloat(lpTokenAmount) > parseFloat(lpBalance)
                }
              >
                {connectionStatus !== "connected"
                  ? "Connect Wallet"
                  : !tokenA || !tokenB
                    ? "Select Tokens"
                    : !lpTokenAmount
                      ? "Enter Amount"
                      : parseFloat(lpTokenAmount) > parseFloat(lpBalance)
                        ? "Insufficient LP Balance"
                        : "Remove Liquidity"}
              </Button>
            </div>
          </>
        )}

        {/* Info Note */}
        <div className="mt-4 flex items-start gap-2 text-xs text-gray-500">
          <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <p>
            {mode === "add"
              ? "By adding liquidity, you'll earn 0.3% of all trades on this pair proportional to your share of the pool."
              : "Removing liquidity will return your proportional share of tokens plus accumulated fees."}
          </p>
        </div>
      </Card>

      {/* Token Selector Modal */}
      <TokenSelector
        isOpen={showTokenSelector !== null}
        onClose={() => setShowTokenSelector(null)}
        onSelect={selectToken}
        excludeToken={showTokenSelector === "a" ? tokenB : tokenA}
        pairWith={mode === "remove" && showTokenSelector === "b" ? tokenA : null}
        requireExistingPair={mode === "remove" && showTokenSelector === "b"}
      />
    </>
  );
}
