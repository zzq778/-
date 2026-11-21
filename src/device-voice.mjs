// Dedicated voice gateway: ESP32-C3 audio in, 16 kHz PCM out.
// Reuses the existing Wenlv agent. No credentials or audio recordings are persisted.
import {runTravelAgent} from './wenlv/travel-agent.mjs';

export const DEVICE_STT_MODEL='@cf/openai/whisper-large-v3-turbo';
export const DEVICE_TTS_MODEL='minimax/speech-2.6-turbo';
export const DEVICE_AUDIO_RATE=16000;
export const DEVICE_MAX_INPUT_BYTES=160000; // 5 seconds, mono 16-bit, 16 kHz
export const DEVICE_MAX_OUTPUT_BYTES=960000; // at most 30 seconds

const enc=new TextEncoder();
const error=(code,status)=>new Response(JSON.stringify({error:code}),{
 status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}
});
const s16=(x)=>Math.round(Math.max(-1,Math.min(1,x))*32767);

async function secretMatches(given,expected) {
 if(typeof given!=='string'||typeof expected!=='string'||expected.length<32||expected.length>160||given.length!==expected.length)return false;
 const digest=async v=>new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(v)));
 const [a,b]=await Promise.all([digest(given),digest(expected)]);
 let difference=0;for(let i=0;i<a.length;i++)difference|=a[i]^b[i];
 return difference===0;
}

function bytesToBase64(bytes){
 let binary='';
 for(let pos=0;pos<bytes.length;pos+=8192){
  binary+=String.fromCharCode(...bytes.subarray(pos,pos+8192));
 }
 return btoa(binary);
}

export function pcm16ToWav(pcm){
 if(!(pcm instanceof Uint8Array)||pcm.length%2||pcm.length<32000||pcm.length>DEVICE_MAX_INPUT_BYTES)throw Error('PCM_LENGTH');
 const wav=new Uint8Array(44+pcm.length),v=new DataView(wav.buffer);
 for(const [at,str] of [[0,'RIFF'],[8,'WAVE'],[12,'fmt '],[36,'data']])for(let i=0;i<str.length;i++)wav[at+i]=str.charCodeAt(i);
 v.setUint32(4,pcm.length+36,true);v.setUint32(16,16,true);v.setUint16(20,1,true);
 v.setUint16(22,1,true);v.setUint32(24,DEVICE_AUDIO_RATE,true);
 v.setUint32(28,DEVICE_AUDIO_RATE*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);
 v.setUint32(40,pcm.length,true);wav.set(pcm,44);return wav;
}

// The device only needs PCM; WAV decoding/resampling stays in the cloud.
export function wavToPcm16(bytes){
 if(!(bytes instanceof Uint8Array)||bytes.length<44||bytes.length>2400000)throw Error('WAV_SIZE');
 const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 const ascii=(i,n)=>String.fromCharCode(...bytes.subarray(i,i+n));
 if(ascii(0,4)!=='RIFF'||ascii(8,4)!=='WAVE')throw Error('WAV_HEADER');
 let fmt=null,data=null;
 for(let p=12;p+8<=bytes.length;){
  const n=v.getUint32(p+4,true),at=p+8;
  if(n>bytes.length-at)throw Error('WAV_CHUNK');
  if(ascii(p,4)==='fmt '&&n>=16)fmt={
   format:v.getUint16(at,true),channels:v.getUint16(at+2,true),
   sampleRate:v.getUint32(at+4,true),bits:v.getUint16(at+14,true)
  };
  if(ascii(p,4)==='data')data=bytes.subarray(at,at+n);
  p=at+n+(n&1);
 }
 if(!fmt||!data||![1,2].includes(fmt.channels)||fmt.sampleRate<8000||fmt.sampleRate>48000)throw Error('WAV_FORMAT');
 if(!((fmt.format===1&&[16,24,32].includes(fmt.bits))||(fmt.format===3&&fmt.bits===32)))throw Error('WAV_ENCODING');
 const stride=fmt.channels*(fmt.bits/8);
 const frames=Math.floor(data.length/stride);
 if(frames<1||frames/fmt.sampleRate>30)throw Error('WAV_DURATION');
 const dv=new DataView(data.buffer,data.byteOffset,data.byteLength);
 const read=(frame,channel)=>{
  const p=(frame*fmt.channels+channel)*(fmt.bits/8);
  if(fmt.format===3)return dv.getFloat32(p,true);
  if(fmt.bits===16)return dv.getInt16(p,true)/32768;
  if(fmt.bits===24){let n=data[p]|(data[p+1]<<8)|(data[p+2]<<16);if(n&0x800000)n-=0x1000000;return n/8388608;}
  return dv.getInt32(p,true)/2147483648;
 };
 const sample=i=>{
  const l=read(i,0);
  return fmt.channels===2?(l+read(i,1))/2:l;
 };
 const count=Math.min(Math.floor(frames*DEVICE_AUDIO_RATE/fmt.sampleRate),DEVICE_MAX_OUTPUT_BYTES/2);
 if(count<1)throw Error('WAV_EMPTY');
 const out=new Uint8Array(count*2),dest=new DataView(out.buffer);
 for(let i=0;i<count;i++){
  const src=i*fmt.sampleRate/DEVICE_AUDIO_RATE,a=Math.floor(src),b=Math.min(a+1,frames-1),t=src-a;
  dest.setInt16(i*2,s16(sample(a)*(1-t)+sample(b)*t),true);
 }
 return out;
}

async function buildAnswer(question,env,dependencies){
 const plan=dependencies.plan||runTravelAgent;
 const invoke=(messages,tools)=>env.AI.run('@cf/zai-org/glm-4.7-flash',{
  messages,tools,tool_choice:'required',parallel_tool_calls:false,
  max_completion_tokens:450,temperature:0.1,chat_template_kwargs:{enable_thinking:false}
 });
 const value=await plan({question,invoke});
 if(typeof value?.text!=='string'||!value.text.trim())throw Error('NO_ANSWER');
 return value.text.trim();
}

async function makeAudio(answer,env,dependencies){
 const content=answer.replace(/https?:\/\/\S+/g,'').slice(0,96);
 const speak=dependencies.speak||((text)=>env.AI.run(DEVICE_TTS_MODEL,{
  text,format:'wav',voice_id:'Chinese (Mandarin)_Warm_Girl',
  speed:1,volume:1,pitch:0
 }));
 const result=await speak(content);
 const remote=result?.audio??result?.result?.audio;
 if(typeof remote!=='string')throw Error('TTS_NO_AUDIO');
 const u=new URL(remote);
 if(u.protocol!=='https:'||u.username||u.password||u.port||!u.hostname.includes('.')||u.hostname==='localhost')throw Error('TTS_AUDIO_URL');
 // The URL is returned by the trusted TTS provider, never by the caller.
 const get=dependencies.fetchAudio||fetch;
 const response=await get(u.href,{redirect:'error',signal:AbortSignal.timeout(18000)});
 if(!response.ok||Number(response.headers.get('content-length')||0)>2400000)throw Error('TTS_DOWNLOAD');
 const reader=response.body?.getReader();
 if(!reader)throw Error('TTS_NO_BODY');
 const chunks=[];let total=0;
 try{
  for(;;){
   const {done,value}=await reader.read();if(done)break;
   total+=value.length;
   if(total>2400000){await reader.cancel();throw Error('TTS_TOO_BIG')}
   chunks.push(value);
  }
 }finally{reader.releaseLock()}
 const output=new Uint8Array(total);let pos=0;
 for(const chunk of chunks){output.set(chunk,pos);pos+=chunk.length}
 return wavToPcm16(output);
}

export async function handleDeviceVoice(request,env,dependencies={}){
 const pathname=new URL(request.url).pathname;
 if(pathname==='/health'&&request.method==='GET')return new Response(JSON.stringify({
  service:'jzzx-voice',version:1,ready:!!env.AI&&!!env.LIMITER&&typeof env.VOICE_DEVICE_CODE==='string'&&env.VOICE_DEVICE_CODE.length>=32
 }),{headers:{'content-type':'application/json','cache-control':'no-store'}});
 if(!['/api/device/talk','/api/device/ask'].includes(pathname))return error('NOT_FOUND',404);
 if(request.method!=='POST')return error('METHOD',405);
 if(!env.AI||!env.LIMITER||typeof env.VOICE_DEVICE_CODE!=='string')return error('NOT_CONFIGURED',503);
 const auth=request.headers.get('authorization')||'';
 if(!auth.startsWith('Bearer ')||!(await secretMatches(auth.slice(7),env.VOICE_DEVICE_CODE)))return error('UNAUTHORIZED',401);
 const ip=request.headers.get('cf-connecting-ip')||'device';
 try{if(!(await env.LIMITER.limit({key:ip})).success)return error('RATE_LIMIT',429);}
 catch{return error('RATE_UNAVAILABLE',503);}
 let question='';
 if(pathname==='/api/device/ask'){
  if(request.headers.get('content-type')?.split(';')[0]!=='application/json')return error('CONTENT_TYPE',415);
  if(Number(request.headers.get('content-length')||0)>1500)return error('TOO_LARGE',413);
  let json;try{json=JSON.parse(await request.text())}catch{return error('BAD_JSON',400)}
  question=typeof json?.question==='string'?json.question.trim():'';
  if(!question||question.length>300)return error('QUESTION',400);
 }else{
  if(request.headers.get('content-type')?.split(';')[0]!=='application/octet-stream')return error('CONTENT_TYPE',415);
  const n=Number(request.headers.get('content-length'));
  if(!Number.isInteger(n)||n<32000||n>DEVICE_MAX_INPUT_BYTES||n%2)return error('PCM_LENGTH',413);
  const reader=request.body?.getReader();
  if(!reader)return error('PCM_LENGTH',400);
  const bytes=new Uint8Array(n);let copied=0,overflow=false;
  try{
   for(;;){
    const {done,value}=await reader.read();if(done)break;
    if(value.length>n-copied){overflow=true;await reader.cancel();break}
    bytes.set(value,copied);copied+=value.length;
   }
  }finally{reader.releaseLock()}
  if(overflow||copied!==n)return error('PCM_LENGTH',400);
  try{
   const wav=pcm16ToWav(bytes);
   const res=await env.AI.run(DEVICE_STT_MODEL,{
    audio:bytesToBase64(wav),task:'transcribe',language:'zh',
    initial_prompt:'吉林旅游，长白山，雾凇岛，长春，延边，吉政知行，吉小知'
   });
   question=typeof res?.text==='string'?res.text.trim():'';
  }catch{return error('STT_FAILED',502)}
  if(!question)return error('NO_SPEECH',422);
  question=question.slice(0,300);
 }
 try{
  const answer=await buildAnswer(question,env,dependencies);
  if(pathname==='/api/device/ask')return new Response(JSON.stringify({question,answer}),{
   headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}
  });
  const pcm=await makeAudio(answer,env,dependencies);
  return new Response(pcm,{headers:{
   'content-type':'application/octet-stream',
   'content-length':String(pcm.length),
   'x-audio-format':'pcm_s16le_16000_mono',
   'cache-control':'no-store',
   'x-content-type-options':'nosniff'
  }});
 }catch{return error('VOICE_PIPELINE_FAILED',502)}
}
