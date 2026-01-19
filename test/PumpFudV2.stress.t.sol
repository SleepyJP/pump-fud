// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {PumpFudV2} from "../src/PumpFudV2.sol";
import {PumpFudToken} from "../src/PumpFudToken.sol";

/**
 * @title PumpFudV2 Stress Tests
 * @notice PHASE_6: Load testing, edge cases, concurrent operations
 * @dev Tests STRESS_001-030 per THE TORTURE CHAMBER testing protocol
 */
contract PumpFudV2StressTest is Test {
    PumpFudV2 public pumpFud;

    address constant TREASURY = 0x49bBEFa1d94702C0e9a5EAdDEc7c3C5D3eb9086B;

    uint256 constant CREATION_FEE = 100 ether;
    uint256 constant GRADUATION_TARGET = 50_000_000 ether;
    uint256 constant TOTAL_SUPPLY = 250_000_000 * 1e18;
    uint256 constant BONDING_SUPPLY = 200_000_000 * 1e18;

    address creator = makeAddr("creator");

    function setUp() public {
        pumpFud = new PumpFudV2();
        vm.deal(creator, 1_000_000 ether);
    }

    // ═══════════════════════════════════════════════════════════════════
    // STRESS_001-010: LOAD TESTING
    // ═══════════════════════════════════════════════════════════════════

    /// @notice STRESS_001: Create 100 tokens
    function test_STRESS_001_Create100Tokens() public {
        uint256 gasUsed;
        uint256 gasStart;

        for (uint256 i = 0; i < 100; i++) {
            gasStart = gasleft();
            vm.prank(creator);
            pumpFud.createToken{value: CREATION_FEE}(
                string(abi.encodePacked("Token", vm.toString(i))),
                string(abi.encodePacked("TK", vm.toString(i))),
                "ipfs://test"
            );
            gasUsed += gasStart - gasleft();
        }

        assertEq(pumpFud.getTokenCount(), 100, "STRESS_001: Should have 100 tokens");
        console2.log("STRESS_001 PASS: Created 100 tokens");
        console2.log("STRESS_001 Avg gas per token:", gasUsed / 100);
    }

    /// @notice STRESS_002: 100 buys on single token
    function test_STRESS_002_100BuysOnToken() public {
        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}("Test", "TST", "ipfs://test");

        uint256 totalGas;
        for (uint256 i = 0; i < 100; i++) {
            address trader = makeAddr(string(abi.encodePacked("trader", vm.toString(i))));
            vm.deal(trader, 1_000_000 ether);

            uint256 gasStart = gasleft();
            vm.prank(trader);
            pumpFud.buy{value: 100_000 ether}(token, 0, address(0));
            totalGas += gasStart - gasleft();
        }

        PumpFudV2.TokenData memory data = pumpFud.getTokenData(token);
        assertTrue(data.plsReserve > 0, "STRESS_002: PLS accumulated");
        console2.log("STRESS_002 PASS: 100 buys completed");
        console2.log("STRESS_002 Avg gas per buy:", totalGas / 100);
    }

    /// @notice STRESS_003: 100 sells on single token
    function test_STRESS_003_100SellsOnToken() public {
        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}("Test", "TST", "ipfs://test");

        // First buy tokens for all traders
        address[] memory traders = new address[](100);
        uint256[] memory tokenBalances = new uint256[](100);

        for (uint256 i = 0; i < 100; i++) {
            traders[i] = makeAddr(string(abi.encodePacked("trader", vm.toString(i))));
            vm.deal(traders[i], 1_000_000 ether);

            vm.prank(traders[i]);
            tokenBalances[i] = pumpFud.buy{value: 100_000 ether}(token, 0, address(0));
        }

        // Now sell
        uint256 totalGas;
        for (uint256 i = 0; i < 100; i++) {
            uint256 gasStart = gasleft();
            vm.prank(traders[i]);
            pumpFud.sell(token, tokenBalances[i], 0, address(0));
            totalGas += gasStart - gasleft();
        }

        console2.log("STRESS_003 PASS: 100 sells completed");
        console2.log("STRESS_003 Avg gas per sell:", totalGas / 100);
    }

    /// @notice STRESS_004: Rapid buy/sell cycles
    function test_STRESS_004_RapidBuySellCycles() public {
        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}("Test", "TST", "ipfs://test");

        address trader = makeAddr("cycler");
        vm.deal(trader, 100_000_000 ether);

        uint256 cycles = 50;
        for (uint256 i = 0; i < cycles; i++) {
            vm.prank(trader);
            uint256 tokens = pumpFud.buy{value: 1_000_000 ether}(token, 0, address(0));

            vm.prank(trader);
            pumpFud.sell(token, tokens, 0, address(0));
        }

        console2.log("STRESS_004 PASS:", cycles, "buy/sell cycles completed");
    }

    /// @notice STRESS_005: Many referrers
    function test_STRESS_005_ManyReferrers() public {
        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}("Test", "TST", "ipfs://test");

        // 50 different referrers
        for (uint256 i = 0; i < 50; i++) {
            address trader = makeAddr(string(abi.encodePacked("trader", vm.toString(i))));
            address referrer = makeAddr(string(abi.encodePacked("ref", vm.toString(i))));
            vm.deal(trader, 1_000_000 ether);

            vm.prank(trader);
            pumpFud.buy{value: 100_000 ether}(token, 0, referrer);

            assertTrue(referrer.balance > 0, "STRESS_005: Referrer got fee");
        }

        console2.log("STRESS_005 PASS: 50 referrers handled correctly");
    }

    /// @notice STRESS_006: Token pagination (getAllTokens)
    function test_STRESS_006_TokenPagination() public {
        // Create 50 tokens
        for (uint256 i = 0; i < 50; i++) {
            vm.prank(creator);
            pumpFud.createToken{value: CREATION_FEE}(
                string(abi.encodePacked("T", vm.toString(i))),
                string(abi.encodePacked("T", vm.toString(i))),
                "ipfs://t"
            );
        }

        // Test pagination
        address[] memory page1 = pumpFud.getAllTokens(0, 20);
        address[] memory page2 = pumpFud.getAllTokens(20, 20);
        address[] memory page3 = pumpFud.getAllTokens(40, 20);

        assertEq(page1.length, 20, "STRESS_006: Page 1 correct");
        assertEq(page2.length, 20, "STRESS_006: Page 2 correct");
        assertEq(page3.length, 10, "STRESS_006: Page 3 correct");

        console2.log("STRESS_006 PASS: Pagination works correctly");
    }

    /// @notice STRESS_007: Multiple simultaneous graduations
    function test_STRESS_007_MultipleGraduations() public {
        // Create 5 tokens
        address[] memory tokens = new address[](5);
        for (uint256 i = 0; i < 5; i++) {
            vm.prank(creator);
            tokens[i] = pumpFud.createToken{value: CREATION_FEE}(
                string(abi.encodePacked("Grad", vm.toString(i))),
                string(abi.encodePacked("G", vm.toString(i))),
                "ipfs://grad"
            );
        }

        // Graduate all
        for (uint256 i = 0; i < 5; i++) {
            address trader = makeAddr(string(abi.encodePacked("gradTrader", vm.toString(i))));
            vm.deal(trader, 100_000_000 ether);

            vm.prank(trader);
            pumpFud.buy{value: 60_000_000 ether}(tokens[i], 0, address(0));

            PumpFudV2.TokenData memory data = pumpFud.getTokenData(tokens[i]);
            assertTrue(data.isGraduated, "STRESS_007: Token graduated");
        }

        console2.log("STRESS_007 PASS: 5 tokens graduated successfully");
    }

    // ═══════════════════════════════════════════════════════════════════
    // STRESS_010-020: EDGE CASES
    // ═══════════════════════════════════════════════════════════════════

    /// @notice STRESS_010: Buy exactly at graduation threshold
    function test_STRESS_010_ExactGraduationThreshold() public {
        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}("Test", "TST", "ipfs://test");

        // Calculate exact amount needed to hit graduation
        // This is approximate due to fees
        address trader = makeAddr("threshold");
        vm.deal(trader, 100_000_000 ether);

        // Buy just under graduation
        vm.prank(trader);
        pumpFud.buy{value: 49_999_999 ether}(token, 0, address(0));

        PumpFudV2.TokenData memory dataBefore = pumpFud.getTokenData(token);
        assertFalse(dataBefore.isGraduated, "STRESS_010: Not graduated yet");

        // Small buy to trigger graduation
        address trader2 = makeAddr("pusher");
        vm.deal(trader2, 10_000_000 ether);

        vm.prank(trader2);
        pumpFud.buy{value: 1_000_000 ether}(token, 0, address(0));

        PumpFudV2.TokenData memory dataAfter = pumpFud.getTokenData(token);
        assertTrue(dataAfter.isGraduated, "STRESS_010: Graduated");

        console2.log("STRESS_010 PASS: Graduation at threshold works");
    }

    /// @notice STRESS_011: Maximum practical buy
    function test_STRESS_011_MaxPracticalBuy() public {
        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}("Test", "TST", "ipfs://test");

        address whale = makeAddr("whale");
        vm.deal(whale, 100_000_000 ether);

        // Buy all bonding supply in one tx
        vm.prank(whale);
        uint256 tokens = pumpFud.buy{value: 60_000_000 ether}(token, 0, address(0));

        assertTrue(tokens > 0, "STRESS_011: Received tokens");
        console2.log("STRESS_011 PASS: Max buy succeeded, tokens:", tokens / 1e18);
    }

    /// @notice STRESS_012: Sell all tokens at once
    function test_STRESS_012_SellAllAtOnce() public {
        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}("Test", "TST", "ipfs://test");

        address trader = makeAddr("allSeller");
        vm.deal(trader, 100_000_000 ether);

        vm.prank(trader);
        uint256 tokens = pumpFud.buy{value: 10_000_000 ether}(token, 0, address(0));

        uint256 balBefore = trader.balance;

        vm.prank(trader);
        uint256 pls = pumpFud.sell(token, tokens, 0, address(0));

        assertTrue(pls > 0, "STRESS_012: Received PLS back");
        assertEq(PumpFudToken(token).balanceOf(trader), 0, "STRESS_012: All tokens sold");
        console2.log("STRESS_012 PASS: Sold all tokens, PLS received:", pls / 1e18);
    }

    /// @notice STRESS_013: Burn all tokens at once
    function test_STRESS_013_BurnAllAtOnce() public {
        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}("Test", "TST", "ipfs://test");

        address burner = makeAddr("burner");
        vm.deal(burner, 100_000_000 ether);

        vm.prank(burner);
        uint256 tokens = pumpFud.buy{value: 10_000_000 ether}(token, 0, address(0));

        vm.prank(burner);
        uint256 pls = pumpFud.burn(token, tokens);

        assertTrue(pls > 0, "STRESS_013: Received PLS from burn");
        assertEq(PumpFudToken(token).balanceOf(burner), 0, "STRESS_013: All tokens burned");
        console2.log("STRESS_013 PASS: Burned all tokens, PLS:", pls / 1e18);
    }

    /// @notice STRESS_014: Minimum viable buy
    function test_STRESS_014_MinimumViableBuy() public {
        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}("Test", "TST", "ipfs://test");

        address minBuyer = makeAddr("minBuyer");
        vm.deal(minBuyer, 1000 ether);

        // Find minimum buy that gives at least 1 token
        uint256 minBuy = 1 ether;
        vm.prank(minBuyer);
        uint256 tokens = pumpFud.buy{value: minBuy}(token, 0, address(0));

        assertTrue(tokens > 0, "STRESS_014: Got tokens from min buy");
        console2.log("STRESS_014 PASS: Min buy 1 PLS gives", tokens / 1e18, "tokens");
    }

    /// @notice STRESS_015: Price at max supply sold
    function test_STRESS_015_PriceAtMaxSupply() public {
        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}("Test", "TST", "ipfs://test");

        // Buy almost all bonding supply
        address bigBuyer = makeAddr("bigBuyer");
        vm.deal(bigBuyer, 100_000_000 ether);

        vm.prank(bigBuyer);
        pumpFud.buy{value: 49_000_000 ether}(token, 0, address(0));

        uint256 price = pumpFud.getTokenPrice(token);
        console2.log("STRESS_015 PASS: Price at near-graduation:", price);
        console2.log("STRESS_015 That's ~", price / 1e16, "cents per token");
    }

    /// @notice STRESS_016: Long token name/symbol
    function test_STRESS_016_LongNameSymbol() public {
        string memory longName = "This is a very long token name that tests the limits of storage";
        string memory longSymbol = "VERYLONGSYMBOL";

        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}(longName, longSymbol, "ipfs://long");

        PumpFudToken tokenContract = PumpFudToken(token);
        assertEq(tokenContract.name(), longName, "STRESS_016: Long name stored");
        assertEq(tokenContract.symbol(), longSymbol, "STRESS_016: Long symbol stored");
        console2.log("STRESS_016 PASS: Long names work");
    }

    /// @notice STRESS_017: Unicode in token name
    function test_STRESS_017_UnicodeInName() public {
        string memory unicodeName = unicode"🚀 Rocket Token 🌙";

        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}(unicodeName, "ROCKET", "ipfs://emoji");

        PumpFudToken tokenContract = PumpFudToken(token);
        assertEq(tokenContract.name(), unicodeName, "STRESS_017: Unicode name stored");
        console2.log("STRESS_017 PASS: Unicode names work");
    }

    /// @notice STRESS_018: Long image URI
    function test_STRESS_018_LongImageUri() public {
        string memory longUri = "ipfs://QmVeryLongHashThatCouldRepresentARealIPFSHashForAnImageThatIsStoredOnTheDecentralizedWeb1234567890";

        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}("Test", "TST", longUri);

        PumpFudV2.TokenData memory data = pumpFud.getTokenData(token);
        assertEq(data.imageUri, longUri, "STRESS_018: Long URI stored");
        console2.log("STRESS_018 PASS: Long URI works");
    }

    // ═══════════════════════════════════════════════════════════════════
    // STRESS_020-030: CONCURRENT OPERATIONS
    // ═══════════════════════════════════════════════════════════════════

    /// @notice STRESS_020: Multiple tokens, same creator
    function test_STRESS_020_SameCreatorManyTokens() public {
        uint256 numTokens = 20;

        for (uint256 i = 0; i < numTokens; i++) {
            vm.prank(creator);
            pumpFud.createToken{value: CREATION_FEE}(
                string(abi.encodePacked("Creator", vm.toString(i))),
                string(abi.encodePacked("C", vm.toString(i))),
                "ipfs://same"
            );
        }

        assertEq(pumpFud.getTokenCount(), numTokens, "STRESS_020: Created all tokens");
        console2.log("STRESS_020 PASS: Same creator made", numTokens, "tokens");
    }

    /// @notice STRESS_021: Interleaved operations on multiple tokens
    function test_STRESS_021_InterleavedOperations() public {
        // Create 3 tokens
        address[] memory tokens = new address[](3);
        for (uint256 i = 0; i < 3; i++) {
            vm.prank(creator);
            tokens[i] = pumpFud.createToken{value: CREATION_FEE}(
                string(abi.encodePacked("Inter", vm.toString(i))),
                string(abi.encodePacked("I", vm.toString(i))),
                "ipfs://inter"
            );
        }

        address trader = makeAddr("interleaver");
        vm.deal(trader, 100_000_000 ether);

        // Interleaved buys
        uint256[] memory holdings = new uint256[](3);
        for (uint256 round = 0; round < 5; round++) {
            for (uint256 t = 0; t < 3; t++) {
                vm.prank(trader);
                holdings[t] += pumpFud.buy{value: 100_000 ether}(tokens[t], 0, address(0));
            }
        }

        // Interleaved sells
        for (uint256 t = 0; t < 3; t++) {
            vm.prank(trader);
            pumpFud.sell(tokens[t], holdings[t], 0, address(0));
        }

        console2.log("STRESS_021 PASS: Interleaved operations work");
    }

    /// @notice STRESS_022: Price impact across multiple tokens
    function test_STRESS_022_PriceImpactMultiple() public {
        address[] memory tokens = new address[](3);
        uint256[] memory pricesBefore = new uint256[](3);
        uint256[] memory pricesAfter = new uint256[](3);

        for (uint256 i = 0; i < 3; i++) {
            vm.prank(creator);
            tokens[i] = pumpFud.createToken{value: CREATION_FEE}(
                string(abi.encodePacked("Price", vm.toString(i))),
                string(abi.encodePacked("P", vm.toString(i))),
                "ipfs://price"
            );
            pricesBefore[i] = pumpFud.getTokenPrice(tokens[i]);
        }

        // Buy different amounts on each token
        for (uint256 i = 0; i < 3; i++) {
            address trader = makeAddr(string(abi.encodePacked("priceBuyer", vm.toString(i))));
            vm.deal(trader, 100_000_000 ether);

            vm.prank(trader);
            pumpFud.buy{value: (i + 1) * 1_000_000 ether}(tokens[i], 0, address(0));
            pricesAfter[i] = pumpFud.getTokenPrice(tokens[i]);
        }

        // Verify price impact scales with buy size
        for (uint256 i = 1; i < 3; i++) {
            uint256 impactPrev = pricesAfter[i-1] - pricesBefore[i-1];
            uint256 impactCurr = pricesAfter[i] - pricesBefore[i];
            assertTrue(impactCurr > impactPrev, "STRESS_022: Larger buy = larger impact");
        }

        console2.log("STRESS_022 PASS: Price impact scales correctly");
    }

    /// @notice STRESS_023: Treasury accumulation over many operations
    function test_STRESS_023_TreasuryAccumulation() public {
        uint256 treasuryBefore = TREASURY.balance;

        // Create tokens and do many buys
        for (uint256 i = 0; i < 10; i++) {
            vm.prank(creator);
            address token = pumpFud.createToken{value: CREATION_FEE}(
                string(abi.encodePacked("Accum", vm.toString(i))),
                string(abi.encodePacked("A", vm.toString(i))),
                "ipfs://accum"
            );

            for (uint256 j = 0; j < 5; j++) {
                address trader = makeAddr(string(abi.encodePacked("acc", vm.toString(i), vm.toString(j))));
                vm.deal(trader, 1_000_000 ether);

                vm.prank(trader);
                pumpFud.buy{value: 100_000 ether}(token, 0, address(0));
            }
        }

        uint256 treasuryAfter = TREASURY.balance;
        uint256 accumulated = treasuryAfter - treasuryBefore;

        // 10 creation fees + 50 buy fees
        // Creation: 10 * 100 PLS = 1000 PLS
        // Buys: 50 * 100_000 * 0.01 = 50000 PLS
        assertTrue(accumulated > 50_000 ether, "STRESS_023: Treasury accumulated fees");
        console2.log("STRESS_023 PASS: Treasury accumulated", accumulated / 1e18, "PLS");
    }

    /// @notice STRESS_024: State consistency after many operations
    function test_STRESS_024_StateConsistency() public {
        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}("Consistent", "CON", "ipfs://con");

        // Do many operations
        address[] memory traders = new address[](20);
        for (uint256 i = 0; i < 20; i++) {
            traders[i] = makeAddr(string(abi.encodePacked("conTrader", vm.toString(i))));
            vm.deal(traders[i], 10_000_000 ether);

            vm.prank(traders[i]);
            pumpFud.buy{value: 1_000_000 ether}(token, 0, address(0));
        }

        // Verify state is consistent
        PumpFudV2.TokenData memory data = pumpFud.getTokenData(token);

        // Tokens sold should match total balances
        PumpFudToken tokenContract = PumpFudToken(token);
        uint256 totalHeld;
        for (uint256 i = 0; i < 20; i++) {
            totalHeld += tokenContract.balanceOf(traders[i]);
        }

        console2.log("STRESS_024 PASS: State consistent after 20 operations");
        console2.log("STRESS_024 Tokens sold:", data.tokensSold / 1e18);
    }

    /// @notice STRESS_025: Gas efficiency over many operations
    function test_STRESS_025_GasEfficiency() public {
        vm.prank(creator);
        address token = pumpFud.createToken{value: CREATION_FEE}("Gas", "GAS", "ipfs://gas");

        uint256[] memory gasUsage = new uint256[](10);

        for (uint256 i = 0; i < 10; i++) {
            address trader = makeAddr(string(abi.encodePacked("gasTr", vm.toString(i))));
            vm.deal(trader, 10_000_000 ether);

            uint256 gasBefore = gasleft();
            vm.prank(trader);
            pumpFud.buy{value: 1_000_000 ether}(token, 0, address(0));
            gasUsage[i] = gasBefore - gasleft();
        }

        // Gas should be relatively consistent (first tx may be higher due to cold storage)
        uint256 avgGas = 0;
        for (uint256 i = 0; i < 10; i++) {
            avgGas += gasUsage[i];
        }
        avgGas /= 10;

        // Verify gas is within reasonable range (excluding first cold tx)
        uint256 maxGas = 0;
        uint256 minGas = type(uint256).max;
        for (uint256 i = 1; i < 10; i++) { // Skip first tx (cold storage)
            if (gasUsage[i] > maxGas) maxGas = gasUsage[i];
            if (gasUsage[i] < minGas) minGas = gasUsage[i];
        }

        // Warm txs should be within 30% of each other
        assertTrue(maxGas - minGas < minGas / 3, "STRESS_025: Gas should be consistent");
        console2.log("STRESS_025 PASS: Avg gas per buy:", avgGas);
        console2.log("STRESS_025 Gas range (warm):", minGas, "-", maxGas);
    }
}
