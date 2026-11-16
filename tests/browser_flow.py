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
mock='''<script>window.fetch=async(url,options)=>{if(String(url)==='/api/status')return new Response(JSON.stringify({ready:true}),{status:200,headers:{'content-type':'application/json'}});if(String(url)==='/api/chat'){const q=JSON.parse(options.body).question;if(q==='测试思考动画')await new Promise(r=>setTimeout(r,1250));if(q==='测试服务错误')return new Response(JSON.stringify({message:'服务暂不可用'}),{status:503,headers:{'content-type':'application/json'}});return new Response(JSON.stringify({text:'可以先通过吉事办查询长春市的医保报销事项。\\n\\n1. 点击下方「打开吉事办」进入官方平台。\\n2. 在网站内搜索「医保报销」，核对适用地区和办事条件。\\n3. 进入具体事项，按官方指南准备材料。\\n\\n具体报销范围和比例，请以当地医保部门公布的信息为准。',actions:[{type:'guide',value:'medical',label:'查看医保指南'},{type:'official',value:'hall',label:'打开吉事办官方入口'}]}),{status:200,headers:{'content-type':'application/json'}})}throw new Error('Unexpected URL')};</script>'''
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
  assert '学生竞赛交互原型' not in page.locator('body').inner_text()
  page.locator('.floating-ai').click();page.wait_for_timeout(200)
  assert page.locator('.voice-capsule').is_visible()
  assert page.locator('.ai-overlay').evaluate('(x)=>getComputedStyle(x).backdropFilter')=='none'
  page.locator('.expand-ai').click();page.wait_for_timeout(200)
  assert page.locator('.ai-full-panel').is_visible()
  if width==390:
   page.locator('[data-prompt="医保报销去哪里查？"]').click()
   page.locator('.bubble.assistant.revealing').wait_for(timeout=1500)
   page.wait_for_timeout(400)
   body=page.locator('.bubble.assistant.revealing .bubble-copy').inner_text()
   assert 0<len(body)<len('可以先通过吉事办查询长春市的医保报销事项。\n\n1. 点击下方「打开吉事办」进入官方平台。\n2. 在网站内搜索「医保报销」，核对适用地区和办事条件。\n3. 进入具体事项，按官方指南准备材料。\n\n具体报销范围和比例，请以当地医保部门公布的信息为准。')
   assert page.get_by_role('button',name='显示全文').is_visible()
   page.screenshot(path=str(ROOT.parent/'ui-test-v053-typing.png'))
   page.get_by_role('button',name='显示全文').click()
   assert page.get_by_text('可以先通过吉事办查询长春市的医保报销事项。', exact=False).is_visible()
   assert page.get_by_role('button',name='查看医保指南').is_visible()
   assert not page.locator('.bubble.revealing').count()
   page.screenshot(path=str(ROOT.parent/'ui-test-v053-answer.png'))
   page.get_by_role('button',name='查看医保指南').click()
   assert page.get_by_text('医保服务与报销指引').is_visible()
   page.screenshot(path=str(ROOT.parent/'ui-test-v053-guide.png'))
   page.locator('[data-action="modal-close"]').click()
   page.locator('.floating-ai').click();page.locator('.expand-ai').click()
   page.locator('#chatInput').fill('测试服务错误');page.locator('#chatInput').press('Enter')
   page.wait_for_timeout(300)
   assert page.get_by_text('服务暂不可用').is_visible()
   assert page.get_by_text('服务暂不可用',exact=True).is_visible()
   page.locator('#chatInput').fill('测试思考动画');page.locator('#chatInput').press('Enter')
   assert page.locator('.thinking-panel').is_visible()
   assert '正在思考' in page.locator('.thinking-panel').inner_text()
   assert page.locator('.ai-full-panel').count()==1
   page.wait_for_timeout(570)
   page.screenshot(path=str(ROOT.parent/'ui-test-v054-thinking.png'))
   page.wait_for_timeout(1100)
   assert not page.locator('.thinking-panel').count()
   assert page.locator('.bubble.assistant').count()>=1
   page.locator('[data-action="ai-close"]').click()
   assert not page.locator('.ai-overlay').count()
  page.close()
 # Reduced-motion users receive full content without reveal animation.
 page=browser.new_page(viewport={'width':390,'height':844},reduced_motion='reduce')
 page.on('pageerror',lambda error:errors.append(str(error)))
 page.set_content(html,wait_until='load')
 page.locator('.floating-ai').click();page.locator('.expand-ai').click()
 page.locator('[data-prompt="医保报销去哪里查？"]').click()
 page.get_by_role('button',name='查看医保指南').wait_for(timeout=2500)
 assert not page.locator('.bubble.revealing').count()
 page.close()
 browser.close()
assert not errors,errors
print('UI mock integration: 3 widths, progressive reveal, skip, routing, errors, reduced motion: PASS')
