# AIFeed plugin for DeepSeek Harness

[English](README.md) · [Bahasa Indonesia](README.id.md) · [中文](README.zh.md)

Cordis plugin that gives the DeepSeek Harness six model-callable tools for working with
[AIFeed](https://aifeed.md): signed content permissions for the AI web. It reuses the same
zero-dependency engine as [`aifeed-mcp-server`](../../packages/aifeed-mcp-server) — the
`engine/` copies (`server.js`, `lib`, `schema`) are generated with `npm run build:harness` from
the repository root.

## Tools

| Tool | What it does |
|---|---|
| `aifeed_verify_manifest` | Verify a manifest: signature, DNS `_aifeed` anchor, result (VERIFIED/UNVERIFIED) |
| `aifeed_fetch_aifeed` | Fetch a page as token-budgeted AIFeed Markdown/MAKO with permissions + optional signature check |
| `aifeed_list_assets` | List the images, videos, and documents a signed page declares |
| `aifeed_verify_asset` | Download a declared asset and check size/sha-256 |
| `aifeed_select_index` | Rank signed delta-index entries within page/token budgets |
| `aifeed_decide_usage` | Decide whether a usage (retrieval, training, …) is allowed |

## Install

Inside your DeepSeek Harness checkout:

```sh
pnpm add @aifeed/deepseek-harness
```

Add it to a Cordis patch and start the harness with `--patch`:

```yaml
- name: '@aifeed/deepseek-harness'
```

Then ask the agent, for example:
`Use aifeed_decide_usage for shop.aifeed.md with usage "training".`

## Configuration

| Option | Default | Description |
|---|---|---|
| `allowPrivate` | `false` | Permit `http://` loopback origins for local testing (sets `AIFEED_MCP_ALLOW_PRIVATE=1` in the harness process) |

Only `https://` origins are fetched by default. Cancellation follows the harness
`exec.signal` at the call boundary; in-flight fetches finish on their own timeout.

## Development

The engine copies (`engine/server.js`, `engine/lib/`, `engine/schema/`, `LICENSE`) are generated from
`packages/aifeed-mcp-server/`:

```sh
npm run build:harness    # regenerate
npm run harness:check    # verify in sync
```
