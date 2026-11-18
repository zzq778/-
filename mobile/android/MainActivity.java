package cn.jzzx.travel;

import android.app.Activity;
import android.os.Bundle;
import android.graphics.Color;
import android.content.Intent;
import android.net.Uri;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;

/** Local application shell. No Internet permission, no JS-to-native bridge. */
public final class MainActivity extends Activity {
  private WebView web;
  @Override public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    getWindow().setStatusBarColor(Color.rgb(244,247,243));
    getWindow().setNavigationBarColor(Color.WHITE);
    getWindow().getDecorView().setSystemUiVisibility(android.view.View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
    web = new WebView(this);
    web.setBackgroundColor(Color.rgb(244,247,243));
    WebSettings s=web.getSettings();
    s.setJavaScriptEnabled(true);
    s.setDomStorageEnabled(true);
    s.setAllowFileAccess(false);
    s.setAllowContentAccess(false);
    s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
    s.setSupportMultipleWindows(false);
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
      web.loadDataWithBaseURL("https://jzzx-offline.invalid/",new String(out.toByteArray(), StandardCharsets.UTF_8),"text/html","UTF-8",null);
    }catch(Exception e){
      web.loadDataWithBaseURL(null,"<meta charset=utf-8><p>应用资源读取失败，请重新安装。</p>","text/html","UTF-8",null);
    }
  }
  private boolean openExternal(Uri uri){
    String scheme=uri.getScheme();
    if(!"https".equalsIgnoreCase(scheme)&&!"http".equalsIgnoreCase(scheme))return true;
    if("jzzx-offline.invalid".equalsIgnoreCase(uri.getHost()))return true;
    try{startActivity(new Intent(Intent.ACTION_VIEW,uri));}catch(Exception ignored){}
    return true;
  }
  @Override protected void onDestroy(){if(web!=null){web.destroy();web=null;}super.onDestroy();}
}
