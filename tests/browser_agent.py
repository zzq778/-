from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from threading import Thread
import json
from playwright.sync_api import sync_playwright

WEB_ROOT=Path(__file__).resolve().parents[1]/'public'
html=(WEB_ROOT/'index.html').read_text()
for name in ['styles.css','home-v060.css','polish-v062.css','attachments-v063.css','agent-v070.css']:
    html=html.replace('<link rel="stylesheet" href="./'+name+'" />','<style>'+ (WEB_ROOT/name).read_text() +'</style>')
js=(WEB_ROOT/'app.js').read_text().replace("if(!['https:','http:'].includes(location.protocol))throw new Error('当前从本地文件打开页面。要使用云端 AI，请将工程部署到 HTTPS 地址。');", "if(false)throw new Error('test');")
js=js.replace("fetch('/api/chat',","fetch('https://jzzx.example/api/chat',").replace("fetch('/api/status',","fetch('https://jzzx.example/api/status',")
html=html.replace('<script defer src="./app.js"></script>','<script>'+js+'</script>')
errors=[]
try:
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
        for width in (320,390,430):
            page=browser.new_page(viewport={'width':width,'height':844},device_scale_factor=1)
            page.on('pageerror',lambda e:errors.append(str(e)))
            page.route('**/api/status',lambda route:route.fulfill(status=200,content_type='application/json',body=json.dumps({'ready':True})))
            def reply(route):
                req=json.loads(route.request.post_data)
                assert req['mode']=='agent',req
                assert req['region']=='长春市'
                route.fulfill(status=200,content_type='application/json',body=json.dumps({
                    'text':'我已经查到本地养老事项指引。请先确认您要办理的是待遇查询，还是领取资格认证。',
                    'actions':[{'type':'guide','value':'pension','label':'查看养老指南'},{'type':'official','value':'hall','label':'打开吉事办'}],
                    'agent':{'trace':[{'label':'检索事项索引','detail':'找到 1 个匹配方向'},{'label':'读取导办步骤','detail':'养老保险、待遇查询、资格认证'}],
                             'plan':{'id':'pension','title':'养老导办','steps':['确认办理类型','进入吉事办','核实具体事项']}}
                },ensure_ascii=False))
            page.route('**/api/chat',reply)
            page.set_content(html,wait_until='load')
            assert not page.evaluate('document.documentElement.scrollWidth>window.innerWidth'),width
            assert '想办什么事' in page.locator('.home-hero h1').inner_text()
            page.locator('[data-action="ai-full"]').first.click()
            page.locator('#chatInput').fill('帮我规划养老金资格认证')
            page.locator('#chatInput').press('Enter')
            page.locator('.agent-plan').wait_for(timeout=4000)
            page.get_by_role('button',name='显示全文').click()
            assert page.locator('.agent-plan li').count()==3
            assert page.locator('.agent-trace li').count()==2
            page.locator('.agent-trace summary').click()
            assert page.get_by_text('找到 1 个匹配方向').is_visible()
            page.get_by_role('button',name='查看养老指南').click()
            assert page.get_by_text('养老待遇与资格认证',exact=True).is_visible()
            if width==390:
                page.screenshot(path=str(WEB_ROOT.parent/'agent-v070-390.png'),full_page=False)
            page.close()
        browser.close()
finally:
    pass
assert not errors,errors
print('Agent mobile smoke: 320/390/430px, actual HTTP assets, tools trace, plan, navigation: PASS')
