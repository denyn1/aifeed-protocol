# aifeed (Python)

Verifier Python independen untuk [protokol AIFeed](https://aifeed.md): izin konten
bertanda tangan untuk web AI. Hanya pustaka standar — tanpa dependensi pihak ketiga.

```bash
pip install aifeed
```

## Verifikasi direktori atau manifest

```python
from aifeed import verify

report = verify.verify_directory('./my-site', domain='example.com')
print(report['result'], report['errors'])
```

```python
from aifeed import verify

with open('ai.json', encoding='utf-8') as handle:
    manifest = handle.read()
with open('ai-signature.json', encoding='utf-8') as handle:
    signature = handle.read()
report = verify.verify(manifest, signature, domain='example.com')
```

## Revokasi, bundel, digest

```python
from aifeed import verify

verify.verify_revocation_document(text, domain='example.com', governance_keys=keys)
verify.verify_bundle('./my-bundle')                 # bundel audit offline
verify.parse_strict(text)                           # JSON ketat (tanpa float/duplikat, NFC)
verify.verify_content_digest(header, body_bytes)    # Content-Digest (RFC 9530)
```

## Dokumen AIFeed Markdown / MAKO

```python
from aifeed import mako

parsed = mako.parse_frontmatter(page_bytes)
fields = mako.validate_aimd_fields(parsed['frontmatter'])   # atau validate_mako_fields
result = mako.verify_mako_container(container_text, page_url, body_bytes, public_key_value)
index = mako.verify_aimd_index(index_text, index_url, public_key_value)
```

## Baris perintah

```bash
aifeed-verify ./my-site --json                       # verifikasi direktori
aifeed-verify ai.json --domain example.com --json    # satu manifest + tanda tangan
aifeed-verify revocation ./revocation.json --json    # registri multi-tanda-tangan
aifeed-verify bundle ./my-bundle --json              # bundel offline
aifeed-mako page.aifeed.md                           # verifikasi frontmatter/kontainer
```

Jalur lama tetap bekerja: `import aifeed_verify` / `import aifeed_mako` dan
`python clients/python/aifeed_verify.py` adalah alias untuk `aifeed.verify` / `aifeed.mako`.

## Sumber

Bagian dari [aifeed-protocol](https://github.com/denyn1/aifeed-protocol) (`clients/python/`),
diuji secara diferensial terhadap vektor konformansi bersama implementasi JavaScript.
Spesifikasi: `spec/id/`; panduan agen: `docs/agent-quickstart.id.md`.
