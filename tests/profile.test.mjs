import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const CODE = read('public/profile.js');
const empty = { gender: '', age: null, phone: '', job: '', unit: '' };

function memory(initial = {}) {
  const store = { ...initial };
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };
}

// 个人信息模块不依赖 DOM 就能加载：给一个假的 window 与 localStorage 即可跑纯数据逻辑
function mount(storage = memory()) {
  const window = {};
  new Function('window', 'localStorage', CODE)(window, storage);
  return { api: window.JZZX_PROFILE, storage };
}

test('默认是空档案，入口用字段名占位', () => {
  const { api } = mount();
  assert.deepEqual(api.load(), empty);
  assert.equal(api.KEY, 'jzzx-profile-v01');
  assert.equal(api.summary(api.load()), '性别、年龄、手机号、职业、单位');
});

test('保存后原样读回，入口摘要不含手机号', () => {
  const { api } = mount();
  const data = { gender: '女', age: 32, phone: '13800138000', job: '教师', unit: '吉林大学' };
  assert.equal(api.save(data), true);
  assert.deepEqual(api.load(), data);
  assert.equal(api.summary(api.load()), '女 · 32 岁 · 教师 · 吉林大学');
  assert.ok(!api.summary(api.load()).includes('13800138000'));
});

test('脏数据逐字段校正：非法性别/年龄/手机号被清空，文本被压缩', () => {
  const storage = memory({
    'jzzx-profile-v01': JSON.stringify({ gender: '外星人', age: 999, phone: '123', job: '  社区   网格员  ', unit: 'x'.repeat(40) })
  });
  const { api } = mount(storage);
  const p = api.load();
  assert.equal(p.gender, '');
  assert.equal(p.age, null);
  assert.equal(p.phone, '');
  assert.equal(p.job, '社区 网格员');
  assert.equal(p.unit, 'x'.repeat(30));
});

test('手机号：留空通过，11 位有效号通过，错误格式被拦', () => {
  const { api } = mount();
  assert.equal(api.validate({ ...empty, phone: '' }).ok, true);
  assert.equal(api.validate({ ...empty, phone: '13800138000' }).ok, true);
  const bad = api.validate({ ...empty, phone: '12345678901' });
  assert.equal(bad.ok, false);
  assert.match(bad.error, /11 位/);
});

test('年龄边界 1–120，超出与 0 都被拦', () => {
  const { api } = mount();
  assert.equal(api.validate({ ...empty, age: 1 }).ok, true);
  assert.equal(api.validate({ ...empty, age: 120 }).ok, true);
  assert.equal(api.validate({ ...empty, age: 121 }).ok, false);
  assert.equal(api.validate({ ...empty, age: 0 }).ok, false);
});

test('选项：性别三项，年龄 1–120，滚轮步长 44px', () => {
  const { api } = mount();
  assert.deepEqual(api.GENDERS, ['男', '女', '不便透露']);
  assert.equal(api.AGES.length, 120);
  assert.equal(api.AGES[0], '1');
  assert.equal(api.AGES.at(-1), '120');
  assert.equal(api.STEP, 44);
});

test('弹层含两个滚轮与三个输入框，用户输入被 HTML 转义', () => {
  const storage = memory({
    'jzzx-profile-v01': JSON.stringify({ gender: '男', age: 8, phone: '13800138000', job: '<img src=x onerror=alert(1)>', unit: '"quoted"' })
  });
  const { api } = mount(storage);
  const html = api.sheet();
  assert.match(html, /id="personalForm"/);
  assert.equal((html.match(/data-wheel="/g) || []).length, 2);
  assert.match(html, /data-wheel="gender"/);
  assert.match(html, /data-wheel="age"/);
  assert.equal((html.match(/class="input-row"/g) || []).length, 3);
  assert.ok(html.includes('&lt;img'));
  assert.ok(!html.includes('<img'));
  assert.ok(html.includes('&quot;quoted&quot;'));
  assert.match(html, /role="listbox"/);
});

test('没有存储权限时不抛错，只返回保存失败', () => {
  const { api } = mount({ getItem: () => null, setItem: () => { throw new Error('QuotaExceeded'); } });
  assert.equal(api.save({ gender: '男', age: 1, phone: '', job: '', unit: '' }), false);
  assert.deepEqual(api.load(), empty);
});

test('页面接线：我的入口、弹层、脚本顺序、离线缓存', () => {
  const app = read('public/app.js');
  const index = read('public/index.html');
  const sw = read('public/sw.js');
  assert.match(app, /data-action="personal"/);
  assert.match(app, /state\.modal==='personal'/);
  assert.match(app, /id==='personalForm'/);
  const p = index.indexOf('./profile.js');
  assert.ok(p > 0, 'index.html 应引入 profile.js');
  assert.ok(p < index.indexOf('./app.js'), 'profile.js 必须在 app.js 之前加载');
  assert.match(sw, /'\.\/profile\.js'/);
  assert.match(sw, /const CACHE='jzzx-(?:ai|travel)-v\d{3}';/, '离线缓存名应带版本号，便于升级时淘汰旧缓存');
});

test('样式与滚轮步长一致：可视三行、每行 44px', () => {
  const css = read('public/styles.css');
  assert.match(css, /scroll-snap-type:y mandatory/);
  assert.match(css, /\.wheel\{[^}]*height:132px/);
  assert.match(css, /\.wheel-option\{[^}]*height:44px/);
  assert.match(css, /\.wheel-band\{/);
});
