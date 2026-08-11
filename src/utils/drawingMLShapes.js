// DrawingML 形状 XML 生成器
// 用于 .docx 后处理：将标记 TextRun 替换为 OOXML DrawingML 线条形状
// 核心思路：wpg 群组 —— 一个 anchor 内包含全部子形状（= Word「组合」后的整体对象）
//   - 单 anchor → 子形状共享同一坐标系，天然对齐（无多 anchor 错位问题）
//   - ✅ 规范完整性：每个 wps:wsp 必须含 <wps:cNvPr> + <wps:bodyPr>，
//     缺失会导致 Word/WPS 解析失败降级到 VML fallback（显示为“图片”）
//   - anchor 必须放在 <w:t> 之前 → 形状从 run 起点绘制，紧贴前文（零多余间距）
// 兼容策略：mc:Choice Requires="wpg"（矢量群组）→ mc:Fallback VML（旧版 Word）

const EMU_PER_DXA = 635;  // 1 DXA = 635 EMU
export { EMU_PER_DXA };
const EMU_PER_PT  = 12700; // 1 pt = 12700 EMU

// ============ mc:AlternateContent 包裹 ============

const mcWrap = (choiceXml, fallbackXml) =>
  `<mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"><mc:Choice Requires="wpg">${choiceXml}</mc:Choice><mc:Fallback>${fallbackXml}</mc:Fallback></mc:AlternateContent>`;

// ============ 群组 anchor 生成器 ============

const CHAR_POS_H = (offEmu = 0) =>
  `<wp:positionH relativeFrom="character"><wp:posOffset>${offEmu}</wp:posOffset></wp:positionH>`;
const CENTER_POS_H =
  '<wp:positionH relativeFrom="column"><wp:align>center</wp:align></wp:positionH>';

/**
 * 子形状（群组内）：规范完整的 wps:wsp —— cNvPr + cNvSpPr + spPr + bodyPr 缺一不可
 * @param {object} s { id, name, x, y, cx, cy, geom('line'|'rect'), color, wEmu, dash }
 */
const childShape = (s) => {
  const dashXml = s.dash ? `<a:prstDash val="${s.dashStyle || 'dash'}"/>` : '';
  return `<wps:wsp><wps:cNvPr id="${s.id}" name="${s.name}"/><wps:cNvSpPr/><wps:spPr><a:xfrm><a:off x="${s.x}" y="${s.y}"/><a:ext cx="${Math.max(1, s.cx)}" cy="${Math.max(1, s.cy)}"/></a:xfrm><a:prstGeom prst="${s.geom}"><a:avLst/></a:prstGeom><a:noFill/><a:ln w="${s.wEmu}"><a:solidFill><a:srgbClr val="${s.color}"/></a:solidFill>${dashXml}</a:ln></wps:spPr><wps:bodyPr/></wps:wsp>`;
};

/**
 * 田字格字符 Textbox 形状：全网格尺寸、透明背景、字符水平居中
 * 与 grid 线同在 wpg 群组坐标系 → 精确复现 CSS position:absolute + top:50% + left:50% + translate(-50%,-50%)
 * 🔧 Word DrawingML textbox 渲染字号偏小（与浏览器 CSS 不一致），放大 30% 补偿
 * 🔧 垂直居中：w:spacing w:before = gridCenter(twips) − charVisualCenter(twips)
 * 🔧 水平微调：w:ind w:left 补偿 CJK 字符侧边距不对称导致的视觉偏左
 */
const textboxTzg = (id, char, gridSizeHp, fontFamily, S) => {
  // Word textbox 渲染字号偏小 → 放大 30% 使视觉比例与预览 CSS（1.8em 格 / 1em 字）一致
  const charSzHp = Math.round(gridSizeHp * 1.3);
  const sz = String(charSzHp);
  const font = fontFamily || 'SimSun';
  // gridCenter = gridSizeHp × 9 twips（grid = 1.8em = 18 × sizeHp DXA，半高 = 9 × sizeHp twips）
  // charVisualCenter ≈ charSzHp × 6.2 twips（汉字视觉中心约在 em-square 62% 处）
  const beforeTwips = Math.max(0, Math.round(gridSizeHp * 9 - charSzHp * 6.2));
  return `<wps:wsp>
    <wps:cNvPr id="${id}" name="TZG-Char"/>
    <wps:cNvSpPr txBox="1"/>
    <wps:spPr>
      <a:xfrm><a:off x="0" y="0"/><a:ext cx="${S}" cy="${S}"/></a:xfrm>
      <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
      <a:noFill/>
    </wps:spPr>
    <wps:txbx>
      <w:txbxContent>
        <w:p>
          <w:pPr>
            <w:rPr><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr>
            <w:ind w:left="3"/>
            <w:spacing w:before="${beforeTwips}"/><w:jc w:val="center"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:eastAsia="${font}"/>
              <w:sz w:val="${sz}"/>
              <w:szCs w:val="${sz}"/>
            </w:rPr>
            <w:t>${escXml(char)}</w:t>
          </w:r>
        </w:p>
      </w:txbxContent>
    </wps:txbx>
    <wps:bodyPr lIns="0" rIns="0" tIns="0" bIns="0"/>
  </wps:wsp>`;
};

/**
 * wpg 群组 anchor：一个整体对象包含多个子形状（各自颜色/线宽）
 * @param {object} o { id, name, posHXml, cx, cy, shapes: childShape参数数组 }
 */
const groupAnchor = (o) => {
  const shapesXml = o.shapesXml || (o.shapes || []).map(childShape).join('');
  const vertOff = o.vertOffEmu || 0;  // 🔧 垂直偏移：负值上移以对齐字符视觉中心
  return `<w:drawing xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"><wp:anchor distT="0" distB="0" distL="0" distR="0" relativeHeight="251659264" behindDoc="1" locked="0" layoutInCell="1" allowOverlap="1">${o.posHXml}<wp:positionV relativeFrom="line"><wp:posOffset>${vertOff}</wp:posOffset></wp:positionV><wp:extent cx="${Math.max(1, o.cx)}" cy="${Math.max(1, o.cy)}"/><wp:effectExtent l="0" t="0" r="9525" b="9525"/><wp:wrapNone/><wp:docPr id="${o.id}" name="${o.name}"/><wp:cNvGraphicFramePr/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"><wpg:wgp><wpg:cNvGrpSpPr/><wpg:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${Math.max(1, o.cx)}" cy="${Math.max(1, o.cy)}"/><a:chOff x="0" y="0"/><a:chExt cx="${Math.max(1, o.cx)}" cy="${Math.max(1, o.cy)}"/></a:xfrm></wpg:grpSpPr>${shapesXml}</wpg:wgp></a:graphicData></a:graphic></wp:anchor></w:drawing>`;
};

// ============ 四线三格：1 个群组 = 4 条水平线 ============

/**
 * 四线三格群组（4 条线一个整体 + VML 回退）
 * @param {number} lineWEmu 线长
 * @param {number} pts 字号 pt
 * @param {number} idBase docPr id 起始
 * @param {boolean} centerAlign 块级居中（true）或行内字符锚点（false）
 * @param {number} gapEmu 行内模式与前文的间隔（EMU，默认0）
 */
const fltLineAnchors = (lineWEmu, pts, idBase, centerAlign = false, gapEmu = 0) => {
  const linePosEm = [0.1, 0.55, 1.0, 1.45];
  const lineColors = ['999999', '999999', '666666', 'e74c3c'];
  const lineWidths = [6350, 6350, 6350, 12700]; // 0.5pt ×3 + 1pt 红线
  const wPt = Math.round(lineWEmu / EMU_PER_PT);
  const groupCy = Math.round(linePosEm[3] * pts * EMU_PER_PT) + 12700;
  const shapes = linePosEm.map((em, i) => ({
    id: idBase + i + 1,
    name: `FLT-Line-${i + 1}`,
    x: 0,
    y: Math.round(em * pts * EMU_PER_PT),
    cx: lineWEmu,
    cy: 0,
    geom: 'line',
    color: lineColors[i],
    wEmu: lineWidths[i],
    dash: false,
  }));
  const choice = groupAnchor({
    id: idBase,
    name: 'FourLineGrid',
    posHXml: centerAlign ? CENTER_POS_H : CHAR_POS_H(gapEmu),
    cx: lineWEmu,
    cy: groupCy,
    shapes,
  });
  const fallback = `<w:pict>${linePosEm.map((em, i) => {
    const yPt = Math.round(em * pts);
    return `<v:line from="0,${yPt}pt" to="${wPt}pt,${yPt}pt" strokecolor="#${lineColors[i]}" strokeweight="${lineWidths[i] / EMU_PER_PT}pt"/>`;
  }).join('')}</w:pict>`;
  return mcWrap(choice, fallback);
};

// ============ 田字格：1 个群组 = 矩形 + 2 条虚线 ============

const tzgShapeAnchors = (S, hS, idBase, sizeHp, centerAlign = false, gapEmu = 0, char = '', fontFamily = 'SimSun') => {
  const sPt = Math.round(S / EMU_PER_PT);
  const hPt = Math.round(hS / EMU_PER_PT);
  const shapes = [
    // 外框矩形（教材蓝 #5B9BD5，0.75pt）
    { id: idBase + 1, name: 'TZG-Box', x: 0, y: 0, cx: S, cy: S, geom: 'rect', color: '5B9BD5', wEmu: 9525, dash: false },
    // 水平虚线（中线，细短虚线 sysDash，0.5pt）
    { id: idBase + 2, name: 'TZG-HLine', x: 0, y: hS, cx: S, cy: 0, geom: 'line', color: '5B9BD5', wEmu: 6350, dash: true, dashStyle: 'sysDash' },
    // 垂直虚线（中线，细短虚线 sysDash，0.5pt）
    { id: idBase + 3, name: 'TZG-VLine', x: hS, y: 0, cx: 0, cy: S, geom: 'line', color: '5B9BD5', wEmu: 6350, dash: true, dashStyle: 'sysDash' },
  ];
  // 🔧 字符 Textbox：跟三条线同在 wpg 群组坐标系 → Word 原生居中（等价 CSS top:50% left:50% translate(-50%,-50%)）
  const tboxXml = char ? textboxTzg(idBase + 4, char, sizeHp, fontFamily, S) : '';
  const shapesXml = shapes.map(childShape).join('') + tboxXml;
  const choice = groupAnchor({
    id: idBase,
    name: 'TianZiGrid',
    posHXml: centerAlign ? CENTER_POS_H : CHAR_POS_H(gapEmu),
    cx: S,
    cy: S,
    shapesXml,
    vertOffEmu: 0,
  });
  const sizePt = sizeHp / 2; // half-points → points
  const font = fontFamily || 'SimSun';
  const fallback = char
    ? `<w:pict><v:group style="position:relative;width:${sPt}pt;height:${sPt}pt;"><v:rect style="width:${sPt}pt;height:${sPt}pt" strokecolor="#5B9BD5" strokeweight="1pt" filled="f"/><v:line from="0,${hPt}pt" to="${sPt}pt,${hPt}pt" strokecolor="#5B9BD5" strokeweight="0.5pt"><v:stroke dashstyle="ShortDash"/></v:line><v:line from="${hPt}pt,0" to="${hPt}pt,${sPt}pt" strokecolor="#5B9BD5" strokeweight="0.5pt"><v:stroke dashstyle="ShortDash"/></v:line><v:rect style="position:absolute;left:0;top:0;width:${sPt}pt;height:${sPt}pt" filled="f" stroked="f"><v:textbox inset="0,0,0,0"><div style="font-family:${font};font-size:${sizePt}pt;text-align:center;line-height:${sPt}pt;">${escXml(char)}</div></v:textbox></v:rect></v:group></w:pict>`
    : `<w:pict><v:rect style="width:${sPt}pt;height:${sPt}pt" strokecolor="#5B9BD5" strokeweight="1pt" filled="f"/><v:line from="0,${hPt}pt" to="${sPt}pt,${hPt}pt" strokecolor="#5B9BD5" strokeweight="0.5pt"><v:stroke dashstyle="ShortDash"/></v:line><v:line from="${hPt}pt,0" to="${hPt}pt,${sPt}pt" strokecolor="#5B9BD5" strokeweight="0.5pt"><v:stroke dashstyle="ShortDash"/></v:line></w:pict>`;
  return mcWrap(choice, fallback);
};

// ============ 块级 OOXML ============

/**
 * 田字格块级 OOXML（居中独立段落）
 * anchor 放 <w:t> 之前：形状从字符锚点起绘制，pad 文本随后撑出布局宽度
 */
export const tianZiGeOOXML = (char, sizeHp, fontFamily = 'SimSun') => {
  const cellW = Math.round(sizeHp * 18); // 1.8em（与预览 CSS width:1.8em 一致，手写余量）
  const cellWEmu = Math.round(cellW * EMU_PER_DXA);
  const S = Math.round(cellWEmu);
  const hS = Math.round(S / 2);
  const sz = String(sizeHp);
  const idBase = Math.floor(Math.random() * 90000) + 10000;
  const EM4 = '&#x2005;'; // FOUR-PER-EM SPACE = 0.25em
  const EN = '&#x2002;';   // EN SPACE = 0.5em（宋体安全，&#x2003; 会显示为可见符号）

  // 🔧 字符由 DrawingML textbox 绘制（与 grid 同坐标系 → 精确居中），段落只保留 pad 撑宽度
  // 🔧 块级模式 behindDoc="0"：防止网格线被表格单元格底纹（w:shd）遮挡
  // 🔧 显式指定 Times New Roman 字体，防止 &#x2005;/&#x2002; Unicode 空格在缺字时渲染为可见点
  const blockAnchors = tzgShapeAnchors(S, hS, idBase, sizeHp, true, 0, char, fontFamily)
    .replace(/behindDoc="1"/g, 'behindDoc="0"');
  return `<w:p>
  <w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="120" w:line="400" w:lineRule="auto"/></w:pPr>
  <w:r>
    <w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="${sz}"/></w:rPr>
    ${blockAnchors}
    <w:t xml:space="preserve">${EM4}${EN}${EN}${EM4}</w:t>
  </w:r>
</w:p>`;
};

/**
 * 四线三格块级 OOXML
 * anchor 在 <w:t> 前（线条与文本区域重叠），¼em 两侧留白（与预览 padding≈0.25em 一致）
 * ⚠️ 禁用 w:spacing（字符间距）——会拉大字距，且历史上曾因正则回溯污染相邻段落
 */
export const fourLineOOXML = (letter, sizeHp, cellWEmuIn) => {
  const pts = sizeHp / 2;
  const sz = String(sizeHp);
  const cellWEmu = cellWEmuIn || Math.round(sizeHp * 20 * EMU_PER_DXA);
  const lineWEmu = cellWEmu; // 线条全宽 = 格子宽（与预览 left:0;right:0 一致）
  const idBase = Math.floor(Math.random() * 90000) + 20000;
  const EM4 = '&#x2005;';

  // 🔧 块级模式 behindDoc="0"：防止线条被表格单元格底纹遮挡
  // 🔧 显式指定 Times New Roman 字体，防止 &#x2005; Unicode 空格在缺字时渲染为可见点
  const blockFltAnchors = fltLineAnchors(lineWEmu, pts, idBase, true)
    .replace(/behindDoc="1"/g, 'behindDoc="0"');
  return `<w:p>
  <w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="120" w:line="440" w:lineRule="auto"/></w:pPr>
  <w:r>
    <w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr>
    ${blockFltAnchors}
    <w:t xml:space="preserve">${EM4}</w:t>
  </w:r>
  <w:r>
    <w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr>
    <w:t xml:space="preserve">${escXml(letter)}</w:t>
  </w:r>
  <w:r>
    <w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr>
    <w:t xml:space="preserve">${EM4}</w:t>
  </w:r>
</w:p>`;
};

/**
 * 四线三格空白块级 OOXML（听写/默写留空场景）
 * pad = ¼em + N×em + ¼em 与 cellW 精确等宽（cellW = N em + 0.5em padding）
 */
export const fourLineBlankOOXML = (sizeHp, cellWEmuIn) => {
  const pts = sizeHp / 2;
  const sz = String(sizeHp);
  const cellWEmu = cellWEmuIn || Math.round(sizeHp * 20 * EMU_PER_DXA);
  const lineWEmu = cellWEmu;
  const emEmu = sizeHp * 10 * EMU_PER_DXA;      // 1em EMU
  const halfEmEmu = Math.round(emEmu / 2);       // 两侧 ¼em pad 合计 0.5em
  const n = Math.max(1, Math.round((cellWEmu - halfEmEmu) / emEmu));
  const pad = '&#x2005;' + '&#x2002;'.repeat(n * 2) + '&#x2005;'; // EN SPACE×2=1em，宋体安全（&#x2003;会fallback为可见点）
  const idBase = Math.floor(Math.random() * 90000) + 20000;

  // 🔧 块级模式 behindDoc="0"：防止线条被表格单元格底纹遮挡
  // 🔧 显式指定 Times New Roman 字体，防止 &#x2005;/&#x2002; Unicode 空格在缺字时渲染为可见点
  const blockFltBlankAnchors = fltLineAnchors(lineWEmu, pts, idBase, true)
    .replace(/behindDoc="1"/g, 'behindDoc="0"');
  return `<w:p>
  <w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="120" w:line="440" w:lineRule="auto"/></w:pPr>
  <w:r>
    <w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr>
    ${blockFltBlankAnchors}
    <w:t xml:space="preserve">${pad}</w:t>
  </w:r>
</w:p>`;
};

// ============ 行内包裹函数 ============

// 行内格子与前文的间隔：0.5em（≈一个字母位，与预览观感一致，不紧贴）
// 实现：anchor posOffset 右移 gapEmu + pad 文本前置 &#x2002;(EN SPACE=0.5em) 撑出布局宽度
const GAP_EN = '&#x2002;';
const gapEmuOf = (sizeHp) => Math.round((sizeHp || 28) * 5 * EMU_PER_DXA); // 0.5em

/** 行内田字格：anchor 在 text 前 + 0.5em 前置间隔 + &#x2005; 天然比例留白 */
const buildInlineTzg = (char, cellWEmu, idBase, rPrXml) => {
  const S = Math.round(cellWEmu);
  const hS = Math.round(S / 2);
  const cellW = Math.round(cellWEmu / EMU_PER_DXA);
  const sizeHp = Math.round(cellW / 18); // 1.8em 反推字号
  const sz = String(sizeHp || 28);
  const EM4 = '&#x2005;';
  const EN = '&#x2002;';   // EN SPACE = 0.5em（宋体安全，&#x2003; 会显示为可见符号）
  // 🔧 显式指定 Times New Roman 字体，防止 &#x2005;/&#x2002; Unicode 空格在缺字时渲染为可见点
  const gridRPr = rPrXml || `<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="${sz}"/></w:rPr>`;
  // 🔧 字符由 DrawingML textbox 绘制（与 grid 同坐标系），段落只保留 pad 撑宽度
  //     尾 pad=1.75em（grid 延伸至 2.3em，文字总宽 2.5em → 不压盖）
  // 🔧 行内模式 behindDoc="0"：防止网格线被段落底纹（w:shd）遮挡
  const anchors = tzgShapeAnchors(S, hS, idBase, sizeHp, false, gapEmuOf(sizeHp), char, 'SimSun')
    .replace(/behindDoc="1"/g, 'behindDoc="0"');
  // 🔧 两个 pad run 均显式指定 Times New Roman，确保 Unicode 空格不可见
  return '<w:r>' + gridRPr + anchors
    + '<w:t xml:space="preserve">' + GAP_EN + EM4 + '</w:t></w:r>'
    + '<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="' + sz + '"/></w:rPr><w:t xml:space="preserve">' + EN + EN + EN + EM4 + '</w:t></w:r>';
};

/** 行内四线三格：anchor 在 text 前，前置 0.5em 间隔 → ¼em pad + letter + ¼em pad */
const buildInlineFlt = (letter, cellWEmu, sizeHp, idBase, rPrXml) => {
  const pts = sizeHp / 2;
  const sz = String(sizeHp || 28);
  const lineWEmu = cellWEmu; // 线条全宽（与预览 ::before left:0;right:0 一致）
  // 🔧 显式指定 Times New Roman 字体 fallback，防止 &#x2005; Unicode 空格在缺字时渲染为可见点
  const gridRPr = rPrXml && rPrXml.trim() ? rPrXml : `<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="${sz}"/></w:rPr>`;
  // 从标记 run 的 rPr 提取字体/颜色/粗斜体 → 注入字母 run，原汁原味复现预览样式
  const src = rPrXml || '';
  const fontMatch = src.match(/w:ascii="([^"]*)"/);
  const font = fontMatch ? fontMatch[1] : 'Times New Roman';
  const colorMatch = src.match(/<w:color\s+w:val="([^"]*)"/);
  const colorTag = colorMatch ? `<w:color w:val="${colorMatch[1]}"/>` : '';
  const hasBold = src.includes('<w:b/>') || src.includes('<w:b ');
  const hasItalic = src.includes('<w:i/>') || src.includes('<w:i ');
  const EM4 = '&#x2005;';
  // 🔧 行内模式 behindDoc="0"：防止线条被段落底纹遮挡
  const anchors = fltLineAnchors(lineWEmu, pts, idBase, false, gapEmuOf(sizeHp))
    .replace(/behindDoc="1"/g, 'behindDoc="0"');
  return '<w:r>' + gridRPr + anchors
    + '<w:t xml:space="preserve">' + GAP_EN + EM4 + '</w:t></w:r>'
    + '<w:r><w:rPr><w:rFonts w:ascii="' + font + '" w:hAnsi="' + font + '"/>' + (hasBold ? '<w:b/>' : '') + (hasItalic ? '<w:i/>' : '') + colorTag + '<w:sz w:val="' + sz + '"/><w:szCs w:val="' + sz + '"/></w:rPr><w:t xml:space="preserve">' + escXml(letter) + '</w:t></w:r>'
    + '<w:r>' + gridRPr + '<w:t xml:space="preserve">' + EM4 + '</w:t></w:r>';
};

/** 行内空白四线三格：anchor 在 text 前，前置 0.5em 间隔，pad(¼em+N×em+¼em) 与 cellW 精确等宽 */
const buildInlineFltBlank = (cellWEmu, sizeHp, idBase, rPrXml) => {
  const pts = sizeHp / 2;
  const sz = String(sizeHp || 28);
  const lineWEmu = cellWEmu;
  const emEmu = sizeHp * 10 * EMU_PER_DXA;
  const halfEmEmu = Math.round(emEmu / 2);
  const n = Math.max(1, Math.round((cellWEmu - halfEmEmu) / emEmu));
  const pad = GAP_EN + '&#x2005;' + '&#x2002;'.repeat(n * 2) + '&#x2005;';
  // 🔧 显式指定 Times New Roman 字体 fallback，防止 &#x2005;/&#x2002; Unicode 空格在缺字时渲染为可见点
  const gridRPr = rPrXml && rPrXml.trim() ? rPrXml : `<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="${sz}"/></w:rPr>`;
  // 🔧 行内模式 behindDoc="0"：防止线条被段落底纹遮挡
  const anchors = fltLineAnchors(lineWEmu, pts, idBase, false, gapEmuOf(sizeHp))
    .replace(/behindDoc="1"/g, 'behindDoc="0"');
  return '<w:r>' + gridRPr + anchors
    + '<w:t xml:space="preserve">' + pad + '</w:t></w:r>';
};

// ============ 标记格式 ============

export const TZG_MARKER = (char, cellWEmu) => `__TZG_${char}_${cellWEmu}__`;
// FLT 标记显式携带 sizeHp：cellW 已改为内容自适应，不能再从 cellW/20 反推字号
export const FLT_MARKER = (letter, cellWEmu, sizeHp) => `__FLT_${letter}_${cellWEmu}_${sizeHp}__`;
/** 空白四线三格标记：仅绘制四条线，不渲染字母（听写/默写留空场景） */
export const FLT_BLANK_MARKER = (cellWEmu, sizeHp) => `__FLT_BLANK_${cellWEmu}_${sizeHp}__`;
/** 注音/拼音标记：后处理替换为 Word 原生 w:ruby 注音元素 */
export const RUBY_MARKER = (baseText, pinyin, baseSizeHp) => `__RUBY_${baseText}_${pinyin}_${baseSizeHp}__`;

// ============ Ruby 注音注入 ============

const buildRubyRun = (baseText, pinyin, baseSizeHp, rPrXml) => {
  // 🔧 拼音注音字号：用基础字号的 65%（CSS 中 rt 为 0.6em），最低 9pt
  //    原 0.5 比例导致拼音在正文 14pt 时仅 7pt，Word 渲染几乎不可见
  const rubySizeHp = Math.max(18, Math.round(baseSizeHp * 0.65));
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const rPr = rPrXml && rPrXml.trim() ? rPrXml : `<w:rPr><w:sz w:val="${baseSizeHp}"/></w:rPr>`;
  return `<w:r>${rPr}<w:ruby>` +
    `<w:rubyPr><w:rubyAlign w:val="center"/><w:hps w:val="${rubySizeHp}"/><w:hpsBaseText w:val="${baseSizeHp}"/></w:rubyPr>` +
    `<w:rt><w:r><w:rPr><w:sz w:val="${rubySizeHp}"/></w:rPr><w:t xml:space="preserve">${esc(pinyin)}</w:t></w:r></w:rt>` +
    `<w:rubyBase><w:r><w:rPr><w:sz w:val="${baseSizeHp}"/></w:rPr><w:t xml:space="preserve">${esc(baseText)}</w:t></w:r></w:rubyBase>` +
    `</w:ruby></w:r>`;
};

/** 后处理：将 __RUBY_...__ 标记替换为 Word 原生 w:ruby 注音元素 */
const injectRubyAnnotations = (docXml) => {
  // 行内 ruby 标记：匹配 <w:r>...<w:t>__RUBY_{base}_{pinyin}_{size}__</w:t>...</w:r>
  // ⚠️ base 用 [^_]+?（非贪婪），pinyin 用 [^_]+?，size 用 \d+
  const rubyRegex = /<w:r\b[^>]*>(\s*(?:<w:rPr[^>]*>(?:(?!<\/w:r>)[\s\S])*?<\/w:rPr>)?)\s*<w:t[^>]*>__RUBY_([^_]+?)_([^_]+?)_(\d+)__<\/w:t>\s*<\/w:r>/gi;
  return docXml.replace(rubyRegex, (match, rPrXml, baseText, pinyin, sizeStr) => {
    const baseSizeHp = parseInt(sizeStr) || 24;
    return buildRubyRun(baseText, pinyin, baseSizeHp, rPrXml);
  });
};

// ============ 后处理管线 ============

export const injectDrawingML = async (zipBuffer) => {
  let JSZip;
  try { JSZip = (await import('jszip')).default; } catch { return zipBuffer; }

  const zip = await JSZip.loadAsync(zipBuffer);
  const docPath = 'word/document.xml';
  let docXml = await zip.file(docPath)?.async('string');
  if (!docXml) return zipBuffer;

  let hasDml = false;

  // ==== 第一遍：独立段落标记 ====
  // ⚠️ 顺序关键：空白标记必须在普通标记之前处理，
  //    否则 __FLT_BLANK_xxx__ 会被普通 FLT 正则的 [^_]+? 误匹配，"BLANK" 被当成字母渲染
  // 🔧 rPr/pPr 内的 [\s\S]*? 改为 (?:(?!<\/w:r>)[\s\S])*? 防跨 <w:r> 边界回溯，
  //    避免段落内同时存在文字 run 和标记 run 时，整个段落被误替换导致文字丢失
  const blockTzg = /<w:p[^>]*>\s*(?:<w:pPr[^>]*>(?:(?!<w:r>)[\s\S])*?<\/w:pPr>)?\s*<w:r[^>]*>\s*(?:<w:rPr[^>]*>(?:(?!<\/w:r>)[\s\S])*?<\/w:rPr>)?\s*<w:t[^>]*>__TZG_([^_]+?)_(\d+)__<\/w:t>\s*<\/w:r>\s*<\/w:p>/g;
  docXml = docXml.replace(blockTzg, (match, char, cellWEmuStr) => {
    hasDml = true;
    const cellWEmu = parseInt(cellWEmuStr);
    const cellW = Math.round(cellWEmu / EMU_PER_DXA);
    const sizeHp = Math.round(cellW / 18);
    return tianZiGeOOXML(char, sizeHp || 28, 'SimSun');
  });

  // 空白四线三格（块级）—— 必须在普通 FLT 之前处理
  // marker 新格式：__FLT_BLANK_{cellWEmu}_{sizeHp}__
  const blockFltBlank = /<w:p[^>]*>\s*(?:<w:pPr[^>]*>(?:(?!<w:r>)[\s\S])*?<\/w:pPr>)?\s*<w:r[^>]*>\s*(?:<w:rPr[^>]*>(?:(?!<\/w:r>)[\s\S])*?<\/w:rPr>)?\s*<w:t[^>]*>__FLT_BLANK_(\d+)_(\d+)__<\/w:t>\s*<\/w:r>\s*<\/w:p>/g;
  docXml = docXml.replace(blockFltBlank, (match, cellWEmuStr, sizeHpStr) => {
    hasDml = true;
    const cellWEmu = parseInt(cellWEmuStr);
    const sizeHp = parseInt(sizeHpStr);
    return fourLineBlankOOXML(sizeHp || 28, cellWEmu);
  });

  const blockFlt = /<w:p[^>]*>\s*(?:<w:pPr[^>]*>(?:(?!<w:r>)[\s\S])*?<\/w:pPr>)?\s*<w:r[^>]*>\s*(?:<w:rPr[^>]*>(?:(?!<\/w:r>)[\s\S])*?<\/w:rPr>)?\s*<w:t[^>]*>__FLT_([^_]+?)_(\d+)_(\d+)__<\/w:t>\s*<\/w:r>\s*<\/w:p>/g;
  docXml = docXml.replace(blockFlt, (match, letter, cellWEmuStr, sizeHpStr) => {
    hasDml = true;
    const cellWEmu = parseInt(cellWEmuStr);
    const sizeHp = parseInt(sizeHpStr);
    return fourLineOOXML(letter, sizeHp || 28, cellWEmu);
  });

  // ==== 第二遍：行内标记 ====
  // ⚠️ 顺序关键：空白标记必须在普通标记之前处理
  // ⚠️ rPr 捕获必须防跨 <w:r> 边界回溯——(?!<\/w:r>) 确保 [\s\S]*? 不会跨到下一个 run
  const inlineTzgRegex = /<w:r\b[^>]*>(\s*(?:<w:rPr[^>]*>(?:(?!<\/w:r>)[\s\S])*?<\/w:rPr>)?)\s*<w:t[^>]*>__TZG_([^_]+?)_(\d+)__<\/w:t>\s*<\/w:r>/gi;
  docXml = docXml.replace(inlineTzgRegex, (match, rPrXml, char, emuStr) => {
    hasDml = true;
    const emu = parseInt(emuStr);
    const idBase = Math.floor(Math.random() * 90000) + 40000;
    return buildInlineTzg(char, emu, idBase, rPrXml);
  });

  // 空白四线三格（行内）—— 必须在普通 FLT 之前处理
  // marker 新格式：__FLT_BLANK_{cellWEmu}_{sizeHp}__
  const inlineFltBlankRegex = /<w:r\b[^>]*>(\s*(?:<w:rPr[^>]*>(?:(?!<\/w:r>)[\s\S])*?<\/w:rPr>)?)\s*<w:t[^>]*>__FLT_BLANK_(\d+)_(\d+)__<\/w:t>\s*<\/w:r>/gi;
  docXml = docXml.replace(inlineFltBlankRegex, (match, rPrXml, emuStr, sizeHpStr) => {
    hasDml = true;
    const emu = parseInt(emuStr);
    const sizeHp = parseInt(sizeHpStr);
    const idBase = Math.floor(Math.random() * 90000) + 50000;
    return buildInlineFltBlank(emu, sizeHp || 28, idBase, rPrXml);
  });

  // marker 新格式：__FLT_{letter}_{cellWEmu}_{sizeHp}__ ⚠️ 防回溯防止 w:spacing 污染上一段落
  const inlineFltRegex = /<w:r\b[^>]*>(\s*(?:<w:rPr[^>]*>(?:(?!<\/w:r>)[\s\S])*?<\/w:rPr>)?)\s*<w:t[^>]*>__FLT_([^_]+?)_(\d+)_(\d+)__<\/w:t>\s*<\/w:r>/gi;
  docXml = docXml.replace(inlineFltRegex, (match, rPrXml, letter, emuStr, sizeHpStr) => {
    hasDml = true;
    const emu = parseInt(emuStr);
    const sizeHp = parseInt(sizeHpStr);
    const idBase = Math.floor(Math.random() * 90000) + 50000;
    return buildInlineFlt(letter, emu, sizeHp || 28, idBase, rPrXml);
  });

  // 替换完成

  // ==== Ruby 注音标记替换 ====
  docXml = injectRubyAnnotations(docXml);

  // --- 命名空间声明：文档根加 xmlns:wps + mc:Ignorable ---
  if (hasDml) {
    const ensureNs = (xml, ns, uri) => {
      let r = xml;
      const decl = `xmlns:${ns}="${uri}"`;
      if (!r.includes(decl)) {
        r = r.replace(/(<w:document[^>]*)/, `$1 ${decl}`);
      }
      if (!r.includes('mc:Ignorable')) {
        r = r.replace(/(<w:document[^>]*)/, `$1 xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" mc:Ignorable="${ns}"`);
      } else {
        const m = r.match(/mc:Ignorable="([^"]*)"/);
        if (m && !m[1].split(/\s+/).includes(ns)) {
          r = r.replace(/mc:Ignorable="([^"]*)"/, `mc:Ignorable="$1 ${ns}"`);
        }
      }
      return r;
    };
    docXml = ensureNs(docXml, 'wpg', 'http://schemas.microsoft.com/office/word/2010/wordprocessingGroup');
    docXml = ensureNs(docXml, 'wps', 'http://schemas.microsoft.com/office/word/2010/wordprocessingShape');
  }

  zip.file(docPath, docXml);

  return await zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
};

// ============ 工具函数 ============

const escXml = (s) => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');
