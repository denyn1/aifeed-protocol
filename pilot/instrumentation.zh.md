# 试点埋点 — 日志 Schema 与隐私

<p><a href="instrumentation.md">English</a> · <a href="instrumentation.id.md">Bahasa Indonesia</a> · <a href="instrumentation.zh.md">中文</a></p>

`tools/pilot-report.js` 读取 **JSONL**（每行一个 JSON）。一行 = 一个规范化后的请求。

## Schema

| 字段 | 类型 | 必需 | 说明 |
|---|---|---|---|
| `ts` | string | 是 | ISO 8601 时间（UTC） |
| `host` | string | 是 | 域名/租户 |
| `path` | string | 是 | 请求路径（不含 query） |
| `profile` | enum | 是 | `human`、`search`、`training`、`plain`、`ai_other`、`compliant` |
| `status` | integer | 是 | HTTP 状态码（403/429/200/5xx） |
| `bytes` | integer | 是 | 响应正文字节数 |
| `ms` | number | 否 | 请求耗时（人类 p95） |
| `mako` | boolean | 否 | 响应为 `text/mako+markdown` 时为 `true` |
| `verified` | boolean/null | 否 | 客户端验证签名时为 `true/false`；无验证时为 `null` |

示例：

```jsonl
{"ts":"2026-10-01T08:00:01Z","host":"example.com","path":"/p/1","profile":"human","status":200,"bytes":41230,"ms":84}
{"ts":"2026-10-01T08:00:02Z","host":"example.com","path":"/p/1","profile":"training","status":403,"bytes":30,"ms":3}
{"ts":"2026-10-01T08:00:03Z","host":"example.com","path":"/p/2","profile":"compliant","status":200,"bytes":5820,"ms":12,"mako":true,"verified":true}
```

## 如何采集

### nginx（JSON 访问日志）

```nginx
log_format aifeed_json escape=json
  '{"ts":"$time_iso8601","host":"$host","path":"$uri","profile":"$aifeed_profile",'
  '"status":$status,"bytes":$body_bytes_sent,"ms":$request_time}';
access_log /var/log/nginx/aifeed.jsonl aifeed_json;
```

`$aifeed_profile` 来自 `benchmarks/edge/nginx.conf.template` 中的分类 map。若有标记
（例如通过 Accept map），可加 `"mako":$mako_served`；只有当边缘真正验证签名时才填
`"verified"`。

### WordPress + 测试装置

- AIFeed 插件提供 MAKO；在 `Accept: text/mako+markdown` 时标记 `mako`。
- `verified` 可由参考爬虫（SDK `@aifeed/verify`）写入单独日志后合并填入。
- 基线阶段不启用边缘规则；试点阶段启用边缘规则。

### 机器人分类

优先级：(1) 已知签名/UA，(2) 行为（速率、并发、路径模式），(3) 回退 `ai_other`。
UA 可被伪造——请在报告中说明该假设。

## 隐私

- **匿名化**：schema 不含 IP；如确需，存储每日轮换的单向哈希且永不公布。
- **聚合**：报告只含按配置聚合的数字；不含单个路径。
- **保留**：最长 30 天即删除；只保留聚合报告。
- **合规**：与站点隐私政策及当地法律保持一致。

## 处理

```bash
node tools/pilot-report.js --baseline pilot/baseline.jsonl --pilot pilot/pilot.jsonl --out pilot/laporan-30-hari.md
```

输出包含双方节省表（网站所有者与 AI）、执行（403/429）、签名验证、人类指标
（p95、错误率），以及带试点目标阈值的自动判定。

## 诚实边界

- 发布方侧（日志）的 AI 数字是**实测**；AI 侧按请求的节省来自 MAKO/HTML 字节对比，
  属于**估计**（附标签）。
- 报告中的源站 CPU 是**模型**（平均延迟 × 请求数），不是直接 CPU 测量。
- 日志无法证明机器人的目的（训练 vs 检索）；分类是近似，必须公开说明。
