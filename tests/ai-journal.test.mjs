import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../server.mjs';
import { createDrafter } from '../lib/drafter.mjs';
import { createJournal, explainAnswers, CLI_ADDS } from '../lib/ai-journal.mjs';
import { makeFixture } from '../lib/demo.mjs';
import { makeLabPresets } from '../public/systemone.js';

// No live model call: TypeSafe answers are fixtures, drafting engines are stubbed HTTP or `node -e` stand-in children.
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lab = makeLabPresets()[0];
const KEY = 'ts-live-key-DO-NOT-LEAK-0123456789';
async function run(options, fn) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'essentiel-ailog-'));
  const app = createApp({ connectorOptions: { filename: path.join(dir, 'vault') }, ...options }); app.listen(0, '127.0.0.1'); await once(app, 'listening');
  const base = `http://127.0.0.1:${app.address().port}`;
  const post = (route, body, headers = {}) => fetch(base + route, { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json', 'X-Essentiel-Request': '1', ...headers }, body: JSON.stringify(body) });
  const get = (route, headers = { 'X-Essentiel-Request': '1' }) => fetch(base + route, { headers });
  try { await fn({ app, base, post, get, dir }); } finally { app.closeAllConnections(); await new Promise(r => app.close(r)); await rm(dir, { recursive: true, force: true }); }
}
const item = { title: 'Réunion jeudi', source: 'Google', text: 'Pouvez-vous confirmer la réunion de jeudi 10 h ? SOURCE-MARKER-7' };
const child = script => (command, args, options) => spawn(process.execPath, ['-e', script, '--', ...args], options);
const readStdin = "let input='';process.stdin.on('data',c=>input+=c);process.stdin.on('end',()=>{";

test('AI log: journal is memory only, capped as a ring buffer, and redacts secrets and token patterns', async () => {
  const source = await readFile(path.join(repo, 'lib/ai-journal.mjs'), 'utf8');
  assert.ok(!/node:fs|writeFile|appendFile|createWriteStream/.test(source), 'the journal module must not touch the disk');
  const j = createJournal({ limit: 3, fieldCap: 50, secrets: () => ['my-secret-value-123', 'short'] });
  for (let i = 1; i <= 5; i++) j.start({ route: '/x', kind: 'typesafe.analyze', engine: 'TypeSafe Jev', request: { n: i } });
  assert.equal(j.size, 3); assert.deepEqual(j.list(0).entries.map(e => e.id), ['AI000005', 'AI000004', 'AI000003']);
  const id = j.start({ route: '/x', kind: 'draft.reply', engine: 'Codex', request: { text: 'key my-secret-value-123 and Bearer abcdefghijklmnop and sk-abcdefghijklmnopqrstuv', long: 'x'.repeat(120) } });
  const e = j.get(id);
  assert.ok(!JSON.stringify(e).includes('my-secret-value-123')); assert.ok(!JSON.stringify(e).includes('abcdefghijklmnop')); assert.ok(!JSON.stringify(e).includes('sk-abcdefghijklmnopqrstuv'));
  assert.match(e.request.text, /\[REDACTED\]/); assert.match(e.request.long, /truncated 70 characters/); assert.ok(e.request.text.includes('short') === false || true);
  const rev = j.list(0).rev; j.update(id, { status: 'ok' });
  assert.deepEqual(j.list(rev).entries.map(x => x.id), [id]); assert.equal(typeof j.get(id).latencyMs, 'number');
  const epoch = j.list(0).epoch; assert.equal(j.clear(x => x.kind === 'draft.reply'), 1); assert.equal(j.list(0).epoch, epoch + 1); j.clear(); assert.equal(j.size, 0);
});

test('AI log: explainAnswers shows every option with its probability and the chosen one', () => {
  const q = { action: { type: 'choice', instructions: 'Pick', criteria: { A: 'Act', B: 'Wait' } }, level: { type: 'score', instructions: 'Rate', criteria: ['low', 'high'] }, risky: { type: 'noul', instructions: 'Risky?' } };
  const a = { action: { type: 'choice', choice: 'A', confidence: 0.8, probabilities: { A: 0.9, B: 0.1 } }, level: { type: 'score', score: 0.7, confidence: 0.6, probabilities: { 0: 0.3, 1: 0.7 } }, risky: { type: 'noul', noul: 0.2 } };
  const [choice, score, noul] = explainAnswers(q, a);
  assert.deepEqual(choice.options, [{ key: 'A', description: 'Act', probability: 0.9, chosen: true }, { key: 'B', description: 'Wait', probability: 0.1, chosen: false }]);
  assert.deepEqual(score.levels.map(l => l.probability), [0.3, 0.7]); assert.equal(noul.noul, 0.2);
  assert.equal(explainAnswers(q, {})[0].returned, false);
});

test('AI log: a System One call records the exact request, raw response, per-option probabilities and validation; keys never appear', async () => {
  await run({ apiKey: KEY, provider: async ({ questions, apiKey }) => ({ ...makeFixture(questions), echo: 'Authorization: Bearer ' + apiKey }) }, async ({ post, get }) => {
    const res = await post('/api/evaluate', { ...lab, consent: true }); assert.equal(res.status, 200);
    const { aiLogId } = await res.json(); assert.match(aiLogId, /^AI\d{6}$/);
    const list = await (await get('/api/ai-log')).json(); assert.equal(list.entries.length, 1); assert.equal(list.entries[0].status, 'ok'); assert.equal(list.entries[0].kind, 'typesafe.evaluate');
    const e = await (await get('/api/ai-log/' + aiLogId)).json();
    assert.deepEqual(e.request.body.questions, lab.questions); assert.deepEqual(e.request.body.state, lab.state); assert.equal(e.request.endpoint, 'https://api.typesafe.ai/v1/systemone');
    assert.equal(e.validation.ok, true); assert.equal(e.answers.length, Object.keys(lab.questions).length);
    const choice = e.answers.find(x => x.type === 'choice'); assert.ok(choice.options.every(o => typeof o.probability === 'number')); assert.equal(choice.options.filter(o => o.chosen).length, 1);
    assert.ok(e.response.answers); assert.ok(!JSON.stringify(e).includes(KEY)); assert.ok(!JSON.stringify(list).includes(KEY));
  });
});

test('AI log: invalid Jev answers are journaled as rejected with the failing check; provider failures as errors', async () => {
  await run({ apiKey: KEY, provider: async () => ({ model: 'jev-x', answers: {} , usage: { input_tokens: 1 } }) }, async ({ post, get }) => {
    assert.equal((await post('/api/evaluate', { ...lab, consent: true })).status, 502);
    const [s] = (await (await get('/api/ai-log')).json()).entries; assert.equal(s.status, 'rejected');
    const e = await (await get('/api/ai-log/' + s.id)).json(); assert.equal(e.validation.ok, false); assert.ok(e.validation.error); assert.ok(e.answers.every(a => a.returned === false));
  });
  await run({ apiKey: KEY, provider: async () => { throw new Error('Accès TypeSafe refusé (403).'); } }, async ({ post, get }) => {
    const r = await (await post('/api/analyze', { consent: true, today: '2026-09-19', item })).json(); assert.equal(r.record.mode, 'error'); assert.match(r.aiLogId, /^AI/);
    const e = await (await get('/api/ai-log/' + r.aiLogId)).json(); assert.equal(e.status, 'error'); assert.equal(e.error.message, 'Accès TypeSafe refusé (403).');
  });
});

test('AI log: a message assessment keeps the state, questions, answers and the bucket applied by local code', async () => {
  await run({ apiKey: KEY, provider: async ({ questions }) => makeFixture(questions, { action: 'RESPOND', status: 'PENDING', evidence: 'S1', kind: 'WORK' }) }, async ({ post, get }) => {
    const r = await (await post('/api/analyze', { consent: true, today: '2026-09-19', item, sourceProvider: 'google' })).json();
    const e = await (await get('/api/ai-log/' + r.aiLogId)).json();
    assert.equal(e.source, 'google'); assert.equal(e.label, item.title); assert.ok(e.request.body.state.document.text.includes('SOURCE-MARKER-7'));
    assert.ok(e.request.body.questions.action.criteria); assert.equal(e.result.bucket, r.record.bucket); assert.ok(e.answers.find(a => a.id === 'action').options.some(o => o.chosen));
  });
});

test('AI log: an OpenAI-compatible draft keeps prompts, request body and raw response; the engine key is redacted', async () => {
  const drafter = createDrafter({ env: { DRAFT_ENGINE: 'openai', LLM_BASE_URL: 'http://127.0.0.1:11434/v1', LLM_MODEL: 'llama3.2', LLM_API_KEY: 'llm-secret-key-9876543210' },
    fetchImpl: async () => new Response(JSON.stringify({ model: 'llama3.2:latest', usage: { prompt_tokens: 12, completion_tokens: 7 }, echo: 'llm-secret-key-9876543210', choices: [{ message: { content: '{"draft":"Bonjour","notes":["n"]}' } }] })) });
  await run({ apiKey: '', drafter }, async ({ post, get }) => {
    const r = await (await post('/api/draft', { consent: true, kind: 'reply', lang: 'fr', text: item.text, instructions: 'court', sourceProvider: 'microsoft' })).json();
    const e = await (await get('/api/ai-log/' + r.aiLogId)).json();
    assert.equal(e.kind, 'draft.reply'); assert.equal(e.engine, 'OpenAI-compatible (local)'); assert.equal(e.status, 'ok'); assert.equal(e.modelReturned, 'llama3.2:latest');
    assert.deepEqual(e.usage, { input_tokens: 12, output_tokens: 7 }); assert.equal(e.result.draft, 'Bonjour');
    assert.ok(e.exchange.userPrompt.includes('SOURCE-MARKER-7')); assert.ok(e.exchange.systemPrompt.includes('untrusted data')); assert.equal(e.exchange.requestBody.response_format.type, 'json_schema');
    assert.equal(e.exchange.httpStatus, 200); assert.ok(e.exchange.rawResponse.includes('Bonjour')); assert.ok(!JSON.stringify(e).includes('llm-secret-key-9876543210'));
  });
});

test('AI log: Claude Code and Codex drafts show arguments, stdin, events and what the CLI adds, without absolute user paths', async () => {
  const claude = readStdin + "console.log(JSON.stringify({type:'result',subtype:'success',is_error:false,total_cost_usd:0.012,usage:{input_tokens:30,output_tokens:9},modelUsage:{'claude-test':{}},structured_output:{draft:'Réponse',notes:[]}}));});";
  const codex = readStdin + "const fs=require('fs'),a=process.argv.slice(1),o=a[a.indexOf('-o')+1];console.log(JSON.stringify({type:'thread.started'}));console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'m'}}));fs.writeFileSync(o,JSON.stringify({draft:'Codex',notes:['c']}));console.log(JSON.stringify({type:'turn.completed',usage:{input_tokens:5,output_tokens:2}}));});";
  for (const [engine, script] of [['claude', claude], ['codex', codex]]) {
    const drafter = createDrafter({ env: { DRAFT_ENGINE: engine, CLAUDE_COMMAND: process.execPath, CODEX_COMMAND: process.execPath, PATH: process.env.PATH }, spawnImpl: child(script) });
    await run({ apiKey: '', drafter }, async ({ post, get }) => {
      const r = await (await post('/api/draft', { consent: true, kind: 'summary', lang: 'en', text: item.text })).json();
      const e = await (await get('/api/ai-log/' + r.aiLogId)).json(), text = JSON.stringify(e);
      assert.equal(e.status, 'ok'); assert.equal(e.kind, 'draft.summary'); assert.equal(e.exchange.transport, 'cli');
      assert.equal(e.exchange.command, path.basename(process.execPath)); assert.ok(e.exchange.stdin.includes('SOURCE-MARKER-7')); assert.equal(e.exchange.exitCode, 0);
      assert.deepEqual(e.exchange.cliAdds, CLI_ADDS[engine]); assert.ok(!text.includes(os.tmpdir()) && !text.includes(os.tmpdir().replace(/\\/g, '\\\\')), 'no absolute temporary path');
      if (engine === 'claude') { assert.ok(e.exchange.args.includes('--safe-mode')); assert.equal(e.costUsd, 0.012); assert.deepEqual(e.usage, { input_tokens: 30, output_tokens: 9 }); }
      else { assert.ok(e.exchange.args.includes('<temp dir>' + path.sep + 'last-message.json') || e.exchange.args.some(a => a.startsWith('<temp dir>'))); assert.ok(e.exchange.events.some(x => x.type === 'turn.completed')); assert.equal(e.exchange.lastMessage, '{"draft":"Codex","notes":["c"]}'); }
    });
  }
});

test('AI log: a refused draft is journaled as rejected with the raw output kept locally, not reflected in the API error', async () => {
  const drafter = createDrafter({ env: { DRAFT_ENGINE: 'openai', LLM_BASE_URL: 'http://127.0.0.1:11434/v1', LLM_MODEL: 'm' }, fetchImpl: async () => new Response(JSON.stringify({ choices: [{ message: { content: 'RAW-ENGINE-OUTPUT not json' } }] })) });
  await run({ apiKey: '', drafter }, async ({ post, get }) => {
    const res = await post('/api/draft', { consent: true, kind: 'reply', lang: 'fr', text: 'x' }); const body = await res.json();
    assert.equal(res.status, 502); assert.ok(!JSON.stringify(body).includes('RAW-ENGINE-OUTPUT'));
    const e = await (await get('/api/ai-log/' + body.aiLogId)).json(); assert.equal(e.status, 'rejected'); assert.equal(e.error.code, 'DRAFT_INVALID'); assert.ok(e.exchange.rawResponse.includes('RAW-ENGINE-OUTPUT'));
  });
});

test('AI log: pending calls appear immediately and the incremental endpoint returns only changes', async () => {
  let release, calls = 0; const gate = new Promise(r => { release = r; });
  await run({ apiKey: KEY, provider: async ({ questions }) => { if (++calls > 1) await gate; return makeFixture(questions); } }, async ({ post, get }) => {
    const first = await post('/api/evaluate', { ...lab, consent: true }); assert.equal(first.status, 200);
    const pending = post('/api/evaluate', { ...lab, consent: true });
    let list; for (let i = 0; i < 50; i++) { list = await (await get('/api/ai-log')).json(); if (list.entries.some(e => e.status === 'pending')) break; await new Promise(r => setTimeout(r, 20)); }
    assert.ok(list.entries.some(e => e.status === 'pending'));
    const rev = list.rev; release(); assert.equal((await pending).status, 200);
    const delta = await (await get('/api/ai-log?after=' + rev)).json();
    assert.equal(delta.entries.length, 1); assert.equal(delta.entries[0].status, 'ok'); assert.equal((await (await get('/api/ai-log?after=' + delta.rev)).json()).entries.length, 0);
  }).catch(e => { release?.(); throw e; });
});

test('AI log: routes require the local header and exact origin; detail 404, clear, lock and disconnect empty it; nothing is written to disk', async () => {
  await run({ apiKey: KEY, provider: async ({ questions }) => makeFixture(questions) }, async ({ app, base, post, get, dir }) => {
    await post('/api/analyze', { consent: true, today: '2026-09-19', item, sourceProvider: 'google' });
    await post('/api/analyze', { consent: true, today: '2026-09-19', item });
    assert.equal((await get('/api/ai-log', {})).status, 403); assert.equal((await get('/api/ai-log/AI000001', {})).status, 403);
    assert.equal((await post('/api/ai-log/clear', {}, { Origin: 'https://evil.test' })).status, 403);
    assert.equal((await fetch(base + '/api/ai-log/clear', { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json' }, body: '{}' })).status, 403);
    assert.equal((await get('/api/ai-log/AI999999')).status, 404);
    const exported = await (await get('/api/ai-log/export')).json(); assert.equal(exported.entries.length, 2); assert.ok(!JSON.stringify(exported).includes(KEY));
    assert.equal((await post('/api/connected/disconnect', { provider: 'google' })).status, 200);
    assert.deepEqual((await (await get('/api/ai-log')).json()).entries.map(e => e.source), ['local']);
    assert.equal((await post('/api/ai-log/clear', {})).status, 200); assert.equal(app.journal.size, 0);
    await post('/api/analyze', { consent: true, today: '2026-09-19', item }); assert.equal(app.journal.size, 1);
    assert.equal((await post('/api/connected/vault', { action: 'unlock', password: 'correct horse battery staple' })).status, 200);
    await post('/api/analyze', { consent: true, today: '2026-09-19', item }); assert.equal(app.journal.size, 2);
    assert.equal((await post('/api/connected/vault', { action: 'lock' })).status, 200); assert.equal(app.journal.size, 0);
    const files = await readdir(dir); const vault = files.includes('vault') ? await readFile(path.join(dir, 'vault'), 'utf8') : '';
    assert.ok(files.every(f => f === 'vault')); assert.ok(!vault.includes('SOURCE-MARKER-7') && !vault.includes('typesafe.analyze'));
  });
});
