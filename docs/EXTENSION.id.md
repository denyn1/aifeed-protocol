# Proposal: Lapisan Trust AIFeed untuk MAKO (Spesifikasi Ekstensi)

<p><a href="EXTENSION.md">English</a> · <a href="EXTENSION.id.md">Bahasa Indonesia</a> · <a href="EXTENSION.zh.md">中文</a></p>

**Status:** Draf untuk diskusi (ditujukan ke komunitas `mako-spec` via CONTRIBUTING)
**Penulis:** AIFeed Protocol Contributors
**Tanggal:** 2026-09-15
**Implementasi referensi:** repositori ini (`spec/`, `lib/`, `bin/`), `wp-plugin/`

---

## 1. Ringkasan

MAKO mendefinisikan bagaimana halaman web menyajikan markdown yang dioptimalkan secara
semantik kepada agen AI. Spesifikasi MAKO dengan sengaja mengecualikan autentisitas dan
verifikasi konten:

> "MAKO does not provide built-in mechanisms to verify that the MAKO representation is
> faithful to the source HTML. This is intentional. […] The protocol provides verifiable
> content; it does not provide verification." — MAKO Specification v0.1.0, §10.3

Proposal ini menetapkan **lapisan trust opsional** yang menambahkan tepat bagian yang
hilang itu tanpa mengubah perilaku wajib MAKO:

1. **AIFeed-Verified MAKO** — tanda tangan detached Ed25519 atas byte mentah MAKO,
   terikat ke URL halaman dan kunci origin yang di-anchor DNS.
2. **Pengikatan izin** — blok frontmatter `aifeed` opsional yang mengikat izin penggunaan,
   batas rate, dan lisensi ke halaman individual, diwarisi dari manifest origin bertanda
   tangan dan dibatasi secara default.
3. **Indeks delta** — indeks opsional yang dapat dipaginasi dengan digest SHA-256 per
   entri agar agen hanya mengambil yang berubah (`304`/diff digest), bukan crawl ulang.

Dokumen MAKO tanpa ekstensi ini tetap sah dan tidak berubah. Ekstensi ini terbatas pada
satu kunci frontmatter opsional dan header HTTP opsional, sehingga parser dan agen MAKO
yang ada tetap bekerja (kunci tak dikenal diabaikan sesuai panduan MAKO §5.1).

**Catatan dual-stack.** AIFeed juga mendefinisikan profil konten native-nya, **AIFeed
Markdown** (`text/aifeed+markdown`, `.aifeed.md`, `aimd: "1.0"`), yang dispesifikasikan di
`spec/en/aifeed-aimd-v1.md`. MAKO tetap menjadi **profil kompatibilitas** kelas satu: byte
bertanda tangan yang sama dapat disajikan di kedua media type, masing-masing dengan
konteks tanda tangannya sendiri (`aimd` / `mako`), dan replay lintas format ditolak.
Proposal ini tetap berguna dalam kedua kasus — jika ekstensi `aifeed` diadopsi di hulu,
MAKO mendapatkan lapisan trust; jika tidak, lapisan trust yang sama hidup di profil native
tanpa menghalangi interoperabilitas.

---

## 2. Motivasi

- **Atribusi.** MAKO §10.4 mengakui bahwa penerbit dapat menghasilkan konten arbitrer dan
  konsumen harus membela diri. Tanda tangan membuat dokumen MAKO dapat diatribusikan ke
  kunci domain: spam dan manipulasi menjadi dapat dilacak ke origin nyata, dengan jalur
  revokasi.
- **Kejelasan izin.** MAKO membawa konten; AIFeed membawa *aturan* untuk konten itu
  (training, retrieval, kutipan, summarisasi, atribusi, batas rate, lisensi). Aturan
  bertanda tangan dapat ditegakkan dan diaudit; prosa tanpa tanda tangan di istilah HTML
  tidak.
- **Efisiensi.** MAKO sudah menghilangkan kebisingan markup. Tanda tangan dan indeks
  menghilangkan sisa pemborosan: mengunduh ulang halaman tak berubah dan memvalidasi
  ulang konten tak dikenal. Terukur pada korpus berita 60 halaman: konversi MAKO −68,8%
  byte vs HTML, konsumsi delta −95,7% vs crawl ulang HTML, verifikasi ≈0,28 ms/halaman
  (`benchmarks/mako-report.md`).
- **Komplementaritas.** Proposal ini kompatibel dengan embeddings CEF (diperlakukan
  sebagai petunjuk tak terpercaya per MAKO §10.2) dan dengan discovery
  `/.well-known/mako`.

---

## 3. Non-tujuan

- Bukan pengganti format konten, discovery, atau header MAKO.
- Bukan protokol pembayaran; referensi lisensi (RSL/harga) hanyalah deklarasi.
- Bukan pemeringkat atau filter spam sisi konsumen.
- Tanpa perubahan pada field wajib MAKO, media type, atau semantik negosiasi.

---

## 4. Ekstensi A — blok frontmatter `aifeed` (opsional)

```yaml
---
mako: "1.0"
type: article
entity: "Panduan Protokol AIFeed"
updated: 2026-09-14
tokens: 280
language: id
aifeed:
  policy_version: "0.2"
  usage:                # restrict-only overrides by default
    training: deny
    summarize: allow
  attribution: required
  limits:
    requests_per_minute: 30
    concurrent: 2
  license:              # informational (RSL/payment discovery)
    rsl_url: https://example.com/rsl.xml
    price: { amount: 250, currency: USD }
  assets:               # media and downloadable file links (optional)
    - { url: /uploads/cover.webp, type: image, alt: "Cover" }
    - { url: /laporan.pdf, type: document, title: "Full report" }
---
```

Aturan:

- Blok ini **opsional**; ketiadaannya berarti "warisi manifest origin".
- Override bersifat **restrict-only** kecuali manifest origin mendeklarasikan
  `content.mako.overrides: "bidirectional"`. Halaman tidak dapat memberi yang ditolak
  origin.
- Ketatnya atribusi adalah `required > optional > none`; limit hanya boleh diperketat.
- `assets` mencantumkan media dan file yang dapat diunduh (gambar, video, audio, dokumen,
  arsip, `file`) hanya sebagai referensi — tidak pernah di-inline, pengambilannya
  mengikuti izin dan limit yang sama dengan konten, dan agen memutuskan apakah mengunduh.
- Parser WAJIB memakai subset YAML aman: tanpa anchor, alias, tag, flow collection,
  block scalar, atau merge key; kedalaman (6), node (512), dan ukuran skalar (8 KiB)
  terbatas.

---

## 5. Ekstensi B — kontainer tanda tangan detached (opsional)

```json
{
  "algorithm": "ed25519",
  "context": "mako",
  "url": "https://example.com/product/123",
  "key_fingerprint": "sha256:<43 chars>",
  "signed_at": "2026-09-15T08:00:00Z",
  "signature": "base64url:<86 chars>",
  "raw_digest": { "sha-256": "<43 chars + '='>", "applies_to": "raw-bytes" }
}
```

- **Byte yang ditandatangani:** `UTF-8("aifeed.mako.v0.2\n") || ASCII(url) || LF || raw bytes`,
  di mana `raw bytes` adalah byte dokumen MAKO persis seperti disajikan dan `url` adalah
  URL halaman kanonik (host huruf kecil, tanpa fragment/query). `https` diwajibkan;
  implementasi BOLEH menerima `http` loopback hanya untuk pengujian.
- **Pengiriman (prioritas):**
  1. Header inline: `X-Aifeed-Signature: mako1:<base64url(JCS(container))>`
  2. Sidecar terdeklarasi: `X-Aifeed-Signature-URL` atau `Link: rel="aifeed-signature"`
  3. Sidecar default: `{mako-url}.sig`
- Kunci tanda tangan adalah kunci Ed25519 origin yang diterbitkan di manifest AIFeed-nya
  (`/.well-known/ai.json`, yang sendiri bertanda tangan dan di-anchor DNS via TXT
  `_aifeed`).
- Indeks BOLEH ditandatangani dengan `context: "mako-index"` dan
  `UTF-8("aifeed.mako-index.v0.2\n") || ASCII(url) || LF || raw bytes`, dikirim sebagai
  sidecar (`{index-url}.sig`). Tanda tangan tertanam yang self-referential tidak
  didefinisikan.

---

## 6. Ekstensi C — indeks delta (opsional)

`/.well-known/mako-index.json` (path dideklarasikan manifest):

```json
{
  "version": "0.2",
  "domain": "example.com",
  "site": {
    "name": "Example News",
    "description": "Independent daily news, technology and business desks.",
    "type": "news",
    "languages": ["en"],
    "updated_at": "2026-09-15T08:00:00Z"
  },
  "generated_at": "2026-09-15T08:00:00Z",
  "page": 1,
  "page_count": 1,
  "entries": [
    { "url": "/product/123", "type": "product", "tokens": 280,
      "title": "Nike Air Max 90", "summary": "Casual running shoe, 79.99 EUR.",
      "tags": ["running", "shoes"], "lang": "en",
      "updated": "2026-09-14", "etag": "\"mako-a1b2c3\"",
      "sha-256": "<43 chars + '='>" }
  ]
}
```

- Objek `site` opsional adalah resume tingkat situs (nama, deskripsi ≤500, tipe, bahasa,
  lisensi, updated_at) agar agen memahami origin sebelum fetch.
- Entri dapat membawa field triage (`title`, `summary` ≤160, `tags` ≤10, `lang`,
  `related` ≤20) agar agen dapat memeringkat dan memilih halaman tanpa mengunduhnya;
  semua field triage harus berasal dari konten yang diterbitkan saja.
- Dapat dipaginasi (`Link: rel="next"`), kondisional (`If-None-Match`), `?since=`
  opsional.
- Penerbit BOLEH juga menyajikan `/llms.txt` (llms.txt v2) sebagai teks discovery tanpa
  tanda tangan untuk tooling non-AIFeed; izin selalu berasal dari manifest bertanda
  tangan, bukan dari llms.txt.
- Entri dan field triage adalah **klaim tak terpercaya**: klien WAJIB memverifikasi setiap
  `sha-256` terhadap byte yang di-fetch sebelum dipakai.

---

## 7. Level konformansi (usulan)

| Level | Persyaratan |
|---|---|
| `AIFeed-C1` | Memvalidasi manifest origin bertanda tangan (v0.1/v0.2) |
| `AIFeed-C2` | C1 + mengonsumsi MAKO via negosiasi + pengikatan izin restrict-only |
| `AIFeed-C3` | C2 + memverifikasi tanda tangan MAKO (semua mode pengiriman) + penanganan downgrade |
| `AIFeed-C4` | C3 + indeks delta + revokasi + bundel offline dengan snapshot MAKO |

---

## 8. Pertimbangan keamanan (ringkasan)

- Subset YAML aman diwajibkan (frontmatter adalah input yang dapat dijangkau penyerang).
- Pengikatan URL mencegah replay lintas halaman; ketidakcocokan digest dan tanda tangan
  buruk adalah kegagalan keras.
- `signature: "required"` di manifest mencegah pelepasan tanda tangan diam-diam; tanda
  tangan yang hilang menghasilkan penolakan risiko tinggi untuk origin itu.
- Peracunan indeks dimitigasi oleh digest per entri dan tanda tangan indeks opsional.
- Embeddings CEF tetap petunjuk pra-filter tak terpercaya (MAKO §10.2).
- Header `X-Mako-*` dan `X-Aifeed-*` TIDAK BOLEH ada pada `401`/`403` (memperluas
  MAKO §10.6).

---

## 9. Kompatibilitas mundur

- Field wajib MAKO, media type, negosiasi, dan header tidak disentuh.
- Ekstensi menambah satu kunci frontmatter opsional (`aifeed`) dan header opsional
  (`X-Aifeed-*`), plus dokumen well-known opsional.
- Parser MAKO yang mengabaikan kunci frontmatter tak dikenal tidak memerlukan perubahan.
- Degradasi berjalan mulus: MAKO tanpa tanda tangan tetap MAKO yang sah; lapisan trust
  sekadar melaporkan `mako_verified = false`.

---

## 10. Implementasi referensi

- Spesifikasi (EN + ID + ZH): `spec/en/aifeed-v0.2.md`, `spec/id/aifeed-v0.2.md`,
  `spec/zh/aifeed-v0.2.md`
- Schema: `schema/ai-json.v0.2.json`, `schema/mako.v0.2.json`,
  `schema/mako-signature.v0.2.json`, `schema/mako-index.v0.2.json`
- Vektor konformansi: `conformance/mako/` (39 kasus) — diverifikasi oleh implementasi
  JavaScript dan Python yang independen.
- CLI: `aifeed mako generate|sign|verify|index|fetch`
- SDK: `packages/aifeed-verify` (`fetchMako`, `fetchIndexDelta`, `mako.*`)
- Penerbit: `wp-plugin/` (WordPress, negosiasi konten + penandatanganan + indeks)
- Benchmark: `benchmarks/mako-report.md`

Teks ekstensi dirilis di bawah CC BY 4.0; kode di bawah MIT. Kami menyambut review,
umpan balik penamaan, dan penyelarasan dengan peta jalan MAKO (manifest tingkat situs,
§13).
