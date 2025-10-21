const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * V3 COMPLETE DEPLOYMENT
 * Push Chain Launchpad - V3 System Deployment
 * 
 * Deploys the entire V3 system including:
 * - ERC1967Factory (for proxy deployments)
 * - Distributor
 * - Launchpad (Implementation + Proxy) - V3 Compatible
 * - SimpleBondingCurve
 * - LaunchpadLPVault (Implementation + Proxy) - V3 NFT Compatible
 * 
 * Uses existing Push-Swap V3 contracts:
 * - V3 Factory
 * - Position Manager
 * - Swap Router
 * - WPC (Wrapped Push Coin)
 */

async function main() {
    console.log("╔════════════════════════════════════════════════════════════╗");
    console.log("║  Push Chain Launchpad V3 - Complete Deployment            ║");
    console.log("║  Using Push-Swap V3 Infrastructure                         ║");
    console.log("╚════════════════════════════════════════════════════════════╝\n");

    const [deployer] = await hre.ethers.getSigners();
    console.log("👤 Deploying with account:", deployer.address);

    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log("💰 Account balance:", hre.ethers.formatEther(balance), "PUSH");

    if (balance < hre.ethers.parseEther("0.5")) {
        console.warn("⚠️  Warning: Low balance! You may need more PUSH tokens.");
        console.warn("   Estimated cost: ~0.3-0.5 PUSH\n");
    }
    console.log("");

    // ========================================
    // Configuration - Push Chain Testnet V3
    // ========================================
    const V3_FACTORY = "0x81b8Bca02580C7d6b636051FDb7baAC436bFb454";
    const V3_POSITION_MANAGER = "0xf9b3ac66aed14A2C7D9AA7696841aB6B27a6231e";
    const V3_SWAP_ROUTER = "0x5D548bB9E305AAe0d6dc6e6fdc3ab419f6aC0037";
    const WPC = "0xE17DD2E0509f99E9ee9469Cf6634048Ec5a3ADe9";

    const GRADUATION_FEE_TIER = 500; // 0.05%
    const VIRTUAL_BASE = hre.ethers.parseEther("200000000"); // 200M tokens
    const VIRTUAL_QUOTE = hre.ethers.parseEther("10"); // 10 WPC

    console.log("⚙️  V3 Configuration:");
    console.log("   V3 Factory:", V3_FACTORY);
    console.log("   Position Manager:", V3_POSITION_MANAGER);
    console.log("   Swap Router:", V3_SWAP_ROUTER);
    console.log("   WPC (Quote Asset):", WPC);
    console.log("   Graduation Fee Tier:", GRADUATION_FEE_TIER, "(0.05%)");
    console.log("   Virtual Base:", hre.ethers.formatEther(VIRTUAL_BASE), "tokens");
    console.log("   Virtual Quote:", hre.ethers.formatEther(VIRTUAL_QUOTE), "WPC\n");

    const deployedAddresses = {
        deployer: deployer.address,
        network: "Push Chain Testnet",
        chainId: 42101,
        timestamp: new Date().toISOString(),
        v3Integration: {
            factory: V3_FACTORY,
            positionManager: V3_POSITION_MANAGER,
            swapRouter: V3_SWAP_ROUTER,
            wpc: WPC,
            feeTier: GRADUATION_FEE_TIER
        }
    };

    try {
        // ========================================
        // STEP 1: Deploy ERC1967Factory
        // ========================================
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("🏭 STEP 1: Deploying ERC1967Factory");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

        const ERC1967Factory = await hre.ethers.getContractFactory("ERC1967Factory");
        const factory = await ERC1967Factory.deploy();
        await factory.waitForDeployment();
        const factoryAddress = await factory.getAddress();
        deployedAddresses.ERC1967Factory = factoryAddress;

        console.log("✅ ERC1967Factory:", factoryAddress);
        console.log("");

        // ========================================
        // STEP 2: Deploy Distributor
        // ========================================
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("📊 STEP 2: Deploying Distributor");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

        const Distributor = await hre.ethers.getContractFactory("Distributor");
        const distributor = await Distributor.deploy();
        await distributor.waitForDeployment();
        const distributorAddress = await distributor.getAddress();
        deployedAddresses.Distributor = distributorAddress;

        console.log("✅ Distributor:", distributorAddress);
        console.log("");

        // ========================================
        // STEP 3: Deploy Launchpad Implementation
        // ========================================
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("🚀 STEP 3: Deploying Launchpad Implementation (V3)");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

        const Launchpad = await hre.ethers.getContractFactory("Launchpad");
        const launchpadImpl = await Launchpad.deploy(
            V3_POSITION_MANAGER,
            V3_SWAP_ROUTER,
            distributorAddress
        );
        await launchpadImpl.waitForDeployment();
        const launchpadImplAddress = await launchpadImpl.getAddress();
        deployedAddresses.LaunchpadImplementation = launchpadImplAddress;

        console.log("✅ Launchpad Implementation:", launchpadImplAddress);
        console.log("");

        // ========================================
        // STEP 4: Deploy Launchpad Proxy
        // ========================================
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("🔗 STEP 4: Deploying Launchpad Proxy");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

        const deployTx = await factory.deploy(launchpadImplAddress, deployer.address);
        const receipt = await deployTx.wait();

        // Get proxy address from Deployed event
        const deployedEvent = receipt.logs.find(log => {
            try {
                const parsed = factory.interface.parseLog(log);
                return parsed.name === "Deployed";
            } catch (e) {
                return false;
            }
        });

        const launchpadProxyAddress = deployedEvent.args.proxy;
        deployedAddresses.LaunchpadProxy = launchpadProxyAddress;

        console.log("✅ Launchpad Proxy:", launchpadProxyAddress);
        console.log("");

        const launchpad = await hre.ethers.getContractAt("Launchpad", launchpadProxyAddress);

        // ========================================
        // STEP 5: Initialize Distributor
        // ========================================
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("⚡ STEP 5: Initializing Distributor");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

        const initDistributorTx = await distributor.initialize(launchpadProxyAddress);
        await initDistributorTx.wait();

        console.log("✅ Distributor initialized with Launchpad:", launchpadProxyAddress);
        console.log("");

        // ========================================
        // STEP 6: Deploy Bonding Curve
        // ========================================
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("📈 STEP 6: Deploying SimpleBondingCurve");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

        const SimpleBondingCurve = await hre.ethers.getContractFactory("SimpleBondingCurve");
        const bondingCurve = await SimpleBondingCurve.deploy(launchpadProxyAddress);
        await bondingCurve.waitForDeployment();
        const bondingCurveAddress = await bondingCurve.getAddress();
        deployedAddresses.SimpleBondingCurve = bondingCurveAddress;

        console.log("✅ SimpleBondingCurve:", bondingCurveAddress);
        console.log("");

        // ========================================
        // STEP 7: Deploy LaunchpadLPVault Implementation
        // ========================================
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("🏦 STEP 7: Deploying LaunchpadLPVault Implementation");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

        const LaunchpadLPVault = await hre.ethers.getContractFactory("LaunchpadLPVault");
        const vaultImpl = await LaunchpadLPVault.deploy();
        await vaultImpl.waitForDeployment();
        const vaultImplAddress = await vaultImpl.getAddress();
        deployedAddresses.VaultImplementation = vaultImplAddress;

        console.log("✅ Vault Implementation:", vaultImplAddress);
        console.log("");

        // ========================================
        // STEP 8: Deploy LaunchpadLPVault Proxy
        // ========================================
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("🔗 STEP 8: Deploying LaunchpadLPVault Proxy");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

        const deployVaultTx = await factory.deploy(vaultImplAddress, deployer.address);
        const vaultReceipt = await deployVaultTx.wait();

        const vaultDeployedEvent = vaultReceipt.logs.find(log => {
            try {
                const parsed = factory.interface.parseLog(log);
                return parsed.name === "Deployed";
            } catch (e) {
                return false;
            }
        });

        const vaultProxyAddress = vaultDeployedEvent.args.proxy;
        deployedAddresses.VaultProxy = vaultProxyAddress;

        console.log("✅ Vault Proxy:", vaultProxyAddress);
        console.log("");

        const vault = await hre.ethers.getContractAt("LaunchpadLPVault", vaultProxyAddress);

        // ========================================
        // STEP 9: Initialize Vault
        // ========================================
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("⚡ STEP 9: Initializing LaunchpadLPVault");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

        const initVaultTx = await vault.initialize(
            launchpadProxyAddress,
            V3_POSITION_MANAGER,
            deployer.address
        );
        await initVaultTx.wait();

        console.log("✅ Vault initialized");
        console.log("   Launchpad:", launchpadProxyAddress);
        console.log("   Position Manager:", V3_POSITION_MANAGER);
        console.log("   Owner:", deployer.address);
        console.log("");

        // ========================================
        // STEP 10: Initialize Launchpad
        // ========================================
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("⚡ STEP 10: Initializing Launchpad");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

        // Encode bonding curve parameters
        const bondingCurveParams = hre.ethers.AbiCoder.defaultAbiCoder().encode(
            ["uint256", "uint256"],
            [VIRTUAL_BASE, VIRTUAL_QUOTE]
        );

        const initLaunchpadTx = await launchpad.initialize(
            deployer.address,      // owner
            WPC,                   // quoteAsset
            bondingCurveAddress,   // bondingCurve
            vaultProxyAddress,     // vault
            GRADUATION_FEE_TIER,   // graduationFeeTier
            bondingCurveParams     // bondingCurveParams
        );
        await initLaunchpadTx.wait();

        console.log("✅ Launchpad initialized");
        console.log("   Owner:", deployer.address);
        console.log("   Quote Asset (WPC):", WPC);
        console.log("   Bonding Curve:", bondingCurveAddress);
        console.log("   Vault:", vaultProxyAddress);
        console.log("   Fee Tier:", GRADUATION_FEE_TIER);
        console.log("");

        // ========================================
        // Deployment Summary
        // ========================================
        console.log("╔════════════════════════════════════════════════════════════╗");
        console.log("║            DEPLOYMENT SUMMARY - V3 PUSH CHAIN              ║");
        console.log("╚════════════════════════════════════════════════════════════╝\n");

        console.log("📋 Core Contracts:");
        console.log("   ERC1967Factory:      ", factoryAddress);
        console.log("   Distributor:         ", distributorAddress);
        console.log("   Launchpad Impl:      ", launchpadImplAddress);
        console.log("   Launchpad Proxy:     ", launchpadProxyAddress, "← MAIN CONTRACT");
        console.log("   Bonding Curve:       ", bondingCurveAddress);
        console.log("   Vault Impl:          ", vaultImplAddress);
        console.log("   Vault Proxy:         ", vaultProxyAddress);
        console.log("");

        console.log("🔗 V3 Integration:");
        console.log("   Position Manager:    ", V3_POSITION_MANAGER);
        console.log("   Swap Router:         ", V3_SWAP_ROUTER);
        console.log("   V3 Factory:          ", V3_FACTORY);
        console.log("   Quote Asset (WPC):   ", WPC);
        console.log("   Fee Tier:            ", GRADUATION_FEE_TIER, "(0.05%)");
        console.log("");

        console.log("⚙️  Configuration:");
        console.log("   Owner:               ", deployer.address);
        console.log("   Virtual Base:        ", hre.ethers.formatEther(VIRTUAL_BASE), "tokens");
        console.log("   Virtual Quote:       ", hre.ethers.formatEther(VIRTUAL_QUOTE), "WPC");
        console.log("");

        // ========================================
        // Save Deployment Data
        // ========================================
        const deploymentsDir = path.join(__dirname, "../deployments");
        if (!fs.existsSync(deploymentsDir)) {
            fs.mkdirSync(deploymentsDir, { recursive: true });
        }

        const filename = `v3_deployment_${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
        const filepath = path.join(deploymentsDir, filename);

        fs.writeFileSync(filepath, JSON.stringify(deployedAddresses, null, 2));

        console.log("💾 Deployment data saved to:", filename);
        console.log("");

        console.log("╔════════════════════════════════════════════════════════════╗");
        console.log("║          DEPLOYMENT COMPLETE - READY TO USE! 🎉            ║");
        console.log("╚════════════════════════════════════════════════════════════╝");

    } catch (error) {
        console.error("\n❌ Deployment failed!");
        console.error(error);
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
