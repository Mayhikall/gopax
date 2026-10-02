# Gopax Frontend

The frontend uses Next.js App Router, React, TypeScript, Tailwind CSS, TanStack Query, Privy, wagmi, and viem.

## Features

- Google login with a Privy embedded wallet or external-wallet login.
- Onboarding, profiles, proof upload, trips, assessment details, and impact dashboard.
- GOPAX balance and claim recovery, including sponsored relay receipts.
- Voucher catalog and history with EIP-2612 permit redemption and no separate `approve`.
- Fixture preview without a backend or wallet.

## Setup

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Required public settings are the API URL, chain ID `97`, token/manager/treasury addresses, RPC URL, `NEXT_PUBLIC_PRIVY_APP_ID`, and optional preview flag. Every `NEXT_PUBLIC_*` value is browser-visible; never place secrets or private keys there. All contract addresses must belong to the same deployment.

## Routes

| Route | Purpose | Auth |
| --- | --- | --- |
| `/` | Landing and Privy login | No |
| `/onboarding` | Profile setup | Yes |
| `/home`, `/impact` | Summary and impact | Yes |
| `/trips`, `/trips/new`, `/trips/[id]` | Trip flow | Yes |
| `/rewards` | Voucher catalog and history | Yes |
| `/profile` | Profile, wallet, balance, network | Yes |
| `/preview` | Fixture journey | No |

Privy manages access-token refresh. Logout or an invalid session clears the profile and query cache.

## Transactions

Before claiming, the frontend validates wallet, recipient, chain, contracts, assessment, deadline, policy, and claimed state, then simulates the transaction. Embedded wallets use Privy with `sponsor: true`; external wallets use their original EIP-1193 provider and pay BNB gas.

Transaction context persists across reloads, replacements, API failures after successful mining, and sponsored relays. Relay validation relies on exact RewardManager events rather than receipt `from` and `to`.

Voucher redemption signs a short-lived EIP-2612 permit and submits one `redeemVoucherWithPermit` transaction. The backend verifies wallet, voucher, amount, and event before issuing a code.

## Privy Dashboard

Enable **Google** and **External wallets**; allow `http://localhost:3000`, `http://127.0.0.1:3000`, and the deployment domain; then enable BNB Smart Chain Testnet sponsorship and **Allow transactions from the client**.

Google creates an embedded wallet for users without one. External wallets remain available but pay their own BNB gas because the MVP does not use account abstraction for external EOAs.

## Preview and checks

`/preview` never uploads files or sends transactions. It is always available in development and requires `NEXT_PUBLIC_ENABLE_PREVIEW=true` in production.

```bash
npm run lint
npm run typecheck
npm run build
npm run abi:sync
```

End-to-end testing requires the backend, database, AI provider, wallet, and BSC Testnet.
