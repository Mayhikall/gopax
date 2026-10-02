# Gopax Smart Contracts

The contracts use Solidity, Foundry, and OpenZeppelin on BNB Smart Chain Testnet.

- `GopaxToken.sol`: ERC-20/BEP-20 reward token with role-based minting, a 10,000,000 GOPAX cap, 18 decimals, and EIP-2612 permit.
- `RewardManager.sol`: EIP-712 claims, reward policy, duplicate prevention, and voucher payments to treasury.

## Active deployment

| Component | Address |
| --- | --- |
| GopaxToken | [`0x518fC1a3EFc6806F0B46C25CbC21a27C216597F5`](https://testnet.bscscan.com/address/0x518fC1a3EFc6806F0B46C25CbC21a27C216597F5) |
| RewardManager | [`0xba6aa6E7685563C56225d085c6cD71a1Ea1a6B4F`](https://testnet.bscscan.com/address/0xba6aa6E7685563C56225d085c6cD71a1Ea1a6B4F) |
| Treasury | [`0xdc22a080D041F4DABdf12fe89Fa45cC898Ab495b`](https://testnet.bscscan.com/address/0xdc22a080D041F4DABdf12fe89Fa45cC898Ab495b) |

These addresses are testnet-only. Canonical Foundry artifacts are under `broadcast/`; `deployments/bsc-testnet.json` is a manually maintained summary of this active deployment.

## Behavior

`RewardManager` verifies signatures from `authorizedSigner`, binds them to all claim fields, rejects expired/modified/duplicate claims, enforces `maxReward` and `minReduction`, and mints to the claimant. It transfers redeemed GOPAX to `treasury`; the owner can update policy, signer, and treasury.

Use `redeemVoucherWithPermit` for atomic EIP-2612 permit and transfer without a separate `approve`. Legacy `redeemVoucher` remains available.

## Build, test, and deploy

```bash
forge install
forge build
forge test -vvv
forge fmt --check
```

Create `.env` from `.env.example` and fill these exact variables:

```env
PRIVATE_KEY=your_private_key_here
REWARD_SIGNER_ADDRESS=0x_your_backend_signer_address
TREASURY_ADDRESS=0x_your_treasury_address
BSC_TESTNET_RPC=https://data-seed-prebsc-1-s1.binance.org:8545
ETHERSCAN_API_KEY=your_bscscan_api_key_here
```

`PRIVATE_KEY` must belong to a deployer funded with tBNB. `REWARD_SIGNER_ADDRESS` must be derived from the backend `REWARD_SIGNER_PRIVATE_KEY`. `TREASURY_ADDRESS` is optional; when omitted, the deployer becomes the treasury. Deployer, signer, and treasury may differ. Never use a user's private key.

```bash
cp .env.example .env
# Edit .env once, then run this single deployment command:
set -a && . ./.env && set +a && forge script script/Deploy.s.sol:DeployScript \
  --rpc-url "$BSC_TESTNET_RPC" \
  --broadcast --verify --verifier etherscan \
  --etherscan-api-key "$ETHERSCAN_API_KEY" -vvvv
```

Initial policy is `maxReward = 100`, `minReduction = 0`. Verify minter role, signer, treasury, token address, and policy after deployment.

## ABI and security

Run `npm run abi:sync` in backend and frontend after interface changes. Interface changes normally require redeployment and address updates.

Privy-sponsored transactions may enter through a relay, but authoritative events still come from RewardManager. These testnet contracts have not been declared production-audited. Store deployer/signer keys securely and rotate a compromised signer with `setAuthorizedSigner`. Carbon and baseline values use `1e4` scale; rewards use whole GOPAX before minting 18-decimal units.
