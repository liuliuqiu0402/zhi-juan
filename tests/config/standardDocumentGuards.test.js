// 🔒 标准文档守卫：把"逐条逐字复核标准"钉在仓库里
// ============================================================
// 为什么加这个守卫（2026-10-01 用户追问："我们现在聊的这些标准，不是仅在对话里吧？要是成历史对话了，你也记不住吧？"）：
//   标准只写在对话里＝换会话即失效；只写在文档里＝可能被静默删改。故把"标准在册且按序"做成**机检**：
//   一旦 §六 八问被删、被颠倒、附条缺项，或"一切改动的验收标准"（修复准则）不再指向它 → 测试转红。
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const STD = 'docs/design/指令改动标准-可机检清单.md';
const FIX = 'docs/design/修复准则-检查清单.md';
const LEDGER = 'docs/design/实发语义逐条复核-覆盖台账-2026-10-01.md';

describe('标准文档守卫：逐条逐字复核的八问标准在册', () => {
  const std = read(STD);

  it('§六「八问固定顺序」在册，且八问**按序**出现（防颠倒、防跳问）', () => {
    expect(std).toContain('八问固定顺序');
    // 🔴 2026-10-01 用户定序：⑦＝排序（位置与结构）／⑧＝质量（原 ⑦质量／⑧位置 已按用户口径对调）
    const order = ['① | **三维度**', '② | **课标**', '③ | **啰嗦**', '④ | **精准**', '⑤ | **诱导**', '⑥ | **拼接**', '⑦ | **位置与结构（排序）**', '⑧ | **质量**'];
    let last = -1;
    for (const k of order) {
      const i = std.indexOf(k);
      expect(i, `缺主条或其表述被改：${k}`).toBeGreaterThan(-1);
      expect(i, `主条顺序被颠倒：${k}`).toBeGreaterThan(last);
      last = i;
    }
  });

  it('附1–附13 齐全（排序＝主条⑦；职责归属＝附12；载体自洽样板＝附13）', () => {
    for (let i = 1; i <= 13; i++) expect(std, `缺附${i}`).toContain(`| 附${i} |`);
    expect(std).toContain('位置与结构（排序）');
    expect(std).toContain('关键判据放首尾');
    expect(std).toContain('先看每一块');
    expect(std).toContain('不得靠加段落增字');
    expect(std).toContain('一段一主题');
    expect(std).toContain('职责归属判据');
    expect(std).toContain('语义定宽归模型');
    expect(std).toContain('alignCarrierFormByDeclaration');
    expect(std).toContain('提示词零新增');
  });

  it('主次关系写明：①–⑧ 是主条、附条只是判定工具，不改变主条顺序', () => {
    expect(std).toContain('不改变主条顺序');
    expect(std).toContain('不另立主条');
  });

  it('六.2 已声明机检入口（本文件），防止标准与守卫脱节', () => {
    expect(std).toContain('standardDocumentGuards.test.js');
  });

  it('六.3 判定权与依据纪律在册（防"判例覆盖成文法"与把判定推回用户）', () => {
    expect(std).toContain('判定权与依据纪律');
    expect(std).toContain('口头裁定不自动成为标准');
    expect(std).toContain('只提两类问题给用户');
    expect(std).toContain('不得以个案当通例');
    expect(std).toContain('禁止写"按上次的意思"作为依据');
  });

  it('六.4 口径记录在册（用户 12 条裁定入档，不留对话里）', () => {
    expect(std).toContain('口径记录');
    for (let i = 1; i <= 12; i++) {
      expect(std, `口径记录缺第 ${i} 条`).toMatch(new RegExp(`^\\| ${i} \\| `, 'm'));
    }
    expect(std).toContain('当然是越简短越好');
    expect(std).toContain('必须三维度定制');
    expect(std).toContain('不得借用他学段骨架冒充');
  });

  it('六.5 既有定稿体检在册（补丁判定：答案角色那条＝根因修复、保留）', () => {
    expect(std).toContain('既有定稿体检');
    expect(std).toContain('不是补丁，是根因修复，仍需保留');
    expect(std).toContain('零风险前置');
  });

  it('D7 既有裁定须受检、不得盲从（常态体检机制在册）', () => {
    expect(std).toContain('既有裁定须受检，不得盲从');
    expect(std).toContain('仍成立 / 需修正');
    expect(std).toContain('这是常态机制，不是一次性动作');
  });

  it('六.6 反向推敲在册（任务/范围/标准三问；附条来源分级；精简须留对照）', () => {
    expect(std).toContain('反向推敲');
    expect(std).toContain('有没有站不住脚的');
    expect(std).toContain('原句 → 短句');
    expect(std).toContain('注入点反查');
    expect(std).toContain('反查差集');
    expect(std).toContain('优先"门控"');
    expect(std).toContain('纸面推演 / 程序校验 / 真机实测');
    expect(std).toContain('【用户明示】');
    expect(std).toContain('【我建议·默认通过');
    expect(std).toContain('产品参数表归程序');
  });

  it('D1–D18 全部在册（防静默删条 / 防"下一轮就忘"）', () => {
    for (let i = 1; i <= 18; i += 1) {
      expect(std, `缺 D${i}（纪律条目被删或改号）`).toMatch(new RegExp(`\\|\\s*\\*{0,2}D${i}\\*{0,2}\\s*\\|`));
    }
  });

  it('🔴 根入口 AGENTS.md 在册且含铁律指针（跨会话不遗忘的落点）', () => {
    const ag = read('AGENTS.md');
    expect(ag).toContain('八问固定顺序');
    expect(ag).toContain('禁止捷径');
    expect(ag).toContain('判重复＝判语义');
    expect(ag).toContain('不得盲删');
    expect(ag).toContain('指令改动标准-可机检清单.md');
    expect(ag).toContain('实发逐句复核-进度账');
    expect(ag).toContain('跳转不变式');
    // 🔴 2026-10-01 自查发现的内部不一致（必读写 D1–D17、机检表却仍写 D1–D15）→ 机检锁死："D 范围"在 AGENTS.md 内必须与标准一致
    expect(ag, 'AGENTS.md 的 D 范围未同步（应与标准一致，现为 D1–D17）').toContain('D1–D17');
    expect(ag).toContain('自检/复核类块＝补丁');
    expect(ag).toContain('判据式');
  });

  it('README 顶部指向 AGENTS.md（入口可达）', () => {
    const rd = read('README.md');
    expect(rd).toContain('AGENTS.md');
  });

  it('「一切改动的验收标准」（修复准则）指向八问标准', () => {
    const fix = read(FIX);
    expect(fix).toContain('八问固定顺序');
    expect(fix).toContain('指令改动标准-可机检清单.md');
    expect(fix).toContain('不得颠倒、不得跳问');
  });

  it('覆盖台账在册：工具库六库 ＋ 库外编码来源逐条登记（防漏的边界）', () => {
    const led = read(LEDGER);
    expect(led).toContain('覆盖台账');
    const files = [
      'promptLibrary.js', 'teachingBlueprints.js', 'examPaperBlueprints.js', 'validatorRules.js',
      'eduRenderContract.js', 'layoutSpec.js', 'expertKnowledge.js',
      'injectionManifest.js', 'programAttach.js', 'anchorTreeContract.js', 'promptOversize.js',
      'textbookCompression.js', 'themeConfig.js', 'useAiGenerator.js', 'analysisPrompts.js',
      'specialDomains.js', 'listeningExtractPrompt.js', 'listeningTranslatePrompt.js',
      'levelMapping.js', 'coverageContract.js',
    ];
    const missing = files.filter((f) => !led.includes(f));
    expect(missing, `台账漏登记来源：${missing.join('、')}`).toEqual([]);
    expect(led, '台账须有状态列（防"没登记就开工"）').toContain('未开始');
  });
});
