// Import prompt sistem
import { MAIN_PROMPT } from "../prompts/main_prompt.js";
import { QUESTION_PROMPT } from "../prompts/question_prompt.js";
import { DEVGUIDE_PROMPT } from "../prompts/devguide_prompt.js";

// Panggil Gemini API via HTTP ke endpoint v1 (chat/multi-turn)
const API_KEY = process.env.GEMINI_API_KEY;

// Helper: fetch dengan timeout menggunakan AbortController
const fetchWithTimeout = async (url, options = {}, ms = 60000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), ms);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } catch (err) {
        // Map abort ke status 504 agar penanganan error konsisten
        if (err?.name === 'AbortError' || String(err?.message || '').toLowerCase().includes('abort')) {
            const e = new Error(`Timeout after ${ms}ms`);
            e.status = 504;
            throw e;
        }
        throw err;
    } finally {
        clearTimeout(id);
    }
};

// Mendapatkan daftar model yang tersedia untuk API key (diagnostik)
const listModelsV1 = async () => {
    const url = `https://generativelanguage.googleapis.com/v1/models?key=${API_KEY}`;
    const resp = await fetchWithTimeout(url, { method: "GET" }, 12000);
    if (!resp.ok) {
        const text = await resp.text();
        return { error: text, status: resp.status };
    }
    const data = await resp.json();
    const names = (data?.models || []).map((m) => m?.name).filter(Boolean);
    return names;
};

const callGenerativeV1 = async (model, contents) => {
    const clean = sanitizeModelName(model);
    const url = `https://generativelanguage.googleapis.com/v1/models/${clean}:generateContent?key=${API_KEY}`;
    const body = {
        contents,
        generationConfig: {
            maxOutputTokens: Number(process.env.MAX_OUTPUT_TOKENS || 768),
            temperature: Number(process.env.GENERATION_TEMPERATURE || 0.1),
        },
    };

    const resp = await fetchWithTimeout(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    }, Number(process.env.MODEL_TIMEOUT_MS || 60000));

    if (!resp.ok) {
        const text = await resp.text();
        const err = new Error(`HTTP ${resp.status} ${resp.statusText}: ${text}`);
        err.status = resp.status;
        throw err;
    }

    const data = await resp.json();
    const parts = (data?.candidates?.[0]?.content?.parts || []);
    const text = parts.map((p) => p?.text).filter(Boolean).join("");
    if (String(text || "").trim()) return text;
    const alt = parts.map((p) => typeof p === "string" ? p : JSON.stringify(p)).join("\n");
    return String(alt || "Tidak ada respon teks dari model.");
};

// Sanitasi nama model agar kompatibel dengan path v1 (hapus prefix "models/")
const sanitizeModelName = (name) => String(name || '').replace(/^models\//, '');

// Generate dengan fallback model menggunakan endpoint v1
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const generateWithFallback = async (contents) => {
    let candidates = [];
    if (process.env.GEMINI_MODEL) candidates.push(process.env.GEMINI_MODEL);
    // Urutan preferensi: 1.5 pro/flash, variasi -latest, lalu pro lama
    candidates.push(
        "gemini-2.5-flash",
        "gemini-1.5-flash",
        // "gemini-1.5-pro"
    );

    // Coba ambil daftar model dari API untuk menyaring kandidat
    let availableModels;
    try {
        availableModels = await listModelsV1();
    } catch (_) {
        availableModels = undefined;
    }
    const availableSet = Array.isArray(availableModels)
        ? new Set(availableModels.map(sanitizeModelName))
        : null;
    if (availableSet) {
        candidates = candidates.filter((c) => availableSet.has(sanitizeModelName(c)));
    }

    const retryStatuses = new Set([429, 500, 503]);
    const delaysMs = [500, 1200]; // pangkas retry agar tidak mendekati timeout CLI
    let lastError;
    for (const name of candidates) {
        for (let attempt = 0; attempt < delaysMs.length; attempt++) {
            try {
                const text = await callGenerativeV1(name, contents);
                return { text, modelUsed: name };
            } catch (err) {
                lastError = err;
                const status = err?.status;
                const canRetry = retryStatuses.has(Number(status));
                const delay = delaysMs[attempt] || 1000;
                console.warn(`v1 model ${name} gagal (attempt ${attempt + 1}): ${err?.message || err}`);
                if (!canRetry) break; // status tak layak retry: pindah ke model berikutnya
                await sleep(delay);
            }
        }
    }
    throw lastError || new Error("Tidak ada model Gemini v1 yang berhasil memproses permintaan.");
};

// Konversi pesan dari frontend menjadi format 'contents' API v1
const normalizeMessagesToContents = (messages) => {
    const toRole = (r) => (r === 'assistant' || r === 'model') ? 'model' : 'user';
    const toText = (m) => m?.text ?? m?.content ?? m?.message ?? '';
    const contents = [];
    for (const m of Array.isArray(messages) ? messages : []) {
        const role = toRole(m.role);
        const text = toText(m);
        if (text && typeof text === 'string') {
            contents.push({ role, parts: [{ text }] });
        }
    }
    return contents.length ? contents : [{ role: 'user', parts: [{ text: 'Halo' }] }];
};

// Ini adalah handler fungsi Netlify
export const handler = async (event) => {
    // 1. Keamanan dasar: Hanya izinkan request POST
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Method Not Allowed' }),
        };
    }

    try {
        // 2. Ambil payload dari body request
        const body = JSON.parse(event.body || '{}');
        let contents;
        if (Array.isArray(body.messages)) {
            // Mode chatbot: gunakan riwayat percakapan dari frontend
            contents = normalizeMessagesToContents(body.messages);
            const lastUser = Array.isArray(body.messages) ? [...body.messages].reverse().find(m => m.role === 'user') : null;
            const s = String(lastUser?.text || '');
            const looksNarrative = (s.length > 200) || /Use\s*case\s*:|Domain\s*:|Impact\s*:|Feasibility\s*:|Priority\s*:/i.test(s);
            if (looksNarrative || String(body.flow || '').toLowerCase() === 'narrative') {
                const directiveNarr = 'Mode narasi: pahami konteks narasi panjang pengguna, infer domain, hitung skor sesuai rubrik & bobot, terapkan guardrails, lalu keluarkan Format Hasil lengkap (label persis). Jika data kurang, set Confidence: Low dan minta 1–2 klarifikasi ringkas.';
                contents.unshift({ role: 'user', parts: [{ text: directiveNarr }] });
            }
        } else if (body.narrative) {
            const userNarrative = String(body.narrative);
            contents = normalizeMessagesToContents([{ role: 'user', text: userNarrative }]);
        } else {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Payload tidak valid. Sertakan "messages" (chat) atau "narrative".' }),
            };
        }
        const flow = String(body.flow || '').toLowerCase();
        const wantsQna = flow === 'qna' || !!(body.modules && body.modules.questions) || JSON.stringify(body.messages || '').toLowerCase().includes('/qna');
        const assessmentDone = body.assessmentComplete === true;
        const wantsDevguide = (flow === 'devguide' || JSON.stringify(body.messages || '').toLowerCase().includes('/devguide') || body.devguide === true) && assessmentDone;
        const preludeTexts = [];
        if (MAIN_PROMPT) preludeTexts.push(MAIN_PROMPT);
        if (wantsQna && QUESTION_PROMPT) preludeTexts.push(QUESTION_PROMPT);
        if (wantsDevguide && DEVGUIDE_PROMPT) preludeTexts.push(DEVGUIDE_PROMPT);
        const prelude = preludeTexts.map((t) => ({ role: 'user', parts: [{ text: t }] }));
        contents = [...prelude, ...contents];
        // Dorong klarifikasi owner di awal sesi jika belum disebut
        try {
            const hasOwner = contents.some(c => /Owner\s*:\s*/i.test(String(c?.parts?.[0]?.text || '')));
            const lastUser = [...(body.messages || [])].reverse().find(m => m.role === 'user');
            const uText = String(lastUser?.text || '');
            if (String(body.flow || '').toLowerCase() === 'qna' && !hasOwner && !/Owner\s*:\s*/i.test(uText)) {
                const askOwner = 'Q0 — Owner: Siapa owner/penanggung jawab use case ini? (nama unit/tim/produk). Tolong jawab dengan format: "Owner: <nama>"';
                contents.push({ role: 'user', parts: [{ text: askOwner }] });
            }
        } catch {}
        if (body.narrative) {
            const directiveNarr = 'Mode narasi: pahami konteks narasi panjang pengguna, infer domain, hitung skor sesuai rubrik & bobot, terapkan guardrails, lalu keluarkan Format Hasil lengkap sesuai spesifikasi (label persis). Jika data kurang, set Confidence: Low dan minta 1–2 klarifikasi ringkas.';
            contents.unshift({ role: 'user', parts: [{ text: directiveNarr }] });
        }
        if (body.modules && body.modules.qna) {
            const step = Number(body.modules.qna.step || 1);
            const cat = String(body.modules.qna.category || '').trim();
            const directive = `Mode QnA terkontrol: ajukan hanya Q${step}/20 untuk kategori "${cat}". Tampilkan satu baris "Q${step}/20: …" dan minta jawaban singkat pengguna. Jangan keluarkan pertanyaan lain.`;
            contents.unshift({ role: 'user', parts: [{ text: directive }] });
        }

        // 3. Panggil Gemini API dengan fallback berjenjang
        const { text, modelUsed } = await generateWithFallback(contents);

        // 4. Kembalikan hasil ke Frontend
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text, model: modelUsed }),
        };

    } catch (error) {
        console.error('Error di serverless function:', error);
        // Ekspose detail minimal agar frontend bisa menampilkan konteks
        const details = error?.message || String(error);
        const status = error?.status || error?.statusCode;
        let availableModels;
        try {
            availableModels = await listModelsV1();
        } catch (e) {
            availableModels = undefined;
        }
        const statusCode = Number(status) && [429, 500, 503].includes(Number(status)) ? Number(status) : 500;
        const friendly = (statusCode === 503)
            ? 'Model sedang penuh/overloaded. Coba lagi beberapa saat (kami akan retry otomatis).'
            : (statusCode === 429)
                ? 'Kena rate limit. Kurangi frekuensi atau coba sebentar lagi.'
                : 'Terjadi kesalahan di layanan model.';
        return {
            statusCode: statusCode,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: friendly, details, status: statusCode, availableModels }),
        };
    }
};