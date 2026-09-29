// 🔴 2026-09-29（A6/A7 **单一实现守卫**）：判据正则**只许一份**——扫源码断言字面量在全模块只出现 1 次。
//   防"口径改了、某处副本没改"→ 两套判据并存（本仓库历史踩坑：题号"行首 N."判据曾有 10 份内联副本、
//   作答载体探针曾有 7 份近似副本；收敛于 `src/utils/examValidator.js` 顶部的 QNUM_LINE_RE /
//   CARRIER_ANY_RE / CARRIER_GRID_RE / CARRIER_STRUCT_RE）。
//   本组守卫与 `tests/config/fixChecklistGuards.test.js` 同为**机械拦截**（转红=违反既定标准）。
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd(); // 与 tests/config/bodyContinuationWiring.test.js 同法（vitest 从仓库根运行）
const SRC = fs.readFileSync(path.join(ROOT, 'src', 'utils', 'examValidator.js'), 'utf8');
const occurrences = (needle) => SRC.split(needle).length - 1;

describe('单一实现守卫：判据正则只许一份（防两套判据漂移）', () => {
  it('题号"行首 N."判据 → 全模块只此一份（QNUM_LINE_RE）', () => {
    expect(occurrences(String.raw`/^\s*\d+[.、．]/`)).toBe(1);
  });

  it('通用载体探针（含 blank 系）→ 只此一份（CARRIER_ANY_RE）', () => {
    expect(occurrences(String.raw`/zuo-wen-ge|blank-line|blank-\d|tian-zi-ge|four-line-three|sixian-ge|pinyin-line|mi-zi-ge|square-grid/`)).toBe(1);
  });

  it('书写格类载体探针（不含 blank 系）→ 只此一份（CARRIER_GRID_RE）', () => {
    expect(occurrences(String.raw`/zuo-wen-ge|tian-zi-ge|pinyin-line|mi-zi-ge|four-line-three|sixian-ge|square-grid/`)).toBe(1);
  });

  it('结构性作答载体探针 → 只此一份（CARRIER_STRUCT_RE）', () => {
    expect(occurrences(String.raw`/match-question|match-item|zuo-wen-ge|square-grid|bracket-grid|tian-zi-ge|four-line-three|sixian-ge|pinyin-line|mi-zi-ge/`)).toBe(1);
  });

  it('常量确实存在（防"守卫通过 = 常量被删、字面量随之全没"的假绿）', () => {
    for (const name of ['QNUM_LINE_RE', 'CARRIER_ANY_RE', 'CARRIER_GRID_RE', 'CARRIER_STRUCT_RE']) {
      expect(SRC, `${name} 应在 examValidator.js 中定义`).toContain(`const ${name} = `);
    }
  });
});
