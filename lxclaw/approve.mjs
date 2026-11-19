// Manual terminal only; not an MCP tool. Do not run from the agent.
import {readFile} from 'node:fs/promises';
import {basename,resolve} from 'node:path';
import {createInterface} from 'node:readline/promises';
import {cloudClient} from './mcp-server/cloud.mjs';
import {FEEDBACK_CATEGORIES} from '../src/portal-service.mjs';
if(!process.stdin.isTTY||!process.stdout.isTTY)throw Error('INTERACTIVE_TERMINAL_REQUIRED');
const file=resolve(process.argv[2]||'.');
if(!/^business-draft-[0-9a-f-]{36}\.json$/.test(basename(file)))throw Error('DRAFT_FILE_REQUIRED');
const raw=await readFile(file,'utf8');if(Buffer.byteLength(raw)>8192)throw Error('DRAFT_TOO_LARGE');
const {role,requestId,merchantId,feedbackId,category,text}=JSON.parse(raw);
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(v);
if(!['tourist','merchant','government'].includes(role)||!id(requestId)||typeof text!=='string'||!text.trim()||text.length>(role==='tourist'?500:400)||/\d{11,}|\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/i.test(text)||role==='tourist'&&(!id(merchantId)||!FEEDBACK_CATEGORIES.includes(category))||role!=='tourist'&&!id(feedbackId))throw Error('INVALID_DRAFT');
const c=cloudClient(),me=await c.request('me');if(me.role!==role)throw Error('ROLE_MISMATCH');
console.log(JSON.stringify({target:'正式云服务；仅在有授权时执行',identity:{role:me.role,region:me.region},requestId,merchantId,feedbackId,category,text},null,2));
const rl=createInterface({input:process.stdin,output:process.stdout});
let answer;try{answer=await rl.question('核对后输入 APPROVE '+requestId+'（其他内容取消）：')}finally{rl.close()}
if(answer!=='APPROVE '+requestId){console.log('未提交');process.exit(0)}
const result=role==='tourist'?await c.request('feedback',{requestId,merchantId,category,text}):await c.request('reply',{requestId,text},feedbackId);
if(result.status!=='stored')throw Error('WRITE_NOT_CONFIRMED');
console.log(JSON.stringify({status:result.status,id:result.id,requestId}));
