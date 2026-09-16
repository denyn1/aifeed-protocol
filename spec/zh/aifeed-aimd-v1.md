# AIFeed Markdown v1.0（原生内容配置）

<p><a href="../en/aifeed-aimd-v1.md">English</a> · <a href="../id/aifeed-aimd-v1.md">Bahasa Indonesia</a> · <a href="aifeed-aimd-v1.md">中文</a></p>

**线标识：** `aimd`（媒体类型 `text/aifeed+markdown`，签名上下文 `aimd`/`aimd-index`，CLI 命令 `aifeed aimd`）。

**版本：** 1.0（协议），AIFeed 规范 v0.2
**状态：** 草案——尚未冻结
**正本语言：** 英文（本文档）。译文仅供参考。
**许可证：** CC BY 4.0（本文档）· MIT（参考实现）
**媒体类型：** `text/aifeed+markdown` · **文件扩展名：** `.aifeed.md`

---

## 摘要

AIFeed Markdown 是 AIFeed 的原生内容配置：一种逐页 markdown 文档，其 frontmatter 将
AIFeed 政策块作为一等公民携带。之所以在此单独规定，是为了让 AIFeed 不依赖任何单一外部
内容格式，同时保持**双栈**：同一源站也可以提供 MAKO（`text/mako+markdown`）文档，
同一份签名字节可以同时满足两种配置。

AIFeed Markdown 复用 AIFeed v0.2 规范（`spec/en/aifeed-v0.2.md`）中定义的验证、许可、
资源、分流与增量机制，并扩展 manifest 的 `content.profile` 与 `content.index_url`。

---

## 1. 与 AIFeed v0.2 和 MAKO 的关系

1. 本文档是 AIFeed v0.2 的**内容配置**。v0.2 各章节仍具规范性，除非本文另有修订。
2. MAKO 仍是**兼容配置**：AIFeed 实现必须接受所声明的 MAKO 文档，并可以提供它们。
3. manifest 保持 `version: "0.2"`，并声明所服务的配置：

   | `content.profile` | 含义 |
   |---|---|
   | `mako` | 仅 MAKO 文档（v0.2 传统行为） |
   | `aifeed-md` | 仅 AIFeed Markdown 文档 |
   | `both` | 同一字节在两种媒体类型下提供（双标记） |

   `content.index_url` 声明规范增量索引路径
   （AIFeed Markdown 默认：`/.well-known/aifeed-index.json`；MAKO 默认：
   `/.well-known/mako-index.json`）。两者都发布时，`content.mako.index_url`
   仍指向 MAKO 路径。

---

## 2. 文档格式

AIFeed Markdown 文档是带 YAML 子集 frontmatter 的 UTF-8 markdown（v0.2 §6.5 的安全子集
原样适用）。

```markdown
---
aimd: "1.0"
mako: "1.0"          # optional; marks MAKO compatibility
type: article
entity: "Panduan AIFeed Markdown"
updated: 2026-09-15
tokens: 420
language: id
canonical: https://example.com/artikel/aimd
summary: "Dokumen native AIFeed."
aifeed:
  policy_version: "0.2"
  usage:
    training: deny
  attribution: required
  assets:
    - url: /laporan.pdf
      type: document
      title: "Laporan lengkap"
---

# Panduan AIFeed Markdown

Isi halaman sebenarnya, dikonversi jujur ke markdown.
```

规则：

- `aimd: "1.0"` 是必需的，用于标识该文档为 AIFeed Markdown。
- `mako: "1.0"` 是可选的；存在时该文档也可以以 `text/mako+markdown` 提供，并使用 MAKO
  上下文的签名（字节不变）。
- 必需字段：`type`、`entity`、`updated`、`tokens`、`language`（与 MAKO 相同的词汇表）。
  `tokens` 最大接受 1,000,000。
- `aifeed` 政策块是**一等公民**：`policy_version`（`"0.2"`）、`usage`、`attribution`、
  `limits`、`license` 与 `assets` 遵循 v0.2 §6 语义，包括仅收紧的许可绑定。
- 未知顶层键必须被忽略，除非它们以 `x_` 开头（扩展）或与已定义字段冲突；`aifeed` 块是
  严格的。
- 正文长度：AIFeed Markdown 不强制 MAKO 的 1,000 token 上限。参考工具默认 4,000 token，
  发布方可以选择更低值；转换器在截断时必须发出警告。

### 2.1 资源

与 v0.2 相同：`aifeed.assets` 以引用链接形式列出媒体与可下载文件
（image、video、audio、document、archive、file）；获取它们遵循与页面内容相同的许可与限额。

### 2.2 可选文档字段

AIFeed Markdown 继承 MAKO 兼容的可选字段，以便转换器无损往返内容：

| 字段 | 含义 |
|---|---|
| `canonical` | 页面的规范 `https` URL（ASCII/IDNA A-label 主机；见 §3） |
| `summary` | 简短描述（≤300 字符）；索引分流摘要上限为 160 |
| `tags` | 内容标签（≤50） |
| `related` | 相关页面路径（≤100） |
| `links.internal` / `links.external` | 带上下文的语义链接 |
| `actions` | 声明的动作（name、description、endpoint、method、params） |
| `audience` | 目标受众提示 |
| `freshness` | `realtime` \| `hourly` \| `daily` \| `weekly` \| `monthly` \| `static` |
| `media` | `cover {url, alt}` 以及 images/video/audio/interactive/downloads 的计数 |
| `alternates` | 本页译文：`{ url, lang }` 数组（≤20） |

`alternates` 是 AIFeed Markdown 特有的（不属于 MAKO）：它让全球化网站声明同一内容的
其他语言版本，使智能体可以直接抓取正确的语言环境，而无需重新发现。发布方应当让
`language` 保持为文档自身的语言环境，并将 `alternates` 限制为已发布的译文。

上述所有字段都严格校验：类型错误、越界值、对象内的未知键（例如 `alternates` 项中多出的
`price`）、重复的动作名以及超长数组都会以 `aimd_frontmatter_invalid` 被拒绝。

---

## 3. 媒体类型与协商

- 智能体使用 `Accept: text/aifeed+markdown` 请求 AIFeed Markdown。
- 服务器在提供 AIFeed Markdown 时必须返回
  `Content-Type: text/aifeed+markdown; charset=utf-8`，并且必须包含 `Vary: Accept`。
- AIFeed Markdown 响应复用 MAKO 响应头集合以保证互操作性
  （`X-Mako-Version`、`X-Mako-Tokens`、`X-Mako-Type`、`X-Mako-Lang`），并新增
  `X-Aifeed-Profile: aimd|mako`。
- 双栈源站的发现顺序：(1) AIFeed Markdown，(2) MAKO，(3) HTML 回退。
- HTML 页面应当同时声明：
  `<link rel="alternate" type="text/aifeed+markdown" href="...">` 与
  `<link rel="alternate" type="text/mako+markdown" href="...">`。
- HEAD 请求应当返回响应头而不带正文（与 MAKO §6.2 相同规则）。

> **国际化 URL。** 用于发现、签名与 `alternates` 的规范页面 URL 必须是带 ASCII 主机的
> 绝对 `https` URL：国际化域名必须编码为 IDNA2008 A-label（punycode，例如
> `xn--tko-7qa.example`）。路径部分遵循常规百分号编码。这样可让签名字节在不同语言环境
> 与规范化器之间保持确定性。

### 3.1 双栈运行模式

实现可以运行于两种模式之一：

| 模式 | manifest | 共享字节 | Token 预算 |
|---|---|---|---|
| **AIFeed Markdown-only** | `content.profile: "aifeed-md"` | 仅 AIFeed Markdown | AIFeed Markdown 上限（参考默认 4,000；schema 最大 1,000,000） |
| **双栈** | `content.profile: "both"` | 一份正文服务两种媒体类型 | 共享正文应当遵循 MAKO 建议（默认 1,000 token） |

双栈保持"一份签名正文、两种配置"的保证，包括每页只有一个增量索引摘要。实现可以从同一
URL 以两种媒体类型提供该正文（内容协商），也可以提供字节完全相同的按配置文件
（`{path}.aifeed.md` 与 `{path}.mako.md`，各自带 `.sig` 边车与匹配的签名上下文）；
两种布局必须满足相同的一致性要求。需要更长正文但仍希望 MAKO 兼容的发布方应当发布单独
的页面/端点，而不是让共享正文分叉；实现不得在提供超出 MAKO 建议的正文时声称 `both`。

---

## 4. 签名

AIFeed Markdown 复用 v0.2 签名容器（`schema/mako-signature.v0.2.json`），使用新的上下文
与分隔串：

| 文档 | 上下文 | 签名字节 |
|---|---|---|
| AIFeed Markdown 页面 | `aimd` | `UTF-8("aifeed.aimd.v1\n") \|\| url \|\| 0x0A \|\| raw bytes` |
| AIFeed Markdown 索引 | `aimd-index` | `UTF-8("aifeed.aimd-index.v1\n") \|\| url \|\| 0x0A \|\| raw bytes` |

- 投递优先级与 v0.2 §7.2 相同；AIFeed Markdown 内联响应头使用
  `aimd1:<base64url(JCS(container))>` 前缀（MAKO 仍使用 `mako1:`）。
- 上下文与分隔串彼此不同：MAKO 签名不得验证为 AIFeed Markdown，反之亦然
  （跨格式重放保护）。
- 边车（`{url}.sig`）与声明的签名 URL 行为与 v0.2 相同。

---

## 5. 许可、限额与信任

- 有效许可的计算与 v0.2 §6.2 完全一致，默认覆盖模式为 `restrict-only`。
- manifest 的 `content.index_url` 标识增量索引；索引 schema、分流字段
  （`title`、`summary`、`tags`、`lang`、`related`）与 `site` 摘要在 v0.2 §8 中保持不变。
- 信任级别与降级行为按 v0.2 §9 适用。当
  `content.mako.signature == "required"` 时，双栈源站必须为两种媒体类型都签名；
  缺少 AIFeed Markdown 签名会以同样方式降低 MAKO 消费等级。

---

## 6. 一致性级别

| 级别 | 要求 |
|---|---|
| `AIMD-C1` | 解析并校验 AIFeed Markdown 文档（frontmatter + 政策块） |
| `AIMD-C2` | 通过 `text/aifeed+markdown` 及必需响应头提供/消费 AIFeed Markdown |
| `AIMD-C3` | 验证 `aimd` / `aimd-index` 签名并拒绝跨上下文重放 |
| `AIMD-C4` | 基于 AIFeed Markdown 的增量索引 + 分流 + 撤销 + 离线包 |

一致性双栈实现还应当对 MAKO 文档满足 `AIMD-C3`（v0.2 一致性）。

---

## 7. 安全考虑

- v0.2 的 YAML 安全子集、大小上限与严格解析规则原样适用。
- 分隔串彼此独立，防止签名在不同配置间被复用，即使字节完全相同。
- 双标记不会削弱验证：每种媒体类型都携带其自身上下文的签名容器。
- `aifeed` 块本身不是许可证；许可引用遵循 v0.2。

---

## 8. 参考资料

- AIFeed v0.2（`spec/en/aifeed-v0.2.md`）：信任层、MAKO 配置、索引、资源、分流、安全。
- MAKO Specification v0.1.0（草案）：兼容配置。
- RFC 2119/8174、RFC 8032、RFC 8785、RFC 9530。
- 参考实现：`aifeed-protocol`（CLI `mako generate --format aimd`、
  `verifyAimdDocument`、`verifyAimdIndex`），WordPress 插件 `1.0.0-draft`。

---

## 9. IANA 考虑

本文档定义了媒体类型 `text/aifeed+markdown` 与约定文件扩展名 `.aifeed.md`。向 IANA 注册
该媒体类型已有计划（RFC 6838，Specification Required）。在注册完成之前，服务器在线上仍
必须发出 `Content-Type: text/aifeed+markdown`；未识别的类型按 §3 安全降级为 HTML 回退。
`aifeed` frontmatter 键与 `X-Aifeed-*` 响应头为实验性，可与 `ai-feed` 链接关系
（v0.2 §12）一并注册。
