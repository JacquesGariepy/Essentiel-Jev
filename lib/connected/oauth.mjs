import { providerError } from './provider-errors.mjs';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { googleConfig } from './google-config.mjs';
import { AppError, fail, hash, providerId, uid } from './common.mjs';

export const FEATURES = ['mail','calendar','tasks','files','drafts','calendar_write','tasks_write'];
export const SCOPES = {
  google: {mail:'https://www.googleapis.com/auth/gmail.readonly',calendar:'https://www.googleapis.com/auth/calendar.readonly',tasks:'https://www.googleapis.com/auth/tasks.readonly',files:'https://www.googleapis.com/auth/drive.metadata.readonly',drafts:'https://www.googleapis.com/auth/gmail.compose',calendar_write:'https://www.googleapis.com/auth/calendar.events',tasks_write:'https://www.googleapis.com/auth/tasks'},
  microsoft: {mail:'Mail.Read',calendar:'Calendars.Read',tasks:'Tasks.Read',files:'Files.Read',drafts:'Mail.ReadWrite',calendar_write:'Calendars.ReadWrite',tasks_write:'Tasks.ReadWrite'}
};
const BASE = {google:['https://www.googleapis.com/auth/userinfo.email'],microsoft:['offline_access','User.Read']};
const cleanScope = s => String(s).replace(/^https:\/\/graph\.microsoft\.com\//i,'').toLowerCase();
export function capabilities(account) {
  if(!account)return Object.fromEntries(FEATURES.map(x=>[x,false]));
  const scopes=new Set(account.scopes.map(cleanScope)), map=SCOPES[account.provider];
  const result=Object.fromEntries(FEATURES.map(f=>[f,scopes.has(cleanScope(map[f]))]));
  if(result.tasks_write)result.tasks=true;
  if(account.provider==='microsoft'){if(result.drafts)result.mail=true;if(result.calendar_write)result.calendar=true;}
  return result;
}
export class OAuth {
  constructor(vault,{env=process.env,fetchImpl=fetch}={}) {
    this.vault=vault;this.fetch=fetchImpl;this.pending=new Map();this.refreshes=new Map();
    const tenant=env.MICROSOFT_TENANT||'common';
    if(!/^[A-Za-z0-9.-]{1,150}$/.test(tenant))fail('CONFIG_INVALID','Invalid Microsoft tenant.');
    this.config={
      google:{...googleConfig(env),authorize:'https://accounts.google.com/o/oauth2/v2/auth',token:'https://oauth2.googleapis.com/token'},
      microsoft:{clientType:'web',clientId:env.MICROSOFT_CLIENT_ID||'',clientSecret:env.MICROSOFT_CLIENT_SECRET||'',authorize:`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`,token:`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`}
    };
  }
  configured(p){const c=this.config[p];return Boolean(c.clientId&&(c.clientType==='desktop'||c.clientSecret));}
  async http(url,options={}) {
    let res;
    try {res=await this.fetch(url,{...options,redirect:'error',signal:AbortSignal.timeout(20000)});}catch{throw new AppError('PROVIDER_UNREACHABLE','Provider request did not return a usable response. A write may have taken effect.',502);}
    let raw='';const reader=res.body?.getReader(),decoder=new TextDecoder();
    if(reader){let bytes=0;for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>5_000_000){await reader.cancel();fail('PROVIDER_RESPONSE_LIMIT','Provider response exceeded the local size limit.',502);}raw+=decoder.decode(value,{stream:true});}}
    raw+=decoder.decode();
    let data={};try{data=raw?JSON.parse(raw):{};}catch{if(!res.ok)throw providerError(url,res.status,{},res.headers.get('retry-after')||'');fail('INVALID_PROVIDER_RESPONSE','Provider returned invalid JSON.',502);}
    if(!res.ok)throw providerError(url,res.status,data,res.headers.get('retry-after')||'');
    return data;
  }
  start(p,features,origin) {
    providerId(p);this.vault.state();if(!this.configured(p))fail('CONNECTOR_NOT_CONFIGURED',p==='google'&&this.config[p].clientType==='desktop'?'Configure the Google Desktop client ID or its downloaded OAuth JSON.':'Configure the OAuth application client ID and client secret on this server.',503);
    // The return address is derived only from the protected local start request, never from callback query parameters.
    let local;try{local=new URL(origin);}catch{fail('ORIGIN_REJECTED','Invalid local OAuth origin.',403);}
    if(local.origin!==origin||local.protocol!=='http:'||!['127.0.0.1','localhost'].includes(local.hostname)||!local.port)fail('ORIGIN_REJECTED','OAuth requires an explicit local HTTP origin and port.',403);
    const desktop=p==='google'&&this.config[p].clientType==='desktop';
    const redirectOrigin=desktop?`http://127.0.0.1:${local.port}`:origin;
    if(!Array.isArray(features)||!features.length||features.length>FEATURES.length||features.some(x=>!FEATURES.includes(x)))fail('INVALID_SCOPES','Choose explicit connector capabilities.');
    const old=this.vault.state().accounts[p];
    const requested=[...new Set([...BASE[p],...features.map(f=>SCOPES[p][f]),...(old?.scopes||[])])];
    // Always include the read scope needed to list targets before any calendar write.
    if(features.includes('calendar_write'))requested.push(SCOPES[p].calendar);
    if(features.includes('drafts'))requested.push(SCOPES[p].mail);
    if(features.includes('tasks_write'))requested.push(SCOPES[p].tasks);
    const scopes=[...new Set(requested)],state=randomBytes(32).toString('base64url'),browser=randomBytes(32).toString('base64url'),verifier=randomBytes(32).toString('base64url');
    for(const [k,v] of this.pending)if(v.expires<Date.now())this.pending.delete(k);
    if(this.pending.size>=10)fail('TOO_MANY_AUTH_FLOWS','Finish an existing connection attempt first.',429);
    // One pending flow per provider avoids cookie overwrites and stale permission upgrades.
    for(const [k,v] of this.pending)if(v.provider===p)this.pending.delete(k);
    const redirectUri=`${redirectOrigin}/oauth/${p}/callback`;
    this.pending.set(state,{provider:p,browserHash:hash(browser),verifier,scopes,redirectUri,returnOrigin:origin,expires:Date.now()+600000,binding:old?.binding||null});
    const u=new URL(this.config[p].authorize);u.search=new URLSearchParams({client_id:this.config[p].clientId,redirect_uri:redirectUri,response_type:'code',scope:scopes.join(' '),state,code_challenge:Buffer.from(hash(verifier),'hex').toString('base64url'),code_challenge_method:'S256',...(p==='google'?{access_type:'offline',...(!desktop?{include_granted_scopes:'true'}:{}),prompt:'consent select_account'}:{response_mode:'query',prompt:'select_account'})}).toString();
    const cookie=`essentiel_oauth_${p}=${browser}; HttpOnly; SameSite=Lax; Path=/oauth/${p}/; Max-Age=600`;
    if(desktop){
      // Set the browser-binding cookie on 127.0.0.1 before leaving for Google.
      // localhost and 127.0.0.1 do not share cookies. The one-use ticket is minted
      // only after the same-origin POST and cannot choose an external destination.
      const ticket=randomBytes(32).toString('base64url');
      Object.assign(this.pending.get(state),{launchHash:hash(ticket),launchCookie:cookie,authorizationUrl:u.href});
      return {url:`${redirectOrigin}/oauth/google/launch?ticket=${ticket}`,requested:scopes};
    }
    return {url:u.href,cookie,requested:scopes};
  }
  launch(p,params,origin){
    providerId(p);this.vault.state();
    const ticket=params.get('ticket');
    if(p!=='google'||this.config[p].clientType!=='desktop'||params.getAll('ticket').length!==1||!ticket||!/^[A-Za-z0-9_-]{43}$/.test(ticket))fail('OAUTH_LAUNCH_INVALID','Start a new Google connection from Essentiel.',403);
    const digest=hash(ticket);
    const pending=[...this.pending.values()].find(v=>v.provider===p&&v.launchHash===digest);
    if(!pending||pending.expires<Date.now()||new URL(pending.redirectUri).origin!==origin)fail('OAUTH_LAUNCH_INVALID','The local launch link expired or was already used.',403);
    const result={url:pending.authorizationUrl,cookie:pending.launchCookie};
    delete pending.launchHash;delete pending.launchCookie;delete pending.authorizationUrl;
    return result;
  }
  async callback(p,params,cookieHeader='',origin='') {
    providerId(p);this.vault.state();const state=params.get('state');
    if(params.getAll('state').length!==1||params.getAll('code').length>1||params.getAll('error').length>1||(params.has('code')&&params.has('error')))fail('OAUTH_STATE_INVALID','Ambiguous OAuth response.',403);
    const pending=this.pending.get(state);const browser=cookieHeader.split(';').map(x=>x.trim()).find(x=>x.startsWith(`essentiel_oauth_${p}=`))?.split('=')[1];
    if(!pending||pending.provider!==p||pending.expires<Date.now()||pending.launchHash||(origin&&new URL(pending.redirectUri).origin!==origin)||!browser||!timingSafeEqual(Buffer.from(hash(browser)),Buffer.from(pending.browserHash)))fail('OAUTH_STATE_INVALID','Connection attempt expired or did not originate from this browser.',403);
    this.pending.delete(state);
    if(params.get('error'))fail('OAUTH_DENIED','Provider consent was denied or could not be completed.');
    const current=this.vault.state().accounts[p];
    if((current?.binding||null)!==pending.binding)fail('STALE_AUTH','The connection changed. Start a new consent flow.',409);
    const code=params.get('code');if(!code||code.length>10000)fail('OAUTH_CODE_INVALID','Missing authorization code.');
    const c=this.config[p];
    const response=await this.http(c.token,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',client_id:c.clientId,...(c.clientSecret?{client_secret:c.clientSecret}:{}),code,redirect_uri:pending.redirectUri,code_verifier:pending.verifier})});
    const tokens=this.normalizeTokens(response,pending.scopes);
    const profile=await this.http(p==='google'?'https://www.googleapis.com/oauth2/v2/userinfo':'https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName',{headers:{Authorization:`Bearer ${tokens.accessToken}`}});
    if(typeof profile.id!=='string'||!profile.id)fail('IDENTITY_MISSING','Provider did not return an account identifier.',502);
    if(current && current.subject!==profile.id)fail('ACCOUNT_CHANGED','Disconnect the current account before connecting a different account from this provider.',409);
    this.vault.state().accounts[p]={provider:p,subject:profile.id,binding:current?.binding||uid(),email:profile.email||profile.mail||profile.userPrincipalName||'',name:profile.name||profile.displayName||'',...tokens,refreshToken:tokens.refreshToken||current?.refreshToken||'',connectedAt:current?.connectedAt||new Date().toISOString()};
    await this.vault.save();return {provider:p,returnOrigin:pending.returnOrigin};
  }
  normalizeTokens(response,requested) {
    if(typeof response.access_token!=='string'||!response.access_token||response.access_token.length>30000||!Number.isFinite(Number(response.expires_in))||Number(response.expires_in)<=0)fail('TOKEN_INVALID','Invalid provider token response.',502);
    return {accessToken:response.access_token,refreshToken:typeof response.refresh_token==='string'?response.refresh_token:'',expiresAt:Date.now()+Number(response.expires_in)*1000,scopes:typeof response.scope==='string'?response.scope.split(/\s+/).filter(Boolean):requested};
  }
  async token(p,force=false) {
    const account=this.vault.state().accounts[providerId(p)];if(!account)fail('NOT_CONNECTED','Connect this account first.',409);
    if(!force&&account.expiresAt>Date.now()+90000)return account.accessToken;
    if(this.refreshes.has(p))return this.refreshes.get(p);
    const operation=(async()=>{
      if(!account.refreshToken)fail('REAUTHORIZE','Provider access expired. Reconnect this account.',401);
      const c=this.config[p],body={grant_type:'refresh_token',client_id:c.clientId,...(c.clientSecret?{client_secret:c.clientSecret}:{}),refresh_token:account.refreshToken};
      if(p==='microsoft')body.scope=account.scopes.join(' ');
      const response=await this.http(c.token,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(body)});
      const tokens=this.normalizeTokens(response,account.scopes);
      if(this.vault.state().accounts[p]?.binding!==account.binding)fail('CONNECTION_CHANGED','Account disconnected during token refresh.',409);
      Object.assign(account,tokens,{refreshToken:tokens.refreshToken||account.refreshToken});await this.vault.save();return account.accessToken;
    })();
    this.refreshes.set(p,operation);try{return await operation;}finally{this.refreshes.delete(p);}
  }
  cancel(){this.pending.clear();}
}
