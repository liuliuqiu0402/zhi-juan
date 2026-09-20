import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * 听力"叮咚"提示音素材的格式守护（assets/listening-chime.mp3）
 * ============================================================
 * 🔴 为什么必须有这条测试：该素材会被主进程**按字节拼接**进逐句合成的音频
 *   （见 main.js makeSilentMp3Frames 的同源注释）。若有人日后换成采样率/帧长不同的 mp3，
 *   拼接处会产生坏帧——听感上是"爆音/卡顿"，而且**只在最终整卷音频里出现**，单听素材根本发现不了。
 *   故此处把"可与合成流字节级拼接"这一硬约束钉死。
 *
 * 素材的唯一合法来源：scripts/gen-listening-chime.cjs（可复现；含帧结构自校验与两音分窗核验）。
 * 要调音色/换铃声请改脚本再重跑，不要手工替换 mp3。
 *
 * 音色口径（2026-09-20 按调研改版，详见生成脚本头部注释）：
 *   · 形态＝两音（高考听力"打点声"即"叮咚"两音，非单声）
 *   · 音程＝下行大三度：叮 E5(659.25Hz) → 咚 C5(523.25Hz)
 *   · 音色＝金属钟铃（1×/2×/2.76×/5.4× 分音，含非谐分音，避免"电子蜂鸣"感）
 *   · 时长≈0.9s（产品级音库"叮咚"档 0.62/0.9/1.2s 的中档）
 */
// ⚠️ 不要直接把 URL 对象交给 fs：jsdom 环境下的全局 URL 与 Node 的 URL 不同源，
//    会抛 ERR_INVALID_URL_SCHEME。先转成路径字符串再读。
const CHIME_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets', 'listening-chime.mp3');

/** 与 main.js countMp3Frames / 生成脚本同一套帧解析口径 */
const BITRATE_TABLE = [0, 8000, 16000, 24000, 32000, 40000, 48000, 56000, 64000, 80000, 96000, 112000, 128000, 144000, 160000];

const parseFrames = (buf) => {
  const frames = [];
  let bad = 0;
  let pos = 0;
  while (pos < buf.length - 4) {
    if (buf[pos] !== 0xff || (buf[pos + 1] & 0xe0) !== 0xe0) { pos++; bad++; continue; }
    const verBits = (buf[pos + 1] >> 3) & 3;          // 2 = MPEG-2
    if (verBits === 1) { pos++; bad++; continue; }
    const layerBits = (buf[pos + 1] >> 1) & 3;        // 1 = Layer III
    const bitrateIdx = (buf[pos + 2] >> 4) & 15;
    const srIdx = (buf[pos + 2] >> 2) & 3;
    if (bitrateIdx === 15 || srIdx === 3) { pos++; bad++; continue; }
    const bps = BITRATE_TABLE[bitrateIdx];
    const sr = [44100, 48000, 32000][srIdx] / (verBits === 3 ? 1 : 2);
    const pad = (buf[pos + 2] >> 1) & 1;
    const len = verBits === 3 ? Math.floor(144 * bps / sr) + pad : Math.floor(72 * bps / sr) + pad;
    if (len < 24 || pos + len > buf.length) { pos++; bad++; continue; }
    frames.push({
      len,
      verBits,
      layer: 4 - layerBits,
      bitrate: bps,
      sampleRate: sr,
      mono: (buf[pos + 3] >> 6) === 3,
    });
    pos += len;
  }
  return { frames, bad };
};

describe('听力提示音素材：必须与 Edge 合成流字节级可拼接', () => {
  const buf = fs.readFileSync(CHIME_PATH);
  const { frames, bad } = parseFrames(buf);

  it('素材存在、非空、能被逐帧完整切分（坏字节 0）', () => {
    expect(buf.length).toBeGreaterThan(2000);
    expect(frames.length).toBeGreaterThan(20);
    expect(bad, '存在无法解析的字节 → 拼进音频会变坏帧').toBe(0);
  });

  it('全部帧参数一致：MPEG-2 / Layer III / 24kHz / 96kbps / 单声道 / 帧长 288', () => {
    for (const f of frames) {
      expect(f.verBits).toBe(2);
      expect(f.layer).toBe(3);
      expect(f.sampleRate).toBe(24000);
      expect(f.bitrate).toBe(96000);
      expect(f.mono).toBe(true);
      expect(f.len).toBe(288);
    }
  });

  it('时长在"叮咚"提示音的合理档位内（0.5–1.5s，产品音库为 0.62/0.9/1.2s）', () => {
    const seconds = frames.length * 24 / 1000;
    expect(seconds).toBeGreaterThanOrEqual(0.5);
    expect(seconds).toBeLessThanOrEqual(1.5);
  });
});
