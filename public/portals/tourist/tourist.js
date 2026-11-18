/**
 * 游客端 · 文旅（本次新增，独立文件夹）
 *
 * 两件事：
 *   1. 看文旅内容：线路、时令，数据取自 public/wenlv-data.js（window.WENLV）；
 *   2. 向商户反馈：提交后由商户或政府答复，答复会显示在下方时间线里。
 *
 * 反馈写入 JZZXPortal.feedback，商户端与政府端读同一份本地数据。
 */
(function () {
  'use strict';
  var P = window.JZZXPortal;
  var app = document.getElementById('app');
  if (!P || !app) { app.innerHTML = '<p class="p-empty">暂时无法打开工作台，请重新进入。</p>'; return; }
  var U = P.utils;
  var W = window.WENLV || { routes: [], calendar: [], attractions: [] };
  var state = { tab: 'explore', category: P.FEEDBACK_CATEGORIES[0], flash: '' };
  var TABS = [{ id: 'explore', label: '去哪玩' }, { id: 'feedback', label: '反馈问题' }];

  function header() {
    return '<header class="p-header">' +
      '<div class="p-header-top"><h1 class="p-title">文旅 · 游客端</h1><span class="p-badge">游客</span></div>' +
      '<p class="p-sub">吉林文旅知识库：' + (W.attractions || []).length + ' 个景点 · ' + (W.routes || []).length + ' 条线路 · ' + (W.calendar || []).length + ' 个时令窗口</p>' +
      '<nav class="p-tabs" role="tablist">' + TABS.map(function (t) {
        return '<button type="button" class="p-tab" role="tab" data-tab="' + t.id + '" aria-selected="' + (state.tab === t.id) + '">' + t.label + '</button>';
      }).join('') + '</nav></header>';
  }

  function routeCard(r) {
    var attrs = {};
    (W.attractions || []).forEach(function (a) { attrs[a.id] = a; });
    var nodes = (r.nodes || []).map(function (n) {
      var a = attrs[n.attractionId];
      return '<div class="p-row"><div class="p-row-main"><strong>' + U.esc(a ? a.name : n.attractionId) + '</strong>' +
        '<small>Day ' + n.day + ' · ' + U.esc(n.slot) + ' · ' + U.esc(n.why) + '</small></div></div>';
    }).join('');
    var season = (r.season || []).map(function (s) { return { spring: '春', summer: '夏', autumn: '秋', winter: '冬' }[s] || s; }).join('、');
    return '<section class="p-card"><div class="p-card-head"><div><h3>' + U.esc(r.name) + '</h3>' +
      '<p class="p-hint">' + U.esc((r.areas || []).join(' · ')) + ' · ' + r.days + ' 天 · 适合' + U.esc(season) + '</p></div>' +
      '<span class="p-badge">' + r.days + ' 天</span></div>' + nodes +
      '<p class="p-note">票价与开放时间未入库，以景区官方公告为准。</p></section>';
  }

  function seasonRow(e) {
    return '<div class="p-row"><div class="p-row-main"><strong>' + U.esc(e.name) + '</strong>' +
      '<small>' + U.esc(e.window) + ' · ' + U.esc(e.why) + '</small></div>' +
      '<span class="p-pill approved">' + U.esc(e.type) + '</span></div>';
  }

  function exploreTab() {
    var routes = (W.routes || []).slice(0, 6).map(routeCard).join('');
    var calendar = (W.calendar || []).slice(0, 6).map(seasonRow).join('');
    return '<section class="p-card"><h3>怎么走</h3><p class="p-hint">线路只排顺序与理由，不写车程和票价。</p>' +
      '<div class="p-stats"><div class="p-stat"><b>' + (W.routes || []).length + '</b><span>条线路</span></div>' +
      '<div class="p-stat"><b>' + (W.attractions || []).length + '</b><span>个景点</span></div>' +
      '<div class="p-stat"><b>' + (W.calendar || []).length + '</b><span>个时令</span></div></div></section>' +
      routes +
      '<section class="p-card"><h3>什么时候来</h3><p class="p-hint">按月份看窗口，具体日期以官方公告为准。</p>' + calendar + '</section>' +
      '<p class="p-note"><a href="../../wenlv-preview.html">查看完整景点与路线目录</a></p>';
  }

  function feedbackTab() {
    var merchant = P.merchant.get();
    var cats = P.FEEDBACK_CATEGORIES.map(function (c) {
      return '<button type="button" class="p-chip" data-fb-cat="' + U.esc(c) + '" aria-pressed="' + (state.category === c) + '">' + U.esc(c) + '</button>';
    }).join('');
    var list = P.feedback.list();
    var items = list.length ? list.map(function (f) {
      var msgs = (f.messages || []).map(function (m) {
        var who = m.role === 'government' ? '政府答复' : m.role === 'merchant' ? '商户答复' : '游客';
        return '<div class="p-msg ' + m.role + '"><span class="who">' + who + ' · ' + U.esc(U.fmtDate(m.at)) + '</span>' + U.esc(m.text) + '</div>';
      }).join('');
      return '<section class="p-card"><div class="p-card-head"><div><h3>' + U.esc(f.category) + '</h3>' +
        '<p class="p-hint">' + U.esc(f.merchantName) + ' · ' + U.esc(U.fmtDate(f.createdAt)) + '</p></div>' +
        '<span class="p-pill ' + f.status + '">' + (f.status === 'answered' ? '已答复' : '待答复') + '</span></div>' +
        '<p class="p-note" style="margin:0 0 6px">' + U.esc(f.text) + '</p>' +
        (msgs ? '<div class="p-thread">' + msgs + '</div>' : '<p class="p-note warn">还没有答复，商户和政府都能处理。</p>') +
        '</section>';
    }).join('') : '<p class="p-empty">还没有反馈。提交后会显示在这里，商户或政府答复后也会同步。</p>';

    return '<section class="p-card"><h3>向商户反馈</h3><p class="p-hint">反馈对象：' + U.esc(merchant.name) + '（' + U.esc(merchant.type) + ' · ' + U.esc(merchant.address) + '）</p>' +
      '<form class="p-form" id="feedbackForm"><div class="p-field"><span class="p-label">问题类型</span><div class="p-chips" id="fbCats">' + cats + '</div></div>' +
      '<div class="p-field"><label class="p-label" for="fbText">具体描述</label>' +
      '<textarea class="p-textarea" id="fbText" name="text" maxlength="400" required placeholder="例如：10 月 3 日中午，停车引导不清，等了 20 分钟"></textarea></div>' +
      '<div class="p-field"><label class="p-label" for="fbName">称呼（选填）</label>' +
      '<input class="p-input" id="fbName" name="fromName" maxlength="20" placeholder="例如：李女士" /></div>' +
      '<button class="p-btn" type="submit">提交反馈</button>' +
      '<p class="p-note" id="fbMsg" aria-live="polite">' + U.esc(state.flash) + '</p></form></section>' +
      '<section class="p-card"><h3>我的反馈</h3><p class="p-hint">共 ' + list.length + ' 条，待答复 ' + P.feedback.counts().pending + ' 条。商户与政府都能回复。</p></section>' + items;
  }

  function footer() {
    return '<footer class="p-footer">反馈仅保存在此浏览器；' +
      '此设备上的商户与管理工作台可查看反馈。</footer>';
  }

  function render() {
    var scrollY = window.scrollY;
    app.innerHTML = header() + '<main class="p-body">' + (state.tab === 'feedback' ? feedbackTab() : exploreTab()) + '</main>' + footer();
    window.scrollTo(0, scrollY);
  }

  document.addEventListener('click', function (event) {
    var tab = event.target.closest('[data-tab]');
    if (tab) { state.tab = tab.getAttribute('data-tab'); render(); return; }
    var cat = event.target.closest('[data-fb-cat]');
    if (cat) { state.category = cat.getAttribute('data-fb-cat'); render(); }
  });

  document.addEventListener('submit', function (event) {
    if (event.target.id !== 'feedbackForm') return;
    event.preventDefault();
    var data = new FormData(event.target);
    var text = String(data.get('text') || '').trim();
    if (!text) return;
    P.feedback.add({ category: state.category, text: text, fromName: data.get('fromName') });
    state.flash = '已提交，等待商户或政府答复。';
    state.tab = 'feedback';
    render();
  });

  P.onChange(function () {
    var ae = document.activeElement;
    if (ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) return;
    render();
  });

  render();
})();
