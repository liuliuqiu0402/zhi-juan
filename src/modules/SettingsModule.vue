<template>
  <div class="embedded-page">
    <div class="page-header">
      <h2>⚙️ 系统设置</h2>
      <button class="btn-primary" @click="saveSettings">保存设置</button>
    </div>
    <div class="settings-content">
      <!-- 激活信息 -->
      <div class="settings-section">
        <h3>📋 激活信息</h3>
        <div class="info-row">
          <span>版本：</span>
          <span class="info-value">{{ versionLabel }}</span>
        </div>
        <div class="info-row">
          <span>机器码：</span>
          <span class="info-value">{{ machineId }}</span>
        </div>
        <div class="info-row">
          <span>到期时间：</span>
          <span class="info-value">{{ expireDateLabel }}</span>
        </div>
        <div class="info-row" v-if="remainingDays !== null">
          <span>剩余天数：</span>
          <span class="info-value" :style="{ color: remainingDays <= 7 ? 'var(--danger)' : 'var(--success)' }">{{ remainingDays }} 天</span>
        </div>
        <button class="btn" @click="handleChangeActivation">🔄 更换激活码</button>
        <p class="hint" style="margin-top: 12px;">如需购买或续费，请联系客服</p>
      </div>

      <!-- 🔑 同步密钥 -->
      <div class="settings-section">
        <h3>🔑 同步密钥</h3>
        <p style="font-size:12px;color:#666;margin-bottom:8px;">
          多设备间共享数据的唯一凭证。请在各设备上输入相同的密钥。留空则不同步。
        </p>
        <input
          type="text"
          v-model="syncKeyInput"
          placeholder="输入4位同步密钥"
          maxlength="16"
          style="font-family: monospace; letter-spacing: 2px; text-transform: uppercase;"
          @change="onSyncKeyChange"
        />
      </div>

      <!-- 🔧 本设备标识 -->
      <div class="settings-section">
        <h3>🔧 本设备标识</h3>
        <p style="font-size:12px;color:#666;margin-bottom:8px;">
          设备名即云端标识。重装后输入同名即可自动恢复数据，不同设备请用不同名称。
        </p>
        <div class="info-row">
          <span>设备名称：</span>
          <input
            v-model="deviceNameInput"
            @blur="onDeviceNameChange"
            @keyup.enter="onDeviceNameEnter"
            class="device-name-input"
            placeholder="输入设备名称"
            maxlength="30"
          />
        </div>
      </div>

      <!-- 📱 iOS 签名倒计时（仅手机端显示） -->
      <div class="settings-section" v-if="isCapacitorIOS">
        <h3>📱 签名倒计时</h3>
        <template v-if="signInfo.found">
          <div class="info-row">
            <span>预计到期：</span>
            <span class="info-value">{{ signInfo.expirationDate || '未知' }}</span>
          </div>
          <div class="info-row">
            <span>剩余时间：</span>
            <span class="info-value" :style="{ color: signDaysInfo.color, fontWeight: signDaysInfo.warning ? 'bold' : 'normal' }">
              {{ signDaysInfo.text }}
            </span>
          </div>
          <div v-if="signDaysInfo.warning" style="margin-top:8px;padding:8px 12px;background:#fff5f5;border:1px solid #feb2b2;border-radius:8px;font-size:12px;color:#c53030;">
            ⚠️ 签名即将到期！请在电脑上打开爱思助手 → 连接手机 → 重新签名安装。
          </div>
          <button class="btn" @click="handleResetCountdown" style="margin-top:8px;">
            🔄 已续签，重置倒计时
          </button>
          <p style="font-size:11px;color:#999;margin-top:4px;">
            💡 每次用爱思助手重新签名安装后，点这里重置 7 天倒计时。
          </p>
        </template>
      </div>

      <!-- AI引擎 -->
      <div class="settings-section">
        <h3>🤖 AI 引擎（文本任务）</h3>
        <select v-model="settings.currentEngine">
          <option value="ollama">💻 Ollama (本地)</option>
          <option value="deepseek">🌐 DeepSeek (云端)</option>
        </select>
        <p style="font-size:12px;color:#666;margin-top:8px;">
          💡 文本生成、分析、审查等任务根据此处选择
        </p>
      </div>

      <!-- DeepSeek配置 -->
      <div v-if="settings.currentEngine === 'deepseek'" class="settings-section">
        <h3>🔑 DeepSeek API Key</h3>
        <input type="password" v-model="settings.deepseekApiKey" placeholder="输入 API Key" />
        <input type="text" v-model="settings.deepseekBaseUrl" placeholder="API 地址" />

        <h3 style="margin-top: 16px;">🧠 DeepSeek 模型分配</h3>
        <p style="font-size:12px;color:#666;margin-bottom:12px;">
          💡 系统共两处调用 DeepSeek，分开配置：Pro=推理强·慢&nbsp;&nbsp;|&nbsp;&nbsp;Flash=快速
        </p>

        <label>📝 资料生成模型</label>
        <p class="model-hint" style="margin-bottom: 4px;">调用时机：点击生成按钮 → 出题/组卷/预习单等（频繁调用，建议 Flash）</p>
        <select v-model="settings.deepseekGenerationModel">
          <option v-for="m in deepseekModelOptions" :key="'gen_' + m" :value="m">{{ formatDeepSeekModel(m) }}</option>
        </select>
        <p class="model-hint">涵盖：整卷生成 / 蓝图规划 / 答案格式化</p>

        <label style="margin-top: 12px;">📋 教材分析模型</label>
        <p class="model-hint" style="margin-bottom: 4px;">调用时机：导入教材 → 分析知识点/认知层次（每章一次，缓存复用，建议 Pro）</p>
        <select v-model="settings.deepseekAnalysisModel">
          <option v-for="m in deepseekModelOptions" :key="'ana_' + m" :value="m">{{ formatDeepSeekModel(m) }}</option>
        </select>
        <p class="model-hint">涵盖：知识提取 / 认知分类 / 质量审查</p>
      </div>

      <!-- 多模态引擎 -->
      <div class="settings-section">
        <h3>🖼️ 多模态引擎（图片识别/OCR）</h3>
        <p style="font-size:12px;color:#666;margin-top:4px;margin-bottom:12px;">
          PaddleOCR-VL —— 本地运行不占 Ollama 显存，支持 pipeline 文档解析 + VLM 视觉理解，用完自动释放 GPU
        </p>

        <label style="margin-top: 8px;">理科图表处理</label>
        <select v-model="settings.analyzeCharts">
          <option :value="false">跳过（仅提取文字）</option>
          <option :value="true">分析（用 AI 描述图表）</option>
        </select>
      </div>

      <!-- Ollama配置 -->
      <div v-if="settings.currentEngine === 'ollama'" class="settings-section">
        <h3>🦙 Ollama 配置（文本任务）</h3>
        <label>服务地址</label>
        <input type="text" v-model="settings.ollamaBaseUrl" placeholder="http://localhost:11434" />

        <label>重型模型（命题生成、蓝图规划）</label>
        <select v-model="settings.ollamaTextModel">
          <option v-for="m in availableTextModels" :key="m" :value="m">{{ formatModelName(m) }}</option>
        </select>
        <p class="model-hint">💡 deepseek-r1:14b→考卷/命题推理最强 | glm4:9b→知识点总结最优 | qwen2.5:14b→全类型稳定</p>

        <label>轻量模型（分析、提取、格式化）</label>
        <select v-model="settings.ollamaLightModel">
          <option v-for="m in availableTextModels" :key="'light_' + m" :value="m">{{ formatModelName(m) }}</option>
        </select>
        <p class="model-hint">💡 glm4:9b→分析提取精准 | qwen2.5:7b→轻快省显存</p>

        <label>📝 题目生成模型（可选）</label>
        <select v-model="settings.ollamaQuestionGenModel">
          <option value="">跟随重型模型</option>
          <option v-for="m in availableTextModels" :key="'qgen_' + m" :value="m">{{ formatModelName(m) }}</option>
        </select>
        <p class="model-hint">💡 deepseek-r1:14b→命题推理最准确 | 留空=跟随重型模型</p>

        <label>📊 质量审查模型（可选）</label>
        <select v-model="settings.ollamaReviewModel">
          <option value="">跟随重型模型</option>
          <option v-for="m in availableTextModels" :key="'rev_' + m" :value="m">{{ formatModelName(m) }}</option>
        </select>
        <p class="model-hint">💡 deepseek-r1:8b 或 glm4:9b→审查需思维链推理 | 留空=跟随重型模型</p>

        <label>📋 分析提取模型（可选）</label>
        <select v-model="settings.ollamaAnalysisModel">
          <option value="">跟随重型模型</option>
          <option v-for="m in availableTextModels" :key="'ana_' + m" :value="m">{{ formatModelName(m) }}</option>
        </select>
        <p class="model-hint">💡 glm4:9b→结构化分析精准 | qwen2.5:7b→轻量快速 | 留空=跟随重型模型</p>

        <button class="btn-small" @click="refreshModels">🔄 刷新模型列表</button>
        <div v-if="saveStatus" class="model-hint" style="margin-top:8px;color:var(--primary-light);">
          {{ saveStatus }}
        </div>
      </div>

      <!-- 存储路径 -->
      <div class="settings-section">
        <h3>💾 存储路径</h3>
        <div style="display: flex; gap: 8px; align-items: center;">
          <input type="text" v-model="settings.storagePath" placeholder="例如：D:\\智卷工坊数据"
            style="flex: 1; padding: 8px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px;" />
          <button class="btn-small" @click="selectStoragePath" style="white-space: nowrap; padding: 8px 16px;">📁 选择文件夹</button>
        </div>
      </div>

      <!-- 生成设置 -->
      <div class="settings-section">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <h3 style="margin:0;">🎲 生成设置（温度：控制输出随机性）</h3>
          <button class="btn-small" @click="resetTemperatureDefaults" style="font-size:11px;padding:4px 10px;">🔄 恢复默认</button>
        </div>

        <!-- 分析/提取 -->
        <div style="margin-bottom:14px;">
          <label style="display:flex;justify-content:space-between;">
            <span>📊 分析 / 提取</span>
          </label>
          <div style="display:flex;align-items:center;gap:6px;">
            <span style="font-size:10px;color:#999;min-width:14px;">0</span>
            <div style="position:relative;flex:1;">
              <span :style="{ position:'absolute', left: `calc(${((settings.generationSettings.analysisTemperature ?? 0.1) / 1.0 * 100).toFixed(1)}% + 6px - ${((settings.generationSettings.analysisTemperature ?? 0.1) / 1.0 * 10).toFixed(0)}px)`, top: '-20px', transform: 'translateX(-50%)', background: 'var(--primary,#4a90d9)', color: '#fff', fontSize: '11px', fontWeight: '600', padding: '1px 6px', borderRadius: '8px', whiteSpace: 'nowrap', pointerEvents: 'none' }">{{ (settings.generationSettings.analysisTemperature ?? 0.1).toFixed(1) }}</span>
              <input type="range" v-model.number="settings.generationSettings.analysisTemperature" min="0" max="1.0" step="0.1" list="ticks-1_0" style="width:100%;" />
            </div>
            <span style="font-size:10px;color:#999;min-width:22px;">1.0</span>
          </div>
          <datalist id="ticks-1_0"><option value="0"></option><option value="0.5"></option><option value="1.0"></option></datalist>
          <p style="font-size:11px;color:#888;margin:2px 0 0;">知识点提取、内容分析、格式化——低温确保准确</p>
        </div>

        <!-- 蓝图生成 -->
        <div style="margin-bottom:14px;">
          <label style="display:flex;justify-content:space-between;">
            <span>🗺️ 蓝图生成</span>
          </label>
          <div style="display:flex;align-items:center;gap:6px;">
            <span style="font-size:10px;color:#999;min-width:14px;">0</span>
            <div style="position:relative;flex:1;">
              <span :style="{ position:'absolute', left: `calc(${((settings.generationSettings.blueprintTemperature ?? 0.3) / 1.0 * 100).toFixed(1)}% + 6px - ${((settings.generationSettings.blueprintTemperature ?? 0.3) / 1.0 * 10).toFixed(0)}px)`, top: '-20px', transform: 'translateX(-50%)', background: 'var(--primary,#4a90d9)', color: '#fff', fontSize: '11px', fontWeight: '600', padding: '1px 6px', borderRadius: '8px', whiteSpace: 'nowrap', pointerEvents: 'none' }">{{ (settings.generationSettings.blueprintTemperature ?? 0.3).toFixed(1) }}</span>
              <input type="range" v-model.number="settings.generationSettings.blueprintTemperature" min="0" max="1.0" step="0.1" list="ticks-1_0" style="width:100%;" />
            </div>
            <span style="font-size:10px;color:#999;min-width:22px;">1.0</span>
          </div>
          <p style="font-size:11px;color:#888;margin:2px 0 0;">命题蓝图、题型规划——有结构约束，中低温</p>
        </div>

        <!-- 题目生成 -->
        <div style="margin-bottom:14px;">
          <label style="display:flex;justify-content:space-between;">
            <span>✏️ 题目生成</span>
          </label>
          <div style="display:flex;align-items:center;gap:6px;">
            <span style="font-size:10px;color:#999;min-width:14px;">0</span>
            <div style="position:relative;flex:1;">
              <span :style="{ position:'absolute', left: `calc(${((settings.generationSettings.questionTemperature ?? 0.5) / 1.5 * 100).toFixed(1)}% + 6px - ${((settings.generationSettings.questionTemperature ?? 0.5) / 1.5 * 10).toFixed(0)}px)`, top: '-20px', transform: 'translateX(-50%)', background: 'var(--primary,#4a90d9)', color: '#fff', fontSize: '11px', fontWeight: '600', padding: '1px 6px', borderRadius: '8px', whiteSpace: 'nowrap', pointerEvents: 'none' }">{{ (settings.generationSettings.questionTemperature ?? 0.5).toFixed(1) }}</span>
              <input type="range" v-model.number="settings.generationSettings.questionTemperature" min="0" max="1.5" step="0.1" list="ticks-1_5" style="width:100%;" />
            </div>
            <span style="font-size:10px;color:#999;min-width:22px;">1.5</span>
          </div>
          <datalist id="ticks-1_5"><option value="0"></option><option value="0.5"></option><option value="1.0"></option><option value="1.5"></option></datalist>
          <p style="font-size:11px;color:#888;margin:2px 0 0;">逐题生成、整卷生成——平衡准确性与创造性</p>
        </div>

        <!-- 质量审查 -->
        <div style="margin-bottom:0;">
          <label style="display:flex;justify-content:space-between;">
            <span>🔍 质量审查 / 验算</span>
          </label>
          <div style="display:flex;align-items:center;gap:6px;">
            <span style="font-size:10px;color:#999;min-width:14px;">0</span>
            <div style="position:relative;flex:1;">
              <span :style="{ position:'absolute', left: `calc(${((settings.generationSettings.reviewTemperature ?? 0.1) / 1.0 * 100).toFixed(1)}% + 6px - ${((settings.generationSettings.reviewTemperature ?? 0.1) / 1.0 * 10).toFixed(0)}px)`, top: '-20px', transform: 'translateX(-50%)', background: 'var(--primary,#4a90d9)', color: '#fff', fontSize: '11px', fontWeight: '600', padding: '1px 6px', borderRadius: '8px', whiteSpace: 'nowrap', pointerEvents: 'none' }">{{ (settings.generationSettings.reviewTemperature ?? 0.1).toFixed(1) }}</span>
              <input type="range" v-model.number="settings.generationSettings.reviewTemperature" min="0" max="1.0" step="0.1" list="ticks-1_0" style="width:100%;" />
            </div>
            <span style="font-size:10px;color:#999;min-width:22px;">1.0</span>
          </div>
          <p style="font-size:11px;color:#888;margin:2px 0 0;">审查、验证、评分——最低温确保客观</p>
        </div>

        <p style="font-size:12px;color:#666;margin-top:8px;border-top:1px solid #eee;padding-top:8px;">
          💡 <b>0=完全确定</b>（每次输出相同），<b>0.3=低随机</b>，<b>0.5=平衡</b>，<b>1.0+=高创意</b>
        </p>
        <div style="margin-top:10px;background:#f8f9fa;border-radius:8px;padding:10px 12px;font-size:11px;line-height:1.6;color:#555;">
          <div style="font-weight:600;margin-bottom:6px;color:#333;">📖 温度使用指南</div>
          <table style="width:100%;border-collapse:collapse;font-size:11px;">
            <tr style="border-bottom:1px solid #e0e0e0;">
              <td style="padding:3px 4px;font-weight:600;white-space:nowrap;">📊 分析/提取</td>
              <td style="padding:3px 4px;"><b>0–0.2</b> 精准稳定 · <b>0.3+</b> 可能产生幻觉，不推荐</td>
            </tr>
            <tr style="border-bottom:1px solid #e0e0e0;">
              <td style="padding:3px 4px;font-weight:600;white-space:nowrap;">🗺️ 蓝图生成</td>
              <td style="padding:3px 4px;"><b>0.2–0.4</b> 结构清晰 · <b>0.5+</b> 题型搭配可能偏离</td>
            </tr>
            <tr style="border-bottom:1px solid #e0e0e0;">
              <td style="padding:3px 4px;font-weight:600;white-space:nowrap;">✏️ 题目生成</td>
              <td style="padding:3px 4px;"><b>0.3–0.5</b> 格式稳定 · <b>0.6–0.8</b> 题型多样 · <b>1.0+</b> 开放创意</td>
            </tr>
            <tr>
              <td style="padding:3px 4px;font-weight:600;white-space:nowrap;">🔍 质量审查</td>
              <td style="padding:3px 4px;"><b>0–0.2</b> 客观严格 · <b>0.3+</b> 审查标准可能漂移，不推荐</td>
            </tr>
          </table>
          <p style="margin:6px 0 0;color:#999;">⚡ 温度 0 不保证绝对一致（GPU 浮点运算有微小差异），但差异可忽略</p>
        </div>
      </div>

      <!-- 数据备份 -->
      <div class="settings-section">
        <h3>💾 数据备份与恢复</h3>
        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
          <button class="btn" @click="exportData" :disabled="isExporting">
            {{ isExporting ? '导出中...' : '📥 导出备份' }}
          </button>
          <button class="btn" @click="selectAndImport" :disabled="isImporting">
            {{ isImporting ? '导入中...' : '📤 导入恢复' }}
          </button>
        </div>
        <p v-if="backupStatus" style="margin-top: 10px; font-size: 13px; color: var(--primary-light);">
          {{ backupStatus }}
        </p>
        <p style="margin-top: 8px; font-size: 12px; color: var(--text-muted);">
          💡 导出备份可保存教材库、模板库、指令库、设置等全部数据。导入时已存在的数据不会被覆盖。
        </p>
      </div>

      <!-- Python 依赖 -->
      <div class="settings-section">
        <h3>🐍 Python 依赖管理</h3>
        <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
          <button class="btn" @click="checkPythonDeps" :disabled="isCheckingDeps">
            {{ isCheckingDeps ? '检测中...' : '🔍 检测依赖' }}
          </button>
          <button class="btn-primary" @click="installPythonDeps" :disabled="isInstallingDeps">
            {{ isInstallingDeps ? '安装中...' : '⚡ 一键安装缺失依赖' }}
          </button>
        </div>
        <p v-if="pythonDepsStatus" style="margin-top: 10px; font-size: 13px; color: var(--primary-light);">
          {{ pythonDepsStatus }}
        </p>
        <p v-if="missingDeps.length > 0" style="margin-top: 8px; font-size: 12px; color: var(--warning);">
          ⚠️ 缺失：{{ missingDeps.join(', ') }}
        </p>
        <p style="margin-top: 8px; font-size: 12px; color: var(--text-muted);">
          💡 PDF转图片、缩略图生成等功能需要以下 Python 包：PyMuPDF、Pillow、numpy、opencv-python
        </p>
      </div>

      <!-- 📋 操作日志 -->
      <div class="settings-section">
        <h3>📋 操作日志 <span style="font-weight:normal;font-size:11px;color:#999;">({{ logStore.logs.length }})</span></h3>
        <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px;">
          <select v-model="logFilter" style="width:auto;font-size:11px;padding:4px 6px;">
            <option value="">全部级别</option>
            <option value="error">🔴 错误</option>
            <option value="warn">🟡 警告</option>
            <option value="log">🔵 日志</option>
          </select>
          <button class="btn-small" @click="copyLogsToClipboard">📋 复制</button>
          <button class="btn-small" @click="logStore.clearLogs()">🗑️ 清空</button>
        </div>
        <div class="log-viewer" v-if="filteredLogs.length > 0">
          <div
            v-for="entry in filteredLogs" :key="entry.id"
            class="log-entry"
            :class="'log-' + entry.level"
          >
            <span class="log-time">{{ entry.time }}</span>
            <span class="log-msg">{{ entry.message }}</span>
          </div>
        </div>
        <p v-else style="font-size:11px;color:#999;">暂无日志记录</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { Capacitor } from '@capacitor/core';
import { useActivation } from '@/composables/useActivation.js';
import { useDialog } from '@/composables/useDialog.js';
import { useBackup } from '@/composables/useBackup.js';
import { useWebAuth, clearWebAuth } from '@/composables/useWebAuth.js';
import useLogger, { copyLogs } from '@/composables/useLogger.js';
import { apiConfig, getAvailableModels, refreshConfigCache, saveConfig, decrypt, autoDiscoverDeepSeekModel } from '@/config/apiConfig.js';
import { cancelAllRequests } from '@/utils/requestManager.js';
import { getSyncKey, setSyncKey, getDeviceName, setDeviceName, probeCloud } from '@/utils/cloudStorage';
import { getSignCountdown, resetInstallTime, formatDaysRemaining } from '@/utils/signatureCheck';

const { showAlertDialogFn } = useDialog();
const {
  isExporting,
  isImporting,
  backupStatus,
  exportData,
  selectAndImport
} = useBackup();

// Python 依赖管理
const isCheckingDeps = ref(false);
const isInstallingDeps = ref(false);
const missingDeps = ref([]);
const pythonDepsStatus = ref('');

const checkPythonDeps = async () => {
  isCheckingDeps.value = true;
  pythonDepsStatus.value = '正在检测...';
  try {
    if (window.electronAPI?.checkPythonDeps) {
      const deps = await window.electronAPI.checkPythonDeps();
      missingDeps.value = [];
      if (!deps.PyMuPDF) missingDeps.value.push('PyMuPDF');
      if (!deps.Pillow) missingDeps.value.push('Pillow');
      if (!deps.numpy) missingDeps.value.push('numpy');
      if (!deps.opencv) missingDeps.value.push('opencv-python');

      if (missingDeps.value.length === 0) {
        pythonDepsStatus.value = '✅ 所有 Python 依赖已就绪';
      } else {
        pythonDepsStatus.value = `⚠️ 缺失 ${missingDeps.value.length} 个依赖`;
      }
    } else {
      pythonDepsStatus.value = 'ℹ️ 非 Electron 环境，跳过检测';
    }
  } catch (e) {
    pythonDepsStatus.value = '❌ 检测失败：' + e.message;
  } finally {
    isCheckingDeps.value = false;
  }
};

const installPythonDeps = async () => {
  isInstallingDeps.value = true;
  pythonDepsStatus.value = '正在安装...（可能需要几分钟）';
  try {
    if (window.electronAPI?.installPythonDeps) {
      const result = await window.electronAPI.installPythonDeps();
      if (result.success) {
        pythonDepsStatus.value = '✅ 安装成功！';
        missingDeps.value = [];
      } else {
        pythonDepsStatus.value = '❌ 安装失败：' + (result.error || '未知错误');
      }
    } else {
      pythonDepsStatus.value = 'ℹ️ 请在终端手动运行：pip install pymupdf pillow numpy opencv-python';
    }
  } catch (e) {
    pythonDepsStatus.value = '❌ 安装失败：' + e.message;
  } finally {
    isInstallingDeps.value = false;
  }
};

const {
  machineId, licenseInfo, versionLabel, expireDateLabel,
  remainingDays, changeActivationCode, checkActivationStatus
} = useActivation();

const isCapacitorIOS = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
const isWebMode = typeof window !== 'undefined' && !window.electronAPI;

// 📋 操作日志
const logStore = useLogger();
const logFilter = ref('');
const filteredLogs = computed(() => {
  if (!logFilter.value) return [...logStore.logs].reverse();
  return logStore.logs.filter(l => l.level === logFilter.value).reverse();
});
const copyLogsToClipboard = async () => {
  const ok = await copyLogs();
  if (ok) {
    window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: '✅ 日志已复制到剪贴板', type: 'info' } }));
  } else {
    window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: '❌ 复制失败，请检查浏览器权限', type: 'warning' } }));
  }
};

// 🔑 同步密钥
const syncKeyInput = ref(getSyncKey() || '');
const onSyncKeyChange = () => {
  const trimmed = syncKeyInput.value.trim().toUpperCase();
  if (trimmed) {
    setSyncKey(trimmed);
    console.log('🔑 同步密钥已更新:', trimmed);
    // 密钥变更后重新探测云端数据
    probeCloud();
  }
};

// 🔧 设备名称（可编辑，即设备标识，重装后输入同名可恢复数据）
const deviceName = ref(getDeviceName());
const deviceNameInput = ref(deviceName.value);

const onDeviceNameChange = () => {
  const trimmed = deviceNameInput.value.trim();
  if (trimmed && trimmed !== deviceName.value) {
    setDeviceName(trimmed);
    deviceName.value = trimmed;
    console.log('🏷️ 设备名已更新:', trimmed);
    window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: '✅ 设备名已更新，下次上推时生效', type: 'info' } }));
  }
};

const onDeviceNameEnter = (e) => {
  e.target.blur();
};

// 📱 签名倒计时
const signInfo = ref(getSignCountdown());
const signDaysInfo = ref(formatDaysRemaining(signInfo.value.daysRemaining));

const handleResetCountdown = () => {
  resetInstallTime();
  signInfo.value = getSignCountdown();
  signDaysInfo.value = formatDaysRemaining(signInfo.value.daysRemaining);
  // 通知 App.vue 更新顶部徽章
  window.dispatchEvent(new CustomEvent('sign-countdown-reset'));
};

//  更换激活码 / 访问码
const handleChangeActivation = async () => {
  if (isWebMode) {
    // 📱 手机端：清除访问码授权，回到访问码输入界面（模拟"换码"体验）
    clearWebAuth();
    window.location.reload();
    return;
  }
  // 🖥️ 桌面端：清除激活信息，触发激活弹窗
  try {
    await changeActivationCode();
  } catch {
    localStorage.removeItem('activationInfo');
  }
  window.location.reload();
};

const settings = ref({
  currentEngine: apiConfig.currentEngine,
  ollamaBaseUrl: apiConfig.ollamaBaseUrl,
  ollamaTextModel: apiConfig.ollamaTextModel,
  ollamaLightModel: apiConfig.ollamaLightModel,
  ollamaMultimodalModel: apiConfig.ollamaMultimodalModel,
  ollamaQuestionGenModel: apiConfig.ollamaQuestionGenModel || '',
  ollamaReviewModel: apiConfig.ollamaReviewModel || '',
  ollamaAnalysisModel: apiConfig.ollamaAnalysisModel || '',
  multimodalEngine: apiConfig.multimodalEngine || 'paddleocr_vl',
  deepseekBaseUrl: apiConfig.deepseekBaseUrl,
  deepseekApiKey: apiConfig.deepseekApiKey,
  deepseekGenerationModel: apiConfig.deepseekGenerationModel || 'deepseek-v4-flash',
  deepseekAnalysisModel: apiConfig.deepseekAnalysisModel || 'deepseek-v4-pro',
  analyzeCharts: true,
  storagePath: localStorage.getItem('storagePath') || '智卷工坊数据',
  generationSettings: { ...apiConfig.generationSettings }
});

const availableTextModels = ref(['qwen2.5:7b', 'qwen2:7b']);

// 🔧 DeepSeek 模型选项（优先云端发现，兜底常用列表）
const deepseekModelOptions = ref(['deepseek-v4-flash', 'deepseek-v4-pro']);

const formatDeepSeekModel = (model) => {
  const nameMap = {
    'deepseek-v4-pro': '🧠 deepseek-v4-pro（推理强·慢）',
    'deepseek-v4-flash': '⚡ deepseek-v4-flash（快速）',
    'deepseek-chat': '💬 deepseek-chat（通用）',
    'deepseek-reasoner': '🧠 deepseek-reasoner（推理）',
  };
  return nameMap[model] || model;
};

const saveStatus = ref('');

const formatModelName = (modelName) => {
  const nameMap = {
    'deepseek-r1:32b': '🧠 deepseek-r1:32b（推理最强·需大显存）',
    'deepseek-r1:14b': '🧠 deepseek-r1:14b（考卷/命题最优）',
    'deepseek-r1:8b': '🧠 deepseek-r1:8b（性价比之选）',
    'glm4:9b': '📚 glm4:9b（总结/学术精准）',
    'qwen2.5:14b': '🌟 qwen2.5:14b（全类型稳定）',
    'qwen2.5:7b': '🌟 qwen2.5:7b（日常轻量）',
    'qwen2.5:1.5b': '📘 qwen2.5:1.5b（极轻量）',
    'qwen2:7b': '📘 qwen2:7b（旧版）',
    'qwen3-vl:8b': '👁️ qwen3-vl:8b（多模态OCR）',
    'llava:13b': '🔄 llava:13b（多模态）',
    'llava:7b': '🌱 llava:7b（多模态轻量）',
    'minicpm-v:8b': '👁️ minicpm-v:8b（多模态）',
  };
  return nameMap[modelName] || modelName;
};

const selectStoragePath = async () => {
  try {
    const selectedPath = await window.electronAPI.selectDirectory();
    if (selectedPath) {
      settings.value.storagePath = selectedPath;
      localStorage.setItem('storagePath', selectedPath);
      await showAlertDialogFn(`✅ 存储路径已设置为：\n${selectedPath}`);
    }
  } catch (error) {
    await showAlertDialogFn('❌ 选择文件夹失败，请手动输入路径');
  }
};

const resetTemperatureDefaults = () => {
  settings.value.generationSettings.analysisTemperature = 0.1;
  settings.value.generationSettings.blueprintTemperature = 0.3;
  settings.value.generationSettings.questionTemperature = 0.5;
  settings.value.generationSettings.reviewTemperature = 0.1;
};

const saveSettings = async () => {
  const oldEngine = apiConfig.currentEngine;
  const newEngine = settings.value.currentEngine;

  if (oldEngine !== newEngine) {
    await cancelAllRequests();
  }

  apiConfig.currentEngine = settings.value.currentEngine;
  apiConfig.ollamaBaseUrl = settings.value.ollamaBaseUrl;
  apiConfig.ollamaTextModel = settings.value.ollamaTextModel;
  apiConfig.ollamaLightModel = settings.value.ollamaLightModel;
  apiConfig.ollamaMultimodalModel = settings.value.ollamaMultimodalModel;
  apiConfig.ollamaQuestionGenModel = settings.value.ollamaQuestionGenModel;
  apiConfig.ollamaReviewModel = settings.value.ollamaReviewModel;
  apiConfig.ollamaAnalysisModel = settings.value.ollamaAnalysisModel;
  apiConfig.deepseekBaseUrl = settings.value.deepseekBaseUrl;
  apiConfig.deepseekApiKey = settings.value.deepseekApiKey;
  apiConfig.deepseekGenerationModel = settings.value.deepseekGenerationModel;
  apiConfig.deepseekAnalysisModel = settings.value.deepseekAnalysisModel;
  apiConfig.analyzeCharts = settings.value.analyzeCharts;
  apiConfig.multimodalEngine = settings.value.multimodalEngine || 'paddleocr_vl';
  apiConfig.generationSettings = { ...settings.value.generationSettings };
  await saveConfig(settings.value);
  await refreshConfigCache();

  let qualityEstimate = '设置已保存';
  if (settings.value.currentEngine === 'ollama') {
    const heavyModel = settings.value.ollamaTextModel || '';
    if (heavyModel.includes('deepseek-r1')) {
      qualityEstimate += '\n\n📊 质量预估：本地最高质量（DeepSeek-R1 推理模型）';
      qualityEstimate += '\n💡 适合：考卷命题、课时练生成、复杂推理';
    } else if (heavyModel.includes('glm4')) {
      qualityEstimate += '\n\n📊 质量预估：本地高质量（GLM-4 学术模型）';
      qualityEstimate += '\n💡 适合：知识点总结、错题分析、结构化输出';
    } else {
      const heavyParams = parseInt(settings.value.ollamaTextModel?.match(/(\d+)b/i)?.[1] || '7');
      if (heavyParams >= 14) {
        qualityEstimate += '\n\n📊 质量预估：本地高质量（但需足够显存）';
      } else if (heavyParams >= 7) {
        qualityEstimate += '\n\n📊 质量预估：本地标准质量';
      }
    }
    const lightModel = settings.value.ollamaLightModel || '';
    if (lightModel.includes('glm4')) {
      qualityEstimate += '\n📋 轻量模型：glm4:9b（分析提取精准）';
    } else if (lightModel.includes('deepseek-r1')) {
      qualityEstimate += '\n📋 轻量模型：deepseek-r1（推理兼顾速度）';
    }
  } else if (settings.value.currentEngine === 'deepseek') {
    qualityEstimate += '\n\n📊 质量预估：云端最高质量（DeepSeek）';
  }
  saveStatus.value = qualityEstimate;
  setTimeout(() => { saveStatus.value = ''; }, 5000);
};

const getModelInfo = async (baseUrl, modelName) => {
  try {
    const response = await fetch(`${baseUrl}/api/show`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName })
    });
    if (!response.ok) return null;
    const data = await response.json();
    return { name: modelName, parameterSize: data.details?.parameter_size || '' };
  } catch { return null; }
};

const analyzeModelCapabilities = (modelInfos) => {
  const validInfos = modelInfos.filter(Boolean);
  if (validInfos.length === 0) return null;

  const multimodalModels = validInfos.filter(m =>
    m.name.includes('vl') || m.name.includes('llava')
  );
  const textModels = validInfos.filter(m => !multimodalModels.includes(m));

  const getParamSize = (name) => { const match = name.match(/(\d+)b/i); return match ? parseInt(match[1]) : 0; };
  const sortedText = [...textModels].sort((a, b) => getParamSize(b.name) - getParamSize(a.name));
  const sortedMultimodal = [...multimodalModels].sort((a, b) => getParamSize(b.name) - getParamSize(a.name));

  return {
    heavy: sortedText[0] || null,
    light: sortedText.length > 1 ? sortedText[sortedText.length - 1] : sortedText[0],
    multimodal: sortedMultimodal[0] || null,
    reviewer: sortedText.length > 1 ? (sortedText[1] || sortedText[0]) : (sortedText[0] || null),
    capability: {
      hasIndependentReviewer: sortedText.length > 1,
      hasMultimodal: sortedMultimodal.length > 0,
      modelCount: validInfos.length
    }
  };
};

const applyModelRecommendation = (recommendation) => {
  if (!recommendation) return;
  const savedConfig = localStorage.getItem('apiConfig');
  const hasSavedConfig = savedConfig && JSON.parse(savedConfig).ollamaTextModel;
  if (hasSavedConfig) return;

  if (recommendation.heavy) settings.value.ollamaTextModel = recommendation.heavy.name;
  if (recommendation.light) settings.value.ollamaLightModel = recommendation.light.name;
  if (recommendation.multimodal) settings.value.ollamaMultimodalModel = recommendation.multimodal.name;
  if (recommendation.reviewer && recommendation.capability.hasIndependentReviewer) {
    if (recommendation.reviewer.name !== recommendation.heavy?.name) {
      settings.value.ollamaReviewModel = recommendation.reviewer.name;
    }
  }
};

let _modelAlertShown = false;

const refreshModels = async () => {
  try {
    saveStatus.value = '正在检测模型...';
    const savedConfig = JSON.parse(localStorage.getItem('apiConfig') || '{}');
    if (savedConfig?.ollamaBaseUrl) settings.value.ollamaBaseUrl = savedConfig.ollamaBaseUrl;

    const baseUrl = settings.value.ollamaBaseUrl.replace(/\/$/, '');
    const response = await fetch(`${baseUrl}/api/tags`);
    const data = JSON.parse(await response.text());

    if (data.models && data.models.length > 0) {
      const allModelNames = data.models.map(m => m.name);
      const modelInfos = await Promise.all(allModelNames.map(name => getModelInfo(baseUrl, name)));
      const recommendation = analyzeModelCapabilities(modelInfos);

      availableTextModels.value = allModelNames.filter(m =>
        !(m.includes('vl') || m.includes('llava') || m.includes('vision'))
      );

      if (recommendation) applyModelRecommendation(recommendation);

      if (!availableTextModels.value.includes(settings.value.ollamaTextModel)) {
        settings.value.ollamaTextModel = availableTextModels.value[0] || 'qwen2.5:7b';
      }

      saveStatus.value = '';
      if (!_modelAlertShown) {
        _modelAlertShown = true;
        await showAlertDialogFn('✅ 模型检测完成，已更新可用列表');
        setTimeout(() => { _modelAlertShown = false; }, 1000);
      }
    }
  } catch (e) {
    availableTextModels.value = ['deepseek-r1:14b', 'deepseek-r1:8b', 'glm4:9b', 'qwen2.5:14b', 'qwen2.5:7b', 'qwen2:7b'];
    saveStatus.value = '模型检测失败，使用默认选项';
  }
};

onMounted(async () => {
  // 📱 Web/手机端：读取激活信息用于显示（不影响 activationStatus，单例共享）
  // 🖥️ 桌面端：跳过——App.vue 已统一完成激活校验，licenseInfo 通过单例共享
  if (isWebMode) {
    await checkActivationStatus();
  }
  // 📱 iOS 签名倒计时：已在初始化时计算
  if (isCapacitorIOS) {
    // 倒计时数据已由 getSignCountdown() 初始化，无需额外操作
  }
  // 从 localStorage 恢复其他设置
  const savedSettings = localStorage.getItem('apiConfig');
  if (savedSettings) {
    try {
      const parsed = JSON.parse(savedSettings);
      // 🔧 修复：解密 deepseekApiKey，防止加密值回显到表单
      // 否则用户在不知情下保存会导致二次加密 → 密钥永久损坏
      if (parsed.deepseekApiKey) {
        parsed.deepseekApiKey = await decrypt(parsed.deepseekApiKey);
      }
      Object.assign(settings.value, parsed);
    } catch { /* ignore */ }
  }
  // 恢复后自动刷新模型列表，确保下拉框包含已配模型
  if (settings.value.currentEngine === 'ollama' && settings.value.ollamaBaseUrl) {
    try {
      await refreshModels();
    } catch { /* 刷新失败不影响页面 */ }
  }
  // 🔧 DeepSeek：尝试发现云端可用模型，补充到下拉选项
  if (settings.value.currentEngine === 'deepseek' && settings.value.deepseekApiKey) {
    try {
      const discovered = await autoDiscoverDeepSeekModel();
      if (discovered && !deepseekModelOptions.value.includes(discovered)) {
        deepseekModelOptions.value.push(discovered);
      }
    } catch { /* 发现失败用兜底列表 */ }
  }
  // 引擎设置不同步——各设备独立配置，用户手动管理
});

onUnmounted(() => {
});
</script>

<style scoped>
.embedded-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 20px 24px;
  overflow-y: auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-light);
}

.page-header h2 {
  font-size: 20px;
  color: var(--primary);
  font-weight: 600;
}

.settings-content {
  max-width: 600px;
}

.settings-section {
  margin-bottom: 28px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--border-light);
}

.settings-section h3 {
  font-size: 16px;
  color: var(--primary);
  margin-bottom: 16px;
}

.settings-section label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 500;
  color: #555;
}

.settings-section input,
.settings-section select {
  width: 100%;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid #ddd;
  font-size: 14px;
  margin-bottom: 12px;
}

.info-row {
  display: flex;
  padding: 8px 0;
  border-bottom: 1px dashed var(--border-light);
}

.info-row span:first-child {
  width: 100px;
  color: #666;
}

.info-value {
  font-weight: 500;
  color: var(--primary);
}

.device-name-input {
  flex: 1;
  max-width: 260px;
  padding: 6px 10px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  color: #333;
  background: #fafafa;
  outline: none;
  transition: border-color 0.2s;
}
.device-name-input:focus {
  border-color: var(--primary);
  background: #fff;
}

.model-hint {
  font-size: 12px;
  color: var(--primary-light);
  margin-top: -8px;
  margin-bottom: 12px;
  padding-left: 4px;
}

/* 📱 移动端适配 */
@media (max-width: 767px) {
  .embedded-page {
    padding: 0 !important;
    overflow: hidden;
  }

  /* 固定头部（标题 + 保存按钮） */
  .page-header {
    flex-shrink: 0;
    flex-direction: row;
    align-items: center;
    gap: 6px;
    margin-bottom: 0;
    padding: 6px 8px;
    background: white;
    border-bottom: 1px solid var(--border-light);
  }
  .page-header h2 { font-size: 13px; margin: 0; }
  .page-header .btn-primary {
    flex-shrink: 0;
    font-size: 11px;
    padding: 5px 10px;
    min-height: auto;
  }

  /* 设置内容：独立滚动 */
  .settings-content {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding: 6px 8px;
    max-width: 100%;
    min-height: 0;
  }

  .settings-section {
    margin-bottom: 12px;
    padding-bottom: 8px;
  }
  .settings-section h3 {
    font-size: 12px;
    margin-bottom: 6px;
  }
  .settings-section label {
    font-size: 10px;
  }
  .settings-section input,
  .settings-section select {
    padding: 6px 7px;
    font-size: 12px !important;
    min-height: auto;
  }
  .info-row {
    padding: 5px 0;
  }
  .info-row span:first-child {
    width: 55px;
    flex-shrink: 0;
    font-size: 11px;
  }
  .info-value { font-size: 11px; }
  .btn, .btn-primary, .btn-small {
    min-height: auto;
    padding: 5px 8px;
    font-size: 11px;
  }
  .btn-small {
    padding: 3px 6px;
    font-size: 10px;
  }
  .model-hint {
    font-size: 10px;
  }
}

/* 📋 操作日志 */
.log-viewer {
  max-height: 300px;
  overflow-y: auto;
  background: #1e1e1e;
  border-radius: 8px;
  padding: 8px;
  font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
  font-size: 11px;
  line-height: 1.5;
}
.log-entry {
  display: flex;
  gap: 8px;
  padding: 3px 0;
  border-bottom: 1px solid #333;
  word-break: break-all;
}
.log-entry:last-child { border-bottom: none; }
.log-time {
  flex-shrink: 0;
  color: #888;
  font-size: 10px;
  min-width: 70px;
}
.log-msg { color: #ccc; }
.log-error .log-msg { color: #f87171; }
.log-warn .log-msg { color: #fbbf24; }
.log-info .log-msg { color: #60a5fa; }
</style>
