"""Actual UI and HTTP service + SQL, isolated model test double. No live providers or production data."""
from pathlib import Path
from subprocess import Popen,run,PIPE
import json,os
from playwright.sync_api import sync_playwright
repo=Path(__file__).resolve().parents[1]
out=repo/'artifacts'/'product-quality';out.mkdir(parents=True,exist_ok=True)
server=Popen(['node','tests/product_http_fixture.mjs'],cwd=repo,stdout=PIPE,text=True)
key=lambda id:'test-'+id+'-long-credential-000000000000000000'
try:
    urls=json.loads(server.stdout.readline())
    env=dict(os.environ,JZZX_AGENT_URL=urls['mobile'],JZZX_AGENT_CODE='agent-client-test-123456')
    cli=run(['node','scripts/jixiaozhi-chat.mjs','查询净月潭资料'],cwd=repo,env=env,capture_output=True,text=True,check=True)
    result=json.loads(cli.stdout)
    assert result['status']=='complete' and any('ijingyuetan.com' in s['url'] for s in result['sources'])
    with sync_playwright() as p:
        b=p.chromium.launch()
        errors=[]
        def page(url,width=390):
            c=b.new_context(viewport={'width':width,'height':844},reduced_motion='reduce')
            t=c.new_page();t.set_default_timeout(10000);t.on('pageerror',lambda e:errors.append(str(e)));t.goto(url);return c,t
        def login(f,who):
            f.locator('#op-key').fill(key(who))
            f.locator('#op-login button').click()
            f.locator('[data-op=logout]').wait_for()
        tc,t=page(urls['mobile'])
        t.locator('#chatInput').fill('帮我反馈停车指引不清')
        t.locator('#conversationForm button').click()
        t.locator('#accessCode').fill('team-preview-test-123456')
        t.locator('#conversationForm button').click()
        t.locator('[data-chat-feedback][data-destination=online]').wait_for()
        assert '反馈草稿' in t.locator('.conversation-reply').inner_text()
        t.screenshot(path=str(out/'mobile-chat.png'),full_page=True)
        t.locator('[data-chat-feedback][data-destination=online]').click()
        f=t.frame_locator('.workspace-frame')
        login(f,'touristA')
        assert f.locator('#op-text').input_value()=='停车指引不清，希望改善。'
        assert f.locator('.op-item').count()==0
        f.locator('#op-merchant').select_option('m1')
        f.locator('#op-create button').click()
        f.locator('.op-item').wait_for()
        assert '停车指引不清' in f.locator('.op-item').inner_text()
        t.screenshot(path=str(out/'mobile-feedback.png'),full_page=True)
        mc,m=page(urls['web'])
        m.locator('#bottomNav [data-tab=news]').click()
        m.locator('[data-action=online-portal]').click()
        mf=m.frame_locator('.portal-frame');login(mf,'merchantA')
        mf.locator('.op-item textarea').fill('收到，将核对标识。')
        mf.locator('.op-item button').click()
        mf.locator('.op-reply').wait_for()
        m.screenshot(path=str(out/'web-merchant.png'),full_page=True)
        f.locator('[data-op=refresh]').click()
        f.locator('.op-reply').wait_for()
        assert '收到，将核对标识。' in f.locator('.op-reply').inner_text()
        for who in ('merchantB','govB','touristB'):
            mc2,m2=page(urls['web']+'/portals/online/index.html');login(m2,who);assert m2.locator('.op-item').count()==0;mc2.close()
        gc,g=page(urls['web']+'/portals/online/index.html')
        login(g,'govA')
        assert '停车指引不清' in g.locator('.op-item').inner_text()
        g.locator('.op-item textarea').fill('请持续跟进。')
        g.locator('.op-item button').click()
        g.wait_for_function("document.querySelectorAll('.op-reply').length===2")
        f.locator('[data-op=refresh]').click()
        f.locator('.op-reply').last.wait_for()
        t.wait_for_function("document.querySelector('.workspace-frame').contentDocument.querySelectorAll('.op-reply').length===2")
        assert '请持续跟进。' in f.locator('.op-reply').last.inner_text()
        tc.close();mc.close();gc.close()
        for width in (320,390,820):
            c,a=page(urls['web'],width);a.screenshot(path=str(out/f'web-home-{width}.png'),full_page=True)
            assert a.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
            c.close()
        for width in (320,390,820):
            c,a=page(urls['mobile'],width);a.screenshot(path=str(out/f'mobile-home-{width}.png'),full_page=True)
            assert a.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
            c.close()
        assert not errors,errors
        b.close()
finally:
    server.terminate()
    try:server.wait(timeout=5)
    except:server.kill()
print('Independent CLI and real feedback UI/HTTP/SQLite cross-role test PASS')
