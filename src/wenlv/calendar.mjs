/**
 * 时令与节庆（wenlv-v1，D2：12 条）
 *
 * 只写“哪几个月、为什么这时候值得去”，不写具体日期与场次——
 * 节庆日期年年变，写死了就会在演示现场翻车。
 */
import { validateEvent } from './schema.mjs';

const S = (label, url, kind = 'gov') => ({ label, url, kind });
const HALL = S('吉林省文化和旅游厅', 'https://whhlyt.jl.gov.cn/');
const CC = S('长春市文化广播电视和旅游局', 'http://wglj.changchun.gov.cn/');
const JL = S('吉林市文化广播电视和旅游局', 'http://lyj.jlcity.gov.cn/');
const CBS = S('长白山保护开发区管委会', 'http://www.changbaishan.gov.cn/');

const CAVEAT_TBD = '具体日期与场次每年调整，请以举办方官方公告为准。';

export const CALENDAR = Object.freeze([
  {
    id: 'chagan-winter-fishing', name: '查干湖冬捕', cluster: 'chaganhu', type: '节庆',
    months: [12, 1], window: '12 月下旬—次年 1 月',
    why: '冬捕是查干湖最不可替代的现场：出网、头鱼与渔把头的号子都在冰面上发生。',
    sources: [S('吉林查干湖渔业有限公司', 'https://www.cgh.org.cn/', 'operator'), HALL],
    verifiedAt: '2026-11-16', confidence: 'medium', caveat: '开网日期每年不同、点位随冰情变化，务必以运营方官方公告为准。'
  },
  {
    id: 'jilin-rime-season', name: '吉林雾凇观赏期', cluster: 'wusong', type: '冰雪',
    months: [12, 1, 2], window: '12 月—次年 2 月，清晨',
    why: '雾凇需要夜里起雾、清晨无风，日出后两小时最稳定，错过就只能等下一个晴天。',
    sources: [JL], verifiedAt: '2026-11-16', confidence: 'medium',
    caveat: '雾凇属自然现象，能否出现以当日气象与当地文旅部门通报为准。'
  },
  {
    id: 'changchun-ice-snow', name: '长春冰雪季', cluster: 'changchun', type: '冰雪',
    months: [12, 1, 2], window: '12 月—次年 2 月',
    why: '冰雪季期间滑雪场、冰雕与室内场馆同时开放，一次出行能看长春冬天的两面。',
    sources: [CC, HALL], verifiedAt: '2026-11-16', confidence: 'medium', caveat: CAVEAT_TBD
  },
  {
    id: 'changbaishan-tianchi-season', name: '长白山天池开放季', cluster: 'changbaishan', type: '景致',
    months: [6, 7, 8, 9], window: '6—9 月',
    why: '天池开冰后能见度最高，也是普通游客登顶最稳妥的窗口期。',
    sources: [CBS], verifiedAt: '2026-11-16', confidence: 'high',
    caveat: '能否登顶视当日天气与景区调度，以长白山官方平台公告为准。'
  },
  {
    id: 'yanbian-jindalai', name: '延边金达莱花季', cluster: 'yanbian', type: '花季',
    months: [4, 5], window: '4 月末—5 月',
    why: '金达莱先开花后长叶，山坡成片粉紫，是延边春天最早也最短的信号。',
    sources: [HALL], verifiedAt: '2026-11-16', confidence: 'medium',
    caveat: '花期受气温影响前后浮动，以当地文旅部门与景区发布为准。'
  },
  {
    id: 'xianghai-migration', name: '向海候鸟迁徙', cluster: 'xianghai', type: '观鸟',
    months: [4, 5, 9, 10], window: '4—5 月、9—10 月',
    why: '向海处在东亚候鸟迁飞通道上，春秋两季过境种类最多，清晨最容易看到集群。',
    sources: [HALL], verifiedAt: '2026-11-16', confidence: 'medium',
    caveat: '核心区限制进入，观鸟点位与开放范围以保护区管理机构公告为准。'
  },
  {
    id: 'momoge-crane', name: '莫莫格白鹤停歇', cluster: 'xianghai', type: '观鸟',
    months: [9, 10], window: '9—10 月',
    why: '白鹤南迁途中在莫莫格停歇，是全球极危物种最集中的观测窗口之一。',
    sources: [HALL], verifiedAt: '2026-11-16', confidence: 'medium',
    caveat: '观鸟需保持距离、禁用无人机，具体规定以保护区管理机构公告为准。'
  },
  {
    id: 'jian-youcaihua', name: '集安沿江油菜花', cluster: 'jian', type: '花季',
    months: [6, 7], window: '6—7 月',
    why: '油菜花与鸭绿江同框，是通化夏季最出片的一段，也是集安行程的天然补充。',
    sources: [HALL], verifiedAt: '2026-11-16', confidence: 'low',
    caveat: '种植面积与花期每年不同，以集安市官方发布为准。'
  },
  {
    id: 'songhuahu-kaihu', name: '松花湖开湖', cluster: 'songhuahu', type: '节庆',
    months: [4], window: '4 月中下旬',
    why: '开湖意味着湖鲜上市，是湖区一年里第一个热闹节点，也标志着游船季开始。',
    sources: [JL], verifiedAt: '2026-11-16', confidence: 'low', caveat: CAVEAT_TBD
  },
  {
    id: 'jingyuetan-autumn', name: '净月潭秋色', cluster: 'changchun', type: '景致',
    months: [9, 10], window: '9 月下旬—10 月',
    why: '环潭阔叶林变色，步道不长但层次最丰富，适合半天的城市轻徒步。',
    sources: [CC], verifiedAt: '2026-11-16', confidence: 'medium',
    caveat: '变色时间受降温影响，以景区与气象部门发布为准。'
  },
  {
    id: 'changbaishan-azalea', name: '长白山高山杜鹃', cluster: 'changbaishan', type: '花季',
    months: [5, 6], window: '5—6 月',
    why: '高山杜鹃贴着雪线开，是长白山春季最短也最容易被错过的一段窗口。',
    sources: [CBS], verifiedAt: '2026-11-16', confidence: 'medium',
    caveat: '花期与可达区域随雪线变化，以长白山官方公告为准。'
  },
  {
    id: 'yanbian-minsu-festival', name: '延边民俗活动季', cluster: 'yanbian', type: '民俗',
    months: [9], window: '9 月前后',
    why: '农乐舞、摔跤与打糕制作等民俗活动集中展演，适合研学团按场次安排。',
    sources: [HALL], verifiedAt: '2026-11-16', confidence: 'low', caveat: CAVEAT_TBD
  }
]);

const problems = CALENDAR.flatMap(event => validateEvent(event).map(msg => `${event.id}: ${msg}`));
if (problems.length) throw new Error(`时令库 self-check 失败：\n${problems.join('\n')}`);

/** 某个自然月（1–12）里值得推荐的时令条目。 */
export function eventsInMonth(month) {
  return CALENDAR.filter(event => event.months.includes(month));
}

export function eventsByCluster(cluster) {
  return CALENDAR.filter(event => event.cluster === cluster);
}
