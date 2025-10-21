"use client";

import { useEffect, useState, useMemo } from "react";
import { Search, X, Plus, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import Modal from "../ui/Modal";
import Input from "../ui/Input";
import Button from "../ui/Button";
import { COMMON_TOKENS, CONTRACTS, type Token } from "@/lib/contracts";
import { formatNumber, formatAddress } from "@/lib/utils";
import { useDexRouter } from "@/hooks/useDexRouter";
import { useLaunchHistory } from "@/hooks/useLaunchHistory";
import { ethers } from "ethers";
import { usePushChainClient } from "@pushchain/ui-kit";

interface TokenSelectorProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (token: Token) => void;
    excludeToken?: Token | null;
    pairWith?: Token | null;
    requireExistingPair?: boolean;
}

export default function TokenSelector({
    isOpen,
    onClose,
    onSelect,
    excludeToken,
    pairWith,
    requireExistingPair = false,
}: TokenSelectorProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [balances, setBalances] = useState<Record<string, string>>({});
    const { getTokenBalance, isWalletConnected, getPairInfo } = useDexRouter();
    const { pushChainClient } = usePushChainClient();
    const { launches } = useLaunchHistory();

    // States for custom token import
    const [showImport, setShowImport] = useState(false);
    const [customAddress, setCustomAddress] = useState("");
    const [importingToken, setImportingToken] = useState<Token | null>(null);
    const [importError, setImportError] = useState("");
    const [isImporting, setIsImporting] = useState(false);

    // States for pair checking
    const [checkingPairs, setCheckingPairs] = useState(false);
    const [allowedPairs, setAllowedPairs] = useState<Set<string> | null>(null);

    // Get graduated tokens from marketplace (memoized to prevent infinite re-renders)
    const graduatedTokens = useMemo(() => {
        return launches
            .filter(launch => launch.status === "completed")
            .map(launch => ({
                address: launch.token,
                symbol: launch.symbol,
                name: launch.name,
                decimals: 18,
                isGraduated: true
            }));
    }, [launches]);

    // Combine common tokens with graduated tokens (memoized)
    const allTokens = useMemo(() => {
        return [
            ...COMMON_TOKENS,
            ...graduatedTokens.filter(gt =>
                !COMMON_TOKENS.some(ct => ct.address.toLowerCase() === gt.address.toLowerCase())
            )
        ];
    }, [graduatedTokens]);

    useEffect(() => {
        let cancelled = false;

        const fetchBalances = async () => {
            if (!isOpen || !isWalletConnected) {
                if (!cancelled) {
                    setBalances({});
                }
                return;
            }

            try {
                const entries = await Promise.all(
                    allTokens.map(async (token) => {
                        const balance = await getTokenBalance(token);
                        return [token.address, balance.formatted] as const;
                    })
                );

                if (!cancelled) {
                    setBalances(Object.fromEntries(entries));
                }
            } catch (err) {
                console.error("Failed to load token balances", err);
            }
        };

        fetchBalances();

        return () => {
            cancelled = true;
        };
    }, [isOpen, isWalletConnected, getTokenBalance, allTokens]);

    // Compute which tokens have an existing pair with the provided token
    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            if (!isOpen || !requireExistingPair || !pairWith) {
                setAllowedPairs(null);
                setCheckingPairs(false);
                return;
            }
            setCheckingPairs(true);
            try {
                const entries = await Promise.all(
                    allTokens.map(async (token) => {
                        if (excludeToken && token.address === excludeToken.address) {
                            return [token.address, false] as const;
                        }
                        if (token.address.toLowerCase() === pairWith.address.toLowerCase()) {
                            return [token.address, false] as const;
                        }
                        try {
                            const info = await getPairInfo(pairWith, token);
                            return [token.address, info.exists] as const;
                        } catch {
                            return [token.address, false] as const;
                        }
                    })
                );
                if (!cancelled) {
                    setAllowedPairs(
                        new Set(entries.filter(([, ok]) => ok).map(([addr]) => addr))
                    );
                }
            } finally {
                if (!cancelled) setCheckingPairs(false);
            }
        };
        run();
        return () => {
            cancelled = true;
        };
    }, [isOpen, requireExistingPair, pairWith, excludeToken, getPairInfo, allTokens]);

    // Filter tokens based on search and exclusion
    const filteredTokens = allTokens.filter((token) => {
        const matchesSearch =
            token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
            token.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            token.address.toLowerCase().includes(searchQuery.toLowerCase());

        const isNotExcluded = !excludeToken || token.address !== excludeToken.address;

        const hasPair = !requireExistingPair || !pairWith
            ? true
            : !!allowedPairs && allowedPairs.has(token.address);

        return matchesSearch && isNotExcluded && hasPair;
    });

    const handleSelect = (token: Token) => {
        onSelect(token);
        setSearchQuery("");
        setShowImport(false);
    };

    // Custom token import function
    const handleImportToken = async () => {
        if (!customAddress || !pushChainClient) {
            setImportError("Please enter a valid address");
            return;
        }

        setIsImporting(true);
        setImportError("");
        setImportingToken(null);

        try {
            // Validate address
            if (!ethers.isAddress(customAddress)) {
                setImportError("Invalid token address");
                return;
            }

            // Create ERC20 contract instance
            const erc20Abi = [
                "function name() view returns (string)",
                "function symbol() view returns (string)",
                "function decimals() view returns (uint8)",
            ];

            const provider = new ethers.JsonRpcProvider(
                "https://rpc.push-network.net"
            );
            const tokenContract = new ethers.Contract(
                customAddress,
                erc20Abi,
                provider
            );

            // Fetch token metadata
            const [name, symbol, decimals] = await Promise.all([
                tokenContract.name(),
                tokenContract.symbol(),
                tokenContract.decimals(),
            ]);

            const importedToken: Token = {
                address: customAddress,
                name,
                symbol,
                decimals: Number(decimals),
            };

            setImportingToken(importedToken);
        } catch (error) {
            console.error("Failed to import token:", error);
            setImportError("Failed to fetch token details. Ensure the address is a valid ERC20 token.");
        } finally {
            setIsImporting(false);
        }
    };

    const confirmImport = () => {
        if (importingToken) {
            handleSelect(importingToken);
            setCustomAddress("");
            setImportingToken(null);
        }
    };

    return (
        <>
            <Modal
                isOpen={isOpen && !showImport}
                onClose={onClose}
                title="Select a Token"
                description="Search by name, symbol, or address"
                size="md"
            >
                <div className="space-y-4">
                    {/* Search Input */}
                    <Input
                        placeholder="Search tokens..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        leftIcon={<Search className="w-4 h-4" />}
                        rightElement={
                            searchQuery && (
                                <button
                                    onClick={() => setSearchQuery("")}
                                    className="p-1 hover:bg-gray-100 rounded"
                                >
                                    <X className="w-4 h-4 text-gray-400" />
                                </button>
                            )
                        }
                    />

                    {/* Token List */}
                    <div className="max-h-[400px] overflow-y-auto">
                        {requireExistingPair && pairWith && checkingPairs && (
                            <div className="text-center py-6 text-gray-500">Checking available pairs…</div>
                        )}
                        {filteredTokens.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                                <p>No tokens found</p>
                                <p className="text-sm mt-1">Try a different search</p>
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {filteredTokens.map((token) => (
                                    <button
                                        key={token.address}
                                        onClick={() => handleSelect(token)}
                                        className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors text-left"
                                    >
                                        {/* Token Logo Placeholder */}
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-bold text-sm">
                                            {token.symbol.substring(0, 2)}
                                        </div>

                                        {/* Token Info */}
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-gray-900">{token.symbol}</span>
                                                {(token as any).isGraduated && (
                                                    <span className="px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700 rounded-full">
                                                        Graduated
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-sm text-gray-500">{token.name}</div>
                                        </div>

                                        {/* Balance */}
                                        <div className="text-right">
                                            <div className="font-medium text-gray-900">
                                                {formatNumber(balances[token.address] ?? "0", 4)}
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Add Custom Token Notice */}
                    <div className="pt-4 border-t border-gray-200">
                        <p className="text-sm text-gray-600 text-center">
                            Don&apos;t see your token?{" "}
                            <button
                                onClick={() => setShowImport(true)}
                                className="text-emerald-600 hover:text-emerald-700 font-medium"
                            >
                                Import custom token
                            </button>
                        </p>
                    </div>
                </div>
            </Modal>

            {/* Custom Token Import Modal */}
            <Modal
                isOpen={showImport}
                onClose={() => {
                    setShowImport(false);
                    setCustomAddress("");
                    setImportingToken(null);
                    setImportError("");
                }}
                title="Import Token"
                description="Enter the token contract address"
                size="md"
            >
                <div className="space-y-4">
                    {!importingToken ? (
                        <>
                            {/* Address Input */}
                            <div>
                                <Input
                                    placeholder="0x..."
                                    value={customAddress}
                                    onChange={(e) => {
                                        setCustomAddress(e.target.value);
                                        setImportError("");
                                    }}
                                />
                                {importError && (
                                    <div className="flex items-center gap-2 mt-2 text-sm text-red-600">
                                        <AlertCircle className="w-4 h-4" />
                                        {importError}
                                    </div>
                                )}
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-3">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setShowImport(false);
                                        setCustomAddress("");
                                        setImportError("");
                                    }}
                                    className="flex-1"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleImportToken}
                                    disabled={!customAddress || isImporting}
                                    className="flex-1"
                                >
                                    {isImporting ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Loading...
                                        </>
                                    ) : (
                                        "Import"
                                    )}
                                </Button>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Token Preview */}
                            <div className="p-4 bg-gray-50 rounded-lg space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-bold">
                                        {importingToken.symbol.substring(0, 2)}
                                    </div>
                                    <div>
                                        <div className="font-medium text-gray-900">{importingToken.symbol}</div>
                                        <div className="text-sm text-gray-600">{importingToken.name}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                    <span className="font-medium">Address:</span>
                                    <span className="font-mono">{formatAddress(importingToken.address)}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                    <span className="font-medium">Decimals:</span>
                                    <span>{importingToken.decimals}</span>
                                </div>
                            </div>

                            {/* Warning */}
                            <div className="flex gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                <div className="text-sm text-amber-800">
                                    <p className="font-medium mb-1">Be careful!</p>
                                    <p>Anyone can create a token with any name. Make sure this is the correct token before trading.</p>
                                </div>
                            </div>

                            {/* Confirm Buttons */}
                            <div className="flex gap-3">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setImportingToken(null);
                                        setCustomAddress("");
                                    }}
                                    className="flex-1"
                                >
                                    Back
                                </Button>
                                <Button
                                    onClick={confirmImport}
                                    className="flex-1"
                                >
                                    <CheckCircle2 className="w-4 h-4 mr-2" />
                                    Import Token
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            </Modal>
        </>
    );
}
