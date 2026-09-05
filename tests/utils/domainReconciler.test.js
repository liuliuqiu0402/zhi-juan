import { describe, it, expect } from 'vitest';
import { reconcileDomains, domainNoteOf } from '../../src/utils/domainReconciler.js';

/** 快捷构造锚：status 默认 literal（已绑定） */
const ax = (name, specificConcepts = [], bindStatus = 'literal') => ({
  name, specificConcepts, chapterTitle: '章', bind: { status: bindStatus },
});
const mk = (genType = 'exam', subject = '数学', content = '', anchors = []) =>
  reconcileDomains({ genType, subject, content, anchors });

describe('领域对账器：适用性判定', () => {
  it('非命题类型（practice）不校验，返回 null', () => {
    expect(mk('practice', '数学', '内容', [])).toBeNull();
  });
  it('未登记领域契约的学科不校验，返回 null', () => {
    expect(mk('exam', '劳动', '内容', [])).toBeNull();
  });
});

describe('领域对账器：多学科登记生效', () => {
  it('物理已登记领域定义；跨领域卷某领域缺位可检出', () => {
    const content = '本卷考查密度、浮力与电流。';
    const anchors = [ax('密度'), ax('浮力'), ax('电流')];
    const rep = reconcileDomains({ genType: 'exam', subject: '物理', content, anchors });
    expect(rep).not.toBeNull();
    expect(rep.required).toBe(true);
    expect(rep.missingDomains).toEqual(['跨学科实践']);
    expect(domainNoteOf(rep)).toContain('跨学科实践');
  });
});

describe('领域对账器：缺位检测', () => {
  it('多领域卷某领域缺位 → required 且列出缺位领域，note 非空', () => {
    const content = '本卷考查：分数的加减法、长方形的面积、可能性。';
    const anchors = [
      ax('分数的加减法'),     // 数与代数
      ax('长方形的面积'),     // 图形与几何
      ax('可能性'),           // 统计与概率
    ];
    const rep = mk('exam', '数学', content, anchors);
    expect(rep).not.toBeNull();
    expect(rep.required).toBe(true);
    expect(rep.missingDomains).toEqual(['综合与实践']);
    expect(domainNoteOf(rep)).toContain('综合与实践');
    expect(domainNoteOf(rep)).toContain('领域覆盖对账');
  });

  it('多领域全覆盖 → required、ok、无缺位、note 为空', () => {
    const content = '考分数的加减法、长方形的面积、可能性，并完成设计方案。';
    const anchors = [
      ax('分数的加减法'),
      ax('长方形的面积'),
      ax('可能性'),
      ax('设计方案'),
    ];
    const rep = mk('exam', '数学', content, anchors);
    expect(rep.required).toBe(true);
    expect(rep.ok).toBe(true);
    expect(rep.missingDomains).toEqual([]);
    expect(domainNoteOf(rep)).toBe('');
  });

  it('单领域单元卷（仅 1 领域命题）不做缺位判定，防误报', () => {
    const content = '仅考查分数的加减法。';
    const rep = mk('exam', '数学', content, [ax('分数的加减法')]);
    expect(rep.required).toBe(false);
    expect(rep.missingDomains).toEqual([]);
    expect(domainNoteOf(rep)).toBe('');
  });
});

describe('领域对账器：其它桶与分类', () => {
  it('不可归类考点进入其它桶，不硬套领域、不影响缺位判定', () => {
    const content = '考分数的加减法、长方形的面积，附一道思维拓展题。';
    const anchors = [
      ax('分数的加减法'),     // 数与代数
      ax('长方形的面积'),     // 图形与几何
      ax('思维拓展题'),       // 其他桶（无领域白名单命中）
    ];
    const rep = mk('exam', '数学', content, anchors);
    expect(rep.counts._other).toBe(1);
    expect(rep.missingDomains).toContain('统计与概率'); // 不缺报、不因其它桶误判
    expect(rep.missingDomains).toContain('综合与实践');
  });

  it('语文按四类实践活动归类；长词组考点的领域白名单词干可命中', () => {
    const content = '本卷考查生字书写、阅读鉴赏、习作表达与分类整理。';
    const anchors = [
      ax('生字书写'),         // 识字与写字
      ax('阅读鉴赏'),         // 阅读与鉴赏
      ax('习作表达'),         // 表达与交流
      ax('分类整理'),         // 梳理与探究
    ];
    const rep = reconcileDomains({ genType: 'exam', subject: '语文', content, anchors });
    expect(rep.presentDomains).toEqual(expect.arrayContaining(['识字与写字', '阅读与鉴赏', '表达与交流', '梳理与探究']));
    expect(rep.ok).toBe(true);
  });
});