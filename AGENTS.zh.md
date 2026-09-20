# AGENTS.md — 在本仓库中工作

<p><a href="AGENTS.md">English</a> · <a href="AGENTS.id.md">Bahasa Indonesia</a> · <a href="AGENTS.zh.md">中文</a></p>

面向维护、更新或升级 AIFeed 的 AI 编码智能体（以及人类）的说明。请先读本文；
它是保持仓库可复现的契约。

## 本仓库是什么

面向 **AIFeed 协议**（面向 AI 智能体的签名内容许可）的零依赖 monorepo：规范、
JSON Schema、参考实现（CLI + JS SDK + Python 验证器）、84 个一致性向量、服务器适配器、
WordPress 发布插件、基准、网站与论文。

## 黄金规则

1. **每次提交前运行 `npm run verify`。** 它是唯一门禁：语法检查、版本/一致性检查、
   JS + Python 套件、全部向量检查、SDK 同步、论文检查与站点构建。不要提交红灯。
2. **绝不手工编辑生成文件。** 改源文件，然后重新生成：

   | 生成产物 | 事实来源 | 重新生成 | 校验 |
   |---|---|---|---|
   | `packages/aifeed-verify/{lib,schema,index.js,index.d.ts}` | `lib/`、`schema/`（+ 手写 SDK `index.js`） | `npm run build:sdk` | `npm run sdk:check` |
   | `conformance/vectors/**`（34） | `tools/gen-vectors.js` | `npm run vectors` | `npm run vectors:check` |
   | `conformance/mako/**`（39） | `tools/gen-mako-vectors.js` | `npm run mako:vectors` | `npm run mako:vectors:check` |
   | `conformance/aimd/**`（11） | `tools/gen-aimd-vectors.js` | `npm run aimd:vectors` | `npm run aimd:vectors:check` |
   | `docs/process.html`、`benchmarks/enforcement-report.html` | `tools/render-html.js`（+ `benchmarks/*.json`） | `npm run render:html` | `npm run verify` |
   | `site/{logo.svg,process.html,enforcement-report.html,penjelasan.html,aifeed-preprint.pdf}` | 根目录文件 + `paper/` | `npm run render:html && npm run build:site` | `npm run verify` |
   | `site/demos/**`、apex `site/.well-known/**`、`site/revoke/**` | `demos/sites.js` + `demos/keys.js` + `tools/gen-demos.js` | `npm run demos` | `npm run demos:check`（在 `verify` 内） |
   | `tools/jcs-php-fixtures.json` | `tools/gen-jcs-php-fixtures.js` | `npm run jcs:fixtures` | 插件 `tests/jcs-test.php` |
   | `paper/aifeed-arxiv.tar.gz` | `paper/main.tex`、`refs.bib`、`00README.json` | `tar -czf aifeed-arxiv.tar.gz main.tex refs.bib 00README.json`（在 `paper/`） | 解包并阅读 `00README.json` |

3. **绝不添加运行时依赖。** 每个 `package.json` 的 `dependencies` 与 `devDependencies`
   保持为空；`npm run check:consistency` 会强制检查。工具只用 Node 标准库；Python 代码
   只用标准库。
4. **规范字节神圣不可侵犯。** 签名覆盖 JCS 规范化 JSON 与原始文件字节。不要重排夹具、
   改行尾，或"清理" `conformance/`、`examples/`、已签名 `site/.well-known` 文件里的空白。
   `.gitattributes` 强制 LF；保留它。
5. **规范以英文为正本。** 编辑 `spec/en/` 后，在 `spec/id/` 与 `spec/zh/` 镜像同一章节
   （信息性译文）。保持标题结构一致。
6. **每个事实只有一个来源。** 测量数字位于 `benchmarks/*.json` 与 `paper/CLAIMS.md`；
   页面与论文从那里渲染，绝不杜撰数字。
7. **事实主张必须带证据标签**（[F] 事实、[M] 可信、[E] 模型/估计、[S] 实测模拟、
   [H] 法律审查）。见 `paper/CLAIMS.md`。
8. **版本：** 发布号位于 `package.json`、`packages/aifeed-verify/package.json`、
   `wp-plugin/aifeed.php`（头部 + `AIFEED_VERSION`）、`wp-plugin/readme.txt`
   （Stable tag）、`site/index.html`（徽章）与 `CHANGELOG.md` 顶部章节。一次变更中全部
   一起升；`npm run check:consistency` 会证明一致。线格式版本（manifest `0.1`/`0.2`、
   AIFeed Markdown `1.0`、MAKO `0.2`）相互独立——不要随意重新编号。发布步骤：
   `docs/release.md`。

## 命令

```bash
npm run verify            # 以下全部，一个门禁
npm run lint:syntax       # 解析检查所有 .js 文件
npm run check:consistency # 版本、依赖、密钥、规范镜像、脚本目标
npm test                  # Node 套件（233 项测试）
npm run test:py           # 独立 Python 验证器（44 项测试）
npm run bench:mako        # 重新生成 benchmarks/mako-*.json + 报告
npm run bench:enforcement # 重新生成 benchmarks/enforcement-*.json|md
npm run fuzz:mako -- --iterations 3000   # 解析器模糊测试（固定种子）
npm run demos             # 生成线上演示源站 + apex 产物
npm run demos:check       # 生成后验证每个演示 manifest/撤销
npm run verify:live       # 对已部署演示做线上一致性检查（联网）
npm run studio            # 本地发布方应用，http://127.0.0.1:7777（零依赖 UI）
node bin/cli.js --help    # CLI 界面
```

## 仓库地图

| 路径 | 负责 |
|---|---|
| `spec/{en,id,zh}/` | 规范性规范（manifest v0.1/v0.2、AIFeed Markdown v1.0） |
| `schema/` | 验证器与 SDK 使用的 JSON Schema |
| `lib/` | 参考实现：严格解析器、JCS、Ed25519、验证、MAKO/AIMD、增量索引、离线包、撤销 |
| `bin/cli.js` | CLI 入口（`keygen`、`sign`、`rotate`、`validate`、`bundle`、`aimd\|mako …`、`site build`） |
| `packages/aifeed-verify/` | 已发布 SDK（`@aifeed/verify`）；`index.js`/`index.d.ts` 手写，`lib/`+`schema/` 为生成副本 |
| `clients/python/` | 独立验证器 + 测试（差分一致性） |
| `conformance/` | 向量：34 manifest、39 MAKO、11 AIFeed Markdown、撤销 + 离线包 |
| `integrations/` | 发布方适配器：nginx、Caddy、Apache、Node、Next.js、PHP、Python ASGI、Go、GitHub Action |
| `wp-plugin/` | WordPress 发布插件（PHP；自带 `tests/`） |
| `tools/` | 生成器、渲染器、基准、模糊测试、检查器——零依赖 |
| `demos/` | 演示源站内容（`sites.js`）与公开演示密钥（`keys.js`） |
| `functions/` | Cloudflare Pages Function：主机路由、CORS、`strict` 执行 |
| `docs/` | `architecture.md`、`release.md`、`agent-quickstart.md`、`rotation.md`、`deploy-site.md`、`namespace-setup.md` |
| `studio/` | 本地发布方应用：项目工作区、策略编辑器（restrict-only）、增量构建/验证/导出、三语 UI |
| `site/` | 网站源：`index.html`（手写）；其他文件为生成产物 |
| `paper/` | 预印本：`main.tex`（源）、`main.md`（镜像）、`refs.bib`、`CLAIMS.md`、`CHECKLIST.md`、打包 |
| `.github/workflows/pages-cf.yml` | CI：`render-html` → `build-site` → 部署 Cloudflare Pages（无 CF 密钥时跳过） |

## 常用配方

- **新增一致性向量：** 编辑 `tools/` 中相关生成器，运行其 `…:vectors` 脚本，确认
  `…:vectors:check` 与 JS/Python 套件保持绿。生成器会确定性地覆盖整个目录——绝不手工
  修补生成文件。AIMD/MAKO 内容变更的签名会从生成器内置密钥自动重新生成。
- **修改验证规则：** `lib/validate.js` + `schema/*.json` + 两个验证器
  （`clients/python/`），然后向量。跨语言对等是验收测试。
- **新增 CLI 命令：** `bin/cli.js`（+ 帮助文本）、`tests/cli*.test.js` 中的测试，若面向
  用户则在 `REFERENCE.md`/`README.md` 加一行。
- **改动 SDK 界面：** 手写文件是 `packages/aifeed-verify/index.js` 与 `index.d.ts`。
  绝不编辑 `packages/aifeed-verify/lib/*`（生成）。运行
  `npm run build:sdk && npm run sdk:check`。
- **修改网站：** `site/index.html` 与根目录 `penjelasan-aifeed.html` 是源文件；
  `docs/process.html`/`benchmarks/enforcement-report.html` 来自 `tools/render-html.js`。
  运行 `npm run verify`。网站上的 GitHub 链接必须包含仓库名：
  `https://github.com/denyn1/aifeed-protocol/...`。
- **新增或修改演示源站：** 编辑 `demos/sites.js`（页面、通过 `permissions` 的政策覆盖、
  主题），运行 `npm run demos:check`。签名密钥是确定性的且有意公开
  （`demos/keys.js`，仅演示）。`functions/` 中的 Pages Function 把 `<sub>.aifeed.md`
  路由到 `site/demos/<sub>/`；部署与 DNS 锚点记录在 `docs/demos.md` 与
  `docs/deploy-site.md`。
- **修改论文：** `paper/main.tex` 是源；在 `paper/main.md` 镜像正文编辑；抽象变化时更新
  `paper/ARXIV-SUBMISSION.md`；`npm run paper:check`；重建 arXiv 包。
- **发布/升级：** 按 `docs/release.md`。

## 陷阱（血泪教训）

- Windows PowerShell：这里的 `grep`/`rg` 可能不可用——改用 `Select-String`/`git grep`；
  有 workdir 选项时不要在命令里 `cd`。
- 生成产物有意被 `.gitignore`；CI 会重新生成。若脚本报告 "missing sources"，先运行
  生成器。
- 源缺失时 `tools/build-site.js` 会大声失败——这是有意的；修构建，不要消音。
- `tools/replace-domain.js` 会重写全仓库 URL；其 `SKIP_FILES` 是仓库相对路径
  （如 `docs/namespace-setup.md`）。先跑 dry-run。
- 预发布版本的 npm 发布需要 `--tag`（如 `--tag next`）；npm 注册表可能要几分钟才显示
  新版本——用 `https://registry.npmjs.org/@aifeed%2Fverify?write=true` 验证。
- GitHub 会限流频繁的链接检查（429）；改用 GitHub API 确认，不要循环重试。
- 移动/删除 `paper/*.pdf` 前关闭 PDF 阅读器（Windows 文件锁）。

## 风格

与既有代码一致：CommonJS `require`、2 空格缩进、除非逻辑不直观否则不加注释、零依赖、
确定性输出，测试紧挨它所保护的行为。文件保持小而单一；优先新增 `tools/` 脚本，
而不是引入框架。
