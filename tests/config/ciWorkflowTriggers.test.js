// 🔧 CI 触发过滤守卫（2026-09-14 用户定）：移动端打包用 paths-ignore（排除式）——
//    纯文档/测试改动不再触发 iOS/Android 打包，省 runner 时间、减少无关 CI 噪音。
//    本测试锁两条不变量：
//      ① 过滤必须是"排除式"（paths-ignore），且 manual 触发（workflow_dispatch）必须保留——
//         保证任何时候都能手动出包，不因过滤而"没入口"；
//      ② 忽略清单**绝不允许**出现构建输入（src/public/index.html/vite 配置/capacitor 配置/
//         ios/android/scripts/package.json/lock）——否则打包会静默停更（改代码却不出新包）。
//    无 yaml 依赖：用行扫描解析 paths-ignore 块（够用且不引新依赖）。
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const WORKFLOWS = ['ios-build.yml', 'android-build.yml'];
const read = (f) => fs.readFileSync(path.join(ROOT, '.github', 'workflows', f), 'utf8');

/** 解析 paths-ignore 列表（缩进块内的 `- 'xxx'` 行） */
function ignoreList(src) {
  const i = src.indexOf('paths-ignore:');
  if (i === -1) return null;
  const out = [];
  for (const line of src.slice(i).split('\n').slice(1)) {
    const m = line.match(/^\s+-\s+['"]?([^'"\s]+)['"]?\s*$/);
    if (!m) {
      if (line.trim() && !/^\s*#/.test(line)) break; // 块结束（遇到非列表项、非注释）
      continue;
    }
    out.push(m[1]);
  }
  return out;
}

// 构建输入：移动端产物内含 vite 打包结果，任一变化都必须重新出包
const BUILD_INPUTS = [
  'src/**', 'public/**', 'index.html', 'vite.config.js', 'vite.config.ts',
  'capacitor.config.js', 'capacitor.config.ts', 'capacitor.config.json',
  'ios/**', 'android/**', 'scripts/**', 'package.json', 'package-lock.json',
];

describe('移动端 CI 触发过滤（paths-ignore 排除式 + 构建输入不可忽略）', () => {
  for (const wf of WORKFLOWS) {
    it(`${wf}：保留手动触发 + 使用排除式过滤`, () => {
      const src = read(wf);
      expect(src).toContain('workflow_dispatch:'); // 手动出包入口始终在
      expect(src).toContain('paths-ignore:');      // 排除式（非 paths 包含式）
      expect(ignoreList(src), 'paths-ignore 应能解析出条目').toBeTruthy();
      expect(ignoreList(src).length).toBeGreaterThan(0);
    });

    it(`${wf}：忽略清单不得包含任何构建输入（防打包静默停更）`, () => {
      const list = ignoreList(read(wf)) || [];
      const bad = list.filter((p) => BUILD_INPUTS.includes(p)
        // 通配形态兜底：形如 src/ 或 src/** 都被视为构建输入
        || BUILD_INPUTS.some((bi) => bi.replace('/**', '') === p.replace(/\/\*\*$/, '')));
      expect(bad, `不应忽略构建输入：${bad.join('、')}`).toEqual([]);
    });
  }

  it('两条移动端工作流的忽略口径一致（避免只改一边造成行为漂移）', () => {
    const [a, b] = WORKFLOWS.map((w) => ignoreList(read(w)));
    expect(a).toEqual(b);
  });
});
