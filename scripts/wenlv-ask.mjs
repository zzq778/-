#!/usr/bin/env node
/**
 * 意图 + 检索的命令行试验台（D3 A 线）
 *
 * 用法：
 *   node scripts/wenlv-ask.mjs "两天冬天带孩子去哪"
 *   node scripts/wenlv-ask.mjs "12月去查干湖看冬捕" --limit 3
 *
 * 它只做“解析 → 检索 → 打印”，不调模型：这样现场可以一眼看出
 * 是数据/规则的问题，还是模型措辞的问题，排障时不用猜。
 */
import { parseIntent, describeIntent } from '../src/wenlv/intent.mjs';
import { retrieve } from '../src/wenlv/search.mjs';

const argv = process.argv.slice(2);
const text = argv.filter((a) => !a.startsWith('--'))[0] || '';
const limitArg = argv.find((a) => a.startsWith('--limit='));
const limit = limitArg ? Number(limitArg.split('=')[1]) : 5;

const intent = parseIntent(text);
const result = retrieve(intent, { limit, routeLimit: 3, eventLimit: 3 });

const line = (s) => console.log(s);
const bar = '─'.repeat(48);

line(`问题：${intent.text || '(空)'}`);
line(`理解：${describeIntent(intent)}`);
line(`条件：days=${intent.days ?? '?'} season=${intent.season} month=${intent.month} cluster=[${intent.clusters.join(',')}] area=[${intent.areas.join(',')}] themes=[${intent.themes.join(',')}] companions=[${intent.companions.join(',')}] 置信度=${intent.confidence}`);
if (result.fallback) line(`兜底：${result.note}`);

line(bar);
line(`景点 TOP${result.attractions.length}`);
for (const a of result.attractions) {
  line(`  ${String(a.score).padStart(4)}  ${a.name}（${a.area} · ${a.cluster}）  ${a.reasons.join('；')}`);
}

line(bar);
line('线路 TOP');
for (const r of result.routes) {
  line(`  ${String(r.score).padStart(4)}  ${r.name}（${r.days} 天）  ${r.reasons.join('；')}`);
}

line(bar);
line('时令窗口');
for (const e of result.events) {
  line(`  ${String(e.score).padStart(4)}  ${e.name}（${e.window}）  ${e.reasons.join('；')}`);
}
