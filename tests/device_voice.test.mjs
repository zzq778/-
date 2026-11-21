import test from 'node:test';
import assert from 'node:assert/strict';
import {handleDeviceVoice,pcm16ToWav,wavToPcm16,DEVICE_AUDIO_RATE} from '../src/device-voice.mjs';

const CODE='dev-test-code-with-at-least-32-characters-123';
const pcm=new Uint8Array(DEVICE_AUDIO_RATE*2);
const makeEnv=()=>({
 VOICE_DEVICE_CODE:CODE,
 LIMITER:{limit:async()=>({success:true})},
 AI:{run:async(model)=>{
  if(model.includes('whisper'))return {text:'吉林两日游'};
  throw Error('unexpected model: '+model);
 }}
});
const post=(route,body,options={})=>new Request('https://device.example'+route,{
 method:'POST',
 headers:{
  Authorization:'Bearer '+(options.code??CODE),
  'Content-Type':options.contentType??'application/octet-stream',
  'Content-Length':String(options.length??body?.byteLength??0)
 },body
});
const mockAudio=()=>{
 const bytes=new Uint8Array(44+48000);
 bytes.set(pcm16ToWav(new Uint8Array(32000)).subarray(0,44));
 const v=new DataView(bytes.buffer);v.setUint32(4,bytes.length-8,true);
 v.setUint32(24,24000,true);v.setUint32(28,48000,true);
 v.setUint32(40,48000,true);
 return bytes;
};
test('wraps mono 16-bit PCM in a valid 16k WAV header',()=>{
 const wav=pcm16ToWav(pcm),v=new DataView(wav.buffer);
 assert.equal(v.getUint32(24,true),DEVICE_AUDIO_RATE);
 assert.equal(v.getUint32(40,true),pcm.length);
 assert.deepEqual(wav.subarray(44),pcm);
});
test('converts 24k WAV audio to bounded 16k mono PCM',()=>{
 const audio=wavToPcm16(mockAudio());
 assert.equal(audio.length,32000);
 assert.ok(audio.every(v=>v===0));
});
test('rejects invalid audio headers and oversized PCM',()=>{
 assert.throws(()=>pcm16ToWav(new Uint8Array(80000*4)),/PCM_LENGTH/);
 assert.throws(()=>wavToPcm16(new Uint8Array(100)),/WAV_HEADER|WAV_SIZE/);
});
test('rejects requests without device credentials before invoking AI',async()=>{
 const env=makeEnv();
 const r=await handleDeviceVoice(post('/api/device/talk',pcm,{code:'invalid'}),env);
 assert.equal(r.status,401);
 assert.equal((await r.json()).error,'UNAUTHORIZED');
});
test('bad input is rejected without costly model calls',async()=>{
 const env=makeEnv();
 assert.equal((await handleDeviceVoice(post('/api/device/talk',new Uint8Array(32000),{length:40000}),env)).status,400);
 assert.equal((await handleDeviceVoice(post('/api/device/talk',new Uint8Array(100)),env)).status,413);
 assert.equal((await handleDeviceVoice(post('/api/device/talk',pcm,{contentType:'text/plain'}),env)).status,415);
});
test('device text endpoint reuses planner without speech charges',async()=>{
 const env=makeEnv();
 const r=await handleDeviceVoice(post('/api/device/ask',JSON.stringify({question:'长白山旅游'}),{
  contentType:'application/json'
 }),env,{plan:async({question})=>({status:'complete',text:'规划建议：'+question})});
 assert.equal(r.status,200);
 assert.deepEqual(await r.json(),{question:'长白山旅游',answer:'规划建议：长白山旅游'});
});
test('full voice route: speech recognition, planning, WAV synthesis, 16k stream',async()=>{
 const env=makeEnv(),calls=[];
 const result=await handleDeviceVoice(post('/api/device/talk',pcm),env,{
  plan:async({question})=>{calls.push(question);return {status:'complete',text:'先看长白山。'}},
  speak:async(text)=>{calls.push(text);return {audio:'https://voice.example/voice.wav'}},
  fetchAudio:async()=>new Response(mockAudio(),{status:200})
 });
 assert.equal(result.status,200);
 assert.equal(result.headers.get('x-audio-format'),'pcm_s16le_16000_mono');
 assert.equal((await result.arrayBuffer()).byteLength,32000);
 assert.deepEqual(calls,['吉林两日游','先看长白山。']);
});
test('voice model errors do not leak server credentials or stack traces',async()=>{
 const env=makeEnv();env.AI.run=async()=>{throw Error('internal billing or authorization failure')};
 const r=await handleDeviceVoice(post('/api/device/talk',pcm),env);
 assert.equal(r.status,502);
 assert.deepEqual(await r.json(),{error:'STT_FAILED'});
});
test('oversized unexpected TTS output is rejected',async()=>{
 const env=makeEnv();
 const r=await handleDeviceVoice(post('/api/device/talk',pcm),env,{
  plan:async()=>({text:'欢迎来吉林'}),
  speak:async()=>({audio:'http://127.0.0.1/private'}),
  fetchAudio:async()=>new Response(mockAudio())
 });
 assert.equal(r.status,502);
 assert.deepEqual(await r.json(),{error:'VOICE_PIPELINE_FAILED'});
});
