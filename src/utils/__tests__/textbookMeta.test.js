import { describe, it, expect } from 'vitest';
import { autoDetectTextbookMeta } from '../textbookMeta';

/**
 * 教材/模板文件元数据自动识别 —— 回归测试
 * 2026-09 用户实证：小学（1-6）之外，真实库里还有大量**初中**教材，
 * 文件名用圈码⑦⑧⑨ + "年级"（"人教版·数学⑦年级上册"），此前圈码止于⑥、
 * 年级只收 1-6 → 初中 stage/grade 全空、每次导入都要手选。修复后 7-9 归一为初中。
 */
describe('autoDetectTextbookMeta', () => {
  it('小学：圈码①~⑥ + 年级', () => {
    expect(autoDetectTextbookMeta('人教版·数学①年级上册_带书签.pdf')).toMatchObject({
      stage: '小学', grade: '一年级', subject: '数学', semester: '上册',
    });
    expect(autoDetectTextbookMeta('人教PEP版·英语④年级下册_带书签.pdf')).toMatchObject({
      stage: '小学', grade: '四年级', subject: '英语', semester: '下册',
    });
    expect(autoDetectTextbookMeta('人教版·数学⑥年级下册_带书签.pdf')).toMatchObject({
      stage: '小学', grade: '六年级', subject: '数学', semester: '下册',
    });
  });

  it('小学：中文数字 + 年级', () => {
    expect(autoDetectTextbookMeta('六年级语文上册.pdf')).toMatchObject({
      stage: '小学', grade: '六年级', subject: '语文', semester: '上册',
    });
  });

  it('初中：圈码⑦⑧⑨ + 年级（2026-09 修复的核心场景）', () => {
    expect(autoDetectTextbookMeta('人教版·数学⑦年级上册_带书签.pdf')).toMatchObject({
      stage: '初中', grade: '七年级', subject: '数学', semester: '上册',
    });
    expect(autoDetectTextbookMeta('人教版·数学⑧年级下册_带书签.pdf')).toMatchObject({
      stage: '初中', grade: '八年级', subject: '数学', semester: '下册',
    });
    expect(autoDetectTextbookMeta('人教版·数学⑨年级上册_带书签.pdf')).toMatchObject({
      stage: '初中', grade: '九年级', subject: '数学', semester: '上册',
    });
    expect(autoDetectTextbookMeta('人教PEP版·英语⑦年级上册_带书签.pdf')).toMatchObject({
      stage: '初中', grade: '七年级', subject: '英语', semester: '上册',
    });
    expect(autoDetectTextbookMeta('人教·道德与法治⑦年级上册_带书签.pdf')).toMatchObject({
      stage: '初中', grade: '七年级', subject: '道德与法治', semester: '上册',
    });
  });

  it('初中：中文数字 + 年级（含"初中"字面）', () => {
    expect(autoDetectTextbookMeta('初中生物八年级下册.pdf')).toMatchObject({
      stage: '初中', grade: '八年级', subject: '生物', semester: '下册',
    });
  });

  it('高中：认册次、不认年级（设计保持）', () => {
    expect(autoDetectTextbookMeta('高中数学必修第一册_带书签.pdf')).toMatchObject({
      stage: '高中', grade: '', volume: '必修1', subject: '数学', semester: '',
    });
    // 高中即便文件名带年级样式也不猜年级
    expect(autoDetectTextbookMeta('思想政治选择性必修2 哲学与文化.pdf')).toMatchObject({
      stage: '高中', grade: '', volume: '选择性必修2', subject: '思想政治', semester: '',
    });
  });

  it('学科旧名映射为新课标规范名', () => {
    expect(autoDetectTextbookMeta('人教版·政治①年级上册.pdf').subject).toBe('道德与法治');
    expect(autoDetectTextbookMeta('信息技术①年级上册.pdf').subject).toBe('信息科技');
  });

  it('无年级标识时 stage/grade 留空（不做猜测，由用户界面补全）', () => {
    const r = autoDetectTextbookMeta('综合实践活动手册.pdf');
    expect(r.stage).toBe('');
    expect(r.grade).toBe('');
  });

  it('高中学段字面也识别为高中（册次留空由界面补）', () => {
    expect(autoDetectTextbookMeta('习近平新时代中国特色社会主义思想学生读本·高中_带书签.pdf')).toMatchObject({
      stage: '高中', subject: '', // 学科未登记，仅学段兜底
    });
  });
});