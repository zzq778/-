import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const site=new URL('../mobile/site/',import.meta.url);
const names=['hero','orb','mountain','winter','yanbian','city'];
test('six local travel illustrations are alpha-enabled WebP assets with a bounded total size',()=>{
 let total=0;
 for(const name of names){
  const b=readFileSync(new URL('art/'+name+'.webp',site));
  assert.equal(b.subarray(0,4).toString(),'RIFF');
  assert.equal(b.subarray(8,12).toString(),'WEBP');
  assert.equal(b.subarray(12,16).toString(),'VP8X');
  assert.ok(b[20]&0x10,name+' alpha flag');
  total+=b.length;
 }
 assert.ok(total<250000);
});
test('mobile bundle embeds the real artwork and stylesheet with no relative references',()=>{
 const dir=mkdtempSync(join(tmpdir(),'jzzx-art-'));
 try{
  const output=join(dir,'index.html');
  execFileSync('python3',[new URL('../mobile/android/bundle_site.py',import.meta.url).pathname,site.pathname,output]);
  const html=readFileSync(output,'utf8');
  assert.match(html,/Visual layer for mobile v0\.9\.2/);
  assert.match(html,/id="modeBadge"/);
  assert.doesNotMatch(html,/data-bundle-art/);
  assert.doesNotMatch(html,/(?:src|href)=["']\.\/art\//);
  assert.ok(Buffer.byteLength(html)<600000);
  for(const name of names){
   const encoded=readFileSync(new URL('art/'+name+'.webp',site)).toString('base64');
   assert.ok(html.includes('data:image/webp;base64,'+encoded),name);
  }
 }finally{rmSync(dir,{recursive:true,force:true});}
});
