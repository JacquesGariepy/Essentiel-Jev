import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import http from 'node:http';
import { createApp } from '../server.mjs';
import { makeFixture } from '../lib/demo.mjs';
async function withServer(options, run) {
  const app = createApp(options); app.listen(0, '127.0.0.1'); await once(app, 'listening');
  const base = `http://127.0.0.1:${app.address().port}`;
  try { await run(base); } finally { app.closeAllConnections(); await new Promise((resolve) => app.close(resolve)); }
}
const data = { item: { title: 'Test', text: 'Merci de répondre.' }, today: '2026-09-19', goals: [], consent: true };
const post = (base, payload = data, extras = {}) => fetch(`${base}/api/analyze`, { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json', 'X-Essentiel-Request': '1', ...extras }, body: JSON.stringify(payload) });
test('config exposes presence, never key, and no persistent input store', async () => {
  await withServer({ apiKey: 'do-not-expose' }, async (base) => {
    const response = await fetch(`${base}/api/config`); const text = await response.text();
    assert.ok(!text.includes('do-not-expose')); assert.equal(JSON.parse(text).configured, true);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  });
});
test('missing key disables real inference', async () => {
  await withServer({ apiKey: '' }, async (base) => assert.equal((await post(base)).status, 503));
});
test('cross-origin requests and wrong host are rejected', async () => {
  await withServer({ apiKey: 'fake' }, async (base) => {
    assert.equal((await post(base, data, { Origin: 'https://attacker.invalid' })).status, 403);
    const wrongHostStatus = await new Promise((resolve, reject) => {
      const req = http.get(`${base}/api/config`, { headers: { Host: 'attacker.invalid' } }, (res) => { res.resume(); resolve(res.statusCode); });
      req.on('error', reject);
    });
    assert.equal(wrongHostStatus, 403);
  });
});
test('explicit data transmission consent is required', async () => {
  await withServer({ apiKey: 'fake' }, async (base) => assert.equal((await post(base, { ...data, consent: false })).status, 400));
});
test('static paths are allowlisted and headers restrict executable content', async () => {
  await withServer({ apiKey: '' }, async (base) => {
    assert.equal((await fetch(`${base}/.env`)).status, 404);
    const res = await fetch(base); assert.equal(res.status, 200);
    assert.ok(res.headers.get('content-security-policy').includes("script-src 'self'"));
  });
});
test('mocked successful analysis traverses validation and policy', async () => {
  await withServer({ apiKey: 'fake', provider: async ({ questions }) => makeFixture(questions, { action: 'RESPOND', status: 'PENDING', evidence: 'S1', kind: 'WORK' }) }, async (base) => {
    const res = await post(base); assert.equal(res.status, 200); const { record } = await res.json();
    assert.equal(record.bucket, 'act'); assert.equal(record.evidence, 'Merci de répondre.'); assert.equal(record.confirmedDate, null);
  });
});
test('provider failure remains a failed analysis, not a synthetic success', async () => {
  await withServer({ apiKey: 'fake', provider: async () => { throw new Error('Test timeout'); } }, async (base) => {
    const { record } = await (await post(base)).json(); assert.equal(record.mode, 'error'); assert.equal(record.bucket, 'review');
  });
});
test('demo endpoint is explicitly marked synthetic', async () => {
  await withServer({ apiKey: '' }, async (base) => {
    const res = await fetch(`${base}/api/demo?today=2026-09-19`); const body = await res.json();
    assert.equal(body.synthetic, true); assert.equal(body.records.length, 8);
  });
});
