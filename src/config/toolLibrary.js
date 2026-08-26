/**
 * 工具库 · 统一注册表与三维度口径
 * ============================================================
 * 🔴 定位：全系统"库"的唯一事实源（single source of truth）。
 *   - 三维度口径（学段 × 学科 × 资料类型）在此定义一次，所有库的检索键对齐此口径；
 *   - 8 个子库的元数据（id/名称/图标/职责/状态）在此注册，供工具库首页与子页容器读取；
 *   - 迁移状态：migrating=壳内暂挂旧模块 · ready=已迁移为新形态 · empty=待迁移。
 * ============================================================
 */

import { EXAM_BLUEPRINTS } from './examPaperBlueprints.js';
import { listAllBlueprints } from './blueprintProvider.js';
import { TEACHING_SUBJECT_BLUEPRINTS, TEACHING_GEN_TYPES } from './teachingBlueprints.js';
import { BUILTIN_TEMPLATES } from './promptLibrary.js';
import { listValidatorRules } from './validatorRules.js';
import { GRAPH_TYPES } from './eduRenderContract.js';

/** 学段维度（年级 → 学段的映射由教材元数据提供） */
export const STAGE_KEYS = ['primary_low', 'primary_mid', 'primary_high', 'middle', 'high'];

/** 学科维度（全系统学科全集） */
export const SUBJECT_KEYS = [
  '语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理',
  '道德与法治', '思想政治', '科学', '信息科技', '音乐', '美术', '体育',
];

/** 资料类型维度 */
export const GEN_TYPE_KEYS = [
  'exam', 'practice', 'special', 'preview', 'reading',
  'summary', 'dictation', 'errorbook', 'review',
];

/** 通配符（降级匹配用：无专属条目时逐级回退） */
export const WILDCARD = '*';

/** 三维度口径统一对象 */
export const DIMENSIONS = {
  stage: STAGE_KEYS,
  subject: SUBJECT_KEYS,
  genType: GEN_TYPE_KEYS,
  wildcard: WILDCARD,
};

/**
 * 工具库注册表：8 个子库
 * status: ok=正常 · warn=有缺口 · new=新增
 * migrate: migrating=壳内暂挂旧模块（迁移中） · ready=已迁移 · empty=待迁移
 *
 * toolbar（子页工具栏·可变区注册）:
 *   actions: 操作按钮集（'new'=新建条目 / 'import'=导入 / 'validate'=校验 / 'clear'=清理）
 *   filter:  筛选器类型（'dim3'=三维度(学段×学科×类型) / 'none'=无筛选）
 *   固定区（返回按钮+面包屑）对所有子库一致，不在此注册。
 *   ⚠️ 迁移壳库（migrating）filter 暂为 'none'：旧模块内部自带同构筛选，为避免两套并存，
 *      顶部筛选在各自迁移完成时切换为 'dim3'（迁移即联动）。
 *
 * 子库迁移硬性规范基线（蓝图库已验证，其他子库迁移必须一次做到，勿重复返工）：
 *   1. 手风琴：点击条目名展开，其他收起，再点收起（不平铺）
 *   2. 概览条吸顶（sticky）：库徽章+统计(当前/总数)+待修数+检索键+新增按钮
 *   3. 库标记：每条卡片头带库徽章，防界面相似弄混
 *   4. 全中文三维度名：学段·学科·资料类型+库标记；数据键小字 title 提示
 *   5. 增删改存：编辑/保存/删除/重置/新增，用户自定义持久化且生成端优先（读取闭环）
 *   6. 校验+待修问题清单：接入对应 guard + 迁移审计问题可视化
 *   7. 三维度筛选精准联动（学科/学段/类型各自+组合）+ 动态计数分母
 *   8. 三维度口径统一：STAGE_KEYS×SUBJECT_KEYS×GEN_TYPE_KEYS+通配*（本文件唯一源）
 */
export const TOOL_LIBRARIES = [
  {
    id: 'blueprint',
    name: '蓝图库',
    icon: '📐',
    desc: '卷面/教辅骨架：大题、分值、载体、内容范围（课标条款由指令库承载）',
    count: '真题蓝本 · 教辅结构（条数动态统计）',
    status: 'ok',
    migrate: 'ready',
    toolbar: { actions: ['new', 'validate'], filter: 'dim3' },
  },
  {
    id: 'instruction',
    name: '指令库',
    icon: '📝',
    desc: '创作要求与模板：角色、创作要求、学科×学段要点、学段特点、输出格式、质量底线',
    count: '三维度 cell（学段×学科×类型，动态统计）',
    status: 'ok',
    migrate: 'ready',
    toolbar: { actions: ['new'], filter: 'dim3' },
  },
  {
    id: 'rules',
    name: '生成端规则库',
    icon: '🧪',
    desc: '确定性门：分值账目、载体一致、配对、覆盖度、学段底线',
    count: '规则（动态统计）',
    status: 'ok',
    migrate: 'ready',
    toolbar: { actions: ['new'], filter: 'dim3' },
  },
  {
    id: 'render-contract',
    name: '渲染契约库',
    icon: '🎨',
    desc: '[GRAPH]/[IMAGE]/公式 标记协议（EduRender 格式）',
    count: '9 图形 TYPE',
    status: 'warn',
    migrate: 'ready',
    toolbar: { actions: [], filter: 'dim3' },
  },
  {
    id: 'layout-spec',
    name: '排版规格库',
    icon: '📏',
    desc: '学段渲染参数：作文格宽、空白区系数、行高、方格纸规格',
    count: '学段参数',
    status: 'new',
    migrate: 'empty',
    toolbar: { actions: ['new'], filter: 'none' },
  },
];

/** 按 id 取库元数据 */
export const getToolLibrary = (id) => TOOL_LIBRARIES.find((lib) => lib.id === id) || null;

/** 按检索键校验维度合法性（迁移/新增条目时用） */
export const isValidDimension = ({ stage, subject, genType } = {}) => {
  const ok = (v, list) => !v || v === WILDCARD || list.includes(v);
  return ok(stage, STAGE_KEYS) && ok(subject, SUBJECT_KEYS) && ok(genType, GEN_TYPE_KEYS);
};

/**
 * 各库条数统计（统一口径：都按【条数】计，分子/分母由真实数据源自动算，不硬编码）
 *   - 蓝图库  真题蓝本：当前条数 / 内置蓝本键总数
 *             教辅结构：当前学科×类型条数 / 理论条数（15科×8类）
 *   - 指令库  三维度 cell：当前 cell 数（学段×学科×类型，含实际开设组合）
 *   - 规则库  规则条数
 *   - 渲染契约 图形 TYPE 条数
 * 返回 { [libId]: '分子/分母 单位' }，随增删改实时更新（首页 chip 与子页概览共用）。
 */
export function computeLibStats() {
  const bps = listAllBlueprints();
  const builtinKeys = Object.keys(EXAM_BLUEPRINTS);
  const teachingTotal = Object.values(TEACHING_SUBJECT_BLUEPRINTS)
    .reduce((n, types) => n + Object.keys(types).filter((k) => k !== 'stages').length, 0);
  const cellKeys = Object.keys(BUILTIN_TEMPLATES).filter((k) => k.includes('|'));
  return {
    blueprint: `真题蓝本 ${bps.length}/${builtinKeys.length} 条 · 教辅结构 ${teachingTotal}/${SUBJECT_KEYS.length * TEACHING_GEN_TYPES.length} 条`,
    instruction: `${cellKeys.length} 三维度 cell`,
    rules: `规则 ${listValidatorRules().length} 条`,
    'render-contract': `图形 TYPE ${GRAPH_TYPES.length}`,
  };
}

export default { STAGE_KEYS, SUBJECT_KEYS, GEN_TYPE_KEYS, WILDCARD, DIMENSIONS, TOOL_LIBRARIES, getToolLibrary, isValidDimension, computeLibStats };
