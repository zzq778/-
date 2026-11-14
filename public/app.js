/* 吉政知行 v0.5：政务导办 AI 云端对接版。
   保留 v0.4 的界面与动效；AI 请求仅发送到同源 /api/chat。
   不传递身份证、社保卡号或密码等敏感信息。
*/
(() => {
  'use strict';
  const URLS = Object.freeze({government:'https://www.jl.gov.cn/', hall:'https://zwfw.jl.gov.cn/jljhszwfww/', personal:'https://zwfw.jl.gov.cn/jlzwfwall/grbs/'});
  const regions=['长春市','吉林市','四平市','辽源市','通化市','白山市','松原市','白城市','延边州'];
  const kinds=[
    ['pension','社保养老','待遇查询 · 资格认证','heart'],
    ['medical','医保健康','参保服务 · 医保指引','health'],
    ['cert','证件办理','补办换领 · 官方入口','card'],
    ['policy','政策解读','政策原文 · 适用条件','file'],
    ['nearby','办事网点','服务大厅 · 线下窗口','pin'],
    ['work','就业便民','就业创业 · 公共服务','briefcase']
  ];
  const guide={
    pension:{title:'养老待遇与资格认证',cat:'pension',desc:'养老金、资格认证、退休待遇',steps:['区分是查询养老金待遇，还是进行领取资格认证。','进入“吉事办”省级政务服务大厅，确认办理地区。','在官方平台搜索“养老保险”或“资格认证”，选择具体事项。','按官方流程进行身份认证；本演示不要求输入身份证等敏感信息。'],url:URLS.hall},
    medical:{title:'医保服务与报销指引',cat:'medical',desc:'医保缴费、报销、参保信息',steps:['确定需要查询参保信息、医保缴费还是费用报销。','打开吉林省网上办事大厅，选择当前实际办理地区。','进入医保相关事项页面，仔细核对办理材料与办理条件。','涉及待遇、金额或个人医保账户，以官方经办渠道为准。'],url:URLS.hall},
    cert:{title:'居民证件补换领',cat:'cert',desc:'身份证办理入口与指南',steps:['确认是首次申领、到期换领还是遗失补领。','在吉林政务服务平台搜索具体证件事项。','核对地区、受理机构、材料以及是否支持网上办理。','使用政府指定渠道完成实名验证与业务提交。'],url:URLS.personal},
    policy:{title:'吉林政策文件查询',cat:'policy',desc:'官方政策出处与应用范围',steps:['明确政策主题，例如养老补贴、创业支持等。','打开吉林省人民政府网站，搜索相关文件。','核对发布单位、发布日期、实施时间和适用区域。','不把非官方解释当作最终办事依据。'],url:URLS.government},
    nearby:{title:'查找线下办事网点',cat:'nearby',desc:'办事地点和窗口指引',steps:['确认您所在的市州和具体需要办理的业务。','进入“吉事办”网上办事大厅。','查找“办事网点”或相关受理机构信息。','到访前确认具体地址、工作时间及预约要求。'],url:URLS.hall},
    work:{title:'就业创业与公共服务',cat:'work',desc:'就业登记、创业政策等',steps:['确认要查询的是就业登记、就业补贴还是创业服务。','打开吉林省政务服务网上办事大厅。','搜索业务名称并核对办理人群与地区。','通过官方渠道办理；本应用只提供导办服务。'],url:URLS.personal}
  };
  const news=[
    {title:'吉林省人民政府 · 省内政务要闻',sub:'官方政务动态入口 · 非实时抓取',url:URLS.government},
    {title:'吉林省网上办事大厅（吉事办）',sub:'省级政务服务及个人办事入口',url:URLS.hall},
    {title:'吉林政务服务 · 个人办事',sub:'官方在线办事与事项指南入口',url:URLS.personal}
  ];
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
  const state={tab:'home',region:regions.includes(saved.region)?saved.region:'长春市',elder:!!saved.elder,motion:saved.motion!==false,alias:typeof saved.alias==='string'?saved.alias:'',filter:'all',search:'',modal:null,assistant:null,voice:'idle',voiceMessage:'',messages:[],thinking:false,power:0,aiStatus:'checking'};
  const content=document.getElementById('content'),nav=document.getElementById('bottomNav'),modalRoot=document.getElementById('modalRoot'),aiRoot=document.getElementById('aiRoot'),toastEl=document.getElementById('toast');
  let recognition=null,micStream=null,micCtx=null,micSource=null,analyser=null,meterHandle=0,toastHandle=null,replyTimer=null,aiController=null;
  function persist(){try{localStorage.setItem('jzzx-motion-v03',JSON.stringify({region:state.region,elder:state.elder,motion:state.motion,alias:state.alias}))}catch{/* 无存储权限的本地文件照常使用 */}}
  function notice(text){toastEl.innerHTML=`<div class="toast">${esc(text)}</div>`;clearTimeout(toastHandle);toastHandle=setTimeout(()=>toastEl.innerHTML='',3600)}
  function openOfficial(key){const url=URLS[key];if(!url){notice('链接未通过官方白名单校验');return}const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';document.body.append(a);a.click();a.remove()}
  const liquid=(cls='')=>`<canvas class="${cls}" width="220" height="220" data-liquid-canvas aria-hidden="true"></canvas>`;
  function topbar(){return `<header class="topbar"><div class="brand"><div class="brand-square">吉</div><div><strong>吉政知行</strong><small>JILIN · CIVIC COMPANION</small></div></div><button type="button" class="region-chip" data-action="regions">${ico('pin')}${esc(state.region)}${ico('down')}</button></header>`}
  function home(){return `${topbar()}<section class="hero"><span class="hero-aside">SERVICE FOR EVERYONE</span><div class="hero-id"><i></i> JILIN / 2026</div><h1 class="hero-title">让政务服务，<br><span>更简单一点。</span></h1><p class="hero-sub">不必记住复杂的办事流程。把问题告诉吉小知，一步一步找到正确方向。</p><div class="hero-smallprint"><span class="dot"></span>为吉林居民设计的智能导办体验</div></section>
  <div class="main-wrap"><section class="ai-feature reveal"><div class="ai-feature-inner"><div class="feature-kicker"><span class="starburst">✳</span> THE CIVIC ASSISTANT</div><h2 class="feature-title">先问小知，<br>再去办理。</h2><p class="feature-desc">查政策、找入口、看步骤。让复杂的事清晰起来。</p><button type="button" class="feature-action" data-action="open-ai">开始对话 ${ico('arrow')}</button></div><div class="orb-wrap"><div class="feature-orbit"></div><div class="feature-orbit two"></div>${liquid()}</div></section>
  <section class="reveal"><div class="section-head"><h2 class="heading"><span class="section-index">01 /</span> 常用服务</h2><button type="button" class="section-more" data-tab="services">全部服务 ${ico('right')}</button></div><div class="services-grid">${kinds.map(([id,n,sub,icon])=>`<button type="button" class="service-card" data-kind="${id}"><span class="service-icon">${ico(icon)}</span><span class="service-name">${esc(n)}</span><div class="service-sub">${esc(sub)}</div><span class="service-arrow">${ico('arrow')}</span></button>`).join('')}</div></section>
  <section class="reveal"><div class="section-head"><h2 class="heading"><span class="section-index">02 /</span> 政务资讯</h2><button type="button" class="section-more" data-tab="news">更多入口 ${ico('right')}</button></div><div class="news-list">${news.slice(0,2).map((x,i)=>newsItem(x,i)).join('')}</div></section><p class="note-plain">学生竞赛交互原型 · 非政府官方应用。所有政策和实际办理要求以政府官方渠道为准。</p></div>${fab()}`}
  function newsItem(x,i){const key=Object.keys(URLS).find(k=>URLS[k]===x.url);return `<button type="button" class="news-item" data-official="${key}"><span class="news-number">0${i+1}</span><span class="news-copy"><span class="news-item-title">${esc(x.title)}</span><span class="news-item-sub">${esc(x.sub)}</span></span>${ico('external')}</button>`}
  function fab(){return `<button type="button" class="floating-ai" data-action="open-ai" aria-label="打开吉小知语音对话"><span class="fab-spot">${liquid()}</span><span class="fab-label">问问吉小知</span><span class="fab-wave" aria-hidden="true"><i></i><i></i><i></i><i></i></span></button>`}
  function heading(kicker,title,desc){return `${topbar()}<header class="page-header"><div class="eyebrow">${kicker}</div><h1 class="page-title">${title}</h1><p class="page-sub">${desc}</p></header>`}
  function filteredGuides(){return Object.values(guide).filter(x=>(state.filter==='all'||x.cat===state.filter)&&(!state.search||`${x.title} ${x.desc}`.includes(state.search)))}
  function serviceList(){return `<div class="service-list" id="serviceList">${filteredGuides().map(x=>`<button type="button" class="service-row" data-guide="${x.cat}"><span class="row-icon">${ico(kinds.find(a=>a[0]===x.cat)[3])}</span><span class="row-copy"><strong>${esc(x.title)}</strong><small>${esc(x.desc)}</small></span><span class="arrow">${ico('right')}</span></button>`).join('')||'<p class="page-sub">没有匹配的演示事项，请换个关键词。</p>'}</div>`}
  function policyRow(p){return `<button type="button" class="policy-row" data-policy="${esc(p.id)}"><span class="policy-tag">${esc(policyTopics[p.topic]||'政策')}</span><span class="policy-row-main"><strong>${esc(p.title)}</strong><small>${esc(p.issuer||'发文机关见原文')} · ${esc(p.publishedAt||'')}</small></span>${ico('right')}</button>`}
  function policyListSheet(close){
    const rows=policies.map(policyRow).join('');
    return `<div class="sheet-header"><strong>政策解读</strong>${close}</div><p class="sheet-desc">共 ${policies.length} 条，逐条对应吉林省政府网原文${policyVerifiedAt?` · 最后核对 ${esc(policyVerifiedAt)}`:''}。每条政策的解读（一句话读懂等）由参赛项目组撰写，<b>不是官方解释</b>。</p><div class="policy-list">${rows}</div><div class="policy-actions"><button type="button" class="primary" data-policy-url="${esc(URLS.government)}zcxx/">前往省政府政策信息栏目 ${ico('external')}</button></div><p class="sheet-legal">仅提供政策入口与通俗解读，不代办、不审批、不代表政府立场；办理要求以官方原文及经办窗口为准。</p>`;
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
    <p class="sheet-legal">解读内容由参赛项目组编写（核对日期 ${esc(policyVerifiedAt||'未标注')}），非官方解释；政策可能调整，办理前请以官方原文和经办机构答复为准。</p>`;
  }
  function services(){return `${heading('01 / SERVICE DIRECTORY','政务服务','常见事项入口与操作步骤，先把路径理清楚。')}<div class="page-wrap"><label class="search-field">${ico('search')}<input id="searchInput" type="search" value="${esc(state.search)}" placeholder="搜索养老、医保、证件……" autocomplete="off" /></label><div class="filter-row"><button type="button" class="filter-pill ${state.filter==='all'?'active':''}" data-filter="all">全部</button>${kinds.map(([id,n])=>`<button type="button" data-filter="${id}" class="filter-pill ${state.filter===id?'active':''}">${esc(n)}</button>`).join('')}</div>${serviceList()}<p class="note-plain">仅提供事项目录与导办说明，不在本应用提交政务申请。</p></div>${fab()}`}
  function newsPage(){return `${heading('02 / VERIFIED SOURCES','政务资讯','把最新政策交给官方发布，把查找路径交给我们。')}<div class="page-wrap news-page"><p class="news-disclaimer">当前版本提供已核对的官方信息入口，不伪造实时资讯列表；具体内容请跳转政府网站查看。</p><div class="news-list">${news.map((x,i)=>newsItem(x,i)).join('')}</div></div>${fab()}`}
  function profile(){return `${heading('03 / PERSONAL SETTINGS','我的设置','让政务服务更符合您的习惯。')}<div class="page-wrap"><div class="profile-card"><div class="profile-header"><div class="avatar">${esc((state.alias||'吉').slice(0,1))}</div><div><h3>${esc(state.alias||'访客，您好')}</h3><p>仅本机体验资料 · 未注册真实账号</p></div></div></div><div class="setting-list"><button type="button" class="setting" data-action="alias"><span>体验昵称<br><small>在本机保存，不是真实注册</small></span>${ico('edit')}</button><button type="button" class="setting" data-action="regions"><span>当前地区<br><small>${esc(state.region)}</small></span>${ico('right')}</button><button type="button" class="setting" data-action="elder"><span>长辈模式<br><small>更大字号与清楚的操作入口</small></span><span class="switch ${state.elder?'on':''}"></span></button><button type="button" class="setting" data-action="motion"><span>动态效果<br><small>支持系统“减少动态”偏好</small></span><span class="switch ${state.motion?'on':''}"></span></button><button type="button" class="setting" data-action="voice-help"><span>麦克风与语音说明<br><small>如何在 Android 正确使用</small></span>${ico('right')}</button></div><p class="note-plain">v0.5 · 云端 AI 需部署 Cloudflare Worker 后运行；目前没有真实账号系统或新闻抓取。</p></div>${fab()}`}
  function render(){document.documentElement.classList.toggle('elder',state.elder);document.documentElement.classList.toggle('motion-off',!state.motion);const r={home,services,news:newsPage,profile}[state.tab]||home;content.innerHTML=r();nav.innerHTML=[['home','首页','home'],['services','服务','grid'],['news','资讯','news'],['profile','我的','user']].map(([id,t,icon])=>`<button type="button" class="tab ${state.tab===id?'active':''}" data-tab="${id}" ${state.tab===id?'aria-current="page"':''}><span class="tab-icon">${ico(icon)}</span><span>${t}</span></button>`).join('');renderModal();renderAssistant();revealOnScroll();}
  function revealOnScroll(){const els=[...document.querySelectorAll('.reveal')];if(!('IntersectionObserver'in window)){els.forEach(e=>e.classList.add('visible'));return;}const o=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');o.unobserve(e.target)}}),{rootMargin:'0px 0px -26px 0px',threshold:.08});els.forEach(e=>o.observe(e));}
  function setTab(t){if(!['home','services','news','profile'].includes(t))return;closeAssistant();state.modal=null;state.tab=t;state.search='';state.filter='all';render();window.scrollTo({top:0,behavior:'instant'})}
  function renderModal(){document.body.classList.toggle('sheet-open',!!state.modal||!!state.assistant);if(!state.modal){modalRoot.innerHTML='';return;}const close=`<button type="button" class="close-round" data-action="modal-close" aria-label="关闭">${ico('close')}</button>`;let body='';
    if(state.modal==='regions')body=`<div class="sheet-header"><strong>选择所在地区</strong>${close}</div><p class="sheet-desc">切换吉林省内市州。事项办理时请以官方系统的实际地区为准。</p><div class="region-grid">${regions.map(x=>`<button type="button" class="region-option ${x===state.region?'active':''}" data-region="${esc(x)}">${esc(x)}</button>`).join('')}</div>`;
    else if(state.modal==='alias')body=`<div class="sheet-header"><strong>体验昵称</strong>${close}</div><p class="sheet-desc">这是本地交互演示，不会创建服务器账号，也无需真实身份资料。</p><form id="aliasForm"><input class="input-row" name="alias" maxlength="12" placeholder="例如：李同学" value="${esc(state.alias)}" required /><div style="height:16px"></div><button class="primary" type="submit">保存昵称 ${ico('check')}</button></form>`;
    else if(state.modal==='voice-help')body=`<div class="sheet-header"><strong>语音为什么不能用？</strong>${close}</div><p class="sheet-desc">你当前可能从 <code>content://downloads</code> 或本地文件打开页面。这种环境无法保证麦克风和在线语音识别。</p><ol class="guide-steps"><li><span class="step-circle">1</span><span>将 PWA 工程部署到 HTTPS（GitHub Pages 或 Cloudflare Pages），用 Chrome 访问。</span></li><li><span class="step-circle">2</span><span>允许浏览器访问麦克风，并确保系统存在中文语音识别服务。</span></li><li><span class="step-circle">3</span><span>浏览器仍不支持转写时，使用手机输入法自带的语音输入；正式 App 可接入云端 ASR 或 Android 原生语音识别。</span></li></ol><p class="sheet-legal">本 Demo 的声纹可在获得麦克风权限后跟随真实音量变化，但语音转文字仍取决于浏览器及识别服务。</p>`;
    else if(state.modal==='policy-list')body=policyListSheet(close);
    else if(state.modal.startsWith('policy:')){const p=policyById.get(state.modal.split(':')[1]);if(!p){state.modal='policy-list';body=policyListSheet(close)}else body=policySheet(p,close)}
    else if(state.modal.startsWith('guide:')){const key=state.modal.split(':')[1],g=guide[key];if(!g){state.modal=null;modalRoot.innerHTML='';return;}const official=Object.keys(URLS).find(k=>URLS[k]===g.url);const policyEntry=key==='policy'&&policies.length?`<button type="button" class="secondary" data-action="policy-list">浏览 ${policies.length} 条已核对政策解读</button>`:'';body=`<div class="sheet-header"><strong>${esc(g.title)}</strong>${close}</div><p class="sheet-desc">${esc(state.region)} · 示例办事路径，需在官方系统核实具体事项。</p><ol class="guide-steps">${g.steps.map((s,i)=>`<li><span class="step-circle">${i+1}</span><span>${esc(s)}</span></li>`).join('')}</ol>${policyEntry}<button type="button" class="primary" data-official="${official}">前往官方服务入口 ${ico('external')}</button><p class="sheet-legal">学生比赛原型 · 仅指引操作，不代办、审批或收取材料。</p>`}
    const label=state.modal==='policy-list'||state.modal.startsWith('policy:')?'政策解读':state.modal.startsWith('guide:')?'办事指南':'设置';
    modalRoot.innerHTML=`<div class="overlay" data-dismiss="modal"><section class="sheet" role="dialog" aria-modal="true" aria-label="${label}"><div class="drag-handle"></div>${body}</section></div>`;
  }
  const barMarkup=()=>'<span></span>'.repeat(5);
  function renderAssistant(){document.body.classList.toggle('sheet-open',!!state.modal||!!state.assistant);if(!state.assistant){aiRoot.innerHTML='';return;}
    if(state.assistant==='compact'){
      let text=state.voice==='listening'?'我在听…':state.voice==='meter'?'声音已接入':state.voice==='requesting'?'正在申请权限…':'有事，问问吉小知';
      const help=state.voiceMessage||(state.voice==='listening'?'请对着麦克风说话，声纹会随声音起伏':'点击左侧麦克风说话，或直接输入文字');
      aiRoot.innerHTML=`<div class="ai-overlay compact" data-dismiss="assistant"><section class="ai-compact-stage" role="dialog" aria-modal="true" aria-label="吉小知快捷语音输入"><button type="button" class="close-ai" data-action="ai-close" aria-label="返回页面">${ico('close')}</button><div class="voice-visual"><div class="voice-orb">${liquid()}</div><strong class="voice-status-title" id="voiceVisualStatus">${esc(text)}</strong><div class="voice-status-sub" id="voiceVisualSub">吉小知 · 您的政务导办助手</div></div><div class="compact-dock"><span class="dock-caption">吉小知 · 更懂吉林的办事助手</span><form class="voice-capsule" id="voiceForm"><button type="button" class="mic-trigger ${['requesting','listening','meter'].includes(state.voice)?'active':''}" data-action="voice" aria-label="${state.voice==='idle'?'开始语音输入':'停止语音输入'}">${ico('mic')}</button><input id="compactInput" class="voice-input" name="question" maxlength="140" autocomplete="off" placeholder="${esc(text)}" aria-label="请输入政务问题"/><span class="voice-meter ${state.voice==='idle'?'idle':''}" aria-hidden="true">${barMarkup()}</span><button type="button" class="expand-ai" data-action="ai-full" aria-label="展开完整对话">${ico('plus')}</button></form><div class="voice-inline-message" id="voiceInlineMessage" aria-live="polite">${esc(help)}</div><div class="compact-help"><button type="button" data-action="ai-close">返回页面</button><button type="button" data-action="voice-help">语音使用说明</button><button type="button" data-action="ai-full">展开对话 →</button></div></div></section></div>`;
    } else {
      aiRoot.innerHTML=`<div class="ai-overlay" data-dismiss="assistant"><section class="ai-full-panel" role="dialog" aria-modal="true" aria-label="吉小知智能导办对话"><div class="drag-handle"></div><header class="ai-full-head"><span class="small-liquid">${liquid()}</span><span class="head-copy"><strong>吉小知</strong><small>政策查询 · 办事导航 · 云端 AI</small></span><button type="button" class="close-round" data-action="ai-close" aria-label="关闭对话">${ico('close')}</button></header><div class="ai-full-scroll" id="chatScroll">${state.messages.length===0?`<div class="ai-greeting"><div class="label">YOU ASK, WE GUIDE</div><h2>有问题，<br>慢慢告诉我。</h2><p>找入口、查流程、学操作。先从一个简单的问题开始。</p><span class="demo-pill">${state.aiStatus==='ready'?'云端 AI 已接入 · 官方资料导办':state.aiStatus==='unavailable'?'云端 AI 尚未连接 · 需上线部署':'连接状态检测中 · 仅 HTTPS 部署可用'}</span><div class="prompts">${['养老金资格认证怎么办？','医保报销去哪里查？','身份证到期怎么换？','在哪里看吉林省政策？'].map(x=>`<button type="button" class="prompt" data-prompt="${esc(x)}">${esc(x)} ↗</button>`).join('')}</div></div>`:''}<div class="chat-stream">${state.messages.map(x=>`<div class="bubble ${x.from}">${esc(x.text)}${x.from==='assistant'?`<div class="bubble-footer">${esc(x.isError?'服务状态提示 · 未生成 AI 回答':'云端 AI 导办 · 具体事项以官方为准')}</div>${x.actions?.length?`<div class="chat-actions">${x.actions.map(a=>`<button type="button" class="chat-action" data-answer-action="${esc(a.type)}" data-answer-value="${esc(a.value)}">${esc(a.label)} ↗</button>`).join('')}</div>`:''}<button type="button" class="chat-action" data-action="tts" style="margin-top:8px">${ico('audio')} 播报这条回复</button>`:''}</div>`).join('')}${state.thinking?`<div class="bubble assistant chat-thinking" aria-label="正在查询本地服务目录"><i></i><i></i><i></i></div>`:''}</div></div><div class="ai-composer"><form class="chat-form" id="chatForm"><input id="chatInput" class="chat-input" name="question" placeholder="输入您的政务问题" maxlength="140" aria-label="输入政务问题"/><button type="button" class="chat-icon-btn" data-action="voice" aria-label="语音输入">${ico('mic')}</button><button type="submit" class="chat-icon-btn send" aria-label="发送问题">${ico('send')}</button></form><div class="audio-note" id="fullVoiceMessage">${esc(state.voiceMessage)}</div><div class="chat-footnote">请勿输入身份证、密码等敏感信息 · 对话会发送到云端 AI</div></div></section></div>`;
    }
    if(state.messages.length){const x=document.getElementById('chatScroll');if(x)requestAnimationFrame(()=>x.scrollTop=x.scrollHeight)}
  }
  function setAssistant(mode='compact'){state.modal=null;state.assistant=mode;state.voiceMessage='';renderModal();renderAssistant()}
  function closeAssistant(){stopMic();clearTimeout(replyTimer);if(aiController){aiController.abort();aiController=null;}state.thinking=false;state.assistant=null;state.voiceMessage='';aiRoot.innerHTML='';document.body.classList.toggle('sheet-open',!!state.modal)}
  // 模型只负责生成解释；可点击的站内操作由服务器返回已核验的白名单动作。
  async function checkAiStatus(){
    if (!['https:','http:'].includes(location.protocol)){state.aiStatus='unavailable';return}
    try{
      const r=await fetch('/api/status',{cache:'no-store'});
      const data=await r.json();state.aiStatus=r.ok&&data.ready?'ready':'unavailable';
    }catch{state.aiStatus='unavailable'}
    if(state.assistant==='full'&&state.messages.length===0)renderAssistant();
  }
  async function ask(question){
    question=String(question||'').trim().slice(0,140);
    if(!question||state.thinking)return;
    stopMic();state.assistant='full';
    // 先保存历史，避免将新问题重复放入 history。
    const history=state.messages.slice(-4).filter(x=>!x.isError).map(x=>({role:x.from==='assistant'?'assistant':'user',content:x.text.slice(0,400)}));
    state.messages.push({from:'user',text:question});state.thinking=true;renderAssistant();
    const ctrl=new AbortController();aiController=ctrl;
    const timeout=setTimeout(()=>ctrl.abort(),20000);
    try{
      if(!['https:','http:'].includes(location.protocol))throw new Error('当前从本地文件打开页面。要使用云端 AI，请将工程部署到 HTTPS 地址。');
      const res=await fetch('/api/chat',{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({question,region:state.region,history}),signal:ctrl.signal,
        cache:'no-store'
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
      state.messages.push({from:'assistant',text:data.text.slice(0,2000),actions});
    }catch(err){
      if(aiController!==ctrl)return;
      state.aiStatus='unavailable';
      const message=err?.name==='AbortError'?'请求超时，请检查网络后重试。':String(err?.message||'连接云端 AI 失败，请稍后重试');
      state.messages.push({from:'assistant',text:message,isError:true,actions:[
        {label:'浏览政务服务',type:'tab',value:'services'},
        {label:'吉林省政府官网',type:'official',value:'government'}
      ]});
    }finally{
      clearTimeout(timeout);
      if(aiController===ctrl){aiController=null;state.thinking=false;renderAssistant();}
    }
  }
  function setVoiceText(msg){state.voiceMessage=msg;const v=document.getElementById('voiceInlineMessage');if(v)v.textContent=msg;const f=document.getElementById('fullVoiceMessage');if(f)f.textContent=msg;const s=document.getElementById('voiceVisualStatus');if(s)s.textContent=state.voice==='listening'?'正在聆听':state.voice==='meter'?'正在接收声音':state.voice==='requesting'?'正在申请权限':'有事，问问吉小知'}
  function stopMic(){if(recognition){const r=recognition;recognition=null;try{r.abort()}catch{}}if(meterHandle){cancelAnimationFrame(meterHandle);meterHandle=0}if(micSource){try{micSource.disconnect()}catch{}micSource=null}if(micStream){micStream.getTracks().forEach(t=>t.stop());micStream=null}if(micCtx){const c=micCtx;micCtx=null;c.close().catch(()=>{})}analyser=null;state.power=0;state.voice='idle';resetBars()}
  function resetBars(){document.querySelectorAll('.voice-meter span').forEach(x=>x.style.height='10px');document.querySelectorAll('.voice-orb').forEach(x=>x.style.transform='scale(1)')}
  function meterLoop(){if(!analyser||!micStream)return;const bins=new Uint8Array(analyser.fftSize);analyser.getByteTimeDomainData(bins);let sum=0;for(const v of bins){const z=(v-128)/128;sum+=z*z}const rms=Math.sqrt(sum/bins.length);state.power=state.power*.69+Math.min(1,rms*5.8)*.31;document.querySelectorAll('.voice-meter span').forEach((el,i)=>{const variation=.64+Math.abs(Math.sin(performance.now()/140+i*1.55))*.45;el.style.height=`${Math.round(7+state.power*37*variation)}px`});document.querySelectorAll('.voice-orb').forEach(el=>el.style.transform=`scale(${(1+state.power*.16).toFixed(3)})`);meterHandle=requestAnimationFrame(meterLoop)}
  async function startVoice(){if(state.voice!=='idle'){stopMic();state.voiceMessage='语音已停止，可输入文字继续';renderAssistant();return}
    const proto=location.protocol;
    if(proto==='content:'||!window.isSecureContext){setVoiceText('本地文件仅能体验文字操作。语音请使用 HTTPS 版本，或键盘自带的语音输入。');return}
    if(!navigator.mediaDevices?.getUserMedia){setVoiceText('当前浏览器未提供麦克风采集接口，请更换浏览器或使用输入法的语音输入。');return}
    state.voice='requesting';setVoiceText('正在申请麦克风权限…');try{
      micStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
      if(!state.assistant){stopMic();return}
      const Context=window.AudioContext||window.webkitAudioContext;
      if(Context){micCtx=new Context();if(micCtx.state==='suspended')await micCtx.resume();micSource=micCtx.createMediaStreamSource(micStream);analyser=micCtx.createAnalyser();analyser.fftSize=256;micSource.connect(analyser);meterLoop()}
      const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
      if(!Recognition){state.voice='meter';renderAssistant();setVoiceText('麦克风已接通，声纹会跟随真实音量变化；但当前浏览器没有语音转文字接口，请使用键盘语音输入。');return}
      const r=new Recognition();recognition=r;r.lang='zh-CN';r.interimResults=true;r.continuous=false;r.maxAlternatives=1;
      r.onstart=()=>{if(recognition!==r)return;state.voice='listening';renderAssistant();setVoiceText('正在聆听，说完后将自动提交；声纹会随真实声音变化。')};
      r.onresult=e=>{if(recognition!==r)return;const final=Array.from(e.results).filter(x=>x.isFinal).map(x=>x[0].transcript).join('').trim();const interim=Array.from(e.results).map(x=>x[0].transcript).join('').trim();if(interim){setVoiceText(interim)}if(final){stopMic();ask(final)}};
      r.onerror=e=>{if(recognition!==r)return;const reason={'not-allowed':'语音识别权限被拒绝','service-not-allowed':'识别服务不可用','network':'语音识别网络服务无法连接','no-speech':'未检测到语音，请重试','audio-capture':'无法采集麦克风声音'}[e.error]||`语音识别失败（${e.error||'未知'}）`;stopMic();setVoiceText(`${reason}。可改用手机输入法语音输入。`);notice(reason)};
      r.onend=()=>{if(recognition!==r)return;stopMic();setVoiceText('语音识别已结束，您可以再次点击麦克风。')};
      r.start();
    }catch(err){stopMic();const refused=['NotAllowedError','PermissionDeniedError','SecurityError'].includes(err?.name);const tip=refused?'麦克风权限被拒绝，请在浏览器网站设置允许麦克风':'无法启动语音：'+(err?.name||'未知原因');setVoiceText(tip+'。也可直接输入文字。');notice(tip)}
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
    const off=target.dataset.official;if(off){openOfficial(off);return}
    const region=target.dataset.region;if(region){state.region=region;state.modal=null;persist();render();notice(`已切换到${region}`);return}
    const p=target.dataset.prompt;if(p){ask(p);return}
    const at=target.dataset.answerAction;if(at){const val=target.dataset.answerValue;if(at==='guide'){state.modal='guide:'+val;closeAssistant();renderModal()}else if(at==='official'){openOfficial(val)}else if(at==='tab'){setTab(val)}return}
    switch(target.dataset.action){
      case 'open-ai':setAssistant('compact');break;
      case 'ai-close':closeAssistant();break;
      case 'ai-full':state.assistant='full';renderAssistant();break;
      case 'voice':startVoice();break;
      case 'voice-help':state.modal='voice-help';stopMic();state.assistant=null;renderAssistant();renderModal();break;
      case 'regions':state.modal='regions';renderModal();break;
      case 'alias':state.modal='alias';renderModal();break;
      case 'modal-close':state.modal=null;renderModal();break;
      case 'policy-list':state.modal='policy-list';renderModal();break;
      case 'policy-back':state.modal=policies.length?'policy-list':null;renderModal();break;
      case 'elder':state.elder=!state.elder;persist();render();notice(state.elder?'已开启长辈模式':'已退出长辈模式');break;
      case 'motion':state.motion=!state.motion;persist();render();notice(state.motion?'已开启动态效果':'已减少动态效果');break;
      case 'tts':tts();break;
    }
  }
  document.addEventListener('click',handleClick);
  document.addEventListener('submit',e=>{
    if(e.target.id==='voiceForm'){e.preventDefault();const q=new FormData(e.target).get('question')?.toString().trim();if(q)ask(q);else startVoice()}
    if(e.target.id==='chatForm'){e.preventDefault();const q=new FormData(e.target).get('question')?.toString().trim();if(q)ask(q)}
    if(e.target.id==='aliasForm'){e.preventDefault();state.alias=new FormData(e.target).get('alias')?.toString().trim().slice(0,12)||'';state.modal=null;persist();render();notice('本地昵称已保存')}
  });
  document.addEventListener('input',e=>{if(e.target.id==='searchInput'){state.search=e.target.value.trim();const list=document.getElementById('serviceList');if(list)list.outerHTML=serviceList()}});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(state.assistant)closeAssistant();else if(state.modal){state.modal=null;renderModal()}}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopMic()});

  // 16 秒严格周期的柔和流体材质。全部波形均为整数谐波，首尾位置和速度连续。
  const MOTION_PERIOD_MS=16000;
  let lastPaint=0;
  const media=window.matchMedia?.('(prefers-reduced-motion: reduce)');
  function reduced(){return !state.motion||!!media?.matches}
  function blobPath(ctx,phase,r){
    ctx.beginPath();
    for(let i=0;i<=72;i++){
      const a=i/72*Math.PI*2;
      const wave=1+.022*Math.sin(a*3+phase)+.014*Math.cos(a*5-2*phase)+.007*Math.sin(a*2+3*phase);
      const x=Math.cos(a)*r*wave,y=Math.sin(a)*r*wave;
      i?ctx.lineTo(x,y):ctx.moveTo(x,y);
    }
    ctx.closePath();
  }
  function drawCanvas(c,t){
    const ctx=c.getContext('2d',{alpha:true});if(!ctx)return;
    const phase=((t%MOTION_PERIOD_MS)/MOTION_PERIOD_MS)*Math.PI*2;
    ctx.clearRect(0,0,220,220);ctx.save();ctx.translate(110,110);
    const r=76+1.1*Math.sin(phase)+state.power*5;
    const halo=ctx.createRadialGradient(0,0,13,0,0,107);
    halo.addColorStop(0,'rgba(208,236,255,.23)');
    halo.addColorStop(.75,'rgba(92,155,229,.08)');
    halo.addColorStop(1,'rgba(92,155,229,0)');
    ctx.fillStyle=halo;ctx.beginPath();ctx.arc(0,0,107,0,Math.PI*2);ctx.fill();
    blobPath(ctx,phase,r);ctx.save();ctx.clip();
    const base=ctx.createLinearGradient(-72,-70,72,83);
    base.addColorStop(0,'#f4feff');base.addColorStop(.28,'#b9eaff');base.addColorStop(.58,'#69aef3');base.addColorStop(.82,'#4b7cda');base.addColorStop(1,'#3357b0');
    ctx.fillStyle=base;ctx.fillRect(-110,-110,220,220);
    ctx.globalCompositeOperation='screen';
    const highlights=[
      {x:-30+12*Math.cos(phase),y:-28+9*Math.sin(phase),r:77,center:'rgba(255,255,255,.82)'},
      {x:31+8*Math.sin(phase),y:25+11*Math.cos(phase),r:62,center:'rgba(152,216,255,.40)'},
      {x:-14+9*Math.cos(phase*2),y:42+5*Math.sin(phase*2),r:44,center:'rgba(236,208,255,.25)'}
    ];
    for(const light of highlights){
      const gr=ctx.createRadialGradient(light.x,light.y,1,light.x,light.y,light.r);
      gr.addColorStop(0,light.center);gr.addColorStop(1,'rgba(255,255,255,0)');
      ctx.fillStyle=gr;ctx.beginPath();ctx.arc(light.x,light.y,light.r,0,Math.PI*2);ctx.fill();
    }
    ctx.globalCompositeOperation='source-over';
    ctx.lineCap='round';ctx.strokeStyle='rgba(250,255,255,.52)';ctx.lineWidth=2;
    ctx.beginPath();ctx.ellipse(-9,-5,56,65,-.28+.06*Math.sin(phase),.27*Math.PI,1.35*Math.PI);ctx.stroke();
    ctx.restore();ctx.lineWidth=1;ctx.strokeStyle='rgba(238,249,255,.62)';blobPath(ctx,phase,r);ctx.stroke();ctx.restore();
  }
  function loop(t){
    if(t-lastPaint>=33){lastPaint=t;const frames=document.querySelectorAll('[data-liquid-canvas]');
      if(frames.length){const time=reduced()?0:t;frames.forEach(c=>drawCanvas(c,time))}}
    requestAnimationFrame(loop);
  }
  render();checkAiStatus();requestAnimationFrame(loop);
  if('serviceWorker'in navigator&&location.protocol==='https:'){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}))}
})();
