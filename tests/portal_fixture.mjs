import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
function database(){
 const s=new DatabaseSync(':memory:');s.exec(readFileSync(new URL('../migrations/portal/0001_feedback.sql',import.meta.url),'utf8'));
 s.exec("INSERT INTO portal_merchants(id,name,region) VALUES('m1','商户一','吉林市'),('m2','商户二','长春市'),('m3','商户三','吉林市')");
 return {prepare(sql){return {bind(...p){const q=s.prepare(sql);return {first:async()=>q.get(...p)||null,all:async()=>({results:q.all(...p)}),run:async()=>q.run(...p)}}}}};
}
const actors=[['touristA','tourist','吉林市'],['touristB','tourist','吉林市'],['merchantA','merchant','吉林市','m1'],['merchantB','merchant','吉林市','m3'],['govA','government','吉林市'],['govB','government','长春市']];
export const key=id=>'test-'+id+'-long-credential-000000000000000000';
export function environment(){return {PORTAL_DB:database(),PORTAL_LIMITER:{limit:async()=>({success:true})},PORTAL_ACTORS:JSON.stringify(actors.map(([id,role,region,merchantId])=>({id,role,region,merchantId,keyHash:createHash('sha256').update(key(id)).digest('hex')})))}}
