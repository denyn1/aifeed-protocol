# Spesifikasi AIFeed

<p><a href="README.md">English</a> · <a href="README.id.md">Bahasa Indonesia</a> · <a href="README.zh.md">中文</a></p>

Bahasa kanonik: **Inggris** (`spec/en/`). Terjemahan (`spec/<lang>/`) bersifat
informasional; bila berbeda, versi Inggris yang berlaku.

| Dokumen | Versi | Status | Cakupan |
|---|---|---|---|
| [`en/aifeed-v0.1.md`](en/aifeed-v0.1.md) · [id](id/aifeed-v0.1.md) · [zh](zh/aifeed-v0.1.md) | 0.1.0-rc1 | Release candidate | Deklarasi bertanda tangan: manifest, tanda tangan, anchor DNS, revokasi, bundel |
| [`en/aifeed-v0.2.md`](en/aifeed-v0.2.md) · [id](id/aifeed-v0.2.md) · [zh](zh/aifeed-v0.2.md) | 0.2.0-draft | Draf | Profil trust MAKO: tanda tangan MAKO, pengikatan izin, indeks delta, aset, triage |
| [`en/aifeed-aimd-v1.md`](en/aifeed-aimd-v1.md) · [id](id/aifeed-aimd-v1.md) · [zh](zh/aifeed-aimd-v1.md) | 1.0 (protokol), AIFeed 0.2 | Draf | Profil konten native **AIFeed Markdown**, mode operasi dual-stack, rencana registrasi media type |

Dokumen terkait di luar `spec/`:

- [`../docs/EXTENSION.md`](../docs/EXTENSION.md) — proposal kepada komunitas MAKO untuk lapisan trust
  (tanda tangan + izin + delta) sebagai ekstensi hulu.
- [`../paper/main.md`](../paper/main.md) — draf preprint arXiv (judul kerja:
  *AIFeed: Verifiable Content Permissions and Efficient Agent Delivery for the
  AI Web*), dengan bibliografi terverifikasi dan ledger klaim.
- [`../CHANGELOG.md`](../CHANGELOG.md) — riwayat protokol dan implementasi referensi.
- [`../GOVERNANCE.md`](../GOVERNANCE.md) — governance interim, proses registry, dan
  kebijakan lisensi/open-core (apa yang permanen terbuka vs privat).
- [`../SECURITY.md`](../SECURITY.md) — pelaporan kerentanan dan kompromi kunci.

Artefak konformansi: `conformance/vectors` (manifest), `conformance/mako` (MAKO),
`conformance/aimd` (AIFeed Markdown), plus fixture revokasi dan bundel.

## Status draf

Dokumen v0.1.0-rc1, 0.2, dan AIFeed Markdown v1 **belum dibekukan**. Perubahan mengikuti
[`../CONTRIBUTING.md`](../CONTRIBUTING.md); perubahan breaking menaikkan versi minor
protokol dan harus disertai vektor konformansi yang diperbarui.
