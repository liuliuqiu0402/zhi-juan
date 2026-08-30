// ============ 纸张版式预设（2026-08 调研：正规考试大试卷尺寸） ============
//    - A3（297×420mm）：高考语文/数学/综合科目试卷与答题卡（两栏常见，英语大卷三栏）
//    - 8K 正度（273×393mm）：地方统考、模拟试题册（两栏/三栏）
//    - 4K 正度（390×543mm）：大型考试大试卷（四栏）
//    尺寸 mm → docxBuilder 按 MM2DXA 换算；栏距随栏数收敛（两栏 20mm / 三栏 15mm / 四栏 12mm，
//    贴近印刷排版惯例：多栏时栏距过宽浪费版面）
export const PAPER_PRESETS = {
  'a4-1col': { label: 'A4 单栏', wMm: 210, hMm: 297, cols: 1, gapMm: 0 },
  'a3-2col': { label: 'A3 两栏（高考综合卷）', wMm: 420, hMm: 297, cols: 2, gapMm: 20 },
  'a3-3col': { label: 'A3 三栏（英语大卷）', wMm: 420, hMm: 297, cols: 3, gapMm: 15 },
  '8k-2col': { label: '8K 两栏（273×393）', wMm: 273, hMm: 393, cols: 2, gapMm: 18 },
  '8k-3col': { label: '8K 三栏（273×393）', wMm: 273, hMm: 393, cols: 3, gapMm: 14 },
  '4k-4col': { label: '4K 四栏（390×543）', wMm: 390, hMm: 543, cols: 4, gapMm: 12 },
};

/** 归一化布局参数：兼容旧值 'a4' / 'a3-2col'，非法值回退 A4 单栏 */
export const normalizeLayout = (layout) => {
  if (!layout || layout === 'a4') return 'a4-1col';
  return PAPER_PRESETS[layout] ? layout : 'a4-1col';
};
