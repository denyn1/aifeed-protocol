# Key rotation runbook

<p><a href="rotation.md">English</a> · <a href="rotation.id.md">Bahasa Indonesia</a> · <a href="rotation.zh.md">中文</a></p>

AIFeed manifests can replace their signing key without breaking verification, using
the `rotation` directive (spec: [`spec/en/aifeed-v0.2.md`](../spec/en/aifeed-v0.2.md)
§14). This runbook covers the normal ceremony, the emergency path, and what clients see.

## Before you start

- The manifest must be `version: "0.2"`. A v0.1 manifest rotates by re-signing as v0.2
  first (`aifeed sign`).
- You control the `_aifeed` DNS record for the domain.
- Permanent revocation of the old key needs governance signatures (registry SLA);
  confirm it in advance or pre-authorize an offline break-glass key.

## Normal rotation (two commands)

1. Generate the successor and publish the overlap state:

   ```bash
   aifeed rotate --dir ./my-site --window 72
   ```

   This writes the overlap manifest (signed by the OLD key, carrying
   `rotation.successor_fp`, `effective_at`, `grace_until`), saves the successor key as
   `aifeed-private.next.pem`, and prints the DNS record:

   ```
   _aifeed.example.com TXT "v=aifeed1; pk=<old>; pk2=<new>; effective_at=<ts>; manifest=https://example.com/.well-known/ai.json"
   ```

   `pk2` is an advisory cross-check, not a requirement: if it is missing or wrong,
   verifiers warn (`rotation_anchor_unverified`) but keep the signed directive as the
   anchor. Publishing it is still recommended.

2. Publish the overlap manifest and the DNS record. After `effective_at`:

   ```bash
   aifeed rotate --dir ./my-site
   ```

   This signs the cutover manifest with the successor key (`identity.public_key`
   updated, `rotation.predecessor_fp` binding the retired key) and prints the new DNS
   record (`pk=<new>`, drop `pk2`).

3. Publish the old fingerprint in the revocation registry (governance signatures), then
   verify from outside:

   ```bash
   aifeed validate example.com
   ```

## Emergency rotation (suspected key compromise)

Do NOT revoke first — an instant revocation opens an outage. Compress the overlap and
cut over immediately:

```bash
aifeed rotate --dir ./my-site --accelerated   # 1 h lead, 6 h window
# after effective_at:
aifeed rotate --dir ./my-site
# then publish the old fingerprint
```

During the compressed window signatures from the possibly-compromised key are still
accepted, by design, for at most the window length. Rotation protects keys, not
origins: an attacker who already controls your content and DNS is out of scope.

## Checking state without changing anything

```bash
aifeed rotate --dir ./my-site --dry-run --json
```

Phases: `announced` (old key fully valid), `grace` (old key valid with warning
`grace_accepted`), `complete` (successor active; old key denied).

## What clients see

| Situation | Result |
|---|---|
| Overlap manifest, inside grace | `VERIFIED`, warning `grace_accepted` |
| Stale old-key manifest past grace | `UNVERIFIED`, `rotation_denied` |
| Dormant pin meeting the cutover binding | `VERIFIED`, warning `rotation_resync` |
| Key changed without announcement | `UNVERIFIED`, `rotation_denied` |
| Old key fingerprint in the registry | `UNVERIFIED`, `key_revoked` |
