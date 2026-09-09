> Reward policy: 10 GOPAX base + round(90 × clamp(1 − intensity / 0.235, 0, 1)) bonus. Intensity uses the stored emission factor in kg CO₂e/passenger-km; CAR/MOTORCYCLE assume one occupant. All categories are eligible; AI REWARD and backend validation are required. Comparison is optional. No distance multiplier. Maximum 100 GOPAX. This is an incentive score, not avoided emissions. Equal factors yield equal rewards. Old reward records remain unchanged.

# Gopax Smart Contracts (Foundry)

Smart contracts untuk platform Gopax di BNB Smart Chain (BSC Testnet).

- **`GopaxToken.sol`**: BEP-20 token `GOPAX` dengan hak akses minting terbatas.
- **`RewardManager.sol`**: Pengelola policy, otorisasi claim EIP-712, pencegahan duplikat on-chain via hash, dan eksekusi klaim reward.

---

## 1. Menjalankan Unit Tests

```bash
forge test -vvv
```

---

## 2. Persiapan Deploy ke BSC Testnet

### A. Dapatkan Faucet tBNB
Pastikan wallet deployer Anda memiliki saldo **tBNB** (testnet BNB) untuk membayar gas fee transaksi deployment:
- Faucet resmi: [BNB Chain Testnet Faucet](https://www.bnbchain.org/en/testnet-faucet)

### B. Konfigurasi `.env`
Buka file `contracts/.env`, lalu isi private key deployer dan address signer backend:

```env
PRIVATE_KEY=0x_private_key_wallet_kamu
REWARD_SIGNER_ADDRESS=0x_address_signer_backend
BSC_TESTNET_RPC=https://data-seed-prebsc-1-s1.binance.org:8545
```

`REWARD_SIGNER_ADDRESS` harus berasal dari `REWARD_SIGNER_PRIVATE_KEY` pada backend. Key signer hanya menandatangani authorization EIP-712; transaksi claim tetap dikirim dan ditandatangani wallet user.

---

## 3. Eksekusi Deployment

Jalankan perintah berikut dari dalam folder `contracts/`:

```bash
# 1. Load environment variables
source .env

# 2. Deploy contract dan broadcast ke BSC Testnet (dengan verifikasi otomatis ke BscScan)
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url $BSC_TESTNET_RPC \
  --broadcast \
  --verify \
  -vvvv
```

*(Catatan: Jika tidak ingin langsung verifikasi kode di BscScan, hilangkan flag `--verify`).*

---

## 4. Setelah Deployment Selesai

Terminal akan menampilkan alamat kontrak yang berhasil di-deploy:

```text
GOPAX_TOKEN_ADDRESS=0x...
REWARD_MANAGER_ADDRESS=0x...
```

Salin konfigurasi berikut ke `backend/.env`:

```env
GOPAX_TOKEN_ADDRESS=0x...
REWARD_MANAGER_ADDRESS=0x...
REWARD_SIGNER_PRIVATE_KEY=0x_private_key_signer_backend
CLAIM_AUTHORIZATION_TTL_SECONDS=900
```

Pastikan address dari `REWARD_SIGNER_PRIVATE_KEY` sama dengan `authorizedSigner()` pada `RewardManager`. Deployment script memberikan `MINTER_ROLE` kepada `RewardManager`, sementara deployer tetap menjadi admin token. Perubahan ABI claim atau role minter memerlukan deployment ulang contract dan sinkronisasi address baru pada backend/frontend.


## ABI backend

ABI backend dihasilkan dari artifact Solidity, bukan ditulis manual. Dari folder `backend`, jalankan `npm run abi:sync` setiap interface contract berubah. Perintah ini menjalankan `forge build --offline` dan menyimpan ABI ke `backend/src/abi/`. Commit file ABI bersama perubahan contract.

Sebelum deployment, isi `REWARD_SIGNER_PRIVATE_KEY` di `backend/.env` dengan key wallet signer milik aplikasi, lalu isi address wallet tersebut sebagai `REWARD_SIGNER_ADDRESS` di `contracts/.env`. Jangan menggunakan private key pengguna aplikasi. Signer dan deployer boleh berbeda. Backend tidak membutuhkan saldo gas untuk menandatangani izin claim.

Database: jalankan `npm run migrate` dari folder `backend`. Setelah deploy, perbarui kedua contract address di backend dan verifikasi role minter serta authorized signer sebelum mencoba claim.
