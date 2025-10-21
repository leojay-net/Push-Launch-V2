// Push Chain Testnet Configuration
export const CHAIN_CONFIG = {
    chainId: 42101,
    name: "Push Chain Testnet",
    rpcUrl: "https://evm.rpc-testnet-donut-node1.push.org/",
    rpcUrlAlt: "https://evm.rpc-testnet-donut-node2.push.org/",
    explorer: "https://donut.push.network/",
    symbol: "PC",
    decimals: 18,
};

// Deployed Contract Addresses (V3 Deployment - Oct 20, 2025)
export const CONTRACTS = {
    // Core V3 Launchpad Contracts
    LAUNCHPAD: "0x451cf6b75805ebA5331F7Daa874767Ec351D4FFc", // Launchpad Proxy (V3)
    BONDING_CURVE: "0x7cded1CCb5B9DBD6D97B4e96fb42F0e39cc9495F", // SimpleBondingCurve
    LP_VAULT: "0x67991725102aFe906246b835a1aD3D2b8211f18F", // LaunchpadLPVault Proxy (V3)
    DISTRIBUTOR: "0x4E1501C051592Bd79C2EE0217811e7A72674BA07", // Distributor
    ERC1967_FACTORY: "0x4C17bF9C39d23c3Daf26e58222EfBdbd319BE824", // ERC1967Factory

    // Uniswap V3 Infrastructure (Pre-deployed)
    V3_FACTORY: "0x81b8Bca02580C7d6b636051FDb7baAC436bFb454", // UniswapV3Factory
    V3_POSITION_MANAGER: "0xf9b3ac66aed14A2C7D9AA7696841aB6B27a6231e", // NonfungiblePositionManager
    V3_SWAP_ROUTER: "0x5D548bB9E305AAe0d6dc6e6fdc3ab419f6aC0037", // SwapRouter
    QUOTER_V2: "0x83316275f7C2F79BC4E26f089333e88E89093037", // QuoterV2
    V3_FEE_TIER: 500, // 0.05% fee tier for graduated pools

    // Quote Token (WPC - Wrapped Push Coin)
    WPC: "0xE17DD2E0509f99E9ee9469Cf6634048Ec5a3ADe9", // WPC (Quote Asset)

    // Legacy V2 contracts (deprecated, kept for reference)
    ROUTER: "0x133a3108B0e35d1B9D0F5E47A0f5F8ba153Ddb7F", // V2 Router (deprecated)
    FACTORY: "0xDAbc0d2Ee510885535451528F9C1cf24e2396580", // V2 Factory (deprecated)
    WETH: "0x9e9eE7F2e34a61ADC7b9d40F5Cf02b1841dC8dA9", // Old WETH (deprecated, use WPC)
} as const;

// Common Token List (Add your tokens here)
export interface Token {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    logoURI?: string;
}

export const COMMON_TOKENS: Token[] = [
    {
        address: CONTRACTS.WPC,
        symbol: "WPC",
        name: "Wrapped Push Coin",
        decimals: 18,
        logoURI: "/tokens/wpc.png",
    },
    {
        address: "0xf5065BA2DBF1Ec636531253449983f0EafebfD87",
        symbol: "USDT",
        name: "Tether USD",
        decimals: 6,
        logoURI: "/tokens/usdt.png",
    },
    {
        address: "0x8afc81487682024368AC225B799C3b325D82BEB4",
        symbol: "USDC",
        name: "USD Coin",
        decimals: 6,
        logoURI: "/tokens/usdc.png",
    },
    {
        address: "0x9395EcA683139b9Fe59D4E56dF4Eb132f0F2a103",
        symbol: "DAI",
        name: "Dai Stablecoin",
        decimals: 18,
        logoURI: "/tokens/dai.png",
    },
    {
        address: "0xE6AEead4278FC9d7Ee83780F5378C30838B9a0bA",
        symbol: "BSC",
        name: "BSC Token",
        decimals: 18,
        logoURI: "/tokens/bsc.png",
    },
    // Add more tokens as they launch
];

// Bonding Curve Configuration (V3)
export const BONDING_CURVE_CONFIG = {
    VIRTUAL_BASE: "200000000", // 200M tokens
    VIRTUAL_QUOTE: "10", // 10 WPC
    BONDING_SUPPLY: "800000000", // 800M tokens
    TOTAL_SUPPLY: "1000000000", // 1B tokens
};

// Transaction Settings
export const TX_SETTINGS = {
    DEFAULT_SLIPPAGE: 0.5, // 0.5%
    MAX_SLIPPAGE: 50, // 50%
    DEFAULT_DEADLINE: 20, // 20 minutes
};

// Feature Flags for Token Launch
export const FEATURE_FLAGS = {
    REWARDS_ENABLED: 1 << 0, // Bit 0
    UNIVERSAL_ENABLED: 1 << 1, // Bit 1
    // Add more flags as needed
};

export const getFeatureFlags = (
    rewards: boolean = true,
    universal: boolean = true
): number => {
    let flags = 0;
    if (rewards) flags |= FEATURE_FLAGS.REWARDS_ENABLED;
    if (universal) flags |= FEATURE_FLAGS.UNIVERSAL_ENABLED;
    return flags;
};
