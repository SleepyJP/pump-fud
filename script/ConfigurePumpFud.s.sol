// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";

interface IPumpFud {
    function setLaunchFee(uint256 _launchFee) external;
    function batchSetFeeWhitelist(address[] calldata accounts, bool whitelisted) external;
    function launchFee() external view returns (uint256);
    function buyFeeBps() external view returns (uint256);
    function sellFeeBps() external view returns (uint256);
    function feeWhitelist(address) external view returns (bool);
    function owner() external view returns (address);
}

/**
 * @title ConfigurePumpFud
 * @notice Configure PumpFud contract: 100K PLS launch fee + whitelist
 *
 * forge script script/ConfigurePumpFud.s.sol:ConfigurePumpFud \
 *   --rpc-url https://rpc.pulsechain.com --broadcast
 */
contract ConfigurePumpFud is Script {
    address constant PUMP_FUD = 0xe2fdd5C6989AAf8aA54f8174b6C2d8572C67F46E;
    uint256 constant LAUNCH_FEE = 100_000 * 1e18;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        IPumpFud pumpfud = IPumpFud(PUMP_FUD);

        console.log("=== PUMP.FUD CONFIG ===");
        console.log("Contract:", PUMP_FUD);
        console.log("Owner:", pumpfud.owner());
        console.log("Caller:", deployer);
        console.log("Current Launch Fee (PLS):", pumpfud.launchFee() / 1e18);

        // Whitelist addresses
        address[] memory whitelist = new address[](5);
        whitelist[0] = 0x49bBEFa1d94702C0e9a5EAdDEc7c3C5D3eb9086B;
        whitelist[1] = 0xa0d254a39Ea8645FFc79A9353c32f02504c5F3e7;
        whitelist[2] = 0x1c3e87796d0D242209C4Cf0354DAbBceb95F2317;
        whitelist[3] = 0xdBDA1341890EFCc30734EEC5d5a462a69a29b0B7;
        whitelist[4] = 0x438052132c9984632532fdBf92bA6C9AA9654a39;

        vm.startBroadcast(deployerPrivateKey);

        console.log("Setting launch fee to 100,000 PLS...");
        pumpfud.setLaunchFee(LAUNCH_FEE);

        console.log("Whitelisting 5 addresses...");
        pumpfud.batchSetFeeWhitelist(whitelist, true);

        vm.stopBroadcast();

        console.log("=== DONE ===");
        console.log("New Launch Fee (PLS):", pumpfud.launchFee() / 1e18);

        for (uint256 i = 0; i < whitelist.length; i++) {
            console.log("Whitelist:", whitelist[i]);
            console.log("  Status:", pumpfud.feeWhitelist(whitelist[i]));
        }
    }
}
