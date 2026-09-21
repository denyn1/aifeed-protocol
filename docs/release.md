# Release and upgrade checklist

<p><a href="release.md">English</a> · <a href="release.id.md">Bahasa Indonesia</a> · <a href="release.zh.md">中文</a></p>

One page for cutting a release, publishing the SDK, deploying the site, and keeping
consumers in sync. Keep it boring: bump in one change, prove it with
`npm run check:consistency`, gate on `npm run verify`.

## Version locations (bump together)

| File | What to change |
|---|---|
| `package.json` | `version` (release number, e.g. `1.0.0-draft` → `1.0.0`) |
| `packages/aifeed-verify/package.json` | `version` (same core; prerelease suffixes allowed, e.g. `1.0.0-draft.2`) |
| `wp-plugin/aifeed.php` | header `Version:` and `define('AIFEED_VERSION', …)` |
| `wp-plugin/readme.txt` | `Stable tag:` (+ a changelog entry) |
| `site/index.html` | footer chip `v<version>` |
| `CHANGELOG.md` | new top section `## [<version>] — YYYY-MM-DD` |
| `SECURITY.md` | supported-versions row if the release line changes |

Wire versions are independent: manifest `0.1`/`0.2`, AIFeed Markdown `1.0`, MAKO `0.2`.
Do not renumber them unless the wire format actually changes.

## Steps

```bash
npm run verify            # must be green before anything else
# bump the files above + write the changelog entry
npm run check:consistency # proves the versions line up
npm run verify            # again, after the bump
git add -A && git commit -m "release: <version>"
git tag -a v<version> -m "AIFeed <version>"
git push origin main --tags
```

Deployment: `.github/workflows/pages-cf.yml` rebuilds `site/` (reports, landing page,
demo origins) on every push to `main` and deploys it with `functions/` to Cloudflare
Pages, which serves `aifeed.md`, `www.aifeed.md`, and the seven demo subdomains. It
needs the repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`; without
them it skips. Local equivalent:
`npx wrangler@latest pages deploy site --project-name aifeed --branch main`. Check the
live pages afterwards; DNS anchors for the demos are listed in `docs/demos.md`.

## Publishing the SDK

```bash
# non-interactive: granular token with "Bypass 2FA" (or a Classic Automation token)
cd packages/aifeed-verify
npm publish --access public --tag next --//registry.npmjs.org/:_authToken=$NPM_TOKEN
npm dist-tag add @aifeed/verify@<version> latest --//registry.npmjs.org/:_authToken=$NPM_TOKEN
```

- Prerelease versions **require** an explicit `--tag` (`next`); stable versions default
  to `latest`.
- The npm registry processes publishes asynchronously (HTTP `202`) and caches reads for
  a few minutes. Verify against the write endpoint:
  `curl -s "https://registry.npmjs.org/@aifeed%2Fverify?write=true" | node -e "…"`
  or `npm view @aifeed/verify version dist-tags`.
- Never paste tokens into files, commits, or issues; keep them in the environment.

## Publishing the MCP server

Same flow as the SDK, after rebuilding the generated copies from the repo root:

```bash
npm run build:mcp
cd packages/aifeed-mcp-server
npm publish --access public --tag next --//registry.npmjs.org/:_authToken=$NPM_TOKEN
```

- The `files` list ships `index.js`, `README.md`, `lib/`, `schema/`, and `LICENSE` with
  zero dependencies. Prerelease versions require `--tag next`.

## Publishing the Python package

The independent verifier ships from `clients/python/` as the PyPI distribution `aifeed`
(import package `aifeed/`; stdlib only). The version mirrors the release core as a PEP 440
pre-release (`1.0.0a1` for `1.0.0-draft`), and `check-consistency` guards the pair:

```bash
cd clients/python
python -m build
python -m twine upload dist/* -u __token__ -p "$PYPI_TOKEN" --non-interactive
```

- `pip install aifeed` installs the pre-release while no stable version exists; document
  `pip install --pre aifeed` when in doubt. Verify with
  `https://pypi.org/pypi/aifeed/json` after the upload.
- The wheel ships `aifeed/` plus the `aifeed_verify`/`aifeed_mako` alias modules and the
  `aifeed-verify`/`aifeed-mako` console scripts.

## WordPress plugin

The plugin ships from `wp-plugin/` in this repository. For a WordPress.org release,
bump the header/`Stable tag`, add the changelog section in `readme.txt`, run the PHP
suites (`php -l`, `php tests/jcs-test.php`, `php tests/mako-test.php`), then tag.

## Paper (when the release changes claims)

1. Edit `paper/main.tex`, mirror prose in `paper/main.md`.
2. If the abstract changed, update `paper/ARXIV-SUBMISSION.md`.
3. `npm run paper:check`; rebuild the PDF (Tectonic) and the arXiv bundle:
   `cd paper && tar -czf aifeed-arxiv.tar.gz main.tex refs.bib 00README.json`.
4. Follow `paper/CHECKLIST.md` before submitting a new arXiv version.

## Upgrading consumers

- Manifest verification accepts `0.1.x` and `0.2.x`; other versions report
  `upgrade_required`. Keep legacy read support when the wire version moves.
- After an SDK release, smoke-test the published package in a scratch folder:
  `npm install @aifeed/verify@<version>` and run the quickstart from
  `packages/aifeed-verify/README.md`.
- The site is the artifact consumers cite: confirm the new version chip and changelog
  are live before announcing.
