import type { AifeedBuildOptions, AifeedBuildSummary } from './index';

export interface AifeedVitePlugin {
  name: 'aifeed';
  apply: 'build';
  configResolved(config: { root?: string; build?: { outDir?: string } }): void;
  closeBundle(): AifeedBuildSummary;
}

/** Sign the Vite build output: `plugins: [aifeed({ domain: 'example.com' })]`. */
declare function aifeed(options?: AifeedBuildOptions): AifeedVitePlugin;

export { aifeed };
export default aifeed;
