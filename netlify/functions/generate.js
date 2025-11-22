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

    const parseListFlexible = (text, keys) => {
      const lines = String(text || "").split(/\r?\n/);
      const keysLC = (Array.isArray(keys) ? keys : [keys]).map((k) => String(k || "").toLowerCase());
      let start = -1;
      for (let i = 0; i < lines.length; i++) {
        const s = String(lines[i] || "").trim();
        const sl = s.toLowerCase();
        const isHeading = /^\*\*.*\*\*$/.test(s) || /^#{1,4}\s+/.test(s);
        if ((isHeading && keysLC.some((k) => sl.includes(k))) || (keysLC.some((k) => sl.startsWith(k)) && /[:—-]/.test(sl))) { start = i + 1; break; }
      }
      if (start < 0) return [];
      const out = [];
      for (let j = start; j < lines.length; j++) {
        const t = String(lines[j] || "").trim();
        if (!t) break;
        if (/^\*\*.*\*\*$/.test(t) || /^#{1,4}\s+/.test(t)) break;
        if (/^[-•]\s+/.test(t)) out.push(t.replace(/^[-•]\s+/, ""));
        else if (/^\d+\.\s+/.test(t)) out.push(t.replace(/^\d+\.\s+/, ""));
        else { out.push(t); if (t.endsWith(".")) break; }
      }
      return out;
    };

    const findVal = (label) => {
      const m = String(rawText || "").match(new RegExp(label + "[^:]*:\\s*(.+)", "i"));
      return m ? String(m[1]).trim() : "";
    };
    const stripMd = (s) => String(s || "").replace(/^\*\*|\*\*$/g, "").trim();
    const findKvFlexible = (labels) => {
      const lines = String(rawText || "").split(/\r?\n/);
      const aliases = (Array.isArray(labels) ? labels : [labels]).map((x) => String(x || "").toLowerCase());
      for (let i = 0; i < lines.length; i++) {
        const raw = String(lines[i] || "");
        const s = raw.trim();
        const sl = s.toLowerCase();
        if (!s) continue;
        if (aliases.some((a) => sl.includes(a))) {
          const m = s.match(/[:\-–—]\s*(.+)$/);
          if (m) return stripMd(m[1]);
          const nxt = String(lines[i + 1] || "").trim();
          if (nxt && !/^\*\*.*\*\*$/.test(nxt) && !/^#{1,6}\s+/.test(nxt)) return stripMd(nxt);
        }
      }
      return "";
    };

    const findOwner = () => {
      const t = String(rawText || "");
      const pats = [
        /\bowner\s*project\s*[:\-–—]\s*(.+)/i,
        /\bproject\s*owner\s*[:\-–—]\s*(.+)/i,
        /\bowner\s*[:\-–—]\s*(.+)/i
      ];
      for (const re of pats) {
        const m = t.match(re);
        if (m && m[1]) return stripMd(m[1]).trim();
      }
      const kv = findKvFlexible(["owner project","project owner","owner","pemilik proyek"]);
      return kv;
    };

    let reasons = parseList(rawText, /\*\*Alasan utama[^\n]*\*\*/i);
    if (!reasons.length) reasons = parseListFlexible(rawText, ["alasan utama","alasan"]);
    let risksBlock = parseList(rawText, /\*\*Top risks[^\n]*\*\*/i);
    if (!risksBlock.length) risksBlock = parseListFlexible(rawText, ["top risks","risiko utama","risiko"]);
    let nextSteps = parseList(rawText, /\*\*Next steps[^\n]*\*\*/i);
    if (!nextSteps.length) nextSteps = parseListFlexible(rawText, ["next steps","langkah selanjutnya","next step","aksi lanjutan"]);

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
        .panel { border: 1px solid #cbd5e1; border-radius: 8px; margin: 16px 20px; overflow: hidden; }
        .panel-header { background: #e5efff; color: #0d47a1; padding: 10px 12px; font-weight: 700; }
        .panel-body { padding: 16px 18px; }
        .title { margin: 0 0 6px 0; color: #0d47a1; }
        .title-main { margin: 0 0 8px 0; color: #0d47a1; font-size: 22px; font-weight: 700; }
        .kv { display: grid; grid-template-columns: 140px 1fr; gap: 6px; }
        .kv .key { font-weight: 700; color: #0d47a1; }
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

    const sanitizeForPdf = (text) => {
      const lines = String(text || "").split(/\r?\n/);
      const drop = [/ketik\s*\/score/i, /gunakan\s*\/revise/i, /\/score\b/i, /\/revise\b/i, /\/start\b/i, /\/qna\b/i, /\/devguide\b/i, /\/export\s+json\b/i, /\/help\b/i];
      const keep = lines.filter((l) => !drop.some((r) => r.test(l)));
      return keep.join("\n").trim();
    };

    const isHeadingLine = (s) => /^\s*\*\*[^*]+\*\*\s*$/.test(s) || /^\s*#{1,6}\s+/.test(s);
    const isDGHeading = (s) => {
      const t = String(s || '').trim();
      const lc = t.toLowerCase();
      return (isHeadingLine(t) && (lc.includes('developer guide') || lc.includes('design solution')));
    };
    const removeSectionsFlex = (text, sectionNames) => {
      const names = (Array.isArray(sectionNames) ? sectionNames : [sectionNames]).filter(Boolean);
      const nameRegexes = names.map((n) => new RegExp(n, 'i'));
      const lines = String(text || '').split(/\r?\n/);
      const isTableLine = (t) => /^\s*\|.*\|\s*$/.test(t) || /^\s*\|\s*:?-+:?\s*\|/.test(t);
      const isListLine = (t) => /^\s*[-•]\s+/.test(t) || /^\s*\d+\.\s+/.test(t);
      let skipping = false;
      const out = [];
      for (let i = 0; i < lines.length; i++) {
        const raw = String(lines[i] || '');
        const s = raw.trim();
        const isStart = nameRegexes.some((re) => re.test(s));
        const isEnd = isHeadingLine(s) || nameRegexes.some((re) => re.test(s));
        if (!skipping && isStart) { skipping = true; continue; }
        if (skipping) {
          if (isEnd) { skipping = false; }
          else if (!s) { continue; }
          else if (isTableLine(s) || isListLine(s) || !isHeadingLine(s)) { continue; }
          else { skipping = false; }
          if (!skipping) { /* fall-through to push current line if not end */ }
          else { continue; }
        }
        out.push(raw);
      }
      return out.join('\n');
    };

    const mdInline = (s) => {
      let t = String(s || "");
      t = t.replace(/^\s*\*\*\s+([^\n]+)/gm, '<b>$1</b>');
      t = t.replace(/\*\*\{\s*([^}]+)\s*\}\*\*/g, '<b>$1</b>');
      t = t.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
      t = t.replace(/\*(.+?)\*/g, '<i>$1</i>');
      t = t.replace(/`([^`]+?)`/g, '<code>$1</code>');
      return t;
    };

    const extractTableAfterHeading = (text, headingRe) => {
      const lines = String(text || "").split(/\r?\n/);
      let idx = -1;
      for (let i = 0; i < lines.length; i++) {
        const s = String(lines[i] || "").trim();
        if (headingRe.test(s) || /\bTabel\s*Skor\s*&\s*Kontribusi\b/i.test(s)) { idx = i; break; }
      }
      if (idx < 0) return "";
      const out = [];
      for (let j = idx + 1; j < lines.length; j++) {
        const t = String(lines[j] || "").trim();
        if (!t) continue;
        if (/^\*\*.*\*\*$/.test(t) || /^#{1,4}\s+/.test(t)) break;
        // Tangkap format md khas ChatGPT (header + separator + rows)
        if (/^\s*\|.*\|\s*$/.test(t) || /^\s*\|\s*:?-+:?\s*\|/.test(t)) out.push(lines[j]);
      }
      return out.join("\n");
    };

    const extractFirstMarkdownTable = (text) => {
      const lines = String(text || "").split(/\r?\n/);
      for (let i = 0; i < lines.length - 1; i++) {
        const header = String(lines[i] || "").trim();
        const sep = String(lines[i + 1] || "").trim();
        if (/^\s*\|.*\|\s*$/.test(header) && /^\s*\|(?:\s*:?-+:?\s*\|)+\s*$/.test(sep)) {
          const out = [lines[i], lines[i + 1]];
          for (let j = i + 2; j < lines.length; j++) {
            const row = String(lines[j] || "").trim();
            if (!/^\s*\|.*\|\s*$/.test(row)) break;
            out.push(lines[j]);
          }
          return out.join("\n");
        }
      }
      return "";
    };

    const projectOverviewText = findVal("Project\\s*overview") || findKvFlexible(["project overview","ringkasan proyek"]);
    const projectOwnerText = findOwner() || String(profile.owner || "");

    const scoreTableText = extractTableAfterHeading(rawText, /\*\*Tabel\s*Skor[\s\S]*?Kontribusi\*\*/i) || extractFirstMarkdownTable(rawText);

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8"/>
        ${style}
        <title>Developer Guide</title>
      </head>
      <body>
        <div class="panel">
          <div class="panel-header">Use Case Summary</div>
          <div class="panel-body">
            <h1 class="title-main">${useCase}</h1>
            <div class="kv"><div class="key">Domain</div><div>${domain}</div></div>
            <div class="kv"><div class="key">Impact</div><div>${impact}</div></div>
            <div class="kv"><div class="key">Feasibility</div><div>${feasibility}</div></div>
            <div class="kv"><div class="key">Total</div><div>${total}</div></div>
            <div class="kv"><div class="key">Priority</div><div>${priority}</div></div>
            ${recommendedPath ? `<div class="kv"><div class="key">Recommended Path</div><div>${mdInline(recommendedPath)}</div></div>` : ''}
            ${projectOverviewText ? `<div class="kv"><div class="key">Project Overview</div><div>${mdInline(projectOverviewText)}</div></div>` : ''}
            ${projectOwnerText ? `<div class="kv"><div class="key">Project Owner</div><div>${mdInline(projectOwnerText)}</div></div>` : ''}
            <h3 class="title" style="margin-top:12px">Alasan utama</h3>
            <ul>${reasons.map(x=>`<li>${mdInline(x)}</li>`).join("") || "<li>Tidak disebut</li>"}</ul>
            <h3 class="title" style="margin-top:12px">Top risks</h3>
            <ul>${risksBlock.map(x=>`<li>${mdInline(x)}</li>`).join("") || "<li>Tidak disebut</li>"}</ul>
            <h3 class="title" style="margin-top:12px">Next steps</h3>
            <ul>${nextSteps.map(x=>`<li>${mdInline(x)}</li>`).join("") || "<li>Tidak disebut</li>"}</ul>
            ${scoreTableText ? `<h3 class="title" style="margin-top:12px">Tabel Skor & Kontribusi</h3><div class="md">${mdToHtml(scoreTableText)}</div>` : ''}
          </div>
        </div>

        <div class="panel">
          <div class="panel-header">Usecase Positioning</div>
          <div class="panel-body">
            <div class="kv"><div class="key">Impact (Y)</div><div>${impact}</div></div>
            <div class="kv"><div class="key">Feasibility (X)</div><div>${feasibility}</div></div>
            <div style="margin-top:10px">${quadrantSvg}</div>
          </div>
        </div>
        <div class="panel">
          <div class="panel-header">Design Solution</div>
          <div class="panel-body">
            <h2 class="title">Design Solution — ${useCase} (${domain})</h2>
            ${(() => {
              const lines = String(rawText || '').split(/\r?\n/);
              let start = -1;
              for (let i = 0; i < lines.length; i++) {
                const s = String(lines[i] || '').trim();
                if (isDGHeading(s) || /developer\s*guide/i.test(s) || /design\s*solution/i.test(s)) { start = i; break; }
              }
              let block = '';
              if (start >= 0) {
                const out = [];
                for (let j = start; j < lines.length; j++) {
                  const t = String(lines[j] || '').trim();
                  const isSummary = /^(\s*\*\*\s*(Ringkasan|Alasan|Top\s*risks|Next\s*steps|Tabel\s*Skor).*)$/i.test(t)
                    || /^#{1,6}\s+(Use\s*Case\s*Summary|Usecase\s*Positioning|Solution)/i.test(t);
                  if (isSummary) break;
                  out.push(lines[j]);
                }
                block = out.join('\n');
              }
              const summaryKeys = [
                'Ringkasan\s*&\s*Keputusan',
                'Alasan\s*utama',
                'Top\s*risks',
                'Next\s*steps',
                'Tabel\s*Skor\s*&\s*Kontribusi',
                'Tabel\s*Skor'
              ];
              const base = String(devguideText || block || removeSectionsFlex(rawText, summaryKeys)) || '';
              return `<div class=\"md\">${mdToHtml(sanitizeForPdf(base))}</div>`;
            })()}
          </div>
        </div>
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
