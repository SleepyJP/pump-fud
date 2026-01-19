// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

/**
 * @title PumpFudToken
 * @notice ERC20 token for pump.fud bonding curve launchpad
 * @dev Only the factory can mint/burn tokens during bonding curve phase
 */
contract PumpFudToken is ERC20 {
    address public immutable factory;
    address public immutable creator;
    string public imageUri;
    uint256 public immutable createdAt;

    string private _tokenName;
    string private _tokenSymbol;

    error OnlyFactory();

    modifier onlyFactory() {
        if (msg.sender != factory) revert OnlyFactory();
        _;
    }

    constructor(
        string memory name_,
        string memory symbol_,
        string memory imageUri_,
        address creator_
    ) ERC20(name_, symbol_) {
        factory = msg.sender;
        creator = creator_;
        imageUri = imageUri_;
        createdAt = block.timestamp;
        _tokenName = name_;
        _tokenSymbol = symbol_;
    }

    function mint(address to, uint256 amount) external onlyFactory {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyFactory {
        _burn(from, amount);
    }

    function name() public view override returns (string memory) {
        return _tokenName;
    }

    function symbol() public view override returns (string memory) {
        return _tokenSymbol;
    }

    function decimals() public pure override returns (uint8) {
        return 18;
    }
}
