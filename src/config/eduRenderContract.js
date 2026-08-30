/**
 * EduRender 渲染指令契约（生成端注入版）
 * ============================================================
 * 🔴 定位：把 EduRender Studio 的完整指令格式整合进生成链路，
 *    让生成模型输出的 [GRAPH]/[IMAGE]/公式标记可被 EduRender Studio 直接渲染。
 *    - [GRAPH]...[/GRAPH]  图形（数轴/函数/几何/统计/受力/电路/光路/原子）
 *    - [IMAGE]...[/IMAGE]  配图（画面描述 / ICON 图标检索）
 *    - $...$ / $$...$$     公式（行内 / 块级）
 * 按 学科×学段×资料类型 三维度匹配注入（需要图的学科才给 [GRAPH] 骨架、
 * 配图题才给 [IMAGE]、数理化学科才给公式）。
 * ============================================================
 */

import { isLibEntryEnabled } from '../utils/libToggles.js';

/** 允许的 [GRAPH] TYPE 全集 */
export const GRAPH_TYPES = [
  'COORDINATE', 'SHAPES', 'BAR_CHART', 'LINE_CHART', 'PIE_CHART',
  'FORCE', 'CIRCUIT', 'OPTICS', 'ATOM',
];

/** 需要 $公式$ 的学科 */
export const MATH_SUBJECTS = ['数学', '物理', '化学'];

/** 配图类题型（看图写话/看图列式/听音选图等）关键词 */
const IMAGE_HINT_RE = /看图|写话|配图|听音|观察|绘画|绘图|识图|读图|示意|地图|图表|结构/;

/**
 * 教辅类默认配图的类型（课时练/专项/预习/阅读/默写普遍要求图文并茂/情境配图，
 * 与题型关键词无关——即使单元名不含"看图"也应注入 [IMAGE] 契约，否则 AI 配图无格式规范）
 */
const IMAGE_DEFAULT_TYPES = new Set(['practice', 'special', 'preview', 'reading', 'dictation']);

// ==================== EduRender Studio 完整格式骨架 ====================

/** [IMAGE] 示例（画面描述 + ICON 图标检索；不指定生图引擎，渲染端按其标准处理） */
const IMAGE_SAMPLE = `[IMAGE]
PROMPT:画面描述（主体/动作/场景，图内不出现文字）
[/IMAGE]`;

const IMAGE_SAMPLE_ICON = `[IMAGE]
TYPE:ICON
KEYWORDS:熊猫,竹子,卡通
STYLE:flat
[/IMAGE]`;

/** [GRAPH] 各 TYPE 骨架示例（与 EduRender Studio 文档逐项对齐） */
const GRAPH_SAMPLE_COORDINATE = `[GRAPH]
TYPE:COORDINATE
XLIM:-6,6
YLIM:-1,1
GRID:FALSE
NUMBER_POSITION:top
TICK_DIRECTION:up
LEFT_ARROW:false
RIGHT_ARROW:true
AXIS_COLOR:black
LINE_WIDTH:2
TICK_LENGTH:6
FONT_SIZE:10
TICK_STEP:1
ARROW_STYLE:>
ARROW_SCALE:1.0
PADDING:0.15
[/GRAPH]`;

const GRAPH_SAMPLE_SHAPES = `[GRAPH]
TYPE:SHAPES
XLIM:-3,5
YLIM:-5,6
GRID:TRUE
TITLE:二次函数图像
SHAPES:
  FUNCTION:x**2 - 2*x - 3 | COLOR:blue | DOMAIN:-3,5
  POINT:(1,-4) | LABEL:顶点 | COLOR:red | SIZE:8
[/GRAPH]`;

/** 小学版 SHAPES 示例（六年级"圆"；🔴 无函数——小学课标无函数内容，示例即诱导源，必须学段化） */
const GRAPH_SAMPLE_SHAPES_PRIMARY = `[GRAPH]
TYPE:SHAPES
XLIM:-6,6
YLIM:-6,6
GRID:TRUE
TITLE:圆
SHAPES:
  CIRCLE:(0,0) | RADIUS:3 | COLOR:blue
  LINE:(-3,0),(3,0) | LABEL:直径 | COLOR:red
  LINE:(0,-3),(0,3) | LABEL:半径 | COLOR:green
[/GRAPH]`;

const GRAPH_SAMPLE_SHAPES_EXTRA = `· SHAPES 元素格式（一行一个元素、属性用 | 分隔）：
  POINT:(x,y) | LABEL:标签 | COLOR:颜色 | SIZE:大小
  FUNCTION:表达式 | COLOR:颜色 | DOMAIN:min,max
  POLYGON:(x1,y1),(x2,y2),(x3,y3) | LABELS:A,B,C | COLOR:颜色
  CIRCLE:(x,y) | RADIUS:半径 | COLOR:颜色
  LINE:(x1,y1),(x2,y2) | COLOR:颜色 | WIDTH:线宽 | DASH:true/false
  ANGLE:(x1,y1),(顶点x,y),(x2,y2) | LABEL:角度 | COLOR:颜色
· 颜色可选：red/blue/green/black/yellow/orange/purple/pink/brown/gray`;

const GRAPH_SAMPLE_BAR = `[GRAPH]
TYPE:BAR_CHART
DATA:15,22,18,30,25
LABELS:类别甲,类别乙,类别丙,类别丁,类别戊
TITLE:某班数据分布
XLABEL:类别
YLABEL:数量
COLORS:#e74c3c,#3498db,#27ae60,#f1c40f,#9b59b6
[/GRAPH]`;

const GRAPH_SAMPLE_CHART_LINE = `[GRAPH]
TYPE:LINE_CHART
DATA:5,12,8,20,15
LABELS:第1期,第2期,第3期,第4期,第5期
TITLE:数据变化
XLABEL:时间
YLABEL:数值
[/GRAPH]`;

const GRAPH_SAMPLE_PIE = `[GRAPH]
TYPE:PIE_CHART
DATA:30,25,20,15,10
LABELS:类别甲,类别乙,类别丙,类别丁,类别戊
TITLE:占比分布
[/GRAPH]`;

const GRAPH_SAMPLE_FORCE = `[GRAPH]
TYPE:FORCE
OBJECT:rectangle,0,0,4,2
FORCES:
  G:down,center,10
  N:up,center,10
  F:right,center,15
  f:left,center,5
LABELS:true
[/GRAPH]`;

const GRAPH_SAMPLE_CIRCUIT = `[GRAPH]
TYPE:CIRCUIT
COMPONENTS:
  battery,0,0,right
  switch,2,0,right
  bulb,4,0,right
  resistor,4,-2,up
WIRES:0,0-2,0;2,0-4,0;4,0-4,-2;4,-2-0,-2;0,-2-0,0
[/GRAPH]`;

const GRAPH_SAMPLE_OPTICS = `[GRAPH]
TYPE:OPTICS
MIRROR:plane,0,-2,0,2
INCIDENT:2,1,0,0
ANGLE:30
[/GRAPH]`;

const GRAPH_SAMPLE_ATOM = `[GRAPH]
TYPE:ATOM
ELEMENT:Na
SHELLS:2,8,1
[/GRAPH]`;

/** 学科 → [GRAPH] 注入内容（键为段落标识） */
const SUBJECT_GRAPH_PARTS = {
  '数学': [
    '· 数轴用 TYPE:COORDINATE（参数：NUMBER_POSITION:top/bottom 数字位置、TICK_DIRECTION:up/down 刻度方向、LEFT_ARROW/RIGHT_ARROW:true/false 箭头、AXIS_COLOR:颜色、LINE_WIDTH:线宽、TICK_LENGTH:刻度长、FONT_SIZE:字号、TICK_STEP:刻度步长、ARROW_STYLE:>/->、ARROW_SCALE:箭头大小、PADDING:留白）：',
    GRAPH_SAMPLE_COORDINATE,
    '· 几何/函数用 TYPE:SHAPES：',
    GRAPH_SAMPLE_SHAPES,
    GRAPH_SAMPLE_SHAPES_EXTRA,
    '· 统计图（BAR_CHART/LINE_CHART/PIE_CHART，参数 DATA:数据列表、LABELS:分类、TITLE、XLABEL、YLABEL、COLORS:颜色列表）：',
    GRAPH_SAMPLE_BAR,
    GRAPH_SAMPLE_CHART_LINE,
    GRAPH_SAMPLE_PIE,
  ],
  '物理': [
    '· 受力分析用 TYPE:FORCE（OBJECT:形状,x,y,w,h；FORCES 每行"名称:方向,作用点,大小"，方向 down/up/left/right、作用点 center/corner）：',
    GRAPH_SAMPLE_FORCE,
    '· 电路图用 TYPE:CIRCUIT（COMPONENTS 每行"元件,x,y,方向"，元件 battery/switch/bulb/resistor；WIRES 用 "x1,y1-x2,y2;..." 描述连线）：',
    GRAPH_SAMPLE_CIRCUIT,
    '· 光路图用 TYPE:OPTICS（MIRROR:plane,x1,y1,x2,y2；INCIDENT:x1,y1,x2,y2 入射光线；ANGLE:入射角）：',
    GRAPH_SAMPLE_OPTICS,
    '· 函数/几何/统计：',
    GRAPH_SAMPLE_SHAPES,
    GRAPH_SAMPLE_BAR,
  ],
  '化学': [
    '· 原子结构用 TYPE:ATOM（ELEMENT:元素符号；SHELLS:各层电子数,逗号分隔）：',
    GRAPH_SAMPLE_ATOM,
    '· 统计/数据（BAR_CHART/LINE_CHART）：',
    GRAPH_SAMPLE_BAR,
    GRAPH_SAMPLE_CHART_LINE,
  ],
  '科学': [
    '· 统计/数据图（BAR_CHART/LINE_CHART/PIE_CHART）：',
    GRAPH_SAMPLE_BAR,
    GRAPH_SAMPLE_CHART_LINE,
    GRAPH_SAMPLE_PIE,
  ],
  '生物': [
    '· 统计/数据图（BAR_CHART/LINE_CHART/PIE_CHART）：',
    GRAPH_SAMPLE_BAR,
    GRAPH_SAMPLE_CHART_LINE,
    GRAPH_SAMPLE_PIE,
  ],
  '地理': [
    '· 统计/数据图（BAR_CHART/LINE_CHART/PIE_CHART）：',
    GRAPH_SAMPLE_BAR,
    GRAPH_SAMPLE_CHART_LINE,
    GRAPH_SAMPLE_PIE,
  ],
  '历史': [
    '· 统计/数据图（BAR_CHART/LINE_CHART/PIE_CHART，用于史实数据比较、时序变化等）：',
    GRAPH_SAMPLE_BAR,
    GRAPH_SAMPLE_CHART_LINE,
    GRAPH_SAMPLE_PIE,
  ],
  '信息科技': [
    '· 统计/数据图（BAR_CHART/LINE_CHART）：',
    GRAPH_SAMPLE_BAR,
    GRAPH_SAMPLE_CHART_LINE,
  ],
};

/** 学科 → 允许的 GRAPH TYPE 列表（渲染端校验用） */
export const SUBJECT_GRAPH_TYPES = {
  '数学': ['COORDINATE', 'SHAPES', 'BAR_CHART', 'LINE_CHART', 'PIE_CHART'],
  '物理': ['FORCE', 'CIRCUIT', 'OPTICS', 'SHAPES', 'BAR_CHART', 'LINE_CHART'],
  '化学': ['ATOM', 'BAR_CHART', 'LINE_CHART'],
  '科学': ['BAR_CHART', 'LINE_CHART', 'PIE_CHART'],
  '生物': ['BAR_CHART', 'LINE_CHART', 'PIE_CHART'],
  '地理': ['BAR_CHART', 'LINE_CHART', 'PIE_CHART'],
  '历史': ['BAR_CHART', 'LINE_CHART', 'PIE_CHART'],
  '信息科技': ['BAR_CHART', 'LINE_CHART'],
};

/** 坐标类图形参数说明（仅 COORDINATE/SHAPES 适用；注入一次，避免每个示例重复） */
const GRAPH_AXIS_PARAMS = '坐标类参数：XLIM:min,max 横轴范围、YLIM:min,max 纵轴范围、GRID:TRUE/FALSE 网格、TITLE:标题';

/** 公式规则（公式内分数用 \frac；非公式语境的分数标注用半角斜杠——两者分属不同标记场景） */
const FORMULA_RULES = '· 公式：行内用 $...$、块级用 $$...$$；公式内分数用 \\frac 表示，非公式语境的分数标注用"分子/分母"半角斜杠（如 1/2）；公式禁止用文本堆砌或图片代替。';

// ==================== 学段维度门控（三维度对齐：学段 × 学科 × 类型） ====================

/** 中学及以上（middle/high；stage 为空时视为全量，兼容旧调用） */
const isMiddlePlus = (stage) => !stage || stage === 'middle' || stage === 'high';

/**
 * 学科×学段 → [GRAPH] 注入内容（学段门控）：
 *   - 物理/化学：仅初中及以上（小学无物理化学）
 *   - 数学低段/中段：只保留数轴与统计图（裁剪函数/几何 SHAPES 段——SHAPES 示例为二次函数，小学课标无函数）
 *   - 数学高段：SHAPES 替换为小学版示例（圆/几何图形，无函数；高段课标含圆，保留图形能力）
 *   - 其余学科：全量
 * @returns {null | {parts: string[], types: string[]}}
 */
const getGraphParts = (subject, stage) => {
  const base = SUBJECT_GRAPH_PARTS[subject];
  if (!base) return null;
  if ((subject === '物理' || subject === '化学') && !isMiddlePlus(stage)) return null;
  if (subject === '数学' && /^primary/.test(stage)) {
    if (stage === 'primary_high') {
      // 小学高段：保留 SHAPES 能力但替换示例为小学版（圆），裁剪 EXTRA 中的 FUNCTION 行；
      // 统计图含 PIE（六年级扇形统计图是课标内容）
      const parts = base.filter(p => !/SHAPES|函数|几何/.test(p));
      parts.splice(2, 0,
        '· 几何图形用 TYPE:SHAPES（CIRCLE 圆/三角形/长方形等，元素格式见下）：',
        GRAPH_SAMPLE_SHAPES_PRIMARY,
        GRAPH_SAMPLE_SHAPES_EXTRA.replace(/  FUNCTION:表达式 \| COLOR:颜色 \| DOMAIN:min,max\n/, ''));
      return { parts, types: ['COORDINATE', 'SHAPES', 'BAR_CHART', 'LINE_CHART', 'PIE_CHART'] };
    }
    // 低段/中段：无函数几何与扇形统计图（PIE 为六年级课标内容），整体裁剪 SHAPES/PIE 段
    // 🔧 先替换统计图引导句（去 PIE_CHART）再裁剪 PIE 示例，避免引导句被 /PIE/ 一并滤除（历史缺陷：map 永不命中）
    return {
      parts: base
        .map(p => p.startsWith('· 统计图') ? '· 统计图（BAR_CHART/LINE_CHART，参数 DATA:数据列表、LABELS:分类、TITLE、XLABEL、YLABEL、COLORS:颜色列表）：' : p)
        .filter(p => !/SHAPES|函数|几何/.test(p) && !/PIE/.test(p)),
      types: ['COORDINATE', 'BAR_CHART', 'LINE_CHART'],
    };
  }
  return { parts: base, types: SUBJECT_GRAPH_TYPES[subject] || GRAPH_TYPES };
};

/**
 * 学科×学段 → 是否注入公式（学段门控）：
 *   - 数学：初中及以上（小学全学段无 LaTeX 公式——FORMULA_RULES 示例为二次函数求根公式，属初中内容，注入即诱导超纲）
 *   - 物理/化学：初中及以上（小学无物理化学）
 */
const getFormulaNeeded = (subject, stage) => {
  if (subject === '数学') return isMiddlePlus(stage);
  if (subject === '物理' || subject === '化学') return isMiddlePlus(stage);
  return false;
};

/**
 * 构建渲染指令契约段（三维度注入：学段 × 学科 × 类型/配图）
 * 用户自定义契约（RenderContractView 编辑、localStorage 存储）在此优先覆盖内置：
 *   - graphTypes：覆盖该学科的 [GRAPH] TYPE 集合
 *   - formula：覆盖是否注入 $..$ 公式
 * @param {Object} opts { subject(学科), genType(资料类型), needsImage(是否配图), stage(学段键), userContract(用户契约，默认从 localStorage 读取) }
 * @returns {string} 空串 = 无需渲染指令
 */
const USER_CONTRACT_KEY = 'wisdom_render_contract_v1';
const loadUserContract = () => {
  if (typeof localStorage === 'undefined') return {};
  try { return JSON.parse(localStorage.getItem(USER_CONTRACT_KEY) || '{}'); } catch { return {}; }
};

export function buildRenderContract({ subject = '', genType = '', needsImage = false, stage = '', userContract } = {}) {
  // 工具库条目开关：学科契约整条停用（subj:学科）→ 该学科不注入任何图形/公式/配图契约
  if (subject && !isLibEntryEnabled('render-contract', `subj:${subject}`)) return '';
  const parts = [];
  const user = userContract ?? loadUserContract();
  const userForSubject = user[subject] || null;
  const graph = getGraphParts(subject, stage);
  const formulaNeeded = getFormulaNeeded(subject, stage);
  if (!graph && !formulaNeeded && !needsImage && !userForSubject) return '';

  // 用户自定义覆盖内置（仅当用户定义了该学科的契约才生效）；TYPE 在工具库被停用时剔除
  const filterEnabledTypes = (list) => (list || []).filter((t) => isLibEntryEnabled('render-contract', t));
  const graphTypes = userForSubject?.graphTypes && userForSubject.graphTypes.length
    ? filterEnabledTypes(userForSubject.graphTypes)
    : (graph ? filterEnabledTypes(graph.types) : []);
  const formula = userForSubject ? !!userForSubject.formula : formulaNeeded;
  // 用户显式定义了配图开关则覆盖题型关键词判定（否则按内置 needsImage）
  const image = userForSubject && 'image' in userForSubject ? !!userForSubject.image : needsImage;

  if (graphTypes.length || graph || image || userForSubject) {
    // 🔧 段头注入条件含"配图"场景（历史缺陷：仅 graph 时注入，配图-only 无段头 → 格式说明悬空）
    parts.push('【渲染指令（EduRender Studio 格式，渲染端可直接解析；仅需图/公式/配图时输出，不计题量）】');
    const typeLabel = graphTypes.length ? graphTypes.join('/') : '';
    if (typeLabel) {
      if (/COORDINATE|SHAPES/.test(typeLabel)) {
        parts.push(`· 图形用 [GRAPH]...[/GRAPH]，TYPE ∈ ${typeLabel}；${GRAPH_AXIS_PARAMS}。图形数据必须与题干完全一致。`);
      } else {
        parts.push(`· 图形用 [GRAPH]...[/GRAPH]，TYPE ∈ ${typeLabel}。图形数据必须与题干完全一致。`);
      }
      parts.push(...(graph ? graph.parts : []));
    }
  }
  if (formula) {
    parts.push(FORMULA_RULES);
  }
  if (image) {
    parts.push(`· 配图（看图/配图题）用 [IMAGE]...[/IMAGE]，每图一个、单独成段，图内无字、不暗示答案，PROMPT 画面要素须与题干情境严格一致（人物/场景/数量与题干吻合，不得另起无关画面）：`);
    parts.push(IMAGE_SAMPLE);
    parts.push(`· 或图标检索（图标/标识类场景用 TYPE:ICON）：`);
    parts.push(IMAGE_SAMPLE_ICON);
  }
  return `\n\n${parts.join('\n')}`;
}

/** 判定某资料/大题是否需要配图标记（教辅类默认配图；exam 按题型关键词；纯文字类不配图） */
export function needsImageHint(text = '', genType = '') {
  if (genType && IMAGE_DEFAULT_TYPES.has(genType)) return true;
  return IMAGE_HINT_RE.test(String(text || '')) || genType === 'dictation';
}

/** 导出示例骨架（渲染契约库展示用；纯导出，不影响生成逻辑） */
export const GRAPH_SAMPLES = {
  COORDINATE: GRAPH_SAMPLE_COORDINATE,
  SHAPES: GRAPH_SAMPLE_SHAPES,
  BAR_CHART: GRAPH_SAMPLE_BAR,
  LINE_CHART: GRAPH_SAMPLE_CHART_LINE,
  PIE_CHART: GRAPH_SAMPLE_PIE,
  FORCE: GRAPH_SAMPLE_FORCE,
  CIRCUIT: GRAPH_SAMPLE_CIRCUIT,
  OPTICS: GRAPH_SAMPLE_OPTICS,
  ATOM: GRAPH_SAMPLE_ATOM,
};

export default {
  GRAPH_TYPES, MATH_SUBJECTS, SUBJECT_GRAPH_TYPES,
  buildRenderContract, needsImageHint, GRAPH_SAMPLES,
};
