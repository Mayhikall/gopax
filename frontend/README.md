# Gopax frontend

Implementasi struktur bagian 7 `frontend-plan-gopax.md`: Next.js App Router, TypeScript, Tailwind CSS dengan semantic CSS tokens, shadcn-style Button, TanStack Query, wagmi, viem, dan RainbowKit. Desain menggunakan skill lokal `emil-design-eng` dan `make-interfaces-feel-better`.

## Menjalankan

Dari direktori `frontend`:

```sh
npm ci
npm run dev
```

Buka `http://localhost:3000`. Pilih **Explore the design preview**, atau buka `http://localhost:3000/preview`. Preview tidak memerlukan wallet maupun backend. Semua angka preview adalah fixture yang dilabeli; file yang dipilih di preview tidak diunggah, dan tombol claim tidak mengirim transaksi.

Pilihan **Preview state** menyediakan akun kosong, processing, assessment unavailable, no reward, no comparison, negative comparison, zero savings, small values, long route names, loading, dan service error. Gunakan pilihan tersebut pada Home/Impact/Trips atau detail sample sesuai state yang ingin dilihat. Navigasi antarhalaman kembali ke dataset default.

Preview tersedia otomatis pada development. Pada production, `/preview` mengembalikan not found kecuali `NEXT_PUBLIC_ENABLE_PREVIEW=true` disetel secara eksplisit saat build.

## Koneksi live

Salin `.env.example` ke `.env.local`, lalu cocokkan nilai dengan backend/deployment yang digunakan:

- `NEXT_PUBLIC_API_URL`: URL backend; contoh lokal `http://localhost:3001`.
- `NEXT_PUBLIC_CHAIN_ID`: `97`, sesuai BSC Testnet yang didukung MVP.
- `NEXT_PUBLIC_GOPAX_TOKEN_ADDRESS` dan `NEXT_PUBLIC_REWARD_MANAGER_ADDRESS`: alamat deployment yang dipercaya.
- `NEXT_PUBLIC_RPC_URL`: endpoint RPC BSC Testnet.
- `NEXT_PUBLIC_SIWE_DOMAIN` dan `NEXT_PUBLIC_SIWE_URI`: sama dengan konfigurasi SIWE backend dan origin frontend. Untuk contoh env, buka frontend melalui `localhost`, bukan `127.0.0.1`.
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`: opsional; tanpa nilai ini frontend menggunakan injected wallet. Isi untuk koneksi WalletConnect/mobile.

Restart dev server setelah mengubah environment. Semua `NEXT_PUBLIC_*` terlihat oleh browser. Konfigurasi API kosong menghasilkan pesan setup; kontrak yang tidak valid menonaktifkan saldo/claim. Koneksi live tidak beralih otomatis ke fixture.

## Struktur

```text
src/
  app/                    landing, onboarding, protected routes, preview, errors
  components/
    ui/                   Button primitive
    layout/               shell, page header, preview context
    brand/                wordmark dan route SVG
    feedback/             loading, empty, error
    common.tsx            status/transport UI dan shared exports
  features/
    auth/                 session memory, SIWE, route guard, safe redirects
    trips/                list/query, filter, upload, route ticket/detail
    impact/               Home, all-time Impact, metrics, transport mix
    rewards/              balance, assessment, claim dan receipt recovery
    profile/              form, wallet identity, network/disconnect
  lib/
    api/                  authenticated request/error handling
    web3/                 config dan ABI dari artifacts backend
    format.ts             nullable decimal, kalender, wallet formatting
  types/                  DTO/domain types
  fixtures/               sample journeys khusus preview
```

`/home`, `/impact`, `/trips`, `/trips/new`, `/trips/[id]`, dan `/profile` dilindungi session JWT dan onboarding. JWT hanya berada di memory; refresh membutuhkan sign-in kembali dan mempertahankan tujuan internal yang valid. Pergantian wallet/disconnect/401 membersihkan cache, membatalkan request session lama, dan menolak respons yang terlambat.

## Perilaku integrasi

Upload memakai multipart field `proof`, satu JPEG/PNG maksimal 10 MiB. Preview file menggunakan object URL dengan cleanup ketika diganti/dilepas. POST tidak diulang otomatis. Respons 201/202 membuka detail dengan ID dari backend; alasan processing sementara disimpan dalam query cache. Timeout menampilkan tautan untuk memeriksa Trips karena server mungkin sudah menyimpan hasil.

Reward, emitted, saved, comparison, serta agregat impact berasal dari backend. Nilai null tidak diubah menjadi nol. Status trip dan reward ditampilkan terpisah. Saldo GOPAX dibaca melalui `balanceOf` dan `decimals` token; saldo bukan total available/claimed. Chart transport mempunyai label jumlah trip sebagai alternatif tekstual.

Claim memeriksa recipient, assessment, reward ID, chain, manager, token, deadline, policy dan claimed state. Enam argumen diteruskan dari authorization backend tanpa menghitung ulang emisi atau menggandakan konversi token. Transaksi disimulasikan sebelum meminta tanda tangan, mengikuti [pola simulateContract viem](https://viem.sh/docs/contract/simulateContract).

Sesudah broadcast, frontend menyimpan `{ wallet, chainId, tripId, rewardId, assessmentHash, txHash }`. Receipt dan event reward yang cocok diperlukan sebelum confirmation API. Replacement hash diperbarui; transaksi cancelled/reverted tidak dianggap berhasil. Jika receipt berhasil tetapi API gagal, **Sync history** hanya mengulang confirmation. Sesudah refresh, **Check transaction** melanjutkan pemeriksaan hash tersimpan. **Already sent a transaction?** menerima hash lama untuk recovery jika storage lokal hilang. Backend tetap melakukan validasi authoritative.

## Verifikasi

```sh
npm run lint
npm run typecheck
npm run build
npm run abi:sync   # hanya ketika ABI artifacts backend berubah
```

Pemeriksaan visual/interaksi dan batas pengujian dicatat di [UI-REVIEW.md](UI-REVIEW.md). Production build dapat menampilkan warning dependensi native opsional MetaMask (`@react-native-async-storage/async-storage`); package tersebut berasal dari dependency tree wallet, bukan modul yang dipanggil layar aplikasi.

Pengujian end-to-end dengan backend aktif dan wallet BSC Testnet tetap diperlukan untuk SIWE, onboarding/profile live, upload/provider retry live, balance RPC, gas rejection, pending/replacement/reload, dan confirmation recovery. Sesi implementasi ini tidak mengirim transaksi blockchain.
