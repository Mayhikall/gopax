# Gopax Frontend

Frontend Gopax dibangun dengan Next.js App Router, React, TypeScript, Tailwind CSS, TanStack Query, RainbowKit, wagmi, dan viem. Aplikasi menyediakan autentikasi wallet, upload bukti perjalanan, dashboard impact, claim GOPAX, serta penukaran GOPAX dengan voucher.

Dokumentasi project secara keseluruhan tersedia di [README utama](../README.md).

## Fitur

- Connect wallet dan Sign-In with Ethereum (SIWE).
- Onboarding dan profil pengguna.
- Upload tiket/struk JPEG atau PNG maksimum 10 MiB.
- Daftar, filter, dan detail perjalanan.
- Estimasi emisi, perbandingan, dan dashboard impact.
- Simulasi, pengiriman, dan pemulihan transaksi claim GOPAX.
- Saldo GOPAX dari wallet.
- Katalog voucher, approve token, redemption, dan riwayat voucher.
- Preview fixture tanpa wallet atau backend.

## Menjalankan

```bash
cd frontend
npm ci
cp .env.example .env.local
npm run dev
```

Buka `http://localhost:3000`. Frontend menggunakan port `3000` secara eksplisit.

## Konfigurasi

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_CHAIN_ID=97
NEXT_PUBLIC_GOPAX_TOKEN_ADDRESS=0x...
NEXT_PUBLIC_REWARD_MANAGER_ADDRESS=0x...
NEXT_PUBLIC_TREASURY_ADDRESS=0x...
NEXT_PUBLIC_RPC_URL=https://bsc-testnet-dataseed.bnbchain.org
NEXT_PUBLIC_SIWE_DOMAIN=localhost
NEXT_PUBLIC_SIWE_URI=http://localhost:3000
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
NEXT_PUBLIC_ENABLE_PREVIEW=false
```

Semua variable `NEXT_PUBLIC_*` dapat dilihat browser. Jangan menyimpan private key atau secret di frontend. Address token, manager, dan treasury harus berasal dari deployment yang sama.

## Halaman

| Route | Fungsi | Session |
| --- | --- | --- |
| `/` | Landing, connect wallet, dan SIWE | Tidak |
| `/onboarding` | Melengkapi profil | Ya |
| `/home` | Ringkasan perjalanan dan reward | Ya |
| `/impact` | Agregat impact dan transport mix | Ya |
| `/trips` | Daftar dan filter perjalanan | Ya |
| `/trips/new` | Upload bukti perjalanan | Ya |
| `/trips/[id]` | Detail assessment dan claim | Ya |
| `/rewards` | Katalog dan riwayat voucher | Ya |
| `/profile` | Profil, wallet, saldo, dan network | Ya |
| `/preview` | Sample journey tanpa backend/wallet | Tidak |

JWT hanya disimpan di memory. Refresh halaman memerlukan sign-in ulang. Pergantian wallet, disconnect, atau respons `401` membersihkan session dan query cache.

## Struktur

```text
src/
  app/                    routes, layout, providers, preview, error pages
  components/             UI, layout, brand, dan feedback
  features/
    auth/                 SIWE, session, guard, safe redirect
    trips/                upload, query, list, dan detail
    impact/               home, metrics, transport mix
    rewards/              balance, claim recovery, dan voucher
    profile/              profile, wallet, network, disconnect
  lib/
    api/                  authenticated API client
    web3/                 wagmi config dan ABI
  fixtures/               data khusus preview
  types/                  DTO dan domain types
```

## Integrasi trip dan claim

Upload menggunakan multipart field `proof`. Hanya satu JPEG/PNG maksimum 10 MiB yang diterima. Request `POST` tidak diulang otomatis karena server mungkin sudah menyimpan perjalanan ketika client mengalami timeout.

Nilai reward, emission, comparison, dan impact berasal dari backend. Nilai `null` tidak ditampilkan sebagai nol. Saldo GOPAX dibaca melalui `balanceOf` dan berbeda dari total reward available atau claimed.

Sebelum claim, frontend memeriksa wallet, recipient, chain, address contract, assessment, deadline, policy, dan claimed state. Transaksi disimulasikan sebelum wallet diminta menandatangani. Konteks transaksi disimpan untuk menangani reload, replacement transaction, receipt berhasil tetapi API gagal, dan sinkronisasi ulang history.

## Integrasi voucher

Jika allowance belum cukup, pengguna lebih dulu memberi allowance GOPAX kepada `RewardManager`. Setelah `redeemVoucher(voucherId, amount)` berhasil, frontend mengirim `voucherId` dan `txHash` ke backend. Backend memverifikasi event, wallet, voucher, serta jumlah sebelum mengeluarkan kode.

`NEXT_PUBLIC_TREASURY_ADDRESS` harus cocok dengan treasury deployment. Katalog development berasal dari migration backend dan bukan benefit merchant production.

## Preview

`http://localhost:3000/preview` menampilkan sample journey dan kondisi UI tanpa koneksi live. File tidak diunggah dan tombol claim/redemption tidak mengirim transaksi. Preview selalu tersedia pada development; production memerlukan `NEXT_PUBLIC_ENABLE_PREVIEW=true` saat build.

## Verifikasi

```bash
npm run lint
npm run typecheck
npm run build
```

Setelah interface contract berubah:

```bash
npm run abi:sync
```

Pengujian end-to-end tetap perlu dilakukan dengan backend, database, provider AI, wallet, dan BSC Testnet aktif.
