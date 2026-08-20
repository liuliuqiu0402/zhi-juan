// 密封线导出回归测试：.sealed-line/.seal-line 必须导出为「页眉浮动文本框」——每页重复渲染：
// - first 页眉：完整字段（学校/班级/姓名/学号… + 密/封/线），仅第一页显示（titlePage 区分）
// - default 页眉：仅"密/封/线"，后续页显示（考生信息栏只在第一页出现）
// - 正文不输出密封线段落/图形；分节开启 titlePage + headerReference
// - 样式：一条竖虚线（段落仅左边框 dashed，虚线在文字处断开）+ 文字逆时针旋转 90°（w:textDirection="lrTb"，字头朝左）
// - 深灰 #333333 防发虚模糊；随纸张几何自动适配：锚定页面左侧边距内，cy = 文本区高，虚线上下填满整页
import { describe, it, expect } from 'vitest';
import { buildDocxFromDom } from '@/utils/docxBuilder.js';
import { injectDrawingML } from '@/utils/drawingMLShapes.js';
import { splitSealText, splitSealContinuation } from '@/themeConfig.js';
import { Packer } from 'docx';
import JSZip from 'jszip';

const buildZip = async (html) => {
  const container = document.createElement('div');
  container.style.fontSize = '16px';
  container.innerHTML = html;
  document.body.appendChild(container);
  const doc = buildDocxFromDom(container);
  container.remove();
  const buf = await Packer.toBuffer(doc);
  const processed = await injectDrawingML(buf);
  return JSZip.loadAsync(processed);
};

const getPart = async (zip, name) => {
  const f = zip.file(name);
  return f ? f.async('string') : null;
};

// 读取全部页眉 XML（header1.xml / header2.xml …）
const getHeaders = async (zip) => {
  const paths = Object.keys(zip.files).filter((p) => /^word\/header\d*\.xml$/.test(p) && !zip.files[p].dir);
  const out = [];
  for (const p of paths) out.push(await zip.file(p).async('string'));
  return out;
};

// 模拟 AI 生成的密封线信息栏（全角空格分隔字段，与蓝本 EXAM_PAPER_LAYOUT 第 1 条一致）
// 内联 font-size 16px：jsdom 不实现 CSS 继承，显式指定计算样式使断言可预测
const SEAL_TEXT = '密封线　学校：＿＿＿　班级：＿＿＿　姓名：＿＿＿　学号：＿＿＿　密封线内不要答题';
const SEAL_HTML = `<div class="seal-line" style="font-size:16px">${SEAL_TEXT}</div>`;
// 段落版单虚线边框（pBdr left dashed）——一条竖虚线的实现载体
const DASH_PBDR_LEFT = '<w:pBdr><w:left w:val="dashed" w:sz="8" w:space="4" w:color="333333"/></w:pBdr>';

describe('密封线导出：页眉浮动文本框（first=考生信息栏 / default=仅密封锁，每页重复渲染）', () => {
  it('正文无密封线图形；分节开启 titlePg + first/default 页眉引用', async () => {
    const zip = await buildZip(SEAL_HTML);
    const docXml = await getPart(zip, 'word/document.xml');
    // 正文不再输出密封线 marker 段落/浮动 drawing（改由页眉承载）
    expect(docXml).not.toContain('<w:drawing>');
    expect(docXml).not.toContain('__SEAL_');
    // 分节属性：首页独立页眉 + 两类页眉引用
    expect(docXml).toMatch(/w:titlePg\s*\/?>/);
    expect(docXml).toMatch(/<w:headerReference\s+w:type="first"/);
    expect(docXml).toMatch(/<w:headerReference\s+w:type="default"/);
  });

  it('页眉 XML 声明 DrawingML 命名空间（wp/a/wps/wpg），Word 可正常解析', async () => {
    const zip = await buildZip(SEAL_HTML);
    const fullHeader = (await getHeaders(zip)).find((h) => h.includes('学校：＿＿＿'));
    expect(fullHeader).toContain('xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"');
    expect(fullHeader).toContain('xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"');
    expect(fullHeader).toContain('xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"');
    expect(fullHeader).toContain('xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"');
  });

  it('first 页眉含完整考生信息字段；default 页眉仅"密/封/线"', async () => {
    const zip = await buildZip(SEAL_HTML);
    const headers = await getHeaders(zip);
    expect(headers.length).toBeGreaterThanOrEqual(2);
    // first 页眉：完整字段（信息 → 提示 → 密/封/线 按序）
    const fullHeader = headers.find((h) => h.includes('学校：＿＿＿'));
    expect(fullHeader).toBeTruthy();
    for (const f of ['学校：＿＿＿', '班级：＿＿＿', '姓名：＿＿＿', '学号：＿＿＿', '密封线内不要答题']) {
      expect(fullHeader).toContain(`>${f}</w:t>`);
    }
    // default 页眉：仅"密/封/线"，不含考生信息栏
    const contHeader = headers.find((h) => !h.includes('学校：＿＿＿') && h.includes('>密</w:t>'));
    expect(contHeader).toBeTruthy();
    expect(contHeader).toContain('>封</w:t>');
    expect(contHeader).toContain('>线</w:t>');
    expect(contHeader).not.toContain('密封线内不要答题');
  });

  it('单条竖虚线（段落仅左边框 dashed）+ 文字逆时针旋转 90° lrTb（字头朝左）', async () => {
    const zip = await buildZip(SEAL_HTML);
    const fullHeader = (await getHeaders(zip)).find((h) => h.includes('学校：＿＿＿'));
    // 浮动 drawing + 文本框
    expect(fullHeader).toContain('<w:drawing>');
    expect(fullHeader).toContain('<wp:anchor ');
    expect(fullHeader).toContain('<w:txbxContent>');
    // 仅一条竖虚线：dashed 边框只有 left，无 right
    expect(fullHeader).toContain(DASH_PBDR_LEFT);
    expect(fullHeader).not.toContain('w:right w:val="dashed"');
    // 文字段落逆时针旋转 90°（lrTb，字头朝左），无正立竖排 tbRl
    expect(fullHeader).toContain('<w:textDirection w:val="lrTb"/>');
    expect(fullHeader).not.toContain('w:textDirection w:val="tbRl"');
    // 深灰 #333333：文字与虚线均清晰不发虚
    expect(fullHeader).toContain('<w:color w:val="333333"/>');
    expect(fullHeader).not.toContain('w:color w:val="999999"');
  });

  it('字段顺序：信息 → 提示 → 密/封/线（first 页眉）', async () => {
    const zip = await buildZip(SEAL_HTML);
    const fullHeader = (await getHeaders(zip)).find((h) => h.includes('学校：＿＿＿'));
    const pos = (s) => fullHeader.indexOf(s);
    expect(pos('>密封线内不要答题</w:t>')).toBeGreaterThan(pos('>学号：＿＿＿</w:t>'));
    expect(pos('>密</w:t>')).toBeGreaterThan(pos('>密封线内不要答题</w:t>'));
    expect(pos('>线</w:t>')).toBeGreaterThan(pos('>密</w:t>'));
  });

  it('随纸张几何自动适配：锚定页面左侧边距内（posX=(1134-500)/2=317 DXA），cy=文本区高，字号 24 half-point', async () => {
    const zip = await buildZip(SEAL_HTML);
    const fullHeader = (await getHeaders(zip)).find((h) => h.includes('学校：＿＿＿'));
    // 文本框高 = 整页文本区（14570 DXA × 635 = 9251950 EMU）
    expect(fullHeader).toContain('<wp:extent cx="317500" cy="9251950"/>');
    // 锚定页面左侧边距内：水平居中于左边距（(1134-500)/2=317 DXA），垂直从顶部 margin 开始
    expect(fullHeader).toContain('<wp:positionH relativeFrom="page"><wp:posOffset>201295</wp:posOffset></wp:positionH>');
    expect(fullHeader).toContain('<wp:positionV relativeFrom="page"><wp:posOffset>720090</wp:posOffset></wp:positionV>');
    // 文字行高 = 字号×13 → 312 twips；虚线段高 = 剩余均分 → 405 twips（上下填满）
    expect(fullHeader).toContain('w:line="312" w:lineRule="exact"');
    expect(fullHeader).toContain('w:line="405" w:lineRule="exact"');
    // 字形字号：16px → 24 half-point
    expect(fullHeader).toContain('<w:sz w:val="24"/>');
  });

  it('字段多/行高放不下时等比收缩，全部文字落在虚线区域内不溢出', async () => {
    // 60 个字段（每字段 1 字）@16px：文字总高 18720 > 可用 14570 → 虚线段收缩到 40
    const zip = await buildZip(`<div class="seal-line" style="font-size:16px">${'密 '.repeat(60).trim()}</div>`);
    const headers = await getHeaders(zip);
    expect(headers.some((h) => h.includes('w:line="40" w:lineRule="exact"'))).toBe(true);
  });

  it('检测到密封线时正文左 margin 加大 600 DXA（正文从虚线右侧开始）', async () => {
    const zip = await buildZip(SEAL_HTML);
    const docXml = await getPart(zip, 'word/document.xml');
    expect(docXml).toMatch(/w:left="1734"/);
  });

  it('无密封线的普通文档：不开启 titlePg、无页眉引用、默认左 margin（1134）', async () => {
    const zip = await buildZip('<p>普通试卷正文</p>');
    const docXml = await getPart(zip, 'word/document.xml');
    expect(docXml).not.toContain('__SEAL_');
    expect(docXml).not.toMatch(/w:titlePg\s*\/?>/);
    expect(docXml).not.toContain('headerReference');
    expect(docXml).toMatch(/w:left="1134"/);
    expect((await getHeaders(zip)).length).toBe(0);
  });

  it('AI 多行 HTML（<p>/<br> 间换行文本节点）→ 去除 \\n 后字段仍按序', async () => {
    const zip = await buildZip(`<div class="seal-line" style="font-size:16px"><p>密封线</p>\n<p>学校：＿＿＿　班级：＿＿＿　姓名：＿＿＿　学号：＿＿＿</p>\n<p>密封线内不要答题</p></div>`);
    const fullHeader = (await getHeaders(zip)).find((h) => h.includes('学校：＿＿＿'));
    // \n 不得进入任何 <w:t> 文本
    expect(fullHeader).not.toContain('\n</w:t>');
    for (const f of ['学校：＿＿＿', '班级：＿＿＿', '姓名：＿＿＿', '学号：＿＿＿', '密封线内不要答题']) {
      expect(fullHeader).toContain(`>${f}</w:t>`);
    }
    expect(fullHeader).toContain('>密</w:t>');
    expect(fullHeader).toContain('>线</w:t>');
  });

  it('无空格粘连文本（密封线学校：＿＿＿班级：＿＿＿…）→ 字段仍被拆开，不合并为超长字段', async () => {
    const fields = splitSealText('密封线学校：＿＿＿班级：＿＿＿姓名：＿＿＿学号：＿＿＿密封线内不要答题');
    expect(fields).toEqual(['学校：＿＿＿', '班级：＿＿＿', '姓名：＿＿＿', '学号：＿＿＿', '密封线内不要答题', '密', '封', '线']);
    const zip = await buildZip('<div class="seal-line" style="font-size:16px">密封线学校：＿＿＿班级：＿＿＿姓名：＿＿＿学号：＿＿＿密封线内不要答题</div>');
    const fullHeader = (await getHeaders(zip)).find((h) => h.includes('学校：＿＿＿'));
    for (const f of ['学校：＿＿＿', '班级：＿＿＿', '姓名：＿＿＿', '学号：＿＿＿']) {
      expect(fullHeader).toContain(`>${f}</w:t>`);
    }
    // 文本框宽度按单字段计算（500 DXA → 317500 EMU），不会因粘连横铺整页
    expect(fullHeader).toContain('<wp:extent cx="317500" cy="9251950"/>');
  });

  it('超长字段（混入正文等极端情况）→ 竖排文字列宽按单字符计算（500 DXA），不会横铺整页', async () => {
    const zip = await buildZip(`<div class="seal-line" style="font-size:16px">${'密'.repeat(70)}</div>`);
    const headers = await getHeaders(zip);
    expect(headers.some((h) => h.includes('<wp:extent cx="317500" cy="9251950"/>'))).toBe(true);
  });

  it('真实生成结构 sealed-wrapper + sealed-line + 信息栏 p：信息栏自动并入字段序列，正文内容正常导出', async () => {
    const zip = await buildZip(`<div class="sealed-wrapper" style="font-size:16px"><div class="sealed-line"><p>密封线</p></div><p>学校：＿＿＿　班级：＿＿＿　姓名：＿＿＿　学号：＿＿＿</p><p>密封线内不要答题</p></div><h2>一、看拼音，写词语。</h2>`);
    // 密封区全部内容合并为一个页眉浮动文本框
    const headers = await getHeaders(zip);
    const fullHeader = headers.find((h) => h.includes('学校：＿＿＿'));
    expect(fullHeader).toBeTruthy();
    expect([...fullHeader.matchAll(/<w:txbxContent>/g)].length).toBe(1);
    for (const f of ['学校：＿＿＿', '班级：＿＿＿', '姓名：＿＿＿', '学号：＿＿＿', '密封线内不要答题']) {
      expect(fullHeader).toContain(`>${f}</w:t>`);
    }
    expect(fullHeader).toContain('>密</w:t>');
    // 正文内容正常导出（不再作为密封字段吞并）
    const docXml = await getPart(zip, 'word/document.xml');
    expect(docXml).toContain('一、看拼音，写词语。');
    // 正文 margin 同步加大
    expect(docXml).toMatch(/w:left="1734"/);
  });

  it('新结构 sealed-line 内 .sl-text 序列：整组竖排导出，顺序保持；后续页仅密/封/线', async () => {
    const zip = await buildZip(`<div class="sealed-wrapper" style="font-size:16px"><div class="sealed-line"><span class="sl-dash"></span><span class="sl-text">姓名：＿＿＿</span><span class="sl-dash"></span><span class="sl-text">密</span><span class="sl-dash"></span></div><p>正文段落</p></div>`);
    const headers = await getHeaders(zip);
    const fullHeader = headers.find((h) => h.includes('姓名：＿＿＿'));
    expect(fullHeader).toBeTruthy();
    expect(fullHeader).toContain('>姓名：＿＿＿</w:t>');
    expect(fullHeader).toContain('>密</w:t>');
    const contHeader = headers.find((h) => !h.includes('姓名：＿＿＿') && h.includes('>密</w:t>'));
    expect(contHeader).toBeTruthy();
  });
});
