# aifeed（Python）

[AIFeed 协议](https://aifeed.md)的独立 Python 验证器：面向 AI 网络的内容许可签名。
仅使用标准库——无第三方依赖。

```bash
pip install aifeed
```

## 验证目录或 manifest

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

## 撤销、离线包与摘要

```python
from aifeed import verify

verify.verify_revocation_document(text, domain='example.com', governance_keys=keys)
verify.verify_bundle('./my-bundle')                 # 离线审计包
verify.parse_strict(text)                           # 严格 JSON（无浮点/重复键，NFC）
verify.verify_content_digest(header, body_bytes)    # Content-Digest（RFC 9530）
```

## AIFeed Markdown / MAKO 文档

```python
from aifeed import mako

parsed = mako.parse_frontmatter(page_bytes)
fields = mako.validate_aimd_fields(parsed['frontmatter'])   # 或 validate_mako_fields
result = mako.verify_mako_container(container_text, page_url, body_bytes, public_key_value)
index = mako.verify_aimd_index(index_text, index_url, public_key_value)
```

## 命令行

```bash
aifeed-verify ./my-site --json                       # 目录验证
aifeed-verify ai.json --domain example.com --json    # 单个 manifest + 签名
aifeed-verify revocation ./revocation.json --json    # 多签撤销注册表
aifeed-verify bundle ./my-bundle --json              # 离线包
aifeed-mako page.aifeed.md                           # frontmatter/容器验证
```

历史路径仍可用：`import aifeed_verify` / `import aifeed_mako` 与
`python clients/python/aifeed_verify.py` 是 `aifeed.verify` / `aifeed.mako` 的别名。

## 源码

[aifeed-protocol](https://github.com/denyn1/aifeed-protocol)（`clients/python/`）的一部分，
与 JavaScript 实现共享一致性向量并做差分测试。规范：`spec/zh/`；代理指南：
`docs/agent-quickstart.zh.md`。
