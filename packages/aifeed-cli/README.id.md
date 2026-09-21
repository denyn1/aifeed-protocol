# aifeed

<p><a href="README.md">English</a> · <a href="README.id.md">Bahasa Indonesia</a> · <a href="README.zh.md">中文</a></p>

CLI protokol AIFeed: deklarasikan, tandatangani, dan cabut izin konten untuk agen AI —
lalu biarkan agen mana pun memverifikasinya. Tanpa dependensi, Node ≥ 20.

## 1-Menit Quickstart

### Tandatangani situs yang sudah Anda deploy

```bash
npx aifeed keygen --out .aifeed
npx aifeed site build ./public --domain example.com --key .aifeed/aifeed-private.pem --llms --inject
# deploy ./public apa adanya: .well-known/ai.json, *.aifeed.md, *.mako.md, *.sig, llms.txt
```

> Shell Windows kadang memblokir shim `npx` yang baru (`'aifeed' is not recognized`):
> jalankan `npm install -g aifeed` sekali, lalu gunakan `aifeed …` langsung.

### Atau scaffold manifest bertanda tangan (kunci termasuk)

```bash
npx aifeed init --domain example.com --dir ./site
npx aifeed validate ./site --domain example.com
```

`init` menulis `aifeed-private.pem`, `.well-known/ai.json`,
`.well-known/ai-signature.json`, dan `aifeed-setup.txt` (record DNS + snippet host).

### Tanda tangani ulang setelah manifest diedit

```bash
npx aifeed sign ./site/.well-known/ai.json   # menemukan kunci di sebelah situs
```

### Verifikasi domain live end-to-end

```bash
npx aifeed validate example.com --require-dns-anchor
# TLS → tanda tangan → anchor DNS _aifeed → registri revokasi
```

## Verifikasi 3 baris (sisi konsumen/AI)

```bash
npm install @aifeed/verify
```

```js
const { verifyRemote } = require('@aifeed/verify');
const out = await verifyRemote('example.com');
console.log(out.result, out.anchor.status); // VERIFIED anchored
```

TypeScript: `import { verifyRemote } from '@aifeed/verify';`

## Perintah

| Perintah | Fungsi |
|---|---|
| `aifeed keygen --out DIR` | Buat pasangan kunci Ed25519 (`aifeed-private.pem`, `aifeed-public.txt`) |
| `aifeed init --domain D --dir DIR` | Kunci + manifest bertanda tangan + panduan setup dalam satu langkah |
| `aifeed sign <ai.json>` | Tandatangani (atau tanda tangani ulang) manifest; verifikasi sebelum menulis |
| `aifeed validate <domain\|DIR\|FILE>` | Verifikasi rantai kepercayaan; `--require-dns-anchor` untuk domain live |
| `aifeed rotate --dir DIR` | Ganti kunci penanda tangan dengan jendela overlap terbatas |
| `aifeed site build <DIR> --domain D --key FILE` | Tandatangani seluruh situs statis: halaman, indeks, `llms.txt` |
| `aifeed bundle create\|verify` | Bundel audit offline untuk verifikasi air-gapped |
| `aifeed mako generate\|sign\|verify\|index\|fetch` | Tools konten AIFeed Markdown / MAKO (alias `aifeed aimd …`) |
| `aifeed import-openapi <spec.json>` | Draf capabilities/actions agen dari spec OpenAPI |

Jalankan `npx aifeed --help` untuk permukaan lengkap.

## Yang Anda publikasikan

Manifest bertanda tangan di `/.well-known/ai.json` plus berkas per halaman
`path.aifeed.md` / `path.mako.md` dengan sidecar `.sig` dan indeks delta — semuanya
dapat diverifikasi offline. Agen menemukannya via DNS (`_aifeed` TXT) atau
`/.well-known/`.

## Langkah berikutnya

- Spesifikasi: [`spec/id/aifeed-v0.2.md`](https://github.com/denyn1/aifeed-protocol/blob/main/spec/id/aifeed-v0.2.md)
- Adapter host (nginx, Caddy, Apache, Node, Next.js, PHP, Python, Go, Traefik, Cloudflare):
  [`integrations/`](https://github.com/denyn1/aifeed-protocol/tree/main/integrations)
- Panduan penerbit untuk agen AI: [`docs/publisher-ai-guide.id.md`](https://github.com/denyn1/aifeed-protocol/blob/main/docs/publisher-ai-guide.id.md)
- Plugin build Vite/Astro/Next.js: [`@aifeed/frameworks`](https://www.npmjs.com/package/@aifeed/frameworks)
- UI penerbit lokal (AIFeed Studio): `npm run studio` di repositori

## Sumber

Bagian dari [aifeed-protocol](https://github.com/denyn1/aifeed-protocol)
(`packages/aifeed-cli`; `bin/`, `lib/`, `schema/` salinan hasil generate dari
implementasi referensi via `npm run build:cli`).
