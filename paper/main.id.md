# AIFeed: Verifiable Content Permissions and Efficient Agent Delivery for the AI Web

<p><a href="main.md">English</a> · <a href="main.id.md">Bahasa Indonesia</a> · <a href="main.zh.md">中文</a></p>

*Draf — penulis kolektif: AIFeed Protocol Contributors.*
*Sumber LaTeX: [`main.tex`](main.tex) · bibliografi: [`refs.bib`](refs.bib) ·
ledger klaim: [`CLAIMS.md`](CLAIMS.md) · checklist submission: [`CHECKLIST.md`](CHECKLIST.md)*

## Abstrak

Sistem AI kini mengonsumsi lebih banyak konten web daripada manusia, dan preferensi teks
polos di `robots.txt` tidak menahan mereka: satu vendor mencatat 1,9 miliar crawl yang
mengabaikan aturan robots dalam satu setengah tahun, dan satu pengukuran khusus web
menempatkan rasio crawl-ke-rujukan salah satu penyedia AI besar di 70.900:1. Sinyal
preferensi dan lisensi sudah ada, tetapi tidak dapat diatribusikan ke domain, tidak dapat
dicabut, dan tidak menyentuh biaya konsumsi berulang. Kami mendeskripsikan AIFeed, lapisan
trust terbuka yang dibangun di sekitar manifest bertanda tangan berisi izin machine-readable,
di-anchor di DNS dan diperiksa terhadap registry revokasi multi-tanda-tangan. Dua profil
konten menumpang pada byte bertanda tangan yang sama: format markdown native (AIFeed
Markdown) dan profil kompatibilitas untuk draf MAKO eksternal. Tiga properti, bila diambil
bersama, membedakan desain ini dari sinyal yang kami survei: provenance izin yang bertanda
tangan, pengikatan per halaman dengan override restrict-only, dan indeks delta ber-digest
yang memungkinkan agen melewati halaman yang tidak berubah.

Kami mengukur sistem pada artefak yang di-commit. Mengonversi korpus 60 halaman ke profil
markdown memangkas byte terkirim sebesar 68,8% (95,7% untuk konsumsi delta), dan harness
enforcement loopback dengan empat profil klien mencatat penghematan penerbit 55,2% byte dan
56,2% CPU, penghematan sisi AI 54,8% (72,9% untuk klien patuh), 14 dari 18 halaman tak
berubah dilewati, dan verifikasi tanda tangan 0,70 ms per halaman. Spesifikasi diuji oleh
34 vektor manifest, 39 MAKO, dan 11 AIFeed Markdown di bawah verifier JavaScript dan Python
yang independen, plus fixture diferensial PHP dan deployment WordPress end-to-end. Kami
juga melaporkan hasil yang tidak menyanjung desain: tanpa adopsi dan enforcement tidak ada
penghematan sama sekali; klaim vendor hingga 94% pengurangan token bergantung pada
summarisasi yang tidak dilakukan konverter kami; kompromi origin+DNS tak terlihat pada
kontak pertama; dan profil kompatibilitas bergantung pada draf pihak ketiga. Belum ada
review kriptografi eksternal atau pilot live.

## 1. Pendahuluan

Konten web makin banyak dikonsumsi agen otomatis alih-alih pengunjung manusia. Radar
Cloudflare menempatkan bot AI rata-rata 4,2% dari permintaan HTML pada 2025 (puncak 6,4%),
dengan trafik otomatis mendekati separuh seluruh permintaan HTML dan crawl agen "user
action" tumbuh lebih dari 15 kali lipat pada periode yang sama [cfRadar2025]. Asimetri
yang dihadapi penerbit lebih buruk dari angka agregat itu: satu pengukuran khusus web
menemukan rasio crawl-ke-rujukan 70.900:1 untuk salah satu penyedia AI besar [cfCrawlRefer],
dan satu vendor mencatat 22 miliar scrape AI dalam setengah tahun, 1,9 miliar di antaranya
mengabaikan `robots.txt` [tollbit].

Ekosistemnya tidak kosong. RFC 9309 dan draf IETF AIPREF mencakup preferensi robotik;
Content Signals Cloudflare, RSL, dan W3C TDM Reservation Protocol masing-masing
mengekspresikan semacam izin atau lisensi [rfc9309, draftAiprefVocab, draftAiprefAttach,
cfContentSignals, rsl, tdmrep]; `llms.txt` mengindeks situs untuk model bahasa [llmstxt];
dan di sisi lain pertukaran, Web Bot Auth membawa permintaan agen bertanda tangan ke
produksi [draftWebbotauth, cfBotPrinciples]. Yang hilang ada dua. Deklarasi penerbit tidak
dapat diatribusikan: perantara mana pun dapat mengubahnya, dan tidak ada standar yang
memungkinkan penerbit mencabutnya. Dan deklarasi yang dipatuhi pun membiarkan biaya
mekanis tak tersentuh, karena agen terus menarik halaman tak berubah sebagai HTML
berbentuk browser.

**Kontribusi.** (1) Desain AIFeed v0.1: manifest bertanda Ed25519, kanonik-JCS di
`/.well-known/ai.json`, ber-anchor DNS, dapat diverifikasi offline, dengan revokasi
multi-tanda-tangan dan staleness terbatas. (2) Profil konten: AIFeed Markdown v1.0 (native)
dan kompatibilitas MAKO atas byte bertanda tangan yang sama, override per halaman
restrict-only, metadata integritas aset (`mime`, `size`, `sha-256`), serta indeks delta
ber-digest dengan resume situs dan field triage. (3)
Tumpukan referensi tanpa dependensi: CLI, SDK JavaScript, verifier Python independen,
plugin WordPress, site builder statis, dan delapan adapter server. (4) Evaluasi yang dapat
direproduksi dengan artefak ter-commit, vektor konformansi, fuzzing, dan tes diferensial
lintas bahasa; hasil tidak menguntungkan dilaporkan berdampingan.

## 2. Latar Belakang dan Karya Terkait

- **Sinyal preferensi dan izin.** Preferensi robot distandardisasi di RFC 9309 [rfc9309],
  dan kelompok kerja IETF AIPREF kini menyusun kosakata preferensi penggunaan AI dengan
  mekanisme attachment untuk respons HTTP [draftAiprefVocab, draftAiprefAttach]. Industri
  bergerak lebih cepat: Content Signals Policy Cloudflare melaporkan adopsi di lebih dari
  3,8 juta domain melalui file robots terkelola [cfContentSignals], dengan penagihan
  pay-per-crawl di edge yang sama [cfPayPerCrawl]; RSL menambahkan ketentuan lisensi dan
  kompensasi [rsl]; W3C TDMRep menangani reservasi text-and-data-mining [tdmrep];
  `llms.txt` memberi model bahasa indeks tingkat situs [llmstxt]. Yang tidak disediakan
  semuanya: atribusi deklarasi ke domain, jalur revokasi, atau verifikasi independen dari
  kanal transport.
- **Autentikasi sisi agen.** Web Bot Auth [draftWebbotauth, draftWebbotArch] dibangun di
  atas RFC 9421 dan Ed25519 [rfc9421, rfc8032], dengan deployment produksi
  [cfBotPrinciples]. AIFeed menerapkan primitif yang sama dalam arah sebaliknya (penerbit
  yang menandatangani).
- **Format konten untuk agen.** MAKO mendefinisikan markdown per halaman dan secara
  eksplisit mengecualikan verifikasi autentisitas [makoSpec]. Beberapa proyek 2026
  menempati wilayah berdekatan: `ai-policy.json` mengumpulkan deklarasi izin di URL
  well-known, tanpa tanda tangan, anchor, atau revokasi [aipolicyjson]; `agents.txt`
  menaruh identitas, ketentuan, dan endpoint di file root [agentstxt]; CrawlWall menegakkan
  kebijakan crawler di edge dengan ledger audit dan kuitansi bertanda tangan [crawlwall];
  `terms.txt` paling jauh, menetapkan ketentuan per-path, per-tujuan dengan exchange
  bertanda tangan, token delegasi, dan negosiasi pembayaran [chowdhury2026]; di sisi
  akademik, `ai.txt` mengusulkan DSL untuk memandu interaksi AI [li2025aitxt]. Per inspeksi
  kami (2026-09-15), kami tidak menemukan satu proyek pun yang menggabungkan izin bertanda
  tangan penerbit dengan anchor DNS dan revokasi, profil konten ganda atas satu payload
  bertanda tangan, dan indeks delta yang dapat diverifikasi — klaim kami pada kombinasi
  itu, bukan pada penemuan bagian-bagiannya.
- **Pengukuran dan ekonomi.** Literatur empiris substansial mempelajari robot pada skala
  besar: analisis berbasis classifier atas penggunaan robots [lee2009], eksklusi sebagai
  protokol panduan [ge2016], gatekeeping berbasis robots [steinacker2025], efektivitas
  perlindungan kreator (IMC 2025) [liu2025], perlindungan organisasi kecil [hoetzlein2026],
  kepatuhan agen terhadap sinyal in-band [munirathinam2026], harga pay-per-crawl
  [archer2026]. Laporan industri menyediakan asimetri trafik [cfRadar2025, tollbit,
  cfCrawlRefer, cfContentIndependence], dan sebuah pusat riset mendokumentasikan bagaimana
  ringkasan AI memengaruhi pengguna [pew2025]. Konteks regulasi: EU AI Act dan studi
  kelayakan registry opt-out TDM 2026 [euAiact, euTdmRegistry]; UU PDP Indonesia sebagai
  contoh nasional [uuPdp27]. Catatan hukum adalah pertanyaan terbuka, bukan nasihat hukum.

## 3. Desain

**Rantai trust.** TLS → kecocokan domain → tanda tangan Ed25519 atas bentuk kanonik JCS
dengan domain separation (`aifeed.v0.2\n`) → anchor TXT DNS (`_aifeed`). URI well-known
[rfc8615]; JSON ketat/I-JSON [rfc8259, rfc7493]; stempel waktu RFC 3339 [rfc3339]; JCS
[rfc8785]; kata kunci BCP 14 [rfc2119, rfc8174]; pola transparency log [rfc9162]. Pinning
kunci mendeteksi penggantian; kompromi origin+DNS pada kontak pertama tidak terdeteksi.

**Izin dan revokabilitas.** Izin per penggunaan (search, retrieval, input, training, quote,
summarize, reproduce, translate, modify, embed, commercial use), atribusi, dan batas crawl.
Registry revokasi dengan dokumen multi-tanda-tangan, status due-process (`active`,
`under_review`, `suspended`), staleness terbatas (168 jam). Level trust `VERIFIED` /
`UNVERIFIED` / `SUSPENDED`.

**Profil konten.** AIFeed Markdown v1.0 (`text/aifeed+markdown`, `.aifeed.md`, penanda
`aimd: "1.0"`, prosedur media-type [rfc6838, rfc7763]) dan MAKO 1.0
(`text/mako+markdown`) [makoSpec]. Server dual-stack mengirim byte identik di kedua media
type dengan konteks tanda tangan berbeda (`aimd` / `mako`), mencegah replay lintas format.
Blok `aifeed` per halaman default restrict-only; tautan aset membiarkan agen memilih apa
yang di-fetch, dengan opsi `mime`, `size`, dan `sha-256` (di-hash lokal saat build) yang
diverifikasi setelah unduh (`verifyAsset`); parser frontmatter hanya menerima subset YAML
aman.

**Konsumsi delta.** `/.well-known/aifeed-index.json` (+ `.sig`, konteks `aimd-index`)
dengan `sha-256`, ETag, token, resume situs, dan field triage per halaman (title, summary,
tags, language, related, jumlah aset). Klien mem-diff digest dan hanya fetch halaman yang berubah;
halaman tak berubah berbiaya nol byte (permintaan kondisional [rfc9110, rfc7231], digest
fields [rfc9530], linking [rfc8288]). Entri indeks adalah klaim tak terpercaya sampai
diverifikasi.

## 4. Model Ancaman

Tercakup konformansi: manifest domain asing, edit pasca-tanda-tangan, penggantian kunci,
kompromi origin/DNS, modifikasi jaringan, CDN basi, replay, korupsi transport, reformat
lokal, dokumen diubah, ketidakcocokan digest, replay lintas URL dan lintas konteks, tanda
tangan yang dilepas saat kebijakan mewajibkannya, override fail-open, dan penyalahgunaan
parser YAML. Unduhan aset hanya terikat ke halaman lewat rujukan: bila penerbit
mendeklarasikan `size` atau `sha-256`, klien memverifikasi byte sebelum dipakai; tanpa itu,
integritas aset bergantung pada TLS saja. Secara eksplisit tidak diklaim: kompromi origin+DNS pada kontak pertama;
kesetiaan derivatif markdown terhadap render HTML. Enforcement diperlukan agar berdampak:
1,9 miliar peristiwa bypass menunjukkan preferensi tanpa penegakan hanya saran [tollbit].
Penggantian kunci ditangani upacara rotasi (v0.2 §14): direktif penerus bertanda tangan
kunci lama plus cross-check DNS `pk2` advisory, jendela overlap terbatas, lalu revokasi
permanen setelah cutover. Ini membatasi, tetapi tidak menghilangkan, jendela penerimaan
kunci yang terkompromi; ia tidak membela terhadap penyerang yang sudah menguasai konten
dan DNS origin.

## 5. Implementasi

Tumpukan referensi tanpa dependensi [aifeedRepo]: parser ketat + subset YAML aman; JCS +
Ed25519; CLI (`keygen`, `sign`, `validate`, `bundle`,
`aimd|mako generate|sign|verify|index|fetch`, `site build`); SDK npm `@aifeed/verify`
(manifest, dokumen, indeks, pemilihan triage, verifikasi aset);
verifier Python independen; plugin WordPress (penyajian dual-stack, indeks bertanda tangan,
aset, triage, `llms.txt`); site builder statis; delapan adapter server. Spesifikasi:
AIFeed v0.1 [aifeedSpec01], v0.2 [aifeedSpec02], AIFeed Markdown v1.0 [aimdSpec].
Konformansi: 34 vektor manifest + 39 MAKO + 11 AIFeed Markdown di JavaScript dan Python;
fixture diferensial PHP; tes end-to-end WordPress.

## 6. Evaluasi

Semua angka direproduksi dari artefak ter-commit (`benchmarks/*.json`,
`npm run bench:mako`, `npm run bench:enforcement`); seed tetap; satu mesin; jaringan
loopback; korpus sintetis dengan navigasi, iklan, komentar, dan skrip.

**Efisiensi konten (60 halaman).** Byte 1.205.292 → 375.630 termasuk tanda tangan:
**−68,83%**; estimasi token −68,8%; sign 0,25 ms/halaman; verify 0,34–0,70 ms/halaman.
Delta dengan 10% halaman berubah: 51.408 byte, **−95,73%** vs crawl HTML (tak berubah
diasumsikan 304). Klaim MAKO hingga 94% mengandaikan summarisasi penerbit; konverter jujur
kami mengukur 68,8% dan kami melaporkan nilai yang lebih kecil.

**Harness enforcement (situs 18 halaman, empat profil klien).**

| Metrik | S0 | S1 | S2 | S3 |
|---|---:|---:|---:|---:|
| Permintaan origin | 63 | 45 | 42 | 30 |
| Byte origin | 177.537 | 104.084 | 95.580 | 79.555 |
| CPU origin (ms) | 46,6 | 31,1 | 28,6 | 20,4 |
| Konkurensi puncak | 17 | 4 | 2 | 2 |
| Blokir 403 / limit 429 | 0 / 0 | 18 / 0 | 18 / 11 | 18 / 11 |
| Byte diterima klien | 177.537 | 104.570 | 96.198 | 80.173 |
| p95 latency manusia (ms) | 20,0 | 23,2 | 19,9 | 19,3 |
| Penghematan byte penerbit | — | 41,4% | 46,2% | **55,2%** |
| Penghematan CPU penerbit | — | 33,4% | 38,8% | **56,2%** |
| Penghematan byte AI (semua / patuh) | — | 41,1% / 42,5% | 45,8% / 42,5% | **54,8% / 72,9%** |

Jalur 100 tenant: byte origin 962.373 → 451.038 dengan enforcement; proyeksi per 1.000
tenant adalah ekstrapolasi linear (dilabeli demikian). Tanpa enforcement, penghematan nol
secara konstruksi.

**Kebenaran dan ketahanan.** Nol kegagalan verifikasi tanda tangan; replay lintas konteks
dan lintas URL ditolak; tamper tertangkap oleh ketidakcocokan digest; 90.000+ eksekusi
fuzz tanpa pelanggaran invarian; integritas aset diverifikasi end-to-end (hashing lokal,
cek unduhan byte-per-byte); WordPress end-to-end lulus negosiasi, tanda tangan inline
dan indeks, aset, triage, dan `llms.txt`.

## 7. Diskusi dan Batasan

- **Adopsi dua sisi yang bergantung enforcement.** Deklarasi hanya berarti bila dikonsumsi
  atau ditegakkan; AIFeed adalah input yang dapat diverifikasi untuk CDN, WAF, dan platform
  hosting.
- **Ketergantungan kompatibilitas.** MAKO adalah draf pihak ketiga (dipin); AIFeed
  Markdown menyediakan profil native yang independen.
- **Trust-on-first-use.** Pinning, anti-rollback, dan transparency log memitigasi tetapi
  tidak menghapus kompromi kontak pertama.
- **Cakupan evaluasi.** Satu mesin, loopback, sintetis; belum ada pilot live (kit pilot
  terbit); efek latensi manusia hanya dibatasi kebijakan harness.
- **Pertanyaan hukum terbuka.** Rezim opt-out TDM dan hukum nasional butuh penasihat;
  label menandai hipotesis.
- **Konflik kepentingan.** Penulis adalah perancangnya; mitigasinya artefak terbuka dan
  perintah reproduksi; review kriptografi eksternal tertunda.

## 8. Kesimpulan dan Pekerjaan Masa Depan

Di sisi penerbit, izin yang dapat diatribusikan secara kriptografis dapat
dispesifikasikan, diimplementasikan tanpa dependensi, dan diukur: penghematan byte/CPU
sisi penerbit 55–56% di bawah enforcement, penghematan byte sisi AI 55–73%, penghematan
delta steady-state 95,7%, verifikasi sub-milidetik. Pekerjaan tersisa bersifat
institusional: review kriptografi independen, pilot live, standardisasi hulu (ekstensi
MAKO; Internet-Draft IETF untuk inti protokol), dan governance registry multi-pemangku
kepentingan. Semua artefak dirilis untuk direproduksi dan ditantang.

## Etika dan ketersediaan artefak

Hanya halaman sintetis; tanpa data pribadi. Spesifikasi dan schema CC BY 4.0; kode MIT;
vektor CC0. URL repositori publik tercatat di `CHECKLIST.md`.

## Referensi

Entri BibTeX dengan metadata terverifikasi ada di [`refs.bib`](refs.bib). Kunci yang
dipakai di atas: `rfc2119`, `rfc3339`, `rfc6838`, `rfc7231`, `rfc7493`, `rfc7763`,
`rfc8174`, `rfc8259`, `rfc8288`, `rfc8615`, `rfc8785`, `rfc8032`, `rfc9110`, `rfc9162`,
`rfc9309`, `rfc9421`, `rfc9530`, `draftAiprefVocab`, `draftAiprefAttach`,
`draftWebbotauth`, `draftWebbotArch`, `makoSpec`, `rsl`, `llmstxt`, `tdmrep`,
`cfRadar2025`, `cfCrawlRefer`, `cfContentSignals`, `cfContentIndependence`,
`cfBotPrinciples`, `cfPayPerCrawl`, `tollbit`, `pew2025`, `euAiact`, `euTdmRegistry`,
`uuPdp27`, `liu2025`, `chowdhury2026`, `li2025aitxt`, `steinacker2025`, `lee2009`,
`ge2016`, `archer2026`, `hoetzlein2026`, `munirathinam2026`, `aifeedRepo`,
`aifeedSpec01`, `aifeedSpec02`, `aimdSpec`, `aipolicyjson`, `agentstxt`, `crawlwall`.
