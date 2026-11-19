"""Reuse the Android self-contained content; add only desktop presentation."""
import pathlib, subprocess, sys, struct
root = pathlib.Path(__file__).resolve().parents[2]
out = pathlib.Path(sys.argv[1])
bundle = root / 'mobile/android/bundle_site.py'
subprocess.run([sys.executable,str(bundle),str(root/'mobile/site'),str(out)],check=True)
html=out.read_text(encoding='utf-8')
def replace_once(old,new):
    global html
    if html.count(old)!=1: raise SystemExit('desktop bundle anchor missing: '+old)
    html=html.replace(old,new,1)
replace_once('<html lang="zh-CN">','<html lang="zh-CN" class="desktop">')
replace_once('</head>','<style>'+ (root/'desktop/windows/desktop.css').read_text(encoding='utf-8')+'</style></head>')
replace_once("$('#screen').innerHTML=({home,explore,portal:portals,workspaces,me,trip})[tab]();","$('#screen').dataset.page=tab;$('#screen').innerHTML=({home,explore,portal:portals,workspaces,me,trip})[tab]();")
out.write_text(html,encoding='utf-8')
if len(sys.argv)>2:
    png=(root/'public/assets/icon-192.png').read_bytes()
    if not png.startswith(b'\x89PNG\r\n\x1a\n'): raise SystemExit('invalid icon')
    w,h=struct.unpack('>II',png[16:24])
    if not (1<=w<=256 and 1<=h<=256): raise SystemExit('unsupported icon size')
    ico=struct.pack('<HHHBBBBHHII',0,1,1,w%256,h%256,0,0,1,32,len(png),22)+png
    pathlib.Path(sys.argv[2]).write_bytes(ico)
