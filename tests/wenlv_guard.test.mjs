/**
 * 引用与合规校验测试（D4 A 线）
 *
 * 20 条探针覆盖现场最容易被评委问到、也最容易翻车的几类说法：
 * 编价、编时刻、外链、绝对化承诺、个人信息、编造的景点名。
 * 另外用一批“干净句子”守住不误伤——校验器滥报等于没报。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { guardAnswer, buildFacts, formatIssues, ISSUE } from '../src/wenlv/guard.mjs';
import { parseIntent } from '../src/wenlv/intent.mjs';
import { retrieve } from '../src/wenlv/search.mjs';
import { buildItinerary, describeItinerary } from '../src/wenlv/plan.mjs';

/** 20 条探针：[说法, 期望命中的问题类型] */
const PROBES = [
  ['门票 80 元，现场买就行', ISSUE.PRICE],
  ['¥120 一人，儿童半价', ISSUE.PRICE],
  ['开放时间 8:30-16:30', ISSUE.TIME],
  ['售票 9：00 开始', ISSUE.TIME],
  ['详情见 https://example.com/tickets', ISSUE.URL],
  ['保证能预约到当天的名额', ISSUE.OVERCLAIM],
  ['100% 有票，放心来', ISSUE.OVERCLAIM],
  ['我们是官方指定合作方', ISSUE.OVERCLAIM],
  ['绝对不会临时关闭', ISSUE.OVERCLAIM],
  ['身份证 220102199001011234', ISSUE.PII],
  ['报名电话 13800138000', ISSUE.PII],
  ['雪乡景区冬季很热闹', ISSUE.UNKNOWN],
  ['查干湖渔猎文化景区值得去', ISSUE.UNKNOWN],
  ['门票 80 元，8:30 开放，保证有票', ISSUE.PRICE],
  ['票价 30 元/人，详见 https://abc.com', ISSUE.URL],
  ['每天 8:00 到 17:00 营业', ISSUE.TIME],
  ['长白山门票 190 元还能预约', ISSUE.PRICE],
  ['镜泊湖景区也在附近', ISSUE.UNKNOWN],
  ['包过，办不成退款', ISSUE.OVERCLAIM],
  ['手机号 19900001111 可直接联系', ISSUE.PII]
];

test('20 条探针全部被拦下', () => {
  assert.equal(PROBES.length, 20);
  for (const [text, type] of PROBES) {
    const verdict = guardAnswer(text);
    const types = verdict.issues.map((i) => i.type);
    assert.ok(types.includes(type), `「${text}」未命中 ${type}，实际 ${types.join(',') || '无'}`);
    assert.equal(verdict.ok, false);
  }
});

test('被拦下的价格不会原样留在可展示版本里', () => {
  const verdict = guardAnswer('门票 80 元');
  assert.ok(!verdict.patched.includes('80 元'));
  assert.ok(verdict.patched.includes('官方公布的价格'));
});

test('时刻、外链、身份证、手机号同样会被替换掉', () => {
  const time = guardAnswer('8:30 开门');
  assert.ok(!/\d{1,2}[:：]\d{2}/.test(time.patched));
  const url = guardAnswer('见 https://example.com/a');
  assert.ok(!url.patched.includes('example.com'));
  const id = guardAnswer('身份证 220102199001011234');
  assert.ok(!/\d{17}/.test(id.patched));
  const phone = guardAnswer('电话 13800138000');
  assert.ok(!phone.patched.includes('13800138000'));
});

test('绝对化措辞被降级，而不是整句删掉', () => {
  const verdict = guardAnswer('保证能约到');
  assert.ok(verdict.patched.includes('通常可以'));
  assert.ok(!verdict.patched.includes('保证'));
});

test('干净句子不误伤', () => {
  const clean = [
    '长白山北坡适合冬季，建议上午先去天池。',
    '开放时间以景区官方公告为准。',
    '学生、老年人等优惠以现场公告为准。',
    '两天行程建议其中一天留出机动时间。',
    '吉林省文化和旅游厅已发布冬季线路。',
    '详情可查 https://whhlyt.jl.gov.cn/'
  ];
  for (const text of clean) {
    const verdict = guardAnswer(text);
    assert.equal(verdict.ok, true, `「${text}」被误判：${formatIssues(verdict.issues)}`);
  }
});

test('白名单里的链接不报问题', () => {
  const verdict = guardAnswer('报名入口 https://whhlyt.jl.gov.cn/notice/1.html');
  assert.equal(verdict.ok, true);
});

test('库里已有的价格与时刻可放行（facts 决定边界）', () => {
  const facts = { numbers: ['80'], times: ['8:30'] };
  const verdict = guardAnswer('门票 80 元，8:30 开门', facts);
  assert.equal(verdict.ok, true, JSON.stringify(verdict.issues));
});

test('行程文本配上事实集后可以放行', () => {
  const intent = parseIntent('两天冬天带孩子去哪', { now: new Date('2026-11-17T10:00:00+08:00') });
  const itinerary = buildItinerary(intent, retrieve(intent));
  const verdict = guardAnswer(describeItinerary(itinerary), buildFacts(itinerary));
  assert.equal(verdict.ok, true, formatIssues(verdict.issues));
});

test('formatIssues 对空列表给出明确文案', () => {
  assert.equal(formatIssues([]), '未发现问题');
  assert.match(formatIssues([{ type: 'pii', message: '出现手机号' }]), /出现手机号/);
});
