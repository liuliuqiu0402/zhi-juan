/**
 * HTML 预处理工具：将 AI 生成的 class 样式 / 语义标签颜色转换为内联样式
 * 
 * 背景：AI 生成 <style>.tip{color:red}</style> + <p class="tip">，但：
 *   - Tiptap 编辑器不解析 <style> 块，导致 class 颜色在编辑器中丢失
 *   - 导出路径直接使用原始 HTML，不经过编辑器预处理管道
 * 
 * 方案：提供共享预处理函数，编辑器和导出双路径复用
 */

// ═══════════════ class 样式 → 内联样式 ═══════════════
// 解析 <style> 块中的 CSS 规则，将匹配的元素 class 样式合并到元素内联 style
export const convertClassStylesToInline = (html) => {
  if (!html) return html;
  if (!/<style[^>]*>/i.test(html)) return html;

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const styleElements = doc.querySelectorAll('style');
  if (styleElements.length === 0) return html;

  let allCSS = '';
  styleElements.forEach(el => {
    allCSS += el.textContent + '\n';
    el.remove();
  });
  if (!allCSS.trim()) return html;

  // 解析 CSS 规则：selector { properties }
  const ruleRegex = /([^{]+)\{([^}]+)\}/g;
  let match;
  let modified = false;

  while ((match = ruleRegex.exec(allCSS)) !== null) {
    const rawSelector = match[1].trim();
    const rawProperties = match[2].trim();
    if (!rawSelector || !rawProperties) continue;

    // 跳过 @-规则和伪类/伪元素（无法转为内联）
    if (rawSelector.startsWith('@') || /::?[a-z-]+/i.test(rawSelector)) continue;
    // 跳过 html/body/* 等全局选择器
    if (/^(html|body|\*)$/i.test(rawSelector)) continue;

    try {
      const elements = doc.querySelectorAll(rawSelector);
      if (elements.length === 0) continue;

      const newDecls = rawProperties.split(';').map(d => d.trim()).filter(Boolean);

      elements.forEach(el => {
        modified = true;
        const existing = el.getAttribute('style') || '';
        const existingDecls = existing.split(';').map(d => d.trim()).filter(Boolean);

        // 合并：新声明覆盖同名旧声明
        const merged = new Map();
        existingDecls.forEach(d => {
          const colonIdx = d.indexOf(':');
          if (colonIdx > 0) merged.set(d.substring(0, colonIdx).trim().toLowerCase(), d.trim());
        });
        newDecls.forEach(d => {
          const colonIdx = d.indexOf(':');
          if (colonIdx > 0) merged.set(d.substring(0, colonIdx).trim().toLowerCase(), d.trim());
        });

        el.setAttribute('style', [...merged.values()].join('; '));
      });
    } catch (e) {
      // 跳过无效选择器（querySelectorAll 可能抛出异常）
    }
  }

  return modified ? doc.body.innerHTML : html;
};

// ═══════════════ 颜色样式归一化 ═══════════════
// 背景：Tiptap TextStyle mark 只匹配 <span> 元素，不匹配 <strong>/<em>/<u>/<s>
//       Color 扩展无法从非 span 元素提取颜色
//       导致 <strong style="color:red">text</strong> 的颜色在进入编辑器后丢失
// 方案：提取 color 从非 span 元素上，注入内层 <span style="color:...">
export const normalizeColorStyles = (html) => {
  if (!html) return html;
  // 需要处理的语义标签（Tiptap 有对应 Mark 但不支持 style 属性上的 color）
  const COLOR_SEMANTIC_TAGS = ['strong', 'b', 'em', 'i', 'u', 'ins', 's', 'del', 'strike'];
  const selector = COLOR_SEMANTIC_TAGS.map(t => `${t}[style]`).join(',');
  if (!new RegExp(`<(${COLOR_SEMANTIC_TAGS.join('|')})\\b[^>]*\\bcolor\\s*:`, 'i').test(html)) return html;

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const elements = Array.from(doc.querySelectorAll(selector));
  let modified = false;

  for (const el of elements) {
    // 读取计算样式中的 color（支持 rgb/rgba/hex 等格式）
    const colorVal = el.style.color;
    if (!colorVal) continue;

    modified = true;
    // 从原元素上移除 color 属性
    el.style.color = '';
    // 如果 style 已清空，移除 style 属性
    if (!el.getAttribute('style')?.trim()) el.removeAttribute('style');

    // 创建内层 span 承载颜色
    const span = doc.createElement('span');
    span.style.color = colorVal;
    // 将原元素的所有子节点移入 span
    while (el.firstChild) span.appendChild(el.firstChild);
    // 将 span 放回原元素
    el.appendChild(span);
  }

  return modified ? doc.body.innerHTML : html;
};

/**
 * 完整预处理管道：class → inline → color normalize
 * 用于编辑器 setContent 和导出前的 HTML 预处理
 */
export const preprocessHtml = (html) => {
  if (!html) return html;
  return normalizeColorStyles(convertClassStylesToInline(html));
};
