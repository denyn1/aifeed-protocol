# 提案：面向 MAKO 的 AIFeed 信任层（扩展规范）

<p><a href="EXTENSION.md">English</a> · <a href="EXTENSION.id.md">Bahasa Indonesia</a> · <a href="EXTENSION.zh.md">中文</a></p>

**状态：** 供讨论的草案（拟通过 CONTRIBUTING 提交给 `mako-spec` 社区）
**作者：** AIFeed Protocol Contributors
**日期：** 2026-09-15
**参考实现：** 本仓库（`spec/`、`lib/`、`bin/`）、`wp-plugin/`

---

## 1. 摘要

MAKO 定义了网页如何向 AI 智能体提供语义优化的 markdown。MAKO 规范有意把内容真实性与
验证排除在范围之外：

> "MAKO does not provide built-in mechanisms to verify that the MAKO representation is
> faithful to the source HTML. This is intentional. […] The protocol provides verifiable
> content; it does not provide verification." —— MAKO Specification v0.1.0, §10.3

本提案规定一个**可选的信任层**，在不改变 MAKO 必需行为的前提下补上这块缺失：

1. **AIFeed-Verified MAKO** —— 覆盖原始 MAKO 字节的 Ed25519 分离签名，绑定页面 URL
   与 DNS 锚定的源站密钥。
2. **许可绑定** —— 可选的 `aifeed` frontmatter 块，把使用许可、速率限额与许可条款
   绑定到单个页面，从签名源站 manifest 继承并默认受限。
3. **增量索引** —— 可选的、可分页的索引，带逐条 SHA-256 摘要，让智能体只抓取变化的
   内容（`304`/摘要差异），而不是重新爬取。

不带此扩展的 MAKO 文档仍然完全有效、保持不变。扩展仅限于一个可选 frontmatter 键与可选
HTTP 响应头，因此既有 MAKO 解析器与智能体继续工作（未知键按 MAKO §5.1 指引忽略）。

**双栈说明。** AIFeed 还定义了自己的原生内容配置 **AIFeed Markdown**
（`text/aifeed+markdown`、`.aifeed.md`、`aimd: "1.0"`），规定于
`spec/en/aifeed-aimd-v1.md`。MAKO 仍是一等的**兼容配置**：同一份签名字节可以在两种
媒体类型下提供，各带自己的签名上下文（`aimd` / `mako`），跨格式重放被拒绝。本提案在
两种情况下都有用——若 `aifeed` 扩展被上游采纳，MAKO 获得信任层；若未被采纳，同一信任层
存在于原生配置中，也不阻碍互操作性。

---

## 2. 动机

- **归属。** MAKO §10.4 承认发布方可以生成任意内容，消费者必须自我保护。签名让 MAKO
  文档可归属到域名密钥：垃圾与操纵可追溯到真实源站，并有撤销路径。
- **许可清晰。** MAKO 承载内容；AIFEed 承载该内容的*规则*（训练、检索、引用、摘要、
  署名、速率限额、许可）。签名的规则可执行、可审计；HTML 里的无签名文字则不然。
- **效率。** MAKO 已去除标记噪音。签名与索引消除剩余浪费：重新下载未变更页面、重新
  验证未知内容。在 60 页新闻语料上实测：MAKO 转换相比 HTML 字节 −68.8%，增量消费相比
  重爬 HTML −95.7%，验证约 0.28 ms/页（`benchmarks/mako-report.md`）。
- **互补性。** 本提案与 CEF embeddings（按 MAKO §10.2 视为不可信提示）以及
  `/.well-known/mako` 发现兼容。

---

## 3. 非目标

- 不是 MAKO 内容格式、发现或响应头的替代品。
- 不是支付协议；许可引用（RSL/价格）仅是声明。
- 不是消费侧排名或垃圾过滤。
- 不改变 MAKO 必需字段、媒体类型或协商语义。

---

## 4. 扩展 A —— `aifeed` frontmatter 块（可选）

```yaml
---
mako: "1.0"
type: article
entity: "Panduan Protokol AIFeed"
updated: 2026-09-14
tokens: 280
language: id
aifeed:
  policy_version: "0.2"
  usage:                # restrict-only overrides by default
    training: deny
    summarize: allow
  attribution: required
  limits:
    requests_per_minute: 30
    concurrent: 2
  license:              # informational (RSL/payment discovery)
    rsl_url: https://example.com/rsl.xml
    price: { amount: 250, currency: USD }
  assets:               # media and downloadable file links (optional)
    - { url: /uploads/cover.webp, type: image, alt: "Cover" }
    - { url: /laporan.pdf, type: document, title: "Full report" }
---
```

规则：

- 该块是**可选的**；缺失意味着"继承源站 manifest"。
- 除非源站 manifest 声明 `content.mako.overrides: "bidirectional"`，覆盖为
  **restrict-only**。页面不能授予源站拒绝的内容。
- 署名严格度为 `required > optional > none`；限额只能收紧。
- `assets` 仅以引用形式列出媒体与可下载文件（图片、视频、音频、文档、压缩包、
  `file`）——绝不内联，获取它们遵循与内容相同的许可与限额，由智能体决定是否下载。
- 解析器必须使用安全 YAML 子集：无锚点、别名、标签、flow 集合、块标量或合并键；
  深度（6）、节点（512）与标量大小（8 KiB）有界。

---

## 5. 扩展 B —— 分离签名容器（可选）

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

- **签名字节：** `UTF-8("aifeed.mako.v0.2\n") || ASCII(url) || LF || raw bytes`，
  其中 `raw bytes` 是服务时原样的 MAKO 文档字节，`url` 是规范页面 URL（主机小写，
  无 fragment/query）。要求 `https`；实现仅可在测试时接受回环 `http`。
- **投递（优先级）：**
  1. 内联响应头：`X-Aifeed-Signature: mako1:<base64url(JCS(container))>`
  2. 声明的边车：`X-Aifeed-Signature-URL` 或 `Link: rel="aifeed-signature"`
  3. 默认边车：`{mako-url}.sig`
- 签名密钥是源站发布在其 AIFeed manifest（`/.well-known/ai.json`，本身经签名并通过
  `_aifeed` TXT DNS 锚定）中的 Ed25519 密钥。
- 索引可以用 `context: "mako-index"` 及
  `UTF-8("aifeed.mako-index.v0.2\n") || ASCII(url) || LF || raw bytes` 签名，以边车
  （`{index-url}.sig`）投递。自引用的内嵌签名未定义。

---

## 6. 扩展 C —— 增量索引（可选）

`/.well-known/mako-index.json`（路径由 manifest 声明）：

```json
{
  "version": "0.2",
  "domain": "example.com",
  "site": {
    "name": "Example News",
    "description": "Independent daily news, technology and business desks.",
    "type": "news",
    "languages": ["en"],
    "updated_at": "2026-09-15T08:00:00Z"
  },
  "generated_at": "2026-09-15T08:00:00Z",
  "page": 1,
  "page_count": 1,
  "entries": [
    { "url": "/product/123", "type": "product", "tokens": 280,
      "title": "Nike Air Max 90", "summary": "Casual running shoe, 79.99 EUR.",
      "tags": ["running", "shoes"], "lang": "en",
      "updated": "2026-09-14", "etag": "\"mako-a1b2c3\"",
      "sha-256": "<43 chars + '='>" }
  ]
}
```

- 可选的 `site` 对象是站点级摘要（名称、描述 ≤500、类型、语言、许可证、updated_at），
  让智能体在抓取前了解源站。
- 条目可携带分流字段（`title`、`summary` ≤160、`tags` ≤10、`lang`、`related` ≤20），
  让智能体无需下载即可排序与挑选页面；所有分流字段只能来自已发布内容。
- 可分页（`Link: rel="next"`）、条件请求（`If-None-Match`）、`?since=` 可选。
- 发布方还可以为不支持 AIFeed 的工具提供 `/llms.txt`（llms.txt v2）作为无签名的发现
  文本；许可始终来自签名 manifest，绝不来自 llms.txt。
- 条目与分流字段是**不可信声明**：客户端使用前必须对抓取到的字节验证每个 `sha-256`。

---

## 7. 一致性级别（提议）

| 级别 | 要求 |
|---|---|
| `AIFeed-C1` | 校验签名源站 manifest（v0.1/v0.2） |
| `AIFeed-C2` | C1 + 通过协商消费 MAKO + restrict-only 许可绑定 |
| `AIFeed-C3` | C2 + 验证 MAKO 签名（所有投递模式）+ 降级处理 |
| `AIFeed-C4` | C3 + 增量索引 + 撤销 + 带 MAKO 快照的离线包 |

---

## 8. 安全考虑（摘要）

- 要求安全 YAML 子集（frontmatter 是攻击者可触达的输入）。
- URL 绑定防止跨页重放；摘要不匹配与坏签名是硬失败。
- Manifest 的 `signature: "required"` 防止静默剥离；签名缺失会对该源站产生高风险拒绝。
- 索引投毒通过逐条摘要与可选索引签名缓解。
- CEF embeddings 仍是不可信的预过滤提示（MAKO §10.2）。
- `X-Mako-*` 与 `X-Aifeed-*` 响应头不得出现在 `401`/`403` 上（扩展 MAKO §10.6）。

---

## 9. 向后兼容

- MAKO 必需字段、媒体类型、协商与响应头未被改动。
- 扩展新增一个可选 frontmatter 键（`aifeed`）与可选响应头（`X-Aifeed-*`），以及可选
  的 well-known 文档。
- 忽略未知 frontmatter 键的 MAKO 解析器无需任何改动。
- 降级优雅：未签名的 MAKO 仍是有效 MAKO；信任层只是报告 `mako_verified = false`。

---

## 10. 参考实现

- 规范（EN + ID + ZH）：`spec/en/aifeed-v0.2.md`、`spec/id/aifeed-v0.2.md`、
  `spec/zh/aifeed-v0.2.md`
- Schema：`schema/ai-json.v0.2.json`、`schema/mako.v0.2.json`、
  `schema/mako-signature.v0.2.json`、`schema/mako-index.v0.2.json`
- 一致性向量：`conformance/mako/`（39 个用例）——由独立的 JavaScript 与 Python 实现
  验证。
- CLI：`aifeed mako generate|sign|verify|index|fetch`
- SDK：`packages/aifeed-verify`（`fetchMako`、`fetchIndexDelta`、`mako.*`）
- 发布方：`wp-plugin/`（WordPress，内容协商 + 签名 + 索引）
- 基准：`benchmarks/mako-report.md`

扩展文本以 CC BY 4.0 发布；代码以 MIT 发布。我们欢迎审阅、命名反馈，以及与 MAKO
路线图（站点级 manifest，§13）的对齐。
