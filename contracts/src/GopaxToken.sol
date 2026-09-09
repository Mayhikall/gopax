// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title GopaxToken
 * @notice ERC-20 reward token for Gopax platform.
 * @dev Minting permission is restricted to MINTER_ROLE.
 */
contract GopaxToken is ERC20, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /// @notice Maximum total supply (10,000,000 GOPAX tokens with 18 decimals)
    uint256 public constant MAX_SUPPLY = 10_000_000 * 10 ** 18;

    error MaxSupplyExceeded(uint256 attemptedTotal, uint256 maxAllowed);

    /**
     * @dev Sets token name and symbol, initializes the admin.
     * @param initialAdmin Address allowed to grant and revoke token roles.
     */
    constructor(address initialAdmin) ERC20("Gopax", "GOPAX") {
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
    }

    /**
     * @notice Mint new GOPAX tokens to a recipient.
     * @dev Only an account with MINTER_ROLE can call this function.
     * @param to Address receiving the newly minted tokens.
     * @param amount Amount of tokens to mint (in wei / 10^18 decimals).
     */
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        if (totalSupply() + amount > MAX_SUPPLY) {
            revert MaxSupplyExceeded(totalSupply() + amount, MAX_SUPPLY);
        }
        _mint(to, amount);
    }
}
