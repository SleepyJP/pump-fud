// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "lib/openzeppelin-contracts/contracts/access/Ownable.sol";
import {PumpFudToken} from "./PumpFudToken.sol";
import {IPulseXRouter, IPulseXFactory} from "./interfaces/IPulseXRouter.sol";

/**
 * @title PumpFud
 * @notice Pump.fun style bonding curve launchpad for PulseChain
 * @dev Based on pump.tires mechanics - constant product curve with virtual reserves
 *
 * PARAMETERS (1/4 of pump.tires):
 * - Graduation threshold: 50,000,000 PLS
 * - Max token supply: 250,000,000 tokens
 * - 20% (1/5) burns to dead address on graduation
 * - 10% to PulseX V2 LP (LP tokens to lpRecipient - treasury earns 0.22% swap fees)
 * - 0% to Paisley Swap DEX (adjustable via setPaisleyLpBps)
 * - 5% success reward to Treasury
 *
 * BONDING CURVE: x * y = k (constant product)
 * - Virtual PLS reserves: 15,000,000 PLS
 * - Virtual token reserves: 250,000,000 tokens
 */
contract PumpFud is ReentrancyGuard, Ownable {
    // ═══════════════════════════════════════════════════════════════════════════
    // ADJUSTABLE ADDRESSES - All can be updated post-deployment
    // ═══════════════════════════════════════════════════════════════════════════

    address public treasury;
    address public lpRecipient; // Where LP tokens go (treasury=earn fees, deadAddress=burn)
    address public deadAddress = 0x000000000000000000000000000000000000dEaD;
    address public wpls = 0xA1077a294dDE1B09bB078844df40758a5D0f9a27;
    address public pulseXRouter = 0x165C3410fC91EF562C50559f7d2289fEbed552d9;
    address public pulseXFactory = 0x29eA7545DEf87022BAdc76323F373EA1e707C523;

    // Paisley Swap DEX (set after deployment)
    address public paisleyRouter = 0x92AF1b541Ba97C1E0c3B4E4902Af170944875d97;
    address public paisleyFactory;

    // Test tokens with lower graduation threshold
    mapping(address => bool) public isTestToken;
    uint256 public testGraduationThreshold = 10000 ether;

    uint256 public constant PRECISION = 1e18;

    // ═══════════════════════════════════════════════════════════════════════════
    // ADJUSTABLE CURVE PARAMETERS - Can tune post-deployment
    // ═══════════════════════════════════════════════════════════════════════════
    uint256 public maxSupply = 250_000_000 * 1e18;              // 250M tokens
    uint256 public graduationThreshold = 50_000_000 * 1e18;    // 50M PLS
    uint256 public virtualPlsReserves = 15_000_000 * 1e18;    // 15M PLS virtual
    uint256 public virtualTokenReserves = 250_000_000 * 1e18; // 250M tokens virtual

    // ═══════════════════════════════════════════════════════════════════════════
    // ADJUSTABLE GRADUATION ALLOCATION - Tune fees post-deployment
    // ═══════════════════════════════════════════════════════════════════════════
    uint256 public burnBps = 2000;              // 20% (1/5) burn to dead address
    uint256 public pulseXLpBps = 1000;          // 10% burns to PulseX V2 LP
    uint256 public paisleyLpBps = 1000;         // 10% to Paisley Swap DEX
    uint256 public successRewardBps = 1000;     // 10% success reward to treasury
    uint256 public platformFeeBps = 100;        // 1% platform fee on trades
    uint256 public constant BPS_DENOMINATOR = 10000;

    // ═══════════════════════════════════════════════════════════════════════════
    // TYPES
    // ═══════════════════════════════════════════════════════════════════════════

    enum TokenStatus {
        Live,
        Graduated,
        Rugged,
        Delisted
    }

    struct MemeToken {
        uint256 id;
        address tokenAddress;
        string name;
        string symbol;
        string description;
        string imageUri;
        address creator;
        uint256 reserveBalance; // Real PLS in curve
        uint256 tokensSold; // Tokens minted/sold
        uint256 tradingVolume;
        uint256 createdAt;
        uint256 graduatedAt;
        TokenStatus status;
        uint256 holderCount;
        uint256 tradeCount;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════════════════════

    uint256 public tokenCount;
    uint256 public launchFee;
    uint256 public tradingFeeBps = 100; // initialized to 1% (legacy, use buyFeeBps/sellFeeBps)
    uint256 public buyFeeBps = 100;     // 1% buy fee
    uint256 public sellFeeBps = 110;    // 1.10% sell fee
    bool public paused;

    // Fee-free whitelist for designated wallets
    mapping(address => bool) public feeWhitelist;

    mapping(uint256 => MemeToken) public tokens;
    mapping(address => uint256) public tokenToId;
    mapping(address => mapping(address => uint256)) public userHoldings; // token => user => balance
    mapping(address => uint256) public tokenHolderCount;

    // ═══════════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════════

    event TokenLaunched(
        uint256 indexed tokenId,
        address indexed tokenAddress,
        address indexed creator,
        string name,
        string symbol,
        uint256 timestamp
    );

    event TokenBought(
        uint256 indexed tokenId,
        address indexed buyer,
        uint256 plsIn,
        uint256 tokensOut,
        uint256 newPrice,
        uint256 timestamp
    );

    event TokenSold(
        uint256 indexed tokenId,
        address indexed seller,
        uint256 tokensIn,
        uint256 plsOut,
        uint256 newPrice,
        uint256 timestamp
    );

    event TokenGraduated(
        uint256 indexed tokenId,
        address indexed tokenAddress,
        address indexed lpPair,
        uint256 plsLiquidity,
        uint256 tokenLiquidity,
        uint256 lpBurned,
        uint256 tokensBurnedToDead,
        uint256 creatorReward,
        uint256 timestamp
    );

    event FeesCollected(address indexed token, uint256 amount, address indexed treasury);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event TokenDelisted(uint256 indexed tokenId, address indexed tokenAddress, string reason, uint256 timestamp);

    // ═══════════════════════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════════════════════

    error Paused();
    error InvalidToken();
    error TokenNotLive();
    error TokenAlreadyGraduated();
    error InsufficientPayment();
    error InsufficientTokens();
    error SlippageExceeded();
    error ZeroAmount();
    error TransferFailed();

    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════════

    constructor(address _treasury) Ownable(msg.sender) {
        require(_treasury != address(0), "Invalid treasury");
        treasury = _treasury;
        lpRecipient = _treasury; // Default: LP tokens to treasury (earn 0.22% swap fees)
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // LAUNCH
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Launch a new meme token on the bonding curve
     * @param name Token name
     * @param symbol Token symbol
     * @param description Token description
     * @param imageUri Token image URI (IPFS or HTTP)
     */
    function launchToken(string calldata name, string calldata symbol, string calldata description, string calldata imageUri)
        external
        payable
        nonReentrant
        returns (uint256 tokenId, address tokenAddress)
    {
        if (paused) revert Paused();
        if (msg.value < launchFee) revert InsufficientPayment();

        // Collect launch fee
        if (launchFee > 0) {
            (bool sent,) = treasury.call{value: launchFee}("");
            if (!sent) revert TransferFailed();
        }

        // Deploy new token
        PumpFudToken token = new PumpFudToken(name, symbol, imageUri, msg.sender);
        tokenAddress = address(token);

        // Increment and store
        tokenCount++;
        tokenId = tokenCount;

        tokens[tokenId] = MemeToken({
            id: tokenId,
            tokenAddress: tokenAddress,
            name: name,
            symbol: symbol,
            description: description,
            imageUri: imageUri,
            creator: msg.sender,
            reserveBalance: 0,
            tokensSold: 0,
            tradingVolume: 0,
            createdAt: block.timestamp,
            graduatedAt: 0,
            status: TokenStatus.Live,
            holderCount: 0,
            tradeCount: 0
        });

        tokenToId[tokenAddress] = tokenId;

        // Refund excess
        uint256 excess = msg.value - launchFee;
        if (excess > 0) {
            (bool refunded,) = msg.sender.call{value: excess}("");
            if (!refunded) revert TransferFailed();
        }

        emit TokenLaunched(tokenId, tokenAddress, msg.sender, name, symbol, block.timestamp);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // BONDING CURVE MATH - CONSTANT PRODUCT (x * y = k)
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Calculate tokens received for PLS input
     * @dev Uses constant product formula: k = (virtualPls + realPls) * (virtualTokens - tokensSold)
     *      new_k = (virtualPls + realPls + plsIn) * (virtualTokens - tokensSold - tokensOut)
     *      Since k is constant: tokensOut = oldTokenReserve - k / newPlsReserve
     */
    function calculateBuyAmount(uint256 tokenId, uint256 plsIn) public view returns (uint256 tokensOut) {
        MemeToken storage t = tokens[tokenId];
        if (t.status != TokenStatus.Live) return 0;

        // Current virtual reserves
        uint256 plsReserve = virtualPlsReserves + t.reserveBalance;
        uint256 tokenReserve = virtualTokenReserves - t.tokensSold;

        // k = x * y
        uint256 k = plsReserve * tokenReserve;

        // New PLS reserve after buy
        uint256 newPlsReserve = plsReserve + plsIn;

        // New token reserve = k / newPlsReserve
        uint256 newTokenReserve = k / newPlsReserve;

        // Tokens out = old reserve - new reserve
        tokensOut = tokenReserve - newTokenReserve;

        // Cap at remaining supply
        uint256 remaining = maxSupply - t.tokensSold;
        if (tokensOut > remaining) {
            tokensOut = remaining;
        }
    }

    /**
     * @notice Calculate PLS received for token input
     * @dev Inverse of buy calculation
     */
    function calculateSellAmount(uint256 tokenId, uint256 tokensIn) public view returns (uint256 plsOut) {
        MemeToken storage t = tokens[tokenId];
        if (t.status != TokenStatus.Live) return 0;
        if (tokensIn > t.tokensSold) return 0;

        // Current virtual reserves
        uint256 plsReserve = virtualPlsReserves + t.reserveBalance;
        uint256 tokenReserve = virtualTokenReserves - t.tokensSold;

        // k = x * y
        uint256 k = plsReserve * tokenReserve;

        // New token reserve after sell (tokens returned to curve)
        uint256 newTokenReserve = tokenReserve + tokensIn;

        // New PLS reserve = k / newTokenReserve
        uint256 newPlsReserve = k / newTokenReserve;

        // PLS out = old reserve - new reserve
        plsOut = plsReserve - newPlsReserve;

        // Cap at actual reserves
        if (plsOut > t.reserveBalance) {
            plsOut = t.reserveBalance;
        }
    }

    /**
     * @notice Get current token price in PLS (per whole token)
     */
    function getCurrentPrice(uint256 tokenId) public view returns (uint256 price) {
        MemeToken storage t = tokens[tokenId];
        if (t.status != TokenStatus.Live) return 0;

        uint256 plsReserve = virtualPlsReserves + t.reserveBalance;
        uint256 tokenReserve = virtualTokenReserves - t.tokensSold;

        // Price = plsReserve / tokenReserve (normalized to 1 token)
        price = (plsReserve * PRECISION) / tokenReserve;
    }

    /**
     * @notice Get market cap in PLS
     */
    function getMarketCap(uint256 tokenId) public view returns (uint256) {
        MemeToken storage t = tokens[tokenId];
        uint256 price = getCurrentPrice(tokenId);
        return (price * t.tokensSold) / PRECISION;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // TRADING
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Buy tokens from bonding curve
     * @param tokenId Token ID to buy
     * @param minTokensOut Minimum tokens expected (slippage protection)
     */
    function buyTokens(uint256 tokenId, uint256 minTokensOut) external payable nonReentrant returns (uint256 tokensOut) {
        if (paused) revert Paused();
        if (msg.value == 0) revert ZeroAmount();

        MemeToken storage t = tokens[tokenId];
        if (t.tokenAddress == address(0)) revert InvalidToken();
        if (t.status != TokenStatus.Live) revert TokenNotLive();

        // Calculate fee (whitelisted addresses pay no fee)
        uint256 fee = feeWhitelist[msg.sender] ? 0 : (msg.value * buyFeeBps) / BPS_DENOMINATOR;
        uint256 plsForTokens = msg.value - fee;

        // Calculate tokens out
        tokensOut = calculateBuyAmount(tokenId, plsForTokens);
        if (tokensOut < minTokensOut) revert SlippageExceeded();
        if (tokensOut == 0) revert ZeroAmount();

        // Update state
        t.reserveBalance += plsForTokens;
        t.tokensSold += tokensOut;
        t.tradingVolume += msg.value;
        t.tradeCount++;

        // Track holder count
        if (userHoldings[t.tokenAddress][msg.sender] == 0) {
            t.holderCount++;
        }
        userHoldings[t.tokenAddress][msg.sender] += tokensOut;

        // Mint tokens to buyer
        PumpFudToken(t.tokenAddress).mint(msg.sender, tokensOut);

        // Send fee to treasury
        if (fee > 0) {
            (bool sent,) = treasury.call{value: fee}("");
            if (!sent) revert TransferFailed();
            emit FeesCollected(t.tokenAddress, fee, treasury);
        }

        uint256 newPrice = getCurrentPrice(tokenId);
        emit TokenBought(tokenId, msg.sender, msg.value, tokensOut, newPrice, block.timestamp);

        // Check graduation - use testGraduationThreshold if isTestToken, else normal threshold
        uint256 threshold = isTestToken[t.tokenAddress] ? testGraduationThreshold : graduationThreshold;
        if (t.reserveBalance >= threshold) {
            _graduateToken(tokenId);
        }
    }

    /**
     * @notice Sell tokens back to bonding curve
     * @param tokenId Token ID to sell
     * @param tokensIn Amount of tokens to sell
     * @param minPlsOut Minimum PLS expected (slippage protection)
     */
    function sellTokens(uint256 tokenId, uint256 tokensIn, uint256 minPlsOut)
        external
        nonReentrant
        returns (uint256 plsOut)
    {
        if (paused) revert Paused();
        if (tokensIn == 0) revert ZeroAmount();

        MemeToken storage t = tokens[tokenId];
        if (t.tokenAddress == address(0)) revert InvalidToken();
        if (t.status != TokenStatus.Live) revert TokenNotLive();

        // Check user balance
        PumpFudToken token = PumpFudToken(t.tokenAddress);
        if (token.balanceOf(msg.sender) < tokensIn) revert InsufficientTokens();

        // Calculate PLS out before fee
        uint256 grossPlsOut = calculateSellAmount(tokenId, tokensIn);

        // Calculate fee (whitelisted addresses pay no fee)
        uint256 fee = feeWhitelist[msg.sender] ? 0 : (grossPlsOut * sellFeeBps) / BPS_DENOMINATOR;
        plsOut = grossPlsOut - fee;

        if (plsOut < minPlsOut) revert SlippageExceeded();
        if (plsOut == 0) revert ZeroAmount();

        // Update state
        t.reserveBalance -= grossPlsOut;
        t.tokensSold -= tokensIn;
        t.tradingVolume += grossPlsOut;
        t.tradeCount++;

        // Track holder count
        userHoldings[t.tokenAddress][msg.sender] -= tokensIn;
        if (userHoldings[t.tokenAddress][msg.sender] == 0) {
            t.holderCount--;
        }

        // Burn tokens
        token.burn(msg.sender, tokensIn);

        // Send fee to treasury
        if (fee > 0) {
            (bool feesSent,) = treasury.call{value: fee}("");
            if (!feesSent) revert TransferFailed();
            emit FeesCollected(t.tokenAddress, fee, treasury);
        }

        // Send PLS to seller
        (bool sent,) = msg.sender.call{value: plsOut}("");
        if (!sent) revert TransferFailed();

        uint256 newPrice = getCurrentPrice(tokenId);
        emit TokenSold(tokenId, msg.sender, tokensIn, plsOut, newPrice, block.timestamp);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // GRADUATION - MIGRATE TO PULSEX V2
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Graduate token to PulseX V2 when threshold reached
     * @dev Called automatically when reserveBalance >= graduationThreshold
     *
     * GRADUATION ALLOCATION:
     * - 20% (1/5) of tokens burn to dead address
     * - 10% to PulseX V2 LP (LP tokens to lpRecipient - treasury earns 0.22% swap fees)
     * - 0% to Paisley Swap DEX (adjustable)
     * - 5% of PLS to treasury as success reward
     * - Remaining tokens stay with holders
     */
    function _graduateToken(uint256 tokenId) internal {
        MemeToken storage t = tokens[tokenId];
        if (t.status != TokenStatus.Live) revert TokenAlreadyGraduated();

        // Mark as graduated
        t.status = TokenStatus.Graduated;
        t.graduatedAt = block.timestamp;

        PumpFudToken token = PumpFudToken(t.tokenAddress);

        // Calculate amounts based on graduation allocation
        uint256 totalPls = t.reserveBalance;
        uint256 totalTokensSold = t.tokensSold;

        // 1. Calculate burn amount (20% of graduation tokens)
        uint256 tokensToBurnDead = (totalTokensSold * burnBps) / BPS_DENOMINATOR;

        // 2. Calculate PulseX V2 LP allocation
        uint256 tokensForPulseXLP = (totalTokensSold * pulseXLpBps) / BPS_DENOMINATOR;

        // 3. Calculate Paisley LP allocation
        uint256 tokensForPaisleyLP = (totalTokensSold * paisleyLpBps) / BPS_DENOMINATOR;

        // 4. Calculate success reward (5% of PLS to treasury)
        uint256 successReward = (totalPls * successRewardBps) / BPS_DENOMINATOR;

        // 5. PLS for liquidity (remaining after success reward)
        uint256 plsForLiquidity = totalPls - successReward;

        // Split PLS proportionally between PulseX and Paisley
        uint256 totalLpBps = pulseXLpBps + paisleyLpBps;
        uint256 plsForPulseX = totalLpBps > 0 ? (plsForLiquidity * pulseXLpBps) / totalLpBps : plsForLiquidity;
        uint256 plsForPaisley = plsForLiquidity - plsForPulseX;

        // Mint tokens for burn to dead address
        token.mint(deadAddress, tokensToBurnDead);

        // Total tokens for LP
        uint256 totalTokensForLP = tokensForPulseXLP + tokensForPaisleyLP;
        token.mint(address(this), totalTokensForLP);

        uint256 amountToken;
        uint256 amountPLS;
        uint256 liquidity;
        address lpPair;

        // Add liquidity to PulseX V2 (if enabled)
        if (pulseXLpBps > 0 && pulseXRouter != address(0)) {
            token.approve(pulseXRouter, tokensForPulseXLP);
            IPulseXRouter router = IPulseXRouter(pulseXRouter);
            (amountToken, amountPLS, liquidity) = router.addLiquidityETH{value: plsForPulseX}(
                t.tokenAddress,
                tokensForPulseXLP,
                (tokensForPulseXLP * 95) / 100,
                (plsForPulseX * 95) / 100,
                lpRecipient, // LP tokens to treasury (earn 0.22% swap fees) or burn
                block.timestamp + 600
            );
            lpPair = IPulseXFactory(pulseXFactory).getPair(t.tokenAddress, wpls);
        }

        // Add liquidity to Paisley Swap (if enabled)
        if (paisleyLpBps > 0 && paisleyRouter != address(0)) {
            token.approve(paisleyRouter, tokensForPaisleyLP);
            IPulseXRouter paisleyRouterContract = IPulseXRouter(paisleyRouter);
            paisleyRouterContract.addLiquidityETH{value: plsForPaisley}(
                t.tokenAddress,
                tokensForPaisleyLP,
                (tokensForPaisleyLP * 95) / 100,
                (plsForPaisley * 95) / 100,
                lpRecipient, // LP tokens to treasury (earn 0.22% swap fees) or burn
                block.timestamp + 600
            );
        }

        // Send success reward to treasury
        if (successReward > 0) {
            (bool sent,) = treasury.call{value: successReward}("");
            if (!sent) revert TransferFailed();
        }

        emit TokenGraduated(
            tokenId,
            t.tokenAddress,
            lpPair,
            amountPLS,
            amountToken,
            liquidity,
            tokensToBurnDead,
            successReward,
            block.timestamp
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    function getToken(uint256 tokenId) external view returns (MemeToken memory) {
        return tokens[tokenId];
    }

    function getTokenByAddress(address tokenAddress) external view returns (MemeToken memory) {
        return tokens[tokenToId[tokenAddress]];
    }

    function getTokenStats(uint256 tokenId)
        external
        view
        returns (
            uint256 price,
            uint256 marketCap,
            uint256 reserveBalance,
            uint256 tokensSold,
            uint256 progress,
            TokenStatus status
        )
    {
        MemeToken storage t = tokens[tokenId];
        price = getCurrentPrice(tokenId);
        marketCap = getMarketCap(tokenId);
        reserveBalance = t.reserveBalance;
        tokensSold = t.tokensSold;
        progress = (t.reserveBalance * 10000) / graduationThreshold; // BPS to graduation
        status = t.status;
    }

    function getAllTokens(uint256 offset, uint256 limit) external view returns (MemeToken[] memory result) {
        if (offset >= tokenCount) return new MemeToken[](0);

        uint256 end = offset + limit;
        if (end > tokenCount) end = tokenCount;

        result = new MemeToken[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = tokens[i + 1];
        }
    }

    function getLiveTokens(uint256 offset, uint256 limit) external view returns (MemeToken[] memory result) {
        // Count live tokens first
        uint256 liveCount = 0;
        for (uint256 i = 1; i <= tokenCount; i++) {
            if (tokens[i].status == TokenStatus.Live) liveCount++;
        }

        if (offset >= liveCount) return new MemeToken[](0);

        uint256 resultSize = limit;
        if (offset + limit > liveCount) resultSize = liveCount - offset;

        result = new MemeToken[](resultSize);
        uint256 found = 0;
        uint256 added = 0;

        for (uint256 i = 1; i <= tokenCount && added < resultSize; i++) {
            if (tokens[i].status == TokenStatus.Live) {
                if (found >= offset) {
                    result[added] = tokens[i];
                    added++;
                }
                found++;
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ADMIN
    // ═══════════════════════════════════════════════════════════════════════════

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
    }

    function setLaunchFee(uint256 _launchFee) external onlyOwner {
        launchFee = _launchFee;
    }

    function setTradingFee(uint256 _tradingFeeBps) external onlyOwner {
        require(_tradingFeeBps <= 500, "Max 5% fee");
        tradingFeeBps = _tradingFeeBps;
    }

    function setBuyFee(uint256 _buyFeeBps) external onlyOwner {
        require(_buyFeeBps <= 500, "Max 5% fee");
        buyFeeBps = _buyFeeBps;
    }

    function setSellFee(uint256 _sellFeeBps) external onlyOwner {
        require(_sellFeeBps <= 500, "Max 5% fee");
        sellFeeBps = _sellFeeBps;
    }

    function setFeeWhitelist(address account, bool whitelisted) external onlyOwner {
        feeWhitelist[account] = whitelisted;
    }

    function batchSetFeeWhitelist(address[] calldata accounts, bool whitelisted) external onlyOwner {
        for (uint256 i = 0; i < accounts.length; i++) {
            feeWhitelist[accounts[i]] = whitelisted;
        }
    }

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid treasury");
        address oldTreasury = treasury;
        treasury = _treasury;
        emit TreasuryUpdated(oldTreasury, _treasury);
    }

    /**
     * @notice Delist/remove a token from the platform
     * @dev Only owner can delist. Refunds remaining reserves to treasury.
     *      Token contract still exists but is marked as delisted.
     * @param tokenId Token ID to delist
     * @param reason Reason for delisting (e.g., "test token", "duplicate", "scam")
     */
    function delistToken(uint256 tokenId, string calldata reason) external onlyOwner {
        MemeToken storage t = tokens[tokenId];
        if (t.tokenAddress == address(0)) revert InvalidToken();
        require(t.status == TokenStatus.Live, "Token not live");

        // Mark as delisted
        t.status = TokenStatus.Delisted;

        // Refund any remaining reserves to treasury
        if (t.reserveBalance > 0) {
            uint256 refundAmount = t.reserveBalance;
            t.reserveBalance = 0;
            (bool sent,) = treasury.call{value: refundAmount}("");
            if (!sent) revert TransferFailed();
        }

        emit TokenDelisted(tokenId, t.tokenAddress, reason, block.timestamp);
    }

    /**
     * @notice Batch delist multiple tokens
     * @param tokenIds Array of token IDs to delist
     * @param reason Reason for delisting
     */
    function batchDelistTokens(uint256[] calldata tokenIds, string calldata reason) external onlyOwner {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            MemeToken storage t = tokens[tokenIds[i]];
            if (t.tokenAddress != address(0) && t.status == TokenStatus.Live) {
                t.status = TokenStatus.Delisted;

                if (t.reserveBalance > 0) {
                    uint256 refundAmount = t.reserveBalance;
                    t.reserveBalance = 0;
                    (bool sent,) = treasury.call{value: refundAmount}("");
                    if (!sent) revert TransferFailed();
                }

                emit TokenDelisted(tokenIds[i], t.tokenAddress, reason, block.timestamp);
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ADJUSTABLE DEX/ADDRESS SETTERS - For network upgrades/migrations
    // ═══════════════════════════════════════════════════════════════════════════

    function setDeadAddress(address _deadAddress) external onlyOwner {
        require(_deadAddress != address(0), "Invalid address");
        deadAddress = _deadAddress;
    }

    function setWpls(address _wpls) external onlyOwner {
        require(_wpls != address(0), "Invalid WPLS");
        wpls = _wpls;
    }

    function setPulseXRouter(address _router) external onlyOwner {
        require(_router != address(0), "Invalid router");
        pulseXRouter = _router;
    }

    function setPulseXFactory(address _factory) external onlyOwner {
        require(_factory != address(0), "Invalid factory");
        pulseXFactory = _factory;
    }

    function setPaisleyRouter(address _router) external onlyOwner {
        paisleyRouter = _router; // Can be address(0) to disable
    }

    function setPaisleyFactory(address _factory) external onlyOwner {
        paisleyFactory = _factory; // Can be address(0) to disable
    }

    function setTestToken(address token, bool status) external onlyOwner {
        isTestToken[token] = status;
    }

    function setLpRecipient(address _lpRecipient) external onlyOwner {
        require(_lpRecipient != address(0), "Invalid LP recipient");
        lpRecipient = _lpRecipient;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ADJUSTABLE CURVE PARAMETER SETTERS - Use with caution on live tokens
    // ═══════════════════════════════════════════════════════════════════════════

    function setMaxSupply(uint256 _maxSupply) external onlyOwner {
        require(_maxSupply > 0, "Invalid supply");
        maxSupply = _maxSupply;
    }

    function setGraduationThreshold(uint256 _threshold) external onlyOwner {
        require(_threshold > 0, "Invalid threshold");
        graduationThreshold = _threshold;
    }

    function setVirtualReserves(uint256 _virtualPls, uint256 _virtualTokens) external onlyOwner {
        require(_virtualPls > 0 && _virtualTokens > 0, "Invalid reserves");
        virtualPlsReserves = _virtualPls;
        virtualTokenReserves = _virtualTokens;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ADJUSTABLE FEE SETTERS - Tune graduation allocation
    // ═══════════════════════════════════════════════════════════════════════════

    function setBurnBps(uint256 _burnBps) external onlyOwner {
        require(_burnBps <= 5000, "Max 50%");
        burnBps = _burnBps;
    }

    function setPulseXLpBps(uint256 _lpBps) external onlyOwner {
        require(_lpBps <= 5000, "Max 50%");
        pulseXLpBps = _lpBps;
    }

    function setPaisleyLpBps(uint256 _lpBps) external onlyOwner {
        require(_lpBps <= 5000, "Max 50%");
        paisleyLpBps = _lpBps;
    }

    function setSuccessRewardBps(uint256 _rewardBps) external onlyOwner {
        require(_rewardBps <= 2000, "Max 20%");
        successRewardBps = _rewardBps;
    }

    function setPlatformFeeBps(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= 500, "Max 5%");
        platformFeeBps = _feeBps;
    }

    // Emergency withdrawal - only for stuck funds
    function emergencyWithdraw() external onlyOwner {
        (bool sent,) = treasury.call{value: address(this).balance}("");
        if (!sent) revert TransferFailed();
    }

    receive() external payable {}
}
