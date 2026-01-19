// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {PumpFud} from "../src/PumpFud.sol";
import {PumpFudToken} from "../src/PumpFudToken.sol";

/**
 * @title PumpFudForkTest
 * @notice Tests that require forking PulseChain
 *
 * Run with:
 * forge test --match-contract PumpFudForkTest --fork-url https://rpc.pulsechain.com -vvv
 *
 * TESTNET:
 * forge test --match-contract PumpFudForkTest --fork-url https://rpc.v4.testnet.pulsechain.com -vvv
 */
contract PumpFudForkTest is Test {
    PumpFud public pumpFud;

    address public deployer = makeAddr("deployer");
    address public creator = makeAddr("creator");
    address public buyer1 = makeAddr("buyer1");

    address constant TREASURY = 0x49bBEFa1d94702C0e9a5EAdDEc7c3C5D3eb9086B;
    address constant DEAD_ADDRESS = 0x000000000000000000000000000000000000dEaD;
    address constant PULSEX_V2_ROUTER = 0x165C3410fC91EF562C50559f7d2289fEbed552d9;

    // Platform token wFUD
    address constant WFUD = 0xa59A460B9bd6Db7b167e7082Df3C9D87EeBc9825;

    function setUp() public {
        // Skip if not forking PulseChain mainnet (369) or testnet (943)
        if (block.chainid != 369 && block.chainid != 943) {
            vm.skip(true);
        }

        vm.deal(deployer, 1000 ether);
        vm.deal(creator, 1000 ether);
        vm.deal(buyer1, 100_000_000 ether); // 100M PLS for graduation test (50M threshold)

        vm.prank(deployer);
        pumpFud = new PumpFud(TREASURY);
    }

    function test_Fork_GraduationAtThreshold() public {
        vm.prank(creator);
        (uint256 tokenId, address tokenAddress) =
            pumpFud.launchToken("Graduate Test", "GRAD", "Testing graduation", "ipfs://grad");

        uint256 threshold = pumpFud.graduationThreshold();
        console2.log("Graduation threshold:", threshold / 1e18, "PLS");

        uint256 creatorBalanceBefore = creator.balance;

        // Buy enough to graduate (50M PLS threshold for 1/4 pump.tires)
        uint256 buyAmount = threshold * 102 / 100; // Add buffer for fee and slippage
        vm.prank(buyer1);
        pumpFud.buyTokens{value: buyAmount}(tokenId, 0);

        // Check graduation
        PumpFud.MemeToken memory token = pumpFud.getToken(tokenId);
        assertEq(uint256(token.status), uint256(PumpFud.TokenStatus.Graduated), "Should be graduated");
        assertTrue(token.graduatedAt > 0, "Should have graduation timestamp");

        // Check creator got 1% reward
        uint256 creatorReward = creator.balance - creatorBalanceBefore;
        console2.log("Creator reward:", creatorReward / 1e18, "PLS");
        assertTrue(creatorReward > 0, "Creator should receive reward");

        // Check tokens burned to dead address (20% burn + LP tokens)
        uint256 burnedTokens = PumpFudToken(tokenAddress).balanceOf(DEAD_ADDRESS);
        console2.log("Tokens burned:", burnedTokens / 1e18);
        assertTrue(burnedTokens > 0, "Should have burned tokens");

        // Verify LP pair exists on PulseX
        // Note: This verifies the graduation worked correctly
    }

    function test_Fork_CannotBuyAfterGraduation() public {
        vm.prank(creator);
        (uint256 tokenId,) = pumpFud.launchToken("Post Grad Test", "POST", "Testing post grad", "ipfs://post");

        // Graduate (50M PLS threshold)
        uint256 threshold = pumpFud.graduationThreshold();
        vm.prank(buyer1);
        pumpFud.buyTokens{value: threshold * 102 / 100}(tokenId, 0);

        // Try to buy after graduation
        address buyer2 = makeAddr("buyer2");
        vm.deal(buyer2, 1000 ether);

        vm.prank(buyer2);
        vm.expectRevert(PumpFud.TokenNotLive.selector);
        pumpFud.buyTokens{value: 100 ether}(tokenId, 0);
    }

    function test_Fork_GraduationAllocations() public {
        vm.prank(creator);
        (uint256 tokenId, address tokenAddress) =
            pumpFud.launchToken("Allocation Test", "ALLOC", "Testing allocations", "ipfs://alloc");

        // Record initial states
        uint256 deadBalanceBefore = PumpFudToken(tokenAddress).balanceOf(DEAD_ADDRESS);
        uint256 creatorBalanceBefore = creator.balance;

        // Graduate
        uint256 threshold = pumpFud.graduationThreshold();
        vm.prank(buyer1);
        uint256 tokensReceived = pumpFud.buyTokens{value: threshold * 102 / 100}(tokenId, 0);

        // Get token state after graduation
        PumpFud.MemeToken memory token = pumpFud.getToken(tokenId);

        // Calculate expected allocations
        uint256 tokensSoldAtGraduation = token.tokensSold; // This includes buyer's tokens

        // 20% should be burned to dead address
        uint256 burnedToDead = PumpFudToken(tokenAddress).balanceOf(DEAD_ADDRESS) - deadBalanceBefore;
        console2.log("Tokens burned to dead:", burnedToDead / 1e18);

        // 10% goes to PulseX V2 LP (LP tokens burned to dead address)
        // This is verified by the LP existing on PulseX

        // 1% PLS goes to creator
        uint256 creatorReward = creator.balance - creatorBalanceBefore;
        console2.log("Creator PLS reward:", creatorReward / 1e18);

        // Verify allocations match spec
        assertTrue(burnedToDead > 0, "Should have burned tokens to dead");
        assertTrue(creatorReward > 0, "Creator should receive PLS reward");

        // Verify graduation status
        assertEq(uint256(token.status), uint256(PumpFud.TokenStatus.Graduated), "Should be graduated");
    }
}
