// 分析任务输出上限（analysis maxTokens）隐式截断根因 + 修复
// 背景（2026-09-12）：教材"小数乘法和除法(二)"特征分析失败 → 锚树判 "knowledgeHierarchy empty"。
//   根因不是缓存、不是模型，而是 **analysis 的 max_tokens 被旧 localStorage 里过窄死值（4096）钳死**：
//   maxTokensByTask 整块覆盖让旧 `analysis:4096` 压死新默认 65536 → 输出被硬截断 → robustJsonParse
//   把残缺 JSON 补全成"缺 knowledgeHierarchy 字段的对象" → `|| []` → 空树 → 不落库。
// 修复两层：
//   A. loadConfig 深合并 maxTokensByTask 逐键取"默认与存储的较大者"（旧窄值不再压死新默认）。
//   B. 分析 callAI 接生成侧"灵活模式"（planOutputQuota + 引擎护栏），maxTokens 由原文量推导，不是死数字。
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeMaxTokensByTask, getTaskMaxTokens, resolveTaskMaxTokens, FACTORY_MAX_TOKENS_BY_TASK } from '../../src/config/apiConfig.js';
import { planOutputQuota, charsToTokens } from '../../src/utils/outputQuota.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

// 期望值独立编码，不引用被测模块自证
const DEFAULT_BY_TASK = {
  extraction: 2048,
  analysis: 65536,
  blueprint: 32768,
  generation: 32768,
  formatting: 8192,
};

function expectClampedByLegacy4096() {
  // 记录被修掉的旧行为：整块浅覆盖会让 analysis 落 4096
  return mergeMaxTokensByTask(DEFAULT_BY_TASK, { ...DEFAULT_BY_TASK, analysis: 4096 }).analysis;
}

describe('analysis 输出上限：不被旧 localStorage 过窄死值钳死', () => {
  it('🔴 旧存档 analysis=4096 不再压死新默认 65536（取较大 → 65536）', () => {
    const stored = { ...DEFAULT_BY_TASK, analysis: 4096 }; // 旧 localStorage 内容
    const merged = mergeMaxTokensByTask(DEFAULT_BY_TASK, stored);
    expect(merged.analysis).toBe(65536);
    // 记录被修掉的旧行为：整块浅覆盖会返回 4096 → 显式断言它 ≠ 4096
    expect(merged.analysis).not.toBe(4096);
  });

  it('用户主动放大某任务时不被默认值回退（取较大保留用户放大）', () => {
    const stored = { ...DEFAULT_BY_TASK, blueprint: 65536 }; // 用户调大
    const merged = mergeMaxTokensByTask(DEFAULT_BY_TASK, stored);
    expect(merged.blueprint).toBe(65536); // 不被默认 32768 回退
  });

  it('合并函数绝不返回 0 或负数（任意脏值兜底为默认）', () => {
    const merged = mergeMaxTokensByTask(DEFAULT_BY_TASK, { analysis: -5, formatting: 0 });
    expect(merged.analysis).toBe(65536);
    expect(merged.formatting).toBe(8192);
  });
});

// 默认表与测试锁定口径一致（否则上面断言失真）
describe('默认 maxTokensByTask 表一致', () => {
  it('getTaskMaxTokens 读到 analysis=65536（新默认，非旧 4096）', () => {
    expect(getTaskMaxTokens('analysis')).toBe(65536);
    expect(getTaskMaxTokens('extraction')).toBe(2048);
  });
});

// 🔴 2026-09-12 实证回归：App.vue 用 Object.assign(apiConfig, loadConfigSync()) 把**旧存档**灌进
//    apiConfig（loadConfigSync 走 normalizeModelFields），若"合并基准"取自 apiConfig.generationSettings，
//    基准就被污染成旧值 4096 → 合并失效（analysis 仍是 4096）。
//    修复=合并基准改取**模块初始化即冻结的出厂快照** FACTORY_MAX_TOKENS_BY_TASK。
describe('出厂快照：不随 apiConfig 被旧存档覆盖而污染', () => {
  it('快照为出厂默认（analysis=65536），与 apiConfig 当前值无关', () => {
    expect(FACTORY_MAX_TOKENS_BY_TASK.analysis).toBe(65536);
    expect(Object.isFrozen(FACTORY_MAX_TOKENS_BY_TASK)).toBe(true);
  });

  it('以快照为基准合并旧存档 4096 → 仍得 65536（旧值不压死新默认）', () => {
    expect(mergeMaxTokensByTask(FACTORY_MAX_TOKENS_BY_TASK, { analysis: 4096 }).analysis).toBe(65536);
  });
});

// 🔴 2026-09-12 二次实证：即便合并到位，若 `maxTokensByTask` 整体缺失（旧存档无此字段，
//    或被 App.vue 的 Object.assign 覆盖成不含该字段的对象），原实现会落到通用 maxTokens(4096)。
//    修复=解析时夹一层**出厂类型帽**。
describe('类型上限解析：键缺失也必须走出厂帽，不得跌回通用 4096', () => {
  const FACTORY = { analysis: 65536, extraction: 2048 };

  it('byTask 缺该键（旧存档无 maxTokensByTask）→ 取出厂帽 65536', () => {
    expect(resolveTaskMaxTokens({ byTask: {}, factory: FACTORY, generic: 4096, taskType: 'analysis' })).toBe(65536);
  });

  it('byTask 缺该键但 generic=4096 → 仍取出厂帽（不落 4096）', () => {
    const out = resolveTaskMaxTokens({ byTask: { extraction: 2048 }, factory: FACTORY, generic: 4096, taskType: 'analysis' });
    expect(out).toBe(65536);
    expect(out).not.toBe(4096);
  });

  it('存档显式值优先（含用户主动收紧）', () => {
    expect(resolveTaskMaxTokens({ byTask: { analysis: 8192 }, factory: FACTORY, generic: 4096, taskType: 'analysis' })).toBe(8192);
  });

  it('脏值（0/负/非数）→ 取出厂帽', () => {
    expect(resolveTaskMaxTokens({ byTask: { analysis: 0 }, factory: FACTORY, generic: 4096, taskType: 'analysis' })).toBe(65536);
    expect(resolveTaskMaxTokens({ byTask: { analysis: -1 }, factory: FACTORY, generic: 4096, taskType: 'analysis' })).toBe(65536);
    expect(resolveTaskMaxTokens({ byTask: { analysis: 'x' }, factory: FACTORY, generic: 4096, taskType: 'analysis' })).toBe(65536);
  });

  it('两级都缺 → 落到通用 maxTokens；全缺 → 4096', () => {
    expect(resolveTaskMaxTokens({ byTask: {}, factory: {}, generic: 8192, taskType: 'zzz' })).toBe(8192);
    expect(resolveTaskMaxTokens({ byTask: {}, factory: {}, generic: 0, taskType: 'zzz' })).toBe(4096);
  });
});

describe('analysis 灵活模式：maxTokens 由原文量推导，不再静态卡死', () => {
  it('5357字章节（本次故障样本）推导到远高于旧 4096 的单次帽', () => {
    // 复刻本次故障章节：原文 5357 字
    const need = charsToTokens(5357);
    // 深seek 引擎护栏 196608（与 engineOutputLimit 测试同值）；perCallCap 为默认 analysis 65536
    const quota = planOutputQuota({ needTokens: need, safetyBuffer: 1.25, perCallCap: 65536, engineCeiling: 196608, minRounds: 0 });
    expect(quota.perCall).toBeGreaterThan(4096); // 关键：不再被旧死值卡住
    expect(quota.perCall).toBeLessThanOrEqual(65536); // 仍被类型帽/护栏约束（不失控）
  });

  it('minRounds=0 时单次帽即所需（分析为单次调用、无续写轮）', () => {
    const quota = planOutputQuota({ needTokens: 1000, safetyBuffer: 1, perCallCap: 65536, engineCeiling: 196608, minRounds: 0 });
    expect(quota.perCall).toBe(1000);
    expect(quota.rounds).toBeGreaterThanOrEqual(1);
  });

  it('fail-safe：needTokens 极小也不落到 0（至少 1）', () => {
    const quota = planOutputQuota({ needTokens: 0, perCallCap: 65536, engineCeiling: 196608, minRounds: 0 });
    expect(quota.perCall).toBeGreaterThanOrEqual(1);
  });
});

// ─────────────────────────────────────────────────────────────
// 🔴 2026-09-12 第二轮（实测事故）：短章节（Project 单元）推出 **505 token** 单次帽 →
//   分析产物是结构化 JSON（知识层级/考点/版式/公式），体量**不与原文等比** → 输出被截断 →
//   JSON 修复/补全在同一 505 帽内徒劳 → 残件缺 knowledgeHierarchy → 锚树判空不落库；
//   推导是确定性的 → 重分析仍是 505 → 怎么重试都不成功。
//   修复：推导**只许放大、不得低于类型帽**：min(引擎护栏, max(类型帽, 推导值))。
describe('analysis 单次帽推导必须有下限（不得低于类型帽）', () => {
  const typeCap = 65536;
  const engineCap = 196608;

  it('短章节（505 样本量级）裸推导确实远小于类型帽——即故障根因', () => {
    const quota = planOutputQuota({ needTokens: charsToTokens(500), safetyBuffer: 1.25, engineCeiling: engineCap, minRounds: 0 });
    expect(quota.perCall).toBeLessThan(typeCap);
  });

  it('下限生效：短章节取类型帽（不再被压到装不下完整 JSON）', () => {
    const quota = planOutputQuota({ needTokens: charsToTokens(500), safetyBuffer: 1.25, engineCeiling: engineCap, minRounds: 0 });
    expect(Math.min(engineCap, Math.max(typeCap, quota.perCall))).toBe(typeCap);
  });

  it('长章节仍按推导放大（灵活模式不退化）', () => {
    // 类型帽 65536 对应约 6.8 万字原文；更长的章节才需要放大（此处取 12 万字，远超类型帽）
    const quota = planOutputQuota({ needTokens: charsToTokens(120000), safetyBuffer: 1.25, engineCeiling: engineCap, minRounds: 0 });
    expect(quota.perCall).toBeGreaterThan(typeCap);
    expect(Math.min(engineCap, Math.max(typeCap, quota.perCall))).toBe(quota.perCall);
  });

  it('引擎护栏低于类型帽时以护栏为上限（不发超限请求）', () => {
    expect(Math.min(8192, Math.max(typeCap, 4000))).toBe(8192);
  });

  it('源码接线：推导结果按下限式取值（防回退成裸推导）', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src', 'composables', 'useAiGenerator.js'), 'utf8');
    expect(src).toContain('Math.min(engineCap, Math.max(analysisTypeCap, analysisQuota.perCall))');
  });

  it('源码接线：截断时不走 JSON 修复链（如实报因，不再伪装成"结构不符"）', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src', 'composables', 'useAiGenerator.js'), 'utf8');
    expect(src).toContain('returnMeta: true');
    expect(src).toContain("responseFinish === 'length'");
    expect(src).toContain('教材特征分析结果结构不完整（缺 knowledgeHierarchy）');
  });

  // 🔴 2026-09-12（用户口径）：分析阶段**只有日志、没有问题列表报告**，故真因必须经 result 带出、
  //    并在锚树日志里如实报出——否则"预算不足导致的截断"会被读成"模型结构不符"。
  it('源码接线：真因随分析结果带出，并在锚树日志中如实报出', () => {
    const ai = fs.readFileSync(path.join(ROOT, 'src', 'composables', 'useAiGenerator.js'), 'utf8');
    expect(ai).toContain('result.analysisFailure =');
    const gm = fs.readFileSync(path.join(ROOT, 'src', 'modules', 'GenerateModule.vue'), 'utf8');
    expect(gm).toContain('本次真因：${cause}');
    expect(gm).toContain('｜真因：${r.cause');
  });
});