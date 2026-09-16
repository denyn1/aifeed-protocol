# AIFeed v0.2 — Profil Kepercayaan MAKO (Ekstensi v0.1)

**Versi:** 0.2.0-draft
**Status:** Draf — belum dibekukan (lihat "Status Dokumen")
**Bahasa normatif:** Inggris (`spec/en/aifeed-v0.2.md`). Dokumen ini adalah **terjemahan informasional**; jika terjadi perbedaan, versi Inggris yang berlaku.
**Lisensi:** CC BY 4.0 (dokumen) · MIT (implementasi referensi)

---

## Abstrak

AIFeed v0.1 mendefinisikan deklarasi bertanda tangan ber-anchor DNS tentang apa yang
boleh dilakukan sistem AI terhadap konten sebuah origin web. Ekstensi ini (v0.2)
mengikat deklarasi tersebut ke **MAKO (Markdown Agent Knowledge Optimization)** — format
pengiriman markdown per halaman untuk agen AI — dan menutup celah verifikasi yang
memang sengaja dibiarkan terbuka oleh MAKO:

> "MAKO tidak menyediakan mekanisme bawaan untuk memverifikasi bahwa representasi MAKO
> setia terhadap HTML sumbernya. Ini disengaja. […] Protokol menyediakan konten yang
> dapat diverifikasi; protokol tidak menyediakan verifikasi." — MAKO Specification
> v0.1.0, §10.3

AIFeed v0.2 menambah tiga lapisan di atas MAKO:

1. **AIFeed-Verified MAKO** — tanda tangan Ed25519 detached opsional atas byte mentah
   dokumen MAKO, terikat ke URL halaman dan kunci manifest.
2. **Pengikatan izin** — override izin, limit, dan lisensi per halaman di frontmatter
   MAKO (blok `aifeed:`), diwarisi dari manifest dan dibatasi secara default
   ("restrict-only").
3. **Konsumsi delta** — indeks MAKO opsional berhalaman dengan digest per entri agar
   klien hanya mengambil yang berubah (`304` / diff indeks), bukan merayapi HTML.

AIFeed v0.2 bersifat aditif: bagian v0.1 tetap normatif kecuali diamandemen di sini, dan
klien v0.2 WAJIB tetap dapat memverifikasi manifest v0.1.

---

## Status Dokumen

Ini adalah draf ekstensi untuk implementasi referensi dan pengujian interoperabilitas.
Spesifikasi **belum dibekukan**; perubahan diizinkan hingga v0.2.0 final. Kata kunci
BCP 14 (RFC 2119, RFC 8174) berlaku.

Dua dependensi eksternal dipin dan dipantau:

| Dependensi | Referensi pin | Kebijakan perubahan |
|---|---|---|
| MAKO | Protokol `"1.0"`, dokumen spesifikasi v0.1.0 (Draf, 2026-02-18) | Lihat Lampiran A |
| AIFeed v0.1 | `spec/en/aifeed-v0.1.md` (0.1.0-rc1) | Diamandemen hanya bila dinyatakan |

---

## 1. Hubungan dengan v0.1

1. Dokumen ini adalah **spesifikasi ekstensi**. Bagian 1–13 dan Lampiran A–C v0.1 tetap
   normatif untuk semua manifest, termasuk versi `0.2.x`, kecuali diamandemen eksplisit
   di dokumen ini (§5, §9, §10, §14, Lampiran D).
2. Manifest dengan `version` cocok `^0\.2(\.[0-9]+)?$` WAJIB memenuhi schema v0.1
   (selain pola versi) dan `schema/ai-json.v0.2.json`.
3. **Domain separation bergantung versi.** Byte yang ditandatangani untuk manifest
   bergantung pada field `version`:

   | `version` manifest | Byte ditandatangani | Schema tanda tangan |
   |---|---|---|
   | `0.1.x` | `UTF-8("aifeed.v0.1\n") \|\| JCS(manifest)` | `ai-signature.v0.1.json` |
   | `0.2.x` | `UTF-8("aifeed.v0.2\n") \|\| JCS(manifest)` | `ai-signature.v0.2.json` |

4. Penerimaan versi (normatif): klien v0.2 WAJIB menerima `version ∈ {0.1, 0.1.x}`; WAJIB
   menerima `version ∈ {0.2, 0.2.x}`; nilai lain → `UNVERIFIED(upgrade_required)`.
   Klien v0.1 yang menemukan `0.2.x` mengembalikan `UNVERIFIED(upgrade_required)` — ini
   diharapkan dan aman.
5. Persyaratan terkait MAKO hanya berlaku untuk manifest origin yang mendeklarasikan
   `content.mako` (§4.1). Dokumen MAKO dari origin tanpa manifest AIFeed berada di luar
   semantik trust AIFeed (`UNVERIFIED`).

---

## 2. Konvensi dan Terminologi (tambahan)

- **Dokumen MAKO** — dokumen markdown UTF-8 ber-frontmatter YAML, diidentifikasi oleh
  `Content-Type: text/mako+markdown`, sesuai spesifikasi MAKO.
- **Pasangan MAKO** — dokumen MAKO beserta container tanda tangan AIFeed opsionalnya (§7).
- **URL halaman** — URL `https` absolut halaman yang direpresentasikan dokumen MAKO,
  tanpa fragmen/kueri, ternormalisasi NFC.
- **mako_verified** — flag verifikasi: tanda tangan MAKO ada, terbentuk benar, dan valid
  terhadap kunci manifest dan URL halaman.
- **Subset aman YAML** — tata bahasa frontmatter pada §6.5. YAML penuh TIDAK diterima.

Aturan input ketat v0.1 §2 berlaku untuk semua JSON yang diparse AIFeed, termasuk
container tanda tangan dan indeks MAKO.

---

## 3. Discovery dan Tata Letak Berkas (tambahan)

```
/.well-known/ai.json                Manifest (bertanda tangan)     [v0.1]
/.well-known/ai-signature.json      Container tanda tangan         [v0.1]
/.well-known/mako                   Discovery situs MAKO (spec MAKO)[opsional]
/.well-known/mako-index.json        Indeks delta MAKO              [opsional, §8]
{url-halaman}                       MAKO via negosiasi konten      [utama]
{url-halaman}.sig                   Sidecar tanda tangan MAKO      [§7.2]
{path}.mako.md                      Berkas MAKO statis             [fallback]
{path}.mako.md.sig                  Sidecar tanda tangan statis    [§7.2]
```

Urutan discovery untuk klien AIFeed yang sadar MAKO (normatif): (1) manifest
`content.mako`; (2) `Link: <...>; rel="alternate"; type="text/mako+markdown"`;
(3) `/.well-known/mako` MAKO; (4) HTML `<link rel="alternate">` /
`<script type="text/mako+markdown">`. Negosiasi konten (MAKO §6.1) adalah metode akses
utama; pola berkas statis dan endpoint eksplisit adalah fallback setara untuk hosting
yang tidak bisa bernegosiasi (MAKO §6.3).

---

## 4. Manifest v0.2 (tambahan)

Manifest v0.2 adalah manifest v0.1 dengan `version: "0.2"` plus objek `content.mako` di
bawah. Semua batasan v0.1 lainnya (ukuran, limit, ketatnya) tidak berubah.

### 4.1 `content.mako`

| Field | Tipe | Wajib | Default | Catatan |
|---|---|---|---|---|
| `index_url` | path | tidak | tidak ada | Lokasi indeks delta (§8); WAJIB diawali `/` |
| `signature` | enum | tidak | `optional` | `required` \| `optional` |
| `overrides` | enum | tidak | `restrict-only` | `restrict-only` \| `bidirectional` (§6.4) |
| `embedding` | boolean | tidak | `false` | Origin mendeklarasikan penggunaan embedding CEF; embedding tetap tidak tepercaya (MAKO §10.2) |

Kehadiran `content.mako` (boleh objek kosong) mendeklarasikan dukungan MAKO. Ketiadaannya
berarti MAKO tidak dideklarasikan; klien WAJIB TIDAK menafsirkan berkas MAKO dari origin
itu sebagai bagian dari profil trust AIFeed.

### 4.2 Semantik

- `signature: "required"` menyatakan bahwa setiap dokumen MAKO untuk origin ini membawa
  tanda tangan AIFeed yang valid. Jika klien tidak dapat memverifikasinya, penggunaan
  berisiko tinggi (`training`, `reproduce`, `modify`, `commercial_use`, dan semua
  `actions`) WAJIB ditolak dan halaman TIDAK BOLEH diperlakukan `VERIFIED` untuk
  konsumsi MAKO.
- `overrides` mengendalikan pengikatan izin per halaman (§6.4).
- Limit v0.1 §4.6 juga berlaku untuk endpoint MAKO; MAKO yang dikonsumsi via negosiasi
  konten memakai anggaran crawl yang sama dengan halaman HTML-nya.

---

## 5. Profil Kompatibilitas MAKO (normatif)

### 5.1 Perilaku MAKO yang dipin

Klien WAJIB mengikuti spesifikasi MAKO untuk: negosiasi konten (`Accept:
text/mako+markdown`), header respons wajib (`Content-Type`, `X-Mako-Version`,
`X-Mako-Tokens`, `X-Mako-Type`, `X-Mako-Lang`, `Vary: Accept`), pra-filter HEAD, request
kondisional, dan fallback senyap ke HTML (MAKO §6). AIFeed tidak mendefinisikan ulang
semantik MAKO; ia hanya menambah lapisan trust dan izin.

- `X-Mako-Version` WAJIB `1.0` untuk pin dokumen ini; nilai lain, atau nilai frontmatter
  `mako` selain `"1.0"`, menghasilkan error `mako_unsupported` dan klien kembali ke
  aturan HTML untuk konsumsi konten.
- Nilai frontmatter `mako` WAJIB diperlakukan sebagai string; penulis MAY menghilangkan
  tanda kutip (`mako: 1.0`) dan pembaca WAJIB menormalkan literal numerik tanpa kutip
  tersebut menjadi `"1.0"`.
- Kunci frontmatter MAKO yang tidak dikenal WAJIB diabaikan (kompatibilitas MAKO)
  **kecuali** kunci `aifeed` (§6), yang mengikuti aturan ketat dokumen ini.
- Embedding CEF (`X-Mako-Embedding*`) diperlakukan sebagai petunjuk tidak tepercaya
  (MAKO §10.2).

### 5.2 Header wajib dan terlarang

Untuk respons MAKO, server WAJIB menyertakan header wajib MAKO dan SHOULD menyertakan
`ETag` dan `Cache-Control`. Selain itu:

- Respons MAKO WAJIB TIDAK menyertakan `X-Aifeed-Signature` atau
  `X-Aifeed-Signature-URL` pada respons `401` atau `403` (mencerminkan MAKO §10.6,
  diperluas ke header AIFeed).
- `Vary: Accept` WAJIB agar cache tidak mencampur HTML dan MAKO.

### 5.3 Pola statis dan fallback

Bila negosiasi konten tidak tersedia, penerbit MAY menyajikan `{path}.mako.md` plus
elemen `<link rel="alternate" type="text/mako+markdown" href="...">` (MAKO §6.3). Aturan
tanda tangan AIFeed (§7) berlaku atas byte yang benar-benar disajikan, apa pun pola
transportnya.

---

## 6. Pengikatan Izin

### 6.1 Blok frontmatter `aifeed`

Dokumen MAKO MAY menyertakan mapping top-level `aifeed` di frontmatter YAML:

```yaml
aifeed:
  policy_version: "0.2"
  usage:                 # opsional; default restrict-only
    training: deny
    summarize: allow
  attribution: required  # required | optional | none
  limits:
    requests_per_minute: 10
  license:               # informasional (discovery RSL/pembayaran)
    rsl_url: https://example.com/rsl.xml
    price:
      amount: 250        # integer, satuan minor
      currency: USD
  assets:                # media & berkas unduhan (hanya tautan)
    - url: /uploads/sampul.webp
      type: image
      alt: "Foto sampul"
    - url: /media/demo.mp4
      type: video
      title: "Video demo"
    - url: /laporan.pdf
      type: document
      title: "Laporan lengkap"
```

`assets` mencantumkan media dan berkas unduhan yang dirujuk halaman (gambar, video,
audio, dokumen, arsip, berkas lain yang biasanya ditandai atribut HTML `download`).
Setiap entri membawa `url`, `type` (`image`, `video`, `audio`, `document`, `archive`,
`file`), serta opsional `mime`, `title`, dan `alt`. Daftar ini **hanya rujukan**: aset
tidak pernah disisipkan ke dalam dokumen, pengambilannya tunduk pada izin dan limit
yang sama dengan konten halaman, dan klien yang memutuskan apakah akan mengunduhnya.
Konverter SHOULD tetap mempertahankan rujukan inline di badan markdown (misalnya gambar
sebagai `![alt](url)`) dan SHOULD menambahkan bagian "Media & Unduhan" yang
mencantumkan tautan aset agar konsumen MAKO non-AIFeed juga dapat menemukannya.

### 6.2 Pewarisan

Izin efektif dihitung per kunci usage sebagai:

```
base(usage)     = manifest.permissions.usage[usage] jika ada
                  selain itu manifest.permissions.default
page(usage)     = aifeed.usage[usage] jika ada, jika tidak unset
effective       = resolve(base, page, manifest.content.mako.overrides)
```

### 6.3 `restrict-only` (default)

Di bawah `restrict-only`, nilai halaman hanya boleh membuat kebijakan **lebih ketat**:

- `allow` → `deny` dihormati.
- `deny` → `allow` DITOLAK; klien WAJIB mengabaikannya dan SHOULD mencatat
  `permission_override_rejected`.
- Atribusi: `required` lebih ketat dari `optional`, lebih ketat dari `none`.
  Pelonggaran (mis. `required` → `none`) DITOLAK.
- Limit hanya boleh diperketat: turunkan `requests_per_minute`/`concurrent`, naikkan
  `crawl_delay_seconds`. Pelonggaran DITOLAK.
- `license`: halaman DILARANG mengganti lisensi manifest. Halaman BOLEH menambah
  lisensi hanya bila manifest tidak mendeklarasikan lisensi; lisensi identik (urutan
  kunci diabaikan) diterima diam-diam. Penggantian lain DITOLAK dengan
  `permission_override_rejected` dan lisensi manifest yang berlaku. Lisensi tidak
  pernah mengubah izin `usage`. Alasan: halaman yang dikompromikan atau buggy tidak
  boleh melisensikan ulang konten yang tidak pernah diberikan origin.

### 6.4 `bidirectional`

Hanya bila `content.mako.overrides` eksplisit bernilai `"bidirectional"` halaman boleh
memberi apa yang dilarang manifest atau melonggarkan atribusi/limit. Bahkan begitu,
manifest tetap otoritatif untuk revokasi dan level trust.

### 6.5 Subset aman YAML (normatif)

Karena parsing frontmatter adalah permukaan serangan baru, AIFeed v0.2 mendefinisikan
subset ketat. Parser WAJIB menolak dokumen yang melanggar aturan berikut:

1. Frontmatter adalah blok antara baris `---` pertama dan `---` berikutnya; maksimum
   32 KiB; UTF-8, wajib NFC; tanpa BOM; hanya LF atau CRLF.
2. Mapping memakai block style indentasi 2 spasi; sequence memakai item `- `. Flow
   collection (`{...}`, `[...]`) WAJIB ditolak.
3. Skalar: plain, single-quoted, atau double-quoted saja. Block scalar literal (`|`) dan
   folded (`>`) WAJIB ditolak. Null/`~` WAJIB ditolak.
4. Anchor (`&`), alias (`*`), tag (`!`), direktif (`%`), penanda multi-dokumen (`...`),
   dan merge key (`<<`) WAJIB ditolak.
5. Kunci duplikat WAJIB ditolak. Kunci WAJIB cocok `^[A-Za-z0-9_-]{1,64}$`.
6. Integer WAJIB memenuhi `|n| <= 2^53 - 1`; float dan notasi eksponen WAJIB ditolak.
   Boolean hanya `true`/`false`.
7. Kedalaman maksimum 6; maksimum 512 node; panjang skalar maksimum 8 KiB.
8. Komentar (`#` hingga akhir baris) diizinkan di luar skalar berkuota.
9. Karakter kontrol selain LF/CR/TAB WAJIB ditolak; TAB TIDAK BOLEH untuk indentasi.
10. Blok `aifeed` divalidasi terhadap `schema/mako.v0.2.json`; field tak dikenal di dalam
    `aifeed` WAJIB ditolak kecuali diawali `x_`.

Parser WAJIB TIDAK memakai fitur instansiasi objek dari pustaka YAML umum (mis.
`!!python/object`); parser subset deterministik diwajibkan.

---

## 7. AIFeed-Verified MAKO

### 7.1 Container tanda tangan (`mako-signature.v0.2.json`)

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

- **Byte ditandatangani:** `UTF-8("aifeed.mako.v0.2\n") || ASCII(url) || 0x0A || byte
  mentah` — byte mentah adalah byte dokumen MAKO persis seperti disajikan (setelah
  transfer decoding), dan `url` adalah URL halaman kanonik (host huruf kecil, tanpa
  fragmen/kueri). URL WAJIB berupa URL `https` absolut; implementasi MAY menerima URL
  `http://` **hanya** untuk host loopback (`127.0.0.1`, `[::1]`, `localhost`, port
  opsional) di lingkungan pengujian.
- **Kunci:** kunci Ed25519 dari manifest origin (`identity.public_key`);
  `key_fingerprint` WAJIB cocok `sha256:` + base64url(SHA-256(SPKI DER)).
- **`raw_digest`:** SHA-256 (base64 standar) atas byte mentah yang sama; ini pemeriksaan
  integritas transport, bukan pengganti tanda tangan (aturan v0.1 §5.1 berlaku).
- Ukuran container ≤ 2 KB; aturan JSON ketat berlaku (v0.1 §2).

### 7.2 Pengiriman (prioritas)

1. **Header inline (utama).** `X-Aifeed-Signature: mako1:<base64url>` dengan payload
   `JCS(container)`. Klien mendekode lalu memverifikasi §7.1. Tanpa request tambahan.
2. **Sidecar terdeklarasi.** `X-Aifeed-Signature-URL: </path.sig>` atau
   `Link: </path.sig>; rel="aifeed-signature"`; klien GET (≤2 KB, boleh kondisional).
3. **Sufiks default.** Bila keduanya tidak ada, klien MAY mencoba default: URL MAKO +
   `.sig` (negosiasi: `{url-halaman}.sig`; berkas statis: `{berkas}.mako.md.sig`).

Server yang mendeklarasikan `signature: "required"` SHOULD memakai (1) atau (2).
Tanda tangan tidak ada → `mako_verified = false`; bila manifest mensyaratkannya,
penggunaan berisiko tinggi WAJIB ditolak (§4.2) dan klien SHOULD memunculkan
`mako_signature_missing`.

### 7.3 Prosedur verifikasi

```
INPUT : byte MAKO B, URL halaman U, manifest M (VERIFIED), container C (opsional)
1. Parse ketat C (≤2 KiB). Bila absen → mako_verified=false; selesai.
2. C.context == "mako" dan C.algorithm == "ed25519" → jika tidak, gagal.
3. C.url == U → jika tidak, gagal (replay antar-URL).
4. C.key_fingerprint == fingerprint(M.identity.public_key) → jika tidak, gagal.
5. SHA-256(B) == C.raw_digest["sha-256"] → jika tidak, gagal (mako_digest_mismatch).
6. Ed25519 verify("aifeed.mako.v0.2\n" || U || LF || B, C.signature, kunci M) → jika
   tidak, gagal.
7. mako_verified = true
```

### 7.4 Persyaratan penandatangan

Penandatangan WAJIB memvalidasi dokumen MAKO (subset frontmatter + field wajib MAKO),
hanya menandatangani byte yang ia sajikan, memastikan `identity.public_key` cocok dengan
kunci penandatangan, dan memverifikasi sendiri sebelum menerbitkan. Penandatangan WAJIB
TIDAK menandatangani dokumen yang disajikan berbeda antar-klien.

---

## 8. Konsumsi Delta (Indeks MAKO)

### 8.1 Dokumen indeks (`mako-index.v0.2.json`)

```json
{
  "version": "0.2",
  "domain": "example.com",
  "site": {
    "name": "Berita Contoh",
    "description": "Berita harian independen, desk teknologi dan bisnis.",
    "type": "news",
    "languages": ["id"],
    "license": "All Rights Reserved",
    "updated_at": "2026-09-15T08:00:00Z"
  },
  "generated_at": "2026-09-15T08:00:00Z",
  "page": 1,
  "page_count": 3,
  "entries": [
    {
      "url": "/product/123",
      "type": "product",
      "tokens": 280,
      "title": "Nike Air Max 90",
      "summary": "Sepatu lari kasual, 79,99 EUR, stok tersedia.",
      "tags": ["running", "sepatu"],
      "lang": "id",
      "related": ["/product/adidas-ultraboost"],
      "updated": "2026-09-14T12:00:00Z",
      "etag": "\"mako-a1b2c3\"",
      "sha-256": "<43 chars + '='>"
    }
  ]
}
```

Aturan: `domain` WAJIB sama dengan **nama** host penyaji (hostname URL, tanpa port);
entri per halaman 1–50.000; dokumen ≤ 5 MB terdekompresi; paginasi via
`Link: <...>; rel="next"`; server SHOULD mendukung `If-None-Match` dan MAY mendukung
`?since=<RFC3339>` (klien WAJIB toleran terhadap respons `200` penuh saat `since` tidak
didukung). Indeks MAY ditandatangani memakai container §7.1 dengan `context:
"mako-index"` dan byte ditandatangani
`UTF-8("aifeed.mako-index.v0.2\n") || ASCII(url) || 0x0A || byte mentah`. Tanda tangan
indeks dikirim sebagai **sidecar** di `{url-indeks}.sig` (default) atau via
`X-Aifeed-Signature-URL` / `Link: rel="aifeed-signature"`; WAJIB TIDAK ditanam di dalam
dokumen indeks itu sendiri (tanda tangan swa-rujuk tidak terdefinisi).

#### Resume situs dan bidang triase (opsional)

Objek `site` opsional adalah resume tingkat situs: `name`, `description` (≤500 karakter),
`type` (kosakata manifest), `languages`, `license`, dan `updated_at`. Ini memungkinkan
agen memahami apa yang diterbitkan origin sebelum mengambil halaman apa pun. Deskripsi
WAJIB informasi publik (teks yang sama yang penerbit tampilkan ke pengunjung).

Entri MAY membawa bidang triase agar agen dapat memutuskan **halaman mana yang diambil**
tanpa mengunduhnya: `title` (≤500), `summary` (≤160), `tags` (≤10), `lang`, dan
`related` (≤20 path URL). Aturan:

- Bidang triase WAJIB berasal dari konten terbit saja; draf, halaman privat, dan
  metadata belum terbit WAJIB TIDAK muncul.
- Bidang triase adalah **petunjuk tidak tepercaya**, sama seperti entri indeks: klien
  WAJIB tetap memverifikasi `sha-256` per entri (dan tanda tangan indeks bila ada)
  sebelum digunakan.
- Klien SHOULD memakai bidang triase untuk memeringkat dan memilih entri (misalnya
  relevansi judul, tag, dan ringkasan dalam anggaran token atau halaman) lalu SHOULD
  hanya mengambil dokumen MAKO yang terpilih.

### 8.2 Algoritma konsumsi (normatif)

```
1. Ambil manifest (v0.1 §7). Bila content.mako absen → hanya aturan HTML.
2. Bila index_url ada: GET indeks (kondisional). 304 → tidak ada perubahan; selesai.
3. Peringkat dan pilih entri memakai resume situs dan bidang triase (title, summary,
   tags, related) dalam anggaran halaman/token klien. Pemilihan adalah kebijakan klien:
   protokol hanya menyediakan petunjuknya.
4. Diff entri terpilih terhadap digest tersimpan klien; simpan URL baru/berubah.
5. Untuk setiap URL tersisa: GET dengan Accept: text/mako+markdown (+ If-None-Match).
6. Verifikasi tanda tangan (§7.3) sesuai manifest.content.mako.signature.
7. Hitung izin efektif (§6.2) dan tegakkan limit.
8. Simpan {url, digest, etag, updated} untuk siklus berikutnya.
```

Entri indeks adalah **klaim tidak tepercaya**: klien WAJIB memverifikasi `sha-256` per
entri terhadap byte MAKO yang diambil sebelum digunakan, dan WAJIB TIDAK memperlakukan
indeks sebagai bukti izin atau keaslian.

---

## 9. Prosedur Verifikasi v0.2 (amandemen v0.1 §7)

1. Langkah 1–4 v0.1 §7 tidak berubah, dengan dua tambahan: setelah parsing ketat, pemilihan
   schema MANIFEST digerakkan versi (§1.3 dokumen ini); dan manifest v0.2 WAJIB juga
   memenuhi `schema/ai-json.v0.2.json`.
2. Langkah 5 v0.1 §7 diganti oleh aturan penerimaan versi §1.4.
3. Langkah 9 v0.1 §7 memakai domain separation bergantung versi §1.3.
4. Setelah langkah 15, bila `content.mako` ada dan klien hendak mengonsumsi MAKO,
   jalankan subprosedur MAKO §5–§8. Hasil menambah flag: `mako_verified`,
   `mako_signature_present`, dan peringatan (`mako_unsupported`,
   `mako_signature_missing`, `mako_digest_mismatch`, `permission_override_rejected`,
   `mako_stale`).
5. Penggunaan berisiko tinggi memerlukan `level = VERIFIED`, `dns_anchored = true`, dan —
   bila `content.mako.signature == "required"` — `mako_verified = true` (v0.1 §8
   diperluas ke MAKO).
6. Bila `content.mako.signature == "required"` dan `mako_verified = false`, konten MAKO
   WAJIB diperlakukan dengan semantik UNVERIFIED (hanya search/retrieval/input, limit
   konservatif, atribusi).

### 9.1 Kode error MAKO (subset normatif)

Vektor konformansi adalah otoritas untuk kode persisnya; implementasi WAJIB memakai
kode berikut untuk interoperabilitas:

| Grup | Kode |
|---|---|
| Frontmatter | `mako_frontmatter_missing`, `mako_frontmatter_invalid`, `mako_unsupported`, `frontmatter_missing`, `frontmatter_too_large`, `bom_forbidden`, `invalid_utf8`, `not_nfc`, `duplicate_key`, `float_not_allowed`, `integer_out_of_range`, `scalar_too_long`, `node_limit_exceeded` |
| Subset YAML | `yaml_anchor_forbidden`, `yaml_alias_forbidden`, `yaml_tag_forbidden`, `yaml_directive_forbidden`, `yaml_block_scalar_forbidden`, `yaml_flow_forbidden`, `yaml_merge_forbidden`, `yaml_null_forbidden`, `yaml_tab_indent`, `yaml_indent_invalid`, `yaml_max_depth`, `yaml_key_invalid`, `yaml_parse_error`, `yaml_empty_value`, `yaml_control_char`, `yaml_inline_mapping_forbidden`, `yaml_document_marker_forbidden` |
| Pengikatan izin | `aifeed_invalid`, `aifeed_unknown_field`, `permission_override_rejected` (peringatan) |
| Tanda tangan | `mako_container_malformed`, `mako_context_invalid`, `mako_url_mismatch`, `mako_url_invalid`, `mako_manifest_key_invalid`, `mako_key_mismatch`, `mako_digest_mismatch`, `mako_bad_signature`, `mako_signature_missing` |
| Indeks | `mako_index_malformed`, `mako_index_invalid`, `mako_index_domain_mismatch`, `mako_index_digest_mismatch` |
| Kesegaran | `mako_stale` (peringatan) |

---

## 10. Level Trust dan Konformansi

### 10.1 Level trust (v0.1 §8 diperluas)

| Level | Tambahan MAKO |
|---|---|
| VERIFIED | Pemeriksaan manifest lulus; `mako_verified` dilaporkan terpisah |
| UNVERIFIED | Seperti v0.1; konten MAKO: deklaratif saja, risiko tinggi ditolak |
| SUSPENDED | Seperti v0.1; dokumen MAKO tercache dibersihkan bersama konten tercache |

### 10.2 Level konformansi AIFeed v0.2

| Level | Persyaratan |
|---|---|
| `AIFeed-C1` | Klien v0.1 + memvalidasi manifest v0.2 (schema) |
| `AIFeed-C2` | C1 + mengonsumsi MAKO via negosiasi konten + pengikatan izin restrict-only (§6) |
| `AIFeed-C3` | C2 + memverifikasi tanda tangan MAKO AIFeed (semua mode pengiriman, §7) + penanganan downgrade (§9.6) |
| `AIFeed-C4` | C3 + konsumsi indeks delta (§8) + revokasi + bundle offline dengan snapshot `mako/` |

Bundle offline (v0.1 Lampiran B) MAY menyertakan direktori `mako/` berisi byte MAKO
mentah, container tanda tangan, dan metadata fetch; `BUNDLE-MANIFEST.json` mencantumkan
SHA-256 dan ukuran setiap berkas.

---

## 11. Pertimbangan Keamanan (tambahan)

- **Serangan YAML.** Anchor/alias/tag dan tipe campuran ditolak oleh subset aman (§6.5);
  implementasi WAJIB menegakkan batas kedalaman/node/ukuran sebelum alokasi.
- **Pencopotan tanda tangan / downgrade.** Klien yang mensyaratkan tanda tangan per
  kebijakan manifest memperlakukan tanda tangan hilang sebagai penolakan risiko tinggi
  (§9.6). Operator yang kemudian menyetel `signature: "optional"` tidak dapat memutar
  ulang berkas bertanda tangan lama untuk melewati izin baru, karena izin berasal dari
  manifest, bukan dari berkas MAKO.
- **Replay antar-URL.** Tanda tangan terikat URL halaman (§7.1); MAKO bertanda tangan
  valid untuk `/a` WAJIB ditolak di `/b`.
- **Peracunan indeks.** Entri indeks adalah klaim tidak tepercaya; digest per entri
  diverifikasi terhadap byte yang diambil (§8.2 langkah 7). Indeks bertanda tangan
  opsional hanya menambah atribusi, bukan kebenaran.
- **Cloaking.** Tanda tangan AIFeed membuktikan byte MAKO berasal dari kunci domain; ia
  tidak membuktikan kesetiaan terhadap render HTML. Klien SHOULD memeriksa silang
  `updated`/`Last-Modified` bila tersedia dan MAY membandingkan MAKO vs HTML untuk
  penggunaan sensitif.
- **Kebocoran metadata.** Header `X-Aifeed-Signature*` WAJIB TIDAK muncul pada `401`/`403`
  (mencerminkan MAKO §10.6).
- **Embedding.** Embedding CEF tetap petunjuk penerbit yang tidak tepercaya; jangan
  pernah memakainya sebagai satu-satunya input relevansi/peringkat (MAKO §10.2).
- **Kesegaran.** MAKO via negosiasi lebih segar daripada konten `<script>` tertanam
  (MAKO §6.4); klien SHOULD mengutamakan negosiasi dan menghormati semantik `ETag`.

---

## 12. Pertimbangan IANA (tambahan)

Tidak ada well-known URI baru di sini. `X-Aifeed-Signature` dan `X-Aifeed-Signature-URL`
adalah header eksperimental; registrasi tidak diperlukan untuk beroperasi dan dapat
diusulkan bersama relasi link `ai-feed` (v0.1 §12). Media type `text/mako+markdown`
didefinisikan oleh MAKO, bukan oleh dokumen ini.

---

## 13. Referensi (tambahan)

- MAKO Specification v0.1.0 (Draf, 2026-02-18) dan MAKO HTTP Headers Reference —
  `github.com/juanisidoro/mako-spec`
- RFC 3339, RFC 8032, RFC 8785, RFC 9530 (seperti v0.1 §13)
- MAKO §6 (negosiasi konten), §7 (header), §9 (konformansi), §10 (keamanan)

---

## 14. Rotasi Kunci

Setiap kunci penanda tangan punya umur. Upacara OPSIONAL ini mengganti kunci manifest
tanpa merusak verifikasi, dan mengamandemen v0.1 §6 (anchor DNS) dan §7 (verifikasi).
Manifest yang tidak pernah berotasi tidak terpengaruh.

### 14.1 Direktif `rotation`

`rotation` adalah objek manifest top-level OPSIONAL, sah hanya pada manifest
`version: "0.2"`. Ia memuat tepat satu dari `successor_fp` (pengumuman, ditandatangani
kunci saat ini) atau `predecessor_fp` (cutover, ditandatangani kunci baru):

| Field | Wajib dengan | Aturan |
|---|---|---|
| `successor_fp` | pengumuman | Fingerprint kunci penerus (`sha256:`) |
| `effective_at` | `successor_fp` | Instan cutover (UTC, RFC 3339) |
| `grace_until` | `successor_fp` | Batas kunci lama; WAJIB melebihi `effective_at` ≥ 1 jam (DISARANKAN ≥ 2 × (TTL DNS + 24 jam)) |
| `predecessor_fp` | cutover | Fingerprint kunci yang dipensiunkan |
| `supersedes_at` | `predecessor_fp` | TIDAK BOLEH melebihi `signed_at` + 300 detik |

Kombinasi lain, field hilang, atau stempel waktu tak terparse → `rotation_invalid`.

### 14.2 DNS `pk2` (advisory, amandemen v0.1 §6)

Selama overlap record TXT SEBAIKNYA memuat penerus:

```
_aifeed.example. 3600 IN TXT "v=aifeed1; pk=<lama>; pk2=<baru>; effective_at=<ts>; manifest=https://example/.well-known/ai.json"
```

`pk` WAJIB sama dengan kunci manifest yang disajikan (aturan lama). `pk2` adalah
cross-check advisory: `pk2` hilang, tak cocok, atau tanpa direktif → peringatan
`rotation_anchor_unverified`, bukan penolakan — anchor kepercayaan adalah tanda tangan
kunci lama pada direktif, jadi `pk2` palsu sendirian tidak mengubah apa pun. Klien
risiko tinggi BOLEH memperlakukan peringatan ini sebagai error.

### 14.3 Fase-fase

- `announced` — `now` < `effective_at`: kunci lama diterima penuh.
- `grace` — `effective_at` ≤ `now` < `grace_until`: diterima dengan peringatan
  `grace_accepted`.
- `completed` — `now` ≥ `grace_until`: ditolak (`rotation_denied`), kecuali kunci
  direvokasi (`key_revoked`).

Penerbit yang tidak pernah cutover salah konfigurasi: setelah `grace_until`, manifest
lamanya ditolak. Terbitkan ulang, jangan perpanjang diam-diam.

### 14.4 Verifikasi (amandemen v0.1 §7)

1. Aturan direktif (§14.1) berjalan di dalam validasi manifest.
2. Cross-check DNS (§14.2) berjalan di mana DNS tersedia; verifier offline melaporkan
   status dari direktif saja.
3. Klien yang menyimpan pin kunci TIDAK BOLEH menerima pergantian yang tidak diumumkan
   kunci terpin atau tidak diikat lewat `predecessor_fp` (`rotation_denied`); pin dorman
   yang melewatkan pengumuman BOLEH pin ulang bila `predecessor_fp` cocok (peringatan
   `rotation_resync`). Helper SDK: `rotation.evaluateContinuity`.
4. Bila fingerprint kunci penanda tangan muncul di `keys[]` dokumen revokasi yang sah →
   `key_revoked` (error). Revokasi mengalahkan grace.

### 14.5 Rotasi darurat

Dugaan kebocoran kunci tidak berarti revokasi instan — itu membuka outage. Gunakan
`aifeed rotate --accelerated` (jendela dipadatkan, mis. 6 jam), segera cutover, lalu
terbitkan fingerprint lama. Ini tidak menghilangkan risiko; ia membatasinya: kunci
yang mungkin bocor tetap diterima paling lama sepanjang jendela. Rotasi melindungi
kunci, bukan origin; TTL DNS patologis dan penyimpanan HSM/KMS di luar cakupan.
Runbook lengkap ada di `docs/rotation.md`.

### 14.6 Kode

| Kode | Jenis | Arti |
|---|---|---|
| `rotation_invalid` | error | Direktif cacat/tidak konsisten (termasuk jendela < 1 jam) |
| `rotation_anchor_unverified` | warning | DNS `pk2` hilang, tak cocok, atau tanpa direktif (advisory) |
| `grace_accepted` | warning | Tanda tangan kunci lama diterima dalam jendela grace |
| `rotation_denied` | error | Kunci pensiun lewat grace, pergantian tak diumumkan, atau rollback |
| `rotation_resync` | warning | Pin dorman dipin ulang lewat `predecessor_fp` |
| `key_revoked` | error | Fingerprint kunci penanda tangan terdaftar di dokumen revokasi yang sah (v0.1 §7 langkah 14) |

---

## Lampiran A — Kompatibilitas dan Pin MAKO

| Elemen MAKO | Posisi AIFeed v0.2 |
|---|---|
| Versi protokol `"1.0"` | Wajib cocok persis; lainnya tak didukung |
| Dokumen spesifikasi v0.1.0 draf | Dipin; dipantau perubahannya |
| Field frontmatter wajib | Divalidasi (`mako`, `type`, `entity`, `updated`, `tokens`, `language`) |
| Field opsional | Diteruskan; `aifeed` ditangani §6 |
| Embedding CEF | Tidak tepercaya, opsional, flag `embedding` informasional |
| `/.well-known/mako` | Sinyal discovery opsional; manifest tetap otoritatif |
| Level 1–3 MAKO | Independen dari level AIFeed (`AIFeed-C1..C4`) |

Bila MAKO mengubah perilaku normatif (header, negosiasi, frontmatter wajib), dokumen ini
diamandemen dengan entri lampiran baru; perubahan MAKO yang breaking memicu kenaikan
minor AIFeed. Field ekstensi AIFeed WAJIB tetap terbatas pada kunci frontmatter `aifeed`
dan header `X-Aifeed-*` agar tidak bertabrakan.

---

## Lampiran B — Tata Bahasa Frontmatter Subset Aman (ringkasan informatif)

```
document      = "---" LF *(line) "---" LF
line          = mapping | sequence-item | comment | blank
mapping       = indent key ":" [ " " scalar ] LF
sequence-item = indent "- " (scalar | nested) LF
scalar        = plain | "'" *(char) "'" | '"' *(char) '"'
key           = 1*64( ALPHA / DIGIT / "_" / "-" )
indent        = 2 spasi per level, maksimum 6 level
```

Konstruksi ditolak: anchor, alias, tag, merge key, direktif, flow collection, block
scalar, null, float, penanda multi-dokumen, TAB untuk indentasi.

---

## Lampiran C — Manfaat Dua Pihak (Efisiensi, Keamanan, Legalitas)

Label bukti: **[F]** fakta terverifikasi, **[M]** masuk akal, perlu pengukuran,
**[E]** estimasi model, **[S]** terukur di harness simulasi lokal (loopback,
reproducible), **[H]** butuh tinjauan hukum.

| Dimensi | Pemilik web | Sisi AI |
|---|---|---|
| **Efisiensi** | Terukur di harness penegakan: **−55,2% byte dan −56,2% CPU origin** pada S3, puncak koneksi origin **−88,2%** **[S]**; rentang 55–80% tetap model untuk deployment edge/CDN **[E]**; offload CDN via `304` dan diff indeks **[M]** | Terukur: **−54,8% byte** seluruh profil dan **−72,9%** untuk klien patuh; **14/18 halaman tak berubah dilewati** via delta; verifikasi **0,70 ms/halaman** **[S]**; ~90%+ lebih sedikit token per halaman (klaim MAKO −94%) **[M]**; pra-filter HEAD tanpa body **[F]**; tanpa render JS **[F]** |
| **Keamanan** | Izin bertanda tangan + anchor DNS: deklarasi tak bisa dipalsukan/diubah senyap **[F]**; revokasi teratribusi **[F]**; cloaking jadi terdeteksi dengan membandingkan HTML vs MAKO **[M]** | Provenance MAKO yang dikonsumsi terverifikasi; replay antar-URL, ketidakcocokan digest, dan downgrade terdeteksi **[F]**; embedding diperlakukan tidak tepercaya **[F]**; spam bertanda tangan teratribusi **[M]** |
| **Legalitas** | Reservasi hak machine-readable (selaras rezim opt-out TDM, mis. EU DSM Art. 4(3)) **[H]**; lisensi per halaman via RSL/harga **[H]**; jejak audit non-repudiasi **[M]** | Kepatuhan iktikad baik terdokumentasi dan jejak lisensi; kepastian per halaman menurunkan eksposur **[H]**; penegakan tetap faktor penentu **[F]** |

Non-klaim eksplisit: tanda tangan bukan kontrak; MAKO saja bukan lisensi; angka
efisiensi adalah estimasi model hingga track benchmark (Fase 5) menerbitkan pengukuran;
tidak ada di sini yang merupakan nasihat hukum.

---

## Lampiran D — Skenario Serangan (tambahan Lampiran C v0.1)

| # | Skenario | Lapisan yang menangkap | Hasil |
|---|---|---|---|
| 13 | Tanda tangan MAKO dicopot di transit | Kebijakan manifest `signature: required` | Penggunaan risiko tinggi ditolak (`mako_signature_missing`) |
| 14 | MAKO bertanda tangan diputar ulang di URL lain | Pengikatan URL di byte ditandatangani | `mako_verified=false` |
| 15 | Rollback versi ke manifest v0.1 lama | Anti-rollback `signed_at` (v0.1) | `UNVERIFIED` |
| 16 | Entri indeks beracun menunjuk byte penyerang | SHA-256 per entri + verifikasi tanda tangan | Entri ditolak |
| 17 | YAML bomb / ekspansi alias di frontmatter | Batas subset aman (§6.5) | Dokumen ditolak |
| 18 | Override halaman mencoba mengizinkan training yang dilarang | Resolusi `restrict-only` | Override diabaikan (+peringatan) |
| 19 | MAKO basi disajikan sementara HTML berubah | Pemeriksaan silang `updated`/`Last-Modified` (best effort) | Peringatan `mako_stale` |
| 20 | Respons kegagalan auth membocorkan metadata MAKO | Aturan tanpa-bocor §5.2 | Header dihilangkan |
| 21 | `pk2` palsu di DNS tanpa direktif manifest yang cocok | Tanda tangan direktif adalah anchor; `pk2` advisory (§14.2) | peringatan `rotation_anchor_unverified` |
| 22 | Manifest kunci lama basi disajikan setelah grace | Jendela direktif (§14.3) | `rotation_denied` |
| 23 | Konten kunci lama setelah publikasi registry | Pencocokan `keys[]` revokasi (§14.4) | `UNVERIFIED(key_revoked)` |
| 24 | Rollback ke kunci pensiun setelah cutover | Kontinuitas pin (§14.4) | `rotation_denied` |

---

## Lampiran E — Changelog v0.1 → v0.2

1. Objek manifest baru `content.mako` (indeks, kebijakan tanda tangan, override, embedding).
2. Domain separation manifest bergantung versi (`aifeed.v0.2\n`).
3. Profil kompatibilitas MAKO dengan pin protokol `1.0` (dokumen spec v0.1.0).
4. AIFeed-Verified MAKO: container tanda tangan detached, prioritas pengiriman, verifikasi.
5. Pengikatan izin: blok frontmatter `aifeed`, default restrict-only, subset aman YAML.
6. Konsumsi delta: indeks MAKO berhalaman dengan digest per entri.
7. Level konformansi `AIFeed-C1..C4`; perilaku level trust diperluas untuk MAKO.
8. Tambahan keamanan (YAML, downgrade, replay, peracunan indeks, kebocoran header).
9. Lampiran manfaat dua pihak dan lampiran kompatibilitas/pin MAKO.
10. Rotasi kunci: direktif `rotation`, cross-check advisory DNS `pk2`, fase overlap dan
    grace, kontinuitas pin, presedens revokasi.
