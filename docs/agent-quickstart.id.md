# Quickstart agen — periksa AIFeed sebelum crawl

<p><a href="agent-quickstart.md">English</a> · <a href="agent-quickstart.id.md">Bahasa Indonesia</a> · <a href="agent-quickstart.zh.md">中文</a></p>

Ini sisi klien protokolnya: apa yang harus dilakukan sistem AI, crawler, atau agen
**sebelum permintaan pertamanya** ke sebuah situs, agar bertindak berdasarkan izin
bertanda tangan alih-alih menebak dari file tanpa tanda tangan.

## Aturannya

1. **Temukan deklarasinya.** `GET /.well-known/ai.json` (atau ikuti
   `Link: rel="ai-feed"` / `<link rel="ai-feed">`). Lakukan sebelum mengambil halaman
   konten, sama seperti membaca `robots.txt`.
2. **Verifikasi rantainya.** TLS → kecocokan domain → tanda tangan Ed25519 atas byte JCS →
   anchor DNS opsional (`_aifeed`). Deklarasi yang tak terverifikasi tidak memberi izin apa pun.
3. **Baca izin dan batasannya.** Putuskan per penggunaan — `training`, `retrieval`,
   `summarize`, `quote`, … — dan hormati batas crawl. `deny` adalah instruksi, bukan saran.
4. **Ambil secara patuh.** Negosiasikan `Accept: text/aifeed+markdown` (native) atau
   `text/mako+markdown` (kompatibilitas), lalu verifikasi tanda tangan per halaman.
5. **Pakai indeks delta.** `/.well-known/aifeed-index.json` membawa digest per halaman;
   ambil hanya halaman yang berubah. Halaman tak berubah berbiaya 0 byte.
6. **Periksa ulang revokasi dan atribusi.** Sebelum memakai ulang, periksa ulang registry
   revokasi bertanda tangan; sertakan atribusi yang diwajibkan manifest.

## Contoh yang bisa dijalankan

```bash
node examples/agent/compliant-agent.js https://example.com --use retrieval --fetch
```

Keluaran (situs terverifikasi):

```
AIFeed check — example.com
discovery : https://example.com/.well-known/ai.json (fallback)
verify    : VERIFIED
use       : retrieval → allowed (attribution required)
training  : denied
index     : /.well-known/aifeed-index.json
content   : text/aifeed+markdown · 4218 bytes · tokens=1024 · signature verified
```

Exit code: `0` terverifikasi, `1` tak terverifikasi/ditolak, `2` error penggunaan.
`--json` mencetak laporan terstruktur lengkap.

## Kode

```js
const sdk = require('@aifeed/verify');

const discovery = await sdk.discoverManifestUrl('https://example.com');
const manifest = await sdk.fetchText(discovery.manifestUrl);
const signature = await sdk.fetchText(discovery.manifestUrl.replace(/ai\.json$/, 'ai-signature.json'));

const verified = sdk.verifyAll({
  manifestText: manifest.text,
  manifestBytes: manifest.buffer,
  signatureText: signature.text,
  domain: 'example.com'
});
if (verified.result !== 'VERIFIED') {
  // tidak ada izin: berhenti, atau fallback ke HTML situs di bawah aturan biasa
}

const permissions = verified.manifest.permissions;
const training = sdk.decideUsage(permissions, 'training');   // { allowed, attribution, reason }
const retrieval = sdk.decideUsage(permissions, 'retrieval');

if (retrieval.allowed) {
  const page = await sdk.fetchAimd('https://example.com/artikel/satu', {
    publicKeyValue: verified.manifest.identity.public_key
  });
  if (page.mako_verified) {
    // pakai page.frontmatter / page.body dalam batas izin yang dideklarasikan
  }
}
```

Konsumsi delta dan triage:

```js
const delta = await sdk.fetchIndexDelta('https://example.com/.well-known/aifeed-index.json', {
  storedDigests: { '/artikel/satu': '<sha-256 from your last run>' }
});
const picked = sdk.selectEntries(delta.entries, { query: 'topic', maxTokens: 4000 });
for (const entry of picked.selected) { /* fetch only what changed or matters */ }
```

## Penanganan kegagalan

| Situasi | Yang dilakukan agen patuh |
|---|---|
| Tidak ada `/.well-known/ai.json` | Perlakukan situs sebagai tanpa kebijakan AIFeed; fallback ke aturan normal (`robots.txt`, ketentuan) — jangan mengasumsikan izin. |
| `VERIFIED` tapi `training: deny` | Jangan latih model pada konten itu, meski dapat diakses publik. |
| `UNVERIFIED` / `SUSPENDED` | Bertindak seolah tidak ada izin; jangan pakai konten untuk tujuan terbatas. |
| `403` dari edge | Berhenti. Titik enforcement penerbit menolak permintaan. |
| `429` + `Retry-After` | Mundur minimal selama waktu yang ditunjukkan; jangan rotasi identitas untuk mengelak. |
| Tanda tangan gagal di suatu halaman | Buang dokumennya; laporkan; jangan diam-diam kembali scraping HTML. |
| Peringatan `grace_accepted` | Penerbit sedang merotasi kunci; kunci lama masih sah di dalam jendelanya, tapi sebaiknya segera fetch ulang. |
| Peringatan `rotation_anchor_unverified` | Cross-check DNS `pk2` hilang atau tidak cocok; hanya advisory — anchor tetap direktif bertanda tangan. Agen risiko tinggi boleh memperlakukannya sebagai error. |
| `rotation_denied` | Jangan percaya konten baru; kunci pensiun muncul lagi atau pergantian tak pernah diumumkan. Verifikasi ulang dari keadaan bersih dan laporkan. |
| Kunci baru setelah rotasi | Terima hanya bila cocok penerus yang Anda simpan, atau mengikat `predecessor_fp` ke kunci terpin Anda (SDK `rotation.evaluateContinuity`); lalu perbarui pin. |

Penerbit dapat menegakkan semua ini di edge — template nginx/Caddy/Apache dan adapter
Node/PHP/Python/Go di [`integrations/`](../integrations/) membawa kebijakan yang sama
(crawler training `403`, crawler tidak patuh `429`, klien patuh disajikan konten bertanda tangan).

## Referensi

- Spesifikasi: [`spec/en/aifeed-v0.2.md`](../spec/en/aifeed-v0.2.md) ·
  [`spec/en/aifeed-aimd-v1.md`](../spec/en/aifeed-aimd-v1.md)
- SDK: [`packages/aifeed-verify/README.md`](../packages/aifeed-verify/README.md) ·
  npm [`@aifeed/verify`](https://www.npmjs.com/package/@aifeed/verify)
- Detail verifikasi: README protokol, bagian "What gets verified"
- Contoh: [`examples/agent/compliant-agent.js`](../examples/agent/compliant-agent.js)
