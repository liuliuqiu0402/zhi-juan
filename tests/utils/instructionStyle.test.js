import { describe, it, expect } from 'vitest';
import { parseStyleFromInstruction } from '../../src/utils/instructionStyle.js';

describe('parseStyleFromInstruction（组织风格解析）', () => {
  it('新格式【组织风格】unified_context：… → 命中统一情境', () => {
    const r = parseStyleFromInstruction('【组织风格】unified_context：整份资料围绕一个核心主题情境展开');
    expect(r.value).toBe('unified_context');
    expect(r.isUnifiedContext).toBe(true);
    expect(r.isContextFusion).toBe(false);
    expect(r.isContextStyle).toBe(true);
  });

  it('scenario_each → 命中逐题情境（情境融合）', () => {
    const r = parseStyleFromInstruction('【组织风格】scenario_each：每题设置贴近学生生活的独立情境设问');
    expect(r.value).toBe('scenario_each');
    expect(r.isContextFusion).toBe(true);
    expect(r.isContextStyle).toBe(true);
  });

  it('旧风格值 context_fusion → 兼容命中', () => {
    const r = parseStyleFromInstruction('【组织风格】context_fusion：模块化情境');
    expect(r.isContextFusion).toBe(true);
  });

  it('呈现类风格（mindmap）→ 不需要情境框架', () => {
    const r = parseStyleFromInstruction('【组织风格】mindmap：以导图呈现知识点关系');
    expect(r.value).toBe('mindmap');
    expect(r.isContextStyle).toBe(false);
  });

  it('无风格行 → 全 false', () => {
    const r = parseStyleFromInstruction('这是普通指令，没有风格');
    expect(r.value).toBe('');
    expect(r.isContextStyle).toBe(false);
  });

  it('旧格式"命题风格：说明"（无 value 前缀）→ 不命中任何风格值', () => {
    const r = parseStyleFromInstruction('【命题风格】传统命题');
    expect(r.value).toBe('传统命题');
    expect(r.isContextStyle).toBe(false);
  });

  it('多行指令中提取【组织风格】尾行（真实注入场景）', () => {
    const instr = [
      '一、角色与任务…',
      '二、创作要求…',
      '【组织风格】unified_context：整份资料围绕一个核心主题情境展开，情境贯穿全卷。',
    ].join('\n');
    const r = parseStyleFromInstruction(instr);
    expect(r.isUnifiedContext).toBe(true);
    expect(r.isContextStyle).toBe(true);
  });

  it('🔴 模板正文含"按所选组织风格展开情境"字样时不抢占匹配（2026-08 断链回归）', () => {
    // EXAM_BASE 模板正文 L51 有"组织风格"字样（无【】无冒号），旧正则被它抢占 → 风格值恒为空
    const instr = [
      '你是资深命题专家。请为{grade}{subject}命制一份{unit}正式试卷。',
      '【创作要求】',
      '1. 依据2022版新课标命题：素养立意、情境真实适切、设问有层次；按所选组织风格展开情境，情境与学科内容深度融合',
      '【组织风格】unified_context：整份资料围绕一个核心主题情境展开，情境贯穿全卷。',
    ].join('\n');
    const r = parseStyleFromInstruction(instr);
    expect(r.value).toBe('unified_context');
    expect(r.isUnifiedContext).toBe(true);
    expect(r.isContextStyle).toBe(true);
  });

  it('unit_context（单元情境卷）→ 统一情境类，需要情境框架', () => {
    const r = parseStyleFromInstruction('【组织风格】unit_context：以本单元大情境组织，栏目间情境连贯递进');
    expect(r.value).toBe('unit_context');
    expect(r.isUnifiedContext).toBe(true);
    expect(r.isContextStyle).toBe(true);
  });

  it('context_chain（情境化串联）→ 统一情境类，需要情境框架', () => {
    const r = parseStyleFromInstruction('【组织风格】context_chain：以一个贴近生活的大主题串联各知识点呈现');
    expect(r.value).toBe('context_chain');
    expect(r.isUnifiedContext).toBe(true);
    expect(r.isContextStyle).toBe(true);
  });

  it('big_unit / 呈现类风格 → 非情境类，不需要情境框架', () => {
    expect(parseStyleFromInstruction('【组织风格】big_unit：打破课时界限，围绕大概念与任务群整体组织').isContextStyle).toBe(false);
    expect(parseStyleFromInstruction('【组织风格】framework：按知识框架→考点梳理→易错辨析→自测组织').isContextStyle).toBe(false);
    expect(parseStyleFromInstruction('【组织风格】table：以表格对比呈现信息').isContextStyle).toBe(false);
    expect(parseStyleFromInstruction('【组织风格】task_driven：以问题链组织预习任务').isContextStyle).toBe(false);
  });

  it('兼容旧格式：无【】但带冒号的"组织风格：value：说明"可命中（要求冒号防正文误命中）', () => {
    const r = parseStyleFromInstruction('组织风格：scenario_each：每题独立情境');
    expect(r.value).toBe('scenario_each');
    expect(r.isContextStyle).toBe(true);
  });

  it('旧格式无 value 前缀（"组织风格：说明"）→ 说明整行作 value，不命中风格值', () => {
    const r = parseStyleFromInstruction('组织风格：每题独立情境');
    expect(r.isContextStyle).toBe(false);
  });
});
