# Uniswap V2 Custom Implementation for PushLaunchPad

## Overview

PushLaunchPad includes a **custom Uniswap V2 Factory** (`PushLaunchpadV2PairFactory`) that creates pairs with special launchpad features:
- Tracks launchpad LP vault
- Routes fees to launchpad distributor
- Integration with reward distribution system

## Architecture

```
┌─────────────────────────────────────────┐
│  PushLaunchpadV2PairFactory (0.8.27)   │
│  - Creates custom pairs                 │
│  - Launchpad-aware                      │
│  - Fee routing to distributor           │
└─────────────────────────────────────────┘
           ↓ creates
┌─────────────────────────────────────────┐
│  PushLaunchpadV2Pair (0.8.27)          │
│  - AMM pair contract                    │
│  - Reward distribution                  │
│  - LaunchpadLP vault support            │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  UniswapV2Router02 (0.6.6)             │  ← Standard Uniswap
│  - Swap routing                         │
│  - Liquidity management                 │
│  - Compatible with custom factory       │
└─────────────────────────────────────────┘
```

## Key Files

### Custom Contracts (Solidity 0.8.27)
- `PushLaunchpadV2PairFactory.sol` - Factory with launchpad integration
- `PushLaunchpadV2Pair.sol` - Pair contract with reward features
- `IPushLaunchpadV2Pair.sol` - Pair interface

### Standard Routers (Solidity 0.6.6)
- `PushLaunchpadV2Router1.sol` - Standard UniswapV2Router01
- `PushLaunchpadV2Router2.sol` - Standard UniswapV2Router02

## Deployment Strategy

### Option 1: Deploy Everything (Recommended)

```bash
# 1. Deploy custom factory (0.8.27)
forge script script/DeployUniswapV2.s.sol --broadcast

# 2. Deploy standard router (0.6.6) - needs separate compiler
# This is tricky because router is 0.6.6, but we can deploy it manually
```

### Option 2: Use External Router

You can use any existing UniswapV2Router02 deployment that's compatible with your factory.

## Deployment Steps

### Step 1: Deploy PushLaunchpadV2PairFactory

```bash
cd /Users/mac/Desktop/CODE/pushchain-Uniswap-Amm/PushLaunchPad

# Set environment
export WETH9_ADDRESS=0x0d0dF7E8807430A81104EA84d926139816eC7586
export FEE_TO_SETTER=<your_address>

# Deploy factory
forge script script/DeployUniswapV2.s.sol:DeployUniswapV2 \
  --rpc-url $PUSH_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast

# Save the factory address
export UNIV2_FACTORY=<factory_address>
```

### Step 2: Deploy Router

#### Option A: Use Hardhat for 0.6.6 Router

Create a temporary Hardhat project:

```bash
mkdir temp-router-deploy
cd temp-router-deploy
npm init -y
npm install --save-dev hardhat @nomiclabs/hardhat-ethers ethers

# Create hardhat.config.js
cat > hardhat.config.js << 'EOF'
require("@nomiclabs/hardhat-ethers");

module.exports = {
  solidity: "0.6.6",
  networks: {
    push_testnet: {
      url: process.env.PUSH_RPC_URL,
      accounts: [process.env.PRIVATE_KEY]
    }
  }
};
EOF

# Copy router contract
cp ../src/launchpad/uniswap/PushLaunchpadV2Router2.sol contracts/

# Deploy script
cat > scripts/deploy-router.js << 'EOF'
const hre = require("hardhat");

async function main() {
  const factory = process.env.UNIV2_FACTORY;
  const wpush9 = process.env.WETH9_ADDRESS;
  
  console.log("Deploying UniswapV2Router02...");
  console.log("Factory:", factory);
  console.log("WETH9:", wpush9);
  
  const Router = await hre.ethers.getContractFactory("UniswapV2Router02");
  const router = await Router.deploy(factory, wpush9);
  await router.deployed();
  
  console.log("Router deployed to:", router.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
EOF

# Deploy
npx hardhat run scripts/deploy-router.js --network push_testnet
```

#### Option B: Use Existing Router

If there's an existing UniswapV2Router02 on Push Chain:

```bash
export UNIV2_ROUTER=<existing_router_address>
```

### Step 3: Verify Deployment

```bash
# Check factory
cast call $UNIV2_FACTORY "allPairsLength()" --rpc-url $PUSH_RPC_URL

# Check router
cast call $UNIV2_ROUTER "factory()" --rpc-url $PUSH_RPC_URL
# Should return: $UNIV2_FACTORY

cast call $UNIV2_ROUTER "WETH()" --rpc-url $PUSH_RPC_URL  
# Should return: $WETH9_ADDRESS
```

## Factory Constructor Parameters

```solidity
constructor(
    address _feeToSetter,           // Who can set fee recipient
    address _launchpad,             // Launchpad contract (can be 0x0 initially)
    address _launchpadLp,           // LaunchpadLP vault (can be 0x0 initially)
    address _launchpadFeeDistributor // Fee distributor (can be 0x0 initially)
)
```

**Note:** The launchpad addresses can be zero during initial factory deployment. They get used when the factory is called FROM the launchpad to create pairs.

## Integration with Launchpad

When you deploy the launchpad:

```solidity
// Launchpad uses the router
IUniswapV2RouterMinimal uniV2Router;

// Router knows about factory
address factory = uniV2Router.factory();

// When launchpad calls createPair():
// Factory checks: msg.sender == launchpad?
// If yes → pair gets launchpad features
// If no → pair gets zero addresses
```

## File Compatibility Issues

The router files (`PushLaunchpadV2Router1.sol`, `PushLaunchpadV2Router2.sol`) are:
- ✅ Standard Uniswap V2 code
- ⚠️ Solidity 0.6.6 (your project uses 0.8.27)
- ⚠️ Have `@uniswap` imports

### Solutions:

1. **Deploy router separately** using Hardhat with 0.6.6 compiler
2. **Use existing router** if one is already deployed
3. **Upgrade router** to 0.8.27 (requires significant changes)

## Recommended Approach

```
PHASE 1: Deploy Factory
├─ Use: script/DeployUniswapV2.s.sol
├─ Compiler: Solidity 0.8.27 (native to project)
└─ Result: UNIV2_FACTORY address

PHASE 2: Deploy Router  
├─ Option A: Separate Hardhat project with 0.6.6
├─ Option B: Use existing router on Push Chain
└─ Result: UNIV2_ROUTER address

PHASE 3: Deploy Launchpad
├─ Use: script/DeployLaunchpad.s.sol
├─ Needs: UNIV2_ROUTER address
└─ Result: Full system deployed
```

## Next Steps

1. ✅ Deploy `PushLaunchpadV2PairFactory` using forge
2. ⏳ Deploy `UniswapV2Router02` using Hardhat or use existing
3. ⏳ Update `.env` with both addresses
4. ⏳ Deploy launchpad system

## Testing

After deployment:

```bash
# Test factory
cast call $UNIV2_FACTORY "allPairsLength()" --rpc-url $PUSH_RPC_URL

# Test router
cast call $UNIV2_ROUTER "factory()" --rpc-url $PUSH_RPC_URL

# Test pair creation (via router)
cast send $UNIV2_ROUTER \
  "addLiquidity(address,address,uint256,uint256,uint256,uint256,address,uint256)" \
  $TOKEN_A $TOKEN_B 1000 1000 0 0 $YOUR_ADDRESS $(date +%s) \
  --rpc-url $PUSH_RPC_URL \
  --private-key $PRIVATE_KEY
```

## Summary

- **Factory**: Deploy with forge (0.8.27) ✅
- **Router**: Deploy separately with Hardhat (0.6.6) or use existing
- **Pair**: Created automatically by factory when needed
- **Launchpad**: Uses router address for operations

The custom factory ensures pairs created BY the launchpad get special features, while maintaining compatibility with standard Uniswap V2 routers.
