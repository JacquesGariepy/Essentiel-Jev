/** Local AI activity journal: every TypeSafe Jev call and every drafting-engine call, as sent and as received.
 * Memory only, never written to disk. Cleared on vault lock/erase, on account disconnect (entries sourced from
 * that account), on request, and at shutdown. Secrets are redacted before anything is stored. */
export const AI_LOG_LIMITS = Object.freeze({ entries: 300, field: 200_000, items: 400, depth: 32 });
export const AI_LOG_KINDS = ['typesafe.analyze', 'typesafe.evaluate', 'typesafe.models', 'draft.reply', 'draft.summary'];
// What a CLI adds to every request on its own (observed 2026-09-19, docs/LLM-DRAFTING.md). Codes are rendered by the UI.
export const CLI_ADDS = Object.freeze({ claude: ['account_email', 'os', 'date', 'temp_path'], codex: ['temp_path', 'shell', 'date', 'time_zone'], agy: ['os', 'shell', 'app_data_path', 'date', 'time_zone', 'model_name', 'tool_catalog'] });
const PATTERNS = [
  [/Bearer\s+[A-Za-z0-9._~+/=-]{8,}/g, 'Bearer [REDACTED]'],
  [/\bsk-[A-Za-z0-9_-]{16,}/g, '[REDACTED]'], [/\bya29\.[A-Za-z0-9._-]{10,}/g, '[REDACTED]'], [/\b1\/\/[A-Za-z0-9._-]{20,}/g, '[REDACTED]'],
  [/\bGOCSPX-[A-Za-z0-9_-]{10,}/g, '[REDACTED]'], [/\bgh[pousr]_[A-Za-z0-9]{20,}/g, '[REDACTED]'],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{8,}/g, '[REDACTED]']
];

export function createJournal({ limit = AI_LOG_LIMITS.entries, fieldCap = AI_LOG_LIMITS.field, secrets = () => [], now = () => Date.now() } = {}) {
  let entries = [], seq = 0, rev = 0, epoch = 1;
  const secretList = () => { let list = []; try { list = secrets(); } catch {} return [...new Set(list.filter(s => typeof s === 'string' && s.length >= 8))].sort((a, b) => b.length - a.length); };
  const text = (s, keys) => {
    for (const k of keys) if (s.includes(k)) s = s.split(k).join('[REDACTED]');
    for (const [re, to] of PATTERNS) s = s.replace(re, to);
    return s.length > fieldCap ? s.slice(0, fieldCap) + `…[truncated ${s.length - fieldCap} characters]` : s;
  };
  const clean = (value, keys, depth = 0) => {
    if (typeof value === 'string') return text(value, keys);
    if (value === null || typeof value !== 'object') return typeof value === 'bigint' ? String(value) : value;
    if (depth > AI_LOG_LIMITS.depth) return '[nested too deeply]';
    if (Array.isArray(value)) { const out = value.slice(0, AI_LOG_LIMITS.items).map(v => clean(v, keys, depth + 1)); if (value.length > AI_LOG_LIMITS.items) out.push(`…[${value.length - AI_LOG_LIMITS.items} more items not kept]`); return out; }
    const out = {}; for (const [k, v] of Object.entries(value)) if (v !== undefined && typeof v !== 'function') out[k] = clean(v, keys, depth + 1); return out;
  };
  const touch = e => { e.rev = ++rev; };
  const find = id => entries.find(e => e.id === id);
  const summary = e => ({ id: e.id, rev: e.rev, time: e.time, route: e.route, kind: e.kind, engine: e.engine, source: e.source, label: e.label || '', status: e.status, modelRequested: e.modelRequested || '', modelReturned: e.modelReturned || '', latencyMs: e.latencyMs ?? null, usage: e.usage || null, errorCode: e.error?.code || '' });
  return {
    /** Opens a pending entry and returns its id. */
    start({ route, kind, engine, source = 'local', label = '', modelRequested = '', ...details }) {
      const keys = secretList(), id = 'AI' + String(++seq).padStart(6, '0');
      const e = { id, time: new Date(now()).toISOString(), startedAt: now(), route, kind, engine, source, label: text(String(label).slice(0, 200), keys), status: 'pending', modelRequested, ...clean(details, keys) };
      touch(e); entries.push(e); if (entries.length > limit) entries = entries.slice(-limit);
      return id;
    },
    /** Merges details (redacted); a terminal status also records the latency. */
    update(id, patch = {}) {
      const e = find(id); if (!e) return;
      Object.assign(e, clean(patch, secretList()));
      if (['ok', 'error', 'rejected'].includes(e.status) && e.latencyMs == null) e.latencyMs = now() - e.startedAt;
      touch(e);
    },
    list(after = 0) { const since = Number.isSafeInteger(Number(after)) ? Number(after) : 0; return { epoch, rev, capacity: limit, count: entries.length, entries: entries.filter(e => e.rev > since).map(summary).reverse() }; },
    get(id) { const e = find(id); return e ? structuredClone(e) : null; },
    all() { return structuredClone(entries).reverse(); },
    /** Removes every entry, or those matching `predicate`. Clients resynchronize on a new epoch. */
    clear(predicate) { const before = entries.length; entries = predicate ? entries.filter(e => !predicate(e)) : []; if (entries.length !== before || !predicate) { epoch++; rev++; } return before - entries.length; },
    get size() { return entries.length; }
  };
}

/** Readable per-question view of a TypeSafe answer set: every option with its probability, the choice, confidence. */
export function explainAnswers(questions, answers) {
  if (!questions || typeof questions !== 'object') return [];
  return Object.entries(questions).map(([id, q]) => {
    const a = answers && typeof answers === 'object' ? answers[id] : undefined, p = a?.probabilities && typeof a.probabilities === 'object' ? a.probabilities : {};
    const base = { id, type: q?.type, instructions: q?.instructions ?? '', returned: a !== undefined };
    if (q?.type === 'noul') return { ...base, noul: a?.noul ?? null, criteria: q.criteria || null };
    if (q?.type === 'score') return { ...base, score: a?.score ?? null, confidence: a?.confidence ?? null, levels: (Array.isArray(q.criteria) ? q.criteria : []).map((description, i) => ({ key: String(i), description, probability: p[String(i)] ?? null })) };
    const criteria = q?.criteria && typeof q.criteria === 'object' ? q.criteria : {};
    return { ...base, choice: a?.choice ?? null, confidence: a?.confidence ?? null, options: Object.entries(criteria).map(([key, description]) => ({ key, description, probability: p[key] ?? null, chosen: a?.choice === key })) };
  });
}
