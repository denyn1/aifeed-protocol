# Checklist submission paper (arXiv → IETF nanti)

<p><a href="CHECKLIST.md">English</a> · <a href="CHECKLIST.id.md">Bahasa Indonesia</a> · <a href="CHECKLIST.zh.md">中文</a></p>

Kunci status: **[x]** selesai dan terverifikasi · **[ ]** tertunda · **[!]** blocker untuk submission.

## Metadata

- **[x]** Judul: *AIFeed: Verifiable Content Permissions and Efficient Agent
  Delivery for the AI Web* (judul kerja).
- **[x]** Penulis kolektif: `AIFeed Protocol Contributors`.
- **[!]** Email kontak untuk penulis kolektif — konfirmasi sebelum upload
  (placeholder `contact@aifeed.md` di draf).
- **[x]** Kategori utama: `cs.CR` (kriptografi dan keamanan); cross-list `cs.CY`
  (komputer dan masyarakat) dan opsional `cs.NI`.
- **[x]** Lisensi preprint: **CC BY 4.0** (sesuai spesifikasi).
- **[x]** Panjang abstrak di bawah 1.920 karakter (diperiksa di `main.tex`).
- **[!]** Akun arXiv + endorsement untuk `cs.CR` — wajib untuk submission pertama dari
  penulis baru; mulai lebih awal, bisa memakan hari.

## Referensi (audit presisi)

- **[x]** RFC diverifikasi terhadap header rfc-editor.org (17 entri: 2119, 8174, 3339,
  8032, 8259, 7493, 8615, 9110, 9309, 9421, 9530, 9162, 8288, 6838, 7763, 7231 + DOI
  `10.17487/*`).
- **[x]** Draf IETF dipin ke revisi + tanggal:
  `draft-ietf-aipref-vocab-08` (2026-09-14), `draft-ietf-aipref-attach-05` (2026-08-19),
  `draft-ietf-webbotauth-httpsig-protocol-00` (2026-09-01),
  `draft-meunier-web-bot-auth-architecture-05` (2026-03-02).
- **[x]** Spesifikasi MAKO dipin ke commit `de7c0d59` (2026-02-18, Apache-2.0).
- **[x]** Sumber industri terverifikasi dapat dijangkau beserta tanggal: Cloudflare Radar
  2025, Cloudflare crawl-to-refer (2025-07-01), Content Signals (2025-09), Responsible AI
  Bot Principles (2025-09-24), Pay Per Crawl (2025-07-01), TollBit H1 2026 (beranda),
  Pew Research (2025-07-22).
- **[x]** Sitasi peer-review / akademik terverifikasi dengan penulis, tahun, DOI/arXiv ID:
  Liu dkk. (IMC 2025), Lee dkk. (C&S 2009, `10.1016/j.cose.2009.05.004`), Ge & Ding
  (TST 2016, `10.1109/tst.2016.7787007`), Chowdhury (2026), Steinacker-Olsztyn dkk.
  (2025), Li dkk. (2025), Munirathinam (2026), Archer dkk. (2026), Hoetzlein (2026).
- **[x]** Inspeksi prior-art (2026-09-15) atas proyek berdekatan tercatat di `CLAIMS.md`
  (C29/C30): `ai-policy.json`, `agents.txt`, `CrawlWall`, `terms.txt`; paper menyatakan
  klaim kombinasi, bukan eksklusivitas.
- **[ ]** Tambahkan DOI ACM untuk Liu dkk. IMC 2025 begitu ditemukan (saat ini disitasi
  sebagai "arXiv:2411.15091, accepted at IMC 2025").
- **[ ]** Periksa ulang semua pin/URL sekali lagi pada hari submission (draf bergerak).

## Ledger klaim

- **[x]** `CLAIMS.md` mencakup setiap klaim kuantitatif dengan sumber + jenis
  (pengukuran / simulasi / laporan industri / peer-review / standar).
- **[x]** Hasil tidak menguntungkan disertakan: selisih klaim vendor (−94% token vs
  konversi byte −68,8%), nol penghematan tanpa adopsi/enforcement, batas TOFU,
  ketergantungan draf pihak ketiga.
- **[x]** Disclosure perusahaan/COI disusun: penulis adalah perancang protokol;
  mitigasinya terdaftar (artefak terbuka, perintah reproduksi, review eksternal
  tertunda).

## Artefak dan reproduktibilitas

- **[x]** Repositori git lokal diinisialisasi dengan `.gitignore` yang mengecualikan
  kunci dan cache.
- **[x]** URL repositori publik (GitHub) — https://github.com/denyn1/aifeed-protocol
  (publik, tag terpin `v1.0.0-draft`). Opsional: pindahkan ke organisasi `aifeed` nanti
  dan perbarui URL di `paper/main.tex` serta checklist ini.
- **[!]** Domain kanonik — **`aifeed.md` dibeli (2026-09-16)**. Migrasi
  `aifeed.org` → `aifeed.md` sudah diterapkan dan diuji regresi (lihat
  `docs/namespace-setup.md`). Sisa sebelum submission: konfigurasi DNS (A/AAAA +
  `www`, lihat dokumen), buat `contact@aifeed.md`, dan perbarui email kontak di draf ini
  bila berbeda dari placeholder.
- **[ ]** Tag snapshot yang disubmit (mis. `paper-v1`, `v1.0.0-draft`) agar reviewer
  dapat memin.
- **[x]** Perintah reproduksi terdokumentasi: `npm test`, `npm run test:py`,
  `npm run {vectors,mako:vectors,aimd:vectors}:check`, `npm run bench:mako`,
  `npm run bench:enforcement`, `npm run render:html`.
- **[x]** Catatan lingkungan jujur: satu mesin, harness loopback, korpus sintetis,
  seed deterministik; tanpa data CDN/pilot produksi.

## Mekanika manuskrip

- **[x]** Sumber LaTeX (`paper/main.tex`, `paper/refs.bib`) + cermin Markdown untuk
  review.
- **[x]** Cek silang struktural: `npm run paper:check` — 52/52 kunci sitasi resolve di
  `refs.bib`, semua environment LaTeX berimbang.
- **[!]** Cek kompilasi: tidak ada distribusi TeX lokal yang terdeteksi di mesin penulis;
  kompilasi di Overleaf atau setelah memasang TeX Live sebelum upload.
- **[x]** Gambar: tidak ada eksternal — tabel plus satu diagram TikZ inline, sehingga
  tidak ada file aset yang hilang saat kompilasi.
- **[ ]** Putaran proofread akhir untuk bahasa bias (tanpa kata pemasaran di klaim).

## Setelah arXiv

- **[ ]** Kirim `docs/EXTENSION.md` ke mako-spec (proposal lapisan trust hulu).
- **[ ]** Ubah inti protokol menjadi Internet-Draft IETF (dengan profil AIFeed Markdown/
  MAKO sebagai lampiran).
- **[ ]** Terbitkan ringkasan kebijakan lisensi open-core bersama paper (sudah ada di
  `GOVERNANCE.md`).
