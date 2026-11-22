import test from 'node:test';
import assert from 'node:assert/strict';
import { runTravelAgent, PROMPT_VERSION, MAX_TURNS } from '../src/wenlv/travel-agent.mjs';
import { handleApi } from '../src/worker.mjs';
import { handleMobile } from '../src/mobile-worker.mjs';
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
 const seq=[call('search_places'),call('draft_itinerary'),call('review_itinerary'),call('finish')];
 const cloud=await handleApi(req(),{AI:{run:async(_model,options)=>{assert.ok(options.tools.length);return seq[calls++];}},LIMITER:{limit:async()=>({success:true})}});
 assert.equal(cloud.status,200);const data=await cloud.json();assert.equal(data.status,'complete');assert.equal(data.modelCalls,4);assert.equal(data.degraded,false);
});

test('conversation follow-ups retain validated travel constraints and apply new exclusions',async()=>{
 const first=await runTravelAgent({question:'吉林市冬天两天看雾凇',now});
 assert.equal(first.intent.days,2);
 assert.ok(first.intent.areas.includes('吉林市'));
 const follow=await runTravelAgent({question:'第二天不要滑雪',previousIntent:first.intent,now});
 assert.equal(follow.intent.days,2);
 assert.ok(follow.intent.areas.includes('吉林市'));
 assert.ok(follow.intent.exclusions.includes('滑雪'));
 assert.equal(follow.status,'complete');
});
test('conversation history is passed to the model as bounded prior turns',async()=>{
 const history=[{role:'user',content:'吉林市冬天两天看雾凇'},{role:'assistant',content:'已安排雾凇岛和博物馆。'}];
 let first=true;
 const out=await runTravelAgent({question:'第二天安排轻松一点',history,previousIntent:{days:2,areas:['吉林市'],clusters:['wusong'],themes:['雾凇'],companions:[],season:'winter',month:11,exclusions:[]},now,invoke:async(messages,tools)=>{
  if(first){
   first=false;
   assert.equal(messages[1].role,'user');
   assert.match(messages[1].content,/吉林市冬天两天看雾凇/);
   assert.equal(messages[2].role,'assistant');
   assert.match(messages[2].content,/雾凇岛/);
   const current=JSON.parse(messages.at(-1).content);
   assert.equal(current.constraints.days,2);
   assert.ok(current.constraints.areas.includes('吉林市'));
   return call('search_places');
  }
  if(tools.some(t=>t.function.name==='draft_itinerary'))return call('draft_itinerary');
  if(tools.some(t=>t.function.name==='review_itinerary'))return call('review_itinerary');
  return call('finish',{summary:'建议游览雾凇岛和吉林市博物馆，出发前核实开放情况。'});
 }});
 assert.equal(out.status,'complete');
});
test('mobile endpoint forwards prior turns and merges validated travel constraints',async()=>{
 const code='mobile-preview-code-123456';
 const sequence=[call('search_places'),call('draft_itinerary'),call('review_itinerary'),call('finish',{summary:'建议游览雾凇岛和吉林市博物馆，出发前核实开放情况。'})];
 let firstMessages=null;
 const env={TRAVEL_PREVIEW_CODE:code,LIMITER:{limit:async()=>({success:true})},AI:{run:async(_model,options)=>{if(!firstMessages)firstMessages=options.messages;return sequence.shift();}},ASSETS:{fetch:async()=>new Response('asset')}};
 const request=new Request('https://mobile.example/api/travel',{method:'POST',headers:{origin:'https://mobile.example',authorization:'Bearer '+code,'content-type':'application/json'},body:JSON.stringify({question:'第二天不要滑雪',history:[{role:'user',content:'吉林市冬天两天看雾凇'},{role:'assistant',content:'已安排雾凇岛。'}],previousIntent:{days:2,areas:['吉林市'],clusters:['wusong'],themes:['雾凇'],season:'winter',month:11,exclusions:[]}})});
 const response=await handleMobile(request,env);assert.equal(response.status,200);
 const body=await response.json();assert.equal(body.status,'complete');assert.equal(body.intent.days,2);assert.ok(body.intent.areas.includes('吉林市'));assert.ok(body.intent.exclusions.includes('滑雪'));
 assert.equal(firstMessages[1].role,'user');assert.match(firstMessages[1].content,/吉林市冬天两天看雾凇/);assert.equal(firstMessages[2].role,'assistant');
});
test('mobile endpoint rejects an oversized conversation payload',async()=>{
 const code='mobile-preview-code-123456';
 const env={TRAVEL_PREVIEW_CODE:code,LIMITER:{limit:async()=>({success:true})},AI:{run:async()=>{throw Error('must not run')}},ASSETS:{fetch:async()=>new Response('asset')}};
 const response=await handleMobile(new Request('https://mobile.example/api/travel',{method:'POST',headers:{origin:'https://mobile.example',authorization:'Bearer '+code,'content-type':'application/json'},body:JSON.stringify({question:'长春两天',history:[{role:'user',content:'x'.repeat(9000)}]})}),env);
 assert.equal(response.status,400);
});
