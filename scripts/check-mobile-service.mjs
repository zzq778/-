// Public, read-only readiness check; optional authenticated smoke test.
// Never prints credentials or full model responses.
const base=(process.env.MOBILE_SERVICE_BASE||'https://jizhengzhixing-mobile.zedi-li070614.workers.dev').replace(/\/$/,'');
const signal=()=>AbortSignal.timeout(45000);
async function call(path,options={}){
 const r=await fetch(base+path,{...options,redirect:'error',signal:signal()});
 const x=await r.json().catch(()=>null);
 return {status:r.status,data:x};
}
const status=await call('/api/status'),contract=await call('/api/v1/openapi.json');
console.log(JSON.stringify({statusHttp:status.status,version:status.data?.version,ready:status.data?.ready,chatReady:status.data?.chatReady,contractHttp:contract.status,chatRoute:!!contract.data?.paths?.['/api/v1/chat']?.post}));
if(status.status!==200||!status.data?.chatReady||contract.status!==200||!contract.data?.paths?.['/api/v1/chat']?.post){console.error('Mobile chat backend not ready');process.exit(1)}
const code=process.env.TRAVEL_PREVIEW_CODE;
if(code){
 const r=await call('/api/v1/chat',{method:'POST',headers:{'content-type':'application/json',origin:base,authorization:'Bearer '+code},body:JSON.stringify({question:'你好'})});
 console.log(JSON.stringify({authenticatedChatHttp:r.status,status:r.data?.status,hasText:!!r.data?.text,reason:r.data?.reason,failedStep:r.data?.failedStep,toolCount:r.data?.toolCount,version:r.data?.version}));
 if(r.status!==200||!['complete','partial'].includes(r.data?.status)||typeof r.data?.text!=='string'||!r.data.text.trim())process.exit(1);
 const firstText=r.data.text;
 const second=await call('/api/v1/chat',{method:'POST',headers:{'content-type':'application/json',origin:base,authorization:'Bearer '+code},body:JSON.stringify({question:'吉林市有什么好玩的地方？',history:[{role:'user',content:'你好'},{role:'assistant',content:firstText}]})});
 console.log(JSON.stringify({secondChatHttp:second.status,status:second.data?.status,hasText:!!second.data?.text,reason:second.data?.reason,failedStep:second.data?.failedStep,toolCount:second.data?.toolCount,version:second.data?.version,sources:second.data?.sources?.length||0}));
 if(second.status!==200||!['complete','partial'].includes(second.data?.status)||typeof second.data?.text!=='string'||!second.data.text.trim())process.exit(1);
}else console.log('Only route/readiness checked. No authenticated model call (preview secret unavailable).');
