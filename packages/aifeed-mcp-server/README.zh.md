# aifeed-mcp-server

面向 [AIFeed](https://aifeed.md) 的零依赖 [Model Context Protocol](https://modelcontextprotocol.io/)
服务器：让 AI 助手验证发布方签名 manifest、按 token 预算获取 markdown、列出并验证资源、
对增量索引条目排序——全部经由签名的 AIFeed 协议，无需抓取 HTML。

## 安装

已发布：[`aifeed-mcp-server`](https://www.npmjs.com/package/aifeed-mcp-server)（npm）。

```jsonc
// Claude Desktop / Cursor / 任意 MCP 客户端（stdio）
{
  "mcpServers": {
    "aifeed": {
      "command": "npx",
      "args": ["-y", "aifeed-mcp-server"]
    }
  }
}
```

从源码（本 monorepo，零依赖）：

```bash
node packages/aifeed-mcp-server/index.js
```

## 工具

| 工具 | 功能 |
|---|---|
| `verify_manifest` | 验证域名 manifest：签名、DNS `_aifeed` 锚点、`VERIFIED`/`UNVERIFIED` |
| `fetch_aifeed` | 按 token 预算获取页面 markdown（`aimd`/`mako`，可选 `max_tokens`，用 `publicKeyValue` 验签） |
| `list_assets` | 列出页面声明的图片、视频、音频、文档与下载 |
| `verify_asset` | 下载已声明资源并按 `size`/`sha-256` 验证字节 |
| `select_index` | 获取签名增量索引，按查询在页面/token 预算内排序条目 |
| `decide_usage` | 判断某 usage（`retrieval`、`training`、`summarize` 等）是否被允许 |

仅抓取 `https://` 源。设置 `AIFEED_MCP_ALLOW_PRIVATE=1` 可允许 `http://` 回环源（仅限本地开发与测试）。

## Docker

```bash
docker build -f packages/aifeed-mcp-server/Dockerfile -t aifeed-mcp-server .
docker run -i --rm aifeed-mcp-server
```

在 [Glama](https://glama.ai/mcp/servers) 上架时可直接使用同一 Dockerfile（构建上下文：仓库根目录）。
根目录的 `glama.json` 声明维护者。

## 在 Smithery 上部署

本 README 旁的 `smithery.yaml` 描述了 [Smithery](https://smithery.ai/) 的 stdio 启动命令：
安装其 CLI、登录，然后在 `packages/aifeed-mcp-server` 下运行 `smithery publish`。

## 源码

[aifeed-protocol](https://github.com/denyn1/aifeed-protocol) 的一部分：
`packages/aifeed-mcp-server/index.js` 为手写；`lib/` 与 `schema/` 由参考实现生成
（`npm run build:mcp`）。规范见 `spec/zh/`。指南见
[`docs/publisher-ai-guide.zh.md`](../../docs/publisher-ai-guide.zh.md)。
