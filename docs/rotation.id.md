# Runbook rotasi kunci

<p><a href="rotation.md">English</a> · <a href="rotation.id.md">Bahasa Indonesia</a> · <a href="rotation.zh.md">中文</a></p>

Manifest AIFeed dapat mengganti kunci penanda tangannya tanpa merusak verifikasi, memakai
direktif `rotation` (spec: [`spec/en/aifeed-v0.2.md`](../spec/en/aifeed-v0.2.md) §14).
Runbook ini mencakup upacara normal, jalur darurat, dan apa yang dilihat klien.

## Sebelum mulai

- Manifest harus `version: "0.2"`. Manifest v0.1 berotasi dengan menandatangani ulang
  sebagai v0.2 terlebih dahulu (`aifeed sign`).
- Anda mengendalikan record DNS `_aifeed` untuk domain tersebut.
- Revokasi permanen kunci lama membutuhkan tanda tangan governance (SLA registry);
  pastikan di muka atau pra-otorisasi kunci darurat offline.

## Rotasi normal (dua perintah)

1. Hasilkan penerus dan terbitkan keadaan overlap:

   ```bash
   aifeed rotate --dir ./my-site --window 72
   ```

   Perintah ini menulis manifest overlap (ditandatangani kunci LAMA, membawa
   `rotation.successor_fp`, `effective_at`, `grace_until`), menyimpan kunci penerus sebagai
   `aifeed-private.next.pem`, dan mencetak record DNS:

   ```
   _aifeed.example.com TXT "v=aifeed1; pk=<old>; pk2=<new>; effective_at=<ts>; manifest=https://example.com/.well-known/ai.json"
   ```

   `pk2` adalah cross-check advisory, bukan keharusan: bila hilang atau salah, verifier
   memberi peringatan (`rotation_anchor_unverified`) tetapi tetap memakai direktif bertanda
   tangan sebagai anchor. Menerbitkannya tetap dianjurkan.

2. Terbitkan manifest overlap dan record DNS. Setelah `effective_at`:

   ```bash
   aifeed rotate --dir ./my-site
   ```

   Perintah ini menandatangani manifest cutover dengan kunci penerus (`identity.public_key`
   diperbarui, `rotation.predecessor_fp` mengikat kunci yang dipensiunkan) dan mencetak
   record DNS baru (`pk=<new>`, hapus `pk2`).

3. Terbitkan fingerprint lama ke registry revokasi (tanda tangan governance), lalu
   verifikasi dari luar:

   ```bash
   aifeed validate example.com
   ```

## Rotasi darurat (dugaan kebocoran kunci)

JANGAN cabut dulu — revokasi instan membuka outage. Padatkan overlap dan segera cutover:

```bash
aifeed rotate --dir ./my-site --accelerated   # lead 1 jam, jendela 6 jam
# setelah effective_at:
aifeed rotate --dir ./my-site
# lalu terbitkan fingerprint lama
```

Selama jendela yang dipadatkan, tanda tangan dari kunci yang mungkin bocor tetap diterima,
sesuai desain, paling lama sepanjang jendela. Rotasi melindungi kunci, bukan origin:
penyerang yang sudah menguasai konten dan DNS Anda di luar cakupan.

## Memeriksa keadaan tanpa mengubah apa pun

```bash
aifeed rotate --dir ./my-site --dry-run --json
```

Fase: `announced` (kunci lama sah penuh), `grace` (kunci lama sah dengan peringatan
`grace_accepted`), `complete` (penerus aktif; kunci lama ditolak).

## Apa yang dilihat klien

| Situasi | Hasil |
|---|---|
| Manifest overlap, di dalam grace | `VERIFIED`, peringatan `grace_accepted` |
| Manifest kunci lama basi setelah grace | `UNVERIFIED`, `rotation_denied` |
| Pin dorman bertemu pengikatan cutover | `VERIFIED`, peringatan `rotation_resync` |
| Kunci berubah tanpa pengumuman | `UNVERIFIED`, `rotation_denied` |
| Fingerprint kunci lama ada di registry | `UNVERIFIED`, `key_revoked` |
