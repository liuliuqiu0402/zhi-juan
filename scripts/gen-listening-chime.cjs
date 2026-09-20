/**
 * 生成听力音频的"叮咚"提示音素材（assets/listening-chime.mp3）
 * ============================================================
 * ✅ 定版（2026-09-20 用户试听后确认："这个对了，系统里就按这个来"）
 * ------------------------------------------------------------
 *   音高：叮 E6 = 1318.51 Hz → 咚 C6 = 1046.50 Hz（**下行大三度**，钟铃"叮咚"）
 *   间隔：咚在 0.42s 处起音（听感"叮……咚"，不是连点两下）；总长 1.40s（≈61 帧 / 1.46s）
 *   音色：钟铃分音 [0.5× 嗡音托底, 1× 基音, 2× 八度, 2.76×, 5.4×]，
 *         幅度 [0.42, 1.00, 0.30, 0.12, 0.03]（叮）/[0.40, 0.95, 0.28, 0.11, 0.03]（咚），
 *         高次分音刻意削弱且先衰 → 有厚度、不发尖
 *   响度：峰值 -0.4 dBFS（编码前口径；解码实测 -0.7 dBFS），综合响度 -13.3 LUFS
 *         —— 明显高于被读语音（-19.5 ~ -20.9 LUFS），确保能起到"提醒"作用
 *   格式：24kHz / 96kbps / 单声道 / MPEG-2 Layer III / 帧长 288 / 坏字节 0
 * ⚠️ 调音高、间隔、音色、响度**只能改本脚本的常量再重跑**（下方 DING/DONG/TOTAL/PARTIALS/ATTACK/
 *   TARGET_PEAK 以及注释里记录的幅度与衰减数组），不要直接替换 mp3——否则失去可复现来源，
 *   且可能与 Edge 合成流的帧结构不再兼容（见下面的硬约束）。
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
 *    ③ 音色＝**金属钟铃**：钟体振动是**非谐泛音**（非整数倍），只用 1×/2×/3× 谐波会像蜂鸣；
 *       钟类声学描述"高频成分丰富则清脆"，故保留 2.76×/5.4× 高次非谐分音。
 *
 * 🔴 2026-09-20 三次改版：用户试听四组后定版（"第三组对，但是太快了，而且声音要再响亮一些"）
 *   第三组＝**高八度 E6(1318.5Hz) → C6(1046.5Hz)**（即本脚本现值），故音区回到 E6/C6，
 *   但**不再是**早期的纯五度电子音——音程仍为下行大三度 + 钟铃非谐分音。三处按反馈调整：
 *    · 变慢：两音间隔 0.24s → **0.42s**（听感从"连点两下"变为"叮……咚"），各音余韵也拉长，总长 0.90s → 1.40s；
 *    · 变响：峰值 -0.6 dBFS → **-0.4 dBFS**；更关键的是**延长衰减**（能量/响度显著提升）——
 *      实测被读语音峰值仅 -2.2 dB（en-US-Christopher）/ -4.9 dB（en-US-Jenny）/ -3.9 dB（晓晓），
 *      提示音本就应稳定高于语音（实测提示音峰值 -1.0 dB 已高于语音，但用户仍嫌不响 → 说明短促瞬态的
 *      "峰值"并不等于"听感响度"，故靠**拉长余韵**补能量，而不仅是抬峰值）。
 * 🔴 2026-09-20 四次改版：用户再反馈"音太尖了，感觉捏着嗓子在吊音"
 *   诊断：E6 本身就在人声高音区边缘，而初版泛音配置 [1×,2×,2.76×,5.4×] 幅度为 [1.0,0.42,0.28,0.10]，
 *   2.76×=3639Hz、5.4×=7120Hz 这两条高次分音能量偏强 —— 泛音越往高频堆，听感越"尖/吊"，
 *   加上余韵拉长后这种疲劳感被放大（短促时只是"一响"，拉长后变成"一直在吊着"）。
 *   处置（**不动用户已选定的 E6→C6 音高**，只改音色结构）：
 *    · 新增 **0.5× 低八度"嗡音"**（钟的 hum note，真实钟体本就有此分音）托底，给出厚度，消解"薄、捏着"；
 *    · 高次分音大幅削弱：2.76× 0.28→0.12、5.4× 0.10→0.03，且衰减更快（高频先消失，尾音只剩温暖的基音）；
 *    · 基音与八度占比略调，使能量重心下移。
 *   ▸ 该版经用户试听**确认采纳**（见文首"定版"），后续改动请先看文首参数表。
 *   改音色/换铃声请**改本脚本再重跑**，不要直接替换 mp3（否则失去可复现来源）。
 *
 * 运行（lamejs 只在本脚本用，**不进应用依赖**，故用 --no-save）：
 *   npm i --no-save lamejs
 *   node scripts/gen-listening-chime.cjs
 * 脚本自带帧结构自校验，输出"MPEG-2 / Layer3 + 帧长 288 + 坏字节 0"即为合格。
 *
 * ⚠️ 测量口径提醒：脚本打印的"峰值/RMS"是**编码前 PCM** 的值；lame 在 96kbps 单声道下会轻微削峰，
 *   用 ffmpeg 解码实测约为 **-0.9 dBFS**（比打印值低约 0.5 dB）。做响度对比时请以解码后实测为准
 *   （提示音解码峰值 -0.9 dB，被读语音 -2.2 ~ -4.9 dB；综合响度 提示音 -13.8 LUFS vs 语音 -19.5 ~ -20.9 LUFS）。
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

/** 钟铃分音比（相对基频）：0.5×＝钟体 hum note（托底厚度）、1×基音、2×八度、
 *  2.76×与 5.4×为钟体非谐分音——**它们决定"像钟"还是"像蜂鸣"，但给多了会发尖** */
const PARTIALS = [0.5, 1, 2, 2.76, 5.4];
/** 起音时长（秒）：越短越"脆"；2ms 已足够陡，且不至于产生爆音 */
const ATTACK = 0.002;
/** 目标峰值（线性）：10^(-0.4/20)≈0.955 → -0.4 dBFS，高于被读语音峰值（实测 -2.2 ~ -4.9 dB）且留削波余量 */
const TARGET_PEAK = 0.955;

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

// 两音：叮＝E6(1318.5) 在前、咚＝C6(1046.5) 在后（下行大三度，用户试听定版音区）；
// 两音**略有重叠**（咚起时叮仍在余韵中），间隔 0.42s、衰减放缓 → "叮……咚"的钟感与更足的响度。
// 分音幅度按"四次改版"收敛：低八度嗡音托底、高次分音削弱且先衰（尾音不再吊在高频上）。
const DING = { freq: 1318.5, at: 0, dur: 0.75, amps: [0.42, 1.00, 0.30, 0.12, 0.03], decays: [5.0, 5.5, 9, 16, 26] };
const DONG = { freq: 1046.5, at: 0.42, dur: 0.98, amps: [0.40, 0.95, 0.28, 0.11, 0.03], decays: [4.2, 4.5, 7.5, 13, 22] };
const TOTAL = 1.40;

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
console.log(`  叮窗 0.00-0.42s：${win(0, 0.42)}`);
console.log(`  咚窗 0.42-1.20s：${win(0.42, 1.20)}`);

if (version !== 'MPEG-2' || layer !== 3 || lens.size !== 1 || [...lens][0] !== 288 || bad !== 0) {
  console.error('❌ 帧结构与合成流不一致，禁止落盘（会与逐句音频拼接出坏帧）');
  process.exit(1);
}
const out = path.join(__dirname, '..', 'assets', 'listening-chime.mp3');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, mp3);
console.log('✅ 已写入', out);
