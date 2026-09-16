# Ledger Klaim

<p><a href="CLAIMS.md">English</a> · <a href="CLAIMS.id.md">Bahasa Indonesia</a> · <a href="CLAIMS.zh.md">中文</a></p>

Setiap klaim kuantitatif di paper dilacak di sini. Jenis:
**[peer]** publikasi peer-review · **[std]** standar/spesifikasi ·
**[ind]** laporan industri atau pernyataan vendor · **[meas]** pengukuran kami yang dapat
direproduksi · **[sim]** simulasi kami (harness loopback) · **[model]** ekstrapolasi kami ·
**[hyp]** hipotesis, bukan diklaim sebagai fakta.

Kunci Bib merujuk `refs.bib`. Tanggal akses untuk sumber web: 2026-09-14/15.

## Bukti masalah (eksternal)

| # | Klaim | Nilai | Sumber | Jenis |
|---|---|---|---|---|
| C1 | Porsi bot AI dari permintaan HTML (2025) | rata-rata 4,2% (2,4–6,4%) | `cfRadar2025` | ind |
| C2 | Porsi Googlebot; puncak | 4,5%; 11% | `cfRadar2025` | ind |
| C3 | Pertumbuhan crawl agen "user action" 2025 | >15× (hingga ~21×) | `cfRadar2025` | ind |
| C4 | Porsi bot vs manusia dari permintaan HTML (2025-12-02) | bot non-AI ≈44%, manusia 47% | `cfRadar2025` | ind |
| C5 | Komposisi bot terverifikasi | crawler AI 20%, search 40%, GPTBot 7,5% | `cfRadar2025` | ind |
| C6 | Proyeksi trafik bot | bot melampaui manusia 2029; aktivitas bot > total trafik saat ini 2031 | `cfContentSignals` | ind (proyeksi) |
| C7 | Scrape AI terdeteksi, H1 2026 | 22B+ dari 987B+ kunjungan | `tollbit` | ind |
| C8 | Bypass robots.txt, H1 2026 | 1,9B+ | `tollbit` | ind |
| C9 | Bot dialihkan ke paywall, H1 2026 | 2,6B+ | `tollbit` | ind |
| C10 | Rasio crawl-ke-rujukan Anthropic (hanya web, 19–26 Jun 2025) | 70.900:1 | `cfCrawlRefer` | ind |
| C11 | Kesulitan relatif menghasilkan rujukan vs pencarian historis | OpenAI 750×, Anthropic 30.000× | `cfContentIndependence` | ind (analisis vendor) |
| C12 | Kueri mobile zero-click | 75% | `cfContentIndependence` | ind (analisis vendor) |
| C13 | Celah identitas dan stealth crawling | xAI tanpa identifikasi; Anthropic hanya UA; Perplexity stealth | `cfBotPrinciples` | ind |
| C14 | Penandatanganan bot kriptografis di produksi | ChatGPT Agent menandatangani (Ed25519 + RFC 9421); Vercel memverifikasi | `cfBotPrinciples`, `draftWebbotauth` | ind + std |
| C15 | Adopsi Content Signals | 3,8 juta+ domain | `cfContentSignals` | ind |
| C16 | Pasar pembayaran crawl | Pay Per Crawl beta (HTTP 402); pendanaan TollBit $31 juta+; penerbit besar | `cfPayPerCrawl`, `tollbit` | ind |
| C17 | Perilaku klik pengguna dengan ringkasan AI | lebih sedikit klik saat ada ringkasan | `pew2025` | laporan organisasi riset |
| C18 | Linimasa EU AI Act; studi kelayakan registry opt-out TDM EU terbit 2026-07-13 | — | `euAiact`, `euTdmRegistry` | resmi |
| C19 | UU PDP Indonesia 27/2022 berlaku | — | `uuPdp27` | resmi |
| C20 | Studi perlindungan kreator terhadap crawler AI | IMC 2025 | `liu2025` | peer (diterima) |
| C21 | terms.txt: protokol consent/kompensasi untuk akses agentic | arXiv 2609.11152 (2026-09) | `chowdhury2026` | preprint |
| C22 | ai.txt: DSL untuk memandu interaksi AI | arXiv 2505.07834 (2025-05) | `li2025aitxt` | preprint |
| C23 | Studi gatekeeping robots.txt | arXiv 2510.10315 (2025-10) | `steinacker2025` | preprint |
| C24 | Klasifikasi web-robot atas 1B permintaan | Computers & Security 2009 | `lee2009` | peer |
| C25 | Protokol eksklusi dan panduan robot | Tsinghua Sci. Technol. 2016 | `ge2016` | peer |
| C26 | Model harga pay-per-crawl | arXiv 2604.01416 (2026-04) | `archer2026` | preprint |
| C27 | Perlindungan bot organisasi kecil (logrip) | arXiv 2508.03130 (2025-08) | `hoetzlein2026` | preprint |
| C28 | Kepatuhan agen LLM terhadap sinyal governance in-band | arXiv 2606.06460 (2026-06) | `munirathinam2026` | preprint |
| C29 | Proyek berdekatan: manifest izin terkonsolidasi tanpa tanda tangan (`ai-policy.json`), file discovery tanpa tanda tangan (`agents.txt`), enforcement edge dengan ledger bertanda tangan (`CrawlWall`), dan ketentuan per-tujuan dengan exchange/pembayaran bertanda tangan (`terms.txt`) | diinspeksi 2026-09-15 | `aipolicyjson`, `agentstxt`, `crawlwall`, `chowdhury2026` | inspeksi (repo GitHub + preprint) |
| C30 | **Klaim kombinasi:** menurut sumber yang diinspeksi per 2026-09-15, tidak ada satu proyek pun yang menggabungkan izin bertanda tangan penerbit dengan anchor DNS dan revokasi, profil konten native plus kompatibilitas di satu payload bertanda tangan, serta indeks delta yang dapat diverifikasi | — | sintesis C20–C29 | inspeksi, secara eksplisit tidak menyeluruh |

## Pengukuran dan simulasi kami (artefak di repositori ini)

| # | Klaim | Nilai | Artefak | Jenis |
|---|---|---|---|---|
| M1 | Konversi AIFeed Markdown/MAKO vs HTML, byte | −68,83% (korpus sintetis 60 halaman, 1.205.292 → 375.630 B termasuk tanda tangan) | `benchmarks/mako-benchmark.json` | meas |
| M2 | Estimasi pengurangan token (ceil(bytes/4)) | −68,8% | idem | meas (heuristik) |
| M3 | Konsumsi delta vs crawl HTML penuh | −95,73% | idem (10% halaman berubah; tak berubah diasumsikan `304`) | sim |
| M4 | Delta vs fetch MAKO penuh | −86,31% | idem | sim |
| M5 | Biaya penandatanganan dan verifikasi | sign 0,25 ms/halaman; verify 0,34–0,70 ms/halaman; verifikasi indeks terukur | idem + `benchmarks/enforcement-report.json` | meas (spesifik mesin) |
| M6 | Penghematan penerbit di bawah enforcement (S3) | byte −55,19%, CPU origin −56,23%, konkurensi puncak −88,24% | `benchmarks/enforcement-report.json` | sim |
| M7 | Penghematan sisi AI di bawah enforcement (S3) | semua profil −54,84%; klien patuh −72,93% | idem | sim |
| M8 | Halaman tak berubah yang dilewati via delta (situs 18 halaman) | 14/18 | idem | sim |
| M9 | Skala 100 tenant, S0 vs S3 | byte origin 962.373 → 451.038; proyeksi per 1.000 tenant di artefak | idem | meas + model |
| M10 | Vektor konformansi lulus, lintas bahasa | 34 manifest + 39 MAKO + 11 AIFeed Markdown di JS dan Python | `conformance/` | meas |
| M11 | Fuzzing parser/verifier | 90.000+ eksekusi, nol kegagalan invarian | `tools/fuzz*.js` | meas |
| M12 | Kebenaran verifikasi tanda tangan | 0 kegagalan; replay lintas format/konteks ditolak (E2E WordPress + vektor) | `tests/`, skrip E2E | meas |
| M13 | Klaim vendor vs konversi jujur | MAKO mengklaim hingga −94% token (optimasi semantik); konverter jujur kami mengukur −68,8% byte — selisihnya adalah summarisasi pilihan penerbit, bukan dicapai protokol | `makoSpec` vs `benchmarks/` | perbandingan |
| M14 | Rotasi kunci (v0.2 §14) | 4 vektor konformansi positif + 5 negatif; penerus terikat direktif bertanda tangan kunci lama dengan cross-check DNS `pk2` advisory; batas keras overlap 1 jam | `conformance/vectors/*/0{08..11,119..123}-rotation*` | meas |
| M15 | Penghematan tanpa adopsi/enforcement | ≈0 (baseline S0 menyajikan semuanya; bukti bypass C8) | idem | analisis |

## Klaim non-kuantitatif (dinyatakan dengan cakupan)

- Rantai verifikasi (TLS → kecocokan domain → Ed25519 → anchor DNS) hanya sekuat lapisan
  terlemahnya; kompromi origin+DNS pada kontak pertama tidak terdeteksi (TOFU).
- Tanda tangan membuktikan provenance, bukan kesetiaan markdown terhadap render HTML.
- AIFeed bergantung pada draf pihak ketiga (MAKO) untuk profil kompatibilitas; profil
  AIFeed Markdown independen.
- Belum ada review kriptografi eksternal atau pilot live 30 hari saat preprint; keduanya
  direncanakan dan statusnya diungkap di paper.
- Pernyataan hukum dilabeli **[H]** dan bukan nasihat hukum.

## Hasil tidak menguntungkan yang disertakan

- M13 (selisih klaim vendor), M15 (nol penghematan tanpa enforcement), batas TOFU,
  evaluasi sintetis satu mesin, tanpa data CDN produksi, ketergantungan pada draf
  spesifikasi, dan cold-start adopsi dua sisi.
