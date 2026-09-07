/**
 * 生成会话编排器（复位工程·阶段 1 基建）
 * ============================================================
 * 定位：对话式多轮流程（研读 → 受委托 → 成稿交付）的纯逻辑核心，可单测、不依赖引擎。
 * 角色合一说（2026-09-07）：编辑者与模型双角色合一——模型以编辑身份接手委托并完成稿件；
 *   程序是编辑的助手（供料/换算/留档），不是验收方。全链无"验收/打分"角色；
 *   仅保留不可见的事故级护栏与编辑交稿前自校（覆盖自查在委托书内由编辑本人执行）。
 * 准绳依据：docs/design/三线生成架构-设计准绳.md「委托↔素材衔接：对话式多轮流程」
 *   · 铁律：全流程零注入、只有消息追加；程序只做两件事——按状态机推进对话、超长时压缩且替换。
 *   · 无截断语义：上限管分批、不管切料；生成输出预算宁余勿缺，绝不静默截断。
 *   · 素材线：研读单批上限=分批阈值（超即拆批不切尾）；browse 仅限覆盖范围内锚；练习段不返回。
 * ============================================================
 */

/** 会话阶段（对话推进状态机）。need_material=材料不全，编辑向资料库补料后继续研读。 */
export const STAGES = ['idle', 'studying', 'ready', 'writing', 'delivered', 'need_material'];

/** 合法迁移表：当前阶段 → 可达阶段集合。 */
const TRANSITIONS = {
  idle: ['studying'],
  studying: ['studying', 'ready', 'need_material'],
  need_material: ['studying'],
  ready: ['writing', 'studying'],
  writing: ['delivered', 'studying'],
  delivered: [],
};

/** 消息类型：user=追加的用户消息（研读批/委托书）；tool=工具返回（browse）；assistant=模型消息；summary=压缩摘要（替换物）。 */
export const MESSAGE_KINDS = ['user', 'tool', 'assistant', 'summary'];

const DEFAULT_COMPRESS_THRESHOLD_CHARS = 48000;

let seq = 0;
const nextId = () => `msg_${++seq}_${Date.now().toString(36)}`;

/**
 * 创建生成会话。
 * @param {object} options
 * @param {object} [options.meta] 会话元信息（范围/类型/引擎等，由调用方传入，本模块不构造）
 * @param {number} [options.compressThresholdChars] 历史字符数触发压缩阈值
 */
export function createGenerationSession(options = {}) {
  return {
    stage: 'idle',
    messages: [],
    meta: options.meta || {},
    compressThresholdChars: options.compressThresholdChars || DEFAULT_COMPRESS_THRESHOLD_CHARS,
    rounds: 0,
    browseRounds: 0,
  };
}

function assertKind(kind) {
  if (!MESSAGE_KINDS.includes(kind)) throw new Error(`非法消息类型：${kind}`);
}

/**
 * 追加一条消息（铁律：纯追加，不构造"最小上下文"、不复制前轮内容）。
 * @param {object} session
 * @param {object} msg {role:'user'|'tool'|'assistant', content:string, kind?:string, compressible?:boolean}
 * @returns {object} 追加后的消息
 */
export function appendMessage(session, msg) {
  const kind = msg.kind || msg.role;
  assertKind(kind);
  const entry = {
    id: nextId(),
    role: msg.role,
    kind,
    content: String(msg.content ?? ''),
    compressible: Boolean(msg.compressible),
  };
  if (msg.toolCallId) entry.toolCallId = msg.toolCallId;
  session.messages.push(entry);
  session.rounds += 1;
  return entry;
}

/**
 * 状态迁移（带校验）。非法迁移不执行并返回原因。
 * @returns {{ok:boolean, error?:string}}
 */
export function requestTransition(session, nextStage) {
  if (!STAGES.includes(nextStage)) return { ok: false, error: `未知阶段：${nextStage}` };
  const allowed = TRANSITIONS[session.stage] || [];
  if (!allowed.includes(nextStage)) {
    return { ok: false, error: `非法迁移：${session.stage} → ${nextStage}` };
  }
  session.stage = nextStage;
  return { ok: true };
}

/**
 * 超长历史压缩：把一组可压缩消息替换为一条摘要消息（替换，绝不叠加）。
 * 约束：被替换消息必须全部标记 compressible；摘要追加在替换位；会话至少保留首条消息（不整段清空）。
 * @param {object} session
 * @param {object} param1
 * @param {string} param1.summary 摘要正文（由调用方调用模型产出；本模块只负责替换纪律）
 * @param {string[]} param1.replacedIds 待替换消息 id 列表
 * @returns {{ok:boolean, error?:string}}
 */
export function applyCompaction(session, { summary, replacedIds }) {
  if (!Array.isArray(replacedIds) || replacedIds.length === 0) {
    return { ok: false, error: '压缩替换集为空' };
  }
  const idSet = new Set(replacedIds);
  const targets = session.messages.filter((m) => idSet.has(m.id));
  if (targets.length !== replacedIds.length) {
    return { ok: false, error: '部分待替换消息不存在' };
  }
  if (targets.some((m) => !m.compressible)) {
    return { ok: false, error: '待替换消息含不可压缩项（委托书/系统约束不可被压缩替换）' };
  }
  if (session.messages.every((m) => idSet.has(m.id))) {
    return { ok: false, error: '不允许压缩替换全部消息（至少保留会话锚）' };
  }
  const firstIdx = session.messages.findIndex((m) => idSet.has(m.id));
  session.messages.splice(
    firstIdx,
    targets.length,
    { id: nextId(), role: 'user', kind: 'summary', content: String(summary ?? ''), compressible: false },
  );
  return { ok: true };
}

/** 当前历史字符量（估算用，近似注意力占用）。 */
export function historyChars(session) {
  return session.messages.reduce((s, m) => s + (m.content || '').length, 0);
}

/**
 * 研读分批（无截断语义：上限管分批、不管切料）。
 * 单位（unit）代表一个研读单元（如一个覆盖锚或一章）；单位超上限时单独成批并标记 oversize，
 * 绝不切段——超限单位由调用方决定拆为更细单元或提示分批。
 * @param {Array<{id:string,label:string,chars:number}>} units
 * @param {number} [maxCharsPerBatch]
 * @returns {{batches:Array<{unitIds:string[], chars:number}>, oversize:string[]}}
 */
export function planStudyBatches(units, maxCharsPerBatch = 2500) {
  const batches = [];
  const oversize = [];
  let cur = [];
  let curChars = 0;
  const push = () => {
    if (!cur.length) return;
    batches.push({ unitIds: [...cur], chars: curChars });
    cur = [];
    curChars = 0;
  };
  for (const u of units) {
    const chars = Number(u.chars) || 0;
    if (chars > maxCharsPerBatch) {
      push();
      oversize.push(u.id);
      batches.push({ unitIds: [u.id], chars }); // 整段单独成批，不切料
      continue;
    }
    if (curChars + chars > maxCharsPerBatch) push();
    cur.push(u.id);
    curChars += chars;
  }
  push();
  return { batches, oversize };
}

/**
 * 生成输出预算：完整性硬约束（宁余勿缺、绝不静默截断）。
 * @param {object} p {neededTokens:number, engineCapTokens:number, safetyBuffer?:number}
 * @returns {{requested:number, clamped:number, overEngine:boolean, action:'ok'|'need_prompt'}}
 */
export function planOutputBudget(p) {
  const needed = Math.max(0, Number(p.neededTokens) || 0);
  const cap = Number(p.engineCapTokens) || Infinity;
  const buffer = p.safetyBuffer || 1.25;
  const requested = Math.ceil(needed * buffer);
  const overEngine = needed > cap;
  return {
    requested,
    clamped: Math.min(requested, cap),
    overEngine,
    action: overEngine ? 'need_prompt' : 'ok', // 超引擎上限→显式提示换引擎/确认，绝不静默截断
  };
}

/**
 * browse 目标白名单校验（素材线：仅限本次覆盖范围内锚；练习段不返回）。
 * @param {object} session
 * @param {string} targetAnchor 模型请求的目标（锚名/章名）
 * @param {Set<string>|string[]} allowedSet 本次覆盖范围内的合法目标集合
 * @returns {{ok:boolean, reason?:string}}
 */
export function guardBrowseTarget(session, targetAnchor, allowedSet) {
  void session;
  const set = allowedSet instanceof Set ? allowedSet : new Set(allowedSet || []);
  const key = String(targetAnchor || '').trim();
  if (!key) return { ok: false, reason: '空目标' };
  if (!set.has(key)) return { ok: false, reason: `越界目标（不在本次覆盖范围内）：${key}` };
  return { ok: true };
}

/**
 * 段类型是否可作研读/browse 返回（练习/作业型成品题段不返回）。
 * 类型取值由 Step1 段类型枚举约束；未知类型一律拒绝（宁可缺料诊断，不可误放成品题）。
 */
export function isReturnableSegment(type) {
  const t = String(type || '').trim();
  if (!t) return false;
  return !['练习', '作业', '习题', 'practice', 'exercise'].includes(t);
}

/**
 * 研读轮次成本估算（费用旋钮：批数×批字符量；系数档由调用方决定批大小）。
 * @returns {{batches:number, totalChars:number, costIndex:number}}
 */
export function estimateStudyCost(units, maxCharsPerBatch = 2500) {
  const { batches, oversize } = planStudyBatches(units, maxCharsPerBatch);
  const totalChars = batches.reduce((s, b) => s + b.chars, 0);
  return { batches: batches.length, totalChars, oversize, costIndex: batches.length };
}
