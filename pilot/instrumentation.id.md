# Instrumentasi Pilot — Skema Log & Privasi

<p><a href="instrumentation.md">English</a> · <a href="instrumentation.id.md">Bahasa Indonesia</a> · <a href="instrumentation.zh.md">中文</a></p>

`tools/pilot-report.js` membaca **JSONL** (satu JSON per baris). Satu baris = satu
request yang sudah dinormalisasi.

## Skema

| Field | Tipe | Wajib | Keterangan |
|---|---|---|---|
| `ts` | string | ya | waktu ISO 8601 (UTC) |
| `host` | string | ya | domain/tenant |
| `path` | string | ya | path request (tanpa query) |
| `profile` | enum | ya | `human`, `search`, `training`, `plain`, `ai_other`, `compliant` |
| `status` | integer | ya | kode HTTP (403/429/200/5xx) |
| `bytes` | integer | ya | byte body respons |
| `ms` | number | tidak | durasi request (p95 manusia) |
| `mako` | boolean | tidak | `true` bila respons `text/mako+markdown` |
| `verified` | boolean/null | tidak | `true/false` bila klien memverifikasi tanda tangan; `null` bila tidak ada |

Contoh:

```jsonl
{"ts":"2026-10-01T08:00:01Z","host":"example.com","path":"/p/1","profile":"human","status":200,"bytes":41230,"ms":84}
{"ts":"2026-10-01T08:00:02Z","host":"example.com","path":"/p/1","profile":"training","status":403,"bytes":30,"ms":3}
{"ts":"2026-10-01T08:00:03Z","host":"example.com","path":"/p/2","profile":"compliant","status":200,"bytes":5820,"ms":12,"mako":true,"verified":true}
```

## Cara mengumpulkan

### nginx (log akses JSON)

```nginx
log_format aifeed_json escape=json
  '{"ts":"$time_iso8601","host":"$host","path":"$uri","profile":"$aifeed_profile",'
  '"status":$status,"bytes":$body_bytes_sent,"ms":$request_time}';
access_log /var/log/nginx/aifeed.jsonl aifeed_json;
```

`$aifeed_profile` berasal dari map klasifikasi pada `benchmarks/edge/nginx.conf.template`.
Tambahkan `"mako":$mako_served` bila Anda punya penanda (mis. via map Accept), dan
`"verified"` hanya bila edge benar-benar memverifikasi tanda tangan.

### WordPress + harness

- Plugin AIFeed menyajikan MAKO; tandai `mako` saat `Accept: text/mako+markdown`.
- `verified` dapat diisi oleh crawler referensi (SDK `@aifeed/verify`) yang menulis log
  terpisah lalu digabung.
- Untuk baseline, jalankan tanpa aturan edge; untuk pilot, aktifkan aturan edge.

### Klasifikasi bot

Prioritas: (1) signature/UA yang dikenal, (2) perilaku (rate, concurrency, pola path),
(3) fallback `ai_other`. UA dapat dipalsukan — dokumentasikan asumsi di laporan.

## Privasi

- **Anonimkan**: IP tidak masuk skema; bila perlu, simpan hash satu arah dengan rotasi
  harian dan jangan pernah publikasikan.
- **Agregasi**: laporan hanya memuat angka agregat per profil; tanpa path individual.
- **Retensi**: maksimum 30 hari, lalu hapus; simpan hanya laporan agregat.
- **Kepatuhan**: sesuaikan dengan kebijakan privasi situs dan hukum setempat.

## Memproses

```bash
node tools/pilot-report.js --baseline pilot/baseline.jsonl --pilot pilot/pilot.jsonl --out pilot/laporan-30-hari.md
```

Output memuat tabel penghematan dua sisi (pemilik web & AI), penegakan (403/429),
verifikasi tanda tangan, metrik manusia (p95, error rate), dan verdict otomatis dengan
ambang target pilot.

## Batas jujur

- Angka AI dari sisi penerbit (log) adalah **terukur**; penghematan sisi AI per-request
  dari perbandingan byte MAKO/HTML adalah **estimasi** (label tercantum).
- CPU origin di laporan adalah **model** (mean latency × request), bukan pengukuran
  langsung CPU.
- Log tidak bisa membuktikan tujuan bot (training vs retrieval); klasifikasi adalah
  aproksimasi yang harus dinyatakan terbuka.
