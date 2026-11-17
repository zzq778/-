/**
 * 检索与打分测试（D3 A 线）
 *
 * 覆盖：片区/季节/天数如何影响排序、兜底展示、排序稳定性、
 * 理由是否可解释、边界输入不崩。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseIntent } from '../src/wenlv/intent.mjs';
import {
  retrieve, searchAttractions, searchRoutes, searchEvents,
  scoreAttraction, scoreRoute, featuredAttractions
} from '../src/wenlv/search.mjs';
import { byId } from '../src/wenlv/attractions.mjs';
import { routeById } from '../src/wenlv/routes.mjs';

const NOW = new Date('2026-11-17T10:00:00+08:00');
const intent = (text) => parseIntent(text, { now: NOW });

test('兜底：每个片区各挑一条代表，共 10 条且不重复', () => {
  const picks = featuredAttractions();
  assert.equal(picks.length, 10);
  assert.equal(new Set(picks.map((a) => a.id)).size, 10);
  assert.equal(new Set(picks.map((a) => a.cluster)).size, 10);
});

test('没说条件时走兜底，并给出追问提示', () => {
  const r = retrieve(intent(''));
  assert.equal(r.fallback, true);
  assert.equal(r.attractions.length, 6);
  assert.match(r.note, /几天/);
  assert.ok(r.attractions.every((a) => a.reasons.includes('片区代表')));
});

test('长白山两天冬天：线路首选北坡两日，景点集中在长白山片区', () => {
  const r = retrieve(intent('两天冬天去长白山'));
  assert.equal(r.fallback, false);
  assert.equal(r.routes[0].id, 'changbaishan-north-2d');
  assert.equal(r.attractions[0].cluster, 'changbaishan');
});

test('查干湖冬捕：一日冬捕线路排第一', () => {
  const r = retrieve(intent('12月去查干湖看冬捕'));
  assert.equal(r.routes[0].id, 'chaganhu-winter-1d');
  assert.equal(r.attractions[0].cluster, 'chaganhu');
});

test('季节不符要扣分：雾凇岛冬天应高于夏天', () => {
  const a = byId('wusongdao');
  const winter = scoreAttraction(a, intent('冬天去雾凇岛'));
  const summer = scoreAttraction(a, intent('夏天去雾凇岛'));
  assert.ok(winter.score > summer.score, `冬天 ${winter.score} 应高于夏天 ${summer.score}`);
  assert.ok(winter.reasons.includes('适合冬季'));
  assert.ok(summer.reasons.includes('非夏季首选'));
});

test('线路季节不符同样扣分', () => {
  const route = routeById('jilin-wusong-2d');
  const winter = scoreRoute(route, intent('冬天两天去吉林市'));
  const summer = scoreRoute(route, intent('夏天两天去吉林市'));
  assert.ok(winter.score > summer.score);
});

test('天数匹配加分，不匹配扣分', () => {
  const route = routeById('changchun-city-1d');
  const oneDay = scoreRoute(route, intent('一天在长春'));
  const threeDay = scoreRoute(route, intent('三天去长春'));
  assert.ok(oneDay.score > threeDay.score);
});

test('结果按分数从高到低排序，且 id 唯一', () => {
  const list = searchAttractions(intent('冬天看冰雪'));
  const scores = list.map((x) => x.score);
  assert.deepEqual(scores, [...scores].sort((a, b) => b - a));
  assert.equal(new Set(list.map((x) => x.id)).size, list.length);
});

test('每条推荐都带理由，便于界面展示依据', () => {
  const list = searchAttractions(intent('长白山天池'), { limit: 3 });
  assert.ok(list.length >= 1);
  assert.ok(list[0].reasons.length >= 1);
});

test('同样的输入得到同样的结果（确定性）', () => {
  const a = retrieve(intent('两天冬天带孩子'));
  const b = retrieve(intent('两天冬天带孩子'));
  assert.deepEqual(a, b);
});

test('时令：12 月能命中冬捕与雾凇窗口', () => {
  const events = searchEvents(intent('12月去哪玩'));
  const ids = events.map((e) => e.id);
  assert.ok(ids.includes('chagan-winter-fishing'));
  assert.ok(ids.includes('jilin-rime-season'));
  assert.ok(events[0].reasons.some((r) => r.includes('12 月')));
});

test('limit 生效', () => {
  assert.equal(searchAttractions(intent('吉林'), { limit: 2 }).length, 2);
  assert.equal(searchRoutes(intent('吉林'), { limit: 1 }).length, 1);
});

test('乱输入不崩，仍可返回结果', () => {
  const r = retrieve(intent('？？？😀 随便看看'));
  assert.ok(Array.isArray(r.attractions));
  assert.ok(r.attractions.length > 0);
});

test('retrieve 同时返回三类结果', () => {
  const r = retrieve(intent('延边 美食 两天'));
  assert.ok(r.attractions.length > 0);
  assert.ok(r.routes.length > 0);
  assert.ok(r.events.length > 0);
  assert.ok(r.intent.signals > 0);
});
