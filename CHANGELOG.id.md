# Changelog

<p><a href="CHANGELOG.md">English</a> · <a href="CHANGELOG.id.md">Bahasa Indonesia</a> · <a href="CHANGELOG.zh.md">中文</a></p>

Semua perubahan penting pada protokol AIFeed dan implementasi referensinya didokumentasikan
di sini. Format mengikuti [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

> Label bukti yang dipakai di seluruh proyek: [F] fakta terverifikasi, [M] masuk akal,
> [E] estimasi model, [S] terukur di harness simulasi lokal, [H] butuh review hukum.

## [Unreleased]

### Ditambahkan

- **MCP server (`aifeed-mcp-server`)** — server Model Context Protocol tanpa dependensi
  lewat stdio: `verify_manifest`, `fetch_aifeed` (markdown berbujet token dengan cek
  tanda tangan), `list_assets`, `verify_asset` (bukti `size`/`sha-256` level byte),
  `select_index` (pemeringkatan query dalam bujet halaman/token), dan `decide_usage`;
  hanya HTTPS (loopback dengan `AIFEED_MCP_ALLOW_PRIVATE=1`); jalankan via `npm run mcp`
  atau `npx aifeed-mcp-server`.
- **Paket PyPI `aifeed`** — verifier Python independen kini terbit sebagai wheel hanya
  pustaka standar (`pip install aifeed`): modul `aifeed.verify` dan `aifeed.mako`, skrip
  konsol `aifeed-verify`/`aifeed-mako`, pra-rilis PEP 440 `1.0.0a1` yang mencerminkan inti
  `1.0.0-draft`; impor lama `aifeed_verify`/`aifeed_mako` tetap sebagai alias.
- **Plugin framework drop-in (`@aifeed/frameworks`)** — integrasi build satu baris:
  `aifeed()` untuk Vite dan Astro, `withAifeed()` plus bin postbuild `aifeed-next` untuk
  Next.js, dan CLI generik `aifeed-build` (dengan `keygen`) untuk generator statis apa pun;
  menandatangani output build di tempat (manifest, AIFeed Markdown/MAKO per halaman, indeks
  delta, `llms.txt`), menyuntikkan `<link rel="alternate">`, memangkas berkas generate
  basi, dan memverifikasi sendiri tanda tangan/digest; fallback environment
  `AIFEED_DOMAIN`, `AIFEED_KEY`, `AIFEED_BASE_URL`.

## [1.0.0-draft] — 2026-09-16

### Ditambahkan

- **AIFeed Studio (aplikasi publisher lokal)** — `npm run studio` menyajikan UI web
  tanpa dependensi di `127.0.0.1:7777`: workspace per domain, pengambilan sumber HTML
  lokal, editor kebijakan restrict-only (izin penggunaan, teks/URL atribusi, batas
  crawl, lisensi, `llms.txt`, interval revokasi, aturan per-path), build incremental,
  verifikasi lokal manifest/halaman/indeks, dan ekspor bersama record DNS TXT
  `_aifeed`; crawler yang menghormati robots (sitemap atau penemuan tautan, rate
  limit, cache ETag/Last-Modified) menangani situs live; preset jenis situs (news,
  ecommerce, marketplace, government, open, restrictive, blog), tipe halaman per-path
  (`product`, `article`, `listing`, …), dan metadata freshness opt-in (tanggal/tag
  halaman) melengkapi dukungan jenis situs. M3 menambahkan unduhan overlay `.tar.gz`,
  deteksi stack dengan petunjuk adapter `integrations/`, verifikasi live sekali klik
  (manifest, tanda tangan, anchor DNS), dan upacara rotasi kunci terjaga yang menukar
  kunci dan menandatangani ulang seluruh halaman. G4 menambahkan editor
  `types`/`capabilities`/`actions` tervalidasi schema dan impor OpenAPI untuk aksi
  e-commerce, plus jurnal audit (`journal.ndjson`) dan petunjuk perbaikan inline untuk
  kegagalan DNS, schema, tanda tangan, dan rotasi yang umum. Private key tetap di
  workspace (0600) dan tidak pernah disajikan; UI EN/ID/ZH. Pembangun manifest
  (`lib/site.js`) mendapat opsi opsional `limits`,
  `license`, `attribution_text/url`, dan `maxCheckIntervalHours` (backward-compatible).
- **Integritas aset dan visibilitas indeks** — entri `aifeed.assets` halaman boleh
  membawa `mime`, `size`, dan `sha-256` (di-hash dari berkas lokal saat build, ≤16 MiB);
  entri indeks delta mengekspos jumlah `assets`, SDK menambah `listAssets()` dan
  `verifyAsset()`, Studio menampilkan total aset dan cakupan digest, dan `verify:live`
  membuktikan penegakan edge pada path aset.
- **Situs web** — halaman baru `studio.html` (Publish) dan `updates.html` (catatan rilis
  yang dirender dari changelog dalam EN/ID/ZH saat build), tertaut dari navbar, grid
  artifacts, dan sitemap apex; keduanya menyertakan AIFeed Markdown bertanda tangan.
- **Rotasi kunci (v0.2 §14)** — mengganti kunci penanda tangan manifest tanpa merusak
  verifikasi: direktif `rotation.successor_fp` bertanda tangan kunci lama plus cross-check
  DNS `pk2` yang advisory, overlap terbatas (`effective_at` → `grace_until`, batas keras
  1 jam), pengikatan cutover `predecessor_fp` bertanda tangan kunci baru, lalu revokasi
  permanen. Enam kode hasil: `rotation_invalid`, `rotation_anchor_unverified`,
  `grace_accepted`, `rotation_denied`, `rotation_resync`, `key_revoked`. Diimplementasikan
  di `lib/rotation.js`, CLI satu perintah `aifeed rotate [--dry-run]`, ekspor SDK
  `rotation`, paritas direktif Python, validasi manifest PHP, vektor 008–011 / 119–123,
  dan runbook di `docs/rotation.md`.
- **SDK diterbitkan ulang sebagai `1.0.0-draft.2`** — mencakup helper rotasi kunci
  (`rotation.*`), opsi pembangun manifest v0.2 yang dipakai Studio (limits, license,
  attribution text/URL), serta opsi tipe halaman dan freshness opt-in di `htmlToMako`.
- **AIFeed Markdown v1.0** — profil konten native: `text/aifeed+markdown`, `.aifeed.md`,
  `aimd: "1.0"`, blok kebijakan `aifeed` kelas satu, budget token sesuai pilihan penerbit
  (default referensi 4.000 pada mode AIFeed Markdown-only).
- **Penyajian dual-stack** — byte bertanda tangan yang sama di bawah AIFeed Markdown dan
  MAKO, masing-masing dengan konteks tanda tangannya sendiri (`aimd` / `mako`); replay
  lintas format ditolak.
- Ekstensi manifest: `content.profile` (`mako` | `aifeed-md` | `both`) dan
  `content.index_url`; indeks AIFeed Markdown di `/.well-known/aifeed-index.json`.
- CLI: alias `aifeed aimd <generate|sign|verify|index|fetch>`, `--format` untuk generate,
  index, dan fetch; deteksi otomatis profil untuk sign/verify.
- SDK `@aifeed/verify` 1.0.0-draft: `fetchAimd`, `verifyAimdDocument`,
  `verifyAimdIndex`, konstanta media type.
- Plugin WordPress 1.0.0-draft: penyajian dual-stack, mode AIFeed Markdown-only via filter
  `aifeed_dual_stack`, tanda tangan dan indeks per format.
- Spec: `spec/en|id|zh/aifeed-aimd-v1.md` (mode operasi, pertimbangan IANA).
- Vektor: `conformance/aimd/` (11 kasus: penanda, replay lintas format, tamper, aset,
  alternates, validasi field opsional yang ketat) dengan paritas Python; korpus fuzz
  mencakup AIFeed Markdown.
- Repositori: `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `GOVERNANCE.md`,
  `spec/README.md`, README SDK, LICENSE plugin, dan starter `.pot`.
- **Penerbitan platform apa pun**: `aifeed site build <dir>` menghasilkan manifest, indeks
  delta, konten per halaman dengan tanda tangan, dan `llms.txt` opsional untuk output
  statis apa pun (Hugo, Jekyll, Astro, Next export, HTML polos), dengan injeksi
  `<link rel="alternate">` opt-in. Penamaan file spesifik profil — `.aifeed.md` untuk
  AIFeed Markdown, `.mako.md` untuk MAKO, keduanya ditulis untuk `--profile both` — dengan
  sidecar `{file}.sig` yang konteksnya cocok dengan media type. Indeks direktori
  (`/dir/index.html`) dapat diakses di path bersih (`/dir`) pada setiap adapter, termasuk
  path bersarang.
- **Adapter server** di `integrations/`: nginx, Caddy, Apache, Node/Express, Next.js, PHP,
  Python ASGI, Go, dan GitHub Action (dengan tes untuk handler Node).
- **Kebijakan lisensi dan open-core** didokumentasikan di `GOVERNANCE.md`: jalur verifikasi
  (spec, schema, verifier, vektor, tooling penerbit) permanen terbuka tanpa ekstensi
  verifikasi proprietary; hanya secret, data pelanggan, dan taktik anti-abuse yang tetap
  privat. Lisensi kontribusi (inbound=outbound) ditambahkan ke `CONTRIBUTING.md`.
- **Draf preprint arXiv** (`paper/`): sumber LaTeX + cermin Markdown, `refs.bib` dengan
  metadata terverifikasi terhadap sumber primer (17 RFC, draf IETF yang dipin, DOI
  Crossref, halaman penerbit), ledger klaim→sumber `CLAIMS.md`, kesiapan submission
  `CHECKLIST.md`, dan `npm run paper:check` untuk cek silang sitasi/lingkungan
  (52/52 disitasi).

### Diubah

- **Rilis dinomori ulang menjadi `1.0.0-draft`** (sebelumnya `0.3.0-draft`) di paket
  protokol, SDK, CLI, plugin WordPress, dokumen, dan situs. Versi wire/spec tidak berubah:
  manifest `0.1` / `0.2`, AIFeed Markdown `1.0`, MAKO eksternal `0.2` — penomoran ulang
  tidak mengubah byte bertanda tangan atau klaim kompatibilitas apa pun.
- Verifikasi manifest menerima `0.1.x` dan `0.2.x`; versi lain melaporkan
  `upgrade_required`.
- Laporan enforcement/HTML dan kit pilot mandiri dan offline.
- **Domain kanonik dimigrasikan** dari `aifeed.org` (pihak ketiga) ke `aifeed.md` di
  spec, schema, URL registry/revokasi, dokumen, tes, SDK, dan plugin WordPress — termasuk
  bentuk regex ter-escape di schema JSON dan PHP. Semua vektor bertanda tangan, fixture,
  dan indeks diregenerasi dan regresi penuh dijalankan ulang. Migrasi dapat diulang via
  `node tools/replace-domain.js --domain aifeed.md` (dry-run secara default).
- **Domain kanonik `aifeed.md` terdaftar** (maintainer, 2026-09-16). DNS dan situs
  spec/docs adalah langkah konfigurasi berikutnya; URL normatif di spec, schema, dan
  tautan registry sudah menunjuk `aifeed.md`.
- **Aset deployment situs statis** untuk `aifeed.md`: `site/` (landing page),
  `npm run build:site` (`tools/build-site.js`) untuk menyegarkan artefak salinan,
  `.github/workflows/pages-cf.yml` untuk Cloudflare Pages, dan `docs/deploy-site.md` yang
  mencakup DNS, deploy, dan tata letak subdomain demo.
- **Landing page didesain ulang** dengan estetika dark-first terinspirasi konsol Groq:
  permukaan warm-black, aksen vermilion, tipografi Inter/Montserrat, nav atas, hero dengan
  mark inline, grid fitur ikon, kolom spec/tooling berkelompok, banner info, dan toggle
  terang/gelap.
- **Kit SEO**: metadata per halaman (canonical, Open Graph, kartu Twitter,
  `max-image-preview`), JSON-LD di landing dan setiap halaman demo, `robots.txt` +
  `sitemap.xml` apex yang mencakup semua halaman demo, generator `og-image.png` 1200×630
  tanpa dependensi (`tools/gen-og-image.js`), dan `docs/seo.md` dengan runbook Google
  Search Console.
- **Origin demo live**: tujuh situs demo bertanda tangan (`demo`, `news`, `shop`, `gov`,
  `strict`, `revoked`, `verify`) yang dihasilkan deterministik dari `demos/sites.js`
  dengan kunci demo publik, disajikan di Cloudflare Pages melalui
  `functions/[[path]].js` (routing host, CORS, enforcement 403/429 live pada `strict`,
  verifier browser pada `verify`, registry revokasi multi-tanda-tangan di bawah
  `site/revoke/`). Apex `aifeed.md` kini memakai AIFeed pada dirinya sendiri dengan
  manifest bertanda tangannya. Tooling baru: `npm run demos`, `npm run demos:check`
  (di dalam `verify`), `npm run verify:live`.
- **Kit pemeliharaan**: `AGENTS.md` (kontrak agen/dev: file hasil generate, lokasi versi,
  jebakan), `docs/architecture.md` (peta modul, invarian, titik ekstensi),
  `docs/release.md` (checklist rilis/upgrade), dan pemeriksa tanpa dependensi
  (`npm run lint:syntax`, `npm run check:consistency`) yang digabung jadi satu gerbang:
  `npm run verify`.
- **Repositori diratakan**: proyek protokol kini berada di root repositori (sebelumnya
  `aifeed-protocol/`), plugin WordPress di `wp-plugin/`, dan dokumen proyek Indonesia di
  bawah `docs/`. Path kanonik kini
  `github.com/denyn1/aifeed-protocol/tree/main/<path>` (tanpa prefiks ganda); workflow CI,
  tautan situs, dan dokumentasi diperbarui mengikuti.
- **Perbaikan CI**: workflow Pages kini menjalankan renderer laporan sebelum builder situs
  (`render-html` → `build-site`), sehingga `/process.html` dan `/enforcement-report.html`
  kembali terkirim; `build-site` kini gagal dengan berisik saat sumber hasil generate
  hilang alih-alih melewatinya diam-diam (keduanya di-gitignore saat pembersihan).
- **Quickstart sisi agen**: `docs/agent-quickstart.md` (alur periksa-dulu dan penanganan
  kegagalan) plus contoh agen patuh yang bisa dijalankan
  (`examples/agent/compliant-agent.js`) yang dilindungi `tests/agent-example.test.js`. SDK
  kini meneruskan `allowPrivate`/`ca` melalui `fetchMako`, `fetchIndexDelta`, dan
  pengambilan tanda tangan sidecar (untuk lingkungan tes lokal self-signed).
- **Pembersihan repositori**: draf proposal/review usang dan artefak build yang ter-commit
  (HTML laporan, salinan situs, PDF duplikat, staging/ZIP arXiv) dihapus; semuanya
  diregenerasi sesuai kebutuhan (`npm run render:html`, `npm run build:site`) dan kini
  di-gitignore. Bundel arXiv dibangun langsung dari `paper/`.
- **SDK diterbitkan ke npm**: `@aifeed/verify@1.0.0-draft` (dist-tag `latest` dan `next`),
  27 file, 44,7 kB terpaket; `npm install @aifeed/verify` langsung berfungsi. Diperbarui ke
  **`1.0.0-draft.1`** (2026-09-16) dengan perbaikan penerusan opsi TLS/private-fetch;
  kedua dist-tag kini menunjuk versi itu. Paket monorepo ditandai `"private": true` untuk
  mencegah publikasi tak sengaja.
- **Logo disederhanakan** menjadi mark 2D flat statis (shield vermilion + centang putih,
  378 byte, tanpa gradien/filter/animasi), menggantikan badge beranimasi. Situs, favicon,
  dan panduan lengkap semuanya memakainya via `site/logo.svg`.
- **Halaman laporan dibangun ulang dalam sistem desain landing page dan dalam bahasa
  Inggris**: alur protokol (`docs/process.html`), benchmark enforcement
  (`benchmarks/enforcement-report.html`), dan panduan lengkap bentuk panjang
  (`penjelasan-aifeed.html` → `site/penjelasan.html`) kini berbagi palet warm dark-first,
  aksen vermilion, dan toggle terang/gelap; semuanya tetap mandiri/offline tanpa sumber
  eksternal.
- **Penamaan menghadap manusia disatukan menjadi "AIFeed Markdown"** di dokumen, output
  CLI/SDK, dan laporan; identifier wire tidak berubah (`aimd`, `aimd-index`, kode level
  `AIMD-C1..C4`, konstanta `AIMD_*`, `.aifeed.md`). Heading spec EN/ID kini menyatakan
  identifier wire secara eksplisit.
- **Drift fixture JCS PHP diperbaiki**: `npm run jcs:fixtures`
  (`tools/gen-jcs-php-fixtures.js`) membangun ulang `tools/jcs-php-fixtures.json` dari
  vektor konformansi 001, sehingga tes lintas bahasa JCS/Ed25519 plugin
  (`tests/jcs-test.php`) tidak bisa lagi basi setelah regenerasi.
- Judul paper diselaraskan ke *AIFeed: Verifiable Content Permissions and Efficient Agent
  Delivery for the AI Web*; item domain `paper/CHECKLIST.md` diperbarui untuk
  mencerminkan migrasi yang sudah diterapkan.

## [0.2.0-draft] — 2026-09-15

### Ditambahkan

- Profil trust MAKO: dokumen MAKO bertanda tangan (`aifeed.mako.v0.2`), pengikatan izin
  (restrict-only), subset YAML aman, indeks delta dengan digest per entri.
- Aset sebagai tautan (`aifeed.assets`), resume situs dan field triage di indeks,
  penerbitan `/llms.txt` (v2) di plugin WordPress.
- CLI `aifeed mako generate|sign|verify|index|fetch`; SDK `fetchMako`,
  `fetchIndexDelta`, `selectEntries`, `decideUsage`.
- Harness enforcement (S0–S3, empat profil klien, skala 100 tenant) dengan penghematan dua
  sisi [S]; template paritas nginx/Caddy; laporan HTML beranimasi; kit pilot 30 hari.
- 39 vektor konformansi MAKO; paritas Python; target fuzz untuk MAKO.

## [0.1.0-rc1] — 2026-09-14

### Ditambahkan

- AIFeed v0.1: manifest bertanda tangan di `/.well-known/ai.json`, Ed25519 + JCS, anchor
  DNS (`_aifeed`), revokasi dengan dokumen multi-tanda-tangan, bundel offline.
- CLI referensi (`keygen|sign|validate|bundle|init|import-openapi`), 24 vektor manifest,
  verifier JavaScript dan Python independen, plugin penerbit WordPress (0.1.0-rc1)
  terverifikasi end-to-end (17/17 pemeriksaan admin).
