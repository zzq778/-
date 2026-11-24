// Runtime services, enabled only by explicit deployment configuration.
import { REGIONS } from './knowledge.mjs';
const coordinates=Object.freeze({'长春市':[43.88,125.32],'吉林市':[43.84,126.55],'四平市':[43.17,124.35],'辽源市':[42.89,125.14],'通化市':[41.73,125.94],'白山市':[41.94,126.42],'松原市':[45.14,124.83],'白城市':[45.62,122.84],'延边州':[42.91,129.51]});
const schema=(name,description,properties,required)=>({type:'function',function:{name,description,parameters:{type:'object',properties,required,additionalProperties:false}}});
const str=maxLength=>({type:'string',minLength:1,maxLength});
const WEATHER=schema('weather_forecast','查询指定吉林市州城区未来三天的天气预测，不代表景区或高山实况。',{region:{type:'string',enum:REGIONS}},['region']);
const SEARCH=schema('web_search','公开网页搜索，返回实际搜索摘要和链接，不代表全文已读。不得发送个人敏感信息。',{query:str(240)},['query']);
const source={label:'Open-Meteo 天气预报',url:'https://open-meteo.com/'};
const clean=v=>typeof v==='string'?v.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim():'';
function publicUrl(raw){
 try{const u=new URL(raw);if(!['https:','http:'].includes(u.protocol)||u.username||u.password||!/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(u.hostname)||/^\d/.test(u.hostname)||/\.(local|internal|localhost)$/i.test(u.hostname))return null;return u.href.slice(0,1600)}catch{return null}
}
async function getJson(url,options,fetcher){
 const r=await fetcher(url,{...options,redirect:'error',signal:AbortSignal.timeout(8000)});
 if(!r.ok)throw Error('UPSTREAM');
 const reader=r.body?.getReader();if(!reader)throw Error('BODY');
 let total=0;const decoder=new TextDecoder();let out='';
 try{for(;;){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>256000){await reader.cancel();throw Error('SIZE')}out+=decoder.decode(value,{stream:true})}out+=decoder.decode();return JSON.parse(out)}finally{reader.releaseLock()}
}
export function runtimeTools(env={},fetcher=globalThis.fetch){
 const tools=[];
 if(env.WEATHER_ENABLED==='true'){
  tools.push({schema:WEATHER,run:async({region})=>{
   if(!Object.hasOwn(coordinates,region))return {error:'UNKNOWN_REGION'};
   const [lat,lon]=coordinates[region];
   const u=new URL('https://api.open-meteo.com/v1/forecast');
   u.search=new URLSearchParams({latitude:String(lat),longitude:String(lon),timezone:'Asia/Shanghai',forecast_days:'3',daily:'temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code'}).toString();
   const x=await getJson(u,{headers:{accept:'application/json'}},fetcher),d=x.daily;
   const keys=['temperature_2m_max','temperature_2m_min','precipitation_probability_max','weather_code'];
   if(!Array.isArray(d?.time)||!d.time.length||d.time.length>3||keys.some(k=>!Array.isArray(d[k])||d[k].length!==d.time.length))throw Error('INVALID_FORECAST');
   const forecast=d.time.map((date,i)=>{
    if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||keys.some(k=>d[k][i]!==null&&!Number.isFinite(d[k][i])))throw Error('INVALID_FORECAST');
    return {date,minC:d.temperature_2m_min[i],maxC:d.temperature_2m_max[i],precipitationPercent:d.precipitation_probability_max[i],weatherCode:d.weather_code[i]};
   });
   return {region,forecast,scope:'市州城区近似位置；延边为延吉城区。不是景区、山顶或路况实测；预报可能变化。',retrievedAt:new Date().toISOString(),sources:[source]};
  }});
 }
 if(typeof env.BRAVE_SEARCH_KEY==='string'&&env.BRAVE_SEARCH_KEY.length>=10){
  tools.push({schema:SEARCH,run:async({query})=>{
   if(typeof query!=='string'||query.length>240||/\d{11,}|\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/i.test(query))return {error:'QUERY_REJECTED'};
   const u=new URL('https://api.search.brave.com/res/v1/web/search');
   u.search=new URLSearchParams({q:query,count:'5',safesearch:'strict',search_lang:'zh-hans'}).toString();
   const x=await getJson(u,{headers:{accept:'application/json','X-Subscription-Token':env.BRAVE_SEARCH_KEY}},fetcher);
   if(x.web!==undefined&&!Array.isArray(x.web?.results))throw Error('INVALID_SEARCH');
   const results=(x.web?.results||[]).slice(0,5).flatMap(r=>{const url=publicUrl(r?.url),title=clean(r?.title).slice(0,180);return url&&title?[{title,url,snippet:clean(r.description).slice(0,500)}]:[]});
   return {results,scope:'搜索摘要，未读取全文；政策、价格、预约需以官方原文为准。',retrievedAt:new Date().toISOString(),sources:results.map(r=>({label:r.title,url:r.url}))};
  }});
 }
 return tools;
}
export function runtimeStatus(env){return {weather:env.WEATHER_ENABLED==='true',webSearch:typeof env.BRAVE_SEARCH_KEY==='string'&&env.BRAVE_SEARCH_KEY.length>=10}}
