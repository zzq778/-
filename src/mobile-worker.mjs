import { runTravelAgent, PROMPT_VERSION } from './wenlv/travel-agent.mjs';
export const MOBILE_MODEL='@cf/zai-org/glm-4.7-flash';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
async function equalSecret(a,b){
 if(typeof a!=='string'||typeof b!=='string'||a.length>160||b.length<16||b.length>160)return false;
 const h=s=>crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));
 const x=new Uint8Array(await h(a)),y=new Uint8Array(await h(b));
 let diff=0;for(let i=0;i<x.length;i++)diff|=x[i]^y[i];return diff===0;
}
async function readQuestion(request){
 const max=8192;const reader=request.body?.getReader();
 if(!reader)return null;let total=0,buf=[];
 try{for(;;){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>max){await reader.cancel();return null;}buf.push(value);}}
 finally{reader.releaseLock();}
 const all=new Uint8Array(total);let i=0;for(const b of buf){all.set(b,i);i+=b.length;}
 try{
  const x=JSON.parse(new TextDecoder().decode(all));
  const question=typeof x.question==='string'?x.question.trim():'';
  if(!question||question.length>300)return null;
  const history=Array.isArray(x.history)?x.history.slice(-8).filter(m=>m&&['user','assistant'].includes(m.role)&&typeof m.content==='string').map(m=>({role:m.role,content:m.content.trim().slice(0,600)})).filter(m=>m.content):[];
  const previousIntent=x.previousIntent&&typeof x.previousIntent==='object'&&!Array.isArray(x.previousIntent)?x.previousIntent:null;
  return {question,history,previousIntent};
 }catch{return null;}
}
export async function handleMobile(request,env){
 const url=new URL(request.url);
 const ready=!!env.AI&&!!env.LIMITER&&typeof env.TRAVEL_PREVIEW_CODE==='string'&&env.TRAVEL_PREVIEW_CODE.length>=16&&env.TRAVEL_PREVIEW_CODE.length<=160;
 if(url.pathname==='/api/status'&&request.method==='GET')return json({service:'jzzx-mobile',version:'1.0.4',ready,model:MOBILE_MODEL,promptVersion:PROMPT_VERSION});
 if(!url.pathname.startsWith('/api/'))return env.ASSETS.fetch(request);
 if(url.pathname!=='/api/travel'||request.method!=='POST')return json({error:'NOT_FOUND'},404);
 const origin=request.headers.get('origin');if(origin&&origin!==url.origin)return json({error:'ORIGIN'},403);
 if(!ready)return json({error:'SERVER_NOT_READY'},503);
 try{
  const ip=request.headers.get('cf-connecting-ip')||'unknown';
  if(!(await env.LIMITER.limit({key:ip})).success)return json({error:'RATE_LIMIT'},429);
  const header=request.headers.get('authorization')||'';
  if(!header.startsWith('Bearer ')||!await equalSecret(header.slice(7),env.TRAVEL_PREVIEW_CODE))return json({error:'ACCESS_CODE'},401);
  const payload=await readQuestion(request);if(!payload)return json({error:'INVALID_QUESTION'},400);
  const invoke=(messages,tools)=>env.AI.run(MOBILE_MODEL,{messages,tools,tool_choice:'required',parallel_tool_calls:false,max_completion_tokens:450,temperature:.1,chat_template_kwargs:{enable_thinking:false}});
  const outcome=await runTravelAgent({...payload,invoke});
  return json({...outcome,model:MOBILE_MODEL,notice:'候选行程，非实时交通、预约或开放核验。'});
 }catch{return json({error:'SERVICE_ERROR'},503);}
}
export default {fetch:handleMobile};
