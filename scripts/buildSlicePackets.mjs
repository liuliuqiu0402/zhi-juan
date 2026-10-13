#!/usr/bin/env node
/**
 * 单片"自包含输入胶囊"生成器
 *
 * 为什么需要：送审会话若**开在空白目录**（工作区为空），就读不到 `D:\wisdom-workshop\docs\audit\...`，
 *   于是报"输入不存在"。给每个片做一个**单文件**（＝判据件全文 ＋ 该片 9 份快照全文），
 *   用户只需把这**一个文件**放进该会话能看到的目录（或直接上传），会话即可开跑——**不再依赖项目工作区**。
 *
 * 输出：`docs/audit/语义深读输入/<学科>-<学段>.md`（可再生 ⇒ 不入库，见 .gitignore）
 * 用法：node scripts/buildSlicePackets.mjs [学科] [学段]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STAGE_SUBJECTS } from '../src/config/promptLibrary.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SNAP = path.join(ROOT, 'docs/audit/snapshot-all');
const RUBRIC = path.join(ROOT, 'docs/audit/S4-独立复核-送审件-486面-语义深读-分片.md');
const OUTDIR = path.join(ROOT, 'docs/audit/语义深读输入');
const GEN_TYPES = ['exam', 'practice', 'special', 'preview', 'reading', 'summary', 'dictation', 'errorbook', 'review'];

const [onlySubject, onlyStage] = process.argv.slice(2).filter((a) => !a.startsWith('-'));

const rubric = fs.readFileSync(RUBRIC, 'utf8');
fs.mkdirSync(OUTDIR, { recursive: true });

let n = 0;
const missing = [];
for (const [stage, subjects] of Object.entries(STAGE_SUBJECTS)) {
  if (onlyStage && stage !== onlyStage) continue;
  for (const subject of subjects) {
    if (onlySubject && subject !== onlySubject) continue;
    const files = GEN_TYPES.map((t) => path.join(SNAP, `${t}-${subject}-${stage}.txt`));
    const absent = files.filter((f) => !fs.existsSync(f));
    if (absent.length) { missing.push(`${subject}|${stage}：缺 ${absent.length} 份`); continue; }

    const head = `# 语义深读·自包含输入胶囊｜${subject} × ${stage}

> 本文件＝**单片自包含输入**（判据件全文 ＋ 该片 9 份注入快照全文）。
> **不需要访问项目工作区**：只读本文件即可完成本片判定。
> 片键：\`${subject}|${stage}\`　口令：开始
> 判定层级＝**纸面推演**；**只判本片 9 份**，不得跨片推断；不得以"未读完"冒充"已读"。
> 禁读：除本文件外，不读任何其它文件（判据已在本文件内）。
> 产出：把结论写成一份 md，首行写 \`# 语义深读·${subject} × ${stage}｜片自证：实际读到 9 份\` 并列出下面 9 个文件名；
>   内容顺序严格按下方判据件 §四 模板（一 片自证 → 二 逐份判定 → 二·乙 必备要素判定表 → 三 跨类型观察 → 四 缺口清单 → 五 附录 → 六 片结论）；
>   每条判定须带**逐字原文**。若你的环境能写盘，存到 \`D:\\wisdom-workshop\\docs\\audit\\语义深读产出\\${subject}\\${subject}-${stage}.md\`，不能写盘就把全文直接输出。

---

## 甲、判据件全文（§三 判据／§三·乙 必备要素表／§四 输出模板／§五 汇总口径／§六 样本局限／§七 落盘约定）

${rubric}

---

## 乙、本片 9 份注入快照（逐份全文；每份前有分隔行）

`;

    const body = files.map((f) => {
      const name = path.basename(f);
      return `===== 文件：${name} =====\n\n\`\`\`\n${fs.readFileSync(f, 'utf8').replace(/\n+$/, '')}\n\`\`\`\n`;
    }).join('\n');

    const out = path.join(OUTDIR, `${subject}-${stage}.md`);
    fs.writeFileSync(out, head + body, 'utf8');
    n += 1;
  }
}

console.log(`胶囊生成：${n} 个 ⇒ docs/audit/语义深读输入/`);
if (missing.length) console.error(`跳过 ${missing.length}：\n  · ${missing.join('\n  · ')}`);
