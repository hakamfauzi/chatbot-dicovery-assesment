import ExcelJS from 'exceljs';

const makeEvent = (body) => ({ httpMethod: 'POST', body: JSON.stringify(body) });

test('Scenario: generate xlsx with required sheets and validations', async () => {
  const { handler } = await import('../netlify/functions/scenario.js');
  const raw = `
[KNOWLEDGE BASE]
Q: Apa jam operasional layanan?
A: Layanan beroperasi 24/7 dengan SLA tanggapan.
[/KNOWLEDGE BASE]

| No | Aspek | Pernyataan (Test Step) | Ucapan Pelanggan (Input) | Perilaku yang Diharapkan (Expected) | Target Sederhana | Bukti yang Dicek | Catatan |
|----|-------|-------------------------|---------------------------|-------------------------------------|------------------|------------------|---------|
| 1  | Latency | Bot merespon ≤ {{LATENCY_MAX_SEC}}s | Halo | Menjawab cepat | Respon cepat | Log latensi | |
`;
  const assessment = {
    use_case_name: 'Voicebot Support',
    domain: 'Customer Care',
    impact: 80, feasibility: 60, total: 140, priority: 'Quick win',
    timestamp: new Date().toISOString(), rawText: raw, owner: 'Infomedia'
  };
  const res = await handler(makeEvent({ assessment }));
  expect(res.statusCode).toBe(200);
  const buf = Buffer.from(res.body, 'base64');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const names = wb.worksheets.map(w => w.name);
  expect(names).toEqual(expect.arrayContaining(['README','Variables','Rubrik Scoring','Skenario Uji (Pelanggan)']));
  const wsVar = wb.getWorksheet('Variables');
  expect(wsVar.rowCount).toBeGreaterThanOrEqual(10);
  const wsSk = wb.getWorksheet('Skenario Uji (Pelanggan)');
  expect(wsSk.getRow(1).values.slice(1,10)).toEqual([
    'No','Aspek','Pernyataan','Ucapan Pelanggan','Perilaku yang Diharapkan','Target Sederhana','Bukti yang Dicek','Catatan','Skor (1–5)'
  ]);
  expect(wsSk.rowCount).toBeGreaterThan(21);
});

test('Scenario: method bukan POST -> 405', async () => {
  const { handler } = await import('../netlify/functions/scenario.js');
  const res = await handler({ httpMethod: 'GET' });
  expect(res.statusCode).toBe(405);
});

test('Scenario: payload invalid -> 400', async () => {
  const { handler } = await import('../netlify/functions/scenario.js');
  const res = await handler(makeEvent({ assessment: {} }));
  expect(res.statusCode).toBe(400);
});
