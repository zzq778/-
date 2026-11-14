import test from 'node:test';
import assert from 'node:assert/strict';
import { AGENT_TOOLS, executeAgentTool, runCivicAgent } from '../src/agent.mjs';
import { handleApi } from '../src/worker.mjs';

function envFor(toolCalls,content='下一步请点击办事指南，再去官方门户核对具体要求。'){
  const calls=[];
  const AI={run:async(_model,options)=>{
    calls.push(options);
    if(calls.length===1)return {choices:[{message:{tool_calls:toolCalls}}]};
    return {choices:[{message:{content}}]};
  }};
  return {AI,calls};
}
const searchCall=(q='养老金资格认证')=>({id:'call_1',type:'function',function:{name:'search_services',arguments:JSON.stringify({query:q})}});

test('tool catalogue is explicit and bounded',()=>{
  assert.deepEqual(AGENT_TOOLS.map(t=>t.function.name),['search_services','read_service_guide','locate_official_portal']);
  assert.equal(executeAgentTool('__proto__',{},'长春市').error,'TOOL_NOT_ALLOWED');
  assert.equal(executeAgentTool('read_service_guide',{service_id:'fake'},'长春市').error,'UNKNOWN_SERVICE');
});

test('model chooses search, server actually executes and returns a plan and allowlisted links',async()=>{
  const {AI,calls}=envFor([searchCall()]);
  const result=await runCivicAgent({AI},{question:'养老保险资格认证怎么办？',region:'长春市'});
  assert.equal(calls.length,2);
  assert.equal(calls[0].tool_choice,'required');
  assert.ok(calls[0].tools.length>=2);
  assert.equal(calls[1].tool_choice,'none');
  assert.ok(calls[1].messages.some(m=>m.role==='tool'));
  assert.equal(result.plan.id,'pension');
  assert.equal(result.trace.length,2);
  assert.ok(result.actions.some(a=>a.type==='guide'&&a.value==='pension'));
  assert.ok(result.sources.every(x=>x.isSpecificDocument===false));
});

test('no matched service returns no fabricated guide',async()=>{
  const {AI}=envFor([searchCall('完全未知事项')]);
  const data=await runCivicAgent({AI},{question:'随便问一个未知事项',region:'长春市'});
  assert.equal(data.plan,null);
  assert.ok(data.actions.every(a=>a.type!=='guide'));
  assert.match(data.trace[0].detail,/没有找到/);
});

test('untrusted tool name fails without executing',async()=>{
  const {AI}=envFor([{id:'call_1',type:'function',function:{name:'delete_all_records',arguments:'{}'}}]);
  await assert.rejects(runCivicAgent({AI},{question:'查医保',region:'长春市'}),/AGENT_INVALID_TOOL/);
});

test('invalid tool arguments are rejected',async()=>{
  const {AI}=envFor([{id:'call_1',type:'function',function:{name:'search_services',arguments:'{invalid'}}]);
  await assert.rejects(runCivicAgent({AI},{question:'养老问题',region:'长春市'}),/AGENT_INVALID_ARGUMENTS/);
});

test('agent mode activates actual two-call path via chat API',async()=>{
  const {AI}=envFor([searchCall('医保报销')]);
  const req=new Request('https://jzzx.example/api/chat',{method:'POST',headers:{origin:'https://jzzx.example','content-type':'application/json'},body:JSON.stringify({mode:'agent',question:'我在长春办理医保报销',region:'长春市'})});
  const response=await handleApi(req,{AI,LIMITER:{limit:async()=>({success:true})}});
  assert.equal(response.status,200);
  const body=await response.json();
  assert.ok(body.agent.trace.length>=1);
  assert.equal(body.agent.plan.id,'medical');
});
