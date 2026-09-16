# 发布与升级清单

<p><a href="release.md">English</a> · <a href="release.id.md">Bahasa Indonesia</a> · <a href="release.zh.md">中文</a></p>

一页搞定发布、SDK 发布、站点部署与消费者同步。让流程保持无聊：一次改动内升版本，
用 `npm run check:consistency` 证明，用 `npm run verify` 把关。

## 版本位置（一起升）

| 文件 | 改什么 |
|---|---|
| `package.json` | `version`（发布号，如 `1.0.0-draft` → `1.0.0`） |
| `packages/aifeed-verify/package.json` | `version`（核心相同；允许预发布后缀，如 `1.0.0-draft.2`） |
| `wp-plugin/aifeed.php` | 头部 `Version:` 与 `define('AIFEED_VERSION', …)` |
| `wp-plugin/readme.txt` | `Stable tag:`（+ 一条 changelog） |
| `site/index.html` | 页脚版本徽章 `v<version>` |
| `CHANGELOG.md` | 新增顶部章节 `## [<version>] — YYYY-MM-DD` |
| `SECURITY.md` | 若发布线变化，更新受支持版本行 |

线格式版本相互独立：manifest `0.1`/`0.2`、AIFeed Markdown `1.0`、MAKO `0.2`。
除非线格式真的改变，否则不要重新编号。

## 步骤

```bash
npm run verify            # 任何操作前必须全绿
# 升级上述文件 + 写 changelog
npm run check:consistency # 证明版本一致
npm run verify            # 升版后再跑一次
git add -A && git commit -m "release: <version>"
git tag -a v<version> -m "AIFeed <version>"
git push origin main --tags
```

部署：`.github/workflows/pages-cf.yml` 在每次推送到 `main` 时重建 `site/`（报告、落地页、
演示源站），并与 `functions/` 一起部署到 Cloudflare Pages，服务 `aifeed.md`、
`www.aifeed.md` 与七个演示子域名。它需要仓库密钥 `CLOUDFLARE_API_TOKEN` 与
`CLOUDFLARE_ACCOUNT_ID`；缺失时会跳过。本地等价命令：
`npx wrangler@latest pages deploy site --project-name aifeed --branch main`。之后检查线上
页面；演示的 DNS 锚点列于 `docs/demos.md`。

## 发布 SDK

```bash
# 非交互：带 "Bypass 2FA" 的细粒度 token（或 Classic Automation token）
cd packages/aifeed-verify
npm publish --access public --tag next --//registry.npmjs.org/:_authToken=$NPM_TOKEN
npm dist-tag add @aifeed/verify@<version> latest --//registry.npmjs.org/:_authToken=$NPM_TOKEN
```

- 预发布版本**必须**显式 `--tag`（`next`）；稳定版默认 `latest`。
- npm registry 异步处理发布（HTTP `202`），并缓存读取几分钟。用写端点验证：
  `curl -s "https://registry.npmjs.org/@aifeed%2Fverify?write=true" | node -e "…"`
  或 `npm view @aifeed/verify version dist-tags`。
- 绝不把 token 粘贴进文件、提交或 issue；只放在环境变量里。

## WordPress 插件

插件从本仓库的 `wp-plugin/` 发布。面向 WordPress.org 发布时：升头部/`Stable tag`，
在 `readme.txt` 加 changelog 段落，运行 PHP 套件（`php -l`、`php tests/jcs-test.php`、
`php tests/mako-test.php`），然后打 tag。

## 论文（当发布改变主张时）

1. 编辑 `paper/main.tex`，在 `paper/main.md` 同步正文。
2. 若摘要变化，更新 `paper/ARXIV-SUBMISSION.md`。
3. `npm run paper:check`；重建 PDF（Tectonic）与 arXiv 包：
   `cd paper && tar -czf aifeed-arxiv.tar.gz main.tex refs.bib 00README.json`。
4. 提交新 arXiv 版本前遵循 `paper/CHECKLIST.md`。

## 升级消费者

- manifest 验证接受 `0.1.x` 与 `0.2.x`；其他版本报告 `upgrade_required`。线格式移动时
  保留旧版读取支持。
- SDK 发布后在临时目录对已发布包做冒烟测试：
  `npm install @aifeed/verify@<version>` 并按 `packages/aifeed-verify/README.md` 跑快速上手。
- 站点是消费者引用的产物：发布公告前确认新版本徽章与 changelog 已上线。
