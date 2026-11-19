(()=>{
'use strict';
const handler=window.webkit?.messageHandlers?.jzzx;
if(!handler)return;
Object.defineProperty(window,'JZZXMac',{value:true,writable:false});
const original=window.fetch.bind(window);
const host='https://jizhengzhixing-mobile.zedi-li070614.workers.dev';
const local='jzzx://app';
if(typeof AbortSignal.timeout!=='function')AbortSignal.timeout=ms=>{const c=new AbortController();setTimeout(()=>c.abort(),ms);return c.signal};
if(typeof crypto.randomUUID!=='function')crypto.randomUUID=()=>{const a=crypto.getRandomValues(new Uint8Array(16));a[6]=a[6]&15|64;a[8]=a[8]&63|128;const h=[...a].map(x=>x.toString(16).padStart(2,'0')).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20)};
window.fetch=async function(input,opts={}){
 const raw=typeof input==='string'?input:input instanceof URL?input.href:input.url;
 let path;
 if(raw.startsWith('/api/'))path=raw;
 else if(raw.startsWith(host+'/api/'))path=raw.slice(host.length);
 else if(raw.startsWith(local+'/api/'))path=raw.slice(local.length);
 else throw new TypeError('External requests are not available in this application');
 const signal=opts.signal;
 if(signal?.aborted)throw new DOMException('Aborted','AbortError');
 const headers=new Headers(opts.headers);
 const request=handler.postMessage({action:'api',path,method:String(opts.method||'GET').toUpperCase(),authorization:headers.get('authorization')||'',body:typeof opts.body==='string'?opts.body:''});
 let abort;
 try{
  const response=signal?await Promise.race([request,new Promise((_,reject)=>{abort=()=>reject(new DOMException('Aborted','AbortError'));signal.addEventListener('abort',abort,{once:true});})]):await request;
  return new Response(response.body,{status:response.status,headers:{'content-type':'application/json'}});
 }finally{if(abort)signal?.removeEventListener('abort',abort)}
};
window.JZZXNativeFiles={save(mime,name,base64){handler.postMessage({action:'save',mime,name,base64}).catch(()=>{});}};
})();