/**
 * 引用与合规校验（wenlv-v1，D4 A 线）
 *
 * 模型（或模板）写出来的话，在展示前过一遍这里的检查：
 *   - 库外的价格 / 时刻 → 换成「以官方公布为准」，并记录问题；
 *   - 非白名单域名的链接 → 直接移除；
 *   - 绝对化承诺（“保证约到”“100% 有票”）→ 降级措辞；
 *   - 身份证号、手机号 → 打码；
 *   - 看起来像景点名但库里没有的 → 标出来，提醒人工确认。
 *
 * 它**不是**事实核验，而是“别把没根据的话说成像事实”的一道网。
 * 根治办法在 D4 的上游：结构由代码给（plan.mjs），模型只写措辞。
 */
import { isOfficialUrl } from './schema.mjs';
import { factNumbers, factTimes } from './facts.mjs';

export const ISSUE = Object.freeze({
  PRICE: 'unsupported-price',
  TIME: 'unsupported-time',
  URL: 'untrusted-url',
  OVERCLAIM: 'overclaim',
  PII: 'pii',
  UNKNOWN: 'unknown-entity'
});

const PRICE_RE = /(?:[¥￥]\s*\d+(?:\.\d+)?)|(?:\d+(?:\.\d+)?\s*元)/g;
const TIME_RE = /(?:[01]?\d|2[0-3])\s*[:：]\s*[0-5]\d/g;
const URL_RE = /https?:\/\/[^\s，。；、）)」”"'<>]+/g;
const ID_RE = /(?<!\d)\d{17}[\dXx](?!\d)/g;
const PHONE_RE = /(?<!\d)1[3-9]\d{9}(?!\d)/g;
const NAME_RE = /([\u4e00-\u9fa5]{2,6})(景区|博物馆|公园|滑雪场|古镇|湿地|保护区|遗址|寺|塔)/g;
const NAME_STOP = /^(级|个|该|此|各|本|类|多|些|一|几|两|三|四)/;
/** 前缀里带这些字，说明是“说话”而不是“景点名”。 */
const NAME_TALK = /[请以的了在去来到从前出建议推荐应该需]|出发|参观|游览/;

/** 两个词是否有 2 字以上的公共片段（用来放过“满族古镇”这类描述性说法）。 */
function sharesFragment(a, b) {
  for (let i = 0; i < a.length - 1; i += 1) {
    if (b.includes(a.slice(i, i + 2))) return true;
  }
  return false;
}

/** 绝对化措辞 → 降级说法。 */
const OVERCLAIM_MAP = Object.freeze([
  ['保证能', '通常可以'],
  ['保证', '通常'],
  ['包过', '有机会'],
  ['100%', '较大概率'],
  ['百分百', '较大概率'],
  ['必定', '通常'],
  ['一定能', '有望'],
  ['绝对不会', '一般不会'],
  ['唯一官方', '官方渠道之一'],
  ['官方指定', '官方推荐'],
  ['绝对', '基本']
]);

const uniq = (list) => [...new Set(list)];

/**
 * 从行程结构里抽出“允许出现”的事实集合。
 *
 * `numbers` / `times` 来自节点的事实层（facts.mjs）：只有景区官方渠道公布、
 * 并且写进库里的票价与时刻才算数。库里没有的，模型说了照样会被拦。
 * @param {object} itinerary buildItinerary 的产物
 */
export function buildFacts(itinerary) {
  const nodes = (itinerary?.plan || []).flatMap((d) => d.nodes || []);
  const nodeFacts = nodes.map((n) => n.facts || n);
  return {
    names: uniq(nodes.map((n) => n.name).filter(Boolean)),
    urls: uniq([
      ...(itinerary?.sources || []).map((s) => s.url).filter(Boolean),
      ...nodes.flatMap((n) => (n.sources || []).map((s) => s.url)).filter(Boolean)
    ]),
    numbers: uniq(nodeFacts.flatMap((f) => factNumbers(f))),
    times: uniq(nodeFacts.flatMap((f) => factTimes(f)))
  };
}

/**
 * 检查一段准备展示的文本。
 * @param {string} text
 * @param {{ names?: string[], urls?: string[], numbers?: string[], times?: string[] }} [facts]
 * @returns {{ ok: boolean, issues: Array<object>, patched: string }}
 */
export function guardAnswer(text, facts = {}) {
  const source = String(text ?? '');
  const allowedNames = (facts.names || []).filter(Boolean);
  const allowedUrls = new Set(facts.urls || []);
  const allowedNumbers = new Set((facts.numbers || []).map(String));
  const allowedTimes = new Set((facts.times || []).map((t) => String(t).replace(/\s/g, '')));

  const issues = [];
  let patched = source;

  patched = patched.replace(PRICE_RE, (match) => {
    const number = (match.match(/\d+(?:\.\d+)?/) || [''])[0];
    if (allowedNumbers.has(number)) return match;
    issues.push({ type: ISSUE.PRICE, severity: 'high', text: match, message: `出现库里没有的价格「${match}」` });
    return '官方公布的价格';
  });

  patched = patched.replace(TIME_RE, (match) => {
    const norm = match.replace(/\s/g, '');
    if (allowedTimes.has(norm)) return match;
    issues.push({ type: ISSUE.TIME, severity: 'high', text: match, message: `出现库里没有的时刻「${match}」` });
    return '官方公布的时间';
  });

  patched = patched.replace(URL_RE, (match) => {
    const url = match.replace(/[.,]+$/, '');
    if (isOfficialUrl(url) || allowedUrls.has(url)) return match;
    issues.push({ type: ISSUE.URL, severity: 'medium', text: url, message: `链接不在官方白名单「${url}」` });
    return '（已移除非官方链接）';
  });

  for (const [bad, good] of OVERCLAIM_MAP) {
    if (!patched.includes(bad)) continue;
    issues.push({ type: ISSUE.OVERCLAIM, severity: 'medium', text: bad, message: `绝对化措辞「${bad}」` });
    patched = patched.split(bad).join(good);
  }

  patched = patched.replace(ID_RE, (match) => {
    issues.push({ type: ISSUE.PII, severity: 'high', text: match, message: '出现身份证号' });
    return '（证件号已隐藏）';
  });

  patched = patched.replace(PHONE_RE, (match) => {
    issues.push({ type: ISSUE.PII, severity: 'high', text: match, message: '出现手机号' });
    return '（手机号已隐藏）';
  });

  for (const match of source.matchAll(NAME_RE)) {
    const full = `${match[1]}${match[2]}`;
    if (NAME_STOP.test(match[1])) continue;
    if (NAME_TALK.test(match[1])) continue;
    if (allowedNames.some((n) => n === full || full.startsWith(n) || n.startsWith(full))) continue;
    if (allowedNames.some((n) => sharesFragment(full, n))) continue;
    issues.push({ type: ISSUE.UNKNOWN, severity: 'low', text: full, message: `「${full}」不在已核对景点库里` });
  }

  return { ok: issues.length === 0, issues, patched };
}

/** 便于命令行展示：把问题列表压成一行。 */
export function formatIssues(issues) {
  if (!issues.length) return '未发现问题';
  return issues.map((i) => `[${i.type}] ${i.message}`).join('\n');
}
