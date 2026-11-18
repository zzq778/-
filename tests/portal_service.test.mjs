import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {handleMobile} from '../src/mobile-worker.mjs';
import {handleApi} from '../src/worker.mjs';
const origin='https://portal.example';
function database(){
 const s=new DatabaseSync(':memory:');s.exec(readFileSync(new URL('../migrations/portal/0001_feedback.sql',import.meta.url),'utf8'));
 s.exec("INSERT INTO portal_merchants(id,name,region) VALUES('m1','商户一','吉林市'),('m2','商户二','长春市'),('m3','商户三','吉林市')");
 return {prepare(sql){return {bind(...p){const q=s.prepare(sql);return {first:async()=>q.get(...p)||null,all:async()=>({results:q.all(...p)}),run:async()=>q.run(...p)}}}}};
}
const actors=[['touristA','tourist','吉林市'],['touristB','tourist','吉林市'],['merchantA','merchant','吉林市','m1'],['merchantB','merchant','吉林市','m3'],['govA','government','吉林市'],['govB','government','长春市']];
const key=id=>'test-'+id+'-long-credential-000000000000000000';
function environment(){return {PORTAL_DB:database(),PORTAL_LIMITER:{limit:async()=>({success:true})},PORTAL_ACTORS:JSON.stringify(actors.map(([id,role,region,merchantId])=>({id,role,region,merchantId,keyHash:createHash('sha256').update(key(id)).digest('hex')})))}}
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
