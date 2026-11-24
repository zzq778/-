import test from 'node:test';import assert from 'node:assert/strict';import {handleImage,IMAGE_MODEL,validJpeg} from '../src/image-service.mjs';
const secret='test-image-key-0000000000000000000000',origin='https://example.test';
const input=(code=secret,body={prompt:'冬季民宿插画',confirm:true})=>new Request(origin+'/api/v1/images',{method:'POST',headers:{authorization:'Bearer '+code},body:JSON.stringify(body)});
// Minimal fixture with JPEG markers; not used as an actual generated image or customer-facing output.
const base64=Buffer.from([255,216,255,224,0,8,74,70,73,70,0,255,217]).toString('base64');
test('image endpoint requires deployment flag, separate credential and explicit confirmation',async()=>{
 let calls=0;const env={IMAGE_GENERATION_ENABLED:'true',IMAGE_ACCESS_CODE:secret,LIMITER:{limit:async()=>({success:true})},AI:{run:async(model,opts)=>{calls++;assert.equal(model,IMAGE_MODEL);assert.match(opts.prompt,/冬季民宿/);return {image:base64}}}};
 assert.equal((await handleImage(input(),{...env,IMAGE_GENERATION_ENABLED:'false'})).status,503);
 assert.equal((await handleImage(input('bad'),env)).status,401);
 assert.equal((await handleImage(input(secret,{prompt:'冬季民宿插画'}),env)).status,400);
 assert.equal(calls,0);const res=await handleImage(input(),env);assert.equal(res.status,200);const x=await res.json();assert.equal(x.base64,base64);assert.equal(x.mime,'image/jpeg');assert.equal(calls,1);
});
test('model errors or invalid image do not claim success',async()=>{
 const env={IMAGE_GENERATION_ENABLED:'true',IMAGE_ACCESS_CODE:secret,LIMITER:{limit:async()=>({success:true})},AI:{run:async()=>({image:'not-image'})}};
 assert.equal((await handleImage(input(),env)).status,502);
 assert.equal(validJpeg('not-image'),false);env.AI.run=async()=>{throw Error('provider')};assert.equal((await handleImage(input(),env)).status,503);
});
