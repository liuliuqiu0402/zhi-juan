import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { builtinInstructions, getMatchingBlockInstructions } from '@/config/instructionLib';
import { EXAM_STAGE_STANDARDS, EXAM_NEW_STANDARD, getExamBlueprint } from '@/config/examPaperBlueprints';

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
      expect(ctx.content).toContain('非试卷类资料≥60%');
      expect(ctx.content).toContain('试卷类一律以【真题卷结构蓝本】学段条款为准');
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
      expect(redlines.content).toContain('【真题卷结构蓝本】为唯一依据');
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

  describe('7. 品质标准注入上限：每学科 × 学段 × exam ≤ 4 条', () => {
    it('精简后品质标准查询结果不超过 4 条且非空', () => {
      const over = [];
      for (const subject of SUBJECTS) {
        const stages = STAGE_RESTRICTED[subject] || STAGES;
        for (const stage of stages) {
          const blocks = getMatchingBlockInstructions({ category: '生成-品质标准', subject, stage, genType: 'exam' });
          expect(blocks.length, `${subject}|${stage} 品质标准为空`).toBeGreaterThan(0);
          if (blocks.length > 4) over.push(`${subject}|${stage}=${blocks.length}[${blocks.map(b => b.id).join(',')}]`);
        }
      }
      expect(over, `以下组合品质标准超过 4 条:\n${over.join('\n')}`).toEqual([]);
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

    it('认知层级块按学段递进思维深度（识记递减、分析/评价/创造递增）', () => {
      const low = builtinInstructions.find(i => i.id === 'frag_cognitive_low');
      const mid = builtinInstructions.find(i => i.id === 'frag_cognitive_mid');
      const high = builtinInstructions.find(i => i.id === 'frag_cognitive_high');
      const highSch = builtinInstructions.find(i => i.id === 'frag_cognitive_high_sch');
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
