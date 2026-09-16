# 安全政策

<p><a href="SECURITY.md">English</a> · <a href="SECURITY.id.md">Bahasa Indonesia</a> · <a href="SECURITY.zh.md">中文</a></p>

## 受支持版本

| 版本 | 状态 | 安全修复 |
|---|---|---|
| AIFeed Markdown v1.0（AIFeed 1.0.x draft） | 当前 | 是 |
| AIFeed 0.2.x（MAKO 配置） | 维护中 | 是 |
| AIFeed 0.1.x | 遗留 | 尽力而为 |

## 报告漏洞

**不要**提交公开 issue。请使用仓库的**私有安全通告**
（Security 标签 → "Report a vulnerability"），它会私密地送达维护者。若无法使用该渠道，
请联系 `GOVERNANCE.md` 中列出的维护者，并在分享细节前先索取安全渠道。

请附上：

- 受影响的组件（`lib/mako.js`、`bin/cli.js`、Python 客户端、WordPress 插件、
  schema、spec），
- 最小复现（输入字节、命令或 HTTP 轨迹），
- 影响评估（例如签名绕过、许可绕过、YAML 解析、DoS），
- 是否有已发布的一致性向量失败。

## 范围

在范围内：签名验证绕过、跨格式/上下文重放、许可绕过（restrict-only 违规）、
摘要/索引完整性、解析器副作用（污染、内存耗尽）、插件权限问题与降级处理。

不在范围内：自签名测试夹具、localhost 回环测试例外，以及需要预先控制源站私钥或 DNS
的攻击。

## 密钥泄露与撤销

若签名密钥泄露：

1. 按轮换操作手册发布新密钥（[`docs/rotation.md`](docs/rotation.md)）：公布后继密钥、
   有界重叠期、切换。
2. 通过 `GOVERNANCE.md` 中的注册表流程，为旧指纹申请撤销文档。
3. 用新密钥重新签署 manifest；带密钥固定记录的客户端会对变化发出警报（设计如此）。

## 披露

我们力求在 7 天内确认报告，并在 30 天内为高严重性问题提供修复或缓解。除非你希望匿名，
changelog 中会致谢。
