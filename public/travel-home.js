/* 文旅首页：复用既有文旅 API 与知识库。不替用户预约或购票。 */
(function(root){'use strict';
function safeTravelUrl(raw) {
  if(typeof raw!=='string'||/[\s\\\x00-\x1f]/.test(raw))return false;
  const m=/^https?:\/\/([a-z0-9.-]+)(?::[0-9]{1,5})?(?:[/?#]|$)/i.exec(raw);
  if(!m)return false;
  const host=m[1].toLowerCase(),domains=['jl.gov.cn','changchun.gov.cn','jlcity.gov.cn','yanji.gov.cn','changbaishan.gov.cn','wmhg.com.cn','ijingyuetan.com','jindingdafo.com','gaogouli-tour.com','cgh.org.cn'];
  return domains.some(d=>host===d||host.endsWith('.'+d));
}

function normalizePlan(raw,catalog){
  if(!raw||!Number.isInteger(raw.days)||raw.days<1||raw.days>3||!Array.isArray(raw.plan)||raw.plan.length!==raw.days)return null;
  const entries=new Map((catalog?.attractions||[]).map(a=>[a.id,a])),seen=new Set(),plan=[];
  for(let i=0;i<raw.plan.length;i++){
    const d=raw.plan[i];if(d?.day!==i+1||!Array.isArray(d.nodes)||d.nodes.length>3)return null;
    const nodes=[];
    for(const n of d.nodes){
      const a=entries.get(n?.attractionId);if(!a||seen.has(a.id)||!['上午','午后','傍晚'].includes(n.slot))return null;
      seen.add(a.id);nodes.push({attractionId:a.id,slot:n.slot,why:typeof n.why==='string'?n.why.slice(0,180):'',name:a.name,area:a.area,kind:a.kind,caveat:a.caveat||'',sources:(a.sources||[]).filter(s=>safeTravelUrl(s.url)).slice(0,3),verifiedAt:a.verifiedAt||''});
    }
    plan.push({day:i+1,nodes});
  }
  if(!seen.size)return null;
  return {days:raw.days,title:raw.days+' 天 · '+[...new Set(plan.flatMap(d=>d.nodes).map(n=>n.area))].join(' / '),plan,warnings:(Array.isArray(raw.warnings)?raw.warnings:[]).map(w=>typeof w?.message==='string'?w.message.slice(0,240):'').filter(Boolean).slice(0,8),tips:(Array.isArray(raw.tips)?raw.tips:[]).filter(t=>typeof t==='string').slice(0,8).map(t=>t.slice(0,180))};
}

function fromRoute(route,catalog){
  if(!route||!Number.isInteger(route.days)||route.days<1||route.days>3)return null;
  return normalizePlan({days:route.days,plan:Array.from({length:route.days},(_,i)=>({day:i+1,nodes:(route.nodes||[]).filter(n=>n.day===i+1)})),warnings:[{message:route.caveat||'开放与预约信息请出发前核实。'}]},catalog);
}

function planForStorage(plan){
  return {days:plan.days,plan:plan.plan.map(d=>({day:d.day,nodes:d.nodes.map(n=>({attractionId:n.attractionId,slot:n.slot}))}))};
}
function composeTravelQuestion(text,prefs){
  const q=String(text||'').trim().slice(0,100);
  const tail=[];
  if(prefs.destination&&prefs.destination!=='全省')tail.push(prefs.destination);
  if([1,2,3].includes(prefs.days))tail.push(prefs.days+'天');
  if(prefs.companion&&prefs.companion!=='不限'&&prefs.companion!=='自由行')tail.push(prefs.companion);
  if(prefs.season&&prefs.season!=='不限')tail.push(prefs.season+'季');
  return [q,...tail].filter(Boolean).join('，').slice(0,140);
}
function cleanPlanning(p){
  if(!p||typeof p!=='object')return null;
  const fields=['areas','themes','companions','exclusions'];
  const safe={};
  for(const f of fields)safe[f]=Array.isArray(p[f])?p[f].filter(v=>typeof v==='string').map(v=>v.slice(0,32)).slice(0,8):[];
  safe.days=Number.isInteger(p.days)&&p.days>=1&&p.days<=3?p.days:null;
  safe.daysRequested=Number.isInteger(p.daysRequested)&&p.daysRequested>0&&p.daysRequested<=365?p.daysRequested:null;
  safe.daysClamped=p.daysClamped===true;
  safe.season=({spring:'春季',summer:'夏季',autumn:'秋季',winter:'冬季'})[p.season]||'';
  safe.attractionCandidates=Number.isInteger(p.attractionCandidates)&&p.attractionCandidates>=0&&p.attractionCandidates<=100?p.attractionCandidates:null;
  safe.routeCandidates=Number.isInteger(p.routeCandidates)&&p.routeCandidates>=0&&p.routeCandidates<=100?p.routeCandidates:null;
  safe.fallback=p.fallback===true;
  safe.sourceRouteId=typeof p.sourceRouteId==='string'&&/^[a-z0-9-]{1,80}$/.test(p.sourceRouteId)?p.sourceRouteId:null;
  safe.modelUsed=p.modelUsed===true;
  safe.modelReplyAccepted=p.modelReplyAccepted===true&&safe.modelUsed;
  return safe;
}
const KEY='jzzx-travel-plan-v1';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const data=()=>root.WENLV||{attractions:[],routes:[],calendar:[],entries:[]};
const readSaved=()=>{try{return normalizePlan(JSON.parse(root.localStorage.getItem(KEY)||'null'),data())}catch{return null}};
const state={query:'',days:0,destination:'全省',companion:'不限',season:'不限',plan:null,planning:null,trace:[],clarify:'',pendingQuestion:'',source:'',answer:'',error:'',busy:false,saved:null,notice:'',initialized:false};
function landscape(){return '<svg class="travel-landscape" viewBox="0 0 520 290" fill="none" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><circle cx="410" cy="60" r="38" fill="#ffe6a9" opacity=".9"/><path d="M0 219 81 93 115 144 180 43 222 113 280 67 350 156 413 109 520 236V290H0Z" fill="#a7c8c5" opacity=".58"/><path d="M98 168 180 43 222 113 252 88 280 67 320 116 300 110 282 125 267 107 221 137 197 106 178 89 160 121 140 130Z" fill="#eaf4f1" opacity=".92"/><path d="M0 245 85 162 135 193 202 132 260 185 332 119 397 188 464 153 520 216V290H0Z" fill="#75b5aa"/><path d="M0 248Q120 204 218 235T520 220V290H0Z" fill="#326d68"/><path d="M0 266Q160 234 309 261T520 246V290H0Z" fill="#244e56"/><g fill="#e2f3ef" opacity=".5"><path d="m25 211 14-31 14 31h-8l11 21H22l11-21z"/><path d="m455 208 16-38 16 38h-9l12 25h-38l12-25z"/><path d="m480 223 11-26 11 26h-6l8 16h-26l8-16z"/></g><path d="M250 261Q300 252 352 263M316 274q45-6 79 1" stroke="#b6e1db" stroke-width="2" stroke-linecap="round" opacity=".6"/></svg>'}
function choices(key,items){return '<div class="travel-chips" role="group" aria-label="'+({days:'旅行天数',companion:'同行人',season:'旅行季节'}[key])+'">'+items.map(v=>'<button type="button" data-travel-choice="'+key+'" data-value="'+esc(v)+'" aria-pressed="'+(String(state[key])===String(v))+'">'+esc(key==='days'?(v===0?'不限':v+' 天'):v)+'</button>').join('')+'</div>'}
function sourceLinks(n){return n.sources.length?n.sources.map(s=>'<a class="travel-source" href="'+esc(s.url)+'" target="_blank" rel="noopener noreferrer">'+esc(s.label)+' ↗</a>').join(''):'<p class="travel-subtle">暂无可靠入口，请向景区核实。</p>'}
function planningMarkup(){
 const p=state.planning;if(!p)return '';
 const conditions=[p.days?p.days+'天':'',...p.areas,...p.companions,...p.themes,p.season].filter(Boolean);
 return conditions.length||p.daysClamped?'<details class="travel-notes"><summary>行程偏好</summary><p>'+esc(conditions.join('、')+(p.exclusions.length?'；不安排 '+p.exclusions.join('、'):''))+'</p>'+(p.daysClamped?'<p>每份行程最多安排 3 天，较长的旅行可分段规划。</p>':'')+'</details>':'';
}
function resultMarkup(){
 if(state.busy)return '<section class="travel-result travel-wait" role="status"><span class="travel-spinner" aria-hidden="true"></span><div><strong>正在规划您的行程</strong><p>正在安排景点与游览顺序。</p></div></section>';
 if(state.clarify)return '<section class="travel-result" id="travelClarify" role="status"><span class="travel-kicker">吉小知 · 补充需求</span><h2>'+esc(state.clarify)+'</h2>'+'<button type="button" class="travel-secondary" data-travel-action="clarify-input">补充旅行想法</button></section>';
 const errorCard=state.error?'<section class="travel-result travel-error" role="alert"><h2>暂时无法生成行程</h2><p>'+esc(state.error)+'</p><button type="button" data-travel-action="retry" class="travel-secondary">重试</button><p class="travel-subtle">下方精选线路可以离线查看。</p></section>':'';
 if(!state.plan)return errorCard+(state.saved?'<section class="travel-resume"><div><small>我的旅行计划</small><strong>'+esc(state.saved.title)+'</strong></div><button type="button" data-travel-action="restore">继续查看 →</button></section>':'');
 const p=state.plan;
 return errorCard+'<section class="travel-result" id="travelResult"><div class="travel-result-head"><div><span class="travel-kicker">'+esc(state.source)+'</span><h2 id="travelResultTitle" tabindex="-1">'+esc(p.title)+'</h2></div><button type="button" class="travel-secondary" data-travel-action="save">保存</button></div>'+
 (state.answer?'<p class="travel-answer">'+esc(state.answer)+'</p>':'')+planningMarkup()+'<p class="travel-risk">建议游览顺序，不是导航路线。开放、预约及转场可行性须出行前核实。</p>'+
 p.plan.map(d=>'<section class="travel-day"><h3>第 '+d.day+' 天</h3>'+(d.nodes.length?d.nodes.map(n=>'<article class="travel-node"><span class="travel-dot"></span><div><div class="travel-node-time">'+esc(n.slot)+' · '+esc(n.area)+'</div><h4>'+esc(n.name)+'</h4>'+(n.why?'<p>'+esc(n.why)+'</p>':'')+'<details><summary>行前确认与资料来源</summary><p>'+esc(n.caveat||'开放、票价和预约以景区公告为准。')+'</p><span class="travel-subtle">资料核对日期：'+esc(n.verifiedAt||'未记录')+' · 非实时公告</span>'+sourceLinks(n)+'</details></div></article>').join(''):'<p class="travel-subtle">当天留作机动，可自由活动或休息。</p>')+'</section>').join('')+
 '<details class="travel-notes"><summary>出发前请确认</summary><p>本计划不包含实时导航、交通时刻、预约或购票结果。</p>'+p.warnings.concat(p.tips).map(t=>'<p>· '+esc(t)+'</p>').join('')+'</details><div class="travel-result-actions"><button type="button" class="travel-secondary" data-travel-action="speak">朗读行程</button><button type="button" class="travel-secondary" data-travel-action="share">分享行程</button><button type="button" class="travel-secondary" data-travel-action="new">调整</button></div><p class="travel-notice" role="status">'+esc(state.notice)+'</p>'+(state.saved?'<button type="button" class="travel-linkbtn" data-travel-action="forget">清除本机保存的行程</button>':'')+'</section>';
}
function routeCards(extra=false){
 const featured=['changbaishan-north-2d','jilin-wusong-2d','yanbian-food-2d','changchun-city-1d'];
 const byId=new Map((data().routes||[]).map(r=>[r.id,r]));
 return (extra?[...byId.values()].filter(r=>!featured.includes(r.id)):featured.map(id=>byId.get(id)).filter(Boolean)).map((r,i)=>'<button type="button" class="travel-route tone-'+i+'" data-travel-route="'+esc(r.id)+'"><span class="travel-route-art" aria-hidden="true"><i></i><i></i><i></i></span><span class="travel-route-info"><small>'+esc((r.areas||[]).join(' · '))+' · '+r.days+' 天</small><strong>'+esc(r.name.split('：')[0])+'</strong><span>'+esc(r.name.split('：')[1]||'查看路线')+' ↗</span></span></button>').join('');
}
function render(region,taskMarkup=''){
 if(!state.initialized){state.saved=readSaved();state.initialized=true;}
 const d=data(),areas=['全省',...new Set((d.attractions||[]).map(a=>a.area))];
 return '<div class="travel-home" id="travelHome"><header class="travel-top"><div class="travel-brand"><span class="travel-brandmark" aria-hidden="true">吉</span><div><strong>吉政知行</strong><small>吉林 · 旅行与便民服务</small></div></div><button type="button" class="travel-region" data-action="regions">⌖ '+esc(region||'吉林省')+' ▾</button></header>'+
 '<section class="travel-conversation-entry"><div><span class="travel-kicker">吉小知</span><h1>今天想做什么？</h1><p>安排旅行、查询办事资料、创作吉林文旅内容。</p></div><button type="button" class="travel-primary" data-action="ai-full">与吉小知对话 <span>→</span></button></section>'+
 '<section class="travel-hero">'+landscape()+'<div class="travel-hero-content"><span class="travel-eyebrow">四季吉林</span><h1>山河之间，<br>遇见吉林。</h1><p>把想去的地方告诉吉小知。</p></div><span class="travel-hero-caption">长白山意象 · 插画</span></section>'+
 '<div class="travel-main"><section class="travel-planner" aria-label="吉小知智能行程规划"><div class="travel-planner-head"><div><span class="travel-kicker">行程规划</span><h2>今天想去哪里？</h2></div></div><form id="travelPlanForm"><label for="travelQuestion" class="travel-label">说说您的旅行想法（请勿填写个人敏感信息）</label><textarea id="travelQuestion" maxlength="100" rows="2" placeholder="比如：想看雾凇，带家人轻松玩两天">'+esc(state.query)+'</textarea><div class="travel-voice-row"><button type="button" data-travel-action="voice">语音输入</button><span id="travelVoiceStatus" role="status"></span></div><div class="travel-preferences"><label class="travel-label" for="travelDestination">目的地区</label><select id="travelDestination">'+areas.map(a=>'<option '+(a===state.destination?'selected':'')+'>'+esc(a)+'</option>').join('')+'</select><span class="travel-label">计划天数</span>'+choices('days',[0,1,2,3])+'<span class="travel-label">与谁同行</span>'+choices('companion',['不限','亲子','长辈','朋友'])+'<span class="travel-label">旅行季节</span>'+choices('season',['不限','春','夏','秋','冬'])+'</div><button class="travel-primary" type="submit" '+(state.busy?'disabled':'')+'>'+(state.busy?'正在规划…':'为我规划行程')+' <span>→</span></button></form><p class="travel-trust">景点开放与票价以官方公告为准</p></section><div id="travelOutcome" aria-live="polite">'+resultMarkup()+'</div>'+
 '<section class="travel-discover"><div class="travel-section-head"><div><span class="travel-kicker">旅行路线</span><h2>吉林，值得慢慢走</h2></div><button type="button" data-action="travel-tourist">更多线路 →</button></div><div class="travel-route-grid">'+routeCards()+'</div><details class="travel-more"><summary>展开全部精选线路</summary><div class="travel-route-grid">'+routeCards(true)+'</div></details></section>'+
 (taskMarkup||'')+'<section class="travel-connect"><h2>出游服务</h2><div><button type="button" data-action="travel-tourist"><strong>游客反馈</strong><small>本机反馈与答复 →</small></button><button type="button" data-action="roles"><strong>文旅协作</strong><small>游客、商户与管理工作台</small></button><button type="button" data-action="itinerary"><strong>行程卡片</strong><small>调整路线、查看依据、导出长图</small></button><button type="button" data-tab="services"><strong>便民服务</strong><small>政务资料与指南</small></button><button type="button" data-action="ai-full"><strong>办事咨询</strong><small>查询政策和办理步骤</small></button></div></section>'+
 '<footer class="travel-footer"><span>'+ (d.attractions||[]).length +' 处景点 · '+(d.routes||[]).length+' 条线路 · 本地知识库</span><p>非政府官方应用。行程为参考，出发前请向景区核实；三端协作当前为本机联动。</p></footer></div></div>';
}
function refreshOutcome(focus){
 const el=document.getElementById('travelOutcome');if(el){el.innerHTML=resultMarkup();if(focus){const title=el.querySelector('#travelResultTitle');if(title){title.focus({preventScroll:true});title.scrollIntoView({block:'start',behavior:'auto'});}}}
 const b=document.querySelector('#travelPlanForm button[type=submit]');if(b){b.disabled=state.busy;b.innerHTML=''+(state.busy?'正在规划…':'为我规划行程')+' <span>→</span>';}
}
function setNotice(message){state.notice=message;const el=document.querySelector('.travel-notice');if(el)el.textContent=message;}
async function generate(){
 if(state.busy)return;
 const input=document.getElementById('travelQuestion');if(input)state.query=input.value.trim().slice(0,100);
 const current=composeTravelQuestion(state.query,state);
 const q=state.pendingQuestion&&current&&state.pendingQuestion!==current?(state.pendingQuestion+'；补充：'+current).slice(0,300):current;
 if(!q){state.error='请描述旅行想法，或选择至少一个出行偏好。';refreshOutcome(false);return;}
 state.busy=true;state.error='';state.clarify='';state.answer='';state.notice='';refreshOutcome(false);
 const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),45000);
 try{
  const res=await root.fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'wenlv-agent',question:q}),signal:ctrl.signal,cache:'no-store'});
  if(!res.ok)throw Error('服务暂时不可用（'+res.status+'）');
  const payload=await res.json();if(payload.mode!=='wenlv-agent')throw Error('当前服务器尚未启用文旅接口。');
  state.trace=Array.isArray(payload.trace)?payload.trace.filter(t=>t&&typeof t.tool==='string'&&typeof t.detail==='string').slice(0,12).map(t=>({tool:t.tool.slice(0,40),detail:t.detail.slice(0,200),actor:t.actor==='model'?'model':'system'})):[];
  if(payload.status==='clarify'){
    state.clarify=String(payload.text||'请补充出游偏好。').slice(0,200);state.pendingQuestion=q;
    const field=document.getElementById('travelQuestion');state.query='';if(field)field.value='';
    return;
  }
  state.pendingQuestion='';
  if(payload.status==='no-match'||payload.reason==='no-match'){state.error='当前知识库没有同时满足这些条件的景点，请放宽出行条件。';return;}
  const p=normalizePlan(payload.itinerary,data());if(!p)throw Error('行程资料不完整或知识库版本不一致，请刷新后重试。');
  state.plan=p;state.planning=null;state.source=payload.degraded?'资料规划':'联网规划';state.answer=typeof payload.text==='string'?payload.text.slice(0,1200):'';
 }catch(e){state.error=e?.name==='AbortError'?'网络响应超时。':String(e?.message||'连接失败').slice(0,180);}
 finally{clearTimeout(timeout);state.busy=false;refreshOutcome(true);}
}
function chooseRoute(id){if(state.busy)return;const p=fromRoute((data().routes||[]).find(r=>r.id===id),data());state.plan=p;state.planning=null;state.clarify='';state.pendingQuestion='';state.trace=[];state.error=p?'':'线路资料暂时不完整。';state.source='精选线路';state.answer='';state.notice='';refreshOutcome(true);}
function shareText(plan){
 return ['吉政知行 · '+plan.title,...plan.plan.map(d=>'第 '+d.day+' 天：'+(d.nodes.length?d.nodes.map(n=>n.slot+' '+n.name).join('；'):'机动休息')),'出发前请核实景区开放、票价、预约及实际车程。'].join('\n');
}
async function sharePlan(){
 if(!state.plan)return;
 const text=shareText(state.plan);
 try{if(root.navigator?.share){await root.navigator.share({title:'我的吉林旅行计划',text});setNotice('已打开分享。');return;}if(root.navigator?.clipboard?.writeText){await root.navigator.clipboard.writeText(text);setNotice('行程已复制，可粘贴到微信。');return;}}catch(e){if(e?.name==='AbortError')return;}
 const el=document.querySelector('.travel-notice');if(el){el.textContent='请长按下方文字复制：';const ta=document.createElement('textarea');ta.className='travel-share-text';ta.setAttribute('readonly','');ta.setAttribute('aria-label','可复制行程');ta.value=text;el.after(ta);ta.focus();ta.select();}
}
function readAloud(){
 if(!state.plan)return;
 if(!root.speechSynthesis||!root.SpeechSynthesisUtterance){setNotice('当前浏览器不支持朗读，可使用系统读屏。');return;}
 if(root.speechSynthesis.speaking){root.speechSynthesis.cancel();setNotice('已停止朗读。');return;}
 const text=state.plan.title+'。'+state.plan.plan.map(d=>'第'+d.day+'天。'+d.nodes.map(n=>n.slot+'，'+n.name).join('。')).join('。')+'。开放及预约请向景区确认。';
 const u=new root.SpeechSynthesisUtterance(text);u.lang='zh-CN';u.rate=.9;u.onerror=()=>setNotice('朗读不可用，可使用系统读屏。');u.onend=()=>setNotice('朗读结束。');root.speechSynthesis.speak(u);setNotice('正在朗读，再次点击可停止。');
}
let voice=null;
function voiceStatus(t){const el=document.getElementById('travelVoiceStatus');if(el)el.textContent=t;}
function startTravelVoice(){
 const Speech=root.SpeechRecognition||root.webkitSpeechRecognition;
 if(!Speech){voiceStatus('当前浏览器不支持语音输入，请使用键盘。');return;}
 if(voice){voice.stop();return;}
 try{voice=new Speech();voice.lang='zh-CN';voice.interimResults=false;voice.maxAlternatives=1;
 voice.onstart=()=>voiceStatus('正在听，点击语音按钮停止。');
 voice.onresult=e=>{const text=String(e.results?.[0]?.[0]?.transcript||'').slice(0,100);const input=document.getElementById('travelQuestion');if(input&&text){input.value=text;state.query=text;}voiceStatus('已识别，请确认文字后再规划。');};
 voice.onerror=e=>voiceStatus(e.error==='not-allowed'?'麦克风权限未开启，请使用键盘。':'未能识别，请重试或输入文字。');
 voice.onend=()=>{voice=null;};voice.start();
 }catch{voice=null;voiceStatus('无法打开语音输入，请使用键盘。');}
}
if(typeof document!=='undefined'){
 document.addEventListener('click',e=>{
  const el=e.target.closest?.('[data-travel-choice],[data-travel-action],[data-travel-route]');if(!el||!el.closest('#travelHome'))return;
  if(el.dataset.travelChoice){const k=el.dataset.travelChoice,v=el.dataset.value,allowed={days:['0','1','2','3'],companion:['不限','亲子','长辈','朋友'],season:['不限','春','夏','秋','冬']};if(!allowed[k]?.includes(v)||state.busy)return;state[k]=k==='days'?Number(v):v;el.parentElement.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===el)));return;}
  if(el.dataset.travelRoute){chooseRoute(el.dataset.travelRoute);return;}
  switch(el.dataset.travelAction){
   case 'voice':startTravelVoice();break;
   case 'retry':generate();break;
   case 'clarify-input':document.getElementById('travelQuestion')?.focus();break;
   case 'save':if(state.plan){try{root.localStorage.setItem(KEY,JSON.stringify(planForStorage(state.plan)));state.saved=state.plan;state.notice='已保存到本机，不含您的问句。';refreshOutcome(false)}catch{setNotice('当前设备不能保存，请保持此页面打开。')}}break;
   case 'restore':state.saved=readSaved();state.plan=state.saved;state.planning=null;state.trace=[];state.clarify='';state.pendingQuestion='';state.answer='';state.source='已保存行程';state.error=state.saved?'':'保存的行程已失效，请重新规划。';refreshOutcome(true);break;
   case 'forget':try{root.localStorage.removeItem(KEY);state.saved=null;setNotice('已清除本机行程。');el.remove()}catch{setNotice('清除失败，请在浏览器设置中管理站点数据。')}break;
   case 'new':state.plan=null;state.planning=null;state.trace=[];state.clarify='';state.pendingQuestion='';state.answer='';state.error='';state.notice='';refreshOutcome(false);document.getElementById('travelQuestion')?.focus();break;
   case 'speak':readAloud();break;
   case 'share':sharePlan();break;
  }
 });
 document.addEventListener('submit',e=>{if(e.target.id==='travelPlanForm'){e.preventDefault();generate();}});
 document.addEventListener('change',e=>{if(e.target.id==='travelDestination')state.destination=e.target.value;});
 document.addEventListener('input',e=>{if(e.target.id==='travelQuestion')state.query=e.target.value.slice(0,140);});
}
function acceptPlan(raw){const p=normalizePlan(raw,data());if(!p)return false;state.plan=p;state.planning=null;state.error='';state.clarify='';state.pendingQuestion='';state.trace=[];state.source='对话行程';state.answer='';state.notice='';refreshOutcome(true);return true;}
root.JZZX_TRAVEL_HOME=Object.freeze({acceptPlan,render,normalizePlan,fromRoute,planForStorage,safeTravelUrl,composeTravelQuestion,cleanPlanning,shareText});
})(globalThis);
