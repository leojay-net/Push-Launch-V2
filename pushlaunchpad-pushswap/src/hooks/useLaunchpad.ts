"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import {
    usePushChain,
    usePushChainClient,
    usePushWalletContext,
} from "@pushchain/ui-kit";
import { CHAIN_CONFIG, CONTRACTS } from "@/lib/contracts";
import { LaunchpadABI } from "@/abis";

const rpcProvider = new ethers.JsonRpcProvider(CHAIN_CONFIG.rpcUrl);

const launchpadReadContract = new ethers.Contract(
    CONTRACTS.LAUNCHPAD,
    LaunchpadABI,
    rpcProvider
);

export interface LaunchTokenParams {
    name: string;
    symbol: string;
    mediaURI: string;
}

export function useLaunchpad() {
    const { connectionStatus } = usePushWalletContext();
    const { pushChainClient } = usePushChainClient();
    const { PushChain } = usePushChain();

    const [launchFee, setLaunchFee] = useState<bigint>(BigInt(0));
    const [isFetchingFee, setIsFetchingFee] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchLaunchFee = useCallback(async () => {
        setIsFetchingFee(true);
        setError(null);
        try {
            const fee: bigint = await launchpadReadContract.launchFee();
            setLaunchFee(fee);
        } catch (err) {
            console.error("Failed to fetch launch fee", err);
            setError((err as Error).message);
        } finally {
            setIsFetchingFee(false);
        }
    }, []);

    useEffect(() => {
        fetchLaunchFee();
    }, [fetchLaunchFee]);

    const launchToken = useCallback(
        async ({ name, symbol, mediaURI }: LaunchTokenParams) => {
            if (!pushChainClient || connectionStatus !== "connected") {
                throw new Error("Wallet not connected");
            }

            setLoading(true);
            setError(null);

            try {
                const tx = await pushChainClient.universal.sendTransaction({
                    to: CONTRACTS.LAUNCHPAD,
                    data: PushChain.utils.helpers.encodeTxData({
                        abi: LaunchpadABI,
                        functionName: "launch",
                        args: [name, symbol, mediaURI],
                    }),
                    value: launchFee,
                });

                await tx.wait();
                return tx;
            } catch (err) {
                console.error("Launch transaction failed", err);
                setError((err as Error).message);
                throw err;
            } finally {
                setLoading(false);
            }
        },
        [connectionStatus, launchFee, pushChainClient, PushChain]
    );

    const isWalletConnected = connectionStatus === "connected";

    return useMemo(
        () => ({
            launchFee,
            launchFeeEther: launchFee
                ? ethers.formatUnits(launchFee, CHAIN_CONFIG.decimals)
                : "0",
            isFetchingFee,
            loading,
            error,
            launchToken,
            refreshLaunchFee: fetchLaunchFee,
            isWalletConnected,
        }),
        [
            launchFee,
            isFetchingFee,
            loading,
            error,
            launchToken,
            fetchLaunchFee,
            isWalletConnected,
        ]
    );
}
