import { REGIONS } from './knowledge.mjs';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
const roles=['tourist','merchant','government'];
export const FEEDBACK_CATEGORIES=['服务态度','设施与环境','价格与收费','安全问题','其他'];
const idOk=v=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(v);
const str=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.trim().length<=max?v.trim():null;
const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),x=>x.toString(16).padStart(2,'0')).join('');
function same(a,b){if(a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a.charCodeAt(i)^b.charCodeAt(i);return x===0}
function configured(env){
 if(!env.PORTAL_DB||!env.PORTAL_LIMITER||typeof env.PORTAL_ACTORS!=='string')return null;
 try{
  const actors=JSON.parse(env.PORTAL_ACTORS);
  if(!Array.isArray(actors)||actors.length<1||actors.length>500)return null;
  const ids=new Set(),hashes=new Set();
  for(const a of actors){
   if(!a||!idOk(a.id)||!roles.includes(a.role)||!REGIONS.includes(a.region)||!(/^[a-f0-9]{64}$/.test(a.keyHash||''))||ids.has(a.id)||hashes.has(a.keyHash)||(a.role==='merchant'&&!idOk(a.merchantId)))return null;
   ids.add(a.id);hashes.add(a.keyHash);
  }return actors;
 }catch{return null}
}
async function identity(request,actors){
 const h=request.headers.get('authorization')||'';
 if(!/^Bearer [A-Za-z0-9_-]{32,160}$/.test(h))return null;
 const key=await hash(h.slice(7));let actor=null;
 for(const a of actors){if(same(a.keyHash,key))actor=a}
 return actor;
}
async function payload(request){
 const reader=request.body?.getReader();if(!reader)return null;let length=0,text='';const decoder=new TextDecoder();
 try{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>8192){await reader.cancel();return null}text+=decoder.decode(value,{stream:true})}text+=decoder.decode();const v=JSON.parse(text);return v&&typeof v==='object'&&!Array.isArray(v)?v:null}catch{return null}finally{reader.releaseLock()}
}
const rowFields='f.id,f.merchant_id,m.name AS merchant_name,f.category,f.body,f.created_at';
const scope=a=>a.role==='tourist'?['f.tourist_id=?',[a.id]]:a.role==='merchant'?['f.merchant_id=? AND m.region=?',[a.merchantId,a.region]]:['m.region=?',[a.region]];
async function list(db,a){
 const [where,params]=scope(a);
 const items=(await db.prepare('SELECT '+rowFields+' FROM portal_feedback f JOIN portal_merchants m ON m.id=f.merchant_id WHERE '+where+' ORDER BY f.created_at DESC,f.id DESC LIMIT 50').bind(...params).all()).results;
 const ids=items.map(x=>x.id);
 if(!ids.length)return [];
 const replies=(await db.prepare('SELECT id,feedback_id,actor_role,body,created_at FROM portal_replies WHERE feedback_id IN ('+ids.map(()=>'?').join(',')+') ORDER BY created_at,id').bind(...ids).all()).results;
 return items.map(f=>({...f,replies:replies.filter(r=>r.feedback_id===f.id),status:replies.some(r=>r.feedback_id===f.id)?'answered':'pending'}));
}
async function summarize(db,a){
 const [where,params]=scope(a);
 const rows=(await db.prepare('SELECT f.category,COUNT(*) AS total,SUM(CASE WHEN EXISTS (SELECT 1 FROM portal_replies r WHERE r.feedback_id=f.id) THEN 1 ELSE 0 END) AS answered FROM portal_feedback f JOIN portal_merchants m ON m.id=f.merchant_id WHERE '+where+' GROUP BY f.category').bind(...params).all()).results;
 const categories=FEEDBACK_CATEGORIES.map(category=>{const row=rows.find(x=>x.category===category);const total=Number(row?.total||0),answered=Number(row?.answered||0);return {category,total,answered,pending:total-answered}});
 const total=categories.reduce((n,x)=>n+x.total,0),answered=categories.reduce((n,x)=>n+x.answered,0);
 return {region:a.region,scope:a.role==='merchant'?'当前商户全部反馈':'当前授权地区全部反馈',total,answered,pending:total-answered,categories,asOf:new Date().toISOString()};
}
export function portalReady(env){return !!configured(env)}
export async function handlePortal(request,env,analyze){
 const url=new URL(request.url),action=url.pathname.slice('/api/v1/portal/'.length);
 const origin=request.headers.get('origin');if(origin&&origin!==url.origin)return json({error:'ORIGIN'},403);
 if(action==='status'&&request.method==='GET')return json({ready:portalReady(env)});
 const actors=configured(env);if(!actors)return json({error:'PORTAL_NOT_CONFIGURED'},503);
 try{
  const remote=request.headers.get('cf-connecting-ip')||'unknown';
  if(!(await env.PORTAL_LIMITER.limit({key:'auth:'+remote})).success)return json({error:'RATE_LIMIT'},429);
  const a=await identity(request,actors);if(!a)return json({error:'AUTH_REQUIRED'},401);
  const db=env.PORTAL_DB;
  if(a.role==='merchant'&&!await db.prepare('SELECT id FROM portal_merchants WHERE id=? AND region=? AND active=1').bind(a.merchantId,a.region).first())return json({error:'FORBIDDEN'},403);
  if(action==='me'&&request.method==='GET')return json({id:a.id,role:a.role,region:a.region,merchantId:a.role==='merchant'?a.merchantId:null});
  if(action==='merchants'&&request.method==='GET'){
   if(a.role!=='tourist')return json({error:'FORBIDDEN'},403);
   const items=(await db.prepare('SELECT id,name,region FROM portal_merchants WHERE active=1 AND region=? ORDER BY name LIMIT 100').bind(a.region).all()).results;
   return json({items});
  }
  if(action==='summary'&&request.method==='GET'){
   if(a.role==='tourist')return json({error:'FORBIDDEN'},403);
   return json(await summarize(db,a));
  }
  if(action==='analysis'&&request.method==='POST'){
   if(a.role==='tourist')return json({error:'FORBIDDEN'},403);
   const v=await payload(request),question=str(v?.question,300);
   if(!question||v.confirm!==true)return json({error:'CONFIRMATION_OR_QUESTION_REQUIRED'},400);
   const summary=await summarize(db,a);
   let result={status:'partial',text:'智能分析暂不可用。下方为真实反馈统计。'};
   // Only aggregate data, never identity, raw feedback or credentials, reaches the model.
   if(typeof analyze==='function'&&env.LIMITER&&(await env.LIMITER.limit({key:'portal-analysis:'+a.id})).success){
    try{result=await analyze(env,summary,question)}catch{}
   }
   return json({...result,summary});
  }
  if(action==='feedback'&&request.method==='GET')return json({items:await list(db,a)});
  if(action==='feedback'&&request.method==='POST'){
   if(a.role!=='tourist')return json({error:'FORBIDDEN'},403);
   const v=await payload(request),body=str(v?.text,500);
   if(!body||!idOk(v?.merchantId)||!idOk(v?.requestId)||!FEEDBACK_CATEGORIES.includes(v?.category))return json({error:'INVALID_FEEDBACK'},400);
   const merchant=await db.prepare('SELECT id FROM portal_merchants WHERE id=? AND region=? AND active=1').bind(v.merchantId,a.region).first();
   if(!merchant)return json({error:'MERCHANT_NOT_FOUND'},404);
   const id=crypto.randomUUID(),at=new Date().toISOString();
   await db.prepare('INSERT INTO portal_feedback(id,tourist_id,merchant_id,category,body,created_at,request_id) VALUES(?,?,?,?,?,?,?) ON CONFLICT(tourist_id,request_id) DO NOTHING').bind(id,a.id,v.merchantId,v.category,body,at,v.requestId).run();
   const stored=await db.prepare('SELECT id,merchant_id,category,body FROM portal_feedback WHERE tourist_id=? AND request_id=?').bind(a.id,v.requestId).first();
   if(!stored)return json({error:'WRITE_FAILED'},503);
   if(stored.merchant_id!==v.merchantId||stored.category!==v.category||stored.body!==body)return json({error:'REQUEST_ID_CONFLICT'},409);
   return json({id:stored.id,status:'stored'},stored.id===id?201:200);
  }
  const match=/^feedback\/([a-zA-Z0-9_-]{1,80})\/replies$/.exec(action);
  if(match&&request.method==='POST'){
   if(a.role==='tourist')return json({error:'FORBIDDEN'},403);
   const v=await payload(request),body=str(v?.text,400);if(!body||!idOk(v?.requestId))return json({error:'INVALID_REPLY'},400);
   const [where,params]=scope(a),target=await db.prepare('SELECT f.id FROM portal_feedback f JOIN portal_merchants m ON m.id=f.merchant_id WHERE f.id=? AND '+where).bind(match[1],...params).first();
   if(!target)return json({error:'NOT_FOUND'},404);
   const id=crypto.randomUUID(),at=new Date().toISOString();
   await db.prepare('INSERT INTO portal_replies(id,feedback_id,actor_id,actor_role,body,created_at,request_id) VALUES(?,?,?,?,?,?,?) ON CONFLICT(actor_id,request_id) DO NOTHING').bind(id,target.id,a.id,a.role,body,at,v.requestId).run();
   const stored=await db.prepare('SELECT id,feedback_id,body FROM portal_replies WHERE actor_id=? AND request_id=?').bind(a.id,v.requestId).first();
   if(!stored)return json({error:'WRITE_FAILED'},503);
   if(stored.feedback_id!==target.id||stored.body!==body)return json({error:'REQUEST_ID_CONFLICT'},409);
   return json({id:stored.id,status:'stored'},stored.id===id?201:200);
  }
  return json({error:'NOT_FOUND'},404);
 }catch{return json({error:'PORTAL_UNAVAILABLE'},503)}
}
