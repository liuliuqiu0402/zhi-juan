/**
 * 高中教材「册次」维度（导入/筛选的单一事实源）
 * ============================================================
 * 🔴 为什么高中用「册次」而不是「年级」：
 *   普通高中教材按"必修／选择性必修"**分册**，教材本身**不绑定年级**——各省教学用书目录里
 *   「册次」与「使用年级」是**两栏并列**，使用年级那一栏写的是区间（"高一年级至高三年级"）；
 *   而"必修＝高一"这个映射在各省并不成立：
 *     · 山东省普通高中教学指导意见：语文「必修上」排第一学年，「必修下」与两本选择性必修排第二学年；
 *     · 广东省：语文/数学/外语/史地化生在高一学年完成必修学分（外语须在四分之三学年内完成），
 *       而思想政治、物理的必修要到高二上学期才完成。
 *   即：同一个「必修下」在不同省落在不同学年。故年级对高中既**选不准**也**无判定价值**
 *   （见 utils/gradeStage.resolveStageKey：高中一律归一为 'high'，不按年级细分），
 *   册次才是教材的稳定标识。
 *
 * 🔴 规范式（**版本无关**，本项目内部存储/筛选一律用它）：
 *   `必修N` / `选择性必修N`（N 为阿拉伯数字）；语文这类按上/中/下分册的用 `必修上` / `选择性必修中`。
 *   各版本印在书上的写法不同（人教社"必修第一册"、旧版"必修1"、"必修一"、圈码"必修①"、
 *   数学B版甚至是四册必修），**识别一律走本模块 detectHighVolume 的通用正则**，
 *   不靠枚举别名 —— 枚举必然漏（B版必修第四册、各地自编补充册）。
 *
 * 🔴 数据来源（预设清单只用于界面候选，不参与识别）：
 *   · 教育部高中三科统编教材发布：语文 5 册（必修上/下 + 选择性必修上/中/下）、
 *     思想政治 7 册（必修1-4 + 选择性必修1-3）、历史 5 册（中外历史纲要上/下 + 选择性必修1-3）；
 *   · 人教社各科分册目录：数学A版必修2册 + 选择性必修3册、英语必修3册 + 选择性必修4册、
 *     物理必修3册 + 选择性必修3册、化学必修2册 + 选择性必修3册、生物必修2册 + 选择性必修3册、
 *     地理必修2册 + 选择性必修3册、信息技术必修2册 + 选择性必修6册。
 *   · 与 config/domainContract.HIGH_DOMAIN_CONTRACT（高中课标内容领域/模块名）**同一口径**：
 *     那边管"内容领域对账"，本表管"教材是哪一册"，两者不互相替代。
 *   · 音乐/美术/体育高中是**模块制**、无固定册次 → 不预设（界面允许自由填写）。
 * ============================================================
 */

/** 中文数字 / 圈码（与 utils/gradeStage 同族；此处仅用于正则字符类，不再另建映射） */
const CN_NUM_CHARS = '一二三四五六七八九十';
const CIRCLE_CHARS = '①②③④⑤⑥⑦⑧⑨⑩';

/** 份量：预设清单里"若干册必修"的编号来源 */
const cnNum = (n) => CN_NUM_CHARS[n - 1];

/** 连续编号册次：kind='必修' | '选择性必修'，n 为册数 */
const numbered = (kind, n, labels = []) =>
  Array.from({ length: n }, (_, i) => {
    const id = `${kind}${i + 1}`;
    return { id, label: labels[i] || (kind === '必修' ? `必修第${cnNum(i + 1)}册` : `选择性必修第${cnNum(i + 1)}册`) };
  });

/**
 * 高中各科官方册次清单（界面候选；识别不依赖本表，见 detectHighVolume）
 * 未登记的学科（音乐/美术/体育等模块制学科）返回 [] → 界面走自由填写。
 */
export const HIGH_VOLUMES = {
  '语文': [
    { id: '必修上', label: '必修（上册）' },
    { id: '必修下', label: '必修（下册）' },
    { id: '选择性必修上', label: '选择性必修（上册）' },
    { id: '选择性必修中', label: '选择性必修（中册）' },
    { id: '选择性必修下', label: '选择性必修（下册）' },
  ],
  '数学': [
    ...numbered('必修', 2),          // A 版 2 册（B 版 4 册，识别仍可认，仅候选少列）
    ...numbered('选择性必修', 3),
  ],
  '英语': [
    ...numbered('必修', 3),
    ...numbered('选择性必修', 4),
  ],
  '物理': [
    ...numbered('必修', 3),
    ...numbered('选择性必修', 3),
  ],
  '化学': [
    ...numbered('必修', 2),
    { id: '选择性必修1', label: '选择性必修1 化学反应原理' },
    { id: '选择性必修2', label: '选择性必修2 物质结构与性质' },
    { id: '选择性必修3', label: '选择性必修3 有机化学基础' },
  ],
  '生物': [
    { id: '必修1', label: '必修1 分子与细胞' },
    { id: '必修2', label: '必修2 遗传与进化' },
    { id: '选择性必修1', label: '选择性必修1 稳态与调节' },
    { id: '选择性必修2', label: '选择性必修2 生物与环境' },
    { id: '选择性必修3', label: '选择性必修3 生物技术与工程' },
  ],
  '思想政治': [
    { id: '必修1', label: '必修1 中国特色社会主义' },
    { id: '必修2', label: '必修2 经济与社会' },
    { id: '必修3', label: '必修3 政治与法治' },
    { id: '必修4', label: '必修4 哲学与文化' },
    { id: '选择性必修1', label: '选择性必修1 当代国际政治与经济' },
    { id: '选择性必修2', label: '选择性必修2 法律与生活' },
    { id: '选择性必修3', label: '选择性必修3 逻辑与思维' },
  ],
  '历史': [
    { id: '必修上', label: '必修（中外历史纲要上）' },
    { id: '必修下', label: '必修（中外历史纲要下）' },
    { id: '选择性必修1', label: '选择性必修1 国家制度与社会治理' },
    { id: '选择性必修2', label: '选择性必修2 经济与社会生活' },
    { id: '选择性必修3', label: '选择性必修3 文化交流与传播' },
  ],
  '地理': [
    ...numbered('必修', 2),
    { id: '选择性必修1', label: '选择性必修1 自然地理基础' },
    { id: '选择性必修2', label: '选择性必修2 区域发展' },
    { id: '选择性必修3', label: '选择性必修3 资源、环境与国家安全' },
  ],
  '信息科技': [
    { id: '必修1', label: '必修1 数据与计算' },
    { id: '必修2', label: '必修2 信息系统与社会' },
    { id: '选择性必修1', label: '选择性必修1 数据与数据结构' },
    { id: '选择性必修2', label: '选择性必修2 网络基础' },
    { id: '选择性必修3', label: '选择性必修3 数据管理与分析' },
    { id: '选择性必修4', label: '选择性必修4 人工智能初步' },
    { id: '选择性必修5', label: '选择性必修5 三维设计与创意' },
    { id: '选择性必修6', label: '选择性必修6 开源硬件项目设计' },
  ],
};

/** 学科 → 册次候选；学科未定/未登记 → 合并全部候选（去重保序），保证"学科还没选"时也能挑册次 */
export const highVolumeOptions = (subject = '') => {
  const list = HIGH_VOLUMES[subject];
  if (list && list.length) return list;
  if (subject) return [];
  const seen = new Set();
  const merged = [];
  for (const arr of Object.values(HIGH_VOLUMES)) {
    for (const v of arr) {
      if (seen.has(v.id)) continue;
      seen.add(v.id);
      merged.push(v);
    }
  }
  return merged;
};

/** 识别用紧凑串：去空白与各类括号 —— 教材名常写"（必修）第一册""必修 1"等，不归一必漏 */
const compactForVolume = (name = '') => String(name).replace(/[\s（）()【】[\]]/g, '');

/** 中文数字/圈码/阿拉伯数字 → 阿拉伯数字字符串（识别不到返回原串） */
const toNum = (ch) => {
  const i = CN_NUM_CHARS.indexOf(ch);
  if (i >= 0) return String(i + 1);
  const c = CIRCLE_CHARS.indexOf(ch);
  if (c >= 0) return String(c + 1);
  return String(ch);
};

/**
 * 从教材名识别高中册次（**高置信**：只认"必修/选择性必修"字面，不做任何推测）
 * ============================================================
 * 🔴 与"年级"识别（utils/textbookMeta 只认小学 1-6 年级、明确不猜高中年级）的区别：
 *    册次在文件名里是**字面出现**的（"必修第一册""选择性必修2"），照抄不会错；
 *    而"这本必修1是高一还是高二"官方无绑定、各省不同 —— 故 **认册次、绝不认年级**。
 * 🔴 "选择性必修"必须先于"必修"判定：`必修1` 是 `选择性必修1` 的子串，
 *    先匹配短式会把它误认成必修（同 textbookMeta 里"思想政治"必须先于"政治"的道理）。
 *    此处再用掩码（把"选择性必修"替换为哨兵）做第二道保险，确保必修模式不会吃到选必的尾巴。
 * @returns {{ isHigh: boolean, volume: string }} isHigh=是否高中（本书名出现高中/必修/选择性必修）；
 *          volume=规范式册次，识别不到为 ''（此时仍可能是高中，如"高中语文"）
 */
export const detectHighVolume = (name = '') => {
  const raw = String(name || '');
  if (!raw) return { isHigh: false, volume: '' };
  const s = compactForVolume(raw);

  // 语文/历史等按上中下分册的写法：选择性必修（上/中/下）。先于编号式判，避免"选择性必修上"落空
  let m = s.match(new RegExp(`选择性必修([上中下])册?`));
  if (m) return { isHigh: true, volume: `选择性必修${m[1]}` };

  m = s.match(new RegExp(`选择性必修第?([${CN_NUM_CHARS}${CIRCLE_CHARS}1-9])册?`));
  if (m) return { isHigh: true, volume: `选择性必修${toNum(m[1])}` };

  // 必修：先掩掉"选择性必修"，防止 `必修([上下])`/`必修第?N` 吃到"选择性必修1"的尾巴
  const masked = s.replace(/选择性必修/g, '\u0001');

  m = masked.match(/必修([上下])册?/);
  if (m) return { isHigh: true, volume: `必修${m[1]}` };

  m = masked.match(new RegExp(`必修(?:模块)?第?([${CN_NUM_CHARS}${CIRCLE_CHARS}1-9])册?`));
  if (m) return { isHigh: true, volume: `必修${toNum(m[1])}` };

  // 只写了学段/只写了"必修"但没写册次：仍是高中（册次留空，由用户在界面补）
  if (/高中|必修/.test(s)) return { isHigh: true, volume: '' };

  return { isHigh: false, volume: '' };
};

/** 该学科是否登记了册次清单（供界面决定用"预设候选"还是"自由填写"） */
export const hasHighVolumePreset = (subject = '') => !!HIGH_VOLUMES[subject]?.length;

export default { HIGH_VOLUMES, highVolumeOptions, detectHighVolume, hasHighVolumePreset };
