# @aifeed/frameworks

Plugin build drop-in yang mengubah output statis Anda menjadi origin
[AIFeed](https://aifeed.md) — manifest bertanda tangan, AIFeed Markdown/MAKO per halaman,
indeks delta, dan `llms.txt` — tanpa memanggil CLI secara manual.

```bash
npm install --save-dev @aifeed/frameworks@next
npx aifeed-build keygen --out .aifeed   # sekali per proyek
```

## Vite

```js
// vite.config.js
import { aifeed } from '@aifeed/frameworks/vite';

export default {
  plugins: [aifeed({ domain: 'example.com', keyPath: '.aifeed/aifeed-private.pem' })]
};
```

Berjalan setelah `vite build` (`closeBundle`), membaca `build.outDir`, menandatangani
setiap halaman HTML, dan menyuntikkan `<link rel="alternate" type="text/aifeed+markdown">`
agar agen menemukan endpoint markdown di host statis mana pun.

## Astro

```js
// astro.config.mjs
import aifeed from '@aifeed/frameworks/astro';

export default {
  integrations: [aifeed({ domain: 'example.com', keyPath: '.aifeed/aifeed-private.pem' })]
};
```

Berjalan pada `astro:build:done` dan menandatangani direktori output.

## Next.js (`output: 'export'`)

```js
// next.config.js
const { withAifeed } = require('@aifeed/frameworks/next');

module.exports = withAifeed({ output: 'export' }, { domain: 'example.com' });
```

```jsonc
// package.json — npm menjalankan "postbuild" otomatis setelah "build"
{ "scripts": { "build": "next build", "postbuild": "aifeed-next --domain example.com --key .aifeed/aifeed-private.pem" } }
```

Next.js tidak punya hook post-export resmi, jadi `withAifeed()` memvalidasi konfigurasi
dan memberi peringatan bila `output !== 'export'`, sedangkan bin `aifeed-next` melakukan
penandatanganan setelah export selesai (direktori default: `out/`).

## Generator lain (Hugo, Eleventy, Jekyll, HTML polos)

```bash
npx aifeed-build ./public --domain example.com --key .aifeed/aifeed-private.pem
npx aifeed-build ./public --domain example.com --profile both --no-inject --json
```

## Yang ditulis

| Artefak | Lokasi |
|---|---|
| Manifest + tanda tangan | `.well-known/ai.json`, `.well-known/ai-signature.json` |
| Indeks delta (+ tanda tangan) | `.well-known/aifeed-index.json` (dan `mako-index.json` untuk `profile: both`) |
| Markdown per halaman + `.sig` | `path.aifeed.md`, `path.mako.md` di samping tiap HTML |
| Discovery | `<link rel="alternate">` di HTML (kecuali `inject: false`), `llms.txt` |

## Opsi

| Opsi | Default | Catatan |
|---|---|---|
| `domain` | `AIFEED_DOMAIN` | wajib |
| `keyPath` | `aifeed-private.pem` (`AIFEED_KEY`) | PEM PKCS#8 Ed25519 |
| `baseUrl` | `https://<domain>` (`AIFEED_BASE_URL`) | isi untuk deploy subpath |
| `profile` | `aimd` | `aimd` \| `mako` \| `both` |
| `inject` | `true` | tambah `<link rel="alternate">` ke HTML hasil build |
| `llms` | `true` | tulis `llms.txt` |
| `prune` | `true` | hapus artefak generate basi sebelum build ulang |
| `verifyAfter` | `true` | verifikasi sendiri tanda tangan/digest; gagalkan build bila diubah |
| `name`, `type`, `locale`, `contact`, `keyId`, `updated` | default CLI | metadata manifest |
| `permissions`, `limits`, `license`, `sitemap`, `maxCheckIntervalHours` | default manifest | bidang kebijakan |

## Catatan

- Kunci tidak pernah meninggalkan mesin Anda selama build; tidak ada yang diunggah.
- `inject: false` untuk host yang sudah menegosiasikan `Accept: text/aifeed+markdown`
  (nginx, Caddy, Apache, Cloudflare — lihat `integrations/` di repositori).
- Build ulang idempoten: tanda tangan diperbarui, injeksi tautan tidak terduplikasi, dan
  berkas yang dipangkas dibuat ulang dari HTML terkini.
- Tanpa dependensi; Node ≥ 20. Mesin verifikasi dibundel dari implementasi referensi
  (`npm run build:fw` di repositori).

## Sumber

Bagian dari [aifeed-protocol](https://github.com/denyn1/aifeed-protocol)
(`packages/aifeed-frameworks`). Spesifikasi: `spec/id/`; panduan penerbit:
[`docs/publisher-ai-guide.id.md`](../../docs/publisher-ai-guide.id.md).
