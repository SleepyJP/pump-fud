// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {PumpFud} from "../src/PumpFud.sol";
import {PumpFudArbitrage} from "../src/PumpFudArbitrage.sol";
import {PumpFudToken} from "../src/PumpFudToken.sol";

/**
 * @title PumpFudArbitrageTest
 * @notice Tests for PumpFudArbitrage contract
 *
 * UNIT TESTS (no fork required):
 * - Basic deployment and configuration
 * - Authorization checks
 * - Watchlist management
 *
 * FORK TESTS (requires PulseChain):
 * forge test --match-contract PumpFudArbitrageTest --fork-url https://rpc.pulsechain.com -vvv
 */
contract PumpFudArbitrageTest is Test {
    PumpFud public pumpFud;
    PumpFudArbitrage public arbBot;

    address public deployer = makeAddr("deployer");
    address public bot1 = makeAddr("bot1");
    address public creator = makeAddr("creator");
    address public buyer1 = makeAddr("buyer1");

    address constant TREASURY = 0x49bBEFa1d94702C0e9a5EAdDEc7c3C5D3eb9086B;

    function setUp() public {
        vm.deal(deployer, 1000 ether);
        vm.deal(bot1, 100_000 ether);
        vm.deal(creator, 1000 ether);
        vm.deal(buyer1, 100_000_000 ether);

        vm.startPrank(deployer);
        pumpFud = new PumpFud(TREASURY);
        arbBot = new PumpFudArbitrage(address(pumpFud));
        vm.stopPrank();
    }

    function test_Deployment() public view {
        assertEq(address(arbBot.pumpFud()), address(pumpFud));
        assertEq(arbBot.TREASURY(), TREASURY);
        assertEq(arbBot.minProfitBps(), 25);
        assertEq(arbBot.maxGasPrice(), 100 gwei);
        assertEq(arbBot.maxPositionPls(), 10_000 ether);
    }

    function test_SetBot() public {
        // Not authorized initially
        assertFalse(arbBot.authorizedBots(bot1));

        // Owner can authorize
        vm.prank(deployer);
        arbBot.setBot(bot1, true);
        assertTrue(arbBot.authorizedBots(bot1));

        // Owner can revoke
        vm.prank(deployer);
        arbBot.setBot(bot1, false);
        assertFalse(arbBot.authorizedBots(bot1));
    }

    function test_SetMinProfitBps() public {
        vm.prank(deployer);
        arbBot.setMinProfitBps(50);
        assertEq(arbBot.minProfitBps(), 50);
    }

    function test_SetMaxGasPrice() public {
        vm.prank(deployer);
        arbBot.setMaxGasPrice(200 gwei);
        assertEq(arbBot.maxGasPrice(), 200 gwei);
    }

    function test_SetMaxPositionPls() public {
        vm.prank(deployer);
        arbBot.setMaxPositionPls(50_000 ether);
        assertEq(arbBot.maxPositionPls(), 50_000 ether);
    }

    function test_AddToWatchlist() public {
        // Launch a token
        vm.prank(creator);
        (uint256 tokenId, address tokenAddress) = pumpFud.launchToken("Watch Test", "WATCH", "Testing watchlist", "ipfs://watch");

        // Authorize bot
        vm.prank(deployer);
        arbBot.setBot(bot1, true);

        // Add to watchlist
        vm.prank(bot1);
        arbBot.addToWatchlist(tokenId);

        // Verify
        assertTrue(arbBot.watchedTokens(tokenAddress));
        address[] memory watchList = arbBot.getWatchList();
        assertEq(watchList.length, 1);
        assertEq(watchList[0], tokenAddress);
    }

    function test_OnlyBotCanAddToWatchlist() public {
        vm.prank(creator);
        (uint256 tokenId,) = pumpFud.launchToken("Bot Test", "BOT", "Testing bot access", "ipfs://bot");

        // Non-bot cannot add
        vm.prank(bot1);
        vm.expectRevert(PumpFudArbitrage.NotAuthorized.selector);
        arbBot.addToWatchlist(tokenId);
    }

    function test_ScanNearGraduation() public {
        // Launch tokens
        vm.prank(creator);
        (uint256 tokenId1,) = pumpFud.launchToken("Near Grad 1", "NG1", "Testing near grad", "ipfs://ng1");

        vm.prank(creator);
        (uint256 tokenId2,) = pumpFud.launchToken("Near Grad 2", "NG2", "Testing near grad", "ipfs://ng2");

        // Buy some tokens to increase reserve
        vm.prank(buyer1);
        pumpFud.buyTokens{value: 40_000_000 ether}(tokenId1, 0); // 80% to graduation

        vm.prank(buyer1);
        pumpFud.buyTokens{value: 10_000_000 ether}(tokenId2, 0); // 20% to graduation

        // Scan for tokens at 70%+ to graduation
        uint256[] memory tokenIds = new uint256[](2);
        tokenIds[0] = tokenId1;
        tokenIds[1] = tokenId2;

        (uint256[] memory nearGradIds, uint256[] memory reserves, uint256[] memory percents) =
            arbBot.scanNearGraduation(tokenIds, 70);

        // Only token1 should be near graduation (80%)
        assertEq(nearGradIds.length, 1);
        assertEq(nearGradIds[0], tokenId1);
        assertTrue(percents[0] >= 70);
        console2.log("Token 1 at", percents[0], "% to graduation");
    }

    function test_EmergencyWithdraw() public {
        // Send some PLS to arbBot
        vm.deal(address(arbBot), 100 ether);

        uint256 ownerBalanceBefore = deployer.balance;

        vm.prank(deployer);
        arbBot.emergencyWithdraw(address(0), 50 ether);

        assertEq(deployer.balance, ownerBalanceBefore + 50 ether);
    }

    function test_OnlyOwnerCanEmergencyWithdraw() public {
        vm.deal(address(arbBot), 100 ether);

        vm.prank(bot1);
        vm.expectRevert();
        arbBot.emergencyWithdraw(address(0), 50 ether);
    }
}

/**
 * @title PumpFudArbitrageForkTest
 * @notice Fork tests for PumpFudArbitrage - requires PulseChain RPC
 *
 * Run with:
 * forge test --match-contract PumpFudArbitrageForkTest --fork-url https://rpc.pulsechain.com -vvv
 */
contract PumpFudArbitrageForkTest is Test {
    PumpFud public pumpFud;
    PumpFudArbitrage public arbBot;

    address public deployer = makeAddr("deployer");
    address public bot1 = makeAddr("bot1");
    address public creator = makeAddr("creator");
    address public buyer1 = makeAddr("buyer1");

    address constant TREASURY = 0x49bBEFa1d94702C0e9a5EAdDEc7c3C5D3eb9086B;

    function setUp() public {
        // Skip if not forking PulseChain (369) or testnet (943)
        if (block.chainid != 369 && block.chainid != 943) {
            vm.skip(true);
        }

        vm.deal(deployer, 1000 ether);
        vm.deal(bot1, 100_000 ether);
        vm.deal(creator, 1000 ether);
        vm.deal(buyer1, 100_000_000 ether);

        vm.startPrank(deployer);
        pumpFud = new PumpFud(TREASURY);
        arbBot = new PumpFudArbitrage(address(pumpFud));
        arbBot.setBot(bot1, true);
        vm.stopPrank();
    }

    function test_Fork_CheckBondingCurveArb() public {
        // Launch token
        vm.prank(creator);
        (uint256 tokenId,) = pumpFud.launchToken("Arb Test", "ARB", "Testing arb check", "ipfs://arb");

        // Buy some tokens to create market
        vm.prank(buyer1);
        pumpFud.buyTokens{value: 1_000_000 ether}(tokenId, 0);

        // Check if arb exists (may or may not depending on DEX state)
        (uint256 profit, bool buyOnCurve) = arbBot.checkBondingCurveArb(tokenId, 1000 ether);
        console2.log("Arb profit:", profit / 1e18, "PLS");
        console2.log("Buy on curve:", buyOnCurve);
    }

    function test_Fork_CrossDexArbScan() public {
        // Launch and graduate a token
        vm.prank(creator);
        (uint256 tokenId, address tokenAddress) = pumpFud.launchToken("Scan Test", "SCAN", "Testing scan", "ipfs://scan");

        // Graduate token
        uint256 threshold = pumpFud.graduationThreshold();
        vm.prank(buyer1);
        pumpFud.buyTokens{value: threshold * 102 / 100}(tokenId, 0);

        // Add to watchlist
        vm.prank(bot1);
        arbBot.addToWatchlist(tokenId);

        // Scan for arb opportunities
        (
            address[] memory profitableTokens,
            uint256[] memory profits,
            address[] memory buyRouters,
            address[] memory sellRouters
        ) = arbBot.scanWatchedTokens(1000 ether);

        console2.log("Found", profitableTokens.length, "profitable opportunities");
        for (uint i = 0; i < profitableTokens.length; i++) {
            console2.log("Token:", profitableTokens[i]);
            console2.log("Profit:", profits[i] / 1e18, "PLS");
        }
    }

    function test_Fork_ExecuteCrossDexArb() public {
        // This test will fail if no arb exists, which is expected
        // In production, bot only executes when profitable

        // Launch and graduate token
        vm.prank(creator);
        (uint256 tokenId, address tokenAddress) = pumpFud.launchToken("Exec Test", "EXEC", "Testing exec", "ipfs://exec");

        uint256 threshold = pumpFud.graduationThreshold();
        vm.prank(buyer1);
        pumpFud.buyTokens{value: threshold * 102 / 100}(tokenId, 0);

        // Check if arb exists on any route
        address pulsexV1 = arbBot.PULSEX_V1_ROUTER();
        address pulsexV2 = arbBot.PULSEX_V2_ROUTER();

        (uint256 profit, bool profitable) = arbBot.checkCrossDexArb(tokenAddress, 1000 ether, pulsexV1, pulsexV2);

        if (profitable) {
            console2.log("Executing arb with expected profit:", profit / 1e18, "PLS");

            vm.deal(bot1, 2000 ether);
            vm.prank(bot1);
            uint256 actualProfit = arbBot.executeCrossDexArb{value: 1000 ether}(
                tokenAddress,
                1000 ether,
                pulsexV1,
                pulsexV2,
                profit * 90 / 100 // 10% slippage tolerance
            );

            console2.log("Actual profit:", actualProfit / 1e18, "PLS");
        } else {
            console2.log("No profitable arb found - this is normal");
        }
    }
}
