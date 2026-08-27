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
});
