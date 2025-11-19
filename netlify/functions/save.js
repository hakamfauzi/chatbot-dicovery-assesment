import { google } from "googleapis";

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const a = body.assessment || {};
    const devguideOnly = !!(body.devguide_only || a.devguide_only);

    const mode = String(body.mode || "").toLowerCase();
    const skipValidation = devguideOnly || mode === "update" || body.update === true || a.update === true;
    if (!skipValidation) {
      const required = [
        "use_case_name",
        "domain",
        "impact",
        "feasibility",
        "total",
        "priority",
        "timestamp",
      ];
      for (const k of required) {
        if (a[k] === undefined || a[k] === null || a[k] === "") {
          return {
            statusCode: 400,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: `Field '${k}' kosong atau tidak ditemukan.` }),
          };
        }
      }
    } else {
      if (!a.timestamp) a.timestamp = new Date().toISOString();
    }

    const clientEmail = (process.env.GOOGLE_CLIENT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "").trim();
    const privateKeyRaw = (process.env.GOOGLE_PRIVATE_KEY || process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || process.env.GOOGLE_PRIVATE_KEY_BASE64 || "").trim();
    const spreadsheetId = (process.env.GOOGLE_SHEETS_SPREADSHEET_ID || "").trim();
    const range = (process.env.GOOGLE_SHEETS_RANGE || "hasil_llm!A:Q").trim();

    if (!clientEmail || !privateKeyRaw || !spreadsheetId) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error:
            "Environment variables GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_SHEETS_SPREADSHEET_ID wajib di-set.",
        }),
      };
    }

    // Netlify menyimpan private key dengan \n, perlu diubah ke newline asli
    let pk = privateKeyRaw;
    // Decode base64 jika disediakan
    const looksBase64 = /^[A-Za-z0-9+/=]+$/.test(pk) && pk.length > 100 && pk.includes("=");
    if (looksBase64) {
      try { pk = Buffer.from(pk, 'base64').toString('utf8'); } catch {}
    }
    // Buang kutip pembuka/penutup jika ada
    if (pk.startsWith('"') && pk.endsWith('"')) {
      pk = pk.slice(1, -1);
    }
    // Ubah \n menjadi newline asli dan buang \r (Windows)
    const privateKey = pk.replace(/\\n/g, "\n").replace(/\r/g, "");

    const auth = new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    const toList = (x) => {
      if (Array.isArray(x)) return x.filter(Boolean).join(" | ");
      const s = String(x || "").trim();
      return s;
    };
    const parseListFromRaw = (raw, label) => {
      const t = String(raw || "");
      const idx = t.toLowerCase().indexOf(String(label || "").toLowerCase());
      if (idx < 0) return "";
      let rest = t.slice(idx + String(label || "").length);
      rest = rest.replace(/^\s*[:*]+\s*/, "");
      const lines = rest.split(/\n/);
      const out = [];
      const boundary = /^(Use\s*case|Domain|Impact|Feasibility|Total|Priority|Project\s*overview|Rekomendasi\s*jalur|Alasan\s*utama|Top\s*risks|Next\s*steps)\b/i;
      for (const line of lines) {
        const s = String(line || "").trim();
        if (!s) break;
        if (boundary.test(s)) break;
        if (/^\d+\./.test(s)) out.push(s.replace(/^\d+\.\s*/, ""));
        else if (/^[-•]/.test(s)) out.push(s.replace(/^[-•]\s*/, ""));
        else out.push(s);
      }
      return out.join(" | ");
    };
    const parseSingleFromRaw = (raw, label) => {
      const m = String(raw || "").match(new RegExp(`${label}[^:]*:\\s*(.+)`, "i"));
      return m ? String(m[1]).trim() : "";
    };

    const rekom = String(a.rekomendasi_jalur || parseSingleFromRaw(a.rawText, "Rekomendasi jalur"));
    const projectOverview = String(a.project_overview || parseSingleFromRaw(a.rawText, "Project overview"));
    const alasan = toList(a.alasan) || parseListFromRaw(a.rawText, "Alasan utama");
    const risk = toList(a.risk) || parseListFromRaw(a.rawText, "Top risks");
    const nextStep = toList(a.next_step) || parseListFromRaw(a.rawText, "Next steps");
    const modelId = String(a.model_id || a.model || "");
    const runId = String(a.run_id || `${Date.now()}_${Math.random().toString(36).slice(2,8)}`);
    const owner = String(a.owner || parseSingleFromRaw(a.rawText, "Owner") || (process.env.DEFAULT_OWNER || ""));

    const pick = (...vals) => {
      for (const v of vals) { const s = String(v || "").trim(); if (s) return s; }
      return "";
    };
    let devguideText = pick(a.devguide_text, a.devguideText, a.devguidetext, a.deguidetext);
    if (!devguideText) {
      const t = String(a.rawText || "");
      const single = parseSingleFromRaw(t, "Developer guide");
      if (single) devguideText = single;
      if (!devguideText) {
      const idx = t.toLowerCase().indexOf("**developer guide**".toLowerCase());
      if (idx >= 0) {
        let rest = t.slice(idx + "**developer guide**".length);
        const lines = rest.split(/\n/);
        const out = [];
        const boundary = /^(\*\*|Use\s*case|Domain|Impact|Feasibility|Total|Priority|Project\s*overview|Rekomendasi\s*jalur|Alasan\s*utama|Top\s*risks|Next\s*steps)/i;
        for (const line of lines) {
          const s = String(line || "").trim();
          if (!s) { if (out.length) break; else continue; }
          if (boundary.test(s)) break;
          out.push(s);
        }
        devguideText = out.join("\n");
      }
      }
    }
    const rawTextWithDev = String(a.rawText || "");

    const values = [
      [
        a.timestamp,
        String(a.use_case_name || ""),
        String(a.domain || ""),
        a.impact != null ? Number(a.impact) : "",
        a.feasibility != null ? Number(a.feasibility) : "",
        a.total != null ? Number(a.total) : "",
        String(a.priority || ""),
        rekom,
        alasan,
        risk,
        nextStep,
        projectOverview,
        rawTextWithDev,
        modelId,
        runId,
        owner,
        devguideText,
      ],
    ];

    const wantsUpdate = skipValidation;
    if (wantsUpdate) {
      try {
        const respGet = await sheets.spreadsheets.values.get({ spreadsheetId, range });
        const rows = Array.isArray(respGet?.data?.values) ? respGet.data.values : [];
        let targetRow = -1;
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i] || [];
          const s0 = String(row[0] || "").trim().toLowerCase();
          const s1 = String(row[1] || "").trim().toLowerCase();
          const s2 = String(row[2] || "").trim().toLowerCase();
          const isHeader = (s0 === "timestamp" && s1 === "use_case_name" && s2 === "domain");
          if (isHeader) continue;
          const byRun = !!a.run_id && String(row[14] || "").trim() === String(a.run_id || "").trim();
          const byUC = !!a.use_case_name && s1 === String(a.use_case_name || "").trim().toLowerCase();
          const byDom = !!a.domain && s2 === String(a.domain || "").trim().toLowerCase();
          const byTs = !!a.timestamp && String(row[0] || "").trim() === String(a.timestamp || "").trim();
          if (byRun || (byUC && byDom) || byTs) { targetRow = i + 1; break; }
        }
        if (targetRow > 0) {
          const sheetName = range.includes("!") ? range.split("!")[0] : "Sheet1";
          const updRange = `${sheetName}!Q${targetRow}`;
          const respU = await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: updRange,
            valueInputOption: "USER_ENTERED",
            requestBody: { values: [[devguideText]] },
          });
          const updatedRange = respU?.data?.updatedRange || updRange;
          return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ok: true, range: updatedRange, updated: 1 }),
          };
        }
      } catch {}
    }

    const resp = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values },
    });

    const updatedRange = resp?.data?.updates?.updatedRange || range;

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: true,
        range: updatedRange,
        written: values[0].length,
      }),
    };
  } catch (err) {
    console.error("Save function error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Gagal menyimpan ke Google Sheets.",
        details:
          (err && err.response && err.response.data && err.response.data.error && err.response.data.error.message) ||
          err?.message || String(err),
      }),
    };
  }
};