// 密封线导出回归测试：密封线由「wpg 浮动群组」承载（不再用表格，不挤压正文）：
// - 页面几何：上下 2cm（1134 DXA）、左右 2.5cm（1417 DXA）页边距（密封文档），正文普通段落流、不被包裹/挤压
// - 一个 page 锚定浮动群组绘制在左侧页边距内（纸边 0~20mm）：虚线(19mm，与上下边距对齐 20~277mm) + 线/封/密 + 提示语 + 信息栏
// - 字符旋转：整框旋转 a:xfrm rot=16200000（字头朝左 = rotate(-90deg)），文字正常序 → 从下往上读
// - 三字均匀嵌在虚线内：线(上1/4=84mm)/封(中=148mm)/密(下1/4=213mm)，右缘贴线；密/封/线 10.5pt，提示语/信息栏 12pt
// - 提示语/信息栏向密封线靠拢（x=8mm）并垂直居中于上下边距中间（两组间留 6mm 间距）；文本框两端留白 1.5mm 防裁剪
// - 信息栏下划线统一为 8 个全角 ＿（横线再长且一致）
import { describe, it, expect } from 'vitest';
import { buildDocxFromDom } from '@/utils/docxBuilder.js';
import { injectDrawingML } from '@/utils/drawingMLShapes.js';
import { splitSealText, wrapContentForTheme } from '@/themeConfig.js';
import { Packer } from 'docx';
import JSZip from 'jszip';

// 多字字段在 OOXML 层倒序存储（渲染后从下往上读为正常内容）
const rev = (s) => [...s].reverse().join('');
// 信息栏下划线统一为 8 个全角 ＿（buildSealZoneHTML/导出端归一化后的标准形态）
const INFO = '学校：＿＿＿＿＿＿＿＿　班级：＿＿＿＿＿＿＿＿　姓名：＿＿＿＿＿＿＿＿　学号：＿＿＿＿＿＿＿＿';
const TIP = '密封线内不要答题';
const INFO_REV = rev(INFO);
const TIP_REV = rev(TIP);

// 模板结构（严格对齐「试卷密封线模板.html」）
const TEMPLATE_HTML = `<div class="sealed-wrapper">
  <div class="seal-zone">
    <div class="seal-note">${TIP}</div>
    <div class="seal-info">${INFO}</div>
    <div class="seal-line"></div>
    <div class="seal-char s-top">线</div>
    <div class="seal-char s-mid">封</div>
    <div class="seal-char s-bot">密</div>
  </div>
  <div class="sealed-content"><h2>一、看拼音，写词语。（共6题，每题2分，共12分）</h2><p>1. 看拼音写词语。</p></div>
</div>`;

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

// 🔧 密封线随页眉渲染：读取含/不含 SealTip 的页眉部件（首页全量 / 后续页仅 虚线+密/封/线）
//    lineOnly 时优先返回左侧（非镜像）版本，偶页镜像 header 由 sealEvenHeaderXml 单独读取
const sealHeaderXml = async (zip, withTip = true) => {
  const names = Object.keys(zip.files).filter((p) => /^word\/header\d+\.xml$/.test(p));
  for (const n of names) {
    const x = await getPart(zip, n);
    if (!x || x.includes('SealTip') !== withTip) continue;
    if (withTip || x.includes(`x="${19 * 36000}"`)) return x;
  }
  // 兜底：未命中左侧版时退回任意匹配项
  for (const n of names) {
    const x = await getPart(zip, n);
    if (x && x.includes('SealTip') === withTip) return x;
  }
  return null;
};

// 🔧 偶页（even）页眉：镜像密封线特征为虚线在右侧 x=191mm（6876000 EMU）
const sealEvenHeaderXml = async (zip) => {
  const names = Object.keys(zip.files).filter((p) => /^word\/header\d+\.xml$/.test(p));
  for (const n of names) {
    const x = await getPart(zip, n);
    if (x && x.includes(`x="${191 * 36000}"`)) return x;
  }
  return null;
};

describe('密封线导出：wpg 浮动群组（左侧页边距内 0~20mm，不挤压正文 + vert270 旋转）', () => {
  it('页面几何：上下 2cm、左右 2.5cm（1417 DXA）页边距（密封文档）', async () => {
    const zip = await buildZip(TEMPLATE_HTML);
    const docXml = await getPart(zip, 'word/document.xml');
    expect(docXml).toMatch(/w:top="1134"/);
    expect(docXml).toMatch(/w:bottom="1134"/);
    expect(docXml).toMatch(/w:left="1417"/);
    expect(docXml).toMatch(/w:right="1417"/);
  });

  it('密封区为浮动群组（SealGroup，page 锚定 0,0），随页眉每页渲染，正文不被表格包裹', async () => {
    const zip = await buildZip(TEMPLATE_HTML);
    const docXml = await getPart(zip, 'word/document.xml');
    const hdrXml = await sealHeaderXml(zip);
    expect(hdrXml).not.toBeNull();
    expect(hdrXml).toContain('SealGroup');
    expect(hdrXml).toContain('<wpg:wgp>');
    expect(hdrXml).toContain('<wp:positionH relativeFrom="page"><wp:posOffset>0</wp:posOffset></wp:positionH>');
    expect(hdrXml).toContain('<wp:positionV relativeFrom="page"><wp:posOffset>0</wp:posOffset></wp:positionV>');
    expect(hdrXml).not.toContain('__SEAL_');
    expect(hdrXml).not.toContain('SealCell'); // 不再用表格单元格
    expect(docXml).not.toContain('SealGroup'); // 正文流干净（密封线不占文档流）
    expect(docXml).toMatch(/w:titlePg\s*\/?>/); // different-first-page：首页全量、后续页仅 线/封/密
  });

  it('页眉双份：首页全量（提示语+信息栏），后续页默认页眉仅 虚线+密/封/线', async () => {
    const zip = await buildZip(TEMPLATE_HTML);
    const full = await sealHeaderXml(zip, true);
    const lineOnly = await sealHeaderXml(zip, false);
    expect(full).not.toBeNull();
    expect(lineOnly).not.toBeNull();
    // 首页页眉：含提示语/信息栏/三字/虚线
    expect(full).toContain('SealTip');
    expect(full).toContain('SealInfo');
    expect(full).toContain('SealTop');
    expect(full).toContain('SealLine');
    // 后续页页眉：仅 虚线 + 密/封/线，无提示语/信息栏
    expect(lineOnly).not.toContain('SealTip');
    expect(lineOnly).not.toContain('SealInfo');
    expect(lineOnly).toContain('SealTop');
    expect(lineOnly).toContain('SealMid');
    expect(lineOnly).toContain('SealBot');
    expect(lineOnly).toContain('SealLine');
    expect(lineOnly).toContain('a:xfrm rot="16200000"');
    expect(lineOnly).toContain('<a:prstDash val="dash"/>');
  });

  it('竖虚线：群组内 line 形状（x=19mm，y=20mm 上边距对齐，dash 贯穿 257mm 至下边距）', async () => {
    const zip = await buildZip(TEMPLATE_HTML);
    const hdrXml = await sealHeaderXml(zip);
    expect(hdrXml).toContain('SealLine');
    // 19mm = 684000 EMU；y=20mm = 720000 EMU（与上边距对齐）
    expect(hdrXml).toContain(`<a:off x="${19 * 36000}" y="${20 * 36000}"/>`);
    expect(hdrXml).toContain('<a:prstDash val="dash"/>');
    expect(hdrXml).toContain(`cy="${257 * 36000}"`);
  });

  it('字符旋转：整框 a:xfrm rot=16200000（逆时针 90°= 字头朝左），文字正常序（旋转后从下往上读）', async () => {
    const zip = await buildZip(TEMPLATE_HTML);
    const hdrXml = await sealHeaderXml(zip);
    expect(hdrXml).toContain('a:xfrm rot="16200000"');
    expect(hdrXml).not.toContain('w:vert');
    expect(hdrXml).not.toContain('w:textDirection');
    expect(hdrXml).toContain(`>${INFO}</w:t>`); // 信息栏正常序（旋转后从下往上读）
    expect(hdrXml).toContain(`>${TIP}</w:t>`); // 提示语正常序
    expect(hdrXml).toContain('>线</w:t>');
    expect(hdrXml).toContain('>封</w:t>');
    expect(hdrXml).toContain('>密</w:t>');
  });

  it('布局坐标：密/封/线 中心 84.25/148.5/212.75mm（1/4、1/2、3/4 均匀），提示语/信息栏靠线且垂直居中成组', async () => {
    const zip = await buildZip(TEMPLATE_HTML);
    const hdrXml = await sealHeaderXml(zip);
    const center = (name) => {
      const m = hdrXml.match(new RegExp(`name="${name}"[\\s\\S]*?<a:xfrm rot="16200000"><a:off x="(-?\\d+)" y="(-?\\d+)"/><a:ext cx="(-?\\d+)" cy="(-?\\d+)"/>`));
      expect(m, `shape ${name} 应有整框旋转坐标`).toBeTruthy();
      const [offX, offY, extX, extY] = [m[1], m[2], m[3], m[4]].map(Number);
      const mm = (v) => v / 36000;
      const x = mm(offX + extX / 2); // 旋转后视觉中心 x（行高方向）
      const y = mm(offY + extY / 2); // 旋转后视觉中心 y（文本方向）
      const top = y - mm(extX / 2);  // 旋转后视觉顶（文本长 = extX）
      const bottom = y + mm(extX / 2);
      return { x, y, top, bottom };
    };
    const top = center('SealTop');
    const mid = center('SealMid');
    const bot = center('SealBot');
    // 1/4、1/2、3/4 均匀分布（间距 64.25mm），右缘贴虚线（线 x=19mm → 10.5pt 字中心≈17.15mm）
    expect(top.y).toBeCloseTo(84.25, 0);
    expect(mid.y).toBeCloseTo(148.5, 0);
    expect(bot.y).toBeCloseTo(212.75, 0);
    expect(bot.y - mid.y).toBeCloseTo(64.25, 0);
    expect(mid.y - top.y).toBeCloseTo(64.25, 0);
    for (const c of [top, mid, bot]) expect(c.x).toBeCloseTo(17.15, 0);
    // 提示语/信息栏：向密封线靠拢（中心 x≈10.9mm），两组垂直居中于上下边距中间、框间距 6mm
    const tip = center('SealTip');
    const info = center('SealInfo');
    expect(tip.x).toBeCloseTo(10.9, 0);
    expect(info.x).toBeCloseTo(10.9, 0);
    expect((tip.top + info.bottom) / 2).toBeCloseTo(148.5, 0); // 组垂直居中
    expect(info.top - tip.bottom).toBeCloseTo(6, 0);           // 两框间距 6mm
    expect(hdrXml).toContain('<w:jc w:val="center"/>');        // 文本居中 → 两端留白防旋转裁剪
  });

  it('字号分级：提示语/信息栏 12pt（sz=24），密/封/线 10.5pt（sz=21），不再使用 13pt/14pt', async () => {
    const zip = await buildZip(TEMPLATE_HTML);
    const hdrXml = await sealHeaderXml(zip);
    expect(hdrXml).toContain('<w:sz w:val="24"/>');
    expect(hdrXml).toContain('<w:sz w:val="21"/>');
    expect(hdrXml).not.toContain('<w:sz w:val="28"/>');
    expect(hdrXml).not.toContain('<w:sz w:val="26"/>');
  });

  it('多字字段粘有密封线字符时剥离尾部（密封线内不要答题封 → 密封线内不要答题）', async () => {
    const zip = await buildZip(`<div class="seal-zone"><div class="seal-note">${TIP}封</div><div class="seal-info">${INFO}密</div><div class="seal-line"></div></div><h2>一、看拼音，写词语。</h2>`);
    const hdrXml = await sealHeaderXml(zip);
    expect(hdrXml).toContain(`>${TIP}</w:t>`); // 剥离"封"后正常
    expect(hdrXml).toContain(`>${INFO}</w:t>`); // 剥离"密"后正常
  });

  it('正文表格（题号得分表）为普通表格（不再嵌套在密封表格内），列宽正常（≈9000，无 100 宽窄列）', async () => {
    const wrapped = wrapContentForTheme(`<h2>第二单元学业测评</h2><p>（满分100分　考试时间60分钟）</p><p>学校：＿＿＿　班级：＿＿＿　姓名：＿＿＿　学号：＿＿＿　密封线内不要答题</p><h2>一、看拼音，写词语。（共6题，每题2分，共12分）</h2><p>1. 看拼音写词语。</p>`, 'sealed_exam');
    const zip = await buildZip(wrapped);
    const docXml = await getPart(zip, 'word/document.xml');
    const grids = [...docXml.matchAll(/<w:gridCol w:w="(\d+)"/g)].map((m) => parseInt(m[1], 10));
    expect(grids.length).toBeGreaterThan(0); // 题号得分表确实被导出
    const sum = grids.reduce((a, b) => a + b, 0);
    // 普通表格按整页宽 9000 DXA（非嵌套），无 100 宽窄列
    expect(sum).toBeGreaterThan(8500);
    expect(grids.every((w) => w > 500)).toBe(true);
  });

  it('无密封线的普通文档：默认 2cm 边距、无密封群组', async () => {
    const zip = await buildZip('<p>普通试卷正文</p>');
    const docXml = await getPart(zip, 'word/document.xml');
    expect(docXml).not.toContain('__SEAL_');
    expect(docXml).not.toContain('SealGroup');
    expect(docXml).toMatch(/w:left="1134"/);
    expect(docXml).toMatch(/w:right="1134"/);
  });

  it('旧 flex 结构（sealed-line + sl-text）→ 兼容导出：字段按标准版式归并', async () => {
    const zip = await buildZip(`<div class="sealed-wrapper" style="font-size:16px"><div class="sealed-line"><span class="sl-dash"></span><span class="sl-text sl-tip">${TIP}</span><span class="sl-dash"></span><span class="sl-text sl-info">${INFO}</span><span class="sl-dash"></span></div><h2>一、看拼音，写词语。</h2></div>`);
    const hdrXml = await sealHeaderXml(zip);
    expect(hdrXml).toContain('SealGroup');
    expect(hdrXml).toContain(`>${INFO}</w:t>`);
    expect(hdrXml).toContain(`>${TIP}</w:t>`);
    expect(hdrXml).toContain('>密</w:t>');
  });

  it('无空格粘连文本（密封线学校：＿＿＿班级：＿＿＿…）→ 字段仍被拆开归并', async () => {
    const fields = splitSealText('密封线学校：＿＿＿班级：＿＿＿姓名：＿＿＿学号：＿＿＿密封线内不要答题');
    expect(fields).toEqual(['密封线内不要答题', '学校：＿＿＿　班级：＿＿＿　姓名：＿＿＿　学号：＿＿＿', '线', '封', '密']);
    const zip = await buildZip('<div class="seal-line" style="font-size:16px">密封线学校：＿＿＿班级：＿＿＿姓名：＿＿＿学号：＿＿＿密封线内不要答题</div>');
    const hdrXml = await sealHeaderXml(zip);
    expect(hdrXml).toContain(`>${INFO}</w:t>`);
  });

  it('真实生成结构 sealed-wrapper + seal-zone：正文内容正常导出（普通段落流）', async () => {
    const zip = await buildZip(TEMPLATE_HTML);
    const docXml = await getPart(zip, 'word/document.xml');
    expect(docXml).toContain('一、看拼音，写词语。');
  });

  it('sealed_exam 卷面固定件（注意事项 + 题号得分表）随主题包装导出', async () => {
    const html = `<div class="sealed-wrapper"><div class="seal-zone"><div class="seal-note">${TIP}</div><div class="seal-info">${INFO}</div><div class="seal-line"></div><div class="seal-char s-top">线</div><div class="seal-char s-mid">封</div><div class="seal-char s-bot">密</div></div><h2>一、看拼音，写词语。（共6题，每题2分，共12分）</h2><p>1. 看拼音写词语。</p><h2>二、组词。（共4题，共8分）</h2><p>1. 组词。</p></div>`;
    const wrapped = wrapContentForTheme(html, 'sealed_exam');
    expect(wrapped).toContain('class="exam-notice"');
    expect(wrapped).toContain('class="exam-score-table"');
    const zip = await buildZip(wrapped);
    const docXml = await getPart(zip, 'word/document.xml');
    expect(docXml).toContain('注意事项');
    expect(docXml).toContain('答题前，请将密封线内的学校、班级、姓名、学号填写清楚。');
    expect(docXml).toContain('题号');
    expect(docXml).toContain('总分');
  });

  it('正规试卷顺序：标题 → 副标题 → 卷首语 → 注意事项 → 得分框 → 正文', async () => {
    const source = `<h2>第二单元学业测评</h2><p>（考试时间：60分钟　满分：100分）</p><p>小朋友，小松鼠奇奇邀请你参加"自然游园会"！请带着你的智慧行囊，和奇奇一起出发吧！</p><p>学校：＿＿＿　班级：＿＿＿　姓名：＿＿＿　学号：＿＿＿　密封线内不要答题</p><h2>一、看拼音，写词语。（共6题，每题2分，共12分）</h2><p>1. 看拼音写词语。</p>`;
    const wrapped = wrapContentForTheme(source, 'sealed_exam');
    const pos = (s) => wrapped.indexOf(s);
    // 卷首语：在副标题之后、注意事项之前（留在卷首区，不夹在得分框与正文之间）
    expect(pos('奇奇')).toBeGreaterThan(pos('（考试时间：60分钟　满分：100分）'));
    expect(pos('class="exam-notice"')).toBeGreaterThan(pos('奇奇'));
    expect(pos('class="exam-score-table"')).toBeGreaterThan(pos('class="exam-notice"'));
    expect(pos('一、看拼音，写词语')).toBeGreaterThan(pos('class="exam-score-table"'));
  });

  it('信息栏下划线统一为 8 个全角 ＿（横线再长且一致）', async () => {
    const zip = await buildZip(`<div class="seal-zone"><div class="seal-note">密封线内不要答题</div><div class="seal-info">学校：＿　班级：＿＿＿　姓名：＿＿　学号：＿＿＿＿</div><div class="seal-line"></div></div><h2>一、看拼音，写词语。</h2>`);
    const hdrXml = await sealHeaderXml(zip);
    expect(hdrXml).toContain('>学校：＿＿＿＿＿＿＿＿　班级：＿＿＿＿＿＿＿＿　姓名：＿＿＿＿＿＿＿＿　学号：＿＿＿＿＿＿＿＿</w:t>');
    expect(hdrXml).not.toContain('学校：＿　班级：＿＿＿');
  });

  it('真实导出链路：编辑器内容无 sealed-wrapper 结构 → wrap 后导出仍含密封线与固定件', async () => {
    const sourceHtml = `<h2>第二单元学业测评</h2><p>（满分100分　考试时间60分钟）</p><p>学校：＿＿＿　班级：＿＿＿　姓名：＿＿＿　学号：＿＿＿　密封线内不要答题</p><h2>一、看拼音，写词语。（共6题，每题2分，共12分）</h2><p>1. 看拼音写词语。</p>`;
    const wrapped = wrapContentForTheme(sourceHtml, 'sealed_exam');
    expect(wrapped).toContain('class="sealed-wrapper"');
    expect(wrapped).toContain('class="seal-zone"');
    const zip = await buildZip(wrapped);
    const docXml = await getPart(zip, 'word/document.xml');
    const hdrXml = await sealHeaderXml(zip);
    expect(hdrXml).toContain('SealGroup');
    expect(hdrXml).toContain('a:xfrm rot="16200000"');
    expect(docXml).toContain('注意事项');
    expect(docXml).toContain('题号');
    expect(docXml).toContain('总分');
  });

  it('密封区文字与虚线为纯黑色（000000），不使用灰色', async () => {
    const zip = await buildZip(TEMPLATE_HTML);
    const hdrXml = await sealHeaderXml(zip);
    expect(hdrXml).toContain('<w:color w:val="000000"/>');  // 文字黑色
    expect(hdrXml).toContain('<a:srgbClr val="000000"/>');  // 虚线黑色
    expect(hdrXml).not.toContain('333333');
  });

  it('非试卷资料类型（课时练等）不出现密封线区域：无 seal-zone/SealGroup/titlePg，也无固定件', async () => {
    const practice = `<h2>Unit 1 同步练习</h2><p>一、填空。（每题2分）</p><p>1. 填一填。</p><p>二、选择。（每题2分）</p><p>1. 选一选。</p>`;
    const wrapped = wrapContentForTheme(practice, 'primary_practice');
    expect(wrapped).not.toContain('seal-zone');
    expect(wrapped).not.toContain('sealed-wrapper');
    expect(wrapped).not.toContain('exam-notice');
    expect(wrapped).not.toContain('exam-score-table');
    const zip = await buildZip(wrapped);
    const docXml = await getPart(zip, 'word/document.xml');
    expect(docXml).not.toContain('SealGroup');
    expect(docXml).not.toContain('w:titlePg');
    expect(docXml).not.toContain('__SEAL_');
  });

  it('所有资料类型导出的 Word 均带页码页脚（普通文档同样有）', async () => {
    const zip = await buildZip('<p>普通资料正文</p>');
    const docXml = await getPart(zip, 'word/document.xml');
    expect(docXml).toContain('w:footerReference');
    const footers = Object.keys(zip.files).filter((p) => /^word\/footer\d+\.xml$/.test(p));
    expect(footers.length).toBeGreaterThan(0);
    const fXml = await getPart(zip, footers[0]);
    expect(fXml).toContain('第');
    expect(fXml).toContain('PAGE'); // Word 页码字段（第X页　共X页）
  });

  it('密封文档：首页与后续页均显示页码（first+default+even 页脚，显式纯黑 000000）', async () => {
    const zip = await buildZip(TEMPLATE_HTML);
    const docXml = await getPart(zip, 'word/document.xml');
    expect(docXml).toMatch(/w:footerReference w:type="first"/);
    expect(docXml).toMatch(/w:footerReference w:type="default"/);
    expect(docXml).toMatch(/w:footerReference w:type="even"/);
    const footers = Object.keys(zip.files).filter((p) => /^word\/footer\d+\.xml$/.test(p));
    expect(footers.length).toBe(3); // first + default + even（奇偶页均有页码）
    for (const fp of footers) {
      const fXml = await getPart(zip, fp);
      expect(fXml).toContain('第');
      expect(fXml).toContain('PAGE');
      expect(fXml).toContain('<w:color w:val="000000"/>'); // 页码纯黑（灰感来自 Word 域底纹显示，非文档颜色）
    }
  });

  it('正式试卷对开版式：even 页眉镜像密封线靠书脊（右侧 191mm），启用奇偶页+对称页边距', async () => {
    const zip = await buildZip(TEMPLATE_HTML);
    const docXml = await getPart(zip, 'word/document.xml');
    // 奇偶页不同页眉/页脚引用
    expect(docXml).toMatch(/w:headerReference w:type="even"/);
    expect(docXml).toMatch(/w:footerReference w:type="even"/);
    // 对称页边距（w:mirrorMargins 注入 pgMar，规范标注）
    expect(docXml).toMatch(/w:mirrorMargins="1"/);
    // settings.xml 启用「奇偶页不同」
    const settingsXml = await getPart(zip, 'word/settings.xml');
    expect(settingsXml).toContain('<w:evenAndOddHeaders/>');
    // even 页眉：密封线水平镜像到右侧（虚线 x=191mm=6876000 EMU，y=20mm 与上边距对齐）
    const evenHdr = await sealEvenHeaderXml(zip);
    expect(evenHdr).not.toBeNull();
    expect(evenHdr).toContain(`<a:off x="${191 * 36000}" y="${20 * 36000}"/>`);
    expect(evenHdr).toContain(`cy="${257 * 36000}"`);
    expect(evenHdr).toContain('<a:prstDash val="dash"/>');
    // 镜像版文字整框旋转 90° CW（字头朝右），与左侧版 270° 关于页面中线对称
    expect(evenHdr).toContain('a:xfrm rot="9000000"');
    expect(evenHdr).not.toContain('a:xfrm rot="16200000"');
    // even 页眉为后续页样式：仅 虚线+密/封/线，无提示语/信息栏
    expect(evenHdr).not.toContain('SealTip');
    expect(evenHdr).not.toContain('SealInfo');
    expect(evenHdr).toContain('>线</w:t>');
    expect(evenHdr).toContain('>封</w:t>');
    expect(evenHdr).toContain('>密</w:t>');
    // 左侧版页眉不受影响（虚线仍在 19mm）
    const leftHdr = await sealHeaderXml(zip, false);
    expect(leftHdr).toContain(`<a:off x="${19 * 36000}" y="${20 * 36000}"/>`);
  });

  it('无密封线的普通文档：不启用奇偶页/对称页边距', async () => {
    const zip = await buildZip('<p>普通资料正文</p>');
    const docXml = await getPart(zip, 'word/document.xml');
    expect(docXml).not.toContain('w:headerReference w:type="even"');
    expect(docXml).not.toMatch(/w:mirrorMargins="1"/);
    const settingsXml = await getPart(zip, 'word/settings.xml');
    expect(settingsXml).not.toContain('<w:evenAndOddHeaders/>');
  });
});
