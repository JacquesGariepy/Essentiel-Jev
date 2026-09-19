"""Single-shell UI integration checks. Real local HTTP; synthetic Google/Microsoft upstream.
Managed Chromium blocks loopback navigation. HTML/CSS and script modules are injected;
module packaging, history URL origin, browser storage and downloads use explicit test shims.
Production API code is not replaced. This is not a real-account OAuth browser test.
"""
import re,json,os,urllib.request,urllib.error,subprocess
from pathlib import Path
from contextlib import contextmanager
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs'/'validation-v0.3.2';OUT.mkdir(parents=True,exist_ok=True)
checks=[];errors=[]
def mark(label):
 checks.append(label);print('PASS:',label,flush=True)
@contextmanager
def server(*flags):
 process=subprocess.Popen(['node',str(ROOT/'tests/connected-browser-server.mjs'),*flags],cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
 try:
  line=process.stdout.readline()
  if not line:raise RuntimeError(process.stderr.read())
  base=json.loads(line)['origin']
  def transport(url,options=None):
   options=options or {};body=options.get('body')
   if not url.startswith('/api/'):raise ValueError('Test bridge permits only local API paths')
   headers={'X-Essentiel-Request':'1','Origin':base,**options.get('headers',{})}
   req=urllib.request.Request(base+url,data=body.encode() if body else None,headers=headers,method=options.get('method','GET'))
   try:
    with urllib.request.urlopen(req,timeout=25) as r:return {'status':r.status,'body':r.read().decode()}
   except urllib.error.HTTPError as e:return {'status':e.code,'body':e.read().decode()}
  def api(path):return json.loads(transport('/api/connected/'+path)['body'])
  yield transport,api
 finally:
  process.terminate();process.wait(timeout=10)
def build_html():
 def bundle(src,name):
  exports=re.findall(r'export\s+(?:async\s+)?(?:function|const|class)\s+(\w+)',src)
  src=re.sub(r'^import .*?;\s*$','',src,flags=re.M);src=re.sub(r'\bexport\s+(?=(?:async\s+)?(?:function|const|class)\b)','',src)
  return f'const {name}=(()=>{{\n{src}\nreturn {{{",".join(exports)}}};\n}})();'
 scripts=[]
 for name,var in [('core.js','C'),('systemone.js','S'),('catalog.js','catalogModule'),('i18n.js','i18nModule'),('demo.js','demoModule'),('connected.js','connectedTestModule')]: scripts.append(bundle((ROOT/'public'/name).read_text(),var))
 scripts+=['const {DOMAINS,WORKFLOWS,PROFILES}=catalogModule; const {UI,WEEKDAYS,policyText}=i18nModule; const {addDemoData}=demoModule;']
 app=re.sub(r'^import .*?;\s*$','',(ROOT/'public/app.js').read_text(),flags=re.M).replace("import('./connected.js')","Promise.resolve(connectedTestModule)")
 shim='''window.__storage={};window.__downloads=[];
 Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>window.__storage[k]??null,setItem:(k,v)=>window.__storage[k]=String(v),removeItem:k=>delete window.__storage[k]}});
 Object.defineProperty(window,'sessionStorage',{configurable:true,value:{getItem:k=>null,setItem:()=>{}}});
 window.fetch=async(url,options)=>{const r=await window.__transport(url,options||{});return new Response(r.body,{status:r.status,headers:{'Content-Type':'application/json'}})};
 const nativePush=history.pushState.bind(history),nativeReplace=history.replaceState.bind(history);
 history.pushState=(a,b,url)=>nativePush(a,b,new URL(url,'http://localhost:8787').hash||'#today');
 history.replaceState=(a,b,url)=>nativeReplace(a,b,new URL(url,'http://localhost:8787').hash||'#today');
 URL.createObjectURL=b=>{window.__downloads.push(b);return 'blob:test'};URL.revokeObjectURL=()=>{};HTMLAnchorElement.prototype.click=function(){};
 '''
 html=(ROOT/'public/index.html').read_text()
 for f in ['styles.css','connected-scoped.css']:html=html.replace(f'<link rel="stylesheet" href="/{f}">','<style>'+(ROOT/'public'/f).read_text()+'</style>')
 html=html.replace('<link rel="modulepreload" href="/connected.js">','').replace('<script type="module" src="/app.js"></script>','')
 html=html.replace('</body>','<script type="module">'+(shim+'\n'+'\n'.join(scripts)+'\n'+app).replace('</script','<\\/script')+'</script></body>')
 return html.replace('</body>','<div data-testid="synthetic-test-banner" style="position:fixed;right:8px;bottom:8px;z-index:1000;padding:6px 8px;background:#fff5ce;color:#2c291f;font:10px system-ui;border:1px solid #9b7e32;border-radius:5px;pointer-events:none">TEST SYNTHETIC · No real account</div></body>')

with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
 def open_page(transport):
  page=browser.new_page(viewport={'width':1440,'height':1000},timezone_id='America/Toronto');page.set_default_timeout(7000)
  page.on('pageerror',lambda e:errors.append(str(e)));page.expose_function('__transport',transport)
  page.set_content(build_html(),wait_until='load');page.wait_for_selector('h1');return page
 def idle(page):page.wait_for_function("!document.body.classList.contains('busy')")
 def route(page,name):
  for modal,close in [('#dialog','close'),('#modal','close-modal')]:
   if page.locator(modal).is_visible():page.locator(modal+' [data-action="'+close+'"]').click()
  if page.viewport_size['width']<=700 and not page.locator('.sidebar').evaluate("e=>e.classList.contains('is-open')"):page.locator('.topbar [data-action="menu"]').click()
  page.locator('.sidebar button[data-route="'+name+'"]').click()
  page.wait_for_selector('.sidebar button[data-route="'+name+'"][aria-current="page"]')
  if name.startswith('connected-') or name=='connections':page.wait_for_selector('#connectedHost h1')
 def click(page,action,extra=''):
  page.locator('[data-action="'+action+'"]'+extra).first.click();idle(page)
 def submit(page,name):
  page.locator('form[data-form="'+name+'"] [type="submit"]').click();idle(page)
  if page.locator('#formError').is_visible():assert page.locator('#formError').inner_text()==''
 def approve(page,api):
  assert api('status')['actions'][0]['status']=='pending';assert not page.locator('[name="approved"]').is_checked()
  page.locator('[name="approved"]').check();submit(page,'approve');assert api('status')['actions'][0]['status']=='verified';click(page,'close')
 with server() as (transport,api):
  page=open_page(transport)
  assert page.locator('.sidebar').count()==1 and page.locator('iframe').count()==0
  page.locator('#quickCapture').fill('TEST LOCAL: preserve across connected views');page.locator('#quickForm [type="submit"]').click()
  mark('One shared application shell; a personal task is created in memory')
  route(page,'connected-inbox');page.wait_for_selector('[data-action="message"]')
  assert page.locator('.sidebar').count()==1 and page.locator('[data-action="message"]').count()==4
  assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
  page.screenshot(path=str(OUT/'unified-mail-fr.png'),full_page=True)
  mark('Google and Microsoft fixture messages render inside the existing workspace shell without horizontal overflow')
  for name in ['connected-calendar','connected-tasks','connected-files','connected-actions','connections','inbox','planner','spaces','money','lists','decisions','notebook','lab','settings','today']:
   route(page,name);assert page.locator('h1').count()==1
  mark('All 16 local and connected routes render with one shared navigation')
  route(page,'planner');assert 'TEST LOCAL: preserve across connected views' in page.locator('#content').inner_text()
  mark('Local in-memory task survives navigation across all connected views without a reload')
  route(page,'connections');page.locator('#connectedHost a[href="#lab"]').click();page.wait_for_selector('.sidebar button[data-route="lab"][aria-current="page"]');route(page,'planner');assert 'TEST LOCAL: preserve across connected views' in page.locator('#content').inner_text()
  mark('The local laboratory shortcut remains hash-only and retains local in-memory work')
  route(page,'connected-inbox');page.locator('.topbar [data-action="theme"]').click();assert page.locator('html').get_attribute('data-theme')=='dark'
  route(page,'today');assert page.locator('html').get_attribute('data-theme')=='dark'
  route(page,'connected-inbox');page.locator('.topbar [data-action="language"]').click();page.wait_for_selector('#connectedHost h1');assert 'What needs your attention.' in page.locator('#connectedHost').inner_text()
  route(page,'today');assert page.locator('html').get_attribute('lang')=='en';page.locator('.topbar [data-action="theme"]').click();page.locator('.topbar [data-action="language"]').click()
  mark('Theme and FR/EN language are shared between local and connected views, without double event handlers')
  route(page,'connected-inbox');click(page,'message','[data-provider="google"]');click(page,'compose-source','[data-kind="draft"]')
  page.locator('[name="subject"]').fill('TEST draft');page.locator('[name="body"]').fill('Synthetic test; not a real message');submit(page,'compose');approve(page,api)
  mark('Source-linked Google draft still requires exact preview, human approval and read-back; no message sent')
  route(page,'connected-tasks');click(page,'complete-task','[data-provider="google"]');approve(page,api)
  mark('Connected task completion retains approval and verified state in the unified shell')
  route(page,'connected-calendar');click(page,'slot-form');submit(page,'slots');assert page.locator('[data-action="use-slot"]').count()>0
  click(page,'use-slot');page.locator('[name="title"]').fill('TEST private time block');submit(page,'compose');approve(page,api)
  mark('Calendar availability and approved personal time-block creation retain existing behavior')
  route(page,'connected-files');page.locator('[name="query"]').fill('document');submit(page,'file-search');assert 'TEST FIXTURE: document.txt' in page.locator('#connectedHost').inner_text()
  mark('Document search remains operational without reading file bodies')
  route(page,'connections');click(page,'diagnostics','[data-provider="google"]')
  report=api('status')['diagnostics']['google'];assert len(report['checks'])==4 and all(c['status']=='ok' for c in report['checks'])
  click(page,'export-diagnostic','[data-provider="google"]');exported=page.evaluate('async()=>await window.__downloads.at(-1).text()')
  assert 'TEST-TOKEN' not in exported and 'sender@' not in exported and 'Document review' not in exported
  mark('Four read-only service probes and diagnostic export work without exposing tokens or message content')
  page.set_viewport_size({'width':390,'height':844})
  for name in ['today','connected-inbox','connections']:
   route(page,name);assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
  page.screenshot(path=str(OUT/'unified-connections-mobile.png'),full_page=True)
  mark('Mobile personal, mail and connections views fit a 390-pixel viewport')
  page.close()
 with server('--google-only','--google-403') as (transport,api):
  page=open_page(transport);route(page,'connected-inbox');page.wait_for_selector('.diagnostic')
  assert api('status')['snapshots']['google']['syncState']=='failed'
  assert page.locator('#connectedHost .diagnostic').count()==3
  assert page.locator('#connectedHost .metric strong').all_text_contents()[:2]==['—','—']
  assert 'Impossible de charger les courriels.' in page.locator('#connectedHost').inner_text()
  assert 'Aucun courriel chargé pour ce filtre.' not in page.locator('#connectedHost').inner_text()
  mark('Three synthetic Google 403 refusals display unavailable data, not successful zero counts or an empty inbox')
  urls=page.locator('.diagnostic a[target="_blank"]').evaluate_all('(els)=>els.map(e=>e.href)')
  assert len(urls)==3 and all(u.startswith('https://console.cloud.google.com/apis/library/') and 'project=123456789012' in u for u in urls)
  assert 'non activée dans le projet Google' in page.locator('#connectedHost').inner_text()
  page.screenshot(path=str(OUT/'google-disabled-fr.png'),full_page=True)
  mark('SERVICE_DISABLED fixture errors identify the service and reported project with safe Google Cloud links')
  click(page,'diagnostics','[data-provider="google"]');page.wait_for_selector('.service-status')
  assert all(c['status']=='error' for c in api('status')['diagnostics']['google']['checks'])
  assert 'Compte identifié' in page.locator('#connectedHost').inner_text()
  mark('Account identification is distinct from four failed API access checks')
  page.locator('.topbar [data-action="language"]').click();page.wait_for_selector('#connectedHost h1')
  assert 'is not enabled in the Google project' in page.locator('#connectedHost').inner_text()
  page.set_viewport_size({'width':390,'height':844});assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
  page.screenshot(path=str(OUT/'google-disabled-mobile-en.png'),full_page=True)
  mark('Actionable provider diagnostics translate to English and remain usable at mobile width')
  page.close()
 assert not errors,errors
 mark('No uncaught JavaScript errors in healthy and Google-403 integration scenarios')
 browser.close()
report={'count':len(checks),'checks':checks,'uncaughtErrors':errors,'realAccountsTested':False,'upstream':'synthetic','loopbackBrowserNavigation':'attempted separately; ERR_BLOCKED_BY_ADMINISTRATOR','limitations':['Injected DOM and module packaging; dynamic import resolved through a test module binding.','Fetch bridged to real local HTTP with synthetic upstream APIs.','Browser history origin, storage and download mechanics use test shims.','No Google or Microsoft account, actual OAuth browser redirect, paid TypeSafe inference or Windows installation tested.']}
(OUT/'unified-browser.json').write_text(json.dumps(report,indent=2,ensure_ascii=False))
print(json.dumps(report,ensure_ascii=False,indent=2))
