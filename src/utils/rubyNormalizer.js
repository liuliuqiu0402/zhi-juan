// ═══════════════ 注音/拼音预处理：<ruby> 标签转 span.ruby-char，并逐字拆分多字 span ═══════════════
// 两遍处理：
//   Pass 1：<ruby>字<rt>pinyin</rt></ruby> → <span class="ruby-char" data-pinyin="pinyin">字</span>
//   Pass 2：已存在的多字 .ruby-char span → 逐字拆为独立的 <span class="ruby-char" data-pinyin="...">字</span>
// 由 PreserveSpan 保留 class + data-pinyin，CSS ::before 绘制上方拼音

export const normalizeRubyTags = (html) => {
  if (!html) return html;

  const hasRubyTags = /<ruby/i.test(html);
  const hasRubyChar = /ruby-char/i.test(html);
  if (!hasRubyTags && !hasRubyChar) return html;

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  let modified = false;
  let splitCount = 0;

  // ═══ Pass 1: <ruby> 标签 → span.ruby-char ═══
  if (hasRubyTags) {
    const rubies = Array.from(doc.querySelectorAll('ruby'));
    if (rubies.length > 0) {
      // 自底向上处理（嵌套 ruby 的内层先处理）
      rubies.sort((a, b) => {
        const depthA = [...a.querySelectorAll('ruby')].length;
        const depthB = [...b.querySelectorAll('ruby')].length;
        return depthA - depthB;
      });
      for (const ruby of rubies) {
        const rt = ruby.querySelector('rt');
        const pinyin = rt ? rt.textContent.trim() : '';
        let baseHtml = '';
        for (const child of ruby.childNodes) {
          if (child.nodeType === 3) {
            baseHtml += child.textContent;
          } else if (child.nodeType === 1) {
            const tag = child.tagName.toLowerCase();
            if (tag === 'rt' || tag === 'rp') continue;
            baseHtml += child.outerHTML || child.textContent || '';
          }
        }
        if (!baseHtml.trim()) {
          const clone = ruby.cloneNode(true);
          clone.querySelectorAll('rt, rp').forEach(el => el.remove());
          baseHtml = clone.textContent || '';
        }
        const baseText = baseHtml.trim();
        if (pinyin && baseText) {
          modified = true;
          // 逐字拆分
          const baseChars = [...baseText];
          const pinyinParts = pinyin.split(/\s+/).filter(Boolean);
          const hasNoChildElements = !/<[^>]+>/.test(baseHtml);
          if (hasNoChildElements && baseChars.length > 1 && baseChars.length === pinyinParts.length) {
            splitCount++;
            const fragment = doc.createDocumentFragment();
            for (let i = 0; i < baseChars.length; i++) {
              const s = doc.createElement('span');
              s.className = 'ruby-char';
              s.setAttribute('data-pinyin', pinyinParts[i]);
              s.textContent = baseChars[i];
              fragment.appendChild(s);
            }
            ruby.parentNode.replaceChild(fragment, ruby);
          } else {
            const span = doc.createElement('span');
            span.className = 'ruby-char';
            span.setAttribute('data-pinyin', pinyin);
            span.innerHTML = baseHtml || baseText;
            ruby.parentNode.replaceChild(span, ruby);
          }
        } else if (baseText) {
          modified = true;
          const textNode = doc.createTextNode(baseText);
          ruby.parentNode.replaceChild(textNode, ruby);
        }
      }
    }
  }

  // ═══ Pass 2: 拆分已存在的多字符 .ruby-char[data-pinyin] span ═══
  // 场景：AI 生成的 span 已有多字一体（如 <span data-pinyin="chūn tiān">春 天</span>）
  const rubyChars = Array.from(doc.querySelectorAll('.ruby-char[data-pinyin]'));
  let spanSplitCount = 0;
  for (const span of rubyChars) {
    const baseText = span.textContent.trim();
    const pinyinRaw = (span.getAttribute('data-pinyin') || '').trim();
    if (!baseText || !pinyinRaw) continue;

    // 🔧 内含元素子节点（如田字格 span）时跳过拆分：逐字重建会丢失子元素结构
    if ([...span.childNodes].some((n) => n.nodeType === Node.ELEMENT_NODE)) continue;

    // 去空格后的纯字符
    const baseChars = [...baseText.replace(/\s+/g, '')];
    const pinyinParts = pinyinRaw.split(/\s+/).filter(Boolean);

    if (baseChars.length > 1 && baseChars.length === pinyinParts.length) {
      spanSplitCount++;
      modified = true;
      const fragment = doc.createDocumentFragment();
      for (let i = 0; i < baseChars.length; i++) {
        const s = doc.createElement('span');
        s.className = 'ruby-char';
        s.setAttribute('data-pinyin', pinyinParts[i]);
        s.textContent = baseChars[i];
        fragment.appendChild(s);
      }
      span.parentNode.replaceChild(fragment, span);
    }
  }

  if (spanSplitCount > 0) {
    splitCount += spanSplitCount;
  }

  return modified ? doc.body.innerHTML : html;
};
