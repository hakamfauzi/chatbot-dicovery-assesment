import { jest } from '@jest/globals';

const batchUpdateMock = jest.fn(async () => ({ data: {} }));
const getValuesMock = jest.fn(async () => ({ data: { values: [[
  'timestamp','use_case_name','domain'
], [
  '2025-01-02T10:00:00.000Z','CaseX','Finance'
]] } }));
const getMetaMock = jest.fn(async () => ({ data: { sheets: [ { properties: { title: 'hasil_llm', sheetId: 0 } } ] } }));

jest.unstable_mockModule('googleapis', () => ({
  google: {
    auth: { JWT: class JWT { constructor() {} } },
    sheets: () => ({ spreadsheets: { values: { get: getValuesMock }, get: getMetaMock, batchUpdate: batchUpdateMock } })
  }
}));

const importDelete = async () => (await import('../netlify/functions/delete.js'));

beforeEach(() => {
  jest.clearAllMocks();
  process.env.GOOGLE_CLIENT_EMAIL = 'svc@test.example';
  process.env.GOOGLE_PRIVATE_KEY = '"-----BEGIN PRIVATE KEY-----\nABCDEF\n-----END PRIVATE KEY-----"';
  process.env.GOOGLE_SHEETS_SPREADSHEET_ID = 'sheet_123';
  process.env.GOOGLE_SHEETS_RANGE = 'hasil_llm!A:N';
});

afterEach(() => {
  delete process.env.GOOGLE_CLIENT_EMAIL;
  delete process.env.GOOGLE_PRIVATE_KEY;
  delete process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  delete process.env.GOOGLE_SHEETS_RANGE;
});

test('delete: method bukan POST -> 405', async () => {
  const { handler } = await importDelete();
  const res = await handler({ httpMethod: 'GET' });
  expect(res.statusCode).toBe(405);
});

test('delete: env wajib tidak lengkap -> 400', async () => {
  delete process.env.GOOGLE_CLIENT_EMAIL;
  const { handler } = await importDelete();
  const res = await handler({ httpMethod: 'POST', body: JSON.stringify({ timestamp: 't', use_case_name: 'x' }) });
  expect(res.statusCode).toBe(400);
});

test('delete: sukses menghapus baris berdasarkan timestamp + use_case_name', async () => {
  const { handler } = await importDelete();
  const res = await handler({ httpMethod: 'POST', body: JSON.stringify({ timestamp: '2025-01-02T10:00:00.000Z', use_case_name: 'CaseX' }) });
  expect(res.statusCode).toBe(200);
  expect(batchUpdateMock).toHaveBeenCalledTimes(1);
  const req = batchUpdateMock.mock.calls[0][0].requestBody.requests[0].deleteDimension.range;
  expect(req.dimension).toBe('ROWS');
  expect(req.startIndex).toBe(1); // header di index 0, data di index 1
  expect(req.endIndex).toBe(2);
});

test('delete: baris tidak ditemukan -> 404', async () => {
  getValuesMock.mockResolvedValueOnce({ data: { values: [['timestamp','use_case_name','domain'], ['A','B','C']] } });
  const { handler } = await importDelete();
  const res = await handler({ httpMethod: 'POST', body: JSON.stringify({ timestamp: 'X', use_case_name: 'Y' }) });
  expect(res.statusCode).toBe(404);
});

