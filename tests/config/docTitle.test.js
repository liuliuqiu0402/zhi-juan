/**
 * 资料标题命名 · 类型门控守卫（2026-10-30 属主实证）
 * ============================================================
 * 属主实证：知识点总结里出现了「2026-2027学年度第一学期六年级语文期末质量检测」——那是**考试型**标题。
 * 原设计（572ef24 / 90b5929 / b3eedeb）：
 *   · 普通型（课/单元范围）＝ 年级 + 学科 + 册别 + 范围名 + 类型名
 *   · 考试型（期中/期末/月考/专题/升学卷别）＝ 学年度学期 + 年级 + 学科 + 范围标签词（**只属于正式考卷**）
 * 本守卫锁死：①考试型标题只有 exam 能拼；②教辅跨单元推断出的卷名不得进标题；
 * ③教辅显式选"期末"时用维度词（期末）而不是卷名（期末质量检测）。
 * ============================================================
 */
import { describe, it, expect } from 'vitest';
import { composeDocTitle } from '../../src/config/paperScope.js';
import { genTypeOptions } from '../../src/config/expertKnowledge.js';

const SEMESTER = '上册';
const base = {
  grade: '六年级',
  subject: '语文',
  semester: SEMESTER,
  academic: '2026-2027学年度第一学期',
  pickLabel: () => '知识梳理',
  getPool: () => ['知识梳理', '学习总结'],
};

const labelScopeFinal = { name: '期末质量检测', isScopeLabel: true, category: 'final' };
const labelScopeInferred = { name: '综合检测', isScopeLabel: true, category: 'default' };
const unitScope = { name: '第二单元', isScopeLabel: false, category: 'unit' };

describe('资料标题 · 考试型标题只属于正式考卷', () => {
  it('知识点总结 + 用户选"期末" ⇒ 普通型标题（维度词当范围名，不带学年度/不带卷名）', () => {
    const { title } = composeDocTitle({ ...base, genType: 'summary', scopeInfo: labelScopeFinal, scopeType: 'final' });
    expect(title).toBe('六年级语文上册期末知识梳理');
    expect(title).not.toContain('学年度');
    expect(title).not.toContain('质量检测');
  });

  it('知识点总结 + 跨单元推断出卷名 ⇒ 卷名整段不进标题', () => {
    const { title } = composeDocTitle({ ...base, genType: 'summary', scopeInfo: labelScopeInferred, scopeType: '' });
    expect(title).toBe('六年级语文上册知识梳理');
    expect(title).not.toMatch(/综合检测|期末|期中/);
  });

  it('全 9 类非试卷资料都不得拼出考试型标题（含显式期末）', () => {
    for (const { value } of genTypeOptions.filter((o) => o.value !== 'exam')) {
      const { title } = composeDocTitle({ ...base, genType: value, scopeInfo: labelScopeFinal, scopeType: 'final' });
      expect(title, `${value} 不得带学年度学期`).not.toContain('学年度');
      expect(title, `${value} 不得出现卷名`).not.toContain('质量检测');
    }
  });

  it('正式考卷 + 期末 ⇒ 考试型标题（与属主看到的那一声明一致）', () => {
    const { title } = composeDocTitle({ ...base, genType: 'exam', scopeInfo: labelScopeFinal, scopeType: 'final', pickLabel: () => '期末质量检测' });
    expect(title).toBe('2026-2027学年度第一学期六年级语文期末质量检测');
  });

  it('正式考卷 + 单单元 ⇒ 普通型标题（年级+学科+册别+范围名+类型名）', () => {
    const { title } = composeDocTitle({ ...base, genType: 'exam', scopeInfo: unitScope, scopeType: '', pickLabel: () => '综合检测' });
    expect(title).toBe('六年级语文上册第二单元综合检测');
  });

  it('资料类型用显示名（历史/生成记录里存的是『📖 知识总结』）时，与 key 结果一致', () => {
    const key = composeDocTitle({ ...base, genType: 'summary', scopeInfo: labelScopeFinal, scopeType: 'final' }).title;
    const named = composeDocTitle({ ...base, genType: '📖 知识总结', scopeInfo: labelScopeFinal, scopeType: 'final' }).title;
    expect(named).toBe(key);
  });

  it('名称样式（用户固定选择）在教辅普通型标题里优先生效', () => {
    const { title } = composeDocTitle({ ...base, genType: 'summary', scopeInfo: labelScopeFinal, scopeType: 'final', labelStyle: '知识归纳' });
    expect(title).toBe('六年级语文上册期末知识归纳');
  });

  it('返回的 scopeName / typeLabel 与标题一致（指令侧共用同一份，不会两处漂移）', () => {
    const r = composeDocTitle({ ...base, genType: 'summary', scopeInfo: labelScopeFinal, scopeType: 'final' });
    expect(r.scopeName).toBe('期末');
    expect(r.typeLabel).toBe('知识梳理');
    expect(r.isExam).toBe(false);
    const e = composeDocTitle({ ...base, genType: 'exam', scopeInfo: labelScopeFinal, scopeType: 'final' });
    expect(e.isLabelScope).toBe(true);
    expect(e.semesterUsed).toBe('');
    expect(e.academic).toContain('学年度');
  });
});
