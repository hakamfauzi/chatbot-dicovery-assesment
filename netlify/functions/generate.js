import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

export const handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Method Not Allowed" })
      };
    }
    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      body = {};
    }

    const format = String(body.format || "pdf").toLowerCase();
    const includeQna = !!body.include_qna;
    const includeDevguide = !!body.include_devguide;
    const profile = body.project_profile || {};
    const assessment = body.assessment || {};
    const rawText = String(assessment.rawText || body.rawText || "");
    const conversation = Array.isArray(body.conversation) ? body.conversation : [];

    const useCase = String(assessment.use_case_name || profile.name || "").trim() || "Tidak disebut";
    const domain = String(assessment.domain || profile.domain || "").trim() || "Tidak disebut";
    const impact = Number(assessment.impact ?? 0);
    const feasibility = Number(assessment.feasibility ?? 0);
    const total = Number(assessment.total ?? 0);
    const priority = String(assessment.priority || "").trim() || "Tidak disebut";
    const recommendedPathMatch = rawText.match(/Rekomendasi\s*jalur:\s*([^\n]+)/i);
    const recommendedPath = recommendedPathMatch ? recommendedPathMatch[1].trim() : "";

    const parseList = (text, headerRe) => {
      const t = String(text || "");
      const m = t.match(headerRe);
      if (!m) return [];
      const idx = m.index + m[0].length;
      const rest = t.slice(idx);
      const lines = rest.split(/\n/);
      const out = [];
      for (const line of lines) {
        const s = String(line || "").trim();
        if (!s) break;
        if (/^\d+\./.test(s)) out.push(s.replace(/^\d+\.\s*/, ""));
        else if (/^[-•]/.test(s)) out.push(s.replace(/^[-•]\s*/, ""));
        else break;
      }
      return out;
    };

    const reasons = parseList(rawText, /\*\*Alasan utama[^\n]*\*\*/i);
    const risksBlock = parseList(rawText, /\*\*Top risks[^\n]*\*\*/i);
    const nextSteps = parseList(rawText, /\*\*Next steps[^\n]*\*\*/i);

    const extractQna = (conv) => {
      const out = [];
      for (let i = 0; i < conv.length; i++) {
        const m = conv[i];
        const t = String(m?.text || "");
        const q = t.match(/Q\s*(\d+)\s*\/\s*(\d+)\s*:\s*(.+)/i);
        if (m.role === "assistant" && q) {
          const num = parseInt(q[1], 10);
          const question = q[3].trim();
          let answer = "";
          for (let j = i + 1; j < conv.length; j++) {
            if (conv[j].role === "user") {
              answer = String(conv[j].text || "").trim();
              break;
            }
          }
          out.push({ number: num, question, answer });
        }
      }
      return out;
    };

    const qna = includeQna ? extractQna(conversation) : [];

    const quadrantSvg = (() => {
      const w = 600;
      const h = 400;
      const pxX = Math.max(0, Math.min(w - 40, Math.round((feasibility / 100) * (w - 80)) + 40));
      const pxY = Math.max(0, Math.min(h - 40, Math.round((100 - impact) / 100 * (h - 80)) + 40));
      return `
        <svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
          <rect x="40" y="40" width="${w - 80}" height="${h - 80}" fill="#fafafa" stroke="#ccc"/>
          <line x1="40" y1="${h - 40}" x2="${w - 40}" y2="${h - 40}" stroke="#666"/>
          <line x1="40" y1="40" x2="40" y2="${h - 40}" stroke="#666"/>
          <text x="${w / 2}" y="${h - 10}" font-size="12" text-anchor="middle">Feasibility</text>
          <text x="15" y="${h / 2}" font-size="12" transform="rotate(-90 15,${h / 2})" text-anchor="middle">Impact</text>
          <circle cx="${pxX}" cy="${pxY}" r="6" fill="#2e7d32" stroke="#1b5e20"/>
          <text x="${pxX + 8}" y="${pxY - 8}" font-size="12">${useCase}</text>
        </svg>
      `;
    })();

    const style = `
      <style>
        body { font-family: Arial, Calibri, sans-serif; color: #222; }
        h1, h2, h3 { color: #0d47a1; }
        .section { page-break-inside: avoid; margin-bottom: 16px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .kv { display: grid; grid-template-columns: 180px 1fr; gap: 8px; }
        .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; background: #e3f2fd; color: #0d47a1; }
        .table { width: 100%; border-collapse: collapse; }
        .table th, .table td { border: 1px solid #ddd; padding: 6px; font-size: 11px; }
        .small { font-size: 11px; color: #555; }
        .footer { position: fixed; bottom: 0; width: 100%; text-align: center; font-size: 10px; color: #777; }
      </style>
    `;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8"/>
        ${style}
        <title>Dokumen Use Case</title>
      </head>
      <body>
        <h1>Dokumen Use Case</h1>
        <div class="section">
          <h2>Project Profile</h2>
          <div class="kv"><div>Nama proyek</div><div>${useCase}</div></div>
          <div class="kv"><div>Deskripsi</div><div>${String(profile.description || "Tidak disebut")}</div></div>
          <div class="kv"><div>Tujuan</div><div>${Array.isArray(profile.goals) ? profile.goals.map(x=>`• ${x}`).join("<br>") : "Tidak disebut"}</div></div>
          <div class="kv"><div>Lingkup</div><div>${String(profile.scope || "Tidak disebut")}</div></div>
          <div class="kv"><div>Stakeholder</div><div>${Array.isArray(profile.stakeholders) ? profile.stakeholders.map(x=>`• ${x}`).join("<br>") : "Tidak disebut"}</div></div>
          <div class="kv"><div>Timeline</div><div>${String(profile.timeline || "Tidak disebut")}</div></div>
          <div class="kv"><div>Anggaran</div><div>${String(profile.budget || "Tidak disebut")}</div></div>
          <div class="kv"><div>Sumber daya</div><div>${String(profile.resources || "Tidak disebut")}</div></div>
        </div>

        <div class="section">
          <h2>Project Determine (Quadrant)</h2>
          <div class="kv"><div>Domain</div><div>${domain}</div></div>
          <div class="kv"><div>Impact</div><div>${impact}</div></div>
          <div class="kv"><div>Feasibility</div><div>${feasibility}</div></div>
          <div class="kv"><div>Total</div><div>${total} <span class="badge">${priority}</span></div></div>
          <div>${quadrantSvg}</div>
          <div class="section">
            <h3>Interpretasi</h3>
            <div class="small">${recommendedPath || ""}</div>
          </div>
        </div>

        <div class="section">
          <h2>Project Solution</h2>
          <div class="grid">
            <div>
              <h3>Alasan utama</h3>
              <ul>${reasons.map(x=>`<li>${x}</li>`).join("") || "<li>Tidak disebut</li>"}</ul>
            </div>
            <div>
              <h3>Next steps</h3>
              <ul>${nextSteps.map(x=>`<li>${x}</li>`).join("") || "<li>Tidak disebut</li>"}</ul>
            </div>
          </div>
          <h3>Top risks & mitigasi</h3>
          <ul>${risksBlock.map(x=>`<li>${x}</li>`).join("") || "<li>Tidak disebut</li>"}</ul>
        </div>

        <div class="section">
          <h2>Project Flow</h2>
          <div class="small">Flowchart dan Gantt akan ditambahkan sesuai data.</div>
        </div>

        <div class="section">
          <h2>Bagian Pendukung</h2>
          <div class="grid">
            <div>
              <h3>Lampiran</h3>
              <div class="small">Data mentah, kuesioner, hasil wawancara.</div>
            </div>
            <div>
              <h3>Referensi</h3>
              <div class="small">Sumber data dan sitasi.</div>
            </div>
          </div>
          <div class="grid">
            <div>
              <h3>Glosarium</h3>
              <div class="small">Istilah teknis.</div>
            </div>
            <div>
              <h3>Kontak</h3>
              <div class="small">Struktur tim dan kontak.</div>
            </div>
          </div>
          <div>
            <h3>Pengesahan</h3>
            <div class="small">Halaman tanda tangan.</div>
          </div>
        </div>

        ${includeQna ? `<div class="section"><h2>Lampiran QnA</h2>${qna.length ? `<ol>${qna.map(x=>`<li><div><b>Q${x.number}</b>: ${x.question}</div><div>Jawaban: ${x.answer || ""}</div></li>`).join("")}</ol>` : `<div class="small">Tidak ada.</div>`}</div>` : ""}

        ${includeDevguide && body.devguide_text ? `<div class="section"><h2>Developer Guide</h2><div>${String(body.devguide_text || "").replace(/</g, "&lt;")}</div></div>` : ""}

        <div class="footer">Dokumen internal</div>
      </body>
      </html>
    `;

    if (format === "html") {
      return {
        statusCode: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
        body: html
      };
    }

    if (format === "docx") {
      return {
        statusCode: 501,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "DOCX belum didukung" })
      };
    }

    let execPath;
    try { execPath = await chromium.executablePath(); } catch (_) {
      execPath = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
    }
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: execPath,
      headless: true
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({ format: "A4", printBackground: true, margin: { top: "20mm", bottom: "15mm", left: "15mm", right: "15mm" }, displayHeaderFooter: true, headerTemplate: "<span></span>", footerTemplate: "<div style=\"font-size:10px; width:100%; text-align:center;\"><span class=\"pageNumber\"></span> / <span class=\"totalPages\"></span></div>" });
    await browser.close();

    const filename = `Usecase_${useCase.replace(/[^a-z0-9]+/gi,'_')}.pdf`;
    return {
      statusCode: 200,
      isBase64Encoded: true,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`
      },
      body: Buffer.from(pdf).toString("base64")
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: String(err?.message || err) })
    };
  }
};