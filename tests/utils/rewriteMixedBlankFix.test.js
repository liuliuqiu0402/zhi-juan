/**
 * 复现收口专项：0.7×0.3＝(分数)×(分数)，表示求…是多少 —— 同句 横线/方框 混用 与 题头后池化空行
 * ============================================================
 * 根因（2026-09 复现）：
 *   A. "改写/含义"类"写算式答案"段，× 邻接空位被口算方框规则(uCellRe)回卷成 <span square-box>，
 *      与等号后结果位横线(u.blank)同句混用 → 需在 normalizeMathCircleBlanks 的改写段判定中保持书写横线；
 *   B. ~~同段书写空位形态统一(unifySameParagraphWriteBlanks)~~：**2026-10-09（属主实测·载体相抵根治·续〔296〕
 *      乙案）整条撤除**——它与 cell 判据"同一题内各空按各自实际所填**分别定形、可并存**"**相抵**：横线空
 *      （写字）与括号空（选符号）性质不同、本就该并存，程序却按"段"统一 ⇒ 实测"该横线的空位整段变括号"。
 *      **程序不再改载体形态**（形态由模型按所填内容定）。相应 4 例"按多数形态统一"的旧断言**随之解掉**。
 *   C. answer-area-fix 审计后置补入的"题头后池化整行空白"，须在审计输出后二次剥离
 *      （stripRedundantInlineCarrierRows：下一非空兄弟已含行内作答载体 → 冗余）。
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { normalizeBlankMarkers, normalizeMathCircleBlanks, stripRedundantInlineCarrierRows, cleanSectionHtml } from '../../src/utils/contentCleaner.js';

const ROOT = path.resolve(__dirname, '../..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const fullNormalize = (html) => normalizeMathCircleBlanks(normalizeBlankMarkers(html));

describe('同句 横线/方框 混用根治（0.7×0.3＝＿×＿，表示求…是多少）', () => {
  it('🔴 改写/含义段：× 邻接的方框空**不再被"多数形态统一"改写**（各空按所填分别定形、可并存）', () => {
    // 原断言"全句统一为书写横线（方框消失）"实为 `unifySameParagraphWriteBlanks` 的**段内多数统一**所作——
    // 该机制 2026-10-09 因与 cell"各空按所填分别定形、可并存"相抵而**整条撤除**（续〔296〕乙案）。
    // 现按判据改锁：**形态不被改写**（方框保留；`×` 邻接空与结果位横线可并存）。
    const html =
      '<p class="question">（2）0.7 × 0.3 ＝ <u class="blank-1">&emsp;</u> × <span class="square-box">&nbsp;</span>，表示求 0.7 的 <u class="blank-3">&emsp;</u> 是多少。</p>';
    const out = fullNormalize(html);
    expect(out, '方框空不得被"多数统一"改写').toContain('square-box');
    expect((out.match(/<u class="blank-\d+">&emsp;<\/u>/g) || []).length).toBe(2);
  });

  it('直接写得数（多独立算式同行，1÷11＝＿ 2÷11＝＿…）：＝ 后结果位只留空白书写区，不画线不框', () => {
    // 用户定稿（印刷排版惯例）：直接写得数"＝ 后"留空白书写区、不加横线、不留框（宽度按答案位数保留）
    const html =
      '<p>1 ÷ 11 ＝ <u class="blank-4">&emsp;</u>　2 ÷ 11 ＝ <u class="blank-4">&emsp;</u>　3 ÷ 11 ＝ <u class="blank-4">&emsp;</u></p>';
    const out = fullNormalize(html);
    expect(out).not.toMatch(/<u class="blank-\d+">/);
    expect(out).not.toContain('square-box');
    expect((out.match(/&emsp;&emsp;&emsp;&emsp;/g) || []).length).toBe(3);
  });

  it('改写/含义段结果位保持书写横线（0.7×0.3＝(分数)×(分数)…是多少 不受留白规则影响）', () => {
    const html =
      '<p>0.7×0.3 ＝ <u class="blank-1">&emsp;</u> × <u class="blank-2">&emsp;</u>，表示求 0.7 的 <u class="blank-3">&emsp;</u> 是多少。</p>';
    const out = fullNormalize(html);
    expect(out).not.toContain('square-box');
    expect((out.match(/<u class="blank-\d+">&emsp;<\/u>/g) || []).length).toBe(3);
  });

  // 🔴 2026-10-09（载体相抵根治·续〔296〕乙案）：原 4 例锁"同段按多数形态统一"的**改写**行为
  //    （"统一函数本身：混用段按多数形态归一"／"不跨段混并"／"不碰 ○"／"结果位不参与统一"）——
  //    该改写与 cell 判据"各空按所填分别定形、可并存"相抵 ⇒ **函数已整条删除**，故**解掉这 4 例**，
  //    改锁"**链内不再统一形态**"与"**函数确已删除**"。
  it('🔴 同段"横线+括号"混用 → 链内**不再按多数形态统一**（横线保持横线）', () => {
    const html = '<p>1. 看拼音写词语：<u class="blank-2">&emsp;</u>（　）<span class="blank-1">&emsp;</span><span class="blank-1">&emsp;</span></p>';
    const out = cleanSectionHtml(html);
    expect(out, '横线（写字空）不得被改成括号').toMatch(/<u\b[^>]*\bblank-2\b/);
  });

  it('🔴 函数已删、链内不再调用（程序不再改载体形态）', () => {
    const src = read('src/utils/contentCleaner.js');
    expect(src, '收口函数应已删除').not.toContain('export function unifySameParagraphWriteBlanks');
    expect(src, '链内不得再调用').not.toContain('unifySameParagraphWriteBlanks(out)');
  });
});

describe('题头后池化整行空白（审计后置补差）', () => {
  it('纯空白整行后随"已含行内作答载体"的小题行 → 冗余剥离', () => {
    const html =
      '<p class="question">3. 把下面的小数改写成分数，再写出乘法算式的含义。</p>' +
      '<p class="blank-area" style="height: 8mm;">&emsp;</p>' +
      '<p class="blank-area" style="height: 8mm;">&emsp;</p>' +
      '<p class="question">0.7 × 0.3 ＝ <u class="blank-1">&emsp;</u> × <span class="square-box">&nbsp;</span>，表示求 0.7 的 <u class="blank-3">&emsp;</u> 是多少。</p>';
    const out = stripRedundantInlineCarrierRows(html);
    expect((out.match(/<p class="blank-area"/g) || []).length).toBe(0);
    expect(out).toContain('把下面的小数改写成分数');
    expect(out).toContain('0.7 × 0.3');
  });

  it('确属长答书写空间（后随无行内载体的空作答段/无后续小题）→ 保全不误删', () => {
    const html =
      '<p class="question">5. 解方程：3x＋6＝15</p>' +
      '<p class="blank-area" style="height: 8mm;">&emsp;</p>' +
      '<p class="blank-area" style="height: 8mm;">&emsp;</p>';
    const out = stripRedundantInlineCarrierRows(html);
    expect((out.match(/<p class="blank-area"/g) || []).length).toBe(2);
  });
});
