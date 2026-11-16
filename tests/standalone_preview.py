from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
html=(root.parent/'吉政知行_v0.6.3_手机附件体验.html').read_text()
errors=[]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1)
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html,wait_until='load');page.wait_for_timeout(300)
 assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
 page.locator('.agent-question').click()
 with page.expect_file_chooser() as chooser:page.get_by_role('button',name='添加图片或文件').click()
 chooser.value.set_files({'name':'政策截图.png','mimeType':'image/png','buffer':bytes.fromhex('89504e470d0a1a0a')})
 assert page.locator('.attachment-strip').is_visible()
 page.screenshot(path=str(root.parent/'吉政知行_v0.6.3_附件界面预览.png'))
 page.get_by_role('button',name='移除附件').click()
 assert not page.locator('.attachment-strip').is_visible()
 page.close();browser.close()
assert not errors,errors
print('Standalone preview and attachment state: PASS')
