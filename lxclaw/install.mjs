import {parseArgs} from 'node:util';
import {mkdir,readFile,writeFile,readdir,stat,copyFile,rename} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';

const here=dirname(fileURLToPath(import.meta.url));
const {values:v}=parseArgs({options:{workspace:{type:'string'},config:{type:'string'},mode:{type:'string',default:'local'},role:{type:'string',default:'tourist'},weather:{type:'boolean'},'allow-image':{type:'boolean'},'include-feedback-text':{type:'boolean'},help:{type:'boolean'}}});
if(v.help||!v.workspace){
 console.log('node lxclaw/install.mjs --workspace "<LXClaw当前工作空间>" [--config "<当前OpenClaw严格JSON配置文件>"] [--mode local|demo|cloud] [--role tourist|merchant|government]');
 console.log('不指定 --config 时只安装技能并生成 MCP 配置片段，不修改引擎配置。');
 if(!v.help)process.exitCode=2;
}else{
 if(Number(process.versions.node.split('.')[0])<22)throw Error('NODE_22_REQUIRED');
 if(!['local','demo','cloud'].includes(v.mode)||!['tourist','merchant','government'].includes(v.role))throw Error('INVALID_PROFILE');
 const workspace=resolve(v.workspace),info=await stat(workspace);if(!info.isDirectory())throw Error('WORKSPACE_MUST_EXIST');
 const server=join(here,'mcp-server','server.mjs'),output=join(workspace,'jzzx-output');
 const args=[server,'--mode',v.mode,'--role',v.role,'--output',output];
 if(v.mode==='demo')args.push('--demo-db',join(here,'demo-data','jzzx-demo.sqlite'));
 if(v.weather)args.push('--weather');
 if(v['allow-image'])args.push('--allow-image');
 if(v['include-feedback-text'])args.push('--include-feedback-text');
 const spec={command:process.execPath,args,cwd:workspace,timeout:65,supportsParallelToolCalls:false};
 const name='jzzx';
 // Skills copy is additive. No skill or existing MCP server gets silently overwritten.
 const skills=await readdir(join(here,'skills'),{withFileTypes:true});
 const writes=[];
 for(const item of skills.filter(x=>x.isDirectory())){
  const from=join(here,'skills',item.name,'SKILL.md'),to=join(workspace,'skills',item.name,'SKILL.md'),data=await readFile(from);
  try{const current=await readFile(to);if(!current.equals(data))throw Error('SKILL_CONFLICT: '+to)}
  catch(e){if(e.code!=='ENOENT')throw e;writes.push({to,data})}
 }
 let config=null,configPath=null,originalConfig=null;
 if(v.config){
  configPath=resolve(v.config);
  // Intentionally reject JSON5 rather than corrupt comments or non-JSON configuration.
  originalConfig=await readFile(configPath,'utf8');config=JSON.parse(originalConfig);
  if(!config||typeof config!=='object'||Array.isArray(config))throw Error('INVALID_CONFIG');
  if(config.mcp!==undefined&&(!config.mcp||typeof config.mcp!=='object'||Array.isArray(config.mcp))||config.mcp?.servers!==undefined&&(!config.mcp.servers||typeof config.mcp.servers!=='object'||Array.isArray(config.mcp.servers)))throw Error('INVALID_MCP_CONFIG');
  const prev=config.mcp?.servers?.[name];if(prev&&JSON.stringify(prev)!==JSON.stringify(spec))throw Error('MCP_ENTRY_CONFLICT: use native MCP editor to change profile');
  config.mcp??={};config.mcp.servers??={};config.mcp.servers[name]=spec;
 }
 for(const {to,data} of writes){await mkdir(dirname(to),{recursive:true});await writeFile(to,data,{flag:'wx'})}
 // Different profiles use separate generated files; preserves prior snippets.
 const snippet=join(workspace,'jzzx-mcp-'+v.mode+'-'+v.role+'.json');
 const content=JSON.stringify({mcp:{servers:{[name]:spec}}},null,2)+'\n';
 try{await writeFile(snippet,content,{flag:'wx',mode:0o600})}catch(e){if(e.code!=='EEXIST'||await readFile(snippet,'utf8')!==content)throw e}
 if(configPath){
  const suffix=randomUUID(),backup=configPath+'.jzzx-backup-'+suffix,temp=configPath+'.jzzx-temp-'+suffix;
  if(await readFile(configPath,'utf8')!==originalConfig)throw Error('CONFIG_CHANGED_RETRY');await copyFile(configPath,backup,1);await writeFile(temp,JSON.stringify(config,null,2)+'\n',{flag:'wx',mode:0o600});await rename(temp,configPath);
  console.log(JSON.stringify({workspace,skills:skills.filter(x=>x.isDirectory()).length,config:configPath,backup,snippet,mode:v.mode,role:v.role},null,2));
 }else console.log(JSON.stringify({workspace,skills:skills.filter(x=>x.isDirectory()).length,snippet,mode:v.mode,role:v.role,note:'在LXClaw的MCP配置中合并此片段的mcp.servers.jzzx；不要覆盖其他服务器。'},null,2));
}
