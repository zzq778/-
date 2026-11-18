using System;
using System.Drawing;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace JiZhengZhiXing {
 internal static class Program {
   [STAThread] static int Main(string[] args) {
     bool test=Array.IndexOf(args,"--self-test")>=0;
     Application.EnableVisualStyles();
     Application.SetCompatibleTextRenderingDefault(false);
     using(var form=new MainWindow(test)) { Application.Run(form); return form.ResultCode; }
   }
 }
 internal sealed class MainWindow : Form {
   private const string Host="jizhengzhixing-mobile.zedi-li070614.workers.dev";
   private const string Home="https://"+Host+"/";
   private const string CSP="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; connect-src https://"+Host+"; frame-src 'self' about:; base-uri 'none'; object-src 'none'";
   private readonly WebView2 view=new WebView2();
   private readonly bool test;
   private byte[] content;
   private CoreWebView2Environment environment;
   private readonly Timer timer=new Timer{Interval=45000};
   private string profile;
   internal int ResultCode {get;private set;}
   internal MainWindow(bool testMode) {
     test=testMode;ResultCode=test?1:0;
     Text="吉政知行";Icon=Icon.ExtractAssociatedIcon(Application.ExecutablePath);
     BackColor=Color.FromArgb(250,249,245);MinimumSize=new Size(900,620);
     Size=new Size(1440,900);StartPosition=FormStartPosition.CenterScreen;AutoScaleMode=AutoScaleMode.Dpi;
     view.Dock=DockStyle.Fill;Controls.Add(view);
     timer.Tick+=(s,e)=>Fail("启动或自检超时。");
     Shown+=async(s,e)=>await Start();
     FormClosed+=(s,e)=>{timer.Stop();view.Dispose();if(test&&profile!=null){try{Directory.Delete(profile,true);}catch{}}};
   }
   private void Fail(string message) {
     ResultCode=1; timer.Stop();
     if(!test)MessageBox.Show(this,message,"吉政知行",MessageBoxButtons.OK,MessageBoxIcon.Warning);
     Close();
   }
   private async Task Start() {
     try {
       timer.Start();
       using(var data=Assembly.GetExecutingAssembly().GetManifestResourceStream("JiZhengZhiXing.index.html"))
       using(var output=new MemoryStream()) {if(data==null)throw new InvalidOperationException("应用资源缺失");data.CopyTo(output);content=output.ToArray();}
       profile=test?Path.Combine(Path.GetTempPath(),"jzzx-test-"+Guid.NewGuid().ToString("N")):
         Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"JiZhengZhiXing","WebView");
       environment=await CoreWebView2Environment.CreateAsync(null,profile);
       await view.EnsureCoreWebView2Async(environment);
       var core=view.CoreWebView2;
       core.Settings.AreDevToolsEnabled=false;core.Settings.AreHostObjectsAllowed=false;core.Settings.IsWebMessageEnabled=false;
       core.Settings.IsStatusBarEnabled=false;
       core.Settings.AreDefaultScriptDialogsEnabled=true;
       core.PermissionRequested+=(s,e)=>e.State=CoreWebView2PermissionState.Deny;
       core.AddWebResourceRequestedFilter("*",CoreWebView2WebResourceContext.All,CoreWebView2WebResourceRequestSourceKinds.All);
       core.WebResourceRequested+=OnResource;
       core.NavigationStarting+=(s,e)=>{
         if(e.Uri==Home)return;
         e.Cancel=true;if(e.IsUserInitiated)OpenExternal(e.Uri);
       };
       core.FrameNavigationStarting+=(s,e)=>{
         if(e.Uri=="about:srcdoc"||e.Uri=="about:blank")return;
         e.Cancel=true;if(e.IsUserInitiated)OpenExternal(e.Uri);
       };
       core.NewWindowRequested+=(s,e)=>{e.Handled=true;if(e.IsUserInitiated)OpenExternal(e.Uri);};
       core.NavigationCompleted+=async(s,e)=>{
         if(!e.IsSuccess){Fail("应用界面无法打开。");return;}
         if(test)await Smoke();else timer.Stop();
       };
       core.Navigate(Home);
     } catch(Exception e) {Fail("无法启动桌面端。请确认系统已安装 Microsoft Edge WebView2 Runtime 和 .NET Framework 4.8。\n"+e.Message);}
   }
   private static bool ApprovedApi(Uri u,string method) {
     string p=u.AbsolutePath;
     if(method=="GET")return p=="/api/status"||p=="/api/v1/portal/status"||p=="/api/v1/portal/me"||p=="/api/v1/portal/merchants"||p=="/api/v1/portal/feedback"||p=="/api/v1/portal/summary"||p=="/api/v1/images/status";
     if(method=="POST")return p=="/api/travel"||p=="/api/v1/chat"||p=="/api/v1/portal/analysis"||p=="/api/v1/portal/feedback"||p=="/api/v1/images"||System.Text.RegularExpressions.Regex.IsMatch(p,@"^/api/v1/portal/feedback/[a-zA-Z0-9_-]{1,80}/replies$");
     return false;
   }
   private void OnResource(object sender,CoreWebView2WebResourceRequestedEventArgs e) {
     Uri uri;
     if(!Uri.TryCreate(e.Request.Uri,UriKind.Absolute,out uri)){Deny(e);return;}
     if(uri.Scheme=="data"||uri.Scheme=="blob"||uri.Scheme=="about")return;
     if(uri.Scheme!="https"||uri.Host!=Host||!uri.IsDefaultPort||!String.IsNullOrEmpty(uri.UserInfo)){Deny(e);return;}
     if(uri.AbsoluteUri==Home&&e.Request.Method=="GET"){
       e.Response=environment.CreateWebResourceResponse(new MemoryStream(content,false),200,"OK","Content-Type: text/html; charset=utf-8\r\nCache-Control: no-store\r\nContent-Security-Policy: "+CSP+"\r\nX-Content-Type-Options: nosniff");
     }else if(!ApprovedApi(uri,e.Request.Method))Deny(e);
     // Approved first-party API requests are sent normally, with the browser origin untouched.
   }
   private void Deny(CoreWebView2WebResourceRequestedEventArgs e){
     e.Response=environment.CreateWebResourceResponse(new MemoryStream(new byte[0]),403,"Forbidden","Content-Type: text/plain\r\nCache-Control: no-store");
   }
   private static void OpenExternal(string raw){
     Uri u;
     if(!Uri.TryCreate(raw,UriKind.Absolute,out u)||!(u.Scheme=="https"||u.Scheme=="http")||!String.IsNullOrEmpty(u.UserInfo)||u.Host==Host)return;
     try{Process.Start(new ProcessStartInfo(u.AbsoluteUri){UseShellExecute=true});}catch{}
   }
   private async Task Smoke(){
     try {
       var core=view.CoreWebView2;
       string ok=await core.ExecuteScriptAsync("document.documentElement.classList.contains('desktop') && !!document.querySelector('#chatInput') && document.querySelectorAll('.bottom button').length===4");
       if(ok!="true")throw new Exception("desktop shell check failed");
       await core.ExecuteScriptAsync("document.querySelector('#modeBadge').click();document.querySelector('[data-mode=local]').click();document.querySelector('#q').value='吉林市冬天两天看雾凇，不想滑雪';document.querySelector('#q').dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#planner button[type=submit]').click();");
       for(int i=0;i<40;i++){
         string result=await core.ExecuteScriptAsync("!!document.querySelector('#result') && document.querySelector('#result').innerText.includes('离线规划')");
         if(result=="true"){ResultCode=0;timer.Stop();Close();return;}
         await Task.Delay(250);
       }
       throw new Exception("offline plan check failed");
     } catch(Exception e){Fail(e.Message);}
   }
 }
}
