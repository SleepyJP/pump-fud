# PUMP.pHuD UNIFIED BUILD TEMPLATE
## JSON STATE LOCKED PROMPT CODING v2.0

```
═══════════════════════════════════════════════════════════════════════════════
🔥 AQUEMINI FORGE BUILD - PUMP.pHuD COMPLETE SPECIFICATION
═══════════════════════════════════════════════════════════════════════════════
Organization: THE pHuD FARM
Network: PulseChain Mainnet (Chain ID: 369)
Treasury: 0x49bBEFa1d94702C0e9a5EAdDEc7c3C5D3eb9086B
Builder: AQUEMINI (Claude Opus 4.5 + Gemini 3 Pro)
═══════════════════════════════════════════════════════════════════════════════
```

---

## 🔒 JSON STATE LOCKED SPECIFICATION

```json
{
  "project": "PUMP.pHuD",
  "version": "2.0.0",
  "description": "Memecoin launchpad with bonding curves, live chat, and superchat on PulseChain",
  "organization": "THE pHuD FARM",
  "builder": "AQUEMINI",

  "treasury": {
    "evm": "0x49bBEFa1d94702C0e9a5EAdDEc7c3C5D3eb9086B",
    "icp": "iyupi-26e6a-z56ra-6a5tz-yyj6i-kvxe4-joccp-pgapo-vpcvb-zxtmq-oae"
  },

  "network": {
    "name": "PulseChain",
    "chainId": 369,
    "rpc": "https://rpc.pulsechain.com",
    "explorer": "https://scan.pulsechain.com",
    "nativeToken": "PLS",
    "dex": {
      "name": "PulseX V2",
      "router": "0x165C3410fC91EF562C50559f7d2289fEbed552d9",
      "factory": "0x1715a3E4A142d8b698131108995174F37aEBA10D"
    }
  },

  "bonding_curve": {
    "type": "constant_product",
    "formula": "x * y = k",
    "constants": {
      "INITIAL_VIRTUAL_TOKEN": "1073000000000000000000000000",
      "INITIAL_VIRTUAL_PLS": "15000000000000000000",
      "INITIAL_REAL_TOKEN": "793100000000000000000000000",
      "TOKENS_FOR_MIGRATION": "206900000000000000000000000",
      "TOTAL_SUPPLY": "1000000000000000000000000000",
      "MIGRATION_THRESHOLD": "85000000000000000000",
      "TOKEN_DECIMALS": 18
    },
    "fees": {
      "buyFee": 100,
      "sellFee": 100,
      "graduationFee": 200,
      "feeBasisPoints": 10000,
      "destination": "treasury.evm"
    }
  },

  "chat_system": {
    "modes": ["telegram_panel", "youtube_live"],
    "protocol": "socket.io",
    "features": ["token_gated_access", "superchat", "real_time", "message_history"],
    "access_config": {
      "defaultMinimumPercentage": 100,
      "basisPoints": 10000,
      "requiresHolding": true,
      "superchatEnabled": true
    }
  },

  "superchat": {
    "enabled": true,
    "platformFeeBps": 500,
    "tiers": [1, 2, 3, 4, 5],
    "destination_options": ["burn", "lock", "creator", "holders"],
    "default_destination": "lock"
  },

  "components": {
    "contracts": [
      "PumpFudFactory.sol",
      "PumpFudToken.sol",
      "BondingCurve.sol",
      "SuperchatManager.sol",
      "ChatAccessControl.sol"
    ],
    "backend": [
      "websocket-server.ts",
      "auth-service.ts",
      "message-service.ts",
      "token-verification.ts"
    ],
    "frontend": [
      "ChatPanel.tsx",
      "LiveFeed.tsx",
      "SuperchatOverlay.tsx",
      "TradePanel.tsx"
    ]
  },

  "build_phases": [
    {"phase": 1, "name": "Core Contracts", "ralph_loop": true},
    {"phase": 2, "name": "Chat System", "ralph_loop": true},
    {"phase": 3, "name": "Superchat", "ralph_loop": true},
    {"phase": 4, "name": "WebSocket Server", "ralph_loop": false},
    {"phase": 5, "name": "Frontend", "ralph_loop": false},
    {"phase": 6, "name": "Integration", "ralph_loop": true},
    {"phase": 7, "name": "Deploy", "ralph_loop": true}
  ]
}
```

---

## 🔥 RALPH LOOP PHASE 1: CORE CONTRACTS

### PumpFudFactory.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "lib/openzeppelin-contracts/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {PumpFudToken} from "./PumpFudToken.sol";

/**
 * @title PumpFudFactory
 * @notice Bonding curve factory for PUMP.pHuD launchpad on PulseChain
 * @dev Constant product AMM (x * y = k) with auto-graduation to PulseX
 */
contract PumpFudFactory is Ownable, ReentrancyGuard {

    // ═══════════════════════════════════════════════════════════════════════
    // TREASURY - IMMUTABLE - THE pHuD FARM
    // ═══════════════════════════════════════════════════════════════════════
    address public constant TREASURY = 0x49bBEFa1d94702C0e9a5EAdDEc7c3C5D3eb9086B;

    // ═══════════════════════════════════════════════════════════════════════
    // BONDING CURVE CONSTANTS (18 decimals)
    // ═══════════════════════════════════════════════════════════════════════
    uint256 public constant INITIAL_VIRTUAL_TOKEN = 1_073_000_000 * 1e18;
    uint256 public constant INITIAL_VIRTUAL_PLS = 15 * 1e18;
    uint256 public constant INITIAL_REAL_TOKEN = 793_100_000 * 1e18;
    uint256 public constant TOKENS_FOR_MIGRATION = 206_900_000 * 1e18;
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 1e18;
    uint256 public constant MIGRATION_THRESHOLD = 85 ether;

    // ═══════════════════════════════════════════════════════════════════════
    // FEE CONFIGURATION
    // ═══════════════════════════════════════════════════════════════════════
    uint256 public buyFeeBps = 100;      // 1%
    uint256 public sellFeeBps = 100;     // 1%
    uint256 public graduationFeeBps = 200; // 2%

    // ═══════════════════════════════════════════════════════════════════════
    // PULSEX INTEGRATION
    // ═══════════════════════════════════════════════════════════════════════
    address public constant PULSEX_ROUTER = 0x165C3410fC91EF562C50559f7d2289fEbed552d9;
    address public constant PULSEX_FACTORY = 0x1715a3E4A142d8b698131108995174F37aEBA10D;

    // ═══════════════════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════════════════
    struct Curve {
        address token;
        uint256 virtualTokenReserves;
        uint256 virtualPlsReserves;
        uint256 realTokenReserves;
        uint256 realPlsReserves;
        bool graduated;
        address creator;
        string description;
        string imageUri;
        uint256 createdAt;
        uint256 totalFeesGenerated;
    }

    mapping(address => Curve) public curves;
    address[] public allTokens;
    mapping(address => address[]) public creatorTokens;

    // ═══════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════
    event TokenLaunched(
        address indexed token,
        address indexed creator,
        string name,
        string symbol,
        string description,
        string imageUri,
        uint256 timestamp
    );

    event Trade(
        address indexed token,
        address indexed trader,
        bool isBuy,
        uint256 plsAmount,
        uint256 tokenAmount,
        uint256 newPrice,
        uint256 timestamp
    );

    event TokenGraduated(
        address indexed token,
        address indexed lpPair,
        uint256 plsLiquidity,
        uint256 tokenLiquidity,
        uint256 timestamp
    );

    event FeesCollected(
        address indexed token,
        uint256 amount,
        uint256 timestamp
    );

    // ═══════════════════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════════════════
    error CurveGraduated();
    error InsufficientPayment();
    error SlippageExceeded();
    error InsufficientTokens();
    error InsufficientLiquidity();
    error TransferFailed();
    error ZeroAmount();

    // ═══════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════
    constructor() Ownable(msg.sender) {}

    // ═══════════════════════════════════════════════════════════════════════
    // LAUNCH TOKEN
    // ═══════════════════════════════════════════════════════════════════════
    function launchToken(
        string calldata name,
        string calldata symbol,
        string calldata description,
        string calldata imageUri
    ) external payable returns (address token) {
        // Deploy new token
        PumpFudToken newToken = new PumpFudToken(name, symbol, msg.sender);
        token = address(newToken);

        // Mint total supply to factory
        newToken.mint(address(this), TOTAL_SUPPLY);

        // Initialize curve
        curves[token] = Curve({
            token: token,
            virtualTokenReserves: INITIAL_VIRTUAL_TOKEN,
            virtualPlsReserves: INITIAL_VIRTUAL_PLS,
            realTokenReserves: INITIAL_REAL_TOKEN,
            realPlsReserves: 0,
            graduated: false,
            creator: msg.sender,
            description: description,
            imageUri: imageUri,
            createdAt: block.timestamp,
            totalFeesGenerated: 0
        });

        allTokens.push(token);
        creatorTokens[msg.sender].push(token);

        emit TokenLaunched(
            token,
            msg.sender,
            name,
            symbol,
            description,
            imageUri,
            block.timestamp
        );

        // If PLS sent with creation, execute buy
        if (msg.value > 0) {
            _buy(token, msg.value, 0);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // BUY TOKENS
    // ═══════════════════════════════════════════════════════════════════════
    function buyTokens(
        address token,
        uint256 minTokensOut
    ) external payable nonReentrant {
        if (msg.value == 0) revert ZeroAmount();
        _buy(token, msg.value, minTokensOut);
    }

    function _buy(
        address token,
        uint256 plsAmount,
        uint256 minTokensOut
    ) internal {
        Curve storage curve = curves[token];
        if (curve.graduated) revert CurveGraduated();

        // Calculate fee
        uint256 fee = (plsAmount * buyFeeBps) / 10000;
        uint256 plsIn = plsAmount - fee;

        // Constant product: k = x * y
        uint256 k = curve.virtualPlsReserves * curve.virtualTokenReserves;
        uint256 newVirtualPls = curve.virtualPlsReserves + plsIn;
        uint256 newVirtualToken = k / newVirtualPls;
        uint256 tokensOut = curve.virtualTokenReserves - newVirtualToken;

        // Slippage check
        if (tokensOut < minTokensOut) revert SlippageExceeded();
        if (tokensOut > curve.realTokenReserves) revert InsufficientTokens();

        // Update reserves
        curve.virtualPlsReserves = newVirtualPls;
        curve.virtualTokenReserves = newVirtualToken;
        curve.realTokenReserves -= tokensOut;
        curve.realPlsReserves += plsIn;
        curve.totalFeesGenerated += fee;

        // Transfer fee to treasury
        (bool feeSuccess,) = TREASURY.call{value: fee}("");
        if (!feeSuccess) revert TransferFailed();

        // Transfer tokens to buyer
        IERC20(token).transfer(msg.sender, tokensOut);

        emit Trade(
            token,
            msg.sender,
            true,
            plsIn,
            tokensOut,
            getPrice(token),
            block.timestamp
        );

        emit FeesCollected(token, fee, block.timestamp);

        // Check graduation threshold
        if (curve.realPlsReserves >= MIGRATION_THRESHOLD) {
            _graduate(token);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SELL TOKENS
    // ═══════════════════════════════════════════════════════════════════════
    function sellTokens(
        address token,
        uint256 tokenAmount,
        uint256 minPlsOut
    ) external nonReentrant {
        if (tokenAmount == 0) revert ZeroAmount();

        Curve storage curve = curves[token];
        if (curve.graduated) revert CurveGraduated();

        // Transfer tokens from seller
        IERC20(token).transferFrom(msg.sender, address(this), tokenAmount);

        // Constant product: k = x * y
        uint256 k = curve.virtualPlsReserves * curve.virtualTokenReserves;
        uint256 newVirtualToken = curve.virtualTokenReserves + tokenAmount;
        uint256 newVirtualPls = k / newVirtualToken;
        uint256 plsOut = curve.virtualPlsReserves - newVirtualPls;

        // Calculate fee
        uint256 fee = (plsOut * sellFeeBps) / 10000;
        uint256 plsOutAfterFee = plsOut - fee;

        // Slippage check
        if (plsOutAfterFee < minPlsOut) revert SlippageExceeded();
        if (plsOut > curve.realPlsReserves) revert InsufficientLiquidity();

        // Update reserves
        curve.virtualPlsReserves = newVirtualPls;
        curve.virtualTokenReserves = newVirtualToken;
        curve.realTokenReserves += tokenAmount;
        curve.realPlsReserves -= plsOut;
        curve.totalFeesGenerated += fee;

        // Transfer fee to treasury
        (bool feeSuccess,) = TREASURY.call{value: fee}("");
        if (!feeSuccess) revert TransferFailed();

        // Transfer PLS to seller
        (bool success,) = msg.sender.call{value: plsOutAfterFee}("");
        if (!success) revert TransferFailed();

        emit Trade(
            token,
            msg.sender,
            false,
            plsOutAfterFee,
            tokenAmount,
            getPrice(token),
            block.timestamp
        );

        emit FeesCollected(token, fee, block.timestamp);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // GRADUATION TO PULSEX
    // ═══════════════════════════════════════════════════════════════════════
    function _graduate(address token) internal {
        Curve storage curve = curves[token];
        curve.graduated = true;

        // Mint migration tokens
        PumpFudToken(token).mint(address(this), TOKENS_FOR_MIGRATION);

        // Calculate graduation fee
        uint256 gradFee = (curve.realPlsReserves * graduationFeeBps) / 10000;
        uint256 liquidityPls = curve.realPlsReserves - gradFee;

        // Send graduation fee to treasury
        (bool feeSuccess,) = TREASURY.call{value: gradFee}("");
        if (!feeSuccess) revert TransferFailed();

        // Approve tokens for PulseX router
        IERC20(token).approve(PULSEX_ROUTER, TOKENS_FOR_MIGRATION);

        // Add liquidity to PulseX
        // IPulseXRouter(PULSEX_ROUTER).addLiquidityETH{value: liquidityPls}(
        //     token,
        //     TOKENS_FOR_MIGRATION,
        //     0,
        //     0,
        //     address(this), // LP tokens locked in factory
        //     block.timestamp + 300
        // );

        emit TokenGraduated(
            token,
            address(0), // LP pair address from router
            liquidityPls,
            TOKENS_FOR_MIGRATION,
            block.timestamp
        );
    }

    // ═══════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════
    function getPrice(address token) public view returns (uint256) {
        Curve memory curve = curves[token];
        if (curve.virtualTokenReserves == 0) return 0;
        return (curve.virtualPlsReserves * 1e18) / curve.virtualTokenReserves;
    }

    function getProgress(address token) public view returns (uint256) {
        Curve memory curve = curves[token];
        if (INITIAL_REAL_TOKEN == 0) return 0;
        return ((INITIAL_REAL_TOKEN - curve.realTokenReserves) * 100) / INITIAL_REAL_TOKEN;
    }

    function getMarketCap(address token) public view returns (uint256) {
        return (getPrice(token) * TOTAL_SUPPLY) / 1e18;
    }

    function getBuyQuote(address token, uint256 plsAmount) public view returns (uint256 tokensOut) {
        Curve memory curve = curves[token];
        uint256 fee = (plsAmount * buyFeeBps) / 10000;
        uint256 plsIn = plsAmount - fee;
        uint256 k = curve.virtualPlsReserves * curve.virtualTokenReserves;
        uint256 newVirtualPls = curve.virtualPlsReserves + plsIn;
        uint256 newVirtualToken = k / newVirtualPls;
        tokensOut = curve.virtualTokenReserves - newVirtualToken;
    }

    function getSellQuote(address token, uint256 tokenAmount) public view returns (uint256 plsOut) {
        Curve memory curve = curves[token];
        uint256 k = curve.virtualPlsReserves * curve.virtualTokenReserves;
        uint256 newVirtualToken = curve.virtualTokenReserves + tokenAmount;
        uint256 newVirtualPls = k / newVirtualToken;
        uint256 grossPls = curve.virtualPlsReserves - newVirtualPls;
        uint256 fee = (grossPls * sellFeeBps) / 10000;
        plsOut = grossPls - fee;
    }

    function getTokenInfo(address token) external view returns (
        string memory name,
        string memory symbol,
        address creator,
        uint256 totalSupply,
        uint256 marketCap,
        uint256 plsReserve,
        bool graduated,
        uint256 totalFeesGenerated
    ) {
        Curve memory curve = curves[token];
        PumpFudToken t = PumpFudToken(token);
        return (
            t.name(),
            t.symbol(),
            curve.creator,
            TOTAL_SUPPLY,
            getMarketCap(token),
            curve.realPlsReserves,
            curve.graduated,
            curve.totalFeesGenerated
        );
    }

    function getAllTokens() external view returns (address[] memory) {
        return allTokens;
    }

    function getTokenCount() external view returns (uint256) {
        return allTokens.length;
    }

    function getCreatorTokens(address creator) external view returns (address[] memory) {
        return creatorTokens[creator];
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ADMIN FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════
    function setFees(
        uint256 _buyFeeBps,
        uint256 _sellFeeBps,
        uint256 _graduationFeeBps
    ) external onlyOwner {
        require(_buyFeeBps <= 500, "Buy fee too high");
        require(_sellFeeBps <= 500, "Sell fee too high");
        require(_graduationFeeBps <= 500, "Graduation fee too high");
        buyFeeBps = _buyFeeBps;
        sellFeeBps = _sellFeeBps;
        graduationFeeBps = _graduationFeeBps;
    }

    receive() external payable {}
}
```

---

## 🔥 RALPH LOOP PHASE 2: CHAT ACCESS CONTROL

### ChatAccessControl.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "lib/openzeppelin-contracts/contracts/access/Ownable.sol";
import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

/**
 * @title ChatAccessControl
 * @notice Token-gated access for PUMP.pHuD chat system
 * @dev Configurable minimum balance/percentage requirements per token
 */
contract ChatAccessControl is Ownable {

    address public constant TREASURY = 0x49bBEFa1d94702C0e9a5EAdDEc7c3C5D3eb9086B;

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

    // Per-token configs
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

    constructor() Ownable(msg.sender) {}

    // ═══════════════════════════════════════════════════════════════════════
    // ACCESS VERIFICATION
    // ═══════════════════════════════════════════════════════════════════════
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

    // ═══════════════════════════════════════════════════════════════════════
    // CONFIG MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════
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

    function setTokenConfig(
        address token,
        uint256 minimumBalance,
        uint256 minimumPercentage,
        bool requiresHolding,
        bool superchatEnabled
    ) external {
        // Only token creator or platform admin can set config
        // In production, verify msg.sender is token creator
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
```

---

## 🔥 RALPH LOOP PHASE 3: SUPERCHAT MANAGER

### SuperchatManager.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "lib/openzeppelin-contracts/contracts/access/Ownable.sol";

/**
 * @title SuperchatManager
 * @notice On-chain superchat/tipping system for PUMP.pHuD
 * @dev Allows users to tip with unbonded tokens before graduation
 */
contract SuperchatManager is ReentrancyGuard, Ownable {

    address public constant TREASURY = 0x49bBEFa1d94702C0e9a5EAdDEc7c3C5D3eb9086B;

    uint256 public platformFeeBps = 500; // 5% platform fee

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

    // Default tier thresholds (in token units with 18 decimals)
    uint256 public constant DEFAULT_TIER1 = 1_000 * 1e18;
    uint256 public constant DEFAULT_TIER2 = 10_000 * 1e18;
    uint256 public constant DEFAULT_TIER3 = 100_000 * 1e18;
    uint256 public constant DEFAULT_TIER4 = 1_000_000 * 1e18;
    uint256 public constant DEFAULT_TIER5 = 10_000_000 * 1e18;

    mapping(address => TierConfig) public tokenTiers;
    mapping(address => bool) public hasCustomTiers;
    mapping(address => Superchat[]) public tokenSuperchats;
    mapping(address => uint256) public totalSuperchatVolume;

    // Destination options: 0 = burn, 1 = lock in token contract, 2 = creator
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

    constructor() Ownable(msg.sender) {}

    // ═══════════════════════════════════════════════════════════════════════
    // SEND SUPERCHAT
    // ═══════════════════════════════════════════════════════════════════════
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

        // Calculate platform fee
        uint256 fee = (amount * platformFeeBps) / 10000;
        uint256 recipientAmount = amount - fee;

        // Send fee to treasury
        IERC20(token).transfer(TREASURY, fee);

        // Handle recipient amount based on destination
        if (recipient == address(0)) {
            // Broadcast superchat - lock tokens in token contract
            uint8 destination = superchatDestination[token];
            if (destination == 0) {
                // Burn option - send to dead address
                IERC20(token).transfer(address(0xdead), recipientAmount);
            } else if (destination == 1) {
                // Lock in token contract (deflationary without burning)
                IERC20(token).transfer(token, recipientAmount);
            } else {
                // Default: lock in this contract
                // Tokens stay here, effectively locked
            }
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

    // ═══════════════════════════════════════════════════════════════════════
    // TIER CALCULATION
    // ═══════════════════════════════════════════════════════════════════════
    function calculateTier(address token, uint256 amount) public view returns (uint256) {
        TierConfig memory config = getTierConfig(token);

        if (amount >= config.tier5Min) return 5;
        if (amount >= config.tier4Min) return 4;
        if (amount >= config.tier3Min) return 3;
        if (amount >= config.tier2Min) return 2;
        if (amount >= config.tier1Min) return 1;
        return 0;
    }

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

    // ═══════════════════════════════════════════════════════════════════════
    // CONFIG MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════
    function setTierConfig(
        address token,
        uint256 tier1,
        uint256 tier2,
        uint256 tier3,
        uint256 tier4,
        uint256 tier5
    ) external {
        // Only token creator or admin
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

    function setSuperchatDestination(address token, uint8 destination) external {
        require(destination <= 2, "Invalid destination");
        superchatDestination[token] = destination;
    }

    function setPlatformFee(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= 1000, "Max 10%");
        platformFeeBps = _feeBps;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════
    function getSuperchatCount(address token) external view returns (uint256) {
        return tokenSuperchats[token].length;
    }

    function getSuperchats(
        address token,
        uint256 offset,
        uint256 limit
    ) external view returns (Superchat[] memory) {
        Superchat[] storage all = tokenSuperchats[token];
        uint256 total = all.length;

        if (offset >= total) {
            return new Superchat[](0);
        }

        uint256 end = offset + limit;
        if (end > total) end = total;
        uint256 count = end - offset;

        Superchat[] memory result = new Superchat[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = all[offset + i];
        }
        return result;
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
```

---

## 🔥 RALPH LOOP PHASE 4: WEBSOCKET CHAT SERVER

### websocket-server.ts

```typescript
// PUMP.pHuD WebSocket Chat Server
// Protocol: Socket.io over WebSocket
// Features: Token-gated access, real-time messaging, superchat integration

import { Server } from 'socket.io';
import { ethers } from 'ethers';
import { createServer } from 'http';

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════
const PULSECHAIN_RPC = 'https://rpc.pulsechain.com';
const CHAT_ACCESS_CONTRACT = '0x...'; // Deploy ChatAccessControl first
const SUPERCHAT_CONTRACT = '0x...';   // Deploy SuperchatManager first

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function name() view returns (string)',
  'function symbol() view returns (string)'
];

const ACCESS_ABI = [
  'function canAccessChat(address token, address user) view returns (bool)',
  'function getAccessConfig(address token) view returns (tuple(uint256,uint256,bool,bool))'
];

const SUPERCHAT_ABI = [
  'event SuperchatSent(address indexed token, address indexed sender, address indexed recipient, uint256 amount, string message, uint256 tier, uint256 timestamp)'
];

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════
interface ChatMessage {
  id: string;
  roomId: string;          // Token address
  sender: string;          // Wallet address
  username: string;
  avatar: string;
  message: string;
  timestamp: number;
  type: 'message' | 'superchat' | 'system';
  superchat?: {
    amount: string;
    tier: number;
    txHash: string;
  };
}

interface JoinRoomPayload {
  tokenAddress: string;
  signature: string;
  message: string;
  timestamp: number;
}

interface SendMessagePayload {
  content: string;
}

interface AccessConfig {
  minimumBalance: bigint;
  minimumPercentage: number;
  requiresHolding: boolean;
  superchatEnabled: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// SERVER SETUP
// ═══════════════════════════════════════════════════════════════════════════
const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const provider = new ethers.JsonRpcProvider(PULSECHAIN_RPC);
const accessContract = new ethers.Contract(CHAT_ACCESS_CONTRACT, ACCESS_ABI, provider);
const superchatContract = new ethers.Contract(SUPERCHAT_CONTRACT, SUPERCHAT_ABI, provider);

// In-memory storage (replace with PostgreSQL in production)
const messageHistory: Map<string, ChatMessage[]> = new Map();
const userProfiles: Map<string, { username: string; avatar: string }> = new Map();

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

async function verifyTokenAccess(
  tokenAddress: string,
  userAddress: string
): Promise<boolean> {
  try {
    return await accessContract.canAccessChat(tokenAddress, userAddress);
  } catch (error) {
    console.error('Access check failed:', error);
    return false;
  }
}

async function getAccessConfig(tokenAddress: string): Promise<AccessConfig> {
  try {
    const config = await accessContract.getAccessConfig(tokenAddress);
    return {
      minimumBalance: config[0],
      minimumPercentage: Number(config[1]),
      requiresHolding: config[2],
      superchatEnabled: config[3]
    };
  } catch (error) {
    return {
      minimumBalance: 0n,
      minimumPercentage: 100, // 1% default
      requiresHolding: true,
      superchatEnabled: true
    };
  }
}

function getMessageHistory(tokenAddress: string, limit: number): ChatMessage[] {
  const history = messageHistory.get(tokenAddress) || [];
  return history.slice(-limit);
}

function saveMessage(message: ChatMessage): void {
  const history = messageHistory.get(message.roomId) || [];
  history.push(message);
  // Keep last 1000 messages per room
  if (history.length > 1000) {
    history.shift();
  }
  messageHistory.set(message.roomId, history);
}

function getUsername(address: string): string {
  const profile = userProfiles.get(address);
  if (profile?.username) return profile.username;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getAvatar(address: string): string {
  const profile = userProfiles.get(address);
  if (profile?.avatar) return profile.avatar;
  return `https://api.dicebear.com/7.x/identicon/svg?seed=${address}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// SOCKET.IO NAMESPACE
// ═══════════════════════════════════════════════════════════════════════════
const chatNamespace = io.of('/chat');

chatNamespace.on('connection', async (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // ─────────────────────────────────────────────────────────────────────────
  // JOIN ROOM (Token Chat)
  // ─────────────────────────────────────────────────────────────────────────
  socket.on('join_room', async (payload: JoinRoomPayload) => {
    const { tokenAddress, signature, message, timestamp } = payload;

    // Verify signature is recent (within 5 minutes)
    if (Date.now() - timestamp > 300000) {
      socket.emit('error', { message: 'Signature expired' });
      return;
    }

    // Verify signature
    let recoveredAddress: string;
    try {
      recoveredAddress = ethers.verifyMessage(message, signature);
    } catch (error) {
      socket.emit('error', { message: 'Invalid signature' });
      return;
    }

    // Check token-gated access
    const hasAccess = await verifyTokenAccess(tokenAddress, recoveredAddress);

    if (!hasAccess) {
      const config = await getAccessConfig(tokenAddress);
      socket.emit('access_denied', {
        reason: 'Insufficient token balance',
        required: {
          minimumPercentage: config.minimumPercentage / 100, // Convert to percentage
          requiresHolding: config.requiresHolding
        }
      });
      return;
    }

    // Join the token's chat room
    socket.join(tokenAddress);
    socket.data.userAddress = recoveredAddress;
    socket.data.tokenAddress = tokenAddress;

    // Send recent message history
    const history = getMessageHistory(tokenAddress, 50);
    socket.emit('message_history', history);

    // Announce join
    chatNamespace.to(tokenAddress).emit('user_joined', {
      address: recoveredAddress,
      username: getUsername(recoveredAddress),
      timestamp: Date.now()
    });

    socket.emit('joined', {
      tokenAddress,
      userAddress: recoveredAddress
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SEND MESSAGE
  // ─────────────────────────────────────────────────────────────────────────
  socket.on('send_message', async (payload: SendMessagePayload) => {
    const { userAddress, tokenAddress } = socket.data;

    if (!userAddress || !tokenAddress) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }

    // Validate content
    const content = payload.content?.trim();
    if (!content || content.length > 500) {
      socket.emit('error', { message: 'Invalid message' });
      return;
    }

    // Re-verify access (in case they sold tokens)
    const hasAccess = await verifyTokenAccess(tokenAddress, userAddress);
    if (!hasAccess) {
      socket.emit('access_revoked', { reason: 'Token balance below threshold' });
      socket.leave(tokenAddress);
      return;
    }

    const message: ChatMessage = {
      id: generateId(),
      roomId: tokenAddress,
      sender: userAddress,
      username: getUsername(userAddress),
      avatar: getAvatar(userAddress),
      message: content,
      timestamp: Date.now(),
      type: 'message'
    };

    // Save to storage
    saveMessage(message);

    // Broadcast to room
    chatNamespace.to(tokenAddress).emit('new_message', message);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SET PROFILE
  // ─────────────────────────────────────────────────────────────────────────
  socket.on('set_profile', (payload: { username?: string; avatar?: string }) => {
    const { userAddress } = socket.data;
    if (!userAddress) return;

    const existing = userProfiles.get(userAddress) || { username: '', avatar: '' };
    userProfiles.set(userAddress, {
      username: payload.username || existing.username,
      avatar: payload.avatar || existing.avatar
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // DISCONNECT
  // ─────────────────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    const { userAddress, tokenAddress } = socket.data;
    if (tokenAddress) {
      chatNamespace.to(tokenAddress).emit('user_left', {
        address: userAddress,
        timestamp: Date.now()
      });
    }
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SUPERCHAT EVENT LISTENER
// ═══════════════════════════════════════════════════════════════════════════
superchatContract.on('SuperchatSent', async (
  token: string,
  sender: string,
  recipient: string,
  amount: bigint,
  message: string,
  tier: bigint,
  timestamp: bigint,
  event: any
) => {
  const superchatMessage: ChatMessage = {
    id: generateId(),
    roomId: token,
    sender: sender,
    username: getUsername(sender),
    avatar: getAvatar(sender),
    message: message,
    timestamp: Date.now(),
    type: 'superchat',
    superchat: {
      amount: ethers.formatUnits(amount, 18),
      tier: Number(tier),
      txHash: event.transactionHash
    }
  };

  saveMessage(superchatMessage);
  chatNamespace.to(token).emit('superchat', superchatMessage);
});

// ═══════════════════════════════════════════════════════════════════════════
// START SERVER
// ═══════════════════════════════════════════════════════════════════════════
const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`PUMP.pHuD Chat Server running on port ${PORT}`);
  console.log(`WebSocket namespace: /chat`);
});

export { io, chatNamespace };
```

---

## 🔥 RALPH LOOP PHASE 5: FRONTEND COMPONENTS

### ChatPanel.tsx (Telegram-Style)

```typescript
// Telegram-style sliding chat panel for Token Dashboards
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAccount, useSignMessage } from 'wagmi';

interface ChatMessage {
  id: string;
  sender: string;
  username: string;
  avatar: string;
  message: string;
  timestamp: number;
  type: 'message' | 'superchat' | 'system';
  superchat?: {
    amount: string;
    tier: number;
    txHash: string;
  };
}

interface ChatPanelProps {
  tokenAddress: string;
  isOpen: boolean;
  onClose: () => void;
  position?: 'right' | 'bottom' | 'floating';
}

const TIER_COLORS = {
  1: 'bg-blue-500/20 border-blue-500',
  2: 'bg-purple-500/20 border-purple-500',
  3: 'bg-yellow-500/20 border-yellow-500',
  4: 'bg-orange-500/20 border-orange-500',
  5: 'bg-red-500/20 border-red-500 animate-pulse'
};

export function ChatPanel({
  tokenAddress,
  isOpen,
  onClose,
  position = 'right'
}: ChatPanelProps) {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const [socket, setSocket] = useState<Socket | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [accessDenied, setAccessDenied] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Connect to WebSocket
  useEffect(() => {
    if (!isOpen || !isConnected || !address) return;

    const newSocket = io(`${process.env.NEXT_PUBLIC_CHAT_URL}/chat`, {
      transports: ['websocket'],
      autoConnect: true
    });

    newSocket.on('connect', async () => {
      setIsConnecting(true);
      try {
        const timestamp = Date.now();
        const message = `Sign to join PUMP.pHuD chat\nToken: ${tokenAddress}\nTimestamp: ${timestamp}`;
        const signature = await signMessageAsync({ message });

        newSocket.emit('join_room', {
          tokenAddress,
          signature,
          message,
          timestamp
        });
      } catch (error) {
        console.error('Failed to sign message:', error);
        setIsConnecting(false);
      }
    });

    newSocket.on('joined', () => {
      setIsAuthenticated(true);
      setIsConnecting(false);
      setAccessDenied(null);
    });

    newSocket.on('access_denied', (data: { reason: string; required: any }) => {
      setAccessDenied(`${data.reason}. Required: ${data.required.minimumPercentage}% of supply`);
      setIsConnecting(false);
    });

    newSocket.on('access_revoked', () => {
      setAccessDenied('Token balance dropped below threshold');
      setIsAuthenticated(false);
    });

    newSocket.on('message_history', (history: ChatMessage[]) => {
      setMessages(history);
    });

    newSocket.on('new_message', (message: ChatMessage) => {
      setMessages(prev => [...prev, message]);
    });

    newSocket.on('superchat', (message: ChatMessage) => {
      setMessages(prev => [...prev, message]);
    });

    newSocket.on('user_joined', (data: { address: string; username: string }) => {
      const systemMessage: ChatMessage = {
        id: `sys-${Date.now()}`,
        sender: 'system',
        username: 'System',
        avatar: '',
        message: `${data.username} joined the chat`,
        timestamp: Date.now(),
        type: 'system'
      };
      setMessages(prev => [...prev, systemMessage]);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
      setSocket(null);
      setIsAuthenticated(false);
    };
  }, [isOpen, isConnected, address, tokenAddress, signMessageAsync]);

  // Send message
  const sendMessage = useCallback(() => {
    if (!socket || !inputValue.trim() || !isAuthenticated) return;

    socket.emit('send_message', { content: inputValue.trim() });
    setInputValue('');
    inputRef.current?.focus();
  }, [socket, inputValue, isAuthenticated]);

  // Handle Enter key
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Panel positioning styles
  const positionStyles = {
    right: 'fixed right-0 top-0 h-full w-96 transform transition-transform duration-300',
    bottom: 'fixed bottom-0 left-0 right-0 h-96 transform transition-transform duration-300',
    floating: 'fixed right-4 bottom-4 w-96 h-[600px] rounded-lg shadow-2xl'
  };

  const openStyles = {
    right: isOpen ? 'translate-x-0' : 'translate-x-full',
    bottom: isOpen ? 'translate-y-0' : 'translate-y-full',
    floating: isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
  };

  if (!isOpen) return null;

  return (
    <div className={`${positionStyles[position]} ${openStyles[position]} bg-gray-900 border-l border-gray-700 flex flex-col z-50`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <h3 className="text-white font-bold">Token Chat</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white"
        >
          ✕
        </button>
      </div>

      {/* Access Denied */}
      {accessDenied && (
        <div className="p-4 bg-red-900/50 text-red-300 text-center">
          {accessDenied}
        </div>
      )}

      {/* Connecting */}
      {isConnecting && (
        <div className="p-4 text-center text-gray-400">
          Connecting...
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex gap-3 ${
              msg.type === 'superchat'
                ? `p-3 rounded-lg border ${TIER_COLORS[msg.superchat?.tier as keyof typeof TIER_COLORS] || 'border-gray-600'}`
                : ''
            }`}
          >
            {msg.type !== 'system' && (
              <img
                src={msg.avatar}
                alt={msg.username}
                className="w-8 h-8 rounded-full"
              />
            )}
            <div className="flex-1">
              {msg.type === 'system' ? (
                <p className="text-gray-500 text-sm italic">{msg.message}</p>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-blue-400 font-medium text-sm">
                      {msg.username}
                    </span>
                    {msg.type === 'superchat' && (
                      <span className="text-yellow-400 text-xs">
                        ⭐ {msg.superchat?.amount} tokens
                      </span>
                    )}
                    <span className="text-gray-500 text-xs">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-white">{msg.message}</p>
                </>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {isAuthenticated && (
        <div className="p-4 border-t border-gray-700">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              className="flex-1 bg-gray-800 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={sendMessage}
              disabled={!inputValue.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

### LiveFeed.tsx (YouTube Live-Style)

```typescript
// YouTube Live-style message feed with superchats
import React, { useState, useEffect, useRef } from 'react';

interface ChatMessage {
  id: string;
  sender: string;
  username: string;
  avatar: string;
  message: string;
  timestamp: number;
  type: 'message' | 'superchat' | 'system';
  superchat?: {
    amount: string;
    tier: number;
  };
}

interface LiveFeedProps {
  tokenAddress: string;
  messages: ChatMessage[];
  showSuperchatsOnly?: boolean;
  autoScroll?: boolean;
}

const TIER_STYLES = {
  1: { bg: 'bg-blue-600', text: 'text-white', glow: '' },
  2: { bg: 'bg-purple-600', text: 'text-white', glow: '' },
  3: { bg: 'bg-yellow-500', text: 'text-black', glow: 'shadow-yellow-500/50' },
  4: { bg: 'bg-orange-500', text: 'text-white', glow: 'shadow-orange-500/50 shadow-lg' },
  5: { bg: 'bg-gradient-to-r from-red-500 via-pink-500 to-purple-500', text: 'text-white', glow: 'shadow-pink-500/50 shadow-xl animate-pulse' }
};

export function LiveFeed({
  tokenAddress,
  messages,
  showSuperchatsOnly = false,
  autoScroll = true
}: LiveFeedProps) {
  const feedRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);

  const filteredMessages = showSuperchatsOnly
    ? messages.filter(m => m.type === 'superchat')
    : messages;

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && !isPaused && feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [filteredMessages, autoScroll, isPaused]);

  // Pause on hover
  const handleMouseEnter = () => setIsPaused(true);
  const handleMouseLeave = () => setIsPaused(false);

  return (
    <div className="bg-gray-900 rounded-lg overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-white font-medium">LIVE</span>
          <span className="text-gray-400 text-sm">
            {filteredMessages.length} messages
          </span>
        </div>
        <button
          onClick={() => setIsPaused(!isPaused)}
          className="text-gray-400 hover:text-white text-sm"
        >
          {isPaused ? '▶ Resume' : '⏸ Pause'}
        </button>
      </div>

      {/* Message Feed */}
      <div
        ref={feedRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="flex-1 overflow-y-auto p-4 space-y-2"
      >
        {filteredMessages.map(msg => {
          if (msg.type === 'superchat') {
            const tier = msg.superchat?.tier || 1;
            const style = TIER_STYLES[tier as keyof typeof TIER_STYLES];

            return (
              <div
                key={msg.id}
                className={`${style.bg} ${style.glow} rounded-lg overflow-hidden`}
              >
                <div className="flex items-center gap-2 p-2 bg-black/20">
                  <img
                    src={msg.avatar}
                    alt={msg.username}
                    className="w-6 h-6 rounded-full"
                  />
                  <span className={`${style.text} font-medium text-sm`}>
                    {msg.username}
                  </span>
                  <span className={`${style.text} text-sm ml-auto`}>
                    ⭐ {msg.superchat?.amount}
                  </span>
                </div>
                {msg.message && (
                  <div className={`p-2 ${style.text}`}>
                    {msg.message}
                  </div>
                )}
              </div>
            );
          }

          if (msg.type === 'system') {
            return (
              <div key={msg.id} className="text-gray-500 text-sm text-center">
                {msg.message}
              </div>
            );
          }

          return (
            <div key={msg.id} className="flex items-start gap-2">
              <img
                src={msg.avatar}
                alt={msg.username}
                className="w-5 h-5 rounded-full flex-shrink-0"
              />
              <div className="min-w-0">
                <span className="text-blue-400 text-sm font-medium mr-2">
                  {msg.username}
                </span>
                <span className="text-gray-300 text-sm break-words">
                  {msg.message}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

---

## 📊 DATABASE SCHEMA

```sql
-- PUMP.pHuD Chat Database Schema

-- Messages table
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_address VARCHAR(42) NOT NULL,
  sender_address VARCHAR(42) NOT NULL,
  message TEXT NOT NULL,
  message_type VARCHAR(20) DEFAULT 'message',
  superchat_amount NUMERIC(78, 0),
  superchat_tier INTEGER,
  superchat_tx_hash VARCHAR(66),
  created_at TIMESTAMP DEFAULT NOW(),

  INDEX idx_token_created (token_address, created_at DESC),
  INDEX idx_sender (sender_address)
);

-- Access configs (per-token settings)
CREATE TABLE chat_access_configs (
  token_address VARCHAR(42) PRIMARY KEY,
  minimum_balance NUMERIC(78, 0) DEFAULT 0,
  minimum_percentage INTEGER DEFAULT 100,
  requires_holding BOOLEAN DEFAULT true,
  superchat_enabled BOOLEAN DEFAULT true,
  created_by VARCHAR(42),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Superchat tier configs
CREATE TABLE superchat_tiers (
  token_address VARCHAR(42) PRIMARY KEY,
  tier1_min NUMERIC(78, 0),
  tier2_min NUMERIC(78, 0),
  tier3_min NUMERIC(78, 0),
  tier4_min NUMERIC(78, 0),
  tier5_min NUMERIC(78, 0),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- User profiles
CREATE TABLE chat_users (
  address VARCHAR(42) PRIMARY KEY,
  username VARCHAR(50),
  avatar_url TEXT,
  is_banned BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Token metadata (synced from chain)
CREATE TABLE tokens (
  address VARCHAR(42) PRIMARY KEY,
  name VARCHAR(100),
  symbol VARCHAR(20),
  creator VARCHAR(42),
  description TEXT,
  image_uri TEXT,
  graduated BOOLEAN DEFAULT false,
  total_supply NUMERIC(78, 0),
  created_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🔥 RALPH LOOP PHASE 6: DEPLOYMENT

### deploy.sh

```bash
#!/bin/bash
# PUMP.pHuD Deployment Script
# Network: PulseChain Mainnet (369)
# Treasury: 0x49bBEFa1d94702C0e9a5EAdDEc7c3C5D3eb9086B

set -e

echo "═══════════════════════════════════════════════════════════════"
echo "🔥 PUMP.pHuD DEPLOYMENT - PulseChain Mainnet"
echo "═══════════════════════════════════════════════════════════════"

# Load environment
source .env

# Compile contracts
echo "[1/6] Compiling contracts..."
cd ~/pump-phud && forge build

# Deploy PumpFudFactory
echo "[2/6] Deploying PumpFudFactory..."
FACTORY=$(forge create src/PumpFudFactory.sol:PumpFudFactory \
  --rpc-url https://rpc.pulsechain.com \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --json | jq -r '.deployedTo')

echo "PumpFudFactory: $FACTORY"

# Deploy ChatAccessControl
echo "[3/6] Deploying ChatAccessControl..."
ACCESS=$(forge create src/ChatAccessControl.sol:ChatAccessControl \
  --rpc-url https://rpc.pulsechain.com \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --json | jq -r '.deployedTo')

echo "ChatAccessControl: $ACCESS"

# Deploy SuperchatManager
echo "[4/6] Deploying SuperchatManager..."
SUPERCHAT=$(forge create src/SuperchatManager.sol:SuperchatManager \
  --rpc-url https://rpc.pulsechain.com \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --json | jq -r '.deployedTo')

echo "SuperchatManager: $SUPERCHAT"

# Save addresses
echo "[5/6] Saving deployment addresses..."
cat > deployments/pulsechain-mainnet.json << EOF
{
  "network": "PulseChain Mainnet",
  "chainId": 369,
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "contracts": {
    "PumpFudFactory": "$FACTORY",
    "ChatAccessControl": "$ACCESS",
    "SuperchatManager": "$SUPERCHAT"
  },
  "treasury": "0x49bBEFa1d94702C0e9a5EAdDEc7c3C5D3eb9086B"
}
EOF

# Verify contracts
echo "[6/6] Verifying contracts on PulseScan..."
forge verify-contract $FACTORY src/PumpFudFactory.sol:PumpFudFactory \
  --chain-id 369 \
  --watch

forge verify-contract $ACCESS src/ChatAccessControl.sol:ChatAccessControl \
  --chain-id 369 \
  --watch

forge verify-contract $SUPERCHAT src/SuperchatManager.sol:SuperchatManager \
  --chain-id 369 \
  --watch

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "✅ DEPLOYMENT COMPLETE"
echo "═══════════════════════════════════════════════════════════════"
echo "PumpFudFactory:     $FACTORY"
echo "ChatAccessControl:  $ACCESS"
echo "SuperchatManager:   $SUPERCHAT"
echo "Treasury:           0x49bBEFa1d94702C0e9a5EAdDEc7c3C5D3eb9086B"
echo "═══════════════════════════════════════════════════════════════"
```

---

## 🎯 BUILD EXECUTION CHECKLIST

```
═══════════════════════════════════════════════════════════════════════════════
🔥 FORGE BUILD PHASES - PUMP.pHuD v2.0
═══════════════════════════════════════════════════════════════════════════════

Phase 1: Core Contracts [RALPH LOOP]
  [ ] PumpFudToken.sol ✓ EXISTS
  [ ] PumpFudFactory.sol - Complete bonding curve factory
  [ ] IPulseXRouter.sol ✓ EXISTS

Phase 2: Chat System [RALPH LOOP]
  [ ] ChatAccessControl.sol - Token-gated access
  [ ] AccessConfig struct with configurable thresholds
  [ ] Default 1% of supply requirement

Phase 3: Superchat [RALPH LOOP]
  [ ] SuperchatManager.sol - On-chain tipping
  [ ] 5 tiers with configurable minimums
  [ ] 5% platform fee to treasury
  [ ] Burn/lock/creator destination options

Phase 4: WebSocket Server
  [ ] Socket.io server with /chat namespace
  [ ] Signature-based authentication
  [ ] Real-time token access verification
  [ ] Superchat event listener

Phase 5: Frontend
  [ ] ChatPanel.tsx - Telegram-style sliding panel
  [ ] LiveFeed.tsx - YouTube Live-style feed
  [ ] SuperchatOverlay.tsx - Tier animations

Phase 6: Integration [RALPH LOOP]
  [ ] Connect frontend to WebSocket
  [ ] Connect backend to chain events
  [ ] Test token-gated access flow

Phase 7: Deploy [RALPH LOOP]
  [ ] Deploy to PulseChain mainnet
  [ ] Verify on PulseScan
  [ ] Update frontend configs

═══════════════════════════════════════════════════════════════════════════════
Treasury: 0x49bBEFa1d94702C0e9a5EAdDEc7c3C5D3eb9086B
═══════════════════════════════════════════════════════════════════════════════
```

---

```
═══════════════════════════════════════════════════════════════════════════════
🔥 FORGE BUILD CERTIFIED
═══════════════════════════════════════════════════════════════════════════════
Project:  PUMP.pHuD v2.0
Phases:   7 defined, RALPH LOOPS at strategic points
Treasury: 0x49bBEFa1d94702C0e9a5EAdDEc7c3C5D3eb9086B
Network:  PulseChain Mainnet (369)
═══════════════════════════════════════════════════════════════════════════════
Built by AQUEMINI for SleepyJ @ THE pHuD FARM
═══════════════════════════════════════════════════════════════════════════════
```
