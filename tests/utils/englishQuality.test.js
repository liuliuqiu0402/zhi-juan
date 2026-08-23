// 英语内容质量基准：听力原文强制 + 学科标准注入规范（基于教育部命题通知/2022课标/真题结构调研）
import { describe, it, expect } from 'vitest';
import { HardRuleChecker } from '@/utils/qualityChecker';
import { getExamBlueprint, buildExamBlueprintText } from '@/config/examPaperBlueprints.js';

describe('英语内容质量基准', () => {
  it('学科标准注入含听力硬规范（原文/语速分档/口语特征/填表题型）', () => {
    const bp = getExamBlueprint('英语', 'middle');
    const text = buildExamBlueprintText(bp);
    expect(text).toContain('听力原文');
    expect(text).toContain('语速按学段分档');
    expect(text).toContain('停顿、重复、纠正、连读弱读');
    expect(text).toContain('听短文填表');
    expect(text).toContain('禁止把听力题写成书面阅读题');
  });

  it('英语含听力板块但无原文 → error 退稿', () => {
    const content = '<h1>英语期末试卷</h1>'
      + '<h2>一、听力·听音选图（10分）</h2>'
      + '<p class="question">1. 听录音，选出正确的图片。（1分）</p>'
      + '<div class="answer-section"><h2>答案</h2><div class="answer-item">1. B</div></div>';
    const issues = HardRuleChecker.check(content, [], '英语', '小学', '三年级', 'exam');
    const errs = issues.filter(i => i.type === '听力原文缺失');
    expect(errs.length).toBe(1);
    expect(errs[0].severity).toBe('error');
  });

  it('英语含听力板块且答案页附原文 → 通过', () => {
    const content = '<h1>英语期末试卷</h1>'
      + '<h2>一、听力·听音选图（10分）</h2>'
      + '<p class="question">1. 听录音，选出与所听内容相符的图片。（1分）</p>'
      + '<div class="answer-section"><h2>答案与听力原文</h2>'
      + '<div class="answer-item">1. A</div>'
      + '<div class="answer-item"><b>听力原文</b>：M: What time do you get up? W: I get up at six thirty.</div></div>';
    const issues = HardRuleChecker.check(content, [], '英语', '小学', '三年级', 'exam');
    expect(issues.filter(i => i.type === '听力原文缺失').length).toBe(0);
  });

  it('非英语学科不受听力校验影响', () => {
    const content = '<h1>语文期末试卷</h1><h2>一、识字与写字（32分）</h2>';
    const issues = HardRuleChecker.check(content, [], '语文', '小学', '二年级', 'exam');
    expect(issues.filter(i => i.type === '听力原文缺失').length).toBe(0);
  });
});
