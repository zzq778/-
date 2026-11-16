/**
 * 把 src/wenlv 的知识库导出成前端可直接 <script> 的 public/wenlv-data.js。
 *
 * 单一来源原则：页面永远不手抄数据，只读这个生成文件；
 * 数据改了跑一次 `npm run build:data`，预览页与后续 app.js 自动跟着变。
 *
 * 用法：node scripts/build-wenlv-data.mjs
 */
import { writeFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { ATTRACTIONS } from '../src/wenlv/attractions.mjs';
import { ROUTES } from '../src/wenlv/routes.mjs';
import { CALENDAR } from '../src/wenlv/calendar.mjs';
import { ENTRIES } from '../src/wenlv/entries.mjs';
import { SCHEMA_VERSION, CLUSTER_LABELS, HELPLINE } from '../src/wenlv/schema.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, 'public', 'wenlv-data.js');

const payload = {
  schemaVersion: SCHEMA_VERSION,
  generatedAt: new Date().toISOString().slice(0, 10),
  clusters: CLUSTER_LABELS,
  attractions: ATTRACTIONS,
  routes: ROUTES,
  calendar: CALENDAR,
  entries: ENTRIES,
  helpline: HELPLINE
};

const header = [
  '/* 自动生成，请勿手改：node scripts/build-wenlv-data.mjs',
  ` * 知识库版本 ${SCHEMA_VERSION}，生成于 ${payload.generatedAt}`,
  ` * 景点 ${ATTRACTIONS.length} · 线路 ${ROUTES.length} · 时令 ${CALENDAR.length} · 入口 ${ENTRIES.length}`,
  ' * 票价与开放时间一律以官方为准（null = 未核对，不是“免费”）。',
  ' */',
  ''
].join('\n');

writeFileSync(target, `${header}window.WENLV = ${JSON.stringify(payload)};\n`, 'utf8');

const kb = statSync(target).size;
console.log(`[build:data] ${target.replace(root + '\\', '')}  ${(kb / 1024).toFixed(1)} KB`);
console.log(`[build:data] 景点 ${ATTRACTIONS.length} · 线路 ${ROUTES.length} · 时令 ${CALENDAR.length} · 入口 ${ENTRIES.length}`);
