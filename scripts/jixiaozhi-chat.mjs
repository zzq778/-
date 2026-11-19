// Node 20+: JZZX_AGENT_URL=https://... JZZX_AGENT_CODE=... node scripts/jixiaozhi-chat.mjs "..."
const base=process.env.JZZX_AGENT_URL,code=process.env.JZZX_AGENT_CODE;
if(!base||!code){console.error('Set JZZX_AGENT_URL and JZZX_AGENT_CODE');process.exit(2)}
const url=new URL(base);if(url.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(url.hostname)){console.error('HTTPS required');process.exit(2)}
const question=process.argv.slice(2).join(' ').trim();if(!question){console.error('Pass a question');process.exit(2)}
const r=await fetch(new URL('/api/v1/chat',url),{method:'POST',redirect:'error',headers:{'content-type':'application/json',authorization:'Bearer '+code},body:JSON.stringify({question}),signal:AbortSignal.timeout(40000)});
console.log(JSON.stringify(await r.json(),null,2));if(!r.ok)process.exitCode=1;
