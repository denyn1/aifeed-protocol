# 边缘执行模板（nginx / Caddy）

<p><a href="README.md">English</a> · <a href="README.id.md">Bahasa Indonesia</a> · <a href="README.zh.md">中文</a></p>

`tools/bench-enforcement.js` 所演练策略的生产侧对等模板。测试装置在回环环境证明策略
逻辑；这些文件让你在带真实客户端的 VPS 上复现它。

## 文件

| 文件 | 目标 |
|---|---|
| `nginx.conf.template` | nginx（无需额外模块；通过 map 实现静态限流） |
| `Caddyfile.template` | Caddy（403 规则开箱即用；限流需要 `caddy-ratelimit`） |

把 `ORIGIN_HOST`/`ORIGIN_PORT` 换成你的上游，审阅限额，然后先在预发布主机运行。
绝不要拦截搜索引擎爬虫：分类清单只限于你确实想拒绝的 AI 训练/UA 类别。

## Manifest 到边缘的映射

| Manifest 字段 | nginx | Caddy |
|---|---|---|
| `permissions.usage.training: deny` | `map ... training -> 403` | `@training` matcher + `respond 403` |
| `limits.requests_per_minute` | `limit_req_zone ... rate=15r/m` | `rate_limit ... events 15, window 1m` |
| `limits.concurrent` | `limit_conn_zone` + `limit_conn 2` | `rate_limit ... events 2, window 1s` |
| 放行人类与感知 AIFeed 的客户端 | 这些配置的 key 为空 | matcher 作用域限流 |
| `/.well-known/ai.json` 与 `/.well-known/mako-index.json` 始终可读 | well-known map 保持 key 为空 | 优先处理 `@wellknown` |

`429` 响应带 `Retry-After: 2`，与测试装置一致。

## 验证流程

1. 运行本地测试装置并以其数字为基准：
   ```bash
   cd aifeed-protocol
   npm run bench:enforcement
   ```
2. 把模板部署到带真实源站的预发布 VPS（WordPress 插件、静态站点，或文件服务器后面
   的测试语料）。
3. 发送相同的客户端形态并对比：
   ```bash
   # 训练爬虫必须收到 403
   curl -s -o /dev/null -w '%{http_code}\n' -A 'GPTBot/1.0' https://staging.example/p/1

   # 普通爬虫超过阈值后必须收到 429，并带 Retry-After
   for i in $(seq 1 20); do
     curl -s -o /dev/null -D - -A 'CrawlerX/1.0' https://staging.example/p/1 | grep -E 'HTTP|Retry-After'
   done

   # 合规客户端与人类保持 200
   curl -s -o /dev/null -w '%{http_code}\n' -A 'AIFeedBot/0.3' https://staging.example/p/1
   curl -s -o /dev/null -w '%{http_code}\n' -A 'Mozilla/5.0' https://staging.example/p/1
   ```
4. 用与测试装置相同的指标记录结果（请求、字节、CPU、blocked、limited、人类 p95），
   并附到试点套件（`pilot/instrumentation.md`）。

## 预期结果

- 训练爬虫：内容返回 `403`，`/.well-known/*` 返回 `200`（它们仍可读取声明；manifest
  是公开契约）。
- 不合规爬虫：超过限额后 `429` + `Retry-After`，随后恢复。
- 人类与 `AIFeedBot`：不受影响（`200`），p95 在正常波动范围内。
- 发布方出口与源站 CPU 的下降大致与测试装置 S1–S3 的数字一致（实测模拟值见
  `benchmarks/enforcement-report.md`）。

## 注意事项

- 静态限流：签名 manifest 变化时，更新并重载边缘配置。完全动态的按 manifest 策略需要
  OpenResty/njs、Caddy 插件或 AIFeed PDP 中间件。
- 前置 CDN（Cloudflare 等）可能规范化或剥离 `User-Agent`；尽量按行为（速率/并发/路径）
  分类，并记录回退方案。
- 模板只是起点，不是经过认证的 WAF 配置；在生产流量上启用前先测试。
