/**
 * ✅ A4（2026-09-11）：教材原文压缩（Map → Reduce）
 * ============================================================
 * 定位：写作期的"素材"不再是"模型按需 browse 逐点取片段"，而是
 *   **按勾选章节程序直读整章原文 → 压缩 → 作为素材进写作前缀**。
 *   本模块只负责这段"读来的原文怎么压"，不含任何取料/写作编排（那在写作主链）。
 *
 * 三段工作流（A4）：
 *   ① Map     分批压缩原文（批预算自适应；按章/节自然边界切分）
 *   ② Reduce  归并成一份连贯、有界、保真的压缩原文（**按原顺序拼接**；超窗则递归折叠）
 *   ③ Stuff   一次成文（在写作主链，不在本模块）
 *
 * 硬约束（A4-3 / A4-5 —— 防"假原文压缩"）：
 *   - 压缩**输入必须是纯教材原文**：本模块 API 只接受 `rawText` / `sections`，
 *     **没有任何锚点入参**，Map 提示词里也不出现锚点清单（结构上杜绝"复述锚点"的假压缩）。
 *   - 锚点只在"锚点清单"里出现一次（清单由 `anchorTreeContract.buildAnchorListByChapter` 出）。
 *
 * 保真与分流（A4-6 / A4-8）：
 *   - `full`（知识型：总结/预习/默写/复习）→ **保原文表述与原句**（默写答案即原文原句）。
 *   - 命题型（考卷/课时练/专项/阅读）→ 可大压缩，但**不得删栏目、不得改写事实**。
 *   - 分节标题**只保留原文已有的**，绝不新造；原文无标题则保持连续。
 *
 * 失败处理：某一批压缩失败 → **保留该批原文**并记 warning（宁可长，绝不静默丢素材）。
 * ============================================================
 */
import { CHARS_PER_TOKEN } from './budgetCalibration.js';      // 中文 token 字符率唯一事实源
import { splitTextIntoSegments } from './textSegmenter.js';    // 句子级切分复用（不另建一套）

/** 字符 → token 估算（与预算体系同口径） */
export const estimateTokens = (chars = 0) => Math.ceil((Number(chars) || 0) / CHARS_PER_TOKEN);
/** token → 字符（预算换算） */
export const tokensToChars = (tokens = 0) => Math.floor((Number(tokens) || 0) * CHARS_PER_TOKEN);

/** Map 批预算（字符）：按"阅读质量自适应"给的**默认**值，可被调用方/设置覆盖（最终数值待 A14-4 定稿） */
export const DEFAULT_BATCH_CHARS = 6000;
/** 递归折叠触发线（字符）：Reduce 拼接后超过它 → 再折叠一轮 */
export const DEFAULT_FOLD_LIMIT_CHARS = 24000;

/**
 * 压缩比按 mode 分流（A4-6）
 * @param {string} mode 覆盖契约五档 mode
 * @returns {{fidelity:'verbatim'|'condense', label:string, instruction:string}}
 */
export const compressionSpecOf = (mode = '') => {
  if (mode === 'full') {
    return {
      fidelity: 'verbatim',
      label: '知识型·保真压缩（保留原文表述与原句）',
      instruction: '这是知识梳理/默写/复习类素材：必须**保留原文的表述与原句**（默写答案即原文原句），只可删去重复与无关铺陈，不得改写句式、不得替换同义说法、不得概括成自己的话。',
    };
  }
  return {
    fidelity: 'condense',
    label: '命题型·大幅压缩（保结构、保关键事实）',
    instruction: '这是命题/练习类素材：可大幅压缩，但必须**保留原文的结构与关键事实**（概念、规则、公式、结论、数据、例词），不得删掉任何栏目、不得改写事实。',
  };
};

/** 章节标题行特征（**只认原文已有的标题**，绝不新造） */
const SECTION_TITLE_RE = /^\s*(第[〇零一二三四五六七八九十百千0-9]+[章节讲单元课]|[0-9]+(\.[0-9]+)*\s*[、.．]?\s*\S+|一\s*[、.．]|二\s*[、.．]|三\s*[、.．]|四\s*[、.．]|五\s*[、.．]|六\s*[、.．]|七\s*[、.．]|八\s*[、.．]|九\s*[、.．]|十\s*[、.．]|Unit\s*\d+|[Cc]hapter\s*\d+|Lesson\s*\d+)\s*\S{0,40}$/;

/** 标题行判定：除形态匹配外，再限"短行 + 无句读"，避免把"N. 25×4=  2. 120÷6="这类内容行误判为标题 */
const isTitleLine = (line = '') => {
  const s = String(line || '').trim();
  if (!s || s.length > 30) return false;
  if (/[。！？；，,;]/.test(s)) return false;
  return SECTION_TITLE_RE.test(s);
};

/**
 * 按**原文自身结构标题**切分为节（A4-7 的自然边界）。
 * - 标题行**原样保留在正文内**（`title` 只是批标签）→ 任何情况下**不丢正文**
 * - 原文没有可识别标题 → 返回单节（`title:''`），**不新造标题**
 * - 保留标题行原样（不改写）
 * @param {string} rawText
 * @returns {Array<{title:string, text:string}>}
 */
export const splitOriginalIntoSections = (rawText = '') => {
  const lines = String(rawText || '').split(/\r?\n/);
  const sections = [];
  let curTitle = '';
  let buf = [];
  const flush = () => {
    const text = buf.join('\n').trim();
    if (text) sections.push({ title: curTitle, text });
    buf = [];
  };
  for (const line of lines) {
    if (isTitleLine(line)) {
      flush();
      curTitle = line.trim();
      buf = [line];          // 🔒 标题行计入正文，杜绝"被当标题吃掉"
      continue;
    }
    buf.push(line);
  }
  flush();
  return sections.length ? sections : [{ title: '', text: String(rawText || '').trim() }];
};

/**
 * 把节按自然边界打包成 Map 批（A4-7）：尽量不跨节合并超限；单节超限 → 句子级二次切分并标记 part。
 * @param {Array<{title:string,text:string}>} sections
 * @param {{maxCharsPerBatch?:number}} [opts]
 * @returns {Array<{index:number,title:string,text:string,sectionCount:number,part?:number,parts?:number}>}
 */
export const packSectionsIntoBatches = (sections = [], { maxCharsPerBatch = DEFAULT_BATCH_CHARS } = {}) => {
  const max = Math.max(1, Number(maxCharsPerBatch) || DEFAULT_BATCH_CHARS);
  const batches = [];
  let cur = null;
  const pushCur = () => { if (cur) { batches.push(cur); cur = null; } };

  for (const sec of (sections || [])) {
    const title = String(sec?.title || '');
    const text = String(sec?.text || '').trim();
    if (!text) continue;

    if (text.length <= max) {
      // 不跨节合并超限：加进来会超 → 先收当前批
      const add = text.length + (cur && cur.len ? 1 : 0);
      if (cur && cur.len + add > max) pushCur();
      if (!cur) cur = { title, texts: [], sectionCount: 0, len: 0 };
      if (!cur.title) cur.title = title;
      cur.texts.push(text);
      cur.sectionCount += 1;
      cur.len += add;
      continue;
    }
    // 单节超限：先收掉当前批，再按句子切分
    pushCur();
    const parts = splitTextIntoSegments(text, max);
    parts.forEach((p, i) => {
      batches.push({ title, text: p, sectionCount: 1, part: i + 1, parts: parts.length });
    });
  }
  pushCur();

  return batches.map((b, i) => ({
    index: i,
    title: b.title || '',
    text: b.texts ? b.texts.join('\n') : b.text,
    sectionCount: b.sectionCount,
    ...(b.part ? { part: b.part, parts: b.parts } : {}),
  }));
};

/** Map 阶段消息（**输入纯原文**，不含锚点清单——防假压缩 A4-3/A4-5） */
export const buildMapMessages = ({ batch, mode = '', subject = '', grade = '' } = {}) => {
  const spec = compressionSpecOf(mode);
  const scope = [grade, subject, batch?.title].filter(Boolean).join(' · ');
  return [
    {
      role: 'system',
      content: '你是教材原文的"保真压缩器"。只做压缩：不改写事实、不增删栏目、不解释、不点评、不加任何标记或说明文字。',
    },
    {
      role: 'user',
      content: [
        `【压缩任务】${spec.label}`,
        `【保真要求】${spec.instruction}`,
        '【硬约束】',
        '- 只压缩下面给出的原文；不得添加原文没有的内容；',
        '- **只保留原文已有的结构标题**（有则原样保留，没有就不要新造标题）；',
        '- 不要输出"以下是压缩结果""压缩后如下"之类的说明，只输出压缩后的正文文本。',
        scope ? `【范围】${scope}` : '',
        batch?.title ? `【本节标题】${batch.title}` : '',
        '【原文】',
        String(batch?.text || ''),
        '【输出】仅输出压缩后的原文文本。',
      ].filter(Boolean).join('\n'),
    },
  ];
};

/** Reduce 阶段：**按原顺序拼接**（程序完成，不产生新的组织） */
export const reduceInOriginalOrder = (parts = []) =>
  (parts || []).map((p) => String(p || '').trim()).filter(Boolean).join('\n\n');

/** 递归折叠消息（超窗时：把已拼接文本再压一轮） */
export const buildFoldMessages = ({ batch, mode = '' } = {}) => buildMapMessages({ batch, mode });

/** 简单并发池（批数多时并行压缩，控总耗时；保序输出） */
const runWithConcurrency = async (items, limit, worker) => {
  const out = new Array(items.length);
  let next = 0;
  const n = Math.max(1, Math.min(Number(limit) || 1, items.length));
  const runners = Array.from({ length: n }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await worker(items[i], i);
    }
  });
  await Promise.all(runners);
  return out;
};

/**
 * 压缩全部原文（Map → Reduce，超窗递归折叠）。
 * @param {Object} p
 * @param {string} [p.rawText] 整章原文（与 sections 二选一）
 * @param {Array} [p.sections] 已切好的节
 * @param {string} p.mode 覆盖契约 mode（决定压缩比分流）
 * @param {Function} p.callAI async (messages) => string 注入的模型调用（便于测试与复用）
 * @param {number} [p.maxCharsPerBatch] Map 批预算（字符）
 * @param {number} [p.foldLimitChars] 触发递归折叠的字符线
 * @param {number} [p.maxRounds] 最多折叠轮数（默认 2）
 * @param {number} [p.concurrency] 并发批数（默认 3）
 * @returns {Promise<{compressedText:string, batches:Array, rounds:number, stats:Object, warnings:string[]}>}
 */
export const compressOriginalText = async ({
  rawText = '', sections = null, mode = '', subject = '', grade = '',
  callAI, maxCharsPerBatch = DEFAULT_BATCH_CHARS, foldLimitChars = DEFAULT_FOLD_LIMIT_CHARS,
  maxRounds = 2, concurrency = 3,
} = {}) => {
  if (typeof callAI !== 'function') throw new Error('compressOriginalText 需要注入 callAI');
  const warnings = [];
  const secs = Array.isArray(sections) && sections.length ? sections : splitOriginalIntoSections(rawText);
  const sourceChars = secs.reduce((n, s) => n + String(s?.text || '').length, 0);

  let batches = packSectionsIntoBatches(secs, { maxCharsPerBatch });
  let rounds = 0;
  let parts = [];

  while (rounds < Math.max(1, maxRounds)) {
    rounds += 1;
    const results = await runWithConcurrency(batches, concurrency, async (b, i) => {
      try {
        const out = await callAI(buildMapMessages({ batch: b, mode, subject, grade }));
        const text = String(out || '').trim();
        if (!text) throw new Error('空输出');
        return text;
      } catch (e) {
        // 🔒 绝不静默丢素材：该批失败 → 保留原批原文
        warnings.push(`第${i + 1}批压缩失败（${e.message}）→ 保留原文`);
        return String(b.text || '').trim();
      }
    });
    parts = results;
    const joined = reduceInOriginalOrder(parts);
    if (joined.length <= foldLimitChars || parts.length <= 1) {
      return {
        compressedText: joined,
        batches,
        rounds,
        stats: {
          sections: secs.length, batches: batches.length, sourceChars,
          compressedChars: joined.length,
          ratio: sourceChars ? +(joined.length / sourceChars).toFixed(3) : 1,
        },
        warnings,
      };
    }
    // 超窗 → 递归折叠：将已拼接文本再压一轮
    warnings.push(`压缩结果 ${joined.length} 字超折叠线 ${foldLimitChars} → 递归折叠（第${rounds + 1}轮）`);
    batches = packSectionsIntoBatches([{ title: '', text: joined }], { maxCharsPerBatch });
  }

  const finalText = reduceInOriginalOrder(parts);
  return {
    compressedText: finalText,
    batches,
    rounds,
    stats: {
      sections: secs.length, batches: batches.length, sourceChars,
      compressedChars: finalText.length,
      ratio: sourceChars ? +(finalText.length / sourceChars).toFixed(3) : 1,
    },
    warnings,
  };
};
