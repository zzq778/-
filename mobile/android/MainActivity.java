package cn.jzzx.travel.online;

import android.Manifest;
import android.app.Activity;
import android.os.Bundle;
import android.graphics.Color;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.PermissionRequest;
import android.speech.RecognizerIntent;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.os.Build;
import org.json.JSONObject;
import java.util.ArrayList;

/** Android shell for the original v0.6.x 吉小知 multi-turn conversation app. */
public final class MainActivity extends Activity {
  private static final String APP_URL="https://jizhengzhixing.zedi-li070614.workers.dev/";
  private static final String APP_HOST="jizhengzhixing.zedi-li070614.workers.dev";
  private static final int VOICE_REQUEST_CODE=702;
  private static final int AUDIO_PERMISSION_REQUEST_CODE=703;
  private WebView web;
  private int pendingVoiceId=0;
  private PermissionRequest pendingPermissionRequest=null;

  @Override public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    getWindow().setStatusBarColor(Color.rgb(248,249,251));
    getWindow().setNavigationBarColor(Color.WHITE);
    int bars=android.view.View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
    if(Build.VERSION.SDK_INT>=26)bars|=android.view.View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
    getWindow().getDecorView().setSystemUiVisibility(bars);

    web=new WebView(this);
    web.setBackgroundColor(Color.rgb(248,249,251));
    WebSettings settings=web.getSettings();
    settings.setJavaScriptEnabled(true);
    settings.setDomStorageEnabled(true);
    settings.setDatabaseEnabled(true);
    settings.setAllowFileAccess(false);
    settings.setAllowContentAccess(false);
    settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
    settings.setSupportMultipleWindows(false);
    settings.setJavaScriptCanOpenWindowsAutomatically(false);
    settings.setAllowFileAccessFromFileURLs(false);
    settings.setAllowUniversalAccessFromFileURLs(false);
    web.addJavascriptInterface(new NativeVoice(),"JZZXNativeVoice");

    web.setWebChromeClient(new WebChromeClient(){
      @Override public void onPermissionRequest(PermissionRequest request){
        runOnUiThread(()->{
          Uri origin=request.getOrigin();
          if(origin==null||!APP_HOST.equalsIgnoreCase(origin.getHost())){
            request.deny();
            return;
          }
          boolean audio=false;
          for(String resource:request.getResources()){
            if(PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource))audio=true;
          }
          if(!audio){
            request.deny();
            return;
          }
          if(Build.VERSION.SDK_INT>=23&&checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED){
            pendingPermissionRequest=request;
            requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO},AUDIO_PERMISSION_REQUEST_CODE);
          }else{
            request.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
          }
        });
      }
    });

    web.setWebViewClient(new WebViewClient(){
      @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){
        return openExternal(request.getUrl());
      }
      @Override public boolean shouldOverrideUrlLoading(WebView view,String url){
        return openExternal(Uri.parse(url));
      }
      @Override public void onPageFinished(WebView view,String url){
        super.onPageFinished(view,url);
        installOriginalChatBridge(view);
      }
    });
    setContentView(web);

    try(java.io.InputStream in=getAssets().open("index.html");
        java.io.ByteArrayOutputStream out=new java.io.ByteArrayOutputStream()){
      byte[] buffer=new byte[8192];
      int n;
      while((n=in.read(buffer))!=-1)out.write(buffer,0,n);
      // The HTTPS base URL gives the bundled page the original Worker origin.
      // Relative /api/chat and /api/status calls therefore stay same-origin.
      web.loadDataWithBaseURL(APP_URL,new String(out.toByteArray(),java.nio.charset.StandardCharsets.UTF_8),"text/html","UTF-8",null);
    }catch(Exception e){
      web.loadDataWithBaseURL(APP_URL,"<meta charset=utf-8><p>应用资源读取失败，请重新安装。</p>","text/html","UTF-8",null);
    }
  }

  private void installOriginalChatBridge(WebView view){
    String js="(function(){try{"+
      "if(window.JZZXNativeVoice&&!window.SpeechRecognition&&!window.webkitSpeechRecognition){"+
      "var seq=0,active=null;"+
      "function NativeSpeechRecognition(){this.lang='zh-CN';this.continuous=false;this.interimResults=true;this.maxAlternatives=1;this.onstart=null;this.onresult=null;this.onerror=null;this.onend=null;this._id=0;}"+
      "NativeSpeechRecognition.prototype.start=function(){if(active){if(this.onerror)this.onerror({error:'service-not-allowed'});return;}this._id=++seq;active=this;if(this.onstart)this.onstart();window.JZZXNativeVoice.start(this._id);};"+
      "NativeSpeechRecognition.prototype.abort=function(){if(active===this){active=null;if(this.onend)this.onend();}};"+
      "NativeSpeechRecognition.prototype.stop=NativeSpeechRecognition.prototype.abort;"+
      "window.SpeechRecognition=NativeSpeechRecognition;"+
      "window.onJzzxVoiceResult=function(id,text,error){var r=active;if(!r||r._id!==id)return;active=null;"+
      "if(text){var alt={transcript:text,confidence:1};var item=[alt];item.isFinal=true;var results=[item];results.item=function(i){return results[i];};if(r.onresult)r.onresult({resultIndex:0,results:results});}"+
      "else if(error&&r.onerror){r.onerror({error:'network',message:error});}"+
      "if(r.onend)r.onend();};"+
      "}"+
      "if(!window.onNativeBack){window.onNativeBack=function(){var close=document.querySelector('[data-action=\\\"ai-close\\\"]');if(close){close.click();return true;}return false;};}"+
      "}catch(e){}})();";
    view.evaluateJavascript(js,null);
  }

  private boolean openExternal(Uri uri){
    String scheme=uri.getScheme();
    if(!"https".equalsIgnoreCase(scheme)&&!"http".equalsIgnoreCase(scheme))return true;
    if(APP_HOST.equalsIgnoreCase(uri.getHost()))return false;
    try{startActivity(new Intent(Intent.ACTION_VIEW,uri));}catch(Exception ignored){}
    return true;
  }

  private void deliverVoiceResult(int id,String text,String error){
    if(web==null||isFinishing())return;
    web.evaluateJavascript("typeof window.onJzzxVoiceResult === 'function' && window.onJzzxVoiceResult("+id+","+JSONObject.quote(text)+","+JSONObject.quote(error)+")",null);
  }

  private final class NativeVoice{
    @JavascriptInterface public void start(int id){
      if(id<=0)return;
      runOnUiThread(()->{
        if(web==null||isFinishing())return;
        if(pendingVoiceId!=0){deliverVoiceResult(id,"","请先完成当前语音输入。");return;}
        Intent intent=new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE,"zh-CN");
        intent.putExtra(RecognizerIntent.EXTRA_PROMPT,"请说出您想咨询的政务问题");
        intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS,1);
        pendingVoiceId=id;
        try{startActivityForResult(intent,VOICE_REQUEST_CODE);}
        catch(Exception e){
          pendingVoiceId=0;
          deliverVoiceResult(id,"","手机没有可用的系统语音识别服务，请使用输入法麦克风。");
        }
      });
    }
  }

  @Override protected void onActivityResult(int requestCode,int resultCode,Intent data){
    super.onActivityResult(requestCode,resultCode,data);
    if(requestCode!=VOICE_REQUEST_CODE)return;
    int id=pendingVoiceId;
    pendingVoiceId=0;
    if(id<=0)return;
    ArrayList<String> texts=data==null?null:data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
    String text=resultCode==RESULT_OK&&texts!=null&&!texts.isEmpty()?texts.get(0):"";
    if(text==null)text="";
    text=text.trim();
    deliverVoiceResult(id,text.substring(0,Math.min(text.length(),180)),text.isEmpty()?"系统语音服务没有返回识别文字，可使用输入法麦克风。":"");
  }

  @Override public void onRequestPermissionsResult(int requestCode,String[] permissions,int[] grantResults){
    super.onRequestPermissionsResult(requestCode,permissions,grantResults);
    if(requestCode!=AUDIO_PERMISSION_REQUEST_CODE)return;
    PermissionRequest pending=pendingPermissionRequest;
    pendingPermissionRequest=null;
    if(pending==null)return;
    if(grantResults.length>0&&grantResults[0]==PackageManager.PERMISSION_GRANTED){
      pending.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
    }else{
      pending.deny();
    }
  }

  @Override public void onBackPressed(){
    if(web==null){super.onBackPressed();return;}
    web.evaluateJavascript("typeof window.onNativeBack === 'function' && window.onNativeBack()",result->{
      if(!"true".equals(result))super.onBackPressed();
    });
  }

  @Override protected void onDestroy(){
    pendingVoiceId=0;
    pendingPermissionRequest=null;
    if(web!=null){
      web.removeJavascriptInterface("JZZXNativeVoice");
      web.destroy();
      web=null;
    }
    super.onDestroy();
  }
}
