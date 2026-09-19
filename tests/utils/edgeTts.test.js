import { describe, it, expect } from 'vitest';
import { mapSegmentsForEdge } from '../../src/utils/edgeTts.js';

/**
 * Edge 免费语音通道（2026-09-19）
 * 锁定：storyboard 段 → 主进程逐句合成所需最小字段的映射（voice/text/ratePercent/gapAfterMs/chimeBefore）；
 *        只透传清晰字段，空白段、非法数值一律过滤/钳制，防止脏 payload 进主进程。
 */
describe('mapSegmentsForEdge：段映射与字段净化', () => {
  it('映射 voice/text/ratePercent/gapAfterMs/chimeBefore 五字段，语速四舍五入', () => {
    const out = mapSegmentsForEdge([{
      voice: 'en-US-GuyNeural', text: 'Hello.', ratePercent: -13.33, gapAfterMs: 8000, chimeBefore: true,
    }]);
    expect(out[0]).toEqual({
      voice: 'en-US-GuyNeural', text: 'Hello.', ratePercent: -13, gapAfterMs: 8000, chimeBefore: true,
    });
  });

  it('chimeBefore 未给/非 true 一律归一为 false（主进程只认严格的 true）', () => {
    expect(mapSegmentsForEdge([{ voice: 'en-US-GuyNeural', text: 'A.', gapAfterMs: 0 }])[0].chimeBefore).toBe(false);
    expect(mapSegmentsForEdge([{ voice: 'en-US-GuyNeural', text: 'B.', gapAfterMs: 0, chimeBefore: 1 }])[0].chimeBefore).toBe(false);
  });

  it('intro 段 ratePercent=0 保留原样（自然语流），不误改', () => {
    const out = mapSegmentsForEdge([{
      voice: 'zh-CN-XiaoxiaoNeural', text: '现在开始听力。', ratePercent: 0, gapAfterMs: 1500,
    }]);
    expect(out[0].ratePercent).toBe(0);
    expect(out[0].text).toBe('现在开始听力。');
  });

  it('空白段被过滤；非法 ratePercent/gapAfterMs 钳制为安全默认', () => {
    const out = mapSegmentsForEdge([
      { voice: 'en-US-AriaNeural', text: '   ', ratePercent: 10, gapAfterMs: 500 },
      { voice: 'en-US-GuyNeural', text: 'Read.', ratePercent: Number.NaN, gapAfterMs: -10 },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe('Read.');
    expect(out[0].ratePercent).toBe(0); // NaN → 不干预语速
    expect(out[0].gapAfterMs).toBe(0);  // 负数/非正 → 无停顿
  });

  it('多段保序，非有限数值一律清零', () => {
    const out = mapSegmentsForEdge([
      { voice: 'en-GB-RyanNeural', text: 'One.', ratePercent: 5, gapAfterMs: 300 },
      { voice: 'en-GB-SoniaNeural', text: 'Two.', ratePercent: 'x', gapAfterMs: 900 },
    ]);
    expect(out.map((s) => s.text)).toEqual(['One.', 'Two.']);
    expect(out[1].ratePercent).toBe(0);
    expect(out[1].gapAfterMs).toBe(900);
  });
});