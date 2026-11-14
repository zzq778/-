"""Chromium checks for the local guide workflow; storage API emulated because loopback is blocked."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
WEB=ROOT/'public'
html=(WEB/'index.html').read_text()
for name in ['styles.css','home-v060.css','polish-v062.css','attachments-v063.css','agent-v070.css']:
    html=html.replace('<link rel="stylesheet" href="./'+name+'" />','<style>'+(WEB/name).read_text()+'</style>')
js=(WEB/'app.js').read_text().replace("fetch('/api/chat',","fetch('https://jzzx.example/api/chat',").replace("fetch('/api/status',","fetch('https://jzzx.example/api/status',")
js=js.replace("if(!['https:','http:'].includes(location.protocol))throw new Error('当前从本地文件打开页面。要使用云端 AI，请将工程部署到 HTTPS 地址。');", "if(false)throw new Error('test');")
html=html.replace('<script defer src="./app.js"></script>','<script>'+js+'</script>')
errors=[]
requests=[]

def build_page(browser,width,values):
    page=browser.new_page(viewport={'width':width,'height':844},device_scale_factor=1)
    page.set_default_timeout(5000)
    page.set_default_timeout(5000)
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('dialog',lambda d:d.accept())
    page.route('**/api/status',lambda r:r.fulfill(status=200,content_type='application/json',body=json.dumps({'ready':True})))
    def answer(route):
        request=json.loads(route.request.post_data)
        requests.append(request)
        route.fulfill(status=200,content_type='application/json',body=json.dumps({
            'text':'请查看本地养老导办清单，并在官方入口核对具体受理要求。',
            'actions':[{'type':'guide','value':'pension','label':'查看养老指南'}],
            'agent':{'trace':[{'label':'检索事项索引','detail':'匹配养老方向'}],
                     'plan':{'id':'pension','title':'养老导办','steps':['确认办理类型','进入官方门户','查找对应事项']}}
        },ensure_ascii=False))
    page.route('**/api/chat',answer)
    page.evaluate('''data=>{
      window.__fakeStorage=JSON.parse(JSON.stringify(data));
      Object.defineProperty(window,'localStorage',{configurable:true,value:{
        getItem:k=>Object.hasOwn(window.__fakeStorage,k)?window.__fakeStorage[k]:null,
        setItem:(k,v)=>{window.__fakeStorage[k]=String(v)},
        removeItem:k=>{delete window.__fakeStorage[k]}
      }});
    }''',values)
    page.set_content(html,wait_until='load')
    return page

with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
    for width in [320,390,430]:
        page=build_page(browser,width,{})
        assert page.locator('.saved-task').count()==0
        page.locator('[data-action="ai-full"]').first.click()
        page.locator('#chatInput').fill('帮我规划养老金资格认证')
        page.locator('#chatInput').press('Enter')
        page.locator('.task-save').wait_for(timeout=6000)
        page.locator('.task-save').click()
        assert page.locator('.saved-task').count()==1
        store=page.evaluate('window.__fakeStorage')
        assert '"id":"pension"' in store['jzzx-saved-guide-v1']
        assert '帮我规划养老金资格认证' not in store['jzzx-saved-guide-v1']
        page.locator('[data-action="ai-close"]').first.click()
        page.locator('[data-action="task-open"]').first.click()
        page.locator('.task-step').first.click()
        assert page.locator('.task-step.checked').count()==1
        store=page.evaluate('window.__fakeStorage')
        page.close()
        page=build_page(browser,width,store)
        assert page.locator('.saved-task').count()==1
        assert '1 / 3' in page.locator('.saved-task').inner_text()
        page.locator('[data-action="task-open"]').first.click()
        page.locator('[data-action="task-ask"]').first.click()
        assert '已标记了解 1 步' in page.locator('#chatInput').input_value()
        page.locator('#chatInput').press('Enter')
        page.locator('.agent-plan').wait_for(timeout=6000)
        assert requests[-1]['context']['task']=={'id':'pension','understood':1}
        page.locator('[data-action="ai-close"]').first.click()
        if width==390:
            page.evaluate("window.scrollTo({top:Math.max(0,document.querySelector('.saved-task').offsetTop-170),behavior:'instant'})")
            page.wait_for_timeout(250)
            page.screenshot(path=str(ROOT/'v071-home-390.png'))
            page.locator('[data-action="task-open"]').first.click()
            page.locator('.sheet').wait_for(state='visible')
            page.wait_for_timeout(420)
            page.screenshot(path=str(ROOT/'v071-task-390.png'))
            page.locator('[data-action="modal-close"]').first.click()
        page.locator('[data-action="regions"]').first.click()
        page.locator('[data-region="吉林市"]').click()
        assert '重新核对' in page.locator('.saved-task').inner_text()
        page.locator('[data-action="task-open"]').first.click()
        assert page.locator('.task-region-alert').count()==1
        page.locator('[data-action="task-delete"]').click()
        assert page.locator('.saved-task').count()==0
        assert page.evaluate('localStorage.getItem("jzzx-saved-guide-v1")') is None
        assert page.evaluate('document.documentElement.scrollWidth<=window.innerWidth'),width
        page.close()
    browser.close()
assert not errors,errors
print('Saved task browser simulation PASS: 320/390/430px, save, restore, step, Agent context, region mismatch, deletion')
