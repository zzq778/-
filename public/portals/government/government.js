/**
 * 政府端 · 文旅（正式页，基于 shared/portal-core.js 的政府端接入点）
 *
 * 接入方式没有变，仍是 README 里那三件事：
 *   JZZXPortal.government.inbox()            读待办（商户问题 + 游客反馈）
 *   JZZXPortal.government.reply(type,id,t)   以政府身份答复，写回同一份存储
 *   JZZXPortal.onChange(fn)                  另外两端写入时刷新
 * 额外用到 docs.list()/docs.setStatus() 做证件审核（商户端提交的 5 类证件）。
 *
 * 这一版的边界：数据仍在本机 localStorage，没有鉴权、没有服务端校验，
 * 真实审批 / 实名 / 工单流转系统待接入；页面上的答复与草稿都是演示用。
 * 纯计算部分在 gov-logic.js，这里只负责渲染与事件。
 */
(function () {
  'use strict';

  var P = window.JZZXPortal;
  var L = window.JZZXGovLogic;
  var app = document.getElementById('app');
  if (!P || !L || !app) return;
  var U = P.utils;

  var TABS = [
    { id: 'inbox', label: '待办' },
    { id: 'docs', label: '证件审核' },
    { id: 'board', label: '数据概览' },
    { id: 'about', label: '说明' }
  ];

  var state = { tab: 'inbox', status: '', type: '', category: '', q: '' };
  var draftIndex = {};
  var toastTimer = null;

  function toast(text) {
    state.toast = text;
    render();
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      state.toast = '';
      var el = app.querySelector('.g-toast');
      if (el) el.remove();
    }, 2600);
  }

  function inbox() {
    return P.government.inbox();
  }

  function tabBar() {
    return '<nav class="p-tabs" role="tablist" aria-label="政府端功能">' + TABS.map(function (t) {
      var on = state.tab === t.id;
      return '<button type="button" class="p-tab" role="tab" data-tab="' + t.id + '" aria-selected="' + on + '">' + t.label + '</button>';
    }).join('') + '</nav>';
  }

  function header(counts) {
    return '<header class="p-header"><div class="p-header-top">' +
      '<h1 class="p-title">文旅 · 政府端</h1>' +
      '<span class="p-demo">本机工作台</span>' +
      '</div>' +
      '<p class="p-sub">待处理 ' + counts.pending + ' 条 · 全部 ' + counts.total + ' 条。商户问题与游客反馈汇总在一处，答复会同步回对应端。</p>' +
      tabBar() + '</header>';
  }

  /* ── 待办 ─────────────────────────────────────────────── */

  function filterBar() {
    var items = inbox();
    var cats = L.categoryOptions(items);
    var s = L.stats(items);
    var chip = function (group, value, label, count) {
      var on = String(state[group]) === value;
      var num = count == null ? '' : '<i>' + count + '</i>';
      return '<button type="button" class="p-chip" data-filter="' + group + '" data-value="' + U.esc(value) + '" aria-pressed="' + on + '">' + U.esc(label) + num + '</button>';
    };
    return '<section class="p-card g-filters"><div class="p-chips">' +
      chip('status', '', '全部', s.total) +
      chip('status', 'pending', '待处理', s.pending) +
      chip('status', 'done', '已答复', s.done) +
      chip('status', 'overdue', '逾期', s.overdue) +
      '</div><div class="p-chips">' +
      chip('type', '', '不限类型') +
      chip('type', 'issue', '商户问题', s.byType.issue.total) +
      chip('type', 'feedback', '游客反馈', s.byType.feedback.total) +
      '</div>' +
      (cats.length ? '<div class="p-chips g-cats">' + chip('category', '', '全部类别') +
        cats.map(function (c) { return chip('category', c.label, c.label, c.count); }).join('') + '</div>' : '') +
      '<label class="g-search"><span class="p-label">搜索</span>' +
      '<input class="p-input" id="gov-q" type="search" placeholder="标题、内容、地点、商户名" value="' + U.esc(state.q) + '" aria-label="搜索待办" /></label>' +
      '</section>';
  }

  function thread(item) {
    if (!item.messages || !item.messages.length) return '';
    return '<div class="p-thread">' + item.messages.map(function (m) {
      var who = m.role === 'government' ? '政府' : m.role === 'merchant' ? '商户' : '游客';
      return '<div class="p-msg ' + U.esc(m.role) + '"><span class="who">' + who + ' · ' + U.esc(U.fmtDate(m.at)) + '</span>' + U.esc(m.text) + '</div>';
    }).join('') + '</div>';
  }

  function itemCard(item) {
    var done = L.isDone(item);
    var overdue = L.isOverdue(item);
    var title = item.title || (item.text ? String(item.text).slice(0, 40) : (item.categoryLabel || '未命名'));
    var typeLabel = item.type === 'feedback' ? '游客反馈' : '商户问题';
    var meta = [typeLabel, item.categoryLabel || item.category, item.merchantName || item.fromName, U.fmtDate(item.createdAt)]
      .filter(Boolean).join(' · ');
    var wait = done ? '已答复' : '已等待 ' + L.fmtDuration(L.waitingHours(item));
    draftIndex[item.type + ':' + item.id] = L.drafts(item);
    var draftBtns = L.drafts(item).map(function (d) {
      return '<button type="button" class="p-btn ghost small" data-draft="' + d.id + '" data-key="' + item.type + ':' + item.id + '">' + d.label + '</button>';
    }).join('');
    return '<article class="p-card g-item' + (done ? ' done' : '') + (overdue ? ' overdue' : '') + '" data-item="' + U.esc(item.id) + '">' +
      '<div class="p-card-head"><div><h3>' + U.esc(title) + '</h3>' +
      '<p class="p-hint">' + U.esc(meta) + '</p></div>' +
      '<span class="p-pill ' + (done ? item.status : 'pending') + '">' + (done ? '已答复' : overdue ? '逾期未答复' : '待处理') + '</span></div>' +
      (item.location ? '<p class="p-note">地点：' + U.esc(item.location) + '</p>' : '') +
      (item.detail && item.detail !== title ? '<p class="p-note">' + U.esc(item.detail) + '</p>' : '') +
      (item.text && item.text !== title ? '<p class="p-note">' + U.esc(item.text) + '</p>' : '') +
      thread(item) +
      '<p class="g-wait">' + U.esc(wait) + '</p>' +
      '<div class="g-drafts">' + draftBtns + '</div>' +
      '<form class="p-reply" data-reply="' + item.type + '" data-id="' + U.esc(item.id) + '">' +
      '<label class="g-reply-field"><span class="p-label">答复（政府身份）</span>' +
      '<textarea class="p-textarea" name="text" rows="2" maxlength="400" required placeholder="可先点上面的草稿，再按实际情况修改">' + '</textarea></label>' +
      '<button class="p-btn" type="submit">答复</button></form></article>';
  }

  function inboxView() {
    var items = inbox();
    var s = L.stats(items);
    var filtered = L.filter(items, state);
    if (state.status === 'overdue') filtered = filtered.filter(function (x) { return L.isOverdue(x); });
    var list = filtered.length
      ? filtered.map(itemCard).join('')
      : '<p class="p-empty">' + (items.length
        ? '当前筛选条件下没有待办，试试切到「全部」。'
        : '暂无待办。此设备上的商户问题与游客反馈将显示在这里。') + '</p>';
    return '<main class="p-body">' +
      '<section class="p-card"><div class="p-card-head"><div><h3>处理概览</h3>' +
      '<p class="p-hint">答复率 ' + s.replyRate + '% · 平均首答 ' + (s.avgReplyHours ? L.fmtDuration(s.avgReplyHours) : '暂无数据') + '</p></div></div>' +
      '<div class="p-stats g-stats">' +
      '<div class="p-stat"><b>' + s.pending + '</b><span>待处理</span></div>' +
      '<div class="p-stat"><b>' + s.done + '</b><span>已答复</span></div>' +
      '<div class="p-stat"><b>' + s.overdue + '</b><span>超 24 小时</span></div>' +
      '<div class="p-stat"><b>' + s.total + '</b><span>全部</span></div>' +
      '</div>' + (items.length ? '' : '<button type="button" class="p-btn ghost small g-seed" data-action="seed">载入 5 条示例待办</button>') + '</section>' +
      filterBar() +
      '<section class="g-list">' + list + '</section>' +
      '<p class="p-note warn">答复仅在此设备的三个工作台间可见，不具有政务受理或审批效力。</p>' +
      '</main>';
  }

  /* ── 证件审核 ─────────────────────────────────────────── */

  function docsView() {
    var merchant = P.merchant.get();
    var docs = P.docs.list();
    var labels = {};
    P.DOC_TYPES.forEach(function (d) { labels[d.id] = d.label; });
    var q = L.docQueue(docs, labels);
    var completion = P.merchant.completion();
    var rows = q.items.map(function (doc) {
      return '<div class="p-row"><div class="p-row-main"><strong>' + U.esc(doc.label) + '</strong>' +
        '<small>' + (doc.updatedAt ? '更新于 ' + U.esc(U.fmtDate(doc.updatedAt)) : '商户端尚未提交') + '</small></div>' +
        '<span class="p-pill ' + doc.status + '">' + U.esc(doc.statusLabel) + '</span>' +
        '<div class="g-doc-actions">' +
        '<button type="button" class="p-btn small" data-doc="' + doc.id + '" data-status="approved"' + (doc.status === 'approved' ? ' disabled' : '') + '>通过</button>' +
        '<button type="button" class="p-btn ghost small" data-doc="' + doc.id + '" data-status="rejected"' + (doc.status === 'rejected' ? ' disabled' : '') + '>退回</button>' +
        '</div></div>';
    }).join('');
    return '<main class="p-body">' +
      '<section class="p-card"><div class="p-card-head"><div><h3>' + U.esc(merchant.name) + '</h3>' +
      '<p class="p-hint">' + U.esc([merchant.type, merchant.address].filter(Boolean).join(' · ')) + '</p></div>' +
      '<span class="p-pill ' + (merchant.demo ? 'pending' : 'approved') + '">' + (merchant.demo ? '示例商户' : '已登记') + '</span></div>' +
      '<div class="p-progress" role="img" aria-label="档案完整度 ' + completion.percent + '%"><i style="width:' + completion.percent + '%"></i></div>' +
      '<p class="p-note">档案完整度 ' + completion.percent + '%（' + completion.filled + '/' + completion.total + ' 项）· 证件待审 ' + q.pending + ' 件 · 已通过 ' + q.counts.approved + ' 件</p></section>' +
      '<section class="p-card"><h3>证件审核</h3>' +
      '<p class="p-hint">商户端提交的 5 类证件在这里审核；通过或退回会立刻写回同一份数据，商户端刷新即可看到状态。</p>' +
      (q.items.length ? rows : '<p class="p-empty">暂无证件记录。先在商户端「证件办理」里提交。</p>') +
      '</section>' +
      '<p class="p-note warn">证件只记录类型与状态，不上传文件；真实许可仍以主管部门核发为准，本页不构成审批结论。</p>' +
      '</main>';
  }

  /* ── 数据概览 ─────────────────────────────────────────── */

  function bars(rows, unit) {
    if (!rows.length) return '<p class="p-empty">暂无数据。</p>';
    var max = Math.max.apply(null, rows.map(function (r) { return r.count; }));
    return '<div class="g-bars">' + rows.map(function (r) {
      var w = max ? Math.max(4, Math.round((r.count / max) * 100)) : 0;
      return '<div class="g-bar"><span class="g-bar-label">' + U.esc(r.label) + '</span>' +
        '<span class="g-bar-track"><i style="width:' + w + '%"></i></span>' +
        '<span class="g-bar-value">' + r.count + (unit || '') + '</span></div>';
    }).join('') + '</div>';
  }

  function boardView() {
    var items = inbox();
    var s = L.stats(items);
    var days = s.byDay.map(function (d) { return { label: d.label, count: d.count }; });
    var events = L.seasonal(window.WENLV && window.WENLV.calendar, new Date().getMonth() + 1);
    var kb = window.WENLV || {};
    var kbLine = kb.attractions
      ? '知识库：' + kb.attractions.length + ' 个景点 / ' + (kb.routes || []).length + ' 条线路 / ' + (kb.calendar || []).length + ' 个时令'
      : '未加载文旅知识库（wenlv-data.js）';
    return '<main class="p-body">' +
      '<section class="p-card"><h3>待办结构</h3>' +
      '<p class="p-hint">共 ' + s.total + ' 条 · 商户问题 ' + s.byType.issue.total + '（待处理 ' + s.byType.issue.pending + '）· 游客反馈 ' + s.byType.feedback.total + '（待处理 ' + s.byType.feedback.pending + '）</p>' +
      '<div class="p-stats g-stats">' +
      '<div class="p-stat"><b>' + s.replyRate + '%</b><span>答复率</span></div>' +
      '<div class="p-stat"><b>' + (s.avgReplyHours ? L.fmtDuration(s.avgReplyHours) : '—') + '</b><span>平均首答</span></div>' +
      '<div class="p-stat"><b>' + s.overdue + '</b><span>逾期</span></div>' +
      '</div></section>' +
      '<section class="p-card"><h3>按类别</h3><p class="p-hint">来自商户提交时选择的 6 类问题，以及游客反馈的类别。</p>' +
      bars(s.byCategory.map(function (c) { return { label: c.label, count: c.count }; })) + '</section>' +
      '<section class="p-card"><h3>近 7 天新增</h3><p class="p-hint">按提交日期统计，用于看客流与商户问题是否集中在某个时段。</p>' +
      bars(days) + '</section>' +
      '<section class="p-card"><h3>本月时令（值班参考）</h3><p class="p-hint">' + U.esc(kbLine) + '</p>' +
      (events.length ? events.map(function (ev) {
        return '<div class="p-row"><div class="p-row-main"><strong>' + U.esc(ev.name) + '</strong>' +
          '<small>' + U.esc(ev.window) + ' · ' + U.esc(ev.type) + '</small></div></div>';
      }).join('') : '<p class="p-empty">本月没有已收录的时令窗口。</p>') +
      '<p class="p-note">活动日期以当年主办方公告为准。</p></section>' +
      '</main>';
  }

  /* ── 说明 ─────────────────────────────────────────────── */

  function aboutView() {
    return '<main class="p-body">' +
      '<section class="p-card"><h3>数据与导出</h3><p class="p-hint">保存当前待办清单或复制处理摘要。</p>' +
      '<div class="g-actions"><button type="button" class="p-btn" data-action="csv">导出待办 CSV</button>' +
      '<button type="button" class="p-btn ghost" data-action="copy">复制摘要</button></div>' +
      '<p class="p-note">导出内容来自此设备。请妥善保管含有问题描述的文件。</p></section>' +
      '<section class="p-card"><h3>工作台使用范围</h3><p>查看商户问题、游客反馈、证件记录与处理统计。三个工作台共享此浏览器的数据。</p>' +
      '<p class="p-note warn">本机记录不具备身份认证或正式审批效力，不会发送至真实政府部门。清除浏览器数据将删除记录，请勿填写敏感信息。</p></section></main>';
  }

  /* ── 渲染与事件 ───────────────────────────────────────── */

  function render() {
    var counts = P.government.counts();
    var view = state.tab === 'docs' ? docsView()
      : state.tab === 'board' ? boardView()
        : state.tab === 'about' ? aboutView()
          : inboxView();
    app.innerHTML = header(counts) + view +
      '<footer class="p-footer">吉政知行 · 本机工作台</footer>' +
      (state.toast ? '<div class="g-toast" role="status">' + U.esc(state.toast) + '</div>' : '');
    bind();
  }

  function bind() {
    app.querySelectorAll('[data-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.tab = btn.getAttribute('data-tab');
        render();
      });
    });

    app.querySelectorAll('[data-filter]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var group = btn.getAttribute('data-filter');
        var value = btn.getAttribute('data-value');
        state[group] = state[group] === value ? '' : value;
        render();
      });
    });

    var q = app.querySelector('#gov-q');
    if (q) {
      q.addEventListener('input', function () {
        state.q = q.value;
        render();
        var again = app.querySelector('#gov-q');
        if (again) { again.focus(); again.setSelectionRange(again.value.length, again.value.length); }
      });
    }

    app.querySelectorAll('[data-draft]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-key');
        var id = btn.getAttribute('data-draft');
        var list = draftIndex[key] || [];
        var hit = list.filter(function (d) { return d.id === id; })[0];
        var card = btn.closest('.g-item');
        var box = card && card.querySelector('textarea[name="text"]');
        if (hit && box) { box.value = hit.text; box.focus(); }
      });
    });

    app.querySelectorAll('[data-reply]').forEach(function (form) {
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        var text = new FormData(form).get('text');
        var type = form.getAttribute('data-reply');
        var id = form.getAttribute('data-id');
        var done = P.government.reply(type, id, text);
        if (!done) { toast('答复内容不能为空'); return; }
        toast('已答复，商户端与游客端会同步看到');
        render();
      });
    });

    app.querySelectorAll('[data-doc]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var ok = P.docs.setStatus(btn.getAttribute('data-doc'), btn.getAttribute('data-status'));
        toast(ok ? (btn.getAttribute('data-status') === 'approved' ? '已通过该证件' : '已退回，等待商户补正') : '状态更新失败');
        render();
      });
    });

    app.querySelectorAll('[data-action]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var action = btn.getAttribute('data-action');
        if (action === 'seed') seed();
        if (action === 'csv') exportCsv();
        if (action === 'copy') copyReport();
      });
    });
  }

  function seed() {
    // 演示数据刻意错开时间：两条逾期、一条已答复、两条刚提交，方便评委一眼看到四种状态。
    var hour = 3600 * 1000;
    var now = Date.now();
    function ago(hours) { return new Date(now - hours * hour).toISOString(); }
    P.issues.add({ category: 'traffic', title: '停车场入口积水', detail: '雨后入口积水约 20 公分，影响客人进出', location: '韩屯村东侧停车场', createdAt: ago(30) });
    P.issues.add({ category: 'infra', title: '游客中心指示牌缺失', detail: '从停车场到游客中心没有明显指引', location: '雾凇岛游客中心', createdAt: ago(6) });
    var answered = P.issues.add({ category: 'policy', title: '冬季营业补贴怎么申请', detail: '想了解今年冬季营业的补贴口径与材料清单', location: '吉林市龙潭区', createdAt: ago(26) });
    P.feedback.add({ category: '价格与收费', text: '同一项目现场价格和线上展示不一致', fromName: '游客 A', createdAt: ago(2) });
    P.feedback.add({ category: '设施与环境', text: '休息区座椅偏少，老人排队时没有地方坐', fromName: '游客 B', createdAt: ago(50) });
    P.government.reply('issue', answered.id, L.draft(answered));
    toast('已载入 5 条示例待办');
    render();
  }

  function download(name, text, type) {
    try {
      var blob = new Blob(['\ufeff' + text], { type: type || 'text/csv;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
      toast('已导出 ' + name);
    } catch (e) {
      toast('当前浏览器不支持下载');
    }
  }

  function exportCsv() {
    var stamp = new Date().toISOString().slice(0, 10);
    download('文旅政府端待办-' + stamp + '.csv', L.toCsv(inbox(), Date.now()));
  }

  function copyReport() {
    var text = L.reportText(inbox(), Date.now());
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast('摘要已复制'); }, function () { toast('复制失败，请手动选择'); });
      return;
    }
    toast('当前浏览器不支持自动复制');
  }

  P.government.register(function () { render(); });
  P.onChange(function () {
    var ae = document.activeElement;
    if (ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) return;
    render();
  });
  render();
})();
