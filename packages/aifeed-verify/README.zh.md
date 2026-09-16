# @aifeed/verify

<p><a href="README.md">English</a> · <a href="README.id.md">Bahasa Indonesia</a> · <a href="README.zh.md">中文</a></p>

**AIFeed 协议**的零依赖验证器——签名 AI-Web 内容声明与内容配置：

- **Manifest**（`/.well-known/ai.json`，v0.1/v0.2），Ed25519 + JCS 验证
- **原生内容配置 AIFeed Markdown**（`text/aifeed+markdown`、`.aifeed.md`）
- **MAKO 兼容配置**（`text/mako+markdown`），带 AIFeed 信任层
- **增量索引**（`/.well-known/aifeed-index.json` / `mako-index.json`），逐条
  SHA-256 摘要与站点/分流元数据
- **撤销**文档（多签名）与**离线包**
- **Content-Digest**（RFC 9530）传输完整性
- **分流选择**（`selectEntries`），在 token 预算内挑选页面

需要 Node.js >= 20。无运行时依赖。

## 安装

```bash
npm install @aifeed/verify
```

## 快速上手

### 验证 manifest（离线字节）

```js
const sdk = require('@aifeed/verify');

const result = sdk.verifyAll({
  manifestText: fs.readFileSync('ai.json', 'utf8'),
  manifestBytes: fs.readFileSync('ai.json'),
  signatureText: fs.readFileSync('ai-signature.json', 'utf8'),
  domain: 'example.com'
});
console.log(result.result, result.errors);
```

### 抓取并验证原生内容（AIFeed Markdown）

```js
const content = await sdk.fetchAimd('https://example.com/artikel', {
  publicKeyValue: 'ed25519:...' // 来自已验证的 manifest
});
if (content.mako_verified) {
  console.log(content.frontmatter.entity, content.tokens);
}
// MAKO 用法相同：sdk.fetchMako(url, options)
// 或 sdk.fetchMako(url, { mediaType: 'text/aifeed+markdown' })
```

### 增量消费

```js
const delta = await sdk.fetchIndexDelta('https://example.com/.well-known/aifeed-index.json', {
  storedDigests: { '/artikel/a': '<sha-256 from last run>' }
});
const picked = sdk.selectEntries(delta.entries, { query: 'aifeed mako', maxTokens: 4000 });
for (const entry of picked.selected) {
  // 只抓取发生变化的 / 重要的内容
}
```

### 离线文档验证

```js
const verified = sdk.verifyAimdDocument({
  pageUrl: 'https://example.com/artikel',
  makoBytes,                  // 与服务时完全一致的字节
  containerText,              // 签名容器 JSON
  manifestFragment            // { public_key, content_mako, permissions }
});
```

## API

| 导出 | 用途 |
|---|---|
| `verifyAll`, `verifyDirectory`, `checkManifest` | manifest 验证（v0.1/v0.2） |
| `fetchMako`, `fetchAimd` | 内容协商，可选签名验证 |
| `fetchIndexDelta` | 索引抓取 + 与已存摘要的变更差异 |
| `selectEntries` | 带 `maxPages` / `maxTokens` 预算的关键词排序 |
| `verifyMakoDocument`, `verifyAimdDocument` | 按配置的离线文档验证 |
| `verifyMakoIndex`, `verifyAimdIndex` | 索引签名 + 摘要校验 |
| `mako.*` | 解析器、签名/验证原语、许可解析、常量 |
| `verifyRevocationDocument`, `revocation.*` | 注册表撤销检查 |
| `createBundle`, `verifyBundle` | 离线审计包 |
| `digest.*` | SHA-256/512 辅助与 RFC 9530 Content-Digest |
| `AIMD_MEDIA_TYPE`, `MAKO_MEDIA_TYPE` | 媒体类型常量 |

TypeScript 声明随 `index.d.ts` 提供。

## 许可证

MIT。测试向量为 CC0。规范：CC BY 4.0。
