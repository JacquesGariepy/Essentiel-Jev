import { safeDiagnostic } from './lib/connected/provider-errors.mjs';
import http from 'node:http';
import { ConnectedService } from './lib/connected/service.mjs';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { normalizeItem, normalizeGoals, buildCandidates, validateAnswers, applyPolicy, failedRecord, isISODate, RULESET_VERSION } from './lib/domain.mjs';
import { buildQuestions, buildState } from './lib/questions.mjs';
import { askJev, listJevModels } from './lib/provider.mjs';
import { validateRequest, validateTypedAnswers, SYSTEMONE_LIMITS } from './public/systemone.js';
import { demoRecords, DEMO_GOALS } from './lib/demo.mjs';
import { createDrafter, validateDraftRequest, DraftError } from './lib/drafter.mjs';
import { createJournal, explainAnswers, AI_LOG_LIMITS } from './lib/ai-journal.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
if (existsSync(path.join(root, '.env'))) process.loadEnvFile(path.join(root, '.env'));

const headers = {
  'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
};
const staticFiles = new Map([
  ...['core','systemone','catalog','i18n','demo'].map(name => [`/${name}.js`, [`public/${name}.js`, 'text/javascript; charset=utf-8']]),
  ['/', ['public/index.html', 'text/html; charset=utf-8']],
  ['/workspace', ['public/index.html', 'text/html; charset=utf-8']],
  ['/connected.js', ['public/connected.js', 'text/javascript; charset=utf-8']],
  ['/connected.css', ['public/connected.css', 'text/css; charset=utf-8']],
  ['/connected-scoped.css', ['public/connected-scoped.css', 'text/css; charset=utf-8']],
  ['/app.js', ['public/app.js', 'text/javascript; charset=utf-8']],
  ['/styles.css', ['public/styles.css', 'text/css; charset=utf-8']]
]);
const JEV_ENDPOINT = 'https://api.typesafe.ai/v1/systemone', SECRET_ENV = ['TYPESAFE_API_KEY', 'LLM_API_KEY', 'GOOGLE_CLIENT_SECRET', 'MICROSOFT_CLIENT_SECRET', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY'];
// Formatted mail frame: no script, no remote image or font (tracking pixels), no form, no plugin; links may only open a new tab.
const MAIL_CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'self'; sandbox allow-popups allow-popups-to-escape-sandbox";
const MAIL_FRAME = html => `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>body{margin:14px;font:14px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif;color:#182333;background:#fff;overflow-wrap:anywhere}img{max-width:100%;height:auto}table{max-width:100%}</style></head><body>${html}</body></html>`;
// Engines offered by a drafter; an injected drafter may still describe a single engine (legacy shape).
const offeredEngines = d => d?.engines || (d?.configured ? [{ id: d.engine || 'default', label: d.engine || 'default', model: d.model || '', local: Boolean(d.local), configured: true }] : []);
const sourceOf = body => ['google', 'microsoft'].includes(body?.sourceProvider) ? body.sourceProvider : 'local';
const engineOf = d => ({ claude: 'Claude Code', codex: 'Codex', agy: 'agy (Antigravity)', openai: d?.local ? 'OpenAI-compatible (local)' : 'OpenAI-compatible (remote)' })[d?.engine] || 'drafting engine';
// HTTP attempts for the journal; the successful body is kept once, as rawResponse.
const httpOf = t => t?.attempts ? { endpoint: t.endpoint, method: t.method, attempts: t.attempts.map(({ body, ...a }) => a.status >= 200 && a.status < 300 ? a : { ...a, ...(body ? { body } : {}) }) } : undefined;
const rawOf = t => t?.attempts?.find(a => a.status >= 200 && a.status < 300)?.body;
// Token usage reported by a drafting engine: Claude Code result, OpenAI-compatible body, or Codex turn.completed event.
const draftUsage = t => { let u = t?.result?.usage || t?.events?.findLast?.(e => e?.type === 'turn.completed')?.usage; if (!u && t?.rawResponse) try { u = JSON.parse(t.rawResponse).usage; } catch {} const i = u?.input_tokens ?? u?.prompt_tokens, o = u?.output_tokens ?? u?.completion_tokens; return Number.isFinite(i) || Number.isFinite(o) ? { input_tokens: Number.isFinite(i) ? i : null, output_tokens: Number.isFinite(o) ? o : null } : null; };
function json(res, status, data) {
  res.writeHead(status, { ...headers, 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}
async function readJson(req) {
  if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) throw new Error('Content-Type JSON requis.');
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 350_000) throw new Error('Requête trop volumineuse.');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new Error('JSON invalide.'); }
}

export function createApp({ apiKey = process.env.TYPESAFE_API_KEY || '', model = process.env.JEV_MODEL || 'jev-1.13.0', provider = askJev, modelsProvider = listJevModels, drafter = createDrafter(), connectorOptions = {} } = {}) {
  const connected = new ConnectedService({ filename: path.join(root, '.data', 'connected.vault'), ...connectorOptions });
  // Local AI activity journal: memory only, secrets redacted before storage (keys, OAuth client secrets, account tokens).
  const accountSecrets = () => { try { const clients = Object.values(connected.oauth?.config || {}).map(c => c.clientSecret); if (connected.vault.status().locked) return clients; return [...clients, ...Object.values(connected.vault.state().accounts || {}).flatMap(a => [a.accessToken, a.refreshToken])]; } catch { return []; } };
  const journal = createJournal({ secrets: () => [apiKey, ...SECRET_ENV.map(k => process.env[k]), ...(drafter.secrets?.() || []), ...accountSecrets()] });
  let active = 0;
  const calls = [];
  const server = http.createServer(async (req, res) => {
    try {
      const port = server.address()?.port;
      const allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
      if (!allowedHosts.has(req.headers.host)) return json(res, 403, { error: 'Hôte refusé. Serveur local uniquement.' });
      const url = new URL(req.url, `http://${req.headers.host}`);
      if(url.origin!==`http://${req.headers.host}`)return json(res,403,{error:'Request origin does not match local host.',code:'HOST_REJECTED'});
      // Fetch Metadata describes the entire redirect chain. A Google -> callback
      // -> / navigation may remain cross-site even after a successful exchange.
      // Only HTML document navigation is exempt, never API or subresource access.
      const topLevelNavigation=req.method==='GET'&&req.headers['sec-fetch-mode']==='navigate'&&req.headers['sec-fetch-dest']==='document';
      const hasFetchMetadata=['sec-fetch-site','sec-fetch-mode','sec-fetch-dest'].some(h=>req.headers[h]!==undefined);
      const oauthNavigation=topLevelNavigation||!hasFetchMetadata;
      const launch=/^\/oauth\/(google|microsoft)\/launch$/.exec(url.pathname);
      if(req.method==='GET'&&launch){
        if(!oauthNavigation)return json(res,403,{error:'OAuth requires top-level browser navigation.',code:'OAUTH_NAVIGATION_REQUIRED'});
        try{
          const auth=await connected.run(()=>connected.oauth.launch(launch[1],url.searchParams,url.origin));
          res.writeHead(303,{...headers,Location:auth.url,'Set-Cookie':auth.cookie});return res.end();
        }catch(error){
          res.writeHead(303,{...headers,Location:'/?connection_error='+encodeURIComponent(error.code||'OAUTH_FAILED')+'#connections'});return res.end();
        }
      }
      const callback = /^\/oauth\/(google|microsoft)\/callback$/.exec(url.pathname);
      if (req.method === 'GET' && callback) {
        if(!oauthNavigation)return json(res,403,{error:'OAuth requires top-level browser navigation.',code:'OAUTH_NAVIGATION_REQUIRED'});
        try {
          const result=await connected.run(() => connected.oauth.callback(callback[1], url.searchParams, req.headers.cookie || '',url.origin));
          const returnBase=result.returnOrigin===url.origin?'':result.returnOrigin;
          res.writeHead(303, {...headers, Location: returnBase+'/?connected=' + callback[1] + '#connections', 'Set-Cookie': `essentiel_oauth_${callback[1]}=; HttpOnly; SameSite=Lax; Path=/oauth/${callback[1]}/; Max-Age=0`});
          return res.end();
        } catch (error) {
          // Authorization codes, tokens and provider descriptions are never reflected or logged.
          res.writeHead(303, {...headers, Location: '/?connection_error=' + encodeURIComponent(error.code || 'OAUTH_FAILED') + '#connections'});
          return res.end();
        }
      }
      const safeLanding=topLevelNavigation&&['/','/workspace'].includes(url.pathname);
      if(req.headers['sec-fetch-site']==='cross-site'&&!safeLanding)return json(res,403,{error:'Requête intersite refusée.',code:'CROSS_SITE_REJECTED'});
      if (url.pathname.startsWith('/api/connected/')) {
        const origins = new Set([`http://127.0.0.1:${port}`, `http://localhost:${port}`]);
        if (req.headers['x-essentiel-request'] !== '1' || (req.method !== 'GET' && !origins.has(req.headers.origin))) return json(res,403,{error:'Same-origin connector request required.',code:'ORIGIN_REJECTED'});
        if (req.method === 'GET' && url.pathname === '/api/connected/status') return json(res,200,connected.status());
        if (req.method !== 'POST') return json(res,405,{error:'POST required.'});
        const body=await readJson(req), route=url.pathname.slice('/api/connected/'.length);
        try {
          if(route==='vault'){
            if(body.action==='erase' && body.confirm!=='ERASE')return json(res,400,{error:'Explicit ERASE confirmation required.'});
            const out=await connected.manageVault(body.action,body.password);if(['lock','erase'].includes(body.action))journal.clear();return json(res,200,out);
          }
          if(route==='disconnect'){const out=await connected.disconnect(body.provider);journal.clear(e=>e.source===body.provider);return json(res,200,out);}
          if(route==='oauth/start'){
            const auth=await connected.run(()=>connected.oauth.start(body.provider,body.features,req.headers.origin));
            if(auth.cookie)res.setHeader('Set-Cookie',auth.cookie);return json(res,200,{url:auth.url,requested:auth.requested});
          }
          const result=await connected.run(async()=>{
            if(route==='sync')return connected.sync(body.provider);
            if(route==='diagnostics')return connected.diagnostics(body.provider);
            if(route==='selection')return connected.select(body.provider,body.calendarIds,body.listId);
            if(route==='message')return connected.message(body.provider,body.id);
            if(route==='files')return connected.providers.files(body.provider,body.query);
            if(route==='slots')return connected.slots(body);
            if(route==='actions/preview')return connected.preview(body);
            if(route==='actions/execute')return connected.execute(body);
            if(route==='actions/cancel')return connected.cancel(body.id);
            if(route==='actions/verify')return connected.verify(body.id);
            throw Object.assign(new Error('Unknown connector route.'),{status:404,code:'NOT_FOUND'});
          });
          return json(res,200,result);
        } catch(error){return json(res,error.status||400,{error:error.message,code:error.code||'CONNECTOR_ERROR',...(safeDiagnostic(error)?{diagnostic:safeDiagnostic(error)}:{})});}
      }
      const mailView = /^\/mail-view\/(google|microsoft)\/([^/]{1,4000})$/.exec(url.pathname);
      if (req.method === 'GET' && mailView) {
        // Served only as a same-origin frame of the local page; the page adds sandbox, this response adds its own strict CSP.
        if (req.headers['sec-fetch-dest'] !== 'iframe' || req.headers['sec-fetch-site'] !== 'same-origin') return json(res, 403, { error: 'Formatted mail is only served to the local page, inside a sandboxed frame.', code: 'FRAME_ONLY' });
        let html; try { html = connected.mailView(mailView[1], decodeURIComponent(mailView[2])); } catch (error) { return json(res, error.status || 400, { error: error.message, code: error.code || 'INVALID_REQUEST' }); }
        if (!html) return json(res, 404, { error: 'Open the message again to load its formatted version.', code: 'NOT_FOUND' });
        res.writeHead(200, { ...headers, 'Content-Type': 'text/html; charset=utf-8', 'X-Frame-Options': 'SAMEORIGIN', 'Content-Security-Policy': MAIL_CSP });
        return res.end(MAIL_FRAME(html));
      }
      if (url.pathname === '/api/ai-log' || url.pathname.startsWith('/api/ai-log/')) {
        // Local transparency: exact requests and responses of Jev and drafting calls. Same local guards as the connector API.
        const origins = new Set([`http://127.0.0.1:${port}`, `http://localhost:${port}`]);
        if (req.headers['x-essentiel-request'] !== '1' || (req.method !== 'GET' && !origins.has(req.headers.origin))) return json(res, 403, { error: 'Same-origin request required.', code: 'ORIGIN_REJECTED' });
        const rest = url.pathname.slice('/api/ai-log'.length), entry = /^\/(AI\d{6,})$/.exec(rest);
        if (req.method === 'GET' && rest === '') return json(res, 200, journal.list(url.searchParams.get('after') || 0));
        if (req.method === 'GET' && rest === '/export') return json(res, 200, { app: 'Essentiel', exportedAt: new Date().toISOString(), note: 'Local AI activity journal (memory only). Secrets are redacted, but source excerpts are included: protect this file.', entries: journal.all() });
        if (req.method === 'GET' && entry) { const e = journal.get(entry[1]); return e ? json(res, 200, e) : json(res, 404, { error: `Entry not found. The journal keeps the last ${AI_LOG_LIMITS.entries} calls in memory.`, code: 'NOT_FOUND' }); }
        if (req.method === 'POST' && rest === '/clear') { await readJson(req); const cleared = journal.clear(); return json(res, 200, { cleared, ...journal.list(0) }); }
        return json(res, 404, { error: 'Route introuvable.', code: 'NOT_FOUND' });
      }
      if (req.method === 'GET' && staticFiles.has(url.pathname)) {
        const [filename, type] = staticFiles.get(url.pathname);
        res.writeHead(200, { ...headers, 'Content-Type': type });
        return res.end(await readFile(path.join(root, filename)));
      }
      if (req.method === 'GET' && url.pathname === '/api/config') {
        return json(res, 200, { configured: Boolean(apiKey), model, ruleset: RULESET_VERSION,
          nativeEndpoint: 'api.typesafe.ai', retention: 'Legacy workspace: browser-only. Connected accounts: server memory or optional encrypted local vault', maxTextLength: 8000, systemOneLimits: SYSTEMONE_LIMITS, maxRequestBytes: 350000, automaticExternalActions: false, draft: drafter.describe(), aiLog: { capacity: AI_LOG_LIMITS.entries, memoryOnly: true } });
      }
      if (req.method === 'GET' && url.pathname === '/api/demo') {
        const today = url.searchParams.get('today');
        if (!isISODate(today)) return json(res, 400, { error: 'Date ISO du jour requise.' });
        return json(res, 200, { records: demoRecords(today, url.searchParams.get('lang') === 'en' ? 'en' : 'fr'), goals: DEMO_GOALS, synthetic: true });
      }
      if (req.method === 'POST' && ['/api/evaluate', '/api/models'].includes(url.pathname)) {
        const origins = new Set([`http://127.0.0.1:${port}`, `http://localhost:${port}`]);
        if (!origins.has(req.headers.origin) || req.headers['x-essentiel-request'] !== '1') return json(res, 403, { error: 'Origin or protection header rejected.' });
        if (!apiKey) return json(res, 503, { error: 'TYPESAFE_API_KEY is missing. No live inference was performed.' });
        if (active >= 2) return json(res, 429, { error: 'Two provider requests are already running.' });
        const body = await readJson(req);
        if (body.consent !== true) return json(res, 400, { error: 'Explicit transmission consent is required.' });
        const request = url.pathname === '/api/evaluate' ? validateRequest(body) : null;
        const now = Date.now();
        while (calls.length && calls[0] < now - 60000) calls.shift();
        if (calls.length >= 60) return json(res, 429, { error: 'Local limit: 60 logical provider requests per minute.' });
        calls.push(now); active++;
        const trace = {}, logId = journal.start(request
          ? { route: url.pathname, kind: 'typesafe.evaluate', engine: 'TypeSafe Jev', source: sourceOf(body), label: `${Object.keys(request.questions).length} question(s)`, modelRequested: model, request: { endpoint: JEV_ENDPOINT, method: 'POST', body: { model, state: request.state, questions: request.questions } } }
          : { route: url.pathname, kind: 'typesafe.models', engine: 'TypeSafe Jev', source: 'local', label: 'models', request: { endpoint: 'https://api.typesafe.ai/v1/models', method: 'GET' } });
        let raw, stage = 'provider';
        try {
          if (!request) { const out = await modelsProvider({ apiKey, trace }); journal.update(logId, { status: 'ok', http: trace, response: out }); return json(res, 200, { ...out, aiLogId: logId }); }
          raw = await provider({ apiKey, model, ...request, trace });
          journal.update(logId, { response: raw, rawResponse: rawOf(trace), http: httpOf(trace), modelReturned: typeof raw?.model === 'string' ? raw.model : '', usage: raw?.usage ?? null });
          stage = 'validation';
          const answers = validateTypedAnswers(raw, request.questions);
          if (typeof raw.model !== 'string' || !raw.model.trim() || raw.model.length > 200) throw new Error('Missing provider model identity.');
          if (!raw.usage || !Number.isSafeInteger(raw.usage.input_tokens) || raw.usage.input_tokens < 0 || (raw.usage.output_tokens !== undefined && (!Number.isSafeInteger(raw.usage.output_tokens) || raw.usage.output_tokens < 0))) throw new Error('Invalid provider token usage.');
          journal.update(logId, { status: 'ok', validation: { ok: true, checks: 'typed answer contract, probability sums, argmax/weighted mean, model identity, token usage' }, answers: explainAnswers(request.questions, answers) });
          return json(res, 200, { model: raw.model, answers, usage: { input_tokens: raw.usage.input_tokens, ...(raw.usage.output_tokens === undefined ? {} : { output_tokens: raw.usage.output_tokens }) }, aiLogId: logId });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Provider evaluation failed. No synthetic replacement.';
          journal.update(logId, stage === 'validation' ? { status: 'rejected', validation: { ok: false, error: message }, answers: request ? explainAnswers(request.questions, raw?.answers) : undefined } : { status: 'error', error: { code: 'PROVIDER_ERROR', message }, http: request ? httpOf(trace) : trace });
          return json(res, 502, { error: message });
        }
        finally { active--; }
      }
      if (req.method === 'POST' && url.pathname === '/api/draft') {
        // Optional drafting engine: editable text only, never a judgment, approval or write. Same guards as Jev routes.
        const origins = new Set([`http://127.0.0.1:${port}`, `http://localhost:${port}`]);
        if (!origins.has(req.headers.origin) || req.headers['x-essentiel-request'] !== '1') return json(res, 403, { error: 'Origin or protection header rejected.', code: 'ORIGIN_REJECTED' });
        const offered = drafter.describe(), engines = offeredEngines(offered);
        if (!engines.some(e => e.configured)) return json(res, 503, { error: 'No drafting engine is configured (DRAFT_ENGINES or DRAFT_ENGINE). No draft was requested.', code: 'DRAFT_NOT_CONFIGURED' });
        if (active >= 2) return json(res, 429, { error: 'Two model requests are already running.', code: 'BUSY' });
        const body = await readJson(req);
        if (body.consent !== true) return json(res, 400, { error: 'Explicit transmission consent is required.', code: 'CONSENT_REQUIRED' });
        let request; try { request = validateDraftRequest(body); } catch (error) { return json(res, 400, { error: error.message, code: error.code || 'INVALID_DRAFT_REQUEST' }); }
        const chosen = engines.find(e => e.configured && e.id === (request.engine || offered.default || engines.find(x => x.configured).id));
        if (!chosen) return json(res, 400, { error: 'This drafting engine is not configured on this server. No draft was requested.', code: 'DRAFT_ENGINE_UNAVAILABLE' });
        const now = Date.now();
        while (calls.length && calls[0] < now - 60_000) calls.shift();
        if (calls.length >= 60) return json(res, 429, { error: 'Local limit: 60 logical model requests per minute.', code: 'RATE_LIMITED' });
        calls.push(now); active++;
        const trace = {};
        const logId = journal.start({ route: url.pathname, kind: 'draft.' + request.kind, engine: engineOf({ engine: chosen.id, local: chosen.local }), source: sourceOf(body), label: request.kind, modelRequested: chosen.model || '', request: { engine: chosen.id, kind: request.kind, lang: request.lang, instructions: request.instructions, text: request.text } });
        try { const out = await drafter.draft({ ...request, engine: chosen.id }, trace); journal.update(logId, { status: 'ok', modelReturned: out.model || '', usage: draftUsage(trace), ...(Number.isFinite(trace.result?.total_cost_usd) ? { costUsd: trace.result.total_cost_usd } : {}), exchange: trace, result: { draft: out.draft, notes: out.notes } }); return json(res, 200, { ...out, aiLogId: logId }); }
        // Engine output, stderr and provider bodies are never reflected; only fixed messages and codes. They stay in the local journal.
        catch (error) {
          const code = error instanceof DraftError ? error.code : 'DRAFT_FAILED', message = error instanceof DraftError ? error.message : 'Drafting failed. No draft substituted.';
          journal.update(logId, { status: ['DRAFT_TOOL_USE', 'DRAFT_INVALID', 'DRAFT_RESPONSE_LIMIT'].includes(code) ? 'rejected' : 'error', error: { code, message }, usage: draftUsage(trace), exchange: trace });
          return json(res, error instanceof DraftError ? error.status : 502, { error: message, code, aiLogId: logId });
        }
        finally { active--; }
      }
      if (req.method === 'POST' && url.pathname === '/api/analyze') {
        const origins = new Set([`http://127.0.0.1:${port}`, `http://localhost:${port}`]);
        if (!origins.has(req.headers.origin) || req.headers['x-essentiel-request'] !== '1') {
          return json(res, 403, { error: 'Origine ou en-tête de protection invalide.' });
        }
        if (!apiKey) return json(res, 503, { error: 'Clé TYPESAFE_API_KEY absente. Aucune analyse Jev effectuée.' });
        if (active >= 2) return json(res, 429, { error: 'Deux analyses sont déjà en cours.' });
        const body = await readJson(req);
        if (body.consent !== true) return json(res, 400, { error: 'Consentement de transmission à TypeSafe requis.' });
        const item = normalizeItem(body.item), goals = normalizeGoals(body.goals || []);
        if (!isISODate(body.today)) return json(res, 400, { error: 'Date du jour invalide.' });
        const candidates = buildCandidates(item.text), questions = buildQuestions(candidates, goals);
        const now = Date.now();
        while (calls.length && calls[0] < now - 60_000) calls.shift();
        if (calls.length >= 60) return json(res, 429, { error: 'Limite locale de 60 analyses par minute atteinte.' });
        calls.push(now);
        active++;
        const state = buildState(item, candidates), trace = {};
        const logId = journal.start({ route: url.pathname, kind: 'typesafe.analyze', engine: 'TypeSafe Jev', source: sourceOf(body), label: item.title, modelRequested: model, request: { endpoint: JEV_ENDPOINT, method: 'POST', body: { model, state, questions } } });
        let raw, stage = 'provider';
        try {
          raw = await provider({ apiKey, model, state, questions, trace });
          journal.update(logId, { response: raw, rawResponse: rawOf(trace), http: httpOf(trace), modelReturned: typeof raw?.model === 'string' ? raw.model : '', usage: raw?.usage ?? null });
          stage = 'validation';
          const answers = validateAnswers(raw, questions);
          const record = applyPolicy(item, candidates, answers, {
            today: body.today, model: typeof raw.model === 'string' ? raw.model : model, usage: raw.usage, goals
          });
          journal.update(logId, { status: 'ok', validation: { ok: true, checks: 'answer contract, probability sums, argmax' }, answers: explainAnswers(questions, answers), result: record });
          return json(res, 200, { record, aiLogId: logId });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Analyse interrompue.';
          journal.update(logId, stage === 'validation' ? { status: 'rejected', validation: { ok: false, error: message }, answers: explainAnswers(questions, raw?.answers) } : { status: 'error', error: { code: 'PROVIDER_ERROR', message }, http: httpOf(trace) });
          return json(res, 200, { record: failedRecord(item, message), aiLogId: logId });
        } finally { active--; }
      }
      return json(res, 404, { error: 'Route introuvable.' });
    } catch (error) {
      if (!res.headersSent) return json(res, 400, { error: error instanceof Error ? error.message : 'Requête invalide.' });
      res.end();
    }
  });
  server.drafter = drafter;
  server.journal = journal;
  server.connected = connected;
  server.requestTimeout = 60_000;
  server.headersTimeout = 10_000;
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const port = Number(process.env.PORT || 8787);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('PORT doit être un entier de 1024 à 65535.');
  const app = createApp();
  app.listen(port, '127.0.0.1', () => {
    console.log(`Essentiel: http://localhost:${port} (also available on 127.0.0.1)`);
    console.log('Connected cockpit: Google and Microsoft OAuth apps must be configured; no accounts are preconnected.');
    console.log(process.env.TYPESAFE_API_KEY ? 'Native TypeSafe API configured. Sending requires explicit browser consent.' : 'No TypeSafe key: connected tools still work; no live Jev inference.');
    const draft = app.drafter?.describe?.();
    console.log(draft?.configured ? `Drafting engine: ${draft.engine}${draft.model ? ' / ' + draft.model : ''} (optional, consent per request, drafts only).` : 'No drafting engine (DRAFT_ENGINE=none): Jev judgments and connected tools are unaffected.');
  });
  app.on('error', (error) => { console.error(`Server error: ${error.code || 'unknown'}`); process.exitCode = 1; });
}
