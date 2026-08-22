// 🔴 生成端指令覆盖审计（第4/8条固化）：9 资料类型 × 全部学科不得出现"未找到块"缺口
import { describe, it, expect } from 'vitest';
import { useAiGenerator } from '@/composables/useAiGenerator.js';

const GEN_TYPES = ['exam', 'practice', 'special', 'reading', 'preview', 'dictation', 'summary', 'errorbook', 'review'];
const SUBJECTS = ['语文', '数学', '英语', '物理', '化学', '生物', '科学', '道德与法治', '政治', '思想政治', '历史', '地理', '信息科技', '信息技术', '音乐', '美术', '体育'];

describe('指令注入覆盖审计（9类型 × 全学科）', () => {
  it('无任何"未找到块"缺口警告', () => {
    const { buildGenerationInstruction } = useAiGenerator();
    const missing = [];
    const origWarn = console.warn;
    console.warn = (...args) => {
      const msg = args.join(' ');
      if (msg.includes('[instructionLib]') || msg.includes('[quality-miss]') || msg.includes('[context-miss]') || msg.includes('[core-task-fallback]')) {
        // "内置版本升级"为正常初始化日志，非缺口
        if (msg.includes('未找到') || msg.includes('无匹配') || msg.includes('缺少')) {
          missing.push(msg.slice(0, 120));
        }
      }
      origWarn(...args);
    };
    try {
      for (const gt of GEN_TYPES) {
        for (const subject of SUBJECTS) {
          buildGenerationInstruction({
            selectedBooks: [{ subject, stage: '小学', grade: '三年级', name: `${subject}三年级上册`, selectedChapters: [{ title: '第一单元', start: 1, end: 30 }] }],
            selectedTemplates: [], scopeType: 'default', propositionStyle: '', genTypes: [gt],
            granularity: 'unit', questionTypes: [], difficultyLevels: [], totalScore: null,
            allowOriginalQuestions: false, specialSubType: '', injectedFragments: [], autoFullInstructions: [],
            mergeChapters: true, engine: 'deepseek',
          });
        }
      }
    } finally {
      console.warn = origWarn;
    }
    expect(missing).toEqual([]);
  });
});
