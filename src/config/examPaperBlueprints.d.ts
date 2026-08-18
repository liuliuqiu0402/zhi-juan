/**
 * examPaperBlueprints.js 的 TypeScript 声明
 * 说明：蓝本库以纯 JS 实现（供 node 脚本与前端共用），此处提供类型签名供 TS 引用。
 */
export interface ExamSection {
  name: string;
  score: number;
  note: string;
}

export interface ExamBlueprint {
  label: string;
  fullScore: number;
  duration: string;
  sections: ExamSection[];
  /** getExamBlueprint 返回时附加的蓝本 key（学科|学段） */
  key?: string;
  /** getExamBlueprint 返回时附加的标准化学科名 */
  subject?: string;
  /** getExamBlueprint 返回时附加的查询学段（联合别名后） */
  stage?: string;
}

export const EXAM_BLUEPRINTS: Record<string, ExamBlueprint>;
export const EXAM_PAPER_LAYOUT: string;
export const EXAM_NEW_STANDARD: string;
export const EXAM_STAGE_STANDARDS: Record<string, string>;
export const EXAM_STAGE_LABELS: Record<string, string>;
export const EXAM_SUBJECT_STANDARDS: Record<string, string>;

export function getExamBlueprint(
  subject: string,
  stage: string
): (ExamBlueprint & { key: string; subject: string }) | null;

export function buildExamBlueprintText(bp: ExamBlueprint): string;

declare const _default: {
  EXAM_BLUEPRINTS: typeof EXAM_BLUEPRINTS;
  EXAM_PAPER_LAYOUT: string;
  EXAM_NEW_STANDARD: string;
  EXAM_STAGE_STANDARDS: typeof EXAM_STAGE_STANDARDS;
  EXAM_STAGE_LABELS: typeof EXAM_STAGE_LABELS;
  EXAM_SUBJECT_STANDARDS: typeof EXAM_SUBJECT_STANDARDS;
  getExamBlueprint: typeof getExamBlueprint;
  buildExamBlueprintText: typeof buildExamBlueprintText;
};
export default _default;
