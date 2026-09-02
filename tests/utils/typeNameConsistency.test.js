// 资料类型中文名跨文件一致守卫（防"命名双轨"再漂移）
// 规范名唯一事实源 = promptLibrary.GEN_TYPE_NAMES；expertKnowledge 的 emoji 卡片表仅叠加前缀、文本必须一致。
import { describe, it, expect } from 'vitest';
import { genTypeOptions, genTypeTemplates } from '../../src/config/expertKnowledge.js';
import { GEN_TYPE_NAMES } from '../../src/config/promptLibrary.js';

const stripEmoji = (label) => String(label).replace(/^\S+\s*/, ''); // 去 emoji 前缀（emoji+空格）

describe('资料类型中文名跨文件一致（expertKnowledge emoji 卡片表 ↔ GEN_TYPE_NAMES）', () => {
  it('genTypeOptions.label 去 emoji 后与 GEN_TYPE_NAMES 完全一致（exam/summary/review 曾三阵营漂移）', () => {
    expect(genTypeOptions).toHaveLength(9);
    for (const opt of genTypeOptions) {
      expect(stripEmoji(opt.label)).toBe(GEN_TYPE_NAMES[opt.value]);
    }
  });

  it('genTypeTemplates.name 去 emoji 后与 GEN_TYPE_NAMES 完全一致', () => {
    expect(Object.keys(genTypeTemplates)).toHaveLength(9);
    for (const [k, v] of Object.entries(genTypeTemplates)) {
      expect(stripEmoji(v.name)).toBe(GEN_TYPE_NAMES[k]);
    }
  });

  it('GEN_TYPE_NAMES：9 类 key、中文名互不重复（正式考卷≠正式试卷 类漂移回归）', () => {
    const names = Object.values(GEN_TYPE_NAMES);
    expect(names).toHaveLength(9);
    expect(new Set(names).size).toBe(9);
    expect(GEN_TYPE_NAMES.exam).toBe('正式考卷');
    expect(GEN_TYPE_NAMES.summary).toBe('知识总结');
    expect(GEN_TYPE_NAMES.review).toBe('复习资料');
  });
});
