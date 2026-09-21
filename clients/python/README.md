# aifeed (Python)

Independent Python verifier for the [AIFeed protocol](https://aifeed.md): signed content
permissions for the AI web. Standard library only — no third-party dependencies.

```bash
pip install aifeed
```

## Verify a directory or manifest

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

## Revocations, bundles, digests

```python
from aifeed import verify

verify.verify_revocation_document(text, domain='example.com', governance_keys=keys)
verify.verify_bundle('./my-bundle')                 # offline audit bundle
verify.parse_strict(text)                           # strict JSON (no floats/dupes, NFC)
verify.verify_content_digest(header, body_bytes)    # Content-Digest (RFC 9530)
```

## AIFeed Markdown / MAKO documents

```python
from aifeed import mako

parsed = mako.parse_frontmatter(page_bytes)
fields = mako.validate_aimd_fields(parsed['frontmatter'])   # or validate_mako_fields
result = mako.verify_mako_container(container_text, page_url, body_bytes, public_key_value)
index = mako.verify_aimd_index(index_text, index_url, public_key_value)
```

## Command line

```bash
aifeed-verify ./my-site --json                       # directory verification
aifeed-verify ai.json --domain example.com --json    # single manifest + signature
aifeed-verify revocation ./revocation.json --json    # multi-signature registry
aifeed-verify bundle ./my-bundle --json              # offline bundle
aifeed-mako page.aifeed.md                           # frontmatter/container verification
```

The historical paths still work: `import aifeed_verify` / `import aifeed_mako` and
`python clients/python/aifeed_verify.py` are aliases for `aifeed.verify` / `aifeed.mako`.

## Source

Part of [aifeed-protocol](https://github.com/denyn1/aifeed-protocol) (`clients/python/`),
differential-tested against the shared conformance vectors alongside the JavaScript
implementation. Specs: `spec/en/`; agent guide: `docs/agent-quickstart.md`.
