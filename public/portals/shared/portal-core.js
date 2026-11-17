/**
 * 三端门户共用的数据层与「政府端接入点」（本次新增）
 *
 * 为什么单独一个文件：
 * - 商户端、游客端、政府端是三个独立文件夹，各自 index.html 直接引入本文件；
 * - 数据先落在本机 localStorage（同一域名三个端共享），行政府端的人只要按
 *   这里的数据结构实现，就能直接接手，不用改商户端/游客端；
 * - 后续换成真实接口时，只需把 read/write 换成 fetch，调用方不用动。
 *
 * 政府端接入契约（详见 public/portals/README.md）：
 *   window.JZZXPortal.government.inbox()          读待办：问题 + 反馈
 *   window.JZZXPortal.government.reply(type,id,t) 以政府身份答复，写回同一存储
 *   window.addEventListener('storage', ...)       跨页面变更通知（三个端都能收到）
 *
 * 明确边界：这里没有鉴权、没有服务端校验，任何同源页面都能读写。
 * 它只是演示与联调用的本地数据层，**不能当作真实的政务审批或实名系统**。
 */
(function (global) {
  'use strict';

  var VERSION = 'portal-v1';
  var NS = 'jzzx-portal-v1';
  var KEYS = {
    merchant: NS + ':merchant',
    issues: NS + ':issues',
    feedback: NS + ':feedback'
  };
  var ROLE_KEY = 'jzzx-portal-role';

  var ROLES = [
    { id: 'tourist', label: '游客端', dir: 'tourist', desc: '看线路、看时令，向商户反馈问题' },
    { id: 'merchant', label: '商户端', dir: 'merchant', desc: '证件、提问题、经营档案、回复反馈' },
    { id: 'government', label: '政府端', dir: 'government', desc: '接收问题与反馈并答复（另一个人开发）' }
  ];

  /** 商户可以提交的问题类型（用户指定的 6 类）。 */
  var ISSUE_CATEGORIES = [
    { id: 'infra', label: '基础设施问题' },
    { id: 'traffic', label: '交通与停车问题' },
    { id: 'environment', label: '景区周边环境问题' },
    { id: 'site', label: '经营场地问题' },
    { id: 'policy', label: '政策咨询' },
    { id: 'event', label: '文旅活动建议' }
  ];

  var FEEDBACK_CATEGORIES = ['服务态度', '设施与环境', '价格与收费', '安全问题', '其他'];

  var DOC_TYPES = [
    { id: 'license', label: '营业执照', hint: '副本扫描件或照片，需在有效期内' },
    { id: 'food', label: '食品经营许可证', hint: '涉及餐饮、预包装食品销售时必备' },
    { id: 'health', label: '公共场所卫生许可证', hint: '住宿、洗浴、游泳等场所' },
    { id: 'fire', label: '消防安全检查合格证', hint: '营业场所类通常需要' },
    { id: 'special', label: '特种行业许可证', hint: '住宿业等特殊行业' }
  ];

  var DOC_STATUS = {
    missing: '未提交',
    submitted: '待审核',
    approved: '已通过',
    rejected: '需补正'
  };

  var BUSINESS_TYPES = ['餐饮', '住宿/民宿', '景区/景点', '交通/租车', '文创零售', '演艺/娱乐', '研学/体验', '其他'];

  function nowISO() {
    return new Date().toISOString();
  }

  function uid(prefix) {
    return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function fmtDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  /** 执照编号只显示首尾，避免在游客端或截图里泄露完整编号。 */
  function maskLicense(value) {
    var s = String(value || '').replace(/\s+/g, '');
    if (!s) return '';
    if (s.length <= 6) return s.slice(0, 2) + '***';
    return s.slice(0, 4) + ' **** **** ' + s.slice(-4);
  }

  function read(key, fallback) {
    try {
      var raw = global.localStorage.getItem(key);
      if (!raw) return fallback;
      var parsed = JSON.parse(raw);
      return parsed == null ? fallback : parsed;
    } catch (e) {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      global.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  function emit(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent('jzzx-portal:' + name, { detail: detail }));
    } catch (e) { /* 老浏览器忽略 */ }
    try {
      global.dispatchEvent(new CustomEvent('jzzx-portal:' + name, { detail: detail }));
    } catch (e) { /* 同上 */ }
  }

  /* ── 商户 ─────────────────────────────────────────────── */

  function blankDocs() {
    return DOC_TYPES.map(function (d) {
      return { id: d.id, status: 'missing', updatedAt: null };
    });
  }

  function blankMerchant() {
    return {
      id: 'merchant-local',
      demo: true,
      name: '雾凇岛人家（示例商户）',
      contact: '王经理',
      phone: '138****0000',
      type: '餐饮',
      address: '吉林市龙潭区乌拉街镇韩屯村',
      specialties: ['江鱼宴', '雾凇摄影向导'],
      license: { code: '91220200DEMO0000XA', number: '示例登记号', validUntil: '2027-12-31' },
      qualifications: [
        { name: '食品经营许可证', issuer: '示例：区市场监管局' },
        { name: '消防安全检查合格证', issuer: '示例：区消防救援大队' }
      ],
      docs: blankDocs(),
      updatedAt: nowISO()
    };
  }

  function loadMerchant() {
    var stored = read(KEYS.merchant, null);
    if (stored && typeof stored === 'object' && stored.id) {
      if (!Array.isArray(stored.docs) || !stored.docs.length) stored.docs = blankDocs();
      if (!Array.isArray(stored.specialties)) stored.specialties = [];
      if (!Array.isArray(stored.qualifications)) stored.qualifications = [];
      if (!stored.license) stored.license = { code: '', number: '', validUntil: '' };
      return stored;
    }
    return blankMerchant();
  }

  function saveMerchant(patch) {
    var current = loadMerchant();
    var next = Object.assign({}, current, patch || {}, { updatedAt: nowISO(), demo: false });
    write(KEYS.merchant, next);
    emit('merchant:changed', next);
    return next;
  }

  var REQUIRED_FIELDS = ['name', 'contact', 'phone', 'type', 'address', 'license.code', 'license.number', 'license.validUntil'];

  function getPath(obj, path) {
    return path.split('.').reduce(function (o, k) { return o && o[k]; }, obj);
  }

  function completion() {
    var m = loadMerchant();
    var filled = REQUIRED_FIELDS.filter(function (path) {
      var v = getPath(m, path);
      return v != null && String(v).trim() !== '';
    }).length;
    if (m.specialties && m.specialties.length) filled += 1;
    if (m.qualifications && m.qualifications.length) filled += 1;
    var docFilled = (m.docs || []).filter(function (d) { return d.status !== 'missing'; }).length;
    var total = REQUIRED_FIELDS.length + 2 + (m.docs || []).length;
    var done = filled + docFilled;
    return { filled: done, total: total, percent: Math.round((done / total) * 100) };
  }

  /* ── 问题（商户 → 政府） ───────────────────────────────── */

  function loadIssues() {
    var list = read(KEYS.issues, []);
    return Array.isArray(list) ? list : [];
  }

  function saveIssues(list) {
    write(KEYS.issues, list);
    emit('issues:changed', list);
  }

  function addIssue(payload) {
    var item = {
      id: uid('issue'),
      merchantId: loadMerchant().id,
      merchantName: loadMerchant().name,
      category: payload.category,
      categoryLabel: (ISSUE_CATEGORIES.filter(function (c) { return c.id === payload.category; })[0] || {}).label || payload.category,
      title: String(payload.title || '').trim().slice(0, 60),
      detail: String(payload.detail || '').trim().slice(0, 600),
      location: String(payload.location || '').trim().slice(0, 80),
      status: 'pending',
      createdAt: nowISO(),
      messages: []
    };
    var list = loadIssues();
    list.unshift(item);
    saveIssues(list);
    return item;
  }

  /* ── 反馈（游客 → 商户 / 政府） ─────────────────────────── */

  function loadFeedback() {
    var list = read(KEYS.feedback, []);
    return Array.isArray(list) ? list : [];
  }

  function saveFeedback(list) {
    write(KEYS.feedback, list);
    emit('feedback:changed', list);
  }

  function addFeedback(payload) {
    var merchant = loadMerchant();
    var item = {
      id: uid('fb'),
      merchantId: merchant.id,
      merchantName: merchant.name,
      category: payload.category,
      text: String(payload.text || '').trim().slice(0, 500),
      fromName: String(payload.fromName || '').trim().slice(0, 20) || '匿名游客',
      status: 'pending',
      createdAt: nowISO(),
      messages: []
    };
    var list = loadFeedback();
    list.unshift(item);
    saveFeedback(list);
    return item;
  }

  function replyFeedback(id, role, text) {
    var body = String(text || '').trim().slice(0, 400);
    if (!body) return null;
    var list = loadFeedback();
    var hit = list.filter(function (x) { return x.id === id; })[0];
    if (!hit) return null;
    hit.messages = hit.messages || [];
    hit.messages.push({ role: role, text: body, at: nowISO() });
    hit.status = 'answered';
    saveFeedback(list);
    return hit;
  }

  function replyIssue(id, role, text) {
    var body = String(text || '').trim().slice(0, 400);
    if (!body) return null;
    var list = loadIssues();
    var hit = list.filter(function (x) { return x.id === id; })[0];
    if (!hit) return null;
    hit.messages = hit.messages || [];
    hit.messages.push({ role: role, text: body, at: nowISO() });
    hit.status = 'replied';
    saveIssues(list);
    return hit;
  }

  function setDocStatus(docId, status) {
    if (!DOC_STATUS[status]) return false;
    var m = loadMerchant();
    var hit = (m.docs || []).filter(function (d) { return d.id === docId; })[0];
    if (!hit) return false;
    hit.status = status;
    hit.updatedAt = nowISO();
    saveMerchant({ docs: m.docs });
    return true;
  }

  /* ── 政府端接入点 ──────────────────────────────────────── */

  var adapters = [];

  var government = {
    /** 政府端待办：问题 + 反馈，按时间倒序。 */
    inbox: function () {
      var issues = loadIssues().map(function (x) { return Object.assign({ type: 'issue', typeLabel: '商户问题' }, x); });
      var feedback = loadFeedback().map(function (x) { return Object.assign({ type: 'feedback', typeLabel: '游客反馈' }, x); });
      return issues.concat(feedback).sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
    },
    /** 以政府身份答复：写回同一份本地数据，商户端与游客端会收到变更事件。 */
    reply: function (type, id, text) {
      return type === 'issue' ? replyIssue(id, 'government', text) : replyFeedback(id, 'government', text);
    },
    /**
     * 供政府端注册自己的处理器（可选）。
     * 别的页面通过 storage 事件感知变更；同一页面可直接用 adapter。
     */
    register: function (adapter) {
      if (typeof adapter === 'function') adapters.push(adapter);
      return adapters.length;
    },
    counts: function () {
      var inbox = government.inbox();
      return {
        total: inbox.length,
        pending: inbox.filter(function (x) { return x.status === 'pending'; }).length
      };
    }
  };

  function notifyAdapters(event, payload) {
    adapters.forEach(function (fn) {
      try { fn(event, payload); } catch (e) { /* 适配器出错不应影响页面 */ }
    });
  }

  /** 订阅跨页面变更（同源的另外两个端写入时触发）。 */
  function onChange(callback) {
    if (typeof callback !== 'function') return function () {};
    var handler = function (event) {
      if (event && event.key && Object.keys(KEYS).every(function (k) { return KEYS[k] !== event.key; })) return;
      callback(event);
    };
    global.addEventListener('storage', handler);
    ['merchant:changed', 'issues:changed', 'feedback:changed'].forEach(function (name) {
      global.addEventListener('jzzx-portal:' + name, function (e) { callback({ type: name, detail: e.detail }); });
    });
    return function () { global.removeEventListener('storage', handler); };
  }

  var api = {
    VERSION: VERSION,
    KEYS: KEYS,
    ROLE_KEY: ROLE_KEY,
    ROLES: ROLES,
    ISSUE_CATEGORIES: ISSUE_CATEGORIES,
    FEEDBACK_CATEGORIES: FEEDBACK_CATEGORIES,
    DOC_TYPES: DOC_TYPES,
    DOC_STATUS: DOC_STATUS,
    BUSINESS_TYPES: BUSINESS_TYPES,
    utils: { esc: esc, fmtDate: fmtDate, maskLicense: maskLicense, uid: uid },
    merchant: {
      get: loadMerchant,
      save: saveMerchant,
      completion: completion,
      blank: blankMerchant
    },
    docs: {
      list: function () { return loadMerchant().docs || []; },
      setStatus: setDocStatus
    },
    issues: {
      list: loadIssues,
      add: function (payload) { var item = addIssue(payload); notifyAdapters('issue:created', item); return item; },
      reply: function (id, role, text) { var item = replyIssue(id, role, text); notifyAdapters('issue:replied', item); return item; },
      counts: function () {
        var list = loadIssues();
        return { total: list.length, pending: list.filter(function (x) { return x.status === 'pending'; }).length };
      }
    },
    feedback: {
      list: loadFeedback,
      add: function (payload) { var item = addFeedback(payload); notifyAdapters('feedback:created', item); return item; },
      reply: function (id, role, text) { var item = replyFeedback(id, role, text); notifyAdapters('feedback:replied', item); return item; },
      counts: function () {
        var list = loadFeedback();
        return { total: list.length, pending: list.filter(function (x) { return x.status === 'pending'; }).length };
      }
    },
    government: government,
    onChange: onChange,
    reset: function () {
      try {
        Object.keys(KEYS).forEach(function (k) { global.localStorage.removeItem(KEYS[k]); });
      } catch (e) { /* 忽略 */ }
      emit('merchant:changed', loadMerchant());
    }
  };

  global.JZZXPortal = api;
})(typeof window !== 'undefined' ? window : globalThis);
