// ✅ A20（2026-09-14 用户定「分开更好」）：守门条款**段级兜底**回归
// 背景：程序附加段的兜底原先只判【输出格式】在不在、缺则补整块（格式段+【质量底线】）→ 两个漏点：
//   ① 委托正文有【输出格式】但删了【质量底线】→ 兜底不触发 → 质量底线两条通道都不出现（守门条款静默丢失）；
//   ② 委托正文缺【输出格式】→ 【质量底线】被整块重复注入（语义重复表达）。
// 本文件锁死新口径：按段判缺、缺哪段补哪段；段文本与委托正文注入同源（逐字一致）。
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { buildProgramAttach, buildProgramAttachBlocks } from '../../src/utils/programAttach.js';
import { floorClauseSections, getPromptTemplate } from '../../src/config/promptLibrary.js';

const ROOT = path.resolve(__dirname, '../..');

const base = { subject: '数学', stageKey: 'primary_high', genType: 'practice', needsImageText: '练习 课时练' };
const FALLBACK = '底线条款兜底';

describe('守门条款段级兜底（缺哪段补哪段）', () => {
  it('委托正文有【输出格式】但缺【质量底线】→ 只补质量底线段，不重复注入格式段', () => {
    const attach = buildProgramAttach({ ...base, instructionText: '【输出格式】按空位书写' });
    expect(attach).toContain('【质量底线】');                  // 守住底线（原先此处静默丢失）
    expect(attach).not.toContain('【输出格式】（结构清晰');    // 已有则不重复
    const names = buildProgramAttachBlocks({ ...base, instructionText: '【输出格式】按空位书写' })
      .filter((b) => b.name.includes(FALLBACK)).map((b) => b.name).join('|');
    expect(names).toContain('【质量底线】');
    expect(names).not.toContain('【输出格式】');
  });

  it('委托正文含全部守门条款段 → 一段都不补（宁缺勿滥）', () => {
    const all = floorClauseSections({ subject: '数学', stage: 'primary_high', genType: 'practice' })
      .map((s) => s.marker).join('\n');
    const p = { ...base, instructionText: `委托正文\n${all}` };
    expect(buildProgramAttachBlocks(p).some((b) => b.name.includes(FALLBACK))).toBe(false);
  });

  it('已有【输出格式】+【质量底线】时附加段短于两者皆缺（判缺逐段生效）', () => {
    const two = buildProgramAttach({ ...base, instructionText: '【输出格式】x【质量底线】y' }).length;
    const none = buildProgramAttach({ ...base, instructionText: '自定义模板什么都没有' }).length;
    expect(two).toBeLessThan(none);
  });

  it('学科守门条款按学科判缺：数学补【数·量构造纪律】，语文不补（防跨学科广播）', () => {
    const math = buildProgramAttach({ ...base, instructionText: '无' });
    expect(math).toContain('【数·量构造纪律】');
    const chinese = buildProgramAttach({ subject: '语文', stageKey: 'primary_high', genType: 'practice', instructionText: '无' });
    expect(chinese).not.toContain('【数·量构造纪律】');
  });

  it('学科事实底线按该科 stages 白名单：语文本段补、低段不补', () => {
    const mid = buildProgramAttach({ subject: '语文', stageKey: 'primary_mid', genType: 'practice', instructionText: '无' });
    expect(mid).toContain('【语文学科事实底线】');
    const low = buildProgramAttach({ subject: '语文', stageKey: 'primary_low', genType: 'practice', instructionText: '无' });
    expect(low).not.toContain('【语文学科事实底线】');
  });

  it('兜底段文本与委托正文注入同源（逐字一致，防两处漂移）', () => {
    const tpl = getPromptTemplate({ grade: 'middle', subject: '数学', genType: 'practice' }).template;
    const secs = floorClauseSections({ subject: '数学', stage: 'middle', genType: 'practice' })
      .filter((s) => s.group === 'subject-floor');
    expect(secs.length).toBeGreaterThan(0);
    for (const s of secs) {
      expect(tpl).toContain(s.text);           // 委托正文里逐字存在
      expect(s.text.startsWith(s.marker)).toBe(true);
    }
  });

  it('注册表：marker 与段头一致、格式组含输出格式与质量底线、不含创作方向类', () => {
    const secs = floorClauseSections({ subject: '数学', stage: 'middle', genType: 'practice' });
    const formatGroup = secs.filter((s) => s.group === 'format').map((s) => s.marker);
    expect(formatGroup).toEqual(['【输出格式】', '【质量底线】']);
    for (const s of secs) expect(s.text.startsWith(s.marker)).toBe(true);
    // 创作方向类（学科×学段要点 / 学段特点）不进注册表——兜底不得越界成第二份委托书
    expect(secs.some((s) => s.marker.includes('要点') || s.marker.includes('学段特点') || s.marker.includes('创作要求'))).toBe(false);
  });

  it('程序附加段与委托正文分离：附加段不携带委托书结构段', () => {
    const attach = buildProgramAttach({ ...base, instructionText: '无' });
    expect(attach).not.toContain('【创作要求】');
    expect(attach).not.toContain('【素材');
  });
});

// ✅ A20 源码接线守卫：生成端"实发文本"与"面板分段明细"必须同源（面板所见即实发）。
//   旧组件写法在 loadInstructionFromLibrary 里**自行拼装**了兜底（只判【输出格式】、缺则整块补），
//   与 programAttach 的段级兜底形成两套口径 → 有【输出格式】缺【质量底线】时面板补了、实发没补。
describe('源码接线：程序附加段单源（面板明细 = 实发文本）', () => {
  const gm = () => fs.readFileSync(path.join(ROOT, 'src', 'modules', 'GenerateModule.vue'), 'utf8');

  it('实发文本走 buildProgramAttach、面板明细走 buildProgramAttachBlocks', () => {
    const s = gm();
    expect(s).toContain('programAttachText.value = buildProgramAttach(');
    expect(s).toContain('attachBlocks.value = buildProgramAttachBlocks(');
  });

  it('组件内不再自行拼装守门条款兜底（防两套口径漂移）', () => {
    const s = gm();
    for (const dead of ['outputHintText', 'renderContractText', 'validatorPromptText', 'buildOutputFormatHint(']) {
      expect(s).not.toContain(dead);
    }
    expect(s).not.toContain("includes('【输出格式】')"); // 判据唯一实现在 programAttach 单源内
  });
});
