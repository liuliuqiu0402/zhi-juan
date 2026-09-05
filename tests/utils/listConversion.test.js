// 列表转文本（自动编号 → 非自动编号文本前缀）回归测试
// ============================================================
// 覆盖 RichTextEditor.vue 中 convertListToMarkedParagraphs / buildListPrefix 的契约：
//   1) 保层级 —— 嵌套列表按深度用全角空格缩进
//   2) 各自符号 —— 无序列表保 data-marker（缺失按嵌套深度取 •/○/▪ 级联符号，不塌成同一种）；
//                  有序列表读自身 type（a/A/i/I），混合级别各自保留
//   3) 不误伤 —— 列表外普通段落原样不动
import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';

// ⚠️ 与 RichTextEditor.vue 保持一致（SFC 内不复用；此为本链路唯一回归锁定）
const UL_LEVEL_MARKERS = ['• ', '○ ', '▪ ', '◦ ', '▪ '];
const toRoman = (num) => { const T = [[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']]; let n=Math.max(1,Math.floor(num)),o=''; for(const[v,s]of T){while(n>=v){o+=s;n-=v;}} return o; };
const buildListPrefix = (marker, idx, type = null, depth = 0) => {
  const indent = '　'.repeat(depth);
  const t = type || marker;
  if (t === null || t === undefined) return indent + `${idx + 1}. `;
  if (t === 'a') return indent + `${String.fromCharCode(97 + (idx % 26))}. `;
  if (t === 'A') return indent + `${String.fromCharCode(65 + (idx % 26))}. `;
  if (t === 'i') return indent + toRoman(idx + 1).toLowerCase() + '. ';
  if (t === 'I') return indent + toRoman(idx + 1) + '. ';
  return indent + t;
};
const countAncestors = (node, tagName) => { let c=0,p=node.parentElement; while(p){ if(p.tagName===tagName.toUpperCase())c++; p=p.parentElement; } return c; };
const prependMarkerToLI = (doc, li, prefix) => {
  const firstP = Array.from(li.children).find(ch => ch.tagName === 'P');
  if (firstP) {
    const tn = firstP.firstChild;
    if (tn && tn.nodeType === 3) tn.textContent = prefix + tn.textContent;
    else firstP.insertBefore(doc.createTextNode(prefix), firstP.firstChild);
  } else {
    const tn = li.firstChild;
    if (tn && tn.nodeType === 3) tn.textContent = prefix + tn.textContent;
    else li.insertBefore(doc.createTextNode(prefix), li.firstChild);
  }
};
// 无序符号：包成 span.list-marker（小字号字形），与 RichTextEditor.vue prependBulletMarker 一致
const prependBulletMarker = (doc, li, depth, marker) => {
  const frag = doc.createDocumentFragment();
  if (depth > 0) frag.appendChild(doc.createTextNode('　'.repeat(depth)));
  const glyph = String(marker).trimEnd();
  if (glyph) {
    const span = doc.createElement('span');
    span.className = 'list-marker';
    span.textContent = glyph;
    frag.appendChild(span);
  }
  frag.appendChild(doc.createTextNode(' '));
  const firstP = Array.from(li.children).find(ch => ch.tagName === 'P');
  const host = firstP || li;
  host.insertBefore(frag, host.firstChild);
};
const convert = (html, listTag, marker) => {
  const dom = new JSDOM('<body>' + html + '</body>');
  const doc = dom.window.document;
  const lists = Array.from(doc.querySelectorAll(listTag));
  lists.sort((a,b) => countAncestors(b,listTag) - countAncestors(a,listTag));
  for (const list of lists) {
    const depth = countAncestors(list, listTag);
    const isOl = listTag === 'ol';
    const type = isOl ? (list.getAttribute('type') || null) : null;
    const selfMarker = isOl
      ? (type ? null : marker)
      : (list.getAttribute('data-marker') || UL_LEVEL_MARKERS[Math.min(depth, UL_LEVEL_MARKERS.length - 1)]);
    const lis = Array.from(list.querySelectorAll(':scope > li'));
    lis.forEach((li, idx) => {
      if (isOl) prependMarkerToLI(doc, li, buildListPrefix(selfMarker, idx, type, depth));
      else prependBulletMarker(doc, li, depth, selfMarker);
      li.replaceWith(...Array.from(li.childNodes));
    });
    list.replaceWith(...Array.from(list.childNodes));
  }
  return doc.body.innerHTML;
};

/** 取每个 <p> 的纯文本前缀（以段落为单位），便于断言前缀与缩进 */
const paraLines = (html) => Array.from(new JSDOM('<body>' + html + '</body>').window.document.querySelectorAll('p')).map(p => p.textContent);

describe('convertListToMarkedParagraphs（自动编号→文本前缀）', () => {
  it('无 data-marker 的嵌套无序列表按深度取 •/○/▪ 级联符号（真实文档多级列表不塌成同一种）', () => {
    const src = '<ul><li><p>小数乘法</p><ul><li><p>意义</p><ul><li><p>深层</p></li></ul></li></ul></li></ul>';
    expect(paraLines(convert(src, 'ul'))).toEqual(['• 小数乘法', '　○ 意义', '　　▪ 深层']);
  });

  it('各种 data-marker 列表转文本时各保其自身符号', () => {
    const src =
      '<ul data-marker="• "><li><p>要点一</p></li><li><p>要点二</p></li></ul>' +
      '<ul data-marker="○ "><li><p>子要点</p></li></ul>' +
      '<ul data-marker="✎ "><li><p>铅笔一项</p></li></ul>' +
      '<ul data-marker="√ "><li><p>对勾一项</p></li></ul>';
    expect(paraLines(convert(src, 'ul'))).toEqual(['• 要点一', '• 要点二', '○ 子要点', '✎ 铅笔一项', '√ 对勾一项']);
  });

  it('嵌套无序列表：外层自带符号，内层无记号且不同深度仍级联', () => {
    const src = '<ul data-marker="■ "><li><p>父项</p><ul><li><p>一层</p><ul><li><p>二层</p></li></ul></li></ul></li></ul>';
    expect(paraLines(convert(src, 'ul'))).toEqual(['■ 父项', '　○ 一层', '　　▪ 二层']);
  });

  it('混合有序列表（A/a/i）各层各自保留，不互相覆盖', () => {
    const src =
      '<ol type="A"><li><p>步骤一</p><ol type="a"><li><p>小写 a</p>' +
      '<ol type="i"><li><p>细分 i</p></li><li><p>细分 ii</p></li></ol></li>' +
      '<li><p>小写 b</p></li></ol></li><li><p>步骤二</p></li></ol>' +
      '<ol type="A"><li><p>大写 A</p></li><li><p>大写 B</p></li></ol>';
    expect(paraLines(convert(src, 'ol', null))).toEqual([
      'A. 步骤一', '　a. 小写 a', '　　i. 细分 i', '　　ii. 细分 ii', '　b. 小写 b',
      'B. 步骤二', 'A. 大写 A', 'B. 大写 B',
    ]);
  });

  it('无 type 的无记号有序列表（样式形态已归一）退化为数字', () => {
    const src = '<ol><li><p>甲</p></li><li><p>乙</p></li></ol>';
    expect(paraLines(convert(src, 'ol', null))).toEqual(['1. 甲', '2. 乙']);
  });

  it('列表外普通段落原样不动（不误伤）', () => {
    const src = '<p>这是普通段落，转换上面列表时它应原样不动。</p><ul><li><p>甲</p></li></ul><p>这也是段落。</p>';
    expect(paraLines(convert(src, 'ul'))).toEqual(['这是普通段落，转换上面列表时它应原样不动。', '• 甲', '这也是段落。']);
  });

  it('无序符号包成 span.list-marker（小字号字形），有序不带该 span（保持纯文本）', () => {
    const ul = convert('<ul data-marker="○ "><li><p>子要点</p></li></ul>', 'ul');
    expect(ul).toContain('<span class="list-marker">○</span>');
    // 有序始终是纯文本前缀
    const ol = convert('<ol type="A"><li><p>步骤</p></li></ol>', 'ol', null);
    expect(ol).not.toContain('list-marker');
    expect(ol).toContain('A. 步骤');
  });
});