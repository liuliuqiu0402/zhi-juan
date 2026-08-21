import { describe, it, expect } from 'vitest';
import { normalizeSealStructure, wrapContentForTheme, splitSealText, splitSealContinuation, buildSealZoneHTML } from '@/themeConfig.js';

describe('splitSealContinuation 密封线后续页字段', () => {
  it('完整字段 → 仅保留密/封/线（考生信息栏只在第一页）', () => {
    const fields = splitSealText('密封线　学校：＿＿＿　班级：＿＿＿　姓名：＿＿＿　学号：＿＿＿　密封线内不要答题');
    expect(splitSealContinuation(fields)).toEqual(['线', '封', '密']);
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

describe('splitSealText 标准字段序列（信息合并一行、提示在上、密/封/线反序）', () => {
  it('整条文本 → 提示语在上 → 信息栏合并为一行 → 线/封/密（线上密下）', () => {
    expect(splitSealText('密封线　学校：＿＿＿　班级：＿＿＿　姓名：＿＿＿　学号：＿＿＿　密封线内不要答题')).toEqual([
      '密封线内不要答题',
      '学校：＿＿＿　班级：＿＿＿　姓名：＿＿＿　学号：＿＿＿',
      '线',
      '封',
      '密',
    ]);
  });

  it('无空格粘连文本：字段前缀处拆断后仍归并为标准序列', () => {
    expect(splitSealText('密封线学校：＿＿＿班级：＿＿＿姓名：＿＿＿学号：＿＿＿密封线内不要答题')).toEqual([
      '密封线内不要答题',
      '学校：＿＿＿　班级：＿＿＿　姓名：＿＿＿　学号：＿＿＿',
      '线',
      '封',
      '密',
    ]);
  });
});

describe('buildSealZoneHTML 模板密封区（seal-zone）', () => {
  it('标准字段 → seal-note/seal-info/seal-char（线上密下）', () => {
    const out = buildSealZoneHTML(['密封线内不要答题', '学校：＿　班级：＿　姓名：＿　学号：＿', '线', '封', '密']);
    expect(out).toContain('class="seal-zone"');
    expect(out).toContain('class="seal-note">密封线内不要答题</div>');
    // 🔧 信息栏下划线统一为 8 个全角 ＿
    expect(out).toContain('class="seal-info">学校：＿＿＿＿＿＿＿＿　班级：＿＿＿＿＿＿＿＿　姓名：＿＿＿＿＿＿＿＿　学号：＿＿＿＿＿＿＿＿</div>');
    expect(out).toContain('class="seal-line"></div>');
    expect(out).toContain('class="seal-char s-top">线</div>');
    expect(out).toContain('class="seal-char s-mid">封</div>');
    expect(out).toContain('class="seal-char s-bot">密</div>');
  });

  it('源文本未显式给出密/封/线时补全三字（标准试卷必备）', () => {
    const out = buildSealZoneHTML(['学校：＿　班级：＿　姓名：＿　学号：＿', '密封线内不要答题']);
    expect(out).toContain('class="seal-char s-top">线</div>');
    expect(out).toContain('class="seal-char s-mid">封</div>');
    expect(out).toContain('class="seal-char s-bot">密</div>');
  });
});

describe('normalizeSealStructure 密封线结构归一化（→ 模板 seal-zone 结构）', () => {
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

  it('旧结构：信息栏/提示横向 p 并入 seal-zone 字段（seal-note/seal-info/seal-char）', () => {
    const out = normalizeSealStructure(OLD_SEAL);
    // 信息栏与提示独立 <p> 已被移除
    expect(out).not.toContain('<p>学校：＿＿＿　班级：＿＿＿　姓名：＿＿＿　学号：＿＿＿</p>');
    expect(out).not.toContain('<p>密封线内不要答题</p>');
    // 模板结构：seal-zone 内绝对定位字段
    expect(out).toContain('class="seal-zone"');
    expect(out).toMatch(/class="seal-note"[^>]*>密封线内不要答题<\/div>/);
    // 🔧 信息栏下划线统一为 8 个全角 ＿（横线再长且一致）
    expect(out).toMatch(/class="seal-info"[^>]*>学校：＿＿＿＿＿＿＿＿　班级：＿＿＿＿＿＿＿＿　姓名：＿＿＿＿＿＿＿＿　学号：＿＿＿＿＿＿＿＿<\/div>/);
    expect(out).toContain('class="seal-line"></div>');
    expect(out).toMatch(/class="seal-char s-top"[^>]*>线<\/div>/);
    expect(out).toMatch(/class="seal-char s-mid"[^>]*>封<\/div>/);
    expect(out).toMatch(/class="seal-char s-bot"[^>]*>密<\/div>/);
    // 不再包含旧 flex 结构
    expect(out).not.toContain('sl-text');
    expect(out).not.toContain('sl-dash');
    expect(out).not.toContain('sealed-line');
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

  it('新 flex 结构（.sl-text/.sl-dash）统一重建为模板 seal-zone 且幂等', () => {
    const NEW_SEAL = `<div class="sealed-wrapper"><div class="sealed-line"><span class="sl-dash"></span><span class="sl-text sl-info">学校：＿＿＿</span><span class="sl-dash"></span></div><h2>一、看拼音写词语</h2></div>`;
    const out = normalizeSealStructure(NEW_SEAL);
    expect(out).toContain('class="seal-zone"');
    expect(out).toMatch(/class="seal-info"[^>]*>学校：＿＿＿＿＿＿＿＿<\/div>/);
    expect(out).toContain('<h2>一、看拼音写词语</h2>');
    expect(normalizeSealStructure(out)).toBe(out);
  });

  it('内容容器归一化：wrapper 内多兄弟（标题/正文）包进 .sealed-content，幂等', () => {
    const html = `<div class="sealed-wrapper"><div class="sealed-line"><p>密封线</p></div><h2>标题</h2><p>副标题</p><h3>一、看拼音写词语。（共6题，每题5分，共30分）</h3><p>正文</p></div>`;
    const out = normalizeSealStructure(html);
    const pos = (s) => out.indexOf(s);
    expect(pos('class="sealed-content"')).toBeGreaterThan(pos('class="seal-zone"'));
    expect(pos('<h2>标题</h2>')).toBeGreaterThan(pos('class="sealed-content"'));
    expect((out.match(/class="sealed-content"/g) || []).length).toBe(1);
    expect(normalizeSealStructure(out)).toBe(out);
  });

  it('wrapper 内仅密封线时：不创建空的 sealed-content 容器', () => {
    const html = `<div class="sealed-wrapper"><div class="sealed-line"><p>密封线</p></div></div>`;
    const out = normalizeSealStructure(html);
    expect(out).not.toContain('sealed-content');
  });

  it('无 sealed-wrapper 的普通内容原样返回', () => {
    const plain = '<p>普通内容</p><p>学校：测试（不是密封线上下文）</p>';
    expect(normalizeSealStructure(plain)).toBe(plain);
  });

  it('模板 .paper 页面结构（seal-zone + content）→ sealed-wrapper 页面壳，seal-zone 保留', () => {
    const templateHtml = `<div class="paper">
  <div class="seal-zone">
    <div class="seal-note">密封线内不要答题</div>
    <div class="seal-info">学校：＿＿＿＿＿＿　班级：＿＿＿＿＿＿　姓名：＿＿＿＿＿　学号：＿＿＿＿＿＿＿＿</div>
    <div class="seal-line"></div>
    <div class="seal-char s-top">线</div>
    <div class="seal-char s-mid">封</div>
    <div class="seal-char s-bot">密</div>
  </div>
  <div class="content">
    <div class="paper-title">期末考试试卷</div>
    <p>满分：100分</p>
  </div>
  <div class="page-footer">第 1 页　共 1 页</div>
</div>`;
    const out = normalizeSealStructure(templateHtml);
    // 模板页面壳（.paper）被替换为标准 sealed-wrapper，seal-zone 原样保留
    expect(out).toContain('class="sealed-wrapper"');
    expect(out).not.toContain('class="paper"');
    expect(out).toContain('class="seal-zone"');
    expect(out).toMatch(/class="seal-note"[^>]*>密封线内不要答题<\/div>/);
    expect(out).toMatch(/class="seal-char s-top"[^>]*>线<\/div>/);
    // 内容区进入 sealed-content
    expect(out).toContain('class="sealed-content"');
    expect(out).toContain('期末考试试卷');
    // 幂等
    expect(normalizeSealStructure(out)).toBe(out);
  });

  it('模板结构缺省字段时兜底：无提示/信息栏仅密/封/线', () => {
    const html = `<div class="seal-zone"><div class="seal-line"></div><div class="seal-char s-top">线</div><div class="seal-char s-mid">封</div><div class="seal-char s-bot">密</div></div><div class="content"><h2>一、看拼音写词语</h2></div>`;
    const out = normalizeSealStructure(html);
    expect(out).toMatch(/class="sealed-wrapper"/);
    expect(out).toMatch(/class="seal-char s-top"[^>]*>线<\/div>/);
    expect(out).toMatch(/class="seal-char s-mid"[^>]*>封<\/div>/);
    expect(out).toMatch(/class="seal-char s-bot"[^>]*>密<\/div>/);
    expect(out).toContain('一、看拼音写词语');
    expect(normalizeSealStructure(out)).toBe(out);
  });

  it('主题包装 sealed_exam：仅密封特征 p 并入字段序列，正文不被吞并', () => {
    const wrapped = wrapContentForTheme('<p>学校：＿＿＿</p><p>正文内容第一段</p>', 'sealed_exam');
    expect(wrapped).toContain('class="sealed-wrapper"');
    expect(wrapped).toContain('class="seal-zone"');
    expect(wrapped).toMatch(/class="seal-info"[^>]*>学校：＿＿＿＿＿＿＿＿<\/div>/);
    expect(wrapped).toMatch(/class="seal-char s-bot"[^>]*>密<\/div>/);
    expect(wrapped).not.toContain('<p>学校：＿＿＿</p>');
    expect(wrapped).toContain('<p>正文内容第一段</p>');
    // 无主题时同样归一化
    const unwrapped = wrapContentForTheme('<div class="sealed-wrapper"><div class="sealed-line"><p>密封线</p></div><p>姓名：＿＿＿</p></div>', '');
    expect(unwrapped).toMatch(/class="seal-info"[^>]*>姓名：＿＿＿＿＿＿＿＿<\/div>/);
    expect(unwrapped).not.toContain('<p>姓名：＿＿＿</p>');
  });
});
