# 发布方 AI 指南 — 让 AI 编程智能体端到端安装 AIFeed

<p><a href="publisher-ai-guide.md">English</a> · <a href="publisher-ai-guide.id.md">Bahasa Indonesia</a> · <a href="publisher-ai-guide.zh.md">中文</a></p>

本指南面向**网站所有者**。它提供可直接粘贴的提示词， instruct AI 编程智能体
（VS Code agent mode、Copilot CLI、OpenCode、Codex CLI、Claude Code、HermesAgent
或同等工具）**分析你的网站并自动构建完整的 AIFeed 配置**——从密钥生成到验证通过的
线上 manifest。

流程是 agentic 的：AI 先检查你的站点、技术栈、托管与 DNS 控制，将其分类
（下面的 S / M / L / XL），给出计划待你批准，再分阶段执行。每个阶段以机器可检查的
门禁结束。不基于假设推进任何步骤。

> 爬虫/消费者 companion：[`agent-quickstart.md`](agent-quickstart.md)。
> 命令参考：[`REFERENCE.md`](REFERENCE.md)。轮换操作手册：
> [`rotation.md`](rotation.md)。部署说明：[`deploy-site.md`](deploy-site.md)。

## 0. 基本规则 — 粘贴一次，全程执行

在做任何事之前，把下面这段粘贴给你的 AI 工具，替换 `{占位符}`：

```text
You are setting up AIFeed (signed AI-content permissions) for my website.
Rules you must follow for the whole task:
1. PLAN FIRST. Inspect first, change nothing until I approve the written plan.
   Read-only reconnaissance before any write.
2. Keys never leave this machine. Never paste private key material into chat,
   issues, or files outside the key directory. Key files stay modes 0600.
3. Verify before publish. No file goes live until `validate` reports VERIFIED.
4. Dry-run destructive steps first (`rotate --dry-run`; show DNS edits before applying).
5. Every phase ends with its gate below. If a gate fails: stop, show me the full
   command output, propose exactly one fix, and wait.
6. Prefer existing repo tooling over new code: bin/cli.js, integrations/,
   wp-plugin/, tools/. Do not add dependencies.
7. Report in short steps: what you ran, what it printed, gate pass/fail.
```

各工具的 plan-first 控制（意图相同，各用原生机制）：

| AI 工具 | 如何强制 plan-first |
|---|---|
| OpenCode | 按 Tab 进入 plan mode；`/undo` 撤销；在 permissions 提示中批准 |
| Claude Code | Plan mode（Shift+Tab / `--permission-mode plan`）；Esc 中断；提交前检查 diff |
| VS Code agent mode | 使用 Plan 角色；permissions 设 Manual/assisted；在 Agents window 或 Chat view 检查 |
| Copilot CLI | 保守起步；每批命令运行前确认 |
| Codex CLI | *以厂商文档为准* —— 使用其 approvals/sandbox 标志，应用前确认 |
| HermesAgent | *以厂商文档为准* —— 使用其 plan/approval 机制，应用前确认 |

### 前提（所有类别）

- 运行命令的机器上有 Node.js ≥ 20。
- 有 `aifeed-protocol` 的 checkout（以下所有命令都以仓库根目录的
  `node bin/cli.js …` 运行；全局安装时有同功能的 `aifeed` 快捷命令）。
- 你的域名，以及添加一条 DNS TXT 记录的能力。
- 与你的类别相匹配的主机访问（S 类只需上传，M 类以上需要 SSH/管理权限）。

### 每个提示词通用的约定

- `{DOMAIN}` 你的域名，如 `example.com`。`{SITE_DIR}` 你的构建后静态文件。
  `{KEY_DIR}` 仅本机保存密钥的目录（不提交、不上传）。
- 退出码：`0` = VERIFIED/成功，`1` = UNVERIFIED/失败，`2` = 用法错误。
- 步骤串联时优先 `--json` 输出；其他情况用人可读输出。

## Master 提示词 — 先分析，再构建（复制粘贴）

```text
Set up complete AIFeed for my website {DOMAIN}.
Ground rules: <paste §0 block above>.

PHASE 0 — ANALYZE (read-only; change nothing yet):
1. Fetch https://{DOMAIN}/ and record: response headers (Server, Content-Type),
   generator meta tags, sitemap/robots.txt presence, links to feeds/CMS paths.
2. Determine the stack: static files / WordPress or CMS / SSR app (Next.js etc.)
   / multi-service / CDN-fronted. Note what you could NOT determine.
3. Determine hosting access: upload-only, SSH/admin panel, CI present
   (.github/workflows?), DNS control (can we add TXT records?).
4. Classify the site with the decision table below and state the evidence for
   each signal (quote the header/file you saw).

DECISION TABLE (apply in order; first match wins):
- S (small): static output or shared hosting, upload-only access, single origin.
- M (medium): VPS/SSH or CMS incl. WordPress, one team, single origin (multisite counts as M+).
- L (large): SSR/multi-service, staging + production, CI/CD present, small team.
- XL (giant): CDN/multi-region, compliance or governance needs, on-call/approvals.

Then present: classification + evidence, the exact step list you will run
(commands with my values filled in), files you will create/modify,
and what you need from me (passwords you must NEVER ask for: none —
keys are generated locally by the CLI).
Wait for my approval before PHASE 1. After approval, execute one phase at a
time; each phase ends with its gate; on any gate failure follow rule 5.
```

## Track S — 小型 / 静态 / 共享主机（无 SSH）

目标：签名 manifest + 增量内容上线，端到端验证通过。

使用 Vite、Astro 或 Next.js（`output: 'export'`）？即插即用插件会自动为构建输出签名：
`npm i -D @aifeed/frameworks@next`、`npx aifeed-build keygen --out .aifeed`，然后在框架
配置中加入 `aifeed({ domain })`（Next.js：`"postbuild": "aifeed-next --domain …"`）。
本轨道其余步骤不变。

**PS-1 — 密钥（仅本机）。** 提示词：

```text
Generate an Ed25519 keypair for {DOMAIN} into {KEY_DIR} (do not overwrite
without asking). Show me the fingerprint line only — never print the private key.
Gate: {KEY_DIR}/aifeed-private.pem (0600) and {KEY_DIR}/aifeed-public.txt exist.
```

AI 运行的命令：

```bash
node bin/cli.js keygen --out {KEY_DIR}
```

预期：打印路径；公钥文件包含 `ed25519:…` 值 + 指纹。
门禁：两个文件存在；私钥文件仅所有者可读。

**PS-2 — 构建。** 提示词：

```text
Build AIFeed for the static files in {SITE_DIR} for domain {DOMAIN} using the key
in {KEY_DIR}/aifeed-private.pem, profile "both", with llms.txt. List every file
created under .well-known/ and the per-page outputs. Do not deploy anything yet.
Gate: .well-known/ai.json exists in the build output.
```

命令：

```bash
node bin/cli.js site build {SITE_DIR} --domain {DOMAIN} --key {KEY_DIR}/aifeed-private.pem --profile both --llms
```

**PS-3 — 本地验证。** 提示词：

```text
Validate the built manifest directory ({SITE_DIR}/.well-known, where ai.json and
ai-signature.json sit side by side) for {DOMAIN} and show result + any
errors/warnings in JSON. Gate: result VERIFIED, errors [].
```

命令：

```bash
node bin/cli.js validate {SITE_DIR}/.well-known --domain {DOMAIN} --json
```

（`validate DIR` 直接读取 DIR 内的 `ai.json`，因此应指向 `.well-known`，
而不是站点根目录。）

**PS-4 — 发布 + DNS（AI 协助的人工步骤）。** 提示词：

```text
The build is VERIFIED. Now: (1) print the exact files to upload preserving paths
(.well-known/ai.json, .well-known/ai-signature.json, index + pages);
(2) print the exact DNS TXT record to create at _aifeed.{DOMAIN} using values
from the built manifest and key (format: v=aifeed1; pk=<ed25519:…>;
fp=<sha256:…>; manifest=https://{DOMAIN}/.well-known/ai.json);
(3) wait — I will upload and add the record, then say CONTINUE.
```

**PS-5 — 线上验证（在你说 CONTINUE 之后）。** 提示词：

```text
Verify https://{DOMAIN} live: manifest reachable, signature valid, DNS anchor
matches. Report VERIFIED + dns_anchored true, or stop with the full output.
Gate: result VERIFIED and dns_anchored true.
```

AI 运行的命令：

```bash
node bin/cli.js validate {DOMAIN} --json
```

PS-5 门禁通过时，Track S 完成。

## Track M — 中型 / VPS / CMS / WordPress

目标：由线上技术栈提供 AIFeed，按计划重签，强制锚点。

**PM-1 — 检测（延续阶段 0）。** 提示词：

```text
Inspect the server: is this WordPress (wp-admin/wp-json present?) or another CMS,
or a VPS with nginx/Caddy/Apache/Node? Check for scheduled tasks/cron and for an
existing AIFeed manifest. Report stack + evidence, then propose path A (plugin)
or path B (adapter) — do not install anything yet.
```

**PM-2A — WordPress 路径。** 提示词：

```text
Install and configure the plugin in wp-plugin/ on this WordPress site for
{DOMAIN} following wp-plugin/README.md exactly (keygen in admin, profiles,
dual-stack). Then fetch /.well-known/ai.json and validate it.
Gate: validate reports VERIFIED for {DOMAIN}.
```

参考（不要重复）：[`../wp-plugin/README.md`](../wp-plugin/README.md)。

**PM-2B — 适配器路径。** 提示词：

```text
Wire the matching adapter from integrations/ for this stack
(nginx/caddy/apache/node/nextjs/php/python/go per integrations/README.md):
build the site output if static, otherwise configure content negotiation +
signature headers per the adapter's file. Show the exact config diff.
Apply only after my approval. Gate: manifest 目录（ai.json + ai-signature.json
并排——site 构建产物即 {SITE_DIR}/.well-known）的 validate 报告 VERIFIED。
```

参考：[`../integrations/README.md`](../integrations/README.md)。

**PM-3 — 定时重签。** 提示词：

```text
Set up unattended re-signing (monthly cron or equivalent for this host) that
re-runs sign on the manifest directory and reloads the server only if
validate passes. Print the exact schedule entry. Never store keys outside
{KEY_DIR} or the host secret store.
```

**PM-4 — 强制线上验证。** 提示词：

```text
Verify {DOMAIN} live with DNS anchor required and report errors in JSON.
Gate: result VERIFIED and dns_anchored true.
```

命令：

```bash
node bin/cli.js validate {DOMAIN} --require-dns-anchor --json
```

PM-4 门禁通过且重签计划已安装时，Track M 完成。

## Track L — 大型 / 多服务 / SSR / 团队

目标：CI 门禁、分阶段发布的流水线，带监控的 AIFeed。

**PL-1 — CI 门禁。** 提示词：

```text
Add the AIFeed GitHub Action from integrations/github-action/aifeed.yml to this
repo so every change to web content runs sign + validate and blocks merge on
anything but VERIFIED. Show the workflow diff; do not push until I approve.
Gate: workflow file present and references the repo's verify steps.
```

**PL-2 — 预发布 → 生产。** 提示词：

```text
Deploy the verified build to staging first, run validate against the staging
host, then promote the identical artifacts to production and validate {DOMAIN}.
Gate: both validations VERIFIED with zero errors.
```

**PL-3 — 增量 + 监控。** 提示词：

```text
Confirm the delta index is published and fresh (index + .sig), then set up
JSONL access logging in the pilot format and run node tools/pilot-report.js
--baseline baseline.jsonl --pilot pilot.jsonl [--out report.md].
Report the savings table. Gate: report generated, no parse errors.
```

**PL-4 — 试点指向。** 提示词：

```text
Summarize readiness for a 30-day pilot per docs in pilot/ and list the three
riskiest unknowns with owners. No action beyond the report.
```

PL-2 门禁在生产通过且 PL-3 产出报告时，Track L 完成。

## Track XL — 巨型 / CDN / 多区域 / 企业

目标：受执行、有治理、可审计的 AIFeed，密钥仪式规范。

**PX-1 — 执行设计。** 提示词：

```text
Design edge enforcement for {DOMAIN} (deny training crawlers, rate-limit
non-compliant ones, serve compliant clients signed content), referencing the
strict demo behaviour and integrations/ adapters. Produce the design + config
diff. Apply only after approval from the on-call owner I name.
Gate: design reviewed; nothing applied yet.
```

**PX-2 — 治理密钥 + 轮换。** 提示词：

```text
Inventory signing and governance keys, confirm backup and break-glass
procedure, then rehearse rotation with --dry-run (docs/rotation.md). Only on
explicit approval, run the real ceremony. Gate: dry-run clean; after ceremony,
validate VERIFIED with dns_anchored true.
```

命令：

```bash
node bin/cli.js rotate --dir {SITE_DIR} --dry-run --json
node bin/cli.js rotate --dir {SITE_DIR} --window 72
```

完整仪式：[`rotation.md`](rotation.md)。

**PX-3 — 注册表 + 监控。** 提示词：

```text
Wire revocation checking (--revocation-url, --governance-key) into validation,
and set up recurring live verification equivalent to npm run verify:live plus
log monitoring. Gate: live check green two runs in a row.
```

命令：

```bash
node bin/cli.js validate {DOMAIN} --revocation-url https://aifeed.md/revoke/v1/{DOMAIN}.json --json
npm run verify:live
```

**PX-4 — 合规证据。** 提示词：

```text
Collect the evidence pack: manifest + signatures, validation JSON outputs,
rotation/revocation records, benchmark numbers from committed artifacts only
(never invent numbers), each claim labeled per paper/CLAIMS.md conventions.
Gate: pack complete, every number traceable to an artifact.
```

PX-3 门禁连续两次通过且证据包归档时，Track XL 完成。

## 资源 — 图片、PDF 与下载

非 HTML 文件（图片、视频、音频、PDF、压缩包，以及任何 `download` 链接）按页面声明在
签名 frontmatter 的 `aifeed.assets` 中：

```yaml
aifeed:
  assets:
    - url: /uploads/sampul.webp
      type: image
      mime: image/webp
      size: 48213
      sha-256: "9GyqhORj/l1nnxteUlVZjHyf83us13ziRunVmf97e6M="
    - url: /laporan.pdf
      type: document
      mime: application/pdf
```

- **仅为引用** — 资源绝不内联；是否下载由代理决定。
- **相同许可** — 获取资源遵循页面的 usage 与限额（`retrieval`、`commercial_use` 等），
  边缘模板同样覆盖资源路径。
- **完整性** — 存在 `size` 或 `sha-256` 时，用 `sdk.verifyAsset(bytes, asset)` 在使用前
  验证下载字节。`aifeed site build`（与 Studio）会按扩展名填写 `mime`，并哈希源目录中的
  本地文件（≤16 MiB）；抓取或远程资源在代理下载前没有哈希。
- **预取分流** — 索引条目携带 `assets` 数量，代理可在下载任何内容前判断页面是否值得抓取。

## 发布者徽章

向访客和智能体展示源站已签名：

```html
<a href="https://aifeed.md"><img src="https://aifeed.md/badge.svg" alt="verified by AIFeed"></a>
```

Markdown 版本：

```md
[![verified by AIFeed](https://aifeed.md/badge.svg)](https://aifeed.md)
```

请链接徽章而不要复制，以便后续更新自动生效。

## 更喜欢应用？使用 AIFeed Studio

如果你更愿意点击而不是输入提示词，本仓库提供了一个完成同样工作的本地应用：
`npm run studio` 在 <http://127.0.0.1:7777> 提供零依赖 UI。创建项目、指向本地 HTML
目录或抓取线上站点、编辑 restrict-only 策略（内置 news/ecommerce 预设）、增量构建、
验证并导出——文件夹或 `.tar.gz`、DNS TXT 记录，以及针对你的技术栈的适配器提示。
密钥保留在你的机器上。见 [`../studio/README.zh.md`](../studio/README.zh.md)。

## 附录 A — AI 工具能力矩阵

以下事实截至 2026-09-16 已对照厂商官方文档核实，标有*以厂商文档为准*的格子除外
（使用前请确认）。

| 能力 | OpenCode | Claude Code | VS Code agent mode | Copilot CLI | Codex CLI | HermesAgent |
|---|---|---|---|---|---|---|
| 运行终端命令 | 是（permissions 门禁） | 是（permissions 门禁） | 是（approval 门禁） | 是 | *以厂商文档为准* | *以厂商文档为准* |
| 编辑/创建文件 | 是（+ `/undo`） | 是（diff 检查） | 是（在 Chat/Agents window 检查） | 是 | *以厂商文档为准* | *以厂商文档为准* |
| 执行前计划模式 | 是（Tab plan mode） | 是（plan mode） | 是（Plan 角色） | 保守起步、按批确认 | *以厂商文档为准* | *以厂商文档为准* |
| 项目记忆/指令 | 自动读取 AGENTS.md | 自动读取 CLAUDE.md | custom instructions / prompt files | *以厂商文档为准* | *以厂商文档为准* | *以厂商文档为准* |
| 长任务/后台运行 | *以厂商文档为准* | 是（background agents） | 是（Agents window / cloud） | *以厂商文档为准* | *以厂商文档为准* | *以厂商文档为准* |
| 中断失控进程 | Esc / stop | Esc 中断 | stop 按钮 | *以厂商文档为准* | *以厂商文档为准* | *以厂商文档为准* |

使用本表而不带偏见的规则：绝不宣称某个工具"最好"；单元格未核实时在计划中明说；
若用户工具缺少某能力（如无终端），AI 必须调整 track（例如打印确切命令由人工运行），
而不是失败。

## 附录 B — 故障排查（真实错误，真实修复）

门禁失败时，把完整 JSON 输出粘回给 AI，并说："Gate failed. Diagnose from the errors
array only, propose exactly one fix, wait for approval." 常见原因：

| 症状 | 可能原因 | 修复提示词 |
|---|---|---|
| `result UNVERIFIED`，errors 含 `dns_mismatch` | TXT 记录缺失/错误，或指向旧密钥 | "Show me the live TXT vs the manifest key fingerprint, then print the corrected record — do not apply DNS changes yourself." |
| `schema_violation` | manifest 被手工编辑或脚手架过期 | "Regenerate via init/site build instead of hand-editing, re-sign, re-validate." |
| `bad_signature` | 签名后 manifest 被改动，或密钥不对 | "Re-run sign with the key matching identity.public_key, then validate." |
| `upgrade_required` | v0.1 manifest 却用了 v0.2 功能（如轮换） | "Re-issue the manifest as v0.2 and re-sign." |
| `rotation_denied` / `key_revoked` | 过期重叠期或所用密钥已被撤销 | "Follow docs/rotation.md: complete the cutover or publish the new key, then re-validate." |
| strict 风格边缘返回 HTTP 403/429 | 训练爬虫被拦截 / 被限流，符合设计 | "Confirm the UA and Accept headers: compliant clients must negotiate markdown; this is enforcement working, not an error." |
| `revocation_unavailable` / 检查被跳过 | 未给 `--revocation-url` 或注册表不可达 | "Re-run with --revocation-url and --governance-key; if unreachable, retry and report." |
| 退出码 2 | 用法错误（flag/路径不对） | "Reprint the exact command from bin/cli.js --help and fix the invocation." |

## 链接

- 消费者侧：[`agent-quickstart.md`](agent-quickstart.md)
- 命令参考：[`REFERENCE.md`](REFERENCE.md)
- 轮换操作手册：[`rotation.md`](rotation.md)
- 部署 + DNS：[`deploy-site.md`](deploy-site.md)
- 平台适配器：[`../integrations/README.md`](../integrations/README.md)
- WordPress：[`../wp-plugin/README.md`](../wp-plugin/README.md)
- 规范：[`../spec/en/`](../spec/en/)（正本；镜像 `../spec/id/`、`../spec/zh/`）
