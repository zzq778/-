export const IMAGE_MODEL='@cf/black-forest-labs/flux-1-schnell';
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
const validCode=s=>typeof s==='string'&&/^[A-Za-z0-9_-]{32,160}$/.test(s);
async function codeEqual(a,b){if(!validCode(a)||!validCode(b))return false;const h=async s=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));const x=await h(a),y=await h(b);let d=0;for(let i=0;i<x.length;i++)d|=x[i]^y[i];return d===0}
export function imageConfigured(env){return env.IMAGE_GENERATION_ENABLED==='true'&&!!env.AI&&!!env.LIMITER&&validCode(env.IMAGE_ACCESS_CODE)}
async function read(request){
 const reader=request.body?.getReader();if(!reader)return null;
 const decoder=new TextDecoder();let n=0,s='';
 try{for(;;){const {value,done}=await reader.read();if(done)break;n+=value.byteLength;if(n>8192){await reader.cancel();return null}s+=decoder.decode(value,{stream:true})}s+=decoder.decode();return JSON.parse(s)}catch{return null}finally{reader.releaseLock()}
}
export function validJpeg(value){
 if(typeof value!=='string'||value.length<16||value.length>4200000||value.length%4||!/^[A-Za-z0-9+/]+={0,2}$/.test(value))return false;
 try{const bytes=atob(value);return bytes.length>=12&&bytes.charCodeAt(0)===255&&bytes.charCodeAt(1)===216&&bytes.charCodeAt(2)===255&&bytes.charCodeAt(bytes.length-2)===255&&bytes.charCodeAt(bytes.length-1)===217}catch{return false}
}
export async function handleImage(request,env){
 const url=new URL(request.url),origin=request.headers.get('origin');
 if(origin&&origin!==url.origin)return json({error:'ORIGIN'},403);
 if(url.pathname==='/api/v1/images/status'&&request.method==='GET')return json({ready:imageConfigured(env)});
 if(url.pathname!=='/api/v1/images'||request.method!=='POST')return json({error:'NOT_FOUND'},404);
 if(!imageConfigured(env))return json({error:'IMAGE_NOT_CONFIGURED'},503);
 try{
  if(!(await env.LIMITER.limit({key:'image-auth:'+(request.headers.get('cf-connecting-ip')||'unknown')})).success)return json({error:'RATE_LIMIT'},429);
  const header=request.headers.get('authorization')||'';
  if(!header.startsWith('Bearer ')||!await codeEqual(header.slice(7),env.IMAGE_ACCESS_CODE))return json({error:'AUTH_REQUIRED'},401);
  const input=await read(request),prompt=typeof input?.prompt==='string'?input.prompt.trim():'';
  if(input?.confirm!==true||!prompt||prompt.length>1400)return json({error:'CONFIRMATION_OR_PROMPT_REQUIRED'},400);
  const fullPrompt='Create a clearly illustrative travel marketing visual, not documentary photography, with no fabricated government endorsements, no private personal information, no misleading official marks. '+prompt;
  let timeout;try{
   const output=await Promise.race([env.AI.run(IMAGE_MODEL,{prompt:fullPrompt,steps:4}),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('timeout')),30000)})]);
   if(!validJpeg(output?.image))return json({error:'INVALID_IMAGE_RESPONSE'},502);
   return json({status:'complete',mime:'image/jpeg',base64:output.image,model:IMAGE_MODEL,notice:'AI 生成宣传素材，非真实景区摄影；发布前请人工审核。'});
  }finally{clearTimeout(timeout)}
 }catch{return json({error:'IMAGE_UNAVAILABLE'},503)}
}
