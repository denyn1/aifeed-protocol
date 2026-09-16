# SEO 与 Google

<p><a href="seo.md">English</a> · <a href="seo.id.md">Bahasa Indonesia</a> · <a href="seo.zh.md">中文</a></p>

站点当前已交付的内容，以及只有站点所有者才能完成的两步。

## 已实现

- **逐页元数据**：每个 HTML 页面都带 `title`、`description`、`robots`
  （`index,follow,max-image-preview:large`）、绝对 `canonical`、Open Graph 与 Twitter
  卡片标签，以及 JSON-LD（落地页为 `Organization`、`WebSite`、`SoftwareApplication`；
  其他页面为 `WebPage`/`TechArticle`；每个演示页都有 `WebPage`）。
- **`sitemap.xml`**：apex 下列出主要页面与所有演示页面（由 `tools/gen-demos.js`
  从 `demos/sites.js` 生成；用 `npm run demos` 重新生成）。
- **`robots.txt`**：apex 下允许所有、指向 sitemap，并带一条指向
  `/.well-known/ai.json` 的 `AIFeed:` 注释。
- **`og-image.png`**（1200×630）仅用 Node 标准库生成
  （`tools/gen-og-image.js`）——仓库中不提交二进制资产。
- **`llms.txt`**：面向尚未支持 AIFeed 的工具。
- 演示站点原本就有各自的 `robots.txt` + `sitemap.xml`；现在也带同一套元数据。

快速验证：

```bash
curl -s https://aifeed.md/robots.txt
curl -s https://aifeed.md/sitemap.xml | head -20
curl -sI https://aifeed.md/og-image.png | head -3
```

## 第 1 步 — Google Search Console（搜索收录所需）

1. 打开 <https://search.google.com/search-console>，添加 **Domain** 属性
   `aifeed.md`（不要用 URL 前缀变体）。
2. Google 会显示形如 `google-site-verification=XXXXXXXX…` 的 TXT 记录。复制完整值。
3. 添加到 Cloudflare DNS —— 可以在此粘贴由 API 添加，或手动操作：
   Cloudflare → DNS → Add record → 类型 **TXT**、名称 `@`、内容为复制的值。
4. 回到 Search Console 点击 **Verify**。DNS 验证可能需要几分钟。
5. 提交 sitemap：**Sitemaps → add** `https://aifeed.md/sitemap.xml`。
6. 可选：对 `https://aifeed.md/` 使用 **URL Inspection → Request indexing**。

如果 DNS 不方便：Search Console 也接受放在站点根目录的 HTML 文件
（`google<token>.html`）；把文件放进 `site/` 即会原样部署。

## 第 2 步 — Google Analytics（可选）

如果想要流量数据，创建 GA4 属性并提供 `G-XXXXXXXXXX` 衡量 ID。它只会加到落地页与
演示页——`process.html`/`enforcement-report.html` 页面保持完全离线（无外部请求，
由测试强制保证）。

## 说明

- apex 现在提供自己的签名 AIFeed manifest 与 `_aifeed` DNS 锚点；搜索引擎爬虫读取
  `robots.txt` 与 sitemap，AI 智能体读取 `/.well-known/ai.json`。
- `site/{robots.txt,sitemap.xml,og-image.png}` 为生成产物并被 gitignore；用
  `npm run demos`（或 `npm run verify`）重新构建。
