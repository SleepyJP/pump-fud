// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "lib/openzeppelin-contracts/contracts/access/Ownable.sol";

/**
 * @title PumpFudLeaderboard
 * @notice Tracks user trading volume, referrals, and ROI for PUMP.FUD platform
 * @dev ALL PARAMETERS ADJUSTABLE via admin functions - nothing hardcoded
 *
 * FEATURES:
 * - Volume tracking per user (total PLS traded)
 * - Referral system with claimable rewards
 * - ROI tracking (buy vs sell values)
 * - Leaderboard queries for top traders
 *
 * TREASURY: 0x49bBEFa1d94702C0e9a5EAdDEc7c3C5D3eb9086B
 */
contract PumpFudLeaderboard is ReentrancyGuard, Ownable {
    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTANTS & ADDRESSES
    // ═══════════════════════════════════════════════════════════════════════════

    address public constant TREASURY = 0x49bBEFa1d94702C0e9a5EAdDEc7c3C5D3eb9086B;
    uint256 public constant BPS_DENOMINATOR = 10000;

    // ═══════════════════════════════════════════════════════════════════════════
    // ADJUSTABLE PARAMETERS
    // ═══════════════════════════════════════════════════════════════════════════

    address public pumpFud; // Main PumpFud contract - can record trades
    uint256 public referralFeeBps = 1000; // 10% of trading fees to referrer (ADJUSTABLE)
    uint256 public minVolumeForROI = 100 ether; // Min volume to qualify for ROI leaderboard (ADJUSTABLE)
    uint256 public minTradesForROI = 3; // Min trades to qualify (ADJUSTABLE)

    // ═══════════════════════════════════════════════════════════════════════════
    // USER STATS STORAGE
    // ═══════════════════════════════════════════════════════════════════════════

    struct UserStats {
        uint256 totalVolume;       // Total PLS volume traded
        uint256 totalBuyValue;     // Total PLS spent on buys
        uint256 totalSellValue;    // Total PLS received from sells
        uint256 tradeCount;        // Number of trades
        uint256 buyCount;          // Number of buys
        uint256 sellCount;         // Number of sells
        uint256 referralCount;     // Number of users referred
        uint256 referralVolume;    // Total volume from referrals
        uint256 referralEarnings;  // Total earned from referrals
        uint256 pendingReferral;   // Unclaimed referral rewards
        uint256 lastTradeTime;     // Timestamp of last trade
    }

    mapping(address => UserStats) public userStats;
    mapping(address => address) public referrerOf; // user => their referrer
    mapping(address => address[]) public referrals; // referrer => list of referred users
    mapping(address => bool) public hasTraded; // Track if user has traded

    // Track all traders for enumeration
    address[] public traders;
    mapping(address => bool) private isTrader;

    // ═══════════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════════

    event TradeRecorded(
        address indexed user,
        uint256 volume,
        bool isBuy,
        uint256 timestamp
    );

    event ReferralRegistered(
        address indexed referrer,
        address indexed referred,
        uint256 timestamp
    );

    event ReferralRewardAccrued(
        address indexed referrer,
        address indexed trader,
        uint256 amount,
        uint256 timestamp
    );

    event ReferralRewardsClaimed(
        address indexed user,
        uint256 amount,
        uint256 timestamp
    );

    event ParameterUpdated(string indexed param, uint256 oldValue, uint256 newValue);

    // ═══════════════════════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════════════════════

    error Unauthorized();
    error InvalidReferrer();
    error ReferrerAlreadySet();
    error NoPendingRewards();
    error TransferFailed();
    error ZeroAddress();

    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════════

    constructor(address _pumpFud) Ownable(msg.sender) {
        if (_pumpFud == address(0)) revert ZeroAddress();
        pumpFud = _pumpFud;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // TRADE RECORDING (Called by PumpFud contract or authorized caller)
    // ═══════════════════════════════════════════════════════════════════════════

    modifier onlyAuthorized() {
        if (msg.sender != pumpFud && msg.sender != owner()) revert Unauthorized();
        _;
    }

    /**
     * @notice Record a trade for leaderboard tracking
     * @param user The trader's address
     * @param volume The PLS value of the trade
     * @param isBuy True for buy, false for sell
     * @param feeAmount The fee amount (for referral calculation)
     */
    function recordTrade(
        address user,
        uint256 volume,
        bool isBuy,
        uint256 feeAmount
    ) external onlyAuthorized {
        UserStats storage stats = userStats[user];

        // Update volume
        stats.totalVolume += volume;
        stats.tradeCount++;
        stats.lastTradeTime = block.timestamp;

        // Track buys vs sells for ROI
        if (isBuy) {
            stats.totalBuyValue += volume;
            stats.buyCount++;
        } else {
            stats.totalSellValue += volume;
            stats.sellCount++;
        }

        // Add to traders list if new
        if (!isTrader[user]) {
            isTrader[user] = true;
            traders.push(user);
        }

        // Handle referral rewards
        address referrer = referrerOf[user];
        if (referrer != address(0) && feeAmount > 0) {
            uint256 referralReward = (feeAmount * referralFeeBps) / BPS_DENOMINATOR;
            if (referralReward > 0) {
                userStats[referrer].pendingReferral += referralReward;
                userStats[referrer].referralEarnings += referralReward;
                userStats[referrer].referralVolume += volume;

                emit ReferralRewardAccrued(referrer, user, referralReward, block.timestamp);
            }
        }

        emit TradeRecorded(user, volume, isBuy, block.timestamp);
    }

    /**
     * @notice Batch record multiple trades (gas efficient)
     */
    function batchRecordTrades(
        address[] calldata users,
        uint256[] calldata volumes,
        bool[] calldata isBuys,
        uint256[] calldata feeAmounts
    ) external onlyAuthorized {
        require(users.length == volumes.length, "Length mismatch");
        require(users.length == isBuys.length, "Length mismatch");
        require(users.length == feeAmounts.length, "Length mismatch");

        for (uint256 i = 0; i < users.length; i++) {
            UserStats storage stats = userStats[users[i]];

            stats.totalVolume += volumes[i];
            stats.tradeCount++;
            stats.lastTradeTime = block.timestamp;

            if (isBuys[i]) {
                stats.totalBuyValue += volumes[i];
                stats.buyCount++;
            } else {
                stats.totalSellValue += volumes[i];
                stats.sellCount++;
            }

            if (!isTrader[users[i]]) {
                isTrader[users[i]] = true;
                traders.push(users[i]);
            }

            // Referral handling
            address referrer = referrerOf[users[i]];
            if (referrer != address(0) && feeAmounts[i] > 0) {
                uint256 referralReward = (feeAmounts[i] * referralFeeBps) / BPS_DENOMINATOR;
                if (referralReward > 0) {
                    userStats[referrer].pendingReferral += referralReward;
                    userStats[referrer].referralEarnings += referralReward;
                    userStats[referrer].referralVolume += volumes[i];
                }
            }

            emit TradeRecorded(users[i], volumes[i], isBuys[i], block.timestamp);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // REFERRAL SYSTEM
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Set referrer for a user (called once, cannot be changed)
     * @param user The user being referred
     * @param referrer The referrer address
     */
    function setReferrer(address user, address referrer) external onlyAuthorized {
        if (referrer == address(0)) revert InvalidReferrer();
        if (referrer == user) revert InvalidReferrer();
        if (referrerOf[user] != address(0)) revert ReferrerAlreadySet();

        referrerOf[user] = referrer;
        referrals[referrer].push(user);
        userStats[referrer].referralCount++;

        emit ReferralRegistered(referrer, user, block.timestamp);
    }

    /**
     * @notice User can set their own referrer (for frontend integration)
     * @param referrer The referrer address from URL param
     */
    function registerReferrer(address referrer) external {
        if (referrer == address(0)) revert InvalidReferrer();
        if (referrer == msg.sender) revert InvalidReferrer();
        if (referrerOf[msg.sender] != address(0)) revert ReferrerAlreadySet();

        referrerOf[msg.sender] = referrer;
        referrals[referrer].push(msg.sender);
        userStats[referrer].referralCount++;

        emit ReferralRegistered(referrer, msg.sender, block.timestamp);
    }

    /**
     * @notice Claim accumulated referral rewards
     */
    function claimReferralRewards() external nonReentrant {
        uint256 pending = userStats[msg.sender].pendingReferral;
        if (pending == 0) revert NoPendingRewards();

        userStats[msg.sender].pendingReferral = 0;

        (bool sent, ) = msg.sender.call{value: pending}("");
        if (!sent) revert TransferFailed();

        emit ReferralRewardsClaimed(msg.sender, pending, block.timestamp);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS - LEADERBOARD QUERIES
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Get user stats
     */
    function getUserStats(address user) external view returns (UserStats memory) {
        return userStats[user];
    }

    /**
     * @notice Get user's referrals list
     */
    function getUserReferrals(address user) external view returns (address[] memory) {
        return referrals[user];
    }

    /**
     * @notice Calculate ROI for a user (percentage * 100 for precision)
     * @return roi ROI in basis points (e.g., 1500 = 15% profit)
     */
    function calculateROI(address user) public view returns (int256 roi) {
        UserStats memory stats = userStats[user];

        if (stats.totalBuyValue == 0) return 0;

        // ROI = (sellValue - buyValue) / buyValue * 10000
        int256 profit = int256(stats.totalSellValue) - int256(stats.totalBuyValue);
        roi = (profit * 10000) / int256(stats.totalBuyValue);
    }

    /**
     * @notice Get total number of traders
     */
    function getTotalTraders() external view returns (uint256) {
        return traders.length;
    }

    /**
     * @notice Get traders list (paginated)
     */
    function getTraders(uint256 offset, uint256 limit) external view returns (address[] memory result) {
        if (offset >= traders.length) return new address[](0);

        uint256 end = offset + limit;
        if (end > traders.length) end = traders.length;

        result = new address[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = traders[i];
        }
    }

    /**
     * @notice Get top volume traders
     * @dev Returns sorted by volume (descending) - gas intensive for large lists
     */
    function getTopVolumeTraders(uint256 count) external view returns (
        address[] memory addresses,
        uint256[] memory volumes
    ) {
        uint256 len = traders.length;
        if (count > len) count = len;

        // Create sortable array
        address[] memory sorted = new address[](len);
        for (uint256 i = 0; i < len; i++) {
            sorted[i] = traders[i];
        }

        // Sort by volume (bubble sort for simplicity - fine for reasonable sizes)
        for (uint256 i = 0; i < count; i++) {
            for (uint256 j = i + 1; j < len; j++) {
                if (userStats[sorted[j]].totalVolume > userStats[sorted[i]].totalVolume) {
                    (sorted[i], sorted[j]) = (sorted[j], sorted[i]);
                }
            }
        }

        addresses = new address[](count);
        volumes = new uint256[](count);

        for (uint256 i = 0; i < count; i++) {
            addresses[i] = sorted[i];
            volumes[i] = userStats[sorted[i]].totalVolume;
        }
    }

    /**
     * @notice Get top referrers
     */
    function getTopReferrers(uint256 count) external view returns (
        address[] memory addresses,
        uint256[] memory referralCounts,
        uint256[] memory referralVolumes
    ) {
        uint256 len = traders.length;
        if (count > len) count = len;

        address[] memory sorted = new address[](len);
        for (uint256 i = 0; i < len; i++) {
            sorted[i] = traders[i];
        }

        // Sort by referral count
        for (uint256 i = 0; i < count; i++) {
            for (uint256 j = i + 1; j < len; j++) {
                if (userStats[sorted[j]].referralCount > userStats[sorted[i]].referralCount) {
                    (sorted[i], sorted[j]) = (sorted[j], sorted[i]);
                }
            }
        }

        addresses = new address[](count);
        referralCounts = new uint256[](count);
        referralVolumes = new uint256[](count);

        for (uint256 i = 0; i < count; i++) {
            addresses[i] = sorted[i];
            referralCounts[i] = userStats[sorted[i]].referralCount;
            referralVolumes[i] = userStats[sorted[i]].referralVolume;
        }
    }

    /**
     * @notice Get top ROI traders (must meet minimum requirements)
     */
    function getTopROITraders(uint256 count) external view returns (
        address[] memory addresses,
        int256[] memory rois,
        uint256[] memory volumes
    ) {
        // First count eligible traders
        uint256 eligible = 0;
        for (uint256 i = 0; i < traders.length; i++) {
            UserStats memory stats = userStats[traders[i]];
            if (stats.totalVolume >= minVolumeForROI && stats.tradeCount >= minTradesForROI) {
                eligible++;
            }
        }

        if (count > eligible) count = eligible;
        if (count == 0) {
            return (new address[](0), new int256[](0), new uint256[](0));
        }

        // Create eligible list
        address[] memory eligibleTraders = new address[](eligible);
        uint256 idx = 0;
        for (uint256 i = 0; i < traders.length; i++) {
            UserStats memory stats = userStats[traders[i]];
            if (stats.totalVolume >= minVolumeForROI && stats.tradeCount >= minTradesForROI) {
                eligibleTraders[idx++] = traders[i];
            }
        }

        // Sort by ROI
        for (uint256 i = 0; i < count; i++) {
            for (uint256 j = i + 1; j < eligible; j++) {
                if (calculateROI(eligibleTraders[j]) > calculateROI(eligibleTraders[i])) {
                    (eligibleTraders[i], eligibleTraders[j]) = (eligibleTraders[j], eligibleTraders[i]);
                }
            }
        }

        addresses = new address[](count);
        rois = new int256[](count);
        volumes = new uint256[](count);

        for (uint256 i = 0; i < count; i++) {
            addresses[i] = eligibleTraders[i];
            rois[i] = calculateROI(eligibleTraders[i]);
            volumes[i] = userStats[eligibleTraders[i]].totalVolume;
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ADMIN FUNCTIONS - ALL ADJUSTABLE
    // ═══════════════════════════════════════════════════════════════════════════

    function setPumpFud(address _pumpFud) external onlyOwner {
        if (_pumpFud == address(0)) revert ZeroAddress();
        pumpFud = _pumpFud;
    }

    function setReferralFeeBps(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= 5000, "Max 50%");
        emit ParameterUpdated("referralFeeBps", referralFeeBps, _feeBps);
        referralFeeBps = _feeBps;
    }

    function setMinVolumeForROI(uint256 _minVolume) external onlyOwner {
        emit ParameterUpdated("minVolumeForROI", minVolumeForROI, _minVolume);
        minVolumeForROI = _minVolume;
    }

    function setMinTradesForROI(uint256 _minTrades) external onlyOwner {
        emit ParameterUpdated("minTradesForROI", minTradesForROI, _minTrades);
        minTradesForROI = _minTrades;
    }

    /**
     * @notice Manual admin function to record trades from historical data
     * @dev Use for backfilling from event logs
     */
    function adminRecordTrade(
        address user,
        uint256 volume,
        bool isBuy
    ) external onlyOwner {
        UserStats storage stats = userStats[user];

        stats.totalVolume += volume;
        stats.tradeCount++;

        if (isBuy) {
            stats.totalBuyValue += volume;
            stats.buyCount++;
        } else {
            stats.totalSellValue += volume;
            stats.sellCount++;
        }

        if (!isTrader[user]) {
            isTrader[user] = true;
            traders.push(user);
        }
    }

    /**
     * @notice Emergency withdraw stuck funds to treasury
     */
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        if (balance > 0) {
            (bool sent, ) = TREASURY.call{value: balance}("");
            if (!sent) revert TransferFailed();
        }
    }

    // Receive ETH for referral rewards pool
    receive() external payable {}
}
