package cn.jzzx.travel.online;

import android.app.Activity;
import android.os.Bundle;
import android.graphics.Color;
import android.content.Intent;
import android.net.Uri;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.speech.RecognizerIntent;
import org.json.JSONObject;
import java.util.ArrayList;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;

/** Hybrid application shell. Only a user-visible Android speech recognition action is exposed to the bundled UI. */
public final class MainActivity extends Activity {
  private static final int VOICE_REQUEST_CODE=702;
  private WebView web;
  private int pendingVoiceId=0;
  @Override public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    getWindow().setStatusBarColor(Color.rgb(250,249,245));
    getWindow().setNavigationBarColor(Color.WHITE);
    int bars=android.view.View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
    if(android.os.Build.VERSION.SDK_INT>=26)bars|=android.view.View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
    getWindow().getDecorView().setSystemUiVisibility(bars);
    web = new WebView(this);
    web.setBackgroundColor(Color.rgb(250,249,245));
    WebSettings s=web.getSettings();
    s.setJavaScriptEnabled(true);
    s.setDomStorageEnabled(true);
    s.setAllowFileAccess(false);
    s.setAllowContentAccess(false);
    s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
    s.setSupportMultipleWindows(false);
    s.setJavaScriptCanOpenWindowsAutomatically(false);
    s.setAllowFileAccessFromFileURLs(false);
    s.setAllowUniversalAccessFromFileURLs(false);
    web.addJavascriptInterface(new NativeVoice(),"JZZXNativeVoice");
    web.setWebChromeClient(new WebChromeClient());
    web.setWebViewClient(new WebViewClient(){
      @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest request) {
        return openExternal(request.getUrl());
      }
      @Override public boolean shouldOverrideUrlLoading(WebView v,String url) {
        return openExternal(Uri.parse(url));
      }
    });
    setContentView(web);
    try(InputStream in=getAssets().open("index.html");
        ByteArrayOutputStream out=new ByteArrayOutputStream()){
      byte[] buf=new byte[8192];int n;
      while((n=in.read(buf))!=-1)out.write(buf,0,n);
      web.loadDataWithBaseURL("https://jizhengzhixing-mobile.zedi-li070614.workers.dev/",new String(out.toByteArray(), StandardCharsets.UTF_8),"text/html","UTF-8",null);
    }catch(Exception e){
      web.loadDataWithBaseURL(null,"<meta charset=utf-8><p>应用资源读取失败，请重新安装。</p>","text/html","UTF-8",null);
    }
  }
  private boolean openExternal(Uri uri){
    String scheme=uri.getScheme();
    if(!"https".equalsIgnoreCase(scheme)&&!"http".equalsIgnoreCase(scheme))return true;
    if("jizhengzhixing-mobile.zedi-li070614.workers.dev".equalsIgnoreCase(uri.getHost()))return true;
    try{startActivity(new Intent(Intent.ACTION_VIEW,uri));}catch(Exception ignored){}
    return true;
  }
  private void deliverVoiceResult(int id,String text,String error){
    if(web==null||isFinishing())return;
    web.evaluateJavascript("typeof window.onJzzxVoiceResult === 'function' && window.onJzzxVoiceResult("+id+","+JSONObject.quote(text)+","+JSONObject.quote(error)+")",null);
  }
  private final class NativeVoice {
    @JavascriptInterface public void start(int id){
      if(id<=0)return;
      runOnUiThread(()->{
        if(web==null||isFinishing())return;
        if(pendingVoiceId!=0){deliverVoiceResult(id,"","请先完成当前语音输入。");return;}
        Intent intent=new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE,"zh-CN");
        intent.putExtra(RecognizerIntent.EXTRA_PROMPT,"请说出您的出行需求");
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
    int id=pendingVoiceId;pendingVoiceId=0;
    if(id<=0)return;
    ArrayList<String> texts=data==null?null:data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
    String text=resultCode==RESULT_OK&&texts!=null&&!texts.isEmpty()?texts.get(0):"";
    if(text==null)text="";
    text=text.trim();
    deliverVoiceResult(id,text.substring(0,Math.min(text.length(),180)),text.isEmpty()?"语音输入已结束，未识别到内容。":"");
  }
  @Override public void onBackPressed(){
    if(web==null){super.onBackPressed();return;}
    web.evaluateJavascript("typeof window.onNativeBack === 'function' && window.onNativeBack()", result->{
      if(!"true".equals(result))super.onBackPressed();
    });
  }
  @Override protected void onDestroy(){pendingVoiceId=0;if(web!=null){web.removeJavascriptInterface("JZZXNativeVoice");web.destroy();web=null;}super.onDestroy();}
}
