// 2026-09：卷面自洽总纲补位（⑪⑫）回归
// ⑪ 题干指示作答所用的线形/标记名加中文引号（用“波浪线”划出/“横线”画出），不以图形替换名称；
// ⑫ 写序号/字母入槽的作答位默认括号或横线，不默认用圈（○）槽（题干明说“圈/○里”才用圈并须真给 ○）。
// 题类格式经 QUESTION_FORMAT 注入，内容型（summary/preview）不走本块。
import { describe, it, expect } from 'vitest';
import { buildOutputFormatHint } from '../../src/config/promptLibrary.js';

describe('卷面自洽总纲 ⑪⑫（2026-09）', () => {
  it('题类格式：线形名加引号 + 序号入槽默认不用圈', () => {
    const q = buildOutputFormatHint({ subject: '语文', stage: 'primary_high', genType: 'practice' });
    expect(q).toContain('用“波浪线”划出');
    expect(q).toContain('用“横线”画出');
    expect(q).toContain('不默认用圈（○）槽');
    expect(q).toContain('仅题干明说“圈/○里”时用圈形空位并须真实给出 ○');
  });

  it('内容型格式不注入题类载体约束（防向梳理型广播）', () => {
    const c = buildOutputFormatHint({ subject: '语文', stage: 'primary_high', genType: 'summary' });
    expect(c).not.toContain('不默认用圈');
    expect(c).not.toContain('卷面自洽');
  });
});
