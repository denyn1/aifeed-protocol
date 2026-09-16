# AGENTS.md — working in this repository

<p><a href="AGENTS.md">English</a> · <a href="AGENTS.id.md">Bahasa Indonesia</a> · <a href="AGENTS.zh.md">中文</a></p>

Instructions for AI coding agents (and humans) who maintain, update, or upgrade AIFeed.
Read this first; it is the contract that keeps the repository reproducible.

## What this repository is

A zero-dependency monorepo for the **AIFeed protocol** (signed content permissions for
AI agents): specifications, JSON Schemas, reference implementation (CLI + JS SDK +
Python verifier), 84 conformance vectors, server adapters, a WordPress publisher plugin,
benchmarks, the website, and the paper.

## Golden rules

1. **Run `npm run verify` before every commit.** It is the single gate: syntax checks,
   version/consistency checks, JS + Python suites, all vector checks, SDK sync, paper
   check, and the site build. Do not commit red.
2. **Never hand-edit generated files.** Edit the source, then regenerate:

   | Generated artifact | Source of truth | Regenerate | Verify |
   |---|---|---|---|
   | `packages/aifeed-verify/{lib,schema,index.js,index.d.ts}` | `lib/`, `schema/` (+ hand-written SDK `index.js`) | `npm run build:sdk` | `npm run sdk:check` |
   | `conformance/vectors/**` (34) | `tools/gen-vectors.js` | `npm run vectors` | `npm run vectors:check` |
   | `conformance/mako/**` (39) | `tools/gen-mako-vectors.js` | `npm run mako:vectors` | `npm run mako:vectors:check` |
   | `conformance/aimd/**` (11) | `tools/gen-aimd-vectors.js` | `npm run aimd:vectors` | `npm run aimd:vectors:check` |
   | `docs/process.html`, `benchmarks/enforcement-report.html` | `tools/render-html.js` (+ `benchmarks/*.json`) | `npm run render:html` | `npm run verify` |
   | `site/{logo.svg,process.html,enforcement-report.html,penjelasan.html,aifeed-preprint.pdf}` | root files + `paper/` | `npm run render:html && npm run build:site` | `npm run verify` |
   | `site/demos/**`, apex `site/.well-known/**`, `site/revoke/**` | `demos/sites.js` + `demos/keys.js` + `tools/gen-demos.js` | `npm run demos` | `npm run demos:check` (inside `verify`) |
   | `tools/jcs-php-fixtures.json` | `tools/gen-jcs-php-fixtures.js` | `npm run jcs:fixtures` | plugin `tests/jcs-test.php` |
   | `paper/aifeed-arxiv.tar.gz` | `paper/main.tex`, `refs.bib`, `00README.json` | `tar -czf aifeed-arxiv.tar.gz main.tex refs.bib 00README.json` (in `paper/`) | untar + read `00README.json` |

3. **Never add runtime dependencies.** `dependencies` and `devDependencies` stay empty
   in every `package.json`; `npm run check:consistency` enforces it. Tools use the Node
   standard library only. Python code is stdlib-only.
4. **Canonical bytes are sacred.** Signatures cover JCS-canonical JSON and raw file
   bytes. Do not reformat fixture files, change line endings, or "clean up" whitespace
   inside `conformance/`, `examples/`, or signed `site/.well-known` files.
   `.gitattributes` forces LF; keep it.
5. **Specs are canonical in English.** After editing `spec/en/`, mirror the same
   section in `spec/id/` and `spec/zh/` (informational translations). Keep heading
   structure aligned.
6. **One source of truth per fact.** Measured numbers live in `benchmarks/*.json` and
   `paper/CLAIMS.md`; pages and the paper render from those, never invent numbers.
7. **Evidence labels are mandatory** for factual claims ([F] fact, [M] plausible,
   [E] model/estimate, [S] measured simulation, [H] legal review). See `paper/CLAIMS.md`.
8. **Versions:** release number lives in `package.json`, `packages/aifeed-verify/package.json`,
   `wp-plugin/aifeed.php` (header + `AIFEED_VERSION`), `wp-plugin/readme.txt` (Stable
   tag), `site/index.html` (chip), and the top `CHANGELOG.md` section. Bump everything
   in one change; `npm run check:consistency` proves it. Wire versions (manifest
   `0.1`/`0.2`, AIFeed Markdown `1.0`, MAKO `0.2`) are independent — do not renumber
   them casually. Release steps: `docs/release.md`.

## Commands

```bash
npm run verify            # everything below, one gate
npm run lint:syntax       # parse-check every .js file
npm run check:consistency # versions, deps, secrets, spec pairs, script targets
npm test                  # Node suite (214 tests)
npm run test:py           # independent Python verifier (44 tests)
npm run bench:mako        # regenerate benchmarks/mako-*.json + report
npm run bench:enforcement # regenerate benchmarks/enforcement-*.json|md
npm run fuzz:mako -- --iterations 3000   # parser fuzzing (fixed seeds)
npm run demos             # generate the live demo origins + apex artifacts
npm run demos:check       # generate, then verify every demo manifest/revocation
npm run verify:live       # live conformance against the deployed demos (network)
node bin/cli.js --help    # CLI surface
```

## Repository map

| Path | Owns |
|---|---|
| `spec/{en,id,zh}/` | Normative specifications (manifest v0.1/v0.2, AIFeed Markdown v1.0) |
| `schema/` | JSON Schemas used by the validator and SDK |
| `lib/` | Reference implementation: strict parser, JCS, Ed25519, validation, MAKO/AIMD, delta index, bundles, revocation |
| `bin/cli.js` | CLI entry (`keygen`, `sign`, `rotate`, `validate`, `bundle`, `aimd\|mako …`, `site build`) |
| `packages/aifeed-verify/` | Published SDK (`@aifeed/verify`); `index.js`/`index.d.ts` are hand-written, `lib/`+`schema/` are generated copies |
| `clients/python/` | Independent verifier + tests (differential conformance) |
| `conformance/` | Vectors: 34 manifest, 39 MAKO, 11 AIFeed Markdown, revocation + bundles |
| `integrations/` | Publisher adapters: nginx, Caddy, Apache, Node, Next.js, PHP, Python ASGI, Go, GitHub Action |
| `wp-plugin/` | WordPress publisher plugin (PHP; its own `tests/`) |
| `tools/` | Generators, renderers, benchmarks, fuzzers, checkers — zero-dep |
| `demos/` | Demo origin content (`sites.js`) and public demo keys (`keys.js`) |
| `functions/` | Cloudflare Pages Function: host routing, CORS, `strict` enforcement |
| `docs/` | `architecture.md`, `release.md`, `agent-quickstart.md`, `rotation.md`, `deploy-site.md`, `namespace-setup.md` |
| `site/` | Website sources: `index.html` (hand-written); other files are generated |
| `paper/` | Preprint: `main.tex` (source), `main.md` (mirror), `refs.bib`, `CLAIMS.md`, `CHECKLIST.md`, bundles |
| `.github/workflows/pages-cf.yml` | CI: `render-html` → `build-site` → deploy Cloudflare Pages (skips without the CF secrets) |

## Common recipes

- **Add a conformance vector:** edit the relevant generator in `tools/`, run its
  `…:vectors` script, confirm `…:vectors:check` and the JS/Python suites stay green. The
  generator overwrites the whole directory deterministically — never patch generated
  files by hand. For AIMD/MAKO content changes, signatures are regenerated automatically
  from the generator's embedded key.
- **Change validation rules:** `lib/validate.js` + `schema/*.json` + both verifiers
  (`clients/python/`), then vectors. Cross-language parity is the acceptance test.
- **Add a CLI command:** `bin/cli.js` (+ help text), a test in `tests/cli*.test.js`, and
  a line in `REFERENCE.md`/`README.md` if user-facing.
- **Touch the SDK surface:** hand-written files are `packages/aifeed-verify/index.js`
  and `index.d.ts`. Never edit `packages/aifeed-verify/lib/*` (generated). Run
  `npm run build:sdk && npm run sdk:check`.
- **Change the website:** `site/index.html` and root `penjelasan-aifeed.html` are
  sources; `docs/process.html`/`benchmarks/enforcement-report.html` come from
  `tools/render-html.js`. Run `npm run verify`. Site links to GitHub must include the
  repository name: `https://github.com/denyn1/aifeed-protocol/...`.
- **Add or change a demo origin:** edit `demos/sites.js` (pages, policy overrides via
  `permissions`, theme), run `npm run demos:check`. Signing keys are deterministic and
  public on purpose (`demos/keys.js`, DEMO ONLY). The Pages Function in `functions/`
  routes `<sub>.aifeed.md` to `site/demos/<sub>/`; deployment and DNS anchors are
  documented in `docs/demos.md` and `docs/deploy-site.md`.
- **Change the paper:** `paper/main.tex` is the source; mirror prose edits in
  `paper/main.md`; update `paper/ARXIV-SUBMISSION.md` abstract if the abstract changed;
  `npm run paper:check`; rebuild the arXiv bundle.
- **Publish/upgrade:** follow `docs/release.md`.

## Pitfalls (learned the hard way)

- Windows PowerShell: `grep`/`rg` may be broken here — use `Select-String`/`git grep`;
  never `cd` inside a command when a workdir option exists.
- Generated artifacts are `.gitignore`d on purpose; CI regenerates them. If a script
  reports "missing sources", run the generator first.
- `tools/build-site.js` fails loudly when a source is missing — that is intentional;
  fix the build, do not silence it.
- `tools/replace-domain.js` rewrites URLs across the repo; its `SKIP_FILES` is
  repo-relative (e.g. `docs/namespace-setup.md`). Run its dry-run first.
- npm publishes of prerelease versions require `--tag` (e.g. `--tag next`); the npm
  registry can take minutes to show a new version — verify against
  `https://registry.npmjs.org/@aifeed%2Fverify?write=true`.
- GitHub rate-limits rapid link checkers (429); confirm via the GitHub API instead of
  retrying in a loop.
- Close any PDF viewer before moving/removing `paper/*.pdf` files (Windows file locks).

## Style

Match existing code: CommonJS `require`, 2-space indent, no comments unless the logic
is non-obvious, zero dependencies, deterministic output, and tests next to the behavior
they protect. Keep files small and single-purpose; prefer adding a `tools/` script over
a framework.
