/**
 * 指令送达体检（**只读、只报，不改任何文本**）
 * ============================================================
 * 为什么有这个文件（2026-10-27）：
 *   排障时发现「取证锚」被写成**硬编码字符串**（如"每题题干后必须再标一次"）。实发文本一改写，
 *   这些锚就永远取不到 → 日志恒报"判据=false"，**真正的旧模板反而检不出来**，日志也就没人看了。
 *   本模块把"判据在不在"改成**形态探针**（正则认形态、不认整句措辞），并顺带查两件以前看不见的事：
 *     ① **块数**：一份实发里出现两个【分值标注】＝新旧两套判据并存（历史"整卷不标分"的形态）；
 *     ② **旧口径残留**：旧版"号是点名用的／不带小题号（整组都不带）"一旦同现，模型可以合法地
 *        "标题写单价、题内不标分"。
 * 纪律：本模块不读 localStorage、不拼提示词、不改内容；调用方只拿结果去打日志/告警。
 */

/** 形态探针：认结构，不认整句措辞（换措辞后仍有效） */
const PROBES = {
  blockStart: /(?:^|\n)\s*【分值标注[^】]*】/g,
  structure: /遮住大题标题[、，]?只看其中一项/,
  singleStem: /整栏合一（单题干）/,
  multiStem: /逐题独立（多题干）/,
  perItemFull: /每题题干后[^。；\n]{0,6}标/,
  perItemValue: /每〈单位〉X分，共Y分/,
  titleTotal: /大题标题写/,
  // 版本指纹：2026-10-27 按"促规范不约束"改写后，标题与题内的关系句（各写这一处自己的数）。
  // 出现＝实发是含该判据的版本；不出现＝跑的是旧版实发。
  twoPlaces: /标题与题内各写这一处自己的数/,
};

/** 旧口径残留（出现即说明实发里还夹着旧判据） */
const LEGACY = [
  { key: '号是点名用的', probe: /号是点名用的/ },
  { key: '不带小题号（整组都不带）', probe: /不带小题号/ },
  { key: '小题后不再逐个标', probe: /小题后不再/ },
  { key: '不是标题里要填的数字', probe: /不是标题里要填的数字/ },
];

/**
 * 体检一份实发的【分值标注】送达情况。
 * @param {string} text 实发文本（模板或整份 user 消息均可）
 * @returns {{ok:boolean, blocks:number, present:Object, legacy:string[], verdict:string}}
 */
export const inspectScoreClause = (text = '') => {
  const t = String(text || '');
  const blocks = [...t.matchAll(PROBES.blockStart)].length;
  const present = {
    structure: PROBES.structure.test(t),
    singleStem: PROBES.singleStem.test(t),
    multiStem: PROBES.multiStem.test(t),
    perItemFull: PROBES.perItemFull.test(t),
    perItemValue: PROBES.perItemValue.test(t),
    titleTotal: PROBES.titleTotal.test(t),
    twoPlaces: PROBES.twoPlaces.test(t),
  };
  const legacy = LEGACY.filter((x) => x.probe.test(t)).map((x) => x.key);

  const missing = [];
  if (blocks === 0) missing.push('【分值标注】整块不在');
  if (blocks > 1) missing.push(`【分值标注】出现 ${blocks} 块（新旧判据并存）`);
  if (!present.structure) missing.push('结构判定句不在');
  if (!present.singleStem || !present.multiStem) missing.push('单/多题干两支不在');
  if (!present.perItemFull) missing.push('逐题标分要求不在');
  if (!present.twoPlaces) missing.push('「标题与题内各写这一处自己的数」不在（多半是跑到了旧版实发）');
  if (legacy.length) missing.push(`旧口径残留：${legacy.join('、')}`);

  const ok = missing.length === 0;
  const verdict = ok
    ? `送达正常（块 ${blocks}｜结构判定 在｜单/多题干 在｜两处都标 在｜旧口径 无）`
    : `送达异常：${missing.join('；')}`;
  return { ok, blocks, present, legacy, verdict };
};

export default { inspectScoreClause };
