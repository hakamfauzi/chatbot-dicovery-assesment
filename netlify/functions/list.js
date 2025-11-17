import { google } from "googleapis";

export const handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  try {
    const clientEmail = (process.env.GOOGLE_CLIENT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "").trim();
    const privateKeyRaw = (process.env.GOOGLE_PRIVATE_KEY || process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || process.env.GOOGLE_PRIVATE_KEY_BASE64 || "").trim();
    const spreadsheetId = (process.env.GOOGLE_SHEETS_SPREADSHEET_ID || "").trim();
    let range = (process.env.GOOGLE_SHEETS_RANGE || "hasil_llm!A:H").trim();
    const qs = event.queryStringParameters || {};
    const tab = (qs.tab || "").trim().toLowerCase();
    const rangeParam = (qs.range || "").trim();
    if (rangeParam) range = rangeParam;
    else if (tab === "pertanyaan") range = "pertanyaan!A:C";

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

    let pk = privateKeyRaw;
    const looksBase64 = /^[A-Za-z0-9+/=]+$/.test(pk) && pk.length > 100 && pk.includes("=");
    if (looksBase64) {
      try { pk = Buffer.from(pk, 'base64').toString('utf8'); } catch {}
    }
    if (pk.startsWith('"') && pk.endsWith('"')) {
      pk = pk.slice(1, -1);
    }
    const privateKey = pk.replace(/\\n/g, "\n").replace(/\r/g, "");

    const auth = new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const values = resp?.data?.values || [];
    let items;
    if (tab === "pertanyaan" || String(range).toLowerCase().startsWith("pertanyaan!")) {
      const isHeader = (r) => {
        const c0 = String(r[0] || "").trim().toLowerCase();
        const c1 = String(r[1] || "").trim().toLowerCase();
        const c2 = String(r[2] || "").trim().toLowerCase();
        return c0 === "no" || c1 === "pertanyaan" || c2 === "kategori";
      };
      items = values
        .filter((row) => row && (row[1] || row[2]))
        .filter((row) => !isHeader(row))
        .map((row) => ({
          no: row[0] || null,
          question: row[1] || null,
          category: row[2] || null,
        }));
    } else {
      items = values.map((row) => {
        const impact = row[3] != null ? parseFloat(String(row[3]).replace(",", ".")) : null;
        const feasibility = row[4] != null ? parseFloat(String(row[4]).replace(",", ".")) : null;
        const total = row[5] != null ? parseFloat(String(row[5]).replace(",", ".")) : null;
        return {
          timestamp: row[0] || null,
          use_case_name: row[1] || null,
          domain: row[2] || null,
          impact,
          feasibility,
          total,
          priority: row[6] || null,
          rawText: row[7] || null,
        };
      });
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, range, count: items.length, items }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Gagal membaca dari Google Sheets.",
        details:
          (err && err.response && err.response.data && err.response.data.error && err.response.data.error.message) ||
          err?.message || String(err),
      }),
    };
  }
};