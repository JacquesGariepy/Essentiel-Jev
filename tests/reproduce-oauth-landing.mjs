/** Reproduces the complete callback/landing chain using a synthetic provider.
 * Optional argument: an older server.mjs path to compare releases. */
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { once } from 'node:events';
import { mkdtemp,rm } from 'node:fs/promises';
import os from 'node:os';
import { makeFixture,fixtureEnv } from './connected-fixture.mjs';
import { browserRequest } from './http-request.mjs';
const serverPath=process.argv[2]?pathToFileURL(path.resolve(process.argv[2])).href:new URL('../server.mjs',import.meta.url).href;
const {createApp}=await import(serverPath), fixture=makeFixture();
const dir=await mkdtemp(path.join(os.tmpdir(),'essentiel-repro-'));
const app=createApp({apiKey:'',connectorOptions:{filename:path.join(dir,'vault'),env:fixtureEnv,fetchImpl:fixture.fetch}});
app.listen(0,'127.0.0.1');await once(app,'listening');
const base=`http://127.0.0.1:${app.address().port}`,nav={'Sec-Fetch-Site':'cross-site','Sec-Fetch-Mode':'navigate','Sec-Fetch-Dest':'document'};
try{
 const start=await browserRequest(base+'/api/connected/oauth/start',{method:'POST',headers:{Origin:base,'Content-Type':'application/json','X-Essentiel-Request':'1'},body:JSON.stringify({provider:'google',features:['mail']})});
 const auth=new URL((await start.json()).url),callback=new URL(auth.searchParams.get('redirect_uri'));
 callback.search=new URLSearchParams({state:auth.searchParams.get('state'),code:'SYNTHETIC-REPRODUCTION'});
 const returned=await browserRequest(callback,{headers:{...nav,Cookie:start.headers.get('set-cookie').split(';')[0]}});
 const landing=await browserRequest(new URL(returned.headers.get('location'),base),{headers:nav});
 const status=await (await browserRequest(base+'/api/connected/status',{headers:{'X-Essentiel-Request':'1'}})).json();
 console.log(JSON.stringify({version:status.version,provider:'synthetic',realGoogleAccount:false,callbackStatus:returned.status,landingStatus:landing.status,landingError:landing.status===403?(await landing.json()).error:null,accountStored:status.providers[0].connected,navigationHeaders:nav},null,2));
}finally{app.closeAllConnections();await new Promise(r=>app.close(r));await rm(dir,{recursive:true,force:true});}
