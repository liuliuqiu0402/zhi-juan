import { describe, it, expect } from 'vitest';
import { getPromptTemplate } from '../../src/config/promptLibrary.js';

/**
 * 图-题一致性驱动（2026-09 正文级 + 非必要不配图双向收口；2026-09-12 改**原则式**）：
 * 是否要图的判断依据只有一条——**该题作答是否需要图中信息**（题干怎么措辞都算，不设措辞清单），
 * 不依赖"看图/读图/看图形/统计图…"这类枚举（枚举必不完备：模型认不出"观察下面的图形"即不出图，
 * 而校验侧用更宽词表照报缺图，两表不同源故多轮修不掉——见 eduRenderContract.FIGURE_DEPENDENCY_RE）；
 * 需要 → 图是正文决断点处的交付物（不进 system，防渲染契约迁入 system 后降权 → 看图无图）；
 * 不需要 → 不必硬配图，也不得写"图片提示/如图/看图"等并无其实的图语。
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

  it('驱动条款为原则式（判据=该题是否需要图中信息，无措辞清单）且无图不虚构图语', () => {
    const t = tmpl('primary_mid', '数学', 'practice');
    expect(t).toContain('与题干');
    expect(t).toContain('严禁');
    expect(t).toContain('[IMAGE]');
    expect(t).toContain('[GRAPH]');
    expect(t).toContain('该题作答是否需要图中信息');   // 原则式判据（唯一依据）
    expect(t).toContain('不存在"图依赖措辞清单"');      // 明示无清单，防枚举回退
    expect(t).toContain('虚构图语');                  // 无图不写"图片提示/如图"等措辞
    expect(t).not.toContain('不得输出图标记');          // 旧"未声明→不得出图"硬禁止不得回退
  });
});