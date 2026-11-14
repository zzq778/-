import test from 'node:test';
import assert from 'node:assert/strict';
import {handleApi} from '../src/worker.mjs';

function attachmentRequest(name='screen.png',type='image/png',size=8){
 const form=new FormData();
 form.append('payload',JSON.stringify({question:'请解释这张办事截图',region:'长春市',context:{tab:'services'}}));
 form.append('file',new Blob([new Uint8Array(size).fill(0x20)],{type}),name);
 return new Request('https://example.org/api/chat',{method:'POST',headers:{origin:'https://example.org'},body:form});
}
const env={DEEPSEEK_API_KEY:'test-placeholder',LIMITER:{limit:async()=>({success:true})}};

test('image upload uses DeepSeek Files API, expiration, and the current Flash model', async()=>{
 const original=globalThis.fetch;const calls=[];
 globalThis.fetch=async (input,options)=>{
   calls.push({input,options});
   assert.equal(options.headers.Authorization,'Bearer test-placeholder');
   if(String(input).endsWith('/files')){
     assert.equal(options.body.get('purpose'),'user_data');
     assert.equal(options.body.get('expires_after[anchor]'),'created_at');
     assert.equal(options.body.get('expires_after[seconds]'),'3600');
     assert.equal(options.body.get('file').name,'screen.png');
     return Response.json({id:'file-api-example123'});
   }
   assert.ok(String(input).endsWith('/chat/completions'));
   const json=JSON.parse(options.body);
   assert.equal(json.model,'deepseek-flash');
   assert.deepEqual(json.thinking,{type:'disabled'});
   assert.deepEqual(json.messages.at(-1).content[0],{type:'file',file_id:'file-api-example123'});
   assert.match(json.messages[0].content,/当前位于政务服务页/);
   return Response.json({choices:[{message:{content:'这是养老认证事项截图，请先阅读平台上的官方提示。'}}]});
 };
 try{
   const r=await handleApi(attachmentRequest(),env);const data=await r.json();
   assert.equal(r.status,200);assert.equal(calls.length,2);
   assert.equal(data.model,'deepseek-flash');assert.match(data.text,/养老认证事项截图/);
 }finally{globalThis.fetch=original;}
});

test('PDF uses text recognition instead of treating pages as images',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async(input,options)=>{
   if(String(input).endsWith('/files')){
     assert.equal(options.body.get('purpose'),'text_recognition');
     return Response.json({id:'file-api-pdf'});
   }
   return Response.json({choices:[{message:{content:'文件内容包括申请流程。'}}]});
 };
 try{
   const r=await handleApi(attachmentRequest('guide.pdf','application/pdf'),env);
   assert.equal(r.status,200);
 }finally{globalThis.fetch=original;}
});

test('missing DeepSeek key fails explicitly without exposing credentials',async()=>{
 const r=await handleApi(attachmentRequest(),{...env,DEEPSEEK_API_KEY:null});
 assert.equal(r.status,503);assert.equal((await r.json()).error,'NO_DEEPSEEK');
});

test('unsupported extensions rejected before paid call',async()=>{
 const r=await handleApi(attachmentRequest('danger.exe','application/octet-stream'),env);
 assert.equal(r.status,415);assert.equal((await r.json()).error,'FILE_TYPE');
});

test('oversized attachments are rejected before paid call',async()=>{
 const r=await handleApi(attachmentRequest('large.png','image/png',8*1024*1024+1),env);
 assert.equal(r.status,413);assert.equal((await r.json()).error,'FILE_SIZE');
});

test('cross-origin upload is blocked before model calls',async()=>{
 const request=attachmentRequest();request.headers.set('origin','https://untrusted.example');
 const r=await handleApi(request,env);
 assert.equal(r.status,403);
});

test('DeepSeek upload failures are handled cleanly',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async()=>new Response('upstream secret failure',{status:401});
 try{
  const r=await handleApi(attachmentRequest(),env);const data=await r.json();
  assert.equal(r.status,502);assert.equal(data.error,'FILE_UPLOAD_FAILED');assert.ok(!JSON.stringify(data).includes('upstream secret failure'));
 }finally{globalThis.fetch=original;}
});
