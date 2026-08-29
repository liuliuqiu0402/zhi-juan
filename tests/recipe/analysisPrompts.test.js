// 教材分析 Prompt 学科参数化 + 示例通用化 测试
// ============================================================
// 🔴 目的：锁定"分析阶段注入内容按学科、示例无跨学科广播"的契约——
//    - 规范类示例（强制规则/难度规则/错误示例）通用化，无语文/数学专属示例词
//    - 模板示例按学科选择：语文→语文示例、数学→数学示例、其他学科→通用示例
//    - 不传 subject 时返回全部（兼容旧调用）
// ============================================================
import { describe, it, expect } from 'vitest';
import { getAnalysisPrompts } from '@/config/analysisPrompts.js';

const byId = (list, idPart) => list.find(b => b.id.includes(idPart));

describe('分析规范类示例通用化（无跨学科示例词）', () => {
  it('强制规则 full 版无语文示例词（语段/看拼音/语文与生活/关联词）', () => {
    const p = byId(getAnalysisPrompts({ category: '分析-文本分析规范' }), 'mandatory_rules_full');
    expect(p).toBeTruthy();
    for (const w of ['语段', '看拼音', '语文与生活', '关联词', '阅读理解']) {
      expect(p.content).not.toContain(w);
    }
    expect(p.content).toContain('一、按要求完成下面各题');
    expect(p.content).toContain('三、生活与运用');
  });
  it('强制规则 compact 版同样无语文示例词', () => {
    const p = byId(getAnalysisPrompts({ category: '分析-文本分析规范' }), 'mandatory_rules_compact');
    for (const w of ['语段', '看拼音', '语文与生活']) {
      expect(p.content).not.toContain(w);
    }
    expect(p.content).toContain('在横线上写出合适的词语');
  });
  it('难度规则 full 版无语文/具体文本示例（看拼音/描写方法/袁隆平/赏析句子）', () => {
    const p = byId(getAnalysisPrompts({ category: '分析-文本分析规范' }), 'difficulty_rules_full');
    for (const w of ['看拼音', '描写方法', '袁隆平', '赏析句子的表达效果', '词语解释']) {
      expect(p.content).not.toContain(w);
    }
    expect(p.content).toContain('字词识记');
    expect(p.content).toContain('概括材料的主要内容');
  });
  it('难度规则 compact 版同样无语文示例词', () => {
    const p = byId(getAnalysisPrompts({ category: '分析-文本分析规范' }), 'difficulty_rules_compact');
    for (const w of ['看拼音', '描写方法', '赏析句子']) {
      expect(p.content).not.toContain(w);
    }
  });
  it('错误示例无语文示例词', () => {
    const p = byId(getAnalysisPrompts({ category: '分析-分析模板示例' }), 'error_examples');
    for (const w of ['语段', '阅读理解', '短文填空']) {
      expect(p.content).not.toContain(w);
    }
    expect(p.content).toContain('在横线上写出合适的词语');
  });
});

describe('模板示例按学科选择', () => {
  const pickExample = (subject) => {
    const list = getAnalysisPrompts({ category: '分析-分析模板示例', subject });
    return list.find(b => b.id.includes('examples_full') || b.id.includes('examples_math') || b.id.includes('examples_generic'));
  };
  it('语文 → 语文整卷示例（语文与生活/习作）', () => {
    const p = pickExample('语文');
    expect(p.id).toContain('examples_full');
    expect(p.content).toContain('小学语文');
    expect(p.content).toContain('六、习作');
  });
  it('数学 → 数学专项示例（计算能力训练），不含语文示例', () => {
    const p = pickExample('数学');
    expect(p.id).toContain('examples_math');
    expect(p.content).toContain('计算能力训练');
    for (const w of ['语文与生活', '习作', '语段']) {
      expect(p.content).not.toContain(w);
    }
  });
  it('物理等其他学科 → 通用示例（无学科词）', () => {
    const p = pickExample('物理');
    expect(p.id).toContain('examples_generic');
    for (const w of ['小学语文', '计算能力训练', '习作', '语段', '语文与生活', '得数']) {
      expect(p.content).not.toContain(w);
    }
    expect(p.content).toContain('单元综合测试卷');
  });
  it('通用示例结构完整（大题/设问风格/提取结果）', () => {
    const p = pickExample('物理');
    expect(p.content).toContain('大题');
    expect(p.content).toContain('设问风格');
    expect(p.content).toContain('提取结果');
  });
  it('不传 subject 时返回全部条目（兼容旧调用）', () => {
    const list = getAnalysisPrompts({ category: '分析-分析模板示例' });
    expect(list.length).toBe(4); // 语文示例 + 通用示例 + 数学示例 + 错误示例
  });
});
