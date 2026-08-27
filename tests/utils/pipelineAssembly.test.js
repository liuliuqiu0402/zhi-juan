// 临时验证：生成链路拼装是否完整（不调模型，确定性检查各库注入段）
import { describe, it, expect } from 'vitest';
import { getPromptTemplate } from '../../src/config/promptLibrary.js';
import { buildRenderContract, needsImageHint } from '../../src/config/eduRenderContract.js';
import { buildValidatorPrompt } from '../../src/config/validatorRules.js';
import { buildBlueprintInjection, getExamBlueprint } from '../../src/config/examPaperBlueprints.js';

describe('生成链路拼装验证（不调模型）', () => {
  it('指令库模板含全部设计段（创作要求/学科要点/学段特点/输出格式/质量底线）', () => {
    const tpl = getPromptTemplate({ grade: 'primary_low', subject: '语文', genType: 'exam' });
    console.log('[verify] source:', tpl.source, '| id:', tpl.id);
    expect(tpl.template).toContain('创作要求');
    expect(tpl.template).toContain('语文·小学低段要点');
    expect(tpl.template).toContain('学段特点');
    expect(tpl.template).toContain('输出格式');
    expect(tpl.template).toContain('质量底线');
  });

  it('渲染契约/质检规则/蓝图注入均非空且按三维度命中', () => {
    const rc = buildRenderContract({ subject: '语文', genType: 'exam', stage: 'primary_low', needsImage: needsImageHint('看图写话 表达与交流', 'exam') });
    const vp = buildValidatorPrompt({ subject: '语文', stage: 'primary_low', genType: 'exam' });
    const bp = getExamBlueprint('语文', 'primary_low');
    const bi = bp ? buildBlueprintInjection(bp) : '';
    console.log('[verify] renderContract:', rc.length, 'chars | validatorRules:', (vp.match(/\n· /g) || []).length, '条 | blueprint:', bp?.label, bp?.sections.length, '大题');
    expect(rc.length).toBeGreaterThan(0);   // 语文低段：配图需要 → 有 IMAGE 契约
    expect(vp.length).toBeGreaterThan(0);   // fix 规则注入
    expect(bi.length).toBeGreaterThan(0);   // 真题蓝本注入
    // 蓝图结构应与 docx 实际输出一致（32/24/14/30）
    const scores = bp?.sections.map((s) => `${s.name}:${s.score}`).join(' ');
    console.log('[verify] blueprint:', scores);
    expect(scores).toContain('识字与写字:32');
    expect(scores).toContain('积累与运用:24');
    expect(scores).toContain('阅读与鉴赏:14');
    expect(scores).toContain('表达与交流:30');
  });
});
