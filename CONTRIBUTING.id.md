# Berkontribusi ke AIFeed

<p><a href="CONTRIBUTING.md">English</a> · <a href="CONTRIBUTING.id.md">Bahasa Indonesia</a> · <a href="CONTRIBUTING.zh.md">中文</a></p>

Terima kasih telah membantu menjadikan AIFeed standar global yang tepercaya. Repositori ini
menampung spesifikasi, implementasi referensi, vektor konformansi, dan penerbit WordPress.

Sebelum mengubah apa pun, baca kontrak pemeliharaan:
[`AGENTS.md`](AGENTS.md) (file hasil generate, lokasi versi, jebakan),
[`docs/architecture.md`](docs/architecture.md) (peta modul, invarian), dan
[`docs/release.md`](docs/release.md) (langkah rilis/upgrade).

## Cara berkontribusi

- **Umpan balik spesifikasi** — buka issue yang menjelaskan masalah, bagian yang
  terpengaruh, dan proposal konkret. Perubahan breaking butuh catatan dampak versi.
- **Implementasi** — pull request diterima untuk `lib/`, `bin/`, `clients/python/`,
  `packages/`, `wp-plugin/`, dan tooling.
- **Vektor konformansi** — kasus positif/negatif baru adalah cara tercepat meningkatkan
  interoperabilitas. Sertakan kode error/warning yang diharapkan.
- **Terjemahan** — spesifikasi kanonik dalam bahasa Inggris; terjemahan resmi ada di
  `spec/<lang>/`. Lihat kebijakan bahasa di bawah.
- **Laporan integrasi** — hasil pilot, setup edge (nginx/Caddy/Cloudflare), dan angka
  performa sangat berharga. Gunakan template di `pilot/`.

## Persyaratan untuk perubahan spec

1. Nyatakan label bukti ([F] fakta, [M] masuk akal, [E] model, [S] simulasi terukur,
   [H] review hukum) untuk setiap klaim faktual.
2. Jalankan gerbang tunggal dan jaga tetap hijau:
   ```bash
   npm run verify
   ```
   Gerbang ini mencakup pemeriksaan sintaks, cek versi/konsistensi, suite JS + Python,
   semua cek vektor, sinkronisasi SDK, cek paper, dan build situs. Lihat `AGENTS.md`
   untuk kontrak lengkapnya (file hasil generate, lokasi versi, label bukti).
3. Perbarui kedua direktori bahasa (`spec/en/` kanonik, `spec/id/` terjemahan) dan
   `spec/zh/`, atau tandai terjemahan sebagai pending di deskripsi PR.
4. Tambah atau perbarui vektor konformansi untuk setiap perubahan perilaku normatif.
5. Untuk perubahan PHP, jalankan `php -l` pada file yang diubah plus
   `php tests/jcs-test.php && php tests/mako-test.php`.

## Pedoman kode

- Tanpa dependensi runtime (Node >= 20, PHP >= 7.2, Python murni) adalah aturan keras.
- Parser harus mengikuti aturan parsing ketat/aman: kunci duplikat ditolak, NFC
  diwajibkan, integer terbatas, hanya subset YAML aman, tanpa polusi `__proto__`.
- Tanpa secret di tes atau fixture; gunakan seed deterministik.
- Jaga kode error tetap stabil setelah diterbitkan; kode baru bersifat aditif.

## Kebijakan terjemahan

Dokumen Inggris di `spec/en/` bersifat normatif. Terjemahan resmi bersifat informasional;
bila berbeda, Inggris yang berlaku. Bahasa prioritas: enam resmi PBB plus Indonesia,
Portugis, Hindi, dan Kiswahili. Buka satu PR per bahasa dan jaga struktur baris mendekati
sumber untuk mempermudah review.

## Lisensi kontribusi

Inbound sama dengan outbound, tanpa CLA:

- Kode (`lib/`, `bin/`, `clients/`, `packages/`, `integrations/`, `tools/`, plugin) —
  MIT.
- Teks spesifikasi (`spec/`) — CC BY 4.0.
- Vektor konformansi (`conformance/`) — CC0.

Dengan membuka pull request Anda menyatakan berhak mengirimkan karya tersebut di bawah
ketentuan ini. Kontribusi ke daftar pola anti-abuse atau heuristik deteksi tidak diterima
lewat issue atau pull request publik (lihat `GOVERNANCE.md`, "Licensing and open-core
policy").

## Governance dan keamanan

Lihat `GOVERNANCE.md` dan `SECURITY.md`. Jangan buka issue publik untuk laporan keamanan.
