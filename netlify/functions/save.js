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

    // Validasi minimal
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

    const clientEmail = (process.env.GOOGLE_CLIENT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "").trim();
    const privateKeyRaw = (process.env.GOOGLE_PRIVATE_KEY || process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || process.env.GOOGLE_PRIVATE_KEY_BASE64 || "").trim();
    const spreadsheetId = (process.env.GOOGLE_SHEETS_SPREADSHEET_ID || "").trim();
    const range = (process.env.GOOGLE_SHEETS_RANGE || "hasil_llm!A:H").trim();

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

    const values = [
      [
        a.timestamp,
        String(a.use_case_name),
        String(a.domain),
        Number(a.impact),
        Number(a.feasibility),
        Number(a.total),
        String(a.priority),
        String(a.rawText || ""),
      ],
    ];

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