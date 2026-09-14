// ✅ A22（2026-09-14 用户同意）：实发注入清单**单源**回归
// 背景：写作请求里除委托正文之外还有一堆块（锚点清单/压缩原文/素材使用约定/组织方式/模板对标/
//   情境框架/差异化/输出约定/尾约束×2），原先内联在 useAiGenerator.buildPrompt 里 → 面板看不到，
//   用户只看到委托正文，"实际发出去的是什么"成了黑盒。
// 本文件锁死：① 单源块文本与拼接顺序（逐字）；② 门控口径（无素材不注入素材约定/组织方式）；
//   ③ 生成端不得再内联这些块（防两套口径回归）；④ 面板消费同一份单源。
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildUserMessageBlocks, buildUserMessagePrompt,
  buildAnchorListBlock, buildCompressedTextBlock,
  buildMaterialUsageBlock, buildOrganizeBlock,
  buildTemplateInfoBlock, buildContextBlock, buildDiffRegenBlock, buildOutputBlock, buildTailBlocks,
  TAIL_SELF_CONSISTENCY, SCENE_REGEN_TYPES,
} from '../../src/utils/injectionManifest.js';

const ROOT = path.resolve(__dirname, '../..');

// 🔬 (b) 第二步（分析层）：条目性质 kind 的契约与透传。旧分析结果缺该字段 → 一律按 knowledge 处理，
//    即"未重跑分析前行为与分流前完全一致"（安全无害）。
describe('(b) 分析层 kind 契约', () => {
  it('层级图谱 schema 给出 kind 字段与判据（全学科统一）', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src/composables/useAiGenerator.js'), 'utf8');
    // ⚠️ 同源两分支：同一个 analysisPrompt 按 isGuidePage 分「导语页版 / 正文页版」，
    //    两分支的 schema 都必须带 kind —— 2026-09-14 实测只改了正文版，而用户分析的正是导语页
    //    → 模型收不到 kind，`kind` 全链路为空（这次踩的坑，锁死两处必须都在）
    const branches = src.split('"kind": "knowledge|material"').length - 1;
    expect(branches, '导语页版与正文页版两个 schema 分支都要带 kind').toBe(2);
    expect(src, 'schema 须含 kind 字段').toContain('"kind": "knowledge|material"');
    expect(src, '须给一句可判定的判据').toContain('能不能直接变成一道题的考查点');
    expect(src, '须声明缺字段的向后兼容口径').toContain('kind 缺失时一律按 knowledge 处理');
    expect(src, '另一条图谱 prompt 须同步').toContain('核心知识点[knowledge|material](≤6)');
  });

  it('锚树归一透传 kind（双轨判定：显式 kind 优先 + 名字兜底）', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src/utils/coverageAnchor.js'), 'utf8');
    expect(src).toContain('kind: resolveAnchorKind({ name: ck.name, kind: ck.kind })');
    // 生成端"随卡锚树"投影同样不得漏传（曾在此把 kind 筛掉 → 分流永远拿不到）
    const gen = fs.readFileSync(path.join(ROOT, 'src/composables/useAiGenerator.js'), 'utf8');
    expect(gen).toContain('kind: resolveAnchorKind({ name: ck.name, kind: ck.kind })');
  });
});

describe('buildUserMessagePrompt（实发拼接：顺序 + 逐字）', () => {
  const full = {
    genType: 'practice', subject: '数学', materialChannel: 'full',
    anchorListText: '第一章\n· 知识点甲', compressedText: '原文片段……',
    instructionText: '【角色】课时练（委托正文）',
    templateInfo: '模板A 原文', contextFramework: '情境框架X',
    diffKps: ['甲', '乙'], outputMode: 'split',
  };

  it('顺序与逐字：清单→原文→素材约定→组织方式→委托正文→对标→情境→差异化→输出约定→尾约束×2', () => {
    expect(buildUserMessagePrompt(full)).toBe(
      buildAnchorListBlock(full.anchorListText)
      + buildCompressedTextBlock(full.compressedText)
      + buildMaterialUsageBlock({ genType: 'practice', materialChannel: 'full' })
      + buildOrganizeBlock('practice')
      + full.instructionText
      + buildTemplateInfoBlock(full.templateInfo)
      + buildContextBlock(full.contextFramework)
      + buildDiffRegenBlock({ genType: 'practice', diffKps: full.diffKps })
      + buildOutputBlock({ subject: '数学', genType: 'practice', outputMode: 'split' })
      + buildTailBlocks().join(''),
    );
  });

  it('无素材 → 素材使用约定/组织方式均不注入（既有门控口径不变）；尾约束照旧', () => {
    const p = buildUserMessagePrompt({ genType: 'exam', subject: '语文', materialChannel: 'full', outputMode: 'once' });
    expect(p).not.toContain('【素材使用约定】');
    expect(p).not.toContain('【组织方式】');
    expect(p).toContain('【尾约束·全文自洽】');
    expect(p).toContain('【尾约束·资料内多样】');
  });

  it('差异化仅题类注入（内容型无情境设问不注入）', () => {
    expect(buildUserMessagePrompt({ genType: 'summary', diffKps: ['甲'], materialChannel: 'full', outputMode: 'once' }))
      .not.toContain('【差异化要求（复生成）】');
    expect(SCENE_REGEN_TYPES).toEqual(['exam', 'practice', 'special', 'reading']);
  });

  it('模板对标/情境框架 为空则不注入', () => {
    expect(buildTemplateInfoBlock('')).toBe('');
    expect(buildTemplateInfoBlock('   ')).toBe('');
    expect(buildContextBlock('')).toBe('');
  });

  it('锚点清单块：角色说明可传入（第3层关闭时用不带该句的版本，防假指针）', () => {
    const custom = '说明：清单只给知识点，本次不括注具体概念。';
    expect(buildAnchorListBlock('第一章\n· 甲', custom)).toContain(custom);
    expect(buildAnchorListBlock('第一章\n· 甲', custom)).not.toContain('（第3层）');
    expect(buildAnchorListBlock('第一章\n· 甲')).toContain('（第3层）'); // 默认仍带第3层说明
  });
});

describe('各块文本口径（防漂移的逐字锚点）', () => {
  it('组织方式：exam 引【卷面结构】、其余引【教辅结构】', () => {
    expect(buildOrganizeBlock('exam')).toBe('【组织方式】输出一律以委托书【卷面结构】的大题序列组织（大题名、顺序、题量以委托书为准）；开头【锚点清单】只声明覆盖范围，不是组织方式，不得据此替代委托书结构。\n\n');
    expect(buildOrganizeBlock('practice')).toContain('【教辅结构】的栏目序列组织（栏目名、顺序、题量以委托书为准）');
  });

  it('素材使用约定：通道分流（依据指向随通道改），禁照搬为通道无关', () => {
    const anchor = buildMaterialUsageBlock({ genType: 'practice', materialChannel: 'anchor' });
    expect(anchor).toContain('开头【锚点清单】（含各知识点具体概念）是理解教材内容、难度与版本口径的**依据**');
    expect(anchor).toContain('题型结构、知识梯度与难度按上方清单（含具体概念）把握');
    const full = buildMaterialUsageBlock({ genType: 'practice', materialChannel: 'full' });
    expect(full).toContain('中段【压缩原文】是理解教材内容与难度的**参考之一**');
    // 🔴 2026-09-14（用户裁定·实测产物）：禁照搬原句原先挂在【压缩原文】上 → 锚清单通道整句被跳过 →
    //    该通道下没有任何禁止照搬的约束，模型整段沿用教材语篇（照搬守门命中 10 词连续重合）。
    //    现锁死：命题型禁照搬**两通道都在**，并声明清单里的语篇类条目不作命题依据。
    //    🔴 用词红线：**不得用"载体"表示题目素材**——同一份提示词里"载体"专指作答载体/书写载体
    //    （书写载体协议、一个空位只写一种载体…），混用会让模型把"不作题目载体"误当作答载体条款。
    for (const t of [anchor, full]) {
      expect(t).toContain('不得照搬教材原题');
      expect(t).toContain('不得直接复用所选教材原有语篇的情节、篇目结构与人物设定');
      expect(t).toContain('只作理解与难度依据，不列入覆盖单位');
      expect(t).toContain('连续重合即属照搬');
      expect(t, '禁用"载体"表示题目素材').not.toContain('题目载体');
    }
  });

  it('素材使用约定：覆盖下限按 mode 分档、能否加按 extentOf 分档', () => {
    // practice = per-lesson-full + expand
    const practice = buildMaterialUsageBlock({ genType: 'practice', materialChannel: 'full' });
    expect(practice).toContain('**至少要全部覆盖到**');
    expect(practice).toContain('清单**不是命题上限**');
    expect(practice).toContain('本资料为命题/练习型');
    // summary = full + integrate（归纳型口吻）
    const summary = buildMaterialUsageBlock({ genType: 'summary', materialChannel: 'full' });
    expect(summary).toContain('**须全部覆盖到**');
    expect(summary).toContain('清单**不是范围围墙**');
    expect(summary).toContain('本资料为知识归纳型');
    expect(summary).not.toContain('本资料为命题/练习型');
    // errorbook = none + expand（不对账口吻）
    const err = buildMaterialUsageBlock({ genType: 'errorbook', materialChannel: 'anchor' });
    expect(err).toContain('本资料围绕错题组织，不与开头【锚点清单】做覆盖对账；');
  });

  it('尾约束×2：块内自带 \\n\\n 前缀，关键句逐字', () => {
    const [self, variety] = buildTailBlocks();
    expect(self.startsWith('\n\n【尾约束·全文自洽】\n')).toBe(true);
    expect(self).toContain('使本题**仅凭正文自身即可完成**');
    expect(variety.startsWith('\n\n【尾约束·资料内多样】\n')).toBe(true);
    expect(variety).toContain('同一份资料内各栏目呈现形式与组织顺序应有所差异，不得全份同类版式照搬');
    expect(TAIL_SELF_CONSISTENCY).toBe(self.slice(2));
  });

  it('输出约定：once/split 不同，且随自包含教辅分档', () => {
    const once = buildOutputBlock({ subject: '语文', genType: 'exam', outputMode: 'once' });
    const split = buildOutputBlock({ subject: '语文', genType: 'exam', outputMode: 'split' });
    expect(once).toContain('【输出约定】');
    expect(once).not.toBe(split);
    // 自包含教辅（summary）走"答案区仅逐题作答"口径，非自包含（exam）不含该句
    expect(buildOutputBlock({ subject: '语文', genType: 'summary', outputMode: 'once' }))
      .toContain('答案区仅逐题作答');
    expect(once).not.toContain('答案区仅逐题作答');
  });
});

describe('buildUserMessageBlocks（面板清单）', () => {
  it('块 id 顺序与实发顺序一致，共 11 块', () => {
    expect(buildUserMessageBlocks({ genType: 'practice', subject: '数学', materialChannel: 'anchor' }).map((b) => b.id))
      .toEqual(['anchor-list', 'compressed-text', 'material-usage', 'organize', 'instruction',
        'template-info', 'context-framework', 'diff-regen', 'output-convention', 'tail-self', 'tail-variety']);
  });

  it('injected 只认门控结果（预览文本不影响"本次是否注入"）', () => {
    const noMaterial = buildUserMessageBlocks({ genType: 'practice', subject: '数学', materialChannel: 'anchor', preview: true });
    const usage = noMaterial.find((b) => b.id === 'material-usage');
    expect(usage.injected).toBe(false);
    expect(usage.text).toContain('【素材使用约定】');  // 预览：条款文本可先行展示
    expect(noMaterial.find((b) => b.id === 'tail-self').injected).toBe(true);

    const withMaterial = buildUserMessageBlocks({
      genType: 'practice', subject: '数学', materialChannel: 'anchor',
      anchorListText: '第一章\n· 知识点甲',
    });
    expect(withMaterial.find((b) => b.id === 'material-usage').injected).toBe(true);
    expect(withMaterial.find((b) => b.id === 'anchor-list').injected).toBe(true);
  });

  it('非预览模式不产出任何预览文本（生成端拼接不受影响）', () => {
    const blocks = buildUserMessageBlocks({ genType: 'practice', subject: '数学', materialChannel: 'anchor' });
    expect(blocks.find((b) => b.id === 'material-usage').text).toBe('');
    expect(blocks.find((b) => b.id === 'organize').text).toBe('');
  });

  // 🔴 A22 补：生成期在委托正文末尾追加的【组织风格】/【差异化要求——本类型为…】既不在注入框里、
  //    也不属程序附加段——面板若不言明，"看到的=发出去的"就有缺口。
  it('委托正文块：生成期追加项须在面板如实说明（虚框+说明，不重复展开正文）', () => {
    const extra = '生成期会在本块末尾追加【组织风格】「情境统一」及其实施说明';
    const blk = buildUserMessageBlocks({
      genType: 'practice', subject: '数学', materialChannel: 'anchor', instructionExtraNote: extra,
    }).find((b) => b.id === 'instruction');
    expect(blk.note).toContain(extra);
    expect(blk.note).toContain('即上方注入框内容');   // 原有说明保留
    expect(blk.text).toBe('');                        // pointer：不重复展开委托正文
    expect(blk.injected).toBe(true);                  // 委托正文必发

    // 无追加项时不产生多余文案
    const plain = buildUserMessageBlocks({ genType: 'practice', subject: '数学', materialChannel: 'anchor' })
      .find((b) => b.id === 'instruction');
    expect(plain.note).toBe('即上方注入框内容（已按素材通道归一）；此处不重复展开');
  });
});

describe('源码接线：生成端不再内联这些块（防两套口径回归）', () => {
  const ai = () => fs.readFileSync(path.join(ROOT, 'src', 'composables', 'useAiGenerator.js'), 'utf8');
  const gm = () => fs.readFileSync(path.join(ROOT, 'src', 'modules', 'GenerateModule.vue'), 'utf8');

  it('生成端从 injectionManifest 单源导入并调用', () => {
    const s = ai();
    expect(s).toContain("from '../utils/injectionManifest.js'");
    expect(s).toContain('buildMaterialUsageBlock({ genType, materialChannel })');
    expect(s).toContain('buildOrganizeBlock(genType)');
    expect(s).toContain('buildTailBlocks()[0]');
    expect(s).toContain('buildTailBlocks()[1]');
    expect(s).toContain('buildAnchorListBlock(anchorListText,');
    expect(s).toContain('buildCompressedTextBlock(compressedText)');
  });

  it('生成端已无内联副本（旧变量/字面量不得回归）', () => {
    const s = ai();
    for (const gone of [
      'const coverageFloor', 'const coverageExtent', 'const refClause', 'const structRef',
      '【尾约束·全文自洽】\n题干所声明的', '【尾约束·资料内多样】\n同一份资料内',
      'PAPER_OUTPUT_CONVENTIONS.once(', 'PAPER_OUTPUT_CONVENTIONS.split(',
      'const SELF_CONTAINED_TEACHING =',
    ]) expect(s).not.toContain(gone);
  });

  it('面板消费同一份单源：申请实发清单四入口刷新 + 逐段可点', () => {
    const s = gm();
    expect(s).toContain("from '../utils/injectionManifest.js'");
    // 组装 / 恢复默认 / 生成前刷新 / 🧾(ii) 生成后刷新（让"刚发出去的那一份"立刻可见）
    expect((s.match(/refreshUserMsgBlocks\(\{/g) || [])).toHaveLength(4);
    expect(s).toContain('data-um');
    expect(s).toContain('onUserMsgClick');
  });

  it('面板把"生成期追加项"交代清楚（组织风格 / 本类型差异化）', () => {
    const s = gm();
    expect(s).toContain('instructionExtraNote');
    expect(s).toContain('生成期会在本块末尾追加【组织风格】');
    expect(s).toContain('【差异化要求——本类型为…】');
  });

  it('第3层开关接线：生成端按设置渲染清单与角色说明（面板同步反映）', () => {
    const s = ai();
    expect(s).toContain('apiConfig.generationSettings.injectThirdLayer');
    expect(s).toContain('formatAnchorListByChapter(anchors, { withConcepts: injectThirdLayer, splitMaterial })');
    expect(s).toContain('anchorListRoleNote({ withConcepts: injectThirdLayer, splitMaterial })');
    expect(s).toContain('const splitMaterial = contractOf(genType).mode !== \'full\'');
    expect(gm()).toContain('injectThirdLayer');
  });

  it('生成端拼接顺序与单源 BLOCK_DEFS 一致（顺序漂移同样会被逮住）', () => {
    const s = ai();
    const order = [
      'buildAnchorListBlock(anchorListText,',
      'buildCompressedTextBlock(compressedText)',
      'buildMaterialUsageBlock({ genType, materialChannel })',
      'buildOrganizeBlock(genType)',
      'applyMaterialChannel(instruction, materialChannel).trim()', // 委托正文（末尾锚定）
      'buildTemplateInfoBlock(templateInfo)',
      'buildContextBlock(contextFramework)',
      'buildDiffRegenBlock({ genType, diffKps })',
      'buildOutputBlock({ subject, genType, outputMode: generateMode })',
      'buildTailBlocks()[0]',
      'buildTailBlocks()[1]',
    ];
    const idx = order.map((k) => s.indexOf(k));
    expect(idx.every((i) => i >= 0)).toBe(true);
    expect(idx).toEqual([...idx].sort((a, b) => a - b)); // 严格递增 = 与实发顺序一致
  });
});

// 🧾 (ii) 2026-09-14 用户同意：面板"请求实发清单"接**实发素材正文**（所见即所发）。
// 背景：面板原先对【锚点清单】/【压缩原文】只显示"有素材就会注入"的说明、正文不可见 →
//   用户无法核对"到底发了什么"（排查"拽向原文"时只能靠猜）。
// 口径：生成端在拼 prompt 的**同一处**写入实发快照（写入值=实发文本用的同一变量），
//   面板只读取展示；🔴 面板**不得自行拼装**清单——两套拼装必漂移，正是 A20/A21/A22 治理的对象。
describe('(ii) 面板接实发素材正文（快照单源）', () => {
  const ai = () => fs.readFileSync(path.join(ROOT, 'src', 'composables', 'useAiGenerator.js'), 'utf8');
  const gm = () => fs.readFileSync(path.join(ROOT, 'src', 'modules', 'GenerateModule.vue'), 'utf8');

  it('生成端：在拼 prompt 的同一处写快照，取的就是实发用的那两个变量', () => {
    const s = ai();
    expect(s).toContain('export const lastInjectSnapshot = ref(null)');
    expect(s).toContain('export const chapterSigOf');
    const iAnchor = s.indexOf('buildAnchorListBlock(anchorListText, anchorListRoleNoteText)');
    const iComp = s.indexOf('buildCompressedTextBlock(compressedText)');
    const iSnap = s.indexOf('lastInjectSnapshot.value = {');
    expect(iAnchor, '清单块拼装点须存在').toBeGreaterThan(-1);
    expect(iComp, '原文块拼装点须存在').toBeGreaterThan(iAnchor);
    // 快照写在两块**之后**（此时两个变量已是最终实发值；顺序反了就会存到半成品）
    expect(iSnap, '快照须写在两块拼装之后').toBeGreaterThan(iComp);
    const snapBody = s.slice(iSnap, s.indexOf('};', iSnap));
    for (const f of ['anchorListText,', 'roleNote: anchorListRoleNoteText,', 'compressedText,', 'chapters: chapterSigOf(selectedBooks)']) {
      expect(snapBody, `快照须含 ${f}`).toContain(f);
    }
    // 暴露给面板（面板只读）
    expect(s).toContain('lastInjectSnapshot,'); // return 对象
  });

  it('面板：只读快照、不自行拼装清单（不得出现 formatAnchorListByChapter）', () => {
    const s = gm();
    expect(s).toContain('lastInjectSnapshot');
    expect(s).toContain('anchorListText: snapHit?.anchorListText');
    expect(s).toContain('compressedText: snapHit?.compressedText');
    expect(s, '面板不得自行拼装清单（两套拼装必漂移）').not.toContain('formatAnchorListByChapter');
  });

  it('面板展示的清单正文 = 生成端实发正文（同一 build 函数 + 同一角色说明）', () => {
    const body = '一、知识主题甲\n· 知识点一\n◇ 语言材料（只作理解与难度依据，不在覆盖单位之列）：故事板块';
    const roleNote = '（第3层）…实发角色说明';
    const blk = buildUserMessageBlocks({
      genType: 'practice', subject: '英语', materialChannel: 'anchor',
      anchorListText: body, anchorListRoleNote: roleNote,
      materialProvenance: '以下为最近一次生成的实发原文（09-14 17:20 生成）。',
    }).find((b) => b.id === 'anchor-list');
    expect(blk.text).toBe(buildAnchorListBlock(body, roleNote)); // 与实发块逐字相同
    expect(blk.text).toContain('◇ 语言材料');                    // 清单正文确实可见（可核对分流）
    expect(blk.note).toContain('以下为最近一次生成的实发原文');
    expect(blk.injected).toBe(true);
  });

  it('角色说明按实发取：第3层关闭时面板不显示默认版那句（防假指针）', () => {
    const body = '一、主题甲\n· 知识点一';
    const off = '说明：本次不括注具体概念。';
    const blk = buildUserMessageBlocks({
      genType: 'practice', subject: '数学', materialChannel: 'anchor',
      anchorListText: body, anchorListRoleNote: off, injectThirdLayer: false,
    }).find((b) => b.id === 'anchor-list');
    expect(blk.text).toContain(off);
    expect(blk.text).not.toContain('（第3层）'); // 实发没有这句，面板就不许有
  });

  it('无快照/类型不符 → 不展示正文，只给来源说明（宁可不显示，也不显示错的口径）', () => {
    const none = buildUserMessageBlocks({
      genType: 'practice', subject: '数学', materialChannel: 'anchor',
      materialProvenance: '尚未生成过：生成一次后，此处显示实际发出的清单/原文正文。',
    });
    const al = none.find((b) => b.id === 'anchor-list');
    expect(al.text).toBe('');
    expect(al.injected).toBe(false);
    expect(al.note).toContain('尚未生成过');
    // 压缩原文块同样接来源说明（全文通道下它是素材主体）
    expect(none.find((b) => b.id === 'compressed-text').note).toContain('尚未生成过');
  });
});
