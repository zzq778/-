from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]/'public'
html=(ROOT/'index.html').read_text()
css=(ROOT/'styles.css').read_text()
js=(ROOT/'app.js').read_text()
policy_js=(ROOT/'policies.js').read_text()
# Browser-only test harness: about:blank cannot represent a deployed HTTPS origin.
# Bypass exactly the protocol guard in the in-memory test copy, retain production file unchanged.
js=js.replace("if(!['https:','http:'].includes(location.protocol))throw new Error('当前从本地文件打开页面。要使用云端 AI，请将工程部署到 HTTPS 地址。');", "if(false)throw new Error('test');")
mock='''<script>window.fetch=async(url,options)=>{if(String(url)==='/api/status')return new Response(JSON.stringify({ready:true}),{status:200,headers:{'content-type':'application/json'}});if(String(url)==='/api/chat'){const q=JSON.parse(options.body).question;if(q==='测试服务错误')return new Response(JSON.stringify({message:'服务暂不可用'}),{status:503,headers:{'content-type':'application/json'}});return new Response(JSON.stringify({text:'医保服务说明：请到吉事办核对具体业务与办事材料。',actions:[{type:'guide',value:'medical',label:'查看医保指南'},{type:'official',value:'hall',label:'打开吉事办官方入口'}]}),{status:200,headers:{'content-type':'application/json'}})}throw new Error('Unexpected URL')};</script>'''
html=html.replace('<link rel="stylesheet" href="./styles.css" />','<style>'+css+'</style>')
html=html.replace('<script defer src="./policies.js"></script>','<script>'+policy_js+'</script>')
html=html.replace('<script defer src="./app.js"></script>',mock+'<script>'+js+'</script>')
errors=[]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 for width in (320,390,430):
  page=browser.new_page(viewport={'width':width,'height':844},device_scale_factor=1)
  page.on('pageerror',lambda error:errors.append(str(error)))
  page.set_content(html,wait_until='load');page.wait_for_timeout(150)
  assert not page.evaluate('document.documentElement.scrollWidth>innerWidth'),width
  page.locator('.floating-ai').click();page.wait_for_timeout(200)
  assert page.locator('.voice-capsule').is_visible()
  assert page.locator('.ai-overlay').evaluate('(x)=>getComputedStyle(x).backdropFilter')=='none'
  page.locator('.expand-ai').click();page.wait_for_timeout(200)
  assert page.locator('.ai-full-panel').is_visible()
  if width==390:
   page.locator('[data-prompt="医保报销去哪里查？"]').click()
   page.wait_for_timeout(300)
   assert page.get_by_text('医保服务说明').is_visible()
   assert page.get_by_role('button',name='查看医保指南').is_visible()
   page.get_by_role('button',name='查看医保指南').click()
   assert page.get_by_text('医保服务与报销指引').is_visible()
   page.screenshot(path=str(ROOT.parent/'ui-test-v05.png'))
   page.locator('[data-action="modal-close"]').click()
   page.locator('.floating-ai').click();page.locator('.expand-ai').click()
   page.locator('#chatInput').fill('测试服务错误');page.locator('#chatInput').press('Enter')
   page.wait_for_timeout(300)
   assert page.get_by_text('服务暂不可用').is_visible()
   assert page.get_by_text('服务状态提示 · 未生成 AI 回答').is_visible()
   page.locator('[data-action="ai-close"]').click()
   page.wait_for_timeout(150)
   # 政策解读：政务服务 → 政策解读 → 列表 → 详情，逐条都应有官方原文入口
   page.locator('[data-tab="services"]').click()
   page.locator('[data-filter="policy"]').click()
   page.locator('[data-guide="policy"]').click()
   page.wait_for_timeout(200)
   rows=page.locator('[data-policy]')
   assert rows.count()>=5, rows.count()
   rows.first.click()
   page.wait_for_timeout(200)
   assert page.get_by_text('一句话读懂').is_visible()
   assert page.get_by_text('容易误解的点').is_visible()
   assert page.locator('[data-policy-url]').first.get_attribute('data-policy-url').startswith('https://xxgk.jl.gov.cn/')
   page.locator('[data-action="policy-back"]').click()
   page.wait_for_timeout(150)
   assert page.locator('[data-policy]').count()==rows.count()
  page.close()
 browser.close()
assert not errors,errors
print('UI mock integration: 3 widths, AI output, guide routing, errors: PASS')
