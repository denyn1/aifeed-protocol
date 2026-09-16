# AIFeed: Verifiable Content Permissions and Efficient Agent Delivery for the AI Web

<p><a href="main.md">English</a> · <a href="main.id.md">Bahasa Indonesia</a> · <a href="main.zh.md">中文</a></p>

*草案 —— 集体作者：AIFeed Protocol Contributors。*
*LaTeX 源：[`main.tex`](main.tex) · 参考文献：[`refs.bib`](refs.bib) ·
主张台账：[`CLAIMS.md`](CLAIMS.md) · 投稿清单：[`CHECKLIST.md`](CHECKLIST.md)*

## 摘要

AI 系统现在消费的网页内容超过人类，而 `robots.txt` 中的纯文本偏好并不能阻止它们：
一家厂商在半个年度内记录了 19 亿次无视 robots 规则的爬取，一项仅限 Web 的测量把某大型
AI 提供商的爬取与引荐比定为 70,900:1。偏好与许可信号已经存在，但它们无法归属到某个
域名、无法撤销，也解决不了重复消费的成本。我们描述 AIFeed：一个开放的信任层，围绕机器
可读许可的签名 manifest 构建，在 DNS 中锚定，并对照多签名撤销注册表检查。两种内容配置
搭载于同一份签名字节：原生 markdown 格式（AIFeed Markdown）与面向外部 MAKO 草案的兼容
配置。三个特性合在一起，使本设计区别于我们所调查的信号：许可的签名来源、带仅收紧覆盖
的逐页绑定，以及让智能体跳过未变更页面的带摘要增量索引。

我们在已提交产物上测量该系统。把 60 页语料转换为 markdown 配置使传输字节减少 68.8%
（增量消费为 95.7%），一个带四种客户端配置的回环执行测试装置记录了发布方节省 55.2%
字节、56.2% CPU，AI 侧节省 54.8%（合规客户端 72.9%），18 页未变更页面跳过 14 页，
签名验证 0.70 ms/页。规范由独立的 JavaScript 与 Python 验证器、PHP 差分夹具以及
WordPress 端到端部署，对 34 个 manifest、39 个 MAKO 与 11 个 AIFeed Markdown 向量进行
演练。我们也报告不美化设计的结果：没有采用与执行就完全没有节省；厂商高达 94% token
缩减的主张依赖我们的转换器不执行的摘要；源站+DNS 联合攻陷在首次接触时不可见；兼容配置
依赖第三方草案。尚无外部密码学审计或线上试点。

## 1. 引言

网页内容正日益被自动化智能体而非人类访客消费。Cloudflare 的雷达显示 2025 年 AI 机器人
平均占 HTML 请求的 4.2%（峰值 6.4%），自动化流量接近全部 HTML 请求的一半，同期"用户
操作"智能体爬取增长超过 15 倍 [cfRadar2025]。发布方面临的不对称比这些总量更糟：一项
仅限 Web 的测量发现某大型 AI 提供商的爬取与引荐比为 70,900:1 [cfCrawlRefer]，而一家
厂商在半年内记录了 220 亿次 AI 抓取，其中 19 亿次无视 `robots.txt` [tollbit]。

生态并非空白。RFC 9309 与 IETF AIPREF 草案覆盖机器人偏好；Cloudflare 的 Content
Signals、RSL 与 W3C TDM Reservation Protocol 各自表达某种许可或许可条款
[rfc9309, draftAiprefVocab, draftAiprefAttach, cfContentSignals, rsl, tdmrep]；
`llms.txt` 为语言模型索引站点 [llmstxt]；在交换的另一侧，Web Bot Auth 正把签名智能体
请求投入生产 [draftWebbotauth, cfBotPrinciples]。缺失的是两件事。发布方的声明无法归属：
任何中间人都能改动它，也没有标准让发布方撤销它。而且即使声明被遵守，机械成本依旧
未动，因为智能体继续以浏览器形态的 HTML 拉取未变更页面。

**贡献。**（1）AIFeed v0.1 的设计：Ed25519 签名、JCS 规范化、位于
`/.well-known/ai.json` 的 manifest，DNS 锚定、可离线验证，带多签名撤销与有界陈旧度。
（2）内容配置：AIFeed Markdown v1.0（原生）与 MAKO 兼容共享同一份签名字节、仅收紧的
逐页覆盖，以及带站点摘要与分流字段的摘要增量索引。（3）零依赖参考栈：CLI、JavaScript
SDK、独立 Python 验证器、WordPress 插件、静态站点构建器与八个服务器适配器。
（4）可复现评估：已提交产物、一致性向量、模糊测试、跨语言差分测试；不利结果一并报告。

## 2. 背景与相关工作

- **偏好与许可信号。** 机器人偏好在 RFC 9309 中标准化 [rfc9309]，IETF AIPREF 工作组
  正在为 AI 使用偏好编制词汇，并为 HTTP 响应提供 attachment 机制 [draftAiprefVocab,
  draftAiprefAttach]。业界走得更快：Cloudflare 的 Content Signals Policy 报告经托管
  robots 文件在 380 万+ 域名上被采用 [cfContentSignals]，并在同一边缘提供按次爬取计费
  [cfPayPerCrawl]；RSL 增加许可与补偿条款 [rsl]；W3C TDMRep 处理文本与数据挖掘保留
  [tdmrep]；`llms.txt` 为语言模型提供站点级索引 [llmstxt]。这些都没有提供：把声明归属
  到域名、撤销路径，或独立于传输信道的验证。
- **智能体侧认证。** Web Bot Auth [draftWebbotauth, draftWebbotArch] 基于 RFC 9421 与
  Ed25519 [rfc9421, rfc8032]，已有生产部署 [cfBotPrinciples]。AIFeed 把同样的原语用在
  相反方向（发布方签名）。
- **面向智能体的内容格式。** MAKO 定义逐页 markdown，并明确将真实性验证排除在范围外
  [makoSpec]。2026 年的若干项目占据相邻地带：`ai-policy.json` 在 well-known URL 汇总
  许可声明，无签名、锚定或撤销 [aipolicyjson]；`agents.txt` 把身份、条款与端点放进根
  文件 [agentstxt]；CrawlWall 在边缘执行爬虫策略，带签名审计账本与回执 [crawlwall]；
  `terms.txt` 走得最远，规定按路径、按用途的条款与签名交换、委托令牌和支付协商
  [chowdhury2026]；学术侧 `ai.txt` 提出引导 AI 交互的 DSL [li2025aitxt]。截至我们的
  检查（2026-09-15），没有发现任何单一项目同时结合：发布方签名许可 + DNS 锚点与撤销、
  基于同一签名载荷的双内容配置、可验证的增量索引——我们的主张是这一组合，而非发明了
  其中任何部分。
- **测量与经济学。** 大量实证文献在大规模上研究机器人：基于分类器的 robots 使用分析
  [lee2009]、作为引导协议的排除 [ge2016]、基于 robots 的守门 [steinacker2025]、
  创作者保护效果（IMC 2025）[liu2025]、小型组织防护 [hoetzlein2026]、智能体对带内信号
  的合规 [munirathinam2026]、按次爬取定价 [archer2026]。行业报告提供流量不对称
  [cfRadar2025, tollbit, cfCrawlRefer, cfContentIndependence]，一家研究中心记录了 AI
  摘要如何影响用户 [pew2025]。监管背景：EU AI Act 与 2026 年 TDM 选择退出注册表可行性
  研究 [euAiact, euTdmRegistry]；印度尼西亚 PDP 法作为国家示例 [uuPdp27]。法律评述是
  开放问题，不是法律意见。

## 3. 设计

**信任链。** TLS → 域名匹配 → 对 JCS 规范形式的 Ed25519 签名，带域分离
（`aifeed.v0.2\n`）→ DNS TXT 锚点（`_aifeed`）。well-known URI [rfc8615]；严格
JSON/I-JSON [rfc8259, rfc7493]；RFC 3339 时间戳 [rfc3339]；JCS [rfc8785]；BCP 14
关键词 [rfc2119, rfc8174]；透明日志模式 [rfc9162]。密钥固定检测替换；首次接触的
源站+DNS 联合攻陷不可检测。

**许可与可撤销性。** 按用途的许可（search、retrieval、input、training、quote、
summarize、reproduce、translate、modify、embed、commercial use）、署名与爬取限额。
带多签名文档的撤销注册表、正当程序状态（`active`、`under_review`、`suspended`）、
有界陈旧度（168 小时）。信任级别 `VERIFIED` / `UNVERIFIED` / `SUSPENDED`。

**内容配置。** AIFeed Markdown v1.0（`text/aifeed+markdown`、`.aifeed.md`、标记
`aimd: "1.0"`、媒体类型程序 [rfc6838, rfc7763]）与 MAKO 1.0
（`text/mako+markdown`）[makoSpec]。双栈服务器在两种媒体类型下交付相同字节，签名上下文
不同（`aimd` / `mako`），防止跨格式重放。逐页 `aifeed` 块默认仅收紧；资源链接让智能体
自选抓取内容；frontmatter 解析器只接受安全 YAML 子集。

**增量消费。** `/.well-known/aifeed-index.json`（+ `.sig`，上下文 `aimd-index`）带逐页
`sha-256`、ETag、tokens、站点摘要与分流字段（title、summary、tags、language、
related）。客户端比较摘要，只抓取变化的页面；未变更页面成本为零字节（条件请求
[rfc9110, rfc7231]、摘要字段 [rfc9530]、链接 [rfc8288]）。索引条目在被验证前是不可信
声明。

## 4. 威胁模型

一致性覆盖：外部域名 manifest、签名后编辑、密钥替换、源站/DNS 攻陷、网络修改、过期
CDN、重放、传输损坏、本地重排、文档篡改、摘要不匹配、跨 URL 与跨上下文重放、策略要求
签名时的剥离、fail-open 覆盖，以及 YAML 解析器滥用。明确不主张：首次接触的源站+DNS
联合攻陷；markdown 衍生品对 HTML 渲染的忠实度。执行是生效的前提：19 亿次绕过事件表明
未执行的偏好只是建议 [tollbit]。密钥替换由轮换仪式处理（v0.2 §14）：旧密钥签名的后继
指令加建议性 DNS `pk2` 交叉校验、有界重叠窗口、切换后永久撤销。这限定但不消除被泄露
密钥的接受窗口；它也防不住已经控制源站内容与 DNS 的攻击者。

## 5. 实现

零依赖参考栈 [aifeedRepo]：严格解析器 + 安全 YAML 子集；JCS + Ed25519；CLI
（`keygen`、`sign`、`validate`、`bundle`、`aimd|mako generate|sign|verify|index|fetch`、
`site build`）；npm SDK `@aifeed/verify`；独立 Python 验证器；WordPress 插件（双栈服务、
签名索引、资源、分流、`llms.txt`）；静态站点构建器；八个服务器适配器。规范：AIFeed
v0.1 [aifeedSpec01]、v0.2 [aifeedSpec02]、AIFeed Markdown v1.0 [aimdSpec]。一致性：
JavaScript 与 Python 中的 34 个 manifest + 39 个 MAKO + 11 个 AIFeed Markdown 向量；
PHP 差分夹具；WordPress 端到端测试。

## 6. 评估

所有数字均可从已提交产物复现（`benchmarks/*.json`、`npm run bench:mako`、
`npm run bench:enforcement`）；固定种子；单机；回环网络；含导航、广告、评论与脚本的
合成语料。

**内容效率（60 页）。** 含签名字节 1,205,292 → 375,630：**−68.83%**；token 估计
−68.8%；签名 0.25 ms/页；验证 0.34–0.70 ms/页。10% 页面变更下的增量：51,408 字节，
相比 HTML 爬取 **−95.73%**（未变更假定 304）。MAKO 高达 94% 的主张以发布方摘要为前提；
我们的忠实转换器测得 68.8%，我们报告较小的值。

**执行测试装置（18 页站点，四种客户端配置）。**

| 指标 | S0 | S1 | S2 | S3 |
|---|---:|---:|---:|---:|
| 源站请求 | 63 | 45 | 42 | 30 |
| 源站字节 | 177,537 | 104,084 | 95,580 | 79,555 |
| 源站 CPU（ms） | 46.6 | 31.1 | 28.6 | 20.4 |
| 峰值并发 | 17 | 4 | 2 | 2 |
| 403 拦截 / 429 限流 | 0 / 0 | 18 / 0 | 18 / 11 | 18 / 11 |
| 客户端接收字节 | 177,537 | 104,570 | 96,198 | 80,173 |
| 人类 p95 延迟（ms） | 20.0 | 23.2 | 19.9 | 19.3 |
| 发布方字节节省 | — | 41.4% | 46.2% | **55.2%** |
| 发布方 CPU 节省 | — | 33.4% | 38.8% | **56.2%** |
| AI 字节节省（全部 / 合规） | — | 41.1% / 42.5% | 45.8% / 42.5% | **54.8% / 72.9%** |

100 租户运行：执行后源站字节 962,373 → 451,038；每 1,000 租户的预测为线性外推（已如此
标注）。没有执行时，节省按构造为零。

**正确性与稳健性。** 零签名验证失败；跨上下文与跨 URL 重放被拒绝；篡改被摘要不匹配
捕获；90,000+ 次模糊执行无违反不变量；WordPress 端到端通过协商、内联与索引签名、
资源、分流与 `llms.txt`。

## 7. 讨论与局限

- **依赖执行的双边采用。** 声明只有在被消费或执行时才有意义；AIFeed 是 CDN、WAF 与
  托管平台可验证的输入。
- **兼容性依赖。** MAKO 是第三方草案（已固定版本）；AIFeed Markdown 提供独立的原生
  配置。
- **首次使用信任（TOFU）。** 固定、防回滚与透明日志缓解但不消除首次接触攻陷。
- **评估范围。** 单机、回环、合成；尚无线上试点（试点套件已发布）；人类延迟影响仅受
  测试装置策略约束。
- **法律问题开放。** TDM 选择退出制度与各国法律需要法律顾问；标签标记假设。
- **利益冲突。** 作者即设计者；缓解措施是开放产物与复现命令；外部密码学审计待办。

## 8. 结论与未来工作

在发布方一侧，可密码学归属的许可是可规定、可零依赖实现且可测量的：执行下发布方
字节/CPU 节省 55–56%，AI 侧字节节省 55–73%，稳态增量节省 95.7%，亚毫秒级验证。剩余
工作是制度性的：独立密码学审计、线上试点、上游标准化（MAKO 扩展；协议核心的 IETF
Internet-Draft），以及多利益相关方注册表治理。所有产物均已发布，供复现与挑战。

## 伦理与产物可用性

仅合成页面；无个人数据。规范与 schema 为 CC BY 4.0；代码 MIT；向量 CC0。公开仓库 URL
记录于 `CHECKLIST.md`。

## 参考文献

带已核验元数据的 BibTeX 条目位于 [`refs.bib`](refs.bib)。上文使用的键：
`rfc2119`, `rfc3339`, `rfc6838`, `rfc7231`, `rfc7493`, `rfc7763`, `rfc8174`, `rfc8259`,
`rfc8288`, `rfc8615`, `rfc8785`, `rfc8032`, `rfc9110`, `rfc9162`, `rfc9309`, `rfc9421`,
`rfc9530`, `draftAiprefVocab`, `draftAiprefAttach`, `draftWebbotauth`, `draftWebbotArch`,
`makoSpec`, `rsl`, `llmstxt`, `tdmrep`, `cfRadar2025`, `cfCrawlRefer`, `cfContentSignals`,
`cfContentIndependence`, `cfBotPrinciples`, `cfPayPerCrawl`, `tollbit`, `pew2025`,
`euAiact`, `euTdmRegistry`, `uuPdp27`, `liu2025`, `chowdhury2026`, `li2025aitxt`,
`steinacker2025`, `lee2009`, `ge2016`, `archer2026`, `hoetzlein2026`, `munirathinam2026`,
`aifeedRepo`, `aifeedSpec01`, `aifeedSpec02`, `aimdSpec`, `aipolicyjson`, `agentstxt`,
`crawlwall`.
