/**
 * 政府端 · 文旅（占位实现，本次只交付「接入点」）
 *
 * 按需求：政府端由另一位同学开发，先把商户端做完，再从这个口接政府端。
 * 所以这里不做完整业务，只做三件事：
 *   1. 把接入契约跑通：从 JZZXPortal.government.inbox() 读待办；
 *   2. 留一个能验收的最小答复入口（明确标注为「联调用」，正式版替换）；
 *   3. 把契约贴在页面上，接手的人不用翻文档也能开工。
 */
(function () {
  'use strict';
  var P = window.JZZXPortal;
  var app = document.getElementById('app');
  if (!P || !app) return;
  var U = P.utils;

  function thread(item) {
    return (item.messages || []).map(function (m) {
      return '<div class="p-msg ' + m.role + '"><span class="who">' + (m.role === 'government' ? '政府' : m.role === 'merchant' ? '商户' : '游客') +
        ' · ' + U.esc(U.fmtDate(m.at)) + '</span>' + U.esc(m.text) + '</div>';
    }).join('');
  }

  function inboxRow(item) {
    var typeLabel = item.type === 'issue' ? '商户问题' : '游客反馈';
    var statusText = item.status === 'pending' ? '待处理' : '已答复';
    return '<div class="p-card" style="margin:0"><div class="p-card-head"><div><h3>' +
      U.esc(item.title || item.category || typeLabel) + '</h3>' +
      '<p class="p-hint">' + typeLabel + ' · ' + U.esc(item.categoryLabel || item.category) + ' · ' + U.esc(U.fmtDate(item.createdAt)) + '</p></div>' +
      '<span class="p-pill ' + item.status + '">' + statusText + '</span></div>' +
      (item.detail ? '<p class="p-note" style="margin:0 0 6px">' + U.esc(item.detail) + '</p>' : '') +
      (item.text ? '<p class="p-note" style="margin:0 0 6px">' + U.esc(item.text) + '</p>' : '') +
      (item.messages && item.messages.length ? '<div class="p-thread">' + thread(item) + '</div>' : '') +
      '<form class="p-reply" data-gov-type="' + item.type + '" data-id="' + item.id + '">' +
      '<input class="p-input" name="text" maxlength="300" placeholder="以政府身份答复（联调用）" aria-label="政府答复" required />' +
      '<button class="p-btn small" type="submit">答复</button></form></div>';
  }

  function render() {
    var inbox = P.government.inbox();
    var counts = P.government.counts();
    var list = inbox.length ? inbox.map(inboxRow).join('') : '<p class="p-empty">暂无待办。商户端提交问题、游客端提交反馈后会出现在这里。</p>';
    app.innerHTML = '<header class="p-header"><div class="p-header-top"><h1 class="p-title">文旅 · 政府端</h1>' +
      '<span class="p-badge gov">政府</span><span class="p-demo">待接入</span></div>' +
      '<p class="p-sub">本端口由另一位同学开发。当前只提供数据接入点与联调用答复入口。</p></header>' +
      '<main class="p-body">' +
      '<section class="p-card"><h3>接入点（先看这段）</h3>' +
      '<p class="p-hint">数据来自商户端与游客端写入的同一份本地数据，政府端只需实现下面三件事，其余页面可自由重写。</p>' +
      '<pre class="p-code">// 1) 读待办\nconst inbox = JZZXPortal.government.inbox();\n// [{ type: "issue" | "feedback", status, messages, ... }]\n\n// 2) 答复（写回同一份数据，商户端/游客端会收到变更）\nJZZXPortal.government.reply("issue" | "feedback", id, text);\n\n// 3) 跨页面变更通知\nwindow.addEventListener("storage", refresh);\nJZZXPortal.onChange(refresh);</pre>' +
      '<p class="p-note">数据结构与字段说明见 public/portals/README.md；换成真实接口时只需替换 portal-core.js 的读写实现。</p></section>' +
      '<section class="p-card"><div class="p-card-head"><div><h3>待办</h3>' +
      '<p class="p-hint">共 ' + counts.total + ' 条，待处理 ' + counts.pending + ' 条。</p></div></div>' +
      '<div class="p-stats"><div class="p-stat"><b>' + counts.pending + '</b><span>待处理</span></div>' +
      '<div class="p-stat"><b>' + counts.total + '</b><span>全部</span></div></div></section>' +
      '<section style="display:grid;gap:11px">' + list + '</section>' +
      '<p class="p-note warn">联调用答复框是占位实现，正式版应由政府端按真实权限与流程重写；本地数据没有鉴权，不能当作政务系统。</p>' +
      '</main><footer class="p-footer">public/portals/government/ · 契约文档：public/portals/README.md</footer>';

    app.querySelectorAll('[data-gov-type]').forEach(function (form) {
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        var text = new FormData(form).get('text');
        P.government.reply(form.getAttribute('data-gov-type'), form.getAttribute('data-id'), text);
        render();
      });
    });
  }

  P.onChange(function () {
    var ae = document.activeElement;
    if (ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) return;
    render();
  });
  render();
})();
