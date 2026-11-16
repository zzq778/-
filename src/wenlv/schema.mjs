/**
 * 文旅知识库 schema（wenlv-v1）：枚举、白名单与校验。
 *
 * 设计原则：
 * 1) 会变的字段（票价、开放时间）允许为 null，null 表示“未核对”，不是“没有”；
 * 2) 每条事实必须带官方来源，且域名必须在白名单内；
 * 3) 校验器是纯函数，不联网、不读文件，方便 node:test 直接跑。
 *
 * 字段说明见 docs/WENLV_SCHEMA.md，来源清单见 docs/WENLV_DATA_SOURCES.md。
 */

export const SCHEMA_VERSION = 'wenlv-v1';

/** 与 src/knowledge.mjs 的 REGIONS 保持一致，便于地区筛选复用。 */
export const AREAS = Object.freeze(['长春市', '吉林市', '四平市', '辽源市', '通化市', '白山市', '松原市', '白城市', '延边州']);

/** 文旅片区：比市州更适合排行程（长白山跨延边与白山，雾凇在吉林市）。 */
export const CLUSTERS = Object.freeze([
  'changchun', 'jilin-city', 'songhuahu', 'wusong', 'changbaishan',
  'chaganhu', 'yanbian', 'jian', 'xianghai', 'siping'
]);

/** 片区中文名：前端 chips 与行程标题直接用，避免各处重复写死。 */
export const CLUSTER_LABELS = Object.freeze({
  changchun: '长春都市',
  'jilin-city': '吉林江城',
  songhuahu: '松花湖',
  wusong: '雾凇',
  changbaishan: '长白山',
  chaganhu: '查干湖',
  yanbian: '延边民俗',
  jian: '集安·通化',
  xianghai: '白城湿地',
  siping: '四平·辽源'
});

export const KINDS = Object.freeze(['自然', '人文', '民俗', '遗址', '工业', '冰雪']);
export const SEASONS = Object.freeze(['spring', 'summer', 'autumn', 'winter']);
export const LEVELS = Object.freeze(['5A', '4A', '3A']);
export const CONFIDENCE = Object.freeze(['high', 'medium', 'low']);
export const SOURCE_KINDS = Object.freeze(['gov', 'official', 'operator']);

/** 线路节点在一天里的位置。刻意不写“几点”，避免把时刻表写死。 */
export const ROUTE_SLOTS = Object.freeze(['上午', '午后', '傍晚']);

/** 时令条目的类型：节庆是可预期的活动，花季/观鸟/冰雪是自然窗口。 */
export const EVENT_TYPES = Object.freeze(['节庆', '花季', '观鸟', '冰雪', '民俗', '景致']);

/** 官方入口的类型：政府门户、景区官网、热线、办事服务。 */
export const ENTRY_KINDS = Object.freeze(['gov', 'official', 'hotline', 'service']);

/**
 * 官方域名白名单。只允许政府门户、景区/场馆官网、运营主体官网，
 * 攻略站、点评站、社交平台一律拒绝——它们的票价和位置经常是错的。
 */
export const OFFICIAL_DOMAINS = Object.freeze([
  'jl.gov.cn',            // 吉林省人民政府及省直部门（含 whhlyt.jl.gov.cn）
  'changchun.gov.cn',     // 长春市（含 wglj.changchun.gov.cn）
  'jlcity.gov.cn',        // 吉林市（含 lyj / jlsonghuahu）
  'yanji.gov.cn',         // 延吉市
  'changbaishan.gov.cn',  // 长白山管委会
  'wmhg.com.cn',          // 伪满皇宫博物院
  'ijingyuetan.com',      // 净月潭
  'jindingdafo.com',      // 六鼎山
  'gaogouli-tour.com',    // 集安高句丽
  'cgh.org.cn'            // 查干湖
]);

/** 不落库、但前端需要展示的说明入口（不属于“事实来源”，单独列出）。 */
export const HELPLINE = Object.freeze({
  label: '吉林省 12345 政务服务便民热线',
  tel: '12345'
});

const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const today = () => new Date().toISOString().slice(0, 10);

/** 判断 url 是否落在官方白名单（按后缀匹配，允许子域）。 */
export function isOfficialUrl(url) {
  let host;
  try { host = new URL(url).hostname.toLowerCase(); } catch { return false; }
  return OFFICIAL_DOMAINS.some(domain => host === domain || host.endsWith(`.${domain}`));
}

function checkId(bad, id) {
  if (typeof id !== 'string' || !ID_RE.test(id)) bad.push(`id 不合规：${id}`);
}

function checkName(bad, name, max = 30) {
  if (typeof name !== 'string' || name.trim().length < 2 || name.length > max) bad.push(`name 需 2–${max} 字`);
}

function checkSources(bad, sources) {
  if (!Array.isArray(sources) || sources.length < 1) { bad.push('sources 至少 1 条'); return; }
  for (const source of sources) {
    if (!source || typeof source.url !== 'string') { bad.push('sources 缺少 url'); continue; }
    if (!/^https?:\/\//i.test(source.url)) bad.push(`sources url 协议不合规：${source.url}`);
    else if (!isOfficialUrl(source.url)) bad.push(`sources 域名不在白名单：${source.url}`);
    if (!SOURCE_KINDS.includes(source.kind)) bad.push(`sources.kind 不合规：${source.kind}`);
    if (typeof source.label !== 'string' || !source.label.trim()) bad.push('sources 缺少 label');
  }
}

function checkFreshness(bad, entry) {
  if (typeof entry.verifiedAt !== 'string' || !DATE_RE.test(entry.verifiedAt)) bad.push('verifiedAt 需为 YYYY-MM-DD');
  else if (entry.verifiedAt > today()) bad.push('verifiedAt 不能晚于今天');
  if (!CONFIDENCE.includes(entry.confidence)) bad.push(`confidence 不合规：${entry.confidence}`);
  if (typeof entry.caveat !== 'string' || entry.caveat.trim().length < 8) bad.push('caveat 至少 8 字');
}

/** 返回问题列表；空数组表示通过。 */
export function validateAttraction(entry) {
  const bad = [];
  if (!entry || typeof entry !== 'object') return ['条目必须是对象'];

  checkId(bad, entry.id);
  checkName(bad, entry.name);
  if (!AREAS.includes(entry.area)) bad.push(`area 不在枚举内：${entry.area}`);
  if (!CLUSTERS.includes(entry.cluster)) bad.push(`cluster 不在枚举内：${entry.cluster}`);
  if (!KINDS.includes(entry.kind)) bad.push(`kind 不在枚举内：${entry.kind}`);
  if (!(entry.level === null || LEVELS.includes(entry.level))) bad.push(`level 必须是 ${LEVELS.join('/')} 或 null`);

  if (!Array.isArray(entry.aliases) || entry.aliases.length > 6) bad.push('aliases 需为数组且不超过 6 个');
  else if (entry.aliases.some(a => typeof a !== 'string' || !a.trim())) bad.push('aliases 不能含空值');
  else if (new Set(entry.aliases).size !== entry.aliases.length) bad.push('aliases 不能重复');

  if (!Array.isArray(entry.tags) || entry.tags.length < 1 || entry.tags.length > 6) bad.push('tags 需 1–6 个');
  else if (entry.tags.some(t => typeof t !== 'string' || !t.trim() || t.length > 12)) bad.push('tags 每项需为 1–12 字');

  if (!entry.season || !Array.isArray(entry.season.best) || entry.season.best.length < 1) bad.push('season.best 至少 1 个');
  else if (entry.season.best.some(s => !SEASONS.includes(s))) bad.push('season.best 含非法季节');

  if (!(entry.hours === null || typeof entry.hours === 'string')) bad.push('hours 必须是字符串或 null');
  if (!(entry.ticket === null || typeof entry.ticket === 'string')) bad.push('ticket 必须是字符串或 null');
  if (!(entry.booking === null || typeof entry.booking === 'string')) bad.push('booking 必须是字符串或 null');

  checkSources(bad, entry.sources);
  checkFreshness(bad, entry);

  if ((entry.hours === null || entry.ticket === null) && !String(entry.caveat || '').includes('官方')) {
    bad.push('hours/ticket 为 null 时，caveat 必须提示以官方为准');
  }

  return bad;
}

/**
 * 线路模板：只编排“去哪、按什么顺序、为什么”，不写车程与票价。
 * attractionId 的引用完整性由测试（而非本校验器）检查——本函数不读库。
 */
export function validateRoute(route) {
  const bad = [];
  if (!route || typeof route !== 'object') return ['条目必须是对象'];

  checkId(bad, route.id);
  checkName(bad, route.name, 40);
  if (!Number.isInteger(route.days) || route.days < 1 || route.days > 3) bad.push('days 需为 1–3 的整数');
  if (!CLUSTERS.includes(route.cluster)) bad.push(`cluster 不在枚举内：${route.cluster}`);
  if (!Array.isArray(route.areas) || route.areas.length < 1) bad.push('areas 至少 1 个');
  else if (route.areas.some(a => !AREAS.includes(a))) bad.push('areas 含非法市州');
  if (!Array.isArray(route.themes) || route.themes.length < 1 || route.themes.length > 4) bad.push('themes 需 1–4 个');
  if (!Array.isArray(route.season) || route.season.length < 1) bad.push('season 至少 1 个');
  else if (route.season.some(s => !SEASONS.includes(s))) bad.push('season 含非法季节');

  if (!Array.isArray(route.nodes) || route.nodes.length < 2) bad.push('nodes 至少 2 个节点');
  else {
    const seen = new Set();
    for (const node of route.nodes) {
      if (!node || typeof node !== 'object') { bad.push('node 必须是对象'); continue; }
      if (!Number.isInteger(node.day) || node.day < 1 || node.day > route.days) bad.push(`node.day 超出 ${route.days} 天：${node.day}`);
      if (!ROUTE_SLOTS.includes(node.slot)) bad.push(`node.slot 不合规：${node.slot}`);
      if (typeof node.attractionId !== 'string' || !node.attractionId) bad.push('node 缺少 attractionId');
      else if (seen.has(node.attractionId)) bad.push(`node 重复引用：${node.attractionId}`);
      else seen.add(node.attractionId);
      if (typeof node.why !== 'string' || node.why.trim().length < 4 || node.why.length > 40) bad.push('node.why 需 4–40 字');
    }
    if (!route.nodes.some(node => node.day === 1)) bad.push('nodes 至少要有第 1 天的安排');
  }

  checkSources(bad, route.sources);
  checkFreshness(bad, route);
  return bad;
}

/** 时令条目：月份窗口 + 一句“为什么这时候去”。 */
export function validateEvent(event) {
  const bad = [];
  if (!event || typeof event !== 'object') return ['条目必须是对象'];

  checkId(bad, event.id);
  checkName(bad, event.name, 30);
  if (!CLUSTERS.includes(event.cluster)) bad.push(`cluster 不在枚举内：${event.cluster}`);
  if (!EVENT_TYPES.includes(event.type)) bad.push(`type 不合规：${event.type}`);
  if (!Array.isArray(event.months) || event.months.length < 1) bad.push('months 至少 1 个月份');
  else if (event.months.some(m => !Number.isInteger(m) || m < 1 || m > 12)) bad.push('months 需为 1–12 的整数');
  else if (new Set(event.months).size !== event.months.length) bad.push('months 不能重复');
  if (typeof event.window !== 'string' || event.window.trim().length < 2) bad.push('window 需为简短时间窗文案');
  if (typeof event.why !== 'string' || event.why.trim().length < 8 || event.why.length > 60) bad.push('why 需 8–60 字');

  checkSources(bad, event.sources);
  checkFreshness(bad, event);
  return bad;
}

/** 官方入口：跳转目标，必须是白名单域名或热线。 */
export function validateEntry(entry) {
  const bad = [];
  if (!entry || typeof entry !== 'object') return ['条目必须是对象'];

  checkId(bad, entry.id);
  checkName(bad, entry.name, 40);
  if (!ENTRY_KINDS.includes(entry.kind)) bad.push(`kind 不合规：${entry.kind}`);
  if (typeof entry.url !== 'string' || !/^https?:\/\//i.test(entry.url)) bad.push('url 必须是 http(s) 链接');
  else if (!isOfficialUrl(entry.url)) bad.push(`url 域名不在白名单：${entry.url}`);
  if (typeof entry.scope !== 'string' || entry.scope.trim().length < 2) bad.push('scope 需说明适用范围');
  if (typeof entry.note !== 'string' || entry.note.trim().length < 4) bad.push('note 需 4 字以上');

  checkFreshness(bad, { ...entry, caveat: entry.note.length >= 8 ? entry.note : `${entry.note}，以官方为准。` });
  return bad;
}

/** 摘要：给前端列表用的最小字段，避免把整库塞进页面。 */
export function summary(entry) {
  return {
    id: entry.id,
    name: entry.name,
    area: entry.area,
    kind: entry.kind,
    level: entry.level,
    tags: entry.tags.slice(0, 3),
    verifiedAt: entry.verifiedAt
  };
}
