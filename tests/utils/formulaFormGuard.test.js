// 公式形态抽检（规则 formula-form-guard，examValidator 1.5.6c）
// ============================================================
// 🔴 这条规则的目的：模型漏用 $…$ 定界、把 LaTeX 命令直接写进正文（如 3\frac{1}{2}）时，
//    在生成报告【问题列表】里**提示用户手改**（Word 里否则会原样显示 LaTeX 代码、预览也不出印刷形态）。
//    FORMULA_RULES 的"公式禁止用文本堆砌"此前**没有程序执行点**（要求悬空），本条补上。
// 🔴 通道：走 guard 通道 silentCount（level='notice'）——useAiGenerator 整卷质检段取
//    silentDetails.filter(d => d.level !== 'debug') 映射为 `⚠️ …` 进【问题列表】；
//    而 fix 类的 issues 是**修复记录**（只进 console），推那里用户根本看不到 = 白做。
//    本测试用 showIssues() 复刻该映射，直接断言"用户在问题列表里能看到这条"。
// 🔴 两条硬约束（用户裁定 2026-09-30）：
//    ① **只报不改**——公式起止需人判断，程序猜着补 $ 会把"正文在讲 LaTeX 写法"这类正当内容改坏；
//       自动修必须精准，不精准就是添乱（能自动修的一律走"扩转换器支持表"，见 latexToDocxMath）。
//    ② **不新增注入文本**——公式写法已由渲染契约 FORMULA_RULES 单源覆盖，本条 promptHint 留空，
//       实发提示词零变化（仅执行点工作）。
// ============================================================
import { describe, it, expect, beforeEach } from 'vitest';
import { auditExamPaper } from '@/utils/examValidator.js';
import { getActiveFixPromptRules, getValidatorRules, RULES_STORAGE_KEY, VALIDATOR_GATES } from '@/config/validatorRules.js';

const audit = (html, subject = '数学', genType = 'exam') => auditExamPaper(html, { subject, stage: 'middle', genType });
/** 复刻 useAiGenerator 的映射（silentDetails → 生成报告【问题列表】），只保留本规则产生的条目 */
const showIssues = (html, subject) => audit(html, subject).silentDetails
  .filter((d) => d.level !== 'debug' && d.type === 'formula-form')
  .map((d) => `⚠️ ${d.message}`);

beforeEach(() => { localStorage.removeItem(RULES_STORAGE_KEY); });

describe('公式形态抽检：未包裹的 LaTeX 要进【问题列表】（只报不改）', () => {
  it('正文里裸写 \\frac → 报一条，且带命令名与上下文片段', () => {
    const issues = showIssues('<p>2. 把 3\\frac{1}{2} 化成假分数。</p>');
    expect(issues.length, '应报一条').toBe(1);
    expect(issues[0], '要点名是哪个命令').toContain('\\frac');
    expect(issues[0], '要带上下文便于定位').toContain('化成假分数');
    expect(issues[0], '要说明只提示未改动').toContain('未改动正文');
    expect(issues[0].startsWith('⚠️ '), '按【问题列表】口径带 ⚠️ 前缀（卡片按前缀标色）').toBe(true);
  });

  it('🔴 正文逐字节不变（只报不改的硬保证），且不计入 fixed / issues', () => {
    const html = '<p>3. 计算 2\\sqrt{3}+\\frac{1}{2} 的值。</p>';
    const r = audit(html);
    expect(r.html, '正文一个字符都不能被改').toBe(html);
    expect(r.fixed, '不是修复类动作，不得计入 fixed').toBe(0);
    expect(r.issues, '不得混进"修复记录"（那是 fix 类的地盘）').toHaveLength(0);
  });

  it('多处裸写 → 汇总成一条（列前 3 处 + 总数），不刷屏', () => {
    const issues = showIssues('<p>1. \\frac{1}{2}</p><p>2. \\sqrt{3}</p><p>3. \\frac{a}{b}</p><p>4. \\sum_{i=1}^{n}</p>');
    expect(issues.length, '仍只报一条').toBe(1);
    expect(issues[0], '要有总数').toContain('4 处');
  });
});

describe('公式形态抽检：正常形态一律不打扰', () => {
  it('行内 $…$ 公式不报', () => {
    expect(showIssues('<p>2. 把 $3\\frac{1}{2}$ 化成假分数。</p>').length).toBe(0);
  });

  it('块级 $$…$$（含跨行）不报', () => {
    expect(showIssues('<p>$$x=\\frac{-b\\pm\\sqrt{b^{2}-4ac}}{2a}$$</p>').length).toBe(0);
    expect(showIssues('<p>$$\\begin{cases}x+y=5\\\\ x-y=1\\end{cases}$$</p>').length).toBe(0);
  });

  it('非公式学科不报（语文学科门控）', () => {
    expect(showIssues('<p>下文中的 3\\frac{1}{2} 是排版写法示例。</p>', '语文').length).toBe(0);
  });

  it('HTML 标签/样式里的反斜杠不算（去标签后才判）', () => {
    expect(showIssues('<p style="background:url(a\\b.png)">正文没有公式。</p>').length).toBe(0);
  });

  it('规则被停用 → 不报', () => {
    localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify({
      overrides: { 'formula-form-guard': { enabled: false } }, added: {}, deleted: [],
    }));
    expect(showIssues('<p>2. 把 3\\frac{1}{2} 化成假分数。</p>').length).toBe(0);
  });
});

describe('公式形态抽检：不新增注入文本（实发零变化）', () => {
  it('规则已注册且有独立执行点，但**不进生成前约束**（guard 类不注入）', () => {
    expect([...VALIDATOR_GATES], '执行点必须登记（validatorWiring 会对账）').toContain('formula-form-guard');
    expect(getValidatorRules({ subject: '数学', stage: 'middle', genType: 'exam' }).has('formula-form-guard'), '规则在数理化学科应生效').toBe(true);
    const active = getActiveFixPromptRules({ subject: '数学', stage: 'middle', genType: 'exam' });
    expect(active.some((r) => r.id === 'formula-form-guard'), '不得出现在生成前约束里').toBe(false);
  });
});
