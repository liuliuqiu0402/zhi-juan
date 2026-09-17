// 🔴 标记能力同源守卫（2026-09-17 用户裁定：「正文要求与注入能力必须同源」的**可测化**）
// ============================================================
// 背景（实测数据，来自三维度全枚举审计：15 科 × 5 学段 × 9 类型 = 675 组合）：
//   · 115 组合：委托正文写着"必须紧跟输出 [IMAGE] 块…格式见注入的【渲染指令】"，而 system 侧**没有**
//     [IMAGE] 骨架（原 needsImageHint 按类型白名单 + 文本关键词判定，与正文的**原则式**判据错位）；
//   · 152 组合：正文指向【渲染指令】，而该段**整段没注入**（内容型 / 无图形能力学科）= 假指针。
//   模型拿到"必须输出一个没有格式说明的东西"，只能写"根据图片提示…"文字图语或省块——这是"看图类题
//   不出图"的注入侧根因（与模型遵从无关）。
// 现口径（resolveMarkCapability 单源）：正文点名哪几个标记 ⇔ system 给哪几段骨架，两侧同一判定。
// 本文件把"悬空数 = 0"钉死：任一侧单独改动（正文加标记不减 / 骨架条件单改）都会红。
// ⚠️ 只做**结构性一致**断言，不断言具体措辞（措辞由各自用例守护）。
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { getPromptTemplate } from '../../src/config/promptLibrary.js';
import { buildProgramAttach } from '../../src/utils/programAttach.js';
import { setLibToggle } from '../../src/utils/libToggles.js';

const ROOT = path.resolve(__dirname, '../..');
const STAGES = ['primary_low', 'primary_mid', 'primary_high', 'middle', 'high'];
const SUBJECTS = ['语文', '数学', '英语', '物理', '化学', '生物', '科学', '历史', '地理', '道德与法治', '思想政治', '信息科技', '音乐', '美术', '体育'];
const TYPES = ['exam', 'practice', 'special', 'reading', 'dictation', 'errorbook', 'review', 'preview', 'summary'];

const CONTRACT_HEAD = '【渲染指令（EduRender Studio 格式';
const IMAGE_SKEL = 'PROMPT:画面描述';
const GRAPH_SKEL = 'TYPE ∈';
const SEE_CONTRACT = '按注入的【渲染指令】';

const cell = (subject, stageKey, genType) => {
  const body = (getPromptTemplate({ grade: stageKey, subject, genType }) || {}).template || '';
  const sys = buildProgramAttach({ subject, stageKey, genType, instructionText: body, attachInstructionKey: genType });
  return { body, sys };
};

describe('正文点名标记 ⇔ system 给骨架（三维度全矩阵，悬空必须为 0）', () => {
  const rows = [];
  for (const subject of SUBJECTS) {
    for (const stageKey of STAGES) {
      for (const genType of TYPES) {
        const { body, sys } = cell(subject, stageKey, genType);
        rows.push({
          id: `${subject}|${stageKey}|${genType}`,
          bodyIMG: body.includes('[IMAGE]'), bodyGRAPH: body.includes('[GRAPH]'), bodySee: body.includes(SEE_CONTRACT),
          sysIMG: sys.includes(IMAGE_SKEL), sysGRAPH: sys.includes(GRAPH_SKEL), sysHead: sys.includes(CONTRACT_HEAD),
          sysAny: sys.trim().length > 0,
        });
      }
    }
  }

  it('矩阵规模 = 15 科 × 5 学段 × 9 类型（防"样本太小"式假绿）', () => {
    expect(rows).toHaveLength(675);
  });

  it('① 正文点名 [IMAGE] ⇒ system 必给 [IMAGE] 骨架（原 115 组合悬空 → 0）', () => {
    const bad = rows.filter((r) => r.bodyIMG && !r.sysIMG).map((r) => r.id);
    expect(bad, `悬空组合：${bad.slice(0, 8).join(' , ')}`).toEqual([]);
  });

  it('② 正文点名 [GRAPH] ⇒ system 必有 [GRAPH] TYPE 声明（原 630 组合悬空 → 0）', () => {
    const bad = rows.filter((r) => r.bodyGRAPH && !r.sysGRAPH).map((r) => r.id);
    expect(bad, `悬空组合：${bad.slice(0, 8).join(' , ')}`).toEqual([]);
  });

  it('③ 正文指向【渲染指令】⇒ 该段必已注入（原 152 组合假指针 → 0）', () => {
    const bad = rows.filter((r) => r.bodySee && !r.sysHead).map((r) => r.id);
    expect(bad, `假指针组合：${bad.slice(0, 8).join(' , ')}`).toEqual([]);
  });

  it('④ 反向：给了 [IMAGE] 骨架 ⇒ 正文必须给出"何时用/何时不用"的裁定（不得只有能力没有判据）', () => {
    // 题类：正文【图-题一致性】条款；内容型：CONTENT_FORMAT 的"如需图形化图表"句
    const bad = rows.filter((r) => r.sysIMG && !r.bodyIMG).map((r) => r.id);
    expect(bad, `只给能力不给要求的组合：${bad.slice(0, 8).join(' , ')}`).toEqual([]);
  });

  it('⑤ 学科契约停用（工具库 subj:学科）→ 两侧**同时**消失（正文不提标记、system 无该段）', () => {
    const before = cell('数学', 'middle', 'exam');
    expect(before.body.includes('[GRAPH]')).toBe(true);
    expect(before.sys.includes(GRAPH_SKEL)).toBe(true);
    setLibToggle('render-contract', 'subj:数学', false);
    try {
      const after = cell('数学', 'middle', 'exam');
      expect(after.body, '停用后正文不得再点名 [GRAPH]').not.toContain('[GRAPH]');
      expect(after.body, '停用后正文不得再指向【渲染指令】').not.toContain(SEE_CONTRACT);
      expect(after.sys, '停用后 system 不得再注入渲染指令段').not.toContain(CONTRACT_HEAD);
      // 其他学科不受影响
      expect(cell('语文', 'primary_mid', 'exam').sys).toContain(CONTRACT_HEAD);
    } finally {
      setLibToggle('render-contract', 'subj:数学', true);
    }
  });

  it('⑥ 组织风格描述不承载标记协议（协议只在渲染指令/正文图条款——防"风格文案点名 [GRAPH] 而该学科无能力"）', () => {
    const ek = fs.readFileSync(path.join(ROOT, 'src/config/expertKnowledge.js'), 'utf8');
    // 抽 styleInstructions 区段与 styleOptions tips：都不得出现标记名
    const styleBlock = ek.slice(ek.indexOf('export const styleInstructions'));
    expect(styleBlock).not.toContain('[GRAPH]');
    expect(styleBlock).not.toContain('[IMAGE]');
    expect(ek.slice(ek.indexOf('// ── 呈现风格组'), ek.indexOf('export const styleInstructions'))).not.toContain('[GRAPH]');
  });

  it('⑦ 能力判定只有一处（promptLibrary 与 system 侧共用 resolveMarkCapability，不得各写一套）', () => {
    const lib = fs.readFileSync(path.join(ROOT, 'src/config/promptLibrary.js'), 'utf8');
    const rc = fs.readFileSync(path.join(ROOT, 'src/config/eduRenderContract.js'), 'utf8');
    const ai = fs.readFileSync(path.join(ROOT, 'src/composables/useAiGenerator.js'), 'utf8');
    const gm = fs.readFileSync(path.join(ROOT, 'src/modules/GenerateModule.vue'), 'utf8');
    expect(lib).toContain('resolveMarkCapability');
    expect(rc).toContain('export function resolveMarkCapability');
    // 旧的两把尺子不得回潮：能力不看文本关键词、不看资料类型白名单
    // （源码注释会引用旧机制名留痕，故按"定义式/调用式"锚定，而非裸词匹配）
    expect(rc).not.toMatch(/const IMAGE_CAPABLE_TYPES\s*=/);
    expect(rc).not.toMatch(/export function needsImageHint/);
    expect(rc).not.toMatch(/const IMAGE_HINT_RE\s*=/);
    expect(gm, '三入口不得再各自拼配图提示文本').not.toMatch(/resolveNeedsImageText\s*\(/);
    expect(gm, '生成端不得再调用已撤除的 buildNeedsImageText').not.toMatch(/buildNeedsImageText\s*\(/);
    expect(ai, '生成端不得再调用已撤除的 needsImageHint').not.toMatch(/needsImageHint\s*\(/);
  });
});
