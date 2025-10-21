"use client";

import {
    PushUI,
    PushUniversalWalletProvider,
    type AppMetadata,
    type ProviderConfigProps,
} from "@pushchain/ui-kit";

export const PushChainProviders = ({ children }: { children: React.ReactNode }) => {
    const walletConfig: ProviderConfigProps = {
        network: PushUI.CONSTANTS.PUSH_NETWORK.TESTNET,
        // Attempt to restore the last connected session on reload
        // (supported by runtime even if not present in the TS types)
        // Injected via index access to avoid TS complaints
        ...({ autoConnect: true } as Record<string, unknown>),

        login: {
            email: true,
            google: true,
            wallet: {
                enabled: true,
            },
            appPreview: true,
        },

        modal: {
            loginLayout: PushUI.CONSTANTS.LOGIN.LAYOUT.SPLIT,
            connectedLayout: PushUI.CONSTANTS.CONNECTED.LAYOUT.HOVER,
            appPreview: true,
            connectedInteraction: PushUI.CONSTANTS.CONNECTED.INTERACTION.BLUR,
        },

        chainConfig: {
            rpcUrls: {
                // Ethereum Sepolia testnet
                "eip155:11155111": ["https://sepolia.gateway.tenderly.co/"],
            },
        },
    } as ProviderConfigProps;

    const appMetadata: AppMetadata = {
        logoUrl: "https://avatars.githubusercontent.com/u/64157541?v=4",
        title: "Push Chain Launchpad",
        description:
            "Launch tokens and provide liquidity on Push Chain - the universal blockchain enabling cross-chain interactions without bridges.",
    };

    // App-wide theme overrides for Push UI Kit
    const themeOverrides = {
        // Global (applies to both light/dark; can be overridden by light/dark below)
        '--pw-core-brand-primary-color': '#059669', // emerald-600
        '--pw-core-btn-primary-bg-color': '#059669',
        '--pw-core-text-link-color': '#059669',

        // Make UI Kit text darker in light mode and crisper in dark
        light: {
            '--pw-core-text-primary-color': '#0f1115',
            '--pw-core-text-secondary-color': '#1f2937',
            '--pw-core-text-tertiary-color': '#374151',
            '--pwauth-btn-connect-bg-color': '#059669',
            '--pwauth-btn-connect-text-color': '#FFFFFF',
            '--pwauth-btn-connected-bg-color': '#047857',
            '--pwauth-btn-connected-text-color': '#FFFFFF',
        },
        dark: {
            '--pw-core-text-primary-color': '#F3F4F6',
            '--pw-core-text-secondary-color': '#E5E7EB',
            '--pw-core-text-tertiary-color': '#D1D5DB',
            '--pwauth-btn-connect-bg-color': '#10B981', // brighter emerald in dark mode
            '--pwauth-btn-connect-text-color': '#0B1220',
            '--pwauth-btn-connected-bg-color': '#059669',
            '--pwauth-btn-connected-text-color': '#FFFFFF',
        },
    } as const;

    return (
        <PushUniversalWalletProvider config={walletConfig} app={appMetadata} themeOverrides={themeOverrides as any}>
            {children}
        </PushUniversalWalletProvider>
    );
};
