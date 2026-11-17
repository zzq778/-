import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  FACT_KEYS, FACT_LABELS, factsOf, factState, verifiedKeys, isFullyVerified,
  coverage, queue, factNumbers, factTimes, factsForNodes, describeFact, FACT_STATE
} from '../src/wenlv/facts.mjs';
import { ATTRACTIONS, byId } from '../src/wenlv/attractions.mjs';
import { parseIntent } from '../src/wenlv/intent.mjs';
import { retrieve } from '../src/wenlv/search.mjs';
import { buildItinerary } from '../src/wenlv/plan.mjs';
import { buildFacts, guardAnswer, ISSUE } from '../src/wenlv/guard.mjs';

const ROOT = new URL('..', import.meta.url);
const jingyuetan = byId('jingyuetan');

/** 把 public 下的浏览器脚本装进一个假 window，便于在 Node 里断言渲染结果。 */
function loadInSandbox(files, seed) {
  const win = seed || {};
  for (const file of files) {
    const code = readFileSync(new URL(`../public/${file}`, import.meta.url), 'utf8');
    new Function('window', 'localStorage', 'document', code)(win, win.localStorage || null, win.document || {});
  }
  return win;
}

test('事实层：三条事实键与中文标签齐全', () => {
  assert.deepEqual([...FACT_KEYS], ['hours', 'ticket', 'booking']);
  assert.equal(FACT_LABELS.hours, '开放时间');
  assert.equal(FACT_LABELS.ticket, '票价');
  assert.equal(FACT_LABELS.booking, '预约方式');
});

test('事实层：null 表示未核对，不是 0 也不是免费', () => {
  const entry = { hours: null, ticket: '', booking: '   ' };
  assert.deepEqual(factsOf(entry), { hours: null, ticket: null, booking: null });
  assert.equal(factState(entry, 'hours'), FACT_STATE.MISSING);
  assert.deepEqual(verifiedKeys(entry), []);
  assert.equal(isFullyVerified(entry), false);
  assert.equal(describeFact(entry, 'ticket'), '未核对，以官方公布为准');
});

test('事实层：净月潭已写入官方开放时间与票价', () => {
  assert.ok(jingyuetan, '净月潭条目应存在');
  assert.equal(jingyuetan.hours.includes('06:00'), true);
  assert.equal(jingyuetan.ticket.includes('30 元'), true);
  assert.equal(jingyuetan.booking.includes('小程序'), true);
  assert.deepEqual(verifiedKeys(jingyuetan), ['hours', 'ticket', 'booking']);
  assert.equal(isFullyVerified(jingyuetan), true);
  assert.equal(jingyuetan.verifiedAt, '2026-11-17');
  assert.ok(jingyuetan.sources.some((s) => s.url.includes('piaowuxinxi')));
});

test('覆盖率：40 条里恰好 1 条全核、5 条至少核过一项', () => {
  const cover = coverage(ATTRACTIONS);
  assert.equal(cover.total, 40);
  assert.equal(cover.hours, 1);
  assert.equal(cover.ticket, 1);
  assert.equal(cover.booking, 5);
  assert.equal(cover.any, 5);
  assert.equal(cover.full, 1);
  assert.equal(cover.percent, 13);
});

test('待核队列：缺得多的排前面，且带来源给人工核对', () => {
  const todo = queue(ATTRACTIONS);
  assert.equal(todo.length, 39);
  assert.ok(todo[0].missing.length >= 3);
  const last = todo[todo.length - 1];
  assert.ok(last.missing.length <= todo[0].missing.length);
  for (const item of todo.slice(0, 5)) {
    assert.ok(item.name && item.area);
    assert.equal(typeof item.source === 'string' || item.source === null, true);
  }
  assert.equal(todo.some((x) => x.id === 'jingyuetan'), false);
});

test('事实数字：票价能取出 30 与 15，供 guard 放行', () => {
  const nums = factNumbers(jingyuetan);
  assert.ok(nums.includes('30'));
  assert.ok(nums.includes('15'));
  assert.equal(nums.some((n) => Number.isNaN(Number(n))), false);
});

test('事实时刻：06:00 与 8:30 同时给出补零与不补零写法', () => {
  const times = factTimes(jingyuetan);
  assert.ok(times.includes('06:00'));
  assert.ok(times.includes('19:00'));
  assert.ok(times.includes('8:30'));
  assert.ok(times.includes('08:30'));
  assert.ok(times.includes('16:30'));
});

test('factsForNodes：从行程节点汇总允许说出口的数字与时刻', () => {
  const facts = factsForNodes([
    { facts: { hours: '8:30 开园', ticket: '30 元/人', booking: null } },
    { facts: { hours: null, ticket: '20 元', booking: null } }
  ]);
  assert.deepEqual(facts.numbers.sort(), ['20', '30']);
  assert.ok(facts.times.includes('8:30'));
  assert.ok(facts.times.includes('08:30'));
});

test('guard：说得出口的票价与时刻放行，库外的照旧拦下', () => {
  const intent = parseIntent('两天，去净月潭看看');
  const itinerary = buildItinerary(intent, retrieve(intent));
  const facts = buildFacts(itinerary);
  const nodes = itinerary.plan.flatMap((d) => d.nodes);
  const node = nodes.find((n) => n.attractionId === 'jingyuetan');

  if (node) {
    const okResult = guardAnswer('净月潭 06:00 开园，成人票 30 元', facts);
    assert.equal(okResult.issues.length, 0, JSON.stringify(okResult.issues));
  }

  const bad = guardAnswer('净月潭门票 99 元，09:15 开门', facts);
  assert.ok(bad.issues.some((i) => i.type === ISSUE.PRICE));
  assert.ok(bad.issues.some((i) => i.type === ISSUE.TIME));
});

test('行程节点带事实三件套，界面才有东西可展示', () => {
  const intent = parseIntent('长春两日，想去净月潭');
  const itinerary = buildItinerary(intent, retrieve(intent));
  const nodes = itinerary.plan.flatMap((d) => d.nodes);
  for (const node of nodes) {
    assert.equal(typeof node.facts, 'object');
    assert.deepEqual(Object.keys(node.facts).sort(), ['booking', 'hours', 'ticket']);
  }
  const target = nodes.find((n) => n.attractionId === 'jingyuetan');
  assert.ok(target, '净月潭应该进入行程');
  assert.equal(target.facts.ticket.includes('30 元'), true);
  assert.equal(target.hours.includes('06:00'), true);
});

test('页面：卡片渲染三行事实，已核显示原文、未核显示未核对', () => {
  const win = loadInSandbox(['wenlv-data.js', 'wenlv-ui.js'], {});
  const ui = win.WENLV_UI;
  assert.ok(ui, 'WENLV_UI 应挂到 window 上');

  const html = ui.factRows({ hours: '06:00 开园', ticket: '30 元/人', booking: null });
  assert.equal(html.includes('06:00 开园'), true);
  assert.equal(html.includes('30 元/人'), true);
  assert.equal(html.includes('未核对'), true);
  assert.equal(html.includes('class="fact missing"'), true);

  const card = ui.attractionCard(win.WENLV.attractions.find((a) => a.id === 'jingyuetan'), 0);
  assert.equal(card.includes('30 元'), true);
  assert.equal(card.includes('信息有误？'), true);
  assert.equal(card.includes('glyph'), true);
});

test('页面：覆盖率与视觉锚点都是纯展示，不编数字', () => {
  const win = loadInSandbox(['wenlv-data.js', 'wenlv-ui.js'], {});
  const cover = win.WENLV_UI.coverage();
  assert.equal(cover.total, 40);
  assert.equal(cover.hours, 1);
  assert.equal(cover.percent, 13);
  const accent = win.WENLV_UI.accentOf('changbaishan');
  assert.equal(typeof accent.glyph, 'string');
  assert.match(accent.tone, /^#[0-9a-f]{6}$/i);
});

test('纠错闭环：页面提交写进政府端待办队列', () => {
  const store = new Map();
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v))
  };
  const win = loadInSandbox(['wenlv-data.js', 'wenlv-ui.js'], { localStorage });
  const entry = win.WENLV.attractions.find((a) => a.id === 'jingyuetan');

  const empty = win.WENLV_UI.reportFix(entry, '   ');
  assert.equal(empty.ok, false);
  assert.equal(empty.reason, 'empty');

  const result = win.WENLV_UI.reportFix(entry, '开放时间已改成 7:00 开园');
  assert.equal(result.ok, true);
  const saved = JSON.parse(store.get('jzzx-portal-v1:issues'));
  assert.equal(saved.length, 1);
  assert.equal(saved[0].categoryLabel, '知识库纠错');
  assert.equal(saved[0].status, 'pending');
  assert.equal(saved[0].title.includes('净月潭'), true);
  assert.equal(saved[0].detail.includes('7:00'), true);
});

test('纠错闭环：有政府端 core 时走 core 的 issues.add', () => {
  const calls = [];
  const win = loadInSandbox(['wenlv-data.js', 'wenlv-ui.js'], {
    JZZX_PORTAL: { issues: { add: (payload) => { calls.push(payload); return { id: 'issue_x', ...payload }; } } }
  });
  const entry = win.WENLV.attractions[0];
  const result = win.WENLV_UI.reportFix(entry, '票价对不上');
  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].category, 'data');
  assert.equal(calls[0].title.includes('知识库纠错'), true);
});

test('数据文件包含已核事实，防止生成物与源码脱节', () => {
  const code = readFileSync(new URL('../public/wenlv-data.js', import.meta.url), 'utf8');
  assert.equal(code.includes('piaowuxinxi'), true);
  const win = loadInSandbox(['wenlv-data.js'], {});
  const entry = win.WENLV.attractions.find((a) => a.id === 'jingyuetan');
  assert.equal(entry.hours.includes('06:00'), true);
  assert.equal(entry.ticket.includes('30 元'), true);
});

test('待核队列文档存在且带说明，便于交给人工', () => {
  const doc = readFileSync(new URL('docs/WENLV_FACTS_QUEUE.md', ROOT), 'utf8');
  assert.equal(doc.includes('文旅事实待核队列'), true);
  assert.equal(doc.includes('净月潭'), false, '全核的景点不应出现在待核表');
  assert.equal(doc.includes('未核对'), true);
  assert.equal(doc.includes('| 景点 | 市州 | 缺项 | 来源 |'), true);
});
