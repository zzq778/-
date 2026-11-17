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

test('仍然不发请求、不写本地存储', () => {
  const code = CODE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(code, /fetch\(|XMLHttpRequest|api\/chat/);
  assert.doesNotMatch(code, /localStorage|indexedDB/);
});

test('前端接线：知识库先于行程模块、点击交给模块、离线缓存包含数据', () => {
  assert.ok(HTML.includes('src="./wenlv-data.js"'), 'index.html 未加载知识库');
  assert.ok(HTML.indexOf('wenlv-data.js') < HTML.indexOf('itinerary.js'), '知识库必须在行程模块之前加载');
  assert.match(APP, /JZZX_ITINERARY\.handle\(target\)/, 'app.js 未把行程内点击交给模块');
  assert.ok(SW.includes("'./wenlv-data.js'"), '离线缓存未包含知识库');
  assert.ok(SW.includes("'./itinerary.js'"), '离线缓存未包含行程模块');
});
