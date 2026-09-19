import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../server.mjs';
import { createDrafter, draftConfigs, agyArgs, DraftError } from '../lib/drafter.mjs';

// No live call: CLIs are `node -e` stand-ins receiving the exact arguments.
const request = { kind: 'reply', lang: 'fr', text: 'Pouvez-vous confirmer ? SOURCE-MARKER-9', instructions: '' };
const readStdin = "let input='';process.stdin.on('data',c=>input+=c);process.stdin.on('end',()=>{";
const child = (script, seen) => (command, args, options) => { seen && Object.assign(seen, { command, args, options }); return spawn(process.execPath, ['-e', script, '--', ...args], options); };
const rejectsCode = (promise, code) => assert.rejects(promise, e => e instanceof DraftError && e.code === code);
const exe = process.platform === 'win32' ? '.exe' : '';

test('engines: DRAFT_ENGINES lists several engines, the first configured is the default; DRAFT_ENGINE stays supported', () => {
  const env = { DRAFT_ENGINES: 'codex, claude,claude,none', CODEX_COMMAND: process.execPath, CLAUDE_COMMAND: process.execPath };
  const d = createDrafter({ env }).describe();
  assert.deepEqual(d.engines.map(e => [e.id, e.configured]), [['codex', true], ['claude', true]]); assert.equal(d.default, 'codex'); assert.equal(d.engine, 'codex');
  assert.ok(!JSON.stringify(d).includes(process.execPath) && !JSON.stringify(d).includes(path.dirname(process.execPath)));
  assert.deepEqual(draftConfigs({ DRAFT_ENGINE: 'agy', AGY_COMMAND: process.execPath }).map(c => c.id), ['agy']);
  assert.equal(draftConfigs({ DRAFT_ENGINES: 'claude,gpt' })[1].configured, false);
});

test('engines: DRAFT_ENGINES=auto keeps only CLIs found on PATH (no batch wrappers) and openai only when URL and model are set', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'essentiel-path-'));
  try {
    await writeFile(path.join(dir, 'agy' + exe), ''); await writeFile(path.join(dir, 'claude.cmd'), '@echo off');
    const auto = env => draftConfigs({ PATH: dir, DRAFT_ENGINES: 'auto', ...env }).map(c => c.id);
    assert.deepEqual(auto({}), ['agy']);
    assert.deepEqual(auto({ LLM_BASE_URL: 'http://127.0.0.1:11434/v1', LLM_MODEL: 'llama3.2' }), ['agy', 'openai']);
    assert.deepEqual(auto({ LLM_BASE_URL: 'http://127.0.0.1:11434/v1' }), ['agy']);
    const agy = draftConfigs({ PATH: dir, DRAFT_ENGINES: 'auto' })[0]; assert.equal(agy.command, path.join(dir, 'agy' + exe));
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('engines: the person picks the engine per draft; an engine not offered is refused before any call', async () => {
  const script = readStdin + "const fs=require('fs'),a=process.argv.slice(1);if(a.includes('exec')){const o=a[a.indexOf('-o')+1];fs.writeFileSync(o,JSON.stringify({draft:'from codex',notes:[]}));console.log(JSON.stringify({type:'turn.completed'}));}else console.log(JSON.stringify({type:'result',subtype:'success',is_error:false,structured_output:{draft:'from claude',notes:[]}}));});";
  const drafter = createDrafter({ env: { DRAFT_ENGINES: 'claude,codex', CLAUDE_COMMAND: process.execPath, CODEX_COMMAND: process.execPath, PATH: process.env.PATH }, spawnImpl: child(script) });
  assert.equal((await drafter.draft({ ...request, engine: 'codex' })).draft, 'from codex');
  assert.equal((await drafter.draft(request)).engine, 'claude');
  await rejectsCode(drafter.draft({ ...request, engine: 'agy' }), 'DRAFT_ENGINE_UNAVAILABLE');
  const app = createApp({ apiKey: '', drafter }); app.listen(0, '127.0.0.1'); await once(app, 'listening');
  const base = `http://127.0.0.1:${app.address().port}`, post = body => fetch(base + '/api/draft', { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json', 'X-Essentiel-Request': '1' }, body: JSON.stringify(body) });
  try {
    const cfg = await (await fetch(base + '/api/config')).json(); assert.deepEqual(cfg.draft.engines.map(e => e.id), ['claude', 'codex']); assert.equal(cfg.draft.default, 'claude');
    const refused = await post({ ...request, consent: true, engine: 'agy' }); assert.equal(refused.status, 400); assert.equal((await refused.json()).code, 'DRAFT_ENGINE_UNAVAILABLE');
    assert.equal((await post({ ...request, consent: true, engine: 'gpt' })).status, 400); assert.equal(app.journal.size, 0);
    const ok = await (await post({ ...request, consent: true, engine: 'codex' })).json(); assert.equal(ok.engine, 'codex');
    const entry = app.journal.get(ok.aiLogId); assert.equal(entry.engine, 'Codex'); assert.equal(entry.request.engine, 'codex');
  } finally { app.closeAllConnections(); await new Promise(r => app.close(r)); }
});

const agyEvents = extra => readStdin + `const line=JSON.parse(input.trim());const out=e=>console.log(JSON.stringify(e));out({event:'init',init:{cwd:process.cwd(),tools:['run_command','finish']}});${extra};});`;
const finishRun = "out({event:'step_update',step_update:{step_type:'agent_response',state:'DONE',text_delta:'x'}});out({event:'step_update',step_update:{step_type:'tool',tool_name:'finish',tool_info:{name:'finish',parameters:{draft:'Brouillon agy',notes:['n']}}}});out({event:'step_update',step_update:{step_type:'finish',state:'DONE'}});out({event:'result',result:{status:'SUCCESS',response:'{}',structured_output:{draft:'stdin:'+line.message.content.includes('SOURCE-MARKER-9')+' rules:'+line.message.content.includes('untrusted data'),notes:['n']}}})";

test('engines: agy runs sandboxed with a schema, prompt as one stdin JSON line, allowlisted env, empty temp dir; its terminal finish step is accepted', async () => {
  const seen = {};
  const drafter = createDrafter({ env: { DRAFT_ENGINE: 'agy', AGY_COMMAND: process.execPath, PATH: process.env.PATH, GEMINI_API_KEY: 'g', TYPESAFE_API_KEY: 'must-not-pass', ANTHROPIC_API_KEY: 'no' }, spawnImpl: child(agyEvents(finishRun), seen) });
  const trace = {}, result = await drafter.draft(request, trace);
  assert.deepEqual(result, { draft: 'stdin:true rules:true', notes: ['n'], engine: 'agy', model: '' });
  assert.deepEqual(seen.args, agyArgs({ model: '' })); for (const flag of ['--sandbox', '--json-schema', '--input-format', '--output-format', '--print-timeout']) assert.ok(seen.args.includes(flag), flag);
  assert.ok(!seen.args.some(a => a.includes('SOURCE-MARKER-9')) && !seen.args.includes('--dangerously-skip-permissions'));
  assert.equal(seen.options.shell, false); assert.equal(seen.options.env.GEMINI_API_KEY, 'g'); assert.equal(seen.options.env.TYPESAFE_API_KEY, undefined); assert.equal(seen.options.env.ANTHROPIC_API_KEY, undefined);
  assert.ok(path.resolve(seen.options.cwd).startsWith(path.resolve(os.tmpdir()))); assert.equal(existsSync(seen.options.cwd), false);
  assert.ok(trace.events.some(e => e.step_update?.tool_name === 'finish')); assert.deepEqual(trace.cliAdds, ['os', 'shell', 'app_data_path', 'date', 'time_zone', 'model_name', 'tool_catalog']);
});

test('engines: agy tool or subagent events, a disguised finish step, a failed status or a second result are refused', async () => {
  const run = extra => createDrafter({ env: { DRAFT_ENGINE: 'agy', AGY_COMMAND: process.execPath, PATH: process.env.PATH }, spawnImpl: child(agyEvents(extra)) }).draft(request);
  await rejectsCode(run("out({event:'step_update',step_update:{step_type:'tool',tool_name:'run_command',tool_info:{name:'run_command'}}});setTimeout(()=>{},5000)"), 'DRAFT_TOOL_USE');
  await rejectsCode(run("out({event:'step_update',step_update:{step_type:'tool',tool_name:'finish',tool_info:{name:'write_file'}}});setTimeout(()=>{},5000)"), 'DRAFT_TOOL_USE');
  await rejectsCode(run("out({event:'step_update',step_update:{step_type:'tool',tool_name:'finish',subagent_info:{id:'s'}}});setTimeout(()=>{},5000)"), 'DRAFT_TOOL_USE');
  await rejectsCode(run("out({event:'result',result:{status:'FAILURE',error:'quota'}})"), 'DRAFT_PROVIDER_ERROR');
  await rejectsCode(run("out({event:'result',result:{status:'SUCCESS',structured_output:{draft:'a',notes:[]}}});out({event:'result',result:{status:'SUCCESS'}})"), 'DRAFT_INVALID');
});
