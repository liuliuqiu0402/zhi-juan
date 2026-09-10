// 🔴 2026-09-10 跨栏作答行传染根治·回归测试（英语卷实证）：
//   作答空间补差按栏逐块统计"有效作答行"——整栏最后一块的 seg 曾无界（边界兜底 null），
//   吞掉后续栏内容 → 下一栏的空白行被计入本块 → "该补不补"（写作题 11/12 无横线；
//   下一栏 13 的 8 行空白被 11/12 块各计一次）。修复：末块边界兜底栏边界（end）。
import { describe, it, expect } from 'vitest';
import { auditExamPaper } from '../../src/utils/examValidator.js';

const BL = '<p><span class="blank-line">&emsp;</span></p>';
const RUN = (html) => auditExamPaper(html, { subject: '英语', stage: 'primary_high', genType: 'practice' });

const FULL = `
<h3>九、阅读理解</h3>
<p class="question">9. 阅读下面的短文，判断下列句子是否与短文内容相符，相符的在括号里写“√”，不相符的写“×”。</p>
<p class="question">Long ago, a snail wanted to climb a tall tree.</p>
${BL}
${BL}
<p class="question">(1) The snail wanted to climb a tall tree. <span class="blank-2">&emsp;</span></p>
<p class="question">(2) The snail was very fast. <span class="blank-2">&emsp;</span></p>
<h3>十一、讲一讲自己的经历</h3>
<p class="question">11. 请用一般过去时写一段话，讲述你曾经克服困难、完成一件事的经历。不少于 5 句话。</p>
<h2>实践挑战</h2>
<h3>十二、给朋友写一封鼓励信</h3>
<p class="question">12. 你的朋友 Mike 下周要参加英语演讲比赛，请你给他写一封简短的英文信，不少于 5 句话。</p>
<h3>十三、小组交流：我最棒的一次经历</h3>
<p class="question">13. 在小组内用英语说一说你曾经做得最好的一件事。</p>
${BL.repeat(8)}
<p class="question">提示词：afraid, practise, remember, forget, finally</p>
`;

describe('作答空间补差·跨栏不传染（2026-09-10 根治回归）', () => {
  it('写作题各栏独立补差：11/12 各补 4 行，13 维持自有 8 行不动', () => {
    const { html: out, issues } = RUN(FULL);
    const cnt = (seg) => (seg.match(/blank-line/g) || []).length;
    const i9 = out.indexOf('9.'), i11 = out.indexOf('11.'), i12 = out.indexOf('12.'), i13 = out.indexOf('13.');
    expect(cnt(out.slice(i11, i12))).toBe(4);  // 11 栏：无作答行 → 兜底补 4 行（不得被 13 栏行数传染）
    expect(cnt(out.slice(i12, i13))).toBe(4);  // 12 栏：同上
    expect(cnt(out.slice(i13))).toBe(8);       // 13 栏：模型已有 8 行 → 不补
    // 9 栏（判断题）：audit 对已有横线不增不减（若后续做"判断题剥横线"专项，此断言同步为 0——
    // 2026-09-10 晚已加生成侧源头条款：layoutSpec「判断/选择/圈选类题…不另附长横线作答区」；程序侧剥除专项仍待做）
    expect(cnt(out.slice(i9, i11))).toBe(2);
    const msgs = (issues || []).map((i) => String(i.message || ''));
    expect(msgs.some((m) => m.includes('「十一、') && m.includes('已补作答空间'))).toBe(true);
    expect(msgs.some((m) => m.includes('「十二、') && m.includes('已补作答空间'))).toBe(true);
  });

  it('单栏独立场景不受影响（末块边界=文档尾时照常判定）', () => {
    const one = `<h3>十一、讲一讲自己的经历</h3><p class="question">11. 请用一般过去时写一段话。</p>`;
    const { html: out } = RUN(one);
    expect((out.match(/blank-line/g) || []).length).toBe(4);
  });
});
