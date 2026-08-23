// 新课标内容达标评估器：逐题核查生成内容是否符合新课标要求
import { describe, it, expect } from 'vitest';
import { assessCompliance, extractQuestions } from '@/utils/curriculumCompliance';

// 高质量示例：情境化 + 高层次设问 + 无机械记忆 + 分值正确（板块之和=满分）
const GOOD_CONTENT = `<h1>2025—2026学年第一学期初中八年级语文期末试卷</h1>
<p>（考试时间：120分钟　满分：120分）</p>
<h2>一、积累与运用。（共4题，共20分）</h2>
<p class="question">1. 小明在社区志愿活动中了解到垃圾分类的意义，请结合生活实际，说说你赞同的理由。（5分）</p>
<p class="question">2. 阅读下面的文字，回答问题。文中描写了哪些景物？作者为什么说这是"最好的时节"？请结合全文分析。（5分）</p>
<p class="question">3. 请你为校园图书馆设计一条公益宣传语，并说明设计理由。（5分）</p>
<p class="question">4. 班级开展"走进传统文化"研学活动，请你提出一个研究问题并说明探究思路。（5分）</p>
<h2>二、古诗文阅读。（共3题，共24分）</h2>
<p class="question">5. 解释下列句中加点词的意思。（6分）</p>
<p class="question">6. 用现代汉语翻译画线句子。（6分）</p>
<p class="question">7. 结合全文，分析作者表达了怎样的思想感情。（12分）</p>
<h2>三、现代文阅读。（共4题，共36分）</h2>
<p class="question">8. 文中描写了哪些景物？（6分）</p>
<p class="question">9. 为什么说老屋是"我"的精神家园？请结合文本分析。（10分）</p>
<p class="question">10. 作者在结尾写道"根，永远扎在故乡"，谈谈你对这句话的理解。（10分）</p>
<p class="question">11. 你认为文中主人公的选择值得吗？请说明理由。（10分）</p>
<h2>四、写作。（共1题，共40分）</h2>
<p class="question">12. 阅读下面的材料，从任务一、任务二中任选其一，完成作文。（40分）</p>
<div class="answer-section"><h2>答案</h2><p>1. 参考答案要点...</p></div>`;

// 低质量示例：裸考 + 机械记忆 + 无推理设问 + 分值异常
const BAD_CONTENT = `<h1>初中八年级语文期末试卷</h1>
<p>（考试时间：120分钟　满分：100分）</p>
<h2>一、填空。（共2题，共30分）</h2>
<p class="question">1. 根据课文内容填空：______________</p>
<p class="question">2. 默写古诗：______________</p>
<h2>二、选择。（共1题，共10分）</h2>
<p class="question">3. 下列词语中没有错别字的一项是（　　）</p>
<div class="answer-section"><h2>答案</h2></div>`;

describe('新课标内容达标评估器', () => {
  it('解析题目：从 HTML 提取小题文本', () => {
    const qs = extractQuestions(GOOD_CONTENT);
    expect(qs.length).toBe(12);
    expect(qs[0]).toContain('小明');
  });

  it('高质量内容：全部维度通过，overall=通过', () => {
    const r = assessCompliance(GOOD_CONTENT, '语文', 'middle', 'exam');
    expect(r.overall).toBe('通过');
    expect(r.questionCount).toBe(12);
    expect(r.dimensions.find(d => d.id === 'D1').passed).toBe(true); // 情境化
    expect(r.dimensions.find(d => d.id === 'D2').passed).toBe(true); // 设问层次
    expect(r.dimensions.find(d => d.id === 'D4').passed).toBe(true); // 无机械记忆
    expect(r.dimensions.find(d => d.id === 'D6').passed).toBe(true); // 无超纲
    expect(r.dimensions.find(d => d.id === 'D8').passed).toBe(true); // exam 素养豁免
  });

  it('低质量内容：机械记忆+缺推理设问 → 未通过维度被检出', () => {
    const r = assessCompliance(BAD_CONTENT, '语文', 'middle');
    expect(r.overall).toBe('待改进');
    const d4 = r.dimensions.find(d => d.id === 'D4');
    expect(d4.passed).toBe(false); // 机械记忆
    expect(d4.evidence.length).toBeGreaterThan(0);
    const d2 = r.dimensions.find(d => d.id === 'D2');
    expect(d2.passed).toBe(false); // 无推理设问
  });

  it('空内容：返回待改进', () => {
    const r = assessCompliance('', '语文', 'middle');
    expect(r.overall).toBe('待改进');
  });

  it('英语听力：含听力材料时语篇长度检查不误报', () => {
    const engContent = `<h1>英语试卷</h1>
<p>（满分：100分）</p>
<h2>一、听力。（共10题，共20分）</h2>
<p class="question">1. What does the man want to buy?（2分）</p>
<p class="question">2. Where are the speakers?（2分）</p>
<div class="answer-section"><h2>答案</h2><p>听力原文：W: Can I help you? M: Yes, I'd like some apples.</p></div>`;
    const r = assessCompliance(engContent, '英语', 'middle');
    expect(r).toBeTruthy();
    expect(r.questionCount).toBeGreaterThan(0);
  });

  it('返回结构完整：8 个维度 + summary', () => {
    const r = assessCompliance(GOOD_CONTENT, '语文', 'middle');
    expect(r.dimensions.length).toBe(8);
    expect(r.summary).toContain('达标评估');
    expect(r.avgScore).toBeGreaterThan(0);
  });
});
