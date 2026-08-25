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

      <!-- ☁️ 云端设备管理 -->
      <div class="settings-section">
        <h3>☁️ 云端设备管理</h3>
        <p style="font-size:12px;color:#666;margin-bottom:8px;">
          查看并管理已同步到云端的设备。移除操作仅删除云端的设备数据，不影响其他设备和本机。
        </p>
        <div style="display:flex;gap:8px;margin-bottom:12px;">
          <button class="btn-small" @click="loadCloudDevices" :disabled="cloudDevicesLoading">
            {{ cloudDevicesLoading ? '⏳ 加载中…' : '🔄 加载设备列表' }}
          </button>
        </div>
        <div v-if="cloudDevices.length > 0" class="cloud-device-list">
          <div v-for="dev in cloudDevices" :key="dev.deviceId" class="cloud-device-row">
            <div class="cloud-device-info">
              <span class="cloud-device-name">{{ dev.label }}</span>
              <span v-if="dev.isSelf" class="cloud-device-self">（本机）</span>
              <span class="cloud-device-stats">
                历史 {{ dev.histCount }} 条
                <span v-if="dev.genCount > 0"> · 生成 {{ dev.genCount }} 条</span>
              </span>
            </div>
            <button
              v-if="!dev.isSelf"
              class="btn-small btn-danger-outline"
              @click="confirmRemoveDevice(dev)"
              :disabled="removingDeviceId === dev.deviceId"
            >
              {{ removingDeviceId === dev.deviceId ? '⏳ 移除中…' : '🗑️ 移除' }}
            </button>
          </div>
        </div>
        <div v-else-if="!cloudDevicesLoading && cloudDevicesFetched" style="font-size:13px;color:var(--text-muted);padding:8px 0;">
          暂无云端设备数据，或尚未配置同步密钥。
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

      <!-- 🤖 AI 引擎选择 -->
      <div class="settings-section">
        <h3>🤖 AI 引擎</h3>
        <label>选择引擎</label>
        <select v-model="settings.currentEngine">
          <option value="ollama">🦙 Ollama 本地 —— 免费 · 需自备硬件（≥16GB显存）</option>
          <option value="deepseek">🌐 DeepSeek —— 💰低 · 推荐 · ¥2.02/百万输出 · 峰谷价</option>
          <option value="volcano">🔥 火山引擎 —— 💰免费额度大 · 每日200万Token · 超出¥0.1起</option>
          <option value="alibaba">☁️ 阿里百炼 —— 💰中 · ¥12/百万输出起 · 新用户送7000万</option>
          <option value="zhipu">🧠 智谱 GLM —— 💰高 · ¥28/百万输出 · ⚠️强制推理</option>
        </select>
        <p style="font-size:11px;color:#888;margin-top:6px;">
          💡 费用档位：Ollama 免费（只要硬件）＜ DeepSeek 最低 ≈ 火山（免费额度大）＜ 阿里 ＜ 智谱（强制推理最贵）。<br/>
          切换引擎无需重新填写 API Key。选择哪个引擎就用哪个引擎工作。错误会直接提示，不会自动切换。
        </p>

        <label style="margin-top:14px;">📋 分析/提取引擎（可选）</label>
        <select v-model="settings.analysisEngine">
          <option value="">跟随主引擎（推荐）</option>
          <option value="ollama">🦙 Ollama 本地（免费·分析提取用轻量模型）</option>
          <option value="deepseek">🌐 DeepSeek（Pro 分析最强）</option>
          <option value="volcano">🔥 火山引擎（豆包）</option>
          <option value="alibaba">☁️ 阿里百炼（通义千问）</option>
          <option value="zhipu">🧠 智谱 GLM</option>
        </select>
        <p class="model-hint">💡 单独指定分析/提取（教材解读、知识点分析）用的引擎，生成/蓝图仍走上方主引擎。<br/>
          例：主引擎 DeepSeek 生成 + 分析提取用本地 Ollama（免费），需在 Ollama 区把"分析提取模型"设为 glm4:9b 等 8GB 可跑的模型。</p>
      </div>

      <!-- 🦙 Ollama 配置 -->
      <div v-if="settings.currentEngine === 'ollama'" class="settings-section">
        <h3>🦙 Ollama 配置（文本任务）</h3>
        <label>服务地址</label>
        <input type="text" v-model="settings.ollamaBaseUrl" placeholder="http://localhost:11434" />

        <label>重型模型（命题生成、蓝图规划）</label>
        <select v-model="settings.ollamaTextModel">
          <option v-for="m in availableTextModels" :key="m" :value="m">{{ formatModelName(m) }}</option>
        </select>
        <p class="model-hint">💡 14B 重型模型需 16GB+ 显存：当前配置不够可先选 8B/9B，电脑升级后再切回 14B 命题质量最高（推理已关闭，选大模型只为生成质量）</p>

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
        <p class="model-hint">💡 deepseek-r1:14b→命题最准（需16GB+显存）| 留空=跟随重型模型</p>

        <label>📊 质量审查模型（可选）</label>
        <select v-model="settings.ollamaReviewModel">
          <option value="">跟随重型模型</option>
          <option v-for="m in availableTextModels" :key="'rev_' + m" :value="m">{{ formatModelName(m) }}</option>
        </select>
        <p class="model-hint">💡 deepseek-r1:8b 或 glm4:9b→审查更稳 | 留空=跟随重型模型</p>

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

      <!-- 🌐 DeepSeek 配置 -->
      <div v-if="settings.currentEngine === 'deepseek'" class="settings-section">
        <h3>🌐 DeepSeek 配置</h3>
        <p style="font-size:12px;color:#666;margin-bottom:4px;">
          💰 费用低 · 推荐首选：输入 ¥1.01/百万 · 输出 ¥2.02/百万 · 缓存命中 ¥0.02/百万 · 高峰(9-12/14-18工作日)×2
        </p>
        <p class="model-hint">👍 性价比最优：生成用 Flash（快且便宜）、分析用 Pro（精准）· 推理已默认关闭</p>
        <label>API Key</label>
        <input type="password" v-model="settings.deepseekApiKey" placeholder="sk-..." />
        <input type="text" v-model="settings.deepseekBaseUrl" placeholder="https://api.deepseek.com/v1" />

        <!-- 🔧 成本预设按钮 -->
        <div style="display:flex;gap:6px;margin:10px 0;flex-wrap:wrap;">
          <button @click="applyModelPreset('economy')" style="padding:5px 10px;font-size:12px;border:1px solid #4caf50;border-radius:4px;background:#e8f5e9;cursor:pointer;">💰 经济模式</button>
          <button @click="applyModelPreset('balanced')" style="padding:5px 10px;font-size:12px;border:1px solid #2196f3;border-radius:4px;background:#e3f2fd;cursor:pointer;">⚖️ 均衡模式（推荐）</button>
          <button @click="applyModelPreset('flagship')" style="padding:5px 10px;font-size:12px;border:1px solid #ff9800;border-radius:4px;background:#fff3e0;cursor:pointer;">👑 旗舰模式</button>
        </div>

        <label>📝 资料生成模型（generation/blueprint）</label>
        <select v-model="settings.deepseekGenerationModel">
          <option v-for="m in deepseekModelOptions" :key="'dsg_' + m" :value="m">{{ formatDeepSeekModel(m) }}</option>
        </select>
        <label>📋 教材分析模型（analysis/extraction · 决策性步骤）</label>
        <select v-model="settings.deepseekAnalysisModel">
          <option v-for="m in deepseekModelOptions" :key="'dsa_' + m" :value="m">{{ formatDeepSeekModel(m) }}</option>
        </select>
      </div>

      <!-- 🔥 火山引擎（豆包）配置 -->
      <div v-if="settings.currentEngine === 'volcano'" class="settings-section">
        <h3>🔥 火山引擎（豆包）</h3>
        <p style="font-size:12px;color:#666;margin-bottom:4px;">
          💰 每日免费200万Token · 无峰谷定价 · 国产中文能力第一 · 深度思考已强制关闭（省时省钱）
        </p>
        <p class="model-hint">👍 免费额度大：小量试用/白嫖首选，超额度后 doubao-seed-2-1-turbo 约 ¥3/百万输入</p>
        <label>API Key</label>
        <input type="password" v-model="settings.volcanoApiKey" placeholder="火山引擎 API Key" />
        <input type="text" v-model="settings.volcanoBaseUrl" placeholder="https://ark.cn-beijing.volces.com/api/v3" />
        <label>📝 资料生成模型</label>
        <input type="text" v-model="settings.volcanoGenerationModel" placeholder="doubao-seed-2-1-turbo-260628" />
        <label>📋 教材分析模型</label>
        <input type="text" v-model="settings.volcanoAnalysisModel" placeholder="doubao-seed-2-1-pro-260628" />
      </div>

      <!-- ☁️ 阿里百炼（通义千问）配置 -->
      <div v-if="settings.currentEngine === 'alibaba'" class="settings-section">
        <h3>☁️ 阿里百炼（通义千问）</h3>
        <p style="font-size:12px;color:#666;margin-bottom:4px;">
          💰 费用中：qwen3.8-27b ¥3/百万输入·¥12/百万输出（生成性价比） · qwen3.8-max ¥12/百万输入·¥36/百万输出（中文综合第一）
        </p>
        <p class="model-hint">👍 中档选择：生成用 27b 性价比好、分析用 max 质量高 · 新用户送7000万Token · 推理已默认关闭</p>
        <label>API Key</label>
        <input type="password" v-model="settings.alibabaApiKey" placeholder="sk-..." />
        <input type="text" v-model="settings.alibabaBaseUrl" placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1" />
        <label>📝 资料生成模型</label>
        <input type="text" v-model="settings.alibabaGenerationModel" placeholder="qwen3.8-27b" />
        <label>📋 教材分析模型</label>
        <input type="text" v-model="settings.alibabaAnalysisModel" placeholder="qwen3.8-max" />
      </div>

      <!-- 🧠 智谱 GLM 配置 -->
      <div v-if="settings.currentEngine === 'zhipu'" class="settings-section">
        <h3>🧠 智谱 GLM</h3>
        <p style="font-size:12px;color:#666;margin-bottom:4px;">
          💰 费用高：glm-5.3 最新旗舰（2026-08）· 输入¥8/百万 · 输出¥28/百万 · ⚠️ 强制开启推理（不可关闭，成本较高）
        </p>
        <p class="model-hint">⚠️ 性价比最低：强制推理 token 按输出价计费，仅当需要顶级质量且不在乎成本时选用</p>
        <label>API Key</label>
        <input type="password" v-model="settings.zhipuApiKey" placeholder="智谱 API Key" />
        <input type="text" v-model="settings.zhipuBaseUrl" placeholder="https://open.bigmodel.cn/api/paas/v4" />
        <label>📝 资料生成模型</label>
        <input type="text" v-model="settings.zhipuGenerationModel" placeholder="glm-5.3" />
        <label>📋 教材分析模型</label>
        <input type="text" v-model="settings.zhipuAnalysisModel" placeholder="glm-5.3" />
      </div>

      <!-- 📖 API 申请指南 -->
      <div class="settings-section">
        <h3>📖 API 申请指南 <button class="btn-small" @click="showGuide = !showGuide" style="margin-left:8px;">{{ showGuide ? '收起' : '展开' }}</button></h3>
        <div v-if="showGuide" class="api-guide">
          <div class="guide-item">
            <strong>🔥 火山引擎（豆包）</strong>
            <p>1. 访问 <a href="https://console.volcengine.com/ark" target="_blank">火山引擎 Ark 控制台</a></p>
            <p>2. 注册/登录 → 开通模型推理服务 → 创建 API Key</p>
            <p>3. 在"推理接入点"创建 endpoint，选择 doubao-seed-2-1 系列模型</p>
            <p>4. 每日免费 200万 Token，自动刷新</p>
          </div>
          <div class="guide-item">
            <strong>☁️ 阿里百炼（通义千问）</strong>
            <p>1. 访问 <a href="https://bailian.console.aliyun.com" target="_blank">阿里百炼控制台</a></p>
            <p>2. 注册/登录 → 开通百炼服务 → 创建 API Key</p>
            <p>3. 新用户送 7000万 Token，qwen3.8-27b 生成性价比高（¥3/百万输入）</p>
          </div>
          <div class="guide-item">
            <strong>🧠 智谱 GLM</strong>
            <p>1. 访问 <a href="https://open.bigmodel.cn" target="_blank">智谱开放平台</a></p>
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
          <option :value="false">跳过（仅提取文字）</option>
          <option :value="true">分析（用 AI 描述图表）</option>
        </select>
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

        <!-- 整卷正文温度（一次生成整卷，创作性略高） -->
        <datalist id="ticks-1_5"><option value="0"></option><option value="0.5"></option><option value="1.0"></option><option value="1.5"></option></datalist>
        <div style="margin-bottom:14px;">
          <label style="display:flex;justify-content:space-between;">
            <span>📄 整卷正文生成</span>
          </label>
          <div style="display:flex;align-items:center;gap:6px;">
            <span style="font-size:10px;color:#999;min-width:14px;">0</span>
            <div style="position:relative;flex:1;">
              <span :style="{ position:'absolute', left: `calc(${((settings.generationSettings.paperTemperature ?? 0.7) / 1.5 * 100).toFixed(1)}% + 6px - ${((settings.generationSettings.paperTemperature ?? 0.7) / 1.5 * 10).toFixed(0)}px)`, top: '-20px', transform: 'translateX(-50%)', background: 'var(--primary,#4a90d9)', color: '#fff', fontSize: '11px', fontWeight: '600', padding: '1px 6px', borderRadius: '8px', whiteSpace: 'nowrap', pointerEvents: 'none' }">{{ (settings.generationSettings.paperTemperature ?? 0.7).toFixed(1) }}</span>
              <input type="range" v-model.number="settings.generationSettings.paperTemperature" min="0" max="1.5" step="0.1" list="ticks-1_5" style="width:100%;" />
            </div>
            <span style="font-size:10px;color:#999;min-width:22px;">1.5</span>
          </div>
          <p style="font-size:11px;color:#888;margin:2px 0 0;">整卷一次生成（正文）——需创作性：情境、题目、卷面，略高</p>
        </div>

        <!-- 答案页温度（阅卷专家视角，低温严谨；一次成型模式下答案与正文共用整卷正文温度，此滑块仅两次生成生效） -->
        <div style="margin-bottom:14px;" :style="(settings.generationSettings.paperGenerateMode ?? 'split') === 'once' ? { opacity: 0.5 } : {}">
          <label style="display:flex;justify-content:space-between;">
            <span>✅ 答案页生成</span>
            <span v-if="(settings.generationSettings.paperGenerateMode ?? 'split') === 'once'" style="font-size:10px;color:#999;font-weight:400;">一次成型下不生效</span>
          </label>
          <div style="display:flex;align-items:center;gap:6px;">
            <span style="font-size:10px;color:#999;min-width:14px;">0</span>
            <div style="position:relative;flex:1;">
              <span :style="{ position:'absolute', left: `calc(${((settings.generationSettings.answerTemperature ?? 0.3) / 1.0 * 100).toFixed(1)}% + 6px - ${((settings.generationSettings.answerTemperature ?? 0.3) / 1.0 * 10).toFixed(0)}px)`, top: '-20px', transform: 'translateX(-50%)', background: 'var(--primary,#4a90d9)', color: '#fff', fontSize: '11px', fontWeight: '600', padding: '1px 6px', borderRadius: '8px', whiteSpace: 'nowrap', pointerEvents: 'none' }">{{ (settings.generationSettings.answerTemperature ?? 0.3).toFixed(1) }}</span>
              <input type="range" v-model.number="settings.generationSettings.answerTemperature" min="0" max="1.0" step="0.1" list="ticks-1_0" style="width:100%;" :disabled="(settings.generationSettings.paperGenerateMode ?? 'split') === 'once'" />
            </div>
            <span style="font-size:10px;color:#999;min-width:22px;">1.0</span>
          </div>
          <p style="font-size:11px;color:#888;margin:2px 0 0;">参考答案与评分标准——阅卷专家视角，低温确保严谨准确<span v-if="(settings.generationSettings.paperGenerateMode ?? 'split') === 'once'">（一次成型下答案与正文共用"整卷正文生成"温度，此滑块仅"两次生成"生效）</span></p>
        </div>

        <!-- DeepSeek 深度思考开关（仅整卷生成生效） -->
        <div style="margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;background:#fffbe6;border:1px solid #ffe58f;border-radius:8px;padding:8px 12px;">
          <div style="flex:1;margin-right:10px;">
            <div style="font-size:12px;font-weight:600;color:#333;">🧠 整卷生成启用深度思考（DeepSeek）</div>
            <div style="font-size:11px;color:#888;margin-top:2px;line-height:1.5;">开启后整卷生成前先推理再作答，可提升生成质量；推理 token 按输出价计费、耗时更长。<br/>仅影响整卷生成——分析/审查/格式化/验算始终关闭思考。</div>
          </div>
          <label style="position:relative;display:inline-block;width:40px;height:22px;flex-shrink:0;cursor:pointer;">
            <input type="checkbox" v-model="settings.generationSettings.deepseekGenerationThinking" style="opacity:0;width:0;height:0;" />
            <span :style="{position:'absolute',top:'0',left:'0',right:'0',bottom:'0',borderRadius:'22px',transition:'0.3s',background:settings.generationSettings.deepseekGenerationThinking ? '#4a90d9' : '#ccc'}"></span>
            <span :style="{position:'absolute',top:'2px',left:settings.generationSettings.deepseekGenerationThinking ? '20px' : '2px',width:'18px',height:'18px',borderRadius:'50%',background:'#fff',transition:'0.3s'}"></span>
          </label>
        </div>

        <!-- 整卷生成方式：两次生成 / 一次成型 -->
        <div style="margin-bottom:14px;background:#f0f7ff;border:1px solid #b3d4f5;border-radius:8px;padding:8px 12px;">
          <div style="font-size:12px;font-weight:600;color:#333;margin-bottom:6px;">📜 整卷生成方式</div>
          <div style="display:flex;gap:8px;margin-bottom:4px;">
            <label style="display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:14px;cursor:pointer;font-size:12px;font-weight:500;border:1px solid #4a90d9;color:#4a90d9;background:#fff;" :style="(settings.generationSettings.paperGenerateMode ?? 'split') === 'split' ? { background:'#4a90d9', color:'#fff' } : {}">
              <input type="radio" v-model="settings.generationSettings.paperGenerateMode" value="split" hidden />
              两次生成
            </label>
            <label style="display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:14px;cursor:pointer;font-size:12px;font-weight:500;border:1px solid #4a90d9;color:#4a90d9;background:#fff;" :style="(settings.generationSettings.paperGenerateMode ?? 'split') === 'once' ? { background:'#4a90d9', color:'#fff' } : {}">
              <input type="radio" v-model="settings.generationSettings.paperGenerateMode" value="once" hidden />
              一次成型
            </label>
          </div>
          <div style="font-size:11px;color:#888;line-height:1.5;">
            两次生成：正文一次 + 答案页独立一次（答案用阅卷专家角色 + 低温严谨，推荐）；<br/>
            一次成型：正文与答案一次输出（上下文全程一致；答案部分与正文共用"整卷正文生成"温度，模型漏输出答案时自动补一次独立答案页）。
          </div>
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
              <td style="padding:3px 4px;font-weight:600;white-space:nowrap;">📄 整卷正文生成</td>
              <td style="padding:3px 4px;"><b>0.5–0.8</b> 情境/题目/卷面创作性 · <b>1.0+</b> 高创意</td>
            </tr>
            <tr>
              <td style="padding:3px 4px;font-weight:600;white-space:nowrap;">✅ 答案页生成</td>
              <td style="padding:3px 4px;"><b>0–0.3</b> 阅卷严谨准确 · <b>0.5+</b> 可能发散，不推荐</td>
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
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { Capacitor } from '@capacitor/core';
import { useActivation } from '@/composables/useActivation.js';
import { useDialog } from '@/composables/useDialog.js';
import { useBackup } from '@/composables/useBackup.js';
import { useWebAuth, clearWebAuth } from '@/composables/useWebAuth.js';
import useLogger, { copyLogs } from '@/composables/useLogger.js';
import { apiConfig, getAvailableModels, refreshConfigCache, saveConfig, decrypt, autoDiscoverDeepSeekModel } from '@/config/apiConfig.js';
import { cancelAllRequests } from '@/utils/requestManager.js';
import { getSyncKey, setSyncKey, getDeviceName, setDeviceName, probeCloud, fetchCloudDevices, deleteDeviceFromCloud } from '@/utils/cloudStorage';
import { getSignCountdown, resetInstallTime, formatDaysRemaining } from '@/utils/signatureCheck';

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
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: `✅ 已移除「${dev.label}」的云端数据`, type: 'info' } }));
    } else {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: '⚠️ 移除失败，请稍后重试', type: 'warning' } }));
    }
  } catch (e) {
    console.warn('移除设备失败:', e);
    window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: '❌ 移除异常，请稍后重试', type: 'warning' } }));
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
  storagePath: localStorage.getItem('storagePath') || '智卷工坊数据',
  generationSettings: { ...apiConfig.generationSettings }
});

const availableTextModels = ref(['qwen2.5:7b', 'qwen2:7b']);

// 🔧 DeepSeek 模型选项（优先云端发现，兜底常用列表）
const deepseekModelOptions = ref(['deepseek-v4-flash', 'deepseek-v4-pro']);

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
      localStorage.setItem('storagePath', selectedPath);
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
    qualityEstimate += '\n\n📊 质量预估：云端高质量（DeepSeek V4）';
    qualityEstimate += '\n💰 费用参考：输入¥1.01/百万 · 输出¥2.02/百万 · 缓存命中¥0.02/百万';
    qualityEstimate += '\n👍 性价比最优：生成用 Flash、分析用 Pro · 推理已默认关闭';
  } else if (settings.value.currentEngine === 'volcano') {
    qualityEstimate += '\n\n📊 质量预估：云端高质量（豆包 Seed）';
    qualityEstimate += '\n💰 每日免费200万Token · 超出后¥0.1/百万起';
    qualityEstimate += '\n👍 免费额度大：小量试用首选 · 深度思考已强制关闭';
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
