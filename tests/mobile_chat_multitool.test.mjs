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
  question:'介绍几个吉林景点',
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
  invoke:async()=>{
   if(calls++===0)return toolCalls([{name:'find_places',args:{query:question}}]);
   throw new Error('simulated model outage after successful retrieval');
  }
 });
 assert.equal(result.status,'partial');
 assert.match(result.text,new RegExp(expected));
 assert.ok(result.sources.length>0);
 assert.equal(result.reason,'model-error');
});

test('mobile HTTP API preserves first-turn history and completes a second turn with multiple native tool calls',async()=>{
 const question2='吉林市有什么好玩的地方';
 let secondTurnMessages=null;
 const binding={
  TRAVEL_PREVIEW_CODE:CODE,
  LIMITER:{limit:async()=>({success:true})},
  AI:{run:async(model,input)=>{
   assert.equal(model,MOBILE_MODEL);
   assert.equal(input.tool_choice,'required');
   assert.equal(input.parallel_tool_calls,true);
   const last=input.messages.at(-1);
   if(last.role==='user'&&last.content==='你好')return toolCalls([{name:'reply',args:{text:'你好，我是吉小知。'}}]);
   if(last.role==='user'&&last.content===question2){
    secondTurnMessages=structuredClone(input.messages);
    return toolCalls([
     {name:'find_places',args:{query:question2}},
     {name:'read_place',args:{id:'wusongdao'}}
    ]);
   }
   if(last.role==='tool')return toolCalls([{name:'reply',args:{text:'吉林市可以优先了解雾凇岛、松花湖等地点。'}}]);
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
 assert.equal(second.toolCount,2);
 assert.match(second.text,/雾凇岛/);
 assert.ok(secondTurnMessages.some(message=>message.role==='user'&&message.content==='你好'));
 assert.ok(secondTurnMessages.some(message=>message.role==='assistant'&&message.content===first.text));
});
