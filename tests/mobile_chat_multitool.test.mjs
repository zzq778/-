import test from 'node:test';
import assert from 'node:assert/strict';
import { runProductAgent } from '../src/product-agent.mjs';
import { handleMobile, MOBILE_MODEL } from '../src/mobile-worker.mjs';
import { parseIntent } from '../src/wenlv/intent.mjs';
import { retrieve } from '../src/wenlv/search.mjs';

const ORIGIN='https://jzzx.example';
const CODE='mobile-chat-test-code-123456';
const toolCalls=(items)=>({tool_calls:items.map(item=>({...(item.id?{id:item.id}:{}),name:item.name,arguments:item.args}))});

test('agent accepts multiple Cloudflare-native tool calls and returns matching tool results',async()=>{
 const seen=[];let turn=0;
 const result=await runProductAgent({
  question:'净月潭和营业执照怎么查？',
  invoke:async(messages,available)=>{
   seen.push(structuredClone(messages));
   if(turn++===0){
    assert.ok(available.some(tool=>tool.function.name==='read_place'));
    assert.ok(available.some(tool=>tool.function.name==='search_services'));
    return toolCalls([
     {name:'read_place',args:{id:'jingyuetan'}},
     {name:'search_services',args:{query:'营业执照'}}
    ]);
   }
   return toolCalls([{name:'reply',args:{text:'已根据景点与政务资料整理。'}}]);
  }
 });
 assert.equal(result.status,'complete');
 assert.equal(result.toolCount,2);
 assert.ok(result.sources.some(source=>source.url.includes('ijingyuetan.com')));
 const assistant=seen[1].find(message=>message.role==='assistant'&&Array.isArray(message.tool_calls));
 const toolMessages=seen[1].filter(message=>message.role==='tool');
 assert.equal(assistant.tool_calls.length,2);
 assert.equal(toolMessages.length,2);
 assert.equal(new Set(assistant.tool_calls.map(call=>call.id)).size,2);
 assert.deepEqual(new Set(toolMessages.map(message=>message.tool_call_id)),new Set(assistant.tool_calls.map(call=>call.id)));
});


test('tool budget still leaves one final reply call after six successful tools',async()=>{
 let turn=0;
 const batch=[
  {name:'read_place',args:{id:'jingyuetan'}},
  {name:'read_place',args:{id:'wusongdao'}},
  {name:'read_place',args:{id:'songhuahu'}}
 ];
 const result=await runProductAgent({
  question:'请汇总多项公共服务事项',
  invoke:async(_messages,available)=>{
   if(turn++<2){
    assert.ok(available.some(tool=>tool.function.name==='read_place'));
    return toolCalls(batch);
   }
   assert.deepEqual(available.map(tool=>tool.function.name),['reply']);
   return toolCalls([{name:'reply',args:{text:'已整理景点资料。'}}]);
  }
 });
 assert.equal(result.status,'complete');
 assert.equal(result.toolCount,6);
});

test('a reply-model failure after place retrieval returns a grounded partial answer instead of HTTP-level failure',async()=>{
 const question='吉林市有什么好玩的地方';
 const expected=retrieve(parseIntent(question),{limit:6,routeLimit:3,eventLimit:3}).attractions[0]?.name;
 assert.ok(expected,'fixture query should match the current Jilin attraction catalogue');
 let calls=0;
 const result=await runProductAgent({
  question,
  invoke:async(_messages,available)=>{
   calls++;
   assert.deepEqual(available.map(x=>x.function.name),['reply']);
   throw new Error('simulated model outage during grounded answer');
  }
 });
 assert.equal(calls,1);
 assert.equal(result.status,'partial');
 assert.match(result.text,new RegExp(expected));
 assert.ok(result.sources.length>0);
 assert.equal(result.reason,'model-error');
});

test('mobile HTTP API preserves real history and returns the second-turn sightseeing answer with one grounded model call',async()=>{
 const question2='吉林市有什么好玩的地方';
 let secondTurnMessages=null;
 const binding={
  TRAVEL_PREVIEW_CODE:CODE,
  LIMITER:{limit:async()=>({success:true})},
  AI:{run:async(model,input)=>{
   assert.equal(model,MOBILE_MODEL);
   if(input.messages.at(-1)?.role==='user'&&['你好',question2].includes(input.messages.at(-1)?.content)){
    assert.equal(input.tool_choice,undefined);
    assert.equal(input.tools,undefined);
   }
   const last=input.messages.at(-1);
   if(last.role==='user'&&last.content==='你好')return toolCalls([{name:'reply',args:{text:'你好，我是吉小知。'}}]);
   if(last.role==='user'&&last.content===question2){
    secondTurnMessages=structuredClone(input.messages);
    assert.equal(input.tools,undefined);
    assert.match(input.messages[0].content,/本地景点目录/);
    return toolCalls([{name:'reply',args:{text:'吉林市可以先了解雾凇岛、松花湖等地点。'}}]);
   }
   throw new Error('unexpected model turn');
  }}
 };
 const send=async(body)=>handleMobile(new Request(ORIGIN+'/api/v1/chat',{
  method:'POST',
  headers:{'content-type':'application/json',authorization:'Bearer '+CODE,origin:ORIGIN},
  body:JSON.stringify(body)
 }),binding);
 const firstResponse=await send({question:'你好',history:[]});
 assert.equal(firstResponse.status,200);
 const first=await firstResponse.json();
 assert.equal(first.status,'complete');
 assert.match(first.text,/吉小知/);
 const secondResponse=await send({
  question:question2,
  history:[{role:'user',content:'你好'},{role:'assistant',content:first.text}]
 });
 assert.equal(secondResponse.status,200);
 const second=await secondResponse.json();
 assert.equal(second.status,'complete');
 assert.equal(second.toolCount,0);
 assert.ok(second.sources.length>0);
 assert.match(second.text,/雾凇岛/);
 assert.ok(secondTurnMessages.some(message=>message.role==='user'&&message.content==='你好'));
 assert.ok(secondTurnMessages.some(message=>message.role==='assistant'&&message.content===first.text));
});

test('sightseeing follow-up uses prior destination when the new question is elliptical',async()=>{
 const history=[
  {role:'user',content:'吉林市有什么好玩的地方？'},
  {role:'assistant',content:'可以先去松花湖和雾凇岛。'}
 ];
 let modelMessages;
 const outcome=await runProductAgent({
  question:'那冬天适合去哪？',
  history,
  invoke:async(messages,available)=>{
   modelMessages=messages;
   assert.deepEqual(available.map(x=>x.function.name),['reply']);
   return toolCalls([{name:'reply',args:{text:'冬天可以考虑雾凇岛，开放情况请核实。'}}]);
  }
 });
 assert.equal(outcome.status,'complete');
 assert.equal(outcome.toolCount,0);
 assert.ok(outcome.sources.length>0);
 assert.ok(modelMessages.some(m=>m.role==='user'&&m.content==='吉林市有什么好玩的地方？'));
 assert.match(modelMessages[0].content,/吉林市/);
});

test('invalid model output on second-turn sightseeing request yields sourced partial, not 503',async()=>{
 const outcome=await runProductAgent({
  question:'吉林市有什么好玩的？',
  history:[{role:'user',content:'你好'},{role:'assistant',content:'你好，我是吉小知'}],
  invoke:async()=>({choices:[{message:{content:'',tool_calls:[]}}]})
 });
 assert.equal(outcome.status,'partial');
 assert.ok(outcome.sources.length>0);
 assert.match(outcome.text,/吉林/);
});

test('a reply-only model may produce ordinary text without a function call',async()=>{
 const result=await runProductAgent({question:'吉林市有什么好玩的',invoke:async()=>({choices:[{message:{role:'assistant',content:'松花湖和雾凇岛都是吉林市的候选去处。'}}]})});
 assert.equal(result.status,'complete');
 assert.match(result.text,/松花湖/);
 assert.ok(result.sources.length>0);
});
