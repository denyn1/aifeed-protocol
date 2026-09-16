# Kebijakan Keamanan

<p><a href="SECURITY.md">English</a> · <a href="SECURITY.id.md">Bahasa Indonesia</a> · <a href="SECURITY.zh.md">中文</a></p>

## Versi yang didukung

| Versi | Status | Perbaikan keamanan |
|---|---|---|
| AIFeed Markdown v1.0 (AIFeed 1.0.x draft) | saat ini | ya |
| AIFeed 0.2.x (profil MAKO) | dipelihara | ya |
| AIFeed 0.1.x | legacy | upaya terbaik |

## Melaporkan kerentanan

Jangan buka issue publik. Gunakan **security advisory privat** repositori
(tab Security → "Report a vulnerability"), yang menjangkau maintainer secara privat. Bila
kanal itu tidak bisa dipakai, hubungi maintainer yang tercantum di `GOVERNANCE.md` dan
minta kanal aman sebelum berbagi detail.

Sertakan:

- komponen terdampak (`lib/mako.js`, `bin/cli.js`, klien Python, plugin WordPress,
  schema, spec),
- reproduksi minimal (byte input, perintah, atau jejak HTTP),
- penilaian dampak (mis. bypass tanda tangan, bypass izin, parsing YAML, DoS),
- apakah ada vektor konformansi terbit yang gagal.

## Cakupan

Dalam cakupan: bypass verifikasi tanda tangan, replay lintas format/konteks, bypass izin
(pelanggaran restrict-only), integritas digest/indeks, efek samping parser (polusi,
kehabisan memori), masalah hak istimewa plugin, dan penanganan downgrade.

Di luar cakupan: fixture tes self-signed, pengecualian tes loopback localhost, dan
serangan yang membutuhkan kontrol awal atas private key atau DNS origin.

## Kompromi kunci dan revokasi

Bila kunci penanda tangan bocor:

1. Terbitkan kunci baru mengikuti runbook rotasi ([`docs/rotation.md`](docs/rotation.md)):
   pengumuman penerus, overlap terbatas, cutover.
2. Minta dokumen revokasi untuk fingerprint lama lewat proses registry di
   `GOVERNANCE.md`.
3. Tanda tangani ulang manifest dengan kunci baru; klien dengan pinning kunci akan
   memberi alarm pada perubahan (memang desainnya).

## Disclosure

Kami berupaya mengakui laporan dalam 7 hari dan mengirim perbaikan atau mitigasi dalam
30 hari untuk isu berkeparahan tinggi. Kredit diberikan di changelog kecuali Anda memilih
anonim.
