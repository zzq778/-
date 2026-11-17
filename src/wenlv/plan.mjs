/**
 * 行程编排（wenlv-v1，D4 A 线）
 *
 * 输入：intent（D3 解析结果）+ retrieval（D3 检索结果）
 * 输出：结构化行程——每天几个点、什么顺序、为什么，以及要提醒什么。
 *
 * 三条原则：
 *   1. 结构由代码给，模型只负责把结构说成人话（D5 才接模型）；
 *   2. 不写车程、不写票价、不写精确时刻——数据里没有的事实这里一个都不编；
 *   3. 每个节点都带 why 与来源，界面才有东西可展示，评委才看得见依据。
 */
import { byId } from './attractions.mjs';
import { ROUTES } from './routes.mjs';
import { CLUSTER_LABELS, ROUTE_SLOTS } from './schema.mjs';
import { factsOf } from './facts.mjs';
import { describeIntent } from './intent.mjs';

export const MAX_DAYS = 3;
export const NODES_PER_DAY = 3;
export const SLOTS = ROUTE_SLOTS;

const uniq = (list) => [...new Set(list)];
const uniqBy = (list, key) => {
  const seen = new Set();
  return list.filter((x) => (seen.has(x[key]) ? false : (seen.add(x[key]), true)));
};

function clampDays(n, fallback = 2) {
  const d = Number(n);
  if (!Number.isFinite(d) || d <= 0) return fallback;
  return Math.min(MAX_DAYS, Math.max(1, Math.round(d)));
}

/**
 * 挑一条线路当骨架：天数对得上优先，其次同片区。
 *
 * 有明确片区、却没有该片区同天数的线路时，宁可返回 null 让检索自己拼节点，
 * 也不要跨片区硬凑——「长春两日」被排成吉林市松花湖，比没有线路更糟。
 */
export function pickRoute(intent, retrieval) {
  const routes = (retrieval?.routes || []).filter((r) => r.score > 0);
  if (!routes.length) return null;
  const primaries = intent?.clusters || [];
  const days = clampDays(intent?.days, null);

  if (days) {
    const fit = routes.filter((r) => r.days === days);
    if (!fit.length) return null;
    if (!primaries.length) return fit[0];
    return fit.find((r) => primaries.includes(r.cluster)) || null;
  }

  const near = routes.find((r) => primaries.includes(r.cluster));
  return near || routes[0];
}

/** 把线路节点展开成“带景点详情”的行程节点。 */
function nodesFromRoute(route) {
  return route.nodes.map((node) => {
    const entry = byId(node.attractionId);
    return {
      day: node.day,
      slot: node.slot,
      attractionId: entry.id,
      name: entry.name,
      area: entry.area,
      cluster: entry.cluster,
      kind: entry.kind,
      level: entry.level,
      why: node.why,
      caveat: entry.caveat,
      hours: entry.hours,
      ticket: entry.ticket,
      booking: entry.booking,
      facts: factsOf(entry),
      sources: entry.sources
    };
  });
}

/** 没有合适线路时，用检索结果拼一条：同片区优先，分数次之。 */
function nodesFromSearch(intent, retrieval, days) {
  const primary = intent?.clusters?.[0]
    || retrieval.attractions.map((a) => a.cluster).sort((a, b) => a.localeCompare(b))[0]
    || null;

  const ranked = retrieval.attractions
    .map((a) => ({ ...a, entry: byId(a.id) }))
    .filter((a) => a.entry)
    .sort((a, b) => {
      const sameA = a.cluster === primary ? 1 : 0;
      const sameB = b.cluster === primary ? 1 : 0;
      if (sameA !== sameB) return sameB - sameA;
      if (a.score !== b.score) return b.score - a.score;
      return a.id.localeCompare(b.id);
    });

  const picked = uniqBy(ranked, 'id').slice(0, days * NODES_PER_DAY);

  return picked.map((a, i) => ({
    day: Math.floor(i / NODES_PER_DAY) + 1,
    slot: SLOTS[i % NODES_PER_DAY],
    attractionId: a.id,
    name: a.entry.name,
    area: a.entry.area,
    cluster: a.entry.cluster,
    kind: a.entry.kind,
    level: a.entry.level,
    why: a.reasons?.length ? a.reasons.join('；') : '片区代表',
    caveat: a.entry.caveat,
    hours: a.entry.hours,
    ticket: a.entry.ticket,
    booking: a.entry.booking,
    facts: factsOf(a.entry),
    sources: a.entry.sources
  }));
}

function dayTitle(day, nodes) {
  const clusters = uniq(nodes.filter((n) => n.day === day).map((n) => n.cluster));
  const label = clusters.map((c) => CLUSTER_LABELS[c] || c).join(' / ');
  return label ? `第 ${day} 天 · ${label}` : `第 ${day} 天`;
}

function collectWarnings(intent, nodes, days, retrieval) {
  const warnings = [];

  if (retrieval?.fallback) {
    warnings.push({
      type: 'fallback',
      message: '还没抓到明确条件，先按片区代表给一版；建议追问“几天、和谁、什么季节”。'
    });
  }

  const clusters = uniq(nodes.map((n) => n.cluster));
  if (clusters.length > 1) {
    warnings.push({
      type: 'cross-cluster',
      message: `行程跨 ${clusters.length} 个片区（${clusters.map((c) => CLUSTER_LABELS[c] || c).join('、')}），请预留转移时间，实际车程以导航为准。`
    });
  }

  const season = intent?.season || null;
  if (season) {
    const mismatched = uniq(nodes
      .filter((n) => {
        const entry = byId(n.attractionId);
        return entry?.season?.best?.length && !entry.season.best.includes(season);
      })
      .map((n) => n.name));
    if (mismatched.length) {
      warnings.push({
        type: 'season-mismatch',
        message: `${mismatched.join('、')} 不是这个季节的首选，去之前先确认是否开放或另有看点。`
      });
    }
  }

  const unknownHours = nodes.filter((n) => {
    const entry = byId(n.attractionId);
    return !entry || entry.hours == null || entry.ticket == null;
  });
  if (unknownHours.length) {
    warnings.push({
      type: 'unsourced-facts',
      message: '开放时间与票价没有写进库（防止过期误导），出发前请以景区官方公告为准。'
    });
  }

  if (nodes.length < days * 2) {
    warnings.push({
      type: 'thin-plan',
      message: `可用节点偏少（${nodes.length} 个撑 ${days} 天），建议放宽片区或把其中一天留作机动。`
    });
  }

  return warnings;
}

function collectSources(nodes, routeEntry) {
  const all = [...nodes.flatMap((n) => n.sources || []), ...(routeEntry?.sources || [])];
  return uniqBy(all, 'url').slice(0, 6);
}

function collectTips(intent, retrieval, days) {
  const tips = [
    '出发前用官方渠道确认开放时间、预约规则与票价。',
    '学生、老年人等优惠资格以现场公告为准，带好身份证件。'
  ];
  const season = intent?.season;
  if (season === 'winter') tips.push('冬季注意路面结冰、景区临时关闭与保暖装备。');
  if (season === 'summer') tips.push('夏季山区紫外线强，注意防晒、补水与雷雨天气。');
  if (days >= 2) tips.push('两日以上行程建议其中一天留出机动时间，应对天气或人流变化。');

  const event = retrieval?.events?.[0];
  if (event && event.score > 0) {
    tips.push(`时令提示：${event.name}（${event.window}），是否在窗口内以官方公告为准。`);
  }
  return tips;
}

/**
 * 生成一版行程。
 * @param {object} intent parseIntent 的结果
 * @param {object} retrieval retrieve 的结果
 * @param {{ days?: number }} [options]
 */
export function buildItinerary(intent, retrieval, options = {}) {
  const route = pickRoute(intent, retrieval);
  const days = clampDays(options.days ?? intent?.days ?? route?.days ?? 2, 2);

  let nodes;
  let sourceRouteId = null;
  if (route && route.days === days) {
    const full = ROUTES.find((r) => r.id === route.id);
    if (full) {
      nodes = nodesFromRoute(full);
      sourceRouteId = full.id;
    }
  }
  if (!nodes) nodes = nodesFromSearch(intent, retrieval, days);

  const plan = [];
  for (let d = 1; d <= days; d += 1) {
    const dayNodes = nodes.filter((n) => n.day === d);
    plan.push({ day: d, title: dayTitle(d, nodes), nodes: dayNodes });
  }

  const usedNodes = plan.flatMap((d) => d.nodes);
  const routeEntry = sourceRouteId ? ROUTES.find((r) => r.id === sourceRouteId) : null;

  return {
    version: 'itinerary-v1',
    title: `${days} 天行程${intent?.clusters?.length ? ` · ${CLUSTER_LABELS[intent.clusters[0]] || intent.clusters[0]}` : ''}`,
    days,
    clusters: uniq(usedNodes.map((n) => n.cluster)),
    sourceRouteId,
    plan,
    tips: collectTips(intent, retrieval, days),
    warnings: collectWarnings(intent, usedNodes, days, retrieval),
    sources: collectSources(usedNodes, routeEntry),
    meta: {
      intent: describeIntent(intent),
      confidence: intent?.confidence || 'low',
      generator: 'plan.mjs@D4'
    }
  };
}

/** 把行程写成一段纯文本，供模型润色或命令行查看（不含任何编造事实）。 */
export function describeItinerary(itinerary) {
  const lines = [`${itinerary.days} 天行程`];
  for (const day of itinerary.plan) {
    const parts = day.nodes.map((n) => `${n.slot} ${n.name}（${n.why}）`);
    lines.push(`${day.title}：${parts.join('；')}`);
  }
  if (itinerary.warnings.length) lines.push(`提醒：${itinerary.warnings.map((w) => w.message).join(' ')}`);
  if (itinerary.sources.length) lines.push(`来源：${itinerary.sources.map((s) => s.label).join('、')}`);
  return lines.join('\n');
}
