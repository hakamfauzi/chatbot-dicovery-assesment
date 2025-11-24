import { MAIN_PROMPT } from "../prompts/main_prompt.js";
import { QUESTION_PROMPT } from "../prompts/question_prompt.js";
 

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
    const allText = JSON.stringify(body.messages || "").toLowerCase();
    const triggerScore = assessmentDone || /\b\/score\b/.test(allText) || flow === "score";
    const preludeTexts = [];
    if (MAIN_PROMPT) preludeTexts.push(MAIN_PROMPT);
    if (wantsQna && QUESTION_PROMPT) preludeTexts.push(QUESTION_PROMPT);
    
    {
      const domainGuess = String(body?.assessment?.domain || body?.domain || "").trim() || (() => {
        const m = allText.match(/domain\s*:\s*([^\n]+)\n?/i);
        if (m) return m[1];
        if (/contact\s*center|voicebot|chatbot|kms|auto\s*kip/.test(allText)) return "contact center";
        if (/document\s*ai|extraction|summarization|verification|matching|classification/.test(allText)) return "document ai";
        if (/\brpa\b/.test(allText)) return "rpa";
        if (/proctor/.test(allText)) return "proctoring";
        return "";
      })();
      const classifier = classifyUsecase(domainGuess, allText);
      const requestedNames = detectRequestedScenario(allText);
      const guard = guardScenarioAccess(classifier, requestedNames, domainGuess);
      if (!guard.allowed) console.warn(`[SCENARIO AUDIT] access denied: ${guard.reason}`);
      const scenarioText = guard.allowed ? await loadScenarioText(domainGuess) : "";
      const generic = [
        "Tambahkan bagian '### Testing Scenario' secara otomatis di akhir OUTPUT UTAMA setiap kali /score.",
        "Sajikan dalam teks terstruktur, tanpa Excel, tanpa instruksi tambahan.",
        "Wajib sertakan [AUTOVARS], [KNOWLEDGE BASE] (10–20 Q→A), dan tabel pipa (No | Aspek | Pernyataan | Ucapan | Perilaku | Target | Bukti | Catatan)."
      ].join("\n");
      if (triggerScore) {
        const directive = [
          generic,
          scenarioText ? "Gunakan skenario berikut sebagai panduan spesifik domain:\n\n" + scenarioText : ""
        ].join("\n\n");
        if (preludeTexts.length >= 1) preludeTexts.splice(1, 0, directive); else preludeTexts.push(directive);
      }
    }
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
    let finalText = text;
    if (triggerScore && !/###\s*Testing\s*Scenario/i.test(finalText)) {
      const mDom = finalText.match(/\bDomain\s*:\s*([^\n]+)\n?/i);
      const domainFromOutput = mDom ? mDom[1] : "";
      const classifier2 = classifyUsecase(domainFromOutput, finalText.toLowerCase());
      const guard2 = guardScenarioAccess(classifier2, [], domainFromOutput);
      if (!guard2.allowed) console.warn(`[SCENARIO AUDIT] post-output access denied: ${guard2.reason}`);
      const scenarioText2 = guard2.allowed ? await loadScenarioText(domainFromOutput) : "";
      if (scenarioText2) {
        const directive2 = [
          "Tambahkan bagian '### Testing Scenario' terintegrasi dalam OUTPUT UTAMA.",
          "Format: header '### Testing Scenario', lalu blok [AUTOVARS], [KNOWLEDGE BASE] (10–20 Q→A), dan tabel pipa (No | Aspek | Pernyataan | Ucapan | Perilaku | Target | Bukti | Catatan).",
          "Gunakan skenario berikut sebagai panduan spesifik domain:\n\n" + scenarioText2
        ].join("\n\n");
        const messages2 = [
          ...preludeUser,
          { role: "assistant", content: finalText },
          { role: "user", content: directive2 }
        ];
        try {
          finalText = await callGroqChat(modelId, messages2);
        } catch (_) { /* ignore second-call failure; keep first text */ }
      }
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: finalText, model: modelId })
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

const selectScenarioFileByDomain = (domain) => {
  const d = String(domain || "").toLowerCase();
  const hasVoice = /(contact\s*center|voicebot|chatbot|kms|auto\s*kip)/.test(d);
  const hasDoc = /(document\s*ai|extraction|summarization|verification|matching|classification)/.test(d);
  const hasRpa = /\brpa\b/.test(d);
  const hasProc = /proctor/.test(d);
  if (hasVoice) return "../prompts/scenario_voicebot.js";
  if (hasDoc) return "../prompts/scenario_document_ai.js";
  if (hasRpa) return "../prompts/scenario_rpa.js";
  if (hasProc) return "../prompts/scenario_proctoring.js";
  return "";
};

const loadScenarioText = async (domain) => {
  const path = selectScenarioFileByDomain(domain);
  if (!path) return "";
  try {
    const mod = await import(path);
    const txt = Object.values(mod).find((v) => typeof v === "string") || "";
    return String(txt || "");
  } catch (_) {
    return "";
  }
};

const classifyUsecase = (domainGuess, allText) => {
  const d = String(domainGuess || "").toLowerCase();
  const t = String(allText || "").toLowerCase();
  const has = (re) => re.test(d) || re.test(t);
  if (has(/(contact\s*center|voicebot|chatbot|kms|auto\s*kip)/)) {
    let subtype = "generic";
    if (has(/voicebot\s*[-–]\s*inbound|\binbound\b.*voicebot|voicebot.*\binbound\b/)) subtype = "voicebot_inbound";
    else if (has(/voicebot\s*[-–]\s*outbound|\boutbound\b.*voicebot|voicebot.*\boutbound\b/)) subtype = "voicebot_outbound";
    else if (has(/\bchatbot\b/)) subtype = "chatbot";
    else if (has(/kms\s*ai.*stand\s*alone|kms\s*ai.*standalone/)) subtype = "kms_standalone";
    else if (has(/kms\s*ai.*embedded|\bomni\s*x\b/)) subtype = "kms_embedded";
    else if (has(/auto\s*kip/)) subtype = "auto_kip";
    return { category: "voice", subtype };
  }
  if (has(/(document\s*ai|extraction|summarization|verification|matching|classification)/)) return { category: "doc_ai", subtype: "" };
  if (has(/\brpa\b/)) return { category: "rpa", subtype: "" };
  if (has(/proctor/)) return { category: "proctor", subtype: "" };
  return { category: "unknown", subtype: "" };
};

const detectRequestedScenario = (allText) => {
  const m = String(allText || "").match(/scenario_[a-z0-9_]+\.js/ig);
  return m ? m.map((x) => x.toLowerCase()) : [];
};

const isVoiceSubtypeAllowed = (sub) => {
  return ["voicebot_inbound","voicebot_outbound","chatbot","kms_standalone","kms_embedded","auto_kip","generic"].includes(String(sub || ""));
};

const guardScenarioAccess = (classifier, requestedNames, domainGuess) => {
  const deny = (reason) => ({ allowed: false, reason });
  const allow = () => ({ allowed: true });
  if (classifier.category === "doc_ai") {
    const ok = !requestedNames.length || requestedNames.every((n) => n.includes("scenario_document_ai.js"));
    if (!ok) return deny("Document AI hanya boleh memakai scenario_document_ai.js");
    return allow();
  }
  if (classifier.category === "proctor") {
    const ok = !requestedNames.length || requestedNames.every((n) => n.includes("scenario_proctoring.js"));
    if (!ok) return deny("Proctoring hanya boleh memakai scenario_proctoring.js");
    return allow();
  }
  if (classifier.category === "rpa") {
    const token = process.env.RPA_SCENARIO_TOKEN || "";
    if (!token) return deny("Otorisasi RPA tidak valid");
    const ok = !requestedNames.length || requestedNames.every((n) => n.includes("scenario_rpa.js"));
    if (!ok) return deny("RPA hanya boleh memakai scenario_rpa.js");
    return allow();
  }
  if (classifier.category === "voice") {
    if (!isVoiceSubtypeAllowed(classifier.subtype)) return deny("Subtype voicebot tidak diizinkan");
    const ok = !requestedNames.length || requestedNames.every((n) => n.includes("scenario_voicebot.js"));
    if (!ok) return deny("Voice/KMS/AutoKIP hanya boleh memakai scenario_voicebot.js");
    return allow();
  }
  return deny("Domain tidak dikenali untuk scenario");
};
