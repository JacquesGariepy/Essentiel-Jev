import { browserRequest } from './http-request.mjs';
/** Test harness only: real local HTTP server, synthetic upstream transport. */
import { createApp } from '../server.mjs';
import { makeFixture,fixtureEnv } from './connected-fixture.mjs';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
const dir=await mkdtemp(join(tmpdir(),'essentiel-browser-'));
const fixture=makeFixture();
if(process.argv.includes('--google-403')){
 const upstream=fixture.fetch;
 fixture.fetch=async(url,options)=>{
  const u=new URL(url);
  if(u.hostname!=='graph.microsoft.com' && (u.pathname.startsWith('/gmail/')||u.pathname.startsWith('/calendar/')||u.pathname.startsWith('/tasks/')||u.pathname.startsWith('/drive/'))){
   const service=u.pathname.startsWith('/calendar/')?'calendar-json.googleapis.com':u.pathname.startsWith('/tasks/')?'tasks.googleapis.com':u.pathname.startsWith('/drive/')?'drive.googleapis.com':'gmail.googleapis.com';
   return Response.json({error:{code:403,status:'PERMISSION_DENIED',details:[{'@type':'type.googleapis.com/google.rpc.ErrorInfo',reason:'SERVICE_DISABLED',metadata:{service,consumer:'projects/123456789012'}}]}},{status:403});
  }
  return upstream(url,options);
 };
}
const app=createApp({apiKey:'',connectorOptions:{filename:join(dir,'vault'),env:fixtureEnv,fetchImpl:fixture.fetch}});
app.listen(0,'127.0.0.1');await once(app,'listening');
const origin=`http://127.0.0.1:${app.address().port}`;
if(!process.argv.includes('--empty'))for(const provider of (process.argv.includes('--google-only')?['google']:['google','microsoft'])){
 const r=await fetch(origin+'/api/connected/oauth/start',{method:'POST',headers:{'Content-Type':'application/json','X-Essentiel-Request':'1',Origin:origin},body:JSON.stringify({provider,features:['mail','calendar','tasks','files','drafts','calendar_write','tasks_write']})});
 const auth=await r.json();if(!r.ok)throw new Error(JSON.stringify(auth));
 const state=new URL(auth.url).searchParams.get('state'),cookie=r.headers.get('set-cookie').split(';')[0];
 const callback=await browserRequest(origin+`/oauth/${provider}/callback?state=${state}&code=TEST`,{headers:{Cookie:cookie,'Sec-Fetch-Site':'cross-site','Sec-Fetch-Mode':'navigate','Sec-Fetch-Dest':'document'},redirect:'manual'});
 if(!callback.headers.get('location')?.includes('connected='+provider))throw new Error('Fixture OAuth callback failed');
 const sync=await fetch(origin+'/api/connected/sync',{method:'POST',headers:{'Content-Type':'application/json','X-Essentiel-Request':'1',Origin:origin},body:JSON.stringify({provider})});if(!sync.ok)throw new Error(await sync.text());
}
console.log(JSON.stringify({origin,testOnly:true,upstream:'synthetic',vaultDirectory:dir}));
async function stop(){app.closeAllConnections();await new Promise(r=>app.close(r));await rm(dir,{recursive:true,force:true});process.exit(0);}
process.on('SIGTERM',stop);process.on('SIGINT',stop);
