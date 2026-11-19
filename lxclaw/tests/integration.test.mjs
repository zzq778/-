import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {createInterface} from 'node:readline';
import {mkdtemp,rm,readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {makeTools} from '../mcp-server/tools.mjs';
import {demoPortal} from '../mcp-server/demo.mjs';
import {DatabaseSync} from 'node:sqlite';

const server=fileURLToPath(new URL('../mcp-server/server.mjs',import.meta.url));
const install=fileURLToPath(new URL('../install.mjs',import.meta.url));
function client(args){
 const child=spawn(process.execPath,[server,...args],{stdio:['pipe','pipe','pipe']});
 let serial=0;const queue=new Map();let logs='';
 child.stderr.on('data',b=>{logs+=b.toString().slice(0,3000)});
 const lines=createInterface({input:child.stdout,crlfDelay:Infinity});
 lines.on('line',line=>{try{const x=JSON.parse(line),p=queue.get(x.id);if(p){clearTimeout(p.timer);queue.delete(x.id);p.resolve(x)}}catch(e){for(const p of queue.values())p.reject(Error('Non-protocol stdout: '+line));queue.clear()}});
 let resolveExit;const closed=new Promise(r=>resolveExit=r);
 child.on('exit',()=>{for(const p of queue.values()){clearTimeout(p.timer);p.reject(Error('Child exited: '+logs))}queue.clear();resolveExit()});
 const rpc=(method,params={})=>new Promise((resolve,reject)=>{
  const id=++serial,timer=setTimeout(()=>{queue.delete(id);reject(Error('MCP timeout: '+method+' '+logs))},10000);
  queue.set(id,{resolve,reject,timer});child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');
 });
 return {rpc,async init(version='2025-06-18'){const r=await rpc('initialize',{protocolVersion:version,capabilities:{},clientInfo:{name:'independent-test',version:'1'}});assert.equal(r.result.protocolVersion,version);child.stdin.write('{"jsonrpc":"2.0","method":"notifications/initialized"}\n');return r.result},async call(name,args={},isError=false){const r=await rpc('tools/call',{name,arguments:args});assert.equal(r.result?.isError,isError,JSON.stringify(r));return isError?r.result.content[0].text:JSON.parse(r.result.content[0].text)},async list(){return (await rpc('tools/list')).result.tools.map(x=>x.name)},async close(){child.stdin.end();const timer=setTimeout(()=>child.kill(),2000);try{await closed}finally{clearTimeout(timer)}}}
}
const cleanup=new WeakMap();
function resources(t){
 if(!cleanup.has(t)){
  const r={clients:[],dirs:[]};cleanup.set(t,r);
  t.after(async()=>{
   // Windows SQLite files cannot be removed while child processes still own handles.
   await Promise.allSettled(r.clients.map(c=>c.close()));
   for(const dir of r.dirs)await rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:150});
  });
 }return cleanup.get(t);
}
async function temp(t){const dir=await mkdtemp(join(tmpdir(),'jzzx-lxclaw-'));resources(t).dirs.push(dir);return dir}
async function using(t,args){const c=client(args);resources(t).clients.push(c);await c.init();return c}
test('independent MCP process: discover, search, inspect, selected plan, replan, constraints and export',async t=>{
 const dir=await temp(t),c=await using(t,['--output',dir]);
 assert.ok((await c.list()).includes('jzzx_plan_trip'));assert.ok(!(await c.list()).includes('jzzx_submit_feedback'));
 const q='吉林市冬天两天带父母看雾凇，不想滑雪';
 const found=await c.call('jzzx_search_places',{query:q,exclude:['滑雪'],limit:12});
 assert.ok(found.candidates.some(x=>x.id==='wusongdao'));
 assert.ok(found.candidates.every(x=>x.sources.length&&x.area==='吉林市'));
 const place=await c.call('jzzx_read_place',{id:'jingyuetan'});assert.match(place.name,/净月潭/);assert.ok(place.sources.some(s=>s.url.includes('ijingyuetan')));
 assert.equal(await c.call('jzzx_read_place',{id:'fake'},true),'UNKNOWN_PLACE');
 const input={requirements:q,selectedIds:['wusongdao','jilin-bowuguan'],exclude:['滑雪']};
 const plan=await c.call('jzzx_plan_trip',input);
 assert.equal(plan.status,'complete');assert.equal(plan.itinerary.days,2);assert.ok(plan.check.ok);
 assert.deepEqual(new Set(plan.itinerary.plan.flatMap(d=>d.nodes.map(n=>n.attractionId))),new Set(input.selectedIds));
 const one=await c.call('jzzx_plan_trip',{...input,requirements:q.replace('两天','一天')});
 assert.equal(one.itinerary.days,1);assert.ok(one.itinerary.plan.flatMap(d=>d.nodes).every(n=>n.area==='吉林市'&&!n.name.includes('滑雪')));
 assert.equal(await c.call('jzzx_plan_trip',{...input,selectedIds:['fake']},true),'INVALID_SELECTION');
 assert.equal(await c.call('jzzx_plan_trip',{...input,selectedIds:['jingyuetan']},true),'INVALID_SELECTION');
 assert.equal((await c.call('jzzx_plan_trip',{requirements:'延边五天'})).status,'clarify');
 const file=await c.call('jzzx_export_trip',input);
 const html=await readFile(file.artifact.path,'utf8');assert.match(html,/雾凇岛/);assert.match(html,/参考来源/);assert.equal(dirname(file.artifact.path),dir);
 const services=await c.call('jzzx_search_services',{query:'身份证到期换领',region:'长春市'});assert.ok(services.items.some(x=>x.id==='cert'));
 const guide=await c.call('jzzx_read_service_guide',{serviceId:'cert',region:'长春市'});assert.match(guide.source.url,/zwfw\.jl\.gov\.cn/);assert.equal(guide.source.specific,false);
 assert.equal(await c.call('jzzx_search_services',{query:'医保',region:'错误地区'},true),'INVALID_ARGUMENTS');
 assert.equal(await c.call('jzzx_status',{secret:'x'},true),'INVALID_ARGUMENTS');
 const r=await c.rpc('not/a/method');assert.equal(r.error.code,-32601);
});
test('real persistent SQL across independent MCP clients: tourist, merchant, government, negative scopes',async t=>{
 const dir=await temp(t),db=join(dir,'jzzx-demo.sqlite');
 const make=role=>using(t,['--mode','demo','--role',role,'--demo-db',db,'--output',dir]);
 const tourist=await make('tourist'),merchant=await make('merchant'),gov=await make('government');
 const other=await make('other-merchant'),otherGov=await make('other-government'),otherTourist=await make('other-tourist');
 const list=await tourist.call('jzzx_list_merchants');assert.ok(list.items.every(x=>x.name.includes('虚构')));
 assert.match(list.environment,/虚构/);
 const input={merchantId:'demo-m1',category:'设施与环境',text:'合成测试：停车指引不清',requestId:'demo-feedback-1',confirm:true};
 assert.equal(await tourist.call('jzzx_submit_feedback',{...input,confirm:false},true),'CONFIRMATION_REQUIRED');
 assert.equal(await tourist.call('jzzx_submit_feedback',{...input,text:'电话13812345678'},true),'SENSITIVE_DATA_REJECTED');
 const posted=await tourist.call('jzzx_submit_feedback',input);assert.equal(posted.status,'stored');
 assert.equal((await tourist.call('jzzx_submit_feedback',input)).id,posted.id);
 assert.equal(await tourist.call('jzzx_submit_feedback',{...input,text:'变化内容'},true),'REQUEST_ID_CONFLICT');
 assert.equal((await merchant.call('jzzx_list_feedback')).items[0].id,posted.id);
 assert.equal((await gov.call('jzzx_feedback_summary')).total,1);
 assert.equal((await other.call('jzzx_list_feedback')).items.length,0);
 assert.equal((await otherGov.call('jzzx_feedback_summary')).total,0);
 assert.equal((await otherTourist.call('jzzx_list_feedback')).items.length,0);
 assert.equal(await tourist.call('jzzx_reply_feedback',{},true),'UNKNOWN_TOOL');
 const reply={feedbackId:posted.id,text:'合成答复：将核对标识',requestId:'demo-reply-1',confirm:true};
 assert.equal(await other.call('jzzx_reply_feedback',reply,true),'NOT_FOUND');
 const answered=await merchant.call('jzzx_reply_feedback',reply);assert.equal(answered.status,'stored');
 assert.equal((await merchant.call('jzzx_reply_feedback',reply)).id,answered.id);
 const visible=(await tourist.call('jzzx_list_feedback')).items[0];assert.equal(visible.status,'answered');assert.equal(visible.replies.length,1);
 assert.match(visible.replies[0].body,/核对标识/);
 const report=await gov.call('jzzx_export_feedback_report');
 assert.match(await readFile(report.report.path,'utf8'),/本机演示数据库/);
 assert.match(await readFile(report.table.path,'utf8'),/"设施与环境","1","1","0"/);
 const restarted=await make('tourist');assert.equal((await restarted.call('jzzx_list_feedback')).items[0].id,posted.id);
});
test('do not open existing non-demo SQLite file',async t=>{
 const dir=await temp(t),file=join(dir,'jzzx-demo.sqlite'),db=new DatabaseSync(file);db.exec('CREATE TABLE real_data(id INTEGER)');db.close();
 assert.throws(()=>demoPortal(file,'tourist'),/REFUSE_NON_DEMO_DATABASE/);
});
test('cloud adapter: fixed endpoint, role checked, no automatic production writes, redaction and separate credentials',async t=>{
 const dir=await temp(t),calls=[];
 const fetcher=async(url,options)=>{calls.push({url,options});let data={};
  if(url.endsWith('/me'))data={role:'tourist',region:'吉林市'};
  if(url.endsWith('/feedback'))data={items:[{id:'f',body:'含原始电话13812345678',replies:[]}]};
  if(url.endsWith('/api/v1/chat'))data={status:'complete',text:'测试'};
  if(url.endsWith('/status'))data={ready:true};
  return new Response(JSON.stringify(data),{status:200})
 };
 const c=makeTools({mode:'cloud',role:'tourist',output:dir,env:{JZZX_PORTAL_CODE:'portal-distinct',JZZX_AGENT_CODE:'agent-distinct'},fetcher});
 assert.ok(!c.list().some(x=>x.name==='jzzx_submit_feedback'));
 assert.ok(!c.list().some(x=>x.name==='jzzx_generate_image'));
 const result=await c.call('jzzx_list_feedback',{});assert.equal(result.items[0].body,undefined);
 const draft=await c.call('jzzx_prepare_business_draft',{merchantId:'m',category:'其他',text:'停车指引不清'});
 assert.match(draft.scope,/尚未提交/);assert.ok(JSON.parse(await readFile(draft.artifact.path,'utf8')).requestId);
 await c.call('jzzx_ask_jixiaozhi',{question:'你好'});
 assert.equal(calls.at(-1).options.headers.authorization,'Bearer agent-distinct');
 assert.ok(calls.every(x=>x.url.startsWith('https://jizhengzhixing-mobile.zedi-li070614.workers.dev/')));
 assert.ok(calls.filter(x=>x.url.includes('/portal/')).every(x=>x.options.method==='GET'&&x.options.headers.authorization==='Bearer portal-distinct'));
 assert.ok(calls.every(x=>x.options.redirect==='error'));
 const denied=makeTools({mode:'cloud',role:'merchant',output:dir,env:{JZZX_PORTAL_CODE:'portal-distinct'},fetcher});
 await assert.rejects(denied.call('jzzx_feedback_summary',{}),/ROLE_MISMATCH/);
});
test('installer: four real skills, backup, non-destructive conflict handling and profile config',async t=>{
 const dir=await temp(t),workspace=join(dir,'workspace'),config=join(dir,'openclaw.json');await mkdir(workspace);
 const before={mcp:{servers:{existing:{command:'node',args:['unrelated.js']}}},misc:{keep:true}};
 await writeFile(config,JSON.stringify(before));
 const run=args=>execFileSync(process.execPath,[install,'--workspace',workspace,...args],{encoding:'utf8'});
 const result=JSON.parse(run(['--config',config]));
 assert.equal(result.skills,4);assert.deepEqual(JSON.parse(await readFile(result.backup,'utf8')),before);
 const next=JSON.parse(await readFile(config,'utf8'));assert.deepEqual(next.mcp.servers.existing,before.mcp.servers.existing);assert.deepEqual(next.misc,before.misc);
 assert.equal(next.mcp.servers.jzzx.command,process.execPath);
 for(const skill of ['travel','government','business','governance'])assert.match(await readFile(join(workspace,'skills','jzzx-'+skill,'SKILL.md'),'utf8'),new RegExp('name: jzzx-'+skill));
 const snippet=JSON.parse(run(['--mode','demo','--role','merchant']));
 const fragment=JSON.parse(await readFile(snippet.snippet,'utf8'));assert.ok(fragment.mcp.servers.jzzx.args.includes('merchant'));
 assert.throws(()=>run(['--config',config,'--mode','demo']),/MCP_ENTRY_CONFLICT/);
 assert.deepEqual(JSON.parse(await readFile(config,'utf8')),next);
 const switched=JSON.parse(run(['--config',config,'--mode','demo','--role','merchant','--switch-profile']));
 const updated=JSON.parse(await readFile(config,'utf8'));assert.ok(updated.mcp.servers.jzzx.args.includes('merchant'));assert.deepEqual(updated.mcp.servers.existing,before.mcp.servers.existing);assert.deepEqual(JSON.parse(await readFile(switched.backup,'utf8')),next);
});
