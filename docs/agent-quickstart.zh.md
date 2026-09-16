# 智能体快速上手 — 抓取前先检查 AIFeed

<p><a href="agent-quickstart.md">English</a> · <a href="agent-quickstart.id.md">Bahasa Indonesia</a> · <a href="agent-quickstart.zh.md">中文</a></p>

这是协议的客户端一侧：AI 系统、爬虫或智能体在**第一次请求**某站点之前应当做什么，
以便依据签名许可行事，而不是从无签名文件里猜测。

## 规则

1. **发现声明。** `GET /.well-known/ai.json`（或跟随 `Link: rel="ai-feed"` /
   `<link rel="ai-feed">`）。在获取内容页之前完成，就像读取 `robots.txt` 一样。
2. **验证整条链。** TLS → 域名匹配 → 对 JCS 字节的 Ed25519 签名 →
   可选 DNS 锚点（`_aifeed`）。未经验证的声明不授予任何许可。
3. **阅读许可与限额。** 按用途判断——`training`、`retrieval`、`summarize`、`quote`……
   ——并遵守抓取限额。`deny` 是指令，不是建议。
4. **合规抓取。** 协商 `Accept: text/aifeed+markdown`（原生）或
   `text/mako+markdown`（兼容），然后验证逐页签名。
5. **使用增量索引。** `/.well-known/aifeed-index.json` 携带逐页摘要；
   只抓取发生变化的页面。未变更页面成本为 0 字节。
6. **复查撤销并署名。** 复用前重新检查签名撤销注册表；按 manifest 要求附带署名。

## 可运行示例

```bash
node examples/agent/compliant-agent.js https://example.com --use retrieval --fetch
```

输出（已验证站点）：

```
AIFeed check — example.com
discovery : https://example.com/.well-known/ai.json (fallback)
verify    : VERIFIED
use       : retrieval → allowed (attribution required)
training  : denied
index     : /.well-known/aifeed-index.json
content   : text/aifeed+markdown · 4218 bytes · tokens=1024 · signature verified
```

退出码：`0` 已验证，`1` 未验证/被拒绝，`2` 用法错误。`--json` 输出完整结构化报告。

## 代码

```js
const sdk = require('@aifeed/verify');

const discovery = await sdk.discoverManifestUrl('https://example.com');
const manifest = await sdk.fetchText(discovery.manifestUrl);
const signature = await sdk.fetchText(discovery.manifestUrl.replace(/ai\.json$/, 'ai-signature.json'));

const verified = sdk.verifyAll({
  manifestText: manifest.text,
  manifestBytes: manifest.buffer,
  signatureText: signature.text,
  domain: 'example.com'
});
if (verified.result !== 'VERIFIED') {
  // 没有许可：停止，或在常规规则下回退到站点 HTML
}

const permissions = verified.manifest.permissions;
const training = sdk.decideUsage(permissions, 'training');   // { allowed, attribution, reason }
const retrieval = sdk.decideUsage(permissions, 'retrieval');

if (retrieval.allowed) {
  const page = await sdk.fetchAimd('https://example.com/artikel/satu', {
    publicKeyValue: verified.manifest.identity.public_key
  });
  if (page.mako_verified) {
    // 在声明许可范围内使用 page.frontmatter / page.body
  }
}
```

增量消费与分流：

```js
const delta = await sdk.fetchIndexDelta('https://example.com/.well-known/aifeed-index.json', {
  storedDigests: { '/artikel/satu': '<sha-256 from your last run>' }
});
const picked = sdk.selectEntries(delta.entries, { query: 'topic', maxTokens: 4000 });
for (const entry of picked.selected) { /* 只抓取发生变化或重要的内容 */ }
```

## 失败处理

| 情况 | 合规智能体的做法 |
|---|---|
| 没有 `/.well-known/ai.json` | 视为该站点没有 AIFeed 政策；回退到常规规则（`robots.txt`、服务条款）——不要假定有许可。 |
| `VERIFIED` 但 `training: deny` | 即使内容公开可访问，也不要用它训练。 |
| `UNVERIFIED` / `SUSPENDED` | 按未获许可处理；不要将内容用于受限用途。 |
| 边缘返回 `403` | 停止。发布方的执行点拒绝了请求。 |
| `429` + `Retry-After` | 至少退避所指示的时间；不要轮换标识来规避。 |
| 某页签名失败 | 丢弃该文档；上报；不要悄悄回退去抓 HTML。 |
| `grace_accepted` 警告 | 发布方正在轮换密钥；旧密钥在窗口内仍有效，但建议尽快重新抓取。 |
| `rotation_anchor_unverified` 警告 | DNS `pk2` 交叉校验缺失或不匹配；仅为建议性——锚点仍是签名指令。高风险智能体可将其视为错误。 |
| `rotation_denied` | 不要信任新内容；已退役密钥重新出现，或该变更从未被公布。从干净状态重新验证并上报。 |
| 轮换后的新密钥 | 仅当与你存储的已公布后继密钥匹配，或通过 `predecessor_fp` 绑定到你的固定密钥时才接受（SDK `rotation.evaluateContinuity`）；然后更新固定记录。 |

发布方可以在边缘强制执行这一切——[`integrations/`](../integrations/) 中的
nginx/Caddy/Apache 模板与 Node/PHP/Python/Go 适配器携带同样的策略
（训练爬虫 `403`，不合规爬虫 `429`，合规客户端获得签名内容）。

## 参考

- 规范：[`spec/en/aifeed-v0.2.md`](../spec/en/aifeed-v0.2.md) ·
  [`spec/en/aifeed-aimd-v1.md`](../spec/en/aifeed-aimd-v1.md)
- SDK：[`packages/aifeed-verify/README.md`](../packages/aifeed-verify/README.md) ·
  npm [`@aifeed/verify`](https://www.npmjs.com/package/@aifeed/verify)
- 验证细节：协议 README 的 "What gets verified" 章节
- 示例：[`examples/agent/compliant-agent.js`](../examples/agent/compliant-agent.js)
