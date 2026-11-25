import asyncio
import json
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1] / "mobile" / "site"
PREVIEW_ORIGIN = "https://jizhengzhixing-mobile-preview.zedi-li070614.workers.dev"


class QuietHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, *_args):
        pass


async def run_browser(base_url):
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch()
        try:
            for width, height in ((390, 844), (820, 900), (1280, 900), (1440, 960)):
                page = await browser.new_page(
                    viewport={"width": width, "height": height},
                    device_scale_factor=1,
                )
                errors = []
                page.on("pageerror", lambda error: errors.append(str(error)))

                async def mock_status(route):
                    await route.fulfill(
                        status=200,
                        content_type="application/json",
                        body=json.dumps({
                            "service": "jzzx-mobile",
                            "version": "1.0.6",
                            "ready": True,
                            "chatReady": True,
                            "externalChatReady": False,
                            "chatModel": "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
                        }),
                    )

                await page.route(f"{PREVIEW_ORIGIN}/api/status", mock_status)
                response = await page.goto(base_url + "/", wait_until="networkidle")
                assert response and response.status == 200
                assert "吉政知行" in await page.title()
                assert await page.locator(".conversation").count() == 1
                assert await page.locator("#chatInput").count() == 1
                assert await page.locator("#chatMic").count() == 1
                assert await page.locator(".chat-send").count() == 1
                assert await page.locator(".bottom button").count() == 4

                layout = await page.evaluate("""() => {
                  const rect = (selector) => {
                    const r = document.querySelector(selector).getBoundingClientRect();
                    return {x:r.x, y:r.y, width:r.width, height:r.height, right:r.right};
                  };
                  return {
                    viewport: innerWidth,
                    documentWidth: document.documentElement.scrollWidth,
                    app: rect('.app'),
                    screenDisplay: getComputedStyle(document.querySelector('#screen')).display,
                    conversation: rect('.conversation'),
                    hero: rect('.hero'),
                    mainDisplay: getComputedStyle(document.querySelector('.main')).display,
                    jade: getComputedStyle(document.documentElement).getPropertyValue('--jade').trim(),
                    paper: getComputedStyle(document.documentElement).getPropertyValue('--paper').trim(),
                    bottomPosition: getComputedStyle(document.querySelector('.bottom')).position,
                  };
                }""")

                assert layout["documentWidth"] <= width + 1, (width, layout)
                assert layout["app"]["width"] >= width - 1, (width, layout)
                assert layout["jade"].lower() == "#205e4f", (width, layout["jade"])
                assert layout["paper"].lower() == "#faf9f5", (width, layout["paper"])

                if width >= 1024:
                    assert layout["app"]["width"] > 1100, (width, layout)
                    assert layout["screenDisplay"] == "grid", (width, layout)
                    assert layout["mainDisplay"] == "grid", (width, layout)
                    assert layout["hero"]["x"] >= layout["conversation"]["right"] - 1, (width, layout)
                    assert layout["hero"]["width"] > 400, (width, layout)
                elif width >= 768:
                    assert layout["app"]["width"] > 700, (width, layout)
                    assert layout["screenDisplay"] != "grid", (width, layout)
                else:
                    assert layout["app"]["width"] <= 680, (width, layout)

                assert not errors, (width, errors)
                print(f"mobile app responsive checks passed: {width}px")
                await page.close()
        finally:
            await browser.close()


def main():
    server = ThreadingHTTPServer(("127.0.0.1", 0), QuietHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        asyncio.run(run_browser(f"http://127.0.0.1:{server.server_address[1]}"))
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
