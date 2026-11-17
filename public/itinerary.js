/**
 * 文旅行程卡片 · 静态版（D2 / 第 1 步）
 *
 * 这一步只交付「一张看起来能讲清楚的行程卡片」：
 * 天数、片区、时间轴（上午/午后）、每个节点的建议停留与一句理由、行前清单。
 *
 * 刻意保持静态：
 * - 数据写在本文件的 SAMPLE 里，还没有读 window.WENLV，也没有接 /api/chat；
 * - 没有「依据」抽屉、没有导出、没有语音（分别在后面几步做）；
 * - 停留时长是「行程建议」，不是景区事实，页面底部明确标注；
 * - 不写票价、开放时间、预约名额——这些一律留给官方入口，避免写死过期。
 *
 * 只新增文件，不改 wenlv-ui.js / wenlv-data.js 的既有行为。
 */
(function (global) {
  'use strict';

  /** 与 src/wenlv/routes.mjs 的 jilin-wusong-2d 同构的静态样本。 */
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
      { day: 1, slot: '上午', name: '松花湖', stay: '2–3 小时', why: '先看湖面与雪场，下午留出转场时间' },
      { day: 1, slot: '午后', name: '乌拉街满族镇', stay: '2 小时', why: '满族古镇室内外穿插，天冷可随时进馆' },
      { day: 2, slot: '上午', name: '雾凇岛', stay: '半天', why: '雾凇要赶日出后的两小时，必须住附近' },
      { day: 2, slot: '午后', name: '北大湖滑雪度假区', stay: '3 小时', why: '看完雾凇顺路上雪场，避免二次折返' }
    ],
    checklist: [
      { label: '预约', detail: '是否需要预约、开放到几点，出发前一晚查景区官方公告。' },
      { label: '证件', detail: '身份证随身；有优惠证件按官方要求携带。' },
      { label: '衣物', detail: '江边风大，准备防风外套、帽子与防滑鞋。' },
      { label: '天气', detail: '雾凇看当夜气温与湿度，行程留一天弹性。' }
    ]
  };

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function metaChips(itinerary) {
    var chips = [itinerary.days + ' 天', itinerary.nodes.length + ' 个节点']
      .concat(itinerary.areas)
      .concat(itinerary.season.map(function (s) { return { winter: '冬季', spring: '春季', summer: '夏季', autumn: '秋季' }[s] || s; }));
    return chips.map(function (text) {
      return '<span class="iti-chip">' + esc(text) + '</span>';
    }).join('');
  }

  function dayBlock(itinerary, day) {
    var nodes = itinerary.nodes.filter(function (n) { return n.day === day; });
    var title = itinerary.dayTitles[day] || ('第 ' + day + ' 天');
    var id = 'iti-day-' + day;
    var items = nodes.map(function (n) {
      return '<li class="iti-node">' +
        '<span class="iti-slot">' + esc(n.slot) + '</span>' +
        '<div class="iti-node-main">' +
        '<strong>' + esc(n.name) + '</strong>' +
        '<p class="iti-why">' + esc(n.why) + '</p>' +
        '<p class="iti-stay">停留建议 ' + esc(n.stay) + '</p>' +
        '</div></li>';
    }).join('');
    return '<section class="iti-day" aria-labelledby="' + id + '">' +
      '<h3 class="iti-day-head" id="' + id + '"><span class="iti-day-num">Day ' + day + '</span>' +
      '<span class="iti-day-title">' + esc(title) + '</span></h3>' +
      '<ol class="iti-nodes">' + items + '</ol></section>';
  }

  function checklistBlock(itinerary) {
    var items = itinerary.checklist.map(function (item) {
      return '<li><b>' + esc(item.label) + '</b><span>' + esc(item.detail) + '</span></li>';
    }).join('');
    return '<section class="iti-check" aria-labelledby="iti-check-title">' +
      '<h3 id="iti-check-title">行前清单</h3><ul>' + items + '</ul></section>';
  }

  /**
   * 返回 sheet 内容（不含 .sheet 外壳）。
   * @param {string} close 由 app.js 生成的关闭按钮 markup，保持与其它弹层一致。
   */
  function sheet(close) {
    var it = SAMPLE;
    var days = [];
    for (var d = 1; d <= it.days; d++) days.push(dayBlock(it, d));
    return '<div class="sheet-header iti-head"><strong>' + esc(it.title) + '</strong>' + (close || '') + '</div>' +
      '<p class="sheet-desc">' + esc(it.areas.join(' · ')) + ' · ' + esc(it.themes.join(' / ')) + '</p>' +
      '<div class="iti-meta">' + metaChips(it) + '</div>' +
      '<p class="iti-summary">' + esc(it.summary) + '</p>' +
      '<div class="iti-days">' + days.join('') + '</div>' +
      checklistBlock(it) +
      '<div class="iti-actions"><button type="button" class="secondary" data-action="modal-close">关闭行程</button></div>' +
      '<p class="sheet-legal">静态示例：节点顺序与停留建议是演示文案，不是景区事实；开放时间、票价与预约方式以官方公告为准。下一步接入知识库后，每个节点会带「依据」来源。</p>';
  }

  global.JZZX_ITINERARY = { SAMPLE: SAMPLE, esc: esc, sheet: sheet };
})(typeof window !== 'undefined' ? window : globalThis);
