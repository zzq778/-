/**
 * 政府端 · 纯逻辑层（无 DOM，可在 Node 里直接测）
 *
 * 为什么单独拆出来：
 * - 统计、筛选、草稿、导出这些规则是政府端真正要评审的部分，塞进 render 里就测不了；
 * - 这里只做「进出都是普通对象」的计算，页面层（government.js）负责渲染与事件；
 * - 不碰网络、不碰 localStorage、不碰 window，换成真实接口时这一层可以原样复用。
 *
 * 数据来源仍是 JZZXPortal.government.inbox() 的条目形状：
 *   { type:'issue'|'feedback', id, category, categoryLabel, title|text,
 *     status:'pending'|'replied'|'answered', createdAt, messages:[{role,text,at}] }
 */
(function (global) {
  'use strict';

  var HOUR = 3600 * 1000;
  var OVERDUE_HOURS = 24;

  /** 商户问题 6 类（与 portal-core.js 的 ISSUE_CATEGORIES 对应，仅用于草稿选择）。 */
  var DRAFT_BY_CATEGORY = {
    infra: {
      accept: '已收到您反映的基础设施问题，材料已登记并转交属地文旅部门核实。如需补充现场照片或说明，可直接在本条下回复。',
      assign: '该基础设施问题已按属地管理职责转办，核实结果会同步在本条下。处理期间如现场情况变化，可继续补充。',
      more: '为便于核实，请补充具体点位、出现时间与现场照片；补充后我们会一并转办。'
    },
    traffic: {
      accept: '您反映的交通与停车问题已登记，将按职责分工转相关管理部门核实。如后续有新的时段或点位信息，可继续补充。',
      assign: '交通与停车问题已转相关管理部门，涉及临时管控或施工调整的，以现场公告为准。',
      more: '请补充具体路段、拥堵时段与涉及的停车场名称，便于转办时定位。'
    },
    environment: {
      accept: '关于景区周边环境问题的反映已登记，将转属地管理部门核实整改。',
      assign: '该环境问题已转属地管理部门，整改情况会同步在本条下。',
      more: '请补充具体位置与影响范围（如噪声时段、垃圾堆放点），便于现场核查。'
    },
    site: {
      accept: '关于经营场地问题的咨询已登记。具体办理口径以属地主管部门答复为准，本端答复不替代正式审批意见。',
      assign: '场地问题已转属地主管部门，涉及规划、消防或产权的，需由对应部门认定。',
      more: '建议补充场地位置、用途与现有证明材料清单，我们据此确认对接部门。'
    },
    policy: {
      accept: '您的政策咨询已登记。为避免口径偏差，答复不引用未经核实的文件编号与条款；请以省级政务公开渠道发布的原文为准。',
      assign: '政策咨询已转业务处室核对，核实后会补充说明。',
      more: '请补充您关注的经营类型与具体情形（如新办、变更、补贴），便于按事项对接。'
    },
    event: {
      accept: '您提出的文旅活动建议已记录，将纳入活动储备参考。是否采纳需结合季节、场地与安全条件评估。',
      assign: '活动建议已转相关处室评估，评估意见会同步在本条下。',
      more: '请补充建议的活动形式、预计规模与可用场地，便于评估可行性。'
    }
  };

  var DRAFT_FEEDBACK = {
    accept: '感谢您的反馈。已转对应商户核实处理，处理进展会同步在本条反馈下。',
    assign: '该反馈已转属地管理部门与商户共同核实，处理结果会在此更新。',
    more: '请补充发生时间、地点与具体情况，便于核实到具体商户与环节。'
  };

  function num(value) {
    var n = Number(value);
    return isFinite(n) ? n : 0;
  }

  function toTime(iso) {
    var t = new Date(iso == null ? '' : iso).getTime();
    return isNaN(t) ? 0 : t;
  }

  function dayKey(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  function isDone(item) {
    return item && (item.status === 'replied' || item.status === 'answered');
  }

  function isOverdue(item, now) {
    if (!item || isDone(item)) return false;
    var created = toTime(item.createdAt);
    if (!created) return false;
    return (num(now) || Date.now()) - created > OVERDUE_HOURS * HOUR;
  }

  function waitingHours(item, now) {
    var created = toTime(item.createdAt);
    if (!created) return 0;
    var end = isDone(item) ? firstReplyAt(item) || (num(now) || Date.now()) : (num(now) || Date.now());
    return Math.max(0, (end - created) / HOUR);
  }

  function firstReplyAt(item) {
    var list = (item && item.messages) || [];
    for (var i = 0; i < list.length; i += 1) {
      var m = list[i];
      if (m && (m.role === 'government' || m.role === 'merchant')) return toTime(m.at);
    }
    return 0;
  }

  function fmtDuration(hours) {
    var h = num(hours);
    if (h < 1) return '不到 1 小时';
    if (h < 24) return Math.round(h) + ' 小时';
    return Math.round(h / 24) + ' 天';
  }

  /** 一次遍历算出概览需要的全部数字。 */
  function stats(items, now) {
    var list = Array.isArray(items) ? items : [];
    var ref = num(now) || Date.now();
    var out = {
      total: list.length, pending: 0, done: 0, overdue: 0,
      replyRate: 0, avgReplyHours: 0,
      byType: { issue: { total: 0, pending: 0 }, feedback: { total: 0, pending: 0 } },
      byCategory: [], byDay: []
    };
    var catMap = {};
    var catOrder = [];
    var dayMap = {};
    var replyHours = [];

    list.forEach(function (item) {
      var type = item.type === 'feedback' ? 'feedback' : 'issue';
      out.byType[type].total += 1;
      if (isDone(item)) {
        out.done += 1;
        var at = firstReplyAt(item);
        var created = toTime(item.createdAt);
        if (at && created && at >= created) replyHours.push((at - created) / HOUR);
      } else {
        out.pending += 1;
        out.byType[type].pending += 1;
        if (isOverdue(item, ref)) out.overdue += 1;
      }

      var label = item.categoryLabel || item.category || '未分类';
      if (!catMap[label]) { catMap[label] = { key: label, label: label, count: 0, pending: 0 }; catOrder.push(label); }
      catMap[label].count += 1;
      if (!isDone(item)) catMap[label].pending += 1;

      var key = dayKey(item.createdAt);
      if (key) dayMap[key] = (dayMap[key] || 0) + 1;
    });

    out.replyRate = out.total ? Math.round((out.done / out.total) * 100) : 0;
    out.avgReplyHours = replyHours.length
      ? Math.round((replyHours.reduce(function (a, b) { return a + b; }, 0) / replyHours.length) * 10) / 10
      : 0;

    out.byCategory = catOrder.map(function (k) { return catMap[k]; })
      .sort(function (a, b) { return b.count - a.count || a.label.localeCompare(b.label, 'zh'); });

    var days = [];
    for (var i = 6; i >= 0; i -= 1) {
      var d = new Date(ref - i * 24 * HOUR);
      var k = dayKey(d.toISOString());
      days.push({ date: k, label: k.slice(5), count: dayMap[k] || 0 });
    }
    out.byDay = days;
    return out;
  }

  /** 状态 / 类型 / 类别 / 关键词四维筛选，任一为空表示不限。 */
  function filter(items, opt) {
    var o = opt || {};
    var q = String(o.q || '').trim().toLowerCase();
    return (Array.isArray(items) ? items : []).filter(function (item) {
      if (o.status === 'pending' && isDone(item)) return false;
      if (o.status === 'done' && !isDone(item)) return false;
      if (o.type && item.type !== o.type) return false;
      if (o.category && (item.categoryLabel || item.category) !== o.category) return false;
      if (q) {
        var hay = [item.title, item.text, item.detail, item.location, item.merchantName, item.fromName, item.categoryLabel, item.category]
          .filter(Boolean).join(' ').toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function categoryOptions(items) {
    var map = {};
    var order = [];
    (Array.isArray(items) ? items : []).forEach(function (item) {
      var label = item.categoryLabel || item.category || '未分类';
      if (!map[label]) { map[label] = { key: label, label: label, count: 0 }; order.push(label); }
      map[label].count += 1;
    });
    return order.map(function (k) { return map[k]; })
      .sort(function (a, b) { return b.count - a.count || a.label.localeCompare(b.label, 'zh'); });
  }

  function bodyText(item) {
    return String((item && (item.text || item.detail || item.title)) || '').trim();
  }

  /** 三条草稿：受理 / 转办 / 补充材料。都只写流程，不写时限、金额与文号。 */
  function drafts(item) {
    var table = item && item.type === 'feedback' ? DRAFT_FEEDBACK : (DRAFT_BY_CATEGORY[item && item.category] || DRAFT_BY_CATEGORY.infra);
    var where = item && item.location ? '（' + item.location + '）' : '';
    var cat = item && item.type === 'feedback' ? '类别：' + (item.category || '未分类') + '。' : '';
    var wrap = function (text) {
      return cat + text.replace(/\{where\}/g, where).replace(/\{cat\}/g, item && item.category ? item.category : '');
    };
    return [
      { id: 'accept', label: '受理回复', text: wrap(table.accept) },
      { id: 'assign', label: '转办回复', text: wrap(table.assign) },
      { id: 'more', label: '要求补充', text: wrap(table.more) }
    ];
  }

  function draft(item) {
    return drafts(item)[0].text;
  }

  /** 证件队列：按 portal-core 的 5 类证件给出状态与待审数量。 */
  function docQueue(docs, labels) {
    var list = Array.isArray(docs) ? docs : [];
    var out = { items: [], counts: { missing: 0, submitted: 0, approved: 0, rejected: 0 }, pending: 0, percent: 0 };
    var STATUS = { missing: '未提交', submitted: '待审核', approved: '已通过', rejected: '需补正' };
    list.forEach(function (doc) {
      var status = STATUS[doc.status] ? doc.status : 'missing';
      out.counts[status] += 1;
      if (status === 'submitted') out.pending += 1;
      out.items.push({
        id: doc.id,
        label: (labels && labels[doc.id]) || doc.label || doc.id,
        status: status,
        statusLabel: STATUS[status],
        updatedAt: doc.updatedAt || null
      });
    });
    var settled = out.counts.approved + out.counts.rejected;
    out.percent = list.length ? Math.round((settled / list.length) * 100) : 0;
    return out;
  }

  /** 当月时令：政府端值班看板用，数据来自 public/wenlv-data.js 的 calendar。 */
  function seasonal(events, month) {
    var m = num(month) || (new Date().getMonth() + 1);
    return (Array.isArray(events) ? events : []).filter(function (ev) {
      return ev && Array.isArray(ev.months) && ev.months.indexOf(m) !== -1;
    }).map(function (ev) {
      return { id: ev.id, name: ev.name, window: ev.window, why: ev.why, cluster: ev.cluster, type: ev.type };
    }).sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'zh'); });
  }

  function csvCell(value) {
    var s = String(value == null ? '' : value);
    if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function toCsv(items, now) {
    var ref = num(now) || Date.now();
    var head = ['类型', '类别', '标题', '状态', '提交时间', '等待时长', '答复条数', '来源'];
    var rows = (Array.isArray(items) ? items : []).map(function (item) {
      return [
        item.type === 'feedback' ? '游客反馈' : '商户问题',
        item.categoryLabel || item.category || '未分类',
        String(item.title || item.text || '').slice(0, 80),
        isDone(item) ? '已答复' : '待处理',
        item.createdAt || '',
        fmtDuration(waitingHours(item, ref)),
        ((item.messages || []).length),
        item.merchantName || item.fromName || ''
      ].map(csvCell).join(',');
    });
    return [head.map(csvCell).join(',')].concat(rows).join('\r\n');
  }

  function reportText(items, now) {
    var s = stats(items, now);
    var lines = [
      '文旅政府端 · 待办摘要',
      '生成时间：' + new Date(num(now) || Date.now()).toISOString().slice(0, 16).replace('T', ' '),
      '全部 ' + s.total + ' 条，待处理 ' + s.pending + ' 条，已答复 ' + s.done + ' 条，逾期 ' + s.overdue + ' 条。',
      '答复率 ' + s.replyRate + '%，平均首答 ' + (s.avgReplyHours ? fmtDuration(s.avgReplyHours) : '暂无数据') + '。',
      '按类别：' + (s.byCategory.map(function (c) { return c.label + ' ' + c.count; }).join(' / ') || '暂无'),
      '数据来自本机 localStorage，仅用于演示与联调。'
    ];
    return lines.join('\n');
  }

  var api = {
    OVERDUE_HOURS: OVERDUE_HOURS,
    HOUR: HOUR,
    isDone: isDone,
    isOverdue: isOverdue,
    waitingHours: waitingHours,
    fmtDuration: fmtDuration,
    stats: stats,
    filter: filter,
    categoryOptions: categoryOptions,
    drafts: drafts,
    draft: draft,
    bodyText: bodyText,
    docQueue: docQueue,
    seasonal: seasonal,
    toCsv: toCsv,
    reportText: reportText
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.JZZXGovLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);
