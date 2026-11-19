/* 吉政知行 v0.7：政务任务智能体。
   保留 v0.4 的界面与动效；AI 请求仅发送到同源 /api/chat。
   不传递身份证、社保卡号或密码等敏感信息。
*/
(() => {
  'use strict';
  const URLS = Object.freeze({government:'https://www.jl.gov.cn/', hall:'https://zwfw.jl.gov.cn/jljhszwfww/', personal:'https://zwfw.jl.gov.cn/jlzwfwall/grbs/'});
  const regions=['长春市','吉林市','四平市','辽源市','通化市','白山市','松原市','白城市','延边州'];
  const kinds=[
    ['pension','养老认证','待遇资格 · 认证指南','heart'],
    ['medical','医保健康','参保服务 · 医保指引','health'],
    ['cert','证件办理','补办换领 · 官方入口','card'],
    ['policy','政策解读','政策原文 · 适用条件','file'],
    ['nearby','附近服务','政务网点 · 便民设施','pin'],
    ['work','就业服务','就业创业 · 公共服务','briefcase']
  ];
  const guide={
    pension:{title:'养老待遇与资格认证',cat:'pension',desc:'养老金、资格认证、退休待遇',steps:['区分是查询养老金待遇，还是进行领取资格认证。','进入“吉事办”省级政务服务大厅，确认办理地区。','在官方平台搜索“养老保险”或“资格认证”，选择具体事项。','按官方流程进行身份认证；只在政府指定渠道提供必要身份信息。'],url:URLS.hall},
    medical:{title:'医保服务与报销指引',cat:'medical',desc:'医保缴费、报销、参保信息',steps:['确定需要查询参保信息、医保缴费还是费用报销。','打开吉林省网上办事大厅，选择当前实际办理地区。','进入医保相关事项页面，仔细核对办理材料与办理条件。','涉及待遇、金额或个人医保账户，以官方经办渠道为准。'],url:URLS.hall},
    cert:{title:'居民证件补换领',cat:'cert',desc:'身份证办理入口与指南',steps:['确认是首次申领、到期换领还是遗失补领。','在吉林政务服务平台搜索具体证件事项。','核对地区、受理机构、材料以及是否支持网上办理。','使用政府指定渠道完成实名验证与业务提交。'],url:URLS.personal},
    policy:{title:'吉林政策文件查询',cat:'policy',desc:'官方政策出处与应用范围',steps:['明确政策主题，例如养老补贴、创业支持等。','打开吉林省人民政府网站，搜索相关文件。','核对发布单位、发布日期、实施时间和适用区域。','不把非官方解释当作最终办事依据。'],url:URLS.government},
    nearby:{title:'查找线下办事网点',cat:'nearby',desc:'办事地点和窗口指引',steps:['确认您所在的市州和具体需要办理的业务。','进入“吉事办”网上办事大厅。','查找“办事网点”或相关受理机构信息。','到访前确认具体地址、工作时间及预约要求。'],url:URLS.hall},
    work:{title:'就业创业与公共服务',cat:'work',desc:'就业登记、创业政策等',steps:['确认要查询的是就业登记、就业补贴还是创业服务。','打开吉林省政务服务网上办事大厅。','搜索业务名称并核对办理人群与地区。','通过官方渠道办理；本应用只提供导办服务。'],url:URLS.personal}
  };
  const news=[
    {title:'吉林省人民政府 · 省内政务要闻',sub:'省内政务新闻、公告与政策',url:URLS.government},
    {title:'吉林省网上办事大厅（吉事办）',sub:'省级政务服务及个人办事入口',url:URLS.hall},
    {title:'吉林政务服务 · 个人办事',sub:'官方在线办事与事项指南入口',url:URLS.personal}
  ];
  const paths={
    home:'<path d="M3 10.7 12 3l9 7.7V21h-6v-6H9v6H3z"/>',
    grid:'<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
    news:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    user:'<circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/>',
    pin:'<path d="M19 10c0 5-7 12-7 12S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
    down:'<path d="m6 9 6 6 6-6"/>',
    arrow:'<path d="M4 12h16m-7-7 7 7-7 7"/>',
    right:'<path d="m9 5 7 7-7 7"/>',
    heart:'<path d="M20 5c-2.4-2.4-5.6-1.3-8 1-2.4-2.3-5.6-3.4-8-1-3.1 3.1-1 6.7 2 9.5l6 5.5 6-5.5c3-2.8 5.1-6.4 2-9.5Z"/>',
    health:'<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M12 7v9M7.5 11.5h9"/>',
    card:'<rect x="2" y="5" width="20" height="14" rx="3"/><circle cx="8" cy="11" r="2"/><path d="M5 16c1-2 5-2 6 0m3-5h5m-5 4h4"/>',
    file:'<path d="M6 2h9l4 4v16H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z"/><path d="M15 2v5h4M8 12h8M8 16h8"/>',
    briefcase:'<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m-12 6h16"/>',
    mic:'<rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4m-4 0h8"/>',
    plus:'<circle cx="12" cy="12" r="10"/><path d="M12 7v10M7 12h10"/>',
    close:'<path d="M5 5 19 19M19 5 5 19"/>',
    send:'<path d="m22 2-7.5 20-3.4-8.2L3 10.5 22 2ZM22 2 11.1 13.8"/>',
    search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    external:'<path d="M13 4h7v7m0-7-10 10"/><path d="M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5"/>',
    check:'<path d="m5 12 4 4L19 6"/>',
    audio:'<path d="M4 9h4l5-4v14l-5-4H4V9ZM17 9c2 2 2 4 0 6m2-9c4 4 4 8 0 12"/>',
    shield:'<path d="M12 2 20 5v6c0 6-4 9-8 11-4-2-8-5-8-11V5l8-3Z"/><path d="m9 12 2 2 4-4"/>',
    info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-9h.01"/>',
    edit:'<path d="m5 19 4-.8L20 7a3 3 0 0 0-4-4L5 14v5Z"/>',
    volumeoff:'<path d="M4 9h4l5-4v14l-5-4H4V9Zm13 0 5 6m0-6-5 6"/>'
  };
  const ico=(id)=>`<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[id]||paths.info}</svg>`;
  const esc=(v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const saved=(()=>{try{return JSON.parse(localStorage.getItem('jzzx-motion-v03')||'{}')||{}}catch{return{}}})();
  const TASK_KEY='jzzx-saved-guide-v1';
  // Only generic guide steps and checkmarks are stored. No questions, chat transcripts or personal identifiers.
  function validateSavedTask(item){
    if(!item || typeof item!=='object' || !Object.hasOwn(guide,item.id) || !regions.includes(item.region))return null;
    if(typeof item.title!=='string'||item.title.length>60||!Array.isArray(item.steps)||item.steps.length!==3||
      item.steps.some(x=>typeof x!=='string'||!x.trim()||x.length>160)||
      !Array.isArray(item.checked)||item.checked.length!==3||item.checked.some(x=>typeof x!=='boolean'))return null;
    return {id:item.id,title:item.title,region:item.region,steps:item.steps,checked:item.checked};
  }
  function loadTask(){try{return validateSavedTask(JSON.parse(localStorage.getItem(TASK_KEY)||'null'))}catch{return null}}
  function persistTask(){
    try{if(state.task)localStorage.setItem(TASK_KEY,JSON.stringify(state.task));else localStorage.removeItem(TASK_KEY);return true}
    catch{return false}
  }
  const markedCount=t=>t?.checked.filter(Boolean).length||0;
  function taskCard(){
    const t=state.task;if(!t)return '';
    const mismatch=t.region!==state.region;
    return `<section class="saved-task reveal" aria-label="本机导办清单"><div class="saved-task-top"><span class="saved-task-label">${ico('check')} 我的导办清单</span><small>${esc(t.region)}</small></div>
    <h2>${esc(t.title)}</h2><p>${mismatch?'当前地区已变更，请重新核对办事要求。':`已标记了解 ${markedCount(t)} / 3 步 · 不是政府办理进度`}</p>
    <div class="task-progress" role="img" aria-label="已了解 ${markedCount(t)} 步，共 3 步">${t.checked.map(v=>`<i class="${v?'done':''}"></i>`).join('')}</div>
    <button type="button" class="task-resume" data-action="task-open">继续查看导办清单 ${ico('right')}</button></section>`;
  }
  function savePlan(index){
    const plan=state.messages[index]?.agent?.plan;
    if(!plan || !Object.hasOwn(guide,plan.id) || !Array.isArray(plan.steps)||plan.steps.length!==3)return;
    const candidate=validateSavedTask({id:plan.id,title:plan.title,steps:plan.steps,region:state.region,checked:[false,false,false]});
    if(!candidate)return;
    const old=state.task;
    if(old && (old.id!==candidate.id||old.region!==candidate.region) && !window.confirm('将替换本机已有的导办清单，继续吗？'))return;
    if(old && old.id===candidate.id && old.region===candidate.region && old.steps.every((x,i)=>x===candidate.steps[i]))candidate.checked=[...old.checked];
    state.task=candidate;
    const stored=persistTask();
    render();notice(stored?'导办清单已保存在本机，可以从首页继续':'当前设备无法永久保存，清单仅在本次打开期间保留');
  }
  function taskSheet(){
    const t=state.task;if(!t)return '';
    const mismatch=t.region!==state.region;
    return `<div class="sheet-header"><strong>${esc(t.title)}</strong><button type="button" class="close-round" data-action="modal-close" aria-label="关闭">${ico('close')}</button></div>
      <p class="sheet-desc">${esc(t.region)} · 已标记了解 ${markedCount(t)} / 3 步</p>
      ${mismatch?`<p class="task-region-alert">当前选择的是${esc(state.region)}，本清单属于${esc(t.region)}，请重新向吉小知核对。</p>`:''}
      <div class="task-step-list">${t.steps.map((step,i)=>`<button type="button" class="task-step ${t.checked[i]?'checked':''}" data-task-step="${i}" aria-pressed="${t.checked[i]}"><span class="task-step-index">${t.checked[i]?ico('check'):i+1}</span><span class="task-step-text">${esc(step)}<small>${t.checked[i]?'已标记了解':'点击标记已了解'}</small></span></button>`).join('')}</div>
      <p class="task-fineprint">勾选只代表您已阅读并了解这一步，不代表政府事项已经办理完成。清单仅保存在当前设备。</p>
      <div class="task-sheet-actions"><button type="button" class="primary" data-action="task-ask">继续问吉小知 ${ico('arrow')}</button><button type="button" class="task-secondary" data-guide="${esc(t.id)}">查看事项指南 ${ico('right')}</button><button type="button" class="task-delete" data-action="task-delete">清除本机清单</button></div>`;
  }
  const MAX_DIRECT_BYTES=8*1024*1024;
  const BIG_CHUNK_BYTES=8*1024*1024;
  const LIMITS={images:64*1024*1024,documents:100_000_000,other:32*1024*1024};
  const allowedSize=file=>/\.(jpe?g|png|webp|gif)$/i.test(file.name)?LIMITS.images:/\.(pdf|docx?|pptx?)$/i.test(file.name)?LIMITS.documents:LIMITS.other;
  const state={tab:'home',region:regions.includes(saved.region)?saved.region:'长春市',elder:!!saved.elder,motion:saved.motion!==false,alias:typeof saved.alias==='string'?saved.alias:'',filter:'all',search:'',attachment:null,modal:null,assistant:null,voice:'idle',voiceMessage:'',messages:[],task:loadTask(),thinking:false,uploadProgress:'',power:0,aiStatus:'checking',portalRole:(function(){try{var r=localStorage.getItem('jzzx-portal-role');return ['tourist','merchant','government'].indexOf(r)>=0?r:'tourist'}catch(e){return 'tourist'}})()};
  const reduced=()=>!state.motion || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const content=document.getElementById('content'),nav=document.getElementById('bottomNav'),modalRoot=document.getElementById('modalRoot'),aiRoot=document.getElementById('aiRoot'),toastEl=document.getElementById('toast');
  let recognition=null,micStream=null,micCtx=null,micSource=null,analyser=null,meterHandle=0,toastHandle=null,replyTimer=null,aiController=null;
  let revealJob=null,revealFrame=0;
  function persist(){try{localStorage.setItem('jzzx-motion-v03',JSON.stringify({region:state.region,elder:state.elder,motion:state.motion,alias:state.alias}))}catch{/* 无存储权限的本地文件照常使用 */}}
  function notice(text){toastEl.innerHTML=`<div class="toast">${esc(text)}</div>`;clearTimeout(toastHandle);toastHandle=setTimeout(()=>toastEl.innerHTML='',3600)}
  function openOfficial(key){const url=URLS[key];if(!url){notice('链接未通过官方白名单校验');return}const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';document.body.append(a);a.click();a.remove()}
  const liquid=(cls='')=>`<span class="orb-art ${cls}" aria-hidden="true"><img src="./assets/pearl-orb.webp" width="520" height="520" alt="" draggable="false"/></span>`;
  function topbar(){return `<header class="topbar"><div class="brand"><div class="brand-square">吉</div><div><strong>吉政知行</strong><small>把政务说清楚</small></div></div><button type="button" class="region-chip" data-action="regions">${ico('pin')}${esc(state.region)}${ico('down')}</button></header>`}
  function home(){if(window.JZZX_TRAVEL_HOME)return window.JZZX_TRAVEL_HOME.render(state.region,taskCard());return `<div class="home-sky">${topbar()}
  <section class="home-hero" aria-label="欢迎使用吉政知行">
    <div class="home-hero-copy"><div class="city-eyebrow">吉林 · 您身边的政务助手</div><h1>想办什么事？<br>交给吉小知。</h1><p>找依据、理步骤，帮您走好下一步。</p></div>
    <img class="hero-couple" src="./assets/changchun-people.webp" alt="" loading="eager" decoding="async"/>
    <img class="hero-landmark" src="./assets/changchun-skyline.webp" alt="长春历史建筑与城市风景插画" loading="eager" decoding="async"/>
  </section></div>
  <div class="home-main"><section class="agent-home-card reveal" aria-label="吉小知智能政务助手">
    <div class="agent-intro">
      <div class="agent-intro-copy"><div class="agent-tag"><span class="tag-dot"></span> 智能政务导办</div><h2>吉小知</h2><p>说出目标，我来查事项、理清步骤。</p></div></div>
    <div class="agent-entry" role="group" aria-label="向吉小知提问"><button type="button" class="agent-voice" data-action="open-ai" aria-label="打开语音助手">${ico('mic')}</button><button type="button" class="agent-question" data-action="ai-full">描述想办理的事项</button><button type="button" class="agent-open" data-action="ai-full" aria-label="打开智能导办">${ico('arrow')}</button></div>
    <div class="agent-task-row" aria-label="常见问题快捷提问">
      <button type="button" class="task-chip" data-prompt="我在${esc(state.region)}，养老保险待遇领取资格认证怎么查？">规划养老认证 ${ico('right')}</button>
      <button type="button" class="task-chip" data-prompt="我在${esc(state.region)}，医保报销去哪里查询办事指南？">医保导办 ${ico('right')}</button>
      <button type="button" class="task-chip" data-prompt="我在${esc(state.region)}，身份证到期怎么换领？">证件换领 ${ico('right')}</button>
    </div>
    <p class="agent-location">${ico('pin')} 根据您选择的${esc(state.region)}提供导办建议</p>
  </section>
  ${taskCard()}
  <section class="home-itinerary reveal" aria-label="文旅行程卡片"><div class="home-section-head"><h2>文旅行程</h2></div><button type="button" class="iti-entry" data-action="itinerary"><span class="iti-entry-kicker">吉林雾凇两日 · 2 天 4 站 · 吉林市</span><strong>湖、古镇与雾凇的清晨</strong><span class="iti-entry-meta">先看湖再进古镇，第二天赶日出后的雾凇，顺路上雪场</span><span class="iti-entry-cta">查看行程卡片 →</span></button></section>
  <section class="home-services reveal"><div class="home-section-head"><h2>常用服务</h2><button type="button" data-tab="services">全部服务 ${ico('right')}</button></div><div class="home-service-grid">${['pension','medical','cert','policy','nearby','work'].map((id,i)=>{const [_,n,sub,icon]=kinds.find(x=>x[0]===id);return `<button type="button" class="home-service" data-kind="${id}"><span class="home-service-icon">${ico(icon)}</span><strong>${esc(n)}</strong><small>${esc(sub)}</small></button>`}).join('')}</div></section>
  <section class="home-news reveal"><div class="home-section-head"><h2>政务资讯</h2><button type="button" data-tab="news">更多 ${ico('right')}</button></div><button type="button" class="news-feature" data-official="government"><img src="./assets/city-news.webp" alt="政务信息栏目配图" loading="lazy"/><span><strong>吉林省人民政府 · 政务要闻</strong><small>官方新闻、政策发布与通知公告</small></span>${ico('right')}</button><button class="news-link-row" type="button" data-official="hall"><span>吉林省网上办事大厅</span><span>办事入口 ${ico('right')}</span></button><button class="news-link-row" type="button" data-official="personal"><span>个人办事与事项指南</span><span>官方查询 ${ico('right')}</span></button></section>
  <p class="home-legal">吉政知行提供信息导办，不是政府官方应用。办理要求以官方渠道为准。</p></div>`}
  function newsItem(x,i){const key=Object.keys(URLS).find(k=>URLS[k]===x.url);return `<button type="button" class="news-item" data-official="${key}"><span class="news-number">0${i+1}</span><span class="news-copy"><span class="news-item-title">${esc(x.title)}</span><span class="news-item-sub">${esc(x.sub)}</span></span>${ico('external')}</button>`}
  function fab(){return `<button type="button" class="floating-ai" data-action="open-ai" aria-label="打开吉小知语音对话"><span class="fab-spot">${ico('search')}</span><span class="fab-label">问问吉小知</span></button>`}
  function heading(kicker,title,desc){return `${topbar()}<header class="page-header"><h1 class="page-title">${title}</h1><p class="page-sub">${desc}</p></header>`}
  function filteredGuides(){return Object.values(guide).filter(x=>(state.filter==='all'||x.cat===state.filter)&&(!state.search||`${x.title} ${x.desc}`.includes(state.search)))}
  function serviceList(){return `<div class="service-list" id="serviceList">${filteredGuides().map(x=>`<button type="button" class="service-row" data-guide="${x.cat}"><span class="row-icon">${ico(kinds.find(a=>a[0]===x.cat)[3])}</span><span class="row-copy"><strong>${esc(x.title)}</strong><small>${esc(x.desc)}</small></span><span class="arrow">${ico('right')}</span></button>`).join('')||'<p class="page-sub">没有匹配的事项，试试其他关键词。</p>'}</div>`}
  // 政策解读库：条目由 public/policies.js 提供，逐条对应省政府网已核验的原文页面。
  // 若脚本缺失，页面退化为仅保留“政策文件查询”导办，不显示空列表。
  const LIBRARY=(typeof window!=='undefined'&&window.POLICY_LIBRARY)||{};
  const policies=Array.isArray(LIBRARY.items)?LIBRARY.items.filter(x=>x&&typeof x.id==='string'&&typeof x.title==='string'):[];
  const policyById=new Map(policies.map(x=>[x.id,x]));
  const policyVerifiedAt=typeof LIBRARY.verifiedAt==='string'?LIBRARY.verifiedAt:'';
  const policyTopics={pension:'社保养老',medical:'医保健康',cert:'证件办理',policy:'政策文件',nearby:'办事网点',work:'就业便民'};
  // 政策原文只允许跳转吉林省官方域名，其余一律拦截；这不是安全边界，只是减少误点与钓鱼风险。
  const POLICY_HOST=/^https?:\/\/(?:[a-z0-9-]+\.)*(?:jl\.gov\.cn)(?::\d+)?(?:\/|$)/i;
  function openPolicyUrl(url){
    if(typeof url!=='string'||!POLICY_HOST.test(url)){notice('该链接不属于吉林省官方域名，已拦截');return}
    const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';document.body.append(a);a.click();a.remove();
  }
  function policyRow(p){return `<button type="button" class="policy-row" data-policy="${esc(p.id)}"><span class="policy-tag">${esc(policyTopics[p.topic]||'政策')}</span><span class="policy-row-main"><strong>${esc(p.title)}</strong><small>${esc(p.issuer||'发文机关见原文')} · ${esc(p.publishedAt||'')}</small></span>${ico('right')}</button>`}
  function policyListSheet(close){
    const rows=policies.map(policyRow).join('');
    return `<div class="sheet-header"><strong>政策解读</strong>${close}</div><p class="sheet-desc">共 ${policies.length} 条，逐条对应吉林省政府网原文${policyVerifiedAt?` · 最后核对 ${esc(policyVerifiedAt)}`:''}。每条政策的解读（一句话读懂等）由吉政知行整理，<b>不是官方解释</b>。</p><div class="policy-list">${rows}</div><div class="policy-actions"><button type="button" class="primary" data-policy-url="${esc(URLS.government)}zcxx/">前往省政府政策信息栏目 ${ico('external')}</button></div><p class="sheet-legal">仅提供政策入口与通俗解读，不代办、不审批、不代表政府立场；办理要求以官方原文及经办窗口为准。</p>`;
  }
  function policySheet(p,close){
    const d=p.digest||{},actions=Array.isArray(d.actions)?d.actions:[],cautions=Array.isArray(d.cautions)?d.cautions:[],facts=Array.isArray(p.keyFacts)?p.keyFacts:[];
    const meta=[esc(p.issuer||'发文机关见原文')];
    if(p.docNo)meta.push(esc(p.docNo));
    if(p.publishedAt)meta.push(`发布 ${esc(p.publishedAt)}`);
    meta.push(`<span class="policy-tag">${esc(policyTopics[p.topic]||'政策')}</span>`);
    return `<div class="sheet-header"><strong class="policy-sheet-title">${esc(p.title)}</strong>${close}</div><p class="policy-meta">${meta.join(' · ')}</p>
    ${d.oneLine?`<div class="digest-block"><span class="digest-label">一句话读懂</span><p>${esc(d.oneLine)}</p></div>`:''}
    ${d.who?`<div class="digest-block"><span class="digest-label">谁用得上</span><p>${esc(d.who)}</p></div>`:''}
    ${actions.length?`<div class="digest-block"><span class="digest-label">居民可以怎么做</span><ol class="guide-steps">${actions.map((s,i)=>`<li><span class="step-circle">${i+1}</span><span>${esc(s)}</span></li>`).join('')}</ol></div>`:''}
    ${cautions.length?`<div class="digest-block"><span class="digest-label">容易误解的点</span><ul class="digest-points">${cautions.map(s=>`<li>${esc(s)}</li>`).join('')}</ul></div>`:''}
    ${facts.length?`<div class="digest-block"><span class="digest-label">原文关键信息</span><ul class="digest-points">${facts.map(s=>`<li>${esc(s)}</li>`).join('')}</ul></div>`:''}
    <div class="policy-actions"><button type="button" class="primary" data-policy-url="${esc(p.url)}">阅读官方原文 ${ico('external')}</button><button type="button" class="secondary" data-action="policy-back">返回政策列表</button></div>
    <p class="sheet-legal">解读内容由吉政知行整理（核对日期 ${esc(policyVerifiedAt||'未标注')}），非官方解释；政策可能调整，办理前请以官方原文和经办机构答复为准。</p>`;
  }
  function services(){return `${heading('01 / SERVICE DIRECTORY','政务服务','常见事项入口与操作步骤，先把路径理清楚。')}<div class="page-wrap"><label class="search-field">${ico('search')}<input id="searchInput" type="search" value="${esc(state.search)}" placeholder="搜索养老、医保、证件……" autocomplete="off" /></label><div class="filter-row"><button type="button" class="filter-pill ${state.filter==='all'?'active':''}" data-filter="all">全部</button>${kinds.map(([id,n])=>`<button type="button" data-filter="${id}" class="filter-pill ${state.filter===id?'active':''}">${esc(n)}</button>`).join('')}</div>${serviceList()}<p class="note-plain">仅提供事项目录与导办说明，不在本应用提交政务申请。</p></div>${fab()}`}
  var PORTALS={tourist:{label:'游客端',dir:'tourist',desc:'看线路、时令，向商户反馈问题'},merchant:{label:'商户端',dir:'merchant',desc:'证件办理、提交问题、经营档案、答复反馈'},government:{label:'政府端',dir:'government',desc:'查看与处理本机文旅反馈'}};
  function portalMeta(){return PORTALS[state.portalRole]||PORTALS.tourist}
  function setPortalRole(role){if(!PORTALS[role])return;state.onlinePortal=false;state.studioPortal=false;state.portalRole=role;try{localStorage.setItem('jzzx-portal-role',role)}catch(e){}state.modal=null;render();notice('已切换到'+PORTALS[role].label)}
  function roleSheet(close){var opts=Object.keys(PORTALS).map(function(k){var m=PORTALS[k],on=state.portalRole===k;return '<button type="button" class="role-option'+(on?' active':'')+'" data-role="'+k+'" aria-pressed="'+on+'"><span class="role-copy"><strong>'+m.label+'</strong><small>'+m.desc+'</small></span>'+(on?ico('check'):'')+'</button>'}).join('');return '<div class="sheet-header"><strong>选择运营端</strong>'+close+'</div>'+'<p class="sheet-desc">切换后，底部「文旅」会进入对应端的页面。三个工作台共享本机数据。</p>'+'<div class="role-list">'+opts+'</div>'+'<p class="sheet-legal">切换工作台仅用于管理本机记录，不代表真实政府或商户身份认证。</p>'}
  function wenlvHub(){var m=portalMeta();if(state.studioPortal)return `<section class="wenlv-hub"><div class="wenlv-hub-bar"><span>素材制作</span><button type="button" data-action="local-portal">返回工作台</button></div><iframe class="portal-frame" src="./portals/studio/index.html" title="文旅素材制作"></iframe></section>`;if(state.onlinePortal)return `<section class="wenlv-hub"><div class="wenlv-hub-bar"><span>联网反馈</span><button type="button" data-action="local-portal">返回本机工作台</button></div><iframe class="portal-frame" src="./portals/online/index.html" title="联网文旅反馈"></iframe></section>`;return heading('02 / WENLV','文旅','当前进入：'+m.label+' · 可在「我的」切换端')+`<div class="wenlv-hub"><div class="wenlv-hub-bar"><span>${m.label} · 本机协作</span><button type="button" data-action="roles">切换端</button><button type="button" data-action="online-portal">联网反馈</button><button type="button" data-action="studio-portal">素材制作</button></div><iframe class="portal-frame" src="./portals/${m.dir}/index.html" title="${m.label}文旅页面" loading="lazy"></iframe><p class="wenlv-hub-note">三端共享当前浏览器的资料和问题记录，不会发送给真实政府部门或商户。</p></div>`+fab()}
  function profile(){return `${heading('03 / PERSONAL SETTINGS','我的设置','让政务服务更符合您的习惯。')}<div class="page-wrap"><div class="profile-card"><div class="profile-header"><div class="avatar">${esc((state.alias||'吉').slice(0,1))}</div><div><h3>${esc(state.alias||'访客，您好')}</h3><p>个人偏好仅保存在本机</p></div></div></div>${state.task?`<div class="profile-task">${taskCard()}</div>`:''}<div class="setting-list"><button type="button" class="setting" data-action="personal"><span>个人信息<br><small>${esc(window.JZZX_PROFILE?window.JZZX_PROFILE.summary(window.JZZX_PROFILE.load()):'性别、年龄、手机号、职业、单位')}</small></span>${ico('edit')}</button><button type="button" class="setting" data-action="alias"><span>我的称呼<br><small>只保存在本机</small></span>${ico('edit')}</button><button type="button" class="setting" data-action="roles"><span>运营端（文旅）<br><small>${esc(portalMeta().label)} · 切换后「文旅」进入对应页面</small></span>${ico('right')}</button><button type="button" class="setting" data-action="regions"><span>当前地区<br><small>${esc(state.region)}</small></span>${ico('right')}</button><button type="button" class="setting" data-action="elder"><span>长辈模式<br><small>更大字号与清楚的操作入口</small></span><span class="switch ${state.elder?'on':''}"></span></button><button type="button" class="setting" data-action="motion"><span>动态效果<br><small>支持系统“减少动态”偏好</small></span><span class="switch ${state.motion?'on':''}"></span></button><button type="button" class="setting" data-action="voice-help"><span>麦克风与语音说明<br><small>如何在 Android 正确使用</small></span>${ico('right')}</button></div><p class="note-plain">吉政知行提供信息导办，不代替政府机关的正式办事服务。</p></div>${fab()}`}
  function render(){document.documentElement.classList.toggle('elder',state.elder);document.documentElement.classList.toggle('motion-off',!state.motion);const r={home,services,news:wenlvHub,profile}[state.tab]||home;content.innerHTML=r();nav.innerHTML=[['home','首页','home'],['services','便民','grid'],['news','文旅','news'],['profile','我的','user']].map(([id,t,icon])=>`<button type="button" class="tab ${state.tab===id?'active':''}" data-tab="${id}" ${state.tab===id?'aria-current="page"':''}><span class="tab-icon">${ico(icon)}</span><span>${t}</span></button>`).join('');renderModal();renderAssistant();revealOnScroll();}
  function revealOnScroll(){const els=[...document.querySelectorAll('.reveal')];if(!('IntersectionObserver'in window)){els.forEach(e=>e.classList.add('visible'));return;}const o=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');o.unobserve(e.target)}}),{rootMargin:'0px 0px -26px 0px',threshold:.08});els.forEach(e=>o.observe(e));}
  function setTab(t){if(!['home','services','news','profile'].includes(t))return;closeAssistant();state.modal=null;state.tab=t;state.search='';state.filter='all';render();window.scrollTo({top:0,behavior:'instant'})}
  function renderModal(){document.body.classList.toggle('sheet-open',!!state.modal||!!state.assistant);if(!state.modal){modalRoot.innerHTML='';return;}const close=`<button type="button" class="close-round" data-action="modal-close" aria-label="关闭">${ico('close')}</button>`;let body='';
    if(state.modal==='regions')body=`<div class="sheet-header"><strong>选择所在地区</strong>${close}</div><p class="sheet-desc">切换吉林省内市州。事项办理时请以官方系统的实际地区为准。</p><div class="region-grid">${regions.map(x=>`<button type="button" class="region-option ${x===state.region?'active':''}" data-region="${esc(x)}">${esc(x)}</button>`).join('')}</div>`;
    else if(state.modal==='alias')body=`<div class="sheet-header"><strong>我的称呼</strong>${close}</div><p class="sheet-desc">称呼只保存在当前设备，无需填写真实身份信息。</p><form id="aliasForm"><input class="input-row" name="alias" maxlength="12" placeholder="例如：李同学" value="${esc(state.alias)}" required /><div style="height:16px"></div><button class="primary" type="submit">保存昵称 ${ico('check')}</button></form>`;
    else if(state.modal==='voice-help')body=`<div class="sheet-header"><strong>语音为什么不能用？</strong>${close}</div><p class="sheet-desc">语音输入需要浏览器支持并允许使用麦克风。</p><ol class="guide-steps"><li><span class="step-circle">1</span><span>请使用支持语音识别的浏览器打开应用。</span></li><li><span class="step-circle">2</span><span>允许浏览器访问麦克风，并确保系统存在中文语音识别服务。</span></li><li><span class="step-circle">3</span><span>浏览器仍不支持转写时，可以使用手机输入法自带的语音输入。</span></li></ol><p class="sheet-legal">声纹在授权后会跟随声音变化；语音转文字还需要浏览器支持。</p>`;
     else if(state.modal==='policy-list')body=policyListSheet(close);
    else if(state.modal.startsWith('policy:')){const p=policyById.get(state.modal.split(':')[1]);if(!p){state.modal='policy-list';body=policyListSheet(close)}else body=policySheet(p,close)}
    else if(state.modal==='itinerary')body=window.JZZX_ITINERARY?window.JZZX_ITINERARY.sheet(close):`<div class="sheet-header"><strong>行程卡片</strong>${close}</div><p class="sheet-desc">行程卡片暂不可用，请刷新页面后重试。</p>`;
    else if(state.modal==='task')body=taskSheet();
    else if(state.modal==='role-select')body=roleSheet(close);
    else if(state.modal==='personal')body=window.JZZX_PROFILE?window.JZZX_PROFILE.sheet():`<div class="sheet-header"><strong>个人信息</strong>${close}</div><p class="sheet-desc">个人信息暂不可用，请刷新页面后重试。</p>`;
     else if(state.modal.startsWith('guide:')){const key=state.modal.split(':')[1],g=guide[key];if(!g){state.modal=null;modalRoot.innerHTML='';return;}const official=Object.keys(URLS).find(k=>URLS[k]===g.url);body=`<div class="sheet-header"><strong>${esc(g.title)}</strong>${close}</div><p class="sheet-desc">${esc(state.region)} · 办事参考步骤，实际要求请查看官方指南。</p><ol class="guide-steps">${g.steps.map((s,i)=>`<li><span class="step-circle">${i+1}</span><span>${esc(s)}</span></li>`).join('')}</ol><button type="button" class="primary" data-official="${official}">前往官方服务入口 ${ico('external')}</button><p class="sheet-legal">这里提供信息导办；办理申请请使用政府指定渠道。</p>`}
    modalRoot.innerHTML=`<div class="overlay ${state.modal==='task'?'task-overlay':''}" data-dismiss="modal"><section class="sheet ${state.modal==='task'?'task-sheet':state.modal==='itinerary'?'itinerary-sheet':''}" role="dialog" aria-modal="true" aria-label="${state.modal==='task'?'我的导办清单':state.modal==='itinerary'?'行程卡片':state.modal==='role-select'?'选择运营端':(state.modal==='policy-list'||state.modal.startsWith('policy:'))?'政策解读':state.modal.startsWith('guide:')?'办事指南':'设置'}"><div class="drag-handle"></div>${body}</section></div>`;
    if(state.modal==='personal'&&window.JZZX_PROFILE)window.JZZX_PROFILE.enhance(modalRoot);
  }
  const barMarkup=()=>'<span></span>'.repeat(5);
  function renderAssistant(){document.body.classList.toggle('sheet-open',!!state.modal||!!state.assistant);if(!state.assistant){aiRoot.innerHTML='';return;}
    const existingFull=state.assistant==='full'?aiRoot.querySelector('.ai-full-panel'):null;
    let markup;
    if(state.assistant==='compact'){
      const previousInput=document.getElementById('compactInput')?.value||'';
      let text=state.voice==='listening'?'我在听…':state.voice==='meter'?'声音已接入':state.voice==='requesting'?'正在申请权限…':'有什么想办的事？';
      const help=state.voiceMessage||(state.voice==='listening'?'请对着麦克风说话，声纹会随声音起伏':'点击左侧麦克风说话，或直接输入文字');
      aiRoot.innerHTML=`<div class="ai-overlay compact" data-dismiss="assistant"><section class="ai-compact-stage" role="dialog" aria-modal="true" aria-label="吉小知快捷语音输入"><button type="button" class="close-ai" data-action="ai-close" aria-label="返回页面">${ico('close')}</button><div class="voice-visual"><div class="voice-orb">${ico('mic')}</div><strong class="voice-status-title" id="voiceVisualStatus">${esc(text)}</strong><div class="voice-status-sub" id="voiceVisualSub">可以直接说，也可以输入文字</div></div><div class="compact-dock"><span class="dock-caption">吉小知 · 智能政务导办</span><form class="voice-capsule" id="voiceForm"><button type="button" class="mic-trigger ${['requesting','listening','meter'].includes(state.voice)?'active':''}" data-action="voice" aria-label="${state.voice==='idle'?'开始语音输入':'停止语音输入'}">${ico('mic')}</button><input id="compactInput" class="voice-input" name="question" maxlength="140" autocomplete="off" placeholder="输入问题或点击麦克风" aria-label="请输入政务问题"/><span class="voice-meter ${state.voice==='idle'?'idle':''}" aria-hidden="true">${barMarkup()}</span><button type="button" class="expand-ai" data-action="ai-full" aria-label="展开完整对话">${ico('plus')}</button></form><div class="voice-inline-message" id="voiceInlineMessage" aria-live="polite">${esc(help)}</div><div class="compact-help"><button type="button" data-action="ai-close">返回</button><button type="button" data-action="voice-help">语音帮助</button><button type="button" data-action="ai-full">完整对话 ↗</button></div></div></section></div>`;
      const compact=document.getElementById('compactInput');if(compact)compact.value=previousInput;
    } else {
      markup=`<div class="ai-overlay" data-dismiss="assistant"><section class="ai-full-panel" role="dialog" aria-modal="true" aria-label="吉小知对话"><div class="drag-handle"></div><header class="ai-full-head"><span class="small-liquid">${ico('search')}</span><span class="head-copy"><strong>吉小知</strong><small>${esc(state.region)} · 文旅与公共服务</small></span><button type="button" class="close-round" data-action="ai-close" aria-label="关闭对话">${ico('close')}</button></header><div class="ai-full-scroll" id="chatScroll">${state.messages.length===0?`<div class="ai-greeting"><h2>今天想做什么？</h2><p>安排旅行、查询办事资料、写活动文案，都可以直接告诉我。</p><span class="demo-pill">${state.aiStatus==='ready'?'在线问答已连接':state.aiStatus==='unavailable'?'连接暂时不可用':'正在连接'}</span><div class="prompts">${['带父母去吉林市玩两天，不滑雪','我想办医保报销，先做什么？','帮我写一段吉林民宿的宣传文案','身份证到期，怎么换领？'].map(x=>`<button type="button" class="prompt" data-prompt="${esc(x)}">${esc(x)} ↗</button>`).join('')}</div></div>`:''}<div class="chat-stream">${state.messages.map((x,i)=>`<div class="bubble ${x.from} ${revealJob?.index===i?'revealing':''}" data-message-index="${i}"><span class="bubble-copy">${esc(revealJob?.index===i?revealJob.pieces.slice(0,revealJob.count).join(''):x.text)}</span>${revealJob?.index===i?`<span class="reveal-caret" aria-hidden="true"></span><div class="reveal-controls"><span class="reveal-hint">正在显示回复</span><button type="button" data-action="skip-reveal" class="reveal-skip">显示全文 ${ico('arrow')}</button></div>`:''}${x.attachmentName?`<div class="chat-attachment-label">📎 ${esc(x.attachmentName)}</div>`:''}${x.agent?.plan?.steps?.length?`<section class="agent-plan"><div class="agent-plan-title">${ico('file')} ${esc(x.agent.plan.title)}<small>依据：本地事项索引</small></div><ol>${x.agent.plan.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol><button type="button" class="task-save" data-save-plan="${i}">${state.task?.id===x.agent.plan.id&&state.task?.region===state.region?'更新本机清单':'保存为导办清单'} ${ico('right')}</button></section>`:''}${x.itinerary?`<button type="button" class="chat-action chat-itinerary" data-open-chat-trip="${i}">${esc(x.itinerary.title)} · 查看行程 ↗</button>`:''}${x.posterDraft?`<section class="agent-plan"><strong>素材描述</strong><p>${esc(x.posterDraft.prompt)}</p><button class="chat-action" type="button" data-chat-poster="${i}">编辑并生成图片</button></section>`:''}${x.feedbackDraft?`<section class="agent-plan"><strong>反馈草稿 · ${esc(x.feedbackDraft.category)}</strong><p>${esc(x.feedbackDraft.text)}</p><button type="button" class="chat-action" data-chat-feedback="${i}" data-destination="tourist">打开本机反馈</button><button type="button" class="chat-action" data-chat-feedback="${i}" data-destination="online">打开联网反馈</button></section>`:''}${x.sources?.length?`<details class="chat-sources"><summary>参考资料 · ${x.sources.length}</summary>${x.sources.map(s=>`<a href="${esc(s.url)}" rel="noopener noreferrer" target="_blank">${esc(s.label)} ↗</a>`).join('')}</details>`:''}${x.from==='assistant'?`<div class="bubble-meta">${x.actions?.length?`<div class="chat-actions">${x.actions.map(a=>`<button type="button" class="chat-action" data-answer-action="${esc(a.type)}" data-answer-value="${esc(a.value)}">${esc(a.label)} ↗</button>`).join('')}</div>`:''}<button type="button" class="chat-action" data-action="tts" style="margin-top:8px">${ico('audio')} 播报这条回复</button></div>`:''}</div>`).join('')}${state.thinking?`<div class="thinking-panel jzzx-thinking" role="status" aria-live="polite" aria-label="正在准备回答"><span class="jzzx-orbit" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="12.5" stroke="currentColor" stroke-opacity=".16" stroke-width="1.5"/><g class="orbit-ring"><path d="M4 17a12 12 0 0 1 18-11.4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="26" cy="9.4" r="1.8" fill="currentColor"/></g><path d="M12 16h8M16 12v8" stroke="currentColor" stroke-opacity=".55" stroke-width="1.2" stroke-linecap="round"/></svg></span><span class="thinking-content"><strong class="jzzx-thinking-label">${state.uploadProgress?'正在处理材料':'正在思考'}</strong><small>${esc(state.uploadProgress||'')}</small></span></div>`:''}</div></div><div class="ai-composer"><div class="attachment-strip" id="attachmentStrip" hidden></div><form class="chat-form" id="chatForm"><input id="chatFile" class="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp,image/gif,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,.csv" aria-label="添加图片或文档"/><button type="button" class="chat-icon-btn attach-btn" data-action="attach" aria-label="添加图片或文件">${ico('plus')}</button><input id="chatInput" class="chat-input" name="question" placeholder="输入问题，或点击麦克风说话" maxlength="600" aria-label="输入问题"/><button type="button" class="chat-icon-btn ${['requesting','listening'].includes(state.voice)?'voice-recording':''}" data-action="voice" aria-label="语音输入，识别后填入输入框" aria-pressed="${['requesting','listening'].includes(state.voice)}" title="语音转文字">${ico('mic')}</button><button type="submit" class="chat-icon-btn send" aria-label="发送问题">${ico('send')}</button></form><div class="audio-note" id="fullVoiceMessage">${esc(state.voiceMessage)}</div><div class="chat-footnote">支持 PDF / Word / PPT 最大 100 MB，图片最大 64 MiB，其他文件最大 32 MiB。请勿上传身份证、密码等敏感信息。</div></div></section></div>`;
    }
    if(state.assistant==='full'){
      if(existingFull){
        // Retain the existing dialog and focused input: update only the scroll contents.
        const template=document.createElement('template');
        template.innerHTML=markup;
        const scroll=existingFull.querySelector('#chatScroll');
        const source=template.content.querySelector('#chatScroll');
        if(scroll&&source){
          const atBottom=scroll.scrollHeight-scroll.scrollTop-scroll.clientHeight<130;
          scroll.innerHTML=source.innerHTML;
          if(atBottom)requestAnimationFrame(()=>scroll.scrollTop=scroll.scrollHeight);
        }
        const voice=existingFull.querySelector('#fullVoiceMessage');
        if(voice)voice.textContent=state.voiceMessage;
        const mic=existingFull.querySelector('[data-action=voice]');if(mic){const active=['requesting','listening'].includes(state.voice);mic.classList.toggle('voice-recording',active);mic.setAttribute('aria-pressed',String(active));}
        renderAttachment();
      }else{aiRoot.innerHTML=markup;}
    }
    if(state.assistant==='full')renderAttachment();
    if(state.messages.length&&!existingFull){const x=document.getElementById('chatScroll');if(x)requestAnimationFrame(()=>x.scrollTop=x.scrollHeight)}
  }
  function renderAttachment(){
    const strip=document.getElementById('attachmentStrip');
    if(!strip)return;
    const item=state.attachment;
    strip.hidden=!item;
    strip.innerHTML=item?`<span class="attachment-name">${ico('file')} ${esc(item.name)}</span><span class="attachment-size">${Math.ceil(item.size/1024)} KB</span><button type="button" data-action="remove-attachment" aria-label="移除附件">${ico('close')}</button>`:'';
  }
  function chooseAttachment(){
    if(state.assistant!=='full'){state.assistant='full';renderAssistant()}
    document.getElementById('chatFile')?.click();
  }
  function setAssistant(mode='compact'){state.modal=null;state.assistant=mode;state.voiceMessage='';renderModal();renderAssistant()}
  function closeAssistant(){cancelReveal();stopMic();clearTimeout(replyTimer);if(aiController){aiController.abort();aiController=null;}state.thinking=false;state.assistant=null;state.voiceMessage='';aiRoot.innerHTML='';document.body.classList.toggle('sheet-open',!!state.modal)}
  // 仅模拟模型完整回复的逐段呈现；网络仍然一次返回完整 JSON，不宣称是真正流式传输。
  function cancelReveal(){
    if(revealFrame){cancelAnimationFrame(revealFrame);revealFrame=0}
    revealJob=null;
  }
  function finishReveal(){
    if(!revealJob)return;
    const index=revealJob.index;
    cancelReveal();
    const card=aiRoot.querySelector(`[data-message-index="${index}"]`);
    if(!card)return;
    card.querySelector('.bubble-copy').textContent=state.messages[index].text;
    card.classList.remove('revealing');
    card.querySelector('.reveal-caret')?.remove();
    card.querySelector('.reveal-controls')?.remove();
    const scroll=document.getElementById('chatScroll');
    if(scroll && scroll.scrollHeight-scroll.scrollTop-scroll.clientHeight<130)scroll.scrollTop=scroll.scrollHeight;
  }
function replyTimeline(text){
 const words=typeof Intl.Segmenter==='function'?Array.from(new Intl.Segmenter('zh-CN',{granularity:'word'}).segment(text),x=>x.segment):Array.from(text);
 const group=Math.max(1,Math.ceil(words.length/180)),pieces=[];let buffer='',n=0;
 for(const word of words){buffer+=word;n++;if(n>=group||/[。！？!?；;，,：:\n]$/.test(word)){pieces.push(buffer);buffer='';n=0}}
 if(buffer)pieces.push(buffer);
 const base=Math.max(17,Math.min(53,3900/Math.max(1,pieces.length)));
 const waits=pieces.map((v,i)=>base*(1+.24*Math.sin(i*.64)+.14*Math.cos(i*.23))+(/[。！？!?\n]$/.test(v)?110:/[，,；;：:]$/.test(v)?43:0));
 const scale=Math.min(1,6500/Math.max(1,waits.reduce((a,b)=>a+b,0)));
 return {pieces,waits:waits.map(v=>v*scale)};
}
function paintReply(body,pieces,count){
 const last=document.createElement('span');last.className='reply-fresh';last.textContent=pieces[count-1]||'';
 body.replaceChildren(document.createTextNode(pieces.slice(0,Math.max(0,count-1)).join('')),last);
}
  function startReveal(index){
    cancelReveal();
    if(reduced()||state.elder||document.hidden||state.assistant!=='full'){renderAssistant();return}
    const text=state.messages[index]?.text;
    if(!text){renderAssistant();return}
    const {pieces,waits}=replyTimeline(text);
    if(pieces.length<2){renderAssistant();return}
    revealJob={index,pieces,waits,count:1,nextAt:0};
    renderAssistant();
    const tick=now=>{
      const job=revealJob;
      if(!job||job.index!==index)return;
      if(reduced()||document.hidden){finishReveal();return}
      if(!job.nextAt)job.nextAt=now+job.waits[0];
      const previous=job.count;
      while(job.count<job.pieces.length&&now>=job.nextAt){job.nextAt+=job.waits[job.count];job.count++}
      if(previous!==job.count){
        const body=aiRoot.querySelector('[data-message-index="'+index+'"] .bubble-copy');
        const scroll=document.getElementById('chatScroll');
        const shouldFollow=scroll&&scroll.scrollHeight-scroll.scrollTop-scroll.clientHeight<130;
        if(body)paintReply(body,job.pieces,job.count);
        if(shouldFollow)scroll.scrollTop=scroll.scrollHeight;
      }
      if(job.count===job.pieces.length){finishReveal();return}
      revealFrame=requestAnimationFrame(tick);
    };
    revealFrame=requestAnimationFrame(tick);
  }

  // 模型只负责生成解释；可点击的站内操作由服务器返回已核验的白名单动作。
  async function checkAiStatus(){
    if (!['https:','http:'].includes(location.protocol)){state.aiStatus='unavailable';return}
    try{
      const r=await fetch('/api/status',{cache:'no-store'});
      const data=await r.json();state.aiStatus=r.ok&&data.ready?'ready':'unavailable';
    }catch{state.aiStatus='unavailable'}
    if(state.assistant==='full'&&state.messages.length===0)renderAssistant();
  }
  // Large files bypass the 100 MB Cloudflare per-request limit via 8 MiB R2 multipart parts.
  async function uploadLargeAttachment(file,ctrl) {
    const start=await fetch('/api/upload/start',{
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({name:file.name,size:file.size}),signal:ctrl.signal,cache:'no-store'
    });
    const setup=await start.json().catch(()=>({}));
    if(!start.ok)throw new Error(setup.message||'无法创建大文件上传任务');
    const ticket=setup.ticket;
    if(typeof ticket!=='string'||!Number.isInteger(setup.parts))throw new Error('上传服务返回了无效配置');
    const parts=[];
    let completed=false;
    try{
      for(let index=0;index<setup.parts;index++){
        const begin=index*setup.chunkBytes;
        const chunk=file.slice(begin,Math.min(file.size,begin+setup.chunkBytes));
        const response=await fetch('/api/upload/part',{
          method:'PUT',headers:{'x-upload-ticket':ticket,'x-part-number':String(index+1),'content-type':'application/octet-stream'},
          body:chunk,signal:ctrl.signal,cache:'no-store'
        });
        const result=await response.json().catch(()=>({}));
        if(!response.ok)throw new Error(result.message||`上传第 ${index+1} 块失败`);
        parts.push({partNumber:result.partNumber,etag:result.etag});
        state.uploadProgress=`正在上传文件 · ${Math.round((index+1)/setup.parts*100)}%`;
        const status=document.querySelector('.thinking-content small');if(status)status.textContent=state.uploadProgress;
      }
      const response=await fetch('/api/upload/complete',{
        method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({ticket,parts}),signal:ctrl.signal,cache:'no-store'
      });
      const result=await response.json().catch(()=>({}));
      if(!response.ok||result.ready!==true)throw new Error(result.message||'文件合并失败');
      completed=true;
      state.uploadProgress='正在阅读材料并整理回答';
      const status=document.querySelector('.thinking-content small');if(status)status.textContent=state.uploadProgress;
      return ticket;
    }finally{
      if(!completed)fetch('/api/upload/abort',{
        method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({ticket}),cache:'no-store'
      }).catch(()=>{});
    }
  }

  async function ask(question){
    question=String(question||'').trim().slice(0,600);
    if((!question&&!state.attachment)||state.thinking)return;
    const attachment=state.attachment;
    state.attachment=null;
    finishReveal();stopMic();state.assistant='full';
    // 先保存历史，避免将新问题重复放入 history。
    const history=[];
    for(let i=0;i<state.messages.length-1;i++){
      const u=state.messages[i],a=state.messages[i+1];
      if(u.from==='user'&&a.from==='assistant'&&!a.isError){
        const extra=a.itinerary?'\n当前行程：'+a.itinerary.plan.map(d=>'第'+d.day+'天 '+d.nodes.map(n=>n.name).join('、')).join('；'):'';
        history.push({role:'user',content:u.text.slice(0,600)},{role:'assistant',content:(a.text+extra).slice(0,1800)});i++;
      }
    }
    history.splice(0,Math.max(0,history.length-8));
    const prompt=question||(attachment?'请说明这份材料的主要内容，并给我下一步办理建议。':'');
    state.messages.push({from:'user',text:prompt,attachmentName:attachment?.name||''});state.thinking=true;state.uploadProgress='';renderAssistant();
    const ctrl=new AbortController();aiController=ctrl;
    const timeout=setTimeout(()=>ctrl.abort(),attachment?(attachment.size>MAX_DIRECT_BYTES?720000:180000):48000);
    let revealIndex=null;
    try{
      if(!['https:','http:'].includes(location.protocol))throw new Error('当前为离线页面。联网后可使用办事咨询。');
      const payload={question:prompt,region:state.region,history,mode:attachment?'chat':'product',context:{tab:state.tab,guide:state.tab==='services'&&state.filter!=='all'?state.filter:null,task:state.task?.region===state.region?{id:state.task.id,understood:markedCount(state.task)}:null}};
      if(attachment?.size>MAX_DIRECT_BYTES)payload.attachmentToken=await uploadLargeAttachment(attachment,ctrl);
      const form=attachment&&attachment.size<=MAX_DIRECT_BYTES?new FormData():null;
      if(form){form.append('payload',JSON.stringify(payload));form.append('file',attachment,attachment.name)}
      const res=await fetch('/api/chat',{
        method:'POST',...(form?{}:{headers:{'content-type':'application/json'}}),
        body:form||JSON.stringify(payload),signal:ctrl.signal,cache:'no-store'
      });
      const data=await res.json().catch(()=>({}));
      if(!res.ok)throw new Error(data.message||`AI 服务暂时不可用（HTTP ${res.status}）`);
      if(typeof data.text!=='string'||!data.text.trim())throw new Error('AI 未返回有效文字，请重试。');
      const allowedGuides=new Set(Object.keys(guide));
      const allowedOfficial=new Set(Object.keys(URLS));
      const allowedTabs=new Set(['home','services','news','profile']);
      const actions=(Array.isArray(data.actions)?data.actions:[]).filter(a=>a&&(
        (a.type==='guide'&&allowedGuides.has(a.value))||
        (a.type==='official'&&allowedOfficial.has(a.value))||
        (a.type==='tab'&&allowedTabs.has(a.value))
      )&&typeof a.label==='string').slice(0,4).map(a=>({type:a.type,value:a.value,label:a.label.slice(0,40)}));
      if(aiController!==ctrl)return;
      state.aiStatus='ready';
      const trace=Array.isArray(data.agent?.trace)?data.agent.trace.filter(x=>x&&typeof x.label==='string'&&typeof x.detail==='string').slice(0,4).map(x=>({label:x.label.slice(0,40),detail:x.detail.slice(0,100)})):[];
      const rawPlan=data.agent?.plan;
      const plan=rawPlan&&allowedGuides.has(rawPlan.id)&&Array.isArray(rawPlan.steps)?{id:rawPlan.id,title:String(rawPlan.title||'办事步骤').slice(0,40),steps:rawPlan.steps.filter(x=>typeof x==='string').slice(0,3).map(x=>x.slice(0,140))}:null;
      const itinerary=window.JZZX_TRAVEL_HOME?.normalizePlan(data.itinerary,window.WENLV)||null;
      const sources=(Array.isArray(data.sources)?data.sources:[]).filter(s=>window.JZZX_TRAVEL_HOME?.safePublicSource(s?.url)&&typeof (s.label||s.title)==='string').slice(0,12).map(s=>({label:(s.label||s.title).slice(0,100),url:s.url}));
      const d=data.feedbackDraft;const feedbackDraft=d&&['服务态度','设施与环境','价格与收费','安全问题','其他'].includes(d.category)&&typeof d.text==='string'&&d.text.trim()?{category:d.category,text:d.text.slice(0,400)}:null;
      const posterDraft=typeof data.posterDraft?.prompt==='string'&&data.posterDraft.prompt.trim()?{prompt:data.posterDraft.prompt.slice(0,1200)}:null;
      state.messages.push({from:'assistant',text:data.text.slice(0,2000),actions,agent:{trace,plan},itinerary,sources,feedbackDraft,posterDraft});
      revealIndex=state.messages.length-1;
    }catch(err){
      if(aiController!==ctrl)return;
      state.aiStatus='unavailable';
      const message=err?.name==='AbortError'?'请求超时，请检查网络后重试。':String(err?.message||'暂时无法连接办事咨询，请稍后重试');
      state.messages.push({from:'assistant',text:message,isError:true,actions:[
        {label:'浏览政务服务',type:'tab',value:'services'},
        {label:'吉林省政府官网',type:'official',value:'government'}
      ]});
    }finally{
      clearTimeout(timeout);
      if(aiController===ctrl){aiController=null;state.thinking=false;state.uploadProgress='';if(revealIndex!==null)startReveal(revealIndex);else renderAssistant();}
    }
  }
  function setVoiceText(msg){state.voiceMessage=msg;const v=document.getElementById('voiceInlineMessage');if(v)v.textContent=msg;const f=document.getElementById('fullVoiceMessage');if(f)f.textContent=msg;const s=document.getElementById('voiceVisualStatus');if(s)s.textContent=state.voice==='listening'?'正在聆听':state.voice==='meter'?'正在接收声音':state.voice==='requesting'?'正在申请权限':'有什么想办的事？'}
  function stopMic(){if(recognition){const r=recognition;recognition=null;try{r.abort()}catch{}}if(meterHandle){cancelAnimationFrame(meterHandle);meterHandle=0}if(micSource){try{micSource.disconnect()}catch{}micSource=null}if(micStream){micStream.getTracks().forEach(t=>t.stop());micStream=null}if(micCtx){const c=micCtx;micCtx=null;c.close().catch(()=>{})}analyser=null;state.power=0;state.voice='idle';resetBars()}
  function resetBars(){document.querySelectorAll('.voice-meter span').forEach(x=>x.style.height='10px');document.querySelectorAll('.voice-orb').forEach(x=>x.style.transform='scale(1)')}
  function meterLoop(){if(!analyser||!micStream)return;const bins=new Uint8Array(analyser.fftSize);analyser.getByteTimeDomainData(bins);let sum=0;for(const v of bins){const z=(v-128)/128;sum+=z*z}const rms=Math.sqrt(sum/bins.length);state.power=state.power*.69+Math.min(1,rms*5.8)*.31;document.querySelectorAll('.voice-meter span').forEach((el,i)=>{const variation=.64+Math.abs(Math.sin(performance.now()/140+i*1.55))*.45;el.style.height=`${Math.round(7+state.power*37*variation)}px`});document.querySelectorAll('.voice-orb').forEach(el=>el.style.transform=`scale(${(1+state.power*.12).toFixed(3)})`);meterHandle=requestAnimationFrame(meterLoop)}
  async function startVoice(){if(state.voice!=='idle'){stopMic();state.voiceMessage='语音已停止，可输入文字继续';renderAssistant();return}
    const proto=location.protocol;
    if(proto==='content:'||!window.isSecureContext){setVoiceText('当前页面无法使用麦克风，请使用文字或输入法语音输入。');return}
    if(!navigator.mediaDevices?.getUserMedia){setVoiceText('当前浏览器未提供麦克风采集接口，请更换浏览器或使用输入法的语音输入。');return}
    state.voice='requesting';renderAssistant();setVoiceText('正在申请麦克风权限…');try{
      micStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
      if(!state.assistant||state.voice!=='requesting'){stopMic();return}
      const Context=window.AudioContext||window.webkitAudioContext;
      if(Context){micCtx=new Context();if(micCtx.state==='suspended')await micCtx.resume();micSource=micCtx.createMediaStreamSource(micStream);analyser=micCtx.createAnalyser();analyser.fftSize=256;micSource.connect(analyser);meterLoop()}
      const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
      if(!Recognition&&state.assistant==='full'){stopMic();renderAssistant();setVoiceText('当前浏览器不支持语音转文字，可使用系统听写或输入法。');return}
      if(!Recognition){state.voice='meter';renderAssistant();setVoiceText('麦克风已接通，声纹会跟随真实音量变化；但当前浏览器没有语音转文字接口，请使用键盘语音输入。');return}
      const r=new Recognition();recognition=r;r.lang='zh-CN';r.interimResults=true;r.continuous=false;r.maxAlternatives=1;
      r.onstart=()=>{if(recognition!==r)return;state.voice='listening';renderAssistant();setVoiceText('正在聆听，说完后会填入输入框，请核对后发送。')};
      r.onresult=e=>{if(recognition!==r)return;const final=Array.from(e.results).filter(x=>x.isFinal).map(x=>x[0].transcript).join('').trim();const interim=Array.from(e.results).map(x=>x[0].transcript).join('').trim();if(interim){setVoiceText('正在识别：'+interim)}if(final){stopMic();renderAssistant();const input=document.getElementById(state.assistant==='compact'?'compactInput':'chatInput');if(input){const limit=input.maxLength>0?input.maxLength:600;input.value=[input.value.trim(),final].filter(Boolean).join(' ').slice(0,limit);input.focus();setVoiceText('语音已转成文字，请检查后发送。')}}};
      r.onerror=e=>{if(recognition!==r)return;const reason={'not-allowed':'语音识别权限被拒绝','service-not-allowed':'识别服务不可用','network':'语音识别网络服务无法连接','no-speech':'未检测到语音，请重试','audio-capture':'无法采集麦克风声音'}[e.error]||`语音识别失败（${e.error||'未知'}）`;stopMic();renderAssistant();setVoiceText(`${reason}。可改用手机输入法语音输入。`);notice(reason)};
      r.onend=()=>{if(recognition!==r)return;stopMic();renderAssistant();setVoiceText('语音识别已结束，您可以再次点击麦克风。')};
      r.start();
    }catch(err){stopMic();renderAssistant();const refused=['NotAllowedError','PermissionDeniedError','SecurityError'].includes(err?.name);const tip=refused?'麦克风权限被拒绝，请在浏览器网站设置允许麦克风':'无法启动语音：'+(err?.name||'未知原因');setVoiceText(tip+'。也可直接输入文字。');notice(tip)}
  }
  function tts(){const x=[...state.messages].reverse().find(m=>m.from==='assistant');if(!x)return;if(!('speechSynthesis'in window)){notice('当前设备不支持语音播报');return}speechSynthesis.cancel();const msg=new SpeechSynthesisUtterance(x.text);msg.lang='zh-CN';msg.rate=state.elder?.88:1;try{speechSynthesis.speak(msg);notice('正在播报文字回复')}catch{notice('未能启动播报，请检查系统中文语音引擎')}}
  function handleClick(e){const target=e.target.closest('button,[data-dismiss]');if(!target)return;
    if(target.dataset.dismiss==='modal'&&e.target===target){state.modal=null;renderModal();return}
    if(target.dataset.dismiss==='assistant'&&e.target===target){closeAssistant();return}
    const t=target.dataset.tab;if(t){setTab(t);return}
    const k=target.dataset.kind;if(k){state.tab='services';state.filter=k;state.search='';render();window.scrollTo(0,0);return}
    const filter=target.dataset.filter;if(filter){state.filter=filter;render();return}
    const g=target.dataset.guide;if(g){state.modal=(g==='policy'&&policies.length)?'policy-list':'guide:'+g;renderModal();return}
    const pid=target.dataset.policy;if(pid){if(policyById.has(pid)){state.modal='policy:'+pid;renderModal()}return}
    const purl=target.dataset.policyUrl;if(purl){openPolicyUrl(purl);return}
    const roleId=target.dataset.role;if(roleId){setPortalRole(roleId);return}
    if(target.dataset.itiSource!==undefined||target.hasAttribute('data-iti-close')||target.dataset.itiUrl||target.dataset.itiAction!==undefined){if(window.JZZX_ITINERARY&&window.JZZX_ITINERARY.handle(target))return}
    const off=target.dataset.official;if(off){openOfficial(off);return}
    const region=target.dataset.region;if(region){state.region=region;state.modal=null;persist();render();notice(`已切换到${region}`);return}
     const step=target.dataset.taskStep;
     if(step!==undefined){const i=Number(step);if(state.task&&Number.isInteger(i)&&i>=0&&i<state.task.checked.length){state.task.checked[i]=!state.task.checked[i];persistTask();render();}return}
     const posterIndex=target.dataset.chatPoster;
     if(posterIndex!==undefined){const d=state.messages[Number(posterIndex)]?.posterDraft;if(d){try{sessionStorage.setItem('jzzx-poster-draft-v1',JSON.stringify(d))}catch{notice('无法转交描述，请复制后手动填写。');return}state.studioPortal=true;state.onlinePortal=false;setTab('news');}return}
     const feedbackIndex=target.dataset.chatFeedback;
     if(feedbackIndex!==undefined){const d=state.messages[Number(feedbackIndex)]?.feedbackDraft,role=target.dataset.destination;if(d&&['tourist','online'].includes(role)){try{sessionStorage.setItem('jzzx-feedback-draft-v1',JSON.stringify(d))}catch{notice('无法转交草稿，请复制文字后手动填写。');return}state.studioPortal=false;state.onlinePortal=role==='online';if(!state.onlinePortal)state.portalRole='tourist';setTab('news');}return}
     const tripIndex=target.dataset.openChatTrip;
     if(tripIndex!==undefined){const p=state.messages[Number(tripIndex)]?.itinerary;if(p){setTab('home');window.JZZX_TRAVEL_HOME?.acceptPlan(p);}return}
     const planIndex=target.dataset.savePlan;
     if(planIndex!==undefined){savePlan(Number(planIndex));return}
     const p=target.dataset.prompt;if(p){ask(p);return}
    const at=target.dataset.answerAction;if(at){const val=target.dataset.answerValue;if(at==='guide'){state.modal='guide:'+val;closeAssistant();renderModal()}else if(at==='official'){openOfficial(val)}else if(at==='tab'){setTab(val)}return}
    switch(target.dataset.action){
      case 'open-ai':setAssistant('compact');break;
      case 'ai-close':closeAssistant();break;
      case 'ai-full':state.assistant='full';renderAssistant();break;
      case 'voice':startVoice();break;
      case 'voice-help':state.modal='voice-help';stopMic();state.assistant=null;renderAssistant();renderModal();break;
      case 'online-portal':state.studioPortal=false;state.onlinePortal=true;render();break;
      case 'studio-portal':state.onlinePortal=false;state.studioPortal=true;render();break;
      case 'local-portal':state.onlinePortal=false;state.studioPortal=false;render();break;
      case 'task-open':if(state.task){state.modal='task';renderModal()}break;
      case 'task-delete':
        if(state.task&&window.confirm('清除当前设备保存的导办清单？')){state.task=null;persistTask();state.modal=null;render();notice('本机导办清单已清除')}break;
      case 'task-ask':
        if(state.task){const t=state.task;state.modal=null;setAssistant('full');const input=document.getElementById('chatInput');if(input){input.value=`我在${state.region}，想继续了解${t.title}。我已标记了解 ${markedCount(t)} 步，请帮助我核对下一步。`;input.focus()}}break;
      case 'regions':state.modal='regions';renderModal();break;
      case 'personal':if(!window.JZZX_PROFILE){notice('个人信息模块未加载，请刷新页面');break}state.modal='personal';renderModal();break;
      case 'alias':state.modal='alias';renderModal();break;
      case 'modal-close':state.modal=null;renderModal();break;
      case 'policy-list':state.modal='policy-list';renderModal();break;
      case 'policy-back':state.modal=policies.length?'policy-list':null;renderModal();break;
      case 'itinerary':state.modal='itinerary';renderModal();break;
      case 'travel-tourist':setPortalRole('tourist');setTab('news');break;
      case 'roles':state.modal='role-select';renderModal();break;
      case 'elder':state.elder=!state.elder;persist();render();notice(state.elder?'已开启长辈模式':'已退出长辈模式');break;
      case 'motion':state.motion=!state.motion;persist();render();notice(state.motion?'已开启动态效果':'已减少动态效果');break;
      case 'skip-reveal':finishReveal();break;
      case 'tts':tts();break;
      case 'attach':chooseAttachment();break;
      case 'remove-attachment':state.attachment=null;renderAttachment();break;
    }
  }
  document.addEventListener('click',handleClick);
  document.addEventListener('submit',e=>{
    if(e.target.id==='voiceForm'){e.preventDefault();const q=new FormData(e.target).get('question')?.toString().trim();if(q)ask(q);else startVoice()}
    if(e.target.id==='chatForm'){e.preventDefault();const q=new FormData(e.target).get('question')?.toString().trim();if(q||state.attachment)ask(q)}
    if(e.target.id==='aliasForm'){e.preventDefault();state.alias=new FormData(e.target).get('alias')?.toString().trim().slice(0,12)||'';state.modal=null;persist();render();notice('本地昵称已保存')}
    if(e.target.id==='personalForm'){e.preventDefault();const p=window.JZZX_PROFILE?.read(modalRoot);if(!p){notice('个人信息模块未加载，请刷新页面');return}if(!p.ok){notice(p.error);return}window.JZZX_PROFILE.save(p.value);state.modal=null;render();notice('个人信息已保存，只存在本机')}
  });
  document.addEventListener('change',e=>{
    if(e.target.id!=='chatFile')return;
    const file=e.target.files?.[0];e.target.value='';
    if(!file)return;
    if(file.size===0||file.size>allowedSize(file)){notice('文件大小超出该类型支持的上限');return}
    if(!/\.(png|jpe?g|webp|gif|pdf|docx?|pptx?|xlsx?|txt|md|csv)$/i.test(file.name)){notice('当前不支持该文件格式');return}
    state.attachment=file;renderAttachment();notice('已选择文件。发送后将用于本次咨询。');
  });
  document.addEventListener('input',e=>{if(e.target.id==='searchInput'){state.search=e.target.value.trim();const list=document.getElementById('serviceList');if(list)list.outerHTML=serviceList()}});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(state.assistant)closeAssistant();else if(state.modal){state.modal=null;renderModal()}}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){stopMic();finishReveal()}});

  // 光球使用已优化的珠光图层与 CSS transform 动画，无常驻 Canvas 绘制。
  // 保留麦克风真实音量驱动的 voice-orb transform 和系统减少动态设置。
  render();checkAiStatus();
  if('serviceWorker'in navigator&&location.protocol==='https:'){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}))}
})();
