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
import { buildUserMessagePrompt, buildCallLayerBlocks } from '../../src/utils/injectionManifest.js';
import { buildProgramAttach, buildProgramAttachBlocks } from '../../src/utils/programAttach.js';
import { SUBJECT_KEYS, STAGE_KEYS, GEN_TYPE_KEYS } from '../../src/config/toolLibrary.js';
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

/** 实发文本样本（全量 675 份拼接；口径与生成端一致） */
function liveText() {
  const parts = [];
  for (const genType of GEN_TYPE_KEYS) for (const subject of SUBJECT_KEYS) for (const stage of STAGE_KEYS) {
    const template = (getPromptTemplate({ grade: stage, subject, genType }).template) || '';
    const teaching = buildTeachingInjection({ genType, stage, subject }) || '';
    parts.push(buildUserMessagePrompt({ genType, subject, materialChannel: 'anchor', anchorListText: '@@A@@', instructionText: template }));
    parts.push(buildProgramAttach({ subject, stageKey: stage, genType, instructionText: template }));
    parts.push(teaching, buildCallLayerBlocks().map((b) => b.text).join('\n'));
    parts.push(genType === 'exam' ? ANSWER_ROLES.exam(subject) : ANSWER_ROLES.other(genType));
    parts.push(buildAnswerFormatSpec(subject));
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
  }, 120000); // 测量面＝全 src（122 模块）＋675 份实发装配，需放宽超时（默认 5s 不够，实测 ~6s）

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
    for (const genType of GEN_TYPE_KEYS) for (const subject of SUBJECT_KEYS) for (const stage of STAGE_KEYS) {
      const template = (getPromptTemplate({ grade: stage, subject, genType }).template) || '';
      srcTexts.push(template);
      srcTexts.push(buildTeachingInjection({ genType, stage, subject }) || '');
      srcTexts.push(buildProgramAttach({ subject, stageKey: stage, genType, instructionText: template }) || '');
      srcTexts.push(buildUserMessagePrompt({ genType, subject, materialChannel: 'anchor', anchorListText: '', instructionText: template }));
      srcTexts.push(genType === 'exam' ? ANSWER_ROLES.exam(subject) : ANSWER_ROLES.other(genType));
      srcTexts.push(buildAnswerFormatSpec(subject));
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
    for (const genType of GEN_TYPE_KEYS) for (const subject of SUBJECT_KEYS) for (const stage of STAGE_KEYS) {
      const template = (getPromptTemplate({ grade: stage, subject, genType }).template) || '';
      const live = [
        buildUserMessagePrompt({ genType, subject, materialChannel: 'anchor', anchorListText: '', instructionText: template }),
        buildProgramAttach({ subject, stageKey: stage, genType, instructionText: template }),
        buildTeachingInjection({ genType, stage, subject }),
        buildCallLayerBlocks().map((b) => b.text).join('\n'),
        genType === 'exam' ? ANSWER_ROLES.exam(subject) : ANSWER_ROLES.other(genType),
        buildAnswerFormatSpec(subject),
      ].filter(Boolean).join('\n');
      cutAll(live).forEach((p) => { if (!srcSig.has(S(p))) orphans.set(S(p), p.slice(0, 70)); });
    }

    const list = [...orphans.values()];
    expect(list, `实发里有 ${list.length} 句找不到源（应全部有主）：\n${list.slice(0, 15).join('\n')}`).toEqual([]);
  });

  it('🔴 跳转不变式：程序附加段每一段都必须能映射到 (lib, key|name)', () => {
    const knownLibs = new Set(['instruction', 'rules', 'render-contract', 'layout-spec', 'blueprint']);
    const combos = [];
    for (const genType of GEN_TYPE_KEYS) for (const subject of ['语文', '数学', '英语']) {
      combos.push({ genType, subject, stage: 'primary_low' });
      combos.push({ genType, subject, stage: 'middle' });
    }
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
});
