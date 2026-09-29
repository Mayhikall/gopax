# Gopax Backend

REST API Gopax dibangun dengan Node.js, Express 5, PostgreSQL, Knex.js, SIWE, JWT, Supabase Storage, vision AI, viem, dan layanan estimasi jarak.

Backend menangani autentikasi, validasi bukti perjalanan, estimasi emisi, reward, otorisasi claim EIP-712, agregat impact, katalog voucher, dan verifikasi transaksi on-chain. Dokumentasi lengkap project tersedia di [README utama](../README.md).

## Fitur

- Nonce dan verifikasi Sign-In with Ethereum.
- Session JWT dan profil pengguna.
- Upload JPEG/PNG maksimum 10 MiB ke Supabase Storage.
- Magic-byte validation, SHA-256 proof hash, dan duplicate check.
- Ekstraksi tiket serta eligibility assessment menggunakan vision AI.
- Estimasi jarak dan perhitungan emisi/reward deterministik.
- EIP-712 claim authorization dan receipt verification.
- Katalog voucher, stock, transaction anti-replay, event verification, dan kode voucher.

## Menjalankan

Prasyarat: Node.js, PostgreSQL, Supabase Storage, OpenRouter API key, BSC Testnet RPC, serta deployment `GopaxToken` dan `RewardManager`.

```bash
cd backend
npm ci
cp .env.example .env
npm run migrate
npm run dev
```

API berjalan pada `http://localhost:5000` secara default. Health check:

```bash
curl http://localhost:5000/health
```

## Konfigurasi

| Variable | Fungsi |
| --- | --- |
| `PORT`, `NODE_ENV` | Port HTTP dan environment |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | PostgreSQL |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | Session JWT |
| `SIWE_DOMAIN`, `SIWE_URI` | Harus cocok dengan frontend |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET` | Private proof storage |
| `RPC_URL` | BSC Testnet RPC |
| `GOPAX_TOKEN_ADDRESS`, `REWARD_MANAGER_ADDRESS` | Deployment contract |
| `REWARD_SIGNER_PRIVATE_KEY` | Signer EIP-712 aplikasi, bukan key pengguna |
| `TREASURY_ADDRESS` | Treasury deployment aktif |
| `CLAIM_AUTHORIZATION_TTL_SECONDS` | Masa berlaku authorization, default 900 detik |
| `OPENROUTER_API_KEY` | API key vision model |
| `OPENROUTER_MODEL`, `OPENROUTER_FALLBACK_MODEL` | Model utama dan fallback |
| `CORS_ORIGIN` | Origin frontend |
| `GEOCODING_PROVIDER` | `photon` atau `nominatim` |
| `PHOTON_BASE_URL`, `NOMINATIM_BASE_URL`, `OSRM_BASE_URL` | Distance providers |
| `NOMINATIM_USER_AGENT` | Identitas aplikasi untuk provider |
| `NETWORK_AUTO_SELECT_FAMILY` | Workaround network Node opsional |

`REWARD_SIGNER_PRIVATE_KEY` harus menghasilkan address yang sama dengan `RewardManager.authorizedSigner()`. Signer boleh berbeda dari deployer dan tidak memerlukan saldo gas.

## Database

```bash
npm run migrate
npm run migrate:rollback
```

Migration membuat tabel `users`, `trips`, `trip_proofs`, `carbon_assessments`, `ai_assessments`, `rewards`, `vouchers`, dan `voucher_redemptions`. Migration voucher juga memasukkan katalog contoh untuk development/demo.

## Pipeline perjalanan

1. File diperiksa melalui MIME type dan magic bytes.
2. SHA-256 dibandingkan dengan bukti pengguna sebelumnya.
3. Vision AI mengekstrak kategori, asal, tujuan, tanggal, dan jarak opsional.
4. Backend memvalidasi extraction.
5. Jarak diambil dari bukti atau distance provider.
6. Emisi dihitung menggunakan faktor tetap.
7. AI menilai kesesuaian bukti dengan konteks trip.
8. Backend menghitung jumlah GOPAX; AI tidak menentukan token amount.
9. Trip, assessment, eligibility, dan reward disimpan.

Endpoint retry dapat melanjutkan assessment yang gagal tanpa membuat trip baru.

## Claim dan voucher

Backend menandatangani authorization claim yang mengikat recipient, assessment hash, carbon, baseline, reward, dan deadline. Setelah transaksi mined, confirmation endpoint memverifikasi receipt dan event sebelum menandai reward `CLAIMED`.

Untuk voucher, backend menolak transaction hash yang pernah digunakan, memeriksa voucher dan stock, lalu memverifikasi event `VoucherRedeemed` terhadap wallet, voucher ID, dan harga. Stock dan redemption dicatat dalam transaksi database sebelum kode dikembalikan.

## API

Protected endpoint menggunakan:

```http
Authorization: Bearer <jwt>
```

| Method | Endpoint | Auth | Fungsi |
| --- | --- | --- | --- |
| `GET` | `/health` | Tidak | Health check |
| `POST` | `/auth/nonce` | Tidak | Nonce SIWE |
| `POST` | `/auth/verify` | Tidak | Verifikasi SIWE dan JWT |
| `POST` | `/users` | Ya | Membuat/memperbarui profil |
| `GET` | `/users/me` | Ya | Profil aktif |
| `POST` | `/trips` | Ya | Upload multipart field `proof` |
| `GET` | `/trips` | Ya | Daftar trip |
| `GET` | `/trips/:id` | Ya | Detail trip |
| `POST` | `/trips/:id/assessment/retry` | Ya | Retry assessment |
| `POST` | `/trips/:id/claim` | Ya | Menyiapkan claim |
| `POST` | `/trips/:id/claim/confirm` | Ya | Verifikasi dan sync claim |
| `GET` | `/impact` | Ya | Agregat impact |
| `GET` | `/vouchers` | Tidak | Katalog voucher |
| `GET` | `/vouchers/my-vouchers` | Ya | Riwayat voucher |
| `POST` | `/vouchers/redeem` | Ya | Verifikasi tx dan membuat kode |

## Scripts

| Command | Fungsi |
| --- | --- |
| `npm run dev` | Development server dengan nodemon |
| `npm start` | Menjalankan server Node |
| `npm run migrate` | Menjalankan migration |
| `npm run migrate:rollback` | Rollback migration terakhir |
| `npm run migrate:make -- <name>` | Membuat migration |
| `npm run seed` | Menjalankan Knex seed jika tersedia |
| `npm run abi:sync` | Build contract offline dan sinkronkan ABI |

## Sinkronisasi ABI

```bash
npm run abi:sync
```

Jalankan setelah interface contract berubah dan perbarui address jika perubahan memerlukan deployment baru.

## Keamanan dan batasan

- Jangan commit `.env`, private key, JWT secret, atau Supabase service role key.
- Gunakan private bucket untuk bukti perjalanan.
- Gambar tiket dan data pribadi tetap off-chain.
- AI dapat salah membaca tiket dan belum menggantikan fraud detection menyeluruh.
- Public distance provider memiliki rate limit dan tidak menjamin uptime.
- Voucher migration adalah data demo, bukan benefit merchant production.
- Backend ditujukan untuk MVP testnet dan memerlukan security review sebelum production.
