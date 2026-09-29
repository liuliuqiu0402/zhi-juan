/**
 * 书写载体·预览/导出契约守卫（防"插了不显示 / 只预览能看、导出丢"）
 *
 * 背景：手动插入的载体只按 HTML class 落到编辑器，**导出端必须有自己的分支**才画得出来。
 *   本文件把"按钮目录里的每一类，导出端都有对应处理"变成机械断言——
 *   以后谁加了一类载体却忘了接导出，这里立刻转红。
 *
 * 断言口径：只做**源码级存在性**断言（不改导出实现、不写死尺寸）。
 *   · 某些 id 与导出端标识不同名（空位档位按正则族、数学圈带后缀），故用**显式映射**，
 *     不做"id 同名"的想当然匹配。
 *   · 标注「提及级」的项：导出侧目前只有注释/常量级提及，待导出侧取证细化后应收紧为分支级。
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { CARRIER_INSERT_IDS } from '../../src/utils/carrierInsert';

const src = fs.readFileSync(path.resolve(process.cwd(), 'src/utils/docxBuilder.js'), 'utf8');

/** id → 导出端应有标识（正则；['…'] 为精确证明，其余为同类证据） */
const EXPORT_BRANCH = {
  'blank-line': /contains\('blank-line'\)/,
  'blank-area': /blank-area/,                 // 提及级：分支键名待导出侧取证细化
  'blank-underline': /blank-\\d/,             // 档位族（非固定 class）
  'blank-paren': /blank-\\d/,                 // 同上（括号由 carrierCss ::before/::after 生成）
  'tian-zi-ge': /contains\('tian-zi-ge'\)/,
  'mi-zi-ge': /contains\('mi-zi-ge'\)/,
  'four-line-three': /contains\('four-line-three'\)/,
  'sixian-ge': /contains\('sixian-ge'\)/,
  'pinyin-line': /contains\('pinyin-line'\)/,
  'square-box': /square-box/,                 // 提及级：走 DrawingML 方框（SQUARE_BOX_MARKER）
  'math-circle-blank': /math-circle-blank-18/,
  'oral-box': /contains\('oral-box'\)/,       // 2026-09-30 取证：docxBuilder 有独立分支
  'bracket-grid': /contains\('bracket-grid'\)/,
  'square-grid': /contains\('square-grid'\)/,
  'draw-area': /contains\('draw-area'\)/,
};

describe('预览/导出契约：按钮目录的每一类载体，导出端都须有对应处理', () => {
  it('目录与映射表一一对应（防新增载体漏登记导出分支）', () => {
    const unmapped = CARRIER_INSERT_IDS.filter((id) => !EXPORT_BRANCH[id]);
    expect(unmapped, `以下载体未登记导出端标识：${unmapped.join('、')}`).toEqual([]);
  });

  it('每一类载体都能在 docxBuilder 找到对应处理', () => {
    for (const id of CARRIER_INSERT_IDS) {
      const re = EXPORT_BRANCH[id];
      expect(re.test(src), `${id} 导出端缺处理分支（会"预览有、导出丢"）`).toBe(true);
    }
  });

  it('英文书写走 four-line-three/sixian-ge（english-line 不画格线，不得进目录）', () => {
    expect(CARRIER_INSERT_IDS).not.toContain('english-line');
  });
});
