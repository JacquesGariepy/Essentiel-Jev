import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../server.mjs';
import { makeFixture } from '../lib/demo.mjs';
import { makeLabPresets } from '../public/systemone.js';
const request=makeLabPresets()[0];
async function run(options,fn){const app=createApp(options);app.listen(0,'127.0.0.1');await once(app,'listening');const base=`http://127.0.0.1:${app.address().port}`;try{await fn(base);}finally{app.closeAllConnections();await new Promise(r=>app.close(r));}}
const post=(base,body,path='/api/evaluate',headers={})=>fetch(base+path,{method:'POST',headers:{Origin:base,'Content-Type':'application/json','X-Essentiel-Request':'1',...headers},body:JSON.stringify(body)});
test('all three native primitives traverse the local route with a mock provider',async()=>run({apiKey:'fake',provider:async({questions})=>makeFixture(questions)},async base=>{const response=await post(base,{...request,consent:true});assert.equal(response.status,200);const raw=await response.json();assert.equal(raw.answers.clarity.type,'score');assert.equal(raw.answers.sensitive.type,'noul');assert.equal(raw.answers.action.type,'choice');}));
test('malformed questions, missing consent and external origins do not call provider',async()=>{let calls=0;await run({apiKey:'fake',provider:async()=>{calls++;}},async base=>{assert.equal((await post(base,{state:'x',questions:{},consent:true})).status,400);assert.equal((await post(base,{...request,consent:false})).status,400);assert.equal((await post(base,{...request,consent:true},'/api/evaluate',{Origin:'https://other.invalid'})).status,403);});assert.equal(calls,0);});
test('provider answer-type errors fail closed without replacement output',async()=>run({apiKey:'fake',provider:async()=>({answers:{}})},async base=>{const response=await post(base,{...request,consent:true});assert.equal(response.status,502);assert.ok((await response.json()).error); }));
test('model lookup is an explicit authenticated metadata action',async()=>{let calls=0;await run({apiKey:'fake',modelsProvider:async()=>{calls++;return{models:[{name:'fixture-model'}]};}},async base=>{assert.equal((await post(base,{consent:false},'/api/models')).status,400);const response=await post(base,{consent:true},'/api/models');assert.equal(response.status,200);assert.equal((await response.json()).models[0].name,'fixture-model');});assert.equal(calls,1);});
test('version-two browser modules are served without exposing source env',async()=>run({apiKey:''},async base=>{for(const file of ['core','systemone','catalog','i18n','demo'])assert.equal((await fetch(`${base}/${file}.js`)).status,200);assert.equal((await fetch(`${base}/../.env`)).status,404);}));
