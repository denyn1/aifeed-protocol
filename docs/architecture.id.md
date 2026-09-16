# Arsitektur

<p><a href="architecture.md">English</a> · <a href="architecture.id.md">Bahasa Indonesia</a> · <a href="architecture.zh.md">中文</a></p>

Bagaimana AIFeed disusun, apa yang dimiliki tiap lapisan, dan di mana memperluasnya.
Untuk aturan alur kerja agen/manusia lihat [`../AGENTS.md`](../AGENTS.md); untuk mekanika
rilis lihat [`release.md`](release.md).

## Satu paragraf

Penerbit menandatangani **manifest** (JSON kanonik-JCS, Ed25519) yang disajikan di
`/.well-known/ai.json`, meng-anchor public key-nya di DNS (TXT `_aifeed`), dan opsional
menyajikan **profil konten** per halaman (*AIFeed Markdown* native, *MAKO* kompatibilitas)
plus **indeks delta** bertanda tangan. Klien memverifikasi rantai dan tanda tangan per
halaman secara offline, menghormati izin dan batas crawl, dan memeriksa ulang registry
**revokasi** multi-tanda-tangan. Tanpa dependensi runtime di mana pun.

## Lapisan

| Lapisan | Kode | Tanggung jawab |
|---|---|---|
| Kripto & encoding | `lib/crypto.js`, `lib/jcs.js`, `lib/digest.js` | Ed25519 (RFC 8032) atas byte JCS (RFC 8785); digest SHA-256; string konteks |
| Parsing ketat | `lib/parse.js`, `lib/schema.js` | Kunci duplikat, NFC, batas integer, batas kedalaman; pemeriksaan berbasis schema |
| Validasi | `lib/validate.js` | Pemeriksaan manifest/tanda tangan, level trust, warning vs error |
| Profil konten | `lib/mako.js`, `lib/mako-html.js` | Subset YAML aman, penandatanganan dokumen, pengikatan izin, indeks delta, konversi HTML→profil |
| Transport | `lib/remote.js` | Fetch HTTPS dengan pinning, opsi TLS, discovery, lookup anchor DNS |
| Dokumen trust | `lib/revocation.js`, `lib/bundle.js` | Revokasi multi-tanda-tangan, staleness terbatas, bundel offline |
| Tooling penerbit | `lib/scaffold.js`, `lib/site.js`, `bin/cli.js` | Scaffolding manifest, site builder statis, permukaan CLI |
| SDK | `packages/aifeed-verify/index.js`, `.d.ts` | API klien; `lib/` + `schema/` di dalam paket adalah salinan hasil generate |
| Verifier independen | `clients/python/` | Konformansi diferensial dalam bahasa kedua (hanya stdlib) |
| Adapter | `integrations/` | nginx, Caddy, Apache, Node, Next.js, PHP, Python ASGI, Go, GitHub Action |
| Penerbit WordPress | `wp-plugin/` | UI admin, manajemen kunci, penyajian dual-stack, `/llms.txt` |
| Generator & pemeriksa | `tools/` | Vektor, benchmark, laporan HTML, fuzzer, site builder, generator demo, pemeriksa live, cek konsistensi |
| Origin demo | `demos/`, `tools/gen-demos.js` | Tujuh situs demo bertanda tangan + artefak apex; kunci deterministik publik |
| Routing edge | `functions/` | Cloudflare Pages Function: `<sub>.aifeed.md` → `site/demos/<sub>/`, CORS, `strict` 403/429 |
| Sumber kebenaran | `spec/`, `schema/`, `conformance/` | Teks normatif, schema, vektor |

## Konteks tanda tangan

Setiap artefak bertanda tangan mendeklarasikan konteksnya; replay lintas konteks dan
lintas URL ditolak by design.

| Artefak | String konteks | Cakupan |
|---|---|---|
| Manifest v0.2 | `aifeed.v0.2\n` | JCS(manifest) |
| Manifest v0.1 | `aifeed.v0.1\n` | JCS(manifest) |
| Halaman AIFeed Markdown | `aifeed.aimd.v1\n` | url + LF + byte mentah |
| Indeks AIFeed Markdown | `aifeed.aimd-index.v1\n` | url + LF + byte mentah |
| Halaman MAKO | `aifeed.mako.v0.2\n` | url + LF + byte mentah |
| Indeks MAKO | `aifeed.mako-index.v0.2\n` | url + LF + byte mentah |
| Kontainer tanda tangan | prefiks base64url `aimd1:` / `mako1:` | header inline atau sidecar `{file}.sig` |

## Alur

Terbitkan (penerbit): `keygen` → scaffold manifest → tanda tangani → tulis
`/.well-known/ai.json` (+ `ai-signature.json`) → opsional `site build` untuk menghasilkan
`*.aifeed.md` / `*.mako.md` per halaman (+ `.sig`) dan indeks delta bertanda tangan →
anchor DNS `_aifeed` → sajikan.

Verifikasi (klien): `discoverManifestUrl` → fetch manifest + tanda tangan → `verifyAll`
(parse ketat → schema → domain → tanda tangan → raw digest opsional) → opsional
`lookupAifeedTxt` → `decideUsage` per kunci → `fetchAimd`/`fetchMako`
(negosiasi konten, tanda tangan per halaman) → `fetchIndexDelta` + `selectEntries`
(lewati halaman tak berubah) → periksa ulang revokasi. Referensi yang bisa dijalankan:
[`../examples/agent/compliant-agent.js`](../examples/agent/compliant-agent.js).

## Invarian

- **Byte kanonik**: output JCS dan byte file mentah ditandatangani; jangan pernah
  memformat ulang `conformance/`, `examples/`, atau file situs bertanda tangan.
  `.gitattributes` memaksa LF.
- **Override restrict-only**: kebijakan tingkat halaman hanya boleh memperketat manifest.
- **Parser ketat**: kunci duplikat, float, string NFD, integer kebesaran, dan field tak
  dikenal (di luar `x_*`) ditolak — di JS maupun Python.
- **Determinisme**: generator memakai seed/kunci tetap; `…:vectors:check` dan `sdk:check`
  gagal bila output yang di-commit menyimpang dari sumber.
- **Label bukti** ([F]/[M]/[E]/[S]/[H]) pada setiap klaim faktual di docs/paper; angka
  terukur berasal dari `benchmarks/*.json` dan `paper/CLAIMS.md`.

## Titik ekstensi

| Ingin… | Lakukan |
|---|---|
| Menambah kunci izin | `schema/ai-json.v0.2.json` + `lib/validate.js` + kedua verifier + vektor |
| Menambah vektor | generator di `tools/`, jalankan, jaga `…:vectors:check` hijau |
| Menambah perintah CLI | `bin/cli.js` + help + `tests/cli*.test.js` + `REFERENCE.md` |
| Menambah adapter platform | folder baru di `integrations/` + baris di `integrations/README.md` (+ tes handler Node) |
| Mengubah bentuk konten | `lib/mako.js` / `lib/mako-html.js` + generator AIMD/MAKO + cermin spec + paritas Python |
| Menyentuh API SDK | `packages/aifeed-verify/index.js` + `index.d.ts`, lalu `npm run build:sdk && npm run sdk:check` |
| Mengubah situs | `site/index.html` + `penjelasan-aifeed.html` root; regenerasi via `npm run verify` |
| Menambah origin demo | `demos/sites.js` (+ aset `demos/verifier/` opsional), lalu `npm run demos:check` |
| Mengubah kebijakan edge | `functions/[[path]].js`; helper diuji unit di `tests/gen-demos.test.js` |

## Hasil generate vs tulisan tangan

`AGENTS.md` memuat tabel lengkapnya (artefak → sumber → regenerasi → verifikasi). Versi
singkatnya: semua di bawah `packages/aifeed-verify/{lib,schema}` disalin dari `lib/`/`schema/`
root; `conformance/**` berasal dari `tools/gen-*`; HTML laporan/situs berasal dari
`tools/render-html.js` + `tools/build-site.js`; bundel arXiv dibangun dari `paper/`.
Tulisan tangan: `spec/`, `schema/`, `lib/`, `bin/`, `clients/`, `integrations/`,
`wp-plugin/`, `tools/`, `site/index.html`, `penjelasan-aifeed.html`, `paper/*.tex|md`,
`index.js`/`index.d.ts` SDK, dan semua dokumen.
