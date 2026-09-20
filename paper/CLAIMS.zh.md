# 主张台账

<p><a href="CLAIMS.md">English</a> · <a href="CLAIMS.id.md">Bahasa Indonesia</a> · <a href="CLAIMS.zh.md">中文</a></p>

论文中的每项定量主张都在此追溯。类型：
**[peer]** 同行评审出版物 · **[std]** 标准/规范 ·
**[ind]** 行业报告或厂商声明 · **[meas]** 我们可复现的测量 ·
**[sim]** 我们的模拟（回环测试装置）· **[model]** 我们的外推 ·
**[hyp]** 假设，不作为事实主张。

Bib 键指向 `refs.bib`。网络来源访问日期：2026-09-14/15。

## 问题证据（外部）

| # | 主张 | 数值 | 来源 | 类型 |
|---|---|---|---|---|
| C1 | AI 机器人占 HTML 请求比例（2025） | 平均 4.2%（2.4–6.4%） | `cfRadar2025` | ind |
| C2 | Googlebot 占比；峰值 | 4.5%；11% | `cfRadar2025` | ind |
| C3 | 2025 年"用户操作"智能体爬取的增长率 | >15 倍（最高约 21 倍） | `cfRadar2025` | ind |
| C4 | 机器人 vs 人类占 HTML 请求比例（2025-12-02） | 非 AI 机器人 ≈44%，人类 47% | `cfRadar2025` | ind |
| C5 | 已验证机器人构成 | AI 爬虫 20%、搜索 40%、GPTBot 7.5% | `cfRadar2025` | ind |
| C6 | 机器人流量预测 | 2029 年机器人超过人类；2031 年机器人活动超过当前总流量 | `cfContentSignals` | ind（预测） |
| C7 | 检测到的 AI 抓取，2026 上半年 | 987B+ 访问中的 22B+ | `tollbit` | ind |
| C8 | robots.txt 绕过，2026 上半年 | 1.9B+ | `tollbit` | ind |
| C9 | 被导向付费墙的机器人，2026 上半年 | 2.6B+ | `tollbit` | ind |
| C10 | Anthropic 爬取与引荐比（仅 Web，2025-06-19 至 26） | 70,900:1 | `cfCrawlRefer` | ind |
| C11 | 产生引荐相对历史搜索的难度 | OpenAI 750×、Anthropic 30,000× | `cfContentIndependence` | ind（厂商分析） |
| C12 | 零点击移动查询 | 75% | `cfContentIndependence` | ind（厂商分析） |
| C13 | 身份缺口与隐蔽抓取 | xAI 无标识；Anthropic 仅 UA；Perplexity 隐蔽 | `cfBotPrinciples` | ind |
| C14 | 生产环境中的密码学机器人签名 | ChatGPT Agent 签名（Ed25519 + RFC 9421）；Vercel 验证 | `cfBotPrinciples`, `draftWebbotauth` | ind + std |
| C15 | Content Signals 采用 | 380 万+ 域名 | `cfContentSignals` | ind |
| C16 | 爬取付费市场 | Pay Per Crawl beta（HTTP 402）；TollBit 融资 $31M+；大型出版商 | `cfPayPerCrawl`, `tollbit` | ind |
| C17 | AI 摘要下的用户点击行为 | 有摘要时点击更少 | `pew2025` | 研究机构报告 |
| C18 | EU AI Act 时间线；EU TDM 选择退出注册表可行性研究于 2026-07-13 发布 | — | `euAiact`, `euTdmRegistry` | 官方 |
| C19 | 印度尼西亚 PDP 法 27/2022 生效 | — | `uuPdp27` | 官方 |
| C20 | 针对 AI 爬虫的创作者保护研究 | IMC 2025 | `liu2025` | peer（已接受） |
| C21 | terms.txt：智能体访问的同意/补偿协议 | arXiv 2609.11152（2026-09） | `chowdhury2026` | 预印本 |
| C22 | ai.txt：引导 AI 交互的 DSL | arXiv 2505.07834（2025-05） | `li2025aitxt` | 预印本 |
| C23 | robots.txt 守门研究 | arXiv 2510.10315（2025-10） | `steinacker2025` | 预印本 |
| C24 | 超 10 亿请求的 Web 机器人分类 | Computers & Security 2009 | `lee2009` | peer |
| C25 | 机器人排除与引导协议 | Tsinghua Sci. Technol. 2016 | `ge2016` | peer |
| C26 | 按次爬取定价模型 | arXiv 2604.01416（2026-04） | `archer2026` | 预印本 |
| C27 | 小型组织的机器人防护（logrip） | arXiv 2508.03130（2025-08） | `hoetzlein2026` | 预印本 |
| C28 | LLM 智能体对带内治理信号的合规 | arXiv 2606.06460（2026-06） | `munirathinam2026` | 预印本 |
| C29 | 相邻项目：无签名的合并许可 manifest（`ai-policy.json`）、无签名发现文件（`agents.txt`）、带签名账本的边缘执行（`CrawlWall`）、带签名交换/支付的按用途条款（`terms.txt`） | 检查于 2026-09-15 | `aipolicyjson`, `agentstxt`, `crawlwall`, `chowdhury2026` | 检查（GitHub 仓库 + 预印本） |
| C30 | **组合主张：** 依据截至 2026-09-15 所检查的来源，没有任何单一项目同时结合：发布方签名许可 + DNS 锚点与撤销、基于同一签名载荷的原生与兼容内容配置、可验证的增量索引 | — | C20–C29 的综合 | 检查，明确非穷尽 |

## 我们的测量与模拟（本仓库产物）

| # | 主张 | 数值 | 产物 | 类型 |
|---|---|---|---|---|
| M1 | AIFeed Markdown/MAKO 转换 vs HTML，字节 | −68.83%（60 页合成语料，含签名 1,205,292 → 375,630 B） | `benchmarks/mako-benchmark.json` | meas |
| M2 | token 估计减少（ceil(bytes/4)） | −68.8% | 同上 | meas（启发式） |
| M3 | 增量消费 vs 完整 HTML 爬取 | −95.73% | 同上（10% 页面变更；未变更假定 `304`） | sim |
| M4 | 增量 vs 完整 MAKO 抓取 | −86.31% | 同上 | sim |
| M5 | 签名与验证成本 | 签名 0.25 ms/页；验证 0.34–0.70 ms/页；索引验证已实测 | 同上 + `benchmarks/enforcement-report.json` | meas（视机器而定） |
| M6 | 执行下的发布方节省（S3） | 字节 −55.19%、源站 CPU −56.23%、峰值并发 −88.24% | `benchmarks/enforcement-report.json` | sim |
| M7 | 执行下的 AI 侧节省（S3） | 全部配置 −54.84%；合规客户端 −72.93% | 同上 | sim |
| M8 | 经增量跳过的未变更页面（18 页站点） | 14/18 | 同上 | sim |
| M9 | 100 租户规模，S0 vs S3 | 源站字节 962,373 → 451,038；每 1,000 租户预测见产物 | 同上 | meas + model |
| M10 | 一致性向量通过，跨语言 | JS 与 Python 中的 34 manifest + 39 MAKO + 11 AIFeed Markdown | `conformance/` | meas |
| M11 | 解析器/验证器模糊测试 | 90,000+ 次执行，零不变量失败 | `tools/fuzz*.js` | meas |
| M12 | 签名验证正确性 | 0 失败；跨格式/上下文重放被拒绝（WordPress E2E + 向量） | `tests/`、E2E 脚本 | meas |
| M13 | 厂商主张 vs 忠实转换 | MAKO 宣称最高 −94% token（语义优化）；我们的忠实转换器实测字节 −68.8%——差距来自发布方选择的摘要，并非协议所实现 | `makoSpec` vs `benchmarks/` | 对比 |
| M14 | 密钥轮换（v0.2 §14） | 4 个正例 + 5 个反例一致性向量；后继密钥由旧密钥签名指令绑定，辅以建议性 DNS `pk2` 交叉校验；1 小时硬重叠下限 | `conformance/vectors/*/0{08..11,119..123}-rotation*` | meas |
| M15 | 无采用/执行时的节省 | ≈0（S0 基线提供一切；绕过证据 C8） | 同上 | 分析 |
| M16 | 资源完整性元数据（v0.2 §6.1） | 已声明资源可选 `mime`/`size`/`sha-256`；本地构建哈希源文件（≤16 MiB），SDK `verifyAsset` 逐字节校验下载（单元 + 线上检查）；索引条目暴露资源数量用于预取分流 | `conformance/mako/positive/009-aifeed-assets`、`tests/sdk.test.js`、线上 `shop.aifeed.md` | meas |

## 非定量主张（随范围声明）

- 验证链（TLS → 域名匹配 → Ed25519 → DNS 锚点）的强度取决于最弱一环；首次接触时的
  源站+DNS 联合攻陷不可检测（TOFU）。
- 签名证明来源，而非 markdown 对 HTML 渲染的忠实度。
- 兼容配置依赖第三方草案（MAKO）；AIFeed Markdown 配置独立。
- 预印本时尚未完成外部密码学审计或 30 天线上试点；两者均已计划，状态在论文中披露。
- 法律陈述标注 **[H]**，不构成法律意见。

## 已纳入的不利结果

- M13（厂商主张差距）、M15（无执行则零节省）、TOFU 限制、单机合成评估、无生产 CDN
  数据、对草案规范的依赖，以及双边采用的冷启动。
