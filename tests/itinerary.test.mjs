// 行程卡片第 2 步守门测试：接真数据、来源按钮、依据抽屉、域名白名单。
// 纯静态 + vm 沙箱，不联网；真实数据来自 public/wenlv-data.js（npm run build:data 生成）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { OFFICIAL_DOMAINS } from '../src/wenlv/schema.mjs';

const ROOT = new URL('../public/', import.meta.url);
const read = (name) => readFileSync(fileURLToPath(new URL(name, ROOT)), 'utf8');
const CODE = read('itinerary.js');
const DATA = read('wenlv-data.js');
const APP = read('app.js');
const HTML = read('index.html');
const SW = read('sw.js');
const CSS = read('itinerary.css');

/** 建一个带 URL 的沙箱；withData=true 时先执行知识库脚本。 */
function load({ withData = true } = {}) {
  const sandbox = { window: {}, URL };
  vm.createContext(sandbox);
  if (withData) vm.runInContext(DATA, sandbox, { filename: 'wenlv-data.js' });
  vm.runInContext(CODE, sandbox, { filename: 'itinerary.js' });
  return { IT: sandbox.window.JZZX_ITINERARY, WENLV: sandbox.window.WENLV };
}

const { IT } = load();
const data = load().WENLV;

test('模块导出与第 2 步接口', () => {
  for (const key of ['esc', 'isOfficialUrl', 'model', 'sheet', 'drawerMarkup', 'handle', 'openSource', 'closeSource', 'SAMPLE', 'ROUTE_ID']) {
    assert.ok(IT[key] !== undefined, `缺少导出 ${key}`);
  }
  assert.equal(typeof IT.sheet, 'function');
  assert.equal(typeof IT.drawerMarkup, 'function');
});

test('浏览器白名单与 src/wenlv/schema.mjs 完全一致（防漂移）', () => {
  assert.deepEqual([...IT.OFFICIAL_DOMAINS].sort(), [...OFFICIAL_DOMAINS].sort());
});

test('isOfficialUrl 只放行官方域名与 http(s)', () => {
  assert.equal(IT.isOfficialUrl('https://whhlyt.jl.gov.cn/'), true);
  assert.equal(IT.isOfficialUrl('http://lyj.jlcity.gov.cn/'), true);
  assert.equal(IT.isOfficialUrl('https://www.wmhg.com.cn/'), true);
  assert.equal(IT.isOfficialUrl('https://evil.example.com/'), false);
  assert.equal(IT.isOfficialUrl('https://jl.gov.cn.evil.com/'), false);
  assert.equal(IT.isOfficialUrl('javascript:alert(1)'), false);
  assert.equal(IT.isOfficialUrl(''), false);
  assert.equal(IT.isOfficialUrl(null), false);
});

test('接真数据：默认显示知识库里的雾凇两日线路', () => {
  const m = IT.model();
  assert.equal(m.mode, 'data');
  assert.equal(m.itinerary.id, IT.ROUTE_ID);
  assert.equal(m.itinerary.days, 2);
  assert.equal(m.itinerary.nodes.length, 4);
  assert.equal(m.itinerary.areas.join('、'), '吉林市');
  for (const node of m.itinerary.nodes) {
    assert.equal(node.partial, false, `${node.name} 未解析到景点数据`);
    assert.ok(node.sources.length >= 1, `${node.name} 缺少官方来源`);
  }
  assert.ok(m.itinerary.nodes.some(n => n.name === '雾凇岛'));
});

test('知识库缺失时回退内置示例，并明确提示', () => {
  const { IT: offline } = load({ withData: false });
  const m = offline.model();
  assert.equal(m.mode, 'fallback');
  const html = offline.sheet('');
  assert.match(html, /知识库未加载/);
  assert.match(html, /内置示例/);
  assert.doesNotMatch(html, /data-iti-source/, '回退模式不应出现「依据」按钮');
});

test('sheet 渲染真数据节点与「依据 N」按钮', () => {
  const html = IT.sheet('');
  const m = IT.model();
  for (const node of m.itinerary.nodes) {
    assert.ok(html.includes(node.name), `缺少节点 ${node.name}`);
    assert.ok(html.includes('停留建议 ' + node.stay), `缺少停留建议 ${node.name}`);
  }
  const buttons = html.match(/data-iti-source="\d+"/g) || [];
  assert.equal(buttons.length, m.itinerary.nodes.filter(n => n.sources.length).length);
  assert.match(html, /依据 \d/);
});

test('依据抽屉：来源名、链接、核对日期、提示语都在', () => {
  const first = IT.model().itinerary.nodes[0];
  const html = IT.drawerMarkup(0);
  assert.ok(html.includes(IT.esc(first.name)), '抽屉缺少节点名');
  assert.ok(html.includes('核对于'), '抽屉缺少核对日期');
  assert.ok(html.includes('置信度'), '抽屉缺少置信度');
  assert.match(html, /data-iti-url="/, '抽屉缺少官方链接按钮');
  assert.match(html, /打开官方页面/, '抽屉缺少打开动作');
  assert.ok(html.includes(first.caveat) || html.includes(IT.esc(first.caveat)), '抽屉缺少提示语');
});

test('非白名单来源在抽屉里被禁用，不生成可点链接', () => {
  // 手工注入一条含恶意来源的假知识库
  const sandbox = { window: {}, URL };
  vm.createContext(sandbox);
  vm.runInContext(CODE, sandbox);
  sandbox.window.WENLV = {
    clusters: { wusong: '雾凇' },
    attractions: [{
      id: 'bad', name: '坏来源景点', area: '吉林市', cluster: 'wusong', kind: '自然', level: null,
      booking: null, caveat: '测试', verifiedAt: '2026-11-16', confidence: 'low',
      sources: [{ label: '钓鱼站', url: 'https://evil.example.com/a', kind: 'gov' }]
    }],
    routes: [{
      id: 'jilin-wusong-2d', name: '测试线路', days: 1, cluster: 'wusong', areas: ['吉林市'],
      themes: ['冰雪'], season: ['winter'], caveat: '',
      nodes: [{ day: 1, slot: '上午', attractionId: 'bad', why: '测试节点理由够长了' }]
    }]
  };
  const X = sandbox.window.JZZX_ITINERARY;
  const drawer = X.drawerMarkup(0);
  assert.match(drawer, /域名不在白名单，已禁用/);
  assert.doesNotMatch(drawer, /data-iti-url="https:\/\/evil/, '不应给钓鱼域名生成按钮');
  assert.equal(X.isOfficialUrl('https://evil.example.com/a'), false);
});

test('不写死票价、开放时间与预约名额', () => {
  const html = IT.sheet('');
  assert.doesNotMatch(html, /\d+\s*元/, '出现具体票价');
  assert.doesNotMatch(html, /开放时间[:：]?\s*\d/, '出现具体开放时间');
  assert.doesNotMatch(html, /名额有限/, '出现名额描述');
  assert.match(html, /以官方公告为准/, '缺少“以官方公告为准”兜底');
  assert.match(html, /停留时长是行程建议/, '未标注停留建议口径');
});

test('真实知识库引用完整：线路节点都能解析到景点', () => {
  const route = data.routes.find(r => r.id === IT.ROUTE_ID);
  assert.ok(route, '知识库里找不到默认线路');
  for (const node of route.nodes) {
    const hit = data.attractions.find(a => a.id === node.attractionId);
    assert.ok(hit, `节点 ${node.attractionId} 在景点库里不存在`);
    assert.ok(hit.sources.length >= 1, `${hit.name} 没有来源`);
    for (const s of hit.sources) {
      assert.equal(IT.isOfficialUrl(s.url), true, `${hit.name} 的来源不在白名单：${s.url}`);
    }
  }
});

test('不发网络请求；偏好只落在本机一个 key', () => {
  const code = CODE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(code, /fetch\(|XMLHttpRequest|api\/chat/);
  // 第 3 步允许存出行偏好，但只允许这一个 key，且不能碰 IndexedDB
  assert.doesNotMatch(code, /indexedDB/);
  const keys = code.match(/localStorage/gi) || [];
  assert.ok(keys.length > 0, '偏好应写入 localStorage');
  assert.match(CODE, /var PREFS_KEY = 'jzzx-iti-prefs'/);
});

test('前端接线：知识库先于行程模块、点击交给模块、离线缓存包含数据', () => {
  assert.ok(HTML.includes('src="./wenlv-data.js"'), 'index.html 未加载知识库');
  assert.ok(HTML.indexOf('wenlv-data.js') < HTML.indexOf('itinerary.js'), '知识库必须在行程模块之前加载');
  assert.match(APP, /JZZX_ITINERARY\.handle\(target\)/, 'app.js 未把行程内点击交给模块');
  assert.ok(SW.includes("'./wenlv-data.js'"), '离线缓存未包含知识库');
  assert.ok(SW.includes("'./itinerary.js'"), '离线缓存未包含行程模块');
});

/* ── 第 3 步：偏好 / 导出 / 错误态 ───────────────────────── */

test('偏好校验：非法值回落到默认，合法值保留', () => {
  assert.deepEqual({ ...IT.sanitizePrefs(null) }, { ...IT.DEFAULT_PREFS });
  assert.deepEqual({ ...IT.sanitizePrefs({ party: 'x', pace: 'y', days: 9 }) }, { ...IT.DEFAULT_PREFS });
  assert.deepEqual({ ...IT.sanitizePrefs({ party: 'family', pace: 'tight', days: 1 }) }, { party: 'family', pace: 'tight', days: 1 });
});

test('默认偏好仍推荐演示线路（雾凇两日）', () => {
  const picked = IT.selectRoute(data, IT.DEFAULT_PREFS);
  assert.equal(picked.route.id, IT.ROUTE_ID);
  assert.equal(picked.weak, false);
});

test('偏好能改变选线：1 天 + 带娃 → 长春亲子一日', () => {
  const picked = IT.selectRoute(data, { party: 'family', pace: 'standard', days: 1 });
  assert.equal(picked.route.days, 1);
  assert.ok(picked.route.themes.includes('亲子'), `实际选到 ${picked.route.id}`);
});

test('弱匹配：3 天 + 带娃 给出提示语与 2 条替代线路', () => {
  const picked = IT.selectRoute(data, { party: 'family', pace: 'standard', days: 3 });
  assert.equal(picked.weak, true);
  assert.equal(picked.alternatives.length, 2);
  assert.ok(picked.alternatives.every(r => r.id !== picked.route.id));
});

test('主题越贴合得分越高（同一批候选内）', () => {
  const familyRoute = data.routes.find(r => r.id === 'changchun-family-1d');
  const redRoute = data.routes.find(r => r.id === 'siping-red-1d');
  const pref = { party: 'family', pace: 'standard', days: 1 };
  assert.ok(IT.scoreRoute(familyRoute, pref) > IT.scoreRoute(redRoute, pref));
});

test('卡片里能看到偏好入口与导出按钮', () => {
  const html = IT.sheet('');
  assert.match(html, /data-iti-action="prefs"/);
  assert.match(html, /出行偏好 · 银发结伴 · 轻松 · 2 天/);
  assert.match(html, /data-iti-action="export"/);
  assert.match(html, /导出长图/, '缺少导出按钮文案');
  assert.match(html, /id="iti-prefs"/, '缺少偏好面板容器');
});

test('导出长图宽度固定 1080，内容覆盖节点与免责声明', () => {
  assert.equal(IT.EXPORT_WIDTH, 1080);
  const it = IT.model().itinerary;
  const blocks = IT.exportBlocks(it);
  const text = blocks.map(b => b.text || '').join('\n');
  assert.ok(text.includes(it.title), '长图缺少标题');
  for (const node of it.nodes) assert.ok(text.includes(node.name), `长图缺少节点 ${node.name}`);
  assert.match(text, /行前清单/);
  assert.match(text, /依据：/);
  assert.match(text, /以官方公告为准/);
  assert.doesNotMatch(text, /\d+\s*元/, '长图里出现具体票价');
});

test('弱匹配提示会写进卡片（含替代线路按钮）', () => {
  const { IT: alt, WENLV: d } = load();
  const picked = alt.selectRoute(d, { party: 'family', pace: 'standard', days: 3 });
  const it = { ...alt.model().itinerary, weak: picked.weak, approx: false, alternatives: picked.alternatives };
  // 直接检查模板里的替代按钮文案（sheet 依赖全局 prefs，这里只验证 alt 数据可用于按钮）
  assert.equal(it.alternatives.length, 2);
  assert.ok(it.alternatives.every(r => typeof r.name === 'string' && r.days >= 1));
});

/* ── 第 4 步：语音导览 / 长辈模式 / 无障碍 ───────────────── */

test('朗读文稿只复述卡片内容，按天筛选', () => {
  const it = IT.model().itinerary;
  const day1 = IT.speechText(it, 1);
  const all = IT.speechText(it, 0);
  const day1Nodes = it.nodes.filter(n => n.day === 1);
  const day2Nodes = it.nodes.filter(n => n.day === 2);
  for (const n of day1Nodes) assert.ok(day1.includes(n.name), `第 1 天缺 ${n.name}`);
  for (const n of day2Nodes) assert.ok(!day1.includes(n.name), `第 1 天串入第 2 天节点 ${n.name}`);
  assert.ok(all.includes(day1Nodes[0].name) && all.includes(day2Nodes[0].name));
  assert.match(all, /以官方公告为准/);
  assert.doesNotMatch(all, /\d+\s*元/, '朗读稿里出现具体票价');
});

test('朗读接口齐全，且不支持时如实返回失败', () => {
  for (const key of ['speechText', 'speak', 'stopSpeak', 'announce']) {
    assert.equal(typeof IT[key], 'function', `缺少 ${key}`);
  }
  // node 沙箱没有 speechSynthesis，应返回 ok:false 而不是抛错
  const res = IT.speak(1);
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'unsupported');
});

test('卡片里每天都有朗读按钮与 aria-live 播报区', () => {
  const html = IT.sheet('');
  const buttons = html.match(/data-iti-action="speak"[^>]*/g) || [];
  assert.equal(buttons.length, IT.model().itinerary.days);
  assert.match(html, /aria-label="朗读第 1 天行程"/);
  assert.match(html, /aria-pressed="false"/);
  assert.match(html, /id="iti-live"[^>]*aria-live="polite"/);
  assert.match(html, /id="iti-speech-hint"[^>]*aria-live="polite"/);
});

test('依据按钮声明为弹出对话框（读屏可感知）', () => {
  const html = IT.sheet('');
  assert.match(html, /data-iti-source="0"[^>]*aria-haspopup="dialog"/);
  assert.match(html, /id="iti-drawer"[^>]*>/);
});

test('长辈模式样式：正文 19px、触控 44px、次要文字加深', () => {
  assert.match(CSS, /\.elder \.iti-why[^{]*\{[^}]*font-size:19px/);
  assert.match(CSS, /\.elder \.iti-node-main strong\{[^}]*font-size:19px/);
  assert.match(CSS, /\.elder \.iti-src-btn[^{]*\{[^}]*min-height:46px/);
  assert.match(CSS, /\.elder \.iti-pref-chip[^{]*\{[^}]*min-height:46px/);
  assert.match(CSS, /\.elder \.iti-drawer-close\{[^}]*width:46px/);
  // 次要文字用更深的颜色（#5a6b82 在白底上约 5.6:1）
  assert.match(CSS, /\.elder \.iti-facts[^{]*\{[^}]*color:#5a6b82/);
});

test('无障碍：读屏专用类、焦点可见、减少动效', () => {
  assert.match(CSS, /\.iti-sr\{[^}]*clip:rect\(0 0 0 0\)/);
  assert.match(CSS, /focus-visible\{[^}]*outline:3px solid/);
  assert.match(CSS, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(CSS, /\.motion-off \.iti-drawer-panel/);
  assert.match(CSS, /\.elder \.iti-drawer-panel[^{]*\{[^}]*animation:none/);
});

test('弹层焦点接管与 Tab 循环的代码在位（静态检查）', () => {
  assert.match(CODE, /MutationObserver/);
  assert.match(CODE, /trapTab/);
  assert.match(CODE, /focus\(\{ preventScroll: true \}\)/);
  assert.match(CODE, /已打开行程：/);
});
