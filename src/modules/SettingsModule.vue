<template>
  <div class="embedded-page">
    <div class="page-header">
      <h2>⚙️ 系统设置</h2>
      <button
        class="btn-primary"
        @click="saveSettings"
      >
        保存设置
      </button>
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
        <div
          v-if="remainingDays !== null"
          class="info-row"
        >
          <span>剩余天数：</span>
          <span
            class="info-value"
            :style="{ color: remainingDays <= 7 ? 'var(--danger)' : 'var(--success)' }"
          >{{ remainingDays }} 天</span>
        </div>
        <button
          class="btn"
          @click="handleChangeActivation"
        >
          🔄 更换激活码
        </button>
        <p
          class="hint"
          style="margin-top: 12px;"
        >
          如需购买或续费，请联系客服
        </p>
      </div>

      <!-- 🔑 同步密钥 -->
      <div class="settings-section">
        <h3>🔑 同步密钥</h3>
        <p style="font-size:12px;color:#666;margin-bottom:8px;">
          多设备间共享数据的唯一凭证。请在各设备上输入相同的密钥。留空则不同步。
        </p>
        <input
          v-model="syncKeyInput"
          type="text"
          placeholder="输入4位同步密钥"
          maxlength="16"
          style="font-family: monospace; letter-spacing: 2px; text-transform: uppercase;"
          @change="onSyncKeyChange"
        >
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
            class="device-name-input"
            placeholder="输入设备名称"
            maxlength="30"
            @blur="onDeviceNameChange"
            @keyup.enter="onDeviceNameEnter"
          >
        </div>
      </div>

      <!-- ☁️ 云端设备管理 -->
      <div class="settings-section">
        <h3>☁️ 云端设备管理</h3>
        <p style="font-size:12px;color:#666;margin-bottom:8px;">
          查看并管理已同步到云端的设备。移除操作仅删除云端的设备数据，不影响其他设备和本机。
        </p>
        <div style="display:flex;gap:8px;margin-bottom:12px;">
          <button
            class="btn-small"
            :disabled="cloudDevicesLoading"
            @click="loadCloudDevices"
          >
            {{ cloudDevicesLoading ? '⏳ 加载中…' : '🔄 加载设备列表' }}
          </button>
        </div>
        <div
          v-if="cloudDevices.length > 0"
          class="cloud-device-list"
        >
          <div
            v-for="dev in cloudDevices"
            :key="dev.deviceId"
            class="cloud-device-row"
          >
            <div class="cloud-device-info">
              <span class="cloud-device-name">{{ dev.label }}</span>
              <span
                v-if="dev.isSelf"
                class="cloud-device-self"
              >（本机）</span>
              <span class="cloud-device-stats">
                历史 {{ dev.histCount }} 条
                <span v-if="dev.genCount > 0"> · 生成 {{ dev.genCount }} 条</span>
              </span>
            </div>
            <button
              v-if="!dev.isSelf"
              class="btn-small btn-danger-outline"
              :disabled="removingDeviceId === dev.deviceId"
              @click="confirmRemoveDevice(dev)"
            >
              {{ removingDeviceId === dev.deviceId ? '⏳ 移除中…' : '🗑️ 移除' }}
            </button>
          </div>
        </div>
        <div
          v-else-if="!cloudDevicesLoading && cloudDevicesFetched"
          style="font-size:13px;color:var(--text-muted);padding:8px 0;"
        >
          暂无云端设备数据，或尚未配置同步密钥。
        </div>
      </div>

      <!-- 📱 iOS 签名倒计时（仅手机端显示） -->
      <div
        v-if="isCapacitorIOS"
        class="settings-section"
      >
        <h3>📱 签名倒计时</h3>
        <template v-if="signInfo.found">
          <div class="info-row">
            <span>预计到期：</span>
            <span class="info-value">{{ signInfo.expirationDate || '未知' }}</span>
          </div>
          <div class="info-row">
            <span>剩余时间：</span>
            <span
              class="info-value"
              :style="{ color: signDaysInfo.color, fontWeight: signDaysInfo.warning ? 'bold' : 'normal' }"
            >
              {{ signDaysInfo.text }}
            </span>
          </div>
          <div
            v-if="signDaysInfo.warning"
            style="margin-top:8px;padding:8px 12px;background:#fff5f5;border:1px solid #feb2b2;border-radius:8px;font-size:12px;color:#c53030;"
          >
            ⚠️ 签名即将到期！请在电脑上打开爱思助手 → 连接手机 → 重新签名安装。
          </div>
          <button
            class="btn"
            style="margin-top:8px;"
            @click="handleResetCountdown"
          >
            🔄 已续签，重置倒计时
          </button>
          <p style="font-size:11px;color:#999;margin-top:4px;">
            💡 每次用爱思助手重新签名安装后，点这里重置 7 天倒计时。
          </p>
        </template>
      </div>

      <!-- 🤖 AI 引擎选择 -->
      <div class="settings-section">
        <h3>🤖 AI 引擎</h3>
        <label>选择引擎</label>
        <select v-model="settings.currentEngine">
          <option value="ollama">
            🦙 Ollama 本地 —— 免费 · 需自备硬件（≥16GB显存）
          </option>
          <option value="deepseek">
            🌐 DeepSeek —— 💰低 · 推荐 · ¥2.02/百万输出 · 峰谷价
          </option>
          <option value="volcano">
            🔥 火山引擎 —— 💰免费额度大 · 每日200万Token · 超出¥0.1起
          </option>
          <option value="alibaba">
            ☁️ 阿里百炼 —— 💰中 · ¥12/百万输出起 · 新用户送7000万
          </option>
          <option value="zhipu">
            🧠 智谱 GLM —— 💰高 · ¥28/百万输出 · ⚠️强制推理
          </option>
        </select>
        <p style="font-size:11px;color:#888;margin-top:6px;">
          💡 费用档位：Ollama 免费（只要硬件）＜ DeepSeek 最低 ≈ 火山（免费额度大）＜ 阿里 ＜ 智谱（强制推理最贵）。<br>
          切换引擎无需重新填写 API Key。选择哪个引擎就用哪个引擎工作。错误会直接提示，不会自动切换。
        </p>

        <label style="margin-top:14px;">📋 分析/提取引擎（可选）</label>
        <select v-model="settings.analysisEngine">
          <option value="">
            跟随主引擎（推荐）
          </option>
          <option value="ollama">
            🦙 Ollama 本地（免费·分析提取用轻量模型）
          </option>
          <option value="deepseek">
            🌐 DeepSeek（Pro 分析最强）
          </option>
          <option value="volcano">
            🔥 火山引擎（豆包）
          </option>
          <option value="alibaba">
            ☁️ 阿里百炼（通义千问）
          </option>
          <option value="zhipu">
            🧠 智谱 GLM
          </option>
        </select>
        <p class="model-hint">
          💡 单独指定分析/提取（教材解读、知识点分析）用的引擎，生成/蓝图仍走上方主引擎。<br>
          例：主引擎 DeepSeek 生成 + 分析提取用本地 Ollama（免费），需在 Ollama 区把"分析提取模型"设为 glm4:9b 等 8GB 可跑的模型。
        </p>
      </div>

      <!-- 🦙 Ollama 配置 -->
      <div
        v-if="settings.currentEngine === 'ollama'"
        class="settings-section"
      >
        <h3>🦙 Ollama 配置（文本任务）</h3>
        <label>服务地址</label>
        <input
          v-model="settings.ollamaBaseUrl"
          type="text"
          placeholder="http://localhost:11434"
        >

        <label>重型模型（命题生成、蓝图规划）</label>
        <select v-model="settings.ollamaTextModel">
          <option
            v-for="m in availableTextModels"
            :key="m"
            :value="m"
          >
            {{ formatModelName(m) }}
          </option>
        </select>
        <p class="model-hint">
          💡 14B 重型模型需 16GB+ 显存：当前配置不够可先选 8B/9B，电脑升级后再切回 14B 命题质量最高（推理已关闭，选大模型只为生成质量）
        </p>

        <label>轻量模型（分析、提取、格式化）</label>
        <select v-model="settings.ollamaLightModel">
          <option
            v-for="m in availableTextModels"
            :key="'light_' + m"
            :value="m"
          >
            {{ formatModelName(m) }}
          </option>
        </select>
        <p class="model-hint">
          💡 glm4:9b→分析提取精准 | qwen2.5:7b→轻快省显存
        </p>

        <label>📝 题目生成模型（可选）</label>
        <select v-model="settings.ollamaQuestionGenModel">
          <option value="">
            跟随重型模型
          </option>
          <option
            v-for="m in availableTextModels"
            :key="'qgen_' + m"
            :value="m"
          >
            {{ formatModelName(m) }}
          </option>
        </select>
        <p class="model-hint">
          💡 deepseek-r1:14b→命题最准（需16GB+显存）| 留空=跟随重型模型
        </p>

        <label>📊 质量审查模型（可选）</label>
        <select v-model="settings.ollamaReviewModel">
          <option value="">
            跟随重型模型
          </option>
          <option
            v-for="m in availableTextModels"
            :key="'rev_' + m"
            :value="m"
          >
            {{ formatModelName(m) }}
          </option>
        </select>
        <p class="model-hint">
          💡 deepseek-r1:8b 或 glm4:9b→审查更稳 | 留空=跟随重型模型
        </p>

        <label>📋 分析提取模型（可选）</label>
        <select v-model="settings.ollamaAnalysisModel">
          <option value="">
            跟随重型模型
          </option>
          <option
            v-for="m in availableTextModels"
            :key="'ana_' + m"
            :value="m"
          >
            {{ formatModelName(m) }}
          </option>
        </select>
        <p class="model-hint">
          💡 glm4:9b→结构化分析精准 | qwen2.5:7b→轻量快速 | 留空=跟随重型模型
        </p>

        <button
          class="btn-small"
          @click="refreshModels"
        >
          🔄 刷新模型列表
        </button>
        <div
          v-if="saveStatus"
          class="model-hint"
          style="margin-top:8px;color:var(--primary-light);"
        >
          {{ saveStatus }}
        </div>
      </div>

      <!-- 🌐 DeepSeek 配置 -->
      <div
        v-if="settings.currentEngine === 'deepseek'"
        class="settings-section"
      >
        <h3>🌐 DeepSeek 配置</h3>
        <p style="font-size:12px;color:#666;margin-bottom:4px;">
          💰 费用低 · 推荐首选：输入 ¥1.01/百万 · 输出 ¥2.02/百万 · 缓存命中 ¥0.02/百万 · 高峰(9-12/14-18工作日)×2
        </p>
        <p class="model-hint">
          👍 性价比最优：生成用 Flash（快且便宜）、分析用 Pro（精准）· 推理已默认关闭
        </p>
        <label>API Key</label>
        <input
          v-model="settings.deepseekApiKey"
          type="password"
          placeholder="sk-..."
        >
        <input
          v-model="settings.deepseekBaseUrl"
          type="text"
          placeholder="https://api.deepseek.com/v1"
        >

        <!-- 🔧 成本预设按钮 -->
        <div style="display:flex;gap:6px;margin:10px 0;flex-wrap:wrap;">
          <button
            style="padding:5px 10px;font-size:12px;border:1px solid #4caf50;border-radius:4px;background:#e8f5e9;cursor:pointer;"
            @click="applyModelPreset('economy')"
          >
            💰 经济模式
          </button>
          <button
            style="padding:5px 10px;font-size:12px;border:1px solid #2196f3;border-radius:4px;background:#e3f2fd;cursor:pointer;"
            @click="applyModelPreset('balanced')"
          >
            ⚖️ 均衡模式（推荐）
          </button>
          <button
            style="padding:5px 10px;font-size:12px;border:1px solid #ff9800;border-radius:4px;background:#fff3e0;cursor:pointer;"
            @click="applyModelPreset('flagship')"
          >
            👑 旗舰模式
          </button>
        </div>
        <p style="font-size:11px;color:#888;margin:0 0 8px;">
          💡 一键为下方生成/分析模型选择合适的档位组合：经济=最便宜·最快，均衡=性价比平衡（推荐），旗舰=质量优先。点击后请点顶部「保存设置」生效。
        </p>

        <label>📝 资料生成模型（generation/blueprint）</label>
        <select v-model="settings.deepseekGenerationModel">
          <option
            v-for="m in deepseekModelOptions"
            :key="'dsg_' + m"
            :value="m"
          >
            {{ formatDeepSeekModel(m) }}
          </option>
        </select>
        <label>📋 教材分析模型（analysis/extraction · 决策性步骤）</label>
        <select v-model="settings.deepseekAnalysisModel">
          <option
            v-for="m in deepseekModelOptions"
            :key="'dsa_' + m"
            :value="m"
          >
            {{ formatDeepSeekModel(m) }}
          </option>
        </select>
      </div>

      <!-- 🔥 火山引擎（豆包）配置 -->
      <div
        v-if="settings.currentEngine === 'volcano'"
        class="settings-section"
      >
        <h3>🔥 火山引擎（豆包）</h3>
        <p style="font-size:12px;color:#666;margin-bottom:4px;">
          💰 每日免费200万Token · 无峰谷定价 · 国产中文能力第一 · 深度思考默认关闭（可在下方「整卷生成深度思考」按引擎开启）
        </p>
        <p class="model-hint">
          👍 免费额度大：小量试用/白嫖首选，超额度后 doubao-seed-2-1-turbo 约 ¥3/百万输入
        </p>
        <label>API Key</label>
        <input
          v-model="settings.volcanoApiKey"
          type="password"
          placeholder="火山引擎 API Key"
        >
        <input
          v-model="settings.volcanoBaseUrl"
          type="text"
          placeholder="https://ark.cn-beijing.volces.com/api/v3"
        >
        <label>📝 资料生成模型</label>
        <input
          v-model="settings.volcanoGenerationModel"
          type="text"
          placeholder="doubao-seed-2-1-turbo-260628"
        >
        <label>📋 教材分析模型</label>
        <input
          v-model="settings.volcanoAnalysisModel"
          type="text"
          placeholder="doubao-seed-2-1-pro-260628"
        >
      </div>

      <!-- ☁️ 阿里百炼（通义千问）配置 -->
      <div
        v-if="settings.currentEngine === 'alibaba'"
        class="settings-section"
      >
        <h3>☁️ 阿里百炼（通义千问）</h3>
        <p style="font-size:12px;color:#666;margin-bottom:4px;">
          💰 费用中：qwen3.8-27b ¥3/百万输入·¥12/百万输出（生成性价比） · qwen3.8-max ¥12/百万输入·¥36/百万输出（中文综合第一）
        </p>
        <p class="model-hint">
          👍 中档选择：生成用 27b 性价比好、分析用 max 质量高 · 新用户送7000万Token · 推理已默认关闭
        </p>
        <label>API Key</label>
        <input
          v-model="settings.alibabaApiKey"
          type="password"
          placeholder="sk-..."
        >
        <input
          v-model="settings.alibabaBaseUrl"
          type="text"
          placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1"
        >
        <label>📝 资料生成模型</label>
        <input
          v-model="settings.alibabaGenerationModel"
          type="text"
          placeholder="qwen3.8-27b"
        >
        <label>📋 教材分析模型</label>
        <input
          v-model="settings.alibabaAnalysisModel"
          type="text"
          placeholder="qwen3.8-max"
        >
      </div>

      <!-- 🧠 智谱 GLM 配置 -->
      <div
        v-if="settings.currentEngine === 'zhipu'"
        class="settings-section"
      >
        <h3>🧠 智谱 GLM</h3>
        <p style="font-size:12px;color:#666;margin-bottom:4px;">
          💰 费用高：glm-5.3 最新旗舰（2026-08）· 输入¥8/百万 · 输出¥28/百万 · ⚠️ 强制开启推理（不可关闭，成本较高）
        </p>
        <p class="model-hint">
          ⚠️ 性价比最低：强制推理 token 按输出价计费，仅当需要顶级质量且不在乎成本时选用
        </p>
        <label>API Key</label>
        <input
          v-model="settings.zhipuApiKey"
          type="password"
          placeholder="智谱 API Key"
        >
        <input
          v-model="settings.zhipuBaseUrl"
          type="text"
          placeholder="https://open.bigmodel.cn/api/paas/v4"
        >
        <label>📝 资料生成模型</label>
        <input
          v-model="settings.zhipuGenerationModel"
          type="text"
          placeholder="glm-5.3"
        >
        <label>📋 教材分析模型</label>
        <input
          v-model="settings.zhipuAnalysisModel"
          type="text"
          placeholder="glm-5.3"
        >
      </div>

      <!-- 📖 API 申请指南 -->
      <div class="settings-section">
        <h3>
          📖 API 申请指南 <button
            class="btn-small"
            style="margin-left:8px;"
            @click="showGuide = !showGuide"
          >
            {{ showGuide ? '收起' : '展开' }}
          </button>
        </h3>
        <div
          v-if="showGuide"
          class="api-guide"
        >
          <div class="guide-item">
            <strong>🔥 火山引擎（豆包）</strong>
            <p>
              1. 访问 <a
                href="https://console.volcengine.com/ark"
                target="_blank"
              >火山引擎 Ark 控制台</a>
            </p>
            <p>2. 注册/登录 → 开通模型推理服务 → 创建 API Key</p>
            <p>3. 在"推理接入点"创建 endpoint，选择 doubao-seed-2-1 系列模型</p>
            <p>4. 每日免费 200万 Token，自动刷新</p>
          </div>
          <div class="guide-item">
            <strong>☁️ 阿里百炼（通义千问）</strong>
            <p>
              1. 访问 <a
                href="https://bailian.console.aliyun.com"
                target="_blank"
              >阿里百炼控制台</a>
            </p>
            <p>2. 注册/登录 → 开通百炼服务 → 创建 API Key</p>
            <p>3. 新用户送 7000万 Token，qwen3.8-27b 生成性价比高（¥3/百万输入）</p>
          </div>
          <div class="guide-item">
            <strong>🧠 智谱 GLM</strong>
            <p>
              1. 访问 <a
                href="https://open.bigmodel.cn"
                target="_blank"
              >智谱开放平台</a>
            </p>
            <p>2. 注册/登录 → 创建 API Key</p>
            <p>3. glm-5.3 为最新旗舰模型（2026-08 发布），输入¥8/百万 · 输出¥28/百万</p>
          </div>
          <div class="guide-item">
            <strong>💰 缓存命中提示</strong>
            <p>相同章节多次生成时，DeepSeek/火山引擎会自动命中 KV Cache，输入价格降至 ¥0.02/百万Token（节省98%）</p>
            <p>建议保持教材章节不变时批量生成，最大化缓存命中率。</p>
          </div>
        </div>
      </div>

      <!-- 多模态引擎 -->
      <div class="settings-section">
        <h3>🖼️ 多模态引擎（图片识别/OCR）</h3>
        <p style="font-size:12px;color:#666;margin-top:4px;margin-bottom:12px;">
          PaddleOCR-VL —— 本地运行不占 Ollama 显存，支持 pipeline 文档解析 + VLM 视觉理解，用完自动释放 GPU
        </p>

        <label style="margin-top: 8px;">理科图表处理</label>
        <select v-model="settings.analyzeCharts">
          <option :value="false">
            跳过（仅提取文字）
          </option>
          <option :value="true">
            分析（用 AI 描述图表）
          </option>
        </select>
        <p style="font-size:11px;color:#888;margin:4px 0 0;">
          💡 开启后会用 AI 描述理科题中的图表内容（帮助理解图），仅在遇到图表题时产生额外 token 消耗；纯文科/无图场景建议保持「跳过」以省成本。
        </p>
      </div>

      <!-- 存储路径 -->
      <div class="settings-section">
        <h3>💾 存储路径</h3>
        <div style="display: flex; gap: 8px; align-items: center;">
          <input
            v-model="settings.storagePath"
            type="text"
            placeholder="例如：D:\\智卷工坊数据"
            style="flex: 1; padding: 8px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px;"
          >
          <button
            class="btn-small"
            style="white-space: nowrap; padding: 8px 16px;"
            @click="selectStoragePath"
          >
            📁 选择文件夹
          </button>
        </div>
      </div>

      <!-- 生成设置 -->
      <div class="settings-section">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <h3 style="margin:0;">
            🎲 生成设置（温度：控制输出随机性）
          </h3>
          <button
            class="btn-small"
            style="font-size:11px;padding:4px 10px;"
            @click="resetTemperatureDefaults"
          >
            🔄 恢复默认
          </button>
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
              <input
                v-model.number="settings.generationSettings.analysisTemperature"
                type="range"
                min="0"
                max="1.0"
                step="0.1"
                list="ticks-1_0"
                style="width:100%;"
              >
            </div>
            <span style="font-size:10px;color:#999;min-width:22px;">1.0</span>
          </div>
          <datalist id="ticks-1_0">
            <option value="0" /><option value="0.5" /><option value="1.0" />
          </datalist>
          <p style="font-size:11px;color:#888;margin:2px 0 0;">
            知识点提取、内容分析、格式化——低温确保准确
          </p>
        </div>

        <!-- 整卷正文温度（一次生成整卷，创作性略高） -->
        <datalist id="ticks-1_5">
          <option value="0" /><option value="0.5" /><option value="1.0" /><option value="1.5" />
        </datalist>
        <div style="margin-bottom:14px;">
          <label style="display:flex;justify-content:space-between;">
            <span>📄 整卷正文生成</span>
          </label>
          <div style="display:flex;align-items:center;gap:6px;">
            <span style="font-size:10px;color:#999;min-width:14px;">0</span>
            <div style="position:relative;flex:1;">
              <span :style="{ position:'absolute', left: `calc(${((settings.generationSettings.paperTemperature ?? 0.7) / 1.5 * 100).toFixed(1)}% + 6px - ${((settings.generationSettings.paperTemperature ?? 0.7) / 1.5 * 10).toFixed(0)}px)`, top: '-20px', transform: 'translateX(-50%)', background: 'var(--primary,#4a90d9)', color: '#fff', fontSize: '11px', fontWeight: '600', padding: '1px 6px', borderRadius: '8px', whiteSpace: 'nowrap', pointerEvents: 'none' }">{{ (settings.generationSettings.paperTemperature ?? 0.7).toFixed(1) }}</span>
              <input
                v-model.number="settings.generationSettings.paperTemperature"
                type="range"
                min="0"
                max="1.5"
                step="0.1"
                list="ticks-1_5"
                style="width:100%;"
              >
            </div>
            <span style="font-size:10px;color:#999;min-width:22px;">1.5</span>
          </div>
          <p style="font-size:11px;color:#888;margin:2px 0 0;">
            整卷一次生成（正文）——需创作性：情境、题目、卷面，略高
          </p>
        </div>

        <!-- 答案页温度（阅卷专家视角，低温严谨；一次成型下与正文温度取平均，共同影响答案区） -->
        <div style="margin-bottom:14px;">
          <label style="display:flex;justify-content:space-between;">
            <span>✅ 答案页生成</span>
          </label>
          <div style="display:flex;align-items:center;gap:6px;">
            <span style="font-size:10px;color:#999;min-width:14px;">0</span>
            <div style="position:relative;flex:1;">
              <span :style="{ position:'absolute', left: `calc(${((settings.generationSettings.answerTemperature ?? 0.3) / 1.0 * 100).toFixed(1)}% + 6px - ${((settings.generationSettings.answerTemperature ?? 0.3) / 1.0 * 10).toFixed(0)}px)`, top: '-20px', transform: 'translateX(-50%)', background: 'var(--primary,#4a90d9)', color: '#fff', fontSize: '11px', fontWeight: '600', padding: '1px 6px', borderRadius: '8px', whiteSpace: 'nowrap', pointerEvents: 'none' }">{{ (settings.generationSettings.answerTemperature ?? 0.3).toFixed(1) }}</span>
              <input
                v-model.number="settings.generationSettings.answerTemperature"
                type="range"
                min="0"
                max="1.0"
                step="0.1"
                list="ticks-1_0"
                style="width:100%;"
              >
            </div>
            <span style="font-size:10px;color:#999;min-width:22px;">1.0</span>
          </div>
          <p style="font-size:11px;color:#888;margin:2px 0 0;">
            参考答案与评分标准——阅卷专家视角，低温确保严谨准确（一次成型下与「整卷正文生成」温度取平均，共同影响答案区）
          </p>
        </div>

        <!-- 整卷输出预算（tokens，全部可配置，生成端严格按此执行） -->
        <div style="margin-bottom:14px;background:#f0f7ff;border:1px solid #b3d4f5;border-radius:8px;padding:8px 12px;">
          <div style="font-size:12px;font-weight:600;color:#333;margin-bottom:8px;">
            📏 整卷输出预算（每类型独立，动态为主 · 预算=勾选原文×系数）
          </div>

          <!-- 一键快捷（分组） -->
          <div style="background:#f4f8fd;border:1px solid #dfe8f2;border-radius:8px;padding:6px 10px;margin-bottom:10px;">
            <div style="font-size:10px;color:#8896a8;margin-bottom:4px;font-weight:600;">
              ⚡ 一键快捷设置（可逐类型微调）
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
              <div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;">
                <span style="font-size:10px;color:#8896a8;">档位度：</span>
                <button
                  v-for="t in BUDGET_TIERS"
                  :key="t.key"
                  class="btn-small"
                  style="font-size:10px;padding:2px 8px;"
                  @click="setAllTiers(t.key)"
                >
                  {{ t.name }}
                </button>
              </div>
              <span style="color:#d5dde8;">│</span>
              <div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;">
                <span style="font-size:10px;color:#8896a8;">生成路径：</span>
                <button
                  class="btn-small"
                  style="font-size:10px;padding:2px 8px;"
                  @click="setAllPaths('auto')"
                >
                  全部自动
                </button>
                <button
                  class="btn-small"
                  style="font-size:10px;padding:2px 8px;"
                  @click="setAllPaths('split')"
                >
                  全部两次
                </button>
                <button
                  class="btn-small"
                  style="font-size:10px;padding:2px 8px;"
                  @click="setAllPaths('once')"
                >
                  全部一次
                </button>
              </div>
            </div>
          </div>

          <!-- 🔧 浏览自动补齐增强档（漏章补齐/仅提醒） -->
          <div style="background:#f4f8fd;border:1px solid #dfe8f2;border-radius:8px;padding:8px 12px;margin-bottom:10px;">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
              <div style="flex:1;min-width:200px;">
                <div style="font-size:12px;font-weight:600;color:#333;">
                  🔧 大范围浏览·漏章覆盖
                </div>
                <div style="font-size:10px;color:#8896a8;margin-top:3px;line-height:1.5;">
                  大范围（整册/多章）浏览取材时，若某章<b>有教材原文素材但模型本次未浏览</b>：
                  <span
                    v-if="settings.value?.generationSettings?.browseAutoFill !== false"
                    style="color:#1f6feb;"
                  >开 = 先发一轮漏章确认给模型、由它判断是否取料；仍未采用时程序才确定性兜底补料（有界、报告标注程序兜底，保覆盖不遗漏）；</span>
                  <span
                    v-else
                    style="color:#8896a8;"
                  >关 = 仅列入生成报告的主编式提醒，程序不补料（省成本，由命题老师复核）。</span>
                </div>
              </div>
              <button
                class="btn-small"
                style="font-size:11px;padding:3px 12px;"
                :style="settings.value?.generationSettings?.browseAutoFill !== false ? 'background:#eaf4ff;color:#1f6feb;border:1px solid #1f6feb;' : ''"
                @click="toggleBrowseAutoFill"
              >
                {{ settings.value?.generationSettings?.browseAutoFill !== false ? '● 开（自动补齐，默认）' : '○ 关（仅提醒）' }}
              </button>
            </div>
          </div>

          <!-- 逐类型卡片 -->
          <div
            v-for="row in BUDGET_TYPE_ORDER"
            :key="row.key"
            style="border:1px solid #e3e9f2;border-radius:8px;margin-bottom:8px;overflow:hidden;"
          >
            <!-- 卡片头：类型名 + 路径 -->
            <div style="display:flex;align-items:center;gap:10px;padding:6px 10px;background:#fafcff;border-bottom:1px solid #eef2f7;flex-wrap:wrap;">
              <span style="font-weight:600;color:#1f6feb;font-size:12px;white-space:nowrap;">{{ row.name }}</span>
              <span style="font-size:10px;color:#8896a8;white-space:nowrap;">路径</span>
              <label
                :title="'自动：由程序按该类型最合适的路径决定（考卷/课时练/专项/复习→两次，阅读/总结/预习/默写/错题→一次）'"
                style="margin-right:4px;font-size:11px;color:#555;cursor:pointer;"
              >
                <input
                  v-model="budgetBt()[row.key].mode"
                  type="radio"
                  value="auto"
                  style="margin-right:2px;vertical-align:middle;"
                >自动
              </label>
              <label
                :title="'两次生成：正文一次 + 独立答案页一次（答案分开）'"
                style="margin-right:4px;font-size:11px;color:#555;cursor:pointer;"
              >
                <input
                  v-model="budgetBt()[row.key].mode"
                  type="radio"
                  value="split"
                  style="margin-right:2px;vertical-align:middle;"
                >两次
              </label>
              <label
                :title="'一次成型：正文与答案一次输出'"
                style="margin-right:4px;font-size:11px;color:#555;cursor:pointer;"
              >
                <input
                  v-model="budgetBt()[row.key].mode"
                  type="radio"
                  value="once"
                  style="margin-right:2px;vertical-align:middle;"
                >一次
              </label>
            </div>
            <!-- 卡片体：三槽并排 -->
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:8px 10px;">
              <div
                v-for="slotDef in [ ['body','两次生成·正文'], ['answer','两次生成·答案页'], ['once','一次成型·正文+答案'] ]"
                :key="slotDef[0]"
                :style="{ border:'1px solid '+(isSlotActive(row.key, slotDef[0]) ? '#cfe0f5':'#eef2f7'), borderRadius:'6px', padding:'5px 7px', background: isSlotActive(row.key, slotDef[0]) ? '#fbfdff' : '#f6f8fa', opacity: isSlotActive(row.key, slotDef[0]) ? 1 : 0.5 }"
              >
                <div style="font-size:10px;color:#64748b;margin-bottom:4px;white-space:nowrap;">
                  {{ slotDef[1] }}
                </div>
                <div style="display:flex;gap:3px;flex-wrap:wrap;margin-bottom:4px;">
                  <span
                    v-for="t in BUDGET_TIERS"
                    :key="t.key"
                    :title="t.name + '——' + t.note"
                    style="display:inline-flex;align-items:center;gap:2px;cursor:pointer;border:1px solid #d0d8e4;border-radius:4px;padding:1px 5px;font-size:10px;color:#475569;"
                    :style="(budgetBt()[row.key].tier === t.key && typeof budgetBt()[row.key][slotDef[0]].custom !== 'number') ? 'background:#1f6feb;color:#fff;border-color:#1f6feb;' : ''"
                    @click="budgetBt()[row.key].tier = t.key; budgetBt()[row.key][slotDef[0]].custom = null;"
                  >
                    {{ t.key === 'economy' ? '精简' : t.key === 'balanced' ? '均衡' : '充分' }}
                    <b>{{ budgetBt()[row.key][slotDef[0]][t.key] }}</b>
                  </span>
                </div>
                <div style="display:flex;align-items:center;gap:4px;font-size:10px;color:#94a3b8;">
                  <span :title="'系数：预算=勾选原文×系数。手填可自定义该槽的系数（覆盖档位）。'">手填</span>
                  <input
                    v-model.number="budgetBt()[row.key][slotDef[0]].custom"
                    type="number"
                    step="0.1"
                    min="0.1"
                    placeholder="—"
                    :title="'手填系数（覆盖精简/均衡/充分档位），清空即回档位'"
                    style="width:44px;padding:1px 4px;border:1px solid #d6dde6;border-radius:4px;font-size:10px;"
                  >
                  <span :title="'这里是「输出 token 上限」：本次生成最多能写到多少 token。区别于上方『答案页上下文上限·字符』（那是答案生成时能看到多少正文，输入侧）。'">上限</span>
                  <input
                    v-model.number="budgetBt()[row.key][slotDef[0]].cap"
                    type="number"
                    step="1024"
                    min="2000"
                    placeholder="cap"
                    :title="'该槽输出 token 上限（不是字符数）：预算=系数×勾选原文，封顶不超过这里'"
                    style="width:56px;padding:1px 4px;border:1px solid #e3e9f2;border-radius:4px;font-size:10px;"
                  >
                  <div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;margin-top:3px;font-size:10px;">
                    <span
                      :title="'采用最新代码设计默认上限（DEFAULT_BUDGET_BY_TYPE）。生效需点「保存设置」。'"
                      @click="applyDesignCap(row.key, slotDef[0])"
                      :style="{ cursor:'pointer', padding:'0 4px', borderRadius:'3px', border:'1px solid '+(budgetBt()[row.key][slotDef[0]].cap === designCap(row.key, slotDef[0]) ? '#1f6feb' : '#d6dde6'), color: budgetBt()[row.key][slotDef[0]].cap === designCap(row.key, slotDef[0]) ? '#1f6feb' : '#64748b' }"
                    >设计 {{ designCap(row.key, slotDef[0]) }}</span>
                    <span
                      :title="'采用存档上限（更早版设计默认固化进存储的值；无存档时等同设计默认）。生效需点「保存设置」。'"
                      @click="applyArchiveCap(row.key, slotDef[0])"
                      :style="{ cursor:'pointer', padding:'0 4px', borderRadius:'3px', border:'1px solid '+(budgetBt()[row.key][slotDef[0]].cap === archiveCapOf(row.key, slotDef[0]) ? '#10b981' : '#d6dde6'), color: budgetBt()[row.key][slotDef[0]].cap === archiveCapOf(row.key, slotDef[0]) ? '#10b981' : '#64748b' }"
                    >存档 {{ archiveCapOf(row.key, slotDef[0]) }}</span>
                  </div>
                </div>
              </div>
            </div>
            <!-- 🔧 实测校准（每类型×学科×学段分桶；一键采纳以样本中位产出率为基准） -->
            <div style="padding:6px 10px;border-top:1px dashed #dbe4ee;background:#fbfdff;">
              <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px;margin-bottom:5px;">
                <span style="font-size:10px;color:#64748b;font-weight:600;">📊 实测校准（按学科×学段×路径，门槛 {{ calThresholdLabel }}，CV&gt;0.35 拒采）</span>
                <span style="display:flex;gap:5px;align-items:center;font-size:10px;color:#94a3b8;">
                  学段
                  <select
                    v-model="calStageFilter[row.key]"
                    style="font-size:10px;padding:1px 3px;border:1px solid #d6dde6;border-radius:4px;background:#fff;"
                  >
                    <option value="">全部</option>
                    <option
                      v-for="s in CAL_STAGE_KEYS"
                      :key="s"
                      :value="s"
                    >{{ calStageName(s) }}</option>
                  </select>
                  学科
                  <select
                    v-model="calSubjectFilter[row.key]"
                    style="font-size:10px;padding:1px 3px;border:1px solid #d6dde6;border-radius:4px;background:#fff;"
                  >
                    <option value="">全部</option>
                    <option
                      v-for="sub in CAL_SUBJECT_KEYS"
                      :key="sub"
                      :value="sub"
                    >{{ sub }}</option>
                  </select>
                  路径
                  <select
                    v-model="calModeFilter[row.key]"
                    style="font-size:10px;padding:1px 3px;border:1px solid #d6dde6;border-radius:4px;background:#fff;"
                  >
                    <option value="">全部</option>
                    <option value="split">两次(split)</option>
                    <option value="once">一次(once)</option>
                  </select>
                </span>
              </div>
              <template v-if="calBucketsFor(row.key).length">
                <div
                  v-for="bk in calBucketsFor(row.key)"
                  :key="bk.key"
                  style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;border:1px solid #e7eef7;border-radius:6px;padding:4px 7px;margin-bottom:4px;background:#fff;"
                >
                  <span style="font-size:10px;color:#334155;white-space:nowrap;">{{ bk.subject }} · {{ calStageName(bk.stage) }} · {{ bk.mode === 'split' ? '两次' : bk.mode === 'once' ? '一次' : bk.mode || '全部' }}</span>
                  <span style="font-size:10px;color:#64748b;">样本 {{ bk.stats.count }}<template v-if="bk.stats.inValid">/{{ bk.stats.inValid }}失效</template></span>
                  <span
                    v-if="bk.stats.count"
                    style="font-size:10px;color:#94a3b8;"
                  >CV={{ bk.stats.cv.toFixed(2) }}</span>
                  <span
                    v-if="bk.calibrated"
                    style="font-size:10px;color:#1f6feb;"
                  >校准基准{{ bk.calBase }}（播种均衡档{{ seedCoefFor(row.key, bk.mode) }}）</span>
                  <span
                    v-else
                    style="font-size:10px;color:#94a3b8;"
                  >{{ bk.stats.reason }}</span>
                  <span style="margin-left:auto;display:flex;gap:5px;align-items:center;">
                    <button
                      v-if="bk.stats.ready && !bk.calibrated"
                      style="font-size:10px;padding:2px 8px;border:1px solid #1f6feb;color:#1f6feb;background:#fff;border-radius:4px;cursor:pointer;"
                      @click="adoptCalibration(row.key, bk)"
                    >一键采纳</button>
                    <template v-if="bk.calibrated">
                      <span style="font-size:10px;color:#94a3b8;white-space:nowrap;">切换：</span>
                      <button
                        style="font-size:10px;padding:2px 8px;border:1px solid #c2ccd9;color:#5b6b7c;background:#fff;border-radius:4px;cursor:pointer;"
                        @click="toggleCalibrated(row.key, bk)"
                      >{{ bk.enabled ? '用播种' : '用校准' }}</button>
                      <button
                        style="font-size:10px;padding:2px 8px;border:1px solid #d9673a;color:#d9673a;background:#fff;border-radius:4px;cursor:pointer;"
                        @click="clearCalibrationRow(row.key, bk)"
                      >清理</button>
                    </template>
                  </span>
                </div>
              </template>
              <div
                v-else
                style="font-size:10px;color:#c3cdda;padding:3px 0;"
              >
                （该类型暂无样本；完成若干次该类型生成后，这里会出现按学科×学段分桶的校准入口）
              </div>
              <div style="font-size:9px;color:#aab6c4;margin-top:3px;">
                产出率按 勾选原文→实际输出字符 实测；采纳即用中位数作均衡档基准，按 精简0.72/均衡1/充分1.25 展开三档。低于门槛或波动过大(CV&gt;0.35)时按钮置灰。
              </div>
              <!-- 📋 操作流水（审计日志：谁/何时/做了什么；清空只删日志，不动校准数据） -->
              <div style="border-top:1px dashed #dbe4ee;padding:5px 0 1px;margin-top:5px;">
                <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                  <button
                    style="font-size:10px;padding:2px 8px;border:1px solid #c2ccd9;color:#5b6b7c;background:#fff;border-radius:4px;cursor:pointer;"
                    @click="auditOpen[row.key] = !auditOpen[row.key]"
                  >
                    📋 操作流水（{{ auditCountFor(row.key) }}）
                  </button>
                  <span style="font-size:9px;color:#aab6c4;">采纳/切换/清理的每一条动作记录（设备 · 时间 · 操作）</span>
                </div>
                <div v-if="auditOpen[row.key]">
                  <div
                    v-if="auditLogsFor(row.key).length"
                    style="margin-top:4px;max-height:150px;overflow-y:auto;border:1px solid #e7eef7;border-radius:6px;background:#fff;"
                  >
                    <div
                      v-for="(log, i) in auditLogsFor(row.key)"
                      :key="i"
                      style="display:flex;gap:6px;flex-wrap:wrap;padding:3px 7px;border-bottom:1px solid #f1f5fb;font-size:10px;color:#475569;"
                    >
                      <span style="color:#94a3b8;white-space:nowrap;">{{ fmtAuditTime(log.t) }}</span>
                      <span style="color:#1f6feb;font-weight:600;white-space:nowrap;">{{ actLabel(log.action) }}</span>
                      <span style="color:#334155;">{{ log.operator }}</span>
                      <span
                        v-if="log.bucket"
                        style="color:#64748b;"
                      >{{ log.bucket.subject || '—' }} · {{ calStageName(log.bucket.stage) }} · {{ log.bucket.mode === 'split' ? '两次' : log.bucket.mode === 'once' ? '一次' : '全部' }}</span>
                      <span style="margin-left:auto;color:#94a3b8;">{{ log.detail }}</span>
                    </div>
                  </div>
                  <div
                    v-else
                    style="font-size:10px;color:#c3cdda;padding:3px 0;"
                  >
                    暂无操作记录
                  </div>
                  <div style="display:flex;justify-content:flex-end;margin-top:3px;">
                    <button
                      style="font-size:10px;padding:2px 8px;border:1px solid #d9673a;color:#d9673a;background:#fff;border-radius:4px;cursor:pointer;"
                      @click="clearAuditFor(row.key)"
                    >
                      清空流水
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0 4px;">
            <div>
              <label style="font-size:11px;color:#666;">思考模式预算倍数（默认 2）</label>
              <input
                v-model.number="settings.generationSettings.thinkingBudgetMultiplier"
                type="number"
                min="1"
                step="0.5"
                style="width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:6px;font-size:12px;"
              >
            </div>
            <div>
              <label style="font-size:11px;color:#666;">答案页上下文上限·字符（默认 24000）</label>
              <input
                v-model.number="settings.generationSettings.answerContextMaxChars"
                type="number"
                min="8000"
                step="2000"
                style="width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:6px;font-size:12px;"
              >
            </div>
          </div>
          <div style="font-size:10.5px;color:#8896a8;line-height:1.6;margin-top:4px;">
            预算 = 勾选原文（生成入口处勾选的教材章节原文）× 该类型系数，再封顶到该槽 token 上限。正常勾选（一课/单元/单册）动态直接生效、内容完整；勾选远超该类型上限时自动加长保证完整（生成报告会提示）。<br>
            生效槽：选「两次生成」→ 前两槽（正文·答案页）生效、第三槽灰显；选「一次成型」→ 仅第三槽生效；选「自动」→ 按该类型最合适路径。<br>
            两处「上限」不同：<b>每类型卡片里的是「输出 token 上限」</b>（这次生成最多写多少 token）；<b>下方「答案页上下文上限」是「输入侧」字符数</b>（答案生成时能看到多少正文——正文超过此长度则后半卷题目答案会缺）。高中大卷常超 2.4 万字符——可调大该值，或改用「两次生成」。
          </div>
        </div>

        <!-- 整卷生成深度思考开关（按引擎，仅整卷生成生效） -->
        <div style="margin-bottom:14px;background:#fffbe6;border:1px solid #ffe58f;border-radius:8px;padding:8px 12px;">
          <div style="font-size:12px;font-weight:600;color:#333;margin-bottom:2px;">
            🧠 整卷生成深度思考（按引擎开关）
          </div>
          <div style="font-size:11px;color:#888;margin-bottom:4px;line-height:1.5;">
            开启后整卷生成前先推理再作答，可提升生成质量；推理 token 按输出价计费、耗时更长，输出预算按上方「思考模式预算倍数」放大。<br>仅影响整卷生成——分析/审查/格式化/验算始终关闭思考。请为当前使用的引擎明确选择。
          </div>
          <!-- DeepSeek -->
          <div style="display:flex;align-items:center;justify-content:space-between;padding:4px 0;border-top:1px dashed #ffe58f;">
            <span style="font-size:12px;">DeepSeek</span>
            <label style="position:relative;display:inline-block;width:34px;height:19px;flex-shrink:0;cursor:pointer;">
              <input
                v-model="settings.generationSettings.deepseekGenerationThinking"
                type="checkbox"
                style="opacity:0;width:0;height:0;"
              >
              <span :style="{position:'absolute',top:'0',left:'0',right:'0',bottom:'0',borderRadius:'19px',transition:'0.3s',background:settings.generationSettings.deepseekGenerationThinking ? '#4a90d9' : '#ccc'}" />
              <span :style="{position:'absolute',top:'2px',left:settings.generationSettings.deepseekGenerationThinking ? '17px' : '2px',width:'15px',height:'15px',borderRadius:'50%',background:'#fff',transition:'0.3s'}" />
            </label>
          </div>
          <!-- 火山引擎 -->
          <div style="display:flex;align-items:center;justify-content:space-between;padding:4px 0;">
            <span style="font-size:12px;">火山引擎（豆包）</span>
            <label style="position:relative;display:inline-block;width:34px;height:19px;flex-shrink:0;cursor:pointer;">
              <input
                v-model="settings.generationSettings.volcanoGenerationThinking"
                type="checkbox"
                style="opacity:0;width:0;height:0;"
              >
              <span :style="{position:'absolute',top:'0',left:'0',right:'0',bottom:'0',borderRadius:'19px',transition:'0.3s',background:settings.generationSettings.volcanoGenerationThinking ? '#4a90d9' : '#ccc'}" />
              <span :style="{position:'absolute',top:'2px',left:settings.generationSettings.volcanoGenerationThinking ? '17px' : '2px',width:'15px',height:'15px',borderRadius:'50%',background:'#fff',transition:'0.3s'}" />
            </label>
          </div>
          <!-- 阿里百炼 -->
          <div style="display:flex;align-items:center;justify-content:space-between;padding:4px 0;">
            <span style="font-size:12px;">阿里百炼（通义千问）</span>
            <label style="position:relative;display:inline-block;width:34px;height:19px;flex-shrink:0;cursor:pointer;">
              <input
                v-model="settings.generationSettings.alibabaGenerationThinking"
                type="checkbox"
                style="opacity:0;width:0;height:0;"
              >
              <span :style="{position:'absolute',top:'0',left:'0',right:'0',bottom:'0',borderRadius:'19px',transition:'0.3s',background:settings.generationSettings.alibabaGenerationThinking ? '#4a90d9' : '#ccc'}" />
              <span :style="{position:'absolute',top:'2px',left:settings.generationSettings.alibabaGenerationThinking ? '17px' : '2px',width:'15px',height:'15px',borderRadius:'50%',background:'#fff',transition:'0.3s'}" />
            </label>
          </div>
          <!-- 智谱 GLM -->
          <div style="display:flex;align-items:center;justify-content:space-between;padding:4px 0;">
            <span style="font-size:12px;">智谱 GLM（模型侧可能强制推理，参数不一定生效）</span>
            <label style="position:relative;display:inline-block;width:34px;height:19px;flex-shrink:0;cursor:pointer;">
              <input
                v-model="settings.generationSettings.zhipuGenerationThinking"
                type="checkbox"
                style="opacity:0;width:0;height:0;"
              >
              <span :style="{position:'absolute',top:'0',left:'0',right:'0',bottom:'0',borderRadius:'19px',transition:'0.3s',background:settings.generationSettings.zhipuGenerationThinking ? '#4a90d9' : '#ccc'}" />
              <span :style="{position:'absolute',top:'2px',left:settings.generationSettings.zhipuGenerationThinking ? '17px' : '2px',width:'15px',height:'15px',borderRadius:'50%',background:'#fff',transition:'0.3s'}" />
            </label>
          </div>
          <!-- Ollama 本地 -->
          <div style="display:flex;align-items:center;justify-content:space-between;padding:4px 0;">
            <span style="font-size:12px;">Ollama 本地（r1 等推理模型生效）</span>
            <label style="position:relative;display:inline-block;width:34px;height:19px;flex-shrink:0;cursor:pointer;">
              <input
                v-model="settings.generationSettings.ollamaGenerationThinking"
                type="checkbox"
                style="opacity:0;width:0;height:0;"
              >
              <span :style="{position:'absolute',top:'0',left:'0',right:'0',bottom:'0',borderRadius:'19px',transition:'0.3s',background:settings.generationSettings.ollamaGenerationThinking ? '#4a90d9' : '#ccc'}" />
              <span :style="{position:'absolute',top:'2px',left:settings.generationSettings.ollamaGenerationThinking ? '17px' : '2px',width:'15px',height:'15px',borderRadius:'50%',background:'#fff',transition:'0.3s'}" />
            </label>
          </div>
        </div>

        <p style="font-size:12px;color:#666;margin-top:8px;border-top:1px solid #eee;padding-top:8px;">
          💡 <b>0=完全确定</b>（每次输出相同），<b>0.3=低随机</b>，<b>0.5=平衡</b>，<b>1.0+=高创意</b>
        </p>
        <div style="margin-top:10px;background:#f8f9fa;border-radius:8px;padding:10px 12px;font-size:11px;line-height:1.6;color:#555;">
          <div style="font-weight:600;margin-bottom:6px;color:#333;">
            📖 温度使用指南
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:11px;">
            <tr style="border-bottom:1px solid #e0e0e0;">
              <td style="padding:3px 4px;font-weight:600;white-space:nowrap;">
                📊 分析/提取
              </td>
              <td style="padding:3px 4px;">
                <b>0–0.2</b> 精准稳定 · <b>0.3+</b> 可能产生幻觉，不推荐
              </td>
            </tr>
            <tr style="border-bottom:1px solid #e0e0e0;">
              <td style="padding:3px 4px;font-weight:600;white-space:nowrap;">
                📄 整卷正文生成
              </td>
              <td style="padding:3px 4px;">
                <b>0.5–0.8</b> 情境/题目/卷面创作性 · <b>1.0+</b> 高创意
              </td>
            </tr>
            <tr>
              <td style="padding:3px 4px;font-weight:600;white-space:nowrap;">
                ✅ 答案页生成
              </td>
              <td style="padding:3px 4px;">
                <b>0–0.3</b> 阅卷严谨准确 · <b>0.5+</b> 可能发散，不推荐
              </td>
            </tr>
          </table>
          <p style="margin:6px 0 0;color:#999;">
            ⚡ 温度 0 不保证绝对一致（GPU 浮点运算有微小差异），但差异可忽略
          </p>
          <p style="margin:4px 0 0;color:#999;">
            🔄 何时调整：输出重复雷同/平淡 → 略升；跑题/格式乱/内容出错 → 略降。每次只调 0.1，小步验证再决定是否继续。
          </p>
          <p style="margin:4px 0 0;color:#999;">
            🧠 温度只控制随机性与发散度，不决定模型能力——调高不会让模型"更聪明"，只会更敢于变化（也更易出错）；调低更稳定、更保守。质量上不去时优先换更强模型，而不是一味调温度。
          </p>
          <p style="margin:4px 0 0;color:#999;">
            📌 思考模式开启时，正文/答案预算会按「思考模式预算倍数」放大——温度与思考相互独立，可组合使用。
          </p>
        </div>
      </div>

      <!-- 数据备份 -->
      <div class="settings-section">
        <h3>💾 数据备份与恢复</h3>
        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
          <button
            class="btn"
            :disabled="isExporting"
            @click="exportData"
          >
            {{ isExporting ? '导出中...' : '📥 导出备份' }}
          </button>
          <button
            class="btn"
            :disabled="isImporting"
            @click="selectAndImport"
          >
            {{ isImporting ? '导入中...' : '📤 导入恢复' }}
          </button>
        </div>
        <p
          v-if="backupStatus"
          style="margin-top: 10px; font-size: 13px; color: var(--primary-light);"
        >
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
          <button
            class="btn"
            :disabled="isCheckingDeps"
            @click="checkPythonDeps"
          >
            {{ isCheckingDeps ? '检测中...' : '🔍 检测依赖' }}
          </button>
          <button
            class="btn-primary"
            :disabled="isInstallingDeps"
            @click="installPythonDeps"
          >
            {{ isInstallingDeps ? '安装中...' : '⚡ 一键安装缺失依赖' }}
          </button>
        </div>
        <p
          v-if="pythonDepsStatus"
          style="margin-top: 10px; font-size: 13px; color: var(--primary-light);"
        >
          {{ pythonDepsStatus }}
        </p>
        <p
          v-if="missingDeps.length > 0"
          style="margin-top: 8px; font-size: 12px; color: var(--warning);"
        >
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
          <select
            v-model="logFilter"
            style="width:auto;font-size:11px;padding:4px 6px;"
          >
            <option value="">
              全部级别
            </option>
            <option value="error">
              🔴 错误
            </option>
            <option value="warn">
              🟡 警告
            </option>
            <option value="log">
              🔵 日志
            </option>
          </select>
          <button
            class="btn-small"
            @click="copyLogsToClipboard"
          >
            📋 复制
          </button>
          <button
            class="btn-small"
            @click="logStore.clearLogs()"
          >
            🗑️ 清空
          </button>
        </div>
        <div
          v-if="filteredLogs.length > 0"
          class="log-viewer"
        >
          <div
            v-for="entry in filteredLogs"
            :key="entry.id"
            class="log-entry"
            :class="'log-' + entry.level"
          >
            <span class="log-time">{{ entry.time }}</span>
            <span class="log-msg">{{ entry.message }}</span>
          </div>
        </div>
        <p
          v-else
          style="font-size:11px;color:#999;"
        >
          暂无日志记录
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { Capacitor } from '@capacitor/core';
import { useActivation } from '@/composables/useActivation.js';
import { useDialog } from '@/composables/useDialog.js';
import { useBackup } from '@/composables/useBackup.js';
import { useWebAuth, clearWebAuth } from '@/composables/useWebAuth.js';
import useLogger, { copyLogs } from '@/composables/useLogger.js';
import { apiConfig, DEFAULT_BUDGET_BY_TYPE, normalizeBudgetByType, getAvailableModels, refreshConfigCache, saveConfig, decrypt, autoDiscoverDeepSeekModel } from '@/config/apiConfig.js';
import { cancelAllRequests } from '@/utils/requestManager.js';
import { listTypeBuckets, applyCalibration, clearCalibration, setCalibratedEnabled, CHARS_PER_TOKEN, CALIBRATION_THRESHOLDS } from '@/utils/budgetCalibration.js';
import { recordAudit, getAuditLogs, clearAuditLogs, getAuditCount } from '@/utils/auditLog.js';
import { getSyncKey, setSyncKey, getDeviceName, setDeviceName, probeCloud, fetchCloudDevices, deleteDeviceFromCloud } from '@/utils/cloudStorage';
import { getSignCountdown, resetInstallTime, formatDaysRemaining } from '@/utils/signatureCheck';
import { STAGE_KEYS } from '@/utils/gradeStage.js'; // 五档学段键唯一事实源（CAL_STAGE_KEYS 复用，不再本地另建副本）
import { APP_EVENTS } from '@/constants/events.js'; // 全局事件名唯一事实源（曾字面量分发 show-toast/sign-countdown-reset）
import { STORAGE_KEYS } from '@/constants/storageKeys.js'; // localStorage 业务 key 唯一事实源（apiConfig/storagePath/activationInfo 曾字面量）

const { showAlertDialogFn, showConfirmDialogFn } = useDialog();
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
    window.dispatchEvent(new CustomEvent(APP_EVENTS.SHOW_TOAST, { detail: { message: '✅ 日志已复制到剪贴板', type: 'info' } }));
  } else {
    window.dispatchEvent(new CustomEvent(APP_EVENTS.SHOW_TOAST, { detail: { message: '❌ 复制失败，请检查浏览器权限', type: 'warning' } }));
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
    window.dispatchEvent(new CustomEvent(APP_EVENTS.SHOW_TOAST, { detail: { message: '✅ 设备名已更新，下次上推时生效', type: 'info' } }));
  }
};

const onDeviceNameEnter = (e) => {
  e.target.blur();
};

// ☁️ 云端设备管理
const cloudDevices = ref([]);
const cloudDevicesLoading = ref(false);
const cloudDevicesFetched = ref(false);
const removingDeviceId = ref(null);

const loadCloudDevices = async () => {
  cloudDevicesLoading.value = true;
  cloudDevicesFetched.value = false;
  try {
    // 强制重新探测云端（showReadyHint=false 避免多余日志）
    await probeCloud(false);
    cloudDevices.value = await fetchCloudDevices();
    cloudDevicesFetched.value = true;
    if (cloudDevices.value.length === 0) {
      console.log('ℹ️ 云端设备列表为空（已按显示规则过滤，查看控制台日志获取完整列表）');
    }
  } catch (e) {
    console.warn('加载云端设备列表失败:', e);
    cloudDevices.value = [];
    cloudDevicesFetched.value = true;
  } finally {
    cloudDevicesLoading.value = false;
  }
};

const confirmRemoveDevice = async (dev) => {
  const confirmed = await showConfirmDialogFn(
    `⚠️ 确定要移除「${dev.label}」的云端数据吗？\n\n` +
    `该设备有 ${dev.histCount} 条历史记录和 ${dev.genCount} 条生成结果。\n\n` +
    `此操作不可撤销，仅删除云端数据，不影响其他设备。`
  );

  if (!confirmed) return;

  removingDeviceId.value = dev.deviceId;
  try {
    const success = await deleteDeviceFromCloud(dev.deviceId);
    if (success) {
      cloudDevices.value = cloudDevices.value.filter(d => d.deviceId !== dev.deviceId);
      window.dispatchEvent(new CustomEvent(APP_EVENTS.SHOW_TOAST, { detail: { message: `✅ 已移除「${dev.label}」的云端数据`, type: 'info' } }));
    } else {
      window.dispatchEvent(new CustomEvent(APP_EVENTS.SHOW_TOAST, { detail: { message: '⚠️ 移除失败，请稍后重试', type: 'warning' } }));
    }
  } catch (e) {
    console.warn('移除设备失败:', e);
    window.dispatchEvent(new CustomEvent(APP_EVENTS.SHOW_TOAST, { detail: { message: '❌ 移除异常，请稍后重试', type: 'warning' } }));
  } finally {
    removingDeviceId.value = null;
  }
};

// 📱 签名倒计时
const signInfo = ref(getSignCountdown());
const signDaysInfo = ref(formatDaysRemaining(signInfo.value.daysRemaining));

const handleResetCountdown = () => {
  resetInstallTime();
  signInfo.value = getSignCountdown();
  signDaysInfo.value = formatDaysRemaining(signInfo.value.daysRemaining);
  // 通知 App.vue 更新顶部徽章
  window.dispatchEvent(new CustomEvent(APP_EVENTS.SIGN_COUNTDOWN_RESET));
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
    localStorage.removeItem(STORAGE_KEYS.ACTIVATION_INFO);
  }
  window.location.reload();
};

// API 申请指南展开/收起
const showGuide = ref(false);

const settings = ref({
  currentEngine: apiConfig.currentEngine,
  analysisEngine: apiConfig.analysisEngine || '',
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
  volcanoApiKey: apiConfig.volcanoApiKey || '',
  volcanoBaseUrl: apiConfig.volcanoBaseUrl || 'https://ark.cn-beijing.volces.com/api/v3',
  volcanoGenerationModel: apiConfig.volcanoGenerationModel || 'doubao-seed-2-1-turbo-260628',
  volcanoAnalysisModel: apiConfig.volcanoAnalysisModel || 'doubao-seed-2-1-pro-260628',
  alibabaApiKey: apiConfig.alibabaApiKey || '',
  alibabaBaseUrl: apiConfig.alibabaBaseUrl || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  alibabaGenerationModel: apiConfig.alibabaGenerationModel || 'qwen3.8-27b',
  alibabaAnalysisModel: apiConfig.alibabaAnalysisModel || 'qwen3.8-max',
  zhipuApiKey: apiConfig.zhipuApiKey || '',
  zhipuBaseUrl: apiConfig.zhipuBaseUrl || 'https://open.bigmodel.cn/api/paas/v4',
  zhipuGenerationModel: apiConfig.zhipuGenerationModel || 'glm-5.3',
  zhipuAnalysisModel: apiConfig.zhipuAnalysisModel || 'glm-5.3',
  analyzeCharts: true,
  storagePath: localStorage.getItem(STORAGE_KEYS.STORAGE_PATH) || '智卷工坊数据',
  generationSettings: JSON.parse(JSON.stringify(apiConfig.generationSettings))
});

const availableTextModels = ref(['qwen2.5:7b', 'qwen2:7b']);

// 🔧 DeepSeek 模型选项（优先云端发现，兜底常用列表）
const deepseekModelOptions = ref(['deepseek-v4-flash', 'deepseek-v4-pro']);

// 🔗 预算配置·资料类型表（key 与 apiConfig.budgetByType / promptLibrary.GEN_TYPE_NAMES 双轨一致）
const BUDGET_TYPE_ORDER = [
  { key: 'exam',     name: '正式考卷' },
  { key: 'practice', name: '课时练' },
  { key: 'special',  name: '专项突破' },
  { key: 'reading',  name: '阅读训练' },
  { key: 'summary',  name: '知识总结' },
  { key: 'review',   name: '复习资料' },
  { key: 'preview',  name: '课前预习' },
  { key: 'dictation', name: '默写积累' },
  { key: 'errorbook', name: '错题本' },
];
const BUDGET_TIERS = [
  { key: 'economy',  name: '精简档', note: '省token·内容精简' },
  { key: 'balanced', name: '均衡档', note: '平衡性价比（默认）' },
  { key: 'full',     name: '充分档', note: '内容优先·更详尽' },
];
const budgetByTypeNames = (t) => ({ economy: '精简档', balanced: '均衡档', full: '充分档' }[t] || t);

// 🔧 budgetByType 槽位规整：单一实现 = apiConfig.normalizeBudgetByType（生成端读取兜底共用同一份，
//    曾与 apiConfig 内同名同构逻辑双份维护；此处仅保留别名以兼容本文件调用点）
const normalizeBudgetSlots = normalizeBudgetByType;

// 🔧 初始化补全：设置页内存的 budgetByType 永保完整槽位（渲染期间 budgetBt 纯读取）
//    先抓取「原始存档 cap」（未归一化前的值）供"设计默认/存档"双值切换用；
//    归一化后 slot.cap 要么是存档值、要么是代码默认，已无法区分来源，故须在归一化前快照。
const RAW_BUDGET = settings.value.generationSettings?.budgetByType || null;
const pristineSavedCaps = {};
if (RAW_BUDGET) {
  for (const [tk, tv] of Object.entries(RAW_BUDGET)) {
    pristineSavedCaps[tk] = {};
    for (const slot of ['body', 'answer', 'once']) {
      const s = tv && tv[slot];
      pristineSavedCaps[tk][slot] = (s && typeof s.cap === 'number' && s.cap > 0) ? s.cap : null; // null=无存档 → 视同设计默认
    }
  }
}
(() => {
  const gs = settings.value.generationSettings || {};
  gs.budgetByType = normalizeBudgetSlots(gs.budgetByType || {});
})();

// 该类型槽的「设计默认上限」与「存档上限」双值视图；存档无值时回退设计默认（与 normalize 承诺同口径）
const designCap = (type, slot) => DEFAULT_BUDGET_BY_TYPE[type]?.[slot]?.cap ?? 20000;
const archiveCapOf = (type, slot) => {
  const saved = pristineSavedCaps[type]?.[slot];
  return (saved != null) ? saved : designCap(type, slot);
};
// 采用「设计默认上限」（即最新代码 DEFAULT_BUDGET_BY_TYPE 的上限，点「保存设置」生效）
const applyDesignCap = (type, slot) => {
  const sc = budgetBt()[type]?.[slot];
  if (sc) sc.cap = designCap(type, slot);
};
// 采用「存档上限」（即更早一版设计默认固化进存储的值；无存档时等同设计默认）
const applyArchiveCap = (type, slot) => {
  const sc = budgetBt()[type]?.[slot];
  if (sc) sc.cap = archiveCapOf(type, slot);
};

// 一键把全部 9 类型的 tier 设为同一档位（快捷套档）
const setAllTiers = (tier) => {
  const gs = settings.value.generationSettings || {};
  if (!gs.budgetByType) return;
  for (const t of BUDGET_TYPE_ORDER) {
    if (gs.budgetByType[t.key]) gs.budgetByType[t.key].tier = tier;
  }
  saveStatus.value = `已将所有资料类型预算档位设为「${budgetByTypeNames(tier)}」，请点「保存设置」生效`;
  setTimeout(() => { saveStatus.value = ''; }, 5000);
};

// 🔧 一键把所有类型的生成路径设为同一路径（auto / split / once）；每类型仍可个别微调
const setAllPaths = (path) => {
  const label = { auto: '自动（按类型）', split: '两次生成', once: '一次成型' }[path] || path;
  const gs = settings.value.generationSettings || {};
  if (!gs.budgetByType) return;
  for (const t of BUDGET_TYPE_ORDER) {
    if (gs.budgetByType[t.key]) gs.budgetByType[t.key].mode = path;
  }
  saveStatus.value = `已将所有资料类型生成路径设为「${label}」，请点「保存设置」生效`;
  setTimeout(() => { saveStatus.value = ''; }, 5000);
};

// 🔧 大范围浏览·漏章自动补齐 开关（默认开）：
//    开 = 检出漏章先交模型确认、未采用时程序有界兜底补料（报告标注程序兜底）；关 = 仅列入主编式提醒。
const toggleBrowseAutoFill = () => {
  const gs = settings.value.generationSettings || {};
  gs.browseAutoFill = (gs.browseAutoFill !== false) ? false : true;
  saveStatus.value = gs.browseAutoFill === false ? '已切换为「仅提醒」：漏章不再交给模型确认/程序兜底，只列入主编式提醒。请点「保存设置」生效' : '已切换为「漏章覆盖」：检出漏章先交模型确认、未采用再由程序有界兜底补料。请点「保存设置」生效';
  setTimeout(() => { saveStatus.value = ''; }, 5000);
};

// 生成端读取的系数在配置里，这里仅作"当前生效值"展示辅助（与生成端 pickSlot 同口径）
// 纯读取：返回当前内存中的 budgetByType（无副作用，模板多读安全——不能在渲染中做补全/深拷贝）
const budgetBt = () => settings.value.generationSettings?.budgetByType || {};

// ── 实测校准 UI（每类型×学科×学段分桶；数据由 budgetCalibration 落库驱动）──
const CAL_STAGE_KEYS = STAGE_KEYS; // 五档键唯一事实源（gradeStage），不本地另建副本
const calStageName = (s) => ({ primary_low: '小学低段', primary_mid: '小学中段', primary_high: '小学高段', middle: '初中', high: '高中' }[s] || s || '');
const CAL_SUBJECT_KEYS = ['语文', '数学', '英语', '科学', '道法', '道德与法治', '历史', '地理', '生物', '物理', '化学', '政治'];
const calThresholdLabel = `${CALIBRATION_THRESHOLDS.standard}条`;
const calStageFilter = ref({});
const calSubjectFilter = ref({});
const calModeFilter = ref({});
// 分桶视图：返回该类型下过滤后的桶（split/once 独立分桶，绝不混算；每次读取重算）
const calBucketsFor = (rowKey) => {
  const sf = calStageFilter.value[rowKey] || '';
  const su = calSubjectFilter.value[rowKey] || '';
  const md = calModeFilter.value[rowKey] || '';
  const all = listTypeBuckets(rowKey, { threshold: CALIBRATION_THRESHOLDS.standard });
  return all.filter(b => (!sf || b.stage === sf) && (!su || b.subject === su) && (!md || b.mode === md));
};
const adoptCalibration = (rowKey, bk) => {
  const res = applyCalibration(rowKey, bk.subject, bk.stage, bk.mode || '', CALIBRATION_THRESHOLDS.standard);
  if (res.ok) {
    const detail = `按实测采纳：基准产出率 ${res.base.toFixed(2)}，样本 ${res.stats.count}`;
    recordAudit({ action: 'adopt', operator: getDeviceName() || '本地', genType: rowKey, subject: bk.subject, stage: bk.stage, mode: bk.mode || '', detail });
    window.dispatchEvent(new CustomEvent(APP_EVENTS.SHOW_TOAST, { detail: { message: `✅ 已按实测采纳「${rowKey} · ${bk.subject} · ${calStageName(bk.stage)} · ${bk.mode === 'split' ? '两次' : '一次'}」（基准产出率 ${res.base.toFixed(2)}，样本 ${res.stats.count}）`, type: 'info' } }));
  } else {
    window.dispatchEvent(new CustomEvent(APP_EVENTS.SHOW_TOAST, { detail: { message: `采纳失败：${res.reason || '未知'}`, type: 'warning' } }));
  }
};
const clearCalibrationRow = async (rowKey, bk) => {
  const confirmed = await showConfirmDialogFn(
    `⚠️ 确定要清理「${rowKey} · ${bk.subject} · ${calStageName(bk.stage)} · ${bk.mode === 'split' ? '两次' : '一次'}」的校准吗？\n\n` +
    `将删除该校准值及该维度累积的 ${bk.stats.count} 条有效样本（含 ${bk.stats.inValid} 条失效），彻底回退播种默认、从零重采样。\n\n` +
    `此操作不可撤销；切换回去/重新校准需重新积累样本。`
  );
  if (!confirmed) return;
  clearCalibration(rowKey, bk.subject, bk.stage, bk.mode || '');
  recordAudit({ action: 'clear', operator: getDeviceName() || '本地', genType: rowKey, subject: bk.subject, stage: bk.stage, mode: bk.mode || '', detail: '清理校准：校准值+样本一并清除，回退播种默认' });
  window.dispatchEvent(new CustomEvent(APP_EVENTS.SHOW_TOAST, { detail: { message: `已清理「${rowKey} · ${bk.subject} · ${calStageName(bk.stage)} · ${bk.mode === 'split' ? '两次' : '一次'}」（校准值+样本一并清除，回退播种默认）`, type: 'info' } }));
};
// 播种对照：取该类型播种默认"均衡档"系数（token/字符）× CHARS_PER_TOKEN 转成"产出率基线(字符/字符)"，与校准 calBase 同单位可比。
const seedCoefFor = (rowKey, mode) => {
  const def = DEFAULT_BUDGET_BY_TYPE[rowKey];
  if (!def) return '—';
  const slot = mode === 'split' ? 'body' : 'once';
  const s = def[slot];
  if (!s || typeof s.balanced !== 'number') return '—';
  return (s.balanced * CHARS_PER_TOKEN).toFixed(2);
};
// 切换：只翻 enabled 位，保留校准数据与样本（与"清理"严格区分）。
const toggleCalibrated = (rowKey, bk) => {
  const next = setCalibratedEnabled(rowKey, bk.subject, bk.stage, bk.mode || '', !bk.enabled);
  if (next === null) {
    window.dispatchEvent(new CustomEvent(APP_EVENTS.SHOW_TOAST, { detail: { message: '切换失败：该校准已不存在', type: 'warning' } }));
    return;
  }
  recordAudit({ action: 'toggle', operator: getDeviceName() || '本地', genType: rowKey, subject: bk.subject, stage: bk.stage, mode: bk.mode || '', detail: `切换启用 → ${next ? '使用校准值' : '使用播种默认'}` });
  window.dispatchEvent(new CustomEvent(APP_EVENTS.SHOW_TOAST, { detail: { message: `已切换「${rowKey} · ${bk.subject} · ${calStageName(bk.stage)} · ${bk.mode === 'split' ? '两次' : '一次'}」为${next ? '使用校准值' : '使用播种默认'}`, type: 'info' } }));
};

// 操作流水（审计）：只读展示 + 清空流水（清日志不影响校准数据）。
const auditOpen = ref({});
const actLabel = (a) => ({ adopt: '一键采纳', toggle: '切换启用', clear: '清理校准', clearLogs: '清空流水' }[a] || a);
const auditLogsFor = (rowKey) => getAuditLogs({ bucket: { genType: rowKey } });
const auditCountFor = (rowKey) => auditLogsFor(rowKey).length;
const clearAuditFor = async (rowKey) => {
  const n = auditCountFor(rowKey);
  if (!n) {
    window.dispatchEvent(new CustomEvent(APP_EVENTS.SHOW_TOAST, { detail: { message: '暂无操作流水可清空', type: 'info' } }));
    return;
  }
  const confirmed = await showConfirmDialogFn(
    `⚠️ 确定要清空「${rowKey}」的 ${n} 条操作流水吗？\n\n` +
    `仅删除审计日志记录，不影响任何校准值或样本数据。此操作不可撤销。`
  );
  if (!confirmed) return;
  clearAuditLogs({ bucket: { genType: rowKey } });
  window.dispatchEvent(new CustomEvent(APP_EVENTS.SHOW_TOAST, { detail: { message: `已清空「${rowKey}」的 ${n} 条操作流水（仅删除日志，不影响校准数据与样本）`, type: 'info' } }));
};
const fmtAuditTime = (t) => new Date(t).toLocaleString('zh-CN', { hour12: false });

// 🔧 槽生效态：用于高亮"生成路径下真实使用的系数槽"。
//    body/answer 属于"两次生成"，once 属于"一次成型"。auto 按类型内置映射（考卷/课时练/专项/复习→两次，其余→一次）。
//    生效槽高亮、非生效槽灰显（视觉弱化，不影响编辑）。
const SLOT_PATH_MAP = { body: 'split', answer: 'split', once: 'once' };
const TYPE_BUILTIN_PATH = (key) => ['exam', 'practice', 'special', 'review'].includes(key) ? 'split' : 'once';
const isSlotActive = (rowKey, slot) => {
  const mode = budgetBt()[rowKey]?.mode || 'auto';
  const effective = mode !== 'auto' ? mode : TYPE_BUILTIN_PATH(rowKey);
  return SLOT_PATH_MAP[slot] === effective;
};

const formatDeepSeekModel = (model) => {
  const nameMap = {
    'deepseek-v4-pro': '🧠 deepseek-v4-pro（分析决策强·慢·思考已关）',
    'deepseek-v4-flash': '⚡ deepseek-v4-flash（快速便宜·思考已关）',
    'deepseek-chat': '💬 deepseek-chat（通用）',
    'deepseek-reasoner': '🧠 deepseek-reasoner（推理）',
  };
  return nameMap[model] || model;
};

// 🔧 成本预设：一键切换4档模型配置
//   economy（经济）：全 Flash，约 ¥0.10/次，质量略降
//   balanced（均衡）：分析+修复用 Pro，生成+审查用 Flash，约 ¥0.25/次（推荐）
//   flagship（旗舰）：全 Pro，约 ¥0.60/次，质量最高
const applyModelPreset = (preset) => {
  const presets = {
    economy: {
      generation: 'deepseek-v4-flash',
      analysis: 'deepseek-v4-flash',
      review: 'deepseek-v4-flash',
      repair: 'deepseek-v4-flash',
      label: '💰 经济模式：全 Flash · 约 ¥0.10/次 · 质量略降',
    },
    balanced: {
      generation: 'deepseek-v4-flash',
      analysis: 'deepseek-v4-pro',
      review: 'deepseek-v4-flash',
      repair: 'deepseek-v4-pro',
      label: '⚖️ 均衡模式：分析+修复 Pro · 约 ¥0.25/次 · 推荐',
    },
    flagship: {
      generation: 'deepseek-v4-pro',
      analysis: 'deepseek-v4-pro',
      review: 'deepseek-v4-pro',
      repair: 'deepseek-v4-pro',
      label: '👑 旗舰模式：全 Pro · 约 ¥0.60/次 · 质量最高',
    },
  };
  const p = presets[preset];
  if (!p) return;
  settings.value.deepseekGenerationModel = p.generation;
  settings.value.deepseekAnalysisModel = p.analysis;
  saveStatus.value = p.label;
  setTimeout(() => { saveStatus.value = ''; }, 4000);
};

const saveStatus = ref('');

const formatModelName = (modelName) => {
  const nameMap = {
    'deepseek-r1:32b': '🧠 deepseek-r1:32b（命题最强·需24GB+显存）',
    'deepseek-r1:14b': '🧠 deepseek-r1:14b（命题最优·需16GB+显存·配置升级后推荐）',
    'deepseek-r1:8b': '🧠 deepseek-r1:8b（性价比之选·8GB显存可跑）',
    'glm4:9b': '📚 glm4:9b（总结/学术精准·8GB显存）',
    'qwen2.5:14b': '🌟 qwen2.5:14b（全类型稳定·需12GB+显存）',
    'qwen2.5:7b': '🌟 qwen2.5:7b（日常轻量·6GB显存）',
    'qwen2.5:1.5b': '📘 qwen2.5:1.5b（极轻量·CPU可跑）',
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
      localStorage.setItem(STORAGE_KEYS.STORAGE_PATH, selectedPath);
      await showAlertDialogFn(`✅ 存储路径已设置为：\n${selectedPath}`);
    }
  } catch (error) {
    await showAlertDialogFn('❌ 选择文件夹失败，请手动输入路径');
  }
};

const resetTemperatureDefaults = () => {
  settings.value.generationSettings.analysisTemperature = 0.1;
  settings.value.generationSettings.paperTemperature = 0.7;
  settings.value.generationSettings.answerTemperature = 0.3;
};

const saveSettings = async () => {
  const oldEngine = apiConfig.currentEngine;
  const newEngine = settings.value.currentEngine;

  if (oldEngine !== newEngine) {
    await cancelAllRequests();
  }

  apiConfig.currentEngine = settings.value.currentEngine;
  apiConfig.analysisEngine = settings.value.analysisEngine || '';
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
  apiConfig.volcanoApiKey = settings.value.volcanoApiKey;
  apiConfig.volcanoBaseUrl = settings.value.volcanoBaseUrl;
  apiConfig.volcanoGenerationModel = settings.value.volcanoGenerationModel;
  apiConfig.volcanoAnalysisModel = settings.value.volcanoAnalysisModel;
  apiConfig.alibabaApiKey = settings.value.alibabaApiKey;
  apiConfig.alibabaBaseUrl = settings.value.alibabaBaseUrl;
  apiConfig.alibabaGenerationModel = settings.value.alibabaGenerationModel;
  apiConfig.alibabaAnalysisModel = settings.value.alibabaAnalysisModel;
  apiConfig.zhipuApiKey = settings.value.zhipuApiKey;
  apiConfig.zhipuBaseUrl = settings.value.zhipuBaseUrl;
  apiConfig.zhipuGenerationModel = settings.value.zhipuGenerationModel;
  apiConfig.zhipuAnalysisModel = settings.value.zhipuAnalysisModel;
  apiConfig.analyzeCharts = settings.value.analyzeCharts;
  apiConfig.multimodalEngine = settings.value.multimodalEngine || 'paddleocr_vl';
  // 🔧 写回前剔除已废弃字段（dynamicBudgetMode 已被 budgetByType 取代），避免旧配置残留
  const gsToSave = { ...settings.value.generationSettings };
  delete gsToSave.dynamicBudgetMode;
  apiConfig.generationSettings = gsToSave;
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
    qualityEstimate += '\n\n📊 质量预估：云端高质量（DeepSeek V4）';
    qualityEstimate += '\n💰 费用参考：输入¥1.01/百万 · 输出¥2.02/百万 · 缓存命中¥0.02/百万';
    qualityEstimate += '\n👍 性价比最优：生成用 Flash、分析用 Pro · 推理已默认关闭';
  } else if (settings.value.currentEngine === 'volcano') {
    qualityEstimate += '\n\n📊 质量预估：云端高质量（豆包 Seed）';
    qualityEstimate += '\n💰 每日免费200万Token · 超出后¥0.1/百万起';
    qualityEstimate += '\n👍 免费额度大：小量试用首选 · 深度思考默认关闭（可到下方按引擎开启）';
  } else if (settings.value.currentEngine === 'alibaba') {
    qualityEstimate += '\n\n📊 质量预估：云端高质量（通义千问 Qwen）';
    qualityEstimate += '\n💰 qwen3.8-27b ¥3/百万输入·¥12/百万输出 · 新用户送7000万Token';
    qualityEstimate += '\n👍 中档选择：生成用 27b、分析用 max · 推理已默认关闭';
  } else if (settings.value.currentEngine === 'zhipu') {
    qualityEstimate += '\n\n📊 质量预估：云端高质量（智谱 GLM）';
    qualityEstimate += '\n💰 glm-5.3 输入¥8/百万 · 输出¥28/百万 · 能力对标 V4';
    qualityEstimate += '\n⚠️ 性价比最低：强制推理不可关闭，仅追求顶级质量时选用';
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
  const savedConfig = localStorage.getItem(STORAGE_KEYS.API_CONFIG);
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
    const savedConfig = JSON.parse(localStorage.getItem(STORAGE_KEYS.API_CONFIG) || '{}');
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
  const savedSettings = localStorage.getItem(STORAGE_KEYS.API_CONFIG);
  if (savedSettings) {
    try {
      const parsed = JSON.parse(savedSettings);
      // 🔧 修复：解密 deepseekApiKey，防止加密值回显到表单
      // 否则用户在不知情下保存会导致二次加密 → 密钥永久损坏
      // 🔧 修复：解密结果含非法字符（?()@^ 等）视为历史损坏，清空提示重填
      const VALID_KEY_RE = /^[A-Za-z0-9._\-+/=]{12,}$/;
      if (parsed.deepseekApiKey) {
        parsed.deepseekApiKey = await decrypt(parsed.deepseekApiKey);
        if (parsed.deepseekApiKey && !VALID_KEY_RE.test(parsed.deepseekApiKey)) {
          console.warn('⚠️ 检测到损坏的 DeepSeek API Key，已清空，请重新填写');
          parsed.deepseekApiKey = '';
        }
      }
      if (parsed.volcanoApiKey) {
        parsed.volcanoApiKey = await decrypt(parsed.volcanoApiKey);
        if (parsed.volcanoApiKey && !VALID_KEY_RE.test(parsed.volcanoApiKey)) {
          console.warn('⚠️ 检测到损坏的火山引擎 API Key，已清空，请重新填写');
          parsed.volcanoApiKey = '';
        }
      }
      if (parsed.alibabaApiKey) {
        parsed.alibabaApiKey = await decrypt(parsed.alibabaApiKey);
        if (parsed.alibabaApiKey && !VALID_KEY_RE.test(parsed.alibabaApiKey)) {
          console.warn('⚠️ 检测到损坏的阿里百炼 API Key，已清空，请重新填写');
          parsed.alibabaApiKey = '';
        }
      }
      if (parsed.zhipuApiKey) {
        parsed.zhipuApiKey = await decrypt(parsed.zhipuApiKey);
        if (parsed.zhipuApiKey && !VALID_KEY_RE.test(parsed.zhipuApiKey)) {
          console.warn('⚠️ 检测到损坏的智谱 API Key，已清空，请重新填写');
          parsed.zhipuApiKey = '';
        }
      }
      // 🔧 深合并 generationSettings：旧 localStorage 缺少新字段（paperTemperature/answerTemperature 等）时
      //    以默认值补齐，避免被旧对象整体覆盖导致新字段丢失
      if (parsed.generationSettings) {
        parsed.generationSettings = { ...settings.value.generationSettings, ...parsed.generationSettings };
        // 🔧 覆盖后可会重置 budgetByType 为旧/缺槽形状，须重新规整补齐所有类型的 mode/tier/body/answer/once 槽
        parsed.generationSettings.budgetByType = normalizeBudgetSlots(parsed.generationSettings.budgetByType || {});
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

// 🔧 同步后 apiConfig 变化时，实时更新设置页 UI（否则同步切了 DeepSeek，设置页仍显示 Ollama）
watch(() => apiConfig.currentEngine, (newVal) => {
  if (settings.value.currentEngine !== newVal) {
    settings.value.currentEngine = newVal;
  }
});
// 🔧 云端同步后 DeepSeek 字段自动填充到设置页输入框
watch(() => apiConfig.deepseekApiKey, (newVal) => {
  if (settings.value.deepseekApiKey !== newVal) {
    settings.value.deepseekApiKey = newVal;
  }
});
watch(() => apiConfig.deepseekBaseUrl, (newVal) => {
  if (settings.value.deepseekBaseUrl !== newVal) {
    settings.value.deepseekBaseUrl = newVal;
  }
});
watch(() => apiConfig.deepseekGenerationModel, (newVal) => {
  if (settings.value.deepseekGenerationModel !== newVal) {
    settings.value.deepseekGenerationModel = newVal;
  }
});
watch(() => apiConfig.deepseekAnalysisModel, (newVal) => {
  if (settings.value.deepseekAnalysisModel !== newVal) {
    settings.value.deepseekAnalysisModel = newVal;
  }
});
// 🔧 云端同步后火山引擎字段自动填充到设置页输入框
watch(() => apiConfig.volcanoApiKey, (newVal) => {
  if (settings.value.volcanoApiKey !== newVal) {
    settings.value.volcanoApiKey = newVal;
  }
});
watch(() => apiConfig.volcanoBaseUrl, (newVal) => {
  if (settings.value.volcanoBaseUrl !== newVal) {
    settings.value.volcanoBaseUrl = newVal;
  }
});
watch(() => apiConfig.volcanoGenerationModel, (newVal) => {
  if (settings.value.volcanoGenerationModel !== newVal) {
    settings.value.volcanoGenerationModel = newVal;
  }
});
watch(() => apiConfig.volcanoAnalysisModel, (newVal) => {
  if (settings.value.volcanoAnalysisModel !== newVal) {
    settings.value.volcanoAnalysisModel = newVal;
  }
});
// 🔧 云端同步后阿里百炼字段自动填充到设置页输入框
watch(() => apiConfig.alibabaApiKey, (newVal) => {
  if (settings.value.alibabaApiKey !== newVal) {
    settings.value.alibabaApiKey = newVal;
  }
});
watch(() => apiConfig.alibabaBaseUrl, (newVal) => {
  if (settings.value.alibabaBaseUrl !== newVal) {
    settings.value.alibabaBaseUrl = newVal;
  }
});
watch(() => apiConfig.alibabaGenerationModel, (newVal) => {
  if (settings.value.alibabaGenerationModel !== newVal) {
    settings.value.alibabaGenerationModel = newVal;
  }
});
watch(() => apiConfig.alibabaAnalysisModel, (newVal) => {
  if (settings.value.alibabaAnalysisModel !== newVal) {
    settings.value.alibabaAnalysisModel = newVal;
  }
});
// 🔧 云端同步后智谱字段自动填充到设置页输入框
watch(() => apiConfig.zhipuApiKey, (newVal) => {
  if (settings.value.zhipuApiKey !== newVal) {
    settings.value.zhipuApiKey = newVal;
  }
});
watch(() => apiConfig.zhipuBaseUrl, (newVal) => {
  if (settings.value.zhipuBaseUrl !== newVal) {
    settings.value.zhipuBaseUrl = newVal;
  }
});
watch(() => apiConfig.zhipuGenerationModel, (newVal) => {
  if (settings.value.zhipuGenerationModel !== newVal) {
    settings.value.zhipuGenerationModel = newVal;
  }
});
watch(() => apiConfig.zhipuAnalysisModel, (newVal) => {
  if (settings.value.zhipuAnalysisModel !== newVal) {
    settings.value.zhipuAnalysisModel = newVal;
  }
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
  max-width: 860px;
}

/* 常规表单控件保持紧凑：仅下拉/输入收窄到合理宽，预算区等宽布局卡片仍可撑满 860px */
.settings-section select,
.settings-section input[type='text'],
.settings-section input[type='password'],
.settings-section textarea {
  max-width: 520px;
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
  color: #444;
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
  font-size: 14px;
}

.info-row span:first-child {
  width: 100px;
  color: #555;
}

.info-value {
  font-weight: 500;
  color: var(--primary);
  font-size: 14px;
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

/* ☁️ 云端设备列表 */
.cloud-device-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.cloud-device-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid var(--border-light);
}
.cloud-device-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  flex: 1;
  min-width: 0;
}
.cloud-device-name {
  font-weight: 600;
  font-size: 14px;
  color: var(--primary);
}
.cloud-device-self {
  font-size: 11px;
  color: var(--success);
  font-weight: 500;
}
.cloud-device-stats {
  font-size: 12px;
  color: var(--text-muted);
  margin-left: 4px;
}
.btn-danger-outline {
  flex-shrink: 0;
  padding: 4px 12px;
  border: 1px solid #e53e3e;
  border-radius: 6px;
  background: white;
  color: #e53e3e;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
}
.btn-danger-outline:hover {
  background: #e53e3e;
  color: white;
}
.btn-danger-outline:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 📖 API 申请指南 */
.api-guide {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 12px;
}
.guide-item {
  padding: 10px 14px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid var(--border-light);
  font-size: 12px;
  line-height: 1.6;
  color: #555;
}
.guide-item strong {
  color: var(--primary);
  font-size: 13px;
}
.guide-item p {
  margin: 4px 0 0;
  font-size: 12px;
}
.guide-item a {
  color: var(--primary);
  text-decoration: underline;
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
  .budget-active {
    background: #1f6feb !important;
    color: #fff !important;
    border-color: #1f6feb !important;
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
