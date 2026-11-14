import test from 'node:test';
import assert from 'node:assert/strict';
import { handleApi, normalizeAiAnswer } from '../src/worker.mjs';
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
test('GLM uses non-thinking mode and enough answer tokens',async()=>{
  const AI={run:async(model,opts)=>{
    assert.equal(model,'@cf/zai-org/glm-4.7-flash');
    assert.deepEqual(opts.chat_template_kwargs,{enable_thinking:false});
    assert.ok(opts.max_completion_tokens>=800);
    return {choices:[{message:{content:'可以到吉事办查找养老保险资格认证。'}}]};
  }};
  const r=await handleApi(post({question:'养老保险资格认证如何办理'}),mockEnv({AI}));
  assert.equal(r.status,200);
  assert.match((await r.json()).text,/吉事办/);
});
test('empty model content is reported without fabricating an answer',async()=>{
  const r=await handleApi(post({question:'养老金办理'}),mockEnv({AI:{run:async()=>({choices:[{message:{content:null,reasoning_content:'内部推理'}}]})}}));
  assert.equal(r.status,502);
  assert.equal((await r.json()).error,'EMPTY_AI');
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

test('answer text removes raw Markdown formatting and URLs without creating links',()=>{
  const raw='您好！**打开网站**：\n[https://zwfw.jl.gov.cn/jljhszwfww/](https://zwfw.jl.gov.cn/jljhszwfww/)\n2. **核对事项**';
  const text=normalizeAiAnswer(raw);
  assert.ok(text.includes('打开网站'));
  assert.ok(text.includes('下方官方入口'));
  assert.ok(!text.includes('**'));
  assert.ok(!text.includes('https://'));
  assert.ok(!text.includes(']('));
});
test('model answer normalization is applied to API response',async()=>{
  const AI={run:async()=>({response:'1. **打开官方入口**\n2. [吉事办](https://zwfw.jl.gov.cn/jljhszwfww/) 核对事项'})};
  const r=await handleApi(post({question:'长春市养老资格认证怎么办'}),mockEnv({AI}));
  const data=await r.json();
  assert.equal(r.status,200);
  assert.ok(!data.text.includes('**'));
  assert.ok(!data.text.includes('https://'));
  assert.ok(data.actions.some(a=>a.type==='official'&&a.value==='hall'));
});
test('natural guidance prompt avoids official-site menu claims and markdown',()=>{
  const prompt=buildSystemPrompt('长春市',relevantTopics('资格认证'));
  assert.ok(prompt.includes('不要以“您好，我是吉小知”'));
  assert.ok(prompt.includes('不要 Markdown'));
  assert.ok(prompt.includes('具体网站按钮路径'));
  assert.ok(prompt.includes('门户级资料'));
});

test('page context is whitelisted and never injects client text',async()=>{
 let sys='';const AI={run:async(_model,opts)=>{sys=opts.messages[0].content;return {response:'请打开应用内的养老指南。'}}};
 const r=await handleApi(post({question:'养老指南在哪里',region:'长春市',context:{tab:'services',guide:'pension',unexpected:'偷换规则'}}),mockEnv({AI}));
 assert.equal(r.status,200);
 assert.match(sys,/政务服务页/);assert.match(sys,/养老认证/);assert.ok(!sys.includes('偷换规则'));
});

test('prototype property keys are never treated as valid navigation context',async()=>{
 let sys='';
 const AI={run:async(_,opts)=>{sys=opts.messages[0].content;return {response:'请查看官方指南。'}}};
 const r=await handleApi(post({question:'怎么查指南',context:{tab:'__proto__',guide:'constructor'}}),mockEnv({AI}));
 assert.equal(r.status,200);
 assert.ok(sys.includes('当前位于首页'));
 assert.ok(!sys.includes('function Object'));
});
