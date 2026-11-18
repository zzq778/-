"""Exercise the actual Web product with same-origin assets and a mock consultation API."""
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]/'public'
server=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(root)))
Thread(target=server.serve_forever,daemon=True).start()
try:
    with sync_playwright() as p:
        browser=p.chromium.launch()
        for width in (320,390,430):
            page=browser.new_page(viewport={'width':width,'height':844},reduced_motion='reduce')
            page.set_default_timeout(8000)
            errors=[]
            page.on('pageerror',lambda e: errors.append(str(e)))
            page.route('**/api/status', lambda r:r.fulfill(json={'ready':True}))
            page.route('**/api/chat',lambda r:r.fulfill(json={'text':'请在吉事办核实养老金资格认证要求。','actions':[{'type':'guide','value':'pension','label':'查看养老指南'}],'agent':{'trace':[{'label':'检索事项索引','detail':'内部查询记录'}],'plan':{'id':'pension','title':'养老导办','steps':['确认办理类型','进入官方门户','查看事项']}}}))
            page.goto(f'http://127.0.0.1:{server.server_port}/')
            page.locator('#travelHome').wait_for()
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth+1')
            page.locator('[data-action=itinerary]').click()
            page.locator('[data-iti-action=prefs]').click()
            assert page.locator('#iti-prefs').is_visible()
            page.locator('[data-iti-action=prefs-cancel]').click()
            page.locator('[data-action=modal-close]').first.click()
            page.locator('[data-action=ai-full]').first.click()
            page.locator('#chatInput').fill('帮我办理养老金资格认证')
            page.locator('#chatInput').press('Enter')
            page.locator('.task-save').wait_for()
            assert page.locator('.agent-trace').count()==0
            page.locator('.task-save').click()
            page.locator('[data-action=ai-close]').first.click()
            page.locator('.saved-task').wait_for()
            page.locator('[data-action=task-open]').click()
            page.locator('.task-step').first.click()
            assert page.locator('.task-step.checked').count()==1
            page.locator('[data-action=modal-close]').first.click()
            page.locator('[data-action=roles]').first.click()
            page.locator('[data-role=merchant]').click()
            page.locator('#bottomNav [data-tab=news]').click()
            page.frame_locator('.portal-frame').locator('body').wait_for()
            assert '证件' in page.frame_locator('.portal-frame').locator('body').inner_text()
            page.locator('.wenlv-hub [data-action=roles]').click()
            page.locator('[data-role=government]').click()
            page.frame_locator('.portal-frame').locator('[data-tab=about]').click()
            assert '导出待办 CSV' in page.frame_locator('.portal-frame').locator('body').inner_text()
            assert not errors,errors
            page.close()
        browser.close()
finally:
    server.shutdown()
print('Web product: 320/390/430px, itinerary, consultation, saved task, role navigation PASS')
