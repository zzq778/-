// JZZX_VOICE_URL and JZZX_VOICE_CODE are environment variables.
// Usage: node scripts/device-voice-smoke.mjs [question.pcm answer.pcm]
import {readFileSync,writeFileSync} from 'node:fs';
const origin=(process.env.JZZX_VOICE_URL||'').replace(/\/+$/,'');
const code=process.env.JZZX_VOICE_CODE||'';
if(!origin.startsWith('https://')||code.length<32){
 console.error('Missing JZZX_VOICE_URL (https://...) or JZZX_VOICE_CODE (32+ characters).');
 process.exit(2);
}
const health=await fetch(origin+'/health');
console.log('health:',await health.text());
const ask=await fetch(origin+'/api/device/ask',{
 method:'POST',headers:{Authorization:'Bearer '+code,'Content-Type':'application/json'},
 body:JSON.stringify({question:'带父母游吉林市两天，不滑雪，尽量轻松'})
});
console.log('ask:',ask.status,await ask.text());
if(!ask.ok)process.exit(1);
if(process.argv[2]){
 const bytes=readFileSync(process.argv[2]);
 if(bytes.length<32000||bytes.length>160000||bytes.length%2){
  console.error('PCM must be mono signed 16-bit little-endian 16000 Hz, 1-5 seconds.');
  process.exit(2);
 }
 const response=await fetch(origin+'/api/device/talk',{
  method:'POST',headers:{Authorization:'Bearer '+code,'Content-Type':'application/octet-stream'},
  body:bytes
 });
 if(!response.ok){console.error('talk failed:',response.status,await response.text());process.exit(1)}
 if(response.headers.get('x-audio-format')!=='pcm_s16le_16000_mono')throw Error('Unexpected audio encoding');
 const answer=new Uint8Array(await response.arrayBuffer());
 if(!answer.length||answer.length%2)throw Error('Invalid PCM answer');
 const path=process.argv[3]||'answer.pcm';
 writeFileSync(path,answer);
 console.log('saved '+path+' ('+answer.length+' bytes)');
}
