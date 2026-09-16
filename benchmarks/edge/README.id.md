# Template enforcement edge (nginx / Caddy)

<p><a href="README.md">English</a> · <a href="README.id.md">Bahasa Indonesia</a> · <a href="README.zh.md">中文</a></p>

Template paritas sisi produksi untuk kebijakan yang dijalankan
`tools/bench-enforcement.js`. Harness membuktikan logika kebijakan di loopback; file-file
ini memungkinkan Anda mereproduksinya di VPS dengan klien nyata.

## File

| File | Target |
|---|---|
| `nginx.conf.template` | nginx (tanpa modul tambahan; limit statis via map) |
| `Caddyfile.template` | Caddy (aturan 403 langsung jalan; rate limiting butuh `caddy-ratelimit`) |

Ganti `ORIGIN_HOST`/`ORIGIN_PORT` dengan upstream Anda, tinjau limitnya, lalu jalankan di
host staging sebelum produksi. Jangan pernah memblokir crawler mesin pencari: batasi
daftar klasifikasi ke kelas training/user-agent AI yang memang ingin Anda tolak.

## Pemetaan manifest ke edge

| Field manifest | nginx | Caddy |
|---|---|---|
| `permissions.usage.training: deny` | `map ... training -> 403` | matcher `@training` + `respond 403` |
| `limits.requests_per_minute` | `limit_req_zone ... rate=15r/m` | `rate_limit ... events 15, window 1m` |
| `limits.concurrent` | `limit_conn_zone` + `limit_conn 2` | `rate_limit ... events 2, window 1s` |
| Kecualikan manusia dan klien AIFeed-aware | key kosong untuk profil tersebut | limit terbatas matcher |
| `/.well-known/ai.json` dan `/.well-known/mako-index.json` selalu terbaca | map well-known menjaga key kosong | `@wellknown` ditangani lebih dulu |

`Retry-After: 2` menyertai respons `429`, sama dengan harness.

## Prosedur verifikasi

1. Jalankan harness lokal dan simpan angkanya sebagai referensi:
   ```bash
   cd aifeed-protocol
   npm run bench:enforcement
   ```
2. Deploy template ke VPS staging dengan origin nyata (plugin WordPress, situs statis,
   atau korpus harness di belakang file server).
3. Kirim bentuk klien yang sama dan bandingkan:
   ```bash
   # crawler training harus menerima 403
   curl -s -o /dev/null -w '%{http_code}\n' -A 'GPTBot/1.0' https://staging.example/p/1

   # crawler biasa harus menerima 429 setelah ambang, dengan Retry-After
   for i in $(seq 1 20); do
     curl -s -o /dev/null -D - -A 'CrawlerX/1.0' https://staging.example/p/1 | grep -E 'HTTP|Retry-After'
   done

   # klien patuh dan manusia tetap 200
   curl -s -o /dev/null -w '%{http_code}\n' -A 'AIFeedBot/0.3' https://staging.example/p/1
   curl -s -o /dev/null -w '%{http_code}\n' -A 'Mozilla/5.0' https://staging.example/p/1
   ```
4. Catat hasil dengan metrik yang sama seperti yang dilaporkan harness (request, byte,
   CPU, blocked, limited, p95 manusia) dan lampirkan ke kit pilot
   (`pilot/instrumentation.md`).

## Hasil yang diharapkan

- Crawler training: `403` pada konten, `200` pada `/.well-known/*` (mereka tetap boleh
  membaca deklarasi; manifest adalah kontrak publik).
- Crawler tidak patuh: `429` + `Retry-After` setelah limit, lalu pulih.
- Manusia dan `AIFeedBot`: tidak terpengaruh (`200`), p95 dalam variasi normal.
- Egress penerbit dan CPU origin turun kira-kira sejalan dengan angka S1–S3 harness
  (lihat `benchmarks/enforcement-report.md` untuk nilai simulasi terukur).

## Catatan

- Limit statis: saat manifest bertanda tangan berubah, perbarui dan reload konfigurasi
  edge. Kebijakan dinamis penuh per-manifest membutuhkan OpenResty/njs, plugin Caddy,
  atau middleware PDP AIFeed.
- CDN di depan (Cloudflare dll.) dapat menormalkan atau menghapus `User-Agent`;
  klasifikasikan berdasarkan perilaku (rate/concurrency/path) bila memungkinkan dan
  dokumentasikan fallback-nya.
- Template adalah titik awal, bukan konfigurasi WAF tersertifikasi; uji sebelum
  mengaktifkan pada trafik produksi.
