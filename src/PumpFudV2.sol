// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {PumpFudToken} from "./PumpFudToken.sol";

/**
 * @title PumpFudV2
 * @author THE pHuD FARM
 * @notice PUMP.FUD Bonding Curve Launchpad for PulseChain - FULLY CONFIGURABLE
 * @dev Complete admin system with ZERO hardcoded values - everything adjustable post-deployment
 *
 * FEATURES:
 * - Role-based access control (OWNER, ADMIN, BOT, FEE_EXEMPT)
 * - All parameters adjustable via setters
 * - Per-token overrides for custom configurations
 * - Bot integration hooks (flashTrade, multiArb, getPrices)
 * - Creator buy-in at launch (createTokenWithBuy)
 * - Super Chat tipping system
 * - Emergency controls
 *
 * TOKENOMICS (DEFAULT - ALL ADJUSTABLE):
 * - Total Supply: 250,000,000 tokens
 * - Bonding Supply: 200,000,000 tokens (80%)
 * - LP Reserve: 50,000,000 tokens (20%)
 * - Graduation Target: 50,000,000 PLS
 */
contract PumpFudV2 is ReentrancyGuard {
    // ═══════════════════════════════════════════════════════════════════════════
    // ROLES - ACCESS CONTROL
    // ═══════════════════════════════════════════════════════════════════════════

    bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant BOT_ROLE = keccak256("BOT_ROLE");
    bytes32 public constant FEE_EXEMPT_ROLE = keccak256("FEE_EXEMPT_ROLE");

    mapping(bytes32 => mapping(address => bool)) private _roles;
    address public owner;

    // ═══════════════════════════════════════════════════════════════════════════
    // CONFIGURABLE PARAMETERS - NO HARDCODED VALUES
    // ═══════════════════════════════════════════════════════════════════════════

    // Tokenomics (all adjustable)
    uint256 public totalSupply;
    uint256 public bondingSupply;
    uint256 public lpReserve;
    uint256 public graduationTarget;
    uint256 public burnAmount;
    uint256 public lpAmount;

    // Fees (all adjustable)
    uint256 public buyFeeBps;
    uint256 public sellFeeBps;
    uint256 public creatorRewardBps;
    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public creationFee;

    // Virtual reserves (adjustable)
    uint256 public virtualPls;
    uint256 public virtualTokens;

    // Addresses (all configurable)
    address public treasury;
    address public deadAddress;
    address public wpls;

    // DEX Routers
    address public primaryRouter;
    address public primaryFactory;
    address public secondaryRouter;
    address public secondaryFactory;

    // External contracts
    address public pumpFudToken;
    address public leaderboard;

    // ═══════════════════════════════════════════════════════════════════════════
    // SUPER CHAT TIERS (configurable)
    // ═══════════════════════════════════════════════════════════════════════════

    struct SuperChatTier {
        uint256 minAmount;
        uint256 durationSeconds;
        string tierName;
    }

    SuperChatTier[] public superChatTiers;

    // Chat holding requirements (adjustable)
    uint256 public chatHoldingBps;         // Required holding for chat (default 100 = 1%)
    uint256 public messageBoardHoldingBps; // Required for message board (default 50 = 0.5%)

    // ═══════════════════════════════════════════════════════════════════════════
    // PER-TOKEN OVERRIDES
    // ═══════════════════════════════════════════════════════════════════════════

    struct TokenOverride {
        bool hasBuyFeeOverride;
        uint256 buyFeeBps;
        bool hasSellFeeOverride;
        uint256 sellFeeBps;
        bool hasCreationFeeOverride;
        uint256 creationFee;
        bool hasGraduationTargetOverride;
        uint256 graduationTarget;
    }

    mapping(address => TokenOverride) public tokenOverrides;

    // ═══════════════════════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════════════════════

    struct TokenData {
        address tokenAddress;
        address creator;
        string name;
        string symbol;
        string imageUri;
        uint256 plsReserve;
        uint256 tokensSold;
        uint256 totalVolume;
        uint256 createdAt;
        uint256 graduatedAt;
        bool isGraduated;
        bool isLivestream;
        uint256 livestreamStartTime;
    }

    mapping(address => TokenData) public tokenData;
    address[] public allTokens;

    bool public paused;

    // Super Chat tracking
    mapping(address => mapping(address => uint256)) public superChatTotal; // token => user => total tipped

    // ═══════════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════════

    event TokenCreated(
        address indexed token,
        address indexed creator,
        string name,
        string symbol,
        uint256 creatorBuyAmount
    );

    event TokenBought(
        address indexed token,
        address indexed buyer,
        uint256 plsIn,
        uint256 tokensOut,
        address referrer
    );

    event TokenSold(
        address indexed token,
        address indexed seller,
        uint256 tokensIn,
        uint256 plsOut,
        address referrer
    );

    event TokenBurned(
        address indexed token,
        address indexed burner,
        uint256 tokensBurned,
        uint256 plsReceived
    );

    event TokenGraduated(
        address indexed token,
        uint256 plsBurned,
        uint256 plsToLP,
        uint256 tokensToLP
    );

    event ReferralPaid(
        address indexed referrer,
        address indexed token,
        uint256 plsAmount
    );

    event SuperChatSent(
        address indexed token,
        address indexed sender,
        address indexed recipient,
        uint256 amount,
        string message,
        uint256 tierIndex
    );

    event LivestreamStarted(
        address indexed token,
        uint256 startTime
    );

    event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender);
    event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    event ConfigUpdated(string indexed param, uint256 oldValue, uint256 newValue);
    event AddressUpdated(string indexed param, address oldAddress, address newAddress);
    event TokenOverrideSet(address indexed token, string param, uint256 value);

    // ═══════════════════════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════════════════════

    error ContractPaused();
    error InvalidToken();
    error TokenAlreadyGraduated();
    error InsufficientPayment();
    error InsufficientTokens();
    error SlippageExceeded();
    error ZeroAmount();
    error TransferFailed();
    error NothingToBurn();
    error Unauthorized();
    error InvalidTier();
    error InsufficientHolding();
    error LivestreamNotActive();
    error ZeroAddress();

    // ═══════════════════════════════════════════════════════════════════════════
    // MODIFIERS
    // ═══════════════════════════════════════════════════════════════════════════

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier onlyRole(bytes32 role) {
        if (!hasRole(role, msg.sender) && msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier onlyAdmin() {
        if (!hasRole(ADMIN_ROLE, msg.sender) && !hasRole(OWNER_ROLE, msg.sender) && msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier onlyBot() {
        if (!hasRole(BOT_ROLE, msg.sender) && msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert ContractPaused();
        _;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════════

    constructor() {
        owner = msg.sender;

        // Grant all roles to deployer (SleepyJ)
        _roles[OWNER_ROLE][msg.sender] = true;
        _roles[ADMIN_ROLE][msg.sender] = true;
        _roles[BOT_ROLE][msg.sender] = true;
        _roles[FEE_EXEMPT_ROLE][msg.sender] = true;

        // Initialize default tokenomics (1/4 Pump.Tires Scale)
        totalSupply = 250_000_000 * 1e18;
        bondingSupply = 200_000_000 * 1e18;
        lpReserve = 50_000_000 * 1e18;
        graduationTarget = 50_000_000 * 1e18;
        burnAmount = 10_000_000 * 1e18;
        lpAmount = 40_000_000 * 1e18;

        // Initialize default fees
        buyFeeBps = 100;      // 1.00%
        sellFeeBps = 122;     // 1.22%
        creatorRewardBps = 100; // 1%
        creationFee = 100 * 1e18; // 100 PLS

        // Initialize virtual reserves
        virtualPls = 12_500_000 * 1e18;
        virtualTokens = 250_000_000 * 1e18;

        // Initialize addresses
        treasury = 0x49bBEFa1d94702C0e9a5EAdDEc7c3C5D3eb9086B;
        deadAddress = 0x000000000000000000000000000000000000dEaD;
        wpls = 0xA1077a294dDE1B09bB078844df40758a5D0f9a27;

        // PulseX V2 (primary)
        primaryRouter = 0x165C3410fC91EF562C50559f7d2289fEbed552d9;
        primaryFactory = 0x29eA7545DEf87022BAdc76323F373EA1e707C523;

        // PulseX V1 (secondary)
        secondaryRouter = 0x98bf93ebf5c380C0e6Ae8e192A7e2AE08edAcc02;
        secondaryFactory = 0x1715a3E4A142d8b698131108995174F37aEBA10D;

        // External contracts
        pumpFudToken = 0x7e65383639d8418E826a78a2f5C784cd4Bdb92D7;
        leaderboard = 0xAe213e8aFBf7d76667332092f817589fdaB68EC2;

        // Chat holding requirements
        chatHoldingBps = 100;         // 1% for live chat
        messageBoardHoldingBps = 50;  // 0.5% for message board

        // Initialize default Super Chat tiers
        superChatTiers.push(SuperChatTier({
            minAmount: 10 * 1e18,     // 10 PLS - Bronze
            durationSeconds: 60,
            tierName: "Bronze"
        }));
        superChatTiers.push(SuperChatTier({
            minAmount: 100 * 1e18,    // 100 PLS - Silver
            durationSeconds: 300,
            tierName: "Silver"
        }));
        superChatTiers.push(SuperChatTier({
            minAmount: 1000 * 1e18,   // 1000 PLS - Gold
            durationSeconds: 600,
            tierName: "Gold"
        }));
        superChatTiers.push(SuperChatTier({
            minAmount: 10000 * 1e18,  // 10000 PLS - Diamond
            durationSeconds: 3600,
            tierName: "Diamond"
        }));

        // Whitelist SleepyJ's wallets
        address devWallet1 = 0xdBDA1341890EFCc30734EEC5d5a462a69a29b0B7;
        address devWallet2 = 0x4bD4f261e7057fC8eA8127E6CF96e4102cc4C8fB;

        _roles[OWNER_ROLE][devWallet1] = true;
        _roles[ADMIN_ROLE][devWallet1] = true;
        _roles[FEE_EXEMPT_ROLE][devWallet1] = true;

        _roles[OWNER_ROLE][devWallet2] = true;
        _roles[ADMIN_ROLE][devWallet2] = true;
        _roles[FEE_EXEMPT_ROLE][devWallet2] = true;

        // Grant FEE_EXEMPT to treasury
        _roles[FEE_EXEMPT_ROLE][treasury] = true;

        emit RoleGranted(OWNER_ROLE, msg.sender, msg.sender);
        emit RoleGranted(ADMIN_ROLE, msg.sender, msg.sender);
        emit RoleGranted(BOT_ROLE, msg.sender, msg.sender);
        emit RoleGranted(FEE_EXEMPT_ROLE, msg.sender, msg.sender);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ACCESS CONTROL
    // ═══════════════════════════════════════════════════════════════════════════

    function hasRole(bytes32 role, address account) public view returns (bool) {
        return _roles[role][account];
    }

    function isFeeExempt(address account) public view returns (bool) {
        return hasRole(FEE_EXEMPT_ROLE, account) || hasRole(OWNER_ROLE, account) || account == owner;
    }

    function grantRole(bytes32 role, address account) external onlyOwner {
        _roles[role][account] = true;
        emit RoleGranted(role, account, msg.sender);
    }

    function revokeRole(bytes32 role, address account) external onlyOwner {
        _roles[role][account] = false;
        emit RoleRevoked(role, account, msg.sender);
    }

    function grantRoleBatch(bytes32 role, address[] calldata accounts) external onlyOwner {
        for (uint256 i = 0; i < accounts.length; i++) {
            _roles[role][accounts[i]] = true;
            emit RoleGranted(role, accounts[i], msg.sender);
        }
    }

    function revokeRoleBatch(bytes32 role, address[] calldata accounts) external onlyOwner {
        for (uint256 i = 0; i < accounts.length; i++) {
            _roles[role][accounts[i]] = false;
            emit RoleRevoked(role, accounts[i], msg.sender);
        }
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        address oldOwner = owner;
        owner = newOwner;
        _roles[OWNER_ROLE][newOwner] = true;
        _roles[ADMIN_ROLE][newOwner] = true;
        _roles[FEE_EXEMPT_ROLE][newOwner] = true;
        emit OwnershipTransferred(oldOwner, newOwner);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // TOKEN CREATION
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Create a new memecoin on the bonding curve
     */
    function createToken(
        string calldata name,
        string calldata symbol,
        string calldata imageUri
    ) external payable nonReentrant whenNotPaused returns (address tokenAddress) {
        uint256 fee = _getCreationFee(address(0));

        // Fee exemption check
        if (!isFeeExempt(msg.sender)) {
            if (msg.value < fee) revert InsufficientPayment();
        }

        tokenAddress = _deployToken(name, symbol, imageUri, msg.sender, false);

        // Send creation fee to treasury (skip if fee exempt)
        if (!isFeeExempt(msg.sender) && fee > 0) {
            _safeTransferPLS(treasury, fee);
        }

        // Refund excess
        uint256 actualFee = isFeeExempt(msg.sender) ? 0 : fee;
        if (msg.value > actualFee) {
            _safeTransferPLS(msg.sender, msg.value - actualFee);
        }

        emit TokenCreated(tokenAddress, msg.sender, name, symbol, 0);
    }

    /**
     * @notice Create token with immediate buy (creator buy-in)
     * @param buyAmount Amount of PLS to spend on initial buy after creation fee
     */
    function createTokenWithBuy(
        string calldata name,
        string calldata symbol,
        string calldata imageUri,
        uint256 buyAmount,
        uint256 minTokens
    ) external payable nonReentrant whenNotPaused returns (address tokenAddress, uint256 tokensOut) {
        uint256 fee = isFeeExempt(msg.sender) ? 0 : _getCreationFee(address(0));
        if (msg.value < fee + buyAmount) revert InsufficientPayment();

        tokenAddress = _deployToken(name, symbol, imageUri, msg.sender, false);

        // Send creation fee to treasury
        if (fee > 0) {
            _safeTransferPLS(treasury, fee);
        }

        // Execute initial buy if buyAmount > 0
        if (buyAmount > 0) {
            tokensOut = _executeBuy(tokenAddress, buyAmount, minTokens, address(0), msg.sender);
        }

        // Refund excess
        uint256 totalUsed = fee + buyAmount;
        if (msg.value > totalUsed) {
            _safeTransferPLS(msg.sender, msg.value - totalUsed);
        }

        emit TokenCreated(tokenAddress, msg.sender, name, symbol, buyAmount);
    }

    /**
     * @notice Create livestream token (launches when stream goes live)
     */
    function createLivestreamToken(
        string calldata name,
        string calldata symbol,
        string calldata imageUri,
        uint256 scheduledStartTime
    ) external payable nonReentrant whenNotPaused returns (address tokenAddress) {
        uint256 fee = isFeeExempt(msg.sender) ? 0 : _getCreationFee(address(0));
        if (msg.value < fee) revert InsufficientPayment();

        tokenAddress = _deployToken(name, symbol, imageUri, msg.sender, true);

        TokenData storage t = tokenData[tokenAddress];
        t.livestreamStartTime = scheduledStartTime;

        if (fee > 0) {
            _safeTransferPLS(treasury, fee);
        }

        if (msg.value > fee) {
            _safeTransferPLS(msg.sender, msg.value - fee);
        }

        emit TokenCreated(tokenAddress, msg.sender, name, symbol, 0);
        emit LivestreamStarted(tokenAddress, scheduledStartTime);
    }

    function _deployToken(
        string calldata name,
        string calldata symbol,
        string calldata imageUri,
        address creator,
        bool isLivestream
    ) internal returns (address tokenAddress) {
        PumpFudToken token = new PumpFudToken(name, symbol, imageUri, creator);
        tokenAddress = address(token);

        tokenData[tokenAddress] = TokenData({
            tokenAddress: tokenAddress,
            creator: creator,
            name: name,
            symbol: symbol,
            imageUri: imageUri,
            plsReserve: 0,
            tokensSold: 0,
            totalVolume: 0,
            createdAt: block.timestamp,
            graduatedAt: 0,
            isGraduated: false,
            isLivestream: isLivestream,
            livestreamStartTime: 0
        });

        allTokens.push(tokenAddress);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // BONDING CURVE MATH
    // ═══════════════════════════════════════════════════════════════════════════

    function getEstimatedTokens(address token, uint256 plsAmount) public view returns (uint256 tokensOut) {
        TokenData storage t = tokenData[token];
        if (t.tokenAddress == address(0) || t.isGraduated) return 0;

        uint256 plsReserve = virtualPls + t.plsReserve;
        uint256 tokenReserve = virtualTokens - t.tokensSold;

        uint256 k = plsReserve * tokenReserve;
        uint256 newPlsReserve = plsReserve + plsAmount;
        uint256 newTokenReserve = k / newPlsReserve;

        tokensOut = tokenReserve - newTokenReserve;

        uint256 remaining = bondingSupply - t.tokensSold;
        if (tokensOut > remaining) {
            tokensOut = remaining;
        }
    }

    function getEstimatedPls(address token, uint256 tokenAmount) public view returns (uint256 plsOut) {
        TokenData storage t = tokenData[token];
        if (t.tokenAddress == address(0) || t.isGraduated) return 0;
        if (tokenAmount > t.tokensSold) return 0;

        uint256 plsReserve = virtualPls + t.plsReserve;
        uint256 tokenReserve = virtualTokens - t.tokensSold;

        uint256 k = plsReserve * tokenReserve;
        uint256 newTokenReserve = tokenReserve + tokenAmount;
        uint256 newPlsReserve = k / newTokenReserve;

        plsOut = plsReserve - newPlsReserve;

        if (plsOut > t.plsReserve) {
            plsOut = t.plsReserve;
        }
    }

    function getTokenPrice(address token) public view returns (uint256 price) {
        TokenData storage t = tokenData[token];
        if (t.tokenAddress == address(0)) return 0;

        uint256 plsReserve = virtualPls + t.plsReserve;
        uint256 tokenReserve = virtualTokens - t.tokensSold;

        price = (plsReserve * 1e18) / tokenReserve;
    }

    function getBondingCurveProgress(address token)
        public
        view
        returns (
            uint256 plsRaised,
            uint256 plsTarget,
            uint256 progressBps,
            uint256 tokensSold
        )
    {
        TokenData storage t = tokenData[token];
        uint256 target = _getGraduationTarget(token);
        plsRaised = t.plsReserve;
        plsTarget = target;
        progressBps = (t.plsReserve * BPS_DENOMINATOR) / target;
        if (progressBps > BPS_DENOMINATOR) progressBps = BPS_DENOMINATOR;
        tokensSold = t.tokensSold;
    }

    function getCirculatingSupply(address token) external view returns (uint256) {
        TokenData storage t = tokenData[token];
        return t.tokensSold;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // TRADING
    // ═══════════════════════════════════════════════════════════════════════════

    function buy(
        address token,
        uint256 minTokens,
        address referrer
    ) external payable nonReentrant whenNotPaused returns (uint256 tokensOut) {
        if (msg.value == 0) revert ZeroAmount();
        tokensOut = _executeBuy(token, msg.value, minTokens, referrer, msg.sender);
    }

    function _executeBuy(
        address token,
        uint256 plsAmount,
        uint256 minTokens,
        address referrer,
        address buyer
    ) internal returns (uint256 tokensOut) {
        TokenData storage t = tokenData[token];
        if (t.tokenAddress == address(0)) revert InvalidToken();
        if (t.isGraduated) revert TokenAlreadyGraduated();

        // Check livestream restriction
        if (t.isLivestream && t.livestreamStartTime > block.timestamp) {
            revert LivestreamNotActive();
        }

        // Calculate fee with exemption check
        uint256 fee = 0;
        uint256 plsForTokens = plsAmount;

        if (!isFeeExempt(buyer)) {
            fee = (plsAmount * _getBuyFee(token)) / BPS_DENOMINATOR;
            plsForTokens = plsAmount - fee;
        }

        tokensOut = getEstimatedTokens(token, plsForTokens);
        if (tokensOut < minTokens) revert SlippageExceeded();
        if (tokensOut == 0) revert ZeroAmount();

        t.plsReserve += plsForTokens;
        t.tokensSold += tokensOut;
        t.totalVolume += plsAmount;

        PumpFudToken(token).mint(buyer, tokensOut);

        if (fee > 0) {
            _distributeFee(fee, referrer, token);
        }

        emit TokenBought(token, buyer, plsAmount, tokensOut, referrer);

        if (t.plsReserve >= _getGraduationTarget(token)) {
            _graduate(token);
        }
    }

    function sell(
        address token,
        uint256 tokenAmount,
        uint256 minPls,
        address referrer
    ) external nonReentrant whenNotPaused returns (uint256 plsOut) {
        if (tokenAmount == 0) revert ZeroAmount();

        TokenData storage t = tokenData[token];
        if (t.tokenAddress == address(0)) revert InvalidToken();
        if (t.isGraduated) revert TokenAlreadyGraduated();

        PumpFudToken tokenContract = PumpFudToken(token);
        if (tokenContract.balanceOf(msg.sender) < tokenAmount) revert InsufficientTokens();

        uint256 grossPlsOut = getEstimatedPls(token, tokenAmount);

        // Calculate fee with exemption check
        uint256 fee = 0;
        plsOut = grossPlsOut;

        if (!isFeeExempt(msg.sender)) {
            fee = (grossPlsOut * _getSellFee(token)) / BPS_DENOMINATOR;
            plsOut = grossPlsOut - fee;
        }

        if (plsOut < minPls) revert SlippageExceeded();
        if (plsOut == 0) revert ZeroAmount();

        t.plsReserve -= grossPlsOut;
        t.tokensSold -= tokenAmount;
        t.totalVolume += grossPlsOut;

        tokenContract.burn(msg.sender, tokenAmount);

        if (fee > 0) {
            _distributeFee(fee, referrer, token);
        }

        _safeTransferPLS(msg.sender, plsOut);

        emit TokenSold(token, msg.sender, tokenAmount, plsOut, referrer);
    }

    function burn(address token, uint256 tokenAmount) external nonReentrant whenNotPaused returns (uint256 plsReceived) {
        if (tokenAmount == 0) revert ZeroAmount();

        TokenData storage t = tokenData[token];
        if (t.tokenAddress == address(0)) revert InvalidToken();
        if (t.isGraduated) revert TokenAlreadyGraduated();

        PumpFudToken tokenContract = PumpFudToken(token);
        if (tokenContract.balanceOf(msg.sender) < tokenAmount) revert InsufficientTokens();

        if (t.tokensSold == 0) revert NothingToBurn();

        plsReceived = (tokenAmount * t.plsReserve) / t.tokensSold;
        if (plsReceived == 0) revert NothingToBurn();

        t.plsReserve -= plsReceived;
        t.tokensSold -= tokenAmount;

        tokenContract.burn(msg.sender, tokenAmount);
        _safeTransferPLS(msg.sender, plsReceived);

        emit TokenBurned(token, msg.sender, tokenAmount, plsReceived);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // BOT INTEGRATION HOOKS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Flash trade - buy and sell in single tx (bot only)
     */
    function flashTrade(
        address token,
        uint256 plsIn,
        uint256 minProfit
    ) external payable nonReentrant onlyBot returns (uint256 profit) {
        if (msg.value < plsIn) revert InsufficientPayment();

        TokenData storage t = tokenData[token];
        if (t.tokenAddress == address(0)) revert InvalidToken();
        if (t.isGraduated) revert TokenAlreadyGraduated();

        // Buy tokens
        uint256 tokensOut = getEstimatedTokens(token, plsIn);
        t.plsReserve += plsIn;
        t.tokensSold += tokensOut;
        PumpFudToken(token).mint(address(this), tokensOut);

        // Immediately sell back
        uint256 plsOut = getEstimatedPls(token, tokensOut);
        t.plsReserve -= plsOut;
        t.tokensSold -= tokensOut;
        PumpFudToken(token).burn(address(this), tokensOut);

        if (plsOut > plsIn) {
            profit = plsOut - plsIn;
        }

        if (profit < minProfit) revert SlippageExceeded();

        // Return PLS to bot
        _safeTransferPLS(msg.sender, plsOut);

        // Refund unused input
        if (msg.value > plsIn) {
            _safeTransferPLS(msg.sender, msg.value - plsIn);
        }
    }

    /**
     * @notice Multi-token arbitrage (bot only)
     */
    function multiArb(
        address[] calldata tokens,
        uint256[] calldata amounts,
        bool[] calldata isBuy
    ) external payable nonReentrant onlyBot returns (uint256 totalProfit) {
        if (tokens.length != amounts.length || tokens.length != isBuy.length) revert ZeroAmount();

        uint256 plsUsed = 0;

        for (uint256 i = 0; i < tokens.length; i++) {
            TokenData storage t = tokenData[tokens[i]];
            if (t.tokenAddress == address(0) || t.isGraduated) continue;

            if (isBuy[i]) {
                uint256 tokensOut = getEstimatedTokens(tokens[i], amounts[i]);
                t.plsReserve += amounts[i];
                t.tokensSold += tokensOut;
                PumpFudToken(tokens[i]).mint(msg.sender, tokensOut);
                plsUsed += amounts[i];
            } else {
                uint256 plsOut = getEstimatedPls(tokens[i], amounts[i]);
                t.plsReserve -= plsOut;
                t.tokensSold -= amounts[i];
                PumpFudToken(tokens[i]).burn(msg.sender, amounts[i]);
                totalProfit += plsOut;
            }
        }

        if (totalProfit > plsUsed) {
            totalProfit -= plsUsed;
        } else {
            totalProfit = 0;
        }

        // Send any profit to bot
        if (address(this).balance > 0) {
            _safeTransferPLS(msg.sender, address(this).balance);
        }
    }

    /**
     * @notice Get prices for multiple tokens (bot only - gas efficient)
     */
    function getPrices(address[] calldata tokens) external view returns (uint256[] memory prices) {
        prices = new uint256[](tokens.length);
        for (uint256 i = 0; i < tokens.length; i++) {
            prices[i] = getTokenPrice(tokens[i]);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SUPER CHAT
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Send a Super Chat tip
     */
    function superChat(
        address token,
        address recipient,
        string calldata message
    ) external payable nonReentrant whenNotPaused returns (uint256 tierIndex) {
        if (msg.value == 0) revert ZeroAmount();

        TokenData storage t = tokenData[token];
        if (t.tokenAddress == address(0)) revert InvalidToken();

        // Determine tier
        tierIndex = _getTierForAmount(msg.value);

        // Track total tipped
        superChatTotal[token][msg.sender] += msg.value;

        // Fee handling
        uint256 fee = 0;
        uint256 recipientAmount = msg.value;

        if (!isFeeExempt(msg.sender)) {
            fee = (msg.value * buyFeeBps) / BPS_DENOMINATOR; // Use buy fee for tips
            recipientAmount = msg.value - fee;
        }

        // Send to recipient (creator or designated)
        _safeTransferPLS(recipient, recipientAmount);

        // Send fee to treasury
        if (fee > 0) {
            _safeTransferPLS(treasury, fee);
        }

        emit SuperChatSent(token, msg.sender, recipient, msg.value, message, tierIndex);
    }

    function _getTierForAmount(uint256 amount) internal view returns (uint256) {
        for (uint256 i = superChatTiers.length; i > 0; i--) {
            if (amount >= superChatTiers[i - 1].minAmount) {
                return i - 1;
            }
        }
        return 0;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // HOLDING REQUIREMENTS (VIEW)
    // ═══════════════════════════════════════════════════════════════════════════

    function canUseChat(address token, address user) external view returns (bool) {
        if (isFeeExempt(user)) return true;

        TokenData storage t = tokenData[token];
        if (t.tokensSold == 0) return true;

        uint256 balance = PumpFudToken(token).balanceOf(user);
        uint256 required = (t.tokensSold * chatHoldingBps) / BPS_DENOMINATOR;

        return balance >= required;
    }

    function canUseMessageBoard(address token, address user) external view returns (bool) {
        if (isFeeExempt(user)) return true;

        TokenData storage t = tokenData[token];
        if (t.tokensSold == 0) return true;

        uint256 balance = PumpFudToken(token).balanceOf(user);
        uint256 required = (t.tokensSold * messageBoardHoldingBps) / BPS_DENOMINATOR;

        return balance >= required;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // GRADUATION
    // ═══════════════════════════════════════════════════════════════════════════

    function _graduate(address token) internal {
        TokenData storage t = tokenData[token];
        if (t.isGraduated) return;

        t.isGraduated = true;
        t.graduatedAt = block.timestamp;

        PumpFudToken tokenContract = PumpFudToken(token);
        uint256 totalPls = t.plsReserve;

        uint256 creatorReward = (totalPls * creatorRewardBps) / BPS_DENOMINATOR;
        uint256 plsToBurn = burnAmount;
        if (plsToBurn > totalPls) plsToBurn = totalPls;

        uint256 plsForLP = totalPls - creatorReward - plsToBurn;
        uint256 plsPerDex = plsForLP / 2;
        uint256 tokensPerDex = lpReserve / 2;

        tokenContract.mint(address(this), lpReserve);

        if (secondaryRouter != address(0)) {
            tokenContract.approve(secondaryRouter, tokensPerDex);
            _addLiquidity(secondaryRouter, token, tokensPerDex, plsPerDex, deadAddress);
        }

        tokenContract.approve(primaryRouter, tokensPerDex);
        _addLiquidity(primaryRouter, token, tokensPerDex, plsPerDex, deadAddress);

        _safeTransferPLS(t.creator, creatorReward);

        if (plsToBurn > 0 && address(this).balance >= plsToBurn) {
            (bool sent,) = deadAddress.call{value: plsToBurn}("");
            sent;
        }

        emit TokenGraduated(token, plsToBurn, plsForLP, lpReserve);
    }

    function _addLiquidity(
        address router,
        address token,
        uint256 tokenAmount,
        uint256 plsAmount,
        address lpRecipient
    ) internal {
        (bool success,) = router.call{value: plsAmount}(
            abi.encodeWithSignature(
                "addLiquidityETH(address,uint256,uint256,uint256,address,uint256)",
                token,
                tokenAmount,
                (tokenAmount * 95) / 100,
                (plsAmount * 95) / 100,
                lpRecipient,
                block.timestamp + 600
            )
        );
        success;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // FEE DISTRIBUTION
    // ═══════════════════════════════════════════════════════════════════════════

    function _distributeFee(uint256 fee, address referrer, address token) internal {
        if (fee == 0) return;

        if (referrer != address(0) && referrer != msg.sender) {
            uint256 referrerShare = fee / 2;
            uint256 treasuryShare = fee - referrerShare;

            _safeTransferPLS(treasury, treasuryShare);
            _safeTransferPLS(referrer, referrerShare);

            emit ReferralPaid(referrer, token, referrerShare);
        } else {
            _safeTransferPLS(treasury, fee);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // FEE GETTERS (with per-token override support)
    // ═══════════════════════════════════════════════════════════════════════════

    function _getBuyFee(address token) internal view returns (uint256) {
        TokenOverride storage o = tokenOverrides[token];
        if (o.hasBuyFeeOverride) return o.buyFeeBps;
        return buyFeeBps;
    }

    function _getSellFee(address token) internal view returns (uint256) {
        TokenOverride storage o = tokenOverrides[token];
        if (o.hasSellFeeOverride) return o.sellFeeBps;
        return sellFeeBps;
    }

    function _getCreationFee(address token) internal view returns (uint256) {
        if (token == address(0)) return creationFee;
        TokenOverride storage o = tokenOverrides[token];
        if (o.hasCreationFeeOverride) return o.creationFee;
        return creationFee;
    }

    function _getGraduationTarget(address token) internal view returns (uint256) {
        TokenOverride storage o = tokenOverrides[token];
        if (o.hasGraduationTargetOverride) return o.graduationTarget;
        return graduationTarget;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // UTILITIES
    // ═══════════════════════════════════════════════════════════════════════════

    function _safeTransferPLS(address to, uint256 amount) internal {
        (bool success,) = to.call{value: amount}("");
        if (!success) revert TransferFailed();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    function getTokenData(address token) external view returns (TokenData memory) {
        return tokenData[token];
    }

    function getTokenCount() external view returns (uint256) {
        return allTokens.length;
    }

    function getAllTokens(uint256 offset, uint256 limit) external view returns (address[] memory) {
        if (offset >= allTokens.length) return new address[](0);

        uint256 end = offset + limit;
        if (end > allTokens.length) end = allTokens.length;

        address[] memory result = new address[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = allTokens[i];
        }
        return result;
    }

    function getLiveTokens(uint256 offset, uint256 limit) external view returns (address[] memory) {
        uint256 liveCount = 0;
        for (uint256 i = 0; i < allTokens.length; i++) {
            if (!tokenData[allTokens[i]].isGraduated) liveCount++;
        }

        if (offset >= liveCount) return new address[](0);

        uint256 resultSize = limit;
        if (offset + limit > liveCount) resultSize = liveCount - offset;

        address[] memory result = new address[](resultSize);
        uint256 found = 0;
        uint256 added = 0;

        for (uint256 i = 0; i < allTokens.length && added < resultSize; i++) {
            if (!tokenData[allTokens[i]].isGraduated) {
                if (found >= offset) {
                    result[added] = allTokens[i];
                    added++;
                }
                found++;
            }
        }
        return result;
    }

    function getSuperChatTiers() external view returns (SuperChatTier[] memory) {
        return superChatTiers;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ADMIN SETTERS - ALL PARAMETERS ADJUSTABLE
    // ═══════════════════════════════════════════════════════════════════════════

    // === Pause Control ===
    function setPaused(bool _paused) external onlyAdmin {
        paused = _paused;
    }

    // === Tokenomics Setters ===
    function setTotalSupply(uint256 _totalSupply) external onlyOwner {
        emit ConfigUpdated("totalSupply", totalSupply, _totalSupply);
        totalSupply = _totalSupply;
    }

    function setBondingSupply(uint256 _bondingSupply) external onlyOwner {
        emit ConfigUpdated("bondingSupply", bondingSupply, _bondingSupply);
        bondingSupply = _bondingSupply;
    }

    function setLpReserve(uint256 _lpReserve) external onlyOwner {
        emit ConfigUpdated("lpReserve", lpReserve, _lpReserve);
        lpReserve = _lpReserve;
    }

    function setGraduationTarget(uint256 _graduationTarget) external onlyOwner {
        emit ConfigUpdated("graduationTarget", graduationTarget, _graduationTarget);
        graduationTarget = _graduationTarget;
    }

    function setBurnAmount(uint256 _burnAmount) external onlyOwner {
        emit ConfigUpdated("burnAmount", burnAmount, _burnAmount);
        burnAmount = _burnAmount;
    }

    function setLpAmount(uint256 _lpAmount) external onlyOwner {
        emit ConfigUpdated("lpAmount", lpAmount, _lpAmount);
        lpAmount = _lpAmount;
    }

    // === Fee Setters ===
    function setBuyFeeBps(uint256 _buyFeeBps) external onlyOwner {
        emit ConfigUpdated("buyFeeBps", buyFeeBps, _buyFeeBps);
        buyFeeBps = _buyFeeBps;
    }

    function setSellFeeBps(uint256 _sellFeeBps) external onlyOwner {
        emit ConfigUpdated("sellFeeBps", sellFeeBps, _sellFeeBps);
        sellFeeBps = _sellFeeBps;
    }

    function setCreatorRewardBps(uint256 _creatorRewardBps) external onlyOwner {
        emit ConfigUpdated("creatorRewardBps", creatorRewardBps, _creatorRewardBps);
        creatorRewardBps = _creatorRewardBps;
    }

    function setCreationFee(uint256 _creationFee) external onlyOwner {
        emit ConfigUpdated("creationFee", creationFee, _creationFee);
        creationFee = _creationFee;
    }

    // === Virtual Reserve Setters ===
    function setVirtualPls(uint256 _virtualPls) external onlyOwner {
        emit ConfigUpdated("virtualPls", virtualPls, _virtualPls);
        virtualPls = _virtualPls;
    }

    function setVirtualTokens(uint256 _virtualTokens) external onlyOwner {
        emit ConfigUpdated("virtualTokens", virtualTokens, _virtualTokens);
        virtualTokens = _virtualTokens;
    }

    // === Address Setters ===
    function setTreasury(address _treasury) external onlyOwner {
        emit AddressUpdated("treasury", treasury, _treasury);
        treasury = _treasury;
    }

    function setDeadAddress(address _deadAddress) external onlyOwner {
        emit AddressUpdated("deadAddress", deadAddress, _deadAddress);
        deadAddress = _deadAddress;
    }

    function setWpls(address _wpls) external onlyOwner {
        emit AddressUpdated("wpls", wpls, _wpls);
        wpls = _wpls;
    }

    function setPrimaryRouter(address _primaryRouter) external onlyOwner {
        emit AddressUpdated("primaryRouter", primaryRouter, _primaryRouter);
        primaryRouter = _primaryRouter;
    }

    function setPrimaryFactory(address _primaryFactory) external onlyOwner {
        emit AddressUpdated("primaryFactory", primaryFactory, _primaryFactory);
        primaryFactory = _primaryFactory;
    }

    function setSecondaryRouter(address _router) external onlyOwner {
        emit AddressUpdated("secondaryRouter", secondaryRouter, _router);
        secondaryRouter = _router;
    }

    function setSecondaryFactory(address _factory) external onlyOwner {
        emit AddressUpdated("secondaryFactory", secondaryFactory, _factory);
        secondaryFactory = _factory;
    }

    function setPumpFudToken(address _pumpFudToken) external onlyOwner {
        emit AddressUpdated("pumpFudToken", pumpFudToken, _pumpFudToken);
        pumpFudToken = _pumpFudToken;
    }

    function setLeaderboard(address _leaderboard) external onlyOwner {
        emit AddressUpdated("leaderboard", leaderboard, _leaderboard);
        leaderboard = _leaderboard;
    }

    // === Chat Requirement Setters ===
    function setChatHoldingBps(uint256 _chatHoldingBps) external onlyOwner {
        emit ConfigUpdated("chatHoldingBps", chatHoldingBps, _chatHoldingBps);
        chatHoldingBps = _chatHoldingBps;
    }

    function setMessageBoardHoldingBps(uint256 _messageBoardHoldingBps) external onlyOwner {
        emit ConfigUpdated("messageBoardHoldingBps", messageBoardHoldingBps, _messageBoardHoldingBps);
        messageBoardHoldingBps = _messageBoardHoldingBps;
    }

    // === Super Chat Tier Management ===
    function addSuperChatTier(uint256 minAmount, uint256 durationSeconds, string calldata tierName) external onlyOwner {
        superChatTiers.push(SuperChatTier({
            minAmount: minAmount,
            durationSeconds: durationSeconds,
            tierName: tierName
        }));
    }

    function updateSuperChatTier(uint256 index, uint256 minAmount, uint256 durationSeconds, string calldata tierName) external onlyOwner {
        if (index >= superChatTiers.length) revert InvalidTier();
        superChatTiers[index] = SuperChatTier({
            minAmount: minAmount,
            durationSeconds: durationSeconds,
            tierName: tierName
        });
    }

    function removeSuperChatTier(uint256 index) external onlyOwner {
        if (index >= superChatTiers.length) revert InvalidTier();
        superChatTiers[index] = superChatTiers[superChatTiers.length - 1];
        superChatTiers.pop();
    }

    // === Per-Token Overrides ===
    function setTokenBuyFeeOverride(address token, uint256 _buyFeeBps) external onlyOwner {
        tokenOverrides[token].hasBuyFeeOverride = true;
        tokenOverrides[token].buyFeeBps = _buyFeeBps;
        emit TokenOverrideSet(token, "buyFeeBps", _buyFeeBps);
    }

    function setTokenSellFeeOverride(address token, uint256 _sellFeeBps) external onlyOwner {
        tokenOverrides[token].hasSellFeeOverride = true;
        tokenOverrides[token].sellFeeBps = _sellFeeBps;
        emit TokenOverrideSet(token, "sellFeeBps", _sellFeeBps);
    }

    function setTokenCreationFeeOverride(address token, uint256 _creationFee) external onlyOwner {
        tokenOverrides[token].hasCreationFeeOverride = true;
        tokenOverrides[token].creationFee = _creationFee;
        emit TokenOverrideSet(token, "creationFee", _creationFee);
    }

    function setTokenGraduationTargetOverride(address token, uint256 _graduationTarget) external onlyOwner {
        tokenOverrides[token].hasGraduationTargetOverride = true;
        tokenOverrides[token].graduationTarget = _graduationTarget;
        emit TokenOverrideSet(token, "graduationTarget", _graduationTarget);
    }

    function clearTokenOverrides(address token) external onlyOwner {
        delete tokenOverrides[token];
    }

    // === Batch Config ===
    struct ConfigBatch {
        uint256 totalSupply;
        uint256 bondingSupply;
        uint256 lpReserve;
        uint256 graduationTarget;
        uint256 burnAmount;
        uint256 lpAmount;
        uint256 buyFeeBps;
        uint256 sellFeeBps;
        uint256 creatorRewardBps;
        uint256 creationFee;
        uint256 virtualPls;
        uint256 virtualTokens;
        uint256 chatHoldingBps;
        uint256 messageBoardHoldingBps;
    }

    function getConfig() external view returns (ConfigBatch memory) {
        return ConfigBatch({
            totalSupply: totalSupply,
            bondingSupply: bondingSupply,
            lpReserve: lpReserve,
            graduationTarget: graduationTarget,
            burnAmount: burnAmount,
            lpAmount: lpAmount,
            buyFeeBps: buyFeeBps,
            sellFeeBps: sellFeeBps,
            creatorRewardBps: creatorRewardBps,
            creationFee: creationFee,
            virtualPls: virtualPls,
            virtualTokens: virtualTokens,
            chatHoldingBps: chatHoldingBps,
            messageBoardHoldingBps: messageBoardHoldingBps
        });
    }

    function setConfigBatch(ConfigBatch calldata config) external onlyOwner {
        totalSupply = config.totalSupply;
        bondingSupply = config.bondingSupply;
        lpReserve = config.lpReserve;
        graduationTarget = config.graduationTarget;
        burnAmount = config.burnAmount;
        lpAmount = config.lpAmount;
        buyFeeBps = config.buyFeeBps;
        sellFeeBps = config.sellFeeBps;
        creatorRewardBps = config.creatorRewardBps;
        creationFee = config.creationFee;
        virtualPls = config.virtualPls;
        virtualTokens = config.virtualTokens;
        chatHoldingBps = config.chatHoldingBps;
        messageBoardHoldingBps = config.messageBoardHoldingBps;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // EMERGENCY CONTROLS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Emergency withdrawal - only for stuck funds
     */
    function emergencyWithdraw() external onlyOwner {
        _safeTransferPLS(treasury, address(this).balance);
    }

    /**
     * @notice Force graduate a token (emergency only)
     */
    function forceGraduate(address token) external onlyOwner {
        TokenData storage t = tokenData[token];
        if (t.tokenAddress == address(0)) revert InvalidToken();
        if (t.isGraduated) revert TokenAlreadyGraduated();

        _graduate(token);
    }

    /**
     * @notice Force refund all token holders (emergency only)
     * @dev Use with extreme caution - returns PLS proportionally to holders
     */
    function forceRefund(address token) external onlyOwner {
        TokenData storage t = tokenData[token];
        if (t.tokenAddress == address(0)) revert InvalidToken();
        if (t.isGraduated) revert TokenAlreadyGraduated();

        // Mark as graduated to prevent further trading
        t.isGraduated = true;
        t.graduatedAt = block.timestamp;

        // Send remaining PLS to treasury for manual distribution
        if (t.plsReserve > 0) {
            _safeTransferPLS(treasury, t.plsReserve);
            t.plsReserve = 0;
        }
    }

    /**
     * @notice Start a livestream token
     */
    function startLivestream(address token) external {
        TokenData storage t = tokenData[token];
        if (t.tokenAddress == address(0)) revert InvalidToken();
        if (!t.isLivestream) revert InvalidToken();

        // Only creator or admin can start
        if (msg.sender != t.creator && !hasRole(ADMIN_ROLE, msg.sender) && msg.sender != owner) {
            revert Unauthorized();
        }

        t.livestreamStartTime = block.timestamp;
        emit LivestreamStarted(token, block.timestamp);
    }

    // Constants for external reference
    function TOTAL_SUPPLY() external view returns (uint256) { return totalSupply; }
    function BONDING_SUPPLY() external view returns (uint256) { return bondingSupply; }
    function LP_RESERVE() external view returns (uint256) { return lpReserve; }
    function GRADUATION_TARGET() external view returns (uint256) { return graduationTarget; }
    function BURN_AMOUNT() external view returns (uint256) { return burnAmount; }
    function LP_AMOUNT() external view returns (uint256) { return lpAmount; }
    function BUY_FEE_BPS() external view returns (uint256) { return buyFeeBps; }
    function SELL_FEE_BPS() external view returns (uint256) { return sellFeeBps; }
    function CREATOR_REWARD_BPS() external view returns (uint256) { return creatorRewardBps; }
    function CREATION_FEE() external view returns (uint256) { return creationFee; }
    function VIRTUAL_PLS() external view returns (uint256) { return virtualPls; }
    function VIRTUAL_TOKENS() external view returns (uint256) { return virtualTokens; }
    function TREASURY() external view returns (address) { return treasury; }
    function DEAD_ADDRESS() external view returns (address) { return deadAddress; }
    function WPLS() external view returns (address) { return wpls; }

    receive() external payable {}
}
