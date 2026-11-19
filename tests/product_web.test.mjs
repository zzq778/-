import test from 'node:test';import assert from 'node:assert/strict';import {handleApi} from '../src/worker.mjs';
test('Web product mode uses shared agent, keeps civic checklist and sources',async()=>{
 const calls=[['search_services',{query:'养老资格认证'}],['reply',{text:'请到吉事办核实。'}]];
 const AI={run:async()=>{const [name,args]=calls.shift();return {tool_calls:[{id:name,function:{name,arguments:JSON.stringify(args)}}]}}};
 const resp=await handleApi(new Request('https://example.test/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({mode:'product',question:'养老金资格认证'})}),{AI,LIMITER:{limit:async()=>({success:true})}});
 assert.equal(resp.status,200);const data=await resp.json();assert.equal(data.agent.plan.id,'pension');assert.ok(data.actions.some(a=>a.value==='pension'));assert.ok(data.sources.some(a=>a.url.includes('zwfw.jl.gov.cn')));
});
