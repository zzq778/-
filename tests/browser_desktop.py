"""Browser validation of the actual self-contained desktop bundle."""
from pathlib import Path
from subprocess import run
from tempfile import TemporaryDirectory
from playwright.sync_api import sync_playwright
import sys
root=Path(__file__).resolve().parents[1]
with TemporaryDirectory() as d:
    bundle=Path(d)/'index.html'
    run([sys.executable,str(root/'desktop/windows/bundle.py'),str(bundle)],check=True)
    with sync_playwright() as p:
        b=p.chromium.launch()
        for width in (900,1100,1440,1920):
            page=b.new_page(viewport={'width':width,'height':900},reduced_motion='reduce')
            errors=[]
            page.on('pageerror',lambda e:errors.append(str(e)))
            page.goto(bundle.as_uri())
            assert page.locator('html.desktop').count()==1
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
            side=page.locator('.bottom').bounding_box()
            chat=page.locator('.conversation').bounding_box()
            assert side['x'] < chat['x'] and side['height']>600
            if width>=1440:
                hero=page.locator('.hero').bounding_box()
                assert hero['x']>chat['x']+chat['width']-1
            page.locator('#q').fill('吉林市冬天两天看雾凇，不想滑雪')
            page.locator('#planner button[type=submit]').click()
            page.locator('#result').wait_for()
            assert '离线规划' in page.locator('#result').inner_text()
            page.locator('[data-act=save]').click()
            page.locator('.bottom [data-tab=explore]').click()
            assert page.locator('.route').count()==12
            page.locator('.bottom [data-tab=portal]').click()
            page.locator('[data-workspace=merchant]').first.click()
            f=page.frame_locator('.workspace-frame')
            assert f.locator('[data-tab=docs]').is_visible()
            page.locator('.bottom [data-tab=me]').click()
            assert page.locator('.trip-list li').count()==1
            assert not errors,errors
            page.locator('.bottom [data-tab=home]').click()
            page.screenshot(path=str(root/'artifacts'/f'desktop-{width}.png'),full_page=True)
            page.close()
        b.close()
print('Desktop layout and offline workspaces PASS')
