/**
 * Unit test untuk netlify/functions/score.js (Gemini)
 */

import { jest } from '@jest/globals';

const makeResp = (status, bodyObjOrText) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: String(status),
  json: async () => (typeof bodyObjOrText === 'string' ? JSON.parse(bodyObjOrText) : bodyObjOrText),
  text: async () => (typeof bodyObjOrText === 'string' ? bodyObjOrText : JSON.stringify(bodyObjOrText)),
});

beforeEach(() => {
  jest.resetModules();
  global.fetch = jest.fn(async (url, opts) => {
    const u = String(url || '');
    if (u.includes('/v1/models?key=')) {
      return makeResp(200, { models: [{ name: 'models/gemini-1.5-flash' }] });
    }
    if (u.includes(':generateContent?key=')) {
      return makeResp(200, {
        candidates: [ { content: { parts: [ { text: 'Scored: Impact 70, Feasibility 50' } ] } } ]
      });
    }
    return makeResp(404, 'not found');
  });
  process.env.GEMINI_API_KEY = 'test-key';
});

afterEach(() => {
  delete process.env.GEMINI_API_KEY;
});

test('score.js: sukses dengan payload messages', async () => {
  const mod = await import('../netlify/functions/score.js');
  const res = await mod.handler({ httpMethod: 'POST', body: JSON.stringify({ messages: [{ role: 'user', text: 'halo' }] }) });
  expect(res.statusCode).toBe(200);
  const json = JSON.parse(res.body);
  expect(json.message).toMatch(/Scored/i);
  expect(json.model).toMatch(/gemini/i);
});

test('score.js: sukses dengan payload narrative', async () => {
  global.fetch = jest.fn(async (url, opts) => {
    const u = String(url || '');
    if (u.includes('/v1/models?key=')) {
      return makeResp(200, { models: [{ name: 'models/gemini-1.5-flash' }] });
    }
    if (u.includes(':generateContent?key=')) {
      return makeResp(200, {
        candidates: [ { content: { parts: [ { text: 'Scored: Impact 70, Feasibility 50\nUse case: RPA' } ] } } ]
      });
    }
    return makeResp(404, 'not found');
  });
  const mod = await import('../netlify/functions/score.js');
  const res = await mod.handler({ httpMethod: 'POST', body: JSON.stringify({ narrative: 'Narasi panjang tentang RPA' }) });
  expect(res.statusCode).toBe(200);
  const json = JSON.parse(res.body);
  expect(json.message).toMatch(/Scored|Use case/i);
});

test('score.js: method bukan POST -> 405', async () => {
  const mod = await import('../netlify/functions/score.js');
  const res = await mod.handler({ httpMethod: 'GET' });
  expect(res.statusCode).toBe(405);
});

test('score.js: payload tidak valid -> 400', async () => {
  const mod = await import('../netlify/functions/score.js');
  const res = await mod.handler({ httpMethod: 'POST', body: '{}' });
  expect(res.statusCode).toBe(400);
});

test('score.js: error dari model -> 500 dengan details', async () => {
  global.fetch = jest.fn(async (url, opts) => {
    const u = String(url || '');
    if (u.includes('/v1/models?key=')) {
      return makeResp(200, { models: [{ name: 'models/gemini-1.5-flash' }] });
    }
    if (u.includes(':generateContent?key=')) {
      return makeResp(503, 'overloaded');
    }
    return makeResp(404, 'nf');
  });
  const mod = await import('../netlify/functions/score.js');
  const res = await mod.handler({ httpMethod: 'POST', body: JSON.stringify({ messages: [{ role: 'user', text: 'halo' }] }) });
  expect([429,500,503]).toContain(res.statusCode);
  const json = JSON.parse(res.body);
  expect(json.error).toBeDefined();
});