// ==================== 学科情境库 ====================
// 为不同学科、不同学段提供多样化的命题情境

export const subjectContextLibrary = {
  // ==================== 数学 ====================
  '数学': {
    '小学': {
      label: '小学数学',
      contexts: [
        {
          name: '校园义卖活动',
          description: '班级组织义卖活动，同学们负责统计物品价格、计算找零、分配摊位面积',
          scenes: ['统计义卖物品价格', '计算找零金额', '分配摊位面积', '统计义卖总收入'],
          suitableTopics: ['加减法', '乘除法', '面积计算', '统计图表']
        },
        {
          name: '家庭旅行计划',
          description: '小明家计划一次周末旅行，需要计算路程、时间、预算等',
          scenes: ['出发时间计算', '路程距离计算', '住宿费用预算', '景点门票总价'],
          suitableTopics: ['时间计算', '距离换算', '四则运算', '估算']
        },
        {
          name: '趣味运动会',
          description: '学校举办趣味运动会，需要统计得分、安排比赛顺序、计算成绩',
          scenes: ['接力赛成绩计算', '拔河比赛人数分配', '跳绳次数统计', '总积分排名'],
          suitableTopics: ['加减法', '乘除法', '统计', '比较大小']
        },
        {
          name: '小小超市管理员',
          description: '模拟超市购物场景，帮助同学们理解货币计算和商品统计',
          scenes: ['商品价格计算', '找零练习', '打折促销计算', '库存盘点统计'],
          suitableTopics: ['人民币计算', '加减法', '乘法', '统计']
        },
        {
          name: '手工课的材料准备',
          description: '手工课上需要准备材料，计算所需材料的数量和费用',
          scenes: ['纸张数量计算', '彩带长度测量', '材料费用总计', '剩余材料统计'],
          suitableTopics: ['测量', '加减法', '乘除法', '长度单位']
        }
      ],
      keywords: ['购物', '游戏', '手工', '分享', '校园']
    },
    '初中': {
      label: '初中数学',
      contexts: [
        {
          name: '社区环保项目',
          description: '同学们参与社区环保项目，需要统计数据、设计方案、计算成本',
          scenes: ['垃圾分类统计', '绿化面积计算', '节水方案设计', '碳排放估算'],
          suitableTopics: ['统计', '函数', '方程', '几何面积']
        },
        {
          name: '科技节创新大赛',
          description: '学校举办科技创新大赛，参赛作品需要进行数据分析和模型设计',
          scenes: ['模型制作比例', '竞赛数据分析', '预算优化方案', '成绩预测'],
          suitableTopics: ['相似', '统计', '函数', '概率']
        },
        {
          name: '校园改造计划',
          description: '学校计划改造操场和图书馆，需要进行测量、预算和方案设计',
          scenes: ['操场跑道的几何设计', '图书馆书架排列', '能耗评估', '预算分配'],
          suitableTopics: ['几何', '方程', '不等式', '统计']
        },
        {
          name: '城市地铁建设',
          description: '模拟城市地铁线路规划，运用数学知识解决实际问题',
          scenes: ['地铁票价方案', '线路距离计算', '客流量统计', '最优路线选择'],
          suitableTopics: ['函数', '统计', '不等式', '最值问题']
        },
        {
          name: '手机套餐选择',
          description: '帮助同学分析选择最合适的手机套餐方案',
          scenes: ['通话费用计算', '流量使用分析', '套餐对比', '最优方案决策'],
          suitableTopics: ['一次函数', '不等式', '方案决策', '分段函数']
        }
      ],
      keywords: ['实践', '探究', '决策', '建模', '应用']
    },
    '高中': {
      label: '高中数学',
      contexts: [
        {
          name: '投资理财分析',
          description: '分析不同投资方案的收益和风险，做出最优投资决策',
          scenes: ['复利计算', '风险概率分析', '投资组合优化', '收益率对比'],
          suitableTopics: ['指数函数', '概率', '统计', '优化']
        },
        {
          name: '疫情传播模型',
          description: '运用数学模型分析传染病传播规律，预测发展趋势',
          scenes: ['传播速度分析', '感染人数预测', '防控措施效果评估', '达到峰值时间预测'],
          suitableTopics: ['指数函数', '导数', '概率', '统计']
        },
        {
          name: '卫星轨道设计',
          description: '运用解析几何和函数知识设计卫星运行轨道',
          scenes: ['轨道方程建立', '近地点远地点计算', '速度变化分析', '覆盖范围计算'],
          suitableTopics: ['解析几何', '函数', '导数', '三角函数']
        },
        {
          name: '产品质量控制',
          description: '工厂生产线上运用统计知识进行产品质量检验和控制',
          scenes: ['抽样方案设计', '合格率统计', '正态分布分析', '控制图绘制'],
          suitableTopics: ['概率', '统计', '正态分布', '假设检验']
        }
      ],
      keywords: ['建模', '分析', '预测', '决策', '优化']
    }
  },

  // ==================== 物理 ====================
  '物理': {
    '初中': {
      label: '初中物理',
      contexts: [
        {
          name: '交通安全探究',
          description: '从物理角度分析日常交通中的安全问题',
          scenes: ['刹车距离计算', '安全带原理分析', '超载压强计算', '限速的物理依据'],
          suitableTopics: ['运动', '力', '压强', '惯性']
        },
        {
          name: '厨房中的物理',
          description: '从厨房中的日常现象出发，探究背后的物理原理',
          scenes: ['高压锅原理', '冰箱制冷分析', '微波炉加热', '抽油烟机安装高度'],
          suitableTopics: ['热学', '力学', '电学', '压强']
        },
        {
          name: '运动会上的物理',
          description: '分析体育运动中蕴含的物理知识',
          scenes: ['跳远起跳角度', '铅球抛物线', '跑步起步加速度', '游泳浮力'],
          suitableTopics: ['运动', '力', '浮力', '能量']
        },
        {
          name: '家庭电路安全',
          description: '设计安全合理的家庭电路布局方案',
          scenes: ['插座功率分配', '保险丝选择', '电线规格计算', '漏电保护'],
          suitableTopics: ['电学', '功率', '安全用电']
        }
      ],
      keywords: ['实验', '探究', '应用', '安全', '生活']
    },
    '高中': {
      label: '高中物理',
      contexts: [
        {
          name: '航天发射任务',
          description: '运用力学和运动学知识分析火箭发射过程',
          scenes: ['逃逸速度计算', '轨道对接方案', '微重力实验设计', '太阳能帆板展开'],
          suitableTopics: ['万有引力', '圆周运动', '动量', '能量']
        },
        {
          name: '新能源汽车设计',
          description: '从能量和效率角度分析新能源汽车的设计原理',
          scenes: ['电池续航计算', '能量回收效率', '电机功率匹配', '车身轻量化'],
          suitableTopics: ['能量', '功率', '效率', '电学']
        },
        {
          name: '高速铁路工程师',
          description: '运用力学和电磁学知识设计高速铁路系统',
          scenes: ['转弯半径与速度的关系', '电磁制动原理', '列车能耗计算', '铁轨热胀冷缩分析'],
          suitableTopics: ['圆周运动', '电磁感应', '能量', '热学']
        },
        {
          name: '智能手机研发',
          description: '从物理角度分析智能手机的关键技术',
          scenes: ['触摸屏电容原理', '电池快充技术', '无线充电效率', '陀螺仪与加速度计'],
          suitableTopics: ['电容', '电磁感应', '电学', '传感器']
        },
        {
          name: '核电站技术员',
          description: '了解核电站工作原理，进行安全评估和效率分析',
          scenes: ['核裂变能量计算', '冷却系统设计', '辐射防护方案', '能量转换效率'],
          suitableTopics: ['原子物理', '能量', '热学', '电磁感应']
        },
        {
          name: '光纤通信工程师',
          description: '设计光纤通信系统，运用光学和电磁学知识',
          scenes: ['光纤折射率选择', '信号衰减计算', '全反射条件分析', '光信号调制'],
          suitableTopics: ['光学', '折射', '电磁波', '波的性质']
        },
        {
          name: '体育科学分析师',
          description: '为运动员提供科学训练建议，运用力学知识',
          scenes: ['投篮最佳角度计算', '跳高助跑速度分析', '铅球抛物线优化', '短跑起跑力学分析'],
          suitableTopics: ['抛体运动', '力学', '运动学', '能量转换']
        },
        {
          name: '桥梁结构工程师',
          description: '设计桥梁结构，进行受力分析和材料选择',
          scenes: ['拱桥受力分析', '悬索桥张力计算', '桥墩压强计算', '风振效应分析'],
          suitableTopics: ['力学', '受力分析', '压强', '振动']
        }
      ],
      keywords: ['建模', '计算', '设计', '优化', '科技', '工程', '创新']
    }
  },

  // ==================== 化学 ====================
  '化学': {
    '初中': {
      label: '初中化学',
      contexts: [
        {
          name: '水质检测员',
          description: '模拟水质检测过程，运用化学知识分析水样',
          scenes: ['pH值检测', '硬水软化方案', '溶解氧测定', '净水器原理'],
          suitableTopics: ['溶液', '酸碱盐', '化学与生活']
        },
        {
          name: '金属回收站',
          description: '设计废旧金属分类和回收方案',
          scenes: ['金属活动性鉴别', '防锈方案设计', '合金性能分析', '回收流程优化'],
          suitableTopics: ['金属', '化学反应', '材料']
        },
        {
          name: '厨房化学家',
          description: '通过厨房中的常见现象学习化学原理',
          scenes: ['食盐溶解与结晶', '小苏打发面原理', '食醋除水垢', '纯碱与食盐的区分'],
          suitableTopics: ['溶液', '酸碱盐', '化学与生活', '物质分类']
        },
        {
          name: '环保小卫士',
          description: '参与校园环保项目，运用化学知识解决环境问题',
          scenes: ['酸雨形成模拟', '污水处理方案设计', '白色污染分析', '空气净化材料选择'],
          suitableTopics: ['化学与环境', '酸碱盐', '化学方程式', '材料']
        },
        {
          name: '实验室管理员',
          description: '帮助化学实验室整理药品、设计实验方案',
          scenes: ['药品分类存放', '试剂配制计算', '气体制备装置选择', '实验安全评估'],
          suitableTopics: ['化学实验', '化学计算', '气体制备', '实验安全']
        },
        {
          name: '材料研发员',
          description: '为新产品选择合适的材料，运用化学知识分析材料性能',
          scenes: ['合金材料选择', '塑料材质分析', '防火材料评估', '导电材料对比'],
          suitableTopics: ['金属材料', '合成材料', '化学性质', '材料应用']
        },
        {
          name: '化肥厂技术员',
          description: '在化肥厂工作，需要分析化肥成分和配制方案',
          scenes: ['氮肥含氮量计算', '复合肥配比设计', '土壤酸碱度调节', '化肥鉴别'],
          suitableTopics: ['化学计算', '化学式', '酸碱盐', '化学方程式']
        }
      ],
      keywords: ['实验', '探究', '环保', '应用', '生活', '材料']
    }
  },

  // ==================== 语文 ====================
  '语文': {
    '小学': {
      label: '小学语文',
      contexts: [
        {
          name: '童话创作坊',
          description: '创设童话情境，激发学生的阅读和写作兴趣',
          scenes: ['续写童话结尾', '角色对话补全', '故事道理归纳', '想象作文'],
          suitableTopics: ['阅读', '写作', '口语交际']
        },
        {
          name: '小小观察家',
          description: '引导学生观察生活中的细节，培养表达能力',
          scenes: ['植物生长日记', '天气变化记录', '小动物观察', '家人采访'],
          suitableTopics: ['写作', '口语交际', '综合性学习']
        },
        {
          name: '传统节日之旅',
          description: '通过传统节日情境学习古诗和传统文化',
          scenes: ['春节习俗介绍', '中秋赏月写诗', '端午包粽子', '元宵猜灯谜'],
          suitableTopics: ['古诗', '阅读', '写作', '传统文化']
        }
      ],
      keywords: ['阅读', '写作', '观察', '想象', '表达']
    },
    '初中': {
      label: '初中语文',
      contexts: [
        {
          name: '校园文学社',
          description: '以校园文学社活动为载体，进行阅读和写作训练',
          scenes: ['名著读后感', '诗歌创作比赛', '辩论赛准备', '人物访谈'],
          suitableTopics: ['阅读', '写作', '口语交际', '综合性学习']
        },
        {
          name: '文化研学之旅',
          description: '通过文化研学活动，深入理解传统文化和地域特色',
          scenes: ['名人故居参观', '非遗项目体验', '地方戏曲欣赏', '美食文化探究'],
          suitableTopics: ['阅读', '写作', '综合性学习', '传统文化']
        }
      ],
      keywords: ['阅读', '写作', '文化', '思辨', '表达']
    },
    '高中': {
      label: '高中语文',
      contexts: [
        {
          name: '时代精神思辨',
          description: '围绕当代社会热点，进行思辨性阅读和表达训练',
          scenes: ['科技伦理讨论', '文化传承辩论', '社会责任思考', '人生价值探讨'],
          suitableTopics: ['议论文', '思辨阅读', '写作', '综合性学习']
        }
      ],
      keywords: ['思辨', '议论', '文化', '时代', '价值']
    }
  },

  // ==================== 英语 ====================
  '英语': {
    '小学': {
      label: '小学英语',
      contexts: [
        {
          name: '动物园一日游',
          description: '模拟动物园参观场景，练习动物和颜色相关词汇',
          scenes: ['认识动物名称', '描述动物特征', '询问和回答路线', '写游览日记'],
          suitableTopics: ['词汇', '句型', '口语交际', '写作']
        },
        {
          name: '生日派对准备',
          description: '筹备一个生日派对，练习购物和邀请相关英语',
          scenes: ['写邀请函', '购买派对用品', '点餐对话', '感谢卡写作'],
          suitableTopics: ['词汇', '句型', '写作', '口语交际']
        }
      ],
      keywords: ['游戏', '对话', '情景', '趣味']
    },
    '初中': {
      label: '初中英语',
      contexts: [
        {
          name: '国际交流生',
          description: '模拟作为交换生到英语国家学习的情境',
          scenes: ['自我介绍', '学校课程讨论', '家庭寄宿生活', '周末活动安排'],
          suitableTopics: ['口语', '阅读', '写作', '文化意识']
        },
        {
          name: '环保志愿者',
          description: '参与国际环保志愿活动，练习英语表达',
          scenes: ['环保海报制作', '社区宣传活动', '倡议书撰写', '成果汇报展示'],
          suitableTopics: ['写作', '阅读', '口语', '综合性学习']
        }
      ],
      keywords: ['交流', '文化', '实践', '表达', '合作']
    }
  }
};

/**
 * 根据学段自动选择合适的情境
 * @param {string} subject - 学科名称
 * @param {string} stage - 学段（小学/初中/高中）
 * @param {number} count - 需要返回的情境数量
 * @returns {Array} 情境数组
 */
export const getContextsForSubject = (subject, stage, count = 3) => {
  const stageData = subjectContextLibrary[subject]?.[stage];
  if (!stageData || !stageData.contexts?.length) {
    // 降级：尝试返回该学科任意学段的情境
    const anyStage = Object.values(subjectContextLibrary[subject] || {})[0];
    if (anyStage?.contexts?.length) {
      return anyStage.contexts.slice(0, count);
    }
    return [];
  }

  // 随机打乱后取前 count 个
  const shuffled = [...stageData.contexts].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
};

/**
 * 获取情境的关键词列表
 * @param {string} subject - 学科名称
 * @param {string} stage - 学段
 * @returns {Array} 关键词数组
 */
export const getSubjectKeywords = (subject, stage) => {
  return subjectContextLibrary[subject]?.[stage]?.keywords || [];
};

export default {
  subjectContextLibrary,
  getContextsForSubject,
  getSubjectKeywords
};