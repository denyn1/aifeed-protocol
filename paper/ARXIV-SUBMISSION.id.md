# Paket submission arXiv

<p><a href="ARXIV-SUBMISSION.md">English</a> · <a href="ARXIV-SUBMISSION.id.md">Bahasa Indonesia</a> · <a href="ARXIV-SUBMISSION.zh.md">中文</a></p>

Bundel siap-unggah untuk preprint:

> **AIFeed: Verifiable Content Permissions and Efficient Agent Delivery for the AI Web**

## File yang diunggah

| File | Kegunaan |
|---|---|
| `paper/main.tex` | Sumber LaTeX (mandiri; diagram TikZ inline) |
| `paper/refs.bib` | Bibliografi (52 entri terverifikasi, natbib/plainnat) |
| `paper/00README.json` | Memberi tahu AutoTeX arXiv untuk memakai `pdflatex` |
| `paper/aifeed-arxiv.tar.gz` | **Unggah ini** (arXiv lebih memilih `.tar.gz`) |

Regenerasi bundel setelah mengedit paper:

```bash
cd paper
tar -czf aifeed-arxiv.tar.gz main.tex refs.bib 00README.json
```

Tidak ada LaTeX yang terpasang lokal; arXiv menjalankan `pdflatex` + BibTeX sendiri. Bila
terjadi error bibliografi, buka proyek di Overleaf, kompilasi sekali, unduh `main.bbl`
yang dihasilkan, lalu unggah ulang bersama `main.tex` dan `refs.bib` (itu satu-satunya
mode kegagalan umum untuk `plainnat`).

## Metadata untuk formulir submission

**Judul:** AIFeed: Verifiable Content Permissions and Efficient Agent Delivery for the AI Web

**Penulis:** AIFeed Protocol Contributors

**Kategori utama:** `cs.CR` (Cryptography and Security)
**Cross-list:** `cs.AI` (Artificial Intelligence), `cs.IR` (Information Retrieval),
`cs.NI` (Networking and Internet Architecture)

**Komentar:** Preprint, 13 bagian. Implementasi referensi, schema, dan 84 vektor
konformansi: https://github.com/denyn1/aifeed-protocol

**Lisensi:** disarankan **CC BY 4.0** (spesifikasi CC BY 4.0; kode MIT).

**Abstrak (teks polos untuk formulir):**

AI systems now consume more web content than people do, and the plain-text preferences in
robots.txt do not hold them back: one vendor logged 1.9 billion crawls that ignored robots
rules in a single half-year, and one web-only measurement put the crawl-to-referral ratio
of a major AI provider at 70,900:1. Preference and licensing signals exist, but they are
not attributable to a domain, cannot be revoked, and do nothing about the cost of repeated
consumption. We describe AIFeed, an open trust layer built around a signed manifest of
machine-readable permissions, anchored in DNS and checked against a multi-signature
revocation registry. Two content profiles ride on the same signed bytes: a native markdown
format (AIFeed Markdown) and a compatibility profile for the external MAKO draft. Three
properties, taken together, distinguish the design from the signals we surveyed: signed
provenance of permissions, per-page binding with restrict-only overrides, and a
digest-bearing delta index that lets an agent skip pages that have not changed.

We measure the system on committed artifacts. Converting a 60-page corpus to the markdown
profiles cuts transferred bytes by 68.8% (95.7% for delta consumption), and a loopback
enforcement harness with four client profiles records publisher savings of 55.2% of bytes
and 56.2% of CPU, AI-side savings of 54.8% (72.9% for the compliant client), 14 of 18
unchanged pages skipped, and signature verification at 0.70 ms per page. The specification
is exercised by 34 manifest, 39 MAKO, and 11 AIFeed Markdown vectors under independent
JavaScript and Python verifiers, plus differential PHP fixtures and an end-to-end
WordPress deployment. We also report results that do not flatter the design: without
adoption and enforcement there are no savings at all; vendor claims of up to 94% token
reduction rely on summarization our converter does not perform; origin-plus-DNS compromise
is invisible on first contact; and the compatibility profile depends on a third-party
draft. No external cryptographic review or live pilot exists yet.

## Sebelum menekan submit

- [x] Repositori publik dengan tag terpin (`v1.0.0-draft`) —
      https://github.com/denyn1/aifeed-protocol
- [ ] Konfirmasi email kontak (`contact@aifeed.md` masih placeholder di catatan kaki
      penulis; buat mailbox-nya atau ganti dengan alamat nyata)
- [ ] Akun arXiv + endorsement yang diperlukan untuk `cs.CR` (pengirim pertama kali
      mungkin butuh endorser; formulir submission akan memberi tahu)
- [ ] Opsional: pindahkan repositori ke organisasi `aifeed` dan perbarui URL artefak di
      `main.tex` (satu `replace` + bangun ulang bundel)
- [ ] Setelah diterima: tambahkan ID arXiv ke `paper/CHECKLIST.md` dan footer situs

## Setelah submission

1. URL listing arXiv dan DOI (bila diberikan) masuk ke `paper/CHECKLIST.md`.
2. Sitasi preprint dari footer landing page bila diinginkan.
3. Pertahankan `v1.0.0-draft` sebagai versi artefak terpin untuk reviewer; versi wire di
   dalam paper (manifest 0.1/0.2, AIFeed Markdown 1.0, MAKO 0.2) independen dari nomor
   rilis.
