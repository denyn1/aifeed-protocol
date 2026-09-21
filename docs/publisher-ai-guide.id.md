# Panduan AI Publisher — biarkan AI coding agent memasang AIFeed end-to-end

<p><a href="publisher-ai-guide.md">English</a> · <a href="publisher-ai-guide.id.md">Bahasa Indonesia</a> · <a href="publisher-ai-guide.zh.md">中文</a></p>

Panduan ini untuk **pemilik website**. Isinya prompt siap-tempel yang memerintahkan AI
coding agent (VS Code agent mode, Copilot CLI, OpenCode, Codex CLI, Claude Code,
HermesAgent, atau yang setara) untuk **menganalisis website Anda dan membangun setup
AIFeed lengkap secara otomatis** — dari pembuatan kunci hingga manifest live yang
terverifikasi.

Alurnya agentic: AI lebih dulu memeriksa situs, stack, hosting, dan kontrol DNS Anda,
mengklasifikasikannya (S / M / L / XL di bawah), menyajikan rencana untuk Anda setujui,
lalu mengeksekusinya fase per fase. Setiap fase diakhiri gate yang bisa dicek mesin.
Tidak ada yang jalan berdasarkan asumsi.

> Pendamping sisi crawler/konsumen: [`agent-quickstart.md`](agent-quickstart.md).
> Referensi perintah: [`REFERENCE.md`](REFERENCE.md). Runbook rotasi:
> [`rotation.md`](rotation.md). Catatan deploy: [`deploy-site.md`](deploy-site.md).

## 0. Aturan dasar — tempel sekali, tegakkan selalu

Tempel blok ini ke AI tool Anda sebelum apa pun, ganti `{placeholder}`:

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

Kontrol plan-first per tool (maksud sama, mekanisme bawaan masing-masing):

| AI tool | Cara memaksa plan-first |
|---|---|
| OpenCode | Tekan Tab untuk plan mode; `/undo` membatalkan; setujui di prompt permissions |
| Claude Code | Plan mode (Shift+Tab / `--permission-mode plan`); Esc menghentikan; review diff sebelum commit |
| VS Code agent mode | Pakai peran Plan; permissions Manual/assisted; review di Agents window atau Chat view |
| Copilot CLI | Mulai konservatif; konfirmasi tiap batch perintah sebelum jalan |
| Codex CLI | *Verifikasi dari docs vendor* — pakai flag approvals/sandbox-nya, konfirmasi sebelum apply |
| HermesAgent | *Verifikasi dari docs vendor* — pakai mekanisme plan/approval-nya, konfirmasi sebelum apply |

### Prasyarat (semua kelas)

- Node.js ≥ 20 di mesin tempat perintah dijalankan.
- Checkout `aifeed-protocol` (semua perintah di bawah dijalankan sebagai `node bin/cli.js …`
  dari root repo; shim global `aifeed` mengekspos permukaan yang sama bila terinstal).
- Domain Anda, plus kemampuan menambah satu record DNS TXT.
- Akses hosting sesuai kelas Anda (cukup upload untuk S, SSH/admin untuk M+).

### Konvensi yang dipakai di setiap prompt

- `{DOMAIN}` domain Anda, mis. `example.com`. `{SITE_DIR}` file statis hasil build Anda.
  `{KEY_DIR}` direktori khusus kunci di mesin lokal (tidak pernah di-commit, tidak pernah
  di-upload).
- Exit code: `0` = VERIFIED/sukses, `1` = UNVERIFIED/gagal, `2` = error penggunaan.
- Utamakan output `--json` saat langkah dirangkai; selain itu human-readable.

## Master prompt — analisis dulu, lalu bangun (salin-tempel)

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

## Track S — kecil / statis / shared hosting (tanpa SSH)

Tujuan: manifest bertanda tangan + konten delta live, terverifikasi end-to-end.

Memakai Vite, Astro, atau Next.js (`output: 'export'`)? Plugin drop-in menandatangani
output build secara otomatis: `npm i -D @aifeed/frameworks@next`, `npx aifeed-build keygen
--out .aifeed`, lalu tambahkan `aifeed({ domain })` ke konfigurasi framework (Next.js:
`"postbuild": "aifeed-next --domain …"`). Sisa track ini berlaku tanpa perubahan.

**PS-1 — kunci (hanya lokal).** Prompt:

```text
Generate an Ed25519 keypair for {DOMAIN} into {KEY_DIR} (do not overwrite
without asking). Show me the fingerprint line only — never print the private key.
Gate: {KEY_DIR}/aifeed-private.pem (0600) and {KEY_DIR}/aifeed-public.txt exist.
```

Perintah yang dijalankan AI:

```bash
node bin/cli.js keygen --out {KEY_DIR}
```

Ekspektasi: path tercetak; file publik berisi nilai `ed25519:…` + fingerprint.
Gate: kedua file ada; file privat hanya bisa dibaca pemilik.

**PS-2 — build.** Prompt:

```text
Build AIFeed for the static files in {SITE_DIR} for domain {DOMAIN} using the key
in {KEY_DIR}/aifeed-private.pem, profile "both", with llms.txt. List every file
created under .well-known/ and the per-page outputs. Do not deploy anything yet.
Gate: .well-known/ai.json exists in the build output.
```

Perintah:

```bash
node bin/cli.js site build {SITE_DIR} --domain {DOMAIN} --key {KEY_DIR}/aifeed-private.pem --profile both --llms
```

**PS-3 — verifikasi lokal.** Prompt:

```text
Validate the built manifest directory ({SITE_DIR}/.well-known, where ai.json and
ai-signature.json sit side by side) for {DOMAIN} and show result + any
errors/warnings in JSON. Gate: result VERIFIED, errors [].
```

Perintah:

```bash
node bin/cli.js validate {SITE_DIR}/.well-known --domain {DOMAIN} --json
```

(`validate DIR` membaca `ai.json` langsung di dalam DIR, jadi arahkan ke
`.well-known`, bukan site root.)

**PS-4 — publish + DNS (langkah manusia dibantu AI).** Prompt:

```text
The build is VERIFIED. Now: (1) print the exact files to upload preserving paths
(.well-known/ai.json, .well-known/ai-signature.json, index + pages);
(2) print the exact DNS TXT record to create at _aifeed.{DOMAIN} using values
from the built manifest and key (format: v=aifeed1; pk=<ed25519:…>;
fp=<sha256:…>; manifest=https://{DOMAIN}/.well-known/ai.json);
(3) wait — I will upload and add the record, then say CONTINUE.
```

**PS-5 — verifikasi live (setelah CONTINUE Anda).** Prompt:

```text
Verify https://{DOMAIN} live: manifest reachable, signature valid, DNS anchor
matches. Report VERIFIED + dns_anchored true, or stop with the full output.
Gate: result VERIFIED and dns_anchored true.
```

Perintah yang dijalankan AI:

```bash
node bin/cli.js validate {DOMAIN} --json
```

Track S selesai saat gate PS-5 lolos.

## Track M — menengah / VPS / CMS / WordPress

Tujuan: AIFeed disajikan stack live, di-sign ulang terjadwal, anchor ditegakkan.

**PM-1 — deteksi (melanjutkan Fase 0).** Prompt:

```text
Inspect the server: is this WordPress (wp-admin/wp-json present?) or another CMS,
or a VPS with nginx/Caddy/Apache/Node? Check for scheduled tasks/cron and for an
existing AIFeed manifest. Report stack + evidence, then propose path A (plugin)
or path B (adapter) — do not install anything yet.
```

**PM-2A — jalur WordPress.** Prompt:

```text
Install and configure the plugin in wp-plugin/ on this WordPress site for
{DOMAIN} following wp-plugin/README.md exactly (keygen in admin, profiles,
dual-stack). Then fetch /.well-known/ai.json and validate it.
Gate: validate reports VERIFIED for {DOMAIN}.
```

Referensi (jangan duplikat): [`../wp-plugin/README.md`](../wp-plugin/README.md).

**PM-2B — jalur adapter.** Prompt:

```text
Wire the matching adapter from integrations/ for this stack
(nginx/caddy/apache/node/nextjs/php/python/go per integrations/README.md):
build the site output if static, otherwise configure content negotiation +
signature headers per the adapter's file. Show the exact config diff.
Apply only after my approval. Gate: validate direktori manifest (ai.json +
ai-signature.json berdampingan — {SITE_DIR}/.well-known untuk hasil site build)
melaporkan VERIFIED.
```

Referensi: [`../integrations/README.md`](../integrations/README.md).

**PM-3 — re-sign terjadwal.** Prompt:

```text
Set up unattended re-signing (monthly cron or equivalent for this host) that
re-runs sign on the manifest directory and reloads the server only if
validate passes. Print the exact schedule entry. Never store keys outside
{KEY_DIR} or the host secret store.
```

**PM-4 — verifikasi live yang ditegakkan.** Prompt:

```text
Verify {DOMAIN} live with DNS anchor required and report errors in JSON.
Gate: result VERIFIED and dns_anchored true.
```

Perintah:

```bash
node bin/cli.js validate {DOMAIN} --require-dns-anchor --json
```

Track M selesai saat gate PM-4 lolos dan jadwal re-sign terpasang.

## Track L — besar / multi-service / SSR / tim

Tujuan: AIFeed sebagai pipeline bergerbang CI, staged, termonitor.

**PL-1 — gerbang CI.** Prompt:

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

**PL-4 — penunjuk pilot.** Prompt:

```text
Summarize readiness for a 30-day pilot per docs in pilot/ and list the three
riskiest unknowns with owners. No action beyond the report.
```

Track L selesai saat gate PL-2 lolos di production dan PL-3 menghasilkan laporan.

## Track XL — raksasa / CDN / multi-region / enterprise

Tujuan: AIFeed yang ditegakkan, tergovernansi, dan teraudit dengan disiplin upacara kunci.

**PX-1 — desain enforcement.** Prompt:

```text
Design edge enforcement for {DOMAIN} (deny training crawlers, rate-limit
non-compliant ones, serve compliant clients signed content), referencing the
strict demo behaviour and integrations/ adapters. Produce the design + config
diff. Apply only after approval from the on-call owner I name.
Gate: design reviewed; nothing applied yet.
```

**PX-2 — kunci governance + rotasi.** Prompt:

```text
Inventory signing and governance keys, confirm backup and break-glass
procedure, then rehearse rotation with --dry-run (docs/rotation.md). Only on
explicit approval, run the real ceremony. Gate: dry-run clean; after ceremony,
validate VERIFIED with dns_anchored true.
```

Perintah:

```bash
node bin/cli.js rotate --dir {SITE_DIR} --dry-run --json
node bin/cli.js rotate --dir {SITE_DIR} --window 72
```

Upacara lengkap: [`rotation.md`](rotation.md).

**PX-3 — registry + monitoring.** Prompt:

```text
Wire revocation checking (--revocation-url, --governance-key) into validation,
and set up recurring live verification equivalent to npm run verify:live plus
log monitoring. Gate: live check green two runs in a row.
```

Perintah:

```bash
node bin/cli.js validate {DOMAIN} --revocation-url https://aifeed.md/revoke/v1/{DOMAIN}.json --json
npm run verify:live
```

**PX-4 — bukti kepatuhan.** Prompt:

```text
Collect the evidence pack: manifest + signatures, validation JSON outputs,
rotation/revocation records, benchmark numbers from committed artifacts only
(never invent numbers), each claim labeled per paper/CLAIMS.md conventions.
Gate: pack complete, every number traceable to an artifact.
```

Track XL selesai saat gate PX-3 lolos dua kali berturut-turut dan paket bukti terarsip.

## Aset — gambar, PDF, dan unduhan

Berkas non-HTML (gambar, video, audio, PDF, arsip, tautan `download` apa pun)
dideklarasikan per halaman di frontmatter bertanda tangan pada `aifeed.assets`:

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

- **Hanya rujukan** — aset tidak pernah di-inline; agen yang memutuskan mengunduh.
- **Izin sama** — pengambilan aset mengikuti usage dan limit halaman (`retrieval`,
  `commercial_use`, …), dan template edge mencakup path aset juga.
- **Integritas** — bila `size` atau `sha-256` ada, verifikasi byte yang diunduh dengan
  `sdk.verifyAsset(bytes, asset)` sebelum dipakai. `aifeed site build` (dan Studio)
  mengisi `mime` dari ekstensi dan menghitung hash berkas lokal di direktori sumber
  (≤16 MiB); aset hasil crawl/remote tetap tanpa hash sampai agen mengunduhnya.
- **Triase pra-fetch** — entri indeks membawa jumlah `assets`, jadi agen bisa menilai
  apakah halaman layak diambil sebelum mengunduh apa pun.

## Lencana penerbit

Tunjukkan kepada pengunjung dan agen bahwa origin sudah ditandatangani:

```html
<a href="https://aifeed.md"><img src="https://aifeed.md/badge.svg" alt="verified by AIFeed"></a>
```

Versi Markdown:

```md
[![verified by AIFeed](https://aifeed.md/badge.svg)](https://aifeed.md)
```

Tautkan lencana, jangan salin, agar pembaruan berikutnya ikut terbawa otomatis.

## Lebih suka aplikasi? Pakai AIFeed Studio

Kalau Anda lebih suka klik daripada prompt, repositori ini menyertakan aplikasi lokal
yang mengerjakan hal yang sama: `npm run studio` menyajikan UI tanpa dependensi di
<http://127.0.0.1:7777>. Buat proyek, arahkan ke direktori HTML lokal atau crawl situs
live, sunting kebijakan restrict-only (termasuk preset news/ecommerce), build
incremental, verifikasi, lalu ekspor — folder atau `.tar.gz`, record DNS TXT, dan
petunjuk adapter sesuai stack Anda. Kunci tetap di mesin Anda. Lihat
[`../studio/README.id.md`](../studio/README.id.md).

## Lampiran A — matriks kapabilitas AI tool

Fakta di bawah diverifikasi terhadap docs resmi vendor pada 2026-09-16, kecuali sel
bertanda *verifikasi dari docs vendor* (konfirmasi sebelum mengandalkannya).

| Kapabilitas | OpenCode | Claude Code | VS Code agent mode | Copilot CLI | Codex CLI | HermesAgent |
|---|---|---|---|---|---|---|
| Menjalankan perintah terminal | ya (dibatasi permissions) | ya (dibatasi permissions) | ya (dibatasi approval) | ya | *verifikasi dari docs vendor* | *verifikasi dari docs vendor* |
| Mengedit/membuat file | ya (+ `/undo`) | ya (review diff) | ya (review di Chat/Agents window) | ya | *verifikasi dari docs vendor* | *verifikasi dari docs vendor* |
| Mode plan-before-execute | ya (Tab plan mode) | ya (plan mode) | ya (peran Plan) | mulai konservatif, konfirmasi batch | *verifikasi dari docs vendor* | *verifikasi dari docs vendor* |
| Memori/instruksi proyek | AGENTS.md dibaca otomatis | CLAUDE.md dibaca otomatis | custom instructions / prompt files | *verifikasi dari docs vendor* | *verifikasi dari docs vendor* | *verifikasi dari docs vendor* |
| Proses lama/background | *verifikasi dari docs vendor* | ya (background agents) | ya (Agents window / cloud) | *verifikasi dari docs vendor* | *verifikasi dari docs vendor* | *verifikasi dari docs vendor* |
| Menghentikan proses liar | Esc / stop | Esc menghentikan | tombol stop | *verifikasi dari docs vendor* | *verifikasi dari docs vendor* | *verifikasi dari docs vendor* |

Aturan memakai tabel ini tanpa bias: jangan pernah klaim satu tool "terbaik"; bila sel
belum terverifikasi, katakan di rencana; bila tool pengguna kekurangan kapabilitas
(mis. tanpa terminal), AI harus menyesuaikan track (mis. cetak perintah persis untuk
dijalankan manusia) alih-alih gagal.

## Lampiran B — troubleshooting (error nyata, perbaikan nyata)

Saat gate gagal, tempel seluruh output JSON kembali ke AI dengan: "Gate failed.
Diagnose from the errors array only, propose exactly one fix, wait for approval."
Penyebab umum:

| Gejala | Kemungkinan penyebab | Prompt perbaikan |
|---|---|---|
| `result UNVERIFIED`, errors berisi `dns_mismatch` | Record TXT hilang/salah, atau menunjuk kunci lama | "Show me the live TXT vs the manifest key fingerprint, then print the corrected record — do not apply DNS changes yourself." |
| `schema_violation` | manifest diedit tangan atau scaffold basi | "Regenerate via init/site build instead of hand-editing, re-sign, re-validate." |
| `bad_signature` | manifest diubah setelah signing, atau kunci salah | "Re-run sign with the key matching identity.public_key, then validate." |
| `upgrade_required` | manifest v0.1 padahal dipakai fitur v0.2 (mis. rotasi) | "Re-issue the manifest as v0.2 and re-sign." |
| `rotation_denied` / `key_revoked` | overlap basi atau kunci yang dipakai sudah dicabut | "Follow docs/rotation.md: complete the cutover or publish the new key, then re-validate." |
| HTTP 403/429 di edge gaya strict | crawler training diblokir / di-rate-limit sesuai desain | "Confirm the UA and Accept headers: compliant clients must negotiate markdown; this is enforcement working, not an error." |
| `revocation_unavailable` / cek dilewati | `--revocation-url` tidak diberikan atau registry tak terjangkau | "Re-run with --revocation-url and --governance-key; if unreachable, retry and report." |
| Exit code 2 | error penggunaan (flag/path salah) | "Reprint the exact command from bin/cli.js --help and fix the invocation." |

## Tautan

- Sisi konsumen: [`agent-quickstart.md`](agent-quickstart.md)
- Referensi perintah: [`REFERENCE.md`](REFERENCE.md)
- Runbook rotasi: [`rotation.md`](rotation.md)
- Deploy + DNS: [`deploy-site.md`](deploy-site.md)
- Adapter platform: [`../integrations/README.md`](../integrations/README.md)
- WordPress: [`../wp-plugin/README.md`](../wp-plugin/README.md)
- Spec: [`../spec/en/`](../spec/en/) (kanonik; cermin `../spec/id/`, `../spec/zh/`)
