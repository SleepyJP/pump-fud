// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {PumpFudLeaderboard} from "../src/PumpFudLeaderboard.sol";

/**
 * @title DeployLeaderboard
 * @notice Deploys PumpFudLeaderboard to PulseChain
 * @dev Run: forge script script/DeployLeaderboard.s.sol:DeployLeaderboard --rpc-url pulsechain --broadcast --verify
 */
contract DeployLeaderboard is Script {
    // Existing PumpFud contract on PulseChain
    address constant PUMP_FUD = 0x7e65383639d8418E826a78a2f5C784cd4Bdb92D7;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        console.log("Deploying PumpFudLeaderboard to PulseChain...");
        console.log("PumpFud contract:", PUMP_FUD);

        vm.startBroadcast(deployerPrivateKey);

        PumpFudLeaderboard leaderboard = new PumpFudLeaderboard(PUMP_FUD);

        vm.stopBroadcast();

        console.log("========================================");
        console.log("PumpFudLeaderboard deployed to:", address(leaderboard));
        console.log("========================================");
        console.log("");
        console.log("Update wagmi.ts with:");
        console.log("export const LEADERBOARD_ADDRESS = '%s' as const", address(leaderboard));
        console.log("");
        console.log("IMPORTANT: Call setPumpFud() on main contract if needed");
        console.log("to enable automatic trade recording to leaderboard.");
    }
}
