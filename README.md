# Usecase Prioritization — GPT‑OSS (Groq) Only

Fokus sistem: seluruh scoring dan percakapan menggunakan GPT‑OSS via Groq.

## Konfigurasi

- `GROQ_API_KEY`: API key Groq (wajib)
- `GROQ_MODEL`: ID model Groq (default: `openai/gpt-oss-120b`)
- `MODEL_TIMEOUT_MS`: timeout pemanggilan model (default: `60000`)
- `GENERATION_TEMPERATURE`: temperatur output (default: `0.2`)
- `MAX_OUTPUT_TOKENS`: batas token output (default: `768`)
- `GROQ_INPUT_TRIM`: `true|false` untuk trimming input panjang (default: `false`)
- `GROQ_CACHE_TTL_MS`: TTL cache hasil Groq (default: `60000` ms)
- `GROQ_MIN_INTERVAL_MS`: jeda minimal antar panggilan (default: `200` ms)

## Endpoint

- Scoring/percakapan: `/.netlify/functions/score_groq`
- Generate scenario Excel: `/.netlify/functions/scenario`
- Save & list Google Sheets: `/.netlify/functions/save`, `/.netlify/functions/list`

## Fitur Voicebot Testing Scenario

- Perintah chat: `/generate_scenario` (aktif setelah scoring voicebot selesai)
- Prompt skenario otomatis diinject dari `netlify/prompts/scenario_prompt.js`
- Output LLM mendukung blok `[AUTOVARS]` dan `[KNOWLEDGE BASE]` untuk injeksi ke Excel

## Pembersihan Integrasi Lama

- Toggle pemilihan model di UI dihapus
- Seluruh integrasi Gemini dihapus (file, test, deps)
- Kode diarahkan eksklusif ke Groq

## Testing

- Jalankan `npm test` untuk menjalankan seluruh test