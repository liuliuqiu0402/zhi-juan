/**
 * 书写载体·预览/导出契约守卫（防"插了不显示 / 只预览能看、导出丢"）
 *
 * 背景：手动插入的载体只按 HTML class 落到编辑器里，**导出端必须有自己的分支**才画得出来。
 *   2026-09-29 已完成导出侧逐类取证（docxBuilder），本文件把"目录里的每一类都有导出分支"
 *   变成机械断言——以后谁加了一类载体却忘了接导出，这里立刻转红。
 *
 * 断言口径：
 *   · 只做**源码级存在性**断言（不改导出实现、不写死尺寸）；
 *   · blank-N（档位）导出端按正则族处理（不是固定 class），故单独断言其正则形态存在。
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { CARRIER_INSERT_IDS } from '../../src/utils/carrierInsert';

const src = fs.readFileSync(path.resolve(process.cwd(), 'src/utils/docxBuilder.js'), 'utf8');

describe('预览/导出契约：按钮目录的每一类载体，导出端都须有对应分支', () => {
  it('除空位档位外，每类载体在 docxBuilder 里都有 class 分支', () => {
    const ids = CARRIER_INSERT_IDS.filter((id) => id !== 'blank');
    for (const id of ids) {
      expect(src, `导出端缺 ${id} 的处理分支（会"预览有、导出丢"）`).toContain(`contains('${id}')`);
    }
  });

  it('空位档位 blank-N 在导出端按正则族处理（非固定 class）', () => {
    expect(src, '导出端缺 blank-N 档位处理').toMatch(/blank-\\d/);
  });

  it('英文书写走 four-line-three/sixian-ge（english-line 不画格线）', () => {
    expect(CARRIER_INSERT_IDS, '插入目录不得含 english-line').not.toContain('english-line');
  });
});
