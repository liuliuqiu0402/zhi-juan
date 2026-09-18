/**
 * 畸形填空载体拆壳 + 英文省略号三点（2026-09 收口）
 * ============================================================
 * 保证：①blank-N 语义不变量——空书写位内部不允许正文文字：
 *       整段/整句被包（≥6 非空字符）→ 拆壳还原纯文本；块级标题 h1~h6 内
 *       不允许填空载体（无论长短都还原）；真填空位（&emsp;）不受影响；
 *       ②英文省略号三点：无汉字语境下的六点/四点省略号归一为 …；
 *       中文说明里的六点省略号保持（中文合法标点）。
 */
import { describe, it, expect } from 'vitest';
import { unwrapMalformedBlankCarriers, normalizeEnglishEllipsis, normalizeBlankMarkers } from '../../src/utils/contentCleaner.js';

describe('畸形填空载体拆壳（不变量守卫）', () => {
  it('整句被包进 blank-N → 拆壳还原纯文本（去掉误画线）', () => {
    const html = '<p><u class="blank-4">（2）I like P  best. I can run and play on the sports ground.</u></p>';
    const out = unwrapMalformedBlankCarriers(html);
    expect(out).not.toContain('<u class="blank-4">');
    expect(out).toContain('I like P  best. I can run');
  });

  it('块级标题内被包（h2/h3）→ 一律还原标题文本', () => {
    const html = '<h3><u class="blank-4">【典型例题1】词汇运用（识记层次）</u></h3>';
    const out = unwrapMalformedBlankCarriers(html);
    expect(out).toContain('<h3>【典型例题1】词汇运用（识记层次）</h3>');
    expect(out).not.toContain('blank-4');
  });

  it('真填空位（仅 &emsp; 空白）不受影响', () => {
    const html = '<p>0.7 × 0.3 ＝ <u class="blank-4">&emsp;</u>，表示求 0.7 的 <u class="blank-3">&emsp;</u> 是多少。</p>';
    expect(unwrapMalformedBlankCarriers(html)).toBe(html);
  });

  it('幂等：二次处理结果不变', () => {
    const html = '<p><u class="blank-4">We have C , English, Maths and other subjects at school.</u></p>';
    const once = unwrapMalformedBlankCarriers(html);
    expect(unwrapMalformedBlankCarriers(once)).toBe(once);
  });

  // 🔴 2026-09-18 用户实证（知识点总结例题块"内容全被加下划线 + 排版错乱"）：
  //    同标签嵌套的字符串正则只能配到内层闭合 → 拆外层后留下悬空标签 → 畸形残留、整段被画线。
  //    DOM 优先拆壳后：无任何残留标签、句子与块级结构完整。
  it('同标签嵌套 + 长句被包（用户实证形态）→ 仅拆误包载体、无悬空标签', () => {
    const html = '<p>One day, it <u class="blank-3">&emsp;</u><u class="blank-3"> (see) a bird at the top of the tree. The snail (want) to climb the tree, but it (be) very slow.</u></p>';
    const out = unwrapMalformedBlankCarriers(html);
    expect(out).toMatch(/<u class="blank-3">(?:&emsp;|&#8195;|&#x2003;|[\s\u2003])*<\/u>/); // 真空白空位保留（载体本义）
    expect((out.match(/<u\b/g) || []).length).toBe(1);          // 只剩那枚真空位：误包载体已拆
    expect((out.match(/<\/u>/g) || []).length).toBe(1);         // 无悬空闭标签
    expect(out).toContain('(see) a bird at the top of the tree.'); // 长句完整保留
    expect(out).toContain('(be) very slow.');
  });

  it('载体包住块级内容（例题的答案/解析整块被包）→ 拆壳后块级结构归位', () => {
    const html = '<p><strong>例 1</strong>　用括号内动词的适当形式填空。</p>'
      + '<p>Long ago, there <u class="blank-3"> (be) a snail in a garden.</u></p>'
      + '<u class="blank-3">\n<p><strong>答案：</strong>was</p>\n<p><strong>解析：</strong>用一般过去时。</p>\n</u>';
    const out = unwrapMalformedBlankCarriers(html);
    expect(out).not.toContain('blank-3');
    expect(out).toContain('<p><strong>答案：</strong>was</p>');  // 块级仍在块级
    expect(out).toContain('<p><strong>解析：</strong>用一般过去时。</p>');
    expect((out.match(/<\/?u\b/g) || []).length).toBe(0);
  });

  it('用户实证整块（例1~例5 形态）→ 误包全拆、画线题标记保留', () => {
    const html = [
      '<h2>四、例题示范</h2>',
      '<p><strong>例 1</strong>　用括号内动词的适当形式填空。</p>',
      '<p>Long ago, there <strong> </strong> (be) a snail in a garden. It <u class="blank-3"> (see) a bird at the top of the tree.</u></p>',
      '<u class="blank-3">',
      '<p><strong>答案：</strong>was；saw</p>',
      '<p><strong>解析：</strong>用一般过去时。</p>',
      '</u>',
      '<p><strong>例 5</strong>　朗读并比较下列单词中画线部分的发音。</p>',
      '<p>A. k<u class="underline-sentence">ee</u>p　D. br<u class="underline-sentence">ea</u>d</p>',
      '<p><strong>答案：</strong>D</p>',
    ].join('\n');
    const out = unwrapMalformedBlankCarriers(html);
    expect(out).not.toContain('class="blank-3"');                   // 误包载体全拆（不再有横线外壳）
    expect(out).toContain('<p><strong>答案：</strong>was；saw</p>'); // 块级仍在块级（排版不再错乱）
    expect(out).toContain('<p><strong>解析：</strong>用一般过去时。</p>');
    expect(out).toContain('<u class="underline-sentence">ee</u>');   // 画线题标记（合法语义）保留
    expect((out.match(/<\/?u\b/g) || []).length).toBe(4);           // 仅剩两处画线标记（开+闭）
  });

  // 🔴 2026-09-18 用户追问"其他原来正常的有没有被碰到/破坏" → 影响面守卫（真卷形态）：
  //    ① 无畸形载体时**逐字节不变**（原字符串路径，DOM 分支只在"确有误包"时接管）；
  //    ② 有畸形载体时只拆误包，其余正常载体逐个存活。
  it('无畸形载体时逐字节不变（题类实证卷：横线/括号空位/作文格/表格一字不动）', () => {
    const html = '<h3>九、阅读理解</h3>'
      + '<p class="question">9. 阅读短文，判断下列句子。<span class="blank-2">&emsp;</span></p>'
      + '<p class="question">(1) The snail was fast. <u class="blank-3">&emsp;</u></p>'
      + '<p><span class="blank-line">&emsp;</span></p>'
      + '<p>（　）41. did / what / you / do</p>'
      + '<div class="zuo-wen-ge"></div>'
      + '<table><tr><td>部首</td><td></td></tr></table>';
    expect(unwrapMalformedBlankCarriers(html)).toBe(html);
  });

  it('含畸形载体时，其余正常载体逐个存活（只拆误包、不误伤）', () => {
    const html = '<p>It <u class="blank-3"> (see) a bird at the top of the tree.</u></p>'
      + '<p>答案：<u class="blank-3">&emsp;</u> 与 <span class="blank-2">&emsp;</span></p>'
      + '<p><span class="blank-line">&emsp;</span></p>'
      + '<p>（　）41. did / what</p>'
      + '<div class="zuo-wen-ge"></div>';
    const out = unwrapMalformedBlankCarriers(html);
    expect(out).not.toContain('at the top of the tree.</u>');            // 误包外壳已去
    expect(out).toContain('(see) a bird at the top of the tree.');        // 内容一字不动
    expect(out).toMatch(/<u class="blank-3">(?:&emsp;|&#8195;|&#x2003;|[\s\u2003])*<\/u>/);          // 真填空横线仍在
    expect(out).toMatch(/<span class="blank-2">(?:&emsp;|&#8195;|&#x2003;|[\s\u2003])*<\/span>/);    // 括号空位仍在
    expect(out).toMatch(/<span class="blank-line">(?:&emsp;|&#8195;|&#x2003;|[\s\u2003])*<\/span>/); // 整行横线仍在
    expect(out).toContain('（　）41.');                                    // 题面括号空位仍在
    expect(out).toContain('class="zuo-wen-ge"');                          // 作文格仍在
  });

  // 🔴 2026-09-18 用户裁决："应该只动含畸形的那一块" → 局部性守卫：
  //    含畸形载体的文档里，其它部分**逐字节不变**（含实体写法，如 &nbsp;/&emsp; 不被重排）。
  it('局部性：只动误包那一处，其余部分逐字节不变（不整篇重排）', () => {
    const other = '<h2>一、知识梳理</h2>'
      + '<p>核心结构：<strong>be going to</strong> 与 <u class="blank-3">&emsp;</u> 并存。</p>'
      + '<table><tr><td>a</td><td>&nbsp;</td></tr></table>';
    const bad = '<p>It <u class="blank-3"> (see) a bird at the top of the tree.</u></p>';
    const out = unwrapMalformedBlankCarriers(other + bad);
    expect(out.startsWith(other)).toBe(true);                      // 前文（含 &nbsp;/&emsp; 原文写法）一字未动
    expect(out).not.toContain('at the top of the tree.</u>');       // 误包外壳已去
    expect(out).toContain('(see) a bird at the top of the tree.');  // 内容一字不动
  });

  it('整链（normalizeBlankMarkers）在含畸形载体的文档上：误包拆掉、其余载体不被连带破坏', () => {
    const html = '<h2>四、例题示范</h2>'
      + '<p>It <u class="blank-3"> (see) a bird at the top of the tree.</u></p>'
      + '<p>答案：<u class="blank-3">&emsp;</u> 与 <span class="blank-2">&emsp;</span></p>'
      + '<p><span class="blank-line">&emsp;</span></p>'
      + '<p>（　）41. did / what</p>';
    const out = normalizeBlankMarkers(html);
    expect(out).not.toContain('at the top of the tree.</u>');   // 误包外壳已去
    expect(out).toContain('(see) a bird at the top of the tree.'); // 内容一字不动
    expect(/blank-3/.test(out)).toBe(true);                     // 真填空横线存活
    expect(/blank-line/.test(out)).toBe(true);                  // 整行横线存活
    expect(out).toContain('41.');                               // 题面空位/题号未被吞
  });
});

describe('英文省略号三点归一', () => {
  it('无汉字语境六点 → 三点（英文句子）', () => {
    expect(normalizeEnglishEllipsis('I like English best…… It is interesting.'))
      .toBe('I like English best… It is interesting.');
  });

  it('中文说明里的六点省略号保持不动', () => {
    const zh = '他在本单元学会了多门科目……还了解了英式与美式的区别。';
    expect(normalizeEnglishEllipsis(zh)).toBe(zh);
  });

  it('无省略号内容原样返回', () => {
    expect(normalizeEnglishEllipsis('plain text')).toBe('plain text');
  });
});
