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

// ═══════════ 纸张几何（单一事实来源，供密封线等浮动对象与正文分节共用）═══════════
// A4 竖版：210mm × 297mm，标准页边距 2cm（1134 DXA）。密封线随纸张/边距自动适配。
export const PAGE_GEOMETRY = {
  widthTwips: 11906,   // A4 宽 210mm
  heightTwips: 16838,  // A4 高 297mm
  marginTopTwips: 1134,    // 2cm
  marginBottomTwips: 1134, // 2cm
  marginLeftTwips: 1134,   // 2cm
  marginRightTwips: 1134,  // 2cm
};

// ============ mc:AlternateContent 包裹 ============

// 🔧 不再用 mc:AlternateContent 包裹：实测 Word 打开时遇 wpg 在 mc:Ignorable 中会跳过
//    Choice 分支改用 VML Fallback，且 Word 的 PDF 导出器（ExportAsFixedFormat）不处理
//    mc:AlternateContent 内容 → 田字格在 Word 导出 PDF 中整体丢失。
//    Word 2010+/WPS 均原生支持 wpg（wordprocessingGroup），直接输出 w:drawing 即可，
//    VML Fallback 仅为旧版 Word 提供降级，此处弃用（旧版 Word 无田字格但文字不丢）。
const mcWrap = (choiceXml, fallbackXml) => choiceXml;

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
 * 🔧 垂直居中：wps:bodyPr anchor="ctr"，文本框内容相对 textbox 整体垂直居中
 * 🔧 水平微调：w:ind w:left 补偿 CJK 字符侧边距不对称导致的视觉偏左
 * 🔧 CT_WordprocessingShape 顺序（ISO 29500）：cNvPr → cNvSpPr → spPr → txbx → bodyPr，
 *    txbx 必须在 bodyPr 前——实测顺序颠倒时 Word 静默忽略 txbx（格子字不显示），WPS 宽容不报错
 */
const textboxTzg = (id, char, gridSizeHp, fontFamily, S, yOff = 0, cyOverride = 0) => {
  // Word textbox 渲染字号偏小 → 放大 30% 使视觉比例与预览 CSS（1.8em 格 / 1em 字）一致
  const charSzHp = Math.round(gridSizeHp * 1.3);
  const sz = String(charSzHp);
  const font = fontFamily || 'SimSun';
  // 🔧 垂直居中改用 wps:bodyPr anchor="ctr"：文本框内容相对 textbox 整体垂直居中，
  //    与字体无关（旧方案 w:before 按宋体视觉中心 62% 调校，换微软雅黑后字面率/基线不同会偏上）
  const beforeTwips = 0;
  const y = yOff || 0;
  const cy = cyOverride || S;
  return `<wps:wsp>
    <wps:cNvPr id="${id}" name="TZG-Char"/>
    <wps:cNvSpPr txBox="1"/>
    <wps:spPr>
      <a:xfrm><a:off x="0" y="${y}"/><a:ext cx="${S}" cy="${cy}"/></a:xfrm>
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
    <wps:bodyPr lIns="0" rIns="0" tIns="0" bIns="0" anchor="ctr"/>
  </wps:wsp>`;
};

/**
 * 拼音 Textbox：格内上部拼音条（预览 .ruby-char::before：0.45em / #666 居中）
 * 与格子线同群组坐标系 → 拼音浮在格内字上方，字仍留在格子中央偏下
 */
const pinyinTextbox = (id, pinyin, sizeHp, fontFamily, S, ph) => {
  const sz = String(Math.max(9, Math.round(sizeHp * 0.7))); // 0.7em（清晰可读）
  const font = 'Times New Roman'; // 拼音专用：教材拼音排版标准衬线体（全平台内置，避免缺字体回退）
  // 🔧 宽度自适应：长拼音（如 "zhuāng"）超出格子宽时向两侧对称溢出，
  //    与预览 .ruby-char::before（white-space:nowrap 无宽度限制）一致，不被截断
  const len = [...pinyin].length;
  const wEmu = Math.max(S, Math.round(len * sizeHp * 5.5 * EMU_PER_DXA)); // 每字符约 0.55em
  const offX = Math.round((S - wEmu) / 2); // 负数 → 拼音条中心与格子中心对齐
  return `<wps:wsp>
    <wps:cNvPr id="${id}" name="TZG-Pinyin"/>
    <wps:cNvSpPr txBox="1"/>
    <wps:spPr>
      <a:xfrm><a:off x="${offX}" y="0"/><a:ext cx="${wEmu}" cy="${ph}"/></a:xfrm>
      <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
      <a:noFill/>
    </wps:spPr>
    <wps:txbx>
      <w:txbxContent>
        <w:p>
          <w:pPr>
            <w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:eastAsia="SimSun"/><w:color w:val="666666"/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr>
            <w:jc w:val="center"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:eastAsia="SimSun"/>
              <w:color w:val="666666"/>
              <w:sz w:val="${sz}"/>
              <w:szCs w:val="${sz}"/>
            </w:rPr>
            <w:t>${escXml(pinyin)}</w:t>
          </w:r>
        </w:p>
      </w:txbxContent>
    </wps:txbx>
    <wps:bodyPr lIns="0" rIns="0" tIns="0" bIns="0" anchor="ctr"/>
  </wps:wsp>`;
};

/**
 * wpg 群组 anchor：一个整体对象包含多个子形状（各自颜色/线宽）
 * @param {object} o { id, name, posHXml, cx, cy, shapes: childShape参数数组 }
 */
const groupAnchor = (o) => {
  const shapesXml = o.shapesXml || (o.shapes || []).map(childShape).join('');
  const vertOff = o.vertOffEmu || 0;  // 🔧 垂直偏移：负值上移以对齐字符视觉中心
  // 🔧 simplePos 元素与 simplePos="0" 属性为 CT_Anchor 必选（ISO 29500）：缺失时 WPS 宽容可开，
  //    Word 严格校验直接拒绝打开（“Word 在试图打开文件时遇到错误”）→ 两处必须同时存在
  return `<w:drawing xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"><wp:anchor distT="0" distB="0" distL="0" distR="0" relativeHeight="251659264" behindDoc="1" locked="0" layoutInCell="1" allowOverlap="1" simplePos="0"><wp:simplePos x="0" y="0"/>${o.posHXml}<wp:positionV relativeFrom="line"><wp:posOffset>${vertOff}</wp:posOffset></wp:positionV><wp:extent cx="${Math.max(1, o.cx)}" cy="${Math.max(1, o.cy)}"/><wp:effectExtent l="0" t="0" r="9525" b="9525"/><wp:wrapNone/><wp:docPr id="${o.id}" name="${o.name}"/><wp:cNvGraphicFramePr/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"><wpg:wgp><wpg:cNvGrpSpPr/><wpg:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${Math.max(1, o.cx)}" cy="${Math.max(1, o.cy)}"/><a:chOff x="0" y="0"/><a:chExt cx="${Math.max(1, o.cx)}" cy="${Math.max(1, o.cy)}"/></a:xfrm></wpg:grpSpPr>${shapesXml}</wpg:wgp></a:graphicData></a:graphic></wp:anchor></w:drawing>`;
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

const tzgShapeAnchors = (S, hS, idBase, sizeHp, centerAlign = false, gapEmu = 0, char = '', pinyin = '', fontFamily = 'SimSun') => {
  const sPt = Math.round(S / EMU_PER_PT);
  const hPt = Math.round(hS / EMU_PER_PT);
  // 🔧 注音田字格：拼音条浮在格子外上方（预览 .ruby-char::before 的形态），
  //    格子线/字符 textbox 整体下移 phEmu，群组高度 = 拼音条 phEmu + 格子 S
  const phEmu = pinyin ? Math.round(sizeHp * 8 * EMU_PER_DXA) : 0; // 0.8em（拼音 0.7em + 上下各 0.05em 间隙）
  const shapes = [
    // 外框矩形（教材蓝 #5B9BD5，0.75pt）
    { id: idBase + 1, name: 'TZG-Box', x: 0, y: phEmu, cx: S, cy: S, geom: 'rect', color: '5B9BD5', wEmu: 9525, dash: false },
    // 水平虚线（中线，细短虚线 sysDash，0.5pt）
    { id: idBase + 2, name: 'TZG-HLine', x: 0, y: phEmu + hS, cx: S, cy: 0, geom: 'line', color: '5B9BD5', wEmu: 6350, dash: true, dashStyle: 'sysDash' },
    // 垂直虚线（中线，细短虚线 sysDash，0.5pt）
    { id: idBase + 3, name: 'TZG-VLine', x: hS, y: phEmu, cx: 0, cy: S, geom: 'line', color: '5B9BD5', wEmu: 6350, dash: true, dashStyle: 'sysDash' },
  ];
  // 🔧 字符 Textbox：跟三条线同在 wpg 群组坐标系 → Word 原生居中（等价 CSS top:50% left:50% translate(-50%,-50%)）
  const tboxXml = char ? textboxTzg(idBase + 4, char, sizeHp, fontFamily, S, phEmu, S) : '';
  const pinyinXml = pinyin ? pinyinTextbox(idBase + 5, pinyin, sizeHp, fontFamily, S, phEmu) : '';
  const shapesXml = shapes.map(childShape).join('') + tboxXml + pinyinXml;
  const choice = groupAnchor({
    id: idBase,
    name: 'TianZiGrid',
    posHXml: centerAlign ? CENTER_POS_H : CHAR_POS_H(gapEmu),
    cx: S,
    cy: S + phEmu,
    shapesXml,
    // 🔧 行内模式下移 3pt：格子在格行行盒（1.8em+6pt，exact 居中渲染）内上下各 3pt 严格对称，块级保持 0
    //    注音群组加高后整体上移 phEmu，格子本体位置与无注音时完全一致（拼音侵占格子正上方空间，与预览 CSS 一致）
    vertOffEmu: (centerAlign ? 0 : Math.round(3 * EMU_PER_PT)) - phEmu,
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
export const tianZiGeOOXML = (char, sizeHp, fontFamily = 'SimSun', pinyin = '') => {
  const cellW = Math.round(sizeHp * 18); // 1.8em（与预览 CSS width:1.8em 一致，手写余量）
  const cellWEmu = Math.round(cellW * EMU_PER_DXA);
  const S = Math.round(cellWEmu);
  const hS = Math.round(S / 2);
  const sz = String(sizeHp);
  const idBase = Math.floor(Math.random() * 90000) + 10000;
  const HALF = '&#xa0;';   // NBSP 按宋体渲染宽 0.5em（WPS 会把 TNR 替换为宋体 → 按 TNR 0.25em 配比会宽度翻倍导致换行）

  // 🔧 字符由 DrawingML textbox 绘制（与 grid 同坐标系 → 精确居中），段落只保留 pad 撑宽度
  // 🔧 块级模式 behindDoc="0"：防止网格线被表格单元格底纹（w:shd）遮挡
  // 🔧 pad 空格统一用 NBSP（&#xa0;）：全字体必覆盖，杜绝 WPS/缺字环境渲染为可见点
  const blockAnchors = tzgShapeAnchors(S, hS, idBase, sizeHp, true, 0, char, pinyin, fontFamily)
    .replace(/behindDoc="1"/g, 'behindDoc="0"');
  return `<w:p>
  <w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="120" w:line="400" w:lineRule="auto"/></w:pPr>
  <w:r>
    <w:rPr><w:rFonts w:ascii="SimSun" w:hAnsi="SimSun" w:eastAsia="SimSun" w:hint="eastAsia"/><w:sz w:val="${sz}"/></w:rPr>
    ${blockAnchors}
    <w:t xml:space="preserve">${HALF}${HALF}${HALF}</w:t>
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
  const HALF = '&#xa0;';   // NBSP 按宋体渲染宽 0.5em

  // 🔧 块级模式 behindDoc="0"：防止线条被表格单元格底纹遮挡
  // 🔧 pad 空格统一用 NBSP（&#xa0;）：全字体必覆盖，杜绝 WPS/缺字环境渲染为可见点
  const blockFltAnchors = fltLineAnchors(lineWEmu, pts, idBase, true)
    .replace(/behindDoc="1"/g, 'behindDoc="0"');
  return `<w:p>
  <w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="120" w:line="440" w:lineRule="auto"/></w:pPr>
  <w:r>
    <w:rPr><w:rFonts w:ascii="SimSun" w:hAnsi="SimSun" w:eastAsia="SimSun" w:hint="eastAsia"/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr>
    ${blockFltAnchors}
    <w:t xml:space="preserve">${HALF}</w:t>
  </w:r>
  <w:r>
    <w:rPr><w:rFonts w:ascii="SimSun" w:hAnsi="SimSun" w:eastAsia="SimSun" w:hint="eastAsia"/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr>
    <w:t xml:space="preserve">${escXml(letter)}</w:t>
  </w:r>
  <w:r>
    <w:rPr><w:rFonts w:ascii="SimSun" w:hAnsi="SimSun" w:eastAsia="SimSun" w:hint="eastAsia"/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr>
    <w:t xml:space="preserve">${HALF}</w:t>
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
  const pad = '&#xa0;'.repeat(n * 2 + 1); // NBSP×2=1em（宋体渲染 0.5em/NBSP），总宽=(n+0.5)em 与 cellW 精确等宽
  const idBase = Math.floor(Math.random() * 90000) + 20000;

  // 🔧 块级模式 behindDoc="0"：防止线条被表格单元格底纹遮挡
  // 🔧 pad 空格统一用 NBSP（&#xa0;）：全字体必覆盖，杜绝 WPS/缺字环境渲染为可见点
  const blockFltBlankAnchors = fltLineAnchors(lineWEmu, pts, idBase, true)
    .replace(/behindDoc="1"/g, 'behindDoc="0"');
  return `<w:p>
  <w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="120" w:line="440" w:lineRule="auto"/></w:pPr>
  <w:r>
    <w:rPr><w:rFonts w:ascii="SimSun" w:hAnsi="SimSun" w:eastAsia="SimSun" w:hint="eastAsia"/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr>
    ${blockFltBlankAnchors}
    <w:t xml:space="preserve">${pad}</w:t>
  </w:r>
</w:p>`;
};

// ============ 行内包裹函数 ============

// 行内格子与前文的间隔：0.5em（≈一个字母位，与预览观感一致，不紧贴）
// 实现：anchor posOffset 右移 gapEmu + pad 文本前置 NBSP(0.5em) 撑出布局宽度
const GAP_EN = '&#xa0;';   // NBSP 按宋体渲染 = 0.5em
const gapEmuOf = (sizeHp) => Math.round((sizeHp || 28) * 5 * EMU_PER_DXA); // 0.5em

/** 行内田字格：anchor 在 text 前 + 0.5em 前置间隔 + w:spacing 撑宽 */
const buildInlineTzg = (char, cellWEmu, idBase, rPrXml, pinyin = '') => {
  const S = Math.round(cellWEmu);
  const hS = Math.round(S / 2);
  const cellW = Math.round(cellWEmu / EMU_PER_DXA);
  const sizeHp = Math.round(cellW / 18); // 1.8em 反推字号
  const sz = String(sizeHp || 28);
  // 🔧 pad 撑宽改用 w:spacing 字符间距：WPS 中宋体 NBSP 宽度为 1em（Word 为 0.5em），
  //    旧 NBSP pad 在 WPS 中宽度翻倍 → 格子后大空白不协调；w:spacing 按 twip 精确撑宽。
  //    pad 总宽 2.5em = 普通空格 0.5em + spacing 2em
  // 🔧 前置零宽占位 run（U+200C ZWNJ）：实测 WPS 的 anchor 字符锚点取“前一个字符”（Word 取
  //    本 run 首字符），旧结构锚定到前字左边缘 → 格子左移 1 字宽压住前字；插入零宽
  //    字符后 WPS 锚点 = 零宽字符左边缘 = 前字右缘，与 Word 锚点位置重合（表格行首
  //    无前字时锚点即段落起点，天然不压字，与实测“表格不压、行中压”吻合）。
  //    注意选 U+200C 而非 U+200B：实测 WPS 中 U+200B 布局宽 1em（Word 零宽）→ 两引擎
  //    锚点再次分叉且 pad 多 1em 空白；U+200C 两引擎均零宽
  const padSpacing = Math.round(sizeHp * 20); // 2em in twip
  // 🔧 CT_RPr 顺序：spacing 必须在 sz/szCs 之前、noBreak 最后——Word 对 rPr 子元素顺序
  //    严格，乱序元素会被静默丢弃（此前 spacing 在 noBreak 后 → Word 中 w:spacing 不生效）
  const fontRPr = `<w:rFonts w:ascii="SimSun" w:hAnsi="SimSun" w:eastAsia="SimSun" w:hint="eastAsia"/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/><w:noBreak/>`;
  const zeroRPr = `<w:rPr>${fontRPr}</w:rPr>`;
  const anchorRPr = `<w:rPr><w:rFonts w:ascii="SimSun" w:hAnsi="SimSun" w:eastAsia="SimSun" w:hint="eastAsia"/><w:spacing w:val="${padSpacing}"/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/><w:noBreak/></w:rPr>`;
  // 🔧 字符由 DrawingML textbox 绘制（与 grid 同坐标系），段落只保留 pad 撑宽度
  //     前置 1em + 尾 1.5em = 2.5em（grid 延伸至 2.3em → 不压盖）
  // 🔧 行内模式 behindDoc="0"：防止网格线被段落底纹（w:shd）遮挡
  const anchors = tzgShapeAnchors(S, hS, idBase, sizeHp, false, gapEmuOf(sizeHp), char, pinyin, 'SimSun')
    .replace(/behindDoc="1"/g, 'behindDoc="0"');
  // 🔧 三 run 结构（实测 Word/WPS 差异，逐个验证过）：
  //    run1 = U+200C 零宽占位（WPS 锚点取前一个字符 → 锚点落前字右缘）
  //    run2 = 纯 drawing（Word 对含 drawing 的 run 忽略 w:spacing → spacing 必须独立）
  //    run3 = 普通空格 + spacing 撑宽（实测 Word 对 U+2002 en space 不应用 w:spacing，
  //          普通空格 0.5em 两引擎一致 + spacing 2em = pad 精确 2.5em）
  return '<w:r>' + zeroRPr + '<w:t xml:space="preserve">\u200C</w:t></w:r>'
    + '<w:r>' + zeroRPr + anchors + '</w:r>'
    + '<w:r>' + anchorRPr + '<w:t xml:space="preserve"> </w:t></w:r>';
};

/** 行内四线三格：anchor 在 text 前，前置 0.5em 间隔 → ¼em pad + letter + ¼em pad */
const buildInlineFlt = (letter, cellWEmu, sizeHp, idBase, rPrXml) => {
  const pts = sizeHp / 2;
  const sz = String(sizeHp || 28);
  const lineWEmu = cellWEmu; // 线条全宽（与预览 ::before left:0;right:0 一致）
  // 🔧 pad 空格统一用 NBSP（&#xa0;）：全字体必覆盖，杜绝 WPS/缺字环境渲染为可见点
  const padRPr = `<w:rPr><w:rFonts w:ascii="SimSun" w:hAnsi="SimSun" w:eastAsia="SimSun" w:hint="eastAsia"/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr>`;
  // 从标记 run 的 rPr 提取字体/颜色/粗斜体 → 注入字母 run，原汁原味复现预览样式
  const src = rPrXml || '';
  const fontMatch = src.match(/w:ascii="([^"]*)"/);
  const font = fontMatch ? fontMatch[1] : 'Times New Roman';
  const colorMatch = src.match(/<w:color\s+w:val="([^"]*)"/);
  const colorTag = colorMatch ? `<w:color w:val="${colorMatch[1]}"/>` : '';
  const hasBold = src.includes('<w:b/>') || src.includes('<w:b ');
  const hasItalic = src.includes('<w:i/>') || src.includes('<w:i ');
  const HALF = '&#xa0;';   // NBSP 按宋体渲染宽 0.5em
  // 🔧 行内模式 behindDoc="0"：防止线条被段落底纹遮挡
  const anchors = fltLineAnchors(lineWEmu, pts, idBase, false, gapEmuOf(sizeHp))
    .replace(/behindDoc="1"/g, 'behindDoc="0"');
  return '<w:r>' + padRPr + anchors
    + '<w:t xml:space="preserve">' + GAP_EN + HALF + '</w:t></w:r>'
    + '<w:r><w:rPr><w:rFonts w:ascii="' + font + '" w:hAnsi="' + font + '"/>' + (hasBold ? '<w:b/>' : '') + (hasItalic ? '<w:i/>' : '') + colorTag + '<w:sz w:val="' + sz + '"/><w:szCs w:val="' + sz + '"/></w:rPr><w:t xml:space="preserve">' + escXml(letter) + '</w:t></w:r>'
    + '<w:r>' + padRPr + '<w:t xml:space="preserve">' + HALF + '</w:t></w:r>';
};

/** 行内空白四线三格：anchor 在 text 前，前置 0.5em 间隔，pad(¼em+N×em+¼em) 与 cellW 精确等宽 */
const buildInlineFltBlank = (cellWEmu, sizeHp, idBase, rPrXml) => {
  const pts = sizeHp / 2;
  const sz = String(sizeHp || 28);
  const lineWEmu = cellWEmu;
  const emEmu = sizeHp * 10 * EMU_PER_DXA;
  const halfEmEmu = Math.round(emEmu / 2);
  const n = Math.max(1, Math.round((cellWEmu - halfEmEmu) / emEmu));
  const pad = GAP_EN + '&#xa0;'.repeat(n * 2 + 1); // 前置0.5em + (n+0.5)em = (n+1)em（NBSP 宋体 0.5em/NBSP）
  // 🔧 pad 空格统一用 NBSP（&#xa0;）：全字体必覆盖，杜绝 WPS/缺字环境渲染为可见点
  const padRPr = `<w:rPr><w:rFonts w:ascii="SimSun" w:hAnsi="SimSun" w:eastAsia="SimSun" w:hint="eastAsia"/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr>`;
  // 🔧 行内模式 behindDoc="0"：防止线条被段落底纹遮挡
  const anchors = fltLineAnchors(lineWEmu, pts, idBase, false, gapEmuOf(sizeHp))
    .replace(/behindDoc="1"/g, 'behindDoc="0"');
  return '<w:r>' + padRPr + anchors
    + '<w:t xml:space="preserve">' + pad + '</w:t></w:r>';
};

// ============ 标记格式 ============

export const TZG_MARKER = (char, cellWEmu) => `__TZG_${char}_${cellWEmu}__`;
/** 注音田字格标记：格内带字 + 拼音浮在格内字上方（后处理替换为含拼音 textbox 的田字格群组） */
export const TZG_PINYIN_MARKER = (char, pinyin, cellWEmu) => `__TZGP_${char}_${pinyin}_${cellWEmu}__`;
// FLT 标记显式携带 sizeHp：cellW 已改为内容自适应，不能再从 cellW/20 反推字号
export const FLT_MARKER = (letter, cellWEmu, sizeHp) => `__FLT_${letter}_${cellWEmu}_${sizeHp}__`;
/** 空白四线三格标记：仅绘制四条线，不渲染字母（听写/默写留空场景） */
export const FLT_BLANK_MARKER = (cellWEmu, sizeHp) => `__FLT_BLANK_${cellWEmu}_${sizeHp}__`;
/** 注音/拼音标记：后处理替换为 Word 原生 w:ruby 注音元素 */
export const RUBY_MARKER = (baseText, pinyin, baseSizeHp) => `__RUBY_${baseText}_${pinyin}_${baseSizeHp}__`;
/** 密封线标记：内容经 encodeURIComponent（避免下划线/特殊字符破坏正则），后处理替换为页面左侧浮动竖排文本框 */
export const SEAL_MARKER = (text, sizeHp) => `__SEAL_${encodeURIComponent(text)}_${sizeHp}__`;

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

/**
 * 密封线浮动文本框 OOXML：wp:anchor 绝对定位锚定页面左侧边距内，不占文档流 → 不撑高正文
 * - 内容为段落序列：[虚线段落][文字段落]…交替（虚线 = 段落单左边框 dashed，一条竖虚线；文字竖排字段）
 * - 文字段落 w:textDirection="tbRl" → 汉字正立竖排（字头朝上、自上而下阅读，标准试卷密封线朝向）
 * - 虚线在文字处断开（文字嵌入单条竖虚线之间）；虚线段落行高弹性 → 虚线上下填满整页
 * - 随纸张几何 PAGE_GEOMETRY 自动适配（页面/边距变化时密封线同步伸缩）
 */
const sealLineFloatingOOXML = (text, sizeHp) => {
  const sz = sizeHp || 20; // half-point（默认 10pt）
  const fields = String(text || '密封线').split('\u0001').map((f) => f.trim()).filter(Boolean);
  const n = Math.max(1, fields.length);
  const PG = PAGE_GEOMETRY;
  // 文本框 = 整页文本区高度（页高 - 上下边距）：虚线上下填满整页
  const availTwips = PG.heightTwips - PG.marginTopTwips - PG.marginBottomTwips;
  // 单字符行高 = 字号 × 1.3（竖排每字占一“行”，字高 1em × 1.3 行距）
  const charH = Math.max(200, Math.round(sz * 13));
  // 文字总高 = 各字段字数 × charH（竖排字段整列堆叠）
  const textTotal = fields.reduce((acc, f) => acc + Math.max(1, [...f].length) * charH, 0);
  // 虚线段高 = 剩余高度均分（首尾 + 字间共 n+1 段）
  let dashRow = Math.max(60, Math.floor((availTwips - textTotal) / (n + 1)));
  // 保险：总高超出可用高 → 等比收缩（极端多字段场景）
  const total = textTotal + (n + 1) * dashRow;
  if (total > availTwips) {
    const k = availTwips / total;
    dashRow = Math.max(40, Math.floor(dashRow * k));
  }
  // 列宽 = 单字符宽（竖排，字宽 ≈ sz half-point × 10 twips）+ 左右留白；封顶避免横铺
  const colTwips = Math.min(1100, Math.max(500, sz * 10 + 240));
  const cyEmu = availTwips * EMU_PER_DXA;
  const cxEmu = colTwips * EMU_PER_DXA;
  // 锚定页面左侧边距内：文本框水平居中于左边距（(margin - col)/2），从顶部 margin 开始
  const posXEmu = Math.round((PG.marginLeftTwips - colTwips) / 2) * EMU_PER_DXA;
  const posYEmu = PG.marginTopTwips * EMU_PER_DXA;
  const id = Math.floor(Math.random() * 90000) + 40000;
  const rPr = `<w:rFonts w:ascii="SimSun" w:hAnsi="SimSun" w:eastAsia="SimSun"/><w:color w:val="999999"/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/>`;
  // 一条竖虚线：虚线段落仅左边框 dashed；文字段落无边框（虚线在文字处断开）
  // ⚠️ pPr 顺序：pBdr → spacing → jc → textDirection → rPr（CT_PPrBase 要求，顺序错误 Word 可能拒开/降级）
  const dashP = (h) => `<w:p><w:pPr><w:pBdr><w:left w:val="dashed" w:sz="8" w:space="4" w:color="999999"/></w:pBdr><w:spacing w:before="0" w:after="0" w:line="${h}" w:lineRule="exact"/></w:pPr><w:r><w:rPr>${rPr}</w:rPr><w:t xml:space="preserve"> </w:t></w:r></w:p>`;
  const textP = (txt) => `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="${charH}" w:lineRule="exact"/><w:jc w:val="center"/><w:textDirection w:val="tbRl"/><w:rPr>${rPr}</w:rPr></w:pPr><w:r><w:rPr>${rPr}</w:rPr><w:t xml:space="preserve">${escXml(txt)}</w:t></w:r></w:p>`;
  const ps = [dashP(dashRow)];
  fields.forEach((f) => {
    ps.push(textP(f));
    ps.push(dashP(dashRow));
  });
  const contentXml = ps.join('');
  return `<w:r><w:drawing><wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="251658240" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1"><wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="page"><wp:posOffset>${posXEmu}</wp:posOffset></wp:positionH><wp:positionV relativeFrom="page"><wp:posOffset>${posYEmu}</wp:posOffset></wp:positionV><wp:extent cx="${cxEmu}" cy="${cyEmu}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/><wp:docPr id="${id}" name="SealLine"/><wp:cNvGraphicFramePr/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><wps:wsp><wps:cNvPr id="${id}" name="SealLine"/><wps:cNvSpPr txBox="1"/><wps:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cxEmu}" cy="${cyEmu}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:ln w="0"/></wps:spPr><wps:txbx><w:txbxContent>${contentXml}</w:txbxContent></wps:txbx><wps:bodyPr lIns="0" rIns="0" tIns="0" bIns="0" anchor="t"/></wps:wsp></a:graphicData></a:graphic></wp:anchor></w:drawing></w:r>`;
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

// ============ 密封线标记替换 + 命名空间注入（正文与页眉共用）============

// 块级密封线 marker：独立段落 → 含浮动 drawing 的空段落（不占文档流）
const blockSealRegex = /<w:p[^>]*>\s*(?:<w:pPr[^>]*>(?:(?!<w:r>)[\s\S])*?<\/w:pPr>)?\s*<w:r[^>]*>\s*(?:<w:rPr[^>]*>(?:(?!<\/w:r>)[\s\S])*?<\/w:rPr>)?\s*<w:t[^>]*>__SEAL_([^_]+?)_(\d+)__<\/w:t>\s*<\/w:r>\s*<\/w:p>/g;

const replaceSealMarkers = (xml) => {
  let changed = false;
  const out = xml.replace(blockSealRegex, (match, encText, sizeStr) => {
    changed = true;
    let text = '密封线';
    try { text = decodeURIComponent(encText); } catch { /* 解码失败用默认 */ }
    const sizeHp = parseInt(sizeStr) || 20;
    return `<w:p>${sealLineFloatingOOXML(text, sizeHp)}</w:p>`;
  });
  return { xml: out, changed };
};

/**
 * 给 XML 根元素注入命名空间（正文根为 w:document，页眉根为 w:hdr）
 * ignorable=true 时补 mc:Ignorable（仅 a 前缀需要；wpg/wps 绝不能进 mc:Ignorable）
 */
const ensureXmlNamespace = (xml, rootTag, ns, uri, ignorable = false) => {
  let r = xml;
  const decl = `xmlns:${ns}="${uri}"`;
  if (!r.includes(decl)) {
    r = r.replace(new RegExp(`(<${rootTag}[^>]*)`), `$1 ${decl}`);
  }
  if (!ignorable) return r;
  const mcUri = 'http://schemas.openxmlformats.org/markup-compatibility/2006';
  if (!r.includes('mc:Ignorable')) {
    r = r.replace(new RegExp(`(<${rootTag}[^>]*)`), `$1 xmlns:mc="${mcUri}" mc:Ignorable="${ns}"`);
  } else {
    const m = r.match(/mc:Ignorable="([^"]*)"/);
    if (m && !m[1].split(/\s+/).includes(ns)) {
      r = r.replace(/mc:Ignorable="([^"]*)"/, `mc:Ignorable="$1 ${ns}"`);
    }
  }
  return r;
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
  // 🔧 块级 marker 段落特征：pPr 必须含 w:before="40"（buildTianZiGeMarker 固定 spacing），
  //    行内单段落（表格格单元格，spacing 为 exact before=0）不含该特征，不会被误匹配为块级
  // 🔧 注音田字格（TZGP）必须先于普通 TZG 处理（虽然 __TZGP_ 不会匹配 __TZG_ 正则，但顺序仍保持保险）
  const blockTzgPinyin = /<w:p[^>]*>\s*<w:pPr[^>]*>(?:(?!<w:r>)[\s\S])*?w:before="40"(?:(?!<w:r>)[\s\S])*?<\/w:pPr>\s*<w:r[^>]*>\s*(?:<w:rPr[^>]*>(?:(?!<\/w:r>)[\s\S])*?<\/w:rPr>)?\s*<w:t[^>]*>__TZGP_([^_]+?)_([^_]+?)_(\d+)__<\/w:t>\s*<\/w:r>\s*<\/w:p>/g;
  docXml = docXml.replace(blockTzgPinyin, (match, char, pinyin, cellWEmuStr) => {
    hasDml = true;
    const cellWEmu = parseInt(cellWEmuStr);
    const cellW = Math.round(cellWEmu / EMU_PER_DXA);
    const sizeHp = Math.round(cellW / 18);
    return tianZiGeOOXML(char, sizeHp || 28, 'SimSun', pinyin);
  });

  const blockTzg = /<w:p[^>]*>\s*<w:pPr[^>]*>(?:(?!<w:r>)[\s\S])*?w:before="40"(?:(?!<w:r>)[\s\S])*?<\/w:pPr>\s*<w:r[^>]*>\s*(?:<w:rPr[^>]*>(?:(?!<\/w:r>)[\s\S])*?<\/w:rPr>)?\s*<w:t[^>]*>__TZG_([^_]+?)_(\d+)__<\/w:t>\s*<\/w:r>\s*<\/w:p>/g;
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
  // 🔧 注音田字格（TZGP）必须先于普通 TZG 处理
  const inlineTzgPinyinRegex = /<w:r\b[^>]*>(\s*(?:<w:rPr[^>]*>(?:(?!<\/w:r>)[\s\S])*?<\/w:rPr>)?)\s*<w:t[^>]*>__TZGP_([^_]+?)_([^_]+?)_(\d+)__<\/w:t>\s*<\/w:r>/gi;
  docXml = docXml.replace(inlineTzgPinyinRegex, (match, rPrXml, char, pinyin, emuStr) => {
    hasDml = true;
    const emu = parseInt(emuStr);
    const idBase = Math.floor(Math.random() * 90000) + 40000;
    return buildInlineTzg(char, emu, idBase, rPrXml, pinyin);
  });

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

  // ==== 密封线标记替换（块级：marker 独立段落 → 含浮动 drawing 的空段落，不占文档流）====
  {
    const sealResult = replaceSealMarkers(docXml);
    docXml = sealResult.xml;
    if (sealResult.changed) hasDml = true;
  }

  // ==== Ruby 注音标记替换 ====
  docXml = injectRubyAnnotations(docXml);

  // ==== 表格单元格段落：中文版式文本对齐居中（w:textAlignment center）====
  // 默认 auto（基线对齐）下，exact 行盒的多余空间全部堆在文字上方（文字贴行盒底→视觉靠下），
  // 改为 center → 文字相对行盒垂直居中，单元格上下留白对称
  docXml = docXml.replace(/(<w:tc>)[\s\S]*?(?=<\/w:tc>)/g, (tcOpen) => {
    // 🔧 含田字格/米字格（图形）的单元格跳过注入：图形单元格无可见文字，
    //    且 textAlignment 会干扰 wp:anchor posOffset 的行锚点解析，导致格子上方留白丢失
    if (tcOpen.includes('TianZiGrid') || tcOpen.includes('MiZiGrid')) return tcOpen;
    // 给该 tc 内所有段落 pPr 注入 textAlignment center（已含则跳过）
    return tcOpen.replace(/<w:pPr>((?:(?!<\/w:pPr>)[\s\S])*?)<\/w:pPr>/g, (m, inner) => {
      if (inner.includes('w:textAlignment')) return m;
      return `<w:pPr>${inner}<w:textAlignment w:val="center"/></w:pPr>`;
    }).replace(/<w:pPr\s*\/>/g, '<w:pPr><w:textAlignment w:val="center"/></w:pPr>');
  });

  // --- 命名空间声明：文档根加 xmlns:wps + mc:Ignorable ---
  const applyDocNamespaces = (xml, rootTag) => {
    // 🔧 a 前缀（DrawingML 主命名空间）必须声明：docx 库的根元素未声明 xmlns:a，
    //    而田字格/密封线 DML 使用 a:graphic 等 → Word 严格校验前缀导致“无法打开”；
    //    且 a 绝不能进 mc:Ignorable（否则 Word 忽略全部图形）→ 增加 ignorable 参数区分
    let r = ensureXmlNamespace(xml, rootTag, 'a', 'http://schemas.openxmlformats.org/drawingml/2006/main');
    // 🔧 wpg/wps 绝不能进 mc:Ignorable：MCE 规范规定 mc:Choice 的 Requires 命名空间若在
    //    mc:Ignorable 中，Word 会跳过该 Choice 分支 → 图形退化为 VML Fallback（转 PDF 丢失）。
    r = ensureXmlNamespace(r, rootTag, 'wpg', 'http://schemas.microsoft.com/office/word/2010/wordprocessingGroup', false);
    r = ensureXmlNamespace(r, rootTag, 'wps', 'http://schemas.microsoft.com/office/word/2010/wordprocessingShape', false);
    return r;
  };
  if (hasDml) {
    docXml = applyDocNamespaces(docXml, 'w:document');
  }

  zip.file(docPath, docXml);

  // ==== 页眉密封线后处理：header*.xml 内 SEAL marker → 浮动文本框（每页重复渲染）====
  // 密封线放在页眉（含首页 different-first-page），使每页都渲染；正文流不再携带 seal marker。
  const headerPaths = Object.keys(zip.files).filter((p) => /^word\/header\d*\.xml$/.test(p) && !zip.files[p].dir);
  for (const hPath of headerPaths) {
    let hXml = await zip.file(hPath)?.async('string');
    if (!hXml) continue;
    const sealResult = replaceSealMarkers(hXml);
    if (sealResult.changed) {
      hXml = sealResult.xml;
      hXml = applyDocNamespaces(hXml, 'w:hdr');
      zip.file(hPath, hXml);
    }
  }

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
