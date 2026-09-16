# AIFeed v0.1 — 面向 AI-Web 内容的签名声明

<p><a href="../en/aifeed-v0.1.md">English</a> · <a href="../id/aifeed-v0.1.md">Bahasa Indonesia</a> · <a href="aifeed-v0.1.md">中文</a></p>

**版本：** 0.1.0-rc1  
**状态：** 候选发布版——尚未冻结（见"本文档状态"）  
**正本语言：** 英文（本文档）。译文仅供参考。  
**许可证：** CC BY 4.0（本文档）· MIT（参考实现）

---

## 摘要

AIFeed 定义了 Web 源站如何以机器可读且可密码学验证的方式，声明自动化 AI 系统可以对其
内容做什么。该声明是位于 `/.well-known/ai.json` 的 JSON manifest，使用 Ed25519 签名、
通过 DNS TXT 记录锚定，并受基于注册表的撤销机制约束。

AIFeed 是信任层：它不取代 `robots.txt`、IETF AIPREF 词汇表、RSL 许可条款、W3C TDMRep
或 `llms.txt`。它让声明可归属到某个域名，并且可撤销。

---

## 本文档状态

这是面向参考实现与互操作性测试的候选发布版。规范**尚未冻结**；在 v0.1.0 正式版之前允许
变更。v0.1.0 之后，破坏性变更需要提升次版本号（v0.2）。关键词 MUST、MUST NOT、SHOULD、
SHOULD NOT 与 MAY 按 BCP 14（RFC 2119、RFC 8174）解释。

---

## 1. 引言

搜索爬虫历史上以内容换取引荐流量。AI 系统消费内容，却往往不回送流量。实测的爬取与引荐
比（Cloudflare Radar，2025）与 robots.txt 违规量（TollBit，2026 上半年）表明：仅靠纯文本
偏好常常被无视，且无法可靠地归属到某个域名。

AIFeed 解决四个缺口：

1. **归属。** 签名 manifest 证明声明来自域名密钥持有者，而非网络中间人或被攻陷的路径。
2. **锚定。** DNS TXT 记录把签名密钥绑定到域名本身。
3. **撤销。** 注册表按正当程序发布签名撤销文档。
4. **离线验证。** 签名与 schema 检查无需网络往返。

---

## 2. 约定与术语

- **Manifest（清单）** —— 位于 `/.well-known/ai.json` 的 JSON 文档。
- **签名容器** —— 位于 `identity.signature_url` 的 JSON 文档。
- **源站（Origin）** —— scheme + host（本版本仅 `https` 与默认端口）。
- **发布方（Publisher）** —— 控制该源站及其签名密钥的一方。
- **客户端（Client）** —— 验证并消费 manifest 的自动化 AI 系统。
- **dns_anchored** —— 验证标志：manifest 公钥与 DNS 记录匹配。
- **Level（级别）** —— `VERIFIED`、`UNVERIFIED`、`SUSPENDED` 之一。

客户端处理不可信输入时的规范性行为：

- 重复的 JSON 对象键必须被拒绝。
- 所有字符串必须是 NFC 规范化的 UTF-8；非 NFC 输入必须被拒绝。
- manifest 中任何位置的浮点数都必须被拒绝。
- 整数必须满足 `|n| <= 2^53 - 1`；更大的值必须以字符串编码。
- 指数记法的数字必须在同一界限内解析；无论记法如何，越界值必须被拒绝。
- 负零（`-0`）必须由解析器与序列化器规范化为 `0`。
- JSON 嵌套深度不得超过 10。
- 本规范未定义的字段名必须被拒绝，除非以 `x_` 开头；以 `x_` 开头的字段必须被忽略。

---

## 3. 发现与文件布局

```
/.well-known/ai.json            Manifest (signed)
/.well-known/ai-signature.json  Default location of the signature container
/.well-known/ai.txt             Human-readable notes (NON-NORMATIVE, MUST NOT be parsed)
/llms.txt                       Content summary for LLMs (see llms.txt v2)
```

### 3.1 声明与发现

源站应当在每个响应上声明 manifest 位置，以便支持 AIFeed 的客户端在首次接触时就能发现它：

- HTTP：`Link: </.well-known/ai.json>; rel="ai-feed"; type="application/json"`
- HTML：`<link rel="ai-feed" href="/.well-known/ai.json" type="application/json">`
- `robots.txt`：注释行 `# AIFeed: <absolute manifest URL>`（不感知 AI 的解析器会忽略，
  感知 AIFeed 的解析器可见）
- `llms.txt`（v2）：指向 manifest 的链接条目

支持 AIFeed 的客户端的发现顺序（规范性）：(1) 带 `rel="ai-feed"` 的 `Link` 头；
(2) HTML `<link rel="ai-feed">`；(3) `robots.txt` 提示；(4) 回退到
`/.well-known/ai.json`。客户端必须在依据任何声明行动之前完成验证（§7）与缓存
（最长 1 小时）。

Manifest 是**按源站**的。`www.example` 与 `example` 是不同的源站；希望两者都覆盖的源站
必须在两者上分别提供 manifest。

服务器应当返回 `Content-Type: application/json`、UTF-8 与
`Cache-Control: public, max-age=3600, must-revalidate`，并应当支持 `ETag` 与条件请求
（`If-None-Match` → `304`）。大小限制适用于解压后的正文：manifest ≤ 100 KB，
签名容器 ≤ 2 KB，`ai.txt` ≤ 50 KB。

---

## 4. Manifest（`ai.json`）

manifest 是 JSON 对象。JSON Schema 发布于
`https://aifeed.md/schema/ai-json/v0.1.json`，对字段形状具有规范性。

### 4.1 必需的顶层字段

`version`、`identity`、`validity`、`content`、`permissions`、`revocation`、`metadata`。

### 4.2 `identity`

| 字段 | 必需 | 说明 |
|---|---|---|
| `domain` | 是 | 仅主机名，小写，A-label（IDNA2008）形式；必须等于提供服务的 host |
| `name` | 是 | 显示名称（≤ 256 字符） |
| `organization` | 否 | 法律实体 |
| `type` | 是 | `ecommerce, news, education, government, saas, portfolio, community, docs, nonprofit, personal, other` 之一 |
| `locale` | 是 | BCP 47（如 `id-ID`） |
| `contact` | 是 | `mailto:` 或 `https://` URI |
| `public_key` | 是 | `ed25519:` + base64 SPKI DER（44 字节 → 60 个 base64 字符，一个 `=`） |
| `key_id` | 是 | 人类标签；撤销使用指纹而非此值 |
| `signature_url` | 是 | 路径（默认 `/.well-known/ai-signature.json`） |

### 4.3 `validity`

`signed_at` 与 `expires_at` 为 RFC 3339 UTC 时间戳（`Z`，秒精度）。
`signed_at` 不得比当前时间晚超过 300 秒；`expires_at` 必须晚于 `signed_at`，且在验证时
必须位于未来。两个字段都位于签名载荷内。

### 4.4 `content`

`languages`（BCP 47 数组）是必需的。可选：`llms_txt` 与 `sitemap`（路径）、
`markdown`（含 `{path}` 的 `template`、布尔 `link_relation`）以及 `license`
（`name`，可选 `url` 与 `rsl_url`）。

### 4.5 `permissions`

`default`（`allow` | `deny`）是必需的；未出现的 usage 键继承它。`usage` 键：
`search, retrieval, input, training, quote, summarize, reproduce, translate, modify,
embed, commercial_use`，取值为 `allow` | `deny`。`attribution` 为
`required` | `optional` | `none`；可选 `attribution_url` 与 `attribution_text`。

词汇映射（信息性，版本固定）：

| AIFeed | IETF AIPREF（draft-ietf-aipref-vocab） | Cloudflare Content Signals |
|---|---|---|
| `search` | `search` | `search` |
| `retrieval` | `ai-use` | `ai-input` |
| `input` | `ai-use`（待"直接提供"定义） | — |
| `training` | `train-ai` | `ai-train` |

### 4.6 `limits`（可选）

`requests_per_minute`、`concurrent`、`crawl_delay_seconds`（均为整数）。

### 4.7 `types`、`capabilities`、`actions`

`types` 定义具名返回类型（JSON Schema 的子集）。`capabilities` 是只读操作；`actions`
是有副作用的操作，并新增 `requires_auth`、可选 `auth`、可选 `payment_terms_url`、
`human_confirmation_required`（对 actions 为必需）、可选 `requires_idempotency_key`
以及可选 `spending_limit`（含整数 `amount` 与 ISO 4217 `currency` 的对象）。参数类型
限于 `string`、`integer`、`boolean`；`in` 为 `query`、`path` 或 `body`。

### 4.8 `revocation`

`list_url` 必须是 `https://aifeed.md/revoke/v1/{domain}.json`。
`maximum_check_interval_hours`（整数）只能缩短客户端间隔；客户端必须忽略超过 168 小时的
值。

### 4.9 `metadata`

`generated_at`（RFC 3339）必需；可选 `generated_by`。

---

## 5. 签名（`ai-signature.json`）

分离签名容器是带三个必需字段的 JSON 对象：

```json
{
  "algorithm": "ed25519",
  "canonicalization": "jcs-rfc8785",
  "signature": "base64url:<86 chars>"
}
```

- **算法：** 纯 Ed25519（RFC 8032 §5.1）。不使用 Ed25519ph 与 Ed25519ctx。
- **规范化：** 对解析后的 manifest 应用 JSON Canonicalization Scheme（RFC 8785）。
- **签名字节：** `UTF-8("aifeed.v0.1\n") || JCS(manifest)`（域分离）。
- **签名编码：** 64 字节签名的 base64url，86 个字符，无填充。
- **密钥指纹：** `sha256:` + base64url(SHA-256(SPKI DER))——43 个字符。

客户端必须忽略签名容器中上述字段以外的字段，只有一个例外：`raw_digest`（定义见下）在
存在时具有意义。

### 5.1 `raw_digest`（可选）

`raw_digest` 为本地存储或缓存的 manifest 提供字节级完整性：

```json
{
  "sha-256": "<standard base64 of SHA-256 over the raw bytes of ai.json>",
  "applies_to": "raw-bytes"
}
```

- 按 `ai.json` 实际提供的**原始字节**（传输解码后）计算；AIFeed 服务器应当遵守
  `Accept-Encoding: identity`。不按规范化（JCS）形式计算。
- 它检测存储文件的损坏、位腐或字节级重排版。它**不是**真实性机制，绝不应当作 Ed25519
  签名的替代：能修改文件的一方也能修改存储的摘要。
- 位于签名容器中（绝不在 `ai.json` 内），以避免循环依赖。
- 验证存储或离线字节的客户端必须在 `raw_digest` 存在时验证它；不匹配产生
  `raw_digest_mismatch`。`raw_digest` 验证与 Ed25519 签名验证相互独立：重排版但语义
  相同的文件可能 `raw_digest` 失败而签名验证仍通过。

签名方必须在发布前验证 manifest、确认 `identity.public_key` 与签名密钥匹配，并验证自己
的签名。

---

## 6. DNS 锚点

```
_aifeed.example. 3600 IN TXT "v=aifeed1; pk=ed25519:<key>; fp=sha256:<fingerprint>; manifest=https://example/.well-known/ai.json"
```

规则：拼接单条 TXT 记录的所有字符串；`pk` 必须匹配 `identity.public_key`；`fp` 存在时
必须匹配指纹；多条记录具有不同 `pk` 值 → UNVERIFIED；记录缺失 → VERIFIED 且
`dns_anchored=false`；`pk2` 保留给密钥轮换。单条记录内重复的键（如两个 `pk` 字段）必须
被拒绝（`txt_duplicate_key`），该记录视为不可用——绝不静默"后者生效"。

---

## 7. 验证流程（规范性）

```
INPUT : host (normalized: lowercase, A-label, no trailing dot, no port, no userinfo;
each label 1–63 chars, no leading/trailing hyphen, total ≤253 chars)
OUTPUT: { level, dns_anchored, dnssec_validated, warnings[] }

1.  Fetch https://{host}/.well-known/ai.json
    (HTTPS only, no redirects, 10 s timeout, ≤100 KB as received, application/json,
    Accept-Encoding: identity). If a Content-Digest field is present, verify it over
    the bytes as received (RFC 9530) before parsing; mismatch → UNVERIFIED
    (content_digest_mismatch); absence → warning content_digest_absent.
2.  404/error → UNVERIFIED(reason=no_manifest)
3.  Strict parse (duplicate keys, NFC, integers, depth) → else UNVERIFIED(parse code)
4.  JSON Schema validation → else UNVERIFIED(schema_violation)
5.  version ∈ {0.1, 0.1.x} → else UNVERIFIED(upgrade_required)
6.  identity.domain == host → else UNVERIFIED(domain_mismatch)
7.  validity checks (signed_at, expires_at) → else UNVERIFIED(validity code)
8.  Fetch signature_url (≤2 KB) → 404 → UNVERIFIED(no_signature)
9.  msg = "aifeed.v0.1\n" || JCS(manifest)
10. Ed25519 verify → else UNVERIFIED(bad_signature)
11. Resolve _aifeed TXT: match → dns_anchored=true; mismatch → UNVERIFIED(dns_mismatch);
    absent → dns_anchored=false (warning)
12. Fetch revocation (canonical URL, cache ≤1 h):
      suspended → SUSPENDED · under_review → UNVERIFIED · active → continue
13. Registry unreachable: ≤24 h → VERIFIED (+warning);
    24–168 h → VERIFIED (warning revocation_stale);
    >168 h → UNVERIFIED(revocation_unavailable)
14. Matching key fingerprint in revocation.keys[] → UNVERIFIED(key_revoked)
15. Return level + flags + warnings
```

客户端加固要求：仅端口 443（否则 `port_not_allowed`；使用 `allowPrivate` 的测试夹具
除外）；拒绝 URL 中的 userinfo（`credentials_not_allowed`）；拒绝 IP 字面量；先解析再
拦截私有、回环、链路本地、ULA、CGNAT 共享、组播与元数据地址；在连接建立过程中固定解析
到的地址，地址变化即中止（`dns_rebinding_detected`）；不跟随重定向；验证
`Content-Type`；要求 `Accept-Encoding: identity`；带大小上限地流式读取；SNI 必须等于
host。

---

## 8. 信任级别

| 级别 | 条件 | 客户端行为 |
|---|---|---|
| VERIFIED | schema + 签名 + 域名 + 有效期通过；撤销状态 active | 遵守所声明的许可 |
| UNVERIFIED | 任何检查失败，或状态为 under_review | 视为建议性；高风险用途（`training`、`reproduce`、`modify`、`commercial_use`）必须被拒绝 |
| SUSPENDED | 撤销状态 suspended | 不得抓取；24 小时内清除缓存内容；向用户告警 |

标志：`dns_anchored`（布尔）、`dnssec_validated`（布尔）、warnings 数组。

AIFeed 信任链由四个相互强化的层组成：TLS（传输身份）、域名匹配（引用完整性）、Ed25519
签名（内容完整性）与 DNS 锚点（密钥所有权）。没有哪一层单独足够。合规客户端不得在没有
`level=VERIFIED` 与 `dns_anchored=true` 的情况下执行高风险动作
（`training`、`reproduce`、`modify`、`commercial_use`、`purchase`/`actions`）；没有
锚点时，只允许 `search`、`retrieval` 与 `input`，并配合保守的速率限制与署名。

---

## 9. 撤销

`GET https://aifeed.md/revoke/v1/{domain}.json` —— 签名的多签名文档：

- **签名字节：** `"aifeed-revoke.v0.1\n" || JCS(document without the signatures array)`。
- **签名：** Ed25519 签名数组；阈值 2-of-3（过渡期）→ 3-of-5（基金会）。
- **状态：** `active` | `under_review` | `suspended`（任何其他值 →
  `revocation_status_invalid`）；原因码：`repeated_spam`、
  `malware_distribution`、`identity_fraud`、`terms_violation`、`user_reports`。
- **过期：** `expires_at` 是必需的（缺失或不可解析时 `revocation_expires_invalid`）；
  生命周期超过 30 天应当警告（`revocation_expiry_long`）。域名比较不区分大小写、
  忽略末尾点、感知 IDNA。
- **缓存：** ≤ 1 小时；陈旧度策略见 §7 第 13 步。
- **透明性：** 所有撤销与密钥事件追加到 Merkle 日志（RFC 9162 模式），带签名检查点
  （C2SP signed-note 格式）。

---

## 10. 错误处理与速率限制

服务器应当返回 `429` 与 `Retry-After`。客户端必须遵守两者，采用带抖动的指数退避，重试
上限为 3 次。重复的 manifest 抓取失败最多可缓存为 UNVERIFIED 15 分钟。

---

## 11. 安全考虑

- **偏好来源。** AIPREF 式偏好不是安全机制；只有签名 manifest 加 DNS 锚点才能把它们
  归属到某个域名。
- **源站被攻陷。** 没有 `dns_anchored=true` 时，被攻陷的源站可以同时替换密钥与 manifest；
  合规客户端必须对高风险动作要求 `dns_anchored=true`（§8）。
- **完全攻陷与 TOFU。** 源站+DNS 被联合攻陷时，可在首次接触时呈现全新的密钥对；这在
  密码学上无法检测。对既有关系的检测依赖客户端密钥持久化（pinning）、防回滚状态与
  透明日志。客户端应当按源站持久化首个被接受的密钥，并在变化时告警。
- **没有 DNSSEC 的 DNS 欺骗。** 没有 DNSSEC 时，在途 DNS 攻击者可以造成
  `dns_mismatch`（拒绝/混淆），但无法伪造 manifest：没有服务器攻陷就无法替换 TLS 与
  原始签名 manifest。建议进行 DNSSEC 验证，高保障配置可以要求它。
- **回滚。** 客户端应当按源站记住最大的 `signed_at`，并拒绝更旧的 manifest。
- **提示注入。** `description` 字段是不可信数据。客户端不得把它们解释为指令，也不得
  解析 `ai.txt`。
- **注册表压制。** 有界陈旧度（§7 第 13 步）防止无限期的撤销压制。

---

## 12. IANA 考虑

计划注册 `ai.json` well-known URI 后缀（RFC 8615，Specification Required）；
`ai-signature.json` 也可能注册。`ai-feed` 链接关系类型（RFC 8288）的注册也已计划。
参考实现不依赖注册即可运行。

---

## 13. 参考资料

- RFC 2119 / RFC 8174（BCP 14）——需求关键词
- RFC 3339 —— 时间戳 · RFC 8032 —— Ed25519 · RFC 8785 —— JCS
- RFC 8259 / RFC 7493 —— JSON / I-JSON · RFC 8615 —— well-known URI
- RFC 9110 —— HTTP 语义 · RFC 9162 —— Certificate Transparency v2
- RFC 9421 —— HTTP Message Signatures · RFC 9530 —— Digest Fields
- IETF AIPREF（`draft-ietf-aipref-vocab`、`draft-ietf-aipref-attach`）
- W3C TDMRep · RSL 1.0 · Cloudflare Content Signals · llms.txt v2

## 附录 A —— 一致性

仓库在 `conformance/vectors/` 下发布正反测试向量。实现必须复现所有预期结果；向量已用
独立的 JavaScript 与 Python 验证器交叉验证。

## 附录 B —— 离线验证与离线包

离线验证使用抓取时缓存的原始字节加签名容器的 `raw_digest`。合规客户端保留：manifest
原始字节、签名字节、`raw_digest`（存在时）、抓取元数据（URL、时间戳、`Content-Digest`、
TLS 证书指纹）以及上次撤销检查的年龄。§7 的第 1–4 步完全可离线执行。

对于气隙与审计场景，离线包是包含 `manifest/`（`ai.json`、`ai-signature.json`、
`fetch-metadata.json`）、可选 `governance/` 与 `revocation/` 快照，以及
`BUNDLE-MANIFEST.json` 的目录；后者列出每个文件的 SHA-256 与大小，外加可选的 Ed25519
打包器签名，签名对象为 `"aifeed-bundle.v0.1\n" || JCS`（不含 `bundler` 字段的
manifest）。超过 168 小时的包降低信任（UNVERIFIED `bundle_stale`）；离线包永不替代在线
撤销的新鲜度。验证器必须拒绝含绝对路径、`..` 段或解析到包目录之外的条目的包
（`bundle_manifest_invalid`）——恶意包绝不能导致读取其根目录之外的内容。

## 附录 C —— 攻击场景

| # | 场景 | 拦截层 | 结果 |
|---|---|---|---|
| 1 | 有效 manifest 托管在不同域名 | 域名匹配 | UNVERIFIED |
| 2 | 签名后内容被编辑 | Ed25519 签名 | UNVERIFIED |
| 3 | 攻击者替换密钥并重新签名 | DNS 交叉检查（`dns_mismatch`） | UNVERIFIED |
| 4 | 源站被攻陷，新密钥对 | DNS 交叉检查（`dns_mismatch`） | UNVERIFIED |
| 5 | DNS 被攻陷，TXT 密钥被替换 | DNS/manifest 交叉检查；manifest 签名仍有效 | UNVERIFIED |
| 6 | 源站**与** DNS 同时被攻陷（全新密钥对） | 首次接触无拦截（TOFU）；对既有关系通过密钥固定/防回滚 + 透明日志检测 | VERIFIED（新对端）/ 已检测（既有对端） |
| 7 | 网络 MITM 修改正文 | TLS（+签名） | UNVERIFIED |
| 8 | CDN 提供过期副本 | 防回滚 `signed_at`（客户端状态） | UNVERIFIED |
| 9 | 重放过期的有效文件 | 防回滚 `signed_at` | UNVERIFIED |
| 10 | 攻击者控制域名上的伪造 manifest | TLS + 域名匹配 | UNVERIFIED |
| 11 | 传输损坏（位翻转） | `Content-Digest`（RFC 9530） | UNVERIFIED |
| 12 | 本地文件损坏/重排版 | `raw_digest` | UNVERIFIED |

完整伪造需要源站+DNS 联合攻陷；对既有关系，这可通过密钥固定与透明日志检测。DNSSEC 关闭
在途 DNS 欺骗；没有它时，仅 DNS 欺骗产生 `dns_mismatch`，而非伪造。
