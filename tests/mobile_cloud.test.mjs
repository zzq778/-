import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
import {handleMobile,MOBILE_MODEL} from '../src/mobile-worker.mjs';

const ORIGIN='https://jizhengzhixing-mobile.zedi-li070614.workers.dev';
const CODE='test-team-code-123456';
const QUESTION='吉林市冬天两天看雾凇，不想滑雪';
function modelCall(name,args={},id=name){
 return {choices:[{message:{tool_calls:[{id,type:'function',function:{name,arguments:JSON.stringify(args)}}]}}]};
}
function env(){
 const observed=[];
 const sequence=[modelCall('search_places'),modelCall('inspect_place',{id:'wusongdao'}),modelCall('draft_itinerary',{ids:['wusongdao','jilin-bowuguan']}),modelCall('review_itinerary'),modelCall('finish')];
 const binding={AI:{run:async(model,options)=>{
  assert.equal(model,MOBILE_MODEL);
  assert.equal(options.tool_choice,'required');
  assert.equal(options.parallel_tool_calls,false);
  assert.ok(options.max_completion_tokens<=450);
  observed.push(options);
  const result=sequence[observed.length-1];if(!result)throw Error('too many calls');
  assert.ok(options.tools.some(t=>t.function.name===result.choices[0].message.tool_calls[0].function.name));
  return result;
 }},LIMITER:{limit:async()=>({success:true})},TRAVEL_PREVIEW_CODE:CODE};
 return {binding,observed};
}
function req(question=QUESTION,code=CODE,origin=ORIGIN){
 return new Request(ORIGIN+'/api/travel',{method:'POST',headers:{'content-type':'application/json','authorization':'Bearer '+code,origin},body:JSON.stringify({question})});
}
test('configuration health does not call any model and missing configuration denies generation',async()=>{
 const e=env();const status=await handleMobile(new Request(ORIGIN+'/api/status'),e.binding);
 assert.equal((await status.json()).ready,true);assert.equal(e.observed.length,0);
 delete e.binding.TRAVEL_PREVIEW_CODE;
 assert.equal((await handleMobile(req(),e.binding)).status,503);
 assert.equal(e.observed.length,0);
});
test('cross-origin, incorrect password, oversized payload and rate limit never call AI',async()=>{
 const e=env();
 assert.equal((await handleMobile(req(QUESTION,CODE,'https://evil.test'),e.binding)).status,403);
 assert.equal((await handleMobile(req(QUESTION,'bad-code'),e.binding)).status,401);
 assert.equal((await handleMobile(req('长'.repeat(2000)),e.binding)).status,400);
 assert.equal((await handleMobile(req(''),e.binding)).status,400);
 e.binding.LIMITER={limit:async()=>({success:false})};
 assert.equal((await handleMobile(req(),e.binding)).status,429);assert.equal(e.observed.length,0);
});
test('mobile HTTP API drives model tools and passes real observations',async()=>{
 const e=env();const response=await handleMobile(req(),e.binding);assert.equal(response.status,200);
 const result=await response.json();assert.equal(result.status,'complete');assert.equal(result.degraded,false);
 assert.equal(result.modelActions,5);assert.equal(result.modelCalls,5);
 assert.deepEqual(result.trace.map(t=>t.tool),['search_places','inspect_place','draft_itinerary','review_itinerary','finish']);
 const places=result.itinerary.plan.flatMap(d=>d.nodes).map(n=>n.attractionId).sort();
 assert.deepEqual(places,['jilin-bowuguan','wusongdao']);
 assert.match(e.observed[2].messages.at(-1).content,/雾凇岛/);
 assert.equal(JSON.parse(e.observed[4].messages.at(-1).content).ok,true);
 assert.equal(response.headers.get('cache-control'),'no-store');
});
test('provider error remains explicitly degraded, not claimed as completed AI',async()=>{
 const e=env();e.binding.AI.run=async()=>{throw Error('provider unavailable');};
 const r=await handleMobile(req(),e.binding);const body=await r.json();
 assert.equal(body.status,'complete');assert.equal(body.degraded,true);assert.equal(body.reason,'model-error');
});
function browser(origin,fetch){
 const store={},handlers={},els=Object.fromEntries(['#screen','#out','#agentLive','#q','#result','#clarification','#planner button[type=submit]'].map(s=>[s,{innerHTML:'',value:'',hidden:false,disabled:false,scrollIntoView(){},focus(){}}]));
 const doc={querySelector:s=>els[s]||null,querySelectorAll:()=>[],addEventListener:(k,v)=>{handlers[k]=v},body:{classList:{toggle(){}}}};
 const box=createContext({console,location:{origin},document:doc,window:{scrollTo(){}},localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=v},removeItem:k=>delete store[k]},fetch,AbortController,setTimeout,clearTimeout,requestAnimationFrame:f=>f(),alert(){}});
 const html=readFileSync(new URL('../mobile/site/index.html',import.meta.url),'utf8');
 for(const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g))runInContext(m[1],box);
 return {box,store,els,handlers};
}
test('actual bundled UI connects to the isolated Worker and preserves results on connection loss',async()=>{
 const e=env();let request,offline=false;
 const b=browser(ORIGIN,async(url,opts)=>{request={url,opts};if(offline)throw new TypeError('network');return handleMobile(new Request(url,opts),e.binding);});
 assert.match(b.els['#screen'].innerHTML,/团队访问码/);
 runInContext('accessCode='+JSON.stringify(CODE),b.box);
 await runInContext('runCloud('+JSON.stringify(QUESTION)+',null)',b.box);
 assert.equal(request.url,ORIGIN+'/api/travel');assert.equal(request.opts.headers.authorization,'Bearer '+CODE);
 assert.match(b.els['#out'].innerHTML,/云端 AI · 已完成多轮工具调用/);
 assert.match(b.els['#out'].innerHTML,/雾凇岛/);assert.match(b.els['#out'].innerHTML,/模型选择/);
 const first=runInContext('JSON.stringify(plan.nodes)',b.box);
 offline=true;await runInContext('runCloud("长春一天",null)',b.box);
 assert.equal(runInContext('JSON.stringify(plan.nodes)',b.box),first);
 assert.match(b.els['#out'].innerHTML,/未能连接云服务/);
 assert.equal(Object.values(b.store).some(v=>String(v).includes(CODE)),false);
});
test('offline app uses the actual local pipeline without contacting the cloud',()=>{
 let calls=0;const b=browser('null',()=>{calls++;throw Error('not allowed');});
 assert.equal(runInContext('mode',b.box),'local');
 runInContext('runAgent('+JSON.stringify(QUESTION)+')',b.box);
 assert.match(b.els['#out'].innerHTML,/本地 Agent/);assert.equal(calls,0);
});
