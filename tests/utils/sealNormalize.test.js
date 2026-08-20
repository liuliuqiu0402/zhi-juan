import { describe, it, expect } from 'vitest';
import { normalizeSealStructure, wrapContentForTheme, splitSealText, splitSealContinuation } from '@/themeConfig.js';

describe('splitSealContinuation 密封线后续页字段', () => {
  it('完整字段 → 仅保留密/封/线（考生信息栏只在第一页）', () => {
    const fields = splitSealText('密封线　学校：＿＿＿　班级：＿＿＿　姓名：＿＿＿　学号：＿＿＿　密封线内不要答题');
    expect(splitSealContinuation(fields)).toEqual(['密', '封', '线']);
  });

  it('字符串输入同样生效；无密/封/线字段时兜底为整条"密封线"', () => {
    expect(splitSealContinuation('学校：＿＿＿　班级：＿＿＿')).toEqual(['密封线']);
    expect(splitSealContinuation('')).toEqual(['密封线']);
    expect(splitSealContinuation(null)).toEqual(['密封线']);
  });

  it('含整条"密封线"字段（未拆字）时原样保留', () => {
    expect(splitSealContinuation(['密封线'])).toEqual(['密封线']);
  });
});

describe('normalizeSealStructure 密封线结构归一化', () => {
  // 用户实际遇到的旧结构：sealed-line 仅"密封线"三字，信息栏/提示为横向 <p>
  const OLD_SEAL = `<div class="sealed-wrapper"><div class="sealed-line"><p>密封线</p>
</div>
<p>学校：＿＿＿　班级：＿＿＿　姓名：＿＿＿　学号：＿＿＿</p>
<p>密封线内不要答题</p>
</div>`;

  const OLD_SEAL_WITH_BODY = `<div class="sealed-wrapper"><div class="sealed-line"><p>密封线</p>
</div>
<p>学校：＿＿＿　班级：＿＿＿　姓名：＿＿＿　学号：＿＿＿</p>
<p>密封线内不要答题</p>
</div>
<h2>一、看拼音写词语</h2><p>正文段落，不应被合并。</p>`;

  it('旧结构：信息栏与提示横向 p 并入 sealed-line，重建为 [sl-dash][sl-text]…交替新结构', () => {
    const out = normalizeSealStructure(OLD_SEAL);
    // 信息栏与提示独立 <p> 已被移除
    expect(out).not.toContain('<p>学校：＿＿＿　班级：＿＿＿　姓名：＿＿＿　学号：＿＿＿</p>');
    expect(out).not.toContain('<p>密封线内不要答题</p>');
    // 新结构：字段整组（sl-text，带旋转高度内联样式），虚线单元（sl-dash）穿插
    expect(out).toMatch(/<span class="sl-text"[^>]*>学校：＿＿＿<\/span>/);
    expect(out).toMatch(/<span class="sl-text"[^>]*>密封线内不要答题<\/span>/);
    // 字段旋转 -90° 防重叠：内联高度 = 字数 × 1.3em（学校：＿＿＿ = 6 字 → calc(7.8em)）
    expect(out).toContain('height: calc(7.8em)');
    // 密/封/线 逐字拆为独立字段（字间虚线相连）
    expect(out).toMatch(/<span class="sl-text"[^>]*>密<\/span>/);
    expect(out).toMatch(/<span class="sl-text"[^>]*>线<\/span>/);
    // 字段顺序：信息 → 提示 → 密封线三字；首尾均为虚线单元
    const pos = (s) => out.indexOf(s);
    expect(pos('>密封线内不要答题</span>')).toBeGreaterThan(pos('>学号：＿＿＿</span>'));
    expect(pos('>密</span>')).toBeGreaterThan(pos('>密封线内不要答题</span>'));
    expect(out.startsWith('<div class="sealed-wrapper"><div class="sealed-line"><span class="sl-dash"></span>')).toBe(true);
    expect(out.endsWith('</span></div></div>')).toBe(true);
    // wrapper 内只剩 sealed-line（原横向 p 已删除）
    expect(out).not.toMatch(/sealed-wrapper"><div class="sealed-line"><p>密封线<\/p>[\s\S]*?<p>/);
  });

  it('幂等：第二次处理无变化', () => {
    const once = normalizeSealStructure(OLD_SEAL);
    expect(normalizeSealStructure(once)).toBe(once);
  });

  it('正文段落（非密封特征开头）不受影响', () => {
    const out = normalizeSealStructure(OLD_SEAL_WITH_BODY);
    expect(out).toContain('<h2>一、看拼音写词语</h2>');
    expect(out).toContain('<p>正文段落，不应被合并。</p>');
  });

  it('新结构（已含 .sl-text）原样保留', () => {
    const NEW_SEAL = `<div class="sealed-wrapper"><div class="sealed-line"><span class="sl-dash"></span><span class="sl-text">学校：＿＿＿</span><span class="sl-dash"></span></div><h2>一、看拼音写词语</h2></div>`;
    expect(normalizeSealStructure(NEW_SEAL)).toBe(NEW_SEAL);
  });

  it('无 sealed-wrapper 的普通内容原样返回', () => {
    const plain = '<p>普通内容</p><p>学校：测试（不是密封线上下文）</p>';
    expect(normalizeSealStructure(plain)).toBe(plain);
  });

  it('主题包装 sealed_exam：仅密封特征 p 并入字段序列，正文不被吞并', () => {
    const wrapped = wrapContentForTheme('<p>学校：＿＿＿</p><p>正文内容第一段</p>', 'sealed_exam');
    // 信息栏并入 sl-text 字段（在密封线三字之前）
    expect(wrapped).toMatch(/<span class="sl-text"[^>]*>学校：＿＿＿<\/span>/);
    expect(wrapped).toMatch(/<span class="sl-text"[^>]*>密<\/span>/);
    expect(wrapped).not.toContain('<p>学校：＿＿＿</p>');
    expect(wrapped).toContain('<p>正文内容第一段</p>');
    // 无主题时同样归一化
    const unwrapped = wrapContentForTheme('<div class="sealed-wrapper"><div class="sealed-line"><p>密封线</p></div><p>姓名：＿＿＿</p></div>', '');
    expect(unwrapped).toMatch(/<span class="sl-text"[^>]*>姓名：＿＿＿<\/span>/);
    expect(unwrapped).not.toContain('<p>姓名：＿＿＿</p>');
  });
});
