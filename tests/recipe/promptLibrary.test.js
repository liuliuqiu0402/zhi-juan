// 指令库测试：三维度匹配 + 注入指令组装（拼接格式与顺序）
// ============================================================
// 🔴 目的：锁定"所有注入指令都来自指令库"的契约——
//    - 三维度（年级×学科×资料类型）匹配，用户自定义优先，内置兜底
//    - 注入指令拼接顺序固定：【任务】定位行 → 模板正文（占位符替换）→ 【用户附加要求】
//    - 持久化：保存后用户模板自动更新（下次匹配优先返回用户版）
// ============================================================
import { describe, it, expect, beforeEach } from 'vitest';
import {
  getPromptTemplate, savePromptTemplate, deletePromptTemplate,
  buildInjectionInstruction, buildStructureText,
} from '@/config/promptLibrary.js';
import { setLibToggle } from '@/utils/libToggles.js';

const TEST_LIB_KEY = 'test_lib';

beforeEach(() => {
  try { localStorage.removeItem('wisdom_prompt_library_v1'); } catch {}
});

describe('指令库三维度匹配', () => {
  it('无用户自定义时：三维度匹配回退内置模板（exam 类型兜底）', () => {
    const tpl = getPromptTemplate({ grade: 'primary_low', subject: '语文', genType: 'exam' });
    expect(tpl.source).toBe('builtin');
    expect(tpl.template).toContain('命题专家');
    expect(tpl.template).toContain('{structure}'); // 模板保留占位符，渲染时替换
    // 未注册类型也兜底（默认 exam 模板）
    const unknown = getPromptTemplate({ grade: 'middle', subject: '未知学科', genType: 'unknown_type' });
    expect(unknown.source).toBe('builtin');
  });

  it('用户保存后匹配优先返回用户版（持久化自动更新）', () => {
    savePromptTemplate(`${TEST_LIB_KEY}`, { name: '测试模板', template: '你是测试专家。{subject}{grade}{structure}' });
    const tpl = getPromptTemplate({ grade: '', subject: '', genType: TEST_LIB_KEY });
    expect(tpl.source).toBe('user');
    expect(tpl.template).toContain('测试专家');
  });

  it('三维度精确 > 学科×类型 > 类型（用户覆盖优先级）', () => {
    savePromptTemplate('语文|exam', { name: '学科级', template: '学科级模板' });
    savePromptTemplate('primary_low|语文|exam', { name: '三维度', template: '三维度模板' });
    // 三维度精确命中
    expect(getPromptTemplate({ grade: 'primary_low', subject: '语文', genType: 'exam' }).template).toBe('三维度模板');
    // 其他年级命中学科级
    expect(getPromptTemplate({ grade: 'middle', subject: '语文', genType: 'exam' }).template).toBe('学科级模板');
    // 删除三维度后回退学科级
    deletePromptTemplate('primary_low|语文|exam');
    expect(getPromptTemplate({ grade: 'primary_low', subject: '语文', genType: 'exam' }).template).toBe('学科级模板');
  });

  it('删除用户模板后回退内置', () => {
    savePromptTemplate('exam', { name: 'x', template: '用户版' });
    expect(getPromptTemplate({ grade: '', subject: '', genType: 'exam' }).source).toBe('user');
    deletePromptTemplate('exam');
    expect(getPromptTemplate({ grade: '', subject: '', genType: 'exam' }).source).toBe('builtin');
  });
});

describe('注入指令组装（拼接格式与顺序）', () => {
  it('任务定位行固定最前 + 模板正文 + 用户附加最后', () => {
    const tpl = '你是命题专家。{subject}{grade}：{structure}。满分{fullScore}分，时长{duration}。';
    const out = buildInjectionInstruction({
      template: tpl, grade: '小学低段·二年级', subject: '语文', unit: '第二单元识字测评',
      genTypeLabel: '正式考卷', structure: '一、识字与写字（32分）', fullScore: '100', duration: '60分钟',
      extra: '多出几道情境题',
    });
    const lines = out.split('\n');
    // 任务行在最前
    expect(lines[0]).toContain('【任务】');
    expect(lines[0]).toContain('正式考卷');
    expect(lines[0]).toContain('语文');
    expect(lines[0]).toContain('第二单元识字测评');
    expect(lines[0]).toContain('满分100分');
    // 模板正文（占位符已替换）
    expect(out).toContain('你是命题专家。语文小学低段·二年级：一、识字与写字（32分）。满分100分，时长60分钟。');
    // 用户附加最后
    expect(out).toContain('【用户附加要求】');
    expect(out.indexOf('【用户附加要求】')).toBeGreaterThan(out.indexOf('你是命题专家'));
    expect(out).toContain('多出几道情境题');
  });

  it('{material} 占位符渲染为附加提示（真实素材由生成器检索后追加，不重复）', () => {
    const out = buildInjectionInstruction({ template: '素材：{material}', subject: '语文' });
    expect(out).toContain('教材原文由系统按本资料覆盖的知识点检索后');
    expect(out).not.toContain('【教材原文】\n'); // 素材块不进注入框
  });

  it('无用户附加时不输出附加块', () => {
    const out = buildInjectionInstruction({ template: '你是专家。{subject}', subject: '语文' });
    expect(out).not.toContain('用户附加');
  });

  it('{label} 占位符替换为标题类型名（名称样式轮换池注入）', () => {
    const out = buildInjectionInstruction({
      template: '标题格式"{grade}{subject}{scope}{label}"', grade: '小学低段', subject: '语文', unit: '第二单元', label: '综合检测',
    });
    expect(out).toContain('标题格式"小学低段语文第二单元综合检测"');
    // 未传 label 时兜底 genTypeLabel
    const out2 = buildInjectionInstruction({ template: '{label}', genTypeLabel: '正式考卷' });
    expect(out2).toContain('正式考卷');
  });
});

describe('卷面结构文本', () => {
  it('从蓝图生成人话结构（板块+分值）', () => {
    const bp = {
      sections: [
        { name: '识字与写字', score: 32 },
        { name: '积累与运用', score: 24 },
      ],
    };
    const text = buildStructureText(bp);
    expect(text).toContain('一、识字与写字（共X题，共32分）');
    expect(text).toContain('二、积累与运用（共X题，共24分）');
  });

  it('无蓝图返回空串', () => {
    expect(buildStructureText({})).toBe('');
  });
});

describe('指令库条目停用（工具库开关）', () => {
  it('停用内置 cell → 落回 学段×类型 模板（不含学科定制要点）', () => {
    const cellId = 'primary_low|语文|exam';
    setLibToggle('instruction', cellId, false);
    const t = getPromptTemplate({ grade: 'primary_low', subject: '语文', genType: 'exam' });
    expect(t.source).toBe('builtin');
    expect(t.id).toBe('primary_low|exam'); // 落回 5) 学段×类型
    setLibToggle('instruction', cellId, true);
    expect(getPromptTemplate({ grade: 'primary_low', subject: '语文', genType: 'exam' }).id).toBe(cellId);
  });

  it('停用用户自定义 → 落回内置模板', () => {
    savePromptTemplate('语文|exam', { name: '自定义', template: '用户版专属内容' });
    expect(getPromptTemplate({ grade: 'primary_low', subject: '语文', genType: 'exam' }).template).toContain('用户版专属内容');
    setLibToggle('instruction', '语文|exam', false);
    const t = getPromptTemplate({ grade: 'primary_low', subject: '语文', genType: 'exam' });
    expect(t.template).not.toContain('用户版专属内容');
    setLibToggle('instruction', '语文|exam', true);
    deletePromptTemplate('语文|exam');
  });
});
