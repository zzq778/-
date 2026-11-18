/**
 * 线路模板（wenlv-v1，D2：12 条）
 *
 * 只编排「去哪、什么顺序、为什么」，不写车程、不写票价——
 * 这两样一旦写死就会过期，而行程的价值在于顺序与理由。
 * 节点用 attractionId 引用景点库，引用完整性由 tests/wenlv_routes.test.mjs 检查。
 */

const S = (label, url, kind = 'gov') => ({ label, url, kind });
const HALL = S('吉林省文化和旅游厅', 'https://whhlyt.jl.gov.cn/');
const CC = S('长春市文化广播电视和旅游局', 'http://wglj.changchun.gov.cn/');
const JL = S('吉林市文化广播电视和旅游局', 'http://lyj.jlcity.gov.cn/');
const CBS = S('长白山保护开发区管委会', 'http://www.changbaishan.gov.cn/');

const CAVEAT_TIMING = '开放时间与票价可能调整，出发前以景区官方公告为准。';

export const ROUTES = Object.freeze([
  {
    id: 'changchun-city-1d', name: '长春城市一日：近代史与电影', days: 1,
    cluster: 'changchun', areas: ['长春市'], themes: ['城市', '人文'],
    season: ['spring', 'summer', 'autumn', 'winter'],
    nodes: [
      { day: 1, slot: '上午', attractionId: 'weimanhuanggong', why: '室内为主，上午光线与体力都合适' },
      { day: 1, slot: '午后', attractionId: 'changying-jiuzhi', why: '与伪满皇宫同属近代史线索，动线顺' },
      { day: 1, slot: '傍晚', attractionId: 'shijie-diaosuyuan', why: '室外雕塑园，傍晚光线好、人也少' }
    ],
    sources: [CC], verifiedAt: '2026-11-16', confidence: 'medium', caveat: CAVEAT_TIMING
  },
  {
    id: 'changchun-family-1d', name: '长春亲子一日：动物与森林', days: 1,
    cluster: 'changchun', areas: ['长春市'], themes: ['亲子', '自然'],
    season: ['spring', 'summer', 'autumn'],
    nodes: [
      { day: 1, slot: '上午', attractionId: 'dongbeihu', why: '上午动物更活跃，孩子体力也最好' },
      { day: 1, slot: '午后', attractionId: 'jingyuetan', why: '环潭步道平坦，适合推车与慢走' },
      { day: 1, slot: '傍晚', attractionId: 'sheng-bowuguan', why: '室内收尾，避雨避晒都能用' }
    ],
    sources: [CC, HALL], verifiedAt: '2026-11-16', confidence: 'medium', caveat: CAVEAT_TIMING
  },
  {
    id: 'jilin-wusong-2d', name: '吉林雾凇两日：湖与雾的清晨', days: 2,
    cluster: 'wusong', areas: ['吉林市'], themes: ['冰雪', '摄影'],
    season: ['winter'],
    nodes: [
      { day: 1, slot: '上午', attractionId: 'songhuahu', why: '先看湖面与雪场，下午留出转场时间' },
      { day: 1, slot: '午后', attractionId: 'wulajie', why: '满族古镇室内外穿插，天冷可随时进馆' },
      { day: 2, slot: '上午', attractionId: 'wusongdao', why: '雾凇要赶日出后的两小时，必须住附近' },
      { day: 2, slot: '午后', attractionId: 'beidahu', why: '看完雾凇顺路上雪场，避免二次折返' }
    ],
    sources: [JL], verifiedAt: '2026-11-16', confidence: 'medium', caveat: '雾凇能否出现取决于当夜气温与湿度，行程需保留一天弹性。'
  },
  {
    id: 'jilin-lake-2d', name: '松花湖两日：避暑与湖景', days: 2,
    cluster: 'songhuahu', areas: ['吉林市'], themes: ['避暑', '湖光'],
    season: ['summer', 'autumn'],
    nodes: [
      { day: 1, slot: '上午', attractionId: 'songhuahu', why: '上午湖面风小，适合坐船与拍照' },
      { day: 1, slot: '午后', attractionId: 'wanke-songhuahu', why: '度假区内补给、餐饮集中，带娃友好' },
      { day: 2, slot: '上午', attractionId: 'jilin-bowuguan', why: '雨天备选，陨石展是本地独有的看点' },
      { day: 2, slot: '午后', attractionId: 'wulajie', why: '离城近，返程前顺路补一段民俗' }
    ],
    sources: [JL], verifiedAt: '2026-11-16', confidence: 'medium', caveat: CAVEAT_TIMING
  },
  {
    id: 'changbaishan-north-2d', name: '长白山北坡两日：天池优先', days: 2,
    cluster: 'changbaishan', areas: ['延边州'], themes: ['天池', '自然'],
    season: ['summer', 'winter'],
    nodes: [
      { day: 1, slot: '上午', attractionId: 'changbaishan-bei', why: '天池能见度早上最好，务必约最早时段' },
      { day: 1, slot: '午后', attractionId: 'lushuihe', why: '下午转森林，气温比山顶高，体感更稳' },
      { day: 2, slot: '上午', attractionId: 'changbaishan-dujiaqu', why: '住在度假区，第二天不赶路' },
      { day: 2, slot: '午后', attractionId: 'yangjingyu', why: '返程方向的人文点，适合研学分队' }
    ],
    sources: [CBS, HALL], verifiedAt: '2026-11-16', confidence: 'medium',
    caveat: '天池区域可能因天气临时关闭，门票与入园时段以长白山官方平台为准。'
  },
  {
    id: 'changbaishan-west-3d', name: '长白山三日：西坡台阶与南坡秘境', days: 3,
    cluster: 'changbaishan', areas: ['白山市'], themes: ['天池', '徒步'],
    season: ['summer', 'autumn'],
    nodes: [
      { day: 1, slot: '上午', attractionId: 'changbaishan-xi', why: '西坡 1442 级台阶，趁体力好先上' },
      { day: 1, slot: '午后', attractionId: 'changbaishan-dujiaqu', why: '下山后就近住宿，减少夜间行车' },
      { day: 2, slot: '上午', attractionId: 'changbaishan-nan', why: '南坡人少，但要确认当日是否开放' },
      { day: 2, slot: '午后', attractionId: 'lushuihe', why: '森林线弹性大，天气不好可替换' },
      { day: 3, slot: '上午', attractionId: 'yangjingyu', why: '返程前的红色教育点，团队讲解需预约' }
    ],
    sources: [CBS, HALL], verifiedAt: '2026-11-16', confidence: 'medium',
    caveat: '南坡每年开放时间较短，请以长白山官方平台当日公告为准。'
  },
  {
    id: 'yanbian-food-2d', name: '延边两日：民俗与吃法', days: 2,
    cluster: 'yanbian', areas: ['延边州'], themes: ['美食', '民俗'],
    season: ['spring', 'summer', 'autumn', 'winter'],
    nodes: [
      { day: 1, slot: '上午', attractionId: 'chaoxianzu-minsuyuan', why: '先看民俗园，把服饰与生活场景对上' },
      { day: 1, slot: '午后', attractionId: 'maoershan', why: '登高看城，顺便消食' },
      { day: 2, slot: '上午', attractionId: 'liudingshan', why: '敦化方向的核心点，宜早出发' },
      { day: 2, slot: '午后', attractionId: 'yanminghu', why: '湖边收尾，回程不绕路' }
    ],
    sources: [S('延吉市人民政府', 'http://www.yanji.gov.cn/'), HALL],
    verifiedAt: '2026-11-16', confidence: 'medium', caveat: CAVEAT_TIMING
  },
  {
    id: 'yanbian-border-2d', name: '延边边境两日：一眼望三国', days: 2,
    cluster: 'yanbian', areas: ['延边州'], themes: ['边境', '地理'],
    season: ['spring', 'summer', 'autumn'],
    nodes: [
      { day: 1, slot: '上午', attractionId: 'fangchuan', why: '观景台要天气配合，上午能见度通常更好' },
      { day: 1, slot: '午后', attractionId: 'tumen-kouan', why: '同日走两个边境点，减少往返' },
      { day: 2, slot: '上午', attractionId: 'jindalai-cun', why: '延边民俗的另一种落点，适合拍花季' },
      { day: 2, slot: '午后', attractionId: 'chaoxianzu-minsuyuan', why: '回延吉市区，晚间还有夜游空间' }
    ],
    sources: [HALL], verifiedAt: '2026-11-16', confidence: 'low',
    caveat: '边境区域需带有效证件，通行与拍摄规定以当地官方公告为准。'
  },
  {
    id: 'jian-history-2d', name: '集安通化两日：世界遗产与界江', days: 2,
    cluster: 'jian', areas: ['通化市'], themes: ['世界遗产', '历史'],
    season: ['summer', 'autumn'],
    nodes: [
      { day: 1, slot: '上午', attractionId: 'gaogouli-ji-an', why: '遗产点位分散，上午光线适合看碑刻' },
      { day: 1, slot: '午后', attractionId: 'yalujiang', why: '江边收尾，傍晚看界江最舒服' },
      { day: 2, slot: '上午', attractionId: 'wunvfeng', why: '登山放在体力最好的时段' },
      { day: 2, slot: '午后', attractionId: 'tonghua-putaojiu', why: '回市区补一段工业遗产，雨天备选' }
    ],
    sources: [S('集安市高句丽文物景区管理有限公司', 'http://www.gaogouli-tour.com/', 'operator'), HALL],
    verifiedAt: '2026-11-16', confidence: 'medium', caveat: '遗产点位可能分别售票与限流，参观顺序以景区官方说明为准。'
  },
  {
    id: 'chaganhu-winter-1d', name: '查干湖冬捕一日：渔猎现场', days: 1,
    cluster: 'chaganhu', areas: ['松原市'], themes: ['冬捕', '民俗'],
    season: ['winter'],
    nodes: [
      { day: 1, slot: '上午', attractionId: 'chaganhu', why: '冬捕出网多在上午，必须早到' },
      { day: 1, slot: '午后', attractionId: 'guoerluosi-wangfu', why: '返程顺路，室内看蒙古族王府' },
      { day: 1, slot: '傍晚', attractionId: 'qianan-nilin', why: '泥林日落出片，但冬季路况需评估' }
    ],
    sources: [S('吉林查干湖渔业有限公司', 'https://www.cgh.org.cn/', 'operator'), HALL],
    verifiedAt: '2026-11-16', confidence: 'low',
    caveat: '冬捕开网日期每年不同、点位随冰情变化，务必以运营方官方公告为准。'
  },
  {
    id: 'xianghai-birds-2d', name: '白城湿地两日：候鸟与苇海', days: 2,
    cluster: 'xianghai', areas: ['白城市'], themes: ['观鸟', '湿地'],
    season: ['spring', 'autumn'],
    nodes: [
      { day: 1, slot: '上午', attractionId: 'xianghai', why: '清晨是候鸟活动高峰，观鸟要赶早' },
      { day: 1, slot: '午后', attractionId: 'momoge', why: '两处湿地同日走，住宿安排在镇赉' },
      { day: 2, slot: '上午', attractionId: 'nenjiangwan', why: '回程方向的水域，夏季看荷花' }
    ],
    sources: [HALL], verifiedAt: '2026-11-16', confidence: 'medium',
    caveat: '核心区禁入、观鸟点位随水位变化，以保护区管理机构官方公告为准。'
  },
  {
    id: 'siping-red-1d', name: '四平辽源一日：红色与古城', days: 1,
    cluster: 'siping', areas: ['四平市', '辽源市'], themes: ['红色', '历史'],
    season: ['spring', 'summer', 'autumn', 'winter'],
    nodes: [
      { day: 1, slot: '上午', attractionId: 'siping-zhanyi', why: '纪念馆讲解需预约，上午场次最稳' },
      { day: 1, slot: '午后', attractionId: 'yehe', why: '满族古城在返程方向，顺路不绕' },
      { day: 1, slot: '傍晚', attractionId: 'kuanggongmu', why: '辽源方向的收尾点，适合研学团队' }
    ],
    sources: [HALL], verifiedAt: '2026-11-16', confidence: 'medium', caveat: CAVEAT_TIMING
  }
]);

// 知识库结构与日期在构建/测试阶段校验，Worker 模块初始化不依赖运行时钟。

export function routeById(id) {
  return ROUTES.find(route => route.id === id) || null;
}

export function routesByCluster(cluster) {
  return ROUTES.filter(route => route.cluster === cluster);
}
