// 🔴 2026-09-18 用户实证（"编号规则改了却没生效"）根因守卫：
//   ① 内置模板正文内嵌【输出格式】/【质量底线】段；② 生成指令草稿持久化在 localStorage、冷启动直接恢复复用；
//   ③ 程序侧"缺段兜底"只按段头 marker 判在不在 → 旧草稿那段永远"在" → 之后所有"委托正文侧"的条款修订进不了模型
//      （而程序侧修复照常生效 → 表现为"程序侧的好了、提示词侧的没动"）。
//   处置：实发前把 builtin 守门条款段按**当前单源**就地同步（用户内容一字不动；段不存在则由 programAttach 追加）。
import { describe, it, expect } from 'vitest';
import { syncFloorClauseSections } from '../../src/utils/instructionFloorSync.js';
import { floorClauseSections, getPromptTemplate } from '../../src/config/promptLibrary.js';

const CTX = { subject: '英语', stage: 'primary_high', genType: 'summary' };
const FMT_MARKER = '【输出格式】';

describe('守门条款段·实发前单源同步', () => {
  it('旧版【输出格式】段 → 同步为当前单源（新增的序号体系句进得来），用户手写内容一字不动', () => {
    const fmt = floorClauseSections(CTX).find((s) => s.marker === FMT_MARKER);
    expect(fmt, '内容型应有【输出格式】段').toBeTruthy();
    // 构造"旧版草稿"：把格式段里的序号体系句删掉（模拟旧版本冻结的段），前后夹用户自己的内容
    const stale = fmt.text.replace(/^.*序号体系.*$\n?/m, '');
    expect(stale).not.toContain('序号体系');
    const draft = `我的自定义要求：要贴近校园生活。\n\n${stale}\n【我的补充】\n请把重点词加粗。\n`;

    const { text, synced } = syncFloorClauseSections(draft, CTX);
    expect(synced).toContain('输出格式');
    expect(text, '新条款已进入实发文本').toContain('序号体系（全类型通用）');
    expect(text, '用户内容一字不动').toContain('我的自定义要求：要贴近校园生活。');
    expect(text, '非 builtin 段一字不动').toContain('【我的补充】\n请把重点词加粗。');
  });

  it('质量底线段同样同步（同一批内置段）', () => {
    const sec = floorClauseSections(CTX).find((s) => s.marker === '【质量底线】');
    const stale = sec.text.replace(/^.*内容正确.*$\n?/m, '');
    const { text, synced } = syncFloorClauseSections(`${stale}\n`, CTX);
    expect(synced).toContain('质量底线');
    expect(text).toBe(sec.text);
  });

  it('草稿里没有该段 → 不新增（交由 programAttach 段级兜底追加，不双写）', () => {
    const draft = '只有用户内容，没有任何程序段。';
    const { text, synced } = syncFloorClauseSections(draft, CTX);
    expect(text).toBe(draft);
    expect(synced).toEqual([]);
  });

  it('内置模板（已是当前单源）→ 无需同步、文本逐字节不变（幂等）', () => {
    const draft = getPromptTemplate({ grade: 'primary_high', subject: '英语', genType: 'summary' }).template;
    const once = syncFloorClauseSections(draft, CTX);
    expect(once.synced, '内置模板不应触发同步（否则说明单源漂移）').toEqual([]);
    expect(once.text).toBe(draft);
    const twice = syncFloorClauseSections(once.text, CTX);
    expect(twice.text).toBe(once.text);
    expect(twice.synced).toEqual([]);
  });

  it('非 builtin 段（用户自写【…】段）不被触碰', () => {
    const draft = '【我的补充】\n1. 我的规则\n2. 另一条\n';
    const { text, synced } = syncFloorClauseSections(draft, CTX);
    expect(text).toBe(draft);
    expect(synced).toEqual([]);
  });

  it('题类资料同样生效（【输出格式】段按题类单源同步）', () => {
    const ctx = { subject: '英语', stage: 'primary_high', genType: 'practice' };
    const fmt = floorClauseSections(ctx).find((s) => s.marker === FMT_MARKER);
    const stale = fmt.text.replace(/^.*序号体系.*$\n?/m, '');
    const { text, synced } = syncFloorClauseSections(`前缀\n${stale}`, ctx);
    expect(synced).toContain('输出格式');
    expect(text).toContain('序号体系（全类型通用）');
  });
});
