# aifeed

<p><a href="README.md">English</a> · <a href="README.id.md">Bahasa Indonesia</a> · <a href="README.zh.md">中文</a></p>

AIFeed 协议 CLI：声明、签名并撤销 AI 智能体可以对你内容做什么——然后让任何智能体验证它。
零依赖，Node ≥ 20。

## 1 分钟快速上手

### 为已部署的网站签名

```bash
npx aifeed keygen --out .aifeed
npx aifeed site build ./public --domain example.com --key .aifeed/aifeed-private.pem --llms --inject
# 原样部署 ./public：.well-known/ai.json、*.aifeed.md、*.mako.md、*.sig、llms.txt
```

> Windows shell 偶尔会阻止新建的 `npx` shim（`'aifeed' is not recognized`）：
> 先执行一次 `npm install -g aifeed`，然后直接使用 `aifeed …`。

### 或脚手架生成签名 manifest（含密钥）

```bash
npx aifeed init --domain example.com --dir ./site
npx aifeed validate ./site --domain example.com
```

`init` 会写入 `aifeed-private.pem`、`.well-known/ai.json`、`.well-known/ai-signature.json`
与 `aifeed-setup.txt`（DNS 记录 + 主机片段）。

### 编辑 manifest 后重新签名

```bash
npx aifeed sign ./site/.well-known/ai.json   # 自动找到站点旁的密钥
```

### 端到端验证线上域名

```bash
npx aifeed validate example.com --require-dns-anchor
# TLS → 签名 → DNS _aifeed 锚点 → 撤销注册表
```

## 3 行验证（AI 消费端）

```bash
npm install @aifeed/verify
```

```js
const { verifyRemote } = require('@aifeed/verify');
const out = await verifyRemote('example.com');
console.log(out.result, out.anchor.status); // VERIFIED anchored
```

TypeScript：`import { verifyRemote } from '@aifeed/verify';`

## 命令

| 命令 | 作用 |
|---|---|
| `aifeed keygen --out DIR` | 生成 Ed25519 密钥对（`aifeed-private.pem`、`aifeed-public.txt`） |
| `aifeed init --domain D --dir DIR` | 一步生成密钥 + 签名 manifest + 安装指南 |
| `aifeed sign <ai.json>` | 签名（或重新签名）manifest；写入前先自检 |
| `aifeed validate <domain\|DIR\|FILE>` | 验证信任链；线上域名加 `--require-dns-anchor` |
| `aifeed rotate --dir DIR` | 在有界重叠窗口内更换签名密钥 |
| `aifeed site build <DIR> --domain D --key FILE` | 为整个静态站点签名：页面、索引、`llms.txt` |
| `aifeed bundle create\|verify` | 用于气隙验证的离线审计包 |
| `aifeed mako generate\|sign\|verify\|index\|fetch` | AIFeed Markdown / MAKO 内容工具（别名 `aifeed aimd …`） |
| `aifeed import-openapi <spec.json>` | 从 OpenAPI 规范起草智能体 capabilities/actions |

运行 `npx aifeed --help` 查看完整命令面。

## 你会发布什么

`/.well-known/ai.json` 处的签名 manifest，以及逐页 `path.aifeed.md` / `path.mako.md`
文件（含 `.sig` 边车）和增量索引——全部可离线验证。智能体通过 DNS（`_aifeed` TXT）
或 `/.well-known/` 发现它们。

## 下一步

- 规范：[`spec/zh/aifeed-v0.2.md`](https://github.com/denyn1/aifeed-protocol/blob/main/spec/zh/aifeed-v0.2.md)
- 主机适配器（nginx、Caddy、Apache、Node、Next.js、PHP、Python、Go、Traefik、Cloudflare）：
  [`integrations/`](https://github.com/denyn1/aifeed-protocol/tree/main/integrations)
- 面向 AI 智能体的发布方指南：[`docs/publisher-ai-guide.zh.md`](https://github.com/denyn1/aifeed-protocol/blob/main/docs/publisher-ai-guide.zh.md)
- Vite/Astro/Next.js 构建插件：[`@aifeed/frameworks`](https://www.npmjs.com/package/@aifeed/frameworks)
- 本地发布方 UI（AIFeed Studio）：仓库内 `npm run studio`

## 源码

[aifeed-protocol](https://github.com/denyn1/aifeed-protocol) 的一部分
（`packages/aifeed-cli`；`bin/`、`lib/`、`schema/` 为参考实现的生成副本，
经 `npm run build:cli` 生成）。
