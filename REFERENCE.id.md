# AIFeed Protocol — Implementasi Referensi (v1.0.0-draft)

AIFeed adalah lapisan trust terbuka untuk AI-Web: origin menerbitkan deklarasi bertanda
tangan di `/.well-known/ai.json` yang menjelaskan apa yang boleh dilakukan sistem AI
terhadap kontennya. Deklarasi dapat diverifikasi offline (Ed25519 + JCS), di-anchor di DNS
(TXT `_aifeed`), dan dapat dicabut melalui registry publik bertanda tangan.

Versi 0.2 menambahkan **profil trust MAKO**: origin yang menyajikan markdown per halaman
(`Accept: text/mako+markdown`, [protokol MAKO 1.0](https://github.com/juanisidoro/mako-spec))
dapat mengikat izin bertanda tangannya ke halaman individual, menandatangani dokumen MAKO
(Ed25519 detached, domain separation `aifeed.mako.v0.2`), dan menerbitkan indeks delta
dengan digest sehingga klien hanya mengambil yang berubah.

AIFeed juga mendefinisikan **profil konten native-nya, AIFeed Markdown** —
`text/aifeed+markdown`, `.aifeed.md`, `aimd: "1.0"` — agar protokol tidak bergantung pada
satu format eksternal mana pun. Origin dual-stack menyajikan byte bertanda tangan yang sama
di kedua media type, masing-masing dengan konteks tanda tangannya sendiri (`aimd` / `mako`);
MAKO tetap didukung penuh sebagai profil kompatibilitas. Origin BOLEH menjalankan
**AIFeed Markdown-only** (`content.profile: "aifeed-md"`, body lebih panjang hingga budget
penerbit), yang diekspos plugin WordPress lewat filter `aifeed_dual_stack`. AIFeed Markdown
juga membawa `alternates` (terjemahan yang diterbitkan) untuk situs global serta mendefinisikan
aturan IDN/punycode dan BCP 47 untuk tanda tangan deterministik lintas lokal. Lihat
`spec/en/aifeed-aimd-v1.md`.

Repositori ini adalah implementasi referensinya: spec, schema, CLI, vektor konformansi,
benchmark, dan dua verifier independen (JavaScript dan Python) yang lulus vektor yang sama.

> Status: draft. Spesifikasi belum dibekukan. Lihat `spec/en/aifeed-v0.2.md`
> (ekstensi dari `spec/en/aifeed-v0.1.md`).

---

## Tata letak repositori

```
    ├── bin/                 CLI: keygen | sign | rotate | validate | bundle | init | import-openapi | mako
├── lib/                 parser ketat, JCS (RFC 8785), Ed25519, mesin schema, aturan
├── lib/mako.js          lapisan trust MAKO: subset YAML aman, tanda tangan, izin, indeks
├── lib/mako-html.js     konversi HTML ke MAKO (tanpa dependensi)
├── schema/              manifest v0.1 + v0.2, tanda tangan, AIFeed Markdown v1, frontmatter/signature/index MAKO
├── spec/en/             spesifikasi kanonik (Inggris; termasuk AIFeed Markdown v1)
├── spec/id/             terjemahan resmi (Bahasa Indonesia)
├── conformance/         vektor (termasuk conformance/mako dan conformance/aimd), revokasi, fixture
├── examples/            enam kategori situs termasuk marketplace skala penuh
├── clients/python/      verifier Python tanpa dependensi (manifest, revokasi, bundel, MAKO)
├── packages/aifeed-verify/  paket npm terbit @aifeed/verify
├── benchmarks/          laporan MAKO + enforcement (JSON/MD/HTML) dan template edge/
├── docs/                process.html (walkthrough protokol beranimasi)
├── integrations/        adapter platform: nginx, Caddy, Apache, Node, Next.js, PHP, Python, Go, GitHub Action
├── pilot/               kit pilot: rencana, instrumentasi, template mingguan
├── tools/               generator vektor, fuzzer, pembangun SDK, harness benchmark/laporan
└── tests/               suite tes Node (node --test)
```

---

## Quickstart

Tanpa dependensi (Node >= 20 untuk tooling JS, Python >= 3.10 untuk verifier Python).

```bash
# 1. Buat pasangan kunci Ed25519
node bin/cli.js keygen --out ./my-site

# 2. Tulis atau generate ai.json, lalu tanda tangani (diverifikasi sendiri sebelum ditulis)
node bin/cli.js sign ./my-site/ai.json

# 3. Verifikasi lokal
node bin/cli.js validate ./my-site

# 4. Verifikasi domain live (HTTPS + anchor DNS + revokasi opsional)
node bin/cli.js validate tokobuku.example --revocation-url https://aifeed.md/revoke/v1/tokobuku.example.json

# 5. Pemeriksaan yang sama dengan verifier Python independen
python clients/python/aifeed_verify.py ./my-site --json

# 6. Bundel offline (air-gapped / audit)
node bin/cli.js bundle create ./my-site --out ./my-bundle --domain example.com
node bin/cli.js bundle verify ./my-bundle --json

# 7. Setup zero-touch untuk stack apa pun (tanpa WordPress)
node bin/cli.js init --domain example.com --profile news --dir ./site

# 8. Draf capabilities/actions dari spec OpenAPI (semi-otomatis)
node bin/cli.js import-openapi ./openapi.json --out ./fragment.json

# 9. Platform apa pun: bangun AIFeed Markdown + manifest + indeks untuk situs statis
node bin/cli.js site build ./public --domain example.com --key ./my-site/aifeed-private.pem --llms --inject

# 10. MAKO: konversi HTML ke dokumen MAKO (tanpa dependensi)
node bin/cli.js mako generate ./artikel.html --out ./artikel.mako.md --url https://example.com/artikel

# 11. AIFeed Markdown (native): generate, sign, verify, dan index
node bin/cli.js aimd generate ./artikel.html --out ./artikel.aifeed.md --url https://example.com/artikel
node bin/cli.js aimd sign ./artikel.aifeed.md --url https://example.com/artikel
node bin/cli.js aimd verify ./artikel.aifeed.md --url https://example.com/artikel --key ./my-site/aifeed-public.txt
node bin/cli.js aimd index ./site --domain example.com --sign --key ./my-site/aifeed-private.pem
node bin/cli.js aimd fetch https://example.com/artikel --key ./my-site/aifeed-public.txt

# 12. MAKO: sign, verify, index, dan fetch dengan negosiasi konten
node bin/cli.js mako sign ./artikel.mako.md --url https://example.com/artikel
node bin/cli.js mako verify ./artikel.mako.md --url https://example.com/artikel --key ./my-site/aifeed-public.txt
node bin/cli.js mako index ./site --domain example.com --sign --key ./my-site/aifeed-private.pem
node bin/cli.js mako fetch https://example.com/artikel --key ./my-site/aifeed-public.txt

# 13. Rotasi kunci penanda tangan (manifest v0.2): umumkan, tunggu overlap, cutover
node bin/cli.js rotate --dir ./my-site --window 72
# terbitkan manifest overlap + record DNS pk2 advisory, lalu setelah effective_at:
node bin/cli.js rotate --dir ./my-site
```

Exit code: `0` VERIFIED, `1` UNVERIFIED/SUSPENDED, `2` usage atau error internal.

---

## Apa yang diverifikasi

- JSON ketat: kunci duplikat ditolak, NFC diwajibkan, hanya integer (`|n| <= 2^53-1`),
  kedalaman maksimum 10, field ekstensi `x_` diabaikan.
- Discovery: `discoverManifestUrl()` menemukan manifest lewat `Link: rel="ai-feed"`,
  HTML `<link rel="ai-feed">`, lalu fallback ke `/.well-known/ai.json`.
- Kesesuaian schema (`schema/ai-json.v0.1.json`).
- `identity.domain` sama dengan host penyaji (IDNA2008 A-label, case-insensitive).
- `validity.signed_at` / `expires_at` di dalam payload bertanda tangan.
- Ed25519 pure (RFC 8032) atas `"aifeed.v0.1\n" || JCS(manifest)` dengan kunci SPKI DER.
- Anchor DNS `_aifeed` (public key dan fingerprint opsional harus cocok).
- URL revokasi kanonik dan kebijakan staleness terbatas.
- Integritas transport: `Content-Digest` (RFC 9530) diverifikasi bila ada; fetch memakai
  identity encoding.
- Integritas byte: `raw_digest` opsional di kontainer tanda tangan mendeteksi korupsi atau
  reformat tingkat byte (deteksi korupsi, bukan autentisitas).
- Bundel offline: daftar file ber-hash dengan tanda tangan bundler opsional; bundel basi
  (>168 jam) menurunkan trust.
- Dokumen MAKO (v0.2): frontmatter subset YAML aman (anchor, alias, tag, dan flow
  collection ditolak), tanda tangan Ed25519 atas
  `"aifeed.mako.v0.2\n" || url || LF || byte mentah`, pengikatan izin dengan override
  restrict-only, indeks delta terpaginasi dengan digest SHA-256 per entri, dan daftar tautan
  `aifeed.assets` (gambar, video, audio, dokumen, arsip) dengan opsional `mime`, `size`,
  dan `sha-256` agar agen dapat memutuskan apa yang diunduh dan memverifikasi byte yang
  diperoleh (`sdk.verifyAsset`); konverter juga menghasilkan bagian "Media & Unduhan".
- Triage situs (v0.2): indeks delta membawa resume `site` opsional
  (nama, deskripsi, tipe, bahasa) dan field triage per entri
  (`title`, `summary`, `tags`, `lang`, `related`, `assets`) agar agen dapat memeringkat dan
  memilih halaman sebelum fetch; SDK mengekspos `selectEntries()` untuk pemeringkatan itu.

---

## Tes

```bash
npm test                 # suite tes Node (258 tes: unit, vektor, AIFeed Markdown/MAKO, i18n global, site builder, adapter server, pemilihan triage, enforcement, laporan HTML, kit pilot, fuzz smoke, SDK, CLI, bundel, integrasi, rotasi kunci, server MCP)
npm run test:py          # suite verifier Python (45 tes: vektor, paritas AIFeed Markdown/MAKO, revokasi, bundel, contoh)
npm run vectors          # regenerasi vektor manifest deterministik + self-check (34)
npm run mako:vectors     # regenerasi vektor konformansi MAKO + self-check (39)
npm run aimd:vectors     # regenerasi vektor konformansi AIFeed Markdown + self-check (11)
npm run fuzz -- --iterations 50000 --seed 42    # fuzzer parser deterministik (invarian + cek polusi)
npm run fuzz:mako -- --iterations 30000         # fuzzer frontmatter/kontainer/indeks MAKO
npm run bench:mako       # benchmark MAKO, menulis benchmarks/mako-report.md
npm run bench:enforcement # harness enforcement (PDP + empat profil klien + skala 100 tenant), menulis benchmarks/enforcement-report.{md,json}
npm run render:html      # merender benchmarks/enforcement-report.html dan docs/process.html (offline, beranimasi)
npm run build:sdk        # membangun ulang packages/aifeed-verify dari lib/ + schema/
npm run sdk:check        # memverifikasi SDK hasil build sinkron dengan sumber
```

Tes integrasi fetch berjalan terhadap server fixture TLS lokal (`tests/fixtures/tls/`,
self-signed, hanya untuk tes) dan mencakup Content-Digest, redirect, encoding konten, batas
ukuran, timeout, pemblokiran alamat privat, dan penolakan sertifikat tak terpercaya.

34 vektor konformansi manifest, 39 vektor MAKO (positif dan negatif: tanda tangan, digest,
override izin, serangan YAML, aset, triage indeks), 11 vektor AIFeed Markdown (penanda
native, penanda ganda, replay lintas format, tamper, aset, alternates, validasi field
opsional yang ketat), plus fixture revokasi, bundel, dan contoh (news, e-commerce, blog,
government, SaaS, dan marketplace skala penuh dengan 9 capabilities, 5 aksi OAuth2, dan
10 tipe) diverifikasi oleh implementasi JavaScript dan Python — tes interoperabilitas
diferensial (lintas bahasa).

### Platform apa pun (bukan hanya WordPress)

`aifeed site build <dir>` mengubah output statis apa pun menjadi origin AIFeed bertanda
tangan — manifest, indeks delta, konten per halaman (`.aifeed.md` untuk AIFeed Markdown,
`.mako.md` untuk MAKO, keduanya untuk `--profile both`), sidecar `{file}.sig` dengan konteks
tanda tangan yang cocok, dan `llms.txt` opsional — dengan `--inject` opt-in yang menambahkan
tag `<link rel="alternate">` untuk host tanpa negosiasi konten. Indeks direktori bersarang
(`/dir/index.html`) dapat diakses di path bersih (`/dir`) pada setiap adapter. `integrations/`
menyediakan adapter siap pakai untuk nginx, Caddy, Apache, Node/Express, Next.js, PHP,
Python ASGI, Go, dan GitHub Action; lihat `integrations/README.md` untuk matriks dan
quickstart-nya.

Verifikasi direktori hasil build sebelum atau sesudah deploy:

```bash
aifeed validate ./public --domain example.com --json                     # manifest
aifeed aimd verify ./public/artikel/satu.aifeed.md \
  --url https://example.com/artikel/satu \
  --key ./.aifeed/aifeed-public.txt --json                               # halaman + tanda tangan
```

### Bukti enforcement dan kit pilot

`npm run bench:enforcement` menjalankan harness loopback dengan origin HTTP nyata dan PDP
edge (penolakan training, `429 + Retry-After`, MAKO/delta) pada empat profil klien dan
skenario hosting 100 tenant, menghasilkan penghematan dua sisi untuk penerbit dan sisi AI
(`benchmarks/enforcement-report.md`). `benchmarks/edge/` berisi template paritas
nginx/Caddy, dan `pilot/` berisi kit pilot 30 hari siap jalan dengan skema log akses dan
`tools/pilot-report.js`. Laporan beranimasi (`benchmarks/enforcement-report.html`,
`docs/process.html`) mandiri dan offline.

### Verifikasi WordPress end-to-end (manual)

WordPress nyata (PHP 8.4 + drop-in SQLite resmi) dipakai memvalidasi plugin penerbit
end-to-end: aktifkan → generate kunci → tanda tangani → sajikan via HTTP → **VERIFIED**
oleh SDK ini dan oleh `bin/cli.js validate`, termasuk lapisan `raw_digest`; path
`/.well-known/ai*` yang tidak dikenal mengembalikan 404 JSON. Alur admin juga disimulasikan
via HTTP (login, simpan Settings API, aksi sign dengan nonce, penolakan nonce hilang,
penolakan tanpa autentikasi, shortcode badge): **17/17 pemeriksaan lulus**.

Lapisan MAKO diverifikasi di lingkungan yang sama: manifest mengiklankan `content.mako`
(v0.2), `GET` dengan `Accept: text/mako+markdown` mengembalikan `text/mako+markdown` dengan
header wajib MAKO, kontainer inline `X-Aifeed-Signature: mako1:...` terverifikasi terhadap
kunci manifest (body yang diubah ditolak), halaman HTML mengiklankan tautan alternate, dan
indeks delta bertanda tangan terverifikasi dengan digest per entri yang cocok. Lihat
`wp-plugin/README.md`.

---

## Quickstart sisi agen

Sebelum crawl, agen harus menemukan dan memverifikasi deklarasi penerbit, menghormati izin
dan batas crawl, serta memakai indeks delta. Panduan:
[`docs/agent-quickstart.md`](docs/agent-quickstart.md); contoh yang bisa dijalankan:
[`examples/agent/compliant-agent.js`](examples/agent/compliant-agent.js) —
`node examples/agent/compliant-agent.js https://example.com --use retrieval --fetch`.

## Panduan AI publisher

Pemilik website: berikan panduan ini ke AI coding agent Anda dan ia akan memasang AIFeed
end-to-end:
[`docs/publisher-ai-guide.id.md`](docs/publisher-ai-guide.id.md) — satu track untuk situs
kecil, menengah, besar, dan raksasa, masing-masing berakhir di manifest terverifikasi.

## SDK

- **Klien AI — `@aifeed/verify`** (`packages/aifeed-verify/`): paket npm mandiri yang
  dibangun dari `lib/` dan `schema/` via `npm run build:sdk`; menyertakan deklarasi
  TypeScript (`index.d.ts`) dan API MAKO v0.2 (`fetchMako`, `fetchIndexDelta`,
  `selectEntries`, `decideUsage`, `listAssets`, `verifyAsset`, primitif `mako.*`, schema
  v0.2); pengemasan diuji dengan `npm pack --dry-run`.
- **Klien AI — `aifeed-mcp-server`** (`packages/aifeed-mcp-server/`): server Model
  Context Protocol tanpa dependensi lewat stdio, dibangun dari `lib/` dan `schema/`
  via `npm run build:mcp`; tools `verify_manifest`, `fetch_aifeed`, `list_assets`,
  `verify_asset`, `select_index`, `decide_usage`; jalankan via `npm run mcp` atau
  `npx aifeed-mcp-server`.
- **Penerbit — WordPress** (`wp-plugin/`): SDK penerbit referensi (manajemen kunci,
  pembangun manifest, JCS di PHP, penandatanganan, penyajian `/.well-known`, UI admin,
  instruksi DNS, badge, re-sign bulanan) plus lapisan MAKO v0.2 (negosiasi konten, dokumen
  MAKO bertanda tangan, indeks delta, koeksistensi mako-wp). Diverifikasi di WordPress
  nyata; `php -l` dan `php tests/jcs-test.php` plus `php tests/mako-test.php` berjalan
  mandiri.

---

## Spesifikasi dan standar terkait

AIFeed melengkapi: `robots.txt` (RFC 9309), draf vocabulary/attachment AIPREF IETF,
Cloudflare Content Signals, RSL 1.0, W3C TDMRep, `llms.txt` v2, dan **MAKO** (markdown per
halaman untuk agen AI). AIPREF menyatakan preferensi bukan mekanisme keamanan; AIFeed
menyediakan lapisan atribusi, pengikatan izin, dan revokasi yang hilang; MAKO menyatakan
tidak menyediakan verifikasi — AIFeed menyediakannya.

Kebijakan bahasa: spesifikasi kanonik dalam bahasa Inggris. Dokumentasi direncanakan dalam
10 bahasa prioritas (enam resmi PBB plus Indonesia, Portugis, Hindi, Kiswahili).

---

## Publikasi

- `paper/` — draf preprint arXiv *AIFeed: Verifiable Content Permissions and
  Efficient Agent Delivery for the AI Web* (judul kerja): sumber LaTeX + cermin Markdown,
  `refs.bib` dengan metadata terverifikasi, `CLAIMS.md` (ledger klaim→sumber), dan
  `CHECKLIST.md` (kesiapan submission). Pemeriksaan struktural: `npm run paper:check`.

## Lisensi

Spesifikasi: CC BY 4.0 · Kode dan schema: MIT. Vektor uji dirilis ke domain publik (CC0)
untuk pengujian implementasi.

AIFeed menganut kebijakan **open core + open standard**: jalur verifikasi (spec, schema,
verifier, vektor, tooling penerbit) permanen terbuka, tanpa ekstensi proprietary; hanya
secret, data pelanggan, dan taktik anti-abuse yang tetap privat. Detail di `GOVERNANCE.md`
("Licensing and open-core policy").

## Governance dan kontribusi

`CONTRIBUTING.md` (alur kerja, kebijakan terjemahan, persyaratan konformansi, lisensi
kontribusi), `GOVERNANCE.md` (pengambilan keputusan interim, kebijakan lisensi/open-core,
jalur menuju yayasan), `SECURITY.md` (pelaporan kerentanan, kompromi kunci, disclosure),
dan `CODE_OF_CONDUCT.md`. Riwayat spesifikasi: `CHANGELOG.md`; indeks spec:
`spec/README.md`.
