/**
 * Unit test untuk netlify/functions/generate.js (PDF & DOCX)
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

// Mock docx
jest.unstable_mockModule('docx', () => ({
  Document: class Document { constructor() {} },
  Packer: { toBuffer: async () => Buffer.from('docx') },
  Paragraph: class Paragraph { constructor() {} },
  TextRun: class TextRun { constructor() {} },
  HeadingLevel: { TITLE: 1, HEADING_2: 2, HEADING_3: 3 },
  Table: class Table { constructor() {} },
  TableRow: class TableRow { constructor() {} },
  TableCell: class TableCell { constructor() {} },
  AlignmentType: { LEFT: 1, CENTER: 2 },
  WidthType: { PERCENTAGE: 1 },
  Header: class Header { constructor() {} },
  Footer: class Footer { constructor() {} },
  PageNumber: { CURRENT: 1 },
  ExternalHyperlink: class ExternalHyperlink { constructor() {} },
  ImageRun: class ImageRun { constructor() {} }
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

test('generate: DOCX output', async () => {
  const { handler } = await importGenerate();
  const res = await handler({ httpMethod: 'POST', body: JSON.stringify({ format: 'docx', assessment: { use_case_name: 'X', domain: 'Y', impact: 10, feasibility: 20, total: 30, priority: 'Quick', rawText: '' } }) });
  expect(res.statusCode).toBe(200);
  expect(res.isBase64Encoded).toBe(true);
  expect(res.headers['Content-Type']).toMatch(/officedocument/);
});

test('generate: PDF output', async () => {
  const { handler } = await importGenerate();
  const res = await handler({ httpMethod: 'POST', body: JSON.stringify({ format: 'pdf', assessment: { use_case_name: 'X', domain: 'Y', impact: 10, feasibility: 20, total: 30, priority: 'Quick', rawText: '' } }) });
  expect(res.statusCode).toBe(200);
  expect(res.isBase64Encoded).toBe(true);
  expect(res.headers['Content-Type']).toMatch(/application\/pdf/);
});