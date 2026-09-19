/**
 * 各省市中高考考试时长/总分配置（代表值，供出卷系统取值）
 * ── 取值规则 ──
 * 1. 生成时用户选择省市 → 查本表（region × stage × subject）→ 命中则覆盖蓝本默认 fullScore/duration
 * 2. 大题分值分配：按"新总分 ÷ 蓝本默认总分"等比例缩放题型骨架各大题分值，末大题修正保证各大题之和精确=新总分
 * 2b. **栏目级覆盖（2026-09-19 用户裁定）**：该学科配置可另带 sections（[{name,score,note?}]），命中则
 *     **直接替换**该科栏目数组——用于"题型结构确与全国通行骨架不同"的省市（如某省不设判断题）。
 *     note 缺省时按**同名栏目从蓝本继承**（少写一坨文案）；分值之和≠省市总分则按比例缩放 + 末栏修正。
 *     ⚠️ 缺省不启用（绝大多数省市栏目趋同，只需第 2 条的分值缩放），机制先行、数据按需再填。
 * 3. 未列出的省市/学段/学科 → 回退蓝本全国通行默认（中考语数英120分制等）
 * 4. 高考（高中）全国统一 3+1+2 结构（语数英150分、选考100分/75分钟），蓝本已精确对齐，无需省市覆盖
 * 5. 表中为各省代表值（省内各地市略有差异，此处取通行口径），数值可随政策调整
 */
export const EXAM_REGION_CONFIG = {
  // ══════════ 中考（初中） ══════════
  // ── 江苏：13 市各自命题，语数英分值不一（省厅"2024起全省统一命题"截至2026未落地），
  //    按 2026 官方方案拆分为主要城市；'江苏' 键保留为兼容回退（取南通 150 分制代表口径）
  '江苏·南京': {
    'middle': {
      '语文': { fullScore: 120, duration: '120分钟' },
      '数学': { fullScore: 120, duration: '120分钟' },
      '英语': { fullScore: 120, duration: '90分钟' },
      '物理': { fullScore: 100, duration: '90分钟' },
      '化学': { fullScore: 80, duration: '60分钟' },
      '道德与法治': { fullScore: 60, duration: '100分钟' },
      '历史': { fullScore: 60, duration: '100分钟' },
      '生物': { fullScore: 60, duration: '60分钟' },
      '地理': { fullScore: 60, duration: '60分钟' },
    },
  },
  '江苏·苏州': {
    'middle': {
      '语文': { fullScore: 130, duration: '150分钟' },
      '数学': { fullScore: 130, duration: '120分钟' },
      '英语': { fullScore: 130, duration: '100分钟' },
      '物理': { fullScore: 100, duration: '100分钟' },
      '化学': { fullScore: 100, duration: '100分钟' },
      '道德与法治': { fullScore: 50, duration: '50分钟' },
      '历史': { fullScore: 50, duration: '50分钟' },
      '生物': { fullScore: 30, duration: '60分钟' },
      '地理': { fullScore: 30, duration: '60分钟' },
    },
  },
  '江苏·无锡': {
    'middle': {
      '语文': { fullScore: 150, duration: '150分钟' },
      '数学': { fullScore: 150, duration: '120分钟' },
      '英语': { fullScore: 130, duration: '100分钟' },
      '物理': { fullScore: 100, duration: '100分钟' },
      '化学': { fullScore: 80, duration: '100分钟' },
      '道德与法治': { fullScore: 50, duration: '120分钟' },
      '历史': { fullScore: 50, duration: '120分钟' },
    },
  },
  '江苏·南通': {
    'middle': {
      '语文': { fullScore: 150, duration: '150分钟' },
      '数学': { fullScore: 150, duration: '120分钟' },
      '英语': { fullScore: 150, duration: '120分钟' },
      '物理': { fullScore: 90, duration: '150分钟' },
      '化学': { fullScore: 60, duration: '150分钟' },
      '道德与法治': { fullScore: 50, duration: '100分钟' },
      '历史': { fullScore: 50, duration: '100分钟' },
      '生物': { fullScore: 30, duration: '60分钟' },
      '地理': { fullScore: 30, duration: '60分钟' },
    },
  },
  '江苏': {
    'middle': {
      '语文': { fullScore: 150, duration: '150分钟' },
      '数学': { fullScore: 150, duration: '120分钟' },
      '英语': { fullScore: 120, duration: '100分钟' },
      '物理': { fullScore: 100, duration: '100分钟' },
      '化学': { fullScore: 100, duration: '100分钟' },
      '道德与法治': { fullScore: 100, duration: '60分钟' },
      '历史': { fullScore: 100, duration: '60分钟' },
      '生物': { fullScore: 100, duration: '60分钟' },
      '地理': { fullScore: 100, duration: '60分钟' },
    },
  },
  '重庆': {
    'middle': {
      '语文': { fullScore: 150, duration: '120分钟' },
      '数学': { fullScore: 150, duration: '120分钟' },
      '英语': { fullScore: 150, duration: '120分钟' },
      '物理': { fullScore: 80, duration: '90分钟' },
      '化学': { fullScore: 70, duration: '60分钟' },
      '道德与法治': { fullScore: 100, duration: '60分钟' },
      '历史': { fullScore: 100, duration: '60分钟' },
    },
  },
  '四川': {
    'middle': {
      '语文': { fullScore: 150, duration: '120分钟' },
      '数学': { fullScore: 150, duration: '120分钟' },
      '英语': { fullScore: 150, duration: '120分钟' },
      '物理': { fullScore: 100, duration: '90分钟' },
      '化学': { fullScore: 100, duration: '60分钟' },
    },
  },
  '福建': {
    'middle': {
      '语文': { fullScore: 150, duration: '120分钟' },
      '数学': { fullScore: 150, duration: '120分钟' },
      '英语': { fullScore: 150, duration: '120分钟' },
      '物理': { fullScore: 100, duration: '90分钟' },
      '化学': { fullScore: 100, duration: '60分钟' },
    },
  },
  '安徽': {
    'middle': {
      '语文': { fullScore: 150, duration: '150分钟' },
      '数学': { fullScore: 150, duration: '120分钟' },
      '英语': { fullScore: 150, duration: '120分钟' },
      '物理': { fullScore: 100, duration: '90分钟' },
      '化学': { fullScore: 100, duration: '60分钟' },
    },
  },
  // 120 分制省市（语数英）
  '浙江': {
    'middle': {
      '语文': { fullScore: 120, duration: '120分钟' },
      '数学': { fullScore: 120, duration: '120分钟' },
      '英语': { fullScore: 120, duration: '100分钟' },
      '科学': { fullScore: 160, duration: '120分钟' },
      '道德与法治': { fullScore: 100, duration: '90分钟' },
      '历史': { fullScore: 100, duration: '90分钟' },
    },
  },
  '广东': {
    'middle': {
      '语文': { fullScore: 120, duration: '120分钟' },
      '数学': { fullScore: 120, duration: '90分钟' },
      '英语': { fullScore: 120, duration: '90分钟' },
      '物理': { fullScore: 100, duration: '80分钟' },
      '化学': { fullScore: 100, duration: '80分钟' },
    },
  },
  '山东': {
    'middle': {
      '语文': { fullScore: 120, duration: '120分钟' },
      '数学': { fullScore: 120, duration: '120分钟' },
      '英语': { fullScore: 120, duration: '100分钟' },
      '物理': { fullScore: 100, duration: '90分钟' },
      '化学': { fullScore: 100, duration: '90分钟' },
    },
  },
  '河南': {
    'middle': {
      '语文': { fullScore: 120, duration: '120分钟' },
      '数学': { fullScore: 120, duration: '100分钟' },
      '英语': { fullScore: 120, duration: '100分钟' },
      '物理': { fullScore: 70, duration: '60分钟' },
      '化学': { fullScore: 50, duration: '50分钟' },
      '道德与法治': { fullScore: 100, duration: '60分钟' },
      '历史': { fullScore: 100, duration: '60分钟' },
    },
  },
  '湖北': {
    'middle': {
      '语文': { fullScore: 120, duration: '120分钟' },
      '数学': { fullScore: 120, duration: '120分钟' },
      '英语': { fullScore: 120, duration: '100分钟' },
      '物理': { fullScore: 100, duration: '90分钟' },
      '化学': { fullScore: 100, duration: '90分钟' },
    },
  },
  '湖南': {
    'middle': {
      '语文': { fullScore: 120, duration: '120分钟' },
      '数学': { fullScore: 120, duration: '120分钟' },
      '英语': { fullScore: 120, duration: '100分钟' },
      '物理': { fullScore: 100, duration: '90分钟' },
      '化学': { fullScore: 100, duration: '90分钟' },
    },
  },
  '河北': {
    'middle': {
      '语文': { fullScore: 120, duration: '120分钟' },
      '数学': { fullScore: 120, duration: '120分钟' },
      '英语': { fullScore: 120, duration: '100分钟' },
      '物理': { fullScore: 100, duration: '90分钟' },
      '化学': { fullScore: 100, duration: '90分钟' },
    },
  },
  '辽宁': {
    'middle': {
      '语文': { fullScore: 120, duration: '150分钟' },
      '数学': { fullScore: 120, duration: '120分钟' },
      '英语': { fullScore: 120, duration: '120分钟' },
      '物理': { fullScore: 100, duration: '80分钟' },
      '化学': { fullScore: 100, duration: '60分钟' },
    },
  },
  '天津': {
    'middle': {
      '语文': { fullScore: 120, duration: '120分钟' },
      '数学': { fullScore: 120, duration: '100分钟' },
      '英语': { fullScore: 120, duration: '100分钟' },
      '物理': { fullScore: 100, duration: '60分钟' },
      '化学': { fullScore: 100, duration: '60分钟' },
    },
  },
  '陕西': {
    'middle': {
      '语文': { fullScore: 120, duration: '150分钟' },
      '数学': { fullScore: 120, duration: '120分钟' },
      '英语': { fullScore: 120, duration: '120分钟' },
      '物理': { fullScore: 80, duration: '80分钟' },
      '化学': { fullScore: 60, duration: '60分钟' },
    },
  },
  // 100 分制省市（语数英）
  '北京': {
    'middle': {
      '语文': { fullScore: 100, duration: '150分钟' },
      '数学': { fullScore: 100, duration: '120分钟' },
      '英语': { fullScore: 100, duration: '100分钟' },
      '物理': { fullScore: 80, duration: '90分钟' },
      '化学': { fullScore: 80, duration: '90分钟' },
      '道德与法治': { fullScore: 80, duration: '90分钟' },
      '历史': { fullScore: 80, duration: '90分钟' },
      '生物': { fullScore: 80, duration: '90分钟' },
      '地理': { fullScore: 80, duration: '90分钟' },
    },
  },
  '上海': {
    'middle': {
      '语文': { fullScore: 150, duration: '100分钟' },
      '数学': { fullScore: 150, duration: '100分钟' },
      '英语': { fullScore: 150, duration: '100分钟' },
    },
  },
};

/** 省市下拉选项（生成设置用）——江苏按市拆分（13市各自命题，取代表性城市） */
export const EXAM_REGION_OPTIONS = ['江苏·南京', '江苏·苏州', '江苏·无锡', '江苏·南通', '浙江', '广东', '山东', '北京', '上海', '河南', '四川', '重庆', '福建', '安徽', '湖北', '湖南', '河北', '辽宁', '天津', '陕西'];

/* ══════════ 用户可维护覆盖（蓝图库面板"省市分值"维护，localStorage 持久化，用户版优先） ══════════ */
const REGION_STORAGE_KEY = 'wisdom_region_config_v1';

/** 读取用户省市覆盖（{ region: { stage: { subject: { fullScore, duration } } } }） */
export function loadUserRegionConfig() {
  try {
    return JSON.parse(localStorage.getItem(REGION_STORAGE_KEY) || '{}');
  } catch { return {}; }
}

function saveUserRegionConfig(lib) {
  try { localStorage.setItem(REGION_STORAGE_KEY, JSON.stringify(lib)); } catch {}
}

/** 设置/新增单条省市覆盖（覆盖内置值；与内置相同则等价于覆盖）
 * @param {object} opts
 * @param {Array} [opts.sections] 栏目级覆盖**三态语义**（仅当该省市题型结构确与全国骨架不同时才用）：
 *   · 传数组 → 整组替换该科栏目；
 *   · 传 null → **清空**栏目覆盖（恢复全国骨架，分值仍按覆盖总分比例缩放）；
 *   · 不传（undefined）→ **保持原有栏目覆盖不变**（只改总分/时长时不会误丢栏目——该不变量下沉在此，
 *     避免各调用处各自记忆"要不要带上 sections"，UI 与脚本调用同一语义）。 */
export function setRegionOverride(region, stage, subject, { fullScore = 0, duration = '', sections } = {}) {
  if (!region || !stage || !subject || !fullScore) return false;
  const lib = loadUserRegionConfig();
  if (!lib[region]) lib[region] = {};
  if (!lib[region][stage]) lib[region][stage] = {};
  const existing = Array.isArray(lib[region][stage][subject]?.sections) ? lib[region][stage][subject].sections : [];
  const clean = Array.isArray(sections)
    ? sections
      .filter((s) => s && String(s.name || '').trim() && Number(s.score) > 0)
      .map((s) => ({
        name: String(s.name).trim(),
        score: Number(s.score),
        ...(String(s.note || '').trim() ? { note: String(s.note).trim() } : {}),
      }))
    : (sections === null ? [] : existing);
  lib[region][stage][subject] = {
    fullScore: Number(fullScore),
    duration: duration || undefined,
    ...(clean.length ? { sections: clean } : {}),
  };
  saveUserRegionConfig(lib);
  return true;
}

/** 删除单条省市覆盖（回退内置） */
export function removeRegionOverride(region, stage, subject) {
  const lib = loadUserRegionConfig();
  if (lib[region]?.[stage]?.[subject]) {
    delete lib[region][stage][subject];
    saveUserRegionConfig(lib);
    return true;
  }
  return false;
}

/** 生效配置：内置 + 用户覆盖合并（用户优先）——getExamBlueprint 查询用 */
export function getRegionConfig() {
  const eff = JSON.parse(JSON.stringify(EXAM_REGION_CONFIG));
  const user = loadUserRegionConfig();
  for (const [region, stages] of Object.entries(user)) {
    if (!eff[region]) eff[region] = {};
    for (const [stage, subs] of Object.entries(stages || {})) {
      if (!eff[region][stage]) eff[region][stage] = {};
      for (const [subject, cfg] of Object.entries(subs || {})) {
        if (cfg?.fullScore) {
          eff[region][stage][subject] = {
            fullScore: Number(cfg.fullScore),
            duration: cfg.duration || eff[region][stage][subject]?.duration,
            // 栏目级覆盖随用户配置一并生效（缺省则不写该键 → 沿用蓝本骨架）
            ...(Array.isArray(cfg.sections) && cfg.sections.length ? { sections: cfg.sections } : {}),
          };
        }
      }
    }
  }
  return eff;
}

export default { EXAM_REGION_CONFIG, EXAM_REGION_OPTIONS, loadUserRegionConfig, setRegionOverride, removeRegionOverride, getRegionConfig };
