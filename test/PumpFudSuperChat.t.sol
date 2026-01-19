// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {PumpFud} from "../src/PumpFud.sol";
import {PumpFudSuperChat} from "../src/PumpFudSuperChat.sol";
import {PumpFudToken} from "../src/PumpFudToken.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract PumpFudSuperChatTest is Test {
    PumpFud public pumpFud;
    PumpFudSuperChat public superChat;

    address public deployer = makeAddr("deployer");
    address public creator = makeAddr("creator");
    address public tipper1 = makeAddr("tipper1");
    address public tipper2 = makeAddr("tipper2");
    address public moderator = makeAddr("moderator");
    address public whale = makeAddr("whale");

    address constant TREASURY = 0x49bBEFa1d94702C0e9a5EAdDEc7c3C5D3eb9086B;

    uint256 public tokenId;
    address public tokenAddress;

    function setUp() public {
        vm.deal(deployer, 1000 ether);
        vm.deal(creator, 1000 ether);
        vm.deal(tipper1, 100_000 ether);
        vm.deal(tipper2, 100_000 ether);
        vm.deal(whale, 500_000 ether);

        vm.startPrank(deployer);
        pumpFud = new PumpFud(TREASURY);
        superChat = new PumpFudSuperChat();
        vm.stopPrank();

        // Launch a token
        vm.prank(creator);
        (tokenId, tokenAddress) = pumpFud.launchToken("Super Chat Test", "SCTIP", "Testing super chats", "ipfs://tip");

        // Buy tokens for tippers (need enough to meet thresholds)
        // 0.5% of 250M = 1.25M tokens minimum for message board
        // 1% of 250M = 2.5M tokens minimum for voice chat
        vm.prank(tipper1);
        pumpFud.buyTokens{value: 10_000 ether}(tokenId, 0);

        vm.prank(tipper2);
        pumpFud.buyTokens{value: 5_000 ether}(tokenId, 0);

        // Whale buys significant amount (5%+ for control)
        vm.prank(whale);
        pumpFud.buyTokens{value: 200_000 ether}(tokenId, 0);
    }

    function test_Deployment() public view {
        assertEq(superChat.TREASURY(), TREASURY);
        assertEq(superChat.platformFeeBps(), 500);
        assertEq(superChat.maxMessageLength(), 280);
        assertEq(superChat.voiceChatThresholdBps(), 100); // 1%
        assertEq(superChat.messageBoardThresholdBps(), 50); // 0.5%
        assertEq(superChat.whaleControlThresholdBps(), 500); // 5%
    }

    function test_TokenGating() public view {
        // Check user status
        PumpFudSuperChat.UserStatus memory status1 = superChat.getUserStatus(tokenAddress, tipper1);
        PumpFudSuperChat.UserStatus memory status2 = superChat.getUserStatus(tokenAddress, tipper2);
        PumpFudSuperChat.UserStatus memory whaleStatus = superChat.getUserStatus(tokenAddress, whale);

        console2.log("Tipper1 balance:", status1.tokenBalance / 1e18);
        console2.log("Tipper1 percent:", status1.balancePercent, "bps");
        console2.log("Tipper1 can voice:", status1.canVoiceChat);
        console2.log("Tipper1 can message:", status1.canMessageBoard);

        console2.log("Whale balance:", whaleStatus.tokenBalance / 1e18);
        console2.log("Whale percent:", whaleStatus.balancePercent, "bps");
        console2.log("Whale can control:", whaleStatus.canControlLive);
    }

    function test_WhaleCanControlLiveChat() public {
        // Whale should be able to control live chat
        assertTrue(superChat.canControlLiveChat(tokenAddress, whale));

        // Regular user should not
        assertFalse(superChat.canControlLiveChat(tokenAddress, tipper1));

        // Owner always can
        assertTrue(superChat.canControlLiveChat(tokenAddress, deployer));
    }

    function test_StartAndEndLiveChat() public {
        // Whale starts live chat
        vm.prank(whale);
        superChat.startLiveChat(tokenAddress);

        (,,,, bool liveChatActive,,,address host,) = superChat.getDashboardInfo(tokenAddress);
        assertTrue(liveChatActive);
        assertEq(host, whale);

        // Whale ends live chat
        vm.prank(whale);
        superChat.endLiveChat(tokenAddress);

        (,,,, liveChatActive,,,host,) = superChat.getDashboardInfo(tokenAddress);
        assertFalse(liveChatActive);
        assertEq(host, address(0));
    }

    function test_OnlyWhaleCanStartLiveChat() public {
        // Regular user cannot start
        vm.prank(tipper1);
        vm.expectRevert(PumpFudSuperChat.NotAuthorizedToControlLive.selector);
        superChat.startLiveChat(tokenAddress);
    }

    function test_SendMessage() public {
        // Get enough tokens to meet threshold
        vm.prank(tipper1);
        pumpFud.buyTokens{value: 50_000 ether}(tokenId, 0);

        // Check can use message board
        assertTrue(superChat.canUseMessageBoard(tokenAddress, tipper1));

        // Send message
        vm.prank(tipper1);
        uint256 msgId = superChat.sendMessage(tokenAddress, "Hello pump.fud!");

        assertEq(msgId, 1);

        // Check dashboard stats
        (uint256 totalMessages,,,) = superChat.getDashboardStats(tokenAddress);
        assertEq(totalMessages, 1);
    }

    function test_InsufficientBalanceForMessage() public {
        address poorUser = makeAddr("poor");
        vm.deal(poorUser, 100 ether);

        // Buy tiny amount
        vm.prank(poorUser);
        pumpFud.buyTokens{value: 1 ether}(tokenId, 0);

        // Should not be able to message
        assertFalse(superChat.canUseMessageBoard(tokenAddress, poorUser));

        vm.prank(poorUser);
        vm.expectRevert(PumpFudSuperChat.InsufficientTokenBalance.selector);
        superChat.sendMessage(tokenAddress, "Can't send this");
    }

    function test_SendSuperChatToUser() public {
        // Get enough tokens
        vm.prank(tipper1);
        pumpFud.buyTokens{value: 50_000 ether}(tokenId, 0);

        uint256 tipAmount = 10_000 * 1e18;

        // Approve and send super chat to tipper2
        vm.startPrank(tipper1);
        IERC20(tokenAddress).approve(address(superChat), tipAmount);
        uint256 msgId = superChat.sendSuperChat(tokenAddress, tipper2, tipAmount, "Nice token bro!");
        vm.stopPrank();

        assertEq(msgId, 1);

        // Check tipper2 received 95%
        uint256 expectedAmount = tipAmount * 95 / 100;
        uint256 tipper2Balance = IERC20(tokenAddress).balanceOf(tipper2);

        // tipper2 had tokens from buying, plus the tip
        assertTrue(tipper2Balance >= expectedAmount);
    }

    function test_CannotSuperChatSelf() public {
        vm.prank(tipper1);
        pumpFud.buyTokens{value: 50_000 ether}(tokenId, 0);

        vm.startPrank(tipper1);
        IERC20(tokenAddress).approve(address(superChat), 1000 * 1e18);

        vm.expectRevert(PumpFudSuperChat.InvalidRecipient.selector);
        superChat.sendSuperChat(tokenAddress, tipper1, 1000 * 1e18, "Self tip");
        vm.stopPrank();
    }

    function test_VoiceChatRequiresActiveLiveChat() public {
        // Get enough for voice chat (1%)
        vm.deal(tipper1, 200_000 ether);
        vm.prank(tipper1);
        pumpFud.buyTokens{value: 80_000 ether}(tokenId, 0);

        // Cannot join voice chat if live chat not active
        vm.prank(tipper1);
        vm.expectRevert(PumpFudSuperChat.LiveChatNotActive.selector);
        superChat.joinVoiceChat(tokenAddress);

        // Whale starts live chat
        vm.prank(whale);
        superChat.startLiveChat(tokenAddress);

        // Now can join
        vm.prank(tipper1);
        superChat.joinVoiceChat(tokenAddress);

        assertTrue(superChat.isInVoiceChat(tokenAddress, tipper1));
    }

    function test_VoiceChatOneAtATime() public {
        // Get enough for voice chat (1%)
        vm.deal(tipper1, 300_000 ether);
        vm.prank(tipper1);
        pumpFud.buyTokens{value: 80_000 ether}(tokenId, 0);

        // Launch second token
        vm.prank(creator);
        (, address token2) = pumpFud.launchToken("Token 2", "T2", "Second token", "ipfs://t2");

        // Buy tokens in second dashboard
        vm.prank(tipper1);
        pumpFud.buyTokens{value: 80_000 ether}(2, 0);

        // Whale buys into second token too
        vm.prank(whale);
        pumpFud.buyTokens{value: 100_000 ether}(2, 0);

        // Start live chats on both tokens
        vm.prank(whale);
        superChat.startLiveChat(tokenAddress);

        vm.prank(whale);
        superChat.startLiveChat(token2);

        // Join first voice chat
        vm.prank(tipper1);
        superChat.joinVoiceChat(tokenAddress);

        assertTrue(superChat.isInVoiceChat(tokenAddress, tipper1));
        assertEq(superChat.getUserVoiceChat(tipper1), tokenAddress);

        // Cannot join second voice chat while in first
        vm.prank(tipper1);
        vm.expectRevert(PumpFudSuperChat.AlreadyInVoiceChat.selector);
        superChat.joinVoiceChat(token2);

        // Leave first chat
        vm.prank(tipper1);
        superChat.leaveVoiceChat(tokenAddress);

        // Now can join second
        vm.prank(tipper1);
        superChat.joinVoiceChat(token2);

        assertEq(superChat.getUserVoiceChat(tipper1), token2);
    }

    function test_MuteUser() public {
        // Get enough for voice chat
        vm.deal(tipper1, 200_000 ether);
        vm.prank(tipper1);
        pumpFud.buyTokens{value: 80_000 ether}(tokenId, 0);

        // Whale can add moderator
        vm.prank(whale);
        superChat.addModerator(tokenAddress, moderator);

        assertTrue(superChat.canModerate(tokenAddress, moderator));

        // Start live chat
        vm.prank(whale);
        superChat.startLiveChat(tokenAddress);

        // Join voice chat
        vm.prank(tipper1);
        superChat.joinVoiceChat(tokenAddress);

        assertTrue(superChat.isInVoiceChat(tokenAddress, tipper1));

        // Moderator mutes user
        vm.prank(moderator);
        superChat.muteUser(tokenAddress, tipper1);

        // User should be kicked from voice chat
        assertFalse(superChat.isInVoiceChat(tokenAddress, tipper1));
        assertTrue(superChat.isUserMuted(tokenAddress, tipper1));

        // Cannot rejoin while muted
        vm.prank(tipper1);
        vm.expectRevert(PumpFudSuperChat.UserIsMuted.selector);
        superChat.joinVoiceChat(tokenAddress);

        // Unmute
        vm.prank(moderator);
        superChat.unmuteUser(tokenAddress, tipper1);

        assertFalse(superChat.isUserMuted(tokenAddress, tipper1));

        // Can rejoin
        vm.prank(tipper1);
        superChat.joinVoiceChat(tokenAddress);
        assertTrue(superChat.isInVoiceChat(tokenAddress, tipper1));
    }

    function test_OnlyModeratorCanMute() public {
        vm.deal(tipper1, 200_000 ether);
        vm.prank(tipper1);
        pumpFud.buyTokens{value: 80_000 ether}(tokenId, 0);

        // Random user cannot mute
        vm.prank(tipper2);
        vm.expectRevert(PumpFudSuperChat.NotModerator.selector);
        superChat.muteUser(tokenAddress, tipper1);
    }

    function test_TipTiers() public view {
        assertEq(uint256(superChat.previewTier(500 * 1e18, false)), uint256(PumpFudSuperChat.TipTier.Basic));
        assertEq(uint256(superChat.previewTier(1_000 * 1e18, false)), uint256(PumpFudSuperChat.TipTier.Bronze));
        assertEq(uint256(superChat.previewTier(10_000 * 1e18, false)), uint256(PumpFudSuperChat.TipTier.Silver));
        assertEq(uint256(superChat.previewTier(100_000 * 1e18, false)), uint256(PumpFudSuperChat.TipTier.Gold));
        assertEq(uint256(superChat.previewTier(1_000_000 * 1e18, false)), uint256(PumpFudSuperChat.TipTier.Diamond));
    }

    function test_GetRecentMessages() public {
        vm.prank(tipper1);
        pumpFud.buyTokens{value: 50_000 ether}(tokenId, 0);

        vm.startPrank(tipper1);
        superChat.sendMessage(tokenAddress, "Message 1");
        superChat.sendMessage(tokenAddress, "Message 2");
        superChat.sendMessage(tokenAddress, "Message 3");
        vm.stopPrank();

        PumpFudSuperChat.Message[] memory recent = superChat.getRecentMessages(tokenAddress, 2);

        assertEq(recent.length, 2);
        assertEq(recent[0].id, 3); // Most recent first
        assertEq(recent[1].id, 2);
    }

    function test_DashboardStats() public {
        vm.prank(tipper1);
        pumpFud.buyTokens{value: 50_000 ether}(tokenId, 0);

        vm.prank(tipper2);
        pumpFud.buyTokens{value: 50_000 ether}(tokenId, 0);

        // Send messages from both users
        vm.prank(tipper1);
        superChat.sendMessage(tokenAddress, "First message");

        vm.prank(tipper2);
        superChat.sendMessage(tokenAddress, "Second message");

        vm.prank(tipper1);
        superChat.sendMessage(tokenAddress, "Third message");

        (uint256 totalMessages, uint256 totalTips, uint256 uniqueParticipants,) =
            superChat.getDashboardStats(tokenAddress);

        assertEq(totalMessages, 3);
        assertEq(totalTips, 0);
        assertEq(uniqueParticipants, 2);
    }

    function test_MessageTooLong() public {
        vm.prank(tipper1);
        pumpFud.buyTokens{value: 50_000 ether}(tokenId, 0);

        // 350 characters - well over the 280 limit
        string memory longMessage = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

        vm.prank(tipper1);
        vm.expectRevert(PumpFudSuperChat.MessageTooLong.selector);
        superChat.sendMessage(tokenAddress, longMessage);
    }

    function test_DashboardShutdown() public {
        vm.prank(tipper1);
        pumpFud.buyTokens{value: 50_000 ether}(tokenId, 0);

        // Owner shuts down dashboard
        vm.prank(deployer);
        superChat.shutdownDashboard(tokenAddress);

        // Check shutdown status
        (,,,,,,bool isShutdown,,) = superChat.getDashboardInfo(tokenAddress);
        assertTrue(isShutdown);

        // Cannot send messages when shutdown
        vm.prank(tipper1);
        vm.expectRevert(PumpFudSuperChat.DashboardIsShutdown.selector);
        superChat.sendMessage(tokenAddress, "Hello");

        // Cannot start live chat when shutdown
        vm.prank(whale);
        vm.expectRevert(PumpFudSuperChat.DashboardIsShutdown.selector);
        superChat.startLiveChat(tokenAddress);

        // Owner reopens
        vm.prank(deployer);
        superChat.reopenDashboard(tokenAddress);

        // Now can send messages
        vm.prank(tipper1);
        superChat.sendMessage(tokenAddress, "We're back!");
    }

    function test_WhaleRegistration() public {
        // Self-register as whale
        vm.prank(whale);
        superChat.registerWhale(tokenAddress, whale);

        PumpFudSuperChat.UserStatus memory status = superChat.getUserStatus(tokenAddress, whale);
        assertTrue(status.isWhale);
    }

    function test_AdminFunctions() public {
        vm.startPrank(deployer);

        superChat.setVoiceChatThreshold(200); // 2%
        assertEq(superChat.voiceChatThresholdBps(), 200);

        superChat.setMessageBoardThreshold(100); // 1%
        assertEq(superChat.messageBoardThresholdBps(), 100);

        superChat.setWhaleControlThreshold(1000); // 10%
        assertEq(superChat.whaleControlThresholdBps(), 1000);

        superChat.setPlatformFeeBps(300); // 3%
        assertEq(superChat.platformFeeBps(), 300);

        superChat.setMaxMessageLength(500);
        assertEq(superChat.maxMessageLength(), 500);

        superChat.setTierThresholdsPLS(50 ether, 500 ether, 5000 ether, 50000 ether);
        assertEq(superChat.bronzeThresholdPLS(), 50 ether);
        assertEq(superChat.diamondThresholdPLS(), 50000 ether);

        vm.stopPrank();
    }
}
