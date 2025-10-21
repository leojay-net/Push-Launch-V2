"use client";

import { useState } from "react";
import { Book, ChevronRight, Code, Coins, Rocket, Shield, TrendingUp, Zap, Droplet } from "lucide-react";
import Link from "next/link";
import Layout from "@/components/layout/Layout";
import Card from "@/components/ui/Card";

const sections = [
    {
        id: "introduction",
        title: "Introduction",
        icon: Book,
        content: `
# Introduction

Welcome to Push Launchpad, the first universal DEX and token launchpad built on Push Chain. Push Launchpad enables users to launch, trade, and provide liquidity for tokens from any blockchain without the need for bridges or wrapped assets.

## What is Push Chain?

Push Chain is the world's first universal blockchain that natively supports transactions from any network. It eliminates the complexity of cross-chain bridges, wrapped tokens, and network switching, providing a seamless experience for users across all blockchains.

## Key Features

**Universal Trading**: Trade assets from Ethereum, Binance Smart Chain, Polygon, and more from a single interface.

**Fair Launch Mechanism**: Launch tokens with bonding curve pricing that ensures fair distribution and prevents front-running.

**Push Swap (Uniswap V3)**: Concentrated-liquidity AMM with position NFTs and fee tiers (0.05%, 0.3%, 1%).

**Liquidity Positions**: Provide liquidity in a price range and earn fees proportional to active liquidity and the pool's fee tier.

**Secure Architecture**: Built on battle-tested Uniswap V3 contracts with concentrated liquidity and optimized capital efficiency.

## Getting Started

To begin using Push Launchpad:

1. Connect your wallet from any supported blockchain
2. Ensure you have sufficient funds for gas fees
3. Start trading, launching tokens, or providing liquidity
    `
    },
    {
        id: "faucet",
        title: "Test Token Faucet",
        icon: Droplet,
        content: `
# Test Token Faucet

Mint test tokens instantly to try the DEX, launchpad, and liquidity features.

## Overview

The faucet provides a quick way to mint a fixed amount of test tokens on Push Chain testnet so you can explore launches, swaps, and liquidity without real funds.

## Tokens Available

- **WPC** (18 decimals) - Wrapped Push Coin (quote asset in many pools)
- **USDT** (6 decimals)
- **USDC** (6 decimals)
- **DAI** (18 decimals)
- Additional sample tokens depending on current test deployment
  

## How it Works

1. Go to the Faucet page
2. Connect your wallet
3. Click Mint for the token(s) you need
4. Wait a few seconds for the universal transaction to complete

To prevent abuse, each token has a short cooldown between mints per address.

## Where to Find It

Visit the Faucet at: /faucet

After minting, go to the DEX to swap or to Liquidity to create/manage a position.
        `
    },
    {
        id: "token-launch",
        title: "Token Launch",
        icon: Rocket,
        content: `
# Token Launch

Launch your own token with our fair launch mechanism powered by bonding curves.

## Overview

The Push Launchpad uses a bonding curve model to ensure fair token distribution. As more tokens are purchased, the price automatically increases along the curve, preventing large holders from manipulating the initial price.

## How to Launch a Token

### Step 1: Token Details

Navigate to the Launch page and provide:

- **Token Name**: The full name of your token (e.g., "My Token")
- **Token Symbol**: A short ticker symbol (e.g., "MTK")
- **Total Supply**: The total number of tokens to be created
- **Initial Price**: Starting price in the base currency

### Step 2: Configuration

Configure your launch parameters:

- **Bonding Curve Type**: Linear, Exponential, or Logarithmic
- **Graduation Threshold**: Target condition to migrate liquidity to Push Swap (Uniswap V3)
- **Fee Structure**: Platform fee percentage (typically 1%)

### Step 3: Deploy

Review all details and click "Launch Token". Your universal wallet will prompt you to sign the transaction.

## Bonding Curve Mechanics

The bonding curve automatically adjusts token price based on supply:

**Linear Curve**: Price increases proportionally with each token sold

**Exponential Curve**: Price increases exponentially, creating scarcity

**Logarithmic Curve**: Price increases rapidly at first, then slows

## Graduation to Push Swap (Uniswap V3)

Once your token reaches the graduation threshold:

1. Bonding curve trading is disabled
2. Initial liquidity is automatically added to a V3 pool (fee tier chosen by the deployer or default)
3. The liquidity position (NFT) is owned by the protocol vault according to launch rules
4. The token becomes freely tradable on Push Swap

## Best Practices

- Set reasonable initial prices to encourage participation
- Communicate your project's roadmap and utility
- Engage with your community during the launch
- Consider the graduation threshold carefully
    `
    },
    {
        id: "trading",
        title: "Trading (DEX)",
        icon: TrendingUp,
        content: `
# Trading on the DEX

Trade tokens seamlessly using Push Swap, our Uniswap V3-based DEX.

## Overview

Push Swap uses Uniswap V3 concentrated-liquidity AMM. Liquidity is provided in ranges and trades route through pools with a specific fee tier (0.05%, 0.3%, 1%).

## How to Trade

### Swap Interface

1. Navigate to the DEX page
2. Select the token you want to trade (From)
3. Select the token you want to receive (To)
4. Enter the amount
5. Review the quote and price impact
6. Click "Swap" to execute

### Understanding Quotes

When you enter an amount, the interface displays:

- **Exchange Rate**: Current price between the two tokens
- **Minimum Received**: Guaranteed minimum after slippage
- **Price Impact**: How much your trade affects the pool price
- **Trading Fee**: Determined by the pool's fee tier (0.05%, 0.3%, or 1%) and distributed to active liquidity providers

## Slippage Tolerance

Slippage is the difference between expected and executed price:

- **Low Slippage (0.1-0.5%)**: For stable pairs, may fail in volatile conditions
- **Medium Slippage (0.5-1%)**: Recommended for most trades
- **High Slippage (1-5%)**: For volatile or low-liquidity pairs

Adjust slippage in settings if your transaction fails.

## Price Impact

Large trades relative to pool size will have higher price impact:

- **< 1%**: Negligible impact
- **1-3%**: Moderate impact
- **3-5%**: High impact, consider splitting trade
- **> 5%**: Very high impact, proceed with caution

## Transaction Deadlines

Set a deadline to prevent your transaction from being executed too late:

- **Standard**: 20 minutes (recommended)
- **Fast**: 5-10 minutes for time-sensitive trades
- **Custom**: Set your own deadline

## Trading Tips

- Check liquidity depth before large trades
- Monitor price impact to avoid unfavorable execution
- Use limit orders (coming soon) for better price execution
- Split large trades to minimize price impact
    `
    },
    {
        id: "liquidity",
        title: "Liquidity Provision",
        icon: Coins,
        content: `
# Liquidity Provision

Earn trading fees by creating concentrated-liquidity positions (NFTs).

## Overview

In Uniswap V3, liquidity is provided within a price range and positions are represented as NFTs (not fungible LP tokens). You earn a share of fees only when the price trades within your position's range.

## Adding Liquidity (Existing Pool)

1. Navigate to the Liquidity page
2. Select both tokens in the pair (the UI sorts token0/token1 automatically)
3. Choose the fee tier if multiple pools exist
4. Enter your amounts; pick a tick range (or use the suggested wide range)
5. Review estimated liquidity and fee tier
6. Click "Add Liquidity"

## Creating New Pools

When no pool exists:

1. Select both tokens (order doesn't matter, we sort them for the pool)
2. Provide an initial price. The app initializes the pool with this price and the chosen fee tier
3. Choose a tick range; a wider range behaves more like V2 but spreads capital thinner
4. Confirm to create and initialize the pool, then mint your first position

## Managing a Position

Your position shows as an NFT with: token0/token1, fee tier, tickLower/Upper, and current liquidity.

- Increase Liquidity: add more of token0/1 into the same range
- Decrease Liquidity: remove a percentage of liquidity from the position
- Collect Fees: withdraw accrued tokensOwed0/1 without changing liquidity

When a position's liquidity reaches 0, we mark it closed. The UI focuses on active positions by default.

## Understanding Impermanent Loss

Impermanent loss occurs when token prices diverge:

**Example**: You provide 1 ETH and 2000 USDC (1:2000 ratio)

If ETH price doubles to 4000 USDC:
- Holding: 1 ETH + 2000 USDC = $6000
- LP Position: ~0.707 ETH + ~2828 USDC = $5656
- Impermanent Loss: ~5.7%

Trading fees may offset impermanent loss over time.

## Position & Pool Statistics

Monitor your positions:

- **Total Value Locked (TVL)**: Total liquidity in the pool
- **Your Pool Share**: Your percentage of the total pool
- **Pooled Tokens**: Amount of each token you've provided
- **Position ID**: Your NFT tokenId(s)
- **24h Fees**: Estimated daily fee earnings

## Best Practices

- Provide liquidity to pairs with correlated price movements
- Consider impermanent loss vs. fee earnings
- Monitor pool composition and rebalance if needed
- Diversify across multiple pools to manage risk
- Stake LP tokens (coming soon) for additional rewards
    `
    },
    {
        id: "wallet",
        title: "Wallet Connection",
        icon: Zap,
        content: `
# Wallet Connection

Connect your wallet from any blockchain to use Push Launchpad.

## Supported Wallets

Push Launchpad supports major wallet types through Push Chain's universal transaction protocol:

- **MetaMask**: Most popular Ethereum wallet
- **WalletConnect**: Connect mobile wallets
- **Coinbase Wallet**: Integrated with Coinbase
- **Trust Wallet**: Multi-chain mobile wallet
- **Ledger**: Hardware wallet support
- **Trezor**: Hardware wallet support

## How to Connect

1. Click "Connect Wallet" in the top right
2. Select your wallet type
3. Approve the connection in your wallet
4. Your wallet is now connected

No need to switch networks—Push Chain handles universal transactions automatically.

## Universal Transactions

When you make a transaction:

1. Sign with your connected wallet
2. Push Chain broadcasts to the native blockchain
3. Transaction is confirmed on the source chain
4. State is updated on Push Chain

This all happens automatically in the background.

## Account Information

Once connected, you'll see:

- **Wallet Address**: Your abbreviated address
- **Network**: Your connected blockchain
- **Balance**: Native token balance
- **Token Holdings**: Your token portfolio

## Disconnecting

To disconnect your wallet:

1. Click on your wallet address
2. Select "Disconnect"
3. Your wallet is now disconnected

## Security Best Practices

- Always verify transaction details before signing
- Never share your private keys or seed phrase
- Use hardware wallets for large amounts
- Be cautious of phishing websites
- Keep your wallet software updated
    `
    },
    {
        id: "security",
        title: "Security & Audits",
        icon: Shield,
        content: `
# Security & Audits

Coming soon.

We're preparing comprehensive security documentation, including audit reports, threat models, and best-practice guides. Check back soon.
        `
    },
    {
        id: "api",
        title: "API Reference",
        icon: Code,
        content: `
# API Reference

Coming soon.

Our REST/GraphQL/WebSocket APIs are being finalized. We will publish endpoints, schemas, examples, and rate limits here soon.
                `
    }
];

export default function DocsPage() {
    const [activeSection, setActiveSection] = useState("introduction");

    const currentSection = sections.find(s => s.id === activeSection) || sections[0];

    return (
        <Layout>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="mb-12">
                    <h1 className="text-4xl font-bold text-gray-900 mb-4">
                        Documentation
                    </h1>
                    <p className="text-xl text-gray-600">
                        Everything you need to know about using Push Launchpad
                    </p>
                </div>

                <div className="grid lg:grid-cols-4 gap-8">
                    {/* Sidebar Navigation */}
                    <div className="lg:col-span-1">
                        <Card className="sticky top-4">
                            <nav className="p-4 space-y-1">
                                {sections.map((section) => {
                                    const Icon = section.icon;
                                    const isActive = activeSection === section.id;

                                    return (
                                        <button
                                            key={section.id}
                                            onClick={() => setActiveSection(section.id)}
                                            className={`
                        w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all
                        ${isActive
                                                    ? "bg-emerald-50 text-emerald-700 font-medium"
                                                    : "text-gray-700 hover:bg-gray-50"
                                                }
                      `}
                                        >
                                            <Icon className="h-5 w-5 flex-shrink-0" />
                                            <span className="flex-1">{section.title}</span>
                                            {isActive && <ChevronRight className="h-4 w-4" />}
                                        </button>
                                    );
                                })}
                            </nav>
                        </Card>
                    </div>

                    {/* Content Area */}
                    <div className="lg:col-span-3">
                        <Card className="p-8 md:p-12">
                            <div className="prose prose-lg max-w-none">
                                {currentSection.content.split('\n').map((line, index) => {
                                    // Headers
                                    if (line.startsWith('# ')) {
                                        return (
                                            <h1 key={index} className="text-4xl font-bold text-gray-900 mb-6 mt-8">
                                                {line.substring(2)}
                                            </h1>
                                        );
                                    }
                                    if (line.startsWith('## ')) {
                                        return (
                                            <h2 key={index} className="text-3xl font-bold text-gray-900 mb-4 mt-8">
                                                {line.substring(3)}
                                            </h2>
                                        );
                                    }
                                    if (line.startsWith('### ')) {
                                        return (
                                            <h3 key={index} className="text-2xl font-semibold text-gray-900 mb-3 mt-6">
                                                {line.substring(4)}
                                            </h3>
                                        );
                                    }

                                    // Code blocks
                                    if (line.startsWith('```')) {
                                        return null; // Handle separately
                                    }

                                    // Lists with bold text inline
                                    if (line.startsWith('- ')) {
                                        const content = line.substring(2);
                                        const parts = content.split(/(\*\*[^*]+\*\*)/g);
                                        return (
                                            <li key={index} className="text-gray-700 mb-2 ml-4">
                                                {parts.map((part, i) => {
                                                    if (part.startsWith('**') && part.endsWith('**')) {
                                                        return <strong key={i} className="font-semibold text-gray-900">{part.slice(2, -2)}</strong>;
                                                    }
                                                    return part;
                                                })}
                                            </li>
                                        );
                                    }

                                    // Paragraphs with inline bold text
                                    if (line.trim()) {
                                        const parts = line.split(/(\*\*[^*]+\*\*)/g);
                                        const hasBold = parts.some(part => part.startsWith('**') && part.endsWith('**'));

                                        if (hasBold) {
                                            return (
                                                <p key={index} className="text-gray-700 mb-4 leading-relaxed">
                                                    {parts.map((part, i) => {
                                                        if (part.startsWith('**') && part.endsWith('**')) {
                                                            return <strong key={i} className="font-semibold text-gray-900">{part.slice(2, -2)}</strong>;
                                                        }
                                                        return part;
                                                    })}
                                                </p>
                                            );
                                        }

                                        return (
                                            <p key={index} className="text-gray-700 mb-4 leading-relaxed">
                                                {line}
                                            </p>
                                        );
                                    }

                                    return null;
                                })}
                            </div>

                            {/* Quick Links */}
                            <div className="mt-12 pt-8 border-t border-gray-200">
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                                    Quick Links
                                </h3>
                                <div className="grid sm:grid-cols-2 gap-4">
                                    <Link href="/dex">
                                        <div className="p-4 border border-gray-200 rounded-lg hover:border-emerald-500 hover:shadow-sm transition-all cursor-pointer">
                                            <div className="font-medium text-gray-900 mb-1">Start Trading</div>
                                            <div className="text-sm text-gray-600">Go to DEX</div>
                                        </div>
                                    </Link>
                                    <Link href="/launch">
                                        <div className="p-4 border border-gray-200 rounded-lg hover:border-emerald-500 hover:shadow-sm transition-all cursor-pointer">
                                            <div className="font-medium text-gray-900 mb-1">Launch Token</div>
                                            <div className="text-sm text-gray-600">Create your token</div>
                                        </div>
                                    </Link>
                                    <Link href="/liquidity">
                                        <div className="p-4 border border-gray-200 rounded-lg hover:border-emerald-500 hover:shadow-sm transition-all cursor-pointer">
                                            <div className="font-medium text-gray-900 mb-1">Add Liquidity</div>
                                            <div className="text-sm text-gray-600">Earn trading fees</div>
                                        </div>
                                    </Link>
                                    <Link href="/marketplace">
                                        <div className="p-4 border border-gray-200 rounded-lg hover:border-emerald-500 hover:shadow-sm transition-all cursor-pointer">
                                            <div className="font-medium text-gray-900 mb-1">Explore Tokens</div>
                                            <div className="text-sm text-gray-600">Browse marketplace</div>
                                        </div>
                                    </Link>
                                    <Link href="/faucet">
                                        <div className="p-4 border border-gray-200 rounded-lg hover:border-emerald-500 hover:shadow-sm transition-all cursor-pointer">
                                            <div className="font-medium text-gray-900 mb-1">Get Test Tokens</div>
                                            <div className="text-sm text-gray-600">Go to Faucet</div>
                                        </div>
                                    </Link>
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </Layout>
    );
}
