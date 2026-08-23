// 新课标达标自处理：评估后自动修复（程序化替换 + AI 定向重生成）
import { describe, it, expect } from 'vitest';
import { assessCompliance } from '@/utils/curriculumCompliance';
import {
  buildAutoFixPlan,
  applyProgrammaticFixes,
  buildRegeneratePrompt,
} from '@/utils/complianceAutoFix';

// 含超纲词 + 机械记忆 + 无推理设问的内容
const FIXABLE_CONTENT = `<h1>初中八年级语文期末试卷</h1>
<p>（考试时间：120分钟　满分：120分）</p>
<h2>一、积累与运用。（共2题，共20分）</h2>
<p class="question">1. 根据课文内容填空：______________（10分）</p>
<p class="question">2. 结合全文，分析作者表达了怎样的思想感情。这篇课文中运用了修辞手法，请说明。（10分）</p>
<h2>二、写作。（共1题，共40分）</h2>
<p class="question">3. 请以"我的假期"为题写一篇作文。（40分）</p>
<div class="answer-section"><h2>答案</h2><p>1. 参考答案</p></div>`;

// 达标内容（无需处理，板块分值之和=满分）
const PASS_CONTENT = `<h1>初中八年级语文期末试卷</h1>
<p>（考试时间：120分钟　满分：120分）</p>
<h2>一、积累与运用。（共2题，共20分）</h2>
<p class="question">1. 小明在社区志愿活动中了解到垃圾分类的意义，请结合生活实际，说说你赞同的理由。（10分）</p>
<p class="question">2. 结合全文，分析作者表达了怎样的思想感情。为什么说这是"最好的时节"？（10分）</p>
<h2>二、古诗文阅读。（共3题，共36分）</h2>
<p class="question">3. 解释下列句中加点词的意思。（12分）</p>
<p class="question">4. 用现代汉语翻译画线句子。（12分）</p>
<p class="question">5. 结合全文，分析作者表达了怎样的思想感情？（12分）</p>
<h2>三、现代文阅读。（共2题，共24分）</h2>
<p class="question">6. 文中描写了哪些景物？作者为什么说老屋是"我"的精神家园？（12分）</p>
<p class="question">7. 你认为文中主人公的选择值得吗？请说明理由。（12分）</p>
<h2>四、写作。（共1题，共40分）</h2>
<p class="question">8. 阅读下面的材料，从任务一、任务二中任选其一，完成作文。（40分）</p>
<div class="answer-section"><h2>答案</h2><p>1. 参考答案</p></div>`;

describe('新课标达标自处理（评估→自动修复→闭环）', () => {
  it('未达标内容：生成自处理方案（程序化修复 + 定向重生成）', () => {
    const assessment = assessCompliance(FIXABLE_CONTENT, '语文', 'middle', 'exam');
    const plan = buildAutoFixPlan(assessment, { subject: '语文', stageLabel: '初中', genType: 'exam' });
    expect(plan.fixable).toBe(true);
    expect(plan.actions.length).toBeGreaterThan(0);
    // 含程序化修复（超纲词替换）与重生成（机械记忆/设问层次）
    expect(plan.actions.some(a => a.type === 'fix')).toBe(true);
    expect(plan.actions.some(a => a.type === 'regenerate')).toBe(true);
    expect(plan.planSummary).toContain('程序化修复');
  });

  it('达标内容：无需处理', () => {
    const assessment = assessCompliance(PASS_CONTENT, '语文', 'middle', 'exam');
    const plan = buildAutoFixPlan(assessment, { subject: '语文', stageLabel: '初中', genType: 'exam' });
    expect(plan.fixable).toBe(false);
    expect(plan.actions).toEqual([]);
    expect(plan.planSummary).toContain('全部维度达标');
  });

  it('程序化修复：超纲词按白名单替换为学段内表述', () => {
    const assessment = assessCompliance(FIXABLE_CONTENT, '语文', 'middle', 'exam');
    const plan = buildAutoFixPlan(assessment, {});
    const fixActions = plan.actions.filter(a => a.type === 'fix');
    const fixed = applyProgrammaticFixes(FIXABLE_CONTENT, fixActions);
    // "修辞手法"在映射表中 → 替换为"表达方式"
    if (fixActions.some(a => a.replacements?.some(r => r.from === '修辞手法'))) {
      expect(fixed).not.toContain('修辞手法');
      expect(fixed).toContain('表达方式');
    }
    // 未破坏 HTML 结构
    expect(fixed).toContain('<p class="question">');
  });

  it('重生成指令：只针对未过维度，含板块名与修复要求', () => {
    const assessment = assessCompliance(FIXABLE_CONTENT, '语文', 'middle', 'exam');
    const plan = buildAutoFixPlan(assessment, {});
    const regenActions = plan.actions.filter(a => a.type === 'regenerate');
    const prompt = buildRegeneratePrompt(regenActions, {
      sectionName: '积累与运用',
      sectionInstruction: '【板块指令】考查字词积累...',
    });
    expect(prompt).toContain('积累与运用');
    expect(prompt).toContain('只重写「积累与运用」板块');
    expect(prompt).toContain('D2'); // 设问层次修复要求
    expect(prompt).toContain('分值之和保持不变');
  });

  it('空评估：返回无动作', () => {
    const plan = buildAutoFixPlan(null, {});
    expect(plan.fixable).toBe(false);
    expect(plan.actions).toEqual([]);
  });

  it('程序化修复不改变无超纲词内容（幂等）', () => {
    const fixed = applyProgrammaticFixes(PASS_CONTENT, [
      { type: 'fix', scope: 'replace', replacements: [{ from: '不存在的词', to: '替代' }] },
    ]);
    expect(fixed).toBe(PASS_CONTENT);
  });
});
