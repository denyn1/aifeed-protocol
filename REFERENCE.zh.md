# AIFeed Protocol — 参考实现（v1.0.0-draft）

AIFeed 是面向 AI-Web 的开放信任层：源站在 `/.well-known/ai.json` 发布签名声明，
描述 AI 系统可以对其内容做什么。声明可离线验证（Ed25519 + JCS）、在 DNS 中锚定
（`_aifeed` TXT），并可通过签名公共注册表被撤销。

0.2 版本新增了 **MAKO 信任配置**：提供逐页 markdown 的源站
（`Accept: text/mako+markdown`，[MAKO 协议 1.0](https://github.com/juanisidoro/mako-spec)）
可以把签名许可绑定到单个页面、签署 MAKO 文档
（Ed25519 分离签名，`aifeed.mako.v0.2` 域分离），并发布带摘要的增量索引，
使客户端只获取发生变更的内容。

AIFeed 还定义了自己的**原生内容配置 AIFeed Markdown**——
`text/aifeed+markdown`、`.aifeed.md`、`aimd: "1.0"`——因此协议不依赖任何单一外部格式。
双栈源站在两种媒体类型下提供同一份签名字节，各自使用独立的签名上下文（`aimd` / `mako`）；
MAKO 作为兼容配置仍获完整支持。源站也可以选择运行 **AIFeed Markdown-only**
（`content.profile: "aifeed-md"`，正文更长，上限由发布方预算决定），WordPress 插件
通过 `aifeed_dual_stack` 过滤器暴露该模式。AIFeed Markdown 还携带 `alternates`
（已发布译文）以支持全球化网站，并规定了 IDN/punycode 与 BCP 47 规则，确保跨语言环境
的签名具有确定性。参见 `spec/en/aifeed-aimd-v1.md`。

本仓库是参考实现：规范、schema、CLI、一致性向量、基准测试，以及两个能通过同一套
向量的独立验证器（JavaScript 与 Python）。

> 状态：草案。规范尚未冻结。参见 `spec/en/aifeed-v0.2.md`
>（对 `spec/en/aifeed-v0.1.md` 的扩展）。

---

## 仓库结构

```
    ├── bin/                 CLI: keygen | sign | rotate | validate | bundle | init | import-openapi | mako
├── lib/                 严格解析器、JCS (RFC 8785)、Ed25519、schema 引擎、规则
├── lib/mako.js          MAKO 信任层：安全 YAML 子集、签名、许可、索引
├── lib/mako-html.js     HTML 到 MAKO 的转换（零依赖）
├── schema/              v0.1 + v0.2 manifest、签名、AIFeed Markdown v1、MAKO frontmatter/签名/索引
├── spec/en/             规范正本（英文；含 AIFeed Markdown v1）
├── spec/id/             官方译文（Bahasa Indonesia）
├── conformance/         向量（含 conformance/mako 与 conformance/aimd）、撤销、夹具
├── examples/            六类站点示例，含完整规模的 marketplace
├── clients/python/      零依赖 Python 验证器（manifest、撤销、离线包、MAKO）
├── packages/aifeed-verify/  构建产物 npm 包 @aifeed/verify
├── benchmarks/          MAKO + 执行报告（JSON/MD/HTML）与 edge/ 模板
├── docs/                process.html（动画协议演示）
├── integrations/        平台适配器：nginx、Caddy、Apache、Node、Next.js、PHP、Python、Go、GitHub Action
├── pilot/               试点套件：计划、埋点、周报模板
├── tools/               向量生成器、模糊测试器、SDK 构建器、基准/报告测试装置
└── tests/               Node 测试套件（node --test）
```

---

## 快速上手

无需依赖（JS 工具链需要 Node >= 20，Python 验证器需要 Python >= 3.10）。

```bash
# 1. 生成 Ed25519 密钥对
node bin/cli.js keygen --out ./my-site

# 2. 编写或生成 ai.json，然后签名（写入前先自验证）
node bin/cli.js sign ./my-site/ai.json

# 3. 本地验证
node bin/cli.js validate ./my-site

# 4. 验证线上域名（HTTPS + DNS 锚点 + 可选撤销检查）
node bin/cli.js validate tokobuku.example --revocation-url https://aifeed.md/revoke/v1/tokobuku.example.json

# 5. 用独立 Python 验证器执行同样的检查
python clients/python/aifeed_verify.py ./my-site --json

# 6. 离线包（气隙环境 / 审计）
node bin/cli.js bundle create ./my-site --out ./my-bundle --domain example.com
node bin/cli.js bundle verify ./my-bundle --json

# 7. 任意技术栈的零接触初始化（不需要 WordPress）
node bin/cli.js init --domain example.com --profile news --dir ./site

# 8. 从 OpenAPI 规范起草 capabilities/actions（半自动）
node bin/cli.js import-openapi ./openapi.json --out ./fragment.json

# 9. 任意平台：为静态站点构建 AIFeed Markdown + manifest + 索引
node bin/cli.js site build ./public --domain example.com --key ./my-site/aifeed-private.pem --llms --inject

# 10. MAKO：把 HTML 转换为 MAKO 文档（零依赖）
node bin/cli.js mako generate ./artikel.html --out ./artikel.mako.md --url https://example.com/artikel

# 11. AIFeed Markdown（原生）：生成、签名、验证与建索引
node bin/cli.js aimd generate ./artikel.html --out ./artikel.aifeed.md --url https://example.com/artikel
node bin/cli.js aimd sign ./artikel.aifeed.md --url https://example.com/artikel
node bin/cli.js aimd verify ./artikel.aifeed.md --url https://example.com/artikel --key ./my-site/aifeed-public.txt
node bin/cli.js aimd index ./site --domain example.com --sign --key ./my-site/aifeed-private.pem
node bin/cli.js aimd fetch https://example.com/artikel --key ./my-site/aifeed-public.txt

# 12. MAKO：在内容协商下签名、验证、建索引与抓取
node bin/cli.js mako sign ./artikel.mako.md --url https://example.com/artikel
node bin/cli.js mako verify ./artikel.mako.md --url https://example.com/artikel --key ./my-site/aifeed-public.txt
node bin/cli.js mako index ./site --domain example.com --sign --key ./my-site/aifeed-private.pem
node bin/cli.js mako fetch https://example.com/artikel --key ./my-site/aifeed-public.txt

# 13. 轮换签名密钥（v0.2 manifest）：公布、等待重叠期、切换
node bin/cli.js rotate --dir ./my-site --window 72
# 发布重叠期 manifest 与建议性 DNS pk2 记录，然后在 effective_at 之后：
node bin/cli.js rotate --dir ./my-site
```

退出码：`0` VERIFIED，`1` UNVERIFIED/SUSPENDED，`2` 用法错误或内部错误。

---

## 验证内容

- 严格 JSON：拒绝重复键、要求 NFC、仅整数（`|n| <= 2^53-1`）、最大深度 10、
  忽略 `x_` 扩展字段。
- 发现：`discoverManifestUrl()` 依次通过 `Link: rel="ai-feed"`、HTML
  `<link rel="ai-feed">` 查找 manifest，最后回退到 `/.well-known/ai.json`。
- schema 符合性（`schema/ai-json.v0.1.json`）。
- `identity.domain` 等于提供服务的 host（IDNA2008 A-label，大小写不敏感）。
- `validity.signed_at` / `expires_at` 位于签名载荷内。
- 基于 SPKI DER 密钥的纯 Ed25519（RFC 8032），签名对象为
  `"aifeed.v0.1\n" || JCS(manifest)`。
- DNS 锚点 `_aifeed`（公钥与可选指纹必须匹配）。
- 规范化撤销 URL 与有界陈旧度策略。
- 传输完整性：存在 `Content-Digest`（RFC 9530）时验证；抓取使用 identity 编码。
- 字节完整性：签名容器中的可选 `raw_digest` 可检测字节级损坏或重排版
  （用于损坏检测，不代表真实性）。
- 离线包：带哈希的文件清单与可选打包器签名；过期包（>168 小时）降低信任。
- MAKO 文档（v0.2）：安全 YAML 子集 frontmatter（拒绝 anchor、alias、tag 与 flow
  集合）、对 `"aifeed.mako.v0.2\n" || url || LF || 原始字节` 的 Ed25519 签名、
  带 restrict-only 覆盖的许可绑定、带逐条 SHA-256 摘要的分页增量索引，以及
  `aifeed.assets` 链接列表（图片、视频、音频、文档、压缩包），让智能体决定下载什么；
  转换器还会输出 "Media & Unduhan" 正文小节。
- 站点分流（v0.2）：增量索引携带可选的 `site` 摘要
  （名称、描述、类型、语言）和逐条分流字段
  （`title`、`summary`、`tags`、`lang`、`related`），让智能体在抓取前排序与挑选页面；
  SDK 为此提供 `selectEntries()`。

---

## 测试

```bash
npm test                 # Node 测试套件（248 项：单元、向量、AIFeed Markdown/MAKO、全局 i18n、站点构建器、服务器适配器、分流选择、执行、HTML 报告、试点套件、模糊冒烟、SDK、CLI、离线包、集成、密钥轮换）
npm run test:py          # Python 验证器套件（44 项：向量、AIFeed Markdown/MAKO 对等、撤销、离线包、示例）
npm run vectors          # 重新生成确定性 manifest 向量并自检（34）
npm run mako:vectors     # 重新生成 MAKO 一致性向量并自检（39）
npm run aimd:vectors     # 重新生成 AIFeed Markdown 一致性向量并自检（11）
npm run fuzz -- --iterations 50000 --seed 42    # 确定性解析器模糊测试（不变量 + 污染检查）
npm run fuzz:mako -- --iterations 30000         # MAKO frontmatter/容器/索引模糊测试
npm run bench:mako       # MAKO 基准测试，写入 benchmarks/mako-report.md
npm run bench:enforcement # 执行测试装置（PDP + 四种客户端配置 + 100 租户规模），写入 benchmarks/enforcement-report.{md,json}
npm run render:html      # 渲染 benchmarks/enforcement-report.html 与 docs/process.html（离线、动画）
npm run build:sdk        # 从 lib/ + schema/ 重新构建 packages/aifeed-verify
npm run sdk:check        # 校验已构建 SDK 与源同步
```

抓取集成测试运行在本地 TLS 夹具服务器上（`tests/fixtures/tls/`，自签名，仅测试用），
覆盖 Content-Digest、重定向、内容编码、大小限制、超时、私有地址拦截与不受信任证书拒绝。

34 个 manifest 一致性向量、39 个 MAKO 向量（正反例：签名、摘要、许可覆盖、YAML 攻击、
资源、索引分流）、11 个 AIFeed Markdown 向量（原生标记、双标记、跨格式重放、篡改、
资源、alternates、严格可选字段校验），以及撤销、离线包与示例夹具（news、e-commerce、
blog、government、SaaS，以及含 9 个 capabilities、5 个 OAuth2 actions 与 10 个类型的
完整规模 marketplace）均由 JavaScript 与 Python 两个实现验证——即跨语言的差分互操作测试。

### 任意平台（不只是 WordPress）

`aifeed site build <dir>` 可把任意静态输出变成签名的 AIFeed 源站——manifest、增量索引、
逐页内容（AIFeed Markdown 用 `.aifeed.md`，MAKO 用 `.mako.md`，`--profile both` 两者皆有）、
带匹配签名上下文的 `{file}.sig` 边车文件，以及可选的 `llms.txt`——并可通过显式
`--inject` 为不支持内容协商的主机注入 `<link rel="alternate">` 标签。嵌套目录索引
（`/dir/index.html`）在每个适配器上都可通过干净路径（`/dir`）访问。`integrations/`
提供 nginx、Caddy、Apache、Node/Express、Next.js、PHP、Python ASGI、Go 的现成适配器
与一个 GitHub Action；矩阵与快速上手见 `integrations/README.md`。

部署前后验证构建目录：

```bash
aifeed validate ./public --domain example.com --json                     # manifest
aifeed aimd verify ./public/artikel/satu.aifeed.md \
  --url https://example.com/artikel/satu \
  --key ./.aifeed/aifeed-public.txt --json                               # 页面 + 签名
```

### 执行证据与试点套件

`npm run bench:enforcement` 运行回环测试装置，包含真实 HTTP 源站与 PDP 边缘
（拒绝训练、`429 + Retry-After`、MAKO/增量），覆盖四种客户端配置与 100 租户托管场景，
为发布方与 AI 侧同时带来节省（`benchmarks/enforcement-report.md`）。`benchmarks/edge/`
包含 nginx/Caddy 对等模板，`pilot/` 包含可直接运行的 30 天试点套件，附访问日志 schema
与 `tools/pilot-report.js`。动画报告（`benchmarks/enforcement-report.html`、
`docs/process.html`）自包含且可离线运行。

### WordPress 端到端验证（手动）

使用真实 WordPress（PHP 8.4 + 官方 SQLite drop-in）对发布插件做了端到端验证：
激活 → 生成密钥 → 签名 → 通过 HTTP 提供 → 由本 SDK 与 `bin/cli.js validate` 判定
**VERIFIED**，包括 `raw_digest` 层；未知的 `/.well-known/ai*` 路径返回 404 JSON。
管理流程同样通过 HTTP 模拟（登录、Settings API 保存、带 nonce 的签名操作、缺失 nonce
拒绝、未认证拒绝、徽章短代码）：**17/17 项检查通过**。

MAKO 层也在同一环境验证：manifest 声明 `content.mako`（v0.2），带
`Accept: text/mako+markdown` 的 `GET` 返回 `text/mako+markdown` 及 MAKO 必需响应头，
内联 `X-Aifeed-Signature: mako1:...` 容器可对 manifest 密钥验证（篡改正文被拒绝），
HTML 页面声明 alternate 链接，签名增量索引与逐条摘要匹配。参见 `wp-plugin/README.md`。

---

## 智能体侧快速上手

抓取之前，智能体应先发现并验证发布方声明，遵守许可与抓取限额，并使用增量索引。
指南：[`docs/agent-quickstart.md`](docs/agent-quickstart.md)；可运行示例：
[`examples/agent/compliant-agent.js`](examples/agent/compliant-agent.js)——
`node examples/agent/compliant-agent.js https://example.com --use retrieval --fetch`。

## 发布方 AI 指南

如果你拥有网站，把这份指南交给你的 AI 编程智能体，它会为你端到端安装 AIFeed：
[`docs/publisher-ai-guide.zh.md`](docs/publisher-ai-guide.zh.md) —— 覆盖小型、中型、大型、巨型站点，每条 track 都以验证通过的 manifest 结束。

## SDK

- **AI 客户端 — `@aifeed/verify`**（`packages/aifeed-verify/`）：通过
  `npm run build:sdk` 从 `lib/` 与 `schema/` 构建的自包含 npm 包；随附 TypeScript
  声明（`index.d.ts`）与 v0.2 MAKO API（`fetchMako`、`fetchIndexDelta`、
  `selectEntries`、`decideUsage`、`mako.*` 原语、v0.2 schema）；打包经
  `npm pack --dry-run` 测试。
- **发布方 — WordPress**（`wp-plugin/`）：参考发布方 SDK（密钥管理、manifest 构建器、
  PHP 版 JCS、签名、`/.well-known` 服务、管理界面、DNS 指引、徽章、每月重签），以及
  v0.2 MAKO 层（内容协商、签名 MAKO 文档、增量索引、mako-wp 共存）。已在真实
  WordPress 中验证；`php -l`、`php tests/jcs-test.php` 与 `php tests/mako-test.php`
  可独立运行。

---

## 规范与相关标准

AIFeed 与以下标准互补：`robots.txt`（RFC 9309）、IETF AIPREF 词汇/附件草案、
Cloudflare Content Signals、RSL 1.0、W3C TDMRep、`llms.txt` v2，以及 **MAKO**
（面向 AI 智能体的逐页 markdown）。AIPREF 指出偏好不是安全机制；AIFeed 补上缺失的
归属、许可绑定与撤销层；MAKO 声明其不提供验证——AIFeed 提供验证。

语言政策：规范以英文为正本。文档计划覆盖 10 种优先语言（联合国六种官方语言，加
印度尼西亚语、葡萄牙语、印地语、斯瓦希里语）。

---

## 出版物

- `paper/` — arXiv 预印本草案 *AIFeed: Verifiable Content Permissions and
  Efficient Agent Delivery for the AI Web*（工作标题）：LaTeX 源 + Markdown 镜像、
  经核验元数据的 `refs.bib`、`CLAIMS.md`（主张→来源台账）与 `CHECKLIST.md`
  （投稿就绪清单）。结构检查：`npm run paper:check`。

## 许可证

规范：CC BY 4.0 · 代码与 schema：MIT。测试向量以公共领域（CC0）发布，供实现测试使用。

AIFeed 遵循 **开放核心 + 开放标准** 政策：验证路径（规范、schema、验证器、向量、
发布工具）永久开放，不含专有扩展；只有密钥、客户数据与反滥用策略保持私有。
详见 `GOVERNANCE.md`（"Licensing and open-core policy"）。

## 治理与贡献

`CONTRIBUTING.md`（工作流、翻译政策、一致性要求、贡献许可）、`GOVERNANCE.md`
（临时决策机制、许可/开放核心政策、走向基金会的路径）、`SECURITY.md`
（漏洞报告、密钥泄露、披露）与 `CODE_OF_CONDUCT.md`。规范历史：`CHANGELOG.md`；
规范索引：`spec/README.md`。
