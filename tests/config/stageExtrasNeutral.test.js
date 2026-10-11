// 学段维度注入文本的取向中立（2026-09-16 补锁）
//
// 背景：09-15 已按用户裁定撤掉"贴近学生生活"这类**产品自造的跨学科情境取向**
//       （它是情境同质的直接推力：把所有学科推向校园/家庭）。但那轮只改了
//       组织风格注入句 + 质量底线 + 同步练习模板 + 情境框架预生成四处，
//       **学段维度这两张表漏掉了**——STAGE_EXAM_EXTRAS / STAGE_TEACHING_EXTRAS 仍以
//       【学段特点】段**对全学科广播**"情境生活化、联系生活实际"，
//       而这两条恰是教辅（8 类）与考卷的主通道。本测试锁定该收口不再回退。
//
// 注意（防过度收口）：primary_low 的"活动化、游戏化、生活化"是
//       2022 义教课程方案关于幼小衔接的**原文表述**，必须保留。
import { describe, it, expect } from 'vitest';
import { STAGE_EXAM_EXTRAS, STAGE_TEACHING_EXTRAS } from '../../src/config/promptLibrary.js';

const TABLES = { STAGE_EXAM_EXTRAS, STAGE_TEACHING_EXTRAS };
// 产品自造的跨学科情境取向措辞（非课标条文，且此前实证是情境同质的推力）
const BANNED = ['贴近生活', '联系生活实际', '情境生活化', '生活化情境'];
// 课标原文（幼小衔接：活动化、游戏化、生活化的学习设计）——必须保留，不许一并收掉
const KEEP = '活动化、游戏化、生活化';

describe('学段维度注入文本：情境取向中立', () => {
  for (const [name, table] of Object.entries(TABLES)) {
    it(`${name} 不再对全学科广播"生活化/联系生活实际"`, () => {
      for (const [stage, item] of Object.entries(table)) {
        for (const w of BANNED) {
          expect(item.text, `${name}.${stage} 不应含「${w}」`).not.toContain(w);
        }
      }
    });

    it(`${name} 保留课标原文的 low 段表述（防过度收口）`, () => {
      // 🔴 2026-09-17（用户裁定"自造名称改为课标内的"）：两侧**统一为课标原摘法三连**——
      //    教辅表原用"情境游戏化"（同源课程方案的另一种摘法），现与考卷表同文，防再次分叉。
      expect(table.primary_low.text).toMatch(KEEP);
    });

    it(`${name} 不再复述通用判据「不超学段」（单源在【质量底线】）`, () => {
      // 🔴 2026-10-11（T10·G29）：原断言"每档都含『不超学段』"——但它把同一判据在【质量底线】＋学段表 10 处
      //    各写一遍（同一判据多套，正是"多方牵扯/多源"）。现**单源收进【质量底线】**（"不超学段、不超学业质量要求"），
      //    本表只留各档**特有侧重**（低段"不出现未学概念与抽象符号"、中段"不超前引入高段知识"、高段"但不超高段课标能力要求"）。
      //    故本断言**反向**：学段表不得再出现通用判据字面（防再次分叉成多源）。
      for (const [stage, item] of Object.entries(table)) {
        expect(item.text, `${name}.${stage} 不超学段判据应单源在【质量底线】，本表不复述`).not.toContain('不超学段');
      }
    });
  }
});
