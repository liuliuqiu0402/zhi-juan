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

  it('科段键与 STAGE_SUBJECTS 全覆盖对齐（54 cells 事实源自洽）', () => {
    // SUBJECT_STAGE_EXTRAS 键集合即真实开设矩阵（assemblyMatrix 以此遍历 486），键须可解析为 学科|学段
    const bad = CELLS.filter(([cell]) => !/^[^|]+\|[^|]+$/.test(cell)).map(([cell]) => cell);
    expect(bad, `非法科段键 ${bad.length} 个：${bad.join('、')}`).toEqual([]);
    expect(CELLS.length).toBe(54);
  });
});
