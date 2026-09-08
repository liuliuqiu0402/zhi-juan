/**
 * 执行点注册表 ↔ 引擎源码自动对账
 * ============================================================
 * 规则库「接线状态自检」由 validatorRules 导出的执行点注册表驱动（VALIDATOR_GATES / RULE_EXEC_BY / RULE_NO_EXEC），
 * 本测试以 examValidator.js 源码里的 has('<id>') 调用点做唯一事实源双向校验：
 *   1. VALIDATOR_GATES 必须与引擎全部独立执行分支一一对应（防新增分支/规则忘记登记）；
 *   2. 每个注册规则必属 独立执行/经汇总执行/纯约束 之一（注册空洞=0 的硬保证）；
 *   3. 汇总目标、纯约束豁免都必须是已注册规则。
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { VALIDATOR_RULES, VALIDATOR_GATES, RULE_EXEC_BY, RULE_NO_EXEC } from '../../src/config/validatorRules.js';

const engineSrc = fs.readFileSync(path.join(process.cwd(), 'src/utils/examValidator.js'), 'utf8');
const gateIds = [...new Set([...engineSrc.matchAll(/has\(\s*'([a-z0-9-]+)'\s*\)/g)].map((m) => m[1]))].sort();
const registeredIds = new Set(VALIDATOR_RULES.map((r) => r.id));

describe('validator 执行点注册表 ↔ 引擎 has() 调用点', () => {
  it('VALIDATOR_GATES 与 examValidator 全部 has() 分支双向一致（防漂移）', () => {
    expect([...VALIDATOR_GATES].sort()).toEqual(gateIds);
  });

  it('每个注册规则必属 独立执行 / 经汇总 / 纯约束 之一（注册空洞恒为 0）', () => {
    const covered = new Set([...VALIDATOR_GATES, ...Object.keys(RULE_EXEC_BY), ...RULE_NO_EXEC]);
    for (const r of VALIDATOR_RULES) {
      expect(covered.has(r.id), `规则「${r.id}」注册了却无任何执行路径（空洞）`).toBe(true);
    }
  });

  it('RULE_EXEC_BY：子规则已注册、汇总目标已注册且有独立执行分支', () => {
    for (const [child, via] of Object.entries(RULE_EXEC_BY)) {
      expect(registeredIds.has(child), `子规则「${child}」未注册`).toBe(true);
      expect(registeredIds.has(via), `汇总规则「${via}」未注册`).toBe(true);
      expect(new Set(gateIds).has(via), `汇总规则「${via}」在引擎无独立执行分支`).toBe(true);
    }
  });

  it('RULE_NO_EXEC（纯生成前约束豁免）必须是已注册规则', () => {
    for (const id of RULE_NO_EXEC) {
      expect(registeredIds.has(id), `纯约束规则「${id}」未注册`).toBe(true);
    }
  });

  it('孤儿执行点（引擎有分支但未注册）必须显式登记在 VALIDATOR_GATES 且无隐藏规则', () => {
    // 引擎分支全集 == 已注册独立执行 + 孤儿（未注册）两部分；孤儿数量须与本表登记一致（当前 3：score-* 惰性残留）
    const orphans = gateIds.filter((id) => !registeredIds.has(id));
    const declared = [...VALIDATOR_GATES].filter((id) => !registeredIds.has(id)).sort();
    expect(orphans).toEqual(declared);
  });
});
