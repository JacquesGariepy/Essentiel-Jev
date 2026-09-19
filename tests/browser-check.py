"""Offline Chromium DOM checks. No network navigation.
Storage and download transport are explicit test doubles. Native crypto is unit-tested
in Node; this opaque browser context cannot validate localhost Web Crypto or OS imports.
"""
import json, os
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs'/'validation';OUT.mkdir(parents=True,exist_ok=True)
checks=[]; errors=[]
def mark(s): checks.append(s)
def html(lang='fr',stored=None):
    source=(ROOT/f'preview-{lang}.html').read_text()
    shim='''<script>
window.__storage=STORED; window.__downloads=[];
Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>window.__storage[k]??null,setItem:(k,v)=>{window.__storage[k]=String(v)},removeItem:k=>{delete window.__storage[k]}}});
URL.createObjectURL=blob=>{window.__downloads.push(blob);return 'blob:local-test-only'};URL.revokeObjectURL=()=>{};
HTMLAnchorElement.prototype.click=function(){};
</script>'''.replace('STORED',json.dumps(stored or {}).replace('</','<\\/'))
    return source.replace('<head>','<head>'+shim,1)
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1)
    page.set_default_timeout(5000);page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content(html(),wait_until='load');page.wait_for_selector('h1')
    def route(name):
        if page.locator('#modal').is_visible():page.locator('[data-action="close-modal"]').click()
        if page.viewport_size['width']<900:page.locator('button[data-action="menu"]').click()
        page.locator(f'.sidebar button[data-route="{name}"]').click()
    def click(action,scope=None): (scope or page).locator(f'[data-action="{action}"]').first.click()
    def submit(form): page.locator(f'#{form} [type="submit"]').click()
    def state(): return page.evaluate("JSON.parse(window.__storage['essentiel.workspace.v2']).workspace")
    def close():
        if page.locator('#modal').is_visible():click('close-modal')
    def last_download(): return page.evaluate('async()=>await window.__downloads.at(-1).text()')
    assert page.locator('.task-row').count()>0
    assert 'EXEMPLES FICTIFS' in page.locator('.demo-notice').inner_text()
    assert not page.evaluate('Object.keys(window.__storage).length')
    mark('Preview is explicitly synthetic; persistence starts off')
    page.screenshot(path=str(OUT/'desktop-fr.png'),full_page=True)
    for r in ['inbox','planner','spaces','money','lists','decisions','notebook','lab','settings']:
        route(r);assert page.locator('h1').count()==1
    mark('All ten navigation views render')
    page.locator('#persistToggle').check();assert len(state()['tasks'])==8
    mark('Opt-in persistence writes the workspace only after the user enables it')
    route('planner');click('new-task');page.locator('#title').fill('Browser recurring task');page.locator('#due').fill('2026-09-20');page.locator('#repeat').select_option('daily');page.locator('#checklist').fill('[ ] Verify output');submit('taskForm')
    task=next(t for t in state()['tasks'] if t['title']=='Browser recurring task');tid=task['id']
    assert task['repeat']=='daily' and task['checklist'][0]['done']==False
    mark('Task editor creates dated recurring tasks with explicit checklists')
    row=page.locator(f'[data-task="{tid}"]');click('task-toggle',row)
    assert next(t for t in state()['tasks'] if t['id']==tid)['status']=='open'
    mark('Unchecked checklist blocks completion, with no lost mutation')
    click('edit-task',row);page.locator('#checklist').fill('[x] Verify output');submit('taskForm');click('task-toggle',page.locator(f'[data-task="{tid}"]'))
    assert next(t for t in state()['tasks'] if t['id']==tid)['status']=='done'
    child=next(t for t in state()['tasks'] if t['recurrenceOf']==tid);assert child['due']=='2026-09-21'
    mark('Manual completion creates exactly one recurring successor')
    click('new-task');page.locator('#title').fill('Browser dependent');page.locator('[name="blockedBy"]').select_option(child['id']);submit('taskForm')
    dep=next(t for t in state()['tasks'] if t['title']=='Browser dependent');click('task-toggle',page.locator(f'[data-task="{dep["id"]}"]'));assert next(t for t in state()['tasks'] if t['id']==dep['id'])['status']=='open'
    mark('Unfinished dependencies block UI completion')
    click('plan-dialog');page.locator('#minutes').fill('60');page.locator('#reserve').fill('20');submit('planForm');assert state()['plan']['used']<=48;click('plan-dialog');close()
    mark('Planner respects the explicitly entered capacity and reserve')
    click('focus-start',page.locator(f'[data-task="{child["id"]}"]'));assert state()['focus']['taskId']==child['id'];click('focus-pause');assert state()['focus']['paused'];click('focus-stop');assert state()['focus'] is None
    mark('Focus timer starts, pauses and stops without completing tasks')
    route('spaces');page.locator('[data-action="open-space"][data-id="money"]').click();assert page.locator('.workflow-card').count()==4
    before=len(state()['tasks']);click('use-workflow');submit('workflowForm');assert len(state()['tasks'])==before+4;assert all(t['due']=='' for t in state()['tasks'][-4:])
    mark('Workflow activation creates four editable tasks without inventing dates')
    click('spaces-all');click('choose-spaces');page.locator('#profile').select_option('student');submit('spacesForm');assert len(state()['enabledDomains'])>0 and page.locator('.space-card').count()<28
    mark('Domain profiles filter optional spaces without deleting their data')
    route('planner');page.locator('[data-action="planner-tab"][data-tab="routines"]').click();click('new-routine');page.locator('#title').fill('Browser routine');submit('routineForm');r=next(r for r in state()['routines'] if r['title']=='Browser routine');page.locator(f'[data-action="routine-check"][data-id="{r["id"]}"]').first.click();assert next(x for x in state()['routines'] if x['id']==r['id'])['checks']
    mark('Routine editor and explicit completion history work')
    route('money');click('new-transaction');page.locator('#title').fill('Browser expense');page.locator('#amount').fill('12.10');submit('moneyForm');assert next(t for t in state()['transactions'] if t['title']=='Browser expense')['amountMinor']==1210
    click('budget-dialog');page.locator('#amount').fill('1.00');submit('budgetForm');assert state()['budgets'][-1]['amountMinor']==100
    mark('Money entry uses minor units; budget overrun remains a visible local warning')
    page.locator('[data-action="money-tab"][data-tab="subscriptions"]').click();click('new-subscription');page.locator('#title').fill('Browser subscription');page.locator('#amount').fill('120');page.locator('#cadence').select_option('yearly');submit('moneyForm');assert state()['subscriptions'][-1]['cadence']=='yearly'
    page.locator('[data-action="money-tab"][data-tab="savings"]').click();click('new-saving');page.locator('#title').fill('Browser savings');page.locator('#target').fill('1000');page.locator('#saved').fill('100');page.locator('#monthly').fill('100');submit('moneyForm');assert state()['savings'][-1]['targetMinor']==100000
    mark('Subscription and savings forms persist their actual entered values')
    route('lists');click('new-list');page.locator('#title').fill('Browser meal');page.locator('#kind').select_option('meal');page.locator('#ingredients').fill('Carrots\nRice');submit('listForm');page.locator('[data-action="list-kind"][data-kind="meal"]').click();meal=next(x for x in state()['lists'] if x['title']=='Browser meal');before=len(state()['lists']);page.locator(f'[data-action="meal-shopping"][data-id="{meal["id"]}"]').click();click('confirm-action');assert len(state()['lists'])==before+2
    mark('Meal ingredients become explicit shopping entries after confirmation')
    route('notebook');click('new-note');page.locator('#title').fill('Browser document index');page.locator('#kind').select_option('document');page.locator('#location').fill('Local filing cabinet');page.locator('#body').fill('<img src=x onerror="window.bad=1">');submit('noteForm');assert page.evaluate('window.bad') is None and page.locator('img').count()==0
    mark('Notebook persists document locations and renders embedded markup as inert text')
    route('inbox');click('export-sources');exported_sources=json.loads(last_download());assert all(x['synthetic'] is True for x in exported_sources['records']);assert all('answers' not in x for x in exported_sources['records'])
    page.locator('[data-action="view-source"][data-id="demo-school"]').first.click();quote=page.locator('blockquote').inner_text();assert quote in page.locator('.source-text').inner_text();page.locator('#confirmedDate').fill('2026-10-05');page.locator('#bucket').select_option('archived');submit('sourceReviewForm');page.locator('[data-action="view-source"][data-id="demo-school"]').first.click();click('source-calendar');ics=last_download();assert 'DTSTART;VALUE=DATE:20261005' in ics and 'DTEND;VALUE=DATE:20261006' in ics
    mark('Verbatim evidence, human-only filing and confirmed-date ICS export work')
    click('source-task');assert page.locator('#due').input_value()=='2026-10-05';submit('taskForm');assert state()['tasks'][-1]['sourceId']=='demo-school'
    mark('Linked task uses the human-confirmed date, not an unapproved prediction')
    click('new-source');page.locator('#title').fill('Browser source');page.locator('#text').fill('Please reply tomorrow. <script>window.bad=1</script>');submit('sourceForm');src=state()['records'][-1];assert src['mode']=='pending' and src['bucket']=='pending';assert page.evaluate('window.bad') is None
    mark('New source stays unanalysed; no heuristic output masquerades as Jev')
    source_count=len(state()['records']);click('new-source')
    batch=[{'title':'Browser imported source','text':'Please send the signed form on 2026-10-07.','mode':'live','bucket':'act','confirmedDate':'2026-10-07'}, {'title':'Duplicate','text':'Please send the signed form on 2026-10-07.'}]
    page.locator('#sourceFile').set_input_files({'name':'sources.json','mimeType':'application/json','buffer':json.dumps(batch).encode()});page.wait_for_selector('[data-action="confirm-action"]');click('confirm-action')
    assert len(state()['records'])==source_count+1 and state()['records'][-1]['mode']=='pending' and state()['records'][-1]['confirmedDate'] is None
    mark('Legacy JSON source batches remain usable; exact duplicates skip and imported AI approvals are invalidated')
    route('decisions');click('new-decision');page.locator('#title').fill('Browser decision');page.locator('#cn0').fill('Comfort');page.locator('#on0').fill('Option A');page.locator('#on1').fill('Option B');page.locator('#og0').select_option('yes');page.locator('#og1').select_option('yes');page.locator('#s0_0').fill('3');page.locator('#s1_0').fill('4');submit('decisionForm');d=state()['decisions'][-1];assert d['selectedId']=='' and len(d['options'])==2
    page.locator(f'[data-action="view-decision"][data-id="{d["id"]}"]').click();page.locator('#selectedId').select_option(d['options'][0]['id']);submit('decisionChoiceForm');assert state()['decisions'][-1]['selectedId']==d['options'][0]['id']
    mark('Decision matrix preserves manual scores and only records an explicit human choice')
    route('lab');click('lab-fixture');assert state()['runs'][-1]['mode']=='fixture';assert set(a['type'] for a in state()['runs'][-1]['answers'].values())=={'choice','score','noul'};assert 'confidence' not in state()['runs'][-1]['answers']['sensitive']
    page.locator('#label_sensitive').select_option('true');submit('outcomeForm');assert '"n": 0' in page.locator('.code.compact').inner_text()
    mark('All three primitives render; synthetic observations are excluded from calibration metrics')
    click('view-run');click('run-next');assert 'previous_assessment' in page.locator('#labState').input_value();assert 'ready_for_review' in page.locator('#labQuestions').input_value()
    mark('Dependent judgments require a separate editable next-step request')
    submit('labForm');assert page.locator('.transmission').is_visible();click('execute-lab');assert 'Consentement' in page.locator('#modalError').inner_text();page.locator('#sendConsent').check();click('execute-lab');assert 'aperçu autonome' in page.locator('#modalError').inner_text();close()
    mark('Sending requires explicit consent; standalone preview never makes live calls')
    click('global-search');page.locator('#globalQuery').fill('Browser');assert page.locator('#globalResults .record-row').count()>5;close()
    mark('Global search finds user-created objects locally')
    route('settings');click('backup-json');click('confirm-action');saved=json.loads(last_download());assert saved['schemaVersion']==2 and len(saved['tasks'])==len(state()['tasks'])
    mark('Whole-workspace JSON export contains the entered data (download transport mocked)')
    spoof=dict(saved);spoof['records']=[dict(src,mode='live',bucket='act',confirmedDate='2026-12-01')]
    click('import-workspace');page.locator('#backupFile').set_input_files({'name':'import.json','mimeType':'application/json','buffer':json.dumps(spoof).encode()});submit('importForm');click('confirm-action');assert state()['records'][0]['mode']=='pending' and state()['records'][0]['confirmedDate'] is None
    mark('Backup import invalidates embedded source classifications and date approvals')
    click('undo');assert len(state()['records'])==len(saved['records'])
    mark('Undo restores the previous validated workspace')
    stored=page.evaluate('window.__storage');page.set_content(html(stored=stored),wait_until='load');page.wait_for_selector('h1');assert len(state()['tasks'])==len(saved['tasks'])
    mark('Opt-in save/restore round-trip preserves manual work (storage transport mocked)')
    route('spaces');page.locator('#localSearch').fill('zzzznone');assert page.locator('.space-card').count()==0;page.locator('#localSearch').fill('')
    mark('Empty search results do not display unrelated spaces')
    page.set_viewport_size({'width':390,'height':844});route('today');page.screenshot(path=str(OUT/'mobile-fr.png'),full_page=True);assert page.evaluate('document.documentElement.scrollWidth')<=390
    mark('390px mobile view fits without horizontal page overflow')
    page.set_viewport_size({'width':1440,'height':1000});click('language');assert page.locator('html').get_attribute('lang')=='en';click('theme');assert page.locator('html').get_attribute('data-theme')=='dark';page.screenshot(path=str(OUT/'desktop-dark-en.png'),full_page=True)
    mark('Language and theme switches preserve the workspace')
    page.set_content(html('en'),wait_until='load');page.wait_for_selector('h1');assert 'A place for' in page.locator('h1').inner_text();route('spaces');assert page.locator('.space-card').count()==28;page.screenshot(path=str(OUT/'spaces-en.png'),full_page=True)
    mark('English preview includes English sample data and all 28 domains')
    assert not errors,errors
    mark('No uncaught browser JavaScript errors across all checks')
    result={'status':'passed','checks':checks,'count':len(checks),'uncaught_errors':errors,'limitations':['Browser content injected offline; managed Chromium blocked URL navigation.','localStorage and download transport are test doubles.','HTTP contracts validated separately by real local Node HTTP tests with mock upstream provider.','No paid Jev inference, production deployment, real provider accuracy or OS calendar-import validation.','Encryption cryptography verified with Node Web Crypto, not opaque-origin browser crypto.']}
    (OUT/'browser-checks.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
    print(json.dumps(result,ensure_ascii=False,indent=2));browser.close()
