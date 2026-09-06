// 过程自述剥离（stripPlanningPreamble）测试
// ============================================================
// 🔴 目的（2026-09 根治"声明≠覆盖"）：模型把"我已获取教材原文与知识点。现在…命制课时练。现在编写正文。"
//    当正文首段输出（声明/罗列清单 ≠ 实际内容）——程序确定性剥除开头自述段；
//    只剥匹配自述特征的纯文本 <p>，题号/栏目/答案区开头的真内容不误伤。
// ============================================================
import { describe, it, expect } from 'vitest';
import { stripPlanningPreamble } from '../../src/utils/contentCleaner.js';

describe('stripPlanningPreamble（过程自述剥离）', () => {
  it('开头"我已获取教材原文…现在编写正文"自述段 → 整段剥除', () => {
    const html = '<p>我已获取教材原文与知识点。现在依据2022年版课标与教材内容，围绕"小数乘法和除法（二）"的核心知识（小数乘法计算方法、循环小数等）命制课时练。现在编写正文。</p><h2>一、基础建构任务</h2><p>1. 题目。</p>';
    expect(stripPlanningPreamble(html)).toBe('<h2>一、基础建构任务</h2><p>1. 题目。</p>');
  });

  it('连续两段自述 → 全部剥除，直至真内容', () => {
    const html = '<p>我已获取教材原文与知识点。</p><p>现在围绕本课核心知识命制课时练。</p><h2>一、计算</h2>';
    expect(stripPlanningPreamble(html)).toBe('<h2>一、计算</h2>');
  });

  it('题号开头的真内容段 → 不剥（防误删正文）', () => {
    const html = '<p>1. 班级义卖准备了一批手工香皂。</p><h2>一、基础建构任务</h2>';
    expect(stripPlanningPreamble(html)).toBe(html);
  });

  it('栏目/标题开头（h2）→ 不剥', () => {
    const html = '<h2>一、基础建构任务</h2><p>1. 题目。</p>';
    expect(stripPlanningPreamble(html)).toBe(html);
  });

  it('无自述特征的普通正文段开头 → 不剥（含"依据教材"类真实题干安全场景）', () => {
    const html = '<p>依据下面的统计表，回答问题。</p><p>1. 题目。</p>';
    expect(stripPlanningPreamble(html)).toBe(html);
  });

  it('真实产物样本（16:31 随堂巩固开头自述）→ 剥除', () => {
    const html = '<p>我已获取教材原文与知识点。现在依据课标与教材，编写课时练习正文。本课核心知识覆盖：小数乘法（含小数乘小数竖式、积的近似值、乘大于/小于1的数的规律）、小数除法（除数是小数的除法、商的近似值、实际问题中商的近似取值、除以大于/小于1的数的规律）、算理（小数化分数理解、小数点移动）、循环小数、估算近似应用。</p><h2>一、基础建构任务</h2><p>1. 题目。</p>';
    expect(stripPlanningPreamble(html)).toBe('<h2>一、基础建构任务</h2><p>1. 题目。</p>');
  });
});
