import AppKit
import WebKit
import Foundation
import UniformTypeIdentifiers

let remote = "https://jizhengzhixing-mobile.zedi-li070614.workers.dev"
let local = "jzzx://app/"
let csp = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; frame-src 'self' about:; base-uri 'none'; object-src 'none'; connect-src 'none'"

final class LocalPage: NSObject, WKURLSchemeHandler {
    let html: Data
    init(_ html: Data) { self.html = html }
    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard let url = task.request.url, url.absoluteString == local else {
            task.didFailWithError(URLError(.fileDoesNotExist)); return
        }
        let response = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: ["Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","Content-Security-Policy":csp])!
        task.didReceive(response); task.didReceive(html); task.didFinish()
    }
    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}
}
final class NoRedirect: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}
final class NativeBridge: NSObject, WKScriptMessageHandlerWithReply {
    let session: URLSession = {
        let c = URLSessionConfiguration.ephemeral
        c.httpCookieStorage=nil; c.urlCredentialStorage=nil; c.timeoutIntervalForRequest=45; c.timeoutIntervalForResource=50
        return URLSession(configuration:c,delegate:NoRedirect(),delegateQueue:nil)
    }()
    var panelOpen=false
    weak var web: WKWebView?
    func allowed(_ path:String,_ method:String)->Bool{
        let gets=["/api/status","/api/v1/portal/status","/api/v1/portal/me","/api/v1/portal/merchants","/api/v1/portal/feedback","/api/v1/portal/summary","/api/v1/images/status"]
        let posts=["/api/travel","/api/v1/chat","/api/v1/portal/feedback","/api/v1/portal/analysis","/api/v1/images"]
        return method=="GET" ? gets.contains(path) : method=="POST" && (posts.contains(path) || path.range(of:"^/api/v1/portal/feedback/[A-Za-z0-9_-]{1,80}/replies$",options:.regularExpression) != nil)
    }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage, replyHandler: @escaping (Any?, String?) -> Void) {
        guard message.webView === web, let frameURL=message.frameInfo.request.url,
              frameURL.absoluteString==local || frameURL.absoluteString=="about:srcdoc" || frameURL.absoluteString=="about:blank",
              let d=message.body as? [String:Any], let action=d["action"] as? String else { replyHandler(nil,"Untrusted content");return }
        if action=="api" {
            guard let path=d["path"] as? String,let method=d["method"] as? String,allowed(path,method),
                  let auth=d["authorization"] as? String,auth.count<=167,!auth.contains("\r"),!auth.contains("\n"),
                  let body=d["body"] as? String,body.utf8.count<=65536,
                  let url=URL(string:remote+path) else { replyHandler(nil,"Invalid request");return }
            var request=URLRequest(url:url);request.httpMethod=method
            request.setValue(remote,forHTTPHeaderField:"Origin")
            request.setValue("application/json",forHTTPHeaderField:"Accept")
            if !auth.isEmpty {request.setValue(auth,forHTTPHeaderField:"Authorization")}
            if method=="POST"{ request.setValue("application/json",forHTTPHeaderField:"Content-Type");request.httpBody=Data(body.utf8) }
            session.dataTask(with:request){data,response,error in
                DispatchQueue.main.async{
                    guard error==nil,let r=response as? HTTPURLResponse,let bytes=data,bytes.count<=5_000_000,
                          r.statusCode>=200,r.statusCode<=599,let value=String(data:bytes,encoding:.utf8) else { replyHandler(nil,"Network unavailable");return }
                    replyHandler(["status":r.statusCode,"body":value],nil)
                }
            }.resume()
        }else if action=="save" {
            guard !panelOpen,let mime=d["mime"] as? String,let name=d["name"] as? String,
                  let code=d["base64"] as? String,code.count<=4_200_000,
                  let bytes=Data(base64Encoded:code),bytes.count>0,bytes.count<=3*1024*1024 else{replyHandler(nil,"Invalid file");return}
            let type:UTType
            if mime=="image/png",bytes.starts(with:[137,80,78,71,13,10,26,10]){type = .png}
            else if mime=="image/jpeg",bytes.starts(with:[255,216,255]),bytes.suffix(2)==Data([255,217]){type = .jpeg}
            else if mime=="text/csv"{type = .commaSeparatedText}
            else{replyHandler(nil,"Unsupported file");return}
            let safe=String(name.prefix(90)).replacingOccurrences(of:"[/\\\\:\\p{Cc}]",with:"_",options:.regularExpression)
            let panel=NSSavePanel();panel.allowedContentTypes=[type];panel.nameFieldStringValue=safe;panel.canCreateDirectories=true
            panelOpen=true
            let done:(NSApplication.ModalResponse)->Void={result in
                self.panelOpen=false
                if result == .OK,let destination=panel.url{
                    do{try bytes.write(to:destination,options:.atomic);replyHandler(["saved":true],nil)}
                    catch{let a=NSAlert();a.messageText="文件保存失败";a.runModal();replyHandler(nil,"Save failed")}
                }else{replyHandler(["saved":false],nil)}
            }
            if let window=web?.window{panel.beginSheetModal(for:window,completionHandler:done)}else{panel.begin(completionHandler:done)}
        }else{replyHandler(nil,"Unknown action")}
    }
}
final class AppDelegate:NSObject,NSApplicationDelegate,WKNavigationDelegate,WKUIDelegate{
    var window:NSWindow!
    var web:WKWebView!
    let bridge=NativeBridge()
    var page:LocalPage!
    let selfTest=CommandLine.arguments.contains("--self-test")
    var smokeStarted=false
    var deadline:Timer?
    func applicationDidFinishLaunching(_ notification:Notification) {
        guard let url=Bundle.main.url(forResource:"index",withExtension:"html"),let html=try? Data(contentsOf:url),
              let jsURL=Bundle.main.url(forResource:"bridge",withExtension:"js"),let js=try? String(contentsOf:jsURL,encoding:.utf8) else{exit(2)}
        page=LocalPage(html)
        let config=WKWebViewConfiguration()
        config.websiteDataStore=selfTest ? .nonPersistent() : .default()
        config.setURLSchemeHandler(page,forURLScheme:"jzzx")
        config.userContentController.addScriptMessageHandler(bridge,contentWorld:.page,name:"jzzx")
        config.userContentController.addUserScript(WKUserScript(source:js,injectionTime:.atDocumentStart,forMainFrameOnly:false))
        config.preferences.javaScriptCanOpenWindowsAutomatically=false
        web=WKWebView(frame:.zero,configuration:config);bridge.web=web
        web.navigationDelegate=self;web.uiDelegate=self
        window=NSWindow(contentRect:NSRect(x:0,y:0,width:1380,height:880),styleMask:[.titled,.closable,.miniaturizable,.resizable],backing:.buffered,defer:false)
        window.minSize=NSSize(width:900,height:620);window.title="吉政知行";window.contentView=web;window.center();window.makeKeyAndOrderFront(nil)
        let menu=NSMenu(), appItem=NSMenuItem();menu.addItem(appItem);let appMenu=NSMenu()
        appMenu.addItem(withTitle:"退出吉政知行",action:#selector(NSApplication.terminate(_:)),keyEquivalent:"q");appItem.submenu=appMenu;NSApp.mainMenu=menu
        NSApp.activate(ignoringOtherApps:true)
        if selfTest {deadline=Timer.scheduledTimer(withTimeInterval:40,repeats:false){_ in print("macOS self-test timeout");exit(1)}}
        web.load(URLRequest(url:URL(string:local)!))
    }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender:NSApplication)->Bool{true}
    func webView(_ webView:WKWebView,decidePolicyFor action:WKNavigationAction,decisionHandler:@escaping (WKNavigationActionPolicy)->Void){
        guard let url=action.request.url else{decisionHandler(.cancel);return}
        if url.absoluteString==local||url.absoluteString=="about:srcdoc"||url.absoluteString=="about:blank"{decisionHandler(.allow);return}
        if action.navigationType == .linkActivated,["https","http"].contains(url.scheme ?? ""),url.host != URL(string:remote)?.host,url.user==nil,url.password==nil{NSWorkspace.shared.open(url)}
        decisionHandler(.cancel)
    }
    func webView(_ webView:WKWebView,createWebViewWith configuration:WKWebViewConfiguration,for action:WKNavigationAction,windowFeatures:WKWindowFeatures)->WKWebView?{
        if action.navigationType == .linkActivated,let url=action.request.url,["https","http"].contains(url.scheme ?? ""),url.host != URL(string:remote)?.host,url.user==nil,url.password==nil{NSWorkspace.shared.open(url)}
        return nil
    }
    func webView(_ webView:WKWebView,didFinish navigation:WKNavigation!){
        if !selfTest||smokeStarted{return};smokeStarted=true
        web.evaluateJavaScript("!!window.JZZXMac && document.documentElement.classList.contains('desktop') && !!document.querySelector('#chatInput') && !!document.querySelector('#q')"){value,error in
            guard error==nil,(value as? Bool)==true else{print("macOS UI check failed");exit(1)}
            self.web.evaluateJavaScript("document.querySelector('#modeBadge').click();document.querySelector('[data-mode=local]').click();document.querySelector('#q').value='吉林市冬天两天看雾凇，不想滑雪';document.querySelector('#q').dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#planner button[type=submit]').click();"){_,error in
                if error != nil{print("offline input failed");exit(1)}
                self.poll(0)
            }
        }
    }
    func poll(_ attempt:Int){
        web.evaluateJavaScript("!!document.querySelector('#result') && document.querySelector('#result').innerText.includes('离线规划')"){v,e in
            if e==nil,(v as? Bool)==true{
                self.web.evaluateJavaScript("document.querySelector('[data-act=save]').click();document.querySelector('.bottom [data-tab=me]').click();document.querySelector('.trip-list li')!==null"){v,e in
                    if e==nil,(v as? Bool)==true{print("macOS native WebKit and offline persistence PASS");exit(0)}
                    print("offline save check failed");exit(1)
                };return
            }
            if attempt>=40{print("offline plan check failed");exit(1)}
            DispatchQueue.main.asyncAfter(deadline:.now()+0.25){self.poll(attempt+1)}
        }
    }
    func webView(_ webView:WKWebView,didFailProvisionalNavigation navigation:WKNavigation!,withError error:Error){if selfTest{print("WebKit navigation failed");exit(1)}}
}
let app=NSApplication.shared
let delegate=AppDelegate();app.delegate=delegate;app.setActivationPolicy(.regular);app.run()
