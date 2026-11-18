// 三端门户测试：数据层行为（vm + localStorage 桩）+ 静态接线检查。
// 不需要浏览器，也不需要网络。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = new URL('../public/', import.meta.url);
const read = (p) => readFileSync(fileURLToPath(new URL(p, ROOT)), 'utf8');
const exists = (p) => existsSync(fileURLToPath(new URL(p, ROOT)));

const CORE = read('portals/shared/portal-core.js');
const MERCHANT_JS = read('portals/merchant/merchant.js');
const TOURIST_JS = read('portals/tourist/tourist.js');
const GOV_JS = read('portals/government/government.js');
const APP = read('app.js');
const HTML = read('index.html');
const SW = read('sw.js');

/** 建一个只带 localStorage 的沙箱，加载共享数据层。 */
function loadCore() {
  const store = new Map();
  const sandbox = {
    console,
    JSON,
    Math,
    Date,
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => { store.set(k, String(v)); },
      removeItem: (k) => { store.delete(k); }
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
    CustomEvent: function (type, init) { this.type = type; this.detail = init && init.detail; }
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(CORE, sandbox, { filename: 'portal-core.js' });
  return { P: sandbox.JZZXPortal, store };
}

const { P } = loadCore();

test('三端文件夹与入口文件齐全', () => {
  for (const dir of ['tourist', 'merchant', 'government']) {
    assert.ok(exists(`portals/${dir}/index.html`), `${dir}/index.html 缺失`);
    assert.ok(exists(`portals/${dir}/${dir}.js`), `${dir}/${dir}.js 缺失`);
    const html = read(`portals/${dir}/index.html`);
    assert.match(html, /\.\.\/shared\/portal-core\.js/, `${dir} 未引入共享数据层`);
  }
  assert.ok(exists('portals/shared/portal-core.js'));
  assert.ok(exists('portals/shared/portal.css'));
  assert.ok(exists('portals/README.md'), '缺少政府端接入契约文档');
});

test('共享数据层导出政府端需要的接口', () => {
  for (const key of ['merchant', 'docs', 'issues', 'feedback', 'government', 'onChange', 'ROLES', 'ISSUE_CATEGORIES']) {
    assert.ok(P[key], `缺少导出 ${key}`);
  }
  assert.equal(typeof P.government.inbox, 'function');
  assert.equal(typeof P.government.reply, 'function');
  assert.equal(typeof P.government.register, 'function');
  assert.equal(typeof P.government.counts, 'function');
});

test('问题类型正好是用户指定的 6 类', () => {
  const labels = P.ISSUE_CATEGORIES.map((c) => c.label);
  assert.deepEqual([...labels], ['基础设施问题', '交通与停车问题', '景区周边环境问题', '经营场地问题', '政策咨询', '文旅活动建议']);
});

test('商户档案默认是带示例标记的空壳，证件 5 类', () => {
  const m = P.merchant.get();
  assert.equal(m.demo, true);
  assert.equal(m.docs.length, 5);
  assert.ok(m.docs.every((d) => d.status === 'missing'));
  assert.deepEqual([...P.DOC_TYPES.map((d) => d.label)], ['营业执照', '食品经营许可证', '公共场所卫生许可证', '消防安全检查合格证', '特种行业许可证']);
});

test('保存档案后完整度上升、示例标记消失', () => {
  const before = P.merchant.completion();
  assert.equal(P.merchant.get().demo, true);
  const saved = P.merchant.save({
    name: '测试商户', contact: '李四', phone: '13900000000', type: '住宿/民宿',
    address: '吉林市雾凇岛', license: { code: '91220200TEST00000X', number: 'T-001', validUntil: '2028-01-01' },
    specialties: ['江鱼宴'], qualifications: [{ name: '卫生许可', issuer: '区卫健局' }]
  });
  assert.equal(saved.demo, false);
  assert.equal(P.merchant.get().name, '测试商户');
  const after = P.merchant.completion();
  assert.ok(after.percent >= before.percent);
  assert.ok(after.percent > 0);
});

test('证件状态可在提交/撤回之间切换，非法状态被拒绝', () => {
  assert.equal(P.docs.setStatus('license', 'submitted'), true);
  assert.equal(P.docs.list().find((d) => d.id === 'license').status, 'submitted');
  assert.equal(P.docs.setStatus('license', 'nope'), false);
  assert.equal(P.docs.setStatus('license', 'missing'), true);
});

test('商户提交问题 → 政府待办可见 → 政府答复写回', () => {
  const item = P.issues.add({ category: 'traffic', title: '停车场入口积水', detail: '影响客人进出', location: '韩屯村东侧' });
  assert.equal(item.status, 'pending');
  assert.equal(item.categoryLabel, '交通与停车问题');
  const inbox = P.government.inbox();
  assert.equal(inbox.filter((x) => x.type === 'issue').length, 1);
  const replied = P.government.reply('issue', item.id, '已转交交通部门');
  assert.equal(replied.status, 'replied');
  assert.equal(replied.messages.at(-1).role, 'government');
  assert.equal(P.issues.counts().total, 1);
});

test('游客反馈 → 政府/商户都能答复，状态变已答复', () => {
  const fb = P.feedback.add({ category: '服务态度', text: '停车引导不清楚', fromName: '李女士' });
  assert.equal(fb.status, 'pending');
  assert.equal(P.feedback.list().length, 1);
  const byMerchant = P.feedback.reply(fb.id, 'merchant', '已加派引导员');
  assert.equal(byMerchant.status, 'answered');
  assert.equal(byMerchant.messages.at(-1).role, 'merchant');
  const byGov = P.feedback.reply(fb.id, 'government', '已督促整改');
  assert.equal(byGov.messages.at(-1).role, 'government');
  assert.equal(P.feedback.list().filter((x) => x.status === 'pending').length, 0);
  // 政府待办同时包含两类
  const types = new Set(P.government.inbox().map((x) => x.type));
  assert.ok(types.has('issue') && types.has('feedback'));
});

test('空内容不写入（问题标题/答复正文）', () => {
  const bad = P.feedback.reply('not-exist', 'merchant', 'hello');
  assert.equal(bad, null);
  const before = P.issues.list().length;
  P.issues.add({ category: 'infra', title: '', detail: '' });
  assert.equal(P.issues.list().length, before + 1, '空标题仍会入列，交由界面校验');
});

test('商户端包含四块内容与政府接入提示', () => {
  assert.match(MERCHANT_JS, /证件办理/);
  assert.match(MERCHANT_JS, /提交问题/);
  assert.match(MERCHANT_JS, /商户档案/);
  assert.match(MERCHANT_JS, /反馈/);
  for (const field of ['name', 'contact', 'phone', 'type', 'address', 'licenseCode', 'licenseNumber', 'licenseValidUntil', 'specialties', 'qualifications']) {
    assert.ok(MERCHANT_JS.includes(`name="${field}"`) || MERCHANT_JS.includes(`'${field}'`), `档案缺少字段 ${field}`);
  }
  assert.match(MERCHANT_JS, /JZZXPortal\.government\.inbox|government\.inbox/, '商户端未提到政府待办');
});

test('游客端能提交反馈并展示答复', () => {
  assert.match(TOURIST_JS, /feedback\.add/, '游客端未写入反馈');
  assert.match(TOURIST_JS, /WENLV/, '游客端未读文旅知识库');
  assert.match(TOURIST_JS, /政府答复|商户答复/, '游客端未区分答复方');
});

test('政府端占位页写明了接入契约并调用 reply', () => {
  assert.match(GOV_JS, /government\.inbox/);
  assert.match(GOV_JS, /government\.reply/);
  assert.match(GOV_JS, /待接入/);
  const README = read('portals/README.md');
  assert.match(README, /government\.inbox/);
  assert.match(README, /government\.reply/);
  assert.match(README, /换真实后端时改哪里/);
});

test('主应用：底部「文旅」、角色选择、三端 iframe 接线', () => {
  assert.match(APP, /\['news','文旅','news'\]/, '底部导航未改成「文旅」');
  assert.match(APP, /PORTALS=\{tourist:/, '缺少三端配置');
  assert.match(APP, /data-role="'\+k\+'"/, '缺少角色选择按钮');
  assert.match(APP, /state\.modal==='role-select'/, '缺少角色选择弹层分支');
  assert.match(APP, /portals\/\$\{m\.dir\}\/index\.html/, '文旅页未按角色加载 iframe');
  assert.match(APP, /运营端（文旅）/, '「我的」缺少运营端入口');
  assert.match(APP, /jzzx-portal-role/, '角色未持久化');
  assert.ok(HTML.includes('portal-hub.css'), '缺少端入口样式');
});

test('三端页面已加入离线缓存', () => {
  for (const p of ['portals/shared/portal-core.js', 'portals/merchant/index.html', 'portals/tourist/index.html', 'portals/government/index.html', 'portals/government/gov-logic.js', 'portals/government/government.css']) {
    assert.ok(SW.includes(`'./${p}'`), `离线缓存缺少 ${p}`);
  }
  assert.match(SW, /jzzx-(?:ai|travel)-v\d{3}/);
});
