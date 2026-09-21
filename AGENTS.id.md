# AGENTS.md — bekerja di repositori ini

<p><a href="AGENTS.md">English</a> · <a href="AGENTS.id.md">Bahasa Indonesia</a> · <a href="AGENTS.zh.md">中文</a></p>

Instruksi untuk agen coding AI (dan manusia) yang memelihara, memperbarui, atau meng-upgrade
AIFeed. Baca ini dulu; inilah kontrak yang menjaga repositori tetap reproducible.

## Repositori ini apa

Monorepo tanpa dependensi untuk **protokol AIFeed** (izin konten bertanda tangan untuk
agen AI): spesifikasi, JSON Schema, implementasi referensi (CLI + SDK JS + verifier
Python), 84 vektor konformansi, adapter server, plugin penerbit WordPress, benchmark,
situs web, dan paper.

## Aturan emas

1. **Jalankan `npm run verify` sebelum setiap commit.** Itu gerbang tunggalnya: cek
   sintaks, cek versi/konsistensi, suite JS + Python, semua cek vektor, sinkronisasi SDK,
   cek paper, dan build situs. Jangan commit saat merah.
2. **Jangan pernah mengedit file hasil generate dengan tangan.** Edit sumbernya, lalu
   regenerasi:

   | Artefak hasil generate | Sumber kebenaran | Regenerasi | Verifikasi |
   |---|---|---|---|
   | `packages/aifeed-verify/{lib,schema,index.js,index.d.ts}` | `lib/`, `schema/` (+ `index.js` SDK tulisan tangan) | `npm run build:sdk` | `npm run sdk:check` |
   | `packages/aifeed-mcp-server/{lib,schema}` | `lib/`, `schema/` (+ `index.js` MCP tulisan tangan) | `npm run build:mcp` | `npm run mcp:check` |
   | `packages/aifeed-frameworks/{lib,schema}` | `lib/`, `schema/` (+ `index.js` plugin, `vite.js`, `astro.js`, `next.js`, CLI tulisan tangan) | `npm run build:fw` | `npm run fw:check` |
   | `packages/aifeed-cli/{bin,lib,schema}` | `bin/`, `lib/`, `schema/` (+ `package.json`, README tulisan tangan) | `npm run build:cli` | `npm run cli:check` |
   | `conformance/vectors/**` (34) | `tools/gen-vectors.js` | `npm run vectors` | `npm run vectors:check` |
   | `conformance/mako/**` (39) | `tools/gen-mako-vectors.js` | `npm run mako:vectors` | `npm run mako:vectors:check` |
   | `conformance/aimd/**` (11) | `tools/gen-aimd-vectors.js` | `npm run aimd:vectors` | `npm run aimd:vectors:check` |
   | `docs/process.html`, `benchmarks/enforcement-report.html` | `tools/render-html.js` (+ `benchmarks/*.json`) | `npm run render:html` | `npm run verify` |
   | `site/{logo.svg,process.html,enforcement-report.html,penjelasan.html,studio.html,updates.html,feed.xml,badge.svg,aifeed-preprint.pdf}` | file root + `paper/` + `tools/render-html.js` (`updates.html` dari `CHANGELOG*.md`; `feed.xml` dari `CHANGELOG.md`; `badge.svg` dari `badge-aifeed.svg`) | `npm run render:html && npm run build:site` | `npm run verify` |
   | `site/demos/**`, apex `site/.well-known/**`, `site/revoke/**` | `demos/sites.js` + `demos/keys.js` + `tools/gen-demos.js` | `npm run demos` | `npm run demos:check` (di dalam `verify`) |
   | `tools/jcs-php-fixtures.json` | `tools/gen-jcs-php-fixtures.js` | `npm run jcs:fixtures` | plugin `tests/jcs-test.php` |
   | `paper/aifeed-arxiv.tar.gz` | `paper/main.tex`, `refs.bib`, `00README.json` | `tar -czf aifeed-arxiv.tar.gz main.tex refs.bib 00README.json` (di `paper/`) | untar + baca `00README.json` |

3. **Jangan pernah menambah dependensi runtime.** `dependencies` dan `devDependencies`
   tetap kosong di setiap `package.json`; `npm run check:consistency` menegakkannya.
   Tool hanya memakai pustaka standar Node. Kode Python hanya stdlib.
4. **Byte kanonik itu sakral.** Tanda tangan mencakup JSON kanonik-JCS dan byte file
   mentah. Jangan memformat ulang fixture, mengubah line ending, atau "merapikan"
   whitespace di dalam `conformance/`, `examples/`, atau file `site/.well-known` yang
   bertanda tangan. `.gitattributes` memaksa LF; jangan diubah.
5. **Spesifikasi kanonik dalam bahasa Inggris.** Setelah mengedit `spec/en/`, cerminkan
   bagian yang sama di `spec/id/` dan `spec/zh/` (terjemahan informasional). Jaga struktur
   heading tetap selaras.
6. **Satu sumber kebenaran per fakta.** Angka terukur hidup di `benchmarks/*.json` dan
   `paper/CLAIMS.md`; halaman dan paper merender dari sana, jangan mengarang angka.
7. **Label bukti wajib** untuk klaim faktual ([F] fakta, [M] masuk akal, [E] model/
   estimasi, [S] simulasi terukur, [H] review hukum). Lihat `paper/CLAIMS.md`.
8. **Versi:** nomor rilis hidup di `package.json`, `packages/aifeed-verify/package.json`,
   `wp-plugin/aifeed.php` (header + `AIFEED_VERSION`), `wp-plugin/readme.txt` (Stable
   tag), `site/index.html` (chip), dan bagian teratas `CHANGELOG.md`. Paket Python
   mencerminkan inti yang sama sebagai pra-rilis PEP 440 (`clients/python/pyproject.toml`
   dan `clients/python/aifeed/__init__.py`: `1.0.0a1` untuk inti `1.0.0`). Inti versi paket
   (`aifeed-verify`, `aifeed-mcp-server`, `@aifeed/frameworks`, `aifeed`) harus sama dengan inti
   rilis; `check-consistency` membuktikannya. Naikkan semuanya
   dalam satu perubahan; `npm run check:consistency` membuktikannya. Versi wire (manifest
   `0.1`/`0.2`, AIFeed Markdown `1.0`, MAKO `0.2`) independen — jangan menomori ulang
   dengan sembarangan. Langkah rilis: `docs/release.md`.

## Perintah

```bash
npm run verify            # semuanya di bawah, satu gerbang
npm run lint:syntax       # cek parse setiap file .js
npm run check:consistency # versi, deps, secret, pasangan spec, target skrip
npm test                  # suite Node (275 tes)
npm run test:py           # verifier Python independen (56 tes)
npm run bench:mako        # regenerasi benchmarks/mako-*.json + laporan
npm run bench:enforcement # regenerasi benchmarks/enforcement-*.json|md
npm run fuzz:mako -- --iterations 3000   # fuzzing parser (seed tetap)
npm run demos             # generate origin demo live + artefak apex
npm run demos:check       # generate, lalu verifikasi setiap manifest/revokasi demo
npm run verify:live       # konformansi live ke demo terdeploy (jaringan)
npm run studio            # aplikasi publisher lokal di http://127.0.0.1:7777 (UI zero-dep)
node bin/cli.js --help    # permukaan CLI
```

## Peta repositori

| Path | Memiliki |
|---|---|
| `spec/{en,id,zh}/` | Spesifikasi normatif (manifest v0.1/v0.2, AIFeed Markdown v1.0) |
| `schema/` | JSON Schema yang dipakai validator dan SDK |
| `lib/` | Implementasi referensi: parser ketat, JCS, Ed25519, validasi, MAKO/AIMD, indeks delta, bundel, revokasi |
| `bin/cli.js` | Entri CLI (`keygen`, `sign`, `rotate`, `validate`, `bundle`, `aimd\|mako …`, `site build`) |
| `packages/aifeed-verify/` | SDK terbit (`@aifeed/verify`); `index.js`/`index.d.ts` tulisan tangan, `lib/`+`schema/` salinan hasil generate |
| `packages/aifeed-mcp-server/` | Server MCP terbit (`aifeed-mcp-server`); `index.js` tulisan tangan, `lib/`+`schema/` salinan hasil generate |
| `packages/aifeed-frameworks/` | Plugin build terbit (`@aifeed/frameworks`): Vite/Astro/Next.js + `aifeed-build`/`aifeed-next`; `lib/`+`schema/` salinan hasil generate |
| `packages/aifeed-cli/` | CLI terbit (`aifeed`): keygen/init/sign/validate/rotate/bundle/site build; `bin/`+`lib/`+`schema/` salinan hasil generate |
| `clients/python/` | Verifier independen + tes (konformansi diferensial); terbit di PyPI sebagai `aifeed` (paket `aifeed/`, hanya stdlib) |
| `conformance/` | Vektor: 34 manifest, 39 MAKO, 11 AIFeed Markdown, revokasi + bundel |
| `integrations/` | Adapter penerbit: nginx, Caddy, Apache, Node, Next.js, PHP, Python ASGI, Go, Rust/Axum, GitHub Action |
| `skills/` | Skill agen (`aifeed/SKILL.md`): alur verify/publish untuk coding agent |
| `examples/` | Fixture manifest bertanda tangan per kategori situs + loader framework Python siap salin |
| `wp-plugin/` | Plugin penerbit WordPress (PHP; punya `tests/` sendiri) |
| `tools/` | Generator, renderer, benchmark, fuzzer, pemeriksa — zero-dep |
| `demos/` | Konten origin demo (`sites.js`) dan kunci demo publik (`keys.js`) |
| `functions/` | Cloudflare Pages Function: routing host, CORS, enforcement `strict` |
| `docs/` | `architecture.md`, `release.md`, `agent-quickstart.md`, `rotation.md`, `deploy-site.md`, `namespace-setup.md` |
| `studio/` | Aplikasi publisher lokal: workspace proyek, editor kebijakan (restrict-only), build/verifikasi/ekspor incremental, UI tiga bahasa |
| `site/` | Sumber situs: `index.html` (tulisan tangan); file lain hasil generate |
| `paper/` | Preprint: `main.tex` (sumber), `main.md` (cermin), `refs.bib`, `CLAIMS.md`, `CHECKLIST.md`, bundel |
| `.github/workflows/pages-cf.yml` | CI: `render-html` → `build-site` → deploy Cloudflare Pages (dilewati tanpa secret CF) |

## Resep umum

- **Menambah vektor konformansi:** edit generator terkait di `tools/`, jalankan skrip
  `…:vectors`-nya, pastikan `…:vectors:check` dan suite JS/Python tetap hijau. Generator
  menimpa seluruh direktori secara deterministik — jangan menambal file hasil generate
  dengan tangan. Untuk perubahan konten AIMD/MAKO, tanda tangan diregenerasi otomatis dari
  kunci tertanam di generator.
- **Mengubah aturan validasi:** `lib/validate.js` + `schema/*.json` + kedua verifier
  (`clients/python/`), lalu vektor. Paritas lintas bahasa adalah tes penerimaannya.
- **Menambah perintah CLI:** `bin/cli.js` (+ teks help), tes di `tests/cli*.test.js`, dan
  satu baris di `REFERENCE.md`/`README.md` bila menghadap pengguna.
- **Menyentuh permukaan SDK:** file tulisan tangan adalah
  `packages/aifeed-verify/index.js` dan `index.d.ts`. Jangan pernah mengedit
  `packages/aifeed-verify/lib/*` (hasil generate). Jalankan
  `npm run build:sdk && npm run sdk:check`.
- **Mengubah situs web:** `site/index.html` dan `penjelasan-aifeed.html` root adalah
  sumber; `docs/process.html`/`benchmarks/enforcement-report.html`/`docs/studio.html`/
  `docs/updates.html` berasal dari `tools/render-html.js` (`updates.html` merender
  `CHANGELOG*.md`; `docs/feed.xml` juga; `site/badge.svg` menyalin `badge-aifeed.svg` root). Jalankan `npm run verify`. Tautan GitHub di situs harus memuat
  nama repositori: `https://github.com/denyn1/aifeed-protocol/...`.
- **Menambah atau mengubah origin demo:** edit `demos/sites.js` (halaman, override
  kebijakan via `permissions`, tema), jalankan `npm run demos:check`. Kunci penanda tangan
  deterministik dan sengaja publik (`demos/keys.js`, HANYA DEMO). Pages Function di
  `functions/` merutekan `<sub>.aifeed.md` ke `site/demos/<sub>/`; deployment dan anchor
  DNS didokumentasikan di `docs/demos.md` dan `docs/deploy-site.md`.
- **Mengubah paper:** `paper/main.tex` adalah sumbernya; cerminkan edit prosa di
  `paper/main.md`; perbarui abstrak `paper/ARXIV-SUBMISSION.md` bila abstrak berubah;
  `npm run paper:check`; bangun ulang bundel arXiv.
- **Terbitkan/upgrade:** ikuti `docs/release.md`.

## Jebakan (dipelajari dengan susah payah)

- Windows PowerShell: `grep`/`rg` mungkin rusak di sini — pakai `Select-String`/`git grep`;
  jangan pernah `cd` di dalam perintah bila ada opsi workdir.
- Artefak hasil generate di-`.gitignore` dengan sengaja; CI meregenerasinya. Bila skrip
  melaporkan "missing sources", jalankan generatornya dulu.
- `tools/build-site.js` gagal dengan berisik saat sumber hilang — itu disengaja;
  perbaiki build-nya, jangan dibungkam.
- `tools/replace-domain.js` menulis ulang URL di seluruh repo; `SKIP_FILES`-nya relatif
  terhadap repo (mis. `docs/namespace-setup.md`). Jalankan dry-run-nya dulu.
- Publikasi npm untuk versi prerelease membutuhkan `--tag` (mis. `--tag next`); registry
  npm butuh beberapa menit untuk menampilkan versi baru — verifikasi lewat
  `https://registry.npmjs.org/@aifeed%2Fverify?write=true`.
- GitHub membatasi pemeriksa tautan yang terlalu cepat (429); konfirmasi lewat GitHub API
  alih-alih mengulang dalam loop.
- Tutup penampil PDF sebelum memindahkan/menghapus file `paper/*.pdf` (kunci file Windows).

## Gaya

Ikuti kode yang ada: `require` CommonJS, indent 2 spasi, tanpa komentar kecuali logikanya
tidak jelas, tanpa dependensi, output deterministik, dan tes di sebelah perilaku yang
dilindunginya. Jaga file tetap kecil dan satu-tujuan; utamakan menambah skrip `tools/`
daripada framework.
