# AIFeed v0.2 — MAKO 信任配置（对 v0.1 的扩展）

<p><a href="../en/aifeed-v0.2.md">English</a> · <a href="../id/aifeed-v0.2.md">Bahasa Indonesia</a> · <a href="aifeed-v0.2.md">中文</a></p>

**版本：** 0.2.0-draft
**状态：** 草案——尚未冻结（见"本文档状态"）
**正本语言：** 英文（本文档）。译文仅供参考。
**许可证：** CC BY 4.0（本文档）· MIT（参考实现）

---

## 摘要

AIFeed v0.1 定义了 AI 系统可以对 Web 源站内容做什么的、签名且 DNS 锚定的声明。
本扩展（v0.2）把这些声明绑定到 **MAKO（Markdown Agent Knowledge Optimization）**——
面向 AI 智能体的开放逐页 markdown 交付格式——并补齐 MAKO 有意留下的验证缺口：

> "MAKO 不提供内置机制来验证 MAKO 表示是否忠实于源 HTML。这是有意为之。[…]
> 协议提供可验证的内容；它不提供验证。" —— MAKO Specification v0.1.0, §10.3

AIFeed v0.2 在 MAKO 之上新增三层：

1. **AIFeed-Verified MAKO** —— 可选的 Ed25519 分离签名，覆盖 MAKO 文档的原始字节，
   绑定到页面 URL 与 manifest 密钥。
2. **许可绑定** —— MAKO frontmatter 中的逐页许可、限额与许可条款覆盖（`aifeed:` 块），
   从 manifest 继承并默认受限（"restrict-only"）。
3. **增量消费** —— 可选的、分页的 MAKO 索引，带逐条摘要，使客户端只抓取发生变化的
   内容（`304` / 索引差异），而不必爬 HTML。

AIFeed v0.2 是增量式的：v0.1 各章节仍然具规范性，除非本文明确修订；v0.2 客户端必须
始终能够验证 v0.1 manifest。

---

## 本文档状态

这是面向参考实现与互操作性测试的草案扩展。规范**尚未冻结**；在 v0.2.0 正式版之前允许
变更。BCP 14 关键词（RFC 2119、RFC 8174）适用。

两个外部依赖被固定并跟踪：

| 依赖 | 固定引用 | 变更政策 |
|---|---|---|
| MAKO | 协议 `"1.0"`，规范文档 v0.1.0（Draft，2026-02-18） | 见附录 A |
| AIFeed v0.1 | `spec/en/aifeed-v0.1.md`（0.1.0-rc1） | 仅在所述之处修订 |

---

## 1. 与 v0.1 的关系

1. 本文档是**扩展规范**。v0.1 的第 1–13 节与附录 A–C 对所有 manifest（包括版本
   `0.2.x`）仍然具规范性，除非本文明确修订（§5、§9、§10、§14、本文附录 D）。
2. `version` 匹配 `^0\.2(\.[0-9]+)?$` 的 manifest 必须同时满足 v0.1 schema（除版本
   模式外）与 `schema/ai-json.v0.2.json`。
3. **依赖版本的域分离。** manifest 的签名字节取决于其 `version` 字段：

   | Manifest `version` | 签名字节 | 签名 schema |
   |---|---|---|
   | `0.1.x` | `UTF-8("aifeed.v0.1\n") \|\| JCS(manifest)` | `ai-signature.v0.1.json` |
   | `0.2.x` | `UTF-8("aifeed.v0.2\n") \|\| JCS(manifest)` | `ai-signature.v0.2.json` |

4. 版本接受（规范性）：v0.2 客户端必须接受 `version ∈ {0.1, 0.1.x}`；必须接受
   `version ∈ {0.2, 0.2.x}`；其他值 → `UNVERIFIED(upgrade_required)`。遇到 `0.2.x`
   的 v0.1 客户端返回 `UNVERIFIED(upgrade_required)`——这是预期且安全的行为。
5. MAKO 相关要求仅适用于声明了 `content.mako` 的源站 manifest（§5.2）。没有 AIFeed
   manifest 的源站提供的 MAKO 文档不在 AIFeed 信任语义之内（`UNVERIFIED`）。

---

## 2. 约定与术语（补充）

- **MAKO 文档** —— 带 YAML frontmatter 的 UTF-8 markdown 文档，以
  `Content-Type: text/mako+markdown` 标识，符合 MAKO 规范。
- **MAKO 对（pair）** —— MAKO 文档加其可选的 AIFeed 签名容器（§7）。
- **页面 URL** —— MAKO 文档所代表页面的绝对 `https` URL，无 fragment 或 query，
  NFC 规范化。
- **mako_verified** —— 验证标志：MAKO 签名存在、格式正确且对 manifest 密钥与页面 URL
  有效。
- **YAML 安全子集** —— §6.5 的 frontmatter 语法。不接受完整 YAML。

v0.1 §2 的严格输入规则适用于所有 AIFeed 解析的 JSON，包括签名容器与 MAKO 索引。

---

## 3. 发现与文件布局（补充）

```
/.well-known/ai.json                Manifest (signed)              [v0.1]
/.well-known/ai-signature.json      Signature container            [v0.1]
/.well-known/mako                   MAKO site discovery (MAKO spec)[optional]
/.well-known/mako-index.json        MAKO delta index               [optional, §8]
{page-url}                          MAKO via content negotiation   [primary]
{page-url}.sig                      MAKO signature sidecar         [§7.2]
{path}.mako.md                      Static MAKO file               [fallback]
{path}.mako.md.sig                  Static signature sidecar       [§7.2]
```

感知 MAKO 的 AIFeed 客户端的发现顺序（规范性）：(1) manifest `content.mako`；
(2) `Link: <...>; rel="alternate"; type="text/mako+markdown"`；
(3) MAKO `/.well-known/mako`；(4) HTML `<link rel="alternate">` /
`<script type="text/mako+markdown">`。内容协商（MAKO §6.1）是主要访问方式；静态文件与
显式端点模式是无法协商的托管方式的等价回退（MAKO §6.3）。

---

## 4. Manifest v0.2（补充）

v0.2 manifest 就是 `version: "0.2"` 的 v0.1 manifest 加上下面的 `content.mako` 对象。
其他所有 v0.1 约束（大小、限额、严格性）不变。

### 4.1 `content.mako`

| 字段 | 类型 | 必需 | 默认 | 说明 |
|---|---|---|---|---|
| `index_url` | path | 否 | 无 | 增量索引位置（§8）；必须以 `/` 开头 |
| `signature` | enum | 否 | `optional` | `required` \| `optional` |
| `overrides` | enum | 否 | `restrict-only` | `restrict-only` \| `bidirectional`（§6.4） |
| `embedding` | boolean | 否 | `false` | 源站声明 CEF embedding 用途；embedding 仍不可信（MAKO §10.2） |

`content.mako` 的存在（可以为空对象）声明 MAKO 支持。缺失意味着未声明 MAKO；客户端
不得把该源站的 MAKO 文件解释为 AIFeed 信任配置的一部分。

### 4.2 语义

- `signature: "required"` 断言该源站提供的每个 MAKO 文档都携带有效的 AIFeed 签名。
  客户端若无法验证，必须拒绝高风险用途（`training`、`reproduce`、`modify`、
  `commercial_use` 与所有 `actions`），且该页在 MAKO 消费中不得视为 `VERIFIED`。
- `overrides` 控制逐页许可绑定（§6.4）。
- v0.1 §4.6 的限额同样适用于 MAKO 端点；经内容协商消费的 MAKO 与 HTML 页面消耗相同
  的抓取预算。

---

## 5. MAKO 兼容配置（规范性）

### 5.1 固定的 MAKO 行为

客户端必须遵循 MAKO 规范：内容协商（`Accept: text/mako+markdown`）、必需响应头
（`Content-Type`、`X-Mako-Version`、`X-Mako-Tokens`、`X-Mako-Type`、`X-Mako-Lang`、
`Vary: Accept`）、HEAD 预过滤、条件请求与静默回退 HTML（MAKO §6）。AIFeed 不重新定义
MAKO 语义；它只增加信任与许可层。

- 本文固定 `X-Mako-Version` 必须为 `1.0`；其他值，或 frontmatter `mako` 值不是
  `"1.0"`，产生错误 `mako_unsupported`，客户端回退到 HTML 规则消费内容。
- `mako` frontmatter 值必须按字符串处理；写入方可以省略引号（`mako: 1.0`），读取方
  必须把未加引号的数字字面量规范化为 `"1.0"`。
- 未知 MAKO frontmatter 键必须被忽略（MAKO 兼容性），**除** §6 定义的 `aifeed` 键，
  它遵循本文更严格的规则。
- CEF embeddings（`X-Mako-Embedding*`）视为不可信提示（MAKO §10.2）。

### 5.2 必需与禁止的响应头

对于 MAKO 响应，服务器必须包含 MAKO 必需响应头，并应当包含 `ETag` 与
`Cache-Control`。此外：

- MAKO 响应在 `401` 或 `403` 上不得包含 `X-Aifeed-Signature` 或
  `X-Aifeed-Signature-URL`（对应 MAKO §10.6，扩展到 AIFeed 响应头）。
- `Vary: Accept` 是必需的，以免缓存把 HTML 与 MAKO 表示混在一起。

### 5.3 静态与回退模式

当内容协商不可用时，发布方可以提供 `{path}.mako.md` 加上
`<link rel="alternate" type="text/mako+markdown" href="...">` 元素（MAKO §6.3）。
AIFeed 签名规则（§7）适用于实际提供的字节，与传输模式无关。

---

## 6. 许可绑定

### 6.1 `aifeed` frontmatter 块

MAKO 文档可以在 YAML frontmatter 中包含顶层 `aifeed` 映射：

```yaml
aifeed:
  policy_version: "0.2"
  usage:                 # optional; restrict-only overrides by default
    training: deny
    summarize: allow
  attribution: required  # required | optional | none
  limits:
    requests_per_minute: 10
  license:               # informational (RSL/payment discovery)
    rsl_url: https://example.com/rsl.xml
    price:
      amount: 250        # integer, minor units
      currency: USD
  assets:                # media and downloadable files (links only)
    - url: /uploads/sampul.webp
      type: image
      alt: "Foto sampul"
    - url: /media/demo.mp4
      type: video
      title: "Video demo"
    - url: /laporan.pdf
      type: document
      title: "Laporan lengkap"
```

`assets` 列出页面引用的媒体与可下载文件（图片、视频、音频、文档、压缩包，以及通常带
HTML `download` 属性的其他文件）。每个条目携带 `url`、`type`（`image`、`video`、
`audio`、`document`、`archive`、`file`）与可选的 `mime`、`title`、`alt`。该列表**仅是
引用**：资源绝不内联，获取它们受与页面内容相同的许可与限额约束，由客户端决定是否下载。
转换器还应当在 markdown 正文中保留内联引用（例如图片写作 `![alt](url)`），并应当输出
简短的 "Media & Unduhan" 式小节列出资源链接，以便不感知 AIFeed 的 MAKO 消费者也能找到
它们。

### 6.2 继承

有效许可按每个 usage 键计算为：

```
base(usage)     = manifest.permissions.usage[usage] if present
                  else manifest.permissions.default
page(usage)     = aifeed.usage[usage] if present else unset
effective       = resolve(base, page, manifest.content.mako.overrides)
```

### 6.3 `restrict-only`（默认）

在 `restrict-only` 下，页面值只能让政策**更严格**：

- `allow` → `deny` 被接受。
- `deny` → `allow` 被拒绝；客户端必须忽略它，并应当记录
  `permission_override_rejected`。
- 署名：`required` 比 `optional` 严格，`optional` 比 `none` 严格。
  放宽（如 `required` → `none`）被拒绝。
- 限额只能收紧：更低的 `requests_per_minute`/`concurrent`，更高的
  `crawl_delay_seconds`。放宽被拒绝。
- `license`：页面不得替换 manifest 许可证。仅当 manifest 未声明许可证时页面才可以
  添加；完全相同的许可证（忽略键顺序）被静默接受。任何其他替换都以
  `permission_override_rejected` 被拒绝，并适用 manifest 许可证。许可证永不改变
  `usage` 许可。理由：否则被攻陷或有缺陷的页面可以为源站从未授权的内容重新许可。

### 6.4 `bidirectional`

仅当 `content.mako.overrides` 显式为 `"bidirectional"` 时，页面才可以授予 manifest
拒绝的内容，或放宽署名/限额。即便如此，manifest 对撤销与信任级别仍具权威性。

### 6.5 YAML 安全子集（规范性）

由于 frontmatter 解析是新的攻击面，AIFeed v0.2 定义了严格子集。违反以下任何规则的
文档，解析器必须拒绝：

1. frontmatter 是首个 `---` 行与下一个 `---` 行之间的块；最大 32 KiB；UTF-8，要求
   NFC；无 BOM；仅 LF 或 CRLF 行尾。
2. 映射使用 2 空格缩进的块样式；序列使用 `- ` 条目。flow 集合（`{...}`、`[...]`）
   必须被拒绝。
3. 标量：仅纯量、单引号或双引号。字面量（`|`）与折叠（`>`）块标量必须被拒绝。
   空值/`~` 必须被拒绝。
4. 锚点（`&`）、别名（`*`）、标签（`!`）、指令（`%`）、多文档标记（`...`）与合并键
   （`<<`）必须被拒绝。
5. 重复键必须被拒绝。键必须匹配 `^[A-Za-z0-9_-]{1,64}$`。
6. 整数必须满足 `|n| <= 2^53 - 1`；浮点与指数记法必须被拒绝。布尔仅 `true`/`false`。
7. 最大嵌套深度 6；最大 512 个节点；最大标量长度 8 KiB。
8. 注释（`#` 到行尾）允许出现在带引号标量之外。
9. 除 LF/CR/TAB 外的控制字符必须被拒绝；TAB 不得用于缩进。
10. `aifeed` 块按 `schema/mako.v0.2.json` 校验；`aifeed` 内的未知字段必须被拒绝，除非
    以 `x_` 开头。

解析器不得使用通用 YAML 库的对象实例化特性（如 `!!python/object`）；必须使用确定性的
子集解析器。

---

## 7. AIFeed-Verified MAKO

### 7.1 签名容器（`mako-signature.v0.2.json`）

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

- **签名字节：** `UTF-8("aifeed.mako.v0.2\n") || ASCII(url) || 0x0A || raw bytes`，
  其中 `raw bytes` 是实际提供的 MAKO 文档字节（传输解码后），`url` 是规范页面 URL
  （小写主机，无 fragment/query）。URL 必须是绝对 `https` URL；实现**仅**在测试环境
  的回环主机（`127.0.0.1`、`[::1]`、`localhost`，可选端口）上可以接受 `http://` URL。
- **密钥：** 来自源站 manifest 的 Ed25519 密钥（`identity.public_key`）；
  `key_fingerprint` 必须匹配 `sha256:` + base64url(SHA-256(SPKI DER))。
- **`raw_digest`：** 对同一原始字节的 SHA-256（标准 base64）；它是传输完整性检查，
  不能替代签名（适用 v0.1 §5.1 规则）。
- 容器大小 ≤ 2 KB；适用严格 JSON 规则（v0.1 §2）。

### 7.2 投递（优先级）

1. **内联响应头（首选）。** `X-Aifeed-Signature: mako1:<base64url>`，载荷为
   `JCS(container)`。客户端解码后按 §7.1 验证。无需额外请求。
2. **声明的边车。** `X-Aifeed-Signature-URL: </path.sig>` 或
   `Link: </path.sig>; rel="aifeed-signature"`；客户端 GET 它（≤2 KB，允许条件 GET）。
3. **默认后缀。** 以上都不存在时，客户端可以尝试默认：MAKO URL + `.sig`（协商：
   `{page-url}.sig`；静态文件：`{file}.mako.md.sig`）。

声明 `signature: "required"` 的服务器应当使用 (1) 或 (2)。签名缺失 →
`mako_verified = false`；若 manifest 要求签名，必须拒绝高风险用途（§4.2），且客户端
应当提示 `mako_signature_missing`。

### 7.3 验证流程

```
INPUT : MAKO bytes B, page URL U, manifest M (VERIFIED), container C (optional)
1. Strict-parse C (≤2 KiB). If absent → mako_verified=false; stop.
2. C.context == "mako" and C.algorithm == "ed25519" → else fail.
3. C.url == U → else fail (replay across URLs).
4. C.key_fingerprint == fingerprint(M.identity.public_key) → else fail.
5. SHA-256(B) == C.raw_digest["sha-256"] → else fail (mako_digest_mismatch).
6. Ed25519 verify("aifeed.mako.v0.2\n" || U || LF || B, C.signature, M key) → else fail.
7. mako_verified = true
```

### 7.4 签名方要求

签名方必须校验 MAKO 文档（frontmatter 子集 + 必需 MAKO 字段）、只对自己提供的字节签名、
确认 `identity.public_key` 与签名密钥匹配，并在发布前自验证。签名方不得对向不同客户端
提供的不一致文档签名。

---

## 8. 增量消费（MAKO 索引）

### 8.1 索引文档（`mako-index.v0.2.json`）

```json
{
  "version": "0.2",
  "domain": "example.com",
  "site": {
    "name": "Example News",
    "description": "Independent daily news, technology and business desks.",
    "type": "news",
    "languages": ["en"],
    "license": "All Rights Reserved",
    "updated_at": "2026-09-15T08:00:00Z"
  },
  "generated_at": "2026-09-15T08:00:00Z",
  "page": 1,
  "page_count": 3,
  "entries": [
    {
      "url": "/product/123",
      "type": "product",
      "tokens": 280,
      "title": "Nike Air Max 90",
      "summary": "Casual running shoe, 79.99 EUR, in stock.",
      "tags": ["running", "shoes"],
      "lang": "en",
      "related": ["/product/adidas-ultraboost"],
      "updated": "2026-09-14T12:00:00Z",
      "etag": "\"mako-a1b2c3\"",
      "sha-256": "<43 chars + '='>"
    }
  ]
}
```

规则：`domain` 必须等于提供服务的 host **名**（URL hostname，不含端口）；每页条目 1–50 000；
文档解压后 ≤ 5 MB；分页通过 `Link: <...>; rel="next"`；服务器应当支持 `If-None-Match`，
可以支持 `?since=<RFC3339>`（当 `since` 不受支持时，客户端必须容忍完整的 `200` 响应）。
索引可以使用 §7.1 容器签名，`context: "mako-index"`，签名字节为
`UTF-8("aifeed.mako-index.v0.2\n") || ASCII(url) || 0x0A || raw bytes`。索引签名以
**边车**形式投递于 `{index-url}.sig`（默认），或通过 `X-Aifeed-Signature-URL` /
`Link: rel="aifeed-signature"`；它不得嵌入索引文档本身（自引用签名未定义）。

#### 站点摘要与分流字段（可选）

可选的 `site` 对象是站点级摘要：`name`、`description`（≤500 字符）、`type`（manifest
词汇表）、`languages`、`license` 与 `updated_at`。它让智能体在抓取任何页面之前了解该
源站发布什么。描述必须是公开信息（发布方展示给访客的同一文本）。

条目可以携带分流字段，让智能体**无需下载**就能决定抓取哪些页面：`title`（≤500）、
`summary`（≤160）、`tags`（≤10）、`lang` 与 `related`（≤20 个 URL 路径）。规则：

- 分流字段必须仅来源于已发布内容；草稿、私有页面与未发布元数据不得出现。
- 分流字段是**不可信提示**，与索引条目一样：客户端在使用前仍必须验证逐条 `sha-256`
  （以及存在时的索引签名）。
- 客户端应当用分流字段对条目排序与选择（例如在 token 或页面预算内按标题、标签与摘要
  相关性排序），然后应当只抓取选中的 MAKO 文档。

### 8.2 消费算法（规范性）

```
1. Fetch manifest (v0.1 §7). If content.mako absent → HTML rules only.
2. If index_url present: GET index (conditional). 304 → no change; done.
3. Rank and select entries using the site resume and triage fields (title, summary,
   tags, related) within the client's page/token budget. Selection is a client policy:
   the protocol only supplies the hints.
4. Diff the selected entries against the client's stored digests; keep changed/new URLs.
5. For each kept URL: GET with Accept: text/mako+markdown (+ If-None-Match).
6. Verify signature (§7.3) per manifest.content.mako.signature.
7. Compute effective permissions (§6.2) and enforce limits.
8. Store {url, digest, etag, updated} for the next cycle.
```

索引条目是**不可信声明**：客户端在使用前必须对抓取到的 MAKO 字节验证逐条 `sha-256`，
且不得把索引当作许可或真实性的证明。

---

## 9. 验证流程 v0.2（对 v0.1 §7 的修订）

1. v0.1 §7 的第 1–4 步不变，但有两处补充：严格解析后，MANIFEST schema 的选择由版本
   驱动（本文 §1.3）；且 v0.2 manifest 必须额外满足 `schema/ai-json.v0.2.json`。
2. v0.1 §7 第 5 步由 §1.4 的版本接受规则取代。
3. v0.1 §7 第 9 步使用 §1.3 的依赖版本域分离。
4. 第 15 步之后，若存在 `content.mako` 且客户端打算消费 MAKO，运行 §5–§8 的 MAKO
   子流程。结果新增标志：`mako_verified`、`mako_signature_present`，以及警告
   （`mako_unsupported`、`mako_signature_missing`、`mako_digest_mismatch`、
   `permission_override_rejected`、`mako_stale`）。
5. 高风险用途要求 `level = VERIFIED`、`dns_anchored = true`，以及——当
   `content.mako.signature == "required"` 时——`mako_verified = true`（v0.1 §8 扩展到
   MAKO）。
6. 若 `content.mako.signature == "required"` 且 `mako_verified = false`，MAKO 内容
   必须以 UNVERIFIED 语义处理（仅 search/retrieval/input，保守限额，署名）。

### 9.1 MAKO 错误码（规范性子集）

一致性向量对确切错误码具有权威性；实现必须使用这些错误码以保证互操作性：

| 组 | 错误码 |
|---|---|
| Frontmatter | `mako_frontmatter_missing`, `mako_frontmatter_invalid`, `mako_unsupported`, `frontmatter_missing`, `frontmatter_too_large`, `bom_forbidden`, `invalid_utf8`, `not_nfc`, `duplicate_key`, `float_not_allowed`, `integer_out_of_range`, `scalar_too_long`, `node_limit_exceeded` |
| YAML 子集 | `yaml_anchor_forbidden`, `yaml_alias_forbidden`, `yaml_tag_forbidden`, `yaml_directive_forbidden`, `yaml_block_scalar_forbidden`, `yaml_flow_forbidden`, `yaml_merge_forbidden`, `yaml_null_forbidden`, `yaml_tab_indent`, `yaml_indent_invalid`, `yaml_max_depth`, `yaml_key_invalid`, `yaml_parse_error`, `yaml_empty_value`, `yaml_control_char`, `yaml_inline_mapping_forbidden`, `yaml_document_marker_forbidden` |
| 许可绑定 | `aifeed_invalid`, `aifeed_unknown_field`, `permission_override_rejected`（警告） |
| 签名 | `mako_container_malformed`, `mako_context_invalid`, `mako_url_mismatch`, `mako_url_invalid`, `mako_manifest_key_invalid`, `mako_key_mismatch`, `mako_digest_mismatch`, `mako_bad_signature`, `mako_signature_missing` |
| 索引 | `mako_index_malformed`, `mako_index_invalid`, `mako_index_domain_mismatch`, `mako_index_digest_mismatch` |
| 新鲜度 | `mako_stale`（警告） |

---

## 10. 信任级别与一致性

### 10.1 信任级别（v0.1 §8 扩展）

| 级别 | MAKO 补充 |
|---|---|
| VERIFIED | manifest 检查通过；`mako_verified` 单独报告 |
| UNVERIFIED | 同 v0.1；MAKO 内容：仅声明性，拒绝高风险 |
| SUSPENDED | 同 v0.1；缓存的 MAKO 文档随缓存内容一起清除 |

### 10.2 AIFeed v0.2 一致性级别

| 级别 | 要求 |
|---|---|
| `AIFeed-C1` | v0.1 客户端 + 校验 v0.2 manifest（schema） |
| `AIFeed-C2` | C1 + 通过内容协商消费 MAKO + restrict-only 许可绑定（§6） |
| `AIFeed-C3` | C2 + 验证 AIFeed MAKO 签名（所有投递模式，§7）+ 降级处理（§9.6） |
| `AIFeed-C4` | C3 + 增量索引消费（§8）+ 撤销 + 带 `mako/` 快照的离线包 |

离线包（v0.1 附录 B）可以包含 `mako/` 目录，存放原始 MAKO 字节、签名容器与抓取元数据；
`BUNDLE-MANIFEST.json` 列出每个文件的 SHA-256 与大小。

---

## 11. 安全考虑（补充）

- **YAML 攻击。** 锚点/别名/标签与混合类型被安全子集拒绝（§6.5）；实现必须在分配内存
  之前执行深度、节点与大小上限。
- **签名剥离 / 降级。** 按 manifest 政策要求签名的客户端，把缺失签名视为高风险拒绝
  （§9.6）。之后把 `signature` 设为 `"optional"` 的源站运营者，无法重放过往签名文件来
  绕过新许可，因为许可来自 manifest 而非 MAKO 文件。
- **跨 URL 重放。** 签名绑定页面 URL（§7.1）；`/a` 的有效签名 MAKO 必须在 `/b` 上被
  拒绝。
- **索引投毒。** 索引条目是不可信声明；逐条摘要要对抓取到的字节验证（§8.2 第 7 步）。
  签名的索引是可选的，增加的是归属，不是真相。
- **伪装（Cloaking）。** AIFeed 签名证明 MAKO 字节来自域名密钥；它不证明与 HTML 渲染
  的忠实度。客户端应当尽可能交叉检查 `updated` / `Last-Modified`，对敏感用途可以对
  MAKO 与 HTML 做差异比较。
- **元数据泄漏。** `X-Aifeed-Signature*` 响应头不得出现在 `401`/`403` 上（对应
  MAKO §10.6）。
- **Embeddings。** CEF embeddings 仍是不可信的发布方提示；绝不要把它们作为唯一的相关性
  或排序输入（MAKO §10.2）。
- **新鲜度。** 内容协商的 MAKO 比内嵌 `<script>` 内容更新（MAKO §6.4）；客户端应当
  优先协商并遵守 `ETag` 语义。

---

## 12. IANA 考虑（补充）

本文未定义新的 well-known URI。`X-Aifeed-Signature` 与 `X-Aifeed-Signature-URL` 是
实验性响应头；运行无需注册，可与 `ai-feed` 链接关系一并推进（v0.1 §12）。
`text/mako+markdown` 媒体类型由 MAKO 定义，而非本文档。

---

## 13. 参考资料（补充）

- MAKO Specification v0.1.0（Draft，2026-02-18）与 MAKO HTTP Headers Reference——
  `github.com/juanisidoro/mako-spec`
- RFC 3339、RFC 8032、RFC 8785、RFC 9530（同 v0.1 §13）
- MAKO §6（内容协商）、§7（响应头）、§9（一致性）、§10（安全）

---

## 14. 密钥轮换

每个签名密钥都有生命周期。这一可选仪式在不破坏验证的前提下替换 manifest 签名密钥，
并修订 v0.1 §6（DNS 锚点）与 §7（验证）。从不轮换的 manifest 不受影响。

### 14.1 `rotation` 指令

`rotation` 是可选的顶层对象，仅对 `version: "0.2"` manifest 有效。它恰好携带
`successor_fp`（公告，由当前密钥签名）或 `predecessor_fp`（切换，由新密钥签名）之一：

| 字段 | 与谁搭配 | 规则 |
|---|---|---|
| `successor_fp` | 公告 | 后继密钥的 `sha256:` 指纹 |
| `effective_at` | `successor_fp` | 切换时刻（UTC，RFC 3339） |
| `grace_until` | `successor_fp` | 旧密钥截止；必须比 `effective_at` 至少晚 1 小时（建议 ≥ 2 ×（DNS TTL + 24 小时）） |
| `predecessor_fp` | 切换 | 退役密钥的指纹 |
| `supersedes_at` | `predecessor_fp` | 不得超过 `signed_at` + 300 秒 |

任何其他组合、缺失字段或格式错误的时间戳 → `rotation_invalid`。

### 14.2 DNS `pk2`（建议性，修订 v0.1 §6）

重叠期内 TXT 记录应当携带后继密钥：

```
_aifeed.example. 3600 IN TXT "v=aifeed1; pk=<old>; pk2=<new>; effective_at=<ts>; manifest=https://example/.well-known/ai.json"
```

`pk` 必须匹配所提供 manifest 的密钥（既有规则）。`pk2` 是建议性交叉校验：缺失、不匹配
或未经公布的 `pk2` 产生警告 `rotation_anchor_unverified`，绝不拒绝——信任锚点是旧密钥
对指令的签名，因此单独伪造 `pk2` 不会改变任何东西。高风险客户端可以把该警告当作错误。

### 14.3 阶段

- `announced` —— `now` < `effective_at`：旧密钥完全被接受。
- `grace` —— `effective_at` ≤ `now` < `grace_until`：被接受并带警告
  `grace_accepted`。
- `completed` —— `now` ≥ `grace_until`：被拒绝（`rotation_denied`），除非密钥被撤销
  （`key_revoked`）。

从不切换的发布方配置有误：`grace_until` 之后，它自己的 manifest 都会被拒绝。应重新
签发，而不是悄悄延长。

### 14.4 验证（修订 v0.1 §7）

1. 指令规则（§14.1）在 manifest 验证内运行。
2. DNS 交叉校验（§14.2）在 DNS 可用处运行；离线验证器仅依据指令报告状态。
3. 持久化密钥固定记录的客户端不得接受被固定密钥未公布、也未通过 `predecessor_fp` 绑定
   的变更（`rotation_denied`）；错过公告的休眠固定记录，当 `predecessor_fp` 与其匹配时
   可以重新固定（警告 `rotation_resync`）。SDK 辅助函数：
   `rotation.evaluateContinuity`。
4. 若签名密钥指纹出现在有效撤销文档的 `keys[]` 中 → `key_revoked`（错误）。撤销优先于
   grace。

### 14.5 紧急轮换

怀疑密钥泄露并不意味着立即撤销——那会打开中断窗口。使用
`aifeed rotate --accelerated`（压缩窗口，例如 6 小时），立即切换，然后发布旧指纹。这
不消除风险，而是限定风险：可能已泄露的密钥最多在窗口长度内仍被接受。轮换保护密钥，
不保护源站；病态的 DNS TTL 与 HSM/KMS 存储不在范围内。完整操作手册见
`docs/rotation.md`。

### 14.6 错误码

| 错误码 | 类型 | 含义 |
|---|---|---|
| `rotation_invalid` | error | 指令格式错误或不一致（包括窗口 < 1 小时） |
| `rotation_anchor_unverified` | warning | DNS `pk2` 缺失、不匹配或未经公布（建议性） |
| `grace_accepted` | warning | 旧密钥签名在 grace 窗口内被接受 |
| `rotation_denied` | error | 退役密钥已过 grace、未经公布的变更或回滚 |
| `rotation_resync` | warning | 休眠固定记录通过 `predecessor_fp` 重新固定 |
| `key_revoked` | error | 签名密钥指纹列于有效撤销文档（v0.1 §7 第 14 步） |

---

## 附录 A —— MAKO 兼容与固定

| MAKO 元素 | AIFeed v0.2 立场 |
|---|---|
| 协议版本 `"1.0"` | 要求精确匹配；其他不支持 |
| 规范文档 v0.1.0 草案 | 已固定；跟踪其变化 |
| 必需 frontmatter 字段 | 已校验（`mako`、`type`、`entity`、`updated`、`tokens`、`language`） |
| 可选字段 | 透传；`aifeed` 按 §6 处理 |
| CEF embeddings | 不可信、可选，`embedding` 标志仅供参考 |
| `/.well-known/mako` | 可选发现信号；manifest 仍是权威 |
| MAKO 1–3 级 | 与 AIFeed 级别（`AIFeed-C1..C4`）相互独立 |

若 MAKO 改变规范性行为（响应头、协商、必需 frontmatter），本文档以新的附录条目修订；
MAKO 的破坏性变更触发 AIFeed 次版本提升。AIFeed 扩展字段必须限于 `aifeed` frontmatter
键与 `X-Aifeed-*` 响应头，以避免冲突。

---

## 附录 B —— YAML 安全 Frontmatter 语法（信息性摘要）

```
document      = "---" LF *(line) "---" LF
line          = mapping | sequence-item | comment | blank
mapping       = indent key ":" [ " " scalar ] LF
sequence-item = indent "- " (scalar | nested) LF
scalar        = plain | "'" *(char) "'" | '"' *(char) '"'
key           = 1*64( ALPHA / DIGIT / "_" / "-" )
indent        = 2 spaces per level, maximum 6 levels
```

被拒绝的构造：锚点、别名、标签、合并键、指令、flow 集合、块标量、空值、浮点、多文档
标记、用于缩进的制表符。

---

## 附录 C —— 双方收益（效率、安全、法律）

证据标签：**[F]** 已验证事实，**[M]** 可信但需测量，**[E]** 模型估计，
**[S]** 在本地模拟装置中测量（回环、可复现），**[H]** 需法律审查。

| 维度 | Web 所有者 | AI 侧 |
|---|---|---|
| **效率** | 在执行装置中实测：S3 下**字节 −55.2%、源站 CPU −56.2%**，源站峰值并发 **−88.2%** **[S]**；55–80% 仍是边缘/CDN 部署模型的区间 **[E]**；通过 `304` 与索引差异卸载 CDN **[M]** | 实测：全部配置**字节 −54.8%**，合规客户端 **−72.9%**；通过增量**跳过 14/18 未变更页面**；验证 **0.70 ms/页** **[S]**；每页 token 约减少 90%+（MAKO 宣称 −94%）**[M]**；HEAD 预过滤不下载正文 **[F]**；无 JS 渲染 **[F]** |
| **安全** | 签名许可 + DNS 锚点：声明无法被伪造或静默篡改 **[F]**；撤销可归属 **[F]**；通过对比 HTML 与 MAKO 使伪装可检测 **[M]** | 所消费 MAKO 的来源可验证；跨 URL 重放、摘要不匹配与降级均可检测 **[F]**；embedding 视为不可信 **[F]**；签名垃圾可归属 **[M]** |
| **法律** | 机器可读的权利保留（契合 TDM 选择退出制度，如欧盟 DSM 第 4(3) 条）**[H]**；通过 RSL/定价实现逐页许可 **[H]**；不可否认的审计轨迹 **[M]** | 有据可查的善意合规与许可接收记录；逐页确定性降低风险暴露 **[H]**；执行仍是关键门槛 **[F]** |

明确的非主张：签名不是合同；MAKO 本身不是许可证；效率数字在基准轨道（§ Fase 5）发布
测量之前属于模型估计；本文不构成法律意见。

---

## 附录 D —— 攻击场景（对 v0.1 附录 C 的补充）

| # | 场景 | 拦截层 | 结果 |
|---|---|---|---|
| 13 | MAKO 签名在传输中被剥离 | Manifest `signature: required` 政策 | 高风险用途被拒绝（`mako_signature_missing`） |
| 14 | 已签名 MAKO 被重放到另一 URL | 签名字节中的 URL 绑定 | `mako_verified=false` |
| 15 | 版本回滚到更旧的 v0.1 manifest | 防回滚 `signed_at`（v0.1） | `UNVERIFIED` |
| 16 | 被投毒的索引条目指向攻击者字节 | 逐条 SHA-256 + 签名验证 | 条目被拒绝 |
| 17 | frontmatter 中的 YAML 炸弹 / 别名展开 | 安全子集上限（§6.5） | 文档被拒绝 |
| 18 | 页面覆盖试图允许被拒绝的 training | `restrict-only` 解析 | 覆盖被忽略（+警告） |
| 19 | HTML 已变但仍提供过期 MAKO | `updated`/`Last-Modified` 交叉检查（尽力而为） | `mako_stale` 警告 |
| 20 | 认证失败响应泄漏 MAKO 元数据 | §5.2 不泄漏规则 | 响应头被省略 |
| 21 | DNS 中伪造 `pk2` 且没有匹配的 manifest 指令 | 指令签名是锚点；`pk2` 为建议性（§14.2） | 警告 `rotation_anchor_unverified` |
| 22 | 已过 grace 的过期旧密钥 manifest | 指令窗口（§14.3） | `rotation_denied` |
| 23 | 注册表公布后仍出现旧密钥内容 | 撤销 `keys[]` 匹配（§14.4） | `UNVERIFIED(key_revoked)` |
| 24 | 切换后回滚到退役密钥 | 固定记录连续性（§14.4） | `rotation_denied` |

---

## 附录 E —— 变更日志 v0.1 → v0.2

1. 新增 `content.mako` manifest 对象（索引、签名政策、覆盖、embedding）。
2. 依赖版本的 manifest 域分离（`aifeed.v0.2\n`）。
3. MAKO 兼容配置，固定 MAKO 协议 `1.0`（规范文档 v0.1.0）。
4. AIFeed-Verified MAKO：分离签名容器、投递优先级、验证。
5. 许可绑定：`aifeed` frontmatter 块、默认 restrict-only、YAML 安全子集。
6. 增量消费：带逐条摘要的分页 MAKO 索引。
7. 一致性级别 `AIFeed-C1..C4`；面向 MAKO 的扩展信任级别行为。
8. 安全补充（YAML、降级、重放、索引投毒、响应头泄漏）。
9. 双方收益附录与 MAKO 兼容/固定附录。
10. 密钥轮换：`rotation` 指令、建议性 DNS `pk2` 交叉校验、重叠与 grace 阶段、
    固定记录连续性、撤销优先。
