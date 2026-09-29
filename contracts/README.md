# Gopax Smart Contracts

Smart contract Gopax dibangun dengan Solidity, Foundry, dan OpenZeppelin untuk BNB Smart Chain Testnet.

- `GopaxToken.sol`: ERC-20/BEP-20 reward token dengan minting berbasis role dan maximum supply.
- `RewardManager.sol`: verifikasi claim EIP-712, reward policy, duplicate prevention, dan pembayaran voucher ke treasury.

Dokumentasi project secara keseluruhan tersedia di [README utama](../README.md).

## Live deployment

Network: **BNB Smart Chain Testnet**, chain ID `97`.

| Komponen | Address |
| --- | --- |
| GopaxToken | [`0xeeCed31a90cB86eC9dEde5AC3e7100d936E18BfA`](https://testnet.bscscan.com/address/0xeeCed31a90cB86eC9dEde5AC3e7100d936E18BfA) |
| RewardManager | [`0x3efD305A3D71A9EB5835acB295990ad8fb39661F`](https://testnet.bscscan.com/address/0x3efD305A3D71A9EB5835acB295990ad8fb39661F) |
| Treasury | [`0xdc22a080D041F4DABdf12fe89Fa45cC898Ab495b`](https://testnet.bscscan.com/address/0xdc22a080D041F4DABdf12fe89Fa45cC898Ab495b) |

Detail transaksi deployment tersedia pada bagian [live deployment README utama](../README.md#live-deployment). Address ini hanya untuk testnet.

## Contracts

### GopaxToken

- Nama `Gopax`, simbol `GOPAX`, dan 18 decimals.
- Maximum supply 10,000,000 GOPAX.
- Mint hanya dapat dilakukan address dengan `MINTER_ROLE`.
- Deployment script memberikan `MINTER_ROLE` kepada `RewardManager`; deployer tetap menjadi token admin.

### RewardManager

Untuk claim reward, manager:

- memverifikasi signature EIP-712 dari `authorizedSigner`;
- mengikat signature ke recipient, assessment hash, carbon, baseline, reward, dan deadline;
- menolak authorization kedaluwarsa atau dimodifikasi;
- mencegah assessment hash diklaim dua kali;
- menerapkan `maxReward` dan `minReduction`; dan
- mint GOPAX kepada wallet pengirim claim.

Untuk voucher, manager memindahkan GOPAX pengguna ke `treasury` dengan `transferFrom` dan menerbitkan event `VoucherRedeemed`. Pengguna harus memberi allowance terlebih dahulu. Owner dapat memperbarui reward policy, authorized signer, dan treasury.

## Instalasi dependency

```bash
cd contracts
forge install
```

Repository sudah menyertakan Foundry dan OpenZeppelin di `lib`. Perintah ini memastikan dependency tersedia sebelum build, test, atau deployment.

## Unit test

```bash
cd contracts
forge test -vvv
```

Test mencakup metadata, role minting, maximum supply, claim EIP-712, recipient/reward tampering, expiry, duplicate claim, reward policy, signer rotation, voucher allowance/redemption, dan treasury update.

## Konfigurasi deployment

```bash
cp .env.example .env
```

```env
PRIVATE_KEY=0x...
REWARD_SIGNER_ADDRESS=0x...
TREASURY_ADDRESS=0x...
BSC_TESTNET_RPC=https://data-seed-prebsc-1-s1.binance.org:8545
ETHERSCAN_API_KEY=...
```

| Variable | Fungsi |
| --- | --- |
| `PRIVATE_KEY` | Private key deployer yang memiliki tBNB |
| `REWARD_SIGNER_ADDRESS` | Address dari `REWARD_SIGNER_PRIVATE_KEY` backend |
| `TREASURY_ADDRESS` | Penerima GOPAX dari voucher; opsional, default deployer |
| `BSC_TESTNET_RPC` | RPC BSC Testnet, chain ID `97` |
| `ETHERSCAN_API_KEY` | API key verifikasi contract |

Signer, deployer, dan treasury boleh berbeda. Jangan menggunakan private key pengguna.

## Deployment

Dapatkan tBNB dari [BNB Chain Testnet Faucet](https://www.bnbchain.org/en/testnet-faucet), kemudian jalankan:

```bash
source .env

forge script script/Deploy.s.sol:DeployScript \
  --rpc-url "$BSC_TESTNET_RPC" \
  --broadcast \
  --verify \
  -vvvv
```

Hilangkan `--verify` jika tidak memerlukan verifikasi. Parameter awal deployment adalah `maxReward = 100`, `minReduction = 0`, dan treasury dari `TREASURY_ADDRESS` atau deployer.

Output:

```text
GOPAX_TOKEN_ADDRESS=0x...
REWARD_MANAGER_ADDRESS=0x...
```

## Setelah deployment

Backend:

```env
GOPAX_TOKEN_ADDRESS=0x...
REWARD_MANAGER_ADDRESS=0x...
REWARD_SIGNER_PRIVATE_KEY=0x...
TREASURY_ADDRESS=0x...
CLAIM_AUTHORIZATION_TTL_SECONDS=900
```

Frontend:

```env
NEXT_PUBLIC_GOPAX_TOKEN_ADDRESS=0x...
NEXT_PUBLIC_REWARD_MANAGER_ADDRESS=0x...
NEXT_PUBLIC_TREASURY_ADDRESS=0x...
```

Verifikasi bahwa:

1. `RewardManager` memiliki `MINTER_ROLE`;
2. `authorizedSigner()` cocok dengan signer backend;
3. `treasury()` cocok dengan konfigurasi aplikasi; dan
4. `getRewardPolicy()` mengembalikan policy yang diharapkan.

## Sinkronisasi ABI

Setelah interface contract berubah:

```bash
cd backend
npm run abi:sync

cd ../frontend
npm run abi:sync
```

Perubahan interface biasanya membutuhkan deployment baru. Commit ABI dan perbarui address di semua environment.

## Keamanan

- Contract ditujukan untuk MVP testnet dan belum dinyatakan diaudit untuk production.
- Simpan deployer key dan signer key di secret manager.
- Rotasi signer melalui `setAuthorizedSigner` jika key bocor.
- `carbonKg`, `baselineKg`, dan `minReduction` memakai skala `1e4`.
- Reward memakai whole GOPAX sebelum dimint menjadi 18 decimals.
