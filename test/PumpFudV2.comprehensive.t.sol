// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {PumpFudV2} from "../src/PumpFudV2.sol";
import {PumpFudToken} from "../src/PumpFudToken.sol";

/**
 * @title PumpFudV2ComprehensiveTest
 * @notice PHASE_1 comprehensive unit tests per PUMP.FUD testing template
 */
contract PumpFudV2ComprehensiveTest is Test {
    PumpFudV2 public pumpFud;

    address public constant TREASURY = 0x49bBEFa1d94702C0e9a5EAdDEc7c3C5D3eb9086B;
    address public constant DEAD_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    address public creator;
    address public buyer;
    address public referrer;
    address public attacker;

    uint256 constant CREATION_FEE = 100 ether;
    uint256 constant GRADUATION_TARGET = 50_000_000 ether;

    event TokenCreated(address indexed token, address indexed creator, string name, string symbol, uint256 creatorBuyAmount);
    event TokenBought(address indexed token, address indexed buyer, uint256 plsIn, uint256 tokensOut, address referrer);
    event TokenSold(address indexed token, address indexed seller, uint256 tokensIn, uint256 plsOut, address referrer);
    event TokenBurned(address indexed token, address indexed burner, uint256 tokensBurned, uint256 plsReceived);
    event TokenGraduated(address indexed token, uint256 plsBurned, uint256 plsToLP, uint256 tokensToLP);
    event ReferralPaid(address indexed referrer, address indexed token, uint256 plsAmount);

    function setUp() public {
        pumpFud = new PumpFudV2();

        creator = makeAddr("creator");
        buyer = makeAddr("buyer");
        referrer = makeAddr("referrer");
        attacker = makeAddr("attacker");

        vm.deal(creator, 1000 ether);
        vm.deal(buyer, 100_000_000 ether);
        vm.deal(attacker, 100_000_000 ether);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // TEST SUITE 1: TOKEN CREATION TESTS
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice SC_001: Create token with valid parameters
    function test_SC_001_CreateToken_ValidParams() public {
        uint256 treasuryBefore = TREASURY.balance;

        vm.expectEmit(false, true, false, true);
        emit TokenCreated(address(0), creator, "Test Token Alpha", "TTA", 0);

        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}(
            "Test Token Alpha",
            "TTA",
            "https://example.com/test.png"
        );

        // Verify token created
        assertNotEq(token, address(0), "SC_001: Token address should be non-zero");

        // Verify token data
        PumpFudV2.TokenData memory data = pumpFud.getTokenData(token);
        assertEq(data.creator, creator, "SC_001: Creator should match");
        assertEq(data.name, "Test Token Alpha", "SC_001: Name should match");
        assertEq(data.symbol, "TTA", "SC_001: Symbol should match");

        // Verify event emitted (checked above with vm.expectEmit)
        console2.log("SC_001 PASS: Token created at", token);
    }

    /// @notice SC_002: Create token charges correct fee
    function test_SC_002_CreateToken_CorrectFee() public {
        uint256 treasuryBefore = TREASURY.balance;

        vm.prank(creator);
        pumpFud.createToken{value: CREATION_FEE}("Test", "TST", "ipfs://test");

        uint256 treasuryAfter = TREASURY.balance;
        uint256 feeCollected = treasuryAfter - treasuryBefore;

        assertEq(feeCollected, CREATION_FEE, "SC_002: Treasury should receive exactly 100 PLS");
        console2.log("SC_002 PASS: Fee collected:", feeCollected / 1e18, "PLS");
    }

    /// @notice SC_003: Create token with empty name should still work (no validation)
    /// @dev If validation is desired, this test should be updated
    function test_SC_003_CreateToken_EmptyName() public {
        // Note: Current implementation allows empty name
        // If validation is added, change to expectRevert
        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}("", "TST", "ipfs://test");

        // Currently passes - document this behavior
        assertNotEq(token, address(0), "SC_003: Empty name currently allowed");
        console2.log("SC_003 NOTE: Empty name allowed - consider adding validation");
    }

    /// @notice SC_004: Create token with empty symbol should still work (no validation)
    function test_SC_004_CreateToken_EmptySymbol() public {
        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}("Test", "", "ipfs://test");

        assertNotEq(token, address(0), "SC_004: Empty symbol currently allowed");
        console2.log("SC_004 NOTE: Empty symbol allowed - consider adding validation");
    }

    /// @notice SC_005: Verify initial token distribution
    function test_SC_005_InitialDistribution() public {
        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}("Test", "TST", "ipfs://test");

        PumpFudToken tokenContract = PumpFudToken(token);
        PumpFudV2.TokenData memory data = pumpFud.getTokenData(token);

        // Verify initial state
        assertEq(data.tokensSold, 0, "SC_005: No tokens should be sold initially");
        assertEq(data.plsReserve, 0, "SC_005: No PLS reserve initially");
        assertEq(tokenContract.totalSupply(), 0, "SC_005: No tokens minted until first buy");

        console2.log("SC_005 PASS: Initial distribution correct");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // TEST SUITE 2: BUY FUNCTION TESTS
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice SC_010: Buy tokens with PLS
    function test_SC_010_Buy_Success() public {
        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}("Test", "TST", "ipfs://test");

        uint256 buyAmount = 1000 ether;

        vm.expectEmit(true, true, false, false);
        emit TokenBought(token, buyer, buyAmount, 0, address(0));

        vm.prank(buyer);
        uint256 tokensReceived = pumpFud.buy{value: buyAmount}(token, 0, address(0));

        assertGt(tokensReceived, 0, "SC_010: Should receive tokens");

        // Verify fee deducted (1%)
        PumpFudV2.TokenData memory data = pumpFud.getTokenData(token);
        uint256 expectedReserve = buyAmount * 99 / 100; // 99% goes to reserve
        assertEq(data.plsReserve, expectedReserve, "SC_010: Reserve should be 99% of buy amount");

        console2.log("SC_010 PASS: Tokens received:", tokensReceived / 1e18);
    }

    /// @notice SC_011: Buy fee goes to treasury when no referrer
    function test_SC_011_BuyFee_NoReferrer() public {
        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}("Test", "TST", "ipfs://test");

        uint256 treasuryBefore = TREASURY.balance;
        uint256 buyAmount = 10000 ether;

        vm.prank(buyer);
        pumpFud.buy{value: buyAmount}(token, 0, address(0));

        uint256 treasuryAfter = TREASURY.balance;
        uint256 feeReceived = treasuryAfter - treasuryBefore;
        uint256 expectedFee = buyAmount * 100 / 10000; // 1%

        assertEq(feeReceived, expectedFee, "SC_011: Treasury should receive 1% fee");
        console2.log("SC_011 PASS: Treasury received:", feeReceived / 1e18, "PLS");
    }

    /// @notice SC_012: Buy fee splits with referrer
    function test_SC_012_BuyFee_WithReferrer() public {
        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}("Test", "TST", "ipfs://test");

        uint256 treasuryBefore = TREASURY.balance;
        uint256 referrerBefore = referrer.balance;
        uint256 buyAmount = 10000 ether;

        vm.expectEmit(true, true, false, false);
        emit ReferralPaid(referrer, token, 0);

        vm.prank(buyer);
        pumpFud.buy{value: buyAmount}(token, 0, referrer);

        uint256 totalFee = buyAmount * 100 / 10000; // 1%
        uint256 halfFee = totalFee / 2;

        assertEq(TREASURY.balance - treasuryBefore, halfFee, "SC_012: Treasury should get 0.5%");
        assertEq(referrer.balance - referrerBefore, halfFee, "SC_012: Referrer should get 0.5%");

        console2.log("SC_012 PASS: Fee split 50/50 - each got:", halfFee / 1e18, "PLS");
    }

    /// @notice SC_013: Buy with minTokens slippage protection
    function test_SC_013_Buy_SlippageProtection() public {
        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}("Test", "TST", "ipfs://test");

        uint256 buyAmount = 1000 ether;
        uint256 estimatedTokens = pumpFud.getEstimatedTokens(token, buyAmount * 99 / 100);

        // Require more tokens than possible
        vm.expectRevert(PumpFudV2.SlippageExceeded.selector);
        vm.prank(buyer);
        pumpFud.buy{value: buyAmount}(token, estimatedTokens + 1, address(0));

        console2.log("SC_013 PASS: Slippage protection works");
    }

    /// @notice SC_014: Buy updates bonding curve state correctly
    function test_SC_014_Buy_StateUpdate() public {
        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}("Test", "TST", "ipfs://test");

        uint256 priceBefore = pumpFud.getTokenPrice(token);

        vm.prank(buyer);
        pumpFud.buy{value: 1000 ether}(token, 0, address(0));

        uint256 priceAfter = pumpFud.getTokenPrice(token);
        PumpFudV2.TokenData memory data = pumpFud.getTokenData(token);

        assertGt(priceAfter, priceBefore, "SC_014: Price should increase");
        assertGt(data.plsReserve, 0, "SC_014: Reserve should increase");
        assertGt(data.tokensSold, 0, "SC_014: Tokens sold should increase");

        console2.log("SC_014 PASS: Price increased from", priceBefore, "to", priceAfter);
    }

    /// @notice SC_015: Cannot buy after graduation
    function test_SC_015_Buy_AfterGraduation() public {
        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}("Test", "TST", "ipfs://test");

        // Graduate token
        _graduateToken(token);

        // Attempt buy
        vm.expectRevert(PumpFudV2.TokenAlreadyGraduated.selector);
        vm.prank(buyer);
        pumpFud.buy{value: 1000 ether}(token, 0, address(0));

        console2.log("SC_015 PASS: Buy after graduation reverts");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // TEST SUITE 3: SELL FUNCTION TESTS
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice SC_020: Sell tokens for PLS
    function test_SC_020_Sell_Success() public {
        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}("Test", "TST", "ipfs://test");

        // Buy first
        vm.prank(buyer);
        uint256 tokensReceived = pumpFud.buy{value: 10000 ether}(token, 0, address(0));

        uint256 buyerPlsBefore = buyer.balance;

        vm.expectEmit(true, true, false, false);
        emit TokenSold(token, buyer, tokensReceived / 2, 0, address(0));

        vm.prank(buyer);
        uint256 plsReceived = pumpFud.sell(token, tokensReceived / 2, 0, address(0));

        assertGt(plsReceived, 0, "SC_020: Should receive PLS");
        assertEq(buyer.balance - buyerPlsBefore, plsReceived, "SC_020: Balance should match");

        console2.log("SC_020 PASS: Sold tokens for", plsReceived / 1e18, "PLS");
    }

    /// @notice SC_021: Sell fee is exactly 1.22%
    function test_SC_021_SellFee_Exact() public {
        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}("Test", "TST", "ipfs://test");

        vm.prank(buyer);
        uint256 tokensReceived = pumpFud.buy{value: 10000 ether}(token, 0, address(0));

        uint256 treasuryBefore = TREASURY.balance;

        // Calculate expected PLS from sell (before fee)
        uint256 estimatedGross = pumpFud.getEstimatedPls(token, tokensReceived);

        vm.prank(buyer);
        uint256 plsReceived = pumpFud.sell(token, tokensReceived, 0, address(0));

        // Fee = 1.22% of gross
        uint256 expectedFee = estimatedGross * 122 / 10000;
        uint256 actualFee = TREASURY.balance - treasuryBefore;

        // Allow 1 wei rounding difference
        assertApproxEqAbs(actualFee, expectedFee, 1, "SC_021: Fee should be 1.22%");
        console2.log("SC_021 PASS: Sell fee", actualFee / 1e18, "PLS (1.22%)");
    }

    /// @notice SC_022: Sell fee splits correctly with referrer
    function test_SC_022_SellFee_WithReferrer() public {
        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}("Test", "TST", "ipfs://test");

        vm.prank(buyer);
        uint256 tokensReceived = pumpFud.buy{value: 10000 ether}(token, 0, address(0));

        uint256 treasuryBefore = TREASURY.balance;
        uint256 referrerBefore = referrer.balance;

        vm.prank(buyer);
        pumpFud.sell(token, tokensReceived, 0, referrer);

        uint256 treasuryGot = TREASURY.balance - treasuryBefore;
        uint256 referrerGot = referrer.balance - referrerBefore;

        // Should be roughly equal (50/50 split)
        assertApproxEqRel(treasuryGot, referrerGot, 0.01e18, "SC_022: Fee should split 50/50");
        console2.log("SC_022 PASS: Treasury:", treasuryGot / 1e18, "Referrer:", referrerGot / 1e18);
    }

    /// @notice SC_023: Sell with minPls slippage protection
    function test_SC_023_Sell_SlippageProtection() public {
        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}("Test", "TST", "ipfs://test");

        vm.prank(buyer);
        uint256 tokensReceived = pumpFud.buy{value: 10000 ether}(token, 0, address(0));

        uint256 estimatedPls = pumpFud.getEstimatedPls(token, tokensReceived);

        vm.expectRevert(PumpFudV2.SlippageExceeded.selector);
        vm.prank(buyer);
        pumpFud.sell(token, tokensReceived, estimatedPls + 1 ether, address(0));

        console2.log("SC_023 PASS: Sell slippage protection works");
    }

    /// @notice SC_024: Cannot sell more tokens than owned
    function test_SC_024_Sell_MoreThanOwned() public {
        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}("Test", "TST", "ipfs://test");

        vm.prank(buyer);
        uint256 tokensReceived = pumpFud.buy{value: 1000 ether}(token, 0, address(0));

        vm.expectRevert(PumpFudV2.InsufficientTokens.selector);
        vm.prank(buyer);
        pumpFud.sell(token, tokensReceived + 1, 0, address(0));

        console2.log("SC_024 PASS: Cannot sell more than owned");
    }

    /// @notice SC_025: Cannot sell after graduation
    function test_SC_025_Sell_AfterGraduation() public {
        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}("Test", "TST", "ipfs://test");

        // Buy some tokens
        vm.prank(buyer);
        uint256 tokensReceived = pumpFud.buy{value: 1000 ether}(token, 0, address(0));

        // Graduate token
        _graduateToken(token);

        // Attempt sell
        vm.expectRevert(PumpFudV2.TokenAlreadyGraduated.selector);
        vm.prank(buyer);
        pumpFud.sell(token, tokensReceived, 0, address(0));

        console2.log("SC_025 PASS: Sell after graduation reverts");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // TEST SUITE 4: BURN FUNCTION TESTS
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice SC_030: Burn tokens for proportional PLS
    function test_SC_030_Burn_ProportionalReturn() public {
        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}("Test", "TST", "ipfs://test");

        vm.prank(buyer);
        uint256 tokensReceived = pumpFud.buy{value: 10000 ether}(token, 0, address(0));

        PumpFudV2.TokenData memory dataBefore = pumpFud.getTokenData(token);
        uint256 burnAmount = tokensReceived / 2;

        // Expected: (burnAmount / tokensSold) * plsReserve
        uint256 expectedPls = (burnAmount * dataBefore.plsReserve) / dataBefore.tokensSold;

        vm.expectEmit(true, true, false, false);
        emit TokenBurned(token, buyer, burnAmount, 0);

        vm.prank(buyer);
        uint256 plsReceived = pumpFud.burn(token, burnAmount);

        assertEq(plsReceived, expectedPls, "SC_030: Should receive proportional PLS");
        console2.log("SC_030 PASS: Burned tokens:", burnAmount / 1e18);
        console2.log("SC_030 PLS received:", plsReceived / 1e18);
    }

    /// @notice SC_031: Burn reduces total supply
    function test_SC_031_Burn_ReducesSupply() public {
        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}("Test", "TST", "ipfs://test");

        vm.prank(buyer);
        uint256 tokensReceived = pumpFud.buy{value: 10000 ether}(token, 0, address(0));

        PumpFudToken tokenContract = PumpFudToken(token);
        uint256 supplyBefore = tokenContract.totalSupply();

        vm.prank(buyer);
        pumpFud.burn(token, tokensReceived / 2);

        uint256 supplyAfter = tokenContract.totalSupply();

        assertEq(supplyBefore - supplyAfter, tokensReceived / 2, "SC_031: Supply should decrease");
        console2.log("SC_031 PASS: Supply reduced by", (supplyBefore - supplyAfter) / 1e18);
    }

    /// @notice SC_032: Cannot burn more than owned
    function test_SC_032_Burn_MoreThanOwned() public {
        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}("Test", "TST", "ipfs://test");

        vm.prank(buyer);
        uint256 tokensReceived = pumpFud.buy{value: 1000 ether}(token, 0, address(0));

        vm.expectRevert(PumpFudV2.InsufficientTokens.selector);
        vm.prank(buyer);
        pumpFud.burn(token, tokensReceived + 1);

        console2.log("SC_032 PASS: Cannot burn more than owned");
    }

    /// @notice SC_033: Cannot burn after graduation
    function test_SC_033_Burn_AfterGraduation() public {
        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}("Test", "TST", "ipfs://test");

        vm.prank(buyer);
        uint256 tokensReceived = pumpFud.buy{value: 1000 ether}(token, 0, address(0));

        _graduateToken(token);

        vm.expectRevert(PumpFudV2.TokenAlreadyGraduated.selector);
        vm.prank(buyer);
        pumpFud.burn(token, tokensReceived);

        console2.log("SC_033 PASS: Burn after graduation reverts");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // TEST SUITE 5: GRADUATION TESTS
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice SC_040: Graduation triggers at 50M PLS threshold
    function test_SC_040_Graduation_Triggers() public {
        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}("Test", "TST", "ipfs://test");

        // Buy up to graduation
        vm.prank(buyer);
        pumpFud.buy{value: 60_000_000 ether}(token, 0, address(0)); // Enough to graduate

        PumpFudV2.TokenData memory data = pumpFud.getTokenData(token);

        assertTrue(data.isGraduated, "SC_040: Token should be graduated");
        assertGt(data.graduatedAt, 0, "SC_040: Graduation timestamp should be set");

        console2.log("SC_040 PASS: Graduation triggered at", data.plsReserve / 1e18, "PLS");
    }

    /// @notice SC_045: Creator reward paid at graduation
    function test_SC_045_Graduation_CreatorReward() public {
        uint256 creatorBefore = creator.balance;

        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}("Test", "TST", "ipfs://test");

        _graduateToken(token);

        // Creator should receive ~500K PLS (1% of 50M)
        uint256 creatorReceived = creator.balance - creatorBefore + CREATION_FEE;

        // Allow 10% tolerance due to curve mechanics
        uint256 expectedReward = 500_000 ether;
        assertGt(creatorReceived, expectedReward * 80 / 100, "SC_045: Creator should receive ~1%");

        console2.log("SC_045 PASS: Creator received", creatorReceived / 1e18, "PLS");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // HELPER FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    function _graduateToken(address token) internal {
        // Buy in chunks until graduation
        uint256 buyChunk = 5_000_000 ether;
        for (uint256 i = 0; i < 15; i++) {
            PumpFudV2.TokenData memory data = pumpFud.getTokenData(token);
            if (data.isGraduated) break;

            vm.prank(buyer);
            pumpFud.buy{value: buyChunk}(token, 0, address(0));
        }
    }
}
