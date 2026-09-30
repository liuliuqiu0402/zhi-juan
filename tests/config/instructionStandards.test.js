// 🔒 指令改动标准守卫（2026-09-30 用户裁定：把这一路的要求固化成标准；没做到就让测试变红）
// ============================================================
// 与另外两个守卫的分工：
//   · promptGrowthGuard —— 体量纪律（单条上限 / 同义指纹上限 / 新增必须换旧的总量）
//   · caliberSingleSource —— 判据级"唯一出现"（每判据一处正句，其余只能引用）
//   · 本文件 —— 措辞纪律（诱导词）+ 单源完整性；**标准全文见 docs/design/指令改动标准-可机检清单.md**
// 口径：能硬断言的直接硬断言（违反即红）；尚未达标的先锁基线（不得恶化），并在文档中标"待达标"。
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { getPromptTemplate, DECLARATION_TRUTH_CLAUSE, QUESTION_OBJECT_CALIBER } from '../../src/config/promptLibrary.js';

const ROOT = path.resolve(__dirname, '../..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const tpl = (g = 'exam', s = '语文', st = 'primary_low') => getPromptTemplate({ grade: st, subject: s, genType: g }).template;

/** 代劳主语：把"该模型产出的东西"的主语写成系统/程序（免责令模型"不用我管"） */
const DELEGATE_RE = /由(系统|程序)[^。；\n]{0,12}(注入|渲染|拼装|生成|呈现|配置)/g;

describe('标准·措辞纪律（诱导词）', () => {
  it('S1 蓝图 note 零代劳主语（模型必须产出的东西不得写成"由系统做"）', () => {
    const bad = [];
    for (const f of ['src/config/examPaperBlueprints.js', 'src/config/teachingBlueprints.js']) {
      const src = read(f);
      for (const m of src.match(DELEGATE_RE) || []) bad.push(`${f}: ${m}`);
    }
    expect(bad, '代劳主语（＝指向性诱导）：模型侧产出被写成系统/程序来做').toEqual([]);
  });

  it('S2 载体与作答位条款内零许可语气（允许/可不/可自行）——防"给自选余地"', () => {
    const bad = [];
    for (const s of ['语文', '数学', '英语', '物理', '历史']) {
      const t = tpl('exam', s);
      for (const cl of t.split(/\n(?=·|【)/)) {
        if (!/作答位|空位|书写载体|书写格/.test(cl)) continue;
        // 排除"否定式"合法出现（如"不存在'允许的形态清单'"——这是禁止清单、不是给自选余地）
        const probe = cl.replace(/不存在["“]允许[^"”]*["”]/g, '');
        const m = probe.match(/(允许|可不|可自行|自行选定|由你自)/g);
        if (m) bad.push(`${s}: ${[...new Set(m)].join('/')} ← ${cl.slice(0, 40)}`);
      }
    }
    expect(bad, '载体/作答位条款出现许可语气（应改判据式陈述）').toEqual([]);
  });

  it('S3 载体与作答位条款内零举例式枚举（"如…"把方向钉死）', () => {
    const bad = [];
    for (const s of ['语文', '数学', '英语']) {
      const t = tpl('exam', s);
      for (const cl of t.split(/\n(?=·|【)/)) {
        if (!/作答位形态|书写载体|空位形态/.test(cl)) continue;
        if (/例如/.test(cl)) bad.push(`${s}: ${cl.slice(0, 40)}`);
      }
    }
    expect(bad, '载体/作答位条款出现"例如"式举例').toEqual([]);
  });
});

describe('标准·单源完整性', () => {
  it('S4 单源常量：一定义、消费处只引用（防每个源各写一份）', () => {
    const lib = read('src/config/promptLibrary.js');
    const def = (name) => (lib.match(new RegExp(`export const ${name}`, 'g')) || []).length;
    const use = (name) => (lib.match(new RegExp(name, 'g')) || []).length;
    expect(def('DECLARATION_TRUTH_CLAUSE'), '声明↔实给判据只准一处定义').toBe(1);
    expect(use('DECLARATION_TRUTH_CLAUSE'), '声明↔实给：1 定义 + 2 消费').toBe(3);
    expect(def('QUESTION_OBJECT_CALIBER'), '题号编号对象只准一处定义').toBe(1);
    expect(use('QUESTION_OBJECT_CALIBER'), '题号编号对象：1 定义 + 2 消费').toBe(3);
    // 消费处必须真的出现在实发文本里（防"定义了没人用"的假单源）
    expect(tpl()).toContain(DECLARATION_TRUTH_CLAUSE);
    expect(tpl()).toContain(QUESTION_OBJECT_CALIBER);
  });

  it('S5 引用必须指向真实注入的段（防假指针）', () => {
    const t = tpl();
    for (const ref of ['【输出格式】', '【尾约束·全文自洽】', '【卷面结构】']) {
      if (t.includes(ref)) expect(t, `引用 ${ref} 但该段不存在`).toContain(ref.replace(/[【】]/g, ''));
    }
  });
});

describe('标准·结构（D 三项：M4 / S6 / M5）', () => {
  it('M4 分值只属试卷：教辅等 8 类不得注入分值条款', () => {
    const bad = [];
    for (const g of ['practice', 'summary', 'preview', 'reading', 'dictation', 'errorbook', 'review', 'special']) {
      const t = tpl(g);
      if (/小题数×每题分|账目闭合/.test(t)) bad.push(`${g} 注入了分值账目条款`);
    }
    expect(bad, '分值只在试卷（exam）出现；教辅不带分').toEqual([]);
  });

  it('S6 数量型判据（至少/不少于）不得作载体与作答位判据', () => {
    const bad = [];
    for (const s of ['语文', '数学', '英语', '物理']) {
      for (const cl of tpl('exam', s).split(/\n(?=·|【)/)) {
        if (!/作答位|空位|书写载体|书写格/.test(cl)) continue;
        const m = cl.replace(/不存在["“][^"”]*["”]/g, '').match(/(至少|不少于)/g);
        if (m) bad.push(`${s}: ${[...new Set(m)].join('/')} ← ${cl.slice(0, 36)}`);
      }
    }
    expect(bad, '数量型判据（应改为判据式表述）').toEqual([]);
  });

  it('M5 渲染边界：导出/归一链不得把 [IMAGE]/[GRAPH] 转成 <img>（读图 out-project）', () => {
    const bad = [];
    for (const f of ['src/modules/TypesetModule.vue', 'src/utils/contentCleaner.js']) {
      const src = read(f);
      if (/\[(IMAGE|GRAPH)\][^\n]{0,60}<img/.test(src)) bad.push(f);
    }
    expect(bad, '把读图/图形指令转成图片即越界（读图在 out-project 处理）').toEqual([]);
  });
});
