<template>
  <!-- 听力工作台（2026-09-20 抽出为公共组件）：两种形态共用同一份实现
       · variant="modal"（默认）＝生成页从「🎧 听力稿」记录入口打开的弹窗；
       · variant="page"        ＝独立功能页（左侧导航「工具 → 🎧 听力配音」）常驻面板，不用弹窗。
       🔴 Teleport 到 body：弹窗必须脱离缩放容器（祖先 transform:scale 会让 fixed 定位溢出/裁切）；
          page 形态用 :disabled 就地渲染，免得白套一层遮罩。 -->
  <Teleport
    to="body"
    :disabled="variant === 'page'"
  >
    <div
      v-if="variant === 'page' || showListeningModal"
      :class="variant === 'page' ? 'lw-inline-mask' : 'modal-mask'"
      @click.self="variant === 'modal' && closeListeningModal()"
    >
      <div :class="variant === 'page' ? 'lw-inline-panel' : 'modal large-modal'">
        <h3><span class="hide-on-mobile">🎧</span> 听力稿</h3>

        <!-- 📋 粘贴文本配音（2026-09-20 新入口）：英文直接解析；中文先译为英语听力稿，共用同一 JSON 契约，
             故下方的语速/音色/作答留白等全部控件与「生成音频」流程与老路径完全一致 -->
        <div
          v-if="listeningPasteMode"
          style="margin:6px 0 8px;padding:10px;border:1px dashed #cfd8e3;border-radius:8px;background:#fafbfe;"
        >
          <div style="font-size:12px;color:#555;margin-bottom:6px;">
            粘贴听力素材：<b>英文</b>直接解析；<b>中文</b>会先译为英语听力稿（译文在下方朗读稿里核对）
          </div>
          <textarea
            v-model="listeningPasteText"
            rows="6"
            placeholder="例：&#10;第一节，听下面5段对话。每段对话后有一个小题。&#10;1. M: Excuse me, where is the library?&#10;W: It is next to the bank."
            style="width:100%;box-sizing:border-box;padding:8px;border:1px solid #ddd;border-radius:6px;font-size:12px;font-family:inherit;resize:vertical;"
          />
          <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-top:8px;font-size:12px;">
            <label style="display:flex;gap:6px;align-items:center;">
              标题
              <input
                v-model="listeningPasteTitle"
                type="text"
                placeholder="例：六年级英语上册Unit 1测试卷"
                style="width:220px;padding:4px 6px;border:1px solid #ddd;border-radius:6px;font-size:12px;"
              >
            </label>
            <label style="display:flex;gap:6px;align-items:center;">
              学段
              <select
                v-model="listeningPasteStage"
                style="padding:4px 6px;border:1px solid #ddd;border-radius:6px;font-size:12px;"
                @change="onPasteStageChange"
              >
                <option value="">
                  请选择学段
                </option>
                <option
                  v-for="o in PASTE_STAGE_OPTIONS"
                  :key="o.key"
                  :value="o.key"
                >
                  {{ o.label }}
                </option>
              </select>
            </label>
            <label style="display:flex;gap:6px;align-items:center;">
              年级
              <select
                v-model="listeningPasteGrade"
                style="padding:4px 6px;border:1px solid #ddd;border-radius:6px;font-size:12px;"
              >
                <option
                  v-for="g in pasteGradeOptions"
                  :key="g"
                  :value="g"
                >
                  {{ g }}
                </option>
              </select>
            </label>
            <button
              class="btn-small"
              :disabled="listeningLoading || !String(listeningPasteText || '').trim()"
              @click="parseListeningPaste()"
            >
              解析并生成
            </button>
          </div>
          <div style="font-size:11px;color:#888;margin-top:6px;">
            学段/年级决定语速与作答留白档位（与记录入口同一套矩阵）；中文翻译需云端模型，本地 Ollama 不支持
          </div>
        </div>
        <div
          v-else
          style="margin:4px 0 8px;"
        >
          <button
            class="btn-small"
            title="改为直接粘贴文本（英文或中文）解析，不依赖本记录的听力原文"
            @click="listeningPasteMode = true"
          >
            📋 改为粘贴文本解析
          </button>
        </div>
        <div
          v-if="listeningDocTitle"
          class="copy-hint"
        >
          {{ listeningDocTitle }}
        </div>

        <div
          v-if="listeningLoading"
          class="copy-hint"
        >
          {{ listeningPasteMode ? '正在解析粘贴的素材并生成听力稿…（中文素材需先译为英语，稍慢）' : '正在从答案页提取听力原文并结构化…' }}
        </div>
        <div
          v-if="listeningError"
          class="copy-hint"
          style="color:#c0392b;"
        >
          {{ listeningError }}
        </div>

        <div
          v-if="listeningSummary"
          class="copy-hint"
        >
          {{ listeningSummary }}
        </div>

        <div
          v-if="listeningParseMode"
          class="copy-hint"
        >
          结构来源：{{ listeningParseMode }}
        </div>

        <div
          v-if="listeningStruct"
          style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:8px 0;font-size:12px;"
        >
          <label style="display:flex;gap:6px;align-items:center;">
            语速（词/分）
            <input
              v-model.number="listeningWpmOverride"
              type="number"
              min="60"
              max="200"
              :placeholder="String(listeningWpmAuto)"
              style="width:80px;padding:4px 6px;border:1px solid #ddd;border-radius:6px;font-size:12px;"
            >
          </label>
          <!-- 🎚 滑块（2026-09-20 用户："有没在设置区间的滑块或者调节按钮"）：
               量程＝当前学段建议区间外扩 20 词，拖动即写入上方数值框（两控件同一份状态） -->
          <input
            v-model.number="listeningWpmSlider"
            type="range"
            :min="listeningWpmSliderBounds[0]"
            :max="listeningWpmSliderBounds[1]"
            step="5"
            :title="`建议 ${listeningWpmRange[0]}–${listeningWpmRange[1]} 词/分`"
            style="width:190px;accent-color:#4a7cf6;cursor:pointer;"
          >
          <span style="color:#666;">
            建议 {{ listeningWpmRange[0] }}–{{ listeningWpmRange[1] }} 词/分
            <span
              v-if="!listeningWpmInRange"
              style="color:#e08000;"
            >（当前 {{ listeningEffectiveWpm }} 超出，请确认是否有考区依据）</span>
          </span>
          <!-- ⟲ 一键回到学段默认（初中按年级细分）；已手动指定时才有意义 -->
          <button
            type="button"
            :disabled="!listeningWpmIsManual"
            :style="{fontSize:'12px', padding:'3px 10px', borderRadius:'6px', border:'1px solid #ddd', background:listeningWpmIsManual?'#fff':'#f5f5f5', color:listeningWpmIsManual?'#333':'#aaa', cursor:listeningWpmIsManual?'pointer':'default'}"
            :title="`回到 ${STAGE_LABEL_MAP[listeningStageKey] || '本学段'} 默认 ${listeningWpmAuto} 词/分`"
            @click="listeningWpmOverride = null"
          >
            ⟲ 学段默认 {{ listeningWpmAuto }}
          </button>
          <span style="color:#666;">
            生效 {{ listeningEffectiveWpm }} 词/分（{{ listeningWpmIsManual ? '手动指定' : `${STAGE_LABEL_MAP[listeningStageKey] || '按学段矩阵'}自动` }}）
          </span>
        </div>

        <!-- ⏳ 静默作答时间（2026-09-20 用户："静默答题的时间是用户可调吗？还是硬编码的？有范围可供用户调整吗？"）：
             此前只有矩阵默认值、面板没暴露；现按三档给默认 + 可调区间（越界只提示不拦） -->
        <div
          v-if="listeningStruct"
          style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin:8px 0;font-size:12px;"
        >
          <span style="color:#333;">⏳ 静默作答（秒）</span>
          <label
            v-for="tier in LISTENING_ANSWER_GAP_TIERS"
            :key="tier.key"
            style="display:flex;gap:5px;align-items:center;"
            :title="tier.hint"
          >
            <span style="color:#666;">{{ tier.label }}</span>
            <input
              v-model.number="listeningAnswerGap[tier.key]"
              type="number"
              :min="tier.range[0]"
              :max="tier.range[1]"
              :placeholder="String(listeningAnswerGapAuto[tier.key])"
              style="width:64px;padding:4px 6px;border:1px solid #ddd;border-radius:6px;font-size:12px;"
            >
            <span style="color:#aaa;">（{{ tier.range[0] }}–{{ tier.range[1] }}）</span>
          </label>
          <button
            type="button"
            :disabled="!listeningAnswerGapIsManual"
            :style="{fontSize:'12px', padding:'3px 10px', borderRadius:'6px', border:'1px solid #ddd', background:listeningAnswerGapIsManual?'#fff':'#f5f5f5', color:listeningAnswerGapIsManual?'#333':'#aaa', cursor:listeningAnswerGapIsManual?'pointer':'default'}"
            title="回到学段/真题默认的作答留白"
            @click="resetListeningAnswerGap"
          >
            ⟲ 默认 {{ listeningAnswerGapAuto.short }}/{{ listeningAnswerGapAuto.long }}/{{ listeningAnswerGapAuto.fillIn }}
          </button>
          <span
            v-if="listeningAnswerGapOutOfRange.length"
            style="color:#e08000;"
          >（{{ listeningAnswerGapOutOfRange.join('、') }} 超出建议区间，请确认是否有考区依据）</span>
          <span style="color:#999;">节指令写明"X 秒钟作答"的题以指令为准</span>
        </div>

        <!-- 🎚 音色（2026-09-19 用户裁定：默认男声1+女声2，其余可选，每项可试听） -->
        <div
          v-if="listeningStruct"
          style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin:8px 0;font-size:12px;"
        >
          <template
            v-for="slot in LISTENING_VOICE_SLOTS"
            :key="slot.key"
          >
            <label style="display:flex;gap:6px;align-items:center;">
              <span :title="slot.hint || (slot.optional ? '多角色对话时才会用到：三人及以上对话按顺序取用，留空则不启用' : '')">
                {{ slot.label }}<span
                  v-if="slot.optional"
                  style="color:#999;cursor:help;"
                >ⓘ</span>
              </span>
              <select
                v-model="listeningVoices[slot.key]"
                style="padding:4px 6px;border:1px solid #ddd;border-radius:6px;font-size:12px;"
              >
                <option value="">
                  {{ slot.emptyLabel || (slot.optional ? '（不用）' : '默认') }}
                </option>
                <optgroup
                  v-for="g in listeningVoiceOptions[slot.group]"
                  :key="g.label"
                  :label="g.label"
                >
                  <option
                    v-for="opt in g.items"
                    :key="opt.value"
                    :value="opt.value"
                  >
                    {{ opt.text }}
                  </option>
                </optgroup>
              </select>
            </label>
            <button
              class="btn-small"
              style="font-size:11px;padding:1px 7px;"
              :disabled="!listeningVoices[slot.key] || ['native', 'single', 'split'].includes(listeningVoices[slot.key]) || !!listeningPreviewing"
              :title="`试听「${listeningVoices[slot.key] || '（未选）'}」`"
              @click="playVoicePreview(listeningVoices[slot.key])"
            >
              {{ listeningPreviewing === listeningVoices[slot.key] && listeningPreviewing ? '试听中…' : '▶ 试听' }}
            </button>
          </template>
          <span
            v-if="listeningVoiceHint"
            style="color:#d9673a;font-size:11px;"
          >{{ listeningVoiceHint }}</span>
        </div>

        <div
          v-if="listeningStruct && listeningCastSummary"
          class="copy-hint"
          style="margin:2px 0 6px;"
        >
          🎭 {{ listeningCastSummary }}　（逐题「角色 → 音色」见下方朗读稿）
        </div>

        <!-- 🔁 遍间换声口径透明化（2026-09-20 用户："我确实听的是小学的，按真实调研分学段区分"）：
             小学默认换声（实证来自小学资料）；初中/高中真题惯例为同一人重读，默认不换声 -->
        <div
          v-if="listeningStruct"
          class="copy-hint"
          style="margin:2px 0 6px;"
        >
          {{ listeningPassRotationHint }}
        </div>

        <!-- 🗣 中英混排标题＝同一人通读（仅混排标题显示；纯中文/纯英文标题不显示） -->
        <div
          v-if="listeningStruct && listeningTitleMixedHint"
          class="copy-hint"
          style="margin:2px 0 6px;"
        >
          {{ listeningTitleMixedHint }}
        </div>

        <div
          v-if="listeningStruct"
          style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin:8px 0;font-size:12px;"
        >
          <label style="display:flex;gap:6px;align-items:center;cursor:pointer;">
            <input
              v-model="listeningAnnounceTitle"
              type="checkbox"
            >
            读试卷标题
            <span
              title="录音最前先播报试卷标题（如「六年级英语上册Unit 1 Try your best测试卷。」），学生据此确认是哪一份卷。生成时间戳等后缀会自动净化。"
              style="color:#999;cursor:help;"
            >ⓘ</span>
          </label>
          <label style="display:flex;gap:6px;align-items:center;cursor:pointer;">
            <input
              v-model="listeningSoundCheck"
              type="checkbox"
            >
            试音段
            <span
              title="正规考试录音先试音再开考：「下面是听力试音时间」+ 一男一女英文试音对话 + 「听力试音到此结束，听力考试现在开始」。校内小测嫌长可关掉。"
              style="color:#999;cursor:help;"
            >ⓘ</span>
          </label>
          <label style="display:flex;gap:6px;align-items:center;cursor:pointer;">
            <input
              v-model="listeningShortItemNo"
              type="checkbox"
            >
            一题一材料处播题号
            <span
              title="一题一材料处播英文题号「Number 1.」（学生听到后翻到对应小题）。一段材料对多题的「听第X段材料，回答第X、Y小题」不受此开关影响，始终按真题写法播报。"
              style="color:#999;cursor:help;"
            >ⓘ</span>
          </label>
        </div>

        <div
          v-if="listeningNotes.length"
          class="copy-hint"
          style="color:#8a6d3b;"
        >
          <div
            v-for="(n, i) in listeningNotes"
            :key="i"
          >
            · {{ n }}
          </div>
        </div>

        <div
          v-if="listeningSsml"
          style="margin-top:8px;"
        >
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
            <strong style="font-size:13px;">① SSML —— 粘进语音合成工具，直接出音频</strong>
            <button
              class="btn-small"
              @click="copyListeningText('ssml')"
            >
              📋 复制 SSML
            </button>
          </div>
          <textarea
            readonly
            :value="listeningSsml"
            style="width:100%;height:180px;font-family:monospace;font-size:12px;margin-top:6px;padding:8px;border:1px solid #ddd;border-radius:8px;"
          />
        </div>

        <div
          v-if="listeningScriptText"
          style="margin-top:10px;"
        >
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
            <strong style="font-size:13px;">② 朗读稿 —— 真人录音 / 剪映分角色配音</strong>
            <button
              class="btn-small"
              @click="copyListeningText('script')"
            >
              📋 复制朗读稿
            </button>
          </div>
          <textarea
            readonly
            :value="listeningScriptText"
            style="width:100%;height:180px;font-size:12px;margin-top:6px;padding:8px;border:1px solid #ddd;border-radius:8px;"
          />
        </div>

        <div
          v-if="listeningSynthMsg"
          class="copy-hint"
        >
          {{ listeningSynthMsg }}
        </div>

        <div
          class="modal-actions"
          style="flex-wrap:wrap;row-gap:8px;"
        >
          <div style="display:flex;align-items:center;gap:10px;margin-right:auto;font-size:13px;color:#555;">
            <span>🎙 通道：</span>
            <label style="display:flex;align-items:center;gap:3px;cursor:pointer;">
              <input
                v-model="listeningChannel"
                type="radio"
                value="edge"
              > Edge 免费（无需 Key）
            </label>
            <label style="display:flex;align-items:center;gap:3px;cursor:pointer;">
              <input
                v-model="listeningChannel"
                type="radio"
                value="azure"
              > Azure（需 Key）
            </label>
          </div>
          <button
            class="btn-primary"
            :disabled="listeningSynthLoading || !listeningSsml"
            @click="generateListeningAudio"
          >
            {{ listeningSynthLoading ? '⏳ 正在合成…' : '🎧 直接生成音频（mp3）' }}
          </button>
          <button
            v-if="variant === 'modal'"
            class="btn"
            @click="closeListeningModal"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
/**
 * 🎧 听力工作台（2026-09-20 从 GenerateModule 抽出，逐字迁移、未改行为）
 * ============================================================
 * 为什么抽出：听力配音原本只能从"已生成记录"进入，而结果列表是 20 条上限滚动的临时区，
 *   记录一滚走功能就找不到了。用户裁定："粘贴配音是一个功能哦，不是附属在结果列表中的"——
 *   故把它变成独立功能（左侧导航「工具 → 🎧 听力配音」），记录入口继续留着当便利入口。
 * 两种形态共用**同一份**实现（同一状态机、同一解析、同一渲染与合成），避免两套口径。
 *
 * 对外只暴露两个动作（defineExpose）：
 *   · openFromRecord(doc)：从某条生成记录的答案页听力原文进入（弹窗形态）；
 *   · openPaste()：直接粘贴素材（英文直解 / 中文先译）进入（独立页形态默认就走它）。
 *
 * ⚠️ 样式必须自带一份：弹窗被 Teleport 到 body，节点上带的是**本组件**的 scopeId，
 *   父组件的 scoped 样式对它无效（下面 style 块里已按原样复制 .modal/-mask/… 等规则）。
 */
import { ref, reactive, computed, watch, onMounted } from 'vue';
import { apiConfig } from '../../config/apiConfig.js';
import { STORAGE_KEYS } from '../../constants/storageKeys.js';
import { APP_EVENTS } from '../../constants/events.js';
import { chatNonThinkingOnce } from '../../composables/useAiGenerator.js';
import { buildListeningExtractMessages } from '../../config/listeningExtractPrompt.js';
// 📋 中文素材 → 英语听力稿：与"搬运"共用同一 JSON 契约（LISTENING_STRUCT_SCHEMA），故下游零改动
import { buildListeningTranslateMessages } from '../../config/listeningTranslatePrompt.js';
import { extractListeningSource, parseListeningStructure, summarizeListeningStructure, parseListeningSourceText, needAiFallback, detectSourceLanguage } from '../../utils/listeningExtract.js';
import { buildListeningSsml, buildListeningScriptText, buildListeningStoryboard } from '../../utils/listeningScript.js';
import { resolveListeningParams, LISTENING_FEATURE_DEFAULTS, LISTENING_VOICE_CANDIDATES, LISTENING_VOICE_DEFAULTS, LISTENING_ZH_VOICE_CANDIDATES, LISTENING_ZH_VOICE, LISTENING_STAGE_WPM_RANGE, LISTENING_MIXED_TITLE_VOICE_CANDIDATES, LISTENING_MIXED_TITLE_VOICE, LISTENING_ANSWER_GAP_RANGE, LISTENING_PAUSE } from '../../config/listeningAudioProfile.js';
// 🎧 Azure 语音合成：SSML → 整卷 mp3（Electron 走主进程，规避跨域）
import { synthesizeToFile, readAzureConfigFromApiConfig } from '../../utils/azureTts.js';
// 🎧 Edge 免费语音：无需 Key，逐句合成 + 帧级静音拼接（主进程执行）
import { synthesizeSegmentsToFile, previewVoice } from '../../utils/edgeTts.js';

/**
 * 形态：'modal'（弹窗，生成页用）/ 'page'（常驻面板，独立功能页用）。
 * 除包装层与默认模式外，两种形态的行为完全一致。
 */
const props = defineProps({
  variant: { type: String, default: 'modal' },
});

/** 🔴 学段显示名（原 planner 导出，planner 已删除；仅听力面板消费，随本组件一起搬过来） */
const STAGE_LABEL_MAP = {
  primary_low: '小学低段', primary_mid: '小学中段', primary_high: '小学高段',
  middle: '初中', high: '高中',
};

// 结果处理
// ═══════════════════════════════════════════════════════════════
// 🎧 英语听力稿（2026-09-16 用户定版）
// ============================================================
// 目的：把答案页的【听力原文】转成"复制即用"的两种成品——
//   ① SSML   → 粘进语音合成工具（如 Azure 语音 Studio「音频内容创建」）一键出音频；
//   ② 朗读稿 → 给人看 / 真人录音 / 剪映分角色配音。
// 链路：记录内容 → 取听力区文本 → **一次非思考调用**做结构搬运（不改写词句）→ 校验
//       → listeningScript 按学段参数矩阵渲染（语速/停顿/口音/音色/遍数）→ 一键复制。
// 🔴 纯加性：不参与卷面与答案页的生成提示词，只在用户点按钮时按需调用一次。
// 🔴 参数口径：矩阵默认 + 可覆盖（用户定版）——下面只暴露"语速/口音"两项覆盖，
//    其余（停顿/遍数/音色）走矩阵；覆盖后即时重渲染，所见即所得。
// ═══════════════════════════════════════════════════════════════
const showListeningModal = ref(false);
const listeningLoading = ref(false);
const listeningError = ref('');
const listeningDocTitle = ref('');
const listeningSummary = ref('');
const listeningNotes = ref([]);
const listeningSsml = ref('');
const listeningScriptText = ref('');
const listeningStruct = ref(null);
const listeningStageKey = ref('');
const listeningGradeHint = ref('');
const listeningWpmOverride = ref(null);

/**
 * 📋 粘贴文本配音（2026-09-20 新入口）
 * ============================================================
 * 用户诉求：不想只靠"答案页听力原文"这一个来源——手上现成的素材（英文或中文）粘进来就能出音频。
 * 两条路难度不同，故一并实现（用户："前者现在需要，后者后期会需要。如果都好实现，就一并实现了"）：
 *   · 英文：与记录入口**同一条**路——规则解析优先，needAiFallback 才调 AI 兜底，零新增链路；
 *   · 中文：先调一次"翻译 + 结构化"（listeningTranslatePrompt），它把中文正文译成英语、
 *     中文导语/播音指令/题号范围**原样保留中文**，并输出**与搬运路径同一份 JSON 契约**的结构。
 *     拿到结构后下游完全一致——语速/音色/作答留白/逐句合成一行都不用改。这是能低成本落地的关键。
 *
 * 🔴 学段/年级是**粘贴模式下唯一没有来源**的信息（记录入口从 doc.stage 拿），必须让用户选：
 *   它决定语速与三档作答留白（同一份矩阵 resolveListeningParams），选错则整卷语速跑偏。
 *   故这里只放"学段键 + 年级"两个下拉，且**年级只对初中有意义**
 *   （见 LISTENING_GRADE_WPM：七/八/九 → 110/120/130；小学已由学段切分、高中档无年级细分）。
 *
 * ⚠️ 中文翻译依赖**云端**模型（与 AI 兜底同一通道）：本地 Ollama 不支持，必须明确报错、不静默失败。
 */
const listeningPasteMode = ref(false);
const listeningPasteText = ref('');
const listeningPasteTitle = ref('');
const listeningPasteStage = ref('');
const listeningPasteGrade = ref('不指定');
/** 学段候选：直接给五档键（值）与中文标签（显示），避免把中文标签再解析一遍引入歧义 */
const PASTE_STAGE_OPTIONS = [
  { key: 'primary_low', label: '小学低段（一、二年级）' },
  { key: 'primary_mid', label: '小学中段（三、四年级）' },
  { key: 'primary_high', label: '小学高段（五、六年级）' },
  { key: 'middle', label: '初中（按年级细分语速）' },
  { key: 'high', label: '高中' },
];
/** 年级候选随学段变；「不指定」＝用该学段矩阵默认值（初中默认＝八年级 120 词/分） */
const pasteGradeOptions = computed(() => {
  const s = listeningPasteStage.value;
  if (s === 'middle') return ['不指定', '七年级', '八年级', '九年级'];
  if (s === 'high') return ['不指定', '高一', '高二', '高三'];
  // 小学：学段本身已分低/中/高段，再选年级会出现"小学低段 + 六年级"这类自相矛盾的组合
  return ['不指定'];
});
/** 学段切换 → 年级候选变了，旧值可能已不在候选里，回落到「不指定」 */
const onPasteStageChange = () => {
  if (!pasteGradeOptions.value.includes(listeningPasteGrade.value)) listeningPasteGrade.value = '不指定';
};
// 🎛 可选环节开关（默认值取单一事实源 LISTENING_FEATURE_DEFAULTS）：
//   读试卷标题默认开；试音段默认开；一题一材料处播题号（英文 Number N.）默认开。
const listeningAnnounceTitle = ref(LISTENING_FEATURE_DEFAULTS.announceTitle);
const listeningSoundCheck = ref(LISTENING_FEATURE_DEFAULTS.soundCheck);
const listeningShortItemNo = ref(LISTENING_FEATURE_DEFAULTS.announceShortItemNo);
// 🎚 音色（2026-09-19 用户裁定）：
//   · 默认 男声 1（Christopher）+ 女声 2（Jenny）；其余音色全部作为可选项；
//   · 男声副/女声副＝**多角色对话**追加音色（留空＝不用；三人对话时才会被取到）；
//   · 每个选项都能试听（▶ 试听 → 主进程 edge-tts-preview）。
//   选了具体音色后即不再按口音表逐段轮换——音色本身就是"口音"。
const listeningVoices = reactive({
  M: LISTENING_VOICE_DEFAULTS.M,
  W: LISTENING_VOICE_DEFAULTS.W,
  N: '',   // 🎙 英语旁白（独白/短文、英文题号）——留空＝跟随男声
  Z: '',   // 🎙 中文播报（开场白/导语/分节指令/部分标题/结束语）——留空＝晓晓（默认）
  T: '',   // 🗣 中英混合标题的"同一人通读"多语言音色——留空＝默认多语言男声（Andrew）
  M2: LISTENING_VOICE_DEFAULTS.M2,
  W2: LISTENING_VOICE_DEFAULTS.W2,
});
/** 音色槽位（模板据此渲染下拉；group 决定候选取自男声表/女声表/中文播报表/多语言表） */
const LISTENING_VOICE_SLOTS = [
  { key: 'M', label: '男声', group: 'M', optional: false },
  { key: 'W', label: '女声', group: 'W', optional: false },
  { key: 'N', label: '旁白', group: 'M', optional: true, emptyLabel: '跟随男声', hint: '英语旁白：独白/短文、英文题号「Number N.」用这条音色；留空＝跟随男声（标题里的英文段已改由下面的「标题」槽一人通读）' },
  { key: 'Z', label: '中文播报', group: 'Z', optional: true, emptyLabel: '晓晓（默认）', hint: '中文播报：开场白、导语、分节指令、部分标题、结束语等中文段用这条音色；留空＝晓晓（默认）' },
  { key: 'T', label: '标题', group: 'T', optional: true, emptyLabel: '按语种分读（默认·推荐）', hint: '中英混合标题专用。默认"按语种分读"：中文段用「中文播报」音色、英文段用与其中文播报者**同性别**的英文音色，中英各由母语音色朗读、段间不留人工停顿——免费通道下最自然（单一多语言音色会把中文读出外国口音，实测已否决，仍可在此切回）' },
  { key: 'M2', label: '男声副', group: 'M', optional: true },
  { key: 'W2', label: '女声副', group: 'W', optional: true },
];
/** 候选分组（美音/英音），文案带序号——与「音色试听对比.mp3」里的报号一致，便于按编号指定；中文播报表/多语言表各成一组 */
const listeningVoiceOptions = computed(() => {
  const build = (g) => [
    { label: '美音', items: LISTENING_VOICE_CANDIDATES.us[g].map((v, i) => ({ value: v, text: `${g === 'M' ? '男声' : '女声'} ${i + 1} · ${v.replace(/^en-US-|Neural$/g, '')}` })) },
    { label: '英音', items: LISTENING_VOICE_CANDIDATES.gb[g].map((v, i) => ({ value: v, text: `${g === 'M' ? '男声' : '女声'} ${i + 1} · ${v.replace(/^en-GB-|Neural$/g, '')}` })) },
  ];
  return {
    M: build('M'),
    W: build('W'),
    Z: [{ label: '中文播报', items: LISTENING_ZH_VOICE_CANDIDATES.map((c) => ({ value: c.voice, text: c.name })) }],
    T: [
      { label: '读法', items: [
        { value: 'native', text: '按语种分读（中文用中文音色·英文用同性别英文音色）——推荐' },
        { value: 'single', text: '同一人多语言音色通读（⚠️ 中文会带外国口音）' },
      ] },
      { label: '或直接指定通读音色（多语言）', items: LISTENING_MIXED_TITLE_VOICE_CANDIDATES.map((c) => ({ value: c.voice, text: c.name })) },
    ],
  };
});
/** 生效音色池（喂给 storyboard：男主, 女主, 男副?, 女副? —— 空值会被剔除） */
const listeningVoicePool = computed(() => [listeningVoices.M, listeningVoices.W, listeningVoices.M2, listeningVoices.W2].filter(Boolean));
const listeningPreviewing = ref('');   // 正在试听的音色名（防重复点击）
const listeningVoiceHint = ref('');
const listeningCastSummary = ref('');  // 🎚 多角色配声摘要（当前结构下的角色数/音色数/是否够用）
let listeningAudioEl = null;
/** ▶ 试听：合成一句样例直接播放（不落盘、不弹保存框） */
const playVoicePreview = async (voice) => {
  const v = String(voice || '');
  // 'native'/'single'/'split' 是"读法"取值，不是音色，不可试听
  if (!v || ['native', 'single', 'split'].includes(v) || listeningPreviewing.value) return;
  listeningPreviewing.value = v;
  listeningVoiceHint.value = '';
  try {
    // 样例句按音色类型给（否则听不出真实效果）：
    //   · 多语言音色 → 中英混排标题样句，直接验证"同一人通读 + 衔接自然"；
    //   · 中文播报音色 → 中文播报样句（避免中文音色念英文的怪腔）；
    //   · 其余英文音色 → 用默认英文样句。
    const text = LISTENING_MIXED_TITLE_VOICE_CANDIDATES.some((c) => c.voice === v)
      ? '六年级英语上册 Unit one Try your best 测试卷。'
      : (/^zh-/.test(v) ? '听力考试现在开始，请注意听下面的对话。' : '');
    const url = await previewVoice({ voice: v, ratePercent: listeningEffectiveParams.value.ratePercent, text });
    if (typeof Audio === 'undefined') throw new Error('当前环境不支持音频播放');
    if (!listeningAudioEl) listeningAudioEl = new Audio();
    listeningAudioEl.src = url;
    await listeningAudioEl.play();
  } catch (e) {
    listeningVoiceHint.value = `试听失败：${e.message}`;
  } finally {
    listeningPreviewing.value = '';
  }
};
const listeningSynthLoading = ref(false);
const listeningSynthMsg = ref('');
const listeningParseMode = ref('');   // 本次结构来自"规则解析"还是"AI 解析"（对用户透明）
const listeningChannel = ref(apiConfig.speechChannel || 'edge');  // 'edge' 免费（无需 Key）| 'azure'（需 Key）
const listeningSegments = ref([]);    // storyboard 段（Edge 逐句合成用；与 SSML 同源）

/**
 * ⏳ 静默作答时间（2026-09-20 用户："静默答题的时间是用户可调吗？还是硬编码的？有范围可供用户调整吗？"）
 * ============================================================
 * 现状（修复前）：**硬编码**在矩阵 LISTENING_PAUSE 里，面板完全没暴露，只有改代码才能调。
 * 现在补齐三档控件——三档语义不同，必须分开给，不能用一个值糊过去：
 *   · short  一段材料对一题（短对话/单词）：学段档 5/6/8/10/10 秒；
 *   · long   一段材料对多题（独白/短文）：真题"各小题 5 秒钟"；
 *   · fillIn 需动笔写词的补全短文/填空：30 秒（每题 5 秒 × 空数量级）。
 * 留空＝用矩阵默认；填写＝显式覆盖该卷；越界（超出建议区间）只橙色提示、不改写用户设定。
 * ⚠️ 节指令里写明"X 秒钟作答/阅读"的题**以指令为准**（考试文本优先，不被本控件翻转）。
 *
 * ⚠️ 状态与档位表必须声明在 listeningEffectiveParams **之前**：后者会读取它们，
 *   声明在后会踩 TDZ；且 overrides 组装函数只能读 listeningStageKey（普通 ref），
 *   读 listeningEffectiveParams 会造成计算属性自我递归。
 */
const listeningAnswerGap = reactive({ short: null, long: null, fillIn: null });
const LISTENING_ANSWER_GAP_TIERS = [
  { key: 'short', label: '短材料', range: LISTENING_ANSWER_GAP_RANGE.short, hint: '一段材料对一题（短对话、单词、单句）读完后的作答留白；默认按学段 5/6/8/10/10 秒' },
  { key: 'long', label: '独白/短文', range: LISTENING_ANSWER_GAP_RANGE.long, hint: '一段材料对多题（独白/短文）每段读完后的作答留白；真题"各小题 5 秒钟"→ 默认 5 秒' },
  { key: 'fillIn', label: '补全短文', range: LISTENING_ANSWER_GAP_RANGE.fillIn, hint: '需动笔写词的补全短文/填空类作答留白（写 5 个词来不及）；默认 30 秒' },
];
/** 把三档控件值转成 overrides.pauses（只带用户真正填了的档位） */
const listeningAnswerGapOverrides = () => {
  const pauses = {};
  const stageKey = listeningStageKey.value || 'middle';
  if (Number.isFinite(listeningAnswerGap.short) && listeningAnswerGap.short > 0) {
    pauses.answerGapMs = { [stageKey]: Math.round(listeningAnswerGap.short * 1000) };
  }
  if (Number.isFinite(listeningAnswerGap.long) && listeningAnswerGap.long > 0) {
    pauses.longMaterialAnswerGapMs = Math.round(listeningAnswerGap.long * 1000);
  }
  if (Number.isFinite(listeningAnswerGap.fillIn) && listeningAnswerGap.fillIn > 0) {
    pauses.fillInAnswerGapMs = Math.round(listeningAnswerGap.fillIn * 1000);
  }
  return pauses;
};

/**
 * 🎚 本次录音**实际生效**的参数（学段矩阵 → 初中按年级细分 → 用户覆盖）。
 * 用于把弹窗里"默认"这一含糊说法替换成真实数值——用户看到的就是将要听到的语速。
 */
const listeningEffectiveParams = computed(() => {
  const overrides = {};
  if (Number.isFinite(listeningWpmOverride.value) && listeningWpmOverride.value > 0) {
    overrides.wpm = listeningWpmOverride.value;
  }
  // 音色：显式选定的男主/女主即生效音色（不再按口音表轮换）；中文播报 Z 槽选定后同样生效
  overrides.voices = {
    us: { M: listeningVoices.M, W: listeningVoices.W, N: listeningVoices.M },
    gb: { M: listeningVoices.M, W: listeningVoices.W, N: listeningVoices.M },
  };
  if (listeningVoices.Z) overrides.zhVoice = listeningVoices.Z;
  // 🗣 中英混合标题：T 槽选定后生效，留空＝默认多语言音色（Andrew）
  if (listeningVoices.T) overrides.titleMixedVoice = listeningVoices.T;
  // ⏳ 静默作答：三档控件填了哪档就覆盖哪档（留空＝矩阵默认）
  {
    const pauses = listeningAnswerGapOverrides();
    if (Object.keys(pauses).length) overrides.pauses = pauses;
  }
  return resolveListeningParams({
    stage: listeningStageKey.value,
    grade: listeningGradeHint.value,
    overrides,
  });
});

/** 实际生效语速（词/分）；用户已覆盖时标记为"手动" */
const listeningEffectiveWpm = computed(() => listeningEffectiveParams.value.wpm);
const listeningWpmIsManual = computed(() => Number.isFinite(listeningWpmOverride.value) && listeningWpmOverride.value > 0);

/**
 * 🎚 语速调节（2026-09-20 用户："有没在设置区间的滑块或者调节按钮"）
 * ============================================================
 * 三个控件共用同一份状态（listeningWpmOverride），任一处改都立刻反映到另两处：
 *   · 数值框——精确定值（60–200，可超出建议区间，越界只提示不拦）；
 *   · 滑块——量程以**当前学段建议区间**为中心外扩 20 词，便于"略快/略慢"微调；
 *   · ⟲ 按钮——一键回学段默认（初中还会按年级细分）。
 * 建议区间来自 listeningAudioProfile 的单一事实源（小学低 80 / 中 90–100 / 高 110–120；
 * 初中 100–130、高中 140–160），此处只做展示与量程，不复制数值。
 */
const listeningWpmRange = computed(() => {
  const key = listeningEffectiveParams.value.stageKey || 'middle';
  return LISTENING_STAGE_WPM_RANGE[key] || [60, 200];
});
/** 滑块量程：建议区间外扩 20 词（并夹在 60–200 内），使"贴着区间边缘微调"也能拖到 */
const listeningWpmSliderBounds = computed(() => {
  const [lo, hi] = listeningWpmRange.value;
  return [Math.max(60, lo - 20), Math.min(200, hi + 20)];
});
/** 未手动指定时的学段默认语速（初中按年级细分）——数值框的占位与⟲按钮的落点都用它 */
const listeningWpmAuto = computed(() => resolveListeningParams({
  stage: listeningStageKey.value,
  grade: listeningGradeHint.value,
}).wpm);
/** 生效值是否落在建议区间内（越界给橙色提示，但不改写用户显式设定） */
const listeningWpmInRange = computed(() => {
  const [lo, hi] = listeningWpmRange.value;
  return listeningEffectiveWpm.value >= lo && listeningEffectiveWpm.value <= hi;
});
/** 滑块与 listeningWpmOverride 双向打通：拖动＝显式指定，清空则回到学段默认 */
const listeningWpmSlider = computed({
  get: () => listeningEffectiveWpm.value,
  set: (v) => {
    const n = Number(v);
    listeningWpmOverride.value = Number.isFinite(n) && n > 0 ? n : null;
  },
});

/**
 * ⏳ 静默作答时间的默认值/越界提示（状态与 overrides 组装见 listeningEffectiveParams 之前）
 * 数值框占位与⟲按钮的落点都用矩阵默认，不复制常量。
 */
const listeningAnswerGapAuto = computed(() => {
  const key = listeningStageKey.value || 'middle';
  return {
    short: Math.round((LISTENING_PAUSE.answerGapMs[key] || 10000) / 1000),
    long: Math.round(LISTENING_PAUSE.longMaterialAnswerGapMs / 1000),
    fillIn: Math.round(LISTENING_PAUSE.fillInAnswerGapMs / 1000),
  };
});
const listeningAnswerGapIsManual = computed(
  () => LISTENING_ANSWER_GAP_TIERS.some((t) => Number.isFinite(listeningAnswerGap[t.key]) && listeningAnswerGap[t.key] > 0),
);
/** 越界档位名（只提示，不改写用户显式设定） */
const listeningAnswerGapOutOfRange = computed(() => LISTENING_ANSWER_GAP_TIERS
  .filter((t) => Number.isFinite(listeningAnswerGap[t.key]) && listeningAnswerGap[t.key] > 0
    && (listeningAnswerGap[t.key] < t.range[0] || listeningAnswerGap[t.key] > t.range[1]))
  .map((t) => t.label));
const resetListeningAnswerGap = () => {
  listeningAnswerGap.short = null;
  listeningAnswerGap.long = null;
  listeningAnswerGap.fillIn = null;
};

/**
 * 🔁 遍间换声口径（透明化展示，2026-09-20 用户裁定"按真实调研分学段区分"）
 * 小学开启——实证来自小学资料（人教 PEP CD"两遍、英音美音各一遍"；小学听力要求"男、女、男各读一遍"）；
 * 初中/高中关闭——中考/高考真题惯例为同一人重读两遍，未见男女轮流明文，以保真为先。
 */
const listeningPassRotationHint = computed(() => {
  const p = listeningEffectiveParams.value;
  const stage = STAGE_LABEL_MAP[p.stageKey] || '本学段';
  return p.passVoiceRotation
    ? `🔁 遍间换声：${stage}开启 —— 重复 ≥2 遍的单说话人材料，首遍用材料原标注音色、次遍换对侧（对话按角色分声、不参与轮读）`
    : `🔁 遍间换声：${stage}关闭 —— 真题惯例为同一人重读两遍（小学默认开启）`;
});

/**
 * 🗣 标题读法提示（2026-09-20 二次定版）：中英混排标题默认"按语种分读 + 同性别匹配"。
 * 用户实测否掉了"单条多语言音色通读"——那个方案下中文是外语母语者读的，像"外国人说中文蹩脚"。
 * 免费通道没有中英都母语的音色，故取"双语都地道"：中文用中文播报音色、英文用与其同性的英文音色。
 */
const listeningTitleMixedHint = computed(() => {
  const raw = String(listeningDocTitle.value || '');
  const mixed = /[\u3400-\u4dbf\u4e00-\u9fff]/.test(raw) && /[A-Za-z]/.test(raw);
  if (!mixed) return '';
  const t = listeningVoices.T;
  const singleMode = t === 'single' || (!!t && !['native', 'split', 'splitByLang'].includes(t));
  const zhName = (() => {
    const v = listeningVoices.Z || LISTENING_ZH_VOICE;
    const hit = LISTENING_ZH_VOICE_CANDIDATES.find((c) => c.voice === v);
    return hit ? hit.name.replace(/（.*?）/g, '').trim() : v;
  })();
  if (singleMode) {
    const v = t === 'single' ? LISTENING_MIXED_TITLE_VOICE : t;
    const hit = LISTENING_MIXED_TITLE_VOICE_CANDIDATES.find((c) => c.voice === v);
    return `🗣 标题中英混排：用「${hit ? hit.name.replace(/（.*?）/g, '').trim() : v}」一条音色通读 —— ⚠️ 该音色母语是英文，中文会带外国口音（如"外国人说中文"），想要地道中文请把「标题」槽切回"按语种分读"`;
  }
  return `🗣 标题中英混排：按语种分读 —— 中文用「${zhName}」、英文用同性别英文音色，中英各由母语音色朗读、段间无人工停顿（免费通道下最自然）`;
});


const closeListeningModal = () => {
  showListeningModal.value = false;
  listeningLoading.value = false;
  // 复用公共复位：关窗即清空结构/产物/卷级设定，避免下次打开看到上一卷的残留
  resetListeningPanel();
  listeningPasteMode.value = false;   // 下次从 🎧 听力稿按钮进入时默认走记录来源
};

/** 按当前结构化结果 + 覆盖参数渲染两种成品（覆盖变更时即时重跑，不重复调 AI） */
const renderListeningArtifacts = () => {
  if (!listeningStruct.value) return;
  const overrides = {};
  if (Number.isFinite(listeningWpmOverride.value) && listeningWpmOverride.value > 0) {
    overrides.wpm = listeningWpmOverride.value;
  }
  // 🎚 音色 → 覆盖音色表 + 音色池（音色池负责"多角色对话"的追加音色）
  overrides.voices = {
    us: { M: listeningVoices.M, W: listeningVoices.W, N: listeningVoices.M },
    gb: { M: listeningVoices.M, W: listeningVoices.W, N: listeningVoices.M },
  };
  // 🎙 中文播报（2026-09-20 开放配置）：Z 槽留空＝晓晓（默认），选定后覆盖全卷中文播报段
  if (listeningVoices.Z) overrides.zhVoice = listeningVoices.Z;
  // ⏳ 静默作答三档（2026-09-20 开放配置）：填了哪档就覆盖哪档，留空＝矩阵默认
  {
    const pauses = listeningAnswerGapOverrides();
    if (Object.keys(pauses).length) overrides.pauses = pauses;
  }

  const input = {
    items: listeningStruct.value.items,
    intro: listeningStruct.value.intro,
    stage: listeningStageKey.value,
    // 🔧 记录里只持久化了五档学段键（无年级字段）：年级信号回退到标题（如"八年级"），
    //    仅用于初中 7/8/9 年级的语速细分；标题无年级时自动落回该学段默认值。
    grade: listeningGradeHint.value,
    stageLabel: STAGE_LABEL_MAP[listeningStageKey.value] || listeningStageKey.value,
    // 🎙 试卷标题：录音最前独立播报（时间戳后缀由 buildTitleAnnouncement 净化）
    title: listeningDocTitle.value,
    // 🎛 可选环节（读试卷标题 / 试音段 / 一题一材料处播题号），用户可在弹窗内即时切换
    announceTitle: listeningAnnounceTitle.value,
    soundCheck: listeningSoundCheck.value,
    announceShortItemNo: listeningShortItemNo.value,
    // 🎚 音色池：多角色对话按顺序取（男主、女主、男声副、女声副）
    voicePoolInput: listeningVoicePool.value,
    // 🎙 英语旁白（2026-09-20 开放配置）：N 槽留空＝跟随男声；独白短文/英文题号都用它
    narratorVoice: listeningVoices.N || '',
    // 🗣 中英混合标题「同一人通读」多语言音色（T 槽留空＝默认 Andrew；'split' 可退回按语种分读）
    titleMixedVoice: listeningVoices.T || '',
    overrides,
  };

  const { ssml, risks, warnings } = buildListeningSsml(input);
  const { text } = buildListeningScriptText(input);
  // Edge 免费通道：与 SSML 同源重建 storyboard 段（纯函数零成本），供逐句合成
  const sb = buildListeningStoryboard(input);
  listeningSegments.value = sb.segments;
  // 🎚 配声摘要（2026-09-19 用户要求"能立即知道是否有多角色"；
  //    2026-09-20 用户追问"说话人 1 个 · 音色 2 条，这是啥意思，一个人两个音色？"后改为自解释）：

  //    两个数字数的是**不同的东西**，必须分开说清：
  //      · 说话人＝材料里有几个角色（对话里的 A/B、标注的 M/W；全篇未标注的独白算 1 个"旁白"）；
  //      · 音色＝实际听到几条声线——把**材料真正用到的音色逐条列名**，并说明多出的从哪来；
  //      · 音色池＝你配了几条（男主/女主/男声副/女声副），只在"配了却没用上"时才提。
  const voicesShort = (v) => {
    const hit = [...LISTENING_ZH_VOICE_CANDIDATES.map((c) => [c.voice, c.name]),
      ...LISTENING_MIXED_TITLE_VOICE_CANDIDATES.map((c) => [c.voice, c.name])]
      .find(([voice]) => voice === v);
    if (hit) return hit[1].replace(/（.*?）/g, '').trim();
    for (const [g, label] of [['M', '男声'], ['W', '女声']]) {
      const us = (LISTENING_VOICE_CANDIDATES.us[g] || []).indexOf(v);
      if (us >= 0) return `${label}${us + 1}·${v.replace(/^en-US-|Neural$/g, '')}`;
      const gb = (LISTENING_VOICE_CANDIDATES.gb[g] || []).indexOf(v);
      if (gb >= 0) return `${label}${gb + 1}·${v.replace(/^en-GB-|Neural$/g, '')}`;
    }
    return v.replace(/^[a-z]{2}-[A-Z]{2}-/, '').replace(/Neural$/, '');
  };
  const materialSegs = (sb.segments || []).filter((s) => s.kind === 'material' || s.kind === 'repeat');
  const usedVoices = [...new Set(materialSegs.map((s) => s.voice))];
  // 遍间换声生效？同一条材料的第 2 遍换了声线即成立
  const rotationOn = materialSegs.some((s) => {
    if (s.kind !== 'repeat') return false;
    const first = materialSegs.find((x) => x.kind === 'material' && x.itemNo === s.itemNo);
    return first && first.voice !== s.voice;
  });
  const cast = sb.voiceCast || [];
  const pool = sb.voicePool || [];
  // "角色"只数真正的说话人（N＝旁白/独白，不算角色；无标注角色时按 1 个旁白计）
  const roles = new Set(cast.flatMap((c) => (c.entries || []).map((e) => e.role)).filter((r) => r !== 'N'));
  const roleCount = roles.size || (cast.length ? 1 : 0);
  const over = cast.filter((c) => (c.entries || []).length > pool.length).map((c) => `第${c.itemNo}题`);
  listeningCastSummary.value = cast.length
    ? `说话人 ${roleCount} 个 · 材料实际用到 ${usedVoices.length} 条音色：${usedVoices.map(voicesShort).join(' + ')}`
      + (rotationOn ? '　↳ 单说话人材料按「遍间换声」分读，故声线数多于说话人数' : '')
      + (usedVoices.length !== pool.length ? `（音色池共 ${pool.length} 条：${pool.map(voicesShort).join('、')}）` : '')
      + (over.length ? `　⚠️ ${over.join('、')} 的角色多于音色，多出的角色会沿用已有音色（可补配"男声副/女声副"）` : '')
    : '';

  listeningSsml.value = ssml;
  listeningScriptText.value = text;
  listeningNotes.value = [
    ...(warnings || []),
    ...(listeningStruct.value.warnings || []),
    ...(risks || []).map(r => `${r.where}：${r.note}（${(r.samples || []).join('、')}）`),
  ];
};

/**
 * 打开弹窗前的公共复位（2026-09-20 抽出：**记录入口**与**粘贴入口**共用）
 * ============================================================
 * 目的：避免上一卷的设定串到这一卷（语速覆盖、三档作答留白、音色、可选环节、上一次的结构与产物）。
 * 🔴 只复位"卷级设定"与产物，**不动 listeningDocTitle / listeningStageKey / listeningGradeHint**——
 *    这三项是两条入口各自的来源（记录：doc.title/doc.stage；粘贴：用户在面板填写），
 *    由调用方在复位**之后**赋新值，顺序不能倒。
 */
const resetListeningPanel = () => {
  listeningError.value = '';
  listeningSsml.value = '';
  listeningScriptText.value = '';
  listeningSummary.value = '';
  listeningNotes.value = [];
  listeningStruct.value = null;
  listeningSegments.value = [];
  listeningWpmOverride.value = null;
  resetListeningAnswerGap();
  listeningAnnounceTitle.value = LISTENING_FEATURE_DEFAULTS.announceTitle;
  listeningSoundCheck.value = LISTENING_FEATURE_DEFAULTS.soundCheck;
  listeningShortItemNo.value = LISTENING_FEATURE_DEFAULTS.announceShortItemNo;
  Object.assign(listeningVoices, {
    M: LISTENING_VOICE_DEFAULTS.M,
    W: LISTENING_VOICE_DEFAULTS.W,
    N: '',
    Z: '',
    T: '',
    M2: LISTENING_VOICE_DEFAULTS.M2,
    W2: LISTENING_VOICE_DEFAULTS.W2,
  });
  listeningVoiceHint.value = '';
  listeningSynthMsg.value = '';
  listeningSynthLoading.value = false;
  listeningParseMode.value = '';
};

const openListeningTool = async (doc) => {
  resetListeningPanel();
  listeningPasteMode.value = false;   // 记录入口：从"答案页听力原文"走，不带粘贴面板
  listeningDocTitle.value = doc?.title || '';
  listeningStageKey.value = doc?.stage || '';
  listeningGradeHint.value = doc?.title || '';
  showListeningModal.value = true;

  const source = extractListeningSource(doc?.rawContent || doc?.content || '');
  if (!source) {
    listeningError.value = '未在答案页找到听力原文——听力原文仅英语卷、且需教师版（含答案）的记录。';
    return;
  }

  listeningLoading.value = true;
  try {
    // ① 规则解析优先（确定性）：题号/说话人/独白或对话都能直接抽出——可复现、零成本、可单测。
    //    解析结构对不对，不能寄望于"提示词写得好、模型就乖"，所以规则能定的绝不交给模型。
    const ruleParsed = parseListeningSourceText(source);
    let struct = ruleParsed;
    listeningParseMode.value = `规则解析（${ruleParsed.items.length} 段材料）`;

    // ② 规则抽不动时才调 AI 兜底；AI 失败也不丢规则结果
    if (needAiFallback(ruleParsed)) {
      if (apiConfig.currentEngine === 'ollama') {
        listeningError.value = '当前引擎为本地 Ollama，规则解析未取得可信结构，且该接口暂不支持本地模型——请在设置页把生成引擎切为云端（如 DeepSeek）后重试，或补充听力原文中的说话人标注。';
      } else {
        try {
          const raw = await chatNonThinkingOnce(buildListeningExtractMessages(source), { maxTokens: 8000, temperature: 0 });
          const aiParsed = parseListeningStructure(raw);
          struct = { ...aiParsed, warnings: [...(aiParsed.warnings || [])] };
          listeningParseMode.value = 'AI 解析（规则未取得可信结构，已由模型补充）';
        } catch (aiErr) {
          listeningError.value = `AI 兜底解析失败，已改用规则解析结果：${aiErr.message}`;
        }
      }
    }

    listeningStruct.value = struct;
    listeningSummary.value = summarizeListeningStructure(struct);
    renderListeningArtifacts();
  } catch (e) {
    listeningError.value = `听力稿生成失败：${e.message}`;
  } finally {
    listeningLoading.value = false;
  }
};

/**
 * 📋 打开"粘贴文本配音"（2026-09-20 新增入口）
 * ============================================================
 * 与记录入口的区别**只有来源**：这里没有 doc，标题/学段/年级全部来自面板输入；
 * 一旦解析出结构，后面（语速/音色/作答留白/SSML/朗读稿/逐句合成）走**完全相同**的代码路径。
 * 🔴 粘贴内容是**用户自己的材料**，反复调整很正常，故不复位文本框与标题；
 *    只把"卷级产物"清空（避免残留上一次的结构与音频），并把弹窗打开。
 */
const openListeningPaste = () => {
  listeningPasteMode.value = true;
  resetListeningPanel();
  listeningDocTitle.value = '';
  listeningStageKey.value = '';
  listeningGradeHint.value = '';
  onPasteStageChange();   // 学段仍是上次选的：把年级候选对齐（旧值不在候选里就回落「不指定」）
  showListeningModal.value = true;
};

/**
 * 📋 解析粘贴的素材并出稿（英文直解 / 中文先译）
 * ============================================================
 * 分流依据：detectSourceLanguage（CJK 占比 > 0.5 → 'zh'），与解析器的中文噪声守卫**同阈值**，
 *   避免"同一份文本两处判得不一样"。
 * · 'en'：规则解析 → 不可信才 AI 兜底（与记录入口同一套判据 needAiFallback）；
 * · 'zh'：**必须先翻译**——不是优化而是必需：特征锁实测中文材料直接进出声逻辑会被中文噪声守卫
 *   整段丢弃（材料段数=0）。翻译与搬运**共用同一 JSON 契约**，故下游零改动。
 * ⚠️ 翻译与兜底都依赖云端通道；本地 Ollama 给明确提示，不静默失败。
 */
const parseListeningPaste = async () => {
  const text = String(listeningPasteText.value || '').trim();
  if (!text || listeningLoading.value) return;
  if (!listeningPasteStage.value) {
    listeningError.value = '请先选择学段——它决定整卷语速与静默作答留白的档位（与记录入口同一套矩阵）。';
    return;
  }
  listeningLoading.value = true;
  listeningError.value = '';
  listeningSsml.value = '';
  listeningScriptText.value = '';
  listeningSummary.value = '';
  listeningNotes.value = [];
  listeningStruct.value = null;
  listeningSegments.value = [];
  listeningSynthMsg.value = '';
  listeningParseMode.value = '';
  // 标题 / 学段 / 年级 → 落到**与记录入口同名**的状态上，下游（renderListeningArtifacts、生成音频）零分支
  listeningDocTitle.value = String(listeningPasteTitle.value || '').trim();
  listeningStageKey.value = listeningPasteStage.value;
  listeningGradeHint.value = [listeningPasteGrade.value, listeningDocTitle.value]
    .map((s) => String(s || '').trim())
    .filter((s) => s && s !== '不指定')
    .join(' ');
  const lang = detectSourceLanguage(text);
  try {
    let struct;
    if (lang === 'zh') {
      if (apiConfig.currentEngine === 'ollama') {
        listeningError.value = '中文素材需先译为英语听力稿，这需要云端模型；当前引擎为本地 Ollama。请在「设置」把生成引擎切为云端（如 DeepSeek）后重试；若已有英语素材，直接粘贴英文即可。';
        return;
      }
      listeningParseMode.value = 'AI 翻译（中文素材 → 英语听力稿）';
      let raw;
      try {
        raw = await chatNonThinkingOnce(buildListeningTranslateMessages(text), { maxTokens: 8000, temperature: 0 });
      } catch (e) {
        listeningError.value = `中文素材翻译失败（该步骤需云端模型）：${e.message}`;
        return;
      }
      try {
        struct = parseListeningStructure(raw);
      } catch (e) {
        listeningError.value = `翻译结果无法结构化为听力稿：${e.message}。请确认粘贴的是听力素材正文（只有题目/选项时无材料可译）。`;
        return;
      }
    } else {
      const ruleParsed = parseListeningSourceText(text);
      struct = ruleParsed;
      listeningParseMode.value = `规则解析（${ruleParsed.items.length} 段材料）`;
      if (needAiFallback(ruleParsed)) {
        if (apiConfig.currentEngine === 'ollama') {
          listeningError.value = '当前引擎为本地 Ollama，规则解析未取得可信结构，且该接口暂不支持本地模型——请在设置页切为云端（如 DeepSeek）后重试，或给素材补上说话人标注（M:/W:）与题号。';
        } else {
          try {
            const raw = await chatNonThinkingOnce(buildListeningExtractMessages(text), { maxTokens: 8000, temperature: 0 });
            const aiParsed = parseListeningStructure(raw);
            struct = { ...aiParsed, warnings: [...(aiParsed.warnings || [])] };
            listeningParseMode.value = 'AI 解析（规则未取得可信结构，已由模型补充）';
          } catch (aiErr) {
            listeningError.value = `AI 兜底解析失败，已改用规则解析结果：${aiErr.message}`;
          }
        }
      }
    }

    listeningStruct.value = struct;
    listeningSummary.value = summarizeListeningStructure(struct);
    renderListeningArtifacts();
  } catch (e) {
    listeningError.value = `听力稿生成失败：${e.message}`;
  } finally {
    listeningLoading.value = false;
  }
};

/**
 * 🔴 重渲染去抖（2026-09-20 用户实测："滑块调节为啥反应很慢？"）
 * ============================================================
 * 原因：滑块/数值框每触发一次 input 就会走下方 watch，而 renderListeningArtifacts()
 *   要连跑 SSML + 朗读稿 + storyboard **三次全量构建**（题量和素材越大越慢）。
 *   拖动时每挪一步全量重算一次 → 手感明显发滞。
 * 处置：改成"停手 200ms 后再重算"——
 *   · 拖动过程界面仍即时跟手：滑块位置与"生效 X 词/分"都来自轻量 computed，不等重活；
 *   · 只有停下来才做全量重建；
 *   · 真正要吃数据的地方（生成音频 / 复制）先 flush，保证拿到的是最新结果、不产生 200ms 竞态。
 */
let listeningRenderTimer = null;
const runListeningRender = () => {
  if (showListeningModal.value && listeningStruct.value) renderListeningArtifacts();
};
const flushListeningRender = () => {
  if (!listeningRenderTimer) return;
  clearTimeout(listeningRenderTimer);
  listeningRenderTimer = null;
  runListeningRender();
};
const scheduleListeningRender = () => {
  if (listeningRenderTimer) clearTimeout(listeningRenderTimer);
  listeningRenderTimer = setTimeout(() => {
    listeningRenderTimer = null;
    runListeningRender();
  }, 200);
};

/**
 * 🎧 直接生成音频：按选定的语音合成通道出整卷 mp3 并落盘
 * · Edge 通道（默认，无需 Key）：逐句合成 + 帧级静音拼接，主进程执行
 * · Azure 通道（需 Key）：把整卷 SSML 交给 Azure 一次合成
 */
const generateListeningAudio = async () => {
  listeningSynthMsg.value = '';
  flushListeningRender();   // 先把挂起的重渲染落定，避免用旧参数合成
  if (!listeningSsml.value) return;
  const suggestedName = listeningDocTitle.value || '听力音频';

  if (listeningChannel.value === 'azure') {
    const cfg = readAzureConfigFromApiConfig(apiConfig);
    if (!cfg.key) {
      listeningSynthMsg.value = 'Azure 通道需先到「设置 → Azure 语音合成」填写 Key；无 Key 请改用「Edge 免费语音」通道。';
      return;
    }
    listeningSynthLoading.value = true;
    try {
      const r = await synthesizeToFile(listeningSsml.value, {
        key: cfg.key,
        region: cfg.region,
        outputFormat: cfg.outputFormat,
        suggestedName,
      });
      if (r && r.canceled) { listeningSynthMsg.value = '已取消保存（未消耗配额）。'; return; }
      listeningSynthMsg.value = r && r.path ? `✅ 已生成（Azure）：${r.path}` : '✅ 已生成音频';
      window.dispatchEvent(new CustomEvent(APP_EVENTS.SHOW_TOAST, {
        detail: { message: '✅ 听力音频已生成（Azure）', type: 'info' },
      }));
    } catch (e) {
      listeningSynthMsg.value = `音频生成失败：${e.message}`;
    } finally {
      listeningSynthLoading.value = false;
    }
    return;
  }

  // Edge 免费通道
  if (!listeningSegments.value.length) {
    listeningSynthMsg.value = '未取得可合成的分段（听力原文为空）。';
    return;
  }
  listeningSynthLoading.value = true;
  try {
    const r = await synthesizeSegmentsToFile(listeningSegments.value, { suggestedName });
    if (r && r.canceled) { listeningSynthMsg.value = '已取消保存。'; return; }
    listeningSynthMsg.value = r && r.path ? `✅ 已生成（Edge 免费）：${r.path}` : '✅ 已生成音频';
    window.dispatchEvent(new CustomEvent(APP_EVENTS.SHOW_TOAST, {
      detail: { message: '✅ 听力音频已生成（Edge 免费）', type: 'info' },
    }));
  } catch (e) {
    listeningSynthMsg.value = `音频生成失败：${e.message}`;
  } finally {
    listeningSynthLoading.value = false;
  }
};

const copyListeningText = async (kind) => {
  flushListeningRender();   // 同上：复制前先把挂起的重渲染落定
  const text = kind === 'ssml' ? listeningSsml.value : listeningScriptText.value;
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    window.dispatchEvent(new CustomEvent(APP_EVENTS.SHOW_TOAST, {
      detail: { message: kind === 'ssml' ? '✅ SSML 已复制，可粘贴到语音合成工具' : '✅ 朗读稿已复制', type: 'info' },
    }));
  } catch (e) {
    listeningError.value = `复制失败（剪贴板未授权）：${e.message}，请手动全选复制`;
  }
};

watch([listeningWpmOverride, listeningAnnounceTitle, listeningSoundCheck, listeningShortItemNo, () => listeningVoices.M, () => listeningVoices.W, () => listeningVoices.N, () => listeningVoices.Z, () => listeningVoices.T, () => listeningVoices.M2, () => listeningVoices.W2, () => listeningAnswerGap.short, () => listeningAnswerGap.long, () => listeningAnswerGap.fillIn], scheduleListeningRender);

// 🎙 语音通道：全链路一致（生成面板切换即记忆），落内存 + 轻量持久化（不重加密既有 Key）
watch(listeningChannel, (v) => {
  if (!v) return;
  apiConfig.speechChannel = v;
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEYS.API_CONFIG) || '{}');
    raw.speechChannel = v;
    localStorage.setItem(STORAGE_KEYS.API_CONFIG, JSON.stringify(raw));
  } catch { /* 持久化失败不影响本次会话 */ }
});

/**
 * 对外接口（defineExpose）——父组件只调这两个，其余全部内部自治
 * ============================================================
 * · openFromRecord：记录入口（生成结果卡片「🎧 听力稿」）——从答案页截出听力原文再走解析；
 * · openPaste：粘贴入口（独立功能页「🎧 听力配音」）——不依赖任何记录。
 * 两个入口**只在"来源"上不同**：一旦拿到结构，语速/音色/作答留白/渲染/合成完全同源。
 */
defineExpose({
  openFromRecord: openListeningTool,
  openPaste: openListeningPaste,
});

/** 独立功能页：默认直接进"粘贴素材"模式（这个页面存在的意义就是"没有记录也能配音"） */
onMounted(() => {
  if (props.variant === 'page') openListeningPaste();
});
</script>

<style scoped>
/* ⚠️ 以下弹窗规则**照抄自 GenerateModule 原样式**：弹窗 Teleport 到 body 后，
   节点带的是本组件的 scopeId，父组件的 scoped 样式不再命中，必须自带一份。 */
.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3500;
}

.modal {
  background: white;
  border-radius: 16px;
  padding: 24px;
  min-width: 400px;
  max-width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  pointer-events: auto;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1), 0 8px 24px rgba(0,0,0,0.12), 0 16px 48px rgba(0,0,0,0.16);
  border: 2px solid var(--border);
  position: relative;
}

.modal::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 5px;
  background: linear-gradient(90deg, var(--primary-light) 0%, #4a90d9 50%, var(--primary-light) 100%);
  border-radius: 14px 14px 0 0;
}

.large-modal {
  min-width: 600px;
  max-height: 90vh;
}

.modal h3 {
  margin-bottom: 20px;
  color: var(--primary);
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;
}

.copy-hint {
  padding: 8px 16px;
  margin-bottom: 8px;
  background: var(--success-light);
  border: 1px solid #a5d6a7;
  border-radius: 6px;
  color: #2e7d32;
  font-size: 13px;
  text-align: center;
}

/* ===== 独立功能页形态：常驻面板，不用遮罩、不用弹窗 ===== */
.lw-inline-mask {
  display: block;
  width: 100%;
  padding: 0 0 24px;
  box-sizing: border-box;
}

.lw-inline-panel {
  background: var(--bg-card, #fff);
  border: 1px solid var(--border-light, #e2e8f0);
  border-radius: 10px;
  padding: 18px 18px 20px;
  box-sizing: border-box;
}

.lw-inline-panel h3 {
  margin-bottom: 12px;
  color: var(--primary);
  font-size: 16px;
}

@media (max-width: 767px) {
  .modal-mask {
    padding: env(safe-area-inset-top, 12px) 12px env(safe-area-inset-bottom, 12px) 12px;
    box-sizing: border-box;
  }
  .hide-on-mobile { display: none !important; }
  .large-modal { min-width: 0; }
}
</style>
