import { REGIONS, relevantTopics, actionBundle, buildSystemPrompt } from './knowledge.mjs';

const MODEL = '@cf/zai-org/glm-4.7-flash';
const JSON_HEADERS = { 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store', 'x-content-type-options':'nosniff' };
const reply = (data,status=200) => new Response(JSON.stringify(data),{status,headers:JSON_HEADERS});
const clamp = (text,max) => typeof text==='string' ? text.trim().slice(0,max) : '';

export async function handleApi(request,env) {
  const url = new URL(request.url);
  if (url.pathname === '/api/status' && request.method==='GET') {
    return reply({ ready:!!env.AI, provider:'Cloudflare Workers AI', mode:env.AI?'live':'unconfigured', model:MODEL });
  }
  if (url.pathname !== '/api/chat') return reply({ error:'NOT_FOUND',message:'接口不存在' },404);
  if (request.method !== 'POST') return reply({ error:'METHOD_NOT_ALLOWED',message:'仅支持 POST' },405);
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return reply({error:'CONTENT_TYPE',message:'请发送 JSON 请求'},415);
  // 此 API 只供同源前端调用，不对跨站网页开放。该检查不能代替用户鉴权。
  const origin = request.headers.get('origin');
  if (origin && origin !== url.origin) return reply({error:'ORIGIN',message:'不接受跨站请求'},403);
  if (Number(request.headers.get('content-length')||'0') > 6000) return reply({error:'TOO_LARGE',message:'请求过长'},413);
  let payload;
  try { const raw=await request.text(); if(raw.length>6000) return reply({error:'TOO_LARGE',message:'请求过长'},413);payload=JSON.parse(raw); } catch { return reply({error:'BAD_JSON',message:'请求格式不正确'},400); }
  const question=clamp(payload?.question,300), region=REGIONS.includes(payload?.region)?payload.region:'长春市';
  if (!question) return reply({error:'EMPTY',message:'请输入政务问题'},400);
  if (question.length<1) return reply({error:'EMPTY',message:'请输入政务问题'},400);
  if (!env.AI) return reply({error:'NO_AI',message:'云端 AI 尚未启用，请先部署 Cloudflare AI 绑定'},503);
  if(env.LIMITER){
    const ip=request.headers.get('cf-connecting-ip')||'unknown';
    const limit=await env.LIMITER.limit({key:ip});
    if(!limit.success) return reply({error:'RATE_LIMIT',message:'提问过于频繁，请稍后再试'},429);
  }
  const history = Array.isArray(payload?.history) ? payload.history.slice(-4).filter(x=>x&&['user','assistant'].includes(x.role)&&typeof x.content==='string').map(x=>({role:x.role,content:clamp(x.content,400)})).filter(x=>x.content) : [];
  const topics = relevantTopics(question);
  const {actions,sources}=actionBundle(topics);
  const messages = [ {role:'system',content:buildSystemPrompt(region,topics)}, ...history, {role:'user',content:question} ];
  try {
    const result = await env.AI.run(MODEL,{messages,max_completion_tokens:900,temperature:0.25,chat_template_kwargs:{enable_thinking:false}});
    const text = (typeof result?.response==='string' ? result.response : typeof result?.output_text==='string' ? result.output_text : typeof result?.choices?.[0]?.message?.content==='string' ? result.choices[0].message.content : '').trim();
    if (!text) return reply({error:'EMPTY_AI',message:'模型未返回有效回答，请重试'},502);
    return reply({text,region,model:MODEL,actions,sources,disclaimer:'学生竞赛项目 · 具体政策及办理要求请以官方渠道为准'});
  } catch(e) {
    // 避免把上游服务内部错误、账户信息回传给客户端
    console.error('Workers AI request failed', e?.name||'AIError');
    return reply({error:'AI_UNAVAILABLE',message:'云端 AI 暂时不可用，请稍后重试或使用下方官方入口',actions,sources},503);
  }
}

export default {
  async fetch(request, env) {
    const path=new URL(request.url).pathname;
    if(path.startsWith('/api/')) return handleApi(request,env);
    return env.ASSETS.fetch(request);
  }
};
