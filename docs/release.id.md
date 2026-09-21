# Checklist rilis dan upgrade

<p><a href="release.md">English</a> · <a href="release.id.md">Bahasa Indonesia</a> · <a href="release.zh.md">中文</a></p>

Satu halaman untuk memotong rilis, menerbitkan SDK, men-deploy situs, dan menjaga konsumen
tetap sinkron. Buat tetap membosankan: naikkan versi dalam satu perubahan, buktikan dengan
`npm run check:consistency`, gerbang dengan `npm run verify`.

## Lokasi versi (naikkan bersamaan)

| File | Yang diubah |
|---|---|
| `package.json` | `version` (nomor rilis, mis. `1.0.0-draft` → `1.0.0`) |
| `packages/aifeed-verify/package.json` | `version` (inti sama; sufiks prerelease diizinkan, mis. `1.0.0-draft.2`) |
| `wp-plugin/aifeed.php` | header `Version:` dan `define('AIFEED_VERSION', …)` |
| `wp-plugin/readme.txt` | `Stable tag:` (+ entri changelog) |
| `site/index.html` | chip footer `v<version>` |
| `CHANGELOG.md` | bagian teratas baru `## [<version>] — YYYY-MM-DD` |
| `SECURITY.md` | baris versi yang didukung bila lini rilis berubah |

Versi wire independen: manifest `0.1`/`0.2`, AIFeed Markdown `1.0`, MAKO `0.2`.
Jangan menomori ulang kecuali format wire benar-benar berubah.

## Langkah

```bash
npm run verify            # harus hijau sebelum apa pun
# naikkan file di atas + tulis entri changelog
npm run check:consistency # membuktikan versi selaras
npm run verify            # lagi, setelah kenaikan
git add -A && git commit -m "release: <version>"
git tag -a v<version> -m "AIFeed <version>"
git push origin main --tags
```

Deployment: `.github/workflows/pages-cf.yml` membangun ulang `site/` (laporan, landing
page, origin demo) pada setiap push ke `main` dan men-deploy-nya bersama `functions/` ke
Cloudflare Pages, yang melayani `aifeed.md`, `www.aifeed.md`, dan tujuh subdomain demo.
Workflow ini membutuhkan secret repositori `CLOUDFLARE_API_TOKEN` dan
`CLOUDFLARE_ACCOUNT_ID`; tanpa keduanya ia dilewati. Padanan lokal:
`npx wrangler@latest pages deploy site --project-name aifeed --branch main`. Periksa
halaman live setelahnya; anchor DNS untuk demo tercantum di `docs/demos.md`.

## Menerbitkan SDK

```bash
# non-interaktif: token granular dengan "Bypass 2FA" (atau token Classic Automation)
cd packages/aifeed-verify
npm publish --access public --tag next --//registry.npmjs.org/:_authToken=$NPM_TOKEN
npm dist-tag add @aifeed/verify@<version> latest --//registry.npmjs.org/:_authToken=$NPM_TOKEN
```

- Versi prerelease **mewajibkan** `--tag` eksplisit (`next`); versi stabil default ke
  `latest`.
- Registry npm memproses publikasi secara asinkron (HTTP `202`) dan meng-cache pembacaan
  selama beberapa menit. Verifikasi lewat endpoint write:
  `curl -s "https://registry.npmjs.org/@aifeed%2Fverify?write=true" | node -e "…"`
  atau `npm view @aifeed/verify version dist-tags`.
- Jangan pernah menempelkan token ke file, commit, atau issue; simpan di environment.

## Menerbitkan MCP server

Alur yang sama seperti SDK, setelah membangun ulang salinan hasil generate dari root repo:

```bash
npm run build:mcp
cd packages/aifeed-mcp-server
npm publish --access public --tag next --//registry.npmjs.org/:_authToken=$NPM_TOKEN
```

- Daftar `files` mengirim `index.js`, `README.md`, `lib/`, `schema/`, dan `LICENSE` tanpa
  dependensi. Versi prerelease mewajibkan `--tag next`.

## Menerbitkan paket Python

Verifier independen dikirim dari `clients/python/` sebagai distribusi PyPI `aifeed`
(paket impor `aifeed/`; hanya stdlib). Versinya mencerminkan inti rilis sebagai
pra-rilis PEP 440 (`1.0.0a1` untuk `1.0.0-draft`), dan `check-consistency` menjaga
pasangannya:

```bash
cd clients/python
python -m build
python -m twine upload dist/* -u __token__ -p "$PYPI_TOKEN" --non-interactive
```

- `pip install aifeed` memasang pra-rilis selama belum ada versi stabil; dokumentasikan
  `pip install --pre aifeed` bila ragu. Verifikasi lewat
  `https://pypi.org/pypi/aifeed/json` setelah unggah.
- Wheel mengirim `aifeed/` plus modul alias `aifeed_verify`/`aifeed_mako` dan skrip
  konsol `aifeed-verify`/`aifeed-mako`.

## Menerbitkan plugin framework

`@aifeed/frameworks` membundel mesin builder (salinan hasil generate) dengan plugin Vite,
Astro, dan Next.js plus bin `aifeed-build`/`aifeed-next`:

```bash
npm run build:fw && npm run fw:check
cd packages/aifeed-frameworks
npm publish --access public --tag next --//registry.npmjs.org/:_authToken=$NPM_TOKEN
```

- Versi prerelease mewajibkan `--tag next`; verifikasi dengan
  `npm view @aifeed/frameworks version dist-tags`.
- `check-consistency` menegakkan nol dependensi dan inti versi untuk paket ini (dan MCP
  server).

## Menerbitkan CLI

`aifeed` membundel CLI penerbit (`bin/`, `lib/`, `schema/` sebagai salinan hasil generate):

```bash
npm run build:cli && npm run cli:check
cd packages/aifeed-cli
npm publish --access public --tag next --//registry.npmjs.org/:_authToken=$NPM_TOKEN
```

- Publikasi pertama juga menetapkan `latest`, jadi `npx aifeed` langsung berfungsi;
  verifikasi dengan `npm view aifeed version dist-tags`.
- Setelah terbit, perkuat kepemilikan: `npm owner add <akun-kedua> aifeed`, atau transfer
  paket ke org npm `@aifeed` dari halaman paket.

## Plugin WordPress

Plugin dikirim dari `wp-plugin/` di repositori ini. Untuk rilis WordPress.org, naikkan
header/`Stable tag`, tambahkan bagian changelog di `readme.txt`, jalankan suite PHP
(`php -l`, `php tests/jcs-test.php`, `php tests/mako-test.php`), lalu tag.

## Paper (saat rilis mengubah klaim)

1. Edit `paper/main.tex`, cerminkan prosa di `paper/main.md`.
2. Bila abstrak berubah, perbarui `paper/ARXIV-SUBMISSION.md`.
3. `npm run paper:check`; bangun ulang PDF (Tectonic) dan bundel arXiv:
   `cd paper && tar -czf aifeed-arxiv.tar.gz main.tex refs.bib 00README.json`.
4. Ikuti `paper/CHECKLIST.md` sebelum mengirim versi arXiv baru.

## Meng-upgrade konsumen

- Verifikasi manifest menerima `0.1.x` dan `0.2.x`; versi lain melaporkan
  `upgrade_required`. Pertahankan dukungan baca lama saat versi wire bergerak.
- Setelah rilis SDK, uji asap paket terbit di folder scratch:
  `npm install @aifeed/verify@<version>` lalu jalankan quickstart dari
  `packages/aifeed-verify/README.md`.
- Situs adalah artefak yang dikutip konsumen: pastikan chip versi baru dan changelog live
  sebelum mengumumkan.
