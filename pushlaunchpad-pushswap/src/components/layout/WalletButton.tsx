"use client";

import dynamic from "next/dynamic";

// Dynamically import to guarantee client-only rendering
const PushUniversalAccountButton = dynamic(
    () => import("@pushchain/ui-kit").then((m) => m.PushUniversalAccountButton),
    { ssr: false }
);

export default function WalletButton() {
    return (
        <div className="flex items-center">
            <PushUniversalAccountButton
                themeOverrides={{
                    '--pwauth-btn-connect-border-radius': '10px',
                    light: { '--pwauth-btn-connect-bg-color': '#059669', '--pwauth-btn-connect-text-color': '#FFFFFF' },
                    dark: { '--pwauth-btn-connect-bg-color': '#10B981', '--pwauth-btn-connect-text-color': '#0B1220' },
                }}
            />
        </div>
    );
}
