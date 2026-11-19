"""Build the same offline desktop bundle for WKWebView."""
import pathlib,sys,subprocess
root=pathlib.Path(__file__).resolve().parents[2]
out=pathlib.Path(sys.argv[1])
subprocess.run([sys.executable,str(root/'desktop/windows/bundle.py'),str(out)],check=True)
s=out.read_text(encoding='utf-8')
# The native shell intercepts approved API requests; it never loads remote HTML.
s=s.replace("location.origin===CLOUD_ORIGIN","(location.origin===CLOUD_ORIGIN||window.JZZXMac===true)").replace("location.origin!==CLOUD_ORIGIN","(location.origin!==CLOUD_ORIGIN&&window.JZZXMac!==true)")
out.write_text(s,encoding='utf-8')
