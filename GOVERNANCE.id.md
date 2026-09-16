# Governance AIFeed (interim)

<p><a href="GOVERNANCE.md">English</a> · <a href="GOVERNANCE.id.md">Bahasa Indonesia</a> · <a href="GOVERNANCE.zh.md">中文</a></p>

AIFeed adalah standar terbuka dengan registry publik (revokasi) dan model trust bersama.
Dokumen ini menjelaskan bagaimana keputusan diambil hari ini dan jalur menuju yayasan
multi-pemangku kepentingan.

## Status saat ini

AIFeed berada di tahap draf (AIFeed Markdown v1 / AIFeed 0.2.x). Governance bersifat
**interim**: sekelompok maintainer ("para maintainer") mengelola spesifikasi, implementasi
referensi, vektor konformansi, dan proses registry revokasi.

## Pengambilan keputusan

1. **Lazy consensus** untuk perubahan rutin: pull request dengan check hijau dan tanpa
   keberatan selama 7 hari langsung di-merge.
2. **Perubahan spesifikasi** membutuhkan persetujuan dua maintainer dan entri changelog;
   perubahan breaking membutuhkan catatan dampak versi dan jendela komentar 14 hari.
3. **Aksi registry** (revokasi, peristiwa kunci) mengikuti proses multi-tanda-tangan:
   persetujuan oleh kunci maintainer berbeda yang memenuhi ambang yang dikonfigurasi
   (interim 2-of-3, target 3-of-5), tercatat di transparency log.
4. **Sengketa** dieskalasi menjadi ringkasan tertulis di issue tracker; konflik
   kepentingan wajib dideklarasikan.

## Peran

- **Maintainer** — hak merge, rilis, partisipasi registry, respons keamanan.
- **Kontributor** — siapa pun yang PR, vektor, terjemahan, atau laporannya diterima.
- **Reviewer konformansi** — menjalankan vektor secara independen; dapat dicantumkan di
  rilis.

Daftar maintainer publik (nama, peran, kunci) diterbitkan pada setiap rilis. Sampai daftar
itu terbit, security advisory privat repositori dan maintainer yang dapat dihubungi lewat
situs proyek adalah kanal kontaknya.

## Komitmen netralitas

- Spesifikasi, schema, dan vektor uji dilisensikan untuk penggunaan ulang tanpa batas
  (CC BY 4.0 / MIT / CC0) sehingga tidak ada vendor tunggal yang mengendalikan
  implementasi.
- Proses registry, persyaratan kunci, dan kriteria revokasi bersifat publik dan
  terdokumentasi; perubahannya mengikuti proses perubahan spesifikasi di atas.
- Tanpa pay-to-allow listing; pencantuman adalah verifikasi teknis, bukan tier komersial.
- Implementasi independen secara eksplisit disambut; konformansi diuji oleh vektor,
  bukan oleh afiliasi.

## Lisensi dan kebijakan open-core

AIFeed adalah proyek **open core + open standard**. Kepercayaan pada protokol bergantung
pada kemampuan siapa pun memverifikasi deklarasi dan mereproduksi konformansi, sehingga
jalur verifikasi permanen terbuka.

### Tetap terbuka (tanpa pengecualian)

| Komponen | Lisensi |
|---|---|
| Spesifikasi dan schema (`spec/`, `schema/`) | CC BY 4.0 |
| Verifier, parser, SDK (`lib/`, `clients/`, `packages/`) | MIT |
| CLI, plugin WordPress, integrasi, tools | MIT |
| Vektor konformansi (`conformance/`) | CC0 |
| Klien dan format revokasi/transparency-log | MIT |

TIDAK BOLEH ada ekstensi proprietary di jalur verifikasi: implementasi konform apa pun yang
dibangun dari artefak terbuka harus dapat memverifikasi manifest, dokumen, dan pemeriksaan
revokasi secara end-to-end.

### Tetap tertutup

| Item | Alasan |
|---|---|
| Private key, kunci penanda tangan registry, secret CI | Kriptografi, tidak pernah diterbitkan |
| Data pelanggan dan pilot | Privasi dan kontrak |
| Taktik anti-abuse (daftar pola, heuristik deteksi, model) | Menerbitkannya membuat penghindar beradaptasi; antarmuka dan kebijakan tetap terbuka |

### Lapisan komersial

Nilai disampaikan sebagai layanan, bukan kerahasiaan kode: registry terkelola dengan SLA,
enforcement-as-a-service untuk host/CDN (lihat `benchmarks/edge/`), sertifikasi
konformansi, pilot, dukungan, dan fitur enterprise opsional (SSO, peran, laporan audit)
yang boleh open-core. Sisi klien yang diperlukan untuk mengonsumsi AIFeed tetap MIT.

### Merek dan sertifikasi

Nama "AIFeed" dan badge "AIFeed Verified" adalah merek yang dikendalikan: fork bebas ada
dengan namanya sendiri, dan hanya implementasi yang lulus vektor konformansi terbit yang
boleh memakai merek tersebut. Lisensi kontribusi adalah inbound=outbound (MIT untuk kode,
CC BY 4.0 untuk teks spesifikasi, CC0 untuk vektor); tanpa CLA.

## Peta jalan menuju yayasan

Target sebelum pembekuan 1.0:

1. Terbitkan daftar maintainer dengan kunci dan kebijakan rotasi.
2. Pindahkan registry revokasi ke badan multi-pemangku kepentingan dengan piagam publik.
3. Operasikan transparency log dengan checkpoint bertanda tangan (format C2SP signed-note).
4. Terbitkan laporan transparansi tahunan (aksi registry, insiden, sengketa).

## Versioning dan deprecation

- Versi protokol adalah `0.x` hingga pembekuan pertama; perubahan breaking menaikkan minor.
- Kode error, media type, dan separasi byte bertanda tangan diberi versi dan tidak pernah
  dipakai ulang secara diam-diam.
- Deprecation diumumkan di changelog dengan minimal satu siklus minor overlap.
