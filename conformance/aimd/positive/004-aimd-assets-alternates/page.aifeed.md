---
aimd: "1.0"
type: article
entity: "Panduan AIFeed Markdown"
updated: 2026-09-15
tokens: 120
language: id
canonical: https://berita.example/artikel/aimd
summary: "Dokumen native AIFeed."
aifeed:
  policy_version: "0.2"
  usage:
    training: deny
    summarize: allow
  attribution: required
  limits:
    requests_per_minute: 30
  assets:
    - url: /laporan.pdf
      type: document
      title: "Laporan"
alternates:
  - url: https://contoh.example/en/aimd
    lang: en
---

# Panduan AIFeed Markdown

AIFeed Markdown adalah profil konten native AIFeed.
