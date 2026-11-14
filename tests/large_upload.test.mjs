import test from 'node:test';
import assert from 'node:assert/strict';
import {handleApi} from '../src/worker.mjs';
import {filePolicy,MAX_DOCUMENT_BYTES,CHUNK_BYTES,openLargeFile,streamMultipartFile,readTicket} from '../src/uploads.mjs';

const origin='https://test.example';
const secret='test-signing-secret-with-more-than-24-chars';

function mockBucket(){
  const storage=new Map();const uploads=new Map();
  return {
    storage,uploads,
    async createMultipartUpload(key){uploads.set(key,{id:'upload-1',parts:[]});return {key,uploadId:'upload-1'};},
    resumeMultipartUpload(key,id){
      const session=uploads.get(key);
      if(!session||id!==session.id)throw Error('No upload');
      return {
        async uploadPart(partNumber,data){session.parts[partNumber]=data;return {partNumber,etag:'etag-'+partNumber};},
        async complete(parts){assert.equal(parts.length,session.parts.filter(Boolean).length);storage.set(key,{size:session.size||0,body:new Blob(['test']).stream()});return {size:session.size||0};},
        async abort(){uploads.delete(key);}
      };
    },
    async get(key){return storage.get(key)||null;},
    async head(key){return storage.get(key)||null;},
    async delete(key){storage.delete(key);}
  };
}
const buildEnv=()=>({UPLOADS:mockBucket(),UPLOAD_SIGNING_KEY:secret,DEEPSEEK_API_KEY:'mock-api-key',LIMITER:{limit:async()=>({success:true})}});
function call(path,method,body,headers={}){
  const binary=body instanceof Blob;
  return new Request(origin+path,{method,headers:{origin,...(binary?{}:{'content-type':'application/json'}),...headers},body:binary?body:JSON.stringify(body)});
}

test('official DeepSeek type limits; 100 MB documents, not all file types',()=>{
  assert.equal(filePolicy('hello.pdf',100_000_000).ok,true);
  assert.equal(filePolicy('hello.pdf',100_000_001).ok,false);
  assert.equal(filePolicy('photo.png',65*1024*1024).ok,false);
  assert.equal(filePolicy('table.xlsx',33*1024*1024).ok,false);
  assert.equal(filePolicy('readme.md',1024).ok,true);
});

test('unconfigured storage fails rather than suggesting large upload works',async()=>{
  const r=await handleApi(call('/api/upload/start','POST',{name:'test.pdf',size:9_000_000}),{});
  assert.equal(r.status,503);assert.equal((await r.json()).error,'UPLOAD_UNCONFIGURED');
});

test('signed large-document session and tampering protection',async()=>{
  const env=buildEnv();
  const r=await handleApi(call('/api/upload/start','POST',{name:'guide.pdf',size:MAX_DOCUMENT_BYTES}),env);
  assert.equal(r.status,200);const {ticket,chunkBytes,parts}=await r.json();
  assert.equal(chunkBytes,CHUNK_BYTES);assert.equal(parts,Math.ceil(MAX_DOCUMENT_BYTES/CHUNK_BYTES));
  assert.equal((await readTicket(secret,ticket)).size,MAX_DOCUMENT_BYTES);
  assert.equal(await readTicket(secret,ticket.slice(0,-1)+'x'),null);
  assert.equal((await handleApi(call('/api/upload/complete','POST',{ticket:ticket.slice(0,-1)+'x',parts:[]}),env)).status,403);
});

test('upload parts are size-verified and completed, R2 content can be passed to DeepSeek',async()=>{
  const env=buildEnv();
  const size=CHUNK_BYTES+21;
  const start=await handleApi(call('/api/upload/start','POST',{name:'public-guide.pdf',size}),env);
  const {ticket}=await start.json();const session=await readTicket(secret,ticket);env.UPLOADS.uploads.get(session.key).size=size;
  const all=[];
  for(const [i,bytes] of [[1,CHUNK_BYTES],[2,21]]){
    const part=await handleApi(call('/api/upload/part','PUT',new Blob([new Uint8Array(bytes)]),{'x-part-number':String(i),'x-upload-ticket':ticket}),env);
    assert.equal(part.status,200);all.push(await part.json());
  }
  const done=await handleApi(call('/api/upload/complete','POST',{ticket,parts:all}),env);
  assert.equal(done.status,200);assert.equal((await done.json()).ready,true);
  const stored=await openLargeFile(env,ticket);assert.equal(stored.session.size,size);
  const multipart=streamMultipartFile({body:new Blob(['PDF data']).stream()},'guide.pdf','text_recognition');
  const text=await new Response(multipart.body).text();
  assert.match(text,/name="purpose"/);assert.match(text,/text_recognition/);assert.match(text,/PDF data/);
  assert.match(multipart.headers['content-type'],/^multipart\/form-data; boundary=/);
});

test('completed large file travels via streaming request, is deleted after answer',async()=>{
  const env=buildEnv();const size=CHUNK_BYTES+10;
  const start=await handleApi(call('/api/upload/start','POST',{name:'policy.pdf',size}),env);const {ticket}=await start.json();
  const session=await readTicket(secret,ticket);
  env.UPLOADS.storage.set(session.key,{size,body:new Blob(['PDF public policy content']).stream()});
  const original=globalThis.fetch;let sawStream=false;
  globalThis.fetch=async (url,opts)=>{
    if(String(url).endsWith('/files')){
      assert.equal(opts.duplex,'half');assert.ok(opts.body instanceof ReadableStream);
      sawStream=true;return Response.json({id:'file-api-test'});
    }
    return Response.json({choices:[{message:{content:'请通过官方渠道确认办理条件。'}}]});
  };
  try{
    const response=await handleApi(call('/api/chat','POST',{question:'请解释这份政策',attachmentToken:ticket}),env);
    assert.equal(response.status,200);
    assert.equal((await response.json()).model,'deepseek-flash');
    assert.equal(sawStream,true);assert.equal(env.UPLOADS.storage.has(session.key),false);
  }finally{globalThis.fetch=original;}
});

test('origin check protects large upload endpoints from foreign browser origins',async()=>{
  const env=buildEnv();const req=call('/api/upload/start','POST',{name:'policy.pdf',size:11_000_000},{origin:'https://foreign.example'});
  assert.equal((await handleApi(req,env)).status,403);
});
