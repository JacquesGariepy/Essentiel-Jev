import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeItem, normalizeGoals, buildCandidates, isISODate, daysBetween, validateAnswers, applyPolicy, failedRecord } from '../lib/domain.mjs';
import { buildQuestions } from '../lib/questions.mjs';
import { demoRecords, makeFixture } from '../lib/demo.mjs';

function context(text = 'Merci de confirmer votre présence avant le 2026-10-02.') {
  const item = normalizeItem({ title: 'Test', text });
  const candidates = buildCandidates(item.text);
  const questions = buildQuestions(candidates, []);
  return { item, candidates, questions };
}
function evaluate(ctx, selections = {}, values = {}, confidence = 0.96) {
  const raw = makeFixture(ctx.questions, { action: 'CONFIRM', status: 'PENDING', kind: 'PERSONAL', evidence: 'S1', ...selections }, values, confidence);
  return applyPolicy(ctx.item, ctx.candidates, validateAnswers(raw, ctx.questions), { today: '2026-09-19', model: 'fixture', mode: 'demo' });
}
test('ISO validation rejects impossible dates and accepts leap day', () => {
  assert.equal(isISODate('2026-02-29'), false); assert.equal(isISODate('2024-02-29'), true);
  assert.equal(isISODate('2026-13-01'), false); assert.equal(isISODate('2026-09-31'), false);
  assert.equal(isISODate('demain'), false); assert.equal(isISODate('2026-9-01'), false);
});
test('date arithmetic is deterministic across month and year boundaries', () => {
  assert.equal(daysBetween('2026-09-30', '2026-10-02'), 2);
  assert.equal(daysBetween('2026-12-31', '2027-01-01'), 1);
  assert.equal(daysBetween('2026-10-02', '2026-09-30'), -2);
  assert.throws(() => daysBetween('tomorrow', '2026-01-01'));
});
test('normalizer rejects empty and oversized documents', () => {
  assert.throws(() => normalizeItem({ text: '  ' }));
  assert.throws(() => normalizeItem({ text: 'a'.repeat(8001) }));
  assert.throws(() => normalizeItem({ text: 'valid', title: 'a'.repeat(201) }));
  assert.throws(() => normalizeItem({ text: { dangerous: true } }));
});
test('exact duplicate fingerprint normalizes CRLF but preserves case and meaning', () => {
  assert.equal(normalizeItem({ text: 'One\r\nTwo' }).fingerprint, normalizeItem({ text: 'One\nTwo' }).fingerprint);
  assert.notEqual(normalizeItem({ text: 'Pay' }).fingerprint, normalizeItem({ text: 'Do not pay' }).fingerprint);
});
test('goals are bounded and explicit', () => {
  assert.deepEqual(normalizeGoals([' Family ']), ['Family']); assert.throws(() => normalizeGoals(Array(5).fill('x')));
  assert.throws(() => normalizeGoals(['a'.repeat(181)])); assert.throws(() => normalizeGoals(['']));
});
test('candidate passages are verbatim and dates are validated in code', () => {
  const text = 'Bonjour.\nMerci avant le 2026-09-25. Une date erronée : 2026-02-30.';
  const result = buildCandidates(text);
  Object.values(result.sentences).forEach((s) => assert.ok(text.includes(s)));
  assert.deepEqual(result.dates, ['2026-09-25']); assert.deepEqual(result.invalidDates, ['2026-02-30']);
});
test('oversized passage sets are rejected, not silently truncated', () => {
  assert.throws(() => buildCandidates(Array(81).fill('Bonjour.').join('\n')));
});
test('valid structured responses are accepted', () => {
  const ctx = context(), raw = makeFixture(ctx.questions); assert.ok(validateAnswers(raw, ctx.questions));
});
test('missing answers are rejected', () => {
  const ctx = context(), raw = makeFixture(ctx.questions); delete raw.answers.action;
  assert.throws(() => validateAnswers(raw, ctx.questions));
});
test('unknown choices and non-finite confidence are rejected', () => {
  const ctx = context(), raw = makeFixture(ctx.questions); raw.answers.action.choice = 'TRANSFER_MONEY';
  assert.throws(() => validateAnswers(raw, ctx.questions));
  const valid = makeFixture(ctx.questions); valid.answers.action.confidence = NaN;
  assert.throws(() => validateAnswers(valid, ctx.questions));
});
test('malformed distributions and out-of-range nouls are rejected', () => {
  const ctx = context(), raw = makeFixture(ctx.questions); raw.answers.action.probabilities.NONE = 0.999;
  assert.throws(() => validateAnswers(raw, ctx.questions));
  const other = makeFixture(ctx.questions); other.answers.sensitive.noul = 1.1;
  assert.throws(() => validateAnswers(other, ctx.questions));
});
test('choice must agree with the maximum probability', () => {
  const ctx = context(), raw = makeFixture(ctx.questions); raw.answers.action.choice = 'RESPOND';
  assert.throws(() => validateAnswers(raw, ctx.questions));
});
test('pending request routes to act, with date still unconfirmed', () => {
  const r = evaluate(context(), { deadline: '2026-10-02' }, { time_reference: 0.99 });
  assert.equal(r.bucket, 'act'); assert.equal(r.suggestedDate, '2026-10-02'); assert.equal(r.confirmedDate, null);
  assert.equal(r.daysUntil, 13); assert.ok(r.text.includes(r.evidence));
});
test('low certainty never routes to automatic action', () => {
  const r = evaluate(context(), {}, {}, 0.4); assert.equal(r.bucket, 'review');
});
test('sensitive requests and manipulation route to review', () => {
  assert.equal(evaluate(context(), {}, { sensitive: 0.8 }).bucket, 'review');
  assert.equal(evaluate(context(), {}, { manipulation: 0.8 }).bucket, 'review');
});
test('relative dates are not fabricated', () => {
  const r = evaluate(context('Merci de confirmer demain.'), {}, { time_reference: 0.99 });
  assert.equal(r.bucket, 'review'); assert.equal(r.suggestedDate, null);
});
test('unrelated selected date is an inconsistency, not an accepted deadline', () => {
  const r = evaluate(context(), { action: 'NONE', status: 'NONE', deadline: '2026-10-02' }, { time_reference: 0.99 });
  assert.equal(r.bucket, 'review');
});
test('completed requests stay available without being automatically archived', () => {
  const r = evaluate(context(), { action: 'NONE', status: 'COMPLETED' });
  assert.equal(r.bucket, 'read');
});
test('contradictory action and status are escalated', () => {
  assert.equal(evaluate(context(), { action: 'NONE', status: 'PENDING' }).bucket, 'review');
  assert.equal(evaluate(context(), { action: 'RESPOND', status: 'COMPLETED' }).bucket, 'review');
});
test('conditional requests and missing evidence require review', () => {
  assert.equal(evaluate(context(), { status: 'CONDITIONAL' }).bucket, 'review');
  assert.equal(evaluate(context(), { evidence: 'NONE' }).bucket, 'review');
});
test('provider failures are visible, never replaced by demonstration data', () => {
  const r = failedRecord(context().item, 'Timeout'); assert.equal(r.bucket, 'review'); assert.equal(r.mode, 'error'); assert.equal(r.evidence, '');
});
test('all demonstration records carry explicit synthetic provenance', () => {
  const records = demoRecords('2026-09-19'); assert.equal(records.length, 8);
  assert.equal(records.filter((r) => r.bucket === 'act').length, 2);
  assert.equal(records.filter((r) => r.bucket === 'review').length, 3);
  assert.equal(records.filter((r) => r.bucket === 'read').length, 3);
  assert.ok(records.every((r) => r.mode === 'demo' && r.usage.input_tokens === 0 && r.text.includes(r.evidence)));
  assert.equal(records.filter((r) => r.bucket === 'archived').length, 0);
});

test('browser-compatible source IDs and 200-character titles survive normalization', () => {
  const id='source_'+ 'a'.repeat(73);
  const item=normalizeItem({id, title:'t'.repeat(200),text:'Please review this source.'});
  assert.equal(item.id,id); assert.equal(item.title.length,200);
});
