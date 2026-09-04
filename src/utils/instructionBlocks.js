/**
 * 指令来源分段标注（旁路 provenance，2026-09 MVP 批1 第 1 步）
 * ============================================================
 * 🔴 目标：把"组装完成的指令全文"切分为 偏移区间 ↔ {库, 条目 key/配置卡} 的块映射，
 *    供 GenerateModule 指令框"分段标注视图"渲染可点击来源块（点击跳对应工具库卡）。
 * 🔴 旁路原则：本模块【不参与指令拼装、不修改任何文本】，只消费调用方在拼装点
 *    手上已有的段文本（模板正文 / 渲染契约 / 规则约束 / 教辅蓝本 及其内的换算行、协议行），
 *    在成品全文里定位得到区间。同源同文本 → 定位恒命中；不命中只记 unlocated，不改输出。
 *    与 generate 主链零耦合：输出文本不变，blueprintInjection 等逐字锁定测试即天然回归守卫。
 * 块粒度（MVP）：
 *   段（segment）：指令库 cell 模板正文、渲染契约段、规则库约束段、蓝图/教辅蓝本段
 *   子片段（fragment）：段内的"换算句→BLANK 卡"、"协议句→载体允许表卡"等配置卡级来源
 * 消费方：GenerateModule.loadInstructionFromLibrary 组装完成后调用并保存 ref；
 *         指令框分段标注视图（下一提交）按 blocks 渲染可点块。
 */
export const annotateInstructionBlocks = (fullText = '', segments = []) => {
  const text = String(fullText || '');
  const blocks = [];
  const unlocated = [];
  if (!text) return { blocks, unlocated };
  let cursor = 0;
  for (const seg of segments) {
    if (!seg || !seg.text) continue;
    let idx = text.indexOf(seg.text, cursor);
    if (idx === -1) idx = text.indexOf(seg.text); // 防段间顺序/重叠导致游标错过 → 全文兜底
    if (idx === -1) {
      unlocated.push({ lib: seg.lib, key: seg.key ?? null, name: seg.name ?? '' });
      continue;
    }
    blocks.push({ start: idx, end: idx + seg.text.length, lib: seg.lib, key: seg.key ?? null, name: seg.name ?? '' });
    cursor = idx + seg.text.length;
    // 子片段（配置卡级）：必须在父段区间内
    for (const frag of seg.fragments || []) {
      if (!frag.text) continue;
      const fi = text.indexOf(frag.text, idx);
      if (fi !== -1 && fi + frag.text.length <= idx + seg.text.length) {
        blocks.push({
          start: fi, end: fi + frag.text.length,
          lib: frag.lib, key: frag.key ?? null, name: frag.name ?? '',
          parentKey: seg.key ?? null,
        });
      }
    }
  }
  // 按起点排序（同起点：父段先于子片段）；嵌套关系由区间包含表达，视图层据此选择命中粒度
  blocks.sort((a, b) => (a.start - b.start) || (b.end - a.end));
  return { blocks, unlocated };
};

/** 归一来源标签：给视图层的中文库名（与工具库注册表一致） */
export const LIB_LABELS = {
  instruction: '指令库',
  'layout-spec': '排版规格库',
  'render-contract': '渲染契约库',
  rules: '规则库',
  blueprint: '蓝图库',
};
