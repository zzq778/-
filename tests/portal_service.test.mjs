import test from 'node:test';
import assert from 'node:assert/strict';
import {environment,key} from './portal_fixture.mjs';
import {handleMobile} from '../src/mobile-worker.mjs';
import {handleApi} from '../src/worker.mjs';
const origin='https://portal.example';
const request=(actor,path,body,extra={})=>new Request(origin+'/api/v1/portal/'+path,{method:body?'POST':'GET',headers:{authorization:'Bearer '+key(actor),'content-type':'application/json',...extra},...(body?{body:JSON.stringify(body)}:{})});
test('actual SQL, scoped role authentication, submission, cross-device read and reply, idempotency',async()=>{
 const e=environment();const go=(a,p,b)=>handleMobile(request(a,p,b),e);
 assert.equal((await go('unknown','me')).status,401);
 const merchants=await(await go('touristA','merchants')).json();assert.deepEqual(merchants.items.map(x=>x.id).sort(),['m1','m3']);
 const post={merchantId:'m1',category:'设施与环境',text:'停车指引不清',requestId:'request1'};
 assert.equal((await go('merchantA','feedback',post)).status,403);
 const made=await go('touristA','feedback',post);assert.equal(made.status,201);const {id}=await made.json();
 assert.equal((await go('touristA','feedback',post)).status,200);
 assert.equal((await go('touristA','feedback',{...post,text:'changed'})).status,409);
 assert.equal((await go('touristA','feedback',{...post,merchantId:'m2',requestId:'request2'})).status,404);
 for(const who of ['touristB','merchantB','govB'])assert.equal((await(await go(who,'feedback')).json()).items.length,0);
 for(const who of ['touristA','merchantA','govA'])assert.equal((await(await go(who,'feedback')).json()).items.length,1);
 const p='feedback/'+id+'/replies',reply={text:'已收到，核查停车标识。',requestId:'reply1'};
 assert.equal((await go('touristA',p,reply)).status,403);
 assert.equal((await go('merchantB',p,reply)).status,404);
 assert.equal((await go('govB',p,reply)).status,404);
 assert.equal((await go('merchantA',p,reply)).status,201);
 assert.equal((await go('merchantA',p,reply)).status,200);
 const web=await handleApi(request('touristA','feedback'),e);const f=(await web.json()).items[0];assert.equal(f.status,'answered');assert.equal(f.replies.length,1);assert.equal(f.replies[0].actor_role,'merchant');assert.equal(f.tourist_id,undefined);assert.equal(f.replies[0].actor_id,undefined);
});
test('no DB or auth configuration fails closed; cross-origin denied',async()=>{
 assert.equal((await handleMobile(request('touristA','feedback'),{})).status,503);
 const e=environment();assert.equal((await handleMobile(request('touristA','feedback',undefined,{origin:'https://evil.test'}),e)).status,403);
 e.PORTAL_ACTORS='[]';assert.equal((await handleMobile(request('touristA','feedback'),e)).status,503);
});

test('feedback analysis is role scoped and sends aggregate data only',async()=>{
 const e=environment();const go=(a,p,b)=>handleMobile(request(a,p,b),e);
 await go('touristA','feedback',{merchantId:'m1',category:'安全问题',text:'private-text-should-not-reach-model',requestId:'summary1'});
 await go('touristB','feedback',{merchantId:'m3',category:'其他',text:'other-scope-private',requestId:'summary2'});
 assert.equal((await go('touristA','summary')).status,403);
 assert.equal((await(await go('merchantA','summary')).json()).total,1);
 assert.equal((await(await go('govA','summary')).json()).total,2);
 assert.equal((await(await go('govB','summary')).json()).total,0);
 assert.equal((await go('merchantA','analysis',{question:'优先事项',confirm:false})).status,400);
 let calls=0;e.LIMITER={limit:async()=>({success:true})};e.AI={run:async(_,p)=>{calls++;const s=JSON.stringify(p.messages);assert.ok(!s.includes('private-text')&&!s.includes('other-scope-private')&&!s.includes(key('merchantA')));const name=calls===1?'read_feedback_summary':'reply';if(calls===2)assert.equal(JSON.parse(p.messages.at(-1).content).total,1);return {tool_calls:[{id:name,function:{name,arguments:JSON.stringify(calls===1?{}:{text:'优先核对安全反馈。'})}}]}}};
 const r=await(await go('merchantA','analysis',{question:'优先事项',confirm:true})).json();assert.equal(r.status,'complete');assert.equal(r.summary.total,1);assert.equal(calls,2);
 assert.equal((await go('touristA','analysis',{question:'全部反馈',confirm:true})).status,403);
});
