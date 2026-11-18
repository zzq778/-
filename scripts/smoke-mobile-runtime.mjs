// Real Wrangler runtime + live Workers AI; no production access-code changes.
import {spawn} from 'node:child_process';import {randomBytes} from 'node:crypto';import {writeFile,rm} from 'node:fs/promises';
const base='http://127.0.0.1:8799',code=randomBytes(24).toString('hex');
const localVars='.dev.vars';await writeFile(localVars,'TRAVEL_PREVIEW_CODE='+code+'\n',{mode:0o600,flag:'wx'});
const child=spawn('npx',['--yes','wrangler@4','dev','--config','wrangler.mobile.jsonc','--ip','127.0.0.1','--port','8799'],{env:{...process.env,CI:'true'},stdio:['ignore','pipe','pipe'],detached:true});
const log=(x)=>process.stdout.write(x.toString().replaceAll(code,'[SMOKE CODE]'));
child.stdout.on('data',log);child.stderr.on('data',log);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function ready(){
 for(let i=0;i<90;i++){if(child.exitCode!==null)throw Error('wrangler exited');try{const r=await fetch(base+'/api/status',{signal:AbortSignal.timeout(1500)});if(r.ok&&(await r.json()).chatReady)return}catch{}await wait(1000)}
 throw Error('Worker dev did not become ready');
}
async function run(path,question,includeOrigin){
 const t=Date.now(),r=await fetch(base+path,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+code,...(includeOrigin?{origin:base}:{})},body:JSON.stringify({question}),signal:AbortSignal.timeout(55000)});
 const x=await r.json().catch(()=>({}));
 console.log(JSON.stringify({path,http:r.status,status:x.status,error:x.error,reason:x.reason,ms:Date.now()-t,modelCalls:x.modelCalls,modelActions:x.modelActions,degraded:x.degraded,toolCount:x.toolCount,hasText:typeof x.text==='string'&&!!x.text.trim(),days:x.itinerary?.days,places:x.itinerary?.plan?.flatMap(d=>d.nodes||[]).length}));
 const success=r.ok&&x.status==='complete'&&typeof x.text==='string'&&x.text.trim();
 if(!success)return false;
 if(path==='/api/travel')return x.degraded===false&&x.modelActions>0&&x.itinerary?.days===2;
 return true;
}
try{
 await ready();
 // No Origin emulates a native client; the travel request emulates the browser.
 const a=await run('/api/v1/chat','你好',false);
 const b=await run('/api/travel','延边两天民俗美食',true);
 if(!a||!b)process.exitCode=1;
}finally{try{process.kill(-child.pid,'SIGTERM')}catch{}await rm(localVars,{force:true});}
