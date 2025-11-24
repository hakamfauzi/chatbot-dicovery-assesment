/**
 * Unit test untuk netlify/functions/generate.js (PDF & HTML)
 */

import { jest } from '@jest/globals';

// Mock chromium & puppeteer
jest.unstable_mockModule('@sparticuz/chromium', () => ({
  default: {
    args: [],
    defaultViewport: { width: 800, height: 600 },
    executablePath: async () => 'C:/chrome.exe'
  }
}));

jest.unstable_mockModule('puppeteer-core', () => ({
  default: {
    launch: async () => ({
      newPage: async () => ({
        setViewport: async () => {},
        setContent: async () => {},
        screenshot: async () => Buffer.from('png'),
        pdf: async () => Buffer.from('pdf')
      }),
      close: async () => {}
    })
  }
}));


const importGenerate = async () => (await import('../netlify/functions/generate.js'));

test('generate: method bukan POST -> 405', async () => {
  const { handler } = await importGenerate();
  const res = await handler({ httpMethod: 'GET' });
  expect(res.statusCode).toBe(405);
});

test('generate: HTML output', async () => {
  const { handler } = await importGenerate();
  const res = await handler({ httpMethod: 'POST', body: JSON.stringify({ format: 'html', assessment: { use_case_name: 'X', domain: 'Y', impact: 10, feasibility: 20, total: 30, priority: 'Quick', rawText: '' } }) });
  expect(res.statusCode).toBe(200);
  expect(res.headers['Content-Type']).toMatch(/text\/html/);
});


test('generate: PDF output', async () => {
  const { handler } = await importGenerate();
  const res = await handler({ httpMethod: 'POST', body: JSON.stringify({ format: 'pdf', assessment: { use_case_name: 'X', domain: 'Y', impact: 10, feasibility: 20, total: 30, priority: 'Quick', rawText: '' } }) });
  expect(res.statusCode).toBe(200);
  expect(res.isBase64Encoded).toBe(true);
  expect(res.headers['Content-Type']).toMatch(/application\/pdf/);
});

test('generate: mengenali HTML <ul><li> pada rawText', async () => {
  const { handler } = await importGenerate();
  const rawText = [
    '**Developer Guide**',
    '<ul>',
    '<li>Item A</li>',
    '<li>Item B</li>',
    '</ul>',
    '### Testing Scenario',
    '[AUTOVARS]'
  ].join('\n');
  const res = await handler({
    httpMethod: 'POST',
    body: JSON.stringify({ format: 'html', assessment: { use_case_name: 'Case HTML', domain: 'Doc', impact: 10, feasibility: 20, total: 30, priority: 'Quick', rawText } })
  });
  expect(res.statusCode).toBe(200);
  const html = String(res.body || '');
  expect(html).toMatch(/<ul>\s*<li>Item A<\/li>\s*<li>Item B<\/li>\s*<\/ul>/);
  expect(html).not.toMatch(/&lt;ul&gt;/);
});

test('generate: HTML <ul><li> di dalam sel tabel markdown tidak di-escape', async () => {
  const { handler } = await importGenerate();
  const rawText = [
    '### Testing Scenario',
    '| Aspek | Detail |',
    '|---|---|',
    '| Flow | <ul><li>Telephony Gateway → IVR → ASR</li><li>Fail-over: intent tidak dikenali</li></ul> |'
  ].join('\n');
  const res = await handler({
    httpMethod: 'POST',
    body: JSON.stringify({ format: 'html', assessment: { use_case_name: 'Case Table', domain: 'Voicebot', impact: 10, feasibility: 20, total: 30, priority: 'Quick', rawText } })
  });
  expect(res.statusCode).toBe(200);
  const html = String(res.body || '');
  expect(html).toMatch(/<ul>\s*<li>Telephony Gateway .*<\/li>\s*<li>Fail-over: intent tidak dikenali<\/li>\s*<\/ul>/);
  expect(html).not.toMatch(/&lt;ul&gt;/);
});

test('generate: panel Scenario Testing Usecase muncul dengan header yang tepat', async () => {
  const { handler } = await importGenerate();
  const rawText = [
    '### Testing Scenario',
    '[AUTOVARS]',
    '| A | B |',
    '|---|---|',
    '| X | Y |'
  ].join('\n');
  const res = await handler({
    httpMethod: 'POST',
    body: JSON.stringify({ format: 'html', assessment: { use_case_name: 'Case Panel', domain: 'Voicebot', impact: 10, feasibility: 20, total: 30, priority: 'Quick', rawText } })
  });
  expect(res.statusCode).toBe(200);
  const html = String(res.body || '');
  expect(html).toMatch(/<div class="panel-header">Scenario Testing Usecase<\/div>/);
  expect(html).toMatch(/<h2 class="title">Scenario Testing Usecase — Case Panel \(Voicebot\)<\/h2>/);
});
test('generate: header "## Scenario Testing Use" terdeteksi sebagai scenario', async () => {
  const { handler } = await importGenerate();
  const rawText = [
    '**Developer Guide**',
    'Desain sistem...',
    '## Scenario Testing Use',
    '| Aspek | Detail |',
    '|---|---|',
    '| Latency | respon ≤ 2 s |'
  ].join('\n');
  const res = await handler({
    httpMethod: 'POST',
    body: JSON.stringify({ format: 'html', assessment: { use_case_name: 'Case Scenario', domain: 'RPA', impact: 10, feasibility: 20, total: 30, priority: 'Quick', rawText } })
  });
  expect(res.statusCode).toBe(200);
  const html = String(res.body || '');
  // Panel Scenario Testing Usecase harus muncul dan memuat tabel
  expect(html).toMatch(/<div class="panel-header">Scenario Testing Usecase<\/div>/);
  expect(html).toMatch(/<table/);
  // Pastikan Design Solution tidak memuat header scenario
  const parts = html.split('<div class="panel-header">Scenario Testing Usecase</div>');
  expect(parts[0]).toMatch(/<div class="panel-header">Design Solution<\/div>/);
  expect(parts[0]).not.toMatch(/Scenario Testing Use/);
});

test('generate: panel Business Value Assessment menampilkan konten dari rawText', async () => {
  const { handler } = await importGenerate();
  const rawText = [
    '**Developer Guide**',
    'Desain sistem...',
    '## Business Value Assessment (BVA)',
    '| Value Lever | Formula (kata-kata) | Low | Base | High | Sumber |',
    '|-------------|----------------------|-----|------|------|--------|',
    '| Penghematan FTE | (FTE dikurangi × biaya/FTE) | 1 | 2 | 3 | Asumsi |'
  ].join('\n');
  const res = await handler({
    httpMethod: 'POST',
    body: JSON.stringify({ format: 'html', assessment: { use_case_name: 'Case BVA', domain: 'RPA', impact: 10, feasibility: 20, total: 30, priority: 'Quick', rawText } })
  });
  expect(res.statusCode).toBe(200);
  const html = String(res.body || '');
  expect(html).toMatch(/<div class="panel-header">Business Value Assessment<\/div>/);
  expect(html).toMatch(/<h2 class="title">Business Value Assessment — Case BVA \(RPA\)<\/h2>/);
  expect(html).toMatch(/<table/);
  // Pastikan BVA tidak tercampur di Design Solution
  const parts = html.split('<div class="panel-header">Business Value Assessment</div>');
  expect(parts[0]).toMatch(/<div class="panel-header">Design Solution<\/div>/);
  expect(parts[0]).not.toMatch(/Business Value Assessment/);
});
