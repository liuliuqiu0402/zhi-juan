import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { builtinInstructions, getMatchingBlockInstructions } from '@/config/instructionLib';
import { EXAM_STAGE_STANDARDS, EXAM_NEW_STANDARD, EXAM_PAPER_LAYOUT, getExamBlueprint } from '@/config/examPaperBlueprints';

// 蓝本覆盖的学科与学段组合（与 getExamBlueprint 的 SUBJECT_ALIAS/STAGE_FALLBACK/all 通配对应）
const SUBJECTS = ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '道德与法治', '思想政治', '科学', '信息技术', '信息科技', '音乐', '美术', '体育'];
const STAGES = ['primary_low', 'primary_mid', 'primary_high', 'middle', 'high'];
// 学段限制：科学仅在小学开设（高中分科为物理/化学/生物），不存在"科学|high"组合
const STAGE_RESTRICTED = { '科学': ['primary_low', 'primary_mid', 'primary_high'] };

describe('指令注入审计：新课标合规与注入正确性', () => {
  describe('1. 情境化数值与蓝本学段条款一致（无冲突数值）', () => {
    it('exam 品质块不含与蓝本冲突的 65%/70% 情境化数值', () => {
      const examQuality = builtinInstructions.filter(
        i => i.category === '生成-品质标准' && i.genType && i.genType.split(',').includes('exam')
      );
      expect(examQuality.length).toBeGreaterThan(0);
      for (const block of examQuality) {
        expect(block.content, `块 ${block.id} 含冲突数值`).not.toMatch(/情境化≥65/);
        expect(block.content, `块 ${block.id} 含冲突数值`).not.toMatch(/情境化≥70/);
      }
    });

    it('低段≥40%、中高段≥60% 与蓝本 primary 条款一致', () => {
      const low = builtinInstructions.find(i => i.id === 'quality_exam_primary_low');
      const mid = builtinInstructions.find(i => i.id === 'quality_exam_primary_mid');
      const high = builtinInstructions.find(i => i.id === 'quality_exam_primary_high');
      expect(low.content).toContain('≥40%');
      expect(mid.content).toContain('≥60%');
      expect(high.content).toContain('≥60%');
      expect(EXAM_STAGE_STANDARDS.primary).toContain('低段≥40%、中高段≥60%');
    });

    it('通用情境约束块对试卷类只引用蓝本权威、不双重报数值', () => {
      const ctx = builtinInstructions.find(i => i.id === 'frag_context_design');
      expect(ctx).toBeTruthy();
      expect(ctx.content).toContain('非试卷类≥60%');
      expect(ctx.content).toContain('试卷类以【真题卷结构蓝本】学段条款为准');
    });
  });

  describe('2. 蓝本权威覆盖全学科×学段', () => {
    it('所有学科×学段组合均能获取真题蓝本（无 null 回退）', () => {
      const missing = [];
      for (const subject of SUBJECTS) {
        const stages = STAGE_RESTRICTED[subject] || STAGES;
        for (const stage of stages) {
          const bp = getExamBlueprint(subject, stage);
          if (!bp) missing.push(`${subject}|${stage}`);
        }
      }
      expect(missing).toEqual([]);
    });
  });

  describe('3. 无死块注入', () => {
    it('指令库中已无任何 gen_struct_exam_* 死块', () => {
      expect(builtinInstructions.filter(i => i.id.startsWith('gen_struct_exam')).length).toBe(0);
    });

    it('exam 结构块查询不再返回 gen_struct_exam_* 条目', () => {
      for (const subject of ['语文', '数学', '英语', '物理', '科学']) {
        for (const stage of STAGES) {
          const blocks = getMatchingBlockInstructions({
            category: '生成-资料类型结构', subject, stage, genType: 'exam', specialSubType: 'new_standard'
          });
          expect(blocks.filter(b => b.id.startsWith('gen_struct_exam'))).toEqual([]);
        }
      }
    });
  });

  describe('4. 无跨学科泄漏', () => {
    it('各学科专属品质块不含他学科关键词', () => {
      const forbidden = {
        '语文': ['方程式', '配平', '完形填空', 'grammar'],
        '数学': ['文言文', '古诗', '拼音', '配平'],
        '英语': ['文言文', '方程式', '拼音', '配平'],
        '物理': ['文言文', '古诗', '拼音'],
        '化学': ['文言文', '古诗', '拼音'],
      };
      for (const [subject, words] of Object.entries(forbidden)) {
        const blocks = getMatchingBlockInstructions({ category: '生成-品质标准', subject, genType: 'exam' });
        expect(blocks.length).toBeGreaterThan(0);
        for (const block of blocks) {
          // 通用块（subject=''）不做学科关键词检查，仅检查学科专属块
          if (!block.subject) continue;
          for (const w of words) {
            expect(block.content, `${subject} 专属块 ${block.id} 泄漏关键词「${w}」`).not.toContain(w);
          }
        }
      }
    });
  });

  describe('5. exam 品质块与蓝本无重复关键句', () => {
    it('已删除的重复条款不再出现于 exam 相关块，由蓝本统一承载', () => {
      const examBlocks = builtinInstructions.filter(
        i => i.genType && i.genType.split(',').includes('exam')
      );
      expect(examBlocks.length).toBeGreaterThan(0);
      for (const block of examBlocks) {
        expect(block.content, `块 ${block.id} 重复「设问动词多样化」`).not.toContain('设问动词多样化');
        expect(block.content, `块 ${block.id} 重复「干扰项基于学生典型错误」`).not.toContain('干扰项基于学生典型错误');
      }
      // 蓝本保留权威表述
      expect(EXAM_NEW_STANDARD).toContain('设问动词多样化');
    });

    it('红线清单已精简为「原创底线 + 蓝本权威」两条', () => {
      const redlines = builtinInstructions.find(i => i.id === 'quality_redlines_exam');
      expect(redlines).toBeTruthy();
      expect(redlines.content).not.toContain('禁止书本挖空');
      expect(redlines.content).toContain('独立原创设计');
      expect(redlines.content).toContain('严格遵循【真题卷结构蓝本】');
    });
  });

  describe('6. 骨架全覆盖：16学科 × 有效学段 × 9资料类型均有结构来源', () => {
    const NON_EXAM_TYPES = ['practice', 'special', 'summary', 'errorbook', 'preview', 'dictation', 'reading', 'review'];
    it('exam 走真题蓝本、其余 8 类型走 new_standard 结构查询，全部非空（允许 generic 兜底）', () => {
      const missing = [];
      for (const subject of SUBJECTS) {
        const stages = STAGE_RESTRICTED[subject] || STAGES;
        for (const stage of stages) {
          if (!getExamBlueprint(subject, stage)) missing.push(`exam|${subject}|${stage}`);
          for (const genType of NON_EXAM_TYPES) {
            const blocks = getMatchingBlockInstructions({
              category: '生成-资料类型结构', subject, stage, genType, specialSubType: 'new_standard'
            });
            if (blocks.length === 0) missing.push(`${genType}|${subject}|${stage}`);
          }
        }
      }
      expect(missing, `以下组合无骨架来源:\n${missing.join('\n')}`).toEqual([]);
    });
  });

  describe('7. 品质标准注入上限：每学科 × 学段 × exam ≤ 5 条', () => {
    it('精简后品质标准查询结果不超过 5 条且非空、必含教辅品质基线块', () => {
      const over = [];
      for (const subject of SUBJECTS) {
        const stages = STAGE_RESTRICTED[subject] || STAGES;
        for (const stage of stages) {
          const blocks = getMatchingBlockInstructions({ category: '生成-品质标准', subject, stage, genType: 'exam' });
          expect(blocks.length, `${subject}|${stage} 品质标准为空`).toBeGreaterThan(0);
          expect(blocks.some(b => b.id === 'quality_industry_benchmark'), `${subject}|${stage} 缺教辅品质基线块`).toBe(true);
          if (blocks.length > 5) over.push(`${subject}|${stage}=${blocks.length}[${blocks.map(b => b.id).join(',')}]`);
        }
      }
      expect(over, `以下组合品质标准超过 5 条:\n${over.join('\n')}`).toEqual([]);
    });
  });

  describe('8. 无同分遮蔽：结构查询 top1 评分严格大于 top2', () => {
    // 与 instructionLib.js getMatchingBlockInstructions 的排序评分公式保持一致：
    // 专项子类型(5) > 学科(2) > 学段(1) > 资料类型(1) > 通用(0)
    const scoreBlock = (item, { subject, stage, genType, specialSubType }) => {
      let s = 0;
      if (item.subject && item.subject.trim() && subject) s += 2;
      if (item.stage && item.stage.trim() && stage) s += 1;
      if (item.genType && item.genType.trim() && genType) s += 1;
      if (item.specialSubType && specialSubType && item.specialSubType === specialSubType) s += 5;
      return s;
    };

    it('所有类型×学科×学段结构查询 top1 评分 > top2（同分即存在遮蔽风险）', () => {
      const ties = [];
      const TYPES = ['exam', 'practice', 'special', 'summary', 'errorbook', 'preview', 'dictation', 'reading', 'review'];
      for (const subject of SUBJECTS) {
        const stages = STAGE_RESTRICTED[subject] || STAGES;
        for (const stage of stages) {
          for (const genType of TYPES) {
            const opts = { subject, stage, genType, specialSubType: 'new_standard' };
            const blocks = getMatchingBlockInstructions({ category: '生成-资料类型结构', ...opts });
            // exam 由真题蓝本锁定（无 new_standard 结构条目）；不足 2 条无可比对象
            if (blocks.length < 2) continue;
            const s1 = scoreBlock(blocks[0], opts);
            const s2 = scoreBlock(blocks[1], opts);
            if (s1 <= s2) ties.push(`${subject}|${stage}|${genType}: ${blocks[0].id}(${s1}) vs ${blocks[1].id}(${s2})`);
          }
        }
      }
      expect(ties, `以下组合存在同分遮蔽:\n${ties.join('\n')}`).toEqual([]);
    });
  });

  describe('11. 思维深度链路：内容层新课标要求（需求2核心）', () => {
    it('exam：蓝本含禁回忆式设问 + 素养立意设问 + 开放题留思维空间', () => {
      expect(EXAM_NEW_STANDARD).toContain('记忆型考点必须转化为情境运用型设问');
      expect(EXAM_NEW_STANDARD).toContain('设问动词多样化');
      expect(EXAM_NEW_STANDARD).toContain('开放题留思维空间');
    });

    it('认知层级块按学段递进思维深度（识记递减、分析/评价/创造递增，已并入 diff_* 难度控制块）', () => {
      const low = builtinInstructions.find(i => i.id === 'diff_primary_low');
      const mid = builtinInstructions.find(i => i.id === 'diff_primary_mid');
      const high = builtinInstructions.find(i => i.id === 'diff_primary_high');
      const highSch = builtinInstructions.find(i => i.id === 'diff_high');
      expect(low.content).toContain('识记层≤30%');
      expect(mid.content).toContain('简单分析层≥15%');
      expect(high.content).toContain('简单评价层≥15%');
      expect(highSch.content).toContain('创造层≥10%');
    });

    it('非 exam 类型品质块均含思维深度要求', () => {
      const expectations = {
        quality_practice: '认知递进',
        quality_reading: '评价反思',
        quality_special: '难度阶梯递进',
        quality_review: '变式训练',
        quality_errorbook: '错误归因',
        quality_preview: '问题驱动',
      };
      for (const [id, keyword] of Object.entries(expectations)) {
        const block = builtinInstructions.find(i => i.id === id);
        expect(block, `缺少品质块 ${id}`).toBeTruthy();
        expect(block.content, `${id} 缺思维深度关键词「${keyword}」`).toContain(keyword);
      }
    });
  });
});

// 双防线源码提取（GenerateModule 第一道 + useAiGenerator 第二道）
const extractDefenseSet = (src, varName) => {
  const marker = `const ${varName} = new Set([`;
  const start = src.indexOf(marker);
  expect(start, `源码中未找到 ${varName} 声明`).toBeGreaterThan(-1);
  const setStart = start + marker.length;
  const end = src.indexOf(']);', setStart);
  expect(end, `${varName} 集合未正确闭合`).toBeGreaterThan(-1);
  return new Set([...src.slice(setStart, end).matchAll(/'([^']+)'/g)].map(m => m[1]));
};
const generateModuleSrc = readFileSync(resolve(process.cwd(), 'src/modules/GenerateModule.vue'), 'utf8');
const useAiGeneratorSrc = readFileSync(resolve(process.cwd(), 'src/composables/useAiGenerator.js'), 'utf8');

describe('指令注入审计：双防线一致性与死指令', () => {
  describe('9. 双防线一致性：GenerateModule 集合 ⊆ useAiGenerator 集合', () => {
    it('第一道防线的每个类别都存在于第二道防线', () => {
      const gmSet = extractDefenseSet(generateModuleSrc, 'HANDLED_BY_DEDICATED_SECTION');
      const uiSet = extractDefenseSet(useAiGeneratorSrc, '_ui_handledCategories');
      expect(gmSet.size).toBeGreaterThan(10); // 防止提取失败产生空集假通过
      expect(uiSet.size).toBeGreaterThan(10);
      const missing = [...gmSet].filter(c => !uiSet.has(c));
      expect(missing, `GenerateModule 防线独有类别（需补入 useAiGenerator）:\n${missing.join('\n')}`).toEqual([]);
    });
  });

  describe('10. 无死指令：builtin fragment 的 category 均在注入端查询或双防线中', () => {
    it('每个内置 fragment 的 category 都被注入端查询或防线覆盖', () => {
      const queried = new Set();
      for (const src of [useAiGeneratorSrc, generateModuleSrc]) {
        for (const m of src.matchAll(/category:\s*'([^']+)'/g)) queried.add(m[1]);
      }
      const gmSet = extractDefenseSet(generateModuleSrc, 'HANDLED_BY_DEDICATED_SECTION');
      const uiSet = extractDefenseSet(useAiGeneratorSrc, '_ui_handledCategories');
      const covered = new Set([...queried, ...gmSet, ...uiSet]);
      const fragCategories = new Set(
        builtinInstructions.filter(i => i.type === 'fragment').map(i => i.category)
      );
      const dead = [...fragCategories].filter(c => !covered.has(c));
      expect(dead, `以下 category 从不注入（死指令）:\n${dead.join('\n')}`).toEqual([]);
    });
  });
});

// ============ EduRender 格式统一审计（图形/图表/配图单一结构化格式，兼容 EduRender Studio） ============
describe('指令注入审计：EduRender 格式统一（消除双轨格式冲突）', () => {
  it('指令库已废除三套旧格式（[CHART]/文字描述[GRAPH]/[IMAGE]类型占位）', () => {
    const contents = builtinInstructions.map(i => i.content || '').join('\n');
    expect(contents).not.toContain('[CHART]');
    expect(contents).not.toContain('类型：照片/插画/示意图');
    expect(contents).not.toContain('类型：平面几何/立体几何/函数图像/示意图');
    expect(contents).not.toContain('LABEL_FONT_SIZE');
    expect(contents).not.toContain('MARKERS:');
  });

  it('配图块用 TYPE:SD/TYPE:ICON 结构化格式（EduRender 兼容）', () => {
    const blocks = getMatchingBlockInstructions({ category: '生成-专项要求', subject: '语文', stage: 'primary_low', genType: 'exam' });
    const img = blocks.find(b => b.id === 'block_special_image_primary_low');
    expect(img, '缺少配图块').toBeTruthy();
    expect(img.content).toContain('TYPE:SD');
    expect(img.content).toContain('TYPE:ICON');
    // 专项块不内联完整格式（格式唯一来源为 EduRender 模板块，避免双注入重复）
    expect(img.content).not.toContain('[/IMAGE]');
    expect(img.content).toContain('【EduRender模板】');
  });

  it('数轴模板参数与 EduRender 规范一致（FONT_SIZE/TICK_STEP/ARROW_STYLE/ARROW_SCALE/PADDING）', () => {
    const blocks = getMatchingBlockInstructions({ category: '生成-EduRender模板', subject: '数学', stage: '', genType: '' });
    const axis = blocks.find(b => b.id === 'block_edurender_axis');
    expect(axis, '缺少数轴模板').toBeTruthy();
    expect(axis.content).toContain('FONT_SIZE:10');
    expect(axis.content).toContain('TICK_STEP:1');
    expect(axis.content).toContain('ARROW_STYLE:>');
    expect(axis.content).toContain('ARROW_SCALE:1.0');
    expect(axis.content).toContain('PADDING:0.15');
  });

  it('图表块统一为 [GRAPH] TYPE:BAR_CHART/LINE_CHART/PIE_CHART', () => {
    const blocks = getMatchingBlockInstructions({ category: '生成-专项要求', subject: '数学', stage: 'primary_high', genType: 'exam' });
    const chart = blocks.find(b => b.id === 'block_special_chart_primary_high');
    expect(chart, '缺少图表块').toBeTruthy();
    // 专项块指向模板、不内联完整格式（格式唯一来源为 EduRender 模板块，避免双注入重复）
    expect(chart.content).toContain('【EduRender模板】');
    expect(chart.content).not.toContain('[/GRAPH]');
    // 完整格式定义由模板块唯一提供
    const eduChart = getMatchingBlockInstructions({ category: '生成-EduRender模板', subject: '数学', stage: '', genType: '' })
      .find(b => b.id === 'block_edurender_chart');
    expect(eduChart, '缺少图表模板').toBeTruthy();
    expect(eduChart.content).toContain('TYPE:BAR_CHART');
    expect(eduChart.content).toContain('LINE_CHART');
    expect(eduChart.content).toContain('PIE_CHART');
    expect(eduChart.content).toContain('XLABEL');
  });

  it('EduRender 模板块覆盖规范全部 12 种图形 + 公式 + 配图', () => {
    const findBlocks = (subject) => getMatchingBlockInstructions({ category: '生成-EduRender模板', subject, stage: '', genType: '' });
    const ids = [...findBlocks('数学'), ...findBlocks('物理'), ...findBlocks('化学'), ...findBlocks('')].map(b => b.id);
    for (const id of [
      'block_edurender_formula', 'block_edurender_axis', 'block_edurender_shapes',
      'block_edurender_chart', 'block_edurender_force', 'block_edurender_circuit',
      'block_edurender_optics', 'block_edurender_atom', 'block_edurender_image',
    ]) {
      expect(ids, `缺少 ${id}`).toContain(id);
    }
  });
});

// ============ 内容级去冗余审计（同匹配键/跨 category 内容重复与冲突检测） ============
describe('指令注入审计：内容级去冗余（不同 id 同内容 = 真并存）', () => {
  const frags = builtinInstructions.filter(i => i.type === 'fragment');
  const ngrams = (s, n = 3) => { const set = new Set(); const t = s.replace(/\s+/g, ''); for (let i = 0; i + n <= t.length; i++) set.add(t.slice(i, i + n)); return set; };
  const jac = (a, b) => { let inter = 0; for (const g of a) if (b.has(g)) inter++; return inter / (a.size + b.size - inter); };

  it('同匹配键组内（subject/stage/genType 全同）无内容重复块对', () => {
    const key = f => f.category + '|' + (f.subject || '') + '|' + (f.stage || '') + '|' + (f.genType || '');
    const map = {};
    for (const f of frags) { const k = key(f); (map[k] = map[k] || []).push(f); }
    const dups = [];
    for (const group of Object.values(map)) {
      if (group.length < 2) continue;
      for (let i = 0; i < group.length; i++) for (let j = i + 1; j < group.length; j++) {
        const a = group[i], b = group[j];
        if (a.content.length < 20 || b.content.length < 20) continue;
        if (jac(ngrams(a.content), ngrams(b.content)) > 0.8) {
          dups.push(`${a.id} + ${b.id}（${a.category}）`);
        }
      }
    }
    expect(dups, `同匹配键组内存在内容重复（同时注入 = 并存）：\n${dups.join('\n')}`).toEqual([]);
  });

  it('品质标准-默写不再双注入（quality_dictation_type 已删除，仅 quality_dictation 唯一）', () => {
    const dictBlocks = frags.filter(i => i.category === '生成-品质标准' && i.genType === 'dictation' && !i.subject && !i.stage);
    expect(dictBlocks.map(b => b.id)).toEqual(['quality_dictation']);
  });

  it('信息技术学科特色块与学科适配块无重复表述', () => {
    const feature = builtinInstructions.find(i => i.id === 'subject_it_high');
    expect(feature, '缺少 subject_it_high').toBeTruthy();
    expect(feature.content).not.toContain('Python编程');
    expect(feature.content).not.toContain('对标学业水平考试要求');
    expect(feature.content).toContain('实际应用场景');
  });
});

// ============ 需求3/4审计：无并存双轨、无冗余残留（v27 治理：学段适配并入控制、难度数字同源、防线无死名） ============
describe('指令注入审计：无并存双轨与冗余残留（需求 3/4）', () => {
  it('「生成-学段适配」双轨已废除——category 不再存在于指令库', () => {
    const cats = new Set(builtinInstructions.map(i => i.category));
    expect(cats.has('生成-学段适配'), '学段适配 category 应已删除（学段控制为唯一来源）').toBe(false);
  });

  it('双防线无死名残留（快捷学段提示/学科禁止项等指令库不存在的 category）', () => {
    const libCats = new Set(builtinInstructions.map(i => i.category));
    const gmSet = extractDefenseSet(generateModuleSrc, 'HANDLED_BY_DEDICATED_SECTION');
    const uiSet = extractDefenseSet(useAiGeneratorSrc, '_ui_handledCategories');
    for (const c of [...gmSet, ...uiSet]) {
      if (c.startsWith('生成-')) {
        expect(libCats.has(c), `防线残留名「${c}」不存在于指令库，应从防线删除`).toBe(true);
      }
    }
  });

  it('难度控制与难度配置数字同源（middle 均 60/30/10，与蓝本 6:3:1 对齐）', () => {
    const cfg = builtinInstructions.find(i => i.category === '生成-难度配置' && i.id === 'diff_middle_exam');
    const ctl = builtinInstructions.find(i => i.category === '生成-难度控制' && i.id === 'diff_middle');
    expect(cfg.content).toContain('basic=60,medium=30,advanced=10');
    expect(ctl.content).toContain('基础题60%、中等题30%、提高题10%');
  });

  it('学段控制已吸收学段适配独特点（压轴题/初中衔接）', () => {
    const high = builtinInstructions.find(i => i.id === 'stage_high');
    const pHigh = builtinInstructions.find(i => i.id === 'stage_primary_high');
    expect(high.content).toContain('可设压轴题');
    expect(pHigh.content).toContain('为初中衔接做准备');
  });
});

// ============ 精简固化（7→3 合并后三层底线）：规则唯一性 / 注入总量 / 红线非空 / 新课标底线 / 骨架矩阵 ============
describe('指令注入审计：精简固化（规则唯一性/注入总量/红线非空/新课标底线/骨架矩阵）', () => {
  // —— 1. 跨类别规则唯一性：每主题全库仅一处权威表述 ——
  describe('1. 跨类别规则唯一性（合并去重成果固化）', () => {
    const RULE_KEYWORDS = [
      ['答案唯一确定', /答案唯一确定/],
      ['知识点不重复', /知识点不重复/],
      ['选择题≤3选项', /选择题≤3选项/],
      ['作文字数与文体', /字数.{0,6}文体/],
      ['阅读答案不摘抄原文', /摘抄原文/],
      ['不超纲', /不超纲/],
    ];
    it('六大规则主题全库各仅 1 处权威表述', () => {
      const frags = builtinInstructions.filter(i => i.type === 'fragment');
      for (const [name, re] of RULE_KEYWORDS) {
        const hits = frags.filter(i => re.test(i.content || ''));
        expect(hits.length, `规则「${name}」应仅 1 处，实际 ${hits.length} 处: ${hits.map(b => b.id).join(', ')}`).toBeLessThanOrEqual(1);
      }
    });

    // 阶段六抽查复核：不同措辞的同主题复述已删除（权威唯一，复述归零）
    const DEDUPED_PHRASES = [
      ['顶层约束复述「知识点考查去重」', /知识点考查去重/],
      ['核心任务/学段控制复述「选项不超过3个/≤3个」', /选项不超过3个|选项≤3个/],
      ['核心任务/学段控制复述「选项不超过4个/≤4个」', /选项不超过4个|选项≤4个/],
      ['学科特色复述「在原文中直接摘抄」', /在原文中直接摘抄/],
    ];
    it('抽查复核：四处同主题复述已在指令库归零（权威仍在题目质量标准/品质标准）', () => {
      const frags = builtinInstructions.filter(i => i.type === 'fragment');
      for (const [name, re] of DEDUPED_PHRASES) {
        const hits = frags.filter(i => re.test(i.content || ''));
        expect(hits.length, `复述「${name}」应已删除，实际 ${hits.length} 处: ${hits.map(b => b.id).join(', ')}`).toBe(0);
      }
      // 权威表述仍存在
      expect(builtinInstructions.find(i => i.id === 'block_quality_primary_low').content).toContain('选择题≤3选项');
      expect(builtinInstructions.find(i => i.id === 'quality_exam_formal').content).toContain('知识点去重');
      expect(builtinInstructions.find(i => i.id === 'block_quality_chinese').content).toContain('摘抄原文');
    });

    // 本轮新增：教辅品质基线句（原核心任务 64 处重复）收敛到品质标准唯一承载
    it('教辅品质基线句：核心任务归零、品质标准唯一承载', () => {
      const coreTasks = builtinInstructions.filter(i => i.type === 'fragment' && i.category === '生成-核心任务');
      const leak = coreTasks.filter(i => /质量对标市面一流教辅水准|粗制滥造的凑数内容/.test(i.content || ''));
      expect(leak.map(b => b.id), '核心任务块不应再含教辅品质基线句').toEqual([]);
      const carrier = builtinInstructions.find(i => i.id === 'quality_industry_benchmark');
      expect(carrier, '缺少品质标准承载块').toBeTruthy();
      expect(carrier.content).toContain('质量对标市面一流教辅水准');
      expect(carrier.content).toContain('不可生成粗制滥造的凑数内容');
    });
  });

  // —— 2. 注入链路模拟：复刻 buildGenerationInstruction 关键质量层查询序列 ——
  const simulateQualityLayers = ({ subject, stage, gradeSegment, gt }) => {
    const m = (o) => getMatchingBlockInstructions(o);
    const out = [];
    const add = (b) => out.push(b);
    // 红线（最高优先级前置，全量）
    m({ category: '生成-红线约束', matchSubject: subject, stage: gradeSegment, genType: gt }).forEach(add);
    // 品质标准（全量）
    m({ category: '生成-品质标准', matchSubject: subject, stage: gradeSegment, genType: gt }).forEach(add);
    // 题目质量标准（base + 学段全量 + 学科 top1）
    const base = m({ category: '生成-题目质量标准', subject: '', stage: '', genType: gt });
    if (base.length) add(base[0]);
    for (const b of m({ category: '生成-题目质量标准', subject: '', stage: gradeSegment, genType: gt })) {
      if (!b.stage || b.stage === '' || b.subject) continue;
      if (!base.length || b.content !== base[0].content) add(b);
    }
    if (subject) {
      const subjOnly = m({ category: '生成-题目质量标准', matchSubject: subject, stage: '', genType: gt }).filter(b => b.subject && b.subject !== '');
      if (subjOnly.length) add(subjOnly[0]);
    }
    // 情境要求（通用层全量 + 学科层过滤，gen_ctx 仅统一情境模式注入）
    m({ category: '生成-情境要求', subject: '', stage, genType: gt }).forEach(add);
    if (subject) {
      m({ category: '生成-情境要求', matchSubject: subject, stage: gradeSegment, genType: gt })
        .filter(b => b.subject && b.subject.trim() !== '' && !(b.id && b.id.startsWith('gen_ctx_')))
        .forEach(add);
    }
    // 难度控制（top1，认知层级已并入 diff_* 块）
    const diff = m({ category: '生成-难度控制', subject: '', stage: gradeSegment, genType: gt });
    if (diff.length) add(diff[0]);
    // 特殊要求（全量）
    m({ category: '生成-特殊要求', subject: '', stage: '', genType: gt }).forEach(add);
    return out;
  };

  const TYPICAL_COMBOS = [
    { name: '语文低段exam', subject: '语文', stage: 'primary', gradeSegment: 'primary_low', gt: 'exam' },
    { name: '语文中段exam', subject: '语文', stage: 'primary', gradeSegment: 'primary_mid', gt: 'exam' },
    { name: '语文初中exam', subject: '语文', stage: 'middle', gradeSegment: 'middle', gt: 'exam' },
    { name: '英语高段exam', subject: '英语', stage: 'primary', gradeSegment: 'primary_high', gt: 'exam' },
    { name: '物理初中exam', subject: '物理', stage: 'middle', gradeSegment: 'middle', gt: 'exam' },
    { name: '数学中段practice', subject: '数学', stage: 'primary', gradeSegment: 'primary_mid', gt: 'practice' },
    { name: '数学初中practice', subject: '数学', stage: 'middle', gradeSegment: 'middle', gt: 'practice' },
    { name: '数学初中special', subject: '数学', stage: 'middle', gradeSegment: 'middle', gt: 'special' },
    { name: '英语初中errorbook', subject: '英语', stage: 'middle', gradeSegment: 'middle', gt: 'errorbook' },
    { name: '语文高段reading', subject: '语文', stage: 'primary', gradeSegment: 'primary_high', gt: 'reading' },
    { name: '语文低段dictation', subject: '语文', stage: 'primary', gradeSegment: 'primary_low', gt: 'dictation' },
    { name: '数学高中review', subject: '数学', stage: 'high', gradeSegment: 'high', gt: 'review' },
  ];

  describe('2. 注入总量上限 / 红线非空 / 新课标底线（12 组典型组合）', () => {
    it('关键质量层注入总量 ≤ 上限（exam≤3800、非 exam≤2600 字符）', () => {
      for (const c of TYPICAL_COMBOS) {
        const blocks = simulateQualityLayers(c);
        const total = blocks.reduce((s, b) => s + (b.content || '').length, 0);
        const cap = c.gt === 'exam' ? 3800 : 2600;
        expect(total, `${c.name} 注入 ${total} 字符，超过上限 ${cap}`).toBeLessThanOrEqual(cap);
      }
    });

    it('每组合红线块注入非空且含知识点颗粒度判据', () => {
      for (const c of TYPICAL_COMBOS) {
        const blocks = simulateQualityLayers(c);
        const redlines = blocks.filter(b => b.category === '生成-红线约束');
        expect(redlines.length, `${c.name} 红线块为空`).toBeGreaterThan(0);
        const redlineText = redlines.map(b => b.content).join('\n');
        expect(redlineText, `${c.name} 红线缺知识点颗粒度判据`).toContain('知识点颗粒度以课标条目为最小单位');
      }
    });

    it('每组合含情境化条款', () => {
      for (const c of TYPICAL_COMBOS) {
        const joined = simulateQualityLayers(c).map(b => b.content).join('\n');
        expect(joined, `${c.name} 缺情境化条款`).toContain('情境');
      }
    });

    it('命题型组合（exam/practice/special/errorbook/reading）含认知层级/思维深度关键词', () => {
      const THINKING_TYPES = ['exam', 'practice', 'special', 'errorbook', 'reading'];
      for (const c of TYPICAL_COMBOS) {
        if (!THINKING_TYPES.includes(c.gt)) continue;
        const joined = simulateQualityLayers(c).map(b => b.content).join('\n');
        expect(joined, `${c.name} 缺认知层级/思维深度要求`).toMatch(/认知层级|素养立意|思维深度|分析层|评价层/);
      }
    });

    it('exam 组合含正式考卷标准五要素（效度信度/知识点去重/时间配比/小题规范/不标题套壳）', () => {
      for (const c of TYPICAL_COMBOS) {
        if (c.gt !== 'exam') continue;
        const joined = simulateQualityLayers(c).map(b => b.content).join('\n');
        expect(joined).toContain('效度信度');
        expect(joined).toContain('知识点去重');
        expect(joined).toContain('时间配比');
        expect(joined).toContain('小题规范');
        expect(joined).toContain('不标题套壳');
      }
    });
  });

  // —— 3. 骨架矩阵固化：全学科×学段×资料类型穷举 ——
  describe('3. 骨架矩阵固化：全学科×学段×资料类型穷举', () => {
    const GENTYPES = ['exam', 'practice', 'special', 'summary', 'errorbook', 'preview', 'dictation', 'reading', 'review'];
    const blockScore = (item, q) => {
      let s = 0;
      if (item.subject && item.subject.trim() && q.subject) s += 2;
      if (item.stage && item.stage.trim() && q.stage) s += 1;
      if (item.genType && item.genType.trim() && q.genType) s += 1;
      if (item.specialSubType && q.specialSubType && item.specialSubType === q.specialSubType) s += 5;
      return s;
    };

    it('exam：16 学科 × 5 学段（科学限小学）全部命中真题蓝本', () => {
      const missing = [];
      for (const subject of SUBJECTS) {
        const stages = STAGE_RESTRICTED[subject] || STAGES;
        for (const stage of stages) {
          if (!getExamBlueprint(subject, stage)) missing.push(`${subject}|${stage}`);
        }
      }
      expect(missing).toEqual([]);
    });

    it('非 exam：资料类型结构 top1 存在且评分 > top2（无同分遮蔽）', () => {
      const misses = [];
      const ties = [];
      for (const subject of SUBJECTS) {
        const stages = STAGE_RESTRICTED[subject] || STAGES;
        for (const stage of stages) {
          for (const gt of GENTYPES) {
            if (gt === 'exam') continue;
            const q = { category: '生成-资料类型结构', subject, stage, genType: gt, specialSubType: 'new_standard' };
            const m = getMatchingBlockInstructions(q);
            if (m.length === 0) { misses.push(`${subject}|${stage}|${gt}`); continue; }
            if (m.length > 1 && blockScore(m[1], q) === blockScore(m[0], q)) {
              ties.push(`${subject}|${stage}|${gt}: ${m[0].id} vs ${m[1].id}`);
            }
          }
        }
      }
      expect(misses, `骨架缺失组合:\n${misses.join('\n')}`).toEqual([]);
      expect(ties, `同分遮蔽组合:\n${ties.join('\n')}`).toEqual([]);
    });

    it('资料类型结构无跨 genType 完全同内容复制条目（无需多值合并）', () => {
      const struct = builtinInstructions.filter(i => i.category === '生成-资料类型结构' && i.type === 'fragment');
      const byKey = new Map();
      for (const b of struct) {
        const key = `${b.subject}|${b.stage}|${b.specialSubType}|${b.content}`;
        if (!byKey.has(key)) byKey.set(key, []);
        byKey.get(key).push(b.id);
      }
      const dups = [...byKey.entries()].filter(([, ids]) => ids.length > 1);
      expect(dups, `同内容多类型复制条目:\n${dups.map(([k, ids]) => `${k.slice(0, 50)} => ${ids.join('+')}`).join('\n')}`).toEqual([]);
    });
  });
});

// ============ 课标骨架对齐 + 教辅编辑标准（R1/R2/R6 生成端落地）与注入精准性（R4） ============
describe('指令注入审计：课标骨架对齐/教辅编辑标准/注入精准性（需求 1/2/4/6）', () => {
  const ALL_TYPES = ['exam', 'practice', 'special', 'summary', 'errorbook', 'preview', 'dictation', 'reading', 'review'];

  describe('1. 课标骨架对齐（R1/R2）：按「学段 × 资料类型」精准注入 + exam 专属叠加', () => {
    const STAGE_IDS = {
      primary_low: 'skeleton_align_primary_low',
      primary_mid: 'skeleton_align_primary_mid',
      primary_high: 'skeleton_align_primary_high',
      middle: 'skeleton_align_middle',
      high: 'skeleton_align_high',
    };
    it('9 种资料类型 × 5 学段均命中对应学段骨架块（三维度精准）', () => {
      for (const gt of ALL_TYPES) {
        for (const [stage, id] of Object.entries(STAGE_IDS)) {
          const blocks = getMatchingBlockInstructions({ category: '生成-课标骨架', subject: '', stage, genType: gt });
          expect(blocks.some(b => b.id === id), `${gt}|${stage} 未命中 ${id}`).toBe(true);
        }
      }
    });

    it('学段精准：低段查询不注入中/高段块（不交叉）', () => {
      const low = getMatchingBlockInstructions({ category: '生成-课标骨架', subject: '', stage: 'primary_low', genType: 'practice' });
      const ids = low.map(b => b.id);
      expect(ids).toContain('skeleton_align_primary_low');
      expect(ids).not.toContain('skeleton_align_primary_mid');
      expect(ids).not.toContain('skeleton_align_primary_high');
      expect(ids).not.toContain('skeleton_align_middle');
      expect(ids).not.toContain('skeleton_align_high');
    });

    it('仅 exam 额外注入试卷专属块（skeleton_align_exam），其余类型不交叉', () => {
      for (const gt of ALL_TYPES) {
        const blocks = getMatchingBlockInstructions({ category: '生成-课标骨架', subject: '', stage: 'middle', genType: gt });
        const hasExam = blocks.some(b => b.id === 'skeleton_align_exam');
        if (gt === 'exam') {
          expect(hasExam, 'exam 应含 skeleton_align_exam').toBe(true);
        } else {
          expect(hasExam, `${gt} 不应注入试卷专属骨架块（交叉泄漏）`).toBe(false);
        }
      }
    });

    it('骨架块内容含「板块内容不交叉」硬约束 + 学段课标锚点差异化（R2 核心）', () => {
      const low = builtinInstructions.find(i => i.id === 'skeleton_align_primary_low');
      const mid = builtinInstructions.find(i => i.id === 'skeleton_align_primary_mid');
      const high = builtinInstructions.find(i => i.id === 'skeleton_align_high');
      for (const b of [low, mid, high]) {
        expect(b.content).toContain('禁止板块间内容交叉');
        expect(b.content).toContain('考查维度');
      }
      // 学段锚点差异化：低段=基础性趣味性、高中=学业质量水平分级
      expect(low.content).toContain('基础性、趣味性与生活化');
      expect(high.content).toContain('学业质量分四级');
      const exam = builtinInstructions.find(i => i.id === 'skeleton_align_exam');
      expect(exam.content).toContain('真题卷结构蓝本');
      expect(exam.content).toContain('考查维度与所属大题目标一致');
    });
  });

  describe('2. 教辅编辑标准（R6）：全类型注入且内容覆盖五维编辑质量', () => {
    it('9 种资料类型均命中教辅编辑标准块（edit_std_common）', () => {
      for (const gt of ALL_TYPES) {
        const blocks = getMatchingBlockInstructions({ category: '生成-编辑标准', subject: '', stage: '', genType: gt });
        expect(blocks.some(b => b.id === 'edit_std_common'), `${gt} 未命中 edit_std_common`).toBe(true);
      }
    });

    it('编辑标准内容覆盖文字/数据/表述/结构四维（对标市面教辅出版水准）', () => {
      const block = builtinInstructions.find(i => i.id === 'edit_std_common');
      expect(block.content).toContain('错别字');
      expect(block.content).toContain('数据与答案完全自洽');
      expect(block.content).toContain('题干指向唯一');
      expect(block.content).toContain('市面正式教辅出版水准');
    });
  });

  describe('3. 注入精准性（R4）：三维度匹配不交叉', () => {
    it('顶层约束按 genType 精准匹配：topconst_exam 仅 exam、topconst_review 仅 review', () => {
      for (const gt of ALL_TYPES) {
        const blocks = getMatchingBlockInstructions({ category: '生成-顶层约束', subject: '', stage: '', genType: gt });
        const ids = blocks.map(b => b.id);
        if (gt === 'exam') {
          expect(ids).toContain('topconst_exam');
          expect(ids).not.toContain('topconst_review');
          expect(ids).not.toContain('topconst_practice');
        } else if (gt === 'review') {
          expect(ids).toContain('topconst_review');
          expect(ids).not.toContain('topconst_exam');
        } else if (gt === 'practice') {
          expect(ids).toContain('topconst_practice');
          expect(ids).not.toContain('topconst_exam');
        } else if (gt === 'special') {
          expect(ids).toContain('topconst_special');
          expect(ids).not.toContain('topconst_exam');
        }
      }
    });

    it('试卷专属情境深度块不注入其他类型（frag_context_design_special 仅 special）', () => {
      for (const gt of ALL_TYPES) {
        const blocks = getMatchingBlockInstructions({ category: '生成-情境要求', subject: '', stage: 'middle', genType: gt });
        const hasSpecialDepth = blocks.some(b => b.id === 'frag_context_design_special');
        if (gt === 'special') {
          expect(hasSpecialDepth).toBe(true);
        } else {
          expect(hasSpecialDepth, `${gt} 泄漏专项情境块`).toBe(false);
        }
      }
    });

    it('双防线含新类别（课标骨架/编辑标准），且防线无死名', () => {
      const gmSet = extractDefenseSet(generateModuleSrc, 'HANDLED_BY_DEDICATED_SECTION');
      const uiSet = extractDefenseSet(useAiGeneratorSrc, '_ui_handledCategories');
      expect(gmSet.has('生成-课标骨架')).toBe(true);
      expect(gmSet.has('生成-编辑标准')).toBe(true);
      expect(uiSet.has('生成-课标骨架')).toBe(true);
      expect(uiSet.has('生成-编辑标准')).toBe(true);
    });
  });

  describe('4. 试卷情境措辞强化（R5）：topconst_exam 含真实/有意义情境要求', () => {
    it('topconst_exam 第6条要求真实、富有意义的情境，禁止"戴帽子"假情境', () => {
      const exam = builtinInstructions.find(i => i.id === 'topconst_exam');
      expect(exam.content).toContain('真实情境或明确任务中');
      expect(exam.content).toContain('戴帽子');
      expect(exam.content).toContain('情境须支撑作答');
    });
  });

  describe('5. 正式卷首标题（期末/期中/月考）：生成端按类型精准注入', () => {
    it('exam 命中正式标题块 title_format_exam，其他类型命中通用块 title_format', () => {
      const ALL = ['exam', 'practice', 'special', 'summary', 'errorbook', 'preview', 'dictation', 'reading', 'review'];
      for (const gt of ALL) {
        const blocks = getMatchingBlockInstructions({ category: '生成-标题格式', subject: '', stage: '', genType: gt });
        expect(blocks.length, `${gt} 标题格式块为空`).toBeGreaterThan(0);
        const top = blocks[0].id;
        if (gt === 'exam') {
          expect(top, 'exam 应优先注入正式标题块').toBe('title_format_exam');
        } else {
          expect(top, `${gt} 不应注入试卷标题块`).toBe('title_format');
        }
      }
    });

    it('正式标题块内容含学年学期占位符与正式结构（学年+学段年级+学科+考试类型+试卷）', () => {
      const exam = builtinInstructions.find(i => i.id === 'title_format_exam');
      expect(exam.content).toContain('{academicTitle}');
      expect(exam.content).toContain('期末');
      expect(exam.content).toContain('月考');
      expect(exam.content).toContain('禁止用"XX学业测评"');
    });

    it('蓝本卷面规范第2条为正式标题格式（含 {academicTitle} 占位，旧非正式示例已移除）', () => {
      expect(EXAM_PAPER_LAYOUT).toContain('{academicTitle}');
      expect(EXAM_PAPER_LAYOUT).toContain('期末试卷');
      expect(EXAM_PAPER_LAYOUT).toContain('期中测试卷');
      expect(EXAM_PAPER_LAYOUT).not.toContain('第一单元学业测评');
      // 蓝本文本随整卷指令注入，{academicTitle} 由 applyVars 在运行时替换为当前学年学期
      expect(EXAM_PAPER_LAYOUT).toMatch(/由系统按当前日期自动生成/);
    });
  });
});
