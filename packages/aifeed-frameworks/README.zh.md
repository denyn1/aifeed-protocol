# @aifeed/frameworks

即插即用的构建插件，把静态输出变成 [AIFeed](https://aifeed.md) 源站——签名 manifest、
逐页 AIFeed Markdown/MAKO、增量索引与 `llms.txt`——无需手动调用 CLI。

```bash
npm install --save-dev @aifeed/frameworks@next
npx aifeed-build keygen --out .aifeed   # 每个项目执行一次
```

## Vite

```js
// vite.config.js
import { aifeed } from '@aifeed/frameworks/vite';

export default {
  plugins: [aifeed({ domain: 'example.com', keyPath: '.aifeed/aifeed-private.pem' })]
};
```

在 `vite build` 之后运行（`closeBundle`），读取 `build.outDir`，为每个 HTML 页面签名，
并注入 `<link rel="alternate" type="text/aifeed+markdown">`，让智能体在任何静态主机上
都能找到 markdown 端点。

## Astro

```js
// astro.config.mjs
import aifeed from '@aifeed/frameworks/astro';

export default {
  integrations: [aifeed({ domain: 'example.com', keyPath: '.aifeed/aifeed-private.pem' })]
};
```

在 `astro:build:done` 钩子运行并为输出目录签名。

## Next.js（`output: 'export'`）

```js
// next.config.js
const { withAifeed } = require('@aifeed/frameworks/next');

module.exports = withAifeed({ output: 'export' }, { domain: 'example.com' });
```

```jsonc
// package.json — npm 会在 "build" 之后自动运行 "postbuild"
{ "scripts": { "build": "next build", "postbuild": "aifeed-next --domain example.com --key .aifeed/aifeed-private.pem" } }
```

Next.js 没有官方的导出后钩子，因此 `withAifeed()` 负责校验配置并在
`output !== 'export'` 时告警，而 `aifeed-next` 在导出完成后执行签名（默认目录：`out/`）。

## 其他生成器（Hugo、Eleventy、Jekyll、纯 HTML）

```bash
npx aifeed-build ./public --domain example.com --key .aifeed/aifeed-private.pem
npx aifeed-build ./public --domain example.com --profile both --no-inject --json
```

## 产出的文件

| 产物 | 位置 |
|---|---|
| Manifest 与签名 | `.well-known/ai.json`、`.well-known/ai-signature.json` |
| 增量索引（含签名） | `.well-known/aifeed-index.json`（`profile: both` 时还有 `mako-index.json`） |
| 逐页 markdown + `.sig` | 每个 HTML 旁的 `path.aifeed.md`、`path.mako.md` |
| 发现 | HTML 中的 `<link rel="alternate">`（除非 `inject: false`）、`llms.txt` |

## 选项

| 选项 | 默认 | 说明 |
|---|---|---|
| `domain` | `AIFEED_DOMAIN` | 必填 |
| `keyPath` | `aifeed-private.pem`（`AIFEED_KEY`） | Ed25519 PKCS#8 PEM |
| `baseUrl` | `https://<domain>`（`AIFEED_BASE_URL`） | 子路径部署时设置 |
| `profile` | `aimd` | `aimd` \| `mako` \| `both` |
| `inject` | `true` | 向构建后的 HTML 注入 `<link rel="alternate">` |
| `llms` | `true` | 写入 `llms.txt` |
| `prune` | `true` | 重建前清理过期的生成文件 |
| `verifyAfter` | `true` | 自校验签名/摘要；被篡改则构建失败 |
| `name`、`type`、`locale`、`contact`、`keyId`、`updated` | CLI 默认 | manifest 元数据 |
| `permissions`、`limits`、`license`、`sitemap`、`maxCheckIntervalHours` | manifest 默认 | 策略字段 |

## 说明

- 构建期间密钥不会离开你的机器；不会上传任何内容。
- `inject: false` 适用于已协商 `Accept: text/aifeed+markdown` 的主机
  （nginx、Caddy、Apache、Cloudflare——见仓库 `integrations/`）。
- 重建是幂等的：签名刷新、链接注入不重复、被清理的文件按当前 HTML 重新生成。
- 零依赖；Node ≥ 20。验证引擎打包自参考实现（仓库中 `npm run build:fw`）。

## 源码

[aifeed-protocol](https://github.com/denyn1/aifeed-protocol) 的一部分
（`packages/aifeed-frameworks`）。规范：`spec/zh/`；发布方指南：
[`docs/publisher-ai-guide.zh.md`](../../docs/publisher-ai-guide.zh.md)。
