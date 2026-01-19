// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IPumpFud} from "./interfaces/IPumpFud.sol";

interface IUniswapV2Router {
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory);

    function swapExactETHForTokens(
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external payable returns (uint[] memory);

    function swapExactTokensForETH(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory);

    function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory);
    function WETH() external pure returns (address);
}

interface IUniswapV2Factory {
    function getPair(address tokenA, address tokenB) external view returns (address);
}

/**
 * @title PumpFudArbitrage
 * @notice Arbitrage bot for pump.fud platform - ONLYBOTS Integration
 * @dev Arbitrages between pump.fud bonding curve and PulseX DEXes
 *
 * ARBITRAGE OPPORTUNITIES:
 * 1. Bonding Curve vs PulseX (pre-graduation)
 * 2. Graduation price discrepancy
 * 3. Post-graduation cross-DEX arb (PulseX V1/V2/9inch)
 */
contract PumpFudArbitrage is Ownable, ReentrancyGuard {
    address public constant TREASURY = 0x49bBEFa1d94702C0e9a5EAdDEc7c3C5D3eb9086B;
    address public constant WPLS = 0xA1077a294dDE1B09bB078844df40758a5D0f9a27;

    // PulseChain DEX Routers
    address public constant PULSEX_V1_ROUTER = 0x98bf93ebf5c380C0e6Ae8e192A7e2AE08edAcc02;
    address public constant PULSEX_V2_ROUTER = 0x165C3410fC91EF562C50559f7d2289fEbed552d9;
    address public constant NINEINCH_ROUTER = 0x5bCa5697F3a82F0360544a6e8b3e1f8a98c567d1;

    // PulseX V2 Factory for LP checks
    address public constant PULSEX_V2_FACTORY = 0x29eA7545DEf87022BAdc76323F373EA1e707C523;

    // Pump.fud contract
    IPumpFud public pumpFud;

    // Bot settings
    uint256 public minProfitBps = 25; // 0.25% min profit
    uint256 public maxGasPrice = 100 gwei;
    uint256 public maxPositionPls = 10_000 ether; // Max 10K PLS per arb

    // Authorized executors
    mapping(address => bool) public authorizedBots;

    // Track graduated tokens for arb
    mapping(address => bool) public watchedTokens;
    address[] public watchList;

    // Events
    event BondingCurveArbExecuted(
        uint256 indexed tokenId,
        address indexed token,
        uint256 plsIn,
        uint256 profit,
        bool buyOnCurve
    );

    event CrossDexArbExecuted(
        address indexed token,
        address buyRouter,
        address sellRouter,
        uint256 amountIn,
        uint256 profit
    );

    event GraduationArbExecuted(
        uint256 indexed tokenId,
        address indexed token,
        uint256 profit
    );

    event TokenAddedToWatchlist(address indexed token, uint256 indexed tokenId);
    event ProfitWithdrawn(address indexed token, uint256 amount);

    // Errors
    error NotAuthorized();
    error GasTooHigh();
    error PositionTooLarge();
    error NoProfitableArb();
    error TransferFailed();
    error TokenNotLive();
    error TokenNotGraduated();
    error NoLPExists();

    modifier onlyBot() {
        if (!authorizedBots[msg.sender] && msg.sender != owner()) revert NotAuthorized();
        _;
    }

    constructor(address _pumpFud) Ownable(msg.sender) {
        pumpFud = IPumpFud(_pumpFud);
        authorizedBots[msg.sender] = true;
    }

    receive() external payable {}

    /*//////////////////////////////////////////////////////////////
                            ADMIN FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function setPumpFud(address _pumpFud) external onlyOwner {
        pumpFud = IPumpFud(_pumpFud);
    }

    function setBot(address bot, bool authorized) external onlyOwner {
        authorizedBots[bot] = authorized;
    }

    function setMinProfitBps(uint256 _bps) external onlyOwner {
        minProfitBps = _bps;
    }

    function setMaxGasPrice(uint256 _maxGas) external onlyOwner {
        maxGasPrice = _maxGas;
    }

    function setMaxPositionPls(uint256 _maxPls) external onlyOwner {
        maxPositionPls = _maxPls;
    }

    /*//////////////////////////////////////////////////////////////
                         WATCHLIST MANAGEMENT
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Add token to watchlist for post-graduation arb
     * @param tokenId The pump.fud token ID
     */
    function addToWatchlist(uint256 tokenId) external onlyBot {
        IPumpFud.MemeToken memory token = pumpFud.getToken(tokenId);
        if (!watchedTokens[token.tokenAddress]) {
            watchedTokens[token.tokenAddress] = true;
            watchList.push(token.tokenAddress);
            emit TokenAddedToWatchlist(token.tokenAddress, tokenId);
        }
    }

    /**
     * @notice Get all watched tokens
     */
    function getWatchList() external view returns (address[] memory) {
        return watchList;
    }

    /*//////////////////////////////////////////////////////////////
                      BONDING CURVE ARBITRAGE
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Check if bonding curve price differs from PulseX (post-graduation)
     * @param tokenId The pump.fud token ID
     * @param plsAmount Amount of PLS to check
     * @return profit Expected profit in PLS
     * @return buyOnCurve True if buy on curve, sell on DEX is profitable
     */
    function checkBondingCurveArb(
        uint256 tokenId,
        uint256 plsAmount
    ) public view returns (uint256 profit, bool buyOnCurve) {
        IPumpFud.MemeToken memory token = pumpFud.getToken(tokenId);

        // Only works for live tokens (pre-graduation)
        if (token.status != IPumpFud.TokenStatus.Live) {
            return (0, false);
        }

        // Get bonding curve price (tokens per PLS after fee)
        uint256 curveTokensOut = pumpFud.calculateBuyAmount(tokenId, plsAmount * 99 / 100);

        // Check if LP exists on PulseX V2
        address pair = IUniswapV2Factory(PULSEX_V2_FACTORY).getPair(token.tokenAddress, WPLS);
        if (pair == address(0)) {
            return (0, false);
        }

        // Get PulseX V2 price
        address[] memory path = new address[](2);
        path[0] = WPLS;
        path[1] = token.tokenAddress;

        try IUniswapV2Router(PULSEX_V2_ROUTER).getAmountsOut(plsAmount, path) returns (uint256[] memory amounts) {
            uint256 dexTokensOut = amounts[1];

            // Compare: more tokens on curve = buy curve, sell DEX
            if (curveTokensOut > dexTokensOut) {
                // Calculate profit from buying on curve, selling on DEX
                path[0] = token.tokenAddress;
                path[1] = WPLS;
                uint256[] memory sellAmounts = IUniswapV2Router(PULSEX_V2_ROUTER).getAmountsOut(curveTokensOut, path);
                if (sellAmounts[1] > plsAmount) {
                    profit = sellAmounts[1] - plsAmount;
                    buyOnCurve = true;
                }
            } else if (dexTokensOut > curveTokensOut) {
                // Buy on DEX, sell on curve
                uint256 curvePlsOut = pumpFud.calculateSellAmount(tokenId, dexTokensOut);
                if (curvePlsOut > plsAmount) {
                    profit = curvePlsOut - plsAmount;
                    buyOnCurve = false;
                }
            }
        } catch {
            return (0, false);
        }

        // Check min profit threshold
        uint256 minProfit = (plsAmount * minProfitBps) / 10000;
        if (profit < minProfit) {
            profit = 0;
        }
    }

    /**
     * @notice Execute bonding curve arbitrage
     * @param tokenId The pump.fud token ID
     * @param plsAmount Amount of PLS to arb with
     * @param buyOnCurve True to buy on curve and sell on DEX
     * @param minProfit Minimum profit required
     */
    function executeBondingCurveArb(
        uint256 tokenId,
        uint256 plsAmount,
        bool buyOnCurve,
        uint256 minProfit
    ) external payable onlyBot nonReentrant returns (uint256 profit) {
        if (tx.gasprice > maxGasPrice) revert GasTooHigh();
        if (plsAmount > maxPositionPls) revert PositionTooLarge();

        IPumpFud.MemeToken memory token = pumpFud.getToken(tokenId);
        if (token.status != IPumpFud.TokenStatus.Live) revert TokenNotLive();

        uint256 plsBefore = address(this).balance - msg.value;

        if (buyOnCurve) {
            // Step 1: Buy tokens on bonding curve
            uint256 tokensReceived = pumpFud.buyTokens{value: plsAmount}(tokenId, 0);

            // Step 2: Sell tokens on PulseX V2
            IERC20(token.tokenAddress).approve(PULSEX_V2_ROUTER, tokensReceived);

            address[] memory path = new address[](2);
            path[0] = token.tokenAddress;
            path[1] = WPLS;

            IUniswapV2Router(PULSEX_V2_ROUTER).swapExactTokensForETH(
                tokensReceived,
                0,
                path,
                address(this),
                block.timestamp
            );
        } else {
            // Step 1: Buy tokens on PulseX V2
            address[] memory pathBuy = new address[](2);
            pathBuy[0] = WPLS;
            pathBuy[1] = token.tokenAddress;

            uint256[] memory amounts = IUniswapV2Router(PULSEX_V2_ROUTER).swapExactETHForTokens{value: plsAmount}(
                0,
                pathBuy,
                address(this),
                block.timestamp
            );

            uint256 tokensReceived = amounts[1];

            // Step 2: Sell tokens on bonding curve
            pumpFud.sellTokens(tokenId, tokensReceived, 0);
        }

        uint256 plsAfter = address(this).balance;
        if (plsAfter <= plsBefore) revert NoProfitableArb();
        profit = plsAfter - plsBefore;
        if (profit < minProfit) revert NoProfitableArb();

        emit BondingCurveArbExecuted(tokenId, token.tokenAddress, plsAmount, profit, buyOnCurve);
    }

    /*//////////////////////////////////////////////////////////////
                      CROSS-DEX ARBITRAGE (POST-GRADUATION)
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Check cross-DEX arb opportunity for graduated token
     * @param token The graduated token address
     * @param plsAmount Amount of PLS to arb
     * @param routerBuy Router to buy on
     * @param routerSell Router to sell on
     */
    function checkCrossDexArb(
        address token,
        uint256 plsAmount,
        address routerBuy,
        address routerSell
    ) public view returns (uint256 profit, bool profitable) {
        address[] memory pathBuy = new address[](2);
        pathBuy[0] = WPLS;
        pathBuy[1] = token;

        try IUniswapV2Router(routerBuy).getAmountsOut(plsAmount, pathBuy) returns (uint256[] memory buyAmounts) {
            uint256 tokensReceived = buyAmounts[1];

            address[] memory pathSell = new address[](2);
            pathSell[0] = token;
            pathSell[1] = WPLS;

            try IUniswapV2Router(routerSell).getAmountsOut(tokensReceived, pathSell) returns (uint256[] memory sellAmounts) {
                if (sellAmounts[1] > plsAmount) {
                    profit = sellAmounts[1] - plsAmount;
                    uint256 minProfit = (plsAmount * minProfitBps) / 10000;
                    profitable = profit >= minProfit;
                }
            } catch {}
        } catch {}
    }

    /**
     * @notice Execute cross-DEX arbitrage for graduated token
     */
    function executeCrossDexArb(
        address token,
        uint256 plsAmount,
        address routerBuy,
        address routerSell,
        uint256 minProfit
    ) external payable onlyBot nonReentrant returns (uint256 profit) {
        if (tx.gasprice > maxGasPrice) revert GasTooHigh();
        if (plsAmount > maxPositionPls) revert PositionTooLarge();

        uint256 plsBefore = address(this).balance - msg.value;

        // Buy tokens on first DEX
        address[] memory pathBuy = new address[](2);
        pathBuy[0] = WPLS;
        pathBuy[1] = token;

        uint256[] memory buyAmounts = IUniswapV2Router(routerBuy).swapExactETHForTokens{value: plsAmount}(
            0,
            pathBuy,
            address(this),
            block.timestamp
        );

        uint256 tokensReceived = buyAmounts[1];

        // Sell tokens on second DEX
        IERC20(token).approve(routerSell, tokensReceived);

        address[] memory pathSell = new address[](2);
        pathSell[0] = token;
        pathSell[1] = WPLS;

        IUniswapV2Router(routerSell).swapExactTokensForETH(
            tokensReceived,
            0,
            pathSell,
            address(this),
            block.timestamp
        );

        uint256 plsAfter = address(this).balance;
        if (plsAfter <= plsBefore) revert NoProfitableArb();
        profit = plsAfter - plsBefore;
        if (profit < minProfit) revert NoProfitableArb();

        emit CrossDexArbExecuted(token, routerBuy, routerSell, plsAmount, profit);
    }

    /*//////////////////////////////////////////////////////////////
                         SCANNING FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Scan all watched tokens for cross-DEX arb opportunities
     * @param plsAmount Amount to check per token
     */
    function scanWatchedTokens(
        uint256 plsAmount
    ) external view returns (
        address[] memory profitableTokens,
        uint256[] memory profits,
        address[] memory buyRouters,
        address[] memory sellRouters
    ) {
        address[3] memory routers = [PULSEX_V1_ROUTER, PULSEX_V2_ROUTER, NINEINCH_ROUTER];

        // First pass: count profitable opportunities
        uint256 count;
        for (uint i = 0; i < watchList.length; i++) {
            for (uint j = 0; j < routers.length; j++) {
                for (uint k = 0; k < routers.length; k++) {
                    if (j != k) {
                        (, bool profitable) = checkCrossDexArb(
                            watchList[i], plsAmount, routers[j], routers[k]
                        );
                        if (profitable) count++;
                    }
                }
            }
        }

        // Second pass: populate results
        profitableTokens = new address[](count);
        profits = new uint256[](count);
        buyRouters = new address[](count);
        sellRouters = new address[](count);

        uint256 idx;
        for (uint i = 0; i < watchList.length && idx < count; i++) {
            for (uint j = 0; j < routers.length && idx < count; j++) {
                for (uint k = 0; k < routers.length && idx < count; k++) {
                    if (j != k) {
                        (uint256 profit, bool profitable) = checkCrossDexArb(
                            watchList[i], plsAmount, routers[j], routers[k]
                        );
                        if (profitable) {
                            profitableTokens[idx] = watchList[i];
                            profits[idx] = profit;
                            buyRouters[idx] = routers[j];
                            sellRouters[idx] = routers[k];
                            idx++;
                        }
                    }
                }
            }
        }
    }

    /**
     * @notice Check tokens near graduation for positioning
     * @param tokenIds Array of token IDs to check
     * @param thresholdPct Percentage of graduation threshold (e.g., 90 = 90%)
     */
    function scanNearGraduation(
        uint256[] calldata tokenIds,
        uint256 thresholdPct
    ) external view returns (
        uint256[] memory nearGradTokenIds,
        uint256[] memory reserveBalances,
        uint256[] memory percentToGrad
    ) {
        uint256 gradThreshold = pumpFud.graduationThreshold();
        uint256 minReserve = (gradThreshold * thresholdPct) / 100;

        uint256 count;
        for (uint i = 0; i < tokenIds.length; i++) {
            IPumpFud.MemeToken memory token = pumpFud.getToken(tokenIds[i]);
            if (token.status == IPumpFud.TokenStatus.Live && token.reserveBalance >= minReserve) {
                count++;
            }
        }

        nearGradTokenIds = new uint256[](count);
        reserveBalances = new uint256[](count);
        percentToGrad = new uint256[](count);

        uint256 idx;
        for (uint i = 0; i < tokenIds.length && idx < count; i++) {
            IPumpFud.MemeToken memory token = pumpFud.getToken(tokenIds[i]);
            if (token.status == IPumpFud.TokenStatus.Live && token.reserveBalance >= minReserve) {
                nearGradTokenIds[idx] = tokenIds[i];
                reserveBalances[idx] = token.reserveBalance;
                percentToGrad[idx] = (token.reserveBalance * 100) / gradThreshold;
                idx++;
            }
        }
    }

    /*//////////////////////////////////////////////////////////////
                         PROFIT MANAGEMENT
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Withdraw accumulated profits to treasury
     * @param token Token address (address(0) for PLS)
     */
    function withdrawProfits(address token) external onlyOwner {
        uint256 balance;
        if (token == address(0)) {
            balance = address(this).balance;
            (bool success,) = TREASURY.call{value: balance}("");
            if (!success) revert TransferFailed();
        } else {
            balance = IERC20(token).balanceOf(address(this));
            IERC20(token).transfer(TREASURY, balance);
        }
        emit ProfitWithdrawn(token, balance);
    }

    /**
     * @notice Emergency withdraw to owner
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        if (token == address(0)) {
            (bool success,) = owner().call{value: amount}("");
            if (!success) revert TransferFailed();
        } else {
            IERC20(token).transfer(owner(), amount);
        }
    }
}
