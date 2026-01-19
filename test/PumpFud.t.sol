// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {PumpFud} from "../src/PumpFud.sol";
import {PumpFudToken} from "../src/PumpFudToken.sol";

contract PumpFudTest is Test {
    PumpFud public pumpFud;

    address public deployer = makeAddr("deployer");
    address public creator = makeAddr("creator");
    address public buyer1 = makeAddr("buyer1");
    address public buyer2 = makeAddr("buyer2");

    address constant TREASURY = 0x49bBEFa1d94702C0e9a5EAdDEc7c3C5D3eb9086B;
    address constant DEAD_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    function setUp() public {
        vm.deal(deployer, 1000 ether);
        vm.deal(creator, 1000 ether);
        vm.deal(buyer1, 100_000_000 ether); // 100M PLS for testing graduation (50M threshold)
        vm.deal(buyer2, 1_000_000 ether);

        vm.prank(deployer);
        pumpFud = new PumpFud(TREASURY);
    }

    function test_LaunchToken() public {
        vm.prank(creator);
        (uint256 tokenId, address tokenAddress) =
            pumpFud.launchToken("Test Token", "TEST", "A test meme token", "ipfs://test-image");

        assertEq(tokenId, 1);
        assertTrue(tokenAddress != address(0));

        PumpFud.MemeToken memory token = pumpFud.getToken(tokenId);
        assertEq(token.name, "Test Token");
        assertEq(token.symbol, "TEST");
        assertEq(token.creator, creator);
        assertEq(uint256(token.status), uint256(PumpFud.TokenStatus.Live));
    }

    function test_BuyTokens() public {
        // Launch token
        vm.prank(creator);
        (uint256 tokenId, address tokenAddress) =
            pumpFud.launchToken("Buy Test", "BUY", "Testing buy", "ipfs://buy");

        // Calculate expected tokens
        uint256 buyAmount = 1000 ether;
        uint256 expectedTokens = pumpFud.calculateBuyAmount(tokenId, buyAmount * 99 / 100); // After 1% fee

        // Buy tokens
        vm.prank(buyer1);
        uint256 tokensReceived = pumpFud.buyTokens{value: buyAmount}(tokenId, 0);

        assertTrue(tokensReceived > 0);
        assertEq(PumpFudToken(tokenAddress).balanceOf(buyer1), tokensReceived);

        // Check reserve increased
        PumpFud.MemeToken memory token = pumpFud.getToken(tokenId);
        assertTrue(token.reserveBalance > 0);
    }

    function test_SellTokens() public {
        // Launch and buy
        vm.prank(creator);
        (uint256 tokenId, address tokenAddress) = pumpFud.launchToken("Sell Test", "SELL", "Testing sell", "ipfs://sell");

        vm.prank(buyer1);
        uint256 tokensReceived = pumpFud.buyTokens{value: 10000 ether}(tokenId, 0);

        // Approve and sell half
        uint256 sellAmount = tokensReceived / 2;
        uint256 expectedPls = pumpFud.calculateSellAmount(tokenId, sellAmount);

        uint256 balanceBefore = buyer1.balance;

        vm.prank(buyer1);
        uint256 plsReceived = pumpFud.sellTokens(tokenId, sellAmount, 0);

        assertTrue(plsReceived > 0);
        assertEq(buyer1.balance, balanceBefore + plsReceived);
        assertEq(PumpFudToken(tokenAddress).balanceOf(buyer1), tokensReceived - sellAmount);
    }

    function test_PriceIncreases() public {
        vm.prank(creator);
        (uint256 tokenId,) = pumpFud.launchToken("Price Test", "PRICE", "Testing price", "ipfs://price");

        uint256 priceBefore = pumpFud.getCurrentPrice(tokenId);

        // Buy to increase price
        vm.prank(buyer1);
        pumpFud.buyTokens{value: 100000 ether}(tokenId, 0);

        uint256 priceAfter = pumpFud.getCurrentPrice(tokenId);

        assertTrue(priceAfter > priceBefore, "Price should increase after buy");
    }

    function test_GraduationAtThreshold() public {
        // Skip if not forking PulseChain (graduation calls PulseX)
        if (block.chainid != 369 && block.chainid != 943) {
            vm.skip(true);
        }

        vm.prank(creator);
        (uint256 tokenId, address tokenAddress) =
            pumpFud.launchToken("Graduate Test", "GRAD", "Testing graduation", "ipfs://grad");

        // Get graduation threshold (50M PLS for 1/4 pump.tires)
        uint256 threshold = pumpFud.graduationThreshold();
        console2.log("Graduation threshold:", threshold / 1e18, "PLS");

        // Buy enough to graduate - need to account for 1% fee
        uint256 buyAmount = threshold * 102 / 100; // Add buffer for fee and slippage

        uint256 creatorBalanceBefore = creator.balance;

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

        // Check tokens burned to dead address (20% + 10% LP tokens)
        uint256 burnedTokens = PumpFudToken(tokenAddress).balanceOf(DEAD_ADDRESS);
        console2.log("Tokens burned:", burnedTokens / 1e18);
        assertTrue(burnedTokens > 0, "Should have burned tokens");
    }

    function test_SlippageProtection() public {
        vm.prank(creator);
        (uint256 tokenId,) = pumpFud.launchToken("Slippage Test", "SLIP", "Testing slippage", "ipfs://slip");

        // Try to buy with unrealistic minimum
        vm.prank(buyer1);
        vm.expectRevert(PumpFud.SlippageExceeded.selector);
        pumpFud.buyTokens{value: 100 ether}(tokenId, type(uint256).max);
    }

    function test_CannotBuyAfterGraduation() public {
        // Skip if not forking PulseChain (graduation calls PulseX)
        if (block.chainid != 369 && block.chainid != 943) {
            vm.skip(true);
        }

        vm.prank(creator);
        (uint256 tokenId,) = pumpFud.launchToken("Post Grad Test", "POST", "Testing post grad", "ipfs://post");

        // Graduate (50M PLS threshold)
        uint256 threshold = pumpFud.graduationThreshold();
        vm.prank(buyer1);
        pumpFud.buyTokens{value: threshold * 102 / 100}(tokenId, 0);

        // Try to buy after graduation
        vm.prank(buyer2);
        vm.expectRevert(PumpFud.TokenNotLive.selector);
        pumpFud.buyTokens{value: 100 ether}(tokenId, 0);
    }

    function test_FeesToTreasury() public {
        vm.prank(creator);
        (uint256 tokenId,) = pumpFud.launchToken("Fee Test", "FEE", "Testing fees", "ipfs://fee");

        uint256 treasuryBalanceBefore = TREASURY.balance;

        vm.prank(buyer1);
        pumpFud.buyTokens{value: 10000 ether}(tokenId, 0);

        uint256 treasuryBalanceAfter = TREASURY.balance;
        uint256 feesCollected = treasuryBalanceAfter - treasuryBalanceBefore;

        // 1% of 10000 = 100 PLS
        assertEq(feesCollected, 100 ether, "Should collect 1% fee");
    }

    function test_BondingCurveMath() public {
        vm.prank(creator);
        (uint256 tokenId,) = pumpFud.launchToken("Math Test", "MATH", "Testing math", "ipfs://math");

        // Test initial state
        uint256 initialPrice = pumpFud.getCurrentPrice(tokenId);
        console2.log("Initial price:", initialPrice);

        // Virtual reserves check (1/4 pump.tires parameters)
        uint256 virtualPls = pumpFud.virtualPlsReserves();
        uint256 virtualTokens = pumpFud.virtualTokenReserves();
        console2.log("Virtual PLS:", virtualPls / 1e18);
        console2.log("Virtual Tokens:", virtualTokens / 1e18);

        // Expected initial price = virtualPls / virtualTokens
        uint256 expectedPrice = (virtualPls * 1e18) / virtualTokens;
        assertEq(initialPrice, expectedPrice, "Initial price should match");

        // Buy and check price increases
        vm.prank(buyer1);
        pumpFud.buyTokens{value: 1_000_000 ether}(tokenId, 0);

        uint256 newPrice = pumpFud.getCurrentPrice(tokenId);
        assertTrue(newPrice > initialPrice, "Price should increase");
        console2.log("New price after 1M PLS buy:", newPrice);
    }

    function test_GraduationAllocations() public {
        vm.prank(creator);
        (uint256 tokenId, address tokenAddress) =
            pumpFud.launchToken("Allocation Test", "ALLOC", "Testing allocations", "ipfs://alloc");

        // Get graduation parameters
        uint256 burnBps = pumpFud.burnBps();
        uint256 pulseXLpBps = pumpFud.pulseXLpBps();
        uint256 paisleyLpBps = pumpFud.paisleyLpBps();
        uint256 successRewardBps = pumpFud.successRewardBps();

        console2.log("BURN_BPS (dead address):", burnBps, "(20%)");
        console2.log("PULSEX_LP_BPS:", pulseXLpBps, "(10%)");
        console2.log("PAISLEY_LP_BPS:", paisleyLpBps, "(0%)");
        console2.log("SUCCESS_REWARD_BPS:", successRewardBps, "(5%)");

        // Verify 1/4 pump.tires parameters
        assertEq(burnBps, 2000, "Burn should be 20%");
        assertEq(pulseXLpBps, 1000, "PulseX LP should be 10%");
        assertEq(paisleyLpBps, 0, "Paisley LP should be 0%");
        assertEq(successRewardBps, 500, "Success reward should be 5%");
    }

    function testFuzz_BuyAmount(uint256 plsIn) public {
        plsIn = bound(plsIn, 1 ether, 10_000_000 ether);

        vm.prank(creator);
        (uint256 tokenId,) = pumpFud.launchToken("Fuzz Test", "FUZZ", "Fuzz testing", "ipfs://fuzz");

        uint256 tokensOut = pumpFud.calculateBuyAmount(tokenId, plsIn);
        assertTrue(tokensOut > 0, "Should always get some tokens");
        assertTrue(tokensOut <= pumpFud.maxSupply(), "Should not exceed max supply");
    }
}
