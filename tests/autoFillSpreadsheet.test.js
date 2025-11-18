/**
 * Unit testing komprehensif untuk fungsi pengisian otomatis spreadsheet.
 * Mencakup: input valid, berbagai format data, auto-fill berbasis parsing/rumus,
 * edge cases, validasi integritas, format sel, error handling, dan performa batch.
 */

import { jest } from '@jest/globals';

// Mock googleapis (auth JWT & sheets client)
const appendMock = jest.fn(async (req) => ({ data: { updates: { updatedRange: req.range || 'hasil_llm!A:O' } } }));
const getMock = jest.fn(async () => ({ data: { values: [[
  'timestamp','use_case_name','domain','impact','feasibility','total','priority','rekomendasi_jalur','alasan','risk','next_step','rawText','model_id','run_id','owner'
], [
  '2025-01-02T10:00:00.000Z','CaseX','Finance','12','34','46','Quick win','Mulai pilot','A1 | A2','R1 | R2','N1 | N2','RAW','gpt-oss','run_1','Owner X'
]] } }));

jest.unstable_mockModule('googleapis', () => ({
  google: {
    auth: { JWT: class JWT { constructor() {} } },
    sheets: () => ({ spreadsheets: { values: { append: appendMock, get: getMock } } })
  }
}));

const importSave = async () => (await import('../netlify/functions/save.js'));
const importList = async () => (await import('../netlify/functions/list.js'));

const baseEnv = {
  GOOGLE_CLIENT_EMAIL: 'svc@test.example',
  GOOGLE_PRIVATE_KEY: '"-----BEGIN PRIVATE KEY-----\nABCDEF\n-----END PRIVATE KEY-----"',
  GOOGLE_SHEETS_SPREADSHEET_ID: 'sheet_123',
  GOOGLE_SHEETS_RANGE: 'hasil_llm!A:O'
};

const makeEvent = (body) => ({ httpMethod: 'POST', body: JSON.stringify(body) });

beforeEach(() => {
  jest.clearAllMocks();
  process.env.GOOGLE_CLIENT_EMAIL = baseEnv.GOOGLE_CLIENT_EMAIL;
  process.env.GOOGLE_PRIVATE_KEY = baseEnv.GOOGLE_PRIVATE_KEY;
  process.env.GOOGLE_SHEETS_SPREADSHEET_ID = baseEnv.GOOGLE_SHEETS_SPREADSHEET_ID;
  process.env.GOOGLE_SHEETS_RANGE = baseEnv.GOOGLE_SHEETS_RANGE;
});

afterEach(() => {
  delete process.env.GOOGLE_CLIENT_EMAIL;
  delete process.env.GOOGLE_PRIVATE_KEY;
  delete process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  delete process.env.GOOGLE_PRIVATE_KEY_BASE64;
  delete process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  delete process.env.GOOGLE_SHEETS_RANGE;
});

test('Input data valid ditulis ke kolom A:O secara lengkap', async () => {
  const { handler } = await importSave();
  const assessment = {
    timestamp: '2025-01-02T10:00:00.000Z',
    use_case_name: 'Case A',
    domain: 'Retail',
    impact: 80,
    feasibility: 60,
    total: 140,
    priority: 'Quick win',
    rekomendasi_jalur: 'Mulai pilot',
    alasan: ['A1','A2'],
    risk: ['R1'],
    next_step: ['N1','N2'],
    rawText: 'RAW',
    model_id: 'gemini-1',
    run_id: 'run_1',
    owner: 'Owner A'
  };
  const res = await handler(makeEvent({ assessment }));
  expect(res.statusCode).toBe(200);
  expect(appendMock).toHaveBeenCalledTimes(1);
  const call = appendMock.mock.calls[0][0];
  expect(call.valueInputOption).toBe('USER_ENTERED');
  expect(call.requestBody.values[0]).toHaveLength(15);
  expect(call.range).toBe('hasil_llm!A:O');
});

test('Mendukung format data berbeda: teks, angka, tanggal (string ISO)', async () => {
  const { handler } = await importSave();
  const assessment = {
    timestamp: new Date('2025-03-01T08:00:00Z').toISOString(),
    use_case_name: 'AI Doc',
    domain: 'Ops',
    impact: '75',
    feasibility: '55',
    total: '130',
    priority: 'Second priority',
    rawText: 'RAW',
  };
  // isi minimal wajib -> lengkapi untuk lolos validasi
  Object.assign(assessment, { rekomendasi_jalur: '', alasan: [], risk: [], next_step: [], model_id: '', run_id: '', owner: '' });
  const res = await handler(makeEvent({ assessment }));
  expect(res.statusCode).toBe(200);
  const vals = appendMock.mock.calls[0][0].requestBody.values[0];
  expect(typeof vals[3]).toBe('number'); // impact
  expect(typeof vals[4]).toBe('number'); // feasibility
  expect(typeof vals[5]).toBe('number'); // total
  expect(typeof vals[0]).toBe('string'); // timestamp ISO
});

test('Auto-fill dari rawText: rekomendasi, alasan, risk, next steps diparse', async () => {
  const { handler } = await importSave();
  const raw = [
    'Use case: AI OCR',
    'Domain: Finance',
    '- Impact: 70',
    '- Feasibility: 50',
    '- Total: 120',
    '',
    '**Rekomendasi jalur:** Mulai pilot internal, iterasi 2 minggu.',
    '',
    '**Alasan utama**',
    '1. Hemat waktu proses dokumen',
    '2. Kurangi human error',
    '',
    '**Top risks**',
    '- Data sensitif',
    '- Integrasi sistem lama',
    '',
    '**Next steps**',
    '1. PoC 2 minggu',
    '2. Evaluasi biaya',
  ].join('\n');
  const assessment = {
    timestamp: '2025-01-02T10:00:00.000Z',
    use_case_name: 'AI OCR',
    domain: 'Finance',
    impact: 70,
    feasibility: 50,
    total: 120,
    priority: 'Quick win',
    rawText: raw,
    model_id: 'gpt-oss-120b', run_id: 'run_2', owner: 'Owner B'
  };
  const res = await handler(makeEvent({ assessment }));
  expect(res.statusCode).toBe(200);
  const vals = appendMock.mock.calls[0][0].requestBody.values[0];
  expect(String(vals[7])).toMatch(/Mulai pilot/i); // rekomendasi_jalur
  expect(String(vals[8])).toMatch(/Hemat waktu/i); // alasan
  expect(String(vals[9])).toMatch(/Data sensitif/i); // risk
  expect(String(vals[10])).toMatch(/PoC/i); // next_step
});

test('Edge case: field wajib kosong -> 400', async () => {
  const { handler } = await importSave();
  const assessment = { use_case_name: 'X', domain: 'Y', impact: 1, feasibility: 2, total: null, priority: 'p', timestamp: 't' };
  const res = await handler(makeEvent({ assessment }));
  expect(res.statusCode).toBe(400);
  const body = JSON.parse(res.body);
  expect(body.error).toMatch(/total/i);
});

test('Edge case: method bukan POST -> 405', async () => {
  const { handler } = await importSave();
  const res = await handler({ httpMethod: 'GET' });
  expect(res.statusCode).toBe(405);
});

test('Env wajib tidak lengkap -> 400', async () => {
  delete process.env.GOOGLE_CLIENT_EMAIL;
  const { handler } = await importSave();
  const assessment = { use_case_name: 'X', domain: 'Y', impact: 1, feasibility: 2, total: 3, priority: 'p', timestamp: 't' };
  const res = await handler(makeEvent({ assessment }));
  expect(res.statusCode).toBe(400);
});

test('Private key base64 didukung', async () => {
  delete process.env.GOOGLE_PRIVATE_KEY;
  process.env.GOOGLE_PRIVATE_KEY_BASE64 = Buffer.from('-----BEGIN PRIVATE KEY-----\nABC\n-----END PRIVATE KEY-----').toString('base64');
  const { handler } = await importSave();
  const assessment = { use_case_name: 'X', domain: 'Y', impact: 1, feasibility: 2, total: 3, priority: 'p', timestamp: 't', rawText: '' };
  const res = await handler(makeEvent({ assessment }));
  expect(res.statusCode).toBe(200);
  expect(appendMock).toHaveBeenCalledTimes(1);
});

test('Validasi integritas & format sel: order kolom dan opsi append benar', async () => {
  const { handler } = await importSave();
  const assessment = { use_case_name: 'X', domain: 'Y', impact: 1, feasibility: 2, total: 3, priority: 'p', timestamp: 't', rawText: '', model_id: 'm', run_id: 'r', owner: 'o' };
  const res = await handler(makeEvent({ assessment }));
  expect(res.statusCode).toBe(200);
  const req = appendMock.mock.calls[0][0];
  const row = req.requestBody.values[0];
  expect(row[0]).toBe('t'); // timestamp
  expect(row[1]).toBe('X'); // use_case_name
  expect(row[2]).toBe('Y'); // domain
  expect(row[3]).toBe(1);
  expect(row[4]).toBe(2);
  expect(row[5]).toBe(3);
  expect(req.valueInputOption).toBe('USER_ENTERED');
  expect(req.insertDataOption).toBe('INSERT_ROWS');
});

test('Performa batch: 25 operasi append terproses', async () => {
  const { handler } = await importSave();
  const payload = (i) => ({ assessment: { use_case_name: 'X'+i, domain: 'Y', impact: 1, feasibility: 2, total: 3, priority: 'p', timestamp: 't' } });
  const tasks = Array.from({ length: 25 }, (_, i) => handler(makeEvent(payload(i))));
  const results = await Promise.all(tasks);
  expect(results.every(r => r.statusCode === 200)).toBe(true);
  expect(appendMock).toHaveBeenCalledTimes(25);
});

// Tambahan: verifikasi pembacaan list untuk konsistensi format
test('List handler membaca semua kolom sesuai header', async () => {
  const { handler } = await importList();
  const res = await handler({ httpMethod: 'GET', queryStringParameters: {} });
  expect(res.statusCode).toBe(200);
  const json = JSON.parse(res.body);
  const item = json.items.find((x) => String(x.owner || '') === 'Owner X');
  expect(item).toBeTruthy();
  expect(item.priority).toMatch(/Quick/i);
  expect(item.total).toBe(46);
});

test('List: baris header hasil_llm di-exclude (tidak ditampilkan)', async () => {
  // Siapkan values: baris pertama adalah header, baris kedua data
  getMock.mockResolvedValueOnce({ data: { values: [[
    'timestamp','use_case_name','domain','impact','feasibility','total','priority','rekomendasi_jalur','alasan','risk','next_step','rawText','model_id','run_id','owner'
  ], [
    '2025-01-02T10:00:00.000Z','CaseX','Finance','12','34','46','Quick win','Mulai pilot','A1 | A2','R1 | R2','N1 | N2','RAW','gpt-oss','run_1','Owner X'
  ]] } });
  const { handler } = await importList();
  const res = await handler({ httpMethod: 'GET', queryStringParameters: {} });
  expect(res.statusCode).toBe(200);
  const json = JSON.parse(res.body);
  expect(json.items.length).toBe(1);
  expect(json.items[0].use_case_name).toBe('CaseX');
});
test('List pertanyaan: header diabaikan dan baris data dibaca', async () => {
  // siapkan mock values untuk tab pertanyaan
  getMock.mockResolvedValueOnce({ data: { values: [ ['No','Pertanyaan','Kategori'], ['1','Apa tujuan?','Business'] ] } });
  const { handler } = await importList();
  const res = await handler({ httpMethod: 'GET', queryStringParameters: { tab: 'pertanyaan' } });
  expect(res.statusCode).toBe(200);
  const json = JSON.parse(res.body);
  expect(json.items).toEqual([{ no: '1', question: 'Apa tujuan?', category: 'Business' }]);
});

test('Error handling list: kegagalan get dari Sheets -> 500', async () => {
  getMock.mockRejectedValueOnce(new Error('Sheets down'));
  const { handler } = await importList();
  const res = await handler({ httpMethod: 'GET', queryStringParameters: {} });
  expect(res.statusCode).toBe(500);
});

test('Error handling save: kegagalan append -> 500', async () => {
  appendMock.mockRejectedValueOnce(new Error('Append failed'));
  const { handler } = await importSave();
  const assessment = { use_case_name: 'X', domain: 'Y', impact: 1, feasibility: 2, total: 3, priority: 'p', timestamp: 't', rawText: '' };
  const res = await handler(makeEvent({ assessment }));
  expect(res.statusCode).toBe(500);
});

test('List: method bukan GET -> 405', async () => {
  const { handler } = await importList();
  const res = await handler({ httpMethod: 'POST' });
  expect(res.statusCode).toBe(405);
});

test('List: env wajib tidak lengkap -> 400', async () => {
  delete process.env.GOOGLE_CLIENT_EMAIL;
  const { handler } = await importList();
  const res = await handler({ httpMethod: 'GET', queryStringParameters: {} });
  expect(res.statusCode).toBe(400);
});

test('List: private key base64 didukung & rangeParam override', async () => {
  process.env.GOOGLE_CLIENT_EMAIL = baseEnv.GOOGLE_CLIENT_EMAIL;
  process.env.GOOGLE_PRIVATE_KEY_BASE64 = Buffer.from('-----BEGIN PRIVATE KEY-----\nXYZ\n-----END PRIVATE KEY-----').toString('base64');
  delete process.env.GOOGLE_PRIVATE_KEY;
  const { handler } = await importList();
  const res = await handler({ httpMethod: 'GET', queryStringParameters: { range: 'custom!A:O' } });
  expect(res.statusCode).toBe(200);
});

test('List: private key dalam kutip di-normalisasi', async () => {
  process.env.GOOGLE_CLIENT_EMAIL = baseEnv.GOOGLE_CLIENT_EMAIL;
  process.env.GOOGLE_PRIVATE_KEY = '"-----BEGIN PRIVATE KEY-----\\nZZZ\\n-----END PRIVATE KEY-----"';
  const { handler } = await importList();
  const res = await handler({ httpMethod: 'GET', queryStringParameters: {} });
  expect(res.statusCode).toBe(200);
});

test('List: values kosong -> items=[]', async () => {
  getMock.mockResolvedValueOnce({ data: { values: [] } });
  const { handler } = await importList();
  const res = await handler({ httpMethod: 'GET', queryStringParameters: {} });
  expect(res.statusCode).toBe(200);
  const json = JSON.parse(res.body);
  expect(Array.isArray(json.items)).toBe(true);
  expect(json.items.length).toBe(0);
});

test('List pertanyaan: filter baris hanya jika kolom 1/2 terisi', async () => {
  getMock.mockResolvedValueOnce({ data: { values: [
    ['No','Pertanyaan','Kategori'],
    null,
    ['2','','Business'],
    ['3','Apa rencana?','']
  ] } });
  const { handler } = await importList();
  const res = await handler({ httpMethod: 'GET', queryStringParameters: { tab: 'pertanyaan' } });
  expect(res.statusCode).toBe(200);
  const json = JSON.parse(res.body);
  expect(json.items).toEqual([
    { no: '2', question: null, category: 'Business' },
    { no: '3', question: 'Apa rencana?', category: null }
  ]);
});