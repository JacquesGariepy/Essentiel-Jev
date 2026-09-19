import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../server.mjs';
import { createDrafter, draftConfig, llmBase, validateDraftRequest, cleanEnv, claudeArgs, codexArgs, DraftError, DRAFT_SCHEMA, DRAFT_LIMITS } from '../lib/drafter.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const request = { kind: 'reply', lang: 'fr', text: 'Bonjour, pouvez-vous confirmer SOURCE-MARKER-42 ?', instructions: 'ton cordial' };
const openaiEnv = (extra = {}) => ({ DRAFT_ENGINE: 'openai', LLM_BASE_URL: 'http://127.0.0.1:11434/v1/', LLM_MODEL: 'llama3.2', ...extra });
const reply = (content, extra = {}) => new Response(JSON.stringify({ model: 'llama3.2:latest', choices: [{ message: { role: 'assistant', content, ...extra } }] }), { status: 200 });
const rejectsCode = (promise, code) => assert.rejects(promise, e => e instanceof DraftError && e.code === code);
// Real child processes stand in for the CLIs: node -e <script> -- <the exact CLI arguments>.
const child = (script, seen) => (command, args, options) => { seen && Object.assign(seen, { command, args, options }); return spawn(process.execPath, ['-e', script, '--', ...args], options); };
const readStdin = "let input='';process.stdin.on('data',c=>input+=c);process.stdin.on('end',()=>{";

test('drafter: LLM_BASE_URL accepts https anywhere and http only on loopback', () => {
  assert.equal(llmBase('https://api.openai.com/v1/').base, 'https://api.openai.com/v1');
  for (const url of ['http://127.0.0.1:11434/v1', 'http://localhost:1234/v1', 'http://[::1]:8080/v1']) assert.equal(llmBase(url).local, true);
  for (const url of ['http://192.168.1.20:11434/v1', 'http://example.com/v1', 'https://user:pw@example.com/v1', 'https://example.com/v1?key=x', 'ftp://example.com', 'not a url']) assert.throws(() => llmBase(url), e => e.code === 'DRAFT_CONFIG_INVALID');
});

test('drafter: configuration defaults to none and never describes secrets, URLs or commands', () => {
  const none = createDrafter({ env: {} }).describe(); assert.deepEqual({ engine: none.engine, model: none.model, local: none.local, configured: none.configured, engines: none.engines, default: none.default }, { engine: 'none', model: '', local: false, configured: false, engines: [], default: 'none' });
  assert.equal(draftConfig({ DRAFT_ENGINE: 'gpt' }).configured, false);
  assert.equal(draftConfig({ DRAFT_ENGINE: 'openai', LLM_BASE_URL: 'https://api.example.com/v1' }).configured, false);
  assert.equal(draftConfig({ DRAFT_ENGINE: 'claude', CLAUDE_COMMAND: 'C:\\tools\\claude.cmd' }).configured, false);
  assert.equal(draftConfig({ DRAFT_ENGINE: 'claude', CLAUDE_MAX_BUDGET_USD: '-1' }).configured, false);
  const described = JSON.stringify(createDrafter({ env: openaiEnv({ LLM_BASE_URL: 'https://secret-host.example/v1', LLM_API_KEY: 'sk-secret-123' }) }).describe());
  assert.ok(!described.includes('secret-host') && !described.includes('sk-secret-123'));
  assert.ok(!JSON.stringify(createDrafter({ env: { DRAFT_ENGINE: 'codex', CODEX_COMMAND: 'D:\\private\\codex.exe' } }).describe()).includes('private'));
});

test('drafter: request bounds are enforced before any engine call', () => {
  assert.deepEqual(validateDraftRequest({ ...request, text: '  x  ' }), { ...request, text: 'x' });
  for (const bad of [{ ...request, kind: 'send' }, { ...request, lang: 'de' }, { ...request, text: '' }, { ...request, text: 'x'.repeat(DRAFT_LIMITS.text + 1) }, { ...request, instructions: 'x'.repeat(DRAFT_LIMITS.instructions + 1) }, { ...request, instructions: 42 }])
    assert.throws(() => validateDraftRequest(bad), e => e.code === 'INVALID_DRAFT_REQUEST');
});

test('drafter: OpenAI-compatible call uses the configured base, strict json_schema and no key for local servers', async () => {
  const calls = [];
  const drafter = createDrafter({ env: openaiEnv(), fetchImpl: async (url, init) => { calls.push({ url, init }); return reply('```json\n{"draft":"Bonjour, c’est confirmé [à confirmer].","notes":["Vérifier la date"]}\n```'); } });
  const d = drafter.describe(); assert.deepEqual({ engine: d.engine, model: d.model, local: d.local, configured: d.configured }, { engine: 'openai', model: 'llama3.2', local: true, configured: true }); assert.deepEqual(d.engines, [{ id: 'openai', label: 'OpenAI-compatible API', model: 'llama3.2', local: true, configured: true }]); assert.equal(d.default, 'openai');
  const result = await drafter.draft(request);
  assert.deepEqual(result, { draft: 'Bonjour, c’est confirmé [à confirmer].', notes: ['Vérifier la date'], engine: 'openai', model: 'llama3.2:latest' });
  const [{ url, init }] = calls, body = JSON.parse(init.body);
  assert.equal(url, 'http://127.0.0.1:11434/v1/chat/completions'); assert.equal(init.redirect, 'error'); assert.equal(init.headers.Authorization, undefined);
  assert.equal(body.model, 'llama3.2'); assert.equal(body.response_format.type, 'json_schema'); assert.equal(body.response_format.json_schema.strict, true); assert.deepEqual(body.response_format.json_schema.schema, DRAFT_SCHEMA);
  assert.ok(!('tools' in body)); assert.match(body.messages[0].content, /untrusted data/); assert.match(body.messages[1].content, /<<<SOURCE\n[^]*SOURCE-MARKER-42[^]*\nSOURCE>>>/);
  let auth; await createDrafter({ env: openaiEnv({ LLM_BASE_URL: 'https://api.example.com/v1', LLM_API_KEY: 'sk-test' }), fetchImpl: async (u, i) => { auth = i.headers.Authorization; return reply('{"draft":"ok","notes":[]}'); } }).draft(request);
  assert.equal(auth, 'Bearer sk-test');
});

test('drafter: tool calls, provider errors and malformed drafts fail closed without reflecting provider text', async () => {
  const run = response => createDrafter({ env: openaiEnv(), fetchImpl: async () => response }).draft(request);
  await rejectsCode(run(reply(null, { tool_calls: [{ type: 'function', function: { name: 'shell', arguments: '{}' } }] })), 'DRAFT_TOOL_USE');
  await assert.rejects(run(new Response('PROVIDER-SECRET-ECHO', { status: 500 })), e => e.code === 'DRAFT_PROVIDER_ERROR' && !e.message.includes('PROVIDER-SECRET-ECHO'));
  await rejectsCode(run(reply('{"draft":"ok","notes":[],"send":true}')), 'DRAFT_INVALID');
  await rejectsCode(run(reply(JSON.stringify({ draft: 'x'.repeat(DRAFT_LIMITS.draft + 1), notes: [] }))), 'DRAFT_INVALID');
  await rejectsCode(run(reply('{"draft":"ok","notes":["a","b","c","d","e","f"]}')), 'DRAFT_INVALID');
  await rejectsCode(run(reply('not json')), 'DRAFT_INVALID');
  await rejectsCode(createDrafter({ env: openaiEnv(), fetchImpl: async () => { throw new Error('ECONNREFUSED 127.0.0.1'); } }).draft(request), 'DRAFT_UNREACHABLE');
  await rejectsCode(createDrafter({ env: {} }).draft(request), 'DRAFT_NOT_CONFIGURED');
});

test('drafter: CLI children receive only allowlisted environment variables', () => {
  const env = { PATH: 'p', TYPESAFE_API_KEY: 't', GOOGLE_CLIENT_SECRET: 'g', LLM_API_KEY: 'l', CLAUDE_CONFIG_DIR: 'c', ANTHROPIC_API_KEY: 'a', OPENAI_API_KEY: 'o', CODEX_HOME: 'h' };
  assert.deepEqual(cleanEnv(env, 'claude'), { PATH: 'p', CLAUDE_CONFIG_DIR: 'c', ANTHROPIC_API_KEY: 'a' });
  assert.deepEqual(cleanEnv(env, 'codex'), { PATH: 'p', OPENAI_API_KEY: 'o', CODEX_HOME: 'h' });
});

test('drafter: Claude Code runs without tools, MCP, settings or session, prompt on stdin, in a removed temp directory', async () => {
  const seen = {};
  const script = readStdin + "const a=process.argv.slice(1);console.log(JSON.stringify({type:'result',subtype:'success',is_error:false,num_turns:2,permission_denials:[],modelUsage:{'claude-test-model':{}},structured_output:{draft:'stdin:'+input.includes('SOURCE-MARKER-42')+' args:'+a.some(x=>x.includes('SOURCE-MARKER-42')),notes:[]}}));});";
  const drafter = createDrafter({ env: { DRAFT_ENGINE: 'claude', CLAUDE_COMMAND: process.execPath, PATH: process.env.PATH, TYPESAFE_API_KEY: 'must-not-pass' }, spawnImpl: child(script, seen) });
  const result = await drafter.draft(request);
  assert.deepEqual(result, { draft: 'stdin:true args:false', notes: [], engine: 'claude', model: 'claude-test-model' });
  assert.equal(seen.options.shell, false); assert.equal(seen.options.windowsHide, true); assert.equal(seen.options.env.TYPESAFE_API_KEY, undefined);
  assert.notEqual(path.resolve(seen.options.cwd), repo); assert.ok(path.resolve(seen.options.cwd).startsWith(path.resolve(os.tmpdir()))); assert.equal(existsSync(seen.options.cwd), false);
  const toolsAt = seen.args.indexOf('--tools');
  assert.equal(seen.args[toolsAt + 1], ''); for (const flag of ['-p', '--restricted', '--safe-mode', '--strict-mcp-config', '--no-session-persistence', '--disable-slash-commands', '--json-schema']) assert.ok(seen.args.includes(flag), flag);
  assert.deepEqual(seen.args, claudeArgs({ model: '', budget: '' }));
});

test('drafter: Claude Code tool attempts, failures and timeouts are refused', async () => {
  const result = extra => readStdin + `console.log(JSON.stringify({type:'result',subtype:'success',is_error:false,structured_output:{draft:'x',notes:[]},...${JSON.stringify(extra)}}));});`;
  const run = (script, timeoutMs) => createDrafter({ env: { DRAFT_ENGINE: 'claude', CLAUDE_COMMAND: process.execPath, PATH: process.env.PATH }, spawnImpl: child(script), timeoutMs }).draft(request);
  await rejectsCode(run(result({ permission_denials: [{ tool_name: 'Bash' }] })), 'DRAFT_TOOL_USE');
  await rejectsCode(run(result({ usage: { server_tool_use: { web_fetch_requests: 1 } } })), 'DRAFT_TOOL_USE');
  await rejectsCode(run(result({ subtype: 'error_max_turns', is_error: true })), 'DRAFT_PROVIDER_ERROR');
  await rejectsCode(run('setTimeout(()=>{},60000)', 300), 'DRAFT_TIMEOUT');
  await rejectsCode(createDrafter({ env: { DRAFT_ENGINE: 'claude', CLAUDE_COMMAND: path.join(os.tmpdir(), 'no-such-claude-binary.exe'), PATH: process.env.PATH } }).draft(request), 'DRAFT_ENGINE_UNAVAILABLE');
});

test('drafter: Codex runs read-only, ephemeral, tools disabled, schema file and final message in its temp directory', async () => {
  const seen = {};
  const script = readStdin + "const fs=require('fs'),a=process.argv.slice(1),o=a[a.indexOf('-o')+1],s=a[a.indexOf('--output-schema')+1];const schema=JSON.parse(fs.readFileSync(s,'utf8'));console.log(JSON.stringify({type:'thread.started'}));console.log(JSON.stringify({type:'item.completed',item:{type:'reasoning',text:'r'}}));console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'m'}}));fs.writeFileSync(o,JSON.stringify({draft:'stdin:'+input.includes('SOURCE-MARKER-42')+' schema:'+schema.required.join(','),notes:['n']}));console.log(JSON.stringify({type:'turn.completed',usage:{input_tokens:1}}));});";
  const result = await createDrafter({ env: { DRAFT_ENGINE: 'codex', CODEX_COMMAND: process.execPath, CODEX_MODEL: 'gpt-test', PATH: process.env.PATH, GOOGLE_CLIENT_SECRET: 'no' }, spawnImpl: child(script, seen) }).draft(request);
  assert.deepEqual(result, { draft: 'stdin:true schema:draft,notes', notes: ['n'], engine: 'codex', model: 'gpt-test' });
  assert.equal(seen.options.shell, false); assert.equal(seen.options.env.GOOGLE_CLIENT_SECRET, undefined); assert.equal(existsSync(seen.options.cwd), false);
  assert.deepEqual(seen.args.slice(0, 3), ['exec', '--sandbox', 'read-only']); assert.equal(seen.args.at(-1), '-');
  for (const flag of ['--ephemeral', '--skip-git-repo-check', '--ignore-user-config', '--ignore-rules', '--json']) assert.ok(seen.args.includes(flag), flag);
  assert.ok(seen.args.join(' ').includes('--disable shell_tool')); assert.ok(!seen.args.some(a => /dangerously/.test(a))); assert.ok(!seen.args.some(a => a.includes('SOURCE-MARKER-42')));
  assert.deepEqual(seen.args, codexArgs({ model: 'gpt-test' }, seen.options.cwd));
});

test('drafter: a Codex command, file or web item stops the run', async () => {
  const run = type => createDrafter({ env: { DRAFT_ENGINE: 'codex', CODEX_COMMAND: process.execPath, PATH: process.env.PATH }, spawnImpl: child(readStdin + `console.log(JSON.stringify({type:'item.started',item:{type:'${type}',command:'type secrets.txt'}}));setTimeout(()=>{},5000);});`) }).draft(request);
  for (const type of ['command_execution', 'file_change', 'mcp_tool_call', 'web_search']) await rejectsCode(run(type), 'DRAFT_TOOL_USE');
});

async function withServer(options, fn) { const app = createApp(options); app.listen(0, '127.0.0.1'); await once(app, 'listening'); const base = `http://127.0.0.1:${app.address().port}`; try { await fn(base); } finally { app.closeAllConnections(); await new Promise(r => app.close(r)); } }
const post = (base, body, headers = {}) => fetch(base + '/api/draft', { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json', 'X-Essentiel-Request': '1', ...headers }, body: JSON.stringify(body) });

test('drafter HTTP: consent, origin, bounds and configuration are checked before any engine call', async () => {
  let calls = 0;
  const drafter = { describe: () => ({ engine: 'openai', model: 'm', local: true, configured: true }), draft: async r => { calls++; return { draft: 'Brouillon', notes: [], engine: 'openai', model: 'm', echo: r.text }; } };
  await withServer({ apiKey: '', drafter }, async base => {
    assert.equal((await post(base, { ...request, consent: false })).status, 400);
    assert.equal((await post(base, { ...request, consent: true }, { Origin: 'https://evil.test' })).status, 403);
    assert.equal((await post(base, { ...request, consent: true }, { 'X-Essentiel-Request': '0' })).status, 403);
    assert.equal((await post(base, { ...request, consent: true, text: 'x'.repeat(8001) })).status, 400);
    assert.equal(calls, 0);
    const ok = await post(base, { ...request, consent: true }); assert.equal(ok.status, 200); assert.equal((await ok.json()).draft, 'Brouillon'); assert.equal(calls, 1);
  });
  await withServer({ apiKey: '', drafter: createDrafter({ env: {} }) }, async base => { const r = await post(base, { ...request, consent: true }); assert.equal(r.status, 503); assert.equal((await r.json()).code, 'DRAFT_NOT_CONFIGURED'); });
});

test('drafter HTTP: config describes the engine without key or URL; unexpected errors are not reflected', async () => {
  const drafter = createDrafter({ env: openaiEnv({ LLM_BASE_URL: 'https://secret-host.example/v1', LLM_API_KEY: 'sk-secret-123' }), fetchImpl: async () => { throw new Error('never'); } });
  await withServer({ apiKey: '', drafter }, async base => {
    const text = await (await fetch(base + '/api/config')).text();
    assert.ok(!text.includes('secret-host') && !text.includes('sk-secret-123')); const d = JSON.parse(text).draft; assert.deepEqual({ engine: d.engine, model: d.model, local: d.local, configured: d.configured }, { engine: 'openai', model: 'llama3.2', local: false, configured: true }); assert.deepEqual(d.engines.map(e => e.id), ['openai']); assert.equal(d.default, 'openai');
  });
  await withServer({ apiKey: '', drafter: { describe: () => ({ configured: true }), draft: async () => { throw new Error('C:\\Users\\someone\\secret stderr'); } } }, async base => {
    const r = await post(base, { ...request, consent: true }), body = await r.json();
    assert.equal(r.status, 502); assert.equal(body.code, 'DRAFT_FAILED'); assert.ok(!body.error.includes('secret'));
  });
});
