import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../server.mjs';
import { normalizeMessage } from '../lib/connected/providers.mjs';
import { decodeEntities, plainHTML, sanitizeHTML, decodeCharset } from '../lib/connected/common.mjs';

const account = { email: 'owner@example.test' };
const b64 = (text, enc = 'utf8') => Buffer.from(text, enc).toString('base64url');
const gmail = parts => ({ id: 'm1', threadId: 't1', internalDate: '0', labelIds: [], payload: { mimeType: 'multipart/alternative', headers: [{ name: 'Subject', value: 'Réunion' }, { name: 'From', value: 'Marie <marie@example.test>' }], parts } });

test('mail: each Gmail part is decoded with its declared charset (iso-8859-1, windows-1252), UTF-8 otherwise', () => {
  const m = normalizeMessage('google', gmail([
    { mimeType: 'text/plain', headers: [{ name: 'Content-Type', value: 'text/plain; charset="iso-8859-1"' }], body: { data: b64('Café à Québec, élève\r\n\r\n\r\n\r\nFin', 'latin1') } },
    { mimeType: 'text/html', headers: [{ name: 'Content-Type', value: 'text/html; charset=windows-1252' }], body: { data: b64('<p>Caf\xe9 <b>gras</b></p><script>steal()</script><img src="https://track.example/p.gif">', 'latin1') } }
  ]), account, true);
  assert.equal(m.text, 'Café à Québec, élève\n\nFin');
  assert.ok(m.html.includes('Café') && !m.html.includes('steal') && !m.html.includes('<script'));
  assert.ok(!JSON.stringify(m).includes('<p>'), 'the formatted HTML is never serialized with the message');
  assert.equal(decodeCharset(Buffer.from('é'), 'text/plain; charset=unknown-charset-x'), 'é');
});

test('mail: HTML-only mail keeps paragraphs, list items and line breaks, decodes entities and shows link text', () => {
  const html = '<html><head><title>t</title><style>p{}</style></head><body><p>R&eacute;union&nbsp;&nbsp;demain &agrave; 10&#160;h</p>\n\n\n\n<p>Voir <a href="https://example.test/tracking?u=1&amp;v=2">le document</a>.</p><ul><li>un</li><li>deux</li></ul>ligne<br>suivante &#x1F600; &rsquo;</body></html>';
  const m = normalizeMessage('microsoft', { id: 'x', subject: 's', from: { emailAddress: { address: 'a@example.test' } }, body: { contentType: 'html', content: html } }, account, true);
  assert.equal(m.text, 'Réunion demain à 10 h\n\nVoir le document.\n\n• un\n• deux\n\nligne\nsuivante 😀 ’');
  assert.ok(!m.text.includes('tracking?u=1'));
  const snippet = normalizeMessage('google', { id: 'm2', internalDate: '0', snippet: 'C&#39;est d&eacute;j&agrave; pr&ecirc;t &amp; sign&eacute;', payload: { headers: [] } }, account, false);
  assert.equal(snippet.text, "C'est déjà prêt & signé");
  assert.equal(decodeEntities('&Eacute;cole &ccedil;a &#233; &#xE9; &hellip; &unknownname; &#0;'), 'École ça é é … &unknownname; &#0;');
  assert.equal(plainHTML('<a href="https://x.test">https://x.test</a>'), 'https://x.test');
});

test('mail: the formatted view sanitizer strips scripts, handlers, forms, frames and javascript: URLs; links open a new tab', () => {
  const out = sanitizeHTML('<p onclick="x()" style="color:red">Hi</p><script>alert(1)</script><img src="x" onerror="alert(2)"><a href="javascript:alert(3)">bad</a><a href="jav&#x61;script:alert(4)">enc</a><a href="https://ok.test" target="_self">ok</a><iframe src="https://evil.test"></iframe><form action="https://evil.test"><input name="p"></form><meta http-equiv="refresh" content="0;url=https://evil.test"><object data="x"></object><svg onload="alert(5)"><circle/></svg><div style="background:url(javascript:alert(6))">s</div><img src="data:image/png;base64,AA"><a href="mailto:a@b.test">m</a>');
  for (const bad of ['<script', 'onclick', 'onerror', 'javascript', 'alert(', '<iframe', '<form', '<input', '<meta', '<object', '<svg', 'onload']) assert.ok(!out.toLowerCase().includes(bad), bad);
  assert.ok(out.includes('<a href="https://ok.test" target="_blank" rel="noopener noreferrer">ok</a>'));
  assert.ok(out.includes('src="data:image/png;base64,AA"') && out.includes('href="mailto:a@b.test"') && out.includes('style="color:red"'));
});

async function run(fn) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'essentiel-mail-'));
  const app = createApp({ apiKey: '', connectorOptions: { filename: path.join(dir, 'vault') } }); app.listen(0, '127.0.0.1'); await once(app, 'listening');
  const base = `http://127.0.0.1:${app.address().port}`;
  try { await fn({ app, base }); } finally { app.closeAllConnections(); await new Promise(r => app.close(r)); await rm(dir, { recursive: true, force: true }); }
}
const frame = { 'Sec-Fetch-Dest': 'iframe', 'Sec-Fetch-Site': 'same-origin', 'Sec-Fetch-Mode': 'navigate' };

test('mail: opened messages keep sanitized HTML in memory only; the frame route has its own strict CSP and serves only same-origin frames', async () => {
  await run(async ({ app, base }) => {
    const svc = app.connected, d = svc.vault.state();
    d.snapshots.google = { messages: [{ id: 'm1', provider: 'google' }] };
    svc.providers.message = async () => normalizeMessage('google', gmail([{ mimeType: 'text/html', headers: [{ name: 'Content-Type', value: 'text/html; charset=utf-8' }], body: { data: b64('<p>Bonjour <a href="https://ok.test">lien</a></p><script>x()</script><img src="https://pixel.example/t.gif">') } }]), account, true);
    const m = await svc.message('google', 'm1');
    assert.equal(m.hasHtml, true); assert.equal(m.text, 'Bonjour lien'); assert.ok(!JSON.stringify(d).includes('<p>'));
    const ok = await fetch(base + '/mail-view/google/m1', { headers: frame });
    assert.equal(ok.status, 200); const csp = ok.headers.get('content-security-policy');
    for (const part of ["default-src 'none'", 'img-src data:', "frame-ancestors 'self'", "form-action 'none'", 'sandbox']) assert.ok(csp.includes(part), part);
    assert.ok(!/script-src/.test(csp)); assert.equal(ok.headers.get('x-frame-options'), 'SAMEORIGIN');
    const body = await ok.text(); assert.ok(body.includes('Bonjour') && !body.includes('x()') && body.includes('rel="noopener noreferrer"'));
    assert.equal((await fetch(base + '/mail-view/google/m1')).status, 403);
    assert.equal((await fetch(base + '/mail-view/google/m1', { headers: { ...frame, 'Sec-Fetch-Dest': 'document' } })).status, 403);
    assert.equal((await fetch(base + '/mail-view/google/m1', { headers: { ...frame, 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
    assert.equal((await fetch(base + '/mail-view/google/other', { headers: frame })).status, 404);
    assert.equal((await fetch(base + '/mail-view/yahoo/m1', { headers: frame })).status, 404);
    const post = body => fetch(base + '/api/connected/vault', { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json', 'X-Essentiel-Request': '1' }, body: JSON.stringify(body) });
    assert.equal((await post({ action: 'unlock', password: 'correct horse battery staple' })).status, 200);
    assert.equal((await post({ action: 'lock' })).status, 200);
    assert.equal(svc.mailHtml.size, 0); assert.equal((await fetch(base + '/mail-view/google/m1', { headers: frame })).status, 423);
  });
});
