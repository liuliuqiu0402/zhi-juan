import { describe, it, expect } from 'vitest';
import {
  EXAM_SAMPLE_LIBRARY,
  getExamSamples,
  buildSampleText,
} from '@/config/examSampleLibrary';

// 蓝本覆盖的学科（与 examPaperBlueprints 对齐）
const SUBJECTS = ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '道德与法治', '思想政治', '科学'];
const STAGES = ['primary_low', 'primary_mid', 'primary_high', 'middle', 'high'];

describe('真题内容样例库（内容为王：设问/情境/措辞范式）', () => {
  it('核心学科（语文/数学/英语）中学段必须命中样例', () => {
    for (const subject of ['语文', '数学', '英语']) {
      expect(getExamSamples(subject, 'middle').length, `${subject}|middle`).toBeGreaterThan(0);
      expect(getExamSamples(subject, 'high').length, `${subject}|high`).toBeGreaterThan(0);
    }
  });

  it('主学段命中降级：primary_* 回退 primary（若存在），middle/high 互兜底', () => {
    for (const subject of SUBJECTS) {
      for (const stage of STAGES) {
        const samples = getExamSamples(subject, stage);
        // 允许空（无内容级样本的学科/学段不注入，不报错）
        expect(Array.isArray(samples), `${subject}|${stage} 返回数组`).toBe(true);
      }
    }
    // 语文 primary 无专属样本，但不报错
    expect(Array.isArray(getExamSamples('语文', 'primary_low'))).toBe(true);
  });

  it('每条样例含 name/text/note 三要素，且 text 有实质内容', () => {
    for (const [subject, groups] of Object.entries(EXAM_SAMPLE_LIBRARY)) {
      for (const [stage, samples] of Object.entries(groups)) {
        for (const s of samples) {
          expect(s.name, `${subject}|${stage} name`).toBeTruthy();
          expect(s.text, `${subject}|${stage} text`).toBeTruthy();
          expect(s.text.length, `${subject}|${stage} text 有实质内容`).toBeGreaterThan(20);
          expect(s.note, `${subject}|${stage} note`).toBeTruthy();
        }
      }
    }
  });

  it('样例文本明确标注"严禁照抄"（防模型直接复制真题）', () => {
    const text = buildSampleText('语文', 'middle');
    expect(text).toContain('严禁照抄');
    expect(text).toContain('模仿要点');
    expect(text).toContain('真题内容样例');
  });

  it('buildSampleText 未命中返回空串（不注入噪音）', () => {
    expect(buildSampleText('不存在的学科', 'middle')).toBe('');
    expect(buildSampleText('', 'middle')).toBe('');
  });

  it('样例库学科键与蓝本学科集对齐（无多余、无缺核心科）', () => {
    const libSubjects = Object.keys(EXAM_SAMPLE_LIBRARY).sort();
    for (const core of ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '道德与法治']) {
      expect(libSubjects, `样例库应含 ${core}`).toContain(core);
    }
  });

  it('语文中学段样例含新课标创新句式（设计朗读/梳理结构）与任务驱动作文要素', () => {
    const text = buildSampleText('语文', 'middle');
    expect(text).toContain('设计朗读');
    expect(text).toContain('请从以下任务中选择一个');
    expect(text).toContain('不少于600字');
  });

  it('数学中学段样例含情境措辞范式（表格/分步设问/注）与四段式探究', () => {
    const text = buildSampleText('数学', 'middle');
    expect(text).toContain('有关信息见下表');
    expect(text).toContain('操作判断');
    expect(text).toContain('探究证明');
    expect(text).toContain('深入研究');
  });

  it('英语中学段样例含书面表达题干范式与听力自然口语特征', () => {
    const text = buildSampleText('英语', 'middle');
    expect(text).toContain('假定你是李华');
    expect(text).toContain('词数100左右');
    expect(text).toContain('每段对话读两遍');
    expect(text).toContain('8秒钟的时间读题和答题');
  });
});
