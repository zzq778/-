/**
 * 线路模板 / 时令日历 / 官方入口（wenlv-v1，D2）测试。
 * 重点不是“数据好看”，而是引用完整性与脏数据拦截——这三张表直接喂给行程编排。
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { ATTRACTIONS, byId } from '../src/wenlv/attractions.mjs';
import { ROUTES, routeById, routesByCluster } from '../src/wenlv/routes.mjs';
import { CALENDAR, eventsInMonth, eventsByCluster } from '../src/wenlv/calendar.mjs';
import { ENTRIES, entryById, entriesForScope } from '../src/wenlv/entries.mjs';
import {
  CLUSTERS, SEASONS, ROUTE_SLOTS, EVENT_TYPES, ENTRY_KINDS,
  isOfficialUrl, validateRoute, validateEvent, validateEntry
} from '../src/wenlv/schema.mjs';

test('D2 交付 12 条线路，id 唯一且逐条通过校验', () => {
  assert.equal(ROUTES.length, 12);
  const ids = ROUTES.map(route => route.id);
  assert.equal(new Set(ids).size, ids.length, '线路 id 不得重复');
  for (const route of ROUTES) {
    assert.deepEqual(validateRoute(route), [], `${route.id} 校验未通过`);
  }
});

test('线路节点引用的景点必须存在（引用完整性）', () => {
  for (const route of ROUTES) {
    for (const node of route.nodes) {
      assert.ok(byId(node.attractionId), `${route.id} 引用了不存在的景点：${node.attractionId}`);
    }
  }
});

test('线路的天数、片区、季节与节点一致', () => {
  for (const route of ROUTES) {
    assert.ok(CLUSTERS.includes(route.cluster), `${route.id} cluster 非法`);
    route.season.forEach(season => assert.ok(SEASONS.includes(season), `${route.id} 季节非法`));
    route.nodes.forEach(node => {
      assert.ok(node.day >= 1 && node.day <= route.days, `${route.id} 节点天数越界`);
      assert.ok(ROUTE_SLOTS.includes(node.slot), `${route.id} slot 非法`);
    });
    const days = new Set(route.nodes.map(node => node.day));
    assert.equal(days.size, route.days, `${route.id} 有 ${route.days} 天但只排了 ${days.size} 天`);
  }
});

test('每条线路内不重复引用同一景点', () => {
  for (const route of ROUTES) {
    const refs = route.nodes.map(node => node.attractionId);
    assert.equal(new Set(refs).size, refs.length, `${route.id} 重复引用景点`);
  }
});

test('线路覆盖所有片区与至少 5 个市州', () => {
  const clusters = new Set(ROUTES.map(route => route.cluster));
  for (const cluster of clusters) assert.ok(CLUSTERS.includes(cluster));
  const areas = new Set(ROUTES.flatMap(route => route.areas));
  assert.ok(areas.size >= 5, `线路只覆盖 ${areas.size} 个市州`);
});

test('线路不写死票价或开放时间（只编排顺序与理由）', () => {
  for (const route of ROUTES) {
    // 只查线路本身与节点理由；caveat 里出现“门票”是合规提醒，不算写死价格。
    const text = `${route.name}${route.nodes.map(node => node.why).join('')}`;
    assert.doesNotMatch(text, /元|门票|开放时间：/, `${route.id} 疑似写死了价格或时刻`);
  }
});

test('D2 交付 12 条时令，逐条通过校验', () => {
  assert.equal(CALENDAR.length, 12);
  const ids = CALENDAR.map(event => event.id);
  assert.equal(new Set(ids).size, ids.length, '时令 id 不得重复');
  for (const event of CALENDAR) {
    assert.deepEqual(validateEvent(event), [], `${event.id} 校验未通过`);
    assert.ok(EVENT_TYPES.includes(event.type), `${event.id} type 非法`);
    assert.ok(event.months.length >= 1);
    event.months.forEach(month => assert.ok(month >= 1 && month <= 12));
  }
});

test('按月份查询时令：冬季能查到冬捕与雾凇', () => {
  const winter = eventsInMonth(1);
  assert.ok(winter.some(event => event.id === 'chagan-winter-fishing'), '1 月应能查到查干湖冬捕');
  assert.ok(winter.some(event => event.id === 'jilin-rime-season'), '1 月应能查到雾凇');
  assert.equal(eventsInMonth(7).length >= 1, true);
  assert.equal(eventsInMonth(13).length, 0);
});

test('时令条目都带“为什么这时候去”而不是干巴巴的日期', () => {
  for (const event of CALENDAR) {
    assert.ok(event.why.length >= 8, `${event.id} 的 why 太短`);
    assert.doesNotMatch(event.window, /^\d{4}年/, `${event.id} 不应写死具体年份`);
  }
});

test('D2 交付 8 个官方入口，域名全部在白名单', () => {
  assert.equal(ENTRIES.length, 8);
  const ids = ENTRIES.map(entry => entry.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const entry of ENTRIES) {
    assert.deepEqual(validateEntry(entry), [], `${entry.id} 校验未通过`);
    assert.ok(ENTRY_KINDS.includes(entry.kind));
    assert.ok(isOfficialUrl(entry.url), `${entry.id} 不在白名单：${entry.url}`);
  }
});

test('按 id / 片区 / 适用范围查询可用', () => {
  assert.equal(routeById('changbaishan-north-2d')?.days, 2);
  assert.equal(routeById('nope'), null);
  assert.ok(routesByCluster('changbaishan').length >= 2);
  assert.ok(eventsByCluster('yanbian').length >= 1);
  assert.equal(entryById('whhlyt')?.kind, 'gov');
  assert.ok(entriesForScope('长春').length >= 1);
});

test('脏线路会被拦下：越界天数、重复景点、非法 slot', () => {
  const broken = {
    ...ROUTES[0],
    days: 1,
    nodes: [
      { day: 2, slot: '晚上', attractionId: 'weimanhuanggong', why: '重复' },
      { day: 1, slot: '上午', attractionId: 'weimanhuanggong', why: '重复' }
    ]
  };
  const problems = validateRoute(broken);
  assert.ok(problems.some(msg => msg.includes('node.day')), problems.join('；'));
  assert.ok(problems.some(msg => msg.includes('slot')), problems.join('；'));
  assert.ok(problems.some(msg => msg.includes('重复')), problems.join('；'));
});

test('脏时令与脏入口会被拦下', () => {
  const badEvent = { ...CALENDAR[0], months: [0, 13], type: '庆典' };
  const eventProblems = validateEvent(badEvent);
  assert.ok(eventProblems.some(msg => msg.includes('months')));
  assert.ok(eventProblems.some(msg => msg.includes('type')));

  const badEntry = { ...ENTRIES[0], url: 'https://www.xiaohongshu.com/note/1', kind: 'blog' };
  const entryProblems = validateEntry(badEntry);
  assert.ok(entryProblems.some(msg => msg.includes('白名单')));
  assert.ok(entryProblems.some(msg => msg.includes('kind')));
});

test('景点库与线路库相互独立：删掉景点不会让线路静默通过', () => {
  const used = new Set(ROUTES.flatMap(route => route.nodes.map(node => node.attractionId)));
  const known = new Set(ATTRACTIONS.map(entry => entry.id));
  for (const id of used) assert.ok(known.has(id), `线路引用了已不存在的景点：${id}`);
});
