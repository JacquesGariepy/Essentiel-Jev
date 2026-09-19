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
            return json(res,200,await connected.manageVault(body.action,body.password));
          }
          if(route==='disconnect')return json(res,200,await connected.disconnect(body.provider));
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
      if (req.method === 'GET' && staticFiles.has(url.pathname)) {
        const [filename, type] = staticFiles.get(url.pathname);
        res.writeHead(200, { ...headers, 'Content-Type': type });
        return res.end(await readFile(path.join(root, filename)));
      }
      if (req.method === 'GET' && url.pathname === '/api/config') {
        return json(res, 200, { configured: Boolean(apiKey), model, ruleset: RULESET_VERSION,
          nativeEndpoint: 'api.typesafe.ai', retention: 'Legacy workspace: browser-only. Connected accounts: server memory or optional encrypted local vault', maxTextLength: 8000, systemOneLimits: SYSTEMONE_LIMITS, maxRequestBytes: 350000, automaticExternalActions: false, draft: drafter.describe() });
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
        try {
          if (!request) return json(res, 200, await modelsProvider({ apiKey }));
          const raw = await provider({ apiKey, model, ...request });
          const answers = validateTypedAnswers(raw, request.questions);
          if (typeof raw.model !== 'string' || !raw.model.trim() || raw.model.length > 200) throw new Error('Missing provider model identity.');
          if (!raw.usage || !Number.isSafeInteger(raw.usage.input_tokens) || raw.usage.input_tokens < 0 || (raw.usage.output_tokens !== undefined && (!Number.isSafeInteger(raw.usage.output_tokens) || raw.usage.output_tokens < 0))) throw new Error('Invalid provider token usage.');
          return json(res, 200, { model: raw.model, answers, usage: { input_tokens: raw.usage.input_tokens, ...(raw.usage.output_tokens === undefined ? {} : { output_tokens: raw.usage.output_tokens }) } });
        } catch (error) { return json(res, 502, { error: error instanceof Error ? error.message : 'Provider evaluation failed. No synthetic replacement.' }); }
        finally { active--; }
      }
      if (req.method === 'POST' && url.pathname === '/api/draft') {
        // Optional drafting engine: editable text only, never a judgment, approval or write. Same guards as Jev routes.
        const origins = new Set([`http://127.0.0.1:${port}`, `http://localhost:${port}`]);
        if (!origins.has(req.headers.origin) || req.headers['x-essentiel-request'] !== '1') return json(res, 403, { error: 'Origin or protection header rejected.', code: 'ORIGIN_REJECTED' });
        if (!drafter.describe().configured) return json(res, 503, { error: 'No drafting engine is configured (DRAFT_ENGINE). No draft was requested.', code: 'DRAFT_NOT_CONFIGURED' });
        if (active >= 2) return json(res, 429, { error: 'Two model requests are already running.', code: 'BUSY' });
        const body = await readJson(req);
        if (body.consent !== true) return json(res, 400, { error: 'Explicit transmission consent is required.', code: 'CONSENT_REQUIRED' });
        let request; try { request = validateDraftRequest(body); } catch (error) { return json(res, 400, { error: error.message, code: error.code || 'INVALID_DRAFT_REQUEST' }); }
        const now = Date.now();
        while (calls.length && calls[0] < now - 60_000) calls.shift();
        if (calls.length >= 60) return json(res, 429, { error: 'Local limit: 60 logical model requests per minute.', code: 'RATE_LIMITED' });
        calls.push(now); active++;
        try { return json(res, 200, await drafter.draft(request)); }
        // Engine output, stderr and provider bodies are never reflected; only fixed messages and codes.
        catch (error) { return json(res, error instanceof DraftError ? error.status : 502, { error: error instanceof DraftError ? error.message : 'Drafting failed. No draft substituted.', code: error instanceof DraftError ? error.code : 'DRAFT_FAILED' }); }
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
        try {
          const raw = await provider({ apiKey, model, state: buildState(item, candidates), questions });
          const answers = validateAnswers(raw, questions);
          return json(res, 200, { record: applyPolicy(item, candidates, answers, {
            today: body.today, model: typeof raw.model === 'string' ? raw.model : model, usage: raw.usage, goals
          }) });
        } catch (error) {
          return json(res, 200, { record: failedRecord(item, error instanceof Error ? error.message : 'Analyse interrompue.') });
        } finally { active--; }
      }
      return json(res, 404, { error: 'Route introuvable.' });
    } catch (error) {
      if (!res.headersSent) return json(res, 400, { error: error instanceof Error ? error.message : 'Requête invalide.' });
      res.end();
    }
  });
  server.drafter = drafter;
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
