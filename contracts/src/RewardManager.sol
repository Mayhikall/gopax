// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {GopaxToken} from "./GopaxToken.sol";

/**
 * @title RewardManager
 * @notice Manages carbon assessment verification, duplicate prevention, policy enforcement,
 *         and token reward claims for Gopax.
 */
contract RewardManager is Ownable, ReentrancyGuard, EIP712 {
    bytes32 public constant CLAIM_TYPEHASH = keccak256(
        "RewardClaim(address recipient,bytes32 assessmentHash,uint256 carbonKg,uint256 baselineKg,uint256 reward,uint256 deadline)"
    );
    // ─── Structs ───────────────────────────────────────────────────────────────

    struct Assessment {
        bytes32 assessmentHash;
        uint256 carbonKg; // Carbon emitted (scaled by 1e4, e.g. 1.219 kg = 12190)
        uint256 baselineKg; // Baseline emitted (scaled by 1e4)
        uint256 reward; // Amount of GOPAX tokens rewarded (in whole tokens)
        uint256 timestamp;
    }

    // ─── State Variables ───────────────────────────────────────────────────────

    /// @notice The ERC-20 GOPAX reward token instance
    GopaxToken public immutable gopaxToken;

    /// @notice Maximum reward allowed per assessment claim (in whole GOPAX tokens)
    uint256 public maxReward;

    /// @notice Minimum carbon reduction required if comparison is present (scaled by 1e4)
    uint256 public minReduction;

    address public authorizedSigner;

    /// @notice Treasury address receiving tokens from voucher redemptions
    address public treasury;

    /// @notice Mapping to track claimed assessment hashes for on-chain duplicate prevention
    mapping(bytes32 => bool) public claimedAssessments;

    /// @notice Mapping to store details of claimed assessments
    mapping(bytes32 => Assessment) public assessments;

    // ─── Events ────────────────────────────────────────────────────────────────

    event CarbonRewarded(
        address indexed user, bytes32 indexed assessmentHash, uint256 carbonKg, uint256 baselineKg, uint256 reward
    );

    event PolicyUpdated(uint256 newMaxReward, uint256 newMinReduction);
    event AuthorizedSignerUpdated(address indexed previousSigner, address indexed newSigner);
    event TreasuryUpdated(address indexed previousTreasury, address indexed newTreasury);
    event VoucherRedeemed(address indexed user, string voucherId, uint256 amount, uint256 timestamp);

    // ─── Errors ────────────────────────────────────────────────────────────────

    error InvalidAssessmentHash();
    error AssessmentAlreadyClaimed();
    error RewardZero();
    error RewardExceedsMaxPolicy(uint256 reward, uint256 maxAllowed);
    error InvalidCarbonReduction();
    error ReductionBelowMinimum(uint256 actualReduction, uint256 minRequired);
    error InvalidSigner();
    error ClaimExpired(uint256 deadline);
    error UnauthorizedClaim();
    error InvalidTreasury();
    error PriceZero();
    error InvalidVoucherId();
    error TransferFailed();

    // ─── Constructor ───────────────────────────────────────────────────────────

    /**
     * @param _gopaxToken Address of the deployed GopaxToken contract.
     * @param _initialOwner Owner / admin of the RewardManager contract.
     * @param _authorizedSigner Backend signer authorized to approve reward claims.
     * @param _maxReward Default maximum reward allowed per claim (e.g. 1000).
     * @param _minReduction Default minimum carbon reduction required (e.g. 0).
     * @param _treasury Treasury address receiving tokens from voucher redemptions.
     */
    constructor(
        address _gopaxToken,
        address _initialOwner,
        address _authorizedSigner,
        uint256 _maxReward,
        uint256 _minReduction,
        address _treasury
    ) Ownable(_initialOwner) EIP712("GopaxRewardManager", "1") {
        require(_gopaxToken != address(0), "Invalid token address");
        if (_authorizedSigner == address(0)) revert InvalidSigner();
        gopaxToken = GopaxToken(_gopaxToken);
        authorizedSigner = _authorizedSigner;
        maxReward = _maxReward;
        minReduction = _minReduction;
        treasury = _treasury == address(0) ? _initialOwner : _treasury;
    }

    // ─── External Functions ────────────────────────────────────────────────────

    /**
     * @notice Claims GOPAX token reward by presenting a verified assessment hash.
     * @dev Enforces duplicate prevention, policy limits, and mints GOPAX tokens to msg.sender.
     * @param assessmentHash Deterministic keccak256 hash of the off-chain assessment.
     * @param carbonKg Carbon emission in kg (scaled by 1e4).
     * @param baselineKg Baseline comparison emission in kg (scaled by 1e4, 0 if no comparison).
     * @param reward Amount of GOPAX tokens to reward (whole tokens, e.g. 100).
     * @param deadline Last timestamp at which the authorization remains valid.
     * @param signature EIP-712 signature produced by authorizedSigner.
     */
    function claimReward(
        bytes32 assessmentHash,
        uint256 carbonKg,
        uint256 baselineKg,
        uint256 reward,
        uint256 deadline,
        bytes calldata signature
    ) external nonReentrant {
        // 1. Validate assessment hash
        if (assessmentHash == bytes32(0)) {
            revert InvalidAssessmentHash();
        }

        // 2. On-chain duplicate prevention
        if (claimedAssessments[assessmentHash]) {
            revert AssessmentAlreadyClaimed();
        }

        if (block.timestamp > deadline) revert ClaimExpired(deadline);

        bytes32 structHash =
            keccak256(abi.encode(CLAIM_TYPEHASH, msg.sender, assessmentHash, carbonKg, baselineKg, reward, deadline));
        address recoveredSigner = ECDSA.recover(_hashTypedDataV4(structHash), signature);
        if (recoveredSigner != authorizedSigner) revert UnauthorizedClaim();

        // 3. Validate reward limits
        if (reward == 0) {
            revert RewardZero();
        }
        if (reward > maxReward) {
            revert RewardExceedsMaxPolicy(reward, maxReward);
        }

        // 4. Validate carbon reduction policy if baseline comparison is available
        if (baselineKg > 0) {
            if (baselineKg <= carbonKg) {
                revert InvalidCarbonReduction();
            }
            uint256 reduction = baselineKg - carbonKg;
            if (reduction < minReduction) {
                revert ReductionBelowMinimum(reduction, minReduction);
            }
        }

        // 5. Mark assessment as claimed
        claimedAssessments[assessmentHash] = true;

        // 6. Record assessment data
        assessments[assessmentHash] = Assessment({
            assessmentHash: assessmentHash,
            carbonKg: carbonKg,
            baselineKg: baselineKg,
            reward: reward,
            timestamp: block.timestamp
        });

        // 7. Emit the on-chain reward proof.
        emit CarbonRewarded(msg.sender, assessmentHash, carbonKg, baselineKg, reward);

        // 8. Mint tokens to the authorized recipient (18 decimals).
        gopaxToken.mint(msg.sender, reward * 10 ** 18);
    }

    /**
     * @notice View the current authoritative reward policy parameters.
     * @return maxAllowedReward The maximum reward per claim in GOPAX tokens.
     * @return minRequiredReduction The minimum carbon reduction required (scaled by 1e4).
     */
    function getRewardPolicy() external view returns (uint256 maxAllowedReward, uint256 minRequiredReduction) {
        return (maxReward, minReduction);
    }

    /**
     * @notice Update reward policy parameters. Restricted to owner.
     * @param _newMaxReward New maximum reward per claim.
     * @param _newMinReduction New minimum carbon reduction.
     */
    function setRewardPolicy(uint256 _newMaxReward, uint256 _newMinReduction) external onlyOwner {
        maxReward = _newMaxReward;
        minReduction = _newMinReduction;
        emit PolicyUpdated(_newMaxReward, _newMinReduction);
    }

    /**
     * @notice Rotates the backend signer authorized to approve claims.
     */
    function setAuthorizedSigner(address _newSigner) external onlyOwner {
        if (_newSigner == address(0)) revert InvalidSigner();
        address previousSigner = authorizedSigner;
        authorizedSigner = _newSigner;
        emit AuthorizedSignerUpdated(previousSigner, _newSigner);
    }

    /**
     * @notice Exposes the EIP-712 domain separator for clients and tests.
     */
    function eip712DomainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    /**
     * @notice Backward-compatible getter for the token address.
     */
    function carbonToken() external view returns (address) {
        return address(gopaxToken);
    }

    /**
     * @notice Updates the treasury address. Restricted to owner.
     * @param _newTreasury The new treasury wallet address.
     */
    function setTreasury(address _newTreasury) external onlyOwner {
        if (_newTreasury == address(0)) revert InvalidTreasury();
        address previous = treasury;
        treasury = _newTreasury;
        emit TreasuryUpdated(previous, _newTreasury);
    }

    /**
     * @notice Redeems a digital voucher by transferring GOPAX tokens from user to treasury.
     * @param voucherId Unique identifier string of the voucher.
     * @param amount Amount of GOPAX tokens to pay in wei (10^18 decimals).
     */
    function redeemVoucher(string calldata voucherId, uint256 amount) external nonReentrant {
        if (bytes(voucherId).length == 0) revert InvalidVoucherId();
        if (amount == 0) revert PriceZero();

        bool success = gopaxToken.transferFrom(msg.sender, treasury, amount);
        if (!success) revert TransferFailed();

        emit VoucherRedeemed(msg.sender, voucherId, amount, block.timestamp);
    }
}
