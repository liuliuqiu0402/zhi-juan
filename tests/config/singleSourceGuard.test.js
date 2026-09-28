// 🔴 2026-09-28（用户裁定·补单源守卫）：下列四项"同一件事只在一处规定"，其余位置零出现——
//    ① 卷首导语（↔大题标题同进同退）② 严肃卷面 ③ 统一情境（采用/未采用开关）
//    ④ 大题标题命名（学段口径 + 与卷首导语的关系）。
//    唯一规定的落点 = src/config/promptLibrary.js（正式卷卷面格式单源）。
//    守卫按**规则字面**断言：这些字面只允许出现在该单源文件；任何"再写一份"即红。
//    历史实证（防回潮）：promptLibrary 内曾"卷首导语条"与"大题标题命名条"并行规定同一件事
//    （中学段选统一情境时"各大题标题同属该情境" vs "中学段大题标题=【卷面结构】块名/领域名"）→ 打架。
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
const OWNER = 'src/config/promptLibrary.js';

const SRC_FILES = [];
const walk = (dir) => {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (/\.(js|vue|ts)$/.test(name)) SRC_FILES.push(p);
  }
};
walk(path.join(ROOT, 'src'));

/** src 下包含该字面的文件（相对路径，正斜杠） */
const ownersOf = (phrase) => SRC_FILES
  .filter((f) => fs.readFileSync(f, 'utf8').includes(phrase))
  .map((f) => path.relative(ROOT, f).replace(/\\/g, '/'));

describe('单源守卫：卷首导语 / 严肃卷面 / 统一情境 / 大题标题命名 只在一处规定', () => {
  it('① 卷首导语：规则字面只允许出现在 promptLibrary.js', () => {
    expect(ownersOf('卷首导语')).toEqual([OWNER]);
  });

  it('② 严肃卷面：规则字面只允许出现在 promptLibrary.js', () => {
    expect(ownersOf('严肃卷面')).toEqual([OWNER]);
  });

  it('③ 统一情境：采用/未采用开关字面只允许出现在 promptLibrary.js', () => {
    expect(ownersOf('采用统一情境时')).toEqual([OWNER]);
    expect(ownersOf('未采用统一情境时')).toEqual([OWNER]);
  });

  it('④ 大题标题命名：规则字面（学段口径）只允许出现在 promptLibrary.js', () => {
    expect(ownersOf('大题标题即【卷面结构】里的块名本身')).toEqual([OWNER]);
    expect(ownersOf('大题标题须你按本卷实际的作答方式自拟')).toEqual([OWNER]);
  });

  it('已删除的并行/冲突表述：全库零出现（防回潮）', () => {
    for (const gone of ['各大题标题同属这一情境', '各题在单元情境下展开']) {
      expect(ownersOf(gone), `旧并行表述不得回潮：${gone}`).toEqual([]);
    }
  });
});
