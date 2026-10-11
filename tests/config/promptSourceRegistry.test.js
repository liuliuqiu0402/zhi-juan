// 🔒 给模型文本·源登记守卫（2026-10-01 用户裁定："对账不清，范围就不清"）
// ============================================================
// 治什么（两个真缺口，均为 2026-10-01 实测发现）：
//   ① E 表（PROMPT_SOURCES）只扫 `build*` 导出 → **常量形态的给模型文本**（DECLARATION_TRUTH_CLAUSE 等）长期"无主"；
//   ② 调用层 inline 文案（useAiGenerator 答案页拼装）既非导出函数也非导出常量 → 同样无主。
// 本守卫把"登记"变成**闭环**：
//   1) 登记的常量/函数必须真实存在（防登记了不存在的东西 = 假登记）；
//   2) **重跑测量**：读各模块导出值的真实字符串，与实发文本比对，占比 ≥ 0.5 者必须已在 PROMPT_CONSTANTS 中 → **漏登记即红**；
//   3) 跳转不变式（用户明令"跳转修改功能不能破坏"）：程序附加段每一段都必须能映射到 (lib, key)，否则必须显式标为无库。
import { describe, it, expect } from 'vitest';
import {
  PROMPT_SOURCES, PROMPT_CONSTANTS, PROMPT_PARTIAL_CONTAINERS, PROMPT_INLINE_SOURCES,
} from '../../src/config/caliberRegistry.js';
import {
  getPromptTemplate, ANSWER_ROLES, buildAnswerFormatSpec,
} from '../../src/config/promptLibrary.js';
import { buildTeachingInjection } from '../../src/config/teachingBlueprints.js';
import { buildUserMessagePrompt, buildCallLayerBlocks, buildDiffRegenBlock, buildMultiTypeDiffBlock } from '../../src/utils/injectionManifest.js';
import { buildProgramAttach, buildProgramAttachBlocks } from '../../src/utils/programAttach.js';
import { GEN_TYPE_KEYS } from '../../src/config/toolLibrary.js'; // 🔴 S1：SUBJECT_KEYS/STAGE_KEYS 已由 REAL_CELLS 取代（原按字典全量 675 属虚测）
import { STAGE_SUBJECTS } from '../../src/config/promptLibrary.js'; // 🔴 S1 口径改准：实际开设组合唯一事实源
import { styleOptions, buildStyleAppend } from '../../src/config/expertKnowledge.js'; // 🔴 S1：并入"生成期追加"通道（组织风格）

// 🔴 2026-10-11（S1·**实发口径补全**·属主"验收对象＝注入后最终 prompt"）：覆盖测量的"实发"原先只拼了
//   注入框（buildUserMessagePrompt）＋程序附加段（buildProgramAttach）＋教学注入＋调用层块，
//   **漏了"生成期追加类"（组织风格 `【组织风格】`）**——它由 `GenerateModule.vue withStyle()` 追加到指令末尾。
//   后果：`styleInstructions` 被覆盖测量判为 **0/11 死角源**，且"注入后最终 prompt"有一处文本不受管辖。
//   现按**渲染唯一事实源** `buildStyleAppend` 把该通道并入（逐 cell 按该类型适用的风格枚举）；Vue 侧同读此函数。
const stylesForType = (genType) => styleOptions
  .filter((o) => !o.appliesTo.length || o.appliesTo.includes(genType))
  .map((o) => o.value)
  .filter((v) => buildStyleAppend(v));

// 🔴 2026-10-11（S1·**口径改准**·属主明示"实际是 486"）：覆盖测量原先按 9×15×5 = **675** 迭代——含 **21 个不存在的
//   "学科×学段"对**（如"物理|小学低段"）。那些组合在真实请求里**不会发生**（入口按 `STAGE_SUBJECTS` 过滤学科候选），
//   且 `getPromptTemplate` 对其会**借用别的学段骨架**（实测告警："物理|primary_low 不在实际开设矩阵内 → 借用 物理|middle"）
//   ⇒ 测出的是**任何真实请求都不会发出的文本**（虚测）：既白算，又会把"只在借骨架路径上出现的句子"当成真源、
//   从而**掩盖真缺口**。现按**实际开设组合**迭代：54 对 × 9 类型 = **486 cell**（与本仓 `scripts/coverageDenominator.mjs`
//   实测分母同源）。**不存在的 189 个空 cell 不进分母**（按八问①门控封杀）。
const REAL_CELLS = (() => {
  const out = [];
  for (const genType of GEN_TYPE_KEYS)
    for (const [stage, subs] of Object.entries(STAGE_SUBJECTS))
      for (const subject of subs) out.push({ genType, subject, stage });
  return out;
})();
import fs from 'node:fs';
import path from 'node:path';

const norm = (s) => String(s || '').replace(/\s+/g, '').trim();
const sig = (s, n = 14) => norm(s).slice(0, n);

function flatten(v, out = [], depth = 0) {
  if (depth > 4 || v == null) return out;
  if (typeof v === 'string') { if (norm(v).length >= 8 && /[\u4e00-\u9fa5]/.test(v)) out.push(v); return out; }
  if (Array.isArray(v)) { v.forEach((x) => flatten(x, out, depth + 1)); return out; }
  if (typeof v === 'object' && !(v instanceof RegExp)) { Object.values(v).forEach((x) => flatten(x, out, depth + 1)); return out; }
  return out;
}

/** 实发文本样本（**全量 486 cell** 拼接；口径与生成端一致） */
function liveText() {
  const parts = [];
  for (const { genType, subject, stage } of REAL_CELLS) {
    const template = (getPromptTemplate({ grade: stage, subject, genType }).template) || '';
    const teaching = buildTeachingInjection({ genType, stage, subject }) || '';
    parts.push(buildUserMessagePrompt({ genType, subject, materialChannel: 'anchor', anchorListText: '@@A@@', instructionText: template }));
    parts.push(buildProgramAttach({ subject, stageKey: stage, genType, instructionText: template }));
    parts.push(teaching, buildCallLayerBlocks().map((b) => b.text).join('\n'));
    parts.push(genType === 'exam' ? ANSWER_ROLES.exam(subject) : ANSWER_ROLES.other(genType));
    parts.push(buildAnswerFormatSpec(subject));
    stylesForType(genType).forEach((s) => parts.push(buildStyleAppend(s))); // 🔴 S1：生成期追加（组织风格）
    // 🔴 S1：条件追加块（同属"生成期追加类"）——复生成差异化 / 多类型差异化（用代表入参，签名为静态句）
    parts.push(buildDiffRegenBlock({ genType, diffKps: ['（已练知识点）'] }));
    parts.push(buildMultiTypeDiffBlock({ typeName: '（类型名）', prevTypes: '（前序类型）', coveredKps: ['（已覆盖知识点）'] }));
  }
  return norm(parts.join('\n'));
}

// 🔴 R2 闭合（2026-10-01）：测量面从"19 个 config 文件"扩到**全 src**（config/utils/composables 共 122 个 .js，实测全部可导入）。
const MEASURE_FILES = (() => {
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.js$/.test(e.name)) out.push(path.relative(process.cwd(), p).replace(/\\/g, '/'));
    }
  };
  for (const d of ['src/config', 'src/utils', 'src/composables']) walk(d);
  return out;
})();
/** 允许导入失败的清单（新出现的失败即红；须带理由登记） */
const IMPORT_FAIL_ALLOW = [];

// 🔴 2026-10-08（C3 收口）：全库（src ＋ tests）**被 import 的文件**集合——
//   解析相对说明符（`./` `../`）与 Vite 别名（`@/` → `src/`），归一为仓库相对 posix 路径。
//   用途：锁"给模型文本的源登记表"不得登记**零 import 的死文件**（见下方 PROMPT_PARTIAL_CONTAINERS 用例）。
const IMPORTED_FILES = (() => {
  const set = new Set();
  const walk = (d, out = []) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p, out);
      else if (/\.(js|vue)$/.test(e.name)) out.push(p);
    }
    return out;
  };
  for (const f of [...walk('src'), ...walk('tests')]) {
    const src = fs.readFileSync(f, 'utf8');
    const re = /(?:from|import)\s+['"](\.{1,2}\/[^'"]+|@\/[^'"]+)['"]/g;
    let m;
    while ((m = re.exec(src))) {
      const spec = m[1].startsWith('@/') ? m[1].replace(/^@\//, 'src/') : m[1];
      const abs = spec.startsWith('src/') ? path.resolve(process.cwd(), spec) : path.resolve(path.dirname(f), spec);
      const rel = path.relative(process.cwd(), abs).replace(/\\/g, '/');
      [rel, `${rel}.js`, `${rel}.vue`, `${rel}/index.js`, `${rel}/index.vue`].forEach((x) => set.add(x));
    }
  }
  return set;
})();

/** 合并三张登记表（**按文件累加**，不得用对象展开——同名文件会被后者覆盖，2026-10-01 实测踩过） */
function mergeRegistries() {
  const all = {};
  for (const src of [PROMPT_SOURCES, PROMPT_CONSTANTS, PROMPT_PARTIAL_CONTAINERS]) {
    for (const [f, names] of Object.entries(src)) all[f] = [...(all[f] || []), ...names];
  }
  return all;
}

describe('给模型文本·源登记守卫（E 表 / 常量 / inline / 跳转不变式）', () => {
  it('登记的 build* 函数与常量必须真实存在于其文件（防假登记）', async () => {
    const all = mergeRegistries();
    for (const [file, names] of Object.entries(all)) {
      const mod = await import(`../../${file}`);
      for (const n of names) {
        expect(mod, `${file} 未导出 ${n}（登记了不存在的东西）`).toHaveProperty(n);
      }
    }
  });

  it('常量形态的给模型文本：实测集合 ⊆ 登记集合（漏登记即红）', async () => {
    const live = liveText();
    const registered = new Set();
    for (const [file, names] of Object.entries(mergeRegistries())) {
      names.forEach((n) => registered.add(`${file}:${n}`));
    }
    const measured = [];
    const importFailed = [];
    for (const rel of MEASURE_FILES) {
      let mod;
      try { mod = await import(`../../${rel}`); } catch (e) { importFailed.push(rel); continue; }
      for (const [name, val] of Object.entries(mod)) {
        // 排除 `default`：它是同一批内容的再导出，不构成独立源（否则会无限要求登记一个无意义的名字）
        if (name === 'default') continue;
        if (typeof val === 'function' || val instanceof RegExp) continue;
        const strs = flatten(val);
        if (!strs.length) continue;
        const hits = strs.filter((s) => live.includes(sig(s))).length;
        if (hits > 0 && hits / strs.length >= 0.5) measured.push(`${rel}:${name}`);
      }
    }
    expect(importFailed, `以下模块导入失败但未登记理由：\n${importFailed.join('\n')}`).toEqual(IMPORT_FAIL_ALLOW);
    const missing = measured.filter((k) => !registered.has(k));
    expect(missing, `以下常量有内容进实发但未登记：\n${missing.join('\n')}`).toEqual([]);
  }, 120000); // 测量面＝全 src（122 模块）＋**486** 份实发装配（S1 口径改准：原 675，含 21 个不存在对），需放宽超时（默认 5s 不够）

  // 🔴 2026-10-08（C3 挂起项**收口**·先解后锁）：本表定义为"占比 <0.5 但**仍有内容进实发**的数据表/容器"。
  //   "进实发"的**必要条件**＝有消费方（被某处 import）。历史遗留：`src/config/domainContract.js`
  //   曾被登记在此表，而其唯一消费方 `utils/domainReconciler.js` 已于 2026-09-20 砍除
  //   ⇒ 该文件**全库零 import**、内容占比恒 0，与本表定义相斥（陈旧登记）⇒ 已移出本表。
  it('PROMPT_PARTIAL_CONTAINERS 登记的文件必须有消费方（无 import ⇒ 不可能进实发）', () => {
    for (const file of Object.keys(PROMPT_PARTIAL_CONTAINERS)) {
      expect(
        IMPORTED_FILES.has(file),
        `${file} 全库零 import，不应登记在 PROMPT_PARTIAL_CONTAINERS（该表要求"仍有内容进实发"）`,
      ).toBe(true);
    }
  });

  it('调用层 inline 文案：句级登记逐字校验 + 区间内无未登记中文字面量', () => {
    for (const [file, cfg] of Object.entries(PROMPT_INLINE_SOURCES)) {
      expect(fs.existsSync(file), `${file} 不存在`).toBe(true);
      const src = fs.readFileSync(file, 'utf8');
      // ① 逐字：登记的头段必须真实存在于文件中（防"登记了但代码已改"）
      for (const item of cfg.items) {
        expect(src, `${file} 内未逐字找到 ${item.id} 的 head：${item.head}`).toContain(item.head);
      }
      // ② 区间内不得有**未登记**的长中文字面量（防悄悄新增一段无主文案）
      //    2026-10-02：支持 `regions`（同文件多区间）——把 5 段 inline（教材分析提取／整卷与分段结构分析／
      //    题卡提取／语言风格）一并纳入扫描；原 `region`（单区间）保持兼容。
      const regionList = cfg.regions || (cfg.region ? [cfg.region] : []);
      const allUnregistered = [];
      for (const [a, b] of regionList) {
        const start = src.indexOf(a); const end = src.indexOf(b);
        expect(start, `区间起点锚缺失：${a}`).toBeGreaterThan(-1);
        expect(end, `区间终点锚缺失：${b}`).toBeGreaterThan(start);
        const regionRaw = src.slice(start, end);
        // 🔴 先剥注释再扫：注释**不进模型**，把注释里的引文当"未登记文案"会误报（2026-10-01 实测踩过：
        //    `// …（"答案模块根据正文生成，就不会有污染风险"…）` 被当成了文案）
        const region = regionRaw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
        const heads = cfg.items.map((i) => i.head);
        // 说明：此处只自动扫 ' 与 " 包裹的字面量；多行反引号段（【正文】/【答案规范】/【压缩原文·答案参考】）
        //   由上面的 ① 逐字断言覆盖（其 head 已登记），故不重复扫描。
        const lits = [...region.matchAll(/'([^'\\\n]{12,})'|"([^"\\\n]{12,})"/g)]
          .map((m) => m[1] || m[2])
          .filter((s) => /[\u4e00-\u9fa5]/.test(s));
        allUnregistered.push(...lits.filter((s) => !heads.some((h) => s.includes(h) || h.includes(s))));
      }
      expect(allUnregistered, `已登记区间出现未登记的中文字面量：\n${allUnregistered.join('\n')}`).toEqual([]);
    }
  });

  it('🔴 实发（指令部分）每一句都必须有主：覆盖测量差集为空', async () => {
    const modCache = {};
    for (const file of Object.keys(PROMPT_CONSTANTS)) {
      try { modCache[file] = await import(`../../${file}`); } catch { /* 忽略加载失败，另有守卫报 */ }
    }
    const normLite = (s) => String(s || '').replace(/\s+/g, '').trim();
    const S = (s, n = 14) => normLite(s).slice(0, n);
    const cutAll = (t) => String(t || '').split(/[。；？\n·]+/).map((x) => x.trim()).filter((x) => normLite(x).length > 3);

    // ===== 源句集：E 表函数产出 ＋ E2 常量 ＋ E3 inline =====
    const srcTexts = [];
    for (const { genType, subject, stage } of REAL_CELLS) {
      const template = (getPromptTemplate({ grade: stage, subject, genType }).template) || '';
      srcTexts.push(template);
      srcTexts.push(buildTeachingInjection({ genType, stage, subject }) || '');
      srcTexts.push(buildProgramAttach({ subject, stageKey: stage, genType, instructionText: template }) || '');
      srcTexts.push(buildUserMessagePrompt({ genType, subject, materialChannel: 'anchor', anchorListText: '', instructionText: template }));
      srcTexts.push(genType === 'exam' ? ANSWER_ROLES.exam(subject) : ANSWER_ROLES.other(genType));
      srcTexts.push(buildAnswerFormatSpec(subject));
      stylesForType(genType).forEach((s) => srcTexts.push(buildStyleAppend(s))); // 🔴 S1：生成期追加（组织风格）
      srcTexts.push(buildDiffRegenBlock({ genType, diffKps: ['（已练知识点）'] }));            // 🔴 S1：生成期追加（复生成差异化）
      srcTexts.push(buildMultiTypeDiffBlock({ typeName: '（类型名）', prevTypes: '（前序类型）', coveredKps: ['（已覆盖知识点）'] })); // 🔴 S1：生成期追加（多类型差异化）
    }
    buildCallLayerBlocks().forEach((b) => srcTexts.push(b.text));
    // E2 常量（其值即源）
    for (const [file, names] of Object.entries(PROMPT_CONSTANTS)) {
      // eslint-disable-next-line
      const mod = modCache[file];
      if (!mod) continue;
      for (const n of names) srcTexts.push(JSON.stringify(mod[n]));
    }
    // E3 inline（登记的头段即源）
    for (const cfg of Object.values(PROMPT_INLINE_SOURCES)) cfg.items.forEach((i) => srcTexts.push(i.head));

    const srcSig = new Set();
    srcTexts.forEach((t) => cutAll(t).forEach((p) => srcSig.add(S(p))));

    // ===== 实发（指令部分；素材与锚点置空 = 豁免输入）=====
    const orphans = new Map();
    for (const { genType, subject, stage } of REAL_CELLS) {
      const template = (getPromptTemplate({ grade: stage, subject, genType }).template) || '';
      const live = [
        buildUserMessagePrompt({ genType, subject, materialChannel: 'anchor', anchorListText: '', instructionText: template }),
        buildProgramAttach({ subject, stageKey: stage, genType, instructionText: template }),
        buildTeachingInjection({ genType, stage, subject }),
        buildCallLayerBlocks().map((b) => b.text).join('\n'),
        genType === 'exam' ? ANSWER_ROLES.exam(subject) : ANSWER_ROLES.other(genType),
        buildAnswerFormatSpec(subject),
        stylesForType(genType).map((s) => buildStyleAppend(s)).join('\n'), // 🔴 S1：生成期追加（组织风格）
        buildDiffRegenBlock({ genType, diffKps: ['（已练知识点）'] }),       // 🔴 S1：生成期追加（复生成差异化）
        buildMultiTypeDiffBlock({ typeName: '（类型名）', prevTypes: '（前序类型）', coveredKps: ['（已覆盖知识点）'] }), // 🔴 S1：生成期追加（多类型差异化）
      ].filter(Boolean).join('\n');
      cutAll(live).forEach((p) => { if (!srcSig.has(S(p))) orphans.set(S(p), p.slice(0, 70)); });
    }

    const list = [...orphans.values()];
    expect(list, `实发里有 ${list.length} 句找不到源（应全部有主）：\n${list.slice(0, 15).join('\n')}`).toEqual([]);
  });

  it('🔴 跳转不变式：程序附加段每一段都必须能映射到 (lib, key|name)', () => {
    const knownLibs = new Set(['instruction', 'rules', 'render-contract', 'layout-spec', 'blueprint']);
    // 🔴 S1 口径改准：原仅抽 6 组合（语文/数学/英语 × 低段/中段）＝**抽样**（违反"禁抽样"）；
    //   现按全量真实开设组合（54 对 × 9 类型 = 486 cell）遍历，程序附加段的映射不变式全覆盖。
    const combos = REAL_CELLS;
    for (const c of combos) {
      const template = (getPromptTemplate({ grade: c.stage, subject: c.subject, genType: c.genType }).template) || '';
      const blocks = buildProgramAttachBlocks({
        subject: c.subject, stageKey: c.stage, genType: c.genType, instructionText: template,
      });
      for (const b of blocks) {
        expect(b.lib, `某段无 lib，跳转链会断：${JSON.stringify(b).slice(0, 120)}`).toBeTruthy();
        expect(knownLibs.has(b.lib), `未知 lib=${b.lib}（跳转面板无对应库）`).toBe(true);
        expect(Boolean(b.key || b.name), `段无 key/name，无法定位条目：${b.lib}`).toBe(true);
      }
    }
  });

  // 🔴 2026-10-11（S1·完备性自证 #2 的**另一半方向**）：E 表是"给模型文本的源登记"，故每个**已登记的非函数源**
  //   都必须在实发中真正落地（占比 > 0）；占比 0 ⇒ **死角源**（登记了却从不进实发）⇒ 差集非空 ⇒ 缺口。
  //   与上方"实发每一句都有主（实发→源）"互为镜像；**二者同时为空**才等于方法定稿所说的"双向差集为空"。
  //   （一望即知的坑：此向原**无人测**——`styleInstructions` 被漏掉的"生成期追加"通道即由此暴露。）
  it('🔴 源→实发差集为空：每个已登记的非函数源都必须在实发中落地（死角源即红）', async () => {
    const live = liveText();
    const dead = [];
    for (const [file, names] of Object.entries(mergeRegistries())) {
      let mod;
      try { mod = await import(`../../${file}`); } catch { dead.push(`${file}:<整文件导入失败>`); continue; }
      for (const n of names) {
        const val = mod[n];
        // 函数/正则：其"内容"由 build 输出通道承载（已在 liveText 组装处覆盖），不按字面量测
        if (typeof val === 'function' || val instanceof RegExp) continue;
        const strs = flatten(val);
        if (!strs.length) continue; // 无中文字面量（<8 字/无中文）：不构成"给模型文本的整句源"
        const hits = strs.filter((s) => live.includes(sig(s))).length;
        if (hits === 0) dead.push(`${file}:${n}  (0/${strs.length})`);
      }
    }
    expect(dead, `以下已登记源在实发中占比为 0（死角源／或测量口径漏通道）：\n${dead.join('\n')}`).toEqual([]);
  }, 120000);
});
