// 课标出处受控（CI 免人工）：SUBJECT_STAGE_EXTRAS 54 科段要点的 source 字段必须非空、
// 且以受控课标清单前缀开头（2022 义教课标 / 普通高中…课程标准（2017年版2020年修订）），禁止无据自造出处；
// 正文与出处非空、正文带句读收尾。防"AI 自造课标来源"与"来源漂移"，属审核基准 A（单一事实源）。
import { describe, it, expect } from 'vitest';
import { SUBJECT_STAGE_EXTRAS, STAGE_EXAM_EXTRAS, STAGE_TEACHING_EXTRAS } from '@/config/promptLibrary.js';

// 受控课标前缀：新版本课标入库须先登记到本清单，否则 CI 即红（宁缺毋滥，防伪出处）
// 🔴 2026-10-14（属主裁定"**是同一个课标，要统一**"·附8 术语唯一）：高中课标此前有**三种写法**
//   （科段要点表 `高中X课标(2017/2020)`／蓝图 note `普通高中X课程标准（2017年版2020年修订）`／学段表 `高中课标`），
//   现**全库统一为正式全名**（单源常量 `GAOZHONG_CURRICULUM`）。
// 🔴 2026-10-14（同批**回证**·防"改顺手了顺手放宽"）：统一时首版把受控前缀写成 `^普通高中`——
//   比改前（`^高中.+课标\(2017\/2020\)`）**要求更松**（只认前四个字，自造串亦可通过）。现收回原强度：
//   **普通高中 + 正式名限定词（2017年版2020年修订）**必须同现；三处引用共用下面**同一份源串**（不在本文件写第二套）。
const GAOZHONG_FULL_SRC = '普通高中[^（]{0,30}（2017年版2020年修订）';
const GAOZHONG_FULL = new RegExp(`^${GAOZHONG_FULL_SRC}`);
const SOURCE_PREFIX = new RegExp(`^(2022义教|${GAOZHONG_FULL_SRC})`);
const SELF_MADE = /(自拟|据我|我认为|参考我|自编|个人理解)/;

const CELLS = Object.entries(SUBJECT_STAGE_EXTRAS);
// 🔴 2026-10-11（S1·附条 8 残留**收口**）：学段表（exam/教辅两版的学段特点）里保留的课标原文句此前
//   只有**点检**（promptLibrary.test.js 只抽查 primary_low/mid/high 三档的部分表述）——不满足"全量、非抽样"。
//   现补全量锁：两表每一档都必须带**非空且非自造**的 source。实测 10/10 已达标（无内容改动，仅防回归）。
const STAGE_TABLES = { STAGE_EXAM_EXTRAS, STAGE_TEACHING_EXTRAS };

describe('课标出处受控：54 科段要点 source 单一受控清单（CI 免人工）', () => {
  it('全部科段要点非空，且正文长度、句读收尾达标', () => {
    const bad = [];
    for (const [cell, v] of CELLS) {
      if (!v.text || v.text.length < 12) bad.push(`${cell} 正文缺失或过短(len=${v?.text?.length || 0})`);
      else if (!/[。；！？]$/.test(v.text.trim())) bad.push(`${cell} 正文未以句读收尾：…${v.text.slice(-20)}`);
    }
    expect(bad, `正文规范异常 ${bad.length} 处：\n${bad.slice(0, 30).join('\n')}`).toEqual([]);
  });

  it('每条要点带出处，且出处以受控课标前缀开头（2022义教 / 普通高中…课程标准（2017年版2020年修订））', () => {
    const bad = [];
    for (const [cell, v] of CELLS) {
      if (!v.source || !v.source.trim()) bad.push(`${cell} 缺 source`);
      else if (!SOURCE_PREFIX.test(v.source.trim())) bad.push(`${cell} 出处前缀不受控：${v.source.trim().slice(0, 40)}`);
    }
    expect(bad, `出处受控异常 ${bad.length} 处（新课标请先登记受控前缀再入库）：\n${bad.slice(0, 30).join('\n')}`).toEqual([]);
  });

  it('出处不得为无据自造表述', () => {
    const bad = CELLS.filter(([cell]) => SELF_MADE.test(SUBJECT_STAGE_EXTRAS[cell].source || '')).map(([cell]) => `${cell}: ${SUBJECT_STAGE_EXTRAS[cell].source}`);
    expect(bad, `自造出处 ${bad.length} 处：\n${bad.slice(0, 30).join('\n')}`).toEqual([]);
  });

  it('课标体系与学段匹配：义教学段（小学低/中/高段、初中）出处仅允许 2022 义教课标；高中学段仅允许 普通高中…课程标准（2017年版2020年修订）', () => {
    const bad = [];
    for (const [cell, v] of CELLS) {
      const stage = cell.split('|')[1];
      const src = (v.source || '').trim();
      if (stage === 'high') {
        if (!GAOZHONG_FULL.test(src)) bad.push(`${cell}: 高中学段须用"普通高中…课程标准（2017年版2020年修订）"出处，实得：${src.slice(0, 30)}`);
      } else if (!/^2022义教/.test(src)) {
        bad.push(`${cell}: 义教学段(${stage})须用 2022 义教课标出处，实得：${src.slice(0, 30)}`);
      }
    }
    expect(bad, `学段↔课标体系错配 ${bad.length} 处（义教=2022义教 / 高中=普通高中·2017年版2020年修订，两体系素养与学段目标不同，禁止混用）：\n${bad.slice(0, 30).join('\n')}`).toEqual([]);
  });

  it('口径 CI（A-002 固化）：课标要点正文不得含未声明出处的命题形态词（设问/题型名/支架/载体等）', () => {
    // 放行条件：source 含命题出处声明（命题建议/命题质量要求/学业质量/高考评价体系）——即该形态词有课标原文出处；
    // 词表为历轮剥离的题型/设问/支架/载体形态词，防今后新增要点再犯"课标要点段编造命题形态"。
    const MORPH = /设问|材料题|计算题|实验题|综合题|简答|论述题|操作题|表现题|类题|支架|字数提示|入题|选填|考查|载体/;
    const ALLOW_SRC = /命题建议|命题质量要求|学业质量|高考评价体系/;
    const bad = [];
    for (const [cell, v] of CELLS) {
      if (MORPH.test(v.text) && !ALLOW_SRC.test(v.source || '')) {
        const m = v.text.match(MORPH)[0];
        bad.push(`${cell}: 正文含未声明出处的命题形态词【${m}】：${v.text.slice(0, 30)}…`);
      }
    }
    expect(bad, `命题形态词未声明出处 ${bad.length} 处（须为 0；有课标出处请补 source 声明，无出处请删除）：\n${bad.slice(0, 30).join('\n')}`).toEqual([]);
  });

  it('科段键与 STAGE_SUBJECTS 全覆盖对齐（54 cells 事实源自洽）', () => {
    // SUBJECT_STAGE_EXTRAS 键集合即真实开设矩阵（assemblyMatrix 以此遍历 486），键须可解析为 学科|学段
    const bad = CELLS.filter(([cell]) => !/^[^|]+\|[^|]+$/.test(cell)).map(([cell]) => cell);
    expect(bad, `非法科段键 ${bad.length} 个：${bad.join('、')}`).toEqual([]);
    expect(CELLS.length).toBe(54);
  });

  it('🔴 学段表（exam/教辅）每档 source 非空且非自造（附条 8 残留收口·全量非抽样）', () => {
    const bad = [];
    for (const [tname, table] of Object.entries(STAGE_TABLES)) {
      for (const [stage, v] of Object.entries(table)) {
        if (!v.source || !v.source.trim()) bad.push(`${tname}.${stage} 缺 source`);
        else if (SELF_MADE.test(v.source)) bad.push(`${tname}.${stage} 自造出处：${v.source}`);
        else if (!SOURCE_PREFIX.test(v.source.trim())) bad.push(`${tname}.${stage} 出处前缀不受控：${v.source.trim().slice(0, 40)}`);
      }
    }
    expect(bad, `学段表出处受控异常 ${bad.length} 处：\n${bad.join('\n')}`).toEqual([]);
    // 5 学段 × 2 表 = 10 档，一档不少（防"表被清空/漏档"式假绿）
    expect(Object.keys(STAGE_EXAM_EXTRAS).length).toBe(5);
    expect(Object.keys(STAGE_TEACHING_EXTRAS).length).toBe(5);
  });

  // 🔴 2026-10-14（回证留痕·**守卫有牙**）：本守卫在 F1 统一时曾被写成 `^普通高中`（只认前四字 = 比改前更松）。
  //   本用例把"放宽的形状"钉死：**光有"普通高中"四字不给过**，必须与正式名限定词同现；同时证明合规写法判绿。
  it('受控前缀强度：只有"普通高中"四字（无正式名限定词）判红；正式全名判绿', () => {
    // 合规：学科正式名 与 印发名（学科无关）两种形态都须放行
    expect(SOURCE_PREFIX.test('普通高中语文课程标准（2017年版2020年修订）·语言建构与运用核心素养'), '学科正式名须放行').toBe(true);
    expect(SOURCE_PREFIX.test('普通高中课程方案和语文等学科课程标准（2017年版2020年修订）·学业水平考试命题要求'), '印发名须放行').toBe(true);
    // 放宽的形状：只写"普通高中"不得放行（防回潮为 `^普通高中`）
    expect(SOURCE_PREFIX.test('普通高中随便编的出处（2020年）'), '只认前四字 = 放宽，须判红').toBe(false);
    expect(SOURCE_PREFIX.test('普通高中语文课程标准（2017年版2017年修订）'), '限定词写错不得放行').toBe(false);
    // 义教侧不受影响
    expect(SOURCE_PREFIX.test('2022义教语文·第一学段识字与写字'), '义教写法须放行').toBe(true);
    expect(GAOZHONG_FULL.test('普通高中数学课程标准（2017年版2020年修订）·核心素养'), '学段门用的同一份源串须同判').toBe(true);
  });
});
