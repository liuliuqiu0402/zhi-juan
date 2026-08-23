import { describe, it, expect } from 'vitest';
import {
  PROPOSITION_BENCHMARKS,
  GENERAL_CONTENT_QUALITY,
  PASSAGE_LENGTH,
  QUESTION_DEPTH_LEVELS,
  getPropositionBenchmark,
  buildBenchmarkText,
} from '@/config/propositionBenchmarks';
import { getExamBlueprint, EXAM_BLUEPRINTS } from '@/config/examPaperBlueprints';

// 应用支持的全部学科（教材库学科全集，含别名形态）
const ALL_SUBJECTS = ['语文', '数学', '英语', '科学', '物理', '化学', '生物', '历史', '地理', '政治', '道德与法治', '思想政治', '信息科技', '信息技术', '音乐', '美术', '体育', '体育与健康'];
const ALL_STAGES = ['primary_low', 'primary_mid', 'primary_high', 'middle', 'high'];

describe('命题内容质量基准库（全学科 × 学段 × 资料类型）', () => {
  describe('1. 全学科×全学段覆盖（与真题蓝本组合完全对齐）', () => {
    it('蓝本支持的每个 学科×学段 组合，基准库均能命中（无 null）', () => {
      // 从蓝本键提取真实组合：'语文|primary_low' → { subject, stage }；跳过 '|all' 通配
      const bpCombos = Object.keys(EXAM_BLUEPRINTS)
        .filter(k => k.includes('|'))
        .map(k => k.split('|'))
        .filter(([s, st]) => s && st && st !== 'all')
        .map(([s, st]) => ({ subject: s, stage: st }));
      const missing = [];
      for (const { subject, stage } of bpCombos) {
        if (!getPropositionBenchmark(subject, stage)) missing.push(`${subject}|${stage}`);
      }
      expect(missing).toEqual([]);
    });

    it('所有教材学科（含别名）在主学段均能命中', () => {
      const missing = [];
      for (const subject of ALL_SUBJECTS) {
        for (const stage of ALL_STAGES) {
          const bench = getPropositionBenchmark(subject, stage);
          if (!bench) missing.push(`${subject}|${stage}`);
        }
      }
      expect(missing).toEqual([]);
    });

    it('基准库学科键全集与蓝本学科键全集一致（无缺科、无多余）', () => {
      const benchSubjects = Object.keys(PROPOSITION_BENCHMARKS).sort();
      const bpSubjects = [...new Set(Object.keys(EXAM_BLUEPRINTS).map(k => k.split('|')[0]))]
        .filter(s => !['primary', 'middle', 'high'].includes(s)) // 排除学段伪键
        .sort();
      const missingSubjects = bpSubjects.filter(s => !PROPOSITION_BENCHMARKS[s]);
      expect(missingSubjects).toEqual([]);
      const extraSubjects = benchSubjects.filter(s => !bpSubjects.includes(s));
      expect(extraSubjects).toEqual([]);
    });
  });

  describe('2. 学段降级与联合别名', () => {
    it('primary_low/mid/high 降级命中 primary 组', () => {
      for (const subject of ['语文', '数学', '英语', '道德与法治', '科学', '信息科技', '音乐', '美术', '体育']) {
        const base = getPropositionBenchmark(subject, 'primary');
        expect(base, `${subject} primary 必须存在`).toBeTruthy();
        for (const seg of ['primary_low', 'primary_mid', 'primary_high']) {
          expect(getPropositionBenchmark(subject, seg)).toBe(base);
        }
      }
    });

    it('思想政治|primary/middle → 道德与法治，道德与法治|high → 思想政治（跨学段联合别名）', () => {
      expect(getPropositionBenchmark('思想政治', 'primary_low')).toBe(getPropositionBenchmark('道德与法治', 'primary'));
      expect(getPropositionBenchmark('思想政治', 'primary')).toBe(getPropositionBenchmark('道德与法治', 'primary'));
      expect(getPropositionBenchmark('思想政治', 'middle')).toBe(getPropositionBenchmark('道德与法治', 'middle'));
      expect(getPropositionBenchmark('道德与法治', 'high')).toBe(getPropositionBenchmark('思想政治', 'high'));
      // 别名形式
      expect(getPropositionBenchmark('政治', 'primary')).toBe(getPropositionBenchmark('道德与法治', 'primary'));
      expect(getPropositionBenchmark('政治', 'high')).toBe(getPropositionBenchmark('思想政治', 'high'));
      expect(getPropositionBenchmark('信息技术', 'middle')).toBe(getPropositionBenchmark('信息科技', 'middle'));
      expect(getPropositionBenchmark('体育与健康', 'middle')).toBe(getPropositionBenchmark('体育', 'middle'));
    });
  });

  describe('3. 基准数据结构完整性', () => {
    it('每个学科有 basis；每个学段条目：quality 非空数组、checkers 为对象', () => {
      for (const [subject, groups] of Object.entries(PROPOSITION_BENCHMARKS)) {
        expect(groups.basis, `${subject} 学科级 basis`).toBeTruthy();
        for (const [stage, bench] of Object.entries(groups)) {
          if (stage === 'basis') continue; // 学科级依据字段，非学段条目
          expect(Array.isArray(bench.quality), `${subject}|${stage} quality`).toBe(true);
          expect(bench.quality.length, `${subject}|${stage} quality 非空`).toBeGreaterThan(0);
          expect(typeof bench.checkers, `${subject}|${stage} checkers`).toBe('object');
        }
      }
    });

    it('quality 条款无"应该让AI自由发挥"类空泛表述，均为可执行硬规范', () => {
      const weakWords = ['自由发挥', '尽量', '尽可能', '视情况'];
      for (const [subject, groups] of Object.entries(PROPOSITION_BENCHMARKS)) {
        for (const [stage, bench] of Object.entries(groups)) {
          if (stage === 'basis') continue;
          for (const q of bench.quality) {
            for (const w of weakWords) {
              expect(q, `${subject}|${stage}: "${q}" 含空泛词"${w}"`).not.toContain(w);
            }
          }
        }
      }
    });
  });

  describe('4. buildBenchmarkText 注入文本', () => {
    it('返回非空，且包含 依据/硬性要求/真题级样例 结构', () => {
      const text = buildBenchmarkText('英语', 'middle');
      expect(text).toContain('【命题内容质量基准】');
      expect(text).toContain('依据：');
      expect(text).toContain('硬性要求：');
      expect(text).toContain('真题级样例（供模仿，不得照抄）：');
      expect(text).toContain('通用内容底线：');
      expect(text).toContain('素养立意');
    });

    it('includeGeneral=false 时不注入通用底线（exam 蓝本已含 EXAM_NEW_STANDARD，避免重复）', () => {
      const text = buildBenchmarkText('数学', 'middle', false);
      expect(text).not.toContain('通用内容底线：');
      expect(text).toContain('【命题内容质量基准】');
      // 默认 true 注入
      expect(buildBenchmarkText('数学', 'middle', true)).toContain('通用内容底线：');
    });

    it('未命中学科返回空串（不注入噪音）', () => {
      expect(buildBenchmarkText('不存在的学科', 'middle')).toBe('');
      expect(buildBenchmarkText('', 'middle')).toBe('');
    });

    it('样例为"供模仿不得照抄"，不得出现照搬表述', () => {
      const text = buildBenchmarkText('语文', 'primary');
      expect(text).toContain('不得照抄');
      expect(text).not.toContain('直接复制');
    });
  });

  describe('5. 共享数据（语篇长度分档 / 设问层次）', () => {
    it('PASSAGE_LENGTH 各学科各学段 min<max 且为正', () => {
      for (const [subject, stages] of Object.entries(PASSAGE_LENGTH)) {
        for (const [stage, range] of Object.entries(stages)) {
          expect(range.min, `${subject}|${stage} min`).toBeGreaterThan(0);
          expect(range.max, `${subject}|${stage} max`).toBeGreaterThan(range.min);
        }
      }
    });

    it('PASSAGE_LENGTH 学段递进：同一学科学段越高语篇上下限均越大（区间允许重叠）', () => {
      const stages = ['primary', 'middle', 'high'];
      for (const [subject, ranges] of Object.entries(PASSAGE_LENGTH)) {
        // 英语主键为 primary_low/mid/high，单独校验
        if (subject === '英语') {
          const engStages = ['primary_low', 'primary_mid', 'primary_high', 'middle', 'high'];
          for (let i = 1; i < engStages.length; i++) {
            expect(ranges[engStages[i - 1]].max, `${subject} ${engStages[i - 1]}→${engStages[i]}`)
              .toBeLessThanOrEqual(ranges[engStages[i]].max);
            expect(ranges[engStages[i - 1]].min, `${subject} ${engStages[i - 1]}→${engStages[i]}`)
              .toBeLessThan(ranges[engStages[i]].min);
          }
          continue;
        }
        const present = stages.filter(s => ranges[s]);
        for (let i = 1; i < present.length; i++) {
          expect(ranges[present[i - 1]].max, `${subject} ${present[i - 1]}→${present[i]} max 递进`)
            .toBeLessThanOrEqual(ranges[present[i]].max);
          expect(ranges[present[i - 1]].min, `${subject} ${present[i - 1]}→${present[i]} min 递进`)
            .toBeLessThan(ranges[present[i]].min);
        }
      }
    });

    it('QUESTION_DEPTH_LEVELS 覆盖提取/理解/推理三层且各层非空', () => {
      for (const [level, words] of Object.entries(QUESTION_DEPTH_LEVELS)) {
        expect(words.length, `层次 ${level}`).toBeGreaterThan(0);
      }
      expect(Object.keys(QUESTION_DEPTH_LEVELS)).toEqual(expect.arrayContaining(['提取', '理解', '推理']));
    });

    it('GENERAL_CONTENT_QUALITY 非空且每条为素养导向硬规范', () => {
      expect(GENERAL_CONTENT_QUALITY.length).toBeGreaterThanOrEqual(4);
      for (const g of GENERAL_CONTENT_QUALITY) {
        expect(g.length).toBeGreaterThan(10);
      }
    });
  });

  describe('6. 与真题蓝本对齐（同组合下基准与蓝本同时可获取）', () => {
    it('蓝本可命中时基准必可命中', () => {
      for (const subject of ALL_SUBJECTS) {
        for (const stage of ALL_STAGES) {
          const bp = getExamBlueprint(subject, stage);
          const bench = getPropositionBenchmark(subject, stage);
          if (bp && !bench) {
            throw new Error(`蓝本命中但基准落空: ${subject}|${stage}`);
          }
        }
      }
    });
  });
});
