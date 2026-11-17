import { isExcludedAttraction, isExcludedRoute, isExcludedEvent } from './constraints.mjs';
/**
 * 检索与打分（wenlv-v1，D3 A 线）
 *
 * 输入意图（intent.mjs 的产物），输出排好序的景点、线路、时令，并带上“为什么排在这里”。
 * 打分规则是显式的、可测的，不是模型的感觉：
 *   片区命中 6 分、市州命中 4 分、类型命中 5 分、正文提到 2 分/处、季节相符 3 分、不符 −2 分。
 * 理由（reasons）直接进界面“依据与核对”，让每一屏推荐都能解释。
 */
import { ATTRACTIONS } from './attractions.mjs';
import { ROUTES } from './routes.mjs';
import { CALENDAR } from './calendar.mjs';
import { CLUSTER_LABELS, CLUSTERS } from './schema.mjs';

/** 主题 → 景点类型。只有这 6 个主题有类型语义，其余走关键词命中。 */
const THEME_KINDS = Object.freeze({
  冰雪: ['冰雪'],
  自然: ['自然'],
  人文: ['人文'],
  民俗: ['民俗'],
  遗址: ['遗址'],
  工业: ['工业']
});

/** 时令类型 → 能响应的主题。 */
const EVENT_TYPE_THEMES = Object.freeze({
  冰雪: ['冰雪', '雾凇'],
  节庆: ['冬捕', '民俗'],
  观鸟: ['观鸟'],
  花季: ['自然', '摄影'],
  景致: ['自然', '摄影', '天池'],
  民俗: ['民俗']
});

const SEASON_LABEL = Object.freeze({ spring: '春', summer: '夏', autumn: '秋', winter: '冬' });

const W = Object.freeze({
  cluster: 6, area: 4, kind: 5, keyword: 2, keywordCap: 3, seasonFit: 3, seasonMiss: -2,
  routeDaysFit: 5, routeDaysMiss: -2, routeTheme: 2, routeThemeCap: 3,
  eventMonth: 4, eventCluster: 5, eventTheme: 2
});

const round1 = (n) => Math.round(n * 10) / 10;
const uniq = (list) => [...new Set(list)];

function haystack(entry) {
  return [entry.name, ...(entry.aliases || []), ...(entry.tags || [])].join(' ');
}

/** 景点打分：返回 { score, reasons }。纯函数、无副作用。 */
export function scoreAttraction(entry, intent) {
  const reasons = [];
  let score = 0;

  if (intent.clusters.includes(entry.cluster)) {
    score += W.cluster;
    reasons.push(`片区：${CLUSTER_LABELS[entry.cluster] || entry.cluster}`);
  }
  if (intent.areas.includes(entry.area)) {
    score += W.area;
    reasons.push(`市州：${entry.area}`);
  }

  const kindsHit = uniq(intent.themes).filter((t) => (THEME_KINDS[t] || []).includes(entry.kind));
  if (kindsHit.length) {
    score += W.kind;
    reasons.push(`类型：${entry.kind}`);
  }

  const text = haystack(entry);
  const words = uniq(intent.themeWords.filter((w) => text.includes(w))).slice(0, W.keywordCap);
  if (words.length) {
    score += W.keyword * words.length;
    reasons.push(`提到：${words.join('、')}`);
  }

  if (intent.season) {
    if (entry.season.best.includes(intent.season)) {
      score += W.seasonFit;
      reasons.push(`适合${SEASON_LABEL[intent.season]}季`);
    } else {
      score += W.seasonMiss;
      reasons.push(`非${SEASON_LABEL[intent.season]}季首选`);
    }
  }

  return { score: round1(score), reasons };
}

/** 线路打分：天数、片区、主题、季节都会影响排序。 */
export function scoreRoute(route, intent) {
  const reasons = [];
  let score = 0;

  if (intent.clusters.includes(route.cluster)) {
    score += W.cluster;
    reasons.push(`片区：${CLUSTER_LABELS[route.cluster] || route.cluster}`);
  }
  if (route.areas.some((a) => intent.areas.includes(a))) {
    score += W.area;
    reasons.push(`市州：${route.areas.join('、')}`);
  }

  if (intent.days) {
    if (route.days === intent.days) {
      score += W.routeDaysFit;
      reasons.push(`${route.days} 天，正好`);
    } else {
      score += W.routeDaysMiss * Math.abs(route.days - intent.days);
      reasons.push(`${route.days} 天，与预期不同`);
    }
  }

  const themeHits = uniq(intent.themes.filter((t) => route.themes.includes(t))).slice(0, W.routeThemeCap);
  if (themeHits.length) {
    score += W.routeTheme * themeHits.length;
    reasons.push(`主题：${themeHits.join('、')}`);
  }

  if (intent.season) {
    if (route.season.includes(intent.season)) {
      score += W.seasonFit;
      reasons.push(`适合${SEASON_LABEL[intent.season]}季`);
    } else {
      score += W.seasonMiss;
      reasons.push(`非${SEASON_LABEL[intent.season]}季首选`);
    }
  }

  if (intent.text && route.name.includes(intent.text)) {
    score += W.keyword;
    reasons.push('名称直接命中');
  }

  return { score: round1(score), reasons };
}

/** 时令打分：月份是硬条件，片区与主题加分。 */
export function scoreEvent(event, intent) {
  const reasons = [];
  let score = 0;

  if (intent.month && event.months.includes(intent.month)) {
    score += W.eventMonth;
    reasons.push(`${intent.month} 月正在窗口`);
  }
  if (intent.clusters.includes(event.cluster)) {
    score += W.eventCluster;
    reasons.push(`片区：${CLUSTER_LABELS[event.cluster] || event.cluster}`);
  }
  const themeHits = uniq(intent.themes.filter((t) => (EVENT_TYPE_THEMES[event.type] || []).includes(t)));
  if (themeHits.length) {
    score += W.eventTheme * themeHits.length;
    reasons.push(`贴合：${themeHits.join('、')}`);
  }
  if (intent.text && event.name.includes(intent.text)) {
    score += W.keyword;
    reasons.push('名称直接命中');
  }

  return { score: round1(score), reasons };
}

const byScore = (a, b) => (b.score - a.score) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** 兜底展示：每个片区挑一条代表（优先 5A），保证“没听懂”时也有东西可看。 */
export function featuredAttractions() {
  const out = [];
  for (const cluster of CLUSTERS) {
    const inCluster = ATTRACTIONS.filter((a) => a.cluster === cluster);
    if (!inCluster.length) continue;
    out.push(inCluster.find((a) => a.level === '5A') || inCluster[0]);
  }
  return out;
}

export function searchAttractions(intent, { limit = 6 } = {}) {
  return ATTRACTIONS.filter(entry=>!isExcludedAttraction(entry,intent)).map((entry) => ({ entry, ...scoreAttraction(entry, intent) }))
    .sort(byScore)
    .slice(0, limit)
    .map(({ entry, score, reasons }) => ({
      id: entry.id, name: entry.name, area: entry.area, cluster: entry.cluster,
      kind: entry.kind, level: entry.level, score, reasons
    }));
}

export function searchRoutes(intent, { limit = 3 } = {}) {
  return ROUTES.filter(route=>!isExcludedRoute(route,intent)).map((route) => ({ route, ...scoreRoute(route, intent) }))
    .sort(byScore)
    .slice(0, limit)
    .map(({ route, score, reasons }) => ({
      id: route.id, name: route.name, days: route.days, cluster: route.cluster,
      areas: route.areas, themes: route.themes, score, reasons
    }));
}

export function searchEvents(intent, { limit = 3 } = {}) {
  return CALENDAR.filter(event=>!isExcludedEvent(event,intent)).map((event) => ({ event, ...scoreEvent(event, intent) }))
    .sort(byScore)
    .slice(0, limit)
    .map(({ event, score, reasons }) => ({
      id: event.id, name: event.name, cluster: event.cluster, type: event.type,
      months: event.months, window: event.window, score, reasons
    }));
}

/**
 * 一次完整检索。
 * @param {object} intent parseIntent 的结果
 * @param {{ limit?: number, routeLimit?: number, eventLimit?: number }} [options]
 */
export function retrieve(intent, options = {}) {
  const empty = !intent || intent.signals === 0;

  if (empty) {
    const picks = featuredAttractions();
    return {
      intent,
      fallback: true,
      note: '没抓到明确条件，先给每个片区一条代表，再问一句“几天、和谁、什么季节”。',
      attractions: picks.slice(0, options.limit ?? 6).map((a) => ({
        id: a.id, name: a.name, area: a.area, cluster: a.cluster,
        kind: a.kind, level: a.level, score: 0, reasons: ['片区代表']
      })),
      routes: searchRoutes({ ...intent, clusters: [], areas: [], themes: [], days: null, season: null }, options),
      events: searchEvents({ ...intent, clusters: [], themes: [] }, options)
    };
  }

  // 只保留有正分的条目：0 分意味着“和这次需求没关系”，列出来只会干扰判断。
  const keepPositive = (list) => {
    const positive = list.filter((x) => x.score > 0);
    return positive.length ? positive : list.slice(0, 1);
  };

  return {
    intent,
    fallback: false,
    note: null,
    attractions: keepPositive(searchAttractions(intent, options)),
    routes: keepPositive(searchRoutes(intent, options)),
    events: keepPositive(searchEvents(intent, options))
  };
}
