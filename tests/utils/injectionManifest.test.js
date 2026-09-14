// ✅ A22（2026-09-14 用户同意）：实发注入清单**单源**回归
// 背景：写作请求里除委托正文之外还有一堆块（锚点清单/压缩原文/素材使用约定/组织方式/模板对标/
//   情境框架/差异化/输出约定/尾约束×2），原先内联在 useAiGenerator.buildPrompt 里 → 面板看不到，
//   用户只看到委托正文，"实际发出去的是什么"成了黑盒。
// 本文件锁死：① 单源块文本与拼接顺序（逐字）；② 门控口径（无素材不注入素材约定/组织方式）；
//   ③ 生成端不得再内联这些块（防两套口径回归）；④ 面板消费同一份单源。
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildUserMessageBlocks, buildUserMessagePrompt,
  buildAnchorListBlock, buildCompressedTextBlock,
  buildMaterialUsageBlock, buildOrganizeBlock,
  buildTemplateInfoBlock, buildContextBlock, buildDiffRegenBlock, buildOutputBlock, buildTailBlocks,
  TAIL_SELF_CONSISTENCY, SCENE_REGEN_TYPES,
} from '../../src/utils/injectionManifest.js';

const ROOT = path.resolve(__dirname, '../..');

describe('buildUserMessagePrompt（实发拼接：顺序 + 逐字）', () => {
  const full = {
    genType: 'practice', subject: '数学', materialChannel: 'full',
    anchorListText: '第一章\n· 知识点甲', compressedText: '原文片段……',
    instructionText: '【角色】课时练（委托正文）',
    templateInfo: '模板A 原文', contextFramework: '情境框架X',
    diffKps: ['甲', '乙'], outputMode: 'split',
  };

  it('顺序与逐字：清单→原文→素材约定→组织方式→委托正文→对标→情境→差异化→输出约定→尾约束×2', () => {
    expect(buildUserMessagePrompt(full)).toBe(
      buildAnchorListBlock(full.anchorListText)
      + buildCompressedTextBlock(full.compressedText)
      + buildMaterialUsageBlock({ genType: 'practice', materialChannel: 'full' })
      + buildOrganizeBlock('practice')
      + full.instructionText
      + buildTemplateInfoBlock(full.templateInfo)
      + buildContextBlock(full.contextFramework)
      + buildDiffRegenBlock({ genType: 'practice', diffKps: full.diffKps })
      + buildOutputBlock({ subject: '数学', genType: 'practice', outputMode: 'split' })
      + buildTailBlocks().join(''),
    );
  });

  it('无素材 → 素材使用约定/组织方式均不注入（既有门控口径不变）；尾约束照旧', () => {
    const p = buildUserMessagePrompt({ genType: 'exam', subject: '语文', materialChannel: 'full', outputMode: 'once' });
    expect(p).not.toContain('【素材使用约定】');
    expect(p).not.toContain('【组织方式】');
    expect(p).toContain('【尾约束·全文自洽】');
    expect(p).toContain('【尾约束·资料内多样】');
  });

  it('差异化仅题类注入（内容型无情境设问不注入）', () => {
    expect(buildUserMessagePrompt({ genType: 'summary', diffKps: ['甲'], materialChannel: 'full', outputMode: 'once' }))
      .not.toContain('【差异化要求（复生成）】');
    expect(SCENE_REGEN_TYPES).toEqual(['exam', 'practice', 'special', 'reading']);
  });

  it('模板对标/情境框架 为空则不注入', () => {
    expect(buildTemplateInfoBlock('')).toBe('');
    expect(buildTemplateInfoBlock('   ')).toBe('');
    expect(buildContextBlock('')).toBe('');
  });
});

describe('各块文本口径（防漂移的逐字锚点）', () => {
  it('组织方式：exam 引【卷面结构】、其余引【教辅结构】', () => {
    expect(buildOrganizeBlock('exam')).toBe('【组织方式】输出一律以委托书【卷面结构】的大题序列组织（大题名、顺序、题量以委托书为准）；开头【锚点清单】只声明覆盖范围，不是组织方式，不得据此替代委托书结构。\n\n');
    expect(buildOrganizeBlock('practice')).toContain('【教辅结构】的栏目序列组织（栏目名、顺序、题量以委托书为准）');
  });

  it('素材使用约定：通道分流（锚清单通道不给"不得照搬题目"句、依据改指清单）', () => {
    const anchor = buildMaterialUsageBlock({ genType: 'practice', materialChannel: 'anchor' });
    expect(anchor).toContain('开头【锚点清单】（含各知识点具体概念）是理解教材内容、难度与版本口径的**依据**');
    expect(anchor).toContain('题型结构、知识梯度与难度按上方清单（含具体概念）把握');
    expect(anchor).not.toContain('【压缩原文】中的练习/习题段');
    const full = buildMaterialUsageBlock({ genType: 'practice', materialChannel: 'full' });
    expect(full).toContain('中段【压缩原文】是理解教材内容与难度的**参考之一**');
    expect(full).toContain('· 【压缩原文】中的练习/习题段仅供理解题型与难度，**不得照搬题目**。');
  });

  it('素材使用约定：覆盖下限按 mode 分档、能否加按 extentOf 分档', () => {
    // practice = per-lesson-full + expand
    const practice = buildMaterialUsageBlock({ genType: 'practice', materialChannel: 'full' });
    expect(practice).toContain('**至少要全部覆盖到**');
    expect(practice).toContain('清单**不是命题上限**');
    expect(practice).toContain('本资料为命题/练习型');
    // summary = full + integrate（归纳型口吻）
    const summary = buildMaterialUsageBlock({ genType: 'summary', materialChannel: 'full' });
    expect(summary).toContain('**须全部覆盖到**');
    expect(summary).toContain('清单**不是范围围墙**');
    expect(summary).toContain('本资料为知识归纳型');
    expect(summary).not.toContain('本资料为命题/练习型');
    // errorbook = none + expand（不对账口吻）
    const err = buildMaterialUsageBlock({ genType: 'errorbook', materialChannel: 'anchor' });
    expect(err).toContain('本资料围绕错题组织，不与开头【锚点清单】做覆盖对账；');
  });

  it('尾约束×2：块内自带 \\n\\n 前缀，关键句逐字', () => {
    const [self, variety] = buildTailBlocks();
    expect(self.startsWith('\n\n【尾约束·全文自洽】\n')).toBe(true);
    expect(self).toContain('使本题**仅凭正文自身即可完成**');
    expect(variety.startsWith('\n\n【尾约束·资料内多样】\n')).toBe(true);
    expect(variety).toContain('同一份资料内各栏目呈现形式与组织顺序应有所差异，不得全份同类版式照搬');
    expect(TAIL_SELF_CONSISTENCY).toBe(self.slice(2));
  });

  it('输出约定：once/split 不同，且随自包含教辅分档', () => {
    const once = buildOutputBlock({ subject: '语文', genType: 'exam', outputMode: 'once' });
    const split = buildOutputBlock({ subject: '语文', genType: 'exam', outputMode: 'split' });
    expect(once).toContain('【输出约定】');
    expect(once).not.toBe(split);
    // 自包含教辅（summary）走"答案区仅逐题作答"口径，非自包含（exam）不含该句
    expect(buildOutputBlock({ subject: '语文', genType: 'summary', outputMode: 'once' }))
      .toContain('答案区仅逐题作答');
    expect(once).not.toContain('答案区仅逐题作答');
  });
});

describe('buildUserMessageBlocks（面板清单）', () => {
  it('块 id 顺序与实发顺序一致，共 11 块', () => {
    expect(buildUserMessageBlocks({ genType: 'practice', subject: '数学', materialChannel: 'anchor' }).map((b) => b.id))
      .toEqual(['anchor-list', 'compressed-text', 'material-usage', 'organize', 'instruction',
        'template-info', 'context-framework', 'diff-regen', 'output-convention', 'tail-self', 'tail-variety']);
  });

  it('injected 只认门控结果（预览文本不影响"本次是否注入"）', () => {
    const noMaterial = buildUserMessageBlocks({ genType: 'practice', subject: '数学', materialChannel: 'anchor', preview: true });
    const usage = noMaterial.find((b) => b.id === 'material-usage');
    expect(usage.injected).toBe(false);
    expect(usage.text).toContain('【素材使用约定】');  // 预览：条款文本可先行展示
    expect(noMaterial.find((b) => b.id === 'tail-self').injected).toBe(true);

    const withMaterial = buildUserMessageBlocks({
      genType: 'practice', subject: '数学', materialChannel: 'anchor',
      anchorListText: '第一章\n· 知识点甲',
    });
    expect(withMaterial.find((b) => b.id === 'material-usage').injected).toBe(true);
    expect(withMaterial.find((b) => b.id === 'anchor-list').injected).toBe(true);
  });

  it('非预览模式不产出任何预览文本（生成端拼接不受影响）', () => {
    const blocks = buildUserMessageBlocks({ genType: 'practice', subject: '数学', materialChannel: 'anchor' });
    expect(blocks.find((b) => b.id === 'material-usage').text).toBe('');
    expect(blocks.find((b) => b.id === 'organize').text).toBe('');
  });
});

describe('源码接线：生成端不再内联这些块（防两套口径回归）', () => {
  const ai = () => fs.readFileSync(path.join(ROOT, 'src', 'composables', 'useAiGenerator.js'), 'utf8');
  const gm = () => fs.readFileSync(path.join(ROOT, 'src', 'modules', 'GenerateModule.vue'), 'utf8');

  it('生成端从 injectionManifest 单源导入并调用', () => {
    const s = ai();
    expect(s).toContain("from '../utils/injectionManifest.js'");
    expect(s).toContain('buildMaterialUsageBlock({ genType, materialChannel })');
    expect(s).toContain('buildOrganizeBlock(genType)');
    expect(s).toContain('buildTailBlocks()[0]');
    expect(s).toContain('buildTailBlocks()[1]');
    expect(s).toContain('buildAnchorListBlock(anchorListText)');
    expect(s).toContain('buildCompressedTextBlock(compressedText)');
  });

  it('生成端已无内联副本（旧变量/字面量不得回归）', () => {
    const s = ai();
    for (const gone of [
      'const coverageFloor', 'const coverageExtent', 'const refClause', 'const structRef',
      '【尾约束·全文自洽】\n题干所声明的', '【尾约束·资料内多样】\n同一份资料内',
      'PAPER_OUTPUT_CONVENTIONS.once(', 'PAPER_OUTPUT_CONVENTIONS.split(',
      'const SELF_CONTAINED_TEACHING =',
    ]) expect(s).not.toContain(gone);
  });

  it('面板消费同一份单源：申请实发清单三入口刷新 + 逐段可点', () => {
    const s = gm();
    expect(s).toContain("from '../utils/injectionManifest.js'");
    expect((s.match(/refreshUserMsgBlocks\(\{/g) || [])).toHaveLength(3); // 组装 / 恢复默认 / 生成前刷新
    expect(s).toContain('data-um');
    expect(s).toContain('onUserMsgClick');
  });

  it('生成端拼接顺序与单源 BLOCK_DEFS 一致（顺序漂移同样会被逮住）', () => {
    const s = ai();
    const order = [
      'buildAnchorListBlock(anchorListText)',
      'buildCompressedTextBlock(compressedText)',
      'buildMaterialUsageBlock({ genType, materialChannel })',
      'buildOrganizeBlock(genType)',
      'applyMaterialChannel(instruction, materialChannel).trim()', // 委托正文（末尾锚定）
      'buildTemplateInfoBlock(templateInfo)',
      'buildContextBlock(contextFramework)',
      'buildDiffRegenBlock({ genType, diffKps })',
      'buildOutputBlock({ subject, genType, outputMode: generateMode })',
      'buildTailBlocks()[0]',
      'buildTailBlocks()[1]',
    ];
    const idx = order.map((k) => s.indexOf(k));
    expect(idx.every((i) => i >= 0)).toBe(true);
    expect(idx).toEqual([...idx].sort((a, b) => a - b)); // 严格递增 = 与实发顺序一致
  });
});
