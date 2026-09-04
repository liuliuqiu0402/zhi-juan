// 填空横线行尾自动延伸回归测试：blank-line 在段落末尾 → PositionalTab（<w:ptab/>）自动画到右边距
// 背景：旧实现按内部 &emsp; 数量估算宽度，AI 无法预知行宽 → 横线画到一半就断，需手动补齐；
//       Word 位置制表符（ptab alignment=right relativeTo=margin leader=underscore）可自动延伸到行尾。
import { describe, it, expect } from 'vitest';
import { buildDocxFromDom } from '@/utils/docxBuilder.js';
import { injectDrawingML } from '@/utils/drawingMLShapes.js';
import { Packer } from 'docx';
import JSZip from 'jszip';

// 完整导出链路：buildDocxFromDom → Packer.toBuffer → injectDrawingML
// （jsdom Blob 缺 arrayBuffer，故手动串联而非 htmlToDocxBlob）
const getDocumentXml = async (html, stage) => {
  const container = document.createElement('div');
  container.style.fontSize = '16px';
  container.innerHTML = html;
  document.body.appendChild(container);
  const doc = buildDocxFromDom(container, stage);
  container.remove();
  const buf = await Packer.toBuffer(doc);
  const processed = await injectDrawingML(buf);
  const zip = await JSZip.loadAsync(processed);
  return zip.file('word/document.xml').async('string');
};

describe('数学答题区导出', () => {
  it('作图网格区（square-grid）→ 导出 12列×8行 网格表格', async () => {
    const xml = await getDocumentXml('<p>2. 画出三角形向右平移3格后的图形。</p><div class="square-grid"></div>');
    expect(xml).toContain('<w:tbl>');
    const gridCols = (xml.match(/<w:gridCol/g) || []).length;
    expect(gridCols).toBe(12);
    const rows = (xml.match(/<w:tr\b/g) || []).length;
    expect(rows).toBe(8);
  });

  it('花式竖式格（bracket-grid）→ 导出 3 行括号书写表格', async () => {
    const xml = await getDocumentXml('<p>1. 用竖式计算：46＋28＝</p><div class="bracket-grid"><div></div><div></div><div></div></div>');
    expect(xml).toContain('<w:tbl>');
    const rows = (xml.match(/<w:tr\b/g) || []).length;
    expect(rows).toBe(3);
  });

  it('作图区（draw-area 空盒）→ Word 保留高度（EXACT 行距 + 虚线边框段落），不因空内容丢弃', async () => {
    const xml = await getDocumentXml('<p>1. 画出小球受力示意图。</p><div class="draw-area" style="min-height:40mm;border:1.2px dashed #999999;box-sizing:border-box;"></div>');
    expect(xml).toMatch(/w:lineRule="exact"/);
    expect(xml).toContain('<w:pBdr>');
    expect(xml).toContain('w:val="dashed"');
  });
});

describe('特殊下划线导出（double-line/wavy-underline 不被 ctx 覆盖为 single）', () => {
  it('double-line → w:u w:val="double"（非 single）', async () => {
    const xml = await getDocumentXml('<p>重点词：<span class="double-line">栩栩如生</span></p>');
    // 双线下划线必须出现，且不得退化为 single
    expect(xml).toMatch(/<w:u w:val="double"\/>/);
    expect(xml).not.toMatch(/<w:u w:val="single"\/>/);
  });

  it('wavy-underline → w:u w:val="wave"（docx 枚举 wave，非 wavy）', async () => {
    const xml = await getDocumentXml('<p>病句：<span class="wavy-underline">我们要养成认真听课</span>的好习惯。</p>');
    expect(xml).toMatch(/<w:u w:val="wave"/);
  });

  it('emphasis-dot → w:em 着重号', async () => {
    const xml = await getDocumentXml('<p>加点字：<span class="emphasis-dot">尽</span>力</p>');
    expect(xml).toMatch(/<w:em w:val="dot"\/>/);
  });

  it('underline-sentence（画线句，<u>/<span> 两种形态）→ w:u single（曾缺分支退化为普通文字）', async () => {
    const uXml = await getDocumentXml('<p>用“——”画出比喻句：<u class="underline-sentence">弯弯的月儿像小船</u>。</p>');
    expect(uXml).toContain('<w:u w:val="single"');
    const spanXml = await getDocumentXml('<p>画线：<span class="underline-sentence">可爱的家乡</span></p>');
    expect(spanXml).toContain('<w:u w:val="single"');
  });
});

describe('四线三格文字居中导出（字母进群组 Textbox，不右移出格）', () => {
  it('行内四线格：字母在 w:txbxContent 内（与线条同群组坐标系，Word 原生居中）', async () => {
    const xml = await getDocumentXml('<p>拼音：<span class="four-line-three pinyin-line">cat</span></p>');
    // FLT-Char textbox 存在，字母 cat 在 txbx 内
    expect(xml).toContain('name="FLT-Char"');
    expect(xml).toMatch(/<w:txbxContent>[\s\S]*?<w:t[^>]*>cat<\/w:t>[\s\S]*?<\/w:txbxContent>/);
    // 四线格线条存在
    expect(xml).toContain('name="FourLineGrid"');
    expect(xml).toContain('FLT-Line-4');
  });

  it('块级四线格（独立段落）：字母同样在群组 textbox 内', async () => {
    const xml = await getDocumentXml('<p class="question">1. 抄写单词。</p><div class="four-line-three">dog</div>');
    expect(xml).toContain('name="FLT-Char"');
    expect(xml).toMatch(/<w:txbxContent>[\s\S]*?<w:t[^>]*>dog<\/w:t>[\s\S]*?<\/w:txbxContent>/);
  });
});

describe('拼音格（pinyin-line）导出——与四线三格同 FLT 几何，独立 class 不再退化为纯文字丢格线', () => {
  it('行内拼音格（留空）：画四条格线（FourLineGrid），作答区可见', async () => {
    const xml = await getDocumentXml('<p>写音节：<span class="pinyin-line"></span></p>');
    expect(xml).toContain('name="FourLineGrid"');
    expect(xml).toContain('FLT-Line-4');
  });

  it('行内拼音格（带音节）：音节进 FLT-Char textbox（曾递归子节点 → 无格线纯文本）', async () => {
    const xml = await getDocumentXml('<p>照样子写拼音：<span class="pinyin-line">ba</span></p>');
    expect(xml).toContain('name="FLT-Char"');
    expect(xml).toMatch(/<w:txbxContent>[\s\S]*?<w:t[^>]*>ba<\/w:t>[\s\S]*?<\/w:txbxContent>/);
    expect(xml).toContain('name="FourLineGrid"');
    expect(xml).toContain('FLT-Line-4');
  });

  it('块级拼音格（独立段落）：同样按格线群组导出', async () => {
    const xml = await getDocumentXml('<p class="question">1. 写拼音。</p><div class="pinyin-line">ma</div>');
    expect(xml).toContain('name="FourLineGrid"');
    expect(xml).toMatch(/<w:txbxContent>[\s\S]*?<w:t[^>]*>ma<\/w:t>[\s\S]*?<\/w:txbxContent>/);
  });

  it('四线格配色与预览口径一致（曾第 4 线红色 1pt：e74c3c 已移除；soft #999999 + strong #666666 第 3 线）', async () => {
    const xml = await getDocumentXml('<p>抄写：<span class="four-line-three">cat</span></p>');
    expect(xml).not.toContain('e74c3c');
    expect(xml).toContain('999999');
    expect(xml).toContain('666666');
  });
});

describe('作文格（zuo-wen-ge）导出', () => {
  it('标准 span 格子结构 → 导出为格子表格', async () => {
    const xml = await getDocumentXml(
      '<div class="zuo-wen-ge"><div><span>&emsp;</span><span>&emsp;</span></div><div><span>&emsp;</span><span>&emsp;</span></div></div>'
    );
    expect(xml).toContain('<w:tbl>');
    expect(xml).toContain('<w:tc>'); // 格子单元格
  });

  it('AI 输出直接 &emsp; 文本（无 span 格子）→ 兜底生成格子，不导出空白', async () => {
    const xml = await getDocumentXml(
      '<div class="zuo-wen-ge">&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;</div>'
    );
    expect(xml).toContain('<w:tbl>');
    expect(xml).toContain('<w:tc>');
  });

  it('完全空方框（无内容）→ 兜底生成默认 20×10 格子，不导出空白', async () => {
    const xml = await getDocumentXml('<div class="zuo-wen-ge"></div>');
    expect(xml).toContain('<w:tbl>');
    expect(xml).toContain('<w:tc>');
  });

  it('格子尺寸按学段：小学 12mm≈680 / 初中 10mm≈567 / 高中 宽0.75cm≈425 DXA（尺寸不缩放）', async () => {
    const html = '<div class="zuo-wen-ge"><span>&emsp;</span><span>&emsp;</span></div>';
    const run = async (stage) => {
      const xml = await getDocumentXml(html, stage);
      const m = xml.match(/<w:tcW[^>]*w:w="(\d+)"/);
      return m ? parseInt(m[1], 10) : 0;
    };
    expect(await run('primary')).toBe(680);
    expect(await run('middle')).toBe(567);
    expect(await run('high')).toBe(425);
    expect(await run()).toBe(567); // 默认 middle
  });

  it('每行格子数按 A4 可用宽度放最多整数格（普通文档：初中 17 列，与预览 auto-fill 同口径）', async () => {
    // 普通文档（左右边距 20mm×2）：floor((210-40)/10mm) = 17 列 —— 与预览 CSS repeat(auto-fill, 10mm) 严格一致
    const html = '<div class="zuo-wen-ge">' + Array.from({ length: 45 }, () => '<span>&emsp;</span>').join('') + '</div>';
    const xml = await getDocumentXml(html, 'middle');
    // 表格总宽 = 每行格数 × 567（格子规格尺寸不变）
    const tblW = xml.match(/<w:tblW[^>]*w:w="(\d+)"/);
    expect(tblW).toBeTruthy();
    expect(parseInt(tblW[1], 10)).toBe(17 * 567);
  });
});

describe('填空横线导出：段落末尾 blank-line 自动延伸到行尾', () => {
  it('引导语 + blank-line 同行（段落末尾）→ 文本后输出 PositionalTab 引导线', async () => {
    const xml = await getDocumentXml('<p>我的想法：<span class="blank-line">&emsp;&emsp;&emsp;</span></p>');
    expect(xml).toContain('>我的想法：</w:t>');
    // <w:ptab> 位置制表符：右对齐到页边距 + 下划线引导线
    expect(xml).toContain('<w:ptab');
    expect(xml).toContain('w:alignment="right"');
    expect(xml).toContain('w:relativeTo="indent"');
    expect(xml).toContain('w:leader="underscore"');
    // 不再输出 NBSP 填充串
    expect(xml).not.toContain('<w:u w:val="single"');
  });

  it('书写区整行（blank-line 为段落唯一元素）→ 同样输出 PositionalTab', async () => {
    const xml = await getDocumentXml('<p><span class="blank-line">&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;</span></p>');
    const ptabCount = (xml.match(/<w:ptab/g) || []).length;
    expect(ptabCount).toBe(1);
    expect(xml).toContain('w:leader="underscore"');
  });

  it('blank-line 非末尾（后跟文字）→ 退回 NBSP 固定宽度 + 下划线，不输出 ptab', async () => {
    const xml = await getDocumentXml('<p>先写<span class="blank-line">&emsp;&emsp;</span>后还有字</p>');
    expect(xml).not.toContain('<w:ptab');
    // NBSP 填充 + 下划线（原逻辑保底）
    expect(xml).toContain('<w:u w:val="single"');
    expect(xml).toContain('>后还有字</w:t>');
  });

  it('多个 blank-line：仅最后一个（段落末尾）输出 ptab，其余 NBSP', async () => {
    const xml = await getDocumentXml('<p>甲<span class="blank-line">&emsp;</span>乙<span class="blank-line">&emsp;</span></p>');
    expect((xml.match(/<w:ptab/g) || []).length).toBe(1);
    expect(xml).toContain('>乙</w:t>');
  });

  it('u.blank-N 句末填空（段落末尾）→ NBSP 空格串 + 下划线（可编辑），不输出 ptab', async () => {
    const xml = await getDocumentXml('<p>照样子写句子：<u class="blank-6">&emsp;&emsp;</u></p>');
    expect(xml).not.toContain('<w:ptab');
    // 空格串 + 下划线：Word/WPS 中可逐格增删空格微调长度（ptab 是制表符对象，显示 →、一碰整条删）
    expect(xml).toContain('<w:u w:val="single"');
    expect(xml).toContain('>照样子写句子：</w:t>');
  });

  it('u.blank-N 句内填空（非末尾）→ 仍为 NBSP 固定宽度 + 下划线，不输出 ptab', async () => {
    const xml = await getDocumentXml('<p>光合作用的场所是<u class="blank-2">&emsp;</u>。</p>');
    expect(xml).not.toContain('<w:ptab');
    expect(xml).toContain('<w:u w:val="single"');
    expect(xml).toContain('>。</w:t>');
  });

  it('选择题括号空 span.blank-N（段落末尾）→ 不延伸，保持括号', async () => {
    const xml = await getDocumentXml('<p>下列哪项是正确的<span class="blank-3">&emsp;</span></p>');
    expect(xml).not.toContain('<w:ptab');
    expect(xml).toMatch(/>\(/); // 括号 + NBSP 占位
  });

  it('无 class 裸 u 全角空格整行（段落末尾）→ 导出端兜底 ptab 自动延伸', async () => {
    const line = '<p><u>' + '　'.repeat(40) + '</u></p>';
    const xml = await getDocumentXml(line);
    expect(xml).toContain('<w:ptab');
    expect(xml).toContain('w:leader="underscore"');
  });

  it('无 class 裸 u 全角空格（非末尾，后跟文字）→ NBSP 固定宽度 + 下划线，不输出 ptab', async () => {
    const xml = await getDocumentXml('<p>答案：<u>　　</u>后还有字</p>');
    expect(xml).not.toContain('<w:ptab');
    expect(xml).toContain('<w:u w:val="single"');
    expect(xml).toContain('>后还有字</w:t>');
  });

  it('u 内含文字（下划线强调）→ 不受影响（不按空白横线处理）', async () => {
    const xml = await getDocumentXml('<p>重点：<u>词汇</u></p>');
    expect(xml).not.toContain('<w:ptab');
    expect(xml).toContain('>词汇</w:t>');
  });

  it('裸全角空格文本段落（未包 u，写作答题行）→ 导出端兜底 ptab 自动延伸', async () => {
    const xml = await getDocumentXml('<p>' + '　'.repeat(10) + '</p>');
    expect(xml).toContain('<w:ptab');
    expect(xml).toContain('w:leader="underscore"');
  });

  it('行内夹带连续全角空格（未包 <u>/括号，非末尾）→ 按排版空格保留不画线（所见即所得：预览为空格、导出不再变横线）', async () => {
    const xml = await getDocumentXml('<p>答案：' + '　'.repeat(4) + '后还有字</p>');
    expect(xml).not.toContain('<w:ptab');
    expect(xml).not.toContain('<w:u w:val="single"');
    expect(xml).toMatch(/<w:t[^>]*>[^<]*后还有字<\/w:t>/); // 空格与文字同 run 原样保留
  });

  it('选项间距用多个全角空格分隔 → 不画横线（回归：曾把 "A. 甲　　B. 乙" 间距在 Word 导出成下划线）', async () => {
    const xml = await getDocumentXml('<p>1. A. 苹果' + '　'.repeat(3) + 'B. 香蕉' + '　'.repeat(3) + 'C. 梨</p>');
    expect(xml).not.toContain('<w:ptab');
    expect(xml).not.toContain('<w:u w:val="single"');
    expect(xml).toContain('苹果');
    expect(xml).toContain('香蕉');
  });

  it('单个全角空格分隔（排版分隔）→ 不按填空横线处理', async () => {
    const xml = await getDocumentXml('<p>甲' + '　'.repeat(1) + '乙</p>');
    expect(xml).not.toContain('<w:ptab');
    expect(xml).toContain('甲');
    expect(xml).toContain('乙');
  });

  it('emphasis-dot 包 NBSP 空白（段落末尾，课文填空空位误包加点标记）→ 导出兜底 ptab 画线', async () => {
    const xml = await getDocumentXml('<p>请在横线上作答<span class="emphasis-dot">' + '&nbsp;'.repeat(8) + '</span></p>');
    expect(xml).toContain('<w:ptab');
    expect(xml).toContain('w:leader="underscore"');
    expect(xml).not.toContain('emphasis-dot');
  });

  it('emphasis-dot 包 NBSP 空白（句内，后还有字）→ NBSP 定宽 + 下划线，不输出 ptab', async () => {
    const xml = await getDocumentXml('<p>空气是那么<span class="emphasis-dot">' + '&nbsp;'.repeat(8) + '</span>，天空是那么清鲜。</p>');
    expect(xml).not.toContain('<w:ptab');
    expect(xml).toContain('<w:u w:val="single"');
    expect(xml).toContain('天空是那么清鲜');
  });
});

