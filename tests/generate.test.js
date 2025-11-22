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
