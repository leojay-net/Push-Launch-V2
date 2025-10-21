"use client";

import { useState } from "react";
import { Rocket, Info, TrendingUp, RefreshCcw } from "lucide-react";
import Card from "../ui/Card";
import Input from "../ui/Input";
import Button from "../ui/Button";
import BondingCurveChart from "@/components/launchpad/BondingCurveChart";
import { BONDING_CURVE_CONFIG } from "@/lib/contracts";
import { useLaunchpad } from "@/hooks/useLaunchpad";
import { useNotification } from "@/components/ui/Notification";

export default function LaunchForm() {
    const {
        launchFeeEther,
        isFetchingFee,
        loading: launchLoading,
        error: launchError,
        launchToken,
        refreshLaunchFee,
        isWalletConnected,
    } = useLaunchpad();

    const { addNotification } = useNotification();

    const [tokenName, setTokenName] = useState("");
    const [tokenSymbol, setTokenSymbol] = useState("");
    const [totalSupply, setTotalSupply] = useState(BONDING_CURVE_CONFIG.TOTAL_SUPPLY);
    const [bondingSupply, setBondingSupply] = useState(BONDING_CURVE_CONFIG.BONDING_SUPPLY);
    const [enableRewards, setEnableRewards] = useState(true);
    const [mediaURI, setMediaURI] = useState("https://");
    const [successTx, setSuccessTx] = useState<string | null>(null);

    const handleLaunch = async () => {
        if (!tokenName || !tokenSymbol) {
            addNotification({
                type: "warning",
                title: "Missing Information",
                message: "Please fill in token name and symbol",
            });
            return;
        }

        try {
            const tx = await launchToken({
                name: tokenName,
                symbol: tokenSymbol,
                mediaURI,
            });

            setSuccessTx(tx.hash);
            setTokenName("");
            setTokenSymbol("");
            setMediaURI("https://");
            setTotalSupply(BONDING_CURVE_CONFIG.TOTAL_SUPPLY);
            setBondingSupply(BONDING_CURVE_CONFIG.BONDING_SUPPLY);
            refreshLaunchFee();

            addNotification({
                type: "success",
                title: "Token Launched!",
                message: `${tokenSymbol} has been successfully launched`,
            });
        } catch (error) {
            console.error("Token launch failed:", error);
            addNotification({
                type: "error",
                title: "Launch Failed",
                message: (error as Error).message || "Failed to launch token",
            });
        }
    };

    const isInsufficientData = !tokenName || !tokenSymbol;
    const lpSupply = parseInt(totalSupply) - parseInt(bondingSupply);

    return (
        <div className="space-y-6">
            <Card variant="elevated">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-emerald-100 rounded-lg">
                        <Rocket className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">Launch Token</h2>
                        <p className="text-sm text-gray-600">Create a new token with bonding curve</p>
                    </div>
                </div>

                <div className="space-y-4">
                    {/* Token Name */}
                    <Input
                        label="Token Name"
                        placeholder="My Awesome Token"
                        value={tokenName}
                        onChange={(e) => setTokenName(e.target.value)}
                        helperText="Full name of your token"
                    />

                    {/* Token Symbol */}
                    <Input
                        label="Token Symbol"
                        placeholder="MAT"
                        value={tokenSymbol}
                        onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())}
                        helperText="Short ticker symbol (3-5 characters)"
                    />

                    {/* Total Supply */}
                    <Input
                        label="Total Supply"
                        type="number"
                        value={totalSupply}
                        onChange={(e) => setTotalSupply(e.target.value)}
                        helperText={`Default: ${BONDING_CURVE_CONFIG.TOTAL_SUPPLY} tokens`}
                    />

                    {/* Bonding Curve Supply */}
                    <Input
                        label="Bonding Curve Supply"
                        type="number"
                        value={bondingSupply}
                        onChange={(e) => setBondingSupply(e.target.value)}
                        helperText={`Tokens for bonding curve. Remaining ${lpSupply.toLocaleString()} will go to LP`}
                    />

                    {/* Token Media URI */}
                    <Input
                        label="Token Media URI"
                        placeholder="https://ipfs.io/ipfs/..."
                        value={mediaURI}
                        onChange={(e) => setMediaURI(e.target.value)}
                        helperText="Optional: Provide metadata/imagery for your token"
                    />

                    {/* Enable Rewards */}
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                            <label className="text-sm font-medium text-gray-900 block">
                                Enable Rewards
                            </label>
                            <p className="text-sm text-gray-600 mt-1">
                                Distribute rewards to token holders
                            </p>
                        </div>
                        <button
                            onClick={() => setEnableRewards(!enableRewards)}
                            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${enableRewards ? "bg-emerald-600" : "bg-gray-200"
                                }`}
                        >
                            <span
                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${enableRewards ? "translate-x-5" : "translate-x-0"
                                    }`}
                            />
                        </button>
                    </div>

                    {/* Launch Button */}
                    <Button
                        variant="primary"
                        fullWidth
                        size="lg"
                        onClick={handleLaunch}
                        loading={launchLoading}
                        disabled={
                            isInsufficientData || launchLoading || !isWalletConnected
                        }
                        leftIcon={<Rocket className="w-5 h-5" />}
                    >
                        {isWalletConnected
                            ? isInsufficientData
                                ? "Fill Required Fields"
                                : "Launch Token"
                            : "Connect Wallet"}
                    </Button>

                    {/* Info Box */}
                    <div className="flex items-start gap-2 text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
                        <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-600" />
                        <div>
                            <p className="font-medium text-blue-900 mb-1">Bonding Curve Launch</p>
                            <p>
                                Your token will be launched with an automated bonding curve. Initial
                                buyers can purchase from the curve, and once it completes, liquidity is
                                automatically added to the DEX.
                            </p>
                        </div>
                    </div>

                    {/* Launch Fee & Status */}
                    <div className="grid gap-3">
                        <div className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-2 text-sm text-gray-700">
                            <span>Launch Fee</span>
                            <span className="font-semibold">
                                {isFetchingFee ? "Loading..." : `${launchFeeEther} PC`}
                            </span>
                            <button
                                type="button"
                                onClick={refreshLaunchFee}
                                className="text-emerald-600 hover:text-emerald-700 flex items-center gap-1 text-xs"
                            >
                                <RefreshCcw className="h-3 w-3" /> Refresh
                            </button>
                        </div>
                        {launchError && (
                            <div className="p-3 rounded-lg bg-red-50 text-sm text-red-600">
                                {launchError}
                            </div>
                        )}
                        {successTx && (
                            <div className="p-3 rounded-lg bg-emerald-50 text-sm text-emerald-700 break-words">
                                Token launched! Tx: {successTx}
                            </div>
                        )}
                    </div>
                </div>
            </Card>

            {/* Bonding Curve Preview */}
            <Card variant="elevated">
                <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="w-5 h-5 text-emerald-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Bonding Curve Preview</h3>
                </div>
                <BondingCurveChart />
                <div className="mt-4 grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-600 mb-1">Initial Price</p>
                        <p className="text-lg font-semibold text-gray-900">
                            {(parseInt(BONDING_CURVE_CONFIG.VIRTUAL_QUOTE) / parseInt(BONDING_CURVE_CONFIG.VIRTUAL_BASE)).toFixed(8)} WPC
                        </p>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-600 mb-1">Target Raise</p>
                        <p className="text-lg font-semibold text-gray-900">
                            {BONDING_CURVE_CONFIG.VIRTUAL_QUOTE} WPC
                        </p>
                    </div>
                </div>
            </Card>
        </div>
    );
}
