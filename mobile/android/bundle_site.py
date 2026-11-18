"""Create a self-contained Android/web preview using checked-in artwork."""
import base64
import re
import sys
from pathlib import Path

site = Path(sys.argv[1]).resolve()
output = Path(sys.argv[2])
html = (site / 'index.html').read_text(encoding='utf-8')
marker = '<link rel="stylesheet" href="./art/design.css" data-bundle-art>'
if html.count(marker) != 1:
    raise SystemExit('visual stylesheet marker missing or duplicated')
html = html.replace(marker, '<style>' + (site / 'art/design.css').read_text(encoding='utf-8') + '</style>')
# Some route artwork paths are constructed in JS. Preload the compact asset map in script.
assets = {p.stem: 'data:image/webp;base64,' + base64.b64encode(p.read_bytes()).decode('ascii') for p in sorted((site / 'art').glob('*.webp'))}
expected = {'chaganhu-winter-1d', 'changbaishan-north-2d', 'changbaishan-west-3d', 'changchun-city-1d', 'changchun-family-1d', 'hero', 'jian-history-2d', 'jilin-lake-2d', 'jilin-wusong-2d', 'mountain', 'siping-red-1d', 'xianghai-birds-2d', 'yanbian-border-2d', 'yanbian-food-2d'}
if set(assets) != expected:
    raise SystemExit('visual assets missing or unexpected: '+str(set(assets)))
for name, uri in assets.items():
    html = html.replace('./art/' + name + '.webp', uri)
import json
needle = './art/${art}.webp'
if html.count(needle) != 1:
    raise SystemExit('dynamic artwork reference missing')
html = html.replace(needle, '${(' + json.dumps(assets, separators=(',',':')) + ')[art]}')
if re.search(r'(?:src|href)=[\"\']\./art/', html):
    raise SystemExit('unbundled asset reference')
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(html, encoding='utf-8')
