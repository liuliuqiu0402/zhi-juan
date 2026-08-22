// 省市差异化：时长/总分覆盖 + 板块分值等比例缩放 + 校验链路同省市蓝本
import { describe, it, expect } from 'vitest';
import { getExamBlueprint, buildExamBlueprintText } from '@/config/examPaperBlueprints.js';
import { EXAM_REGION_CONFIG, EXAM_REGION_OPTIONS } from '@/config/examRegionConfig.js';
import { HardRuleChecker } from '@/utils/qualityChecker';

describe('省市差异化配置', () => {
  it('全国通用默认：中考语文 120 分', () => {
    const bp = getExamBlueprint('语文', 'middle');
    expect(bp.fullScore).toBe(120);
    expect(bp.sections.reduce((a, c) => a + c.score, 0)).toBe(120);
  });

  it('江苏中考语文 150 分/150 分钟，板块和=150', () => {
    const bp = getExamBlueprint('语文', 'middle', '江苏');
    expect(bp.fullScore).toBe(150);
    expect(bp.duration).toBe('150分钟');
    expect(bp.sections.reduce((a, c) => a + c.score, 0)).toBe(150);
  });

  it('江苏中考数学 150 分/120 分钟', () => {
    const bp = getExamBlueprint('数学', 'middle', '江苏');
    expect(bp.fullScore).toBe(150);
    expect(bp.duration).toBe('120分钟');
    expect(bp.sections.reduce((a, c) => a + c.score, 0)).toBe(150);
  });

  it('北京中考语文 100 分/150 分钟（100 分制）', () => {
    const bp = getExamBlueprint('语文', 'middle', '北京');
    expect(bp.fullScore).toBe(100);
    expect(bp.duration).toBe('150分钟');
    expect(bp.sections.reduce((a, c) => a + c.score, 0)).toBe(100);
  });

  it('河南中考物理 70 分（非整除值也能精确=总分）', () => {
    const bp = getExamBlueprint('物理', 'middle', '河南');
    expect(bp.fullScore).toBe(70);
    expect(bp.sections.reduce((a, c) => a + c.score, 0)).toBe(70);
  });

  it('高中（高考）不受省市影响：统一 3+1+2', () => {
    const bpDefault = getExamBlueprint('数学', 'high');
    const bpJs = getExamBlueprint('数学', 'high', '江苏');
    expect(bpDefault.fullScore).toBe(150);
    expect(bpJs.fullScore).toBe(150); // 高考全国统一
  });

  it('未配置省市（如西藏）回退默认', () => {
    const bp = getExamBlueprint('数学', 'middle', '西藏');
    expect(bp.fullScore).toBe(120);
  });

  it('蓝本文本含省市时长/总分', () => {
    const bp = getExamBlueprint('语文', 'middle', '江苏');
    const text = buildExamBlueprintText(bp);
    expect(text).toContain('满分：150分');
    expect(text).toContain('考试时间：150分钟');
  });

  it('配置表完整性：17 省市都有中考语文条目', () => {
    expect(EXAM_REGION_OPTIONS.length).toBeGreaterThanOrEqual(17);
    EXAM_REGION_OPTIONS.forEach(r => {
      const cfg = EXAM_REGION_CONFIG[r];
      expect(cfg, `省份 ${r} 应有配置`).toBeDefined();
      expect(cfg.middle['语文'], `省份 ${r} 中考语文应有配置`).toBeDefined();
      expect(cfg.middle['数学'], `省份 ${r} 中考数学应有配置`).toBeDefined();
    });
  });

  it('校验链路带省市：江苏 150 分内容不误报分值异常', () => {
    // 模拟按江苏 150 分制生成的试卷标题（卷首满分 150 分）
    const content = '<h1>2025—2026学年第二学期初中八年级语文期末试卷</h1>'
      + '<p>（考试时间：150分钟　满分：150分）</p>'
      + '<div class="sealed-wrapper"></div>'
      + '<h2>一、积累与运用。（共8题，共48分）</h2>'
      + '<p class="question">1. 古诗文默写。（6分）（每空1分）</p>'
      + '<h2>二、阅读与鉴赏。（共5题，共42分）</h2>'
      + '<h2>三、写作。（共1题，共60分）</h2>'
      + '<div class="answer-section"><h2>答案</h2></div>';
    const withRegion = HardRuleChecker.check(content, [], '语文', '初中', '八年级', 'exam', undefined, '江苏');
    const errWith = withRegion.filter(i => i.severity === 'error' && (i.type.includes('分值') || i.type.includes('蓝本')));
    expect(errWith.map(i => i.type)).toEqual([]);
  });
});
