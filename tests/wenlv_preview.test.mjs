/**
 * 前端数据镜像与渲染层（D2）测试：
 * 1) public/wenlv-data.js 必须与 src/wenlv 的源数据一致（防止忘记 npm run build:data）；
 * 2) wenlv-ui.js 的渲染函数在无 DOM 环境下也能产出正确 HTML；
 * 3) 预览页的脚本顺序正确（先数据、后渲染）。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { ATTRACTIONS } from '../src/wenlv/attractions.mjs';
import { ROUTES } from '../src/wenlv/routes.mjs';
import { CALENDAR } from '../src/wenlv/calendar.mjs';
import { ENTRIES } from '../src/wenlv/entries.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFileSync(join(root, path), 'utf8');

const dataCode = read('public/wenlv-data.js');
const uiCode = read('public/wenlv-ui.js');
const previewHtml = read('public/wenlv-preview.html');

/** 用假 window 加载生成文件，返回它挂上去的数据。 */
function loadData() {
  const win = {};
  new Function('window', dataCode)(win);
  return win.WENLV;
}

function loadUi(host) {
  const win = { WENLV: host };
  new Function('window', uiCode)(win);
  return win.WENLV_UI;
}

const data = loadData();
const ui = loadUi(data);

test('生成文件与源数据完全同步（数量 + id 顺序）', () => {
  assert.deepEqual(data.attractions.map(a => a.id), ATTRACTIONS.map(a => a.id), '景点不同步，请跑 npm run build:data');
  assert.deepEqual(data.routes.map(r => r.id), ROUTES.map(r => r.id), '线路不同步');
  assert.deepEqual(data.calendar.map(e => e.id), CALENDAR.map(e => e.id), '时令不同步');
  assert.deepEqual(data.entries.map(e => e.id), ENTRIES.map(e => e.id), '入口不同步');
  assert.equal(data.schemaVersion, 'wenlv-v1');
});

test('生成文件带生成日期与数量注释', () => {
  assert.match(dataCode, /景点 40 · 线路 12 · 时令 12 · 入口 8/);
  assert.match(dataCode, /自动生成，请勿手改/);
  assert.match(data.generatedAt, /^\d{4}-\d{2}-\d{2}$/);
});

test('渲染层不需要 DOM 就能产出统计与芯片', () => {
  const stats = ui.stats();
  assert.match(stats, />40</);
  assert.match(stats, />12</);
  assert.match(stats, />8</);

  const chips = ui.chips('');
  assert.match(chips, /全部/);
  assert.match(chips, /长白山/);
  // 每个片区都要有一个芯片
  for (const label of Object.values(data.clusters)) assert.ok(chips.includes(label), `缺少片区芯片：${label}`);
});

test('景点网格按片区过滤，未知片区给空态', () => {
  const all = ui.attractionGrid('');
  assert.ok(all.includes('长白山北景区'));
  assert.ok(all.includes('查干湖'));

  const yanbian = ui.attractionGrid('yanbian');
  assert.ok(yanbian.includes('中国朝鲜族民俗园'));
  assert.equal(yanbian.includes('查干湖'), false);

  assert.match(ui.attractionGrid('nowhere'), /还没有收录/);
});

test('卡片始终带“以官方为准”，等级未知时明确标注', () => {
  const html = ui.attractionGrid('');
  assert.match(html, /官方(公告|公布|平台|说明|渠道|发布)/, '卡片应提示以官方为准');
  assert.ok(html.includes('等级未核对'));
  assert.ok(html.includes('5A'));
});

test('时令与线路渲染包含关键条目', () => {
  const seasons = ui.seasonGrid();
  assert.ok(seasons.includes('查干湖冬捕'));
  assert.ok(seasons.includes('吉林雾凇观赏期'));
  assert.ok(seasons.includes('9月'), '应显示月份标签');

  const routes = ui.routeGrid();
  assert.ok(routes.includes('长白山北坡两日'));
  assert.ok(routes.includes('集安通化两日'));
  assert.match(routes, /D1/);
});

test('渲染层对 HTML 特殊字符做转义', () => {
  assert.equal(ui.esc('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
  assert.equal(ui.esc('a"b\'c&d'), 'a&quot;b&#39;c&amp;d');
});

test('预览页先加载数据、再加载渲染层，并调用 mount', () => {
  const dataAt = previewHtml.indexOf('./wenlv-data.js');
  const uiAt = previewHtml.indexOf('./wenlv-ui.js');
  assert.ok(dataAt > 0 && uiAt > dataAt, '脚本顺序必须先是 wenlv-data.js 再是 wenlv-ui.js');
  assert.match(previewHtml, /WENLV_UI\.mount/);
  assert.match(previewHtml, /<meta charset="utf-8"/);
  assert.match(previewHtml, /返回吉政知行/);
});

test('预览页不出现写死的价格', () => {
  const prices = previewHtml.match(/\d+\s*元/g);
  assert.equal(prices, null, `预览页疑似写死价格：${prices}`);
});
