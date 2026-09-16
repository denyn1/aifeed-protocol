# Plugin WordPress AIFeed (v1.0.0-draft)

<p><a href="README.md">English</a> · <a href="README.id.md">Bahasa Indonesia</a> · <a href="README.zh.md">中文</a></p>

**SDK sisi penerbit** referensi untuk AIFeed. Plugin ini membuat pasangan kunci Ed25519,
membangun manifest yang sesuai schema dari data situs WordPress Anda, menandatanganinya
(RFC 8785 JCS + Ed25519), menyajikannya di `/.well-known/ai.json` dengan tanda tangan
detached di `/.well-known/ai-signature.json`, dan **mengiklankannya untuk discovery**
(header `Link: rel="ai-feed"`, elemen `<link rel="ai-feed">`, dan petunjuk `robots.txt`)
agar klien AI menemukan dan mengikuti deklarasi pada kontak pertama.

Manifest v0.2 menyajikan byte markdown bertanda tangan yang sama dalam **dua profil
konten**: **AIFeed Markdown** — native AIFeed (`Accept: text/aifeed+markdown`,
`aimd: "1.0"`) — dan **MAKO** kompatibilitas (`Accept: text/mako+markdown`). Setiap media
type membawa konteks tanda tangannya sendiri (`aimd1:` / `mako1:`), replay lintas format
ditolak, dan indeks delta diterbitkan di `/.well-known/aifeed-index.json` dan
`/.well-known/mako-index.json` dengan tanda tangan yang sesuai. Manifest mendeklarasikan
`content.profile: "both"` dan `content.index_url`.

Mode operasi:

- **Dual-stack (default):** body bersama dibatasi rekomendasi MAKO
  (`aifeed_mako_max_tokens`, default 1.000); profil manifest `both`.
- **AIFeed Markdown-only:** tambahkan `add_filter('aifeed_dual_stack', '__return_false');`
  — permintaan Mako fallback ke HTML, manifest mengiklankan `aifeed-md`, dan budget body
  naik ke `aifeed_aimd_max_tokens` (default 4.000).

Gambar, video, audio, dokumen, dan arsip dicantumkan sebagai tautan di `aifeed.assets`
(plus bagian body "Media & Unduhan") agar agen dapat memutuskan apa yang diunduh; indeks
membawa **resume situs** dan **field triage** per entri, dan plugin juga menyajikan
`/llms.txt` untuk tooling non-AIFeed. Bila plugin `mako-wp` terdeteksi, pembuatan
didelegasikan kepadanya dan AIFeed tetap menerbitkan manifest dan kebijakan bertanda tangan.

## Status

Release candidate. **Diverifikasi end-to-end di WordPress nyata** (PHP 8.4 + drop-in
SQLite resmi, dipasang headless): aktivasi plugin, pembuatan kunci (sodium → SPKI DER),
penandatanganan dengan self-verification, penyajian HTTP `/.well-known/ai.json` + tanda
tangan, penyimpanan Settings API, aksi sign admin dengan cek nonce, penolakan nonce
hilang (403), penolakan permintaan tanpa autentikasi (400, aksi tidak dijalankan), dan
shortcode badge di front end — **17/17 pemeriksaan lulus**, dan manifest yang disajikan
diverifikasi independen sebagai **VERIFIED** oleh SDK Node (termasuk lapisan `raw_digest`).
Lapisan MAKO diverifikasi di lingkungan yang sama: manifest v0.2 dengan `content.mako`,
negosiasi konten dengan header wajib MAKO, verifikasi tanda tangan inline terhadap kunci
manifest (body yang diubah ditolak), tautan alternate di HTML, dan indeks delta bertanda
tangan dengan digest entri yang cocok.

Direkomendasikan sebelum rilis publik:

```bash
php -l aifeed.php
php -l includes/class-aifeed-jcs.php   # dan include lainnya
php tests/jcs-test.php                 # cek fixture JCS + Ed25519 lintas bahasa
php tests/mako-test.php                # konverter MAKO + round-trip penandatanganan
```

dan satu putaran di host berbasis MySQL (baru drop-in SQLite yang diuji di sini).

## Mode operasi

- **Otomatis (zero-touch, default):** saat aktivasi plugin membuat kunci, memilih profil
  terdeteksi, menandatangani, menyajikan, mengiklankan, dan menandatangani ulang otomatis
  saat nama/URL situs berubah atau plugin di-(de)aktifkan, plus cron bulanan. Tidak ada
  aksi admin yang pernah diperlukan.
- **Semi-otomatis:** deteksi yang sama, tetapi perubahan situs diantrekan dan ditampilkan
  sebagai notis "Review & re-sign"; tidak ada yang berubah sampai Anda menyetujui.
- **Manual:** kontrol penuh — pengaturan granular plus JSON manifest kustom opsional
  (stempel waktu validity diperbarui otomatis; `identity.public_key` harus cocok dengan
  kunci penanda tangan situs atau penandatanganan ditolak).

Profil: `blog`, `news`, `ecommerce`, `marketplace`, `government`, `open`, `restrictive`.

Multisite: Network Admin → AIFeed menerapkan profil secara massal dan menandatangani
setiap situs dalam satu klik (setiap situs mendapat manifest origin-nya sendiri).

**Catatan skala:** AIFeed memakai SATU manifest per origin. Situs dengan ribuan atau
jutaan halaman tetap menerbitkan satu `/.well-known/ai.json`; tidak ada pekerjaan per
halaman yang diperlukan.

## Tata letak

```
wp-plugin/
├── aifeed.php                          # bootstrap, hooks, cron
├── uninstall.php
├── readme.txt                          # readme WordPress.org
├── assets/admin.css
├── includes/
│   ├── class-aifeed-jcs.php            # kanonikalisasi RFC 8785 (urutan kunci UTF-16)
│   ├── class-aifeed-keys.php           # keygen, SPKI DER, fingerprint, penandatanganan
│   ├── class-aifeed-mako-html.php      # konversi HTML ke Markdown untuk MAKO
│   ├── class-aifeed-manifest.php       # pembangun manifest + validasi esensial (v0.2)
│   ├── class-aifeed-signer.php         # sign, self-verify, simpan, tulis statis opsional
│   ├── class-aifeed-mako.php           # negosiasi AIFeed Markdown + MAKO, tanda tangan, indeks delta
│   ├── class-aifeed-publisher.php      # menyajikan /.well-known/* via template_redirect
│   ├── class-aifeed-badge.php          # shortcode [aifeed_badge]
│   └── class-aifeed-admin.php          # layar pengaturan, aksi, instruksi DNS
└── tests/
    ├── jcs-test.php                    # tes diferensial vs fixture buatan Node
    └── mako-test.php                   # round-trip konversi MAKO + sign/verify
```

## Jaminan lintas bahasa

`tests/jcs-test.php` membandingkan kanonikalisasi PHP terhadap fixture yang dihasilkan
implementasi referensi Node (`tools/jcs-php-fixtures.json`) dan memverifikasi tanda tangan
manifest bertanda Node dengan `sodium_crypto_sign_verify_detached`.

`tests/mako-test.php` menguji konverter AIFeed Markdown dan MAKO plus primitif
penandatanganan secara mandiri (tanpa WordPress): separasi `aimd`/`aimd-index`/`mako`/
`mako-index` berbeda, tanda tangan terverifikasi pada separasi yang benar, tamper dan
replay lintas URL ditolak, dan replay lintas konteks (tanda tangan AIFeed Markdown
disajikan sebagai MAKO) gagal.

## Catatan keamanan

- Private key: opsi `aifeed_secret_key` (autoload dinonaktifkan) atau konstanta
  `AIFEED_SECRET_KEY`. Cadangkan database Anda.
- Jalur penyajian mengembalikan byte tersimpan persis (integritas `raw_digest` tingkat byte).
- Respons MAKO membawa `Vary: Accept`; header `X-Mako-*` dan `X-Aifeed-*` tidak pernah
  dikirim pada `401`/`403` (mencegah enumerasi resource).
- Dokumen MAKO hanya diturunkan dari konten pos terbit; draf dan pos privat tidak pernah
  disajikan.
- `/llms.txt` adalah teks discovery tanpa tanda tangan (llms.txt v2). Izin selalu berasal
  dari manifest bertanda tangan dan tanda tangan MAKO; jangan pernah memperlakukan llms.txt
  sebagai sumber trust.
- Konten pos, halaman, dan media tidak pernah ditulis atau dihapus plugin. Uninstall
  menghapus opsi plugin, cache MAKO per pos (`_aifeed_mako_cache`), serta transient indeks
  dan llms.txt — tidak ada yang lain.
- Semua aksi admin memakai cek capability dan nonce; input disanitasi dan output di-escape.

## Lisensi dan kebijakan open-core

MIT. Jalur verifikasi AIFeed (spec, schema, verifier, vektor, tooling penerbit) permanen
terbuka di bawah kebijakan open core + open standard proyek; hanya secret, data pelanggan,
dan taktik anti-abuse yang tetap privat. Lihat `GOVERNANCE.md` ("Licensing and open-core
policy").
