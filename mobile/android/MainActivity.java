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
import android.media.MediaRecorder;
import android.os.SystemClock;
import android.provider.Settings;
import java.io.File;
import java.io.FileInputStream;
import java.net.URL;
import javax.net.ssl.HttpsURLConnection;
import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import org.json.JSONObject;
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
  private static final String HOST="jizhengzhixing-mobile-preview.zedi-li070614.workers.dev";
  private static final int SAVE_DOCUMENT=701;
  private static final int VOICE_PERMISSION=703;
  private static final int MAX_FILE_BYTES=3*1024*1024;
  private WebView web;
  private volatile TextToSpeech tts;
  private volatile boolean speechReady=false;
  private byte[] pendingFile;
  private int voiceRequest=0;
  private MediaRecorder voiceRecorder;
  private File voiceAudio;
  private long voiceStartedAt;
  private final Handler voiceHandler=new Handler(Looper.getMainLooper());
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
    web.addJavascriptInterface(new NativeLinks(),"JZZXNativeLinks");
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
    runOnUiThread(()->{
      if(web!=null&&!isFinishing())web.evaluateJavascript("typeof window.onJzzxVoiceResult === 'function' && window.onJzzxVoiceResult("+id+","+JSONObject.quote(text==null?"":text)+","+JSONObject.quote(error==null?"":error)+")",null);
    });
  }
  private void voiceStatus(int id,String message){
    runOnUiThread(()->{
      if(web!=null&&!isFinishing())web.evaluateJavascript("typeof window.onJzzxVoiceStatus === 'function' && window.onJzzxVoiceStatus("+id+","+JSONObject.quote(message)+")",null);
    });
  }
  private final class NativeLinks{
    @JavascriptInterface public void open(String address){
      runOnUiThread(()->{
        if(address==null||address.length()>2000)return;
        Uri uri;
        try{uri=Uri.parse(address);}catch(Exception ignored){return;}
        if(uri.getHost()==null||uri.getUserInfo()!=null)return;
        String scheme=uri.getScheme();
        if(!"http".equalsIgnoreCase(scheme)&&!"https".equalsIgnoreCase(scheme))return;
        openExternal(uri);
      });
    }
  }
  private void releaseVoiceRecording(){
    MediaRecorder current=voiceRecorder;voiceRecorder=null;
    if(current!=null){
      try{current.reset();}catch(Exception ignored){}
      try{current.release();}catch(Exception ignored){}
    }
    File file=voiceAudio;voiceAudio=null;
    if(file!=null)file.delete();
    voiceStartedAt=0L;
  }
  private void completeVoice(int id,String text,String error){
    if(voiceRequest!=id)return;
    voiceRequest=0;voiceHandler.removeCallbacksAndMessages(null);releaseVoiceRecording();
    voiceResult(id,text,error);
  }
  private void startCloudRecording(int id){
    if(voiceRequest!=id||web==null||isFinishing())return;
    try{
      File file=File.createTempFile("jzzx-voice-", ".m4a",getCacheDir());
      MediaRecorder r=new MediaRecorder();
      voiceAudio=file;voiceRecorder=r;
      r.setAudioSource(MediaRecorder.AudioSource.MIC);
      r.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
      r.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
      r.setAudioSamplingRate(16000);
      r.setAudioChannels(1);
      r.setAudioEncodingBitRate(64000);
      r.setOutputFile(file.getAbsolutePath());
      r.prepare();r.start();
      voiceStartedAt=SystemClock.elapsedRealtime();
      voiceStatus(id,"正在录音。再次点击麦克风，发送云端转成文字。");
      voiceHandler.postDelayed(()->{if(voiceRequest==id&&voiceRecorder!=null)finishCloudRecording(id);},15000);
    }catch(Exception e){
      completeVoice(id,"","无法录音。请检查麦克风权限、系统麦克风总开关或使用输入法麦克风。");
    }
  }
  private void finishCloudRecording(int id){
    if(voiceRequest!=id||voiceRecorder==null)return;
    voiceHandler.removeCallbacksAndMessages(null);
    if(SystemClock.elapsedRealtime()-voiceStartedAt<700){
      completeVoice(id,"","录音太短，请说话后再点击结束。");return;
    }
    MediaRecorder r=voiceRecorder;voiceRecorder=null;
    File clip=voiceAudio;voiceAudio=null;
    try{r.stop();}catch(Exception e){
      try{r.release();}catch(Exception ignored){}
      if(clip!=null)clip.delete();
      completeVoice(id,"","录音没有成功，请检查系统麦克风是否开启。");return;
    }
    try{r.release();}catch(Exception ignored){}
    if(clip==null||clip.length()<200||clip.length()>320000){
      if(clip!=null)clip.delete();
      completeVoice(id,"","录音数据无效或过长，请重试。");return;
    }
    voiceStatus(id,"正在通过云端识别语音，请稍候…");
    new Thread(()->{
      String recognized="",error="";
      HttpsURLConnection connection=null;
      try{
        URL endpoint=new URL("https://"+HOST+"/api/v1/transcribe");
        connection=(HttpsURLConnection)endpoint.openConnection();
        connection.setRequestMethod("POST");
        connection.setConnectTimeout(7000);
        connection.setReadTimeout(26000);
        connection.setDoOutput(true);
        connection.setRequestProperty("Content-Type","audio/mp4");
        connection.setFixedLengthStreamingMode((int)clip.length());
        try(FileInputStream source=new FileInputStream(clip);
            OutputStream dest=connection.getOutputStream()){
          byte[] buf=new byte[8192];int n;
          while((n=source.read(buf))!=-1)dest.write(buf,0,n);
        }
        int status=connection.getResponseCode();
        if(status==200){
          try(InputStream result=connection.getInputStream();
              ByteArrayOutputStream data=new ByteArrayOutputStream()){
            byte[] buf=new byte[4096];int n;
            while((n=result.read(buf))!=-1&&data.size()<16000)data.write(buf,0,n);
            JSONObject payload=new JSONObject(new String(data.toByteArray(),StandardCharsets.UTF_8));
            recognized=payload.optString("text","").trim();
            if(recognized.length()>600)recognized=recognized.substring(0,600);
          }
          if(recognized.isEmpty())error="未能识别出文字，请重试或使用输入法麦克风。";
        }else if(status==429)error="语音识别请求过多，请稍后再试。";
        else error="云端语音识别暂不可用（"+status+"），可使用输入法麦克风。";
      }catch(Exception e){
        error="云端语音识别连接失败，请检查网络或使用输入法麦克风。";
      }finally{
        if(connection!=null)connection.disconnect();
        clip.delete();
      }
      final String text=recognized,issue=error;
      runOnUiThread(()->completeVoice(id,text,issue));
    },"jzzx-voice-upload").start();
  }
  private final class NativeVoice {
    @JavascriptInterface public void start(int id){
      if(id<=0)return;
      runOnUiThread(()->{
        if(isFinishing()||web==null)return;
        if(voiceRequest!=0){voiceResult(id,"","请先完成当前语音输入。");return;}
        voiceRequest=id;
        if(android.os.Build.VERSION.SDK_INT>=23&&checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED){
          requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO},VOICE_PERMISSION);
          voiceStatus(id,"请允许吉政知行使用麦克风；录音将发送至云端转文字。");
          return;
        }
        startCloudRecording(id);
      });
    }
    @JavascriptInterface public void finish(int id){
      runOnUiThread(()->finishCloudRecording(id));
    }
    @JavascriptInterface public void stop(int id){
      runOnUiThread(()->{
        if(voiceRequest==id){voiceRequest=0;voiceHandler.removeCallbacksAndMessages(null);releaseVoiceRecording();}
      });
    }
    @JavascriptInterface public void openSettings(){
      runOnUiThread(()->{
        try{
          Intent settings=new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,Uri.parse("package:"+getPackageName()));
          startActivity(settings);
        }catch(Exception ignored){toast("无法打开应用权限设置");}
      });
    }
  }
  @Override public void onRequestPermissionsResult(int requestCode,String[] permissions,int[] grantResults){
    super.onRequestPermissionsResult(requestCode,permissions,grantResults);
    if(requestCode!=VOICE_PERMISSION)return;
    int id=voiceRequest;if(id==0)return;
    if(grantResults.length>0&&grantResults[0]==PackageManager.PERMISSION_GRANTED)startCloudRecording(id);
    else completeVoice(id,"","麦克风权限未开启。请打开应用权限设置，允许麦克风。");
  }
  @Override protected void onActivityResult(int request,int result,Intent data){
    super.onActivityResult(request,result,data);
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
    voiceRequest=0;voiceHandler.removeCallbacksAndMessages(null);releaseVoiceRecording();
    if(web!=null){web.removeJavascriptInterface("JZZXNativeFiles");web.removeJavascriptInterface("JZZXNativeSpeech");web.removeJavascriptInterface("JZZXNativeVoice");web.removeJavascriptInterface("JZZXNativeLinks");web.destroy();web=null;}
    super.onDestroy();
  }
}
