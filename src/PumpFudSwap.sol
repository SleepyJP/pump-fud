// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IPumpFud} from "./interfaces/IPumpFud.sol";

/**
 * @title PumpFudSwap
 * @notice Unified swap interface for pump.fud platform
 * @dev Routes trades through bonding curve (pre-graduation) or DEX (post-graduation)
 *
 * FEATURES:
 * - Automatic routing: bonding curve vs DEX
 * - DEX aggregation: PulseX V1, V2, Paisley Swap
 * - Limit orders / positions
 * - Platform fee on swaps
 *
 * WHY HAVE A SWAPPER?
 * 1. Pre-graduation: Trade on bonding curve
 * 2. Post-graduation: Route to best DEX price
 * 3. Platform stickiness: Keep users on-site
 * 4. Fee capture: Platform fee on top of DEX
 * 5. Unified UX: One interface for all tokens
 *
 * TREASURY: 0x49bBEFa1d94702C0e9a5EAdDEc7c3C5D3eb9086B
 */
contract PumpFudSwap is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    address public constant TREASURY = 0x49bBEFa1d94702C0e9a5EAdDEc7c3C5D3eb9086B;
    address public constant WPLS = 0xA1077a294dDE1B09bB078844df40758a5D0f9a27;

    // DEX routers on PulseChain (configurable)
    address public pulseXV1Router = 0x98bf93ebf5c380C0e6Ae8e192A7e2AE08edAcc02;
    address public pulseXV2Router = 0x165C3410fC91EF562C50559f7d2289fEbed552d9;
    address public paisleyRouter; // Set via admin - Paisley Swap DEX

    // PumpFud main contract
    IPumpFud public pumpFud;

    // Fees (adjustable)
    uint256 public swapFeeBps = 50; // 0.5% platform fee
    uint256 public constant MAX_FEE_BPS = 300; // Max 3%

    // Position system
    struct Position {
        uint256 id;
        address owner;
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 minAmountOut;    // Limit price
        uint256 createdAt;
        uint256 expiresAt;
        bool isActive;
        bool isFilled;
    }

    uint256 public positionCount;
    mapping(uint256 => Position) public positions;
    mapping(address => uint256[]) public userPositions;

    // Stats
    uint256 public totalVolumeSwapped;
    uint256 public totalFeesCollected;

    // Events
    event Swapped(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        string route // "curve", "pulsex-v1", "pulsex-v2", "paisley"
    );
    event PositionCreated(
        uint256 indexed positionId,
        address indexed owner,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut
    );
    event PositionFilled(uint256 indexed positionId, uint256 amountOut);
    event PositionCancelled(uint256 indexed positionId);
    event FeeUpdated(uint256 oldFee, uint256 newFee);

    // Errors
    error InvalidToken();
    error InsufficientOutput();
    error PositionNotFound();
    error NotPositionOwner();
    error PositionExpired();
    error PositionNotActive();
    error InvalidAmount();
    error FeeTooHigh();
    error SwapFailed();

    constructor(address _pumpFud) Ownable(msg.sender) {
        pumpFud = IPumpFud(_pumpFud);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SWAP - MAIN ENTRY POINT
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Swap tokens with automatic routing
     * @param tokenIn Input token (address(0) for PLS)
     * @param tokenOut Output token (address(0) for PLS)
     * @param amountIn Amount of input tokens
     * @param minAmountOut Minimum output (slippage protection)
     * @return amountOut Actual output amount
     */
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut
    ) external payable nonReentrant returns (uint256 amountOut) {
        if (amountIn == 0) revert InvalidAmount();

        // Handle PLS input
        if (tokenIn == address(0)) {
            if (msg.value < amountIn) revert InvalidAmount();
            amountIn = msg.value;
        } else {
            IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        }

        // Deduct platform fee
        uint256 fee = (amountIn * swapFeeBps) / 10000;
        uint256 amountAfterFee = amountIn - fee;

        // Route the swap
        (amountOut,) = _executeSwap(tokenIn, tokenOut, amountAfterFee, minAmountOut);

        if (amountOut < minAmountOut) revert InsufficientOutput();

        // Send output to user
        if (tokenOut == address(0)) {
            (bool sent,) = msg.sender.call{value: amountOut}("");
            require(sent, "PLS transfer failed");
        } else {
            IERC20(tokenOut).safeTransfer(msg.sender, amountOut);
        }

        // Send fee to treasury
        if (fee > 0) {
            if (tokenIn == address(0)) {
                (bool sent,) = TREASURY.call{value: fee}("");
                require(sent, "Fee transfer failed");
            } else {
                IERC20(tokenIn).safeTransfer(TREASURY, fee);
            }
            totalFeesCollected += fee;
        }

        totalVolumeSwapped += amountIn;
    }

    /**
     * @notice Get best quote for a swap
     */
    function getQuote(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (
        uint256 amountOut,
        string memory bestRoute
    ) {
        uint256 amountAfterFee = amountIn - (amountIn * swapFeeBps) / 10000;
        return _getBestQuote(tokenIn, tokenOut, amountAfterFee);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // INTERNAL ROUTING
    // ═══════════════════════════════════════════════════════════════════════════

    function _executeSwap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut
    ) internal returns (uint256 amountOut, string memory route) {
        // Check if either token is a pump.fud token on bonding curve
        bool tokenInOnCurve = _isOnBondingCurve(tokenIn);
        bool tokenOutOnCurve = _isOnBondingCurve(tokenOut);

        // Route through bonding curve if applicable
        if (tokenInOnCurve && tokenOut == address(0)) {
            // Sell pump.fud token for PLS
            amountOut = _sellOnCurve(tokenIn, amountIn, minAmountOut);
            return (amountOut, "curve-sell");
        }

        if (tokenIn == address(0) && tokenOutOnCurve) {
            // Buy pump.fud token with PLS
            amountOut = _buyOnCurve(tokenOut, amountIn, minAmountOut);
            return (amountOut, "curve-buy");
        }

        // Otherwise route through DEX aggregation
        (amountOut, route) = _swapOnDex(tokenIn, tokenOut, amountIn, minAmountOut);
    }

    function _isOnBondingCurve(address token) internal view returns (bool) {
        if (token == address(0)) return false;

        try pumpFud.getTokenByAddress(token) returns (IPumpFud.MemeToken memory t) {
            return t.tokenAddress != address(0) && t.status == IPumpFud.TokenStatus.Live;
        } catch {
            return false;
        }
    }

    function _buyOnCurve(
        address token,
        uint256 plsAmount,
        uint256 minTokensOut
    ) internal returns (uint256 tokensOut) {
        // Get token ID
        IPumpFud.MemeToken memory t = pumpFud.getTokenByAddress(token);

        // Buy through PumpFud
        tokensOut = pumpFud.buyTokens{value: plsAmount}(t.id, minTokensOut);

        // Transfer tokens to this contract (PumpFud sends to msg.sender)
        // Note: This requires PumpFud to support recipient parameter or we handle differently
    }

    function _sellOnCurve(
        address token,
        uint256 tokenAmount,
        uint256 minPlsOut
    ) internal returns (uint256 plsOut) {
        IPumpFud.MemeToken memory t = pumpFud.getTokenByAddress(token);

        // Approve PumpFud to spend tokens
        IERC20(token).approve(address(pumpFud), tokenAmount);

        // Sell through PumpFud
        plsOut = pumpFud.sellTokens(t.id, tokenAmount, minPlsOut);
    }

    function _swapOnDex(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut
    ) internal returns (uint256 amountOut, string memory route) {
        // Get quotes from all DEXs
        (uint256 bestQuote, string memory bestRoute) = _getBestQuote(tokenIn, tokenOut, amountIn);

        if (bestQuote < minAmountOut) revert InsufficientOutput();

        // Execute on best router
        address router;
        if (keccak256(bytes(bestRoute)) == keccak256(bytes("pulsex-v1"))) {
            router = pulseXV1Router;
        } else if (keccak256(bytes(bestRoute)) == keccak256(bytes("pulsex-v2"))) {
            router = pulseXV2Router;
        } else if (keccak256(bytes(bestRoute)) == keccak256(bytes("paisley"))) {
            router = paisleyRouter;
        } else {
            router = pulseXV2Router; // Default fallback
        }

        amountOut = _swapOnRouter(router, tokenIn, tokenOut, amountIn, minAmountOut);
        route = bestRoute;

        emit Swapped(msg.sender, tokenIn, tokenOut, amountIn, amountOut, route);
    }

    function _getBestQuote(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) internal view returns (uint256 bestQuote, string memory bestRoute) {
        // Check bonding curve first
        if (_isOnBondingCurve(tokenOut) && tokenIn == address(0)) {
            try pumpFud.getTokenByAddress(tokenOut) returns (IPumpFud.MemeToken memory t) {
                uint256 curveQuote = pumpFud.calculateBuyAmount(t.id, amountIn);
                if (curveQuote > bestQuote) {
                    bestQuote = curveQuote;
                    bestRoute = "curve";
                }
            } catch {}
        }

        if (_isOnBondingCurve(tokenIn) && tokenOut == address(0)) {
            try pumpFud.getTokenByAddress(tokenIn) returns (IPumpFud.MemeToken memory t) {
                uint256 curveQuote = pumpFud.calculateSellAmount(t.id, amountIn);
                if (curveQuote > bestQuote) {
                    bestQuote = curveQuote;
                    bestRoute = "curve";
                }
            } catch {}
        }

        // Check DEXs
        uint256 v1Quote = _getRouterQuote(pulseXV1Router, tokenIn, tokenOut, amountIn);
        if (v1Quote > bestQuote) {
            bestQuote = v1Quote;
            bestRoute = "pulsex-v1";
        }

        uint256 v2Quote = _getRouterQuote(pulseXV2Router, tokenIn, tokenOut, amountIn);
        if (v2Quote > bestQuote) {
            bestQuote = v2Quote;
            bestRoute = "pulsex-v2";
        }

        // Paisley Swap (if configured)
        if (paisleyRouter != address(0)) {
            uint256 paisleyQuote = _getRouterQuote(paisleyRouter, tokenIn, tokenOut, amountIn);
            if (paisleyQuote > bestQuote) {
                bestQuote = paisleyQuote;
                bestRoute = "paisley";
            }
        }
    }

    function _getRouterQuote(
        address router,
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) internal view returns (uint256) {
        address[] memory path = new address[](2);
        path[0] = tokenIn == address(0) ? WPLS : tokenIn;
        path[1] = tokenOut == address(0) ? WPLS : tokenOut;

        try IUniswapV2Router(router).getAmountsOut(amountIn, path) returns (uint256[] memory amounts) {
            return amounts[1];
        } catch {
            return 0;
        }
    }

    function _swapOnRouter(
        address router,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut
    ) internal returns (uint256 amountOut) {
        address[] memory path = new address[](2);
        path[0] = tokenIn == address(0) ? WPLS : tokenIn;
        path[1] = tokenOut == address(0) ? WPLS : tokenOut;

        if (tokenIn == address(0)) {
            // PLS -> Token
            uint256[] memory amounts = IUniswapV2Router(router).swapExactETHForTokens{value: amountIn}(
                minAmountOut,
                path,
                address(this),
                block.timestamp + 300
            );
            amountOut = amounts[amounts.length - 1];
        } else if (tokenOut == address(0)) {
            // Token -> PLS
            IERC20(tokenIn).approve(router, amountIn);
            uint256[] memory amounts = IUniswapV2Router(router).swapExactTokensForETH(
                amountIn,
                minAmountOut,
                path,
                address(this),
                block.timestamp + 300
            );
            amountOut = amounts[amounts.length - 1];
        } else {
            // Token -> Token
            IERC20(tokenIn).approve(router, amountIn);
            uint256[] memory amounts = IUniswapV2Router(router).swapExactTokensForTokens(
                amountIn,
                minAmountOut,
                path,
                address(this),
                block.timestamp + 300
            );
            amountOut = amounts[amounts.length - 1];
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // POSITIONS (Limit Orders)
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Create a limit order position
     * @param tokenIn Token to sell
     * @param tokenOut Token to buy
     * @param amountIn Amount to sell
     * @param minAmountOut Minimum amount to receive (limit price)
     * @param duration How long position is valid (seconds)
     */
    function createPosition(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 duration
    ) external payable nonReentrant returns (uint256 positionId) {
        if (amountIn == 0) revert InvalidAmount();

        // Take tokens from user
        if (tokenIn == address(0)) {
            if (msg.value < amountIn) revert InvalidAmount();
        } else {
            IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        }

        positionCount++;
        positionId = positionCount;

        positions[positionId] = Position({
            id: positionId,
            owner: msg.sender,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            amountIn: amountIn,
            minAmountOut: minAmountOut,
            createdAt: block.timestamp,
            expiresAt: block.timestamp + duration,
            isActive: true,
            isFilled: false
        });

        userPositions[msg.sender].push(positionId);

        emit PositionCreated(positionId, msg.sender, tokenIn, tokenOut, amountIn, minAmountOut);
    }

    /**
     * @notice Fill a position (anyone can call if price is met)
     */
    function fillPosition(uint256 positionId) external nonReentrant {
        Position storage pos = positions[positionId];
        if (pos.id == 0) revert PositionNotFound();
        if (!pos.isActive) revert PositionNotActive();
        if (block.timestamp > pos.expiresAt) revert PositionExpired();

        // Check if current price meets limit
        (uint256 currentQuote,) = _getBestQuote(pos.tokenIn, pos.tokenOut, pos.amountIn);
        if (currentQuote < pos.minAmountOut) revert InsufficientOutput();

        // Execute the swap
        uint256 fee = (pos.amountIn * swapFeeBps) / 10000;
        uint256 amountAfterFee = pos.amountIn - fee;

        (uint256 amountOut,) = _executeSwap(pos.tokenIn, pos.tokenOut, amountAfterFee, pos.minAmountOut);

        // Send output to position owner
        if (pos.tokenOut == address(0)) {
            (bool sent,) = pos.owner.call{value: amountOut}("");
            require(sent, "PLS transfer failed");
        } else {
            IERC20(pos.tokenOut).safeTransfer(pos.owner, amountOut);
        }

        // Send fee to treasury
        if (fee > 0) {
            if (pos.tokenIn == address(0)) {
                (bool sent,) = TREASURY.call{value: fee}("");
                require(sent, "Fee transfer failed");
            } else {
                IERC20(pos.tokenIn).safeTransfer(TREASURY, fee);
            }
        }

        pos.isActive = false;
        pos.isFilled = true;

        emit PositionFilled(positionId, amountOut);
    }

    /**
     * @notice Cancel a position and refund
     */
    function cancelPosition(uint256 positionId) external nonReentrant {
        Position storage pos = positions[positionId];
        if (pos.id == 0) revert PositionNotFound();
        if (pos.owner != msg.sender) revert NotPositionOwner();
        if (!pos.isActive) revert PositionNotActive();

        pos.isActive = false;

        // Refund tokens
        if (pos.tokenIn == address(0)) {
            (bool sent,) = msg.sender.call{value: pos.amountIn}("");
            require(sent, "PLS refund failed");
        } else {
            IERC20(pos.tokenIn).safeTransfer(msg.sender, pos.amountIn);
        }

        emit PositionCancelled(positionId);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    function getPosition(uint256 positionId) external view returns (Position memory) {
        return positions[positionId];
    }

    function getUserPositions(address user) external view returns (uint256[] memory) {
        return userPositions[user];
    }

    function getActivePositions(address user) external view returns (Position[] memory) {
        uint256[] memory posIds = userPositions[user];
        uint256 activeCount = 0;

        for (uint i = 0; i < posIds.length; i++) {
            if (positions[posIds[i]].isActive) activeCount++;
        }

        Position[] memory active = new Position[](activeCount);
        uint256 index = 0;

        for (uint i = 0; i < posIds.length; i++) {
            if (positions[posIds[i]].isActive) {
                active[index] = positions[posIds[i]];
                index++;
            }
        }

        return active;
    }

    function isPositionFillable(uint256 positionId) external view returns (bool fillable, uint256 currentQuote) {
        Position memory pos = positions[positionId];
        if (!pos.isActive || block.timestamp > pos.expiresAt) {
            return (false, 0);
        }

        (currentQuote,) = _getBestQuote(pos.tokenIn, pos.tokenOut, pos.amountIn);
        fillable = currentQuote >= pos.minAmountOut;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ADMIN
    // ═══════════════════════════════════════════════════════════════════════════

    function setSwapFee(uint256 _feeBps) external onlyOwner {
        if (_feeBps > MAX_FEE_BPS) revert FeeTooHigh();
        emit FeeUpdated(swapFeeBps, _feeBps);
        swapFeeBps = _feeBps;
    }

    function setPumpFud(address _pumpFud) external onlyOwner {
        pumpFud = IPumpFud(_pumpFud);
    }

    function setPulseXV1Router(address _router) external onlyOwner {
        pulseXV1Router = _router;
    }

    function setPulseXV2Router(address _router) external onlyOwner {
        pulseXV2Router = _router;
    }

    function setPaisleyRouter(address _router) external onlyOwner {
        paisleyRouter = _router;
    }

    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        if (token == address(0)) {
            (bool sent,) = TREASURY.call{value: amount}("");
            require(sent, "Withdraw failed");
        } else {
            IERC20(token).safeTransfer(TREASURY, amount);
        }
    }

    receive() external payable {}
}

// ═══════════════════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════════════════

interface IUniswapV2Router {
    function getAmountsOut(uint256 amountIn, address[] calldata path) external view returns (uint256[] memory amounts);

    function swapExactETHForTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable returns (uint256[] memory amounts);

    function swapExactTokensForETH(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}
