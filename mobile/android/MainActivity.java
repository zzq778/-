package cn.jzzx.travel.online;

import android.app.Activity;
import android.os.Bundle;
import android.graphics.Color;
import android.content.Intent;
import android.net.Uri;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.speech.tts.TextToSpeech;
import android.speech.RecognizerIntent;
import org.json.JSONObject;
import java.util.ArrayList;
import android.widget.Toast;
import android.util.Base64;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

/** Trusted bundled UI. External navigation opens in the browser; native interfaces only offer
 * user-mediated document export and speech, with no arbitrary file reads or credential access. */
public final class MainActivity extends Activity {
  private static final String HOST="jizhengzhixing-mobile.zedi-li070614.workers.dev";
  private static final int SAVE_DOCUMENT=701;
  private static final int RECOGNIZE_VOICE=702;
  private static final int MAX_FILE_BYTES=3*1024*1024;
  private WebView web;
  private volatile TextToSpeech tts;
  private volatile boolean speechReady=false;
  private byte[] pendingFile;
  private int voiceRequest=0;
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
    web.addJavascriptInterface(new NativeFiles(),"JZZXNativeFiles");
    web.addJavascriptInterface(new NativeSpeech(),"JZZXNativeSpeech");
    web.addJavascriptInterface(new NativeVoice(),"JZZXNativeVoice");
    tts=new TextToSpeech(this,status->{
      TextToSpeech current=tts;
      if(status==TextToSpeech.SUCCESS&&current!=null){
        int language=current.setLanguage(Locale.SIMPLIFIED_CHINESE);
        speechReady=language!=TextToSpeech.LANG_MISSING_DATA&&language!=TextToSpeech.LANG_NOT_SUPPORTED;
      }
    });
    web.setWebChromeClient(new WebChromeClient());
    web.setWebViewClient(new WebViewClient(){
      @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest request) {
        Uri uri=request.getUrl();
        if(!request.isForMainFrame()){
          if(isLocalFrame(uri))return false;
          if(request.hasGesture())return openExternal(uri);
          return true;
        }
        return openExternal(uri);
      }
      @Override public boolean shouldOverrideUrlLoading(WebView v,String url) {
        Uri uri=Uri.parse(url);return isLocalFrame(uri)?false:openExternal(uri);
      }
    });
    setContentView(web);
    try(InputStream in=getAssets().open("index.html");
        ByteArrayOutputStream out=new ByteArrayOutputStream()){
      byte[] buf=new byte[8192];int n;
      while((n=in.read(buf))!=-1)out.write(buf,0,n);
      web.loadDataWithBaseURL("https://"+HOST+"/",new String(out.toByteArray(),StandardCharsets.UTF_8),"text/html","UTF-8",null);
    }catch(Exception e){
      web.loadDataWithBaseURL(null,"<meta charset=utf-8><p>应用资源读取失败，请重新安装。</p>","text/html","UTF-8",null);
    }
  }
  private boolean isLocalFrame(Uri uri){
    String value=uri.toString();return value.equals("about:srcdoc")||value.equals("about:blank");
  }
  private boolean openExternal(Uri uri){
    String scheme=uri.getScheme();
    if(!"https".equalsIgnoreCase(scheme)&&!"http".equalsIgnoreCase(scheme))return true;
    if(HOST.equalsIgnoreCase(uri.getHost()))return true;
    try{startActivity(new Intent(Intent.ACTION_VIEW,uri));}catch(Exception ignored){toast("无法打开链接");}
    return true;
  }
  private void toast(String text){runOnUiThread(()->Toast.makeText(this,text,Toast.LENGTH_SHORT).show());}
  private static boolean validFile(String mime,byte[] bytes){
    if(bytes.length<1||bytes.length>MAX_FILE_BYTES)return false;
    if("image/png".equals(mime))return bytes.length>=8&&(bytes[0]&255)==137&&bytes[1]==80&&bytes[2]==78&&bytes[3]==71&&bytes[4]==13&&bytes[5]==10&&bytes[6]==26&&bytes[7]==10;
    if("image/jpeg".equals(mime))return bytes.length>=4&&(bytes[0]&255)==255&&(bytes[1]&255)==216&&(bytes[2]&255)==255&&(bytes[bytes.length-2]&255)==255&&(bytes[bytes.length-1]&255)==217;
    return "text/csv".equals(mime);
  }
  private final class NativeFiles{
    @JavascriptInterface public void save(String mime,String name,String base64){
      if(mime==null||name==null||base64==null||base64.length()>MAX_FILE_BYTES*4/3+8){toast("文件过大或格式错误");return;}
      if(!"image/png".equals(mime)&&!"image/jpeg".equals(mime)&&!"text/csv".equals(mime)){toast("不支持该文件类型");return;}
      byte[] bytes;
      try{bytes=Base64.decode(base64,Base64.DEFAULT);}catch(IllegalArgumentException e){toast("文件格式错误");return;}
      if(!validFile(mime,bytes)){toast("文件数据无效");return;}
      String file=name.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]","_");
      String suffix="image/png".equals(mime)?".png":"image/jpeg".equals(mime)?".jpg":".csv";
      if(!file.toLowerCase(Locale.ROOT).endsWith(suffix))file+=suffix;
      if(file.length()>100)file=file.substring(0,100-suffix.length())+suffix;
      final String title=file;
      runOnUiThread(()->{
        if(isFinishing()||pendingFile!=null){toast("请先完成当前保存");return;}
        pendingFile=bytes;
        try{
          Intent pick=new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
            .setType(mime).putExtra(Intent.EXTRA_TITLE,title);
          startActivityForResult(pick,SAVE_DOCUMENT);
        }catch(Exception e){pendingFile=null;toast("无法打开系统保存窗口");}
      });
    }
  }
  private void voiceResult(int id,String text,String error){
    if(web!=null&&!isFinishing())web.evaluateJavascript("typeof window.onJzzxVoiceResult === 'function' && window.onJzzxVoiceResult("+id+","+JSONObject.quote(text)+","+JSONObject.quote(error)+")",null);
  }
  private final class NativeVoice {
    @JavascriptInterface public void start(int id){
      if(id<=0)return;
      runOnUiThread(()->{
        if(isFinishing()||web==null)return;
        if(voiceRequest!=0){voiceResult(id,"","请先结束当前语音输入。");return;}
        Intent intent=new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE,"zh-CN");
        intent.putExtra(RecognizerIntent.EXTRA_PROMPT,"请说出想咨询的问题");
        intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS,1);
        voiceRequest=id;
        try{startActivityForResult(intent,RECOGNIZE_VOICE);}
        catch(Exception e){voiceRequest=0;voiceResult(id,"","手机未安装可用的语音识别服务，请使用输入法语音输入。");}
      });
    }
  }
  @Override protected void onActivityResult(int request,int result,Intent data){
    super.onActivityResult(request,result,data);
    if(request==RECOGNIZE_VOICE){
      int id=voiceRequest;voiceRequest=0;if(id<=0)return;
      ArrayList<String> results=data==null?null:data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
      String text=result==RESULT_OK&&results!=null&&!results.isEmpty()?results.get(0):"";
      if(text==null)text="";
      voiceResult(id,text.substring(0,Math.min(text.length(),600)),text.isEmpty()?"语音输入已结束，未识别到内容。":"");return;
    }
    if(request!=SAVE_DOCUMENT)return;
    byte[] bytes=pendingFile;pendingFile=null;
    if(result!=RESULT_OK||data==null||data.getData()==null||bytes==null){toast("未保存文件");return;}
    final Uri uri=data.getData();
    new Thread(()->{
      try(OutputStream out=getContentResolver().openOutputStream(uri,"w")){
        if(out==null)throw new IllegalStateException("No document stream");
        out.write(bytes);out.flush();toast("文件已保存");
      }catch(Exception e){toast("保存失败，请检查存储位置");}
    },"jzzx-export").start();
  }
  private final class NativeSpeech{
    @JavascriptInterface public boolean speak(String text){
      TextToSpeech current=tts;
      if(!speechReady||current==null||text==null||text.trim().isEmpty()||text.length()>Math.min(3500,TextToSpeech.getMaxSpeechInputLength()))return false;
      try{return current.speak(text,TextToSpeech.QUEUE_FLUSH,null,"jzzx-itinerary")==TextToSpeech.SUCCESS;}catch(Exception e){return false;}
    }
    @JavascriptInterface public boolean isSpeaking(){TextToSpeech current=tts;return speechReady&&current!=null&&current.isSpeaking();}
    @JavascriptInterface public void stop(){TextToSpeech current=tts;if(current!=null)current.stop();}
  }
  @Override public void onBackPressed(){
    if(web==null){super.onBackPressed();return;}
    TextToSpeech current=tts;if(current!=null)current.stop();
    web.evaluateJavascript("typeof window.onNativeBack === 'function' && window.onNativeBack()", result->{
      if(!"true".equals(result))super.onBackPressed();
    });
  }
  @Override protected void onDestroy(){
    speechReady=false;TextToSpeech current=tts;tts=null;if(current!=null){current.stop();current.shutdown();}
    pendingFile=null;
    if(web!=null){web.removeJavascriptInterface("JZZXNativeFiles");web.removeJavascriptInterface("JZZXNativeSpeech");web.removeJavascriptInterface("JZZXNativeVoice");web.destroy();web=null;}
    super.onDestroy();
  }
}
