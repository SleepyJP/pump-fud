// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {PumpFudV2} from "../src/PumpFudV2.sol";

/**
 * @title DeployPumpFudV2
 * @notice Deploy PumpFudV2 bonding curve launchpad to PulseChain
 *
 * MAINNET DEPLOYMENT:
 * forge script script/DeployPumpFudV2.s.sol:DeployPumpFudV2 --rpc-url https://rpc.pulsechain.com --broadcast --verify
 *
 * TOKENOMICS (1/4 Pump.Tires Scale):
 * - Total Supply: 250,000,000 tokens
 * - Bonding Supply: 200,000,000 tokens (80%)
 * - LP Reserve: 50,000,000 tokens (20%)
 * - Graduation Target: 50,000,000 PLS
 *
 * GRADUATION EVENT:
 * - Burn: 10,000,000 PLS (20%)
 * - LP: 40,000,000 PLS + 50,000,000 tokens (50/50 PulseX V1/PulseX V2)
 * - Creator Reward: 1% (500,000 PLS)
 *
 * FEES:
 * - Creation: 100 PLS
 * - Buy: 1.00% (50/50 treasury/referrer)
 * - Sell: 1.22% (50/50 treasury/referrer)
 */
contract DeployPumpFudV2 is Script {
    // Treasury
    address constant TREASURY = 0x49bBEFa1d94702C0e9a5EAdDEc7c3C5D3eb9086B;

    // Existing contracts
    address constant EXISTING_PUMP_FUD_TOKEN = 0x7e65383639d8418E826a78a2f5C784cd4Bdb92D7;
    address constant EXISTING_LEADERBOARD = 0xAe213e8aFBf7d76667332092f817589fdaB68EC2;

    // DEX Routers
    address constant PULSEX_V2_ROUTER = 0x165C3410fC91EF562C50559f7d2289fEbed552d9;
    address constant PULSEX_V1_ROUTER = 0x98bf93ebf5c380C0e6Ae8e192A7e2AE08edAcc02;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console2.log("=======================================");
        console2.log("PUMP.FUD V2 DEPLOYMENT");
        console2.log("=======================================");
        console2.log("Deploying from:", deployer);
        console2.log("Treasury:", TREASURY);
        console2.log("Chain ID:", block.chainid);
        console2.log("");

        vm.startBroadcast(deployerPrivateKey);

        PumpFudV2 pumpFudV2 = new PumpFudV2();

        // Set leaderboard if needed
        pumpFudV2.setLeaderboard(EXISTING_LEADERBOARD);

        vm.stopBroadcast();

        console2.log("=======================================");
        console2.log("TOKENOMICS");
        console2.log("=======================================");
        console2.log("Total Supply: 250,000,000 tokens");
        console2.log("Bonding Supply: 200,000,000 tokens (80%)");
        console2.log("LP Reserve: 50,000,000 tokens (20%)");
        console2.log("Graduation Target: 50,000,000 PLS");
        console2.log("");

        console2.log("=======================================");
        console2.log("GRADUATION ALLOCATION");
        console2.log("=======================================");
        console2.log("PLS Burn: 10,000,000 PLS (20%)");
        console2.log("PLS to LP: 40,000,000 PLS (80%)");
        console2.log("Creator Reward: 1% (500,000 PLS)");
        console2.log("");

        console2.log("=======================================");
        console2.log("FEES");
        console2.log("=======================================");
        console2.log("Creation Fee: 100 PLS");
        console2.log("Buy Fee: 1.00% (100 bps)");
        console2.log("Sell Fee: 1.22% (122 bps)");
        console2.log("");

        console2.log("=======================================");
        console2.log("DEPLOYMENT COMPLETE");
        console2.log("=======================================");
        console2.log("PumpFudV2:", address(pumpFudV2));
        console2.log("");
        console2.log("Existing Contracts:");
        console2.log("- PumpFud Token:", EXISTING_PUMP_FUD_TOKEN);
        console2.log("- Leaderboard:", EXISTING_LEADERBOARD);
        console2.log("");
        console2.log("DEX Routers:");
        console2.log("- PulseX V2:", PULSEX_V2_ROUTER);
        console2.log("- PulseX V1 (secondary):", pumpFudV2.secondaryRouter());
        console2.log("");
        console2.log("Frontend: https://frontend-two-zeta-86.vercel.app");
        console2.log("=======================================");
    }
}
