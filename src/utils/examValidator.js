// ==================== 整卷结构质量校验器（ExamPaperAuditor）====================
// 🔴 定位：生成后程序化质检层（所有资料类型 × 所有学科 × 所有学段通用）。
//    提示词规则（questionTypeRules/promptLibrary）约束 AI"应该怎么出题"，
//    本校验器兜底"AI 没做到时怎么办"——能自动修复的修复（fix），
//    不能修复的静默计数（guard，不产生任何问题提示）。
//    规则清单在 src/config/validatorRules.js（与指令库/蓝图库同级，分学科可维护），
//    本文件只负责规则的执行逻辑。
// ============================================================
import { getValidatorRules } from '../config/validatorRules.js';

// ---------- 通用正则 ----------
// 全角拼音字符归一表（IPA 音标字符混入小学拼音、全角字母）
const PINYIN_NORM_MAP = {
  '\u0261': 'g',  // ɡ (IPA 带钩 g) → g
  '\u014b': 'ng', // ŋ → ng
  '\u0251': 'a',  // ɑ → a
  '\u0259': 'e',  // ə → e
  '\u02d0': '',   // ː (长音符号) 移除
};
const PINYIN_NORM_RE = new RegExp(`[${Object.keys(PINYIN_NORM_MAP).join('')}]`, 'g');
const PINYIN_CHARS = 'a-zA-Z\u0101\u00e1\u01ce\u00e0\u014d\u00f3\u01d2\u00f2\u0113\u00e9\u011b\u00e8\u012b\u00ed\u01d0\u00ec\u016b\u00fa\u01d4\u00f9\u01d6\u01d8\u01da\u01dc\u00fc';
// 独立拼音组（连续拼音字母/声调字母，前后非字母）
const PINYIN_GROUP_RE = new RegExp(`(?<![${PINYIN_CHARS}])[${PINYIN_CHARS}]+(?![${PINYIN_CHARS}])`, 'g');
// 空位载体：span/u/div 的 blank-N 标签、以及全角空格括号（　）
const BLANK_TAG_RE = /<span[^>]*class=["'][^"']*blank-\d+[^"']*["'][^>]*>[\s\S]*?<\/span>|<u[^>]*class=["'][^"']*blank-\d+[^"']*["'][^>]*>[\s\S]*?<\/u>/gi;
const PAREN_BLANK_RE = /[（(]\s*[　\u3000 ]{1,6}\s*[)）]/g;
// 拼音选项括号（读音题）：（háng xíng）/（háng、xíng）——音节间以空格或顿号分隔
const PINYIN_OPTION_RE = new RegExp(`[（(]\\s*[${PINYIN_CHARS}]+(?:[／/、，, \\s]+[${PINYIN_CHARS}]+)+\\s*[)）]`, 'g');
// 选项行：<p class="option"> 或行首 "A. xxx"
const OPTION_P_RE = /<p[^>]*class=["'][^"']*option[^"']*["'][^>]*>/gi;
const OPTION_LINE_RE = /(?:^|\n)\s*[A-H][.、．]\s*[^\n]+/g;
// 连线结构
const MATCH_ITEM_RE = /class=["'][^"']*match-item[^"']*["']/g;
// 题组子题编号：（1）（2）或 1. 2.
const SUBQ_RE = /[(（]\s*\d+\s*[)）]/g;

// ---------- 工具 ----------
const stripTags = (s) => String(s || '').replace(/<[^>]+>/g, '');
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** 归一拼音字符（ɡ→g、全角字母→半角等），返回 {text, fixed} */
export const normalizePinyinText = (text) => {
  if (!text) return { text: text || '', fixed: 0 };
  let out = String(text);
  let fixed = 0;
  out = out.replace(PINYIN_NORM_RE, (ch) => { fixed += 1; return PINYIN_NORM_MAP[ch]; });
  // 全角字母数字 → 半角
  const fw = out.replace(/[\uFF21-\uFF3A\uFF41-\uFF5A\uFF10-\uFF19]/g, (ch) => {
    fixed += 1;
    return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0);
  });
  out = fw;
  return { text: out, fixed };
};

/** 统计一段 HTML 中的空位数（blank 标签 + 全角括号空位） */
export const countBlanks = (html) => {
  if (!html) return 0;
  const tagCount = (html.match(BLANK_TAG_RE) || []).length;
  const parenCount = (html.match(PAREN_BLANK_RE) || []).length;
  return tagCount + parenCount;
};

/** 统计一段 HTML 中的独立拼音组数 */
export const countPinyinGroups = (html) => {
  if (!html) return 0;
  const text = stripTags(html);
  return (text.match(PINYIN_GROUP_RE) || []).length;
};

/** 统计读音题拼音选项组数：（háng xíng）式括号 */
export const countPinyinOptions = (html) => {
  if (!html) return 0;
  const text = stripTags(html);
  return (text.match(PINYIN_OPTION_RE) || []).length;
};

/** 统计选择题选项数（option 标签 + 行首 A. 式） */
export const countOptions = (html) => {
  if (!html) return 0;
  let n = (html.match(OPTION_P_RE) || []).length;
  if (n === 0) {
    const text = stripTags(html);
    n = (text.match(OPTION_LINE_RE) || []).length;
  }
  return n;
};

/** 统计连线题两侧项数（match-item 总数/2，非整数说明结构不对称） */
export const countMatchSides = (html) => {
  if (!html) return null;
  const items = (html.match(MATCH_ITEM_RE) || []).length;
  if (items === 0) return null;
  return { total: items, left: items / 2 };
};

/** 统计纯文本连线行数（一行内出现 ≥2 个全角空格/tab 分隔的两列 → 计 1 条连线，AI 未按 match-item 结构输出时兜底） */
export const countMatchLines = (text) => {
  if (!text) return 0;
  let n = 0;
  for (const ln of String(text).split(/\n/)) {
    if (/[\u3000\t]{2,}/.test(ln)) n += 1;
  }
  return n;
};

/**
 * 用 DOM 把整卷 HTML 切成"大题块"列表
 * @returns {Array<{title:string, raw:string, score:number|null}>}
 */
export const splitSections = (html) => {
  const out = [];
  try {
    const tpl = document.createElement('template');
    tpl.innerHTML = html;
    const heads = Array.from(tpl.content.querySelectorAll('h2, h3, h4'));
    heads.forEach((h, i) => {
      const title = (h.textContent || '').trim();
      if (!title) return;
      const scoreMatch = title.match(/[（(]\s*(\d{1,3})\s*分\s*[)）]/);
      let raw = '';
      let node = h.nextSibling;
      const end = heads[i + 1] || null;
      while (node && node !== end) {
        raw += node.outerHTML || node.textContent || '';
        node = node.nextSibling;
      }
      out.push({ title, raw, score: scoreMatch ? parseInt(scoreMatch[1], 10) : null });
    });
  } catch (e) {
    console.warn('⚠️ 整卷大题切分失败:', e.message);
  }
  return out;
};

/**
 * 修复大标题内"每X分"标注与载体数对齐：
 *   - 分值能整除空位/连线数 → 保留"每空X分"（换算正确）
 *   - 否则：能整除子题数 → 改"每题X分"；再不行 → 去掉"每空/每线X分"字样，仅保留"共X分"
 * @param {string} title 大题标题
 * @param {number} totalScore 大题分值
 * @param {number} carrierCount 载体数（空位或连线对）
 * @param {number} subCount 子题数
 */
export const fixScoreLabel = (title, totalScore, carrierCount, subCount) => {
  let out = title;
  const unitMatch = out.match(/[（(][^)）]*?(每空|每线|每题|每字|每词)\s*(\d{1,3})\s*分[^)）]*?[)）]/);
  if (!unitMatch) return out;
  const unit = unitMatch[1];
  const claimed = parseInt(unitMatch[2], 10);
  let ok = false;
  if (carrierCount > 0 && totalScore % carrierCount === 0) ok = totalScore / carrierCount === claimed;
  if (!ok && subCount > 0 && totalScore % subCount === 0 && unit === '每题') ok = totalScore / subCount === claimed;
  if (ok) return out;
  // 尝试换算：分值 ÷ 载体数 为整数 → 标注正确单值；否则去掉单元标注
  let label = '';
  if (carrierCount > 0 && totalScore % carrierCount === 0) {
    const unitLabel = unit === '每线' ? '线' : unit === '每题' ? '题' : '空';
    label = `共${carrierCount}${unitLabel === '线' ? '处连线' : unitLabel}，每${unitLabel}${totalScore / carrierCount}分，共${totalScore}分`;
  } else if (subCount > 1 && totalScore % subCount === 0) {
    label = `共${subCount}题，每题${totalScore / subCount}分，共${totalScore}分`;
  } else {
    label = `共${totalScore}分`;
  }
  out = out.replace(/[（(][^）)]*?(每空|每线|每题|每字|每词)\s*\d{1,3}\s*分[^）)]*?[)）]/, `（${label}）`);
  return out;
};

/**
 * 主入口：整卷质量校验与修复（按 学段×学科×资料类型 三维度匹配规则库执行）
 * @param {string} html 整卷 HTML（含答案区）
 * @param {Object} opts { subject(学科), stage(学段键), genType(资料类型) }
 * @returns {{html: string, issues: Array, fixed: number, silent: number}}
 *   issues 仅含 fix 类的修复记录（info 级）；guard 类只计数进 silent（debug 日志，不产生问题提示）
 */
export const auditExamPaper = (html, { subject = '', stage = '', genType = '' } = {}) => {
  if (!html || typeof html !== 'string') return { html: html || '', issues: [], fixed: 0, silent: 0 };
  const rules = getValidatorRules({ subject, stage, genType });
  const has = (id) => rules.has(id);
  let out = String(html);
  const issues = [];
  let fixed = 0;
  let silent = 0;
  const silentCount = (type, msg) => { silent += 1; console.debug(`🔍 [质检-${type}] ${msg}`); };

  // ── 0. 拼音字符归一（规则 pinyin-norm，全卷防 ɡ/ŋ/ɑ 混入）──
  if (has('pinyin-norm')) {
    const { text, fixed: f } = normalizePinyinText(out);
    if (f > 0) {
      fixed += f;
      out = text;
    }
  }

  // ── 1. 模板残留清理（规则 template-cleanup）──
  if (has('template-cleanup')) {
    // 1a. "【插图占位】…复制 PROMPT…"非标准块 → 整个移除（渲染链路只认 [IMAGE] 标准块）
    const phRe = /【\s*插图占位[\s\S]*?(?:复制\s*PROMPT|PROMPT)[\s\S]*?(?:插入此处|<\/div>|$)/gi;
    out = out.replace(phRe, (m) => {
      issues.push({ severity: 'info', type: 'image-placeholder', message: `已移除非标准插图占位符残留（${m.length} 字符）` });
      fixed += 1;
      return '';
    });
    // 1b. 被转义的 HTML 标签实体残留（\</div\>、\</p>、</div\> 等形式）——
    //    🔴 反斜杠必须出现才匹配，绝不可误删正常闭合标签（否则 DOM 结构被破坏）
    const escRe = /\\<\/(div|p|span|u|h1|h2|h3|section|br)\s*\\?>|<\/(div|p|span|u|h1|h2|h3|section|br)\s*\\>/gi;
    out = out.replace(escRe, (m, tag) => {
      const t = tag || m.match(/\/(\w+)/)?.[1] || 'tag';
      if (t === 'br') { fixed += 1; return '<br>'; }
      issues.push({ severity: 'info', type: 'escaped-html', message: `已移除被转义的闭合标签残留：${m.trim()}` });
      fixed += 1;
      return '';
    });
    // 1c. 空条款（"3．。"——只有编号没有内容，可能是 <p> 包裹或裸文本）
    const emptyItemRe = /(?:^|\n|>)\s*\d+\s*[.、．]\s*。\s*(?:<|\n|$)/g;
    out = out.replace(emptyItemRe, (m) => {
      issues.push({ severity: 'info', type: 'empty-item', message: `已移除空条款（仅有编号无内容）：${m.trim()}` });
      fixed += 1;
      return m.startsWith('>') ? '' : '\n';
    });
    // 1c-2. 整个 <p> 只有空条款 → 删除整段
    const emptyPRe = /<p[^>]*>\s*\d+\s*[.、．]\s*。\s*<\/p>/g;
    out = out.replace(emptyPRe, (m) => {
      issues.push({ severity: 'info', type: 'empty-item', message: `已移除空条款段落：${stripTags(m).trim()}` });
      fixed += 1;
      return '';
    });
  }

  // ── 1.5. [IMAGE] 配图块标准化（规则 image-block-fix：AI 常漏 NEGATIVE/WIDTH/HEIGHT、写成一行式、参数间混入 HTML）──
  if (has('image-block-fix')) {
    const imageBlockRe = /\[IMAGE\]([\s\S]*?)(\[\/IMAGE\]|$)/gi;
    const stripHtmlIn = (s) => String(s || '')
      .replace(/&lt;\/?[a-zA-Z][^&]*&gt;|<\/?[a-zA-Z][^>]*>|\\?<\/?[a-zA-Z]\s*\\?>/g, '')
      .replace(/&(?:nbsp|ensp|emsp);/g, ' ')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
    const normImage = out.replace(imageBlockRe, (m, body) => {
      // 按行解析，兼容行内多字段（"TYPE:SD STYLE:line_art"）——值在遇到下一个字段名时截断
      const fields = { TYPE: 'SD', PROMPT: '', NEGATIVE: '写实,照片,复杂背景,文字,水印', WIDTH: '800', HEIGHT: '600', STYLE: 'line_art' };
      const KEY_RE = /(TYPE|PROMPT|NEGATIVE|WIDTH|HEIGHT|STYLE|描述)\s*[：:]\s*((?:(?!\b(?:TYPE|PROMPT|NEGATIVE|WIDTH|HEIGHT|STYLE|描述)\s*[：:])[^\n])*)/gi;
      let mm;
      while ((mm = KEY_RE.exec(body)) !== null) {
        const key = mm[1].toUpperCase() === '描述' ? 'PROMPT' : mm[1].toUpperCase();
        // 字段值统一清理 HTML 残留（AI 常在参数行间混入 </p><p></p>）与多余空白
        const cleanVal = stripHtmlIn(mm[2]);
        if (key === 'PROMPT' && fields.PROMPT) {
          fields.PROMPT += mm[2]; // 多段 PROMPT 先拼接，最后统一清理
        } else {
          fields[key] = cleanVal;
        }
      }
      const prompt = stripHtmlIn(fields.PROMPT) || '（画面描述缺失）';
      const norm = `[IMAGE]\nTYPE:${fields.TYPE || 'SD'}\nPROMPT:${prompt}\nNEGATIVE:${fields.NEGATIVE}\nWIDTH:${fields.WIDTH}\nHEIGHT:${fields.HEIGHT}\nSTYLE:${fields.STYLE}\n[/IMAGE]`;
      if (norm !== m) {
        issues.push({ severity: 'info', type: 'image-block', message: '已规范 [IMAGE] 配图块为标准 EduRender 格式（补齐参数/统一分行/清理残留）' });
        fixed += 1;
      }
      return norm;
    });
    out = normImage;
  }

  // ── 1.5.2. 正文重复内容检测截断（规则 duplicate-content-fix：截断续写时模型从头重出整卷）──
  if (has('duplicate-content-fix')) {
    // 1) 正文区重复大题标题（同一标题第二次出现 → 保留第一份）
    const bodyPart = out.split(/<div[^>]*class=["'][^"']*answer-section/i)[0];
    const ansPart = out.slice(bodyPart.length);
    const headRe = /<h[234][^>]*>([^<]*)<\/h[234]>/g;
    const heads = [];
    let hm;
    while ((hm = headRe.exec(bodyPart)) !== null) {
      const t = (hm[1] || '').trim();
      if (/^[一二三四五六七八九十]+、/.test(t)) heads.push({ text: t, index: hm.index });
    }
    let dupIndex = -1;
    const seenTitles = new Set();
    for (const h of heads) {
      if (seenTitles.has(h.text)) { dupIndex = h.index; break; }
      seenTitles.add(h.text);
    }
    if (dupIndex > 0) {
      issues.push({ severity: 'info', type: 'duplicate-content', message: '检测到正文重复（同一大题标题出现 ≥2 次，疑截断续写重出），已截断保留第一份' });
      fixed += 1;
      out = bodyPart.slice(0, dupIndex) + ansPart;
    }
    // 2) 重复答案区（once 模式正文含两份答案 → 保留第一份）
    const ansBlocks = out.match(/<div[^>]*class=["'][^"']*answer-section[^"']*["'][^>]*>/g) || [];
    if (ansBlocks.length > 1) {
      const first = out.indexOf(ansBlocks[0]);
      const second = out.indexOf(ansBlocks[1], first + ansBlocks[0].length);
      out = out.slice(0, second);
      issues.push({ severity: 'info', type: 'duplicate-content', message: '检测到重复答案区，已截断保留第一份' });
      fixed += 1;
    }
  }

  // ── 1.5.3. 连线题选项重复检测（规则 match-option-dup-guard：右列选项重复 → 连线不唯一，静默）──
  if (has('match-option-dup-guard')) {
    const optLineRe = /^[^\n]{1,40}?[\s]*[-—━]{2,}[\s]*([①②③④⑤⑥⑦⑧⑨⑩][^\n]*)$/gm;
    const rightOpts = [];
    let om;
    while ((om = optLineRe.exec(out)) !== null) {
      rightOpts.push(om[1].replace(/^[①②③④⑤⑥⑦⑧⑨⑩]/, '').trim());
    }
    const seenOpts = new Set();
    const dupOpts = new Set();
    for (const o of rightOpts) {
      if (o && seenOpts.has(o)) dupOpts.add(o);
      if (o) seenOpts.add(o);
    }
    if (dupOpts.size > 0) {
      silentCount('match-option-dup', `连线题右侧选项重复（${[...dupOpts].join('、')}），学生无法唯一连线，请抽检`);
    }
  }

  // ── 1.5.4. 连线题分隔符规范化（规则 match-line-clean：连字符易被误读为答案线）──
  if (has('match-line-clean')) {
    out = out.replace(/^([^\n]{1,40}?)[\s]*[-—━]{2,}[\s]*([^\n]*)$/gm, (m, left, right) => {
      // 仅处理"中文左侧 + 中文/圈号序号右侧"的连线题行，避免误伤其他内容
      const l = (left || '').trim();
      const r = (right || '').trim();
      if (/[\u4e00-\u9fa5]/.test(l) && (/[①②③④⑤⑥⑦⑧⑨⑩]/.test(r) || /[\u4e00-\u9fa5]{1,8}/.test(r))) {
        issues.push({ severity: 'info', type: 'match-line', message: `已把连线题分隔符规范为全角空格（${l}…），避免被误读为答案线` });
        fixed += 1;
        return `${l}　　　　${r}`;
      }
      return m;
    });
  }

  // ── 1.5.5. 连线题右列格式规范化（规则 match-format-fix：右列裸序号＋内容下方对照行 → 合并并排）──
  if (has('match-format-fix')) {
    const NUM = '①②③④⑤⑥⑦⑧⑨⑩'; // 注意：不含方括号，拼字符类时再包
    const strip = (s) => s.replace(/<[^>]+>/g, '');
    const lines = out.split('\n');
    // 裸序号行：左列汉字 + 全角空格 + 行尾单个序号（"园　　②"，兼容 <p> 包裹）
    const bareRe = new RegExp(`^([\\s\\S]{1,30}?)[\\s　]+([${NUM}])$`);
    // 对照行解析：可含多对"序号 内容"（"① 树林　　② 花"）
    const parseMapRow = (t) => {
      const o = {};
      const re = new RegExp(`([${NUM}])\\s*([^\\n${NUM}]{1,40}?)(?=[${NUM}]|$)`, 'g');
      let m;
      while ((m = re.exec(t)) !== null) o[m[1]] = m[2].trim();
      return o;
    };
    const bareRows = [];
    lines.forEach((ln, i) => {
      const t = strip(ln).trim();
      const m = bareRe.exec(t);
      if (m && /[\u4e00-\u9fa5]/.test(m[1])) bareRows.push({ idx: i, num: m[2], left: m[1].trim(), raw: ln });
    });
    if (bareRows.length >= 2) {
      // 收集所有对照行（跨行合并）
      const lookup = {};
      lines.forEach(ln => {
        const t = strip(ln).trim();
        if (bareRe.test(t)) return;
        Object.assign(lookup, parseMapRow(t));
      });
      const mapped = bareRows.filter(r => lookup[r.num]);
      // 至少一半裸序号行有对应内容、且 ≥2 项才重组（防误伤无对照行的连线题）
      if (mapped.length >= Math.max(2, Math.ceil(bareRows.length * 0.5))) {
        const mappedNums = new Set(mapped.map(r => r.num));
        const newLines = lines.map((ln, i) => {
          const row = bareRows.find(r => r.idx === i);
          if (row && lookup[row.num]) {
            const escLeft = row.left.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const re = new RegExp(`(${escLeft})[\\s　]+(${row.num})`);
            return ln.replace(re, `$1　　　　${row.num}${lookup[row.num]}`);
          }
          const t = strip(ln).trim();
          const cm = parseMapRow(t);
          if (Object.keys(cm).some(k => mappedNums.has(k))) return null; // 删除已被回填到行尾的对照行
          return ln;
        }).filter(x => x !== null);
        const merged = newLines.join('\n');
        if (merged !== out) {
          issues.push({ severity: 'info', type: 'match-format', message: `已重组连线题格式：右列序号与内容合并并排（${mapped.length} 项），删除下方对照行` });
          fixed += 1;
          out = merged;
        }
      }
    }
  }

  // ── 1.5.6. 排版语义标记自洽检测（规则 text-format-fix：题干要求加点/画线但正文无 <u> 标记 → 静默计数）──
  if (has('text-format-fix')) {
    const bodyText = out.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ');
    const uMarkCount = (out.match(/<u[ >]/gi) || []).length;
    const claims = bodyText.match(/(圈出加点字|给加点字|加点字|画线(?:的)?(?:词语|句子|部分)|划(?:出|一划)|描出|用.{0,3}线(?:画出|划出))/g) || [];
    if (claims.length > 0 && uMarkCount === 0) {
      silentCount('text-format', `题干要求加点/画线（${claims[0]}）但正文无 <u> 标记——题目不自洽，请抽检`);
    }
  }

  // ── 1.5.7. 教辅类资料关键元素齐全性（规则 type-elements-guard：模板已有生成前要求，生成后静默确认）──
  if (has('type-elements-guard')) {
    const gt = genType || '';
    const TYPE_ELEMENT_CHECKS = {
      preview: [{ re: /我的疑问/, label: '"我的疑问"栏目' }],
      errorbook: [{ re: /错因|归因/, label: '错因归因' }],
      summary: [{ re: /易错/, label: '易错辨析' }],
      review: [{ re: /易错|自测/, label: '易错聚焦/自测' }],
      dictation: [{ re: /tian-zi-ge|四线|拼音/, label: '书写格/拼音标注' }],
      reading: [{ re: /短文|阅读/, label: '选文（短文）' }],
    };
    const checks = TYPE_ELEMENT_CHECKS[gt];
    if (checks) {
      const bodyText = out.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ');
      const miss = checks.filter(c => !c.re.test(bodyText)).map(c => c.label);
      if (miss.length > 0) {
        silentCount('type-elements', `「${gt}」类型关键元素缺失（${miss.join('、')}）——请抽检`);
      }
    }
  }

  // ── 1.5.8. 书写格按学段（规则 writing-grid-fix：语文 3 年级+ 田字格、英语中学+ 四线三格 → 静默计数）──
  if (has('writing-grid-fix')) {
    const stageRank = { primary_low: 1, primary_mid: 2, primary_high: 3, middle: 4, high: 5 };
    const rank = stageRank[stage] || 0;
    if (subject.includes('语文') && rank >= 2 && /tian-zi-ge/.test(out)) {
      silentCount('writing-grid', '语文 3 年级及以上仍使用田字格——应改方格/横线，请抽检');
    }
    if (subject.includes('英语') && rank >= 4 && /(four-line-three|sixian-ge)/.test(out)) {
      silentCount('writing-grid', '英语中学段仍使用四线三格——应改单线/横线，请抽检');
    }
  }

  // ── 1.6. 大题标题明细式（规则 title-detail-fix：旧式"（X分）"→"共N题，每题X分，共X分"）──
  if (has('title-detail-fix')) {
    try {
      const tpl = document.createElement('template');
      tpl.innerHTML = out;
      const heads = Array.from(tpl.content.querySelectorAll('h2, h3, h4'));
      heads.forEach((h, i) => {
        const t = (h.textContent || '').trim();
        if (!/^[一二三四五六七八九十]+、/.test(t) || !/[（(]\s*\d{1,3}\s*分\s*[)）]\s*$/.test(t) || /共\s*\d+\s*题/.test(t)) return;
        const scoreMatch = t.match(/[（(]\s*(\d{1,3})\s*分\s*[)）]\s*$/);
        if (!scoreMatch) return;
        const totalScore = parseInt(scoreMatch[1], 10);
        let count = 0;
        let node = h.nextSibling;
        const end = heads[i + 1] || null;
        while (node && node !== end) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const tag = node.tagName.toLowerCase();
            if (tag === 'p' || tag === 'li' || tag === 'div') {
              const tt = (node.textContent || '').trim();
              if (/^\d+[.、．]/.test(tt)) count += 1;
            }
          }
          node = node.nextSibling;
        }
        if (count <= 0) return;
        const perScore = count > 1 && totalScore % count === 0 ? totalScore / count : null;
        const detail = perScore != null ? `共${count}题，每题${perScore}分，共${totalScore}分` : `共${count}题，共${totalScore}分`;
        const newT = t.replace(/[（(]\s*\d{1,3}\s*分\s*[)）]\s*$/, `（${detail}）`);
        if (newT !== t) {
          h.textContent = newT;
          issues.push({ severity: 'info', type: 'title-detail', message: `大题标题已补全明细式：${newT}` });
          fixed += 1;
        }
      });
      out = tpl.innerHTML;
    } catch (e) {
      console.warn('⚠️ 大题标题明细化失败（不影响其他修复）:', e.message);
    }
  }

  // ── 2. 大题级：分值账目 + 载体结构校验（DOM 内直接操作，避免字符串与 DOM 序列化差异）──
  {
    let tpl = null;
    try {
      tpl = document.createElement('template');
      tpl.innerHTML = out;
      const heads = Array.from(tpl.content.querySelectorAll('h2, h3, h4'));
      heads.forEach((head, i) => {
        const title = (head.textContent || '').trim();
        if (!title) return;
        // 兼容明细式（"共X分"）与旧式（"（X分）"）两种标题取总分（title-detail-fix 可能已改写标题）
        const cm = title.match(/共\s*(\d{1,3})\s*分/);
        const sm = title.match(/[（(]\s*(\d{1,3})\s*分/);
        const scoreMatch = cm || sm;
        if (!scoreMatch) return;
        const totalScore = parseInt(scoreMatch[1], 10);
        // 收集本大题 DOM 节点（下一个大题标题之前）
        const secNodes = [];
        let node = head.nextSibling;
        const end = heads[i + 1] || null;
        while (node && node !== end) {
          secNodes.push(node);
          node = node.nextSibling;
        }
        let secHtml = '';
        for (const n of secNodes) secHtml += n.outerHTML || n.textContent || '';
        if (!secHtml) return;
        const secText = secNodes.map(n => n.textContent || '').join('');

        // 载体统计
        const blanks = countBlanks(secHtml);
        const pinyinGroups = countPinyinGroups(secHtml);
        const pinyinOpts = countPinyinOptions(secHtml);
        const options = countOptions(secHtml);
        const matchSides = countMatchSides(secHtml);

        // 2a. 看拼音写词语/拼音填空缺空自动补（规则 pinyin-blank-fill）
        if (has('pinyin-blank-fill') && pinyinGroups >= 2 && blanks >= 1 && pinyinGroups !== blanks) {
          if (pinyinGroups > blanks) {
            const missing = pinyinGroups - blanks;
            const { recovered } = fixMissingPinyinBlanksInDom(secNodes, missing);
            issues.push({
              severity: 'info',
              type: 'pinyin-blank-mismatch',
              message: `已自动补 ${missing} 个拼音空位（大题「${title}」拼音${pinyinGroups}组/空位${blanks}个）${recovered ? '' : '，部分补全失败请抽检'}`,
            });
            fixed += 1;
          } else if (has('blank-excess-guard')) {
            silentCount('blank-excess', `大题「${title}」空位数(${blanks})多于拼音组数(${pinyinGroups})`);
          }
        }

        // 2b. 同题组子题载体一致性（规则 sub-carrier-fix：提示性描述，不改内容）
        if (has('sub-carrier-fix')) {
          const subConsistency = checkSubQuestionConsistency(secText);
          if (subConsistency) {
            issues.push({ severity: 'info', type: 'sub-inconsistent', message: subConsistency.message });
          }
        }

        // 2c. 读音题缺拼音选项（规则 pinyin-option-guard：静默）
        if (has('pinyin-option-guard') && (/读音|加点字/.test(title) || /读音|加点字/.test(secText.slice(0, 300)))) {
          if (pinyinOpts === 0) {
            silentCount('pinyin-option', `大题「${title}」未检测到拼音选项（如"（háng xíng）"），可能有小题缺选项`);
          }
        }

        // 2d. 连线项不对称（规则 match-symmetric-guard：静默）
        if (has('match-symmetric-guard') && matchSides && matchSides.total % 2 !== 0) {
          silentCount('match-asymmetric', `大题「${title}」连线题左右项数不对称（共 ${matchSides.total} 项）`);
        }

        // 2e. 选择题选项过少（规则 option-count-guard：静默）
        if (has('option-count-guard') && /选一选|选择|选出/.test(secText.slice(0, 400)) && options > 0 && options < 2) {
          silentCount('option-missing', `大题「${title}」选项数过少(${options})`);
        }

        // 2f. 分值标注修正（规则 score-label-fix：每空/每线/每题分标注与载体数对齐）
        if (has('score-label-fix')) {
          const carrierTotal = blanks || (matchSides ? matchSides.left : 0) || pinyinOpts || (/连/.test(title) ? countMatchLines(secText) : 0);
          const newTitle = fixScoreLabel(title, totalScore, carrierTotal, countSubQuestions(secText));
          if (newTitle !== title) {
            head.textContent = newTitle;
            issues.push({ severity: 'info', type: 'score-label', message: `分值标注已对齐：${newTitle}` });
            fixed += 1;
          }
        }

        // 2g. 小题标题分值标注校验（规则 score-label-fix，p 级标题）
        if (has('score-label-fix')) {
          const subHeadPs = secNodes.filter(n => n.nodeType === Node.ELEMENT_NODE && n.tagName.toLowerCase() === 'p');
          const subTitles = [];
          for (const p of subHeadPs) {
            const t = (p.textContent || '').trim();
            if (!/^\s*(?:\d+[.、．]|[(（]\d+[)）])/.test(t)) continue;
            if (!/[（(]\s*\d{1,3}\s*分/.test(t)) continue;
            subTitles.push({ p, text: t });
          }
          subTitles.forEach((st, i) => {
            const nodesBetween = [];
            let n = st.p.nextSibling;
            const endNode = subTitles[i + 1] ? subTitles[i + 1].p : null;
            while (n && n !== endNode) { nodesBetween.push(n); n = n.nextSibling; }
            let segHtml = st.p.outerHTML;
            for (const nb of nodesBetween) segHtml += nb.outerHTML || nb.textContent || '';
            const segText = st.text + nodesBetween.map(x => x.textContent || '').join('');
            const sBlanks = countBlanks(segHtml);
            const sMatch = countMatchSides(segHtml);
            const sPinyin = countPinyinOptions(segHtml);
            const carrier = sBlanks || (sMatch ? sMatch.left : 0) || sPinyin || (/连/.test(st.text) ? countMatchLines(segText) : 0);
            const cm2 = st.text.match(/共\s*(\d{1,3})\s*分/);
            const sm2 = st.text.match(/[（(]\s*(\d{1,3})\s*分/);
            const scoreM = cm2 || sm2;
            if (!scoreM || !carrier) return;
            const sScore = parseInt(scoreM[1], 10);
            const newT = fixScoreLabel(st.text, sScore, carrier, countSubNumbered(segText));
            if (newT !== st.text) {
              st.p.textContent = newT;
              issues.push({ severity: 'info', type: 'score-label', message: `小题分值标注已对齐：${newT}` });
              fixed += 1;
            }
          });
        }
      });
      out = tpl.innerHTML;
    } catch (e) {
      console.warn('⚠️ 大题级质检失败（不影响其他修复）:', e.message);
    }
  }

  // ── 3. 答案区一致性（规则 answer-section-fix / answer-shell-guard / answer-coverage-guard）──
  {
    // 3a. 答案区容器补全（规则 answer-section-fix）：<h2>参考答案… 无 answer-section 包裹 → 补包
    //    （docx 导出按 answer-section 拆分独立分节；与 useAiGenerator once 模式兜底幂等）
    if (has('answer-section-fix') && !/<div[^>]*class=["'][^"']*answer-section[^"']*["'][^>]*>[\s\S]*?<h2[^>]*>\s*参考答案/i.test(out)) {
      const newOut = out.replace(/(<h2[^>]*>\s*参考答案[\s\S]*?)$/i, (m, ansPart) => `<div class="answer-section">\n${ansPart}</div>`);
      if (newOut !== out) {
        out = newOut;
        issues.push({ severity: 'info', type: 'answer-section', message: '答案区已自动补包为独立 answer-section' });
        fixed += 1;
      }
    }

    // 3b. 答案区内容（answer-shell-guard / answer-coverage-guard：静默）
    const ansMatch = out.match(/<div[^>]*class=["'][^"']*answer-section[^"']*["'][^>]*>([\s\S]*)$/i);
    if (ansMatch) {
      const ansText = stripTags(ansMatch[1]);
      if (has('answer-shell-guard') && /[（(]?\s*(略|见教材|自行查阅|答案略|详见教材)\s*[)）]?/.test(ansText)) {
        silentCount('answer-shell', '答案区检测到"略/见教材"等空壳答案');
      }
      if (has('answer-coverage-guard')) {
        const bodyText = stripTags(out.split(/<div[^>]*class=["'][^"']*answer-section/i)[0]);
        const bodyTopQ = (bodyText.match(/(?:^|\n)\s*\d+[.、．]/g) || []).length;
        const ansTopQ = (ansText.match(/(?:^|\n)\s*\d+[.、．]/g) || []).length;
        if (bodyTopQ > 3 && ansTopQ < bodyTopQ - 1) {
          silentCount('answer-coverage', `答案区题号数(${ansTopQ})明显少于正文(${bodyTopQ})`);
        }
      }
    }
  }

  // ── 4. 阅读选文出处标注（规则 reading-source-guard：静默）──
  if (has('reading-source-guard')) {
    const secTexts = String(out).split(/<h[234][^>]*>/i).map(s => stripTags(s).trim()).filter(s => s.length > 200);
    const hasSource = /【\s*选自|【\s*出自|【\s*节选|选自教材|节选自/.test(out);
    if (!hasSource && secTexts.length > 0 && /(短文|选文|阅读|课内|课外阅读)/.test(out)) {
      silentCount('reading-source', '阅读选文未检测到【选自…】出处标注');
    }
  }

  return { html: out, issues, fixed, silent };
};

/** 统计大题内子题数（"1." 式小题编号） */
const countSubQuestions = (raw) => {
  const text = stripTags(raw);
  return (text.match(/(?:^|\n)\s*\d+[.、．]/g) || []).length;
};

/** 统计"（1）（2）"式子题编号数（小题分值标注用） */
const countSubNumbered = (raw) => {
  const text = stripTags(raw);
  return (text.match(/[(（]\s*\d+\s*[)）]/g) || []).length;
};

/**
 * 同题组子题载体一致性检查（纯文本输入）：
 * 提取（1）（2）…子题文本，若 ≥2 个子题且各子题"作答载体数"（拼音选项组/空位）参差不齐 → 返回警告文案
 */
const checkSubQuestionConsistency = (text) => {
  const marks = [];
  const re = /[(（]\s*(\d+)\s*[)）]/g;
  let m;
  while ((m = re.exec(text)) !== null) marks.push({ idx: parseInt(m[1], 10), start: m.index });
  if (marks.length < 2) return '';
  const features = [];
  for (let i = 0; i < marks.length; i++) {
    const start = marks[i].start;
    const end = i + 1 < marks.length ? marks[i + 1].start : text.length;
    const seg = text.slice(start, end);
    const opts = (seg.match(PINYIN_OPTION_RE) || []).length;
    const blanks = countBlanks(`<p>${seg}</p>`);
    const carrier = opts > 0 ? opts : blanks;
    features.push({ idx: marks[i].idx, carrier, hasPinyin: opts > 0 });
  }
  const carrierSet = new Set(features.map(f => f.carrier));
  const hasPinyinMix = features.some(f => f.hasPinyin) && features.some(f => !f.hasPinyin);
  if (carrierSet.size > 1 || hasPinyinMix) {
    const desc = features.map(f => `(${f.idx})${f.carrier}${f.hasPinyin ? '拼音选项' : '空'}`).join('、');
    const message = `子题作答载体不一致（${desc}）：同题组内各子题应有相同数量的空位/选项，部分子题可能缺空或缺选项，请人工复核`;
    // 拼音选项混合（有的子题有拼音选项、有的没有）= 大概率缺选项 → warning；
    // 纯空位数量差异（如"月亮圆又圆"两个空）可能是合法设计 → 仅提示
    return { severity: hasPinyinMix ? 'warning' : 'info', message };
  }
  return '';
};

/**
 * 为"看拼音写词语/拼音填空"补齐缺失的空位（DOM 版）：
 * 在给定节点列表内的文本节点上，为"拼音组后紧跟汉字（且后无空位）"的位置补（　　）
 * @param {Array<Element|Text>} nodes DOM 节点列表
 * @param {number} missing 期望补全数
 * @returns {{recovered: boolean}}
 */
const fixMissingPinyinBlanksInDom = (nodes, missing) => {
  let recovered = 0;
  try {
    const re = new RegExp(`([${PINYIN_CHARS}]+)(?=\\s*[\\u4e00-\\u9fa5])`, 'g');
    for (const root of nodes) {
      if (recovered >= missing) break;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const textNodes = [];
      while (walker.nextNode()) textNodes.push(walker.currentNode);
      for (const node of textNodes) {
        if (recovered >= missing) break;
        const t = node.nodeValue || '';
        let fixedText = t;
        let mm;
        let changed = false;
        re.lastIndex = 0;
        while ((mm = re.exec(fixedText)) !== null && recovered < missing) {
          // 该拼音组后紧跟汉字且后面没有空位 → 补（　　）
          const after = fixedText.slice(mm.index + mm[1].length);
          if (/[（(]\s*[　\s]{1,6}\s*[)）]/.test(after)) continue; // 已有空位
          fixedText = fixedText.slice(0, mm.index + mm[1].length) + '（　　　　）' + fixedText.slice(mm.index + mm[1].length);
          recovered += 1;
          changed = true;
        }
        if (changed) node.nodeValue = fixedText;
      }
    }
  } catch (e) {
    console.warn('⚠️ 拼音空位补齐失败:', e.message);
  }
  return { recovered: recovered >= missing };
};

export default { auditExamPaper, normalizePinyinText, countBlanks, countPinyinGroups, countPinyinOptions, countOptions, countMatchSides, splitSections, fixScoreLabel };
