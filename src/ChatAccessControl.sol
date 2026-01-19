// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "lib/openzeppelin-contracts/contracts/access/Ownable.sol";
import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

/**
 * @title ChatAccessControl
 * @notice Token-gated access for PUMP.FUD chat system
 * @dev Integrates with existing PumpFud.sol - uses token balance verification
 *      Default: 1% of token supply required to chat
 */
contract ChatAccessControl is Ownable {

    // ADJUSTABLE - not constant
    address public treasury;

    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);

    struct AccessConfig {
        uint256 minimumBalance;     // Minimum tokens to hold (in wei)
        uint256 minimumPercentage;  // Minimum % of supply (basis points, 100 = 1%)
        bool requiresHolding;       // Toggle for token gating
        bool superchatEnabled;      // Toggle for superchat feature
    }

    // Platform defaults
    uint256 public defaultMinimumPercentage = 100; // 1% of supply
    bool public defaultRequiresHolding = true;
    bool public defaultSuperchatEnabled = true;

    // Per-token configs (keyed by token address from PumpFud.sol)
    mapping(address => AccessConfig) public tokenConfigs;
    mapping(address => bool) public hasCustomConfig;

    event AccessConfigUpdated(
        address indexed token,
        uint256 minimumBalance,
        uint256 minimumPercentage,
        bool requiresHolding,
        bool superchatEnabled
    );

    event DefaultsUpdated(
        uint256 minimumPercentage,
        bool requiresHolding,
        bool superchatEnabled
    );

    constructor(address _treasury) Ownable(msg.sender) {
        require(_treasury != address(0), "Invalid treasury");
        treasury = _treasury;
    }

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid treasury");
        address oldTreasury = treasury;
        treasury = _treasury;
        emit TreasuryUpdated(oldTreasury, _treasury);
    }

    /**
     * @notice Check if user can access chat for a token
     * @param token Token address (from PumpFud.launchToken)
     * @param user User wallet address
     * @return True if user meets access requirements
     */
    function canAccessChat(
        address token,
        address user
    ) external view returns (bool) {
        AccessConfig memory config = getAccessConfig(token);

        if (!config.requiresHolding) {
            return true;
        }

        IERC20 tokenContract = IERC20(token);
        uint256 userBalance = tokenContract.balanceOf(user);
        uint256 totalSupply = tokenContract.totalSupply();

        // Check minimum balance
        if (config.minimumBalance > 0) {
            if (userBalance < config.minimumBalance) return false;
        }

        // Check minimum percentage (basis points)
        if (config.minimumPercentage > 0 && totalSupply > 0) {
            uint256 userPercentage = (userBalance * 10000) / totalSupply;
            if (userPercentage < config.minimumPercentage) return false;
        }

        return true;
    }

    /**
     * @notice Get detailed chat status for user
     * @param token Token address
     * @param user User wallet address
     */
    function getUserChatStatus(
        address token,
        address user
    ) external view returns (
        bool hasAccess,
        uint256 userBalance,
        uint256 userPercentage,
        uint256 requiredBalance,
        uint256 requiredPercentage
    ) {
        AccessConfig memory config = getAccessConfig(token);
        IERC20 tokenContract = IERC20(token);

        userBalance = tokenContract.balanceOf(user);
        uint256 totalSupply = tokenContract.totalSupply();

        if (totalSupply > 0) {
            userPercentage = (userBalance * 10000) / totalSupply;
        }

        requiredBalance = config.minimumBalance;
        requiredPercentage = config.minimumPercentage;

        hasAccess = !config.requiresHolding ||
            (userBalance >= requiredBalance && userPercentage >= requiredPercentage);
    }

    /**
     * @notice Get access config for token (custom or defaults)
     */
    function getAccessConfig(address token) public view returns (AccessConfig memory) {
        if (hasCustomConfig[token]) {
            return tokenConfigs[token];
        }
        return AccessConfig({
            minimumBalance: 0,
            minimumPercentage: defaultMinimumPercentage,
            requiresHolding: defaultRequiresHolding,
            superchatEnabled: defaultSuperchatEnabled
        });
    }

    /**
     * @notice Set custom config for a token
     * @dev Can be called by token creator (verify externally) or platform admin
     */
    function setTokenConfig(
        address token,
        uint256 minimumBalance,
        uint256 minimumPercentage,
        bool requiresHolding,
        bool superchatEnabled
    ) external {
        require(minimumPercentage <= 5000, "Max 50%");

        tokenConfigs[token] = AccessConfig({
            minimumBalance: minimumBalance,
            minimumPercentage: minimumPercentage,
            requiresHolding: requiresHolding,
            superchatEnabled: superchatEnabled
        });
        hasCustomConfig[token] = true;

        emit AccessConfigUpdated(
            token,
            minimumBalance,
            minimumPercentage,
            requiresHolding,
            superchatEnabled
        );
    }

    /**
     * @notice Update platform-wide defaults
     */
    function setDefaults(
        uint256 _minimumPercentage,
        bool _requiresHolding,
        bool _superchatEnabled
    ) external onlyOwner {
        require(_minimumPercentage <= 5000, "Max 50%");
        defaultMinimumPercentage = _minimumPercentage;
        defaultRequiresHolding = _requiresHolding;
        defaultSuperchatEnabled = _superchatEnabled;

        emit DefaultsUpdated(_minimumPercentage, _requiresHolding, _superchatEnabled);
    }
}
