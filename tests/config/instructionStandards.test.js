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
import { getPromptTemplate, DECLARATION_TRUTH_CLAUSE, QUESTION_OBJECT_CALIBER, NUMBERING_ONLY_RULE, buildAnswerFormatSpec, PAPER_OUTPUT_CONVENTIONS } from '../../src/config/promptLibrary.js';
import { faceTexts } from '../../scripts/instructionText.mjs'; // 486 面装配（单源，与 L1 锚门/清单守卫同一份）

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
  // 🔴 2026-10-14（属主"B 可以上锁的吧？是不是上锁更好？"·**补强**）：三条原先各只有**窄代理**
  //   （M4 只测 2 个词串／S6 只测 exam×4 科的载体条／M5 只测 2 个文件的 <img>）——
  //   与《指令改动标准》§五 标的"待机检"不符（守卫已在、强度不够）。现按 **486 面全量**补强；
  //   白名单/基线一律**写明依据**，新增即判红（只减不增）。
  // 面级口径单源：scripts/instructionText.mjs（与 L1 锚门、清单守卫同一份装配）。
  const FACES486 = faceTexts();
  const TYPES9 = [...new Set(FACES486.map((f) => f.genType))];

  it('M4 分值只属试卷：exam 恒在场；其余 8 类 432 面**零**分值条款', () => {
    // ① exam 正向锚（分值标注块 + 满分）恒在场——防"删概念以过守卫"
    //    2026-10-24：原锚"分值说明"随单一开关重写改词（"标题里的分按该组实际判分处数算出"）；
    //    改锚**块标题【分值标注】**（结构锚，比词串更稳：块在＝分值判据在）。
    const exam = FACES486.filter((f) => f.genType === 'exam');
    const miss = exam.filter((f) => !/【分值标注】/.test(f.text) || !/满分/.test(f.text)).map((f) => f.key);
    expect(miss.slice(0, 5), `exam 面缺分值条款（共 ${miss.length}）`).toEqual([]);
    // ② 非 exam 432 面：零分值条款（满分／分值说明／（…N分…））——这才是 M4 的全面面口径
    const RE = /满分|分值说明|[（(][^）)\n]{0,8}\d+\s*分\s*[）)]/;
    const bad = FACES486.filter((f) => f.genType !== 'exam' && RE.test(f.text)).map((f) => f.key);
    expect(bad.slice(0, 5), `非 exam 面注入分值条款（共 ${bad.length}）：${bad.join(',')}`).toEqual([]);
    // ③ 原窄代理保留（分值账目条款）
    const bad2 = TYPES9.filter((g) => g !== 'exam' && /小题数×每题分|账目闭合/.test(tpl(g)));
    expect(bad2, '分值只在试卷（exam）出现；教辅不带分').toEqual([]);
    // ④ 答案页独立调用（split 后的答案页）同样"分值只属试卷"——正文面之外的第二类实发
    //    2026-10-25（属主提醒）：原答案格式规范对教辅也写"教辅不标分值"与"解析的…分值…同一口径"，
    //    仍是在给教辅讲分值 ⇒ 按类型门控，教辅侧只保留"不写分值"这类否定守卫（与"不标注分值"同口径）。
    const ansRE = /分值|X\s*分|[（(][^）)\n]{0,8}\d+\s*分\s*[）)]/;
    const NEG = /不写分值|不标注分值|不标分值/g;
    const ansBad = FACES486.filter((f) => f.genType !== 'exam'
      && ansRE.test((buildAnswerFormatSpec(f.subject, f.genType) + PAPER_OUTPUT_CONVENTIONS.once(f.subject, false, f.genType)).replace(NEG, '')))
      .map((f) => f.key);
    expect(ansBad.slice(0, 5), `非 exam 答案页注入分值条款（共 ${ansBad.length}）：${ansBad.join(',')}`).toEqual([]);
    // exam 正向锚：门控不得把试卷的标分口径一起删掉
    expect(buildAnswerFormatSpec('语文', 'exam'), 'exam 答案页须保留标分口径').toContain('每题答案首标（X分）');
    expect(PAPER_OUTPUT_CONVENTIONS.once('语文', false, 'exam'), 'exam 一次成型须保留标分口径').toContain('须逐题注明该题分值');
    // ⑤ 教辅编号判据（从单一开关按切点派生）必须是完整句、且不含分值（切点错会留下半句残句）
    expect(NUMBERING_ONLY_RULE, '教辅编号判据不得含分值').not.toMatch(/分值|（共X分|（每〈单位〉/);
    expect(NUMBERING_ONLY_RULE).not.toContain('整组只按一种情况写');
    expect(NUMBERING_ONLY_RULE.trim().endsWith('。'), '教辅编号判据须是完整句').toBe(true);
  });

  it('S6 数量型判据：486 面**除白名单外零命中**（至少/不少于/不低于/不多于/不超过/最多）', () => {
    // 白名单（均属**产品参数／正规形态**，不是"内容凑数"的判据）：
    //   ① 版面尺寸上限（行数）——产品参数表归程序（《指令改动标准》§六.2 附12/C10）
    //   ② 写作字数下限（"不少于 N 字"）——正规卷写作题的通行形态
    const WHITE = [
      /不超过本学段卷面上限（\s*\d+\s*行）/,
      /不超过本学段单题作答区上限\s*\d+\s*行/,
      /不少于\s*\d+\s*字/,
    ];
    const bad = [];
    for (const f of FACES486) {
      const ctx = f.text.match(/[^\n]{0,24}(至少|不少于|不低于|不多于|不超过|最多)[^\n]{0,24}/g) || [];
      for (const c of ctx) if (!WHITE.some((re) => re.test(c))) bad.push(`${f.key}: ${c.replace(/\s+/g, ' ')}`);
    }
    expect(bad.slice(0, 5), `数量型判据（白名单外；共 ${bad.length}）`).toEqual([]);
  });

  it('M5 渲染边界：标记只在登记文件出现；不得清空标记；契约字段在场', () => {
    // ① 文件集合基线锁（只减不增）：src 内触碰 [IMAGE]/[GRAPH] 的文件须属登记集
    const REGISTERED = new Set([
      'src/config/promptLibrary.js', 'src/config/validatorRules.js', 'src/config/examPaperBlueprints.js',
      'src/config/eduRenderContract.js', 'src/config/blueprintSchema.js', 'src/config/toolLibrary.js',
      'src/utils/examValidator.js', 'src/utils/contentCleaner.js', 'src/utils/figurePromptCheck.js',
      'src/utils/docxBuilder.js', 'src/utils/programAttach.js', 'src/utils/directiveBlocks.js',
      'src/composables/useAiGenerator.js', 'src/modules/GenerateModule.vue',
      'src/modules/tools/views/RenderContractView.vue',
    ]);
    const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(dir, e.name);
      return e.isDirectory() ? walk(p) : [p];
    });
    const found = walk(path.join(ROOT, 'src'))
      .filter((p) => /\.(js|vue|ts)$/.test(p))
      .filter((p) => /\[(IMAGE|GRAPH)\]/.test(fs.readFileSync(p, 'utf8')))
      .map((p) => path.relative(ROOT, p).replace(/\\/g, '/'));
    const extra = found.filter((p) => !REGISTERED.has(p));
    expect(extra, `新增文件触碰渲染标记（须先过 M5 准绳·docs/design/修复准则-检查清单.md §十二）：${extra.join(',')}`).toEqual([]);
    // ② 清空禁令（准绳："不得把标记原文当'残留/泄漏'清理"）
    const BAN = /\\?\[(?:IMAGE|GRAPH)\\?\][^\n]{0,80},\s*(?:''|"")\s*\)/;
    const strippers = found.filter((p) => BAN.test(fs.readFileSync(path.join(ROOT, p), 'utf8')));
    expect(strippers, `把标记清空的实现（越界＝当残留清理）：${strippers.join(',')}`).toEqual([]);
    // ③ 契约正向锚（防"删概念以过守卫"）
    const rc = read('src/config/eduRenderContract.js');
    expect(rc, '[IMAGE] 契约字段 PROMPT 仍在').toContain('PROMPT');
    expect(rc, '[GRAPH] 契约字段 TYPE 仍在').toContain('TYPE');
  });

  it('守卫有牙：三条锁对"合成违规"分别判红、对合规写法判绿（防守卫空转）', () => {
    // S6
    const W6 = [/不超过本学段卷面上限（\s*\d+\s*行）/, /不超过本学段单题作答区上限\s*\d+\s*行/, /不少于\s*\d+\s*字/];
    expect(W6.some((re) => re.test('每知识点至少 3 道题')), '须抓"至少 3 道题"').toBe(false);
    expect(W6.some((re) => re.test('写作不少于 300 字')), '须放过写作字数').toBe(true);
    expect(W6.some((re) => re.test('不超过本学段单题作答区上限 6 行')), '须放过版面行数上限').toBe(true);
    // M4
    const R4 = /满分|分值说明|[（(][^）)\n]{0,8}\d+\s*分\s*[）)]/;
    expect(R4.test('（共 5 分）'), '须抓非 exam 的（共 N 分）').toBe(true);
    expect(R4.test('满分：100分'), '须抓满分').toBe(true);
    expect(R4.test('不标注分值'), '不得把"不标注分值"误判为分值条款').toBe(false);
    // M5
    const BANX = /\\?\[(?:IMAGE|GRAPH)\\?\][^\n]{0,80},\s*(?:''|"")\s*\)/;
    expect(BANX.test("body = body.replace(/\\[IMAGE\\][\\s\\S]*?\\[\\/IMAGE\\]/gi, '')"), '清空禁令须抓得住').toBe(true);
    expect(BANX.test("body = body.replace(/\\[IMAGE\\][^\\n]*/gi, '（配图）')"), '不得误伤"转占位"实现').toBe(false);
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
