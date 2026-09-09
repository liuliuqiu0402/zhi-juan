import { describe, it, expect } from 'vitest';
import { getPromptTemplate } from '../../src/config/promptLibrary.js';

/**
 * 图-题一致性驱动（2026-09 恢复正文级 + 非必要不配图双向收口）：
 * 看图/读图/看图形/统计图类题的图必须是正文决断点处的交付物（不进 system，
 * 防 复位工程S3.2 把渲染契约迁入 system 后降权 → 看图无图）；
 * 题干未声明图依赖则不得输出图标记、不得写"图片提示/如图/看图"等虚构图语。
 * 判定走内置模板正文（OUTPUT_FORMAT_BLOCK 内嵌 QUESTION_FORMAT）。
 */
const tmpl = (grademap, subject, genType) => {
  const r = getPromptTemplate({ grade: grademap, subject, genType });
  return (r && r.template) || '';
};

describe('图-题一致性驱动（看图必出图、无图不虚构图语，正文级）', () => {
  it('教学（practice 数学）委托正文含图-题一致性驱动', () => {
    expect(tmpl('primary_mid', '数学', 'practice')).toContain('图-题一致性');
  });

  it('正式卷（exam 语文）委托正文同样含图-题一致性驱动', () => {
    expect(tmpl('primary_low', '语文', 'exam')).toContain('图-题一致性');
  });

  it('知识总结（summary 数学，内容型）不注入题类图驱动（不向梳理型广播噪音）', () => {
    expect(tmpl('primary_high', '数学', 'summary')).not.toContain('图-题一致性');
  });

  it('驱动条款强调图与题干严格一致、无图不虚构图语', () => {
    const t = tmpl('primary_mid', '数学', 'practice');
    expect(t).toContain('与题干');
    expect(t).toContain('严禁');
    expect(t).toContain('[IMAGE]');
    expect(t).toContain('[GRAPH]');
    expect(t).toContain('不得输出图标记'); // 题干未声明图依赖 → 不输出
    expect(t).toContain('虚构图语');      // 无图不写"图片提示/如图"等措辞
  });
});