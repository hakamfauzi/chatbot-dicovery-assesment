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
    const timestamp = String(body.timestamp || "").trim();
    const useCase = String(body.use_case_name || "").trim();
    if (!timestamp || !useCase) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Field 'timestamp' dan 'use_case_name' wajib diisi." }),
      };
    }

    const clientEmail = (process.env.GOOGLE_CLIENT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "").trim();
    const privateKeyRaw = (process.env.GOOGLE_PRIVATE_KEY || process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || process.env.GOOGLE_PRIVATE_KEY_BASE64 || "").trim();
    const spreadsheetId = (process.env.GOOGLE_SHEETS_SPREADSHEET_ID || "").trim();
    const rangeEnv = (process.env.GOOGLE_SHEETS_RANGE || "hasil_llm!A:N").trim();
    const sheetTitle = String(rangeEnv.split("!")[0] || "hasil_llm").trim();

    if (!clientEmail || !privateKeyRaw || !spreadsheetId) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "Environment variables GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_SHEETS_SPREADSHEET_ID wajib di-set.",
        }),
      };
    }

    let pk = privateKeyRaw;
    const looksBase64 = /^[A-Za-z0-9+/=]+$/.test(pk) && pk.length > 100 && pk.includes("=");
    if (looksBase64) { try { pk = Buffer.from(pk, "base64").toString("utf8"); } catch {} }
    if (pk.startsWith('"') && pk.endsWith('"')) { pk = pk.slice(1, -1); }
    const privateKey = pk.replace(/\\n/g, "\n").replace(/\r/g, "");

    const auth = new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const sheet = (meta?.data?.sheets || []).find((s) => String(s?.properties?.title || "") === sheetTitle);
    if (!sheet) {
      return { statusCode: 400, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: `Sheet '${sheetTitle}' tidak ditemukan.` }) };
    }
    const sheetId = Number(sheet.properties.sheetId);

    const range = `${sheetTitle}!A:N`;
    const resp = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    const rows = resp?.data?.values || [];

    let targetIndex = -1; // index dalam array values (0-based)
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] || [];
      const ts = String(row[0] || "").trim();
      const uc = String(row[1] || "").trim();
      if (ts === timestamp && uc === useCase) { targetIndex = i; break; }
    }

    if (targetIndex < 0) {
      return { statusCode: 404, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: "Baris tidak ditemukan untuk dihapus." }) };
    }

    const startIndex = targetIndex; // 0-based, termasuk header bila ada
    const endIndex = startIndex + 1;

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: { sheetId, dimension: "ROWS", startIndex, endIndex },
            },
          },
        ],
      },
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, sheet: sheetTitle, deletedRowNumber: startIndex + 1 }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Gagal menghapus dari Google Sheets.", details: err?.message || String(err) }),
    };
  }
};

