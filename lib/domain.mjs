import { createHash, randomUUID } from 'node:crypto';

export const RULESET_VERSION = 'essentiel-2026-09-19.1';
export const CONFIDENCE_THRESHOLD = 0.75; // Provisional routing heuristic; NOT calibrated accuracy.
export const MAX_TEXT_LENGTH = 8000;
export const MAX_ITEMS = 40;
export const ACTIONS = Object.freeze({
  NONE: 'Aucune demande explicite', RESPOND: 'Répondre', CONFIRM: 'Confirmer',
  PROVIDE: 'Fournir une information', ATTEND: 'Vérifier un rendez-vous',
  REVIEW: 'Examiner une demande', UNKNOWN: 'Demande à préciser'
});
export const BUCKETS = Object.freeze({
  act: 'À traiter', review: 'À vérifier', read: 'À lire', archived: 'Classés', pending: 'Non analysés'
});

export function isISODate(value) {
  if (typeof value !== 'string' || !/^20\d{2}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(d.valueOf()) && d.toISOString().slice(0, 10) === value;
}
export function daysBetween(from, to) {
  if (!isISODate(from) || !isISODate(to)) throw new Error('Dates ISO invalides.');
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}
function boundedString(value, field, max, required = false) {
  if (value === undefined && !required) return '';
  if (typeof value !== 'string') throw new Error(`${field} doit être du texte.`);
  const text = value.trim();
  if (required && !text) throw new Error(`${field} est obligatoire.`);
  if (text.length > max) throw new Error(`${field} dépasse ${max} caractères. Découper le document.`);
  return text;
}
export function normalizeItem(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Document invalide.');
  const text = boundedString(value.text, 'Le contenu', MAX_TEXT_LENGTH, true);
  return {
    id: typeof value.id === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(value.id) ? value.id : randomUUID(),
    title: boundedString(value.title, 'Le titre', 200) || 'Document sans titre',
    source: boundedString(value.source, 'La source', 200) || 'Import manuel',
    text,
    receivedAt: boundedString(value.receivedAt, 'La date de réception', 80),
    fingerprint: createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex'),
  };
}
export function normalizeGoals(value) {
  if (!Array.isArray(value) || value.length > 4) throw new Error('Définir au maximum quatre priorités.');
  return value.map((v) => boundedString(v, 'La priorité', 180, true));
}
export function buildCandidates(text) {
  const segments = [];
  const segmenter = new Intl.Segmenter('fr', { granularity: 'sentence' });
  for (const line of text.split(/\r?\n/)) {
    for (const part of segmenter.segment(line)) {
      const snippet = part.segment.trim();
      if (snippet) segments.push(snippet);
    }
  }
  if (segments.length > 80) throw new Error('Plus de 80 passages : découper ce document.');
  const sentences = Object.fromEntries(segments.map((t, i) => [`S${i + 1}`, t]));
  const matches = [...text.matchAll(/\b20\d{2}-\d{2}-\d{2}\b/g)].map((m) => m[0]);
  const dates = [...new Set(matches.filter(isISODate))];
  if (dates.length > 20) throw new Error('Plus de 20 dates : découper ce document.');
  return { sentences, dates, invalidDates: matches.filter((d) => !isISODate(d)) };
}
function finiteProbability(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}
/** Reject incomplete or unexpected provider results; never repair a semantic answer silently. */
export function validateAnswers(raw, questions) {
  if (!raw || typeof raw !== 'object' || !raw.answers || Array.isArray(raw.answers)) {
    throw new Error('Réponse Jev sans réponses structurées.');
  }
  const expectedIds = Object.keys(questions);
  if (Object.keys(raw.answers).length !== expectedIds.length) throw new Error('Nombre de réponses Jev inattendu.');
  for (const [id, question] of Object.entries(questions)) {
    const answer = raw.answers[id];
    if (!answer || answer.type !== question.type) throw new Error(`Réponse Jev invalide : ${id}.`);
    if (question.type === 'noul') {
      if (!finiteProbability(answer.noul)) throw new Error(`Valeur Noul invalide : ${id}.`);
      continue;
    }
    if (question.type !== 'choice') throw new Error('Type de question non pris en charge par cette version.');
    if (!Object.hasOwn(question.criteria, answer.choice) || !finiteProbability(answer.confidence)) {
      throw new Error(`Choix ou confiance invalide : ${id}.`);
    }
    const probs = answer.probabilities;
    const keys = Object.keys(question.criteria);
    if (!probs || Object.keys(probs).length !== keys.length || keys.some((k) => !finiteProbability(probs[k]))) {
      throw new Error(`Distribution invalide : ${id}.`);
    }
    if (Math.abs(keys.reduce((sum, k) => sum + probs[k], 0) - 1) > 0.02) {
      throw new Error(`Distribution non normalisée : ${id}.`);
    }
    if (probs[answer.choice] + 1e-5 < Math.max(...keys.map((k) => probs[k]))) {
      throw new Error(`Choix incohérent avec sa distribution : ${id}.`);
    }
  }
  return raw.answers;
}

/** All routing is advisory. There is intentionally no automatic archive or external action. */
export function applyPolicy(item, candidates, answers, { today, model, usage = {}, mode = 'live', goals = [] }) {
  if (!isISODate(today)) throw new Error('Date du jour invalide.');
  const a = answers;
  const activeRequest = !['NONE', 'UNKNOWN'].includes(a.action.choice) && a.status.choice === 'PENDING';
  const sourceQuote = candidates.sentences[a.evidence.choice] || '';
  const date = candidates.dates.includes(a.deadline.choice) ? a.deadline.choice : null;
  const confidenceIds = ['action', 'status', 'evidence'];
  if (date) confidenceIds.push('deadline');
  const lowConfidence = confidenceIds.some((id) => a[id].confidence < CONFIDENCE_THRESHOLD);
  const flags = [];
  if (lowConfidence) flags.push('Certitude du modèle insuffisante selon le seuil expérimental.');
  if (a.sensitive.noul >= 0.35) flags.push('Demande sensible : examen personnel requis.');
  if (a.manipulation.noul >= 0.35) flags.push('Contenu potentiellement trompeur ou dirigé contre le classement.');
  if (!sourceQuote && activeRequest) flags.push('Aucun passage justificatif sélectionné.');
  if (a.deadline.choice === 'UNRESOLVED') flags.push('Une échéance pertinente ne peut pas être convertie en date ISO sans vérification.');
  if (candidates.invalidDates.length) flags.push('Le document contient une date ISO invalide.');
  if (date && !activeRequest) flags.push('Une date a été sélectionnée sans demande en attente cohérente.');
  if (date && a.time_reference.noul < 0.5) flags.push('Les évaluations sur la présence d’une échéance se contredisent.');
  if (activeRequest && a.time_reference.noul >= 0.5 && !date) {
    flags.push('Échéance relative, non ISO ou ambiguë : date à confirmer manuellement.');
  }
  if ((a.action.choice === 'NONE' && a.status.choice === 'PENDING') || (!['NONE', 'UNKNOWN'].includes(a.action.choice) && ['NONE', 'COMPLETED'].includes(a.status.choice))) {
    flags.push('Les évaluations de la demande et de son état se contredisent.');
  }
  if (a.action.choice === 'UNKNOWN' || a.status.choice === 'UNKNOWN') flags.push('Contexte insuffisant pour classer la demande.');
  if (a.status.choice === 'CONDITIONAL') flags.push('Demande conditionnelle : son application reste à vérifier.');
  let bucket = 'read';
  let reason = 'Aucune demande en attente identifiée. Le document reste accessible.';
  if (flags.length) {
    bucket = 'review';
    reason = flags[0];
  } else if (activeRequest) {
    bucket = 'act';
    reason = `Demande en attente détectée : ${ACTIONS[a.action.choice].toLowerCase()}.`;
  } else if (a.status.choice === 'COMPLETED') {
    reason = 'Le texte présente la demande comme déjà terminée ou annulée.';
  }
  const goalIndex = /^G[1-4]$/.test(a.goal.choice) ? Number(a.goal.choice.slice(1)) - 1 : -1;
  const goal = a.goal.confidence >= CONFIDENCE_THRESHOLD && goalIndex >= 0 ? goals[goalIndex] || null : null;
  return {
    ...item, bucket, suggestedBucket: bucket, reason, flags,
    evidence: sourceQuote, evidenceId: sourceQuote ? a.evidence.choice : null,
    action: a.action.choice, kind: a.kind.choice, goal,
    suggestedDate: date, confirmedDate: null, daysUntil: date ? daysBetween(today, date) : null,
    evaluatedAt: new Date().toISOString(), mode, model, ruleset: RULESET_VERSION,
    usage: { input_tokens: Number.isSafeInteger(usage.input_tokens) && usage.input_tokens >= 0 ? usage.input_tokens : 0 },
    answers: a, history: []
  };
}

export function failedRecord(item, error) {
  return { ...item, bucket: 'review', suggestedBucket: 'review', reason: error,
    flags: ['Analyse non aboutie. Aucun classement sémantique disponible.'],
    evidence: '', evidenceId: null, suggestedDate: null, confirmedDate: null,
    action: 'UNKNOWN', kind: 'UNKNOWN', goal: null, mode: 'error',
    evaluatedAt: new Date().toISOString(), ruleset: RULESET_VERSION, history: [] };
}
