# Contributing to AIFeed

<p><a href="CONTRIBUTING.md">English</a> · <a href="CONTRIBUTING.id.md">Bahasa Indonesia</a> · <a href="CONTRIBUTING.zh.md">中文</a></p>

Thanks for helping make AIFeed a global, trustworthy standard. This repository hosts the
specification, the reference implementation, conformance vectors, and the WordPress
publisher.

Before changing anything, read the maintenance contract:
[`AGENTS.md`](AGENTS.md) (generated files, version locations, pitfalls),
[`docs/architecture.md`](docs/architecture.md) (module map, invariants), and
[`docs/release.md`](docs/release.md) (release/upgrade steps).

## Ways to contribute

- **Specification feedback** — open an issue describing the problem, the affected
  section, and a concrete proposal. Breaking changes need a version impact note.
- **Implementation** — pull requests are welcome for `lib/`, `bin/`, `clients/python/`,
  `packages/`, `wp-plugin/`, and tooling.
- **Conformance vectors** — new positive/negative cases are the fastest way to improve
  interoperability. Include the expected error/warning codes.
- **Translations** — the specification is canonical in English; official translations
  live in `spec/<lang>/`. See the language policy below.
- **Integration reports** — pilot results, edge (nginx/Caddy/Cloudflare) setups, and
  performance numbers are highly valuable. Use the templates in `pilot/`.

## Requirements for spec changes

1. State evidence labels ([F] fact, [M] plausible, [E] model, [S] measured simulation,
   [H] legal review) for any factual claim.
2. Run the single gate and keep it green:
   ```bash
   npm run verify
   ```
   It covers syntax checks, version/consistency checks, the JS + Python suites, all
   vector checks, SDK sync, the paper check, and the site build. See `AGENTS.md` for
   the full contract (generated files, version locations, evidence labels).
3. Update both language directories (`spec/en/` canonical, `spec/id/` translation) or
   mark the translation as pending in the PR description.
4. Add or update conformance vectors for any normative behavior change.
5. For PHP changes, run `php -l` on changed files plus
   `php tests/jcs-test.php && php tests/mako-test.php`.

## Code guidelines

- Zero runtime dependencies (Node >= 20, PHP >= 7.2, pure Python) is a hard rule.
- Parsers must follow the strict/safe parsing rules: duplicate keys rejected, NFC
  required, integers bounded, YAML-safe subset only, no `__proto__` pollution.
- No secrets in tests or fixtures; use deterministic seeds.
- Keep error codes stable once published; new codes are additive.

## Translation policy

The English documents in `spec/en/` are normative. Official translations are
informational; when they diverge, English wins. Priority languages: the UN official six
plus Indonesian, Portuguese, Hindi, and Kiswahili. Open a PR per language and keep line
structure close to the source to simplify review.

## Licensing of contributions

Inbound equals outbound, with no CLA:

- Code (`lib/`, `bin/`, `clients/`, `packages/`, `integrations/`, `tools/`, plugin) —
  MIT.
- Specification text (`spec/`) — CC BY 4.0.
- Conformance vectors (`conformance/`) — CC0.

By opening a pull request you confirm you have the right to submit the work under these
terms. Contributions to anti-abuse pattern lists or detection heuristics are not
accepted through public issues or pull requests (see `GOVERNANCE.md`, "Licensing and
open-core policy").

## Governance and security

See `GOVERNANCE.md` and `SECURITY.md`. Do not open public issues for security reports.
