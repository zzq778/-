// 政府端逻辑测试：gov-logic.js 是纯函数，直接在 vm 里加载，不需要浏览器。
// 覆盖统计、筛选、草稿、证件队列、时令、导出与静态接线。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = new URL('../public/', import.meta.url);
const read = (p) => readFileSync(fileURLToPath(new URL(p, ROOT)), 'utf8');
const exists = (p) => existsSync(fileURLToPath(new URL(p, ROOT)));

const LOGIC = read('portals/government/gov-logic.js');
const GOV_JS = read('portals/government/government.js');
const GOV_HTML = read('portals/government/index.html');
const GOV_CSS = read('portals/government/government.css');
const SW = read('sw.js');

function loadLogic() {
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(LOGIC, sandbox, { filename: 'gov-logic.js' });
  return sandbox.JZZXGovLogic;
}

const L = loadLogic();
const NOW = Date.parse('2026-11-17T20:00:00+08:00');

function at(hoursAgo) {
  return new Date(NOW - hoursAgo * 3600 * 1000).toISOString();
}

function issue(over) {
  return Object.assign({
    type: 'issue', id: 'i-' + Math.random().toString(36).slice(2, 8),
    category: 'traffic', categoryLabel: '交通与停车问题', merchantName: '雾凇岛人家',
    title: '停车场入口积水', location: '韩屯村东侧', status: 'pending',
    createdAt: at(10), messages: []
  }, over || {});
}

function feedback(over) {
  return Object.assign({
    type: 'feedback', id: 'f-' + Math.random().toString(36).slice(2, 8),
    category: '服务态度', text: '停车引导不清楚', fromName: '游客 A',
    status: 'pending', createdAt: at(2), messages: []
  }, over || {});
}

test('逻辑层导出政府端需要的函数', () => {
  for (const key of ['stats', 'filter', 'categoryOptions', 'drafts', 'draft', 'docQueue', 'seasonal', 'toCsv', 'reportText', 'isOverdue', 'isDone', 'waitingHours', 'fmtDuration']) {
    assert.equal(typeof L[key], 'function', `缺少 ${key}`);
  }
  assert.equal(L.OVERDUE_HOURS, 24);
});

test('逾期判定：待处理超 24 小时才算，已答复不算', () => {
  assert.equal(L.isOverdue(issue({ createdAt: at(25) }), NOW), true);
  assert.equal(L.isOverdue(issue({ createdAt: at(23) }), NOW), false);
  assert.equal(L.isOverdue(issue({ createdAt: at(48), status: 'replied' }), NOW), false);
  assert.equal(L.isOverdue(issue({ createdAt: '' }), NOW), false);
});

test('统计：待处理/已答复/逾期/答复率/平均首答', () => {
  const items = [
    issue({ createdAt: at(20), status: 'replied', messages: [{ role: 'government', text: 'ok', at: at(18) }] }),
    issue({ createdAt: at(30) }),
    feedback({ createdAt: at(1) })
  ];
  const s = L.stats(items, NOW);
  assert.equal(s.total, 3);
  assert.equal(s.pending, 2);
  assert.equal(s.done, 1);
  assert.equal(s.overdue, 1);
  assert.equal(s.replyRate, 33);
  assert.equal(s.avgReplyHours, 2);
  assert.equal(s.byType.issue.total, 2);
  assert.equal(s.byType.feedback.pending, 1);
});

test('按类别统计按数量降序，并带待处理数', () => {
  const s = L.stats([
    issue({ category: 'traffic', categoryLabel: '交通与停车问题' }),
    issue({ category: 'traffic', categoryLabel: '交通与停车问题' }),
    issue({ category: 'infra', categoryLabel: '基础设施问题', status: 'replied' }),
    feedback({ category: '服务态度', categoryLabel: '服务态度' })
  ], NOW);
  assert.equal(s.byCategory[0].label, '交通与停车问题');
  assert.equal(s.byCategory[0].count, 2);
  assert.equal(s.byCategory[0].pending, 2);
  assert.equal(s.byCategory.length, 3);
});

test('近 7 天按日统计，末位是今天', () => {
  const s = L.stats([issue({ createdAt: at(2) }), issue({ createdAt: at(2) })], NOW);
  assert.equal(s.byDay.length, 7);
  assert.equal(s.byDay[6].label, '11-17');
  assert.equal(s.byDay[6].count, 2);
});

test('筛选：状态 / 类型 / 类别 / 关键词', () => {
  const items = [
    issue({ id: 'a', title: '停车场入口积水' }),
    issue({ id: 'b', title: '指示牌缺失', status: 'replied', messages: [{ role: 'government', text: 'ok', at: at(1) }] }),
    feedback({ id: 'c', text: '停车引导不清楚' })
  ];
  assert.equal(L.filter(items, { status: 'pending' }).length, 2);
  assert.equal(L.filter(items, { status: 'done' }).length, 1);
  assert.equal(L.filter(items, { type: 'feedback' }).length, 1);
  assert.equal(L.filter(items, { category: '交通与停车问题' }).length, 2);
  assert.equal(L.filter(items, { q: '积水' }).length, 1, '关键词应命中标题');
  assert.equal(L.filter(items, { q: '停车' }).length, 3, '关键词也命中类别名，所以三条都在');
  assert.equal(L.filter(items, {}).length, 3);
});

test('类别选项带计数并降序', () => {
  const opts = L.categoryOptions([
    issue({ category: 'infra', categoryLabel: '基础设施问题' }),
    issue({ category: 'infra', categoryLabel: '基础设施问题' }),
    feedback({ category: '服务态度', categoryLabel: '服务态度' })
  ]);
  assert.deepEqual([...opts.map((o) => o.label)], ['基础设施问题', '服务态度']);
  assert.equal(opts[0].count, 2);
});

test('草稿：6 类问题 + 游客反馈都能给出三条，且不写死时限/金额/文号', () => {
  const cats = ['infra', 'traffic', 'environment', 'site', 'policy', 'event'];
  for (const category of cats) {
    const list = L.drafts(issue({ category }));
    assert.equal(list.length, 3, `${category} 应有 3 条草稿`);
    assert.deepEqual([...list.map((d) => d.id)], ['accept', 'assign', 'more']);
    for (const d of list) {
      assert.ok(d.text.length > 20, `${category}/${d.id} 草稿过短`);
      assert.doesNotMatch(d.text, /保证|一定|当天|天内|工作日|¥|\d+\s*元|第?\d+号/, `${category}/${d.id} 出现不该有的承诺或数字`);
    }
  }
  const fb = L.drafts(feedback({}));
  assert.equal(fb.length, 3);
  assert.match(fb[0].text, /反馈/);
});

test('draft 等于第一条草稿，未知类别回落到基础设施', () => {
  const item = issue({ category: 'unknown' });
  assert.equal(L.draft(item), L.drafts(item)[0].text);
  assert.match(L.draft(item), /基础设施/);
});

test('证件队列：状态计数、待审数、通过率', () => {
  const q = L.docQueue([
    { id: 'license', status: 'approved', updatedAt: at(5) },
    { id: 'food', status: 'submitted', updatedAt: at(3) },
    { id: 'health', status: 'missing' },
    { id: 'fire', status: 'rejected', updatedAt: at(1) },
    { id: 'special', status: 'missing' }
  ], { license: '营业执照', food: '食品经营许可证', health: '公共场所卫生许可证', fire: '消防安全检查合格证', special: '特种行业许可证' });
  assert.equal(q.counts.approved, 1);
  assert.equal(q.counts.submitted, 1);
  assert.equal(q.counts.missing, 2);
  assert.equal(q.pending, 1);
  assert.equal(q.percent, 40);
  assert.equal(q.items[1].label, '食品经营许可证');
  assert.equal(q.items[1].statusLabel, '待审核');
});

test('本月时令按月份过滤，按名称排序', () => {
  const events = [
    { id: 'a', name: '查干湖冬捕', months: [12, 1], window: '12 月—次年 1 月', type: '节庆' },
    { id: 'b', name: '吉林雾凇观赏期', months: [12, 1, 2], window: '12 月—次年 2 月', type: '冰雪' },
    { id: 'c', name: '长白山天池开放季', months: [6, 7, 8, 9], window: '6—9 月', type: '景致' }
  ];
  const vs = L.seasonal(events, 1);
  assert.equal(vs.length, 2);
  assert.deepEqual(vs.map((e) => e.name).sort(), ['吉林雾凇观赏期', '查干湖冬捕'].sort());
  assert.equal(L.seasonal(events, 11).length, 0);
});

test('CSV：表头齐全，逗号与引号被转义', () => {
  const csv = L.toCsv([issue({ title: '积水, 影响"进出"' })], NOW);
  const lines = csv.split('\r\n');
  assert.equal(lines[0], '类型,类别,标题,状态,提交时间,等待时长,答复条数,来源');
  assert.ok(lines[1].startsWith('商户问题,'));
  assert.ok(lines[1].includes('"积水, 影响""进出"""'), '逗号与引号应被转义');
  assert.equal(lines.length, 2);
});

test('摘要文本包含统计与数据边界说明', () => {
  const text = L.reportText([issue({ createdAt: at(30) })], NOW);
  assert.match(text, /全部 1 条/);
  assert.match(text, /待处理 1 条/);
  assert.match(text, /逾期 1 条/);
  assert.match(text, /localStorage/);
});

test('等待时长文案与空数据兜底', () => {
  assert.match(L.fmtDuration(0.4), /不到 1 小时/);
  assert.match(L.fmtDuration(5), /5 小时/);
  assert.match(L.fmtDuration(30), /1 天/);
  const empty = L.stats([], NOW);
  assert.equal(empty.total, 0);
  assert.equal(empty.replyRate, 0);
  assert.equal(empty.byCategory.length, 0);
  assert.equal(L.toCsv([], NOW).split('\r\n').length, 1);
});

test('政府端页面文件齐全，串行加载顺序正确', () => {
  for (const p of ['portals/government/index.html', 'portals/government/government.js', 'portals/government/gov-logic.js', 'portals/government/government.css']) {
    assert.ok(exists(p), `缺少 ${p}`);
  }
  assert.match(GOV_HTML, /\.\.\/shared\/portal\.css/);
  assert.match(GOV_HTML, /\.\/government\.css/);
  const order = ['portal-core.js', 'gov-logic.js', 'government.js'].map((s) => GOV_HTML.indexOf(s));
  assert.ok(order.every((i) => i > -1), '脚本未全部引入');
  assert.deepEqual([...order].sort((a, b) => a - b), order, '脚本顺序应为 core → logic → page');
  assert.match(GOV_HTML, /wenlv-data\.js/, '未引入文旅知识库');
});

test('政府端只用接入点，且保留「待接入」说明', () => {
  for (const api of ['government.inbox(', 'government.reply(', 'government.register(', 'government.counts(', 'onChange(']) {
    assert.ok(GOV_JS.includes(api), `未使用 ${api}`);
  }
  assert.match(GOV_JS, /待接入/, '应明确标注真实系统待接入');
  for (const word of ['草稿', '导出', '证件审核', '逾期']) {
    assert.ok(GOV_JS.includes(word), `页面缺少「${word}」`);
  }
  assert.match(GOV_CSS, /\.g-bars/);
});

test('政府端不联网、不读证件编号以外的隐私字段', () => {
  assert.doesNotMatch(GOV_JS, /\bfetch\s*\(/, '政府端应可离线运行');
  assert.doesNotMatch(LOGIC, /\bfetch\s*\(/, '逻辑层不应联网');
  assert.doesNotMatch(GOV_JS, /license\.code/, '页面不应输出完整执照编号');
  assert.match(SW, /portals\/government\/gov-logic\.js/);
  assert.match(SW, /portals\/government\/government\.css/);
});
