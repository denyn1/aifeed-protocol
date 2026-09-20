<p align="center">
  <img src="aifeed-logo.svg" width="92" alt="AIFeed 标志">
</p>

<h1 align="center">AIFeed</h1>

<p align="center"><a href="README.md">English</a> · <a href="README.id.md">Bahasa Indonesia</a> · <a href="README.zh.md">中文</a></p>

<p align="center"><strong>面向 AI 网络的内容许可签名标准。</strong><br>
声明、签名并撤销 AI 智能体可以对你的内容做什么——并让智能体能够验证它。</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@aifeed/verify"><img src="https://img.shields.io/npm/v/@aifeed/verify?color=f55036&label=npm" alt="npm 版本"></a>
  <img src="https://img.shields.io/badge/tests-251%20JS%20%C2%B7%2044%20Python-3ddc97" alt="测试套件">
  <img src="https://img.shields.io/badge/conformance-84%20vectors-f55036" alt="一致性向量">
  <img src="https://img.shields.io/badge/specs-CC%20BY%204.0-6ea8fe" alt="规范许可证">
  <img src="https://img.shields.io/badge/code-MIT-3ddc97" alt="代码许可证">
  <img src="https://img.shields.io/badge/status-1.0.0--draft-ffb454" alt="状态">
</p>

<p align="center">
  <a href="https://aifeed.md">网站</a> ·
  <a href="https://aifeed.md/process.html">协议流程</a> ·
  <a href="https://aifeed.md/enforcement-report.html">基准测试</a> ·
  <a href="https://aifeed.md/penjelasan.html">完整指南</a> ·
  <a href="paper/aifeed-preprint.pdf">论文（PDF）</a>
</p>

---

## 为什么需要 AIFeed？

AI 智能体现在驱动着越来越大比例的网页流量，但说明“它们可以做什么”的信号却是
**未签名的文本文件**。任何人都能编辑它们，它们与域名之间没有任何绑定，也无法撤销。
这种不对称是可以量化的：

- 半年内有 **19 亿次** 爬取无视了 `robots.txt` 规则（单一厂商数据）。
- 某大型 AI 提供商的爬取与引荐比被测量为 **70,900 : 1**。
- 2025 年 AI 机器人平均占 HTML 请求的 **4.2 %**，峰值达 6.4 %。

AIFeed 用可密码学验证的声明取代“请遵守这个文件”，并附带精简的、面向智能体的内容，
**双方**都因此降低成本。

## 工作原理

1. **生成 Ed25519 密钥对**——私钥永不离开源站。
2. **在 `/.well-known/ai.json` 发布签名 manifest（清单）**：按用途区分的许可
   （训练、检索、引用……）、爬取限额、许可证、修订信息。
3. **在 DNS 中锚定密钥**（`_aifeed` TXT），使 manifest 无法被其他域名冒充。
4. **智能体验证整条链**——TLS → 域名 → 签名（JCS + Ed25519）→ DNS 锚点——
   并在每次使用时重新检查**多签名撤销注册表**。
5. **安全轮换密钥**——用旧密钥签名的指令公布后继密钥（外加建议性的 DNS `pk2`
   交叉校验），保持有界重叠期，切换，然后永久撤销旧密钥。操作手册：
   [`docs/rotation.md`](docs/rotation.md)。
6. **提供精简内容**——以下两种配置之一，并带有签名**增量索引**，未变更页面
   成本为 0 字节。

**面向 AI 智能体：** 先检查再使用的指南（发现 → 验证 → 许可判定 → 增量 → 失败处理）
见 [`docs/agent-quickstart.md`](docs/agent-quickstart.md)，
可运行示例见
[`examples/agent/compliant-agent.js`](examples/agent/compliant-agent.js)。

## 快速试用

```bash
npm install @aifeed/verify
```

```js
const sdk = require('@aifeed/verify');

const base = 'https://example.com/.well-known/';
const manifest = await sdk.fetchText(base + 'ai.json');
const signature = await sdk.fetchText(base + 'ai-signature.json');

const result = sdk.verifyAll({
  manifestText: manifest.text,
  manifestBytes: manifest.buffer,
  signatureText: signature.text,
  domain: 'example.com'
});
console.log(result.result, result.errors);
```

CLI 位于本仓库（零依赖，Node ≥ 20）：

```bash
cd aifeed-protocol
node bin/cli.js keygen --out keys/
node bin/cli.js validate https://example.com
node bin/cli.js site build ./public --domain example.com --key keys/aifeed-private.pem
```

## 两种内容配置

| 配置 | 媒体类型 | 扩展名 | 说明 |
|---|---|---|---|
| **AIFeed Markdown**（原生） | `text/aifeed+markdown` | `.aifeed.md` | 带内签名策略块、token 预算、翻译 `alternates`、分流元数据 |
| **MAKO**（兼容） | `text/mako+markdown` | `.mako.md` | 外部 MAKO 信任配置，由同一份签名字节提供，使用独立的签名上下文 |

双栈源站同时提供两者；跨格式重放按设计被拒绝。

## 实测结果

所有数字均可从已提交的产物复现（`npm run bench:mako`、`npm run bench:enforcement`）；
测试环境为单机回环网络，使用 60 页合成语料库。诚实的基线一并给出。

| 项目 | 结果 | 标签 |
|---|---|---|
| 转换为 markdown 配置 vs HTML | **−68.83 %** 传输字节 | 实测 |
| 增量消费（10 % 页面变更） | **−95.73 %** vs HTML 爬取 | 实测 |
| 发布方出口字节 / CPU / 峰值连接 | **−55.19 % / −56.23 % / −88.24 %** | 实测（模拟） |
| AI 侧接收字节（全部配置 / 合规客户端） | **−54.84 % / −72.93 %** | 实测（模拟） |
| 跳过的未变更页面 | 18 页中的 14 页 | 实测（模拟） |
| 签名验证成本 | **0.70 ms / 页** | 实测 |

30 天线上试点**尚未**运行；每 1,000 租户的预测标注为模型外推，厂商宣称的高达 94 %
的 token 缩减需要语义摘要，本项目不会自动执行。

## 仓库内容

| 路径 | 内容 |
|---|---|
| [`lib/`](lib/) + [`bin/`](bin/) | 零依赖参考实现与 CLI |
| [`conformance/`](conformance/) | 一致性向量：34 manifest · 39 MAKO · 11 AIFeed Markdown |
| [`wp-plugin/`](wp-plugin/) | WordPress 插件：签名 manifest、AIFeed Markdown + MAKO 双栈、`/llms.txt` |
| [`spec/`](spec/) | 规范 EN/ID/ZH：manifest v0.1/v0.2、AIFeed Markdown v1.0 |
| [`schema/`](schema/) | manifest、签名、AIFeed Markdown、MAKO 的 JSON Schema |
| [`paper/`](paper/) | 预印本：LaTeX 源码、PDF、主张台账、arXiv 打包 |
| [`docs/`](docs/) | 智能体快速上手、部署与命名空间指南、项目说明 |
| [`REFERENCE.md`](REFERENCE.md) | 参考实现细节、验证内容、CLI 快速上手 |

## 文档

- 规范：[`spec/en`](spec/en) · [`spec/id`](spec/id) · [`spec/zh`](spec/zh) · [schema](schema)
- 参考实现：[`REFERENCE.md`](REFERENCE.md)
- 维护契约（AI 智能体与开发者）：[`AGENTS.md`](AGENTS.md)
- 架构：[`docs/architecture.md`](docs/architecture.md) · 发布指南：[`docs/release.md`](docs/release.md)
- 智能体快速上手（客户端侧）：[`docs/agent-quickstart.md`](docs/agent-quickstart.md)
- 发布方 AI 指南（所有者侧）：[`docs/publisher-ai-guide.zh.md`](docs/publisher-ai-guide.zh.md)
- 发布方 Studio（本地应用）：[`studio/README.zh.md`](studio/README.zh.md)
- 完整指南：[`penjelasan-aifeed.html`](penjelasan-aifeed.html)（<https://aifeed.md/penjelasan.html> 的源码）
- 安全政策：[`SECURITY.md`](SECURITY.md)
- 治理与开放核心政策：[`GOVERNANCE.md`](GOVERNANCE.md)
- 部署站点：[`docs/deploy-site.md`](docs/deploy-site.md)
- arXiv 投稿说明：[`paper/ARXIV-SUBMISSION.md`](paper/ARXIV-SUBMISSION.md)

## 状态

- 版本 **`1.0.0-draft`**——规范**尚未冻结**。线格式版本：manifest
  `0.1`/`0.2`、AIFeed Markdown `1.0`、MAKO `0.2`。
- 一致性：34 个 manifest + 39 个 MAKO + 11 个 AIFeed Markdown 向量，由独立的
  JavaScript 与 Python 验证器执行，另有 PHP 差分夹具、90,000+ 次模糊测试执行，
  以及 WordPress 端到端测试。
- 未主张：外部密码学审计与线上试点（均在等待中）；源站+DNS 在首次接触时被同时
  攻陷无法检测。

## 许可证与联系方式

规范 **CC BY 4.0** · 参考代码与插件 **MIT** · 向量 **CC0**。
联系：<contact@aifeed.md>——安全报告请遵循
[`SECURITY.md`](SECURITY.md)。
