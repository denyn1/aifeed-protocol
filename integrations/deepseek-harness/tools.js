import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const mcp = require('./engine/server.js');

const TOOL_KEYS = ['verify_manifest', 'fetch_aifeed', 'list_assets', 'verify_asset', 'select_index', 'decide_usage'];

function parametersFromSchema(schema) {
  const required = new Set(Array.isArray(schema.required) ? schema.required : []);
  const parameters = {};
  for (const [key, property] of Object.entries(schema.properties || {})) {
    const parameter = { type: property.type };
    if (required.has(key)) parameter.required = true;
    if (typeof property.description === 'string') parameter.description = property.description;
    parameters[key] = parameter;
  }
  return parameters;
}

function canonicalCall(handler) {
  return async (args) => {
    let result;
    try {
      result = await handler(args);
    } catch (error) {
      throw error instanceof Error ? error : new Error(error && error.message ? error.message : String(error));
    }
    const blocks = Array.isArray(result && result.content) ? result.content : [];
    const text = blocks.find((block) => block && block.type === 'text');
    if (!text) throw new Error('AIFeed tool returned no text content');
    let value;
    try {
      value = JSON.parse(text.text);
    } catch (error) {
      throw new Error('AIFeed tool returned non-JSON content: ' + String(text.text).slice(0, 200));
    }
    if (result.isError) {
      throw new Error(value && value.error ? value.error : String(text.text));
    }
    return value;
  };
}

export function createAifeedTools(config = {}) {
  if (config.allowPrivate) process.env.AIFEED_MCP_ALLOW_PRIVATE = '1';
  return TOOL_KEYS.map((key) => {
    const tool = mcp.TOOLS[key];
    return {
      name: 'aifeed_' + key,
      description: tool.description,
      parameters: parametersFromSchema(tool.inputSchema),
      output: {
        schema: { type: 'object', additionalProperties: true },
        render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }]
      },
      execute: canonicalCall(tool.handler)
    };
  });
}

export const AIFEED_TOOL_NAMES = TOOL_KEYS.map((key) => 'aifeed_' + key);
