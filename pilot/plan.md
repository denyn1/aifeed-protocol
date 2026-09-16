# Pilot AIFeed 30 Hari — Protokol

Status: **siap dijalankan** (belum ada situs pilot). Semua tooling tersedia; begitu ada
situs nyata + akses log, fase eksekusi tinggal dimulai.

## Tujuan

Mengukur dampak nyata AIFeed pada dua sisi — pemilik web (bandwidth, CPU, penegakan)
dan sisi AI (byte, fetch sia-sia, verifikasi) — di luar simulasi harness.

## Peran

| Peran | Tanggung jawab |
|---|---|
| Operator situs | Akses log, pemasangan plugin, aturan edge (nginx/Caddy/Cloudflare) |
| Analis | Menjalankan `tools/pilot-report.js`, menyusun laporan mingguan |
| (Opsional) Mitra AI | Klien AIFeed-aware eksternal; jika absen, pakai crawler referensi SDK |

## Linimasa

| Hari | Aktivitas | Output |
|---|---|---|
| H-7…H-1 | Baseline: log penuh tanpa penegakan, klasifikasi bot, salinan manifest+keys | `baseline.jsonl` + angka awal |
| H0 | Aktifkan plugin + aturan edge (lihat `benchmarks/edge/`), verifikasi manifest & MAKO | checklist aktivasi |
| H1–H7 | Minggu 1: pantau blokir/limit, false positive, error | laporan mingguan 1 |
| H8–H14 | Minggu 2: stabilkan limit; mulai catat delta/MAKO | laporan mingguan 2 |
| H15–H21 | Minggu 3: evaluasi trafik rujukan, keluhan pengguna (target: nol) | laporan mingguan 3 |
| H22–H28 | Minggu 4: audit verifikasi tanda tangan + insiden | laporan mingguan 4 |
| H29–H30 | Analisis akhir vs kriteria | `pilot-report.md` + keputusan lanjut |

## Kriteria lulus (verdict otomatis di `tools/pilot-report.js`)

1. Byte AI (egress ke bot AI) turun **≥40%** vs baseline.
2. p95 latency manusia tidak memburuk **>20%**.
3. Error rate manusia tidak naik **>0,5 poin persen**.
4. Verifikasi tanda tangan **0 gagal** pada request MAKO.
5. Insiden blokir keliru terhadap crawler sah = 0 (diperiksa manual).

## Etika & privasi

- Hanya situs milik operator; tidak ada intervensi ke pihak ketiga.
- Log diagregasi dan dianonimkan (IP dipotong), retensi maksimum 30 hari, lihat
  `instrumentation.md`.
- Tidak memblokir crawler mesin pencari; klasifikasi dibatasi ke kelas AI yang
  dinyatakan di manifest.
- Hasil diterbitkan sebagai studi kasus + metodologi, bukan klaim statistik.

## Cara menjalankan

```bash
# 1. Siapkan log JSONL (lihat instrumentation.md)
# 2. Bandingkan baseline vs pilot
node tools/pilot-report.js --baseline pilot/baseline.jsonl --pilot pilot/pilot.jsonl --out pilot/laporan-30-hari.md
# 3. Sertakan laporan mingguan (templates/weekly-report.md) sebagai lampiran
```

## Risiko yang dipantau

| Risiko | Sinyal | Tindakan |
|---|---|---|
| Blokir keliru | 403 ke crawler sah | longgarkan klasifikasi, ulangi |
| Kenaikan 429 ke mitra | 429 pada UA patuh | periksa limit manifest vs kebijakan edge |
| Stealth crawling | trafik AI dari UA anonim naik | andalkan perilaku (rate/path), bukan UA |
| Latensi naik | p95 manusia memburuk | turunkan beban limit/CPU edge |
