// 🔴 2026-09-28（用户裁定·补单源守卫）：下列四项"同一件事只在一处规定"，其余位置零出现——
//    ① 卷首导语（↔大题标题同进同退）② 严肃卷面 ③ 统一情境（采用/未采用开关）
//    ④ 大题标题命名（学段口径 + 与卷首导语的关系）。
//    唯一规定的落点 = src/config/promptLibrary.js（正式卷卷面格式单源）。
//    守卫按**规则字面**断言：这些字面只允许出现在该单源文件；任何"再写一份"即红。
//    历史实证（防回潮）：promptLibrary 内曾"卷首导语条"与"大题标题命名条"并行规定同一件事
//    （中学段选统一情境时"各大题标题同属该情境" vs "中学段大题标题=【卷面结构】块名/领域名"）→ 打架。
// 🔴 2026-09-28（用户裁定·扩大扫描面 + 纳入统一情境开关真源）：
//    ⑤ 扫描面**扩到 docs/design**（含本轮涉及的文档口径）——文档不得把单源规则"再写一份"，
//       旧并行/冲突表述在 src 与 docs 里都须零出现。
//       （历史审计报告=只读记录，允许引用原文字面，不在"规则所有者"校验内。）
//    ⑥ 统一情境开关的**真源** = src/utils/instructionStyle.js 的 parseStyleFromInstruction——
//       守卫引用该校验"开关值集合"与配置同源，杜绝开关在别处另写一份。
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseStyleFromInstruction } from '../../src/utils/instructionStyle.js';
import { styleOptions } from '../../src/config/expertKnowledge.js';

const ROOT = path.resolve(__dirname, '../..');
const OWNER = 'src/config/promptLibrary.js';
const STYLE_SWITCH_OWNER = 'src/utils/instructionStyle.js';

const SRC_FILES = [];
const walk = (dir) => {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (/\.(js|vue|ts)$/.test(name)) SRC_FILES.push(p);
  }
};
walk(path.join(ROOT, 'src'));

// docs/design 全量文档（.md/.html；含本轮涉及的文档口径）；历史审计报告（文件名含"只读"）= 只读记录，不作为规则所有者
const DOC_FILES = [];
const walkDocs = (dir) => {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walkDocs(p);
    else if (/\.(md|html?)$/i.test(name)) DOC_FILES.push(p);
  }
};
walkDocs(path.join(ROOT, 'docs/design'));
const isHistoricalReport = (f) => /只读/.test(path.basename(f));

const rel = (f) => path.relative(ROOT, f).replace(/\\/g, '/');
/** src + docs/design（历史只读报告除外）里包含该字面的文件——用于"规则所有者"校验 */
const ownersOf = (phrase) => SRC_FILES.concat(DOC_FILES.filter((f) => !isHistoricalReport(f)))
  .filter((f) => fs.readFileSync(f, 'utf8').includes(phrase))
  .map(rel);
/** src + docs/design **全量**里包含该字面的文件——用于"旧口径零出现"校验 */
const hitsAnywhere = (phrase) => SRC_FILES.concat(DOC_FILES)
  .filter((f) => fs.readFileSync(f, 'utf8').includes(phrase))
  .map(rel);

describe('单源守卫：卷首导语 / 严肃卷面 / 统一情境 / 大题标题命名 只在一处规定（扫描面含 docs/design）', () => {
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

  it('已删除的并行/冲突表述：全库（src + docs/design）零出现（防回潮）', () => {
    for (const gone of ['各大题标题同属这一情境', '各题在单元情境下展开']) {
      expect(hitsAnywhere(gone), `旧并行表述不得回潮：${gone}`).toEqual([]);
    }
  });

  // 🔴 2026-09-28（用户裁定·统一情境开关真源纳入引用校验）：
  //    "统一情境"是否触发，唯一真源 = instructionStyle.parseStyleFromInstruction 的开关；
  //    本守卫引用该校验：开关认作"统一情境类"的值必须在配置（expertKnowledge.styleOptions）中真实存在，
  //    且被开关如实判为统一情境——杜绝开关值在别处另写一份/写脏值。
  it('⑥ 统一情境开关真源 = instructionStyle.parseStyleFromInstruction（引用校验：开关值须在配置中真实存在）', () => {
    const src = fs.readFileSync(path.join(ROOT, STYLE_SWITCH_OWNER), 'utf8');
    expect(src, '统一情境开关须在 instructionStyle 判定').toContain("value === 'unified_context' || value === 'unit_context'");
    const configured = new Set(styleOptions.map((o) => o.value));
    for (const v of ['unified_context', 'unit_context']) {
      expect(configured.has(v), `开关值 ${v} 须在 styleOptions 中定义`).toBe(true);
      expect(parseStyleFromInstruction(`【组织风格】${v}：示例`).isUnifiedContext, `${v} 须被判为统一情境`).toBe(true);
    }
    // 非统一情境类不得被误判
    expect(parseStyleFromInstruction('【组织风格】mindmap：示例').isUnifiedContext).toBe(false);
  });
});
