// ============================================================
// 窄单元可用性守卫（2026-10-12 增 · 来源＝**属主场景质询**）
// ------------------------------------------------------------
// 属主问："小学低段某单元学的是 1–6 的乘法，按「卷内算式唯一性」这条，还能生成一份高质量的试卷吗？"
// 核证结论：**按原文不能**。原文判准是"同一算式（**同数值同运算**）不得在 ≥2 题复现"＝**形式判据**；
//   而母判据【质量底线】`内容唯一性`（2026-10-11 收敛）为"**两处可互相替代才算重复**"＋常态正向声明
//   "同型多题／同一知识点多题／同一材料多题共用属**正规做法**" ⇒ **子条比母判据严**，窄单元上必然误伤：
//   1–6 的乘法算式空间仅 6×6＝36 个、一份卷口算即 20 题 ⇒ 字面读**正常卷出不来**（＝与母判据正向声明相抵，S2 类）。
// ⇒ 已改回母判据口径（"可互相替代"＋"同型多题、同点训练的连续小题属正常并列"）。
// 本守卫：正向锁＋反向锁（防回潮），遍历 数/理/化/地 × 4 学段 × exam/practice。
// ============================================================
import { describe, it, expect } from 'vitest';
import { getPromptTemplate } from '../../src/config/promptLibrary.js';

const KEY = '卷内算式唯一性';
const SUBJECTS = ['数学', '物理', '化学', '地理'];
const STAGES = ['primary_low', 'primary_high', 'middle', 'high'];
const TYPES = ['exam', 'practice'];

const CASES = [];
for (const subject of SUBJECTS) {
  for (const grade of STAGES) {
    for (const genType of TYPES) {
      const tx = getPromptTemplate({ grade, subject, genType }).template || '';
      if (tx.includes(KEY)) CASES.push({ id: `${genType}|${subject}|${grade}`, tx });
    }
  }
}

describe('窄单元可用性：卷内算式唯一性须以"可互相替代"为判准（不得退化为"同数值同运算即禁"）', () => {
  it('扫描面非空（该条须真注入 数/理/化/地 的卷与练习）', () => {
    expect(CASES.length, '该条未在预期面出现 ⇒ 扫描面失效').toBeGreaterThanOrEqual(8);
  });

  it('正向锁：以"可互相替代"为判准 ＋ 明列同点训练属正常并列（窄单元可出卷）', () => {
    for (const { id, tx } of CASES) {
      expect(tx, `${id}：判准须回到母判据"两处可互相替代"`).toMatch(/以"?两处可互相替代"?判/);
      expect(tx, `${id}：须明列"同型多题/同点训练属正常并列"`).toContain('属正常并列');
    }
  });

  it('反向锁：旧形式判据（同数值同运算即禁）不得回潮', () => {
    for (const { id, tx } of CASES) {
      expect(tx, `${id}：旧形式判据回潮 ⇒ 窄单元正常卷又会被压掉`).not.toContain('同一算式（同数值同运算）');
    }
  });
});
