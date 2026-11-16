// 政策解读库的数据守门测试：不需要网络，纯静态校验 public/policies.js。
// 目的：任何一条政策缺少官方原文链接、日期、原文要点或解读，都会在这里失败，
// 避免把“看起来像政策”的内容合进页面。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const CODE = readFileSync(fileURLToPath(new URL('../public/policies.js', import.meta.url)), 'utf8');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(CODE, sandbox, { filename: 'policies.js' });
const LIBRARY = sandbox.window.POLICY_LIBRARY;

const OFFICIAL_HOST = /^https?:\/\/(?:[a-z0-9-]+\.)*(?:jl\.gov\.cn)(?:\/|$)/i;
const TOPICS = new Set(['pension', 'medical', 'cert', 'policy', 'nearby', 'work']);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PLACEHOLDER = /待补充|待核实|TODO|FIXME|示例政策|占位/;

const items = () => (Array.isArray(LIBRARY?.items) ? LIBRARY.items : []);

test('政策库存在且标注核验日期', () => {
  assert.ok(LIBRARY, 'window.POLICY_LIBRARY 未定义');
  assert.match(String(LIBRARY.verifiedAt), DATE);
});

test('至少收录 5 条政策', () => {
  assert.ok(items().length >= 5, `只有 ${items().length} 条`);
});

test('政策 ID 唯一且是稳定 slug', () => {
  const ids = items().map(x => x.id);
  assert.equal(new Set(ids).size, ids.length, '存在重复 id');
  for (const id of ids) assert.match(String(id), /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
});

test('每条政策都有官方原文链接（吉林省域名）', () => {
  for (const item of items()) {
    assert.ok(OFFICIAL_HOST.test(item.url), `${item.id} 的链接不是官方域名：${item.url}`);
    assert.doesNotMatch(item.url, /\s/, `${item.id} 的链接含空白`);
  }
});

test('每条政策的标题、发文机关、发布日期齐备', () => {
  for (const item of items()) {
    assert.ok(item.title.length >= 8 && item.title.length <= 200, `${item.id} 标题长度异常`);
    assert.doesNotMatch(item.title, PLACEHOLDER, `${item.id} 标题像占位符`);
    assert.ok(String(item.issuer || '').length >= 4, `${item.id} 缺发文机关`);
    assert.match(String(item.publishedAt), DATE, `${item.id} 发布日期格式错误`);
    assert.ok(TOPICS.has(item.topic), `${item.id} topic 非法：${item.topic}`);
  }
});

test('每条政策都有 3 条以上原文要点', () => {
  for (const item of items()) {
    assert.ok(Array.isArray(item.keyFacts), `${item.id} keyFacts 不是数组`);
    assert.ok(item.keyFacts.length >= 3, `${item.id} 只有 ${item.keyFacts.length} 条要点`);
    for (const fact of item.keyFacts) {
      assert.ok(fact.length >= 8 && fact.length <= 90, `${item.id} 要点长度异常：${fact}`);
      assert.doesNotMatch(fact, PLACEHOLDER, `${item.id} 要点像占位符`);
    }
  }
});

test('每条政策都有完整解读（一句话 / 适用人群 / 行动 / 提醒）', () => {
  for (const item of items()) {
    const d = item.digest || {};
    assert.ok(String(d.oneLine || '').length >= 10, `${item.id} 缺一句话解读`);
    assert.ok(String(d.who || '').length >= 4, `${item.id} 缺适用人群`);
    assert.ok(Array.isArray(d.actions) && d.actions.length >= 1, `${item.id} 缺行动建议`);
    assert.ok(Array.isArray(d.cautions) && d.cautions.length >= 1, `${item.id} 缺注意事项`);
    for (const text of [d.oneLine, d.who, ...d.actions, ...d.cautions]) {
      assert.doesNotMatch(String(text), PLACEHOLDER, `${item.id} 解读含占位符`);
    }
  }
});

test('解读不冒充官方口径、不承诺不存在的线上办理', () => {
  for (const item of items()) {
    const text = [item.digest?.oneLine, item.digest?.who, ...(item.digest?.actions || [])].join(' ');
    assert.doesNotMatch(text, /官方解读|官方解释/, `${item.id} 把项目组解读写成官方口径`);
    assert.doesNotMatch(text, /一定|保证|百分之百/, `${item.id} 出现绝对化承诺`);
  }
});

test('前端已接入政策库（脚本、列表态、详情态都在）', () => {
  const html = readFileSync(fileURLToPath(new URL('../public/index.html', import.meta.url)), 'utf8');
  const app = readFileSync(fileURLToPath(new URL('../public/app.js', import.meta.url)), 'utf8');
  const sw = readFileSync(fileURLToPath(new URL('../public/sw.js', import.meta.url)), 'utf8');
  assert.match(html, /src="\.\/policies\.js"/);
  assert.ok(html.indexOf('policies.js') < html.indexOf('app.js'), 'policies.js 必须在 app.js 之前加载');
  assert.match(app, /window\.POLICY_LIBRARY/);
  assert.match(app, /policy-list/);
  assert.match(app, /policyById/);
  assert.match(sw, /\.\/policies\.js/, '离线缓存需要包含 policies.js');
});
