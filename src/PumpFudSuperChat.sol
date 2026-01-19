// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PumpFudSuperChat
 * @notice Live chat & super chat system for pump.fud token dashboards
 * @dev Token-gated social features for each token's dashboard
 *
 * TWO SEPARATE WINDOWS:
 * 1. LIVE VOICE CHAT (Telegram-style):
 *    - Floating window, minimizable to taskbar
 *    - Mute/unmute self, listen only, or full live
 *    - Requires 1% token supply
 *    - WHALE (largest holder) controls start/stop
 *
 * 2. LIVE MESSAGE BOARD (YouTube Live-style):
 *    - Text chat with super chat tipping
 *    - Requires 0.5% token supply
 *    - Super chat with dashboard token to any user
 *
 * CONTROL:
 * - Largest token holder (whale) can start/stop live chat
 * - Platform owner can shutdown ANY dashboard (emergency)
 * - All parameters adjustable via admin functions
 */
contract PumpFudSuperChat is ReentrancyGuard, Ownable {
    address public constant TREASURY = 0x49bBEFa1d94702C0e9a5EAdDEc7c3C5D3eb9086B;

    // Token gating thresholds (basis points of total supply)
    uint256 public voiceChatThresholdBps = 100;   // 1% to speak in voice chat
    uint256 public messageBoardThresholdBps = 50; // 0.5% to post messages
    uint256 public whaleControlThresholdBps = 500; // 5% to control live chat (adjustable)
    uint256 public constant BPS_DENOMINATOR = 10000;

    // Tip tiers - TOKEN amounts (adjustable)
    uint256 public bronzeThreshold = 1_000 * 1e18;
    uint256 public silverThreshold = 10_000 * 1e18;
    uint256 public goldThreshold = 100_000 * 1e18;
    uint256 public diamondThreshold = 1_000_000 * 1e18;

    // Tip tiers - PLS amounts (adjustable)
    uint256 public bronzeThresholdPLS = 100 ether;
    uint256 public silverThresholdPLS = 1_000 ether;
    uint256 public goldThresholdPLS = 10_000 ether;
    uint256 public diamondThresholdPLS = 100_000 ether;

    // Platform fee (basis points)
    uint256 public platformFeeBps = 500; // 5% to treasury
    uint256 public constant MAX_FEE_BPS = 1000; // Max 10%

    // Message length limits
    uint256 public maxMessageLength = 280;

    enum TipTier {
        Basic,
        Bronze,
        Silver,
        Gold,
        Diamond
    }

    enum MessageType {
        Chat,       // Regular message
        SuperChat,  // Tipped message
        VoiceJoin,  // User joined voice
        VoiceLeave  // User left voice
    }

    struct Message {
        uint256 id;
        address token;         // Dashboard token
        address sender;
        address recipient;     // Zero for regular chat, user address for super chat
        uint256 tipAmount;     // 0 for regular messages
        TipTier tier;
        MessageType msgType;
        string content;
        uint256 timestamp;
    }

    struct TokenDashboard {
        uint256 totalMessages;
        uint256 totalTips;
        uint256 uniqueParticipants;
        uint256 activeVoiceUsers;
        bool isLiveChatActive;      // Voice chat session active
        bool isMessageBoardActive;  // Message board active
        bool isShutdown;            // Platform admin shutdown
        address liveChatHost;       // Who started the live chat
        uint256 liveChatStartedAt;
    }

    struct UserStatus {
        bool canVoiceChat;      // Has 1% supply
        bool canMessageBoard;   // Has 0.5% supply
        bool canControlLive;    // Has whale threshold (5%+)
        bool isWhale;           // Is largest known holder
        uint256 tokenBalance;
        uint256 balancePercent; // In BPS
    }

    // State
    uint256 public messageCount;
    mapping(uint256 => Message) public messages;
    mapping(address => TokenDashboard) public dashboards;
    mapping(address => mapping(address => bool)) public hasParticipated; // token => user => participated
    mapping(address => uint256[]) public tokenMessages; // token => message IDs
    mapping(address => uint256[]) public userMessages;  // user => message IDs
    mapping(address => mapping(address => bool)) public inVoiceChat; // token => user => in voice

    // User can only be in ONE voice chat at a time
    mapping(address => address) public userCurrentVoiceChat; // user => token they're in (0 = none)

    // Moderation - muted users per token
    mapping(address => mapping(address => bool)) public isMuted; // token => user => muted
    mapping(address => mapping(address => bool)) public isModerator; // token => user => is mod

    // Whale tracking - registered largest holder per token (updated off-chain or by owner)
    mapping(address => address) public registeredWhale; // token => whale address
    mapping(address => uint256) public registeredWhaleBalance; // token => whale balance at registration

    // Events
    event MessageSent(
        uint256 indexed id,
        address indexed token,
        address indexed sender,
        MessageType msgType,
        string content,
        uint256 timestamp
    );

    event SuperChatSent(
        uint256 indexed id,
        address indexed token,
        address indexed sender,
        address recipient,
        uint256 amount,
        TipTier tier,
        string message,
        uint256 timestamp
    );

    event VoiceChatJoined(address indexed token, address indexed user, uint256 timestamp);
    event VoiceChatLeft(address indexed token, address indexed user, uint256 timestamp);
    event UserMuted(address indexed token, address indexed user, address indexed moderator, uint256 timestamp);
    event UserUnmuted(address indexed token, address indexed user, address indexed moderator, uint256 timestamp);
    event ModeratorAdded(address indexed token, address indexed user, uint256 timestamp);
    event ModeratorRemoved(address indexed token, address indexed user, uint256 timestamp);

    // Live chat control events
    event LiveChatStarted(address indexed token, address indexed host, uint256 timestamp);
    event LiveChatEnded(address indexed token, address indexed host, uint256 timestamp);
    event MessageBoardToggled(address indexed token, bool active, uint256 timestamp);
    event DashboardShutdown(address indexed token, uint256 timestamp);
    event DashboardReopened(address indexed token, uint256 timestamp);
    event WhaleRegistered(address indexed token, address indexed whale, uint256 balance, uint256 timestamp);

    // Errors
    error InsufficientTokenBalance();
    error ZeroAmount();
    error MessageTooLong();
    error TransferFailed();
    error InvalidToken();
    error InvalidRecipient();
    error NotInVoiceChat();
    error AlreadyInVoiceChat();
    error UserIsMuted();
    error NotModerator();
    error DashboardIsShutdown();
    error LiveChatNotActive();
    error LiveChatAlreadyActive();
    error NotAuthorizedToControlLive();
    error MessageBoardNotActive();

    constructor() Ownable(msg.sender) {}

    // ═══════════════════════════════════════════════════════════════════════════
    // MODIFIERS
    // ═══════════════════════════════════════════════════════════════════════════

    modifier notShutdown(address token) {
        if (dashboards[token].isShutdown) revert DashboardIsShutdown();
        _;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // TOKEN GATING & WHALE CHECKS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Check if user meets voice chat threshold (1% supply)
     */
    function canUseVoiceChat(address token, address user) public view returns (bool) {
        uint256 totalSupply = IERC20(token).totalSupply();
        if (totalSupply == 0) return false;

        uint256 balance = IERC20(token).balanceOf(user);
        uint256 balanceBps = (balance * BPS_DENOMINATOR) / totalSupply;

        return balanceBps >= voiceChatThresholdBps;
    }

    /**
     * @notice Check if user meets message board threshold (0.5% supply)
     */
    function canUseMessageBoard(address token, address user) public view returns (bool) {
        uint256 totalSupply = IERC20(token).totalSupply();
        if (totalSupply == 0) return false;

        uint256 balance = IERC20(token).balanceOf(user);
        uint256 balanceBps = (balance * BPS_DENOMINATOR) / totalSupply;

        return balanceBps >= messageBoardThresholdBps;
    }

    /**
     * @notice Check if user can control live chat (whale threshold OR registered whale OR owner)
     */
    function canControlLiveChat(address token, address user) public view returns (bool) {
        // Platform owner always can
        if (user == owner()) return true;

        // Registered whale can
        if (registeredWhale[token] == user) {
            // Verify they still hold at least the registered amount
            uint256 currentBalance = IERC20(token).balanceOf(user);
            if (currentBalance >= registeredWhaleBalance[token]) return true;
        }

        // Anyone with whale threshold can
        uint256 totalSupply = IERC20(token).totalSupply();
        if (totalSupply == 0) return false;

        uint256 balance = IERC20(token).balanceOf(user);
        uint256 balanceBps = (balance * BPS_DENOMINATOR) / totalSupply;

        return balanceBps >= whaleControlThresholdBps;
    }

    /**
     * @notice Get full user status for a token dashboard
     */
    function getUserStatus(address token, address user) external view returns (UserStatus memory status) {
        uint256 totalSupply = IERC20(token).totalSupply();
        uint256 balance = IERC20(token).balanceOf(user);

        status.tokenBalance = balance;
        if (totalSupply > 0) {
            status.balancePercent = (balance * BPS_DENOMINATOR) / totalSupply;
        }
        status.canVoiceChat = status.balancePercent >= voiceChatThresholdBps;
        status.canMessageBoard = status.balancePercent >= messageBoardThresholdBps;
        status.canControlLive = canControlLiveChat(token, user);
        status.isWhale = registeredWhale[token] == user;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // LIVE VOICE CHAT CONTROL (Telegram-style window)
    // Whale (largest holder) or owner can start/stop
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Start a live voice chat session
     * @dev Only whale or owner can start
     */
    function startLiveChat(address token) external notShutdown(token) {
        if (!canControlLiveChat(token, msg.sender)) revert NotAuthorizedToControlLive();
        if (dashboards[token].isLiveChatActive) revert LiveChatAlreadyActive();

        dashboards[token].isLiveChatActive = true;
        dashboards[token].liveChatHost = msg.sender;
        dashboards[token].liveChatStartedAt = block.timestamp;

        emit LiveChatStarted(token, msg.sender, block.timestamp);
    }

    /**
     * @notice End a live voice chat session
     * @dev Host, whale, or owner can end
     */
    function endLiveChat(address token) external {
        TokenDashboard storage d = dashboards[token];
        if (!d.isLiveChatActive) revert LiveChatNotActive();

        // Host, any whale, or owner can end
        bool canEnd = msg.sender == d.liveChatHost ||
                      canControlLiveChat(token, msg.sender) ||
                      msg.sender == owner();
        if (!canEnd) revert NotAuthorizedToControlLive();

        d.isLiveChatActive = false;
        d.liveChatHost = address(0);

        emit LiveChatEnded(token, msg.sender, block.timestamp);
    }

    /**
     * @notice Toggle message board active state
     */
    function toggleMessageBoard(address token, bool active) external notShutdown(token) {
        if (!canControlLiveChat(token, msg.sender)) revert NotAuthorizedToControlLive();

        dashboards[token].isMessageBoardActive = active;
        emit MessageBoardToggled(token, active, block.timestamp);
    }

    /**
     * @notice Check if live chat is active
     */
    function isLiveChatActive(address token) external view returns (bool) {
        return dashboards[token].isLiveChatActive && !dashboards[token].isShutdown;
    }

    /**
     * @notice Check if message board is active
     */
    function isMessageBoardActive(address token) external view returns (bool) {
        return dashboards[token].isMessageBoardActive && !dashboards[token].isShutdown;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // MESSAGE BOARD (0.5% REQUIRED) - YouTube Live style
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Send a message to token dashboard chat
     * @param token Dashboard token address
     * @param content Message content
     */
    function sendMessage(
        address token,
        string calldata content
    ) external nonReentrant notShutdown(token) returns (uint256 messageId) {
        if (!canUseMessageBoard(token, msg.sender)) revert InsufficientTokenBalance();
        if (bytes(content).length > maxMessageLength) revert MessageTooLong();
        if (bytes(content).length == 0) revert ZeroAmount();

        messageCount++;
        messageId = messageCount;

        messages[messageId] = Message({
            id: messageId,
            token: token,
            sender: msg.sender,
            recipient: address(0),
            tipAmount: 0,
            tier: TipTier.Basic,
            msgType: MessageType.Chat,
            content: content,
            timestamp: block.timestamp
        });

        // Update indices
        tokenMessages[token].push(messageId);
        userMessages[msg.sender].push(messageId);

        // Update stats
        dashboards[token].totalMessages++;
        if (!hasParticipated[token][msg.sender]) {
            hasParticipated[token][msg.sender] = true;
            dashboards[token].uniqueParticipants++;
        }

        emit MessageSent(messageId, token, msg.sender, MessageType.Chat, content, block.timestamp);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SUPER CHAT - TIP ANY USER (0.5% REQUIRED + TOKENS)
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Send super chat tip to another user in the chat
     * @param token Dashboard token (also the tip currency)
     * @param recipient User to tip (can be anyone in chat)
     * @param amount Token amount to tip
     * @param content Super chat message
     */
    function sendSuperChat(
        address token,
        address recipient,
        uint256 amount,
        string calldata content
    ) external nonReentrant notShutdown(token) returns (uint256 messageId) {
        if (!canUseMessageBoard(token, msg.sender)) revert InsufficientTokenBalance();
        if (amount == 0) revert ZeroAmount();
        if (bytes(content).length > maxMessageLength) revert MessageTooLong();
        if (recipient == address(0)) revert InvalidRecipient();
        if (recipient == msg.sender) revert InvalidRecipient();

        IERC20 tokenContract = IERC20(token);

        // Transfer tokens from sender
        bool success = tokenContract.transferFrom(msg.sender, address(this), amount);
        if (!success) revert TransferFailed();

        // Calculate fee
        uint256 fee = (amount * platformFeeBps) / BPS_DENOMINATOR;
        uint256 recipientAmount = amount - fee;

        // Send to recipient
        if (recipientAmount > 0) {
            success = tokenContract.transfer(recipient, recipientAmount);
            if (!success) revert TransferFailed();
        }

        // Send fee to treasury
        if (fee > 0) {
            success = tokenContract.transfer(TREASURY, fee);
            if (!success) revert TransferFailed();
        }

        // Determine tier
        TipTier tier = _getTier(amount);

        // Create message
        messageCount++;
        messageId = messageCount;

        messages[messageId] = Message({
            id: messageId,
            token: token,
            sender: msg.sender,
            recipient: recipient,
            tipAmount: amount,
            tier: tier,
            msgType: MessageType.SuperChat,
            content: content,
            timestamp: block.timestamp
        });

        // Update indices
        tokenMessages[token].push(messageId);
        userMessages[msg.sender].push(messageId);

        // Update stats
        dashboards[token].totalMessages++;
        dashboards[token].totalTips += amount;
        if (!hasParticipated[token][msg.sender]) {
            hasParticipated[token][msg.sender] = true;
            dashboards[token].uniqueParticipants++;
        }

        emit SuperChatSent(messageId, token, msg.sender, recipient, amount, tier, content, block.timestamp);
        emit MessageSent(messageId, token, msg.sender, MessageType.SuperChat, content, block.timestamp);
    }

    /**
     * @notice Send super chat with PLS (native token)
     */
    function sendSuperChatPLS(
        address token,
        address recipient,
        string calldata content
    ) external payable nonReentrant notShutdown(token) returns (uint256 messageId) {
        if (!canUseMessageBoard(token, msg.sender)) revert InsufficientTokenBalance();
        if (msg.value == 0) revert ZeroAmount();
        if (bytes(content).length > maxMessageLength) revert MessageTooLong();
        if (recipient == address(0)) revert InvalidRecipient();
        if (recipient == msg.sender) revert InvalidRecipient();

        // Calculate fee
        uint256 fee = (msg.value * platformFeeBps) / BPS_DENOMINATOR;
        uint256 recipientAmount = msg.value - fee;

        // Send to recipient
        if (recipientAmount > 0) {
            (bool sent,) = recipient.call{value: recipientAmount}("");
            if (!sent) revert TransferFailed();
        }

        // Send fee to treasury
        if (fee > 0) {
            (bool sent,) = TREASURY.call{value: fee}("");
            if (!sent) revert TransferFailed();
        }

        // Determine tier (PLS amounts)
        TipTier tier = _getTierPLS(msg.value);

        // Create message
        messageCount++;
        messageId = messageCount;

        messages[messageId] = Message({
            id: messageId,
            token: token,
            sender: msg.sender,
            recipient: recipient,
            tipAmount: msg.value,
            tier: tier,
            msgType: MessageType.SuperChat,
            content: content,
            timestamp: block.timestamp
        });

        // Update indices
        tokenMessages[token].push(messageId);
        userMessages[msg.sender].push(messageId);

        // Update stats
        dashboards[token].totalMessages++;
        if (!hasParticipated[token][msg.sender]) {
            hasParticipated[token][msg.sender] = true;
            dashboards[token].uniqueParticipants++;
        }

        emit SuperChatSent(messageId, token, msg.sender, recipient, msg.value, tier, content, block.timestamp);
        emit MessageSent(messageId, token, msg.sender, MessageType.SuperChat, content, block.timestamp);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // VOICE CHAT TRACKING (1% REQUIRED) - Telegram style window
    // User can only be in ONE voice chat at a time across all dashboards
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Register user joining voice chat
     * @dev User can only be in ONE voice chat at a time
     */
    function joinVoiceChat(address token) external notShutdown(token) {
        if (!dashboards[token].isLiveChatActive) revert LiveChatNotActive();
        if (!canUseVoiceChat(token, msg.sender)) revert InsufficientTokenBalance();
        if (isMuted[token][msg.sender]) revert UserIsMuted();

        // Check if user is already in another voice chat
        address currentChat = userCurrentVoiceChat[msg.sender];
        if (currentChat != address(0) && currentChat != token) revert AlreadyInVoiceChat();

        if (!inVoiceChat[token][msg.sender]) {
            inVoiceChat[token][msg.sender] = true;
            userCurrentVoiceChat[msg.sender] = token;
            dashboards[token].activeVoiceUsers++;

            // Log join event
            messageCount++;
            messages[messageCount] = Message({
                id: messageCount,
                token: token,
                sender: msg.sender,
                recipient: address(0),
                tipAmount: 0,
                tier: TipTier.Basic,
                msgType: MessageType.VoiceJoin,
                content: "",
                timestamp: block.timestamp
            });
            tokenMessages[token].push(messageCount);

            if (!hasParticipated[token][msg.sender]) {
                hasParticipated[token][msg.sender] = true;
                dashboards[token].uniqueParticipants++;
            }

            emit VoiceChatJoined(token, msg.sender, block.timestamp);
        }
    }

    /**
     * @notice Register user leaving voice chat
     */
    function leaveVoiceChat(address token) external {
        if (!inVoiceChat[token][msg.sender]) revert NotInVoiceChat();

        inVoiceChat[token][msg.sender] = false;
        userCurrentVoiceChat[msg.sender] = address(0);
        if (dashboards[token].activeVoiceUsers > 0) {
            dashboards[token].activeVoiceUsers--;
        }

        // Log leave event
        messageCount++;
        messages[messageCount] = Message({
            id: messageCount,
            token: token,
            sender: msg.sender,
            recipient: address(0),
            tipAmount: 0,
            tier: TipTier.Basic,
            msgType: MessageType.VoiceLeave,
            content: "",
            timestamp: block.timestamp
        });
        tokenMessages[token].push(messageCount);

        emit VoiceChatLeft(token, msg.sender, block.timestamp);
    }

    /**
     * @notice Check if user is in voice chat for this token
     */
    function isInVoiceChat(address token, address user) external view returns (bool) {
        return inVoiceChat[token][user];
    }

    /**
     * @notice Get which voice chat a user is currently in (0 = none)
     */
    function getUserVoiceChat(address user) external view returns (address) {
        return userCurrentVoiceChat[user];
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // MODERATION - MUTE DISRUPTIVE USERS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Mute a user in voice chat (moderator, whale, or owner)
     * @param token Dashboard token
     * @param user User to mute
     */
    function muteUser(address token, address user) external {
        if (!_canModerate(token, msg.sender)) revert NotModerator();

        isMuted[token][user] = true;

        // Force leave voice chat if muted while in it
        if (inVoiceChat[token][user]) {
            inVoiceChat[token][user] = false;
            userCurrentVoiceChat[user] = address(0);
            if (dashboards[token].activeVoiceUsers > 0) {
                dashboards[token].activeVoiceUsers--;
            }
            emit VoiceChatLeft(token, user, block.timestamp);
        }

        emit UserMuted(token, user, msg.sender, block.timestamp);
    }

    /**
     * @notice Unmute a user
     */
    function unmuteUser(address token, address user) external {
        if (!_canModerate(token, msg.sender)) revert NotModerator();

        isMuted[token][user] = false;
        emit UserUnmuted(token, user, msg.sender, block.timestamp);
    }

    /**
     * @notice Add a moderator for a token dashboard
     * @dev Owner or whale can add moderators
     */
    function addModerator(address token, address user) external {
        if (!canControlLiveChat(token, msg.sender)) revert NotAuthorizedToControlLive();
        isModerator[token][user] = true;
        emit ModeratorAdded(token, user, block.timestamp);
    }

    /**
     * @notice Remove a moderator
     */
    function removeModerator(address token, address user) external {
        if (!canControlLiveChat(token, msg.sender)) revert NotAuthorizedToControlLive();
        isModerator[token][user] = false;
        emit ModeratorRemoved(token, user, block.timestamp);
    }

    /**
     * @notice Check if user can moderate (owner, whale, or designated moderator)
     */
    function _canModerate(address token, address user) internal view returns (bool) {
        return user == owner() ||
               isModerator[token][user] ||
               canControlLiveChat(token, user);
    }

    /**
     * @notice Check if user is a moderator for a token
     */
    function canModerate(address token, address user) external view returns (bool) {
        return _canModerate(token, user);
    }

    /**
     * @notice Check if user is muted
     */
    function isUserMuted(address token, address user) external view returns (bool) {
        return isMuted[token][user];
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // TIER CALCULATIONS
    // ═══════════════════════════════════════════════════════════════════════════

    function _getTier(uint256 amount) internal view returns (TipTier) {
        if (amount >= diamondThreshold) return TipTier.Diamond;
        if (amount >= goldThreshold) return TipTier.Gold;
        if (amount >= silverThreshold) return TipTier.Silver;
        if (amount >= bronzeThreshold) return TipTier.Bronze;
        return TipTier.Basic;
    }

    function _getTierPLS(uint256 amount) internal view returns (TipTier) {
        if (amount >= diamondThresholdPLS) return TipTier.Diamond;
        if (amount >= goldThresholdPLS) return TipTier.Gold;
        if (amount >= silverThresholdPLS) return TipTier.Silver;
        if (amount >= bronzeThresholdPLS) return TipTier.Bronze;
        return TipTier.Basic;
    }

    function previewTier(uint256 amount, bool isPLS) external view returns (TipTier) {
        if (isPLS) return _getTierPLS(amount);
        return _getTier(amount);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Get recent messages for a token dashboard
     */
    function getRecentMessages(
        address token,
        uint256 count
    ) external view returns (Message[] memory result) {
        uint256[] storage ids = tokenMessages[token];
        if (ids.length == 0) return new Message[](0);

        uint256 resultCount = count;
        if (resultCount > ids.length) resultCount = ids.length;

        result = new Message[](resultCount);
        for (uint256 i = 0; i < resultCount; i++) {
            result[i] = messages[ids[ids.length - 1 - i]];
        }
    }

    /**
     * @notice Get messages with pagination
     */
    function getTokenMessages(
        address token,
        uint256 offset,
        uint256 limit
    ) external view returns (Message[] memory result) {
        uint256[] storage ids = tokenMessages[token];
        if (offset >= ids.length) return new Message[](0);

        uint256 end = offset + limit;
        if (end > ids.length) end = ids.length;

        result = new Message[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = messages[ids[i]];
        }
    }

    /**
     * @notice Get dashboard stats
     */
    function getDashboardStats(address token) external view returns (
        uint256 totalMessages,
        uint256 totalTips,
        uint256 uniqueParticipants,
        uint256 activeVoiceUsers
    ) {
        TokenDashboard storage d = dashboards[token];
        return (d.totalMessages, d.totalTips, d.uniqueParticipants, d.activeVoiceUsers);
    }

    /**
     * @notice Get full dashboard info including live status
     */
    function getDashboardInfo(address token) external view returns (
        uint256 totalMessages,
        uint256 totalTips,
        uint256 uniqueParticipants,
        uint256 activeVoiceUsers,
        bool liveChatActive,
        bool messageBoardActive,
        bool isShutdown,
        address liveChatHost,
        uint256 liveChatStartedAt
    ) {
        TokenDashboard storage d = dashboards[token];
        return (
            d.totalMessages,
            d.totalTips,
            d.uniqueParticipants,
            d.activeVoiceUsers,
            d.isLiveChatActive,
            d.isMessageBoardActive,
            d.isShutdown,
            d.liveChatHost,
            d.liveChatStartedAt
        );
    }

    /**
     * @notice Get message count for token
     */
    function getTokenMessageCount(address token) external view returns (uint256) {
        return tokenMessages[token].length;
    }

    /**
     * @notice Get user's messages
     */
    function getUserMessages(
        address user,
        uint256 offset,
        uint256 limit
    ) external view returns (Message[] memory result) {
        uint256[] storage ids = userMessages[user];
        if (offset >= ids.length) return new Message[](0);

        uint256 end = offset + limit;
        if (end > ids.length) end = ids.length;

        result = new Message[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = messages[ids[i]];
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PLATFORM ADMIN - SHUTDOWN/REOPEN ANY DASHBOARD
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Shutdown a token dashboard (emergency - owner only)
     * @dev Stops all activity for this token's chat
     */
    function shutdownDashboard(address token) external onlyOwner {
        dashboards[token].isShutdown = true;
        dashboards[token].isLiveChatActive = false;
        dashboards[token].isMessageBoardActive = false;
        emit DashboardShutdown(token, block.timestamp);
    }

    /**
     * @notice Reopen a shutdown dashboard
     */
    function reopenDashboard(address token) external onlyOwner {
        dashboards[token].isShutdown = false;
        emit DashboardReopened(token, block.timestamp);
    }

    /**
     * @notice Register/update the whale for a token
     * @dev Can be called by owner or self-registered by holder
     */
    function registerWhale(address token, address whale) external {
        // Owner can register anyone
        // Others can only self-register if they meet threshold
        if (msg.sender != owner()) {
            if (whale != msg.sender) revert NotAuthorizedToControlLive();
            if (!canControlLiveChat(token, whale)) revert InsufficientTokenBalance();
        }

        uint256 balance = IERC20(token).balanceOf(whale);
        registeredWhale[token] = whale;
        registeredWhaleBalance[token] = balance;

        emit WhaleRegistered(token, whale, balance, block.timestamp);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ADMIN - ALL ADJUSTABLE PARAMETERS
    // ═══════════════════════════════════════════════════════════════════════════

    function setVoiceChatThreshold(uint256 _bps) external onlyOwner {
        require(_bps <= 1000, "Max 10%");
        voiceChatThresholdBps = _bps;
    }

    function setMessageBoardThreshold(uint256 _bps) external onlyOwner {
        require(_bps <= 1000, "Max 10%");
        messageBoardThresholdBps = _bps;
    }

    function setWhaleControlThreshold(uint256 _bps) external onlyOwner {
        require(_bps <= 5000, "Max 50%");
        whaleControlThresholdBps = _bps;
    }

    function setPlatformFeeBps(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= MAX_FEE_BPS, "Fee too high");
        platformFeeBps = _feeBps;
    }

    function setMaxMessageLength(uint256 _maxLength) external onlyOwner {
        maxMessageLength = _maxLength;
    }

    function setTierThresholds(
        uint256 _bronze,
        uint256 _silver,
        uint256 _gold,
        uint256 _diamond
    ) external onlyOwner {
        bronzeThreshold = _bronze;
        silverThreshold = _silver;
        goldThreshold = _gold;
        diamondThreshold = _diamond;
    }

    function setTierThresholdsPLS(
        uint256 _bronze,
        uint256 _silver,
        uint256 _gold,
        uint256 _diamond
    ) external onlyOwner {
        bronzeThresholdPLS = _bronze;
        silverThresholdPLS = _silver;
        goldThresholdPLS = _gold;
        diamondThresholdPLS = _diamond;
    }

    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        if (token == address(0)) {
            (bool sent,) = TREASURY.call{value: amount}("");
            if (!sent) revert TransferFailed();
        } else {
            IERC20(token).transfer(TREASURY, amount);
        }
    }

    receive() external payable {}
}
