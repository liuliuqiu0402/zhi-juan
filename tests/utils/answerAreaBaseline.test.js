// 🔴 2026-09-29（用户裁定）：改造 2k / 2j 系列的"补差跳过判据"（题型词 → 形态判据）**之前**，
//   先把"不该补的类**一律不补**"钉成硬断言——这是"不多补 / 成稿不变差"的机械拦截。
//   说明：本仓库测试配置**不允许写入快照**（`vitest run` 判缺失快照为失败），故不用 snapshot，
//   改为**显式不变量**：① 已自带载体/纯内容栏/结构性题型 → 一律 0（补了就是噪音+成稿变差）；
//   ② 明确需要作答空间的类（阅读主观题、无分值整题）→ 必须 >0（防"该补未补"）。
//   改造判据时若破坏上述任一条，本文件即转红。
import { describe, it, expect } from 'vitest';
import { auditExamPaper } from '../../src/utils/examValidator.js';

const n = (h, re) => (h.match(re) || []).length;
const pad = (h) => n(h, /blank-line/g) + n(h, /blank-area/g);
const run = (html, opts) => auditExamPaper(html, opts).html;

const YW_LOW = { subject: '语文', stage: 'primary_low', genType: 'exam' };

describe('补差不变量：不该补的一律不补（改造跳过判据的拦截）', () => {
  it('选择题·题干已带括号空位 → 不补', () => {
    const h = run('<h2>一、选择（共2题，每题2分，共4分）</h2><p>1. 甲（　）</p><p>A. x B. y</p><p>2. 乙（　）</p><p>A. x B. y</p>', YW_LOW);
    expect(pad(h), '已带作答位还补 = 噪音').toBe(0);
  });

  it('填空·题干已带下划线空位 → 不补', () => {
    const h = run('<h2>四、填空（共1题，共4分）</h2><p>1. 水会变成<u class="blank-3">&emsp;</u>。</p>', YW_LOW);
    expect(pad(h)).toBe(0);
  });

  it('连线·已带连线载体 → 不补', () => {
    const h = run('<h2>三、连线（共1题，共4分）</h2><p>1. 把左右两边连起来。</p><ul class="match-question"><li>甲</li><li>乙</li></ul>', YW_LOW);
    expect(pad(h)).toBe(0);
  });

  it('纯内容栏（无题号、无作答要求）→ 不补', () => {
    const h = run('<h2>四、词语积累</h2><p>“瑰丽”“富饶”“成群结队”。</p>', YW_LOW);
    expect(pad(h)).toBe(0);
  });

  it('判断·题面未写"作答位所"（老式写法）→ 维持不补（不得因改造判据而多补成稿变差）', () => {
    const h = run('<h2>二、判断（共1题，共2分）</h2><p>1. 判断下面说法的对错。</p>', YW_LOW);
    expect(pad(h), '无作答位所的老式判断题，补行 = 成稿多出空白').toBe(0);
  });
});

describe('补差不变量：该补的必须补（防"该补未补"）', () => {
  it('语文·阅读主观题（有分值、无载体）→ 必须补且不超学段上限', () => {
    const h = run('<h2>八、阅读（共1题，共6分）</h2><p>1. 读短文，回答问题。</p>', YW_LOW);
    expect(pad(h), '主观题应有作答空间').toBeGreaterThan(0);
    expect(pad(h), '不得超过低段单题上限 4').toBeLessThanOrEqual(4);
  });

  it('教辅·无分值整题 → 按规格库兜底补且不超上限', () => {
    const h = run('<h2>一、积累与运用</h2><p>1. 读一读，写一写。</p>', YW_LOW);
    expect(pad(h)).toBeGreaterThan(0);
    expect(pad(h)).toBeLessThanOrEqual(4);
  });

  it('英语·阅读主观题（高中）→ 必须补且不超高中学段上限 8', () => {
    const h = run('<h2>一、阅读（共1题，共10分）</h2><p>1. 根据短文回答问题。</p>', { subject: '英语', stage: 'high', genType: 'exam' });
    expect(pad(h)).toBeGreaterThan(0);
    expect(pad(h)).toBeLessThanOrEqual(8);
  });
});

// 🔴 2026-09-29：**题型词类**的现状基线——这些类今天因"题型词判据"被跳过（不补）。
//   本组的作用：把"删掉题型词判据"这步**必须在有拦截的情况下做**——若删后这些类**静默多补**（成稿多出空白），
//   本组立即转红。⚠️ 若其中某类经 L2 复评**确应补**（题面明确要求作答却无载体），须**先改本组断言并注明理由**，
//   不得直接删判据了事。
describe('补差不变量：题型词类的现状基线（删题型词判据前的拦截）', () => {
  const CASES = [
    ['照样子写句子', '<h2>五、照样子写句子（共1题，共4分）</h2><p>1. 照样子，写一句话。</p>', YW_LOW],
    ['口算·直接写得数', '<h2>六、口算（共1题，共6分）</h2><p>1. 直接写得数：7＋8＝</p>', { subject: '数学', stage: 'primary_low', genType: 'exam' }],
    ['选词填空', '<h2>九、选词填空（共1题，共4分）</h2><p>1. 选词填空：美丽　漂亮</p>', YW_LOW],
    ['圈出', '<h2>十、圈一圈（共1题，共3分）</h2><p>1. 圈出正确的读音。</p>', YW_LOW],
    ['归类', '<h2>十一、归类（共1题，共4分）</h2><p>1. 把下面的词语归类。</p>', YW_LOW],
    ['仿写', '<h2>十二、仿写（共1题，共4分）</h2><p>1. 仿写句子。</p>', YW_LOW],
  ];
  for (const [name, html, opts] of CASES) {
    it(`${name} → 现状不补（0；改造判据后如要改须先改本断言并注明理由）`, () => {
      expect(pad(run(html, opts)), `${name} 现状应为 0（题型词跳过）`).toBe(0);
    });
  }
});
