// 🔴 生成端指令覆盖审计（第4/8条固化）：9 资料类型 × 全部学科 × 全学段不得出现"未找到块"缺口
import { describe, it, expect } from 'vitest';
import { useAiGenerator } from '@/composables/useAiGenerator.js';

const GEN_TYPES = ['exam', 'practice', 'special', 'reading', 'preview', 'dictation', 'summary', 'errorbook', 'review'];
const SUBJECTS = ['语文', '数学', '英语', '物理', '化学', '生物', '科学', '道德与法治', '政治', '思想政治', '历史', '地理', '信息科技', '信息技术', '音乐', '美术', '体育'];
const STAGES = [
  { stage: '小学', grade: '一年级' },
  { stage: '小学', grade: '三年级' },
  { stage: '小学', grade: '五年级' },
  { stage: '初中', grade: '七年级' },
  { stage: '高中', grade: '高一' },
];

describe('指令注入覆盖审计（9类型 × 全学科 × 全学段）', () => {
  it('765 组合无任何"未找到块/需人工干预"缺口', () => {
    const { buildGenerationInstruction } = useAiGenerator();
    const missing = [];
    const origWarn = console.warn;
    const origErr = console.error;
    const capture = (msg) => {
      const m = msg.join ? msg.join(' ') : String(msg);
      if (m.includes('未找到') || m.includes('无匹配') || m.includes('需人工干预') || m.includes('缺少')) {
        // 仅捕获指令库/生成链路缺口，忽略网络/服务层运行时日志（重试/降级路径）
        if (m.includes('[instructionLib]') || m.includes('[quality-miss]') || m.includes('[context-miss]') || m.includes('[structure-miss]') || m.includes('[exam-blueprint]')) {
          missing.push(m.slice(0, 110));
        }
      }
    };
    console.warn = (...a) => { capture(a); origWarn(...a); };
    console.error = (...a) => { capture(a); origErr(...a); };
    try {
      for (const st of STAGES) {
        for (const gt of GEN_TYPES) {
          for (const subject of SUBJECTS) {
            try {
              buildGenerationInstruction({
                selectedBooks: [{ subject, stage: st.stage, grade: st.grade, name: `${subject}${st.grade}`, selectedChapters: [{ title: '第一单元', start: 1, end: 30 }] }],
                selectedTemplates: [], scopeType: 'default', propositionStyle: '', genTypes: [gt],
                granularity: 'unit', questionTypes: [], difficultyLevels: [], totalScore: null,
                allowOriginalQuestions: false, specialSubType: '', injectedFragments: [], autoFullInstructions: [],
                mergeChapters: true, engine: 'deepseek',
              });
            } catch (e) {
              missing.push(`[抛异常] ${st.grade}/${gt}/${subject}: ${String(e.message).slice(0, 80)}`);
            }
          }
        }
      }
    } finally {
      console.warn = origWarn;
      console.error = origErr;
    }
    expect(missing).toEqual([]);
  });
});
