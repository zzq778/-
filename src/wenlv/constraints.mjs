/** 仅识别知识库中的明确否定对象；不把开放式偏好推断成硬约束。 */
import { ATTRACTIONS } from './attractions.mjs';
const TERMS=['滑雪','雪场','博物馆','徒步','登山','动物','温泉','冬捕','观鸟','湿地','古城','寺庙','冰雪'];
const NAMES=[...new Set(ATTRACTIONS.flatMap(a=>[a.name,...(a.aliases||[])]).concat(TERMS))].filter(s=>typeof s==='string'&&s.length>=2).sort((a,b)=>b.length-a.length);
const markers=/(?:不想(?:去|玩|参加|安排|看)?|不(?:要|考虑|安排)(?:去|玩|参加|看)?|不去|避免(?:去|玩|参加|安排)?|别(?:去|玩|安排)?|跳过)\s*/g;

/** 返回被排除对象和去掉这些否定短语后的正向需求。 */
export function parseExclusions(raw){
  const text=String(raw||''),exclusions=[],ranges=[];
  for(const m of text.matchAll(markers)){
    const pos=m.index+m[0].length,tail=text.slice(pos);
    const hit=NAMES.find(n=>tail.startsWith(n));
    if(!hit)continue;
    exclusions.push(hit);ranges.push([m.index,pos+hit.length]);
  }
  let positive=text;
  for(const [a,b] of ranges.reverse())positive=positive.slice(0,a)+' '+positive.slice(b);
  return {exclusions:[...new Set(exclusions)].slice(0,10),positive};
}
export function isExcludedAttraction(entry,intent){
  const terms=Array.isArray(intent?.exclusions)?intent.exclusions:[];
  const hay=[entry.name,...(entry.aliases||[]),...(entry.tags||[]),entry.kind].join(' ');
  return terms.some(t=>typeof t==='string'&&t&&hay.includes(t));
}
export function isExcludedRoute(route,intent){
  return (route.nodes||[]).some(n=>{const a=ATTRACTIONS.find(x=>x.id===n.attractionId);return a&&isExcludedAttraction(a,intent);});
}
export function isExcludedEvent(event,intent){
  const terms=Array.isArray(intent?.exclusions)?intent.exclusions:[];
  return terms.some(t=>typeof t==='string'&&t&&[event.name,event.type].join(' ').includes(t));
}
