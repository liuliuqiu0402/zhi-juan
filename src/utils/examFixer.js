// 生成后程序化修正（不依赖 AI 的根治兜底，确保一次成功）：
// 1. 移除题干前的"【场景/情境/背景：xx】"标签前缀（卷面干净正式，蓝本第12条）
// 2. 大题标题旧式"（X分）"→ 自动补全明细式"（共N题，每题X分，共X分）"
//    （统计大题下小题数，分值整除时标注"每题X分"，否则"共N题，共X分"，蓝本第6条）

/**
 * 统计一个大题标题下的小题数（下一个大题标题前，`1.`/`1、`/`1．`开头的行）
 */
const countSubQuestions = (startEl, endEl) => {
  let count = 0;
  let node = startEl;
  while (node && node !== endEl) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = node.tagName.toLowerCase();
      if (tag === 'p' || tag === 'li' || tag === 'div') {
        const t = (node.textContent || '').trim();
        // 只计"1."式小题编号，不计"（1）"子题，避免把子题当小题
        if (/^\d+[.、．]/.test(t)) count += 1;
      }
    }
    node = node.nextSibling;
  }
  return count;
};

export const fixExamFormats = (html) => {
  if (!html || typeof html !== 'string') return html || '';
  let out = html;

  // ── 1. 移除题干前的"【场景/情境/背景：xx】"标签前缀 ──
  out = out.replace(/(<p[^>]*>)\s*【[^】]*(?:场景|情境|背景|语境)[^】]*】\s*/g, '$1');

  // ── 2. 大题标题旧式"（X分）"→ 明细式 ──
  try {
    const tpl = document.createElement('template');
    tpl.innerHTML = out;
    const heads = Array.from(tpl.content.querySelectorAll('h2, h3, h4')).filter((h) => {
      const t = (h.textContent || '').trim();
      return /^[一二三四五六七八九十]+、/.test(t) && /[（(]\s*\d{1,3}\s*分\s*[)）]\s*$/.test(t) && !/共\s*\d+\s*题/.test(t);
    });
    heads.forEach((h, i) => {
      const title = (h.textContent || '').trim();
      const scoreMatch = title.match(/[（(]\s*(\d{1,3})\s*分\s*[)）]\s*$/);
      if (!scoreMatch) return;
      const totalScore = parseInt(scoreMatch[1], 10);
      const nextHead = heads[i + 1];
      const count = countSubQuestions(h.nextSibling, nextHead || null);
      if (count <= 0) return;
      // 单题时不标"每题X分"（规范：仅多题且分值整除时标注每题分）
      const perScore = count > 1 && totalScore % count === 0 ? totalScore / count : null;
      const detail = perScore != null
        ? `共${count}题，每题${perScore}分，共${totalScore}分`
        : `共${count}题，共${totalScore}分`;
      h.textContent = title.replace(/[（(]\s*\d{1,3}\s*分\s*[)）]\s*$/, `（${detail}）`);
    });
    out = tpl.innerHTML;
  } catch (e) {
    // DOM 解析失败时保留原内容（正则修复已部分生效）
    console.warn('明细式标题补全失败，保留原内容:', e);
  }

  return out;
};
