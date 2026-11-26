import test from 'node:test';
import assert from 'node:assert/strict';
import { handleVoiceTurn } from '../src/voice.mjs';

function makeWav() {
  const bytes = new Uint8Array(48);
  bytes.set([0x52,0x49,0x46,0x46],0);
  bytes.set([0x57,0x41,0x56,0x45],8);
  bytes.set([0x66,0x6d,0x74,0x20],12);
  bytes.set([0x64,0x61,0x74,0x61],36);
  return bytes;
}

function request({token='test-device-token-0123456789abcdef', audio=makeWav(), history=[]}={}) {
  const form = new FormData();
  form.append('audio', new Blob([audio], {type:'audio/wav'}), 'turn.wav');
  form.append('region', '长春市');
  form.append('history', JSON.stringify(history));
  return new Request('https://example.test/api/voice/turn', {
    method:'POST',
    headers:{authorization:`Bearer ${token}`},
    body:form
  });
}

test('voice turn rejects unauthenticated devices before processing audio', async () => {
  const response = await handleVoiceTurn(request({token:'wrong'}), {
    VOICE_DEVICE_TOKEN:'test-device-token-0123456789abcdef',
    AI:{run:async()=>{throw new Error('must not run');}}
  }, async()=>{throw new Error('must not call chat');});
  assert.equal(response.status,401);
  assert.equal((await response.json()).error,'DEVICE_UNAUTHORIZED');
});

test('voice turn runs multilingual ASR, existing 吉小知 chat, then Chinese TTS', async () => {
  const calls=[];
  const env={
    VOICE_DEVICE_TOKEN:'test-device-token-0123456789abcdef',
    AI:{run:async(model,input)=>{
      calls.push({model,input});
      if(model==='@cf/openai/whisper') return {text:'吉林省大学生创业有哪些补贴？'};
      if(model==='xai/grok-tts') {
        assert.equal(input.language,'zh');
        assert.equal(input.voice_id,'ara');
        assert.equal(input.output_format.codec,'wav');
        return {result:{audio:'https://audio.example.test/answer.wav'}};
      }
      throw new Error('unexpected model');
    }}
  };
  const chatCalls=[];
  const response=await handleVoiceTurn(request({history:[{role:'user',content:'上一轮'}]}),env,async(req)=>{
    const payload=await req.json();
    chatCalls.push(payload);
    return new Response(JSON.stringify({
      text:'可以先了解吉林省现行的大学生创业扶持政策。',
      region:'长春市',
      actions:[],
      sources:[]
    }),{status:200,headers:{'content-type':'application/json'}});
  });
  assert.equal(response.status,200);
  const data=await response.json();
  assert.equal(data.transcript,'吉林省大学生创业有哪些补贴？');
  assert.match(data.reply,/创业扶持政策/);
  assert.equal(data.audioUrl,'https://audio.example.test/answer.wav');
  assert.equal(calls.length,2);
  assert.equal(chatCalls[0].mode,'agent');
  assert.equal(chatCalls[0].history[0].content,'上一轮');
});

test('voice turn rejects non-WAV payloads', async () => {
  const response=await handleVoiceTurn(request({audio:new Uint8Array(64)}),{
    VOICE_DEVICE_TOKEN:'test-device-token-0123456789abcdef',
    AI:{run:async()=>{throw new Error('must not run');}}
  },async()=>{throw new Error('must not call chat');});
  assert.equal(response.status,415);
  assert.equal((await response.json()).error,'AUDIO_FORMAT');
});
