import type { AifeedBuildOptions } from './index';

/**
 * Validates that the Next.js config exports a static site (`output: 'export'`)
 * and warns otherwise. The signing itself runs after `next build` via the
 * `aifeed-next` bin (`"postbuild": "aifeed-next --domain example.com"`).
 */
declare function withAifeed<T extends Record<string, unknown>>(nextConfig: T, options?: AifeedBuildOptions): T;

export { withAifeed };
export default withAifeed;
