// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IPumpFudLeaderboard {
    function recordTrade(
        address token,
        address trader,
        uint256 plsVolume,
        bool isBuy
    ) external;

    function recordTokenCreation(
        address token,
        address creator
    ) external;

    function recordGraduation(
        address token,
        uint256 totalVolume
    ) external;
}
