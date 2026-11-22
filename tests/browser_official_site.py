import asyncio
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1] / "website"
PAGES = [
    ("/", "吉政知行"),
    ("/about/", "关于吉政知行"),
    ("/features/", "产品能力"),
    ("/privacy/", "隐私说明与服务边界"),
]


class QuietHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, *_args):
        pass


async def run_browser(base_url):
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch()
        try:
            for width in (320, 390, 820, 1280):
                page = await browser.new_page(
                    viewport={"width": width, "height": 900},
                    device_scale_factor=1,
                )
                page_errors = []
                page.on("pageerror", lambda error: page_errors.append(str(error)))

                for path, title_fragment in PAGES:
                    response = await page.goto(base_url + path, wait_until="networkidle")
                    assert response and response.status == 200, f"{path}: HTTP response failed"
                    assert title_fragment in await page.title(), f"{path}: unexpected title"
                    assert await page.locator("h1").count() == 1, f"{path}: expected one h1"
                    assert await page.locator('meta[name="description"]').count() == 1
                    assert await page.locator('link[rel="canonical"]').count() == 1

                    overflow = await page.evaluate(
                        "document.documentElement.scrollWidth > window.innerWidth"
                    )
                    assert not overflow, f"{path}: horizontal overflow at {width}px"

                    if path == "/":
                        assert await page.locator('a[href="/app"]').count() >= 1
                        await page.locator(".faq-list summary").first.click()
                        opened = await page.locator(".faq-list details").first.evaluate(
                            "(element) => element.open"
                        )
                        assert opened, "homepage FAQ did not open"

                    assert not page_errors, f"{path}: browser errors: {page_errors}"

                await page.close()
                print(f"official site responsive checks passed: {width}px")

        finally:
            await browser.close()


def main():
    server = ThreadingHTTPServer(("127.0.0.1", 0), QuietHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        port = server.server_address[1]
        asyncio.run(run_browser(f"http://127.0.0.1:{port}"))
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
