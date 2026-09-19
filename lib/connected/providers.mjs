import { mimeSubject, AppError, fail, enc, text, safeLink, plainHTML, extractAddress, iso, zonedInstant, hash, decodeCharset, decodeEntities, tidyText, sanitizeHTML } from './common.mjs';
import { capabilities } from './oauth.mjs';
const GOOGLE={mail:'https://gmail.googleapis.com/gmail/v1/users/me/',calendar:'https://www.googleapis.com/calendar/v3/',tasks:'https://tasks.googleapis.com/tasks/v1/',files:'https://www.googleapis.com/drive/v3/'};
const GRAPH='https://graph.microsoft.com/v1.0/';
const maxText=8000;
function cap(v,n=500){return String(v||'').slice(0,n);}
const googleHeaders = m => Object.fromEntries((m.payload?.headers||[]).map(h=>[h.name.toLowerCase(),h.value]));
// Each MIME part is decoded with its declared charset (French mail is often iso-8859-1 / windows-1252), UTF-8 otherwise.
function gmailBody(payload) {
  const plain=[],html=[];
  function walk(part,depth=0){if(!part||depth>20)return;if(part.body?.data){const type=(part.headers||[]).find(h=>/^content-type$/i.test(h.name))?.value||part.mimeType||'',s=decodeCharset(Buffer.from(part.body.data,'base64url'),type);if(part.mimeType==='text/plain')plain.push(s);else if(part.mimeType==='text/html')html.push(s);}for(const p of (part.parts||[]).slice(0,100))walk(p,depth+1);}
  walk(payload);return {text:plain.length?tidyText(plain.join('\n')):plainHTML(html.join('\n')),html:html.join('\n')};
}
export function normalizeMessage(p,m,account,full=false) {
  if(typeof m.id!=='string'||!m.id)fail('SOURCE_ID_MISSING','Mail source has no provider ID.',502);
  const h=p==='google'?googleHeaders(m):{};
  // Graph bodies are already Unicode strings; Gmail snippets carry HTML character references.
  const msHtml=full&&m.body?.contentType?.toLowerCase()==='html'?String(m.body.content||''):'';
  const decoded=p==='google'?(full?gmailBody(m.payload):{text:decodeEntities(m.snippet||''),html:''}):{text:full?(msHtml?plainHTML(msHtml):tidyText(m.body?.content||m.bodyPreview||'')):tidyText(m.bodyPreview||''),html:msHtml};
  const body=decoded.text||'';
  const record={id:m.id,provider:p,kind:'message',title:cap(p==='google'?h.subject:m.subject),from:cap(p==='google'?h.from:m.from?.emailAddress?.address),replyTo:extractAddress(p==='google'?(h['reply-to']||h.from):(m.replyTo?.[0]?.emailAddress?.address||m.from?.emailAddress?.address)),text:body.slice(0,maxText),truncated:body.length>maxText,full,receivedAt:p==='google'?new Date(Number(m.internalDate||0)).toISOString():m.receivedDateTime||'',unread:p==='google'?(m.labelIds||[]).includes('UNREAD'):!m.isRead,threadId:p==='google'?m.threadId:m.conversationId,messageId:cap(p==='google'?h['message-id']:m.internetMessageId,500),url:p==='google'?`https://mail.google.com/mail/?authuser=${enc(account.email)}#inbox/${enc(m.threadId||m.id)}`:safeLink(m.webLink,p),observedAt:new Date().toISOString()};
  record.sourceHash=hash({id:record.id,title:record.title,from:record.from,text:record.text,receivedAt:record.receivedAt});
  // Formatted view only: sanitized HTML kept outside the vault by the service, never sent to Jev or a drafting engine.
  if(full&&decoded.html)Object.defineProperty(record,'html',{value:sanitizeHTML(decoded.html),enumerable:false});
  return record;
}
export function normalizeEvent(p,e,calendar) {
  const own=(e.attendees||[]).find(x=>x.self);
  if(e.status==='cancelled'||e.isCancelled||own?.responseStatus==='declined')return null;
  const start=p==='google'?(e.start?.dateTime?iso(e.start.dateTime):zonedInstant(e.start.date+'T00:00:00',calendar.timeZone||'UTC')):zonedInstant(e.start.dateTime,e.start.timeZone||'UTC');
  const end=p==='google'?(e.end?.dateTime?iso(e.end.dateTime):zonedInstant(e.end.date+'T00:00:00',calendar.timeZone||'UTC')):zonedInstant(e.end.dateTime,e.end.timeZone||'UTC');
  if(end<=start)fail('INVALID_EVENT_TIME','A provider event has an invalid interval; availability is unknown.',502);
  return {id:e.id,provider:p,calendarId:calendar.id,calendarName:calendar.title,title:cap(e.summary||e.subject),start,end,allDay:Boolean(e.start?.date||e.isAllDay),busy:p==='google'?e.transparency!=='transparent':e.showAs!=='free',url:safeLink(e.htmlLink||e.webLink,p),version:e.etag||e.changeKey||'',observedAt:new Date().toISOString()};
}
export function normalizeTask(p,t,list) {
  return {id:t.id,provider:p,listId:list.id,listName:list.title,title:cap(t.title),notes:cap(t.notes||t.body?.content,6000),due:(t.due||t.dueDateTime?.dateTime||'').slice(0,10),completed:t.status==='completed',version:t.etag||t.lastModifiedDateTime||t.updated||'',url:safeLink(t.webViewLink,p)|| (p==='google'?'https://tasks.google.com/':'https://to-do.office.com/tasks/'),observedAt:new Date().toISOString()};
}
export class Providers {
  constructor(oauth){this.oauth=oauth;this.calls=[];}
  account(p){const a=this.oauth.vault.state().accounts[p];if(!a)fail('NOT_CONNECTED','Connect this account first.',409);return a;}
  require(p,feature){const a=this.account(p);if(!capabilities(a)[feature])fail('PERMISSION_REQUIRED',`Authorize ${feature} for ${p} first.`,403);return a;}
  async request(p,service,route,{method='GET',body,headers={}}={}) {
    const base=p==='google'?GOOGLE[service]:GRAPH;
    if(!base)fail('INVALID_SERVICE','Unknown provider service.');
    const u=new URL(route,base),root=new URL(base);
    if(u.origin!==root.origin||!u.pathname.startsWith(root.pathname)||u.username||u.password)fail('UNTRUSTED_NEXT_LINK','Provider pagination left the allowed API origin or prefix.',502);
    const now=Date.now();this.calls=this.calls.filter(x=>x>now-60000);if(this.calls.length>=240)fail('RATE_LIMITED','Local connector request limit reached; retry later.',429);this.calls.push(now);
    const token=await this.oauth.token(p);
    const options={method,headers:{Accept:'application/json',Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})};
    // No automatic write retry: ambiguous network outcomes must be reconciled first.
    try{return await this.oauth.http(u.href,options);}catch(e){if(method==='GET'&&e.providerStatus===401){options.headers.Authorization=`Bearer ${await this.oauth.token(p,true)}`;return this.oauth.http(u.href,options);}throw e;}
  }
  async page(p,service,route,{maxPages=3,limit=300,headers={}}={}) {
    let next=route,items=[],count=0,incomplete=false;
    while(next&&count++<maxPages&&items.length<limit){const page=await this.request(p,service,next,{headers});const entries=p==='google'?(page.items||page.files||page.messages||[]):page.value||[];if(!Array.isArray(entries))fail('INVALID_PAGE','Provider returned an invalid collection.',502);items.push(...entries);incomplete ||= page.incompleteSearch===true;
      if(p==='google'&&page.nextPageToken){const u=new URL(route,GOOGLE[service]);u.searchParams.set('pageToken',page.nextPageToken);next=u.href;}else next=page['@odata.nextLink']||null;
    }
    return {items:items.slice(0,limit),partial:incomplete||Boolean(next)||items.length>limit};
  }
  async messages(p) {
    const a=this.require(p,'mail');
    if(p==='google') {
      const page=await this.request(p,'mail','messages?labelIds=INBOX&maxResults=30');const items=[];
      for(const item of (page.messages||[]).slice(0,30)){const m=await this.request(p,'mail',`messages/${enc(item.id)}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Reply-To&metadataHeaders=Message-ID`);items.push(normalizeMessage(p,m,a));}
      return {items,partial:Boolean(page.nextPageToken),scope:'Inbox · newest 30 messages; not the whole mailbox'};
    }
    const page=await this.page(p,'mail',"me/mailFolders/inbox/messages?$top=30&$orderby=receivedDateTime%20desc&$select=id,subject,from,replyTo,bodyPreview,receivedDateTime,isRead,webLink,conversationId,internetMessageId",{maxPages:1,limit:30});
    return {...page,items:page.items.map(m=>normalizeMessage(p,m,a)),scope:'Inbox · newest 30 messages; not the whole mailbox'};
  }
  async message(p,id) {
    const a=this.require(p,'mail');
    const m=await this.request(p,'mail',p==='google'?`messages/${enc(id)}?format=full`:`me/messages/${enc(id)}?$select=id,subject,from,replyTo,body,bodyPreview,receivedDateTime,isRead,webLink,conversationId,internetMessageId`,{headers:p==='microsoft'?{Prefer:'outlook.body-content-type="text"'}:{}});
    return normalizeMessage(p,m,a,true);
  }
  async calendars(p) {
    this.require(p,'calendar');
    const page=await this.page(p,'calendar',p==='google'?'users/me/calendarList?maxResults=100&fields=items(id,summary,timeZone,accessRole,primary),nextPageToken':'me/calendars?$top=100&$select=id,name,isDefaultCalendar,canEdit');
    return {...page,items:page.items.map(c=>({id:c.id,title:c.summary||c.name||c.id,primary:Boolean(c.primary||c.isDefaultCalendar),timeZone:c.timeZone||'UTC',canEdit:p==='google'?['owner','writer'].includes(c.accessRole):c.canEdit===true}))};
  }
  async events(p,calendar,from,to) {
    this.require(p,'calendar');
    const route=p==='google'?`calendars/${enc(calendar.id)}/events?${new URLSearchParams({timeMin:iso(from),timeMax:iso(to),singleEvents:'true',orderBy:'startTime',maxResults:'250',timeZone:'UTC'})}`:`me/calendars/${enc(calendar.id)}/calendarView?${new URLSearchParams({startDateTime:iso(from),endDateTime:iso(to),'$top':'250','$select':'id,subject,start,end,isAllDay,isCancelled,showAs,webLink,changeKey'})}`;
    const page=await this.page(p,'calendar',route,{maxPages:4,limit:1000,headers:p==='microsoft'?{Prefer:'outlook.timezone="UTC"'}:{}});
    return {...page,items:page.items.map(e=>normalizeEvent(p,e,calendar)).filter(Boolean)};
  }
  async lists(p) {
    this.require(p,'tasks');const page=await this.page(p,'tasks',p==='google'?'users/@me/lists?maxResults=100':'me/todo/lists?$top=100');return {...page,items:page.items.map(l=>({id:l.id,title:l.title||l.displayName,default:l.wellknownListName==='defaultList'}))};
  }
  async tasks(p,list) {
    this.require(p,'tasks');const page=await this.page(p,'tasks',p==='google'?`lists/${enc(list.id)}/tasks?maxResults=100&showCompleted=false&showDeleted=false`:`me/todo/lists/${enc(list.id)}/tasks?$top=100`,{limit:300});
    return {...page,items:page.items.map(t=>normalizeTask(p,t,list)).filter(t=>!t.completed)};
  }
  async task(p,listId,id){this.require(p,'tasks');return this.request(p,'tasks',p==='google'?`lists/${enc(listId)}/tasks/${enc(id)}`:`me/todo/lists/${enc(listId)}/tasks/${enc(id)}`);}
  async files(p,query) {
    this.require(p,'files');const q=text(query,'file search',150,true);
    const route=p==='google'?`files?${new URLSearchParams({q:`trashed = false and name contains '${q.replace(/\\/g,'\\\\').replace(/'/g,"\\'")}'`,pageSize:'50',fields:'nextPageToken,incompleteSearch,files(id,name,mimeType,webViewLink,modifiedTime)',orderBy:'modifiedTime desc'})}`:`me/drive/root/search(q='${enc(q.replace(/'/g,"''"))}')?$top=50&$select=id,name,webUrl,lastModifiedDateTime,file,folder`;
    const page=await this.page(p,'files',route,{maxPages:1,limit:50});
    return {...page,items:page.items.map(f=>({id:f.id,provider:p,title:cap(f.name),url:safeLink(f.webViewLink||f.webUrl,p),modifiedAt:f.modifiedTime||f.lastModifiedDateTime||'',type:f.mimeType||(f.folder?'folder':f.file?.mimeType||'file')}))};
  }
  async execute(action) {
    const {provider:p,kind,payload:d}=action;
    if(kind==='draft'){
      const a=this.require(p,'drafts');
      if(p==='google'){
        const encodedSubject=mimeSubject(d.subject);
        const body=Buffer.from(d.body,'utf8').toString('base64').match(/.{1,76}/g)?.join('\r\n')||'';
        const source=action.source?.provider===p?action.source:null;
        const messageId=source?.messageId&&/^<[^<>\r\n\s]+>$/.test(source.messageId)?source.messageId:'';
        const raw=[`To: ${d.to}`,`From: ${extractAddress(a.email)}`,`Subject: ${encodedSubject}`,`Message-ID: <${action.id}@essentiel.local>`,'MIME-Version: 1.0','Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: base64',...(messageId?[`In-Reply-To: ${messageId}`,`References: ${messageId}`]:[]),'',body].join('\r\n');
        return this.request(p,'mail','drafts',{method:'POST',body:{message:{raw:Buffer.from(raw,'utf8').toString('base64url')}}});
      }
      return this.request(p,'mail','me/messages',{method:'POST',body:{subject:d.subject,body:{contentType:'Text',content:d.body},toRecipients:[{emailAddress:{address:d.to}}]}});
    }
    if(kind==='event') {
      this.require(p,'calendar_write');
      if(p==='google')return this.request(p,'calendar',`calendars/${enc(d.calendarId)}/events?sendUpdates=none`,{method:'POST',body:{id:hash(action.id).slice(0,32),summary:d.title,description:d.notes,start:{dateTime:d.start},end:{dateTime:d.end},visibility:'private',reminders:{useDefault:false},extendedProperties:{private:{essentielActionId:action.id}}}});
      return this.request(p,'calendar',`me/calendars/${enc(d.calendarId)}/events`,{method:'POST',body:{subject:d.title,body:{contentType:'Text',content:d.notes},start:{dateTime:d.start.replace('Z',''),timeZone:'UTC'},end:{dateTime:d.end.replace('Z',''),timeZone:'UTC'},transactionId:action.id,isReminderOn:false,sensitivity:'private',showAs:'busy'}});
    }
    if(kind==='task'){
      this.require(p,'tasks_write');
      return this.request(p,'tasks',p==='google'?`lists/${enc(d.listId)}/tasks`:`me/todo/lists/${enc(d.listId)}/tasks`,{method:'POST',body:p==='google'?{title:d.title,notes:d.notes,...(d.due?{due:d.due+'T00:00:00Z'}:{})}:{title:d.title,body:{contentType:'text',content:d.notes},...(d.due?{dueDateTime:{dateTime:d.due+'T00:00:00',timeZone:'UTC'}}:{})}});
    }
    if(kind==='complete_task'){
      this.require(p,'tasks_write');
      return this.request(p,'tasks',p==='google'?`lists/${enc(d.listId)}/tasks/${enc(d.taskId)}`:`me/todo/lists/${enc(d.listId)}/tasks/${enc(d.taskId)}`,{method:'PATCH',headers:p==='google'&&d.version?{'If-Match':d.version}:{},body:{status:'completed'}});
    }
    fail('ACTION_UNSUPPORTED','Unsupported external action.');
  }
  async verify(action,id) {
    const {provider:p,kind,payload:d}=action;let data;
    if(kind==='draft')data=await this.request(p,'mail',p==='google'?`drafts/${enc(id)}?format=metadata`:`me/messages/${enc(id)}?$select=id,isDraft,subject,webLink`);
    if(kind==='event')data=await this.request(p,'calendar',p==='google'?`calendars/${enc(d.calendarId)}/events/${enc(id)}`:`me/calendars/${enc(d.calendarId)}/events/${enc(id)}?$select=id,subject,start,end,webLink`);
    if(kind==='task'||kind==='complete_task')data=await this.task(p,d.listId,id);
    if(!data||data.id!==id)fail('VERIFICATION_FAILED','Provider object ID could not be verified.',502);
    if(kind==='complete_task'&&data.status!=='completed')fail('VERIFICATION_FAILED','Provider task is not completed.',502);
    if(kind==='draft'&&p==='microsoft'&&!data.isDraft)fail('VERIFICATION_FAILED','The provider object is no longer a draft.',502);
    return {id,provider:p,verifiedAt:new Date().toISOString(),url:safeLink(data.htmlLink||data.webLink||data.webViewLink,p)||(p==='google'&&kind==='draft'?`https://mail.google.com/mail/?authuser=${enc(this.account(p).email)}#drafts`:['task','complete_task'].includes(kind)?(p==='google'?'https://tasks.google.com/':'https://to-do.office.com/tasks/'):'')};
  }
}
