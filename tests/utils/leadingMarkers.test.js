import { describe, it, expect } from 'vitest';
import { normalizeLeadingMarkers } from '../../src/utils/contentCleaner.js';

describe('normalizeLeadingMarkers 行首"项目符号+序号"双标记归一', () => {
  it('字母序号：• A. → A.', () => {
    expect(normalizeLeadingMarkers('<p>• A. 草原迎客</p>')).toBe('<p>A. 草原迎客</p>');
  });
  it('字母序号（中文顿号）：● B、 → B、', () => {
    expect(normalizeLeadingMarkers('<li>● B、草原风光</li>')).toBe('<li>B、草原风光</li>');
  });
  it('圆圈序号：• ① → ①', () => {
    expect(normalizeLeadingMarkers('<p>• ① 轻声朗读课文两遍</p>')).toBe('<p>① 轻声朗读课文两遍</p>');
  });
  it('括号序号：◦ (1) → (1)', () => {
    expect(normalizeLeadingMarkers('<p>◦ (1) 第一小题</p>')).toBe('<p>(1) 第一小题</p>');
  });
  it('数字序号：▪ 1. → 1.', () => {
    expect(normalizeLeadingMarkers('<p>▪ 1. 勾勒(lè lēi)</p>')).toBe('<p>1. 勾勒(lè lēi)</p>');
  });
  it('多行混合（p 逐行）', () => {
    const html = '<p>• A. 草原迎客</p><p>• B. 草原风光</p><p>• 纯列表项</p>';
    expect(normalizeLeadingMarkers(html)).toBe('<p>A. 草原迎客</p><p>B. 草原风光</p><p>• 纯列表项</p>');
  });
  it('纯项目符号（无序号）不动', () => {
    const html = '<p>• 草原迎客</p>';
    expect(normalizeLeadingMarkers(html)).toBe(html);
  });
  it('无项目符号的普通序号不动', () => {
    const html = '<p>A. 草原迎客</p>';
    expect(normalizeLeadingMarkers(html)).toBe(html);
  });
  it('行首是标签（非文本）不动', () => {
    const html = '<p><u class="blank-4">&emsp;</u>• A. x</p>';
    expect(normalizeLeadingMarkers(html)).toBe(html);
  });
  it('幂等：二次处理不变化', () => {
    const once = normalizeLeadingMarkers('<p>• A. 草原迎客</p>');
    expect(normalizeLeadingMarkers(once)).toBe(once);
  });
  it('实体空位分隔：&nbsp;（+序号，AI 常用写法）→ 剥项目符号', () => {
    expect(normalizeLeadingMarkers('<p>•&nbsp;A. 草原迎客</p>')).toBe('<p>A. 草原迎客</p>');
    expect(normalizeLeadingMarkers('<p>•&nbsp;1. 勾勒</p>')).toBe('<p>1. 勾勒</p>');
    expect(normalizeLeadingMarkers('<p>•&nbsp;(1) 第一小题</p>')).toBe('<p>(1) 第一小题</p>');
    expect(normalizeLeadingMarkers('<p>•&nbsp;① 轻声朗读</p>')).toBe('<p>① 轻声朗读</p>');
  });
  it('实体空位分隔：&#160;/&emsp;/&ensp; → 剥项目符号', () => {
    expect(normalizeLeadingMarkers('<p>•&#160;B、草原风光</p>')).toBe('<p>B、草原风光</p>');
    expect(normalizeLeadingMarkers('<li>•&emsp;B、草原风光</li>')).toBe('<li>B、草原风光</li>');
    expect(normalizeLeadingMarkers('<p>•&ensp;C. 内容</p>')).toBe('<p>C. 内容</p>');
  });
  it('实体空位幂等：二次处理不变化', () => {
    const once = normalizeLeadingMarkers('<p>•&nbsp;A. 草原迎客</p>');
    expect(normalizeLeadingMarkers(once)).toBe(once);
  });
  it('实体空位下纯项目符号（无序号）仍不动', () => {
    const html = '<p>•&nbsp;草原迎客</p>';
    expect(normalizeLeadingMarkers(html)).toBe(html);
  });
  it('序号被 <strong>/<b> 加粗包裹（模型常见写法）→ 仍剥项目符号并保留序号标签', () => {
    expect(normalizeLeadingMarkers('<p>• <strong>（1）</strong>知道</p>')).toBe('<p><strong>（1）</strong>知道</p>');
    expect(normalizeLeadingMarkers('<p>• <b>1、</b>内容</p>')).toBe('<p><b>1、</b>内容</p>');
  });
  it('中文数字序号（一、/（一））→ 剥项目符号', () => {
    expect(normalizeLeadingMarkers('<p>· 一、学习目标</p>')).toBe('<p>一、学习目标</p>');
    expect(normalizeLeadingMarkers('<p>• （一）设问</p>')).toBe('<p>（一）设问</p>');
  });
  it('◆◇ 等列表项符号 + 序号 → 剥', () => {
    expect(normalizeLeadingMarkers('<p>◆ 1、内容</p>')).toBe('<p>1、内容</p>');
    expect(normalizeLeadingMarkers('<p>◇ ② 内容</p>')).toBe('<p>② 内容</p>');
  });
  it('标签后是正文文字而非序号 → 保守不剥（防误伤）', () => {
    expect(normalizeLeadingMarkers('<p>• <strong>要点说明</strong>1、见下</p>')).toBe('<p>• <strong>要点说明</strong>1、见下</p>');
  });
  it('答案区（answer-section div 包裹）内层 p 的符号+序号 → 剥（嵌套场景回归）', () => {
    const html = '<div class="answer-section"><h2>参考答案与解析</h2><p>• （1）加法算式：5 + 5 + 5 = 15</p><p>• （2）表示 3 个 5 相加</p></div>';
    expect(normalizeLeadingMarkers(html)).toBe('<div class="answer-section"><h2>参考答案与解析</h2><p>（1）加法算式：5 + 5 + 5 = 15</p><p>（2）表示 3 个 5 相加</p></div>');
  });
  it('列表嵌套（ul>li>p）内层 p 的符号+序号 → 剥', () => {
    const html = '<ul><li><p>• （1）加法算式：5 + 5 + 5 = 15</p></li></ul>';
    expect(normalizeLeadingMarkers(html)).toBe('<ul><li><p>（1）加法算式：5 + 5 + 5 = 15</p></li></ul>');
  });
  it('多层嵌套（div>div>p）内层 p 的符号+序号 → 剥', () => {
    const html = '<div class="a"><div class="b"><p>• 1. 内容</p></div></div>';
    expect(normalizeLeadingMarkers(html)).toBe('<div class="a"><div class="b"><p>1. 内容</p></div></div>');
  });
  it('嵌套场景幂等：二次处理不变化', () => {
    const once = normalizeLeadingMarkers('<div class="answer-section"><p>• （1）加法算式：5 + 5 + 5 = 15</p></div>');
    expect(normalizeLeadingMarkers(once)).toBe(once);
  });
  it('嵌套内层纯项目符号（无序号）仍不动', () => {
    const html = '<div class="answer-section"><p>• 纯文本要点</p></div>';
    expect(normalizeLeadingMarkers(html)).toBe(html);
  });
});
