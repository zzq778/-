/**
 * 官方入口（wenlv-v1，D2：8 条）
 *
 * 只放“能查到原始说法”的入口：省级部门、市州文旅局、管委会、场馆官网。
 * 12345 热线不落库（它不是网页），由 schema.mjs 的 HELPLINE 单独提供。
 */
import { validateEntry } from './schema.mjs';

export const ENTRIES = Object.freeze([
  {
    id: 'whhlyt', name: '吉林省文化和旅游厅', kind: 'gov', url: 'https://whhlyt.jl.gov.cn/',
    scope: '全省', note: '省级文旅政策、活动与景区公告的第一发布口。',
    verifiedAt: '2026-11-16', confidence: 'high'
  },
  {
    id: 'jl-gov', name: '吉林省人民政府', kind: 'gov', url: 'https://www.jl.gov.cn/',
    scope: '全省', note: '省政府门户，政策文件与信息公开的总入口。',
    verifiedAt: '2026-11-16', confidence: 'high'
  },
  {
    id: 'changchun-wglj', name: '长春市文化广播电视和旅游局', kind: 'gov', url: 'http://wglj.changchun.gov.cn/',
    scope: '长春市', note: '长春市景区、冰雪季与文旅活动的官方发布渠道。',
    verifiedAt: '2026-11-16', confidence: 'high'
  },
  {
    id: 'jilin-lyj', name: '吉林市文化广播电视和旅游局', kind: 'gov', url: 'http://lyj.jlcity.gov.cn/',
    scope: '吉林市', note: '雾凇预报、松花湖与滑雪季信息的官方来源。',
    verifiedAt: '2026-11-16', confidence: 'high'
  },
  {
    id: 'jilin-songhuahu-gov', name: '松花湖风景名胜区管委会', kind: 'gov', url: 'http://jlsonghuahu.jlcity.gov.cn/',
    scope: '吉林市·松花湖', note: '湖区码头、游船与雪场运营公告的官方渠道。',
    verifiedAt: '2026-11-16', confidence: 'medium'
  },
  {
    id: 'yanji-gov', name: '延吉市人民政府', kind: 'gov', url: 'http://www.yanji.gov.cn/',
    scope: '延边州·延吉', note: '延吉民俗园、帽儿山等市域景点的官方发布口。',
    verifiedAt: '2026-11-16', confidence: 'high'
  },
  {
    id: 'changbaishan-gov', name: '长白山保护开发区管委会', kind: 'gov', url: 'http://www.changbaishan.gov.cn/',
    scope: '长白山', note: '三个坡区的开放状态、预约与调度信息以此为准。',
    verifiedAt: '2026-11-16', confidence: 'high'
  },
  {
    id: 'wmhg', name: '伪满皇宫博物院', kind: 'official', url: 'http://www.wmhg.com.cn/',
    scope: '长春市', note: '场馆自身的开放时间、预约与展览公告。',
    verifiedAt: '2026-11-16', confidence: 'high'
  }
]);

const problems = ENTRIES.flatMap(entry => validateEntry(entry).map(msg => `${entry.id}: ${msg}`));
if (problems.length) throw new Error(`官方入口 self-check 失败：\n${problems.join('\n')}`);

export function entryById(id) {
  return ENTRIES.find(entry => entry.id === id) || null;
}

export function entriesForScope(scope) {
  return ENTRIES.filter(entry => entry.scope.includes(scope));
}
