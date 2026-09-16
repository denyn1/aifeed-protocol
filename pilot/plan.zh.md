# AIFeed 30 天试点 — 协议

<p><a href="plan.md">English</a> · <a href="plan.id.md">Bahasa Indonesia</a> · <a href="plan.zh.md">中文</a></p>

状态：**可随时运行**（尚无试点站点）。所有工具齐备；一旦有真实站点加访问日志，
执行阶段即可开始。

## 目标

在模拟测试装置之外，测量 AIFeed 对双方的现实影响——网站所有者（带宽、CPU、执行）
与 AI 侧（字节、无效抓取、验证）。

## 角色

| 角色 | 职责 |
|---|---|
| 站点运营者 | 访问日志、插件安装、边缘规则（nginx/Caddy/Cloudflare） |
| 分析师 | 运行 `tools/pilot-report.js`，编写周报 |
| （可选）AI 伙伴 | 外部感知 AIFeed 的客户端；若无，使用 SDK 参考爬虫 |

## 时间线

| 日期 | 活动 | 产出 |
|---|---|---|
| D-7…D-1 | 基线：不启用的完整日志、机器人分类、manifest+密钥副本 | `baseline.jsonl` + 初始数字 |
| D0 | 启用插件 + 边缘规则（见 `benchmarks/edge/`），验证 manifest 与 MAKO | 启用清单 |
| D1–D7 | 第 1 周：监控拦截/限流、误判、错误 | 周报 1 |
| D8–D14 | 第 2 周：稳定限流；开始记录 delta/MAKO | 周报 2 |
| D15–D21 | 第 3 周：评估引荐流量、用户投诉（目标：零） | 周报 3 |
| D22–D28 | 第 4 周：签名验证 + 事件审计 | 周报 4 |
| D29–D30 | 最终分析与标准对比 | `pilot-report.md` + 继续/停止决定 |

## 通过标准（`tools/pilot-report.js` 自动判定）

1. AI 字节（对 AI 机器人的出口）相比基线下降 **≥40%**。
2. 人类 p95 延迟恶化不超过 **20%**。
3. 人类错误率上升不超过 **0.5 个百分点**。
4. MAKO 请求的签名验证 **0 失败**。
5. 对合法爬虫的误拦 = 0（人工核查）。

## 伦理与隐私

- 仅限运营者自有站点；不干预第三方。
- 日志经聚合与匿名化（IP 截断），保留最长 30 天，见 `instrumentation.md`。
- 不拦截搜索引擎爬虫；分类仅限 manifest 中声明的 AI 类别。
- 结果以案例研究加方法论发布，不作为统计断言。

## 如何运行

```bash
# 1. 准备 JSONL 日志（见 instrumentation.md）
# 2. 对比基线与试点
node tools/pilot-report.js --baseline pilot/baseline.jsonl --pilot pilot/pilot.jsonl --out pilot/laporan-30-hari.md
# 3. 把周报（templates/weekly-report.md）作为附录附上
```

## 监控的风险

| 风险 | 信号 | 行动 |
|---|---|---|
| 误拦 | 对合法爬虫返回 403 | 放宽分类，重试 |
| 对伙伴的 429 增多 | 合规 UA 收到 429 | 检查 manifest 限额与边缘策略 |
| 隐蔽抓取 | 匿名 UA 的 AI 流量上升 | 依赖行为（速率/路径），而非 UA |
| 延迟上升 | 人类 p95 恶化 | 降低边缘限流/CPU 负载 |
