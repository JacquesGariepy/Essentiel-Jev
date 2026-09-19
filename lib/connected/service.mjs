import { safeDiagnostic } from './provider-errors.mjs';
import { Vault } from './vault.mjs';
import { OAuth, FEATURES, capabilities } from './oauth.mjs';
import { Providers } from './providers.mjs';
import { AppError, fail, providerId, text, email, iso, dateOnly, uid, hash, freeSlots } from './common.mjs';

export class ConnectedService {
  constructor({filename,env,fetchImpl}={}) {
    this.vault=new Vault(filename);this.oauth=new OAuth(this.vault,{env,fetchImpl});this.providers=new Providers(this.oauth);this.active=0;this.syncs=new Map();this.executing=new Set();this.vaultBusy=false;this.writeBusy=false;
  }
  async run(fn){if(this.vaultBusy)fail('BUSY','The encrypted vault is changing state.',409);this.active++;try{return await fn();}finally{this.active--;}}
  status(){
    const v=this.vault.status();const data=v.locked?null:this.vault.state();
    return {version:'0.3.2',vault:v,providers:['google','microsoft'].map(p=>{const a=data?.accounts[p];return {id:p,clientType:this.oauth.config[p].clientType,configured:this.oauth.configured(p),connected:Boolean(a),email:a?.email||'',name:a?.name||'',capabilities:capabilities(a),scopes:a?.scopes||[]};}),diagnostics:data?.diagnostics||{},snapshots:data?.snapshots||{},selections:data?.selections||{},actions:data?.actions||[],active:this.active};
  }
  async manageVault(action,password){
    if(this.active||this.vaultBusy)fail('BUSY','Wait for active connector operations to finish before changing the vault.',409);
    this.vaultBusy=true;this.oauth.cancel();
    try{if(action==='unlock')await this.vault.unlock(password);else if(action==='lock')await this.vault.lock();else if(action==='erase')await this.vault.erase();else fail('INVALID_ACTION','Unknown vault action.');return this.status();}
    finally{this.vaultBusy=false;}
  }
  async disconnect(p){providerId(p);if(this.active)fail('BUSY','A connector operation is still in progress.',409);const d=this.vault.state();delete d.accounts[p];if(d.diagnostics)delete d.diagnostics[p];delete d.snapshots[p];delete d.selections[p];d.actions=d.actions.filter(a=>a.provider!==p&&a.source?.provider!==p);this.oauth.cancel();await this.vault.save();return {disconnected:true,revoked:false,note:'Local credentials and cached data removed. Remove app access at the provider to revoke the OAuth grant.'};}
  selectedCalendars(p,calendars){const ids=this.vault.state().selections[p]?.calendarIds;if(ids?.length){if(ids.some(id=>!calendars.some(c=>c.id===id)))fail('AVAILABILITY_UNKNOWN','A selected calendar is unavailable. Review your calendar selection.',409);return calendars.filter(c=>ids.includes(c.id));}const primary=calendars.find(c=>c.primary)||calendars[0];return primary?[primary]:[];}
  async select(p,calendarIds,listId){providerId(p);const s=this.vault.state().snapshots[p];if(!s)fail('SYNC_REQUIRED','Synchronize this account before choosing folders.');if(!Array.isArray(calendarIds)||calendarIds.length>10||calendarIds.some(id=>!s.calendars?.some(c=>c.id===id)))fail('INVALID_TARGET','Choose at most ten returned calendars.');if(listId&&!s.lists?.some(x=>x.id===listId))fail('INVALID_TARGET','Task list not found.');this.vault.state().selections[p]={calendarIds:[...new Set(calendarIds)],listId:listId||''};s.events=[];s.tasks=[];s.selectionNeedsSync=true;await this.vault.save();return {selected:true};}
  async diagnostics(p){
    providerId(p);const account=this.providers.account(p),caps=capabilities(account),checks=[];
    const routes=p==='google'?{
      mail:'messages?maxResults=1&fields=messages(id)',
      calendar:'users/me/calendarList?maxResults=1&fields=items(id)',
      tasks:'users/@me/lists?maxResults=1&fields=items(id)',
      files:'files?pageSize=1&fields=files(id)'
    }:{mail:'me/mailFolders/inbox/messages?$top=1&$select=id',calendar:'me/calendars?$top=1&$select=id',tasks:'me/todo/lists?$top=1&$select=id',files:'me/drive/root?$select=id'};
    for(const service of ['mail','calendar','tasks','files']){
      if(!caps[service]){checks.push({service,authorized:false,status:'not_granted'});continue;}
      try{await this.providers.request(p,service,routes[service]);checks.push({service,authorized:true,status:'ok'});}
      catch(e){checks.push({service,authorized:true,status:'error',code:e.code||'ERROR',message:e.message,...(safeDiagnostic(e)?{diagnostic:safeDiagnostic(e)}:{})});}
    }
    const d=this.vault.state();if(d.accounts[p]?.binding!==account.binding)fail('CONNECTION_CHANGED','Account changed during the access check.',409);
    const result={provider:p,checkedAt:new Date().toISOString(),readOnly:true,writesTested:false,checks};
    d.diagnostics??={};d.diagnostics[p]=result;await this.vault.save();return result;
  }
  async sync(p){
    providerId(p);if(this.syncs.has(p))return this.syncs.get(p);
    const operation=this._sync(p);this.syncs.set(p,operation);try{return await operation;}finally{this.syncs.delete(p);}
  }
  async _sync(p){
    const account=this.providers.account(p),caps=capabilities(account),d=this.vault.state();
    const snapshot=structuredClone(d.snapshots[p]||{messages:[],events:[],tasks:[],calendars:[],lists:[]});snapshot.errors=[];snapshot.notes=[];snapshot.attemptedAt=new Date().toISOString();
    const capture=async(service,fn)=>{try{await fn();snapshot[service+'UpdatedAt']=new Date().toISOString();}catch(e){snapshot.errors.push({service,code:e.code||'ERROR',message:e.message,...(safeDiagnostic(e)?{diagnostic:safeDiagnostic(e)}:{})});}};
    if(caps.mail)await capture('mail',async()=>{const page=await this.providers.messages(p);snapshot.messages=page.items;snapshot.mailPartial=page.partial;if(page.partial)snapshot.notes.push('Only the newest 30 inbox messages are loaded.');});
    if(caps.calendar)await capture('calendar',async()=>{
      const calendars=await this.providers.calendars(p);snapshot.calendars=calendars.items;snapshot.calendarListPartial=calendars.partial;
      const chosen=this.selectedCalendars(p,calendars.items),from=new Date(Date.now()-86400000).toISOString(),to=new Date(Date.now()+14*86400000).toISOString();let events=[],partial=false;
      for(const calendar of chosen){const page=await this.providers.events(p,calendar,from,to);events.push(...page.items);partial||=page.partial;}
      snapshot.events=events;snapshot.calendarPartial=partial;snapshot.calendarCoverage={from,to,calendars:chosen.map(c=>({id:c.id,title:c.title})),complete:!partial};
      if(partial)snapshot.notes.push('Event pagination was capped; calendar coverage is incomplete.');
    });
    if(caps.tasks)await capture('tasks',async()=>{
      const lists=await this.providers.lists(p);snapshot.lists=lists.items;snapshot.taskListsPartial=lists.partial;
      if(d.selections[p]?.listId&&!lists.items.some(l=>l.id===d.selections[p].listId))fail('TARGET_UNAVAILABLE','The selected task list is unavailable. Review your list selection.',409);
      const chosen=lists.items.find(l=>l.id===d.selections[p]?.listId)||lists.items.find(l=>l.default)||lists.items[0];
      const page=chosen?await this.providers.tasks(p,chosen):{items:[],partial:false};snapshot.tasks=page.items;snapshot.taskPartial=page.partial;snapshot.selectedList=chosen||null;
      if(page.partial)snapshot.notes.push('Task pagination was capped; this is not the complete task list.');
    });
    snapshot.selectionNeedsSync=false;snapshot.lastSync=new Date().toISOString();snapshot.syncState=snapshot.errors.length?(snapshot.errors.length>=[caps.mail,caps.calendar,caps.tasks].filter(Boolean).length?'failed':'partial'):'ok';if(!snapshot.errors.length)snapshot.lastSuccessfulSync=snapshot.lastSync;
    if(d.accounts[p]?.binding!==account.binding)fail('CONNECTION_CHANGED','Account changed while synchronizing.',409);
    d.snapshots[p]=snapshot;await this.vault.save();return snapshot;
  }
  async message(p,id){providerId(p);const s=this.vault.state().snapshots[p];const index=s?.messages.findIndex(m=>m.id===id);if(index===undefined||index<0)fail('SOURCE_NOT_FOUND','Choose a message returned by synchronization.',404);const m=await this.providers.message(p,id);s.messages[index]=m;await this.vault.save();return m;}
  async source(ref){if(!ref)return null;const p=providerId(ref.provider);text(ref.id,'source ID',2000,true);let m=this.vault.state().snapshots[p]?.messages.find(x=>x.id===ref.id);if(!m)fail('SOURCE_NOT_FOUND','The selected source is no longer cached.');if(!m.full)m=await this.message(p,ref.id);return {provider:p,id:m.id,title:m.title,url:m.url,sourceHash:m.sourceHash,messageId:m.messageId,replyTo:m.replyTo,observedAt:m.observedAt,truncated:m.truncated};}
  async freshAvailability(from,to,extra=null){
    const start=iso(from),end=iso(to);if(end<=start||Date.parse(end)-Date.parse(start)>7*86400000)fail('INVALID_RANGE','Choose a time window of at most seven days.');
    let events=[],coverage=[];
    for(const p of ['google','microsoft']){
      const d=this.vault.state(),a=d.accounts[p];if(!capabilities(a).calendar)continue;
      let calendars=d.snapshots[p]?.calendars;
      if(!calendars?.length)calendars=(await this.providers.calendars(p)).items;
      const selected=this.selectedCalendars(p,calendars);
      if(extra?.provider===p&&!selected.some(c=>c.id===extra.id)){const c=calendars.find(c=>c.id===extra.id);if(!c)fail('TARGET_UNAVAILABLE','Target calendar is unavailable.');selected.push(c);}
      if(!selected.length)fail('AVAILABILITY_UNKNOWN','No readable calendar was returned for a connected calendar account.',409);
      for(const c of selected){const page=await this.providers.events(p,c,start,end);if(page.partial)fail('AVAILABILITY_UNKNOWN','Calendar pagination is incomplete. No free-time guarantee or event creation is permitted.',409);events.push(...page.items);coverage.push({provider:p,id:c.id,title:c.title});}
    }
    if(!coverage.length)fail('CALENDAR_REQUIRED','Connect a calendar to calculate availability.',409);
    return {events,coverage,checkedAt:new Date().toISOString(),from:start,to:end};
  }
  async slots(body){const data=await this.freshAvailability(body.from,body.to);const minutes=Number(body.minutes);if(!Number.isInteger(minutes)||minutes<5||minutes>480)fail('INVALID_DURATION','Choose a duration between 5 and 480 minutes.');return {...data,events:undefined,slots:freeSlots(data.events,body.from,body.to,minutes)};}
  async preview(body){
    const p=providerId(body.provider),kind=body.kind,input=body.payload||{},d=this.vault.state(),a=this.providers.account(p),s=d.snapshots[p]||{};let payload;
    if(d.actions.length>=500)fail('ACTION_LIMIT','The local action journal reached 500 entries. Export records before resetting the connected vault.');
    if(kind==='draft'){this.providers.require(p,'drafts');payload={to:email(input.to),subject:text(input.subject,'subject',200,true),body:text(input.body,'draft body',12000,true)};if(/[\r\n]/.test(payload.subject))fail('HEADER_INJECTION','Email subject must be on one line.');}
    else if(kind==='event'){
      this.providers.require(p,'calendar_write');const calendar=s.calendars?.find(c=>c.id===input.calendarId);if(!calendar?.canEdit)fail('INVALID_TARGET','Choose a writable calendar returned by synchronization.');
      const start=iso(input.start),end=iso(input.end);if(Date.parse(start)<Date.now()-60000||end<=start||Date.parse(end)-Date.parse(start)>86400000)fail('INVALID_RANGE','Choose a future event lasting at most 24 hours.');
      payload={calendarId:calendar.id,calendarName:calendar.title,title:text(input.title,'event title',200,true),notes:text(input.notes||'','event notes',6000),start,end};
    } else if(kind==='task'){
      this.providers.require(p,'tasks_write');const list=s.lists?.find(l=>l.id===input.listId);if(!list)fail('INVALID_TARGET','Choose a task list returned by synchronization.');
      payload={listId:list.id,listName:list.title,title:text(input.title,'task title',200,true),notes:text(input.notes||'','task notes',6000),due:input.due?dateOnly(input.due):''};
    } else if(kind==='complete_task'){
      this.providers.require(p,'tasks_write');const task=s.tasks?.find(t=>t.id===input.taskId&&t.listId===input.listId);if(!task)fail('INVALID_TARGET','Choose a task returned by synchronization.');
      payload={listId:task.listId,listName:task.listName,taskId:task.id,title:task.title,version:task.version};
    } else fail('ACTION_UNSUPPORTED','Only drafts, personal time blocks and task creation/completion are implemented.');
    const source=await this.source(body.source),action={id:uid(),provider:p,account:a.email,binding:a.binding,kind,payload,source,status:'pending',createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString(),approvedAt:null,receipt:null};
    action.approvalHash=hash({id:action.id,binding:a.binding,kind,payload,source});d.actions.unshift(action);await this.vault.save();return action;
  }
  findAction(id){return this.vault.state().actions.find(a=>a.id===id)||fail('ACTION_NOT_FOUND','Action not found.',404);}
  async cancel(id){const a=this.findAction(id);if(a.status!=='pending')fail('ACTION_NOT_PENDING','Only an unexecuted proposal can be cancelled.');a.status='cancelled';await this.vault.save();return a;}
  async execute(body){
    const a=this.findAction(body.id);
    if(this.writeBusy)fail('WRITE_BUSY','Another external action is being checked or executed.',409);
    if(body.approved!==true||body.approvalHash!==a.approvalHash)fail('APPROVAL_REQUIRED','Explicit approval must match the immutable server-side preview.',403);
    if(this.executing.has(a.id)||a.status!=='pending')fail('ACTION_NOT_PENDING','This proposal was already handled. No second write was performed.',409);
    if(Date.parse(a.expiresAt)<Date.now())fail('PREVIEW_EXPIRED','This preview expired; create a new one.',409);
    if(this.providers.account(a.provider).binding!==a.binding)fail('CONNECTION_CHANGED','The target account changed; recreate the preview.',409);
    this.executing.add(a.id);this.writeBusy=true;let attempted=false;
    try {
      if(a.source){const live=await this.providers.message(a.source.provider,a.source.id);if(live.sourceHash!==a.source.sourceHash)fail('SOURCE_CHANGED','The source differs from the approved preview. Review it again.',409);}
      if(a.kind==='event'){
        const check=await this.freshAvailability(a.payload.start,a.payload.end,{provider:a.provider,id:a.payload.calendarId});
        if(check.events.some(e=>e.busy&&e.start<a.payload.end&&e.end>a.payload.start))fail('CALENDAR_CONFLICT','A selected calendar is now busy. No event was created.',409);
        a.availability={checkedAt:check.checkedAt,coverage:check.coverage};
      }
      if(a.kind==='complete_task'){
        const current=await this.providers.task(a.provider,a.payload.listId,a.payload.taskId),version=current.etag||current.lastModifiedDateTime||current.updated||'';
        if(current.status==='completed'||(a.payload.version&&version!==a.payload.version)||current.title!==a.payload.title)fail('TASK_CHANGED','This task changed since the preview. Synchronize and review it again.',409);
      }
      a.status='executing';a.approvedAt=new Date().toISOString();await this.vault.save();attempted=true;
      const created=await this.providers.execute(a),id=created?.id||(a.kind==='complete_task'?a.payload.taskId:'');
      if(!id)fail('MISSING_RECEIPT','Provider write returned no object ID; check the service before retrying.',502);
      a.receipt={provider:a.provider,id,createdAt:new Date().toISOString(),verifiedAt:null,url:''};a.status='created_unverified';await this.vault.save();
      try{a.receipt={...a.receipt,...await this.providers.verify(a,id)};a.status='verified';delete a.error;}catch(e){a.error=e.message;if(safeDiagnostic(e))a.diagnostic=safeDiagnostic(e);}
      await this.vault.save();return a;
    } catch(e){
      if(attempted&&!a.receipt){a.status=e.providerStatus&&[400,401,403,404,422,429].includes(e.providerStatus)?'rejected':'uncertain';}
      else if(!attempted)a.status='blocked';
      a.error=e.message;if(safeDiagnostic(e))a.diagnostic=safeDiagnostic(e);
      await this.vault.save();return a;
    } finally {this.executing.delete(a.id);this.writeBusy=false;}
  }
  async verify(id){const a=this.findAction(id);if(!a.receipt?.id)fail('NO_RECEIPT','No provider ID is available. Check the original service; do not repeat the write blindly.',409);a.receipt={...a.receipt,...await this.providers.verify(a,a.receipt.id)};a.status='verified';delete a.error;await this.vault.save();return a;}
}
