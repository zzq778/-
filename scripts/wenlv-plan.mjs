#!/usr/bin/env node
/**
 * 行程编排命令行试验台（D4 A 线）
 *
 * 用法：
 *   node scripts/wenlv-plan.mjs "两天冬天带孩子去哪"
 *   node scripts/wenlv-plan.mjs "12月去查干湖看冬捕" --check
 *
 * 它跑“解析 → 检索 → 编排（→ 校验）”全链路，**不调模型**：
 * 现场一眼就能看出是数据、规则、还是措辞的问题。
 */
import { parseIntent, describeIntent } from '../src/wenlv/intent.mjs';
import { retrieve } from '../src/wenlv/search.mjs';
import { buildItinerary, describeItinerary } from '../src/wenlv/plan.mjs';
import { guardAnswer, buildFacts, formatIssues } from '../src/wenlv/guard.mjs';

const argv = process.argv.slice(2);
const text = argv.filter((a) => !a.startsWith('--'))[0] || '';
const check = argv.includes('--check');

const intent = parseIntent(text);
const result = retrieve(intent);
const itinerary = buildItinerary(intent, result);

console.log(`问题：${intent.text || '(空)'}`);
console.log(`理解：${describeIntent(intent)}`);
console.log(`骨架：${itinerary.sourceRouteId || '（按检索结果拼）'}｜${itinerary.days} 天｜${itinerary.plan.flatMap((d) => d.nodes).length} 个节点`);
console.log('─'.repeat(52));

for (const day of itinerary.plan) {
  console.log(day.title);
  for (const node of day.nodes) {
    console.log(`  ${node.slot}  ${node.name}  — ${node.why}`);
    console.log(`        预约：${node.booking || '未标注'}｜等级：${node.level || '未核对'}`);
  }
}

console.log('─'.repeat(52));
for (const w of itinerary.warnings) console.log(`提醒[${w.type}] ${w.message}`);
for (const tip of itinerary.tips) console.log(`· ${tip}`);
console.log(`来源：${itinerary.sources.map((s) => s.label).join('、') || '（无）'}`);

if (check) {
  const draft = describeItinerary(itinerary);
  const verdict = guardAnswer(draft, buildFacts(itinerary));
  console.log('─'.repeat(52));
  console.log(`校验：${verdict.ok ? '通过' : '有问题'}`);
  console.log(formatIssues(verdict.issues));
  if (!verdict.ok) console.log(`可展示版本：\n${verdict.patched}`);
}
