import {ATTRACTIONS} from '../../src/wenlv/attractions.mjs';
import {parseIntent} from '../../src/wenlv/intent.mjs';
import {retrieve} from '../../src/wenlv/search.mjs';
import {buildItinerary} from '../../src/wenlv/plan.mjs';
import {audit} from '../../src/wenlv/travel-agent.mjs';
import {REGIONS,TOPICS} from '../../src/knowledge.mjs';
import {executeAgentTool} from '../../src/agent.mjs';

const byId=new Map(ATTRACTIONS.map(x=>[x.id,x]));
export {REGIONS,TOPICS};
export function searchPlaces({query,limit=8,exclude=[]}){
 const intent=parseIntent(query);intent.exclusions=[...new Set([...intent.exclusions,...exclude])];
 const r=retrieve(intent,{limit,routeLimit:4,eventLimit:4});
 const candidates=r.attractions.map(a=>({...a,sources:byId.get(a.id).sources,verifiedAt:byId.get(a.id).verifiedAt}));
 return {scope:'吉政知行随包知识库；非实时网络结果',intent:{areas:intent.areas,clusters:intent.clusters,exclusions:intent.exclusions,days:intent.days},candidates,routes:r.routes,events:r.events,note:r.note};
}
export function readPlace({id}){
 const a=byId.get(id);if(!a)throw Error('UNKNOWN_PLACE');
 return {scope:'本地资料；开放、价格和预约以最新官方公告为准',...a};
}
export function planTrip({requirements,selectedIds=[],exclude=[]}){
 const intent=parseIntent(requirements);intent.exclusions=[...new Set([...intent.exclusions,...exclude])];
 if(intent.daysClamped)return {status:'clarify',text:'现有编排引擎支持1–3天。更长旅行请分段规划，不会默默缩短天数。'};
 if(!intent.days)return {status:'clarify',text:'请确定旅行天数（1–3天）。'};
 if(!intent.areas.length&&!intent.clusters.length&&!intent.provinceWide)return {status:'clarify',text:'请明确城市、片区或接受吉林全省范围。'};
 let r=retrieve(intent,{limit:12});
 const allowed=new Set(r.attractions.map(a=>a.id));
 if(selectedIds.length){
  if(selectedIds.length>intent.days*3||new Set(selectedIds).size!==selectedIds.length||selectedIds.some(id=>!allowed.has(id)))throw Error('INVALID_SELECTION');
  r={...r,routes:[],attractions:selectedIds.map((id,i)=>({...r.attractions.find(a=>a.id===id),score:100-i}))};
 } else {
  const baseline=buildItinerary(intent,r);
  for(const n of baseline.plan.flatMap(d=>d.nodes))allowed.add(n.attractionId);
 }
 const itinerary=buildItinerary(intent,r);
 const check=audit(itinerary,intent,allowed);
 if(!check.ok)return {status:'no-match',issues:check.issues,text:'没有满足当前约束的行程，请调整范围。'};
 if(selectedIds.length&&selectedIds.some(id=>!itinerary.plan.flatMap(d=>d.nodes).some(n=>n.attractionId===id)))throw Error('SELECTION_NOT_APPLIED');
 return {status:'complete',mode:'catalog-planner',itinerary,check,notice:'模型可自行选择候选ID，由共享编排器和约束校验生成路线。非实时路况、预算、票务核验；具体预算与时间请另行查证。'};
}
export function civicSearch({query,region}){return executeAgentTool('search_services',{query},region)}
export function civicGuide({serviceId,region}){const r=executeAgentTool('read_service_guide',{service_id:serviceId},region);if(r.error)throw Error(r.error);return r}
