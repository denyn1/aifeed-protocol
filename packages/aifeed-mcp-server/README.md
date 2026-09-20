# aifeed-mcp-server

Zero-dependency [Model Context Protocol](https://modelcontextprotocol.io/) server for
[AIFeed](https://aifeed.md): lets an AI assistant verify signed publisher manifests,
fetch token-budgeted markdown, list and verify assets, and rank delta-index entries —
all over the signed AIFeed protocol, with no HTML scraping.

## Install

Published: [`aifeed-mcp-server`](https://www.npmjs.com/package/aifeed-mcp-server) (npm).

```jsonc
// Claude Desktop / Cursor / any MCP client (stdio)
{
  "mcpServers": {
    "aifeed": {
      "command": "npx",
      "args": ["-y", "aifeed-mcp-server"]
    }
  }
}
```

From source (this monorepo, zero dependencies):

```bash
node packages/aifeed-mcp-server/index.js
```

## Tools

| Tool | Purpose |
|---|---|
| `verify_manifest` | Verify a domain manifest: signature, DNS `_aifeed` anchor, `VERIFIED`/`UNVERIFIED` |
| `fetch_aifeed` | Fetch a page as token-budgeted markdown (`aimd`/`mako`, optional `max_tokens`, signature check with `publicKeyValue`) |
| `list_assets` | List the images, videos, audio, documents, and downloads a page declares |
| `verify_asset` | Download a declared asset and verify bytes against `size`/`sha-256` |
| `select_index` | Fetch a signed delta index and rank entries by query within page/token budgets |
| `decide_usage` | Decide whether a usage (`retrieval`, `training`, `summarize`, …) is allowed |

Only `https://` origins are fetched. Set `AIFEED_MCP_ALLOW_PRIVATE=1` to permit
`http://` loopback origins (local development and tests only).

## Source

Part of [aifeed-protocol](https://github.com/denyn1/aifeed-protocol): `packages/aifeed-mcp-server/index.js`
is hand-written; `lib/` and `schema/` are generated copies of the reference
implementation (`npm run build:mcp`). Spec: `spec/en/`. Guide:
[`docs/publisher-ai-guide.md`](../../docs/publisher-ai-guide.md).
