import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeModelResult} from '../src/workers-model.mjs';
const raw={choices:[{message:{tool_calls:[{id:'test',type:'function',function:{name:'reply',arguments:'{"text":"你好"}'}}]}}]};
test('Workers AI envelopes, native completion objects, JSON and Response converge',async()=>{
 for(const v of [raw,{result:raw},{response:raw},JSON.stringify(raw),new Response(JSON.stringify(raw))])assert.deepEqual(await normalizeModelResult(v),raw);
 await assert.rejects(()=>normalizeModelResult(new Response('error',{status:502})));
});
