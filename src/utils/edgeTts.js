/**
 * Edge 免费语音合成（英语听力音频 · 2026-09-19）
 * ============================================================
 * 用途：无需国际卡/无需 Azure Key 的免费 TTS 通道。
 *   把 listeningScript.js 建出的 **分段脚本(storyboard)** 逐句交给 Edge 免费神经音色合成，
 *   段间停顿用"帧级静音"插入（Edge 不支持 SSML <break>，会致 websocket 断开——见下）。
 *
 * 🔴 为什么逐句 + 帧级静音，而不是一次整卷 SSML：
 *   · msedge-tts 已无自定义 SSML 支持；且实测 Edge 收到含 <break> 的 SSML 会
 *     "Stream closed before turn.end" 断开。
 *   · 因此采用"逐句合成 + 纯 Node 拼 MP3 静音帧"：静音帧用与合成流一致的
 *     24kHz/96kbps 单声道 MPEG-2 Layer III（24ms/帧），字节级拼接即得完整听力卷。
 *
 * 🔴 调用位置：**走主进程**（window.electronAPI.edgeTtsToFile）。
 *   逐句合成 + 拼接都在主进程（Node 常驻、无渲染层跨域与 WebSocket 瓶颈）。
 *   本模块只负责：① 把 storyboard 段映射成主进程需要的 {voice,text,ratePercent,gapAfterMs}；
 *   ② 透传给 IPC；③ 无 electronAPI 时给出降级提示。
 * ============================================================
 */

/** Edge 支持的音色短名（与 listeningAudioProfile 的 neural 短名同源，逐句用） */

/** 把 storyboard 段映射为 Edge 逐句合成所需的最小字段（voice/text/ratePercent/gapAfterMs） */
export function mapSegmentsForEdge(segments = []) {
  return (segments || [])
    .filter((s) => String(s && s.text || '').trim())
    .map((s) => ({
      voice: String(s.voice || 'en-US-AriaNeural'),
      text: String(s.text).trim(),
      // 语速覆盖：intro 段 ratePercent=0（自然语流）；材料段为 wpm→百分比（可正可负）
      ratePercent: Number.isFinite(s.ratePercent) ? Math.round(s.ratePercent) : 0,
      // 段后留白：作答/遍间/句间停顿 → 帧级静音
      gapAfterMs: Number.isFinite(s.gapAfterMs) && s.gapAfterMs > 0 ? Math.round(s.gapAfterMs) : 0,
    }));
}

/**
 * 逐句合成并落盘（统一入口）
 * · Electron：window.electronAPI.edgeTtsToFile —— 主进程逐句合成 + 静音拼接 + 保存对话框 + 写盘
 * · 无 electronAPI（Web/PWA）：Edge 合成依赖主进程 Node websocket，故直接提示不可用
 * @returns {Promise<{ok:boolean, path?:string, canceled?:boolean, bytes?:number, segments?:number}>}
 */
export async function synthesizeSegmentsToFile(segments = [], { suggestedName = '听力音频' } = {}) {
  const list = mapSegmentsForEdge(segments);
  if (!list.length) throw new Error('没有可合成的分段（听力原文为空？）');

  const api = typeof window !== 'undefined' ? window.electronAPI : null;
  if (!api || typeof api.edgeTtsToFile !== 'function') {
    throw new Error('Edge 免费语音仅在桌面应用内可用（需主进程 Node 连接 Edge 服务）；Web/PWA 端请改用「复制 SSML → 粘贴到 Edge 朗读/语音合成工具」。');
  }

  const r = await api.edgeTtsToFile({ segments: list, suggestedName: String(suggestedName || '听力音频') });
  if (!r || r.ok !== true) throw new Error((r && r.error) || '音频生成失败');
  return r;
}

export default {
  mapSegmentsForEdge,
  synthesizeSegmentsToFile,
};