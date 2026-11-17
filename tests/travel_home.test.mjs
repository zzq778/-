import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { answerWenlv } from '../src/wenlv/pipeline.mjs';

const read = p => readFileSync(new URL('../'+p,import.meta.url),'utf8');
function build(){
  const box = createContext({});
  box.window=box;
  runInContext(read('public/wenlv-data.js'),box);
  runInContext(read('public/travel-home.js'),box);
  return {api:box.JZZX_TRAVEL_HOME,catalog:box.WENLV};
}
test('all existing route templates normalize into usable itineraries',()=>{
  const {api,catalog}=build();
  assert.ok(catalog.routes.length>=12);
  for(const route of catalog.routes){
    const p=api.fromRoute(route,catalog);
    assert.ok(p,route.id);
    assert.ok(p.plan.flatMap(d=>d.nodes).length);
  }
});
test('only known attractions, supported slots, unique IDs and contiguous days render',()=>{
  const {api,catalog}=build();
  const id=catalog.attractions[0].id;
  const node={attractionId:id,slot:'上午'};
  for(const malformed of [
    {days:0,plan:[]},
    {days:1,plan:[{day:2,nodes:[node]}]},
    {days:1,plan:[{day:1,nodes:[node,node]}]},
    {days:1,plan:[{day:1,nodes:[{...node,slot:'04:00'}]}]},
    {days:1,plan:[{day:1,nodes:[{attractionId:'made-up',slot:'上午'}]}]}
  ])assert.equal(api.normalizePlan(malformed,catalog),null);
});
test('source links reject impersonation, credentials and unsafe schemes',()=>{
  const {api}=build();
  for(const url of ['javascript://jl.gov.cn','https://jl.gov.cn.evil.test/','https://evil-jl.gov.cn/','https://jl.gov.cn@evil.test/','https://jl.gov.cn\\@evil.test/','https://jl.gov.cn /'])assert.equal(api.safeTravelUrl(url),false,url);
  assert.equal(api.safeTravelUrl('https://whhlyt.jl.gov.cn/'),true);
});
test('saved plan contains only day indices, attraction IDs and slots',()=>{
  const {api,catalog}=build();
  const plan=api.fromRoute(catalog.routes[0],catalog),stored=api.planForStorage(plan);
  assert.equal(Object.keys(stored).sort().join(','),'days,plan');
  for(const day of stored.plan){
    assert.equal(Object.keys(day).sort().join(','),'day,nodes');
    for(const n of day.nodes)assert.equal(Object.keys(n).sort().join(','),'attractionId,slot');
  }
  assert.ok(api.normalizePlan(JSON.parse(JSON.stringify(stored)),catalog));
});
test('natural-language question is not overwritten by default preferences',()=>{
  const {api}=build();
  const defaults={destination:'全省',days:0,companion:'不限',season:'不限'};
  assert.equal(api.composeTravelQuestion('长白山三天',defaults),'长白山三天');
  assert.equal(api.composeTravelQuestion('',defaults),'');
  assert.equal(api.composeTravelQuestion('看雪',{destination:'吉林市',days:2,companion:'亲子',season:'冬'}),'看雪，吉林市，2天，亲子，冬季');
});
test('real planning pipeline without model produces front-end compatible results',async()=>{
  const {api,catalog}=build();
  for(const question of ['冬天到吉林市看雾凇两天','长白山北坡玩两天','长春市亲子一天','延边民俗美食两天','白城观鸟两天','查干湖冬捕一天','集安历史两天','四平红色一天']){
    const result=await answerWenlv({question,now:new Date('2026-11-18T12:00:00Z'),invoke:null});
    assert.equal(result.degraded,true);
    assert.ok(api.normalizePlan(result.itinerary,catalog),question);
  }
});
test('home loads knowledge before planner and application; service worker caches planner',()=>{
  const {api}=build();
  assert.match(api.render('长春市'),/id="travelPlanForm"/);
  assert.match(api.render('长春市'),/文旅协作/);
  const index=read('public/index.html'),sw=read('public/sw.js'),app=read('public/app.js');
  assert.ok(index.indexOf('src="./wenlv-data.js"')<index.indexOf('src="./travel-home.js"'));
  assert.ok(index.indexOf('src="./travel-home.js"')<index.indexOf('src="./app.js"'));
  assert.match(sw,/'\.\/travel-home\.js'/);
  assert.match(sw,/'\.\/travel-home\.css'/);
  assert.match(app,/JZZX_TRAVEL_HOME\.render\(state\.region\)/);
});

test('hard constraints avoid explicit exclusion and unrequested cities', async()=>{
 const {api,catalog}=build();
 const cases=[
 ['冬天到吉林市看雾凇两天，不想滑雪','吉林市','滑雪'],
 ['长春市亲子一天，避免博物馆','长春市','博物馆'],
 ['延边两天，不要去中国朝鲜族民俗园','延边州','中国朝鲜族民俗园'],
 ['长春一日游，不去净月潭','长春市','净月潭']
 ];
 for(const [question,area,term] of cases){
  const out=await answerWenlv({question,now:new Date('2026-11-18T12:00:00Z'),invoke:null});
  assert.ok(out.intent.exclusions.includes(term),question);
  const plan=api.normalizePlan(out.itinerary,catalog);
  assert.ok(plan);
  for(const n of plan.plan.flatMap(d=>d.nodes)){
   const entry=catalog.attractions.find(a=>a.id===n.attractionId);
   assert.equal(n.area,area,question);
   assert.equal([entry.name,...entry.aliases,...entry.tags].join(' ').includes(term),false,question);
  }
 }
 const thin=await answerWenlv({question:'辽源市三天',invoke:null});
 assert.ok(thin.itinerary.plan.flatMap(d=>d.nodes).every(n=>n.area==='辽源市'));
 assert.ok(thin.itinerary.warnings.some(w=>w.type==='thin-plan'));
});
test('front end suppresses malformed planning data and shares actual route only',()=>{
 const {api,catalog}=build();
 const invalid=api.cleanPlanning({days:99,modelUsed:false,modelReplyAccepted:true,attractionCandidates:-1});
 assert.equal(invalid.days,null);
 assert.equal(invalid.modelReplyAccepted,false);
 assert.equal(invalid.attractionCandidates,null);
 const plan=api.fromRoute(catalog.routes[0],catalog);
 const text=api.shareText(plan);
 for(const n of plan.plan.flatMap(d=>d.nodes))assert.match(text,new RegExp(n.name));
 assert.match(text,/出发前请核实/);
});
test('actual front script sends wenlv request, renders, stores, restores and preserves prior result on failure',async()=>{
 const store={},handlers={};
 const outcome={innerHTML:'',querySelector(){return null}};
 const q={value:'冬天看雾凇两天',focus(){}};
 const button={disabled:false,innerHTML:''};
 let request,fail=false;
 const doc={addEventListener(k,v){handlers[k]=v;},getElementById(k){return k==='travelOutcome'?outcome:k==='travelQuestion'?q:null;},querySelector(k){return k==='#travelPlanForm button[type=submit]'?button:null;}};
 const box=createContext({document:doc,setTimeout:()=>1,clearTimeout:()=>{},AbortController,localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=v;},removeItem:k=>{delete store[k];}}});
 box.window=box;
 runInContext(read('public/wenlv-data.js'),box);
 const result=await answerWenlv({question:q.value,invoke:null});
 box.fetch=async(url,opts)=>{
  request={url,body:JSON.parse(opts.body)};
  if(fail)throw Error('网络不可用');
  return {ok:true,json:async()=>({mode:'wenlv',text:result.answer,itinerary:result.itinerary,degraded:true,planning:{days:2,areas:['吉林市'],themes:['雾凇'],season:'winter',sourceRouteId:result.itinerary.sourceRouteId,modelUsed:false}})};
 };
 runInContext(read('public/travel-home.js'),box);
 box.JZZX_TRAVEL_HOME.render('长春市');
 const submit=()=>handlers.submit({target:{id:'travelPlanForm'},preventDefault(){}});
 const click=action=>{const target={dataset:{travelAction:action},closest:()=>true,remove(){}};handlers.click({target:{closest:()=>target}});};
 const settle=async()=>{for(let i=0;i<15;i++)await Promise.resolve();};
 submit();await settle();
 assert.equal(request.url,'/api/chat');
 assert.equal(request.body.mode,'wenlv');
 assert.equal(request.body.question,q.value);
 assert.match(outcome.innerHTML,/雾凇岛/);
 assert.match(outcome.innerHTML,/为什么这样安排/);
 click('save');assert.ok(store['jzzx-travel-plan-v1']);
 assert.ok(!store['jzzx-travel-plan-v1'].includes(q.value));
 click('new');assert.match(outcome.innerHTML,/继续查看/);
 click('restore');assert.match(outcome.innerHTML,/雾凇岛/);
 fail=true;submit();await settle();
 assert.match(outcome.innerHTML,/暂时无法生成行程/);
 assert.match(outcome.innerHTML,/雾凇岛/);
 click('forget');assert.equal(store['jzzx-travel-plan-v1'],undefined);
});
