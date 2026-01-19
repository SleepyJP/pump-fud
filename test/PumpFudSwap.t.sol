// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {PumpFudSwap} from "../src/PumpFudSwap.sol";
import {PumpFud} from "../src/PumpFud.sol";

contract PumpFudSwapTest is Test {
    PumpFudSwap public swap;
    PumpFud public pumpFud;

    address public owner = address(this);
    address public user1 = address(0x1);
    address public user2 = address(0x2);

    address constant TREASURY = 0x49bBEFa1d94702C0e9a5EAdDEc7c3C5D3eb9086B;

    function setUp() public {
        pumpFud = new PumpFud(TREASURY);
        swap = new PumpFudSwap(address(pumpFud));
    }

    // ============ DEPLOYMENT TESTS ============

    function test_Deployment() public view {
        assertEq(swap.owner(), owner);
        assertEq(address(swap.pumpFud()), address(pumpFud));
        assertEq(swap.swapFeeBps(), 50); // 0.5%
        assertEq(swap.positionCount(), 0);
        assertEq(swap.TREASURY(), TREASURY);
    }

    function test_DefaultRouters() public view {
        assertEq(swap.pulseXV1Router(), 0x98bf93ebf5c380C0e6Ae8e192A7e2AE08edAcc02);
        assertEq(swap.pulseXV2Router(), 0x165C3410fC91EF562C50559f7d2289fEbed552d9);
        assertEq(swap.paisleyRouter(), address(0)); // Not set by default
    }

    // ============ POSITION TESTS ============

    function test_CreatePosition() public {
        vm.deal(user1, 10 ether);

        vm.prank(user1);
        uint256 posId = swap.createPosition{value: 1 ether}(
            address(0), // Native PLS
            address(0x123), // Some token out
            1 ether,
            0.5 ether, // Min out (limit price)
            7 days
        );

        assertEq(posId, 1);
        assertEq(swap.positionCount(), 1);

        PumpFudSwap.Position memory pos = swap.getPosition(1);
        assertEq(pos.owner, user1);
        assertEq(pos.tokenIn, address(0));
        assertEq(pos.tokenOut, address(0x123));
        assertEq(pos.amountIn, 1 ether);
        assertEq(pos.minAmountOut, 0.5 ether);
        assertTrue(pos.isActive);
        assertFalse(pos.isFilled);
    }

    function test_CreatePositionZeroAmount() public {
        vm.prank(user1);
        vm.expectRevert(PumpFudSwap.InvalidAmount.selector);
        swap.createPosition{value: 0}(
            address(0),
            address(0x123),
            0,
            0.5 ether,
            7 days
        );
    }

    function test_CancelPosition() public {
        vm.deal(user1, 10 ether);

        vm.prank(user1);
        uint256 posId = swap.createPosition{value: 1 ether}(
            address(0),
            address(0x123),
            1 ether,
            0.5 ether,
            7 days
        );

        uint256 balBefore = user1.balance;

        vm.prank(user1);
        swap.cancelPosition(posId);

        uint256 balAfter = user1.balance;

        // User should get refund
        assertEq(balAfter - balBefore, 1 ether);

        PumpFudSwap.Position memory pos = swap.getPosition(posId);
        assertFalse(pos.isActive);
    }

    function test_OnlyOwnerCanCancelPosition() public {
        vm.deal(user1, 10 ether);

        vm.prank(user1);
        uint256 posId = swap.createPosition{value: 1 ether}(
            address(0),
            address(0x123),
            1 ether,
            0.5 ether,
            7 days
        );

        vm.prank(user2);
        vm.expectRevert(PumpFudSwap.NotPositionOwner.selector);
        swap.cancelPosition(posId);
    }

    function test_CannotCancelInactivePosition() public {
        vm.deal(user1, 10 ether);

        vm.prank(user1);
        uint256 posId = swap.createPosition{value: 1 ether}(
            address(0),
            address(0x123),
            1 ether,
            0.5 ether,
            7 days
        );

        vm.prank(user1);
        swap.cancelPosition(posId);

        // Try to cancel again
        vm.prank(user1);
        vm.expectRevert(PumpFudSwap.PositionNotActive.selector);
        swap.cancelPosition(posId);
    }

    function test_GetUserPositions() public {
        vm.deal(user1, 10 ether);

        vm.prank(user1);
        swap.createPosition{value: 1 ether}(address(0), address(0x123), 1 ether, 0.5 ether, 7 days);

        vm.prank(user1);
        swap.createPosition{value: 1 ether}(address(0), address(0x456), 1 ether, 0.5 ether, 7 days);

        uint256[] memory positions = swap.getUserPositions(user1);
        assertEq(positions.length, 2);
        assertEq(positions[0], 1);
        assertEq(positions[1], 2);
    }

    // ============ ADMIN TESTS ============

    function test_SetSwapFee() public {
        swap.setSwapFee(100); // 1%
        assertEq(swap.swapFeeBps(), 100);
    }

    function test_SetSwapFeeExceedsMax() public {
        vm.expectRevert(PumpFudSwap.FeeTooHigh.selector);
        swap.setSwapFee(301); // 3.01% - exceeds max
    }

    function test_OnlyOwnerCanSetSwapFee() public {
        vm.prank(user1);
        vm.expectRevert();
        swap.setSwapFee(50);
    }

    function test_SetRouters() public {
        address newV1 = address(0x111);
        address newV2 = address(0x222);
        address newPaisley = address(0x333);

        swap.setPulseXV1Router(newV1);
        swap.setPulseXV2Router(newV2);
        swap.setPaisleyRouter(newPaisley);

        assertEq(swap.pulseXV1Router(), newV1);
        assertEq(swap.pulseXV2Router(), newV2);
        assertEq(swap.paisleyRouter(), newPaisley);
    }

    function test_OnlyOwnerCanSetRouters() public {
        vm.prank(user1);
        vm.expectRevert();
        swap.setPulseXV1Router(address(0x111));

        vm.prank(user1);
        vm.expectRevert();
        swap.setPulseXV2Router(address(0x222));

        vm.prank(user1);
        vm.expectRevert();
        swap.setPaisleyRouter(address(0x333));
    }

    // ============ STATS TESTS ============

    function test_InitialStats() public view {
        assertEq(swap.totalVolumeSwapped(), 0);
        assertEq(swap.totalFeesCollected(), 0);
    }

    // ============ EMERGENCY TESTS ============

    function test_EmergencyWithdraw() public {
        // Send some PLS to contract
        vm.deal(address(swap), 10 ether);

        uint256 treasuryBefore = TREASURY.balance;
        swap.emergencyWithdraw(address(0), 10 ether);
        uint256 treasuryAfter = TREASURY.balance;

        assertEq(treasuryAfter - treasuryBefore, 10 ether);
    }

    function test_OnlyOwnerCanEmergencyWithdraw() public {
        vm.deal(address(swap), 10 ether);

        vm.prank(user1);
        vm.expectRevert();
        swap.emergencyWithdraw(address(0), 10 ether);
    }

    // ============ RECEIVE TESTS ============

    function test_ReceiveEther() public {
        vm.deal(user1, 10 ether);
        vm.prank(user1);
        (bool success,) = address(swap).call{value: 1 ether}("");
        assertTrue(success);
        assertEq(address(swap).balance, 1 ether);
    }
}

// Fork test for actual DEX integration
contract PumpFudSwapForkTest is Test {
    function setUp() public {
        // Skip if no fork URL
        try vm.envString("PULSECHAIN_RPC_URL") returns (string memory) {
            // Fork setup would go here
        } catch {
            vm.skip(true);
        }
    }
}
