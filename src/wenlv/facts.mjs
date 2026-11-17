/**
 * 事实层（D6 · C1）：把「开放时间 / 票价 / 预约方式」三件最容易被编造的事，
 * 从景点条目里单独拎出来，回答三个问题：
 *
 *   1. 这条景点，哪些事实是真的核对过的？（factsOf / verifiedKeys）
 *   2. 全库还缺多少？（coverage / queue —— 给人工核对排期用）
 *   3. 模型说出口的 `30 元`、`06:00`，是不是库里的数？（factNumbers / factTimes → guard）
 *
 * 设计底线：**没有就是没有**。字段为 null 表示「未核对」，不是「免费」也不是
 * 「随意」。`verifiedAt` 记录核对日期，过期由 schema 的 checkFreshness 统一管。
 */

export const FACT_KEYS = Object.freeze(['hours', 'ticket', 'booking']);

export const FACT_LABELS = Object.freeze({
  hours: '开放时间',
  ticket: '票价',
  booking: '预约方式'
});

export const FACT_STATE = Object.freeze({
  VERIFIED: 'verified',
  MISSING: 'missing'
});

const clean = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null);
const uniq = (list) => [...new Set(list)];
const asList = (list) => (Array.isArray(list) ? list : []);

/** 取一条景点的事实三件套；null 表示未核对。 */
export function factsOf(entry) {
  const facts = {};
  for (const key of FACT_KEYS) facts[key] = clean(entry?.[key]);
  return facts;
}

export function factState(entry, key) {
  return factsOf(entry)[key] ? FACT_STATE.VERIFIED : FACT_STATE.MISSING;
}

/** 已核对的事实字段列表，按 FACT_KEYS 顺序。 */
export function verifiedKeys(entry) {
  const facts = factsOf(entry);
  return FACT_KEYS.filter((key) => facts[key]);
}

export function isFullyVerified(entry) {
  return verifiedKeys(entry).length === FACT_KEYS.length;
}

/**
 * 覆盖率：给发布前看的总表。
 * @param {Array<object>} list
 */
export function coverage(list) {
  const rows = asList(list);
  const counts = { total: rows.length };
  for (const key of FACT_KEYS) counts[key] = rows.filter((row) => factsOf(row)[key]).length;
  counts.any = rows.filter((row) => verifiedKeys(row).length > 0).length;
  counts.percent = rows.length ? Math.round((counts.any / rows.length) * 100) : 0;
  counts.full = rows.filter(isFullyVerified).length;
  return counts;
}

/**
 * 待核对队列：缺得越多越靠前，同级按名称排序，便于两人分工。
 * @param {Array<object>} list
 */
export function queue(list) {
  return asList(list)
    .filter((row) => !isFullyVerified(row))
    .map((row) => {
      const facts = factsOf(row);
      return {
        id: row.id,
        name: row.name,
        area: row.area,
        cluster: row.cluster,
        level: row.level,
        source: (row.sources || [])[0]?.url || null,
        missing: FACT_KEYS.filter((key) => !facts[key])
      };
    })
    .sort((a, b) => b.missing.length - a.missing.length || String(a.name).localeCompare(String(b.name), 'zh'));
}

const NUMBER_RE = /\d+(?:\.\d+)?/g;
const TIME_RE = /(?:[01]?\d|2[0-3])\s*[:：]\s*[0-5]\d/g;

/** 时刻统一成 HH:MM，并给出补零写法，避免「8:30 / 08:30」互相判错。 */
function normalizeTimes(match) {
  const [hour, minute] = match.replace(/[：\s]/g, ':').split(':');
  const padded = `${String(hour).padStart(2, '0')}:${minute}`;
  const bare = `${Number(hour)}:${minute}`;
  return uniq([padded, bare]);
}

/** 一条景点事实里出现过的数字（票价、时长、名额）；时刻里的数字先剔除，避免 8:30 变成 8 和 30。 */
export function factNumbers(entry) {
  const facts = factsOf(entry);
  const text = [facts.ticket, facts.booking, facts.hours]
    .filter(Boolean)
    .join(' ')
    .replace(TIME_RE, ' ');
  return uniq((text.match(NUMBER_RE) || []).map((n) => String(Number(n))));
}

/** 一条景点事实里出现过的时刻（开放/停止入园/售票时间）。 */
export function factTimes(entry) {
  const facts = factsOf(entry);
  const text = [facts.hours, facts.booking].filter(Boolean).join(' ');
  return uniq((text.match(TIME_RE) || []).flatMap(normalizeTimes));
}

/**
 * 从行程节点里汇总「允许模型说出口」的数字与时刻，交给 guard。
 * @param {Array<object>} nodes
 */
export function factsForNodes(nodes) {
  const list = asList(nodes);
  return {
    numbers: uniq(list.flatMap((node) => factNumbers(node?.facts || node))),
    times: uniq(list.flatMap((node) => factTimes(node?.facts || node)))
  };
}

/** 展示用：有就返回原文，没有就说明「未核对」。 */
export function describeFact(entry, key) {
  const value = factsOf(entry)[key];
  return value || '未核对，以官方公布为准';
}
