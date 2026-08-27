// 复现：auditExamPaper 是否弄丢答案区（日志证据：拼接后 hasAnswer:true → audit 后 hasAnswer:false）
import { describe, it, expect } from 'vitest';
import { auditExamPaper } from '../../src/utils/examValidator.js';

const base = [
  '<h1>语文二年级第二单元综合检测</h1>',
  '<h2>一、识字与写字（共6题，共32分）</h2>',
  '<p>1. 看拼音写词语。（2分）tiān kōng（　　　　）</p>',
  '<h2>二、积累与运用（共5题，共24分）</h2>',
  '<p>3. 默写古诗《静夜思》。（6分）＿＿＿＿＿＿＿＿＿＿＿＿</p>',
  '<h2>三、阅读与鉴赏（共4题，共14分）</h2>',
  '<p>7. 短文主要讲了什么？（3分）</p>',
  '<p>8. 你喜欢文中的谁？为什么？（4分）</p>',
  '<h2>四、表达与交流（共1题，共30分）</h2>',
  '<p>11. 看图写话。（15分）仔细观察图片，写一段话。</p>',
  '<p>[IMAGE]\nTYPE:SD\nPROMPT:春天公园植树\nWIDTH:800\nHEIGHT:600\nSTYLE:line_art\n[/IMAGE]</p>',
];

const answer = '<div class="answer-section"><h2>参考答案与评分标准</h2><p>1. 天空</p><p>3. 床前明月光，疑是地上霜。</p><p>7. 短文讲了……</p><p>8. 示例：喜欢文中的小明……</p><p>11. 示例：春天来了，两个小朋友在公园里植树。</p></div>';

const t1 = '<div class="answer-section"><h2>参考答案与评分标准</h2><p>1. 天空</p><table><tr><th>等第</th><th>标准</th></tr><tr><td>一类</td><td>内容切题语句通顺</td></tr><tr><td>0-8分</td><td>内容与图意不符表达混乱</td></tr></table><p>11. 示例：秋天来了，小朋友们在公园里。</p></div>';
const t2 = '<div class="answer-section"><h2>参考答案与评分标准</h2><p>1. 天空</p><table><tr><td>一类</td><td>内容切题</td></tr><tr><td>0-8分</td><td>内容与图意不符</td><p>11. 示例：秋天来了。</p></div>';
const t3 = [...base.slice(0, 7), '<p>5. 完成表格。（共3分）</p>', '<table><tr><td>字</td></tr><tr><td>诚</td>'].join('\n') + '\n</table>' + '\n' + '<div class="answer-section"><h2>参考答案</h2><p>1. 天空</p><table><tr><td>合格</td><td>9-12分</td></tr></table></div>';

const variants = {
  基线: base.join('\n') + '\n' + answer,
  正文末p未闭合: [...base.slice(0, -1), '<p>11. 看图写话。（15分）仔细观察图片，写一段话。'].join('\n') + '\n' + answer,
  IMAGE后未闭合div: [...base, '<div class="img-wrap"><p>配图说明'].join('\n') + '\n</div>' + answer,
  答案区前裸文本: base.join('\n') + '\n\n未闭合文本节点没有p包裹\n' + answer,
  IMAGE裸文本无p: [...base.slice(0, -1), '[IMAGE]\nTYPE:SD\nPROMPT:春天公园植树\n[/IMAGE]'].join('\n') + '\n' + answer,
  答案区含评分表格: base.join('\n') + '\n' + t1,
  答案区含未闭合表格: base.join('\n') + '\n' + t2,
  正文表格加答案区表格: t3,
};

describe('复现：auditExamPaper 答案区丢失（多组变体）', () => {
  for (const [name, html] of Object.entries(variants)) {
    it(`变体-${name}`, () => {
      const before = /answer-section/.test(html);
      const r = auditExamPaper(html, { subject: '语文', stage: 'primary_low', genType: 'exam' });
      const after = /answer-section/.test(r.html);
      console.log(`[repro] ${name}: before=${before} after=${after} len=${r.html.length} fixed=${r.fixed}`);
      expect(after).toBe(true);
    });
  }
});
