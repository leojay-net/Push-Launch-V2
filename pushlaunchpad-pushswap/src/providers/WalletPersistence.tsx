"use client";

import { useEffect } from "react";
import { usePushWalletContext } from "@pushchain/ui-kit";

/**
 * WalletPersistence component that stores connection status
 * Note: The Push Chain SDK v2.0.10+ should handle persistence automatically
 * This component provides additional visual feedback for persisted sessions
 */
export function WalletPersistence({ children }: { children: React.ReactNode }) {
    // Access optional reconnect helper if available at runtime (not always typed in SDK)
    const walletCtx = usePushWalletContext() as any;
    const connectionStatus: string | undefined = walletCtx?.connectionStatus;
    const tryReconnect: (() => void) | undefined = walletCtx?.tryReconnect;

    // Store session indicator when connected for UX purposes
    useEffect(() => {
        if (connectionStatus === "connected") {
            localStorage.setItem("push_wallet_session", "true");
            localStorage.setItem("push_wallet_last_connected", Date.now().toString());
        }
    }, [connectionStatus]);

    // On mount, if we had a previous session but UI is disconnected,
    // ask the kit to attempt a reconnect (no-op if already connected)
    useEffect(() => {
        const hadSession = localStorage.getItem("push_wallet_session") === "true";
        if (hadSession && connectionStatus !== "connected") {
            tryReconnect?.();
        }
        // run once on mount
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return <>{children}</>;
}
