# Origin demo live

<p><a href="demos.md">English</a> · <a href="demos.id.md">Bahasa Indonesia</a> · <a href="demos.zh.md">中文</a></p>

Tujuh origin demonstrasi plus situs apex, semuanya disajikan dari Cloudflare Pages
(`functions/` merutekan setiap subdomain ke origin hasil generate-nya di bawah `site/demos/`).
Semua dihasilkan secara deterministik oleh `tools/gen-demos.js` dari
[`demos/sites.js`](../demos/sites.js); kuncinya ada di [`demos/keys.js`](../demos/keys.js)
dan **sengaja publik sebagai kunci demo** — jangan pernah dipakai ulang.

| Origin | Profil | Halaman | Menunjukkan |
|---|---|---|---|
| <https://demo.aifeed.md> | blog | 11 | Walkthrough lengkap: manifest, markdown dual-stack, indeks delta, `llms.txt`, docs dengan TOC |
| <https://news.aifeed.md> | news | 13 | Ticker, berita utama, meja kategori, `alternates` EN/ID di frontmatter bertanda tangan, halaman penulis |
| <https://shop.aifeed.md> | ecommerce | 12 | Kartu produk dengan rating dan harga, galeri, keranjang, kebijakan, aset media |
| <https://gov.aifeed.md> | government | 10 | Direktori layanan dengan timeline langkah, pengumuman, unduhan regulasi, FAQ |
| <https://strict.aifeed.md> | restrictive | 5 | Kebijakan search-only dengan **enforcement live**: 403 untuk UA training, 429 + `Retry-After` untuk crawler tak patuh |
| <https://revoked.aifeed.md> | registry | 6 | Revokasi multi-tanda-tangan: dokumen `active` vs `suspended`, panduan klien, timeline peristiwa |
| <https://verify.aifeed.md> | verifier | 5 | Verifier browser (WebCrypto + DNS-over-HTTPS), matriks cakupan, resep CLI |
| <https://aifeed.md> | docs | — | Apex memakai AIFeed pada dirinya sendiri: ia menerbitkan manifest bertanda tangannya sendiri |

Setiap origin hasil generate membawa arsitektur informasi nyata — bilah atas lengket,
navigasi berkelompok, tata letak sidebar/TOC, kartu, tabel, FAQ, timeline, newsletter, dan
karya SVG per halaman — sehingga demo berperilaku seperti situs web lengkap, bukan satu halaman.

## Verifikasi dari terminal

```bash
# satu origin, alur agen lengkap
node examples/agent/compliant-agent.js https://demo.aifeed.md --use retrieval --fetch

# semua origin, live
npm run verify:live

# perilaku enforcement (strict)
curl -i -A 'GPTBot/1.0' https://strict.aifeed.md/          # 403
curl -i -A 'Scrapy/2.11' https://strict.aifeed.md/         # 429 + Retry-After
curl -i -H 'Accept: text/aifeed+markdown' https://strict.aifeed.md/   # 200 bertanda tangan
```

## Regenerasi

```bash
npm run demos         # generate site/demos/** + artefak apex + site/revoke/**
npm run demos:check   # generate, lalu verifikasi setiap manifest dan dokumen revokasi
```

`demos:check` berjalan di dalam `npm run verify`. Pohon hasil generate di-gitignore dan
dibangun ulang pada setiap deploy.

## Anchor DNS

Setiap origin menerbitkan record TXT `_aifeed.<domain>` dengan public key dan fingerprint
demo-nya (`v=aifeed1; pk=…; fp=…; manifest=…`). Anchor dibuat dari `demos/keys.js` selama
setup Cloudflare yang dijelaskan di [`deploy-site.md`](deploy-site.md).
