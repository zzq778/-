/**
 * 文旅知识库（wenlv-v1）样板数据测试。
 * 只跑 node:test，不联网、不依赖 DOM，node tests/wenlv_data.test.mjs 可直接执行。
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ATTRACTIONS, byId, byArea, byCluster
} from '../src/wenlv/attractions.mjs';
import {
  SCHEMA_VERSION, AREAS, CLUSTERS, CLUSTER_LABELS, KINDS, SEASONS, LEVELS, CONFIDENCE,
  OFFICIAL_DOMAINS, isOfficialUrl, validateAttraction, summary
} from '../src/wenlv/schema.mjs';

test('D2 交付 40 条景点，id 唯一且命名合规', () => {
  assert.equal(SCHEMA_VERSION, 'wenlv-v1');
  assert.equal(ATTRACTIONS.length, 40);
  const ids = ATTRACTIONS.map(entry => entry.id);
  assert.equal(new Set(ids).size, ids.length, 'id 不得重复');
  ids.forEach(id => assert.match(id, /^[a-z0-9]+(-[a-z0-9]+)*$/));
});

test('每条样板都能通过 schema 校验', () => {
  for (const entry of ATTRACTIONS) {
    assert.deepEqual(validateAttraction(entry), [], `${entry.id} 校验未通过`);
  }
});

test('来源域名必须落在官方白名单内', () => {
  for (const entry of ATTRACTIONS) {
    for (const source of entry.sources) {
      assert.ok(isOfficialUrl(source.url), `${entry.id} 的来源不在白名单：${source.url}`);
      const host = new URL(source.url).hostname;
      assert.ok(OFFICIAL_DOMAINS.some(domain => host === domain || host.endsWith(`.${domain}`)));
    }
  }
  assert.equal(isOfficialUrl('https://www.xiaohongshu.com/explore/abc'), false);
  assert.equal(isOfficialUrl('https://example.com/'), false);
});

test('票价与开放时间为 null 时，caveat 必须提示以官方为准', () => {
  for (const entry of ATTRACTIONS) {
    if (entry.hours === null || entry.ticket === null) {
      assert.ok(entry.caveat.includes('官方'), `${entry.id} 的 caveat 缺少官方提示`);
    }
  }
});

test('枚举字段全部合法', () => {
  for (const entry of ATTRACTIONS) {
    assert.ok(AREAS.includes(entry.area), `${entry.id} area 非法`);
    assert.ok(CLUSTERS.includes(entry.cluster), `${entry.id} cluster 非法`);
    assert.ok(KINDS.includes(entry.kind), `${entry.id} kind 非法`);
    assert.ok(entry.level === null || LEVELS.includes(entry.level), `${entry.id} level 非法`);
    assert.ok(CONFIDENCE.includes(entry.confidence), `${entry.id} confidence 非法`);
    entry.season.best.forEach(season => assert.ok(SEASONS.includes(season), `${entry.id} season 非法`));
  }
});

test('核对日期格式合法且不晚于今天', () => {
  const today = new Date().toISOString().slice(0, 10);
  for (const entry of ATTRACTIONS) {
    assert.match(entry.verifiedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(entry.verifiedAt <= today, `${entry.id} 的 verifiedAt 在未来：${entry.verifiedAt}`);
  }
});

test('景点覆盖全部 9 个市州，且每个市州至少 1 条', () => {
  const areas = new Set(ATTRACTIONS.map(entry => entry.area));
  assert.equal(areas.size, AREAS.length, `仅覆盖 ${areas.size}/${AREAS.length} 个市州`);
  for (const area of AREAS) {
    assert.ok(byArea(area).length >= 1, `${area} 没有任何条目`);
  }
});

test('每个片区都有景点，片区中文名齐全', () => {
  for (const cluster of Object.keys(CLUSTER_LABELS)) {
    assert.ok(CLUSTERS.includes(cluster), `${cluster} 不在 CLUSTERS 枚举内`);
    assert.ok(byCluster(cluster).length >= 1, `片区 ${cluster} 没有景点`);
  }
  assert.equal(Object.keys(CLUSTER_LABELS).length, CLUSTERS.length);
});

test('别名不重复、不含空白，且不等于正式名称', () => {
  for (const entry of ATTRACTIONS) {
    assert.equal(new Set(entry.aliases).size, entry.aliases.length, `${entry.id} aliases 重复`);
    entry.aliases.forEach(alias => {
      assert.equal(alias.trim(), alias, `${entry.id} alias 含首尾空白`);
      assert.ok(alias.length > 0);
      assert.notEqual(alias, entry.name, `${entry.id} alias 与 name 相同`);
    });
  }
});

test('按 id / 市州 / 片区查询可用', () => {
  assert.equal(byId('changbaishan-bei')?.name, '长白山北景区');
  assert.equal(byId('not-exists'), null);
  assert.ok(byArea('长春市').length >= 3);
  assert.ok(byArea('火星').length === 0);
  assert.ok(byCluster('yanbian').length >= 2);
});

test('summary 只暴露列表所需字段，不泄露来源与提示语', () => {
  const mini = summary(ATTRACTIONS[0]);
  assert.deepEqual(Object.keys(mini).sort(), ['area', 'id', 'kind', 'level', 'name', 'tags', 'verifiedAt']);
  assert.ok(mini.tags.length <= 3);
  assert.equal('sources' in mini, false);
  assert.equal('caveat' in mini, false);
});

test('脏数据会被校验拦下', () => {
  const broken = {
    ...ATTRACTIONS[0],
    id: 'ChangBaiShan',
    area: '长春新区',
    level: '6A',
    sources: [{ label: '某攻略站', url: 'https://www.xiaohongshu.com/a', kind: 'gov' }],
    ticket: '旺季 120 元',
    caveat: '随便'
  };
  const problems = validateAttraction(broken);
  assert.ok(problems.length >= 4, `应报多项问题，实际：${problems.join('；')}`);
  assert.ok(problems.some(msg => msg.includes('id')));
  assert.ok(problems.some(msg => msg.includes('白名单')));
  assert.ok(problems.some(msg => msg.includes('level')));
});
