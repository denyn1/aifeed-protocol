---
mako: "1.0"
type: article
entity: "Panduan Protokol AIFeed"
updated: 2026-09-14
language: id
canonical: https://berita.example/artikel/aifeed-protokol
summary: "Ringkasan singkat tentang AIFeed dan MAKO."
aifeed:
  policy_version: "0.2"
  usage:
    training: deny
    summarize: allow
  attribution: required
  limits:
    requests_per_minute: 30
---

# Panduan Protokol AIFeed

AIFeed v0.2 mengikat deklarasi izin bertanda tangan ke format MAKO per halaman.

## Poin Kunci

- Izin diwarisi dari manifest dan hanya boleh diperketat
- Tanda tangan mengikat konten ke URL halaman
- Indeks delta menghapus crawl berulang
