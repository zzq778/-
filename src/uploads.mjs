// Large-file transfer: 8 MiB chunks -> private R2 multipart -> stream to DeepSeek.
// Keeps the existing small-file /api/chat path unchanged.
export const DIRECT_BYTES = 8 * 1024 * 1024;
export const CHUNK_BYTES = 8 * 1024 * 1024;
export const MAX_DOCUMENT_BYTES = 100_000_000; // 100 MB, decimal, intentionally under Cloudflare's single-request limit
const MB32 = 32 * 1024 * 1024;
const MB64 = 64 * 1024 * 1024;
const EXTENSIONS = new Set(['jpg','jpeg','png','webp','gif','pdf','doc','docx','ppt','pptx','xls','xlsx','txt','md','csv']);
const IMAGE = new Set(['jpg','jpeg','png','webp','gif']);
const OFFICE = new Set(['pdf','doc','docx','ppt','pptx']);
const textEncoder = new TextEncoder();
const response = (data, status=200) => new Response(JSON.stringify(data), {
  status, headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}
});

export function filePolicy(name, size) {
  const extension = typeof name === 'string' ? name.split('.').at(-1)?.toLowerCase() : '';
  if (!EXTENSIONS.has(extension)) return {ok:false,status:415,message:'不支持该文件类型'};
  const limit = IMAGE.has(extension) ? MB64 : OFFICE.has(extension) ? MAX_DOCUMENT_BYTES : MB32;
  if (!Number.isSafeInteger(size) || size <= 0 || size > limit) return {
    ok:false,status:413,message:`该文件类型上限为 ${IMAGE.has(extension)?'64 MiB':OFFICE.has(extension)?'100 MB':'32 MiB'}`
  };
  return {ok:true,extension,limit,purpose:OFFICE.has(extension)?'text_recognition':'user_data'};
}

const cleanName = value => String(value||'').replace(/[\r\n\x00-\x1f"\\]/g,'_').slice(0,90);
const b64url = bytes => btoa(Array.from(bytes, x=>String.fromCharCode(x)).join('')).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const bytesFromB64 = str => Uint8Array.from(atob(str.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-str.length%4)%4)),c=>c.charCodeAt(0));
async function mac(secret,text) {
  const key=await crypto.subtle.importKey('raw',textEncoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return b64url(new Uint8Array(await crypto.subtle.sign('HMAC',key,textEncoder.encode(text))));
}
async function makeTicket(secret,payload) {
  const body=b64url(textEncoder.encode(JSON.stringify(payload)));
  return `${body}.${await mac(secret,body)}`;
}
export async function readTicket(secret,ticket) {
  if (typeof secret !== 'string' || secret.length<24 || typeof ticket !== 'string' || ticket.length>1300 || !/^[\w-]+\.[\w-]+$/.test(ticket)) return null;
  try {
    const [body,signature]=ticket.split('.');
    const expected=await mac(secret,body);
    // Length and comparison are fixed with a constant-time byte loop.
    if(signature.length!==expected.length)return null;
    let difference=0;
    for(let i=0;i<expected.length;i++) difference |= signature.charCodeAt(i)^expected.charCodeAt(i);
    if(difference)return null;
    const data=JSON.parse(new TextDecoder().decode(bytesFromB64(body)));
    if(data.expires<Date.now()||data.expires>Date.now()+2*60*60*1000||typeof data.key!=='string'||!/^temp\/[\da-f-]{36}$/.test(data.key)||typeof data.uploadId!=='string'||data.uploadId.length>250||!filePolicy(data.name,data.size).ok)return null;
    return data;
  }catch{return null;}
}

async function readLimited(body, expectedSize) {
  if(!body)throw Error('Missing body');
  const chunks=[];let size=0;
  const reader=body.getReader();
  try {
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>expectedSize)throw Error('Oversized part');chunks.push(value);}
  }finally{reader.releaseLock();}
  if(size!==expectedSize)throw Error('Incomplete part');
  const result=new Uint8Array(size);let offset=0;
  for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.byteLength;}
  return result;
}
export async function handleUploadApi(request,env) {
  const path=new URL(request.url).pathname;
  if(!['/api/upload/start','/api/upload/part','/api/upload/complete','/api/upload/abort'].includes(path))return response({error:'NOT_FOUND'},404);
  if(!env.UPLOADS || typeof env.UPLOAD_SIGNING_KEY!=='string'||env.UPLOAD_SIGNING_KEY.length<24)return response({error:'UPLOAD_UNCONFIGURED',message:'大文件服务尚未启用'},503);
  const url=new URL(request.url);
  const origin=request.headers.get('origin');
  if(origin&&origin!==url.origin)return response({error:'ORIGIN',message:'不接受跨站请求'},403);
  const isPart=path.endsWith('/part');
  if(request.method !== (isPart?'PUT':'POST'))return response({error:'METHOD'},405);
  try {
    if(path.endsWith('/start')){
      if(env.LIMITER){const ip=request.headers.get('cf-connecting-ip')||'unknown';if(!(await env.LIMITER.limit({key:ip})).success)return response({error:'RATE_LIMIT',message:'上传过于频繁'},429);}
      const raw=await request.text();if(raw.length>1024)return response({error:'TOO_LARGE'},413);
      const {name,size}=JSON.parse(raw);
      const policy=filePolicy(name,size);
      if(!policy.ok)return response({error:'FILE_INVALID',message:policy.message},policy.status);
      if(size<=DIRECT_BYTES)return response({error:'USE_DIRECT',message:'小文件请使用普通上传'},400);
      const key=`temp/${crypto.randomUUID()}`;
      const created=await env.UPLOADS.createMultipartUpload(key);
      const ticket=await makeTicket(env.UPLOAD_SIGNING_KEY,{key,uploadId:created.uploadId,name:cleanName(name),size,expires:Date.now()+2*60*60*1000});
      return response({ticket,chunkBytes:CHUNK_BYTES,parts:Math.ceil(size/CHUNK_BYTES)});
    }
    const command=isPart?null:await request.json();
    const ticket=isPart?request.headers.get('x-upload-ticket'):command?.ticket;
    const session=await readTicket(env.UPLOAD_SIGNING_KEY,ticket);
    if(!session)return response({error:'UPLOAD_SESSION',message:'上传凭据无效或已过期'},403);
    const upload=env.UPLOADS.resumeMultipartUpload(session.key,session.uploadId);
    if(isPart){
      const n=Number(request.headers.get('x-part-number'));
      const count=Math.ceil(session.size/CHUNK_BYTES);
      if(!Number.isInteger(n)||n<1||n>count)return response({error:'PART_NUMBER'},400);
      const expected=n===count?session.size-(n-1)*CHUNK_BYTES:CHUNK_BYTES;
      const declared=Number(request.headers.get('content-length')||expected);
      if(declared!==expected)return response({error:'PART_SIZE',message:'分块大小不正确'},413);
      const buffer=await readLimited(request.body,expected);
      const part=await upload.uploadPart(n,buffer);
      return response({partNumber:part.partNumber,etag:part.etag});
    }
    if(path.endsWith('/abort')){await upload.abort();return response({ok:true});}
    const raw=await env.UPLOADS.head(session.key);
    if(raw)return response({error:'ALREADY_COMPLETED'},409);
    // We intentionally parse only the tiny list of part etags, not any file data.
    const body=command;
    const expected=Math.ceil(session.size/CHUNK_BYTES);
    if(!Array.isArray(body.parts)||body.parts.length!==expected||body.parts.some((p,i)=>p.partNumber!==i+1||typeof p.etag!=='string'||p.etag.length>128))return response({error:'PARTS_INVALID'},400);
    const object=await upload.complete(body.parts);
    if(object.size!==session.size){await env.UPLOADS.delete(session.key);return response({error:'SIZE_MISMATCH'},400);}
    return response({ticket,ready:true});
  }catch(e){console.error('R2 large upload',e?.name||'Error');return response({error:'UPLOAD_FAILED',message:'文件传输失败，请重试'},502);}
}

export async function openLargeFile(env,ticket){
  const session=await readTicket(env.UPLOAD_SIGNING_KEY,ticket);
  if(!session||!env.UPLOADS)return null;
  const object=await env.UPLOADS.get(session.key);
  if(!object||object.size!==session.size)return null;
  return {object,session};
}

// Supply a streamed multipart/form-data request without buffering 100 MB in a 128 MB Worker.
export function streamMultipartFile(object, filename, purpose) {
  const boundary='----jzzx'+crypto.randomUUID().replace(/-/g,'');
  const extension=filename.split('.').at(-1)?.toLowerCase()||'bin';
  const safeAsciiName=`attachment.${extension}`;
  const start=textEncoder.encode(`--${boundary}\r\nContent-Disposition: form-data; name="purpose"\r\n\r\n${purpose}\r\n--${boundary}\r\nContent-Disposition: form-data; name="expires_after[anchor]"\r\n\r\ncreated_at\r\n--${boundary}\r\nContent-Disposition: form-data; name="expires_after[seconds]"\r\n\r\n3600\r\n--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${safeAsciiName}"\r\nContent-Type: application/octet-stream\r\n\r\n`);
  const end=textEncoder.encode(`\r\n--${boundary}--\r\n`);
  const reader=object.body.getReader();let phase=0;
  const body=new ReadableStream({
    async pull(controller){
      if(phase===0){controller.enqueue(start);phase=1;return;}
      if(phase===1){const {done,value}=await reader.read();if(!done){controller.enqueue(value);return;}phase=2;}
      if(phase===2){controller.enqueue(end);controller.close();phase=3;reader.releaseLock();}
    },
    async cancel(reason){try{await reader.cancel(reason);}finally{reader.releaseLock();}}
  });
  return {body,headers:{'content-type':`multipart/form-data; boundary=${boundary}`}};
}
