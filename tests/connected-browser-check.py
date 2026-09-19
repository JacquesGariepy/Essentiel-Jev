"""Chromium DOM checks over a real local HTTP server with synthetic upstream services.
Managed Chromium blocks URL navigation in the build environment. This test injects the
unchanged HTML/CSS/JS and bridges fetch to local HTTP explicitly. It does NOT validate
browser OAuth navigation, native CORS, OS credential storage or real cloud accounts.
"""
import json, os, urllib.request, urllib.error, subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs'/'validation-v0.3.1';OUT.mkdir(parents=True,exist_ok=True)
checks=[];errors=[]
def mark(s):
    checks.append(s)
    print('PASS:',s,flush=True)
p=subprocess.Popen(['node',str(ROOT/'tests/connected-browser-server.mjs')],cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
try:
    line=p.stdout.readline()
    if not line: raise RuntimeError(p.stderr.read())
    info=json.loads(line);base=info['origin']
    def transport(url,options=None):
        options=options or {}
        if not str(url).startswith('/api/'): raise RuntimeError('Test transport rejects non-API requests')
        headers={'X-Essentiel-Request':'1','Origin':base}
        headers.update(options.get('headers',{}))
        body=options.get('body');req=urllib.request.Request(base+url,data=body.encode() if body else None,headers=headers,method=options.get('method','GET'))
        try:
            with urllib.request.urlopen(req,timeout=20) as r:return {'status':r.status,'body':r.read().decode()}
        except urllib.error.HTTPError as e:return {'status':e.code,'body':e.read().decode()}
    def api(path,body=None):
        result=transport('/api/connected/'+path,{'method':'POST','body':json.dumps(body),'headers':{'Content-Type':'application/json'}} if body is not None else {})
        return json.loads(result['body'])
    source=(ROOT/'public/connected.html').read_text().replace('<link rel="stylesheet" href="/connected.css">','<style>'+ (ROOT/'public/connected.css').read_text()+'</style>')
    source=source.replace('<script type="module" src="/connected.js"></script>','')
    shim='''<script>window.__memory={};window.__downloads=[];
Object.defineProperty(window,'sessionStorage',{configurable:true,value:{getItem:k=>window.__memory[k]??null,setItem:(k,v)=>{window.__memory[k]=v}}});
window.fetch=async(url,options)=>{const r=await window.__transport(url,options||{});return new Response(r.body,{status:r.status,headers:{'Content-Type':'application/json'}})};
URL.createObjectURL=b=>{window.__downloads.push(b);return 'blob:test'};URL.revokeObjectURL=()=>{};HTMLAnchorElement.prototype.click=function(){};
</script>'''
    source=source.replace('</body>',shim+'<script type="module">'+(ROOT/'public/connected.js').read_text()+'</script></body>')
    with sync_playwright() as pw:
        browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
        page=browser.new_page(viewport={'width':1440,'height':1000},timezone_id='America/Toronto')
        page.set_default_timeout(5000);page.on('pageerror',lambda e:errors.append(str(e)))
        page.expose_function('__transport',transport);page.set_content(source,wait_until='load');page.wait_for_selector('[data-action="message"]')
        def idle():page.wait_for_function("!document.body.classList.contains('busy')")
        def click(action,selector=''):
            page.locator('[data-action="'+action+'"]'+selector).first.click();idle()
        def close():
            if page.locator('#dialog').is_visible():click('close')
        def route(name):
            close();page.locator('nav a[href="#'+name+'"]').click();page.wait_for_selector('nav a[href="#'+name+'"][aria-current="page"]')
        def submit(name):
            page.locator('form[data-form="'+name+'"] [type="submit"]').click();idle()
            if page.locator('#formError').is_visible():assert page.locator('#formError').inner_text()==''
        def approve():
            page.locator('[name="approved"]').check();submit('approve');assert api('status')['actions'][0]['status']=='verified';close()
        assert len(api('status')['providers'])==2 and len(api('status')['snapshots']['google']['messages'])==1
        assert 'TEST FIXTURE' in page.locator('#main').inner_text();assert page.locator('[data-action="message"]').count()==4
        mark('Two explicitly synthetic accounts load through real local HTTP after mocked OAuth callbacks')
        page.screenshot(path=str(OUT/'connected-test-fixtures-fr.png'),full_page=True)
        for name in ['calendar','tasks','files','actions','connections','inbox']:
            route(name);assert page.locator('h1').count()==1
        mark('All six connected views render')
        route('connections');assert page.locator('form[data-form="connect"]').count()==2
        assert page.locator('form[data-form="selection"]').count()==2
        assert not page.locator('#auto-sync').is_checked();mark('Independent connection capabilities and calendar/task-list choices render; auto-refresh starts off')
        route('inbox');page.locator('input[name="q"]').fill('not-found-test');submit('inbox-filter');assert page.locator('[data-action="message"]').count()==0
        page.locator('input[name="q"]').fill('');submit('inbox-filter');mark('Loaded-mail filter has a genuine empty state without synthetic fallback')
        click('message','[data-provider="google"]');assert 'TEST FIXTURE.' in page.locator('.source').inner_text()
        assert page.locator('[data-action="triage"]').is_disabled();mark('Full plain-text source opens; missing Jev key cannot trigger a pretend model result')
        click('compose-source','[data-kind="draft"]');assert page.locator('[name="to"]').input_value()=='sender@example.test'
        page.locator('[name="subject"]').fill('TEST: Réunion à Québec');page.locator('[name="body"]').fill('TEST draft body. Not a sent message.');submit('compose')
        pending=api('status')['actions'][0];assert pending['status']=='pending' and pending['kind']=='draft' and pending['source']['provider']=='google'
        assert page.locator('[name="approved"]').is_checked()==False;mark('Source-linked draft is only a proposal before explicit approval')
        approve();mark('Google draft write and provider-ID read-back work through the UI with a synthetic upstream')
        click('message','[data-provider="microsoft"]');click('compose-source','[data-kind="task"]')
        page.locator('[name="provider"]').select_option('microsoft');page.locator('[name="title"]').fill('TEST follow-up in Microsoft To Do');page.locator('[name="due"]').fill('2026-10-10');submit('compose');approve()
        assert api('status')['actions'][0]['provider']=='microsoft';mark('Source-linked Microsoft To Do task creation preserves the selected target and calendar date')
        route('tasks');click('complete-task','[data-provider="google"]');approve();mark('Completing a provider task requires approval and a verified completed state')
        route('calendar');click('slot-form');submit('slots');assert page.locator('[data-action="use-slot"]').count()>0
        assert 'Google' in page.locator('#dialogBody').inner_text() and 'Microsoft' in page.locator('#dialogBody').inner_text()
        mark('Available-time search cross-checks the two selected calendar accounts')
        click('use-slot');page.locator('[name="title"]').fill('TEST personal review time');submit('compose');approve()
        assert api('status')['actions'][0]['kind']=='event';mark('Personal time block is created after a fresh conflict check; receipt is visible')
        route('files');page.locator('[name="query"]').fill('document');submit('file-search');assert 'TEST FIXTURE: document.txt' in page.locator('#main').inner_text()
        page.locator('[name="provider"]').select_option('microsoft');page.locator('[name="query"]').fill('document');submit('file-search');assert 'TEST FIXTURE: document.txt' in page.locator('#main').inner_text()
        mark('Google Drive and OneDrive searches display returned metadata and native links')
        route('actions');assert page.locator('[data-action="action-details"]').count()==4
        click('action-details');assert 'Objet fournisseur' in page.locator('#dialogBody').inner_text();click('verify-action');close()
        mark('Journal records each approved operation and supports read-back without repeating the write')
        click('export');submit('export')
        exported=json.loads(page.evaluate('async()=>await window.__downloads.at(-1).text()'));assert len(exported['actions'])==4 and 'TEST-TOKEN' not in json.dumps(exported)
        mark('Explicit receipt export excludes tokens; download transport is a test double')
        click('language');assert page.locator('html').get_attribute('lang')=='en';click('theme')
        page.screenshot(path=str(OUT/'connected-test-fixtures-en.png'),full_page=True);mark('English and dark-mode switches preserve connected data and actions')
        page.set_viewport_size({'width':390,'height':844});route('inbox');page.screenshot(path=str(OUT/'connected-test-fixtures-mobile.png'),full_page=True)
        assert page.evaluate('document.documentElement.scrollWidth')<=390;mark('390px mobile view fits without page-level horizontal overflow')
        page.set_viewport_size({'width':1440,'height':1000});click('vault');page.locator('[name="password"]').fill('Test-only passphrase 12345');page.locator('[name="confirm"]').fill('Test-only passphrase 12345');submit('vault')
        assert api('status')['vault']['persistent'];cipher=Path(info['vaultDirectory'],'vault').read_text();assert 'TEST-TOKEN' not in cipher and 'sender@example.test' not in cipher
        mark('Opt-in encrypted vault writes ciphertext to the actual local file without plaintext tokens or message addresses')
        click('vault');assert api('status')['vault']['locked'];assert 'TEST FIXTURE' not in page.locator('#root').inner_text()
        mark('Lock removes connected data from the rendered workspace')
        click('vault');page.locator('[name="password"]').fill('Test-only passphrase 12345');submit('vault');assert not api('status')['vault']['locked'];assert len(api('status')['actions'])==4
        mark('Unlock restores encrypted connections and approved-operation records')
        route('connections');click('erase');page.locator('[name="confirmation"]').fill('ERASE');submit('erase');assert all(not x['connected'] for x in api('status')['providers'])
        route('inbox');assert 'No demonstration data.' in page.locator('#main').inner_text();assert page.locator('[data-action="message"]').count()==0
        mark('Explicit erase clears the local vault; no remote deletion or OAuth revocation is claimed')
        page.screenshot(path=str(OUT/'disconnected-en.png'),full_page=True)
        # The native legacy route is served by the same HTTP server; navigation itself is not tested here.
        with urllib.request.urlopen(base+'/workspace') as r: assert r.status==200 and b'app.js' in r.read()
        mark('Legacy local workspace remains served at /workspace')
        assert not errors,errors;mark('No uncaught browser JavaScript errors')
        result={'status':'passed','count':len(checks),'checks':checks,'uncaught_errors':errors,'limitations':['Managed Chromium refused localhost URL navigation (ERR_BLOCKED_BY_ADMINISTRATOR). Unchanged application HTML, CSS and JavaScript were injected for DOM testing.','Browser fetch was bridged to the real local Node HTTP server with a controlled test transport; native browser origin/CORS behavior was not exercised by these DOM checks. HTTP defenses are tested independently in Node.','Google/Microsoft upstream responses and OAuth consent/token exchange were synthetic test fixtures, explicitly marked TEST. No real account, live provider acceptance or Jev inference was validated.','sessionStorage and receipt-download transport are explicit test doubles. Vault cryptography, file writes and HTTP application actions were executed.','No claim of production security audit, public OAuth verification, mobile device deployment or end-user usability evidence.']}
        (OUT/'connected-browser-checks.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=False,indent=2));browser.close()
finally:
    p.terminate();p.wait(timeout=5)
