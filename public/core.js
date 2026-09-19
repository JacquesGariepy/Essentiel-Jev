/** Local deterministic engines, shared by the browser and Node tests. */
export const APP_VERSION = '0.2.0';
export const STORAGE_KEY = 'essentiel.workspace.v2';
export const CURRENCIES = ['CAD', 'USD', 'EUR', 'GBP'];
export const CAPS = { records: 200, tasks: 2000, routines: 100, transactions: 2000, subscriptions: 200, savings: 100, lists: 2000, notes: 500, decisions: 100, runs: 100, audit: 500, budgets: 240 };
export const uid = () => { if (globalThis.crypto?.randomUUID) return crypto.randomUUID(); const b=crypto.getRandomValues(new Uint8Array(16)); b[6]=(b[6]&15)|64; b[8]=(b[8]&63)|128; const h=Array.from(b,x=>x.toString(16).padStart(2,'0')).join(''); return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`; };
export const clone = v => JSON.parse(JSON.stringify(v));
export const localDay = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export function isDate(v) {
  if (typeof v !== 'string' || !/^20\d{2}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(v + 'T00:00:00Z');
  return Number.isFinite(d.valueOf()) && d.toISOString().slice(0, 10) === v;
}
export function addDays(day, n) {
  if (!isDate(day) || !Number.isSafeInteger(n) || Math.abs(n) > 40000) throw new Error('Invalid date offset.');
  const d = new Date(day + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}
export function dayDiff(a, b) { if (!isDate(a) || !isDate(b)) throw new Error('Invalid date.'); return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000); }
export function weekDays(day) {
  const dow = new Date(day + 'T00:00:00Z').getUTCDay();
  const first = addDays(day, -(dow + 6) % 7); return Array.from({ length: 7 }, (_, i) => addDays(first, i));
}
export function nextDate(day, repeat, anchorDay = Number(day?.slice(-2))) {
  if (!isDate(day)) throw new Error('A recurring task needs a valid date.');
  if (repeat === 'daily') return addDays(day, 1);
  if (repeat === 'weekly') return addDays(day, 7);
  if (!['monthly', 'yearly'].includes(repeat)) return null;
  const d = new Date(day + 'T00:00:00Z');
  const originalMonth = d.getUTCMonth();
  d.setUTCDate(1);
  if (repeat === 'monthly') d.setUTCMonth(originalMonth + 1); else d.setUTCFullYear(d.getUTCFullYear() + 1);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(Math.max(1, anchorDay), last)); return d.toISOString().slice(0, 10);
}
const plainObj = v => !!v && typeof v === 'object' && !Array.isArray(v) && [Object.prototype, null].includes(Object.getPrototypeOf(v));
export function safeJSON(v, depth = 0) {
  if (depth > 18) throw new Error('Import is nested too deeply.');
  if (v === null || typeof v === 'string' || typeof v === 'boolean') return;
  if (typeof v === 'number' && Number.isFinite(v)) return;
  if (Array.isArray(v)) { v.forEach(x => safeJSON(x, depth + 1)); return; }
  if (!plainObj(v)) throw new Error('Invalid JSON value.');
  for (const [k, child] of Object.entries(v)) {
    if (['__proto__', 'constructor', 'prototype'].includes(k)) throw new Error('Unsafe object key.');
    safeJSON(child, depth + 1);
  }
}
function text(v, max = 200, required = false) {
  if (v === undefined || v === null) v = '';
  if (typeof v !== 'string' || v.length > max || (required && !v.trim())) throw new Error(`Expected ${required ? 'non-empty ' : ''}text, at most ${max} characters.`);
  return v.trim();
}
function id(v) { if (v === undefined || v === '') return uid(); if (typeof v !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(v)) throw new Error('Invalid record identifier.'); return v; }
function enumValue(v, values, fallback) { if (v === undefined || v === null || v === '') return fallback; if (!values.includes(v)) throw new Error('Unsupported option.'); return v; }
function integer(v, min, max, fallback = min) { if (v === undefined || v === null || v === '') return fallback; if (!Number.isSafeInteger(v) || v < min || v > max) throw new Error(`Expected an integer between ${min} and ${max}.`); return v; }
function dateValue(v) { if (!v) return ''; if (!isDate(v)) throw new Error('Use a valid date between 2000 and 2099.'); return v; }
const base = v => { if (!plainObj(v)) throw new Error('Invalid item.'); return { id: id(v.id), title: text(v.title, 200, true), synthetic: v.synthetic === true }; };
export function normalizeTask(v) {
  const b = base(v);
  const blockedBy = v.blockedBy || [];
  if (!Array.isArray(blockedBy) || blockedBy.length > 30) throw new Error('Too many dependencies.');
  const checklist = v.checklist || [];
  if (!Array.isArray(checklist) || checklist.length > 40) throw new Error('Too many checklist entries.');
  return { ...b, notes: text(v.notes, 8000), domain: text(v.domain || 'time', 80), due: dateValue(v.due), notBefore: dateValue(v.notBefore), snoozedUntil: dateValue(v.snoozedUntil),
    minutes: integer(v.minutes, 1, 1440, 15), energy: integer(v.energy, 1, 3, 2), priority: integer(v.priority, 0, 2, 1),
    status: enumValue(v.status, ['open', 'done', 'paused', 'cancelled'], 'open'), repeat: enumValue(v.repeat, ['none', 'daily', 'weekly', 'monthly', 'yearly'], 'none'),
    anchorDay: integer(v.anchorDay, 1, 31, Number((v.due || localDay()).slice(-2))), owner: text(v.owner, 120), sourceId: v.sourceId ? id(v.sourceId) : '',
    project: text(v.project, 160), blockedBy: [...new Set(blockedBy.map(id))],
    checklist: checklist.map(c => ({ text: text(c.text, 300, true), done: c.done === true })),
    completedAt: text(v.completedAt, 80), seriesId: v.seriesId ? id(v.seriesId) : b.id, recurrenceOf: v.recurrenceOf ? id(v.recurrenceOf) : '' };
}
export function assertTaskGraph(tasks) {
  const map = new Map(tasks.map(t => [t.id, t]));
  if (map.size !== tasks.length) throw new Error('Duplicate task ids.');
  const visited = new Set(), visiting = new Set();
  const visit = t => {
    if (visiting.has(t.id)) throw new Error('Task dependency cycle.');
    if (visited.has(t.id)) return;
    visiting.add(t.id);
    for (const parent of t.blockedBy) {
      if (!map.has(parent)) throw new Error('A task dependency is missing.');
      visit(map.get(parent));
    }
    visiting.delete(t.id); visited.add(t.id);
  };
  tasks.forEach(visit); return true;
}
export function blockingTasks(task, tasks) { const map = new Map(tasks.map(t => [t.id, t])); return task.blockedBy.filter(k => !map.has(k) || !['done', 'cancelled'].includes(map.get(k).status)); }
export function completeTask(tasks, taskId, day = localDay()) {
  if (!isDate(day)) throw new Error('Invalid completion date.');
  const task = tasks.find(t => t.id === taskId);
  if (!task || task.status === 'done') return { task, next: null };
  if (blockingTasks(task, tasks).length) throw new Error('Complete or explicitly cancel the dependencies first.');
  if (task.checklist.some(c => !c.done)) throw new Error('Complete the checklist before closing this task.');
  let next = null;
  if (task.repeat !== 'none' && !tasks.some(t => t.recurrenceOf === task.id)) {
    let due = nextDate(task.due || day, task.repeat, task.anchorDay), guard = 0;
    while (due && due <= day && isDate(due) && guard++ < 40000) due = nextDate(due, task.repeat, task.anchorDay);
    if (due && isDate(due)) next = normalizeTask({ ...task, id: uid(), status: 'open', due, notBefore: '', snoozedUntil: '', completedAt: '', blockedBy: [], checklist: task.checklist.map(c => ({ ...c, done: false })), recurrenceOf: task.id });
  }
  task.status = 'done'; task.completedAt = day;
  if (next) tasks.push(next);
  return { task, next };
}
export function planDay(tasks, { day = localDay(), minutes = 120, energy = 2, reserve = 20 } = {}) {
  if (!isDate(day)) throw new Error('Invalid planning date.');
  integer(minutes, 1, 1440); integer(energy, 1, 3); integer(reserve, 0, 80);
  const capacity = Math.floor(minutes * (100 - reserve) / 100);
  const available = tasks.filter(t => t.status === 'open' && (!t.notBefore || t.notBefore <= day) && (!t.snoozedUntil || t.snoozedUntil <= day) && !blockingTasks(t, tasks).length);
  const score = t => (t.due && t.due < day ? 1000 : t.due === day ? 500 : 0) + (2 - t.priority) * 100 + (t.due ? Math.max(0, 30 - Math.max(0, dayDiff(day, t.due))) : 0);
  available.sort((a, b) => score(b) - score(a) || (a.due || '9999').localeCompare(b.due || '9999') || a.minutes - b.minutes || a.id.localeCompare(b.id));
  let used = 0; const selected = [], overflow = [];
  for (const t of available) {
    if (t.energy > energy || used + t.minutes > capacity) overflow.push({ id: t.id, reason: t.energy > energy ? 'energy' : 'capacity' });
    else { selected.push(t.id); used += t.minutes; }
  }
  return { day, selected, overflow, capacity, used, reserveMinutes: minutes - capacity, algorithm: 'deadline-priority-fit-v1' };
}
export function routineDue(routine, day = localDay()) {
  const dow = new Date(day + 'T00:00:00Z').getUTCDay();
  return routine.days.includes(dow) && (!routine.start || day >= routine.start) && !routine.paused;
}
export function parseMoney(input) {
  const value = String(input).trim().replace(',', '.');
  if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(value)) throw new Error('Use a non-negative amount with at most two decimals.');
  const [whole, fraction = ''] = value.split('.');
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return integer(minor, 0, 999999999999);
}
export function monthlyEquivalent(minor, cadence) {
  integer(minor, 0, 999999999999);
  const ratio = { monthly: [1, 1], yearly: [1, 12], weekly: [52, 12], quarterly: [1, 3] }[cadence];
  if (!ratio) throw new Error('Invalid billing frequency.');
  return Math.round(minor * ratio[0] / ratio[1]);
}
export function moneySummary(transactions, subscriptions, month, currency) {
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month) || !CURRENCIES.includes(currency)) throw new Error('Invalid money filter.');
  const rows = transactions.filter(t => t.date.startsWith(month) && t.currency === currency);
  const income = rows.filter(t => t.direction === 'income').reduce((s, t) => s + t.amountMinor, 0);
  const expenses = rows.filter(t => t.direction === 'expense').reduce((s, t) => s + t.amountMinor, 0);
  const recurring = subscriptions.filter(s => s.active && s.currency === currency).reduce((s, sub) => s + monthlyEquivalent(sub.amountMinor, sub.cadence), 0);
  return { income, expenses, balance: income - expenses, recurring, rows, otherCurrencies: [...new Set(transactions.filter(t => t.currency !== currency).map(t => t.currency))] };
}
export function savingsProjection(goal) { const remaining = Math.max(0, goal.targetMinor - goal.savedMinor); return { remaining, months: remaining === 0 ? 0 : goal.monthlyMinor > 0 ? Math.ceil(remaining / goal.monthlyMinor) : null }; }
export function rankDecision(decision) {
  const totalWeight = decision.criteria.reduce((s, c) => s + c.weight, 0);
  if (totalWeight <= 0) throw new Error('At least one criterion needs a positive weight.');
  return decision.options.map(o => {
    const missing = decision.criteria.filter(c => c.weight > 0 && (typeof o.scores[c.id] !== 'number' || !Number.isFinite(o.scores[c.id]))).map(c => c.id);
    const score = missing.length ? null : decision.criteria.reduce((s, c) => s + (o.scores[c.id] || 0) * c.weight, 0) / totalWeight;
    const budgetKnown = decision.budgetMinor === null || (o.costMinor !== null && o.currency === decision.currency);
    const withinBudget = decision.budgetMinor === null || (budgetKnown && o.costMinor <= decision.budgetMinor);
    const eligible = o.gate === 'yes' && budgetKnown && withinBudget && score !== null;
    return { id: o.id, score, missing, eligible, reason: o.gate !== 'yes' ? 'constraint' : !budgetKnown ? 'cost-unknown' : !withinBudget ? 'budget' : missing.length ? 'incomplete' : 'eligible' };
  }).sort((a, b) => Number(b.eligible) - Number(a.eligible) || (b.score ?? -1) - (a.score ?? -1));
}
export function csv(rows) {
  const cell = v => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
  return '\ufeff' + rows.map(row => row.map(cell).join(',')).join('\r\n');
}
export function calendarFile(items, lang = 'en') {
  const esc = v => String(v || '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/\r/g, '').replace(/;/g, '\\;').replace(/,/g, '\\,');
  const fold = line => { let out = '', n = 0; for (const c of line) { const bytes = new TextEncoder().encode(c).length; if (n + bytes > 75) { out += '\r\n '; n = 1; } out += c; n += bytes; } return out; };
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:-//Essentiel//Manual Calendar Export//${lang.toUpperCase()}`, 'CALSCALE:GREGORIAN'];
  for (const item of items) {
    if (!isDate(item.due)) throw new Error('Confirm a date before exporting a reminder.');
    lines.push('BEGIN:VEVENT', `UID:${esc(id(item.id))}@essentiel.local`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${item.due.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${addDays(item.due, 1).replace(/-/g, '')}`, `SUMMARY:${esc(item.title)}`, `DESCRIPTION:${esc(item.notes || '')}`, 'TRANSP:TRANSPARENT', 'END:VEVENT');
  }
  lines.push('END:VCALENDAR'); return lines.map(fold).join('\r\n') + '\r\n';
}
export function freshWorkspace(lang = 'fr') {
  return { schemaVersion: 2, appVersion: APP_VERSION, name: '', lang, theme: 'light', largeText: false, reducedMotion: false, goals: [], enabledDomains: [], currency: 'CAD', dayMinutes: 120, dayEnergy: 2, dayReserve: 20,
    records: [], tasks: [], routines: [], budgets: [], transactions: [], subscriptions: [], savings: [], lists: [], notes: [], decisions: [], runs: [], audit: [], plan: null, focus: null };
}
export function normalizeRecord(v, { internal = false } = {}) {
  if (!plainObj(v)) throw new Error('Invalid source document.');
  const record = { id: id(v.id), title: text(v.title || 'Untitled document', 200, true), source: text(v.source || 'Manual import', 200), text: text(v.text, 8000, true), receivedAt: text(v.receivedAt, 80), bucket: 'pending', mode: 'pending', flags: [], reason: '', suggestedDate: null, confirmedDate: null, evidence: '', action: 'UNKNOWN', kind: 'UNKNOWN', history: [], synthetic: v.synthetic === true || v.mode === 'demo' };
  if (internal) {
    for (const key of ['bucket', 'mode', 'flags', 'reason', 'suggestedDate', 'confirmedDate', 'evidence', 'action', 'kind', 'history', 'synthetic', 'suggestedBucket', 'evidenceId', 'answers', 'usage', 'model', 'ruleset', 'evaluatedAt', 'goal', 'fingerprint', 'reasonCode', 'flagCodes', 'userDecision', 'locale', 'titleI18n', 'sourceI18n', 'textI18n']) if (v[key] !== undefined) record[key] = clone(v[key]);
    if (!['pending', 'act', 'review', 'read', 'archived'].includes(record.bucket)) throw new Error('Invalid document bucket.');
    if (!['pending', 'live', 'demo', 'error'].includes(record.mode)) throw new Error('Invalid document mode.');
    if (record.evidence && !record.text.includes(record.evidence)) throw new Error('Evidence is not present in the source.');
    if (record.confirmedDate && !isDate(record.confirmedDate)) throw new Error('Invalid confirmed date.');
    if (record.suggestedDate && !isDate(record.suggestedDate)) throw new Error('Invalid suggested date.');
  }
  return record;
}
export function normalizeRoutine(v) {
  const b = base(v), days = v.days ?? [1, 2, 3, 4, 5];
  if (!Array.isArray(days) || !days.length || days.length > 7 || days.some(d => !Number.isInteger(d) || d < 0 || d > 6)) throw new Error('Choose at least one routine day.');
  const checks = v.checks || [];
  if (!Array.isArray(checks) || checks.length > 3660 || checks.some(d => !isDate(d))) throw new Error('Invalid routine history.');
  return { ...b, domain: text(v.domain || 'time', 80), minutes: integer(v.minutes, 1, 1440, 10), days: [...new Set(days)], checks: [...new Set(checks)], start: dateValue(v.start), paused: v.paused === true, notes: text(v.notes, 3000) };
}
export function normalizeBudget(v) { if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(v.month)) throw new Error('Invalid budget month.'); return { id: id(v.id), month: v.month, currency: enumValue(v.currency, CURRENCIES, 'CAD'), amountMinor: integer(v.amountMinor, 0, 999999999999) }; }
export function normalizeTransaction(v) { return { ...base(v), direction: enumValue(v.direction, ['income', 'expense'], 'expense'), amountMinor: integer(v.amountMinor, 1, 999999999999), currency: enumValue(v.currency, CURRENCIES, 'CAD'), category: text(v.category || 'Other', 80), date: dateValue(v.date) || localDay(), notes: text(v.notes, 2000) }; }
export function normalizeSubscription(v) { return { ...base(v), amountMinor: integer(v.amountMinor, 0, 999999999999), currency: enumValue(v.currency, CURRENCIES, 'CAD'), cadence: enumValue(v.cadence, ['monthly', 'yearly', 'weekly', 'quarterly'], 'monthly'), renewal: dateValue(v.renewal), active: v.active !== false, notes: text(v.notes, 2000) }; }
export function normalizeSaving(v) { return { ...base(v), currency: enumValue(v.currency, CURRENCIES, 'CAD'), targetMinor: integer(v.targetMinor, 1, 999999999999), savedMinor: integer(v.savedMinor, 0, 999999999999, 0), monthlyMinor: integer(v.monthlyMinor, 0, 999999999999, 0) }; }
export function normalizeListItem(v) { return { ...base(v), list: text(v.list || 'Shopping', 120), quantity: text(v.quantity || '1', 80), kind: enumValue(v.kind, ['shopping', 'pantry', 'packing', 'meal', 'custom'], 'shopping'), category: text(v.category, 80), date: dateValue(v.date), checked: v.checked === true, notes: text(v.notes, 4000), ingredients: text(v.ingredients, 2000) }; }
export function normalizeNote(v) { return { ...base(v), kind: enumValue(v.kind, ['note', 'contact', 'document', 'asset', 'journal', 'idea'], 'note'), domain: text(v.domain || 'clarity', 80), body: text(v.body, 12000), date: dateValue(v.date), tags: text(v.tags, 300), contact: text(v.contact, 300), location: text(v.location, 400) }; }
export function normalizeDecision(v) {
  const b = base(v);
  if (!Array.isArray(v.criteria) || v.criteria.length < 1 || v.criteria.length > 6 || !Array.isArray(v.options) || v.options.length < 2 || v.options.length > 6) throw new Error('A decision needs 1–6 criteria and 2–6 options.');
  const criteria = v.criteria.map(c => ({ id: id(c.id), name: text(c.name, 200, true), weight: integer(c.weight, 0, 10, 1) }));
  if (new Set(criteria.map(c => c.id)).size !== criteria.length) throw new Error('Duplicate criterion ids.');
  const options = v.options.map(o => ({ id: id(o.id), name: text(o.name, 160, true), description: text(o.description, 3000), gate: enumValue(o.gate, ['yes', 'no', 'unknown'], 'unknown'), costMinor: o.costMinor === null || o.costMinor === undefined ? null : integer(o.costMinor, 0, 999999999999), currency: enumValue(o.currency || v.currency, CURRENCIES, 'CAD'), scores: Object.fromEntries(criteria.map(c => { const score = o.scores?.[c.id]; if (score !== undefined && score !== null && (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 5)) throw new Error('Scores must be between zero and five.'); return [c.id, score ?? null]; })) }));
  if (new Set(options.map(o => o.id)).size !== options.length) throw new Error('Duplicate option ids.');
  const d = { ...b, criteria, options, domain: text(v.domain || 'goals', 80), context: text(v.context, 6000), constraints: text(v.constraints, 3000), currency: enumValue(v.currency, CURRENCIES, 'CAD'), budgetMinor: v.budgetMinor === null || v.budgetMinor === undefined ? null : integer(v.budgetMinor, 0, 999999999999), selectedId: text(v.selectedId, 80), selectedAt: text(v.selectedAt, 80), outcome: text(v.outcome, 3000), reviewDate: dateValue(v.reviewDate) };
  if (d.selectedId && !options.some(o => o.id === d.selectedId)) throw new Error('Selected option is missing.');
  rankDecision(d); return d;
}
export function normalizeWorkspace(raw, { internal = false } = {}) {
  safeJSON(raw);
  if (!plainObj(raw)) throw new Error('Invalid workspace.');
  if (JSON.stringify(raw).length > 8000000) throw new Error('Workspace exceeds 8 MB.');
  if (raw.schemaVersion !== undefined && ![1, 2].includes(raw.schemaVersion)) throw new Error('Unsupported workspace version.');
  const out = freshWorkspace(enumValue(raw.lang, ['fr', 'en'], 'fr'));
  out.name = text(raw.name, 100); out.theme = enumValue(raw.theme, ['light', 'dark'], 'light'); out.largeText = raw.largeText === true; out.reducedMotion = raw.reducedMotion === true;
  out.gates = { confidence: 0.75, noulLow: 0.15, noulHigh: 0.85 };
  if (raw.gates && [raw.gates.confidence, raw.gates.noulLow, raw.gates.noulHigh].every(v => typeof v === 'number' && v >= 0 && v <= 1) && raw.gates.noulLow < 0.5 && raw.gates.noulHigh > 0.5) out.gates = clone(raw.gates);
  out.currency = enumValue(raw.currency, CURRENCIES, 'CAD'); out.dayMinutes = integer(raw.dayMinutes, 1, 1440, 120); out.dayEnergy = integer(raw.dayEnergy, 1, 3, 2); out.dayReserve = integer(raw.dayReserve, 0, 80, 20);
  if (raw.goals && (!Array.isArray(raw.goals) || raw.goals.length > 4)) throw new Error('Use at most four explicit priorities.');
  out.goals = (raw.goals || []).map(g => text(g, 180, true));
  if (raw.enabledDomains && (!Array.isArray(raw.enabledDomains) || raw.enabledDomains.length > 40)) throw new Error('Invalid space selection.');
  out.enabledDomains = (raw.enabledDomains || []).map(d => text(d, 80, true));
  const normalizers = { records: v => normalizeRecord(v, { internal }), tasks: normalizeTask, routines: normalizeRoutine, transactions: normalizeTransaction, subscriptions: normalizeSubscription, savings: normalizeSaving, lists: normalizeListItem, notes: normalizeNote, decisions: normalizeDecision, budgets: normalizeBudget };
  for (const [key, fn] of Object.entries(normalizers)) {
    const values = raw[key] || []; if (!Array.isArray(values) || values.length > CAPS[key]) throw new Error(`${key}: item limit exceeded.`);
    out[key] = values.map(fn);
    if (new Set(out[key].map(v => v.id)).size !== out[key].length) throw new Error(`${key}: duplicate ids.`);
  }
  assertTaskGraph(out.tasks);
  const sourceIds = new Set(out.records.map(r => r.id));
  for (const task of out.tasks) if (task.sourceId && !sourceIds.has(task.sourceId)) task.sourceId = '';
  if (internal) {
    for (const key of ['runs', 'audit']) {
      if (raw[key] && (!Array.isArray(raw[key]) || raw[key].length > CAPS[key])) throw new Error(`${key}: history limit exceeded.`);
      out[key] = clone(raw[key] || []);
    }
    out.plan = raw.plan ? clone(raw.plan) : null; out.focus = raw.focus ? clone(raw.focus) : null;
  } else {
    // Imported predictions are historical only; they do not enter evaluation metrics or permissions.
    out.runs = (Array.isArray(raw.runs) ? raw.runs.slice(-CAPS.runs) : []).map(r => ({ ...clone(r), mode: 'imported-unverified' }));
    out.audit = [{ type: 'workspace.imported', at: new Date().toISOString(), actor: 'human', detail: 'Sources require fresh analysis; imported predictions remain unverified.' }];
    // Synthetic markers are retained: restoring a backup must not disguise fictional examples as real data.
    // A marker never grants trust; model histories remain unverified regardless.
  }
  return out;
}
const b64 = bytes => { let out = ''; for (let i = 0; i < bytes.length; i += 16384) out += String.fromCharCode(...bytes.subarray(i, i + 16384)); return btoa(out); };
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function deriveKey(password, salt, iterations) {
  if (!globalThis.crypto?.subtle) throw new Error('Web Crypto is unavailable in this browser context.');
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export async function encryptBackup(workspace, password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 1000) throw new Error('Use a backup passphrase of 12–1000 characters.');
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12)), iterations = 250000;
  const key = await deriveKey(password, salt, iterations);
  const content = new TextEncoder().encode(JSON.stringify(workspace));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode('essentiel-backup-v1'), tagLength: 128 }, key, content);
  return { format: 'essentiel-encrypted', version: 1, kdf: 'PBKDF2-SHA256', cipher: 'AES-256-GCM', iterations, salt: b64(salt), iv: b64(iv), ciphertext: b64(new Uint8Array(encrypted)) };
}
export async function decryptBackup(envelope, password) {
  if (envelope?.format !== 'essentiel-encrypted' || envelope.version !== 1 || envelope.kdf !== 'PBKDF2-SHA256' || envelope.cipher !== 'AES-256-GCM' || !Number.isSafeInteger(envelope.iterations) || envelope.iterations < 100000 || envelope.iterations > 500000 || typeof envelope.ciphertext !== 'string' || envelope.ciphertext.length > 12000000) throw new Error('Unsupported or oversized encrypted backup.');
  try {
    const salt = unb64(envelope.salt), iv = unb64(envelope.iv);
    if (salt.length !== 16 || iv.length !== 12) throw new Error('Invalid encryption parameters.');
    const key = await deriveKey(password, salt, envelope.iterations);
    const bytes = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode('essentiel-backup-v1'), tagLength: 128 }, key, unb64(envelope.ciphertext));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch { throw new Error('Wrong passphrase or damaged encrypted backup. Nothing was imported.'); }
}

/** Small RFC-4180-style parser; quoted commas and newlines are handled, never evaluated. */
export function parseCSV(input) {
  if (typeof input !== 'string' || input.length > 2000000) throw new Error('CSV exceeds 2 MB.');
  input = input.replace(/^\ufeff/, '');
  const rows = []; let row = [], value = '', quoted = false, closed = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (quoted) { if (c === '"') { if (input[i + 1] === '"') { value += '"'; i++; } else { quoted = false; closed = true; } } else value += c; continue; }
    if (c === '"') { if (value || closed) throw new Error('Malformed CSV quoting.'); quoted = true; }
    else if (c === ',') { row.push(value); value = ''; closed = false; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && input[i + 1] === '\n') i++; row.push(value); if (row.some(v => v !== '')) rows.push(row); row = []; value = ''; closed = false; }
    else { if (closed) throw new Error('Unexpected text after a CSV quote.'); value += c; }
  }
  if (quoted) throw new Error('Unclosed CSV quote.');
  row.push(value); if (row.some(v => v !== '')) rows.push(row);
  return rows;
}
export function parseMoneyCSV(input) {
  const [head, ...rows] = parseCSV(input);
  const required = ['title', 'direction', 'amount', 'currency', 'date', 'category'];
  if (!head || head.length !== required.length || required.some((h, i) => head[i].trim() !== h)) throw new Error('CSV columns must be title,direction,amount,currency,date,category in that order.');
  if (rows.length > CAPS.transactions) throw new Error('Too many CSV transactions.');
  return rows.map((row, index) => {
    if (row.length !== head.length) throw new Error(`CSV row ${index + 2} has the wrong number of fields.`);
    const [title, direction, amount, currency, date, category] = row;
    if (!isDate(date)) throw new Error(`CSV row ${index + 2} needs a valid explicit date.`);
    return normalizeTransaction({ title, direction, amountMinor: parseMoney(amount), currency, date, category });
  });
}
