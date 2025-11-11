// Import prompt sistem
import { SYSTEM_PROMPT } from "../system-prompt.js";

// Panggil Gemini API via HTTP ke endpoint v1 (chat/multi-turn)
const API_KEY = process.env.GEMINI_API_KEY;

// Mendapatkan daftar model yang tersedia untuk API key (diagnostik)
const listModelsV1 = async () => {
    const url = `https://generativelanguage.googleapis.com/v1/models?key=${API_KEY}`;
    const resp = await fetch(url, { method: "GET" });
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
    const body = { contents };

    const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

    if (!resp.ok) {
        const text = await resp.text();
        const err = new Error(`HTTP ${resp.status} ${resp.statusText}: ${text}`);
        err.status = resp.status;
        throw err;
    }

    const data = await resp.json();
    const text = (data?.candidates?.[0]?.content?.parts || [])
        .map((p) => p?.text)
        .filter(Boolean)
        .join("");
    return text;
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
        "gemini-1.5-pro",
        "gemini-1.5-flash",
        "gemini-1.5-pro-latest",
        "gemini-1.5-flash-latest",
        "gemini-pro",
        "gemini-pro-latest",
        "gemini-1.0-pro",
        "gemini-1.0-pro-latest"
    );

    // Coba ambil daftar model dari API untuk menyaring kandidat
    let availableModels = await listModelsV1();
    const availableSet = Array.isArray(availableModels)
        ? new Set(availableModels.map(sanitizeModelName))
        : null;
    if (availableSet) {
        candidates = candidates.filter((c) => availableSet.has(sanitizeModelName(c)));
    }

    const retryStatuses = new Set([429, 500, 503]);
    const delaysMs = [600, 1500, 3000]; // exponential-ish backoff
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
    // Sisipkan SYSTEM_PROMPT sebagai pesan awal untuk menuntun perilaku chatbot
    if (SYSTEM_PROMPT) {
        contents.push({ role: 'user', parts: [{ text: SYSTEM_PROMPT }] });
    }
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
        } else if (body.narrative) {
            // Kompatibilitas lama: satu input narasi
            const userNarrative = String(body.narrative);
            const prompt = `${SYSTEM_PROMPT}\n\nPengguna: ${userNarrative}`;
            contents = normalizeMessagesToContents([{ role: 'user', text: prompt }]);
        } else {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Payload tidak valid. Sertakan "messages" (chat) atau "narrative".' }),
            };
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

// // Import prompt sistem (mengikuti path Anda)
// import { SYSTEM_PROMPT } from "../system-prompt.js";

// // Panggil Gemini API via HTTP ke endpoint v1 (menghindari v1beta)
// const API_KEY = process.env.GEMINI_API_KEY;

// // Mendapatkan daftar model yang tersedia untuk API key (diagnostik)
// const listModelsV1 = async () => {
//     const url = `https://generativelanguage.googleapis.com/v1/models?key=${API_KEY}`;
//     const resp = await fetch(url, { method: "GET" });
//     if (!resp.ok) {
//         const text = await resp.text();
//         return { error: text, status: resp.status };
//     }
//     const data = await resp.json();
//     const names = (data?.models || []).map((m) => m?.name).filter(Boolean);
//     return names;
// };

// // ========================================================================
// // [PERUBAHAN] Disesuaikan untuk menerima 'contents' (array) dan 'systemInstruction' (string)
// // ========================================================================
// const callGenerativeV1 = async (model, contents, systemInstruction) => {
//     const clean = sanitizeModelName(model);
//     const url = `https://generativelanguage.googleapis.com/v1/models/${clean}:generateContent?key=${API_KEY}`;
//     
//     // Body sekarang mendukung histori chat lengkap dan instruksi sistem
//     const body = {
//         contents: contents, // Array dari histori chat
//         systemInstruction: {
//             parts: [{ text: systemInstruction }] // Prompt sistem
//         }
//     };

//     const resp = await fetch(url, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify(body),
//     });

//     if (!resp.ok) {
//         const text = await resp.text();
//         const err = new Error(`HTTP ${resp.status} ${resp.statusText}: ${text}`);
//         err.status = resp.status;
//         throw err;
//     }

//     const data = await resp.json();
//     // Logika parsing respons tetap sama, karena 'generateContent' mengembalikan format yang sama
//     const text = (data?.candidates?.[0]?.content?.parts || [])
//         .map((p) => p?.text)
//         .filter(Boolean)
//         .join("");
//     return text;
// };

// // Sanitasi nama model agar kompatibel dengan path v1 (hapus prefix "models/")
// const sanitizeModelName = (name) => String(name || '').replace(/^models\//, '');

// // ========================================================================
// // [PERUBAHAN] Disesuaikan untuk menerima 'contents' dan 'systemInstruction'
// // ========================================================================
// const generateWithFallback = async (contents, systemInstruction) => {
//     let candidates = [];
//     if (process.env.GEMINI_MODEL) candidates.push(process.env.GEMINI_MODEL);
//     // Urutan preferensi: 1.5 pro/flash, variasi -latest, lalu pro lama
//     candidates.push(
//         "gemini-1.5-pro",
//         "gemini-1.5-flash",
//         "gemini-1.5-pro-latest",
//         "gemini-1.5-flash-latest",
//         "gemini-pro",
//         "gemini-pro-latest",
//         "gemini-1.0-pro",
//         "gemini-1.0-pro-latest"
//     );

//     // Coba ambil daftar model dari API untuk menyaring kandidat
//     let availableModels = await listModelsV1();
//     const availableSet = Array.isArray(availableModels)
//         ? new Set(availableModels.map(sanitizeModelName))
//         : null;
//     if (availableSet) {
//         candidates = candidates.filter((c) => availableSet.has(sanitizeModelName(c)));
//     }

//     let lastError;
//     for (const name of candidates) {
//         try {
//             // Meneruskan parameter baru ke callGenerativeV1
//             const text = await callGenerativeV1(name, contents, systemInstruction);
//             return { text, modelUsed: name };
//         } catch (err) {
//             lastError = err;
//             console.warn(`v1 model ${name} gagal: ${err?.message || err}`);
//         }
//     }
//     throw lastError || new Error("Tidak ada model Gemini v1 yang berhasil memproses permintaan.");
// };

// // ========================================================================
// // [PERUBAHAN] Handler utama disesuaikan untuk mode Chatbot
// // ========================================================================
// export const handler = async (event) => {
//     // 1. Keamanan dasar: Hanya izinkan request POST
//     if (event.httpMethod !== 'POST') {
//         return {
//             statusCode: 405,
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify({ error: 'Method Not Allowed' }),
//         };
//     }

//     try {
//         // 2. Ambil histori dan pesan baru dari body request
//         const body = JSON.parse(event.body);
//         const history = body.history || []; // Array dari chat sebelumnya
//         const userMessage = body.message;   // Pesan baru dari pengguna

//         if (!userMessage) {
//             return {
//                 statusCode: 400,
//                 headers: { 'Content-Type': 'application/json' },
//                 // Diubah untuk mencerminkan input yang diharapkan
//                 body: JSON.stringify({ error: 'Payload "message" tidak ditemukan.' }),
//             };
//         }

//         // 3. Bangun 'contents' array dan 'systemInstruction'
//         // Frontend sudah mengirim 'history' dalam format yang benar.
//         // Kita hanya perlu menambahkan pesan baru dari pengguna.
//         const contents = [
//             ...history,
//             {
//                 role: "user",
//                 parts: [{ text: userMessage }]
//             }
//         ];
        
//         // Pisahkan System Prompt untuk dikirim di field 'systemInstruction'
//         const systemInstruction = SYSTEM_PROMPT;


//         // 4. Panggil Gemini API dengan fallback berjenjang
//         const { text, modelUsed } = await generateWithFallback(contents, systemInstruction);

//         // 5. Kembalikan hasil ke Frontend
//         return {
//             statusCode: 200,
//             headers: { 'Content-Type': 'application/json' },
//             // [PENTING] Diubah dari 'message' ke 'messageText' agar sesuai ekspektasi frontend
//             body: JSON.stringify({ messageText: text, model: modelUsed }),
//         };

//     } catch (error) {
//         console.error('Error di serverless function:', error);
//         // Logika error handling Anda sudah bagus dan tetap dipertahankan
//         const details = error?.message || String(error);
//         const status = error?.status || error?.statusCode;
//         let availableModels;
//         try {
//             availableModels = await listModelsV1();
//         } catch (e) {
//             availableModels = undefined;
//         }
//         return {
//             statusCode: 500,
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify({ error: 'Terjadi kesalahan internal di server.', details, status, availableModels }),
//         };
//     }
// };