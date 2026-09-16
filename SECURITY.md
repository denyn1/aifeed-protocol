# Security Policy

## Supported versions

| Version | Status | Security fixes |
|---|---|---|
| AIFeed Markdown v1.0 (AIFeed 1.0.x draft) | current | yes |
| AIFeed 0.2.x (MAKO profile) | maintained | yes |
| AIFeed 0.1.x | legacy | best effort |

## Reporting a vulnerability

Do **not** open a public issue. Use the repository's **private security advisory**
(Security tab → "Report a vulnerability"), which reaches the maintainers privately. If
you cannot use that channel, contact the maintainers listed in `GOVERNANCE.md` and ask
for a secure channel before sharing details.

Please include:

- affected component (`lib/mako.js`, `bin/cli.js`, Python client, WordPress plugin,
  schemas, spec),
- a minimal reproduction (input bytes, command, or HTTP trace),
- impact assessment (e.g., signature bypass, permission bypass, YAML parsing, DoS),
- whether a published conformance vector fails.

## Scope

In scope: signature verification bypass, cross-format/context replay, permission
bypass (restrict-only violations), digest/index integrity, parser side effects
(pollution, memory exhaustion), plugin privilege issues, and downgrade handling.

Out of scope: self-signed test fixtures, localhost loopback test exceptions, and
attacks that require pre-existing control of the origin's private key or DNS.

## Key compromise and revocation

If a signing key is compromised:

1. Publish a new key (`key_id` rotation; `pk2` in the `_aifeed` DNS record supports
   rotation).
2. Request a revocation document for the old fingerprint via the registry process in
   `GOVERNANCE.md`.
3. Re-sign the manifest with the new key; clients with key pinning will alarm on the
   change (by design).

## Disclosure

We aim to acknowledge reports within 7 days and to ship a fix or mitigation within 30
days for high-severity issues. Credit is given in the changelog unless you prefer to
stay anonymous.
