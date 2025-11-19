import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, AlignmentType, WidthType, Header, Footer, PageNumber, ExternalHyperlink, ImageRun } from "docx";

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
    const includeDevguide = format === "pdf" ? true : !!body.include_devguide;
    const profile = body.project_profile || {};
    const assessment = body.assessment || {};
    const rawText = String(assessment.rawText || body.rawText || "");
    const conversation = Array.isArray(body.conversation) ? body.conversation : [];
    const devguideText = (() => {
      const t = String(body.devguide_text || "");
      if (t.trim()) return t;
      const conv = Array.isArray(conversation) ? conversation : [];
      if (conv.length) {
        for (let i = conv.length - 1; i >= 0; i--) {
          const m = conv[i];
          const s = String(m?.text || "");
          if (m.role === "user" && /\b\/devguide\b/i.test(s)) {
            for (let j = i + 1; j < conv.length; j++) {
              const a = conv[j];
              if (a.role === "assistant") {
                const r = String(a?.text || "");
                if (r.trim()) return r;
                break;
              }
            }
            break;
          }
        }
        const aa = [...conv].reverse().find(x => x.role === "assistant" && /developer guide/i.test(String(x?.text || "")));
        if (aa) return String(aa.text || "");
      }
      const fromRaw = (() => {
        const t = String(rawText || "");
        const idx = t.toLowerCase().indexOf("**developer guide**".toLowerCase());
        if (idx < 0) return "";
        const rest = t.slice(idx + "**developer guide**".length);
        const lines = rest.split(/\n/);
        const out = [];
        const boundary = /^(\*\*|Use\s*case|Domain|Impact|Feasibility|Total|Priority|Project\s*overview|Rekomendasi\s*jalur|Alasan\s*utama|Top\s*risks|Next\s*steps)/i;
        for (const line of lines) {
          const s = String(line || "").trim();
          if (!s) break;
          if (boundary.test(s)) break;
          out.push(s);
        }
        return out.join("\n");
      })();
      if (fromRaw.trim()) return fromRaw;
      return "";
    })();

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
      const w = 520;
      const h = 220;
      const pxX = Math.max(0, Math.min(w - 40, Math.round((feasibility / 100) * (w - 80)) + 40));
      const pxY = Math.max(0, Math.min(h - 40, Math.round((100 - impact) / 100 * (h - 80)) + 40));
      return `
        <svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
          <rect x="40" y="40" width="${w - 80}" height="${h - 80}" fill="#f5f7fb" stroke="#cbd5e1"/>
          <line x1="40" y1="${h - 40}" x2="${w - 40}" y2="${h - 40}" stroke="#64748b"/>
          <line x1="40" y1="40" x2="40" y2="${h - 40}" stroke="#64748b"/>
          <text x="${w / 2}" y="${h - 12}" font-size="12" text-anchor="middle" fill="#334155">Feasibility</text>
          <text x="18" y="${h / 2}" font-size="12" transform="rotate(-90 18,${h / 2})" text-anchor="middle" fill="#334155">Impact</text>
          <circle cx="${pxX}" cy="${pxY}" r="6" fill="#0ea5e9" stroke="#0284c7"/>
          <text x="${pxX + 8}" y="${pxY - 8}" font-size="12" fill="#0f172a">${useCase}</text>
        </svg>
      `;
    })();

    const monthTotals = (() => {
      const t = Math.max(0, total || 0);
      const m1 = Math.round(t * 0.45);
      const m2 = Math.round(t * 0.35);
      const m3 = Math.max(0, t - m1 - m2);
      return [m1, m2, m3];
    })();

    const financeSvg = (() => {
      const w = 520;
      const h = 220;
      const padding = 40;
      const barW = 100;
      const gap = 40;
      const maxVal = Math.max(...monthTotals, 1);
      const scale = (h - padding * 1.2) / maxVal;
      const colors = { tech: "#1976d2", server: "#26a69a", other: "#90caf9" };
      const partsFor = (val) => {
        const tech = Math.round(val * 0.5);
        const server = Math.round(val * 0.3);
        const other = Math.max(0, val - tech - server);
        return { tech, server, other };
      };
      const bars = monthTotals.map((v, i) => {
        const x = padding + i * (barW + gap);
        const yBase = h - padding;
        const p = partsFor(v);
        const hTech = Math.round(p.tech * scale), hServer = Math.round(p.server * scale), hOther = Math.round(p.other * scale);
        const rOther = `<rect x="${x}" y="${yBase - hOther}" width="${barW}" height="${hOther}" fill="${colors.other}"/>`;
        const rServer = `<rect x="${x}" y="${yBase - hOther - hServer}" width="${barW}" height="${hServer}" fill="${colors.server}"/>`;
        const rTech = `<rect x="${x}" y="${yBase - hOther - hServer - hTech}" width="${barW}" height="${hTech}" fill="${colors.tech}"/>`;
        const label = `<text x="${x + barW / 2}" y="${yBase - Math.max(hTech + hServer + hOther, 6) - 6}" font-size="12" text-anchor="middle" fill="#0f172a">${v}</text>`;
        const month = ["Month 1", "Month 2", "Month 3"][i];
        const xLabel = `<text x="${x + barW / 2}" y="${yBase + 16}" font-size="12" text-anchor="middle" fill="#334155">${month}</text>`;
        return `${rOther}${rServer}${rTech}${label}${xLabel}`;
      }).join("");
      const axis = `<line x1="${padding - 10}" y1="${h - padding}" x2="${w - padding + 10}" y2="${h - padding}" stroke="#64748b"/>`;
      const legend = `
        <rect x="${w - 300}" y="10" width="12" height="12" fill="${colors.tech}"/>
        <text x="${w - 282}" y="20" font-size="12" fill="#334155">Technical Supplies</text>
        <rect x="${w - 180}" y="10" width="12" height="12" fill="${colors.server}"/>
        <text x="${w - 162}" y="20" font-size="12" fill="#334155">Server Costs</text>
        <rect x="${w - 80}" y="10" width="12" height="12" fill="${colors.other}"/>
        <text x="${w - 62}" y="20" font-size="12" fill="#334155">Other</text>
      `;
      return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">${bars}${axis}${legend}</svg>`;
    })();

    const months = ["March","April","May","June","July"];
    const deliverables = ["Technical Interpretation","Engineering Report","Resource Availability Report","Server Replacement"];
    const timelineHtml = (() => {
      const head = `<tr><th>Project Deliverable</th>${months.map(m=>`<th>${m}</th>`).join("")}</tr>`;
      const rows = deliverables.map(d => `<tr><td>${d}</td>${months.map(()=>`<td>○</td>`).join("")}</tr>`).join("");
      return `<table class="table tight">${head}${rows}</table>`;
    })();

    const style = `
      <style>
        body { font-family: Calibri, Arial, sans-serif; color: #0f172a; }
        .header { background: #0d47a1; color: #fff; padding: 16px 20px; }
        .header h1 { margin: 0; font-size: 24px; }
        .sub { margin-top: 6px; font-size: 12px; opacity: 0.9; }
        .header-row { display: grid; grid-template-columns: 1fr 80px; align-items: center; }
        .logo { width: 64px; height: 64px; border-radius: 50%; background: #fff; color: #0d47a1; display:flex; align-items:center; justify-content:center; font-weight:700; }
        .topbar { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: #e5efff; padding: 8px 20px; font-size: 12px; }
        .topbar .right { text-align: right; }
        .section-title { background: #e5efff; color: #0d47a1; padding: 10px 12px; font-weight: 700; border-left: 4px solid #0d47a1; }
        .content { padding: 18px 20px; }
        .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .kv { display: grid; grid-template-columns: 180px 1fr; gap: 6px; }
        .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; background: #e3f2fd; color: #0d47a1; }
        .table { width: 100%; border-collapse: collapse; }
        .table.tight th, .table.tight td { border: 1px solid #cbd5e1; padding: 6px; font-size: 11px; }
        .table th { background: #eef2ff; text-align: left; }
        ul { margin: 8px 0 0 18px; }
        .small { font-size: 11px; color: #475569; }
        .footer { position: fixed; bottom: 0; width: 100%; text-align: center; font-size: 10px; color: #64748b; }
        .md h1, .md h2, .md h3 { margin: 6px 0; color: #0d47a1; }
        .md p { margin: 6px 0; line-height: 1.5; }
        .md ul, .md ol { margin: 6px 0 6px 18px; }
        .md code { background: #eef2ff; padding: 1px 3px; border-radius: 3px; }
        .md pre { background: #f8fafc; padding: 10px; border: 1px solid #e2e8f0; overflow: auto; }
        .md table { width: 100%; border-collapse: collapse; }
        .md table th, .md table td { border: 1px solid #cbd5e1; padding: 6px; font-size: 11px; }
        .md table th { background: #eef2ff; text-align: left; }
      </style>
    `;

    const mdToHtml = (text) => {
      const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\*(.+?)\*/g, "<i>$1</i>").replace(/`([^`]+?)`/g, "<code>$1</code>");
      const lines = String(text || "").split(/\r?\n/);
      let out = [], inUl = false, inOl = false, inCode = false, inTable = false, tableRows = [];
      const isTableLine = (t) => /^\s*\|.*\|\s*$/.test(String(t || ""));
      const isSepLine = (t) => /^\s*\|(?:\s*:?-+:?\s*\|)+\s*$/.test(String(t || ""));
      const flushLists = () => { if (inUl) { out.push("</ul>"); inUl = false; } if (inOl) { out.push("</ol>"); inOl = false; } };
      const flushTable = () => {
        if (!tableRows.length) { inTable = false; return; }
        const header = tableRows.length > 1 && isSepLine(tableRows[1]) ? tableRows[0] : null;
        const body = header ? tableRows.slice(2) : tableRows.slice(0);
        const parseCells = (line) => String(line || "").trim().replace(/^\|+|\|+$/g, "").split("|").map((c) => inline(String(c || "").trim()));
        let html = `<table class="md-table">`;
        if (header) {
          const ths = parseCells(header).map((c) => `<th>${c}</th>`).join("");
          html += `<thead><tr>${ths}</tr></thead>`;
        }
        html += `<tbody>`;
        html += body.filter((row) => !isSepLine(row)).map((row) => {
          const tds = parseCells(row).map((c) => `<td>${c}</td>`).join("");
          return `<tr>${tds}</tr>`;
        }).join("");
        html += `</tbody></table>`;
        out.push(html);
        tableRows = []; inTable = false;
      };
      for (let i = 0; i < lines.length; i++) {
        const raw = lines[i];
        const t = String(raw || "");
        const trim = t.trim();
        if (/^```/.test(trim)) { if (!inCode) { inCode = true; out.push("<pre><code>"); } else { inCode = false; out.push("</code></pre>"); } continue; }
        if (inCode) { out.push(esc(t)); continue; }
        if (isTableLine(t)) { if (!inTable) { flushLists(); inTable = true; tableRows = []; } tableRows.push(t); continue; }
        if (inTable && !isTableLine(t)) { flushTable(); }
        if (/^\s*[-•]\s+/.test(t)) { if (!inUl) { if (inOl) { out.push("</ol>"); inOl = false; } inUl = true; out.push("<ul>"); } out.push("<li>" + inline(t.replace(/^\s*[-•]\s+/, "")) + "</li>"); continue; }
        if (/^\s*\d+\.\s+/.test(t)) { if (!inOl) { if (inUl) { out.push("</ul>"); inUl = false; } inOl = true; out.push("<ol>"); } out.push("<li>" + inline(t.replace(/^\s*\d+\.\s+/, "")) + "</li>"); continue; }
        flushLists();
        const h = trim.match(/^#{1,4}\s+(.*)$/);
        if (h) { const lvl = (trim.match(/^#{1,4}/)[0].length); out.push(`<h${lvl}>${inline(h[1])}</h${lvl}>`); continue; }
        if (/^\s*---\s*$/.test(trim)) { out.push("<hr/>"); continue; }
        if (trim) out.push("<p>" + inline(trim) + "</p>");
      }
      flushLists();
      if (inTable) flushTable();
      return out.join("");
    };

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8"/>
        ${style}
        <title>Executive Summary</title>
      </head>
      <body>
        <div class="header">
          <div class="header-row">
            <div>
              <h1>Executive Summary of a Project Report</h1>
              <div class="sub">Ringkasan satu halaman mencakup judul proyek, detail proyek, pencapaian, gambaran finansial, timeline deliverable, dan risiko utama.</div>
            </div>
            <div class="logo">Logo</div>
          </div>
        </div>
        <div class="topbar">
          <div>Project Title: ${useCase}</div>
          <div class="right">Address: ${String(profile.address || "")} · Email: ${String(profile.email || "")} · Website: ${String(profile.website || "")}</div>
        </div>
        <div class="content">
          <div class="section-title">Project Overview</div>
          <ul>${[...reasons.slice(0,3), recommendedPath ? `Rekomendasi: ${recommendedPath}` : ""].filter(Boolean).map(x=>`<li>${x}</li>`).join("") || "<li>Tidak disebut</li>"}</ul>

          <div style="margin-top:12px" class="section-title">Project Details</div>
          <table class="table tight">
            <tr><th>Project Name</th><td>${useCase}</td><th>Project Number</th><td>${String(profile.project_number || "—")}</td></tr>
            <tr><th>Project Sponsor</th><td>${String(profile.sponsor || domain || "—")}</td><th>Project Owner</th><td>${String(profile.owner || "—")}</td></tr>
            <tr><th>Program Manager</th><td>${String(profile.program_manager || "—")}</td><th>Project Manager</th><td>${String(profile.project_manager || "—")}</td></tr>
            <tr><th>Completed by</th><td>${String(profile.completed_by || "—")}</td><th>Priority</th><td><span class="badge">${priority}</span></td></tr>
          </table>

          <div style="margin-top:12px" class="section-title">Key Accomplishments</div>
          <div class="grid2">
            <div>
              <div style="font-weight:700; margin-bottom:6px">Current Period</div>
              <ul>${reasons.map(x=>`<li>${x}</li>`).join("") || "<li>Tidak disebut</li>"}</ul>
            </div>
            <div>
              <div style="font-weight:700; margin-bottom:6px">Planned for next period</div>
              <ul>${nextSteps.map(x=>`<li>${x}</li>`).join("") || "<li>Tidak disebut</li>"}</ul>
            </div>
          </div>

          <div style="margin-top:12px" class="section-title">Financial Overview of the Project</div>
          <div class="small">Total Project Cost Split (estimasi)</div>
          <div style="margin-top:8px">${financeSvg}</div>

          <div style="margin-top:12px" class="section-title">Project Deliverable Timeline</div>
          ${timelineHtml}

          <div style="margin-top:12px" class="section-title">Key Risks</div>
          <table class="table tight">
            <tr><th>Risk</th><th>Response</th><th>Date Identified</th><th>Status</th><th>Owner</th></tr>
            ${(() => {
              const todayStr = new Date().toLocaleDateString('id-ID');
              if (!risksBlock.length) return `<tr><td colspan="5" class="small">Tidak disebut</td></tr>`;
              return risksBlock.map(r => `<tr><td>${r}</td><td>Mitigasi direncanakan</td><td>${todayStr}</td><td>Open</td><td>${String(profile.project_manager || profile.owner || "—")}</td></tr>`).join("");
            })()}
          </table>
        </div>

        ${includeQna ? `<div class="content"><div class="section-title">Lampiran QnA</div>${qna.length ? `<ol>${qna.map(x=>`<li><div><b>Q${x.number}</b>: ${x.question}</div><div>Jawaban: ${x.answer || ""}</div></li>`).join("")}</ol>` : `<div class="small">Tidak ada.</div>`}</div>` : ""}

        ${includeDevguide && devguideText ? `<div class="content"><div class="section-title">Developer Guide</div><div class="md">${mdToHtml(devguideText)}</div></div>` : ""}
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
      let execPath;
      try { execPath = await chromium.executablePath(); } catch (_) {
        execPath = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
      }
      const svgToPng = async (svg, w = 520, h = 220) => {
        const browser = await puppeteer.launch({ args: chromium.args, defaultViewport: { width: w, height: h }, executablePath: execPath, headless: true });
        const page = await browser.newPage();
        await page.setViewport({ width: w, height: h, deviceScaleFactor: 2 });
        await page.setContent(`<html><body style="margin:0">${svg}</body></html>`, { waitUntil: "networkidle0" });
        const buf = await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: w, height: h } });
        await browser.close();
        return buf;
      };

      const qImg = await svgToPng(quadrantSvg);
      const fImg = await svgToPng((() => {
        const w = 520, h = 220;
        return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">${financeSvg.replace(/<svg[\s\S]*?>|<\/svg>/g, "")}</svg>`;
      })());

      const children = [];
      children.push(new Paragraph({ text: "Executive Summary of a Project Report", heading: HeadingLevel.TITLE }));
      children.push(new Paragraph({ text: "Project Overview", heading: HeadingLevel.HEADING_2 }));
      for (const x of [...reasons.slice(0,3), recommendedPath ? `Rekomendasi: ${recommendedPath}` : ""].filter(Boolean)) {
        children.push(new Paragraph({ text: x, bullet: { level: 0 } }));
      }

      children.push(new Paragraph({ text: "Project Details", heading: HeadingLevel.HEADING_2 }));
      children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
        new TableRow({ children: [ new TableCell({ children: [new Paragraph("Project Name")] }), new TableCell({ children: [new Paragraph(useCase)] }), new TableCell({ children: [new Paragraph("Project Number")] }), new TableCell({ children: [new Paragraph(String(profile.project_number || "—"))] }) ] }),
        new TableRow({ children: [ new TableCell({ children: [new Paragraph("Project Sponsor")] }), new TableCell({ children: [new Paragraph(String(profile.sponsor || domain || "—"))] }), new TableCell({ children: [new Paragraph("Project Owner")] }), new TableCell({ children: [new Paragraph(String(profile.owner || "—"))] }) ] }),
        new TableRow({ children: [ new TableCell({ children: [new Paragraph("Program Manager")] }), new TableCell({ children: [new Paragraph(String(profile.program_manager || "—"))] }), new TableCell({ children: [new Paragraph("Project Manager")] }), new TableCell({ children: [new Paragraph(String(profile.project_manager || "—"))] }) ] }),
        new TableRow({ children: [ new TableCell({ children: [new Paragraph("Completed by")] }), new TableCell({ children: [new Paragraph(String(profile.completed_by || "—"))] }), new TableCell({ children: [new Paragraph("Priority")] }), new TableCell({ children: [new Paragraph(priority)] }) ] }),
      ] }));

      children.push(new Paragraph({ text: "Key Accomplishments", heading: HeadingLevel.HEADING_2 }));
      children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [ new TableRow({ children: [ new TableCell({ children: [ new Paragraph({ text: "Current Period", heading: HeadingLevel.HEADING_3 }), ...reasons.map(x => new Paragraph({ text: x, bullet: { level: 0 } })) ] }), new TableCell({ children: [ new Paragraph({ text: "Planned for next period", heading: HeadingLevel.HEADING_3 }), ...nextSteps.map(x => new Paragraph({ text: x, bullet: { level: 0 } })) ] }) ] }) ] }));

      children.push(new Paragraph({ text: "Project Determine (Quadrant)", heading: HeadingLevel.HEADING_2 }));
      children.push(new Paragraph({ children: [ new ImageRun({ data: qImg, transformation: { width: 520, height: 220 } }) ] }));

      children.push(new Paragraph({ text: "Financial Overview of the Project", heading: HeadingLevel.HEADING_2 }));
      children.push(new Paragraph({ children: [ new ImageRun({ data: fImg, transformation: { width: 520, height: 220 } }) ] }));

      children.push(new Paragraph({ text: "Project Deliverable Timeline", heading: HeadingLevel.HEADING_2 }));
      children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [ new TableRow({ children: [ new TableCell({ children: [new Paragraph("Project Deliverable")] }), ...["March","April","May","June","July"].map(m=> new TableCell({ children: [new Paragraph(m)] })) ] }), ...["Technical Interpretation","Engineering Report","Resource Availability Report","Server Replacement"].map(d => new TableRow({ children: [ new TableCell({ children: [new Paragraph(d)] }), ...Array(5).fill(0).map(()=> new TableCell({ children: [new Paragraph("○")] })) ] })) ] }));

      children.push(new Paragraph({ text: "Key Risks", heading: HeadingLevel.HEADING_2 }));
      children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [ new TableRow({ children: ["Risk","Response","Date Identified","Status","Owner"].map(t=> new TableCell({ children: [new Paragraph(t)] })) }), ...(risksBlock.length ? risksBlock.map(r => new TableRow({ children: [ new TableCell({ children: [new Paragraph(r)] }), new TableCell({ children: [new Paragraph("Mitigasi direncanakan")] }), new TableCell({ children: [new Paragraph(new Date().toLocaleDateString('id-ID'))] }), new TableCell({ children: [new Paragraph("Open")] }), new TableCell({ children: [new Paragraph(String(profile.project_manager || profile.owner || "—"))] }), ] })) : [ new TableRow({ children: [ new TableCell({ children: [new Paragraph("Tidak disebut")] }), new TableCell({ children: [new Paragraph("")] }), new TableCell({ children: [new Paragraph("")] }), new TableCell({ children: [new Paragraph("")] }), new TableCell({ children: [new Paragraph("")] }) ] }) ]) ] }));

      if (String(profile.website || "").trim()) {
        children.push(new Paragraph({ children: [ new TextRun({ text: "Website: " }), new ExternalHyperlink({ link: String(profile.website), children: [ new TextRun({ text: String(profile.website), style: "Hyperlink" }) ] }) ] }));
      }

      const doc = new Document({
        creator: String(profile.owner || ""),
        title: `Executive Summary — ${useCase}`,
        description: String(profile.description || ""),
        sections: [{
          headers: { default: new Header({ children: [ new Paragraph({ text: `Executive Summary — ${useCase}`, alignment: AlignmentType.LEFT }) ] }) },
          footers: { default: new Footer({ children: [ new Paragraph({ alignment: AlignmentType.CENTER, children: [ new TextRun({ text: "Page " }), PageNumber.CURRENT ] }) ] }) },
          children
        }]
      });

      const buf = await Packer.toBuffer(doc);
      const filename = `Usecase_${useCase.replace(/[^a-z0-9]+/gi,'_')}.docx`;
      return {
        statusCode: 200,
        isBase64Encoded: true,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": `attachment; filename="${filename}"`
        },
        body: Buffer.from(buf).toString("base64")
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