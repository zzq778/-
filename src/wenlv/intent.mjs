import { parseExclusions } from './constraints.mjs';
/**
 * 意图解析（wenlv-v1，D3 A 线）
 *
 * 把一句中文问句拆成结构化条件：玩几天、跟谁、什么季节、想去哪、想看什么。
 * 纯函数、不联网、不读文件——模型只负责措辞，条件由代码给，
 * 这样“两天冬天带孩子”就不会被模型随手编成“五天夏天”。
 *
 * 刻意保守：拿不准就不填（days=null、area 不猜），
 * 让下游检索去兜底，而不是猜一个看起来合理的数字。
 */

/** 月份→季节；用于用户只说“12 月”时推断。 */
export const SEASON_BY_MONTH = Object.freeze({
  12: 'winter', 1: 'winter', 2: 'winter',
  3: 'spring', 4: 'spring', 5: 'spring',
  6: 'summer', 7: 'summer', 8: 'summer',
  9: 'autumn', 10: 'autumn', 11: 'autumn'
});

/** 主题词表：键是主题（与线路 themes 词表对齐），值是同义词。 */
export const THEME_WORDS = Object.freeze({
  冰雪: ['冰雪', '滑雪', '雪场', '雪道', '雪雕', '冰灯', '雪季', '玩雪', '雪'],
  雾凇: ['雾凇'],
  冬捕: ['冬捕', '头鱼'],
  自然: ['自然', '山水', '森林', '湿地', '草原', '瀑布', '风景', '湖光'],
  天池: ['天池'],
  人文: ['人文', '历史', '博物馆', '旧址', '宫殿', '文化', '建筑'],
  民俗: ['民俗', '朝鲜族', '满族', '非遗', '民族', '打糕'],
  遗址: ['遗址', '古墓', '王陵', '古城', '世界遗产'],
  工业: ['工业', '汽车', '电影', '葡萄酒', '一汽'],
  亲子: ['亲子', '孩子', '小孩', '带娃', '宝宝', '家庭'],
  研学: ['研学', '学生', '科普', '爱国主义', '夏令营'],
  美食: ['美食', '小吃', '烧烤', '烤肉', '锅包肉', '冷面'],
  边境: ['边境', '口岸', '国门', '界江', '图们'],
  摄影: ['摄影', '拍照', '出片', '航拍', '机位'],
  温泉: ['温泉', '泡汤', '汤泉'],
  自驾: ['自驾', '开车', '公路', '环线'],
  红色: ['红色', '抗联', '纪念馆', '杨靖宇', '烈士'],
  观鸟: ['观鸟', '候鸟', '白鹤', '鹤'],
  避暑: ['避暑', '凉快', '凉爽'],
  徒步: ['徒步', '爬山', '登山', '步道']
});

/** 同行人：决定节奏与体力建议，不写进检索打分之外的地方。 */
const COMPANION_WORDS = Object.freeze({
  长辈: ['老人', '长辈', '父母', '爸妈', '爷爷', '奶奶', '外公', '外婆'],
  亲子: ['孩子', '小孩', '娃', '宝宝', '亲子', '女儿', '儿子', '带娃'],
  情侣: ['情侣', '对象', '爱人', '女朋友', '男朋友', '蜜月'],
  朋友: ['朋友', '同学', '闺蜜', '哥们', '同事'],
  独自: ['一个人', '独自', '自己一个人', '单人'],
  研学: ['研学', '学生团', '学校组织', '夏令营'],
  团队: ['团建', '团队', '公司']
});

/** 市州关键词。刻意不把光秃秃的“吉林”映射到吉林市——那是省名。 */
const AREA_WORDS = Object.freeze({
  长春市: ['长春'],
  吉林市: ['吉林市'],
  延边州: ['延边', '延吉'],
  通化市: ['通化'],
  白山市: ['白山'],
  松原市: ['松原'],
  白城市: ['白城'],
  四平市: ['四平'],
  辽源市: ['辽源']
});

/** 片区关键词：比市州更接近“怎么玩”。 */
const CLUSTER_WORDS = Object.freeze({
  changchun: ['长春', '伪满', '净月潭', '长影', '雕塑园'],
  'jilin-city': ['吉林市', '乌拉街', '北山'],
  songhuahu: ['松花湖'],
  wusong: ['雾凇', '雾凇岛'],
  changbaishan: ['长白山', '天池', '北坡', '西坡', '南坡'],
  chaganhu: ['查干湖', '冬捕'],
  yanbian: ['延边', '延吉', '朝鲜族', '六鼎山', '帽儿山', '防川'],
  jian: ['集安', '高句丽', '好太王', '将军坟', '五女峰'],
  xianghai: ['向海', '莫莫格', '白鹤'],
  siping: ['四平', '辽源', '叶赫']
});

const SEASON_WORDS = Object.freeze({
  winter: ['冬天', '冬季', '下雪', '雪乡', '冰雪季'],
  spring: ['春天', '春季', '花期', '花季', '赏花'],
  summer: ['夏天', '夏季', '避暑', '凉快'],
  autumn: ['秋天', '秋季', '红叶', '秋色']
});

const CN_DIGITS = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };

const MAX_DAYS = 3; // 与 routes 的 1–3 天一致

/** 全角转半角、去空白规范化，便于关键词匹配。 */
function normalize(text) {
  return String(text || '')
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/\s+/g, ' ')
    .trim();
}

function hitsOf(text, words) {
  return words.filter((w) => text.includes(w));
}

function parseDays(text) {
  if (/周末/.test(text)) return { days: 2, raw: 2 };
  if (/(当天|一日游|一天往返)/.test(text)) return { days: 1, raw: 1 };

  const m = text.match(/([0-9]+|[一二两三四五六七八九十])\s*(?:天|日)/);
  if (m) {
    const n = /^[0-9]+$/.test(m[1]) ? Number(m[1]) : CN_DIGITS[m[1]];
    if (Number.isFinite(n) && n > 0) return { days: Math.min(n, MAX_DAYS), raw: n };
  }
  return { days: null, raw: null };
}

function parseMonth(text) {
  const m = text.match(/([0-9]{1,2})\s*月/);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 12 ? n : null;
}

/**
 * 解析一句自然语言。
 * @param {string} text 用户问题
 * @param {{ month?: number, now?: Date }} [options] 参考月份（默认取系统当月）
 * @returns {object} 结构化意图
 */
export function parseIntent(text, options = {}) {
  const raw = normalize(text);
  const {exclusions,positive}=parseExclusions(raw);
  const now = options.now instanceof Date ? options.now : new Date();
  const month = parseMonth(positive) ?? (Number.isInteger(options.month) ? options.month : now.getMonth() + 1);

  const { days, raw: rawDays } = parseDays(positive);

  const themes = [];
  const themeWords = [];
  for (const [theme, words] of Object.entries(THEME_WORDS)) {
    const hit = hitsOf(positive, words);
    if (hit.length) { themes.push(theme); themeWords.push(...hit); }
  }

  const companions = [];
  for (const [who, words] of Object.entries(COMPANION_WORDS)) {
    if (hitsOf(positive, words).length) companions.push(who);
  }

  const areas = [];
  for (const [area, words] of Object.entries(AREA_WORDS)) {
    if (hitsOf(area==='白山市'?positive.replace(/长白山/g,''):positive, words).length) areas.push(area);
  }

  const clusters = [];
  for (const [cluster, words] of Object.entries(CLUSTER_WORDS)) {
    if (hitsOf(positive, words).length) clusters.push(cluster);
  }

  let season = null;
  for (const [s, words] of Object.entries(SEASON_WORDS)) {
    if (hitsOf(positive, words).length) { season = s; break; }
  }
  if (!season) season = SEASON_BY_MONTH[month] ?? null;

  const provinceWide = /吉林(?!市)/.test(positive) && areas.length === 0;

  let signals = exclusions.length;
  if (days) signals += 1;
  signals += companions.length + themes.length + areas.length + clusters.length;
  if (hitsOf(positive, SEASON_WORDS.winter.concat(SEASON_WORDS.spring, SEASON_WORDS.summer, SEASON_WORDS.autumn)).length) signals += 1;

  const confidence = clusters.length || areas.length ? 'high' : themes.length || days ? 'medium' : 'low';

  return {
    text: raw,
    exclusions,
    days,
    daysRequested: rawDays,
    daysClamped: rawDays !== null && rawDays > MAX_DAYS,
    companions,
    themes,
    themeWords,
    areas,
    clusters,
    season,
    month,
    provinceWide,
    signals,
    confidence
  };
}

/** 一句话解释这次解析抓到了什么，用于演示时的“依据”展示。 */
export function describeIntent(intent) {
  const bits = [];
  if (intent.days) bits.push(`${intent.days} 天`);
  if (intent.companions.length) bits.push(intent.companions.join(' / '));
  if (intent.clusters.length || intent.areas.length) {
    bits.push(`想去${[...intent.clusters, ...intent.areas].join('、')}`);
  }
  const themes = intent.themes.filter((t) => !intent.companions.includes(t));
  if (themes.length) bits.push(themes.slice(0, 3).join(' / '));
  if (intent.month) bits.push(`${intent.month} 月`);
  return bits.length ? bits.join(' · ') : '还没抓到明确条件';
}
