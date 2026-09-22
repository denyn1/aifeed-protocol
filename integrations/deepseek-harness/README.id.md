# Plugin AIFeed untuk DeepSeek Harness

[English](README.md) · [Bahasa Indonesia](README.id.md) · [中文](README.zh.md)

Plugin Cordis yang memberi DeepSeek Harness enam tool yang bisa dipanggil model untuk
bekerja dengan [AIFeed](https://aifeed.md): izin konten bertanda tangan untuk web AI.
Plugin ini memakai mesin tanpa dependensi yang sama dengan
[`aifeed-mcp-server`](../../packages/aifeed-mcp-server) — salinan `engine/` (`server.js`, `lib`, `schema`)
di-generate dengan `npm run build:harness` dari root repositori.

## Tool

| Tool | Fungsinya |
|---|---|
| `aifeed_verify_manifest` | Verifikasi manifest: tanda tangan, anchor DNS `_aifeed`, hasil (VERIFIED/UNVERIFIED) |
| `aifeed_fetch_aifeed` | Ambil halaman sebagai AIFeed Markdown/MAKO berbujet token dengan izin + cek tanda tangan opsional |
| `aifeed_list_assets` | Daftar gambar/video/dokumen yang dideklarasikan halaman bertanda tangan |
| `aifeed_verify_asset` | Unduh aset yang dideklarasikan dan cek ukuran/sha-256 |
| `aifeed_select_index` | Peringkat entri indeks delta bertanda tangan dalam bujet halaman/token |
| `aifeed_decide_usage` | Putuskan apakah suatu penggunaan (retrieval, training, …) diizinkan |

## Pemasangan

```sh
dsh plugin --profile web add @aifeed/deepseek-harness
dsh --profile web --dump-config   # memperlihatkan layer bundle
dsh web
```

Paket ini membawa layer bundle (`cordis.patch.yml`), jadi tool langsung aktif begitu profil
mencantumkannya. Untuk mencoba dari checkout:

```sh
dsh plugin --profile demo add ./integrations/deepseek-harness
```

Lalu minta agen, misalnya: `Use aifeed_decide_usage for shop.aifeed.md with usage "training".`

## Konfigurasi

| Opsi | Default | Keterangan |
|---|---|---|
| `allowPrivate` | `false` | Izinkan origin `http://` loopback untuk pengujian lokal (menyetel `AIFEED_MCP_ALLOW_PRIVATE=1` di proses harness) |

Hanya origin `https://` yang diambil secara default. Pembatalan mengikuti `exec.signal`
harness pada batas pemanggilan; fetch yang sedang berjalan selesai menurut timeout-nya sendiri.

## Pengembangan

Salinan mesin (`engine/server.js`, `engine/lib/`, `engine/schema/`, `LICENSE`) di-generate dari
`packages/aifeed-mcp-server/`:

```sh
npm run build:harness    # regenerasi
npm run harness:check    # pastikan sinkron
```
