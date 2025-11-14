## Tujuan
- Menambahkan alur “Generate PDF” yang menggabungkan beberapa hasil LLM yang sudah disimpan menjadi dokumen PDD terstruktur.
- Output: satu file `PDD_<tanggal>.pdf` berisi ringkasan dan detail setiap use case yang di-assess.

## Sumber Data
- Lokal: `localStorage` key `usecase_assessments_v1` menyimpan array assessment (`public/index.html:56–57, 142–170`).
- Google Sheets: baris data `[timestamp, use_case_name, domain, impact, feasibility, total, priority]` (`netlify/functions/save.js:63–84`).
- Balasan teks LLM: diambil dari pesan terakhir `assistant` saat kirim chat (`public/index.html:239–287`). Saat ini belum dipersist; kita akan menambah field `rawText` agar bisa dimasukkan ke PDD.

## Struktur Dokumen PDD
- Sampul: judul, tanggal, jumlah use case.
- Ringkasan eksekutif: gambaran singkat hasil assesment.
- Tabel ringkas: kolom `Use case, Domain, Impact, Feasibility, Total, Priority` untuk semua entri.
- Visualisasi: gambar Scatter dari Chart.js sebagai ilustrasi posisi setiap use case (`public/index.html:77–121, 131–141`).
- Bagian per use case:
  - Identitas: `Use case, Domain, Timestamp`.
  - Skor: `Impact, Feasibility, Total, Priority`.
  - Ringkasan LLM: potongan teks penjelasan (dari `rawText`).
  - Catatan/Asumsi: opsional, diambil dari teks LLM jika tersedia.

## Pendekatan Teknis
- Frontend (disarankan, ringan, tanpa server tambahan):
  - Pakai `pdfmake` (client-side) untuk membuat PDF terstruktur. Alternatif: `jsPDF + autoTable` bila preferensi tabel.
  - Ambil data dari `localStorage` dan kanvas Chart.js via `mappingCanvas.toDataURL()` untuk disisipkan sebagai gambar.
  - Keuntungan: cepat diintegrasikan, tidak perlu Chromium/puppeteer di Netlify Functions.
- Backend (opsional, bila butuh format konsisten & sangat panjang):
  - Netlify Function `export-pdd.js` menggunakan `pdfkit` dan mengembalikan `application/pdf` (stream). Payload: `{ assessments, chartImage?, organization? }`.
  - Cocok jika ingin tanda tangan digital, watermark, atau pengendalian layout ketat dari server.

## Perubahan Kode (Frontend)
1) Tambah tombol `Export PDF` di bar kontrol berdampingan dengan `Simpan/Reload` (`public/index.html:35–39`).
2) Simpan teks LLM terakhir ke assessment:
   - Di handler balasan LLM, setelah parsing sukses (`parsed`), set `lastAssessment.rawText = assistantText` dan persist (`public/index.html:268–279`).
3) Tambah fungsi `generatePDDPdf(assessments)`:
   - Kumpulkan semua assessment dari `loadAssessments()` (`public/index.html:335–341`).
   - Bangun `docDefinition` (pdfmake) dengan: sampul, tabel ringkas, gambar scatter (`mappingCanvas.toDataURL()`), dan section per use case.
   - `pdfMake.createPdf(docDefinition).download('PDD_<timestamp>.pdf')`.
4) Opsional: pilih subset assessment
   - UI sederhana: checkbox daftar use case atau “Export semua yang tersimpan”.

## Perubahan Kode (Backend, opsional)
- Buat `netlify/functions/export-pdd.js` mirip pola `save.js` dan `score.js`:
  - Endpoint POST menerima `{ assessments, chartImage }`.
  - Bangun PDF dengan `pdfkit`, set header `Content-Type: application/pdf`, `Content-Disposition: attachment`.
  - Kembalikan buffer/stream ke browser untuk diunduh.

## Integrasi dengan Data Sheets (opsional)
- Bila ingin sumber data dari Sheets, tambahkan tombol “Load dari Spreadsheet” yang memanggil `/.netlify/functions/save` dengan mode `GET` baru atau fungsi terpisah untuk membaca data. Lalu gunakan hasilnya untuk PDF.

## Alur Pengguna
- User melakukan assesment beberapa use case; setiap balasan LLM diparsing dan disimpan ke `localStorage` (beserta `rawText`).
- User klik `Export PDF` → pilih subset atau langsung semua → PDF diunduh.
- Opsi: Tambah metadata organisasi (nama tim, proyek) di form kecil sebelum generate.

## Validasi
- Uji dengan 3–5 use case fiktif; verifikasi:
  - Tabel ringkas memuat semua entri dengan angka yang benar.
  - Gambar Scatter muncul dan sesuai posisi.
  - Section detail per use case memuat `rawText` penjelasan.
  - Ukuran file dan performa generasi memadai di browser.

## Risiko & Alternatif
- Risiko: teks LLM tidak dipersist saat ini → mitigasi: tambah field `rawText` di storage & (opsional) di Sheets.
- Alternatif: HTML-to-PDF via `window.print()` (sangat ringan namun layout kurang presisi), atau `puppeteer` di Netlify (lebih berat, perlu `@sparticuz/chromium`).

## Estimasi Implementasi
- Frontend-only: ±0.5–1 hari (UI tombol, simpan `rawText`, fungsi pdfmake, uji).
- Backend function (opsional): +0.5–1 hari.

## Referensi Kode
- Prompt sistem: `netlify/system-prompt.js:1–2`.
- Panggilan LLM & handler: `netlify/functions/score.js:74–121, 142–181`.
- Persistensi lokal & parsing: `public/index.html:142–170, 179–207, 268–279, 335–341`.
- Simpan Sheets: `netlify/functions/save.js:63–84`.

Silakan konfirmasi pendekatan (Frontend-only atau tambah Backend). Setelah konfirmasi, saya akan implementasi sesuai rencana dan memverifikasi hasil PDF yang diunduh.