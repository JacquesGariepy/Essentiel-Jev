import { browserRequest as fetch } from './http-request.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../server.mjs';
import { ConnectedService } from '../lib/connected/service.mjs';
import { googleConfig } from '../lib/connected/google-config.mjs';
import { makeFixture, fixtureEnv } from './connected-fixture.mjs';

const navigate = {'sec-fetch-site':'cross-site','sec-fetch-mode':'navigate','sec-fetch-dest':'document'};
const desktopEnv = {...fixtureEnv, GOOGLE_OAUTH_CLIENT_TYPE:'desktop', GOOGLE_CLIENT_SECRET:''};
async function withApp(fn, env=fixtureEnv) {
  const dir=await mkdtemp(path.join(os.tmpdir(),'essentiel-oauth-regression-'));
  const fixture=makeFixture();
  const app=createApp({connectorOptions:{filename:path.join(dir,'vault'),env,fetchImpl:fixture.fetch}});
  app.listen(0,'127.0.0.1');await once(app,'listening');
  const port=app.address().port, base=`http://127.0.0.1:${port}`, localhost=`http://localhost:${port}`;
  const post=(route,body,origin=base)=>fetch(origin+'/api/connected/'+route,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-Essentiel-Request':'1'},body:JSON.stringify(body)});
  const status=async()=> (await fetch(base+'/api/connected/status',{headers:{'X-Essentiel-Request':'1'}})).json();
  try{await fn({app,base,localhost,post,status,fixture,dir});}
  finally{app.closeAllConnections();await new Promise(r=>app.close(r));await rm(dir,{recursive:true,force:true});}
}
async function startWeb(post,provider='google') {
  const response=await post('oauth/start',{provider,features:['mail']});assert.equal(response.status,200);
  const data=await response.json(),auth=new URL(data.url),callback=new URL(auth.searchParams.get('redirect_uri'));
  callback.search=new URLSearchParams({code:'TEST-OAUTH-CODE',state:auth.searchParams.get('state')}).toString();
  return {callback,cookie:response.headers.get('set-cookie').split(';')[0]};
}
async function startDesktop(post,origin) {
  const response=await post('oauth/start',{provider:'google',features:['mail']},origin);assert.equal(response.status,200);
  assert.equal(response.headers.get('set-cookie'),null);
  const data=await response.json();
  const launch=await fetch(data.url,{redirect:'manual',headers:navigate});assert.equal(launch.status,303);
  const authorization=new URL(launch.headers.get('location'));assert.equal(authorization.hostname,'accounts.google.com');
  const callback=new URL(authorization.searchParams.get('redirect_uri'));
  callback.search=new URLSearchParams({code:'TEST-DESKTOP-CODE',state:authorization.searchParams.get('state')}).toString();
  return {launchURL:data.url,authorization,callback,cookie:launch.headers.get('set-cookie').split(';')[0]};
}

for(const provider of ['google','microsoft']) {
  test(`OAuth regression: ${provider} callback AND cross-site 303 landing succeed`,()=>withApp(async({base,post,status})=>{
    const {callback,cookie}=await startWeb(post,provider);
    const response=await fetch(callback,{redirect:'manual',headers:{...navigate,Cookie:cookie}});
    assert.equal(response.status,303);assert.equal(response.headers.get('location'),`/?connected=${provider}#connections`);
    const landing=await fetch(new URL(response.headers.get('location'),base),{headers:navigate});
    assert.equal(landing.status,200);assert.match(landing.headers.get('content-type'),/text\/html/);
    assert.ok((await status()).providers.find(p=>p.id===provider).connected);
  }));
}
test('OAuth regression: invalid or expired state lands on a readable error page without connecting',()=>withApp(async({base,status})=>{
  const response=await fetch(base+'/oauth/google/callback?state=forged&code=DO-NOT-REFLECT',{redirect:'manual',headers:navigate});
  assert.equal(response.status,303);assert.match(response.headers.get('location'),/OAUTH_STATE_INVALID/);
  assert.ok(!response.headers.get('location').includes('DO-NOT-REFLECT'));
  assert.equal((await fetch(new URL(response.headers.get('location'),base),{headers:navigate})).status,200);
  assert.ok(!(await status()).providers.some(p=>p.connected));
}));
test('OAuth regression: replay remains rejected after the landing fix',()=>withApp(async({post})=>{
  const {callback,cookie}=await startWeb(post);
  const options={redirect:'manual',headers:{...navigate,Cookie:cookie}};
  assert.match((await fetch(callback,options)).headers.get('location'),/connected=google/);
  assert.match((await fetch(callback,options)).headers.get('location'),/OAUTH_STATE_INVALID/);
}));
test('OAuth regression: GET API navigation is never exempted',()=>withApp(async({base})=>{
  for(const route of ['/api/config','/api/demo?today=2026-09-19','/api/connected/status']){
    const r=await fetch(base+route,{headers:{...navigate,'X-Essentiel-Request':'1'}});assert.equal(r.status,403,route);
  }
}));
test('OAuth regression: cross-site POSTs and embedded/script/fetch access remain blocked',()=>withApp(async({base})=>{
  for(const route of ['/','/workspace','/connected.js','/connected.css']){
    for(const [mode,dest] of [['cors','empty'],['no-cors','image'],['navigate','iframe']]){
      const r=await fetch(base+route,{headers:{...navigate,'sec-fetch-mode':mode,'sec-fetch-dest':dest}});assert.equal(r.status,403,route+' '+dest);
    }
  }
  const r=await fetch(base+'/api/connected/oauth/start',{method:'POST',headers:{...navigate,Origin:base,'X-Essentiel-Request':'1','Content-Type':'application/json'},body:JSON.stringify({provider:'google',features:['mail']})});assert.equal(r.status,403);
}));
test('OAuth regression: iframe and fetch callbacks are rejected before token exchange',()=>withApp(async({post,fixture})=>{
  const {callback,cookie}=await startWeb(post);
  for(const [mode,dest] of [['cors','empty'],['navigate','iframe'],['no-cors','image']]){
    const r=await fetch(callback,{redirect:'manual',headers:{...navigate,'sec-fetch-mode':mode,'sec-fetch-dest':dest,Cookie:cookie}});assert.equal(r.status,403);
  }
  assert.equal(fixture.calls.length,0);
  assert.equal((await fetch(callback,{redirect:'manual',headers:{...navigate,Cookie:cookie}})).status,303);
  assert.ok(fixture.calls.length>0);
}));
test('OAuth regression: ambiguous code/state parameters do not consume or connect a valid flow',()=>withApp(async({post,status})=>{
  const {callback,cookie}=await startWeb(post);
  const ambiguous=new URL(callback);ambiguous.searchParams.append('state',ambiguous.searchParams.get('state'));
  const r=await fetch(ambiguous,{redirect:'manual',headers:{...navigate,Cookie:cookie}});assert.match(r.headers.get('location'),/OAUTH_STATE_INVALID/);
  assert.ok(!(await status()).providers[0].connected);
  assert.match((await fetch(callback,{redirect:'manual',headers:{...navigate,Cookie:cookie}})).headers.get('location'),/connected=google/);
}));
test('Google desktop: localhost -> 127.0.0.1 cookie bootstrap -> Google -> original localhost UI',()=>withApp(async({localhost,post,status,fixture})=>{
  const flow=await startDesktop(post,localhost);
  assert.equal(flow.callback.hostname,'127.0.0.1');
  assert.equal(flow.authorization.searchParams.get('code_challenge_method'),'S256');
  assert.equal(flow.authorization.searchParams.has('include_granted_scopes'),false);
  const r=await fetch(flow.callback,{redirect:'manual',headers:{...navigate,Cookie:flow.cookie}});
  assert.equal(r.status,303);assert.equal(r.headers.get('location'),localhost+'/?connected=google#connections');
  assert.equal((await fetch(r.headers.get('location'),{headers:navigate})).status,200);
  assert.ok((await status()).providers[0].connected);
  const token=fixture.calls.find(c=>c.url.endsWith('/token'));
  assert.equal(token.body.has('client_secret'),false);
  assert.equal(token.body.get('redirect_uri'),flow.callback.origin+flow.callback.pathname);
  assert.equal(token.body.get('code_verifier').length,43);
},desktopEnv));
test('Google desktop: launch ticket is one-use and cannot be forged',()=>withApp(async({base,post})=>{
  const flow=await startDesktop(post,base);
  const replay=await fetch(flow.launchURL,{redirect:'manual',headers:navigate});assert.match(replay.headers.get('location'),/OAUTH_LAUNCH_INVALID/);
  const forged=await fetch(base+'/oauth/google/launch?ticket='+ 'A'.repeat(43),{redirect:'manual',headers:navigate});assert.match(forged.headers.get('location'),/OAUTH_LAUNCH_INVALID/);
},desktopEnv));
test('Google desktop: missing binding cookie and wrong callback host remain rejected',()=>withApp(async({localhost,post,status})=>{
  const flow=await startDesktop(post,localhost);
  assert.match((await fetch(flow.callback,{redirect:'manual',headers:navigate})).headers.get('location'),/OAUTH_STATE_INVALID/);
  const wrong=new URL(flow.callback);wrong.hostname='localhost';
  assert.match((await fetch(wrong,{redirect:'manual',headers:{...navigate,Cookie:flow.cookie}})).headers.get('location'),/OAUTH_STATE_INVALID/);
  assert.ok(!(await status()).providers[0].connected);
  assert.match((await fetch(flow.callback,{redirect:'manual',headers:{...navigate,Cookie:flow.cookie}})).headers.get('location'),/connected=google/);
},desktopEnv));
test('Google desktop: an optional issued client secret is sent during code exchange',()=>withApp(async({base,post,fixture})=>{
  const flow=await startDesktop(post,base);
  await fetch(flow.callback,{redirect:'manual',headers:{...navigate,Cookie:flow.cookie}});
  assert.equal(fixture.calls.find(c=>c.url.endsWith('/token')).body.get('client_secret'),'TEST-GOOGLE-SECRET');
},{...desktopEnv,GOOGLE_CLIENT_SECRET:'TEST-GOOGLE-SECRET'}));
test('Google desktop: cancellation invalidates launch links and pending callbacks',async()=>{
  const service=new ConnectedService({env:desktopEnv,fetchImpl:makeFixture().fetch});
  const auth=service.oauth.start('google',['mail'],'http://localhost:8787');service.oauth.cancel();
  assert.throws(()=>service.oauth.launch('google',new URL(auth.url).searchParams,'http://127.0.0.1:8787'),e=>e.code==='OAUTH_LAUNCH_INVALID');
});
test('Google desktop: desktop token refresh omits an absent client secret',async()=>{
  const fixture=makeFixture(),s=new ConnectedService({env:desktopEnv,fetchImpl:fixture.fetch});
  const auth=s.oauth.start('google',['mail'],'http://localhost:8787');
  const launched=s.oauth.launch('google',new URL(auth.url).searchParams,'http://127.0.0.1:8787');
  const params=new URL(launched.url).searchParams;params.set('code','TEST');
  await s.oauth.callback('google',params,launched.cookie,'http://127.0.0.1:8787');
  s.vault.state().accounts.google.expiresAt=0;await s.oauth.token('google');
  const request=fixture.calls.filter(x=>x.url.endsWith('/token')).at(-1);
  assert.equal(request.body.get('grant_type'),'refresh_token');assert.equal(request.body.has('client_secret'),false);
});
test('Google configuration: existing web configuration still requires a secret',()=>{
  const s=new ConnectedService({env:{GOOGLE_CLIENT_ID:'TEST'}});assert.equal(s.oauth.configured('google'),false);
  const d=new ConnectedService({env:{GOOGLE_CLIENT_ID:'TEST',GOOGLE_OAUTH_CLIENT_TYPE:'desktop'}});assert.equal(d.oauth.configured('google'),true);
});
test('Google configuration: installed JSON is detected; untrusted endpoint fields are ignored',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'google-config-test-')),filename=path.join(dir,'google.json');
  try{
    await writeFile(filename,JSON.stringify({installed:{client_id:'TEST-ID',client_secret:'TEST-SECRET',token_uri:'https://evil.test/steal',auth_uri:'https://evil.test/signin'}}));
    const env={GOOGLE_CLIENT_CONFIG_FILE:filename},c=googleConfig(env);assert.equal(c.clientType,'desktop');
    const s=new ConnectedService({env});assert.equal(s.oauth.config.google.token,'https://oauth2.googleapis.com/token');
    assert.equal(s.oauth.config.google.authorize,'https://accounts.google.com/o/oauth2/v2/auth');
    assert.throws(()=>googleConfig({...env,GOOGLE_OAUTH_CLIENT_TYPE:'web'}),e=>e.code==='CONFIG_INVALID');
    assert.throws(()=>googleConfig({...env,GOOGLE_CLIENT_ID:'OTHER'}),e=>e.code==='CONFIG_INVALID');
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('Google configuration: service-account files and invalid modes are rejected',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'google-config-test-')),filename=path.join(dir,'google.json');
  try{
    await writeFile(filename,JSON.stringify({type:'service_account',private_key:'DO-NOT-PRINT'}));
    assert.throws(()=>googleConfig({GOOGLE_CLIENT_CONFIG_FILE:filename}),e=>e.code==='CONFIG_INVALID'&&!e.message.includes('DO-NOT-PRINT'));
    assert.throws(()=>googleConfig({GOOGLE_OAUTH_CLIENT_TYPE:'anything'}),e=>e.code==='CONFIG_INVALID');
  }finally{await rm(dir,{recursive:true,force:true});}
});
