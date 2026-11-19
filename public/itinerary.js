/**
 * 文旅行程卡片 · 第 3 步：出行偏好 + 导出长图 + 错误态
 *
 * 在 1、2 步（静态卡片 → 接知识库 + 依据抽屉）之上补三件事：
 *   1. 出行偏好：同行人 / 节奏 / 天数，存 localStorage，按偏好从 12 条线路里选一条，
 *      并说明「为什么选它」；没有完全匹配就给最接近的一条 + 2 个替代线路；
 *   2. 导出长图：纯 canvas 绘制 1080px 宽的 PNG，不引入第三方库；
 *   3. 错误态：知识库缺失回退示例、弱匹配提示、节点缺数据、Canvas/存储不可用都有明确出口。
 *
 * 仍然不写票价、开放时间、预约名额；数据里没有的就说「以官方公告为准」。
 * 白名单与 src/wenlv/schema.mjs 的 OFFICIAL_DOMAINS 保持一致，由 tests/itinerary.test.mjs 比对。
 */
(function (global) {
  'use strict';

  /** 默认演示线路：偏好同分时优先它，保证演示开场稳定。 */
  var ROUTE_ID = 'jilin-wusong-2d';
  var PREFS_KEY = 'jzzx-iti-prefs';
  var EXPORT_WIDTH = 1080;

  /** 与 src/wenlv/schema.mjs 的 OFFICIAL_DOMAINS 同步（测试会比对两份清单）。 */
  var OFFICIAL_DOMAINS = [
    'jl.gov.cn', 'changchun.gov.cn', 'jlcity.gov.cn', 'yanji.gov.cn',
    'changbaishan.gov.cn', 'wmhg.com.cn', 'ijingyuetan.com', 'jindingdafo.com',
    'gaogouli-tour.com', 'cgh.org.cn'
  ];

  var SEASON_LABEL = { spring: '春季', summer: '夏季', autumn: '秋季', winter: '冬季' };
  var SLOT_STAY = { 上午: '半天', 午后: '半天', 傍晚: '2 小时' };

  var PARTIES = [
    { key: 'family', label: '带娃出行', themes: ['亲子', '自然', '冬捕', '民俗', '美食'] },
    { key: 'senior', label: '银发结伴', themes: ['冰雪', '人文', '民俗', '湖光', '城市'] },
    { key: 'couple', label: '情侣同行', themes: ['摄影', '冰雪', '湖光', '美食'] },
    { key: 'friends', label: '朋友结伴', themes: ['冰雪', '徒步', '美食', '摄影'] },
    { key: 'group', label: '研学团体', themes: ['红色', '世界遗产', '历史', '地理', '观鸟'] }
  ];
  var PACES = [
    { key: 'easy', label: '轻松', hint: '一天一个主点' },
    { key: 'standard', label: '标准', hint: '上午下午各一个' },
    { key: 'tight', label: '紧凑', hint: '尽量多看几个' }
  ];
  var DEFAULT_PREFS = { party: 'senior', pace: 'easy', days: 2 };

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
  var lastFocused = null;
  var speakingDay = null;
  var overrideRoute = null;
  var pendingPrefs = null;
  var storageWarned = false;
  var prefs = loadPrefs();

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function partyLabel(key) {
    var hit = PARTIES.filter(function (p) { return p.key === key; })[0];
    return hit ? hit.label : '银发结伴';
  }

  function paceLabel(key) {
    var hit = PACES.filter(function (p) { return p.key === key; })[0];
    return hit ? hit.label : '轻松';
  }

  function sanitizePrefs(raw) {
    var p = { party: DEFAULT_PREFS.party, pace: DEFAULT_PREFS.pace, days: DEFAULT_PREFS.days };
    if (!raw || typeof raw !== 'object') return p;
    if (PARTIES.some(function (x) { return x.key === raw.party; })) p.party = raw.party;
    if (PACES.some(function (x) { return x.key === raw.pace; })) p.pace = raw.pace;
    if (raw.days === 1 || raw.days === 2 || raw.days === 3) p.days = raw.days;
    return p;
  }

  /** 偏好读取失败（无痕模式 / file://）时退回默认值，不让卡片打不开。 */
  function loadPrefs() {
    try {
      var raw = global.localStorage && global.localStorage.getItem(PREFS_KEY);
      if (!raw) return sanitizePrefs(null);
      return sanitizePrefs(JSON.parse(raw));
    } catch (e) {
      storageWarned = true;
      return sanitizePrefs(null);
    }
  }

  function savePrefs(next) {
    try {
      if (!global.localStorage) throw new Error('no storage');
      global.localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      return true;
    } catch (e) {
      storageWarned = true;
      return false;
    }
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

  /** 偏好打分：主题重合为主，节奏适配为辅。 */
  function scoreRoute(route, pref) {
    var party = PARTIES.filter(function (p) { return p.key === pref.party; })[0];
    var themes = party ? party.themes : [];
    // 越靠前的偏好主题权重越高：2 / 1.5 / 1 / 0.5 / 0.5
    var overlap = 0;
    (route.themes || []).forEach(function (t) {
      var i = themes.indexOf(t);
      if (i >= 0) overlap += Math.max(0.5, 2 - i * 0.5);
    });
    var perDay = route.nodes.length / route.days;
    var paceFit;
    if (pref.pace === 'easy') paceFit = perDay <= 1.5 ? 2 : perDay <= 2 ? 1 : 0;
    else if (pref.pace === 'tight') paceFit = perDay >= 2 ? 2 : perDay >= 1.5 ? 1 : 0;
    else paceFit = perDay <= 2 ? 1 : 0;
    return Math.round((overlap + paceFit) * 100) / 100;
  }

  /**
   * 选线路：先找天数完全匹配的，没有再放宽到 ±1 天；
   * 同分时优先默认演示线路，保证演示稳定。
   */
  function selectRoute(d, pref) {
    var exact = d.routes.filter(function (r) { return r.days === pref.days; });
    var approx = false;
    var list = exact;
    if (!list.length) {
      list = d.routes.filter(function (r) { return Math.abs(r.days - pref.days) <= 1; });
      approx = list.length > 0;
    }
    if (!list.length) return { route: null, score: 0, weak: true, approx: false, alternatives: [] };
    var scored = list.map(function (r) { return { route: r, score: scoreRoute(r, pref) }; });
    scored.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      var aDefault = a.route.id === ROUTE_ID ? 1 : 0;
      var bDefault = b.route.id === ROUTE_ID ? 1 : 0;
      if (bDefault !== aDefault) return bDefault - aDefault;
      return a.route.id < b.route.id ? -1 : 1;
    });
    var best = scored[0];
    // 替代线路：全库按偏好重排，同片区靠后，避免给出同质选项
    var alternatives = d.routes
      .filter(function (r) { return r.id !== best.route.id; })
      .map(function (r) { return { route: r, score: scoreRoute(r, pref) }; })
      .sort(function (a, b) {
        var aSame = a.route.cluster === best.route.cluster ? 1 : 0;
        var bSame = b.route.cluster === best.route.cluster ? 1 : 0;
        if (aSame !== bSame) return aSame - bSame;
        if (b.score !== a.score) return b.score - a.score;
        return a.route.id < b.route.id ? -1 : 1;
      })
      .map(function (x) { return x.route; });
    return {
      route: best.route,
      score: best.score,
      weak: best.score < 2,
      approx: approx,
      alternatives: alternatives.slice(0, 2)
    };
  }

  /** 由知识库线路生成卡片视图模型；节点缺景点数据时标 partial，不编名字。 */
  function fromLibrary(d, selection, pref) {
    var route = selection.route;
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
    nodes.forEach(function (n) { if (!dayTitles[n.day]) dayTitles[n.day] = '第 ' + n.day + ' 天'; });
    var summary = Object.keys(dayTitles).map(function (day) {
      var names = nodes.filter(function (n) { return String(n.day) === day; }).map(function (n) { return n.name; });
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
      pref: pref,
      weak: selection.weak,
      approx: selection.approx,
      alternatives: selection.alternatives || [],
      checklist: [
        { label: '预约', detail: nodes.filter(function (n) { return n.booking; }).length + ' 处景点附有预约资料，其余请查询景区官方公告。' },
        { label: '证件', detail: '身份证随身；有优惠证件按官方要求携带。' },
        { label: '衣物', detail: (route.season || []).indexOf('winter') >= 0 ? '冬季江边风大，准备防风外套、帽子与防滑鞋。' : '山区早晚温差大，带一件外套。' },
        { label: '天气', detail: route.caveat || '出发前查景区官方公告与当天天气。' }
      ]
    };
  }

  /** 当前视图模型：知识库优先，其次内置示例。 */
  function model() {
    var d = library();
    if (!d) return { mode: 'fallback', itinerary: SAMPLE };
    var route = overrideRoute ? d.routes.filter(function (r) { return r.id === overrideRoute; })[0] : null;
    var selection = route
      ? { route: route, score: 99, weak: false, approx: false, alternatives: [] }
      : selectRoute(d, prefs);
    if (!selection.route) {
      return { mode: 'empty', itinerary: SAMPLE, prefs: prefs };
    }
    return { mode: 'data', itinerary: fromLibrary(d, selection, prefs), prefs: prefs };
  }

  /* ── 渲染 ──────────────────────────────────────────────── */

  function metaChips(it) {
    var chips = [it.days + ' 天', it.nodes.length + ' 个节点'].concat(it.areas || []);
    if (it.clusterLabel) chips.push(it.clusterLabel);
    (it.season || []).forEach(function (s) { chips.push(SEASON_LABEL[s] || s); });
    return chips.map(function (text) { return '<span class="iti-chip">' + esc(text) + '</span>'; }).join('');
  }

  function prefSummary() {
    return partyLabel(prefs.party) + ' · ' + paceLabel(prefs.pace) + ' · ' + prefs.days + ' 天';
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
      var partial = n.partial ? '<span class="iti-partial">此处信息尚无法核实，请以景区公告为准</span>' : '';
      return '<li class="iti-node">' +
        '<span class="iti-slot">' + esc(n.slot) + '</span>' +
        '<div class="iti-node-main">' +
        '<div class="iti-node-head"><strong>' + esc(n.name) + '</strong>' + level + sourceButton(n) + '</div>' +
        (facts ? '<p class="iti-facts">' + facts + '</p>' : '') +
        '<p class="iti-why">' + esc(n.why) + '</p>' +
        '<p class="iti-stay">停留建议 ' + esc(n.stay) + '</p>' + partial +
        '</div></li>';
    }).join('');
    return '<section class="iti-day" aria-labelledby="' + id + '">' +
      '<h3 class="iti-day-head" id="' + id + '"><span class="iti-day-num" >第 ' + day + ' 天</span>' +
      '<span class="iti-day-title">' + esc(title) + '</span>' +
      '<button type="button" class="iti-read-btn" data-iti-action="speak" data-iti-day="' + day +
      '" aria-label="朗读第 ' + day + ' 天行程" aria-pressed="false">朗读</button></h3>' +
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

  function prefChipGroup(title, options, current, key, labelOf) {
    var chips = options.map(function (opt) {
      var value = opt && typeof opt === 'object' ? opt.key : opt;
      var label = labelOf ? labelOf(opt, value) : (opt && opt.label) || value;
      var on = String(value) === String(current) ? ' on' : '';
      return '<button type="button" class="iti-pref-chip' + on + '" data-iti-action="pref-select" data-iti-key="' + esc(key) +
        '" data-iti-value="' + esc(value) + '" aria-pressed="' + (on ? 'true' : 'false') + '">' + esc(label) + '</button>';
    }).join('');
    return '<div class="iti-pref-group"><span class="iti-pref-label">' + esc(title) + '</span><div class="iti-pref-chips">' + chips + '</div></div>';
  }

  function prefPanelMarkup() {
    var p = pendingPrefs || prefs;
    return prefChipGroup('同行人', PARTIES, p.party, 'party', function (o) { return o.label; }) +
      prefChipGroup('节奏', PACES, p.pace, 'pace', function (o) { return o.label; }) +
      prefChipGroup('天数', [1, 2, 3], p.days, 'days', function (o, v) { return v + ' 天'; }) +
      '<p class="iti-pref-note">' + (storageWarned
        ? '本机存储不可用，偏好只在本次会话内有效。'
        : '偏好只保存在本机（localStorage），不会上传。') + '</p>' +
      '<div class="iti-pref-actions"><button type="button" class="primary" data-iti-action="prefs-apply">按偏好重排</button>' +
      '<button type="button" class="secondary" data-iti-action="prefs-cancel">取消</button></div>';
  }

  function weakBanner(it) {
    if (!it.weak && !it.approx) return '';
    var alts = (it.alternatives || []).map(function (r) {
      return '<button type="button" class="iti-alt" data-iti-action="use-route" data-iti-route="' + esc(r.id) + '">' +
        esc(r.name) + ' · ' + r.days + ' 天</button>';
    }).join('');
    return '<div class="iti-notice" role="status"><strong>' +
      (it.approx ? '没有刚好 ' + prefs.days + ' 天的线路，先给你最接近的一条。' : '没有完全匹配「' + esc(partyLabel(prefs.party)) + ' · ' + prefs.days + ' 天」的线路，已选最接近的一条。') +
      '</strong>' + (alts ? '<p>也可以看看：</p><div class="iti-alts">' + alts + '</div>' : '') + '</div>';
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
    var banner;
    if (m.mode === 'fallback') {
      banner = '<p class="iti-source-line fallback">景点资料暂不可用。以下为参考路线，请在出发前查询官方信息。</p>';
    } else if (m.mode === 'empty') {
      banner = '<div class="iti-notice error" role="alert"><strong>暂时找不到符合条件的路线。</strong><p>您可以修改偏好，或查看以下参考路线。</p></div>';
    } else {
      banner = '<p class="iti-source-line">景点资料（' + esc(it.nodes.length) + ' 个节点 · 核对于 ' +
        esc(it.nodes.map(function (n) { return n.verifiedAt || ''; }).filter(Boolean).sort().pop() || '—') + '）</p>' + weakBanner(it);
    }
    return '<div class="sheet-header iti-head"><strong>' + esc(it.title) + '</strong>' + (close || '') + '</div>' +
      '<p class="sheet-desc">' + esc((it.areas || []).join(' · ')) + ' · ' + esc((it.themes || []).join(' / ')) + '</p>' +
      '<div class="iti-meta">' + metaChips(it) + '</div>' +
      '<div class="iti-prefbar"><button type="button" class="iti-pref-btn" data-iti-action="prefs" aria-expanded="false">出行偏好 · ' +
      esc(prefSummary()) + '</button><span class="iti-pref-hint">按偏好从 12 条线路里选</span></div>' +
      '<div class="iti-prefs" id="iti-prefs" hidden></div>' +
      '<p class="iti-summary">' + esc(it.summary) + '</p>' +
      banner +
      '<div class="iti-days">' + days.join('') + '</div>' +
      checklistBlock(it) +
      drawerShell() +
      '<div class="iti-actions"><button type="button" class="primary" data-iti-action="export">导出行程长图</button>' +
      '<button type="button" class="secondary" data-action="modal-close">关闭行程</button></div>' +
      '<p class="iti-speech-hint" id="iti-speech-hint" aria-live="polite"></p>' +
      '<p class="iti-sr" id="iti-live" role="status" aria-live="polite"></p>' +
      '<p class="iti-hint" id="iti-export-hint" aria-live="polite"></p>' +
      '<p class="sheet-legal">节点顺序与建议停留来自知识库编排，停留时长是行程建议、不是景区开放时长；票价、开放时间与预约名额以官方公告为准。</p>';
  }

  /* ── 交互 ──────────────────────────────────────────────── */

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

  function drawerMarkup(index) {
    var it = model().itinerary;
    var node = it.nodes[index];
    if (!node) return '';
    return sourceMarkup(node, it);
  }

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

  /** 重画 sheet 内容：保留 app.js 生成的关闭按钮，不重开弹层。 */
  function refresh() {
    var sheetEl = document.querySelector('.sheet.itinerary-sheet');
    if (!sheetEl) return false;
    var closeEl = sheetEl.querySelector('.sheet-header .close-round');
    var closeMarkup = closeEl ? closeEl.outerHTML : '';
    var scrollTop = sheetEl.scrollTop;
    var host = document.createElement('div');
    host.innerHTML = '<div class="drag-handle"></div>' + sheet(closeMarkup);
    sheetEl.replaceChildren.apply(sheetEl, Array.prototype.slice.call(host.childNodes));
    sheetEl.scrollTop = scrollTop;
    var btn = sheetEl.querySelector('[data-iti-action="prefs"]');
    if (btn && btn.focus) btn.focus();
    return true;
  }

  function openPrefs() {
    var panel = document.getElementById('iti-prefs');
    var btn = document.querySelector('[data-iti-action="prefs"]');
    if (!panel) return false;
    pendingPrefs = { party: prefs.party, pace: prefs.pace, days: prefs.days };
    panel.innerHTML = prefPanelMarkup();
    panel.removeAttribute('hidden');
    if (btn) btn.setAttribute('aria-expanded', 'true');
    var first = panel.querySelector('.iti-pref-chip');
    if (first && first.focus) first.focus();
    return true;
  }

  function closePrefs() {
    var panel = document.getElementById('iti-prefs');
    var btn = document.querySelector('[data-iti-action="prefs"]');
    if (panel) { panel.setAttribute('hidden', ''); panel.innerHTML = ''; }
    if (btn) btn.setAttribute('aria-expanded', 'false');
    pendingPrefs = null;
    return true;
  }

  function applyPrefs() {
    if (!pendingPrefs) return false;
    var next = sanitizePrefs(pendingPrefs);
    var stored = savePrefs(next);
    prefs = next;
    overrideRoute = null;
    pendingPrefs = null;
    refresh();
    announce('已按偏好重排：' + partyLabel(prefs.party) + ' · ' + paceLabel(prefs.pace) + ' · ' + prefs.days + ' 天，当前为 ' + model().itinerary.title);
    var hint = document.getElementById('iti-export-hint');
    if (hint) hint.textContent = stored ? '' : '本机存储不可用，偏好只在本次会话内有效。';
    return true;
  }

  function selectPref(key, value) {
    if (!pendingPrefs) return false;
    if (key === 'days') pendingPrefs.days = Number(value);
    else if (key === 'party') pendingPrefs.party = value;
    else if (key === 'pace') pendingPrefs.pace = value;
    var panel = document.getElementById('iti-prefs');
    if (panel) panel.innerHTML = prefPanelMarkup();
    return true;
  }

  /* ── 语音导览与无障碍 ─────────────────────────────────── */

  function announce(text) {
    if (typeof document === 'undefined') return;
    var live = document.getElementById('iti-live');
    if (live) live.textContent = text;
  }

  /** 朗读文稿：只复述卡片上已有的内容，不额外发明事实。 */
  function speechText(it, day) {
    var list = day ? it.nodes.filter(function (n) { return n.day === Number(day); }) : it.nodes;
    var parts = [it.title + '。'];
    if (day) parts.push('第 ' + day + ' 天。');
    list.forEach(function (n) {
      parts.push(n.slot + '，' + n.name + '。' + n.why + '。');
    });
    parts.push('票价、开放时间与预约方式以官方公告为准。');
    return parts.join('');
  }

  function speechSupported() {
    return !!global.JZZXNativeSpeech || (typeof global.speechSynthesis !== 'undefined' && typeof global.SpeechSynthesisUtterance !== 'undefined');
  }

  function setReadState(day) {
    if (typeof document === 'undefined') return;
    var buttons = document.querySelectorAll('[data-iti-action="speak"]');
    Array.prototype.forEach.call(buttons, function (btn) {
      var on = day && Number(btn.getAttribute('data-iti-day')) === day;
      btn.textContent = on ? '停止' : '朗读';
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  /**
   * 朗读某一天的行程（day 为空时读全篇）。
   * 不支持语音时返回 {ok:false}，界面给文字出口，不假装支持。
   */
  function speak(day, trigger) {
    var hint = typeof document === 'undefined' ? null : document.getElementById('iti-speech-hint');
    var d = Number(day) || 0;
    if (!speechSupported()) {
      if (hint) hint.textContent = '当前浏览器不支持语音朗读，可以打开系统读屏，或直接看文字。';
      announce('当前浏览器不支持语音朗读');
      return { ok: false, reason: 'unsupported' };
    }
    stopSpeak();
    var it = model().itinerary;
    var text = speechText(it, d);
    if(global.JZZXNativeSpeech){
      try{
        if(!global.JZZXNativeSpeech.speak(text))throw new Error('系统语音不可用');
        speakingDay=d;setReadState(d);if(hint)hint.textContent='正在朗读，点同一按钮可停止。';
        var count=0;var poll=setInterval(function(){count++;if(speakingDay!==d||count>600||!global.JZZXNativeSpeech.isSpeaking()){clearInterval(poll);if(speakingDay===d){speakingDay=null;setReadState(null);}}},500);
        return {ok:true,day:d,length:text.length,text:text};
      }catch(e){if(hint)hint.textContent='系统中文语音不可用，请检查手机语音设置。';return {ok:false,reason:'native-speech-unavailable'};}
    }
    try {
      var utter = new global.SpeechSynthesisUtterance(text);
      utter.lang = 'zh-CN';
      utter.rate = 1;
      utter.pitch = 1;
      utter.onend = function () { speakingDay = null; setReadState(null); if (hint) hint.textContent = '朗读结束。'; announce('朗读结束'); };
      utter.onerror = function () { speakingDay = null; setReadState(null); if (hint) hint.textContent = '朗读被打断，可以再点一次。'; };
      global.speechSynthesis.speak(utter);
    } catch (e) {
      if (hint) hint.textContent = '朗读启动失败，可以再试一次或直接看文字。';
      return { ok: false, reason: 'speak-failed' };
    }
    speakingDay = d;
    setReadState(d);
    if (hint) hint.textContent = '正在朗读第 ' + (d || 1) + ' 天，点同一按钮可停止。';
    announce('开始朗读第 ' + (d || 1) + ' 天行程，共 ' + text.length + ' 字');
    return { ok: true, day: d, length: text.length, text: text };
  }

  function stopSpeak() {
    var had = speakingDay !== null;
    if(global.JZZXNativeSpeech){try{global.JZZXNativeSpeech.stop();}catch(e){}}
    else if (speechSupported()) {
      try { global.speechSynthesis.cancel(); } catch (e) { /* 忽略：有的浏览器未实现 */ }
    }
    speakingDay = null;
    setReadState(null);
    return had;
  }

  function focusables(root) {
    var nodes = root.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])');
    return Array.prototype.filter.call(nodes, function (el) {
      return !el.disabled && el.offsetParent !== null;
    });
  }

  /** Tab 循环：弹层里 Tab 到底回到第一个，Shift+Tab 从头回到最后一个。 */
  function trapTab(event, root) {
    if (event.key !== 'Tab') return;
    var list = focusables(root);
    if (!list.length) return;
    var first = list[0];
    var last = list[list.length - 1];
    var active = document.activeElement;
    if (event.shiftKey && (active === first || !root.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !root.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  }

  /** 行程卡片挂载时：接管焦点、播报一次、绑定 Tab 循环。 */
  function attachSheet() {
    var sheetEl = document.querySelector('.sheet.itinerary-sheet');
    if (!sheetEl || sheetEl.dataset.itiA11y === '1') return false;
    sheetEl.dataset.itiA11y = '1';
    if (!lastFocused) lastFocused = document.activeElement;
    sheetEl.setAttribute('tabindex', '-1');
    sheetEl.addEventListener('keydown', function (event) { trapTab(event, sheetEl); });
    try { sheetEl.focus({ preventScroll: true }); } catch (e) { sheetEl.focus(); }
    var it = model().itinerary;
    announce('已打开行程：' + it.title + '，共 ' + it.days + ' 天 ' + it.nodes.length + ' 个节点');
    return true;
  }

  /** 监听弹层出现 / 关闭：出现时接管焦点，关闭时停止朗读并把焦点还给入口。 */
  function watchModal() {
    if (typeof MutationObserver === 'undefined' || typeof document === 'undefined') return;
    var root = document.getElementById('modalRoot');
    if (!root) return;
    var observer = new MutationObserver(function () {
      var sheetEl = document.querySelector('.sheet.itinerary-sheet');
      if (sheetEl) { attachSheet(); return; }
      if (speakingDay !== null) stopSpeak();
      if (lastFocused && lastFocused.focus) {
        try { lastFocused.focus(); } catch (e) { /* 入口可能已被移除 */ }
      }
      lastFocused = null;
    });
    observer.observe(root, { childList: true, subtree: true });
  }

  /* ── 导出长图 ──────────────────────────────────────────── */

  var lastExport = null;

  function fontSpec(ctx, size, weight) {
    ctx.font = weight + ' ' + size + 'px "PingFang SC","Noto Sans CJK SC","Microsoft YaHei",sans-serif';
  }

  function wrapText(ctx, text, maxWidth) {
    var chars = String(text || '').split('');
    var lines = [];
    var line = '';
    for (var i = 0; i < chars.length; i++) {
      var next = line + chars[i];
      if (ctx.measureText(next).width > maxWidth && line) {
        lines.push(line);
        line = chars[i];
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  }

  function exportBlocks(it) {
    var blocks = [];
    blocks.push({ size: 50, weight: '700', color: '#152034', lh: 72, text: it.title });
    blocks.push({ size: 24, weight: '400', color: '#607087', lh: 38, text: (it.areas || []).join(' · ') + ' · ' + (it.themes || []).join(' / ') });
    blocks.push({ size: 22, weight: '400', color: '#7b8da6', lh: 36, text: '出行偏好：' + partyLabel(prefs.party) + ' · ' + paceLabel(prefs.pace) + ' · ' + prefs.days + ' 天' });
    blocks.push({ size: 24, weight: '400', color: '#42536a', lh: 40, text: it.summary });
    blocks.push({ gap: 18 });
    for (var d = 1; d <= it.days; d++) {
      var nodes = it.nodes.filter(function (n) { return n.day === d; });
      if (!nodes.length) continue;
      blocks.push({ size: 30, weight: '700', color: '#1f3453', lh: 54, text: '第 ' + d + ' 天' + '　' + (it.dayTitles[d] || '') });
      nodes.forEach(function (n) {
        blocks.push({ size: 26, weight: '700', color: '#213852', lh: 44, text: n.slot + '　' + n.name + '（停留建议 ' + n.stay + '）' });
        blocks.push({ size: 23, weight: '400', color: '#4a5f79', lh: 38, text: n.why });
        var src = n.sources.length ? n.sources.map(function (s) { return s.label; }).join('、') : '暂无官方来源';
        blocks.push({ size: 21, weight: '400', color: '#8090a8', lh: 34, text: '依据：' + src + (n.verifiedAt ? '（核对于 ' + n.verifiedAt + '）' : '') });
      });
      blocks.push({ gap: 14 });
    }
    blocks.push({ size: 28, weight: '700', color: '#1f3453', lh: 48, text: '行前清单' });
    it.checklist.forEach(function (c) {
      blocks.push({ size: 22, weight: '400', color: '#4a5f79', lh: 36, text: '· ' + c.label + '：' + c.detail });
    });
    blocks.push({ gap: 20 });
    blocks.push({ size: 20, weight: '400', color: '#93a3b8', lh: 34, text: '由吉政知行生成 · 数据核对于 ' + (it.nodes.map(function (n) { return n.verifiedAt || ''; }).filter(Boolean).sort().pop() || '—') + ' · 停留时长为行程建议；票价、开放时间与预约名额以官方公告为准。' });
    return blocks;
  }

  /** 计算行位置（第一遍测量），再由 drawExport 画出。 */
  function layoutExport(ctx, it) {
    var pad = 72;
    var inner = EXPORT_WIDTH - pad * 2;
    var y = pad;
    var rows = [];
    exportBlocks(it).forEach(function (block) {
      if (block.gap) { y += block.gap; return; }
      fontSpec(ctx, block.size, block.weight);
      wrapText(ctx, block.text, inner).forEach(function (line) {
        rows.push({ text: line, size: block.size, weight: block.weight, color: block.color, y: y });
        y += block.lh;
      });
    });
    return { rows: rows, height: Math.ceil(y + pad) };
  }

  function drawExport(ctx, layout) {
    layout.rows.forEach(function (row) {
      fontSpec(ctx, row.size, row.weight);
      ctx.fillStyle = row.color;
      ctx.fillText(row.text, 72, row.y + row.size);
    });
  }

  /**
   * 导出 1080px 宽 PNG。返回 {ok,width,height} 或 {ok:false,reason}，
   * 失败时不抛异常——界面用文字告诉用户下一步怎么办。
   */
  function exportPng() {
    var hint = document.getElementById('iti-export-hint');
    function fail(reason) {
      lastExport = { ok: false, reason: reason };
      if (hint) hint.textContent = '导出失败：' + reason + '。可以改用系统截图，或换用 Chrome 再试。';
      return lastExport;
    }
    try {
      if (typeof document === 'undefined' || !document.createElement) throw new Error('当前环境不支持画布');
      var canvas = document.createElement('canvas');
      if (!canvas.getContext) throw new Error('当前浏览器不支持画布');
      canvas.width = EXPORT_WIDTH;
      canvas.height = 10;
      var probe = canvas.getContext('2d');
      if (!probe) throw new Error('无法创建画布上下文');
      var layout = layoutExport(probe, model().itinerary);
      canvas.height = layout.height;
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      drawExport(ctx, layout);
      if (typeof canvas.toBlob !== 'function') throw new Error('当前浏览器不支持图片导出');
      var name = model().itinerary.title.replace(/[\\/:*?"<>|]/g, '') + '.png';
      canvas.toBlob(function (blob) {
        if (!blob) { fail('生成图片为空'); return; }
        if(global.JZZXNativeFiles && typeof FileReader!=='undefined'){
          var reader=new FileReader();reader.onerror=function(){fail('图片读取失败');};
          reader.onload=function(){try{global.JZZXNativeFiles.save('image/png',name,String(reader.result).split(',')[1]);if(hint)hint.textContent='请在系统保存窗口选择位置。';}catch(e){fail('系统保存不可用');}};
          reader.readAsDataURL(blob);return;
        }
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 2000);if(hint)hint.textContent='已发起长图下载。';
      }, 'image/png');
      lastExport = { ok: true, width: EXPORT_WIDTH, height: layout.height, name: name };
      if (hint) hint.textContent = '正在准备行程长图。';
      return lastExport;
    } catch (e) {
      return fail(e && e.message ? e.message : '未知错误');
    }
  }

  /** app.js 把卡片内的点击交给这里处理；返回 true 表示已消费。 */
  function handle(button) {
    if (!button) return false;
    var src = button.getAttribute && button.getAttribute('data-iti-source');
    if (src !== null && src !== undefined && src !== '') return openSource(Number(src), button);
    if (button.hasAttribute && button.hasAttribute('data-iti-close')) return closeSource();
    var url = button.getAttribute && button.getAttribute('data-iti-url');
    if (url) { openExternal(url); return true; }
    var action = button.getAttribute && button.getAttribute('data-iti-action');
    if (action === 'prefs') return openPrefs();
    if (action === 'prefs-cancel') return closePrefs();
    if (action === 'prefs-apply') return applyPrefs();
    if (action === 'pref-select') return selectPref(button.getAttribute('data-iti-key'), button.getAttribute('data-iti-value'));
    if (action === 'use-route') { overrideRoute = button.getAttribute('data-iti-route'); refresh(); return true; }
    if (action === 'export') { exportPng(); return true; }
    if (action === 'speak') {
      var day = Number(button.getAttribute('data-iti-day')) || 0;
      if (speakingDay === day) { stopSpeak(); announce('已停止朗读'); return true; }
      speak(day, button);
      return true;
    }
    if (action === 'stop-speak') { stopSpeak(); announce('已停止朗读'); return true; }
    return false;
  }

  // Esc 先关抽屉、再关偏好面板，都不关整张卡片。
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      if (closeSource()) { event.stopPropagation(); return; }
      var panel = document.getElementById('iti-prefs');
      if (panel && !panel.hasAttribute('hidden')) { closePrefs(); event.stopPropagation(); }
    }, true);
  }

  watchModal();

  global.JZZX_ITINERARY = {
    SAMPLE: SAMPLE,
    ROUTE_ID: ROUTE_ID,
    PREFS_KEY: PREFS_KEY,
    DEFAULT_PREFS: DEFAULT_PREFS,
    EXPORT_WIDTH: EXPORT_WIDTH,
    PARTIES: PARTIES,
    PACES: PACES,
    OFFICIAL_DOMAINS: OFFICIAL_DOMAINS,
    esc: esc,
    isOfficialUrl: isOfficialUrl,
    sanitizePrefs: sanitizePrefs,
    scoreRoute: scoreRoute,
    selectRoute: selectRoute,
    model: model,
    sheet: sheet,
    drawerMarkup: drawerMarkup,
    handle: handle,
    openSource: openSource,
    closeSource: closeSource,
    exportPng: exportPng,
    speechText: speechText,
    speak: speak,
    stopSpeak: stopSpeak,
    announce: announce,
    exportBlocks: exportBlocks,
    layoutExport: layoutExport
  };
})(typeof window !== 'undefined' ? window : globalThis);
