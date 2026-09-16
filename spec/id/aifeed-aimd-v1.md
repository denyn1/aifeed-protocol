# AIFeed Markdown v1.0 (Profil Konten Native)

<p><a href="../en/aifeed-aimd-v1.md">English</a> · <a href="../id/aifeed-aimd-v1.md">Bahasa Indonesia</a> · <a href="../zh/aifeed-aimd-v1.md">中文</a></p>

**Identifier wire:** `aimd` (media type `text/aifeed+markdown`, konteks tanda tangan `aimd`/`aimd-index`, perintah CLI `aifeed aimd`).

**Versi:** 1.0 (protokol), spesifikasi AIFeed v0.2
**Status:** Draf — belum dibekukan
**Bahasa normatif:** Inggris (`spec/en/aifeed-aimd-v1.md`). Dokumen ini terjemahan informasional.
**Lisensi:** CC BY 4.0 (dokumen) · MIT (implementasi referensi)
**Media type:** `text/aifeed+markdown` · **Ekstensi berkas:** `.aifeed.md`

---

## Abstrak

AIFeed Markdown adalah profil konten native AIFeed: dokumen markdown per halaman
yang frontmatternya memuat blok kebijakan AIFeed sebagai warga kelas satu. Spesifikasi
ini memastikan AIFeed tidak bergantung pada satu format eksternal, sambil tetap
**dual-stack**: origin yang sama boleh menyajikan dokumen MAKO
(`text/mako+markdown`), dan byte yang sama dapat memenuhi kedua profil.

AIFeed Markdown memakai ulang mesin verifikasi, izin, aset, triase, dan delta dari spesifikasi
AIFeed v0.2 (`spec/en/aifeed-v0.2.md`) serta memperluas manifest dengan
`content.profile` dan `content.index_url`.

---

## 1. Hubungan dengan AIFeed v0.2 dan MAKO

1. Dokumen ini adalah **profil konten** AIFeed v0.2. Bagian v0.2 tetap normatif kecuali
   diamandemen di sini.
2. MAKO tetap menjadi **profil kompatibilitas**: implementasi AIFeed WAJIB menerima
   dokumen MAKO bila dideklarasikan, dan MAY menyajikannya.
3. Manifest tetap `version: "0.2"` dan mendeklarasikan profil:

   | `content.profile` | Arti |
   |---|---|
   | `mako` | Hanya MAKO (perilaku v0.2 lama) |
   | `aifeed-md` | Hanya AIFeed Markdown |
   | `both` | Byte yang sama disajikan dalam dua media type (penanda ganda) |

   `content.index_url` mendeklarasikan path indeks delta kanonik (default AIFeed Markdown:
   `/.well-known/aifeed-index.json`; default MAKO: `/.well-known/mako-index.json`).

---

## 2. Format Dokumen

Dokumen AIFeed Markdown adalah markdown UTF-8 dengan frontmatter subset YAML aman (subset v0.2
§6.5 berlaku tanpa perubahan).

```markdown
---
aimd: "1.0"
mako: "1.0"          # opsional; menandai kompatibilitas MAKO
type: article
entity: "Panduan AIFeed Markdown"
updated: 2026-09-15
tokens: 420
language: id
aifeed:
  policy_version: "0.2"
  usage:
    training: deny
  attribution: required
---

# Panduan AIFeed Markdown

Isi halaman sebenarnya.
```

Aturan:

- `aimd: "1.0"` WAJIB dan menandai dokumen sebagai AIFeed Markdown.
- `mako: "1.0"` OPSIONAL; bila ada, byte yang sama MAY juga disajikan sebagai
  `text/mako+markdown` dengan tanda tangan konteks MAKO.
- Field wajib: `type`, `entity`, `updated`, `tokens`, `language` (kosakata sama dengan
  MAKO). `tokens` menerima hingga 1.000.000.
- Blok `aifeed` adalah **warga kelas satu**: `policy_version` (`"0.2"`), `usage`,
  `attribution`, `limits`, `license`, `assets` mengikuti semantik v0.2 §6, termasuk
  pengikatan izin restrict-only.
- Kunci top-level tak dikenal WAJIB diabaikan kecuali berawalan `x_` (ekstensi); blok
  `aifeed` bersifat ketat.
- Panjang badan: AIFeed Markdown tidak mewajibkan batas 1.000 token MAKO. Tooling referensi
  memakai default 4.000 token dan penerbit MAY memilih lebih rendah; konverter WAJIB
  memberi peringatan saat memotong.

### 2.1 Aset

Sama seperti v0.2: `aifeed.assets` mencantumkan media dan berkas unduhan sebagai
tautan rujukan (image, video, audio, document, archive, file); pengambilannya tunduk
pada izin dan limit yang sama seperti konten halaman.

### 2.2 Field dokumen opsional

AIFeed Markdown mewarisi field opsional yang kompatibel MAKO agar konverter dapat bolak-balik
tanpa kehilangan informasi:

| Field | Arti |
|---|---|
| `canonical` | URL `https` kanonik halaman (host ASCII/IDNA A-label; lihat §3) |
| `summary` | deskripsi singkat (≤300 karakter); ringkasan triase indeks dibatasi 160 |
| `tags` | tag konten (≤50) |
| `related` | path halaman terkait (≤100) |
| `links.internal` / `links.external` | tautan semantik dengan konteks |
| `actions` | aksi terdeklarasi (nama, deskripsi, endpoint, method, params) |
| `audience` | petunjuk audiens target |
| `freshness` | `realtime` \| `hourly` \| `daily` \| `weekly` \| `monthly` \| `static` |
| `media` | `cover {url, alt}` plus hitungan images/video/audio/interactive/downloads |
| `alternates` | terjemahan halaman ini: array `{ url, lang }` (≤20) |

`alternates` khas AIFeed Markdown (bukan bagian MAKO): memungkinkan situs global mendeklarasikan
konten yang sama dalam bahasa lain agar agen langsung mengambil locale yang tepat.
Penerbit SHOULD menjaga `language` sebagai locale dokumen sendiri dan membatasi
`alternates` pada terjemahan yang benar-benar terbit.

Semua field di atas divalidasi ketat: tipe salah, nilai di luar batas, kunci tak
dikenal di dalam objek (misalnya `price` tambahan di item `alternates`), nama aksi
duplikat, dan array melebihi batas ditolak dengan `aimd_frontmatter_invalid`.

---

## 3. Media Type dan Negosiasi

- Agen meminta AIFeed Markdown dengan `Accept: text/aifeed+markdown`.
- Server WAJIB membalas `Content-Type: text/aifeed+markdown; charset=utf-8` saat
  menyajikan AIFeed Markdown, dan WAJIB menyertakan `Vary: Accept`.
- Respons AIFeed Markdown memakai ulang set header MAKO untuk interoperabilitas
  (`X-Mako-Version`, `X-Mako-Tokens`, `X-Mako-Type`, `X-Mako-Lang`) dan menambah
  `X-Aifeed-Profile: aimd|mako`.
- Urutan discovery untuk origin dual-stack: (1) AIFeed Markdown, (2) MAKO, (3) fallback HTML.
- Halaman HTML SHOULD mengumumkan keduanya:
  `<link rel="alternate" type="text/aifeed+markdown" href="...">` dan
  `<link rel="alternate" type="text/mako+markdown" href="...">`.
- Permintaan HEAD SHOULD mengembalikan header tanpa badan (aturan MAKO §6.2).

> **URL internasional.** URL halaman kanonik yang dipakai di discovery, tanda tangan,
> dan `alternates` WAJIB berupa URL `https` absolut dengan host ASCII: nama domain
> internasional WAJIB dikodekan sebagai IDNA2008 A-label (punycode, mis.
> `xn--tko-7qa.example`). Komponen path mengikuti percent-encoding normal. Ini menjaga
> byte bertanda tangan deterministik lintas locale dan normalizer.

### 3.1 Mode operasi dual-stack

Implementasi MAY berjalan dalam salah satu mode:

| Mode | Manifest | Byte bersama | Anggaran token |
|---|---|---|---|
| **AIFeed Markdown-only** | `content.profile: "aifeed-md"` | AIFeed Markdown saja | Cap AIFeed Markdown (default referensi 4.000; maksimum schema 1.000.000) |
| **Dual-stack** | `content.profile: "both"` | Satu badan untuk dua media type | Badan bersama SHOULD menghormati rekomendasi MAKO (default 1.000 token) |

Dual-stack menjaga jaminan "satu badan bertanda tangan, dua profil", termasuk satu
digest indeks per halaman. Implementasi MAY menyajikan badan itu dari satu URL untuk
kedua media type (negosiasi konten) atau sebagai berkas per profil dengan byte identik
(`{path}.aifeed.md` dan `{path}.mako.md`, masing-masing dengan sidecar `.sig` dan
konteks tanda tangan yang sesuai); kedua tata letak WAJIB memenuhi persyaratan
konformansi yang sama. Penerbit yang butuh badan lebih panjang namun tetap ingin
kompatibilitas MAKO SHOULD memublikasikan halaman/endpoint terpisah, bukan memecah
badan bersama; implementasi WAJIB TIDAK mengiklankan `both` sambil menyajikan badan
yang melampaui rekomendasi MAKO.

---

## 4. Tanda Tangan

AIFeed Markdown memakai ulang container tanda tangan v0.2 (`schema/mako-signature.v0.2.json`)
dengan konteks dan separasi baru:

| Dokumen | context | Byte ditandatangani |
|---|---|---|
| Halaman AIFeed Markdown | `aimd` | `UTF-8("aifeed.aimd.v1\n") \|\| url \|\| 0x0A \|\| byte mentah` |
| Indeks AIFeed Markdown | `aimd-index` | `UTF-8("aifeed.aimd-index.v1\n") \|\| url \|\| 0x0A \|\| byte mentah` |

- Prioritas pengiriman sama seperti v0.2 §7.2; header inline AIFeed Markdown memakai prefiks
  `aimd1:<base64url(JCS(container))>` (`mako1:` tetap untuk MAKO).
- Konteks dan separasi berbeda: tanda tangan MAKO WAJIB TIDAK memverifikasi sebagai
  AIFeed Markdown dan sebaliknya (perlindungan replay lintas format).

---

## 5. Izin, Limit, dan Trust

- Izin efektif dihitung persis seperti v0.2 §6.2 dengan default `restrict-only`.
- `content.index_url` pada manifest menunjuk indeks delta; skema indeks, bidang triase
  (`title`, `summary`, `tags`, `lang`, `related`), dan resume `site` tidak berubah dari
  v0.2 §8.
- Level trust dan perilaku downgrade berlaku seperti v0.2 §9. Bila
  `content.mako.signature == "required"`, origin dual-stack WAJIB menandatangani kedua
  media type.

---

## 6. Level Konformansi

| Level | Persyaratan |
|---|---|
| `AIMD-C1` | Mem-parse dan memvalidasi dokumen AIFeed Markdown (frontmatter + blok kebijakan) |
| `AIMD-C2` | Menyajikan/mengonsumsi AIFeed Markdown via `text/aifeed+markdown` dengan header wajib |
| `AIMD-C3` | Memverifikasi tanda tangan `aimd`/`aimd-index` dan menolak replay lintas konteks |
| `AIMD-C4` | Indeks delta + triase + revokasi + bundle offline untuk AIFeed Markdown |

---

## 7. Pertimbangan Keamanan

- Subset YAML aman v0.2, batas ukuran, dan parsing ketat berlaku tanpa perubahan.
- Separasi terpisah mencegah pemakaian ulang tanda tangan antar profil meski byte sama.
- Penanda ganda tidak melemahkan verifikasi: setiap media type membawa container
  konteksnya sendiri.
- Blok `aifeed` bukan lisensi dengan sendirinya; rujukan lisensi mengikuti v0.2.

---

## 8. Referensi

- AIFeed v0.2 (`spec/en/aifeed-v0.2.md`): trust layer, profil MAKO, indeks, aset,
  triase, keamanan.
- MAKO Specification v0.1.0 (draf): profil kompatibilitas.
- RFC 2119/8174, RFC 8032, RFC 8785, RFC 9530.
- Implementasi referensi: `aifeed-protocol` (CLI `mako generate --format aimd`,
  `verifyAimdDocument`, `verifyAimdIndex`), plugin WordPress `1.0.0-draft`.

---

## 9. Pertimbangan IANA

Dokumen ini mendefinisikan media type `text/aifeed+markdown` dan ekstensi berkas
konvensional `.aifeed.md`. Registrasi media type ke IANA direncanakan (RFC 6838,
Specification Required). Sebelum registrasi, server WAJIB tetap mengirim
`Content-Type: text/aifeed+markdown` di wire; tipe yang tidak dikenali terdegradasi
aman ke fallback HTML per §3. Kunci frontmatter `aifeed` dan header `X-Aifeed-*`
bersifat eksperimental dan dapat diregistrasi bersama relasi link `ai-feed` (v0.2 §12).
