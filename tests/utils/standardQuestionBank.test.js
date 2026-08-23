// 标准题型骨架 + 命题素材提取（从源头达标的生成范式）
import { describe, it, expect } from 'vitest';
import { getStandardQuestion, buildStandardQuestionText, STANDARD_QUESTION_BANK } from '@/config/standardQuestionBank';
import { extractPropositionMaterial, buildPropositionMaterialText } from '@/config/propositionMaterial';
import { buildSectionInstruction } from '@/config/examPipeline';
import { getExamBlueprint, EXAM_BLUEPRINTS } from '@/config/examPaperBlueprints';

// 模拟教材分段（含原文与知识点标注）
const FAKE_CARDS = [
  {
    chapterTitle: '第一单元',
    segments: [
      { text: '《望岳》岱宗夫如何？齐鲁青未了。造化钟神秀，阴阳割昏晓。', knowledgePoints: ['古诗文', '杜甫', '《望岳》'], type: '正文' },
      { text: '春天来了，校园里的花开了，同学们在操场上做游戏。', knowledgePoints: ['描写', '校园生活'], type: '正文' },
      { text: '小明去超市买了3千克苹果，每千克5元，付给售货员20元。', knowledgePoints: ['应用题', '购物', '计算'], type: '例题' },
    ],
  },
];

describe('标准题型骨架库（生成端从源头达标）', () => {
  it('语文初中现代文阅读：命中标准骨架，含设问梯度占位与命题铁律', () => {
    const q = getStandardQuestion('语文', 'middle', '现代文阅读');
    expect(q).toBeTruthy();
    expect(q.question).toContain('{why_question}'); // 深度设问占位（由素材填充）
    expect(q.question).toContain('{infer_question}');
    expect(q.rule).toContain('禁止照搬课文原文');
    expect(q.answer).toContain('按要点给分');
  });

  it('英语中学段书面表达：命中标准骨架，含李华情境与要点提示', () => {
    const q = getStandardQuestion('英语', 'middle', '书面表达');
    expect(q).toBeTruthy();
    expect(q.question).toContain('假定你是李华');
    expect(q.question).toContain('词数100左右');
  });

  it('数学初中应用题：命中标准骨架，含分步设问与情境规则', () => {
    const q = getStandardQuestion('数学', 'middle', '应用题');
    expect(q).toBeTruthy();
    expect(q.question).toContain('求');
    expect(q.rule).toContain('情境真实');
  });

  it('未命中题型返回 null（不注入误导）', () => {
    expect(getStandardQuestion('语文', 'middle', '不存在的题型')).toBeNull();
    expect(getStandardQuestion('不存在的学科', 'middle', '阅读')).toBeNull();
  });

  it('buildStandardQuestionText 输出含素养指向（2022课标）、骨架、答案模式、评分标准', () => {
    const t = buildStandardQuestionText('语文', 'middle', '写作');
    expect(t).toContain('标准题型骨架');
    expect(t).toContain('素养指向（2022课标）');
    expect(t).toContain('题干框架');
    expect(t).toContain('答案模式');
    expect(t).toContain('评分标准');
    expect(t).toContain('命题铁律（新课标）');
  });

  it('🔴 新课标素养指向：各学科骨架均含 competency（课标核心素养）', () => {
    const cases = [
      ['语文', 'middle', '现代文阅读'],
      ['数学', 'middle', '应用题'],
      ['英语', 'middle', '完形填空'],
      ['物理', 'middle', '伏安法测电阻'],
      ['物理', 'middle', '电学计算'],
    ];
    for (const [subj, stage, type] of cases) {
      const q = getStandardQuestion(subj, stage, type);
      expect(q.competency, `${subj}|${type} 缺素养指向`).toBeTruthy();
      expect(q.competency).toMatch(/素养|任务群|观念|能力/);
    }
  });

  it('🔴 新课标导向：完形填空禁止纯语法挖空，数学客观题<主观题', () => {
    const cloze = getStandardQuestion('英语', 'middle', '完形填空');
    expect(cloze.rule).toContain('禁止纯语法挖空');
    const choice = getStandardQuestion('数学', 'middle', '选择题');
    expect(choice.rule).toContain('客观题分值应低于主观题');
  });

  it('物理电学：伏安法测电阻骨架含标准设问链（连接→读数→计算→评估）', () => {
    const q = getStandardQuestion('物理', 'middle', '伏安法测电阻');
    expect(q).toBeTruthy();
    expect(q.question).toContain('用笔画线代替导线');
    expect(q.question).toContain('滑动变阻器的滑片移至最____端');
    expect(q.question).toContain('保留一位小数');
    expect(q.rule).toContain('设问链固定');
  });

  it('物理电学：测量小灯泡电功率骨架含额定功率取法规则', () => {
    const q = getStandardQuestion('物理', 'middle', '测量小灯泡电功率');
    expect(q).toBeTruthy();
    expect(q.question).toContain('额定电压');
    expect(q.question).toContain('正常发光');
    expect(q.rule).toContain('不取平均');
  });

  it('物理电学：电学计算骨架含家用电器情境与分步设问', () => {
    const q = getStandardQuestion('物理', 'middle', '电学计算');
    expect(q).toBeTruthy();
    expect(q.question).toContain('额定电压220V');
    expect(q.question).toContain('求电热丝R₁的阻值');
    expect(q.rule).toContain('禁止编造不合理数据');
  });

  it('物理电学：电能表计算骨架含转盘计算与热效应考查', () => {
    const q = getStandardQuestion('物理', 'middle', '电能表计算');
    expect(q).toBeTruthy();
    expect(q.question).toContain('kW·h');
    expect(q.question).toContain('____效应'); // 电流的"热"效应（填空考查）
    expect(q.rule).toContain('3000r/kW·h');
  });
});

describe('命题素材提取器（教材→可加工要素，非原文）', () => {
  it('提取考点词、情境元素、数据（非原文段落）', () => {
    const m = extractPropositionMaterial(FAKE_CARDS, ['古诗文', '应用题']);
    expect(m.concepts).toContain('古诗文');
    expect(m.scenarios.length).toBeGreaterThan(0); // 《望岳》书名号情境
    expect(m.numbers.some(n => n.includes('3千克') || n.includes('5元'))).toBe(true); // 应用题数据
    expect(m.vocab.length).toBeGreaterThan(0); // 语料词
    expect(m.forbidden).toContain('禁止照抄教材原文');
  });

  it('素材文本不包含整段原文（只含要素），明确加工规则', () => {
    const t = buildPropositionMaterialText(FAKE_CARDS, ['古诗文'], '语文');
    expect(t).toContain('命题素材');
    expect(t).toContain('禁止照抄教材原文');
    // 不直接注入整段课文原文
    expect(t).not.toContain('造化钟神秀');
    expect(t).not.toContain('同学们在操场上做游戏');
  });

  it('板块指令注入标准骨架与命题素材，未注入原文段落', () => {
    const bp = getExamBlueprint('语文', 'middle');
    const plan = { index: 0, name: '现代文阅读', score: 30, questionCount: 4, kps: ['现代文阅读'], note: '课外选文' };
    const sec = buildSectionInstruction(plan, {
      subject: '语文', stage: 'middle', stageLabel: '初中', examBlueprint: bp,
      propositionMaterial: buildPropositionMaterialText(FAKE_CARDS, ['现代文阅读'], '语文'),
      materialText: '', region: '', sectionNo: 1, totalScore: 120, isExamPlan: true,
    });
    expect(sec).toContain('标准题型骨架');
    expect(sec).toContain('命题素材');
    expect(sec).toContain('禁止照抄教材原文');
    // 未注入原文段落
    expect(sec).not.toContain('造化钟神秀');
  });

  it('无素材时回退原文依据并标注禁照抄', () => {
    const bp = getExamBlueprint('语文', 'middle');
    const plan = { index: 0, name: '现代文阅读', score: 30, questionCount: 4, kps: [], note: '' };
    const sec = buildSectionInstruction(plan, {
      subject: '语文', stage: 'middle', stageLabel: '初中', examBlueprint: bp,
      propositionMaterial: '', materialText: '【原文】原文片段内容', region: '', sectionNo: 1, totalScore: 120, isExamPlan: true,
    });
    expect(sec).toContain('教材原文依据');
    expect(sec).toContain('禁止照搬原文段落');
  });
});

describe('🔴 全学科覆盖守卫（骨架库 × 蓝本全板块一一对齐，防止再次漏学科）', () => {
  it('蓝本全部15学科×学段×板块都能命中标准骨架', () => {
    const misses = [];
    let total = 0;
    for (const key of Object.keys(EXAM_BLUEPRINTS)) {
      const [subject, stage] = key.split('|');
      const bp = EXAM_BLUEPRINTS[key];
      if (!bp.sections) continue;
      for (const sec of bp.sections) {
        total++;
        const sectionName = sec.name.replace(/^.*?·/, '');
        const text = buildStandardQuestionText(subject, stage, sectionName);
        if (!text.includes('标准题型骨架')) misses.push(`${key} → ${sec.name}`);
      }
    }
    expect(total).toBeGreaterThanOrEqual(170);
    expect(misses).toEqual([]);
  });

  it('骨架库覆盖全学科15个（语数英物化生道法思政史地科学信息科技音乐美术体育）', () => {
    const subjects = Object.keys(STANDARD_QUESTION_BANK);
    expect(subjects).toHaveLength(15);
    for (const s of ['语文', '数学', '英语', '物理', '化学', '生物', '道德与法治', '思想政治', '历史', '地理', '科学', '信息科技', '音乐', '美术', '体育']) {
      expect(subjects).toContain(s);
    }
  });

  it('全部150个骨架均含五要素（question/answer/score/competency/rule）', () => {
    let count = 0;
    for (const stages of Object.values(STANDARD_QUESTION_BANK)) {
      for (const types of Object.values(stages)) {
        for (const [type, sk] of Object.entries(types)) {
          count++;
          for (const f of ['question', 'answer', 'score', 'competency', 'rule']) {
            expect(sk[f], `${type} 缺 ${f}`).toBeTruthy();
          }
          // competency 为人工编写的课标素养指向，须有实质内容（非占位）
          expect(sk.competency.length, `${type} competency 无实质内容`).toBeGreaterThan(6);
          expect(sk.rule.length, `${type} rule 无实质内容`).toBeGreaterThan(6);
        }
      }
    }
    expect(count).toBeGreaterThanOrEqual(140);
  });

  it('化学初中实验探究题：方案→现象→数据→结论→反思完整链', () => {
    const q = getStandardQuestion('化学', 'middle', '实验探究题');
    expect(q).toBeTruthy();
    expect(q.question).toContain('猜想');
    expect(q.question).toContain('现象');
    expect(q.rule).toContain('禁止只问结论');
  });

  it('道德与法治初中材料分析题：情境探究+法理阐释+实践应用', () => {
    const q = getStandardQuestion('道德与法治', 'middle', '材料分析题');
    expect(q).toBeTruthy();
    expect(q.question).toContain('结合所学知识分析');
    expect(q.question).toContain('应该怎么做');
    expect(q.rule).toContain('知行合一');
  });

  it('历史初中非选择题：论从史出（结合材料+所学）', () => {
    const q = getStandardQuestion('历史', 'middle', '非选择题');
    expect(q).toBeTruthy();
    expect(q.question).toContain('结合材料和所学知识');
    expect(q.rule).toContain('论从史出');
    expect(q.rule).toContain('禁止捏造史料');
  });

  it('地理初中综合题：区域定位→要素分析→人地关系评价', () => {
    const q = getStandardQuestion('地理', 'middle', '综合题');
    expect(q).toBeTruthy();
    expect(q.question).toContain('区域定位');
    expect(q.question).toContain('人地关系评价');
    expect(q.rule).toContain('禁止凭空捏造地图数据');
  });

  it('科学小学实验探究：观察→记录→分析→结论过程', () => {
    const q = getStandardQuestion('科学', 'primary', '实验探究');
    expect(q).toBeTruthy();
    expect(q.question).toContain('猜想');
    expect(q.rule).toContain('观察→记录→分析→结论');
  });

  it('信息科技操作题：流程图+书面步骤，情境化设问', () => {
    const q = getStandardQuestion('信息科技', 'all', '操作题');
    expect(q).toBeTruthy();
    expect(q.question).toContain('流程图');
    expect(q.rule).toContain('数字化');
  });

  it('音乐简答题：要素分析→情感体验→文化理解递进', () => {
    const q = getStandardQuestion('音乐', 'all', '简答题');
    expect(q).toBeTruthy();
    expect(q.question).toContain('音乐要素分析');
    expect(q.rule).toContain('递进');
  });

  it('美术赏析题：内容→形式→情感', () => {
    const q = getStandardQuestion('美术', 'all', '赏析题');
    expect(q).toBeTruthy();
    expect(q.question).toContain('内容分析');
    expect(q.question).toContain('形式分析');
  });

  it('体育简答题：动作要领+安全防护', () => {
    const q = getStandardQuestion('体育', 'all', '简答题');
    expect(q).toBeTruthy();
    expect(q.question).toContain('动作要领');
    expect(q.question).toContain('安全防护');
  });

  it('数学高中单选题：8题×5分40分结构（新高考）', () => {
    const q = getStandardQuestion('数学', 'high', '单选题');
    expect(q).toBeTruthy();
    expect(q.score).toContain('40分');
  });

  it('语文小学识字与写字：语境化考查（防孤立拼音罗列）', () => {
    const q = getStandardQuestion('语文', 'primary', '识字与写字');
    expect(q).toBeTruthy();
    expect(q.rule).toContain('禁止孤立罗列拼音写词');
  });

  it('英语小学听音选词/选图板块命中骨架', () => {
    const q = getStandardQuestion('英语', 'primary', '听音选词/选图');
    expect(q).toBeTruthy();
    expect(q.rule).toContain('原文必须完整');
  });
});
