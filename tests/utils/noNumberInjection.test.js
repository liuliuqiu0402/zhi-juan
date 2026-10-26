// 程序侧不新增"小题号／小题标题"（2026-10-19 属主："这种的下面还会增加小题号标题、或者增加小题号吗？"）
// ============================================================
// 背景：口算/竖式这类**无题号**大题，标题已带单价（每式X分，共Y分），其下直接排算式。
//   程序侧曾有过"缺号拦截/回灌/重试"，2026-10-10 已整块删除（useAiGenerator 注释在册）。
//   本文件把"程序不得新增题号/标题"固化为回归：
//     ① 合规输入（无题号）→ 走 normalizeBodyHtml ＋ auditExamPaper 后，仍**没有任何以数字开头的段落**；
//     ② 大题标题数量不变（不新增 h3/h4）；
//     ③ 病态输入（已有一条带号要求行）→ 程序**不加重、也不替你删**（条数保持不变）。
// ============================================================
import { describe, it, expect } from 'vitest';
import { auditExamPaper } from '../../src/utils/examValidator.js';
import { normalizeBodyHtml } from '../../src/utils/contentCleaner.js';
import { getPromptTemplate } from '../../src/config/promptLibrary.js';

const run = (h) => auditExamPaper(h, { subject: '数学', stage: 'primary_mid', genType: 'exam' }).html;
const pTexts = (h) => [...h.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)]
  .map((m) => m[1].replace(/<[^>]+>/g, '').replace(/&emsp;|&nbsp;/g, ' ').trim());
const numbered = (h) => pTexts(h).filter((t) => /^\d{1,2}\s*[.、．]/.test(t));
const heads = (h) => [...h.matchAll(/<h[2-4]>([\s\S]*?)<\/h[2-4]>/g)].map((m) => m[1]);

const OK = [
  '<h1>阶段测评</h1>',
  '<h3>一、直接写出得数（每式1分，共20分）</h3>',
  '<p>4×2＝____　5×3＝____</p>',
  '<p>6×6＝____　4×5＝____</p>',
  '<h3>二、列竖式计算（每式3分，共12分）</h3>',
  '<p>34＋25＝____　48－16＝____</p>',
  '<p>27＋35＝____　63－28＝____</p>',
].join('\n');

describe('程序侧不得新增小题号/小题标题', () => {
  it('合规输入：normalize 后仍无任何以数字开头的段落', () => {
    expect(numbered(normalizeBodyHtml(OK))).toEqual([]);
  });

  it('合规输入：audit 后仍无任何以数字开头的段落、标题数不变', () => {
    const out = run(OK);
    expect(numbered(out), '不得冒出"1. 直接写出得数"这类行').toEqual([]);
    expect(heads(out), '不得新增小题标题').toEqual(heads(OK));
  });

  it('合规输入：算式原文不被改动', () => {
    const out = run(OK);
    for (const s of ['4×2', '5×3', '6×6', '4×5', '34＋25', '48－16', '27＋35', '63－28']) {
      expect(out, `算式 ${s} 应原样保留`).toContain(s);
    }
  });

  it('病态输入（已有一条带号要求行）：程序不加重、也不替你删', () => {
    const bad = [
      '<h1>阶段测评</h1>',
      '<h3>一、直接写出得数（共20分）</h3>',
      '<p>1. 直接写出得数。（每式1分，共20分）</p>',
      '<p>4×2＝____　5×3＝____</p>',
    ].join('\n');
    const out = run(bad);
    expect(numbered(out).length, '条数保持 1：不新增第二行').toBe(1);
    expect(numbered(out)[0], '原行原样保留（程序不改正文）').toContain('直接写出得数');
  });

  // 🔴 2026-10-23（属主基准·撤第二把尺）：原锁"并列的同类作答项／其下不再另起题号与题干行"两句已随第二套
  //   判据删除；结果不变、判据换源——无成句 ⇒ 整组只按一种情况写不成立 ⇒ 不编号 ⇒ 不写小题号、其下不得出现任何题号。
  it('A 侧条款（两学段）：无题号大题不补题号、不补题干', () => {
    for (const stage of ['primary_low', 'middle']) {
      const t = getPromptTemplate({ grade: stage, subject: '数学', genType: 'exam' }).template;
      // 🔴 2026-10-24（属主："不要人为干预模型的能力"）："不得为凑总分编题"已删——
      //   防"分值倒推编号"由编号判据承载（编号只看有没有只属于它自己的题干话）。
      expect(t, `${stage}：分值不许成为补号的理由（判据在位）`).toContain('还有没有自己的话');
      expect(t, `${stage}："不得为凑总分编题"不得回潮`).not.toContain('不得为凑总分编题');
      expect(t, `${stage}：不编号 ⇒ 不写小题号`).toContain('每一项只有被作答的东西本身');
      expect(t, `${stage}：不许只有号没有分，也不许没有号却在题内标分`).toContain('不许只有号没有分，也不许没有号却在题内标分');
    }
  });
});
