import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const site=new URL('../mobile/site/',import.meta.url);
const names=["chaganhu-winter-1d","changbaishan-north-2d","changbaishan-west-3d","changchun-city-1d","changchun-family-1d","hero","jian-history-2d","jilin-lake-2d","jilin-wusong-2d","mountain","siping-red-1d","xianghai-birds-2d","yanbian-border-2d","yanbian-food-2d"];
test('fourteen local travel illustrations are alpha-enabled WebP assets with a bounded total size',()=>{
 let total=0;
 const routeHashes=new Set();
 for(const name of names){
  const b=readFileSync(new URL('art/'+name+'.webp',site));
  assert.equal(b.subarray(0,4).toString(),'RIFF');
  assert.equal(b.subarray(8,12).toString(),'WEBP');
  assert.equal(b.subarray(12,16).toString(),'VP8X');
  assert.ok(b[20]&0x10,name+' alpha flag');
  total+=b.length;
  if(!['hero','mountain'].includes(name))routeHashes.add(createHash('sha256').update(b).digest('hex'));
 }
 assert.equal(routeHashes.size,12,'each route has unique artwork');
 assert.ok(total<1500000);
});
test('mobile bundle embeds the real artwork and stylesheet with no relative references',()=>{
 const dir=mkdtempSync(join(tmpdir(),'jzzx-art-'));
 try{
  const output=join(dir,'index.html');
  execFileSync('python3',[
   fileURLToPath(new URL('../mobile/android/bundle_site.py',import.meta.url)),
   fileURLToPath(site),
   output,
  ]);
  const html=readFileSync(output,'utf8');
  assert.match(html,/Visual layer for mobile v0\.9\.7/);
  assert.match(html,/id="modeBadge"/);
  assert.doesNotMatch(html,/data-bundle-art/);
  assert.doesNotMatch(html,/(?:src|href)=["']\.\/art\//);
  assert.doesNotMatch(html,/data-bundle-workspaces/);
  assert.match(html,/window\.JZZX_WORKSPACES=/);
  assert.ok(Buffer.byteLength(html)<2300000, 'bundle bytes: '+Buffer.byteLength(html));
  for(const name of names){
   const encoded=readFileSync(new URL('art/'+name+'.webp',site)).toString('base64');
   assert.ok(html.includes('data:image/webp;base64,'+encoded),name);
  }
 }finally{rmSync(dir,{recursive:true,force:true});}
});
