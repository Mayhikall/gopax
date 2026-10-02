# Gopax Backend

The Node.js and Express API uses PostgreSQL, Knex.js, Privy, Supabase Storage, vision AI, viem, and distance services. It handles authentication, proof validation, deterministic emissions and rewards, EIP-712 claims, impact aggregates, vouchers, and on-chain verification.

## Setup

```bash
npm ci
cp .env.example .env
npm run migrate
npm run dev
```

The API defaults to `http://localhost:5000`; health check: `GET /health`.

Configure the database, Privy App ID and backend-only secret, Supabase, OpenRouter, RPC, contract addresses, reward signer, treasury, CORS, claim TTL, and distance providers. `REWARD_SIGNER_PRIVATE_KEY` must resolve to `RewardManager.authorizedSigner()`; it may differ from the deployer and needs no gas.

## Assessment flow

Migrations create users with one primary wallet per `privy_user_id`, trips, proofs, assessments, rewards, vouchers, and redemptions.

1. Validate MIME type and magic bytes.
2. Compare SHA-256 against the user's proofs.
3. Extract trip data with vision AI and validate its output.
4. Obtain distance from proof data or a provider.
5. Calculate emissions with fixed factors.
6. Assess evidence eligibility.
7. Calculate GOPAX in backend code; AI never sets token amounts.
8. Store the trip, assessments, and reward.

A retry endpoint continues recoverable assessments without creating another trip.

## Claims, vouchers, and relays

Claim authorizations bind recipient, assessment hash, emissions, baseline, reward, and deadline. Confirmation verifies the exact `CarbonRewarded` event before setting `CLAIMED`.

Voucher redemption uses EIP-2612 and `redeemVoucherWithPermit`. The backend rejects reused transaction hashes, checks stock, and verifies the exact `VoucherRedeemed` event against wallet, voucher ID, and price before returning a code.

Privy transactions may be relayed, so receipt `from` and `to` can differ from the user and RewardManager. The configured RewardManager's events are authoritative. If mining succeeds but API sync fails, retry with the same transaction hash; never submit a second claim.

## API and commands

Protected endpoints require `Authorization: Bearer <privy-access-token>`. Routes cover `/auth/session`, `/users`, `/trips`, assessment retry, claim preparation/confirmation, `/impact`, and voucher catalog/history/redemption.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start with nodemon |
| `npm start` | Start production server |
| `npm run migrate` | Run migrations |
| `npm run migrate:rollback` | Roll back latest migration |
| `npm run seed` | Run available seeds |
| `npm run abi:sync` | Build contracts offline and synchronize ABI |

Run ABI synchronization after interface changes and update addresses after redeployment.

## Security

Never commit secrets or private keys. Keep proofs in a private bucket and personal data off-chain. AI can misread tickets and does not replace fraud detection. Public distance services have external limits. Seeded vouchers are demo data. This testnet MVP requires a security review before production.