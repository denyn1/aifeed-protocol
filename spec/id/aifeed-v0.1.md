# AIFeed v0.1 — Deklarasi Tertandatangani untuk Konten AI-Web

**Versi:** 0.1.0-rc1  
**Status:** Release Candidate — belum dibekukan  
**Bahasa normatif:** Inggris (`spec/en/aifeed-v0.1.md`). Dokumen ini adalah **terjemahan informasional**; jika terjadi perbedaan, versi Inggris yang berlaku.  
**Lisensi:** CC BY 4.0 (dokumen) · MIT (implementasi referensi)

---

## Abstrak

AIFeed mendefinisikan cara sebuah origin web mendeklarasikan secara machine-readable dan
dapat diverifikasi secara kriptografis: apa yang boleh dilakukan sistem AI otomatis
terhadap kontennya. Deklarasi berupa manifest JSON di `/.well-known/ai.json`,
ditandatangani Ed25519, di-anchor melalui DNS TXT, dan tunduk pada mekanisme revokasi
berbasis registry.

AIFeed adalah lapisan trust: tidak menggantikan `robots.txt`, kosakata IETF AIPREF,
lisensi RSL, W3C TDMRep, atau `llms.txt`. AIFeed membuat deklarasi dapat dibuktikan
asalnya (atribusi domain) dan dapat dicabut.

---

## Status Dokumen

Ini adalah release candidate untuk pengujian interoperabilitas. Spesifikasi **belum
dibekukan**; perubahan diizinkan hingga v0.1.0 final. Kata kunci MUST/SHOULD/MAY
mengikuti BCP 14 (RFC 2119, RFC 8174).

---

## 1. Pendahuluan

Crawler pencarian dahulu menukar konten dengan trafik rujukan. Sistem AI mengonsumsi
konten dan sering tidak mengembalikan trafik. Data rasio crawl-to-referral (Cloudflare
Radar, 2025) dan volume pelanggaran robots.txt (TollBit, H1 2026) menunjukkan preferensi
teks polos sering diabaikan dan tidak dapat diatribusikan ke domain dengan yakin.

AIFeed menutup empat celah:

1. **Atribusi.** Manifest bertanda tangan membuktikan deklarasi berasal dari pemegang
   kunci domain, bukan perantara jaringan atau jalur yang dikompromikan.
2. **Anchor.** DNS TXT mengikat kunci penandatangan ke domain itu sendiri.
3. **Revokasi.** Registry menerbitkan dokumen revokasi bertanda tangan dengan due process.
4. **Verifikasi offline.** Cek tanda tangan & schema tidak butuh jaringan.

---

## 2. Konvensi dan Terminologi

- **Manifest** — dokumen JSON di `/.well-known/ai.json`.
- **Kontainer tanda tangan** — dokumen JSON di `identity.signature_url`.
- **Origin** — scheme + host (versi ini: hanya `https`, port default).
- **Publisher** — pihak yang menguasai origin dan kunci penandatangannya.
- **Client** — sistem AI otomatis yang memverifikasi dan mengonsumsi manifest.
- **dns_anchored** — flag verifikasi: kunci publik manifest cocok dengan DNS.
- **Level** — salah satu dari `VERIFIED`, `UNVERIFIED`, `SUSPENDED`.

Aturan normatif saat memproses input tak tepercaya:

- Key objek JSON duplikat MUST ditolak.
- Semua string MUST UTF-8 ternormalisasi NFC; input non-NFC MUST ditolak.
- Bilangan floating-point MUST ditolak di seluruh manifest.
- Integer MUST memenuhi `|n| <= 2^53 - 1`; nilai lebih besar MUST dikodekan sebagai string.
- Angka dalam notasi eksponen MUST berada dalam batas yang sama; nilai di luar batas
  MUST ditolak apa pun notasinya.
- Negative zero (`-0`) MUST dinormalisasi ke `0` oleh parser dan serializer.
- Kedalaman JSON MUST NOT melebihi 10.
- Field di luar spesifikasi MUST ditolak kecuali berawalan `x_`; field `x_` MUST diabaikan.

---

## 3. Discovery dan Tata Letak Berkas

```
/.well-known/ai.json            Manifest (bertanda tangan)
/.well-known/ai-signature.json  Lokasi default kontainer tanda tangan
/.well-known/ai.txt             Catatan human-readable (NON-NORMATIF, MUST NOT diparse)
/llms.txt                       Ringkasan konten untuk LLM (llms.txt v2)
```

### 3.1 Pengumuman dan Discovery

Origin SHOULD mengumumkan lokasi manifest pada setiap respons agar klien yang
AIFeed-aware dapat menemukannya pada kontak pertama:

- HTTP: `Link: </.well-known/ai.json>; rel="ai-feed"; type="application/json"`
- HTML: `<link rel="ai-feed" href="/.well-known/ai.json" type="application/json">`
- `robots.txt`: baris komentar `# AIFeed: <URL manifest absolut>` (diabaikan parser
  non-aware, terlihat oleh yang AIFeed-aware)
- `llms.txt` (v2): entri tautan menuju manifest

Urutan discovery untuk klien AIFeed-aware (normatif): (1) header `Link` dengan
`rel="ai-feed"`; (2) HTML `<link rel="ai-feed">`; (3) petunjuk `robots.txt`; (4)
fallback `/.well-known/ai.json`. Klien MUST memverifikasi (§7) dan men-cache (maks 1
jam) sebelum bertindak atas deklarasi apa pun.

Manifest bersifat **per-origin**. `www.example` dan `example` adalah dua origin
terpisah; origin yang ingin keduanya tercakup MUST menyajikan manifest di keduanya.

Server SHOULD mengirim `Content-Type: application/json`, UTF-8, dan
`Cache-Control: public, max-age=3600, must-revalidate`, serta mendukung `ETag` dengan
request kondisional (`If-None-Match` → `304`). Batas ukuran dihitung atas body
pasca-dekompresi: manifest ≤ 100 KB, kontainer tanda tangan ≤ 2 KB, `ai.txt` ≤ 50 KB.

---

## 4. Manifest (`ai.json`)

JSON Schema normatif: `https://aifeed.md/schema/ai-json/v0.1.json`.

### 4.1 Field wajib tingkat atas

`version`, `identity`, `validity`, `content`, `permissions`, `revocation`, `metadata`.

### 4.2 `identity`

| Field | Wajib | Catatan |
|---|---|---|
| `domain` | ya | Host saja, huruf kecil, bentuk A-label (IDNA2008); MUST sama dengan host penyaji |
| `name` | ya | Nama tampilan (≤ 256 char) |
| `organization` | tidak | Badan hukum |
| `type` | ya | Salah satu `ecommerce, news, education, government, saas, portfolio, community, docs, nonprofit, personal, other` |
| `locale` | ya | BCP 47 (mis. `id-ID`) |
| `contact` | ya | URI `mailto:` atau `https://` |
| `public_key` | ya | `ed25519:` + SPKI DER base64 (44 byte → 60 char, satu `=`) |
| `key_id` | ya | Label manusia; revokasi memakai fingerprint, bukan nilai ini |
| `signature_url` | ya | Path (default `/.well-known/ai-signature.json`) |

### 4.3 `validity`

`signed_at` dan `expires_at` adalah RFC 3339 UTC (`Z`, presisi detik). `signed_at` MUST
NOT lebih dari 300 detik di masa depan; `expires_at` MUST setelah `signed_at` dan MUST
di masa depan saat verifikasi. Kedua field berada di dalam payload tertandatangani.

### 4.4 `content`

`languages` (array BCP 47) WAJIB. Opsional: `llms_txt` dan `sitemap` (path),
`markdown` (`template` berisi `{path}`, boolean `link_relation`), dan `license`
(`name`, opsional `url` dan `rsl_url`).

### 4.5 `permissions`

`default` (`allow` | `deny`) WAJIB; key usage yang tidak ada mengikuti default. Key
`usage`: `search, retrieval, input, training, quote, summarize, reproduce, translate,
modify, embed, commercial_use` dengan nilai `allow` | `deny`. `attribution` bernilai
`required` | `optional` | `none`; opsional `attribution_url` dan `attribution_text`.

Pemetaan kosakata (informasional, versi-pin):

| AIFeed | IETF AIPREF (draft-ietf-aipref-vocab) | Cloudflare Content Signals |
|---|---|---|
| `search` | `search` | `search` |
| `retrieval` | `ai-use` | `ai-input` |
| `input` | `ai-use` (menunggu definisi "directly provided") | — |
| `training` | `train-ai` | `ai-train` |

### 4.6 `limits` (opsional)

`requests_per_minute`, `concurrent`, `crawl_delay_seconds` (semua integer).

### 4.7 `types`, `capabilities`, `actions`

`types` mendefinisikan tipe kembalian bernama (subset JSON Schema). `capabilities`
adalah operasi baca; `actions` adalah operasi ber-efek-samping dan menambah
`requires_auth`, opsional `auth`, opsional `payment_terms_url`,
`human_confirmation_required` (WAJIB pada actions), opsional
`requires_idempotency_key`, dan opsional `spending_limit` (objek `amount` integer +
`currency` ISO 4217). Tipe parameter terbatas pada `string`, `integer`, `boolean`;
`in` bernilai `query`, `path`, atau `body`.

### 4.8 `revocation`

`list_url` MUST `https://aifeed.md/revoke/v1/{domain}.json`.
`maximum_check_interval_hours` (integer) hanya boleh memperpendek interval klien; klien
MUST mengabaikan nilai di atas 168 jam.

### 4.9 `metadata`

`generated_at` (RFC 3339) WAJIB; opsional `generated_by`.

---

## 5. Tanda Tangan (`ai-signature.json`)

Kontainer detached dengan tiga field wajib:

```json
{
  "algorithm": "ed25519",
  "canonicalization": "jcs-rfc8785",
  "signature": "base64url:<86 chars>"
}
```

- **Algoritma:** Ed25519 pure (RFC 8032 §5.1). Ed25519ph/ctx TIDAK dipakai.
- **Kanonikalisasi:** JCS (RFC 8785) atas manifest hasil parse.
- **Byte tertandatangani:** `UTF-8("aifeed.v0.1\n") || JCS(manifest)` (domain separation).
- **Encoding tanda tangan:** base64url 64 byte → 86 char, tanpa padding.
- **Fingerprint kunci:** `sha256:` + base64url(SHA-256(SPKI DER)) — 43 char.

Klien MUST mengabaikan field lain pada kontainer, dengan satu pengecualian: `raw_digest` (di bawah) bermakna bila ada. Penandatangan MUST memvalidasi
manifest, memastikan `identity.public_key` cocok dengan kunci penandatangan, dan
memverifikasi tanda tangannya sendiri sebelum publikasi.

### 5.1 `raw_digest` (opsional)

`raw_digest` memberi integritas byte-level untuk manifest yang disimpan/di-cache lokal:

```json
{
  "sha-256": "<base64 standar SHA-256 atas byte mentah ai.json>",
  "applies_to": "raw-bytes"
}
```

- Dihitung atas **byte mentah** `ai.json` persis seperti disajikan (setelah transfer decoding); server AIFeed SHOULD mematuhi `Accept-Encoding: identity`. Bukan atas bentuk kanonik (JCS).
- Mendeteksi korupsi, bit-rot, atau reformatting byte-level pada file tersimpan. **Bukan** mekanisme authenticity dan MUST NOT menggantikan tanda tangan Ed25519: pihak yang bisa mengubah file juga bisa mengubah digest tersimpan.
- Diletakkan di signature container (tidak pernah di dalam `ai.json`) untuk menghindari sirkularitas.
- Klien yang memverifikasi byte tersimpan/offline MUST memverifikasi `raw_digest` bila ada; mismatch → `raw_digest_mismatch`. Verifikasi `raw_digest` dan verifikasi Ed25519 bersifat independen: file yang direformat tetapi semantiknya identik bisa gagal `raw_digest` namun tetap lulus signature.

---

## 6. Anchor DNS

```
_aifeed.example. 3600 IN TXT "v=aifeed1; pk=ed25519:<kunci>; fp=sha256:<fingerprint>; manifest=https://example/.well-known/ai.json"
```

Aturan: gabungkan seluruh string pada satu record TXT; `pk` MUST sama dengan
`identity.public_key`; bila `fp` ada, MUST cocok; beberapa record dengan `pk` berbeda →
UNVERIFIED; record tidak ada → VERIFIED dengan `dns_anchored=false`; `pk2` dicadangkan
untuk rotasi. Kunci duplikat dalam satu record (mis. dua field `pk`) MUST ditolak
(`txt_duplicate_key`) dan record dianggap tak dapat dipakai — jangan diam-diam
last-wins.

---

## 7. Prosedur Verifikasi (normatif)

```
INPUT : host (ternormalisasi: huruf kecil, A-label, tanpa titik akhir, tanpa port,
tanpa userinfo; tiap label 1–63 karakter, tanpa hubung di awal/akhir, total ≤253 karakter)
OUTPUT: { level, dns_anchored, dnssec_validated, warnings[] }

1.  FETCH https://{host}/.well-known/ai.json
    (HTTPS saja, tanpa redirect, timeout 10 dtk, ≤100 KB sebagaimana diterima, application/json,
    Accept-Encoding: identity). Bila header Content-Digest ada, verifikasi atas byte yang
    diterima (RFC 9530) sebelum parse; mismatch → UNVERIFIED (content_digest_mismatch);
    absen → warning content_digest_absent.
2.  404/error → UNVERIFIED(no_manifest)
3.  Parse ketat (duplikat, NFC, integer, kedalaman) → gagal → UNVERIFIED(kode parse)
4.  Validasi JSON Schema → gagal → UNVERIFIED(schema_violation)
5.  version ∈ {0.1, 0.1.x} → jika tidak → UNVERIFIED(upgrade_required)
6.  identity.domain == host → jika tidak → UNVERIFIED(domain_mismatch)
7.  Cek validity (signed_at, expires_at) → jika tidak → UNVERIFIED(kode validity)
8.  FETCH signature_url (≤2 KB) → 404 → UNVERIFIED(no_signature)
9.  msg = "aifeed.v0.1\n" || JCS(manifest)
10. Verifikasi Ed25519 → gagal → UNVERIFIED(bad_signature)
11. Resolve TXT _aifeed: cocok → dns_anchored=true; beda → UNVERIFIED(dns_mismatch);
    tidak ada → dns_anchored=false (warning)
12. FETCH revokasi (URL kanonik, cache ≤1 jam):
      suspended → SUSPENDED · under_review → UNVERIFIED · active → lanjut
13. Registry tak terjangkau: ≤24 jam → VERIFIED (+warning);
    24–168 jam → VERIFIED (warning revocation_stale);
    >168 jam → UNVERIFIED(revocation_unavailable)
14. Fingerprint kunci cocok dengan revocation.keys[] → UNVERIFIED(key_revoked)
15. Kembalikan level + flag + warning
```

Hardening klien: hanya port 443 (`port_not_allowed` bila tidak; fixture uji dengan
`allowPrivate` dikecualikan); tolak userinfo di URL (`credentials_not_allowed`); tolak
IP literal; resolve lalu blokir alamat privat, loopback, link-local, ULA, CGNAT-shared,
multicast, dan metadata; pin alamat hasil resolve selama setup koneksi dan abort bila
berubah (`dns_rebinding_detected`); tanpa redirect; verifikasi `Content-Type`; wajib
`Accept-Encoding: identity`; batas ukuran streaming; SNI MUST sama dengan host.

---

## 8. Tingkat Trust

| Level | Kondisi | Perilaku klien |
|---|---|---|
| VERIFIED | Schema + tanda tangan + domain + validity lulus; revokasi aktif | Hormati izin yang dideklarasikan |
| UNVERIFIED | Ada cek gagal, atau status under_review | Perlakukan sebagai saran; penggunaan berisiko tinggi (`training`, `reproduce`, `modify`, `commercial_use`) MUST ditolak |
| SUSPENDED | Status revokasi suspended | Jangan fetch; purge cache dalam 24 jam; beri peringatan |

Flag: `dns_anchored`, `dnssec_validated`, array warnings.

Rantai kepercayaan AIFeed terdiri dari empat lapis yang saling mengunci: TLS (identitas
transport), domain match (integritas referensi), signature Ed25519 (integritas isi), dan
DNS anchor (kepemilikan kunci). Tidak ada satu lapis pun yang cukup sendiri. Klien yang
patuh MUST NOT melakukan aksi berisiko tinggi (`training`, `reproduce`, `modify`,
`commercial_use`, `purchase`/`actions`) tanpa `level=VERIFIED` dan `dns_anchored=true`;
tanpa anchor, hanya `search`, `retrieval`, dan `input` yang diizinkan, dengan rate
konservatif + atribusi.

---

## 9. Revokasi

`GET https://aifeed.md/revoke/v1/{domain}.json` — dokumen bertanda tangan multi-sig:

- **Byte tertandatangani:** `"aifeed-revoke.v0.1\n" || JCS(dokumen tanpa array signatures)`.
- **Tanda tangan:** array; ambang 2-of-3 (interim) → 3-of-5 (foundation).
- **Status:** `active` | `under_review` | `suspended` (nilai lain →
  `revocation_status_invalid`); reason code: `repeated_spam`,
  `malware_distribution`, `identity_fraud`, `terms_violation`, `user_reports`.
- **Kedaluwarsa:** `expires_at` WAJIB (`revocation_expires_invalid` bila hilang atau tak
  terparse); umur di atas 30 hari SHOULD beri warning (`revocation_expiry_long`).
  Perbandingan domain case-insensitive, abaikan titik akhir, sadar-IDNA.
- **Cache:** ≤ 1 jam; kebijakan staleness per §7 langkah 13.
- **Transparansi:** semua kejadian revokasi & kunci masuk Merkle log (pola RFC 9162)
  dengan checkpoint bertanda tangan (format C2SP signed-note).

---

## 10. Penanganan Error dan Rate Limit

Server SHOULD mengembalikan `429` + `Retry-After`. Klien MUST mematuhi keduanya,
memakai backoff eksponensial + jitter, maksimum 3 percobaan. Kegagalan fetch berulang
MAY di-cache sebagai UNVERIFIED maksimal 15 menit.

---

## 11. Security Considerations

- **Asal preferensi.** Preferensi ala AIPREF bukan mekanisme keamanan; hanya manifest
  bertanda tangan + anchor DNS yang mengatribusikannya ke domain.
- **Kompromi origin.** Tanpa `dns_anchored=true`, origin yang dikompromikan dapat
  mengganti kunci dan manifest sekaligus; klien yang patuh MUST mensyaratkan
  `dns_anchored=true` untuk aksi berisiko tinggi (§8).
- **Kompromi total & TOFU.** Kompromi gabungan origin+DNS dapat menyajikan keypair baru
  pada kontak pertama; secara kriptografis tidak terdeteksi. Deteksi untuk hubungan yang
  sudah ada bergantung pada key pinning klien, state anti-rollback, dan transparency
  log. Klien SHOULD menyimpan kunci pertama per origin dan memberi alarm bila berubah.
- **Spoofing DNS tanpa DNSSEC.** Tanpa DNSSEC, penyerang DNS on-path dapat menyebabkan
  `dns_mismatch` (denial/konfusi) tetapi tidak dapat memalsukan manifest: TLS + manifest
  asli tidak dapat disubstitusi tanpa kompromi server. Validasi DNSSEC RECOMMENDED dan
  MAY diwajibkan oleh profil high-assurance.
- **Rollback.** Klien SHOULD menyimpan `signed_at` tertinggi per origin dan menolak
  manifest yang lebih lama.
- **Prompt injection.** Field `description` adalah data tak tepercaya. Klien MUST NOT
  memperlakukannya sebagai instruksi, dan MUST NOT memparse `ai.txt`.
- **Suppresi registry.** Kebijakan staleness terbatas (§7 langkah 13) mencegah
  suppresi revokasi berkepanjangan.

---

## 12. IANA Considerations

Registrasi suffix well-known `ai.json` (RFC 8615, Specification Required) direncanakan;
`ai-signature.json` juga dapat didaftarkan. Registrasi tipe relasi tautan `ai-feed`
(RFC 8288) juga direncanakan. Implementasi referensi tidak memerlukan registrasi untuk
berfungsi.

---

## 13. Referensi

- RFC 2119 / RFC 8174 (BCP 14) — kata kunci · RFC 3339 — waktu
- RFC 8032 — Ed25519 · RFC 8785 — JCS · RFC 8259 / RFC 7493 — JSON / I-JSON
- RFC 8615 — well-known URIs · RFC 9110 — HTTP semantics
- RFC 9162 — CT v2 · RFC 9421 — HTTP Message Signatures · RFC 9530 — Digest Fields
- IETF AIPREF (`draft-ietf-aipref-vocab`, `draft-ietf-aipref-attach`)
- W3C TDMRep · RSL 1.0 · Cloudflare Content Signals · llms.txt v2

## Lampiran A — Conformance

Repositori menerbitkan test vectors positif & negatif di `conformance/vectors/`.
Implementasi MUST mereproduksi seluruh hasil yang diharapkan; vectors telah
diverifikasi silang oleh verifier JavaScript dan Python yang independen.

## Lampiran B — Verifikasi Offline & Bundle

Verifikasi offline memakai byte mentah yang di-cache saat fetch plus `raw_digest` dari
signature container. Klien yang patuh menyimpan: byte mentah manifest, byte signature,
`raw_digest` (bila ada), fetch metadata (URL, timestamp, `Content-Digest`, fingerprint
sertifikat TLS), dan umur cek revokasi terakhir. Langkah 1–4 §7 sepenuhnya offline.

Untuk skenario air-gapped & audit, bundle adalah direktori berisi `manifest/`
(`ai.json`, `ai-signature.json`, `fetch-metadata.json`), snapshot `governance/` dan
`revocation/` opsional, serta `BUNDLE-MANIFEST.json` yang memuat SHA-256 dan ukuran
setiap file plus tanda tangan bundler Ed25519 opsional atas `"aifeed-bundle.v0.1\n" || JCS`
dari manifest tanpa field `bundler`. Bundle lebih tua dari 168 jam menurunkan trust
(UNVERIFIED `bundle_stale`); bundle tidak pernah menggantikan freshness revokasi online.
Verifier WAJIB menolak entri bundle dengan path absolut, segmen `..`, atau path yang
keluar dari direktori bundle (`bundle_manifest_invalid`) — bundle jahat tidak boleh
menyebabkan baca di luar root-nya.

## Lampiran C — Skenario Serangan

| # | Skenario | Lapis yang menangkap | Hasil |
|---|---|---|---|
| 1 | Manifest sah di-host di domain lain | Domain match | UNVERIFIED |
| 2 | Isi diubah setelah signing | Signature Ed25519 | UNVERIFIED |
| 3 | Kunci diganti + re-sign penyerang | Cross-check DNS (`dns_mismatch`) | UNVERIFIED |
| 4 | Origin dikompromikan, keypair baru | Cross-check DNS (`dns_mismatch`) | UNVERIFIED |
| 5 | DNS dikompromikan, TXT pk diganti | Cross-check DNS/manifest; signature manifest tetap sah | UNVERIFIED |
| 6 | Origin **dan** DNS dikuasai (keypair baru) | Tidak ada pada kontak pertama (TOFU); terdeteksi via pinning/anti-rollback + transparency log untuk hubungan lama | VERIFIED (peer baru) / terdeteksi (peer lama) |
| 7 | MITM jaringan mengubah body | TLS (+ signature) | UNVERIFIED |
| 8 | CDN menyajikan salinan lama | Anti-rollback `signed_at` | UNVERIFIED |
| 9 | Replay file lama yang valid | Anti-rollback `signed_at` | UNVERIFIED |
| 10 | Manifest palsu di domain penyerang | TLS + domain match | UNVERIFIED |
| 11 | Korupsi transport (bit-flip) | `Content-Digest` (RFC 9530) | UNVERIFIED |
| 12 | Korupsi/reformatting file lokal | `raw_digest` | UNVERIFIED |

Forgery penuh menuntut kompromi gabungan origin+DNS; untuk hubungan yang sudah ada hal
ini terdeteksi via key pinning dan transparency log. DNSSEC menutup spoofing DNS
on-path; tanpanya, spoofing DNS sendirian menghasilkan `dns_mismatch`, bukan forgery.
