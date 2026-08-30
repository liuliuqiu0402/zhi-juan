// ============ 纸张版式预设（2026-08 调研：正规考试大试卷尺寸） ============
//    A 系列标准纸横向拼接 = 整张 A4 单元并排（A3=2 张、A2=3 栏/每栏≥A4、A1=4 张 A4）：
//    - A3（297×420mm 横向）：高考语文/数学/综合科目试卷与答题卡，两栏
//    - A2（420×594mm 横向 594×420）：三栏大试卷，每栏可用宽 ≈ A4（≥A4 口径，内容无需重排）
//    - A1（594×841mm 横向 841×594）：四栏大试卷，每栏 = 210mm 整张 A4 宽
//    - 8K 正度（273×393mm，横向 393×273）：地方统考、模拟试题册，两栏
//    ⚠️ 只保留"每栏可用宽 ≥ A4（160/170mm）"的版式：生成端/预览/作答区均按 A4 宽度口径设计，
//       窄栏每栏仅 105~117mm，A4 口径内容导出后需重新调整，暂不提供。
//    尺寸 mm → docxBuilder 按 MM2DXA 换算；栏距随栏数收敛（两栏 20 / 三栏 15 / 四栏 12mm）
export const PAPER_PRESETS = {
  'a4-1col': { label: 'A4 单栏', wMm: 210, hMm: 297, cols: 1, gapMm: 0 },
  'a3-2col': { label: 'A3 两栏（420×297）', wMm: 420, hMm: 297, cols: 2, gapMm: 20 },
  'a2-3col': { label: 'A2 三栏（594×420，每栏≈A4）', wMm: 594, hMm: 420, cols: 3, gapMm: 15 },
  'a1-4col': { label: 'A1 四栏（841×594，每栏=A4）', wMm: 841, hMm: 594, cols: 4, gapMm: 12 },
  '8k-2col': { label: '8K 横向两栏（393×273）', wMm: 393, hMm: 273, cols: 2, gapMm: 18 },
};

/** 归一化布局参数：兼容旧值 'a4' / 'a3-2col'，非法值回退 A4 单栏 */
export const normalizeLayout = (layout) => {
  if (!layout || layout === 'a4') return 'a4-1col';
  return PAPER_PRESETS[layout] ? layout : 'a4-1col';
};
