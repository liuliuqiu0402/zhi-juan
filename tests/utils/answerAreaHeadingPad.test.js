// 容器/章节标题后不再补作答空白（2026-09 空行泛滥根治）
// 根因：answer-area-fix 把"紧跟下一标题、中间无编号题、seg 为空"的 h2 容器标题误判为
//   无分值长答块，用 NO_SCORE_ROWS=4 在其后补 4 行 blank-area；标题是结构锚，各题由各自标题
//   块补齐。注：标题剥除端不再一刀切删 blank-area（带 class+height 是真实作答载体，误删丢答题位）。
import { describe, it, expect } from 'vitest';
import { auditExamPaper } from '../../src/utils/examValidator.js';

const OPTS = { subject: '数学', stage: 'primary_high', genType: 'practice' };

describe('容器/章节标题后不补作答空白（空行泛滥根治）', () => {
  it('h2 任务容器紧跟 h3、中间无编号题时，不把标题当长答块补空白', () => {
    const html = [
      '<h1>随堂巩固</h1>',
      '<h2>基础建构任务</h2>',
      '<h3>一、理解小数乘除法的意义</h3>',
      '<p>1. 填一填。</p>',
      '<p>（1）<u class="blank-4">&emsp;</u></p>',
      '<h2>探究进阶任务</h2>',
      '<h3>五、积与商的变化规律</h3>',
      '<p>5. 选择。</p>',
      '<p>（1）（　　　　）</p>',
    ].join('\n');
    const { html: out } = auditExamPaper(html, OPTS);
    // 标题之后直接 h3，不得插入 blank-area（空行泛滥根因：h2 不再被当空 seg 长答块补差）
    expect(out).toContain('<h2>基础建构任务</h2>\n<h3>一、理解小数乘除法的意义</h3>');
    expect(out).toContain('<h2>探究进阶任务</h2>\n<h3>五、积与商的变化规律</h3>');
    expect(out).not.toContain('blank-area');
  });

  it('书面表达等真实长答块（题干非空、seg 非空）仍正常补差，不误伤', () => {
    const html = [
      '<h2>书面表达</h2>',
      '<p>根据提示写一篇关于秋天的日记。</p>',
    ].join('\n');
    const { html: out } = auditExamPaper(html, OPTS);
    // 数学·高段 default blank-area 载体：长答块正常补差
    expect(out).toContain('blank-area');
  });
});