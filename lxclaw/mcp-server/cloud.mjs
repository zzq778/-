const BASE='https://jizhengzhixing-mobile.zedi-li070614.workers.dev';
export function cloudClient(env=process.env,fetcher=globalThis.fetch){
 const credentials={portal:env.JZZX_PORTAL_CODE,chat:env.JZZX_AGENT_CODE||env.JZZX_PREVIEW_CODE,image:env.JZZX_IMAGE_CODE};
 const paths={
  status:'/api/status',portalStatus:'/api/v1/portal/status',imageStatus:'/api/v1/images/status',
  me:'/api/v1/portal/me',merchants:'/api/v1/portal/merchants',feedback:'/api/v1/portal/feedback',summary:'/api/v1/portal/summary',chat:'/api/v1/chat',image:'/api/v1/images'
 };
 async function request(action,body,id){
  const path=action==='reply'&&/^[A-Za-z0-9_-]{1,80}$/.test(id||'')?'/api/v1/portal/feedback/'+id+'/replies':paths[action];
  if(!path)throw Error('UNKNOWN_ENDPOINT');
  const kind=action==='chat'?'chat':action==='image'?'image':['status','portalStatus','imageStatus'].includes(action)?null:'portal';
  const token=kind?credentials[kind]:null;
  if(kind&&!token)throw Error('MISSING_'+kind.toUpperCase()+'_CREDENTIAL');
  const r=await fetcher(BASE+path,{method:body?'POST':'GET',headers:{accept:'application/json',...(token?{authorization:'Bearer '+token}:{}),...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(48000)});
  const reader=r.body?.getReader();if(!reader)throw Error('EMPTY_RESPONSE');
  const chunks=[];let size=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>5_000_000){await reader.cancel();throw Error('RESPONSE_TOO_LARGE')}chunks.push(Buffer.from(value))}}finally{reader.releaseLock()}
  let data;try{data=JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{throw Error('INVALID_RESPONSE')}
  if(!r.ok)throw Error('HTTP_'+r.status+'_'+(/^[A-Z0-9_-]{1,80}$/.test(data?.error||'')?data.error:'SERVICE_ERROR'));
  return data;
 }
 return {request,configured:{portal:!!credentials.portal,chat:!!credentials.chat,image:!!credentials.image}};
}
