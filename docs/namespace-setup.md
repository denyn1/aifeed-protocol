# Namespace setup (GitHub, npm, domain)

<p><a href="namespace-setup.md">English</a> · <a href="namespace-setup.id.md">Bahasa Indonesia</a> · <a href="namespace-setup.zh.md">中文</a></p>

Run this checklist once, then record the results in `paper/CHECKLIST.md`.

## 1. GitHub repository — canonical at `denyn1/aifeed-protocol`

**Status (2026-09-21):** the canonical repository is
<https://github.com/denyn1/aifeed-protocol>. The `aifeed` organization has **not** been
created; that is optional. If the repository is ever transferred to an `aifeed` org,
GitHub keeps old URLs working via redirects, so links stay valid.

1. Repository settings (re-check after any transfer):
   - Default branch `main`, squash-merge allowed, delete branch on merge.
   - Branch protection: require pull request + passing CI before merge.
   - Security: enable private vulnerability reporting (matches `SECURITY.md`).
   - The WordPress plugin ships in this monorepo under `wp-plugin/`; a separate
     `aifeed/aifeed-wp-plugin` repository is optional.
2. Remote (current canonical URL):

   ```bash
   cd D:\Software\aifeed.org
   git remote set-url origin https://github.com/denyn1/aifeed-protocol.git
   git push -u origin main
   ```

   (Keys are excluded by `.gitignore`. The local folder name does not affect git.)
3. Optional later: create the `aifeed` organization and transfer the repository; revisit
   the deferred Marketplace Action `aifeed/sign@v1` at the same time.

## 2. npm scope — `@aifeed` (**published 2026-09-16**)

1. Create an npm account (or use an existing one) and enable 2FA. ✅ account
   `denynorman`.
2. Create the organization scope: npm website → **Organizations** → **Create
   organization** → name `aifeed`, plan **Free (unlimited public packages)**. ✅
3. Publish when ready:

   ```bash
   cd packages/aifeed-verify
   npm publish --access public
   ```

   `packages/aifeed-verify/package.json` already declares
   `"publishConfig": { "access": "public" }`, `files`, `exports`, and
   `repository`/`homepage`/`bugs` metadata.

   **Published:** `@aifeed/verify@1.0.0-draft` on 2026-09-16, then updated to
   **`1.0.0-draft.1`** the same day (TLS/private-fetch option forwarding); dist-tags
   `latest` and `next` both point at the newest version. Verify with
   `npm view @aifeed/verify version dist-tags`; the registry landing page is
   <https://www.npmjs.com/package/@aifeed/verify>.
4. Add the scope to `package.json` of the protocol package if it should be published as
   `@aifeed/protocol` later (currently `"private": true` on purpose).

   Note: publish tokens are secrets — use a granular token with *Bypass 2FA* (or a
   Classic **Automation** token) for non-interactive publishes, keep it local, and never
   paste it into chats or issues; regenerate 2FA recovery codes if they are ever exposed.

## 3. Canonical domain — research results (2026-09-15) and recommendation

`aifeed.org` is owned by an unrelated organization ("AI-FEED", a food charity) and must
not be used for normative URLs — that is why the URL migration to `aifeed.md` was
mandatory. Registration research (RDAP + DNS NS cross-check, 2026-09-15):

| Domain | Status | Notes |
|---|---|---|
| `aifeed.org` | taken | AI-FEED food charity (US) — reason the migration was mandatory |
| `aifeed.com` | taken | Afternic parking (likely for sale) |
| `aifeed.dev` | taken | AI news feed site |
| `aifeed.app` | taken | "AiFeed — Your AI News Feed" |
| `aifeed.net` | taken | resolves (TLS error) |
| `aifeed.io` | taken | Afternic parking; RDAP bootstrap false-negative |
| `aifeed.co` | taken | GoDaddy parking |
| `aifeed.eu`, `.news`, `.site`, `.space`, `.info` | taken | parked/active |
| **`aifeed.md`** | **purchased 2026-09-16** | canonical domain; 9 chars; reads "AIFeed Markdown" |
| **`aifeedprotocol.org`** | **likely free** | RDAP 404 + no NS; standards-neutral `.org` (cf. `rslstandard.org`) |
| **`aifeed.id`** | **likely free** | RDAP 404 + no NS; Indonesian TLD, local leverage |
| `aifeed.tech`, `.tools`, `.software`, `.blog`, `.pro`, `.us`, `.website`, `.network`, `.systems`, `.zone`, `.chat` | likely free | weaker brands |

### Decision and status

**Canonical domain: `aifeed.md` — purchased by the maintainer, 2026-09-16.** DNS was
still empty on 2026-09-16 (no NS/A/TXT records); configure it before public or
submission use. The URL migration was executed 2026-09-15 to remove the third-party
`aifeed.org` references immediately:

```bash
node tools/replace-domain.js --domain aifeed.md          # dry-run (lists occurrences)
node tools/replace-domain.js --domain aifeed.md --apply  # executed 2026-09-15
```

Result: 168 plain + 4 escaped occurrences replaced across 91 files; signed fixtures,
manifest vectors, and the JCS cross-language fixture were regenerated; full regression
passed (JS 195/195, Python 44/44, vectors 25+39+11, SDK in sync, WordPress E2E).

### DNS records

The domain's nameservers are Cloudflare (`etienne.ns.cloudflare.com`,
`leia.ns.cloudflare.com`), and **Cloudflare Pages is the hosting path**: `aifeed.md`
(plus `www` and the seven demo subdomains) are custom domains of the Pages project,
with DNS and TLS managed by Cloudflare. Deployment steps are in `docs/deploy-site.md`.

Remaining manual items:

1. **Email** — `contact@aifeed.md` is routed via Cloudflare Email Routing; keep
   `paper/main.tex` / `paper/main.md` and `SECURITY.md` in sync if it changes.
2. **`_aifeed` TXT anchors** — published for the apex and all seven demo origins
   (AIFeed v0.1 §6); the records are listed in `docs/demos.md`.

`aifeedprotocol.org` / `aifeed.id` remain optional aliases (redirects) if you want them
later.


