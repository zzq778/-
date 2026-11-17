/**
 * 流水线测试（D5 A 线）
 *
 * 重点不是“模型答得好不好”，而是“模型不靠谱时产品还站不站得住”：
 * 空回复、超时、报错、跑题、编价格——每一种都要有确定的退路。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { answerWenlv, buildMessages, templateAnswer, itineraryBrief, WENLV_SYSTEM_PROMPT } from '../src/wenlv/pipeline.mjs';
import { isOfficialUrl } from '../src/wenlv/schema.mjs';

const NOW = new Date('2026-11-17T10:00:00+08:00');
const Q = '两天冬天带孩子去哪';

test('没有模型时给模板答案，仍然可展示', async () => {
  const out = await answerWenlv({ question: Q, now: NOW });
  assert.equal(out.usedModel, false);
  assert.equal(out.degraded, true);
  assert.equal(out.reason, 'no-model');
  assert.ok(out.answer.includes('天'));
  assert.ok(out.answer.includes(out.itinerary.plan[0].nodes[0].name));
});

test('模型回答干净时直接采用', async () => {
  const out = await answerWenlv({
    question: Q,
    now: NOW,
    invoke: async () => ({ response: '两天建议在吉林市一线：松花湖看雪，雾凇岛赶早，节奏不赶。' })
  });
  assert.equal(out.usedModel, true);
  assert.equal(out.degraded, false);
  assert.match(out.answer, /松花湖/);
});

test('模型编了票价：整段换成模板，不把改了一半的话给用户', async () => {
  const out = await answerWenlv({
    question: Q,
    now: NOW,
    invoke: async () => ({ response: '松花湖门票 80 元，雾凇岛也不错，两天刚好。' })
  });
  assert.ok(!out.answer.includes('80 元'));
  assert.ok(out.issues.some((i) => i.type === 'unsupported-price'));
  assert.equal(out.degraded, true);
  assert.equal(out.reason, 'sanitized');
  assert.ok(out.answer.includes(out.itinerary.plan[0].nodes[0].name));
});

test('模型给了外部链接：链接被移除，正文保留', async () => {
  const out = await answerWenlv({
    question: Q,
    now: NOW,
    invoke: async () => ({ response: '松花湖见 https://example.com/a ，雾凇岛赶早去。' })
  });
  assert.ok(!out.answer.includes('example.com'));
  assert.ok(out.issues.some((i) => i.type === 'untrusted-url'));
  assert.match(out.answer, /松花湖/);
});

test('模型返回空字符串：退回模板', async () => {
  const out = await answerWenlv({ question: Q, now: NOW, invoke: async () => ({ response: '   ' }) });
  assert.equal(out.reason, 'empty');
  assert.ok(out.answer.includes(out.itinerary.plan[0].nodes[0].name));
});

test('模型抛错：退回模板，不把异常抛给调用方', async () => {
  const out = await answerWenlv({ question: Q, now: NOW, invoke: async () => { throw new Error('upstream 500'); } });
  assert.equal(out.reason, 'model-error');
  assert.equal(out.degraded, true);
  assert.ok(out.answer.length > 10);
});

test('模型超时：退回模板', async () => {
  const out = await answerWenlv({
    question: Q,
    now: NOW,
    timeoutMs: 20,
    invoke: () => new Promise(() => {})
  });
  assert.equal(out.reason, 'timeout');
  assert.ok(out.answer.length > 10);
});

test('模型跑题（没提到任何行程景点）：退回模板', async () => {
  const out = await answerWenlv({
    question: Q,
    now: NOW,
    invoke: async () => ({ response: '今天天气不错，适合出门走走。' })
  });
  assert.equal(out.reason, 'off-topic');
  assert.equal(out.degraded, true);
});

test('提示词把规则写给模型：只能复述、不许编价格', async () => {
  assert.match(WENLV_SYSTEM_PROMPT, /只能提到结构里出现的景点名称/);
  assert.match(WENLV_SYSTEM_PROMPT, /不得写票价/);
  assert.match(WENLV_SYSTEM_PROMPT, /不得使用“保证”/);
});

test('发给模型的消息里带全节点与交代口径，不含票价数字', async () => {
  const out = await answerWenlv({ question: Q, now: NOW });
  const messages = buildMessages(out.itinerary, Q);
  const userText = messages.at(-1).content;
  for (const node of out.itinerary.plan.flatMap((d) => d.nodes)) assert.ok(userText.includes(node.name));
  assert.match(userText, /以景区官方公告为准/);
  assert.ok(!/\d+\s*元|¥\d+/.test(userText));
});

test('模板答案包含提醒段落，且不出现价格', async () => {
  const out = await answerWenlv({ question: '12月去查干湖看冬捕', now: NOW });
  const text = templateAnswer(out.itinerary);
  assert.match(text, /天/);
  assert.ok(!/\d+\s*元|¥\d+/.test(text));
});

test('行程结构里的来源都是官方域名', async () => {
  const out = await answerWenlv({ question: Q, now: NOW });
  assert.ok(out.itinerary.sources.length >= 1);
  for (const s of out.itinerary.sources) assert.ok(isOfficialUrl(s.url), s.url);
});

test('同样的输入与同样的模型输出得到同样的答案', async () => {
  const invoke = async () => ({ response: '两天在吉林市看松花湖与雾凇岛，节奏轻松。' });
  const a = await answerWenlv({ question: Q, now: NOW, invoke });
  const b = await answerWenlv({ question: Q, now: NOW, invoke });
  assert.equal(a.answer, b.answer);
  assert.deepEqual(a.itinerary, b.itinerary);
});

test('空问题也能给出兜底答案，不抛异常', async () => {
  const out = await answerWenlv({ question: '', now: NOW });
  assert.ok(out.answer.length > 5);
  assert.ok(out.itinerary.warnings.some((w) => w.type === 'fallback'));
});

test('itineraryBrief 是纯文本清单，便于模型复述', async () => {
  const out = await answerWenlv({ question: Q, now: NOW });
  const brief = itineraryBrief(out.itinerary);
  assert.match(brief, /天数：\d/);
  assert.match(brief, /为什么：/);
  assert.ok(!brief.includes('<'));
});
