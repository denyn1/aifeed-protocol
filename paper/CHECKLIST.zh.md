# 论文投稿清单（arXiv → 之后 IETF）

<p><a href="CHECKLIST.md">English</a> · <a href="CHECKLIST.id.md">Bahasa Indonesia</a> · <a href="CHECKLIST.zh.md">中文</a></p>

状态标记：**[x]** 已完成并核实 · **[ ]** 待办 · **[!]** 投稿阻塞项。

## 元数据

- **[x]** 标题：*AIFeed: Verifiable Content Permissions and Efficient Agent
  Delivery for the AI Web*（工作标题）。
- **[x]** 集体作者：`AIFeed Protocol Contributors`。
- **[!]** 集体作者的联络邮箱 —— 上传前确认（草稿中为占位 `contact@aifeed.md`）。
- **[x]** 主分类：`cs.CR`（密码学与安全）；交叉列表 `cs.CY`（计算机与社会），
  可选 `cs.NI`。
- **[x]** 预印本许可证：**CC BY 4.0**（与规范一致）。
- **[x]** 摘要长度保持在 1,920 字符以内（已在 `main.tex` 检查）。
- **[!]** arXiv 账号 + `cs.CR` 背书 —— 新作者首次投稿必需；请尽早开始，可能耗时数日。

## 参考文献（精确性审计）

- **[x]** RFC 已对照 rfc-editor.org 头部核实（17 项：2119、8174、3339、8032、8259、
  7493、8615、9110、9309、9421、9530、9162、8288、6838、7763、7231 + DOI
  `10.17487/*`）。
- **[x]** IETF 草案固定到修订版 + 日期：
  `draft-ietf-aipref-vocab-08`（2026-09-14）、`draft-ietf-aipref-attach-05`
  （2026-08-19）、`draft-ietf-webbotauth-httpsig-protocol-00`（2026-09-01）、
  `draft-meunier-web-bot-auth-architecture-05`（2026-03-02）。
- **[x]** MAKO 规范固定到提交 `de7c0d59`（2026-02-18，Apache-2.0）。
- **[x]** 行业来源已核实可访问并记录日期：Cloudflare Radar 2025、Cloudflare
  crawl-to-refer（2025-07-01）、Content Signals（2025-09）、Responsible AI Bot
  Principles（2025-09-24）、Pay Per Crawl（2025-07-01）、TollBit H1 2026（主页）、
  Pew Research（2025-07-22）。
- **[x]** 同行评审/学术引用已核实作者、年份、DOI/arXiv ID：Liu 等（IMC 2025）、
  Lee 等（C&S 2009，`10.1016/j.cose.2009.05.004`）、Ge & Ding（TST 2016，
  `10.1109/tst.2016.7787007`）、Chowdhury（2026）、Steinacker-Olsztyn 等（2025）、
  Li 等（2025）、Munirathinam（2026）、Archer 等（2026）、Hoetzlein（2026）。
- **[x]** 相邻项目的先行技术检查（2026-09-15）记录于 `CLAIMS.md`（C29/C30）：
  `ai-policy.json`、`agents.txt`、`CrawlWall`、`terms.txt`；论文给出的是组合主张，
  而非排他性。
- **[ ]** 找到 Liu 等 IMC 2025 的 ACM DOI 后补上（目前引用为
  "arXiv:2411.15091, accepted at IMC 2025"）。
- **[ ]** 投稿当天最后再检查一遍所有固定版本/URL（草案会变动）。

## 主张台账

- **[x]** `CLAIMS.md` 覆盖每项定量主张，附来源 + 类型（测量 / 模拟 / 行业报告 /
  同行评审 / 标准）。
- **[x]** 纳入不利结果：厂商主张差距（−94% token vs −68.8% 字节转换）、无采用/执行
  则零节省、TOFU 限制、第三方草案依赖。
- **[x]** 公司/利益冲突披露已起草：作者即协议设计者；缓解措施已列出（开放产物、
  复现命令、外部审计待办）。

## 产物与可复现性

- **[x]** 本地 git 仓库已初始化，`.gitignore` 排除密钥与缓存。
- **[x]** 公开仓库 URL（GitHub）—— https://github.com/denyn1/aifeed-protocol
  （公开，固定标签 `v1.0.0-draft`）。可选：之后转移到 `aifeed` 组织并更新
  `paper/main.tex` 与本清单中的 URL。
- **[!]** 规范域名 —— **`aifeed.md` 已于 2026-09-16 购买**。迁移
  `aifeed.org` → `aifeed.md` 已应用并通过回归测试（见 `docs/namespace-setup.md`）。
  投稿前剩余：配置 DNS（A/AAAA + `www`，见文档）、创建 `contact@aifeed.md`，
  并在与占位不同时更新本稿的联络邮箱。
- **[ ]** 为投稿快照打标签（如 `paper-v1`、`v1.0.0-draft`），便于审阅者固定引用。
- **[x]** 复现命令已记录：`npm test`、`npm run test:py`、
  `npm run {vectors,mako:vectors,aimd:vectors}:check`、`npm run bench:mako`、
  `npm run bench:enforcement`、`npm run render:html`。
- **[x]** 诚实的环境说明：单机、回环测试装置、合成语料、确定性种子；无生产 CDN/
  试点数据。

## 稿件机制

- **[x]** LaTeX 源（`paper/main.tex`、`paper/refs.bib`）+ 供审阅的 Markdown 镜像。
- **[x]** 结构交叉检查：`npm run paper:check` —— 52/52 引文键在 `refs.bib` 中解析，
  所有 LaTeX 环境配平。
- **[!]** 编译检查：作者机器上未检测到本地 TeX 发行版；上传前请在 Overleaf 编译或
  安装 TeX Live。
- **[x]** 图：无外部文件 —— 表格加一个内联 TikZ 图，编译时不缺任何资产文件。
- **[ ]** 最后一轮校对偏见语言（主张中不使用营销形容词）。

## arXiv 之后

- **[ ]** 把 `docs/EXTENSION.md` 提交给 mako-spec（上游信任层提案）。
- **[ ]** 把协议核心转化为 IETF Internet-Draft（AIFeed Markdown/MAKO 配置作为附录）。
- **[ ]** 与论文一起发布开放核心许可政策摘要（已在 `GOVERNANCE.md`）。
