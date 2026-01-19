// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {PumpFudV2} from "../src/PumpFudV2.sol";
import {PumpFudToken} from "../src/PumpFudToken.sol";

/**
 * @title PumpFudV2Test
 * @notice Comprehensive tests for PUMP.FUD bonding curve
 */
contract PumpFudV2Test is Test {
    PumpFudV2 public pumpFud;

    address public constant TREASURY = 0x49bBEFa1d94702C0e9a5EAdDEc7c3C5D3eb9086B;
    address public creator = address(0x1);
    address public buyer = address(0x2);
    address public seller = address(0x3);
    address public referrer = address(0x4);

    uint256 constant CREATION_FEE = 100 ether;
    uint256 constant GRADUATION_TARGET = 50_000_000 ether;
    uint256 constant BONDING_SUPPLY = 200_000_000 ether;
    uint256 constant LP_RESERVE = 50_000_000 ether;

    function setUp() public {
        pumpFud = new PumpFudV2();

        // Fund test accounts
        vm.deal(creator, 1000 ether);
        vm.deal(buyer, 100_000_000 ether);
        vm.deal(seller, 100_000_000 ether);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // TOKEN CREATION TESTS
    // ═══════════════════════════════════════════════════════════════════════════

    function test_CreateToken() public {
        uint256 treasuryBefore = TREASURY.balance;

        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}(
            "Test Token",
            "TEST",
            "ipfs://test"
        );

        assertNotEq(token, address(0), "Token should be created");

        PumpFudV2.TokenData memory data = pumpFud.getTokenData(token);
        assertEq(data.creator, creator, "Creator should match");
        assertEq(data.plsReserve, 0, "Initial reserve should be 0");
        assertEq(data.tokensSold, 0, "Initial tokens sold should be 0");
        assertEq(data.isGraduated, false, "Should not be graduated");

        // Treasury should receive creation fee
        assertEq(TREASURY.balance - treasuryBefore, CREATION_FEE, "Treasury should receive fee");
    }

    function test_CreateToken_RefundsExcess() public {
        uint256 creatorBefore = creator.balance;

        vm.prank(creator);
        pumpFud.createToken{value: CREATION_FEE + 50 ether}(
            "Test Token",
            "TEST",
            "ipfs://test"
        );

        // Creator should only pay creation fee
        assertEq(creatorBefore - creator.balance, CREATION_FEE, "Should only charge creation fee");
    }

    function test_CreateToken_InsufficientPayment() public {
        vm.expectRevert(PumpFudV2.InsufficientPayment.selector);
        vm.prank(creator);
        pumpFud.createToken{value: CREATION_FEE - 1}(
            "Test Token",
            "TEST",
            "ipfs://test"
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // BONDING CURVE MATH TESTS
    // ═══════════════════════════════════════════════════════════════════════════

    function test_BondingCurve_InitialPrice() public {
        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}(
            "Test Token",
            "TEST",
            "ipfs://test"
        );

        uint256 price = pumpFud.getTokenPrice(token);

        // Initial price: VIRTUAL_PLS / VIRTUAL_TOKENS = 12.5M / 250M = 0.05 PLS per token
        uint256 expectedPrice = (12_500_000 ether * 1e18) / 250_000_000 ether;
        assertEq(price, expectedPrice, "Initial price should be 0.05 PLS/token");
    }

    function test_BondingCurve_PriceIncreasesOnBuy() public {
        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}(
            "Test Token",
            "TEST",
            "ipfs://test"
        );

        uint256 priceBefore = pumpFud.getTokenPrice(token);

        vm.prank(buyer);
        pumpFud.buy{value: 1000 ether}(token, 0, address(0));

        uint256 priceAfter = pumpFud.getTokenPrice(token);

        assertGt(priceAfter, priceBefore, "Price should increase after buy");
    }

    function test_BondingCurve_EstimatedTokensDecreaseWithProgress() public {
        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}(
            "Test Token",
            "TEST",
            "ipfs://test"
        );

        uint256 tokensForFirstBuy = pumpFud.getEstimatedTokens(token, 1000 ether);

        // Buy some tokens first
        vm.prank(buyer);
        pumpFud.buy{value: 10_000_000 ether}(token, 0, address(0));

        uint256 tokensForSecondBuy = pumpFud.getEstimatedTokens(token, 1000 ether);

        assertGt(tokensForFirstBuy, tokensForSecondBuy, "Should get fewer tokens at higher prices");
    }

    function test_BondingCurve_ProgressTracking() public {
        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}(
            "Test Token",
            "TEST",
            "ipfs://test"
        );

        (uint256 plsRaised, uint256 plsTarget, uint256 progressBps, uint256 tokensSold) =
            pumpFud.getBondingCurveProgress(token);

        assertEq(plsRaised, 0, "Initial PLS should be 0");
        assertEq(plsTarget, GRADUATION_TARGET, "Target should be 50M PLS");
        assertEq(progressBps, 0, "Initial progress should be 0");
        assertEq(tokensSold, 0, "Initial tokens sold should be 0");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // BUY TESTS
    // ═══════════════════════════════════════════════════════════════════════════

    function test_Buy_Success() public {
        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}(
            "Test Token",
            "TEST",
            "ipfs://test"
        );

        uint256 buyAmount = 1000 ether;
        uint256 expectedTokens = pumpFud.getEstimatedTokens(token, buyAmount * 99 / 100); // 1% fee

        vm.prank(buyer);
        uint256 tokensReceived = pumpFud.buy{value: buyAmount}(token, 0, address(0));

        assertGt(tokensReceived, 0, "Should receive tokens");

        PumpFudToken tokenContract = PumpFudToken(token);
        assertEq(tokenContract.balanceOf(buyer), tokensReceived, "Balance should match");
    }

    function test_Buy_WithReferrer() public {
        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}(
            "Test Token",
            "TEST",
            "ipfs://test"
        );

        uint256 referrerBefore = referrer.balance;
        uint256 treasuryBefore = TREASURY.balance;
        uint256 buyAmount = 10000 ether;

        vm.prank(buyer);
        pumpFud.buy{value: buyAmount}(token, 0, referrer);

        // Fee = 1% of buy amount = 100 ether
        // Split 50/50 = 50 ether each
        uint256 fee = buyAmount * 100 / 10000;
        uint256 halfFee = fee / 2;

        assertEq(referrer.balance - referrerBefore, halfFee, "Referrer should get half fee");
        assertEq(TREASURY.balance - treasuryBefore, halfFee, "Treasury should get half fee");
    }

    function test_Buy_WithoutReferrer_FullFeeToTreasury() public {
        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}(
            "Test Token",
            "TEST",
            "ipfs://test"
        );

        uint256 treasuryBefore = TREASURY.balance;
        uint256 buyAmount = 10000 ether;

        vm.prank(buyer);
        pumpFud.buy{value: buyAmount}(token, 0, address(0));

        // Full 1% fee to treasury
        uint256 fee = buyAmount * 100 / 10000;

        assertEq(TREASURY.balance - treasuryBefore, fee, "Treasury should get full fee");
    }

    function test_Buy_SlippageProtection() public {
        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}(
            "Test Token",
            "TEST",
            "ipfs://test"
        );

        uint256 estimatedTokens = pumpFud.getEstimatedTokens(token, 990 ether); // After 1% fee

        // Require more tokens than possible
        vm.expectRevert(PumpFudV2.SlippageExceeded.selector);
        vm.prank(buyer);
        pumpFud.buy{value: 1000 ether}(token, estimatedTokens + 1, address(0));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SELL TESTS
    // ═══════════════════════════════════════════════════════════════════════════

    function test_Sell_Success() public {
        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}(
            "Test Token",
            "TEST",
            "ipfs://test"
        );

        // Buy first
        vm.prank(buyer);
        uint256 tokensReceived = pumpFud.buy{value: 10000 ether}(token, 0, address(0));

        uint256 buyerPlsBefore = buyer.balance;

        // Sell half
        uint256 sellAmount = tokensReceived / 2;
        vm.prank(buyer);
        uint256 plsReceived = pumpFud.sell(token, sellAmount, 0, address(0));

        assertGt(plsReceived, 0, "Should receive PLS");
        assertEq(buyer.balance - buyerPlsBefore, plsReceived, "Balance should match");
    }

    function test_Sell_WithReferrer() public {
        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}(
            "Test Token",
            "TEST",
            "ipfs://test"
        );

        // Buy first
        vm.prank(buyer);
        uint256 tokensReceived = pumpFud.buy{value: 10000 ether}(token, 0, address(0));

        uint256 referrerBefore = referrer.balance;

        // Sell with referrer
        vm.prank(buyer);
        pumpFud.sell(token, tokensReceived / 2, 0, referrer);

        // Referrer should receive 50% of 1.22% fee
        assertGt(referrer.balance - referrerBefore, 0, "Referrer should receive fee");
    }

    function test_Sell_SlippageProtection() public {
        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}(
            "Test Token",
            "TEST",
            "ipfs://test"
        );

        vm.prank(buyer);
        uint256 tokensReceived = pumpFud.buy{value: 10000 ether}(token, 0, address(0));

        uint256 estimatedPls = pumpFud.getEstimatedPls(token, tokensReceived);

        // Require more PLS than possible
        vm.expectRevert(PumpFudV2.SlippageExceeded.selector);
        vm.prank(buyer);
        pumpFud.sell(token, tokensReceived, estimatedPls + 1 ether, address(0));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // BURN TESTS
    // ═══════════════════════════════════════════════════════════════════════════

    function test_Burn_Success() public {
        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}(
            "Test Token",
            "TEST",
            "ipfs://test"
        );

        // Buy tokens
        vm.prank(buyer);
        uint256 tokensReceived = pumpFud.buy{value: 10000 ether}(token, 0, address(0));

        uint256 buyerPlsBefore = buyer.balance;
        uint256 burnAmount = tokensReceived / 2;

        // Burn tokens
        vm.prank(buyer);
        uint256 plsReceived = pumpFud.burn(token, burnAmount);

        assertGt(plsReceived, 0, "Should receive PLS from burn");
        assertEq(buyer.balance - buyerPlsBefore, plsReceived, "Balance should match");

        // Token balance should be reduced
        PumpFudToken tokenContract = PumpFudToken(token);
        assertEq(tokenContract.balanceOf(buyer), tokensReceived - burnAmount, "Token balance should be reduced");
    }

    function test_Burn_ProportionalReturn() public {
        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}(
            "Test Token",
            "TEST",
            "ipfs://test"
        );

        // Buy tokens
        vm.prank(buyer);
        uint256 tokensReceived = pumpFud.buy{value: 10000 ether}(token, 0, address(0));

        PumpFudV2.TokenData memory dataBefore = pumpFud.getTokenData(token);

        // Burn all tokens - should get proportional PLS back
        // Formula: (tokensBurned / tokensSold) * plsReserve
        uint256 expectedPls = (tokensReceived * dataBefore.plsReserve) / dataBefore.tokensSold;

        vm.prank(buyer);
        uint256 plsReceived = pumpFud.burn(token, tokensReceived);

        assertEq(plsReceived, expectedPls, "Should receive proportional PLS");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // GRADUATION TESTS
    // ═══════════════════════════════════════════════════════════════════════════

    function test_Graduation_TriggersAt50MPLS() public {
        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}(
            "Test Token",
            "TEST",
            "ipfs://test"
        );

        // Buy enough to trigger graduation (slightly over 50M to account for fees)
        // Need to buy in chunks due to curve mechanics
        uint256 buyChunk = 5_000_000 ether;
        for (uint256 i = 0; i < 11; i++) {
            vm.prank(buyer);
            pumpFud.buy{value: buyChunk}(token, 0, address(0));

            PumpFudV2.TokenData memory data = pumpFud.getTokenData(token);
            if (data.isGraduated) break;
        }

        PumpFudV2.TokenData memory finalData = pumpFud.getTokenData(token);
        assertTrue(finalData.isGraduated, "Token should be graduated");
        assertGt(finalData.graduatedAt, 0, "Graduation timestamp should be set");
    }

    function test_Graduation_CannotBuyAfter() public {
        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}(
            "Test Token",
            "TEST",
            "ipfs://test"
        );

        // Graduate the token
        uint256 buyChunk = 5_000_000 ether;
        for (uint256 i = 0; i < 11; i++) {
            vm.prank(buyer);
            pumpFud.buy{value: buyChunk}(token, 0, address(0));

            PumpFudV2.TokenData memory data = pumpFud.getTokenData(token);
            if (data.isGraduated) break;
        }

        // Try to buy after graduation
        vm.expectRevert(PumpFudV2.TokenAlreadyGraduated.selector);
        vm.prank(buyer);
        pumpFud.buy{value: 1000 ether}(token, 0, address(0));
    }

    function test_Graduation_CreatorReward() public {
        uint256 creatorBefore = creator.balance;

        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}(
            "Test Token",
            "TEST",
            "ipfs://test"
        );

        // Graduate the token
        uint256 buyChunk = 5_000_000 ether;
        for (uint256 i = 0; i < 11; i++) {
            vm.prank(buyer);
            pumpFud.buy{value: buyChunk}(token, 0, address(0));

            PumpFudV2.TokenData memory data = pumpFud.getTokenData(token);
            if (data.isGraduated) break;
        }

        // Creator should have received reward (~500K PLS = 1% of 50M)
        uint256 creatorReward = creator.balance - creatorBefore + CREATION_FEE;
        assertGt(creatorReward, 400_000 ether, "Creator should receive meaningful reward");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // VIEW FUNCTION TESTS
    // ═══════════════════════════════════════════════════════════════════════════

    function test_GetAllTokens() public {
        // Create multiple tokens
        for (uint256 i = 0; i < 5; i++) {
            vm.prank(creator);
            pumpFud.createToken{value: CREATION_FEE}(
                string(abi.encodePacked("Token ", i)),
                string(abi.encodePacked("TKN", i)),
                "ipfs://test"
            );
        }

        address[] memory tokens = pumpFud.getAllTokens(0, 10);
        assertEq(tokens.length, 5, "Should return 5 tokens");
    }

    function test_GetLiveTokens_ExcludesGraduated() public {
        vm.prank(creator);
        address token1 = pumpFud.createToken{value: CREATION_FEE}("Token 1", "TKN1", "ipfs://1");

        vm.prank(creator);
        pumpFud.createToken{value: CREATION_FEE}("Token 2", "TKN2", "ipfs://2");

        // Graduate token1
        uint256 buyChunk = 5_000_000 ether;
        for (uint256 i = 0; i < 11; i++) {
            vm.prank(buyer);
            pumpFud.buy{value: buyChunk}(token1, 0, address(0));

            PumpFudV2.TokenData memory data = pumpFud.getTokenData(token1);
            if (data.isGraduated) break;
        }

        address[] memory liveTokens = pumpFud.getLiveTokens(0, 10);
        assertEq(liveTokens.length, 1, "Should return 1 live token");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ADMIN TESTS
    // ═══════════════════════════════════════════════════════════════════════════

    function test_Pause_BlocksBuying() public {
        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}(
            "Test Token",
            "TEST",
            "ipfs://test"
        );

        pumpFud.setPaused(true);

        vm.expectRevert(PumpFudV2.ContractPaused.selector);
        vm.prank(buyer);
        pumpFud.buy{value: 1000 ether}(token, 0, address(0));
    }

    function test_OnlyOwner_CanPause() public {
        vm.expectRevert();
        vm.prank(buyer);
        pumpFud.setPaused(true);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // EDGE CASE TESTS
    // ═══════════════════════════════════════════════════════════════════════════

    function test_ZeroAmount_Reverts() public {
        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}(
            "Test Token",
            "TEST",
            "ipfs://test"
        );

        vm.expectRevert(PumpFudV2.ZeroAmount.selector);
        vm.prank(buyer);
        pumpFud.buy{value: 0}(token, 0, address(0));
    }

    function test_InvalidToken_Reverts() public {
        vm.expectRevert(PumpFudV2.InvalidToken.selector);
        vm.prank(buyer);
        pumpFud.buy{value: 1000 ether}(address(0x123), 0, address(0));
    }

    function test_SelfReferral_TreatedAsNoReferrer() public {
        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}(
            "Test Token",
            "TEST",
            "ipfs://test"
        );

        uint256 buyerBefore = buyer.balance;
        uint256 treasuryBefore = TREASURY.balance;
        uint256 buyAmount = 10000 ether;

        // Buy with self as referrer
        vm.prank(buyer);
        pumpFud.buy{value: buyAmount}(token, 0, buyer);

        // Full fee should go to treasury (self-referral doesn't pay)
        uint256 fee = buyAmount * 100 / 10000;
        assertEq(TREASURY.balance - treasuryBefore, fee, "Treasury should get full fee for self-referral");
    }
}
