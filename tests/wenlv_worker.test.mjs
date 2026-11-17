/**
 * Worker 契约测试（D5 A 线）
 *
 * 只验证接口这一层：mode=wenlv 走文旅流水线，原有模式与错误码不变，
 * 没有 AI 绑定时文旅仍能答（模板），而旧路径仍然 503——契约不能被顺手改掉。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { handleApi } from '../src/worker.mjs';
import { isOfficialUrl } from '../src/wenlv/schema.mjs';

const post = (payload, init = {}) => new Request('https://jzzx.example/api/chat', {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: 'https://jzzx.example' },
  body: JSON.stringify(payload),
  ...init
});

const wenlvEnv = (overrides = {}) => ({
  AI: { run: async () => ({ response: '两天在吉林市看松花湖与雾凇岛，节奏轻松。' }) },
  LIMITER: { limit: async () => ({ success: true }) },
  ...overrides
});

test('mode=wenlv 返回行程结构与可读答案', async () => {
  const resp = await handleApi(post({ question: '两天冬天带孩子去哪', mode: 'wenlv' }), wenlvEnv());
  assert.equal(resp.status, 200);
  const data = await resp.json();
  assert.equal(data.mode, 'wenlv');
  assert.ok(data.text.length > 10);
  assert.ok(Array.isArray(data.itinerary.plan) && data.itinerary.plan.length >= 1);
  assert.ok(data.itinerary.sources.length >= 1);
  for (const s of data.itinerary.sources) assert.ok(isOfficialUrl(s.url));
  assert.ok(data.actions.some((a) => a.type === 'itinerary'));
});

test('没有 AI 绑定时文旅仍能回答（模板），不再 503', async () => {
  const resp = await handleApi(post({ question: '两天冬天带孩子去哪', mode: 'wenlv' }), { LIMITER: { limit: async () => ({ success: true }) } });
  assert.equal(resp.status, 200);
  const data = await resp.json();
  assert.equal(data.model, 'wenlv-template');
  assert.equal(data.degraded, true);
  assert.ok(data.text.length > 10);
});

test('模型编价格时，返回文本已被改写', async () => {
  const env = wenlvEnv({ AI: { run: async () => ({ response: '松花湖门票 80 元，雾凇岛也不远。' }) } });
  const resp = await handleApi(post({ question: '两天冬天带孩子去哪', mode: 'wenlv' }), env);
  const data = await resp.json();
  assert.ok(!data.text.includes('80 元'));
  assert.ok(data.issues.length >= 1);
  assert.equal(data.degraded, true);
});

test('模型报错时返回模板答案而不是 503', async () => {
  const env = wenlvEnv({ AI: { run: async () => { throw new Error('boom'); } } });
  const resp = await handleApi(post({ question: '两天冬天带孩子去哪', mode: 'wenlv' }), env);
  assert.equal(resp.status, 200);
  const data = await resp.json();
  assert.equal(data.reason, 'model-error');
  assert.ok(data.text.length > 10);
});

test('原有模式不受影响：无 AI 仍返回 503 NO_AI', async () => {
  const resp = await handleApi(post({ question: '医保报销' }), { LIMITER: { limit: async () => ({ success: true }) } });
  assert.equal(resp.status, 503);
  const data = await resp.json();
  assert.equal(data.error, 'NO_AI');
});

test('跨站请求仍然被拒（403）', async () => {
  const resp = await handleApi(
    post({ question: '两天去哪', mode: 'wenlv' }, { headers: { 'content-type': 'application/json', origin: 'https://evil.example' } }),
    wenlvEnv()
  );
  assert.equal(resp.status, 403);
});

test('限流对文旅模式同样生效（429）', async () => {
  const resp = await handleApi(
    post({ question: '两天去哪', mode: 'wenlv' }),
    wenlvEnv({ LIMITER: { limit: async () => ({ success: false }) } })
  );
  assert.equal(resp.status, 429);
});

test('非 JSON 请求体依旧 415', async () => {
  const resp = await handleApi(
    new Request('https://jzzx.example/api/chat', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: 'hi' }),
    wenlvEnv()
  );
  assert.equal(resp.status, 415);
});

test('/api/status 语义未变：无 AI 时 unconfigured', async () => {
  const resp = await handleApi(new Request('https://jzzx.example/api/status'), {});
  const data = await resp.json();
  assert.equal(data.ready, false);
  assert.equal(data.mode, 'unconfigured');
});
