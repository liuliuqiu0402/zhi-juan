/**
 * 生成流程控制器（复位工程·阶段 2/3 界面层状态机）
 * ============================================================
 * 定位：GenerateModule 的三步按钮流（勾选 → 充分了解素材 → 下一步生成 → 出稿）背后的流程控制，
 *   引擎对话能力由宿主注入（真实链路=应用内引擎；测试=伪引擎），本模块不持有引擎实现。
 * 流程（角色合一说，程序只推进对话与供料，不验收）：
 *   idle --[开始研读]--> studying --[批摘要全部校验通过]--> ready --[追加委托书并写作]--> writing --[成稿]--> delivered
 *   studying --[缺料/校验失败]--> 停留 studying（补料/重读），need_material 提示由宿主展示
 * ============================================================
 */
import { createGenerationSession, appendMessage, requestTransition } from '../utils/generationSession.js';
import { buildStudyUnits, runStudyRound, ledgerToText } from '../utils/studyOrchestrator.js';

export function createFlowController({ meta = {}, digestProvider, onDeliver } = {}) {
  const session = createGenerationSession({ meta });
  return {
    session,
    state: { phase: 'idle', busy: false, ledger: null, ledgerText: '', error: null, report: null },

    /** 开始研读：由调用方给锚与课标映射；digestProvider(消息) → 模型笔记文本。 */
    async startStudy({ anchors = [], curriculumByName = null, maxCharsPerBatch = 2500 } = {}) {
      const s = this.state;
      if (s.phase !== 'idle' && s.phase !== 'studying') {
        return { ok: false, error: `当前阶段（${s.phase}）不可开始研读` };
      }
      if (!digestProvider) return { ok: false, error: '未提供研读对话能力（digestProvider）' };
      s.phase = 'studying';
      s.busy = true;
      s.error = null;
      try {
        requestTransition(session, 'studying');
        const units = buildStudyUnits({ anchors, curriculumByName });
        if (!units.length) {
          s.busy = false;
          requestTransition(session, 'need_material');
          s.error = '本次覆盖范围无可研读锚（可能缺料），请检查勾选范围或补料后重试。';
          return { ok: false, error: s.error };
        }
        const r = await runStudyRound({
          units,
          session,
          maxCharsPerBatch,
          digestFns: { produce: async (msg) => digestProvider(msg) },
        });
        s.report = r.report;
        if (!r.ok) {
          s.error = '研读笔记校验未通过（缺理解/引用无源/点名越界），该批需重读。';
          return { ok: false, error: s.error, report: r.report };
        }
        s.ledger = r.ledger;
        s.ledgerText = ledgerToText(r.ledger);
        requestTransition(session, 'ready');
        s.phase = 'ready';
        s.busy = false;
        return { ok: true, units: units.length, report: r.report };
      } catch (e) {
        s.busy = false;
        s.error = String((e && e.message) || e);
        return { ok: false, error: s.error };
      }
    },

    /** 下一步（委托轮）：把委托书作为一条新消息追加，之后写作与成稿由宿主执行。 */
    commission(instructionText) {
      const s = this.state;
      if (s.phase !== 'ready') return { ok: false, error: `当前阶段（${s.phase}）不可追加委托书` };
      const msg = appendMessage(session, { role: 'user', content: String(instructionText || ''), compressible: false, kind: 'user' });
      requestTransition(session, 'writing');
      s.phase = 'writing';
      return { ok: true, messageId: msg.id };
    },

    /** 成稿回调（宿主在写作完成后调用；程序只推进状态，不验收内容）。 */
    deliver() {
      const s = this.state;
      if (s.phase !== 'writing') return { ok: false, error: `当前阶段（${s.phase}）不可标记成稿` };
      requestTransition(session, 'delivered');
      s.phase = 'delivered';
      if (typeof onDeliver === 'function') onDeliver(session);
      return { ok: true };
    },
  };
}
