// 2026-09：答案页角色措辞回归
// ANSWER_ROLES.other 默认分支改为"语义自决"：不硬性要求每题带解析，也不放行"客观题一律免解析"，
// 由模型按"答案能否直接判定正误 / 是否有依据·易混·推理·开放性需要说明"自行决定是否附简要解析。
import { describe, it, expect } from 'vitest';
import { ANSWER_ROLES } from '../../src/config/promptLibrary.js';

describe('ANSWER_ROLES 答案页角色措辞（2026-09）', () => {
  it('other 默认分支（题类教辅）：语义自决，不锁定题型清单', () => {
    const role = ANSWER_ROLES.other('practice');
    expect(role).toContain('参考答案与解析');
    expect(role).toContain('自行判断');
    expect(role).toContain('点到即止');
    expect(role).toContain('不为凑解析而每题都写');
    expect(role).not.toContain('客观题给出正确答案'); // 旧措辞已去除（曾被读成客观题一律免解析）
  });

  it('其他分支语义保留：errorbook 归因、summary 类不复述正文、exam 评分标准', () => {
    expect(ANSWER_ROLES.other('errorbook')).toContain('错误归因');
    expect(ANSWER_ROLES.other('summary')).toContain('严禁');
    expect(ANSWER_ROLES.exam('语文')).toContain('评分标准');
  });
});
