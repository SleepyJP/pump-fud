// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {PumpFudAdManager} from "../src/PumpFudAdManager.sol";

/**
 * @title PumpFudAdManagerTest
 * @notice Tests for advertisement management system
 */
contract PumpFudAdManagerTest is Test {
    PumpFudAdManager public adManager;

    address public deployer = makeAddr("deployer");
    address public advertiser1 = makeAddr("advertiser1");
    address public advertiser2 = makeAddr("advertiser2");

    address constant TREASURY = 0x49bBEFa1d94702C0e9a5EAdDEc7c3C5D3eb9086B;

    function setUp() public {
        vm.deal(deployer, 1000 ether);
        vm.deal(advertiser1, 1_000_000 ether);
        vm.deal(advertiser2, 1_000_000 ether);

        vm.prank(deployer);
        adManager = new PumpFudAdManager();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // DEPLOYMENT TESTS
    // ═══════════════════════════════════════════════════════════════════════════

    function test_Deployment() public view {
        assertEq(adManager.TREASURY(), TREASURY);
        assertEq(adManager.weeklyRatePLS(), 25_000 ether);
        assertEq(adManager.owner(), deployer);
    }

    function test_DefaultSpacesInitialized() public view {
        // Check total ad spaces created during init
        // 5 (LandingCarousel) + 1 (LandingBanner) + 10 (DashboardSidebar) +
        // 1 (TokenListBanner) + 3 (LaunchPageSpot) + 3 (FooterBanner) + 5 (CarouselAllPages) = 28
        assertEq(adManager.adSpaceCount(), 28);
    }

    function test_LandingCarouselSpaces() public view {
        // First 5 spaces should be landing carousel
        for (uint256 i = 1; i <= 5; i++) {
            (
                uint256 id,
                PumpFudAdManager.AdLocation location,
                string memory name,
                uint256 weeklyRate,
                bool isActive,
                bool isPremium,
                uint256 premiumMultiplier
            ) = adManager.adSpaces(i);

            assertEq(id, i);
            assertEq(uint256(location), uint256(PumpFudAdManager.AdLocation.LandingCarousel));
            assertTrue(isActive);
            assertTrue(isPremium);
            assertEq(premiumMultiplier, 150); // 1.5x
        }
    }

    function test_LandingBannerSpace() public view {
        // Space 6 should be landing banner (premium 2x)
        (
            uint256 id,
            PumpFudAdManager.AdLocation location,
            ,
            ,
            bool isActive,
            bool isPremium,
            uint256 premiumMultiplier
        ) = adManager.adSpaces(6);

        assertEq(id, 6);
        assertEq(uint256(location), uint256(PumpFudAdManager.AdLocation.LandingBanner));
        assertTrue(isActive);
        assertTrue(isPremium);
        assertEq(premiumMultiplier, 200); // 2x
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // OWNER AD PLACEMENT TESTS
    // ═══════════════════════════════════════════════════════════════════════════

    function test_OwnerPlaceAd() public {
        vm.prank(deployer);
        uint256 adId = adManager.placeOwnerAd(
            1, // Landing carousel slot 1
            "ipfs://test-image",
            "https://pump.fud",
            "Test Ad",
            4 // 4 weeks
        );

        assertEq(adId, 1);

        // Verify ad details
        (
            uint256 id,
            uint256 spaceId,
            address advertiser,
            string memory imageUri,
            string memory linkUrl,
            string memory altText,
            uint256 startTime,
            uint256 endTime,
            uint256 paidAmount,
            bool isOwnerAd,
            bool isActive
        ) = adManager.ads(adId);

        assertEq(id, 1);
        assertEq(spaceId, 1);
        assertEq(advertiser, deployer);
        assertEq(imageUri, "ipfs://test-image");
        assertEq(linkUrl, "https://pump.fud");
        assertEq(altText, "Test Ad");
        assertTrue(startTime > 0);
        assertEq(endTime, startTime + 4 weeks);
        assertEq(paidAmount, 0); // Owner ads are free
        assertTrue(isOwnerAd);
        assertTrue(isActive);
    }

    function test_OwnerPermanentAd() public {
        vm.prank(deployer);
        uint256 adId = adManager.placeOwnerAd(
            1,
            "ipfs://permanent",
            "https://pump.fud",
            "Permanent Ad",
            0 // 0 = permanent
        );

        (, , , , , , , uint256 endTime, , ,) = adManager.ads(adId);
        assertEq(endTime, type(uint256).max);
    }

    function test_OnlyOwnerCanPlaceOwnerAd() public {
        vm.prank(advertiser1);
        vm.expectRevert();
        adManager.placeOwnerAd(1, "ipfs://test", "https://test.com", "Test", 1);
    }

    function test_OwnerRemoveAd() public {
        // Place ad first
        vm.prank(deployer);
        uint256 adId = adManager.placeOwnerAd(1, "ipfs://test", "https://test.com", "Test", 1);

        // Remove it
        vm.prank(deployer);
        adManager.removeAd(adId);

        (, , , , , , , , , , bool isActive) = adManager.ads(adId);
        assertFalse(isActive);

        // Current ad for space should be cleared
        assertEq(adManager.currentAd(1), 0);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PAID AD RENTAL TESTS
    // ═══════════════════════════════════════════════════════════════════════════

    function test_RentAdSpace() public {
        uint256 cost = adManager.calculateRentalCost(1, 1); // 1 week
        console2.log("Cost for 1 week (carousel):", cost / 1e18, "PLS");

        // Expected: 25000 * 150 / 100 = 37,500 PLS (1.5x premium)
        assertEq(cost, 37_500 ether);

        uint256 treasuryBefore = TREASURY.balance;

        // Use an address that can receive refunds if overpaying
        address payable renter = payable(address(0xabCDeF0123456789AbcdEf0123456789aBCDEF01));
        vm.deal(renter, cost);

        vm.prank(renter);
        uint256 adId = adManager.rentAdSpace{value: cost}(
            1,
            "ipfs://paid-ad",
            "https://advertiser.com",
            "Paid Ad",
            1
        );

        assertEq(adId, 1);

        // Treasury should receive payment
        assertEq(TREASURY.balance, treasuryBefore + cost);

        // Verify ad
        (
            ,
            uint256 spaceId,
            address advertiser,
            ,
            ,
            ,
            ,
            ,
            uint256 paidAmount,
            bool isOwnerAd,
            bool isActive
        ) = adManager.ads(adId);

        assertEq(spaceId, 1);
        assertEq(advertiser, renter);
        assertEq(paidAmount, cost);
        assertFalse(isOwnerAd);
        assertTrue(isActive);
    }

    function test_RentAdSpaceRefundsExcess() public {
        uint256 cost = adManager.calculateRentalCost(1, 1);
        uint256 overpay = cost + 1000 ether;

        // Use a proper EOA that can receive ETH
        address payable refundReceiver = payable(address(0x1234567890123456789012345678901234567890));
        vm.deal(refundReceiver, overpay);

        uint256 receiverBefore = refundReceiver.balance;
        uint256 treasuryBefore = TREASURY.balance;

        vm.prank(refundReceiver);
        adManager.rentAdSpace{value: overpay}(
            1,
            "ipfs://paid-ad",
            "https://advertiser.com",
            "Paid Ad",
            1
        );

        // Should get refund (paid overpay, got back 1000 ether excess)
        assertEq(refundReceiver.balance, receiverBefore - cost);
        // Treasury should receive exactly cost, not full msg.value
        assertEq(TREASURY.balance, treasuryBefore + cost);
    }

    function test_RentAdSpaceInsufficientPayment() public {
        uint256 cost = adManager.calculateRentalCost(1, 1);

        vm.prank(advertiser1);
        vm.expectRevert(PumpFudAdManager.InsufficientPayment.selector);
        adManager.rentAdSpace{value: cost - 1}(
            1,
            "ipfs://paid-ad",
            "https://advertiser.com",
            "Paid Ad",
            1
        );
    }

    function test_CannotRentOccupiedSpace() public {
        uint256 cost = adManager.calculateRentalCost(1, 1);

        // First rental
        vm.prank(advertiser1);
        adManager.rentAdSpace{value: cost}(
            1,
            "ipfs://ad1",
            "https://ad1.com",
            "Ad 1",
            1
        );

        // Try to rent same space
        vm.prank(advertiser2);
        vm.expectRevert(PumpFudAdManager.AdSpaceOccupied.selector);
        adManager.rentAdSpace{value: cost}(
            1,
            "ipfs://ad2",
            "https://ad2.com",
            "Ad 2",
            1
        );
    }

    function test_CanRentAfterExpiry() public {
        uint256 cost = adManager.calculateRentalCost(1, 1);

        // First rental
        vm.prank(advertiser1);
        adManager.rentAdSpace{value: cost}(
            1,
            "ipfs://ad1",
            "https://ad1.com",
            "Ad 1",
            1
        );

        // Fast forward past expiry
        vm.warp(block.timestamp + 2 weeks);

        // Now advertiser2 can rent
        vm.prank(advertiser2);
        uint256 adId2 = adManager.rentAdSpace{value: cost}(
            1,
            "ipfs://ad2",
            "https://ad2.com",
            "Ad 2",
            1
        );

        assertEq(adManager.currentAd(1), adId2);
    }

    function test_ExtendAdRental() public {
        uint256 cost = adManager.calculateRentalCost(1, 1);

        // Initial rental
        vm.prank(advertiser1);
        uint256 adId = adManager.rentAdSpace{value: cost}(
            1,
            "ipfs://ad",
            "https://ad.com",
            "Ad",
            1
        );

        (, , , , , , , uint256 endTimeBefore, , ,) = adManager.ads(adId);

        // Extend by 2 more weeks
        uint256 extendCost = adManager.calculateRentalCost(1, 2);
        vm.prank(advertiser1);
        adManager.extendAdRental{value: extendCost}(adId, 2);

        (, , , , , , , uint256 endTimeAfter, uint256 paidAmount, ,) = adManager.ads(adId);

        assertEq(endTimeAfter, endTimeBefore + 2 weeks);
        assertEq(paidAmount, cost + extendCost);
    }

    function test_OnlyAdvertiserCanExtend() public {
        uint256 cost = adManager.calculateRentalCost(1, 1);

        vm.prank(advertiser1);
        uint256 adId = adManager.rentAdSpace{value: cost}(
            1,
            "ipfs://ad",
            "https://ad.com",
            "Ad",
            1
        );

        // Advertiser2 tries to extend
        vm.prank(advertiser2);
        vm.expectRevert(PumpFudAdManager.NotAdvertiser.selector);
        adManager.extendAdRental{value: cost}(adId, 1);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PRICING TESTS
    // ═══════════════════════════════════════════════════════════════════════════

    function test_CalculateRentalCostPremium() public view {
        // Landing Banner (2x premium)
        uint256 cost = adManager.calculateRentalCost(6, 1);
        // Expected: 25000 * 200 / 100 = 50,000 PLS
        assertEq(cost, 50_000 ether);
    }

    function test_CalculateRentalCostNonPremium() public view {
        // Dashboard Sidebar (non-premium, space 7-16)
        uint256 cost = adManager.calculateRentalCost(7, 1);
        // Expected: 25000 * 100 / 100 = 25,000 PLS
        assertEq(cost, 25_000 ether);
    }

    function test_CalculateRentalCostMultipleWeeks() public view {
        // 4 weeks of landing carousel
        uint256 cost = adManager.calculateRentalCost(1, 4);
        // Expected: 25000 * 150 / 100 * 4 = 150,000 PLS
        assertEq(cost, 150_000 ether);
    }

    function test_GlobalCarouselPremium() public view {
        // Global carousel (2.5x premium, spaces 24-28)
        uint256 cost = adManager.calculateRentalCost(24, 1);
        // Expected: 25000 * 250 / 100 = 62,500 PLS
        assertEq(cost, 62_500 ether);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // CAROUSEL TESTS
    // ═══════════════════════════════════════════════════════════════════════════

    function test_CarouselRotation() public {
        // Place 3 owner ads in carousel
        vm.startPrank(deployer);
        uint256 ad1 = adManager.placeOwnerAd(1, "ipfs://1", "https://1.com", "Ad 1", 0);
        uint256 ad2 = adManager.placeOwnerAd(2, "ipfs://2", "https://2.com", "Ad 2", 0);
        uint256 ad3 = adManager.placeOwnerAd(3, "ipfs://3", "https://3.com", "Ad 3", 0);
        vm.stopPrank();

        // Get carousel ads (should rotate)
        uint256 first = adManager.getNextCarouselAd(PumpFudAdManager.AdLocation.LandingCarousel);
        uint256 second = adManager.getNextCarouselAd(PumpFudAdManager.AdLocation.LandingCarousel);
        uint256 third = adManager.getNextCarouselAd(PumpFudAdManager.AdLocation.LandingCarousel);
        uint256 fourth = adManager.getNextCarouselAd(PumpFudAdManager.AdLocation.LandingCarousel);

        // Should cycle through ads
        assertEq(first, ad1);
        assertEq(second, ad2);
        assertEq(third, ad3);
        assertEq(fourth, ad1); // Wraps around
    }

    function test_CarouselCleansExpiredAds() public {
        // Place ad with 1 week duration
        vm.prank(deployer);
        uint256 adId = adManager.placeOwnerAd(1, "ipfs://1", "https://1.com", "Ad 1", 1);

        // Get ad (should work)
        uint256 result = adManager.getNextCarouselAd(PumpFudAdManager.AdLocation.LandingCarousel);
        assertEq(result, adId);

        // Fast forward past expiry
        vm.warp(block.timestamp + 2 weeks);

        // Get carousel should return 0 after cleaning
        result = adManager.getNextCarouselAd(PumpFudAdManager.AdLocation.LandingCarousel);
        assertEq(result, 0);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STATS TESTS
    // ═══════════════════════════════════════════════════════════════════════════

    function test_ImpressionTracking() public {
        vm.prank(deployer);
        uint256 adId = adManager.placeOwnerAd(1, "ipfs://1", "https://1.com", "Ad 1", 0);

        // Get carousel increments impressions
        adManager.getNextCarouselAd(PumpFudAdManager.AdLocation.LandingCarousel);
        adManager.getNextCarouselAd(PumpFudAdManager.AdLocation.LandingCarousel);
        adManager.getNextCarouselAd(PumpFudAdManager.AdLocation.LandingCarousel);

        (uint256 impressions, , ) = adManager.getAdStats(adId);
        assertEq(impressions, 3);
    }

    function test_ClickTracking() public {
        vm.prank(deployer);
        uint256 adId = adManager.placeOwnerAd(1, "ipfs://1", "https://1.com", "Ad 1", 0);

        // Record clicks
        adManager.recordClick(adId);
        adManager.recordClick(adId);

        (, uint256 clicks, ) = adManager.getAdStats(adId);
        assertEq(clicks, 2);
    }

    function test_CTRCalculation() public {
        vm.prank(deployer);
        uint256 adId = adManager.placeOwnerAd(1, "ipfs://1", "https://1.com", "Ad 1", 0);

        // 10 impressions
        for (uint i = 0; i < 10; i++) {
            adManager.getNextCarouselAd(PumpFudAdManager.AdLocation.LandingCarousel);
        }

        // 2 clicks
        adManager.recordClick(adId);
        adManager.recordClick(adId);

        (uint256 impressions, uint256 clicks, uint256 ctr) = adManager.getAdStats(adId);
        assertEq(impressions, 10);
        assertEq(clicks, 2);
        assertEq(ctr, 2000); // 20% CTR in basis points
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // VIEW FUNCTION TESTS
    // ═══════════════════════════════════════════════════════════════════════════

    function test_GetActiveAdsForLocation() public {
        // Place 3 ads
        vm.startPrank(deployer);
        adManager.placeOwnerAd(1, "ipfs://1", "https://1.com", "Ad 1", 0);
        adManager.placeOwnerAd(2, "ipfs://2", "https://2.com", "Ad 2", 0);
        adManager.placeOwnerAd(3, "ipfs://3", "https://3.com", "Ad 3", 0);
        vm.stopPrank();

        PumpFudAdManager.Ad[] memory activeAds = adManager.getActiveAdsForLocation(
            PumpFudAdManager.AdLocation.LandingCarousel
        );

        assertEq(activeAds.length, 3);
    }

    function test_GetSpacesForLocation() public view {
        PumpFudAdManager.AdSpace[] memory spaces = adManager.getSpacesForLocation(
            PumpFudAdManager.AdLocation.LandingCarousel
        );

        assertEq(spaces.length, 5); // 5 carousel slots
    }

    function test_GetCurrentAdForSpace() public {
        vm.prank(deployer);
        uint256 adId = adManager.placeOwnerAd(1, "ipfs://1", "https://1.com", "Ad 1", 0);

        PumpFudAdManager.Ad memory currentAd = adManager.getCurrentAdForSpace(1);
        assertEq(currentAd.id, adId);
    }

    function test_GetCurrentAdForSpaceReturnsEmptyWhenExpired() public {
        vm.prank(deployer);
        adManager.placeOwnerAd(1, "ipfs://1", "https://1.com", "Ad 1", 1);

        // Fast forward
        vm.warp(block.timestamp + 2 weeks);

        PumpFudAdManager.Ad memory currentAd = adManager.getCurrentAdForSpace(1);
        assertEq(currentAd.id, 0);
    }

    function test_GetAvailableSpaces() public {
        // Get initial available (all 28 should have isActive = true but some are non-active by default)
        PumpFudAdManager.AdSpace[] memory available = adManager.getAvailableSpaces();
        uint256 initialAvailable = available.length;
        console2.log("Initial available spaces:", initialAvailable);

        // Rent one space
        uint256 cost = adManager.calculateRentalCost(1, 1);
        vm.prank(advertiser1);
        adManager.rentAdSpace{value: cost}(
            1,
            "ipfs://ad",
            "https://ad.com",
            "Ad",
            1
        );

        // Should have one less available
        available = adManager.getAvailableSpaces();
        assertEq(available.length, initialAvailable - 1);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ADMIN TESTS
    // ═══════════════════════════════════════════════════════════════════════════

    function test_SetWeeklyRate() public {
        vm.prank(deployer);
        adManager.setWeeklyRate(50_000 ether);

        assertEq(adManager.weeklyRatePLS(), 50_000 ether);

        // New rental should use new rate
        uint256 cost = adManager.calculateRentalCost(7, 1); // Non-premium
        assertEq(cost, 50_000 ether);
    }

    function test_OnlyOwnerCanSetWeeklyRate() public {
        vm.prank(advertiser1);
        vm.expectRevert();
        adManager.setWeeklyRate(50_000 ether);
    }

    function test_CreateAdSpace() public {
        vm.prank(deployer);
        uint256 newSpaceId = adManager.createAdSpace(
            PumpFudAdManager.AdLocation.DashboardBanner,
            "Custom Dashboard Banner",
            30_000 ether, // Custom rate
            true,
            175
        );

        assertEq(newSpaceId, 29); // After initial 28

        (
            uint256 id,
            PumpFudAdManager.AdLocation location,
            string memory name,
            uint256 weeklyRate,
            bool isActive,
            bool isPremium,
            uint256 premiumMultiplier
        ) = adManager.adSpaces(newSpaceId);

        assertEq(id, 29);
        assertEq(uint256(location), uint256(PumpFudAdManager.AdLocation.DashboardBanner));
        assertEq(name, "Custom Dashboard Banner");
        assertEq(weeklyRate, 30_000 ether);
        assertTrue(isActive);
        assertTrue(isPremium);
        assertEq(premiumMultiplier, 175);
    }

    function test_UpdateAdSpace() public {
        vm.prank(deployer);
        adManager.updateAdSpace(
            1,
            100_000 ether, // New rate
            true,
            true,
            300 // 3x multiplier
        );

        (
            ,
            ,
            ,
            uint256 weeklyRate,
            bool isActive,
            bool isPremium,
            uint256 premiumMultiplier
        ) = adManager.adSpaces(1);

        assertEq(weeklyRate, 100_000 ether);
        assertTrue(isActive);
        assertTrue(isPremium);
        assertEq(premiumMultiplier, 300);
    }

    function test_DeactivateAdSpace() public {
        vm.prank(deployer);
        adManager.updateAdSpace(1, 0, false, false, 100);

        (, , , , bool isActive, ,) = adManager.adSpaces(1);
        assertFalse(isActive);

        // Cannot rent deactivated space
        uint256 cost = adManager.calculateRentalCost(1, 1);
        vm.prank(advertiser1);
        vm.expectRevert(PumpFudAdManager.AdSpaceNotActive.selector);
        adManager.rentAdSpace{value: cost}(1, "ipfs://ad", "https://ad.com", "Ad", 1);
    }

    function test_EmergencyWithdraw() public {
        // Send some PLS to contract
        vm.deal(address(adManager), 100 ether);

        uint256 treasuryBefore = TREASURY.balance;

        vm.prank(deployer);
        adManager.emergencyWithdraw();

        assertEq(TREASURY.balance, treasuryBefore + 100 ether);
        assertEq(address(adManager).balance, 0);
    }

    function test_OnlyOwnerCanEmergencyWithdraw() public {
        vm.deal(address(adManager), 100 ether);

        vm.prank(advertiser1);
        vm.expectRevert();
        adManager.emergencyWithdraw();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ERROR TESTS
    // ═══════════════════════════════════════════════════════════════════════════

    function test_RevertOnInvalidSpaceId() public {
        vm.prank(deployer);
        vm.expectRevert(PumpFudAdManager.AdSpaceNotFound.selector);
        adManager.placeOwnerAd(999, "ipfs://test", "https://test.com", "Test", 1);
    }

    function test_RevertOnInvalidAdId() public {
        vm.prank(deployer);
        vm.expectRevert(PumpFudAdManager.AdNotFound.selector);
        adManager.removeAd(999);
    }

    function test_RevertOnZeroDuration() public {
        uint256 cost = adManager.calculateRentalCost(1, 1);

        vm.prank(advertiser1);
        vm.expectRevert(PumpFudAdManager.InvalidDuration.selector);
        adManager.rentAdSpace{value: cost}(1, "ipfs://ad", "https://ad.com", "Ad", 0);
    }

    function test_RecordClickInvalidAd() public {
        vm.expectRevert(PumpFudAdManager.AdNotFound.selector);
        adManager.recordClick(999);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // RECEIVE TESTS
    // ═══════════════════════════════════════════════════════════════════════════

    function test_ReceiveEther() public {
        vm.deal(advertiser1, 10 ether);
        vm.prank(advertiser1);
        (bool success,) = address(adManager).call{value: 1 ether}("");
        assertTrue(success);
        assertEq(address(adManager).balance, 1 ether);
    }
}
