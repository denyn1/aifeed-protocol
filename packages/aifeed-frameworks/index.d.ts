export interface AifeedBuildOptions {
  /** Origin domain, e.g. "example.com" (or AIFEED_DOMAIN). */
  domain?: string;
  /** Private key PEM path (default "aifeed-private.pem", or AIFEED_KEY). */
  keyPath?: string;
  /** Output directory override (plugins infer it from the framework). */
  outDir?: string;
  /** Absolute base URL (default "https://" + domain, or AIFEED_BASE_URL). */
  baseUrl?: string;
  name?: string;
  description?: string;
  type?: string;
  locale?: string;
  contact?: string;
  keyId?: string;
  profile?: 'aimd' | 'mako' | 'both';
  /** Add <link rel="alternate"> to built HTML (default true). */
  inject?: boolean;
  /** Write llms.txt (default true). */
  llms?: boolean;
  /** Remove previously generated AIFeed files before rebuilding (default true). */
  prune?: boolean;
  /** Self-verify signatures and digests after the build (default true). */
  verifyAfter?: boolean;
  updated?: string;
  permissions?: Record<string, unknown>;
  limits?: Record<string, unknown>;
  license?: Record<string, unknown>;
  sitemap?: boolean;
  maxCheckIntervalHours?: number;
  log?: boolean;
  logger?: (message: string) => void;
}

export interface AifeedBuildSummary {
  dir: string;
  profile: string;
  domain: string;
  baseUrl: string;
  fingerprint: string;
  pages: Array<{ url: string; md: string | null; tokens: number }>;
  index: string;
  manifest: string;
  llms: string | null;
  warnings: Array<Record<string, unknown>>;
}

export interface AifeedResolvedConfig {
  root: string;
  outDir: string;
  keyPath: string;
  domain: string;
  baseUrl: string;
  name: string;
  profile: 'aimd' | 'mako' | 'both';
  inject: boolean;
  llms: boolean;
  prune: boolean;
  verifyAfter: boolean;
  log: boolean;
  [key: string]: unknown;
}

export function resolveConfig(
  options?: AifeedBuildOptions,
  context?: { root?: string; outDir?: string }
): AifeedResolvedConfig;

export function pruneGenerated(outDir: string): number;

export function runBuild(
  options?: AifeedBuildOptions,
  context?: { root?: string; outDir?: string }
): AifeedBuildSummary;

export function keygen(options?: { out?: string; force?: boolean }): {
  private_key: string;
  public_key: string;
  public_key_value: string;
  fingerprint: string;
};

export const DEFAULT_KEY_FILE: string;
