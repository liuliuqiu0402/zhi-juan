// 列表转文本（自动编号 → 非自动编号文本前缀）回归测试
// ============================================================
// 覆盖 RichTextEditor.vue 中 convertListToMarkedParagraphs / buildListPrefix 的契约：
//   1) 保层级 —— 嵌套列表按深度用 margin-left 块级左缩进（每层 2em，折行跟随层级，而非行首空格）
//   2) 各自符号 —— 无序列表保 data-marker（缺失按嵌套深度取 •/○/▪ 级联符号，不塌成同一种）；
//                  有序列表读自身 type（a/A/i/I），混合级别各自保留
//   3) 不误伤 —— 列表外普通段落原样不动
import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';

// ⚠️ 与 RichTextEditor.vue 保持一致（SFC 内不复用；此为本链路唯一回归锁定）
const UL_LEVEL_MARKERS = ['• ', '○ ', '▪ ', '◦ ', '▪ '];
const LIST_INDENT_EM = 2;
const toRoman = (num) => { const T = [[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']]; let n=Math.max(1,Math.floor(num)),o=''; for(const[v,s]of T){while(n>=v){o+=s;n-=v;}} return o; };
// 层级不再用行首全角空格（折行会回到段左边距），改由段落的块级 margin-left 表达（每层 2em）
const buildListPrefix = (marker, idx, type = null) => {
  const t = type || marker;
  if (t === null || t === undefined) return `${idx + 1}. `;
  if (t === 'a') return `${String.fromCharCode(97 + (idx % 26))}. `;
  if (t === 'A') return `${String.fromCharCode(65 + (idx % 26))}. `;
  if (t === 'i') return toRoman(idx + 1).toLowerCase() + '. ';
  if (t === 'I') return toRoman(idx + 1) + '. ';
  return t;
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
// 无序符号：仅空心圆包成 span.list-marker（小字号字形），其余为普通文本，与 RichTextEditor.vue prependBulletMarker 一致
const isSmall = (g) => g === '○' || g === '◦';
const RE_SELF_NUMBERED = /^[ \t\u3000\u00A0\u2003\u2002]*(?:[A-Za-z][.、．:：]|\d+[.、．:：]|[（(]\s*\d+\s*[)）]|[一二三四五六七八九十]{1,3}[.、．]|[（(][一二三四五六七八九十]{1,3}[)）]|[\u2460-\u2473\u2776-\u277F\u3251-\u325F])/;
const prependBulletMarker = (doc, li, marker) => {
  const frag = doc.createDocumentFragment();
  const glyph = String(marker).trimEnd();
  if (glyph) {
    if (isSmall(glyph)) {
      const span = doc.createElement('span');
      span.className = 'list-marker';
      span.textContent = glyph;
      frag.appendChild(span);
    } else {
      frag.appendChild(doc.createTextNode(glyph));
    }
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
      // 块级缩进落到稳定的 <p> 宿主（无 <p> 时包一层），每层 LIST_INDENT_EM em
      let host = Array.from(li.children).find(ch => ch.tagName === 'P');
      if (!host) {
        host = doc.createElement('p');
        while (li.firstChild) host.appendChild(li.firstChild);
        li.appendChild(host);
      }
      if (depth > 0) host.style.marginLeft = (depth * LIST_INDENT_EM) + 'em';
      // 条目文本已自带序号 → 剥离列表符号/编号（层级由 margin 表达）
      const selfNumbered = RE_SELF_NUMBERED.test(li.textContent || '');
      if (!selfNumbered) {
        if (isOl) prependMarkerToLI(doc, li, buildListPrefix(selfMarker, idx, type));
        else prependBulletMarker(doc, li, selfMarker);
      }
      li.replaceWith(...Array.from(li.childNodes));
    });
    list.replaceWith(...Array.from(list.childNodes));
  }
  return doc.body.innerHTML;
};

/** 取每个 <p> 的纯文本 + 块级左缩进（margin-left），便于断言前缀与层级 */
const paraInfo = (html) => Array.from(new JSDOM('<body>' + html + '</body>').window.document.querySelectorAll('p'))
  .map(p => ({ text: p.textContent, ml: p.style.marginLeft || '' }));

describe('convertListToMarkedParagraphs（自动编号→文本前缀）', () => {
  it('无 data-marker 的嵌套无序列表按深度取 •/○/▪ 级联符号（真实文档多级列表不塌成同一种）', () => {
    const src = '<ul><li><p>小数乘法</p><ul><li><p>意义</p><ul><li><p>深层</p></li></ul></li></ul></li></ul>';
    expect(paraInfo(convert(src, 'ul'))).toEqual([
      { text: '• 小数乘法', ml: '' },
      { text: '○ 意义', ml: '2em' },
      { text: '▪ 深层', ml: '4em' },
    ]);
  });

  it('各种 data-marker 列表转文本时各保其自身符号', () => {
    const src =
      '<ul data-marker="• "><li><p>要点一</p></li><li><p>要点二</p></li></ul>' +
      '<ul data-marker="○ "><li><p>子要点</p></li></ul>' +
      '<ul data-marker="✎ "><li><p>铅笔一项</p></li></ul>' +
      '<ul data-marker="√ "><li><p>对勾一项</p></li></ul>';
    expect(paraInfo(convert(src, 'ul'))).toEqual([
      { text: '• 要点一', ml: '' }, { text: '• 要点二', ml: '' },
      { text: '○ 子要点', ml: '' }, { text: '✎ 铅笔一项', ml: '' }, { text: '√ 对勾一项', ml: '' },
    ]);
  });

  it('嵌套无序列表：外层自带符号，内层无记号且不同深度仍级联', () => {
    const src = '<ul data-marker="■ "><li><p>父项</p><ul><li><p>一层</p><ul><li><p>二层</p></li></ul></li></ul></li></ul>';
    expect(paraInfo(convert(src, 'ul'))).toEqual([
      { text: '■ 父项', ml: '' }, { text: '○ 一层', ml: '2em' }, { text: '▪ 二层', ml: '4em' },
    ]);
  });

  it('混合有序列表（A/a/i）各层各自保留，不互相覆盖', () => {
    const src =
      '<ol type="A"><li><p>步骤一</p><ol type="a"><li><p>小写 a</p>' +
      '<ol type="i"><li><p>细分 i</p></li><li><p>细分 ii</p></li></ol></li>' +
      '<li><p>小写 b</p></li></ol></li><li><p>步骤二</p></li></ol>' +
      '<ol type="A"><li><p>大写 A</p></li><li><p>大写 B</p></li></ol>';
    expect(paraInfo(convert(src, 'ol', null))).toEqual([
      { text: 'A. 步骤一', ml: '' }, { text: 'a. 小写 a', ml: '2em' },
      { text: 'i. 细分 i', ml: '4em' }, { text: 'ii. 细分 ii', ml: '4em' },
      { text: 'b. 小写 b', ml: '2em' }, { text: 'B. 步骤二', ml: '' },
      { text: 'A. 大写 A', ml: '' }, { text: 'B. 大写 B', ml: '' },
    ]);
  });

  it('无 type 的无记号有序列表（样式形态已归一）退化为数字', () => {
    const src = '<ol><li><p>甲</p></li><li><p>乙</p></li></ol>';
    expect(paraInfo(convert(src, 'ol', null))).toEqual([{ text: '1. 甲', ml: '' }, { text: '2. 乙', ml: '' }]);
  });

  it('列表外普通段落原样不动（不误伤）', () => {
    const src = '<p>这是普通段落，转换上面列表时它应原样不动。</p><ul><li><p>甲</p></li></ul><p>这也是段落。</p>';
    expect(paraInfo(convert(src, 'ul'))).toEqual([
      { text: '这是普通段落，转换上面列表时它应原样不动。', ml: '' }, { text: '• 甲', ml: '' }, { text: '这也是段落。', ml: '' },
    ]);
  });

  it('仅空心圆包成 span.list-marker（小字号），实心/其他符号为普通文本；有序不带该 span', () => {
    const ulCircle = convert('<ul data-marker="○ "><li><p>子要点</p></li></ul>', 'ul');
    expect(ulCircle).toContain('<span class="list-marker">○</span>');
    // 实心 • 保持普通文本（不缩小）
    const ulSolid = convert('<ul data-marker="• "><li><p>要点</p></li></ul>', 'ul');
    expect(ulSolid).not.toContain('list-marker');
    expect(ulSolid).toContain('• 要点');
    // 有序始终是纯文本前缀
    const ol = convert('<ol type="A"><li><p>步骤</p></li></ol>', 'ol', null);
    expect(ol).not.toContain('list-marker');
    expect(ol).toContain('A. 步骤');
  });

  it('条目文本已自带序号(① ②) → 转换时剥离列表圆点，仅保留文本序号（小数乘法知识框架场景）', () => {
    const src = '<ul><li><p><strong>小数乘法</strong></p><ul><li><p>① 意义</p></li><li><p>② 方法</p></li></ul></li></ul>';
    const out = convert(src, 'ul');
    // 内层 ①/② 项不再叠加列表符号（未出现 ○ 圆点与 list-marker），层级改为 margin-left:2em 表达
    expect(paraInfo(out)).toEqual([
      { text: '• 小数乘法', ml: '' },
      { text: '① 意义', ml: '2em' },
      { text: '② 方法', ml: '2em' },
    ]);
    expect(out).not.toContain('○ ①');
    expect(out).not.toContain('list-marker');
  });

  it('剥离序号时不塌层级：两级嵌套自有序号条目按深度保留块级缩进', () => {
    const src = '<ul><li><p><strong>总纲</strong></p><ul><li><p>① 一级</p><ul><li><p>② 二级</p></li></ul></li></ul></li></ul>';
    // 顶层无自带序号补 •（无缩进）；一级①缩 2em；二级②缩 4em
    expect(paraInfo(convert(src, 'ul'))).toEqual([
      { text: '• 总纲', ml: '' },
      { text: '① 一级', ml: '2em' },
      { text: '② 二级', ml: '4em' },
    ]);
  });

  it('条目文本已自带字母/数字/中文序号 → 同样剥离，不双叠', () => {
    expect(convert('<ul><li><p>1. 甲</p></li></ul>', 'ul')).not.toContain('• 1.');
    expect(convert('<ul><li><p>一、甲</p></li></ul>', 'ul')).not.toContain('• 一、');
    expect(convert('<ul><li><p>A. 甲</p></li></ul>', 'ul')).not.toContain('• A.');
  });
});