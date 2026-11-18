import test from 'node:test';
import assert from 'node:assert/strict';
import { runTravelAgent, PROMPT_VERSION, MAX_TURNS } from '../src/wenlv/travel-agent.mjs';
import { handleApi } from '../src/worker.mjs';
const now=new Date('2026-11-18T12:00:00Z');
const call=(name,args={},id='test')=>({choices:[{message:{tool_calls:[{id,type:'function',function:{name,arguments:JSON.stringify(args)}}]}}]});
test('model chooses actual tools, receives observations and controls selected nodes',async()=>{
 let n=0;
 const res=await runTravelAgent({question:'吉林市冬天两天看雾凇，不想滑雪',now,invoke:async(messages,tools)=>{
  n++;
  const names=tools.map(t=>t.function.name);
  if(n===1)return call('search_places',{},'s');
  if(n===2){const last=JSON.parse(messages.at(-1).content);assert.ok(last.attractions.every(a=>a.area==='吉林市'));assert.ok(last.attractions.some(a=>a.id==='wusongdao'));assert.ok(names.includes('inspect_place'));return call('inspect_place',{id:'wusongdao'},'i');}
  if(n===3){assert.equal(JSON.parse(messages.at(-1).content).name,'雾凇岛');return call('draft_itinerary',{ids:['wusongdao','jilin-bowuguan']},'d');}
  if(n===4){assert.ok(names.includes('review_itinerary'));return call('review_itinerary',{},'r');}
  assert.equal(JSON.parse(messages.at(-1).content).ok,true);
  return call('finish',{summary:'建议游览雾凇岛和吉林市博物馆，出发前核实开放情况。'},'f');
 }});
 assert.equal(res.status,'complete');assert.equal(res.degraded,false);assert.equal(res.modelCalls,5);assert.equal(res.modelActions,5);assert.equal(res.promptVersion,PROMPT_VERSION);
 assert.deepEqual(res.trace.map(t=>t.tool),['search_places','inspect_place','draft_itinerary','review_itinerary','finish']);
 assert.deepEqual(res.itinerary.plan.flatMap(d=>d.nodes).map(n=>n.attractionId).sort(),['jilin-bowuguan','wusongdao']);
});
test('a model can ask for a genuinely missing condition',async()=>{
 const out=await runTravelAgent({question:'想旅行',now,invoke:async()=>call('ask_user',{field:'destination'})});
 assert.equal(out.status,'clarify');assert.equal(out.questionField,'destination');assert.equal(out.modelActions,1);assert.equal(out.itinerary,null);
 const local=await runTravelAgent({question:'长春旅行',now});
 assert.equal(local.status,'clarify');assert.equal(local.questionField,'days');assert.equal(local.degraded,true);
});
test('unknown place ID and premature finish are rejected',async()=>{
 let n=0;
 const out=await runTravelAgent({question:'长春市一天',now,invoke:async()=>++n===1?call('search_places'):call('draft_itinerary',{ids:['made-up']})});
 assert.equal(out.reason,'unknown-id');assert.equal(out.status,'complete');assert.ok(out.degraded);
 const early=await runTravelAgent({question:'长春一天',now,invoke:async()=>call('finish')});
 assert.equal(early.reason,'invalid-tool');assert.ok(early.degraded);
});
test('provider fault and exhausted hard constraints have explicit results',async()=>{
 const fault=await runTravelAgent({question:'吉林市两天，不想滑雪',now,invoke:async()=>{throw Error('provider error')}});
 assert.equal(fault.status,'complete');assert.equal(fault.reason,'model-error');assert.ok(fault.degraded);
 const empty=await runTravelAgent({question:'辽源市三天，不去辽源矿工墓陈列馆',now});
 assert.equal(empty.status,'no-match');assert.equal(empty.itinerary,null);
});
test('model re-plans after reviewing a draft with a different allowed selection',async()=>{
 const seq=[call('search_places'),call('draft_itinerary',{ids:['weimanhuanggong']}),call('review_itinerary'),call('draft_itinerary',{ids:['jingyuetan']}),call('review_itinerary'),call('finish')];
 let i=0;
 const result=await runTravelAgent({question:'长春市一天',now,invoke:async()=>seq[i++]});
 assert.equal(result.status,'complete');assert.equal(result.modelActions,MAX_TURNS);assert.equal(result.degraded,false);
 assert.deepEqual(result.itinerary.plan.flatMap(d=>d.nodes).map(n=>n.attractionId),['jingyuetan']);
});
test('Worker endpoint gates model by limiter and supports local agent without AI',async()=>{
 const question='长春市一天';
 const req=()=>new Request('https://example.com/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({mode:'wenlv-agent',question})});
 let calls=0;
 const local=await handleApi(req(),{AI:{run:async()=>{calls++;throw Error('must not call')} }});
 assert.equal(local.status,200);const body=await local.json();assert.equal(body.status,'complete');assert.equal(body.modelCalls,0);assert.equal(calls,0);
 const seq=[call('draft_itinerary',{ids:[]})];
 const cloud=await handleApi(req(),{AI:{run:async(_model,options)=>{assert.ok(options.tools.length);return seq[calls++];}},LIMITER:{limit:async()=>({success:true})}});
 assert.equal(cloud.status,200);const data=await cloud.json();assert.equal(data.status,'complete');assert.equal(data.modelCalls,1);assert.equal(data.degraded,false);
});

test('compact planner uses one real selection; deterministic search and audit stay authoritative',async()=>{let n=0;const r=await runTravelAgent({question:'吉林市冬天两天看雾凇，不想滑雪',now,compact:true,invoke:async(messages,tools)=>{n++;assert.equal(tools.length,1);assert.equal(tools[0].function.name,'draft_itinerary');assert.match(messages.at(-1).content,/雾凇岛/);return call('draft_itinerary',{ids:['wusongdao','jilin-bowuguan']})}});assert.equal(n,1);assert.equal(r.degraded,false);assert.equal(r.modelActions,1);assert.equal(r.itinerary.days,2);assert.deepEqual(r.trace.map(t=>t.actor),['system','model','system','system']);const bad=await runTravelAgent({question:'吉林市两天',now,compact:true,invoke:async()=>call('draft_itinerary',{ids:['not-real']})});assert.equal(bad.degraded,true);assert.equal(bad.reason,'unknown-id');});
