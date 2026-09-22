# 适用于 DeepSeek Harness 的 AIFeed 插件

[English](README.md) · [Bahasa Indonesia](README.id.md) · [中文](README.zh.md)

这是一个 Cordis 插件，为 DeepSeek Harness 提供六个可由模型调用的工具，用于处理
[AIFeed](https://aifeed.md)：面向 AI 网络的内容许可签名标准。它复用与
[`aifeed-mcp-server`](../../packages/aifeed-mcp-server) 相同的零依赖引擎 ——
`engine/` 副本（`server.js`、`lib`、`schema`）由仓库根目录的 `npm run build:harness` 生成。

## 工具

| 工具 | 作用 |
|---|---|
| `aifeed_verify_manifest` | 验证 manifest：签名、DNS `_aifeed` 锚点、结果（VERIFIED/UNVERIFIED） |
| `aifeed_fetch_aifeed` | 按 token 预算获取 AIFeed Markdown/MAKO 页面，含许可信息与可选签名校验 |
| `aifeed_list_assets` | 列出签名页面声明的图片/视频/文档 |
| `aifeed_verify_asset` | 下载声明的资源并校验大小/sha-256 |
| `aifeed_select_index` | 在页面/token 预算内对签名增量索引条目排序 |
| `aifeed_decide_usage` | 判断某项用途（retrieval、training 等）是否被允许 |

## 安装

```sh
dsh plugin --profile web add @aifeed/deepseek-harness
dsh --profile web --dump-config   # 显示 bundle 层
dsh web
```

该包自带 bundle 层（`cordis.patch.yml`），profile 列入后工具即生效。想用检出目录试用：

```sh
dsh plugin --profile demo add ./integrations/deepseek-harness
```

然后让智能体调用，例如：`Use aifeed_decide_usage for shop.aifeed.md with usage "training".`

## 配置

| 选项 | 默认值 | 说明 |
|---|---|---|
| `allowPrivate` | `false` | 允许 `http://` 回环源用于本地测试（在 harness 进程中设置 `AIFEED_MCP_ALLOW_PRIVATE=1`） |

默认仅抓取 `https://` 源。取消操作在调用边界遵循 harness 的 `exec.signal`；
进行中的抓取按自身超时结束。

## 开发

引擎副本（`engine/server.js`、`engine/lib/`、`engine/schema/`、`LICENSE`）从
`packages/aifeed-mcp-server/` 生成：

```sh
npm run build:harness    # 重新生成
npm run harness:check    # 校验同步
```
