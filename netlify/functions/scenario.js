import ExcelJS from "exceljs";
import { SCENARIO_PROMPT } from "../prompts/scenario_prompt.js";

const toStr = (x) => String(x ?? "");

const makeAutoVarFormula = (template) => {
  const vars = Array.from(toStr(template).matchAll(/\{\{([A-Z0-9_]+)\}\}/g)).map(m => m[0]);
  let f = `"${template}"`;
  for (const v of vars) {
    const idx = `INDEX(Variables!C:C, MATCH("${v}", Variables!A:A, 0))`;
    f = `SUBSTITUTE(${f}, "${v}", ${idx})`;
  }
  return f;
};

const parseKnowledgeBase = (rawText) => {
  const t = toStr(rawText);
  const start = t.indexOf("[KNOWLEDGE BASE]");
  const end = t.indexOf("[/KNOWLEDGE BASE]");
  if (start < 0 || end < 0 || end <= start) return [];
  const body = t.slice(start + "[KNOWLEDGE BASE]".length, end);
  const lines = body.split(/\r?\n/);
  const out = [];
  let q = "", a = "";
  for (const line of lines) {
    const s = String(line || "").trim();
    if (!s) continue;
    const mq = s.match(/^Q\s*:\s*(.+)/i);
    const ma = s.match(/^A\s*:\s*(.+)/i);
    if (mq) { if (q && a) { out.push({ q, a }); q = ""; a = ""; } q = mq[1].trim(); continue; }
    if (ma) { a = ma[1].trim(); continue; }
  }
  if (q && a) out.push({ q, a });
  return out;
};

const parseAutovars = (rawText) => {
  const t = toStr(rawText);
  const start = t.indexOf("[AUTOVARS]");
  const end = t.indexOf("[/AUTOVARS]");
  if (start < 0 || end < 0 || end <= start) return {};
  const body = t.slice(start + "[AUTOVARS]".length, end);
  const lines = body.split(/\r?\n/);
  const out = {};
  for (const line of lines) {
    const s = String(line || "").trim();
    if (!s) continue;
    const m = s.match(/^\{\{([A-Z0-9_]+)\}\}\s*:\s*(.+)$/);
    if (!m) continue;
    const key = `{{${m[1]}}}`;
    let val = m[2].trim();
    if (/^-?\d+(?:\.\d+)?$/.test(val)) val = Number(val);
    out[key] = val;
  }
  return out;
};

const defaultVariables = (assessment, provided) => {
  const base = {
    "{{COMPANY_NAME}}": toStr(assessment?.owner || assessment?.domain || ""),
    "{{SERVICE_NAME}}": toStr(assessment?.use_case_name || ""),
    "{{CHANNEL}}": "Telepon",
    "{{LATENCY_GOOD_SEC}}": 2,
    "{{LATENCY_MAX_SEC}}": 5,
    "{{NO_INTERACTION_WARNING_SEC}}": 15,
    "{{NO_INTERACTION_HANGUP_SEC}}": 45,
    "{{FALLBACK_MAX_TRIES}}": 2,
    "{{WAIT_INFO_SEC}}": 10,
    "{{WAIT_CODE_SEC}}": 25,
    "{{INGEST_LAG_SEC}}": 5,
    "{{OOT_DETECTION_RATE}}": 0.9,
    "{{NEG_SENTIMENT_ACCURACY}}": 0.85,
    "{{CODE_LENGTH}}": 8
  };
  const overrides = provided && typeof provided === "object" ? provided : {};
  return { ...base, ...overrides };
};

const writeVariablesSheet = (wb, vars) => {
  const ws = wb.addWorksheet("Variables");
  ws.columns = [
    { header: "Variable", key: "var", width: 28 },
    { header: "Deskripsi", key: "desc", width: 60 },
    { header: "Nilai", key: "val", width: 18 }
  ];
  const desc = {
    "{{COMPANY_NAME}}": "Nama perusahaan",
    "{{SERVICE_NAME}}": "Nama layanan",
    "{{CHANNEL}}": "Kanal layanan",
    "{{LATENCY_GOOD_SEC}}": "Latensi baik (detik)",
    "{{LATENCY_MAX_SEC}}": "Latensi maksimum (detik)",
    "{{NO_INTERACTION_WARNING_SEC}}": "Detik sebelum peringatan tidak ada interaksi",
    "{{NO_INTERACTION_HANGUP_SEC}}": "Detik sebelum auto hangup",
    "{{FALLBACK_MAX_TRIES}}": "Jumlah fallback maksimal",
    "{{WAIT_INFO_SEC}}": "Detik tunggu informasi singkat",
    "{{WAIT_CODE_SEC}}": "Detik tunggu informasi panjang/kode",
    "{{INGEST_LAG_SEC}}": "Lambat ingest (detik)",
    "{{OOT_DETECTION_RATE}}": "Akurasi deteksi OOT",
    "{{NEG_SENTIMENT_ACCURACY}}": "Akurasi deteksi sentimen negatif",
    "{{CODE_LENGTH}}": "Panjang kode"
  };
  for (const k of Object.keys(vars)) {
    ws.addRow({ var: k, desc: desc[k] || "", val: vars[k] });
  }
  return ws;
};

const writeReadmeSheet = (wb, vars) => {
  const ws = wb.addWorksheet("README");
  ws.columns = [ { header: "Kunci", key: "key", width: 24 }, { header: "Nilai", key: "val", width: 100 } ];
  ws.addRow({ key: "Judul", val: { formula: makeAutoVarFormula("{{SERVICE_NAME}} – Template Skenario Uji {{COMPANY_NAME}}") } });
  ws.addRow({ key: "Tanggal Dibuat", val: { formula: "NOW()" } });
  ws.addRow({ key: "Cara Pakai", val: { formula: makeAutoVarFormula("Instruksi penggunaan di kanal {{CHANNEL}}. Isi Variables dan ikuti Rubrik.") } });
  ws.addRow({ key: "Catatan", val: { formula: makeAutoVarFormula("Latensi baik ≤ {{LATENCY_GOOD_SEC}}s; maks {{LATENCY_MAX_SEC}}s; warning {{NO_INTERACTION_WARNING_SEC}}s; hangup {{NO_INTERACTION_HANGUP_SEC}}s") } });
  return ws;
};

const writeRubricSheet = (wb) => {
  const ws = wb.addWorksheet("Rubrik Scoring");
  ws.columns = [
    { header: "Aspek", key: "a", width: 26 },
    { header: "Definisi ukur", key: "d", width: 80 },
    { header: "Skor 5", key: "s5", width: 26 },
    { header: "Skor 4", key: "s4", width: 26 },
    { header: "Skor 3", key: "s3", width: 26 },
    { header: "Skor 2", key: "s2", width: 26 },
    { header: "Skor 1", key: "s1", width: 26 },
    { header: "Catatan Uji", key: "c", width: 40 }
  ];
  const rows = [
    ["Latency", makeAutoVarFormula("Respon ≤ {{LATENCY_MAX_SEC}}s"), "Sangat cepat", "Cepat", "Sedang", "Lambat", "Sangat lambat", ""],
    ["Memahami & Mengatasi OOT", makeAutoVarFormula("Deteksi OOT ≥ {{OOT_DETECTION_RATE}}"), "Deteksi & tangani sempurna", "Deteksi & tangani baik", "Deteksi sebagian", "Jarang terdeteksi", "Tidak terdeteksi", ""],
    ["Klarifikasi", "Klarifikasi tepat saat ambigu", "Sangat baik", "Baik", "Cukup", "Kurang", "Buruk", ""],
    ["Deteksi Bising", "Memahami meski ada noise", "Sangat baik", "Baik", "Cukup", "Kurang", "Buruk", ""],
    ["Putus Otomatis", makeAutoVarFormula("Hangup ≥ {{NO_INTERACTION_HANGUP_SEC}}s"), "Sangat tepat", "Tepat", "Cukup", "Kurang", "Buruk", ""],
    ["Fallback", makeAutoVarFormula("Maks {{FALLBACK_MAX_TRIES}} percobaan"), "Sangat natural", "Natural", "Cukup", "Kurang", "Buruk", ""],
    ["Sentiment", makeAutoVarFormula("Akurasi negatif ≥ {{NEG_SENTIMENT_ACCURACY}}"), "Sangat empatik", "Empatik", "Cukup", "Kurang", "Buruk", ""],
    ["Durasi Adaptif", makeAutoVarFormula("Tunggu hingga {{WAIT_CODE_SEC}} jika perlu"), "Sangat adaptif", "Adaptif", "Cukup", "Kurang", "Buruk", ""],
    ["Logging", "Percakapan & event terekam", "Lengkap", "Baik", "Cukup", "Kurang", "Buruk", ""],
  ];
  for (const r of rows) {
    const dVal = typeof r[1] === "string" && r[1].startsWith("SUBSTITUTE(") ? { formula: r[1] } : r[1];
    ws.addRow({ a: r[0], d: dVal, s5: r[2], s4: r[3], s3: r[4], s2: r[5], s1: r[6], c: r[7] });
  }
  return ws;
};

const parsePipeTableRows = (rawText) => {
  const lines = String(rawText || "").split(/\r?\n/);
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const t = String(lines[i] || "").trim();
    if (/^\|.+\|$/.test(t)) {
      const cells = t.replace(/^\|+|\|+$/g, "").split("|").map(s => String(s || "").trim().toLowerCase());
      if (cells.some(c => c.includes("aspek")) && cells.some(c => c.includes("pernyataan")) && cells.some(c => c.includes("ucapan")) && cells.some(c => c.includes("perilaku"))) {
        headerIdx = i; break;
      }
    }
  }
  if (headerIdx < 0) return [];
  const headerCells = lines[headerIdx].replace(/^\|+|\|+$/g, "").split("|").map(s => String(s || "").trim().toLowerCase());
  const idxOf = (kw) => headerCells.findIndex(c => c.includes(kw));
  const jNo = idxOf("no");
  const jAspek = idxOf("aspek");
  const jPern = idxOf("pernyataan");
  const jUcapan = idxOf("ucapan");
  const jPerilaku = idxOf("perilaku");
  const jTarget = idxOf("target");
  const jBukti = idxOf("bukti");
  const jCatatan = idxOf("catatan");
  const out = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const t = String(lines[i] || "").trim();
    if (!t || !/^\|.+\|$/.test(t)) break;
    if (/^\|\s*[-:]+/.test(t)) continue;
    const cells = t.replace(/^\|+|\|+$/g, "").split("|").map(s => String(s || "").trim());
    const get = (j) => (j >= 0 && j < cells.length) ? cells[j] : "";
    out.push({ no: get(jNo), aspek: get(jAspek), pernyataan: get(jPern), ucapan: get(jUcapan), perilaku: get(jPerilaku), target: get(jTarget), bukti: get(jBukti), catatan: get(jCatatan) });
  }
  return out;
};

const writeScenarioSheet = (wb, vars, kb, tableRows) => {
  const ws = wb.addWorksheet("Skenario Uji (Pelanggan)");
  ws.columns = [
    { header: "No", key: "A", width: 6 },
    { header: "Aspek", key: "B", width: 28 },
    { header: "Pernyataan", key: "C", width: 60 },
    { header: "Ucapan Pelanggan", key: "D", width: 48 },
    { header: "Perilaku yang Diharapkan", key: "E", width: 60 },
    { header: "Target Sederhana", key: "F", width: 40 },
    { header: "Bukti yang Dicek", key: "G", width: 44 },
    { header: "Catatan", key: "H", width: 30 },
    { header: "Skor (1–5)", key: "I", width: 16 }
  ];
  let rowNo = 1;
  const add = (aspect, stmt) => {
    const pernyataan = makeAutoVarFormula(stmt);
    const ucapan = pernyataan;
    const perilaku = makeAutoVarFormula("Bot merespons sesuai pernyataan");
    const target = makeAutoVarFormula("Tercapai sesuai definisi");
    const bukti = makeAutoVarFormula("Log/rekaman menunjukkan respons sesuai");
    ws.addRow({ A: rowNo++, B: aspect, C: { formula: pernyataan }, D: { formula: ucapan }, E: { formula: perilaku }, F: { formula: target }, G: { formula: bukti }, H: "", I: null });
  };
  add("Latency", "Bot merespons ≤ {{LATENCY_MAX_SEC}} detik.");
  add("Memahami & Mengatasi OOT", "OOT penuh → arahkan ke layanan {{COMPANY_NAME}}.");
  add("Memahami & Mengatasi OOT", "Tanya perusahaan lain → bot menjelaskan identitas.");
  add("Memahami & Mengatasi OOT", "OOT + nama perusahaan → akui konteks → arahkan ulang.");
  add("Memahami & Mengatasi OOT", "Penilaian negatif → respon empatik.");
  add("Klarifikasi", "Tidak lengkap → minta ulang.");
  add("Klarifikasi", "Ambigu → klarifikasi.");
  add("Klarifikasi", "Tidak sesuai pertanyaan → arahkan ulang kebutuhan.");
  add("Deteksi Bising", "Noise ringan/medium → tetap memahami.");
  add("Deteksi Bising", "Noise berat → edukasi atau minta ulang.");
  add("Putus Otomatis", "Diam → reminder.");
  add("Putus Otomatis", "Sedang mencari data → tunggu adaptif.");
  add("Putus Otomatis", "Diam ≥ {{NO_INTERACTION_HANGUP_SEC}} → hangup sopan.");
  add("Fallback", "Fallback natural.");
  add("Fallback", "Fallback ≥ {{FALLBACK_MAX_TRIES}} → handover/end-call.");
  add("Sentiment", "Deteksi emosi ≥ {{NEG_SENTIMENT_ACCURACY}}.");
  add("Sentiment", "Tone empatik.");
  add("Sentiment", "Jika frustasi berlanjut → handover.");
  add("Durasi Adaptif", "No-input setelah {{WAIT_INFO_SEC}}.");
  add("Durasi Adaptif", "Tunggu hingga {{WAIT_CODE_SEC}} untuk informasi panjang.");
  add("Durasi Adaptif", "User mencari data → bot menunggu.");
  add("Logging", "Percakapan tercatat lengkap.");
  add("Logging", "Event penting tercatat.");
  if (Array.isArray(kb) && kb.length) {
    for (const { q, a } of kb) {
      const pernyataan = makeAutoVarFormula(q);
      const perilaku = makeAutoVarFormula(a);
      const target = makeAutoVarFormula(a.length > 80 ? a.slice(0,80) : a);
      const bukti = makeAutoVarFormula("Respons bot sesuai jawaban yang diharapkan");
      ws.addRow({ A: rowNo++, B: "Knowledge Base", C: { formula: pernyataan }, D: { formula: pernyataan }, E: { formula: perilaku }, F: { formula: target }, G: { formula: bukti }, H: "", I: null });
    }
  }
  if (Array.isArray(tableRows) && tableRows.length) {
    for (const r of tableRows) {
      const noVal = Number(String(r.no || "").replace(/[^0-9]/g, "")) || rowNo;
      const B = String(r.aspek || "");
      const C = makeAutoVarFormula(String(r.pernyataan || ""));
      const D = makeAutoVarFormula(String(r.ucapan || ""));
      const E = makeAutoVarFormula(String(r.perilaku || ""));
      const F = makeAutoVarFormula(String(r.target || ""));
      const G = makeAutoVarFormula(String(r.bukti || ""));
      const H = String(r.catatan || "");
      ws.addRow({ A: noVal, B, C: { formula: C }, D: { formula: D }, E: { formula: E }, F: { formula: F }, G: { formula: G }, H, I: null });
      rowNo = Math.max(rowNo, noVal + 1);
    }
  }
  const last = ws.rowCount;
  ws.dataValidations.add(`I2:I${last}`, { type: "whole", operator: "between", showErrorMessage: true, formulae: [1, 5] });
  ws.addRow({ A: null, B: null, C: null, D: null, E: null, F: null, G: null, H: "total", I: { formula: `SUM(I2:I${last})` } });
  const avgRowIndex = ws.rowCount + 1;
  ws.addRow({ A: null, B: null, C: null, D: null, E: null, F: null, G: null, H: "avg_score", I: { formula: `AVERAGE(I2:I${last})` } });
  ws.addRow({ A: null, B: null, C: null, D: null, E: null, F: null, G: null, H: "Kesimpulan", I: { formula: `IF(I${avgRowIndex}>3,"Lulus","Gagal")` } });
  const aspects = ["Latency","Memahami & Mengatasi OOT","Klarifikasi","Deteksi Bising","Putus Otomatis","Fallback","Sentiment","Durasi Adaptif","Logging"]; 
  for (const ap of aspects) {
    const label = `avg_${ap.toLowerCase().replace(/[^a-z0-9]+/g,"_")}`;
    ws.addRow({ A: null, B: null, C: null, D: null, E: null, F: null, G: null, H: label, I: { formula: `AVERAGEIF(B2:B${last},"${ap}",I2:I${last})` } });
  }
  if (Array.isArray(kb) && kb.length) ws.addRow({ A: null, B: null, C: null, D: null, E: null, F: null, G: null, H: "avg_knowledge_base", I: { formula: `AVERAGEIF(B2:B${last},"Knowledge Base",I2:I${last})` } });
  return ws;
};

export const handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: "Method Not Allowed" }) };
    }
    let body = {};
    try { body = JSON.parse(event.body || "{}"); } catch { body = {}; }
    const assessment = body.assessment || {};
    if (!assessment || !assessment.use_case_name) {
      return { statusCode: 400, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: "Payload tidak valid. Sertakan 'assessment' dengan 'use_case_name'." }) };
    }
    const rawText = String(assessment.rawText || body.rawText || "");
    const autovars = parseAutovars(rawText);
    const variables = defaultVariables(assessment, { ...(body.variables || {}), ...autovars });
    const kb = parseKnowledgeBase(rawText);
    const tableRows = parsePipeTableRows(rawText);
    const wb = new ExcelJS.Workbook();
    wb.creator = toStr(assessment.owner || "");
    wb.created = new Date();
    writeReadmeSheet(wb, variables);
    writeVariablesSheet(wb, variables);
    writeRubricSheet(wb);
    writeScenarioSheet(wb, variables, kb, tableRows);
    const buf = await wb.xlsx.writeBuffer();
    const ts = new Date().toISOString().replace(/[:.-]/g, "").slice(0,15);
    const filename = `Scenario_Testing_${ts}.xlsx`;
    return {
      statusCode: 200,
      isBase64Encoded: true,
      headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${filename}"` },
      body: Buffer.from(buf).toString("base64")
    };
  } catch (err) {
    return { statusCode: 500, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: toStr(err?.message || err) }) };
  }
};
