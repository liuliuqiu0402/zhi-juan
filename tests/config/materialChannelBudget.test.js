// ✅ A19（2026-09-14 用户定）：**预算口径与素材通道解耦**——
//    锚清单通道不注入整章原文，但预算**仍按"勾选原文量"推算**（原文量是"本次覆盖工作量"的客观代理量，
//    通道只决定"素材进不进指令、省不省一次压缩调用"，不改变工作量）。
//    为什么用源码接线测试：该口径位于生成主函数内部（依赖 store / 引擎探询，无法纯单测），
//    故以**结构不变量**锁死：① 原文量必须早于通道解析；② 预算公式不得出现通道变量；③ 通道只控压缩与注入。
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const SRC = fs.readFileSync(path.join(process.cwd(), 'src', 'composables', 'useAiGenerator.js'), 'utf8');

const idxOf = (needle) => {
  const i = SRC.indexOf(needle);
  expect(i, `源码应含：${needle}`).toBeGreaterThan(-1);
  return i;
};

describe('A19 素材通道 × 输出预算：口径解耦（预算按原文量，不随通道变）', () => {
  it('原文量（段文本总字数）与整章原文收集都先于通道解析——通道不可能影响它们', () => {
    const iRawChars = idxOf('const selectedRawChars =');
    const iRawChapters = idxOf('const rawChapters = collectChapterRawText(');
    const iChannel = idxOf('const channelSel = apiConfig.generationSettings.materialChannel');
    expect(iRawChars).toBeLessThan(iChannel);
    expect(iRawChapters).toBeLessThan(iChannel);
  });

  it('预算公式 = 原文量 × 系数（不含通道变量）', () => {
    const line = SRC.split('\n').find((l) => l.includes('bodyNeeded = Math.round(Math.max(floorTok, selectedRawChars'));
    expect(line, '应存在「max(地板, 原文量×系数)」式预算推导').toBeTruthy();
    expect(line).toContain('selectedRawChars');
    expect(line).not.toContain('materialChannel');
  });

  it('通道只决定"压缩与注入"（enableFullText），不参与任何预算计算', () => {
    expect(SRC).toContain("const enableFullText = materialChannel !== 'anchor';");
    // 通道变量在预算段（bodyNeeded/answerNeeded 推导与其后配额）中不得出现：
    // 取「预算注释起点 → 预算日志行」区间做白盒扫描
    const from = SRC.indexOf('── 动态输出预算帽（2026-09）');
    const to = SRC.indexOf('[每类型预算]');
    expect(from).toBeGreaterThan(-1);
    expect(to).toBeGreaterThan(from);
    const budgetRegion = SRC.slice(from, to);
    expect(budgetRegion).not.toContain('materialChannel');
    expect(budgetRegion).not.toContain('enableFullText');
  });
});
