import test from 'node:test';
import assert from 'node:assert/strict';
import { handleApi } from '../src/worker.mjs';
import { relevantTopics,actionBundle,buildSystemPrompt } from '../src/knowledge.mjs';

function mockEnv(overrides={}){
  return {
    AI: {run:async(model,payload)=>{
      assert.equal(model,'@cf/zai-org/glm-4.7-flash');
      assert.equal(payload.messages[0].role,'system');
      return {response:'请先确认事项类型，再到吉事办核对所需材料。'};
    }},
    LIMITER:{limit:async()=>({success:true})},
    ...overrides
  };
}
const post=(payload,init={})=>new Request('https://jzzx.example/api/chat',{method:'POST',headers:{'content-type':'application/json','origin':'https://jzzx.example'},body:JSON.stringify(payload),...init});

test('knowledge matches valid topic and only produces allowlisted actions',()=>{
  const topics=relevantTopics('长春市养老金资格认证怎么做');
  assert.equal(topics[0].id,'pension');
  const {actions,sources}=actionBundle(topics);
  assert.equal(actions[0].type,'guide');
  assert.equal(actions[0].value,'pension');
  assert.ok(sources[0].url.startsWith('https://zwfw.jl.gov.cn/'));
  assert.equal(sources[0].isSpecificDocument,false);
});
test('system prompt restricts policies and privacy',()=>{
  const prompt=buildSystemPrompt('长春市',relevantTopics('医疗报销'));
  assert.ok(prompt.includes('不得编造'));
  assert.ok(prompt.includes('不收集身份证'));
});
test('returns real AI result with official links and actions',async()=>{
  const resp=await handleApi(post({question:'养老金资格认证怎么做',region:'长春市',history:[]}),mockEnv());
  assert.equal(resp.status,200);
  const data=await resp.json();
  assert.match(data.text,/吉事办/);
  assert.equal(data.region,'长春市');
  assert.ok(data.actions.some(x=>x.type==='guide'&&x.value==='pension'));
  assert.ok(data.actions.some(x=>x.type==='official'&&x.value==='hall'));
});
test('unknown query does not fabricate any specific program',async()=>{
  const resp=await handleApi(post({question:'任意不存在的问询'}),mockEnv());
  const d=await resp.json();
  assert.ok(d.actions.every(a=>a.type!=='guide'));
  assert.ok(d.sources.every(s=>s.isSpecificDocument===false));
});
test('AI not configured fails explicitly',async()=>{
  const resp=await handleApi(post({question:'医保报销'}),mockEnv({AI:null}));
  assert.equal(resp.status,503);
  assert.equal((await resp.json()).error,'NO_AI');
});
test('AI service error fails instead of pretending to generate text',async()=>{
  const resp=await handleApi(post({question:'医保报销'}),mockEnv({AI:{run:async()=>{throw Error('secret account details')}}}));
  const d=await resp.json();
  assert.equal(resp.status,503);
  assert.equal(d.error,'AI_UNAVAILABLE');
  assert.ok(!JSON.stringify(d).includes('secret account'));
});
test('requests from other site are rejected',async()=>{
  const r=await handleApi(post({question:'医保报销'},{headers:{'content-type':'application/json','origin':'https://evil.example'}}),mockEnv());
  assert.equal(r.status,403);
});
test('rate limiter returns 429 before AI call',async()=>{
  const r=await handleApi(post({question:'医保报销'}),mockEnv({LIMITER:{limit:async()=>({success:false})}}));
  assert.equal(r.status,429);
});
test('input with huge body rejected',async()=>{
  const r=await handleApi(post({question:'a'.repeat(10000),history:Array(50).fill({role:'user',content:'b'.repeat(100)})}),mockEnv());
  assert.equal(r.status,413);
});
test('health endpoint reports AI binding readiness',async()=>{
  const r=await handleApi(new Request('https://jzzx.example/api/status'),mockEnv());
  assert.equal(r.status,200);
  assert.equal((await r.json()).ready,true);
});
