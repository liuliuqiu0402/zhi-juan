/**
 * EduRender 渲染指令契约（生成端注入版）
 * ============================================================
 * 🔴 定位：把 EduRender Studio 的完整指令格式整合进生成链路，
 *    让生成模型输出的 [GRAPH]/[IMAGE]/公式标记可被 EduRender Studio 直接渲染。
 *    - [GRAPH]...[/GRAPH]  图形（数轴/函数/几何/统计/受力/电路/光路/原子）
 *    - [IMAGE]...[/IMAGE]  配图（画面描述 / ICON 图标检索）
 *    - $...$ / $$...$$     公式（行内 / 块级）
 * 按 学科×学段 门控注入：[GRAPH] 骨架只给该学科×学段真有图形能力的（数理化生科史地信），
 *   公式只给数理化且初中学段以上，[IMAGE] 为**能力就绪**（学科契约开启即给，是否真配图由正文裁定）。
 * 🔴 判定单源：resolveMarkCapability 同时供本文件（system 注入）与 promptLibrary（委托正文点名哪几个
 *   标记）使用——正文点名 [IMAGE]/[GRAPH] ⇔ system 必给对应骨架，任一方单独改动都会被守卫测试拦下。
 * ============================================================
 */

import { isLibEntryEnabled, loadLibToggles } from '../utils/libToggles.js';

/** 允许的 [GRAPH] TYPE 全集 */
export const GRAPH_TYPES = [
  'COORDINATE', 'SHAPES', 'BAR_CHART', 'LINE_CHART', 'PIE_CHART',
  'FORCE', 'CIRCUIT', 'OPTICS', 'ATOM',
];

/** 需要 $公式$ 的学科 */
export const MATH_SUBJECTS = ['数学', '物理', '化学'];

/** 🔴 图依赖词（**单一事实源**，2026-09-12）：判定"题干是否要学生依据图形/画面作答"的**程序侧**词表。
 *  ============================================================
 *  🔴 为什么必须单源：2026-09-12 实证——指令侧（promptLibrary 图-题一致性条款）与校验侧
 *    （examValidator 2j-3 缺图探针）各自维护了一份词表且互不相等（校验侧多"看图形/统计图/
 *    观察…图形/格图"）。于是模型只认自己被枚举的那几个词，遇到"观察下面的图形/看图形/统计图"
 *    就判"题干未声明图依赖"而不出图，校验侧却照旧报"题干要图却没出图"——两边不同源，
 *    来回修了很多轮都摸不到根因（每轮只在改其中一边）。
 *  ⚠️ 用法边界：本表**只供程序侧校验**使用。下发给模型的条款必须是**原则式**
 *    （判断依据=该题作答是否依赖图中信息），**严禁把本表当清单写进指令**——措辞列举不完，必有漏判。
 *    2026-09-17：原"能力注入集合"（IMAGE_HINT_RE 超集）已撤除——能力判定改为**学科契约开启即注入**
 *    （见 resolveMarkCapability），不再由文本/类型充当第二把尺子（两把尺子必然打架：正文点名 [IMAGE]
 *    而 system 不开骨架，或反之）。本表仍为**校验侧**唯一判据。
 */
export const FIGURE_DEPENDENCY_RE = /看图|读图|看图形|识图|据图|依图|如图|图表|统计图|观察[^\n]{0,8}图形|格图/;

// ==================== EduRender Studio 完整格式骨架 ====================

/** [IMAGE] 示例（画面描述 + ICON 图标检索；不指定生图引擎，渲染端按其标准处理）
 *  🔴 2026-09-16：PROMPT 要求写明**主体与数量**——数量是唯一能被程序与题干交叉核对的要素，
 *    写明后 examValidator 2j-4 才能查出"题干三只、画面一只"这类不一致。
 *    ⚠️ 只强化 PROMPT 文本要求，**不新增字段**：examValidator 1.5 重建 [IMAGE] 块时仅保留 PROMPT，
 *    新增字段会被静默丢弃（既到不了渲染端也留不下供校验）。 */
const IMAGE_SAMPLE = `[IMAGE]
PROMPT:画面描述（**必须写明主体与数量**，如"三只熊猫在竹林中吃竹子"；图内不出现文字）
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
TITLE:各组数据分布
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
    '· 受力分析用 TYPE:FORCE（OBJECT:形状,x,y,w,h；FORCES 每行"名称:方向,作用点,大小"，方向 down/up/left/right、作用点 center/corner；"大小"取题目给出的数值，题目未给出时各力写同一个数——渲染端按大小成比例定箭头长度，编造比例会画出误导性的图）：',
    GRAPH_SAMPLE_FORCE,
    '· 电路图用 TYPE:CIRCUIT（COMPONENTS 每行"元件,x,y,方向"，元件 battery/switch/bulb/resistor；WIRES 用 "x1,y1-x2,y2;..." 描述连线；元件与连线必须与题目一致）：',
    GRAPH_SAMPLE_CIRCUIT,
    '· 光路图用 TYPE:OPTICS（MIRROR:plane,x1,y1,x2,y2；INCIDENT:x1,y1,x2,y2 入射光线；ANGLE:入射角取题目给出的值，题目未给可省略）：',
    GRAPH_SAMPLE_OPTICS,
    '· 函数/几何/统计：',
    GRAPH_SAMPLE_SHAPES,
    GRAPH_SAMPLE_BAR,
  ],
  '化学': [
    '· 原子结构用 TYPE:ATOM（ELEMENT:元素符号；SHELLS:各层电子数,逗号分隔；两者都必须与题目所指元素一致——渲染端已无默认元素，缺参数会直接报错）：',
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
 * 🔴 标记能力判定·**单源**（2026-09-17 用户裁定：正文要求与注入能力必须同源）
 * ============================================================
 * 为什么必须单源：正文（QUESTION_FORMAT 的"图随题"条款、CONTENT_FORMAT 的图表句）会**点名**
 *   [IMAGE]/[GRAPH] 并要求"按注入的【渲染指令】输出"。若正文点名而 system 不给该骨架，模型拿到的是
 *   "必须输出一个没有格式说明的东西"——实测 675 个三维度组合里有 267 个是这种悬空（数学·初中·exam 等
 *   needsImage=false 的卷：正文强制 [IMAGE]、system 只有 [GRAPH] 骨架），模型只能写"根据图片提示…"
 *   文字图语或省块。反向亦然（给了骨架没要求）会诱导多配图。
 * 口径（三处同一判定，杜绝两把尺子）：
 *   - on：学科契约整条停用（工具库 subj:学科）→ 全关（与工具库 UI 文案"停用后生成端不输出
 *     [GRAPH]/公式/[IMAGE]"一致；此时正文亦不再点名任何标记）；
 *   - graph：该学科×学段有 [GRAPH] 能力（getGraphParts）或用户在渲染契约库自定义了 TYPE；
 *   - formula：数理化学科按学段；
 *   - image：**能力就绪默认开**（2026-09-17 起不再按资料类型/文本关键词收窄）——题类与内容型的正文都可能
 *     出现需图的题（题干由模型拟定，程序无法预知），能力就绪只代表"会按格式输出"，是否真的配图由正文
 *     "图随题"条款裁定；用户可在渲染契约库显式关闭（image:false）。
 * @returns {{on:boolean, graph:boolean, graphTypes:string[], formula:boolean, image:boolean}}
 */
export function resolveMarkCapability({ subject = '', stage = '', userContract } = {}) {
  const on = !subject || isLibEntryEnabled('render-contract', `subj:${subject}`);
  const user = (userContract ?? loadUserContract())[subject] || null;
  const filterEnabledTypes = (list) => (list || []).filter((t) => isLibEntryEnabled('render-contract', t));
  const graphBase = on ? getGraphParts(subject, stage) : null;
  const graphTypes = on
    ? (user?.graphTypes && user.graphTypes.length
      ? filterEnabledTypes(user.graphTypes)
      : (graphBase ? filterEnabledTypes(graphBase.types) : []))
    : [];
  const graph = on && !!graphBase;
  const formula = on && (user ? !!user.formula : getFormulaNeeded(subject, stage));
  const image = on && (user && 'image' in user ? !!user.image : true);
  return { on, graph, graphTypes, formula, image };
}

/**
 * 构建渲染指令契约段（三维度注入：学段 × 学科 × 类型/配图）
 * 用户自定义契约（RenderContractView 编辑、localStorage 存储）在此优先覆盖内置：
 *   - graphTypes：覆盖该学科的 [GRAPH] TYPE 集合
 *   - formula：覆盖是否注入 $..$ 公式
 *   - image：覆盖是否注入 [IMAGE] 配图契约
 * @param {Object} opts { subject(学科), genType(资料类型), stage(学段键), userContract(用户契约，默认从 localStorage 读取) }
 * @returns {string} 空串 = 无需渲染指令（仅"学科契约被停用"一种情形）
 */
const USER_CONTRACT_KEY = 'wisdom_render_contract_v1';
const loadUserContract = () => {
  if (typeof localStorage === 'undefined') return {};
  try { return JSON.parse(localStorage.getItem(USER_CONTRACT_KEY) || '{}'); } catch { return {}; }
};

export function buildRenderContract({ subject = '', stage = '', userContract } = {}) {
  const cap = resolveMarkCapability({ subject, stage, userContract });
  if (!cap.on) return '';
  const typeLabel = cap.graphTypes.length ? cap.graphTypes.join('/') : '';
  // 无任何标记能力（用户在渲染契约库把该学科图形/公式/配图全关）→ 本段不注入；
  // 正文侧同一判定（resolveMarkCapability）亦不提任何标记 —— 两侧恒等，不存在"要求悬空"。
  if (!typeLabel && !cap.formula && !cap.image) return '';
  const parts = [];
  // 🔧 段头：2026-09-17 改"按需输出，图块随题、不单独计题"——原"仅需图/公式/配图时输出，不计题量"
  //    与正文"该图是本题必不可少的内容、无图可看则该题不可作答"语义相抵（把图讲成可挂可不挂的载荷，
  //    模型倾向保守不出图）。图块随题、不单独计题的口径两处一致。
  parts.push('【渲染指令（EduRender Studio 格式，渲染端可直接解析；按需输出，图块随题、不单独计题）】');
  if (typeLabel) {
    if (/COORDINATE|SHAPES/.test(typeLabel)) {
      parts.push(`· 图形用 [GRAPH]...[/GRAPH]，TYPE ∈ ${typeLabel}；${GRAPH_AXIS_PARAMS}。图形数据必须与题干完全一致。`);
    } else {
      parts.push(`· 图形用 [GRAPH]...[/GRAPH]，TYPE ∈ ${typeLabel}。图形数据必须与题干完全一致。`);
    }
    parts.push(...(cap.graph ? (getGraphParts(subject, stage)?.parts || []) : []));
  }
  if (cap.formula) {
    parts.push(FORMULA_RULES);
  }
  if (cap.image) {
    parts.push(`· 配图（看图/配图题）用 [IMAGE]...[/IMAGE]，每图一个、单独成段，图内无字、不暗示答案，PROMPT 画面要素须与题干情境严格一致（人物/场景/数量与题干吻合，不得另起无关画面）——**数量必须写明且与题干一致**（如题干"三只"，画面描述须写"三只"）：`);
    parts.push(IMAGE_SAMPLE);
    parts.push(`· 或图标检索（图标/标识类场景用 TYPE:ICON）：`);
    parts.push(IMAGE_SAMPLE_ICON);
  }
  return `\n\n${parts.join('\n')}`;
}

/* 🔴 2026-09-17 用户裁定：原 needsImageHint（按资料类型白名单 + 文本关键词判"要不要给 [IMAGE] 骨架"）
 *   与 buildNeedsImageText（三入口拼提示文本）**整条撤除**——
 *   · 病根：那是"第二把尺子"。正文对图的要求是**原则式**（该题作答是否需要图中信息，题干怎么措辞都算），
 *     程序侧却按"结构/类型/范围/章节名有没有图词"猜，两把尺子必然错位：实测 675 组合里 267 组合
 *     正文点名 [IMAGE]/指向【渲染指令】而 system 侧无对应骨架/整段缺失（假指针 + 悬空要求）。
 *   · 新口径：能力就绪（resolveMarkCapability），凡学科契约开启即给骨架，与正文同一判定；
 *     "文本是否含图词"不再是能力开关，**校验侧**仍认 FIGURE_DEPENDENCY_RE（examValidator 2j-3 缺图探针）。
 *   · 附带收益：A21 当初的治理对象——"三入口各自拼文本 → 面板预览与实际下发漂移"——随文本信号撤除而消失。 */

/**
 * 能力判定**签名**（工具库开关 + 用户自定义契约）：供 promptLibrary 的 cell 预生成缓存判新旧用。
 * ============================================================
 * 为什么需要它：标记能力（resolveMarkCapability）现在是**委托正文**的输入之一（正文点名哪几个标记）。
 *   而指令库 cell（486 条）是模块加载期预生成的——用户在运行期改了工具库开关或渲染契约库的自定义项后，
 *   若 cell 不重建，"正文点名 [IMAGE]/[GRAPH]"会与"实际注入的骨架"再次不同源（正是本轮治理的不变量）。
 *   ⚠️ 判定本身仍是单源 resolveMarkCapability；本函数只回答"能力有没有变"，不参与判定。
 */
export function markCapabilitySignature() {
  return JSON.stringify([loadLibToggles(), loadUserContract()]);
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
  buildRenderContract, resolveMarkCapability, markCapabilitySignature, GRAPH_SAMPLES, FIGURE_DEPENDENCY_RE,
};
