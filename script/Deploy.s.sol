// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {PumpFud} from "../src/PumpFud.sol";

/**
 * @title DeployPumpFud
 * @notice Deploy PumpFud bonding curve launchpad to PulseChain
 *
 * TESTNET DEPLOYMENT:
 * forge script script/Deploy.s.sol:DeployPumpFud --rpc-url pulsechain_testnet --broadcast
 *
 * MAINNET DEPLOYMENT:
 * forge script script/Deploy.s.sol:DeployPumpFud --rpc-url pulsechain --broadcast --verify
 *
 * PARAMETERS (1/4 pump.tires):
 * - Graduation: 50,000,000 PLS
 * - Max Supply: 250,000,000 tokens
 * - Burn: 20% to dead address
 * - PulseX V2 LP: 10%
 * - Creator Reward: 1%
 */
contract DeployPumpFud is Script {
    address constant TREASURY = 0x49bBEFa1d94702C0e9a5EAdDEc7c3C5D3eb9086B;
    address constant WFUD = 0xa59A460B9bd6Db7b167e7082Df3C9D87EeBc9825; // Platform token

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console2.log("=======================================");
        console2.log("PUMP.FUD DEPLOYMENT");
        console2.log("=======================================");
        console2.log("Deploying from:", deployer);
        console2.log("Treasury:", TREASURY);
        console2.log("Platform Token (wFUD):", WFUD);
        console2.log("Chain ID:", block.chainid);

        vm.startBroadcast(deployerPrivateKey);

        PumpFud pumpFud = new PumpFud(TREASURY);

        console2.log("");
        console2.log("PumpFud deployed at:", address(pumpFud));
        console2.log("");

        // Verify 1/4 pump.tires parameters
        console2.log("=======================================");
        console2.log("PARAMETERS (1/4 pump.tires) - ALL ADJUSTABLE");
        console2.log("=======================================");
        console2.log("graduationThreshold:", pumpFud.graduationThreshold() / 1e18, "PLS");
        console2.log("maxSupply:", pumpFud.maxSupply() / 1e18, "tokens");
        console2.log("virtualPlsReserves:", pumpFud.virtualPlsReserves() / 1e18, "PLS");
        console2.log("virtualTokenReserves:", pumpFud.virtualTokenReserves() / 1e18, "tokens");
        console2.log("");
        console2.log("=======================================");
        console2.log("GRADUATION ALLOCATIONS - ALL ADJUSTABLE");
        console2.log("=======================================");
        console2.log("burnBps:", pumpFud.burnBps(), "bps (20%)");
        console2.log("pulseXLpBps:", pumpFud.pulseXLpBps(), "bps (10%)");
        console2.log("paisleyLpBps:", pumpFud.paisleyLpBps(), "bps (0%)");
        console2.log("successRewardBps:", pumpFud.successRewardBps(), "bps (5%)");

        vm.stopBroadcast();

        console2.log("");
        console2.log("=======================================");
        console2.log("DEPLOYMENT COMPLETE");
        console2.log("=======================================");
        console2.log("PumpFud:", address(pumpFud));
        console2.log("");
        console2.log("Next steps:");
        console2.log("1. Verify contract on PulseScan");
        console2.log("2. Configure frontend");
        console2.log("3. Set launch fee if desired (default 0)");
        console2.log("=======================================");
    }
}

/**
 * @title ConfigurePumpFud
 * @notice Configure existing PumpFud deployment
 */
contract ConfigurePumpFud is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address pumpFudAddress = vm.envAddress("PUMP_FUD_ADDRESS");

        PumpFud pumpFud = PumpFud(payable(pumpFudAddress));

        console2.log("Configuring PumpFud at:", pumpFudAddress);

        vm.startBroadcast(deployerPrivateKey);

        // Optional: Set launch fee (in PLS)
        // pumpFud.setLaunchFee(0);

        // Optional: Set trading fee (in basis points, max 500 = 5%)
        // pumpFud.setTradingFee(100); // 1%

        vm.stopBroadcast();

        console2.log("Configuration complete");
    }
}
