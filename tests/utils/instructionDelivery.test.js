// 指令送达体检（2026-10-27）：只验"现行分值条在不在、有没有新旧两套并存"
// 断言的依据＝**形态**（块数 / 结构判定句 / 单多两支 / 逐题标分要求 / 旧口径残留），不锁整句措辞。
import { describe, it, expect } from 'vitest';
import { getPromptTemplate } from '../../src/config/promptLibrary.js';
import { inspectScoreClause } from '../../src/utils/instructionDelivery.js';

const current = getPromptTemplate({ grade: 'primary_low', subject: '数学', genType: 'exam' }).template;

const OLD_BLOCK = [
  '【分值标注】',
  '· **号是点名用的**——先看整组：各项有只属于它自己的题干话 ⇒ 带小题号',
  '· **不带小题号（整组都不带）**：分值只写在大题标题括注里',
].join('\n');

describe('分值条送达体检', () => {
  it('现行 cell 模板：送达正常（1 块、结构判定在、旧口径无）', () => {
    const r = inspectScoreClause(current);
    expect(r.blocks, '块数').toBe(1);
    expect(r.present.structure, '结构判定句').toBe(true);
    expect(r.present.singleStem).toBe(true);
    expect(r.present.multiStem).toBe(true);
    expect(r.present.perItemFull, '逐题标分要求').toBe(true);
    expect(r.present.twoPlaces, '版本指纹：标题与题内两处都要有').toBe(true);
    expect(r.legacy, '旧口径不得残留').toEqual([]);
    expect(r.ok, r.verdict).toBe(true);
  });

  it('旧版块（号是点名用的）：判为异常并点名旧口径', () => {
    const r = inspectScoreClause(`【卷首】\n· 占位\n\n${OLD_BLOCK}\n\n【输出格式】\n· 占位`);
    expect(r.ok).toBe(false);
    expect(r.legacy).toContain('号是点名用的');
    expect(r.legacy).toContain('不带小题号（整组都不带）');
    expect(r.present.structure).toBe(false);
  });

  it('新旧两套并存：块数 >1 即判异常（历史"整卷不标分"的形态）', () => {
    const t = `${current}\n\n${OLD_BLOCK}`;
    const r = inspectScoreClause(t);
    expect(r.blocks).toBe(2);
    expect(r.ok).toBe(false);
    expect(r.verdict).toContain('新旧判据并存');
  });

  it('缺块（非 exam 或模板被删）：整块不在即判异常', () => {
    const r = inspectScoreClause('【卷首】\n· 占位\n\n【输出格式】\n· 占位');
    expect(r.blocks).toBe(0);
    expect(r.ok).toBe(false);
    expect(r.verdict).toContain('整块不在');
  });

  it('只认形态、不认措辞：换掉整句措辞但结构在，也算送达', () => {
    const reworded = current
      .replace('遮住大题标题、只看其中一项（标题里的字不算）', '遮住大题标题、只看其中一项（标题不算）')
      .replace('每题题干后必须标', '每题题干后须标');
    const r = inspectScoreClause(reworded);
    expect(r.present.structure, '结构句仍认得出').toBe(true);
    expect(r.present.perItemFull).toBe(true);
    expect(r.ok, r.verdict).toBe(true);
  });
});
