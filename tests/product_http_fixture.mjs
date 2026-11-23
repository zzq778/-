import {createServer} from 'node:http';
import {Readable} from 'node:stream';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep} from 'node:path';
import {environment} from './portal_fixture.mjs';
import {handleMobile} from '../src/mobile-worker.mjs';
import {handleApi} from '../src/worker.mjs';
const base=fileURLToPath(new URL('../',import.meta.url));
const env=environment();env.TRAVEL_PREVIEW_CODE='team-preview-test-123456';env.AGENT_CLIENT_CODE='agent-client-test-123456';env.LIMITER={limit:async()=>({success:true})};
env.IMAGE_GENERATION_ENABLED='true';env.IMAGE_ACCESS_CODE='test-image-code-00000000000000000000';
// Valid 32x32 JPEG test fixture; not an actual generated travel image.
const testJpeg="/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAgACADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwCnRRRWR4IUUUUAFFFFABRRRQB//9k=";
const call=(name,args)=>({tool_calls:[{id:name,function:{name,arguments:JSON.stringify(args)}}]});
// Only the model is a deterministic test double. HTTP, SQL, auth, tool execution and UI are real.
env.AI={run:async(_model,{messages,tools})=>{
 if(_model==='@cf/black-forest-labs/flux-1-schnell')return {image:testJpeg};
 const last=messages.at(-1);
 if(last.role==='tool')return call('reply',{text:'已整理资料，请核对后继续。'});
 const q=last.content;
 if(q.includes('优先处理'))return call('read_feedback_summary',{});
 if(q.includes('宣传图'))return call('prepare_poster',{prompt:'吉林秋季山林旅行插画，留白，不使用官方标识。'});
 if(q.includes('反馈'))return call('prepare_feedback',{category:'设施与环境',text:'停车指引不清，希望改善。'});
 if(q.includes('净月潭'))return call('read_place',{id:'jingyuetan'});
 return call('reply',{text:'可以告诉我您想了解的吉林旅行或办事问题。'});
}};
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.webp':'image/webp','.png':'image/png','.json':'application/json','.webmanifest':'application/manifest+json'};
async function start(dir,handler,mobile){
 const root=resolve(base,dir);
 const srv=createServer(async(req,res)=>{
  try{
   const origin='http://127.0.0.1:'+srv.address().port,url=new URL(req.url,origin);
   if(url.pathname.startsWith('/api/')){
    const request=new Request(url,{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Readable.toWeb(req),duplex:'half'})});
    const out=await handler(request,env);res.writeHead(out.status,Object.fromEntries(out.headers));res.end(Buffer.from(await out.arrayBuffer()));return;
   }
   const name=resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(!name.startsWith(root+sep)){res.writeHead(403);res.end();return}
   let file=await readFile(name);
   if(mobile&&name===resolve(root,'index.html'))file=Buffer.from(file.toString().replaceAll('https://jizhengzhixing-mobile-preview.zedi-li070614.workers.dev',origin));
   res.writeHead(200,{'content-type':types[extname(name)]||'application/octet-stream','cache-control':'no-store'});res.end(file);
  }catch(e){res.writeHead(404);res.end('Not available')}
 });
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 return {srv,url:'http://127.0.0.1:'+srv.address().port};
}
const mobile=await start('mobile/site',handleMobile,true),web=await start('public',handleApi,false);
console.log(JSON.stringify({mobile:mobile.url,web:web.url}));
process.on('SIGTERM',()=>{mobile.srv.close();web.srv.close();});
