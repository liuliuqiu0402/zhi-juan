// 🔒 常驻守卫：跨学科背景须为解题所需·不作拼盘（2026-10-14 属主解锁 §八 净字方案）
// ============================================================
// 背景：属主质询"跨学科须内在打通（防拼盘）"能否落成判据。落点为【质量底线】（**全类型注入块**，唯一自然落点），
//   做法＝**同块内**收口真冗余换入本句（**净 0 只在单处可收；本轮为保措辞完整，多收两处**）：
//     · 收口（−18）＝① 删"要点落到优先"条里的"以能力/素养点为纲，"——它与"命题立意"条
//       "以课程标准的**能力/素养要求**为纲"**同义重复**（同一个"纲"说了两遍，−10）；
//       ② 删同条"（不算注水）"括注（−6，判据"属必要内容"自含）；
//       ③ 删"正文直入：正文直接呈现内容本身"里的重字"正文"（−2，术语"正文直入"已表意）。
//     · 换入（+17）＝"知识与能力要求符合本学段课标…"条尾附"；跨学科背景须为解题所需，不作拼盘"。
//   ⇒ **净 −1**，过 `promptGrowthGuard`（防"打补丁叠加"）。
// 本守卫锁三件事：① 判据**全类型**在场；② 所在条完整且原有判据未被删（防"删概念以过守卫"）；
//   ③ 原句要点不得回潮（同上收口位不得重新长出冗余）。
import { describe, it, expect } from 'vitest';
import { getPromptTemplate } from '../../src/config/promptLibrary.js';

const TPL = (genType, subject = '语文', grade = '六年级') =>
  String(getPromptTemplate({ grade, subject, genType }).template || '');
const TYPES = ['exam', 'practice', 'special', 'preview', 'reading', 'summary', 'dictation', 'errorbook', 'review'];
const LINE_OF = (t, token) => t.split('\n').find((l) => l.includes(token)) || '';
const PROBE = '跨学科背景须为解题所需，不作拼盘';

describe('跨学科背景须为解题所需·不作拼盘（质量底线 · 全类型注入）', () => {
  it('9 类型均在场（质量底线为全类型注入块）', () => {
    const miss = TYPES.filter((g) => !TPL(g).includes(PROBE));
    expect(miss, `以下类型缺跨学科判据：${miss.join(',')}`).toEqual([]);
  });

  it('判据落在"知识与能力要求符合本学段课标"条尾，且原有判据未被删', () => {
    const ln = LINE_OF(TPL('exam'), PROBE);
    expect(ln, '须落在知识与能力要求条').toContain('符合本学段课标');
    expect(ln, '判据不得被删（不超学段仍在）').toContain('不超学段');
    expect(ln, '判据不得被删（不偏离主题与范围仍在）').toContain('不偏离本资料主题与范围');
  });

  it('收口项不得回潮：命题立意条的"以…为纲"单源仍在，同块不再复述', () => {
    const t = TPL('exam');
    expect(t, '命题立意条的"以…为纲"单源仍在').toContain('以课程标准的**能力/素养要求**为纲');
    expect(t, '重复的"以能力/素养点为纲"不得回潮（同块同义重复）').not.toContain('以能力/素养点为纲');
    expect(t, '去数量驱动的判据不得被误删').toContain('不以要点数量驱动出题');
    expect(t, '正文直入的判据不得被误删').toContain('正文直入：直接呈现内容本身');
  });

  it('不指名学科/学段（防跨学科广播）', () => {
    const ln = LINE_OF(TPL('exam'), PROBE);
    for (const w of ['物理', '化学', '生物', '历史', '地理', '数学', '语文', '英语']) {
      expect(ln, `不得点名学科"${w}"`).not.toContain(w);
    }
  });
});

