export type VerifyLevel = 'VERIFIED' | 'UNVERIFIED' | 'SUSPENDED';

export interface Issue {
  code: string;
  path?: string;
  message: string;
}

export interface ManifestVerifyResult {
  result: 'VERIFIED' | 'UNVERIFIED';
  errors: Issue[];
  warnings: Issue[];
  manifest: unknown | null;
  signature: unknown | null;
}

export interface SignatureVerifyResult {
  result: 'VERIFIED' | 'UNVERIFIED' | 'SUSPENDED';
  dns_anchored: boolean | null;
  errors: Issue[];
  warnings: Issue[];
  revocation?: RevocationVerifyResult;
}

export interface VerifyAllInput {
  manifestText: string;
  manifestBytes?: Buffer;
  signatureText: string;
  domain?: string | null;
  now?: Date | string;
}

export interface VerifyDirectoryOptions {
  domain?: string | null;
  now?: Date | string;
}

export interface ManifestCheckResult {
  errors: Issue[];
  warnings: Issue[];
  publicKey: unknown;
  manifestDomain?: string | null;
}

export function verifyAll(input: VerifyAllInput): ManifestVerifyResult;
export function verifyDirectory(target: string, options?: VerifyDirectoryOptions): ManifestVerifyResult;
export function checkManifest(manifest: unknown, options?: VerifyDirectoryOptions): ManifestCheckResult;
export function normalizeDomain(input: string): string | null;
export function canonicalRevocationUrl(domain: string): string;
export const SKEW_SECONDS: number;
export const MAX_CHECK_INTERVAL_HOURS: number;

export class StrictParseError extends Error {
  code: string;
}

export interface ParseOptions {
  maxDepth?: number;
  integersOnly?: boolean;
  requireNFC?: boolean;
}

export function parseStrict(text: string, options?: ParseOptions): unknown;

export const jcs: {
  serialize(value: unknown): string;
  escapeString(value: string): string;
};

export const schema: {
  validate(value: unknown, schema: object, options?: object): Issue[];
  typeOf(value: unknown): string;
  deepEqual(a: unknown, b: unknown): boolean;
};

export const manifestSchema: object;
export const signatureSchema: object;

export interface RawDigest {
  'sha-256': string;
  'sha-512'?: string;
  applies_to: 'raw-bytes';
}

export const crypto: {
  PK_PREFIX: string;
  SIG_PREFIX: string;
  generateKeyPair(): { privateKey: unknown; publicKey: unknown };
  spkiDer(publicKey: unknown): Buffer;
  encodePublicKey(publicKey: unknown): string;
  decodePublicKey(value: string): unknown;
  fingerprintOf(publicKeyOrDer: unknown): string;
  canonicalMessage(manifest: unknown, kind?: 'manifest' | 'revocation' | 'bundle'): Buffer;
  signManifest(privateKey: unknown, manifest: unknown): Buffer;
  signRevocation(privateKey: unknown, revocation: unknown): Buffer;
  signBundle(privateKey: unknown, bundleManifest: unknown): Buffer;
  verifyManifest(publicKey: unknown, manifest: unknown, signature: Buffer): boolean;
  verifyRevocation(publicKey: unknown, revocation: unknown, signature: Buffer): boolean;
  verifyBundle(publicKey: unknown, bundleManifest: unknown, signature: Buffer): boolean;
  encodeSignature(bytes: Buffer): string;
  decodeSignature(value: string): Buffer;
};

export const digest: {
  sha256Base64(bytes: Buffer): string;
  sha512Base64(bytes: Buffer): string;
  rawDigestOf(bytes: Buffer): RawDigest;
  checkRawDigestShape(rawDigest: unknown): { errors: Issue[] };
  verifyRawDigest(rawDigest: RawDigest, bytes: Buffer): { ok: boolean; errors: Issue[]; actual?: string };
  parseContentDigest(headerValue: string): Record<string, string>;
  verifyContentDigest(headerValue: string, bytes: Buffer): { ok: boolean; algorithms?: string[]; errors: Issue[] };
};

export function rawDigestOf(bytes: Buffer): RawDigest;
export function verifyRawDigest(rawDigest: RawDigest, bytes: Buffer): { ok: boolean; errors: Issue[] };
export function parseContentDigest(headerValue: string): Record<string, string>;
export function verifyContentDigest(headerValue: string, bytes: Buffer): { ok: boolean; algorithms?: string[]; errors: Issue[] };

export interface RevocationVerifyOptions {
  domain?: string | null;
  now?: Date | string;
  governanceKeys?: string[] | null;
  threshold?: number;
  keyFingerprint?: string | null;
}

export interface RevocationVerifyResult {
  status?: string;
  result: 'valid' | 'invalid';
  valid_signatures: number;
  keys: Array<{ fingerprint: string }>;
  errors: Issue[];
  warnings: Issue[];
}

export interface RotationDirective {
  successor_fp?: string;
  predecessor_fp?: string;
  effective_at?: string;
  grace_until?: string;
  supersedes_at?: string;
}

export interface RotationState {
  errors: Issue[];
  warnings: Issue[];
  directive: RotationDirective | null;
  phase: 'announced' | 'grace' | 'completed' | 'cutover' | null;
}

export interface RotationPin {
  fingerprint: string;
  successor_fp?: string;
  effective_at?: string;
  grace_until?: string;
  predecessor_fp?: string;
}

export interface RotationContinuityResult {
  action: 'pin' | 'accept' | 'accept_successor' | 'resync' | 'error';
  codes: Issue[];
  pin: RotationPin;
}

export const rotation: {
  SKEW_SECONDS: number;
  ANCHOR_SKEW_SECONDS: number;
  MIN_WINDOW_HOURS: number;
  parseInstant(value: string): number | null;
  isSuccessor(directive: RotationDirective | null | undefined): boolean;
  isPredecessor(directive: RotationDirective | null | undefined): boolean;
  validateDirective(manifest: unknown, now: Date | string): RotationState;
  evaluateAnchor(manifest: unknown, record: Record<string, string>): { warnings: Issue[] };
  evaluateContinuity(pin: RotationPin | null, manifest: unknown, now: Date | string): RotationContinuityResult;
};

export const revocation: {
  verifyRevocationDocument(text: string, options?: RevocationVerifyOptions): RevocationVerifyResult;
  withoutSignatures(document: Record<string, unknown>): Record<string, unknown>;
};

export function verifyRevocationDocument(text: string, options?: RevocationVerifyOptions): RevocationVerifyResult;

export interface BundleFileEntry {
  path: string;
  'sha-256': string;
  size: number;
}

export interface BundleManifest {
  version: string;
  created_at: string;
  domain: string;
  files: BundleFileEntry[];
  bundler?: {
    fingerprint: string;
    key_id?: string | null;
    algorithm: 'ed25519';
    signature: string;
  };
}

export interface CreateBundleOptions {
  sourceDir: string;
  outDir: string;
  domain: string;
  privateKey?: unknown;
  keyId?: string | null;
  revocationFile?: string | null;
  now?: Date | string;
}

export interface VerifyBundleOptions {
  bundleDir: string;
  now?: Date | string;
  bundlerPublicKeyValue?: string | null;
}

export interface BundleVerifyResult {
  result: 'VERIFIED' | 'UNVERIFIED';
  errors: Issue[];
  warnings: Issue[];
  files: number;
  created_at: string | null;
  age_hours: number | null;
  manifest_result?: string | null;
}

export const bundle: {
  BUNDLE_VERSION: string;
  BUNDLE_STALE_HOURS: number;
  createBundle(options: CreateBundleOptions): BundleManifest;
  verifyBundle(options: VerifyBundleOptions): BundleVerifyResult;
};

export function createBundle(options: CreateBundleOptions): BundleManifest;
export function verifyBundle(options: VerifyBundleOptions): BundleVerifyResult;

export interface FetchTextOptions {
  timeout?: number;
  maxBytes?: number;
  allowPrivate?: boolean;
  ca?: Buffer | string;
  accept?: string;
  allowedContentTypes?: string[];
}

export interface DiscoverResult {
  manifestUrl: string;
  discoveredVia: 'link-header' | 'html-link' | 'fallback';
  error?: string;
}

export const remote: {
  fetchText(url: string, options?: FetchTextOptions): Promise<{ status: number; headers: Record<string, string | string[] | undefined>; buffer: Buffer; text: string }>;
  lookupAifeedTxt(domain: string): Promise<Array<Record<string, string>>>;
  resolvePinnedAddress(hostname: string, options?: { allowPrivate?: boolean }): Promise<{ address: string; family: number }>;
  isPrivateAddress(address: string): boolean;
  parseTxtRecord(value: string): Record<string, string>;
  discoverManifestUrl(baseUrl: string, options?: FetchTextOptions & { manifestUrl?: string | null }): Promise<DiscoverResult>;
};

export function fetchText(url: string, options?: FetchTextOptions): Promise<{ status: number; headers: Record<string, string | string[] | undefined>; buffer: Buffer; text: string }>;
export function lookupAifeedTxt(domain: string): Promise<Array<Record<string, string>>>;
export function resolvePinnedAddress(hostname: string, options?: { allowPrivate?: boolean }): Promise<{ address: string; family: number }>;
export function discoverManifestUrl(baseUrl: string, options?: FetchTextOptions & { manifestUrl?: string | null }): Promise<DiscoverResult>;

export interface MakoFrontmatter {
  mako: string;
  type: string;
  entity: string;
  updated: string;
  tokens: number;
  language: string;
  [key: string]: unknown;
}

export interface MakoSignatureContainer {
  algorithm: 'ed25519';
  context: 'mako' | 'mako-index';
  url: string;
  key_fingerprint: string;
  signed_at?: string;
  signature: string;
  raw_digest: RawDigest;
}

export interface MakoVerifyResult {
  mako_verified: boolean;
  mako_signature_present: boolean;
  errors: Issue[];
  warnings: Issue[];
  frontmatter: MakoFrontmatter | null;
  body: string | null;
  usage: Record<string, 'allow' | 'deny'> | null;
  attribution: 'required' | 'optional' | 'none' | null;
  limits: Record<string, number> | null;
  license: unknown;
}

export interface MakoManifestFragment {
  public_key: string;
  content_mako?: {
    index_url?: string;
    signature?: 'required' | 'optional';
    overrides?: 'restrict-only' | 'bidirectional';
    embedding?: boolean;
  };
  permissions?: {
    default?: 'allow' | 'deny';
    usage?: Record<string, 'allow' | 'deny'>;
    attribution?: 'required' | 'optional' | 'none';
    limits?: Record<string, number>;
    license?: unknown;
  };
}

export interface FetchMakoOptions {
  publicKeyValue?: string;
  fetchDefaultSignature?: boolean;
  maxBytes?: number;
  timeout?: number;
  mediaType?: 'text/mako+markdown' | 'text/aifeed+markdown';
}

export interface FetchMakoResult {
  mako: boolean;
  url: string;
  profile?: string;
  content_type: string;
  bytes: number;
  body?: Buffer;
  tokens?: number | null;
  frontmatter: MakoFrontmatter | null;
  mako_verified: boolean;
  errors: Issue[];
  warnings: Issue[];
}

export interface FetchIndexDeltaOptions {
  storedDigests?: Record<string, string>;
  maxBytes?: number;
  timeout?: number;
}

export interface FetchIndexDeltaResult {
  ok: boolean;
  index?: unknown;
  entries: IndexEntry[];
  changed: IndexEntry[];
  errors: Issue[];
}

export function fetchMako(url: string, options?: FetchMakoOptions): Promise<FetchMakoResult>;
export function fetchAimd(url: string, options?: FetchMakoOptions): Promise<FetchMakoResult>;
export function fetchIndexDelta(indexUrl: string, options?: FetchIndexDeltaOptions): Promise<FetchIndexDeltaResult>;
export function decideUsage(result: Pick<MakoVerifyResult, 'usage' | 'attribution'>, usageKey: string): { allowed: boolean; attribution: string | null; reason: string };

export const AIMD_MEDIA_TYPE: string;
export const MAKO_MEDIA_TYPE: string;
export const AIMD_SEPARATION: string;
export const AIMD_INDEX_SEPARATION: string;

export function verifyAimdDocument(options: { pageUrl: string; makoBytes: Buffer | string; containerText?: string; manifestFragment: MakoManifestFragment; now?: Date | string; lastModified?: string }): MakoVerifyResult;
export function verifyAimdIndex(options: { indexText: string; indexUrl: string; publicKeyValue: string; signatureText?: string; requireSignature?: boolean }): { ok: boolean; verified: boolean; errors: Issue[]; entries: unknown; profile?: string };

export interface IndexEntry {
  url: string;
  type: string;
  tokens: number;
  updated: string;
  etag: string;
  'sha-256': string;
  title?: string;
  summary?: string;
  tags?: string[];
  lang?: string;
  related?: string[];
}

export interface SelectEntriesOptions {
  query?: string;
  maxPages?: number;
  maxTokens?: number;
}

export interface SelectEntriesResult {
  selected: Array<IndexEntry & { score: number }>;
  considered: number;
  skipped: number;
  total_tokens: number;
  terms: string[];
}

export function selectEntries(entries: IndexEntry[], options?: SelectEntriesOptions): SelectEntriesResult;

export const mako: {
  MAKO_SEPARATION: string;
  MAKO_INDEX_SEPARATION: string;
  FRONTMATTER_MAX_BYTES: number;
  USAGE_KEYS: string[];
  parseFrontmatter(bytes: Buffer | string): { ok: boolean; errors: Issue[]; frontmatter: MakoFrontmatter | null; body: string | null };
  validateMakoFields(frontmatter: unknown): Issue[];
  resolvePermissions(manifestPermissions: unknown, aifeedBlock: unknown, overrides?: string): { usage: Record<string, 'allow' | 'deny'>; attribution: string; limits: Record<string, number>; license: unknown; warnings: Issue[] };
  signedMessage(pageUrl: string, bodyBytes: Buffer, context?: 'mako' | 'mako-index'): Buffer;
  signMakoContainer(privateKey: unknown, pageUrl: string, bodyBytes: Buffer, options?: { context?: 'mako' | 'mako-index'; signedAt?: string }): MakoSignatureContainer;
  verifyMakoContainer(options: { containerText: string; pageUrl: string; bodyBytes: Buffer; publicKey: unknown; context?: 'mako' | 'mako-index' }): { ok: boolean; errors: Issue[]; container?: MakoSignatureContainer };
  verifyMakoDocument(options: { pageUrl: string; makoBytes: Buffer | string; containerText?: string; manifestFragment: MakoManifestFragment; now?: Date | string; lastModified?: string }): MakoVerifyResult;
  verifyMakoIndex(options: { indexText: string; indexUrl: string; publicKeyValue: string; signatureText?: string; requireSignature?: boolean }): { ok: boolean; verified: boolean; errors: Issue[]; entries: unknown };
  checkIndexEntryDigest(entry: { url: string; 'sha-256': string }, bodyBytes: Buffer): { ok: boolean; error?: Issue };
};

export const manifestSchemaV02: object;
