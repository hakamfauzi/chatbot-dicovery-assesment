# Koneksi Google Sheets ke Project

## Prasyarat
- Spreadsheet Google aktif.
- Akses Google Cloud untuk membuat Service Account.

## Langkah Konfigurasi
- Buat Service Account di Google Cloud dan buat kunci tipe JSON.
- Aktifkan API: Google Sheets API.
- Catat `client_email` dan `private_key` dari file JSON.
- Buka Spreadsheet, klik Bagikan, tambahkan `client_email` Service Account sebagai Editor.
- Dapatkan `Spreadsheet ID` dari URL Spreadsheet.

## Environment Variables (Netlify)
- `GOOGLE_CLIENT_EMAIL`: email Service Account.
- `GOOGLE_PRIVATE_KEY`: isi private key, ganti `\n` dengan newline asli bila perlu.
- `GOOGLE_SHEETS_SPREADSHEET_ID`: ID Spreadsheet.
- `GOOGLE_SHEETS_RANGE` (opsional): default `Sheet1!A:H`.

## Verifikasi
- Tombol "Muat dari Spreadsheet" akan memanggil endpoint baca dan mengisi chart.
- Tombol "Simpan ke Spreadsheet" menulis baris baru dengan format: `timestamp, use_case_name, domain, impact, feasibility, total, priority, rawText`.

## Catatan
- Pastikan Spreadsheet memiliki sheet `Sheet1` atau set `GOOGLE_SHEETS_RANGE` sesuai nama sheet.
- Untuk pemisah desimal koma, sistem akan mengonversi otomatis ke angka.

