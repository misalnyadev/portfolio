Tes regresi AK Talent
=====================
Menjalankan 24 pengecekan otomatis: semua halaman terbuka tanpa error, Overview (kalender, papan,
performa, trend, biaya), Asset, Portfolio vertikal/horizontal, halaman publik, Paket Posting, dan alur
rencana ke Studio. AI dan provider diganti jawaban tiruan, jadi tidak memakai key dan tidak berbiaya.

Cara pakai (sekali pasang):
  1. npm i playwright
  2. npx playwright install chromium
  3. dari folder ak-studio:  node tests/regression.js

Hasil: daftar "ok" atau "GAGAL" per pengecekan, lalu ringkasan. Kode keluar 1 kalau ada yang gagal.
Jalankan setiap selesai mengubah index.html. Tambah pengecekan baru dengan fungsi t('nama', async()=>{...}).
Data uji hanya di browser sementara milik tes, tidak menyentuh data aplikasimu.
