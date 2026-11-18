"""Real same-origin browser test of the restored mobile workspaces."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from subprocess import run
from playwright.sync_api import sync_playwright
repo = Path(__file__).resolve().parents[1]
run(['node', str(repo / 'scripts/build-mobile-workspaces.mjs')], check=True)
root = repo / 'mobile/site'
server = ThreadingHTTPServer(('127.0.0.1', 0), partial(SimpleHTTPRequestHandler, directory=str(root)))
Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={'width': 390, 'height': 844})
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(f'http://127.0.0.1:{server.server_port}/')
        page.locator('[data-tab=portal]').click()
        page.locator('[data-tab=workspaces]').click()
        frame = page.frame_locator('.workspace-frame')
        frame.locator('[data-tab=feedback]').click()
        frame.locator('#fbText').fill('停车引导需要改善')
        frame.locator('#feedbackForm button[type=submit]').click()
        assert '停车引导需要改善' in frame.locator('body').inner_text()
        page.locator('[data-workspace=government]').click()
        frame.locator('form[data-reply=feedback]').first.wait_for()
        assert '停车引导需要改善' in frame.locator('body').inner_text()
        reply = frame.locator('form[data-reply=feedback]').first
        reply.locator('input,textarea').first.fill('已记录，将核对停车指引。')
        reply.locator('button[type=submit]').click()
        page.locator('[data-workspace=tourist]').click()
        frame.locator('[data-tab=feedback]').click()
        assert '已记录，将核对停车指引。' in frame.locator('body').inner_text()
        page.locator('[data-workspace=merchant]').click()
        submission = frame.locator('[data-doc][data-status=submitted]').first
        doc_id = submission.get_attribute('data-doc')
        submission.click()
        page.locator('[data-workspace=government]').click()
        frame.locator('[data-tab=docs]').click()
        frame.locator(f'[data-doc="{doc_id}"][data-status=approved]:not([disabled])').click()
        page.locator('[data-workspace=merchant]').click()
        assert frame.locator(f'[data-doc="{doc_id}"][data-status=submitted]').count() == 0
        assert '已通过' in frame.locator('body').inner_text() or '审核通过' in frame.locator('body').inner_text()
        page.locator('[data-workspace=government]').click()
        frame.locator('[data-tab=about]').click()
        assert '导出待办 CSV' in frame.locator('body').inner_text()
        assert '接入契约' not in frame.locator('body').inner_text()
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth+1')
        page.locator('[data-tab=explore]').click()
        page.locator('[data-workspace=itinerary]').click()
        frame.locator('[data-iti-action=prefs]').click()
        assert frame.locator('#iti-prefs').is_visible()
        frame.locator('[data-iti-action=prefs-cancel]').click()
        assert frame.locator('[data-iti-action=export]').is_visible()
        assert page.locator('.bottom [data-tab=explore]').get_attribute('aria-current') == 'page'
        page.locator('.workspace-page .back-link').click()
        assert page.locator('[data-workspace=itinerary]').is_visible()
        page.locator('[data-tab=portal]').click()
        page.locator('[data-tab=workspaces]').click()
        assert frame.locator('[data-tab=docs]').is_visible()
        page.locator('[data-tab=me]').click()
        page.locator('[data-workspace=merchant]').click()
        assert '商户' in frame.locator('body').inner_text()
        assert page.locator('.bottom [data-tab=me]').get_attribute('aria-current') == 'page'
        page.locator('.workspace-page .back-link').click()
        assert page.locator('[data-workspace=merchant]').is_visible()
        page.reload()
        page.locator('[data-tab=portal]').click()
        page.locator('[data-tab=workspaces]').click()
        assert page.locator('.workspace-tabs [data-workspace=merchant]').get_attribute('aria-pressed') == 'true'
        page.locator('[data-tab=home]').click()
        page.locator('[data-workspace=itinerary]').click()
        assert frame.locator('[data-iti-action=export]').is_visible()
        assert page.locator('.bottom [data-tab=home]').get_attribute('aria-current') == 'page'
        page.locator('.workspace-page .back-link').click()
        assert page.locator('[data-workspace=itinerary]').is_visible()
        assert not errors, errors
        browser.close()
finally:
    server.shutdown()
