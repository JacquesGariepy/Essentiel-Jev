/** Synthetic provider transport for tests only. Not imported by the production server. */
import { SCOPES } from '../lib/connected/oauth.mjs';
const response=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
export function makeFixture(){
  const f={calls:[],failures:[],sourceText:'TEST FIXTURE. Please review the document and reply. No real customer data.',profileSuffix:'',grants:{},partialEvents:false,events:{google:[],microsoft:[]},drafts:{google:new Map(),microsoft:new Map()},tasks:{google:new Map(),microsoft:new Map()},counter:0};
  for(const p of ['google','microsoft'])f.tasks[p].set('task-'+p,{id:'task-'+p,title:'TEST FIXTURE: Review document',notes:'Synthetic test task',status:p==='google'?'needsAction':'notStarted',etag:p==='google'?'v1':undefined,lastModifiedDateTime:p==='microsoft'?'2026-09-19T01:00:00Z':undefined,due:p==='google'?'2026-09-25T00:00:00Z':undefined});
  f.fetch=async(url,options={})=>{
    const u=new URL(url),method=options.method||'GET',p=u.hostname.includes('microsoft')?'microsoft':'google',route=decodeURIComponent(u.pathname),body=typeof options.body==='string'&&options.headers?.['Content-Type']==='application/json'?JSON.parse(options.body):options.body;
    f.calls.push({url:u.href,method,body,headers:options.headers});
    const index=f.failures.findIndex(x=>(!x.method||x.method===method)&&route.includes(x.path));
    if(index>=0){const err=f.failures.splice(index,1)[0];if(err.timeout)throw new Error('Synthetic network loss');return response({error:{code:'fixture_failure'}},err.status||503);}
    if(route.endsWith('/token'))return response({access_token:'TEST-TOKEN-'+p,refresh_token:'TEST-REFRESH-'+p,expires_in:3600,scope:f.grants[p]??[...Object.values(SCOPES[p]),p==='google'?'https://www.googleapis.com/auth/userinfo.email':'User.Read offline_access'].join(' ')});
    if(route.endsWith('/userinfo'))return response({id:'TEST-google'+f.profileSuffix,email:'google@example.test',name:'TEST Google account'});
    if(route==='/v1.0/me')return response({id:'TEST-microsoft'+f.profileSuffix,mail:'microsoft@example.test',displayName:'TEST Microsoft account'});
    if(route==='/gmail/v1/users/me/messages'&&method==='GET')return response({messages:[{id:'message-google',threadId:'thread-google'}]});
    if(route==='/gmail/v1/users/me/messages/message-google')return response({id:'message-google',threadId:'thread-google',internalDate:'1789789200000',labelIds:['INBOX','UNREAD'],snippet:f.sourceText,payload:{mimeType:'text/plain',headers:[{name:'Subject',value:'TEST FIXTURE: Document review'},{name:'From',value:'sender@example.test'},{name:'Message-ID',value:'<test-source@example.test>'}],body:{data:Buffer.from(f.sourceText).toString('base64url')}}});
    if(route==='/v1.0/me/mailFolders/inbox/messages')return response({value:[{id:'message-microsoft',subject:'TEST FIXTURE: Review request',from:{emailAddress:{address:'sender@example.test'}},bodyPreview:f.sourceText,receivedDateTime:'2026-09-19T01:00:00Z',isRead:false,webLink:'https://outlook.office.com/mail/TEST',internetMessageId:'<test-ms@example.test>'}]});
    if(route==='/v1.0/me/messages/message-microsoft')return response({id:'message-microsoft',subject:'TEST FIXTURE: Review request',from:{emailAddress:{address:'sender@example.test'}},body:{contentType:'text',content:f.sourceText},receivedDateTime:'2026-09-19T01:00:00Z',isRead:false,webLink:'https://outlook.office.com/mail/TEST',internetMessageId:'<test-ms@example.test>'});
    if(route==='/calendar/v3/users/me/calendarList')return response({items:[{id:'calendar-google',summary:'TEST Personal',primary:true,timeZone:'America/Toronto',accessRole:'owner'}]});
    if(route==='/v1.0/me/calendars')return response({value:[{id:'calendar-microsoft',name:'TEST Work',isDefaultCalendar:true,canEdit:true}]});
    const eventBase=p==='google'?'/calendar/v3/calendars/calendar-google/events':'/v1.0/me/calendars/calendar-microsoft/events';
    if(method==='GET'&&(route===eventBase||route==='/v1.0/me/calendars/calendar-microsoft/calendarView')){
      const from=Date.parse(u.searchParams.get('timeMin')||u.searchParams.get('startDateTime')),to=Date.parse(u.searchParams.get('timeMax')||u.searchParams.get('endDateTime'));
      const items=f.events[p].filter(e=>{const start=Date.parse(e.start.dateTime+(e.start.timeZone==='UTC'&&!e.start.dateTime.endsWith('Z')?'Z':'')),end=Date.parse(e.end.dateTime+(e.end.timeZone==='UTC'&&!e.end.dateTime.endsWith('Z')?'Z':''));return end>from&&start<to;});
      return response(p==='google'?{items,...(f.partialEvents?{nextPageToken:'again'}:{})}:{value:items,...(f.partialEvents?{'@odata.nextLink':url}:{})});
    }
    if(method==='POST'&&route===eventBase){const event={id:body.id||'event-'+(++f.counter),...body,...(p==='google'?{htmlLink:'https://calendar.google.com/calendar/event?test=1'}:{webLink:'https://outlook.office.com/calendar/TEST'})};f.events[p].push(event);return response(event,201);}
    if(method==='GET'&&route.startsWith(eventBase+'/')){const id=route.split('/').at(-1),found=f.events[p].find(e=>e.id===id);return found?response(found):response({},404);}
    if(route==='/tasks/v1/users/@me/lists')return response({items:[{id:'list-google',title:'TEST Tasks'}]});
    if(route==='/v1.0/me/todo/lists')return response({value:[{id:'list-microsoft',displayName:'TEST Tasks',wellknownListName:'defaultList'}]});
    const taskBase=p==='google'?'/tasks/v1/lists/list-google/tasks':'/v1.0/me/todo/lists/list-microsoft/tasks';
    if(route===taskBase&&method==='GET')return response(p==='google'?{items:[...f.tasks[p].values()]}:{value:[...f.tasks[p].values()]});
    if(route===taskBase&&method==='POST'){const task={id:'created-task-'+(++f.counter),...body,status:p==='google'?'needsAction':'notStarted',etag:p==='google'?'v1':undefined};f.tasks[p].set(task.id,task);return response(task,201);}
    if(route.startsWith(taskBase+'/')){const id=route.split('/').at(-1),task=f.tasks[p].get(id);if(!task)return response({},404);if(method==='PATCH'){Object.assign(task,body);if(p==='google')task.etag='v2';}return response(task);}
    const draftBase=p==='google'?'/gmail/v1/users/me/drafts':'/v1.0/me/messages';
    if(route===draftBase&&method==='POST'){const d={id:'draft-'+(++f.counter),...body,...(p==='google'?{}:{isDraft:true,webLink:'https://outlook.office.com/mail/TEST-DRAFT'})};f.drafts[p].set(d.id,d);return response(d,201);}
    if(route.startsWith(draftBase+'/')&&method==='GET'){const d=f.drafts[p].get(route.split('/').at(-1));return d?response(d):response({},404);}
    if(route==='/drive/v3/files')return response({files:[{id:'file-google',name:'TEST FIXTURE: document.txt',mimeType:'text/plain',webViewLink:'https://drive.google.com/file/d/TEST/view',modifiedTime:'2026-09-19T01:00:00Z'}]});
    if(route.startsWith('/v1.0/me/drive/root/search'))return response({value:[{id:'file-microsoft',name:'TEST FIXTURE: document.txt',file:{mimeType:'text/plain'},webUrl:'https://onedrive.live.com/TEST',lastModifiedDateTime:'2026-09-19T01:00:00Z'}]});
    throw new Error('Unhandled synthetic provider route: '+method+' '+url);
  };
  return f;
}
export const fixtureEnv={GOOGLE_CLIENT_ID:'TEST-GOOGLE-CLIENT',GOOGLE_CLIENT_SECRET:'TEST-GOOGLE-SECRET',MICROSOFT_CLIENT_ID:'TEST-MS-CLIENT',MICROSOFT_CLIENT_SECRET:'TEST-MS-SECRET'};
export function seed(service,providers=['google','microsoft']){
  for(const p of providers)service.vault.state().accounts[p]={provider:p,subject:'TEST-'+p,binding:'binding-'+p,email:p+'@example.test',name:'TEST account',accessToken:'TEST-TOKEN-'+p,refreshToken:'TEST-REFRESH-'+p,expiresAt:Date.now()+3600000,scopes:[...Object.values(SCOPES[p])],connectedAt:new Date().toISOString()};
}
