import {DatabaseSync} from 'node:sqlite';
import {readFileSync,mkdirSync} from 'node:fs';
import {dirname,resolve,basename} from 'node:path';
import {randomBytes,createHash} from 'node:crypto';
import {handlePortal} from '../../src/portal-service.mjs';

const ACTORS={
 tourist:{id:'demo-tourist',role:'tourist',region:'吉林市'},
 merchant:{id:'demo-merchant',role:'merchant',region:'吉林市',merchantId:'demo-m1'},
 government:{id:'demo-government',role:'government',region:'吉林市'},
 'other-merchant':{id:'demo-other-merchant',role:'merchant',region:'吉林市',merchantId:'demo-m2'},
 'other-government':{id:'demo-other-government',role:'government',region:'长春市'},
 'other-tourist':{id:'demo-other-tourist',role:'tourist',region:'吉林市'}
};
export function demoPortal(path,role){
 if(!Object.hasOwn(ACTORS,role))throw Error('INVALID_DEMO_ROLE');
 const file=resolve(path);if(basename(file)!=='jzzx-demo.sqlite')throw Error('DEMO_DB_FILENAME_REQUIRED');
 mkdirSync(dirname(file),{recursive:true});
 const db=new DatabaseSync(file);
 db.exec('PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;');
 db.exec('CREATE TABLE IF NOT EXISTS jzzx_demo_marker (id INTEGER PRIMARY KEY CHECK(id=1));');
 // This filename and isolated directory are mandatory; no production DB is read or written.
 db.exec(readFileSync(new URL('../../migrations/portal/0001_feedback.sql',import.meta.url),'utf8'));
 db.exec('INSERT OR IGNORE INTO jzzx_demo_marker VALUES(1)');
 const insert=db.prepare('INSERT OR IGNORE INTO portal_merchants(id,name,region) VALUES(?,?,?)');
 insert.run('demo-m1','演示商户·松江民宿（虚构）','吉林市');
 insert.run('demo-m2','演示商户·江畔客栈（虚构）','吉林市');
 insert.run('demo-m3','演示商户·长春旅店（虚构）','长春市');
 const key=randomBytes(32).toString('base64url'),actor={...ACTORS[role],keyHash:createHash('sha256').update(key).digest('hex')};
 const env={PORTAL_DB:{prepare(sql){return {bind(...args){const q=db.prepare(sql);return {first:async()=>q.get(...args)||null,all:async()=>({results:q.all(...args)}),run:async()=>q.run(...args)}}}}},PORTAL_ACTORS:JSON.stringify([actor]),PORTAL_LIMITER:{limit:async()=>({success:true})}};
 return {role:actor.role,async request(path,body){
  const r=await handlePortal(new Request('https://demo.invalid/api/v1/portal/'+path,{method:body?'POST':'GET',headers:{authorization:'Bearer '+key,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),env);
  const result=await r.json();if(!r.ok)throw Error(result.error||'DEMO_HTTP_'+r.status);
  return {...result,environment:'本机演示数据库：商户及身份均为虚构，非真实政务或经营数据'};
 },close(){db.close()}};
}
