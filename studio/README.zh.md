# AIFeed Studio

<p><a href="README.md">English</a> · <a href="README.id.md">Bahasa Indonesia</a> · <a href="README.zh.md">中文</a></p>

一个本地、零依赖的应用，把网站变成签名的 AIFeed 源站——manifest、逐页 AIFeed
Markdown/MAKO、签名、增量索引与 `llms.txt`——并带有策略编辑器，用于设置 AI 可以获取
什么、来源必须如何标注。

私钥永不离开你的机器。服务器只绑定 `127.0.0.1`，每次 API 调用都需要会话令牌，且没有
任何暴露私钥的端点。

## 运行

```bash
npm run studio                          # http://127.0.0.1:7777/
npm run studio -- --port 8080 --workspace ./studio-data
```

打开网址，为你的域名创建项目，指向网站的本地 HTML 目录（静态构建/导出产物，或 CMS 的
页面目录），配置策略、构建、验证并导出。

## 当前功能

- **按域名的项目工作区**：身份、策略、密钥对、增量状态。
- **本地来源接入**：扫描 HTML 目录，使用与 `aifeed site build` 相同的转换器转换页面，
  输出写入独立的 `build/` 覆盖层——你的源文件永不被修改。
- **线上站点抓取**：从 `sitemap.xml`（支持 sitemap 索引）或链接发现页面，遵守
  `robots.txt`（含 `Crawl-delay`），限速并用 ETag/Last-Modified 缓存每次抓取，
  重新扫描时复用未变更页面。
- **策略编辑器**：使用许可（search、retrieval、input、training、quote、summarize、
  reproduce、translate、modify、embed、commercial use）、署名要求与文本/URL、抓取限额、
  许可证、`llms.txt`、撤销检查间隔，以及只能收紧的路径规则（规范 `restrict-only`）。
- **站点类型预设**：从 `lib/scaffold.js` 派生的 news、ecommerce、marketplace、
  government、open、restrictive 与 blog 策略，在创建项目时或从策略标签应用。
- **按路径的页面类型**：把路径模式映射到 frontmatter 类型（`product`、`article`、
  `listing`、`faq`……），最长模式优先；增量索引条目继承该类型。
- **Freshness 元数据**：页面 `updated` 日期取自 `article:modified_time` /
  `og:updated_time` / `<time datetime>`，标签取自 `<meta name="keywords">`，可按项目
  开关（库中默认关闭，Studio 中默认开启）。
- **部署辅助**：构建覆盖层的 `.tar.gz` 下载、技术栈检测（WordPress、nginx、Caddy、
  Apache、Next.js、Node、PHP、Python、Go、Cloudflare）并在导出中显示对应的
  `integrations/` 适配器，以及一键**线上验证**（manifest、签名、DNS 锚点）。
- **密钥轮换仪式**：受保护的准备（后继密钥 + 重叠期 manifest）、确认切换、自动换钥，
  并用新密钥重新签名所有页面。上传覆盖层永不包含私钥。
- **增量构建**：未变更页面（按 HTML 哈希）会被跳过；状态文件保存逐页索引条目，大型站点
  重建依然快速。
- **验证**：发布前在本地验证 manifest、所有页面签名与两个索引。
- **导出**：可上传的覆盖目录、精确的 `_aifeed` DNS TXT 记录，以及分步说明。
- **界面支持英语、印度尼西亚语和中文。**

## 工作区结构

```
~/.aifeed-studio/                 （或 --workspace）
  projects.json
  projects/<domain>/
    project.json                  身份、来源、配置
    policy.json                   全局策略 + 路径规则
    aifeed-private.pem            0600，永不对外提供
    aifeed-public.txt
    state.json                    增量构建状态
    build/                        把这个覆盖层上传到网站根目录
```

## 策略语义（重要）

- 每个源站只有一个 manifest。manifest 承载全局策略。
- 路径规则被注入每个页面的已签名 `aifeed` frontmatter 块，且**只能收紧** manifest
  允许的内容（deny 覆盖 allow、更严格的署名、更紧的限额）；放宽会被拒绝，符合
  AIFeed v0.2 §6.3。
- UI 在构建前预览任意 URL 的有效策略。

## 安全

- 默认绑定 `127.0.0.1`；API 调用需要注入到 UI 页面的每次会话令牌。
- 无依赖，除你显式构建的页面外无外部调用。
- 私钥仅保存在工作区目录中，权限仅限所有者。

## API（供脚本与测试）

`GET /api/info`、`GET|POST /api/projects`、`GET|PUT /api/projects/:id`、
`PUT /api/projects/:id/policy`、`PUT /api/projects/:id/source`、
`POST /api/projects/:id/build`（返回 job id）、`GET /api/projects/:id/jobs/:id`、
`GET /api/projects/:id/events?job=`（SSE）、`POST /api/projects/:id/verify`、
`GET /api/projects/:id/preview?path=`、`GET /api/projects/:id/export`。

所有 API 调用都需要 `x-studio-token` 响应头（SSE 使用 `?token=`）。

## 路线图

- **M2（已完成）：** 通过 `sitemap.xml` 或链接抓取线上站点（遵守 robots、限速、带条件
  请求的缓存），并从缓存构建。
- **M2.5（已完成）：** 站点类型预设、按路径的页面类型，以及面向新闻与电商站点的
  freshness 元数据提取。
- **M3（已完成）：** `.tar.gz` 导出、带适配器提示的技术栈检测、UI 内线上验证，以及
  带页面重新签名的受保护密钥轮换仪式。
- **M4：** 更友好的诊断、审计日志、截图，以及带 OpenAPI 导入的高级
  `types`/`capabilities`/`actions` 编辑器。

## 相关

- 发布方 AI 指南（智能体驱动安装）：[`../docs/publisher-ai-guide.zh.md`](../docs/publisher-ai-guide.zh.md)
- 命令参考：[`../REFERENCE.zh.md`](../REFERENCE.zh.md)
- 轮换操作手册：[`../docs/rotation.zh.md`](../docs/rotation.zh.md)
