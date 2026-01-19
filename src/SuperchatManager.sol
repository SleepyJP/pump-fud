// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "lib/openzeppelin-contracts/contracts/access/Ownable.sol";

/**
 * @title SuperchatManager
 * @notice On-chain superchat/tipping for PUMP.FUD chat
 * @dev Integrates with existing PumpFud.sol tokens
 *      Allows users to tip with unbonded tokens before graduation
 *      5% fee to treasury on all superchats
 */
contract SuperchatManager is ReentrancyGuard, Ownable {

    // ADJUSTABLE - not constant
    address public treasury;
    uint256 public platformFeeBps = 500; // 5% platform fee

    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);

    struct Superchat {
        address sender;
        address recipient;      // address(0) = broadcast to chat
        address token;
        uint256 amount;
        string message;
        uint256 timestamp;
        uint256 tier;           // 1-5 based on amount
    }

    struct TierConfig {
        uint256 tier1Min;       // Basic highlight
        uint256 tier2Min;       // Blue highlight
        uint256 tier3Min;       // Purple highlight
        uint256 tier4Min;       // Gold highlight
        uint256 tier5Min;       // Diamond + animation
    }

    // Default tier thresholds (18 decimals)
    uint256 public constant DEFAULT_TIER1 = 1_000 * 1e18;
    uint256 public constant DEFAULT_TIER2 = 10_000 * 1e18;
    uint256 public constant DEFAULT_TIER3 = 100_000 * 1e18;
    uint256 public constant DEFAULT_TIER4 = 1_000_000 * 1e18;
    uint256 public constant DEFAULT_TIER5 = 10_000_000 * 1e18;

    mapping(address => TierConfig) public tokenTiers;
    mapping(address => bool) public hasCustomTiers;
    mapping(address => Superchat[]) public tokenSuperchats;
    mapping(address => uint256) public totalSuperchatVolume;

    // Destination: 0 = lock in contract, 1 = burn to dead, 2 = creator
    mapping(address => uint8) public superchatDestination;

    event SuperchatSent(
        address indexed token,
        address indexed sender,
        address indexed recipient,
        uint256 amount,
        string message,
        uint256 tier,
        uint256 timestamp
    );

    event TierConfigUpdated(
        address indexed token,
        uint256 tier1,
        uint256 tier2,
        uint256 tier3,
        uint256 tier4,
        uint256 tier5
    );

    error MessageTooLong();
    error ZeroAmount();
    error TransferFailed();

    constructor(address _treasury) Ownable(msg.sender) {
        require(_treasury != address(0), "Invalid treasury");
        treasury = _treasury;
    }

    /**
     * @notice Send a superchat with tokens
     * @param token Token address (from PumpFud.launchToken)
     * @param recipient Recipient address (address(0) for broadcast)
     * @param amount Token amount to tip
     * @param message Message to display (max 200 chars)
     */
    function sendSuperchat(
        address token,
        address recipient,
        uint256 amount,
        string calldata message
    ) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (bytes(message).length > 200) revert MessageTooLong();

        // Transfer tokens from sender
        IERC20(token).transferFrom(msg.sender, address(this), amount);

        // Calculate platform fee (5%)
        uint256 fee = (amount * platformFeeBps) / 10000;
        uint256 recipientAmount = amount - fee;

        // Send fee to treasury
        IERC20(token).transfer(treasury, fee);

        // Handle recipient amount
        if (recipient == address(0)) {
            // Broadcast - handle based on destination setting
            uint8 destination = superchatDestination[token];
            if (destination == 1) {
                // Burn to dead address
                IERC20(token).transfer(address(0xdead), recipientAmount);
            } else if (destination == 2) {
                // Send to token contract (locked permanently)
                IERC20(token).transfer(token, recipientAmount);
            }
            // else destination == 0: keep in this contract (locked)
        } else {
            // Direct tip to user
            IERC20(token).transfer(recipient, recipientAmount);
        }

        uint256 tier = calculateTier(token, amount);

        tokenSuperchats[token].push(Superchat({
            sender: msg.sender,
            recipient: recipient,
            token: token,
            amount: amount,
            message: message,
            timestamp: block.timestamp,
            tier: tier
        }));

        totalSuperchatVolume[token] += amount;

        emit SuperchatSent(
            token,
            msg.sender,
            recipient,
            amount,
            message,
            tier,
            block.timestamp
        );
    }

    /**
     * @notice Calculate superchat tier based on amount
     */
    function calculateTier(address token, uint256 amount) public view returns (uint256) {
        TierConfig memory config = getTierConfig(token);

        if (amount >= config.tier5Min) return 5;
        if (amount >= config.tier4Min) return 4;
        if (amount >= config.tier3Min) return 3;
        if (amount >= config.tier2Min) return 2;
        if (amount >= config.tier1Min) return 1;
        return 0;
    }

    /**
     * @notice Get tier config (custom or defaults)
     */
    function getTierConfig(address token) public view returns (TierConfig memory) {
        if (hasCustomTiers[token]) {
            return tokenTiers[token];
        }
        return TierConfig({
            tier1Min: DEFAULT_TIER1,
            tier2Min: DEFAULT_TIER2,
            tier3Min: DEFAULT_TIER3,
            tier4Min: DEFAULT_TIER4,
            tier5Min: DEFAULT_TIER5
        });
    }

    /**
     * @notice Set custom tier thresholds for a token
     */
    function setTierConfig(
        address token,
        uint256 tier1,
        uint256 tier2,
        uint256 tier3,
        uint256 tier4,
        uint256 tier5
    ) external {
        require(tier1 < tier2 && tier2 < tier3 && tier3 < tier4 && tier4 < tier5, "Invalid tiers");

        tokenTiers[token] = TierConfig({
            tier1Min: tier1,
            tier2Min: tier2,
            tier3Min: tier3,
            tier4Min: tier4,
            tier5Min: tier5
        });
        hasCustomTiers[token] = true;

        emit TierConfigUpdated(token, tier1, tier2, tier3, tier4, tier5);
    }

    /**
     * @notice Set superchat destination for broadcast tips
     * @param destination 0=lock, 1=burn, 2=token contract
     */
    function setSuperchatDestination(address token, uint8 destination) external {
        require(destination <= 2, "Invalid destination");
        superchatDestination[token] = destination;
    }

    function setPlatformFee(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= 1000, "Max 10%");
        platformFeeBps = _feeBps;
    }

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid treasury");
        address oldTreasury = treasury;
        treasury = _treasury;
        emit TreasuryUpdated(oldTreasury, _treasury);
    }

    function getSuperchatCount(address token) external view returns (uint256) {
        return tokenSuperchats[token].length;
    }

    function getRecentSuperchats(
        address token,
        uint256 count
    ) external view returns (Superchat[] memory) {
        Superchat[] storage all = tokenSuperchats[token];
        uint256 total = all.length;

        if (count > total) count = total;

        Superchat[] memory result = new Superchat[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = all[total - count + i];
        }
        return result;
    }
}
