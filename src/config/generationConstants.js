/**
 * 生成链路阈值常量（集中管理，避免散落硬编码）
 * ============================================================
 * 定位：超时/温度/输出预算属"可调设置"，走 generationSettings（设置页可改）；
 *      本文件集中"业务判定阈值"——与用户配置无关或不宜暴露的启发式数字，
 *      集中在此便于统一评审、调整与维护。
 * ============================================================
 */
export const GEN_CONST = Object.freeze({
  // ── 推理/思考止损 ──
  REASONING_CAP_BODY: 40000,          // 整卷正文思考流式上限（chunks，防失控白付）
  REASONING_CAP_ANSWER: 20000,        // 答案页思考流式上限（chunks）
  REASONING_EXHAUST_THRESHOLD: 20000, // 判定"思考耗尽"的最小推理 chunks（触发关闭思考重试）
  // 🔴 未开思考时的"防御性"推理上限：智谱/火山等引擎可能无视思考开关强制推理，
  //    推理 token 与正文共享 max_tokens——不设上限会被推理吃光预算导致输出为空（"无答案页"根因）。
  //    未开思考也始终设上限，推理一旦超限即中断并强制关思考重试。
  REASONING_CAP_BODY_FORCED: 10000,   // 未开思考：正文推理防御上限
  REASONING_CAP_ANSWER_FORCED: 5000,  // 未开思考：答案页推理防御上限

  // ── 截断/续写判定 ──
  TRUNCATED_MIN_LEN: 10,              // finish=length/reasoning_capped 且输出>此值才续写
  CONT_ACCEPT_MIN_LEN: 5,             // 续写内容>此值才接受
  CONT_REJECT_MIN_LEN: 3,             // 续写内容<此值放弃
  DEDUP_TAIL_EXACT: 20,               // 续写去重：精确匹配末尾 N 字
  DEDUP_OVERLAP_MAX: 15,              // 渐进去重起始长度（向下递减）
  DEDUP_OVERLAP_MIN: 3,               // 渐进去重最小长度
  DEDUP_NEWLINE_MIN: 30,              // 无重叠时取换行后内容需>此值
  CONTINUE_TAIL_SAMPLE: 300,          // 续写提示取上一段末尾 N 字符

  // ── 正文/答案有效性 ──
  BODY_VALID_MIN_LEN: 200,            // 整卷正文有效判定（<此值视为失败）
  BODY_TRUNCATED_HEURISTIC: 500,      // 尾部启发式截断判定最小长度
  TRUNCATED_TAIL_SAMPLE: 120,         // 截断判定取末尾 N 字符
  ANSWER_ACCEPT_MIN_LEN: 100,         // 答案页接受阈值（<此值判失败并重试）

  // ── 上下文裁剪 ──
  MATERIAL_CHARS: {                   // 素材注入量（按资料类型，RAG 分级限量；期末/整本书等大范围场景会截断，见 buildMaterialBlock 检索覆盖）
    exam: 10000, practice: 6000, special: 5000, reading: 6000, summary: 8000, review: 8000,
    preview: 3000, dictation: 3000, errorbook: 2000,
  },

  // ── OCR/原文质量判定（GenerateModule 等） ──
  OCR_FAIL_MIN_TEXT: 10,              // 原文<10 → 提取失败
  OCR_POOR_MIN_TEXT: 20,              // 原文<20 → 质量差
  OCR_POOR_STRICT_MIN: 30,            // 原文<30 → 疑似低质
  OCR_WARN_MIN_TEXT: 50,              // 原文<50 → 警告
  OCR_WARN_MIN_TEXT_200: 200,         // 原文<200 → 质量警告
  COL_MIN_TEXT: 200,                  // 分栏文本下限
  IMAGE_MIN_BASE64: 100,              // 图片 base64 最小长度
});
