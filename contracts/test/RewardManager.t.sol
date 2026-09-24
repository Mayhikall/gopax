// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {GopaxToken} from "../src/GopaxToken.sol";
import {RewardManager} from "../src/RewardManager.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract RewardManagerTest is Test {
    GopaxToken public token;
    RewardManager public manager;

    address public owner = address(0xABCD);
    address public alice = address(0x1);
    address public bob = address(0x2);
    address public treasury = address(0x9999);
    uint256 public signerPrivateKey = 0xA11CE;
    address public signer;

    uint256 public constant MAX_REWARD = 200;
    uint256 public constant MIN_REDUCTION = 0;
    bytes32 public constant CLAIM_TYPEHASH = keccak256(
        "RewardClaim(address recipient,bytes32 assessmentHash,uint256 carbonKg,uint256 baselineKg,uint256 reward,uint256 deadline)"
    );
    bytes32 public domainSeparator;

    bytes32 public sampleHash = keccak256(abi.encodePacked("trip_1", uint256(65), uint256(100)));
    bytes32 public sampleHash2 = keccak256(abi.encodePacked("trip_2", uint256(120), uint256(150)));

    event CarbonRewarded(
        address indexed user, bytes32 indexed assessmentHash, uint256 carbonKg, uint256 baselineKg, uint256 reward
    );
    event TreasuryUpdated(address indexed previousTreasury, address indexed newTreasury);
    event VoucherRedeemed(address indexed user, string voucherId, uint256 amount, uint256 timestamp);

    function setUp() public {
        signer = vm.addr(signerPrivateKey);
        vm.startPrank(owner);
        // 1. Deploy GopaxToken
        token = new GopaxToken(owner);

        // 2. Deploy RewardManager
        manager = new RewardManager(address(token), owner, signer, MAX_REWARD, MIN_REDUCTION, treasury);
        domainSeparator = manager.eip712DomainSeparator();

        // 3. Grant RewardManager permission to mint
        token.grantRole(token.MINTER_ROLE(), address(manager));
        vm.stopPrank();
    }

    function _signature(
        address recipient,
        bytes32 assessmentHash,
        uint256 carbonKg,
        uint256 baselineKg,
        uint256 reward,
        uint256 deadline
    ) internal view returns (bytes memory) {
        bytes32 structHash = keccak256(
            abi.encode(CLAIM_TYPEHASH, recipient, assessmentHash, carbonKg, baselineKg, reward, deadline)
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPrivateKey, digest);
        return abi.encodePacked(r, s, v);
    }

    function _claim(address recipient, bytes32 assessmentHash, uint256 carbonKg, uint256 baselineKg, uint256 reward)
        internal
    {
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory signature = _signature(recipient, assessmentHash, carbonKg, baselineKg, reward, deadline);
        vm.prank(recipient);
        manager.claimReward(assessmentHash, carbonKg, baselineKg, reward, deadline, signature);
    }

    // ─── Policy View & Update Tests ───────────────────────────────────────────

    function test_InitialPolicy() public view {
        (uint256 maxRew, uint256 minRed) = manager.getRewardPolicy();
        assertEq(maxRew, MAX_REWARD);
        assertEq(minRed, MIN_REDUCTION);
    }

    function test_OwnerCanUpdatePolicy() public {
        vm.prank(owner);
        manager.setRewardPolicy(2000, 50);

        (uint256 maxRew, uint256 minRed) = manager.getRewardPolicy();
        assertEq(maxRew, 2000);
        assertEq(minRed, 50);
    }

    function test_NonOwnerCannotUpdatePolicy() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        manager.setRewardPolicy(2000, 50);
    }

    function test_OwnerCanRotateAuthorizedSigner() public {
        address nextSigner = address(0xCAFE);
        vm.prank(owner);
        manager.setAuthorizedSigner(nextSigner);
        assertEq(manager.authorizedSigner(), nextSigner);
    }

    function test_NonOwnerCannotRotateAuthorizedSigner() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        manager.setAuthorizedSigner(bob);
    }

    function test_OldSignerCannotAuthorizeAfterRotation() public {
        vm.prank(owner);
        manager.setAuthorizedSigner(address(0xCAFE));

        uint256 deadline = block.timestamp + 1 hours;
        bytes memory signature = _signature(alice, sampleHash, 7900, 152900, 100, deadline);
        vm.prank(alice);
        vm.expectRevert(RewardManager.UnauthorizedClaim.selector);
        manager.claimReward(sampleHash, 7900, 152900, 100, deadline, signature);
    }

    // ─── Claim Reward Success Tests ───────────────────────────────────────────

    function test_ClaimRewardSuccess() public {
        uint256 carbonKg = 7900; // 0.79 kg * 1e4
        uint256 baselineKg = 152900; // 15.29 kg * 1e4
        uint256 rewardAmount = 100; // 100 GOPAX tokens

        // Expect CarbonRewarded event
        vm.expectEmit(true, true, false, true, address(manager));
        emit CarbonRewarded(alice, sampleHash, carbonKg, baselineKg, rewardAmount);

        _claim(alice, sampleHash, carbonKg, baselineKg, rewardAmount);

        // Verify tokens minted to Alice (18 decimals)
        assertEq(token.balanceOf(alice), rewardAmount * 10 ** 18);

        // Verify assessment marked as claimed
        assertTrue(manager.claimedAssessments(sampleHash));

        // Verify assessment stored details
        (bytes32 storedHash, uint256 storedCarbon, uint256 storedBaseline, uint256 storedReward, uint256 timestamp) =
            manager.assessments(sampleHash);

        assertEq(storedHash, sampleHash);
        assertEq(storedCarbon, carbonKg);
        assertEq(storedBaseline, baselineKg);
        assertEq(storedReward, rewardAmount);
        assertGt(timestamp, 0);
    }

    function test_ClaimWithoutBaselineComparison() public {
        uint256 carbonKg = 47000; // 4.7 kg
        uint256 baselineKg = 0; // No baseline available
        uint256 rewardAmount = 50;

        _claim(bob, sampleHash2, carbonKg, baselineKg, rewardAmount);
        assertEq(token.balanceOf(bob), rewardAmount * 10 ** 18);
    }

    function test_CannotUseAuthorizationForAnotherRecipient() public {
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory signature = _signature(alice, sampleHash, 7900, 152900, 100, deadline);
        vm.prank(bob);
        vm.expectRevert(RewardManager.UnauthorizedClaim.selector);
        manager.claimReward(sampleHash, 7900, 152900, 100, deadline, signature);
    }

    function test_CannotTamperWithAuthorizedReward() public {
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory signature = _signature(alice, sampleHash, 7900, 152900, 100, deadline);
        vm.prank(alice);
        vm.expectRevert(RewardManager.UnauthorizedClaim.selector);
        manager.claimReward(sampleHash, 7900, 152900, 101, deadline, signature);
    }

    function test_CannotClaimExpiredAuthorization() public {
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory signature = _signature(alice, sampleHash, 7900, 152900, 100, deadline);
        vm.warp(deadline + 1);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(RewardManager.ClaimExpired.selector, deadline));
        manager.claimReward(sampleHash, 7900, 152900, 100, deadline, signature);
    }

    // ─── Duplicate & Validation Failure Tests ──────────────────────────────────

    function test_CannotClaimDuplicateAssessment() public {
        uint256 carbonKg = 7900;
        uint256 baselineKg = 152900;
        uint256 rewardAmount = 100;

        // First claim succeeds
        _claim(alice, sampleHash, carbonKg, baselineKg, rewardAmount);

        // Second claim with identical hash must revert
        vm.expectRevert(RewardManager.AssessmentAlreadyClaimed.selector);
        _claim(alice, sampleHash, carbonKg, baselineKg, rewardAmount);

        // Another user trying the same hash must also revert
        vm.expectRevert(RewardManager.AssessmentAlreadyClaimed.selector);
        _claim(bob, sampleHash, carbonKg, baselineKg, rewardAmount);
    }

    function test_CannotClaimWithZeroHash() public {
        vm.expectRevert(RewardManager.InvalidAssessmentHash.selector);
        _claim(alice, bytes32(0), 1000, 5000, 100);
    }

    function test_CannotClaimZeroReward() public {
        vm.expectRevert(RewardManager.RewardZero.selector);
        _claim(alice, sampleHash, 1000, 5000, 0);
    }

    function test_CannotExceedMaxRewardPolicy() public {
        uint256 excessReward = MAX_REWARD + 1;

        vm.expectRevert(abi.encodeWithSelector(RewardManager.RewardExceedsMaxPolicy.selector, excessReward, MAX_REWARD));
        _claim(alice, sampleHash, 1000, 5000, excessReward);
    }

    function test_CannotClaimWhenEmissionsHigherThanBaseline() public {
        uint256 carbonKg = 10000;
        uint256 baselineKg = 5000; // Baseline smaller than actual = emisi lebih buruk!

        vm.expectRevert(RewardManager.InvalidCarbonReduction.selector);
        _claim(alice, sampleHash, carbonKg, baselineKg, 100);
    }

    function test_CannotClaimBelowMinimumReductionPolicy() public {
        // Set minReduction to 10000 (1 kg)
        vm.prank(owner);
        manager.setRewardPolicy(MAX_REWARD, 10000);

        uint256 carbonKg = 9500;
        uint256 baselineKg = 10000; // Reduction = 500 < 10000 minReduction

        vm.expectRevert(abi.encodeWithSelector(RewardManager.ReductionBelowMinimum.selector, 500, 10000));
        _claim(alice, sampleHash, carbonKg, baselineKg, 100);
    }

    function test_RedeemVoucherSuccess() public {
        // Mint some tokens to alice first via owner mint
        bytes32 minterRole = token.MINTER_ROLE();
        vm.startPrank(owner);
        token.grantRole(minterRole, owner);
        token.mint(alice, 50 * 10 ** 18);
        vm.stopPrank();

        // Alice approves RewardManager
        vm.prank(alice);
        token.approve(address(manager), 20 * 10 ** 18);

        // Alice redeems voucher
        vm.expectEmit(true, false, false, true);
        emit VoucherRedeemed(alice, "vch-transit-10k", 20 * 10 ** 18, block.timestamp);

        vm.prank(alice);
        manager.redeemVoucher("vch-transit-10k", 20 * 10 ** 18);

        assertEq(token.balanceOf(alice), 30 * 10 ** 18);
        assertEq(token.balanceOf(treasury), 20 * 10 ** 18);
    }

    function test_CannotRedeemWithZeroAmount() public {
        vm.prank(alice);
        vm.expectRevert(RewardManager.PriceZero.selector);
        manager.redeemVoucher("vch-1", 0);
    }

    function test_CannotRedeemWithEmptyVoucherId() public {
        vm.prank(alice);
        vm.expectRevert(RewardManager.InvalidVoucherId.selector);
        manager.redeemVoucher("", 10 * 10 ** 18);
    }

    function test_CannotRedeemWithoutApproval() public {
        bytes32 minterRole = token.MINTER_ROLE();
        vm.startPrank(owner);
        token.grantRole(minterRole, owner);
        token.mint(alice, 50 * 10 ** 18);
        vm.stopPrank();

        vm.prank(alice);
        // Did not approve
        vm.expectRevert();
        manager.redeemVoucher("vch-1", 10 * 10 ** 18);
    }

    function test_OwnerCanUpdateTreasury() public {
        address newTreasury = address(0x8888);
        vm.expectEmit(true, true, false, false);
        emit TreasuryUpdated(treasury, newTreasury);

        vm.prank(owner);
        manager.setTreasury(newTreasury);
        assertEq(manager.treasury(), newTreasury);
    }

    function test_NonOwnerCannotUpdateTreasury() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        manager.setTreasury(address(0x8888));
    }
}
