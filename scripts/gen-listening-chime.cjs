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
 * 🔴 2026-09-20 二次改版：按调研重做（用户："叮咚声不对哦，你调研下真正的听力中的叮咚声"）
 *   此前是自定的 E6(1318Hz)→C6(1046Hz) **下行纯五度** + 纯谐波泛音，听感像电子提示音而非"叮咚"。
 *   调研结论（均已核对来源，未找到实证的项已标注）：
 *    ① 形态＝**两音**：高考听力教研解读原文写"沿用以往'叮咚'打点声"，业内的"打点声"即此两音；
 *    ② 音程＝**下行大三度**（叮高、咚低）：机械门铃即"descending major third interval,
 *       typically dropping from an E down to a C"；中文音程助记资料亦以"门铃声叮咚"为大三度实例；
 *       ⚠️ 绝对音区（具体八度）**无权威出处**，此处取人耳舒适且不刺耳的 E5/C5（659/523Hz）；
 *    ③ 音色＝**金属钟铃**：钟体振动是**非谐泛音**（非整数倍），只用 1×/2×/3× 谐波会像蜂鸣；
 *       钟类声学描述"高频成分丰富则清脆"，故保留 2.76×/5.4× 高次非谐分音；
 *    ④ 时长≈**0.9s**（产品级语音芯片音库的"叮咚"提示音有 0.62/0.9/1.2s 三档，取中档）；
 *    ⑤ 响度＝峰值贴满度（**约 -0.6 dBFS**，比被读语音略响）——资料中未找到教育类响度规范，
 *       此项为工程取值：提示音的职责是"提醒"，须稳定高于语音峰值，但留足削波余量。
 *   改音色/换铃声请**改本脚本再重跑**，不要直接替换 mp3（否则失去可复现来源）。
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

/** 钟铃分音比（相对基频）：1×基音、2×八度、2.76×与 5.4×为钟体非谐分音——后两个决定"像钟不像蜂鸣" */
const PARTIALS = [1, 2, 2.76, 5.4];
/** 起音时长（秒）：越短越"脆"；2ms 已足够陡，且不至于产生爆音 */
const ATTACK = 0.002;
/** 目标峰值（线性）：10^(-0.6/20)≈0.933 → -0.6 dBFS，比语音略响、留足削波余量 */
const TARGET_PEAK = 0.933;

/**
 * 一次敲击的采样值（t 从该次敲击起算）
 * @param {number} t 秒
 * @param {number} freq 基频 Hz
 * @param {number[]} amps 各分音幅度
 * @param {number[]} decays 各分音衰减系数（越大越短）
 */
function strike(t, freq, amps, decays) {
  let s = 0;
  for (let k = 0; k < amps.length; k++) {
    s += amps[k] * Math.sin(2 * Math.PI * freq * PARTIALS[k] * t) * Math.exp(-decays[k] * t);
  }
  return s * Math.min(1, t / ATTACK);
}

// 两音：叮＝E5(659.25) 在前、咚＝C5(523.25) 在后（下行大三度）；两音**略有重叠**，才像真钟余韵
const DING = { freq: 659.25, at: 0, dur: 0.48, amps: [1.0, 0.42, 0.28, 0.10], decays: [9, 14, 20, 28] };
const DONG = { freq: 523.25, at: 0.24, dur: 0.66, amps: [0.95, 0.40, 0.26, 0.09], decays: [7.5, 12, 17, 24] };
const TOTAL = 0.90;

const n = Math.round(SR * TOTAL);
const raw = new Float64Array(n);
for (const s of [DING, DONG]) {
  const from = Math.round(s.at * SR);
  const len = Math.round(s.dur * SR);
  for (let i = 0; i < len && from + i < n; i++) {
    raw[from + i] += strike(i / SR, s.freq, s.amps, s.decays);
  }
}
// 归一化到目标峰值（不同分音相位不同，实际峰值须实测后再缩放，不能按幅度和估算）
let peak = 0;
for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(raw[i]));
const gain = peak > 0 ? TARGET_PEAK / peak : 1;
const pcm = new Int16Array(n);
for (let i = 0; i < n; i++) {
  pcm[i] = Math.max(-32767, Math.min(32767, Math.round(raw[i] * gain * 32767)));
}

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
// 两音分窗核验（与 ffmpeg volumedetect 同口径）：确认"叮"在前、"咚"在后各成一次敲击
const win = (a, b) => {
  let mx = 0;
  let sum = 0;
  let cnt = 0;
  for (let i = Math.round(a * SR); i < Math.round(b * SR) && i < n; i++) {
    const v = Math.abs(raw[i] * gain);
    mx = Math.max(mx, v);
    sum += v * v;
    cnt++;
  }
  const db = (x) => (x > 0 ? (20 * Math.log10(x)).toFixed(1) : '-inf');
  return `峰值 ${db(mx)} dB / RMS ${db(Math.sqrt(sum / Math.max(1, cnt)))} dB`;
};
console.log(`  叮窗 0.00-0.24s：${win(0, 0.24)}`);
console.log(`  咚窗 0.24-0.75s：${win(0.24, 0.75)}`);

if (version !== 'MPEG-2' || layer !== 3 || lens.size !== 1 || [...lens][0] !== 288 || bad !== 0) {
  console.error('❌ 帧结构与合成流不一致，禁止落盘（会与逐句音频拼接出坏帧）');
  process.exit(1);
}
const out = path.join(__dirname, '..', 'assets', 'listening-chime.mp3');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, mp3);
console.log('✅ 已写入', out);
