import test from 'node:test';
import assert from 'node:assert/strict';
import { askJev } from '../lib/provider.mjs';
const basic = { apiKey: 'fake-test-key', model: 'jev-1.13.0', state: { document: 'text' }, questions: { x: { type: 'noul', instructions: 'Test?' } } };
test('no key means no network call', async () => {
  let called = false;
  await assert.rejects(askJev({ ...basic, apiKey: '', fetchImpl: async () => { called = true; } }), /absente/);
  assert.equal(called, false);
});
test('native adapter uses documented endpoint and payload', async () => {
  const result = await askJev({ ...basic, fetchImpl: async (url, options) => {
    assert.equal(url, 'https://api.typesafe.ai/v1/systemone'); assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Authorization, 'Bearer fake-test-key');
    assert.deepEqual(JSON.parse(options.body), { model: basic.model, state: basic.state, questions: basic.questions });
    return new Response(JSON.stringify({ answers: {}, model: 'fixture' }), { status: 200 });
  } });
  assert.equal(result.model, 'fixture');
});
test('401 is not retried and raw provider content is not exposed', async () => {
  let calls = 0;
  await assert.rejects(askJev({ ...basic, fetchImpl: async () => { calls++; return new Response('secret upstream detail', { status: 401 }); } }), /rejetée/);
  assert.equal(calls, 1);
});
test('429 retries once and respects an in-budget Retry-After', async () => {
  let calls = 0, waited;
  await askJev({ ...basic, waitImpl: async (ms) => { waited = ms; }, fetchImpl: async () => {
    calls++; return calls === 1 ? new Response('{}', { status: 429, headers: { 'retry-after': '2' } }) : new Response('{"answers":{}}', { status: 200 });
  } });
  assert.equal(calls, 2); assert.equal(waited, 2000);
});
test('repeated rate limit stops after two attempts', async () => {
  let calls = 0;
  await assert.rejects(askJev({ ...basic, waitImpl: async () => {}, fetchImpl: async () => { calls++; return new Response('{}', { status: 529 }); } }), /surchargé/);
  assert.equal(calls, 2);
});
test('invalid JSON and network failures are explicit', async () => {
  await assert.rejects(askJev({ ...basic, fetchImpl: async () => new Response('not json', { status: 200 }) }), /non JSON/);
  await assert.rejects(askJev({ ...basic, fetchImpl: async () => { throw new Error('sensitive network log'); } }), /Connexion/);
});

test('long Retry-After stops without retrying earlier than the provider allows', async () => {
  let calls=0; await assert.rejects(askJev({...basic,waitImpl:async()=>{throw new Error('Must not wait');},fetchImpl:async()=>{calls++;return new Response('{}',{status:429,headers:{'retry-after':'100'}});}}),/budget local/); assert.equal(calls,1);
});
