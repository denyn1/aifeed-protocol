# 命名空间配置（GitHub、npm、域名）

<p><a href="namespace-setup.md">English</a> · <a href="namespace-setup.id.md">Bahasa Indonesia</a> · <a href="namespace-setup.zh.md">中文</a></p>

执行本清单一次，然后把结果记录到 `paper/CHECKLIST.md`。

## 1. GitHub 组织 — `aifeed`（2026-09-15 确认可用）

1. 用应当拥有该组织的 GitHub 账号登录。
2. 创建组织：<https://github.com/organizations/plan> → 选择 **Free**。
   - 组织名：`aifeed`（已核实可用：`users/aifeed` 与 `orgs/aifeed` 在 2026-09-15
     均返回 404）。
3. 为所有成员启用 2FA（GitHub 要求）并至少添加一种恢复方式。
4. 创建仓库：`aifeed/aifeed-protocol`（先私有，预印本投稿后转公开）。
5. 要应用的设置：
   - 默认分支 `main`，允许 squash-merge，合并后删除分支。
   - 分支保护：合并前要求 pull request + CI 通过。
   - 安全：启用私有漏洞报告（与 `SECURITY.md` 一致）。
   - 插件在本 monorepo 的 `wp-plugin/` 下发布；单独的 `aifeed/aifeed-wp-plugin`
     仓库可选。
6. 推送本地仓库（已用 `.gitignore` 初始化，尚无提交）：

   ```bash
   cd D:\Software\aifeed.org
   git add .
   git commit -m "Initial public snapshot: AIFeed protocol, tools, integrations, paper draft"
   git remote add origin https://github.com/aifeed/aifeed-protocol.git
   git push -u origin main
   ```

   （准备好再 commit/push；密钥已被 `.gitignore` 排除。）本地目录仍名为 `aifeed.org`；
   改成 `aifeed.md` 是可选的，不影响 git 跟踪的任何内容。

## 2. npm scope — `@aifeed`（**2026-09-16 已发布**）

1. 创建 npm 账号（或使用现有账号）并启用 2FA。✅ 账号 `denynorman`。
2. 创建组织 scope：npm 网站 → **Organizations** → **Create organization** → 名称
   `aifeed`，套餐 **Free (unlimited public packages)**。✅
3. 准备好后发布：

   ```bash
   cd packages/aifeed-verify
   npm publish --access public
   ```

   `packages/aifeed-verify/package.json` 已声明
   `"publishConfig": { "access": "public" }`、`files`、`exports` 以及
   `repository`/`homepage`/`bugs` 元数据。

   **已发布：** `@aifeed/verify@1.0.0-draft`（2026-09-16），同日更新为
   **`1.0.0-draft.1`**（TLS/私有抓取选项转发）；dist-tag `latest` 与 `next` 均指向
   最新版本。用 `npm view @aifeed/verify version dist-tags` 验证；注册表主页为
   <https://www.npmjs.com/package/@aifeed/verify>。
4. 若以后要以 `@aifeed/protocol` 发布协议包，把 scope 加到其 `package.json`
   （目前有意设为 `"private": true`）。

   注意：发布 token 属于机密——非交互发布请使用带 *Bypass 2FA* 的细粒度 token
   （或 Classic **Automation** token），只在本地保存，绝不粘贴到聊天或 issue；
   若曾泄露请重新生成 2FA 恢复码。

## 3. 规范域名 — 调研结果（2026-09-15）与建议

`aifeed.org` 由无关组织（"AI-FEED"，一家食品慈善机构）持有，绝不能用于规范 URL——
这就是迁移到 `aifeed.md` 强制进行的原因。注册调研（RDAP + DNS NS 交叉核对，2026-09-15）：

| 域名 | 状态 | 备注 |
|---|---|---|
| `aifeed.org` | 已被占用 | AI-FEED 食品慈善机构（美国）——迁移强制进行的原因 |
| `aifeed.com` | 已被占用 | Afternic 停放（可能在售） |
| `aifeed.dev` | 已被占用 | AI 新闻聚合站 |
| `aifeed.app` | 已被占用 | "AiFeed — Your AI News Feed" |
| `aifeed.net` | 已被占用 | 可解析（TLS 错误） |
| `aifeed.io` | 已被占用 | Afternic 停放；RDAP bootstrap 假阴性 |
| `aifeed.co` | 已被占用 | GoDaddy 停放 |
| `aifeed.eu`、`.news`、`.site`、`.space`、`.info` | 已被占用 | 停放/活跃 |
| **`aifeed.md`** | **2026-09-16 已购买** | 规范域名；9 个字符；可读作 "AIFeed Markdown" |
| **`aifeedprotocol.org`** | **很可能可用** | RDAP 404 + 无 NS；标准中立 `.org`（对照 `rslstandard.org`） |
| **`aifeed.id`** | **很可能可用** | RDAP 404 + 无 NS；印尼 TLD，本地影响力 |
| `aifeed.tech`、`.tools`、`.software`、`.blog`、`.pro`、`.us`、`.website`、`.network`、`.systems`、`.zone`、`.chat` | 很可能可用 | 品牌较弱 |

### 决定与状态

**规范域名：`aifeed.md` —— 由维护者于 2026-09-16 购买。** DNS 在 2026-09-16 仍为空
（无 NS/A/TXT 记录）；在公开或投稿使用前完成配置。URL 迁移已于 2026-09-15 执行，
以立即移除第三方 `aifeed.org` 引用：

```bash
node tools/replace-domain.js --domain aifeed.md          # dry-run（列出出现位置）
node tools/replace-domain.js --domain aifeed.md --apply  # 已于 2026-09-15 执行
```

结果：91 个文件中共替换 168 处普通 + 4 处转义出现；签名夹具、manifest 向量与 JCS
跨语言夹具已重新生成；完整回归通过（JS 195/195、Python 44/44、向量 25+39+11、
SDK 同步、WordPress E2E）。

### DNS 记录

域名服务器为 Cloudflare（`etienne.ns.cloudflare.com`、`leia.ns.cloudflare.com`），
**Cloudflare Pages 是托管路径**：`aifeed.md`（加 `www` 与七个演示子域名）是 Pages
项目的自定义域，DNS 与 TLS 由 Cloudflare 管理。部署步骤见 `docs/deploy-site.md`。

剩余手动事项：

1. **邮件** —— `contact@aifeed.md` 通过 Cloudflare Email Routing 路由；变更时同步
   `paper/main.tex` / `paper/main.md` 与 `SECURITY.md`。
2. **`_aifeed` TXT 锚点** —— 已为 apex 与全部七个演示源站发布（AIFeed v0.1 §6）；
   记录列于 `docs/demos.md`。

如需要，`aifeedprotocol.org` / `aifeed.id` 仍可作为可选的别名（重定向）。
