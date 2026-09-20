# AIFeed Studio

<p><a href="README.md">English</a> · <a href="README.id.md">Bahasa Indonesia</a> · <a href="README.zh.md">中文</a></p>

Aplikasi lokal tanpa dependensi yang mengubah website menjadi origin AIFeed bertanda
tangan — manifest, AIFeed Markdown/MAKO per halaman, tanda tangan, indeks delta, dan
`llms.txt` — dengan editor kebijakan untuk apa yang boleh diambil AI dan bagaimana
sumber wajib ditandai.

Private key tidak pernah meninggalkan mesin Anda. Server hanya bind ke `127.0.0.1`,
setiap panggilan API butuh token sesi, dan tidak ada endpoint yang mengekspos private key.

## Menjalankan

```bash
npm run studio                          # http://127.0.0.1:7777/
npm run studio -- --port 8080 --workspace ./studio-data
```

Buka URL-nya, buat proyek untuk domain Anda, arahkan ke direktori HTML lokal situs
(hasil build/export statis, atau pohon halaman CMS), atur kebijakan, build, verifikasi,
lalu ekspor.

## Fitur saat ini

- **Workspace proyek** per domain: identitas, kebijakan, pasangan kunci, status incremental.
- **Sumber lokal**: memindai direktori HTML, mengonversi dengan konverter yang sama
  seperti `aifeed site build`, dan menulis output ke overlay `build/` terpisah — file
  sumber Anda tidak pernah diubah.
- **Crawl situs live**: menemukan halaman dari `sitemap.xml` (indeks sitemap didukung)
  atau penjelajahan tautan, menghormati `robots.txt` (termasuk `Crawl-delay`),
  membatasi laju, dan meng-cache setiap fetch dengan ETag/Last-Modified sehingga scan
  ulang memakai ulang halaman yang tak berubah.
- **Editor kebijakan**: izin penggunaan (search, retrieval, input, training, quote,
  summarize, reproduce, translate, modify, embed, commercial use), atribusi + teks/URL,
  batas crawl, lisensi, `llms.txt`, interval cek revokasi, dan aturan per-path yang hanya
  bisa mengetatkan (spec `restrict-only`).
- **Preset jenis situs**: kebijakan news, ecommerce, marketplace, government, open,
  restrictive, dan blog yang diturunkan dari `lib/scaffold.js`, diterapkan saat membuat
  proyek atau dari tab Kebijakan.
- **Tipe halaman per-path**: petakan pola path ke tipe frontmatter (`product`, `article`,
  `listing`, `faq`, …) dengan presedensi pola terpanjang; entri indeks delta mewarisi
  tipe tersebut.
- **Metadata freshness**: tanggal `updated` halaman dari `article:modified_time` /
  `og:updated_time` / `<time datetime>` dan tag dari `<meta name="keywords">`, bisa
  diaktifkan per proyek (default off di library, on di Studio).
- **Pembantu deploy**: unduhan `.tar.gz` overlay build, deteksi stack (WordPress, nginx,
  Caddy, Apache, Next.js, Node, PHP, Python, Go, Cloudflare) dengan adapter `integrations/`
  yang cocok ditampilkan di Ekspor, dan **verifikasi live** sekali klik (manifest, tanda
  tangan, anchor DNS).
- **Upacara rotasi kunci**: prepare terjaga (penerus + manifest overlap), cutover
  terkonfirmasi, tukar kunci otomatis, dan tanda tangan ulang seluruh halaman dengan
  kunci baru. Overlay unggahan tidak pernah memuat private key.
- **Field manifest lanjutan**: editor JSON `types`, `capabilities`, dan `actions` yang
  divalidasi terhadap schema v0.2, plus impor OpenAPI (tempel spec) untuk menyusun
  capabilities dan aksi bergaya purchase bagi agen e-commerce.
- **Build incremental**: halaman tak berubah (hash HTML) dilewati; state menyimpan entri
  indeks per halaman agar rebuild tetap cepat untuk situs besar.
- **Verifikasi**: manifest, semua tanda tangan halaman, dan kedua indeks diverifikasi
  lokal sebelum dipublikasikan.
- **Ekspor**: direktori overlay siap-upload, record DNS TXT `_aifeed` yang persis, dan
  instruksi langkah demi langkah.
- **UI dalam bahasa Inggris, Indonesia, dan China.**

## Tata letak workspace

```
~/.aifeed-studio/                 (atau --workspace)
  projects.json
  projects/<domain>/
    project.json                  identitas, sumber, profil
    policy.json                   kebijakan global + aturan path
    aifeed-private.pem            0600, tidak pernah disajikan
    aifeed-public.txt
    state.json                    status build incremental
    build/                        unggah overlay ini ke web root Anda
```

## Semantik kebijakan (penting)

- Satu manifest per origin. Manifest membawa kebijakan global.
- Aturan per-path disuntikkan ke blok frontmatter `aifeed` bertanda tangan tiap halaman
  dan **hanya boleh mengetatkan** yang diizinkan manifest (deny di atas allow, atribusi
  lebih ketat, limit lebih ketat); pelonggaran ditolak, sesuai AIFeed v0.2 §6.3.
- UI menampilkan pratinjau kebijakan efektif untuk URL mana pun sebelum build.

## Keamanan

- Bind `127.0.0.1` secara default; panggilan API butuh token per sesi yang disuntikkan ke
  halaman UI.
- Tanpa dependensi, tanpa panggilan eksternal kecuali halaman yang Anda build sendiri.
- Private key hanya disimpan di direktori workspace dengan izin hanya-pemilik.

## API (untuk skrip dan tes)

`GET /api/info`, `GET|POST /api/projects`, `GET|PUT /api/projects/:id`,
`PUT /api/projects/:id/policy`, `PUT /api/projects/:id/source`,
`POST /api/projects/:id/build` (mengembalikan job id), `GET /api/projects/:id/jobs/:id`,
`GET /api/projects/:id/events?job=` (SSE), `POST /api/projects/:id/verify`,
`GET /api/projects/:id/preview?path=`, `GET /api/projects/:id/export`.

Semua panggilan API butuh header `x-studio-token` (SSE memakai `?token=`).

## Peta jalan

- **M2 (selesai):** crawl situs live via `sitemap.xml` atau tautan (hormati robots,
  rate limit, cache dengan conditional request) dan build dari cache.
- **M2.5 (selesai):** preset jenis situs, tipe halaman per-path, dan ekstraksi metadata
  freshness untuk situs news dan e-commerce.
- **M3 (selesai):** ekspor `.tar.gz`, deteksi stack dengan petunjuk adapter, verifikasi
  live dari UI, dan upacara rotasi kunci terjaga dengan penandatanganan ulang halaman.
- **M4 (berjalan):** editor lanjutan `types`/`capabilities`/`actions` dengan impor
  OpenAPI selesai; diagnostik ramah, jurnal audit, dan tangkapan layar menyusul.

## Terkait

- Panduan AI publisher (setup via agen): [`../docs/publisher-ai-guide.id.md`](../docs/publisher-ai-guide.id.md)
- Referensi perintah: [`../REFERENCE.id.md`](../REFERENCE.id.md)
- Runbook rotasi: [`../docs/rotation.id.md`](../docs/rotation.id.md)
