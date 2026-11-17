/**
 * 意图解析测试（D3 A 线）
 *
 * 覆盖：天数（阿拉伯/中文/周末/一日游/超上限）、季节（明说 vs 按月份推断）、
 * 同行人、片区、市州、主题、省份泛化、空输入与解释文案。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseIntent, describeIntent, SEASON_BY_MONTH, THEME_WORDS } from '../src/wenlv/intent.mjs';

const NOW = new Date('2026-11-17T10:00:00+08:00');
const parse = (text) => parseIntent(text, { now: NOW });

test('两天冬天带孩子：天数、季节、同行人都能抓到', () => {
  const it = parse('两天冬天带孩子去哪玩');
  assert.equal(it.days, 2);
  assert.equal(it.season, 'winter');
  assert.ok(it.companions.includes('亲子'));
  assert.ok(it.themes.includes('亲子'));
  assert.equal(it.confidence, 'medium');
});

test('三天两晚去长白山看天池：中文数字与片区', () => {
  const it = parse('三天两晚去长白山看天池');
  assert.equal(it.days, 3);
  assert.deepEqual(it.clusters, ['changbaishan']);
  assert.ok(it.themes.includes('天池'));
  assert.equal(it.confidence, 'high');
});

test('周末在长春转转：周末按两天，长春同时命中市州与片区', () => {
  const it = parse('周末在长春转转');
  assert.equal(it.days, 2);
  assert.deepEqual(it.areas, ['长春市']);
  assert.deepEqual(it.clusters, ['changchun']);
});

test('一个人去集安看高句丽：独自出行 + 集安片区', () => {
  const it = parse('一个人去集安看高句丽');
  assert.ok(it.companions.includes('独自'));
  assert.deepEqual(it.clusters, ['jian']);
});

test('12月去查干湖看冬捕：月份推出冬季，冬捕是主题', () => {
  const it = parse('12月去查干湖看冬捕');
  assert.equal(it.month, 12);
  assert.equal(it.season, 'winter');
  assert.deepEqual(it.clusters, ['chaganhu']);
  assert.ok(it.themes.includes('冬捕'));
});

test('带爸妈去雾凇岛：长辈同行 + 雾凇片区', () => {
  const it = parse('带爸妈去雾凇岛');
  assert.ok(it.companions.includes('长辈'));
  assert.deepEqual(it.clusters, ['wusong']);
  assert.ok(it.themes.includes('雾凇'));
});

test('空输入不猜条件', () => {
  const it = parse('');
  assert.equal(it.days, null);
  assert.equal(it.season, 'autumn', '11 月默认秋季，但不代表用户说了秋天');
  assert.equal(it.signals, 0);
  assert.equal(it.confidence, 'low');
});

test('超过三天的需求被截断并标记', () => {
  const it = parse('5天假期去哪');
  assert.equal(it.days, 3);
  assert.equal(it.daysRequested, 5);
  assert.equal(it.daysClamped, true);
});

test('一日游按一天算', () => {
  assert.equal(parse('长春一日游怎么安排').days, 1);
});

test('吉林市与松花湖分别命中市州和片区', () => {
  const it = parse('吉林市和松花湖一起玩');
  assert.deepEqual(it.areas, ['吉林市']);
  assert.ok(it.clusters.includes('jilin-city'));
  assert.ok(it.clusters.includes('songhuahu'));
});

test('只说吉林省不硬塞吉林市', () => {
  const it = parse('吉林省内自驾有什么线路');
  assert.deepEqual(it.areas, []);
  assert.equal(it.provinceWide, true);
});

test('明说的季节优先于月份推断', () => {
  const it = parse('夏天去雾凇岛看看');
  assert.equal(it.season, 'summer');
  assert.ok(it.themes.includes('避暑') === false);
});

test('月份到季节的映射完整', () => {
  assert.equal(Object.keys(SEASON_BY_MONTH).length, 12);
  assert.equal(SEASON_BY_MONTH[1], 'winter');
  assert.equal(SEASON_BY_MONTH[7], 'summer');
});

test('主题词表里每个主题都有同义词', () => {
  for (const [theme, words] of Object.entries(THEME_WORDS)) {
    assert.ok(Array.isArray(words) && words.length > 0, `${theme} 缺少同义词`);
  }
});

test('describeIntent 能把条件讲成一句话', () => {
  const text = describeIntent(parse('两天冬天带孩子'));
  assert.match(text, /2 天/);
  assert.match(text, /亲子/);
});
