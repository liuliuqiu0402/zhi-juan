// ============ 纸张版式预设（2026-08 调研：正规考试大试卷尺寸） ============
//    - A3（297×420mm 横向）：高考语文/数学/综合科目试卷与答题卡，两栏
//    - 8K 正度（273×393mm，横向 393×273）：地方统考、模拟试题册，两栏
//    ⚠️ 只保留"每栏可用宽 ≈ A4（160/170mm）"的版式：生成端/预览/作答区均按 A4 宽度口径设计，
//       窄栏（三栏/四栏）每栏仅 105~117mm，A4 口径内容导出后需重新调整，暂不提供。
//    尺寸 mm → docxBuilder 按 MM2DXA 换算；栏距两栏 2cm（贴近印刷排版惯例）
export const PAPER_PRESETS = {
  'a4-1col': { label: 'A4 单栏', wMm: 210, hMm: 297, cols: 1, gapMm: 0 },
  'a3-2col': { label: 'A3 两栏（高考综合卷）', wMm: 420, hMm: 297, cols: 2, gapMm: 20 },
  '8k-2col': { label: '8K 横向两栏（393×273）', wMm: 393, hMm: 273, cols: 2, gapMm: 18 },
};

/** 归一化布局参数：兼容旧值 'a4' / 'a3-2col'，非法值回退 A4 单栏 */
export const normalizeLayout = (layout) => {
  if (!layout || layout === 'a4') return 'a4-1col';
  return PAPER_PRESETS[layout] ? layout : 'a4-1col';
};
