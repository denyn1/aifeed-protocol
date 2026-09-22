# 更新日志

<p><a href="CHANGELOG.md">English</a> · <a href="CHANGELOG.id.md">Bahasa Indonesia</a> · <a href="CHANGELOG.zh.md">中文</a></p>

AIFeed 协议与参考实现的所有重要变更都记录于此。格式遵循
[Keep a Changelog](https://keepachangelog.com/en/1.0.0/)。

> 全项目使用的证据标签：[F] 已验证事实、[M] 可信、[E] 模型估计、[S] 本地模拟装置实测、
> [H] 需法律审查。

## [Unreleased]

### 新增

- **MCP 服务器（`aifeed-mcp-server`）** — 零依赖的 stdio Model Context Protocol 服务器：
  `verify_manifest`、`fetch_aifeed`（按 token 预算获取 markdown 并验签）、`list_assets`、
  `verify_asset`（字节级 `size`/`sha-256` 证明）、`select_index`（在页面/token 预算内按
  查询排序）、`decide_usage`；仅限 HTTPS（回环需 `AIFEED_MCP_ALLOW_PRIVATE=1`）；用
  `npm run mcp` 或 `npx aifeed-mcp-server` 运行。
- **官方 MCP Registry 收录** — `aifeed-mcp-server` 重新发布为 `1.0.0-draft.2`，带上
  registry 要求的 `mcpName`（`io.github.denyn1/aifeed-mcp-server`），并通过
  `mcp-publisher` 发布到 `registry.modelcontextprotocol.io` 的 `io.github.denyn1` 命名空间。
  同一构建可打包为 MCPB 包（`npm run mcpb`），并以 `denyn1/aifeed-mcp-server` 收录于 Smithery。
- **DeepSeek Harness 插件（`@aifeed/deepseek-harness`）** — Cordis 插件，为 harness 提供六个
  可由模型调用的工具（`aifeed_verify_manifest`、`aifeed_fetch_aifeed`、
  `aifeed_list_assets`、`aifeed_verify_asset`、`aifeed_select_index`、
  `aifeed_decide_usage`）；复用零依赖 MCP 引擎的 CJS 生成副本
  （`npm run build:harness` / `npm run harness:check`）。已发布到 npm：`@aifeed/deepseek-harness`，
  可直接作为 dsh bundle 安装（`dsh plugin --profile web add @aifeed/deepseek-harness`）。
- **提交至 ZCode Plugins Marketplace** — `zai-org/zcode-plugins` 的 PR #33 为 Z.ai 的
  ZCode 智能体新增 `aifeed` 插件（内置零依赖 MCP 引擎 + verify-first 技能）；等待维护者审核。
- **PyPI 包 `aifeed`** — 独立 Python 验证器现以仅标准库 wheel 发布（`pip install aifeed`）：
  `aifeed.verify` 与 `aifeed.mako` 模块、`aifeed-verify`/`aifeed-mako` 控制台脚本、
  镜像 `1.0.0-draft` 核心的 PEP 440 预发布 `1.0.0a1`；历史
  `aifeed_verify`/`aifeed_mako` 导入仍作为别名。
- **即插即用框架插件（`@aifeed/frameworks`）** — 一行构建集成：Vite 与 Astro 用
  `aifeed()`，Next.js 用 `withAifeed()` 加 `aifeed-next` postbuild 命令，任意静态生成器
  用通用 `aifeed-build` CLI（含 `keygen`）；就地签名构建输出（manifest、逐页 AIFeed
  Markdown/MAKO、增量索引、`llms.txt`）、注入 `<link rel="alternate">`、清理过期生成文件、
  自校验签名/摘要；环境变量回退 `AIFEED_DOMAIN`、`AIFEED_KEY`、`AIFEED_BASE_URL`。
- **npm 上的 CLI（`aifeed`）** — `npx aifeed` 发布发布方 CLI（keygen、init、sign、
  validate、rotate、bundle、`site build`、AIFeed Markdown/MAKO 工具），源码位于
  `packages/aifeed-cli/`；`sign` 现在会在站点目录旁查找默认密钥，
  `validate`/`verifyDirectory` 接受 manifest 位于 `.well-known/` 的站点根目录。
- **`verifyRemote()`** — `@aifeed/verify` 的一次调用远程验证：discovery → manifest + 签名
  → DNS `_aifeed` 锚点状态，使 npm 页面上的 3 行消费者快速上手成为可能。
- **仓库 URL 一致性** — CI workflow 模板、`package.json` 元数据、WordPress 插件目录头部
  与命名空间文档现已指向 `github.com/denyn1/aifeed-protocol`（规范地址）；workflow 固定
  tag `v1.0.0-draft.2`，用不带 `|| true` 的 `validate` 作为门禁，并指向
  `@aifeed/frameworks`（Vite/Astro/Next.js）；`check-consistency` 会拒绝过期的
  `aifeed/aifeed-protocol` URL。
- **Rust 适配器（`integrations/rust`）** — Axum 中间件 `AifeedLayer`（内容协商、内联签名、
  遍历防护），经 11 个 `cargo test` 用例验证。
- **更新 RSS 源** — `site/feed.xml` 在构建时由 `CHANGELOG.md` 渲染，并从首页 head 链接；
  sitemap 收录它。
- **发布者徽章** — 静态 `badge.svg`（"verified by AIFeed"），发布者指南附可复制的 HTML
  与 Markdown 片段，已签名源站可借此回链。
- **Python 框架示例** — `examples/python/` 下可复制的 LangChain、LlamaIndex 与 Crawl4AI
  加载器，由 `test_examples.py` 覆盖（+11 测试）。
- **智能体技能 + Smithery 描述符** — `skills/aifeed/SKILL.md` 教编程智能体验证/发布流程；
  `smithery.yaml` 给出 MCP stdio 启动命令。

## [1.0.0-draft] — 2026-09-16

### 新增

- **AIFeed Studio（本地发布方应用）** —— `npm run studio` 在 `127.0.0.1:7777` 提供
  零依赖 Web UI：按域名的工作区、本地 HTML 来源接入、restrict-only 策略编辑器
  （使用许可、署名文本/URL、抓取限额、许可证、`llms.txt`、撤销间隔、路径规则）、
  增量构建、manifest/页面/索引的本地验证，以及带 `_aifeed` DNS TXT 记录的导出。
  遵守 robots 的抓取器（sitemap 或链接发现、限速、ETag/Last-Modified 缓存）覆盖线上
  站点；站点类型预设（news、ecommerce、marketplace、government、open、restrictive、
  blog）、按路径的页面类型（`product`、`article`、`listing`……）以及可选的 freshness
  元数据（页面日期/标签）补齐了站点类型支持。M3 新增 `.tar.gz` 覆盖层下载、与
  `integrations/` 适配器提示相连的技术栈检测、一键线上验证（manifest、签名、DNS
  锚点），以及会换钥并重新签名所有页面的受保护密钥轮换仪式。G4 新增经 schema 校验的
  `types`/`capabilities`/`actions` 编辑器、面向电商动作的 OpenAPI 导入，以及审计日志
  （`journal.ndjson`）和针对常见 DNS、schema、签名与轮换失败的内联修复提示。私钥保留在工作区（0600）且永不对外提供；
  界面支持 EN/ID/ZH。manifest 构建器
  （`lib/site.js`）新增可选 `limits`、`license`、`attribution_text/url` 与
  `maxCheckIntervalHours` 选项（向后兼容）。
- **资源完整性与索引可见性** — 页面 `aifeed.assets` 条目可携带 `mime`、`size` 与
  `sha-256`（构建时对本地文件计算，≤16 MiB）；增量索引条目暴露 `assets` 数量，SDK 新增
  `listAssets()` 与 `verifyAsset()`，Studio 显示资源总数与摘要覆盖率，`verify:live`
  在资源路径上验证边缘执行。
- **网站** — 新增 `studio.html`（Publish）与 `updates.html`（构建时从 EN/ID/ZH 变更日志
  渲染的发布说明）页面，已从导航栏、artifacts 网格与 apex sitemap 链接；两者均附带
  签名 AIFeed Markdown。
- **密钥轮换（v0.2 §14）**——在不破坏验证的前提下替换 manifest 签名密钥：旧密钥签名的
  `rotation.successor_fp` 指令加建议性 DNS `pk2` 交叉校验、有界重叠期
  （`effective_at` → `grace_until`，1 小时硬下限）、新密钥签名的 `predecessor_fp` 切换
  绑定，然后是永久撤销。六个结果码：`rotation_invalid`、`rotation_anchor_unverified`、
  `grace_accepted`、`rotation_denied`、`rotation_resync`、`key_revoked`。实现于
  `lib/rotation.js`、单命令 CLI `aifeed rotate [--dry-run]`、SDK `rotation` 导出、
  Python 指令对等、PHP manifest 校验、向量 008–011 / 119–123，操作手册见
  `docs/rotation.md`。
- **SDK 重新发布为 `1.0.0-draft.2`** —— 包含密钥轮换辅助（`rotation.*`）、Studio 使用的
  v0.2 manifest 构建器选项（limits、license、attribution 文本/URL），以及 `htmlToMako`
  的页面类型与可选 freshness 选项。
- **AIFeed Markdown v1.0**——原生内容配置：`text/aifeed+markdown`、`.aifeed.md`、
  `aimd: "1.0"`、一等 `aifeed` 政策块、token 预算由发布方自选（仅 AIFeed Markdown 模式
  下参考默认 4,000）。
- **双栈服务**——同一份签名字节在 AIFeed Markdown 与 MAKO 下提供，各带自己的签名上下文
  （`aimd` / `mako`）；跨格式重放被拒绝。
- manifest 扩展：`content.profile`（`mako` | `aifeed-md` | `both`）与
  `content.index_url`；AIFeed Markdown 索引位于 `/.well-known/aifeed-index.json`。
- CLI：`aifeed aimd <generate|sign|verify|index|fetch>` 别名，generate、index、fetch
  支持 `--format`；sign/verify 自动识别配置。
- SDK `@aifeed/verify` 1.0.0-draft：`fetchAimd`、`verifyAimdDocument`、
  `verifyAimdIndex`、媒体类型常量。
- WordPress 插件 1.0.0-draft：双栈服务、通过 `aifeed_dual_stack` 过滤器实现仅 AIFeed
  Markdown 模式、按格式的签名与索引。
- 规范：`spec/en|id|zh/aifeed-aimd-v1.md`（运行模式、IANA 考虑）。
- 向量：`conformance/aimd/`（11 个用例：标记、跨格式重放、篡改、资源、alternates、
  严格可选字段校验）并带 Python 对等；模糊语料包含 AIFeed Markdown。
- 仓库：`CONTRIBUTING.md`、`SECURITY.md`、`CODE_OF_CONDUCT.md`、`GOVERNANCE.md`、
  `spec/README.md`、SDK README、插件 LICENSE 与初始 `.pot`。
- **任意平台发布**：`aifeed site build <dir>` 为任意静态输出（Hugo、Jekyll、Astro、
  Next export、纯 HTML）生成 manifest、增量索引、带签名的逐页内容与可选的 `llms.txt`，
  并支持可选注入 `<link rel="alternate">`。文件命名按配置区分——AIFeed Markdown 用
  `.aifeed.md`、MAKO 用 `.mako.md`、`--profile both` 两者都写——附带与媒体类型匹配的
  `{file}.sig` 边车。目录索引（`/dir/index.html`）在所有适配器上都可通过干净路径
  （`/dir`）访问，包括嵌套路径。
- **服务器适配器**（`integrations/`）：nginx、Caddy、Apache、Node/Express、Next.js、
  PHP、Python ASGI、Go 与 GitHub Action（含 Node handler 测试）。
- **许可与开放核心政策**记录于 `GOVERNANCE.md`：验证路径（规范、schema、验证器、向量、
  发布工具）永久开放，不含专有验证扩展；只有密钥、客户数据与反滥用策略保持私有。
  贡献许可（inbound=outbound）加入 `CONTRIBUTING.md`。
- **arXiv 预印本草案**（`paper/`）：LaTeX 源 + Markdown 镜像、对照一手来源核验元数据的
  `refs.bib`（17 个 RFC、固定版本 IETF 草案、Crossref DOI、出版商页面）、
  `CLAIMS.md` 主张→来源台账、`CHECKLIST.md` 投稿就绪清单，以及用于引文/环境交叉检查的
  `npm run paper:check`（52/52 已引用）。

### 变更

- **发布号改为 `1.0.0-draft`**（原 `0.3.0-draft`），覆盖协议包、SDK、CLI、WordPress
  插件、文档与站点。线格式/规范版本不变：manifest `0.1` / `0.2`、AIFeed Markdown
  `1.0`、外部 MAKO `0.2`——重新编号不改变任何签名字节或兼容性主张。
- manifest 验证接受 `0.1.x` 与 `0.2.x`；其他版本报告 `upgrade_required`。
- 执行/HTML 报告与试点套件自包含且可离线。
- **规范域名迁移**：从 `aifeed.org`（第三方）迁移到 `aifeed.md`，覆盖规范、schema、
  注册表/撤销 URL、文档、测试、SDK 与 WordPress 插件——包括 JSON schema 与 PHP 中
  转义的正则形式。所有签名向量、夹具与索引重新生成，完整回归重跑。迁移可通过
  `node tools/replace-domain.js --domain aifeed.md` 重复执行（默认 dry-run）。
- **规范域名 `aifeed.md` 已注册**（维护者，2026-09-16）。DNS 与规范/文档站点是下一步
  配置；规范、schema 与注册表链接中的规范 URL 已指向 `aifeed.md`。
- **`aifeed.md` 静态站点部署资产**：`site/`（落地页）、用于刷新复制产物的
  `npm run build:site`（`tools/build-site.js`）、面向 Cloudflare Pages 的
  `.github/workflows/pages-cf.yml`，以及涵盖 DNS、部署与演示子域名布局的
  `docs/deploy-site.md`。
- **落地页重新设计**，采用受 Groq 控制台启发的暗色优先美学：暖黑表面、朱红强调色、
  Inter/Montserrat 字体、顶部导航、带内联标志的 hero、图标功能网格、分组规范/工具
  栏目、信息横幅与明暗切换。
- **SEO 套件**：逐页元数据（canonical、Open Graph、Twitter 卡片、
  `max-image-preview`）、落地页与每个演示页的 JSON-LD、覆盖全部演示页的 apex
  `robots.txt` + `sitemap.xml`、零依赖 1200×630 `og-image.png` 生成器
  （`tools/gen-og-image.js`），以及含 Google Search Console 操作手册的 `docs/seo.md`。
- **线上演示源站**：七个签名演示站点（`demo`、`news`、`shop`、`gov`、`strict`、
  `revoked`、`verify`）由 `demos/sites.js` 与公开演示密钥确定性生成，通过
  `functions/[[path]].js` 部署于 Cloudflare Pages（主机路由、CORS、`strict` 上的
  实时 403/429 执行、`verify` 上的浏览器验证器、`site/revoke/` 下的多签名撤销注册
  表）。apex `aifeed.md` 现在以自身签名 manifest 自我吃狗粮。新工具：`npm run demos`、
  `npm run demos:check`（在 `verify` 内）、`npm run verify:live`。
- **可维护性套件**：`AGENTS.md`（智能体/开发者契约：生成文件、版本位置、陷阱）、
  `docs/architecture.md`（模块地图、不变量、扩展点）、`docs/release.md`
  （发布/升级清单），以及零依赖检查器（`npm run lint:syntax`、
  `npm run check:consistency`）并入一个门禁：`npm run verify`。
- **仓库扁平化**：协议项目现在位于仓库根目录（原为 `aifeed-protocol/`），WordPress
  插件位于 `wp-plugin/`，印尼语项目文档位于 `docs/` 下。规范路径现在是
  `github.com/denyn1/aifeed-protocol/tree/main/<path>`（无双重前缀）；CI workflow、
  站点链接与文档已相应更新。
- **CI 修复**：Pages workflow 现在先运行报告渲染器再运行站点构建器
  （`render-html` → `build-site`），因此 `/process.html` 与
  `/enforcement-report.html` 恢复发布；`build-site` 现在在生成源缺失时大声失败，
  而不是静默跳过（两者在清理时被 gitignore）。
- **智能体侧快速上手**：`docs/agent-quickstart.md`（先检查流程与失败处理）与可运行的
  合规智能体示例（`examples/agent/compliant-agent.js`），由
  `tests/agent-example.test.js` 覆盖。SDK 现在通过 `fetchMako`、`fetchIndexDelta` 与
  边车签名抓取转发 `allowPrivate`/`ca`（用于本地自签名测试环境）。
- **仓库清理**：删除过时的提案/评审草稿与已提交的构建产物（报告 HTML、站点副本、
  重复 PDF、arXiv 暂存/ZIP）；它们按需重新生成（`npm run render:html`、
  `npm run build:site`）并已 gitignore。arXiv 包直接从 `paper/` 构建。
- **SDK 发布到 npm**：`@aifeed/verify@1.0.0-draft`（dist-tag `latest` 与 `next`），
  27 个文件、打包 44.7 kB；`npm install @aifeed/verify` 开箱即用。更新为
  **`1.0.0-draft.1`**（2026-09-16），含 TLS/私有抓取选项转发修复；两个 dist-tag 均
  指向它。monorepo 包标记为 `"private": true` 以防误发布。
- **Logo 简化**为静态扁平 2D 标记（朱红盾牌 + 白色对勾，378 字节，无渐变/滤镜/动画），
  取代动态徽章。站点、favicon 与完整指南均通过 `site/logo.svg` 使用它。
- **报告页面按落地页设计系统重建并改为英文**：协议流程（`docs/process.html`）、执行
  基准（`benchmarks/enforcement-report.html`）与长文完整指南
  （`penjelasan-aifeed.html` → `site/penjelasan.html`）现在共享暖黑调色板、朱红强调色
  与明暗切换；全部保持自包含/离线，无外部资源。
- **面向人类的命名统一为 "AIFeed Markdown"**，覆盖文档、CLI/SDK 输出与报告；线标识
  不变（`aimd`、`aimd-index`、`AIMD-C1..C4` 级别码、`AIMD_*` 常量、`.aifeed.md`）。
  EN/ID 规范标题现在明确说明线标识。
- **PHP JCS 夹具漂移修复**：`npm run jcs:fixtures`
  （`tools/gen-jcs-php-fixtures.js`）从一致性向量 001 重建
  `tools/jcs-php-fixtures.json`，插件的跨语言 JCS/Ed25519 测试
  （`tests/jcs-test.php`）在重新生成后不会再过期。
- 论文标题对齐为 *AIFeed: Verifiable Content Permissions and Efficient Agent
  Delivery for the AI Web*；`paper/CHECKLIST.md` 的域名项更新以反映已执行的迁移。

## [0.2.0-draft] — 2026-09-15

### 新增

- MAKO 信任配置：签名 MAKO 文档（`aifeed.mako.v0.2`）、许可绑定（restrict-only）、
  YAML 安全子集、带逐条摘要的增量索引。
- 资源链接（`aifeed.assets`）、索引中的站点摘要与分流字段、WordPress 插件中的
  `/llms.txt`（v2）发布。
- CLI `aifeed mako generate|sign|verify|index|fetch`；SDK `fetchMako`、
  `fetchIndexDelta`、`selectEntries`、`decideUsage`。
- 执行测试装置（S0–S3、四种客户端配置、100 租户规模）与双方节省 [S]；nginx/Caddy
  对等模板；动画 HTML 报告；30 天试点套件。
- 39 个 MAKO 一致性向量；Python 对等；MAKO 模糊测试目标。

## [0.1.0-rc1] — 2026-09-14

### 新增

- AIFeed v0.1：位于 `/.well-known/ai.json` 的签名 manifest、Ed25519 + JCS、DNS 锚点
  （`_aifeed`）、带多签名文档的撤销、离线包。
- 参考 CLI（`keygen|sign|validate|bundle|init|import-openapi`）、24 个 manifest 向量、
  独立 JavaScript 与 Python 验证器、经端到端验证的 WordPress 发布插件
  （0.1.0-rc1，17/17 管理检查通过）。
