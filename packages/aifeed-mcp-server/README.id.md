# aifeed-mcp-server

Server [Model Context Protocol](https://modelcontextprotocol.io/) tanpa dependensi untuk
[AIFeed](https://aifeed.md): memungkinkan asisten AI memverifikasi manifest penerbit
bertanda tangan, mengambil markdown berbujet token, mendaftar dan memverifikasi aset,
serta memeringkat entri indeks delta — semuanya lewat protokol AIFeed bertanda tangan,
tanpa scraping HTML.

## Instalasi

Terbit: [`aifeed-mcp-server`](https://www.npmjs.com/package/aifeed-mcp-server) (npm).

```jsonc
// Claude Desktop / Cursor / klien MCP apa pun (stdio)
{
  "mcpServers": {
    "aifeed": {
      "command": "npx",
      "args": ["-y", "aifeed-mcp-server"]
    }
  }
}
```

Dari sumber (monorepo ini, nol dependensi):

```bash
node packages/aifeed-mcp-server/index.js
```

## Tools

| Tool | Fungsi |
|---|---|
| `verify_manifest` | Verifikasi manifest domain: tanda tangan, anchor DNS `_aifeed`, `VERIFIED`/`UNVERIFIED` |
| `fetch_aifeed` | Ambil halaman sebagai markdown berbujet token (`aimd`/`mako`, opsional `max_tokens`, cek tanda tangan via `publicKeyValue`) |
| `list_assets` | Daftar gambar, video, audio, dokumen, dan unduhan yang dideklarasikan halaman |
| `verify_asset` | Unduh aset yang dideklarasikan dan verifikasi byte terhadap `size`/`sha-256` |
| `select_index` | Ambil indeks delta bertanda tangan dan peringkat entri menurut query dalam bujet halaman/token |
| `decide_usage` | Putuskan apakah usage (`retrieval`, `training`, `summarize`, …) diizinkan |

Hanya origin `https://` yang diambil. Set `AIFEED_MCP_ALLOW_PRIVATE=1` untuk mengizinkan
origin loopback `http://` (pengembangan lokal dan tes saja).

## Docker

```bash
docker build -f packages/aifeed-mcp-server/Dockerfile -t aifeed-mcp-server .
docker run -i --rm aifeed-mcp-server
```

Dockerfile yang sama diterima [Glama](https://glama.ai/mcp/servers) saat mendaftarkan
server (konteks build: root repositori). `glama.json` di root menyatakan maintainer.

## Deploy di Smithery

`smithery.yaml` di sebelah README ini mendeskripsikan perintah start stdio untuk
[Smithery](https://smithery.ai/): instal CLI mereka, login, lalu jalankan
`smithery publish` dari `packages/aifeed-mcp-server`.

## Sumber

Bagian dari [aifeed-protocol](https://github.com/denyn1/aifeed-protocol):
`packages/aifeed-mcp-server/index.js` ditulis tangan; `lib/` dan `schema/` adalah salinan
hasil generate dari implementasi referensi (`npm run build:mcp`). Spesifikasi: `spec/id/`.
Panduan: [`docs/publisher-ai-guide.id.md`](../../docs/publisher-ai-guide.id.md).
