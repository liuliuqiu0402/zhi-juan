// 命题范围断言测试：单课/整单元/跨单元（期中/期末/月考/专题）命名 + 卷首标题拼装 + 避重
import { describe, it, expect } from 'vitest';
import {
  inferPaperScope, findCommonAncestorIndex,
  categorizeUnits, effectiveUnitIndices, buildScopeCandidates, EXPLICIT_SCOPE_TYPES, inferAcademicTerm,
} from '@/config/recipe/paperScope.js';

// 仿真教材目录：top 单元 → 课（叶子）
const outline = [
  {
    title: '第一单元',
    children: [
      { title: '第2课 观潮', start: 1, end: 5 },
      { title: '第3课 走月亮', start: 6, end: 10 },
    ],
  },
  {
    title: '第二单元',
    children: [{ title: '第5课 盘古开天地', start: 11, end: 15 }],
  },
];
const [u1, u2] = outline;
const [kecheng1, kecheng2] = u1.children;
const [kecheng3] = u2.children;

// 4 单元教材，每单元 2 课：q[0..1]→一单元, q[2..3]→二单元, q[4..5]→三单元, q[6..7]→四单元
const outline4 = ['第一单元', '第二单元', '第三单元', '第四单元'].map((t, i) => ({
  title: t,
  children: [0, 1].map(k => ({ title: `第${i + 1}组第${k + 1}课`, start: (i * 2 + k) * 10, end: (i * 2 + k) * 10 + 9 })),
}));
const q = outline4.flatMap(u => u.children); // 8 个课

describe('inferPaperScope —— 范围推断（对应命题老师勾选行为）', () => {
  it('选单课（1 个节点）→ 课名（非类型标签）', () => {
    const r = inferPaperScope([kecheng1], outline, 'default');
    expect(r.name).toBe('第2课 观潮');
    expect(r.isScopeLabel).toBe(false);
  });

  it('整个单元目录全选 → 单元名（最近公共祖先）', () => {
    const r = inferPaperScope([kecheng1, kecheng2], outline, 'default');
    expect(r.name).toBe('第一单元');
    expect(r.isScopeLabel).toBe(false);
  });

  it('跨单元多选（default）按覆盖自动判定', () => {
    // 只选前半段单元（4 单元教材选 1、2 单元）→ 期中
    const mid = inferPaperScope([q[0], q[2]], outline4, 'default');
    expect(mid.category).toBe('midterm');
    expect(['期中综合测试', '阶段综合测评', '中期学业检测']).toContain(mid.name);
    expect(mid.isScopeLabel).toBe(true);

    // 覆盖到最后一个单元（选 3、4 单元）→ 期末
    const fin = inferPaperScope([q[4], q[6]], outline4, 'default');
    expect(fin.category).toBe('final');
    expect(['期末综合测试', '学期综合测评', '期末学业检测']).toContain(fin.name);

    // 覆盖到中段但未到书末（选 2、3 单元，last=2<4首2?不成立且≠末）→ 综合
    const midSeg = inferPaperScope([q[2], q[4]], outline4, 'default');
    expect(midSeg.category).toBe('default');
    expect(midSeg.name).toBe('综合检测');
  });

  it('categorizeUnits —— 覆盖位置归类', () => {
    expect(categorizeUnits([q[0], q[3]], outline4)).toBe('midterm');  // 第1、2单元 前半段
    expect(categorizeUnits([q[0], q[2]], outline4)).toBe('midterm');  // 1、2单元 前半段
    expect(categorizeUnits([q[4], q[6]], outline4)).toBe('final');    // 3、4单元 覆盖到末
    expect(categorizeUnits([q[2], q[4]], outline4)).toBe('default');  // 2、3单元 中段
    expect(categorizeUnits([q[0]], outline4)).toBe('unit');           // 单单元
    expect(categorizeUnits([], outline4)).toBe('default');
  });

  it('期中（显式范围类型，跨单元多选）→ 期中标签', () => {
    const r = inferPaperScope([kecheng1, kecheng2, kecheng3], outline, 'midterm');
    expect(r.name).toBe('期中综合测试');
    expect(r.isScopeLabel).toBe(true);
  });

  it('期末 → 期末标签', () => {
    const r = inferPaperScope([kecheng1, kecheng3], outline, 'final');
    expect(r.name).toBe('期末综合测试');
    expect(r.isScopeLabel).toBe(true);
  });

  it('月考 → 月考标签（新增范围类型）', () => {
    const r = inferPaperScope([kecheng1, kecheng3], outline, 'monthly');
    expect(['月考检测', '月度综合测评', '月测卷']).toContain(r.name);
    expect(r.isScopeLabel).toBe(true);
  });

  it('专题 → 专题标签', () => {
    const r = inferPaperScope([kecheng1, kecheng3], outline, 'topic');
    expect(['专题过关', '专题训练', '专题测评']).toContain(r.name);
  });

  it('显式范围类型即使单课也尊重用户意图（选"期中"就出"期中"）', () => {
    const r = inferPaperScope([kecheng1], outline, 'midterm');
    expect(r.name).toBe('期中综合测试');
    expect(r.isScopeLabel).toBe(true);
  });

  it('范围标签词支持外部轮换 pickScope', () => {
    let i = 0;
    const pick = () => ['期中综合测试', '阶段综合测评', '中期学业检测'][i++ % 3];
    expect(inferPaperScope([kecheng1], outline, 'midterm', pick).name).toBe('期中综合测试');
    expect(inferPaperScope([kecheng1], outline, 'midterm', pick).name).toBe('阶段综合测评');
    expect(inferPaperScope([kecheng1], outline, 'midterm', pick).name).toBe('中期学业检测');
  });

  it('目录带教材根包装时，单单元内多选仍取单元名（LCA 在索引 1）', () => {
    // 顶层是"上册"包装节点：选中同一单元内两课 → LCA=该单元，而非"上册"
    const wrapped = [{ title: '上册', children: [u1, u2] }];
    const r = inferPaperScope([kecheng1, kecheng2], wrapped, 'default');
    expect(r.name).toBe('第一单元');
    expect(r.isScopeLabel).toBe(false);
  });

  it('跨单元多选在显式"期末"范围下 → 期末标签（override，不留目录根名）', () => {
    const wrapped = [{ title: '上册', children: [u1, u2] }];
    const r = inferPaperScope([kecheng1, kecheng3], wrapped, 'final');
    expect(r.name).toBe('期末综合测试');
    expect(r.isScopeLabel).toBe(true);
  });

  it('同一单元内多选 → 即使不在显式范围也取单元名', () => {
    const r = inferPaperScope([kecheng1, kecheng2], outline, '');
    expect(r.name).toBe('第一单元');
  });

  it('空选择 → 空范围（不报错）', () => {
    const r = inferPaperScope([], outline, 'default');
    expect(r.name).toBe('综合检测');
    expect(r.isScopeLabel).toBe(true);
  });

  it('语文园地与单元平级：勾选单元课文+园地 → 归并单元名（非跨单元误判）', () => {
    // 教材目录：第二单元（4 课）与语文园地二平级（顶层）
    const outlineWithYuanDi = [
      { title: '第二单元·识字', children: [
        { title: '1 场景歌' }, { title: '2 树之歌' }, { title: '3 拍手歌' }, { title: '4 田家四季歌' },
      ] },
      { title: '语文园地二', children: [{ title: '识字加油站' }, { title: '字词句运用' }] },
      { title: '第三单元', children: [{ title: '5 古诗二首' }] },
    ];
    const yuanDi = outlineWithYuanDi[1];
    const kecheng = outlineWithYuanDi[0].children;
    // 勾选单元下 4 课 + 语文园地 → 归并为"第二单元·识字"（不误判期中/综合）
    const r = inferPaperScope([...kecheng, yuanDi], outlineWithYuanDi, 'default');
    expect(r.name).toBe('第二单元·识字');
    expect(r.category).toBe('unit');
    expect(r.isScopeLabel).toBe(false);
    // effectiveUnitIndices：园地归并到第二单元（下标 0）
    expect(effectiveUnitIndices([...kecheng, yuanDi], outlineWithYuanDi)).toEqual([0]);
    // 真跨单元（第二单元+第三单元）仍走期中/期末/综合
    const cross = inferPaperScope([kecheng[0], outlineWithYuanDi[2]], outlineWithYuanDi, 'default');
    expect(cross.isScopeLabel).toBe(true);
    expect(cross.name).not.toBe('第二单元·识字');
  });

  it('只勾选语文园地 → 归并到前一个有效单元', () => {
    const outlineWithYuanDi = [
      { title: '第二单元·识字', children: [{ title: '1 场景歌' }] },
      { title: '语文园地二', children: [{ title: '识字加油站' }] },
    ];
    const r = inferPaperScope([outlineWithYuanDi[1]], outlineWithYuanDi, 'default');
    expect(r.name).toBe('第二单元·识字');
    expect(r.category).toBe('unit');
  });
});

describe('buildScopeCandidates —— 范围确认弹窗候选（按勾选内容提取）', () => {
  it('单元勾选：候选唯一为单元名（标题必须携带单元信息，不提供丢失范围的通用标签）', () => {
    const cs = buildScopeCandidates([kecheng1, kecheng2], outline, 'default');
    expect(cs).toHaveLength(1);
    expect(cs[0].value).toBe('第一单元');
    expect(cs[0].hint).toContain('单元');
    expect(cs.some(c => c.value === '综合检测')).toBe(false);
    expect(cs.some(c => c.value === '期中综合测试')).toBe(false);
    expect(cs.some(c => c.value === '期末综合测试')).toBe(false);
  });

  it('跨单元：候选为维度词（确认维度，具体名称由名称池组合；无重复）', () => {
    const cs = buildScopeCandidates([q[0], q[2]], outline4, 'default'); // 推断期中
    expect(cs[0].value).toBe('期中'); // 推断类别优先
    expect(cs.some(c => c.value === '期末')).toBe(true);
    expect(cs.some(c => c.value === '综合')).toBe(true);
    expect(cs.every((c, i) => cs.findIndex(x => x.value === c.value) === i)).toBe(true); // 去重
  });

  it('显式范围类型：维度已定，无需弹窗（返回空，名称由名称池组装时轮换）', () => {
    expect(buildScopeCandidates([kecheng1], outline, 'midterm')).toEqual([]);
    expect(buildScopeCandidates([kecheng1], outline, 'final')).toEqual([]);
    expect(buildScopeCandidates([kecheng1], outline, 'monthly')).toEqual([]);
  });

  it('单课：候选唯一为课名（不带标签备选）', () => {
    const cs = buildScopeCandidates([kecheng1], outline, 'default');
    expect(cs).toHaveLength(1);
    expect(cs[0].value).toBe('第2课 观潮');
    expect(cs.some(c => c.value === '综合检测')).toBe(false);
  });
});

describe('inferAcademicTerm —— 学年度学期推断（期中/期末/月考卷首前缀）', () => {
  it('9月-次年1月为第一学期（学年度从9月起算）', () => {
    expect(inferAcademicTerm(new Date(2025, 8, 15))).toBe('2025-2026学年度第一学期'); // 2025-09-15
    expect(inferAcademicTerm(new Date(2026, 0, 10))).toBe('2025-2026学年度第一学期'); // 2026-01-10
  });
  it('2月-8月为第二学期（8月暑假归第二学期末）', () => {
    expect(inferAcademicTerm(new Date(2026, 3, 20))).toBe('2025-2026学年度第二学期'); // 2026-04-20
    expect(inferAcademicTerm(new Date(2026, 7, 24))).toBe('2025-2026学年度第二学期'); // 2026-08-24
  });
});

describe('findCommonAncestorIndex', () => {
  it('同单元返回单元层节点', () => {
    const lca = findCommonAncestorIndex([kecheng1, kecheng2], outline);
    expect(lca.lcaIdx).toBe(0);
    expect(lca.node.title).toBe('第一单元');
  });
  it('跨单元返回 lcaIdx -1（无公共祖先）', () => {
    const lca = findCommonAncestorIndex([kecheng1, kecheng3], outline);
    expect(lca.lcaIdx).toBe(-1);
    expect(lca.node).toBe(null);
  });
  it('不足 2 节点返回 lcaIdx -1', () => {
    expect(findCommonAncestorIndex([kecheng1], outline).lcaIdx).toBe(-1);
  });
});

describe('EXPLICIT_SCOPE_TYPES 覆盖命题老师可选全集', () => {
  it('期中/期末/月考/专题均为显式范围类型', () => {
    expect(EXPLICIT_SCOPE_TYPES).toEqual(['midterm', 'final', 'monthly', 'topic']);
  });
});