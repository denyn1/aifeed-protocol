# Men-deploy situs AIFeed di `aifeed.md`

<p><a href="deploy-site.md">English</a> · <a href="deploy-site.id.md">Bahasa Indonesia</a> · <a href="deploy-site.zh.md">中文</a></p>

Situs ini adalah bundel statis polos di `site/` — landing page, logo, animasi proses,
laporan enforcement, penjelasan Indonesia, dan origin demo hasil generate. Tanpa framework
build, tanpa dependensi runtime.

Status 2026-09-16: live di **Cloudflare Pages** (project `aifeed`). Apex `aifeed.md`,
`www.aifeed.md` (redirect), dan tujuh subdomain demo adalah custom domain project tersebut;
Cloudflare mengelola DNS dan TLS (`always_use_https` aktif). Alur GitHub Pages lama
(workflow + `site/CNAME`) sudah dihapus.

## Deploy lokal (dipakai untuk setiap perubahan)

```bash
npm run verify   # gerbang: membangun laporan + situs + demo dan memverifikasi semuanya
npx wrangler@latest pages deploy site --project-name aifeed --branch main --commit-dirty=true
```

`--branch main` wajib: tanpanya, deploy mendarat di alias preview alih-alih produksi.
`CLOUDFLARE_API_TOKEN` (dan `CLOUDFLARE_ACCOUNT_ID`) harus disetel di environment; jangan
pernah mengomitnya.

## Deploy CI (aktif saat secret tersedia)

`.github/workflows/pages-cf.yml` berjalan pada setiap push ke `main`: `render-html` →
`build-site` → `gen-demos --check` → `wrangler pages deploy`. Workflow ini melewati dirinya
sendiri sampai secret repositori `CLOUDFLARE_API_TOKEN` dan `CLOUDFLARE_ACCOUNT_ID`
ditambahkan (Settings → Secrets and variables → Actions).

## DNS

Semua record berada di Cloudflare (`etienne.ns.cloudflare.com`, `leia.ns.cloudflare.com`):

- `aifeed.md` dan `www.aifeed.md` → custom domain Cloudflare Pages (TLS otomatis).
- Subdomain `demo`, `news`, `shop`, `gov`, `strict`, `revoked`, `verify` → project Pages yang
  sama; `functions/[[path]].js` merutekan berdasarkan host.
- Record TXT `_aifeed.<domain>` meng-anchor kunci penanda tangan tiap manifest (AIFeed v0.1
  §6); anchor demo tercantum di `docs/demos.md`.

## Email

`contact@aifeed.md` dirutekan via Cloudflare Email Routing; jaga agar alamatnya sinkron
dengan `paper/main.tex`, `paper/main.md`, dan `SECURITY.md`.
