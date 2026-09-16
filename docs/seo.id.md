# SEO dan Google

<p><a href="seo.md">English</a> · <a href="seo.id.md">Bahasa Indonesia</a> · <a href="seo.zh.md">中文</a></p>

Apa yang sudah dikirim situs hari ini, dan dua langkah yang hanya bisa diselesaikan pemilik.

## Sudah diterapkan

- **Metadata per halaman** di setiap halaman HTML: `title`, `description`, `robots`
  (`index,follow,max-image-preview:large`), `canonical` absolut, tag Open Graph dan kartu
  Twitter, serta JSON-LD (`Organization`, `WebSite`, `SoftwareApplication` di landing;
  `WebPage`/`TechArticle` di tempat lain; `WebPage` per halaman di setiap demo).
- **`sitemap.xml`** di apex yang mencantumkan halaman utama plus setiap halaman demo
  (dihasilkan `tools/gen-demos.js` dari `demos/sites.js`; regenerasi dengan `npm run demos`).
- **`robots.txt`** di apex: izinkan semua, penunjuk sitemap, dan komentar `AIFeed:` yang
  menunjuk ke `/.well-known/ai.json`.
- **`og-image.png`** (1200×630) dihasilkan hanya dengan pustaka standar Node
  (`tools/gen-og-image.js`) — tanpa aset biner yang dikomit.
- **`llms.txt`** untuk alat yang belum berbicara AIFeed.
- Demo sudah punya `robots.txt` + `sitemap.xml` sendiri; kini mereka juga membawa set
  metadata yang sama.

Verifikasi cepat:

```bash
curl -s https://aifeed.md/robots.txt
curl -s https://aifeed.md/sitemap.xml | head -20
curl -sI https://aifeed.md/og-image.png | head -3
```

## Langkah 1 — Google Search Console (perlu untuk pencarian)

1. Buka <https://search.google.com/search-console> dan tambahkan properti **Domain**
   `aifeed.md` (bukan varian URL-prefix).
2. Google menampilkan record TXT seperti
   `google-site-verification=XXXXXXXX…`. Salin seluruh nilainya.
3. Tambahkan ke DNS Cloudflare — bisa tempel nilainya di sini dan ditambahkan via API, atau
   manual: Cloudflare → DNS → Add record → type **TXT**, name `@`, content nilai yang disalin.
4. Kembali ke Search Console, tekan **Verify**. Verifikasi DNS bisa memakan beberapa menit.
5. Kirim sitemap: **Sitemaps → add** `https://aifeed.md/sitemap.xml`.
6. Opsional: **URL Inspection → Request indexing** untuk `https://aifeed.md/`.

Alternatif bila DNS merepotkan: Search Console juga menerima file HTML
(`google<token>.html`) yang diletakkan di root situs; taruh file itu di `site/` dan ia
terdeploy apa adanya.

## Langkah 2 — Google Analytics (opsional)

Bila ingin angka trafik, buat properti GA4 dan berikan ID pengukuran `G-XXXXXXXXXX`.
ID itu akan ditambahkan hanya ke landing page dan halaman demo — halaman
`process.html`/`enforcement-report.html` tetap sepenuhnya offline (tanpa permintaan
eksternal, ditegakkan oleh tes).

## Catatan

- Apex kini menyajikan manifest AIFeed bertanda tangannya sendiri dan anchor DNS `_aifeed`;
  crawler mesin pencari membaca `robots.txt` dan sitemap, agen AI membaca
  `/.well-known/ai.json`.
- `site/{robots.txt,sitemap.xml,og-image.png}` dihasilkan dan di-gitignore; bangun ulang
  dengan `npm run demos` (atau `npm run verify`).
