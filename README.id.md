<p align="center">
  <img src="aifeed-logo.svg" width="92" alt="Logo AIFeed">
</p>

<h1 align="center">AIFeed</h1>

<p align="center"><a href="README.md">English</a> · <a href="README.id.md">Bahasa Indonesia</a> · <a href="README.zh.md">中文</a></p>

<p align="center"><strong>Izin konten bertanda tangan untuk web AI.</strong><br>
Deklarasikan, tanda tangani, dan cabut apa yang boleh dilakukan agen AI terhadap konten
Anda — dan biarkan agen membuktikannya.</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@aifeed/verify"><img src="https://img.shields.io/npm/v/@aifeed/verify?color=f55036&label=npm" alt="versi npm"></a>
  <img src="https://img.shields.io/badge/tests-214%20JS%20%C2%B7%2044%20Python-3ddc97" alt="suite pengujian">
  <img src="https://img.shields.io/badge/conformance-84%20vectors-f55036" alt="vektor konformansi">
  <img src="https://img.shields.io/badge/specs-CC%20BY%204.0-6ea8fe" alt="lisensi spesifikasi">
  <img src="https://img.shields.io/badge/code-MIT-3ddc97" alt="lisensi kode">
  <img src="https://img.shields.io/badge/status-1.0.0--draft-ffb454" alt="status">
</p>

<p align="center">
  <a href="https://aifeed.md">Situs web</a> ·
  <a href="https://aifeed.md/process.html">Alur protokol</a> ·
  <a href="https://aifeed.md/enforcement-report.html">Benchmark</a> ·
  <a href="https://aifeed.md/penjelasan.html">Panduan lengkap</a> ·
  <a href="paper/aifeed-preprint.pdf">Paper (PDF)</a>
</p>

---

## Mengapa AIFeed?

Agen AI kini menghasilkan porsi besar dan terus tumbuh dari trafik web, tetapi sinyal
yang menyatakan apa yang boleh mereka lakukan hanyalah **file teks tanpa tanda tangan**.
Siapa pun bisa mengeditnya, tidak ada yang mengikatnya ke sebuah domain, dan tidak ada
cara mencabutnya. Asimetrinya terukur:

- **1,9 miliar** crawl mengabaikan aturan `robots.txt` dalam satu setengah tahun (satu vendor).
- Rasio crawl-ke-rujukan **70.900 : 1** terukur pada salah satu penyedia AI besar.
- Bot AI rata-rata **4,2 %** dari permintaan HTML sepanjang 2025, memuncak di 6,4 %.

AIFeed mengganti "tolong hormati file ini" dengan deklarasi yang dapat diverifikasi
secara kriptografis, plus konten ringan siap-agen yang memangkas biaya di **kedua** sisi.

## Cara kerjanya

1. **Buat pasangan kunci Ed25519** — private key tidak pernah meninggalkan origin.
2. **Terbitkan manifest bertanda tangan** di `/.well-known/ai.json`: izin per penggunaan
   (training, retrieval, kutip, …), batas crawl, lisensi, revisi.
3. **Anchor kuncinya di DNS** (TXT `_aifeed`) agar manifest tidak bisa dipalsukan domain
   lain.
4. **Agen memverifikasi rantainya** — TLS → domain → tanda tangan (JCS + Ed25519) → anchor
   DNS — dan memeriksa ulang **registry revokasi multi-tanda-tangan** pada setiap pemakaian.
5. **Rotasi kunci dengan aman** — umumkan penerus lewat direktif bertanda tangan kunci
   lama (plus cross-check DNS `pk2` yang advisory), jaga overlap terbatas, cutover, lalu
   cabut kunci lama secara permanen. Runbook: [`docs/rotation.md`](docs/rotation.md).
6. **Sajikan konten ringan** lewat salah satu dari dua profil (di bawah), dengan **indeks
   delta** bertanda tangan sehingga halaman yang tak berubah berbiaya 0 byte.

**Untuk agen AI:** panduan periksa-dulu (discovery → verifikasi → keputusan izin → delta →
penanganan kegagalan) ada di
[`docs/agent-quickstart.md`](docs/agent-quickstart.md),
dengan contoh yang bisa dijalankan di
[`examples/agent/compliant-agent.js`](examples/agent/compliant-agent.js).

## Coba

```bash
npm install @aifeed/verify
```

```js
const sdk = require('@aifeed/verify');

const base = 'https://example.com/.well-known/';
const manifest = await sdk.fetchText(base + 'ai.json');
const signature = await sdk.fetchText(base + 'ai-signature.json');

const result = sdk.verifyAll({
  manifestText: manifest.text,
  manifestBytes: manifest.buffer,
  signatureText: signature.text,
  domain: 'example.com'
});
console.log(result.result, result.errors);
```

CLI-nya ada di repositori ini (tanpa dependensi, Node ≥ 20):

```bash
cd aifeed-protocol
node bin/cli.js keygen --out keys/
node bin/cli.js validate https://example.com
node bin/cli.js site build ./public --domain example.com --key keys/aifeed-private.pem
```

## Dua profil konten

| Profil | Media type | Ekstensi | Catatan |
|---|---|---|---|
| **AIFeed Markdown** (native) | `text/aifeed+markdown` | `.aifeed.md` | Blok kebijakan bertanda tangan in-band, token budget, `alternates` terjemahan, metadata triage |
| **MAKO** (kompatibilitas) | `text/mako+markdown` | `.mako.md` | Profil trust MAKO eksternal, disajikan dari byte bertanda tangan yang sama dengan konteks tanda tangan sendiri |

Origin dual-stack menyajikan keduanya; replay lintas format ditolak by design.

## Hasil terukur

Semua angka dapat direproduksi dari artefak yang di-commit (`npm run bench:mako`,
`npm run bench:enforcement`); lingkungan uji adalah satu mesin pada jaringan loopback
dengan korpus sintetis 60 halaman. Baseline jujur disertakan.

| Apa | Hasil | Label |
|---|---|---|
| Konversi ke profil markdown vs HTML | **−68,83 %** byte terkirim | terukur |
| Konsumsi delta (10 % halaman berubah) | **−95,73 %** vs crawl HTML | terukur |
| Byte egress / CPU / koneksi puncak penerbit | **−55,19 % / −56,23 % / −88,24 %** | terukur (simulasi) |
| Byte diterima sisi AI (semua profil / klien patuh) | **−54,84 % / −72,93 %** | terukur (simulasi) |
| Halaman tak berubah yang dilewati | 14 dari 18 | terukur (simulasi) |
| Biaya verifikasi tanda tangan | **0,70 ms / halaman** | terukur |

Pilot live 30 hari **belum** dijalankan; proyeksi per 1.000 tenant berlabel ekstrapolasi
model, dan klaim vendor hingga 94 % pengurangan token membutuhkan summarisasi semantik
yang tidak dilakukan proyek ini secara otomatis.

## Isi repositori ini

| Path | Isi |
|---|---|
| [`lib/`](lib/) + [`bin/`](bin/) | Implementasi referensi tanpa dependensi dan CLI |
| [`conformance/`](conformance/) | Vektor konformansi: 34 manifest · 39 MAKO · 11 AIFeed Markdown |
| [`wp-plugin/`](wp-plugin/) | Plugin WordPress: manifest bertanda tangan, dual-stack AIFeed Markdown + MAKO, `/llms.txt` |
| [`spec/`](spec/) | Spesifikasi EN/ID/ZH: manifest v0.1/v0.2, AIFeed Markdown v1.0 |
| [`schema/`](schema/) | JSON Schema untuk manifest, tanda tangan, AIFeed Markdown, MAKO |
| [`paper/`](paper/) | Preprint: sumber LaTeX, PDF, ledger klaim, bundel arXiv |
| [`docs/`](docs/) | Quickstart agen, panduan deploy dan namespace, catatan proyek |
| [`REFERENCE.md`](REFERENCE.md) | Detail implementasi referensi, apa yang diverifikasi, quickstart CLI |

## Dokumentasi

- Spesifikasi: [`spec/en`](spec/en) · [`spec/id`](spec/id) · [`spec/zh`](spec/zh) · [schema](schema)
- Implementasi referensi: [`REFERENCE.md`](REFERENCE.md)
- Kontrak pemeliharaan (agen AI & dev): [`AGENTS.md`](AGENTS.md)
- Arsitektur: [`docs/architecture.md`](docs/architecture.md) · Panduan rilis: [`docs/release.md`](docs/release.md)
- Quickstart agen (sisi klien): [`docs/agent-quickstart.md`](docs/agent-quickstart.md)
- Panduan lengkap: [`penjelasan-aifeed.html`](penjelasan-aifeed.html) (sumber <https://aifeed.md/penjelasan.html>)
- Kebijakan keamanan: [`SECURITY.md`](SECURITY.md)
- Governance & kebijakan open-core: [`GOVERNANCE.md`](GOVERNANCE.md)
- Deploy situs: [`docs/deploy-site.md`](docs/deploy-site.md)
- Catatan submission arXiv: [`paper/ARXIV-SUBMISSION.md`](paper/ARXIV-SUBMISSION.md)

## Status

- Rilis **`1.0.0-draft`** — spesifikasi **belum dibekukan**. Versi wire: manifest
  `0.1`/`0.2`, AIFeed Markdown `1.0`, MAKO `0.2`.
- Konformansi: 34 vektor manifest + 39 MAKO + 11 AIFeed Markdown, dijalankan oleh
  verifier JavaScript dan Python yang independen, plus fixture diferensial PHP, 90.000+
  eksekusi fuzz, dan uji end-to-end WordPress.
- Tidak diklaim: review kriptografi eksternal dan pilot live (keduanya tertunda);
  kompromi origin+DNS tidak terdeteksi pada kontak pertama.

## Lisensi dan kontak

Spesifikasi **CC BY 4.0** · kode referensi dan plugin **MIT** · vektor **CC0**.
Kontak: <contact@aifeed.md> — laporan keamanan sesuai
[`SECURITY.md`](SECURITY.md).
