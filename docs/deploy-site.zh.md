# 在 `aifeed.md` 上部署 AIFeed 站点

<p><a href="deploy-site.md">English</a> · <a href="deploy-site.id.md">Bahasa Indonesia</a> · <a href="deploy-site.zh.md">中文</a></p>

站点是 `site/` 中的纯静态包——落地页、标志、流程动画、执行报告、印尼语说明，以及
生成的演示源站。无构建框架、无运行时依赖。

状态 2026-09-16：运行于 **Cloudflare Pages**（项目名 `aifeed`）。apex `aifeed.md`、
`www.aifeed.md`（重定向）与七个演示子域名都是该项目的自定义域；DNS 与 TLS 由
Cloudflare 管理（`always_use_https` 开启）。旧的 GitHub Pages 流程
（workflow + `site/CNAME`）已移除。

## 本地部署（每次改动使用）

```bash
npm run verify   # 门禁：构建报告 + 站点 + 演示并验证一切
npx wrangler@latest pages deploy site --project-name aifeed --branch main --commit-dirty=true
```

`--branch main` 是必需的：否则部署会落到预览别名而非生产。环境中必须设置
`CLOUDFLARE_API_TOKEN`（与 `CLOUDFLARE_ACCOUNT_ID`）；切勿提交它们。

## CI 部署（配置密钥后自动生效）

`.github/workflows/pages-cf.yml` 在每次推送到 `main` 时运行：`render-html` →
`build-site` → `gen-demos --check` → `wrangler pages deploy`。在仓库密钥
`CLOUDFLARE_API_TOKEN` 与 `CLOUDFLARE_ACCOUNT_ID` 添加之前（Settings → Secrets and
variables → Actions），它会自动跳过。

## DNS

所有记录都在 Cloudflare（`etienne.ns.cloudflare.com`、`leia.ns.cloudflare.com`）：

- `aifeed.md` 与 `www.aifeed.md` → Cloudflare Pages 自定义域（自动 TLS）。
- `demo`、`news`、`shop`、`gov`、`strict`、`revoked`、`verify` 子域名 → 同一个
  Pages 项目；`functions/[[path]].js` 按主机路由。
- `_aifeed.<domain>` TXT 记录锚定每个 manifest 的签名密钥（AIFeed v0.1 §6）；
  演示锚点列于 `docs/demos.md`。

## 邮件

`contact@aifeed.md` 通过 Cloudflare Email Routing 路由；保持地址与
`paper/main.tex`、`paper/main.md`、`SECURITY.md` 同步。
