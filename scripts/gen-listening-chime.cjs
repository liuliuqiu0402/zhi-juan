/**
 * 生成听力音频的"叮咚"提示音素材（assets/listening-chime.mp3）
 * ============================================================
 * 为什么需要本脚本：正规听力音频在**题与题之间、换节处**必有提示音（2026-09-19 用户裁定：
 *   用内置素材，不给应用引入编码器依赖）。素材是二进制文件，若无可复现来源，日后要调音色/换铃声
 *   就只能靠外部工具重做——故把生成方式一并入库。
 *
 * 硬约束（改了会与合成流不兼容）：输出必须是 **24kHz / 单声道 / MPEG-2 Layer III / 96kbps**，
 *   每帧 288 字节、每帧 24ms —— 与 msedge-tts 的 AUDIO_24KHZ_96KBITRATE_MONO_MP3 完全一致，
 *   主进程才能把提示音与逐句合成的音频**字节级拼接**（见 main.js makeSilentMp3Frames 的同源注释）。
 *
 * 运行（lamejs 只在本脚本用，**不进应用依赖**，故用 --no-save）：
 *   npm i --no-save lamejs
 *   node scripts/gen-listening-chime.cjs
 * 脚本自带帧结构自校验，输出"MPEG-2 / Layer3 + 帧长 288 + 坏字节 0"即为合格。
 * ============================================================
 */
const fs = require('fs');
const path = require('path');

// ⚠️ lamejs 的 src/js/index.js 在 Node 下缺全局（MPEGMode 未定义）；lame.min.js 是"裸脚本"
//    （`function lamejs(){…} lamejs();`，成员挂在函数对象上、不写 module.exports），
//    故读文本后补一句 module.exports 再求值。
const LAME_SRC = fs.readFileSync(require.resolve('lamejs/lame.min.js'), 'utf8');
const lameMod = { exports: {} };
// eslint-disable-next-line no-new-func
new Function('module', 'exports', `${LAME_SRC}\nmodule.exports = lamejs;`)(lameMod, lameMod.exports);
const lamejs = lameMod.exports;

const SR = 24000;
const KBPS = 96;

/** 钟声：正弦 + 八度/十二度泛音，指数衰减；起音 6ms 防爆音 */
function bell(tone, durSec, decay) {
  const n = Math.floor(SR * durSec);
  const out = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const env = Math.exp(-decay * t) * Math.min(1, t / 0.006);
    const s = Math.sin(2 * Math.PI * tone * t) * 0.72
      + Math.sin(2 * Math.PI * tone * 2 * t) * 0.20
      + Math.sin(2 * Math.PI * tone * 3 * t) * 0.08;
    out[i] = Math.max(-32767, Math.min(32767, Math.round(s * env * 26000)));
  }
  return out;
}

// "叮"(E6) 接 "咚"(C6)：两音短促、清亮，不抢语音
const d1 = bell(1318.5, 0.22, 14);
const d2 = bell(1046.5, 0.42, 9);
const pcm = new Int16Array(d1.length + d2.length);
pcm.set(d1, 0);
pcm.set(d2, d1.length);

const enc = new lamejs.Mp3Encoder(1, SR, KBPS);
const chunks = [];
const block = 1152;
for (let i = 0; i < pcm.length; i += block) {
  const buf = enc.encodeBuffer(pcm.subarray(i, Math.min(i + block, pcm.length)));
  if (buf.length) chunks.push(Buffer.from(buf));
}
const tail = enc.flush();
if (tail.length) chunks.push(Buffer.from(tail));
const mp3 = Buffer.concat(chunks);

// ── 自校验：用与 main.js countMp3Frames 同一套帧解析口径统计 ──
const table = [0, 8000, 16000, 24000, 32000, 40000, 48000, 56000, 64000, 80000, 96000, 112000, 128000, 144000, 160000];
let pos = 0;
let frames = 0;
let bad = 0;
const lens = new Set();
while (pos < mp3.length - 4) {
  if (mp3[pos] !== 0xff || (mp3[pos + 1] & 0xe0) !== 0xe0) { pos++; bad++; continue; }
  const ver = (mp3[pos + 1] >> 3) & 3;
  if (ver === 1) { pos++; bad++; continue; }
  const bi = (mp3[pos + 2] >> 4) & 15;
  const si = (mp3[pos + 2] >> 2) & 3;
  if (bi === 15 || si === 3) { pos++; bad++; continue; }
  const bps = table[bi];
  const sr = [44100, 48000, 32000][si] / (ver === 3 ? 1 : 2);
  const pad = (mp3[pos + 2] >> 1) & 1;
  const fl = ver === 3 ? Math.floor(144 * bps / sr) + pad : Math.floor(72 * bps / sr) + pad;
  if (fl < 24 || pos + fl > mp3.length) { pos++; bad++; continue; }
  lens.add(fl);
  frames++;
  pos += fl;
}
const version = ((mp3[1] >> 3) & 3) === 2 ? 'MPEG-2' : 'MPEG-1';
const layer = 4 - ((mp3[1] >> 1) & 3);
console.log(`编码格式：${version} / Layer${layer}（期望 MPEG-2 / Layer3）`);
console.log(`帧数=${frames}  帧长集合=${[...lens].join(',')}（期望 288）  坏字节=${bad}（期望 0）`);
console.log(`时长≈${(frames * 24 / 1000).toFixed(2)}s  字节=${mp3.length}`);

if (version !== 'MPEG-2' || layer !== 3 || lens.size !== 1 || [...lens][0] !== 288 || bad !== 0) {
  console.error('❌ 帧结构与合成流不一致，禁止落盘（会与逐句音频拼接出坏帧）');
  process.exit(1);
}
const out = path.join(__dirname, '..', 'assets', 'listening-chime.mp3');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, mp3);
console.log('✅ 已写入', out);
