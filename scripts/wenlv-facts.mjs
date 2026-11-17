#!/usr/bin/env node
/**
 * 事实核对工具（C1）
 *
 *   node scripts/wenlv-facts.mjs            # 打印覆盖率与待核对队列
 *   node scripts/wenlv-facts.mjs --json     # 给流水线用的 JSON
 *   node scripts/wenlv-facts.mjs --write    # 顺手更新 docs/WENLV_FACTS_QUEUE.md
 *
 * 它只读取 src/wenlv/attractions.mjs，不发网络请求，也不改数据：
 * 「核对」这件事必须由人拿着官方页面来做，脚本只负责把缺口排成队。
 */
import { writeFileSync } from 'node:fs';
import { ATTRACTIONS } from '../src/wenlv/attractions.mjs';
import { coverage, queue, FACT_LABELS, FACT_KEYS } from '../src/wenlv/facts.mjs';

const args = new Set(process.argv.slice(2));
const cover = coverage(ATTRACTIONS);
const todo = queue(ATTRACTIONS);

if (args.has('--json')) {
  console.log(JSON.stringify({ coverage: cover, queue: todo }, null, 2));
  process.exit(0);
}

const pct = (value) => `${cover.total ? Math.round((value / cover.total) * 100) : 0}%`;
console.log('文旅知识库 · 事实覆盖率');
console.log(`  景点总数      ${cover.total}`);
for (const key of FACT_KEYS) {
  console.log(`  ${FACT_LABELS[key]}已核   ${String(cover[key]).padStart(3)} / ${cover.total}  ${pct(cover[key])}`);
}
console.log(`  至少核一项    ${String(cover.any).padStart(3)} / ${cover.total}  ${cover.percent}%`);
console.log(`  三项全核      ${String(cover.full).padStart(3)} / ${cover.total}`);
console.log(`  待核对        ${todo.length}`);
console.log('');

const byMissing = new Map();
for (const item of todo) {
  const key = item.missing.map((k) => FACT_LABELS[k]).join('+');
  byMissing.set(key, (byMissing.get(key) || 0) + 1);
}
console.log('缺项分布');
for (const [key, count] of [...byMissing.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${key.padEnd(22)} ${count}`);
}
console.log('');

console.log('前 10 条待核对（缺得多的在前）');
for (const item of todo.slice(0, 10)) {
  const missing = item.missing.map((k) => FACT_LABELS[k]).join('、');
  console.log(`  ${item.name.padEnd(12, '　')} ${item.area.padEnd(8, '　')} 缺：${missing}`);
}

if (args.has('--write')) {
  const lines = [
    '# 文旅事实待核队列',
    '',
    `> 由 \`npm run facts\` 生成，最近一次：${new Date().toISOString().slice(0, 10)}。`,
    '> 核对方式：打开该景点的官方页面，把开放时间 / 票价 / 预约方式抄进 `src/wenlv/attractions.mjs`，',
    '> 同时更新 `verifiedAt`。没有官方口径的，保持 `null`，页面会写「未核对」。',
    '',
    `- 景点总数：${cover.total}`,
    ...FACT_KEYS.map((key) => `- ${FACT_LABELS[key]}已核：${cover[key]}（${pct(cover[key])}）`),
    `- 三项全核：${cover.full}`,
    `- 待核对：${todo.length}`,
    '',
    '| 景点 | 市州 | 缺项 | 来源 |',
    '| --- | --- | --- | --- |'
  ];
  for (const item of todo) {
    const missing = item.missing.map((k) => FACT_LABELS[k]).join('、');
    lines.push(`| ${item.name} | ${item.area} | ${missing} | ${item.source || '—'} |`);
  }
  const out = 'docs/WENLV_FACTS_QUEUE.md';
  writeFileSync(out, `${lines.join('\n')}\n`, 'utf8');
  console.log(`\n已写入 ${out}`);
}
