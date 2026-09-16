# AIFeed Governance (interim)

<p><a href="GOVERNANCE.md">English</a> · <a href="GOVERNANCE.id.md">Bahasa Indonesia</a> · <a href="GOVERNANCE.zh.md">中文</a></p>

AIFeed is an open standard with a public registry (revocations) and a shared trust
model. This document describes how decisions are made today and the path to a
multi-stakeholder foundation.

## Current status

AIFeed is at draft stage (AIFeed Markdown v1 / AIFeed 0.2.x). Governance is **interim**: a group of
maintainers ("the maintainers") stewards the specification, the reference
implementation, conformance vectors, and the revocation registry process.

## Decision making

1. **Lazy consensus** for routine changes: a pull request with green checks and no
   objections for 7 days is merged.
2. **Specification changes** require two maintainer approvals and a changelog entry;
   breaking changes require a version impact note and a 14-day comment window.
3. **Registry actions** (revocation, key events) follow the multi-signature process:
   sign-offs by distinct maintainer keys meeting the configured threshold
   (interim 2-of-3, target 3-of-5), recorded in the transparency log.
4. **Disputes** are escalated to a written summary in the issue tracker; conflicts of
   interest must be declared.

## Roles

- **Maintainers** — merge rights, releases, registry participation, security response.
- **Contributors** — anyone whose PR, vector, translation, or report is accepted.
- **Conformance reviewers** — independently run the vectors; may be listed in releases.

A public maintainer list (names, roles, keys) is published with each release. Until
that list is published, the repository's private security advisory and the maintainers
reachable through the project website are the contact channels.

## Neutrality commitments

- The specification, schemas, and test vectors are licensed for unrestricted reuse
  (CC BY 4.0 / MIT / CC0) so no single vendor controls implementation.
- The registry process, key requirements, and revocation criteria are public and
  documented; changes follow the specification change process above.
- No pay-to-allow listing; listing is a technical verification, not a commercial tier.
- Independent implementations are explicitly welcome; conformance is tested by vectors,
  not by affiliation.

## Licensing and open-core policy

AIFeed is an **open core + open standard** project. Trust in the protocol depends on
anyone being able to verify declarations and reproduce conformance, so the verification
path is permanently open.

### Stay open (no exceptions)

| Component | License |
|---|---|
| Specification and schemas (`spec/`, `schema/`) | CC BY 4.0 |
| Verifiers, parsers, SDK (`lib/`, `clients/`, `packages/`) | MIT |
| CLI, WordPress plugin, integrations, tools | MIT |
| Conformance vectors (`conformance/`) | CC0 |
| Revocation/transparency-log client and formats | MIT |

There MUST NOT be proprietary extensions on the verification path: any conforming
implementation built from open artifacts must be able to verify manifests, documents,
and revocation checks end to end.

### Stay closed

| Item | Why |
|---|---|
| Private keys, registry signing keys, CI secrets | Cryptography, never published |
| Customer and pilot data | Privacy and contracts |
| Anti-abuse tactics (pattern lists, detection heuristics, models) | Publishing them lets evaders adapt; interfaces and policy stay open |

### Commercial layer

Value is delivered as services, not code secrecy: hosted registry with SLAs,
enforcement-as-a-service for hosts/CDNs (see `benchmarks/edge/`), conformance
certification, pilots, support, and optional enterprise features (SSO, roles, audit
reports) that may be open-core. The client side required to consume AIFeed remains MIT.

### Trademark and certification

The "AIFeed" name and the "AIFeed Verified" badge are controlled marks: forks are free to
exist under their own names, and only implementations that pass the published
conformance vectors may use the marks. Contribution licensing is inbound=outbound (MIT
for code, CC BY 4.0 for specification text, CC0 for vectors); no CLA is required.

## Roadmap to a foundation

Target before a 1.0 freeze:

1. Publish the maintainer list with keys and rotation policy.
2. Move the revocation registry to a multi-stakeholder body with a published charter.
3. Operate the transparency log with signed checkpoints (C2SP signed-note format).
4. Publish annual transparency reports (registry actions, incidents, disputes).

## Versioning and deprecation

- Protocol versions are `0.x` until the first freeze; breaking changes bump the minor.
- Error codes, media types, and signed-bytes separations are versioned and never
  silently reused.
- Deprecations are announced in the changelog with at least one minor cycle of overlap.
