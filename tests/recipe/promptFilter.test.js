// 指令库三维度筛选联动准确性测试（严格匹配语义）
// ============================================================
// 🔴 目的：锁定"资料类型 × 学科 × 学段"筛选——
//    ''(全部)不过滤 / '通用'只看类型级通用模板 / 具体值精确匹配(不含通用)
//    多维度组合 AND 独立生效：无交集时空白
// ============================================================
import { describe, it, expect } from 'vitest';
import { matchTemplateFilter } from '@/config/promptLibrary.js';

const T = {
  通用: { key: 'exam' },
  语文学科: { key: '语文|exam' },
  低段学段: { key: 'primary_low|exam' },
  低段语文学科: { key: 'primary_low|语文|exam' },
  数学课时练: { key: '数学|practice' },
  初中历史: { key: 'middle|历史|exam' },
};

describe('指令库三维度筛选（matchTemplateFilter 严格匹配）', () => {
  it('全部（空条件）：所有模板都显示', () => {
    expect(Object.values(T).every(t => matchTemplateFilter(t, {}))).toBe(true);
  });

  it('学科=语文：精确匹配语文学科模板（不含通用）', () => {
    expect(matchTemplateFilter(T.语文学科, { subject: '语文' })).toBe(true);
    expect(matchTemplateFilter(T.低段语文学科, { subject: '语文' })).toBe(true);
    expect(matchTemplateFilter(T.通用, { subject: '语文' })).toBe(false); // 通用模板不含
    expect(matchTemplateFilter(T.低段学段, { subject: '语文' })).toBe(false);
  });

  it('学科=通用：只看类型级通用模板', () => {
    expect(matchTemplateFilter(T.通用, { subject: '通用' })).toBe(true);
    expect(matchTemplateFilter(T.语文学科, { subject: '通用' })).toBe(false);
    expect(matchTemplateFilter(T.低段学段, { subject: '通用' })).toBe(false);
    expect(matchTemplateFilter(T.低段语文学科, { subject: '通用' })).toBe(false);
  });

  it('学段=小学低段：精确匹配低段模板（不含通用）', () => {
    expect(matchTemplateFilter(T.低段学段, { grade: 'primary_low' })).toBe(true);
    expect(matchTemplateFilter(T.低段语文学科, { grade: 'primary_low' })).toBe(true);
    expect(matchTemplateFilter(T.通用, { grade: 'primary_low' })).toBe(false);
    expect(matchTemplateFilter(T.语文学科, { grade: 'primary_low' })).toBe(false);
    expect(matchTemplateFilter(T.初中历史, { grade: 'primary_low' })).toBe(false);
  });

  it('学段=通用：只看类型级通用模板', () => {
    expect(matchTemplateFilter(T.通用, { grade: '通用' })).toBe(true);
    expect(matchTemplateFilter(T.语文学科, { grade: '通用' })).toBe(false);
    expect(matchTemplateFilter(T.低段学段, { grade: '通用' })).toBe(false);
  });

  it('组合：学科=通用 + 学段=小学低段 → 无交集 → 空白', () => {
    expect(matchTemplateFilter(T.通用, { subject: '通用', grade: 'primary_low' })).toBe(false);
    expect(matchTemplateFilter(T.低段学段, { subject: '通用', grade: 'primary_low' })).toBe(false);
    expect(matchTemplateFilter(T.低段语文学科, { subject: '通用', grade: 'primary_low' })).toBe(false);
  });

  it('组合：学段=低段 + 学科=语文 → 只显示低段×语文×exam', () => {
    expect(matchTemplateFilter(T.低段语文学科, { grade: 'primary_low', subject: '语文' })).toBe(true);
    expect(matchTemplateFilter(T.低段学段, { grade: 'primary_low', subject: '语文' })).toBe(false);
    expect(matchTemplateFilter(T.语文学科, { grade: 'primary_low', subject: '语文' })).toBe(false);
  });

  it('三维度组合：低段+语文+正式考卷', () => {
    expect(matchTemplateFilter(T.低段语文学科, { grade: 'primary_low', subject: '语文', genType: 'exam' })).toBe(true);
    expect(matchTemplateFilter(T.数学课时练, { grade: 'primary_low', subject: '语文', genType: 'exam' })).toBe(false);
    expect(matchTemplateFilter(T.初中历史, { grade: 'primary_low', subject: '语文', genType: 'exam' })).toBe(false);
  });

  it('类型筛选按具体值匹配（通用模板的类型是其实际类型，匹配合理）', () => {
    expect(matchTemplateFilter(T.通用, { genType: 'exam' })).toBe(true);
    expect(matchTemplateFilter(T.语文学科, { genType: 'exam' })).toBe(true);
    expect(matchTemplateFilter(T.数学课时练, { genType: 'exam' })).toBe(false);
  });
});
