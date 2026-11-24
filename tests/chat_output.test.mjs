import test from 'node:test';
import assert from 'node:assert/strict';
import {visibleChatText} from '../src/chat-output.mjs';
import {runProductAgent} from '../src/product-agent.mjs';

test('decodes pseudo tool-call reply shown in Android screenshot',()=>{
 const input='<|tool_call>call:reply{content: "你好！我是吉小知，你的吉林文旅助手。随时问我！"}<|tool_call|>';
 assert.equal(visibleChatText(input),'你好！我是吉小知，你的吉林文旅助手。随时问我！');
});
test('strips markdown markers while keeping Chinese lists legible',()=>{
 assert.equal(visibleChatText('### 景点推荐\n* **松花湖**：适合看湖景。\n* **长白山**：请核实开放信息。'),'景点推荐\n• 松花湖：适合看湖景。\n• 长白山：请核实开放信息。');
});
test('does not leak unrecognized tool directives or control tokens',()=>{
 assert.equal(visibleChatText('<|tool_call>call:delete_all{content: "abc"}<|tool_call|>'),'');
 assert.equal(visibleChatText('<|tool_call>call:reply{content: "broken}<|tool_call|>'),'');
});
test('normal plain text remains unchanged',()=>{
 assert.equal(visibleChatText('你好，我是吉小知。'),'你好，我是吉小知。');
});
test('plain assistant pseudo-tool response is sanitized at the agent boundary',async()=>{
 const result=await runProductAgent({
  question:'你好',
  invoke:async()=>({choices:[{message:{content:'<|tool_call>call:reply{content: "您好！我是吉小知。"}<|tool_call|>'}}]})
 });
 assert.equal(result.status,'complete');
 assert.equal(result.text,'您好！我是吉小知。');
});
