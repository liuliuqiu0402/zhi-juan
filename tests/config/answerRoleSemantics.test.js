// 2026-09-10 修订：答案页角色措辞回归
// ANSWER_ROLES.other 默认分支定为"解析下限"：需解析情形（依据/易混/推理/开放性）必须附简要解析，
// 整份答案区不得完全没有解析；仅无讲解价值的机械作答题可只给答案（不注水纪律保留）。
// 背景：旧"是否附解析由模型自行判断"的语义自决被整卷读成"一律不写"（用户实证：整卷零解析不可接受）。
import { describe, it, expect } from 'vitest';
import { ANSWER_ROLES } from '../../src/config/promptLibrary.js';

describe('ANSWER_ROLES 答案页角色措辞（2026-09）', () => {
  it('other 默认分支（题类教辅）：解析下限——需解析情形必须附、整卷不得零解析', () => {
    const role = ANSWER_ROLES.other('practice');
    expect(role).toContain('参考答案与解析');
    expect(role).toContain('必须附');
    expect(role).toContain('不得完全没有解析');
    expect(role).toContain('点到即止');
    expect(role).toContain('不为凑解析而每题都写');
    expect(role).not.toContain('自行判断'); // 旧"语义自决"措辞已被"解析下限"取代（模型把它读成"可以都不写"）
    expect(role).not.toContain('客观题给出正确答案'); // 旧措辞已去除（曾被读成客观题一律免解析）
  });

  it('其他分支语义保留：errorbook 归因、summary 类不复述正文、exam 评分标准', () => {
    expect(ANSWER_ROLES.other('errorbook')).toContain('错误归因');
    expect(ANSWER_ROLES.other('summary')).toContain('严禁');
    expect(ANSWER_ROLES.exam('语文')).toContain('评分标准');
  });
});
