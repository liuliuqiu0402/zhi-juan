/**
 * 各省市中高考考试时长/总分配置（代表值，供出卷系统取值）
 * ── 取值规则 ──
 * 1. 生成时用户选择省市 → 查本表（region × stage × subject）→ 命中则覆盖蓝本默认 fullScore/duration
 * 2. 大题分值分配：按"新总分 ÷ 蓝本默认总分"等比例缩放题型骨架各板块分值，末板块修正保证各板块之和精确=新总分
 * 3. 未列出的省市/学段/学科 → 回退蓝本全国通行默认（中考语数英120分制等）
 * 4. 高考（高中）全国统一 3+1+2 结构（语数英150分、选考100分/75分钟），蓝本已精确对齐，无需省市覆盖
 * 5. 表中为各省代表值（省内各地市略有差异，此处取通行口径），数值可随政策调整
 */
export const EXAM_REGION_CONFIG = {
  // ══════════ 中考（初中） ══════════
  // 150 分制省市（语数英）
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

/** 省市下拉选项（生成设置用） */
export const EXAM_REGION_OPTIONS = ['江苏', '浙江', '广东', '山东', '北京', '上海', '河南', '四川', '重庆', '福建', '安徽', '湖北', '湖南', '河北', '辽宁', '天津', '陕西'];

export default { EXAM_REGION_CONFIG, EXAM_REGION_OPTIONS };
