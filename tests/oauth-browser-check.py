"""Real Chromium navigation, cookies and Fetch Metadata against local HTTP.
The Google authorization response is intercepted; token/profile/API calls use
synthetic transports in oauth-browser-server.mjs. No Google account is contacted.
"""
import json, os, subprocess
from pathlib import Path
from urllib.parse import urlparse, parse_qs, urlencode
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs'/'validation-v0.3.1';OUT.mkdir(parents=True,exist_ok=True)
checks=[]
p=subprocess.Popen(['node',str(ROOT/'tests/oauth-browser-server.mjs')],cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
try:
    line=p.stdout.readline()
    if not line:raise RuntimeError('Test server did not start')
    origins=json.loads(line)
    with sync_playwright() as pw:
        browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
        for mode in ['web','desktop']:
            context=browser.new_context(viewport={'width':1320,'height':1000})
            page=context.new_page();page.set_default_timeout(15000)
            def authorize(route):
                qs=parse_qs(urlparse(route.request.url).query)
                callback=qs['redirect_uri'][0]+'?'+urlencode({'state':qs['state'][0],'code':'SYNTHETIC-BROWSER-CODE'})
                route.fulfill(status=302,headers={'Location':callback,'Cache-Control':'no-store'},body='')
            context.route('https://accounts.google.com/**',authorize)
            r=page.goto(origins[mode]+'/?lang=fr#connections',wait_until='networkidle')
            assert r.status==200,(mode,r.status,page.content()[:600])
            form=page.locator('form[data-form="connect"][data-provider="google"]')
            form.locator('button[type="submit"]').click()
            page.wait_for_function("document.querySelector('form[data-provider=google] [data-action=disconnect]') !== null")
            page.wait_for_function("!document.body.classList.contains('busy')")
            assert 'google@example.test' in page.locator('#main').inner_text()
            assert page.url.startswith(origins[mode]+'/'),page.url
            assert 'Requête intersite refusée' not in page.locator('body').inner_text()
            assert not any('essentiel_oauth_google'==c['name'] for c in context.cookies())
            checks.append({'mode':mode,'flow':'real local HTML -> protected POST -> intercepted Google 302 -> local callback -> original HTML','passed':True,'realGoogleAccount':False})
            page.screenshot(path=str(OUT/f'oauth-{mode}-synthetic.png'),full_page=True)
            # An invalid callback must still show the usable error page.
            page.goto(origins[mode]+'/oauth/google/callback?state=forged&code=SYNTHETIC',wait_until='networkidle')
            assert 'OAUTH_STATE_INVALID' in page.locator('body').inner_text()
            checks.append({'mode':mode,'flow':'invalid OAuth state -> readable local error','passed':True})
            context.close()
        browser.close()
    print(json.dumps({'checks':checks,'passed':len(checks),'realGoogleAccount':False},indent=2))
    (OUT/'oauth-browser-checks.json').write_text(json.dumps({'checks':checks,'passed':len(checks),'realGoogleAccount':False},indent=2))
finally:
    p.terminate()
    try:out,err=p.communicate(timeout=10)
    except subprocess.TimeoutExpired:p.kill();out,err=p.communicate()
    (OUT/'oauth-browser-headers.jsonl').write_text(err)
