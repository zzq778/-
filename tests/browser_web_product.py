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
            page.add_init_script("""Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>({getTracks:()=>[{stop(){}}]})}});window.AudioContext=undefined;window.webkitAudioContext=undefined;window.SpeechRecognition=class{start(){window.testRecognition=this;this.onstart?.()}abort(){}};""")
            page.goto(f'http://127.0.0.1:{server.server_port}/')
            page.locator('#travelHome').wait_for()
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth+1')
            page.locator('[data-action=itinerary]').click()
            page.locator('[data-iti-action=prefs]').click()
            assert page.locator('#iti-prefs').is_visible()
            page.locator('[data-iti-action=prefs-cancel]').click()
            page.locator('[data-action=modal-close]').first.click()
            page.locator('[data-action=ai-full]').first.click()
            page.locator('#chatInput').fill('帮我办理')
            page.locator('#chatForm [data-action=voice]').click()
            page.wait_for_function('!!window.testRecognition')
            assert page.locator('#chatForm [data-action=voice]').get_attribute('aria-pressed')=='true'
            page.evaluate("testRecognition.onresult({results:[Object.assign([{transcript:'养老金资格认证'}],{isFinal:true})]})")
            assert page.locator('#chatInput').input_value()=='帮我办理 养老金资格认证'
            assert page.locator('#chatForm [data-action=voice]').get_attribute('aria-pressed')=='false'
            assert page.locator('.chat-stream .bubble').count()==0
            assert '核对' in page.locator('#fullVoiceMessage').inner_text() or '检查' in page.locator('#fullVoiceMessage').inner_text()
            page.locator('#chatInput').fill('帮我办理养老金资格认证')
            # Observably pending until the HTTP result is released; reduced-motion is honored.
            held=[]
            def hold(route): held.append(route)
            page.route('**/api/chat',hold)
            page.locator('#chatInput').press('Enter')
            wait=page.locator('.thinking-panel.jzzx-thinking');wait.wait_for()
            assert wait.locator('.jzzx-thinking-label').inner_text()=='正在思考'
            assert wait.locator('.orbit-ring').evaluate('e=>getComputedStyle(e).animationName')=='none'
            page.wait_for_timeout(100)
            assert held
            held.pop().fulfill(json={'text':'请在吉事办核实养老金资格认证要求。','actions':[{'type':'guide','value':'pension','label':'查看养老指南'}],'agent':{'plan':{'id':'pension','title':'养老导办','steps':['确认办理类型','进入官方门户','查看事项']}}})
            page.unroute('**/api/chat',hold)
            page.locator('.task-save').wait_for()
            assert wait.count()==0
            assert page.locator('.agent-trace').count()==0
            page.locator('.task-save').click()
            page.locator('[data-action=ai-close]').first.click()
            page.locator('.saved-task').wait_for()
            page.locator('[data-action=ai-full]').first.click()
            page.locator('#chatInput').fill('帮我安排吉林市一天')
            page.route('**/api/chat',lambda r:r.fulfill(json={'text':'可以先去雾凇岛。','itinerary':{'days':1,'plan':[{'day':1,'nodes':[{'attractionId':'wusongdao','slot':'上午'}]}]},'sources':[{'label':'吉林文旅','url':'http://lyj.jlcity.gov.cn/'}]}))
            page.locator('#chatInput').press('Enter')
            page.locator('[data-open-chat-trip]').click()
            assert '雾凇岛' in page.locator('#travelResult').inner_text()
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
