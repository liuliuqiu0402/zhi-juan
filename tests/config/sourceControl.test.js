// 课标出处受控（CI 免人工）：SUBJECT_STAGE_EXTRAS 54 科段要点的 source 字段必须非空、
// 且以受控课标清单前缀开头（2022 义教课标 / 高中课标(2017/2020)），禁止无据自造出处；
// 正文与出处非空、正文带句读收尾。防"AI 自造课标来源"与"来源漂移"，属审核基准 A（单一事实源）。
import { describe, it, expect } from 'vitest';
import { SUBJECT_STAGE_EXTRAS } from '@/config/promptLibrary.js';

// 受控课标前缀：新版本课标入库须先登记到本清单，否则 CI 即红（宁缺毋滥，防伪出处）
const SOURCE_PREFIX = /^(2022义教|高中.+课标\(2017\/2020\))/;
const SELF_MADE = /(自拟|据我|我认为|参考我|自编|个人理解)/;

const CELLS = Object.entries(SUBJECT_STAGE_EXTRAS);

describe('课标出处受控：54 科段要点 source 单一受控清单（CI 免人工）', () => {
  it('全部科段要点非空，且正文长度、句读收尾达标', () => {
    const bad = [];
    for (const [cell, v] of CELLS) {
      if (!v.text || v.text.length < 12) bad.push(`${cell} 正文缺失或过短(len=${v?.text?.length || 0})`);
      else if (!/[。；！？]$/.test(v.text.trim())) bad.push(`${cell} 正文未以句读收尾：…${v.text.slice(-20)}`);
    }
    expect(bad, `正文规范异常 ${bad.length} 处：\n${bad.slice(0, 30).join('\n')}`).toEqual([]);
  });

  it('每条要点带出处，且出处以受控课标前缀开头（2022义教 / 高中…课标(2017/2020)）', () => {
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

  it('课标体系与学段匹配：义教学段（小学低/中/高段、初中）出处仅允许 2022 义教课标；高中学段仅允许 高中…课标(2017/2020)', () => {
    const bad = [];
    for (const [cell, v] of CELLS) {
      const stage = cell.split('|')[1];
      const src = (v.source || '').trim();
      if (stage === 'high') {
        if (!/^高中.+课标\(2017\/2020\)/.test(src)) bad.push(`${cell}: 高中学段须用高中课标(2017/2020)出处，实得：${src.slice(0, 30)}`);
      } else if (!/^2022义教/.test(src)) {
        bad.push(`${cell}: 义教学段(${stage})须用 2022 义教课标出处，实得：${src.slice(0, 30)}`);
      }
    }
    expect(bad, `学段↔课标体系错配 ${bad.length} 处（义教=2022义教 / 高中=高中课标2017/2020，两体系素养与学段目标不同，禁止混用）：\n${bad.slice(0, 30).join('\n')}`).toEqual([]);
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
});
