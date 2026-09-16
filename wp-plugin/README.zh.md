# AIFeed WordPress 插件（v1.0.0-draft）

<p><a href="README.md">English</a> · <a href="README.id.md">Bahasa Indonesia</a> · <a href="README.zh.md">中文</a></p>

AIFeed 的参考**发布方 SDK**。它生成 Ed25519 密钥对，根据你的 WordPress 站点数据构建
符合 schema 的 manifest，进行签名（RFC 8785 JCS + Ed25519），在 `/.well-known/ai.json`
提供服务，分离签名位于 `/.well-known/ai-signature.json`，并**为发现而通告**
（`Link: rel="ai-feed"` 响应头、`<link rel="ai-feed">` 元素与 `robots.txt` 提示），
让 AI 客户端在首次接触时就能发现并遵循该声明。

v0.2 manifest 在**两种内容配置**下提供同一份签名 markdown 字节：
**AIFeed Markdown**——原生 AIFeed（`Accept: text/aifeed+markdown`、`aimd: "1.0"`）
——以及 **MAKO** 兼容（`Accept: text/mako+markdown`）。每种媒体类型携带自己的签名上下文
（`aimd1:` / `mako1:`），跨格式重放被拒绝，增量索引同时发布于
`/.well-known/aifeed-index.json` 与 `/.well-known/mako-index.json`，各带相应签名。
manifest 声明 `content.profile: "both"` 与 `content.index_url`。

运行模式：

- **双栈（默认）：** 共享正文上限为 MAKO 建议值（`aifeed_mako_max_tokens`，默认
  1,000）；manifest 配置为 `both`。
- **仅 AIFeed Markdown：** 添加 `add_filter('aifeed_dual_stack', '__return_false');`
  —— Mako 请求回退到 HTML，manifest 声明 `aifeed-md`，正文预算提高到
  `aifeed_aimd_max_tokens`（默认 4,000）。

图片、视频、音频、文档与压缩包在 `aifeed.assets` 中以链接列出（外加 "Media & Unduhan"
正文小节），让智能体决定下载什么；索引携带**站点摘要**与逐条**分流字段**，插件还为
非 AIFeed 工具提供 `/llms.txt`。若检测到 `mako-wp` 插件，生成工作委托给它，AIFeed 继续
发布签名 manifest 与政策。

## 状态

候选发布版。**已在真实 WordPress 中端到端验证**（PHP 8.4 + 官方 SQLite drop-in，无头
安装）：插件激活、密钥生成（sodium → SPKI DER）、带自验证的签名、`/.well-known/ai.json`
+ 签名的 HTTP 服务、Settings API 保存、带 nonce 校验的管理端签名操作、缺失 nonce 拒绝
（403）、未认证请求拒绝（400，操作未执行），以及前台的徽章短代码——**17/17 项检查
通过**，所提供的 manifest 被 Node SDK 独立验证为 **VERIFIED**（包括 `raw_digest` 层）。
MAKO 层在同一环境验证：带 `content.mako` 的 v0.2 manifest、带必需 MAKO 响应头的内容
协商、对 manifest 密钥的内联签名验证（篡改正文被拒绝）、HTML 中的 alternate 链接，
以及与条目摘要匹配的签名增量索引。

公开发布前的建议：

```bash
php -l aifeed.php
php -l includes/class-aifeed-jcs.php   # 以及其他 includes
php tests/jcs-test.php                 # 跨语言 JCS + Ed25519 夹具检查
php tests/mako-test.php                # MAKO 转换器 + 签名往返
```

并在 MySQL 主机上跑一遍（这里只演练了 SQLite drop-in）。

## 运行模式

- **自动（零接触，默认）：** 激活时生成密钥、选择检测到的配置、签名、提供服务、通告，
  并在站点名称/URL 变化或插件（停）启用时自动重签，另有每月 cron。永不需要管理员操作。
- **半自动：** 相同的检测，但站点变更进入队列并显示为 "Review & re-sign" 通知；在你
  批准之前不会有任何变化。
- **手动：** 完全控制——细粒度设置加可选的自定义 manifest JSON（有效期时间戳自动刷新；
  `identity.public_key` 必须与站点签名密钥匹配，否则拒绝签名）。

配置：`blog`、`news`、`ecommerce`、`marketplace`、`government`、`open`、`restrictive`。

多站点：Network Admin → AIFeed 可批量应用配置并一键为每个站点签名（每个站点获得自己的
源站 manifest）。

**扩展说明：** AIFeed 每个源站只使用一个 manifest。拥有成千上万页面的站点仍只发布一个
`/.well-known/ai.json`；无需逐页工作。

## 目录结构

```
wp-plugin/
├── aifeed.php                          # bootstrap、hooks、cron
├── uninstall.php
├── readme.txt                          # WordPress.org readme
├── assets/admin.css
├── includes/
│   ├── class-aifeed-jcs.php            # RFC 8785 规范化（UTF-16 键序）
│   ├── class-aifeed-keys.php           # keygen、SPKI DER、指纹、签名
│   ├── class-aifeed-mako-html.php      # 面向 MAKO 的 HTML 到 Markdown 转换
│   ├── class-aifeed-manifest.php       # manifest 构建器 + 基本校验（v0.2）
│   ├── class-aifeed-signer.php         # 签名、自验证、存储、可选静态写入
│   ├── class-aifeed-mako.php           # AIFeed Markdown + MAKO 协商、签名、增量索引
│   ├── class-aifeed-publisher.php      # 通过 template_redirect 服务 /.well-known/*
│   ├── class-aifeed-badge.php          # [aifeed_badge] 短代码
│   └── class-aifeed-admin.php          # 设置页、操作、DNS 指引
└── tests/
    ├── jcs-test.php                    # 与 Node 生成的夹具做差分测试
    └── mako-test.php                   # MAKO 转换 + 签名/验证往返
```

## 跨语言保证

`tests/jcs-test.php` 把 PHP 规范化结果与 Node 参考实现生成的夹具
（`tools/jcs-php-fixtures.json`）对比，并用 `sodium_crypto_sign_verify_detached` 验证
Node 签名的 manifest。

`tests/mako-test.php` 独立演练 AIFeed Markdown 与 MAKO 转换器以及签名原语（无需
WordPress）：`aimd`/`aimd-index`/`mako`/`mako-index` 的分隔串互不相同，签名在正确的
分隔串上通过验证，篡改与跨 URL 重放被拒绝，跨上下文重放（把 AIFeed Markdown 签名当作
MAKO 呈现）失败。

## 安全说明

- 私钥：选项 `aifeed_secret_key`（禁用 autoload）或常量 `AIFEED_SECRET_KEY`。
  请备份数据库。
- 服务路径原样回显存储字节（字节级 `raw_digest` 完整性）。
- MAKO 响应携带 `Vary: Accept`；`X-Mako-*` 与 `X-Aifeed-*` 响应头绝不出现在
  `401`/`403` 上（防止资源枚举）。
- MAKO 文档仅来源于已发布文章内容；草稿与私密文章永不提供。
- `/llms.txt` 是无签名的发现文本（llms.txt v2）。许可始终来自签名 manifest 与 MAKO
  签名；绝不要把 llms.txt 当作信任来源。
- 插件从不写入或删除文章、页面与媒体内容。卸载会移除插件选项、每篇文章的 MAKO 缓存
  （`_aifeed_mako_cache`）以及索引和 llms.txt 的 transient——仅此而已。
- 所有管理操作都使用能力检查与 nonce；输入被清理，输出被转义。

## 许可证与开放核心政策

MIT。AIFeed 验证路径（规范、schema、验证器、向量、发布工具）在项目的开放核心 +
开放标准政策下永久开放；只有密钥、客户数据与反滥用策略保持私有。见 `GOVERNANCE.md`
（"Licensing and open-core policy"）。
