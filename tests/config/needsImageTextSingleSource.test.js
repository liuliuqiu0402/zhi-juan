// ✅ A21（2026-09-14 用户同意）：配图判定提示文本**单源**回归
// 背景：needsImageHint 是纯文本匹配——喂什么文本决定要不要注入图形/配图能力。生成端三个入口
//   各自拼各自的提示文本（组装=结构+类型名+范围名；生成前刷新=章节名+类型名），于是同一份渲染契约
//   在"面板预览"与"实发"之间漂移（预览不配图、实际配图）= 看到的是一套、发的是另一套。
// 本文件锁死：① buildNeedsImageText 纯函数口径（四类信号、去空、顺序固定）；
//   ② 源码接线：三个入口全部走同一份提示文本，且不再出现各自拼的旧模板。
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { buildNeedsImageText, needsImageHint } from '../../src/config/eduRenderContract.js';

const ROOT = path.resolve(__dirname, '../..');

describe('buildNeedsImageText（配图判定提示文本·单源纯函数）', () => {
  it('四类信号按固定顺序拼接，各段去空白', () => {
    const out = buildNeedsImageText({
      structure: ' 一、观察与实验(共2题) ',
      typeLabel: '期末考卷',
      scopeName: '期末',
      chapters: '第七单元 图形的运动',
    });
    expect(out).toBe('一、观察与实验(共2题) 期末考卷 期末 第七单元 图形的运动');
  });

  it('缺项不留空段（无前导/连续空格）', () => {
    expect(buildNeedsImageText({ typeLabel: '课时练' })).toBe('课时练');
    expect(buildNeedsImageText({})).toBe('');
    expect(buildNeedsImageText({ structure: '   ', chapters: '' })).toBe('');
  });

  it('单源文本喂给 needsImageHint：任一类信号含图依赖词即命中', () => {
    // 章节名命中（旧"刷新"入口能命中、旧"组装"入口却命不中的典型场景）
    const byChapter = buildNeedsImageText({ typeLabel: '期末考卷', scopeName: '期末', chapters: '第七单元 图形的运动' });
    expect(needsImageHint(byChapter, 'exam')).toBe(true);
    // 卷面结构命中（旧"组装"入口能命中、旧"刷新"入口却命不中的反向场景）
    const byStructure = buildNeedsImageText({ structure: '一、观察与实验', typeLabel: '期末考卷' });
    expect(needsImageHint(byStructure, 'exam')).toBe(true);
    // 四类信号都不含图词 → 不命中
    const none = buildNeedsImageText({ typeLabel: '期末考卷', scopeName: '期末', chapters: '第一单元 分数乘法' });
    expect(needsImageHint(none, 'exam')).toBe(false);
  });
});

describe('源码接线：配图判定提示文本三入口同参（防"预览A/实发B"）', () => {
  const gm = () => fs.readFileSync(path.join(ROOT, 'src', 'modules', 'GenerateModule.vue'), 'utf8');

  it('三个入口全部走 resolveNeedsImageText（1 处定义 + 组装/恢复默认/生成前刷新 3 处调用）', () => {
    const calls = gm().match(/resolveNeedsImageText\(\{/g) || [];
    expect(calls).toHaveLength(3);
  });

  it('两个入口不再各自拼提示文本（旧漂移写法已清除）', () => {
    const s = gm();
    expect(s).not.toContain('`${structure} ${genTypeLabel}');
    expect(s).not.toContain('`${scopeText} ${genTypeLabel}');
    expect(s).not.toContain('scopeText');
  });

  it('单源提示文本覆盖四类信号（卷面结构 / 类型名 / 范围维度名 / 章节名）', () => {
    const s = gm();
    for (const key of ['structure,', 'typeLabel:', 'scopeName:', 'chapters:']) expect(s).toContain(key);
  });

  it('取书同源：逐章过滤版提到模块作用域，组装与刷新共用同一来源', () => {
    const s = gm();
    expect(s).toContain('const perChapterBooksRef = { value: null };');
    // 刷新入口按逐章过滤版优先取书（否则逐章模式下章节名又成第二个漂移源）
    expect(s).toContain('perChapterBooksRef.value?.length');
  });
});
