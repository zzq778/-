/**
 * 行程编排测试（D4 A 线）
 *
 * 关注四件事：天数对不对、节点有没有重复、依据/来源齐不齐、提醒是否说到点子上。
 * 另外守住一条底线：编排出来的文本必须能过校验（guard），否则界面展示就会带风险。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseIntent } from '../src/wenlv/intent.mjs';
import { retrieve } from '../src/wenlv/search.mjs';
import { buildItinerary, describeItinerary, MAX_DAYS, NODES_PER_DAY, SLOTS } from '../src/wenlv/plan.mjs';
import { guardAnswer, buildFacts } from '../src/wenlv/guard.mjs';
import { isOfficialUrl } from '../src/wenlv/schema.mjs';

const NOW = new Date('2026-11-17T10:00:00+08:00');

function plan(text, options) {
  const intent = parseIntent(text, { now: NOW });
  const result = retrieve(intent);
  return { intent, result, itinerary: buildItinerary(intent, result, options) };
}

const nodesOf = (itinerary) => itinerary.plan.flatMap((d) => d.nodes);

test('两天亲子：生成两天，每天不超过三个节点', () => {
  const { itinerary } = plan('两天冬天带孩子去哪');
  assert.equal(itinerary.days, 2);
  assert.equal(itinerary.plan.length, 2);
  for (const day of itinerary.plan) {
    assert.ok(day.nodes.length >= 1 && day.nodes.length <= NODES_PER_DAY);
    assert.match(day.title, /^第 \d 天/);
  }
});

test('一日游只排一天', () => {
  const { itinerary } = plan('长春一日游');
  assert.equal(itinerary.days, 1);
  assert.equal(itinerary.plan.length, 1);
});

test('天数上限：要求五天也只排三天', () => {
  const { intent, result } = plan('五天');
  const itinerary = buildItinerary(intent, result, { days: 5 });
  assert.equal(itinerary.days, MAX_DAYS);
});

test('有匹配线路时用线路当骨架', () => {
  const { itinerary } = plan('两天冬天去长白山');
  assert.equal(itinerary.sourceRouteId, 'changbaishan-north-2d');
  assert.equal(itinerary.plan[0].nodes[0].slot, '上午');
});

test('节点不重复，且每个节点都有 why 与来源', () => {
  const { itinerary } = plan('两天冬天带孩子去哪');
  const nodes = nodesOf(itinerary);
  assert.equal(new Set(nodes.map((n) => n.attractionId)).size, nodes.length);
  for (const node of nodes) {
    assert.ok(node.why && node.why.length >= 2, `${node.name} 缺 why`);
    assert.ok(Array.isArray(node.sources) && node.sources.length >= 1, `${node.name} 缺来源`);
  }
});

test('槽位顺序固定为上午 / 午后 / 傍晚', () => {
  const { itinerary } = plan('三天去延边');
  for (const day of itinerary.plan) {
    const slots = day.nodes.map((n) => n.slot);
    assert.deepEqual(slots, SLOTS.slice(0, slots.length));
  }
});

test('来源全部是官方域名，且已去重', () => {
  const { itinerary } = plan('两天冬天带孩子去哪');
  const urls = itinerary.sources.map((s) => s.url);
  assert.equal(new Set(urls).size, urls.length);
  for (const url of urls) assert.ok(isOfficialUrl(url), `${url} 不是官方域名`);
});

test('跨片区要给出转场提醒', () => {
  const { itinerary } = plan('两天冬天带孩子去哪');
  const types = itinerary.warnings.map((w) => w.type);
  assert.ok(types.includes('cross-cluster'));
});

test('季节不符的景点要被点名提醒', () => {
  const { itinerary } = plan('12月去查干湖看冬捕');
  const mismatch = itinerary.warnings.find((w) => w.type === 'season-mismatch');
  assert.ok(mismatch, '应提示季节不符');
  assert.match(mismatch.message, /不是这个季节的首选/);
});

test('时间与票价为 null 时统一提示以官方为准', () => {
  const { itinerary } = plan('12月去查干湖看冬捕');
  const warning = itinerary.warnings.find((w) => w.type === 'unsourced-facts');
  assert.ok(warning);
  assert.match(warning.message, /官方公告为准/);
});

test('没抓到条件时走兜底并提示追问', () => {
  const { itinerary } = plan('');
  assert.ok(itinerary.warnings.some((w) => w.type === 'fallback'));
  assert.ok(nodesOf(itinerary).length >= 1);
});

test('同样的输入得到同样的行程（可复现）', () => {
  const a = plan('两天冬天带孩子去哪').itinerary;
  const b = plan('两天冬天带孩子去哪').itinerary;
  assert.deepEqual(a, b);
});

test('行程文本能通过校验，不需要人工再改一遍', () => {
  const { itinerary } = plan('两天冬天带孩子去哪');
  const draft = describeItinerary(itinerary);
  const verdict = guardAnswer(draft, buildFacts(itinerary));
  assert.equal(verdict.ok, true, JSON.stringify(verdict.issues));
});

test('文本里包含天标题与节点名，便于展示与朗读', () => {
  const { itinerary } = plan('两天冬天带孩子去哪');
  const text = describeItinerary(itinerary);
  assert.match(text, /2 天行程/);
  assert.match(text, /第 1 天/);
  for (const node of nodesOf(itinerary)) assert.ok(text.includes(node.name));
});
