# Publisher AI Guide — let an AI coding agent install AIFeed end-to-end

<p><a href="publisher-ai-guide.md">English</a> · <a href="publisher-ai-guide.id.md">Bahasa Indonesia</a> · <a href="publisher-ai-guide.zh.md">中文</a></p>

This guide is for **website owners**. It gives you copy-paste prompts that instruct an
AI coding agent (VS Code agent mode, Copilot CLI, OpenCode, Codex CLI, Claude Code,
HermesAgent, or any equivalent) to **analyze your website and build a complete AIFeed
setup automatically** — from key generation to a verified live manifest.

The flow is agentic: the AI first inspects your site, stack, hosting, and DNS control,
classifies it (S / M / L / XL below), presents a plan for your approval, then executes
it phase by phase. Each phase ends in a machine-checkable gate. Nothing proceeds on
assumptions.

> Companion for crawlers/consumers: [`agent-quickstart.md`](agent-quickstart.md).
> Command reference: [`../REFERENCE.md`](../REFERENCE.md). Rotation runbook:
> [`rotation.md`](rotation.md). Deploy notes: [`deploy-site.md`](deploy-site.md).

## 0. Ground rules — paste once, enforce always

Paste this block to your AI tool before anything else, replacing `{placeholders}`:

```text
You are setting up AIFeed (signed AI-content permissions) for my website.
Rules you must follow for the whole task:
1. PLAN FIRST. Inspect first, change nothing until I approve the written plan.
   Read-only reconnaissance before any write.
2. Keys never leave this machine. Never paste private key material into chat,
   issues, or files outside the key directory. Key files stay modes 0600.
3. Verify before publish. No file goes live until `validate` reports VERIFIED.
4. Dry-run destructive steps first (`rotate --dry-run`; show DNS edits before applying).
5. Every phase ends with its gate below. If a gate fails: stop, show me the full
   command output, propose exactly one fix, and wait.
6. Prefer existing repo tooling over new code: bin/cli.js, integrations/,
   wp-plugin/, tools/. Do not add dependencies.
7. Report in short steps: what you ran, what it printed, gate pass/fail.
```

Tool-specific plan-first controls (same intent, native mechanism):

| AI tool | How to force plan-first |
|---|---|
| OpenCode | Press Tab for plan mode; `/undo` reverts; approve in permissions prompts |
| Claude Code | Plan mode (Shift+Tab / `--permission-mode plan`); Esc interrupts; review diffs before commit |
| VS Code agent mode | Use the Plan role; keep permissions on Manual/assisted; review in Agents window or Chat view |
| Copilot CLI | Start conservative; confirm each command batch before it runs |
| Codex CLI | *Verify from vendor docs* — use its approvals/sandbox flags, confirm before apply |
| HermesAgent | *Verify from vendor docs* — use its plan/approval mechanism, confirm before apply |

### Prerequisites (all classes)

- Node.js ≥ 20 on the machine where commands run.
- A checkout of `aifeed-protocol` (all commands below run as `node bin/cli.js …`
  from the repo root; a global `aifeed` shim exposes the same surface where installed).
- Your domain, plus the ability to add one DNS TXT record.
- Hosting access matching your class (upload-only for S, SSH/admin for M+).

### Conventions used in every prompt

- `{DOMAIN}` your domain, e.g. `example.com`. `{SITE_DIR}` your built static files.
  `{KEY_DIR}` a local-only directory for keys (never committed, never uploaded).
- Exit codes: `0` = VERIFIED/success, `1` = UNVERIFIED/failure, `2` = usage error.
- Prefer `--json` output when chaining steps; human-readable otherwise.

## Master prompt — analyze first, then build (copy-paste)

```text
Set up complete AIFeed for my website {DOMAIN}.
Ground rules: <paste §0 block above>.

PHASE 0 — ANALYZE (read-only; change nothing yet):
1. Fetch https://{DOMAIN}/ and record: response headers (Server, Content-Type),
   generator meta tags, sitemap/robots.txt presence, links to feeds/CMS paths.
2. Determine the stack: static files / WordPress or CMS / SSR app (Next.js etc.)
   / multi-service / CDN-fronted. Note what you could NOT determine.
3. Determine hosting access: upload-only, SSH/admin panel, CI present
   (.github/workflows?), DNS control (can we add TXT records?).
4. Classify the site with the decision table below and state the evidence for
   each signal (quote the header/file you saw).

DECISION TABLE (apply in order; first match wins):
- S (small): static output or shared hosting, upload-only access, single origin.
- M (medium): VPS/SSH or CMS incl. WordPress, one team, single origin (multisite counts as M+).
- L (large): SSR/multi-service, staging + production, CI/CD present, small team.
- XL (giant): CDN/multi-region, compliance or governance needs, on-call/approvals.

Then present: classification + evidence, the exact step list you will run
(commands with my values filled in), files you will create/modify,
and what you need from me (passwords you must NEVER ask for: none —
keys are generated locally by the CLI).
Wait for my approval before PHASE 1. After approval, execute one phase at a
time; each phase ends with its gate; on any gate failure follow rule 5.
```

## Track S — small / static / shared hosting (no SSH)

Goal: signed manifest + delta content live, verified end-to-end.

Using Vite, Astro, or Next.js (`output: 'export'`)? The drop-in plugins sign the build
output automatically: `npm i -D @aifeed/frameworks@next`, `npx aifeed-build keygen --out
.aifeed`, then add `aifeed({ domain })` to the framework config (Next.js:
`"postbuild": "aifeed-next --domain …"`). The rest of this track applies unchanged.

**PS-1 — keys (local only).** Prompt:

```text
Generate an Ed25519 keypair for {DOMAIN} into {KEY_DIR} (do not overwrite
without asking). Show me the fingerprint line only — never print the private key.
Gate: {KEY_DIR}/aifeed-private.pem (0600) and {KEY_DIR}/aifeed-public.txt exist.
```

Command the AI runs:

```bash
node bin/cli.js keygen --out {KEY_DIR}
```

Expected: paths printed; public file holds the `ed25519:…` value + fingerprint.
Gate: both files exist; private file is owner-read-only.

**PS-2 — build.** Prompt:

```text
Build AIFeed for the static files in {SITE_DIR} for domain {DOMAIN} using the key
in {KEY_DIR}/aifeed-private.pem, profile "both", with llms.txt. List every file
created under .well-known/ and the per-page outputs. Do not deploy anything yet.
Gate: .well-known/ai.json exists in the build output.
```

Command:

```bash
node bin/cli.js site build {SITE_DIR} --domain {DOMAIN} --key {KEY_DIR}/aifeed-private.pem --profile both --llms
```

**PS-3 — local verify.** Prompt:

```text
Validate the built manifest directory ({SITE_DIR}/.well-known, where ai.json and
ai-signature.json sit side by side) for {DOMAIN} and show result + any
errors/warnings in JSON. Gate: result VERIFIED, errors [].
```

Command:

```bash
node bin/cli.js validate {SITE_DIR}/.well-known --domain {DOMAIN} --json
```

(`validate DIR` reads `ai.json` directly inside DIR, so point it at `.well-known`,
not the site root.)

**PS-4 — publish + DNS (human step assisted by AI).** Prompt:

```text
The build is VERIFIED. Now: (1) print the exact files to upload preserving paths
(.well-known/ai.json, .well-known/ai-signature.json, index + pages);
(2) print the exact DNS TXT record to create at _aifeed.{DOMAIN} using values
from the built manifest and key (format: v=aifeed1; pk=<ed25519:…>;
fp=<sha256:…>; manifest=https://{DOMAIN}/.well-known/ai.json);
(3) wait — I will upload and add the record, then say CONTINUE.
```

**PS-5 — live verify (after your CONTINUE).** Prompt:

```text
Verify https://{DOMAIN} live: manifest reachable, signature valid, DNS anchor
matches. Report VERIFIED + dns_anchored true, or stop with the full output.
Gate: result VERIFIED and dns_anchored true.
```

Command the AI runs:

```bash
node bin/cli.js validate {DOMAIN} --json
```

Track S is complete when PS-5's gate passes.

## Track M — medium / VPS / CMS / WordPress

Goal: AIFeed served by the live stack, re-signed on schedule, anchor enforced.

**PM-1 — detect (extends Phase 0).** Prompt:

```text
Inspect the server: is this WordPress (wp-admin/wp-json present?) or another CMS,
or a VPS with nginx/Caddy/Apache/Node? Check for scheduled tasks/cron and for an
existing AIFeed manifest. Report stack + evidence, then propose path A (plugin)
or path B (adapter) — do not install anything yet.
```

**PM-2A — WordPress path.** Prompt:

```text
Install and configure the plugin in wp-plugin/ on this WordPress site for
{DOMAIN} following wp-plugin/README.md exactly (keygen in admin, profiles,
dual-stack). Then fetch /.well-known/ai.json and validate it.
Gate: validate reports VERIFIED for {DOMAIN}.
```

Reference (do not duplicate): [`../wp-plugin/README.md`](../wp-plugin/README.md).

**PM-2B — adapter path.** Prompt:

```text
Wire the matching adapter from integrations/ for this stack
(nginx/caddy/apache/node/nextjs/php/python/go per integrations/README.md):
build the site output if static, otherwise configure content negotiation +
signature headers per the adapter's file. Show the exact config diff.
Apply only after my approval. Gate: validate of the manifest directory (ai.json +
ai-signature.json side by side — {SITE_DIR}/.well-known for site builds) reports
VERIFIED.
```

Reference: [`../integrations/README.md`](../integrations/README.md).

**PM-3 — scheduled re-sign.** Prompt:

```text
Set up unattended re-signing (monthly cron or equivalent for this host) that
re-runs sign on the manifest directory and reloads the server only if
validate passes. Print the exact schedule entry. Never store keys outside
{KEY_DIR} or the host secret store.
```

**PM-4 — enforced live verify.** Prompt:

```text
Verify {DOMAIN} live with DNS anchor required and report errors in JSON.
Gate: result VERIFIED and dns_anchored true.
```

Command:

```bash
node bin/cli.js validate {DOMAIN} --require-dns-anchor --json
```

Track M is complete when PM-4's gate passes and the re-sign schedule is installed.

## Track L — large / multi-service / SSR / teams

Goal: AIFeed as a CI-gated, staged pipeline with monitoring.

**PL-1 — CI gate.** Prompt:

```text
Add the AIFeed GitHub Action from integrations/github-action/aifeed.yml to this
repo so every change to web content runs sign + validate and blocks merge on
anything but VERIFIED. Show the workflow diff; do not push until I approve.
Gate: workflow file present and references the repo's verify steps.
```

**PL-2 — staging → production.** Prompt:

```text
Deploy the verified build to staging first, run validate against the staging
host, then promote the identical artifacts to production and validate {DOMAIN}.
Gate: both validations VERIFIED with zero errors.
```

**PL-3 — delta + monitoring.** Prompt:

```text
Confirm the delta index is published and fresh (index + .sig), then set up
JSONL access logging in the pilot format and run node tools/pilot-report.js
--baseline baseline.jsonl --pilot pilot.jsonl [--out report.md].
Report the savings table. Gate: report generated, no parse errors.
```

**PL-4 — pilot pointer.** Prompt:

```text
Summarize readiness for a 30-day pilot per docs in pilot/ and list the three
riskiest unknowns with owners. No action beyond the report.
```

Track L is complete when PL-2's gates pass on production and PL-3 produces a report.

## Track XL — giant / CDN / multi-region / enterprise

Goal: enforced, governed, auditable AIFeed with key ceremony discipline.

**PX-1 — enforcement design.** Prompt:

```text
Design edge enforcement for {DOMAIN} (deny training crawlers, rate-limit
non-compliant ones, serve compliant clients signed content), referencing the
strict demo behaviour and integrations/ adapters. Produce the design + config
diff. Apply only after approval from the on-call owner I name.
Gate: design reviewed; nothing applied yet.
```

**PX-2 — governance keys + rotation.** Prompt:

```text
Inventory signing and governance keys, confirm backup and break-glass
procedure, then rehearse rotation with --dry-run (docs/rotation.md). Only on
explicit approval, run the real ceremony. Gate: dry-run clean; after ceremony,
validate VERIFIED with dns_anchored true.
```

Commands:

```bash
node bin/cli.js rotate --dir {SITE_DIR} --dry-run --json
node bin/cli.js rotate --dir {SITE_DIR} --window 72
```

Full ceremony: [`rotation.md`](rotation.md).

**PX-3 — registry + monitoring.** Prompt:

```text
Wire revocation checking (--revocation-url, --governance-key) into validation,
and set up recurring live verification equivalent to npm run verify:live plus
log monitoring. Gate: live check green two runs in a row.
```

Commands:

```bash
node bin/cli.js validate {DOMAIN} --revocation-url https://aifeed.md/revoke/v1/{DOMAIN}.json --json
npm run verify:live
```

**PX-4 — compliance evidence.** Prompt:

```text
Collect the evidence pack: manifest + signatures, validation JSON outputs,
rotation/revocation records, benchmark numbers from committed artifacts only
(never invent numbers), each claim labeled per paper/CLAIMS.md conventions.
Gate: pack complete, every number traceable to an artifact.
```

Track XL is complete when PX-3's gates pass twice and the evidence pack is filed.

## Assets — images, PDFs, and downloads

Non-HTML files (images, video, audio, PDFs, archives, any `download` link) are declared
per page in the signed frontmatter under `aifeed.assets`:

```yaml
aifeed:
  assets:
    - url: /uploads/sampul.webp
      type: image
      mime: image/webp
      size: 48213
      sha-256: "9GyqhORj/l1nnxteUlVZjHyf83us13ziRunVmf97e6M="
    - url: /laporan.pdf
      type: document
      mime: application/pdf
```

- **References only** — assets are never inlined; the agent decides whether to download.
- **Same permissions** — fetching an asset follows the page's usage and limits
  (`retrieval`, `commercial_use`, …), and the edge templates cover asset paths too.
- **Integrity** — when `size` or `sha-256` is present, verify the downloaded bytes with
  `sdk.verifyAsset(bytes, asset)` before use. `aifeed site build` (and Studio) fills
  `mime` from the extension and hashes local files in the source directory (≤16 MiB);
  crawled or remote assets stay hash-less until the agent downloads them.
- **Pre-fetch triage** — index entries carry an `assets` count, so an agent can decide
  whether fetching the page is worth it before downloading anything.

## Prefer an app? Use AIFeed Studio

If you would rather click than prompt, the repository ships a local app that does the
same work: `npm run studio` serves a zero-dependency UI on <http://127.0.0.1:7777>.
Create a project, point it at a local HTML directory or crawl the live site, edit the
restrict-only policy (presets for news/ecommerce included), build incrementally, verify,
and export — folder or `.tar.gz`, DNS TXT record, and adapter hints for your stack. Keys
stay on your machine. See [`../studio/README.md`](../studio/README.md).

## Appendix A — AI tool capability matrix

Facts below were verified against the vendors' official docs on 2026-09-16, except
cells marked *verify from vendor docs* (confirm before relying on them).

| Capability | OpenCode | Claude Code | VS Code agent mode | Copilot CLI | Codex CLI | HermesAgent |
|---|---|---|---|---|---|---|
| Runs terminal commands | yes (permissions-gated) | yes (permissions-gated) | yes (approval-gated) | yes | *verify from vendor docs* | *verify from vendor docs* |
| Edits/creates files | yes (+ `/undo`) | yes (diff review) | yes (review in Chat/Agents window) | yes | *verify from vendor docs* | *verify from vendor docs* |
| Plan-before-execute mode | yes (Tab plan mode) | yes (plan mode) | yes (Plan role) | conservative start, confirm batches | *verify from vendor docs* | *verify from vendor docs* |
| Project memory/instructions | AGENTS.md auto-read | CLAUDE.md auto-read | custom instructions / prompt files | *verify from vendor docs* | *verify from vendor docs* | *verify from vendor docs* |
| Long/background runs | *verify from vendor docs* | yes (background agents) | yes (Agents window / cloud) | *verify from vendor docs* | *verify from vendor docs* | *verify from vendor docs* |
| Interrupting a runaway | Esc / stop | Esc interrupts | stop button | *verify from vendor docs* | *verify from vendor docs* | *verify from vendor docs* |

Rules for using this table without bias: never claim one tool is "best"; if a cell is
unverified, say so in the plan; if the user's tool lacks a capability (e.g. no
terminal), the AI must adapt the track (e.g. print exact commands for the human to run)
rather than fail.

## Appendix B — troubleshooting (real errors, real fixes)

When any gate fails, paste the full JSON output back to the AI with: "Gate failed.
Diagnose from the errors array only, propose exactly one fix, wait for approval."
Common causes:

| Symptom | Likely cause | Fix prompt |
|---|---|---|
| `result UNVERIFIED`, errors include `dns_mismatch` | TXT record missing/wrong, or points at an old key | "Show me the live TXT vs the manifest key fingerprint, then print the corrected record — do not apply DNS changes yourself." |
| `schema_violation` | hand-edited manifest or stale scaffold | "Regenerate via init/site build instead of hand-editing, re-sign, re-validate." |
| `bad_signature` | manifest edited after signing, or wrong key | "Re-run sign with the key matching identity.public_key, then validate." |
| `upgrade_required` | v0.1 manifest where v0.2 features (e.g. rotation) are used | "Re-issue the manifest as v0.2 and re-sign." |
| `rotation_denied` / `key_revoked` | stale overlap or revoked key in use | "Follow docs/rotation.md: complete the cutover or publish the new key, then re-validate." |
| HTTP 403/429 on strict-style edge | training crawler blocked / rate-limited by design | "Confirm the UA and Accept headers: compliant clients must negotiate markdown; this is enforcement working, not an error." |
| `revocation_unavailable` / check skipped | no `--revocation-url` given or registry unreachable | "Re-run with --revocation-url and --governance-key; if unreachable, retry and report." |
| Exit code 2 | usage error (bad flags/paths) | "Reprint the exact command from bin/cli.js --help and fix the invocation." |

## Links

- Consumer side: [`agent-quickstart.md`](agent-quickstart.md)
- Command reference: [`../REFERENCE.md`](../REFERENCE.md)
- Rotation runbook: [`rotation.md`](rotation.md)
- Deploy + DNS: [`deploy-site.md`](deploy-site.md)
- Platform adapters: [`../integrations/README.md`](../integrations/README.md)
- WordPress: [`../wp-plugin/README.md`](../wp-plugin/README.md)
- Specs: [`../spec/en/`](../spec/en/) (canonical; `../spec/id/`, `../spec/zh/` mirrors)
