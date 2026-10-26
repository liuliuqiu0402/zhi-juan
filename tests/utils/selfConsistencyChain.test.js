// 三处"一直在循环"的自洽链回归（2026-10-19 属主：标题声称看图而题内是文字、大标题下又出带号说明行、操作题一律补方格纸）
// ============================================================
// 属主判据："蓝图结构只是参考，具体结构是根据勾选的教材内容来，不是不可以改的——要的是内容自洽。"
// 三处现象的同一根因：**"结构/要求注"被写成硬约束，压过了"与实际内容相符"**——
//   ① 要求注写"图片提示" ⇒ 模型必须声称有图（哪怕实际给的是文字提示）；
//   ② "作图类题用方格纸" ⇒ 凡操作题一律挂方格纸（不管这道题要不要在方格上画）；
//   ③ "共用一条作答要求⇒不编号" ⇒ 判断题10小题不编号，模型改把**大题本身**编成一个号（9.）去承载单价。
// 处置一律改**判据式**（按内容判），并把结构/要求注降为**参考**；本文件锁住这三条与 B 侧边界。
import { describe, it, expect } from 'vitest';
import { getPromptTemplate, QUESTION_OBJECT_CALIBER, ANSWER_STEM_CALIBER, buildStructureText } from '../../src/config/promptLibrary.js';
import { buildCarrierInstruction } from '../../src/config/layoutSpec.js';
import { auditExamPaper } from '../../src/utils/examValidator.js';

const tpl = (st = 'primary_low', sj = '语文') => getPromptTemplate({ grade: st, subject: sj, genType: 'exam' }).template;
const run = (h, subject = '数学') => auditExamPaper(h, { subject, stage: 'primary_mid', genType: 'exam' }).html;
const pTexts = (h) => [...h.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)]
  .map((m) => m[1].replace(/<[^>]+>/g, '').replace(/&emsp;|&nbsp;/g, ' ').trim());
const numbered = (h) => pTexts(h).filter((t) => /^\d{1,2}\s*[.、．]/.test(t));

describe('① 标题声称的提示形态必须与题内一致——结构/要求注只是参考', () => {
  it('A 侧：结构块把"板块/分值/要求里的呈现形态"都降为参考，并给"按等效形态落实、标题随实际"的出口', () => {
    for (const [st, sj] of [['primary_low', '语文'], ['primary_mid', '数学'], ['middle', '英语']]) {
      const t = tpl(st, sj);
      expect(t, `${st}|${sj}：要求注的呈现形态也只是参考`).toContain('行内每条要求注写到的呈现形态都只是参考');
      expect(t, `${st}|${sj}：给不出该形态时按等效形态落实`).toContain('按等效形态落实、标题随实际形态写');
      expect(t, `${st}|${sj}：不得为贴合结构硬凑题`).toContain('不得为贴合结构硬凑题');
    }
  });

  it('A 侧：标题里写到的提示方式必须是题内真实给出的那一种（反向锁：允许改结构/改题型）', () => {
    const t = tpl('primary_low', '英语');
    expect(t).toContain('标题里写到的提示方式，必须是题内真实给出的那一种');
    // 结构可改的出口必须在：板块可增可减可换（不是"必须照蓝图一字不改"）
    expect(t).toContain('板块构成、所标分值、行内每条要求注写到的呈现形态都只是参考、可增可减可换');
  });

  it('注入侧：结构行仍逐行带【要求·须逐项落实】（降为参考不等于删要求）', () => {
    const bp = { key: '英语|primary_low', stage: 'primary_low', sections: [{ name: '笔试·看图连线', score: 10, note: '单词与图片连线' }] };
    const s = buildStructureText(bp);
    expect(s, '要求注仍在（否则课标要求会丢）').toContain('【要求·须逐项落实】');
    expect(s, '参考分值仍在').toContain('参考分值');
  });
});

describe('② 大题标题已写全时，其下不得再出现带号说明行（判断题组各自编号）', () => {
  // 🔴 2026-10-26（属主定稿·**换结构事实**）：本条原锁"共用一条作答要求 ⇒ 不编号"（语义判定），
  //   它正是 ③ 号事故的根。现在判据只剩一件可数的事：这一大题下有几个独立成 <p class="question"> 的题干。
  //   判断题 10 小题**各自独立成题干** ⇒ 多题干大题 ⇒ 各自给号、各自标分。
  it('A 侧：判据＝数独立题干——每项各自成题干的，即使作答动作相同也各给号', () => {
    expect(ANSWER_STEM_CALIBER, '结构判定').toContain('遮住大题标题、单看其中一项');
    expect(ANSWER_STEM_CALIBER, '≥2 个 ⇒ 多题干').toContain('多题干大题');
    expect(QUESTION_OBJECT_CALIBER, '第二把尺（共用一条作答要求）不得回潮').not.toMatch(/共用一条作答要求|各自有独立题干/);
    // 零题型名（防定形诱导）
    expect(ANSWER_STEM_CALIBER).not.toMatch(/判断|选择|填空|口算|竖式|连线/);
  });

  it('A 侧（两学段）：标题条仍禁"把作答要求写成带号题干"，防止再长出一条小标题', () => {
    for (const st of ['primary_low', 'middle']) {
      const t = tpl(st, '数学');
      expect(t, `${st}：要求不得写成带号题干`).toContain('不得把这条要求写成带题号的题干');
      expect(t, `${st}：大题标题就是这一组的作答要求（不得再造一条组内题干）`).toContain('大题标题就是这一组的作答要求');
    }
  });

  it('B 侧：判别题按 A1 写（标题共X分 + 每道带号题标分）→ B 合成为真题单价，且不新增任何行', () => {
    const html = [
      '<h1>阶段测评</h1>',
      '<h3>四、判断对错，对的画“√”，错的画“×”（共10分）</h3>',
      '<p>1. 3×4与4×3的得数相同。（2分）</p>',
      '<p>2. 两个数相乘，交换位置得数不变。（2分）</p>',
      '<p>3. 6＋6＋6写成乘法算式是6×3。（2分）</p>',
      '<p>4. 5×2和2×5的得数不同。（2分）</p>',
      '<p>5. 任何数与1相乘都得原数。（2分）</p>',
    ].join('\n');
    const out = run(html);
    expect(numbered(out).length, '带号题仍是 5 道，不多不少').toBe(5);
    expect(pTexts(out).some((t) => /^\d+[.、]\s*判断对错/.test(t)), '不得多出"9. 判断对错…"这类带号说明行').toBe(false);
    const head = [...out.matchAll(/<h3>([\s\S]*?)<\/h3>/g)][0][1];
    expect(head, 'B 把逐题标分合成为真题单价').toMatch(/每题2分，共10分/);
  });
});

describe('③ 方格纸按"要不要在方格上作图"给，不按"是不是操作题"给', () => {
  it('A 侧：载体条款是判据式（要学生在方格上作图才给；图已在题面的，作答位就是那张图）', () => {
    for (const st of ['primary_low', 'primary_mid', 'primary_high', 'middle', 'high']) {
      const c = buildCarrierInstruction('数学', st);
      expect(c, `${st}：判据式在位`).toContain('要学生在方格上作图');
      expect(c, `${st}：题面已给图的不再挂方格纸`).toContain('作答位就是那张图');
      expect(c, `${st}：旧"作图类题一律给方格纸"不得回潮`).not.toContain('作图类题用方格纸');
    }
    expect(buildCarrierInstruction('语文', 'primary_low'), '非数学不注入方格纸').not.toContain('square-grid');
  });

  it('B 侧：方格纸只在题面点名"在方格上作答"时兜底补，普通操作题不补', () => {
    const plain = [
      '<h1>阶段测评</h1>',
      '<h3>五、操作题（共6分）</h3>',
      '<p>1. 量一量课桌的长，填在横线上。____（3分）</p>',
      '<p>2. 用尺子量出数学书的宽，填在横线上。____（3分）</p>',
    ].join('\n');
    expect(run(plain), '题面没点名方格，不得补方格纸').not.toContain('square-grid');

    const onGrid = [
      '<h1>阶段测评</h1>',
      '<h3>五、操作题（共3分）</h3>',
      '<p>1. 在下面的方格图中画一个长3厘米、宽2厘米的长方形。（3分）</p>',
    ].join('\n');
    expect(run(onGrid), '题面点名在方格图中画、而题内没给方格 → 程序按需兜底').toContain('square-grid');
  });
});
