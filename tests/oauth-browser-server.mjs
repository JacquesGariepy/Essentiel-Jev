/** Synthetic Google transport ONLY for browser regression tests. Never imported by production. */
import { createApp } from '../server.mjs';
import { makeFixture,fixtureEnv } from './connected-fixture.mjs';
import { once } from 'node:events';
import { mkdtemp,rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const dir=await mkdtemp(path.join(os.tmpdir(),'essentiel-oauth-browser-'));
const servers=[];
const origins={};
for(const mode of ['web','desktop']) {
  const f=makeFixture();
  const app=createApp({apiKey:'',connectorOptions:{filename:path.join(dir,mode+'.vault'),env:{...fixtureEnv,GOOGLE_OAUTH_CLIENT_TYPE:mode},fetchImpl:f.fetch}});
  app.on('request',(req,res)=>res.on('finish',()=>{
    const u=new URL(req.url,'http://localhost');
    // No authorization code, state, launch ticket, cookie or token is logged.
    if(u.pathname==='/'||u.pathname.startsWith('/oauth/'))process.stderr.write(JSON.stringify({mode,path:u.pathname,status:res.statusCode,site:req.headers['sec-fetch-site'],fetchMode:req.headers['sec-fetch-mode'],destination:req.headers['sec-fetch-dest']})+'\n');
  }));
  app.listen(0,'127.0.0.1');await once(app,'listening');servers.push(app);
  origins[mode]=`http://localhost:${app.address().port}`;
}
console.log(JSON.stringify(origins));
async function stop(){for(const s of servers){s.closeAllConnections();await new Promise(r=>s.close(r));}await rm(dir,{recursive:true,force:true});process.exit();}
process.on('SIGTERM',stop);process.on('SIGINT',stop);
