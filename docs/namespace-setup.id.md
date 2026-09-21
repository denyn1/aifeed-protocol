# Setup namespace (GitHub, npm, domain)

<p><a href="namespace-setup.md">English</a> · <a href="namespace-setup.id.md">Bahasa Indonesia</a> · <a href="namespace-setup.zh.md">中文</a></p>

Jalankan checklist ini sekali, lalu catat hasilnya di `paper/CHECKLIST.md`.

## 1. Repositori GitHub — kanonik `denyn1/aifeed-protocol`

Status (2026-09-21): organisasi `aifeed` **belum** dibuat; repositori kanonik adalah
<https://github.com/denyn1/aifeed-protocol>. Semua paket terbit, situs web, dan paper sudah
menaut ke sana. Membuat org nanti bersifat opsional — setelah transfer, GitHub
me-redirect URL lama, tetapi `package.json`, dokumen ini, dan catatan rilis harus
diperbarui.

1. (Opsional, masa depan) Buat organisasi <https://github.com/organizations/plan> →
   **Free**; nama `aifeed` (dicek bebas 2026-09-15: `users/aifeed` dan `orgs/aifeed`
   mengembalikan 404). Aktifkan 2FA untuk semua anggota dan tambahkan minimal satu metode
   pemulihan.
2. Pengaturan repositori (saat ini):
   - Branch default `main`, squash-merge diizinkan, hapus branch saat merge.
   - Proteksi branch: wajib pull request + CI lulus sebelum merge.
   - Keamanan: aktifkan pelaporan kerentanan privat (selaras `SECURITY.md`).
   - Plugin dikirim di monorepo ini di bawah `wp-plugin/`; repositori plugin terpisah
     bersifat opsional.
3. (Opsional, masa depan) Marketplace Action (`aifeed/sign@v1`) membutuhkan repositori
   action publik, paling natural di bawah org. Sementara ini gunakan template CI
   [`../integrations/github-action/aifeed.yml`](../integrations/github-action/aifeed.yml).
4. Arahkan repositori lokal ke remote kanonik:

   ```bash
   cd D:\Software\aifeed.org
   git remote -v                                    # harap origin → denyn1/aifeed-protocol
   git remote set-url origin https://github.com/denyn1/aifeed-protocol.git
   git push -u origin main
   ```

   (Abaikan nama folder lokal `aifeed.org`; menggantinya menjadi `aifeed.md` opsional dan
   tidak memengaruhi apa pun yang dilacak git.)

## 2. Scope npm — `@aifeed` (**terbit 2026-09-16**)

1. Buat akun npm (atau pakai yang ada) dan aktifkan 2FA. ✅ akun `denynorman`.
2. Buat scope organisasi: situs npm → **Organizations** → **Create organization** →
   nama `aifeed`, paket **Free (unlimited public packages)**. ✅
3. Terbitkan saat siap:

   ```bash
   cd packages/aifeed-verify
   npm publish --access public
   ```

   `packages/aifeed-verify/package.json` sudah mendeklarasikan
   `"publishConfig": { "access": "public" }`, `files`, `exports`, dan metadata
   `repository`/`homepage`/`bugs`.

   **Terbit:** `@aifeed/verify@1.0.0-draft` pada 2026-09-16, lalu diperbarui ke
   **`1.0.0-draft.1`** di hari yang sama (penerusan opsi TLS/private-fetch); dist-tag
   `latest` dan `next` sama-sama menunjuk versi terbaru. Verifikasi dengan
   `npm view @aifeed/verify version dist-tags`; halaman registry:
   <https://www.npmjs.com/package/@aifeed/verify>.
4. Tambahkan scope ke `package.json` paket protokol bila nanti ingin diterbitkan sebagai
   `@aifeed/protocol` (saat ini `"private": true` dengan sengaja).

   Catatan: token publish adalah secret — gunakan token granular dengan *Bypass 2FA*
   (atau token Classic **Automation**) untuk publish non-interaktif, simpan lokal, dan
   jangan pernah menempelkannya ke chat atau issue; regenerasi kode pemulihan 2FA bila
   pernah terekspos.

## 3. Domain kanonik — hasil riset (2026-09-15) dan rekomendasi

`aifeed.org` dimiliki organisasi tak terkait ("AI-FEED", badan amal pangan) dan tidak boleh
dipakai untuk URL normatif — itulah sebabnya migrasi URL ke `aifeed.md` wajib. Riset
registrasi (RDAP + cek silang NS DNS, 2026-09-15):

| Domain | Status | Catatan |
|---|---|---|
| `aifeed.org` | terpakai | badan amal AI-FEED (AS) — alasan migrasi wajib |
| `aifeed.com` | terpakai | parking Afternic (kemungkinan dijual) |
| `aifeed.dev` | terpakai | situs AI news feed |
| `aifeed.app` | terpakai | "AiFeed — Your AI News Feed" |
| `aifeed.net` | terpakai | ter-resolve (error TLS) |
| `aifeed.io` | terpakai | parking Afternic; false-negative bootstrap RDAP |
| `aifeed.co` | terpakai | parking GoDaddy |
| `aifeed.eu`, `.news`, `.site`, `.space`, `.info` | terpakai | parked/aktif |
| **`aifeed.md`** | **dibeli 2026-09-16** | domain kanonik; 9 karakter; dibaca "AIFeed Markdown" |
| **`aifeedprotocol.org`** | **kemungkinan bebas** | RDAP 404 + tanpa NS; `.org` netral-standar (cf. `rslstandard.org`) |
| **`aifeed.id`** | **kemungkinan bebas** | RDAP 404 + tanpa NS; TLD Indonesia, daya ungkit lokal |
| `aifeed.tech`, `.tools`, `.software`, `.blog`, `.pro`, `.us`, `.website`, `.network`, `.systems`, `.zone`, `.chat` | kemungkinan bebas | brand lebih lemah |

### Keputusan dan status

**Domain kanonik: `aifeed.md` — dibeli maintainer, 2026-09-16.** DNS masih kosong pada
2026-09-16 (tanpa record NS/A/TXT); konfigurasikan sebelum pemakaian publik atau submission.
Migrasi URL dieksekusi 2026-09-15 untuk segera menghapus referensi `aifeed.org` pihak ketiga:

```bash
node tools/replace-domain.js --domain aifeed.md          # dry-run (mendaftar kemunculan)
node tools/replace-domain.js --domain aifeed.md --apply  # dieksekusi 2026-09-15
```

Hasil: 168 kemunculan biasa + 4 ter-escape diganti di 91 file; fixture bertanda tangan,
vektor manifest, dan fixture lintas bahasa JCS diregenerasi; regresi penuh lulus
(JS 195/195, Python 44/44, vektor 25+39+11, SDK sinkron, E2E WordPress).

### Record DNS

Nameserver domain adalah Cloudflare (`etienne.ns.cloudflare.com`,
`leia.ns.cloudflare.com`), dan **Cloudflare Pages adalah jalur hosting**: `aifeed.md`
(plus `www` dan tujuh subdomain demo) adalah custom domain project Pages, dengan DNS dan
TLS dikelola Cloudflare. Langkah deploy ada di `docs/deploy-site.md`.

Item manual tersisa:

1. **Email** — `contact@aifeed.md` dirutekan via Cloudflare Email Routing; jaga
   `paper/main.tex` / `paper/main.md` dan `SECURITY.md` tetap sinkron bila berubah.
2. **Anchor TXT `_aifeed`** — sudah diterbitkan untuk apex dan tujuh origin demo
   (AIFeed v0.1 §6); record-nya tercantum di `docs/demos.md`.

`aifeedprotocol.org` / `aifeed.id` tetap alias opsional (redirect) bila nanti diinginkan.
