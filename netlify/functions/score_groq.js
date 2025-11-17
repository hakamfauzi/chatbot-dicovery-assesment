import { MAIN_PROMPT } from "../prompts/main_prompt.js";
import { QUESTION_PROMPT } from "../prompts/question_prompt.js";
import { DEVGUIDE_PROMPT } from "../prompts/devguide_prompt.js";

const GROQ_API_KEY = process.env.GROQ_API_KEY || "";

const fetchWithTimeout = async (url, options = {}, ms = 60000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err?.name === "AbortError" || String(err?.message || "").toLowerCase().includes("abort")) {
      const e = new Error(`Timeout after ${ms}ms`);
      e.status = 504;
      throw e;
    }
    throw err;
  } finally {
    clearTimeout(id);
  }
};

const normalizeMessagesToGroq = (messages) => {
  const out = [];
  for (const m of Array.isArray(messages) ? messages : []) {
    const role = (m?.role === "assistant" || m?.role === "model") ? "assistant" : "user";
    const text = String(m?.text ?? m?.content ?? m?.message ?? "");
    if (text.trim()) out.push({ role, content: text });
  }
  return out.length ? out : [{ role: "user", content: "Halo" }];
};

const callGroqChat = async (model, messages) => {
  const url = "https://api.groq.com/openai/v1/chat/completions";
  const body = {
    model,
    messages,
    temperature: Number(process.env.GENERATION_TEMPERATURE || 0.2),
    max_tokens: Number(process.env.MAX_OUTPUT_TOKENS || 768)
  };
  const resp = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_API_KEY}` },
    body: JSON.stringify(body)
  }, Number(process.env.MODEL_TIMEOUT_MS || 60000));
  if (!resp.ok) {
    const text = await resp.text();
    const err = new Error(`HTTP ${resp.status} ${resp.statusText}: ${text}`);
    err.status = resp.status;
    throw err;
  }
  const data = await resp.json();
  let text = String(data?.choices?.[0]?.message?.content || "").trim();
  if (text) return text;
  const raw = data?.choices?.[0]?.message;
  const alt = raw ? JSON.stringify(raw) : "";
  return String(alt || "Tidak ada respon teks dari model.");
};

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method Not Allowed" })
    };
  }

  try {
    if (!GROQ_API_KEY) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "GROQ_API_KEY belum di-set." })
      };
    }
    const body = JSON.parse(event.body || "{}");
    let baseMessages;
    if (Array.isArray(body.messages)) {
      baseMessages = normalizeMessagesToGroq(body.messages);
    } else if (body.narrative) {
      baseMessages = normalizeMessagesToGroq([{ role: "user", text: String(body.narrative) }]);
    } else {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Payload tidak valid. Sertakan 'messages' atau 'narrative'." })
      };
    }

    const flow = String(body.flow || "").toLowerCase();
    const wantsQna = flow === "qna" || !!(body.modules && body.modules.questions) || JSON.stringify(body.messages || "").toLowerCase().includes("/qna");
    const assessmentDone = body.assessmentComplete === true;
    const wantsDevguide = (flow === "devguide" || JSON.stringify(body.messages || "").toLowerCase().includes("/devguide") || body.devguide === true) && assessmentDone;
    const preludeTexts = [];
    if (MAIN_PROMPT) preludeTexts.push(MAIN_PROMPT);
    if (wantsQna && QUESTION_PROMPT) preludeTexts.push(QUESTION_PROMPT);
    if (wantsDevguide && DEVGUIDE_PROMPT) preludeTexts.push(DEVGUIDE_PROMPT);
    const preludeUser = preludeTexts.map((t) => ({ role: "user", content: t }));
    let messages = [...preludeUser, ...baseMessages];
    if (body.modules && body.modules.qna) {
      const step = Number(body.modules.qna.step || 1);
      const cat = String(body.modules.qna.category || "").trim();
      const directive = `Mode QnA terkontrol: ajukan hanya Q${step}/20 untuk kategori "${cat}". Tampilkan satu baris "Q${step}/20: …" dan minta jawaban singkat pengguna.`;
      messages.unshift({ role: "user", content: directive });
    }
    const approxTokens = (s) => Math.ceil(String(s || "").length / 4);
    const enableTrim = String(process.env.GROQ_INPUT_TRIM || '').toLowerCase() === 'true';
    if (enableTrim) {
      const maxInputTokens = 7800;
      let normalized = messages.map((m, idx) => ({ role: m.role, content: idx < 2 ? String(m.content || "") : String(m.content || "").slice(0, 1200) }));
      let total = normalized.reduce((sum, m) => sum + approxTokens(m.content || ""), 0);
      while (total > maxInputTokens && normalized.length > 10) {
        normalized.splice(normalized.length - 1, 1);
        total = normalized.reduce((sum, m) => sum + approxTokens(m.content || ""), 0);
      }
      messages = normalized;
    }

    const modelId = String(process.env.GROQ_MODEL || "openai/gpt-oss-120b");
    const text = await callGroqChat(modelId, messages);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, model: modelId })
    };
  } catch (error) {
    const details = error?.message || String(error);
    const status = error?.status || error?.statusCode;
    const statusCode = Number(status) && [429, 500, 503, 504].includes(Number(status)) ? Number(status) : 500;
    return {
      statusCode,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Terjadi kesalahan di layanan model.", details, status: statusCode })
    };
  }
};