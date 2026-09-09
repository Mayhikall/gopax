// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {GopaxToken} from "../src/GopaxToken.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";

contract GopaxTokenTest is Test {
    GopaxToken public token;
    address public admin = address(0xABCD);
    address public minter = address(0xCAFE);
    address public alice = address(0x1);
    address public bob = address(0x2);

    function setUp() public {
        vm.prank(admin);
        token = new GopaxToken(admin);
    }

    function _grantMinter() internal {
        vm.startPrank(admin);
        token.grantRole(token.MINTER_ROLE(), minter);
        vm.stopPrank();
    }

    function test_InitialMetadata() public view {
        assertEq(token.name(), "Gopax");
        assertEq(token.symbol(), "GOPAX");
        assertEq(token.decimals(), 18);
        assertEq(token.totalSupply(), 0);
        assertTrue(token.hasRole(token.DEFAULT_ADMIN_ROLE(), admin));
        assertFalse(token.hasRole(token.MINTER_ROLE(), admin));
    }

    function test_AdminCanGrantMinterAndMinterCanMint() public {
        _grantMinter();
        vm.prank(minter);
        token.mint(alice, 100 * 10 ** 18);
        assertEq(token.balanceOf(alice), 100 * 10 ** 18);
    }

    function test_NonMinterCannotMint() public {
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, alice, token.MINTER_ROLE())
        );
        vm.prank(alice);
        token.mint(alice, 100 * 10 ** 18);
    }

    function test_AdminCanRotateMinter() public {
        _grantMinter();
        vm.startPrank(admin);
        token.revokeRole(token.MINTER_ROLE(), minter);
        token.grantRole(token.MINTER_ROLE(), bob);
        vm.stopPrank();

        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, minter, token.MINTER_ROLE()
            )
        );
        vm.prank(minter);
        token.mint(alice, 50 * 10 ** 18);

        vm.prank(bob);
        token.mint(alice, 50 * 10 ** 18);
        assertEq(token.balanceOf(alice), 50 * 10 ** 18);
    }

    function test_MaxSupplyEnforced() public {
        _grantMinter();
        uint256 max = token.MAX_SUPPLY();
        assertEq(max, 10_000_000 * 10 ** 18);

        vm.prank(minter);
        token.mint(alice, max);
        assertEq(token.totalSupply(), max);

        vm.prank(minter);
        vm.expectRevert(abi.encodeWithSelector(GopaxToken.MaxSupplyExceeded.selector, max + 1, max));
        token.mint(alice, 1);
    }
}
