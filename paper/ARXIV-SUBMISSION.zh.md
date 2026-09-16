# arXiv 投稿包

<p><a href="ARXIV-SUBMISSION.md">English</a> · <a href="ARXIV-SUBMISSION.id.md">Bahasa Indonesia</a> · <a href="ARXIV-SUBMISSION.zh.md">中文</a></p>

预印本的可上传打包：

> **AIFeed: Verifiable Content Permissions and Efficient Agent Delivery for the AI Web**

## 需要上传的文件

| 文件 | 用途 |
|---|---|
| `paper/main.tex` | LaTeX 源（自包含；TikZ 图内联） |
| `paper/refs.bib` | 参考文献（52 条已核验条目，natbib/plainnat） |
| `paper/00README.json` | 告知 arXiv AutoTeX 使用 `pdflatex` |
| `paper/aifeed-arxiv.tar.gz` | **上传此文件**（arXiv 偏好 `.tar.gz`） |

编辑论文后重新生成打包：

```bash
cd paper
tar -czf aifeed-arxiv.tar.gz main.tex refs.bib 00README.json
```

本机未安装 LaTeX；arXiv 自行运行 `pdflatex` + BibTeX。若出现参考文献错误，请在
Overleaf 打开项目、编译一次、下载生成的 `main.bbl`，再与 `main.tex`、`refs.bib`
一起重新上传（这是 `plainnat` 唯一常见的失败模式）。

## 投稿表单元数据

**标题：** AIFeed: Verifiable Content Permissions and Efficient Agent Delivery for the AI Web

**作者：** AIFeed Protocol Contributors

**主分类：** `cs.CR`（密码学与安全）
**交叉列表：** `cs.AI`（人工智能）、`cs.IR`（信息检索）、
`cs.NI`（网络与互联网架构）

**备注：** 预印本，13 个章节。参考实现、schema 与 84 个一致性向量：
https://github.com/denyn1/aifeed-protocol

**许可证：** 建议 **CC BY 4.0**（规范为 CC BY 4.0；代码为 MIT）。

**摘要（表单用纯文本）：**

AI systems now consume more web content than people do, and the plain-text preferences in
robots.txt do not hold them back: one vendor logged 1.9 billion crawls that ignored robots
rules in a single half-year, and one web-only measurement put the crawl-to-referral ratio
of a major AI provider at 70,900:1. Preference and licensing signals exist, but they are
not attributable to a domain, cannot be revoked, and do nothing about the cost of repeated
consumption. We describe AIFeed, an open trust layer built around a signed manifest of
machine-readable permissions, anchored in DNS and checked against a multi-signature
revocation registry. Two content profiles ride on the same signed bytes: a native markdown
format (AIFeed Markdown) and a compatibility profile for the external MAKO draft. Three
properties, taken together, distinguish the design from the signals we surveyed: signed
provenance of permissions, per-page binding with restrict-only overrides, and a
digest-bearing delta index that lets an agent skip pages that have not changed.

We measure the system on committed artifacts. Converting a 60-page corpus to the markdown
profiles cuts transferred bytes by 68.8% (95.7% for delta consumption), and a loopback
enforcement harness with four client profiles records publisher savings of 55.2% of bytes
and 56.2% of CPU, AI-side savings of 54.8% (72.9% for the compliant client), 14 of 18
unchanged pages skipped, and signature verification at 0.70 ms per page. The specification
is exercised by 34 manifest, 39 MAKO, and 11 AIFeed Markdown vectors under independent
JavaScript and Python verifiers, plus differential PHP fixtures and an end-to-end
WordPress deployment. We also report results that do not flatter the design: without
adoption and enforcement there are no savings at all; vendor claims of up to 94% token
reduction rely on summarization our converter does not perform; origin-plus-DNS compromise
is invisible on first contact; and the compatibility profile depends on a third-party
draft. No external cryptographic review or live pilot exists yet.

## 点击提交之前

- [x] 带固定标签的公开仓库（`v1.0.0-draft`）——
      https://github.com/denyn1/aifeed-protocol
- [ ] 确认联络邮箱（作者脚注中的 `contact@aifeed.md` 仍是占位；请创建邮箱或换成真实
      地址）
- [ ] arXiv 账号 + `cs.CR` 所需背书（首次投稿者可能需要背书人；投稿表单会说明）
- [ ] 可选：把仓库转移到 `aifeed` 组织，并更新 `main.tex` 中的产物 URL
      （一次 `replace` + 重建打包）
- [ ] 被接收后：把 arXiv ID 加到 `paper/CHECKLIST.md` 与站点页脚

## 投稿之后

1. arXiv 列表 URL 与 DOI（若分配）写入 `paper/CHECKLIST.md`。
2. 如需要，在落地页页脚引用该预印本。
3. 保留 `v1.0.0-draft` 作为审阅者使用的固定产物版本；论文内部的线格式版本
   （manifest 0.1/0.2、AIFeed Markdown 1.0、MAKO 0.2）与发布号相互独立。
