from playwright.sync_api import sync_playwright
from pathlib import Path
root=Path(__file__).resolve().parents[1]/'public'
html=(root/'index.html').read_text()
css='\n'.join((root/f).read_text() for f in ('styles.css','home-v060.css','polish-v062.css','attachments-v063.css'))
js=(root/'app.js').read_text().replace("if(!['https:','http:'].includes(location.protocol))throw new Error('当前从本地文件打开页面。要使用云端 AI，请将工程部署到 HTTPS 地址。');","if(false)throw Error('test');")
mock='''<script>
window.__requests=[];
window.fetch=async (url,options)=>{
 if(String(url)==='/api/status')return new Response(JSON.stringify({ready:true}),{status:200,headers:{'content-type':'application/json'}});
 if(String(url)==='/api/chat'){
  window.__requests.push({multipart:options.body instanceof FormData,filename:options.body instanceof FormData?options.body.get('file')?.name:null});
  return new Response(JSON.stringify({text:'请先查看文件中的事项说明，再核对吉林省官方办事指南。',actions:[{type:'guide',value:'pension',label:'查看养老指南'}],sources:[]}),{status:200,headers:{'content-type':'application/json'}});
 }
 throw Error('Unexpected URL');
};</script>'''
html=html.replace('<link rel="stylesheet" href="./styles.css" />','<style>'+css+'</style>')
html=html.replace('<script defer src="./app.js"></script>',mock+'<script>'+js+'</script>')
errors=[]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 for width in (320,390,430):
  page=browser.new_page(viewport={'width':width,'height':844},device_scale_factor=1)
  page.on('pageerror',lambda error:errors.append(str(error)))
  page.set_content(html,wait_until='load');page.wait_for_timeout(150)
  assert not page.evaluate('document.documentElement.scrollWidth>innerWidth'),width
  page.locator('.agent-question').click()
  assert page.locator('#chatFile').count()==1
  with page.expect_file_chooser() as chooser:
   page.get_by_role('button',name='添加图片或文件').click()
  chooser.value.set_files({'name':'政策截图.png','mimeType':'image/png','buffer':bytes.fromhex('89504e470d0a1a0a')})
  assert page.locator('.attachment-strip').is_visible()
  assert '政策截图.png' in page.locator('.attachment-strip').inner_text()
  if width==390:page.screenshot(path=str(root.parent/'attachment-selected-390.png'))
  page.locator('#chatInput').fill('这张图片讲了什么？')
  page.locator('.chat-form button.send').click()
  page.wait_for_timeout(350)
  assert not page.locator('.attachment-strip').is_visible()
  assert page.locator('.chat-attachment-label').is_visible()
  assert page.evaluate('window.__requests.at(-1).multipart')
  assert page.evaluate('window.__requests.at(-1).filename')=='政策截图.png'
  page.get_by_role('button',name='显示全文').click()
  assert page.get_by_text('请先查看文件中的事项说明',exact=False).count()>0
  if width==390:page.screenshot(path=str(root.parent/'attachment-response-390.png'))
  with page.expect_file_chooser() as chooser:
   page.get_by_role('button',name='添加图片或文件').click()
  chooser.value.set_files({'name':'办事指南.pdf','mimeType':'application/pdf','buffer':b'%PDF-1.4\n'})
  assert '办事指南.pdf' in page.locator('.attachment-strip').inner_text()
  page.get_by_role('button',name='移除附件').click()
  assert not page.locator('.attachment-strip').is_visible()
  page.close()
 browser.close()
assert not errors,errors
print('Mobile attachment flows: 320/390/430 widths, file chooser, multipart request, remove, reply: PASS')
