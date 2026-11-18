/**
 * 商户端 · 文旅（本次新增，独立文件夹）
 *
 * 四块内容，按用户要求：
 *   1. 证件办理：营业执照/食品经营/卫生/消防/特种行业，状态本地可改，审核由政府端写回；
 *   2. 商户提交问题：6 类（基础设施 / 交通停车 / 周边环境 / 经营场地 / 政策咨询 / 活动建议）；
 *   3. 商户档案与经营数据：基础信息、执照资料、经营类型、经营地址、特色产品、公开资质；
 *   4. 反馈：游客提交的问题在这里回复；政府答复也会显示（通过 JZZXPortal.government.reply 写入）。
 *
 * 政府端接入点见 ../README.md；这里只依赖 window.JZZXPortal，不直接碰 localStorage。
 */
(function () {
  'use strict';
  var P = window.JZZXPortal;
  var app = document.getElementById('app');
  if (!P || !app) { app.innerHTML = '<p class="p-empty">暂时无法打开工作台，请重新进入。</p>'; return; }

  var U = P.utils;
  var state = { tab: 'docs', issueCat: 'infra', flash: '' };
  var TABS = [
    { id: 'docs', label: '证件办理' },
    { id: 'issues', label: '提交问题' },
    { id: 'profile', label: '商户档案' },
    { id: 'feedback', label: '反馈答复' }
  ];

  function header() {
    var m = P.merchant.get();
    var c = P.merchant.completion();
    return '<header class="p-header">' +
      '<div class="p-header-top"><h1 class="p-title">文旅 · 商户端</h1><span class="p-badge shop">商户</span>' +
      (m.demo ? '<span class="p-demo">示例数据</span>' : '') + '</div>' +
      '<p class="p-sub">' + U.esc(m.name || '未命名商户') + ' · 资料完整度 ' + c.percent + '%</p>' +
      '<nav class="p-tabs" role="tablist">' + TABS.map(function (t) {
        return '<button type="button" class="p-tab" role="tab" data-tab="' + t.id + '" aria-selected="' + (state.tab === t.id) + '">' + t.label + '</button>';
      }).join('') + '</nav></header>';
  }

  /* ── 1. 证件办理 ─────────────────────────────────────── */

  function docsTab() {
    var docs = P.docs.list();
    var rows = docs.map(function (d) {
      var type = P.DOC_TYPES.filter(function (t) { return t.id === d.id; })[0] || { label: d.id, hint: '' };
      var action = d.status === 'missing' || d.status === 'rejected'
        ? '<button type="button" class="p-btn small" data-doc="' + d.id + '" data-status="submitted">提交审核</button>'
        : '<button type="button" class="p-btn small ghost" data-doc="' + d.id + '" data-status="missing">撤回</button>';
      return '<div class="p-row"><div class="p-row-main"><strong>' + U.esc(type.label) + '</strong>' +
        '<small>' + U.esc(type.hint) + (d.updatedAt ? ' · 更新于 ' + U.esc(U.fmtDate(d.updatedAt)) : '') + '</small></div>' +
        '<span class="p-pill ' + d.status + '">' + U.esc(P.DOC_STATUS[d.status]) + '</span>' + action + '</div>';
    }).join('');
    return '<section class="p-card"><div class="p-card-head"><div><h3>证件办理</h3>' +
      '<p class="p-hint">提交后状态为「待审核」；审核结果由政府端写回同一份数据，商户端只负责提交与撤回。</p></div></div>' +
      rows + '<p class="p-note">这里只记录证件类型与状态。正式办证请前往政务服务平台提交材料。</p></section>';
  }

  /* ── 2. 商户提交问题 ─────────────────────────────────── */

  function issuesTab() {
    var cats = P.ISSUE_CATEGORIES.map(function (c) {
      return '<button type="button" class="p-chip" data-issue-cat="' + c.id + '" aria-pressed="' + (state.issueCat === c.id) + '">' + U.esc(c.label) + '</button>';
    }).join('');
    var list = P.issues.list();
    var items = list.length ? list.map(function (it) {
      var msgs = (it.messages || []).map(message).join('');
      var reply = '<form class="p-reply" data-reply="issue" data-id="' + it.id + '">' +
        '<input class="p-input" name="text" maxlength="200" placeholder="补充说明（会同步给政府端）" aria-label="补充说明" />' +
        '<button class="p-btn small" type="submit">补充</button></form>';
      return '<div class="p-row" style="display:block"><div class="p-row-main"><strong>' + U.esc(it.title) + '</strong>' +
        '<small>' + U.esc(it.categoryLabel) + (it.location ? ' · ' + U.esc(it.location) : '') + ' · ' + U.esc(U.fmtDate(it.createdAt)) + '</small>' +
        '<div style="margin-top:6px"><span class="p-pill ' + it.status + '">' + (it.status === 'pending' ? '待政府处理' : '已答复') + '</span></div></div>' +
        (it.detail ? '<p class="p-note" style="margin-top:7px">' + U.esc(it.detail) + '</p>' : '') +
        (msgs ? '<div class="p-thread">' + msgs + '</div>' : '') + reply + '</div>';
    }).join('') : '<p class="p-empty">还没有记录。新增问题后，可在此设备的管理工作台查看。</p>';

    return '<section class="p-card"><h3>提交问题</h3><p class="p-hint">选择类型并描述问题，记录会同步至此设备的管理工作台。</p>' +
      '<form class="p-form" id="issueForm"><div class="p-field"><span class="p-label">问题类型</span><div class="p-chips" id="issueCats">' + cats + '</div></div>' +
      '<div class="p-field"><label class="p-label" for="issueTitle">一句话标题</label>' +
      '<input class="p-input" id="issueTitle" name="title" maxlength="40" required placeholder="例如：停车场入口积水影响客人进出" /></div>' +
      '<div class="p-field"><label class="p-label" for="issueDetail">具体描述</label>' +
      '<textarea class="p-textarea" id="issueDetail" name="detail" maxlength="500" placeholder="时间、位置、影响范围；不要填写身份证等敏感信息" /></div>' +
      '<div class="p-field"><label class="p-label" for="issueLocation">地点（选填）</label>' +
      '<input class="p-input" id="issueLocation" name="location" maxlength="60" placeholder="例如：韩屯村东侧停车场" /></div>' +
      '<button class="p-btn" type="submit">提交给政府端</button></form></section>' +
      '<section class="p-card"><h3>我的问题</h3><p class="p-hint">共 ' + list.length + ' 条，待处理 ' + P.issues.counts().pending + ' 条。</p>' + items + '</section>';
  }

  /* ── 3. 商户档案与经营数据 ───────────────────────────── */

  function profileTab() {
    var m = P.merchant.get();
    var c = P.merchant.completion();
    var typeOptions = P.BUSINESS_TYPES.map(function (t) {
      return '<option value="' + U.esc(t) + '"' + (m.type === t ? ' selected' : '') + '>' + U.esc(t) + '</option>';
    }).join('');
    var quals = (m.qualifications || []).map(function (q) {
      return '• ' + (q.name || '') + (q.issuer ? '（' + q.issuer + '）' : '');
    }).join('\n');

    return '<section class="p-card"><div class="p-card-head"><div><h3>资料完整度</h3>' +
      '<p class="p-hint">已填 ' + c.filled + '/' + c.total + ' 项，只保存在本机浏览器。</p></div><strong>' + c.percent + '%</strong></div>' +
      '<div class="p-progress"><i style="width:' + c.percent + '%"></i></div>' +
      '<p class="p-note">执照编号与统一社会信用代码属敏感资料：列表里只做遮挡展示，别在截图或群里外发。</p></section>' +
      '<section class="p-card"><h3>基础信息</h3>' +
      '<form class="p-form" id="profileForm">' +
      field('商户名称', 'name', m.name, '例如：雾凇岛人家', true) +
      field('联系人', 'contact', m.contact, '负责人称呼（不要填写真实身份信息）', true) +
      field('联系电话', 'phone', m.phone, '手机号或座机', true) +
      '<div class="p-field"><label class="p-label" for="type">经营类型</label><select class="p-select" id="type" name="type">' + typeOptions + '</select></div>' +
      field('经营地址', 'address', m.address, '门牌到村/街道即可', true) +
      '<h3 style="margin:8px 0 0">执照资料</h3>' +
      field('统一社会信用代码', 'licenseCode', m.license && m.license.code, '18 位，例如 9122…', true) +
      field('营业执照编号', 'licenseNumber', m.license && m.license.number, '登记号或执照编号', true) +
      field('执照有效期至', 'licenseValidUntil', m.license && m.license.validUntil, 'YYYY-MM-DD', true) +
      '<h3 style="margin:8px 0 0">经营内容</h3>' +
      '<div class="p-field"><label class="p-label" for="specialties">特色产品（用顿号或逗号分隔）</label>' +
      '<input class="p-input" id="specialties" name="specialties" value="' + U.esc((m.specialties || []).join('、')) + '" placeholder="例如：江鱼宴、雾凇摄影向导" /></div>' +
      '<div class="p-field"><label class="p-label" for="qualifications">相关公开资质（每行一条，可写「名称 | 发证机关」）</label>' +
      '<textarea class="p-textarea" id="qualifications" name="qualifications" placeholder="食品经营许可证 | 区市场监管局">' + U.esc(quals) + '</textarea></div>' +
      '<p class="p-note">公开资质指可以对外公示的许可证与荣誉，不要填内部编号或个人信息。</p>' +
      '<button class="p-btn" type="submit">保存档案</button>' +
      '<p class="p-note" id="saveMsg" aria-live="polite">' + U.esc(state.flash) + '</p></form></section>';
  }

  function field(label, name, value, placeholder, required) {
    return '<div class="p-field"><label class="p-label" for="' + name + '">' + label + (required ? '' : '（选填）') + '</label>' +
      '<input class="p-input" id="' + name + '" name="' + name + '" value="' + U.esc(value || '') + '" placeholder="' + U.esc(placeholder) + '"' + (required ? ' required' : '') + ' /></div>';
  }

  /* ── 4. 反馈（游客 → 商户，政府也能答） ───────────────── */

  function message(m) {
    var who = m.role === 'government' ? '政府' : m.role === 'merchant' ? '商户' : '游客';
    return '<div class="p-msg ' + m.role + '"><span class="who">' + who + ' · ' + U.esc(U.fmtDate(m.at)) + '</span>' + U.esc(m.text) + '</div>';
  }

  function feedbackTab() {
    var list = P.feedback.list().filter(function (f) { return f.merchantId === P.merchant.get().id; });
    var items = list.length ? list.map(function (f) {
      var thread = (f.messages || []).map(message).join('');
      return '<div class="p-card" style="margin:0"><div class="p-card-head"><div><h3>' + U.esc(f.category) + '</h3>' +
        '<p class="p-hint">' + U.esc(f.fromName) + ' · ' + U.esc(U.fmtDate(f.createdAt)) + '</p></div>' +
        '<span class="p-pill ' + f.status + '">' + (f.status === 'answered' ? '已答复' : '待答复') + '</span></div>' +
        '<p class="p-note" style="margin:0 0 6px">' + U.esc(f.text) + '</p>' +
        (thread ? '<div class="p-thread">' + thread + '</div>' : '') +
        '<form class="p-reply" data-reply="feedback" data-id="' + f.id + '">' +
        '<input class="p-input" name="text" maxlength="200" placeholder="以商户身份回复" aria-label="商户回复" required />' +
        '<button class="p-btn small" type="submit">回复</button></form></div>';
    }).join('') : '<p class="p-empty">还没有游客反馈。游客端提交后会出现在这里，政府端答复也会同步显示。</p>';

    return '<section class="p-card"><h3>游客反馈</h3>' +
      '<p class="p-hint">共 ' + list.length + ' 条，待答复 ' + P.feedback.counts().pending + ' 条。商户和政府都能回复。</p></section>' +
      '<section style="display:grid;gap:11px">' + items + '</section>';
  }

  function footer() {
    return '<footer class="p-footer">记录仅保存在此浏览器；清除浏览器数据将删除记录。' +
      '不会向实际政务部门发送信息。</footer>';
  }

  function body() {
    if (state.tab === 'issues') return issuesTab();
    if (state.tab === 'profile') return profileTab();
    if (state.tab === 'feedback') return feedbackTab();
    return docsTab();
  }

  function render() {
    var focusId = document.activeElement && document.activeElement.id;
    var scrollY = window.scrollY;
    app.innerHTML = header() + '<main class="p-body">' + body() + '</main>' + footer();
    if (focusId) { var el = document.getElementById(focusId); if (el) el.focus({ preventScroll: true }); }
    window.scrollTo(0, scrollY);
  }

  /* ── 事件 ─────────────────────────────────────────────── */

  document.addEventListener('click', function (event) {
    var tab = event.target.closest('[data-tab]');
    if (tab) { state.tab = tab.getAttribute('data-tab'); render(); return; }
    var cat = event.target.closest('[data-issue-cat]');
    if (cat) { state.issueCat = cat.getAttribute('data-issue-cat'); render(); return; }
    var doc = event.target.closest('[data-doc]');
    if (doc) {
      P.docs.setStatus(doc.getAttribute('data-doc'), doc.getAttribute('data-status'));
      render();
      return;
    }
  });

  document.addEventListener('submit', function (event) {
    var form = event.target;
    if (form.id === 'issueForm') {
      event.preventDefault();
      var data = new FormData(form);
      var title = String(data.get('title') || '').trim();
      var detail = String(data.get('detail') || '').trim();
      if (!title) return;
      P.issues.add({ category: state.issueCat, title: title, detail: detail, location: data.get('location') });
      state.flash = '问题已提交，政府端待办里可以看到。';
      render();
      return;
    }
    if (form.id === 'profileForm') {
      event.preventDefault();
      var f = new FormData(form);
      var specialties = String(f.get('specialties') || '').split(/[、,，]/).map(function (s) { return s.trim(); }).filter(Boolean);
      var quals = String(f.get('qualifications') || '').split(/\n+/).map(function (line) {
        var parts = line.split('|').map(function (s) { return s.trim(); });
        return parts[0] ? { name: parts[0], issuer: parts[1] || '' } : null;
      }).filter(Boolean);
      P.merchant.save({
        name: f.get('name'), contact: f.get('contact'), phone: f.get('phone'), type: f.get('type'),
        address: f.get('address'),
        license: { code: f.get('licenseCode'), number: f.get('licenseNumber'), validUntil: f.get('licenseValidUntil') },
        specialties: specialties,
        qualifications: quals
      });
      state.flash = '已保存到本机（' + new Date().toLocaleTimeString('zh-CN', { hour12: false }) + '）。';
      render();
      return;
    }
    if (form.dataset.reply) {
      event.preventDefault();
      var text = new FormData(form).get('text');
      var id = form.getAttribute('data-id');
      if (form.dataset.reply === 'issue') P.issues.reply(id, 'merchant', text);
      else {
        var got = P.feedback.reply(id, 'merchant', text);
        if (got) state.flash = '已回复游客。';
      }
      render();
    }
  });

  P.onChange(function () {
    var ae = document.activeElement;
    if (ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) return;
    render();
  });

  render();
})();
