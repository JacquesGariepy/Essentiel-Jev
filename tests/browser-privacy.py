"""Offline UI race-condition checks. All HTTP, storage and upstream responses are test doubles."""
import json, os
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
shim=r'''<script>
window.__storage={};window.__held=null;window.__calls=[];
Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>window.__storage[k]??null,setItem:(k,v)=>window.__storage[k]=String(v),removeItem:k=>delete window.__storage[k]}});
const result=x=>({ok:true,status:200,json:async()=>x});
window.fetch=async(path,options={})=>{
 if(path==='/api/config')return result({configured:true,model:'TEST-DOUBLE-NOT-A-MODEL'});
 const body=JSON.parse(options.body);window.__calls.push({path,body});
 return new Promise(resolve=>{window.__held=()=>{
  if(path==='/api/analyze')resolve(result({record:{...body.item,bucket:'read',mode:'live',reason:'Controlled test response; not inference.',evidence:body.item.text,suggestedDate:'2026-11-01',confirmedDate:null,model:'TEST-DOUBLE-NOT-A-MODEL',usage:{input_tokens:1},history:[]}}));
  else {const answers={};for(const [id,q]of Object.entries(body.questions)){if(q.type==='noul')answers[id]={type:'noul',noul:.5};else{const keys=q.type==='score'?q.criteria.map((_,i)=>String(i)):Object.keys(q.criteria);answers[id]={type:q.type,confidence:.1,probabilities:Object.fromEntries(keys.map(k=>[k,1/keys.length]))};if(q.type==='choice')answers[id].choice=keys[0];else Object.assign(answers[id],{score:(keys.length-1)/2,legend:Object.fromEntries(q.criteria.map((c,i)=>[String(i),c]))});}}resolve(result({answers,model:'TEST-DOUBLE-NOT-A-MODEL',usage:{input_tokens:1}}));}
  window.__held=null;
 };});
};
</script>'''
source=(ROOT/'preview-en.html').read_text().replace('window.ESSENTIEL_PREVIEW=true;','window.ESSENTIEL_PREVIEW=false;').replace('<head>','<head>'+shim,1)
checks=[];errors=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox']);page=b.new_page(viewport={'width':1440,'height':1000});page.set_default_timeout(5000);page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(source,wait_until='load');page.wait_for_selector('h1')
 def click(a):page.locator(f'[data-action="{a}"]').first.click()
 def close():
  if page.locator('#modal').is_visible():click('close-modal')
 def route(r):close();page.locator(f'.sidebar [data-route="{r}"]').click()
 def submit(f):page.locator(f'#{f} [type="submit"]').click()
 def state():return page.evaluate("JSON.parse(window.__storage['essentiel.workspace.v2']).workspace")
 def persist():route('settings');page.locator('#persistToggle').check()
 def new_source(title):
  route('inbox');click('new-source');page.locator('#title').fill(title);page.locator('#text').fill('Review the submitted form.');submit('sourceForm');return state()['records'][-1]['id']
 def analyze(id):
  page.locator(f'[data-action="view-source"][data-id="{id}"]').first.click();click('analyze-source');page.locator('#sendConsent').check();click('execute-inbox');page.wait_for_function('window.__held!==null')
 def resolve():page.evaluate('window.__held()');page.wait_for_timeout(100)
 persist();id=new_source('Race condition source');analyze(id)
 page.locator(f'[data-action="view-source"][data-id="{id}"]').first.click();page.locator('#bucket').select_option('archived');page.locator('#confirmedDate').fill('2026-10-05');submit('sourceReviewForm');resolve()
 r=state()['records'][0];assert r['bucket']=='archived' and r['confirmedDate']=='2026-10-05' and r['mode']=='live'
 checks.append('Late source results preserve manual classification and date confirmed during the request')
 analyze(id);route('settings');click('erase');click('confirm-action');resolve();assert not page.evaluate("window.__storage['essentiel.workspace.v2']")
 persist();assert state()['records']==[] and state()['runs']==[];checks.append('Erasing during a pending source request prevents late source resurrection')
 route('lab');submit('labForm');page.locator('#sendConsent').check();click('execute-lab');page.wait_for_function('window.__held!==null');route('settings');click('erase');click('confirm-action');resolve();persist();assert state()['runs']==[]
 checks.append('Erasing during a pending lab request prevents late run resurrection')
 assert len(page.evaluate('window.__calls'))==3 and not errors
 checks.append('Three consented requests were isolated to controlled test doubles; no uncaught errors')
 result={'status':'passed','count':len(checks),'checks':checks,'uncaught_errors':errors,'limitations':['All fetch, storage and provider responses are controlled test doubles.','No native inference, provider cancellation, retention or credential behavior is established.']}
 (ROOT/'docs/validation/browser-privacy.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,indent=2));b.close()
