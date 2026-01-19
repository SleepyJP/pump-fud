// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title PumpFudProfile
 * @notice User profile system for pump.fud platform
 * @dev Profiles with avatars, gamertags, cults/crews, and reputation
 *
 * FEATURES:
 * - Profile creation with avatar, name, bio
 * - Cult/Crew system (gang patches, team affiliations)
 * - Reputation tracking (tokens launched, graduated, volume)
 * - Customizable profile badges
 * - Follow system
 *
 * TREASURY: 0x49bBEFa1d94702C0e9a5EAdDEc7c3C5D3eb9086B
 */
contract PumpFudProfile is ReentrancyGuard, Ownable {
    address public constant TREASURY = 0x49bBEFa1d94702C0e9a5EAdDEc7c3C5D3eb9086B;

    // Profile creation fee (adjustable)
    uint256 public profileCreationFee = 0; // Free to start
    uint256 public cultCreationFee = 100_000 ether; // 100k PLS to create a cult
    uint256 public premiumProfileFee = 10_000 ether; // 10k PLS for premium features

    // Limits
    uint256 public maxBioLength = 500;
    uint256 public maxNameLength = 32;
    uint256 public maxCultNameLength = 24;
    uint256 public maxCultMembers = 1000;

    struct Profile {
        address wallet;
        string displayName;       // Gamertag/username
        string avatarUri;         // IPFS or URL
        string bannerUri;         // Profile banner
        string bio;               // About me
        uint256 cultId;           // 0 = no cult
        uint256 createdAt;
        uint256 lastUpdated;
        bool isPremium;
        bool isVerified;          // Platform verified
        bool exists;
    }

    struct ProfileStats {
        uint256 tokensLaunched;
        uint256 tokensGraduated;
        uint256 totalVolume;      // PLS traded
        uint256 totalTips;        // SuperChat tips received
        uint256 followerCount;
        uint256 followingCount;
        uint256 reputation;       // Calculated score
    }

    struct Cult {
        uint256 id;
        string name;              // Cult name
        string tag;               // Short tag [TAG]
        string imageUri;          // Gang patch/logo
        string description;
        address founder;
        address leader;           // Can be transferred
        uint256 memberCount;
        uint256 createdAt;
        bool isPublic;            // Anyone can join vs invite-only
        bool isActive;
    }

    struct Badge {
        uint256 id;
        string name;
        string imageUri;
        string description;
        bool isTransferable;
    }

    // State
    uint256 public profileCount;
    uint256 public cultCount;
    uint256 public badgeCount;

    mapping(address => Profile) public profiles;
    mapping(string => address) public nameToAddress;  // Lowercase name => wallet
    mapping(address => ProfileStats) public stats;
    mapping(uint256 => Cult) public cults;
    mapping(string => uint256) public cultTagToId;    // Lowercase tag => cultId
    mapping(uint256 => Badge) public badges;

    // Cult membership
    mapping(uint256 => mapping(address => bool)) public cultMembers;
    mapping(uint256 => address[]) public cultMemberList;

    // Following
    mapping(address => mapping(address => bool)) public isFollowing;
    mapping(address => address[]) public followers;
    mapping(address => address[]) public following;

    // Badges owned
    mapping(address => uint256[]) public userBadges;
    mapping(address => mapping(uint256 => bool)) public hasBadge;

    // Events
    event ProfileCreated(address indexed wallet, string displayName, uint256 timestamp);
    event ProfileUpdated(address indexed wallet, string displayName, uint256 timestamp);
    event ProfileUpgraded(address indexed wallet, bool isPremium, uint256 timestamp);
    event CultCreated(uint256 indexed cultId, string name, string tag, address founder);
    event CultJoined(uint256 indexed cultId, address indexed member);
    event CultLeft(uint256 indexed cultId, address indexed member);
    event CultLeaderChanged(uint256 indexed cultId, address indexed oldLeader, address indexed newLeader);
    event Followed(address indexed follower, address indexed followed);
    event Unfollowed(address indexed follower, address indexed unfollowed);
    event BadgeAwarded(address indexed user, uint256 indexed badgeId);
    event StatsUpdated(address indexed user, uint256 reputation);

    // Errors
    error ProfileAlreadyExists();
    error ProfileNotFound();
    error NameTaken();
    error NameTooLong();
    error BioTooLong();
    error InvalidCult();
    error CultFull();
    error NotCultLeader();
    error NotCultMember();
    error AlreadyInCult();
    error CultTagTaken();
    error InsufficientPayment();
    error CannotFollowSelf();
    error AlreadyFollowing();
    error NotFollowing();

    constructor() Ownable(msg.sender) {
        _initializeDefaultBadges();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PROFILE MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Create a new profile
     */
    function createProfile(
        string calldata displayName,
        string calldata avatarUri,
        string calldata bio
    ) external payable nonReentrant {
        if (profiles[msg.sender].exists) revert ProfileAlreadyExists();
        if (bytes(displayName).length > maxNameLength) revert NameTooLong();
        if (bytes(bio).length > maxBioLength) revert BioTooLong();

        string memory lowerName = _toLower(displayName);
        if (nameToAddress[lowerName] != address(0)) revert NameTaken();

        if (msg.value < profileCreationFee) revert InsufficientPayment();

        profileCount++;

        profiles[msg.sender] = Profile({
            wallet: msg.sender,
            displayName: displayName,
            avatarUri: avatarUri,
            bannerUri: "",
            bio: bio,
            cultId: 0,
            createdAt: block.timestamp,
            lastUpdated: block.timestamp,
            isPremium: false,
            isVerified: false,
            exists: true
        });

        nameToAddress[lowerName] = msg.sender;

        stats[msg.sender] = ProfileStats({
            tokensLaunched: 0,
            tokensGraduated: 0,
            totalVolume: 0,
            totalTips: 0,
            followerCount: 0,
            followingCount: 0,
            reputation: 0
        });

        // Send fee to treasury
        if (msg.value > 0) {
            (bool sent,) = TREASURY.call{value: msg.value}("");
            require(sent, "Fee transfer failed");
        }

        emit ProfileCreated(msg.sender, displayName, block.timestamp);
    }

    /**
     * @notice Update profile details
     */
    function updateProfile(
        string calldata displayName,
        string calldata avatarUri,
        string calldata bannerUri,
        string calldata bio
    ) external {
        Profile storage profile = profiles[msg.sender];
        if (!profile.exists) revert ProfileNotFound();
        if (bytes(displayName).length > maxNameLength) revert NameTooLong();
        if (bytes(bio).length > maxBioLength) revert BioTooLong();

        // Check if name changed
        string memory oldLowerName = _toLower(profile.displayName);
        string memory newLowerName = _toLower(displayName);

        if (keccak256(bytes(oldLowerName)) != keccak256(bytes(newLowerName))) {
            if (nameToAddress[newLowerName] != address(0)) revert NameTaken();
            delete nameToAddress[oldLowerName];
            nameToAddress[newLowerName] = msg.sender;
        }

        profile.displayName = displayName;
        profile.avatarUri = avatarUri;
        profile.bannerUri = bannerUri;
        profile.bio = bio;
        profile.lastUpdated = block.timestamp;

        emit ProfileUpdated(msg.sender, displayName, block.timestamp);
    }

    /**
     * @notice Upgrade to premium profile
     */
    function upgradeToPremium() external payable nonReentrant {
        Profile storage profile = profiles[msg.sender];
        if (!profile.exists) revert ProfileNotFound();
        if (msg.value < premiumProfileFee) revert InsufficientPayment();

        profile.isPremium = true;
        profile.lastUpdated = block.timestamp;

        (bool sent,) = TREASURY.call{value: msg.value}("");
        require(sent, "Fee transfer failed");

        emit ProfileUpgraded(msg.sender, true, block.timestamp);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // CULT/CREW SYSTEM
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Create a new cult/crew
     */
    function createCult(
        string calldata name,
        string calldata tag,
        string calldata imageUri,
        string calldata description,
        bool isPublic
    ) external payable nonReentrant returns (uint256 cultId) {
        Profile storage profile = profiles[msg.sender];
        if (!profile.exists) revert ProfileNotFound();
        if (bytes(name).length > maxCultNameLength) revert NameTooLong();
        if (msg.value < cultCreationFee) revert InsufficientPayment();

        string memory lowerTag = _toLower(tag);
        if (cultTagToId[lowerTag] != 0) revert CultTagTaken();

        cultCount++;
        cultId = cultCount;

        cults[cultId] = Cult({
            id: cultId,
            name: name,
            tag: tag,
            imageUri: imageUri,
            description: description,
            founder: msg.sender,
            leader: msg.sender,
            memberCount: 1,
            createdAt: block.timestamp,
            isPublic: isPublic,
            isActive: true
        });

        cultTagToId[lowerTag] = cultId;

        // Founder auto-joins
        cultMembers[cultId][msg.sender] = true;
        cultMemberList[cultId].push(msg.sender);
        profile.cultId = cultId;

        (bool sent,) = TREASURY.call{value: msg.value}("");
        require(sent, "Fee transfer failed");

        emit CultCreated(cultId, name, tag, msg.sender);
    }

    /**
     * @notice Join a public cult
     */
    function joinCult(uint256 cultId) external {
        Profile storage profile = profiles[msg.sender];
        if (!profile.exists) revert ProfileNotFound();
        if (profile.cultId != 0) revert AlreadyInCult();

        Cult storage cult = cults[cultId];
        if (cult.id == 0 || !cult.isActive) revert InvalidCult();
        if (!cult.isPublic) revert InvalidCult(); // Must be invited for private cults
        if (cult.memberCount >= maxCultMembers) revert CultFull();

        cultMembers[cultId][msg.sender] = true;
        cultMemberList[cultId].push(msg.sender);
        cult.memberCount++;
        profile.cultId = cultId;

        emit CultJoined(cultId, msg.sender);
    }

    /**
     * @notice Invite someone to a private cult (leader only)
     */
    function inviteToCult(uint256 cultId, address invitee) external {
        Cult storage cult = cults[cultId];
        if (cult.leader != msg.sender) revert NotCultLeader();
        if (cult.memberCount >= maxCultMembers) revert CultFull();

        Profile storage inviteeProfile = profiles[invitee];
        if (!inviteeProfile.exists) revert ProfileNotFound();
        if (inviteeProfile.cultId != 0) revert AlreadyInCult();

        cultMembers[cultId][invitee] = true;
        cultMemberList[cultId].push(invitee);
        cult.memberCount++;
        inviteeProfile.cultId = cultId;

        emit CultJoined(cultId, invitee);
    }

    /**
     * @notice Leave current cult
     */
    function leaveCult() external {
        Profile storage profile = profiles[msg.sender];
        if (!profile.exists) revert ProfileNotFound();
        if (profile.cultId == 0) revert NotCultMember();

        uint256 cultId = profile.cultId;
        Cult storage cult = cults[cultId];

        // Leader cannot leave, must transfer leadership first
        if (cult.leader == msg.sender) revert NotCultLeader();

        cultMembers[cultId][msg.sender] = false;
        cult.memberCount--;
        profile.cultId = 0;

        emit CultLeft(cultId, msg.sender);
    }

    /**
     * @notice Transfer cult leadership
     */
    function transferCultLeadership(uint256 cultId, address newLeader) external {
        Cult storage cult = cults[cultId];
        if (cult.leader != msg.sender) revert NotCultLeader();
        if (!cultMembers[cultId][newLeader]) revert NotCultMember();

        address oldLeader = cult.leader;
        cult.leader = newLeader;

        emit CultLeaderChanged(cultId, oldLeader, newLeader);
    }

    /**
     * @notice Update cult details (leader only)
     */
    function updateCult(
        uint256 cultId,
        string calldata imageUri,
        string calldata description,
        bool isPublic
    ) external {
        Cult storage cult = cults[cultId];
        if (cult.leader != msg.sender) revert NotCultLeader();

        cult.imageUri = imageUri;
        cult.description = description;
        cult.isPublic = isPublic;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // FOLLOW SYSTEM
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Follow another user
     */
    function follow(address toFollow) external {
        if (toFollow == msg.sender) revert CannotFollowSelf();
        if (!profiles[msg.sender].exists) revert ProfileNotFound();
        if (!profiles[toFollow].exists) revert ProfileNotFound();
        if (isFollowing[msg.sender][toFollow]) revert AlreadyFollowing();

        isFollowing[msg.sender][toFollow] = true;
        followers[toFollow].push(msg.sender);
        following[msg.sender].push(toFollow);

        stats[msg.sender].followingCount++;
        stats[toFollow].followerCount++;

        emit Followed(msg.sender, toFollow);
    }

    /**
     * @notice Unfollow a user
     */
    function unfollow(address toUnfollow) external {
        if (!isFollowing[msg.sender][toUnfollow]) revert NotFollowing();

        isFollowing[msg.sender][toUnfollow] = false;
        stats[msg.sender].followingCount--;
        stats[toUnfollow].followerCount--;

        emit Unfollowed(msg.sender, toUnfollow);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STATS & REPUTATION (Called by other contracts)
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Record token launch (called by PumpFud)
     */
    function recordTokenLaunch(address creator) external {
        // In production, add access control
        if (profiles[creator].exists) {
            stats[creator].tokensLaunched++;
            _updateReputation(creator);
        }
    }

    /**
     * @notice Record token graduation (called by PumpFud)
     */
    function recordGraduation(address creator) external {
        if (profiles[creator].exists) {
            stats[creator].tokensGraduated++;
            _updateReputation(creator);
        }
    }

    /**
     * @notice Record trading volume (called by PumpFud/Swap)
     */
    function recordVolume(address trader, uint256 amount) external {
        if (profiles[trader].exists) {
            stats[trader].totalVolume += amount;
            _updateReputation(trader);
        }
    }

    /**
     * @notice Record tip received (called by SuperChat)
     */
    function recordTip(address recipient, uint256 amount) external {
        if (profiles[recipient].exists) {
            stats[recipient].totalTips += amount;
            _updateReputation(recipient);
        }
    }

    function _updateReputation(address user) internal {
        ProfileStats storage s = stats[user];

        // Reputation formula (adjustable weights)
        // launches * 10 + graduations * 100 + volume/1M + tips/10k + followers
        uint256 rep = (s.tokensLaunched * 10) +
                      (s.tokensGraduated * 100) +
                      (s.totalVolume / 1_000_000 ether) +
                      (s.totalTips / 10_000 ether) +
                      s.followerCount;

        s.reputation = rep;

        emit StatsUpdated(user, rep);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // BADGES
    // ═══════════════════════════════════════════════════════════════════════════

    function _initializeDefaultBadges() internal {
        _createBadge("OG", "ipfs://og-badge", "Early platform user", false);
        _createBadge("Whale", "ipfs://whale-badge", "High volume trader", false);
        _createBadge("Creator", "ipfs://creator-badge", "Launched 10+ tokens", false);
        _createBadge("Graduate", "ipfs://graduate-badge", "Graduated a token", false);
        _createBadge("Influencer", "ipfs://influencer-badge", "1000+ followers", false);
        _createBadge("Cult Leader", "ipfs://cult-badge", "Founded a cult", false);
        _createBadge("Diamond Hands", "ipfs://diamond-badge", "Never sold", false);
        _createBadge("Degen", "ipfs://degen-badge", "True degen energy", false);
    }

    function _createBadge(
        string memory name,
        string memory imageUri,
        string memory description,
        bool isTransferable
    ) internal returns (uint256 badgeId) {
        badgeCount++;
        badgeId = badgeCount;

        badges[badgeId] = Badge({
            id: badgeId,
            name: name,
            imageUri: imageUri,
            description: description,
            isTransferable: isTransferable
        });
    }

    /**
     * @notice Award badge to user (owner only)
     */
    function awardBadge(address user, uint256 badgeId) external onlyOwner {
        if (!profiles[user].exists) revert ProfileNotFound();
        if (badges[badgeId].id == 0) revert InvalidCult(); // reusing error
        if (hasBadge[user][badgeId]) return; // Already has badge

        hasBadge[user][badgeId] = true;
        userBadges[user].push(badgeId);

        emit BadgeAwarded(user, badgeId);
    }

    /**
     * @notice Create new badge type (owner only)
     */
    function createBadge(
        string calldata name,
        string calldata imageUri,
        string calldata description,
        bool isTransferable
    ) external onlyOwner returns (uint256) {
        return _createBadge(name, imageUri, description, isTransferable);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    function getProfile(address user) external view returns (Profile memory) {
        return profiles[user];
    }

    function getProfileByName(string calldata name) external view returns (Profile memory) {
        address user = nameToAddress[_toLower(name)];
        return profiles[user];
    }

    function getStats(address user) external view returns (ProfileStats memory) {
        return stats[user];
    }

    function getCult(uint256 cultId) external view returns (Cult memory) {
        return cults[cultId];
    }

    function getCultMembers(uint256 cultId) external view returns (address[] memory) {
        return cultMemberList[cultId];
    }

    function getUserBadges(address user) external view returns (uint256[] memory) {
        return userBadges[user];
    }

    function getFollowers(address user) external view returns (address[] memory) {
        return followers[user];
    }

    function getFollowing(address user) external view returns (address[] memory) {
        return following[user];
    }

    function profileExists(address user) external view returns (bool) {
        return profiles[user].exists;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ADMIN
    // ═══════════════════════════════════════════════════════════════════════════

    function setProfileCreationFee(uint256 _fee) external onlyOwner {
        profileCreationFee = _fee;
    }

    function setCultCreationFee(uint256 _fee) external onlyOwner {
        cultCreationFee = _fee;
    }

    function setPremiumProfileFee(uint256 _fee) external onlyOwner {
        premiumProfileFee = _fee;
    }

    function setMaxBioLength(uint256 _max) external onlyOwner {
        maxBioLength = _max;
    }

    function setMaxNameLength(uint256 _max) external onlyOwner {
        maxNameLength = _max;
    }

    function setMaxCultMembers(uint256 _max) external onlyOwner {
        maxCultMembers = _max;
    }

    function verifyProfile(address user, bool verified) external onlyOwner {
        if (profiles[user].exists) {
            profiles[user].isVerified = verified;
        }
    }

    function deactivateCult(uint256 cultId) external onlyOwner {
        cults[cultId].isActive = false;
    }

    function emergencyWithdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        if (balance > 0) {
            (bool sent,) = TREASURY.call{value: balance}("");
            require(sent, "Withdraw failed");
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════════════════════════════════════════

    function _toLower(string memory str) internal pure returns (string memory) {
        bytes memory bStr = bytes(str);
        bytes memory bLower = new bytes(bStr.length);
        for (uint i = 0; i < bStr.length; i++) {
            if ((uint8(bStr[i]) >= 65) && (uint8(bStr[i]) <= 90)) {
                bLower[i] = bytes1(uint8(bStr[i]) + 32);
            } else {
                bLower[i] = bStr[i];
            }
        }
        return string(bLower);
    }

    receive() external payable {}
}
