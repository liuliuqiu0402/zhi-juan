// 🔬 材料标签（条目性质 kind）在生成链路上的**端到端打通**验证（2026-09-14 用户要求确认）
// 链条（一处判定、全链同源，不新增第二套字段）：
//   分析产物 kind（模型自觉输出，实测常缺）
//     → 落库归一（textbookStore.updateChaptersAnalysis：显式优先 + 名字兜底）   [stores 用例]
//     → 读盘归一（loadTextbooks 回填，旧结果无需重跑分析）                      [stores 用例]
//     → 生成端随卡锚树投影透传（useAiGenerator，源码锁：injectionManifest.test.js）
//     → 覆盖锚归一（coverageAnchor.flattenAnchorTree：resolveAnchorKind）
//     → 清单渲染分流（formatAnchorListByChapter splitMaterial → ◇ 语言材料行）
//     → 角色说明 + 【素材使用约定】（都声明"只作理解与难度依据、不列入设题单位"）
//     → 展示层标签 + 人工改判（教材库/生成模块，改判即写显式 kind）
// 本文件覆盖其中"纯函数段 + 生成端分流开关"，store 段由 tests/stores/textbookStore.test.ts 覆盖。
import { describe, it, expect } from 'vitest';
import { buildAnchors } from '../../src/utils/coverageAnchor.js';
import {
  formatAnchorListByChapter, anchorListRoleNote, MATERIAL_LINE,
} from '../../src/utils/anchorTreeContract.js';
import { buildMaterialUsageBlock } from '../../src/utils/injectionManifest.js';
import { contractOf } from '../../src/config/coverageContract.js';

const card = (coreKnowledge) => ({
  chapterTitle: 'Unit 1 Try your best',
  segments: [{ text: 'poster Mulan tall tree practise', type: '正文' }],
  anchorTree: [{ bigConcept: '面对新困难', coreKnowledge }],
});

// 三条覆盖两种判定路径：名字兜底（知识/材料）、显式改判（把材料名改成知识/反向）
const CKS = [
  { name: '语音：字母组合 ee', level: '理解', specificConcepts: ['/iː/'] },                        // 无 kind → 兜底 knowledge
  { name: '课文：蜗牛爬树', level: '理解', specificConcepts: [] },                                  // 无 kind → 兜底 material
  { name: '句型：一般过去时', level: '理解', specificConcepts: ['was/were'], kind: 'material' },     // 显式改判 → material
];

describe('材料标签（kind）生成链路打通', () => {
  it('① 分析产物 → 覆盖锚归一：显式优先、缺失按条目名兜底（生成端拿到的就是这一份判定）', () => {
    const { anchors } = buildAnchors([card(CKS)], {});
    const kindOf = Object.fromEntries(anchors.map((a) => [a.name, a.kind]));
    expect(kindOf['语音：字母组合 ee']).toBe('knowledge');
    expect(kindOf['课文：蜗牛爬树']).toBe('material');
    expect(kindOf['句型：一般过去时']).toBe('material');
  });

  it('② 生成端分流开关由资料类型契约决定（命题型拆 ◇；知识型不拆、材料留覆盖行内）', () => {
    // 生成端判据：splitMaterial = contractOf(genType).mode !== 'full'（useAiGenerator 同一表达式）
    for (const t of ['practice', 'special', 'reading', 'exam', 'errorbook']) {
      expect(contractOf(t).mode !== 'full', `${t} 应分流`).toBe(true);
    }
    for (const t of ['summary', 'preview', 'dictation', 'review']) {
      expect(contractOf(t).mode !== 'full', `${t} 不应分流`).toBe(false);
    }
  });

  it('③ 清单渲染：材料单列 ◇ 行、知识留在覆盖行；知识型混排不出现 ◇', () => {
    const { anchors } = buildAnchors([card(CKS)], {});
    const split = formatAnchorListByChapter(anchors, { withConcepts: true, splitMaterial: true });
    expect(split).toContain(MATERIAL_LINE);                               // ◇ 语言材料（…不必单独设题）：
    expect(split.split(MATERIAL_LINE)[1]).toContain('课文：蜗牛爬树');      // 材料进 ◇ 行
    expect(split.split(MATERIAL_LINE)[1]).toContain('句型：一般过去时');
    expect(split.split(MATERIAL_LINE)[0]).toContain('语音：字母组合 ee');   // 知识留在正文行
    const inline = formatAnchorListByChapter(anchors, { withConcepts: true, splitMaterial: false });
    expect(inline).not.toContain('◇');                                    // 知识型：材料与知识混排
    expect(inline).toContain('课文：蜗牛爬树');
  });

  it('④ 两处声明同步：清单角色说明 + 【素材使用约定】都给出"材料不必单独设题"', () => {
    expect(anchorListRoleNote({ splitMaterial: true })).toContain('不必为其单独设题');
    expect(anchorListRoleNote({ splitMaterial: false })).not.toContain('不必为其单独设题');
    const usage = buildMaterialUsageBlock({ genType: 'practice', materialChannel: 'anchor' });
    expect(usage).toContain('标◇的材料用于把握难度与理解语境，不必为其单独设题');
  });

  it('⑤ 人工改判即链路生效：材料改回知识后，该条不再出现在 ◇ 行', () => {
    const fixed = CKS.map((c) => (c.name === '课文：蜗牛爬树' ? { ...c, kind: 'knowledge' } : c));
    const { anchors } = buildAnchors([card(fixed)], {});
    const split = formatAnchorListByChapter(anchors, { withConcepts: true, splitMaterial: true });
    const materialPart = split.split(MATERIAL_LINE)[1] || '';
    expect(materialPart).not.toContain('课文：蜗牛爬树');                  // 已改判 → 退出材料行
    expect(materialPart).toContain('句型：一般过去时');                    // 仍是材料的留在材料行
    expect(split.split(MATERIAL_LINE)[0]).toContain('课文：蜗牛爬树');      // 回到覆盖行
  });

  it('⑥ 锚清单通道（本次生成用的通道）实际拿到的注入文本含 ◇ 行与边界声明', () => {
    const { anchors } = buildAnchors([card(CKS)], {});
    const anchorListText = formatAnchorListByChapter(anchors, { withConcepts: true, splitMaterial: true });
    const roleNote = anchorListRoleNote({ withConcepts: true, splitMaterial: true });
    // 生成端拼 prompt 的两件：buildAnchorListBlock(anchorListText, roleNote) —— 注入文本形态
    const injected = `【锚点清单】\n${roleNote}\n${anchorListText}\n\n`;
    expect(injected).toContain(MATERIAL_LINE);
    expect(injected).toContain('不必为其单独设题');
  });
});
