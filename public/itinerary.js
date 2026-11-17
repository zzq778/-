/**
 * 文旅行程卡片 · 第 2 步：接真数据 + 来源按钮 + 「依据」抽屉
 *
 * 数据来源：public/wenlv-data.js（window.WENLV，由 npm run build:data 生成）。
 * 这一步只做三件事：
 *   1. 用知识库里的真实线路/景点替换第 1 步写死的 SAMPLE（缺数据时回退 SAMPLE 并标注）；
 *   2. 每个节点旁边给一个「依据」按钮，点开抽屉看来源名、URL、核对日期、置信度与提示语；
 *   3. 只放行官方白名单域名，其余链接在抽屉里就被拦住，不进系统浏览器。
 *
 * 仍然不写票价、开放时间、预约名额：数据里是 null 就显示「以官方为准」。
 * 白名单与 src/wenlv/schema.mjs 的 OFFICIAL_DOMAINS 保持一致，由 tests/itinerary.test.mjs 比对。
 */
(function (global) {
  'use strict';

  /** 当前演示用的线路；不存在时退回知识库第一条。 */
  var ROUTE_ID = 'jilin-wusong-2d';

  /** 与 src/wenlv/schema.mjs 的 OFFICIAL_DOMAINS 同步（测试会比对两份清单）。 */
  var OFFICIAL_DOMAINS = [
    'jl.gov.cn', 'changchun.gov.cn', 'jlcity.gov.cn', 'yanji.gov.cn',
    'changbaishan.gov.cn', 'wmhg.com.cn', 'ijingyuetan.com', 'jindingdafo.com',
    'gaogouli-tour.com', 'cgh.org.cn'
  ];

  var SEASON_LABEL = { spring: '春季', summer: '夏季', autumn: '秋季', winter: '冬季' };
  var SLOT_STAY = { 上午: '半天', 午后: '半天', 傍晚: '2 小时' };

  /** 第 1 步的静态样本：知识库未加载时兜底，保证断网也能演示。 */
  var SAMPLE = {
    id: 'jilin-wusong-2d',
    title: '吉林雾凇两日：湖与雾的清晨',
    days: 2,
    areas: ['吉林市'],
    themes: ['冰雪', '摄影'],
    season: ['winter'],
    summary: '第一天先看湖、再看古镇，把转场时间留足；第二天赶日出后的雾凇，看完顺路上雪场。',
    dayTitles: { 1: '湖与满族古镇', 2: '雾凇的清晨' },
    nodes: [
      { day: 1, slot: '上午', name: '松花湖', stay: '2–3 小时', why: '先看湖面与雪场，下午留出转场时间', sources: [] },
      { day: 1, slot: '午后', name: '乌拉街满族镇', stay: '2 小时', why: '满族古镇室内外穿插，天冷可随时进馆', sources: [] },
      { day: 2, slot: '上午', name: '雾凇岛', stay: '半天', why: '雾凇要赶日出后的两小时，必须住附近', sources: [] },
      { day: 2, slot: '午后', name: '北大湖滑雪度假区', stay: '3 小时', why: '看完雾凇顺路上雪场，避免二次折返', sources: [] }
    ],
    checklist: [
      { label: '预约', detail: '是否需要预约、开放到几点，出发前一晚查景区官方公告。' },
      { label: '证件', detail: '身份证随身；有优惠证件按官方要求携带。' },
      { label: '衣物', detail: '江边风大，准备防风外套、帽子与防滑鞋。' },
      { label: '天气', detail: '雾凇看当夜气温与湿度，行程留一天弹性。' }
    ]
  };

  var lastTrigger = null;

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  /** 官方域名白名单：按后缀匹配，允许子域；只接受 http(s)。 */
  function isOfficialUrl(url) {
    var parsed;
    try { parsed = new URL(String(url)); } catch (e) { return false; }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    var host = parsed.hostname.toLowerCase();
    return OFFICIAL_DOMAINS.some(function (domain) {
      return host === domain || host.slice(-(domain.length + 1)) === '.' + domain;
    });
  }

  function library() {
    var d = global.WENLV;
    if (!d || !Array.isArray(d.routes) || !Array.isArray(d.attractions) || !d.routes.length) return null;
    return d;
  }

  function indexAttractions(d) {
    var map = {};
    d.attractions.forEach(function (a) { map[a.id] = a; });
    return map;
  }

  function pickRoute(d) {
    return d.routes.filter(function (r) { return r.id === ROUTE_ID; })[0] || d.routes[0];
  }

  /** 由知识库线路生成卡片视图模型；节点缺景点数据时标 partial，不编名字。 */
  function fromLibrary(d) {
    var route = pickRoute(d);
    var byId = indexAttractions(d);
    var nodes = route.nodes.map(function (n, i) {
      var a = byId[n.attractionId] || null;
      return {
        index: i,
        day: n.day,
        slot: n.slot,
        why: n.why,
        attractionId: n.attractionId,
        name: a ? a.name : n.attractionId,
        area: a ? a.area : '',
        kind: a ? a.kind : '',
        level: a ? a.level : null,
        stay: SLOT_STAY[n.slot] || '半天',
        booking: a ? a.booking : null,
        caveat: a ? a.caveat : '',
        confidence: a ? a.confidence : null,
        verifiedAt: a ? a.verifiedAt : null,
        sources: a && Array.isArray(a.sources) ? a.sources : [],
        partial: !a
      };
    });
    var dayTitles = {};
    nodes.forEach(function (n) {
      if (!dayTitles[n.day]) dayTitles[n.day] = '第 ' + n.day + ' 天';
    });
    var summary = [1, 2, 3].filter(function (day) { return dayTitles[day]; }).map(function (day) {
      var names = nodes.filter(function (n) { return n.day === day; }).map(function (n) { return n.name; });
      return '第 ' + day + ' 天：' + names.join(' → ');
    }).join('；') + '。';
    return {
      id: route.id,
      title: route.name,
      days: route.days,
      areas: route.areas,
      themes: route.themes,
      season: route.season,
      clusterLabel: (d.clusters || {})[route.cluster] || '',
      summary: summary,
      dayTitles: dayTitles,
      nodes: nodes,
      routeCaveat: route.caveat || '',
      bookings: nodes.filter(function (n) { return n.booking; }).length,
      checklist: [
        { label: '预约', detail: nodes.filter(function (n) { return n.booking; }).length + ' 个节点写有预约方式，其余以景区官方公告为准。' },
        { label: '证件', detail: '身份证随身；有优惠证件按官方要求携带。' },
        { label: '衣物', detail: route.season.indexOf('winter') >= 0 ? '冬季江边风大，准备防风外套、帽子与防滑鞋。' : '山区早晚温差大，带一件外套。' },
        { label: '天气', detail: route.caveat || '出发前查景区官方公告与当天天气。' }
      ]
    };
  }

  function model() {
    var d = library();
    if (!d) return { mode: 'fallback', itinerary: SAMPLE };
    return { mode: 'data', itinerary: fromLibrary(d) };
  }

  function metaChips(it) {
    var chips = [it.days + ' 天', it.nodes.length + ' 个节点'].concat(it.areas || []);
    if (it.clusterLabel) chips.push(it.clusterLabel);
    (it.season || []).forEach(function (s) { chips.push(SEASON_LABEL[s] || s); });
    return chips.map(function (text) { return '<span class="iti-chip">' + esc(text) + '</span>'; }).join('');
  }

  function sourceButton(node) {
    if (!node.sources.length) {
      return '<span class="iti-src-empty">该点暂无官方入口</span>';
    }
    return '<button type="button" class="iti-src-btn" data-iti-source="' + node.index + '" aria-haspopup="dialog">依据 ' +
      node.sources.length + '</button>';
  }

  function dayBlock(it, day) {
    var nodes = it.nodes.filter(function (n) { return n.day === day; });
    var title = it.dayTitles[day] || ('第 ' + day + ' 天');
    var id = 'iti-day-' + day;
    var items = nodes.map(function (n) {
      var level = n.level ? '<em class="iti-level">' + esc(n.level) + '</em>' : '';
      var facts = [n.kind, n.area].filter(Boolean).map(esc).join(' · ');
      return '<li class="iti-node">' +
        '<span class="iti-slot">' + esc(n.slot) + '</span>' +
        '<div class="iti-node-main">' +
        '<div class="iti-node-head"><strong>' + esc(n.name) + '</strong>' + level + sourceButton(n) + '</div>' +
        (facts ? '<p class="iti-facts">' + facts + '</p>' : '') +
        '<p class="iti-why">' + esc(n.why) + '</p>' +
        '<p class="iti-stay">停留建议 ' + esc(n.stay) + '</p>' +
        '</div></li>';
    }).join('');
    return '<section class="iti-day" aria-labelledby="' + id + '">' +
      '<h3 class="iti-day-head" id="' + id + '"><span class="iti-day-num">Day ' + day + '</span>' +
      '<span class="iti-day-title">' + esc(title) + '</span></h3>' +
      '<ol class="iti-nodes">' + items + '</ol></section>';
  }

  function checklistBlock(it) {
    var items = it.checklist.map(function (item) {
      return '<li><b>' + esc(item.label) + '</b><span>' + esc(item.detail) + '</span></li>';
    }).join('');
    return '<section class="iti-check" aria-labelledby="iti-check-title">' +
      '<h3 id="iti-check-title">行前清单</h3><ul>' + items + '</ul></section>';
  }

  function drawerShell() {
    return '<div class="iti-drawer" id="iti-drawer" hidden>' +
      '<button type="button" class="iti-drawer-scrim" data-iti-close aria-label="关闭依据"></button>' +
      '<section class="iti-drawer-panel" role="dialog" aria-modal="false" aria-labelledby="iti-drawer-title">' +
      '<div class="iti-drawer-bar"><strong id="iti-drawer-title">依据</strong>' +
      '<button type="button" class="iti-drawer-close" data-iti-close aria-label="关闭依据">×</button></div>' +
      '<div class="iti-drawer-body" id="iti-drawer-body"></div>' +
      '<p class="iti-drawer-hint" id="iti-drawer-hint" aria-live="polite"></p></section></div>';
  }

  /**
   * 返回 sheet 内容（不含 .sheet 外壳）。
   * @param {string} close 由 app.js 生成的关闭按钮 markup。
   */
  function sheet(close) {
    var m = model();
    var it = m.itinerary;
    var days = [];
    for (var d = 1; d <= it.days; d++) days.push(dayBlock(it, d));
    var banner = m.mode === 'data'
      ? '<p class="iti-source-line">数据来自文旅知识库（' + esc(it.nodes.length) + ' 个节点 · 核对于 ' + esc(it.nodes.map(function (n) { return n.verifiedAt || ''; }).filter(Boolean).sort().pop() || '—') + '）</p>'
      : '<p class="iti-source-line fallback">知识库未加载，当前显示内置示例；数据接入后每个节点会带「依据」。</p>';
    return '<div class="sheet-header iti-head"><strong>' + esc(it.title) + '</strong>' + (close || '') + '</div>' +
      '<p class="sheet-desc">' + esc((it.areas || []).join(' · ')) + ' · ' + esc((it.themes || []).join(' / ')) + '</p>' +
      '<div class="iti-meta">' + metaChips(it) + '</div>' +
      '<p class="iti-summary">' + esc(it.summary) + '</p>' +
      banner +
      '<div class="iti-days">' + days.join('') + '</div>' +
      checklistBlock(it) +
      drawerShell() +
      '<div class="iti-actions"><button type="button" class="secondary" data-action="modal-close">关闭行程</button></div>' +
      '<p class="sheet-legal">节点顺序与建议停留来自知识库编排，停留时长是行程建议、不是景区开放时长；票价、开放时间与预约名额以官方公告为准。</p>';
  }

  function sourceMarkup(node, it) {
    var list = node.sources.map(function (s) {
      var official = isOfficialUrl(s.url);
      return '<li class="iti-src-item">' +
        '<span class="iti-src-label">' + esc(s.label) + '</span>' +
        (official
          ? '<button type="button" class="iti-src-open" data-iti-url="' + esc(s.url) + '">打开官方页面 ↗</button>'
          : '<span class="iti-src-bad">域名不在白名单，已禁用</span>') +
        '<span class="iti-src-url">' + esc(s.url) + '</span></li>';
    }).join('');
    var metaBits = [];
    if (node.verifiedAt) metaBits.push('核对于 ' + node.verifiedAt);
    if (node.confidence) metaBits.push('置信度 ' + node.confidence);
    if (node.booking) metaBits.push('预约：' + node.booking);
    return '<p class="iti-drawer-sub">' + esc(node.name) + (node.area ? ' · ' + esc(node.area) : '') + '</p>' +
      '<p class="iti-drawer-meta">' + esc(metaBits.join(' · ') || '暂无核对信息') + '</p>' +
      '<ul class="iti-src-list">' + (list || '<li class="iti-src-bad">该点暂无官方来源</li>') + '</ul>' +
      (node.caveat ? '<p class="iti-drawer-caveat">提示：' + esc(node.caveat) + '</p>' : '') +
      (it.routeCaveat ? '<p class="iti-drawer-caveat">线路提示：' + esc(it.routeCaveat) + '</p>' : '');
  }

  /** 抽屉内容（纯字符串，便于测试与复用）。 */
  function drawerMarkup(index) {
    var it = model().itinerary;
    var node = it.nodes[index];
    if (!node) return '';
    return sourceMarkup(node, it);
  }

  /** 打开「依据」抽屉。index 是节点在 itinerary.nodes 里的序号。 */
  function openSource(index, trigger) {
    var drawer = document.getElementById('iti-drawer');
    var body = document.getElementById('iti-drawer-body');
    if (!drawer || !body) return false;
    var markup = drawerMarkup(index);
    if (!markup) return false;
    body.innerHTML = markup;
    drawer.removeAttribute('hidden');
    drawer.classList.add('open');
    lastTrigger = trigger || null;
    var closeBtn = drawer.querySelector('[data-iti-close]');
    if (closeBtn && closeBtn.focus) closeBtn.focus();
    return true;
  }

  function closeSource() {
    var drawer = document.getElementById('iti-drawer');
    if (!drawer || drawer.hasAttribute('hidden')) return false;
    drawer.setAttribute('hidden', '');
    drawer.classList.remove('open');
    if (lastTrigger && lastTrigger.focus) lastTrigger.focus();
    lastTrigger = null;
    return true;
  }

  /** 打开白名单内的官方页面；不在白名单就把提示写回抽屉，不弹窗。 */
  function openExternal(url) {
    var hint = document.getElementById('iti-drawer-hint');
    if (!isOfficialUrl(url)) {
      if (hint) hint.textContent = '该链接不属于官方白名单，已拦截：' + url;
      return false;
    }
    if (hint) hint.textContent = '';
    var a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    a.remove();
    return true;
  }

  /** app.js 把点击事件交给这里处理；返回 true 表示已消费。 */
  function handle(button) {
    if (!button) return false;
    var src = button.getAttribute && button.getAttribute('data-iti-source');
    if (src !== null && src !== undefined && src !== '') { return openSource(Number(src), button); }
    if (button.hasAttribute && button.hasAttribute('data-iti-close')) { return closeSource(); }
    var url = button.getAttribute && button.getAttribute('data-iti-url');
    if (url) { openExternal(url); return true; }
    return false;
  }

  // Esc 先关抽屉、不关整个行程卡片：捕获阶段拦下，避免 app.js 的 Esc 直接收掉弹层。
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      if (closeSource()) { event.stopPropagation(); }
    }, true);
  }

  global.JZZX_ITINERARY = {
    SAMPLE: SAMPLE,
    ROUTE_ID: ROUTE_ID,
    OFFICIAL_DOMAINS: OFFICIAL_DOMAINS,
    esc: esc,
    isOfficialUrl: isOfficialUrl,
    model: model,
    sheet: sheet,
    drawerMarkup: drawerMarkup,
    handle: handle,
    openSource: openSource,
    closeSource: closeSource
  };
})(typeof window !== 'undefined' ? window : globalThis);
