# 架构

<p><a href="architecture.md">English</a> · <a href="architecture.id.md">Bahasa Indonesia</a> · <a href="architecture.zh.md">中文</a></p>

AIFeed 如何组成、各层负责什么，以及在哪里扩展。智能体/人类工作流规则见
[`../AGENTS.md`](../AGENTS.md)；发布机制见 [`release.md`](release.md)。

## 一段话

发布方在 `/.well-known/ai.json` 提供**签名 manifest**（JCS 规范化 JSON、Ed25519），
在 DNS 中锚定公钥（`_aifeed` TXT），并可选提供逐页**内容配置**
（原生 *AIFeed Markdown*、兼容 *MAKO*）以及签名**增量索引**。客户端离线验证整条链与
逐页签名，遵守许可与抓取限额，并重新检查多签名**撤销**注册表。全栈零运行时依赖。

## 分层

| 层 | 代码 | 职责 |
|---|---|---|
| 密码学与编码 | `lib/crypto.js`、`lib/jcs.js`、`lib/digest.js` | 基于 JCS（RFC 8785）字节的 Ed25519（RFC 8032）；SHA-256 摘要；上下文字符串 |
| 严格解析 | `lib/parse.js`、`lib/schema.js` | 重复键、NFC、整数边界、深度上限；schema 驱动的检查 |
| 验证 | `lib/validate.js` | manifest/签名检查、信任级别、警告与错误 |
| 内容配置 | `lib/mako.js`、`lib/mako-html.js` | 安全 YAML 子集、文档签名、许可绑定、增量索引、HTML→配置转换 |
| 传输 | `lib/remote.js` | 带 pinning 的 HTTPS 抓取、TLS 选项、发现、DNS 锚点查询 |
| 信任文档 | `lib/revocation.js`、`lib/bundle.js` | 多签名撤销、有界陈旧度、离线包 |
| 发布工具 | `lib/scaffold.js`、`lib/site.js`、`bin/cli.js` | manifest 脚手架、静态站点构建器、CLI 界面 |
| SDK | `packages/aifeed-verify/index.js`、`.d.ts` | 客户端 API；包内 `lib/` + `schema/` 为生成的副本 |
| 独立验证器 | `clients/python/` | 第二种语言的差分一致性（仅标准库） |
| 适配器 | `integrations/` | nginx、Caddy、Apache、Node、Next.js、PHP、Python ASGI、Go、GitHub Action |
| WordPress 发布方 | `wp-plugin/` | 管理界面、密钥管理、双栈服务、`/llms.txt` |
| 生成器与检查 | `tools/` | 向量、基准、HTML 报告、模糊测试、站点构建器、演示生成器、线上检查、一致性检查 |
| 演示源站 | `demos/`、`tools/gen-demos.js` | 七个签名演示站点 + apex 产物；公开的确定性密钥 |
| 边缘路由 | `functions/` | Cloudflare Pages Function：`<sub>.aifeed.md` → `site/demos/<sub>/`、CORS、`strict` 403/429 |
| 事实来源 | `spec/`、`schema/`、`conformance/` | 规范文本、schema、向量 |

## 签名上下文

每个签名产物都声明其上下文；跨上下文与跨 URL 重放按设计被拒绝。

| 产物 | 上下文字符串 | 覆盖范围 |
|---|---|---|
| manifest v0.2 | `aifeed.v0.2\n` | JCS(manifest) |
| manifest v0.1 | `aifeed.v0.1\n` | JCS(manifest) |
| AIFeed Markdown 页面 | `aifeed.aimd.v1\n` | url + LF + 原始字节 |
| AIFeed Markdown 索引 | `aifeed.aimd-index.v1\n` | url + LF + 原始字节 |
| MAKO 页面 | `aifeed.mako.v0.2\n` | url + LF + 原始字节 |
| MAKO 索引 | `aifeed.mako-index.v0.2\n` | url + LF + 原始字节 |
| 签名容器 | `aimd1:` / `mako1:` base64url 前缀 | 内联响应头或 `{file}.sig` 边车 |

## 流程

发布（发布方）：`keygen` → 脚手架生成 manifest → 签名 → 写入
`/.well-known/ai.json`（+ `ai-signature.json`）→ 可选 `site build` 生成逐页
`*.aifeed.md` / `*.mako.md`（+ `.sig`）与签名增量索引 → DNS `_aifeed` 锚点 → 提供服务。

验证（客户端）：`discoverManifestUrl` → 抓取 manifest + 签名 → `verifyAll`
（严格解析 → schema → 域名 → 签名 → 可选 raw digest）→ 可选 `lookupAifeedTxt` →
按用途 `decideUsage` → `fetchAimd`/`fetchMako`
（内容协商、逐页签名）→ `fetchIndexDelta` + `selectEntries`
（跳过未变更页面）→ 复查撤销。可运行参考：
[`../examples/agent/compliant-agent.js`](../examples/agent/compliant-agent.js)。

## 不变量

- **规范字节**：JCS 输出与原始文件字节被签名；绝不重排 `conformance/`、`examples/`
  或已签名的站点文件。`.gitattributes` 强制 LF。
- **仅收紧的覆盖**：页面级策略只能收紧 manifest。
- **严格解析器**：重复键、浮点数、NFD 字符串、超大整数与未知字段（`x_*` 之外）都被
  拒绝——JS 与 Python 一致。
- **确定性**：生成器使用固定种子/密钥；`…:vectors:check` 与 `sdk:check` 在提交产物
  与源偏离时失败。
- **证据标签**（[F]/[M]/[E]/[S]/[H]）用于文档/论文中的每项事实主张；实测数字来自
  `benchmarks/*.json` 与 `paper/CLAIMS.md`。

## 扩展点

| 想要… | 做法 |
|---|---|
| 新增许可键 | `schema/ai-json.v0.2.json` + `lib/validate.js` + 两个验证器 + 一个向量 |
| 新增向量 | 在 `tools/` 写生成器，运行，保持 `…:vectors:check` 绿 |
| 新增 CLI 命令 | `bin/cli.js` + 帮助 + `tests/cli*.test.js` + `REFERENCE.md` |
| 新增平台适配器 | 在 `integrations/` 新建目录 + `integrations/README.md` 一行（+ Node handler 测试） |
| 改变内容形态 | `lib/mako.js` / `lib/mako-html.js` + AIMD/MAKO 生成器 + 规范镜像 + Python 对等 |
| 改动 SDK API | `packages/aifeed-verify/index.js` + `index.d.ts`，然后 `npm run build:sdk && npm run sdk:check` |
| 改动站点 | `site/index.html` + 根目录 `penjelasan-aifeed.html`；用 `npm run verify` 重新生成 |
| 新增演示源站 | `demos/sites.js`（可选 `demos/verifier/` 资源），然后 `npm run demos:check` |
| 改变边缘策略 | `functions/[[path]].js`；helper 在 `tests/gen-demos.test.js` 有单元测试 |

## 生成与手写

`AGENTS.md` 保存完整对照表（产物 → 来源 → 重新生成 → 验证）。简言之：
`packages/aifeed-verify/{lib,schema}` 下的内容复制自根目录 `lib/`/`schema/`；
`conformance/**` 来自 `tools/gen-*`；报告/站点 HTML 来自
`tools/render-html.js` + `tools/build-site.js`；arXiv 包从 `paper/` 构建。
手写：`spec/`、`schema/`、`lib/`、`bin/`、`clients/`、`integrations/`、
`wp-plugin/`、`tools/`、`site/index.html`、`penjelasan-aifeed.html`、`paper/*.tex|md`、
SDK 的 `index.js`/`index.d.ts`，以及全部文档。
