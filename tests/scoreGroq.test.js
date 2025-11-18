/**
 * Unit test untuk netlify/functions/score_groq.js (GPT-OSS via Groq)
 */

import { jest } from '@jest/globals';

const makeResp = (status, bodyObj) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: String(status),
  json: async () => bodyObj,
  text: async () => JSON.stringify(bodyObj),
});

beforeEach(() => {
  jest.resetModules();
  process.env.GROQ_API_KEY = 'groq-key';
  global.fetch = jest.fn(async (url, opts) => {
    const u = String(url || '');
    if (u.includes('chat/completions')) {
      return makeResp(200, { choices: [ { message: { content: 'Groq says hello' } } ] });
    }
    return makeResp(404, { error: 'not found' });
  });
});

afterEach(() => {
  delete process.env.GROQ_API_KEY;
});

test('score_groq: sukses menghasilkan teks', async () => {
  const mod = await import('../netlify/functions/score_groq.js');
  const res = await mod.handler({ httpMethod: 'POST', body: JSON.stringify({ messages: [{ role: 'user', text: 'halo' }] }) });
  expect(res.statusCode).toBe(200);
  const json = JSON.parse(res.body);
  expect(json.message).toMatch(/Groq/i);
});

test('score_groq: method bukan POST -> 405', async () => {
  const mod = await import('../netlify/functions/score_groq.js');
  const res = await mod.handler({ httpMethod: 'GET' });
  expect(res.statusCode).toBe(405);
});

test('score_groq: env key hilang -> 400', async () => {
  delete process.env.GROQ_API_KEY;
  const mod = await import('../netlify/functions/score_groq.js');
  const res = await mod.handler({ httpMethod: 'POST', body: JSON.stringify({ messages: [{ role: 'user', text: 'halo' }] }) });
  expect(res.statusCode).toBe(400);
});