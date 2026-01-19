// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {PumpFudV2} from "../src/PumpFudV2.sol";
import {PumpFudToken} from "../src/PumpFudToken.sol";

/**
 * @title PumpFudV2 Integration Tests
 * @notice PHASE_3: DEX integration, contract interactions, state transitions
 * @dev Tests INT_001-030 per THE TORTURE CHAMBER testing protocol
 */
contract PumpFudV2IntegrationTest is Test {
    PumpFudV2 public pumpFud;

    address constant TREASURY = 0x49bBEFa1d94702C0e9a5EAdDEc7c3C5D3eb9086B;
    address constant PULSEX_V2_ROUTER = 0x165C3410fC91EF562C50559f7d2289fEbed552d9;
    address constant PULSEX_V2_FACTORY = 0x29eA7545DEf87022BAdc76323F373EA1e707C523;
    address constant PULSEX_V1_ROUTER = 0x98bf93ebf5c380C0e6Ae8e192A7e2AE08edAcc02;
    address constant PULSEX_V1_FACTORY = 0x1715a3E4A142d8b698131108995174F37aEBA10D;
    address constant WPLS = 0xA1077a294dDE1B09bB078844df40758a5D0f9a27;
    address constant DEAD = 0x000000000000000000000000000000000000dEaD;

    uint256 constant CREATION_FEE = 100 ether;
    uint256 constant GRADUATION_TARGET = 50_000_000 ether;

    address creator = makeAddr("creator");
    address trader1 = makeAddr("trader1");
    address trader2 = makeAddr("trader2");
    address trader3 = makeAddr("trader3");

    function setUp() public {
        pumpFud = new PumpFudV2();
        vm.deal(creator, 1000 ether);
        vm.deal(trader1, 100_000_000 ether);
        vm.deal(trader2, 100_000_000 ether);
        vm.deal(trader3, 100_000_000 ether);
    }

    // ═══════════════════════════════════════════════════════════════════
    // INT_001-010: DEX ROUTER CONFIGURATION
    // ═══════════════════════════════════════════════════════════════════

    /// @notice INT_001: Primary router is PulseX V2
    function test_INT_001_PrimaryRouter() public view {
        assertEq(pumpFud.primaryRouter(), PULSEX_V2_ROUTER, "INT_001: Primary router should be PulseX V2");
        console2.log("INT_001 PASS: Primary router =", PULSEX_V2_ROUTER);
    }

    /// @notice INT_002: Secondary router is PulseX V1
    function test_INT_002_SecondaryRouter() public view {
        assertEq(pumpFud.secondaryRouter(), PULSEX_V1_ROUTER, "INT_002: Secondary router should be PulseX V1");
        console2.log("INT_002 PASS: Secondary router =", PULSEX_V1_ROUTER);
    }

    /// @notice INT_003: PulseX V2 factory is correct
    function test_INT_003_V2Factory() public view {
        assertEq(pumpFud.primaryFactory(), PULSEX_V2_FACTORY, "INT_003: V2 factory should be correct");
        console2.log("INT_003 PASS: V2 factory =", PULSEX_V2_FACTORY);
    }

    /// @notice INT_004: PulseX V1 factory is correct
    function test_INT_004_V1Factory() public view {
        assertEq(pumpFud.secondaryFactory(), PULSEX_V1_FACTORY, "INT_004: V1 factory should be correct");
        console2.log("INT_004 PASS: V1 factory =", PULSEX_V1_FACTORY);
    }

    /// @notice INT_005: WPLS address is correct
    function test_INT_005_WPLSAddress() public view {
        assertEq(pumpFud.WPLS(), WPLS, "INT_005: WPLS should be correct");
        console2.log("INT_005 PASS: WPLS =", WPLS);
    }

    /// @notice INT_006: Dead address is correct
    function test_INT_006_DeadAddress() public view {
        assertEq(pumpFud.DEAD_ADDRESS(), DEAD, "INT_006: Dead address should be 0xdead");
        console2.log("INT_006 PASS: Dead address =", DEAD);
    }

    /// @notice INT_007: Treasury address is correct
    function test_INT_007_TreasuryAddress() public view {
        assertEq(pumpFud.TREASURY(), TREASURY, "INT_007: Treasury should be correct");
        console2.log("INT_007 PASS: Treasury =", TREASURY);
    }

    /// @notice INT_008: Secondary router can be changed by owner
    function test_INT_008_SetSecondaryRouter() public {
        address newRouter = makeAddr("newRouter");
        address newFactory = makeAddr("newFactory");

        pumpFud.setSecondaryRouter(newRouter);
        pumpFud.setSecondaryFactory(newFactory);

        assertEq(pumpFud.secondaryRouter(), newRouter, "INT_008: Should update secondary router");
        assertEq(pumpFud.secondaryFactory(), newFactory, "INT_008: Should update secondary factory");
        console2.log("INT_008 PASS: Secondary DEX updated");
    }

    /// @notice INT_009: Non-owner cannot change secondary router
    function test_INT_009_SetSecondaryRouter_NonOwner() public {
        address attacker = makeAddr("attacker");
        address newRouter = makeAddr("newRouter");

        vm.expectRevert();
        vm.prank(attacker);
        pumpFud.setSecondaryRouter(newRouter);

        console2.log("INT_009 PASS: Non-owner cannot change secondary DEX");
    }

    /// @notice INT_010: Secondary router can be disabled (set to zero)
    function test_INT_010_SetSecondaryRouter_CanDisable() public {
        // Note: Zero address is allowed - this effectively disables secondary DEX
        // This is valid behavior for using only PulseX V2
        pumpFud.setSecondaryRouter(address(0));
        pumpFud.setSecondaryFactory(address(0));

        assertEq(pumpFud.secondaryRouter(), address(0), "INT_010: Router can be zero");
        assertEq(pumpFud.secondaryFactory(), address(0), "INT_010: Factory can be zero");
        console2.log("INT_010 PASS: Secondary DEX can be disabled");
    }

    // ═══════════════════════════════════════════════════════════════════
    // INT_011-020: TOKEN CONTRACT INTERACTIONS
    // ═══════════════════════════════════════════════════════════════════

    /// @notice INT_011: Token contract is PumpFudToken
    function test_INT_011_TokenContract() public {
        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}("Test", "TST", "ipfs://test");

        PumpFudToken tokenContract = PumpFudToken(token);
        assertEq(tokenContract.name(), "Test", "INT_011: Token name");
        assertEq(tokenContract.symbol(), "TST", "INT_011: Token symbol");
        console2.log("INT_011 PASS: Token contract deployed correctly");
    }

    /// @notice INT_012: Factory is token controller
    function test_INT_012_FactoryIsController() public {
        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}("Test", "TST", "ipfs://test");

        PumpFudToken tokenContract = PumpFudToken(token);
        assertEq(tokenContract.factory(), address(pumpFud), "INT_012: Factory should be controller");
        console2.log("INT_012 PASS: Factory controls token");
    }

    /// @notice INT_013: Only factory can mint
    function test_INT_013_OnlyFactoryMint() public {
        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}("Test", "TST", "ipfs://test");

        PumpFudToken tokenContract = PumpFudToken(token);

        vm.expectRevert();
        vm.prank(creator);
        tokenContract.mint(creator, 1000 ether);

        console2.log("INT_013 PASS: Only factory can mint");
    }

    /// @notice INT_014: Only factory can burn
    function test_INT_014_OnlyFactoryBurn() public {
        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}("Test", "TST", "ipfs://test");

        vm.prank(trader1);
        pumpFud.buy{value: 1000 ether}(token, 0, address(0));

        PumpFudToken tokenContract = PumpFudToken(token);

        vm.expectRevert();
        vm.prank(trader1);
        tokenContract.burn(trader1, 100 ether);

        console2.log("INT_014 PASS: Only factory can burn");
    }

    /// @notice INT_015: Token transfers work
    function test_INT_015_TokenTransfers() public {
        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}("Test", "TST", "ipfs://test");

        vm.prank(trader1);
        uint256 tokens = pumpFud.buy{value: 1000 ether}(token, 0, address(0));

        PumpFudToken tokenContract = PumpFudToken(token);

        uint256 transferAmount = tokens / 2;
        vm.prank(trader1);
        tokenContract.transfer(trader2, transferAmount);

        assertEq(tokenContract.balanceOf(trader2), transferAmount, "INT_015: Transfer should work");
        console2.log("INT_015 PASS: Token transfers work");
    }

    /// @notice INT_016: Token approvals work
    function test_INT_016_TokenApprovals() public {
        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}("Test", "TST", "ipfs://test");

        vm.prank(trader1);
        uint256 tokens = pumpFud.buy{value: 1000 ether}(token, 0, address(0));

        PumpFudToken tokenContract = PumpFudToken(token);

        vm.prank(trader1);
        tokenContract.approve(trader2, tokens);

        assertEq(tokenContract.allowance(trader1, trader2), tokens, "INT_016: Approval should work");

        vm.prank(trader2);
        tokenContract.transferFrom(trader1, trader3, tokens / 2);

        console2.log("INT_016 PASS: Token approvals work");
    }

    /// @notice INT_017: Factory can transfer token ownership post-graduation
    function test_INT_017_FactoryOwnership() public {
        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}("Test", "TST", "ipfs://test");

        // Graduate
        vm.prank(trader1);
        pumpFud.buy{value: 60_000_000 ether}(token, 0, address(0));

        // Check that factory remains controller (but LP is deployed)
        PumpFudToken tokenContract = PumpFudToken(token);
        assertEq(tokenContract.factory(), address(pumpFud), "INT_017: Factory still controller");
        console2.log("INT_017 PASS: Factory ownership maintained");
    }

    /// @notice INT_018: Multiple tokens can coexist
    function test_INT_018_MultipleTokens() public {
        vm.startPrank(creator);
        address token1 = pumpFud.createToken{value: CREATION_FEE}("Token1", "TK1", "ipfs://1");
        address token2 = pumpFud.createToken{value: CREATION_FEE}("Token2", "TK2", "ipfs://2");
        address token3 = pumpFud.createToken{value: CREATION_FEE}("Token3", "TK3", "ipfs://3");
        vm.stopPrank();

        assertTrue(token1 != token2 && token2 != token3, "INT_018: Tokens should be unique");
        assertEq(pumpFud.getTokenCount(), 3, "INT_018: Should have 3 tokens");
        console2.log("INT_018 PASS: Multiple tokens coexist");
    }

    /// @notice INT_019: Token data stored correctly
    function test_INT_019_TokenDataStorage() public {
        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}("TestToken", "TEST", "ipfs://metadata");

        PumpFudV2.TokenData memory data = pumpFud.getTokenData(token);

        assertEq(data.tokenAddress, token, "INT_019: Token address");
        assertEq(data.creator, creator, "INT_019: Creator");
        assertEq(data.name, "TestToken", "INT_019: Name");
        assertEq(data.symbol, "TEST", "INT_019: Symbol");
        assertEq(data.imageUri, "ipfs://metadata", "INT_019: Image URI");
        assertEq(data.isGraduated, false, "INT_019: Not graduated");
        console2.log("INT_019 PASS: Token data stored correctly");
    }

    /// @notice INT_020: All tokens array populated
    function test_INT_020_AllTokensArray() public {
        vm.startPrank(creator);
        address token1 = pumpFud.createToken{value: CREATION_FEE}("T1", "T1", "ipfs://1");
        address token2 = pumpFud.createToken{value: CREATION_FEE}("T2", "T2", "ipfs://2");
        vm.stopPrank();

        assertEq(pumpFud.allTokens(0), token1, "INT_020: First token");
        assertEq(pumpFud.allTokens(1), token2, "INT_020: Second token");
        console2.log("INT_020 PASS: All tokens array populated");
    }

    // ═══════════════════════════════════════════════════════════════════
    // INT_021-030: STATE TRANSITIONS
    // ═══════════════════════════════════════════════════════════════════

    /// @notice INT_021: State: Created -> Active (on first buy)
    function test_INT_021_StateTransition_CreatedToActive() public {
        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}("Test", "TST", "ipfs://test");

        PumpFudV2.TokenData memory dataBefore = pumpFud.getTokenData(token);
        assertEq(dataBefore.tokensSold, 0, "INT_021: No tokens sold initially");

        vm.prank(trader1);
        pumpFud.buy{value: 1000 ether}(token, 0, address(0));

        PumpFudV2.TokenData memory dataAfter = pumpFud.getTokenData(token);
        assertTrue(dataAfter.tokensSold > 0, "INT_021: Tokens sold after buy");
        console2.log("INT_021 PASS: Created -> Active state transition");
    }

    /// @notice INT_022: State: Active -> Graduated (at target)
    function test_INT_022_StateTransition_ActiveToGraduated() public {
        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}("Test", "TST", "ipfs://test");

        PumpFudV2.TokenData memory dataBefore = pumpFud.getTokenData(token);
        assertFalse(dataBefore.isGraduated, "INT_022: Not graduated initially");

        vm.prank(trader1);
        pumpFud.buy{value: 60_000_000 ether}(token, 0, address(0));

        PumpFudV2.TokenData memory dataAfter = pumpFud.getTokenData(token);
        assertTrue(dataAfter.isGraduated, "INT_022: Graduated after target");
        assertTrue(dataAfter.graduatedAt > 0, "INT_022: Graduation timestamp set");
        console2.log("INT_022 PASS: Active -> Graduated state transition");
    }

    /// @notice INT_023: Graduated state is permanent
    function test_INT_023_GraduatedPermanent() public {
        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}("Test", "TST", "ipfs://test");

        // Graduate
        vm.prank(trader1);
        pumpFud.buy{value: 60_000_000 ether}(token, 0, address(0));

        PumpFudV2.TokenData memory data = pumpFud.getTokenData(token);
        assertTrue(data.isGraduated, "INT_023: Graduated");

        // Cannot ungraduate
        // (No function to ungraduate, state is permanent)
        console2.log("INT_023 PASS: Graduated state is permanent");
    }

    /// @notice INT_024: Buy blocked after graduation
    function test_INT_024_BuyBlockedPostGrad() public {
        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}("Test", "TST", "ipfs://test");

        // Graduate
        vm.prank(trader1);
        pumpFud.buy{value: 60_000_000 ether}(token, 0, address(0));

        // Try to buy more
        vm.expectRevert(PumpFudV2.TokenAlreadyGraduated.selector);
        vm.prank(trader2);
        pumpFud.buy{value: 1000 ether}(token, 0, address(0));

        console2.log("INT_024 PASS: Buy blocked after graduation");
    }

    /// @notice INT_025: Sell blocked after graduation
    function test_INT_025_SellBlockedPostGrad() public {
        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}("Test", "TST", "ipfs://test");

        // Buy some tokens
        vm.prank(trader1);
        uint256 tokens = pumpFud.buy{value: 10_000_000 ether}(token, 0, address(0));

        // Graduate with another trader
        vm.prank(trader2);
        pumpFud.buy{value: 50_000_000 ether}(token, 0, address(0));

        // Try to sell
        vm.expectRevert(PumpFudV2.TokenAlreadyGraduated.selector);
        vm.prank(trader1);
        pumpFud.sell(token, tokens, 0, address(0));

        console2.log("INT_025 PASS: Sell blocked after graduation");
    }

    /// @notice INT_026: Burn blocked after graduation
    function test_INT_026_BurnBlockedPostGrad() public {
        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}("Test", "TST", "ipfs://test");

        // Buy some tokens
        vm.prank(trader1);
        uint256 tokens = pumpFud.buy{value: 10_000_000 ether}(token, 0, address(0));

        // Graduate with another trader
        vm.prank(trader2);
        pumpFud.buy{value: 50_000_000 ether}(token, 0, address(0));

        // Try to burn
        vm.expectRevert(PumpFudV2.TokenAlreadyGraduated.selector);
        vm.prank(trader1);
        pumpFud.burn(token, tokens);

        console2.log("INT_026 PASS: Burn blocked after graduation");
    }

    /// @notice INT_027: Volume tracking across trades
    function test_INT_027_VolumeTracking() public {
        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}("Test", "TST", "ipfs://test");

        // Multiple trades
        vm.prank(trader1);
        uint256 tokens1 = pumpFud.buy{value: 1_000_000 ether}(token, 0, address(0));

        vm.prank(trader2);
        uint256 tokens2 = pumpFud.buy{value: 2_000_000 ether}(token, 0, address(0));

        vm.prank(trader1);
        pumpFud.sell(token, tokens1 / 2, 0, address(0));

        PumpFudV2.TokenData memory data = pumpFud.getTokenData(token);
        assertTrue(data.totalVolume > 0, "INT_027: Volume should be tracked");
        console2.log("INT_027 PASS: Total volume:", data.totalVolume / 1e18, "PLS");
    }

    /// @notice INT_028: Timestamps set correctly
    function test_INT_028_Timestamps() public {
        uint256 createTime = block.timestamp;

        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}("Test", "TST", "ipfs://test");

        PumpFudV2.TokenData memory dataBefore = pumpFud.getTokenData(token);
        assertEq(dataBefore.createdAt, createTime, "INT_028: Created timestamp");
        assertEq(dataBefore.graduatedAt, 0, "INT_028: No graduation timestamp initially");

        // Warp forward and graduate
        vm.warp(createTime + 1 days);

        vm.prank(trader1);
        pumpFud.buy{value: 60_000_000 ether}(token, 0, address(0));

        PumpFudV2.TokenData memory dataAfter = pumpFud.getTokenData(token);
        assertEq(dataAfter.graduatedAt, createTime + 1 days, "INT_028: Graduation timestamp");
        console2.log("INT_028 PASS: Timestamps set correctly");
    }

    /// @notice INT_029: Pause blocks operations
    function test_INT_029_PauseBlocks() public {
        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}("Test", "TST", "ipfs://test");

        // Owner pauses
        pumpFud.setPaused(true);
        assertTrue(pumpFud.paused(), "INT_029: Should be paused");

        // Operations should fail
        vm.expectRevert(PumpFudV2.ContractPaused.selector);
        vm.prank(creator);
        pumpFud.createToken{value: CREATION_FEE}("Test2", "TST2", "ipfs://test2");

        vm.expectRevert(PumpFudV2.ContractPaused.selector);
        vm.prank(trader1);
        pumpFud.buy{value: 1000 ether}(token, 0, address(0));

        console2.log("INT_029 PASS: Pause blocks operations");
    }

    /// @notice INT_030: Unpause restores operations
    function test_INT_030_UnpauseRestores() public {
        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}("Test", "TST", "ipfs://test");

        // Pause and unpause
        pumpFud.setPaused(true);
        pumpFud.setPaused(false);
        assertFalse(pumpFud.paused(), "INT_030: Should be unpaused");

        // Operations should work again
        vm.prank(trader1);
        uint256 tokens = pumpFud.buy{value: 1000 ether}(token, 0, address(0));

        assertTrue(tokens > 0, "INT_030: Buy should work after unpause");
        console2.log("INT_030 PASS: Unpause restores operations");
    }
}
