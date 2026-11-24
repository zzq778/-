import test from 'node:test';
import assert from 'node:assert/strict';
import {handleMobile} from '../src/mobile-worker.mjs';

const origin='https://voice.example',code='test-voice-code-123456';
const mp4=()=>{const bytes=new Uint8Array(400);bytes.set([0,0,0,20,102,116,121,112,77,52,65,32],0);return bytes};
const env=()=>({
 TRAVEL_PREVIEW_CODE:code,
 LIMITER:{limit:async()=>({success:true})},
 AI:{run:async(model,input)=>{
  assert.equal(model,'@cf/openai/whisper-large-v3-turbo');
  assert.equal(input.language,'zh');
  assert.equal(input.task,'transcribe');
  assert.ok(typeof input.audio==='string'&&input.audio.length>100);
  return {text:'吉林市有什么值得游玩的地方'};
 }}
});
const request=(token=code,body=mp4(),type='audio/mp4')=>new Request(origin+'/api/v1/transcribe',{
 method:'POST',headers:{authorization:'Bearer '+token,'content-type':type},body
});
test('native recording uses authenticated binary upload and returns only transcript',async()=>{
 const response=await handleMobile(request(),env());
 assert.equal(response.status,200);
 const body=await response.json();
 assert.deepEqual(body,{text:'吉林市有什么值得游玩的地方'});
});
test('rejects invalid credentials before inspecting audio',async()=>{
 assert.equal((await handleMobile(request('incorrect-voice-code'),env())).status,401);
});
test('rejects unsupported MIME, invalid MP4 magic and oversized audio',async()=>{
 assert.equal((await handleMobile(request(code,mp4(),'text/plain'),env())).status,415);
 assert.equal((await handleMobile(request(code,new Uint8Array(400)),env())).status,400);
 assert.equal((await handleMobile(request(code,new Uint8Array(320001)),env())).status,400);
});
test('audio and chat rate-limit buckets remain isolated',async()=>{
 const keys=[];
 const e=env();e.LIMITER={limit:async({key})=>{keys.push(key);return {success:true}}};
 await handleMobile(request(),e);
 assert.ok(keys[0].startsWith('voice:'));
});
test('transcription does not invent content when inference is unavailable',async()=>{
 const e=env();e.AI.run=async()=>{throw Error('mock upstream outage')};
 const response=await handleMobile(request(),e);
 assert.equal(response.status,503);
 const result=await response.json();
 assert.equal(result.error,'VOICE_UNAVAILABLE');
 assert.equal(result.text,undefined);
});
