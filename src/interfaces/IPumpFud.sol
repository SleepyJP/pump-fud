// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IPumpFud
 * @notice Interface for PumpFud bonding curve launchpad
 */
interface IPumpFud {
    enum TokenStatus {
        Live,
        Graduated,
        Rugged
    }

    struct MemeToken {
        uint256 id;
        address tokenAddress;
        string name;
        string symbol;
        string description;
        string imageUri;
        address creator;
        uint256 reserveBalance;
        uint256 tokensSold;
        uint256 tradingVolume;
        uint256 createdAt;
        uint256 graduatedAt;
        TokenStatus status;
        uint256 holderCount;
        uint256 tradeCount;
    }

    // Parameters (public state variables)
    function maxSupply() external view returns (uint256);
    function graduationThreshold() external view returns (uint256);
    function virtualPlsReserves() external view returns (uint256);
    function virtualTokenReserves() external view returns (uint256);
    function burnBps() external view returns (uint256);
    function pulseXLpBps() external view returns (uint256);
    function paisleyLpBps() external view returns (uint256);
    function successRewardBps() external view returns (uint256);
    function platformFeeBps() external view returns (uint256);

    // View functions
    function getToken(uint256 tokenId) external view returns (MemeToken memory);
    function tokenCount() external view returns (uint256);
    function calculateBuyAmount(uint256 tokenId, uint256 plsIn) external view returns (uint256 tokensOut);
    function calculateSellAmount(uint256 tokenId, uint256 tokensIn) external view returns (uint256 plsOut);
    function getCurrentPrice(uint256 tokenId) external view returns (uint256);
    function getTokenByAddress(address tokenAddress) external view returns (MemeToken memory);

    // State-changing functions
    function launchToken(
        string calldata name,
        string calldata symbol,
        string calldata description,
        string calldata imageUri
    ) external payable returns (uint256 tokenId, address tokenAddress);

    function buyTokens(uint256 tokenId, uint256 minTokensOut) external payable returns (uint256 tokensOut);
    function sellTokens(uint256 tokenId, uint256 tokensIn, uint256 minPlsOut) external returns (uint256 plsOut);

    // Events
    event TokenLaunched(
        uint256 indexed tokenId,
        address indexed tokenAddress,
        string name,
        string symbol,
        address creator
    );

    event TokensPurchased(
        uint256 indexed tokenId,
        address indexed buyer,
        uint256 plsIn,
        uint256 tokensOut,
        uint256 newPrice
    );

    event TokensSold(
        uint256 indexed tokenId,
        address indexed seller,
        uint256 tokensIn,
        uint256 plsOut,
        uint256 newPrice
    );

    event TokenGraduated(
        uint256 indexed tokenId,
        address indexed tokenAddress,
        address lpPair,
        uint256 plsLiquidity,
        uint256 tokenLiquidity
    );
}
