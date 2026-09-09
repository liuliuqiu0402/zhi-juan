/**
 * 防照搬护栏（底线线 O5，2026-09-07 用户定版）
 * ============================================================
 * 判据（确定性、字面层）：生成正文与参考段（示范段原文）——
 *   · 整句连续 ≥8 字命中；或
 *   · 同串 3 个连续数字命中（防"照搬教材数字"）。
 * 命中即报"疑似照搬"提示（只报不改，交编辑核对/模型重做），程序不判定语义雷同。
 * 依据：docs/design/三线生成架构-设计准绳.md 底线线（O5 防照搬护栏默认阈值，A/B 校准）。
 * ============================================================
 */

const normWs = (s) => String(s || '').replace(/\s+/g, '');

/** 学科规范术语/指令语/栏目题头白名单（2026-09 根治照搬误报 → 2026-09 学科细分结构）
 * ============================================================
 * 🔴 豁免边界（防白名单变成"照搬遮罩"）：只收录三类"非内容"通行语——
 *    ① 题型指令语/作答引导（读拼音写词语/选词填空/用竖式计算…）；
 *    ② 算法/规则类**必需表述**（命题时绕不开的规范句，如"把除数转化成整数"）；
 *    ③ 栏目题头/作答引导短语。
 *    不收：定义、定理结论、情境、数据、例句原文——那些是内容，命中仍照报。
 * 结构：按 学科 × 词目类别 分组（开放目录型：词条是样本驱动累积，命中即按类别归并补全；
 *    类目划分让"还缺什么"可按学科检查，避免一锅白名单越堆越浊）。
 * 判定："命中 8 字连续片段整串被某白名单项包含" → 属规范表述，不报照搬；纯数字串（kind='num'）不受此豁免。
 * 依据：docs/design/三线生成架构-设计准绳.md 底线线（O5 防照搬护栏）。 */
const COPY_TERM_GROUPS = {
  '*': {
    heading: [
      '想一想，填一填', '想一想', '填一填', '算一算', '比一比', '连一连', '画一画', '选一选',
      '直接写得数', '用竖式计算', '列竖式计算', '脱式计算', '简便计算', '用你喜欢的方法计算',
      '能简便的要用简便方法计算', '按要求完成下列各题', '读一读，写一写', '把下列各题补充完整',
    ],
  },
  语文: {
    instruct: [
      '读拼音，写词语', '看拼音，写词语', '看拼音写词语', '读拼音，写句子',
      '给加点字选择正确的读音', '给加点字选择正确读音', '选择正确的读音',
      '按要求写句子', '把句子补充完整', '照样子，写句子', '照样子，写词语',
      '按课文内容填空', '根据课文内容填空', '根据课文内容回答',
      '写出下列词语的反义词', '写出下列词语的近义词', '选词填空',
      '用横线画出', '用波浪线画出', '给句子加上标点符号', '补充下列词语',
    ],
  },
  数学: {
    algo: [
      '得数保留一位小数', '保留一位小数', '得数保留两位小数', '保留两位小数', '保留三位小数', '保留整数',
      '把除数转化成整数', '除数转化成整数', '转化成整数', '转化成整数再计算',
      '依次不断重复出现', '数字依次不断重复出现',
      '先按照整数乘法算出积', '按照整数乘法算出积', '再确定积的小数点位置', '确定积的小数点位置',
      '积的小数位数等于两个因数的小数位数之和',
      '小数点同时向右移动相同的位数', '向右移动相同的位数',
      '乘得的积的小数位数不够时', '小数末尾的零去掉', '化简小数',
    ],
    instruct: ['列竖式计算下列各题', '写出下列各题的得数', '用简便方法计算下面各题'],
  },
  英语: {
    instruct: [
      '根据首字母提示补全单词', '用所给单词的适当形式填空', '根据句意及首字母提示补全单词',
      '根据汉语提示写出单词', '根据中文提示写出单词', '听录音，选出你所听到的内容',
      '根据录音内容判断正误', '选出不同类的一项', '选出正确的答案', '从方框中选择合适的单词填空',
      '连词成句', '选出每组单词中不同类的一项', '根据图片提示写出单词',
    ],
  },
  物理: {
    instruct: ['请用笔画线代替导线', '按要求连接电路', '根据实验数据作出图像'],
  },
  化学: {
    instruct: ['写出下列反应的化学方程式', '配平下列化学方程式', '写出下列物质的化学式'],
  },
  地理: {
    instruct: ['读图，完成下列各题', '读图完成下列各题', '读图回答问题', '根据图中信息回答'],
  },
};

const flattenTerms = (group) => (group ? Object.values(group).flat().map(normWs).filter(Boolean) : []);

/** 汉字/可读字符连续 n 字命中检测（字面确定性；跳过标点归一后比连续片段）。
 *  2026-09 英文词级分流：英文行若按"8 字符连续"判定，功能句（You can do it!/Keep trying!）、
 *  单元名（Unit 1 Try your best）、单词（practise）等教学必现内容会被误报照搬——
 *  英文改为按词窗连续判定（真实整句照搬才报，功能短句/标题/单词不误伤）。
 *  🔧 英文阈值 2026-09-09 用户定版 5→10 词：题干/复述/功能句（What was difficult for Bobby、
 *     Be the best you can、Su Hai wanted to play…）等 5 词档极易把"必须复用的教材功能句"误升格成
 *     "照搬整句"；提到 10 词（≈完整从句/整句）才是真正要防的整句照搬，教材参考段短句不再狂曝。
 *  判定该行是否英文为主：非空拉丁词 ≥2 且中文字符为 0。 */
const ENGLISH_LONG_WORDS = 10; // 英文整词窗连续 ≥10 词才算整句照搬
function isEnglishLine(s) {
  const trimmed = String(s || '').trim();
  if (!trimmed) return false;
  const words = (trimmed.match(/[A-Za-z][A-Za-z'’]*/g) || []).filter((w) => w.length >= 2);
  if (words.length < 2) return false;
  return !/[\u4e00-\u9fa5]/.test(trimmed);
}

function longRunOverlap(body, corpus, n) {
  const hits = [];
  for (const src of corpus) {
    const c = normWs(src);
    if (isEnglishLine(src)) {
      // 英文行：≥10 词连续（去空白形态拼窗比对，body 已是全去空白文本，窗口串可直接 includes）
      const W = ENGLISH_LONG_WORDS;
      const toks = (String(src).match(/[A-Za-z][A-Za-z'’]*/g) || []).filter((w) => w.length >= 2);
      if (toks.length < W) continue; // 参考段不足 10 词 → 不在英文长句照搬判定内
      for (let i = 0; i + W <= toks.length; i += 1) {
        const chunk = toks.slice(i, i + W).join('');
        if (body.includes(chunk)) {
          hits.push({ kind: 'long', n: W, snippet: chunk, tokens: toks.slice(i, i + W), source: src.slice(0, 60) });
          break; // 同源命中一次即可
        }
      }
      continue;
    }
    if (c.length < n) continue;
    for (let i = 0; i + n <= c.length; i += 1) {
      const chunk = c.slice(i, i + n);
      if (body.includes(chunk)) {
        hits.push({ kind: 'long', n, snippet: chunk, source: src.slice(0, 60) });
        break; // 同源命中一次即可（提示该源存在长句重合）
      }
    }
  }
  return hits;
}

/**
 * 连词成句/乱序词库豁免（2026-09 照搬误报根治）：连词成句题面给出乱序单词语库，
 * 期望答案本就是把教材句逐个还原——答案与参考段完全一致是题型需求，不是照搬。
 * 识别：正文中存在"裸英语词列表"行（≥4 个独立单词、无标点/无中文、非完整句子）→ 词库；
 * 若某英文照搬命中的 5 个词全部落在同一词库内 → 判为该词库的连词成句目标，豁免不报。
 * @param {string} rawText 去标签但保留空白的正文文本
 * @param {string[]} tokens 命中的词窗
 * @returns {boolean}
 */
function isUnscrambleBank(rawHtml, tokens) {
  if (!rawHtml || !Array.isArray(tokens) || !tokens.length) return false;
  const target = new Set(tokens.map((t) => String(t).toLowerCase()));
  // 块级标签/换行当作行分隔；实体归一为空格；行内再取"仅空格分隔的英文词串"（避开被去标签粘连的跨块词）
  const blockLines = String(rawHtml)
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;|&#160;|&#xA0;/gi, ' ')
    .replace(/&emsp;|&#8195;/gi, ' ')
    .replace(/&ensp;|&#8194;/gi, ' ')
    .replace(/&amp;/g, '&')
    .split(/\r?\n/);
  for (const raw of blockLines) {
    let line = raw.trim();
    if (!line) continue;
    // 剥行首非字母前缀（题号"(1) "、中文引导语"连词成句："等），再判是否为裸英文词库——
    // 词库主体须为纯英文词列表（无句子标点、无中文混入）
    line = line.replace(/^[^A-Za-z]*/, '');
    if (!line || /[\u4e00-\u9fa5]/.test(line)) continue;
    if (/[,.!?;:。！？，、；：]/.test(line)) continue; // 含句子标点 → 是句子不是词库
    const ws = (line.match(/[A-Za-z][A-Za-z'’]*/g) || []).filter((w) => w.length >= 2);
    if (ws.length < 4) continue;
    const set = new Set(ws.map((w) => String(w).toLowerCase()));
    if ([...target].every((t) => set.has(t))) return true;
  }
  return false;
}

/** 同串 3 个连续数字命中检测（正文含与参考段相同的连续 3 位数字串）。
 *  2026-09 收口：① 分数成分（前字符为 '/'，如 30/100）不报——分母/分子数字是算式自身，无语义照搬；
 *  ② 3 位纯整数（如 356 千克）仍报（沿袭教材数字防抄意图）；≥4 位小数/整数串照报。 */
function numberRunOverlap(body, corpus) {
  const hits = [];
  const numRe = /\d{3,}/g;
  const seenNums = new Set();
  for (const src of corpus) {
    const c = normWs(src);
    let m;
    while ((m = numRe.exec(c)) !== null) {
      const num = m[0];
      if (seenNums.has(num)) continue;
      // 分数成分豁免：数字串紧贴 '/' 之后（分母 30/100→'100'）或之前（分子）均无语义抄袭
      const before = c.slice(Math.max(0, m.index - 1), m.index);
      const after = c.slice(m.index + num.length, m.index + num.length + 1);
      if (before === '/' || after === '/') continue;
      if (body.includes(num)) {
        seenNums.add(num);
        hits.push({ kind: 'num', n: num.length, snippet: num, source: src.slice(0, 60) });
      }
    }
  }
  return hits;
}

/**
 * 防照搬扫描（只报不改）。
 * @param {object} p
 * @param {string} p.bodyHtml 生成正文（HTML 或纯文本均可——按去标签后的文本比对）
 * @param {string[]} p.corpus 参考段原文数组（示范段文本）
 * @param {number} [p.longN] 连续字命中阈值（默认 8）
 * @param {string} [p.subject] 学科（用于术语白名单豁免，如 '数学'；缺省仅通用题头豁免）
 * @returns {Array<{kind:'long'|'num', n:number, snippet:string, source:string}>} 命中清单（空=无命中）
 */
export function scanCopyOverlap({ bodyHtml = '', corpus = [], longN = 8, subject = '' } = {}) {
  const text = String(bodyHtml || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;|&#160;|&#xA0;/gi, ' ')
    .replace(/&emsp;|&#8195;/gi, ' ')
    .replace(/&ensp;|&#8194;/gi, ' ')
    .replace(/&amp;/g, '&');
  const body = normWs(text);
  if (!body || !Array.isArray(corpus) || !corpus.length) return [];
  const srcs = corpus.map((s) => String(s || '')).filter(Boolean);
  // 术语白名单豁免（2026-09）：命中的连续字片段若整串被某无学科规范表述包含 → 属通行术语，不报照搬；
  //   片段首尾先剥标点（比对归一去空白但保留标点，8 字边界常把相邻标点卷进来，如"？（得数保留两位"），
  //   剥后核心串仍 ≥4 字且被白名单项包含才豁免——纯标点/过短串不因剥离而误豁免。
  const terms = [...flattenTerms(COPY_TERM_GROUPS['*']), ...flattenTerms(COPY_TERM_GROUPS[subject])];
  const stripPunctEdges = (s) => String(s).replace(/^[^\u4e00-\u9fa5A-Za-z0-9]+|[^\u4e00-\u9fa5A-Za-z0-9]+$/g, '');
  const isTerm = (sni) => {
    const core = stripPunctEdges(sni);
    return core.length >= 4 && terms.some((t) => t.includes(core));
  };
  const longHits = longRunOverlap(body, srcs, Math.max(4, longN)).filter((h) => !isTerm(normWs(h.snippet)));
  // 连词成句/乱序词库豁免：命中的英文词窗全部落在正文某"裸词乱序词库"行 → 题型所需，不报照搬
  const unscrambleExempt = (h) => !(Array.isArray(h.tokens) && h.tokens.length && isUnscrambleBank(bodyHtml, h.tokens));
  return [...longHits.filter(unscrambleExempt), ...numberRunOverlap(body, srcs)];
}

/** 命中清单 → 一条生成报告提示（供 auditWarnings / 编辑核对，程序不改内容）。 */
export function copyOverlapNote(hits = [], limit = 5) {
  if (!Array.isArray(hits) || !hits.length) return '';
  const top = hits.slice(0, limit).map((h) => `「${h.snippet}」（${h.kind === 'num' ? '数字串' : /[A-Za-z]/.test(h.snippet) ? `${h.n} 词连续` : `${h.n} 字连续`}命中参考段）`);
  return `⚠️ 防照搬提示：正文存在 ${hits.length} 处与教材示范段字面重合${hits.length > limit ? `（前 ${limit} 处）` : ''}：${top.join('、')}。请改编情境/数据后保留（交编辑核对，非程序判定雷同）。`;
}
