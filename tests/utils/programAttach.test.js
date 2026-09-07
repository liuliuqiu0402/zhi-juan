import { describe, it, expect } from 'vitest';
import { buildProgramAttach } from '../../src/utils/programAttach.js';
import { buildOutputFormatHint } from '../../src/config/promptLibrary.js';

const ctx = { subject: '数学', stageKey: 'primary_high', genType: 'practice' };

describe('程序性附加段组装（复位 S3.2 委托书纯净化）', () => {
  it('有料组合输出非空（渲染契约/质检规则属程序侧，独立于委托正文）', () => {
    const attach = buildProgramAttach({ ...ctx, needsImageText: '第一单元 随堂巩固', instructionText: '委托正文' });
    expect(attach.length).toBeGreaterThan(0);
    // 附加段与委托正文分离：不携带委托正文内容
    expect(attach).not.toContain('委托正文');
  });

  it('委托正文已含【输出格式】→ 不重复注入格式兜底段', () => {
    const attach = buildProgramAttach({ ...ctx, needsImageText: '第一单元', instructionText: '【输出格式】按空位书写' });
    const hint = buildOutputFormatHint({ subject: '数学', stage: 'primary_high', genType: 'practice' }) || '';
    if (hint) expect(attach).not.toContain(hint.trim().slice(0, 20));
    expect(attach.length).toBeGreaterThan(0);
  });

  it('委托正文缺【输出格式】→ 格式兜底段补入程序附加（防输出格式条款缺失）', () => {
    const attach = buildProgramAttach({ ...ctx, needsImageText: '第一单元', instructionText: '无格式段落的委托正文' });
    const hint = buildOutputFormatHint({ subject: '数学', stage: 'primary_high', genType: 'practice' }) || '';
    if (hint) expect(attach).toContain(hint.trim().slice(0, 20));
    expect(attach.length).toBeGreaterThan(0);
  });

  it('委托含【输出格式】时程序附加短于缺失时（不重复、宁缺勿滥）', () => {
    const withFormat = buildProgramAttach({ ...ctx, instructionText: '【输出格式】内容' }).length;
    const withoutFormat = buildProgramAttach({ ...ctx, instructionText: '没有格式段' }).length;
    expect(withFormat).toBeLessThanOrEqual(withoutFormat);
  });

  it('无渲染契约/规则的组合输出可为空但不抛错', () => {
    // 未知类型/学科组合可能三段皆空——函数须幂等返回空串
    const attach = buildProgramAttach({ subject: '', stageKey: '', genType: 'unknown_type_xyz' });
    expect(typeof attach).toBe('string');
  });
});
