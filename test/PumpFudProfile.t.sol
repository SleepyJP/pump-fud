// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {PumpFudProfile} from "../src/PumpFudProfile.sol";

contract PumpFudProfileTest is Test {
    PumpFudProfile public profile;

    address public owner = address(this);
    address public user1 = address(0x1);
    address public user2 = address(0x2);
    address public user3 = address(0x3);

    function setUp() public {
        profile = new PumpFudProfile();
    }

    // ============ DEPLOYMENT TESTS ============

    function test_Deployment() public view {
        assertEq(profile.owner(), owner);
        assertEq(profile.profileCreationFee(), 0);
        assertEq(profile.cultCreationFee(), 100_000 ether);
        assertEq(profile.premiumProfileFee(), 10_000 ether);
        assertEq(profile.cultCount(), 0);
    }

    // ============ PROFILE CREATION TESTS ============

    function test_CreateProfile() public {
        vm.deal(user1, 1 ether);
        vm.prank(user1);
        profile.createProfile("TestUser", "ipfs://avatar", "Test bio");

        PumpFudProfile.Profile memory p = profile.getProfile(user1);
        assertEq(p.wallet, user1);
        assertEq(p.displayName, "TestUser");
        assertEq(p.avatarUri, "ipfs://avatar");
        assertEq(p.bio, "Test bio");
        assertEq(p.cultId, 0);
        assertTrue(p.exists);
        assertFalse(p.isPremium);
        assertFalse(p.isVerified);
    }

    function test_CannotCreateDuplicateProfile() public {
        vm.prank(user1);
        profile.createProfile("User1", "", "");

        vm.prank(user1);
        vm.expectRevert(PumpFudProfile.ProfileAlreadyExists.selector);
        profile.createProfile("User1Again", "", "");
    }

    function test_ProfileCreationWithFee() public {
        profile.setProfileCreationFee(100 ether);

        vm.deal(user1, 200 ether);
        vm.prank(user1);
        profile.createProfile{value: 100 ether}("TestUser", "", "");

        assertTrue(profile.getProfile(user1).exists);
    }

    function test_ProfileCreationInsufficientFee() public {
        profile.setProfileCreationFee(100 ether);

        vm.deal(user1, 50 ether);
        vm.prank(user1);
        vm.expectRevert(PumpFudProfile.InsufficientPayment.selector);
        profile.createProfile{value: 50 ether}("TestUser", "", "");
    }

    // ============ PROFILE UPDATE TESTS ============

    function test_UpdateProfile() public {
        vm.prank(user1);
        profile.createProfile("OldName", "", "");

        vm.prank(user1);
        profile.updateProfile("OldName", "ipfs://new", "ipfs://banner", "New bio");

        PumpFudProfile.Profile memory p = profile.getProfile(user1);
        assertEq(p.displayName, "OldName"); // Name stayed same
        assertEq(p.avatarUri, "ipfs://new");
        assertEq(p.bannerUri, "ipfs://banner");
        assertEq(p.bio, "New bio");
    }

    function test_CannotUpdateNonexistentProfile() public {
        vm.prank(user1);
        vm.expectRevert(PumpFudProfile.ProfileNotFound.selector);
        profile.updateProfile("Name", "", "", "");
    }

    // ============ CULT TESTS ============

    function test_CreateCult() public {
        vm.prank(user1);
        profile.createProfile("Leader", "", "");

        vm.deal(user1, 200_000 ether);
        vm.prank(user1);
        uint256 cultId = profile.createCult{value: 100_000 ether}(
            "Test Cult",
            "TC",
            "ipfs://patch",
            "A test cult",
            true
        );

        assertEq(cultId, 1);
        assertEq(profile.cultCount(), 1);

        PumpFudProfile.Cult memory cult = profile.getCult(1);
        assertEq(cult.name, "Test Cult");
        assertEq(cult.tag, "TC");
        assertEq(cult.imageUri, "ipfs://patch");
        assertEq(cult.description, "A test cult");
        assertEq(cult.founder, user1);
        assertEq(cult.leader, user1);
        assertEq(cult.memberCount, 1);
        assertTrue(cult.isPublic);
        assertTrue(cult.isActive);

        // Creator should be in cult
        PumpFudProfile.Profile memory p = profile.getProfile(user1);
        assertEq(p.cultId, 1);
    }

    function test_CannotCreateCultWithoutProfile() public {
        vm.deal(user1, 200_000 ether);
        vm.prank(user1);
        vm.expectRevert(PumpFudProfile.ProfileNotFound.selector);
        profile.createCult{value: 100_000 ether}("Test", "T", "", "", true);
    }

    function test_CreateCultInsufficientFee() public {
        vm.prank(user1);
        profile.createProfile("User", "", "");

        vm.deal(user1, 50_000 ether);
        vm.prank(user1);
        vm.expectRevert(PumpFudProfile.InsufficientPayment.selector);
        profile.createCult{value: 50_000 ether}("Test", "T", "", "", true);
    }

    function test_JoinPublicCult() public {
        // Create cult
        vm.prank(user1);
        profile.createProfile("Leader", "", "");
        vm.deal(user1, 200_000 ether);
        vm.prank(user1);
        profile.createCult{value: 100_000 ether}("Public Cult", "PC", "", "", true);

        // User2 creates profile and joins
        vm.prank(user2);
        profile.createProfile("Member", "", "");
        vm.prank(user2);
        profile.joinCult(1);

        PumpFudProfile.Profile memory p = profile.getProfile(user2);
        assertEq(p.cultId, 1);

        PumpFudProfile.Cult memory cult = profile.getCult(1);
        assertEq(cult.memberCount, 2);
    }

    function test_CannotJoinPrivateCultWithoutInvite() public {
        // Create private cult
        vm.prank(user1);
        profile.createProfile("Leader", "", "");
        vm.deal(user1, 200_000 ether);
        vm.prank(user1);
        profile.createCult{value: 100_000 ether}("Private Cult", "PRV", "", "", false);

        // User2 tries to join
        vm.prank(user2);
        profile.createProfile("User2", "", "");
        vm.prank(user2);
        vm.expectRevert(PumpFudProfile.InvalidCult.selector);
        profile.joinCult(1);
    }

    function test_JoinPrivateCultWithInvite() public {
        // Create private cult
        vm.prank(user1);
        profile.createProfile("Leader", "", "");
        vm.deal(user1, 200_000 ether);
        vm.prank(user1);
        profile.createCult{value: 100_000 ether}("Private Cult", "PRV", "", "", false);

        // User2 creates profile
        vm.prank(user2);
        profile.createProfile("User2", "", "");

        // Leader invites user2
        vm.prank(user1);
        profile.inviteToCult(1, user2);

        // User2 should now be in the cult (inviteToCult adds them directly)
        assertEq(profile.getProfile(user2).cultId, 1);
    }

    function test_LeaveCult() public {
        // Setup cult with member
        vm.prank(user1);
        profile.createProfile("Leader", "", "");
        vm.deal(user1, 200_000 ether);
        vm.prank(user1);
        profile.createCult{value: 100_000 ether}("Test Cult", "TC", "", "", true);

        vm.prank(user2);
        profile.createProfile("Member", "", "");
        vm.prank(user2);
        profile.joinCult(1);

        // User2 leaves
        vm.prank(user2);
        profile.leaveCult();

        assertEq(profile.getProfile(user2).cultId, 0);
        assertEq(profile.getCult(1).memberCount, 1);
    }

    function test_LeaderCannotLeaveCult() public {
        vm.prank(user1);
        profile.createProfile("Leader", "", "");
        vm.deal(user1, 200_000 ether);
        vm.prank(user1);
        profile.createCult{value: 100_000 ether}("Test Cult", "TC", "", "", true);

        vm.prank(user1);
        vm.expectRevert(PumpFudProfile.NotCultLeader.selector);
        profile.leaveCult();
    }

    function test_TransferCultLeadership() public {
        // Create cult
        vm.prank(user1);
        profile.createProfile("Leader", "", "");
        vm.deal(user1, 200_000 ether);
        vm.prank(user1);
        profile.createCult{value: 100_000 ether}("Test Cult", "TC", "", "", true);

        // Add member
        vm.prank(user2);
        profile.createProfile("NewLeader", "", "");
        vm.prank(user2);
        profile.joinCult(1);

        // Transfer leadership
        vm.prank(user1);
        profile.transferCultLeadership(1, user2);

        assertEq(profile.getCult(1).leader, user2);
    }

    // ============ FOLLOW SYSTEM TESTS ============

    function test_FollowUser() public {
        vm.prank(user1);
        profile.createProfile("User1", "", "");
        vm.prank(user2);
        profile.createProfile("User2", "", "");

        vm.prank(user1);
        profile.follow(user2);

        assertTrue(profile.isFollowing(user1, user2));

        PumpFudProfile.ProfileStats memory statsUser2 = profile.getStats(user2);
        assertEq(statsUser2.followerCount, 1);

        PumpFudProfile.ProfileStats memory statsUser1 = profile.getStats(user1);
        assertEq(statsUser1.followingCount, 1);
    }

    function test_UnfollowUser() public {
        vm.prank(user1);
        profile.createProfile("User1", "", "");
        vm.prank(user2);
        profile.createProfile("User2", "", "");

        vm.prank(user1);
        profile.follow(user2);
        vm.prank(user1);
        profile.unfollow(user2);

        assertFalse(profile.isFollowing(user1, user2));

        PumpFudProfile.ProfileStats memory statsUser2 = profile.getStats(user2);
        assertEq(statsUser2.followerCount, 0);
    }

    function test_CannotFollowSelf() public {
        vm.prank(user1);
        profile.createProfile("User1", "", "");

        vm.prank(user1);
        vm.expectRevert(PumpFudProfile.CannotFollowSelf.selector);
        profile.follow(user1);
    }

    function test_CannotFollowTwice() public {
        vm.prank(user1);
        profile.createProfile("User1", "", "");
        vm.prank(user2);
        profile.createProfile("User2", "", "");

        vm.prank(user1);
        profile.follow(user2);

        vm.prank(user1);
        vm.expectRevert(PumpFudProfile.AlreadyFollowing.selector);
        profile.follow(user2);
    }

    // ============ BADGE TESTS ============

    function test_AwardBadge() public {
        vm.prank(user1);
        profile.createProfile("User1", "", "");

        // Owner awards badge (badge ID 1 is EARLY_ADOPTER from defaults)
        profile.awardBadge(user1, 1);

        uint256[] memory badges = profile.getUserBadges(user1);
        assertEq(badges.length, 1);
        assertEq(badges[0], 1);
        assertTrue(profile.hasBadge(user1, 1));
    }

    function test_OnlyOwnerCanAwardBadge() public {
        vm.prank(user1);
        profile.createProfile("User1", "", "");

        vm.prank(user2);
        vm.expectRevert();
        profile.awardBadge(user1, 1);
    }

    // ============ PREMIUM & VERIFICATION TESTS ============

    function test_UpgradeToPremium() public {
        vm.prank(user1);
        profile.createProfile("User1", "", "");

        vm.deal(user1, 20_000 ether);
        vm.prank(user1);
        profile.upgradeToPremium{value: 10_000 ether}();

        assertTrue(profile.getProfile(user1).isPremium);
    }

    function test_PremiumInsufficientFee() public {
        vm.prank(user1);
        profile.createProfile("User1", "", "");

        vm.deal(user1, 5_000 ether);
        vm.prank(user1);
        vm.expectRevert(PumpFudProfile.InsufficientPayment.selector);
        profile.upgradeToPremium{value: 5_000 ether}();
    }

    // ============ ADMIN TESTS ============

    function test_SetFees() public {
        profile.setProfileCreationFee(50 ether);
        profile.setCultCreationFee(500 ether);
        profile.setPremiumProfileFee(5_000 ether);

        assertEq(profile.profileCreationFee(), 50 ether);
        assertEq(profile.cultCreationFee(), 500 ether);
        assertEq(profile.premiumProfileFee(), 5_000 ether);
    }

    function test_OnlyOwnerCanSetFees() public {
        vm.prank(user1);
        vm.expectRevert();
        profile.setProfileCreationFee(100 ether);
    }

    // ============ VIEW FUNCTION TESTS ============

    function test_GetCultMembers() public {
        // Create cult
        vm.prank(user1);
        profile.createProfile("Leader", "", "");
        vm.deal(user1, 200_000 ether);
        vm.prank(user1);
        profile.createCult{value: 100_000 ether}("Test Cult", "TC", "", "", true);

        // Add members
        vm.prank(user2);
        profile.createProfile("Member1", "", "");
        vm.prank(user2);
        profile.joinCult(1);

        vm.prank(user3);
        profile.createProfile("Member2", "", "");
        vm.prank(user3);
        profile.joinCult(1);

        address[] memory members = profile.getCultMembers(1);
        assertEq(members.length, 3);
        assertEq(members[0], user1);
        assertEq(members[1], user2);
        assertEq(members[2], user3);
    }

    function test_HasProfile() public {
        assertFalse(profile.getProfile(user1).exists);

        vm.prank(user1);
        profile.createProfile("User1", "", "");

        assertTrue(profile.getProfile(user1).exists);
    }

    function test_NameTaken() public {
        vm.prank(user1);
        profile.createProfile("TestName", "", "");

        vm.prank(user2);
        vm.expectRevert(PumpFudProfile.NameTaken.selector);
        profile.createProfile("TestName", "", "");
    }

    function test_NameTooLong() public {
        vm.prank(user1);
        vm.expectRevert(PumpFudProfile.NameTooLong.selector);
        profile.createProfile("ThisNameIsWayTooLongForTheMaximumLength", "", "");
    }
}
