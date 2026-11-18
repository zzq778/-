/**
 * 吉林文旅知识库 · 景点/场馆（wenlv-v1，D2 扩量 40 条）
 *
 * 覆盖 9 个市州：长春 7、吉林 6、延边 8、通化 5、白山 5、松原 3、白城 3、四平 2、辽源 1。
 * 事实只到“名称 / 位置 / 类别 / 等级 / 季节 / 官方入口”这一层；
 * 票价与开放时间一律为 null，由界面提示“以官方为准”——不猜、不写区间。
 *
 * 等级只在官方口径确认时才填，未确认的写 null（诚实优先于好看）。
 * 字段定义见 docs/WENLV_SCHEMA.md；来源见 docs/WENLV_DATA_SOURCES.md。
 */

const S = (label, url, kind = 'gov') => ({ label, url, kind });
const HALL = S('吉林省文化和旅游厅', 'https://whhlyt.jl.gov.cn/');
const CC = S('长春市文化广播电视和旅游局', 'http://wglj.changchun.gov.cn/');
const JL = S('吉林市文化广播电视和旅游局', 'http://lyj.jlcity.gov.cn/');
const CBS = S('长白山保护开发区管委会', 'http://www.changbaishan.gov.cn/');

export const ATTRACTIONS = Object.freeze([
  // ── 长春市（7）──────────────────────────────────────────────
  {
    id: 'weimanhuanggong', name: '伪满皇宫博物院', aliases: ['伪满皇宫', '溥仪宫廷旧址'],
    area: '长春市', cluster: 'changchun', kind: '人文', level: '5A',
    tags: ['博物馆', '宫廷旧址', '近代史'], season: { best: ['spring', 'summer', 'autumn', 'winter'], note: '室内为主，四季可看' },
    hours: null, ticket: null, booking: '官方渠道实名预约',
    sources: [S('伪满皇宫博物院', 'http://www.wmhg.com.cn/', 'official'), CC],
    verifiedAt: '2026-11-16', confidence: 'high',
    caveat: '开放时间、预约名额与票价以博物院官方公告为准；馆内拍摄须遵守现场指引。'
  },
  {
    id: 'jingyuetan', name: '净月潭', aliases: ['净月潭国家森林公园', '净月潭景区'],
    area: '长春市', cluster: 'changchun', kind: '自然', level: '5A',
    tags: ['森林', '环潭步道', '四季'], season: { best: ['spring', 'summer', 'autumn', 'winter'], note: '冬季有冰雪活动' },
    hours: '正门 06:00 开园、19:00 停止入园；游客中心 8:30 开园、16:30 停止入园',
    ticket: '成人全价票 30 元/人，优惠半价 15 元/人；65 周岁以上等凭有效证件免票',
    booking: '官方小程序、美团/携程等 OTA，或游客中心售票窗口',
    sources: [S('净月潭景区', 'http://www.ijingyuetan.com/', 'official'),
      S('净月潭票务信息', 'http://www.ijingyuetan.com/about/piaowuxinxi', 'official'), CC],
    verifiedAt: '2026-11-17', confidence: 'high',
    caveat: '观光车、自驾车与季节性活动另行收费，以景区当日公布为准。'
  },
  {
    id: 'changying-jiuzhi', name: '长影旧址博物馆', aliases: ['长影博物馆', '长影洗印车间旧址'],
    area: '长春市', cluster: 'changchun', kind: '工业', level: null,
    tags: ['电影', '工业遗产', '爱国主义教育'], season: { best: ['spring', 'summer', 'autumn', 'winter'] },
    hours: null, ticket: null, booking: null,
    sources: [CC],
    verifiedAt: '2026-11-16', confidence: 'medium',
    caveat: '开放时间与票务信息以场馆官方渠道公布为准，景区等级尚未核对。'
  },
  {
    id: 'shijie-diaosuyuan', name: '长春世界雕塑园', aliases: ['世界雕塑公园', '长春雕塑公园'],
    area: '长春市', cluster: 'changchun', kind: '人文', level: '5A',
    tags: ['雕塑', '户外展览', '亲子'], season: { best: ['spring', 'summer', 'autumn'] },
    hours: null, ticket: null, booking: null,
    sources: [CC, HALL],
    verifiedAt: '2026-11-16', confidence: 'medium',
    caveat: '园内展馆与室外展区票务规则不同，以园区官方说明为准。'
  },
  {
    id: 'sheng-bowuguan', name: '吉林省博物院', aliases: ['省博', '吉林省博物馆'],
    area: '长春市', cluster: 'changchun', kind: '人文', level: null,
    tags: ['博物馆', '历史', '免费开放'], season: { best: ['spring', 'summer', 'autumn', 'winter'] },
    hours: null, ticket: null, booking: '官方公众号预约',
    sources: [HALL],
    verifiedAt: '2026-11-16', confidence: 'medium',
    caveat: '是否需要预约、闭馆日与临展安排以博物院官方公告为准。'
  },
  {
    id: 'dongbeihu', name: '吉林省东北虎园', aliases: ['东北虎园'],
    area: '长春市', cluster: 'changchun', kind: '自然', level: null,
    tags: ['动物', '亲子', '半野生放养'], season: { best: ['spring', 'summer', 'autumn'] },
    hours: null, ticket: null, booking: null,
    sources: [CC],
    verifiedAt: '2026-11-16', confidence: 'medium',
    caveat: '投喂、观光车等项目单独收费，以园区官方公布为准。'
  },
  {
    id: 'lianhuashan', name: '长春莲花山滑雪场', aliases: ['莲花山滑雪', '莲花山生态旅游度假区'],
    area: '长春市', cluster: 'changchun', kind: '冰雪', level: null,
    tags: ['滑雪', '冬季', '雪场'], season: { best: ['winter'], note: '雪季通常 11 月下旬至次年 3 月' },
    hours: null, ticket: null, booking: null,
    sources: [CC],
    verifiedAt: '2026-11-16', confidence: 'medium',
    caveat: '雪季起止、雪票与雪具租赁价格以雪场官方发布为准。'
  },

  // ── 吉林市（6）──────────────────────────────────────────────
  {
    id: 'wusongdao', name: '雾凇岛', aliases: ['雾凇岛景区', '韩屯雾凇'],
    area: '吉林市', cluster: 'wusong', kind: '自然', level: '3A',
    tags: ['雾凇', '摄影', '冰雪'], season: { best: ['winter'], note: '雾凇集中在 12 月至次年 2 月的清晨' },
    hours: null, ticket: null, booking: null,
    sources: [JL, S('吉林市人民政府', 'http://www.jlcity.gov.cn/')],
    verifiedAt: '2026-11-16', confidence: 'medium',
    caveat: '雾凇是否出现取决于当夜气温、湿度与风力，观赏条件与门票以吉林市文旅部门和景区官方公告为准。'
  },
  {
    id: 'songhuahu', name: '松花湖', aliases: ['松花湖风景名胜区', '松花湖景区'],
    area: '吉林市', cluster: 'songhuahu', kind: '自然', level: '4A',
    tags: ['湖光山色', '避暑', '冰雪'], season: { best: ['summer', 'autumn', 'winter'], note: '冬季有滑雪与冰雪项目' },
    hours: null, ticket: null, booking: null,
    sources: [S('吉林松花湖风景名胜区管理委员会', 'http://jlsonghuahu.jlcity.gov.cn/'), JL],
    verifiedAt: '2026-11-16', confidence: 'high',
    caveat: '湖区各码头与雪场分别运营，游船、雪票价格以运营方官方公布为准。'
  },
  {
    id: 'beidahu', name: '北大湖滑雪度假区', aliases: ['北大湖', '北大壶滑雪场'],
    area: '吉林市', cluster: 'jilin-city', kind: '冰雪', level: null,
    tags: ['滑雪', '雪道', '冬季运动'], season: { best: ['winter'], note: '雪季通常 11 月至次年 4 月' },
    hours: null, ticket: null, booking: null,
    sources: [JL],
    verifiedAt: '2026-11-16', confidence: 'medium',
    caveat: '雪票、缆车与住宿套餐价格随季节浮动，以度假区官方渠道为准。'
  },
  {
    id: 'wanke-songhuahu', name: '万科松花湖度假区', aliases: ['万科松花湖', '松花湖度假区'],
    area: '吉林市', cluster: 'songhuahu', kind: '冰雪', level: null,
    tags: ['滑雪', '度假', '亲子'], season: { best: ['winter'] },
    hours: null, ticket: null, booking: null,
    sources: [JL],
    verifiedAt: '2026-11-16', confidence: 'medium',
    caveat: '雪季安排与套餐价格以度假区官方发布为准。'
  },
  {
    id: 'wulajie', name: '乌拉街满族镇', aliases: ['乌拉街', '乌拉部故城', '三府'],
    area: '吉林市', cluster: 'jilin-city', kind: '人文', level: null,
    tags: ['满族文化', '古镇', '民俗'], season: { best: ['spring', 'summer', 'autumn'] },
    hours: null, ticket: null, booking: null,
    sources: [JL],
    verifiedAt: '2026-11-16', confidence: 'medium',
    caveat: '“三府”展馆的开放时间与讲解服务以当地官方公告为准。'
  },
  {
    id: 'jilin-bowuguan', name: '吉林市博物馆', aliases: ['吉林市陨石博物馆', '陨石博物馆'],
    area: '吉林市', cluster: 'jilin-city', kind: '人文', level: null,
    tags: ['陨石', '博物馆', '科普'], season: { best: ['spring', 'summer', 'autumn', 'winter'] },
    hours: null, ticket: null, booking: null,
    sources: [JL],
    verifiedAt: '2026-11-16', confidence: 'medium',
    caveat: '预约方式、闭馆日与讲解场次以馆方官方公告为准。'
  },

  // ── 延边州（8）──────────────────────────────────────────────
  {
    id: 'changbaishan-bei', name: '长白山北景区', aliases: ['长白山', '天池', '长白山北坡'],
    area: '延边州', cluster: 'changbaishan', kind: '自然', level: '5A',
    tags: ['天池', '火山地貌', '避暑', '冬季雪景'], season: { best: ['summer', 'winter'], note: '主峰能否登顶视天气与景区当日调度' },
    hours: null, ticket: null, booking: '官方小程序或公众号实名预约，分时分段入园',
    sources: [CBS, HALL],
    verifiedAt: '2026-11-16', confidence: 'high',
    caveat: '票价、预约时段与当日开放状态以长白山官方购票平台公告为准；天池区域可能因天气临时关闭。'
  },
  {
    id: 'liudingshan', name: '六鼎山文化旅游区', aliases: ['六鼎山', '金鼎大佛', '敦化六鼎山'],
    area: '延边州', cluster: 'yanbian', kind: '人文', level: '5A',
    tags: ['佛教文化', '金鼎大佛', '敦化'], season: { best: ['spring', 'summer', 'autumn'] },
    hours: null, ticket: null, booking: null,
    sources: [S('六鼎山文化旅游区', 'http://www.jindingdafo.com/', 'official')],
    verifiedAt: '2026-11-16', confidence: 'high',
    caveat: '门票、景交车与宗教场所礼仪要求以景区官方公告为准。'
  },
  {
    id: 'chaoxianzu-minsuyuan', name: '中国朝鲜族民俗园', aliases: ['朝鲜族民俗园', '延吉不夜城'],
    area: '延边州', cluster: 'yanbian', kind: '民俗', level: '4A',
    tags: ['朝鲜族', '民俗体验', '夜间经济'], season: { best: ['spring', 'summer', 'autumn', 'winter'] },
    hours: null, ticket: null, booking: null,
    sources: [S('延吉市人民政府', 'http://www.yanji.gov.cn/')],
    verifiedAt: '2026-11-16', confidence: 'high',
    caveat: '是否需要门票、旅拍与演出安排以园区官方发布为准。'
  },
  {
    id: 'maoershan', name: '延吉帽儿山', aliases: ['帽儿山', '帽儿山国家森林公园'],
    area: '延边州', cluster: 'yanbian', kind: '自然', level: null,
    tags: ['登山', '森林', '城市近郊'], season: { best: ['spring', 'summer', 'autumn'] },
    hours: null, ticket: null, booking: null,
    sources: [S('延吉市人民政府', 'http://www.yanji.gov.cn/')],
    verifiedAt: '2026-11-16', confidence: 'medium',
    caveat: '登山步道开放状态与停车安排以当地官方公告为准。'
  },
  {
    id: 'fangchuan', name: '珲春防川景区', aliases: ['防川', '一眼望三国'],
    area: '延边州', cluster: 'yanbian', kind: '人文', level: null,
    tags: ['边境', '观景', '龙虎阁'], season: { best: ['spring', 'summer', 'autumn'] },
    hours: null, ticket: null, booking: null,
    sources: [HALL],
    verifiedAt: '2026-11-16', confidence: 'medium',
    caveat: '边境区域需携带有效证件，通行与观景台开放以当地官方公告为准。'
  },
  {
    id: 'tumen-kouan', name: '图们口岸', aliases: ['图们江', '图们边境'],
    area: '延边州', cluster: 'yanbian', kind: '人文', level: null,
    tags: ['边境', '口岸', '江景'], season: { best: ['spring', 'summer', 'autumn'] },
    hours: null, ticket: null, booking: null,
    sources: [HALL],
    verifiedAt: '2026-11-16', confidence: 'low',
    caveat: '口岸区域管理严格，开放范围与参观规定以官方公告为准；不得拍摄边检设施。'
  },
  {
    id: 'yanminghu', name: '敦化雁鸣湖', aliases: ['雁鸣湖', '雁鸣湖湿地'],
    area: '延边州', cluster: 'yanbian', kind: '自然', level: null,
    tags: ['湿地', '观鸟', '湖泊'], season: { best: ['spring', 'summer', 'autumn'] },
    hours: null, ticket: null, booking: null,
    sources: [HALL],
    verifiedAt: '2026-11-16', confidence: 'medium',
    caveat: '湿地保护区部分区域限入，观鸟点位与开放时间以官方公告为准。'
  },
  {
    id: 'jindalai-cun', name: '和龙金达莱村', aliases: ['金达莱村', '和龙金达莱'],
    area: '延边州', cluster: 'yanbian', kind: '民俗', level: null,
    tags: ['朝鲜族', '花季', '乡村'], season: { best: ['spring'], note: '金达莱花期约 4 月末至 5 月' },
    hours: null, ticket: null, booking: null,
    sources: [HALL],
    verifiedAt: '2026-11-16', confidence: 'medium',
    caveat: '花期受气温影响，民俗体验项目与收费以村集体或当地官方发布为准。'
  },

  // ── 通化市（5）──────────────────────────────────────────────
  {
    id: 'gaogouli-ji-an', name: '高句丽文物古迹旅游景区', aliases: ['高句丽景区', '好太王碑', '丸都山城'],
    area: '通化市', cluster: 'jian', kind: '遗址', level: '5A',
    tags: ['世界文化遗产', '好太王碑', '壁画墓'], season: { best: ['summer', 'autumn'], note: '冬季户外遗址体感较冷' },
    hours: null, ticket: null, booking: null,
    sources: [S('集安市高句丽文物景区管理有限公司', 'http://www.gaogouli-tour.com/', 'operator')],
    verifiedAt: '2026-11-16', confidence: 'medium',
    caveat: '各遗址点位可能分别售票与限流，参观顺序、票价以景区官方说明为准。'
  },
  {
    id: 'yalujiang', name: '集安鸭绿江国境旅游区', aliases: ['鸭绿江', '集安江边'],
    area: '通化市', cluster: 'jian', kind: '自然', level: null,
    tags: ['界江', '游船', '边境'], season: { best: ['spring', 'summer', 'autumn'] },
    hours: null, ticket: null, booking: null,
    sources: [HALL],
    verifiedAt: '2026-11-16', confidence: 'medium',
    caveat: '游船班次与边境区域管理规定以当地官方公告为准。'
  },
  {
    id: 'longwan', name: '辉南龙湾群国家森林公园', aliases: ['龙湾群', '三角龙湾', '辉南龙湾'],
    area: '通化市', cluster: 'jian', kind: '自然', level: null,
    tags: ['火山湖', '森林', '避暑'], season: { best: ['summer', 'autumn'], note: '秋色约在 9 月下旬至 10 月' },
    hours: null, ticket: null, booking: null,
    sources: [HALL],
    verifiedAt: '2026-11-16', confidence: 'medium',
    caveat: '各龙湾点位距离较远，观光车与门票组合以景区官方公布为准。'
  },
  {
    id: 'wunvfeng', name: '集安五女峰国家森林公园', aliases: ['五女峰', '集安五女峰'],
    area: '通化市', cluster: 'jian', kind: '自然', level: null,
    tags: ['登山', '红叶', '森林'], season: { best: ['summer', 'autumn'] },
    hours: null, ticket: null, booking: null,
    sources: [HALL],
    verifiedAt: '2026-11-16', confidence: 'medium',
    caveat: '登山线路强度不同，索道与门票价格以景区官方公告为准。'
  },
  {
    id: 'tonghua-putaojiu', name: '通化葡萄酒博物馆', aliases: ['通化葡萄酒', '葡萄酒厂旧址'],
    area: '通化市', cluster: 'jian', kind: '工业', level: null,
    tags: ['工业遗产', '葡萄酒', '参观'], season: { best: ['spring', 'summer', 'autumn', 'winter'] },
    hours: null, ticket: null, booking: null,
    sources: [HALL],
    verifiedAt: '2026-11-16', confidence: 'low',
    caveat: '参观需提前预约，开放时间与品鉴安排以企业官方渠道为准。'
  },

  // ── 白山市（5）──────────────────────────────────────────────
  {
    id: 'changbaishan-xi', name: '长白山西景区', aliases: ['长白山西坡', '西坡'],
    area: '白山市', cluster: 'changbaishan', kind: '自然', level: '5A',
    tags: ['天池', '高山花园', '台阶'], season: { best: ['summer'] , note: '夏季高山花园，冬季部分区域关闭' },
    hours: null, ticket: null, booking: '官方小程序实名预约',
    sources: [CBS, HALL],
    verifiedAt: '2026-11-16', confidence: 'high',
    caveat: '西坡需登 1442 级台阶，开放季节与门票以长白山官方平台公告为准。'
  },
  {
    id: 'changbaishan-nan', name: '长白山南景区', aliases: ['长白山南坡', '南坡'],
    area: '白山市', cluster: 'changbaishan', kind: '自然', level: '5A',
    tags: ['天池', '鸭绿江源', '人少'], season: { best: ['summer', 'autumn'] },
    hours: null, ticket: null, booking: null,
    sources: [CBS, HALL],
    verifiedAt: '2026-11-16', confidence: 'medium',
    caveat: '南景区开放时间较短，是否开放以长白山官方平台当日公告为准。'
  },
  {
    id: 'lushuihe', name: '露水河国家森林公园', aliases: ['露水河', '露水河林业局'],
    area: '白山市', cluster: 'changbaishan', kind: '自然', level: null,
    tags: ['森林', '漂流', '避暑'], season: { best: ['summer', 'autumn'] },
    hours: null, ticket: null, booking: null,
    sources: [HALL],
    verifiedAt: '2026-11-16', confidence: 'medium',
    caveat: '漂流与森林项目季节性开放，票价与班次以景区官方公布为准。'
  },
  {
    id: 'changbaishan-dujiaqu', name: '长白山国际度假区', aliases: ['抚松万达', '长白山万达度假区'],
    area: '白山市', cluster: 'changbaishan', kind: '冰雪', level: null,
    tags: ['滑雪', '度假', '温泉'], season: { best: ['winter'] },
    hours: null, ticket: null, booking: null,
    sources: [HALL],
    verifiedAt: '2026-11-16', confidence: 'medium',
    caveat: '雪票、住宿与温泉套餐价格以度假区官方渠道为准。'
  },
  {
    id: 'yangjingyu', name: '杨靖宇将军殉国地', aliases: ['杨靖宇烈士陵园', '靖宇县纪念馆'],
    area: '白山市', cluster: 'changbaishan', kind: '遗址', level: null,
    tags: ['红色教育', '纪念地', '研学'], season: { best: ['spring', 'summer', 'autumn'] },
    hours: null, ticket: null, booking: null,
    sources: [HALL],
    verifiedAt: '2026-11-16', confidence: 'medium',
    caveat: '团体讲解需提前预约，开放时间以纪念地管理单位官方公告为准。'
  },

  // ── 松原市（3）──────────────────────────────────────────────
  {
    id: 'chaganhu', name: '查干湖', aliases: ['查干湖旅游区', '查干湖冬捕'],
    area: '松原市', cluster: 'chaganhu', kind: '自然', level: null,
    tags: ['冬捕', '湿地', '渔猎文化'], season: { best: ['winter', 'summer'], note: '冬捕在封湖后举行，夏季适合观湖' },
    hours: null, ticket: null, booking: null,
    sources: [S('吉林查干湖渔业有限公司', 'https://www.cgh.org.cn/', 'operator'), HALL],
    verifiedAt: '2026-11-16', confidence: 'medium',
    caveat: '冬捕的具体开网日期、票价与观捕组织方式每年不同，以景区运营方官方发布为准。'
  },
  {
    id: 'qianan-nilin', name: '乾安泥林', aliases: ['泥林', '大布苏泥林'],
    area: '松原市', cluster: 'chaganhu', kind: '自然', level: null,
    tags: ['地质奇观', '摄影', '自然保护区'], season: { best: ['spring', 'summer', 'autumn'] },
    hours: null, ticket: null, booking: null,
    sources: [HALL],
    verifiedAt: '2026-11-16', confidence: 'low',
    caveat: '泥林属保护区地貌，部分区域禁止进入，开放范围以管理单位官方公告为准。'
  },
  {
    id: 'guoerluosi-wangfu', name: '郭尔罗斯王府', aliases: ['前郭王府', '郭尔罗斯前旗王府'],
    area: '松原市', cluster: 'chaganhu', kind: '人文', level: null,
    tags: ['蒙古族', '王府', '历史'], season: { best: ['spring', 'summer', 'autumn'] },
    hours: null, ticket: null, booking: null,
    sources: [HALL],
    verifiedAt: '2026-11-16', confidence: 'low',
    caveat: '展陈开放时间与讲解服务以当地官方公告为准。'
  },

  // ── 白城市（3）──────────────────────────────────────────────
  {
    id: 'xianghai', name: '向海国家级自然保护区', aliases: ['向海', '向海湿地'],
    area: '白城市', cluster: 'xianghai', kind: '自然', level: null,
    tags: ['湿地', '观鸟', '丹顶鹤'], season: { best: ['spring', 'autumn'], note: '候鸟迁徙季 4–5 月、9–10 月' },
    hours: null, ticket: null, booking: null,
    sources: [HALL],
    verifiedAt: '2026-11-16', confidence: 'medium',
    caveat: '核心区限制进入，观鸟点位与门票以保护区管理机构官方公告为准。'
  },
  {
    id: 'momoge', name: '莫莫格国家级自然保护区', aliases: ['莫莫格', '莫莫格湿地'],
    area: '白城市', cluster: 'xianghai', kind: '自然', level: null,
    tags: ['湿地', '白鹤', '观鸟'], season: { best: ['autumn'], note: '白鹤停歇期约 9–10 月' },
    hours: null, ticket: null, booking: null,
    sources: [HALL],
    verifiedAt: '2026-11-16', confidence: 'medium',
    caveat: '保护区实验区可参观，核心区禁入；具体范围与开放时间以管理机构官方公告为准。'
  },
  {
    id: 'nenjiangwan', name: '大安嫩江湾', aliases: ['嫩江湾', '嫩江湾湿地'],
    area: '白城市', cluster: 'xianghai', kind: '自然', level: null,
    tags: ['湿地', '荷花', '草原'], season: { best: ['summer'] },
    hours: null, ticket: null, booking: null,
    sources: [HALL],
    verifiedAt: '2026-11-16', confidence: 'low',
    caveat: '游船与景区交通价格以运营方官方公布为准。'
  },

  // ── 四平市（2）──────────────────────────────────────────────
  {
    id: 'yehe', name: '叶赫那拉城', aliases: ['叶赫古城', '叶赫满族镇'],
    area: '四平市', cluster: 'siping', kind: '人文', level: null,
    tags: ['满族', '古城', '影视基地'], season: { best: ['spring', 'summer', 'autumn'] },
    hours: null, ticket: null, booking: null,
    sources: [HALL],
    verifiedAt: '2026-11-16', confidence: 'medium',
    caveat: '景区含影视拍摄区域，开放范围与门票以景区官方公告为准。'
  },
  {
    id: 'siping-zhanyi', name: '四平战役纪念馆', aliases: ['四平战役', '四平烈士纪念塔'],
    area: '四平市', cluster: 'siping', kind: '遗址', level: null,
    tags: ['红色教育', '纪念馆', '研学'], season: { best: ['spring', 'summer', 'autumn', 'winter'] },
    hours: null, ticket: null, booking: null,
    sources: [HALL],
    verifiedAt: '2026-11-16', confidence: 'medium',
    caveat: '团队参观需预约，开放时间与讲解安排以馆方官方公告为准。'
  },

  // ── 辽源市（1）──────────────────────────────────────────────
  {
    id: 'kuanggongmu', name: '辽源矿工墓陈列馆', aliases: ['矿工墓', '辽源矿工墓'],
    area: '辽源市', cluster: 'siping', kind: '遗址', level: null,
    tags: ['红色教育', '爱国主义教育', '陈列馆'], season: { best: ['spring', 'summer', 'autumn', 'winter'] },
    hours: null, ticket: null, booking: null,
    sources: [HALL],
    verifiedAt: '2026-11-16', confidence: 'medium',
    caveat: '开放时间与团体接待以馆方官方公告为准。'
  }
]);

// 知识库结构与日期在构建/测试阶段校验，Worker 模块初始化不依赖运行时钟。

export function byId(id) {
  return ATTRACTIONS.find(entry => entry.id === id) || null;
}

export function byArea(area) {
  return ATTRACTIONS.filter(entry => entry.area === area);
}

export function byCluster(cluster) {
  return ATTRACTIONS.filter(entry => entry.cluster === cluster);
}
