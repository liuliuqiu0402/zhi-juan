import { describe, it, expect } from 'vitest';
import { getPromptTemplate } from '../../src/config/promptLibrary.js';

/**
 * 图交付物驱动（2026-09 恢复正文级）：
 * 看图/读图/看图形/统计图类题的图必须是正文决断点处的交付物（不进 system，
 * 防 复位工程S3.2 把渲染契约迁入 system 后降权 → 看图无图）。
 * 判定走内置模板正文（OUTPUT_FORMAT_BLOCK 内嵌 QUESTION_FORMAT）。
 */
const tmpl = (grademap, subject, genType) => {
  const r = getPromptTemplate({ grade: grademap, subject, genType });
  return (r && r.template) || '';
};

describe('图交付物驱动（看图必出图，正文级）', () => {
  it('教学（practice 数学）委托正文含图交付物驱动', () => {
    expect(tmpl('primary_mid', '数学', 'practice')).toContain('图是本题交付物');
  });

  it('正式卷（exam 语文）委托正文同样含图交付物驱动', () => {
    expect(tmpl('primary_low', '语文', 'exam')).toContain('图是本题交付物');
  });

  it('知识总结（summary 数学，内容型）不注入题类图驱动（不向梳理型广播噪音）', () => {
    expect(tmpl('primary_high', '数学', 'summary')).not.toContain('图是本题交付物');
  });

  it('驱动条款强调图与题干严格一致、严禁图形隐含代替', () => {
    const t = tmpl('primary_mid', '数学', 'practice');
    expect(t).toContain('与题干');
    expect(t).toContain('严禁');
    expect(t).toContain('[IMAGE]');
    expect(t).toContain('[GRAPH]');
  });
});