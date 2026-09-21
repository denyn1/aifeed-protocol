import type { AifeedBuildOptions, AifeedBuildSummary } from './index';

export interface AifeedAstroIntegration {
  name: 'aifeed';
  hooks: {
    'astro:build:done'(context: { dir?: URL | string; logger?: { info(message: string): void } }): AifeedBuildSummary;
  };
}

/** Sign the Astro build output: `integrations: [aifeed({ domain: 'example.com' })]`. */
declare function aifeed(options?: AifeedBuildOptions): AifeedAstroIntegration;

export { aifeed };
export default aifeed;
