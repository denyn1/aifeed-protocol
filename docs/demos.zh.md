# 线上演示源站

<p><a href="demos.md">English</a> · <a href="demos.id.md">Bahasa Indonesia</a> · <a href="demos.zh.md">中文</a></p>

七个演示源站加 apex 站点，全部由 Cloudflare Pages 提供
（`functions/` 按子域名路由到 `site/demos/` 下生成的源站）。一切均由
`tools/gen-demos.js` 从 [`demos/sites.js`](../demos/sites.js) 确定性生成；密钥放在
[`demos/keys.js`](../demos/keys.js)，是**有意公开的演示密钥**——切勿复用。

| 源站 | 配置 | 页面数 | 展示内容 |
|---|---|---|---|
| <https://demo.aifeed.md> | blog | 11 | 完整走查：manifest、双栈 markdown、增量索引、`llms.txt`、带目录的文档 |
| <https://news.aifeed.md> | news | 13 | 快讯条、头条、分类编辑台、签名 frontmatter 中的 EN/ID `alternates`、作者页 |
| <https://shop.aifeed.md> | ecommerce | 12 | 带评分与价格的产品卡、图库、购物车、政策、媒体资源 |
| <https://gov.aifeed.md> | government | 10 | 带步骤时间线的服务目录、公告、法规下载、FAQ |
| <https://strict.aifeed.md> | restrictive | 5 | 仅搜索政策与**实时执行**：训练 UA 返回 403，不合规爬虫返回 429 + `Retry-After` |
| <https://revoked.aifeed.md> | registry | 6 | 多签名撤销：`active` 与 `suspended` 文档、客户端指南、事件时间线 |
| <https://verify.aifeed.md> | verifier | 5 | 浏览器验证器（WebCrypto + DNS-over-HTTPS）、覆盖矩阵、CLI 配方 |
| <https://aifeed.md> | docs | — | apex 自我吃狗粮：发布自己的签名 manifest |

每个生成的源站都带有真实的信息架构——吸顶顶栏、分组导航、侧边栏/目录布局、卡片、
表格、FAQ、时间线、订阅栏，以及逐页 SVG 插画——因此演示表现得像完整网站，而非单页。

## 从终端验证

```bash
# 单个源站，完整智能体流程
node examples/agent/compliant-agent.js https://demo.aifeed.md --use retrieval --fetch

# 全部源站，线上
npm run verify:live

# 执行行为（strict）
curl -i -A 'GPTBot/1.0' https://strict.aifeed.md/          # 403
curl -i -A 'Scrapy/2.11' https://strict.aifeed.md/         # 429 + Retry-After
curl -i -H 'Accept: text/aifeed+markdown' https://strict.aifeed.md/   # 200 签名
```

## 重新生成

```bash
npm run demos         # 生成 site/demos/** + apex 产物 + site/revoke/**
npm run demos:check   # 生成后验证每个 manifest 与撤销文档
```

`demos:check` 在 `npm run verify` 内运行。生成目录树被 gitignore，并在每次部署时重建。

## DNS 锚点

每个源站都发布 `_aifeed.<domain>` TXT 记录，包含演示公钥与指纹
（`v=aifeed1; pk=…; fp=…; manifest=…`）。锚点由 `demos/keys.js` 在
[`deploy-site.md`](deploy-site.md) 所述的 Cloudflare 配置过程中创建。
