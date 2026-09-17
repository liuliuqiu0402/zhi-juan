import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  cnCountToNum,
  extractDeclaredCounts,
  promptOfBlock,
  isIconBlock,
  stemWindowBefore,
  checkFigurePrompts,
} from '../../src/utils/figurePromptCheck.js';
import { auditExamPaper, hasStructuralGraphSupport } from '../../src/utils/examValidator.js';
import { buildRenderContract } from '../../src/config/eduRenderContract.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf-8');

/**
 * 配图要素一致性交叉校验（2026-09-16）
 * ============================================================
 * 锁定：数量提取的取舍（量词锚定、排除题号/分值/选项）、保守判定（宁可漏报不可误报）、
 *  ICON 跳过、以及"无结构化图形能力学科"的提示；并锁住契约文本（PROMPT 须写明主体与数量）。
 * ============================================================
 */

describe('中文数词解析', () => {
  it('一~十、十一~十九、二十、两、阿拉伯', () => {
    expect(cnCountToNum('一')).toBe(1);
    expect(cnCountToNum('两')).toBe(2);
    expect(cnCountToNum('十')).toBe(10);
    expect(cnCountToNum('十一')).toBe(11);
    expect(cnCountToNum('十九')).toBe(19);
    expect(cnCountToNum('二十')).toBe(20);
    expect(cnCountToNum('3')).toBe(3);
    expect(Number.isNaN(cnCountToNum('几'))).toBe(true);
  });
});

describe('数量声明提取（量词锚定，避开题号/分值）', () => {
  it('中文数词+量词、阿拉伯数字+量词、英文数词', () => {
    expect([...extractDeclaredCounts('图中有三只熊猫').keys()]).toEqual([3]);
    expect([...extractDeclaredCounts('画出5个三角形').keys()]).toEqual([5]);
    expect([...extractDeclaredCounts('three pandas in the bamboo').keys()]).toEqual([3]);
  });

  it('🔴 题号/分值/选项不算数量声明（防误报）', () => {
    expect(extractDeclaredCounts('1. 请选择').size).toBe(0);
    expect(extractDeclaredCounts('（共5分）').size).toBe(0);
    expect(extractDeclaredCounts('从四个选项中选出').size).toBe(0);
    expect(extractDeclaredCounts('共3小题').size).toBe(0);
  });
});

describe('块体解析', () => {
  it('取 PROMPT / 识别 ICON', () => {
    expect(promptOfBlock('\nPROMPT:三只熊猫在竹林中吃竹子\n')).toBe('三只熊猫在竹林中吃竹子');
    expect(isIconBlock('TYPE:ICON\nKEYWORDS:熊猫')).toBe(true);
    expect(isIconBlock('PROMPT:三只熊猫')).toBe(false);
  });

  it('题干窗口从最近题号切起', () => {
    const html = '<p>1. 第一题题干</p><p>2. 图中有三只熊猫</p>';
    const w = stemWindowBefore(html, html.length);
    expect(w).toContain('图中有三只熊猫');
    expect(w).not.toContain('第一题题干');
  });
});

describe('交叉校验：题干 ↔ PROMPT', () => {
  const wrap = (stem, prompt) => `${stem}[IMAGE]\nPROMPT:${prompt}\n[/IMAGE]`;

  it('数量一致 → 不报', () => {
    const r = checkFigurePrompts(wrap('<p>1. 图中有三只熊猫在吃竹子</p>', '三只熊猫在竹林中吃竹子'));
    expect(r.mismatches).toEqual([]);
    expect(r.missingCount).toEqual([]);
    expect(r.checked).toBe(1);
  });

  it('🔴 题干三只、画面一只 → 报不一致', () => {
    const r = checkFigurePrompts(wrap('<p>1. 图中有三只熊猫在吃竹子</p>', '一只熊猫在竹林中吃竹子'));
    expect(r.mismatches).toHaveLength(1);
    expect(r.mismatches[0].stemCount).toBe(3);
    expect(r.mismatches[0].promptCount).toBe(1);
  });

  it('题干有数量、画面未写数量 → 提示补写（不判不一致）', () => {
    const r = checkFigurePrompts(wrap('<p>1. 图中有三只熊猫</p>', '熊猫在竹林中吃竹子'));
    expect(r.mismatches).toEqual([]);
    expect(r.missingCount).toHaveLength(1);
  });

  it('🔴 保守判定：题干出现多个数量时不判定（宁漏不误）', () => {
    const r = checkFigurePrompts(wrap('<p>1. 图中有三只熊猫和两只猴子</p>', '一只熊猫'));
    expect(r.mismatches).toEqual([]);
  });

  it('ICON 图标检索不承载数量 → 跳过', () => {
    const r = checkFigurePrompts(
      '<p>1. 图中有三只熊猫</p>[IMAGE]\nTYPE:ICON\nKEYWORDS:熊猫,竹子\n[/IMAGE]'
    );
    expect(r.mismatches).toEqual([]);
    expect(r.missingCount).toEqual([]);
    expect(r.checked).toBe(0);
  });

  it('无 [IMAGE] → images 为 0', () => {
    expect(checkFigurePrompts('<p>纯文字</p>').images).toBe(0);
  });
});

describe('学科图形能力判定（单一事实源读取）', () => {
  it('数理化有结构化图形能力；生物/地理/历史/科学无（仅统计图）', () => {
    expect(hasStructuralGraphSupport('数学')).toBe(true);
    expect(hasStructuralGraphSupport('物理')).toBe(true);
    expect(hasStructuralGraphSupport('化学')).toBe(true);
    expect(hasStructuralGraphSupport('生物')).toBe(false);
    expect(hasStructuralGraphSupport('地理')).toBe(false);
    expect(hasStructuralGraphSupport('历史')).toBe(false);
    expect(hasStructuralGraphSupport('科学')).toBe(false);
  });
});

describe('端到端：auditExamPaper 产出配图一致性提示', () => {
  const htmlOf = (stem, prompt) => '<h2>一、选择题</h2>'
    + `<p>${stem}</p>[IMAGE]\nPROMPT:${prompt}\n[/IMAGE]<p>2. 下一题</p>`;

  it('生物卷：数量不一致 → image-consistency(warn)；且提示生图引擎需人工核对', () => {
    const r = auditExamPaper(htmlOf('1. 观察下面的图，图中有三只熊猫在吃竹子', '一只熊猫在竹林中吃竹子'), {
      subject: '生物', stage: 'middle', genType: 'practice',
    });
    const msgs = r.silentDetails.map((d) => d.message).join(' | ');
    expect(msgs).toContain('配图数量可能与题干不一致');
    expect(msgs).toContain('三只');
    expect(msgs).toContain('一只');
    // 生物无结构化图形能力 → 追加生图引擎核对提示
    expect(r.silentDetails.some((d) => d.type === 'image-engine-only')).toBe(true);
  });

  it('🔴 数学卷不报生图引擎提示（有结构化图形能力）', () => {
    const r = auditExamPaper(htmlOf('1. 观察下面的图，图中有三只熊猫', '一只熊猫'), {
      subject: '数学', stage: 'middle', genType: 'practice',
    });
    expect(r.silentDetails.some((d) => d.type === 'image-engine-only')).toBe(false);
  });

  it('数量一致时不误报', () => {
    const r = auditExamPaper(htmlOf('1. 图中有三只熊猫在吃竹子', '三只熊猫在竹林中吃竹子'), {
      subject: '生物', stage: 'middle', genType: 'practice',
    });
    const msgs = r.silentDetails.map((d) => d.message).join(' | ');
    expect(msgs).not.toContain('配图数量可能与题干不一致');
  });
});

describe('契约文本锁定：PROMPT 须写明主体与数量', () => {
  it('渲染契约把"必须写明主体与数量"注入配图契约', () => {
    const out = buildRenderContract({ subject: '生物', stage: 'middle', genType: 'practice', needsImage: true });
    expect(out).toContain('[IMAGE]');
    expect(out).toContain('必须写明主体与数量');
    expect(out).toContain('数量必须写明且与题干一致');
    // 仍保留既有锁定短语（既有测试 toContain('PROMPT:画面描述')）
    expect(out).toContain('PROMPT:画面描述');
  });

  it('数量要求只在【渲染指令】单一事实源；正文图条款只给判据与要求（不复述格式细节）', () => {
    const lib = read('src/config/promptLibrary.js');
    // 🔴 2026-09-17：正文原复述"须写明主体与数量/图内无字/每图一段"等格式细节（与渲染指令双写）——已归单源
    expect(lib, '正文不得再复述格式细节（防与渲染指令双写漂移）').not.toContain('须写明主体与数量');
    expect(lib).toContain('按注入的【渲染指令】');
    expect(lib).toContain('不存在"图依赖措辞清单"');
  });

  it('🔴 契约不新增字段（标准化器只保留 PROMPT，新增字段会被丢弃）', () => {
    const rc = read('src/config/eduRenderContract.js');
    const sample = rc.match(/const IMAGE_SAMPLE = `\[IMAGE\]([\s\S]*?)`;/);
    expect(sample).toBeTruthy();
    expect(sample[1]).toContain('PROMPT:');
    expect(sample[1]).not.toMatch(/COUNT\s*[:：]|SCENE\s*[:：]|SUBJECT\s*[:：]/);
  });
});
