/**
 * 文旅问答流水线（wenlv-v1，D5 A 线）
 *
 * 五步：解析意图 → 检索 → 编排 → 模型只写措辞 → 引用校验。
 * 前两步在 D3，第三、五步在 D4，这里把它们串起来，并给模型划死边界：
 *
 *   - 结构（去哪、顺序、理由、来源）一律由代码给，模型只能复述；
 *   - 模型没返回、超时、跑题、说了库外事实 → 退回模板答案，界面照常可用；
 *   - 没有 AI 绑定也能回答（模板路线），现场断网/没配额时不至于空白。
 *
 * 这样“能用”“可解释”“不编造”三件事互不牵连：模型差一点，产品不会跟着塌。
 */
import { parseIntent } from './intent.mjs';
import { retrieve } from './search.mjs';
import { buildItinerary } from './plan.mjs';
import { guardAnswer, buildFacts } from './guard.mjs';

export const WENLV_SYSTEM_PROMPT = [
  '你是「吉小知」，吉林省文旅行程助手，面向普通游客。',
  '下面的“行程结构”由系统按已核对的知识库算好，你只能复述它，不许增删景点。',
  '硬规则：',
  '1. 只能提到结构里出现的景点名称，不得新增任何景点、线路或事实；',
  '2. 不得写票价、开放时间、车程时长、预约名额——库里没有这些，统一说“以景区官方公告为准”；',
  '3. 不得使用“保证”“100%”“官方指定”“绝对”等绝对化说法；',
  '4. 不得输出网址、图片、表格或 Markdown 标题；',
  '5. 用口语化中文，先给结论，再按天说安排，最后加一句提醒，总长不超过 220 字。'
].join('\n');

/** 把行程结构压成模型能读的纯文本（不含任何库外事实）。 */
export function itineraryBrief(itinerary) {
  const lines = [`天数：${itinerary.days}`];
  for (const day of itinerary.plan) {
    for (const node of day.nodes) {
      lines.push(`- 第${day.day}天 ${node.slot}：${node.name}（${node.area}）｜为什么：${node.why}`);
    }
  }
  for (const w of itinerary.warnings) lines.push(`- 注意：${w.message}`);
  lines.push(`- 交代口径：票价与开放时间以景区官方公告为准`);
  return lines.join('\n');
}

export function buildMessages(itinerary, question) {
  return [
    { role: 'system', content: WENLV_SYSTEM_PROMPT },
    { role: 'user', content: `用户的问题：${question}\n\n行程结构：\n${itineraryBrief(itinerary)}` }
  ];
}

/** 不依赖模型的答案：结构 + 提醒，读起来也完整。 */
export function templateAnswer(itinerary) {
  const head = `给你排了 ${itinerary.days} 天：`;
  const days = itinerary.plan.map((day) => {
    const parts = day.nodes.map((n) => `${n.slot}去${n.name}（${n.why}）`);
    return `${day.title.replace(/^第 \d 天 · /, '第 ' + day.day + ' 天 ')}：${parts.join('；')}。`;
  });
  const warnings = itinerary.warnings
    .filter((w) => w.type !== 'fallback')
    .map((w) => w.message);
  const tail = warnings.length ? warnings.join(' ') : '出发前请以景区官方公告确认开放时间与票价。';
  return [head, ...days, tail].join('\n');
}

const pickText = (result) => {
  if (typeof result === 'string') return result.trim();
  if (!result) return '';
  if (typeof result.response === 'string') return result.response.trim();
  if (typeof result.output_text === 'string') return result.output_text.trim();
  const choice = result.choices?.[0]?.message?.content;
  return typeof choice === 'string' ? choice.trim() : '';
};

/** 答案里至少要点到一个行程里的景点，否则就是跑题。 */
function coversPlan(answer, itinerary) {
  const names = itinerary.plan.flatMap((d) => d.nodes).map((n) => n.name);
  return names.some((name) => answer.includes(name));
}

async function withTimeout(promise, ms) {
  let timer;
  try {
    return await Promise.race([promise, new Promise(resolve => {
      timer = setTimeout(() => resolve({ __timeout: true }), ms);
    })]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 跑完整流水线。
 * @param {object} options
 * @param {string} options.question 用户问题
 * @param {Date} [options.now] 当前时间（影响季节与时效判断，便于测试）
 * @param {((messages:object[]) => Promise<any>)|null} [options.invoke] 调用模型；为 null 时走模板
 * @param {number} [options.timeoutMs]
 */
export async function answerWenlv({ question, now = new Date(), invoke = null, timeoutMs = 9000 }) {
  const intent = parseIntent(question, { now });
  const retrieval = retrieve(intent);
  const itinerary = buildItinerary(intent, retrieval);
  const facts = buildFacts(itinerary);
  const fallback = templateAnswer(itinerary);

  const base = { intent, retrieval, itinerary, mode: 'wenlv' };
  if (!itinerary.plan.some(day => day.nodes.length)) {
    return {...base,answer:'现有知识库中没有同时满足这些条件的景点。请放宽目的地或排除条件后重新规划。',issues:[],usedModel:false,degraded:true,reason:'no-match'};
  }

  if (typeof invoke !== 'function') {
    return { ...base, answer: fallback, issues: [], usedModel: false, degraded: true, reason: 'no-model' };
  }

  let raw = '';
  try {
    const result = await withTimeout(Promise.resolve(invoke(buildMessages(itinerary, question))), timeoutMs);
    if (result?.__timeout) {
      return { ...base, answer: fallback, issues: [], usedModel: true, degraded: true, reason: 'timeout' };
    }
    raw = pickText(result);
  } catch {
    return { ...base, answer: fallback, issues: [], usedModel: true, degraded: true, reason: 'model-error' };
  }

  if (!raw) {
    return { ...base, answer: fallback, issues: [], usedModel: true, degraded: true, reason: 'empty' };
  }

  const verdict = guardAnswer(raw, facts);
  if (!coversPlan(verdict.patched, itinerary)) {
    return { ...base, answer: fallback, issues: verdict.issues, usedModel: true, degraded: true, reason: 'off-topic' };
  }

  const severe = verdict.issues.some((i) => i.severity === 'high');
  if (severe) {
    // 模型说了库外事实：不把“改了一半”的句子给用户看，直接换模板，问题记录在 issues 里。
    return { ...base, answer: fallback, issues: verdict.issues, usedModel: true, degraded: true, reason: 'sanitized' };
  }
  return {
    ...base,
    answer: verdict.patched,
    issues: verdict.issues,
    usedModel: true,
    degraded: verdict.issues.length > 0,
    reason: verdict.issues.length ? 'patched' : null
  };
}
