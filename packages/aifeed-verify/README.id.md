# @aifeed/verify

<p><a href="README.md">English</a> · <a href="README.id.md">Bahasa Indonesia</a> · <a href="README.zh.md">中文</a></p>

Verifier tanpa dependensi untuk **protokol AIFeed** — deklarasi konten AI-Web bertanda
tangan dan profil kontennya.

## 1-Menit Quickstart

```bash
npm install @aifeed/verify
```

```js
const { verifyRemote } = require('@aifeed/verify');
const out = await verifyRemote('example.com');   // discovery → tanda tangan → anchor DNS
console.log(out.result, out.anchor.status);      // VERIFIED anchored
```

TypeScript: `import { verifyRemote } from '@aifeed/verify';`

Yang diverifikasi:

- **Manifest** (`/.well-known/ai.json`, v0.1/v0.2) dengan verifikasi Ed25519 + JCS
- **Profil konten native AIFeed Markdown** (`text/aifeed+markdown`, `.aifeed.md`)
- **Profil kompatibilitas MAKO** (`text/mako+markdown`) dengan lapisan trust AIFeed
- **Indeks delta** (`/.well-known/aifeed-index.json` / `mako-index.json`) dengan digest
  SHA-256 per entri serta metadata situs/triage
- Dokumen **revokasi** (multi-tanda-tangan) dan **bundel offline**
- Integritas transport **Content-Digest** (RFC 9530)
- **Pemilihan triage** (`selectEntries`) untuk memilih halaman dalam budget token

Membutuhkan Node.js >= 20. Tanpa dependensi runtime.

## Instalasi

```bash
npm install @aifeed/verify
```

## Mulai cepat

### Verifikasi manifest (byte offline)

```js
const sdk = require('@aifeed/verify');

const result = sdk.verifyAll({
  manifestText: fs.readFileSync('ai.json', 'utf8'),
  manifestBytes: fs.readFileSync('ai.json'),
  signatureText: fs.readFileSync('ai-signature.json', 'utf8'),
  domain: 'example.com'
});
console.log(result.result, result.errors);
```

### Fetch dan verifikasi konten native (AIFeed Markdown)

```js
const content = await sdk.fetchAimd('https://example.com/artikel', {
  publicKeyValue: 'ed25519:...' // dari manifest terverifikasi
});
if (content.mako_verified) {
  console.log(content.frontmatter.entity, content.tokens);
}
// MAKO bekerja sama: sdk.fetchMako(url, options)
// atau sdk.fetchMako(url, { mediaType: 'text/aifeed+markdown' })
```

### Konsumsi delta

```js
const delta = await sdk.fetchIndexDelta('https://example.com/.well-known/aifeed-index.json', {
  storedDigests: { '/artikel/a': '<sha-256 from last run>' }
});
const picked = sdk.selectEntries(delta.entries, { query: 'aifeed mako', maxTokens: 4000 });
for (const entry of picked.selected) {
  // fetch hanya yang berubah / penting
}
```

### Verifikasi dokumen offline

```js
const verified = sdk.verifyAimdDocument({
  pageUrl: 'https://example.com/artikel',
  makoBytes,                  // byte persis seperti disajikan
  containerText,              // JSON kontainer tanda tangan
  manifestFragment            // { public_key, content_mako, permissions }
});
```

## API

| Ekspor | Kegunaan |
|---|---|
| `verifyAll`, `verifyDirectory`, `checkManifest` | Verifikasi manifest (v0.1/v0.2) |
| `fetchMako`, `fetchAimd` | Negosiasi konten dengan verifikasi tanda tangan opsional |
| `fetchIndexDelta` | Fetch indeks + diff perubahan terhadap digest tersimpan |
| `selectEntries` | Pemeringkatan kata kunci dengan budget `maxPages` / `maxTokens` |
| `verifyMakoDocument`, `verifyAimdDocument` | Verifikasi dokumen offline per profil |
| `verifyMakoIndex`, `verifyAimdIndex` | Validasi tanda tangan indeks + digest |
| `mako.*` | Parser, primitif sign/verify, resolusi izin, konstanta |
| `verifyRevocationDocument`, `revocation.*` | Pemeriksaan revokasi registry |
| `createBundle`, `verifyBundle` | Bundel audit offline |
| `digest.*` | Helper SHA-256/512 dan Content-Digest RFC 9530 |
| `AIMD_MEDIA_TYPE`, `MAKO_MEDIA_TYPE` | Konstanta media type |

Deklarasi TypeScript disertakan di `index.d.ts`.

## Lisensi

MIT. Vektor uji CC0. Spesifikasi: CC BY 4.0.
