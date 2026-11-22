#!/usr/bin/env python3
"""Bundle the original v0.6.x PWA without changing its chat implementation."""
import base64
import mimetypes
import re
import sys
from pathlib import Path

site = Path(sys.argv[1]).resolve()
output = Path(sys.argv[2])
html = (site / "index.html").read_text(encoding="utf-8")

css_names = ["styles.css", "home-v060.css", "polish-v062.css", "attachments-v063.css"]
for name in css_names:
    pattern = re.compile(r'<link\b(?=[^>]*href=["\']\./' + re.escape(name) + r'["\'])[^>]*>', re.IGNORECASE)
    if len(pattern.findall(html)) != 1:
        raise SystemExit(f"expected one stylesheet link for {name}")
    css = (site / name).read_text(encoding="utf-8")
    html = pattern.sub(lambda _: '<style data-original-css="' + name + '">' + css + "</style>", html)

html, manifest_count = re.subn(r'<link\b(?=[^>]*rel=["\']manifest["\'])[^>]*>', "", html, flags=re.IGNORECASE)
if manifest_count != 1:
    raise SystemExit(f"expected one manifest link, got {manifest_count}")

asset_dir = site / "assets"
assets = sorted(p for p in asset_dir.iterdir() if p.is_file())
if not assets:
    raise SystemExit("original artwork directory is empty")
asset_map = {}
for path in assets:
    mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    asset_map[path.name] = f"data:{mime};base64,{encoded}"

def inline_assets(source: str) -> str:
    for name, uri in asset_map.items():
        source = source.replace("./assets/" + name, uri)
    return source

html = inline_assets(html)
app = inline_assets((site / "app.js").read_text(encoding="utf-8"))
script_pattern = re.compile(r'<script\b(?=[^>]*src=["\']\./app\.js["\'])[^>]*>\s*</script>', re.IGNORECASE)
if len(script_pattern.findall(html)) != 1:
    raise SystemExit("expected exactly one original app.js script tag")
html = script_pattern.sub(lambda _: "<script>" + app + "</script>", html)

required = [
    "ai-full-panel",
    "state.messages",
    "chat-stream",
    "chat-form",
    "state.messages.slice(-4)",
    "fetch('/api/chat'",
    "正在思考",
]
for marker in required:
    if marker not in html:
        raise SystemExit("original multi-turn contract missing: " + marker)
if re.search(r'<link\b[^>]*href=["\']\./[^"\']+\.css', html, re.IGNORECASE):
    raise SystemExit("unbundled stylesheet remains")
if re.search(r'<script\b[^>]*src=["\']\./app\.js', html, re.IGNORECASE):
    raise SystemExit("unbundled app.js remains")
if re.search(r'\./assets/[A-Za-z0-9._-]+', html):
    raise SystemExit("unbundled artwork reference remains")

output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(html, encoding="utf-8")
print(f"Bundled original v0.6.x chat: {len(html)} characters, {len(asset_map)} assets")
