// 行程卡片（静态版）守门测试：不需要网络，纯静态校验 public/itinerary.js 与接线。
// 目的：保证第 1 步确实只交付「静态卡片」——不偷偷读知识库、不调用模型、不写死票价与开放时间。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = new URL('../public/', import.meta.url);
const CODE = readFileSync(fileURLToPath(new URL('itinerary.js', ROOT)), 'utf8');
const APP = readFileSync(fileURLToPath(new URL('app.js', ROOT)), 'utf8');
const HTML = readFileSync(fileURLToPath(new URL('index.html', ROOT)), 'utf8');

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(CODE, sandbox, { filename: 'itinerary.js' });
const IT = sandbox.window.JZZX_ITINERARY;

const SAMPLE = IT?.SAMPLE;

test('行程模块已挂到 window 上', () => {
  assert.ok(IT, 'window.JZZX_ITINERARY 未定义');
  assert.ok(SAMPLE, '缺少 SAMPLE 静态样本');
  assert.equal(typeof IT.sheet, 'function');
});

test('静态样本是两天四站的闭环结构', () => {
  assert.equal(SAMPLE.days, 2);
  assert.equal(SAMPLE.nodes.length, 4);
  assert.ok(SAMPLE.areas.includes('吉林市'));
  assert.ok(String(SAMPLE.title).length >= 6);
  const days = new Set(SAMPLE.nodes.map(n => n.day));
  assert.deepEqual([...days].sort(), [1, 2], '两天都要有节点');
  for (const n of SAMPLE.nodes) {
    assert.match(n.slot, /^(上午|午后|傍晚)$/, `非法时段：${n.slot}`);
    assert.ok(String(n.name).length >= 2, '节点缺少名称');
    assert.ok(String(n.why).length >= 8, `${n.name} 缺少理由`);
    assert.ok(String(n.stay).length >= 2, `${n.name} 缺少停留建议`);
  }
});

test('行前清单覆盖预约、证件、衣物、天气', () => {
  const labels = SAMPLE.checklist.map(x => x.label);
  for (const need of ['预约', '证件', '衣物', '天气']) {
    assert.ok(labels.includes(need), `清单缺少「${need}」`);
  }
});

test('sheet() 渲染标题、两天节点与行前清单', () => {
  const marker = '<button data-test-close>×</button>';
  const html = IT.sheet(marker);
  assert.match(html, /吉林雾凇两日/);
  for (const n of SAMPLE.nodes) assert.ok(html.includes(n.name), `缺少节点 ${n.name}`);
  assert.ok(html.includes('Day 1') && html.includes('Day 2'));
  assert.ok(html.includes('行前清单'));
  assert.ok(html.includes(marker), '关闭按钮应原样嵌入');
  assert.match(html, /aria-labelledby="iti-day-1"/);
});

test('sheet() 转义用户可见文本', () => {
  assert.equal(IT.esc('<img src=x onerror=1>'), '&lt;img src=x onerror=1&gt;');
  assert.equal(IT.esc('"a"&\'b\''), '&quot;a&quot;&amp;&#39;b&#39;');
});

test('不写死票价、开放时间与预约名额', () => {
  const html = IT.sheet('');
  assert.doesNotMatch(html, /\d+\s*元/, '出现具体票价');
  assert.doesNotMatch(html, /开放时间[:：]?\s*\d/, '出现具体开放时间');
  assert.doesNotMatch(html, /预约名额|名额有限/, '出现名额描述');
  assert.match(html, /以官方公告为准/, '缺少“以官方公告为准”兜底');
  assert.match(html, /静态示例/, '卡片未标注为静态示例');
});

test('第 1 步保持静态：不读知识库、不发请求', () => {
  // 注释里会提到“还没有读 WENLV”，所以这里只看去掉注释后的可执行代码。
  const code = CODE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(code, /WENLV/, '静态版不应依赖 WENLV 知识库');
  assert.doesNotMatch(code, /fetch\(|XMLHttpRequest|api\/chat/, '静态版不应发起网络请求');
  assert.doesNotMatch(code, /localStorage|indexedDB/, '静态版不应读写存储');
});

test('前端已接线：资源顺序、弹层分支与入口按钮', () => {
  assert.ok(HTML.includes('src="./itinerary.js"'), 'index.html 未加载 itinerary.js');
  assert.ok(HTML.includes('href="./itinerary.css"'), 'index.html 未加载 itinerary.css');
  assert.ok(HTML.indexOf('itinerary.js') < HTML.indexOf('app.js'), 'itinerary.js 必须在 app.js 之前加载');
  assert.match(APP, /JZZX_ITINERARY/, 'app.js 未接 JZZX_ITINERARY');
  assert.match(APP, /itinerary-sheet/, 'app.js 未给行程弹层加样式类');
  assert.match(APP, /data-action="itinerary"/, '首页缺少行程卡片入口');
  assert.match(APP, /case 'itinerary'/, '点击入口没有对应动作');
  assert.match(APP, /行程卡片/, '弹层缺少 aria-label');
  const SW = readFileSync(fileURLToPath(new URL('sw.js', ROOT)), 'utf8');
  assert.ok(SW.includes("'./itinerary.js'"), '离线缓存未包含 itinerary.js');
  assert.ok(SW.includes("'./itinerary.css'"), '离线缓存未包含 itinerary.css');
});

test('入口文案与样本一致（2 天 4 站 · 吉林市）', () => {
  const entry = APP.match(/<button type="button" class="iti-entry"[\s\S]*?<\/button>/);
  assert.ok(entry, '未找到首页入口按钮');
  assert.match(entry[0], /2 天 4 站/);
  assert.match(entry[0], /吉林市/);
  assert.match(entry[0], /雾凇/);
});
