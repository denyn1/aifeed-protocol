import { defineTool } from '@deepseek-ai/dsh-tools';
import { createAifeedTools } from './tools.js';

export const name = 'aifeed';
export const inject = ['tools'];

export function apply(ctx, config = {}) {
  for (const tool of createAifeedTools(config)) {
    ctx.tools.register(defineTool(tool));
  }
}
