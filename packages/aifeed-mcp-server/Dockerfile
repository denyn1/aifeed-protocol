# AIFeed MCP server (stdio). Build context: repository root.
#   docker build -f packages/aifeed-mcp-server/Dockerfile -t aifeed-mcp-server .
FROM node:20-alpine
WORKDIR /app
COPY packages/aifeed-mcp-server/ ./
ENTRYPOINT ["node", "/app/index.js"]
