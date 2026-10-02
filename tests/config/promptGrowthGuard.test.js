// 🔒 指令"只增不扩"守卫（2026-09-30 用户裁定：# 一条要求越长越难被遵守，段越长越会被跳过）
// ============================================================
// 背景：修复史审计发现"每发现一个缺陷，就在原句上再加一层定语/括注"→ 单条越滚越长（实测最长单条 2073 字），
//   叠加"覆盖式改写"（旧句有效内容被新句盖掉）→ 恶性循环。
// 本守卫先**止住增长**（不改任何内容、不缩任何条款），锁三件事：
//   ① 单条字数上限（= 当前基线，只减不增）；
//   ② 同义判据的"条数指纹"（同一判据跨多条各写一遍的处数，只减不增）；
//   ③ 声明↔实给单源句仍是一定义两消费（防再次被覆盖式改写）。
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { getPromptTemplate, DECLARATION_TRUTH_CLAUSE } from '../../src/config/promptLibrary.js';

const ROOT = path.resolve(__dirname, '../..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const tpl = (g, s = '语文', st = 'primary_low') => getPromptTemplate({ grade: st, subject: s, genType: g }).template;

/** 单条上限（字数）——基线取 2026-09-30 实测最长条（题目自洽①–⑰，2073 字），留 6% 余量；只减不增 */
const MAX_CLAUSE_CHARS = 2200;
/** 同义判据指纹上限：关键词（按正则判，防子串误命中，如「同一题」不得命中「同一题号」）→ 允许出现的"条"数上限
 *  🔴 2026-10-01（结构清晰·口径区分）：本指纹计"**含该关键词的条数**"——它同时罩住两件事：
 *    ① **同一判据跨多条重复表述**（要收口，本指纹的主 targets）；② **同一主题的分点拆解**（大级／小级／例外／序号
 *    各一条，是**不同的事**，属结构清晰、不是同义多套）。用户 2026-10-01 定"结构清晰"后，②会正当抬高计数，
 *    故「分值」5→6（分值现分 4 条 + 另有 2 条提及）；判①仍靠 ①②两条 + intraRequestDuplicate 台账管。 */
const DUP_BUDGET = { 分值: 7, 同性质: 5, '同一题(?!号)': 4, 逐题: 4, 账目: 3, 书写载体: 3, 不得省略: 2, 自查: 2 };

// 🔴 2026-10-01（结构清晰·度量改准）：原只把 `\n·` / `\n【` 认作"条"——于是【题目自洽①–⑰】
//    （17 项**逐行编号**）被算作**一条 2073 字**（假象）。现把 `\n①–⑳` 也认作条界，使度量与
//    "每条可独立核对"一致（该块真实的最长条 ~250 字，远低于上限）。
const clausesOf = (t) => t.split(/\n(?=·|【|①|②|③|④|⑤|⑥|⑦|⑧|⑨|⑩|⑪|⑫|⑬|⑭|⑮|⑯|⑰|⑱|⑲|⑳)/).map((s) => s.trim()).filter((s) => s.length > 12);

describe('指令"只增不扩"守卫（止住越滚越长）', () => {
  it('总字数只减不增（条数不设上限——拆"一条多事"正是要的结构清晰）', () => {
    // 🔴 2026-10-01（重洗牌·度量改准 + 结构拆分）：计数器把 `\n①–⑳` 也认作条（【题目自洽①–⑰】的 17 项本就逐行独立）。
    // 🔴 2026-10-02（逐条复核·B1–B5）：exam 导语删与【任务】行重复的括注、创作要求 1 删失指向括注、【卷面结构】说明移为块内首条、
    //    "共X题"拆出、exam 创作要求条 7 拆为 7/8/9 → 总字数继续下调（9277/10133）。
    // 🔴 2026-10-02（用户裁定·**取消条数上限**）：条数不是质量指标——"一条多事"拆成两条各说一事，正是本次要的**结构清晰**，
    //    卡条数会把拆分当成"增长"而挡住。真正的闸门是**总字数**（守卫本意"一条越长越难遵守/段越长越被跳过"由字数管），
    //    且**只减不增**：拆分若同时加字，会在总字数上被抓；只拆不加字 → 放行。单条字数上限另由下一用例管。
    // 🔴 2026-10-02（遗留问题·质量底线解锁重写 + 题目自洽①拆出）：【质量底线】9 条→16 条（同义半句合并、元话语删）、
    //    题目自洽① 从块标题行拆出 → 条数 83→90（不再受条数管），**总字数 9277→9090 / 10133→9946（继续下调）**。
    const cap = { 'exam|语文': 9090, 'exam|数学': 9946 };
    const over = [];
    for (const [k, n0] of Object.entries(cap)) {
      const [g, s] = k.split('|');
      const items = clausesOf(tpl(g, s));
      const n = items.reduce((a, x) => a + x.length, 0);
      if (n > n0) over.push(`${k} 总字数 ${n} > ${n0}`);
    }
    expect(over, '新增条款必须同时删/并旧条（总字数只减不增）').toEqual([]);
  });

  it('单条字数不得超过基线（只减不增）', () => {
    const bad = [];
    for (const g of ['exam', 'practice', 'summary', 'preview', 'reading', 'dictation', 'errorbook', 'review', 'special']) {
      for (const cl of clausesOf(tpl(g))) if (cl.length > MAX_CLAUSE_CHARS) bad.push(`${g}: ${cl.length} 字 → ${cl.slice(0, 24)}`);
    }
    expect(bad.slice(0, 5), `以下单条超上限（${MAX_CLAUSE_CHARS} 字）`).toEqual([]);
  });

  it('同义判据的条数指纹不得增加（同一判据跨多条各写一遍 = 同义多套）', () => {
    const items = clausesOf(tpl('exam'));
    const over = [];
    for (const [k, cap] of Object.entries(DUP_BUDGET)) {
      const re = new RegExp(k);
      const n = items.filter((x) => re.test(x)).length;
      if (n > cap) over.push(`「${k}」${n} 条 > 上限 ${cap}`);
    }
    expect(over, '同义判据条数增加（新增即需收口或走单源）').toEqual([]);
  });

  it('声明↔实给单源句不被覆盖式改写：一定义两消费，且旧实例仍在', () => {
    const lib = read('src/config/promptLibrary.js');
    expect((lib.match(/export const DECLARATION_TRUTH_CLAUSE/g) || []).length).toBe(1);
    expect((lib.match(/DECLARATION_TRUTH_CLAUSE/g) || []).length).toBe(3);
    expect(DECLARATION_TRUTH_CLAUSE, '旧句实例不得被新句盖掉').toContain('拼音、首字母、提示词、图、表、数据、待选项');
  });
});
