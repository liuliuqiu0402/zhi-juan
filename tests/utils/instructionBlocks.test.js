// 指令来源分段标注（instructionBlocks）测试
// ============================================================
// 🔴 目的：锁定"旁路切分"契约——输入成品全文 + 调用方拼装点已有的段文本，
//    输出 偏移区间 ↔ {库,key} 块列表；不修改任何文本、缺段只记 unlocated。
import { describe, it, expect } from 'vitest';
import { annotateInstructionBlocks, LIB_LABELS } from '../../src/utils/instructionBlocks.js';

// 模拟 GenerateModule.loadInstructionFromLibrary 拼装成品（与真实拼接同构）
const TEMPLATE_BODY = '你是资深命题专家。请为{grade}{subject}命制一份正式试卷。\n'
  + '· 作答书写载体：按书写惯例输出对应作答书写载体，书写空间按照答案的长度倒推，每一长度对应一个字位；并按此换算（1 个全角空格≈1 个字位≈1 em 书写宽）\n'
  + '· 书写载体协议：语文低段写汉字类题必须真实输出田字格\n'
  + '【卷面结构】\n一、基础建构任务(共X题，共32分)';
const RENDER_SEG = '\n【渲染指令】\n数学需 [GRAPH] 骨架、公式按学段裁剪。';
const RULES_SEG = '\n【生成前约束】\n· 分值账目与载体一致（fix）。';
const TEACH_SEG = '\n【教辅结构】\n栏目框架 + 题量底线。';
const DRAFT = TEMPLATE_BODY + RENDER_SEG + RULES_SEG + TEACH_SEG;

const BLANK_LINE = '· 作答书写载体：按书写惯例输出对应作答书写载体，书写空间按照答案的长度倒推，每一长度对应一个字位；并按此换算（1 个全角空格≈1 个字位≈1 em 书写宽）';
const CARRIER_LINE = '· 书写载体协议：语文低段写汉字类题必须真实输出田字格';
const STRUCT_LINE = '【卷面结构】\n一、基础建构任务(共X题，共32分)';

describe('annotateInstructionBlocks：段级切分', () => {
  it('按拼接顺序定位各来源段（区间正确、无重叠）', () => {
    const { blocks, unlocated } = annotateInstructionBlocks(DRAFT, [
      { text: TEMPLATE_BODY, lib: 'instruction', key: 'primary_low|语文|exam', name: '内置模板' },
      { text: RENDER_SEG, lib: 'render-contract', key: '语文', name: '渲染指令' },
      { text: RULES_SEG, lib: 'rules', key: 'rules-fix', name: '生成前约束' },
      { text: TEACH_SEG, lib: 'blueprint', key: '语文|exam', name: '教辅结构' },
    ]);
    expect(unlocated).toEqual([]);
    expect(blocks).toHaveLength(4);
    expect(blocks[0].lib).toBe('instruction');
    expect(blocks[0].key).toBe('primary_low|语文|exam');
    expect(blocks[0].start).toBe(0);
    expect(blocks[0].end).toBe(TEMPLATE_BODY.length);
    expect(blocks[1].lib).toBe('render-contract');
    expect(blocks[1].start).toBe(TEMPLATE_BODY.length);
    expect(blocks[2].lib).toBe('rules');
    expect(blocks[3].lib).toBe('blueprint');
    expect(blocks[3].end).toBe(DRAFT.length);
    // 区间互不重叠、按序覆盖全文
    for (let i = 1; i < blocks.length; i++) {
      expect(blocks[i].start).toBeGreaterThanOrEqual(blocks[i - 1].end);
    }
  });

  it('模板正文段内子片段（换算句→BLANK 卡 / 协议句→carrier 卡）在父段内定位', () => {
    const { blocks } = annotateInstructionBlocks(DRAFT, [
      {
        text: TEMPLATE_BODY, lib: 'instruction', key: 'primary_low|语文|exam', name: '内置模板',
        fragments: [
          { text: BLANK_LINE, lib: 'layout-spec', key: 'BLANK', name: '填空换算卡' },
          { text: CARRIER_LINE, lib: 'layout-spec', key: 'carrier-rules', name: '载体允许表卡' },
        ],
      },
      { text: RENDER_SEG, lib: 'render-contract', key: '语文', name: '渲染指令' },
    ]);
    // 3 段 + 2 子片段
    expect(blocks).toHaveLength(4);
    const fragBlank = blocks.find(b => b.key === 'BLANK');
    const fragCarrier = blocks.find(b => b.key === 'carrier-rules');
    const parent = blocks.find(b => b.key === 'primary_low|语文|exam');
    expect(fragBlank).toBeTruthy();
    expect(fragBlank.parentKey).toBe('primary_low|语文|exam');
    expect(fragBlank.start).toBeGreaterThanOrEqual(parent.start);
    expect(fragBlank.end).toBeLessThanOrEqual(parent.end);
    expect(fragBlank.lib).toBe('layout-spec');
    expect(fragCarrier.start).toBeGreaterThan(fragBlank.end); // 协议行在换算行之后
  });

  it('子片段文本与父段内实际行不符 → 不产生块（静默，不影响父段）', () => {
    const { blocks } = annotateInstructionBlocks(DRAFT, [
      {
        text: TEMPLATE_BODY, lib: 'instruction', key: 'k1', name: '模板',
        fragments: [{ text: '不存在的旧句', lib: 'layout-spec', key: 'BLANK', name: 'x' }],
      },
    ]);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].key).toBe('k1');
  });
});

describe('annotateInstructionBlocks：异常与兜底', () => {
  it('缺段（不在全文中）→ unlocated 记录，其余段正常', () => {
    const { blocks, unlocated } = annotateInstructionBlocks(DRAFT, [
      { text: TEMPLATE_BODY, lib: 'instruction', key: 'k1', name: '模板' },
      { text: '一段完全不存在的旧文本', lib: 'rules', key: 'r1', name: '旧' },
    ]);
    expect(blocks).toHaveLength(1);
    expect(unlocated).toHaveLength(1);
    expect(unlocated[0]).toMatchObject({ lib: 'rules', key: 'r1' });
  });

  it('段顺序与全文不一致（调用方乱序传入）→ 全文兜底仍定位', () => {
    const { blocks, unlocated } = annotateInstructionBlocks(DRAFT, [
      { text: RULES_SEG, lib: 'rules', key: 'r1', name: '规则' },
      { text: TEMPLATE_BODY, lib: 'instruction', key: 'k1', name: '模板' },
    ]);
    expect(unlocated).toEqual([]);
    expect(blocks).toHaveLength(2);
    // 排序后按文本位置：模板段在前
    expect(blocks[0].key).toBe('k1');
    expect(blocks[1].key).toBe('r1');
  });

  it('空输入/空段清单安全返回', () => {
    expect(annotateInstructionBlocks('', [{ text: 'a', lib: 'x' }])).toEqual({ blocks: [], unlocated: [] });
    expect(annotateInstructionBlocks('abc', [])).toEqual({ blocks: [], unlocated: [] });
    expect(annotateInstructionBlocks(null, null)).toEqual({ blocks: [], unlocated: [] });
  });

  it('LIB_LABELS 提供视图层中文库名', () => {
    expect(LIB_LABELS.instruction).toBe('指令库');
    expect(LIB_LABELS['layout-spec']).toBe('排版规格库');
    expect(LIB_LABELS['render-contract']).toBe('渲染契约库');
  });
});
