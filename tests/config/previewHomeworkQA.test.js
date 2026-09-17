// 🔒 2026-09-17 新增能力：预习导学覆盖「课后问答」（用户裁定）
//    判据：教材中供思考/讨论作答的问题类内容（开放问答型）须原样引用教材原题转为预读与尝试作答任务；
//         以确定答案的反复练习为目的的巩固训练不属此列；判定按题目功能与形态、不按栏目名；
//         教材未含此类内容、或本次素材未提供教材原文（锚清单通道）时该栏目省略，不得自行编造。
//    本文件锁住：栏目结构（含风格套同步）、注入文本、模板判据与答案区口径，防回潮。
import { describe, it, expect } from 'vitest';
import {
  TEACHING_BLUEPRINTS,
  TEACHING_SUBJECT_BLUEPRINTS,
  COLUMN_STYLE_SETS,
  buildTeachingInjection,
} from '../../src/config/teachingBlueprints.js';
import { getPromptTemplate, ANSWER_ROLES } from '../../src/config/promptLibrary.js';

/** 收集通用 + 全部学科定制的 preview 蓝图 */
const previewBlueprints = () => {
  const list = [['通用', TEACHING_BLUEPRINTS.preview]];
  for (const [subject, bp] of Object.entries(TEACHING_SUBJECT_BLUEPRINTS)) {
    if (bp?.preview) list.push([subject, bp.preview]);
  }
  return list;
};

describe('预习导学·课后问答（2026-09-17）', () => {
  it('预览蓝图（通用 + 全部学科定制）均含「课后问答」栏目，位于「我的疑问」之前，且注明省略与禁编造', () => {
    const all = previewBlueprints();
    expect(all.length, 'preview 蓝图收集数不应过少').toBeGreaterThanOrEqual(15);
    for (const [who, bp] of all) {
      const names = (bp.sections || []).map((s) => s.name);
      const i = names.indexOf('课后问答');
      expect(i, `${who} 缺「课后问答」栏目：${names.join('/')}`).toBeGreaterThanOrEqual(0);
      expect(names.indexOf('我的疑问'), `${who}「我的疑问」应在「课后问答」之后`).toBeGreaterThan(i);
      const note = bp.sections[i].note || '';
      expect(note, `${who} 栏目说明须含省略规则`).toContain('省略');
      expect(note, `${who} 栏目说明须含禁编造`).toContain('不得自行编造');
    }
  });

  it('栏目风格套 preview 四套均为 5 栏，第 4 栏与蓝图同位（换肤后栏目不错位）', () => {
    const pool = COLUMN_STYLE_SETS.preview;
    expect(pool.a.columns).toEqual(['学习目标', '预习指引', '预习检测', '课后问答', '我的疑问']);
    for (const id of ['a', 'b', 'c', 'd']) {
      expect(pool[id].columns.length, `preview/${id} 栏目数应为 5`).toBe(5);
      expect(pool[id].columns[3], `preview/${id} 第 4 栏应为「课后问答」`).toBe('课后问答');
    }
  });

  it('注入文本（多学科 × 各学段 × 四套风格）均含课后问答栏目', () => {
    let checked = 0;
    for (const stage of ['primary_low', 'primary_mid', 'primary_high', 'middle', 'high']) {
      for (const subject of ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '道德与法治', '科学', '信息科技', '音乐', '美术', '体育']) {
        for (const id of ['a', 'b', 'c', 'd']) {
          const inj = buildTeachingInjection({ genType: 'preview', stage, subject, columnStyle: id });
          expect(inj, `preview/${stage}/${subject}/${id} 应含课后问答`).toContain('课后问答');
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(200);
  });

  it('预习模板含课后问答判据：原样引用原题 / 不按栏目名 / 通道与无内容时省略 / 不得编造', () => {
    const tpl = getPromptTemplate({ grade: 'primary_high', subject: '语文', genType: 'preview' }).template;
    expect(tpl).toContain('原样引用教材原题');
    expect(tpl).toContain('不按栏目名');
    expect(tpl).toContain('该栏目省略');
    expect(tpl).toContain('不得自行编造');
    // 通道感知：锚清单通道（无教材原文）时省略——模板须给出该条件
    expect(tpl).toContain('未提供教材原文');
  });

  it('答案区：预习资料须逐题给出课后问答的答案与要点；其余自包含教辅不受影响', () => {
    const role = ANSWER_ROLES.other('preview');
    expect(role).toContain('含课后问答栏目');
    expect(role).toContain('仅针对正文中的练习/自测/变式逐题作答');
    for (const gt of ['summary', 'review', 'dictation']) {
      expect(ANSWER_ROLES.other(gt), `${gt} 不应被注入课后问答口径`).not.toContain('含课后问答栏目');
    }
  });
});
