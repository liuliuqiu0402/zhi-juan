// 🔒 结构来源·第三档「固定结构·不带分值」（blueprint-noscore）守卫（2026-10-17）
// ============================================================
// 这一档的存在理由：结构只是**参考**——带上分值（甚至带序号）时模型会把它当骨架照抄。
// 三档＝blueprint（带参考分值）／blueprint-noscore（只留板块名＋命题要求）／free（自定结构）。
// 本守卫锁四件事：
//   ① UI 入口在册（选项 + 默认档仍是 blueprint）；
//   ② 两个 exam 注入点都按该档位切换 withScore（不得只切一处）；
//   ③ 不带分值档**只删分值、不删内容**（板块名与命题要求逐条保留、行数不变）；
//   ④ 不带分值档不残留"分"的踪迹（参考分值／本大类参考N分／本部分参考N分）。
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { buildStructureText } from '../../src/config/promptLibrary.js';
import { EXAM_BLUEPRINTS } from '../../src/config/examPaperBlueprints.js';

const ROOT = path.resolve(__dirname, '../..');
const gm = fs.readFileSync(path.join(ROOT, 'src/modules/GenerateModule.vue'), 'utf8');

const CASES = ['语文|primary_mid', '数学|primary_mid', '英语|primary_mid', '语文|middle'];
const SCORE_TRACE = /参考分值|本大类参考\d+分|本部分参考\d+分/;

describe('第三档：固定结构·不带分值', () => {
  it('① UI 入口在册：选项存在、默认档仍是 blueprint', () => {
    expect(gm, '缺"不带分值"这一档的选项').toContain('value="blueprint-noscore"');
    expect(gm, '结构来源默认档须仍是 blueprint（新档不得顶掉默认）').toContain("const structureMode = ref('blueprint')");
  });

  it('② 两个 exam 注入点都按档位切换 withScore（只切一处＝另一处仍把分值喂回去）', () => {
    const hits = gm.split("{ withScore: structureMode.value !== 'blueprint-noscore' }").length - 1;
    expect(hits, 'exam 侧应有 2 个注入点同时受该档控制').toBe(2);
  });

  it('③ 不带分值档只删分值、不删内容（板块名与命题要求逐条保留、行数不变）', () => {
    const bad = [];
    for (const key of CASES) {
      const bp = EXAM_BLUEPRINTS[key];
      if (!bp) { bad.push(`${key} —— 蓝图不存在`); continue; }
      const withScore = buildStructureText(bp, { withScore: true }).split('\n');
      const noScore = buildStructureText(bp, { withScore: false }).split('\n');
      if (withScore.length !== noScore.length) bad.push(`${key} —— 行数 ${withScore.length}→${noScore.length}（内容被删）`);
      // 每一行去掉分值片段后应与不带分值档逐字一致（证明只动了分值）
      const strip = (l) => l.replace(/｜参考分值 \d+分/g, '').replace(/（本大类参考\d+分）/g, '').replace(/（本部分参考\d+分）/g, '');
      withScore.forEach((l, i) => {
        if (strip(l) !== noScore[i]) bad.push(`${key} 第 ${i + 1} 行：非分值内容也被改动\n  带分：${l}\n  不带：${noScore[i]}`);
      });
    }
    expect(bad, `不带分值档动了非分值内容：\n${bad.join('\n')}`).toEqual([]);
  });

  it('④ 不带分值档不残留"分"的踪迹；带分值档必须仍带（防两档写成一样）', () => {
    for (const key of CASES) {
      const bp = EXAM_BLUEPRINTS[key];
      const noScore = buildStructureText(bp, { withScore: false });
      expect(noScore, `${key}：不带分值档仍残留分值标迹`).not.toMatch(SCORE_TRACE);
      expect(buildStructureText(bp, { withScore: true }), `${key}：带分值档反而没分值（两档失效）`).toMatch(SCORE_TRACE);
    }
  });
});
