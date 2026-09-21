# AIFeed 规范

<p><a href="README.md">English</a> · <a href="README.id.md">Bahasa Indonesia</a> · <a href="README.zh.md">中文</a></p>

正本语言：**英文**（`spec/en/`）。译文（`spec/<lang>/`）仅供参考；出现分歧时以英文为准。

| 文档 | 版本 | 状态 | 范围 |
|---|---|---|---|
| [`en/aifeed-v0.1.md`](en/aifeed-v0.1.md) · [id](id/aifeed-v0.1.md) · [zh](zh/aifeed-v0.1.md) | 0.1.0-rc1 | 候选发布版 | 签名声明：manifest、签名、DNS 锚点、撤销、离线包 |
| [`en/aifeed-v0.2.md`](en/aifeed-v0.2.md) · [id](id/aifeed-v0.2.md) · [zh](zh/aifeed-v0.2.md) | 0.2.0-draft | 草案 | MAKO 信任配置：MAKO 签名、许可绑定、增量索引、资源、分流 |
| [`en/aifeed-aimd-v1.md`](en/aifeed-aimd-v1.md) · [id](id/aifeed-aimd-v1.md) · [zh](zh/aifeed-aimd-v1.md) | 1.0（协议），AIFeed 0.2 | 草案 | **AIFeed Markdown** 原生内容配置、双栈运行模式、媒体类型注册计划 |

`spec/` 之外的相关文档：

- [`../docs/EXTENSION.md`](../docs/EXTENSION.md) —— 向 MAKO 社区提交的信任层（签名 + 许可 + 增量）
  上游扩展提案。
- [`../paper/main.md`](../paper/main.md) —— arXiv 预印本草案（工作标题：
  *AIFeed: Verifiable Content Permissions and Efficient Agent Delivery for the
  AI Web*），含经核验的参考文献与主张台账。
- [`../CHANGELOG.md`](../CHANGELOG.md) —— 协议与参考实现历史。
- [`../GOVERNANCE.md`](../GOVERNANCE.md) —— 过渡期治理、注册表流程，以及许可/开放核心
  政策（什么是永久开放、什么是私有）。
- [`../SECURITY.md`](../SECURITY.md) —— 漏洞报告与密钥泄露。

一致性产物：`conformance/vectors`（manifest）、`conformance/mako`（MAKO）、
`conformance/aimd`（AIFeed Markdown），以及撤销与离线包夹具。

## 草案状态

v0.1.0-rc1、0.2 与 AIFeed Markdown v1 文档**尚未冻结**。变更遵循
[`../CONTRIBUTING.md`](../CONTRIBUTING.md)；破坏性变更提升协议次版本，并且必须随附
更新后的一致性向量。
