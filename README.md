# Usecase Prioritization – Development & Netlify Deploy

Panduan langkah demi langkah untuk menjalankan proyek ini dari lingkungan pengembangan lokal hingga deploy ke Netlify.

## Ringkasan Arsitektur
- Frontend: `public/index.html` (single-page, chat UI + Chart.js)
- Serverless Functions (Netlify):
  - `netlify/functions/score_groq.js` — orchestrasi LLM (Groq API)
  - `netlify/functions/generate.js` — generator PDF/HTML (Puppeteer + Chromium)
  - `netlify/functions/save.js` — simpan hasil ke Google Sheets
  - `netlify/functions/list.js` — baca daftar dari Google Sheets
- Prompts: `netlify/prompts/*.js` (main, question, scenario_*, bva)

## Prasyarat
- Node.js 18+ dan npm
- Netlify CLI (`npm i -g netlify-cli`)
- Akun Groq + `GROQ_API_KEY`
- Google Service Account (Sheets API) + kredensial
- Chrome/Chromium lokal (opsional; fungsi PDF memakai `@sparticuz/chromium` di Netlify)

## Variabel Lingkungan (Environment)
Siapkan environment variables di lokal (mis. file `.env` atau shell) dan di Netlify (Dashboard → Site → Settings → Environment variables):

### Model/LLM (score_groq)
- `GROQ_API_KEY` — API key Groq (wajib)
- `GROQ_MODEL` — ID model (default: `openai/gpt-oss-120b`)
- `GENERATION_TEMPERATURE` — default `0.2`
- `MAX_OUTPUT_TOKENS` — default `768`
- `MODEL_TIMEOUT_MS` — default `60000`
- `GROQ_INPUT_TRIM` — `true|false` untuk memotong input panjang (default nonaktif)

### Google Sheets (save & list)
- `GOOGLE_CLIENT_EMAIL` atau `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY` atau `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` atau `GOOGLE_PRIVATE_KEY_BASE64`
- `GOOGLE_SHEETS_SPREADSHEET_ID`
- `GOOGLE_SHEETS_RANGE` — default `hasil_llm!A:N` (save) / `hasil_llm!A:N` atau `pertanyaan!A:C` (list)

Catatan kredensial private key:
- Jika menyimpan dalam satu baris, ganti `\n` menjadi newline saat runtime (fungsi sudah menangani)
- Jika base64, isi ke `GOOGLE_PRIVATE_KEY_BASE64`

## Instalasi & Persiapan
1) Clone repo, masuk ke direktori proyek
2) Install dependencies
   - `npm install`
3) Pasang Netlify CLI (jika belum)
   - `npm i -g netlify-cli`
4) Siapkan environment di lokal (Windows PowerShell contoh):
   - `$env:GROQ_API_KEY = "<groq_key>"`
   - `$env:GOOGLE_CLIENT_EMAIL = "svc-account@project.iam.gserviceaccount.com"`
   - `$env:GOOGLE_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"`
   - `$env:GOOGLE_SHEETS_SPREADSHEET_ID = "<spreadsheet_id>"`

## Menjalankan di Lokal (Netlify Dev)
Frontend memanggil endpoint `/.netlify/functions/*`, sehingga sebaiknya menggunakan Netlify Dev.

- Jalankan: `netlify dev`
- Jika diminta path:
  - Functions dir: `netlify/functions`
  - Publish dir: `public`
- Akses di browser: `http://localhost:8888/`
- Fitur yang berjalan:
  - Chat UI (bubble) + formatter markdown/HTML
  - Panggilan LLM via `score_groq`
  - Generate PDF/HTML via `generate`
  - Simpan & baca Google Sheets via `save` dan `list`

## Perintah Uji (Testing)
- `npm run test`
  - Unit test untuk generate (PDF/HTML), score Groq, dan integrasi penyimpanan/list ke Sheets

## Alur Kerja Utama
- Interaksi di `public/index.html`:
  - Kirim pesan → disimpan di `conversation`
  - Panggil `/.netlify/functions/score_groq` dengan payload (messages, flow, assessmentComplete)
  - Setelah `/score`, respons utama memuat teks lengkap + bagian “### Testing Scenario” dan “### Business Value Assessment (BVA)”
- Generate PDF/HTML:
  - Endpoint `/.netlify/functions/generate` menerima `assessment` + `conversation`
  - Panel PDF:
    - Use Case Summary — ringkasan, alasan, risiko, next steps, skor & kontribusi
    - Usecase Positioning — kuadran Impact vs Feasibility
    - Design Solution — hasil Developer Guide (diekstrak, tervalidasi)
    - Scenario Testing Usecase — blok skenario (diekstrak, tervalidasi)
    - Business Value Assessment — blok BVA (diekstrak, tervalidasi)
- Simpan ke Google Sheets:
  - Endpoint `/.netlify/functions/save` ditrigger dari UI (“Simpan ke Spreadsheet”) untuk menulis satu baris hasil
  - Baca daftar: `/.netlify/functions/list` untuk menampilkan table di UI

## Deploy ke Netlify
1) Login & init
   - `netlify login`
   - `netlify init` (pilih site atau buat baru)
2) Pastikan konfigurasi build:
   - Functions: `netlify/functions`
   - Publish: `public`
3) Set environment variables di Netlify Dashboard (Site → Settings → Environment variables)
   - Masukkan semua variabel pada bagian Model/LLM & Google Sheets
4) Deploy
   - Staging/Preview: `netlify deploy` (pilih folder `public` ketika diminta)
   - Production: `netlify deploy --prod`

## Troubleshooting
- 400 `GROQ_API_KEY belum di-set` (score_groq)
  - Pastikan env `GROQ_API_KEY` tersedia di lokal & di Netlify
- 400 `Environment variables GOOGLE_… wajib di-set` (save/list)
  - Pastikan `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY`/`GOOGLE_PRIVATE_KEY_BASE64`, dan `GOOGLE_SHEETS_SPREADSHEET_ID` di-set
- PDF gagal di lokal
  - Gunakan Netlify Dev; fungsi memakai `@sparticuz/chromium` di cloud. Di lokal, siapkan Chrome path jika perlu
- Panel kosong (Scenario/BVA/Design Solution)
  - Pastikan heading sesuai:
    - Scenario: `### Testing Scenario`, `## Scenario Testing Use`, atau `##Testing scenario`
    - BVA: `### Business Value Assessment (BVA)` atau variasi “Analysis (BVA)”
    - Devguide: `**Developer Guide**` atau heading “Design Solution”

## Referensi Kode
- LLM handler: `netlify/functions/score_groq.js`
- PDF/HTML generator: `netlify/functions/generate.js`
- Sheets save: `netlify/functions/save.js`
- Sheets list: `netlify/functions/list.js`
- Prompts: `netlify/prompts/main_prompt.js`, `netlify/prompts/question_prompt.js`, `netlify/prompts/scenario_*.js`, `netlify/prompts/bva_prompt.js`

---
Siap dipakai untuk sesi assessment: jalankan Netlify Dev, isi percakapan, lakukan `/score`, review panel PDF, dan deploy. Jika ada kebutuhan tambahan (rate-limit, logging, atau model fallback), update variabel environment dan fungsi terkait.
