import { setTimeout as wait } from 'node:timers/promises';
const ENDPOINT = 'https://api.typesafe.ai/v1/systemone';

/** Native TypeSafe HTTP contract. No speculative OpenRouter chat adapter.
 * `trace` (optional, local AI journal only) receives each HTTP attempt and the raw bodies; nothing is logged elsewhere. */
export async function askJev({ apiKey, model = 'jev-1.13.0', state, questions, fetchImpl = fetch, waitImpl = wait, trace = null }) {
  if (!apiKey) throw new Error('Clé TYPESAFE_API_KEY absente. Aucun appel à Jev effectué.');
  let lastStatus;
  if (trace) Object.assign(trace, { endpoint: ENDPOINT, method: 'POST', attempts: [] });
  for (let attempt = 0; attempt < 2; attempt++) {
    let response; const started = Date.now();
    try {
      response = await fetchImpl(ENDPOINT, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(20000),
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, state, questions })
      });
    } catch {
      // Never log request bodies, API keys, or raw upstream errors.
      trace?.attempts.push({ attempt: attempt + 1, error: 'network error or timeout', ms: Date.now() - started });
      throw new Error('Connexion à Jev interrompue ou délai dépassé. Aucun résultat substitué.');
    }
    lastStatus = response.status;
    const record = trace ? { attempt: attempt + 1, status: response.status, ms: Date.now() - started, requestId: response.headers.get('x-request-id') || '', retryAfter: response.headers.get('retry-after') || '' } : null;
    if (record) trace.attempts.push(record);
    if (response.ok) {
      const body = await response.text();
      if (record) record.body = body;
      if (body.length > 1_000_000) throw new Error('Réponse Jev trop volumineuse.');
      try { return JSON.parse(body); } catch { throw new Error('Réponse Jev non JSON.'); }
    }
    if (record) record.body = await response.text().catch(() => '');
    if ([429, 529].includes(response.status) && attempt === 0) {
      if (!record) await response.body?.cancel();
      const header = response.headers.get('retry-after');
      const seconds = Number(header);
      const retryDate = header && !Number.isFinite(seconds) ? Date.parse(header) : NaN;
      const delay = header && Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : Number.isFinite(retryDate) ? Math.max(0, retryDate - Date.now()) : 1000;
      if (delay > 5000) throw new Error(`TypeSafe demande une attente supérieure au budget local (HTTP ${response.status}). Réessayer plus tard; aucun nouvel appel anticipé.`);
      await waitImpl(delay);
      continue;
    }
    if (!record) await response.body?.cancel();
    const messages = {
      401: 'Clé TypeSafe rejetée (401).', 403: 'Accès TypeSafe refusé (403).',
      422: 'Requête rejetée par TypeSafe (422). Vérifier le contrat API et la version du modèle.',
      429: 'Limite de débit TypeSafe atteinte (429).', 529: 'TypeSafe est temporairement surchargé (529).'
    };
    throw new Error(messages[response.status] || `Échec TypeSafe (HTTP ${response.status}).`);
  }
  throw new Error(`Échec TypeSafe (HTTP ${lastStatus}).`);
}

/** Metadata only. The local UI still requires an explicit user action. */
export async function listJevModels({ apiKey, fetchImpl = fetch, trace = null }) {
  if (!apiKey) throw new Error('TYPESAFE_API_KEY is missing.');
  let response; if (trace) Object.assign(trace, { endpoint: 'https://api.typesafe.ai/v1/models', method: 'GET' });
  try { response = await fetchImpl('https://api.typesafe.ai/v1/models', { method: 'GET', redirect: 'error', headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(15000) }); }
  catch { throw new Error('Model lookup failed or timed out.'); }
  if (trace) trace.status = response.status;
  if (!response.ok) { if (trace) trace.body = await response.text().catch(() => ''); else await response.body?.cancel(); throw new Error(`Model lookup failed (HTTP ${response.status}).`); }
  const text = await response.text(); if (trace) trace.body = text; if (text.length > 1000000) throw new Error('Model list too large.');
  const value = JSON.parse(text);
  if (!Array.isArray(value.models) || value.models.length > 500) throw new Error('Unexpected models response.');
  return { models: value.models.map(m => ({ name: String(m.name || '').slice(0,200), description: String(m.description || '').slice(0,4000), release_date: m.release_date ?? null })) };
}
