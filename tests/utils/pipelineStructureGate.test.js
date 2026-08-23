// 结构级治理守卫：卷首/密封线/标题格式由代码拼装，杜绝模型偏离蓝本结构
import { describe, it, expect } from 'vitest';
import { buildSectionInstruction, assemblePaperHeader, parseQuestionCount } from '@/config/examPipeline';
import { getExamBlueprint } from '@/config/examPaperBlueprints';

describe('🔴 结构级治理守卫（代码拼装卷首结构，模型无机会写错）', () => {
  it('卷首由代码拼装：考试时间+满分+密封线信息栏（学校/班级/姓名/学号）', () => {
    const bp = getExamBlueprint('英语', 'primary_low');
    const header = assemblePaperHeader(bp, { gradeLabel: '一年级' });
    expect(header).toContain(`考试时间：${bp.duration}`);
    expect(header).toContain(`满分：${bp.fullScore}分`);
    expect(header).toContain('seal-zone');
    expect(header).toContain('密封线内不要答题');
    expect(header).toContain('学校：＿＿＿　班级：＿＿＿　姓名：＿＿＿　学号：＿＿＿');
    expect(header).toContain('s-top">线');
  });

  it('板块标题输出蓝本明细式"（共X题，每题X分，共X分）"，非旧式简写', () => {
    const bp = getExamBlueprint('英语', 'primary_low');
    const plan = { index: 0, name: '听力·听音选图', score: 10, questionCount: 5, kps: [], note: '（5小题，每小题2分）' };
    const sec = buildSectionInstruction(plan, {
      subject: '英语', stage: 'primary_low', stageLabel: '小学低段', examBlueprint: bp,
      materialText: '', region: '', sectionNo: 1, totalScore: 100, isExamPlan: true,
    });
    expect(sec).toContain('一、听力·听音选图。（共5题，每题2分，共10分）');
    expect(sec).not.toContain('右侧标注共');
  });

  it('parseQuestionCount 可解析小学英语听力板块题量（（5小题，每小题2分）→5）', () => {
    expect(parseQuestionCount('（5小题，每小题2分）', 10)).toBe(5);
  });

  it('分值无法均分时标题省略"每题X分"（满足蓝本第6条弹性）', () => {
    const bp = getExamBlueprint('语文', 'middle');
    const plan = { index: 0, name: '现代文阅读', score: 30, questionCount: 4, kps: [], note: '4题' };
    const sec = buildSectionInstruction(plan, {
      subject: '语文', stage: 'middle', stageLabel: '初中', examBlueprint: bp,
      materialText: '', region: '', sectionNo: 1, totalScore: 120, isExamPlan: true,
    });
    expect(sec).toContain('一、现代文阅读。（共4题，共30分）');
  });
});
