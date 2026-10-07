/**
 * S4 验收（专项领域·交付级）——2026-10-07
 * ============================================================
 * 按 `docs/design/专项领域-全学科全学段规格-2026-10-07.md` 的 S4 验收口径：
 *   ① 覆盖矩阵：`STAGE_SUBJECTS` 每个**开设格**逐格 ≥1 领域（"缺"＝0）；非开设格＝"回退设计"（由 namePoolGuard「学段边界」臂另判）。
 *   ② 产物级：逐格逐领域的**注入文本**（A 档＝`buildSpecialDomainsStructureText`；B 档＝`buildSpecialDomainsAnchorLines`）
 *      必须 ①含本领域课标锚 ②**不含数字题量**（题量走程序护栏、不注入）③不含旧名池文案（"分板块组织／每板块配解析"）。
 *   ③ 全量绿由 `npx vitest run tests/config tests/recipe tests/utils` 覆盖；④ 留痕见台账〔116〕。
 */
import { describe, it, expect } from 'vitest';
import { STAGE_SUBJECTS } from '../../src/config/promptLibrary.js';
import {
  specialDomainOptions, resolveSpecialDomain,
  buildSpecialDomainsStructureText, buildSpecialDomainsAnchorLines,
} from '../../src/config/specialDomains.js';

const subjStages = {};
for (const [st, subs] of Object.entries(STAGE_SUBJECTS)) {
  for (const s of subs) (subjStages[s] = subjStages[s] || []).push(st);
}

/** 有意不设领域的"**回退设计**"格（与"缺"必须分开 · 与 namePoolGuard「学段边界」臂同源口径）
 *  当前仅一格：**英语·小学低段** —— 属主 2026-10-07 裁定"英语低段不开"，
 *  课标依据：《义务教育英语课程标准（2022年版）》1–2 年级为**预备级**（只有总体要求，无一级/二级式分项内容要求）。 */
const INTENTIONAL_EMPTY = {
  '英语·primary_low': '属主裁定：英语低段不开（课标 1–2 年级为预备级）',
};

/** 已登记待改（**非结案** · 2026-10-07 面 4 六问命中 · 台账〔122〕）：
 *  同学科内**同名栏目 note 逐字不一致** ⇒ `buildSpecialDomainsStructureText` 按 name 去重会**静默丢注**。
 *  处置方向：**统一为同一句栏目要求**（同一份资料内"栏目名相同即同一栏目"，其要求应一致）。
 *  登记项若已不复现 ⇒ 测试 fail，强制移出登记（防"豁免掩盖真缺"）。 */
const PENDING_SAME_NAME_NOTE = new Set([
  '英语·primary_mid「辨析与纠错」', '英语·primary_high「辨析与纠错」',
  '生物·middle「观察与实验」', '地理·middle「应用与辨析」',
  '数学·high「综合与易错」', '化学·high「综合与辨析」',
  '生物·high「实验与数据」', '生物·high「综合与辨析」',
  '历史·high「解释与评价」', '历史·high「史事与线索」',
  '地理·high「读图与用图」', '地理·high「综合与辨析」', '地理·high「读图与分析」',
  '体育·high「要领与规则」',
]);

describe('S4 验收（专项领域·交付级）', () => {
  it('① 覆盖矩阵：每个开设格 ≥1 领域（"回退设计"与"缺"分开）', () => {
    const missing = [];
    const strayWhitelist = [];
    for (const [st, subs] of Object.entries(STAGE_SUBJECTS)) {
      for (const sub of subs) {
        const n = (specialDomainOptions(sub, st) || []).length;
        const key = `${sub}·${st}`;
        if (INTENTIONAL_EMPTY[key]) { if (n) strayWhitelist.push(key); continue; }
        if (!n) missing.push(key);
      }
    }
    expect(missing, `以下开设格无任何专项领域（＝缺）：${missing.join(' / ')}`).toEqual([]);
    // 登记表不得失效（若该格后来有了领域，须同步删掉登记，防"豁免掩盖真缺"）
    expect(strayWhitelist, `以下"回退设计"登记已失效（该格已有领域）：${strayWhitelist.join(' / ')}`).toEqual([]);
  });

  it('② 产物级：注入文本含课标锚、不含数字题量、不含旧名池文案', () => {
    const bad = [];
    for (const [st, subs] of Object.entries(STAGE_SUBJECTS)) {
      for (const sub of subs) {
        for (const o of specialDomainOptions(sub, st) || []) {
          const d = resolveSpecialDomain(sub, st, o.value);
          if (!d) { bad.push(`${sub}·${st}「${o.value}」resolve 为空`); continue; }
          const text = (d.sections && d.sections.length)
            ? buildSpecialDomainsStructureText([d], st)
            : buildSpecialDomainsAnchorLines([d]);
          const tag = `${sub}·${st}「${o.value}」`;
          if (!text) bad.push(`${tag} 注入文本为空`);
          // ① 含本领域课标锚（取锚首 8 字比对，兼容 anchors 覆盖）
          const anchor = d.anchor || '';
          if (anchor && !text.includes(anchor.slice(0, 8))) bad.push(`${tag} 注入文本缺课标锚`);
          // ② 不含数字题量（题量走程序护栏、不注入）
          if (/\d+\s*[题道]/.test(text)) bad.push(`${tag} 注入文本含数字题量`);
          // ③ 不含旧名池文案
          if (text.includes('分板块组织') || text.includes('每板块配解析')) bad.push(`${tag} 注入文本含旧名池文案`);
        }
      }
    }
    expect(bad, `产物级断言未过：${bad.join(' / ')}`).toEqual([]);
  });

  it('③ A/B 混选：结构头须写明"未列栏目者只给课标语义锚"（面 1 声明↔实给 · 规格第六节）', () => {
    const A = { key: 'x', label: '甲域', anchor: '甲域课标锚', sections: [{ name: '甲栏', note: '甲栏要求' }] };
    const B = { key: 'y', label: '乙域', anchor: '乙域课标锚' }; // 无 sections ＝ B 档
    const mix = buildSpecialDomainsStructureText([A, B], 'middle');
    expect(mix).toContain('甲栏');                       // A 档出栏目
    // 栏目行须与蓝图同口径带标注（2026-09-17 裁定"教辅栏目注与 exam 侧同口径、逐行带【要求·须逐项落实】标注"）
    expect(mix).toContain('· 甲栏——【要求·须逐项落实】甲栏要求');
    expect(mix).toContain('乙域课标锚');                  // B 档出锚
    expect(mix).toContain('乙域 只给课标语义锚、不另设栏目'); // 结构头写明（缺此句即缺口）
    // 纯 A 档不加此句（无 B 档领域时不引入噪声）
    expect(buildSpecialDomainsStructureText([A], 'middle')).not.toContain('不另设栏目');
  });

  it('④ 跨处一致：同学科内同名栏目的 note 必须逐字一致（否则并集去重会静默丢注）', () => {
    const bad = []; const hitPending = new Set();
    for (const st of Object.keys(STAGE_SUBJECTS)) {
      for (const sub of STAGE_SUBJECTS[st]) {
        const byName = {};
        for (const o of specialDomainOptions(sub, st) || []) {
          const d = resolveSpecialDomain(sub, st, o.value);
          for (const s of (d && d.sections) || []) {
            if (byName[s.name] === undefined) { byName[s.name] = s.note; continue; }
            if (byName[s.name] !== s.note) {
              const k = `${sub}·${st}「${s.name}」`;
              if (PENDING_SAME_NAME_NOTE.has(k)) { hitPending.add(k); continue; }
              bad.push(`${k} note 不一致（并集去重会丢注）`);
            }
          }
        }
      }
    }
    expect(bad, `同名不同注：${bad.join(' / ')}`).toEqual([]);
    // 登记项若已不复现 ⇒ fail（防"豁免掩盖真缺"；与 blockStructure.test「登记过期须移回」同思路）
    const stray = [...PENDING_SAME_NAME_NOTE].filter((k) => !hitPending.has(k));
    expect(stray, `已登记的"同名不同注"不再复现，请移出登记：${stray.join(' / ')}`).toEqual([]);
  });
});
