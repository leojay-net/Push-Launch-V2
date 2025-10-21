"use client";

import { useEffect, useState } from "react";
import Layout from "@/components/layout/Layout";
import Card, { CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { COMMON_TOKENS, CONTRACTS, CHAIN_CONFIG } from "@/lib/contracts";
import { usePushChainClient } from "@pushchain/ui-kit";
import { useNotification } from "@/components/ui/Notification";
import { Droplet, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { ethers } from "ethers";

export default function FaucetPage() {
    const { pushChainClient } = usePushChainClient();
    const { addNotification } = useNotification();
    const [minting, setMinting] = useState<Record<string, boolean>>({});
    const [lastMinted, setLastMinted] = useState<Record<string, number>>({});
    const [wpcAmount, setWpcAmount] = useState<string>("1");
    const [wrapping, setWrapping] = useState<boolean>(false);
    const [pushBalance, setPushBalance] = useState<string>("0");
    const [wpcBalance, setWpcBalance] = useState<string>("0");

    const provider = new ethers.JsonRpcProvider(CHAIN_CONFIG.rpcUrl);

    const isWalletConnected = !!pushChainClient?.universal.account;
    const MINT_AMOUNT = "1000"; // 1000 tokens per mint
    const COOLDOWN_SECONDS = 60; // 1 minute cooldown

    const canMint = (tokenAddress: string) => {
        const lastMintTime = lastMinted[tokenAddress] || 0;
        const timeSinceLastMint = (Date.now() - lastMintTime) / 1000;
        return timeSinceLastMint >= COOLDOWN_SECONDS;
    };

    const getRemainingCooldown = (tokenAddress: string) => {
        const lastMintTime = lastMinted[tokenAddress] || 0;
        const timeSinceLastMint = (Date.now() - lastMintTime) / 1000;
        const remaining = Math.max(0, COOLDOWN_SECONDS - timeSinceLastMint);
        return Math.ceil(remaining);
    };

    const handleMint = async (token: typeof COMMON_TOKENS[0]) => {
        if (!pushChainClient || !isWalletConnected) {
            addNotification({
                type: "warning",
                title: "Wallet Not Connected",
                message: "Please connect your wallet to mint tokens",
            });
            return;
        }

        if (!canMint(token.address)) {
            const remaining = getRemainingCooldown(token.address);
            addNotification({
                type: "warning",
                title: "Cooldown Active",
                message: `Please wait ${remaining} seconds before minting ${token.symbol} again`,
            });
            return;
        }

        setMinting({ ...minting, [token.address]: true });

        try {
            const mintAbi = ["function mint(address to, uint256 amount) external"];

            // Calculate amount with proper decimals
            const amount = ethers.parseUnits(MINT_AMOUNT, token.decimals);

            // Create contract interface
            const iface = new ethers.Interface(mintAbi);
            const data = iface.encodeFunctionData("mint", [
                pushChainClient.universal.account,
                amount,
            ]);

            // Create the mint transaction
            const tx = await pushChainClient.universal.sendTransaction({
                to: token.address as `0x${string}`,
                data: data as `0x${string}`,
                value: BigInt(0),
            });

            setLastMinted({ ...lastMinted, [token.address]: Date.now() });

            addNotification({
                type: "success",
                title: "Tokens Minted!",
                message: `Successfully minted ${MINT_AMOUNT} ${token.symbol}`,
            });

            console.log("Mint transaction:", tx);
        } catch (error) {
            console.error("Mint failed:", error);
            addNotification({
                type: "error",
                title: "Mint Failed",
                message: (error as Error).message || "Failed to mint tokens",
            });
        } finally {
            setMinting({ ...minting, [token.address]: false });
        }
    };

    // Wrap PUSH to WPC by calling WPC.deposit() payable
    const handleGetWPC = async () => {
        if (!pushChainClient || !isWalletConnected) {
            addNotification({
                type: "warning",
                title: "Wallet Not Connected",
                message: "Please connect your wallet to get WPC",
            });
            return;
        }

        const valueNum = parseFloat(wpcAmount || "0");
        if (!isFinite(valueNum) || valueNum <= 0) {
            addNotification({
                type: "warning",
                title: "Invalid Amount",
                message: "Enter a positive PUSH amount to wrap into WPC",
            });
            return;
        }

        setWrapping(true);
        try {
            // Minimal ABI for WETH-like deposit()
            const wpcAbi = ["function deposit() payable"];
            const iface = new ethers.Interface(wpcAbi);
            const data = iface.encodeFunctionData("deposit", []);

            const value = ethers.parseUnits(wpcAmount, 18);

            const tx = await pushChainClient.universal.sendTransaction({
                to: CONTRACTS.WPC as `0x${string}`,
                data: data as `0x${string}`,
                value,
            });

            addNotification({
                type: "success",
                title: "WPC Requested",
                message: `Depositing ${wpcAmount} PUSH to receive WPC...`,
            });

            // Wait for confirmation then refresh balances
            await tx.wait();
            await refreshBalances();
        } catch (error) {
            console.error("Get WPC failed:", error);
            addNotification({
                type: "error",
                title: "Get WPC Failed",
                message: (error as Error).message || "Failed to deposit PUSH for WPC",
            });
        } finally {
            setWrapping(false);
        }
    };

    // Compute maximum safe amount (leave gas)
    const handleMaxWPC = async () => {
        try {
            if (!pushChainClient?.universal.account) return;
            const account = pushChainClient.universal.account;

            // Build deposit calldata for estimation
            const wpcAbi = ["function deposit() payable"];
            const iface = new ethers.Interface(wpcAbi);
            const data = iface.encodeFunctionData("deposit", []);

            // Fetch balance and fee data
            const [balance, feeData] = await Promise.all([
                provider.getBalance(account),
                provider.getFeeData(),
            ]);

            // Estimate gas limit for deposit
            let gasLimit: bigint;
            try {
                gasLimit = await provider.estimateGas({
                    from: account,
                    to: CONTRACTS.WPC,
                    data: data as `0x${string}`,
                    value: 0n,
                } as any);
                // add 20% buffer
                gasLimit = (gasLimit * 12n) / 10n;
            } catch {
                // fallback if estimation fails
                gasLimit = 120000n;
            }

            const gasPrice = feeData.maxFeePerGas ?? feeData.gasPrice ?? 0n;
            const gasCost = gasPrice ? gasLimit * gasPrice : 0n;

            const safetyBuffer = gasCost > 0n ? gasCost : ethers.parseUnits("0.01", 18);
            const maxValue = balance > safetyBuffer ? balance - safetyBuffer : 0n;

            const formatted = ethers.formatUnits(maxValue, 18);
            // Trim to 6 decimals for UI friendliness
            const trimmed = (Number(formatted) || 0).toFixed(6).replace(/\.0+$/, "").replace(/(\.\d*?[1-9])0+$/, "$1");
            setWpcAmount(trimmed);
        } catch (e) {
            console.warn("Max WPC compute failed:", e);
        }
    };

    const refreshBalances = async () => {
        try {
            if (!pushChainClient?.universal.account) return;
            const account = pushChainClient.universal.account;
            const wpcAbi = ["function balanceOf(address) view returns (uint256)"];
            const wpc = new ethers.Contract(CONTRACTS.WPC, wpcAbi, provider);

            const [nativeBal, wpcBal] = await Promise.all([
                provider.getBalance(account),
                wpc.balanceOf(account) as Promise<bigint>,
            ]);

            setPushBalance(ethers.formatUnits(nativeBal, 18));
            setWpcBalance(ethers.formatUnits(wpcBal, 18));
        } catch (e) {
            // ignore balance errors in UI
        }
    };

    useEffect(() => {
        refreshBalances();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pushChainClient?.universal.account]);

    return (
        <Layout>
            <div className="container mx-auto max-w-4xl px-4 py-8">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 rounded-full bg-emerald-600 flex items-center justify-center">
                            <Droplet className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-4xl font-bold text-gray-900">Test Token Faucet</h1>
                            <p className="text-gray-600 mt-1">
                                Mint free test tokens for development and testing
                            </p>
                        </div>
                    </div>

                    {/* Info Banner */}
                    <Card variant="elevated" className="bg-blue-50 border-blue-200">
                        <CardContent>
                            <div className="flex gap-3">
                                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                <div className="text-sm text-blue-800">
                                    <p className="font-medium mb-1">For Testing Only</p>
                                    <p>
                                        These are test tokens on Push Chain Testnet. Each mint gives you{" "}
                                        <strong>{MINT_AMOUNT} tokens</strong> with a{" "}
                                        <strong>{COOLDOWN_SECONDS} second cooldown</strong> between mints.
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Wallet Status */}
                {!isWalletConnected && (
                    <Card variant="elevated" className="mb-6 bg-amber-50 border-amber-200">
                        <CardContent>
                            <div className="flex gap-3">
                                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                <div className="text-sm text-amber-800">
                                    <p className="font-medium mb-1">Wallet Not Connected</p>
                                    <p>Please connect your wallet to mint test tokens</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Token Faucet Cards */}
                <div className="grid gap-4 sm:grid-cols-2">
                    {/* Get WPC (wrap PUSH) */}
                    <Card variant="elevated" hover>
                        <CardContent>
                            <div className="space-y-4">
                                {/* Header */}
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-white font-bold text-lg">
                                        WPC
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-semibold text-gray-900">Get WPC</div>
                                        <div className="text-sm text-gray-600">Wrap PUSH into WPC via deposit()</div>
                                    </div>
                                </div>

                                {/* Input */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm text-gray-600">Amount (PUSH)</label>
                                        <div className="text-xs text-gray-600">
                                            Wallet: <span className="font-medium text-gray-900">{Number(pushBalance).toFixed(6)}</span> PUSH
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.0001"
                                            value={wpcAmount}
                                            onChange={(e) => setWpcAmount(e.target.value)}
                                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            placeholder="1.0"
                                        />
                                        <Button variant="outline" onClick={handleMaxWPC} disabled={!isWalletConnected || wrapping}>
                                            Max
                                        </Button>
                                    </div>
                                    <div className="text-xs text-gray-600">WPC Balance: <span className="font-medium text-gray-900">{Number(wpcBalance).toFixed(6)}</span> WPC</div>
                                </div>

                                {/* Action */}
                                <Button
                                    onClick={handleGetWPC}
                                    disabled={!isWalletConnected || wrapping}
                                    className="w-full"
                                    size="lg"
                                >
                                    {wrapping ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Depositing PUSH...
                                        </>
                                    ) : (
                                        <>
                                            <Droplet className="w-4 h-4 mr-2" />
                                            Get WPC
                                        </>
                                    )}
                                </Button>
                                <div className="text-xs text-gray-500">This sends a payable transaction to WPC.deposit()</div>
                            </div>
                        </CardContent>
                    </Card>

                    {COMMON_TOKENS.map((token) => {
                        const isMinting = minting[token.address];
                        const canMintNow = canMint(token.address);
                        const cooldown = getRemainingCooldown(token.address);

                        return (
                            <Card key={token.address} variant="elevated" hover>
                                <CardContent>
                                    <div className="space-y-4">
                                        {/* Token Header */}
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-bold text-lg">
                                                {token.symbol.substring(0, 2)}
                                            </div>
                                            <div className="flex-1">
                                                <div className="font-semibold text-gray-900">
                                                    {token.symbol}
                                                </div>
                                                <div className="text-sm text-gray-600">{token.name}</div>
                                            </div>
                                        </div>

                                        {/* Token Info */}
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Decimals:</span>
                                                <span className="font-medium text-gray-900">
                                                    {token.decimals}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Per Mint:</span>
                                                <span className="font-medium text-gray-900">
                                                    {MINT_AMOUNT} {token.symbol}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Cooldown:</span>
                                                <span className="font-medium text-gray-900">
                                                    {cooldown > 0 ? `${cooldown}s` : "Ready"}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Mint Button */}
                                        <Button
                                            onClick={() => handleMint(token)}
                                            disabled={!isWalletConnected || isMinting || !canMintNow}
                                            className="w-full"
                                            size="lg"
                                        >
                                            {isMinting ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                    Minting...
                                                </>
                                            ) : cooldown > 0 ? (
                                                <>
                                                    <AlertCircle className="w-4 h-4 mr-2" />
                                                    Wait {cooldown}s
                                                </>
                                            ) : (
                                                <>
                                                    <Droplet className="w-4 h-4 mr-2" />
                                                    Mint {MINT_AMOUNT} {token.symbol}
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>

                {/* Usage Instructions */}
                <Card variant="elevated" className="mt-8">
                    <CardHeader>
                        <CardTitle>How to Use the Faucet</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ol className="space-y-3 text-sm text-gray-700">
                            <li className="flex gap-3">
                                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-medium text-xs">
                                    1
                                </span>
                                <span>Connect your wallet using the button in the header</span>
                            </li>
                            <li className="flex gap-3">
                                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-medium text-xs">
                                    2
                                </span>
                                <span>
                                    Click the "Mint" button on any token card to receive {MINT_AMOUNT}{" "}
                                    test tokens
                                </span>
                            </li>
                            <li className="flex gap-3">
                                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-medium text-xs">
                                    3
                                </span>
                                <span>
                                    Wait {COOLDOWN_SECONDS} seconds between mints for the same token
                                </span>
                            </li>
                            <li className="flex gap-3">
                                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-medium text-xs">
                                    4
                                </span>
                                <span>
                                    Use your test tokens to trade on the DEX, add liquidity, or test
                                    the launchpad
                                </span>
                            </li>
                        </ol>
                    </CardContent>
                </Card>
            </div>
        </Layout>
    );
}
