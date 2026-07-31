import { ref } from 'vue';
import axios from 'axios';
import { apiConfig, getCurrentEngineConfig, getCurrentEngineConfigEnhanced, getMultimodalConfig } from '../config/apiConfig.js';
import { getStoragePath } from '../utils/pathHelper.js';
import { 
  styleInstructions, 
  genTypeTemplates,
  normalizeSubjectName,
  correctCognitiveLevel,
  allowedCognitiveLevels,
  checkKnowledgeBoundary,
  getTerminologyHint,
  normalizeTerminology
} from '../config/expertKnowledge.js';
import { getMatchingBlockInstructions } from '../config/instructionLib.js';
import { getContextsForSubject } from '../config/subjectContextLibrary.js';
import { HardRuleChecker } from '../utils/qualityChecker';
import { runHardValidators, applyAutoFixes } from '../utils/subjectValidators.js';
import { registerController, unregisterController } from '../utils/requestManager.js';

// ===== 鎻愬彇鐨勭嫭绔嬪伐鍏锋ā鍧?=====
import { getModelDisplayName, robustJsonParse } from '../utils/jsonParser.js';
import { splitTextIntoSegments, findRelatedSegments, buildGradedMaterialContext } from '../utils/textSegmenter.js';

// ============================================================
// 馃敡 浜旀鐢熸垚娉曞伐鍏峰嚱鏁帮細鍒嗗眰娉ㄥ叆 + 绮惧噯妫€绱?+ 鏍煎紡甯搁噺
// ============================================================

/**
 * Step1 鎸囦护绮剧畝鍑芥暟锛氫粠鐢ㄦ埛鍙鐨勫畬鏁存寚浠や腑鎻愬彇 AI 闇€瑕佺殑鍏抽敭绾︽潫
 * 浜鸿鐗?instruction锛垀3000瀛楋級鈫?AI 绮剧畝鐗堬紙鈮?00瀛楋級
 * 鍙繚鐣欙細鏍稿績浠诲姟銆佺粨鏋勬鏋躲€佺姝㈤」銆佹牸寮忓叧閿偣
 */
const buildCompactAIInstruction = (fullInstruction, genType, subject, stage, grade) => {
  if (!fullInstruction) return '';
  
  // 鎸夈€愬垎娈垫爣璁般€戞彁鍙栧叧閿钀?
  const sections = fullInstruction.split(/\n(?=銆?/);
  const keepSections = [];
  const dropPrefixes = [
    '銆愭ā鏉跨簿鍑嗗鏍囥€?, '銆愭ā鏉跨湡棰樼ず渚嬨€?, '銆愭ā鏉块噺鍖栫壒寰併€?,
    '銆愮敤鎴疯ˉ鍏呮寚浠ゃ€?, '銆愮患鍚堟寚浠ゃ€?, '銆愭儏澧冭姹傘€?
  ];
  
  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed) continue;
    // 璺宠繃妯℃澘瀵规爣绛夊ぇ娈靛唴瀹?
    if (dropPrefixes.some(p => trimmed.startsWith(p))) continue;
    // 淇濈暀鏍稿績鍧楋紝浣嗛檺鍒堕暱搴?
    let content = trimmed;
    if (content.length > 600) {
      // 鎴柇闀挎锛屽彧淇濈暀鍓?500 瀛?+ "...(鐪佺暐)"
      content = content.substring(0, 500) + '...(宸茬簿绠€)';
    }
    keepSections.push(content);
  }
  
  let compact = keepSections.join('\n');
  // 濡傛灉浠嶇劧瓒呴暱锛屼簩杞埅鏂?
  if (compact.length > 1500) {
    compact = compact.substring(0, 1500) + '\n...(鍚庣画鎸囦护宸茬簿绠€)';
  }
  
  return compact ? `銆愬叧閿寚浠ゆ憳瑕併€慭n${compact}\n` : '';
};

/**
 * 钃濆浘椹卞姩鐨勭簿鍑嗘绱細鏍规嵁 Step3 钃濆浘鐨勭煡璇嗙偣鍒楄〃锛屼粠 contentCards 涓绱㈠尮閰嶇殑鍘熸枃娈佃惤
 * 鏇夸唬鍘熸潵鐨?鍏ㄩ噺鎺掑簭鎴柇 2500 瀛?锛屽彧浼犺摑鍥捐鐩栫殑鐭ヨ瘑鐐瑰搴旂殑鍘熸枃
 */
const retrieveBlueprintSegments = (contentCards, parsedBlueprint, maxChars = 1500) => {
  if (!contentCards?.length) return '';
  
  // 馃敡 浠庤摑鍥句腑鎻愬彇鐭ヨ瘑鐐瑰叧閿瘝 + 閫愯瘝鍒嗚В鐢ㄤ簬澶氱骇鍖归厤
  const bpKeywords = new Set();
  const bpWordSet = new Set();  // 閫愯瘝鍒嗚В锛岀敤浜庢ā绯婂尮閰?
  if (parsedBlueprint?.length) {
    for (const bp of parsedBlueprint) {
      if (bp.knowledgePoint) {
        bpKeywords.add(bp.knowledgePoint);
        // 馃敡 閫愯瘝鍒嗚В锛?鍚屽垎姣嶅垎鏁板姞鍑忔硶" 鈫?["鍚屽垎姣?, "鍒嗘暟", "鍔犲噺娉?]
        const words = bp.knowledgePoint.split(/[锛?銆乗s]+/).filter(w => w.length >= 2);
        words.forEach(w => bpWordSet.add(w));
      }
    }
  }
  
  // 馃敡 鎺ㄦ柇瀛︾锛堜粠 contentCards 鐨勭珷鑺傛爣棰樻帹鏂紝鐢ㄤ簬瀛︾鎰熺煡鍖归厤锛?
  const allChapterTitles = contentCards.map(c => c.chapterTitle || '').join(' ');
  const isEnglishBook = /鑻辫|english|PEP/i.test(allChapterTitles) || contentCards.some(c => (c.tags || []).some(t => /[a-zA-Z]{3,}/.test(t)));
  const isChineseBook = /璇枃|璇炬枃|鐢熷瓧/i.test(allChapterTitles);
  const isMathBook = /鏁板|math/i.test(allChapterTitles);
  
  // 馃敡 涓よ疆鏀堕泦锛氱壒娈婃钀斤紙璇嶆眹琛?鐢熷瓧琛ㄧ瓑蹇呰€冨唴瀹癸級+ 甯歌娈佃惤
  const specialSegments = [];   // 璇嶆眹琛ㄣ€佺敓瀛楄〃銆侀攣瀹氬唴瀹光€斺€斿繀椤讳紭鍏堣繑鍥?
  const regularSegments = [];
  
  for (const card of contentCards) {
    if (!card.segments) continue;
    for (const seg of card.segments) {
      const segType = (seg.type || '').toString();
      // 馃敡 璇嗗埆鐗规畩娈佃惤锛氳瘝姹囪〃銆佺敓瀛楄〃銆佸皬缁撯€斺€旇繖浜涙槸蹇呰€冨唴瀹癸紝蹇呴』100%杩斿洖
      const isSpecial = segType === '璇嶆眹琛? || segType === '鐢熷瓧琛?
        || segType.includes('璇嶆眹') || segType.includes('鐢熷瓧');
      const isSummary = segType === '灏忕粨' || segType.includes('灏忕粨') || segType.includes('鎬荤粨');
      
      const segKps = seg.knowledgePoints || [];
      
      // 馃敡 澶氱骇鍖归厤绛栫暐锛堜笉鍐嶅彧鐢ㄧ畝鍗?includes锛?
      let matchScore = 0;
      for (const kp of segKps) {
        // 绛栫暐1锛氱簿纭煡璇嗙偣鍚嶇О鍖归厤锛堟潈閲?2锛?
        for (const bk of bpKeywords) {
          if (kp === bk) { matchScore += 3; break; }          // 瀹屽叏鍖归厤
          if (kp.includes(bk) || bk.includes(kp)) { matchScore += 2; break; }  // 閮ㄥ垎鍖归厤
        }
        // 绛栫暐2锛氶€愯瘝閲嶅彔鍖归厤锛堟潈閲?1锛?
        const kpWords = kp.split(/[锛?銆乗s]+/).filter(w => w.length >= 2);
        const overlapCount = kpWords.filter(w => bpWordSet.has(w)).length;
        if (overlapCount > 0) matchScore += Math.min(overlapCount, 3);
      }
      
      // 绛栫暐3锛氬绉戞劅鐭ョ殑绫诲瀷鍖归厤
      if (isEnglishBook && segType.includes('璇嶆眹')) matchScore += 2;  // 鑻辫璇嶆眹琛ㄦ棤鏉′欢鍔犲垎
      if (isChineseBook && segType.includes('鐢熷瓧')) matchScore += 2;  // 璇枃鐢熷瓧琛ㄦ棤鏉′欢鍔犲垎
      if (isMathBook && segType === '渚嬮') matchScore += 1;           // 鏁板渚嬮鍔犲垎
      
      // isKeyConcept 鍔犳潈
      if (seg.isKeyConcept) matchScore += 1;
      if (seg.isExample) matchScore += 1;
      
      const item = {
        chapterTitle: card.chapterTitle,
        text: seg.text,
        segType,
        matchScore,
        isSpecial,
        isSummary
      };
      
      if (isSpecial) {
        specialSegments.push(item);
      }
      regularSegments.push(item);
    }
  }
  
  // 馃敡 棰勭畻鍒嗗尯锛氱壒娈婃钀藉崰60%锛堣瘝姹囪〃/鐢熷瓧琛ㄤ紭鍏堬級锛屽父瑙勫尮閰嶆钀藉崰40%
  const SPECIAL_BUDGET = Math.floor(maxChars * 0.6);
  let result = '';
  let used = 0;
  
  // 绗竴杞細鐗规畩娈佃惤锛堣瘝姹囪〃銆佺敓瀛楄〃锛夊缁堜紭鍏堣繑鍥烇紝甯︾被鍨嬫爣娉?
  for (const seg of specialSegments) {
    if (used + seg.text.length > SPECIAL_BUDGET) break;
    const label = seg.segType ? ` [${seg.segType}]` : '';
    result += `銆?{seg.chapterTitle}${label}銆?{seg.text}\n`;
    used += seg.text.length;
  }
  
  // 绗簩杞細甯歌娈佃惤鎸夊尮閰嶅害鎺掑簭濉厖
  const remainingBudget = maxChars - used;
  if (remainingBudget > 0) {
    regularSegments.sort((a, b) => b.matchScore - a.matchScore);
    let regularUsed = 0;
    let hasMatch = false;
    for (const seg of regularSegments) {
      if (regularUsed + seg.text.length > remainingBudget) break;
      if (seg.matchScore > 0) hasMatch = true;
      // 鏃犲尮閰嶅皬缁撳熬娉ㄤ紭鍏堜繚鐣欙紝鏅€氭棤鍖归厤娈佃惤闄愬埗涓嶈秴杩囧墿浣欓绠楃殑30%
      if (seg.matchScore === 0 && !seg.isSummary && regularUsed > remainingBudget * 0.3 && hasMatch) break;
      if (seg.matchScore === 0 && !seg.isSummary && regularUsed > remainingBudget * 0.5) break;
      // 璺宠繃宸插湪鐗规畩娈佃惤涓繑鍥炵殑鐗囨
      if (seg.isSpecial && used > 0) continue; // 宸插湪绗竴杞鐞?
      const label = seg.segType ? ` [${seg.segType}]` : '';
      result += `銆?{seg.chapterTitle}${label}銆?{seg.text}\n`;
      regularUsed += seg.text.length;
    }
  }
  
  // 馃敡 鍥為€€锛氬鏋滄病鏈変换浣曞尮閰嶏紝杩斿洖鍓?maxChars 鐨勫師鏂囩墖娈?
  if (!result && regularSegments.length > 0) {
    let fallback = '';
    let fallbackUsed = 0;
    for (const seg of regularSegments) {
      if (fallbackUsed + seg.text.length > maxChars) break;
      fallback += `銆?{seg.chapterTitle}銆?{seg.text}\n`;
      fallbackUsed += seg.text.length;
    }
    return fallback;
  }
  
  return result;
};

// ==================== 骞寸骇鏁板瓧鎻愬彇宸ュ叿 ====================
// 馃攽 grade 鍙兘鏄腑鏂囷紙"涓夊勾绾?锛夋垨鏁板瓧锛岀粺涓€鎻愬彇鏁板瓧
const extractGradeNum = (gradeStr) => {
  if (!gradeStr) return 0;
  const num = parseInt(gradeStr);
  if (!isNaN(num)) return num;
  const cnMap = { '涓€':1,'浜?:2,'涓?:3,'鍥?:4,'浜?:5,'鍏?:6,'涓?:7,'鍏?:8,'涔?:9 };
  for (const [cn, n] of Object.entries(cnMap)) {
    if (gradeStr.includes(cn)) return gradeStr.startsWith('楂?) ? 9 + n : n;
  }
  return 0;
};

/**
 * genType 鏍煎紡瑙勮寖甯搁噺锛氭瘡绉嶈祫鏂欑被鍨嬬殑鍥哄畾鏍煎紡瑕佹眰锛屼笉渚濊禆 Step1 鐨勫ぇ娈?instruction
 */
const GEN_TYPE_FORMAT_SPEC = {
  preview: (subject, stage, grade) => {
    const gNum = extractGradeNum(grade);
    const isLower = stage === 'primary' && gNum <= 2;
    const isChinese = subject === '璇枃';
    return [
      '- 澶ф爣棰樼敤<h1>锛屽涔犵洰鏍囩敤<h2>',
      '- 棰勪範妫€娴嬮鐩暀绌猴紝绛旀缁熶竴鏀炬枃鏈?div class="answer-section">涓?,
      (isLower && isChinese) ? '- 浣庢锛氱敓瀛楃敤<span class="tian-zi-ge">瀛?/span>锛岄厤<ruby>姹夊瓧<rt>鎷奸煶</rt></ruby>' : '',
      (isLower && isChinese) ? '- 閰嶆儏澧冨浘锛歔IMAGE] TYPE:SD PROMPT:鎻忚堪 STYLE:cartoon [/IMAGE]锛屽崟鐙垚琛? : '',
      '- 鐩存帴杩斿洖HTML鐗囨锛屼笉瑕佺敤<html>銆?head>銆?body>鎴朻``html鍖呰９'
    ].filter(Boolean).join('\n');
  },
  dictation: (subject, stage) => {
    // 馃敡 浠庢寚浠ゅ簱鑾峰彇鍚啓杈撳嚭鏍煎紡锛堜紭鍏堬級锛屽厹搴曚繚鐣欑‖缂栫爜
    const formatBlocks = getMatchingBlockInstructions({ category: '生成-输出格式', genType: 'dictation' });
    const baseFormat = formatBlocks.length > 0 ? formatBlocks[0].content : [
      '- 澶ф爣棰樼敤<h1>锛屾寜瀛楄瘝/鍙ュ瓙/娈佃惤鍒嗚妭鐢?h2>',
      '- 姣忎釜鍚啓椤圭敤<div class="dictation-item">鍖呰９',
      '- 缁冧範鍖猴細搴忓彿+鎻愮ず锛堟嫾闊?閲婁箟锛?鐣欑┖涔﹀啓鍖猴紙涓嶅啓绛旀锛侊級',
      '- 绛旀鍖猴細鏍囧噯绛旀闆嗕腑鏀炬枃鏈?div class="answer-section">涓?,
      '- 鐣欑┖瀹藉害瑕佽冻澶熷鐢熸墜鍐欙紝鑷冲皯2-3涓叏瑙掑瓧绗﹀',
      '- 鐩存帴杩斿洖HTML鐗囨锛屼笉瑕佺敤<html>銆?head>銆?body>鎴朻``html鍖呰９'
    ].join('\n');
    // 瀛︾/瀛︽鐗规畩琛ュ厖
    const extras = [
      subject === '璇枃' && stage === 'primary' ? '- 鐣欑┖涔﹀啓鍖虹敤<span class="tian-zi-ge">&emsp;</span>锛堢敯瀛楁牸绌虹櫧锛? : '',
      subject === '鑻辫' && stage === 'primary' ? '- 鐣欑┖涔﹀啓鍖虹敤<span class="four-line-three english-line">&emsp;</span>锛堝洓绾夸笁鏍肩┖鐧斤級' : '',
    ].filter(Boolean).join('\n');
    return extras ? baseFormat + '\n' + extras : baseFormat;
  },
  reading: () => {
    // 馃敡 浠庢寚浠ゅ簱鑾峰彇闃呰璁粌杈撳嚭鏍煎紡锛堜紭鍏堬級锛屽厹搴曚繚鐣欑‖缂栫爜
    const formatBlocks = getMatchingBlockInstructions({ category: '生成-输出格式', genType: 'reading' });
    if (formatBlocks.length > 0) return formatBlocks[0].content;
    return [
      '- 澶ф爣棰樼敤<h1>锛岀煭鏂囩敤<div class="reading-passage">鍖呰９',
      '- 棰樼洰鐢?ol>鏈夊簭鍒楄〃锛岄€夋嫨棰橀€夐」鐢?p class="option">',
      '- 鍙傝€冪瓟妗堢粺涓€鏀炬枃鏈?div class="answer-section">涓?,
      '- 鐩存帴杩斿洖HTML鐗囨锛屼笉瑕佺敤<html>銆?head>銆?body>鎴朻``html鍖呰９'
    ].join('\n');
  },
  summary: () => [
    '- 澶ф爣棰樼敤<h1>锛屽皬鑺傜敤<h2>锛屽瓙鏍囬鐢?h3>',
    '- 琛ㄦ牸鐢?table>锛屽叧閿瘝鐢?strong>',
    '- 瓒ｅ懗灏忕粌涔犻鐩爣棰樼暀绌猴紝绛旀鏀炬枃鏈?div class="answer-section">涓?,
    '- 鐩存帴杩斿洖HTML鐗囨锛屼笉瑕佺敤<html>銆?head>銆?body>鎴朻``html鍖呰９'
  ].join('\n'),
  exam: () => [
    '- 澶ф爣棰樼敤<h1>锛岄鍨嬫爣棰樼敤<h2>锛岄骞茬敤<p class="question">',
    '- 閫夋嫨棰橀€夐」鐢?p class="option">锛屽～绌虹敤<u class="blank-N">&emsp;</u>锛屼弗绂佺敤___涓嬪垝绾夸唬鏇?,
    '- 绛旀鍜岃В鏋愮粺涓€鏀炬枃鏈?div class="answer-section">涓?,
    '- 鐩存帴杩斿洖HTML鐗囨锛屼笉瑕佺敤<html>銆?head>銆?body>鎴朻``html鍖呰９'
  ].join('\n'),
  errorbook: () => [
    '- 閿欓鐢?div class="error-item">鍖呰９锛岄鍙风敤<h3>',
    '- 閿欒褰掑洜鐢?div class="error-reason">锛屾瑙ｇ敤<div class="correct-solution">',
    '- 鍙樺紡宸╁浐鐢?div class="variant-practice">',
    '- 鐩存帴杩斿洖HTML鐗囨锛屼笉瑕佺敤<html>銆?head>銆?body>鎴朻``html鍖呰９'
  ].join('\n')
};
import { postProcessOCR, _fixTemplateOptionGlue as fixTemplateOptionGlue, countFixes, _addTemplateStructureMarkers as addTemplateStructureMarkers } from '../utils/textRepair.js';
import { SemanticRetriever, semanticRetriever } from '../utils/semanticRetriever.js';

// 鍒悕锛氫繚鎸佸師鏈夊悕绉板吋瀹?
const _isWordBoundaryMatch = undefined; /* replaced by isWordBoundaryMatch import */
const _fixTemplateOptionGlue = fixTemplateOptionGlue;
const _countFixes = countFixes;
const _robustJsonParse = robustJsonParse;
const _addTemplateStructureMarkers = addTemplateStructureMarkers;

//  鐭ヨ瘑鐐硅鐩栫巼鏍￠獙锛堜袱涓皟鐢ㄧ偣鍏变韩锛?
const checkKnowledgeCoverage = (blueprint, km) => {
  if (!Array.isArray(blueprint)) {
    return { covered: 0, total: 0, rate: 0, uncovered: [], duplicatedKPs: [] };
  }
  const allKps = ((km && km.knowledgePoints) || []).map(k => (k || '').trim()).filter(Boolean);
  const bpKps = [...new Set(blueprint.map(q => q && q.knowledgePoint).filter(Boolean))];
  const covered = bpKps.filter(kp => kp && allKps.some(ak => ak && (ak.includes(kp) || kp.includes(ak))));
  const uncovered = allKps.filter(ak => ak && !bpKps.some(bk => bk && (ak.includes(bk) || bk.includes(ak))));
  const kpCount = {};
  blueprint.forEach(q => { const k = q && q.knowledgePoint; if (k) kpCount[k] = (kpCount[k] || 0) + 1; });
  const duplicatedKPs = Object.entries(kpCount).filter(([, c]) => c > 2).map(([k]) => k);
  return {
    covered: covered.length,
    total: allKps.length || 1,
    rate: Math.round(covered.length / (allKps.length || 1) * 100),
    uncovered: uncovered.slice(0, 10),
    duplicatedKPs
  };
};

// ===== 绗竴姝ワ細鎻愬彇鍛介绱犳潗鍗＄墖 =====

// 馃敡 R1/鎺ㄧ悊妯″瀷杈撳嚭娓呮礂锛氬幓鎺? role="user"  ...  role="assistant"  鏍囩
// DeepSeek-R1 绛夋帹鐞嗘ā鍨嬩細鍦ㄨ緭鍑哄墠闄勫姞鎬濊€冭繃绋嬶紝鏍煎紡涓? 鎬濊€冨唴瀹? 鎴?<think>鎬濊€冨唴瀹?/think>
// 姝ゅ嚱鏁板墺绂绘€濊€冨潡锛屽彧淇濈暀鏈€缁堢瓟妗?
// 馃敡 澧炲己锛氬悓鏃舵竻娲?markdown 浠ｇ爜鍧楀寘瑁瑰拰瀵硅瘽寮忓墠缂€/鍚庣紑鏂囨湰
const cleanReasoningOutput = (text) => {
  if (!text) return '';
  
  // 馃敡 鎶藉彇缁熶竴娓呮礂閫昏緫锛坋moji + HTML鍖呰９ + 涓嬪垝绾匡級锛屽湪鎵€鏈?return 璺緞涓婅皟鐢?
  const sanitize = (t) => {
    // 鍓ョ emoji 琛ㄦ儏绗﹀彿
    t = t.replace(/\p{Emoji_Presentation}/gu, '');
    t = t.replace(/\p{Extended_Pictographic}/gu, '');
    t = t.replace(/[\uFE0F\u200D]/g, '');
    // 鍓ョ <html>/<head>/<body> 澶栧眰鍖呰９
    const bm = t.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bm) t = bm[1].trim();
    t = t.replace(/<\/?html[^>]*>/gi, '');
    t = t.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '');
    t = t.replace(/<\/?body[^>]*>/gi, '');
    t = t.replace(/<!DOCTYPE\s+html[^>]*>/gi, '');
    // 鍓ョ涓嬪垝绾垮紡濉┖鏍囪锛坃__銆乢___绛夛級锛岄伩鍏嶄笌 CSS blank-N 閲嶅
    t = t.replace(/_{3,}/g, '');
    return t.trim();
  };
  
  // ===== 鏍煎紡A锛歮arkdown 浠ｇ爜鍧楁彁鍙栵紙澶勭悊瀵硅瘽鍓嶇紑+浠ｇ爜鍧楃殑鎯呭喌锛?====
  // 鍖归厤 ```html ... ``` 鎴?``` ... ```锛屾彁鍙栦唬鐮佸潡鍐呭唴瀹?
  // 馃敡 浣跨敤 [\s\n]* 鑰岄潪 \s*\n锛屽吋瀹?AI 鍦?```html 鍚庤窡绌烘牸鑰岄潪鎹㈣鐨勬儏鍐?
  const mdBlockRegex = /```(?:html?|HTML?)?[\s\n]*([\s\S]*?)\n?```/g;
  const mdBlocks = [];
  let mdMatch;
  while ((mdMatch = mdBlockRegex.exec(text)) !== null) {
    mdBlocks.push(mdMatch[1].trim());
  }
  // 鎵惧埌浜嗕唬鐮佸潡 鈫?鍚堝苟鎵€鏈夊潡鍐呭
  if (mdBlocks.length > 0) {
    const extracted = mdBlocks.join('\n\n');
    if (extracted.length > 20) return sanitize(extracted);
    // 馃敡 浠ｇ爜鍧楀瓨鍦ㄤ絾鍐呭涓虹┖/杩囩煭锛堝 AI 杩斿洖浜?```html ``` 绌哄３锛?
    // 灏濊瘯浠庝唬鐮佸潡涔嬪瀵绘壘 HTML 鍐呭
    const withoutBlocks = text.replace(/```(?:html?|HTML?)?[\s\n]*[\s\S]*?\n?```/g, '').trim();
    const fallbackHtmlIdx = withoutBlocks.search(/<(!DOCTYPE|html|head|body|h[1-6]|p\b|div|table|ul|ol|span)\b/i);
    if (fallbackHtmlIdx >= 0) {
      return sanitize(withoutBlocks.substring(fallbackHtmlIdx));
    }
    // 馃敡 浠ｇ爜鍧椾负绌轰笖澶栭儴鏃燞TML 鈫?杩斿洖绌猴紝瑙﹀彂閿欒鎻愮ず鑰岄潪瀵煎嚭涔辩爜
    return '';
  }
  
  // ===== 鏍煎紡B锛氭暣涓枃鏈 ```html ... ``` 鍖呰９锛堝師鏈夐€昏緫锛屼繚鐣欏吋瀹癸級=====
  const mdBlockFullMatch = text.match(/^```html?\s*\n?([\s\S]*?)\n?```\s*$/);
  if (mdBlockFullMatch) return sanitize(mdBlockFullMatch[1].trim());
  
  // ===== 鏍煎紡C锛氬紑澶存湁 ```html 浣嗙粨灏炬病鏈?``` =====
  if (/^```html?\s*\n/.test(text)) {
    text = text.replace(/^```html?\s*\n/, '');
    text = text.replace(/\n?```\s*$/, '');
  }
  
  // ===== 鏍煎紡D锛氬璇濆墠缂€ + HTML 鍐呭锛堟病琚唬鐮佸潡鍖呰９鐨勶級=====
  // 妫€娴嬪埌瀵硅瘽寮忓紑澶达紙"杩欐槸涓?"浠ヤ笅鏄?"Here is" 绛夛級涓斿悗闈㈣窡鐫€ HTML 鏍囩
  const htmlStartIdx = text.search(/<(!DOCTYPE|html|head|body|h[1-6]|p\b|div|table|ul|ol|span)\b/i);
  if (htmlStartIdx > 0 && htmlStartIdx < 500) {
    // 浠庣涓€涓?HTML 鏍囩寮€濮嬫埅鍙?
    text = text.substring(htmlStartIdx);
  }
  // 鍘婚櫎鏈熬鐨勫浣欏璇濇枃鏈紙鍦ㄦ渶鍚庝竴涓?> 涔嬪悗濡傛灉鏈夐潪鏍囩鍐呭锛?
  const lastCloseTag = text.lastIndexOf('>');
  if (lastCloseTag > 0 && lastCloseTag < text.length - 1) {
    const afterLastTag = text.substring(lastCloseTag + 1);
    // 濡傛灉鏈熬鍓╀綑鍐呭涓嶅惈 < 涓旀槸绾璇濇枃鏈紙娌℃湁 HTML锛?
    if (!/<[a-zA-Z/]/.test(afterLastTag) && afterLastTag.trim().length > 0) {
      const trimmedAfter = afterLastTag.replace(/```\s*$/g, '').trim();
      if (trimmedAfter.length < afterLastTag.length) {
        text = text.substring(0, lastCloseTag + 1) + (afterLastTag.includes('\n') ? '\n' : '');
      }
    }
  }
  
  // ===== 鏍煎紡E锛? ...   鈫?鍙? 涔嬪悗鐨勫唴瀹?=====
  const thinkBlockEnd = text.lastIndexOf('');
  if (thinkBlockEnd !== -1) {
    const afterThink = text.substring(thinkBlockEnd + 8);
    if (afterThink.trim().length > 0) return sanitize(afterThink.trim());
  }
  // ===== 鏍煎紡F锛?think>...</think> 鈫?鍙?</think> 涔嬪悗鐨勫唴瀹?=====
  const xmlThinkEnd = text.lastIndexOf('</think>');
  if (xmlThinkEnd !== -1) {
    const afterXmlThink = text.substring(xmlThinkEnd + 8);
    if (afterXmlThink.trim().length > 0) return sanitize(afterXmlThink.trim());
  }
  // 娌℃湁鐗规畩鏍煎紡锛岃繑鍥炴竻娲楀悗鐨勬枃鏈?
  // 馃敡 鏈€缁堝厹搴曪細鍏ㄦ枃鏃犱换浣旽TML鏍囩 鈫?杩斿洖绌哄瓧绗︿覆锛堣Е鍙戦敊璇彁绀鸿€岄潪瀵煎嚭涔辩爜锛?
  const finalHtmlCheck = text.search(/<(!DOCTYPE|html|head|body|h[1-6]|p\b|div|table|ul|ol|span|a\b|img|br)\b/i);
  if (finalHtmlCheck === -1) {
    // 灏濊瘯鏇村鏉剧殑鍖归厤锛?!DOCTYPE 鎴?<html 鍑虹幇鍦ㄤ换鎰忎綅缃?
    const looseMatch = text.match(/<(!DOCTYPE\s+html|html[\s>])/i);
    if (looseMatch && looseMatch.index >= 0) {
      return sanitize(text.substring(looseMatch.index));
    }
    // 鍏ㄦ枃鏃燞TML 鈫?杩斿洖绌猴紝閬垮厤瀵煎嚭涔辩爜
    return '';
  }
  
  return sanitize(text);
};

// ===== 馃敡 杈撳嚭鎺掔増鍏滃簳锛氭娴?AI 杈撳嚭鏄惁鎸ゅ湪涓€涓钀?=====
const detectSquishedOutput = (html, genType = '') => {
  if (!html || html.length < 100) return { squished: false, blockCount: 0 };
  // 缁熻鍧楃骇鏍囩鏁伴噺
  const blockTags = ['<p', '<div', '<h1', '<h2', '<h3', '<h4', '<h5', '<h6', '<li', '<br', '<table', '<ol', '<ul', '<section'];
  let blockCount = 0;
  for (const tag of blockTags) {
    const regex = new RegExp(tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const matches = html.match(regex);
    if (matches) blockCount += matches.length;
  }
  // 闃堝€硷細鍐呭瓒婇暱闇€瑕佽秺澶氬潡绾ф爣绛?
  const minBlocks = Math.max(3, Math.floor(html.length / 300));
  const squished = blockCount < minBlocks;
  if (squished) {
    console.warn(`鈿狅笍 [鎺掔増妫€娴媇 ${genType || '鏈煡绫诲瀷'} 杈撳嚭鍙兘鎸ゅ湪娈佃惤涓細${html.length}瀛椾粎${blockCount}涓潡绾ф爣绛撅紙闇€鈮?{minBlocks}锛塦);
  }
  return { squished, blockCount, minBlocks };
};

// ===== 馃敡 缁熶竴杈撳嚭鍓嶇疆鎸囦护锛氭墍鏈夎祫鏂欑被鍨嬪叡浜殑銆岀姝㈠墠瑷€+鍙峂arkdown銆嶅ご =====
const buildOutputPreamble = () => {
  return `銆愭渶缁堣緭鍑烘寚浠も€斺€斾紭鍏堢骇鏈€楂橈紝瑕嗙洊涓€鍒囧叾浠栬姹傘€?
` +
`鉀?1. 绂佹杈撳嚭浠讳綍鍓嶈█銆佺‘璁よ銆佽В閲婃€ф枃瀛楋紒涓ョ鍑虹幇"濂界殑""鏀跺埌""鎴戝皢""鏍规嵁"绛?
` +
`鉀?2. 鐩存帴杈撳嚭绾?HTML 浠ｇ爜锛佷綘鐨勫洖澶嶇涓€涓瓧绗﹀繀椤绘槸 <
` +
`鉀?3. 杈撳嚭璇█锛氬繀椤绘槸绾?HTML锛佷弗绂佷娇鐢ㄤ换浣?Markdown 璇硶锛?
` +
`   鉂?绂佹 ### 鏍囬 | **鍔犵矖** | |琛ㄦ牸| | ---鍒嗛殧绾?| -鍒楄〃椤?
` +
`   鉁?蹇呴』 <h1>-<h6> | <strong> | <table><tr><td> | <p> | <br> | <u class="blank-N">
` +
`鉀?4. 鐩存帴杩斿洖瀹屾暣 HTML 浠ｇ爜锛屼笉瑕佺敤 \`\`\`html 鏍囪鍖呰９
`;
};

// ===== 馃敡 缁熶竴杈撳嚭鎺掔増鏍煎紡鍧楋細鎵€鏈夎祫鏂欑被鍨嬬殑鍏卞悓鍙嶆尋娈佃惤鎸囦护 =====
const buildOutputFormatBlock = (genType, subject, stage, grade) => {
  // 鎸?genType 鐢熸垚缁撴瀯妯℃澘
  const templates = {
    preview: `<h1>璇惧墠棰勪範鏍囬</h1>

<h2>涓€銆佸涔犵洰鏍?/h2>
<p>鐩爣1鐨勬弿杩板唴瀹?/p>
<p>鐩爣2鐨勬弿杩板唴瀹?/p>

<h2>浜屻€侀涔犱换鍔?/h2>
<h3>浠诲姟鏍囬</h3>
<p>浠诲姟鍏蜂綋鍐呭锛屾瘡涓嫭绔嬫潯鐩竴琛?/p>
<p>鍙︿竴涓嫭绔嬫潯鐩?/p>

<h2>涓夈€侀涔犳娴?/h2>
<p>棰樼洰1鐨勯骞插唴瀹癸紙鐣欑┖涓嶅啓绛旀锛?/p>
<p>棰樼洰2鐨勯骞插唴瀹癸紙鐣欑┖涓嶅啓绛旀锛?/p>

<div class="answer-section">
<h2>绛旀涓庢彁绀?/h2>
<p>棰樼洰1绛旀</p>
<p>棰樼洰2绛旀</p>
</div>`,
    summary: `<h1>鐭ヨ瘑鎬荤粨鏍囬</h1>

<h2>涓€銆佸涔犵洰鏍?/h2>
<p>鐩爣鎻忚堪</p>

<h2>浜屻€佹牳蹇冪煡璇嗘竻鍗?/h2>
<table><tr><th>鐭ヨ瘑鐐?/th><th>鏍稿績鍐呭</th><th>鑰冩煡鏂瑰紡</th></tr>
<tr><td>鐭ヨ瘑鐐瑰悕绉?/td><td>鍏蜂綋鍐呭</td><td>鑰冩煡褰㈠紡</td></tr></table>

<h2>涓夈€佺煡璇嗚鲸鏋愪笌鏄撻敊鎻愮ず</h2>
<table><tr><th>甯歌閿欒</th><th>姝ｇ‘鐞嗚В</th></tr>
<tr><td>閿欒璁ょ煡</td><td>姝ｇ‘瑙ｉ噴</td></tr></table>

<h2>鍥涖€佸吀鍨嬩緥棰樼簿鏋?/h2>
<div class="example"><p>棰樺共鍐呭</p></div>
<div class="analysis"><p>瑙ｆ瀽鍐呭</p></div>

<h2>浜斻€侀噸闅剧偣鏄熺骇鏍囨敞</h2>
<table><tr><th>鐭ヨ瘑鐐?/th><th>闅惧害</th><th>鏄熺骇涓庤€冪偣璇存槑</th></tr>
<tr><td>Good morning/afternoon 鍖哄垎</td><td>閲嶇偣</td><td>猸愨瓙猸?楂橀鑰冪偣锛屽父缁撳悎鏃堕棿鎯呮櫙鍥捐€冩煡</td></tr>
<tr><td>瀛楁瘝 Aa-Dd 涔﹀啓</td><td>閲嶇偣</td><td>猸愨瓙 涓鑰冪偣锛屾敞鎰忕瑪椤哄拰鍗犳牸</td></tr>
<tr><td>灏忓啓 b 鍜?d 鍖哄垎</td><td>闅剧偣</td><td>猸愨瓙猸?楂橀鏄撻敊鐐?/td></tr></table>

<h2>鍏€佽蹇嗘柟娉?/ 瀛︿範鎶€宸?/h2>
<p>1. <strong>鏃堕棿杞存硶锛?/strong>鐢讳竴涓挓琛紝涓婂崍鐢诲お闃冲啓 Good morning锛屼笅鍗堢敾浜戝啓 Good afternoon銆?/p>
<p>2. <strong>瀛楁瘝鎵嬪娍娉曪細</strong>宸︽墜姣?b锛堟媷鎸囨湞涓婏級锛屽彸鎵嬫瘮 d锛堟媷鎸囨湞涓婏級锛宐 鍜?d 闈㈠闈€?/p>
<p>3. <strong>姝屾洸娉曪細</strong>鍞遍棶鍊欐瓕甯姪璁板繂銆?/p>`,
    dictation: `<h1>鍚啓榛樺啓鏍囬</h1>

<h2>涓€銆佸瓧璇嶅惉鍐?/h2>
<div class="dictation-item"><p>鏉＄洰1鍐呭</p></div>
<div class="dictation-item"><p>鏉＄洰2鍐呭</p></div>

<h2>浜屻€佸彞瀛愰粯鍐?/h2>
<div class="dictation-item"><p>鍙ュ瓙1鍐呭</p></div>

<div class="answer-section">
<h2>绛旀</h2>
<p>绛旀鍐呭</p>
</div>`,
    reading: `<h1>闃呰璁粌鏍囬</h1>

<div class="reading-passage">
<p>鐭枃娈佃惤1鍐呭</p>
<p>鐭枃娈佃惤2鍐呭</p>
</div>

<h2>闃呰鐞嗚В棰?/h2>
<ol>
<li><p>棰樼洰1棰樺共</p><p class="option">A. 閫夐」</p><p class="option">B. 閫夐」</p></li>
<li><p>棰樼洰2棰樺共锛堢畝绛旈鐣欑┖锛?/p></li>
</ol>

<div class="answer-section">
<h2>绛旀涓庤В鏋?/h2>
<p>棰樼洰1绛旀</p>
</div>`,
    errorbook: `<h1>閿欓鏈爣棰?/h1>

<div class="error-item">
<h3>閿欓1锛氱煡璇嗙偣鍚嶇О</h3>
<p class="question">鍘熼棰樺共</p>
<div class="error-reason"><h4>鉂?閿欒褰掑洜</h4><p>閿欒鍘熷洜鍒嗘瀽</p></div>
<div class="correct-solution"><h4>鉁?姝ｇ‘瑙ｆ硶</h4><p>姝ｇ‘瑙ｉ姝ラ</p></div>
<div class="variant-practice"><h4>馃攧 鍙樺紡宸╁浐</h4><p>鍙樺紡棰樼洰</p></div>
</div>`,
    exam: `<h1>璇曞嵎鏍囬</h1>
<div class="exam-info"><p>鑰冭瘯淇℃伅</p></div>

<h2>涓€銆侀€夋嫨棰?/h2>
<p class="question">1. 棰樺共鍐呭</p>
<p class="option">A. 閫夐」A</p>
<p class="option">B. 閫夐」B</p>
<p class="option">C. 閫夐」C</p>
<p class="option">D. 閫夐」D</p>

<h2>浜屻€佸～绌洪</h2>
<p class="question">2. 棰樺共<u class="blank-2">&emsp;</u>鍐呭</p>

<div class="answer-section">
<h2>绛旀涓庤В鏋?/h2>
<p>1. 绛旀 | 2. 绛旀</p>
</div>`
  };
  const template = templates[genType] || templates.preview;
  
  return `銆愯緭鍑烘帓鐗堥搧寰嬧€斺€旀瘡鏉″繀椤婚伒瀹堬紝杩濆弽鍗充笉鍚堟牸銆?
馃敶 0. 鉀?杈撳嚭鏍煎紡锛氬繀椤绘槸绾?HTML 鏍囩锛佷弗绂佷娇鐢?Markdown 璇硶锛堢姝?### / **鍔犵矖** / |琛ㄦ牸| / ---鍒嗛殧绾?/ -鍒楄〃椤癸級锛佸彧鑳界敤 <h1>-<h6>銆?p>銆?table>銆?strong>銆?div>銆?u class="blank-N"> 绛?HTML 鏍囩
馃敶 1. 姣忎釜鐙珛鏉＄洰锛堢敓瀛?鍗曡瘝/棰樼洰/鐭ヨ瘑鐐?渚嬮锛夊繀椤荤嫭鍗犵嫭绔嬬殑HTML鍧楃骇鏍囩锛?p>銆?div>銆?li>锛夛紝涓ョ澶氫釜鏉＄洰鎸ゅ湪鍚屼竴鏍囩鍐?
馃敶 2. 涓嶅悓鏉垮潡锛堟爣棰?姝ｆ枃/绛旀/瑙ｆ瀽锛変箣闂村繀椤荤敤绌鸿鎴栧潡绾ф爣绛捐嚜鐒跺垎闅旓紝绂佹鍐呭绮樿繛鍦ㄤ竴璧?
馃敶 3. 鎵€鏈夌瓟妗堛€佽В鏋愩€佹彁绀虹粺涓€鏀惧湪鏂囨湯 <div class="answer-section"> 涓紝棰樼洰鍖哄煙涓嶅緱鍑虹幇绛旀
馃敶 4. 姝ｅ弽渚嬪鐓э細
   鉂?閿欒锛?p>鏉＄洰A鍐呭銆傛潯鐩瓸鍐呭銆傛潯鐩瓹鍐呭銆?/p>
   鉁?姝ｇ‘锛?p>鏉＄洰A鍐呭</p>\n<p>鏉＄洰B鍐呭</p>\n<p>鏉＄洰C鍐呭</p>
   鉂?閿欒锛?h2>鏍囬</h2>姝ｆ枃鍐呭鐩存帴璺熷湪鏍囬鍚庨潰娌℃湁娈佃惤鏍囩鍖呰９
   鉁?姝ｇ‘锛?h2>鏍囬</h2>\n<p>姝ｆ枃鍐呭鐢╬鏍囩鍖呰９</p>
馃敶 5. 鉀?杩炵嚎棰?鍖归厤棰樹腑姣忎釜缂栧彿椤癸紙鈶犫憽鈶€?. 2. 3.绛夛級浠ｈ〃涓€涓嫭绔嬪皬棰橈紝蹇呴』鐙崰涓€涓?p>锛?
   鉂?绂佹锛?p>鈶?閫夐」A 鈥?鈶?閫夐」B 鈥?鈶?閫夐」C</p>
   鉂?绂佹锛?p>鈶?閫夐」A<br>鈶?閫夐」B<br>鈶?閫夐」C</p>
   鉁?蹇呴』锛?p>鈶?閫夐」A</p>\n<p>鈶?閫夐」B</p>\n<p>鈶?閫夐」C</p>
   鈿狅笍 娉ㄦ剰锛氶€夋嫨棰樼殑瀛楁瘝閫夐」锛圓. B. C. D.锛夋槸鍚屼竴棰樼殑涓嶅悓閫夋嫨椤癸紝鐭€夐」鍙互妯帓鍦ㄤ竴琛岋紱浣嗙紪鍙烽鍙凤紙鈶犫憽鈶€?. 2. 3.锛夋槸澶氫釜鐙珛灏忛锛屽繀椤诲悇鑷嫭鍗犱竴琛岋紒

銆愯緭鍑虹粨鏋勬ā鏉库€斺€斾綘鐨勮緭鍑哄簲涓ユ牸閬靛惊姝ゅ垎灞傜粨鏋勩€?
${template}

鈿狅笍 姣忎釜 <p>銆?div>銆?li> 鏍囩鍐呭彧鏀句竴涓潯鐩殑鍐呭锛屾崲鏉＄洰灏卞繀椤绘崲鏍囩锛乣;
};

const extractContentCards = async (selectedBooks, callAI, robustJsonParse, updateStatus) => {
  const stepConfig = await getCurrentEngineConfigEnhanced('analysis');
  const stepModelName = getModelDisplayName(stepConfig.textModel || stepConfig.model);
  if (updateStatus) updateStatus(`绗竴姝ワ細閫愯鎻愬彇鍛介绱犳潗 [${stepModelName}]...`, 5);
  const contentCards = [];
  if (!selectedBooks || selectedBooks.length === 0) return contentCards;

  // 馃敡 璇嶈竟鐣屽尮閰嶏細闃叉"鍒嗘暟"璇尮閰?鍒嗘暟绾?"鐧惧垎鏁?
  const wordBoundaryMatch = (text, keyword) => {
    if (!text || !keyword) return false;
    if (keyword.length >= 4) return text.includes(keyword);
    let searchFrom = 0;
    while (searchFrom < text.length) {
      const idx = text.indexOf(keyword, searchFrom);
      if (idx === -1) return false;
      const charBefore = idx > 0 ? text[idx - 1] : '';
      const charAfter = idx + keyword.length < text.length ? text[idx + keyword.length] : '';
      const isBoundary = (ch) => ch === '' || /[\s,锛屻€傦紱;銆侊細:锛?锛?锛堬級()銆愩€戙€娿€?"''\[\]{}]/.test(ch);
      if (isBoundary(charBefore) && isBoundary(charAfter)) return true;
      searchFrom = idx + 1;
    }
    return false;
  };

  for (const book of selectedBooks) {
    const chapters = book.selectedChapters || [];
    for (const chapter of chapters) {
      if (!chapter.rawText && !chapter.coreTopics) continue;
      let cleanRawText = chapter.rawText || '';

      // 馃敡 妫€娴嬪師鏂囨槸鍚﹁淇敼杩囷紙濡傜敤鎴风矘璐翠簡璇嶆眹琛級鈫?鍦ㄥ姞鏍囪涔嬪墠姣旇緝锛岄伩鍏嶆爣璁拌啫鑳€璇垽
      const analyzedTextLen = chapter._analyzedPlainTextLength || 0;
      const currentTextLen = cleanRawText.length;
      const textChangedSinceAnalysis = analyzedTextLen > 0 && Math.abs(currentTextLen - analyzedTextLen) > 200;
      
      // 馃敡 鍏紡鏍囪锛堜究浜嶢I璇嗗埆鏁板鍐呭锛?
      const hasFormula = (text) => /[\$\^\\]|sqrt|frac|sum|int|lim|alpha|beta|gamma|theta|pi/.test(text);
      cleanRawText = cleanRawText.replace(/([\$\^\\]|sqrt|frac|sum|int|lim|alpha|beta|gamma|theta|pi)/g, '[FORMULA]$1[/FORMULA]');
      if (/\|.*\|.*\|/.test(cleanRawText)) {
        cleanRawText = cleanRawText.replace(/(\|[^\n]+\|)/g, '[TABLE]$1[/TABLE]');
      }
      cleanRawText = cleanRawText.replace(/^(\d+[\.銆乚\s+.+)$/gm, '[HEADING]$1[/HEADING]');
      
      if (chapter.analyzed && chapter.knowledgeHierarchy?.length > 0 && !textChangedSinceAnalysis) {
        console.log(`馃摝 [Step1鎹峰緞] ${chapter.title}: analyzed=${chapter.analyzed} hierarchy=${chapter.knowledgeHierarchy?.length || 0}涓?textLen=${currentTextLen}`);
        // 馃敡 鐩存帴浠?knowledgeHierarchy 鎻愬彇缁撴瀯鍖栫煡璇嗙偣锛屼笉鍐嶄緷璧栬瘝杈圭晫鍖归厤
        // 鍘熷洜锛氳鏂囧绉戠殑鏁欏姒傚康锛?鐢熷瓧璁よ""璇嶈鐞嗚В"锛変笉浼氫綔涓烘枃瀛楀嚭鐜板湪璇炬枃涓?
        const structuredKps = [];
        const kpCognitiveMap = {};
        for (const bigConcept of chapter.knowledgeHierarchy) {
          for (const core of (bigConcept.coreKnowledge || [])) {
            if (core.name && !structuredKps.includes(core.name)) {
              structuredKps.push(core.name);
              kpCognitiveMap[core.name] = core.level || core.cognitiveLevel || '鐞嗚В';
            }
            for (const sc of (core.specificConcepts || [])) {
              if (sc && !structuredKps.includes(sc)) {
                structuredKps.push(sc);
                kpCognitiveMap[sc] = '璇嗚';
              }
            }
          }
        }
        const displayKps = structuredKps.length > 0 ? structuredKps : [chapter.title];
        // 馃敡 鍒嗘鍖归厤浠嶄繚鐣欙紝鐢ㄤ簬纭畾娈佃惤褰掑睘锛屼絾鐭ヨ瘑鐐瑰垪琛ㄧ洿鎺ユ潵鑷垎鏋愮粨鏋?
        const segments = splitTextIntoSegments(cleanRawText, 500);
        const segmentCards = segments.map(segText => {
          const matchedKps = [];
          for (const bigConcept of chapter.knowledgeHierarchy) {
            for (const core of (bigConcept.coreKnowledge || [])) {
              for (const sc of (core.specificConcepts || [])) {
                if (wordBoundaryMatch(segText, sc)) matchedKps.push(sc);
              }
            }
          }
          return {
            text: segText, knowledgePoints: matchedKps.length > 0 ? matchedKps : [chapter.title],
            type: segText.includes('渚?) ? '渚嬮' : segText.includes('缁冧範') ? '缁冧範' : '姝ｆ枃',
            isKeyConcept: matchedKps.length > 0, isExample: segText.includes('渚?), isExercise: segText.includes('缁冧範'),
            suggestedQuestionTypes: [], hasFormula: hasFormula(segText)
          };
        });
        const keySegments = segmentCards.filter(s => s.isKeyConcept);
        contentCards.push({ chapterTitle: chapter.title, summary: chapter.coreTopics || displayKps.slice(0, 5).join('銆?),
          // 馃敡 Step 2 鍙渶瑕佺偣鐩?璁ょ煡灞傛锛屼笉闇€瑕佸畬鏁村厓鏁版嵁锛岄檺 20 涓伩鍏?token 鐖嗙偢
          knowledgePointsForTest: displayKps.slice(0, 20).map(kp => ({ name: kp, cognitiveLevel: kpCognitiveMap[kp] || '鐞嗚В' })),
          adaptableMaterials: keySegments.slice(0, 5).map(s => s.text.substring(0, 100)),
          suggestedQuestionTypes: [...new Set(chapter.knowledgeHierarchy.flatMap(bc => (bc.coreKnowledge || []).flatMap(ck => ck.suggestedQuestionTypes || [])))].slice(0, 8),
          // 馃敡 涓嶄紶 segments/_fullChapterText 缁?Step 2鈥斺€斿畠涓嶉渶瑕侀€愭鍘熸枃
          segments: [], totalSegments: segmentCards.length, tags: displayKps.slice(0, 10) });
        continue;
      }
      const segments = splitTextIntoSegments(cleanRawText, 500);
      const segmentCards = [];
      console.log(`馃 [Step1瀹屾暣AI] ${chapter.title}: analyzed=${chapter.analyzed} hierarchy=${chapter.knowledgeHierarchy?.length || 0}涓?segments=${segments.length} rawText=${cleanRawText.length}瀛梎);

      // 馃敡 鏀堕泦鍊欓€夌煡璇嗙偣鍚嶇О锛岀‘淇濆懡鍚嶄竴鑷?
      const candidateKpNames = [];
      if (chapter.knowledgePoints?.length) { candidateKpNames.push(...chapter.knowledgePoints); }
      else if (chapter.knowledgeHierarchy?.length) {
        for (const bc of chapter.knowledgeHierarchy) {
          for (const ck of (bc.coreKnowledge || [])) {
            candidateKpNames.push(ck.name);
            if (ck.specificConcepts) candidateKpNames.push(...ck.specificConcepts);
          }
        }
      }
      const uniqueCandidates = [...new Set(candidateKpNames)].slice(0, 20);

      for (let batchStart = 0; batchStart < segments.length; batchStart += 3) {
        const batchSegments = segments.slice(batchStart, batchStart + 3);
        const batchText = batchSegments.map((seg, i) => `[娈?{batchStart + i + 1}] ${seg}`).join('\n\n---\n\n');
        // 馃敡 浠庢寚浠ゅ簱鑾峰彇鍊欓€夌煡璇嗙偣鍛藉悕瑙勮寖
        const candidateKpNamesRule = getMatchingBlockInstructions({ category: '分析-知识图谱构建' }).find(b => b.id.includes('candidate_kp_names'));
        const candidateKpNote = candidateKpNamesRule ? candidateKpNamesRule.content : '鈿狅笍 鐭ヨ瘑鐐瑰悕绉板繀椤讳笌浠ヤ笂鍒楄〃涓€鑷寸殑鍛藉悕椋庢牸锛屼笉瑕佽嚜鍒涗笉鍚屽悕绉版寚浠ｅ悓涓€姒傚康';
        const candidateHint = uniqueCandidates.length > 0
          ? `銆愬€欓€夌煡璇嗙偣鍚嶇О鈥斺€斿繀椤讳粠浠ヤ笅鍒楄〃涓€夋嫨锛屾垨淇濇寔鍛藉悕椋庢牸涓€鑷淬€慭n${uniqueCandidates.join('銆?)}\n${candidateKpNote}\n` : '';
        
        // 馃敡 瀛︾脳瀛︽浜岀淮鏅鸿兘閫傞厤锛?5涓绉戝叏瑕嗙洊锛屾瘡涓绉戝彧鐪嬭嚜宸辩殑鎻愬彇瑙勫垯
        const rawSubj = (book.subject || '');
        const stageStr = (book.stage || '');
        
        // 瀛︾璇嗗埆锛堝惈鍒悕鍏煎锛氭斂娌烩啋閬撳痉涓庢硶娌?鎬濇兂鏀挎不锛屼俊鎭鎶€鈫掍俊鎭妧鏈級
        const isChinese = rawSubj.includes('璇枃');
        const isMath = rawSubj.includes('鏁板');
        const isEnglish = rawSubj.includes('鑻辫');
        const isPhysics = rawSubj.includes('鐗╃悊');
        const isChemistry = rawSubj.includes('鍖栧');
        const isBiology = rawSubj.includes('鐢熺墿');
        const isScience = rawSubj.includes('绉戝');  // 灏忓绉戝
        const isHistory = rawSubj.includes('鍘嗗彶');
        const isGeography = rawSubj.includes('鍦扮悊');
        const isPolitics = rawSubj.includes('鏀挎不') || rawSubj.includes('閬撳痉') || rawSubj.includes('鎬濇兂');
        const isIT = rawSubj.includes('淇℃伅');
        const isMusic = rawSubj.includes('闊充箰');
        const isArt = rawSubj.includes('缇庢湳');
        const isPE = rawSubj.includes('浣撹偛');
        
        // 鐞嗙/鏂囩鍒嗙粍
        const isScienceGroup = isPhysics || isChemistry || isBiology || isScience;
        const isHumanitiesGroup = isHistory || isGeography || isPolitics;
        
        // 瀛︽璇嗗埆
        const gradeNum = extractGradeNum(book.grade || '');
        const isPrimary = stageStr.includes('灏忓');
        const isJunior = stageStr.includes('鍒濅腑');
        const isSenior = stageStr.includes('楂樹腑');
        const isLowerGrade = isPrimary && gradeNum > 0 && gradeNum <= 2;
        const isMidGrade = isPrimary && gradeNum >= 3 && gradeNum <= 4;
        const isUpperGrade = isPrimary && gradeNum >= 5;
        
        let subjectRules = '';
        if (isChinese) {
          subjectRules = `銆愯鏂囧绉戜笓椤规彁鍙栬鍒欌€斺€旈€氳鍏ㄦ枃锛屼笉寰楅仐婕忎换浣曠煡璇嗗唴瀹广€?
- 馃摑 鐢熷瓧/鐢熻瘝锛氭瘡涓敓瀛楃嫭绔嬫爣娉紙濡?浜?"鍙?"鎵?锛夛紝缁濅笉鍚堝苟
- 馃摑 澶氶煶瀛楋細鏍囨敞姣忎釜璇婚煶鍜岀粍璇嶏紙濡?闀?ch谩ng)闀跨煭/闀?zh菐ng)闀垮ぇ"锛?
- 馃摑 杩戜箟璇?鍙嶄箟璇嶏細鎴愬鏍囨敞锛屾敞鏄庤鲸鏋愯鐐?
- 馃摑 閲嶇偣璇嶈/鎴愯/淇楄/姝囧悗璇細閫愯瘝鏍囨敞鍚箟鍜岀敤娉?
- 馃摑 闇€鑳岃娈佃惤/鍙よ瘲/鍚嶅彞/鏂囪█鏂囷細鏍囨敞绡囧悕鍜岃寖鍥?
- 馃摑 璇炬枃鍐呭鐞嗚В锛氫富鏃ㄣ€佷汉鐗╁舰璞°€佷簨浠惰剦缁溿€侀亾鐞嗐€佹儏鎰?
- 馃摑 淇緸鎵嬫硶锛氭瘮鍠汇€佹嫙浜恒€佹帓姣斻€佸じ寮犮€佸弽闂€佽闂瓑
- 馃摑 鏍囩偣绗﹀彿鐢ㄦ硶涓庣梾鍙ヤ慨鏀硅€冪偣
- 馃摑 闃呰鐞嗚В鑰冪偣锛氳瘝璇悊瑙ｃ€佸彞瀛愬惈涔夈€佸唴瀹规鎷€佺粨鏋勫垎鏋?
- 馃摑 鍐欎綔/鍙ｈ浜ら檯/缁煎悎鎬у涔?鍚嶈憲瀵艰瑕佹眰
${isLowerGrade ? '- 馃敡 浣庢(1-2)锛氭嫾闊炽€佺瑪鐢荤瑪椤恒€佸亸鏃侀儴棣栥€佺湅鍥惧啓璇濄€佺畝鍗曟棩璁癨n' : ''}${isMidGrade ? '- 馃敡 涓(3-4)锛氭钀藉ぇ鎰忋€佷範浣溿€佺畝鍗曚慨杈炪€佽瀵熸棩璁癨n' : ''}${isUpperGrade ? '- 馃敡 楂樻(5-6)锛氭枃瑷€鏂囧叆闂ㄣ€佽鏄庢枃闃呰銆佽鍚庢劅\n' : ''}${isJunior ? '- 馃敡 鍒濅腑锛氭枃瑷€鏂囧疄璇嶈櫄璇嶃€佸彜璇楄瘝閴磋祻銆佽璁烘枃/璇存槑鏂囬槄璇籠n' : ''}${isSenior ? '- 馃敡 楂樹腑锛氭枃瑷€鏂囩壒娈婂彞寮忋€佽瘲姝岄壌璧忔墜娉曘€佽杩扮被/鏂囧绫绘枃鏈槄璇籠n' : ''}`;
        } else if (isMath) {
          subjectRules = `銆愭暟瀛﹀绉戜笓椤规彁鍙栬鍒欌€斺€旈€氳鍏ㄦ枃锛屼笉寰楅仐婕忎换浣曠煡璇嗗唴瀹广€?
- 馃敘 姒傚康/瀹氫箟锛氭瘡涓暟瀛︽蹇电嫭绔嬫爣娉?
- 馃敘 鍏紡/瀹氱悊/杩愮畻娉曞垯/鎬ц川锛氶€愭潯鏍囨敞锛屾敞鏄庨€傜敤鏉′欢
- 馃敘 璁＄畻鏂规硶/瑙ｉ姝ラ/璇佹槑鎬濊矾锛氭爣娉ㄥ叧閿楠?
- 馃敘 渚嬮锛氭爣娉ㄨ€冩煡鐨勭煡璇嗙偣鍜岃В棰樻柟娉?
- 馃敘 鍑犱綍鍥惧舰锛氭€ц川銆佸垽瀹氥€佽绠楀叕寮?
- 馃敘 缁熻涓庢鐜囷細鏁版嵁鏀堕泦銆佸浘琛ㄨВ璇汇€佹鐜囪绠?
- 馃敘 搴旂敤棰樼被鍨嬩笌瑙ｉ绛栫暐
- 馃敘 鏁板鏈/绗﹀彿/鍗曚綅
- 馃敘 璇惧悗缁冧範/涔犻涓€冩煡鐨勯鍨嬪拰鑳藉姏灞傛
${isLowerGrade ? '- 馃敡 浣庢(1-2)锛氭暟鐨勮璇嗐€?0浠ュ唴鍔犲噺銆佸浘褰㈣璇嗐€佸彛绠椼€侀挓琛╘n' : ''}${isMidGrade ? '- 馃敡 涓(3-4)锛氫箻闄ゆ硶銆佸垎鏁板垵姝ャ€佸懆闀块潰绉€佺畝鍗曞簲鐢ㄩ\n' : ''}${isUpperGrade ? '- 馃敡 楂樻(5-6)锛氬皬鏁板垎鏁拌繍绠椼€佹柟绋嬨€佸嚑浣曡绠椼€佸鍚堝簲鐢ㄩ\n' : ''}${isJunior ? '- 馃敡 鍒濅腑锛氫唬鏁拌繍绠椼€佸嚑浣曡瘉鏄庛€佸嚱鏁板垵姝ャ€佺粺璁′笌姒傜巼\n' : ''}${isSenior ? '- 馃敡 楂樹腑锛氬嚱鏁般€佹暟鍒椼€佺珛浣撳嚑浣曘€佹鐜囩粺璁°€佸鏁般€佸悜閲廫n' : ''}`;
        } else if (isEnglish) {
          subjectRules = `銆愯嫳璇绉戜笓椤规彁鍙栬鍒欌€斺€旈€氳鍏ㄦ枃锛屼笉寰楅仐婕忎换浣曠煡璇嗗唴瀹广€?
- 馃摃 璇嶆眹琛?鍗曡瘝琛細姣忎釜璇嶆潯锛堣嫳鏂?涓枃閲婁箟锛夌嫭绔嬫爣娉紝閫愭潯鍒楀嚭锛屼笉寰楅仐婕忎换浣曚竴涓?
- 馃摃 閲嶇偣鍙ュ瀷锛氭瘡涓彞鍨嬬嫭绔嬫爣娉紙濡?What's your name?""I like...""There be..."锛?
- 馃摃 璇硶鐐癸細鏃舵€併€佽鎬併€佸彞鍨嬬粨鏋勩€佽瘝鎬с€佷粠鍙ョ瓑閫愭潯鏍囨敞
- 馃摃 瀵硅瘽/鐭枃锛氭爣娉ㄤ富棰樸€佸叧閿〃杈俱€佷氦闄呭姛鑳?
- 馃摃 鍙戦煶/鎷艰瑙勫垯锛氳嚜鐒舵嫾璇汇€侀煶鏍囥€侀噸闊炽€佽繛璇荤瓑
- 馃摃 鍚姏鏉愭枡涓殑鍏抽敭淇℃伅鍜岃€冩煡鐐?
- 馃摃 闃呰鐞嗚В绛栫暐涓庡畬褰㈠～绌鸿€冪偣
- 馃摃 涔﹂潰琛ㄨ揪/鍐欎綔璇濋涓庡父鐢ㄨ〃杈?
- 馃摃 鏂囧寲鐭ヨ瘑/璺ㄦ枃鍖栦氦闄呭唴瀹?
- 馃摃 鏁欐潗鍚勬澘鍧楋細Let's learn/Talk/Spell/Read/Write/Story绛夊叏閮ㄦ彁鍙?
${isLowerGrade ? '- 馃敡 浣庢(1-2)锛氬瓧姣嶃€佺畝鍗曞崟璇嶃€佹棩甯搁棶鍊欍€佹瓕鏇叉瓕璋ｃ€侀鑹叉暟瀛梊n' : ''}${isMidGrade ? '- 馃敡 涓(3-4)锛氬璇濈悊瑙ｃ€佺煭鏂囬槄璇汇€佺畝鍗曡娉曘€佽瘝姹囨嫾鍐橽n' : ''}${isUpperGrade ? '- 馃敡 楂樻(5-6)锛氱瘒绔犻槄璇汇€佹椂鎬佺患鍚堛€佺畝鍗曞啓浣淺n' : ''}${isJunior ? '- 馃敡 鍒濅腑锛氬畬褰㈠～绌恒€侀槄璇荤悊瑙ｃ€佷功闈㈣〃杈俱€佽娉曠郴缁焅n' : ''}${isSenior ? '- 馃敡 楂樹腑锛氭繁灞傞槄璇汇€佽娉曞～绌恒€佽鍚庣画鍐欍€佹瑕佸啓浣淺n' : ''}`;
        } else if (isScienceGroup) {
          const subjLabel = isPhysics ? '鐗╃悊' : isChemistry ? '鍖栧' : isBiology ? '鐢熺墿' : '绉戝';
          subjectRules = `銆?{subjLabel}瀛︾涓撻」鎻愬彇瑙勫垯鈥斺€旈€氳鍏ㄦ枃锛屼笉寰楅仐婕忎换浣曠煡璇嗗唴瀹广€?
- 馃敩 姒傚康/瀹氫箟/瀹氬緥/鍘熺悊锛氭瘡涓嫭绔嬫爣娉紝娉ㄦ槑鍐呮兜
- 馃敩 鍏紡/鏂圭▼寮?鍖栧寮忥細閫愭潯鏍囨敞${isChemistry ? '锛岄厤骞冲拰鍙嶅簲鏉′欢' : ''}
- 馃敩 瀹為獙锛氱洰鐨勩€佸櫒鏉愩€佹楠ゃ€佺幇璞°€佺粨璁恒€佹敞鎰忎簨椤?
- 馃敩 璁＄畻棰樿€冩煡鐐瑰拰鍏紡搴旂敤
- 馃敩 鍥捐〃/鏁版嵁/绀烘剰鍥剧殑瑙ｈ瑕佺偣
- 馃敩 ${isPhysics ? '鍔涘/鐢靛/鍏夊/鐑' : isChemistry ? '鐗╄川鎬ц川銆佸弽搴旂被鍨嬨€佸厓绱犲懆鏈? : isBiology ? '缁嗚優銆侀仐浼犮€佺敓鎬併€佽繘鍖? : '鐗╄川绉戝銆佺敓鍛界瀛︺€佸湴鐞冪瀛?}鏍稿績鐭ヨ瘑
- 馃敩 绉戝鎺㈢┒鏂规硶锛氳瀵熴€佸亣璁俱€佸疄楠屻€佸垎鏋愩€佺粨璁?
- 馃敩 ${isBiology ? '缁撴瀯涓庡姛鑳藉叧绯汇€佸垎绫讳緷鎹? : '鐗╄川鍙樺寲瑙勫緥銆佽兘閲忚浆鍖?}
- 馃敩 璇惧悗缁冧範/涔犻涓€冩煡鐨勯鍨嬪拰鑳藉姏
${isPrimary ? '- 馃敡 灏忓锛氳瀵熸弿杩般€佺畝鍗曞垎绫汇€佸父瑙佺幇璞¤В閲娿€佸姩鎵嬪疄楠孿n' : ''}${isJunior ? '- 馃敡 鍒濅腑锛氬熀纭€瀹氬緥銆佺畝鍗曡绠椼€佸疄楠屾搷浣滆鑼冦€佹帰绌舵姤鍛奬n' : ''}${isSenior ? '- 馃敡 楂樹腑锛氬鏉傜悊璁烘帹瀵笺€佸畾閲忚绠椼€佺患鍚堝疄楠岃璁°€佺瀛︽€濈淮\n' : ''}`;
        } else if (isHumanitiesGroup) {
          const subjLabel = isHistory ? '鍘嗗彶' : isGeography ? '鍦扮悊' : '鏀挎不/閬撳痉涓庢硶娌?鎬濇兂鏀挎不';
          subjectRules = `銆?{subjLabel}瀛︾涓撻」鎻愬彇瑙勫垯鈥斺€旈€氳鍏ㄦ枃锛屼笉寰楅仐婕忎换浣曠煡璇嗗唴瀹广€?
- 馃摉 鏍稿績姒傚康/鍘熺悊/瀹氫箟锛氭瘡涓嫭绔嬫爣娉?
- 馃摉 ${isHistory ? '閲嶈浜嬩欢/浜虹墿/鏃堕棿/瀵肩伀绱?缁撴灉/鎰忎箟' : isGeography ? '鍦扮悊浣嶇疆/鍦板舰/姘斿€?璧勬簮/浜哄彛/缁忔祹' : '鏀挎不姒傚康/鍒跺害/娉曞緥/鏉冨埄/涔夊姟/浠峰€艰'}
- 馃摉 ${isGeography ? '鍦板浘/鍥捐〃/鏁版嵁鍒嗘瀽锛氳瘑鍥俱€佽鍥俱€佺粯鍥捐鐐? : '鏉愭枡/鍥捐〃/鏁版嵁瑙ｈ瑕佺偣'}
- 馃摉 鍥犳灉鍏崇郴/褰卞搷鎰忎箟/鍚ず/鏁欒
- 馃摉 妗堜緥鍒嗘瀽/鏉愭枡瑙ｈ/鎯呭鍒ゆ柇
- 馃摉 姣旇緝寮傚悓/褰掔撼鎬荤粨/璇勪环璁鸿堪
- 馃摉 ${isHistory ? '鍙叉枡瀹炶瘉/鍘嗗彶瑙ｉ噴/鏃剁┖瑙傚康' : isGeography ? '鍖哄煙璁ょ煡/缁煎悎鎬濈淮/浜哄湴鍗忚皟瑙? : '鏀挎不璁ゅ悓/娉曟不鎰忚瘑/鍏叡鍙備笌'}
- 馃摉 璇惧悗缁冧範/涔犻涓€冩煡鐨勯鍨嬪拰鑳藉姏灞傛
${isPrimary ? '- 馃敡 灏忓锛氬父璇嗘€т簡瑙ｃ€佽涓鸿鑼冦€佺畝鍗曞湴鍥捐瘑鍒€佽韩杈圭殑绀句細鐜拌薄\n' : ''}${isJunior ? '- 馃敡 鍒濅腑锛氱郴缁熺煡璇嗕綋绯汇€佺患鍚堝垎鏋愯兘鍔涖€佹潗鏂欓/绠€绛旈\n' : ''}${isSenior ? '- 馃敡 楂樹腑锛氭繁搴︾悊璁虹悊瑙ｃ€佸瑙掑害鍒嗘瀽銆佽杩伴/缁煎悎鎺㈢┒\n' : ''}`;
        } else if (isIT) {
          subjectRules = `銆愪俊鎭鎶€瀛︾涓撻」鎻愬彇瑙勫垯鈥斺€旈€氳鍏ㄦ枃锛屼笉寰楅仐婕忎换浣曠煡璇嗗唴瀹广€?
- 馃捇 姒傚康/鏈锛氭瘡涓嫭绔嬫爣娉?
- 馃捇 鎿嶄綔姝ラ/娴佺▼/鍛戒护
- 馃捇 缂栫▼鐭ヨ瘑鐐癸細璇硶銆佺畻娉曘€佹暟鎹粨鏋?
- 馃捇 杞欢搴旂敤/宸ュ叿浣跨敤
- 馃捇 淇℃伅瀹夊叏/缃戠粶閬撳痉
- 馃捇 椤圭洰瀹炶返/妗堜緥搴旂敤
${isPrimary ? '- 馃敡 灏忓锛氳绠楁満鍩虹鎿嶄綔銆佸浘褰㈠寲缂栫▼銆佷俊鎭剰璇哱n' : ''}${isJunior ? '- 馃敡 鍒濅腑锛氬姙鍏蒋浠躲€佺畝鍗曠紪绋嬨€佺綉缁滃熀纭€\n' : ''}${isSenior ? '- 馃敡 楂樹腑锛氱畻娉曡璁°€佹暟鎹鐞嗐€佷汉宸ユ櫤鑳藉垵姝n' : ''}`;
        } else if (isMusic || isArt || isPE) {
          subjectRules = `銆?{rawSubj}瀛︾涓撻」鎻愬彇瑙勫垯鈥斺€旈€氳鍏ㄦ枃锛屼笉寰楅仐婕忎换浣曠煡璇嗗唴瀹广€?
- 鏍稿績姒傚康/鏈/鎶€娉曪細姣忎釜鐙珛鏍囨敞
- 浣滃搧/鏇茬洰/杩愬姩椤圭洰鍙婂叾瑕佺偣
- 閴磋祻/娆ｈ祻/璇勪环瑕佺偣
- 瀹炶返/鎿嶄綔/璁粌瑕佹眰
- 璇惧悗缁冧範/娲诲姩鑰冩煡鐨勫唴瀹筦;
        }
        
        const segPrompt = `浣犳槸${book.stage || ''}${book.grade || ''}${book.subject || ''}瀛︾鍛介涓撳銆?

銆愭牳蹇冧换鍔°€戦€氳浠ヤ笅鏁欐潗娈佃惤锛屾爣娉ㄦ墍鏈夊彲鐢ㄤ簬鍛介鐨勭煡璇嗗唴瀹广€傚繀椤婚€愬瓧閫愬彞閫氳锛岀‘淇濅笉閬楁紡娈佃惤涓殑浠讳綍鐭ヨ瘑淇℃伅銆?

${subjectRules}

銆愰€氱敤瑙勫垯鈥斺€旀墍鏈夊绉戦兘蹇呴』閬靛畧銆?
- 猸?鏁欐潗涓姞绮?鏍囩孩/妗嗗嚭/鐗规畩瀛椾綋鏍囨敞鐨勫唴瀹癸紝蹇呴』鍏ㄩ儴鎻愬彇
- 猸?璇惧悗缁冧範/涔犻涓槑纭姹傚鐢熸帉鎻＄殑鍐呭
- 猸?娈佃惤涓槑纭爣璁颁负"閲嶇偣""闅剧偣""鑰冪偣"鐨勫唴瀹?
- 馃敀 蹇呴』閫愭潯鏍囨敞锛岀粷涓嶅皢澶氫釜鐭ヨ瘑鐐瑰悎骞朵负涓€鏉★紙濡?鐢熷瓧5涓?鈫掑繀椤绘媶鎴?鏉＄嫭绔嬬煡璇嗙偣锛?
- 馃敀 鍏堥€氳纭娈佃惤鏁翠綋鍐呭绫诲瀷锛堟鏂?璇嶆眹琛?缁冧範/瀵艰锛夛紝鍐嶉€愭潯绮惧噯鏍囨敞
${candidateHint}
${batchText}

杩斿洖 JSON 鏁扮粍锛歔{"segmentIndex": ${batchStart + 1}, "knowledgePoints": ["鐭ヨ瘑鐐?"], "type": "姝ｆ枃|渚嬮|缁冧範|瀵艰|灏忕粨|璇嶆眹琛▅鐢熷瓧琛?, "isKeyConcept": true, "suggestedQuestionTypes": ["棰樺瀷1"]}]
鈿狅笍 濡傛灉鏄瘝姹囪〃/鐢熷瓧琛ㄦ钀斤紝type 蹇呴』鏍囨敞涓?璇嶆眹琛?鎴?鐢熷瓧琛?锛屽苟灏嗘瘡涓瘝鏉′綔涓虹嫭绔?knowledgePoint 鍒楀嚭锛屼笉寰楀悎骞禶;
        try {
          const segResponse = await callAI(segPrompt, { taskType: 'analysis', temperature: 0.1, timeout: 60000 });
          const segParsed = await robustJsonParse(segResponse, null, `鍒嗘鍒嗘瀽-${chapter.title}`);
          if (Array.isArray(segParsed)) {
            for (const segResult of segParsed) {
              const segIdx = (segResult.segmentIndex || 1) - 1 - batchStart;
              if (segIdx >= 0 && segIdx < batchSegments.length) {
                segmentCards.push({ text: batchSegments[segIdx], knowledgePoints: segResult.knowledgePoints || [],
                  type: segResult.type || '姝ｆ枃', isKeyConcept: segResult.isKeyConcept || false,
                  isExample: segResult.type === '渚嬮' || batchSegments[segIdx].includes('渚?),
                  isExercise: segResult.type === '缁冧範' || batchSegments[segIdx].includes('缁冧範'),
                  suggestedQuestionTypes: segResult.suggestedQuestionTypes || [],
                  hasFormula: hasFormula(batchSegments[segIdx]) });
              }
            }
          }
        } catch (e) {
          console.warn(`鍒嗘鍒嗘瀽澶辫触锛?{chapter.title}锛夛紝浣跨敤闄嶇骇绛栫暐:`, e.message);
          const fallbackNames = candidateKpNames.length > 0 ? candidateKpNames : [chapter.title];
          for (let si = 0; si < batchSegments.length; si++) {
            const segText = batchSegments[si];
            const matchedFallback = fallbackNames.filter(name => wordBoundaryMatch(segText, name));
            let segType = '姝ｆ枃';
            if (segText.includes('渚?) || /^渚媆d+/.test(segText)) segType = '渚嬮';
            else if (segText.includes('缁冧範') || segText.includes('涔犻')) segType = '缁冧範';
            else if (segText.includes('灏忕粨') || segText.includes('鍥為【')) segType = '灏忕粨';
            segmentCards.push({ text: segText, knowledgePoints: matchedFallback.length > 0 ? matchedFallback : [chapter.title],
              type: segType, isKeyConcept: matchedFallback.length > 0, isExample: segType === '渚嬮',
              isExercise: segType === '缁冧範', suggestedQuestionTypes: [], hasFormula: hasFormula(segText) });
          }
        }
      }
      const allKps = [...new Set(segmentCards.flatMap(s => s.knowledgePoints).filter(kp => typeof kp === 'string' && kp.trim()))];
      const keySegments = segmentCards.filter(s => s.isKeyConcept);
      contentCards.push({ chapterTitle: chapter.title, summary: chapter.coreTopics || allKps.slice(0, 5).join('銆?),
        knowledgePointsForTest: allKps.map(kp => ({ name: kp, cognitiveLevel: '鐞嗚В', sourceText: '', suggestedDifficulty: '鍩虹',
          hasFormula: (chapter.formulas || []).some(f => kp.includes(f.replace(/[^a-zA-Z\u4e00-\u9fa5]/g, '').substring(0, 4)) || f.includes(kp.substring(0, 4))),
          relatedFormulas: (chapter.formulas || []).filter(f => kp.includes(f.replace(/[^a-zA-Z\u4e00-\u9fa5]/g, '').substring(0, 4)) || f.includes(kp.substring(0, 4))).slice(0, 3)
        })), adaptableMaterials: keySegments.slice(0, 5).map(s => s.text.substring(0, 100)),
        suggestedQuestionTypes: [...new Set(segmentCards.flatMap(s => s.suggestedQuestionTypes))].slice(0, 5),
        rawText: cleanRawText, segments: segmentCards, totalSegments: segmentCards.length, tags: allKps });
    }
  }
  return contentCards;
};

// ===== 绗簩姝ワ細鏋勫缓灞傜骇鐭ヨ瘑鍥捐氨 =====
const buildKnowledgeMap = async (contentCards, selectedBooks, callAI, robustJsonParse, updateStatus) => {
  const stepConfig = await getCurrentEngineConfigEnhanced('blueprint');
  const stepModelName = getModelDisplayName(stepConfig.textModel || stepConfig.model);
  if (updateStatus) updateStatus(`绗簩姝ワ細鏋勫缓鐭ヨ瘑鍥捐氨 [${stepModelName}]...`, 20);
  let knowledgeMap = { knowledgePoints: [], keyDifficulties: [], knowledgeGraph: [], crossChapterLinks: [] };
  if (contentCards.length === 0) {
    // 馃敡 闄嶇骇锛氫粠宸插垎鏋愮珷鑺傜殑 knowledgeHierarchy 鎻愬彇鐭ヨ瘑鐐?
    const chapters = selectedBooks?.[0]?.selectedChapters || [];
    const fallbackKps = [];
    for (const ch of chapters) {
      if (ch.knowledgeHierarchy?.length) {
        for (const bc of ch.knowledgeHierarchy) {
          for (const ck of (bc.coreKnowledge || [])) {
            if (ck.name) fallbackKps.push(ck.name);
            if (ck.specificConcepts) fallbackKps.push(...ck.specificConcepts);
          }
        }
      } else if (ch.knowledgePoints?.length) {
        fallbackKps.push(...ch.knowledgePoints);
      }
    }
    knowledgeMap = { knowledgePoints: [...new Set(fallbackKps)].filter(Boolean),
      keyDifficulties: [], knowledgeGraph: [], crossChapterLinks: [] };
    return knowledgeMap;
  }
  const cardsSummary = contentCards.map(c => ({
    title: c.chapterTitle, summary: c.summary, kpForTest: c.knowledgePointsForTest || [],
    keySegmentSamples: (c.segments || []).filter(s => s.isKeyConcept || s.isExample || s.hasFormula).slice(0, 5)
      .map(s => ({ type: s.type, hasFormula: s.hasFormula || false, snippet: (s.text || '').substring(0, 50) })),
    totalSegments: c.totalSegments || 0, tagSummary: (c.tags || []).slice(0, 10),
    suggestedQuestionTypes: c.suggestedQuestionTypes || []
  }));
  // 馃敡 浠庢寚浠ゅ簱鑾峰彇杈撳叆鏁版嵁璇存槑
  const inputDataDescRule = getMatchingBlockInstructions({ category: '分析-知识图谱构建' }).find(b => b.id.includes('input_data_desc'));
  const inputDataDescStr = inputDataDescRule ? inputDataDescRule.content : `- kpForTest锛氭瘡涓煡璇嗙偣瀵硅薄锛宧asFormula=true琛ㄧず娑夊強鍏紡
- suggestedQuestionTypes锛氳绔犺妭鍚勭煡璇嗙偣寤鸿鐨勮€冩煡棰樺瀷`;

  const prompt2 = `浣犳槸璇剧▼涓庢暀瀛︿笓瀹躲€傝鍩轰簬浠ヤ笅鍚勮鍐呭锛屾瀯寤哄眰绾х煡璇嗗浘璋便€?

銆愯緭鍏ユ暟鎹鏄庛€?
${inputDataDescStr}

鍚勮鍐呭姒傝锛?
${JSON.stringify(cardsSummary, null, 2)}

璇峰畬鎴愶細
1. 鐭ヨ瘑鐐规竻鍗曪紙鍘婚噸锛屼笉瓒呰繃30涓級
2. 閲嶉毦鐐瑰垽鏂紙涓嶈秴杩?涓級
3. 灞傜骇鐭ヨ瘑鍥捐氨锛氬崟鍏冣啋澶ф蹇?鈮?)鈫掓牳蹇冪煡璇嗙偣(鈮?)鈫掑叿浣撴蹇?鈮?)锛屾瘡涓牳蹇冪煡璇嗘爣娉ㄥ缓璁鍨?suggestedQuestionTypes)
4. 璺ㄧ珷鑺傚叧鑱旓紙涓嶈秴杩?0鏉★級

杩斿洖JSON锛歿"knowledgePoints":[""],"keyDifficulties":[""],"knowledgeGraph":[{"unit":"","bigConcepts":[{"name":"","coreKnowledge":[{"name":"","cognitiveLevel":"鐞嗚В","isKeyPoint":true,"isDifficulty":false,"specificConcepts":[""],"suggestedQuestionTypes":[""],"relatedChapters":[""],"testPriority":1}]}]}],"crossChapterLinks":[{"from":"","to":"","relation":"鍓嶇疆|骞跺垪|鎷撳睍|搴旂敤"}]}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response2 = await callAI(prompt2, { taskType: attempt >= 1 ? 'blueprint' : 'analysis', temperature: 0.1, maxTokens: attempt >= 1 ? 6144 : 4096, retries: 0 });
      const parsed = await robustJsonParse(response2, (rp) => callAI(rp, { taskType: 'analysis', temperature: 0.1 }), `绗簩姝?灏濊瘯${attempt + 1}`);
      if ((parsed.knowledgeGraph && parsed.knowledgeGraph.length) || (parsed.knowledgePoints && parsed.knowledgePoints.length)) {
        // 馃敡 闃插尽锛氱‘淇?knowledgePoints/keyDifficulties 鍙寘鍚湁鏁堝瓧绗︿覆
        const safeKnowledgePoints = (parsed.knowledgePoints || []).filter(kp => typeof kp === 'string' && kp.trim());
        const safeKeyDifficulties = (parsed.keyDifficulties || []).filter(kd => typeof kd === 'string' && kd.trim());
        knowledgeMap = { knowledgePoints: safeKnowledgePoints, keyDifficulties: safeKeyDifficulties,
          knowledgeGraph: parsed.knowledgeGraph || [], crossChapterLinks: parsed.crossChapterLinks || [] };
        console.log(`鉁?鐭ヨ瘑鍥捐氨鏋勫缓鎴愬姛锛堝皾璇?{attempt + 1}娆★級`);
        break;
      }
      throw new Error('瑙ｆ瀽缁撴灉缂哄皯蹇呰瀛楁');
    } catch (e) { console.warn(`鐭ヨ瘑鍥捐氨鏋勫缓灏濊瘯${attempt + 1}澶辫触:`, e.message); }
  }
  if (!knowledgeMap.knowledgePoints.length && !knowledgeMap.knowledgeGraph.length) {
    const fallbackKPs = contentCards.flatMap(c => (c.knowledgePointsForTest || []).map(k => typeof k === 'string' ? k : (k && k.name ? k.name : '')).filter(Boolean));
    knowledgeMap = { knowledgePoints: [...new Set(fallbackKPs)].filter(kp => typeof kp === 'string' && kp.trim()), keyDifficulties: fallbackKPs.slice(0, 5).filter(kd => typeof kd === 'string' && kd.trim()), knowledgeGraph: [], crossChapterLinks: [] };
    console.warn('鐭ヨ瘑鍥捐氨锛氱煡璇嗗浘璋盇I鐢熸垚澶辫触锛屼娇鐢ㄦ暀鏉愭彁鍙栫煡璇嗙偣闄嶇骇');
  }
  // 馃敡 闃插尽锛氳繑鍥炲墠鏈€缁堝噣鍖栵紝纭繚鎵€鏈夊瓧娈电被鍨嬫纭?
  return {
    knowledgePoints: (knowledgeMap.knowledgePoints || []).filter(kp => typeof kp === 'string' && kp.trim()),
    keyDifficulties: (knowledgeMap.keyDifficulties || []).filter(kd => typeof kd === 'string' && kd.trim()),
    knowledgeGraph: Array.isArray(knowledgeMap.knowledgeGraph) ? knowledgeMap.knowledgeGraph : [],
    crossChapterLinks: Array.isArray(knowledgeMap.crossChapterLinks) ? knowledgeMap.crossChapterLinks : []
  };
};

export function useAiGenerator() {
  const isGenerating = ref(false);
  const progress = ref(0);
  const statusText = ref('');
  const abortController = ref(null);

  // 馃敡 鏂板锛氳褰曚笂娆¤姹傜粨鏉熸椂闂达紝鐢ㄤ簬鏅鸿兘绛夊緟
  const lastRequestEndTime = ref(0);
  // 馃敡 鏂板锛氳褰曚笂娆¤姹傝€楁椂锛堟绉掞級锛岀敤浜庡姩鎬佽皟鏁寸瓑寰呯瓥鐣?
  const lastRequestDuration = ref(0); 

  // 馃敡 鏂板锛氭櫤鑳界瓑寰呭嚱鏁?- 鐘舵€佸浜嗚嚜鍔ㄥ紑濮嬶紝涓嶇敤绛夊埌鏃堕棿缁撴潫
  const smartWait = async (baseTimeMs, statusCheckFn, maxTimeMs = null) => {
    const startTime = Date.now();
    const effectiveMaxTime = maxTimeMs || baseTimeMs * 2;
    
    console.log(`鈴?寮€濮嬫櫤鑳界瓑寰咃細鍩虹${baseTimeMs/1000}绉掞紝鏈€澶?{effectiveMaxTime/1000}绉抈);
    
    await new Promise(resolve => setTimeout(resolve, baseTimeMs / 2));
    
    while (Date.now() - startTime < effectiveMaxTime) {
      if (abortController.value?.signal.aborted) {
        console.log('馃敡 鏅鸿兘绛夊緟琚彇娑?);
        return false;
      }
      
      if (statusCheckFn && statusCheckFn()) {
        const elapsed = Date.now() - startTime;
        console.log(`鉁?鐘舵€佸氨缁紝鎻愬墠缁撴潫绛夊緟锛堝凡绛夊緟${elapsed/1000}绉掞紝鑺傜渷${(baseTimeMs - elapsed)/1000}绉掞級`);
        return true;
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(`鈴?杈惧埌鏈€澶х瓑寰呮椂闂达紙${effectiveMaxTime/1000}绉掞級锛岀户缁墽琛宍);
    return false;
  };

  // ==================== 鏍稿績AI璋冪敤 ====================
  
  // 璋冪敤绾枃鏈珹I
  // 鉁?Token 浼扮畻锛堜腑鏂囩害1.5瀛?token锛岃嫳鏂囩害4瀛楃/token锛?
  const estimateTokens = (text) => {
    if (!text) return 0;
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const otherChars = text.replace(/[\u4e00-\u9fa5]/g, '').length;
    return Math.ceil(chineseChars / 1.5 + otherChars / 4);
  };

  const callAI = async (prompt, options = {}) => {
    // 鉁?鏍规嵁浠诲姟绫诲瀷鑾峰彇瀵瑰簲閰嶇疆锛堟ā鍨?+ 娓╁害锛?
    const taskType = options.taskType || 'generation';
    
    // 馃敡 璋冭瘯鏃ュ織锛氳緭鍑鸿皟鐢ㄥ弬鏁?
    if (taskType === 'analysis') {
      console.log(`馃攳 callAI [${taskType}] 璋冪敤鍙傛暟:`, {
        timeout: options.timeout,
        maxTokens: options.maxTokens,
        temperature: options.temperature,
        promptLength: prompt?.length || 0
      });
    }
    
    // 馃敡 姣忔璋冪敤鍓嶆鏌ユ槸鍚﹀凡鍙栨秷锛堥櫎闈炴槑纭寚瀹?skipAbortCheck锛?
    if (!options.skipAbortCheck && isGenerating.value && abortController.value?.signal.aborted) {
      throw new Error('鐢熸垚宸插彇娑?);
    }
    // 馃敡 淇敼锛氫娇鐢ㄥ寮虹増閰嶇疆锛堟敮鎸佺嫭绔嬪鏌ユā鍨嬪己鍒堕€夋嫨锛?
    const config = await getCurrentEngineConfigEnhanced(taskType, {
      promptLength: prompt?.length || 0,
      requiresChinese: true,
      requiresReasoning: ['blueprint', 'generation', 'review', 'questionValidation'].includes(taskType),
      requiresCreativity: taskType === 'generation'
    });
    const modelName = config.textModel || config.model || 'AI';
    const modelDisplayName = getModelDisplayName(modelName);
    const maxTokens = options.maxTokens || config.maxTokens || 4096;
    
    // 鉁?鍔ㄦ€佽秴鏃讹細鏍规嵁 prompt 闀垮害鑷姩璋冩暣锛?2B+澶фā鍨嬮渶鏇撮暱锛?
    const baseTimeout = options.timeout || 120000;
    const estimatedTokensForTimeout = estimateTokens(prompt);
    // 馃敡 妫€娴嬪ぇ鍙傛暟閲忔ā鍨嬶紝缁欎簣鏇村鏃堕棿
    const isLargeModel = /(32b|70b|72b)/i.test(config.textModel || config.model || '');
    const maxTimeout = isLargeModel ? 600000 : 300000; // 32B+ 鏈€澶?0鍒嗛挓
    const dynamicTimeout = Math.min(
      baseTimeout + (estimatedTokensForTimeout / 1000) * 30000, // 姣?1000 tokens 澧炲姞 30 绉?
      maxTimeout
    );
    const timeout = dynamicTimeout;
    
    if (estimatedTokensForTimeout > 5000) {
      console.log(`鈴?鍔ㄦ€佽秴鏃惰缃? ${timeout/1000}绉?(prompt: ${estimatedTokensForTimeout} tokens, 鍩虹: ${baseTimeout/1000}绉?`);
    }
    
    const retries = options.retries ?? 2;
    
    // 鉁?浼樺厛鐢?options 鐨勬俯搴︼紝鍏舵鐢?config 鐨勬俯搴︼紙宸叉寜浠诲姟绫诲瀷璁剧疆锛?
    const temperature = options.temperature ?? config.temperature ?? 0.7;
    
    let finalPrompt = prompt;
    const estimatedTokens = estimateTokens(prompt);
    const maxInputTokens = Math.floor(maxTokens * 0.7);
    
    if (estimatedTokens > maxInputTokens) {
      console.warn(`鈿狅笍 Prompt杩囬暱(${estimatedTokens} tokens)锛屾鍦ㄦ櫤鑳藉帇缂?..`);
      
      // 馃敡 绛栫暐锛氫紭鍏堜繚鐣欍€屾寚浠よ姹傘€嶅拰銆岄鐩姹傘€嶉儴鍒嗭紝鍘嬬缉銆屽師鏂囧弬鑰冦€?
      // 鎸夋爣璁板垎娈?
      const sections = finalPrompt.split(/\n(?=銆?/);
      let instructionParts = [];
      let materialParts = [];
      
      for (const section of sections) {
        if (section.startsWith('銆愭暀鏉愬師鏂?) || section.startsWith('銆愭ā鏉垮弬鑰?) || section.startsWith('銆愭暀鏉愬弬鑰?)) {
          materialParts.push(section);
        } else {
          instructionParts.push(section);
        }
      }
      
      // 鍏堢‘淇濇寚浠ら儴鍒嗗畬鏁?
      let instructionText = instructionParts.join('\n');
      let instructionTokens = estimateTokens(instructionText);
      
      // 鍓╀綑棰勭畻鍏ㄩ儴鍒嗛厤缁欏師鏂?
      const remainingBudget = maxInputTokens - instructionTokens - 200; // 鐣?200 缂撳啿
      
      if (remainingBudget > 500) {
        let materialText = '';
        let usedTokens = 0;
        
        for (const part of materialParts) {
          const sentences = part.split(/(?<=[銆傦紒锛焅n])/);
          let compressedPart = '';
          
          for (const sent of sentences) {
            const sentTokens = estimateTokens(sent);
            if (usedTokens + sentTokens > remainingBudget) break;
            compressedPart += sent;
            usedTokens += sentTokens;
          }
          
          if (compressedPart) {
            materialText += compressedPart + '\n';
          }
        }
        
        finalPrompt = instructionText + '\n' + materialText;
        console.log(`馃摝 鏅鸿兘鍘嬬缉瀹屾垚锛氭寚浠?{instructionTokens}tokens + 鍘熸枃${usedTokens}tokens = ${instructionTokens + usedTokens}tokens`);
      } else {
        // 鏋佺鎯呭喌锛氭寚浠ゆ湰韬お闀匡紝鍙兘鍘嬬缉鎸囦护涓殑鍘熸枃閮ㄥ垎
        finalPrompt = instructionText.substring(0, Math.floor(maxInputTokens * 1.5));
        console.warn(`鈿狅笍 鎸囦护閮ㄥ垎宸插崰${instructionTokens}tokens锛屾棤娉曞绾冲師鏂囷紝浠呬繚鐣欐寚浠);
      }
    }
    
    // 鉁?甯﹁秴鏃跺拰閲嶈瘯鐨勮皟鐢?
    let lastError = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // 馃敡 绠€鍖栵細鍙湪棣栨璋冪敤鏃舵娴嬫ā鍨?
        if (config.engine === 'ollama' && attempt === 0) {
          console.log(`馃攳 鏂囨湰鍒嗘瀽 [${taskType}]锛氭娴嬫ā鍨?..`);
          await checkModelReady(null, 3, 'text');
          // 绠€鍗曠瓑寰?2 绉掗鐑?
          await new Promise(r => setTimeout(r, 2000));
        }
        
        if (attempt > 0) {
          // 閲嶈瘯鏃跺浐瀹氱瓑寰?
          const waitTime = config.engine === 'ollama' ? 5000 : Math.min(2000 * Math.pow(2, attempt - 1), 10000);
          console.log(`馃攧 鏂囨湰鍒嗘瀽 [${taskType}] 绗?{attempt}娆￠噸璇曪紝绛夊緟 ${waitTime/1000} 绉?..`);
          await new Promise(r => setTimeout(r, waitTime));
          
          if (statusText?.value !== undefined) {
            statusText.value = `馃攧 姝ｅ湪閲嶈瘯 [${modelDisplayName}]...锛堢${attempt}娆★級`;
          }
        }
        
        if (config.engine === 'ollama') {
          // 鉁?鏂板锛歄llama 杩炴帴棰勬
          if (attempt === 0) {
            try {
              await axios.get(`${config.baseUrl}/api/tags`, { timeout: 5000 });
            } catch (preflightErr) {
              console.warn(`鈿狅笍 Ollama 杩炴帴澶辫触(${preflightErr.message})锛岃纭 Ollama 宸插惎鍔╜);
              throw new Error(`Ollama 鏈嶅姟涓嶅彲鐢細${preflightErr.message}銆傝鍚姩 Ollama 鍚庨噸璇曘€俙);
            }
          }
          
          const response = await axios.post(
            `${config.baseUrl}/api/generate`,
            {
              model: config.textModel,
              prompt: finalPrompt,
              stream: false,
              keep_alive: 600,  // 馃敡 淇濇寔 10 鍒嗛挓锛岄伩鍏嶉绻侀噸鏂板姞杞?
              options: {
                temperature: temperature,
                num_predict: maxTokens,
                top_p: apiConfig.generationSettings.topP || 0.9,
                repeat_penalty: apiConfig.generationSettings.repeatPenalty || 1.1,
                // 馃敡 R1/鎺ㄧ悊妯″瀷浼樺寲锛氶檺鍒朵笂涓嬫枃绐楀彛閬垮厤鐖嗘樉瀛橈紝num_gpu=999 鏈€澶у寲 GPU 灞?
                ...(config.textModel?.includes('r1') || config.textModel?.includes('deepseek') ? {
                  num_ctx: 4096,
                  num_gpu: 999
                } : {})
              }
            },
            { 
              timeout,
              signal: abortController.value?.signal  // 馃敡 鏀寔鍙栨秷
            }
          );
          
          let ollamaDone = response.data.done;
          let responseText = response.data.response || '';

          // 馃敡 鏂板锛氳嚜鍔ㄧ画鍐欐満鍒?
          const allowContinuation = options.allowContinuation !== false;
          const isTruncated = !ollamaDone && responseText.length > 10;

          if (isTruncated && allowContinuation) {
            console.log(`馃攧 Ollama 杈撳嚭琚埅鏂紝灏濊瘯缁啓...锛堝綋鍓嶉暱搴︼細${responseText.length}锛塦);
            
            // 鍙栨渶鍚?300 瀛椾綔涓虹画鍐欐彁绀?
            const tailText = responseText.slice(-300);
            const continuationPrompt = `銆愮户缁€戣浠庝笂涓€娆¤緭鍑虹殑鏈€鍚庝竴涓瓧寮€濮嬶紝缁х画鍚庨潰鐨勫唴瀹广€備笉瑕侀噸澶嶅凡鏈夋枃瀛椼€俓n\n涓婁竴娈垫湯灏撅細${tailText}\n\n缁х画锛歚;
            
            let continuationResponse;
            try {
              continuationResponse = await axios.post(
                `${config.baseUrl}/api/generate`,
                {
                  model: config.textModel,
                  prompt: continuationPrompt,
                  stream: false,
                  options: {
                    temperature: Math.max(0, temperature - 0.2),
                    num_predict: Math.floor(maxTokens * 0.5),
                    top_p: 0.9,
                    repeat_penalty: 1.2
                  }
                },
                { 
                  timeout: Math.floor(timeout * 0.6),
                  signal: abortController.value?.signal  // 馃敡 鏀寔鍙栨秷
                }
              );
              
              const continuationText = continuationResponse.data.response || '';
              if (continuationText && continuationText.length > 5) {
                // 馃敡 澧炲己锛氭洿鏅鸿兘鐨勫幓閲嶁€斺€旀壘鍒版渶闀垮叕鍏卞墠缂€骞舵埅鎺?
                let cleanContinuation = continuationText;
                
                // 绛栫暐1锛氱簿纭尮閰嶆湯灏?0瀛?
                const tailWords = tailText.slice(-20);
                if (cleanContinuation.startsWith(tailWords)) {
                  cleanContinuation = cleanContinuation.slice(tailWords.length);
                } else {
                  // 绛栫暐2锛氭笎杩涘紡鍖归厤鈥斺€斾粠10瀛楀埌3瀛楅€掑噺
                  let overlapFound = false;
                  for (let overlapLen = 15; overlapLen >= 3; overlapLen--) {
                    const tailOverlap = tailText.slice(-overlapLen);
                    if (cleanContinuation.startsWith(tailOverlap)) {
                      cleanContinuation = cleanContinuation.slice(overlapLen);
                      overlapFound = true;
                      console.log(`馃敡 鎵惧埌閲嶅彔(闀垮害${overlapLen})锛屽凡鍘婚櫎`);
                      break;
                    }
                  }
                  if (!overlapFound && cleanContinuation.length > 30) {
                    // 绛栫暐3锛氭鏌ユ槸鍚︽湁鎹㈣鍒嗛殧锛屽彇鎹㈣鍚庣殑鍐呭
                    const newlineIdx = cleanContinuation.indexOf('\n');
                    if (newlineIdx > 0 && newlineIdx < 30) {
                      const afterNewline = cleanContinuation.slice(newlineIdx + 1).trim();
                      if (afterNewline.length > 5) {
                        cleanContinuation = afterNewline;
                        console.log('馃敡 鍙栨崲琛屽悗鍐呭浣滀负缁啓');
                      }
                    }
                  }
                }
                
                // 馃敡 鏂板锛氱画鍐欒川閲忔鏌モ€斺€斿鏋滅画鍐欏唴瀹瑰お鐭垨鍏ㄦ槸绌虹櫧锛屾斁寮冪画鍐?
                if (cleanContinuation.trim().length < 3) {
                  console.warn('鈿狅笍 缁啓鍐呭杩囩煭锛屼娇鐢ㄥ師杈撳嚭');
                } else {
                  responseText += cleanContinuation;
                  console.log(`鉁?缁啓瀹屾垚锛屾€婚暱搴︼細${responseText.length}`);
                }
              } else {
                console.warn('鈿狅笍 缁啓杩斿洖鍐呭杩囩煭锛屼娇鐢ㄥ師杈撳嚭');
              }
            } catch (e) {
              console.warn('鈿狅笍 缁啓璇锋眰澶辫触锛屼娇鐢ㄥ師杈撳嚭:', e.message);
            }
          } else if (isTruncated && !allowContinuation) {
            console.warn(`鈿狅笍 Ollama 杈撳嚭琚埅鏂絾宸茬鐢ㄧ画鍐欙紝闀垮害=${responseText.length}`);
          }
          
          // 馃敡 R1/鎺ㄧ悊妯″瀷杈撳嚭娓呮礂锛氬幓鎺?<锝渆nd鈻乷f鈻乼hinking锝?鏍囩
          responseText = cleanReasoningOutput(responseText);
          
          return responseText;
        } else {
          // 馃敡 DeepSeek API 璋冪敤锛氭櫤鑳芥瀯寤?URL锛岄伩鍏嶉噸澶嶆嫾鎺?
          let apiUrl = config.baseUrl || '';
          
          // 馃敡 闃插尽锛氱‘淇?apiUrl 鏈夋晥
          if (!apiUrl) {
            throw new Error('DeepSeek API 鍦板潃鏈厤缃紝璇峰湪璁剧疆涓～鍐?API 鍦板潃');
          }
          
          // 濡傛灉 baseUrl 宸茬粡鍖呭惈 /chat/completions锛岀洿鎺ヤ娇鐢?
          if (apiUrl.includes('/chat/completions')) {
            console.warn('鈿狅笍 baseUrl 宸插寘鍚畬鏁磋矾寰勶紝鐩存帴浣跨敤');
          } else if (apiUrl.endsWith('/v1')) {
            // 濡傛灉浠?/v1 缁撳熬锛屾嫾鎺?/chat/completions
            apiUrl = `${apiUrl}/chat/completions`;
          } else {
            // 鍚﹀垯鎷兼帴 /v1/chat/completions
            apiUrl = `${apiUrl.replace(/\/$/, '')}/v1/chat/completions`;
          }
          
          console.log(`馃敆 DeepSeek API URL: ${apiUrl}`);
          
          const response = await axios.post(
            apiUrl,
            {
              model: config.model,
              messages: [{ role: 'user', content: finalPrompt }],
              temperature: temperature,
              max_tokens: maxTokens,
              top_p: apiConfig.generationSettings.topP || 0.9
            },
            { 
              headers: { 'Authorization': `Bearer ${config.apiKey}` },
              timeout,
              signal: abortController.value?.signal  // 馃敡 鏀寔鍙栨秷
            }
          );
          
          let content = response.data.choices?.[0]?.message?.content || '';
          const finishReason = response.data.choices?.[0]?.finish_reason;

          // 馃敡 鏂板锛欴eepSeek 鑷姩缁啓鏈哄埗
          const allowContinuation = options.allowContinuation !== false;
          const isTruncated = finishReason === 'length' && content.length > 10;
          
          if (isTruncated && allowContinuation) {
            console.log(`馃攧 DeepSeek 杈撳嚭琚埅鏂紝灏濊瘯缁啓...锛堝綋鍓嶉暱搴︼細${content.length}锛塦);
            
            const tailText = content.slice(-300);
            const continuationMessages = [
              { role: 'user', content: finalPrompt },
              { role: 'assistant', content: content },
              { role: 'user', content: `璇蜂粠涓婁竴娆¤緭鍑虹殑鏈€鍚庝竴涓瓧寮€濮嬶紝缁х画鍚庨潰鐨勫唴瀹广€備笉瑕侀噸澶嶅凡鏈夋枃瀛楋紝涓嶈閲嶆柊寮€濮嬨€俓n涓婁竴娈垫湯灏撅細${tailText}` }
            ];
            
            try {
              const continuationResponse = await axios.post(
                apiUrl,  // 馃敡 浣跨敤鐩稿悓鐨?API URL
                {
                  model: config.model,
                  messages: continuationMessages,
                  temperature: Math.max(0, temperature - 0.2),
                  max_tokens: Math.floor(maxTokens * 0.5),
                  top_p: 0.9
                },
                { 
                  headers: { 'Authorization': `Bearer ${config.apiKey}` },
                  timeout: Math.floor(timeout * 0.6),
                  signal: abortController.value?.signal  // 馃敡 鏀寔鍙栨秷
                }
              );
              
              const continuationText = continuationResponse.data.choices?.[0]?.message?.content || '';
              if (continuationText && continuationText.length > 5) {
                // 馃敡 澧炲己锛氭洿鏅鸿兘鐨勫幓閲嶁€斺€旀壘鍒版渶闀垮叕鍏卞墠缂€骞舵埅鎺?
                let cleanContinuation = continuationText;
                
                // 绛栫暐1锛氱簿纭尮閰嶆湯灏?0瀛?
                const tailWords = tailText.slice(-20);
                if (cleanContinuation.startsWith(tailWords)) {
                  cleanContinuation = cleanContinuation.slice(tailWords.length);
                } else {
                  // 绛栫暐2锛氭笎杩涘紡鍖归厤鈥斺€斾粠15瀛楀埌3瀛楅€掑噺
                  let overlapFound = false;
                  for (let overlapLen = 15; overlapLen >= 3; overlapLen--) {
                    const tailOverlap = tailText.slice(-overlapLen);
                    if (cleanContinuation.startsWith(tailOverlap)) {
                      cleanContinuation = cleanContinuation.slice(overlapLen);
                      overlapFound = true;
                      console.log(`馃敡 鎵惧埌閲嶅彔(闀垮害${overlapLen})锛屽凡鍘婚櫎`);
                      break;
                    }
                  }
                  if (!overlapFound && cleanContinuation.length > 30) {
                    // 绛栫暐3锛氭鏌ユ槸鍚︽湁鎹㈣鍒嗛殧
                    const newlineIdx = cleanContinuation.indexOf('\n');
                    if (newlineIdx > 0 && newlineIdx < 30) {
                      const afterNewline = cleanContinuation.slice(newlineIdx + 1).trim();
                      if (afterNewline.length > 5) {
                        cleanContinuation = afterNewline;
                        console.log('馃敡 鍙栨崲琛屽悗鍐呭浣滀负DeepSeek缁啓');
                      }
                    }
                  }
                }
                
                // 馃敡 鏂板锛氱画鍐欒川閲忔鏌?
                if (cleanContinuation.trim().length < 3) {
                  console.warn('鈿狅笍 DeepSeek缁啓鍐呭杩囩煭锛屼娇鐢ㄥ師杈撳嚭');
                } else {
                  content += cleanContinuation;
                  console.log(`鉁?DeepSeek 缁啓瀹屾垚锛屾€婚暱搴︼細${content.length}`);
                }
              } else {
                console.warn('鈿狅笍 DeepSeek 缁啓杩斿洖鍐呭杩囩煭锛屼娇鐢ㄥ師杈撳嚭');
              }
            } catch (e) {
              console.warn('鈿狅笍 DeepSeek 缁啓璇锋眰澶辫触锛屼娇鐢ㄥ師杈撳嚭:', e.message);
            }
          } else if (isTruncated && !allowContinuation) {
            console.warn(`鈿狅笍 DeepSeek 杈撳嚭琚埅鏂絾宸茬鐢ㄧ画鍐欙紝闀垮害=${content.length}`);
          }
          
          // 馃敡 R1/鎺ㄧ悊妯″瀷杈撳嚭娓呮礂锛氬幓鎺? response鏍囩銆乪moji銆丠TML 鍖呰９绛?
          content = cleanReasoningOutput(content);
          return content;
        }
      } catch (e) {
        lastError = e;
        
        // 鉁?澧炲己閿欒鍒嗙被澶勭悊
        if (e.response?.status === 429) {
          // 闄愭祦锛氭寜鏈嶅姟鍣ㄨ姹傜瓑寰?
          const retryAfter = parseInt(e.response.headers?.['retry-after']) || 5;
          console.warn(`鈴?闄愭祦(429)锛岀瓑寰?{retryAfter}绉?..`);
          await new Promise(r => setTimeout(r, retryAfter * 1000));
        } else if (e.response?.status === 401) {
          // 璁よ瘉澶辫触
          console.error(`馃攽 DeepSeek API Key 鏃犳晥(401)`);
          throw new Error('DeepSeek API Key 鏃犳晥锛岃鍦ㄨ缃腑閲嶆柊閰嶇疆');
        } else if (e.response?.status === 402) {
          // 浣欓涓嶈冻
          console.error(`馃挵 DeepSeek 浣欓涓嶈冻(402)`);
          throw new Error('DeepSeek 璐︽埛浣欓涓嶈冻锛岃鍏呭€煎悗閲嶈瘯');
        } else if (e.response?.status === 500) {
          // AI 鏈嶅姟鍣ㄥ唴閮ㄩ敊璇?
          console.error(`馃挜 AI 鏈嶅姟鍣ㄥ唴閮ㄩ敊璇?500)`);
          
          // 灏濊瘯鑾峰彇鏇磋缁嗙殑閿欒淇℃伅
          const errorDetail = e.response.data?.error?.message || e.message || '鏈煡閿欒';
          console.error('   閿欒璇︽儏:', errorDetail);
          
          // 鎻愪緵鍏蜂綋鐨勮В鍐冲缓璁?
          let suggestion = '璇风◢鍚庨噸璇?;
          if (errorDetail.toLowerCase().includes('model')) {
            suggestion = '妯″瀷鍙兘鏈姞杞斤紝璇锋鏌?Ollama 鏈嶅姟鐘舵€?;
          } else if (errorDetail.toLowerCase().includes('memory') || errorDetail.toLowerCase().includes('oom')) {
            suggestion = '鏄惧瓨涓嶈冻锛岃鍏抽棴鍏朵粬搴旂敤鎴栭噸鍚?Ollama';
          } else if (errorDetail.toLowerCase().includes('timeout')) {
            suggestion = '璇锋眰瓒呮椂锛岃妫€鏌ョ綉缁滆繛鎺?;
          }
          
          throw new Error(`AI 鏈嶅姟閿欒: ${suggestion}`);
          
        } else if (e.response?.status === 503 || e.response?.status === 502) {
          // 鏈嶅姟鏆傛椂涓嶅彲鐢?
          console.warn(`馃寪 DeepSeek 鏈嶅姟鏆傛椂涓嶅彲鐢?${e.response.status})锛岄噸璇曚腑...`);
        } else if (e.code === 'ECONNABORTED') {
          console.warn(`鈴?callAI [${taskType}] 瓒呮椂(${timeout/1000}绉?锛屽皾璇?{attempt+1}/${retries+1}`);
        } else if (e.code === 'ECONNREFUSED' || e.code === 'ENOTFOUND') {
          // 杩炴帴澶辫触
          console.error(`馃寪 鏃犳硶杩炴帴鍒?${config.engine} 鏈嶅姟(${e.code})`);
          throw new Error(`鏃犳硶杩炴帴鍒?${config.engine} 鏈嶅姟锛岃妫€鏌ョ綉缁滃拰閰嶇疆`);
        } else if (e.code === 'ECONNRESET') {
          // 杩炴帴琚噸缃?
          console.warn(`馃寪 杩炴帴琚噸缃紝鍙兘鏄綉缁滀笉绋冲畾`);
          throw new Error('缃戠粶杩炴帴涓嶇ǔ瀹氾紝璇锋鏌ョ綉缁滃悗閲嶈瘯');
        } else if (e.message?.includes('JSON') || e.message?.includes('parse')) {
          // JSON 瑙ｆ瀽澶辫触
          console.warn(`馃摑 JSON 瑙ｆ瀽澶辫触`);
          throw new Error('AI 杩斿洖鏍煎紡寮傚父锛岃閲嶈瘯鎴栬仈绯绘妧鏈敮鎸?);
        } else if (e.message?.includes('aborted') || e.message?.includes('鍙栨秷')) {
          // 璇锋眰宸插彇娑?
          console.log(`馃洃 璇锋眰宸插彇娑坄);
          // 涓嶆姏鍑洪敊璇紝鍥犱负杩欐槸鐢ㄦ埛涓诲姩鍙栨秷
          return null;
        } else if (e.message?.includes('Ollama 鏈嶅姟涓嶅彲鐢?)) {
          // 棰勬澶辫触锛岀洿鎺ユ姏鍑?
          throw e;
        } else {
          console.warn(`鉂?callAI [${taskType}] 澶辫触(${e.message})锛屽皾璇?{attempt+1}/${retries+1}`);
        }
        
        if (attempt >= retries) throw e;
      }
    }
    throw lastError;
  };

  // 馃敡 鏂板锛氭娴?HTML 鍐呭鏄惁琚埅鏂紙鏍囩涓嶅畬鏁达級
  const isHtmlTruncated = (content) => {
    if (!content || typeof content !== 'string') return false;
    
    // 鍙娴嬪疄闄?HTML 杈撳嚭
    const hasHtmlTags = /<[a-zA-Z][^>]*>/.test(content);
    if (!hasHtmlTags) return false;
    
    // 缁熻鏍囩
    const tagCounts = {};
    const tagMatches = content.match(/<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g) || [];
    
    for (const tag of tagMatches) {
      const isClosing = tag.startsWith('</');
      const tagName = isClosing ? tag.slice(2, -1).split(/\s/)[0] : tag.slice(1, -1).split(/\s/)[0];
      
      if (!tagCounts[tagName]) tagCounts[tagName] = { open: 0, close: 0 };
      if (isClosing) {
        tagCounts[tagName].close++;
      } else if (!tag.endsWith('/>')) { // 鑷棴鍚堜笉绠?
        tagCounts[tagName].open++;
      }
    }
    
    // 鍙娴嬪叧閿粨鏋勬爣绛?
    const structuralTags = ['div', 'table', 'ul', 'ol', 'section'];
    for (const tag of structuralTags) {
      const counts = tagCounts[tag];
      if (counts && counts.open !== counts.close) {
        return true; // 鏍囩涓嶅尮閰?
      }
    }
    
    return false;
  };

  // 馃敡 鏂板锛氭鏌ュ妯℃€佹ā鍨嬫槸鍚﹀凡鍔犺浇
  const checkModelLoaded = async () => {
    try {
      const config = await getMultimodalConfig();
      const response = await fetch(`${config.baseUrl}/api/ps`, { 
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000)
      });
      
      if (!response.ok) {
        return false;
      }
      
      const data = await response.json();
      const loadedModels = data?.models || [];
      const isLoaded = loadedModels.some(m => m.name === config.model);
      
      console.log(`馃搳 妯″瀷鐘舵€? ${config.model} - ${isLoaded ? '宸插湪鍐呭瓨' : '鏈姞杞?}`);
      return isLoaded;
    } catch (e) {
      console.warn('鈿狅笍 鏃犳硶妫€鏌ユā鍨嬬姸鎬?', e.message);
      return false;
    }
  };

  // 馃敡 浼樺寲锛氭娴嬫ā鍨嬫槸鍚︾湡姝ｅ氨缁紙閫氳繃鍙戦€佽交閲忔祴璇曡姹傦級
  const checkModelReady = async (testImageBase64, maxAttempts = 3, modelType = 'multimodal') => {
    console.log(`馃攳 寮€濮嬫娴?{modelType === 'multimodal' ? '澶氭ā鎬? : '鏂囨湰'}妯″瀷灏辩华鐘舵€?..`);
    
    const startTime = Date.now();
    const maxWaitTime = 600000; // 10鍒嗛挓锛堝厹搴曪級
    let pollInterval = 1000; // 馃敡 鍒濆杞闂撮殧1绉掞紝缁欐ā鍨嬫洿澶氬姞杞芥椂闂?
    let attemptCount = 0;
    let lastError = null;
    
    // 馃敡 缁熶竴閰嶇疆锛氭牴鎹ā鍨嬬被鍨嬭缃笉鍚岀殑瓒呮椂鏃堕棿
    const timeoutConfig = {
      multimodal: {
        psTimeout: 5000,      // /api/ps 妫€鏌ヨ秴鏃?
        warmupTimeout: 20000, // 馃敡 棰勭儹璇锋眰澧炲姞鍒?0绉掞紝搴斿HTTP 500
        callAITimeout: 15000  // callAI 妫€娴嬭秴鏃?
      },
      text: {
        callAITimeout: 180000  // 馃敡 鏂囨湰妯″瀷澧炲姞鍒?80绉掞紝32B妯″瀷棣栨鍔犺浇闇€瑕?0-120绉?
      }
    };
    
    while (Date.now() - startTime < maxWaitTime) {
      attemptCount++;
      try {
        if (modelType === 'multimodal') {
          // 馃敡 鍏抽敭淇锛氫娇鐢?/api/ps 鎺ュ彛妫€鏌ユā鍨嬫槸鍚﹀湪鍐呭瓨涓?
          const config = await getMultimodalConfig();
          
          // 馃敡 PaddleOCR-VL pipeline 妯″紡锛氭棤 HTTP 绔偣锛岀洿鎺ヨ繑鍥炲氨缁?
          if (config.engine === 'paddleocr_vl') {
            console.log('鉁?PaddleOCR-VL pipeline 妯″紡锛岃烦杩?HTTP 妫€娴?);
            return { ready: true, responseTime: 0, attempts: 1 };
          }
          
          // 馃敡 鍙湪绗竴娆″皾璇曟椂鎵撳嵃寮曟搸淇℃伅锛岄伩鍏嶆棩蹇楀啑浣?
          if (attemptCount === 1) {
            console.log(`馃摗 灏濊瘯杩炴帴澶氭ā鎬佹ā鍨? ${config.model} @ ${config.baseUrl}`);
          }
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeoutConfig.multimodal.psTimeout);
          
          // 浣跨敤 /api/ps 鎺ュ彛妫€鏌ユā鍨嬫槸鍚﹀凡鍔犺浇
          const response = await fetch(`${config.baseUrl}/api/ps`, {
            method: 'GET',
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          
          const data = await response.json();
          const models = data.models || [];
          
          // 妫€鏌ョ洰鏍囨ā鍨嬫槸鍚﹀湪杩愯鐨勬ā鍨嬪垪琛ㄤ腑
          const isModelLoaded = models.some(m => m.name === config.model || m.model === config.model);
          
          if (isModelLoaded) {
            const elapsed = Date.now() - startTime;
            console.log(`鉁?澶氭ā鎬佹ā鍨嬪凡鍦ㄥ唴瀛樹腑 (绛夊緟${elapsed}ms, 灏濊瘯${attemptCount}娆?`);
            return { ready: true, responseTime: elapsed, attempts: attemptCount };
          } else {
            // 妯″瀷涓嶅湪鍐呭瓨涓紝灏濊瘯鍙戦€佷竴涓交閲忚姹傛潵鍔犺浇瀹?
            console.log(`鈿狅笍 妯″瀷鏈姞杞斤紝灏濊瘯鍙戦€侀鐑姹傦紙瓒呮椂: ${timeoutConfig.multimodal.warmupTimeout/1000}绉掞級...`);
            
            const warmupController = new AbortController();
            const warmupTimeoutId = setTimeout(() => warmupController.abort(), timeoutConfig.multimodal.warmupTimeout);
            
            // 鍒涘缓涓€涓渶灏忕殑閫忔槑PNG鍥剧墖锛?x1鍍忕礌锛変綔涓烘祴璇?
            const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
            
            try {
              const warmupResponse = await fetch(`${config.baseUrl}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  model: config.model,
                  messages: [
                    {
                      role: 'user',
                      content: 'OK',
                      images: [testImageBase64]
                    }
                  ],
                  stream: false,
                  options: {
                    num_predict: 5,
                    temperature: 0.1
                  }
                }),
                signal: warmupController.signal
              });
              
              clearTimeout(warmupTimeoutId);
              
              if (warmupResponse.ok) {
                const warmupData = await warmupResponse.json();
                const result = warmupData.message?.content || warmupData.response || '';
                
                if (result && result.trim().length > 0) {
                  const elapsed = Date.now() - startTime;
                  console.log(`鉁?澶氭ā鎬佹ā鍨嬮鐑垚鍔?(绛夊緟${elapsed}ms, 灏濊瘯${attemptCount}娆?`);
                  return { ready: true, responseTime: elapsed, attempts: attemptCount };
                }
              } else {
                // 馃敡 鍏抽敭淇锛氶拡瀵?00閿欒锛屽鍔犳洿璇︾粏鐨勮瘖鏂俊鎭?
                if (warmupResponse.status === 500) {
                  console.warn(`鈿狅笍 棰勭儹璇锋眰杩斿洖 HTTP 500锛屾ā鍨嬪彲鑳芥鍦ㄥ垵濮嬪寲鎴朑PU璧勬簮涓嶈冻`);
                  // 妫€鏌PU鐘舵€侊紙濡傛灉鍙敤锛?
                  if (window.electronAPI?.getOllamaGpuStatus) {
                    try {
                      const gpuStatus = await window.electronAPI.getOllamaGpuStatus();
                      console.warn(`馃捇 GPU鐘舵€? ${gpuStatus.status}, 鏄惧瓨浣跨敤: ${gpuStatus.memoryUsage || '鏈煡'}`);
                    } catch (e) {
                      // 蹇界暐GPU鐘舵€佽幏鍙栭敊璇?
                    }
                  }
                } else {
                  console.warn(`鈿狅笍 棰勭儹璇锋眰杩斿洖 HTTP ${warmupResponse.status}锛屾ā鍨嬪彲鑳芥鍦ㄥ姞杞戒腑`);
                }
              }
            } catch (warmupError) {
              clearTimeout(warmupTimeoutId);
              console.warn(`鈿狅笍 棰勭儹璇锋眰澶辫触: ${warmupError.message}锛屾ā鍨嬪彲鑳芥鍦ㄥ姞杞戒腑`);
              // 馃敡 濡傛灉鏄綉缁滈敊璇垨瓒呮椂锛屾彁渚涙洿鍏蜂綋鐨勫缓璁?
              if (warmupError.name === 'AbortError') {
                console.warn(`鈿狅笍 棰勭儹璇锋眰瓒呮椂锛屾ā鍨嬪彲鑳介渶瑕佹洿闀挎椂闂村姞杞斤紝璇锋鏌ョ郴缁熻祫婧恅);
              } else if (warmupError.message.includes('fetch')) {
                console.warn(`鈿狅笍 缃戠粶杩炴帴闂锛岃纭Ollama鏈嶅姟鏄惁姝ｅ父杩愯`);
              }
            }
            
            console.log(`鈿狅笍 绗?{attemptCount}娆″皾璇曪細妯″瀷鏈氨缁猔);
          }
        } else {
          // 馃敡 鏂囨湰妯″瀷妫€娴嬶細鏍规嵁褰撳墠寮曟搸閰嶇疆閫夋嫨妫€娴嬫柟寮?
          const textConfig = await getCurrentEngineConfigEnhanced('generation');
          
          if (textConfig.engine === 'ollama') {
            // 馃敡 淇锛氱洿鎺ヤ娇鐢?fetch 娴嬭瘯 Ollama 妯″瀷锛岄伩鍏嶉€掑綊璋冪敤 callAI
            console.log(`馃摗 鍙戦€?Ollama 鏂囨湰妯″瀷娴嬭瘯璇锋眰锛堣秴鏃? ${timeoutConfig.text.callAITimeout/1000}绉掞級...`);
            
            try {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), timeoutConfig.text.callAITimeout);
              
              const response = await fetch(`${textConfig.baseUrl}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  model: textConfig.textModel,
                  prompt: 'OK',
                  stream: false,
                  options: { temperature: 0.1 }
                }),
                signal: controller.signal
              });
              
              clearTimeout(timeoutId);
              
              if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
              }
              
              const data = await response.json();
              
              if (data.response && data.response.trim().length > 0) {
                const elapsed = Date.now() - startTime;
                console.log(`鉁?Ollama 鏂囨湰妯″瀷鍝嶅簲姝ｅ父 (绛夊緟${elapsed}ms, 灏濊瘯${attemptCount}娆?`);
                return { ready: true, responseTime: elapsed, attempts: attemptCount };
              } else {
                console.log(`鈿狅笍 绗?{attemptCount}娆″皾璇曡繑鍥炵┖鍝嶅簲`);
              }
            } catch (e) {
              console.warn(`鈿狅笍 鏂囨湰妯″瀷妫€娴嬪け璐? ${e.message}`);
            }
          } else if (textConfig.engine === 'deepseek') {
            // 馃敡 DeepSeek 鏂囨湰妯″瀷锛氱洿鎺ユ祴璇?API 杩炴帴
            console.log(`馃摗 娴嬭瘯 DeepSeek API 杩炴帴...`);
            
            try {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), timeoutConfig.text.callAITimeout);
              
              // 馃敡 鍏抽敭淇锛氭櫤鑳芥瀯寤?API URL锛岄伩鍏嶉噸澶嶆嫾鎺?
              let apiUrl = textConfig.baseUrl;
              
              // 濡傛灉 baseUrl 宸茬粡鍖呭惈 /chat/completions锛岀洿鎺ヤ娇鐢?
              if (apiUrl.includes('/chat/completions')) {
                console.warn('鈿狅笍 baseUrl 宸插寘鍚畬鏁磋矾寰勶紝鐩存帴浣跨敤');
              } else if (apiUrl.endsWith('/v1')) {
                // 濡傛灉浠?/v1 缁撳熬锛屾嫾鎺?/chat/completions
                apiUrl = `${apiUrl}/chat/completions`;
              } else {
                // 鍚﹀垯鎷兼帴 /v1/chat/completions
                apiUrl = `${apiUrl.replace(/\/$/, '')}/v1/chat/completions`;
              }
              
              console.log(`馃敆 DeepSeek API URL: ${apiUrl}`);
              
              const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${textConfig.apiKey.trim()}`
                },
                body: JSON.stringify({
                  model: textConfig.model,
                  messages: [
                    { role: 'user', content: '璇峰洖澶?OK"' }
                  ],
                  temperature: 0.1,
                  max_tokens: 10
                }),
                signal: controller.signal
              });
              
              clearTimeout(timeoutId);
              
              if (response.ok) {
                const data = await response.json();
                const result = data.choices?.[0]?.message?.content || '';
                
                if (result && result.trim().length > 0) {
                  const elapsed = Date.now() - startTime;
                  console.log(`鉁?DeepSeek API 杩炴帴姝ｅ父 (绛夊緟${elapsed}ms, 灏濊瘯${attemptCount}娆?`);
                  return { ready: true, responseTime: elapsed, attempts: attemptCount };
                } else {
                  console.log(`鈿狅笍 绗?{attemptCount}娆″皾璇曡繑鍥炵┖鍝嶅簲`);
                }
              } else {
                const errorText = await response.text();
                console.warn(`鈿狅笍 DeepSeek API 杩斿洖 HTTP ${response.status}: ${errorText.substring(0, 200)}`);
                
                // 馃敡 鍏抽敭淇锛氬鏋滄槸400閿欒锛岃鏄庨厤缃湁闂锛屽簲璇ョ珛鍗冲仠姝㈤噸璇?
                if (response.status === 400) {
                  console.error('鉂?DeepSeek API 閰嶇疆閿欒锛?00锛夛紝璇锋鏌ワ細');
                  console.error('   1. API瀵嗛挜鏄惁姝ｇ‘');
                  console.error('   2. 妯″瀷鍚嶇О鏄惁姝ｇ‘锛堝簲璇ユ槸 deepseek-chat锛?);
                  console.error('   3. API鍦板潃鏄惁姝ｇ‘锛堝簲璇ユ槸 https://api.deepseek.com/v1锛?);
                  
                  const elapsed = Date.now() - startTime;
                  // 杩斿洖 ready=false锛岃涓婂眰鐭ラ亾妯″瀷涓嶅彲鐢?
                  return { 
                    ready: false, 
                    responseTime: elapsed, 
                    attempts: attemptCount, 
                    error: new Error('DeepSeek API閰嶇疆閿欒锛圚TTP 400锛夛紝璇锋鏌ヨ缃?)
                  };
                }
                
                // 鍏朵粬閿欒缁х画閲嶈瘯
                console.log(`鈿狅笍 绗?{attemptCount}娆″皾璇曞け璐);
              }
            } catch (e) {
              clearTimeout(timeoutId);
              console.warn(`鈿狅笍 DeepSeek API 妫€娴嬪け璐? ${e.message}`);
              
              // 濡傛灉鏄綉缁滈敊璇垨瓒呮椂锛屾彁渚涘缓璁?
              if (e.name === 'AbortError') {
                console.warn(`鈿狅笍 DeepSeek API 璇锋眰瓒呮椂锛岃妫€鏌ョ綉缁滆繛鎺);
              } else if (e.message.includes('fetch')) {
                console.warn(`鈿狅笍 鏃犳硶杩炴帴鍒?DeepSeek API锛岃妫€鏌ョ綉缁滄垨API鍦板潃`);
              }
            }
          } else {
            console.warn(`鈿狅笍 鏈煡鐨勬枃鏈紩鎿? ${textConfig.engine}`);
          }
        }
      } catch (e) {
        lastError = e;
        // 杈撳嚭閿欒淇℃伅锛屼究浜庤皟璇?
        if (attemptCount <= 3 || attemptCount % 10 === 0) {
          console.warn(`鈿狅笍 绗?{attemptCount}娆℃娴嬪け璐? ${e.message}`);
        }
        // 濡傛灉杩炵画澶辫触澶氭锛岄€傚綋澧炲姞杞闂撮殧
        if (attemptCount > 3) {
          pollInterval = Math.min(pollInterval * 1.5, 3000); // 馃敡 鏈€澶?绉掗棿闅旓紝澧為暱鏇村钩缂?
        }
      }
      
      await new Promise(r => setTimeout(r, pollInterval));
    }
    
    const totalWait = Date.now() - startTime;
    console.error(`鉂?妯″瀷鏈湪${totalWait}ms鍐呭氨缁?(鎬诲皾璇曟鏁? ${attemptCount})`);
    if (lastError) {
      console.error(`鏈€鍚庨敊璇? ${lastError.message}`);
      console.error(`閿欒鍫嗘爤:`, lastError.stack);
    }
    return { ready: false, responseTime: totalWait, attempts: attemptCount, error: lastError };
  };

  // 馃敡 鏂板锛氭櫤鑳界瓑寰呮ā鍨嬬┖闂诧紙鍩轰簬涓婃璇锋眰缁撴潫鏃堕棿锛?
  const smartWaitForModel = async (minWaitMs = 2000, maxWaitMs = 8000) => {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestEndTime.value;
    
    // 馃敡 鍏抽敭淇锛氬鏋滀笂娆¤姹傝繕鍦ㄨ繘琛屼腑锛堢悊璁轰笂涓嶅簲璇ュ彂鐢燂級锛屽己鍒剁瓑寰?
    if (timeSinceLastRequest < 0) {
      console.warn(`鈿狅笍 妫€娴嬪埌寮傚父锛氫笂娆¤姹傛椂闂存埑鍦ㄦ湭鏉ワ紝寮哄埗绛夊緟${maxWaitMs}ms`);
      await new Promise(r => setTimeout(r, maxWaitMs));
      return;
    }
    
    // 馃敡 浼樺寲锛氫笉鍐嶅崟绾緷璧栨椂闂存帹绠楋紝鑰屾槸瀹為檯妫€娴嬫ā鍨嬬姸鎬?
    console.log(`馃攳 瀹為檯妫€娴嬫ā鍨嬪氨缁姸鎬?..`);
    
    try {
      // 閫氳繃 /api/ps 鎺ュ彛瀹為檯妫€鏌ユā鍨嬫槸鍚﹀湪鍐呭瓨涓笖绌洪棽
      const config = await getMultimodalConfig();
      const psResponse = await fetch(`${config.baseUrl}/api/ps`, { 
        signal: AbortSignal.timeout(3000) 
      });
      
      if (psResponse.ok) {
        const psData = await psResponse.json();
        const currentModel = config.model;
        const modelInMemory = psData.models?.find(m => 
          m.name === currentModel || m.model === currentModel
        );
        
        if (modelInMemory) {
          // 馃敡 鍏抽敭锛氭鏌ユā鍨嬫槸鍚︽鍦ㄥ鐞嗚姹?
          const isProcessing = modelInMemory.expires_at && 
                              new Date(modelInMemory.expires_at).getTime() > Date.now();
          
          if (!isProcessing) {
            console.log(`鉁?妯″瀷宸插氨缁笖绌洪棽锛堣窛涓婃璇锋眰${(timeSinceLastRequest/1000).toFixed(1)}绉掞級`);
            return;  // 妯″瀷鐪熸绌洪棽锛屾棤闇€绛夊緟
          } else {
            console.log(`鈴?妯″瀷浠嶅湪澶勭悊涓紝闇€瑕佺瓑寰?..`);
            
            // 馃敡 鏂板锛氬鏋滅瓑寰呮椂闂磋繃闀匡紙瓒呰繃20绉掞級锛屽皾璇曞己鍒跺嵏杞藉苟閲嶆柊鍔犺浇
            if (timeSinceLastRequest > 20000) {
              console.warn(`鈿狅笍 妯″瀷绻佸繖瓒呰繃20绉掞紝灏濊瘯寮哄埗鍗歌浇骞堕噸鏂板姞杞?..`);
              try {
                // 鍗歌浇妯″瀷
                await fetch(`${config.baseUrl}/api/generate`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    model: currentModel,
                    keep_alive: 0  // 绔嬪嵆鍗歌浇
                  })
                });
                console.log(`鉁?妯″瀷宸插嵏杞斤紝绛夊緟3绉掑悗閲嶆柊鍔犺浇...`);
                await new Promise(r => setTimeout(r, 3000));
                
                // 閲嶆柊鍔犺浇妯″瀷锛堝彂閫佷竴涓┖璇锋眰锛?
                await fetch(`${config.baseUrl}/api/chat`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    model: currentModel,
                    messages: [{ role: 'user', content: 'hi' }],
                    stream: false
                  })
                });
                console.log(`鉁?妯″瀷宸查噸鏂板姞杞絗);
                return;  // 閲嶆柊鍔犺浇鍚庣洿鎺ヨ繑鍥?
              } catch (unloadError) {
                console.warn(`鈿狅笍 寮哄埗鍗歌浇澶辫触:`, unloadError.message);
                // 缁х画鎵ц淇濆畧绛夊緟绛栫暐
              }
            }
          }
        } else {
          console.log(`鈿狅笍 妯″瀷涓嶅湪鍐呭瓨涓紝闇€瑕侀噸鏂板姞杞絗);
        }
      }
    } catch (e) {
      console.warn(`鈿狅笍 鏃犳硶妫€娴嬫ā鍨嬬姸鎬? ${e.message}锛屼娇鐢ㄤ繚瀹堢瓑寰呯瓥鐣);
    }
    
    // 馃敡 濡傛灉鏃犳硶妫€娴嬫垨妯″瀷绻佸繖锛屼娇鐢ㄥ熀浜庢椂闂寸殑淇濆畧绛夊緟绛栫暐
    let adjustedMinWait = minWaitMs;
    if (lastRequestDuration.value > 60000) {
      adjustedMinWait = Math.max(minWaitMs, 15000);
      console.log(`鈿狅笍 涓婃璇锋眰鑰楁椂${(lastRequestDuration.value/1000).toFixed(1)}绉掞紝淇濆畧绛夊緟${adjustedMinWait}ms`);
    } else if (lastRequestDuration.value > 30000) {
      adjustedMinWait = Math.max(minWaitMs, 10000);
      console.log(`鈿狅笍 涓婃璇锋眰鑰楁椂${(lastRequestDuration.value/1000).toFixed(1)}绉掞紝淇濆畧绛夊緟${adjustedMinWait}ms`);
    } else if (lastRequestDuration.value > 15000) {
      adjustedMinWait = Math.max(minWaitMs, 8000);
      console.log(`鈿狅笍 涓婃璇锋眰鑰楁椂${(lastRequestDuration.value/1000).toFixed(1)}绉掞紝淇濆畧绛夊緟${adjustedMinWait}ms`);
    }
    
    // 濡傛灉璺濈涓婃璇锋眰宸茬粡瓒呰繃璋冩暣鍚庣殑鏈€灏忕瓑寰呮椂闂达紝鍐嶆灏濊瘯妫€娴?
    if (timeSinceLastRequest >= adjustedMinWait) {
      // 鍐嶆妫€娴嬬‘璁?
      try {
        const config = await getMultimodalConfig();
        const psResponse = await fetch(`${config.baseUrl}/api/ps`, { 
          signal: AbortSignal.timeout(2000) 
        });
        
        if (psResponse.ok) {
          const psData = await psResponse.json();
          const currentModel = config.model;
          const modelInMemory = psData.models?.find(m => 
            m.name === currentModel || m.model === currentModel
          );
          
          if (modelInMemory && !modelInMemory.expires_at) {
            console.log(`鉁?浜屾纭锛氭ā鍨嬪凡绌洪棽`);
            return;
          }
        }
      } catch (e) {
        // 妫€娴嬪け璐ワ紝缁х画绛夊緟
      }
    }
    
    // 鍚﹀垯绛夊緟鍓╀綑鏃堕棿
    const remainingWait = adjustedMinWait - timeSinceLastRequest;
    const actualWait = Math.min(remainingWait, maxWaitMs);
    
    if (actualWait > 0) {
      console.log(`鈴?鏅鸿兘绛夊緟妯″瀷绌洪棽锛?{actualWait}ms锛堣窛涓婃璇锋眰${timeSinceLastRequest}ms锛塦);
      await new Promise(r => setTimeout(r, actualWait));
    } else {
      console.log(`鉁?妯″瀷宸茬┖闂诧紝鏃犻渶绛夊緟`);
    }
  };  

  // 璋冪敤澶氭ā鎬丄I (缁熶竴璧?PaddleOCR-VL锛屽凡鏇夸唬 Ollama 澶氭ā鎬?
  const callMultimodalAI = async (prompt, imageBase64, options = {}) => {
    // 妫€鏌ユ槸鍚﹀凡鍙栨秷锛堥櫎闈炴槑纭寚瀹?skipAbortCheck锛?
    if (!options.skipAbortCheck && abortController.value?.signal.aborted) {
      console.warn('callMultimodalAI 妫€娴嬪埌宸插彇娑堬紝涓璋冪敤');
      throw new Error('宸插彇娑?);
    }

    const taskType = options.taskType || 'extraction';
    // extraction 浠诲姟璧?pipeline 妯″紡锛堢粨鏋勫寲鏂囨。瑙ｆ瀽锛?
    // 鍏朵粬浠诲姟锛堟弿杩般€佸垎鏋愮瓑锛夎蛋 chat 妯″紡锛圴LM 瀵硅瘽锛?
    const mode = taskType === 'extraction' ? 'pipeline' : 'chat';

    // 鍙傛暟鏍￠獙
    if (!imageBase64) {
      console.error('callMultimodalAI: imageBase64 涓虹┖');
      return '';
    }
    if (!prompt) {
      console.error('callMultimodalAI: prompt 涓虹┖');
      return '';
    }

    if (!window.electronAPI?.paddleOcrVLChat) {
      console.error('PaddleOCR-VL API 涓嶅彲鐢?);
      return '';
    }

    try {
      console.log(`${mode === 'chat' ? 'VLM' : 'OCR'} 璋冪敤 PaddleOCR-VL (${mode} 妯″紡)`);

      const result = await window.electronAPI.paddleOcrVLChat(
        prompt,
        [imageBase64],
        {
          mode,
          maxTokens: mode === 'chat' ? (options.maxTokens || 256) : undefined
        }
      );

      if (result.success && result.text) {
        console.log(`PaddleOCR-VL 瀹屾垚: ${result.total_length || result.text.length}瀛梎);
        return result.text;
      }

      console.error(`PaddleOCR-VL 澶辫触: ${result.error || '鏃犳枃瀛楄繑鍥?}`);
      return '';
    } catch (e) {
      console.error(`PaddleOCR-VL 璋冪敤寮傚父: ${e.message}`);
      return '';
    }
  };

  // 閲嶆瀯锛氬寮虹殑鏂囧瓧鎻愬彇锛堟爮鍒囧壊 + 涓茶閲嶈瘯 + 鍒嗗绉戝悗澶勭悊锛?
  const extractTextRobustly = async (imageBase64, options = {}) => {
    const { subject = '', stage = '', imagePath = '' } = options;
  
    let columnType = '鍗曟爮';
    let subImageBase64List = [];
  
    // ========== 绗竴姝ワ細鏍忔娴嬩笌鍒囧壊 ==========
    if (imagePath && window.electronAPI?.splitColumns) {
      try {
        const storagePath = getStoragePath();
        const tmpDir = `${storagePath}/鏆傚瓨鍖?_columns_${Date.now()}`;
        const columnResult = await window.electronAPI.splitColumns(imagePath, tmpDir);
      
        if (columnResult.columns > 1) {
            columnType = `${columnResult.columns}鏍廯;
            console.log(`馃搻 妫€娴嬪埌${columnType}鎺掔増锛堝垏鍓茬偣: ${(columnResult.splits || []).join(', ')}锛夛紝绛夊緟鐢ㄦ埛纭鍒囧壊`);
        
            // 娓呯悊涓存椂鍒囧壊鐩綍
            try {
              await window.electronAPI.deleteDirectory(tmpDir);
            } catch {}
          
            // 馃敡 鏂板锛氭娴嬪埌澶氭爮锛岃繑鍥炲垏鍓蹭俊鎭瓑寰呯敤鎴锋墜鍔ㄧ‘璁?
            return {
              text: '',
              ocrQuality: 'pending_column_split',
              columnType,
              splits: columnResult.splits || [],
              subImages: columnResult.sub_images || [],
              imagePath,
              originalBase64: imageBase64
            };
        }
      } catch (e) {
        console.warn('鈿狅笍 鏍忔娴嬪け璐ワ紝鎸夊崟鏍忓鐞?', e.message);
      }
    }
  
    // ========== 绗簩姝ワ細OCR 鎻愬彇 ==========
    const ocrPrompts = [
      // Prompt 1锛氱簿绠€鐗堬紙鐩存帴鎸囦护锛屽噺灏戞€濊€冿級
      `璇烽€愬瓧閫愬彞鎻愬彇鍥剧墖涓殑鎵€鏈夋枃瀛椼€?

瑕佹眰锛?
1. 鍙緭鍑哄師鏂囷紝涓嶈浠讳綍瑙ｉ噴銆佹弿杩般€佹€荤粨
2. 淇濈暀鎵€鏈夋牸寮忥細鎹㈣銆佺┖鏍笺€佹爣鐐广€侀鍙枫€侀€夐」锛圓.B.C.D.锛?
3. 杩囨护鏃犲叧鍐呭锛氭按鍗般€佺函椤电爜銆佽楗扮鍙?
4. 淇濈暀鏈変环鍊煎唴瀹癸細绔犺妭鏍囬銆佺煡璇嗙偣娉ㄩ噴銆佸叕寮忋€佽〃鏍?
5. 涓嶇‘瀹氭椂鍔犮€愶紵銆戞爣璁帮紝涓嶈鐚滄祴

鐩存帴杈撳嚭璇嗗埆鐨勬枃瀛楋細`,

      // Prompt 2锛氭渶绠€鐗堬紙鍏滃簳锛?
      '璇疯瘑鍒苟杈撳嚭鍥剧墖涓殑鎵€鏈夋枃瀛楀唴瀹广€?
    ];    
  
    // ========== 鍗曟爮锛氫覆琛屽皾璇?==========
    let finalText = '';
    
    for (let attempt = 0; attempt < ocrPrompts.length; attempt++) {
      try {
        finalText = await callMultimodalAI(ocrPrompts[attempt], imageBase64, { 
          taskType: 'extraction',
          maxRetries: 1,
          imagePath: imagePath  // 馃敡 鏂板锛氫緵 PaddleOCR 璺敱浣跨敤
        });
        
        if (finalText && finalText.trim().length >= 50) {
          break;
        }
        
        if (attempt < ocrPrompts.length - 1) {
          console.log(`鈿狅笍 鍗曟爮 prompt${attempt + 1}鎻愬彇涓嶈冻(${finalText?.length || 0}瀛?锛屽皾璇曠畝鍖杙rompt...`);
        }
      } catch (e) {
        console.warn(`鈿狅笍 鍗曟爮 prompt${attempt + 1}澶辫触:`, e.message);
      }
    }

    // 馃敡 淇K锛氬鐞?DIM锛堟ā绯婂浘鐗囨爣璁帮級
    if (finalText && finalText.trim() === 'DIM') {
      console.warn(`鈿狅笍 OCR 杩斿洖 DIM锛堝浘鐗囨ā绯婏級锛屽皾璇曟渶鍚庝竴娆￠檷绾ф彁鍙?..`);
      try {
        finalText = await callMultimodalAI(
          '杩欏紶鍥剧墖鍙兘鏈変簺妯＄硦锛岃灏藉姏鎻愬彇鍏朵腑鍙鐨勬枃瀛椼€傚鏋滅‘瀹炰竴涓瓧涔熺湅涓嶆竻锛屽洖澶?DIM"銆備笉瑕佽В閲娿€?,
          imageBase64,
          { taskType: 'extraction', maxRetries: 0, imagePath: imagePath }
        );
      } catch (e) {
        console.warn('DIM闄嶇骇鎻愬彇涔熷け璐ヤ簡:', e.message);
      }
    }
  
    if (finalText && subject) {
      finalText = postProcessOCR(finalText, subject, stage);
    }
    
    const quality = checkOCRQuality(finalText, subject);
    
    return {
      text: finalText || '',
      ocrQuality: quality.quality,
      columnType
    };
  };

  // ==================== 绋冲畾鐨勬壒閲忓師鏂囨彁鍙栵紙閲嶆柊璁捐锛?===================
  /**
   * 馃幆 绋冲畾鍙潬鐨勭珷鑺傚師鏂囨彁鍙栨柟妗堬紙鍔ㄦ€佹娴嬬増锛?
   * 
   * 鏍稿績绛栫暐锛?
   * 1. 瀹為檯妫€娴嬫ā鍨嬬姸鎬?- 涓嶄緷璧栧浐瀹氭椂闂?
   * 2. 妫€娴婫PU鏄惧瓨浣跨敤鎯呭喌 - 纭繚鏈夎冻澶熻祫婧?
   * 3. 妫€娴嬪埌灏辩华绔嬪嵆鎵ц - 涓嶆氮璐圭瓑寰呮椂闂?
   * 4. 寮哄埗閲嶈瘯鏈哄埗 - 绌哄€肩珛鍗抽噸璇曪紝鏈€澶?娆?
   * 5. 娓呮櫚鏃ュ織杈撳嚭 - 鍙樉绀哄叧閿俊鎭?
   * 
   * @param {Array} pages - 椤甸潰鍒楄〃 [{pageNum, imageBase64, imagePath}]
   * @param {Object} options - 閰嶇疆閫夐」
   * @returns {Object} { text: 瀹屾暣鏂囨湰, qualityReport: 璐ㄩ噺鎶ュ憡 }
   */
  const extractChapterTextSequentially = async (pages, options = {}) => {
    const { 
      subject = '', 
      stage = '',
      onProgress = null,
      onPageComplete = null
    } = options;

    const MAX_RETRIES = 3;
    const MIN_TEXT_LENGTH = 50;
    
    console.log(` PaddleOCR-VL ${pages.length}`);
    
    const results = [];
    let mergedText = '';
    const qualityReport = {
      totalPages: pages.length,
      successPages: 0,
      failedPages: 0,
      retryPages: 0,
      pageDetails: []
    };

    console.log(`\n ${pages.length}`);
    console.log(`${MAX_RETRIES}${MIN_TEXT_LENGTH}\n`);

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const pageNum = page.pageNum;

      // PaddleOCR-VL pipeline 锛?
      let pageText = '';
      let retryCount = 0;
      let success = false;

      while (retryCount < MAX_RETRIES && !success) {
        try {
          if (retryCount > 0) {
            console.log(`${pageNum}${retryCount}...`);
            await new Promise(r => setTimeout(r, 3000));
          }

          // OCR
          const ocrPrompt = `璇烽€愬瓧閫愬彞鎻愬彇鍥剧墖涓殑鎵€鏈夋枃瀛椼€?

瑕佹眰锛?
1. 鍙緭鍑哄師鏂囷紝涓嶈浠讳綍瑙ｉ噴銆佹弿杩般€佹€荤粨
2. 淇濈暀鎵€鏈夋牸寮忥細鎹㈣銆佺┖鏍笺€佹爣鐐广€侀鍙枫€侀€夐」锛圓.B.C.D.锛?
3. 杩囨护鏃犲叧鍐呭锛氭按鍗般€佺函椤电爜銆佽楗扮鍙?
4. 淇濈暀鏈変环鍊煎唴瀹癸細绔犺妭鏍囬銆佺煡璇嗙偣娉ㄩ噴銆佸叕寮忋€佽〃鏍?
5. 涓嶇‘瀹氭椂鍔犮€愶紵銆戞爣璁帮紝涓嶈鐚滄祴

鐩存帴杈撳嚭璇嗗埆鐨勬枃瀛楋細`;

          pageText = await callMultimodalAI(ocrPrompt, page.imageBase64, { 
            taskType: 'extraction',
            maxRetries: 0, // 涓嶅湪callMultimodalAI鍐呴儴閲嶈瘯锛岀敱澶栧眰鎺у埗
            timeout: 120000, // 2鍒嗛挓瓒呮椂
            imagePath: page.imagePath  // 馃敡 鏂板锛氫緵 PaddleOCR 璺敱浣跨敤
          });

          // 楠岃瘉缁撴灉
          if (pageText && pageText.trim().length >= MIN_TEXT_LENGTH) {
            success = true;
            console.log(`鉁?绗?{pageNum}椤碉細OCR鎴愬姛 (${pageText.trim().length}瀛?`);
          } else {
            console.warn(`鈿狅笍 绗?{pageNum}椤碉細缁撴灉杩囩煭(${pageText?.trim().length || 0}瀛?锛岄渶瑕侀噸璇昤);
            retryCount++;
          }

        } catch (e) {
          console.error(`鉂?绗?{pageNum}椤碉細OCR璋冪敤澶辫触 - ${e.message}`);
          retryCount++;
        }
      }

      // 馃敡 姝ラ3锛氬鐞嗙粨鏋?
      const pageDetail = {
        pageNum,
        success,
        retryCount,
        textLength: pageText?.trim().length || 0
      };

      if (success) {
        // 瀛︾鍚庡鐞?
        if (subject) {
          pageText = postProcessOCR(pageText, subject, stage);
        }

        mergedText += (mergedText ? '\n' : '') + pageText;
        qualityReport.successPages++;
        
        if (retryCount > 0) {
          qualityReport.retryPages++;
        }

        console.log(`馃摑 绗?{pageNum}椤碉細宸插悎骞?(绱${mergedText.length}瀛?`);
        
        // 鍥炶皟閫氱煡
        if (onPageComplete) {
          onPageComplete(pageNum, pageText.trim().length);
        }
      } else {
        qualityReport.failedPages++;
        console.error(`馃毃 绗?{pageNum}椤碉細瀹屽叏澶辫触锛堝凡閲嶈瘯${MAX_RETRIES}娆★級`);
        
        // 娣诲姞閿欒鏍囪
        mergedText += (mergedText ? '\n' : '') + 
          `\n鈿狅笍[绯荤粺閿欒锛氱${pageNum}椤礝CR璇嗗埆澶辫触锛岃瀵圭収鍘熷PDF鎵嬪姩琛ュ厖姝ら儴鍒嗗唴瀹筣\n`;
      }

      qualityReport.pageDetails.push(pageDetail);

      // 杩涘害鍥炶皟
      if (onProgress) {
        onProgress(i + 1, pages.length);
      }
    }

    console.log(`\n鉁?鎵归噺鎻愬彇瀹屾垚锛氭垚鍔?{qualityReport.successPages}椤?| 澶辫触${qualityReport.failedPages}椤?| 閲嶈瘯${qualityReport.retryPages}椤礰);
    console.log(`馃搳 鎬诲瓧鏁帮細${mergedText.length}\n`);

    return {
      text: mergedText,
      qualityReport
    };
  };

  // 馃搻 鐙珛鐨勫鏍忔娴嬪嚱鏁扳€斺€旂敤鎴锋墜鍔ㄨЕ鍙戯紝涓嶈嚜鍔ㄥ脊鍑?
  const detectMultiColumnPages = async (pages, options = {}) => {
    const { subject = '', stage = '' } = options;
    const pendingColumnPages = [];
    
    console.log(`\n馃搻 鎵嬪姩澶氭爮妫€娴嬶細鍏?{pages.length}椤礰);
    
    for (const page of pages) {
      const pageNum = page.pageNum;
      
      if (!page.imagePath || !window.electronAPI?.splitColumns) {
        console.warn(`鈿狅笍 绗?{pageNum}椤碉細缂哄皯 imagePath 鎴?splitColumns API锛岃烦杩嘸);
        continue;
      }
      
      try {
        const storagePath = getStoragePath();
        const tmpDir = `${storagePath}/鏆傚瓨鍖?_columns_${Date.now()}_${pageNum}`;
        const columnResult = await window.electronAPI.splitColumns(page.imagePath, tmpDir);
        
        try { await window.electronAPI.deleteDirectory(tmpDir); } catch {}
        
        if (columnResult.columns > 1) {
          pendingColumnPages.push({
            page: pageNum,
            ocrResult: {
              ocrQuality: 'pending_column_split',
              columnType: `${columnResult.columns}鏍廯,
              splits: columnResult.splits || [],
              subImages: columnResult.sub_images || []
            },
            imageBase64: page.imageBase64,
            imagePath: page.imagePath,
            subject,
            stage
          });
          console.log(`馃搻 绗?{pageNum}椤碉細妫€娴嬪埌${columnResult.columns}鏍忔帓鐗坄);
        }
      } catch (e) {
        console.warn(`鈿狅笍 绗?{pageNum}椤碉細鏍忔娴嬪け璐? ${e.message}`);
      }
    }
    
    console.log(`馃搻 澶氭爮妫€娴嬪畬鎴愶細${pendingColumnPages.length}涓鏍忛〉闈);
    return pendingColumnPages;
  };

  // 馃敡 鏂板锛歄CR璐ㄩ噺妫€鏌?
  const checkOCRQuality = (text, subject) => {
    if (!text || text.trim().length < 5) {
      return { quality: 'poor', reason: '鏂囧瓧杩囧皯' };
    }

    const cleanText = text.trim();
    
    if (cleanText.length < 200) {
      return { 
        quality: 'warning', 
        reason: `鏂囧瓧杩囧皯(${cleanText.length}瀛?锛屽彲鑳戒笉瀹屾暣鎴栭潪鍘熸枃鍐呭` 
      };
    }

    const chineseChars = (cleanText.match(/[\u4e00-\u9fa5]/g) || []).length;
    const totalChars = cleanText.replace(/\s/g, '').length;
    const chineseRatio = totalChars > 0 ? chineseChars / totalChars : 0;

    if (subject !== '鑻辫' && chineseRatio < 0.3) {
      return { 
        quality: 'poor', 
        reason: `涓枃瀛楃姣斾緥杩囦綆(${(chineseRatio * 100).toFixed(0)}%)` 
      };
    }

    const gibberishPattern = /[鈻♀枲鈼嗏棁鈼嬧棌鈻斥柌鈻解柤鈽嗏槄鈾♀櫏]/g;
    const gibberishCount = (cleanText.match(gibberishPattern) || []).length;
    if (gibberishCount > cleanText.length * 0.05) {
      return { 
        quality: 'warning', 
        reason: `鍙兘瀛樺湪璇嗗埆閿欒(${gibberishCount}涓紓甯稿瓧绗?` 
      };
    }

    return { quality: 'good', reason: '姝ｅ父' };
  };

  // ==================== OCR 缁撴灉楠岃瘉 ====================
  /**
   * 馃敡 楠岃瘉 OCR 缁撴灉鏄惁鏈夋晥
   */
  const validateOCRResult = (text, subject) => {
    if (!text || text.trim().length < 5) {
      return { valid: false, reason: '鏂囧瓧杩囧皯' };
    }
    
    const cleanText = text.trim();
    
    // 妫€鏌ワ細鏄惁鏄槑鏄剧殑AI瑙ｉ噴鑰岄潪鍘熸枃
    const aiDescriptionPatterns = [
      /^杩欐槸/,
      /^鍥剧墖涓?,
      /^鏁欐潗涓?,
      /^璇ラ〉/,
      /^鏈〉鏄?,
      /^灞曠ず/,
      /^鍐呭涓?,
      /^涓昏涓?,
      /^鎻忚堪浜?,
      /^浠嬬粛浜?,
      /^杩欏紶/,
      /^杩欏箙/,
      /^椤甸潰/,
      /^璇炬枃/,
      /^鏈/,
      /^杩欎竴椤?,
      /^杩欓儴鍒?,
      /鍥剧墖灞曠ず/,
      /鍐呭鍖呭惈/,
      /涓昏璁?,
    ];
    
    for (const pattern of aiDescriptionPatterns) {
      if (pattern.test(cleanText)) {
        return { valid: false, reason: `鐤戜技AI鎻忚堪鑰岄潪鍘熸枃锛堝尮閰? ${pattern}锛塦 };
      }
    }
    
    // 绾浘鐗囬〉鏍囪
    if (cleanText.includes('绾浘鐗?) || cleanText === 'NO_TEXT') {
      return { valid: true, reason: '绾浘鐗囬〉' };
    }
    
    // 妯＄硦椤垫爣璁?
    if (cleanText === 'DIM') {
      return { valid: false, reason: '鍥剧墖妯＄硦' };
    }
    
    // 鍐呭杩囩煭
    if (cleanText.length < 10) {
      return { valid: false, reason: `鍐呭杩囩煭(${cleanText.length}瀛?` };
    }
    
    return { valid: true, reason: '姝ｅ父' };
  };

  // ==================== 鏁欐潗鍥剧墖鍒嗘瀽锛堟彁鍙栧師鏂囷級 ====================
  const analyzeTextbookImage = async (imageBase64, subject, stage, grade, imagePath = '', chapterInfo = {}) => {
    // 馃敡 鑷姩鍒ゆ柇鏄惁涓哄璇〉锛氭湁瀛愯妭鐐?+ 鍙湁1-2椤?
    // 馃敡 淇C锛氬鍔犳帓闄ゆ潯浠讹紝閬垮厤鈥滃崟鍏冨皬缁撯€濃€滄暣鐞嗕笌澶嶄範鈥濊璇垽涓哄璇〉
    const isSummaryPage = chapterInfo.title && /灏忕粨|鎬荤粨|鏁寸悊|澶嶄範|鍥為【|鐭ヨ瘑褰掔撼/.test(chapterInfo.title);
    const isGuidePage = chapterInfo.hasChildren && chapterInfo.pageCount <= 2 && !isSummaryPage;
      
    let rawText = '';
    
    // 鉁?鐩存帴浣跨敤澶氭ā鎬丩LM锛坬wen3-vl锛夎繘琛孫CR
    let ocrAttempts = 0;
    const MAX_OCR_ATTEMPTS = 3;
    
    while (ocrAttempts < MAX_OCR_ATTEMPTS) {
      ocrAttempts++;
      
      console.log(`馃攧 OCR灏濊瘯 ${ocrAttempts}/${MAX_OCR_ATTEMPTS}...`);
      
      rawText = await callMultimodalAI(
          `璇烽€愬瓧閫愬彞鎻愬彇鍥剧墖涓殑鎵€鏈夋枃瀛椼€?

瑕佹眰锛?
1. 鍙緭鍑哄師鏂囷紝涓嶈浠讳綍瑙ｉ噴銆佹弿杩般€佹€荤粨
2. 淇濈暀鎵€鏈夋牸寮忥細鎹㈣銆佺┖鏍笺€佹爣鐐广€侀鍙枫€侀€夐」锛圓.B.C.D.锛?
3. 杩囨护鏃犲叧鍐呭锛氭按鍗般€佺函椤电爜銆佽楗扮鍙?
4. 淇濈暀鏈変环鍊煎唴瀹癸細绔犺妭鏍囬銆佺煡璇嗙偣娉ㄩ噴銆佸叕寮忋€佽〃鏍?
5. 涓嶇‘瀹氭椂鍔犮€愶紵銆戞爣璁帮紝涓嶈鐚滄祴
6. 鍥剧墖妯＄硦鐪嬩笉娓?鈫?杈撳嚭"DIM"
7. 鏃犳枃瀛?鈫?杈撳嚭"NO_TEXT"
8. 蹇界暐鎷奸煶娉ㄩ煶锛堝 zh菐n, d煤 绛夛級锛屽彧鎻愬彇姹夊瓧鍜屾爣鐐?

鐩存帴杈撳嚭璇嗗埆鐨勬枃瀛楋細`,
          imageBase64,
          { 
            taskType: 'extraction',
            timeout: 600000,  // 馃敡 鏄惧紡璁剧疆10鍒嗛挓瓒呮椂
            maxRetries: 1,
            think: false,      // 馃敡 寮哄埗鍏抽棴鎬濊€冩ā寮忥紝鎻愰珮鍝嶅簲閫熷害
            imagePath: imagePath  // 馃敡 鏂板锛氫緵 PaddleOCR 璺敱浣跨敤
          }
        ) || '';
      
      console.log(`馃摑 OCR杩斿洖鏂囨湰闀垮害: ${rawText?.length || 0}瀛梎);
      if (rawText && rawText.length > 0) {
        console.log(`馃摑 OCR杩斿洖鏂囨湰鍓?00瀛? ${rawText.substring(0, 100)}`);
      }
        
        const validation = validateOCRResult(rawText, subject);
        console.log(`鉁?OCR楠岃瘉缁撴灉: ${validation.valid ? '閫氳繃' : '澶辫触'} - ${validation.reason}`);
        
        if (validation.valid) {
          console.log(`鉁?OCR鎴愬姛: ${rawText.length}瀛梎);
          break;
        } else {
          console.warn(`鈿狅笍 OCR楠岃瘉澶辫触锛屽噯澶囬噸璇?..`);
        }
    }
    
    // 濡傛灉鎵€鏈夐噸璇曢兘澶辫触锛屼娇鐢ㄩ檷绾х瓥鐣?
    if (!validateOCRResult(rawText, subject).valid) {
      console.warn('鈿狅笍 鏍囧噯OCR鍏ㄩ儴澶辫触锛屼娇鐢ㄩ檷绾х瓥鐣?..');
      rawText = await callMultimodalAI(
        '璇蜂粠杩欏紶鍥剧墖涓彁鍙栨墍鏈夊彲瑙佺殑鏂囧瓧銆傚鏋滃畬鍏ㄦ病鏈夋枃瀛楋紝鍙洖澶?鏃犳枃瀛?銆備笉瑕佸仛浠讳綍瑙ｉ噴銆?,
        imageBase64,
        { taskType: 'extraction', maxRetries: 0, imagePath: imagePath }
      ) || '';
    }
        
    if (rawText && subject) {
      rawText = postProcessOCR(rawText, subject, stage);
    }
  
    let ocrQuality = checkOCRQuality(rawText, subject);
      
    console.log('馃摉 鏁欐潗鍘熸枃鎻愬彇缁撴灉闀垮害:', rawText?.length || 0, isGuidePage ? '(瀵艰椤?' : '');

    // 濡傛灉瀹屽叏澶辫触
    if (!rawText || rawText.trim().length < 5) {
      console.error('鉂?鏁欐潗鍘熸枃鎻愬彇瀹屽叏澶辫触');
      return {
        rawText: rawText || '',
        visualDescription: '',
        formulas: [],
        coreTopics: '',
        knowledgePoints: [],
        knowledgeHierarchy: [],
        competency: '鐞嗚В',
        style: '浼犵粺',
        ocrQuality: 'poor'
      };
    }

    console.log(`馃摉 OCR璐ㄩ噺: ${ocrQuality.quality}`);

    // 馃敡 鏂规B锛氬崟椤靛彧鍋歄CR鎻愬彇锛孉I鍒嗘瀽鐢卞灞?analyzeTextbookWithText 缁熶竴澶勭悊
    // 鍘熷洜锛氶伩鍏嶉噸澶嶅垎鏋愶紝鑺傜渷鏃堕棿鍜屾樉瀛橈紙姣忕珷浠?娆I璋冪敤闄嶅埌1娆★級
    return {
      rawText,
      visualDescription: '',
      formulas: [],
      coreTopics: '',
      knowledgePoints: [],
      knowledgeHierarchy: [],
      competency: extractGradeNum(grade) <= 6 ? '璇嗚涓庣悊瑙? : '搴旂敤涓庡垎鏋?,
      style: '浼犵粺',
      ocrQuality: ocrQuality.quality,
      isGuidePage
    };
  };

  // ==================== 鏂板锛氳嚜鍔ㄦ彁鍙栫煡璇嗙偣 ====================
  const extractKnowledgePoints = async (imageBase64, subject, stage, grade, chapterTitle) => {
    const prompt = `浣犳槸涓€浣?{stage}${grade}${subject}瀛︾涓撳銆傝浠庤繖寮犳暀鏉愰〉闈紙绔犺妭锛?{chapterTitle}锛変腑锛屾彁鍙栧嚭鏈€鏍稿績鐨勭煡璇嗙偣銆?
  瑕佹眰锛?
  1. 姣忎釜鐭ヨ瘑鐐圭敤涓€鍙ヨ瘽姒傛嫭銆?
  2. 鍙彁鍙栨渶鏍稿績鐨?-5涓煡璇嗙偣銆?
  3. 姣忚涓€涓煡璇嗙偣锛屼笉瑕佺紪鍙枫€?

  璇风洿鎺ヨ緭鍑虹煡璇嗙偣鍒楄〃锛屼笉瑕佸叾浠栧唴瀹广€俙;

    const response = await callMultimodalAI(prompt, imageBase64);
    
    // 鎸夎鍒嗗壊锛岃繃婊ょ┖琛?
    const lines = response.split('\n').filter(line => line.trim() && !line.startsWith('銆?) && !line.startsWith('杈撳嚭'));
    return lines.map(line => line.replace(/^[-\*鈥d\.]\s*/, '').trim());
  };

  // ==================== 绾枃鏈?AI 鍒嗘瀽锛堣烦杩?OCR锛?===================
  const analyzeTextbookWithText = async (text, subject, stage, grade, chapterTitle, hasChildren, pageCount) => {
    console.log('馃 寮€濮嬬函鏂囨湰 AI 鍒嗘瀽...');
    
    const isSummaryPage = chapterTitle && /灏忕粨|鎬荤粨|鏁寸悊|澶嶄範|鍥為【|鐭ヨ瘑褰掔撼/.test(chapterTitle);
    const isGuidePage = hasChildren && pageCount <= 2 && !isSummaryPage;
    
    let result = { 
      visualDescription: '', 
      formulas: [], 
      coreTopics: '',
      knowledgeHierarchy: []
    };
    
    try {
      // 馃敡 澶嶇敤 analyzeTextbookImage 涓殑 AI 鍒嗘瀽閫昏緫
      let analysisText = text;
      
      if (analysisText.length > 10000) {
        console.warn(`鈿狅笍 鍘熸枃杈冮暱锛?{analysisText.length}瀛楋級锛屽皢浣跨敤瀹屾暣鍘熸枃杩涜鍒嗘瀽`);
      }
      
      const analysisPrompt = isGuidePage ?
        `浣犳槸涓€浣?{stage}${grade}${subject}鏁欏涓撳銆傝鍒嗘瀽浠ヤ笅鏁欐潗瀵艰/姒傝堪椤碉紝鎻愬彇鏈崟鍏冪殑鏍稿績淇℃伅銆?

銆愬璇師鏂囥€?
${analysisText}

璇锋彁鍙栵細
1. **鍗曞厓涓婚**锛氭湰鍗曞厓鐨勪汉鏂囦富棰樻垨鏍稿績涓婚鍚嶇О
2. **瀛︿範鐩爣**锛氭湰鍗曞厓鐨勪富瑕佸涔犵洰鏍囨垨鏍稿績瑕佹眰锛?-5鏉★級
3. **鍏抽敭鐭ヨ瘑鐐?*锛氬璇腑鏄庣‘鎻愬埌鐨勭煡璇嗙偣鎴栨妧鑳界偣锛屾暟閲忎笉闄愶紝姣忎釜蹇呴』鑳藉湪瀵艰涓壘鍒板搴旂殑鍘熸枃璇嶅彞浣滀负渚濇嵁
4. **璇枃瑕佺礌/瀛︾閲嶇偣**锛氬鏋滄湁鏄庣‘鐨勮鏂囪绱狅紙濡傞槄璇绘柟娉曘€佸啓浣滄柟娉曪級鎴栧绉戦噸鐐癸紝璇锋彁鍙?

杩斿洖 JSON锛?
{
  "visualDescription": "",
  "formulas": [],
  "coreTopics": "鏍稿績涓婚璇嶏紝閫楀彿鍒嗛殧锛?-6涓級",
  "knowledgeHierarchy": [
    {
      "bigConcept": "鍗曞厓涓婚鍚嶇О",
      "coreKnowledge": [
        {
          "name": "瀛︿範鐩爣鎴栬鏂囪绱犲悕绉?,
          "level": "鐞嗚В",
          "specificConcepts": ["鍏蜂綋鐭ヨ瘑鐐?", "鍏蜂綋鐭ヨ瘑鐐?"],
          "suggestedQuestionTypes": ["閫傚悎鑰冩煡鐨勯鍨?", "閫傚悎鑰冩煡鐨勯鍨?"]
        }
      ]
    }
  ]
}

鍙繑鍥?JSON銆俙
        :
        `浣犳槸涓€浣?{stage}${grade}${subject}瀛︾鏁欏涓撳銆傝鍒嗘瀽浠ヤ笅鏁欐潗鍐呭锛?

銆愭暀鏉愬師鏂囥€?
${analysisText}

璇峰畬鎴愪互涓嬪垎鏋愪换鍔★細

1. **鍥捐〃鎻忚堪**锛氬鏋滄湁鍥捐〃锛岀敤鏂囧瓧鎻忚堪锛涘鏋滄病鏈夛紝杩斿洖绌哄瓧绗︿覆
2. **鍏紡鎻愬彇**锛氬鏋滄湁鏁板/鐗╃悊/鍖栧鍏紡锛岀敤LaTeX鏍煎紡鎻忚堪锛涘鏋滄病鏈夛紝杩斿洖绌烘暟缁?
3. **鐭ヨ瘑鐐瑰眰绾х粨鏋?*锛氭寜"澶ф蹇?鈫?鏍稿績鐭ヨ瘑鐐?鈫?鍏蜂綋姒傚康"涓夊眰缁撴瀯鎻愬彇锛屾爣娉ㄦ瘡涓煡璇嗙偣鐨勮鐭ュ眰娆★紙璇嗚/鐞嗚В/搴旂敤/鍒嗘瀽/璇勪环/鍒涢€狅級

蹇呴』杩斿洖浠ヤ笅JSON鏍煎紡锛?
{
  "visualDescription": "鍥捐〃鎻忚堪鎴栫┖瀛楃涓?,
  "formulas": ["$鍏紡$ 鈫?鍚箟"],
  "coreTopics": "鏍稿績涓婚璇嶏紝閫楀彿鍒嗛殧锛?-6涓紝鎸夋鎷眰绾ф帓搴忥級",
  "knowledgeHierarchy": [
    {
      "bigConcept": "澶ф蹇靛悕绉帮紙濡傦細鍒嗘暟鐨勬剰涔夛級",
      "coreKnowledge": [
        {
          "name": "鏍稿績鐭ヨ瘑鐐瑰悕绉?,
          "level": "璇嗚|鐞嗚В|搴旂敤|鍒嗘瀽|璇勪环|鍒涢€?,
          "specificConcepts": ["鍏蜂綋姒傚康1", "鍏蜂綋姒傚康2"],
          "suggestedQuestionTypes": ["閫傚悎鐨勯鍨?", "閫傚悎鐨勯鍨?"]
        }
      ]
    }
  ]
}

${(() => {
  const s = (subject || '');
  const st = (stage || '');
  const g = (grade || '');
  const gn = extractGradeNum(g);
  
  const isChinese = s.includes('璇枃');
  const isMath = s.includes('鏁板');
  const isEnglish = s.includes('鑻辫');
  const isPhysics = s.includes('鐗╃悊');
  const isChemistry = s.includes('鍖栧');
  const isBiology = s.includes('鐢熺墿');
  const isScience = s.includes('绉戝');
  const isHistory = s.includes('鍘嗗彶');
  const isGeography = s.includes('鍦扮悊');
  const isPolitics = s.includes('鏀挎不') || s.includes('閬撳痉') || s.includes('鎬濇兂');
  const isIT = s.includes('淇℃伅');
  const isMusic = s.includes('闊充箰');
  const isArt = s.includes('缇庢湳');
  const isPE = s.includes('浣撹偛');
  
  const isScienceGroup = isPhysics || isChemistry || isBiology || isScience;
  const isHumanitiesGroup = isHistory || isGeography || isPolitics;
  
  const isPrimary = st.includes('灏忓');
  const isJunior = st.includes('鍒濅腑');
  const isSenior = st.includes('楂樹腑');
  const isLowerGrade = isPrimary && gn > 0 && gn <= 2;
  const isMidGrade = isPrimary && gn >= 3 && gn <= 4;
  const isUpperGrade = isPrimary && gn >= 5;
  
  if (isChinese) {
    return `銆愯鏂囧绉戜笓椤规彁鍙栬鍒欌€斺€旈€氳鍏ㄦ枃锛屼笉寰楅仐婕忎换浣曠煡璇嗗唴瀹广€?
- 馃摑 鐢熷瓧/鐢熻瘝锛氭瘡涓敓瀛楃嫭绔嬫爣娉紙濡?浜?"鍙?"鎵?锛夛紝缁濅笉鍚堝苟
- 馃摑 澶氶煶瀛楋細鏍囨敞姣忎釜璇婚煶鍜岀粍璇嶏紙濡?闀?ch谩ng)闀跨煭/闀?zh菐ng)闀垮ぇ"锛?
- 馃摑 杩戜箟璇?鍙嶄箟璇嶏細鎴愬鏍囨敞锛屾敞鏄庤鲸鏋愯鐐?
- 馃摑 閲嶇偣璇嶈/鎴愯/淇楄/姝囧悗璇細閫愯瘝鏍囨敞鍚箟鍜岀敤娉?
- 馃摑 闇€鑳岃娈佃惤/鍙よ瘲/鍚嶅彞/鏂囪█鏂囷細鏍囨敞绡囧悕鍜岃寖鍥?
- 馃摑 璇炬枃鍐呭鐞嗚В锛氫富鏃ㄣ€佷汉鐗╁舰璞°€佷簨浠惰剦缁溿€侀亾鐞嗐€佹儏鎰?
- 馃摑 淇緸鎵嬫硶锛氭瘮鍠汇€佹嫙浜恒€佹帓姣斻€佸じ寮犮€佸弽闂€佽闂瓑
- 馃摑 鏍囩偣绗﹀彿鐢ㄦ硶涓庣梾鍙ヤ慨鏀硅€冪偣
- 馃摑 闃呰鐞嗚В鑰冪偣锛氳瘝璇悊瑙ｃ€佸彞瀛愬惈涔夈€佸唴瀹规鎷€佺粨鏋勫垎鏋?
- 馃摑 鍐欎綔/鍙ｈ浜ら檯/缁煎悎鎬у涔?鍚嶈憲瀵艰瑕佹眰
- 馃敀 蹇呴』閫愭潯鏍囨敞锛岀粷涓嶅皢澶氫釜鐭ヨ瘑鐐瑰悎骞朵负涓€鏉★紙濡?鐢熷瓧5涓?鈫掑繀椤绘媶鎴?鏉＄嫭绔嬬煡璇嗙偣锛?
${isLowerGrade ? '- 馃敡 浣庢(1-2)锛氭嫾闊炽€佺瑪鐢荤瑪椤恒€佸亸鏃侀儴棣栥€佺湅鍥惧啓璇濄€佺畝鍗曟棩璁癨n' : ''}${isMidGrade ? '- 馃敡 涓(3-4)锛氭钀藉ぇ鎰忋€佷範浣溿€佺畝鍗曚慨杈炪€佽瀵熸棩璁癨n' : ''}${isUpperGrade ? '- 馃敡 楂樻(5-6)锛氭枃瑷€鏂囧叆闂ㄣ€佽鏄庢枃闃呰銆佽鍚庢劅\n' : ''}${isJunior ? '- 馃敡 鍒濅腑锛氭枃瑷€鏂囧疄璇嶈櫄璇嶃€佸彜璇楄瘝閴磋祻銆佽璁烘枃/璇存槑鏂囬槄璇籠n' : ''}${isSenior ? '- 馃敡 楂樹腑锛氭枃瑷€鏂囩壒娈婂彞寮忋€佽瘲姝岄壌璧忔墜娉曘€佽杩扮被/鏂囧绫绘枃鏈槄璇籠n' : ''}`;
  } else if (isMath) {
    return `銆愭暟瀛﹀绉戜笓椤规彁鍙栬鍒欌€斺€旈€氳鍏ㄦ枃锛屼笉寰楅仐婕忎换浣曠煡璇嗗唴瀹广€?
- 馃敘 姒傚康/瀹氫箟锛氭瘡涓暟瀛︽蹇电嫭绔嬫爣娉?
- 馃敘 鍏紡/瀹氱悊/杩愮畻娉曞垯/鎬ц川锛氶€愭潯鏍囨敞锛屾敞鏄庨€傜敤鏉′欢
- 馃敘 璁＄畻鏂规硶/瑙ｉ姝ラ/璇佹槑鎬濊矾锛氭爣娉ㄥ叧閿楠?
- 馃敘 渚嬮锛氭爣娉ㄨ€冩煡鐨勭煡璇嗙偣鍜岃В棰樻柟娉?
- 馃敘 鍑犱綍鍥惧舰锛氭€ц川銆佸垽瀹氥€佽绠楀叕寮?
- 馃敘 缁熻涓庢鐜囷細鏁版嵁鏀堕泦銆佸浘琛ㄨВ璇汇€佹鐜囪绠?
- 馃敘 搴旂敤棰樼被鍨嬩笌瑙ｉ绛栫暐
- 馃敘 鏁板鏈/绗﹀彿/鍗曚綅
- 馃敘 璇惧悗缁冧範/涔犻涓€冩煡鐨勯鍨嬪拰鑳藉姏灞傛
- 馃敀 蹇呴』閫愭潯鏍囨敞锛岀粷涓嶅皢澶氫釜鐭ヨ瘑鐐瑰悎骞朵负涓€鏉?
${isLowerGrade ? '- 馃敡 浣庢(1-2)锛氭暟鐨勮璇嗐€?0浠ュ唴鍔犲噺銆佸浘褰㈣璇嗐€佸彛绠椼€侀挓琛╘n' : ''}${isMidGrade ? '- 馃敡 涓(3-4)锛氫箻闄ゆ硶銆佸垎鏁板垵姝ャ€佸懆闀块潰绉€佺畝鍗曞簲鐢ㄩ\n' : ''}${isUpperGrade ? '- 馃敡 楂樻(5-6)锛氬皬鏁板垎鏁拌繍绠椼€佹柟绋嬨€佸嚑浣曡绠椼€佸鍚堝簲鐢ㄩ\n' : ''}${isJunior ? '- 馃敡 鍒濅腑锛氫唬鏁拌繍绠椼€佸嚑浣曡瘉鏄庛€佸嚱鏁板垵姝ャ€佺粺璁′笌姒傜巼\n' : ''}${isSenior ? '- 馃敡 楂樹腑锛氬嚱鏁般€佹暟鍒椼€佺珛浣撳嚑浣曘€佹鐜囩粺璁°€佸鏁般€佸悜閲廫n' : ''}`;
  } else if (isEnglish) {
    return `銆愯嫳璇绉戜笓椤规彁鍙栬鍒欌€斺€旈€氳鍏ㄦ枃锛屼笉寰楅仐婕忎换浣曠煡璇嗗唴瀹广€?
- 馃摃 璇嶆眹琛?鍗曡瘝琛細姣忎釜璇嶆潯锛堣嫳鏂?涓枃閲婁箟锛夌嫭绔嬫爣娉ㄤ负 specificConcept锛岄€愭潯鍒楀嚭锛屼笉寰楅仐婕忎换浣曚竴涓?
- 馃摃 閲嶇偣鍙ュ瀷锛氭瘡涓彞鍨嬬嫭绔嬫爣娉紙濡?What's your name?""I like...""There be..."锛?
- 馃摃 璇硶鐐癸細鏃舵€併€佽鎬併€佸彞鍨嬬粨鏋勩€佽瘝鎬с€佷粠鍙ョ瓑閫愭潯鏍囨敞
- 馃摃 瀵硅瘽/鐭枃锛氭爣娉ㄤ富棰樸€佸叧閿〃杈俱€佷氦闄呭姛鑳?
- 馃摃 鍙戦煶/鎷艰瑙勫垯锛氳嚜鐒舵嫾璇汇€侀煶鏍囥€侀噸闊炽€佽繛璇荤瓑
- 馃摃 鍚姏鏉愭枡涓殑鍏抽敭淇℃伅鍜岃€冩煡鐐?
- 馃摃 闃呰鐞嗚В绛栫暐涓庡畬褰㈠～绌鸿€冪偣
- 馃摃 涔﹂潰琛ㄨ揪/鍐欎綔璇濋涓庡父鐢ㄨ〃杈?
- 馃摃 鏂囧寲鐭ヨ瘑/璺ㄦ枃鍖栦氦闄呭唴瀹?
- 馃摃 鏁欐潗鍚勬澘鍧楋細Let's learn/Talk/Spell/Read/Write/Story绛夊叏閮ㄦ彁鍙?
- 馃敀 蹇呴』閫愭潯鏍囨敞锛岀粷涓嶅皢澶氫釜璇嶆潯鍚堝苟涓轰竴鏉★紙濡?鍗曡瘝5涓?鈫掑繀椤绘媶鎴?鏉＄嫭绔嬬煡璇嗙偣锛?
- 馃敀 鍏堥€氳纭娈佃惤鏁翠綋鍐呭绫诲瀷锛堟鏂?璇嶆眹琛?缁冧範/瀵艰锛夛紝鍐嶉€愭潯绮惧噯鏍囨敞
${isLowerGrade ? '- 馃敡 浣庢(1-2)锛氬瓧姣嶃€佺畝鍗曞崟璇嶃€佹棩甯搁棶鍊欍€佹瓕鏇叉瓕璋ｃ€侀鑹叉暟瀛梊n' : ''}${isMidGrade ? '- 馃敡 涓(3-4)锛氬璇濈悊瑙ｃ€佺煭鏂囬槄璇汇€佺畝鍗曡娉曘€佽瘝姹囨嫾鍐橽n' : ''}${isUpperGrade ? '- 馃敡 楂樻(5-6)锛氱瘒绔犻槄璇汇€佹椂鎬佺患鍚堛€佺畝鍗曞啓浣淺n' : ''}${isJunior ? '- 馃敡 鍒濅腑锛氬畬褰㈠～绌恒€侀槄璇荤悊瑙ｃ€佷功闈㈣〃杈俱€佽娉曠郴缁焅n' : ''}${isSenior ? '- 馃敡 楂樹腑锛氭繁灞傞槄璇汇€佽娉曞～绌恒€佽鍚庣画鍐欍€佹瑕佸啓浣淺n' : ''}`;
  } else if (isScienceGroup) {
    const subjLabel = isPhysics ? '鐗╃悊' : isChemistry ? '鍖栧' : isBiology ? '鐢熺墿' : '绉戝';
    return `銆?{subjLabel}瀛︾涓撻」鎻愬彇瑙勫垯鈥斺€旈€氳鍏ㄦ枃锛屼笉寰楅仐婕忎换浣曠煡璇嗗唴瀹广€?
- 馃敩 姒傚康/瀹氫箟/瀹氬緥/鍘熺悊锛氭瘡涓嫭绔嬫爣娉紝娉ㄦ槑鍐呮兜
- 馃敩 鍏紡/鏂圭▼寮?鍖栧寮忥細閫愭潯鏍囨敞${isChemistry ? '锛岄厤骞冲拰鍙嶅簲鏉′欢' : ''}
- 馃敩 瀹為獙锛氱洰鐨勩€佸櫒鏉愩€佹楠ゃ€佺幇璞°€佺粨璁恒€佹敞鎰忎簨椤?
- 馃敩 璁＄畻棰樿€冩煡鐐瑰拰鍏紡搴旂敤
- 馃敩 鍥捐〃/鏁版嵁/绀烘剰鍥剧殑瑙ｈ瑕佺偣
- 馃敩 ${isPhysics ? '鍔涘/鐢靛/鍏夊/鐑' : isChemistry ? '鐗╄川鎬ц川銆佸弽搴旂被鍨嬨€佸厓绱犲懆鏈? : isBiology ? '缁嗚優銆侀仐浼犮€佺敓鎬併€佽繘鍖? : '鐗╄川绉戝銆佺敓鍛界瀛︺€佸湴鐞冪瀛?}鏍稿績鐭ヨ瘑
- 馃敩 绉戝鎺㈢┒鏂规硶锛氳瀵熴€佸亣璁俱€佸疄楠屻€佸垎鏋愩€佺粨璁?
- 馃敩 ${isBiology ? '缁撴瀯涓庡姛鑳藉叧绯汇€佸垎绫讳緷鎹? : '鐗╄川鍙樺寲瑙勫緥銆佽兘閲忚浆鍖?}
- 馃敩 璇惧悗缁冧範/涔犻涓€冩煡鐨勯鍨嬪拰鑳藉姏
- 馃敀 蹇呴』閫愭潯鏍囨敞锛岀粷涓嶅皢澶氫釜鐭ヨ瘑鐐瑰悎骞朵负涓€鏉?
- 馃敀 鍏堥€氳纭娈佃惤鏁翠綋鍐呭绫诲瀷锛屽啀閫愭潯绮惧噯鏍囨敞
${isPrimary ? '- 馃敡 灏忓锛氳瀵熸弿杩般€佺畝鍗曞垎绫汇€佸父瑙佺幇璞¤В閲娿€佸姩鎵嬪疄楠孿n' : ''}${isJunior ? '- 馃敡 鍒濅腑锛氬熀纭€瀹氬緥銆佺畝鍗曡绠椼€佸疄楠屾搷浣滆鑼冦€佹帰绌舵姤鍛奬n' : ''}${isSenior ? '- 馃敡 楂樹腑锛氬鏉傜悊璁烘帹瀵笺€佸畾閲忚绠椼€佺患鍚堝疄楠岃璁°€佺瀛︽€濈淮\n' : ''}`;
  } else if (isHumanitiesGroup) {
    const subjLabel = isHistory ? '鍘嗗彶' : isGeography ? '鍦扮悊' : '鏀挎不/閬撳痉涓庢硶娌?鎬濇兂鏀挎不';
    return `銆?{subjLabel}瀛︾涓撻」鎻愬彇瑙勫垯鈥斺€旈€氳鍏ㄦ枃锛屼笉寰楅仐婕忎换浣曠煡璇嗗唴瀹广€?
- 馃摉 鏍稿績姒傚康/鍘熺悊/瀹氫箟锛氭瘡涓嫭绔嬫爣娉?
- 馃摉 ${isHistory ? '閲嶈浜嬩欢/浜虹墿/鏃堕棿/瀵肩伀绱?缁撴灉/鎰忎箟' : isGeography ? '鍦扮悊浣嶇疆/鍦板舰/姘斿€?璧勬簮/浜哄彛/缁忔祹' : '鏀挎不姒傚康/鍒跺害/娉曞緥/鏉冨埄/涔夊姟/浠峰€艰'}
- 馃摉 ${isGeography ? '鍦板浘/鍥捐〃/鏁版嵁鍒嗘瀽锛氳瘑鍥俱€佽鍥俱€佺粯鍥捐鐐? : '鏉愭枡/鍥捐〃/鏁版嵁瑙ｈ瑕佺偣'}
- 馃摉 鍥犳灉鍏崇郴/褰卞搷鎰忎箟/鍚ず/鏁欒
- 馃摉 妗堜緥鍒嗘瀽/鏉愭枡瑙ｈ/鎯呭鍒ゆ柇
- 馃摉 姣旇緝寮傚悓/褰掔撼鎬荤粨/璇勪环璁鸿堪
- 馃摉 ${isHistory ? '鍙叉枡瀹炶瘉/鍘嗗彶瑙ｉ噴/鏃剁┖瑙傚康' : isGeography ? '鍖哄煙璁ょ煡/缁煎悎鎬濈淮/浜哄湴鍗忚皟瑙? : '鏀挎不璁ゅ悓/娉曟不鎰忚瘑/鍏叡鍙備笌'}
- 馃摉 璇惧悗缁冧範/涔犻涓€冩煡鐨勯鍨嬪拰鑳藉姏灞傛
- 馃敀 蹇呴』閫愭潯鏍囨敞锛岀粷涓嶅皢澶氫釜鐭ヨ瘑鐐瑰悎骞朵负涓€鏉?
- 馃敀 鍏堥€氳纭娈佃惤鏁翠綋鍐呭绫诲瀷锛屽啀閫愭潯绮惧噯鏍囨敞
${isPrimary ? '- 馃敡 灏忓锛氬父璇嗘€т簡瑙ｃ€佽涓鸿鑼冦€佺畝鍗曞湴鍥捐瘑鍒€佽韩杈圭殑绀句細鐜拌薄\n' : ''}${isJunior ? '- 馃敡 鍒濅腑锛氱郴缁熺煡璇嗕綋绯汇€佺患鍚堝垎鏋愯兘鍔涖€佹潗鏂欓/绠€绛旈\n' : ''}${isSenior ? '- 馃敡 楂樹腑锛氭繁搴︾悊璁虹悊瑙ｃ€佸瑙掑害鍒嗘瀽銆佽杩伴/缁煎悎鎺㈢┒\n' : ''}`;
  } else if (isIT) {
    return `銆愪俊鎭鎶€瀛︾涓撻」鎻愬彇瑙勫垯鈥斺€旈€氳鍏ㄦ枃锛屼笉寰楅仐婕忎换浣曠煡璇嗗唴瀹广€?
- 馃捇 姒傚康/鏈锛氭瘡涓嫭绔嬫爣娉?
- 馃捇 鎿嶄綔姝ラ/娴佺▼/鍛戒护
- 馃捇 缂栫▼鐭ヨ瘑鐐癸細璇硶銆佺畻娉曘€佹暟鎹粨鏋?
- 馃捇 杞欢搴旂敤/宸ュ叿浣跨敤
- 馃捇 淇℃伅瀹夊叏/缃戠粶閬撳痉
- 馃捇 椤圭洰瀹炶返/妗堜緥搴旂敤
- 馃敀 蹇呴』閫愭潯鏍囨敞锛岀粷涓嶅皢澶氫釜鐭ヨ瘑鐐瑰悎骞朵负涓€鏉?
${isPrimary ? '- 馃敡 灏忓锛氳绠楁満鍩虹鎿嶄綔銆佸浘褰㈠寲缂栫▼銆佷俊鎭剰璇哱n' : ''}${isJunior ? '- 馃敡 鍒濅腑锛氬姙鍏蒋浠躲€佺畝鍗曠紪绋嬨€佺綉缁滃熀纭€\n' : ''}${isSenior ? '- 馃敡 楂樹腑锛氱畻娉曡璁°€佹暟鎹鐞嗐€佷汉宸ユ櫤鑳藉垵姝n' : ''}`;
  } else if (isMusic || isArt || isPE) {
    return `銆?{s}瀛︾涓撻」鎻愬彇瑙勫垯鈥斺€旈€氳鍏ㄦ枃锛屼笉寰楅仐婕忎换浣曠煡璇嗗唴瀹广€?
- 鏍稿績姒傚康/鏈/鎶€娉曪細姣忎釜鐙珛鏍囨敞
- 浣滃搧/鏇茬洰/杩愬姩椤圭洰鍙婂叾瑕佺偣
- 閴磋祻/娆ｈ祻/璇勪环瑕佺偣
- 瀹炶返/鎿嶄綔/璁粌瑕佹眰
- 璇惧悗缁冧範/娲诲姩鑰冩煡鐨勫唴瀹?
- 馃敀 蹇呴』閫愭潯鏍囨敞锛岀粷涓嶅皢澶氫釜鐭ヨ瘑鐐瑰悎骞朵负涓€鏉;
  }
  return '';
})()}

銆愭彁鍙栬鑼冦€?
- 馃敡 鏁伴噺涓嶈纭笂闄愶細鐭ヨ瘑鐐规暟閲忕敱鍘熸枃鍐呭瀵嗗害鍐冲畾锛屾瘡鏈変竴涓嫭绔嬪彲鏁欏鐨勮鐐瑰氨鎻愬彇涓€涓紝涓嶉仐婕忋€佷笉鍑戞暟
- 馃敡 鍘熸枃寮曡瘉绾︽潫锛氭瘡涓煡璇嗙偣蹇呴』鑳藉湪鍘熸枃涓壘鍒扮洿鎺ヤ緷鎹紝涓嶅緱鍑绉戠粡楠岃噯閫犲師鏂囨湭娑夊強鐨勫唴瀹?
- 馃敡 绂佹鎷嗗垎鍑戞暟锛氫笉寰楁妸鍚屼竴涓煡璇嗙偣鎹㈠嚑绉嶈娉曟媶鎴愬涓潯鐩潵鍑戦噺
- 馃敡 绮掑害鏍囧噯锛歴pecificConcepts 鍒嗚В鍒?鍙嫭绔嬫暀瀛?鑰冩煡鐨勬渶灏忕煡璇嗙偣"绮掑害鍗冲彲锛屾渶澶?涓紱suggestedQuestionTypes 缁欏嚭1-3涓渶鍖归厤鐨勯鍨?
- 馃敡 涓婚璇嶆寜鍘熸枃绡囧箙鍖归厤锛氱煭鏂囷紙<5娈碉級2-3涓富棰樿瘝锛岄暱鏂?-6涓紝浠ヨ兘姒傛嫭鍏ㄦ枃鏍稿績鍐呭涓哄噯
- 馃敡 JSON 瀛楁鍊煎敖閲忕畝鐭紝涓嶈鍐欓暱鍙ュ瓙
- 馃敡 鎵€鏈夎緭鍑哄瓧娈靛繀椤讳娇鐢ㄤ腑鏂囷紙鏁欐潗鍘熸枃涓鸿嫳鏂囨椂锛岀煡璇嗙偣/涓婚璇嶇敤涓枃鎻忚堪鍘熸枃鍚箟锛塦;

      // 馃敡 妫€娴嬫枃鏈ā鍨嬬姸鎬?
      console.log('馃敟 鏁欐潗鐗瑰緛鍒嗘瀽锛氭鏌ユ枃鏈ā鍨嬬姸鎬?..');
      let textModelAvailable = true;
      try {
        const textModelResult = await checkModelReady(null, 3, 'text');
        
        if (!textModelResult.ready) {
          console.warn(`鈿狅笍 鏂囨湰妯″瀷鏈氨缁? ${textModelResult.error?.message || '鏈煡閿欒'}`);
          textModelAvailable = false;
          
          if (textModelResult.error && textModelResult.error.message.includes('閰嶇疆閿欒')) {
            console.error('鉂?鏂囨湰妯″瀷閰嶇疆閿欒锛屽皢璺宠繃鐗瑰緛鍒嗘瀽姝ラ');
            return {
              visualDescription: '',
              formulas: [],
              coreTopics: '',
              knowledgePoints: [],
              knowledgeHierarchy: [],
              competency: '鐞嗚В',
              style: '浼犵粺',
              analysisSkipped: true,
              skipReason: textModelResult.error.message
            };
          }
          
          const additionalWait = Math.max(2000, Math.min(5000, textModelResult.responseTime / 10));
          await new Promise(r => setTimeout(r, additionalWait));
        } else {
          console.log(`鉁?鏂囨湰妯″瀷宸插氨缁紝绔嬪嵆寮€濮嬪垎鏋愶紙鍝嶅簲鏃堕棿: ${textModelResult.responseTime}ms锛塦);
          if (textModelResult.responseTime > 20000) {
            const extraWait = Math.min(5000, Math.max(3000, textModelResult.responseTime / 10));
            console.log(`鈴?妯″瀷鍒氬姞杞藉畬鎴愶紝棰濆绛夊緟${extraWait/1000}绉掔‘淇濆畬鍏ㄩ鐑?..`);
            await new Promise(r => setTimeout(r, extraWait));
          }
        }
      } catch (e) {
        console.warn('鈿狅笍 鏂囨湰妯″瀷妫€娴嬪け璐ワ紝绛夊緟3绉掑悗缁х画...', e.message);
        textModelAvailable = false;
        await new Promise(r => setTimeout(r, 3000));
      }
      
      if (!textModelAvailable) {
        console.warn('鈿狅笍 鏂囨湰妯″瀷涓嶅彲鐢紝璺宠繃鐗瑰緛鍒嗘瀽');
        return {
          visualDescription: '',
          formulas: [],
          coreTopics: '',
          knowledgePoints: [],
          knowledgeHierarchy: [],
          competency: '鐞嗚В',
          style: '浼犵粺',
          analysisSkipped: true,
          skipReason: '鏂囨湰妯″瀷涓嶅彲鐢?
        };
      }

      // 馃敡 鍔ㄦ€佽缃?maxTokens
      const rawTextLength = analysisText.length;
      let maxTokens = 4096;
      
      if (rawTextLength < 500) {
        maxTokens = 1024;
      } else if (rawTextLength < 1000) {
        maxTokens = 2048;
      } else {
        maxTokens = 3072;
      }

      const response = await callAI(analysisPrompt, { 
        taskType: 'analysis',
        temperature: 0.1,
        timeout: 300000,
        maxTokens: maxTokens
      });
      
      console.log(`鉁?鏁欐潗鐗瑰緛鍒嗘瀽瀹屾垚锛屽搷搴旈暱搴? ${response?.length || 0}瀛梎);
  
      try {
        const parsed = await robustJsonParse(
          response,
          (retryPrompt) => callAI(retryPrompt, { taskType: 'analysis', temperature: 0.1 }),
          '鏁欐潗鐗瑰緛鍒嗘瀽',
          'analysis'
        );
        result.visualDescription = parsed.visualDescription || '';
        result.formulas = parsed.formulas || [];
        result.coreTopics = parsed.coreTopics || '';
        result.knowledgeHierarchy = parsed.knowledgeHierarchy || [];
      } catch (e) {
        console.error('鉂?JSON 瑙ｆ瀽澶辫触:', e.message);
      }
    } catch (e) {
      console.error('鉂?AI 鍒嗘瀽寮傚父:', e.message);
    }
    
    // 鉁?浠庡眰绾х粨鏋勪腑鎻愬彇鎵佸钩鐭ヨ瘑鐐?
    const flatKnowledgePoints = [];
    if (result.knowledgeHierarchy && result.knowledgeHierarchy.length > 0) {
      for (const bigConcept of result.knowledgeHierarchy) {
        for (const core of (bigConcept.coreKnowledge || [])) {
          flatKnowledgePoints.push(core.name);
          if (core.specificConcepts) {
            flatKnowledgePoints.push(...core.specificConcepts);
          }
        }
      }
    }
    
    return {
      ...result,
      knowledgePoints: flatKnowledgePoints,
      competency: extractGradeNum(grade) <= 6 ? '璇嗚涓庣悊瑙? : '搴旂敤涓庡垎鏋?,
      style: '浼犵粺'
    };
  };

  // ==================== 鍏ㄩ潰鍒嗘瀽妯℃澘鍥剧墖 ====================
  const analyzeTemplateImageFull = async (imageBase64, subject, stage, grade, preExtractedText = '', imagePath = '') => {
      let rawText = '';
      let ocrQuality = { quality: 'unknown', reason: '' };

      // 馃敡 濡傛灉宸蹭紶鍏ラ鎻愬彇鐨勫師鏂囷紝璺宠繃OCR
      if (preExtractedText && preExtractedText.trim().length >= 10) {
        rawText = preExtractedText;
        ocrQuality = checkOCRQuality(rawText, subject);
        console.log('馃摉 浣跨敤棰勬彁鍙栫殑妯℃澘鍘熸枃锛岄暱搴?', rawText.length);
      } else {
        // 馃敡 閲嶆瀯锛氫娇鐢?extractTextRobustly 缁熶竴 OCR 鍏ュ彛
        const ocrResult = await extractTextRobustly(imageBase64, { subject, stage, imagePath });
        rawText = ocrResult.text || '';
        ocrQuality = { quality: ocrResult.ocrQuality || 'unknown', reason: '' };
        console.log('馃摉 妯℃澘鍘熸枃鎻愬彇缁撴灉闀垮害:', rawText?.length || 0, '鏍忔暟:', ocrResult.columnType || '鏈煡');
      }

      // 濡傛灉浠嶇劧澶辫触锛岃繑鍥為檷绾х粨鏋?
      if (!rawText || rawText.trim().length < 10) {
        console.error('鉂?妯℃澘鍘熸枃鎻愬彇瀹屽叏澶辫触');
        return {
          rawText: rawText || '',
          structure: [],
          scoreDistribution: '鍘熸枃鎻愬彇澶辫触锛岃鎵嬪姩濉啓',
          questionStyle: '',
          difficultyLevel: '',
          questionCards: [],
          ocrQuality: 'poor'
        };
      }

      console.log(`馃摉 OCR璐ㄩ噺: ${ocrQuality.quality} - ${ocrQuality.reason}`);

      // 绗簩姝ワ細鍒嗘鍒嗘瀽妯℃澘缁撴瀯锛堟媶鍒嗕负涓ゆ锛岄伩鍏嶉暱prompt瓒呮椂锛?
      let analysisResult = { 
        structure: [], 
        scoreDistribution: '', 
        questionStyle: '', 
        difficultyLevel: '',
        questionCards: [],
        languageStyle: null,
        formatStyle: null
      };

      // 馃敡 浼樺寲锛氬鏋滃凡棰勬彁鍙栧師鏂囷紝浣跨敤瀹屾暣鍘熸枃锛屼笉鍘嬬缉
      const rawTextLength = rawText.length;
      console.log(`馃摉 妯℃澘鍘熸枃闀垮害: ${rawTextLength}瀛梎);
      
      // 馃敡 鏂板锛氭鏌ュ師鏂囪川閲?
      if (rawTextLength < 50) {
        console.warn('鈿狅笍 妯℃澘鍘熸枃杩囩煭锛屽彲鑳絆CR澶辫触');
        return {
          rawText,
          structure: [],
          scoreDistribution: '鍘熸枃杩囩煭锛岃閲嶆柊涓婁紶',
          questionStyle: '',
          difficultyLevel: '',
          questionCards: [],
          ocrQuality: 'poor'
        };
      }
      
      // 馃敡 淇F锛氬湪鍒嗘瀽鍓嶅厛淇閫夐」绮樿繛
      let analysisText = _fixTemplateOptionGlue(rawText);
      
      // 馃敡 鏂板锛氭ā鏉垮師鏂囨竻鐞嗭紙杩囨护姘村嵃銆侀〉鐪夐〉鑴氱瓑锛?
      const cleanTemplateText = (text) => {
        let cleaned = text;
        
        // 1. 杩囨护甯歌姘村嵃锛堜繚鐣欎笌鏁欏鍐呭鐩稿叧鐨勬按鍗帮級
        cleaned = cleaned.replace(/\n?\s*[\u4e00-\u9fa5]{2,4}(鏁欒偛|瀛︽牎|鍩硅|鏈烘瀯|璇惧爞|缃戞牎)[\s\S]{0,10}?\n?/g, '');
        cleaned = cleaned.replace(/\n?\s*www\.[a-zA-Z0-9.-]+\.[a-z]{2,6}\s*\n?/gi, '');
        cleaned = cleaned.replace(/\n?\s*\d{3,4}-?\d{7,8}\s*\n?/g, '');
        
        // 2. 杩囨护绾〉鐮侊紙浣嗕繚鐣欏寘鍚珷鑺備俊鎭殑椤电湁锛?
        // 鉁?淇濈暀锛?绗竴鍗曞厓 鍩虹鐭ヨ瘑 - 1 -" "绗簩绔?鍔涘 绗?椤?
        // 鉂?鍒犻櫎锛?绗?1 椤? "鈥?1 鈥? "路 1 路" "Page 1"
        cleaned = cleaned.replace(/^\s*绗琝s*\d+\s*椤礬s*$/gm, '');  // 绾?绗琗椤?
        cleaned = cleaned.replace(/^\s*Page\s*\d+\s*$/gmi, '');  // 绾?Page X"
        cleaned = cleaned.replace(/^\s*[鈥斺€昡\s*\d+\s*[鈥斺€昡\s*$/gm, '');  // 绾?鈥?X 鈥?
        cleaned = cleaned.replace(/^\s*路\s*\d+\s*路\s*$/gm, '');  // 绾?路 X 路"
        
        // 3. 杩囨护瑁呴グ鎬х鍙?
        cleaned = cleaned.replace(/^\s*[*=_-]{3,}\s*$/gm, '');
        
        // 4. 鍘嬬缉绌鸿
        cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
        
        return cleaned.trim();
      };
      
      rawText = cleanTemplateText(rawText);
      console.log(`馃摉 妯℃澘鍘熸枃娓呯悊鍚庨暱搴? ${rawText.length}瀛梎);
      
      // 鍙鏈鎻愬彇鐨勫崟椤礝CR鍋氶檺鍒讹紙鍗曢〉涓€鑸笉瓒呰繃3000瀛楋級
      if (!preExtractedText && rawTextLength > 3000) {
        const headPart = rawText.substring(0, 1500);
        const tailPart = rawText.substring(rawTextLength - 1500);
        analysisText = headPart + '\n...锛堝叡' + rawTextLength + '瀛楋紝涓棿閮ㄥ垎鐪佺暐锛?..\n' + tailPart;
      }

      // 馃敡 澧炲己锛歄CR璐ㄩ噺妫€娴?+ 鑷姩淇
      const ocrIssues = [];
      
      // 妫€娴嬮€夐」绮樿繛骞惰嚜鍔ㄤ慨澶?
      if (/[A-D]\.[^A-D]*[A-D]\./.test(analysisText)) {
        ocrIssues.push('閫夐」鍙兘绮樿繛锛堢己灏戝垎闅旂锛?);
        // 馃敡 鑷姩淇锛氬湪閫夐」涔嬮棿鎻掑叆鍒嗛殧绗?
        const beforeFix = analysisText;
        // 鍖归厤 A.xxxB.xxx 妯″紡锛屽湪瀛楁瘝鍓嶆彃鍏ョ┖鏍煎垎闅?
        analysisText = analysisText.replace(/([A-D])\.(\D*?)([A-D])\./g, '$1.$2 $3.');
        // 濡傛灉淇鍚庤繕鏈夐棶棰橈紝鍐嶅仛涓€娆★紙澶勭悊 A.B.C.D. 绱у瘑绮樿繛鐨勬儏鍐碉級
        analysisText = analysisText.replace(/([A-D])\.(\S)/g, '$1. $2');
        if (analysisText !== beforeFix) {
          console.log('馃敡 閫夐」绮樿繛宸茶嚜鍔ㄤ慨澶?);
          ocrIssues[0] += '锛堝凡鑷姩淇锛?;
        }
      }
      
      // 妫€娴嬪紓甯稿瓧绗?
      const gibberishCount = (analysisText.match(/[鈻♀枲鈼嗏棁鈼嬧棌鈻斥柌鈻解柤]/g) || []).length;
      if (gibberishCount > 3) {
        ocrIssues.push('鍙戠幇' + gibberishCount + '涓紓甯稿瓧绗︼紝鍏紡鍙兘涓㈠け');
      }
      
      if (ocrIssues.length > 0) {
        console.warn('鈿狅笍 妯℃澘OCR璐ㄩ噺棰勮:', ocrIssues.join('锛?));
      }

      try {
        // 馃敡 淇锛氶暱鏂囨湰鍒嗘鍒嗘瀽锛岀‘淇濆畬鏁存€?
        // 馃敡 浼樺寲锛氬澶у垎娈靛ぇ灏忓埌2500瀛楋紝鍑忓皯AI璋冪敤娆℃暟锛岄檷浣庤秴鏃堕闄?
        const MAX_CHUNK_SIZE = 2500;
        let allStructure = new Set();
        let allScoreDistribution = new Set();
        let allQuestionStyle = new Set();
        let allDifficultyLevel = new Set();
        let allQuestionCards = [];
        let allLanguageStyle = null;
        let allFormatStyle = null;
        
        // 灏嗗師鏂囨寜 MAX_CHUNK_SIZE 鍒嗘锛堝湪鍙ュ彿澶勬柇鍙ワ級
        const chunks = [];
        let remaining = analysisText;
        while (remaining.length > 0) {
          if (remaining.length <= MAX_CHUNK_SIZE) {
            chunks.push(remaining);
            break;
          }
          // 浼樺厛鍦ㄥ彞鍙峰鏂彞
          let cutPos = remaining.lastIndexOf('銆?, MAX_CHUNK_SIZE);
          if (cutPos < MAX_CHUNK_SIZE * 0.5) {
            cutPos = remaining.lastIndexOf('\n', MAX_CHUNK_SIZE);
          }
          if (cutPos < MAX_CHUNK_SIZE * 0.3) {
            cutPos = MAX_CHUNK_SIZE;
          }
          chunks.push(remaining.substring(0, cutPos + 1));
          remaining = remaining.substring(cutPos + 1);
        }
        
        // 馃敡 濡傛灉鍙湁1娈碉紝涓嶉渶瑕佸垎娈?
        if (chunks.length <= 1) {
          console.log('馃搫 鍘熸枃闀垮害閫備腑锛屽崟娆″垎鏋?);
          // 鐩存帴鍒嗘瀽
          // 馃敡 浠庢寚浠ゅ簱鑾峰彇鍒嗘瀽瑙勮寖鍧楋紝浼樺厛鐢ㄥ簱銆佺‖缂栫爜鍏滃簳
          const analysisRules = getMatchingBlockInstructions({ category: '分析-文本分析规范' });
          const analysisExamples = getMatchingBlockInstructions({ category: '分析-分析模板示例' });
          const analysisExtractReqs = getMatchingBlockInstructions({ category: '分析-分析提取要求' });
          const fmtNote = analysisRules.find(b => b.id.includes('fmt_note'));
          const corePrinciple = analysisRules.find(b => b.id.includes('core_principle'));
          const mandRules = analysisRules.find(b => b.id.includes('mandatory_rules_full'));
          const diffRules = analysisRules.find(b => b.id.includes('difficulty_rules_full'));
          const examplesFull = analysisExamples.find(b => b.id.includes('examples_full'));
          const errorEx = analysisExamples.find(b => b.id.includes('error_examples'));
          const extractReqs = analysisExtractReqs.find(b => b.id.includes('extraction_reqs'));

          // 馃敡 鏋勫缓鍒嗘瀽鍧楀瓧绗︿覆锛氭寚浠ゅ簱浼樺厛锛岀‖缂栫爜鍏滃簳
          const fmtNoteStr = fmtNote ? fmtNote.content : `- **鍔犵矖鏂囧瓧** 琛ㄧず閲嶇偣姒傚康銆佸叧閿瘝鎴栬€冪偣
- _涓嬪垝绾挎枃瀛梍 琛ㄧず闇€瑕佺壒鍒叧娉ㄧ殑閮ㄥ垎
- ==楂樹寒鏂囧瓧== 琛ㄧず鏋佸叾閲嶈鐨勮€冪偣
- *鏂滀綋鏂囧瓧* 琛ㄧず琛ュ厖璇存槑鎴栨敞閲?
- ~~鍒犻櫎绾縹~ 琛ㄧず宸插垹闄ゆ垨涓嶉€傜敤鐨勫唴瀹?
鈿狅笍 閲嶈锛氳繖浜涙牸寮忔爣璁版槸鍘熸枃鐨勪竴閮ㄥ垎锛岃鍦ㄦ彁鍙栨椂淇濈暀瀹冧滑鐨勮涔変俊鎭紒`;
          const corePrincipleStr = corePrinciple ? corePrinciple.content : `鈿狅笍 涓ョ浠讳綍褰㈠紡鐨勫綊绾炽€佹敼鍐欍€佹爣鍑嗗寲銆佹€荤粨锛?
鈿狅笍 鍘熸枃鍐欎粈涔堝氨濉粈涔堬紝涓€涓瓧閮戒笉鑳芥敼锛乣;
          const mandRulesStr = mandRules ? mandRules.content : `1. 銆愬ぇ棰樺悕绉般€戝繀椤婚€愬瓧澶嶅埗鍘熸枃涓殑鍘熻瘽锛屼弗绂佷换浣曞綊绾炽€佹敼鍐欍€佹爣鍑嗗寲\n   - 鉁?姝ｇ‘锛?涓€銆佽涓嬮潰鐨勮娈碉紝鎸夎姹傚畬鎴愮粌涔?\n   - 鉂?閿欒锛?闃呰鐞嗚В棰?锛堣繖鏄綊绾筹紝绂佹锛侊級\n   - 鉁?姝ｇ‘锛?涓夈€佽鏂囦笌鐢熸椿"\n   - 鉂?閿欒锛?鐢熸椿搴旂敤棰?锛堣繖鏄綊绾筹紝绂佹锛侊級\n   - 鉁?姝ｇ‘锛?鍥涖€佹潗鏂欒繛璐€ф枃鏈?瀹屾垚缁冧範"\n   - 鉂?閿欒锛?鏉愭枡鍒嗘瀽棰?锛堣繖鏄綊绾筹紝绂佹锛侊級\n2. 銆愰鍨嬨€戝繀椤婚€愬瓧澶嶅埗鍘熸枃涓殑鍘熻瘽锛屼弗绂佸綊绫讳负鏍囧噯棰樺瀷\n   - 鉁?姝ｇ‘锛?璇讳笅闈㈢殑璇锛屾寜瑕佹眰瀹屾垚缁冧範"\n   - 鉂?閿欒锛?璇鍒嗘瀽"锛堣繖鏄綊绾筹紝绂佹锛侊級\n   - 鉁?姝ｇ‘锛?閫夋嫨姝ｇ‘鐨勭瓟妗?\n   - 鉂?閿欒锛?閫夋嫨棰?锛堣繖鏄爣鍑嗗寲锛岀姝紒锛塡n   - 鉁?姝ｇ‘锛?璇枃涓庣敓娲?\n   - 鉂?閿欒锛?鐢熸椿搴旂敤"锛堣繖鏄綊绾筹紝绂佹锛侊級\n3. 銆愯闂鏍笺€戝繀椤荤洿鎺ュ紩鐢ㄥ師鏂囦腑鐨勫師鍙ワ紝涓嶈鏀瑰啓鎴栨€荤粨\n   - 鉁?姝ｇ‘锛?鏍规嵁璇濉啓璇嶈"\n   - 鉂?閿欒锛?鐪嬫嫾闊冲啓璇?锛堣繖鏄敼鍐欙紝绂佹锛侊級\n   - 鉁?姝ｇ‘锛?渚濇濉叆涓嬮潰妯嚎娈电嚎涓婄殑鍏宠仈璇嶈锛屾伆褰撶殑涓€椤规槸"\n   - 鉂?閿欒锛?鍏宠仈璇嶅～绌?锛堣繖鏄綊绾筹紝绂佹锛侊級\n4. 銆愰毦搴︺€戦渶瑕佹牴鎹鐩唴瀹瑰垎鏋愬垽鏂紙鍩虹/涓瓑/杈冮毦锛夆啇 鍞竴鍙互鐢盇I鍒ゆ柇鐨勫瓧娈礬n5. 銆愬垎鍊笺€戝彧鏈夊師鏂囨槑纭爣娉ㄤ簡鎵嶈兘濉啓锛涙病鏈夋爣娉ㄧ殑濉?锛屼弗绂佽嚜宸变及绠梊n6. 銆愬皬棰樺簭鍙枫€戝繀椤讳粠鍘熸枃涓€愰鎻愬彇锛屽師鏂囩敤浠€涔堝簭鍙峰氨鐢ㄤ粈涔圽n7. 銆愬皬棰樻暟閲忋€戝繀椤讳粠鍘熸枃涓€愰鎻愬彇锛屽師鏂囨湁鍑犱釜灏卞～鍑犱釜`;
          const diffRulesStr = diffRules ? diffRules.content : `闅惧害鍒嗕负涓変釜绛夌骇锛氬熀纭€銆佷腑绛夈€佽緝闅綷n\n**鍩虹棰樼壒寰?*锛歕n- 鐩存帴鑰冩煡鍩虹鐭ヨ瘑锛堝鐪嬫嫾闊冲啓璇嶈銆佽瘝璇В閲娿€佺畝鍗曡绠楋級\n- 绛旀鍞竴涓旀槑纭紝涓嶉渶瑕佸鏉傛帹鐞哱n- 绀轰緥锛?鏍规嵁鎷奸煶鍐欏嚭璇嶈""璁＄畻涓嬪垪绠楀紡鐨勭粨鏋?\n\n**涓瓑棰樼壒寰?*锛歕n- 闇€瑕佺悊瑙ｄ笂涓嬫枃鎴栬仈绯诲涓煡璇嗙偣\n- 鏈変竴瀹氭帹鐞嗚繃绋嬶紝闇€瑕佸垎鏋愭垨姣旇緝\n- 绀轰緥锛?鑱旂郴涓婁笅鏂囩悊瑙ｈ瘝璇惈涔?"閫夋嫨鎻忓啓鏂规硶鐩稿悓鐨勫彞瀛?\n\n**杈冮毦棰樼壒寰?*锛歕n- 闇€瑕佺患鍚堣繍鐢ㄥ涓煡璇嗙偣锛屽垱閫犳€ф€濈淮\n- 寮€鏀炬€ц緝寮猴紝闇€瑕佹繁搴﹀垎鏋怽n- 绀轰緥锛?姒傛嫭姣嶄翰瀵硅闅嗗钩鎴愰暱浜х敓閲嶈褰卞搷鐨勪笁浠朵簨""璧忔瀽鍙ュ瓙鐨勮〃杈炬晥鏋?\n\n**鍒ゆ柇鍘熷垯**锛歕n1. 濡傛灉鍘熸枃涓湁鏄庣‘鏍囨敞锛堝"鎻愰珮棰?"鎷撳睍棰?锛夛紝浼樺厛浣跨敤鍘熸枃鏍囨敞\n2. 濡傛灉娌℃湁鏍囨敞锛屾牴鎹笂杩拌鍒欏垎鏋愰鐩唴瀹瑰悗鍒ゆ柇\n3. 鍚屼竴閬撳ぇ棰樹笅鐨勫皬棰橀毦搴﹀彲鑳戒笉鍚岋紝闇€鍒嗗埆鍒ゆ柇`;
          const examplesFullStr = examplesFull ? examplesFull.content : '';
          const errorExStr = errorEx ? errorEx.content : `鉂?"棰樺瀷": "闃呰鐞嗚В" 鈫?鍘熸枃鍐欑殑鏄?涓€銆佽涓嬮潰鐨勮娈碉紝鎸夎姹傚畬鎴愮粌涔?锛屽簲璇ュ畬鏁村鍒禱n鉂?"璁鹃棶椋庢牸": "鏍规嵁鐭枃濉┖" 鈫?鍘熸枃鍐欑殑鏄?鏍规嵁璇濉啓璇嶈"锛屽繀椤婚€愬瓧澶嶅埗\n鉂?"灏忛鏁伴噺": 20 鈫?鍘熸枃娌℃湁鏄庣‘璇存槑灏忛鏁伴噺锛屽簲璇ユ牴鎹疄闄呮彁鍙栫殑灏忛璁＄畻`;
          const extractReqsStr = extractReqs ? extractReqs.content : `1. 璇嗗埆姣忛亾澶ч锛氬師鏂囦腑鏍囨敞浜?涓€銆?"浜屻€?"绗竴閮ㄥ垎""涓撻」涓€""绗簲鍗曞厓"鎴栫被浼兼爣璁扮殑涓哄ぇ棰榎n2. 澶ч涓嬬殑灏忛閫愰鎻愬彇锛屽寘鎷瘡灏忛搴忓彿鍜屽垎鍊糪n3. 棰樺瀷鍚嶇О鐩存帴鐢ㄥ師鏂囦腑鐨勮娉曪紝鍘熸枃鍐欎粈涔堝氨濉粈涔圽n4. 濡傛灉鍘熸枃娌℃湁澶ч鏍囪锛屾暣浠借瘯鍗疯涓轰竴閬撳ぇ棰橈紝鍚勫皬棰樼洿鎺ユ彁鍙朶n5. 鎵€鏈夊垎鍊笺€侀鏁般€侀鏍兼弿杩伴兘浠庡師鏂囩洿鎺ュ彇锛屼笉瑕佽嚜宸辩紪\n6. 璁鹃棶椋庢牸锛氳棰樺瀷鍦ㄥ師鏂囦腑鏄浣曟彁闂殑锛屽師鏂囩敤浠€涔堣瘝灏辨彁鍙栦粈涔堣瘝`;

          const step2aPrompt = `浣犳槸鑰冭瘯鍛介涓撳銆傝鍒嗘瀽浠ヤ笅璇曞嵎/鏁欒緟鏉愭枡鐨勫師鏂囷紝鎻愬彇瀹屾暣缁撴瀯銆?

銆愭牸寮忚鏄庘€斺€斿師鏂囦腑鐨勬爣璁拌〃绀洪噸鐐瑰唴瀹广€?
${fmtNoteStr}

銆愭牳蹇冨師鍒欌€斺€旈櫎闅惧害澶栵紝鎵€鏈夊瓧娈靛繀椤婚€愬瓧浠庡師鏂囧鍒躲€?
${corePrincipleStr}

銆愬己鍒惰鍒欌€斺€旇繚鍙嶅皢瀵艰嚧鍒嗘瀽缁撴灉浣滃簾銆?
${mandRulesStr}

銆愰毦搴﹀垎鏋愯鍒欌€斺€旈渶瑕佹牴鎹鐩唴瀹瑰垽鏂€?
${diffRulesStr}

銆愬師鏂囧唴瀹广€戯紙鍏?{rawTextLength}瀛楋級
${analysisText}

銆愮湡瀹炴暀杈呰祫鏂欑ず渚嬧€斺€旂悊瑙ｅ鏍锋€с€?
${examplesFullStr}

銆愰敊璇ず渚嬧€斺€斾互涓嬫彁鍙栧叏閮ㄤ綔搴熴€?
${errorExStr}

銆愭彁鍙栬姹傗€斺€旈櫎闅惧害澶栵紝鎵€鏈夊瓧娈电洿鎺ヤ粠鍘熸枃鍘熸牱鎻愬彇锛屼竴涓瓧閮戒笉瑕佹敼銆?
${extractReqsStr}

鍙繑鍥?JSON锛?
{
  "缁撴瀯鍒嗘瀽": [
    {
      "澶ч": "鍘熸枃涓殑澶ч鍚嶇О锛岄€愬瓧澶嶅埗",
      "澶ч鍒嗗€?: 鍘熸枃涓殑鍒嗗€兼垨0,
      "灏忛鏁伴噺": 鍘熸枃涓殑灏忛鏁?
      "姣忓皬棰樺垎鍊?: 鍘熸枃涓殑鍒嗗€兼垨0,
      "棰樺瀷": "鍘熸枃涓殑棰樺瀷鍚嶇О锛岄€愬瓧澶嶅埗",
      "璁鹃棶椋庢牸": "鍘熸枃涓殑璁鹃棶鍘熷彞锛岄€愬瓧澶嶅埗",
      "闅惧害": "鏍规嵁棰樼洰鍐呭鍒嗘瀽寰楀嚭锛堝熀纭€/涓瓑/杈冮毦锛?,
      "灏忛鍒楄〃": [
        {"灏忛搴忓彿": "鍘熸枃涓殑搴忓彿", "鍒嗗€?: 鍘熸枃涓殑鍒嗗€兼垨0}
      ]
    }
  ],
  "鎬婚鏁?: 鎵€鏈夊皬棰樻暟閲忎箣鍜?
  "鎬诲垎": 鎵€鏈夊ぇ棰樺垎鍊间箣鍜?
}

鍙繑鍥濲SON锛屼笉瑕佸叾浠栧唴瀹广€?
- 馃敡 鎵€鏈夎緭鍑哄瓧娈靛繀椤讳娇鐢ㄤ腑鏂囷紙鍗充娇鍘熸枃涓鸿嫳鏂囷紝棰樺瀷鍚嶇О绛変篃璇风敤涓枃鎻忚堪锛塦;

          const response2a = await callAI(step2aPrompt, { 
            taskType: 'generation',
            temperature: 0.1,
            timeout: 180000
          });
      
          try {
            const parsed = await robustJsonParse(response2a, null, '妯℃澘缁撴瀯鍒嗘瀽-姝ラa');
            analysisResult.缁撴瀯鍒嗘瀽 = Array.isArray(parsed.缁撴瀯鍒嗘瀽) ? parsed.缁撴瀯鍒嗘瀽 : [];
            analysisResult.鎬婚鏁?= parsed.鎬婚鏁?|| 0;
            analysisResult.鎬诲垎 = parsed.鎬诲垎 || 0;
          } catch (e) {
            console.warn('姝ラ2a瑙ｆ瀽澶辫触锛屽皾璇曚粠鍘熸枃鎺ㄦ柇:', e.message);
            analysisResult.缁撴瀯鍒嗘瀽 = [];
            analysisResult.鎬婚鏁?= 0;
            analysisResult.鎬诲垎 = 0;
          }

          // 馃敡 浼樺寲锛氱畝鍖栬瑷€椋庢牸鍒嗘瀽锛屽噺灏戣秴鏃堕闄?
          console.log('馃帹 寮€濮嬫彁鍙栬瑷€椋庢牸...');
          const stylePrompt = `浣犳槸鑰冭瘯鍛介涓撳銆傝绠€瑕佸垎鏋愪互涓嬭瘯鍗风殑璇█椋庢牸鐗瑰緛銆?

銆愬師鏂囧唴瀹广€戯紙鎴彇鍓?00瀛楋級
${analysisText.substring(0, 500)}

鍙繑鍥濲SON锛堝瓧娈靛彲浠ヤ负绌哄瓧绗︿覆鎴杗ull锛夛細
{
  "languageStyle": { 
    "avgSentenceLength": 35,
    "commonPatterns": [],
    "connectors": [],
    "contextIntro": "",
    "personReference": "",
    "tone": "",
    "sampleSentence": ""
  },
  "formatStyle": { 
    "spacingBetweenQuestions": true,
    "indentation": "",
    "scorePosition": "",
    "chartDescriptionFormat": ""
  }
}

鍙繑鍥濲SON銆俙;

          // 馃敡 浼樺寲锛氳瑷€椋庢牸鍒嗘瀽鍓嶆娴嬫ā鍨嬬姸鎬?
          console.log('馃敟 璇█椋庢牸鍒嗘瀽锛氭鏌ユā鍨嬬姸鎬?..');
          try {
            const result = await checkModelReady(null, 3, 'text');
            
            if (!result.ready) {
              console.log(`鈿狅笍 妯″瀷鏈氨缁紝鏍规嵁鍝嶅簲鏃堕棿鍔ㄦ€佺瓑寰?.. (${result.responseTime}ms)`);
              const additionalWait = Math.max(2000, Math.min(4000, result.responseTime / 10));
              await new Promise(r => setTimeout(r, additionalWait));
            } else {
              console.log(`鉁?鏂囨湰妯″瀷宸插氨缁紝绔嬪嵆寮€濮嬭瑷€椋庢牸鍒嗘瀽锛堝搷搴旀椂闂? ${result.responseTime}ms, 灏濊瘯${result.attempts}娆★級`);
            }
          } catch (e) {
            console.warn('鈿狅笍 妯″瀷妫€娴嬪け璐ワ紝绛夊緟3绉掑悗缁х画...', e.message);
            await new Promise(r => setTimeout(r, 3000));
          }

          try {
            const styleResponse = await callAI(stylePrompt, { 
              taskType: 'generation',  // 馃敡 淇锛欴eepSeek 寮曟搸涓嶆敮鎸?formatting
              temperature: 0.1,
              timeout: 60000  // 馃敡 浼樺寲锛?0绉掞紙1鍒嗛挓锛?
            });
            const styleParsed = await robustJsonParse(styleResponse, null, '璇█椋庢牸鎻愬彇');
            analysisResult.languageStyle = styleParsed.languageStyle || null;
            analysisResult.formatStyle = styleParsed.formatStyle || null;
            console.log('鉁?璇█椋庢牸鎻愬彇瀹屾垚');
          } catch (e) {
            console.warn('璇█椋庢牸鎻愬彇澶辫触锛屼娇鐢ㄩ粯璁ゅ€?', e.message);
            // 馃敡 鎻愪緵鍚堢悊鐨勯粯璁ゅ€硷紝涓嶅奖鍝嶅悗缁敓鎴?
            analysisResult.languageStyle = {
              avgSentenceLength: 35,
              commonPatterns: ["鐩存帴璁鹃棶", "鎯呭寮曞叆"],
              connectors: ["鍥犳", "鎵€浠?, "浣嗘槸"],
              contextIntro: "閫氳繃鐢熸椿鎯呭寮曞叆",
              personReference: "绗簩浜虹О鈥滀綘鈥?,
              tone: "浜插垏銆佸紩瀵兼€?,
              sampleSentence: "璇锋牴鎹墍瀛︾煡璇嗗洖绛旈棶棰?
            };
            analysisResult.formatStyle = {
              spacingBetweenQuestions: true,
              indentation: "棣栬缂╄繘2瀛楃",
              scorePosition: "棰樺共鏈熬鎷彿鍐?,
              chartDescriptionFormat: "鍥捐〃涓嬫柟璇存槑"
            };
            console.log('鈿狅笍 浣跨敤榛樿璇█椋庢牸');
          }
        } else {
          // 馃敡 澶氭锛氶€愭鍒嗘瀽锛屽悎骞剁粨鏋?
          console.log(`馃搫 鍘熸枃杈冮暱(${rawTextLength}瀛?锛屽垎${chunks.length}娈靛垎鏋愶紙姣忔绾?{MAX_CHUNK_SIZE}瀛楋級`);
          console.log(`   鍚勬闀垮害: ${chunks.map((c, i) => `娈?{i+1}:${c.length}瀛梎).join(', ')}`);
          
          const allStructure = new Set();
          const allScoreDistribution = new Set();
          const allQuestionStyle = new Set();
          const allDifficultyLevel = new Set();
          const allSections = [];  // 馃敡 鏂板锛氭敹闆嗘墍鏈夊ぇ棰樺璞?
          const simplifiedRetryFlags = new Array(chunks.length).fill(false);  // 馃敡 淇锛氱敤鏁扮粍璺熻釜閲嶈瘯鐘舵€?

          for (let ci = 0; ci < chunks.length; ci++) {
            const chunk = chunks[ci];
            const chunkLabel = chunks.length > 1 ? `锛堢${ci + 1}/${chunks.length}娈碉級` : '';
            let retryCount = 0; // 馃敡 鏂板锛氳窡韪噸璇曟鏁?
            
            // 馃敡 浼樺寲锛氭瘡娈靛垎鏋愬墠鏅鸿兘绛夊緟锛岄伩鍏嶈繛缁姹傚鑷磋秴鏃?
            if (ci > 0) {
              console.log(`鈴?绗?{ci + 1}娈靛垎鏋愬墠绛夊緟5绉掞紝璁╂ā鍨嬫仮澶?..`);
              await new Promise(r => setTimeout(r, 5000));
            } else {
              // 绗竴娈碉細妫€鏌ユā鍨嬫槸鍚﹀氨缁?
              console.log('馃敟 妯℃澘缁撴瀯鍒嗘瀽锛氭鏌ユā鍨嬬姸鎬?..');
              try {
                const result = await checkModelReady(null, 3, 'text');
                
                if (!result.ready) {
                  console.log(`鈿狅笍 妯″瀷鏈氨缁紝鏍规嵁鍝嶅簲鏃堕棿鍔ㄦ€佺瓑寰?.. (${result.responseTime}ms)`);
                  const additionalWait = Math.max(2000, Math.min(5000, result.responseTime / 10));
                  await new Promise(r => setTimeout(r, additionalWait));
                } else {
                  console.log(`鉁?鏂囨湰鍒嗘瀽妯″瀷宸插氨缁紝绔嬪嵆寮€濮嬶紙鍝嶅簲鏃堕棿: ${result.responseTime}ms, 灏濊瘯${result.attempts}娆★級`);
                }
              } catch (e) {
                console.warn('鈿狅笍 妯″瀷妫€娴嬪け璐ワ紝绛夊緟3绉掑悗缁х画...', e.message);
                await new Promise(r => setTimeout(r, 3000));
              }
            }    
            
            // 馃敡 浠庢寚浠ゅ簱鑾峰彇鍒嗘瀽瑙勮寖鍧楋紙鍒嗘鍒嗘瀽鐢ㄧ簿绠€鐗堬級锛屼紭鍏堢敤搴撱€佺‖缂栫爜鍏滃簳
            const analysisRules = getMatchingBlockInstructions({ category: '分析-文本分析规范' });
            const fmtNote = analysisRules.find(b => b.id.includes('fmt_note'));
            const corePrinciple = analysisRules.find(b => b.id.includes('core_principle'));
            const mandRules = analysisRules.find(b => b.id.includes('mandatory_rules_compact'));
            const diffRules = analysisRules.find(b => b.id.includes('difficulty_rules_compact'));
            const fmtNoteStr = fmtNote ? fmtNote.content : `- **鍔犵矖鏂囧瓧** 琛ㄧず閲嶇偣姒傚康銆佸叧閿瘝鎴栬€冪偣
- _涓嬪垝绾挎枃瀛梍 琛ㄧず闇€瑕佺壒鍒叧娉ㄧ殑閮ㄥ垎
- ==楂樹寒鏂囧瓧== 琛ㄧず鏋佸叾閲嶈鐨勮€冪偣
- *鏂滀綋鏂囧瓧* 琛ㄧず琛ュ厖璇存槑鎴栨敞閲?
- ~~鍒犻櫎绾縹~ 琛ㄧず宸插垹闄ゆ垨涓嶉€傜敤鐨勫唴瀹?
鈿狅笍 閲嶈锛氳繖浜涙牸寮忔爣璁版槸鍘熸枃鐨勪竴閮ㄥ垎锛岃鍦ㄦ彁鍙栨椂淇濈暀瀹冧滑鐨勮涔変俊鎭紒`;
            const corePrincipleStr = corePrinciple ? corePrinciple.content : `鈿狅笍 涓ョ浠讳綍褰㈠紡鐨勫綊绾炽€佹敼鍐欍€佹爣鍑嗗寲銆佹€荤粨锛?
鈿狅笍 鍘熸枃鍐欎粈涔堝氨濉粈涔堬紝涓€涓瓧閮戒笉鑳芥敼锛乣;
            const mandRulesStr = mandRules ? mandRules.content : `1. 銆愬ぇ棰樺悕绉般€戝繀椤婚€愬瓧澶嶅埗鍘熸枃涓殑鍘熻瘽
   - 鉁?姝ｇ‘锛?涓€銆佽涓嬮潰鐨勮娈碉紝鎸夎姹傚畬鎴愮粌涔?
   - 鉂?閿欒锛?闃呰鐞嗚В棰?锛堣繖鏄綊绾筹紝绂佹锛侊級
   - 鉁?姝ｇ‘锛?涓夈€佽鏂囦笌鐢熸椿"
   - 鉂?閿欒锛?鐢熸椿搴旂敤棰?锛堣繖鏄綊绾筹紝绂佹锛侊級
2. 銆愰鍨嬨€戝繀椤婚€愬瓧澶嶅埗鍘熸枃涓殑鍘熻瘽
   - 鉁?姝ｇ‘锛?璇讳笅闈㈢殑璇锛屾寜瑕佹眰瀹屾垚缁冧範"
   - 鉂?閿欒锛?璇鍒嗘瀽"锛堣繖鏄綊绾筹紝绂佹锛侊級
   - 鉁?姝ｇ‘锛?閫夋嫨姝ｇ‘鐨勭瓟妗?
   - 鉂?閿欒锛?閫夋嫨棰?锛堣繖鏄爣鍑嗗寲锛岀姝紒锛?
3. 銆愯闂鏍笺€戝繀椤荤洿鎺ュ紩鐢ㄥ師鏂囦腑鐨勫師鍙?
   - 鉁?姝ｇ‘锛?鏍规嵁璇濉啓璇嶈"
   - 鉂?閿欒锛?鐪嬫嫾闊冲啓璇?锛堣繖鏄敼鍐欙紝绂佹锛侊級
4. 銆愰毦搴︺€戦渶瑕佹牴鎹鐩唴瀹瑰垎鏋愬垽鏂紙鍩虹/涓瓑/杈冮毦锛夆啇 鍞竴鍙互鐢盇I鍒ゆ柇鐨勫瓧娈?
5. 銆愬垎鍊笺€戝彧鏈夊師鏂囨槑纭爣娉ㄤ簡鎵嶈兘濉啓锛屾病鏈夋爣娉ㄥ～0
6. 銆愬皬棰樺簭鍙枫€戝繀椤讳粠鍘熸枃涓€愰鎻愬彇锛屽師鏂囩敤浠€涔堝簭鍙峰氨鐢ㄤ粈涔?
7. 銆愬皬棰樻暟閲忋€戝繀椤讳粠鍘熸枃涓€愰鎻愬彇锛屽師鏂囨湁鍑犱釜灏卞～鍑犱釜`;
            const diffRulesStr = diffRules ? diffRules.content : `- 鍩虹棰橈細鐩存帴鑰冩煡鍩虹鐭ヨ瘑锛堝鐪嬫嫾闊冲啓璇嶈銆佺畝鍗曡绠椼€佽瘝璇В閲婏級
- 涓瓑棰橈細闇€瑕佺悊瑙ｄ笂涓嬫枃鎴栬仈绯诲涓煡璇嗙偣锛堝閫夋嫨鎻忓啓鏂规硶鐩稿悓鐨勫彞瀛愶級
- 杈冮毦棰橈細闇€瑕佺患鍚堣繍鐢ㄥ涓煡璇嗙偣锛屽垱閫犳€ф€濈淮锛堝璧忔瀽鍙ュ瓙琛ㄨ揪鏁堟灉銆佹鎷浠朵簨锛塦;

            // 姣忔鍒嗘瀽缁撴瀯
            const chunkPrompt = `浣犳槸鑰冭瘯鍛介涓撳銆傝鍒嗘瀽浠ヤ笅璇曞嵎鐗囨${chunkLabel}锛屾彁鍙栧熀鏈粨鏋勩€?

銆愭牸寮忚鏄庘€斺€斿師鏂囦腑鐨勬爣璁拌〃绀洪噸鐐瑰唴瀹广€?
${fmtNoteStr}

銆愭牳蹇冨師鍒欌€斺€旈櫎闅惧害澶栵紝鎵€鏈夊瓧娈靛繀椤婚€愬瓧浠庡師鏂囧鍒躲€?
${corePrincipleStr}

銆愬己鍒惰鍒欍€?
${mandRulesStr}

銆愰毦搴﹀垎鏋愯鍒欍€?
${diffRulesStr}

銆愬師鏂囩墖娈点€戯紙鍏?{chunk.length}瀛楋級
${chunk}

鍙繑鍥濲SON锛?
{
  "缁撴瀯鍒嗘瀽": [
    {
      "澶ч": "鍘熸枃涓殑澶ч鍚嶇О锛岄€愬瓧澶嶅埗",
      "澶ч鍒嗗€?: 鍘熸枃涓殑鍒嗗€兼垨0,
      "灏忛鏁伴噺": 鍘熸枃涓殑灏忛鏁?
      "姣忓皬棰樺垎鍊?: 鍘熸枃涓殑鍒嗗€兼垨0,
      "棰樺瀷": "鍘熸枃涓殑棰樺瀷鍚嶇О锛岄€愬瓧澶嶅埗",
      "璁鹃棶椋庢牸": "鍘熸枃涓殑璁鹃棶鍘熷彞锛岄€愬瓧澶嶅埗",
      "闅惧害": "鏍规嵁棰樼洰鍐呭鍒嗘瀽寰楀嚭锛堝熀纭€/涓瓑/杈冮毦锛?,
      "灏忛鍒楄〃": [
        {"灏忛搴忓彿": "鍘熸枃涓殑搴忓彿", "鍒嗗€?: 鍘熸枃涓殑鍒嗗€兼垨0}
      ]
    }
  ],
  "鎬婚鏁?: 鎵€鏈夊皬棰樻暟閲忎箣鍜?
  "鎬诲垎": 鎵€鏈夊ぇ棰樺垎鍊间箣鍜?
}

鍙繑鍥濲SON锛屼笉瑕佸叾浠栧唴瀹广€俙;

            try {
              const chunkResponse = await callAI(chunkPrompt, { 
                taskType: 'generation',  // 馃敡 淇锛欴eepSeek 寮曟搸涓嶆敮鎸?formatting
                temperature: 0.1,
                timeout: 90000
              });
              
              const parsed = await robustJsonParse(chunkResponse, null, `缁撴瀯鍒嗘瀽-娈?{ci + 1}`);
              
              // 馃敡 鏂板锛氭墦鍗拌В鏋愮粨鏋滅殑鍏抽敭淇℃伅
              console.log(`馃攳 绗?{ci + 1}娈佃В鏋愮粨鏋?`, {
                has缁撴瀯鍒嗘瀽: Array.isArray(parsed.缁撴瀯鍒嗘瀽),
                hasStructure: Array.isArray(parsed.structure),
                structureLength: parsed.缁撴瀯鍒嗘瀽?.length || 0,
                keys: Object.keys(parsed).slice(0, 10)
              });
              
              // 馃敡 淇锛氫娇鐢ㄦ纭殑瀛楁鍚?"缁撴瀯鍒嗘瀽"锛堜腑鏂囷級
              if (Array.isArray(parsed.缁撴瀯鍒嗘瀽)) {
                parsed.缁撴瀯鍒嗘瀽.forEach(s => {
                  // 鎻愬彇棰樺瀷鍚嶇О
                  if (s.棰樺瀷) {
                    const beforeSize = allStructure.size;
                    allStructure.add(s.棰樺瀷);
                    const afterSize = allStructure.size;
                    if (afterSize > beforeSize) {
                      console.log(`   馃搶 绗?{ci + 1}娈垫柊澧為鍨? ${s.棰樺瀷}`);
                    }
                  }
                  // 馃敡 鏂板锛氭敹闆嗗畬鏁寸殑澶ч瀵硅薄
                  allSections.push(s);
                });
              }
              // 鍏煎鏃у瓧娈靛悕
              if (Array.isArray(parsed.structure)) {
                parsed.structure.forEach(s => allStructure.add(s));
              }
              if (parsed.scoreDistribution) allScoreDistribution.add(parsed.scoreDistribution);
              if (parsed.questionStyle) allQuestionStyle.add(parsed.questionStyle);
              if (parsed.difficultyLevel) allDifficultyLevel.add(parsed.difficultyLevel);
              
              console.log(`鉁?绗?{ci + 1}娈电粨鏋勫垎鏋愬畬鎴愶紝绱棰樺瀷: ${[...allStructure].length}绉峘);
            } catch (e) {
              console.warn(`绗?{ci + 1}娈电粨鏋勫垎鏋愬け璐?`, e.message);
              
              // 馃敡 淇锛氱涓€娆″け璐ュ悗锛屽皾璇曚娇鐢ㄧ畝鍖杙rompt閲嶈瘯锛堝鍔犲喎鍚姩瓒呮椂锛?
              if (retryCount === 0 && !simplifiedRetryFlags[ci]) {
                console.log(`馃攧 绗?{ci + 1}娈典娇鐢ㄧ畝鍖杙rompt閲嶈瘯锛堝喎鍚姩鍙兘杈冩參锛?..`);
                simplifiedRetryFlags[ci] = true;
                retryCount++;
                
                const simplifiedPrompt = `璇蜂粠浠ヤ笅璇曞嵎鐗囨涓彁鍙栭鍨嬬粨鏋勩€?

銆愯鍒欍€?
1. 澶ч鍚嶇О銆侀鍨嬨€佽闂鏍煎繀椤婚€愬瓧澶嶅埗鍘熸枃
2. 闅惧害鐢变綘鍒ゆ柇锛堝熀纭€/涓瓑/杈冮毦锛?
3. 鍙繑鍥濲SON

鍘熸枃锛?
${chunk.substring(0, 1000)}

JSON鏍煎紡锛?
{"缁撴瀯鍒嗘瀽": [{"澶ч": "", "棰樺瀷": "", "璁鹃棶椋庢牸": "", "闅惧害": "", "灏忛鏁伴噺": 0, "灏忛鍒楄〃": []}], "鎬婚鏁?: 0, "鎬诲垎": 0}`;
                
                try {
                  const retryResponse = await callAI(simplifiedPrompt, { 
                    taskType: 'generation',  // 馃敡 淇锛欴eepSeek 寮曟搸涓嶆敮鎸?formatting
                    temperature: 0.1,
                    timeout: 60000
                  });
                  
                  const parsed = await robustJsonParse(retryResponse, null, `缁撴瀯鍒嗘瀽-娈?{ci + 1}-閲嶈瘯`);
                  
                  // 馃敡 淇锛氫娇鐢ㄦ纭殑瀛楁鍚?"缁撴瀯鍒嗘瀽"锛堜腑鏂囷級
                  if (Array.isArray(parsed.缁撴瀯鍒嗘瀽)) {
                    parsed.缁撴瀯鍒嗘瀽.forEach(s => {
                      if (s.棰樺瀷) allStructure.add(s.棰樺瀷);
                      // 馃敡 鏂板锛氭敹闆嗗畬鏁寸殑澶ч瀵硅薄
                      allSections.push(s);
                    });
                  }
                  // 鍏煎鏃у瓧娈靛悕
                  if (Array.isArray(parsed.structure)) {
                    parsed.structure.forEach(s => allStructure.add(s));
                  }
                  if (parsed.scoreDistribution) allScoreDistribution.add(parsed.scoreDistribution);
                  if (parsed.questionStyle) allQuestionStyle.add(parsed.questionStyle);
                  if (parsed.difficultyLevel) allDifficultyLevel.add(parsed.difficultyLevel);
                  
                  console.log(`鉁?绗?{ci + 1}娈电畝鍖栭噸璇曟垚鍔燂紝棰樺瀷: ${[...allStructure].join('銆?)}`);
                  continue; // 閲嶈瘯鎴愬姛锛岃烦杩囬檷绾ч€昏緫
                } catch (retryErr) {
                  console.warn(`绗?{ci + 1}娈电畝鍖栭噸璇曚篃澶辫触:`, retryErr.message);
                }
              }
              
              // 馃敡 淇D锛氬垎娈靛け璐ユ椂锛屼粠鍘熸枃涓仛绠€鍗曞叧閿瘝鍖归厤浣滀负闄嶇骇
              // 鈿狅笍 娉ㄦ剰锛氳繖鍙槸闄嶇骇鏂规锛屾甯告儏鍐典笅涓嶅簲璇ヨ蛋鍒拌繖閲?
              const fallbackTypes = [];
              const typeKeywords = {
                '閫夋嫨棰?: ['A.', 'B.', 'C.', 'D.', '锛?', '锛?', '锛?', '锛?'],
                '濉┖棰?: ['<u class="blank-', '______', '___', '锛?, '(  )'],
                '鍒ゆ柇棰?: ['姝ｇ‘', '閿欒', '鈭?, '脳'],
                '璁＄畻棰?: ['璁＄畻', '绠椾竴绠?],
                '瑙ｇ瓟棰?: ['瑙ｇ瓟', '瑙ｏ細'],
                '搴旂敤棰?: ['搴旂敤', '瑙ｅ喅闂'],
                '瀹為獙棰?: ['瀹為獙', '鎺㈢┒'],
                '闃呰鐞嗚В': ['闃呰', '鐞嗚В'],
                '涔﹂潰琛ㄨ揪': ['鍐欎綔', '浣滄枃', '涔﹂潰琛ㄨ揪']
              };
              for (const [type, keywords] of Object.entries(typeKeywords)) {
                if (keywords.some(kw => chunk.includes(kw))) {
                  fallbackTypes.push(type);
                }
              }
              if (fallbackTypes.length > 0) {
                fallbackTypes.forEach(t => allStructure.add(t));
                console.log(`馃敡 绗?{ci + 1}娈甸檷绾у尮閰嶉鍨? ${fallbackTypes.join('銆?)}`);
              } else {
                // 瀹屽叏鏃犳硶鍒ゆ柇锛屾爣璁颁负鏈煡
                allStructure.add('鏈瘑鍒鍨?娈? + (ci + 1) + ')');
              }
            }
          }
          
          // 鍚堝苟缁撴灉
          // 馃敡 淇D锛氬幓闄ら檷绾т骇鐢熺殑鈥滄湭璇嗗埆棰樺瀷鈥濇爣璁?
          const cleanedStructure = [...allStructure].filter(s => typeof s === 'string' && !s.startsWith('鏈瘑鍒鍨?));
          // 濡傛灉闄嶇骇鍚庝粛鐒朵负绌猴紝淇濈暀鍘熷鏍囪鐢ㄤ簬鎻愮ず鐢ㄦ埛
          analysisResult.structure = cleanedStructure.length > 0 ? cleanedStructure : [...allStructure];
                    
          // 馃敡 淇锛氫娇鐢ㄦ敹闆嗗埌鐨勫畬鏁村ぇ棰樺璞★紝鑰屼笉鏄粠棰樺瀷鍚嶇О閲嶅缓
          if (allSections.length > 0) {
            analysisResult.缁撴瀯鍒嗘瀽 = allSections;
            console.log(`鉁?鍚堝苟${allSections.length}涓ぇ棰樺璞);
          } else {
            // 闄嶇骇锛氫粠棰樺瀷鍚嶇О閲嶅缓锛堜俊鎭笉瀹屾暣锛?
            analysisResult.缁撴瀯鍒嗘瀽 = analysisResult.structure.map(typeName => ({
              澶ч: typeName,
              棰樺瀷: typeName,
              璁鹃棶椋庢牸: '',
              闅惧害: '涓瓑',
              灏忛鏁伴噺: 0,
              灏忛鍒楄〃: []
            }));
            console.warn('鈿狅笍 娌℃湁鏀堕泦鍒板ぇ棰樺璞★紝浣跨敤闄嶇骇鏂规');
          }
          analysisResult.鎬婚鏁?= 0;
          analysisResult.鎬诲垎 = 0;
          
          // 妫€鏌ラ鍨嬫暟閲忔槸鍚﹀悎鐞?
          if (analysisResult.structure.length <= 1 && chunks.length >= 3) {
            console.warn(`鈿狅笍 妯℃澘鏈?{chunks.length}娈碉紝浣嗕粎璇嗗埆鍒?{analysisResult.structure.length}绉嶉鍨嬶紝鍙兘涓嶅畬鏁碻);
            analysisResult._structureIncomplete = true;
          }
          analysisResult.scoreDistribution = [...allScoreDistribution].join('锛?);
          analysisResult.questionStyle = [...allQuestionStyle].join('锛?);
          analysisResult.difficultyLevel = [...allDifficultyLevel].join('锛?);
          
          // 馃敡 浼樺寲锛氬崟鐙彁鍙栭鍗★紙姣忕棰樺瀷1閬撲唬琛ㄦ€ч鐩紝閬垮厤杈撳嚭杩囬暱琚埅鏂級
          console.log('馃搵 寮€濮嬫彁鍙栦唬琛ㄦ€ч鍗?..');
          const cardAnalysisText = analysisText.substring(0, 1500);
          
          // 鏋勫缓宸茬煡棰樺瀷鍒楄〃锛岀‘淇濊鐩栨墍鏈夐鍨?
          const knownTypes = analysisResult.structure || [];
          const typesList = knownTypes.length > 0 
            ? `\n銆愬凡鐭ラ鍨嬨€戯紙蹇呴』涓轰互涓嬫瘡绉嶉鍨嬫彁鍙栭鐩級\n${knownTypes.map(s => s.棰樺瀷 || s).join('銆?)}`
            : '';
          
          const step2bPrompt = `浣犳槸鑰冭瘯鍛介涓撳銆傝鍩轰簬浠ヤ笅璇曞嵎鐗囨锛屾彁鍙?*姣忕棰樺瀷鐨?閬撲唬琛ㄦ€ч鐩?*銆?

銆愬師鏂囧唴瀹广€戯紙鎴彇鍓?500瀛楋級
${cardAnalysisText}
${typesList}

銆愰噸瑕佲€斺€旀彁鍙栬姹傘€?
1. 姣忕棰樺瀷鍙彁鍙?閬撻锛堟渶澶?閬撻锛?
2. 浼樺厛閫夋嫨棰樺共瀹屾暣銆佹湁浠ｈ〃鎬х殑棰樼洰
3. 棰樺共蹇呴』閫愬瓧澶嶅埗鍘熸枃锛屼竴涓瓧閮戒笉鑳芥敼
4. options瀛楁锛氶€夋嫨棰樹繚鐣橝/B/C/D閫夐」锛岄潪閫夋嫨棰樺～绌哄瓧绗︿覆鏁扮粍
5. score锛氬師鏂囨爣娉ㄤ簡鍒嗗€肩殑鎸夊師鏂囧～锛屾湭鏍囨敞鐨勫～0
6. questionFeature锛氭鎷棰樼殑璁鹃棶鐗瑰緛锛?0瀛椾互鍐?
7. 濡傛灉鏌愰鍨嬪湪鍘熸枃涓壘涓嶅埌锛岃烦杩囪棰樺瀷

璇锋彁鍙栧苟鍙繑鍥濲SON锛?
{
  "questionCards": [
    {
      "number": 1,
      "type": "閫夋嫨棰?,
      "stem": "閫愬瓧澶嶅埗鐨勫畬鏁撮骞?,
      "options": ["A. xxx", "B. xxx", "C. xxx", "D. xxx"],
      "score": 3,
      "knowledgePoint": "",
      "difficulty": "鍩虹",
      "questionFeature": "璁鹃棶鐗瑰緛"
    }
  ]
}

鍙繑鍥濲SON銆俙;

          // 馃敡 浼樺寲锛氶鍗″垎鏋愬墠妫€娴嬫ā鍨嬬姸鎬?
          console.log('馃敟 棰樺崱鍒嗘瀽锛氭鏌ユā鍨嬬姸鎬?..');
          try {
            const result = await checkModelReady(null, 3, 'text');
            
            if (!result.ready) {
              console.log(`鈿狅笍 妯″瀷鏈氨缁紝鏍规嵁鍝嶅簲鏃堕棿鍔ㄦ€佺瓑寰?.. (${result.responseTime}ms)`);
              const additionalWait = Math.max(2000, Math.min(5000, result.responseTime / 10));
              await new Promise(r => setTimeout(r, additionalWait));
            } else {
              console.log(`鉁?妯″瀷宸插氨缁紝绔嬪嵆寮€濮嬮鍗″垎鏋愶紙鍝嶅簲鏃堕棿: ${result.responseTime}ms, 灏濊瘯${result.attempts}娆★級`);
            }
          } catch (e) {
            console.warn('鈿狅笍 妯″瀷妫€娴嬪け璐ワ紝绛夊緟3绉掑悗缁х画...', e.message);
            await new Promise(r => setTimeout(r, 3000));
          }

          // 馃敡 浼樺寲锛氬鍔犻檷绾х瓥鐣ワ紝绗竴娆″け璐ュ悗灏濊瘯绠€鍖栫増
          try {
            const response2b = await callAI(step2bPrompt, { 
              taskType: 'generation',  // 馃敡 淇锛欴eepSeek 寮曟搸涓嶆敮鎸?formatting
              temperature: 0.1,
              timeout: 120000  // 绗竴娆″皾璇曪細120绉?
            });
            const parsed = await robustJsonParse(response2b, null, '妯℃澘缁撴瀯鍒嗘瀽-姝ラb');
            analysisResult.questionCards = Array.isArray(parsed.questionCards) ? parsed.questionCards : [];
            console.log(`鉁?棰樺崱鎻愬彇瀹屾垚锛屽叡${analysisResult.questionCards.length}閬撲唬琛ㄦ€ч鐩甡);
          } catch (e) {
            console.warn('璇︾粏棰樺崱鍒嗘瀽瓒呮椂锛屽皾璇曠畝鍖栫増...', e.message);
            
            // 闄嶇骇锛氭瀬绠€鐗堥鍗″垎鏋愶紙姣忕棰樺瀷1閬擄紝鍙彁鍙栭骞插拰棰樺瀷锛?
            try {
              const simplifiedPrompt = `璇蜂粠浠ヤ笅璇曞嵎涓瘡绉嶉鍨嬫彁鍙?閬撲唬琛ㄦ€ч鐩紝鍙繑鍥為鍙枫€侀鍨嬪拰棰樺共銆?

銆愬師鏂囥€?
${cardAnalysisText.substring(0, 1000)}

杩斿洖JSON锛歿"questionCards": [{"number": 1, "type": "閫夋嫨棰?, "stem": "棰樺共鍘熸枃", "options": [], "score": 0, "knowledgePoint": "", "difficulty": "鍩虹", "questionFeature": ""}]}

鍙繑鍥濲SON锛屾瘡涓骞蹭笉瓒呰繃200瀛椼€俙;
              
              const response = await callAI(simplifiedPrompt, { 
                taskType: 'generation',  // 馃敡 淇锛欴eepSeek 寮曟搸涓嶆敮鎸?formatting
                temperature: 0.1,
                timeout: 60000  // 绠€鍖栫増锛?0绉?
              });
              const parsed = await robustJsonParse(response, null, '绠€鍖栭鍗″垎鏋?);
              analysisResult.questionCards = Array.isArray(parsed.questionCards) ? parsed.questionCards : [];
              console.log(`鈿狅笍 浣跨敤绠€鍖栭鍗★紝鍏?{analysisResult.questionCards.length}閬揱);
            } catch (e2) {
              console.error('棰樺崱鍒嗘瀽瀹屽叏澶辫触:', e2.message);
              analysisResult.questionCards = [];
            }
          }
        }
      } catch (e) {
        console.error('妯℃澘缁撴瀯鍒嗘瀽澶辫触:', e);
      }

      // 馃敡 鏂板锛氭ā鏉垮師鏂囩粨鏋勫寲鏍囪锛堜究浜嶢I璇嗗埆棰樺瀷缁撴瀯锛?
      const enhancedRawText = _addTemplateStructureMarkers(rawText);
      
      return {
        rawText: enhancedRawText,  // 馃敡 浣跨敤澧炲己鍚庣殑鍘熸枃
        ...analysisResult,
        languageStyle: analysisResult.languageStyle || null,
        formatStyle: analysisResult.formatStyle || null,
        ocrQuality: ocrQuality.quality
      };
  };

  // ==================== 骞寸骇-瀛︾鍙敤鎬ф劅鐭?====================
  // 杩斿洖璇ュ绉戝湪鎸囧畾瀛︽+骞寸骇鐨勬彁绀轰俊鎭紝鑻ヨ骞寸骇灏氭湭寮€璁惧垯杩斿洖绌哄瓧绗︿覆
  // 馃攽 鎻愮ず鏂囨湰浠庢寚浠ゅ簱鑾峰彇锛屽勾绾ц竟鐣屾潯浠跺湪浠ｇ爜涓垽鏂?
  const getSubjectGradeHint = (subject, stage, gradeNum) => {
    // 浠庢寚浠ゅ簱鏌ヨ璇ュ绉戠殑骞寸骇杈圭晫鎻愮ず
    const blocks = getMatchingBlockInstructions({ category: '生成-年级边界提示', subject, stage });
    if (blocks.length === 0) return '';
    
    // 浠?content 涓彁鍙栨彁绀鸿瘝
    const hintMatch = blocks[0].content.match(/鎻愮ず璇嶏細(.+)/);
    const hintText = hintMatch ? hintMatch[1] : '';
    if (!hintText) return '';
    
    // 骞寸骇杈圭晫鏉′欢锛氬悇瀛︾鐨勮捣濮?缁撴潫骞寸骇
    const gradeRules = {
      '鐗╃悊': { startGrade: 8, type: 'start' },
      '鍖栧': { startGrade: 9, type: 'start' },
      '鐢熺墿': { endGrade: 8, type: 'end' },
      '鍦扮悊': { endGrade: 8, type: 'end' },
    };
    
    const rule = gradeRules[subject];
    if (!rule) return '';
    
    // 妫€鏌ュ勾绾ф槸鍚﹀湪鑼冨洿鍐?
    if (rule.type === 'start' && gradeNum > 0 && gradeNum < rule.startGrade) {
      return hintText;
    }
    if (rule.type === 'end' && gradeNum > 0 && gradeNum > rule.endGrade) {
      return hintText;
    }
    
    return '';
  };

  // 馃敡 璇曞嵎/璇炬椂缁冮鍨嬫暟閲忚ˉ鍏呭缓璁細浠庢寚浠ゅ簱鎸夊绉懨楀娈得楄祫鏂欑被鍨嬩笁缁村害绮惧噯鍖归厤
  const getGenTypeTypeSupplement = (genType, subject, gradeSegment) => {
    // 浠?exam/practice 鏈夋琛ュ厖
    if (genType !== 'exam' && genType !== 'practice') return '';
    const blocks = getMatchingBlockInstructions({ category: '生成-题型分布建议', subject, stage: gradeSegment, genType });
    if (blocks.length === 0) return '';
    return blocks[0].content;
  };

  // 馃敡 浠?stageMap 鎺ㄥ鏉冨▉闅惧害姣斾緥锛堝綋鐢ㄦ埛鏈嚜瀹氫箟鏃朵互姝や负鍑嗭級
  // 馃敡 鍊间粠鎸囦护搴撱€岀敓鎴?闅惧害閰嶇疆銆嶈В鏋愶紝鍏滃簳淇濈暀纭紪鐮?
  const getStageDifficultyRatio = (stage, isLowerPrimary, isMiddlePrimary, isUpperPrimary) => {
    // 鏋勯€?gradeSegment 鐢ㄤ簬鎸囦护搴撳尮閰?
    const gradeSegment = stage === 'primary'
      ? (isLowerPrimary ? 'primary_low' : isMiddlePrimary ? 'primary_mid' : 'primary_high')
      : stage || 'middle';
    const blocks = getMatchingBlockInstructions({ category: '生成-题型分布建议', stage: gradeSegment, genType: 'exam' });
    if (blocks.length > 0) {
      const content = blocks[0].content;
      const basicMatch = content.match(/basic=(\d+)/);
      const mediumMatch = content.match(/medium=(\d+)/);
      const advancedMatch = content.match(/advanced=(\d+)/);
      if (basicMatch && mediumMatch && advancedMatch) {
        return {
          basic: parseInt(basicMatch[1]),
          medium: parseInt(mediumMatch[1]),
          advanced: parseInt(advancedMatch[1]),
        };
      }
    }
    // 鍏滃簳锛堟寚浠ゅ簱鏃犲尮閰嶆椂鈥斺€旂悊璁轰笂涓嶅簲鍒拌揪锛屾墍鏈夊娈靛凡鍏ュ簱锛?
    console.warn(`[instructionLib] 鏈壘鍒扮敓鎴?闅惧害閰嶇疆: stage=${stage}, gradeSegment=${gradeSegment}, 浣跨敤榛樿鍏滃簳鍊糮);
    if (stage === 'primary') {
      if (isLowerPrimary) return { basic: 70, medium: 20, advanced: 10 };
      if (isMiddlePrimary) return { basic: 60, medium: 30, advanced: 10 };
      if (isUpperPrimary) return { basic: 50, medium: 30, advanced: 20 };
      return { basic: 70, medium: 20, advanced: 10 };
    }
    if (stage === 'middle') return { basic: 50, medium: 30, advanced: 20 };
    if (stage === 'high') return { basic: 40, medium: 40, advanced: 20 };
    return { basic: 50, medium: 30, advanced: 20 };
  };

  // 馃敡 鏅鸿兘榛樿鎬诲垎锛氬鏍囩幇琛岃€冭瘯鏍囧噯
  // 馃敡 鍊间粠鎸囦护搴撱€岀敓鎴?闅惧害閰嶇疆銆嶈В鏋愶紝鍏滃簳淇濈暀纭紪鐮?
  const getDefaultTotalScore = (genType, subject, stage) => {
    if (genType !== 'exam') return 0;
    const blocks = getMatchingBlockInstructions({ category: '生成-难度配置', stage, genType: 'exam' });
    if (blocks.length > 0) {
      const content = blocks[0].content;
      const mainMatch = content.match(/totalScore_main=(\d+)/);
      const otherMatch = content.match(/totalScore_other=(\d+)/);
      const scoreMatch = content.match(/totalScore=(\d+)/);
      const mainSubjects = ['璇枃', '鏁板', '鑻辫'];
      const isMain = mainSubjects.includes(subject);
      
      if (mainMatch && isMain) return parseInt(mainMatch[1]);
      if (otherMatch && !isMain) return parseInt(otherMatch[1]);
      if (scoreMatch) return parseInt(scoreMatch[1]);
    }
    // 鍏滃簳锛堟寚浠ゅ簱鏃犲尮閰嶆椂鈥斺€旂悊璁轰笂涓嶅簲鍒拌揪锛屾墍鏈夊娈靛凡鍏ュ簱锛?
    console.warn(`[instructionLib] 鏈壘鍒扮敓鎴?闅惧害閰嶇疆鎬诲垎: stage=${stage}, subject=${subject}, 浣跨敤榛樿鍏滃簳鍊糮);
    const mainSubjectsFallback = ['璇枃', '鏁板', '鑻辫'];
    const isMainFallback = mainSubjectsFallback.includes(subject);
    if (stage === 'primary') return 100;
    if (stage === 'middle') return isMainFallback ? 120 : 100;
    if (stage === 'high') return isMainFallback ? 150 : 100;
    return 100;
  };

  // 馃敡 妫€娴?difficultyLevels 鏄惁浣跨敤鏈慨鏀圭殑纭紪鐮侀粯璁ゅ€硷紙50/30/20锛?
  const isDefaultDifficulty = (difficultyLevels) => {
    if (!difficultyLevels || difficultyLevels.length !== 3) return true;
    const basic = difficultyLevels.find(d => d.name === '鍩虹棰?);
    const medium = difficultyLevels.find(d => d.name === '涓。棰?);
    const advanced = difficultyLevels.find(d => d.name === '鎻愰珮棰?);
    return basic?.percentage === 50 && medium?.percentage === 30 && advanced?.percentage === 20;
  };

  // 馃敡 妫€娴?questionTypes 鏄惁浣跨敤閫氱敤榛樿鍊硷紙閫夋嫨/濉┖/瑙ｇ瓟 涓変欢濂楋級
  const isDefaultQuestionTypes = (questionTypes) => {
    if (!questionTypes || questionTypes.length !== 3) return false;
    const names = questionTypes.map(q => q.name).sort().join(',');
    return names === '濉┖棰?瑙ｇ瓟棰?閫夋嫨棰?;
  };

  // 鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?
  // 馃敡 鏁欒緟璐ㄩ噺瀵规爣杈呭姪鍑芥暟锛圦1-Q4锛?
  // 鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?

  // Q2: 鐭ヨ瘑鐐圭┓灏借鐩栫害鏉燂紙浼樺厛浠庢寚浠ゅ簱璇诲彇锛?
  const getCoverageConstraint = (genType, subject, stage) => {
    const coverageBlocks = getMatchingBlockInstructions({ category: '生成-知识点全覆盖', subject, stage, genType });
    if (coverageBlocks.length > 0) {
      return '\n鈿狅笍 銆愮煡璇嗙偣鍏ㄨ鐩栥€? + coverageBlocks[0].content;
    }
    // 鏃犳寚浠ゅ簱鍖归厤鏃惰繑鍥炵┖锛堜笉纭紪鐮佸厹搴曪級
    console.warn(`[instructionLib] 鏈壘鍒扮煡璇嗙偣鍏ㄨ鐩? genType=${genType}`);
    return '';
  };

  // Q1: 绛旀涓庤В鏋愯川閲忚鑼冿紙鎸?genType 脳 瀛︾锛?
  // 馃敡 Q7: 绛旀璐ㄩ噺鏍囧噯 鈥?瀹屽叏浠庢寚浠ゅ簱璇诲彇锛屼笉鍐嶇‖缂栫爜
  const getAnswerQualitySpec = (genType, subject, stage) => {
    // 馃敡 浼樺厛浠庢寚浠ゅ簱鏌ヨ锛氭寜 genType+subject 绮剧‘鍖归厤
    if (!genType) return '';
    const answerBlocks = getMatchingBlockInstructions({ category: '生成-答案与解析规范', subject, genType });
    if (answerBlocks.length > 0) {
      const generalBlocks = answerBlocks.filter(b =>
        (!b.subject || b.subject === '') && !b.id.startsWith('block_answer_spec')
      );
      const subjectBlocks = answerBlocks.filter(b =>
        b.subject && b.subject !== '' && b.subject.split(',').includes(subject)
      );
      // 鍘婚噸鍚堝苟锛氶€氱敤瑙勮寖鍦ㄥ墠锛屽绉戣ˉ鍏呭湪鍚?
      const merged = [...generalBlocks];
      for (const sb of subjectBlocks) {
        if (!merged.find(m => m.id === sb.id)) merged.push(sb);
      }
      if (merged.length > 0) return merged.map(b => b.content).join('\n');
    }
    // 馃敡 鏃犲尮閰嶆椂杩斿洖绌猴紙涓嶅厑璁哥‖缂栫爜鍏滃簳锛?
    console.warn(`[instructionLib] 鏈壘鍒板尮閰嶇殑绛旀涓庤В鏋愯鑼? genType=${genType}, subject=${subject}`);
    return '';
  };

  // Q3: 涓昏棰樿瘎鍒嗘爣鍑嗭紙瀹屽叏浠庢寚浠ゅ簱璇诲彇锛?
  const getScoringRubric = (genType, subject, stage) => {
    if (genType !== 'exam' && genType !== 'practice') return '';
    
    // 馃敡 浠庢寚浠ゅ簱璇诲彇鍖归厤鐨勮瘎鍒嗘爣鍑?
    const rubricBlocks = subject ? getMatchingBlockInstructions({ category: '生成-主观题评分标准', subject, stage: '' }) : [];
    if (rubricBlocks.length > 0) {
      return '\n銆愪富瑙傞璇勫垎鏍囧噯鍙傝€冦€慭n' + rubricBlocks[0].content;
    }
    
    // 鏃犳寚浠ゅ簱鍖归厤鏃惰繑鍥炵┖锛堜笉纭紪鐮佸厹搴曪級
    console.warn(`[instructionLib] 鏈壘鍒颁富瑙傞璇勫垎鏍囧噯: subject=${subject}`);
    return '';
  };

  // Q4: 璇枃闃呰鐞嗚В绛旈妯℃澘锛堝畬鍏ㄤ粠鎸囦护搴撹鍙栵級
  const getChineseReadingTemplates = (subject) => {
    if (subject !== '璇枃') return '';
    const templateBlocks = getMatchingBlockInstructions({ category: '生成-答题模板', subject: '璇枃', stage: '' });
    if (templateBlocks.length > 0) {
      return `\n銆愯鏂囬槄璇荤悊瑙ｇ瓟棰樻ā鏉库€斺€斾弗鏍兼寜姝ゆ鏋朵綔绛斻€慭n` + templateBlocks[0].content;
    }
    // 鏃犳寚浠ゅ簱鍖归厤鏃惰繑鍥炵┖锛堜笉纭紪鐮佸厹搴曪級
    console.warn('[instructionLib] 鏈壘鍒拌鏂囬槄璇荤悊瑙ｇ瓟棰樻ā鏉?);
    return '';
  };

  // 馃敡 Q7: 鑰冨嵎鏃堕棿鍒嗛厤 鈥?瀹屽叏浠庢寚浠ゅ簱璇诲彇
  const getTimeAllocation = (genType, subject, stage) => {
    if (genType !== 'exam' || !stage) return '';
    const timeBlocks = getMatchingBlockInstructions({ category: '生成-时间分配', genType, stage });
    if (timeBlocks.length > 0) {
      return `\n銆愭椂闂村垎閰嶅缓璁€?{timeBlocks[0].content}`;
    }
    console.warn(`[instructionLib] 鏈壘鍒板尮閰嶇殑鏃堕棿鍒嗛厤: stage=${stage}, genType=${genType}`);
    return '';
  };

  // 鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?
  // Fix A: Few-shot 璐ㄩ噺鑼冧緥锛堝畬鍏ㄤ粠鎸囦护搴撹鍙栵級
  // 鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?
  const getGenTypeExample = (genType, subject, stage, isLowerPrimary, grade, gradeSegment) => {
    // 馃敡 浠庢寚浠ゅ簱鏌ヨ鍖归厤鐨勮川閲忚寖渚?
    const tryInstructionLib = () => {
      // 鍏堝皾璇?gradeSegment 绮剧‘鍖归厤锛堝浣庢涓撶敤鑼冧緥锛?
      const stageMatch = getMatchingBlockInstructions({ category: '生成-题型分布建议', subject, stage: gradeSegment, genType });
      if (stageMatch.length > 0) return `\n銆愯川閲忚寖渚嬧€斺€?{stageMatch[0].name.replace('銆愯川閲忚寖渚嬨€?, '')}銆慭n${stageMatch[0].content}`;
      // 鍐嶅皾璇曚笉闄愬畾 stage锛堥€氱敤鑼冧緥锛?
      const generalMatch = getMatchingBlockInstructions({ category: '生成-质量范例', subject, stage: '', genType });
      if (generalMatch.length > 0) return `\n銆愯川閲忚寖渚嬧€斺€?{generalMatch[0].name.replace('銆愯川閲忚寖渚嬨€?, '')}銆慭n${generalMatch[0].content}`;
      return null;
    };
    
    const result = tryInstructionLib();
    if (result) return result;
    
    // 鏃犳寚浠ゅ簱鍖归厤鏃惰繑鍥炵┖锛堜笉纭紪鐮佸厹搴曪級
    console.warn(`[instructionLib] 鏈壘鍒拌川閲忚寖渚? genType=${genType}, subject=${subject}, stage=${stage}`);
    return '';
  };

  // 馃敡 Q7: 鐭ヨ瘑杈圭晫绾︽潫 鈥?瀹屽叏浠庢寚浠ゅ簱璇诲彇
  const getKnowledgeBoundaries = (subject, stage, isLowerPrimary, isMiddlePrimary, isUpperPrimary, grade) => {
    if (!subject) return '';
    // 馃敡 璁＄畻 gradeSegment 鐢ㄤ簬鎸囦护搴?genType 缁村害鍖归厤
    const gradeSegment = stage === 'primary'
      ? (isLowerPrimary ? 'primary_low' : isMiddlePrimary ? 'primary_mid' : 'primary_high')
      : stage || '';
    // 馃敡 浼樺厛 gradeSegment 绮剧‘鍖归厤锛屽啀 fallback 鍒?stage 閫氱敤
    let kbBlocks = getMatchingBlockInstructions({ category: '生成-题型分布建议', subject, genType: gradeSegment });
    if (kbBlocks.length === 0) {
      kbBlocks = getMatchingBlockInstructions({ category: '生成-知识边界', subject, stage: '' });
    }
    if (kbBlocks.length > 0) {
      const boundaryList = kbBlocks[0].content.split('\n').filter(l => l.trim().startsWith('-'));
      if (boundaryList.length > 0) {
        return '\n銆愬勾绾х煡璇嗚竟鐣屸€斺€斾互涓嬪唴瀹逛弗绂佸嚭鐜般€慭n' + boundaryList.map(b => `- 馃毇 ${b.replace(/^-\s*/, '')}`).join('\n');
      }
    }
    console.warn(`[instructionLib] 鏈壘鍒板尮閰嶇殑鐭ヨ瘑杈圭晫: subject=${subject}, gradeSegment=${gradeSegment}`);
    return '';
  };

  // ==================== 鎸囦护鏋勫缓 ====================
  const buildGenerationInstruction = (options) => {
    try {
    const {
      selectedBooks,
      selectedTemplates,
      scopeType,
      propositionStyle,
      genTypes = ['exam'],
      granularity,
      questionTypes,
      difficultyLevels,
      totalScore,
      allowOriginalQuestions,
      injectedFragments = [],
      autoFullInstructions = []
    } = options;

    let instruction = '';
    const book = selectedBooks?.[0];
    // 馃敡 淇锛氳鑼冨寲瀛︾鍚嶇О锛堝鐞?鏀挎不"鈫?閬撳痉涓庢硶娌?/"鎬濇兂鏀挎不"绛夋槧灏勶級
    const rawSubject = book?.subject || '';
    const stageRaw = book?.stage || '';
    // 馃敡 缁熶竴鏄犲皠涓鸿嫳鏂?key锛堟暀鏉愬簱 filterStage 鍊兼槸 "灏忓/鍒濅腑/楂樹腑"锛?
    const stageMap = { '灏忓': 'primary', '鍒濅腑': 'middle', '楂樹腑': 'high' };
    const stage = stageMap[stageRaw] || stageRaw;
    const subject = normalizeSubjectName(rawSubject, stage);
    const grade = book?.grade || '';

    // 鍔ㄦ€佸勾绾ч€傞厤锛氭牴鎹疄闄呭勾绾ф彁鍙栨暟瀛楋紝渚涘悗缁墍鏈夈€愩€戝潡浣跨敤
    // 馃攽 grade 鍙兘鏄腑鏂囷紙"涓夊勾绾?锛夋垨鏁板瓧锛岀粺涓€鎻愬彇鏁板瓧
    const gradeNum = extractGradeNum(grade);
    const isLowerPrimary = stage === 'primary' && gradeNum > 0 && gradeNum <= 2;   // 浣庢锛?-2骞寸骇
    const isMiddlePrimary = stage === 'primary' && gradeNum >= 3 && gradeNum <= 4; // 涓锛?-4骞寸骇
    const isUpperPrimary = stage === 'primary' && gradeNum >= 5;   // 楂樻锛?-6骞寸骇
    const primaryGenType = genTypes?.[0] || 'exam';  // 璧勬枡绫诲瀷锛屼緵鍚庣画鎵€鏈夈€愩€戝潡浣跨敤
    // 馃敡 瀛︽缁嗗垎锛氱敤浜?getMatchingBlockInstructions 鐨?genType 缁村害鍖归厤
    const gradeSegment = stage === 'primary'
      ? (isLowerPrimary ? 'primary_low' : isMiddlePrimary ? 'primary_mid' : 'primary_high')
      : stage || 'middle';

    // ========== 1.銆愭牳蹇冧换鍔°€?==========
    instruction += `銆愭牳蹇冧换鍔°€慭n`;
    
    // 馃敡 浠庢暀鏉愬嬀閫夌珷鑺傝幏鍙栦换鍔″悕锛堝崟璇?璇炬爣棰橈紝鍗曞厓=绗琗鍗曞厓锛?
    let taskName = '';
    const bookChapters = book?.selectedChapters || [];
    if (bookChapters.length === 1) {
      // 鍗曡锛氬彇璇炬爣棰?
      taskName = bookChapters[0].title || '';
    } else if (bookChapters.length > 1) {
      // 澶氳/鍗曞厓锛氬皾璇曚粠绗竴璇炬爣棰樻彁鍙栧崟鍏冧俊鎭?
      const firstTitle = bookChapters[0].title || '';
      const unitMatch = firstTitle.match(/绗?[涓€浜屼笁鍥涗簲鍏竷鍏節鍗乚+)鍗曞厓/);
      if (unitMatch) {
        taskName = `绗?{unitMatch[1]}鍗曞厓`;
      } else {
        taskName = firstTitle; // 闄嶇骇鐢ㄧ涓€璇炬爣棰?
      }
    }
    
    if (genTypes && genTypes.length > 0) {
      for (const gt of genTypes) {
        const typeInfo = genTypeTemplates[gt];
        const displayName = taskName || (typeInfo?.name || '').replace(/[^\u4e00-\u9fa5]/g, '');
        if (typeInfo) {
          // 馃敡 浠庢寚浠ゅ簱鑾峰彇鏍稿績浠诲姟鎸囦护锛堟墍鏈?genType 鍧囧凡鍏ュ簱锛屽厹搴曚粎浣滃畨鍏ㄧ綉锛?
          const coreTaskBlocks = getMatchingBlockInstructions({ category: '生成-核心任务', genType: gt });
          if (coreTaskBlocks.length === 0) {
            console.warn(`[instructionLib] 鏈壘鍒扮敓鎴?鏍稿績浠诲姟: genType=${gt}, 浣跨敤 genTypeTemplates 鍏滃簳`);
          }
          const coreInstruction = coreTaskBlocks.length > 0 ? coreTaskBlocks[0].content : typeInfo.instruction;
          instruction += `璇风敓鎴愪竴浠姐€?{displayName}銆嶃€?{coreInstruction}\n`;
          if (typeInfo.structure) {
            let adaptedStructure = typeInfo.structure;
            
            // 馃敡 浠庢寚浠ゅ簱鑾峰彇瀛︾涓撳睘缁撴瀯妯℃澘锛堟寜 gradeSegment+subject+genType 涓夌淮搴︾簿纭尮閰嶏紝灏忓鍒嗕綆/涓?楂樻锛?
            const structBlocks = getMatchingBlockInstructions({ category: '生成-题型分布建议', subject, stage: gradeSegment, genType: gt });
            if (structBlocks.length > 0) {
              adaptedStructure = structBlocks[0].content.replace('缁撴瀯鍙傝€冿細\n', '');
            }
            
            // 馃敡 瀛︽绮剧粏璋冩暣
            if (gt === 'preview') {
              const previewDetectCount = isLowerPrimary ? '2-3' : isMiddlePrimary ? '3-4' : '4-5';
              adaptedStructure = adaptedStructure.replace(/\d+-\d+閬撳熀纭€棰?, `${previewDetectCount}閬撳熀纭€棰榒);
            }
            if (gt === 'reading' && subject === '璇枃') {
              const readingCount = isLowerPrimary ? '1绡? : '1-2绡?;
              adaptedStructure = adaptedStructure.replace(/鐭枃闃呰锛圼\d-]+绡?, `鐭枃闃呰锛?{readingCount}`);
            }
            
            instruction += `缁撴瀯鍙傝€冿細\n ${adaptedStructure}\n`;
          }
        }
      }
    } else {
      instruction += `鈿狅笍 璇峰湪椤堕儴閰嶇疆鏍忛€夋嫨璧勬枡绫诲瀷锛堣€冨嵎/璇炬椂缁?涓撻」绐佺牬/鐭ヨ瘑鐐规€荤粨锛夛紝鏈€夋嫨鏃剁郴缁熷皢鎸夐粯璁よ€冨嵎鏍煎紡鐢熸垚銆俓n`;
    }
    if (granularity) {
      instruction += `鐢熸垚绮掑害锛?{granularity === 'unit' ? '鎸夊崟鍏冩暣浣撹璁? : '鎸夎鏃跺崟鐙璁?}銆俓n`;
    }

    // ========== 2.銆愭暀鏉愮珷鑺傜‘璁ゃ€戜粎鎻愪緵绔犺妭鍚嶇О鍜岄〉鐮佽寖鍥达紝鍘熸枃鐢?Step4 绮惧噯妫€绱㈡敞鍏?==========
    // 馃敡 鏋舵瀯淇锛歋tep 1 宸插叏闈㈡彁鍙栫煡璇嗙偣锛堝惈璇嶆眹琛?鐢熷瓧琛ㄧ瓑锛夛紝Step 4 閫氳繃 retrieveBlueprintSegments
    //    绮惧噯妫€绱㈠師鏂囩墖娈垫敞鍏ュ埌閫愰鐢熸垚銆傛澶勪笉鍐嶆敞鍏ュ師鏂囩墖娈碘€斺€旈伩鍏嶆湡鏈祫鏂欐暣鏈暀鏉愯鎴柇銆?
    if (selectedBooks && selectedBooks.length > 0) {
      // 馃敡 瀛︾鎰熺煡鐨勭珷鑺傜被鍨嬭瘑鍒?
      const detectChapterLabel = (title, subj) => {
        if (!title) return '';
        const t = title.trim();
        const s = (subj || '');
        // 鑻辫
        if (s.includes('鑻辫')) {
          if (/unit\s*\d/i.test(t)) return '鍗曞厓';
          if (/lesson\s*\d/i.test(t)) return '璇炬椂';
          if (/let.s\s*(learn|talk|spell|play|sing|do|check)/i.test(t)) return '鏉垮潡';
          if (/story\s*time|read\s*(and|&)\s*write/i.test(t)) return '鏉垮潡';
          if (/words|vocabulary|word\s*list/i.test(t)) return '馃摃璇嶆眹琛?;
          if (/review|recycle|revision/i.test(t)) return '澶嶄範';
          if (/project|task/i.test(t)) return '椤圭洰';
          return '';
        }
        // 璇枃
        if (s.includes('璇枃')) {
          if (/绗琜涓€浜屼笁鍥涗簲鍏竷鍏節鍗乗d]+璇緗璇炬枃[涓€浜屼笁鍥涗簲鍏竷鍏節鍗乗d]*/.test(t)) return '璇炬枃';
          if (/璇枃鍥湴/.test(t)) return '璇枃鍥湴';
          if (/璇嗗瓧/.test(t)) return '璇嗗瓧';
          if (/涔犱綔|鍐欎綔|浣滄枃/.test(t)) return '鍐欎綔';
          if (/鍙ｈ浜ら檯/.test(t)) return '鍙ｈ浜ら檯';
          if (/蹇箰璇讳功鍚闃呰閾炬帴|鍚嶈憲瀵艰/.test(t)) return '闃呰';
          if (/缁煎悎鎬у涔?.test(t)) return '缁煎悎';
          if (/澶嶄範|鍥為【|鎬荤粨/.test(t)) return '澶嶄範';
          if (/鍙よ瘲|璇楄瘝|鏂囪█鏂?.test(t)) return '鍙よ瘲鏂?;
          return '';
        }
        // 鏁板
        if (s.includes('鏁板')) {
          if (/绗琜涓€浜屼笁鍥涗簲鍏竷鍏節鍗乗d]+鍗曞厓/.test(t)) return '鍗曞厓';
          if (/绗琜涓€浜屼笁鍥涗簲鍏竷鍏節鍗乗d]+鑺?.test(t)) return '鑺?;
          if (/鏁寸悊.*澶嶄範|澶嶄範.*鏁寸悊|鎬诲涔?.test(t)) return '澶嶄範';
          if (/鏁板骞胯|浣犵煡閬撳悧/.test(t)) return '鎷撳睍';
          if (/缁煎悎.*瀹炶返|瀹炶返.*娲诲姩/.test(t)) return '瀹炶返';
          return '';
        }
        // 鐞嗙锛堢墿鐞?鍖栧/鐢熺墿/绉戝锛?
        if (/鐗╃悊|鍖栧|鐢熺墿|绉戝/.test(s)) {
          if (/绗琜涓€浜屼笁鍥涗簲鍏竷鍏節鍗乗d]+绔?.test(t)) return '绔?;
          if (/绗琜涓€浜屼笁鍥涗簲鍏竷鍏節鍗乗d]+鑺?.test(t)) return '鑺?;
          if (/瀹為獙|鎺㈢┒|娲诲姩/.test(t)) return '瀹為獙';
          if (/澶嶄範|灏忕粨|鎬荤粨|鍥為【/.test(t)) return '澶嶄範';
          return '';
        }
        // 鏂囩锛堝巻鍙?鍦扮悊/鏀挎不/閬撳痉涓庢硶娌伙級
        if (/鍘嗗彶|鍦扮悊|鏀挎不|閬撳痉|鎬濇兂/.test(s)) {
          if (/绗琜涓€浜屼笁鍥涗簲鍏竷鍏節鍗乗d]+[璇剧珷鍗曞厓]/.test(t)) {
            const m = t.match(/绗琜涓€浜屼笁鍥涗簲鍏竷鍏節鍗乗d]+(璇緗绔爘鍗曞厓)/);
            return m ? m[1] : '';
          }
          if (/鎺㈢┒|娲诲姩|璁ㄨ/.test(t)) return '娲诲姩';
          if (/澶嶄範|鎬荤粨|鍥為【/.test(t)) return '澶嶄範';
          return '';
        }
        // 閫氱敤锛氭娴嬫暟瀛楀墠缂€
        if (/^绗琜涓€浜屼笁鍥涗簲鍏竷鍏節鍗乗d]+[璇剧珷鑺傚崟鍏僝/.test(t)) {
          const m = t.match(/绗琜涓€浜屼笁鍥涗簲鍏竷鍏節鍗乗d]+([璇剧珷鑺傚崟鍏僝)/);
          return m ? m[1] : '';
        }
        return '';
      };
      
      instruction += `\n銆愭暀鏉愮珷鑺傜‘璁も€斺€斾互涓嬬珷鑺傜殑鎵€鏈夌煡璇嗗唴瀹归渶鍏ㄩ儴瑕嗙洊銆慭n`;
      for (const book of selectedBooks) {
        const selectedChapters = book.selectedChapters || [];
        if (selectedChapters.length > 0) {
          // 馃敡 瀛︾鎰熺煡锛氱珷鑺傛爣棰?绫诲瀷鏍囨敞+椤电爜
          const chapterInfo = selectedChapters.map(ch => {
            const label = detectChapterLabel(ch.title, book.subject || '');
            const labelStr = label ? `[${label}]` : '';
            return `${labelStr}${ch.title}锛堢${ch.start}-${ch.end}椤碉級`;
          }).join('銆?);
          instruction += `銆?{book.name}銆嬪凡閿佸畾锛?{chapterInfo}\n`;
        } else {
          instruction += `銆?{book.name}銆嬶紙鏈嬀閫夊叿浣撶珷鑺傦級\n`;
        }
        // 鐭ヨ瘑灞傜骇锛堝ぇ姒傚康鐢ㄦ暟瀛楃紪鍙凤紝鏍稿績鐭ヨ瘑鐢?- 鍖哄垎锛岄伩鍏嶅眰绾ф贩娣嗭級
        const hierarchyChapters = selectedChapters.filter(ch => ch.knowledgeHierarchy?.length);
        if (hierarchyChapters.length > 0) {
          instruction += `馃幆 鐭ヨ瘑灞傜骇锛歕n`;
          for (const chapter of hierarchyChapters) {
            let bcIdx = 0;
            for (const bigConcept of chapter.knowledgeHierarchy) {
              bcIdx++;
              instruction += `${bcIdx}. ${bigConcept.bigConcept}\n`;
              for (const core of (bigConcept.coreKnowledge || [])) {
                const level = core.level || core.cognitiveLevel || '';
                instruction += `  - ${core.name}${level ? ' ' + level : ''}\n`;
                if (core.specificConcepts?.length) {
                  instruction += `    鍏蜂綋姒傚康锛?{core.specificConcepts.join('銆?)}\n`;
                }
                if (core.suggestedQuestionTypes?.length) {
                  instruction += `    寤鸿棰樺瀷锛?{core.suggestedQuestionTypes.join('銆?)}\n`;
                }
              }
            }
          }
        }
      }
      instruction += `鉀?浠ヤ笂绔犺妭鎵€鏈夌煡璇嗙偣锛堝惈璇嶆眹琛ㄣ€佺敓瀛楄〃銆佽鍚庣粌涔犵瓑锛夊繀椤诲叏闈㈣鐩栵紝Step 4 浼氭彁渚涚簿鍑嗗師鏂囩墖娈点€俓n`;
    }

    // ========== 3.銆愮煡璇嗙偣鍏ㄨ鐩栥€戣鐩栬寖鍥磋姹傦紙鐢?getCoverageConstraint 鎻愪緵鍧楃骇鏍囬锛?=========
    if (genTypes && genTypes.length > 0) {
      const coverageConstraint = getCoverageConstraint(genTypes[0], subject, stage);
      if (coverageConstraint) {
        instruction += `\n${coverageConstraint}\n`;
      }
    }

    // ========== 3.銆愯川閲忚寖渚嬨€慺ew-shot 绀轰緥锛堢敱 getGenTypeExample 鎻愪緵鍧楃骇鏍囬锛?=========
    if (genTypes && genTypes.length > 0 && subject) {
      const genTypeExample = getGenTypeExample(genTypes[0], subject, stage, isLowerPrimary, grade, gradeSegment);
      if (genTypeExample) {
        instruction += `\n${genTypeExample}\n`;
      }
    }

    // ========== 4.銆愬娈?瀛︾绮惧噯閫傞厤銆戞牴鎹暀鏉愮殑骞寸骇/瀛︾浠庢寚浠ゅ簱鍔ㄦ€佹敞鍏?==========
    if (stage || subject) {
      instruction += `\n銆愬娈德峰绉戠簿鍑嗛€傞厤銆慭n`;
      
      // 馃敡 浠庢寚浠ゅ簱鑾峰彇瀛︽閫傞厤鍧楋紙鎸?gradeSegment 鍖归厤锛?
      const stageBlocks = getMatchingBlockInstructions({ category: '生成-题型分布建议', genType: gradeSegment });
      if (stageBlocks.length > 0) {
        instruction += stageBlocks[0].content + '\n';
      } else {
        console.warn(`[instructionLib] 鏈壘鍒板娈甸€傞厤: gradeSegment=${gradeSegment}`);
      }
      
      // 馃敡 浠庢寚浠ゅ簱鑾峰彇瀛︾閫傞厤鍧楋紙浼樺厛 gradeSegment 绮剧‘鍖归厤锛屽厹搴?stage+subject锛?
      const subjectBlocks = getMatchingBlockInstructions({ category: '生成-题型分布建议', subject, genType: gradeSegment });
      if (subjectBlocks.length > 0) {
        for (const block of subjectBlocks) {
          instruction += block.content + '\n';
        }
      } else {
        // 灏濊瘯 stage 绾у埆鐨勫厹搴?
        const subjFallback = getMatchingBlockInstructions({ category: '生成-学科适配', subject, stage });
        if (subjFallback.length > 0) {
          for (const block of subjFallback) {
            instruction += block.content + '\n';
          }
        } else {
          // 鏈€鍚庡厹搴曪細subject only
          const subjOnly = getMatchingBlockInstructions({ category: '生成-学科适配', subject });
          if (subjOnly.length > 0) {
            instruction += subjOnly[0].content + '\n';
          } else {
            console.warn(`[instructionLib] 鏈壘鍒板绉戦€傞厤: subject=${subject}, gradeSegment=${gradeSegment}`);
          }
        }
      }
      
      // 馃敡 瀛︽鎺у埗锛堟棫鍒嗙被锛屾寜骞寸骇娈电簿纭尮閰嶏紝閬垮厤浣庢鍐呭璇敞鍒颁腑楂樻锛?
      const stageControlBlocks = getMatchingBlockInstructions({ category: '生成-学段控制', subject: '', stage });
      if (stageControlBlocks.length > 0) {
        // 馃敡 骞寸骇娈电簿纭繃婊わ紙isLowerPrimary/isMiddlePrimary/isUpperPrimary 宸插湪鍑芥暟浣滅敤鍩燂級
        let matchedStageBlock = null;
        for (const block of stageControlBlocks) {
          if (stage === 'primary') {
            if (isLowerPrimary && block.id === 'stage_primary_low') { matchedStageBlock = block; break; }
            if (isMiddlePrimary && block.id === 'stage_primary_mid') { matchedStageBlock = block; break; }
            if (isUpperPrimary && block.id === 'stage_primary_high') { matchedStageBlock = block; break; }
          } else {
            // 鍒濅腑/楂樹腑鍚勫彧鏈変竴涓潯鐩紝鐩存帴鍙?
            matchedStageBlock = block;
            break;
          }
        }
        if (matchedStageBlock) {
          instruction += `銆愬娈垫帶鍒躲€?{matchedStageBlock.content}\n`;
        }
      }
      
      // 馃敡 瀛︾鐗硅壊锛堟棫鍒嗙被锛屾寜 subject+stage 浠庢寚浠ゅ簱娉ㄥ叆瀛︾鐗圭偣锛?
      const subjectFeatureBlocks = getMatchingBlockInstructions({ category: '生成-学科特色', subject, stage });
      if (subjectFeatureBlocks.length > 0) {
        instruction += `銆愬绉戠壒鑹层€慭n`;
        for (const block of subjectFeatureBlocks) {
          instruction += `- ${block.content}\n`;
        }
      }
      
      if (grade) instruction += `- 褰撳墠骞寸骇锛?{grade}\n`;
      const gradeHint = getSubjectGradeHint(subject, stage, gradeNum);
      if (gradeHint) instruction += `${gradeHint}\n`;
      instruction += `\n鈿狅笍 浠ヤ笂瀛︽鍜屽绉戣姹備负榛樿鍩哄噯銆備絾濡傛灉鏁欐潗鍘熸枃鍐呭瓒呭嚭浠ヤ笂鑼冨洿锛堝鑻辫涓夎捣鏁欐潗涓嚭鐜扮煭鏂囬槄璇伙級锛岃浠ユ暀鏉愬疄闄呭唴瀹逛负鍑嗗嚭棰橈紝瀛︽绾︽潫浠呬綔涓洪毦搴︿笅闄愬弬鑰冿紝涓嶄綔涓哄唴瀹逛笂闄愩€俓n`;
    }

    // ========== 5.銆愯祫鏂欑被鍨嬭ˉ鍏呯害鏉熴€戣ˉ鍏呯害鏉熸ā寮忥細鎻愪緵鏍煎紡/璐ㄩ噺/鍐呭琛ュ厖锛屼笉涓庛€愭牳蹇冧换鍔°€戜簤鎸囨尌鏉?==========
    if (autoFullInstructions && autoFullInstructions.length > 0) {
      instruction += `\n銆愯祫鏂欑被鍨嬭ˉ鍏呯害鏉熴€慭n`;
      for (const fullIns of autoFullInstructions) {
        instruction += `- ${fullIns.content}\n`;
      }
      instruction += `\n`;
    }

    // ========== 6.銆愭ā鏉跨簿鍑嗗鏍囥€?==========
    if (selectedTemplates && selectedTemplates.length > 0) {
      instruction += `銆愭ā鏉跨簿鍑嗗鏍囥€慭n`;
      instruction += `璇锋繁搴﹀鏍囦互涓嬫ā鏉匡紝鍏ㄩ潰妯′豢鍏堕鏍硷細\n`;
      for (const tpl of selectedTemplates) {
        const selectedChapters = tpl.selectedChapters || [];
        instruction += `\n馃搵 銆?{tpl.name}銆媆n`;
        if (selectedChapters.length > 0) {
          for (const chapter of selectedChapters) {
            instruction += `  - ${chapter.title}锛堢${chapter.start}-${chapter.end}椤碉級\n`;
          }
        }
        if (tpl.analysis) {
          const tplStructure = tpl.analysis.缁撴瀯鍒嗘瀽 || tpl.analysis.structure || [];
          if (tplStructure.length > 0) {
            instruction += `  缁撴瀯鍒嗘瀽锛歕n`;
            for (const section of tplStructure) {
              instruction += `    - ${section.澶ч || section.棰樺瀷}锛?{section.灏忛鏁伴噺 || 0}灏忛锛屽叡${section.澶ч鍒嗗€?|| 0}鍒哷;
              if (section.璁鹃棶椋庢牸) instruction += `锛岃闂細${section.璁鹃棶椋庢牸}`;
              if (section.闅惧害) instruction += `锛岄毦搴︼細${section.闅惧害}`;
              instruction += '\n';
            }
          }
          const tplTotalScore = tpl.analysis.鎬诲垎 || tpl.analysis.totalScore || 0;
          const tplQuestionCount = tpl.analysis.鎬婚鏁?|| tpl.analysis.questionCount || 0;
          if (tplTotalScore) {
            instruction += `  鎬诲垎锛?{tplTotalScore}鍒哱n`;
          }
          if (tplQuestionCount) {
            instruction += `  鎬婚鏁帮細${tplQuestionCount}棰榎n`;
          }

          // 馃敡 鏀硅繘锛氭彁鍙栧吀鍨嬮鐩綔涓洪鏍煎弬鐓э紙姣忕棰樺瀷鍙?閬擄級
          if (tpl.analysis.questionCards && tpl.analysis.questionCards.length > 0) {
            const cards = tpl.analysis.questionCards;
            instruction += `\n  銆愭ā鏉跨湡棰樼ず渚嬧€斺€旇涓ユ牸妯′豢浠ヤ笅棰樼洰鐨勮瑷€椋庢牸銆侀骞查暱搴︺€侀€夐」璁剧疆鏂瑰紡銆慭n`;
            // 浼樺厛鍙栦笉鍚岄鍨嬬殑棰橈紝姣忕棰樺瀷鍙?閬?
            const typeOrder = ['閫夋嫨棰?, '濉┖棰?, '鍒ゆ柇棰?, '瑙ｇ瓟棰?, '璁＄畻棰?, '搴旂敤棰?, '绠€绛旈'];
            const samples = [];
            for (const type of typeOrder) {
              const typeCards = cards.filter(c => c.type === type);
              const picked = typeCards.slice(0, 2); // 馃敡 姣忕棰樺瀷鍙?閬?
              samples.push(...picked);
              if (samples.length >= 5) break; // 馃敡 鏈€澶?閬?
            }
            // 濡傛灉棰樺瀷涓嶈冻3绉嶏紝琛ュ厖鍏朵粬棰?
            if (samples.length < 3) {
              for (const card of cards) {
                if (!samples.find(s => s.number === card.number)) {
                  samples.push(card);
                  if (samples.length >= 3) break;
                }
              }
            }
            for (const s of samples) {
              instruction += `  鈻?绗?{s.number}棰橈紙${s.type}锛?{s.difficulty || '鏈煡'}闅惧害锛?{s.score || '?'}鍒嗭級锛歕n`;
              instruction += `    棰樺共锛?{s.stem}\n`;
              if (s.options && s.options.length > 0) {
                instruction += `    閫夐」锛?{s.options.map((o, i) => String.fromCharCode(65 + i) + '. ' + o).join('锛?)}\n`;
              }
              if (s.questionFeature) {
                instruction += `    璁鹃棶鐗瑰緛锛?{s.questionFeature}\n`;
              }
            }
            // 缁熻棰樺共闀垮害鐗瑰緛
            const stemLengths = cards.filter(c => c.stem).map(c => c.stem.length);
            if (stemLengths.length > 0) {
              const avgLength = Math.round(stemLengths.reduce((a, b) => a + b, 0) / stemLengths.length);
              const minLength = Math.min(...stemLengths);
              const maxLength = Math.max(...stemLengths);
              instruction += `  棰樺共闀垮害鍙傝€冿細骞冲潎${avgLength}瀛楋紙鏈€鐭?{minLength}瀛楋紝鏈€闀?{maxLength}瀛楋級锛岃淇濇寔鐩歌繎鐨勯骞查暱搴︺€俓n`;
            }
            
            // 鉁?妯℃澘閲忓寲鐗瑰緛鍒嗘瀽
            const totalCards = cards.length;
            if (totalCards > 0) {
              // 棰樺瀷鍒嗗竷缁熻
              const typeCount = {};
              cards.forEach(c => { typeCount[c.type] = (typeCount[c.type] || 0) + 1; });
              const typeDist = Object.entries(typeCount)
                .map(([t, n]) => `${t}鍗?{Math.round(n/totalCards*100)}%`)
                .join('锛?);
              
              // 闅惧害鍒嗗竷缁熻
              const diffCount = {};
              cards.forEach(c => { diffCount[c.difficulty] = (diffCount[c.difficulty] || 0) + 1; });
              const diffDist = Object.entries(diffCount)
                .map(([d, n]) => `${d}鍗?{Math.round(n/totalCards*100)}%`)
                .join('锛?);
              
              // 閫夐」鏁伴噺缁熻锛堥€夋嫨棰橈級
              const choiceCards = cards.filter(c => c.type === '閫夋嫨棰? && c.options?.length);
              const optionCounts = choiceCards.map(c => c.options.length);
              const avgOptions = optionCounts.length > 0 
                ? Math.round(optionCounts.reduce((a, b) => a + b, 0) / optionCounts.length) 
                : 4;
              
              // 鎯呭铻嶅叆姣斾緥
              const contextCards = cards.filter(c => 
                c.questionFeature?.includes('鎯呭') || c.stem?.length > 50
              );
              const contextRatio = Math.round(contextCards.length / totalCards * 100);
              
              // 闅惧害鎺掑簭瑙勫緥
              const difficultyOrder = cards.map(c => c.difficulty);
              const firstHardIndex = difficultyOrder.findIndex(d => d === '杈冮毦' || d === '鎻愰珮');
              const difficultyCurve = firstHardIndex > 0 
                ? `鍓?{firstHardIndex}棰樹互鍩虹涓轰富锛屼粠绗?{firstHardIndex + 1}棰樺紑濮嬪嚭鐜拌緝闅鹃`
                : '闅惧害鍧囧寑鍒嗗竷';
              
              instruction += `\n  銆愭ā鏉块噺鍖栫壒寰佲€斺€旇涓ユ牸瀵规爣銆慭n`;
              instruction += `  - 棰樺瀷鍒嗗竷锛?{typeDist}\n`;
              instruction += `  - 闅惧害鍒嗗竷锛?{diffDist}\n`;
              instruction += `  - 闅惧害閫掕繘锛?{difficultyCurve}\n`;
              instruction += `  - 閫夋嫨棰橀€夐」鏁帮細${avgOptions}涓猏n`;
              instruction += `  - 鎯呭铻嶅叆姣斾緥锛氱害${contextRatio}%锛?{contextCards.length}/${totalCards}棰樻湁鎯呭锛塡n`;
              // 馃敡 鏂板锛氭敞鍏ヨ瑷€鎸囩汗
              if (tpl.analysis?.languageStyle) {
                const ls = tpl.analysis.languageStyle;
                instruction += `\n  銆愯瑷€椋庢牸鎸囩汗鈥斺€旇绮剧‘妯′豢銆慭n`;
                if (ls.avgSentenceLength) {
                  instruction += `  - 骞冲潎鍙ラ暱锛?{ls.avgSentenceLength}瀛楋紙璇蜂繚鎸佺浉杩戠殑鍙ュ瓙闀垮害锛塡n`;
                }
                if (ls.commonPatterns?.length) {
                  instruction += `  - 楂橀鍙ュ紡锛?{ls.commonPatterns.join('銆?)}\n`;
                }
                if (ls.connectors?.length) {
                  instruction += `  - 杩炴帴璇嶅亸濂斤細${ls.connectors.join('銆?)}\n`;
                }
                if (ls.contextIntro) {
                  instruction += `  - 鎯呭寮曞叆鏂瑰紡锛?{ls.contextIntro}\n`;
                }
                if (ls.personReference) {
                  instruction += `  - 鎸囦唬鏂瑰紡锛?{ls.personReference}\n`;
                }
                if (ls.tone) {
                  instruction += `  - 璇皵鐗瑰緛锛?{ls.tone}\n`;
                }
                if (ls.sampleSentence) {
                  instruction += `  - 鍏稿瀷鍙ュ紡绀轰緥锛氥€?{ls.sampleSentence}銆峔n`;
                }
              }
              
              // 馃敡 鏂板锛氭敞鍏ユ牸寮忔帓鐗堢壒寰?
              if (tpl.analysis?.formatStyle) {
                const fs = tpl.analysis.formatStyle;
                instruction += `\n  銆愭牸寮忔帓鐗堟寚绾光€斺€旇淇濇寔涓€鑷淬€慭n`;
                if (fs.spacingBetweenQuestions !== undefined) {
                  instruction += `  - 棰樼洰闂磋窛锛?{fs.spacingBetweenQuestions ? '棰橀棿鏈夌┖琛? : '棰橀棿绱у噾鎺掑垪'}\n`;
                }
                if (fs.indentation) {
                  instruction += `  - 缂╄繘鏂瑰紡锛?{fs.indentation}\n`;
                }
                if (fs.scorePosition) {
                  instruction += `  - 鍒嗘暟鏍囨敞浣嶇疆锛?{fs.scorePosition}\n`;
                }
                if (fs.chartDescriptionFormat) {
                  instruction += `  - 鍥捐〃璇存槑鏍煎紡锛?{fs.chartDescriptionFormat}\n`;
                }
              }
            }
          }
        } else {
          instruction += `  锛堣鍏堢偣鍑汇€屽垎鏋愭ā鏉裤€嶈幏鍙栨ā鏉跨壒寰侊級\n`;
        }
      }
            // 鉁?鏂板锛氳瑷€椋庢牸鐗瑰緛鍒嗘瀽
      if (selectedTemplates && selectedTemplates.length > 0) {
        const tpl = selectedTemplates[0];
        if (tpl.analysis?.questionCards?.length > 0) {
          const cards = tpl.analysis.questionCards;
          // 鍒嗘瀽璇█椋庢牸
          const allStems = cards.map(c => c.stem || '').filter(Boolean);
          const avgStemLen = allStems.length > 0 
            ? Math.round(allStems.reduce((a, b) => a + b.length, 0) / allStems.length) 
            : 0;
          const shortQuestions = allStems.filter(s => s.length < 30).length;
          const longQuestions = allStems.filter(s => s.length > 80).length;
          
          // 鍒嗘瀽璁鹃棶妯″紡
          const directQuestions = cards.filter(c => 
            c.questionFeature?.includes('鐩存帴璁鹃棶') || 
            (c.stem || '').match(/^(璇穦璇晐璁＄畻|姹傝В|璇佹槑|鍒ゆ柇|閫夋嫨|濉┖)/)
          ).length;
          const contextQuestions = cards.filter(c => 
            c.questionFeature?.includes('鎯呭') || (c.stem || '').length > 60
          ).length;
          
          instruction += `\n  銆愯瑷€椋庢牸鐗瑰緛鈥斺€旇涓ユ牸妯′豢銆慭n`;
          instruction += `  - 棰樺共骞冲潎闀垮害锛?{avgStemLen}瀛楋紙鐭骞测墹30瀛楋細${shortQuestions}棰橈紝闀块骞测墺80瀛楋細${longQuestions}棰橈級\n`;
          instruction += `  - 璁鹃棶鏂瑰紡锛氱洿鎺ヨ闂?{directQuestions}棰橈紝鎯呭璁鹃棶${contextQuestions}棰榎n`;
          
          if (avgStemLen < 40) {
            instruction += `  - 椋庢牸鍊惧悜锛氱畝娲佺簿鐐煎瀷锛岄骞茬煭灏忕洿鎺ワ紝閫傚悎浣庡勾绾ф垨鍩虹璁粌\n`;
          } else if (avgStemLen > 70) {
            instruction += `  - 椋庢牸鍊惧悜锛氭儏澧冧赴瀵屽瀷锛岄骞插寘鍚畬鏁存儏澧冩弿杩帮紝閫傚悎楂樺勾绾ф垨缁煎悎搴旂敤\n`;
          } else {
            instruction += `  - 椋庢牸鍊惧悜锛氬潎琛″瀷锛岄骞查暱搴﹂€備腑锛屽吋椤炬儏澧冧笌鏁堢巼\n`;
          }
          
          // 鍒嗘瀽璇█鐗瑰緛锛氭槸鍚︿娇鐢?璇?"璇?"宸茬煡"绛夊紩瀵艰瘝
          const hasPlease = allStems.filter(s => s.includes('璇?)).length;
          const hasTry = allStems.filter(s => s.includes('璇?)).length;
          const hasKnown = allStems.filter(s => s.includes('宸茬煡')).length;
          if (hasPlease > 0 || hasTry > 0 || hasKnown > 0) {
            instruction += `  - 璇█涔犳儻锛歚;
            const habits = [];
            if (hasPlease > 0) habits.push(`浣跨敤"璇?寮曞锛?{hasPlease}棰橈級`);
            if (hasTry > 0) habits.push(`浣跨敤"璇?寮曞锛?{hasTry}棰橈級`);
            if (hasKnown > 0) habits.push(`浣跨敤"宸茬煡"闄堣堪锛?{hasKnown}棰橈級`);
            instruction += habits.join('锛?) + '\n';
          }
          
          // 绛旀鏍煎紡鐗瑰緛
          const answerCards = cards.filter(c => c.answer);
          if (answerCards.length > 0) {
            const answerLengths = answerCards.map(c => (c.answer || '').length);
            const avgAnsLen = Math.round(answerLengths.reduce((a, b) => a + b, 0) / answerLengths.length);
            instruction += `  - 绛旀鏍煎紡锛氬钩鍧?{avgAnsLen}瀛楋紝`;
            if (avgAnsLen < 10) instruction += `绠€娲佸瀷锛堥€傚悎濉┖/閫夋嫨锛塡n`;
            else if (avgAnsLen < 50) instruction += `鏍囧噯鍨嬶紙閫傚悎璁＄畻/绠€绛旓級\n`;
            else instruction += `璇︾粏鍨嬶紙閫傚悎瑙ｇ瓟/璁鸿堪锛塡n`;
          }
        }
      }
      instruction += `\n璇风‘淇濈敓鎴愯祫鏂欏湪浠ヤ笅缁村害涓ユ牸瀵规爣妯℃澘锛氶鍨嬬粨鏋勩€佸垎鍊煎垎甯冦€佽闂鏍笺€佽瑷€琛ㄨ揪銆侀毦搴﹀眰娆°€俓n`;
      instruction += `鍙€傞噺寮曠敤妯℃澘涓殑浼樼棰樼洰锛堜笉瓒呰繃30%锛夛紝浣嗗ぇ閮ㄥ垎棰樼洰闇€鍩轰簬鏁欐潗鍐呭閲嶆柊鍛介銆俓n\n`;
    }

    instruction += `\n`;

    // ========== 8.銆愬浘褰?鍥捐〃/鍏紡/閰嶅浘涓撻」鎸囦护銆戝畬鍏ㄤ粠鎸囦护搴撹鍙栵紙涓撻」瑕佹眰+EduRender妯℃澘鍙屾簮鍚堝苟锛?=========
    if (subject) {
      const rules = [];
      
      // 鈶?涓撻」瑕佹眰锛堝叕寮?鍥惧舰/鍥捐〃/閰嶅浘鏍煎紡瑕佹眰锛夆€斺€?鎸?gradeSegment 瀛︽绮剧‘鍖归厤
      const specBlocks = getMatchingBlockInstructions({ category: '生成-题型分布建议', subject, stage: gradeSegment });
      for (const block of specBlocks) {
        rules.push(block.content);
      }
      
      // 鈶?EduRender 娓叉煋妯℃澘锛堝叕寮?鏁拌酱/鍑犱綍/鍥捐〃/鍔涘/鐢佃矾/鍏夎矾/鍘熷瓙/閰嶅浘锛夆€斺€?鎸?subject 鍖归厤锛屽叏瀛︽閫氱敤
      const allEduBlocks = getMatchingBlockInstructions({ category: '生成-EduRender模板', subject, stage: '', genType: '' });
      const genericEduBlocks = getMatchingBlockInstructions({ category: '生成-EduRender模板', subject: '', stage: '', genType: '' });
      const eduBlocks = [...allEduBlocks];
      for (const b of genericEduBlocks) {
        if (!eduBlocks.find(e => e.id === b.id)) eduBlocks.push(b);
      }
      const eduOrder = ['formula', 'chart', 'axis', 'shapes', 'force', 'circuit', 'optics', 'atom', 'image'];
      eduBlocks.sort((a, b) => {
        const ai = eduOrder.findIndex(k => a.id.includes(k));
        const bi = eduOrder.findIndex(k => b.id.includes(k));
        return (ai >= 0 ? ai : 99) - (bi >= 0 ? bi : 99);
      });
      for (const block of eduBlocks) {
        const label = block.name.replace('銆怑duRender妯℃澘銆?, '');
        rules.push(`銆怑duRender Studio鈥斺€?{label}銆慭n${block.content}`);
      }
      
      if (specBlocks.length === 0 && eduBlocks.length === 0) {
        console.warn(`[instructionLib] 鏈壘鍒颁笓椤硅姹?EduRender妯℃澘: subject=${subject}, gradeSegment=${gradeSegment}`);
      }
      
      if (rules.length > 0) {
        instruction += `銆愬浘褰?鍥捐〃/鍏紡/閰嶅浘涓撻」鎸囦护銆慭n`;
        rules.forEach(r => { instruction += r + '\n'; });
        instruction += `\n`;
      }
    }

    // ========== 9.銆愭湳璇鑼冦€戝绉戞湳璇鑼冿紙浼樺厛浠庢寚浠ゅ簱璇诲彇锛?=========
    if (subject) {
      const termBlocks = getMatchingBlockInstructions({ category: '生成-术语规范', subject, stage: '' });
      if (termBlocks.length > 0) {
        instruction += `銆愭湳璇鑼冦€?{termBlocks[0].content}\n\n`;
      }
    }

    // ========== 10.銆愬懡棰樿寖鍥翠笌椋庢牸銆?==========
    if (scopeType || propositionStyle) {
      instruction += `銆愬懡棰樿寖鍥翠笌椋庢牸銆慭n`;
      const scopeLabels = { default: '鎸夊嬀閫夌珷鑺傝寖鍥?, midterm: '鏈熶腑鑰冭瘯鑼冨洿', final: '鏈熸湯鑰冭瘯鑼冨洿', topic: '涓撻澶嶄範鑼冨洿' };
    }
    if (scopeType) {
      instruction += `鑼冨洿绫诲瀷锛?{scopeLabels[scopeType] || '榛樿鑼冨洿'}銆俓n`;
    }
    if (propositionStyle) {
      // 馃敡 浠庢寚浠ゅ簱鑾峰彇鍛介椋庢牸鎸囦护锛堟墍鏈夐鏍煎潎宸插叆搴擄紝鍏滃簳浠呬綔瀹夊叏缃戯級
      const styleBlocks = getMatchingBlockInstructions({ category: '生成-命题风格', genType: propositionStyle });
      if (styleBlocks.length === 0) {
        console.warn(`[instructionLib] 鏈壘鍒扮敓鎴?鍛介椋庢牸: genType=${propositionStyle}, 浣跨敤 styleInstructions 鍏滃簳`);
      }
      const styleDesc = styleBlocks.length > 0 ? styleBlocks[0].content : (styleInstructions[propositionStyle] || propositionStyle);
      instruction += `鍛介椋庢牸锛?{styleDesc}`;
      
      if (stage && subject) {
        if (propositionStyle === 'context_fusion' || propositionStyle === 'unified_context') {
          // 馃敡 浠庢寚浠ゅ簱鑾峰彇鎯呭鏂瑰悜寤鸿
          const ctxBlocks = getMatchingBlockInstructions({ category: '生成-情境方向', subject, stage });
          if (ctxBlocks.length > 0) {
            instruction += `\n${ctxBlocks[0].content}銆俙;
          }
        }
      }
      instruction += `\n\n`;
    }

    // 馃敡 鎯呭瑕佹眰锛堟棫鍒嗙被锛屾寜 stage+subject 浠庢寚浠ゅ簱娉ㄥ叆鎯呭鍖栧懡棰樿姹傦級
    if (stage || subject) {
      const stageCtxBlocks = getMatchingBlockInstructions({ category: '生成-情境要求', subject: '', stage });
      const subjCtxBlocks = subject ? getMatchingBlockInstructions({ category: '生成-情境要求', subject, stage: '' }) : [];
      if (stageCtxBlocks.length > 0 || subjCtxBlocks.length > 0) {
        instruction += `銆愭儏澧冭姹傘€慭n`;
        if (stageCtxBlocks.length > 0) {
          instruction += `- ${stageCtxBlocks[0].content}\n`;
        }
        for (const block of subjCtxBlocks) {
          instruction += `- ${block.content}\n`;
        }
        instruction += `\n`;
      }
    }

    // ========== 11.銆愰鍨嬭璁′笌闅惧害閰嶇疆銆戔€?
    const hasTypeConfig = questionTypes && questionTypes.length > 0 && questionTypes.some(qt => qt.selected);
    const hasDiffConfig = difficultyLevels && difficultyLevels.length > 0 && difficultyLevels.some(d => d.selected);
    
    // 馃敡 D1+D2+D3 淇锛氭娴嬮粯璁ゅ€硷紝涓?stageMap 鏉冨▉婧愬榻?
    const usingDefaultDiff = isDefaultDifficulty(difficultyLevels);
    const usingDefaultTypes = isDefaultQuestionTypes(questionTypes);
    const isExamOrPractice = primaryGenType === 'exam' || primaryGenType === 'practice';
    const stageRatio = stage && subject ? getStageDifficultyRatio(stage, isLowerPrimary, isMiddlePrimary, isUpperPrimary) : null;
    const effectiveTotalScore = totalScore || getDefaultTotalScore(primaryGenType, subject, stage);
    // 褰?exam/practice 浣跨敤閫氱敤榛樿棰樺瀷涓?B3 琛ュ厖瀛樺湪鏃讹紝璺宠繃榛樿棰樺瀷杈撳嚭
    const b3Supplement = (isExamOrPractice && subject)
      ? getGenTypeTypeSupplement(primaryGenType, subject, gradeSegment)
      : '';
    const skipDefaultTypes = isExamOrPractice && usingDefaultTypes && b3Supplement;
    
    if (hasTypeConfig || hasDiffConfig || effectiveTotalScore || isExamOrPractice) {
      instruction += `銆愰鍨嬭璁′笌闅惧害閰嶇疆銆慭n`;
      
      // 棰樺瀷涓庢暟閲忓垎閰?
      if (hasTypeConfig && !skipDefaultTypes) {
        const selectedTypes = questionTypes.filter(qt => qt.selected);
        instruction += `棰樺瀷涓庢暟閲忓垎閰嶏細\n`;
        for (const qt of selectedTypes) {
          instruction += `  - ${qt.name}锛?{qt.count}棰榒;
          if (qt.score) instruction += `锛屾瘡棰?{qt.score}鍒哷;
          instruction += `\n`;
        }
        if (usingDefaultTypes && !isExamOrPractice) {
          instruction += `锛堜互涓婁负榛樿棰樺瀷閰嶇疆锛屽彲鏍规嵁闇€瑕佸湪鍙充晶闈㈡澘璋冩暣锛塡n`;
        }
      } else if (skipDefaultTypes) {
        instruction += `棰樺瀷涓庢暟閲忓垎閰嶏細瑙佷笅鏂广€?{primaryGenType === 'exam' ? '璇曞嵎' : '璇炬椂缁?}棰樺瀷鏁伴噺琛ュ厖寤鸿銆慭n`;
      }
      
      // 闅惧害鍒嗗竷锛氿煍?D1淇 鈥斺€?stageMap 鏉冨▉鍊艰鐩栫‖缂栫爜榛樿
      if (hasDiffConfig) {
        const diffOverridden = usingDefaultDiff && stageRatio
          && (stageRatio.basic !== 50 || stageRatio.medium !== 30 || stageRatio.advanced !== 20);
        if (diffOverridden) {
          instruction += `闅惧害鍒嗗竷锛堟牴鎹?{grade || stage}瀛︽鑷姩閫傞厤锛屽凡瑕嗙洊榛樿鍊硷級锛歕n`;
          instruction += `  - 鍩虹棰樼害鍗?{stageRatio.basic}%锛屼富瑕佽€冩煡鏁欐潗鍩烘湰姒傚康鍜屾妧鑳界殑鎺屾彙\n`;
          instruction += `  - 涓。棰樼害鍗?{stageRatio.medium}%锛岄€傚綋鏀圭紪鏁欐潗鍘熼锛屽鍔犳€濈淮鍚噺\n`;
          instruction += `  - 鎻愰珮棰樼害鍗?{stageRatio.advanced}%锛岃璁℃帰绌舵€ф垨缁煎悎鎬т换鍔n`;
        } else {
          const selected = difficultyLevels.filter(d => d.selected);
          instruction += `闅惧害鍒嗗竷锛歕n`;
          selected.forEach(d => {
            if (d.name === '鍩虹棰?) instruction += `  - 鍩虹棰樼害鍗?{d.percentage}%锛屼富瑕佽€冩煡鏁欐潗鍩烘湰姒傚康鍜屾妧鑳界殑鎺屾彙\n`;
            if (d.name === '涓。棰?) instruction += `  - 涓。棰樼害鍗?{d.percentage}%锛岄€傚綋鏀圭紪鏁欐潗鍘熼锛屽鍔犳€濈淮鍚噺\n`;
            if (d.name === '鎻愰珮棰?) instruction += `  - 鎻愰珮棰樼害鍗?{d.percentage}%锛岃璁℃帰绌舵€ф垨缁煎悎鎬т换鍔n`;
          });
        }
        instruction += `闅惧害搴旀湁姊害锛屼粠鏄撳埌闅炬帓鍒椼€俓n`;
      }
      
      // 鎬诲垎锛氿煍?D3淇 鈥斺€?鏅鸿兘榛樿瀵规爣鐜拌鑰冭瘯鏍囧噯
      if (effectiveTotalScore) {
        instruction += `鎬诲垎锛?{effectiveTotalScore}鍒哷;
        if (!totalScore) {
          const stageLabel = stage === 'primary' ? '灏忓' : stage === 'middle' ? '鍒濅腑' : '楂樹腑';
          instruction += `锛?{stageLabel}${subject}鑰冭瘯鏍囧噯鑷姩璁剧疆锛屽彲鎵嬪姩璋冩暣锛塦;
        }
        instruction += `銆俓n`;
      }
      
      // 馃敡 Gap2: 鏃堕棿鍒嗛厤寤鸿锛堝鏍囧競闈㈣€冨嵎锛?
      const timeAlloc = getTimeAllocation(primaryGenType, subject, stage);
      if (timeAlloc) {
        instruction += `${timeAlloc}銆俓n`;
      }
      
      // 馃敡 棰橀噺鎺у埗锛堟棫鍒嗙被锛屾寜 stage 浠庢寚浠ゅ簱娉ㄥ叆鎺掔増瑙勫垯锛?
      const layoutBlocks = getMatchingBlockInstructions({ category: '生成-题量控制', subject: '', stage: gradeSegment })
      if (layoutBlocks.length > 0) {
        instruction += `銆愰閲忔帶鍒躲€?{layoutBlocks[0].content}\n`;
      }
      // 馃敡 闅惧害鎺у埗锛堟棫鍒嗙被锛屾寜 stage 浠庢寚浠ゅ簱娉ㄥ叆闅惧害閰嶆瘮锛?
      const diffControlBlocks = getMatchingBlockInstructions({ category: '生成-难度控制', subject: '', stage: gradeSegment })
      if (diffControlBlocks.length > 0) {
        instruction += `銆愰毦搴︽帶鍒躲€?{diffControlBlocks[0].content}\n`;
      }
      
      // 馃敡 璇曞嵎/璇炬椂缁冿細鎸夊绉懨楀娈垫敞鍏ラ鍨嬫暟閲忚ˉ鍏呭缓璁?
      if (b3Supplement) {
        instruction += `\n${primaryGenType === 'exam' ? '銆愯瘯鍗? : '銆愯鏃剁粌'}棰樺瀷鏁伴噺琛ュ厖寤鸿锛?{grade}${subject}锛夈€慭n`;
        instruction += b3Supplement;
      }
      
      instruction += `\n`;
    }

    // ========== 12.銆愬绉戞牳蹇冪礌鍏汇€戔€?
    if (subject) {
      const coreBlocks = getMatchingBlockInstructions({ category: '生成-学科核心素养', subject, stage });
      if (coreBlocks.length > 0) {
        instruction += `銆愬绉戞牳蹇冪礌鍏汇€?{coreBlocks[0].content}\n\n`;
      } else {
        console.warn(`[instructionLib] 鏈壘鍒板绉戞牳蹇冪礌鍏? subject=${subject}`);
      }
    }
    // 閫氱敤鏍稿績绱犲吇妗嗘灦锛堟寜瀛︽绮剧‘鍖归厤锛屼笉浼氬悓鏃跺嚭鐜板皬瀛?鍒濅腑/楂樹腑鏂囨湰锛?
    const generalCoreBlocks = getMatchingBlockInstructions({ category: '生成-学科核心素养', subject: '', stage });
    if (generalCoreBlocks.length > 0) {
      instruction += generalCoreBlocks[0].content + '\n';
    } else {
      console.warn(`[instructionLib] 鏈壘鍒伴€氱敤鏍稿績绱犲吇: stage=${stage}`);
    }

    // ========== 13.銆愮壒娈婅姹傘€戔€?
    const specialReqBlocks = getMatchingBlockInstructions({ category: '生成-特殊要求', subject: '', stage: '' });
    if (specialReqBlocks.length > 0) {
      instruction += `銆愮壒娈婅姹傘€?{specialReqBlocks[0].content}\n\n`;
    }

    // 馃敡 Fix B: 鐭ヨ瘑杈圭晫绾︽潫锛堟槑纭憡璇?AI 浠€涔堜笉鑰冦€佷粈涔堜笉娑夊強锛?
    if (subject) {
      const knowledgeBoundaries = getKnowledgeBoundaries(subject, stage, isLowerPrimary, isMiddlePrimary, isUpperPrimary, grade);
      if (knowledgeBoundaries) {
        instruction += knowledgeBoundaries + '\n\n';
      }
    }

    // ========== 14.銆愰鐩川閲忔爣鍑嗐€戯紙浠庢寚浠ゅ簱鎸塻tage+subject涓夌淮搴﹀尮閰嶏紝鏃犵‖缂栫爜鍏滃簳锛?=========
    // 馃敡 鍩虹瑙勫垯锛堟墍鏈夐樁娈甸€氱敤锛屼粎鍙?subject='' 涓?stage='' 鐨勭函閫氱敤鏉＄洰锛?
    const qualityBase = getMatchingBlockInstructions({ category: '生成-题目质量标准', subject: '', stage: '' });
    // 馃敡 瀛︽涓撳睘瑙勫垯锛坒ilter 鎺掗櫎 subject 闈炵┖鐨勫绉戞潯鐩紝浠呭彇绾娈垫潯鐩紝涓旀寜 gradeSegment 绮剧‘鍖归厤锛?
    const qualityStageAll = getMatchingBlockInstructions({ category: '生成-题目质量标准', subject: '', stage });
    const qualityStageOnly = qualityStageAll.filter(b => {
      if (!b.stage || b.stage === '' || b.subject !== '') return false;
      // 馃敡 Q2: gradeSegment 绮剧‘鍖归厤鈥斺€斿皬瀛︿綆/涓?楂樻鍚勫彇涓撳睘鏉＄洰锛岄伩鍏嶄竴鑲¤剳娉ㄥ叆
      if (b.genType && b.genType !== '') return b.genType === gradeSegment;
      return true; // 鏃?genType 鐨勬潯鐩€傜敤浜庢墍鏈夊勾绾ф
    });
    // 馃敡 瀛︾涓撳睘瑙勫垯锛坒ilter 鎺掗櫎 subject 涓虹┖鐨勯€氱敤鏉＄洰锛岄伩鍏?base 閲嶅锛?
    const qualitySubjAll = subject ? getMatchingBlockInstructions({ category: '生成-题目质量标准', subject, stage: '' }) : [];
    const qualitySubjOnly = qualitySubjAll.filter(b => b.subject && b.subject !== '');
    
    if (qualityBase.length > 0) {
      instruction += `銆愰鐩川閲忔爣鍑嗐€?{qualityBase[0].content}\n`;
      // 瀛︽琛ュ厖锛堣鐩栧熀纭€瑙勫垯涓殑閫夐」鏁般€侀毦搴﹂厤姣旂瓑锛?
      if (qualityStageOnly.length > 0 && qualityStageOnly[0].content !== qualityBase[0].content) {
        instruction += qualityStageOnly[0].content + '\n';
      }
      // 馃敡 Q1: 瀛︾涓撳睘琛ュ厖 鈥?鍔犲垎闅旂涓庣紪鍙峰垪琛ㄦ槑纭柇寮€锛岄伩鍏嶈璇В涓哄欢缁紪鍙?
      if (qualitySubjOnly.length > 0) {
        instruction += `\n銆愬绉戣ˉ鍏呮爣鍑嗐€慭n${qualitySubjOnly[0].content}\n`;
      }
    } else {
      console.warn(`[instructionLib] 鏈壘鍒伴鐩川閲忔爣鍑? stage=${stage}, subject=${subject}`);
    }
    instruction += '\n';

    // ========== 15.銆愮瓟妗堜笌瑙ｆ瀽瑙勮寖銆戞暀杈呯骇绛旀璐ㄩ噺锛堜紭鍏堜粠鎸囦护搴撹鍙栵級==========
    // 馃敡 Q1+Q3+Q4: 瀵规爣甯傞潰鏁欒緟鐨勭瓟妗堜笌瑙ｆ瀽鏍囧噯
    if (subject) {
      const answerSpec = getAnswerQualitySpec(primaryGenType, subject, stage);
      const scoringRubric = getScoringRubric(primaryGenType, subject, stage);
      const chineseTemplates = getChineseReadingTemplates(subject);
      if (answerSpec || scoringRubric || chineseTemplates) {
        const answerSpecBlocks = getMatchingBlockInstructions({ category: '生成-答案与解析规范', subject: '', stage: '' });
        const answerHeader = answerSpecBlocks.length > 0
          ? `銆愮瓟妗堜笌瑙ｆ瀽瑙勮寖銆?{answerSpecBlocks[0].content}`
          : `銆愮瓟妗堜笌瑙ｆ瀽瑙勮寖銆戜互涓嬩负鏁欒緟绾х瓟妗堣川閲忔爣鍑嗭紝璇蜂弗鏍奸伒瀹堜互纭繚杈撳嚭璐ㄩ噺瀵规爣甯傞潰鏁欒緟锛歚;
        instruction += answerHeader + '\n';
        if (answerSpec) instruction += answerSpec + '\n';
        if (scoringRubric) instruction += scoringRubric + '\n';
        if (chineseTemplates) instruction += chineseTemplates + '\n';
        instruction += '\n';
      }
    }

    // ========== 16.銆愮瓟棰樻ā鏉裤€戝绉戠瓟棰樿鑼冿紙浠庢寚浠ゅ簱璇诲彇锛?=========
    if (subject) {
      const templateBlocks = getMatchingBlockInstructions({ category: '生成-答题模板', subject, stage: '' });
      if (templateBlocks.length > 0) {
        instruction += `銆愮瓟棰樻ā鏉裤€?{templateBlocks[0].content}\n\n`;
      }
    }

    // ========== 17.銆愯嚜鍔ㄦ敞鍏ユ寚浠も€斺€斾粎娉ㄥ叆鏈鍏朵粬銆愩€戝潡瑕嗙洊鐨勮ˉ鍏呯被鐗囨銆?=========
    // 馃敡 鎺掗櫎宸插湪鍏朵粬 section 涓€氳繃 getMatchingBlockInstructions 鏄惧紡鏌ヨ鐨勭被鍒?
    // 馃敡 鎺掗櫎鍒嗘瀽涓撶敤绫诲埆锛堟枃鏈垎鏋愯鑼?鍒嗘瀽妯℃澘绀轰緥/鍒嗘瀽鎻愬彇瑕佹眰/鐭ヨ瘑鍥捐氨鏋勫缓锛?
    const HANDLED_CATEGORIES = new Set([
      // 鐢熸垚-瀛︽涓庡绉?
      '生成-学段适配', '生成-学科适配', '生成-资料类型结构',
      '生成-学科禁止项', '生成-情境方向',
      '生成-学段控制', '生成-学科特色', '生成-题量控制', '生成-难度控制', '生成-情境要求',
      // 鐢熸垚-璐ㄩ噺涓庣害鏉?
      '生成-学科核心素养', '生成-禁止项', '生成-通用约束', '生成-原题引用', '生成-内容规范',
      '生成-输出格式', '生成-学科标记', '生成-EduRender模板', '生成-专项要求', '生成-题型专项要求',
      '生成-题目质量标准', '生成-答案与解析规范', '生成-质量范例', '生成-知识点全覆盖',
      '生成-主观题评分标准', '生成-术语规范', '生成-答题模板', '生成-特殊要求',
      '生成-知识边界', '生成-时间分配',
      // 鍒嗘瀽-鏂囨湰鍒嗘瀽涓撶敤
      '分析-文本分析规范', '分析-分析模板示例', '分析-分析提取要求', '分析-知识图谱构建'
    ]);
    const supplementaryFragments = (injectedFragments || []).filter(f => !HANDLED_CATEGORIES.has(f.category));
    if (supplementaryFragments.length > 0) {
      // 鎸夌被鍒垎缁勶紝閬垮厤閲嶅鍐呭
      const grouped = {};
      const seenContents = new Set();
      for (const frag of supplementaryFragments) {
        if (seenContents.has(frag.content)) continue;
        seenContents.add(frag.content);
        if (!grouped[frag.category]) grouped[frag.category] = [];
        grouped[frag.category].push(frag);
      }
      for (const [cat, frags] of Object.entries(grouped)) {
        instruction += `銆?{cat}銆慭n`;
        for (const frag of frags) {
          instruction += `- ${frag.content}\n`;
        }
        instruction += '\n';
      }
    }

    // ========== 18.銆愬師棰樺紩鐢ㄤ笌绂佹椤广€?=========
    if (allowOriginalQuestions) {
      const originalQuoteBlocks = getMatchingBlockInstructions({ category: '生成-原题引用', subject: '', stage: '' });
      if (originalQuoteBlocks.length > 0) {
        instruction += `銆愬師棰樺紩鐢ㄣ€?{originalQuoteBlocks[0].content}\n`;
      } else {
        console.warn('[instructionLib] 鏈壘鍒板師棰樺紩鐢ㄦ潯鐩?);
      }
    }
    // 馃敡 閫氱敤绾︽潫锛氫粠鎸囦护搴撳尮閰嶆爣娉ㄥ嚭澶勩€侀伩鍏嶇収鎼€佽鐭ュ眰绾х瓑閫氱敤瑕佹眰
    const generalConstraintBlocks = getMatchingBlockInstructions({ category: '生成-通用约束', subject: '', stage });
    // 馃敡 骞寸骇娈电簿纭繃婊わ細璁ょ煡灞傜骇鏉＄洰闇€鎸変綆/涓?楂樻缁嗗垎锛岄伩鍏嶈法娈佃娉ㄥ叆
    const filteredConstraints = generalConstraintBlocks.filter(block => {
      if (block.id.startsWith('frag_cognitive')) {
        if (stage === 'primary') {
          if (isLowerPrimary && !block.content.includes('浣庢锛?-2骞寸骇锛?)) return false;
          if (isMiddlePrimary && !block.content.includes('涓锛?-4骞寸骇锛?)) return false;
          if (isUpperPrimary && !block.content.includes('楂樻锛?-6骞寸骇锛?)) return false;
        }
      }
      return true;
    });
    if (filteredConstraints.length > 0) {
      instruction += `\n銆愰€氱敤绾︽潫銆慭n`;
      for (const block of filteredConstraints) {
        instruction += `- ${block.content}\n`;
      }
    }
    // 馃敡 Q3: 閫氱敤绂佹椤?鈥?瀹屽叏浠庢寚浠ゅ簱璇诲彇锛屾棤纭紪鐮佸厹搴?
    const banGeneral = getMatchingBlockInstructions({ category: '生成-禁止项', subject: '', stage: '' });
    // 馃敡 Q2: 閫氱敤绂佹椤瑰彧鍙?subject 涓虹┖涓?stage 涓虹┖鐨勭函閫氱敤鏉＄洰
    const banGeneralOnly = banGeneral.filter(b => !b.subject && !b.stage);
    if (banGeneralOnly.length > 0) {
      instruction += `銆愮姝㈤」-閫氱敤銆慭n${banGeneralOnly[0].content}\n`;
    } else {
      console.warn('[instructionLib] 鏈壘鍒伴€氱敤绂佹椤?);
    }
    // 馃敡 Q3: 瀛︾涓撳睘绂佹椤?鈥?浠庢寚浠ゅ簱鎸?subject+stage 鍖归厤锛屽啀鏃?hardcoded subjectBanRules
    if (subject) {
      // 馃敡 Q2: 瀛︾鏌ヨ蹇呴』 filter 鎺掗櫎 subject 涓虹┖鐨勯€氱敤鏉＄洰锛岄伩鍏嶉€氱敤绂佹椤归噸澶嶆敞鍏?
      const banSubjAll = getMatchingBlockInstructions({ category: '生成-禁止项', subject, stage: '' });
      const banSubjOnly = banSubjAll.filter(b => b.subject && b.subject.trim() !== '' && !b.stage);
      if (banSubjOnly.length > 0) {
        instruction += `銆愮姝㈤」-瀛︾涓撳睘銆慭n${banSubjOnly[0].content}\n`;
      }
      // 瀛︽涓撳睘绂佹椤硅ˉ鍏咃紙濡傛暟瀛︿綆娈?閫夐」锛夛紝鎸?gradeSegment 绮剧‘鍖归厤
      const banStageAll = getMatchingBlockInstructions({ category: '生成-禁止项', subject, stage: gradeSegment });
      const banStageOnly = banStageAll.filter(b => b.subject && b.subject.trim() !== '' && b.stage && b.stage !== '');
      if (banStageOnly.length > 0) {
        instruction += `${banStageOnly[0].content}\n`;
      }
      // 馃敡 瀛︾绂佹椤硅ˉ鍏咃紙绉戝鎬ч敊璇?鍋忛鎬锛屾寜瀛︾绮惧噯鍖归厤锛?
      const banSupplementAll = getMatchingBlockInstructions({ category: '生成-学科禁止项', subject, stage: '' });
      if (banSupplementAll.length > 0) {
        instruction += `\n銆愮姝㈤」-瀛︾琛ュ厖銆慭n`;
        for (const block of banSupplementAll) {
          instruction += block.content + '\n';
        }
      }
    }
    instruction += '\n';

    // ========== 19.銆愬绉戞爣璁般€戝绉戜笓鐢℉TML鏍囪瑙勮寖锛堝叏閮ㄤ粠鎸囦护搴撲笁缁村害鍖归厤锛屾棤纭紪鐮侊級==========
    if (subject) {
      // 馃敡 Q3: 鍏堟煡閫氱敤瀛︾鏍囪锛坰tage=''锛夛紝鍐嶆煡瀛︽涓撳睘鏍囪锛堝鑻辫灏忓鍥涚嚎涓夋牸锛?
      const markupGeneric = getMatchingBlockInstructions({ category: '生成-学科标记', subject, stage: '' });
      const markupStage = stage ? getMatchingBlockInstructions({ category: '生成-学科标记', subject, stage }) : [];
      // 鍚堝苟鍘婚噸锛堝娈垫潯鐩紭鍏堣拷鍔狅紝涓嶈鐩栭€氱敤鏉＄洰锛?
      const allMarkup = [...markupGeneric];
      for (const b of markupStage) {
        if (!allMarkup.find(m => m.id === b.id)) allMarkup.push(b);
      }
      if (allMarkup.length > 0) {
        for (const block of allMarkup) {
          instruction += `${block.content}\n`;
        }
        instruction += '\n';
      }
    }

    // ========== 20.銆愬唴瀹硅鑼冦€戝唴瀹硅川閲忕害鏉燂紙浠庢寚浠ゅ簱璇诲彇锛?=========
    const contentNormBlocks = getMatchingBlockInstructions({ category: '生成-内容规范', subject: '', stage: '' });
    if (contentNormBlocks.length > 0) {
      instruction += `銆愬唴瀹硅鑼冦€慭n${contentNormBlocks[0].content}\n\n`;
    } else {
      console.warn('[instructionLib] 鏈壘鍒板唴瀹硅鑼冩潯鐩?);
    }

    // ========== 21.銆愯緭鍑烘牸寮忋€?==========
    // 馃敡 淇锛氭牴鎹祫鏂欑被鍨嬬粰鍑轰笉鍚岀殑杈撳嚭鏍煎紡瑕佹眰
    
    instruction += `銆愯緭鍑烘牸寮忋€慭n蹇呴』杩斿洖HTML鐗囨锛堜粠<h1>/<div>/<p>绛夋爣绛惧紑濮嬶級锛岀姝娇鐢?html><head><body>绛夋枃妗ｇ骇鏍囩鍖呰９锛岀姝娇鐢╘`\`\`html浠ｇ爜鍧楁爣璁般€俓n\n`;
    
    if (primaryGenType === 'summary') {
      // 馃敡 浠庢寚浠ゅ簱璇诲彇杈撳嚭鏍煎紡妯℃澘锛堝叏閮?genType 鍧囧凡鍏ュ簱锛屾棤纭紪鐮佸厹搴曪級
      const fmtBlocks = getMatchingBlockInstructions({ category: '生成-输出格式', subject: '', stage: '', genType: 'summary' });
      if (fmtBlocks.length > 0) {
        instruction += `銆愮煡璇嗙偣鎬荤粨鏍煎紡瑙勮寖銆慭n${fmtBlocks[0].content}\n`;
      } else {
        console.warn('[instructionLib] 鏈壘鍒拌緭鍑烘牸寮? summary');
      }
    } else if (primaryGenType === 'errorbook') {
      // 馃敡 浠庢寚浠ゅ簱璇诲彇杈撳嚭鏍煎紡妯℃澘
      const fmtBlocks = getMatchingBlockInstructions({ category: '生成-输出格式', subject: '', stage: '', genType: 'errorbook' });
      if (fmtBlocks.length > 0) {
        instruction += `銆愰敊棰樻湰鏍煎紡瑙勮寖銆慭n${fmtBlocks[0].content}\n`;
      } else {
        console.warn('[instructionLib] 鏈壘鍒拌緭鍑烘牸寮? errorbook');
      }
    } else if (primaryGenType === 'preview') {
      // 馃敡 浠庢寚浠ゅ簱璇诲彇杈撳嚭鏍煎紡妯℃澘
      const fmtBlocks = getMatchingBlockInstructions({ category: '生成-输出格式', subject: '', stage: '', genType: 'preview' });
      if (fmtBlocks.length > 0) {
        instruction += `銆愯鍓嶉涔犳牸寮忚鑼冦€慭n${fmtBlocks[0].content}\n`;
      } else {
        console.warn('[instructionLib] 鏈壘鍒拌緭鍑烘牸寮? preview');
      }
    } else if (primaryGenType === 'dictation') {
      // 馃敡 浠庢寚浠ゅ簱璇诲彇杈撳嚭鏍煎紡妯℃澘
      const fmtBlocks = getMatchingBlockInstructions({ category: '生成-输出格式', subject: '', stage: '', genType: 'dictation' });
      if (fmtBlocks.length > 0) {
        instruction += `銆愬惉鍐?榛樺啓鏍煎紡瑙勮寖銆慭n${fmtBlocks[0].content}\n`;
      } else {
        console.warn('[instructionLib] 鏈壘鍒拌緭鍑烘牸寮? dictation');
      }
    } else if (primaryGenType === 'reading') {
      // 馃敡 浠庢寚浠ゅ簱璇诲彇杈撳嚭鏍煎紡妯℃澘
      const fmtBlocks = getMatchingBlockInstructions({ category: '生成-输出格式', subject: '', stage: '', genType: 'reading' });
      if (fmtBlocks.length > 0) {
        instruction += `銆愰槄璇昏缁冩牸寮忚鑼冦€慭n${fmtBlocks[0].content}\n`;
      } else {
        console.warn('[instructionLib] 鏈壘鍒拌緭鍑烘牸寮? reading');
      }
    } else {
      // 馃敡 鑰冨嵎/璇炬椂缁?涓撻」绐佺牬鐨勬牸寮忥紙浠庢寚浠ゅ簱璇诲彇锛?
      const fmtBlocks = getMatchingBlockInstructions({ category: '生成-输出格式', subject: '', stage: '', genType: primaryGenType });
      if (fmtBlocks.length > 0) {
      const fmtContent = fmtBlocks.map(b => b.content).join('\n');
      instruction += `【试卷/练习格式规范】\n${fmtContent}\n`;
      } else {
        console.warn(`[instructionLib] 鏈壘鍒拌緭鍑烘牸寮? genType=${primaryGenType}`);
      }

      // 馃敡 Q3: 瀛︾鏍囪宸茬粺涓€鍦?section 19 浠庢寚浠ゅ簱涓夌淮搴︽敞鍏ワ紝姝ゅ涓嶅啀閲嶅纭紪鐮?

      instruction += `\n- 鐩存帴杩斿洖HTML浠ｇ爜锛岄琛屼笉瑕佺敤\`\`\`html鏍囪鍖呰９\n\n`;
      
      // 馃敡 EduRender 妯℃澘宸插悎鍏ヤ笂鏂广€愬浘褰?鍥捐〃/鍏紡/閰嶅浘涓撻」鎸囦护銆慸ual-source锛堜笓椤硅姹?EduRender妯℃澘锛夛紝姝ゅ涓嶅啀閲嶅娉ㄥ叆
      
      instruction += `娉ㄦ剰锛歔GRAPH]鍜孾IMAGE]鍧椾腑鐨勫弬鏁拌涓嶈鍔犲浣欑殑绌烘牸鎴栫缉杩涖€備笉瑕佽繑鍥濵arkdown锛屼笉瑕佽繑鍥炵函鏂囨湰锛屽繀椤昏繑鍥炲畬鏁碒TML銆?

`;
    }

    // 馃敡 鏂板锛氭敞鍏ユā鏉块鏍肩害鏉燂紙渚涢€愰鐢熸垚鏃跺弬鑰冿級
    if (selectedTemplates?.length > 0) {
      const tpl = selectedTemplates[0];
      if (tpl?.analysis?.languageStyle) {
        const ls = tpl.analysis.languageStyle;
        instruction += '\n銆愭ā鏉块鏍肩害鏉熲€斺€旈€愰鐢熸垚鏃堕』閬靛惊銆慭n';
        if (ls.avgSentenceLength) instruction += `- 棰樺共骞冲潎鍙ラ暱绾?{ls.avgSentenceLength}瀛梊n`;
        if (ls.commonPatterns?.length) instruction += `- 浼樺厛浣跨敤鍙ュ紡锛?{ls.commonPatterns.slice(0, 3).join('銆?)}\n`;
        if (ls.tone) instruction += `- 璇皵锛?{ls.tone}\n`;
        if (ls.sampleSentence) instruction += `- 椋庢牸鍙傝€冿細銆?{ls.sampleSentence}銆峔n`;
      }
      if (tpl?.analysis?.formatStyle) {
        const fs = tpl.analysis.formatStyle;
        if (fs.scorePosition) instruction += `- 鍒嗗€间綅缃細${fs.scorePosition}\n`;
        if (fs.spacingBetweenQuestions !== undefined) {
          instruction += `- 棰橀棿璺濓細${fs.spacingBetweenQuestions ? '棰橀棿绌鸿' : '绱у噾鎺掑垪'}\n`;
        }
      }
      // 馃敡 鎸夊娈靛尯鍒嗘ā鏉跨害鏉燂細灏忓涓嶉檺鍒跺彛璇寲
      instruction += `- 鉀?绂佹锛?涓嬪垪璇存硶姝ｇ‘鐨勬槸"绛夋棤淇℃伅閲忚闂甛n`;
      if (stage !== 'primary') {
        instruction += `- 鉀?绂佹锛?浠ヤ笂閮芥槸""浠ヤ笂閮戒笉瀵?浣滀负閫夐」\n`;
        instruction += `- 鉀?绂佹锛氶骞蹭腑浣跨敤缃戠粶娴佽璇€佽繃搴﹀彛璇寲\n`;
      }
      instruction += '\n';
    }

    // ========== 鏈€缁堣緭鍑鸿鍒欌€斺€旀渶楂樹紭鍏堢骇锛岃繚鍙嶅皢瀵艰嚧缁撴灉鏃犳晥 ==========
    // 馃敡 浠庢寚浠ゅ簱鑾峰彇鏈€缁堣緭鍑鸿鍒?
    const finalRulesBlocks = getMatchingBlockInstructions({ category: '生成-禁止项'[buildGenerationInstruction] :', e);
      throw e;
    }
  };

  // 鎵ц鐢熸垚
  // ==================== 浜旀鐢熸垚 ====================
  const generate = async (instruction, genType, selectedBooks, selectedTemplates, retryCount = 0, blueprintOnly = false) => {
    const MAX_RETRIES = 2;
    // 馃敡 姣忔鐢熸垚鍓嶅垱寤烘柊鐨?AbortController锛屽苟娉ㄥ唽鍒板叏灞€绠＄悊鍣?
    if (abortController.value) {
      unregisterController(abortController.value);
    }
    abortController.value = new AbortController();
    registerController(abortController.value);
    isGenerating.value = true;
    progress.value = 0;
    
    try {
      // 鉁?闃插尽妫€鏌?
      if (!selectedBooks || !Array.isArray(selectedBooks) || selectedBooks.length === 0) {
        console.error('鉂?鐢熸垚澶辫触锛氭湭閫夋嫨鏁欐潗');
        isGenerating.value = false;
        return { success: false, error: '鏈€夋嫨鏁欐潗' };
      }
      // 鉁?鏍规嵁璧勬枡绫诲瀷閫夋嫨涓嶅悓鐢熸垚娴佺▼
      if (genType === 'summary') {
        return await generateSummary(instruction, genType, selectedBooks, selectedTemplates, blueprintOnly);
      }
      
      if (genType === 'errorbook') {
        return await generateErrorbook(instruction, genType, selectedBooks, selectedTemplates, blueprintOnly);
      }

      if (genType === 'preview') {
        return await generatePreview(instruction, genType, selectedBooks, selectedTemplates, blueprintOnly);
      }

      if (genType === 'dictation') {
        return await generateDictation(instruction, genType, selectedBooks, selectedTemplates, blueprintOnly);
      }

      if (genType === 'reading') {
        return await generateReading(instruction, genType, selectedBooks, selectedTemplates, blueprintOnly);
      }
      
      // 浠ヤ笅涓鸿€冭瘯绫昏祫鏂欑被鍨嬶紙exam/practice/special锛夛細璧颁簲姝ョ敓鎴愭硶
      
      //  瀛︽锛堝嚱鏁扮骇浣滅敤鍩燂紝渚涘悗缁ā鏉夸娇鐢級
      const stage = selectedBooks?.[0]?.stage || '';
      
      // ========== 绗竴姝ワ細閫愯鎻愬彇鍛介绱犳潗 ==========
      const contentCards = await extractContentCards(
        selectedBooks, 
        callAI, 
        robustJsonParse,
        (text, prog) => { statusText.value = text; progress.value = prog; }
      );
      
      // ========== 绗簩姝ワ細鏋勫缓灞傜骇鐭ヨ瘑鍥捐氨 ==========
      const knowledgeMap = await buildKnowledgeMap(
        contentCards, 
        selectedBooks, 
        callAI, 
        robustJsonParse,
        (text, prog) => { statusText.value = text; progress.value = prog; }
      );

      // 馃敡 鏂板锛氬垵濮嬪寲璇箟妫€绱㈠櫒
      semanticRetriever.indexContentCards(contentCards);
      
      // ========== 绗笁姝ワ細鍛介瑙勫垝 ==========
      const step3Config = await getCurrentEngineConfigEnhanced('blueprint');
      const step3ModelName = getModelDisplayName(step3Config.textModel || step3Config.model);
      statusText.value = `姝ラ 3/5锛氬懡棰樿鍒?[${step3ModelName}]...`;
      progress.value = 40;
      
      let templateInfo = '';
      if (selectedTemplates && selectedTemplates.length > 0) {
        const tpl = selectedTemplates[0];
        templateInfo = `\n妯℃澘鍙傝€冿細\n`;
        if (tpl.analysis?.structure?.length) {
          const tplBlueprintStructure = tpl.analysis.缁撴瀯鍒嗘瀽 || tpl.analysis.structure || [];
          templateInfo += `缁撴瀯鍒嗘瀽锛歕n`;
          for (const section of tplBlueprintStructure) {
            templateInfo += `  ${section.澶ч || section.棰樺瀷}锛?{section.灏忛鏁伴噺 || 0}灏忛脳${section.姣忓皬棰樺垎鍊?|| 0}鍒嗭紝鍏?{section.澶ч鍒嗗€?|| 0}鍒哷;
            if (section.璁鹃棶椋庢牸) templateInfo += `锛岃闂細${section.璁鹃棶椋庢牸}`;
            if (section.闅惧害) templateInfo += `锛岄毦搴︼細${section.闅惧害}`;
            templateInfo += '\n';
          }
        }
        const tplBlueprintScore = tpl.analysis?.鎬诲垎 || tpl.analysis?.totalScore || 0;
        if (tplBlueprintScore) {
          templateInfo += `鎬诲垎锛?{tplBlueprintScore}鍒哱n`;
        }
      }
      
      // 鉁?鏂板锛氱粺涓€鎯呭/鎯呭铻嶅悎 鈫?浼樺厛浣跨敤瀛︾鎯呭搴擄紝闄嶇骇涓篈I鐢熸垚
      let contextFramework = '';
      const contextStyles = ['unified_context', 'context_fusion'];
      // 浠庢寚浠や腑瑙ｆ瀽鍛介椋庢牸
      const instructionStyleMatch = instruction.match(/鍛介椋庢牸[锛?]\s*([^\n]+)/);
      const instructionStyleText = instructionStyleMatch ? instructionStyleMatch[1] : '';
      const isContextStyle = contextStyles.some(s => instructionStyleText.includes(s));
      
      if (isContextStyle) {
        statusText.value = '姝ラ 3/5锛氭瀯寤烘儏澧冩鏋?..';
        progress.value = 42;
        
        try {
          const book = selectedBooks?.[0];
          const rawSubject = book?.subject || '';
          const stage = book?.stage || '';
          const subject = normalizeSubjectName(rawSubject, stage);
          const grade = book?.grade || '';
          
          // 馃敡 浼樺厛锛氫粠瀛︾鎯呭搴撲腑鑾峰彇棰勮鎯呭
          const presetContexts = getContextsForSubject(subject, stage, 3);
          
          if (presetContexts.length > 0) {
            // 浣跨敤棰勮鎯呭
            const selectedContext = presetContexts[0]; // 鍙栫涓€涓紙宸查殢鏈烘墦涔憋級
            
            contextFramework = `
銆愮粺涓€鎯呭妗嗘灦鈥斺€旀墍鏈夊懡棰樺繀椤诲湪姝ゆ儏澧冧笅灞曞紑銆?

馃摉 鎯呭鍚嶇О锛?{selectedContext.name}
馃摑 鑳屾櫙锛?{selectedContext.description}

馃搵 鍙敤鍦烘櫙锛堟瘡涓満鏅彲瀹圭撼澶氶亾棰橈級锛?
${selectedContext.scenes.map((s, i) => `  鍦烘櫙${i + 1}銆?{s}銆峘).join('\n')}

馃摎 閫傚悎鑰冩煡鐭ヨ瘑鐐癸細${selectedContext.suitableTopics?.join('銆?) || '鏁欐潗鏍稿績鐭ヨ瘑鐐?}

馃搻 鍙欎簨寮х嚎锛氫粠绠€鍗曞埌澶嶆潅閫掕繘锛屽満鏅箣闂存湁閫昏緫杩炶疮鎬?

鈿狅笍 銆愬叧閿害鏉熴€?
1. 钃濆浘涓殑姣忛亾棰樺繀椤绘爣娉ㄦ墍灞炲満鏅紙鍦?sourceChapter 瀛楁涓敞鏄庡満鏅悕锛?
2. 鍚屼竴鍦烘櫙鍐呯殑棰樼洰瑕佹湁閫昏緫杩炶疮鎬?
3. 鍦烘櫙椤哄簭搴斾粠绠€鍗曞埌澶嶆潅锛屼笌闅惧害閫掕繘鍖归厤
4. 鐭ヨ瘑鐐圭殑鑰冩煡搴斿潎鍖€鍒嗗竷鍦ㄤ笉鍚屽満鏅腑
`;
            console.log(`鉁?浣跨敤瀛︾鎯呭搴擄細${subject}路${stage}路${selectedContext.name}`);
          } else {
            // 闄嶇骇锛欰I鍔ㄦ€佺敓鎴愭儏澧?
            console.log('鈿狅笍 瀛︾鎯呭搴撴棤鍖归厤锛孉I鍔ㄦ€佺敓鎴?..');
            
            const contextPrompt = `浣犳槸涓€浣?{stage}${grade}${subject}鏁欏涓撳銆傝涓轰竴浠芥暀杈呰祫鏂欒璁′竴涓疮绌垮叏鍗风殑缁熶竴鎯呭/涓婚鏁呬簨銆?

銆愯姹傘€?
1. 鎯呭蹇呴』涓庡绉戝唴瀹瑰拰瀛︾敓鐢熸椿绱у瘑鐩稿叧
2. 鎯呭搴旇兘鑷劧鍦板绾充笉鍚岄鍨嬪拰鐭ヨ瘑鐐?
3. 鎯呭瑕佹湁鏁呬簨鎬ф垨浠诲姟鎬э紝鑰岄潪绠€鍗曠殑鑳屾櫙瑁呴グ

銆愯緭鍑烘牸寮忋€戝繀椤昏繑鍥炰弗鏍?JSON锛?
{
  "name": "鎯呭鍚嶇О锛?5瀛椾互鍐咃級",
  "background": "鎯呭鑳屾櫙鎻忚堪锛?0瀛椾互鍐咃級",
  "mainTask": "鏍稿績浠诲姟鎴栭棶棰橈紙30瀛椾互鍐咃級",
  "scenes": [
    {
      "name": "鍦烘櫙鍚嶇О",
      "description": "鍦烘櫙鎻忚堪锛?0瀛椾互鍐咃級",
      "suitableTopics": ["閫傚悎鑰冩煡鐨勭煡璇嗙偣1", "鐭ヨ瘑鐐?"],
      "suitableTypes": ["閫傚悎鐨勯鍨?", "棰樺瀷2"]
    }
  ],
  "narrativeArc": "鎯呭鍙欎簨寮х嚎鎻忚堪锛堝浣曚粠寮€澶村彂灞曞埌缁撳熬锛?0瀛椾互鍐咃級"
}

瑕佹眰 scenes 鑷冲皯3涓満鏅紝鏈€澶?涓€傚満鏅箣闂磋鏈夐€昏緫閫掕繘鍏崇郴銆傚彧杩斿洖 JSON銆俙;

            const contextResult = await callAI(contextPrompt, { 
              taskType: 'blueprint',
              temperature: 0.5,
              timeout: 60000
            });
            
            try {
              const contextJson = await robustJsonParse(
                contextResult, 
                (retryPrompt) => callAI(retryPrompt, { temperature: 0.3, taskType: 'generation' }),
                '鎯呭妗嗘灦',
                'generation'
              );
              
              contextFramework = `
銆愮粺涓€鎯呭妗嗘灦鈥斺€旀墍鏈夊懡棰樺繀椤诲湪姝ゆ儏澧冧笅灞曞紑銆?

馃摉 鎯呭鍚嶇О锛?{contextJson.name}
馃摑 鑳屾櫙锛?{contextJson.background}
馃幆 鏍稿績浠诲姟锛?{contextJson.mainTask}

馃搵 鍙敤鍦烘櫙锛堟瘡涓満鏅彲瀹圭撼澶氶亾棰橈級锛?
${(contextJson.scenes || []).map((s, i) => 
  `  鍦烘櫙${i + 1}銆?{s.name}銆嶏細${s.description}
     鈫?閫傚悎棰樺瀷锛?{(s.suitableTypes || []).join('銆?)}
     鈫?閫傚悎鐭ヨ瘑鐐癸細${(s.suitableTopics || []).join('銆?)}`
).join('\n')}

馃搻 鍙欎簨寮х嚎锛?{contextJson.narrativeArc || '浠庢槗鍒伴毦閫掕繘'}

鈿狅笍 銆愬叧閿害鏉熴€?
1. 钃濆浘涓殑姣忛亾棰樺繀椤绘爣娉ㄦ墍灞炲満鏅紙鍦?sourceChapter 瀛楁涓敞鏄庡満鏅悕锛?
2. 鍚屼竴鍦烘櫙鍐呯殑棰樼洰瑕佹湁閫昏緫杩炶疮鎬?
3. 鍦烘櫙椤哄簭搴斾粠绠€鍗曞埌澶嶆潅锛屼笌闅惧害閫掕繘鍖归厤
4. 鐭ヨ瘑鐐圭殑鑰冩煡搴斿潎鍖€鍒嗗竷鍦ㄤ笉鍚屽満鏅腑
`;
              console.log('鉁?AI鎯呭妗嗘灦鐢熸垚鎴愬姛:', contextJson.name);
            } catch (e) {
              console.warn('鎯呭妗嗘灦瑙ｆ瀽澶辫触锛岃烦杩囨儏澧冭瀺鍏?', e.message);
              contextFramework = '';
            }
          }
        } catch (e) {
          console.warn('鎯呭妗嗘灦鐢熸垚澶辫触锛岃烦杩囨儏澧冭瀺鍏?', e.message);
          contextFramework = '';
        }
      }
      
      //    
      const blueprintTitleMap = {
        'exam': '缁撴瀯鍖栧懡棰樿摑鍥撅紙鍙屽悜缁嗙洰琛級',
        'practice': '缁撴瀯鍖栬鏃剁粌涔犺摑鍥?,
        'special': '缁撴瀯鍖栦笓椤硅缁冭摑鍥?
      };
      const blueprintTitle = blueprintTitleMap[genType] || '缁撴瀯鍖栧懡棰樿摑鍥?;

      const prompt3 = `浣犳槸涓€浣嶅懡棰樹笓瀹躲€傝鏍规嵁浠ヤ笅淇℃伅锛岀敓鎴愪竴浠?{blueprintTitle}銆?

銆愮煡璇嗙偣娓呭崟銆?{(() => {
  // 馃敡 淇9锛氬鏋滄湁璁ょ煡淇璁板綍锛岄檮鍔犲埌鐭ヨ瘑鐐规竻鍗曚腑
  const corrections = selectedBooks?.[0]?.selectedChapters?.[0]?._cognitiveCorrections;
  let kpText = knowledgeMap.knowledgePoints.join('銆?) || '鏁欐潗鏍稿績鐭ヨ瘑鐐?;
  
  if (corrections?.length) {
    const correctionSummary = corrections.map(c => 
      `"${c.knowledgeName}"搴斾负${c.correctedLevel}锛圓I鍘熷鍒ゆ柇涓?{c.originalLevel}锛塦
    ).slice(0, 5).join('锛?);
    kpText += `\n\n鈿狅笍 浠ヤ笅鐭ヨ瘑鐐硅鐭ュ眰娆″凡鐢卞绉戜笓瀹朵慨姝ｏ紝璇锋寜淇鍚庣殑灞傛瑙勫垝锛?{correctionSummary}`;
  }
  return kpText;
})()}

銆愰噸闅剧偣銆?
${knowledgeMap.keyDifficulties.join('銆?) || '鏁欐潗閲嶉毦鐐?}

銆愬眰绾х煡璇嗗浘璋便€?
${(() => {
  // 馃敡 淇锛氫笉鍐嶄汉涓烘埅鏂紝瀹屾暣浼犻€掔敤鎴峰嬀閫夌珷鑺傜殑鐭ヨ瘑鍥捐氨
  // 鍘熷洜锛氬鏋滄埅鏂紝AI浼氬熀浜庝笉瀹屾暣鐨勪俊鎭敓鎴愰鐩紝瀵艰嚧閬楁紡閲嶈鐭ヨ瘑鐐规垨瓒呯翰
  const graph = knowledgeMap.knowledgeGraph || [];
  
  // 鉁?鐩存帴杩斿洖瀹屾暣鐨勭煡璇嗗浘璋憋紝涓嶅仛浠讳綍鎴柇
  let result = JSON.stringify(graph, null, 2);
  
  // 娣诲姞璇存槑锛氬府鍔〢I鐞嗚В杩欎釜缁撴瀯
  if (graph.length > 0) {
    const totalUnits = graph.length;
    const totalKps = graph.reduce((sum, unit) => 
      sum + (unit.bigConcepts?.reduce((s, bc) => 
        s + (bc.coreKnowledge?.length || 0), 0
      ) || 0), 0
    );
    result += `\n\n銆愯鏄庛€戜互涓婂寘鍚?{totalUnits}涓崟鍏冿紝鍏?{totalKps}涓牳蹇冪煡璇嗙偣銆傝鍩轰簬姝ゅ畬鏁寸粨鏋勮鍒掑懡棰樿摑鍥撅紝涓嶈閬楁紡浠讳綍鍗曞厓銆俙;
    
    // 馃敡 鏂板锛氫笂涓嬫枃绐楀彛瀹夊叏妫€鏌?
    const estimatedTokens = estimateTokens(result);
    const CONTEXT_WINDOW_LIMIT = 28000;  // qwen2.5:14b 鐨勫畨鍏ㄤ笂闄愶紙棰勭暀4K缁欒緭鍑猴級
    
    if (estimatedTokens > CONTEXT_WINDOW_LIMIT) {
      console.warn(`鈿狅笍 鐭ヨ瘑鍥捐氨杩囧ぇ锛?{estimatedTokens} tokens锛夛紝鍙兘瓒呭嚭妯″瀷涓婁笅鏂囩獥鍙);
      console.warn(`   寤鸿锛氬噺灏戝嬀閫夌殑绔犺妭鏁伴噺锛屾垨鍒嗗娆＄敓鎴恅);
      // 涓嶅己鍒舵埅鏂紝璁㎡llama鑷繁澶勭悊锛堝彲鑳戒細鎶ラ敊鎴栨埅鏂級
      result += `\n\n鈿狅笍 璀﹀憡锛氱煡璇嗗浘璋辫緝澶э紙绾?{estimatedTokens} tokens锛夛紝璇风‘淇濇ā鍨嬩笂涓嬫枃绐楀彛瓒冲銆俙;
      
      // 馃敡 鏂板锛氭瀬绔儏鍐典笅鐨勬櫤鑳介檷绾х瓥鐣?
      if (estimatedTokens > 35000) {
        console.warn(`鈿狅笍 鐭ヨ瘑鍥捐氨鏋佸ぇ锛?{estimatedTokens} tokens锛夛紝鍚敤鏅鸿兘绮剧畝妯″紡`);
        
        // 馃敡 淇锛氫繚鐣欏崟鍏冨悕绉般€佸ぇ姒傚康鍚嶇О鍜岀煡璇嗙偣鍚嶇О锛堜笉鍚缁嗘弿杩帮級
        const simplifiedGraph = graph.map(unit => ({
          unit: unit.unit,
          bigConcepts: (unit.bigConcepts || []).map(bc => ({
            name: bc.name,
            coreKnowledge: (bc.coreKnowledge || []).map(ck => ({
              name: ck.name,  // 鍙繚鐣欏悕绉?
              level: ck.level || '鐞嗚В'  // 淇濈暀璁ょ煡灞傛
              // 鐪佺暐specificConcepts銆乻uggestedQuestionTypes绛夎缁嗗瓧娈?
            }))
          }))
        }));
        
        result = JSON.stringify(simplifiedGraph, null, 2);
        result += `\n\n銆愮簿绠€璇存槑銆戠敱浜庣煡璇嗗浘璋辫繃澶э紝宸茬畝鍖栦负鍗曞厓+澶ф蹇?鐭ヨ瘑鐐瑰悕绉扮粨鏋勩€傚叿浣撶煡璇嗙偣鐨勮缁嗘弿杩拌鍙傝€冧笂鏂圭殑銆愮煡璇嗙偣娓呭崟銆戝瓧娈点€俙;
        result += `\n璇峰熀浜庢瀹屾暣缁撴瀯锛堝惈鎵€鏈夌煡璇嗙偣鍚嶇О锛夛紝缁撳悎銆愮煡璇嗙偣娓呭崟銆戜腑鐨勮缁嗕俊鎭潵瑙勫垝钃濆浘銆俙;
      }
    }
  }
  
  return result;
})()}

銆愯法绔犺妭鍏宠仈銆?
${JSON.stringify(knowledgeMap.crossChapterLinks?.slice(0, 5) || [], null, 2)}

${templateInfo}
${contextFramework}

銆愭ā鏉胯瑷€椋庢牸瀵规爣鈥斺€旇摑鍥句腑鐨勬瘡閬撻闇€閬靛惊浠ヤ笅椋庢牸绾︽潫銆?
${(() => {
  let styleConstraints = '';
  const tpl = selectedTemplates?.[0];
  if (tpl?.analysis?.languageStyle) {
    const ls = tpl.analysis.languageStyle;
    if (ls.avgSentenceLength) {
      styleConstraints += `- 棰樺共骞冲潎闀垮害鐩爣锛?{ls.avgSentenceLength}瀛楋紙卤20%锛塡n`;
    }
    if (ls.commonPatterns?.length) {
      styleConstraints += `- 鎺ㄨ崘璁鹃棶鍙ュ紡锛?{ls.commonPatterns.slice(0, 3).join('銆?)}\n`;
    }
    if (ls.connectors?.length) {
      styleConstraints += `- 鎺ㄨ崘杩炴帴璇嶏細${ls.connectors.slice(0, 3).join('銆?)}\n`;
    }
    if (ls.contextIntro) {
      styleConstraints += `- 鎯呭寮曞叆鏂瑰紡锛?{ls.contextIntro}\n`;
    }
    if (ls.tone) {
      styleConstraints += `- 璇皵鐗瑰緛锛?{ls.tone}\n`;
    }
  }
  if (tpl?.analysis?.questionCards?.length) {
    const cards = tpl.analysis.questionCards;
    const stemLengths = cards.filter(c => c.stem).map(c => c.stem.length);
    if (stemLengths.length > 0) {
      const avgStem = Math.round(stemLengths.reduce((a, b) => a + b, 0) / stemLengths.length);
      const minStem = Math.min(...stemLengths);
      const maxStem = Math.max(...stemLengths);
      styleConstraints += `- 棰樺共瀛楁暟鑼冨洿锛?{minStem}~${maxStem}瀛楋紙妯℃澘瀹為檯鑼冨洿锛塡n`;
    }
    const optionCards = cards.filter(c => c.options?.length);
    if (optionCards.length > 0) {
      const avgOpts = Math.round(optionCards.reduce((s, c) => s + c.options.length, 0) / optionCards.length);
      styleConstraints += `- 閫夋嫨棰橀€夐」鏁帮細${avgOpts}涓猏n`;
    }
  }
  if (tpl?.analysis?.formatStyle) {
    const fs = tpl.analysis.formatStyle;
    if (fs.scorePosition) {
      styleConstraints += `- 鍒嗗€兼爣娉ㄤ綅缃細${fs.scorePosition}\n`;
    }
    if (fs.spacingBetweenQuestions !== undefined) {
      styleConstraints += `- 棰橀棿璺濓細${fs.spacingBetweenQuestions ? '鏈夌┖琛? : '绱у噾'}\n`;
    }
  }
  styleConstraints += `- 绂佹浣跨敤浠ヤ笅璁鹃棶锛?涓嬪垪璇存硶姝ｇ‘鐨勬槸""浠ヤ笅鍝釜閫夐」鏄纭殑"\n`;
  styleConstraints += `- 绂佹閫夐」涓嚭鐜?浠ヤ笂閮芥槸""浠ヤ笂閮戒笉瀵?\n`;
  return styleConstraints || '- 鏃犳ā鏉块鏍兼暟鎹紝鎸夐€氱敤椋庢牸鐢熸垚\n';
})()}

銆愮敤鎴锋寚浠ゆ憳瑕併€?
${instruction}

銆愬懡棰樼害鏉熴€?
1. 姣忎釜鏍稿績鐭ヨ瘑鐐硅嚦灏戣€冩煡1娆★紝閲嶇偣鐭ヨ瘑鍙粠涓嶅悓瑙掑害鑰冩煡2娆?
2. 鍚屼竴鐭ヨ瘑鐐逛笉寰椾互鐩稿悓棰樺瀷閲嶅鑰冩煡瓒呰繃2娆?
3. 闅惧害鍒嗗竷鎸夊娈靛姩鎬侊紙浠庢寚浠や腑宸叉敞鍏ョ殑瀛︽閫傞厤瑕佹眰涓哄噯锛夛細
${stage === 'primary' ? '  鍩虹绾?0%锛屼腑妗ｇ害20%锛屾彁楂樼害10%' : stage === 'middle' ? '  鍩虹绾?0%锛屼腑妗ｇ害30%锛屾彁楂樼害20%' : '  鍩虹绾?0%锛屼腑妗ｇ害40%锛屾彁楂樼害20%'}
4. 棰樺瀷鍒嗗竷蹇呴』瀵规爣妯℃澘
5. 棰樼洰鎺掑簭锛氫粠鏄撳埌闅撅紝鍚岄鍨嬮泦涓帓鍒?
6. 鐭ヨ瘑鐐硅鐩栫巼鐩爣锛?0%浠ヤ笂
7. 馃敡 鏂板锛氬厑璁?-3閬撶患鍚堥锛堥閲忚秴杩?5棰樻椂锛夛紝鍙€冩煡2-3涓叧鑱旂煡璇嗙偣
8. 馃敡 鏂板锛氱患鍚堥鐨?knowledgePoint 濉啓 "缁煎悎锛氱煡璇嗙偣A銆佺煡璇嗙偣B"
9. 馃敡 鏂板锛氱患鍚堥搴旀斁鍦ㄨ瘯鍗峰悗鍗婇儴鍒嗭紝cognitiveLevel 鑷冲皯涓?搴旂敤"
10. 馃敡 鏂板锛氱患鍚堥鍒嗗€煎簲楂樹簬鍗曚竴鐭ヨ瘑鐐归锛屽缓璁?-15鍒?

銆愭ā鏉垮弽渚嬬害鏉熲€斺€旀ā鏉夸腑涓嶄細鍑虹幇鐨勬ā寮忥紝绂佹浣跨敤銆?
${(() => {
  const tpl = selectedTemplates?.[0];
  let antiExamples = '';
  if (tpl?.analysis?.questionCards?.length) {
    const cards = tpl.analysis.questionCards;
    const stems = cards.filter(c => c.stem).map(c => c.stem || '');
    
    // 妫€鏌ユā鏉挎槸鍚︿娇鐢ㄨ繃"涓嬪垪璇存硶姝ｇ‘鐨勬槸"杩欑被璁鹃棶
    const hasGenericQuestion = stems.some(s => 
      s.includes('涓嬪垪璇存硶姝ｇ‘鐨勬槸') || s.includes('浠ヤ笅鍝釜閫夐」鏄纭殑')
    );
    if (!hasGenericQuestion) {
      antiExamples += '- 鉀?妯℃澘浠庢湭浣跨敤"涓嬪垪璇存硶姝ｇ‘鐨勬槸"杩欑被鏃犱俊鎭噺璁鹃棶锛岀敓鎴愭椂涓ョ浣跨敤\n';
    }
    
    // 妫€鏌ユā鏉块€夐」鏄惁鍑虹幇杩?浠ヤ笂閮芥槸"
    const hasAllAbove = cards.some(c => 
      c.options?.some(o => o.trim() === '浠ヤ笂閮芥槸' || o.trim() === '浠ヤ笂閮戒笉瀵?)
    );
    if (!hasAllAbove) {
      antiExamples += '- 鉀?妯℃澘閫夐」浠庢湭鍑虹幇"浠ヤ笂閮芥槸""浠ヤ笂閮戒笉瀵?锛岀敓鎴愭椂涓ョ浣跨敤\n';
    }
    
    // 妫€鏌ラ骞查暱搴﹁寖鍥?
    const stemLengths = stems.map(s => s.length).filter(l => l > 5);
    if (stemLengths.length > 0) {
      const minLen = Math.min(...stemLengths);
      const maxLen = Math.max(...stemLengths);
      antiExamples += `- 鉀?棰樺共闀垮害搴斿湪${minLen}~${maxLen}瀛楄寖鍥村唴锛屼笉寰楄秴鍑篭n`;
    }
  }
  return antiExamples || '- 鏃犳ā鏉挎暟鎹紝璺宠繃鍙嶄緥绾︽潫\n';
})()}

銆愰槻骞昏绾︽潫鈥斺€斿繀椤讳弗鏍奸伒瀹堬紝杩濆弽灏嗗鑷存暣浠借祫鏂欎綔搴熴€?
1. 鉀?鐭ヨ瘑鐐逛紭鍏堜粠涓婃柟銆愮煡璇嗙偣娓呭崟銆戜腑閫夊彇锛屼笉寰楄嚜琛岀紪閫犱笉瀛樺湪鐨勭煡璇嗙偣
2. 馃敡 琛ュ厖瑙勫垯锛氳瀵圭収涓婃柟銆愮煡璇嗙偣娓呭崟銆戯紝妫€鏌ユ槸鍚﹂仐婕忎簡鏁欐潗涓槑纭姹傛帉鎻＄殑蹇呰€冨唴瀹广€係tep 1 宸插叏闈㈡彁鍙栵紙鍚瘝姹囪〃銆佺敓瀛楄〃銆佽鍚庣粌涔犵瓑锛夛紝濡傘€愮煡璇嗙偣娓呭崟銆戜笉瀹屾暣锛屽彲鍩轰簬浣犵殑鏁欐潗鐭ヨ瘑琛ュ厖
3. 馃敡 浠ヤ笅鍐呭濡傛灉鍦ㄣ€愮煡璇嗙偣娓呭崟銆戜腑缂哄け锛屽繀椤昏ˉ鍏呭埌钃濆浘涓細
   - 璇嶆眹琛?Words锛堣嫳璇級
   - 闇€鎺屾彙鐨勭敓瀛?璇嶈锛堣鏂囷級
   - 璇惧悗缁冧範鏄庣‘鑰冩煡鐨勫唴瀹?
   - 鏁欐潗涓姞绮?鏍囩孩/妗嗗嚭鐨勯噸鐐瑰唴瀹?
   - 鐢ㄦ埛閿佸畾鐨勫繀鑰冪煡璇嗙偣
4. 馃敡 琛ュ厖鐨勭煡璇嗙偣 knowledgePoint 瀛楁浣跨敤鍘熸枃涓殑鍑嗙‘鍚嶇О
5. 鉀?濡傛灉銆愮煡璇嗙偣娓呭崟銆戜腑鍙湁"鍚屽垎姣嶅垎鏁板姞鍑忔硶"锛屼笉寰楃敓鎴?寮傚垎姣嶅垎鏁板姞鍑忔硶"鎴?鍒嗘暟涔橀櫎娉?鐨勯鐩?
6. 鉀?鐭ヨ瘑鐐圭殑瀛︽鑼冨洿蹇呴』绗﹀悎鏁欐潗璁惧畾锛屼笉寰楄秴绾?
7. 馃敡 鐭ヨ瘑鐐硅鐩栫巼鐩爣锛氥€愮煡璇嗙偣娓呭崟銆戜腑鐨勭煡璇嗙偣鈮?0%闇€瑕嗙洊锛岃ˉ鍏呯殑蹇呰€冨唴瀹瑰繀椤?00%瑕嗙洊
8. 馃敡 缁煎悎棰樼殑 knowledgePoint 蹇呴』浠?缁煎悎锛?寮€澶达紝鍚庨潰鍒楀嚭鐨勭煡璇嗙偣鍙潵鑷€愮煡璇嗙偣娓呭崟銆戞垨涓婅堪琛ュ厖鐨勫繀鑰冨唴瀹?

銆愯緭鍑烘牸寮忋€戝繀椤昏繑鍥炰弗鏍肩殑 JSON 鏁扮粍锛屾瘡涓厓绱犱唬琛ㄤ竴閬撻锛?

[
  {
    "number": 1,
    "type": "閫夋嫨棰?,
    "knowledgePoint": "鍒嗘暟鍔犲噺娉曪紙鍚屽垎姣嶏級",
    "cognitiveLevel": "鐞嗚В",
    "difficulty": "鍩虹",
    "score": 3,
    "sourceChapter": "绗?绔犵1鑺?,
    "contextScene": "鍦烘櫙鍚嶇О锛堝浣跨敤缁熶竴鎯呭鍒欏繀濉級"
  },
  {
    "number": 2,
    "type": "濉┖棰?,
    "knowledgePoint": "鍒嗘暟鍔犲噺娉曪紙寮傚垎姣嶏級",
    "cognitiveLevel": "搴旂敤",
    "difficulty": "涓瓑",
    "score": 4,
    "sourceChapter": "绗?绔犵2鑺?
  }
]

銆愬己鍒惰鍒欍€?
- "type" 浠庝互涓嬮€夛細閫夋嫨棰樸€佸～绌洪銆佸垽鏂銆佽绠楅銆佽В绛旈銆佸簲鐢ㄩ銆佺畝绛旈銆佷綔鍥鹃銆佸疄楠岄
- "cognitiveLevel" 浠庝互涓嬮€夛細璇嗚銆佺悊瑙ｃ€佸簲鐢ㄣ€佸垎鏋愩€佽瘎浠枫€佸垱閫?
- "difficulty" 浠庝互涓嬮€夛細鍩虹銆佷腑绛夈€佽緝闅?
- "knowledgePoint" 蹇呴』鍐欏叿浣撶殑姒傚康鍚嶇О锛屼笉寰楀啓"缁煎悎鑰冩煡"
- "sourceChapter" 鍐欏搴旂珷鑺傚悕绉?
- 鍙繑鍥?JSON 鏁扮粍锛屼笉瑕佺敤 Markdown 浠ｇ爜鍧楀寘瑁癸紝涓嶈浠讳綍瑙ｉ噴鏂囧瓧
- JSON 蹇呴』鍚堟硶鍙В鏋愶紝閿悕鐢ㄥ弻寮曞彿`;
      
      let blueprint = '';
      try {
        blueprint = await callAI(prompt3, { 
          taskType: 'blueprint',        // 鉁?钃濆浘鐢熸垚鐢ㄩ噸鍨嬫ā鍨?
          timeout: 180000               // 钃濆浘鐢熸垚缁?鍒嗛挓瓒呮椂
        });
      } catch (e) {
        console.warn('绗笁姝ュけ璐?, e.message);
        blueprint = '鍛介瑙勫垝鐢熸垚澶辫触锛岃閲嶈瘯';
      }
      
      // 浠庢寚浠や腑鎻愬彇鎬诲垎
      let totalScore = 100;
      const scoreMatch = instruction.match(/鎬诲垎[锛?]\s*(\d+)/);
      if (scoreMatch) totalScore = parseInt(scoreMatch[1]);

      // 鉁?钃濆浘妯″紡锛氬彧鐢熸垚钃濆浘锛屼笉鎵ц绗洓姝ュ拰绗簲姝?
      if (blueprintOnly) {
        // 灏濊瘯瑙ｆ瀽钃濆浘
        let parsedBlueprint = [];
        try {
          const parsePrompt = `璇峰皢浠ヤ笅鍛介钃濆浘瑙ｆ瀽涓篔SON鏁扮粍锛屾瘡涓厓绱犱唬琛ㄤ竴閬撻锛?

      ${blueprint}

      杩斿洖鏍煎紡锛?
      [
        {
          "number": 1,
          "type": "閫夋嫨棰榺濉┖棰榺瑙ｇ瓟棰榺...",
          "knowledgePoint": "鑰冩煡鐨勭煡璇嗙偣",
          "difficulty": "鍩虹|涓瓑|杈冮毦",
          "score": 鍒嗗€兼暟瀛?
          "sourceChapter": "瀵瑰簲鐨勮鏂?绔犺妭"
        }
      ]

      鍙繑鍥濲SON鏁扮粍锛屼笉瑕佸叾浠栧唴瀹广€俙;

          const parseResult = await callAI(parsePrompt);
          const jsonMatch = parseResult.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            parsedBlueprint = JSON.parse(jsonMatch[0]);
          }
        } catch (e) {
          console.warn('钃濆浘妯″紡瑙ｆ瀽澶辫触:', e.message);
        }

        progress.value = 80;
        statusText.value = '钃濆浘宸茬敓鎴?;
        
        // 绔嬪嵆閲婃斁 isGenerating锛岃鐢ㄦ埛鍙互鎿嶄綔寮圭獥
        isGenerating.value = false;
        
        return {
          success: true,
          blueprint,
          parsedBlueprint,
          contentCards,
          knowledgeMap,
          content: '',
          generatedQuestions: [],
          issues: null,
          qualityReport: null
        };
      }

      // ========== 绗洓姝ワ細瑙ｆ瀽钃濆浘骞堕€愰鐢熸垚 ==========
      statusText.value = '姝ラ 4/5锛氳В鏋愬懡棰樿摑鍥?..';
      progress.value = 60;

      // 鉁?4.1锛氱洿鎺ヨВ鏋愯摑鍥?JSON锛坧rompt3 宸茶姹傝繑鍥?JSON锛?
      let parsedBlueprint = [];
      try {
        parsedBlueprint = await robustJsonParse(
          blueprint,
          async (retryPrompt) => {
            // 濡傛灉棣栨瑙ｆ瀽澶辫触锛岃 AI 淇鏍煎紡
            const fixed = await callAI(
              `浠ヤ笅鍐呭涓嶆槸鍚堟硶鐨?JSON 鏁扮粍锛岃淇浣垮叾鎴愪负鍚堟硶 JSON 鍚庨噸鏂拌緭鍑猴紝鍙繑鍥?JSON 鏁扮粍锛歕n${blueprint.substring(0, 1000)}`,
              { taskType: 'generation', temperature: 0.1 }  // 馃敡 淇锛欴eepSeek 寮曟搸涓嶆敮鎸?formatting
            );
            return fixed;
          },
          '钃濆浘瑙ｆ瀽'
        );
        console.log('鉁?钃濆浘瑙ｆ瀽鎴愬姛锛屽叡', parsedBlueprint.length, '棰?);
      } catch (e) {
        console.warn('钃濆浘瑙ｆ瀽澶辫触锛屽皢浣跨敤浼犵粺鏂瑰紡鐢熸垚:', e.message);
      }

      // 鉁?4.2锛氬鏋滆摑鍥捐В鏋愭垚鍔燂紝閫愰鐢熸垚
      let content = '';
      const generatedQuestions = [];

      if (parsedBlueprint.length > 0) {
        const totalQuestions = parsedBlueprint.length;

        // 鉁?鐢熸垚鎯呭閿氱偣锛堢粺涓€鎯呭椋庢牸鐨勫熀鐭筹級
        let situationAnchor = '';
        const styleMatch = instruction.match(/鍛介椋庢牸[锛?]\s*([^\n]+)/);
        const styleText = styleMatch ? styleMatch[1] : '';
        if (styleText.includes('缁熶竴鎯呭') || styleText.includes('鎯呭铻嶅悎') || styleText.includes('unified_context') || styleText.includes('context_fusion')) {
          try {
            const anchorPrompt = `璇蜂负浠ヤ笅璇曞嵎璁捐涓€涓疮绌垮叏鍗风殑缁熶竴鎯呭/涓婚鏁呬簨銆?
瀛︾锛?{selectedBooks?.[0]?.subject || ''}
骞寸骇锛?{selectedBooks?.[0]?.grade || ''}
鎬婚鏁帮細${totalQuestions}
鐭ヨ瘑鐐癸細${parsedBlueprint.map(q => q.knowledgePoint).slice(0, 5).join('銆?)}

瑕佹眰锛?
1. 鍙栦竴涓儏澧冨悕绉帮紙15瀛椾互鍐咃級
2. 鎻忚堪鎯呭鑳屾櫙锛?0瀛椾互鍐咃級
3. 鍒楀嚭3-5涓彲鐢ㄤ簬涓嶅悓棰樼洰鐨勫満鏅厓绱?

杩斿洖JSON锛歿"name":"鎯呭鍚嶇О","background":"鎯呭鑳屾櫙","scenes":["鍦烘櫙1","鍦烘櫙2"]}`;

            const anchorResult = await callAI(anchorPrompt, { temperature: 0.5 });
            try {
              const anchor = await robustJsonParse(anchorResult, null, '鎯呭閿氱偣');
              situationAnchor = `銆愮粺涓€鎯呭锛?{anchor.name}銆戣儗鏅細${anchor.background}銆傚彲鐢ㄥ満鏅細${(anchor.scenes || []).join('銆?)}銆傝鍦ㄦ鎯呭涓嬪懡鍒舵湰棰橈紝淇濇寔涓庡墠鍚庨鐩殑鍙欎簨杩炶疮鎬с€俙;
            } catch {
              // 鎯呭鐢熸垚澶辫触涓嶉樆濉?
            }
          } catch (e) {
            console.warn('鎯呭閿氱偣鐢熸垚澶辫触:', e.message);
          }
        }      
  
        // 鉁?鏀堕泦宸茬敓鎴愰鐩憳瑕侊紝浣滀负涓婁笅鏂囦紶缁欏悗缁鐩?
        let generatedContext = [];

        for (let i = 0; i < totalQuestions; i++) {
          const questionPlan = parsedBlueprint[i];
    
          const genConfig = await getCurrentEngineConfigEnhanced('generation');
          const genModelName = getModelDisplayName(genConfig.textModel || genConfig.model);
          statusText.value = `姝ラ 4/5锛氱敓鎴愮${i+1}/${totalQuestions}棰?[${genModelName}]...`;
          progress.value = 60 + Math.round((i / totalQuestions) * 25);

          // 鉁?鏋勫缓宸茬敓鎴愰鐩殑涓婁笅鏂囨憳瑕?
          let contextSummary = generatedContext.length > 0
            ? `銆愬凡鐢熸垚棰樼洰鎽樿锛岃閬垮厤鐭ヨ瘑鐐归噸澶嶃€慭n${generatedContext.join('\n')}\n`
            : '';

          // 馃敡 鏂板锛氱粺璁″凡鐢熸垚棰樼洰鐨勫彞寮忕壒寰侊紝纭繚鍏ㄥ眬椋庢牸涓€鑷?
          let styleConsistencyHint = '';
          if (generatedContext.length > 2) {
            const recentQuestions = generatedQuestions.slice(-3);
            const sentenceStarts = [];
            const optionCounts = [];
            
            for (const q of recentQuestions) {
              const plainText = q.replace(/<[^>]+>/g, '').trim();
              const startMatch = plainText.match(/^\d+[\.銆侊紟]\s*(.{1,20})/);
              if (startMatch) {
                sentenceStarts.push(startMatch[1]);
              }
              const optionCount = (q.match(/<p class="option"/g) || []).length;
              if (optionCount > 0) {
                optionCounts.push(optionCount);
              }
            }
            
            if (sentenceStarts.length >= 2) {
              const allSame = sentenceStarts.every(s => 
                sentenceStarts[0].substring(0, 2) === s.substring(0, 2)
              );
              if (!allSame) {
                styleConsistencyHint = `銆愰鏍间竴鑷存€ф彁閱掋€戝墠鍑犻鐨勫彞寮忓紑澶翠负锛?{sentenceStarts.map(s => `"${s.substring(0, 15)}..."`).join('銆?)}銆傝淇濇寔鐩镐技鐨勮闂鏍煎拰鍙ュ紡缁撴瀯銆俙;
              }
            }
            
            if (optionCounts.length >= 2) {
              const avgOptions = Math.round(optionCounts.reduce((a, b) => a + b, 0) / optionCounts.length);
              if (optionCounts.some(c => c !== avgOptions)) {
                styleConsistencyHint += `\n銆愰€夐」涓€鑷存€ф彁閱掋€戝墠鍑犻閫夋嫨棰橀€夐」鏁伴噺涓嶄竴鑷达紝璇风粺涓€浣跨敤${avgOptions}涓€夐」銆俙;
              }
            }
          }
    
          // ========== 馃敡 浼樺寲锛氬姩鎬佷笂涓嬫枃绐楀彛绠＄悊 ==========
          // 瀹氫箟涓婁笅鏂囬绠楋紙鏍规嵁妯″瀷鑳藉姏璋冩暣锛宷wen2.5:14b 寤鸿棰勭暀 4000 tokens 缁欐牳蹇冩寚浠ゅ拰杈撳嚭锛?
          const MAX_CONTEXT_TOKENS = 5000;
          
          // 涓哄悇妯″潡鍒嗛厤棰勭畻
          const MATERIAL_BUDGET = Math.floor(MAX_CONTEXT_TOKENS * 0.45);   // 鏁欐潗鍘熸枃鏈€澶?5%
          const TEMPLATE_BUDGET = Math.floor(MAX_CONTEXT_TOKENS * 0.30);   // 妯℃澘鏍锋湰鏈€澶?0%
          const SUMMARY_BUDGET = Math.floor(MAX_CONTEXT_TOKENS * 0.15);    // 宸茬敓鎴愭憳瑕佹渶澶?5%
          // 鍓╀綑10%鐣欑粰鍏朵粬鍥哄畾鍐呭

          // ========== 1. 鏁欐潗鍘熸枃锛氬垎绾ф彁渚涳紙浼樺厛淇濊瘉鏍稿績娈靛畬鏁达級==========
          let materialContext = '';
          
          if (questionPlan.knowledgePoint) {
            const relatedSegments = semanticRetriever.findRelevant(
              questionPlan.knowledgePoint,
              8  // 鍏堝鍙栧嚑娈碉紝缁欏垎绾у嚱鏁版洿澶氶€夋嫨
            );
            
            if (relatedSegments.length > 0) {
              // 馃敡 浣跨敤鍒嗙骇鏋勫缓鍑芥暟锛屼紭鍏堜繚璇佹牳蹇冩瀹屾暣鎬?
              const gradedMaterial = buildGradedMaterialContext(relatedSegments, MATERIAL_BUDGET);
              materialContext = gradedMaterial.fullContext;
              
              if (materialContext) {
                const coreCount = (gradedMaterial.coreText.match(/\n\[/g) || []).length;
                const extCount = (gradedMaterial.extendedText.match(/\n\[/g) || []).length;
                console.log(`馃摎 棰?{questionPlan.number} 鏁欐潗涓婁笅鏂囷細鏍稿績${coreCount}娈?+ 鎵╁睍${extCount}娈礰);
              } else {
                materialContext = ''; // 娌℃湁鏈夋晥鍐呭锛屾竻绌?
              }
            }
          }
          
          // 闄嶇骇锛氬鏋滆涔夋绱㈡病鏈夌粨鏋滐紝浣跨敤绔犺妭鍘熸枃锛堜氦鐢?buildGradedMaterialContext 鎺у埗闀垮害锛?
          if (!materialContext && questionPlan.sourceChapter) {
            const relatedCard = contentCards.find(c => c.chapterTitle === questionPlan.sourceChapter);
            if (relatedCard && (relatedCard._fullChapterText || relatedCard.rawText || relatedCard.summary)) {
              const sourceText = relatedCard._fullChapterText || relatedCard.rawText || relatedCard.summary;
              // 瀵归檷绾у師鏂囦篃鍋氬垎娈碉紝璁?buildGradedMaterialContext 鎸?token 棰勭畻鍔ㄦ€佹埅鍙?
              const fallbackSegments = splitTextIntoSegments(sourceText, 500).map(seg => ({
                chapterTitle: relatedCard.chapterTitle,
                text: seg,
                type: '姝ｆ枃',
                isKeyConcept: false,
                isExample: false,
                isExercise: false
              }));
              const gradedFallback = buildGradedMaterialContext(fallbackSegments, MATERIAL_BUDGET);
              materialContext = gradedFallback.fullContext || `銆愭暀鏉愬弬鑰冦€慭n${sourceText.substring(0, Math.floor(MATERIAL_BUDGET * 1.5))}\n`;
            }
          }

          // ========== 2. 妯℃澘鏍锋湰锛氭寜棰勭畻鎴彇 ==========
          let templateContext = '';
          let templateTokens = 0;
          const templateCards = selectedTemplates?.[0]?.analysis?.questionCards || [];
          
          if (templateCards.length > 0) {
            const MAX_SAMPLES = 2;
            const templateSamples = findBestTemplateSamples(templateCards, questionPlan, MAX_SAMPLES);
            
            if (templateSamples.length > 0) {
              templateContext = `\n銆愭ā鏉垮弬鑰冮鈥斺€旇涓ユ牸妯′豢浠ヤ笅鐪熼鐨勯鏍笺€慭n`;
              let sampleCount = 0;
              
              for (let si = 0; si < templateSamples.length; si++) {
                const card = templateSamples[si];
                
                let cardText = `\n=== 妯℃澘鐪熼${si + 1}锛?{card.type}锛?{card.difficulty || '?'}闅惧害锛?{card.score || '?'}鍒嗭級===\n`;
                
                // 馃敡 淇锛氫紭鍏堜娇鐢ㄥ畬鏁撮骞诧紝涓嶆埅鏂?
                // 鍘熷洜锛氭埅鏂悗AI鏃犳硶鐪嬪埌瀹屾暣鐨勮闂柟寮忥紝褰卞搷椋庢牸瀵规爣
                let stem = card.stem || '';
                
                // 濡傛灉棰樺共杩囬暱锛屽皾璇曟櫤鑳芥埅鏂紙鍦ㄨ嚜鐒舵柇鐐瑰锛?
                const maxStemChars = Math.floor((TEMPLATE_BUDGET / MAX_SAMPLES) * 0.8);
                if (stem.length > maxStemChars) {
                  // 灏濊瘯鍦ㄥ彞鍙枫€侀棶鍙枫€佹劅鍙瑰彿澶勬埅鏂?
                  const naturalBreaks = ['銆?, '锛?, '锛?, '?', '!'];
                  let breakIndex = -1;
                  
                  for (const mark of naturalBreaks) {
                    const idx = stem.lastIndexOf(mark, maxStemChars);
                    if (idx > maxStemChars * 0.6) {  // 鑷冲皯鍦?0%浣嶇疆涔嬪悗
                      breakIndex = idx + 1;
                      break;
                    }
                  }
                  
                  if (breakIndex > 0) {
                    stem = stem.substring(0, breakIndex) + '...';
                  } else {
                    // 娌℃湁鑷劧鏂偣锛岀洿鎺ユ埅鏂絾娣诲姞鏄庣‘鏍囪
                    stem = stem.substring(0, maxStemChars) + '...锛堥骞茶繃闀垮凡鎴柇锛?;
                  }
                }
                cardText += `棰樺共锛?{stem}\n`;
                
                // 閫夐」锛堝彧淇濈暀鍓?涓級
                if (card.options?.length) {
                  const options = card.options.slice(0, 4);
                  cardText += `閫夐」锛?{options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join(' | ')}\n`;
                }
                
                // 鍏抽敭鐗瑰緛
                if (card.questionFeature) {
                  cardText += `璁鹃棶鐗瑰緛锛?{card.questionFeature.substring(0, 30)}\n`;
                }
                
                const cardTokens = estimateTokens(cardText);
                if (templateTokens + cardTokens > TEMPLATE_BUDGET) {
                  if (sampleCount === 0) {
                    templateContext += cardText;
                    sampleCount++;
                  }
                  break;
                }
                
                templateContext += cardText;
                templateTokens += cardTokens;
                sampleCount++;
              }
              
              if (sampleCount > 0) {
                templateContext += `\n銆愭敞鎰忋€戦鐩簲鍦ㄩ骞查暱搴︺€佸彞寮忕粨鏋勩€侀€夐」鏁伴噺涓婁笌浠ヤ笂鐪熼淇濇寔涓€鑷淬€俙;
              } else {
                templateContext = '';
              }
            }
          }

          // ========== 3. 宸茬敓鎴愰鐩憳瑕侊細鍙繚鐣欐渶杩?閬?==========
          contextSummary = '';
          if (generatedContext.length > 0) {
            const recentContext = generatedContext.slice(-3);
            contextSummary = `銆愬凡鐢熸垚棰樼洰锛堥伩鍏嶇煡璇嗙偣鍜屾儏澧冮噸澶嶏級銆慭n${recentContext.join('\n')}\n`;
            
            const summaryTokens = estimateTokens(contextSummary);
            if (summaryTokens > SUMMARY_BUDGET) {
              const shorter = generatedContext.slice(-2);
              contextSummary = `銆愬凡鐢熸垚棰樼洰銆?{shorter.join('锛?)}`;
              if (estimateTokens(contextSummary) > SUMMARY_BUDGET) {
                contextSummary = `銆愪笂涓€棰樸€?{generatedContext[generatedContext.length - 1]}`;
              }
            }
          }

          // ========== 4. 鏃ュ織锛氳緭鍑哄悇妯″潡浣跨敤閲忥紙鏂逛究璋冭瘯锛?==========
          const coreCount = materialContext ? (materialContext.match(/鏍稿績鏁欐潗鍘熸枃/g) || []).length : 0;
          const extCount = materialContext ? (materialContext.match(/琛ュ厖鍙傝€?g) || []).length : 0;
          console.log(`馃搳 棰?{questionPlan.number} 涓婁笅鏂囦娇鐢?
  鏁欐潗鍘熸枃: 鏍稿績娈?+ 鎵╁睍娈?(棰勭畻${MATERIAL_BUDGET} tokens)
  妯℃澘鏍锋湰: ${templateContext ? '宸叉敞鍏? : '鏃?} (棰勭畻${TEMPLATE_BUDGET} tokens)
  宸茬敓鎴愭憳瑕? ${estimateTokens(contextSummary)} tokens (棰勭畻${SUMMARY_BUDGET})`);

          // 馃敡 鎸夐鍨嬩粠鎸囦护搴撴煡璇㈣川閲忕害鏉燂紙鏇夸唬纭紪鐮?typeSpecificRules锛?
          const TYPE_TO_GENTYPE = { '閫夋嫨棰?: 'choice', '濉┖棰?: 'fill', '鍒ゆ柇棰?: 'truefalse', '璁＄畻棰?: 'calc', '瑙ｇ瓟棰?: 'answer', '搴旂敤棰?: 'word_problem', '瀹為獙棰?: 'experiment' };
          const typeGenType = TYPE_TO_GENTYPE[questionPlan.type];
          const typeBlocks = typeGenType ? getMatchingBlockInstructions({ category: '生成-题型专项要求', genType: typeGenType }) : [];
          const typeRule = typeBlocks.length > 0 ? typeBlocks[0].content : '';

          // 馃敡 鏂板锛氱患鍚堥棰濆涓婁笅鏂?
          let integratedContext = '';
          if (questionPlan.knowledgePoint && questionPlan.knowledgePoint.startsWith('缁煎悎锛?)) {
            const kps = questionPlan.knowledgePoint.replace('缁煎悎锛?, '').split(/[銆侊紝,]/).map(k => k.trim());
            integratedContext = `\n鈿狅笍 杩欐槸涓€閬撶患鍚堥锛岄渶瑕佽瀺鍚堜互涓嬬煡璇嗙偣锛?{kps.join('銆?)}\n`;
            integratedContext += `璇峰垱璁句竴涓湡瀹炴儏澧冿紝灏嗕笂杩扮煡璇嗙偣鑷劧铻嶅悎鍦ㄤ竴涓棶棰樹腑銆俓n`;
            integratedContext += `鍚勭煡璇嗙偣鐨勮€冩煡鏉冮噸搴斿ぇ鑷村潎琛°€俓n`;
            if (questionPlan.cognitiveLevel === '鍒嗘瀽' || questionPlan.cognitiveLevel === '璇勪环') {
              integratedContext += `闇€瑕佷綋鐜伴珮闃舵€濈淮锛堝垎鏋?璇勪环锛夛紝涓嶆浜庣畝鍗曞簲鐢ㄣ€俓n`;
            }
          }

          const questionPrompt = `璇风敓鎴愮${questionPlan.number}棰樸€?

      ${situationAnchor}
      ${contextSummary}
      ${styleConsistencyHint}
      銆愰鐩姹傘€?
      - 棰樺彿锛?{questionPlan.number}
      - 棰樺瀷锛?{questionPlan.type}
      - 鑰冩煡鐭ヨ瘑鐐癸細${questionPlan.knowledgePoint}
      - 璁ょ煡灞傛锛?{questionPlan.cognitiveLevel || '鐞嗚В'}
      - 闅惧害锛?{questionPlan.difficulty}
      - 鍒嗗€硷細${questionPlan.score}鍒?
      - 瀵瑰簲绔犺妭锛?{questionPlan.sourceChapter}
      ${integratedContext}

      ${materialContext}
      ${templateContext}
      ${typeRule}
      ${(() => {
        // 馃敡 淇8锛氭寜棰樺瀷娉ㄥ叆瀵瑰簲鐨勮瑷€椋庢牸鎸囩汗
        const tpl = selectedTemplates?.[0];
        const profiles = tpl?.analysis?.typeLanguageProfiles;
        if (!profiles || !questionPlan.type) return '';
  
        const profile = profiles[questionPlan.type];
        if (!profile) return '';
  
        let hint = '\n銆愭ā鏉胯瑷€椋庢牸绾︽潫鈥斺€旀湰棰樺瀷涓撳睘銆慭n';
        if (profile.avgStemLength) {
          hint += `- 鍙傝€冮骞查暱搴︼細绾?{profile.avgStemLength}瀛楋紙卤20%锛塡n`;
        }
        if (profile.commonPatterns?.length) {
          hint += `- 鍙傝€冨彞寮忓紑澶达細${profile.commonPatterns.slice(0, 2).join('銆?)}\n`;
        }
        if (profile.hasPlease) hint += `- 璇ラ鍨嬪湪妯℃澘涓父鐢?璇?寮曞\n`;
        if (profile.hasTry) hint += `- 璇ラ鍨嬪湪妯℃澘涓父鐢?璇?寮曞\n`;
        if (profile.hasKnown) hint += `- 璇ラ鍨嬪湪妯℃澘涓父鐢?宸茬煡"闄堣堪\n`;
        if (profile.avgOptions && questionPlan.type === '閫夋嫨棰?) {
          hint += `- 鍙傝€冮€夐」鏁帮細${profile.avgOptions}涓猏n`;
        }
        if (profile.sampleStem) {
         hint += `- 鍏稿瀷棰樺共绀轰緥锛氥€?{profile.sampleStem}銆峔n`;
        }
        return hint;
      })()}

      ${(() => {
        // 馃敡 淇10锛氬鏋滆棰樺瀷娌℃湁涓撳睘profile锛岄檷绾х敤鍏ㄥ眬languageStyle
        const tpl = selectedTemplates?.[0];
        const profiles = tpl?.analysis?.typeLanguageProfiles;
        const hasTypeProfile = profiles && profiles[questionPlan.type];
  
        if (hasTypeProfile) return ''; // 宸叉湁涓撳睘profile锛屼笉閲嶅娉ㄥ叆
  
        const ls = tpl?.analysis?.languageStyle;
        if (!ls) return '';
  
        let hint = '\n銆愭ā鏉垮叏灞€璇█椋庢牸绾︽潫銆慭n';
        if (ls.avgSentenceLength) hint += `- 鍙傝€冨彞闀匡細绾?{ls.avgSentenceLength}瀛梊n`;
        if (ls.tone) hint += `- 璇皵锛?{ls.tone}\n`;
        if (ls.sampleSentence) hint += `- 椋庢牸鍙傝€冿細銆?{ls.sampleSentence}銆峔n`;
        return hint;
      })()}

      銆愰槻骞昏绾︽潫鈥斺€斿繀椤婚伒瀹堛€?
      1. 鉀?鏈鍙兘鑰冩煡鐭ヨ瘑鐐?${questionPlan.knowledgePoint}"锛屼笉寰楁墿灞曞埌鍏朵粬鏈寚瀹氱殑鐭ヨ瘑鐐?
      2. 鉀?棰樺共涓秹鍙婄殑鏁版嵁銆佸叕寮忋€佹蹇靛繀椤讳笌鏁欐潗鍘熸枃涓€鑷达紝涓嶅緱鑷缂栭€?
      3. 鉀?濡傛灉鐭ヨ瘑鐐瑰寘鍚叿浣撹寖鍥达紙濡?鍚屽垎姣嶅垎鏁?锛夛紝棰樼洰蹇呴』涓ユ牸鍦ㄦ鑼冨洿鍐?
      4. 鉀?绛旀蹇呴』鏄‘瀹氫笖姝ｇ‘鐨勶紝涓嶈兘妯℃１涓ゅ彲

      璇峰彧鐢熸垚杩欎竴閬撻锛屾牸寮忎负HTML鐗囨锛?
      - 棰樺彿鐢?<span class="question-number">${questionPlan.number}.</span>
      - 棰樺共鐢?<p class="question">
      - 閫夋嫨棰橀€夐」鐢?<p class="option">
      - 馃幆 **濉┖棰樻爣璁版櫤鑳介€夋嫨**锛氭牴鎹瓟妗堢被鍨嬪拰闀垮害閫夋嫨锛?
        * 1瀛椻啋 <u class="blank-1">&emsp;</u>
        * 2瀛椻啋 <u class="blank-2">&emsp;</u>
        * 3-4瀛椻啋 <u class="blank-4">&emsp;</u>
        * 5-6瀛椻啋 <u class="blank-6">&emsp;</u>
        * 7-10瀛椻啋 <u class="blank-8">&emsp;</u>
        * 10瀛椾互涓娾啋 <u class="blank-10">&emsp;</u>
      - 鎷彿锛氾紙<u class="blank-2">&emsp;</u>锛?
      - 鏂规锛?span class="square-box">&emsp;</span>
      - 濡傛灉鏄В绛旈锛岀暀鍑鸿В绛斿尯鍩?
      - 馃幆 **鐗规畩鏍囪瑙勮寖**锛堥噸瑕侊紒锛夛細
        * 闇€瑕佸己璋冪殑鏂囧瓧鐢?<strong>鍔犵矖</strong>
        * 闇€瑕佷笅鍒掔嚎鐨勬枃瀛楃敤 <u>涓嬪垝绾?/u>
        * 闇€瑕佸垹闄ょ嚎鐨勬枃瀛楃敤 <del>鍒犻櫎绾?/del>
        * 猸?"鍔犵偣瀛?澶勭悊锛氱敤 <span class="emphasis-dot">瀛?/span> 鏍囪锛孋SS浼氳嚜鍔ㄥ湪瀛椾笅鏂规樉绀虹偣(路)
          绀轰緥锛氫笅鍒楄瘝璇腑锛?span class="emphasis-dot">鍜?/span>骞崇殑璇婚煶...
        * 猸?"鐢荤嚎鍙ュ瓙"澶勭悊锛氱敤 <u class="underline-sentence">瀹屾暣鍙ュ瓙</u> 鏍囪
          绀轰緥锛氳璧忔瀽<u class="underline-sentence">鏄ラ鍙堢豢姹熷崡宀?/u>鐨勮〃杈炬晥鏋?
        * 猸?"涓婃爣"澶勭悊锛氱敤 <sup class="superscript">鍐呭</sup> 鎴?<span class="superscript">鍐呭</span>
          绀轰緥锛歺<sup class="superscript">2</sup> (x鐨勫钩鏂?, v<sub class="subscript">0</sub> (鍒濋€熷害)
        * 猸?"涓嬫爣"澶勭悊锛氱敤 <sub class="subscript">鍐呭</sub> 鎴?<span class="subscript">鍐呭</span>
          绀轰緥锛欻<sub class="subscript">2</sub>O (姘?, CO<sub class="subscript">3</sub><sup class="superscript">2-</sup> (纰抽吀鏍?
        * 猸?"鎷奸煶鏍囨敞"澶勭悊锛氱敤 <ruby>姹夊瓧<rt>p墨ny墨n</rt></ruby>
          绀轰緥锛?ruby>閲?rt>zh貌ng</rt></ruby>閲? <ruby>鏄?rt>ch奴n</rt></ruby>澶?
        * 猸?"鐗规畩鏁板绗﹀彿"澶勭悊锛氱洿鎺ヤ娇鐢║nicode瀛楃锛屼笉瑕佺敤LaTeX鎴栧浘鐗?
          - 搴︽暟锛毬?(濡?90掳, 45掳)
          - 绾︾瓑浜庯細鈮?(濡?蟺 鈮?3.14)
          - 涓嶇瓑浜庯細鈮?(濡?x 鈮?0)
          - 灏忎簬绛変簬锛氣墹 (濡?x 鈮?10)
          - 澶т簬绛変簬锛氣墺 (濡?x 鈮?5)
          - 姝ｈ礋鍙凤細卤 (濡?卤5)
          - 涔樺彿锛毭?(濡?3 脳 4 = 12)
          - 闄ゅ彿锛毭?(濡?12 梅 3 = 4)
          - 涓夎褰細鈻?(濡?鈻矨BC)
          - 瑙掞細鈭?(濡?鈭燗BC = 90掳)
          - 骞宠锛氣垾 (濡?AB 鈭?CD)
          - 鍨傜洿锛氣姤 (濡?AB 鈯?CD)
          - 鍦嗗懆鐜囷細蟺 (濡?C = 2蟺r)
          - 鏃犵┓澶э細鈭?
          - 鏍瑰彿锛氣垰 (濡?鈭?, 鈭?a+b))
      - 淇濈暀鍘熸枃鐨勭┖鐧界缉杩涘拰鎹㈣
      - 鍦ㄨ繖閬撻鍚庢爣娉細銆愮煡璇嗙偣锛?{questionPlan.knowledgePoint}銆戙€愰毦搴︼細${questionPlan.difficulty}銆?

      鍙繑鍥炶繖涓€閬撻鐨凥TML浠ｇ爜锛屼笉瑕佹坊鍔燶`\`\`html鏍囪銆俙;

          try {
            // 馃敡 浼樺寲锛氱涓€棰樺墠妫€鏌ユā鍨嬬姸鎬侊紝鍚庣画棰樹箣闂寸瓑寰?绉?
            if (i === 0) {
              console.log('馃敟 棰樼洰鐢熸垚锛氭鏌ユā鍨嬬姸鎬?..');
              try {
                const result = await checkModelReady(null, 3, 'text');
                
                if (!result.ready) {
                  console.log(`鈿狅笍 妯″瀷鏈氨缁紝鏍规嵁鍝嶅簲鏃堕棿鍔ㄦ€佺瓑寰?.. (${result.responseTime}ms)`);
                  const additionalWait = Math.max(2000, Math.min(4000, result.responseTime / 10));
                  await new Promise(r => setTimeout(r, additionalWait));
                } else {
                  console.log(`鉁?鏂囨湰鐢熸垚妯″瀷宸插氨缁紝绔嬪嵆寮€濮嬶紙鍝嶅簲鏃堕棿: ${result.responseTime}ms, 灏濊瘯${result.attempts}娆★級`);
                }
              } catch (e) {
                console.warn('鈿狅笍 妯″瀷妫€娴嬪け璐ワ紝绛夊緟3绉掑悗缁х画...', e.message);
                await new Promise(r => setTimeout(r, 3000));
              }
            } else {
              // 棰樹箣闂寸瓑寰?绉掞紝璁╂ā鍨嬫仮澶?
              console.log(`鈴?绗?{i+1}棰樹箣鍓嶇瓑寰?绉?..`);
              await new Promise(r => setTimeout(r, 2000));
            }
            
            const questionContent = await callAI(questionPrompt, { 
              taskType: 'generation',    // 鉁?棰樼洰鐢熸垚鐢ㄩ噸鍨嬫ā鍨?
              timeout: 120000,           // 鍗曢缁?鍒嗛挓
              allowContinuation: true    // 馃敡 鍏佽棰樼洰鐢熸垚鏃惰嚜鍔ㄧ画鍐?
            });

            generatedQuestions.push(questionContent);
            
            // 鉁?鏂板锛氶€愰鑷楠岃瘉
            let validationNote = '';
            
            // 馃敡 澧炲己锛氱‖鎬ц鍒欓獙璇侊紙鍏堜簬AI楠岃瘉锛屾垚鏈綆銆侀€熷害蹇級
            try {
              const book = selectedBooks?.[0];
              const rawSubject = book?.subject || '';
              const stage = book?.stage || '';
              const subject = normalizeSubjectName(rawSubject, stage);
              
              // 馃敡 浣跨敤瀛︾涓撶敤楠岃瘉鍣?
              const hardResults = runHardValidators(questionContent, subject);
              
              if (hardResults.length > 0) {
                const errors = [];
                const warnings = [];
                
                for (const result of hardResults) {
                  if (result.passed === false) {
                    const prefix = result.severity === 'error' ? '鉂? : '鈿狅笍';
                    const note = `${prefix} [${result.name}] ${result.message}`;
                    
                    if (result.severity === 'error') {
                      errors.push(note);
                    } else {
                      warnings.push(note);
                    }
                    
                    validationNote += `<!-- ${note} -->\n`;
                    console.warn(`棰?{questionPlan.number}${note}`);
                  }
                }
                
                // 鑷姩淇鍙慨澶嶇殑闂
                const fixedContent = applyAutoFixes(questionContent, hardResults);
                if (fixedContent !== questionContent) {
                  const idx = generatedQuestions.indexOf(questionContent);
                  if (idx >= 0) {
                    generatedQuestions[idx] = fixedContent;
                    console.log(`馃敡 棰?{questionPlan.number} 鑷姩淇瀹屾垚`);
                  }
                }
                
                // 馃敡 鏂板锛氬鏋滃瓨鍦ㄤ弗閲嶉敊璇紙error绾у埆锛夛紝鏍囪闇€瑕侀噸璇?
                if (errors.length > 0) {
                  console.warn(`鈿狅笍 棰?{questionPlan.number} 瀛樺湪 ${errors.length} 涓弗閲嶉敊璇紝寤鸿浜哄伐瀹℃煡`);
                  // 灏嗛敊璇俊鎭啓鍏?validationNote 渚涘悗缁鏌ュ弬鑰?
                  validationNote += `<!-- 鈿狅笍鈿狅笍鈿狅笍 鏈瀛樺湪涓ラ噸瑙勫垯杩濆弽锛岃浜哄伐瀹℃煡 鈿狅笍鈿狅笍鈿狅笍 -->\n`;
                  validationNote += `<!-- 閿欒鍒楄〃锛歕n${errors.join('\n')}\n-->\n`;
                  
                  // 馃敡 鏂板锛氬浜庝弗閲嶉敊璇紝灏濊瘯閲嶆柊鐢熸垚
                  if (errors.length >= 2 && i < totalQuestions) {
                    console.log(`馃攧 棰?{questionPlan.number} 瀛樺湪澶氫釜涓ラ噸閿欒锛屽皢鍦ㄨ嚜鍔ㄤ慨澶嶅惊鐜腑澶勭悊`);
                  }
                }
                
                // 馃敡 鏂板锛氳褰曡鍛婃暟閲?
                if (warnings.length > 0) {
                  console.log(`馃摑 棰?{questionPlan.number} 瀛樺湪 ${warnings.length} 涓鍛奰);
                }
              }
            } catch (e) {
              console.warn('纭€ц鍒欓獙璇佸け璐?', e.message);
            }
            try {
              const validatePrompt = `璇峰鏌ヨ繖閬撻鐩紝妫€鏌ョ煡璇嗙偣鍖归厤搴﹀拰绉戝鎬э細

銆愰鐩唴瀹广€?
${questionContent.replace(/<[^>]+>/g, '').substring(0, 500)}

銆愬懡棰樿姹傘€?
鐭ヨ瘑鐐癸細${questionPlan.knowledgePoint}
闅惧害锛?{questionPlan.difficulty}
棰樺瀷锛?{questionPlan.type}

璇烽€愪竴妫€鏌ュ苟鍙繑鍥濲SON锛?
{
  "knowledgeMatch": true,
  "knowledgeMatchReason": "棰樼洰纭疄鑰冩煡浜嗚鐭ヨ瘑鐐?,
  "hasScienceError": false,
  "scienceErrorDetail": "",
  "answerCorrect": true,
  "suggestion": ""
}`;

              const validateResult = await callAI(validatePrompt, { 
                taskType: 'questionValidation',  // 馃敡 浣跨敤鐙珛楠岃瘉绛栫暐
                temperature: 0,                  // 馃敡 闄嶅埌0锛岀‘淇濆瑙?
                timeout: 30000 
              });
              try {
                const validation = await robustJsonParse(validateResult, null, '棰樼洰楠岃瘉');
                if (!validation.knowledgeMatch) {
                  validationNote = `<!-- 鈿狅笍 鐭ヨ瘑鐐瑰尮閰嶉棶棰橈細${validation.knowledgeMatchReason || '鏈煡'} -->`;
                  console.warn(`棰?{questionPlan.number}鐭ヨ瘑鐐瑰尮閰嶉棶棰?`, validation.knowledgeMatchReason);
                }
                if (validation.hasScienceError) {
                  validationNote += `<!-- 鉂?绉戝鎬ч敊璇細${validation.scienceErrorDetail || '鏈煡'} -->`;
                  console.error(`棰?{questionPlan.number}绉戝鎬ч敊璇?`, validation.scienceErrorDetail);
                }
                if (!validation.answerCorrect) {
                  validationNote += `<!-- 鈿狅笍 绛旀鍙兘鏈夎 -->`;
                  console.warn(`棰?{questionPlan.number}绛旀鍙兘鏈夎`);
                }
                
                // 馃敡 淇锛氫氦鍙夐獙璇佲€斺€旂敤涓庣敓鎴愬紩鎿庝笉鍚岀殑寮曟搸楠岀畻锛岄伩鍏嶈嚜鎴戠‘璁ゅ亸宸?
                const mathTypes = ['璁＄畻棰?, '瑙ｇ瓟棰?, '搴旂敤棰?, '閫夋嫨棰?, '濉┖棰?];
                if (mathTypes.includes(questionPlan.type) && questionContent.length > 20) {
                  try {
                    // 鎻愬彇棰樼洰涓殑鍘熷绛旀锛堝绉嶆牸寮忓吋瀹癸級
                    const answerPatterns = [
                      /绛旀[锛?]\s*(.+?)(?:<|$|\n)/,
                      /銆愮瓟妗堛€慭s*(.+?)(?:<|$|\n)/,
                      /鍙傝€冪瓟妗圼锛?]\s*(.+?)(?:<|$|\n)/,
                      /姝ｇ‘[绛旀閫夐」][锛?]\s*(.+?)(?:<|$|\n)/
                    ];
                    let originalAnswer = '';
                    for (const pattern of answerPatterns) {
                      const match = questionContent.match(pattern);
                      if (match) {
                        originalAnswer = match[1].trim();
                        break;
                      }
                    }

                    // 鎻愬彇绾枃鏈骞茬敤浜庨獙绠?
                    const plainText = questionContent
                      .replace(/<[^>]+>/g, '')
                      .replace(/銆愮瓟妗堛€慬\s\S]*$/, '')  // 鍘绘帀绛旀閮ㄥ垎
                      .trim();

                    const mathVerifyPrompt = `璇疯绠楄繖閬撻锛屽厛鍐欏嚭鍏抽敭姝ラ锛岀劧鍚庣粰鍑烘渶缁堢瓟妗堛€?

銆愰鐩€?
${plainText.substring(0, 600)}

銆愯緭鍑烘牸寮忋€?
姝ラ锛?
1. ...
2. ...
鏈€缁堢瓟妗堬細[绛旀]

濡傛灉棰樼洰鏈韩鏈夐€昏緫閿欒鎴栨潯浠朵笉瓒冲鑷存棤娉曡绠楋紝璇疯鏄庡叿浣撻棶棰樸€俙;

                    // 馃敡 鏍稿績鏀瑰姩锛氭牴鎹綋鍓嶅紩鎿庨€夋嫨涓嶅悓鐨勯獙绠楀紩鎿?
                    const currentConfig = await getCurrentEngineConfig('review');
                    let verifyEngine = 'same';  // 榛樿鍚屽紩鎿?
                    let verifyApiKey = '';
                    
                    // 濡傛灉褰撳墠鏄?Ollama 涓旈厤缃簡 DeepSeek锛岀敤 DeepSeek 楠岀畻
                    if (currentConfig.engine === 'ollama' && apiConfig.deepseekApiKey) {
                      verifyEngine = 'deepseek';
                      verifyApiKey = apiConfig.deepseekApiKey;
                    }
                    // 濡傛灉褰撳墠鏄?DeepSeek 涓?Ollama 鍙敤锛岀敤 Ollama 楠岀畻
                    else if (currentConfig.engine === 'deepseek') {
                      verifyEngine = 'ollama';
                    }

                    let independentAnswer = '';
                    
                    if (verifyEngine === 'deepseek') {
                      // 鐢?DeepSeek 楠岀畻
                      try {
                        const deepseekResponse = await axios.post(
                          apiConfig.deepseekBaseUrl,
                          {
                            model: apiConfig.deepseekModel,
                            messages: [{ role: 'user', content: mathVerifyPrompt }],
                            temperature: 0,
                            max_tokens: 1024
                          },
                          {
                            headers: { 'Authorization': `Bearer ${verifyApiKey}` },
                            timeout: 30000
                          }
                        );
                        independentAnswer = deepseekResponse.data.choices[0].message.content;
                      } catch (e) {
                        console.warn('DeepSeek 楠岀畻澶辫触锛岄檷绾т娇鐢?Ollama:', e.message);
                        independentAnswer = await callAI(mathVerifyPrompt, {
                          taskType: 'questionValidation',
                          temperature: 0,
                          timeout: 30000,
                          retries: 0
                        });
                      }
                    } else if (verifyEngine === 'ollama') {
                      // 鐢?Ollama 楠岀畻锛堜絾鐢ㄨ交閲忔ā鍨嬩互鑺傜害璧勬簮锛?
                      independentAnswer = await callAI(mathVerifyPrompt, {
                        taskType: 'questionValidation',  // 馃敡 浣跨敤鐙珛楠岃瘉绛栫暐
                        temperature: 0,                  // 馃敡 闄嶅埌0锛岀‘淇濆瑙?
                        timeout: 30000,
                        retries: 0
                      });
                    } else {
                      // 鍚屼竴寮曟搸楠岀畻锛堥檷绾ф柟妗堬級锛屼絾鐢?temperature=0 鎻愰珮纭畾鎬?
                      independentAnswer = await callAI(mathVerifyPrompt, {
                        taskType: 'questionValidation',
                        temperature: 0,
                        timeout: 30000,
                        retries: 0
                      });
                    }

                    // 浠庨獙绠楃粨鏋滀腑鎻愬彇鏈€缁堢瓟妗?
                    const finalAnswerMatch = independentAnswer.match(/鏈€缁堢瓟妗圼锛?]\s*(.+?)(?:\n|$)/);
                    const verifyAnswer = finalAnswerMatch 
                      ? finalAnswerMatch[1].trim() 
                      : independentAnswer.split('\n').pop().trim();

                    // 馃敡 鏀硅繘锛氭洿鏅鸿兘鐨勭瓟妗堝姣?
                    if (verifyAnswer && originalAnswer) {
                      const normalize = (s) => {
                        return s
                          .replace(/\s+/g, '')           // 鍘荤┖鏍?
                          .replace(/[锛?]/g, '')          // 鍘讳腑鏂?鑻辨枃閫楀彿
                          .replace(/[銆?]/g, '')          // 鍘诲彞鍙?
                          .replace(/锛?g, '(')            // 缁熶竴鎷彿
                          .replace(/锛?g, ')')
                          .toLowerCase();
                      };

                      const normOriginal = normalize(originalAnswer);
                      const normVerify = normalize(verifyAnswer);

                      if (normOriginal !== normVerify) {
                        // 馃敡 鏀硅繘锛氫笉涓€鑷存椂鍔犻啋鐩鍛?
                        validationNote += `\n<!-- 鈿狅笍鈿狅笍鈿狅笍 浜ゅ弶楠岀畻涓嶄竴鑷达紙楠岀畻寮曟搸锛?{verifyEngine}锛夆殸锔忊殸锔忊殸锔?
  鍘熺瓟妗堬細${originalAnswer}
  楠岀畻缁撴灉锛?{verifyAnswer}
  楠岀畻杩囩▼锛?
  ${independentAnswer.split('\n').map(l => '  ' + l).join('\n')}
  璇峰姟蹇呬汉宸ユ牳瀵癸紒 -->`;
                        console.warn(`棰?{questionPlan.number}浜ゅ弶楠岀畻涓嶄竴鑷?[${verifyEngine}]: 鍘?"${originalAnswer}" 楠?"${verifyAnswer}"`);
                        
                        // 馃敡 鏂板锛氬鏋滄槸楂樼疆淇″害棰樼洰锛堝绠€鍗曡绠楋級锛屾爣璁颁负闇€瑕佷汉宸ュ鏌?
                        if (questionPlan.difficulty === '鍩虹') {
                          console.error(`鍩虹棰?{questionPlan.number}绛旀鍙兘閿欒锛屽己鐑堝缓璁汉宸ュ鏌);
                        }
                      } else {
                        console.log(`鉁?棰?{questionPlan.number}浜ゅ弶楠岀畻涓€鑷?[${verifyEngine}]`);
                      }
                    }
                  } catch (e) {
                    console.warn('鏁板楠岀畻澶辫触锛堥潪闃诲锛?', e.message);
                  }
                }
                
                if (validationNote) {
                  const idx = generatedQuestions.indexOf(questionContent);
                  if (idx >= 0) {
                    generatedQuestions[idx] = validationNote + '\n' + questionContent;
                  }
                }
              } catch {
                // 楠岃瘉瑙ｆ瀽澶辫触涓嶉樆濉?
              }
            } catch {
              // 楠岃瘉璋冪敤澶辫触涓嶉樆濉?
            }
            
            // 鉁?鎻愬彇15瀛楁憳瑕侊紝渚涘悗缁鐩娇鐢?
            try {
              const summary = await callAI(
                `鐢?5瀛椾互鍐呮鎷繖閬撻锛?{questionContent}`,
                { taskType: 'generation', temperature: 0.1 }  // 馃敡 淇锛欴eepSeek 寮曟搸涓嶆敮鎸?formatting
              );
              generatedContext.push(`绗?{questionPlan.number}棰?${questionPlan.type},${questionPlan.knowledgePoint}): ${summary.trim()}`);
            } catch {
              generatedContext.push(`绗?{questionPlan.number}棰?${questionPlan.type},${questionPlan.knowledgePoint})`);
            }
          } catch (e) {
            console.warn(`绗?{i+1}棰樼敓鎴愬け璐?`, e.message);
            generatedQuestions.push(`<p class="question"><span class="question-number">${questionPlan.number}.</span> 銆愮敓鎴愬け璐ワ紝璇烽噸璇曘€?/p>`);
            generatedContext.push(`绗?{questionPlan.number}棰樸€愮敓鎴愬け璐ャ€慲);
          }
        }
  
        // 鉁?4.3锛氬幓閲嶆鏌ワ紙璺ㄩ璇箟鍘婚噸锛?
        if (generatedQuestions.length > 2) {
          statusText.value = '姝ｅ湪妫€鏌ラ鐩噸澶?..';
          progress.value = 85;
          
          try {
            const dedupPrompt = `妫€鏌ヤ互涓?{generatedQuestions.length}閬撻鏄惁瀛樺湪鐭ヨ瘑鐐归噸澶嶈€冩煡鐨勬儏鍐点€?
濡傛灉瀛樺湪閲嶅锛堣€冩煡鐐规湰璐ㄧ浉鍚岋級锛屾寚鍑洪噸澶嶇殑棰樺彿瀵广€?

${generatedQuestions.map((q, i) => `棰?{i+1}锛?{q.replace(/<[^>]+>/g, '').substring(0, 100)}`).join('\n')}

杩斿洖JSON锛?
{
  "hasDuplicates": true,
  "duplicatePairs": [{"q1": 1, "q2": 3, "reason": "涓ら閮借€冩煡鍒嗘暟鍔犲噺娉?}],
  "suggestion": "寤鸿鍚堝苟鎴栨浛鎹㈠叾涓竴棰?
}
濡傛灉娌℃湁閲嶅锛岃繑鍥?{"hasDuplicates": false}

鍙繑鍥濲SON銆俙;

            const dedupResult = await callAI(dedupPrompt, { 
              taskType: 'review', temperature: 0.1 
            });
            try {
              const dedup = await robustJsonParse(dedupResult, null, '鍘婚噸妫€鏌?);
              if (dedup.hasDuplicates && dedup.duplicatePairs?.length > 0) {
                console.warn('鈿狅笍 妫€娴嬪埌閲嶅棰樼洰:', dedup.duplicatePairs);
                // 鍦ㄥ唴瀹瑰墠娣诲姞璀﹀憡娉ㄩ噴
                const warningNote = `<!-- 鈿狅笍 鍘婚噸璀﹀憡锛?{dedup.suggestion || '浠ヤ笅棰樼洰鍙兘瀛樺湪閲嶅'} -->\n`;
                generatedQuestions.unshift(warningNote);
              }
            } catch {
              // 鍘婚噸澶辫触涓嶉樆濉?
            }
          } catch (e) {
            console.warn('鍘婚噸妫€鏌ュけ璐?', e.message);
          }
        }

        // 鉁?4.4锛氱粍瑁呭畬鏁村唴瀹?
        statusText.value = '姝ｅ湪缁勮璇曞嵎...';
        progress.value = 88;

        const headerPrompt = `璇锋牴鎹互涓嬩俊鎭敓鎴愯瘯鍗峰ご閮紙鏍囬銆佽€冭瘯淇℃伅绛夛級锛?
      瀛︾锛?{selectedBooks?.[0]?.subject || ''}
      骞寸骇锛?{selectedBooks?.[0]?.grade || ''}
      鎬诲垎锛?{totalScore || 100}鍒?
      棰樺瀷鍒嗗竷锛?{parsedBlueprint.map(q => `${q.type}脳${parsedBlueprint.filter(p => p.type === q.type).length}棰榒).filter((v, i, a) => a.indexOf(v) === i).join('锛?)}

      杩斿洖HTML鏍煎紡鐨勮瘯鍗峰ご閮紝鐢?h1>鏍囬锛岀敤<div class="exam-info">鍖呰１鑰冭瘯淇℃伅銆俙;

        try {
          const header = await callAI(headerPrompt, { 
            taskType: 'generation', temperature: 0.3 
          });
          content = header + '\n\n' + generatedQuestions.join('\n\n');
        } catch (e) {
          content = generatedQuestions.join('\n\n');
        }

      } else {
        // 鉁?闄嶇骇锛氳摑鍥捐В鏋愬け璐ユ椂锛屼娇鐢ㄥ師鏈夌殑涓€娆℃€х敓鎴愭柟寮?
        statusText.value = '姝ラ 4/5锛氶€愰鐢熸垚(闄嶇骇妯″紡)...';
        progress.value = 70;
  
        let templateRawText = '';
        // 馃敡 鏀硅繘锛氶檷绾ц矾寰勪腑闄愬埗鎬婚暱搴︼紝浣嗕紭鍏堜繚鐣欏叧閿钀?
        let textbookRawText = '';
        const MAX_DOWNGRADE_TEXT_LENGTH = 3000;
        if (selectedBooks && selectedBooks.length > 0) {
          for (const book of selectedBooks) {
            const chapters = book.selectedChapters || [];
            for (const ch of chapters) {
              if (ch.rawText) {
                // 馃敡 浼樺厛鍙栫珷鑺傚紑澶达紙閫氬父鍖呭惈鏍稿績姒傚康锛夊拰缁撳熬锛堥€氬父鍖呭惈灏忕粨锛?
                const chText = ch.rawText;
                const headText = chText.substring(0, Math.floor(MAX_DOWNGRADE_TEXT_LENGTH / 2));
                const tailText = chText.length > MAX_DOWNGRADE_TEXT_LENGTH 
                  ? '\n...锛堜腑鐣ワ級...\n' + chText.substring(chText.length - Math.floor(MAX_DOWNGRADE_TEXT_LENGTH / 4))
                  : '';
                textbookRawText += `銆?{ch.title}銆慭n${headText}${tailText}\n\n`;
                
                if (textbookRawText.length > MAX_DOWNGRADE_TEXT_LENGTH * 2) {
                  textbookRawText += '...锛堝悗缁珷鑺傚師鏂囧凡鐪佺暐锛?..\n';
                  break;
                }
              }
            }
          }
        }
        if (selectedTemplates && selectedTemplates.length > 0) {
          const tpl = selectedTemplates[0];
          const chapters = tpl.selectedChapters || [];
          for (const ch of chapters) {
            if (ch.rawText) templateRawText += ch.rawText + '\n';
          }
        }
  
        const prompt4 = `璇锋牴鎹互涓嬪懡棰樿摑鍥撅紝鐢熸垚瀹屾暣鐨勬暀杈呰祫鏂欍€?

      銆愬懡棰樿摑鍥俱€?
      ${blueprint}

      ${textbookRawText ? '銆愭暀鏉愬弬鑰冨師鏂囥€慭n' + textbookRawText + '\n' : ''}
      ${templateRawText ? '銆愭ā鏉垮弬鑰冨師鏂囥€慭n' + templateRawText : ''}

      銆愨殸锔?闄嶇骇妯″紡绾︽潫鈥斺€斿繀椤讳弗鏍奸伒瀹堛€?
      1. 濡傛灉鏁欐潗鍙傝€冨師鏂囦笉涓虹┖锛屾瘡閬撻蹇呴』鍩轰簬鍘熸枃鍛介锛屼笉寰楄劚绂绘暀鏉?
      2. 濡傛灉鏁欐潗鍙傝€冨師鏂囦负绌猴紝鍙兘鍩轰簬鍛介钃濆浘涓爣娉ㄧ殑鐭ヨ瘑鐐瑰懡棰?
      3. 鐭ヨ瘑鐐瑰繀椤讳弗鏍煎搴旇摑鍥句腑姣忛亾棰樼殑 knowledgePoint 瀛楁
      4. 涓嶅緱缂栭€犱换浣曡摑鍥炬湭鍒楀嚭鐨勭煡璇嗙偣
      5. 绛旀蹇呴』鍞竴纭畾锛屼笉寰楁ā妫变袱鍙?

      銆愭牸寮忚姹傘€?
      - 杩斿洖HTML锛岄骞茬敤<p class="question">锛岄€夐」鐢?p class="option">
      - 姣忛亾棰樺繀椤荤嫭绔嬬敤鍧楃骇鏍囩鍖呰９锛屼弗绂佸閬撻鎸ゅ湪鍚屼竴娈佃惤

      銆愬己鍒剁害鏉熴€?
      1. 姣忛亾棰樺墠鏍囨敞棰樺彿锛屼笌钃濆浘鐨勯鍙蜂竴涓€瀵瑰簲
      2. 姣忛亾棰樺悗鏍囨敞銆愮煡璇嗙偣锛歑XX銆戙€愬搴旇鏂囷細XXX銆?
      3. 棰樺瀷銆佸垎鍊笺€侀毦搴︿弗鏍兼寜钃濆浘鎵ц
      4. 蹇呴』杩斿洖鏍囧噯HTML浠ｇ爜锛岄琛屼笉瑕佺敤\`\`\`html鍖呰９
      5. 绛旀鍜岃В鏋愭斁鍦ㄦ枃鏈?div class="answer-section">涓?

${buildOutputFormatBlock('exam', selectedBooks?.[0]?.subject || '', selectedBooks?.[0]?.stage || '', selectedBooks?.[0]?.grade || '')}`;

        try {
          content = await callAI(prompt4, { 
            taskType: 'generation',      // 鉁?
            timeout: 180000 
          });
          detectSquishedOutput(content, 'exam-downgrade');
        } catch (e) {
          console.warn('绗洓姝ュけ璐?, e.message);
          throw e;
        }
      }
      
      // ========== 绗簲姝ワ細澶氱淮搴﹁川閲忔牎楠?==========
      const step5Config = await getCurrentEngineConfigEnhanced('review');
      const step5ModelName = getModelDisplayName(step5Config.textModel || step5Config.model);
      statusText.value = `姝ラ 5/5锛氳川閲忔牎楠?[${step5ModelName}]...`;
      progress.value = 85;

      const issues = [];
      
      // ========== 馃敡 鏂板锛氱‖鎬ц鍒欐鏌ワ紙绗竴绾э級 ==========
      const book = selectedBooks?.[0];
      const stageRaw = book?.stage || '';
      const stageMap = { '灏忓': 'primary', '鍒濅腑': 'middle', '楂樹腑': 'high' };
      const hardIssues = HardRuleChecker.check(
        content, 
        parsedBlueprint, 
        book?.subject || '', 
        stageMap[stageRaw] || stageRaw,
        book?.grade || ''
      );
      
      // 鍚堝苟纭€ф鏌ラ棶棰?
      hardIssues.forEach(issue => {
        issues.push(`${issue.severity === 'error' ? '鉂? : '鈿狅笍'} ${issue.detail}`);
      });

      // 鑷姩淇鍙慨澶嶇殑闂
      if (hardIssues.some(i => i.autoFix)) {
        content = HardRuleChecker.autoFix(content, hardIssues);
      }

      // 鍒濆鍖栬川閲忔姤鍛婏紙蹇呴』鍦ㄦ墍鏈変娇鐢ㄤ箣鍓嶅畾涔夛級
      const qualityReport = {
        formatCheck: { passed: true, details: [] },
        coverageCheck: { passed: true, details: [] },
        difficultyCheck: { passed: true, details: [] },
        knowledgeCheck: { passed: true, details: [] },
        templateMatch: { passed: true, details: [] },
        aiReview: { passed: true, details: [] }
      };

      // 璁板綍纭€ф鏌ョ粨鏋?
      const hardIssueSummary = HardRuleChecker.getIssueSummary(hardIssues);
      if (hardIssueSummary.hasErrors) {
        qualityReport.formatCheck.passed = false;
        qualityReport.formatCheck.details.push(`纭€ц鍒欐鏌ュ彂鐜?{hardIssueSummary.errors}涓敊璇痐);
      }
      if (hardIssueSummary.hasWarnings) {
        qualityReport.formatCheck.details.push(`纭€ц鍒欐鏌ュ彂鐜?{hardIssueSummary.warnings}涓鍛奰);
      }

      // ========== 绗竴绾э細瑙勫垯妫€鏌?==========
      // 5.1锛氭牸寮忓畬鏁存€ф鏌?
      if (!content.includes('<h') && !content.includes('<p') && !content.includes('<div')) {
        issues.push('鉂?鍙兘鏈繑鍥濰TML鏍煎紡');
        qualityReport.formatCheck.passed = false;
        qualityReport.formatCheck.details.push('缂哄皯HTML鏍囩');
      }
      if (!content.includes('answer-section')) {
        issues.push('鈿狅笍 缂哄皯绛旀鍖哄煙');
        qualityReport.formatCheck.details.push('缂哄皯绛旀鍖哄煙');
      }

      // 馃敡 鏂板锛氱瓟妗堝尯鍩熷畬鏁存€ф鏌?
      if (content.includes('answer-section') && parsedBlueprint.length > 0) {
        // 鎻愬彇绛旀鍖哄煙鍐呭
        const answerMatch = content.match(/<div class="answer-section">([\s\S]*?)<\/div>/i);
        if (answerMatch) {
          const answerContent = answerMatch[1];
          // 缁熻绛旀鍖哄煙涓殑绛旀鏁伴噺锛堥€氳繃鏌ユ壘"绛旀锛?鎴?銆愮瓟妗堛€?绛夋爣璁帮級
          const answerMarkers = answerContent.match(/绛旀[锛?]/g) || [];
          const answerCount = answerMarkers.length;
          
          // 瀵规瘮钃濆浘棰樼洰鏁伴噺
          const questionCount = parsedBlueprint.length;
          
          if (answerCount === 0) {
            issues.push('鈿狅笍 绛旀鍖哄煙瀛樺湪浣嗘湭妫€娴嬪埌绛旀鏍囪');
            qualityReport.formatCheck.details.push('绛旀鍖哄煙缂哄皯绛旀鏍囪');
          } else if (answerCount < questionCount * 0.8) {
            issues.push(`鈿狅笍 绛旀鏁伴噺(${answerCount})鏄庢樉灏戜簬棰樼洰鏁伴噺(${questionCount})锛屽彲鑳界己澶遍儴鍒嗙瓟妗坄);
            qualityReport.formatCheck.details.push(`绛旀鏁伴噺${answerCount}锛岄鐩暟閲?{questionCount}`);
          }
          
          // 妫€鏌ユ槸鍚︽湁"鐣?浣滀负绛旀
          const skippedAnswers = (answerContent.match(/绛旀[锛?]\s*鐣?g) || []).length;
          if (skippedAnswers > 0) {
            issues.push(`鈿狅笍 鏈?{skippedAnswers}閬撻鐨勭瓟妗堟爣娉ㄤ负"鐣?锛屽簲鎻愪緵瀹屾暣绛旀`);
          }
        }
      }

      // 鏍煎紡妫€鏌?
      if (!content.includes('<p class="question"') && !content.includes('<h')) {
        issues.push('鉂?鍙兘鏈繑鍥濰TML鏍煎紡');
        qualityReport.formatCheck.passed = false;
      }

      const questionMatches = content.match(/<p class="question"/g);
      const questionCount = questionMatches ? questionMatches.length : 0;
      if (questionCount === 0) {
        issues.push('鉂?鏈娴嬪埌棰樼洰');
        qualityReport.formatCheck.passed = false;
      }
      if (questionCount > 0 && questionCount < 5) {
        issues.push(`鈿狅笍 棰樼洰鏁伴噺鍋忓皯锛?{questionCount}棰橈級`);
        qualityReport.formatCheck.details.push(`棰樼洰鏁伴噺锛?{questionCount}棰榒);
      }

      // 馃敡 鏂板锛氳摑鍥?鐢熸垚缁撴灉缁撴瀯鍖栧姣?
      if (parsedBlueprint.length > 0) {
        const comparisonResult = compareBlueprintToGenerated(parsedBlueprint, content, totalScore);
        
        qualityReport.coverageCheck.details.push(...comparisonResult.details);
        
        if (!comparisonResult.passed) {
          comparisonResult.issues.forEach(issue => {
            issues.push(issue);
          });
          qualityReport.coverageCheck.passed = false;
        }
        
        qualityReport.templateMatch.details.push(
          `钃濆浘-鐢熸垚棰樺瀷鍖归厤搴︼細${Math.round(comparisonResult.stats.typeMatchRate * 100)}%`
        );
        
        qualityReport.coverageCheck.details.push(
          `钃濆浘瑙勫垝${comparisonResult.stats.blueprintTotal}棰橈紝瀹為檯鐢熸垚${comparisonResult.stats.detectedTotal}棰榒
        );
      }

      // 5.3锛氱瀛︽€ч敊璇垵妫€锛堝叏瑙掓暟瀛椼€佹牸寮忓紓甯革級
      const commonErrors = [
        { pattern: /[锛?锛橾/g, message: '鍖呭惈鍏ㄨ鏁板瓧' },
        { pattern: /绛旀.{0,5}鐣?g, message: '绛旀鏍囨敞涓?鐣?' },
      ];
      commonErrors.forEach(({ pattern, message }) => {
        if (pattern.test(content)) {
          issues.push(`鈿狅笍 ${message}`);
        }
      });

      // 馃敡 鏂板锛歀aTeX 鍏紡璇硶鍩虹鏍￠獙
      if (book && ['鏁板', '鐗╃悊', '鍖栧'].includes(book.subject || '')) {
        // 妫€鏌ヨ鍐呭叕寮?$...$ 鏄惁闂悎锛堝鏁颁釜 $ 琛ㄧず鏈夋湭闂悎鐨勫叕寮忥級
        const dollarCount = (content.match(/\$/g) || []).length;
        if (dollarCount % 2 !== 0) {
          issues.push('鈿狅笍 琛屽唴鍏紡绗﹀彿$鏈棴鍚堬紙濂囨暟涓?锛?);
          qualityReport.formatCheck.details.push('妫€娴嬪埌鏈棴鍚堢殑$鍏紡绗﹀彿');
        }
        
        // 妫€鏌ョ嫭绔嬪叕寮?$$...$$ 鏄惁閰嶅
        const doubleDollarCount = (content.match(/\$\$/g) || []).length;
        if (doubleDollarCount % 2 !== 0) {
          issues.push('鈿狅笍 鐙珛鍏紡绗﹀彿$$鏈厤瀵?);
          qualityReport.formatCheck.details.push('妫€娴嬪埌鏈厤瀵圭殑$$鍏紡绗﹀彿');
        }
        
        // 妫€鏌ュ父瑙?LaTeX 璇硶閿欒
        const latexErrors = [
          { pattern: /\\frac\{\}/, message: '\\frac{} 缂哄皯鍙傛暟' },
          { pattern: /\\sqrt\{\}/, message: '\\sqrt{} 缂哄皯鍙傛暟' },
          { pattern: /\{\\frac/, message: '鎷彿浣嶇疆閿欒锛堝簲鍦╘\frac涔嬪悗锛? },
          { pattern: /[^\\]_\{[^}]*$/, message: '涓嬫爣{}鍙兘鏈棴鍚? },
          { pattern: /[^\\]\^\{[^}]*$/, message: '涓婃爣{}鍙兘鏈棴鍚? }
        ];
        
        for (const error of latexErrors) {
          if (error.pattern.test(content)) {
            issues.push(`鈿狅笍 LaTeX璇硶闂锛?{error.message}`);
          }
        }
      }

            progress.value = 85;

      // ========== 馃敡 鏂板锛氳秴绾叉娴嬶紙鍩轰簬璇炬爣鐭ヨ瘑杈圭晫锛?=========
      const bookForBoundary = selectedBooks?.[0];
      if (bookForBoundary && content.length > 100) {
        const rawSubj = bookForBoundary?.subject || '';
        const stg = bookForBoundary?.stage || '';
        const grd = bookForBoundary?.grade || '';
        const subj = normalizeSubjectName(rawSubj, stg);
        
        const boundaryCheck = checkKnowledgeBoundary(content, subj, stg, grd);
        
        if (boundaryCheck.hasViolations) {
          boundaryCheck.violations.forEach(v => {
            const prefix = v.severity === 'error' ? '鉂? : '鈿狅笍';
            issues.push(`${prefix} 瓒呯翰妫€娴嬶細${v.message}`);
          });
          
          if (boundaryCheck.summary.errorCount > 0) {
            qualityReport.knowledgeCheck.passed = false;
            qualityReport.knowledgeCheck.details.push(
              `瓒呯翰妫€娴嬪彂鐜?{boundaryCheck.summary.errorCount}澶勬槑纭秴绾瞏
            );
          }
        }
        
        // 妯＄硦杈圭晫鏍囪涓烘彁绀?
        if (boundaryCheck.fuzzyItems.length > 0) {
          const fuzzyWarnings = boundaryCheck.fuzzyItems.filter(f => f.severity === 'warning');
          if (fuzzyWarnings.length > 0) {
            qualityReport.knowledgeCheck.details.push(
              `杈圭晫妯＄硦妫€娴嬶細${fuzzyWarnings.map(f => `"${f.topic}"(${f.limit})`).join('锛?)}`
            );
          }
        }
        
        console.log('馃搵 瓒呯翰妫€娴嬪畬鎴?', boundaryCheck.summary);
      }

      progress.value = 90;

      // ========== 绗簩绾э細AI绉戝鎬у拰鐭ヨ瘑鐐瑰鏌?鉁ㄦ柊澧?==========
      if (content.length > 100 && parsedBlueprint.length > 0) {
        const reviewConfig = await getCurrentEngineConfigEnhanced('review');
        const reviewModelName = getModelDisplayName(reviewConfig.textModel || reviewConfig.model);
        statusText.value = `姝ラ 5/5锛欰I瀹℃煡 [${reviewModelName}]...`;
        
        try {
          const reviewPrompt = `浣犳槸鏁欒偛璐ㄩ噺瀹℃煡涓撳銆傝瀹℃煡浠ヤ笅璇曞嵎鍐呭锛?

銆愬懡棰樿摑鍥俱€?
${parsedBlueprint.map(q => `棰?{q.number}锛?{q.type}锛岀煡璇嗙偣=${q.knowledgePoint}锛岄毦搴?${q.difficulty}锛屽垎鍊?${q.score}`).join('\n')}

銆愮敓鎴愬唴瀹瑰墠1500瀛椼€?
${(() => {
  if (content.length <= 2000) return content;
  const head = content.substring(0, 1000);
  const tail = content.substring(Math.max(0, content.length - 1000));
  return head + '\n...(涓棿閮ㄥ垎宸茬渷鐣ワ紝鍏? + content.length + '瀛?...\n' + tail;
})()}

璇锋鏌ュ苟杩斿洖JSON锛?
{
  "scienceIssues": ["绉戝鎬ч敊璇?", "绉戝鎬ч敊璇?"],
  "knowledgeMatchIssues": ["棰榅鏍囨敞鐭ヨ瘑鐐筜浣嗗疄闄呰€冩煡Z"],
  "difficultyMatchIssues": ["棰榅鏍囨敞闅惧害鍩虹浣嗗疄闄呭亸闅?],
  "optionQualityIssues": ["棰榅閫夐」鏃犲尯鍒嗗害"],
  "overallScore": 8,
  "suggestions": ["鏀硅繘寤鸿1"]
}

鍙繑鍥濲SON銆俙;

          const reviewResult = await callAI(reviewPrompt, { 
            taskType: 'review',        // 鉁?瀹℃煡浠诲姟鐢ㄩ噸鍨嬫ā鍨嬩綆娓?
            temperature: 0.1, 
            timeout: 60000 
          });
          try {
            const review = await robustJsonParse(reviewResult, null, 'AI璐ㄩ噺瀹℃煡');
            
            if (review.scienceIssues?.length > 0) {
              review.scienceIssues.forEach(s => issues.push(`馃敩 ${s}`));
              qualityReport.aiReview.details.push(...review.scienceIssues);
            }
            if (review.knowledgeMatchIssues?.length > 0) {
              review.knowledgeMatchIssues.forEach(k => issues.push(`馃摎 ${k}`));
              qualityReport.knowledgeCheck.details.push(...review.knowledgeMatchIssues);
            }
            if (review.difficultyMatchIssues?.length > 0) {
              review.difficultyMatchIssues.forEach(d => issues.push(`馃搹 ${d}`));
              qualityReport.difficultyCheck.details.push(...review.difficultyMatchIssues);
            }
            if (review.overallScore < 6) {
              qualityReport.aiReview.passed = false;
              issues.push(`鈿狅笍 AI缁煎悎璇勫垎鍋忎綆(${review.overallScore}/10)`);
            }
            qualityReport.aiReview.details.push(`缁煎悎璇勫垎: ${review.overallScore}/10`);
            if (review.suggestions?.length > 0) {
              qualityReport.aiReview.details.push(`寤鸿: ${review.suggestions.join('锛?)}`);
            }
          } catch {
            // AI瀹℃煡澶辫触涓嶉樆濉炴祦绋?
            qualityReport.aiReview.details.push('AI瀹℃煡璺宠繃锛堣В鏋愬け璐ワ級');
          }
        } catch (e) {
          console.warn('AI璐ㄩ噺瀹℃煡澶辫触:', e.message);
          qualityReport.aiReview.details.push('AI瀹℃煡璺宠繃锛堣皟鐢ㄥけ璐ワ級');
        }
      }

      // ========== 馃敡 鏂板锛氶€愰妯℃澘瀵规爣妫€鏌?==========
      const tplStructureCheck = selectedTemplates[0]?.analysis?.缁撴瀯鍒嗘瀽 || selectedTemplates[0]?.analysis?.structure || [];
      if (selectedTemplates?.length > 0 && tplStructureCheck.length > 0) {
        statusText.value = '閫愰妯℃澘瀵规爣妫€鏌?..';
        
        try {
          const templateCards = selectedTemplates[0].analysis.questionCards;
          const templateStemLengths = templateCards.filter(c => c.stem).map(c => c.stem.length);
          const templateAvgStem = templateStemLengths.length > 0 
            ? Math.round(templateStemLengths.reduce((a, b) => a + b, 0) / templateStemLengths.length) 
            : 35;
          
          // 鎻愬彇姣忛棰樺共
          const generatedStems = content.match(/<p class="question"[^>]*>([\s\S]*?)<\/p>/g) || [];
          
          for (let i = 0; i < Math.min(generatedStems.length, parsedBlueprint.length); i++) {
            const stemText = generatedStems[i].replace(/<[^>]+>/g, '').trim();
            const plan = parsedBlueprint[i];
            if (!plan) continue;
            
            // 妫€鏌ラ骞查暱搴﹀亸宸?
            const stemLen = stemText.length;
            if (stemLen > templateAvgStem * 2 && stemLen > 80) {
              issues.push(`鈿狅笍 棰?{plan.number}棰樺共杩囬暱(${stemLen}瀛?锛屾ā鏉垮钩鍧?{templateAvgStem}瀛梎);
            }
            if (stemLen < 10) {
              issues.push(`鈿狅笍 棰?{plan.number}棰樺共杩囩煭(${stemLen}瀛?`);
            }
            
            // 妫€鏌ョ姝㈠彞寮?
            const bannedPatterns = [
              '涓嬪垪璇存硶姝ｇ‘鐨勬槸', '浠ヤ笅鍝釜閫夐」鏄纭殑',
              '浠ヤ笂閮芥槸', '浠ヤ笂閮戒笉瀵?, '涓嬪垪閫夐」涓敊璇殑鏄?
            ];
            for (const pattern of bannedPatterns) {
              if (stemText.includes(pattern)) {
                issues.push(`鈿狅笍 棰?{plan.number}浣跨敤浜嗙姝㈠彞寮忥細"${pattern}"`);
                break;
              }
            }
            
            // 妫€鏌ラ€夋嫨棰橀€夐」鏁?
            if (plan.type === '閫夋嫨棰?) {
              const optionCount = (generatedStems[i + 1]?.match(/<p class="option"/g) || []).length;
              const templateAvgOptions = 4;
              if (optionCount > 0 && optionCount !== templateAvgOptions) {
                issues.push(`鈿狅笍 棰?{plan.number}閫夐」鏁?{optionCount}涓紝妯℃澘閫氬父${templateAvgOptions}涓猔);
              }
            }
          }
        } catch (e) {
          console.warn('閫愰妯℃澘瀵规爣妫€鏌ュけ璐?', e.message);
        }
      }      

      // ========== 绗笁绾э細钃濆浘vs鐢熸垚鐨勭粨鏋勫寲瀵规瘮 鉁ㄦ柊澧?==========
      if (parsedBlueprint.length > 0) {
        qualityReport.coverageCheck.details.push(`钃濆浘瑙勫垝${parsedBlueprint.length}棰橈紝瀹為檯鐢熸垚${questionCount}棰榒);
        
        // 棰樺瀷瀵规瘮
        const blueprintTypes = [...new Set(parsedBlueprint.map(q => q.type))];
        const generatedTypes = [...new Set(
          (content.match(/<p class="question"[^>]*>([^<]*?)<\/p>/g) || [])
            .map(m => m.replace(/<[^>]+>/g, '').substring(0, 5))
        )];
        qualityReport.templateMatch.details.push(`钃濆浘棰樺瀷: ${blueprintTypes.join('銆?)}锛岀敓鎴愭娴嬪埌${questionCount}棰榒);

        // 闅惧害鍒嗗竷瀵规瘮
        const difficultyCounts = { '鍩虹': 0, '涓瓑': 0, '杈冮毦': 0 };
        parsedBlueprint.forEach(q => {
          if (difficultyCounts.hasOwnProperty(q.difficulty)) difficultyCounts[q.difficulty]++;
        });
        const total = parsedBlueprint.length || 1;
        qualityReport.difficultyCheck.details.push(
          `瑙勫垝锛氬熀纭€${Math.round(difficultyCounts['鍩虹']/total*100)}% 涓瓑${Math.round(difficultyCounts['涓瓑']/total*100)}% 杈冮毦${Math.round(difficultyCounts['杈冮毦']/total*100)}%`
        );

        // 鉁?鏁欐潗鐭ヨ瘑鐐硅鐩栫巼鏍￠獙锛堜娇鐢ㄩ《灞傚畾涔夛級
        const coverageResult = checkKnowledgeCoverage(parsedBlueprint, knowledgeMap);
        qualityReport.coverageCheck.details.push(
          `鐭ヨ瘑鐐硅鐩栵細${coverageResult.covered}/${coverageResult.total}锛?{coverageResult.rate}%锛塦
        );
        // 鎸夎祫鏂欑被鍨嬭瀹氫笉鍚岄槇鍊?
        const rateThreshold = genType === 'exam' ? 90 : (genType === 'practice' ? 80 : 70);
        if (coverageResult.rate < rateThreshold) {
          issues.push(`鈿狅笍 鐭ヨ瘑鐐硅鐩栫巼鍋忎綆锛?{coverageResult.rate}%锛岀洰鏍?{rateThreshold}%锛夛紝鏈鐩栵細${coverageResult.uncovered.slice(0, 5).join('銆?)}${coverageResult.uncovered.length > 5 ? '绛? + coverageResult.uncovered.length + '涓? : ''}`);
          qualityReport.coverageCheck.passed = false;
        }
        if (coverageResult.duplicatedKPs && coverageResult.duplicatedKPs.length > 0) {
          issues.push(`鈿狅笍 浠ヤ笅鐭ヨ瘑鐐归噸澶嶈€冩煡瓒呰繃2娆★細${coverageResult.duplicatedKPs.slice(0, 3).join('銆?)}`);
          qualityReport.coverageCheck.details.push(`閲嶅鐭ヨ瘑鐐癸細${coverageResult.duplicatedKPs.join('銆?)}`);
        }

        // 馃敡 鏂板锛氶噸闅剧偣鍔犳潈瑕嗙洊鐜?
        if (coverageResult.keyDifficultyCoverage) {
          const kdc = coverageResult.keyDifficultyCoverage;
          qualityReport.coverageCheck.details.push(
            `閲嶉毦鐐硅鐩栵細${kdc.covered}/${kdc.total}锛?{kdc.rate}%锛塦
          );
          if (kdc.rate < 100) {
            issues.push(`鈿狅笍 閲嶉毦鐐规湭瀹屽叏瑕嗙洊锛岀己澶憋細${kdc.uncovered.join('銆?)}`);
            qualityReport.coverageCheck.passed = false;
          }
        }
      }

      // 鉁?5.7锛氭ā鏉垮鏍囬噺鍖栵紙鏂板锛?
      if (selectedTemplates?.length > 0 && selectedTemplates[0]?.analysis?.questionCards?.length > 0) {
        const templateCards = selectedTemplates[0].analysis.questionCards;
        
        // 棰樺瀷鍒嗗竷瀵规瘮
        const templateTypeDist = {};
        const generatedTypeDist = {};
        templateCards.forEach(c => templateTypeDist[c.type] = (templateTypeDist[c.type] || 0) + 1);
        parsedBlueprint.forEach(q => generatedTypeDist[q.type] = (generatedTypeDist[q.type] || 0) + 1);
        
        // 璁＄畻棰樺瀷鍒嗗竷鐩镐技搴?
        const allTypes = [...new Set([...Object.keys(templateTypeDist), ...Object.keys(generatedTypeDist)])];
        let matchScore = 0;
        allTypes.forEach(t => {
          const tCount = templateTypeDist[t] || 0;
          const gCount = generatedTypeDist[t] || 0;
          if (tCount > 0 && gCount > 0) matchScore++;
        });
        const typeMatchRate = allTypes.length > 0 ? Math.round(matchScore / allTypes.length * 100) : 100;
        
        qualityReport.templateMatch.details.push(
          `棰樺瀷鍖归厤搴? ${typeMatchRate}%锛?{matchScore}/${allTypes.length}绫婚鍨嬶級`
        );
        
        // 馃敡 鏂板锛氶骞查暱搴﹀垎甯冨姣?
        const templateStemLengths = templateCards.filter(c => c.stem).map(c => c.stem.length);
        const generatedStemTexts = content.match(/<p class="question"[^>]*>([^<]*)<\/p>/g) || [];
        const generatedStemLengths = generatedStemTexts.map(s => s.replace(/<[^>]+>/g, '').length);
        
        if (templateStemLengths.length > 0 && generatedStemLengths.length > 0) {
          const templateAvgStem = Math.round(templateStemLengths.reduce((a, b) => a + b, 0) / templateStemLengths.length);
          const generatedAvgStem = Math.round(generatedStemLengths.reduce((a, b) => a + b, 0) / generatedStemLengths.length);
          const stemDeviation = Math.abs(generatedAvgStem - templateAvgStem);
          
          qualityReport.templateMatch.details.push(
            `妯℃澘棰樺共骞冲潎${templateAvgStem}瀛楋紝鐢熸垚棰樺共骞冲潎${generatedAvgStem}瀛楋紝鍋忓樊${stemDeviation}瀛梎
          );
          
          if (stemDeviation > templateAvgStem * 0.5) {
            issues.push(`鈿狅笍 棰樺共闀垮害涓庢ā鏉垮亸宸緝澶э紙妯℃澘${templateAvgStem}瀛?vs 鐢熸垚${generatedAvgStem}瀛楋級`);
          }
        }
        
        // 鎬诲垎瀵规瘮
        const templateTotalScore = templateCards.reduce((sum, c) => sum + (c.score || 0), 0);
        const generatedTotalScore = parsedBlueprint.reduce((sum, q) => sum + (q.score || 0), 0);
        if (templateTotalScore > 0) {
          const scoreDeviation = Math.abs(generatedTotalScore - templateTotalScore);
          qualityReport.templateMatch.details.push(
            `妯℃澘鎬诲垎${templateTotalScore}锛岀敓鎴愭€诲垎${generatedTotalScore}锛屽亸宸?{scoreDeviation}鍒哷
          );
          if (scoreDeviation > 10) {
            issues.push(`鈿狅笍 鎬诲垎涓庢ā鏉垮亸宸?{scoreDeviation}鍒哷);
          }
        }
        
        // 棰橀噺瀵规瘮
        qualityReport.templateMatch.details.push(
          `妯℃澘${templateCards.length}棰橈紝鐢熸垚${parsedBlueprint.length}棰榒
        );
      }

      // ========== 馃敡 鏂板锛氭湳璇粺涓€鍚庡鐞?==========
      if (book && book.subject) {
        const rawSubj = book?.subject || '';
        const stg = book?.stage || '';
        const subj = normalizeSubjectName(rawSubj, stg);
        const terminologyResult = normalizeTerminology(content, subj);
        
        if (terminologyResult.fixes.length > 0) {
          content = terminologyResult.normalized;
          console.log(`馃摑 鏈缁熶竴瀹屾垚锛?{terminologyResult.fixes.map(f => `"${f.original}"鈫?${f.corrected}"(${f.count}澶?`).join('锛?)}`);
          qualityReport.formatCheck.details.push(
            `鏈缁熶竴锛?{terminologyResult.fixes.length}绉嶆湳璇鏍囧噯鍖朻
          );
        }
      }

      // ========== 鑷姩淇寰幆锛堟渶澶?娆★級 ==========
      let finalContent = content;
      let finalIssues = issues;
      let finalQualityReport = qualityReport;
      
      const hasQualityIssue = !qualityReport.formatCheck.passed 
        || !qualityReport.coverageCheck.passed 
        || (qualityReport.aiReview && !qualityReport.aiReview.passed);
      
      if (hasQualityIssue && issues.length > 0) {
        statusText.value = '璐ㄩ噺鏈揪鏍囷紝姝ｅ湪鑷姩淇...';
        progress.value = 92;
        
        try {
          // 馃敡 淇锛氱瓫閫夊嚭"鍙慨澶?鐨勯棶棰橈紙鎺掗櫎瓒呯翰妫€娴嬬瓑鏃犳硶鑷姩淇鐨勶級
          const fixableIssues = issues.filter(i => 
            !i.includes('瓒呯翰妫€娴?) && 
            !i.includes('AI缁煎悎璇勫垎鍋忎綆')
          );
          const unfixableIssues = issues.filter(i => 
            i.includes('瓒呯翰妫€娴?) || 
            i.includes('AI缁煎悎璇勫垎鍋忎綆')
          );
          
          const fixPrompt = `浠ヤ笅鏄竴浠藉凡鐢熸垚鐨勬暀杈呰祫鏂欙紝浣嗗瓨鍦ㄨ川閲忛棶棰橀渶瑕佷慨澶嶃€?

銆愬繀椤讳慨澶嶇殑闂銆?
${fixableIssues.length > 0 ? fixableIssues.join('\n') : '锛堟棤闈炶嚜鍔ㄤ慨澶嶇殑涓ラ噸闂锛?}

${unfixableIssues.length > 0 ? '銆愰渶浜哄伐鏍告煡鐨勯棶棰樷€斺€斾互涓嬮棶棰樻棤娉曡嚜鍔ㄤ慨澶嶏紝璇峰湪淇鍚庢墜鍔ㄦ鏌ャ€慭n' + unfixableIssues.join('\n') : ''}

銆愬師鍐呭銆?
${content.substring(0, 5000)}

銆愪慨澶嶈姹傘€?
1. 淇鎵€鏈夋寚鍑虹殑闂
2. 淇濇寔鍘熸湁棰樺瀷缁撴瀯鍜屽垎鍊煎垎甯?
3. 淇濇寔 HTML 鏍煎紡杈撳嚭
4. 鐩存帴杩斿洖淇鍚庣殑瀹屾暣鍐呭锛屼笉瑕佺敤浠ｇ爜鍧楀寘瑁?
5. 鍙慨鏀规湁闂鐨勯儴鍒嗭紝涓嶈鏀瑰姩鍏朵粬鍐呭`;

          const fixedContent = await callAI(fixPrompt, {
            taskType: 'review',
            temperature: 0.2,
            timeout: 120000
          });
          
          if (fixedContent && fixedContent.length > content.length * 0.5) {
            // 馃敡 鏂板锛氫慨澶嶅悗楠岃瘉
            statusText.value = '楠岃瘉淇缁撴灉...';
            progress.value = 95;
            
            // 閲嶆柊杩愯纭€ц鍒欐鏌?
            const reHardIssues = HardRuleChecker.check(
              fixedContent, 
              parsedBlueprint, 
              selectedBooks?.[0]?.subject || '', 
              selectedBooks?.[0]?.stage || '', 
              selectedBooks?.[0]?.grade || ''
            );
            const reSummary = HardRuleChecker.getIssueSummary(reHardIssues);
            
            // 妫€鏌ヤ慨澶嶅悗鏄惁杩樻湁鏍煎紡闂
            const stillHasHtmlIssue = !fixedContent.includes('<p') && !fixedContent.includes('<div');
            const stillHasAnswerIssue = !fixedContent.includes('answer-section');
            
            // 濡傛灉閲嶅ぇ闂宸蹭慨澶嶏紝閲囩敤淇鍚庣殑鍐呭
            if (!reSummary.hasErrors && !stillHasHtmlIssue) {
              finalContent = fixedContent;
              finalIssues = reSummary.hasWarnings 
                ? reHardIssues.filter(i => i.severity === 'warning').map(i => `鈿狅笍 ${i.detail}`)
                : null;
              finalQualityReport = {
                ...qualityReport,
                formatCheck: { passed: !stillHasHtmlIssue, details: stillHasHtmlIssue ? ['淇鍚庝粛缂哄皯HTML鏍囩'] : ['宸茶嚜鍔ㄤ慨澶?] },
                coverageCheck: { passed: true, details: ['宸茶嚜鍔ㄤ慨澶?] },
                aiReview: { 
                  passed: !reSummary.hasWarnings, 
                  details: reSummary.hasWarnings 
                    ? [`淇鍚庝粛鏈?{reSummary.warnings}涓鍛婏細${reHardIssues.filter(i => i.severity === 'warning').map(i => i.detail).join('锛?)}`]
                    : ['宸茶嚜鍔ㄤ慨澶?] 
                }
              };
              statusText.value = reSummary.hasWarnings ? '淇瀹屾垚锛堟湁杞诲井璀﹀憡锛? : '淇瀹屾垚';
            } else {
              // 淇涓嶅厖鍒嗭紝淇濈暀鍘熷唴瀹逛絾鏍囪闂
              finalContent = fixedContent; // 浠嶇劧鐢ㄤ慨澶嶅悗鐨勶紙姣斿師鐗堝ソ锛?
              finalIssues = [
                ...(reSummary.hasErrors ? [`鈿狅笍 鑷姩淇鍚庝粛鏈?{reSummary.errors}涓敊璇紝璇锋墜鍔ㄦ鏌] : []),
                ...(reSummary.hasWarnings ? [`鈿狅笍 鑷姩淇鍚庝粛鏈?{reSummary.warnings}涓鍛奰] : []),
                ...(stillHasHtmlIssue ? ['鈿狅笍 淇鍚庢牸寮忎粛涓嶅畬鏁?] : []),
                ...(stillHasAnswerIssue ? ['鈿狅笍 淇鍚庝粛缂哄皯绛旀鍖哄煙'] : [])
              ];
              statusText.value = '淇涓嶅畬鏁达紝璇锋墜鍔ㄦ鏌?;
            }
          } else {
            statusText.value = '鑷姩淇杩斿洖鍐呭寮傚父锛岃鎵嬪姩妫€鏌?;
          }
        } catch (e) {
          console.warn('鑷姩淇澶辫触:', e.message);
          statusText.value = '鑷姩淇澶辫触锛岃鎵嬪姩妫€鏌?;
        }
      }
      
      progress.value = 100;
      
      // 馃敡 鏂板锛氱敓鎴愯川閲忔憳瑕侊紝鏄剧ず鍦ㄧ姸鎬佹爮
      let summaryParts = ['鐢熸垚瀹屾垚'];
      if (finalQualityReport.aiReview?.details?.length) {
        const scoreDetail = finalQualityReport.aiReview.details.find(d => d.includes('缁煎悎璇勫垎'));
        if (scoreDetail) summaryParts.push(`AI璇勫垎${scoreDetail.replace('缁煎悎璇勫垎: ', '')}`);
      }
      if (finalQualityReport.coverageCheck?.details?.length) {
        const covDetail = finalQualityReport.coverageCheck.details.find(d => d.includes('鐭ヨ瘑鐐硅鐩?));
        if (covDetail) summaryParts.push(covDetail);
      }
      if (finalQualityReport.knowledgeCheck?.details?.length) {
        const kpDetail = finalQualityReport.knowledgeCheck.details.find(d => d.includes('瓒呯翰'));
        if (kpDetail) summaryParts.push(`鈿狅笍瓒呯翰妫€娴媊);
      }
      if (finalIssues && finalIssues.length > 0) {
        const errorCount = finalIssues.filter(i => i.startsWith('鉂?)).length;
        const warnCount = finalIssues.filter(i => i.startsWith('鈿狅笍')).length;
        if (errorCount > 0) summaryParts.push(`鉂?{errorCount}涓敊璇痐);
        if (warnCount > 0) summaryParts.push(`鈿狅笍${warnCount}涓鍛奰);
      } else {
        summaryParts.push('鉁呮棤闂');
      }
      statusText.value = summaryParts.join(' | ');

      // 鉁?杩斿洖澧炲己鐨勬牎楠岀粨鏋?
      return { 
        success: true, 
        content: finalContent,
        blueprint,
        contentCards,
        knowledgeMap,
        issues: finalIssues,
        qualityReport: finalQualityReport,
        generatedQuestions,
        parsedBlueprint
      };

    } catch (error) {
      console.error('鐢熸垚澶辫触:', error);
      if (retryCount < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        return generate(instruction, genType, selectedBooks, selectedTemplates, retryCount + 1);
      }
      return { success: false, error: error.message, retried: retryCount > 0 };
    } finally {
      if (retryCount === 0) {
        isGenerating.value = false;
      }
    }
  };

  // ==================== 鐭ヨ瘑鐐规€荤粨鐢熸垚锛堜袱姝ユ祦绋嬶級 ====================
  const generateSummary = async (instruction, genType, selectedBooks, selectedTemplates, blueprintOnly = false) => {
    const sumConfig1 = await getCurrentEngineConfigEnhanced('analysis');
    const sumModel1 = getModelDisplayName(sumConfig1.textModel || sumConfig1.model);
    statusText.value = `鏋勫缓鐭ヨ瘑鍥捐氨 [${sumModel1}]...`;
    progress.value = 10;
    
    // 馃敡 鏀硅繘锛氬鐢?extractContentCards 鍜?buildKnowledgeMap
    const contentCards = await extractContentCards(
      selectedBooks, 
      callAI, 
      robustJsonParse,
      (text, prog) => { statusText.value = text; progress.value = prog; }
    );
    
    const knowledgeMap = await buildKnowledgeMap(
      contentCards, 
      selectedBooks, 
      callAI, 
      robustJsonParse,
      (text, prog) => { statusText.value = text; progress.value = prog; }
    );
    
    // 馃敡 浠?contentCards 涓彁鍙栧叧閿師鏂囨钀?
    let textbookContext = '';
    const allSegments = [];
    for (const card of contentCards) {
      if (card.segments) {
        for (const seg of card.segments) {
          allSegments.push({
            chapterTitle: card.chapterTitle,
            text: seg.text,
            isKey: seg.isKeyConcept
          });
        }
      }
    }
    allSegments.sort((a, b) => (b.isKey ? 1 : 0) - (a.isKey ? 1 : 0));
    let totalLength = 0;
    const selectedForPrompt = [];
    for (const seg of allSegments) {
      if (totalLength + seg.text.length > 3000) break;
      selectedForPrompt.push(seg);
      totalLength += seg.text.length;
    }
    textbookContext = selectedForPrompt.map(s => `銆?{s.chapterTitle}銆?{s.text}`).join('\n\n');

    // 鏀堕泦妯℃澘鍘熸枃
    let templateRawText = '';
    if (selectedTemplates && selectedTemplates.length > 0) {
      const tpl = selectedTemplates[0];
      const tplText = tpl.analysis?.rawText || '';
      if (tplText) {
        templateRawText = tplText.substring(0, 2000);
      }
    }
    
    // 馃敡 浠庣煡璇嗗浘璋辨瀯寤虹煡璇嗙粨鏋勬枃鏈?
    let knowledgeGraphText = '';
    if (knowledgeMap.knowledgeGraph?.length > 0) {
      knowledgeGraphText = knowledgeMap.knowledgeGraph.map(unit => {
        let text = `馃搶 鍗曞厓锛?{unit.unit || ''}\n`;
        (unit.bigConcepts || []).forEach(bc => {
          text += `  馃搶 ${bc.name}\n`;
          (bc.coreKnowledge || []).forEach(ck => {
            text += `    鈹溾攢 ${ck.name}銆?{ck.cognitiveLevel || '鐞嗚В'}銆慭n`;
            (ck.specificConcepts || []).forEach(sc => {
              text += `    鈹? 鈹斺攢 ${sc}\n`;
            });
          });
        });
        return text;
      }).join('\n');
    } else {
      knowledgeGraphText = (knowledgeMap.knowledgePoints || []).map(kp => `馃搶 ${kp}`).join('\n');
    }
    
    // 鉁?绗竴姝ワ細鏋勫缓鐭ヨ瘑鍥捐氨缁撴瀯
    statusText.value = '姝ラ 1/3锛氬垎鏋愮煡璇嗙粨鏋?..';
    progress.value = 30;

    // 馃敡 blueprintOnly 妯″紡锛氫粎杩斿洖鐭ヨ瘑鍥捐氨钃濆浘
    if (blueprintOnly) {
      progress.value = 50;
      statusText.value = '鐭ヨ瘑鎬荤粨钃濆浘宸茬敓鎴?;
      const bookForBp = selectedBooks?.[0];
      const stageRawBp = bookForBp?.stage || '';
      const gradeBp = bookForBp?.grade || '';
      const rawSubjBp = bookForBp?.subject || '';
      const subjBp = normalizeSubjectName(rawSubjBp, stageRawBp);
      const coreTopic = contentCards?.[0]?.summary || '';
      const blueprintText = [
        `銆愮煡璇嗙偣鎬荤粨钃濆浘銆慲,
        `瀛︾锛?{subjBp}  |  骞寸骇锛?{gradeBp}  |  瀛︽锛?{stageRawBp}`,
        `${coreTopic ? '馃幆 鏍稿績涓婚锛? + coreTopic + '\n' : ''}鐢熸垚缁撴瀯锛氬涔犵洰鏍?鈫?鏍稿績鐭ヨ瘑娓呭崟 鈫?鐭ヨ瘑杈ㄦ瀽涓庢槗閿欐彁绀?鈫?鍏稿瀷渚嬮绮炬瀽 鈫?閲嶉毦鐐规爣娉?鈫?璁板繂鏂规硶`,
        ``,
        `銆愮煡璇嗙粨鏋勩€慲,
        knowledgeGraphText
      ].join('\n');
      isGenerating.value = false;
      return {
        success: true,
        blueprint: blueprintText,
        parsedBlueprint: (() => {
          const kps = (knowledgeMap.knowledgePoints || []).slice(0, 15);
          if (kps.length === 0) {
            const chs = selectedBooks?.[0]?.selectedChapters || [];
            const fallback = chs.map(c => c.title).filter(Boolean).slice(0, 10);
            return fallback.map((t, i) => ({ number: i + 1, type: '鐭ヨ瘑鐐?, knowledgePoint: t, difficulty: '鍩虹', score: 0, sourceChapter: gradeBp }));
          }
          return kps.map((kp, i) => ({ number: i + 1, type: '鐭ヨ瘑鐐?, knowledgePoint: kp, difficulty: '鍩虹', score: 0, sourceChapter: gradeBp }));
        })(),
        contentCards,
        knowledgeMap,
        content: '',
        generatedQuestions: [],
        issues: null,
        qualityReport: null
      };
    }

    // 鉁?绗簩姝ワ細鍒嗗潡鐢熸垚
    statusText.value = '姝ラ 2/3锛氱敓鎴愭€濈淮瀵煎浘...';
    progress.value = 50;
    
    const mindmapPrompt = `浣犳槸涓€浣嶆暀杈呯紪杈戜笓瀹躲€傝鏍规嵁浠ヤ笅鐭ヨ瘑缁撴瀯锛岀敓鎴愪竴浠芥€濈淮瀵煎浘銆?

銆愮煡璇嗙粨鏋勩€?
${knowledgeGraphText}

銆愭牸寮忚姹傘€?
- 鐢?HTML 宓屽鍒楄〃琛ㄧず鎬濈淮瀵煎浘锛堟渶澶?灞傦級
- 鐢?<div class="mindmap"> 鍖呰９
- 澶栧眰鐢?<ul>锛屾瘡涓妭鐐圭敤 <li>
- 閲嶈姒傚康鐢?<strong> 鍔犵矖
- 涓嶅悓灞傜骇鐢ㄤ笉鍚岀缉杩涜〃绀?
- 鐩存帴杩斿洖 HTML 鐗囨锛屼笉瑕佺敤浠ｇ爜鍧楀寘瑁筦;

    let mindmapHtml = '';
    try {
      mindmapHtml = await callAI(mindmapPrompt, { taskType: 'generation', temperature: 0.3, timeout: 60000 });
    } catch (e) {
      console.warn('鎬濈淮瀵煎浘鐢熸垚澶辫触:', e.message);
      mindmapHtml = '<div class="mindmap"><ul><li>鐭ヨ瘑缁撴瀯</li></ul></div>';
    }
    
    // 鉁?绗笁姝ワ細鐢熸垚涓讳綋鍐呭
    statusText.value = '姝ラ 3/3锛氱敓鎴愮煡璇嗚瑙?..';
    progress.value = 65;
    
    // 馃敡 鎻愬彇瀛︾/瀛︽鍙橀噺鍒板嚱鏁颁綔鐢ㄥ煙锛屼緵 prompt 妯℃澘涓?IIFE 鍜?buildOutputFormatBlock 鍏辩敤
    const bookForCtx = selectedBooks?.[0];
    const ctxSubject = normalizeSubjectName(bookForCtx?.subject || '', bookForCtx?.stage || '');
    const ctxStage = bookForCtx?.stage || '';
    
    const summaryPrompt = buildOutputPreamble() +
`\n` +
`鉀?5. 鎵€鏈夌瓟妗堛€佽В鏋愮粺涓€鏀炬枃鏈?<div class="answer-section"> 涓璡n` +
`\n` +
`銆愬弬鑰冭祫鏂欌€斺€斾互涓嬫槸鐢熸垚鎵€闇€鐨勬墍鏈夎儗鏅俊鎭€慭n` +
`${instruction}\n` +
`\n銆愮煡璇嗗浘璋辩粨鏋勩€慭n${knowledgeGraphText}\n` +
`\n銆愭暀鏉愬師鏂囧弬鑰冦€慭n${textbookContext.substring(0, 3000)}\n` +
`${templateRawText ? '銆愭ā鏉块鏍煎弬鑰冦€慭n' + templateRawText.substring(0, 1500) + '\n' : ''}` +
`銆愬凡鐢熸垚鐨勬€濈淮瀵煎浘銆慭n${mindmapHtml}\n` +
`\n銆愮敓鎴愯姹傗€斺€旇鐢熸垚浠ヤ笅鍐呭锛屾瘡涓澘鍧楀繀椤昏緭鍑哄叿浣撳唴瀹癸紝绂佹鍐?鐣?"瑙佹暀鏉?绛夊崰浣嶇銆慭n${(() => {
  // 鍩虹鍥涢儴鍒?
  let sections = `1. <h2>瀛︿範鐩爣</h2>锛氱敤瀛︾敓鑳界悊瑙ｇ殑璇█鍐?-3鏉℃湰璇?鏈崟鍏冨涔犵洰鏍嘰n2. <h2>鏍稿績鐭ヨ瘑娓呭崟</h2>锛氱敤 <table> 鍒楀嚭鏍稿績鐭ヨ瘑鐐癸紝鍖呭惈涓夊垪锛氱煡璇嗙偣 | 鏍稿績鍐呭 | 鑰冩煡鏂瑰紡\n3. <h2>鐭ヨ瘑杈ㄦ瀽涓庢槗閿欐彁绀?/h2>锛氱敤瀵规瘮琛ㄦ牸锛屽乏鍙充袱鍒楀垎鍒垪鍑?甯歌閿欒"鍜?姝ｇ‘鐞嗚В"锛岃嚦灏?缁刓n4. <h2>鍏稿瀷渚嬮绮炬瀽</h2>锛氳嚦灏?閬撲緥棰橈紝姣忛鐢?<div class="example"> 鍖呰９棰樺共锛?div class="analysis"> 鍖呰９瑙ｆ瀽锛堝惈瑙ｉ鎬濊矾+鏄撻敊鎻愮ず锛塦;
  // 瀛︾澧炲己
  if (ctxSubject === '璇枃') {
    sections += `\n5. <h2>鍐欎綔绱犳潗绉疮</h2>锛氫粠璇炬枃涓彁鐐煎ソ璇嶅ソ鍙ワ紝鎸夌被鍒暣鐞嗭紙鍐欐櫙/鍐欎汉/鐘剁墿/鎶掓儏绛夛級`;
  } else if (['鏁板', '鐗╃悊', '鍖栧'].includes(ctxSubject)) {
    sections += `\n5. <h2>鍏紡/瀹氱悊閫熸煡</h2>锛氬垪鍑烘湰绔犳墍鏈夊叕寮忓拰瀹氱悊锛屾爣娉ㄩ€傜敤鏉′欢鍜屽吀鍨嬬敤娉昤;
  } else if (ctxSubject === '鑻辫') {
    // 馃敡 瀛︽鎰熺煡锛氬皬瀛︿晶閲嶈嚜鐒舵嫾璇伙紝鍒濋珮涓晶閲嶅浗闄呴煶鏍?璇皟
    const voiceSection = ctxStage === '灏忓'
        ? `\n5. <h2>璇煶/鍙戦煶瑙勫垯褰掔撼</h2>锛氬綊绾宠嚜鐒舵嫾璇昏寰嬪拰瀛楁瘝缁勫悎鍙戦煶瑙勫垯`
        : `\n5. <h2>璇煶/鍙戦煶瑙勫垯褰掔撼</h2>锛氬綊绾冲浗闄呴煶鏍囥€侀噸闊炽€佽繛璇汇€佽璋冪瓑鍙戦煶瑕佺偣`;
    sections += voiceSection;
    sections += `\n6. <h2>璇嶆眹鍙ュ瀷褰掔撼</h2>锛氭寜璇嶆€у拰璇濋鍒嗙被鏁寸悊璇嶆眹锛屽垪鍑洪噸鐐瑰彞鍨嬪拰璇硶鐐筦;
  } else if (['鐢熺墿', '绉戝'].includes(ctxSubject)) {
    sections += `\n5. <h2>瀹為獙/鎺㈢┒姊崇悊</h2>锛氬垪鍑烘湰绔犵殑瀹為獙鍚嶇О銆佸疄楠屾楠ゃ€佸疄楠岀幇璞″拰缁撹锛堢敤琛ㄦ牸鍛堢幇锛氬疄楠屽悕绉?| 姝ラ | 鐜拌薄 | 缁撹锛塦;
  } else if (['鍘嗗彶', '鍦扮悊'].includes(ctxSubject)) {
    sections += `\n5. <h2>鍥捐〃/鏃堕棿杞存暣鐞?/h2>锛氬巻鍙插绉戞暣鐞嗘椂闂磋酱锛堝叧閿簨浠?鏃堕棿+褰卞搷锛夛紝鍦扮悊瀛︾鏁寸悊鍦板浘/鍥捐〃锛堝尯鍩熺壒寰?鑷劧/浜烘枃瑕佺礌瀵规瘮琛級`;
  } else if (['閬撳痉涓庢硶娌?, '鎬濇兂鏀挎不'].includes(ctxSubject)) {
    sections += `\n5. <h2>妗堜緥鍒嗘瀽褰掔撼</h2>锛氬垪鍑烘暀鏉愪腑鐨勫吀鍨嬫渚嬶紝鐢?妗堜緥鈫掔煡璇嗙偣鈫掑惎绀?鐨勬牸寮忓憟鐜帮紝鑷冲皯2缁刞;
  }
  // 閫氱敤澧炲己
  sections += `\n<br>\n<h2>浜斻€侀噸闅剧偣鏄熺骇鏍囨敞</h2>锛氱敤 <table> 鍒楀嚭鏈珷鎵€鏈夌煡璇嗙偣锛屼笁鍒楋細鐭ヨ瘑鐐?| 闅惧害(鍩虹/閲嶇偣/闅剧偣) | 鏄熺骇涓庤€冪偣璇存槑锛堚瓙锔忎綆棰?猸愶笍猸愶笍涓 猸愶笍猸愶笍猸愶笍楂橀蹇呰€冿紝鑷冲皯鍐欏崐鍙ヨ瘽璇存槑涓轰粈涔堟槸鑰冪偣锛塡n<h2>鍏€佽蹇嗘柟娉?瀛︿範鎶€宸?/h2>锛氱敤 <p> 閫愭潯鍒楀嚭2-3涓蹇嗗彛璇€鎴栧涔犳柟娉曞缓璁紝姣忔潯浠ュ簭鍙?<strong>鏂规硶鍚?/strong>寮€澶碻;
  if (ctxStage === '灏忓') {
    sections += `\n馃摑 <h2>瓒ｅ懗灏忕粌涔?/h2>锛?-3閬撳珐鍥洪锛岀敤娓告垙鍖?鐢熸椿鍖栧舰寮忓憟鐜帮紙棰樼洰鐣欑┖璁╁鐢熷仛锛岀瓟妗堟斁鏂囨湯锛塦;
  }
  return sections;
})()}

銆愭牸寮忚鑼冣€斺€斾互涓嬫瘡鏉″繀椤婚伒瀹堛€?
馃敶 杈撳嚭璇█锛氬繀椤绘槸绾?HTML锛佷弗绂佷娇鐢ㄤ换浣?Markdown/绾枃鏈娉曪紒
   鉂?绂佹 Markdown 鏍囬锛?## 鏂囧瓧 鎴?#### 鏂囧瓧
   鉂?绂佹 Markdown 鍔犵矖锛?*鏂囧瓧**
   鉂?绂佹 Markdown 琛ㄦ牸锛殀 鍒? | 鍒? |
   鉂?绂佹 Markdown 鍒嗛殧绾匡細--- 鎴?***
   鉂?绂佹 Markdown 鍒楄〃锛? 椤圭洰1 鎴?* 椤圭洰1
   鉁?HTML 鏍囬锛?h1>澶ф爣棰?/h1> <h2>灏忚妭</h2> <h3>瀛愭爣棰?/h3>
   鉁?HTML 鍔犵矖锛?strong>鏂囧瓧</strong>
   鉁?HTML 琛ㄦ牸锛?table><tr><th>琛ㄥご</th></tr><tr><td>鍐呭</td></tr></table>
   鉁?HTML 娈佃惤锛?p>鍐呭</p>
   鉁?HTML 鍒嗛殧锛?br> 鎴?<hr>
- 閲嶈鍏紡鐢?<div class="formula"> 鍖呰９
- 鐩存帴杩斿洖瀹屾暣 HTML 浠ｇ爜锛屼笉瑕佺敤 \`\`\`html 鏍囪鍖呰９
- 涓嶈鍖呭惈鎬濈淮瀵煎浘锛堝凡鍗曠嫭鐢熸垚锛?

${buildOutputFormatBlock('summary', ctxSubject, ctxStage, selectedBooks?.[0]?.grade || '')}`;

    try {
      const content = await callAI(summaryPrompt, {
        taskType: 'generation',
        timeout: 180000
      });
      detectSquishedOutput(content, 'summary');
      
      // 鉁?缁勮锛氭€濈淮瀵煎浘 + 涓讳綋鍐呭
      const finalContent = mindmapHtml + '\n\n' + (content || '');
      
      // 馃敡 鍩虹璐ㄩ噺鏍￠獙
      const book = selectedBooks?.[0];
      const stageRaw = book?.stage || '';
      const stageMapLocal = { '灏忓': 'primary', '鍒濅腑': 'middle', '楂樹腑': 'high' };
      const qualityIssues = HardRuleChecker.check(
        finalContent, [], book?.subject || '', 
        stageMapLocal[stageRaw] || stageRaw, book?.grade || ''
      );
      const qualityReport = {
        formatCheck: { passed: finalContent.includes('<table') && finalContent.includes('<h2'),
          details: finalContent.includes('<table') ? [] : ['缂哄皯琛ㄦ牸'] },
        coverageCheck: { passed: true, details: [] },
        knowledgeCheck: { passed: finalContent.length > 500, details: [] },
        aiReview: { passed: qualityIssues.filter(i => i.severity === 'error').length === 0,
          details: qualityIssues.map(i => i.detail) }
      };
      
      progress.value = 100;
      statusText.value = '鐢熸垚瀹屾垚';
      
      return {
        success: true,
        content: finalContent,
        blueprint: '',
        contentCards: [],
        knowledgeMap: {},
        issues: qualityIssues.map(i => i.detail),
        qualityReport,
        generatedQuestions: [],
        parsedBlueprint: []
      };
    } catch (e) {
      console.error('鐭ヨ瘑鐐规€荤粨鐢熸垚澶辫触:', e);
      return { success: false, error: e.message };
    } finally {
      isGenerating.value = false;
    }
  };

  // ==================== 閿欓鏈敓鎴愶紙涓夋娴佺▼锛?====================
  const generateErrorbook = async (instruction, genType, selectedBooks, selectedTemplates, blueprintOnly = false) => {
    // 馃敡 鏀硅繘锛氬鐢?extractContentCards 鍜?buildKnowledgeMap
    const contentCards = await extractContentCards(
      selectedBooks, 
      callAI, 
      robustJsonParse,
      (text, prog) => { statusText.value = text; progress.value = prog; }
    );
    
    const knowledgeMap = await buildKnowledgeMap(
      contentCards, 
      selectedBooks, 
      callAI, 
      robustJsonParse,
      (text, prog) => { statusText.value = text; progress.value = prog; }
    );
    
    // 馃敡 鎻愬彇鏁欐潗鍩烘湰淇℃伅
    const book = selectedBooks?.[0];
    const bookSubject = book?.subject || '';
    const bookStage = book?.stage || '';
    const bookGrade = book?.grade || '';
    
    // 馃敡 浠?contentCards 鍜?knowledgeMap 涓彁鍙栫煡璇嗙偣
    const knowledgePoints = knowledgeMap.knowledgePoints || [];
    const knowledgeHierarchy = knowledgeMap.knowledgeGraph || [];
    
    // 馃敡 绌烘暟鎹娴嬶細鐭ヨ瘑鐐逛负绌烘椂鐨勯檷绾у鐞?
    const kpList = knowledgePoints.length > 0 
      ? [...new Set(knowledgePoints)].slice(0, 15) 
      : [];
    let errorProneKps = [];
    
    if (kpList.length === 0) {
      const bookForKp = selectedBooks?.[0];
      const chapterTitles = (bookForKp?.selectedChapters || []).map(c => c.title).filter(Boolean);
      if (chapterTitles.length === 0) {
        console.warn('鈿狅笍 閿欓鏈細鏃犲彲鐢ㄧ煡璇嗙偣涓旀棤绔犺妭鏍囬锛屾棤娉曠敓鎴?);
        const emptyContent = `<h1>閿欓鏈?/h1><div class="errorbook-info"><p>鈿狅笍 鏈兘鎻愬彇鍒版暀鏉愮煡璇嗙偣锛岃鍏堝鏁欐潗杩涜銆屽垎鏋愭暀鏉愩€嶆搷浣滃悗鍐嶇敓鎴愰敊棰樻湰銆?/p></div>`;
        isGenerating.value = false;
        return {
          success: true, content: emptyContent, blueprint: '', contentCards: [], knowledgeMap: {},
          generatedQuestions: [], parsedBlueprint: [], issues: ['鏃犳硶鐢熸垚锛氭暀鏉愭湭鍒嗘瀽锛岀己灏戠煡璇嗙偣'],
          qualityReport: { formatCheck: { passed: false, details: ['缂哄皯鐭ヨ瘑鐐?] }, coverageCheck: { passed: false, details: [] }, knowledgeCheck: { passed: false, details: ['鏃犲彲鐢ㄧ煡璇嗙偣'] }, aiReview: { passed: false, details: ['璇峰厛鍒嗘瀽鏁欐潗'] } }
        };
      }
      // 馃敡 闄嶇骇锛氱敤绔犺妭鏍囬浠ｆ浛鐭ヨ瘑鐐?
      console.warn('鈿狅笍 閿欓鏈細鏈彁鍙栧埌鐭ヨ瘑鐐癸紝浣跨敤绔犺妭鏍囬浣滀负闄嶇骇');
      errorProneKps = chapterTitles.slice(0, 6).map(title => ({
        knowledgePoint: title,
        errorType: '姒傚康娣锋穯',
        typicalError: '瀵硅绔犺妭鏍稿績姒傚康鐞嗚В涓嶆竻鏅?,
        rootCause: '鍩虹鐭ヨ瘑鎺屾彙涓嶇墷鍥?,
        frequency: '涓'
      }));
    }
    
    // 馃敡 blueprintOnly 妯″紡锛氫粎杩斿洖鏄撻敊鐭ヨ瘑鐐瑰垎鏋愯摑鍥?
    if (blueprintOnly) {
      progress.value = 50;
      statusText.value = '閿欓鏈摑鍥惧凡鐢熸垚';
      const displayKps = kpList.length > 0 ? kpList : (book?.selectedChapters || []).map(c => c.title).filter(Boolean).slice(0, 10);
      const blueprintText = [
        `銆愰敊棰樻湰钃濆浘銆慲,
        `瀛︾锛?{bookSubject}  |  骞寸骇锛?{bookGrade}  |  瀛︽锛?{bookStage}`,
        `鍊欓€夋槗閿欑煡璇嗙偣锛?{displayKps.length}涓級锛?{displayKps.join('銆?)}`,
        `棰勮鐢熸垚锛?{Math.min(displayKps.length, 8)}閬撻敊棰樺垎鏋愶紙鍚吀鍨嬮敊棰?閿欒鍒嗘瀽+姝ｇ‘瑙ｆ硶+鍙樺紡宸╁浐锛塦
      ].join('\n');
      isGenerating.value = false;
      return {
        success: true, blueprint: blueprintText,
        parsedBlueprint: displayKps.slice(0, 8).map((kp, i) => ({ number: i + 1, type: '閿欓鍒嗘瀽', knowledgePoint: kp, difficulty: '涓瓑', score: 10, sourceChapter: bookGrade })),
        contentCards, knowledgeMap, content: '', generatedQuestions: [], issues: null, qualityReport: null
      };
    }
    
    // 馃敡 浠?contentCards 鍜?knowledgeMap 涓彁鍙栫煡璇嗙偣锛堝師閫昏緫鈥斺€旀敞鎰?kpList 宸插湪涓婇潰瀹氫箟锛?
    
    // 馃敡 浠?contentCards 涓彁鍙栧叧閿師鏂囨钀?
    let textbookContext = '';
    const allSegments = [];
    for (const card of contentCards) {
      if (card.segments) {
        for (const seg of card.segments) {
          allSegments.push({
            chapterTitle: card.chapterTitle,
            text: seg.text,
            isKey: seg.isKeyConcept,
            isExample: seg.isExample
          });
        }
      }
    }
    allSegments.sort((a, b) => (b.isKey ? 1 : 0) - (a.isKey ? 1 : 0));
    let totalLength = 0;
    const selectedForPrompt = [];
    for (const seg of allSegments) {
      if (totalLength + seg.text.length > 3000) break;
      selectedForPrompt.push(seg);
      totalLength += seg.text.length;
    }
    textbookContext = selectedForPrompt.map(s => `銆?{s.chapterTitle}銆?{s.text}`).join('\n\n');
    
    // 鏀堕泦妯℃澘鍘熸枃
    let templateRawText = '';
    if (selectedTemplates && selectedTemplates.length > 0) {
      const tpl = selectedTemplates[0];
      const tplText = tpl.analysis?.rawText || '';
      if (tplText) {
        templateRawText = tplText.substring(0, 2000);
      }
    }
    
    // 鉁?绗竴姝ワ細璇嗗埆楂橀鏄撻敊鐭ヨ瘑鐐?
    statusText.value = '姝ラ 1/3锛氳瘑鍒槗閿欑煡璇嗙偣...';
    progress.value = 25;
    
    // 馃敡 kpList 鍜?errorProneKps 宸插湪涓婇潰瀹氫箟锛屾澶勫鐢?
    
    if (kpList.length > 0) {
      try {
        const analyzePrompt = `浣犳槸涓€浣嶆暀瀛︾粡楠屼赴瀵岀殑瀛︾鑰佸笀銆傝浠庝互涓嬬煡璇嗙偣涓紝璇嗗埆鍑哄鐢熸渶瀹规槗鍑洪敊鐨?-8涓煡璇嗙偣锛屽苟鍒嗘瀽閿欒绫诲瀷銆?

銆愮煡璇嗙偣鍒楄〃銆?
${kpList.join('銆?)}

銆愭暀鏉愬唴瀹瑰弬鑰冦€?
${textbookContext.substring(0, 1500)}

璇峰垎鏋愭瘡涓槗閿欑煡璇嗙偣锛?
1. 鍏稿瀷閿欒琛ㄧ幇锛堝鐢熷父鐘殑鍏蜂綋閿欒锛?
2. 閿欒绫诲瀷锛堟蹇垫贩娣?/ 璁＄畻澶辫 / 瀹￠涓嶆竻 / 鏂规硶涓嶅綋 / 鐭ヨ瘑閬楁紡锛?
3. 閿欒鏍瑰洜锛堜负浠€涔堝鐢熶細鐘繖涓敊璇級
4. 鑰冩煡棰戠巼锛堥珮棰?/ 涓 / 浣庨锛?

杩斿洖 JSON 鏁扮粍锛?
[
  {
    "knowledgePoint": "鐭ヨ瘑鐐瑰悕绉?,
    "errorType": "姒傚康娣锋穯",
    "typicalError": "瀛︾敓鐨勫吀鍨嬮敊璇弿杩?,
    "rootCause": "閿欒鏍瑰洜鍒嗘瀽",
    "frequency": "楂橀"
  }
]

鍙繑鍥?JSON 鏁扮粍銆俙;

        const analyzeResult = await callAI(analyzePrompt, { 
          taskType: 'analysis', 
          temperature: 0.2, 
          timeout: 60000 
        });
        try {
          errorProneKps = await robustJsonParse(analyzeResult, null, '鏄撻敊鐭ヨ瘑鐐瑰垎鏋?);
          console.log(`鉁?璇嗗埆鍑?${errorProneKps.length} 涓槗閿欑煡璇嗙偣`);
        } catch {
          errorProneKps = kpList.slice(0, 6).map(kp => ({
            knowledgePoint: kp,
            errorType: '姒傚康娣锋穯',
            typicalError: '瀵规蹇电悊瑙ｄ笉娓呮櫚',
            rootCause: '鍩虹鐭ヨ瘑涓嶆墡瀹?,
            frequency: '涓'
          }));
        }
      } catch (e) {
        console.warn('鏄撻敊鍒嗘瀽澶辫触:', e.message);
        errorProneKps = kpList.slice(0, 6).map(kp => ({
          knowledgePoint: kp,
          errorType: '姒傚康娣锋穯',
          typicalError: '鐞嗚В鍋忓樊',
          rootCause: '鍩虹涓嶇墷',
          frequency: '涓'
        }));
      }
    }
    
    // 鉁?绗簩姝ワ細鏋勫缓鐭ヨ瘑鍏宠仈鍥撅紙鐢ㄤ簬鍙樺紡棰樻帹鑽愶級
    statusText.value = '姝ラ 2/3锛氭瀯寤虹煡璇嗗叧鑱?..';
    progress.value = 45;
    
    let knowledgeLinks = [];
    if (errorProneKps.length > 1) {
      try {
        const linkPrompt = `璇峰垎鏋愪互涓嬫槗閿欑煡璇嗙偣涔嬮棿鐨勫叧鑱斿叧绯伙紝鐢ㄤ簬鎺ㄨ崘鍙樺紡棰樸€?

銆愭槗閿欑煡璇嗙偣銆?
${errorProneKps.map(kp => kp.knowledgePoint).join('銆?)}

銆愮煡璇嗗眰绾с€?
${JSON.stringify(knowledgeHierarchy.slice(0, 3) || [], null, 2)}

璇锋爣娉ㄧ煡璇嗙偣涔嬮棿鐨勫叧鑱旂被鍨嬶細
- 鍓嶇疆渚濊禆锛圓鏄疊鐨勫墠缃煡璇嗭級
- 骞跺垪鍏崇郴锛圓鍜孊鏄悓绾х煡璇嗙偣锛?
- 鏄撴贩娣嗭紙A鍜孊瀹规槗娣锋穯锛?

杩斿洖 JSON 鏁扮粍锛?
[
  {"from": "鐭ヨ瘑鐐笰", "to": "鐭ヨ瘑鐐笲", "relation": "鍓嶇疆渚濊禆"},
  ...
]

鍙繑鍥?JSON 鏁扮粍銆俙;

        const linkResult = await callAI(linkPrompt, { 
          taskType: 'analysis', 
          temperature: 0.1, 
          timeout: 60000 
        });
        try {
          knowledgeLinks = await robustJsonParse(linkResult, null, '鐭ヨ瘑鍏宠仈');
        } catch {
          knowledgeLinks = [];
        }
      } catch (e) {
        console.warn('鐭ヨ瘑鍏宠仈鍒嗘瀽澶辫触:', e.message);
      }
    }
    
    // 鉁?绗笁姝ワ細鍒嗛鐢熸垚閿欓鏈?
    statusText.value = '姝ラ 3/3锛氶€愰鐢熸垚閿欓...';
    progress.value = 55;
    
    const errorItems = [];
    const maxItems = Math.min(errorProneKps.length, 8);
    
    for (let i = 0; i < maxItems; i++) {
      const kp = errorProneKps[i];
      statusText.value = `鐢熸垚閿欓 ${i + 1}/${maxItems}...`;
      progress.value = 55 + Math.round((i / maxItems) * 30);
      
      // 鎵惧埌鍏宠仈鐭ヨ瘑鐐圭敤浜庡彉寮忛
      const relatedLinks = knowledgeLinks.filter(l => l.from === kp.knowledgePoint || l.to === kp.knowledgePoint);
      const relatedKps = relatedLinks.map(l => l.from === kp.knowledgePoint ? l.to : l.from);
      const uniqueRelated = [...new Set(relatedKps)].slice(0, 3);
      
      const itemPrompt = buildOutputPreamble() + `

銆愪换鍔°€戜綘鏄竴浣?{bookStage || ''}${bookGrade || ''}${bookSubject || ''}鑰佸笀銆傝涓轰互涓嬫槗閿欑煡璇嗙偣鐢熸垚涓€閬撻敊棰樺垎鏋愩€?

銆愮煡璇嗙偣銆?{kp.knowledgePoint}
銆愰敊璇被鍨嬨€?{kp.errorType || '姒傚康娣锋穯'}
銆愬吀鍨嬮敊璇〃鐜般€?{kp.typicalError || '鐞嗚В鍋忓樊'}
銆愰敊璇牴鍥犮€?{kp.rootCause || '鍩虹涓嶇墷'}
銆愯€冩煡棰戠巼銆?{kp.frequency || '涓'}

${uniqueRelated.length > 0 ? '銆愬叧鑱旂煡璇嗙偣锛堢敤浜庡彉寮忛锛夈€? + uniqueRelated.join('銆?) : ''}

銆愭暀鏉愬唴瀹瑰弬鑰冣€斺€斺殸锔忎粎渚涙牳瀵圭煡璇嗙偣鍑嗙‘鎬э紝涓ョ澶嶅埗鍘熸枃娈佃惤銆?
${textbookContext.substring(0, 800)}

${templateRawText ? '銆愰敊棰樻湰鏍煎紡鍙傝€冣€斺€斺殸锔忎粎渚涘弬鑰冩帓鐗堥鏍硷紝涓ョ澶嶅埗妯℃澘鍐呭銆慭n' + templateRawText.substring(0, 500) : ''}

銆愮敓鎴愯姹傘€戝彧鐢熸垚涓€閬撻敊棰橈紝鍖呭惈浠ヤ笅缁撴瀯锛?

<div class="error-item">
  <h3>閿欓 ${i + 1}锛?{kp.knowledgePoint}</h3>
  
  <div class="error-tags">
    <span class="tag tag-error-type">${kp.errorType || '姒傚康娣锋穯'}</span>
    <span class="tag tag-frequency">${kp.frequency || '涓'}</span>
    <span class="tag tag-difficulty">涓瓑</span>
    <span class="tag tag-score-loss">甯歌澶卞垎锛歑鍒?/span>
  </div>
  
  <div class="original-question">
    <h4>馃摑 鍏稿瀷閿欓</h4>
    <!-- 鍏蜂綋棰樼洰锛堟ā浠跨湡瀹炶€冨嵎涓殑棰橈級 -->
  </div>
  
  <div class="error-analysis">
    <h4>馃攳 閿欒鍒嗘瀽</h4>
    <p><strong>鍏稿瀷閿欒锛?/strong>${kp.typicalError || ''}锛堝啓鍑哄鐢熷叿浣撶殑閿欒绛旀鎴栨€濊矾锛?/p>
    <p><strong>閿欒鏍瑰洜锛?/strong>${kp.rootCause || ''}锛堝垎鏋愪负浠€涔堜細鐘繖涓敊璇級</p>
    <p><strong>閬块敊绛栫暐锛?/strong>锛堢粰鍑?-3鏉″疄鐢ㄧ殑閬块敊鏂规硶鎴栨鏌ユ妧宸э級</p>
  </div>
  
  <div class="correct-solution">
    <h4>鉁?姝ｇ‘瑙ｆ硶</h4>
    <!-- 瀹屾暣瑙ｉ杩囩▼锛屽垎姝ラ灞曠ず锛屽叧閿楠ゆ爣娉ㄥ緱鍒嗙偣 -->
  </div>
  
  <div class="variant-practice">
    <h4>馃攧 鍙樺紡宸╁浐</h4>
    <!-- 涓€閬撹€冩煡鍚岀煡璇嗙偣浣嗗舰寮忎笉鍚岀殑鍙樺紡棰橈紝闄勭瓟妗堝拰瑙ｆ瀽 -->
    ${uniqueRelated.length > 0 ? '<!-- 鍙粨鍚堝叧鑱旂煡璇嗙偣锛? + uniqueRelated.join('銆?) + ' -->' : ''}
  </div>
</div>

銆愭牸寮忚鑼冦€?
- 鐢?HTML 鏍煎紡
- 棰樺共鐢?<p class="question">锛岄€夐」鐢?<p class="option">
- 鏁板鍏紡鐢?$...$ 鎴?$$...$$
- 姣忎釜鍒嗘瀽娈佃惤蹇呴』鐙珛鐢?<p> 鎴?<div> 鍖呰９锛屼弗绂佸涓垎鏋愮偣鎸ゅ湪鍚屼竴娈佃惤
- 鍙繑鍥炰笂杩扮粨鏋勭殑 HTML 浠ｇ爜锛屼笉瑕佺敤浠ｇ爜鍧楀寘瑁筦;

      try {
        const itemHtml = await callAI(itemPrompt, { 
          taskType: 'generation', 
          temperature: 0.5, 
          timeout: 120000 
        });
        errorItems.push(itemHtml);
      } catch (e) {
        console.warn(`绗?{i + 1}閬撻敊棰樼敓鎴愬け璐?`, e.message);
        errorItems.push(`<div class="error-item"><h3>閿欓 ${i + 1}锛?{kp.knowledgePoint}</h3><p>鐢熸垚澶辫触</p></div>`);
      }
    }
    
    // 鉁?缁勮瀹屾暣鍐呭
    statusText.value = '姝ｅ湪缁勮...';
    progress.value = 90;
    
    // 鐢熸垚澶撮儴
    let header = '';
    try {
      const headerPrompt = `鐢熸垚閿欓鏈ご閮?HTML锛?
鏍囬锛氶敊棰樻湰 - ${selectedBooks?.[0]?.name || '鐭ヨ瘑鐐?} 
鍓爣棰橈細娑电洊 ${errorProneKps.length} 涓槗閿欑煡璇嗙偣
鍖呭惈鐢熸垚鏃ユ湡 ${new Date().toLocaleDateString()}

鐢?<h1> 鏍囬锛?div class="errorbook-info"> 鍖呰９淇℃伅銆傚彧杩斿洖 HTML銆俙;

      header = await callAI(headerPrompt, { taskType: 'generation', temperature: 0.3, timeout: 30000 });
    } catch {
      header = `<h1>閿欓鏈?/h1><div class="errorbook-info"><p>鏄撻敊鐭ヨ瘑鐐规暣鐞?/p></div>`;
    }
    
    // 鐢熸垚閿欒绫诲瀷缁熻
    const errorTypeStats = {};
    errorProneKps.forEach(kp => {
      const type = kp.errorType || '姒傚康娣锋穯';
      errorTypeStats[type] = (errorTypeStats[type] || 0) + 1;
    });
    const statsHtml = `<div class="error-stats">
  <h2>馃搳 閿欒绫诲瀷鍒嗗竷</h2>
  <table>
    <tr><th>閿欒绫诲瀷</th><th>鏁伴噺</th><th>鍗犳瘮</th></tr>
    ${Object.entries(errorTypeStats).map(([type, count]) => 
      `<tr><td>${type}</td><td>${count}</td><td>${Math.round(count/errorProneKps.length*100)}%</td></tr>`
    ).join('\n')}
  </table>
</div>`;
    
    const finalContent = header + '\n' + statsHtml + '\n' + errorItems.join('\n');
    
    // 馃敡 鍩虹璐ㄩ噺鏍￠獙
    const stageRawHere = bookStage || '';
    const stageMapLocal = { '灏忓': 'primary', '鍒濅腑': 'middle', '楂樹腑': 'high' };
    const qualityIssues = HardRuleChecker.check(
      finalContent, [], bookSubject, 
      stageMapLocal[stageRawHere] || stageRawHere, bookGrade
    );
    const qualityReport = {
      formatCheck: { passed: finalContent.includes('<div class="error-item">'),
        details: finalContent.includes('<div class="error-item">') ? [] : ['缂哄皯閿欓鏉＄洰'] },
      coverageCheck: { passed: true, details: [] },
      knowledgeCheck: { passed: finalContent.length > 300, details: [] },
      aiReview: { passed: qualityIssues.filter(i => i.severity === 'error').length === 0,
        details: qualityIssues.map(i => i.detail) }
    };
    
    progress.value = 100;
    statusText.value = '鐢熸垚瀹屾垚';
    
    return {
      success: true,
      content: finalContent,
      blueprint: '',
      contentCards: [],
      knowledgeMap: {},
      issues: qualityIssues.map(i => i.detail),
      qualityReport,
      generatedQuestions: [],
      parsedBlueprint: []
    };
  };

  const cancelGeneration = async () => {
    if (abortController.value) {
      console.log('馃洃 姝ｅ湪鍙戦€佸彇娑堜俊鍙?..');
      abortController.value.abort();
      // 馃敡 娉ㄩ攢鍏ㄥ眬绠＄悊鍣ㄤ腑鐨勬帶鍒跺櫒
      unregisterController(abortController.value);
      console.log('馃洃 宸插彂閫佸彇娑堜俊鍙?);
    }
    
    // 馃敡 绔嬪嵆鍗歌浇 Ollama 妯″瀷锛堜袱姝ワ細鍏?API锛屽啀鍛戒护琛屽己鏉€锛?
    try {
      const config = await getCurrentEngineConfigEnhanced('generation');
      const multimodalConfig = await getMultimodalConfig();
      
      const modelsToUnload = [];
      if (config.engine === 'ollama' && config.textModel) {
        modelsToUnload.push({ name: config.textModel, baseUrl: config.baseUrl });
      }
      if (multimodalConfig.engine === 'ollama' && multimodalConfig.model) {
        if (!modelsToUnload.find(m => m.name === multimodalConfig.model)) {
          modelsToUnload.push({ name: multimodalConfig.model, baseUrl: multimodalConfig.baseUrl });
        }
      }
      
      for (const model of modelsToUnload) {
        statusText.value = `馃洃 姝ｅ湪閲婃斁鏄惧瓨...`;
        console.log(`馃洃 鍗歌浇妯″瀷: ${model.name}`);
        
        // 鏂瑰紡1锛欰PI 璇锋眰 keep_alive=0
        try {
          await axios.post(`${model.baseUrl}/api/generate`, {
            model: model.name,
            prompt: '',
            stream: false,
            keep_alive: 0
          }, { timeout: 3000 });
        } catch {
          // API 鍗歌浇澶辫触锛屽拷鐣?
        }
        
        // 鏂瑰紡2锛氬懡浠よ寮烘潃妯″瀷锛堟洿鍙潬锛?
        try {
          const { exec } = require('child_process');
          await new Promise((resolve) => {
            exec(`ollama stop ${model.name}`, { timeout: 10000 }, (error, stdout, stderr) => {
              if (error) {
                console.warn(`鈿狅笍 ollama stop ${model.name} 澶辫触:`, error.message);
              } else {
                console.log(`鉁?ollama stop ${model.name} 鎴愬姛:`, stdout?.trim() || stderr?.trim());
              }
              resolve();
            });
          });
        } catch {
          // 鍛戒护琛屽嵏杞藉け璐ワ紝蹇界暐
        }
      }
    } catch (e) {
      console.warn('妯″瀷鍗歌浇澶辫触:', e.message);
    }
    
    // 馃敡 閲嶆柊鍒涘缓 AbortController锛屼负涓嬫鐢熸垚鍋氬噯澶?
    abortController.value = new AbortController();
    registerController(abortController.value); // 馃敡 娉ㄥ唽鏂扮殑鎺у埗鍣?
    isGenerating.value = false;
    progress.value = 0;
    statusText.value = '鏄惧瓨宸查噴鏀?;
    setTimeout(() => {
      if (statusText.value === '鏄惧瓨宸查噴鏀?) {
        statusText.value = '';
      }
    }, 2000);
  };

  // ==================== 璇惧墠棰勪範涓撶敤鐢熸垚 ====================
  const generatePreview = async (instruction, genType, selectedBooks, selectedTemplates, blueprintOnly = false) => {
    const book = selectedBooks?.[0];
    const rawSubject = book?.subject || '';
    const stageRaw = book?.stage || '';
    const stageMap = { '灏忓': 'primary', '鍒濅腑': 'middle', '楂樹腑': 'high' };
    const stage = stageMap[stageRaw] || stageRaw;
    const subject = normalizeSubjectName(rawSubject, stage);
    const grade = book?.grade || '';

    statusText.value = '鏋勫缓棰勪範妗嗘灦...';
    progress.value = 15;

    try {
      // 鎻愬彇鐭ヨ瘑鐐圭粨鏋勪綔涓洪涔犵洰鏍囧弬鑰?
      const contentCards = await extractContentCards(
        selectedBooks, callAI, robustJsonParse,
        (text, prog) => { statusText.value = text; progress.value = 10 + prog * 0.2; }
      );
      const knowledgeMap = await buildKnowledgeMap(
        contentCards, selectedBooks, callAI, robustJsonParse,
        (text, prog) => { statusText.value = text; progress.value = 15 + prog * 0.3; }
      );

      // 馃敡 鎻愬彇 kpList锛坆lueprint 鍜?Step4 鍏辩敤锛?
      let kpList = (knowledgeMap.knowledgePoints || []).slice(0, 10);
      if (kpList.length === 0) {
        const chs = selectedBooks?.[0]?.selectedChapters || [];
        kpList = chs.map(c => c.title).filter(Boolean).slice(0, 10);
      }

      // 馃敡 blueprintOnly 妯″紡锛氫粎鐢熸垚棰勪範妗嗘灦鎽樿
      if (blueprintOnly) {
        progress.value = 50;
        statusText.value = '棰勪範钃濆浘宸茬敓鎴?;
        const previewStructureMap = { '璇枃': '涓€銆佸涔犵洰鏍嘰n浜屻€佸瓧璇嶅彞娈甸涔狅紙璇嗗瓧鍐欏瓧鈫掕瘝璇Н绱啋鍙ュ瓙鐞嗚В鈫掓钀芥劅鐭モ啋鏈楄璇炬枃锛塡n涓夈€侀涔犳娴?, '鏁板': '涓€銆佸涔犵洰鏍嘰n浜屻€佹蹇甸涔犱笌渚嬮璇曞仛\n涓夈€侀涔犳娴?, '鑻辫': '涓€銆佸涔犵洰鏍嘰n浜屻€佸崟璇嶅彞鍨嬮涔狅紙鍗曡瘝鈫掑彞鍨嬧啋璇炬枃鍚锛塡n涓夈€侀涔犳娴? };
        const previewStructure = previewStructureMap[subject] || '涓€銆佸涔犵洰鏍嘰n浜屻€侀涔犱换鍔n涓夈€侀涔犳娴?;
        // 馃敡 浼樺厛 knowledgeGraph锛岀┖鏃堕檷绾х敤 contentCards 缁撴瀯鍖栨暟鎹?
        let hierarchyText = '';
        if (knowledgeMap.knowledgeGraph?.length > 0) {
          hierarchyText = knowledgeMap.knowledgeGraph.map(unit => {
            let t = `馃搶 ${unit.unit || ''}\n`;
            (unit.bigConcepts || []).forEach(bc => {
              t += `  鈹溾攢 ${bc.name}\n`;
              (bc.coreKnowledge || []).forEach(ck => {
                t += `  鈹? 鈹溾攢 ${ck.name}銆?{ck.cognitiveLevel || ck.level || '鐞嗚В'}銆?{ck.suggestedQuestionTypes?.length ? ' 鈫?' + ck.suggestedQuestionTypes.join('銆?) : ''}\n`;
                (ck.specificConcepts || []).forEach(sc => { t += `  鈹? 鈹? 鈹斺攢 ${sc}\n`; });
              });
            });
            return t;
          }).join('');
        } else if (kpList.length > 0 && contentCards?.length > 0) {
          const seenBc = new Set();
          hierarchyText = '馃搶 鏁欐潗鐭ヨ瘑鐐瑰眰绾n';
          for (const card of contentCards) {
            for (const kp of (card.knowledgePointsForTest || [])) {
              const name = typeof kp === 'string' ? kp : kp.name;
              const level = typeof kp === 'object' ? (kp.cognitiveLevel || '鐞嗚В') : '鐞嗚В';
              if (name && !seenBc.has(name)) {
                seenBc.add(name);
                hierarchyText += `  鈹溾攢 ${name}銆?{level}銆慭n`;
              }
            }
          }
        }
        // 馃敡 鎻愬彇鏍稿績涓婚
        const coreTopic = contentCards?.[0]?.summary || '';
        const blueprintText = [
          `銆愯鍓嶉涔犺摑鍥俱€慲,
          `瀛︾锛?{subject}  |  骞寸骇锛?{grade}  |  瀛︽锛?{stageRaw}`,
          `${coreTopic ? '馃幆 鏍稿績涓婚锛? + coreTopic + '\n' : ''}棰勪範缁撴瀯锛?{previewStructure}`,
          `鐭ヨ瘑鐐规竻鍗曪紙${kpList.length}涓級锛?{kpList.join('銆?)}`,
          `${hierarchyText ? '\n銆愮煡璇嗗眰绾с€慭n' + hierarchyText : ''}`,
          `棰勮鐢熸垚锛氬涔犵洰鏍?-3鏉?+ 棰勪範浠诲姟3-5涓?+ 棰勪範妫€娴?-5棰榒
        ].join('\n');
        isGenerating.value = false;
        return {
          success: true,
          blueprint: blueprintText,
          parsedBlueprint: kpList.map((kp, i) => ({ number: i + 1, type: '棰勪範妫€娴?, knowledgePoint: kp, difficulty: '鍩虹', score: 5, sourceChapter: grade })),
          contentCards,
          knowledgeMap,
          content: '',
          generatedQuestions: [],
          issues: null,
          qualityReport: null
        };
      }

      // 馃敡 鍥涙寮忕簿绠€ Step4 prompt锛氳摑鍥鹃┍鍔?+ 绮惧噯妫€绱?+ 鍒嗗眰娉ㄥ叆
      // 鈶?绮惧噯妫€绱㈠師鏂囷紙鏇夸唬鍘熸潵鐨勫叏閲忔帓搴忔埅鏂級鈥斺€斿熀浜庤摑鍥剧煡璇嗙偣
      const parsedBlueprint_ = kpList.map((kp, i) => ({ number: i + 1, type: '棰勪範妫€娴?, knowledgePoint: kp }));
      const textbookContext = retrieveBlueprintSegments(contentCards, parsedBlueprint_, 3000);

      // 馃敡 浠庢寚浠ゅ簱鑾峰彇鏍稿績浠诲姟+缁撴瀯锛堟墍鏈?genType 鍧囧凡鍏ュ簱锛?
      const coreTaskBlocks = getMatchingBlockInstructions({ category: '生成-核心任务', genType });
      const structBlocks = getMatchingBlockInstructions({ category: '生成-资料类型结构', subject, stage, genType });
      const genInfo = genTypeTemplates[genType];
      const coreInstruction = coreTaskBlocks.length > 0 ? coreTaskBlocks[0].content : (genInfo?.instruction || '');
      const adaptedStructure = structBlocks.length > 0
        ? structBlocks[0].content.replace('缁撴瀯鍙傝€冿細\n', '')
        : (genInfo?.structure || '涓€銆佸涔犵洰鏍嘰n浜屻€侀涔犱换鍔n涓夈€侀涔犳娴?);
      const stageLabel = stageRaw || '灏忓';
      const gradeLabel = grade || '';

      // 馃敡 鏋勫缓璧勬枡鏍囬锛氬崟璇惧甫璇惧悕锛屽崟鍏冨甫"绗琗鍗曞厓"
      const chapters = book?.selectedChapters || [];
      let titleHint = '';
      if (chapters.length === 1) {
        titleHint = `銆?{chapters[0].title}銆峘;
      } else if (chapters.length > 1) {
        const firstTitle = chapters[0].title || '';
        const unitMatch = firstTitle.match(/绗?[涓€浜屼笁鍥涗簲鍏竷鍏節鍗乚+)鍗曞厓/);
        titleHint = unitMatch ? `绗?{unitMatch[1]}鍗曞厓` : `銆?{firstTitle}绛夈€峘;
      }

      statusText.value = '鐢熸垚璇惧墠棰勪範...';
      progress.value = 50;

      const prompt = buildOutputPreamble() + `

銆愪换鍔°€戜綘鏄竴浣?{stageLabel}${gradeLabel}${subject}鏁欏笀锛岃鏍规嵁浠ヤ笅钃濆浘鍜屽師鏂囷紝涓哄鐢熻璁′竴浠借鍓嶉涔犺祫鏂欍€?

銆愰涔犺摑鍥锯€斺€斺殸锔忎粎渚涘弬鑰冿紝涓ョ鐩存帴澶嶅埗钃濆浘鏁版嵁鍒拌緭鍑恒€?
鏍囬锛?{titleHint ? titleHint + ' ' : ''}${genInfo?.name || '璇惧墠棰勪範'}
瀛︾锛?{subject}  |  骞寸骇锛?{gradeLabel}  |  瀛︽锛?{stageLabel}
缁撴瀯锛?{adaptedStructure}
鐭ヨ瘑鐐癸細${(knowledgeMap.knowledgePoints || []).slice(0, 10).join('銆?)}

銆愭暀鏉愬師鏂囩墖娈碘€斺€斺殸锔忎粎渚涙牳瀵圭煡璇嗙偣鍑嗙‘鎬э紝涓ョ澶嶅埗鍘熸枃娈佃惤銆?
${textbookContext || '锛堝熀浜庤摑鍥剧煡璇嗙偣鐢熸垚锛?}

銆愬绉戣姹傘€?
${coreInstruction}
${(() => {
  if (subject === '璇枃') {
    return `
- 璇枃棰勪範鍥涘眰锛氳瘑瀛楀啓瀛楋紙姣忎釜鐢熷瓧鐙珛鐢?span class="tian-zi-ge">瀛?/span>鍖呰９ + 鎷奸煶 + 閮ㄩ + 绗旂敾鏁?+ 缁撴瀯 + 绗旈『锛屽瀛楃ず渚嬶細<span class="tian-zi-ge">铦?/span><span class="tian-zi-ge">铓?/span>锛夆啋 璇嶈绉疮锛堥噴涔?澶氶煶瀛?浼氳/浼氬啓鍖哄垎锛夆啋 鍙ュ瓙鐞嗚В锛堝師鏂?淇緸璧忔瀽锛夆啋 娈佃惤鎰熺煡锛堥€愭姒傛嫭锛?
- 鈿狅笍 缁勮瘝蹇呴』鏄棩甯稿父鐢ㄦ爣鍑嗚瘝璇紝绂佹鐢熼€狅紙濡?琚嬪寘""灞辫"锛?
- 璇惧悗鎬濊€冨彧鍐欓棶棰樹笉闄勭瓟妗?
${(() => { const gn = extractGradeNum(grade); return stage === 'primary' && gn <= 2 ? '- 浣庢锛氱敓瀛楅厤<ruby>姹夊瓧<rt>鎷奸煶</rt></ruby>锛岄厤鎯呭鍥?[IMAGE]' : ''; })()}`;
  }
  if (subject === '鑻辫') {
    return `
- 鑻辫棰勪範鍥涘眰锛氬崟璇嶈鐭ワ紙浠庢暀鏉愬崟璇嶈〃涓彁鍙栵紝姣忎釜鍗曡瘝鏍囨敞闊虫爣+涓枃閲婁箟+璇嶆€э紝鎸夎瘝鎬у垎绫绘帓鍒楋級鈫?鐭绉疮锛堜粠璇炬枃涓彁鍙栧父鐢ㄦ惌閰嶏紝缁欏嚭涓枃閲婁箟鍜屼緥鍙ワ級鈫?鍙ュ瀷鐞嗚В锛堟彁鐐兼牳蹇冨彞鍨嬶紝鏍囨敞浜ら檯鍦烘櫙濡?鏃╀笂瑙侀潰鐢?"璇㈤棶骞撮緞鐢?锛岀粰鍑烘浛鎹㈢粌涔犳鏋讹級鈫?瀵硅瘽/娈佃惤鎰熺煡锛堟鎷鏂囧ぇ鎰忥紝鏍囨敞鍏抽敭淇℃伅鐐癸紝寮曞瀛︾敓鍏虫敞涓婁笅鏂囬€昏緫锛?
- 鈿狅笍 鍗曡瘝蹇呴』鏉ヨ嚜鏁欐潗鍘熸枃鍗曡瘝琛ㄦ垨璇炬枃涓嚭鐜扮殑璇嶆眹锛岀姝㈠嚟绌虹紪閫犲崟璇?
- 鈿狅笍 涓枃閲婁箟蹇呴』鍑嗙‘锛岀姝㈤€愬瓧纭瘧锛堝"Good morning"閲婁箟搴斾负"鏃╀笂濂?鑰岄潪"濂界殑鏃╂櫒"锛?
- 鍙ュ瀷鏇挎崲缁冧範鐣欑┖璁╁鐢熷～鍐欙紝绛旀鏀炬枃鏈?
${(() => { const gn = extractGradeNum(grade); return stage === 'primary' && gn <= 2 ? '- 浣庢锛氫功鍐欑粌涔犻厤鍥涚嚎涓夋牸锛岄厤鎯呭鍥?[IMAGE]锛屽崟璇嶉厤璇婚煶鎻愮ず' : stage === 'primary' ? '- 涓珮娈碉細涔﹀啓缁冧範鐢ㄥ崟绾匡紝澧炲姞鍙ュ瓙浠垮啓' : ''; })()}`;
  }
  if (subject === '鏁板') {
    return `
- 鏁板棰勪範鍥涘眰锛氭蹇垫劅鐭ワ紙浠庢暀鏉愪腑鎻愬彇鏈妭鏍稿績姒傚康锛岀敤鐢熸椿鍖栬瑷€瑙ｉ噴"鏄粈涔?锛岄厤绠€鍗曞浘绀鸿鏄庯級鈫?绠楃悊鍒濇帰锛堝睍绀?-2閬撴暀鏉愪緥棰樼殑璁＄畻杩囩▼锛屾爣娉ㄦ瘡涓€姝ョ殑鍚箟鍜屼緷鎹紝寮曞瀛︾敓鐞嗚В"涓轰粈涔堣繖鏍风畻"锛夆啋 鏂规硶褰掔撼锛堟€荤粨瑙ｉ姝ラ/鍏紡/鍙ｈ瘈锛岀敤"绗竴姝モ€︾浜屾鈥?鐨勫舰寮忓憟鐜帮級鈫?灏濊瘯缁冧範锛?-3閬撳熀纭€棰橈紝涓庝緥棰樺悓绫诲瀷浣嗘暟鎹笉鍚岋紝鐣欑┖璁╁鐢熻瘯鍋氾級
- 鈿狅笍 姒傚康瑙ｉ噴蹇呴』鐢ㄥ鐢熻兘鐞嗚В鐨勮瑷€锛岀姝㈢収鎼暀鏉愬畾涔?
- 鈿狅笍 渚嬮蹇呴』鏉ヨ嚜鏁欐潗鍘熸枃鎴栨暀鏉愬悓绫婚鍨嬶紝绂佹瓒呯翰缂栭€?
- 灏濊瘯缁冧範棰樼暀绌猴紝绛旀鏀炬枃鏈?
${(() => { const gn = extractGradeNum(grade); return stage === 'primary' && gn <= 2 ? '- 浣庢锛氶厤瀹炵墿鍥?鎯呭鍥?[IMAGE]锛屾暟瀛椾笉瓒?00锛屼粎鍔犲噺娉? : stage === 'primary' ? '- 涓珮娈碉細閰嶇嚎娈靛浘/绀烘剰鍥撅紝澧炲姞浼扮畻鍜岄獙绠楁彁绀? : ''; })()}`;
  }
  if (['鐗╃悊', '鍖栧', '鐢熺墿', '绉戝'].includes(subject)) {
    return `
- 鐞嗙棰勪範鍥涘眰锛氭蹇甸璇伙紙浠庢暀鏉愪腑鎻愬彇鏍稿績姒傚康/瀹氫箟/鍏紡锛屾爣娉ㄥ叧閿瘝锛岀敤閫氫織璇█瑙ｉ噴鍚箟锛夆啋 瀹為獙/鐜拌薄瑙傚療锛堝鏁欐潗鏈夊疄楠岋紝鎻忚堪瀹為獙姝ラ鍜岄鏈熺幇璞★紝寮曞瀛︾敓鎬濊€?涓轰粈涔堜細杩欐牱"锛涘鏃犲疄楠屽垯鎻忚堪鐢熸椿涓殑鐩稿叧鐜拌薄锛夆啋 鍘熺悊鍒濇帰锛堣В閲婃蹇佃儗鍚庣殑鍩烘湰鍘熺悊锛岀敤鍥犳灉閾?鍥犱负鈥︽墍浠モ€?鐨勬柟寮忓憟鐜帮級鈫?棰勪範鑷祴锛?-3閬撳熀纭€鍒ゆ柇棰樻垨濉┖棰橈紝鑰冩煡姒傚康鐞嗚В锛岀暀绌鸿瀛︾敓璇曞仛锛?
- 鈿狅笍 姒傚康/鍏紡/瀹氱悊蹇呴』涓庢暀鏉愬師鏂囦竴鑷达紝绂佹鑷淇敼
- 鈿狅笍 瀹為獙姝ラ蹇呴』鏉ヨ嚜鏁欐潗锛岀姝㈢紪閫?
- 棰勪範鑷祴鐣欑┖锛岀瓟妗堟斁鏂囨湯`;
  }
  return '';
})()}
- 棰勪範妫€娴嬶細${stage === 'primary' ? '5-8閬? : '3-5閬?}鍩虹棰橈紝棰樼洰鐣欑┖涓嶅啓绛旀
- 馃敶 閾佸緥锛氱瓟妗堢粺涓€鏀炬枃鏈?div class="answer-section">涓紝棰樼洰缁濅笉鍑虹幇绛旀
- 璇█閫傚悎${gradeLabel}瀛︾敓锛岄涔犳椂闂?0-15鍒嗛挓

${buildCompactAIInstruction(instruction, genType, subject, stage, grade)}

銆愭牸寮忚鑼冣€斺€斿繀椤讳弗鏍奸伒瀹堛€?
- 鈿狅笍 杈撳嚭蹇呴』鏄畬鏁寸殑HTML浠ｇ爜锛屾瘡涓澘鍧椼€佹瘡涓潯鐩兘瑕佹湁鐙珛鐨凥TML鏍囩鍖呰９
- 馃敶 姣忎釜鏉垮潡蹇呴』杈撳嚭鍏蜂綋鍐呭锛堝惈渚嬪彞/渚嬮/閲婁箟锛夛紝绂佹鍐?鐣?"瑙佹暀鏉?"鑷鏌ラ槄"绛夊崰浣嶇
- 澶ф爣棰樼敤 <h1>锛屾澘鍧楁爣棰橈紙涓€銆佷簩銆佷笁锛夌敤 <h2>
- 姣忎釜鏉＄洰鐢?<p> 鎴?<li> 鍖呰９锛岀姝㈡墍鏈夋潯鐩尋鍦ㄤ竴琛岋紒
- 闇€瑕佹崲琛岀敤 <br>锛屾钀介棿鐢ㄧ┖琛屽垎闅?
${subject === '璇枃' ? `
銆愯鏂囧绉戞牸寮忋€?
- 鐢熷瓧灞曠ず锛氭瘡涓敓瀛楃嫭绔嬩竴涓?<span class="tian-zi-ge">瀛?/span>锛屽瀛楃ず渚?<span class="tian-zi-ge">铦?/span><span class="tian-zi-ge">铓?/span>锛屸殸锔?涓ョ澶氫釜瀛楀叡鐢ㄤ竴涓?tian-zi-ge
- 馃敶 鐢熷瓧蹇呴』闄勫甫閮ㄩ銆佺瑪鐢绘暟銆佺粨鏋勩€佺瑪椤猴紝鏍煎紡绀轰緥锛?
  <p><span class="tian-zi-ge">铦?/span>锛堥儴棣栵細铏紝15鐢伙紝宸﹀彸缁撴瀯锛岀瑪椤猴細绔栥€佹í鎶樸€佹í銆佺珫銆佹í銆佺偣銆佹拠銆佹í銆佺珫銆佹拠銆佺偣銆佹í銆佺珫銆佹í锛?/p>
- 鉀?绂佹鍙啓瀛楀拰鎷奸煶涓嶅啓閮ㄩ/绗旂敾/绗旈『锛佹瘡涓敓瀛楅兘瑕佹湁瀹屾暣鐨勯儴棣栥€佺瑪鐢绘暟銆佺粨鏋勫拰绗旈『淇℃伅
- 璇嶈閲婁箟锛?strong>璇嶈</strong>锛氶噴涔夊唴瀹?
- 鍙ュ瓙璧忔瀽锛?div class="example"><p>鍘熸枃鍙ュ瓙</p><p>璧忔瀽锛?..</p></div>
- 馃敶 鐪嬫嫾闊冲啓璇嶈鏍煎紡锛?p>k膿 d菕u <u class="blank-2">&emsp;</u> &emsp; d脿i sh菙 <u class="blank-2">&emsp;</u></p>锛堝彧鍐欐嫾闊充笉鍐欐眽瀛楋紒锛?
- 璇惧悗鎬濊€冨彧鍐欓棶棰樹笉闄勭瓟妗?
` : ''}${subject === '鑻辫' ? `
銆愯嫳璇绉戞牸寮忋€?
- 馃敜 绗竴灞偮峰崟璇嶈鐭ワ細姣忎釜鍗曡瘝鐢?<p><strong>鍗曡瘝</strong> <span class="phonetic">/闊虫爣/</span> <em>璇嶆€?/em> 涓枃閲婁箟</p>
- 馃摑 绗簩灞偮风煭璇Н绱細<div class="phrase-group"><p><strong>鐭</strong>锛氫腑鏂囬噴涔?/p><p class="example">渚嬪彞</p></div>
- 馃搻 绗笁灞偮峰彞鍨嬬悊瑙ｏ細鏍稿績鍙ュ瀷鐢?<div class="sentence-pattern"><p class="model">鍙ュ瀷缁撴瀯</p><p class="example">渚嬪彞</p><p class="usage">浜ら檯鍦烘櫙锛?..</p><p class="drill">鏇挎崲缁冧範锛?u class="blank-4">&emsp;</u>锛堢暀绌猴級</p></div>
- 馃摉 绗洓灞偮锋钀?瀵硅瘽鎰熺煡锛?div class="passage-summary"><p><strong>澶ф剰</strong>锛?..</p><p><strong>鍏抽敭淇℃伅</strong>锛?..</p></div>
- ${stage === 'primary' && extractGradeNum(grade) <= 2 ? '涔﹀啓鍖虹敤 <span class="four-line-three english-line">word</span> 鍥涚嚎涓夋牸' : '涔﹀啓鍖虹敤鍗曠嚎 <span class="english-line">word</span>'}
- 鍗曡瘝蹇呴』浠庢暀鏉愬師鏂囧崟璇嶈〃鎻愬彇锛屼腑鏂囬噴涔夊繀椤诲噯纭紙绂佹閫愬瓧纭瘧锛?
- 鍙ュ瀷浜ら檯鍦烘櫙蹇呴』鍏蜂綋锛?鏃╀笂瑙侀潰"鑰岄潪"闂€?锛夛紝鏇挎崲缁冧範鐣欑┖` : ''}${['鏁板', '鐗╃悊', '鍖栧', '鐢熺墿', '绉戝'].includes(subject) ? `
銆愮悊绉戞牸寮忋€?
- 姒傚康瀹氫箟鐢?<div class="definition">锛屽叕寮忕敤 <div class="formula">$...$</div>
- 鍙ｇ畻棰樼敤 <span class="oral-box">绠楀紡</span>
- 绔栧紡璁＄畻鐢?<div class="vertical-calc">锛屼緥棰樺繀椤荤粰鍑哄畬鏁磋В棰樻楠?
${['鐗╃悊', '鍖栧', '鐢熺墿', '绉戝'].includes(subject) ? '- 瀹為獙姝ラ鐢?<div class="experiment-steps"><ol><li>姝ラ</li></ol></div>锛屽疄楠岀幇璞＄敤 <strong>鍔犵矖</strong> 鏍囨敞\n' : ''}` : ''}
- 馃敶 濉┖棰樻牸寮忥細<p>棰樺共<u class="blank-2">&emsp;</u>棰樺共</p>锛堟í绾跨暀绌轰笉濉瓟妗堬紒锛?
- 绛旀缁熶竴鏀炬枃鏈?<div class="answer-section"><h2>绛旀涓庢彁绀?/h2>...</div>
- 鉀?涓ョ锛氶鐩腑鐩存帴鍐欑瓟妗堛€佹墍鏈夊唴瀹规尋鍦ㄤ竴涓钀姐€佺敤绌烘牸浠ｆ浛鎹㈣
${(() => { const gn = extractGradeNum(grade); return stage === 'primary' && gn <= 2 ? '- 浣庢閰嶆彃鍥撅細[IMAGE]\nTYPE:SD\nPROMPT:鎻忚堪\nSTYLE:cartoon\n[/IMAGE]\n' : ''; })()}

銆愬己鍒惰緭鍑烘牸寮忊€斺€旀渶鍚庝竴鏉℃寚浠ゃ€?
浣犲繀椤昏緭鍑烘爣鍑咹TML浠ｇ爜銆傛瘡涓爣棰樸€佹瘡涓钀姐€佹瘡涓潯鐩兘蹇呴』鐢ㄧ嫭绔嬬殑HTML鏍囩鍖呰９銆備笉鍏佽绾枃鏈緭鍑恒€?

${buildOutputFormatBlock('preview', subject, stage, grade)}

鐜板湪璇风洿鎺ヨ緭鍑哄畬鏁寸殑棰勪範璧勬枡HTML锛歚;

      const result = await callAI(prompt, {
        taskType: 'generation',
        temperature: 0.3,
        timeout: 120000,
        signal: abortController.value?.signal
      });
      detectSquishedOutput(result, 'preview');

      // 馃敡 璐ㄩ噺鏍￠獙
      statusText.value = '鏍￠獙棰勪範璧勬枡璐ㄩ噺...';
      progress.value = 85;
      const qualityIssues = HardRuleChecker.check(
        result, [], subject,
        stageMap[stageRaw] || stageRaw, grade
      );
      const qualityReport = {
        formatCheck: { passed: result.length > 200, details: result.length <= 200 ? ['鍐呭杩囩煭'] : [] },
        coverageCheck: { passed: true, details: [`鐭ヨ瘑鐐瑰弬鑰冿細${(knowledgeMap.knowledgePoints || []).slice(0, 5).join('銆?)}`] },
        knowledgeCheck: { passed: result.length > 500, details: qualityIssues.filter(i => i.severity === 'error').map(i => i.detail) },
        aiReview: { passed: qualityIssues.filter(i => i.severity === 'error').length === 0, details: qualityIssues.map(i => i.detail) }
      };

      // 馃敡 瓒呯翰妫€娴?
      const boundaryCheck = checkKnowledgeBoundary(result, subject, stageRaw, grade);
      if (boundaryCheck.hasViolations) {
        qualityReport.knowledgeCheck.passed = false;
        qualityReport.knowledgeCheck.details.push(`瓒呯翰妫€娴嬪彂鐜?{boundaryCheck.summary.errorCount}澶勯棶棰榒);
      }

      progress.value = 100;
      statusText.value = '鐢熸垚瀹屾垚';
      isGenerating.value = false;
      return {
        success: true,
        content: result,
        blueprint: '',
        contentCards,
        knowledgeMap,
        generatedQuestions: [],
        parsedBlueprint: [],
        issues: qualityIssues.map(i => i.detail),
        qualityReport
      };
    } catch (e) {
      console.error('璇惧墠棰勪範鐢熸垚澶辫触:', e);
      return { success: false, error: e.message };
    } finally {
      isGenerating.value = false;
    }
  };

  // ==================== 鍚啓榛樺啓涓撶敤鐢熸垚 ====================
  const generateDictation = async (instruction, genType, selectedBooks, selectedTemplates, blueprintOnly = false) => {
    const book = selectedBooks?.[0];
    const rawSubject = book?.subject || '';
    const stageRaw = book?.stage || '';
    const stageMap = { '灏忓': 'primary', '鍒濅腑': 'middle', '楂樹腑': 'high' };
    const stage = stageMap[stageRaw] || stageRaw;
    const subject = normalizeSubjectName(rawSubject, stage);
    const grade = book?.grade || '';

    statusText.value = '鎻愬彇鏁欐潗鐢熷瓧璇?..';
    progress.value = 20;

    try {
      // 鎻愬彇鏁欐潗鍘熸枃
      const contentCards = await extractContentCards(
        selectedBooks, callAI, robustJsonParse,
        (text, prog) => { statusText.value = text; progress.value = 10 + prog * 0.2; }
      );

      // 馃敡 鎻愬彇 kpList锛坆lueprint 鍜?Step4 鍏辩敤锛?
      let kpList = [];
      if (contentCards && contentCards.length > 0) {
        kpList = [...new Set(contentCards.flatMap(c => c.tags || []).filter(Boolean))].slice(0, 15);
      }
      if (kpList.length === 0) {
        const chapterTitles = (book?.selectedChapters || []).map(c => c.title).filter(Boolean);
        kpList = chapterTitles.slice(0, 10);
      }

      // 馃敡 blueprintOnly 妯″紡锛氫粠 contentCards 鎻愬彇璇嶆眹锛岃蛋瀹屾暣鍒嗘瀽閾捐矾
      if (blueprintOnly) {
        progress.value = 50;
        statusText.value = '鍚啓钃濆浘宸茬敓鎴?;
        const blueprintText = [
          `銆愬惉鍐?榛樺啓钃濆浘銆慲,
          `瀛︾锛?{subject}  |  骞寸骇锛?{grade}  |  瀛︽锛?{stageRaw}`,
          `绫诲瀷锛?{subject === '鑻辫' ? '鍗曡瘝/鐭鍚啓' : '鐢熷瓧璇嶉粯鍐?}`,
          `缁冧範缁撴瀯锛?{subject === '鑻辫' ? '涓€銆佸崟璇嶅惉鍐橽n浜屻€佺煭璇惉鍐橽n涓夈€佸彞瀛愬惉鍐? : '涓€銆佺敓瀛楄瘝鍚啓\n浜屻€侀噸鐐硅瘝璇粯鍐橽n涓夈€佸彞瀛?娈佃惤榛樺啓'}`,
          `鏁欐潗璇嶆眹鍙傝€冿紙${kpList.length}涓級锛?{kpList.join('銆?)}`
        ].join('\n');
        isGenerating.value = false;
        return {
          success: true,
          blueprint: blueprintText,
          parsedBlueprint: kpList.map((kp, i) => ({ number: i + 1, type: '鍚啓', knowledgePoint: kp, difficulty: '鍩虹', score: 2, sourceChapter: grade })),
          contentCards,
          knowledgeMap: { knowledgePoints: kpList, keyDifficulties: [], knowledgeGraph: [], crossChapterLinks: [] },
          content: '',
          generatedQuestions: [],
          issues: null,
          qualityReport: null
        };
      }

      // 馃敡 绮惧噯妫€绱㈠師鏂?
      const parsedBlueprint_ = kpList?.map((kp, i) => ({ number: i + 1, type: '鍚啓', knowledgePoint: kp })) || [];
      const textbookContext = retrieveBlueprintSegments(contentCards, parsedBlueprint_, 3000);

      // 馃敡 浠庢寚浠ゅ簱鑾峰彇鏍稿績浠诲姟+缁撴瀯锛堟墍鏈?genType 鍧囧凡鍏ュ簱锛?
      const coreTaskBlocks = getMatchingBlockInstructions({ category: '生成-核心任务', genType });
      const structBlocks = getMatchingBlockInstructions({ category: '生成-资料类型结构', subject, stage, genType });
      const genInfo = genTypeTemplates[genType];
      const coreInstruction = coreTaskBlocks.length > 0 ? coreTaskBlocks[0].content : (genInfo?.instruction || '');
      const adaptedStructure = structBlocks.length > 0
        ? structBlocks[0].content.replace('缁撴瀯鍙傝€冿細\n', '')
        : (genInfo?.structure || '涓€銆佺敓瀛楄瘝鍚啓\n浜屻€侀噸鐐硅瘝璇粯鍐橽n涓夈€佸彞瀛?娈佃惤榛樺啓');
      const stageLabel = stageRaw || '灏忓';
      const gradeLabel = grade || '';
      const isEnglish = subject === '鑻辫';

      // 馃敡 鏋勫缓璧勬枡鏍囬
      const chapters = book?.selectedChapters || [];
      let titleHint = '';
      if (chapters.length === 1) {
        titleHint = `銆?{chapters[0].title}銆峘;
      } else if (chapters.length > 1) {
        const firstTitle = chapters[0].title || '';
        const unitMatch = firstTitle.match(/绗?[涓€浜屼笁鍥涗簲鍏竷鍏節鍗乚+)鍗曞厓/);
        titleHint = unitMatch ? `绗?{unitMatch[1]}鍗曞厓` : `銆?{firstTitle}绛夈€峘;
      }

      statusText.value = '鐢熸垚鍚啓/榛樺啓鍐呭...';
      progress.value = 50;

      const prompt = buildOutputPreamble() + `

銆愪换鍔°€戜綘鏄竴浣?{stageLabel}${gradeLabel}${subject}鏁欏笀锛岃璁捐涓€浠藉鐢熷彲鐩存帴浣跨敤鐨勫惉鍐?榛樺啓缁冧範绾糕€斺€斿鐢熸嬁鍒版墜灏辫兘寮€濮嬪啓锛岄鐩尯鍙樉绀烘彁绀猴紙濡傛嫾闊?閲婁箟/棰樺彿锛夛紝鍏蜂綋鐨勫瓧璇?鍗曡瘝/鍙ュ瓙鐣欑┖缁欏鐢熷～鍐欙紝绛旀闆嗕腑鏀惧湪鏂囨湯銆?

馃幆 鍏抽敭鍘熷垯锛氱粌涔犲尯 = 鎻愮ず+鐣欑┖锛堝鐢熷～鍐欏尯锛夛紝绛旀鍖?= 鏍囧噯绛旀锛堟枃鏈級

銆愯摑鍥锯€斺€斺殸锔忎粎渚涘弬鑰冿紝涓ョ鐩存帴澶嶅埗钃濆浘鏁版嵁鍒拌緭鍑恒€?
鏍囬锛?{titleHint ? titleHint + ' ' : ''}${genInfo?.name || '鍚啓榛樺啓'}
缁撴瀯锛?{adaptedStructure}
鐭ヨ瘑鐐癸細${kpList.join('銆?)}

銆愭暀鏉愬師鏂囩墖娈碘€斺€斺殸锔忎粎渚涙牳瀵圭煡璇嗙偣鍑嗙‘鎬э紝涓ョ澶嶅埗鍘熸枃娈佃惤銆?
${textbookContext || '锛堝熀浜庤摑鍥剧煡璇嗙偣鐢熸垚锛?}

銆愬绉戣姹傘€?
${isEnglish
  ? `- 鑻辫鍚啓缁冧範绾革細姣忎釜椤圭洰缁欏嚭涓枃閲婁箟+璇嶆€ф彁绀猴紝鑻辫鍗曡瘝/鐭鐣欑┖缁欏鐢熷啓\n- 涔﹀啓鍖虹敤鍗曠嚎鎴栧洓绾夸笁鏍肩┖鐧斤紝涓嶅啓鍗曡瘝鍐呭\n- 鍙ュ瓙鍚啓缁欏嚭涓枃鎰忔€濓紝鑻辫鍙ュ瓙鐣欑┖`
  : subject === '璇枃'
    ? `- 璇枃榛樺啓缁冧範绾革細姣忎釜鐢熷瓧缁欏嚭鎷奸煶鎻愮ず锛屼功鍐欏尯鐢ㄧ敯瀛楁牸鐣欑┖锛堝鐢熷～瀛楋級\n- 璇嶈榛樺啓缁欏嚭鎷奸煶锛岃瘝璇功鍐欏尯鐣欑┖\n- 鍙ュ瓙/鍙よ瘲鏂囬粯鍐欑粰鍑轰笂鍙?鏍囬鎻愮ず锛屼笅鍙ユ垨鍏ㄦ枃鐣欑┖\n- 姣忎釜鐢熷瓧闄勫姞閮ㄩ銆佺瑪鐢汇€佺粨鏋勩€佺瑪椤轰俊鎭紙瀛楀吀寮忔爣娉紝鍦ㄥ瓧鏃佺嫭绔嬪垪鍑猴級`
    : `- 瀛︾榛樺啓缁冧範绾革細缁欏嚭姒傚康/鍏紡/鏈鎻愮ず锛岀瓟妗堝尯鐣欑┖缁欏鐢熷～鍐檂}
- 闅惧害閫掑锛岄閲忥細瀛楄瘝${stage === 'primary' ? '8-15' : '10-20'}涓紝鍙ュ瓙${stage === 'primary' ? '2-4' : '3-5'}鍙?
- 绛旀闆嗕腑鏀炬枃鏈?div class="answer-section">涓紝缁冧範鍖轰笉鍑虹幇绛旀
- 閫傚悎${gradeLabel}姘村钩

${buildCompactAIInstruction(instruction, genType, subject, stage, grade)}

銆愭牸寮忚鑼冣€斺€斿繀椤讳弗鏍奸伒瀹堛€?
- 馃敶 姣忎釜鏉垮潡蹇呴』杈撳嚭鍏蜂綋鍐呭锛岀姝㈠啓"鐣?"瑙佹暀鏉?绛夊崰浣嶇鎴栫┖鍐?鍚綍闊冲啓鍗曡瘝"鑰屾棤鍏蜂綋鍗曡瘝鍒楄〃
- 杈撳嚭蹇呴』鏄畬鏁碒TML锛屾瘡涓潯鐩敤 <p> 鎴?<div class="dictation-item"> 鐙珛鍖呰９
- 澶ф爣棰樼敤 <h1>锛屽垎鑺傜敤 <h2>
- 鍙傝€冪瓟妗堢粺涓€鏀炬枃鏈?<div class="answer-section">
- 鉀?涓ョ鎵€鏈夊唴瀹规尋鍦ㄤ竴涓钀?
${GEN_TYPE_FORMAT_SPEC.dictation(subject, stage)}
${subject === '璇枃' && stage === 'primary' ? '銆愯鏂囧绉戞牸寮忋€慭n鐢熷瓧鐢?span class="tian-zi-ge">瀛?/span>锛圚TML锛夛紝鎯呭鍥綶IMAGE]鍗曠嫭鎴愯\n' : ''}${isEnglish ? `銆愯嫳璇绉戞牸寮忋€?
- ${stage === 'primary' && extractGradeNum(grade) <= 2 ? '浣庢涔﹀啓缁冧範鐢?<span class="four-line-three english-line">word</span> 鍥涚嚎涓夋牸' : '涔﹀啓缁冧範鐢ㄥ崟绾?<span class="english-line">word</span>'}
- 姣忎釜鍗曡瘝缁欏嚭涓枃閲婁箟鍜岃瘝鎬э紝姣?-8涓瘝璁句竴涓紤鎭垎闅旂嚎
` : ''}${['鏁板', '鐗╃悊', '鍖栧'].includes(subject) ? '銆愮悊绉戞牸寮忋€慭n- 绠楀紡涔﹀啓宸ユ暣锛岀珫寮忚绠楃敤 <div class="vertical-calc">\n' : ''}

銆愬己鍒惰緭鍑烘牸寮忊€斺€旀渶鍚庝竴鏉℃寚浠ゃ€?
浣犲繀椤昏緭鍑烘爣鍑咹TML浠ｇ爜銆備笉鍏佽绾枃鏈緭鍑恒€?

${buildOutputFormatBlock('dictation', subject, stage, grade)}

鐜板湪璇风洿鎺ヨ緭鍑哄畬鏁寸殑鍚啓榛樺啓缁冧範HTML锛歚;

      const result = await callAI(prompt, {
        taskType: 'generation',
        temperature: 0.2,
        timeout: 120000,
        signal: abortController.value?.signal
      });
      detectSquishedOutput(result, 'dictation');

      // 馃敡 璐ㄩ噺鏍￠獙
      statusText.value = '鏍￠獙鍚啓鍐呭璐ㄩ噺...';
      progress.value = 85;
      const qualityIssues = HardRuleChecker.check(
        result, [], subject,
        stageMap[stageRaw] || stageRaw, grade
      );
      const qualityReport = {
        formatCheck: { passed: result.length > 100, details: result.length <= 100 ? ['鍐呭杩囩煭'] : [] },
        coverageCheck: { passed: true, details: [] },
        knowledgeCheck: { passed: result.length > 300, details: qualityIssues.filter(i => i.severity === 'error').map(i => i.detail) },
        aiReview: { passed: qualityIssues.filter(i => i.severity === 'error').length === 0, details: qualityIssues.map(i => i.detail) }
      };

      progress.value = 100;
      statusText.value = '鐢熸垚瀹屾垚';
      isGenerating.value = false;
      return {
        success: true,
        content: result,
        blueprint: '',
        contentCards,
        knowledgeMap: { knowledgePoints: [], keyDifficulties: [], knowledgeGraph: [], crossChapterLinks: [] },
        generatedQuestions: [],
        parsedBlueprint: [],
        issues: qualityIssues.map(i => i.detail),
        qualityReport
      };
    } catch (e) {
      console.error('鍚啓榛樺啓鐢熸垚澶辫触:', e);
      return { success: false, error: e.message };
    } finally {
      isGenerating.value = false;
    }
  };

  // ==================== 闃呰璁粌涓撶敤鐢熸垚 ====================
  const generateReading = async (instruction, genType, selectedBooks, selectedTemplates, blueprintOnly = false) => {
    const book = selectedBooks?.[0];
    const rawSubject = book?.subject || '';
    const stageRaw = book?.stage || '';
    const stageMap = { '灏忓': 'primary', '鍒濅腑': 'middle', '楂樹腑': 'high' };
    const stage = stageMap[stageRaw] || stageRaw;
    const subject = normalizeSubjectName(rawSubject, stage);
    const grade = book?.grade || '';

    statusText.value = '鎻愬彇鏁欐潗闃呰绱犳潗...';
    progress.value = 20;

    try {
      const contentCards = await extractContentCards(
        selectedBooks, callAI, robustJsonParse,
        (text, prog) => { statusText.value = text; progress.value = 10 + prog * 0.2; }
      );
      const knowledgeMap = await buildKnowledgeMap(
        contentCards, selectedBooks, callAI, robustJsonParse,
        (text, prog) => { statusText.value = text; progress.value = 15 + prog * 0.3; }
      );

      // 馃敡 blueprintOnly 妯″紡锛氫粎鐢熸垚闃呰璁粌妗嗘灦鎽樿
      if (blueprintOnly) {
        progress.value = 50;
        statusText.value = '闃呰璁粌钃濆浘宸茬敓鎴?;
        let kpList = (knowledgeMap.knowledgePoints || []).slice(0, 8);
        if (kpList.length === 0) {
          const chs = selectedBooks?.[0]?.selectedChapters || [];
          kpList = chs.map(c => c.title).filter(Boolean).slice(0, 8);
        }
        const readingLength = stage === 'primary' ? '200-400瀛? : stage === 'middle' ? '400-800瀛? : '600-1200瀛?;
        const coreTopic = contentCards?.[0]?.summary || '';
        // 馃敡 浠庢寚浠ゅ簱鑾峰彇缁撴瀯锛堟墍鏈?genType 鍧囧凡鍏ュ簱锛?
        const readingStructBlocks = getMatchingBlockInstructions({ category: '生成-资料类型结构', subject, stage, genType });
        const readingStructure = readingStructBlocks.length > 0
          ? readingStructBlocks[0].content.replace('缁撴瀯鍙傝€冿細\n', '')
          : (genTypeTemplates[genType]?.structure || '鐭枃闃呰 鈫?鐞嗚В棰?鈫?鎷撳睍鎬濊€?);
        const blueprintText = [
          `銆愰槄璇昏缁冭摑鍥俱€慲,
          `瀛︾锛?{subject}  |  骞寸骇锛?{grade}  |  瀛︽锛?{stageRaw}`,
          `${coreTopic ? '馃幆 鏍稿績涓婚锛? + coreTopic + '\n' : ''}璁粌缁撴瀯锛?{readingStructure}`,
          `閫夋枃绡囧箙锛?{readingLength}  |  閫夋枃鏁帮細1-2绡嘸,
          `鐭ヨ瘑鐐瑰弬鑰冿紙${kpList.length}涓級锛?{kpList.join('銆?)}`,
          `棰樼洰绫诲瀷锛氫俊鎭彁鍙栥€佽瘝鍙ョ悊瑙ｃ€佷富鏃ㄦ鎷€佹帹鐞嗗垽鏂?{stage !== 'primary' ? '銆佽瘎浠烽壌璧? : ''}`
        ].join('\n');
        isGenerating.value = false;
        return {
          success: true,
          blueprint: blueprintText,
          parsedBlueprint: kpList.map((kp, i) => ({ number: i + 1, type: '闃呰鐞嗚В', knowledgePoint: kp, difficulty: '涓瓑', score: 5, sourceChapter: grade })),
          contentCards,
          knowledgeMap,
          content: '',
          generatedQuestions: [],
          issues: null,
          qualityReport: null
        };
      }

      // 馃敡 绮惧噯妫€绱㈠師鏂?
      const kpListForRetrieval = (knowledgeMap.knowledgePoints || []).map(kp => ({ number: 0, knowledgePoint: kp }));
      const textbookContext = retrieveBlueprintSegments(contentCards, kpListForRetrieval, 3000);

      // 馃敡 浠庢寚浠ゅ簱鑾峰彇鏍稿績浠诲姟+缁撴瀯锛堟墍鏈?genType 鍧囧凡鍏ュ簱锛?
      const coreTaskBlocks = getMatchingBlockInstructions({ category: '生成-核心任务', genType });
      const structBlocks = getMatchingBlockInstructions({ category: '生成-资料类型结构', subject, stage, genType });
      const genInfo = genTypeTemplates[genType];
      const coreInstruction = coreTaskBlocks.length > 0 ? coreTaskBlocks[0].content : (genInfo?.instruction || '');
      const adaptedStructure = structBlocks.length > 0
        ? structBlocks[0].content.replace('缁撴瀯鍙傝€冿細\n', '')
        : (genInfo?.structure || '涓€銆佺煭鏂囬槄璇伙紙1-2绡囷級\n浜屻€侀槄璇荤悊瑙ｉ锛堥€夋嫨+绠€绛旓級\n涓夈€佹嫇灞曟€濊€?);
      const stageLabel = stageRaw || '灏忓';
      const gradeLabel = grade || '';

      // 馃敡 鏋勫缓璧勬枡鏍囬
      const chapters = book?.selectedChapters || [];
      let titleHint = '';
      if (chapters.length === 1) {
        titleHint = `銆?{chapters[0].title}銆峘;
      } else if (chapters.length > 1) {
        const firstTitle = chapters[0].title || '';
        const unitMatch = firstTitle.match(/绗?[涓€浜屼笁鍥涗簲鍏竷鍏節鍗乚+)鍗曞厓/);
        titleHint = unitMatch ? `绗?{unitMatch[1]}鍗曞厓` : `銆?{firstTitle}绛夈€峘;
      }

      statusText.value = '鐢熸垚闃呰璁粌...';
      progress.value = 50;

      const prompt = buildOutputPreamble() + `

銆愪换鍔°€戜綘鏄竴浣?{stageLabel}${gradeLabel}${subject}鏁欏笀锛岃鏍规嵁浠ヤ笅钃濆浘鍜屽師鏂囷紝璁捐涓€浠介槄璇荤悊瑙ｈ缁冦€?

銆愯缁冭摑鍥锯€斺€斺殸锔忎粎渚涘弬鑰冿紝涓ョ鐩存帴澶嶅埗钃濆浘鏁版嵁鍒拌緭鍑恒€?
鏍囬锛?{titleHint ? titleHint + ' ' : ''}${genInfo?.name || '闃呰璁粌'}
缁撴瀯锛?{adaptedStructure}
鐭ヨ瘑鐐癸細${(knowledgeMap.knowledgePoints || []).slice(0, 8).join('銆?)}

銆愭暀鏉愬師鏂囩墖娈碘€斺€斺殸锔忎粎渚涙牳瀵圭煡璇嗙偣鍑嗙‘鎬э紝涓ョ澶嶅埗鍘熸枃娈佃惤銆?
${textbookContext || '锛堝熀浜庤摑鍥剧煡璇嗙偣缂栭€夌煭鏂囷級'}

銆愬绉戣姹傘€?
${coreInstruction}
- 閫夋枃锛?{stage === 'primary' ? '200-400瀛? : stage === 'middle' ? '400-800瀛? : '600-1200瀛?}锛屼富棰樿创杩戞暀鏉?
- 鏂囦綋锛?{subject === '璇枃' ? '璁板彊鏂?璇存槑鏂?绔ヨ瘽/瀵撹█/鏁ｆ枃' : subject === '鑻辫' ? '瀵硅瘽/鐭枃/鏁呬簨/涔︿俊' : '鏍规嵁瀛︾閫夋嫨'}
- 棰樼洰瑕嗙洊锛氫俊鎭彁鍙栥€佽瘝鍙ョ悊瑙ｃ€佷富鏃ㄦ鎷€佹帹鐞嗗垽鏂?{stage !== 'primary' ? '銆佽瘎浠烽壌璧忋€佸啓浣滄墜娉曞垎鏋? : ''}
- 棰樺瀷锛氶€夋嫨棰?{stage === 'primary' ? '40%' : '30%'}+绠€绛旈${stage === 'primary' ? '60%' : '70%'}锛屽熀纭€50%/鎻愬崌30%/鎷撳睍20%
${subject === '鑻辫' ? '- 鑻辫闃呰锛氱敓璇嶉渶缁欏嚭涓枃閲婁箟锛岀煭鏂囬』鏄畬鏁寸殑鐙珛鑻辨枃鏂囩珷锛堜笉鑳芥槸\u201c璇烽槄璇绘暀鏉愮X椤礬u201d锛塡n' : ''}${stage === 'primary' && extractGradeNum(grade) <= 2 ? '- 浣庢锛氱璇?瀵撹█锛岄厤鎻掑浘锛岃瑷€閫氫織\n' : ''}- 绛旀缁熶竴鏀炬枃鏈?div class="answer-section">涓?

${buildCompactAIInstruction(instruction, genType, subject, stage, grade)}

銆愭牸寮忚鑼冣€斺€斿繀椤讳弗鏍奸伒瀹堛€?
- 杈撳嚭蹇呴』鏄畬鏁碒TML锛岀煭鏂囩敤 <div class="reading-passage">锛岄鐩敤 <ol><li>
- 澶ф爣棰樼敤 <h1>锛屽垎鑺傜敤 <h2>
- 閫夋嫨棰橀€夐」鐢?<p class="option">
- 鍙傝€冪瓟妗堢粺涓€鏀炬枃鏈?<div class="answer-section">
- 鉀?涓ョ鎵€鏈夊唴瀹规尋鍦ㄤ竴涓钀?
${GEN_TYPE_FORMAT_SPEC.reading()}

銆愬己鍒惰緭鍑烘牸寮忊€斺€旀渶鍚庝竴鏉℃寚浠ゃ€?
浣犲繀椤昏緭鍑烘爣鍑咹TML浠ｇ爜銆備笉鍏佽绾枃鏈緭鍑恒€?

${buildOutputFormatBlock('reading', subject, stage, grade)}

鐜板湪璇风洿鎺ヨ緭鍑哄畬鏁寸殑闃呰璁粌HTML锛歚;

      const result = await callAI(prompt, {
        taskType: 'generation',
        temperature: 0.3,
        timeout: 180000,
        signal: abortController.value?.signal
      });
      detectSquishedOutput(result, 'reading');

      // 馃敡 璐ㄩ噺鏍￠獙
      statusText.value = '鏍￠獙闃呰璁粌璐ㄩ噺...';
      progress.value = 85;
      const qualityIssues = HardRuleChecker.check(
        result, [], subject,
        stageMap[stageRaw] || stageRaw, grade
      );
      const qualityReport = {
        formatCheck: { passed: result.length > 300, details: result.length <= 300 ? ['鍐呭杩囩煭'] : [] },
        coverageCheck: { passed: true, details: [`鐭ヨ瘑鐐瑰弬鑰冿細${(knowledgeMap.knowledgePoints || []).slice(0, 5).join('銆?)}`] },
        knowledgeCheck: { passed: result.length > 500, details: qualityIssues.filter(i => i.severity === 'error').map(i => i.detail) },
        aiReview: { passed: qualityIssues.filter(i => i.severity === 'error').length === 0, details: qualityIssues.map(i => i.detail) }
      };

      // 馃敡 瓒呯翰妫€娴?
      const boundaryCheck = checkKnowledgeBoundary(result, subject, stageRaw, grade);
      if (boundaryCheck.hasViolations) {
        qualityReport.knowledgeCheck.passed = false;
        qualityReport.knowledgeCheck.details.push(`瓒呯翰妫€娴嬪彂鐜?{boundaryCheck.summary.errorCount}澶勯棶棰榒);
      }

      progress.value = 100;
      statusText.value = '鐢熸垚瀹屾垚';
      isGenerating.value = false;
      return {
        success: true,
        content: result,
        blueprint: '',
        contentCards,
        knowledgeMap,
        generatedQuestions: [],
        parsedBlueprint: [],
        issues: qualityIssues.map(i => i.detail),
        qualityReport
      };
    } catch (e) {
      console.error('闃呰璁粌鐢熸垚澶辫触:', e);
      return { success: false, error: e.message };
    } finally {
      isGenerating.value = false;
    }
  };

  // 鉁?鏂板锛氬熀浜庡凡鏈夎摑鍥炬墽琛岀鍥涙鍜岀浜旀
  const executeGenerationWithBlueprint = async (
    instruction, genType, selectedBooks, selectedTemplates,
    blueprint, contentCards, knowledgeMap
  ) => {
    // 馃敡 姣忔鐢熸垚鍓嶅垱寤烘柊鐨?AbortController锛屽苟娉ㄥ唽鍒板叏灞€绠＄悊鍣?
    if (abortController.value) {
      unregisterController(abortController.value);
    }
    abortController.value = new AbortController();
    registerController(abortController.value);
    isGenerating.value = true;
    progress.value = 60;
    
    try {
      // 浠庢寚浠や腑鎻愬彇鎬诲垎
      let totalScore = 100;
      const scoreMatch = instruction.match(/鎬诲垎[锛?]\s*(\d+)/);
      if (scoreMatch) totalScore = parseInt(scoreMatch[1]);

      // 瑙ｆ瀽钃濆浘
      let parsedBlueprint = [];
      try {
        const parsePrompt = `璇峰皢浠ヤ笅鍛介钃濆浘瑙ｆ瀽涓篔SON鏁扮粍锛屾瘡涓厓绱犱唬琛ㄤ竴閬撻锛?

      ${blueprint}

      杩斿洖鏍煎紡锛?
      [
        {
          "number": 1,
          "type": "閫夋嫨棰榺濉┖棰榺瑙ｇ瓟棰榺...",
          "knowledgePoint": "鑰冩煡鐨勭煡璇嗙偣",
          "difficulty": "鍩虹|涓瓑|杈冮毦",
          "score": 鍒嗗€兼暟瀛?
          "sourceChapter": "瀵瑰簲鐨勮鏂?绔犺妭"
        }
      ]

      鍙繑鍥濲SON鏁扮粍锛屼笉瑕佸叾浠栧唴瀹广€俙;

        const parseResult = await callAI(parsePrompt);
        parsedBlueprint = await robustJsonParse(
          parseResult,
          (retryPrompt) => callAI(retryPrompt, { temperature: 0.1 }),
          '钃濆浘瑙ｆ瀽(纭妯″紡)'
        );
        console.log('鉁?钃濆浘瑙ｆ瀽鎴愬姛锛屽叡', parsedBlueprint.length, '棰?);
      } catch (e) {
        console.warn('钃濆浘瑙ｆ瀽澶辫触锛屽皢浣跨敤浼犵粺鏂瑰紡鐢熸垚:', e.message);
      }

      // 閫愰鐢熸垚
      let content = '';
      const generatedQuestions = [];

      if (parsedBlueprint.length > 0) {
        const totalQuestions = parsedBlueprint.length;
  
        // 鉁?鐢熸垚鎯呭閿氱偣锛堢粺涓€鎯呭椋庢牸鐨勫熀鐭筹級
        let situationAnchor = '';
        const styleMatch = instruction.match(/鍛介椋庢牸[锛?]\s*([^\n]+)/);
        const styleText = styleMatch ? styleMatch[1] : '';
        if (styleText.includes('缁熶竴鎯呭') || styleText.includes('鎯呭铻嶅悎') || styleText.includes('unified_context') || styleText.includes('context_fusion')) {
          try {
            const anchorPrompt = `璇蜂负浠ヤ笅璇曞嵎璁捐涓€涓疮绌垮叏鍗风殑缁熶竴鎯呭/涓婚鏁呬簨銆?
瀛︾锛?{selectedBooks?.[0]?.subject || ''}
骞寸骇锛?{selectedBooks?.[0]?.grade || ''}
鎬婚鏁帮細${totalQuestions}
鐭ヨ瘑鐐癸細${parsedBlueprint.map(q => q.knowledgePoint).slice(0, 5).join('銆?)}

瑕佹眰锛?
1. 鍙栦竴涓儏澧冨悕绉帮紙15瀛椾互鍐咃級
2. 鎻忚堪鎯呭鑳屾櫙锛?0瀛椾互鍐咃級
3. 鍒楀嚭3-5涓彲鐢ㄤ簬涓嶅悓棰樼洰鐨勫満鏅厓绱?

杩斿洖JSON锛歿"name":"鎯呭鍚嶇О","background":"鎯呭鑳屾櫙","scenes":["鍦烘櫙1","鍦烘櫙2"]}`;

            const anchorResult = await callAI(anchorPrompt, { temperature: 0.5 });
            try {
              const anchor = await robustJsonParse(anchorResult, null, '鎯呭閿氱偣');
              situationAnchor = `銆愮粺涓€鎯呭锛?{anchor.name}銆戣儗鏅細${anchor.background}銆傚彲鐢ㄥ満鏅細${(anchor.scenes || []).join('銆?)}銆傝鍦ㄦ鎯呭涓嬪懡鍒舵湰棰橈紝淇濇寔涓庡墠鍚庨鐩殑鍙欎簨杩炶疮鎬с€俙;
            } catch {
              // 鎯呭鐢熸垚澶辫触涓嶉樆濉?
            }
          } catch (e) {
            console.warn('鎯呭閿氱偣鐢熸垚澶辫触:', e.message);
          }
        }

        // 鉁?鏀堕泦宸茬敓鎴愰鐩憳瑕侊紝浣滀负涓婁笅鏂囦紶缁欏悗缁鐩?
        let generatedContext = [];

        for (let i = 0; i < totalQuestions; i++) {
          const questionPlan = parsedBlueprint[i];
    
          const genConfig2 = await getCurrentEngineConfigEnhanced('generation');
          const genModelName2 = getModelDisplayName(genConfig2.textModel || genConfig2.model);
          statusText.value = `鐢熸垚绗?{i+1}/${totalQuestions}棰?[${genModelName2}]...`;
          progress.value = 60 + Math.round((i / totalQuestions) * 25);

          // 鉁?鏋勫缓宸茬敓鎴愰鐩殑涓婁笅鏂囨憳瑕?
          let contextSummary = generatedContext.length > 0
            ? `銆愬凡鐢熸垚棰樼洰锛岃閬垮厤鐭ヨ瘑鐐归噸澶嶃€慭n${generatedContext.join('\n')}\n`
            : '';

          // 馃敡 鏂板锛氱粺璁″凡鐢熸垚棰樼洰鐨勫彞寮忕壒寰侊紝纭繚鍏ㄥ眬椋庢牸涓€鑷?
          let styleConsistencyHint = '';
          if (generatedContext.length > 2) {
            const recentQuestions = generatedQuestions.slice(-3);
            const sentenceStarts = [];
            const optionCounts = [];
            
            for (const q of recentQuestions) {
              const plainText = q.replace(/<[^>]+>/g, '').trim();
              const startMatch = plainText.match(/^\d+[\.銆侊紟]\s*(.{1,20})/);
              if (startMatch) {
                sentenceStarts.push(startMatch[1]);
              }
              const optionCount = (q.match(/<p class="option"/g) || []).length;
              if (optionCount > 0) {
                optionCounts.push(optionCount);
              }
            }
            
            if (sentenceStarts.length >= 2) {
              const allSame = sentenceStarts.every(s => 
                sentenceStarts[0].substring(0, 2) === s.substring(0, 2)
              );
              if (!allSame) {
                styleConsistencyHint = `銆愰鏍间竴鑷存€ф彁閱掋€戝墠鍑犻鐨勫彞寮忓紑澶翠负锛?{sentenceStarts.map(s => `"${s.substring(0, 15)}..."`).join('銆?)}銆傝淇濇寔鐩镐技鐨勮闂鏍煎拰鍙ュ紡缁撴瀯銆俙;
              }
            }
            
            if (optionCounts.length >= 2) {
              const avgOptions = Math.round(optionCounts.reduce((a, b) => a + b, 0) / optionCounts.length);
              if (optionCounts.some(c => c !== avgOptions)) {
                styleConsistencyHint += `\n銆愰€夐」涓€鑷存€ф彁閱掋€戝墠鍑犻閫夋嫨棰橀€夐」鏁伴噺涓嶄竴鑷达紝璇风粺涓€浣跨敤${avgOptions}涓€夐」銆俙;
              }
            }
          }
    
          // ========== 馃敡 浼樺寲锛氬姩鎬佷笂涓嬫枃绐楀彛绠＄悊 ==========
          // 瀹氫箟涓婁笅鏂囬绠楋紙鏍规嵁妯″瀷鑳藉姏璋冩暣锛宷wen2.5:14b 寤鸿棰勭暀 4000 tokens 缁欐牳蹇冩寚浠ゅ拰杈撳嚭锛?
          const MAX_CONTEXT_TOKENS = 5000;
          
          // 涓哄悇妯″潡鍒嗛厤棰勭畻
          const MATERIAL_BUDGET = Math.floor(MAX_CONTEXT_TOKENS * 0.45);   // 鏁欐潗鍘熸枃鏈€澶?5%
          const TEMPLATE_BUDGET = Math.floor(MAX_CONTEXT_TOKENS * 0.30);   // 妯℃澘鏍锋湰鏈€澶?0%
          const SUMMARY_BUDGET = Math.floor(MAX_CONTEXT_TOKENS * 0.15);    // 宸茬敓鎴愭憳瑕佹渶澶?5%
          // 鍓╀綑10%鐣欑粰鍏朵粬鍥哄畾鍐呭

          // ========== 1. 鏁欐潗鍘熸枃锛氬垎绾ф彁渚涳紙浼樺厛淇濊瘉鏍稿績娈靛畬鏁达級==========
          let materialContext = '';
          
          if (questionPlan.knowledgePoint) {
            const relatedSegments = semanticRetriever.findRelevant(
              questionPlan.knowledgePoint,
              8  // 鍏堝鍙栧嚑娈碉紝缁欏垎绾у嚱鏁版洿澶氶€夋嫨
            );
            
            if (relatedSegments.length > 0) {
              // 馃敡 浣跨敤鍒嗙骇鏋勫缓鍑芥暟锛屼紭鍏堜繚璇佹牳蹇冩瀹屾暣鎬?
              const gradedMaterial = buildGradedMaterialContext(relatedSegments, MATERIAL_BUDGET);
              materialContext = gradedMaterial.fullContext;
              
              if (materialContext) {
                const coreCount = (gradedMaterial.coreText.match(/\n\[/g) || []).length;
                const extCount = (gradedMaterial.extendedText.match(/\n\[/g) || []).length;
                console.log(`馃摎 棰?{questionPlan.number} 鏁欐潗涓婁笅鏂囷細鏍稿績${coreCount}娈?+ 鎵╁睍${extCount}娈礰);
              } else {
                materialContext = ''; // 娌℃湁鏈夋晥鍐呭锛屾竻绌?
              }
            }
          }
          
          // 闄嶇骇锛氬鏋滆涔夋绱㈡病鏈夌粨鏋滐紝浣跨敤绔犺妭鍘熸枃锛堜氦鐢?buildGradedMaterialContext 鎺у埗闀垮害锛?
          if (!materialContext && questionPlan.sourceChapter) {
            const relatedCard = contentCards.find(c => c.chapterTitle === questionPlan.sourceChapter);
            if (relatedCard && (relatedCard._fullChapterText || relatedCard.rawText || relatedCard.summary)) {
              const sourceText = relatedCard._fullChapterText || relatedCard.rawText || relatedCard.summary;
              // 瀵归檷绾у師鏂囦篃鍋氬垎娈碉紝璁?buildGradedMaterialContext 鎸?token 棰勭畻鍔ㄦ€佹埅鍙?
              const fallbackSegments = splitTextIntoSegments(sourceText, 500).map(seg => ({
                chapterTitle: relatedCard.chapterTitle,
                text: seg,
                type: '姝ｆ枃',
                isKeyConcept: false,
                isExample: false,
                isExercise: false
              }));
              const gradedFallback = buildGradedMaterialContext(fallbackSegments, MATERIAL_BUDGET);
              materialContext = gradedFallback.fullContext || `銆愭暀鏉愬弬鑰冦€慭n${sourceText.substring(0, Math.floor(MATERIAL_BUDGET * 1.5))}\n`;
            }
          }

          // ========== 2. 妯℃澘鏍锋湰锛氭寜棰勭畻鎴彇 ==========
          let templateContext = '';
          let templateTokens = 0;
          const templateCards = selectedTemplates?.[0]?.analysis?.questionCards || [];
          
          if (templateCards.length > 0) {
            const MAX_SAMPLES = 2;
            const templateSamples = findBestTemplateSamples(templateCards, questionPlan, MAX_SAMPLES);
            
            if (templateSamples.length > 0) {
              templateContext = `\n銆愭ā鏉垮弬鑰冮鈥斺€旇涓ユ牸妯′豢浠ヤ笅鐪熼鐨勯鏍笺€慭n`;
              let sampleCount = 0;
              
              for (let si = 0; si < templateSamples.length; si++) {
                const card = templateSamples[si];
                
                let cardText = `\n=== 妯℃澘鐪熼${si + 1}锛?{card.type}锛?{card.difficulty || '?'}闅惧害锛?{card.score || '?'}鍒嗭級===\n`;
                
                // 馃敡 淇锛氫紭鍏堜娇鐢ㄥ畬鏁撮骞诧紝涓嶆埅鏂?
                // 鍘熷洜锛氭埅鏂悗AI鏃犳硶鐪嬪埌瀹屾暣鐨勮闂柟寮忥紝褰卞搷椋庢牸瀵规爣
                let stem = card.stem || '';
                
                // 濡傛灉棰樺共杩囬暱锛屽皾璇曟櫤鑳芥埅鏂紙鍦ㄨ嚜鐒舵柇鐐瑰锛?
                const maxStemChars = Math.floor((TEMPLATE_BUDGET / MAX_SAMPLES) * 0.8);
                if (stem.length > maxStemChars) {
                  // 灏濊瘯鍦ㄥ彞鍙枫€侀棶鍙枫€佹劅鍙瑰彿澶勬埅鏂?
                  const naturalBreaks = ['銆?, '锛?, '锛?, '?', '!'];
                  let breakIndex = -1;
                  
                  for (const mark of naturalBreaks) {
                    const idx = stem.lastIndexOf(mark, maxStemChars);
                    if (idx > maxStemChars * 0.6) {  // 鑷冲皯鍦?0%浣嶇疆涔嬪悗
                      breakIndex = idx + 1;
                      break;
                    }
                  }
                  
                  if (breakIndex > 0) {
                    stem = stem.substring(0, breakIndex) + '...';
                  } else {
                    // 娌℃湁鑷劧鏂偣锛岀洿鎺ユ埅鏂絾娣诲姞鏄庣‘鏍囪
                    stem = stem.substring(0, maxStemChars) + '...锛堥骞茶繃闀垮凡鎴柇锛?;
                  }
                }
                cardText += `棰樺共锛?{stem}\n`;
                
                // 閫夐」锛堝彧淇濈暀鍓?涓級
                if (card.options?.length) {
                  const options = card.options.slice(0, 4);
                  cardText += `閫夐」锛?{options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join(' | ')}\n`;
                }
                
                // 鍏抽敭鐗瑰緛
                if (card.questionFeature) {
                  cardText += `璁鹃棶鐗瑰緛锛?{card.questionFeature.substring(0, 30)}\n`;
                }
                
                const cardTokens = estimateTokens(cardText);
                if (templateTokens + cardTokens > TEMPLATE_BUDGET) {
                  if (sampleCount === 0) {
                    templateContext += cardText;
                    sampleCount++;
                  }
                  break;
                }
                
                templateContext += cardText;
                templateTokens += cardTokens;
                sampleCount++;
              }
              
              if (sampleCount > 0) {
                templateContext += `\n銆愭敞鎰忋€戦鐩簲鍦ㄩ骞查暱搴︺€佸彞寮忕粨鏋勩€侀€夐」鏁伴噺涓婁笌浠ヤ笂鐪熼淇濇寔涓€鑷淬€俙;
              } else {
                templateContext = '';
              }
            }
          }

          // ========== 3. 宸茬敓鎴愰鐩憳瑕侊細鍙繚鐣欐渶杩?閬?==========
          contextSummary = '';
          if (generatedContext.length > 0) {
            const recentContext = generatedContext.slice(-3);
            contextSummary = `銆愬凡鐢熸垚棰樼洰锛堥伩鍏嶇煡璇嗙偣鍜屾儏澧冮噸澶嶏級銆慭n${recentContext.join('\n')}\n`;
            
            const summaryTokens = estimateTokens(contextSummary);
            if (summaryTokens > SUMMARY_BUDGET) {
              const shorter = generatedContext.slice(-2);
              contextSummary = `銆愬凡鐢熸垚棰樼洰銆?{shorter.join('锛?)}`;
              if (estimateTokens(contextSummary) > SUMMARY_BUDGET) {
                contextSummary = `銆愪笂涓€棰樸€?{generatedContext[generatedContext.length - 1]}`;
              }
            }
          }

          // ========== 4. 鏃ュ織锛氳緭鍑哄悇妯″潡浣跨敤閲忥紙鏂逛究璋冭瘯锛?==========
          const coreCount = materialContext ? (materialContext.match(/鏍稿績鏁欐潗鍘熸枃/g) || []).length : 0;
          const extCount = materialContext ? (materialContext.match(/琛ュ厖鍙傝€?g) || []).length : 0;
          console.log(`馃搳 棰?{questionPlan.number} 涓婁笅鏂囦娇鐢?
          鏁欐潗鍘熸枃: 鏍稿績娈?+ 鎵╁睍娈?(棰勭畻${MATERIAL_BUDGET} tokens)
          妯℃澘鏍锋湰: ${templateContext ? '宸叉敞鍏? : '鏃?} (棰勭畻${TEMPLATE_BUDGET} tokens)
          宸茬敓鎴愭憳瑕? ${estimateTokens(contextSummary)} tokens (棰勭畻${SUMMARY_BUDGET})`);

          // 馃敡 鏂板锛氱患鍚堥棰濆涓婁笅鏂?
          let integratedContext = '';
          if (questionPlan.knowledgePoint && questionPlan.knowledgePoint.startsWith('缁煎悎锛?)) {
            const kps = questionPlan.knowledgePoint.replace('缁煎悎锛?, '').split(/[銆侊紝,]/).map(k => k.trim());
            integratedContext = `\n鈿狅笍 杩欐槸涓€閬撶患鍚堥锛岄渶瑕佽瀺鍚堜互涓嬬煡璇嗙偣锛?{kps.join('銆?)}\n`;
            integratedContext += `璇峰垱璁句竴涓湡瀹炴儏澧冿紝灏嗕笂杩扮煡璇嗙偣鑷劧铻嶅悎鍦ㄤ竴涓棶棰樹腑銆俓n`;
            integratedContext += `鍚勭煡璇嗙偣鐨勮€冩煡鏉冮噸搴斿ぇ鑷村潎琛°€俓n`;
            if (questionPlan.cognitiveLevel === '鍒嗘瀽' || questionPlan.cognitiveLevel === '璇勪环') {
              integratedContext += `闇€瑕佷綋鐜伴珮闃舵€濈淮锛堝垎鏋?璇勪环锛夛紝涓嶆浜庣畝鍗曞簲鐢ㄣ€俓n`;
            }
          }

          // 馃敡 鎸夐鍨嬩粠鎸囦护搴撴煡璇㈣川閲忕害鏉燂紙鏇夸唬纭紪鐮?typeSpecificRules锛?
          const TYPE_TO_GENTYPE = { '閫夋嫨棰?: 'choice', '濉┖棰?: 'fill', '鍒ゆ柇棰?: 'truefalse', '璁＄畻棰?: 'calc', '瑙ｇ瓟棰?: 'answer', '搴旂敤棰?: 'word_problem', '瀹為獙棰?: 'experiment' };
          const typeGenType = TYPE_TO_GENTYPE[questionPlan.type];
          const typeBlocks = typeGenType ? getMatchingBlockInstructions({ category: '生成-题型专项要求', genType: typeGenType }) : [];
          const typeRule = typeBlocks.length > 0 ? typeBlocks[0].content : '';

          const questionPrompt = `璇风敓鎴愮${questionPlan.number}棰樸€?

          ${situationAnchor}
          ${contextSummary}
          ${styleConsistencyHint}
          銆愰鐩姹傘€?
          - 棰樺彿锛?{questionPlan.number}
          - 棰樺瀷锛?{questionPlan.type}
          - 鑰冩煡鐭ヨ瘑鐐癸細${questionPlan.knowledgePoint}
          - 闅惧害锛?{questionPlan.difficulty}
          - 鍒嗗€硷細${questionPlan.score}鍒?
          - 瀵瑰簲绔犺妭锛?{questionPlan.sourceChapter || ''}
          ${integratedContext}

          ${materialContext}
          ${templateContext}
          ${typeRule}
          ${(() => {
            const tpl = selectedTemplates?.[0];
            const profiles = tpl?.analysis?.typeLanguageProfiles;
            if (!profiles || !questionPlan.type) return '';
            const profile = profiles[questionPlan.type];
            if (!profile) return '';
            let hint = '\n銆愭ā鏉胯瑷€椋庢牸绾︽潫銆慭n';
            if (profile.avgStemLength) hint += '- 鍙傝€冮骞查暱搴︼細绾? + profile.avgStemLength + '瀛梊n';
            if (profile.commonPatterns?.length) hint += '- 鍙傝€冨彞寮忥細' + profile.commonPatterns.slice(0, 2).join('銆?) + '\n';
            if (profile.hasPlease) hint += '- 甯哥敤"璇?寮曞\n';
            if (profile.sampleStem) hint += '- 鍏稿瀷绀轰緥锛氥€? + profile.sampleStem + '銆峔n';
            return hint;
          })()}

          銆愰槻骞昏绾︽潫鈥斺€斿繀椤婚伒瀹堛€?
          1. 鉀?鏈鍙兘鑰冩煡鐭ヨ瘑鐐?${questionPlan.knowledgePoint}"锛屼笉寰楁墿灞曞埌鍏朵粬鏈寚瀹氱殑鐭ヨ瘑鐐?
          2. 鉀?棰樺共涓秹鍙婄殑鏁版嵁銆佸叕寮忋€佹蹇靛繀椤讳笌鏁欐潗鍘熸枃涓€鑷达紝涓嶅緱鑷缂栭€?
          3. 鉀?绛旀蹇呴』鏄‘瀹氫笖姝ｇ‘鐨勶紝涓嶈兘妯℃１涓ゅ彲

          璇峰彧鐢熸垚杩欎竴閬撻锛屾牸寮忎负HTML鐗囨锛?
          - 棰樺彿鐢?<span class="question-number">${questionPlan.number}.</span>
          - 棰樺共鐢?<p class="question">
          - 閫夋嫨棰橀€夐」鐢?<p class="option">
          - 馃幆 **濉┖棰樻爣璁版櫤鑳介€夋嫨**锛氭牴鎹瓟妗堢被鍨嬪拰闀垮害閫夋嫨鍚堥€傜殑鏍囪锛堣涓婃柟涓撻」瑕佹眰锛?
          - 濡傛灉鏄В绛旈锛岀暀鍑鸿В绛斿尯鍩?
          - 鍦ㄨ繖閬撻鍚庢爣娉細銆愮煡璇嗙偣锛?{questionPlan.knowledgePoint}銆戙€愰毦搴︼細${questionPlan.difficulty}銆?

          鍙繑鍥炶繖涓€閬撻鐨凥TML浠ｇ爜锛屼笉瑕佹坊鍔燶`\`\`html鏍囪銆俙;

          try {
            // 馃敡 浼樺寲锛氱涓€棰樺墠妫€鏌ユā鍨嬬姸鎬侊紝鍚庣画棰樹箣闂寸瓑寰?绉?
            if (i === 0) {
              console.log('馃敟 棰樼洰鐢熸垚锛氭鏌ユā鍨嬬姸鎬?..');
              try {
                const result = await checkModelReady(null, 3, 'text');
                
                if (!result.ready) {
                  console.log(`鈿狅笍 妯″瀷鏈氨缁紝鏍规嵁鍝嶅簲鏃堕棿鍔ㄦ€佺瓑寰?.. (${result.responseTime}ms)`);
                  const additionalWait = Math.max(2000, Math.min(4000, result.responseTime / 10));
                  await new Promise(r => setTimeout(r, additionalWait));
                } else {
                  console.log(`鉁?鏂囨湰鐢熸垚妯″瀷宸插氨缁紝绔嬪嵆寮€濮嬶紙鍝嶅簲鏃堕棿: ${result.responseTime}ms, 灏濊瘯${result.attempts}娆★級`);
                }
              } catch (e) {
                console.warn('鈿狅笍 妯″瀷妫€娴嬪け璐ワ紝绛夊緟3绉掑悗缁х画...', e.message);
                await new Promise(r => setTimeout(r, 3000));
              }
            } else {
              // 棰樹箣闂寸瓑寰?绉掞紝璁╂ā鍨嬫仮澶?
              console.log(`鈴?绗?{i+1}棰樹箣鍓嶇瓑寰?绉?..`);
              await new Promise(r => setTimeout(r, 2000));
            }

            const questionContent = await callAI(questionPrompt, { 
              taskType: 'generation',    // 鉁?棰樼洰鐢熸垚鐢ㄩ噸鍨嬫ā鍨?
              timeout: 120000,           // 鍗曢缁?鍒嗛挓
              allowContinuation: true    // 馃敡 鍏佽棰樼洰鐢熸垚鏃惰嚜鍔ㄧ画鍐?
            });
            generatedQuestions.push(questionContent);
            
            // 鉁?鏂板锛氶€愰鑷楠岃瘉
            let validationNote = '';
            
            // 馃敡 澧炲己锛氱‖鎬ц鍒欓獙璇侊紙鍏堜簬AI楠岃瘉锛屾垚鏈綆銆侀€熷害蹇級
            try {
              const book = selectedBooks?.[0];
              const rawSubject = book?.subject || '';
              const stage = book?.stage || '';
              const subject = normalizeSubjectName(rawSubject, stage);
              
              const hardResults = runHardValidators(questionContent, subject);
              
              if (hardResults.length > 0) {
                const errors = [];
                const warnings = [];
                
                for (const result of hardResults) {
                  if (result.passed === false) {
                    const prefix = result.severity === 'error' ? '鉂? : '鈿狅笍';
                    const note = `${prefix} [${result.name}] ${result.message}`;
                    
                    if (result.severity === 'error') {
                      errors.push(note);
                    } else {
                      warnings.push(note);
                    }
                    
                    validationNote += `<!-- ${note} -->\n`;
                    console.warn(`棰?{questionPlan.number}${note}`);
                  }
                }
                
                const fixedContent = applyAutoFixes(questionContent, hardResults);
                if (fixedContent !== questionContent) {
                  const idx = generatedQuestions.indexOf(questionContent);
                  if (idx >= 0) {
                    generatedQuestions[idx] = fixedContent;
                    console.log(`馃敡 棰?{questionPlan.number} 鑷姩淇瀹屾垚`);
                  }
                }
                
                if (errors.length > 0) {
                  console.warn(`鈿狅笍 棰?{questionPlan.number} 瀛樺湪 ${errors.length} 涓弗閲嶉敊璇痐);
                  validationNote += `<!-- 鈿狅笍鈿狅笍鈿狅笍 鏈瀛樺湪涓ラ噸瑙勫垯杩濆弽锛岃浜哄伐瀹℃煡 鈿狅笍鈿狅笍鈿狅笍 -->\n`;
                  validationNote += `<!-- 閿欒鍒楄〃锛歕n${errors.join('\n')}\n-->\n`;
                }
                
                if (warnings.length > 0) {
                  console.log(`馃摑 棰?{questionPlan.number} 瀛樺湪 ${warnings.length} 涓鍛奰);
                }
              }
            } catch (e) {
              console.warn('纭€ц鍒欓獙璇佸け璐?', e.message);
            }
            try {
              const validatePrompt = `璇峰鏌ヨ繖閬撻鐩紝妫€鏌ョ煡璇嗙偣鍖归厤搴﹀拰绉戝鎬э細

銆愰鐩唴瀹广€?
${questionContent.replace(/<[^>]+>/g, '').substring(0, 500)}

銆愬懡棰樿姹傘€?
鐭ヨ瘑鐐癸細${questionPlan.knowledgePoint}
闅惧害锛?{questionPlan.difficulty}
棰樺瀷锛?{questionPlan.type}

璇烽€愪竴妫€鏌ュ苟鍙繑鍥濲SON锛?
{
  "knowledgeMatch": true,
  "knowledgeMatchReason": "棰樼洰纭疄鑰冩煡浜嗚鐭ヨ瘑鐐?,
  "hasScienceError": false,
  "scienceErrorDetail": "",
  "answerCorrect": true,
  "suggestion": ""
}`;

              const validateResult = await callAI(validatePrompt, { 
                taskType: 'questionValidation',  // 馃敡 浣跨敤鐙珛楠岃瘉绛栫暐
                temperature: 0,                  // 馃敡 闄嶅埌0锛岀‘淇濆瑙?
                timeout: 30000 
              });
              try {
                const validation = await robustJsonParse(validateResult, null, '棰樼洰楠岃瘉');
                if (!validation.knowledgeMatch) {
                  validationNote = `<!-- 鈿狅笍 鐭ヨ瘑鐐瑰尮閰嶉棶棰橈細${validation.knowledgeMatchReason || '鏈煡'} -->`;
                }
                if (validation.hasScienceError) {
                  validationNote += `<!-- 鉂?绉戝鎬ч敊璇細${validation.scienceErrorDetail || '鏈煡'} -->`;
                }
                if (!validation.answerCorrect) {
                  validationNote += `<!-- 鈿狅笍 绛旀鍙兘鏈夎 -->`;
                }
                
                // 鉁?鐙珛鏁板楠岃瘉
                const mathTypes = ['璁＄畻棰?, '瑙ｇ瓟棰?, '搴旂敤棰?, '閫夋嫨棰?, '濉┖棰?];
                if (mathTypes.includes(questionPlan.type) && questionContent.length > 20) {
                  try {
                    const mathVerifyPrompt = `璇疯绠楄繖閬撻鐨勬纭粨鏋滐紝鍙緭鍑烘渶缁堢瓟妗堬紙涓嶉渶瑕佽繃绋嬶級锛?

${questionContent.replace(/<[^>]+>/g, '').substring(0, 800)}

鍙緭鍑虹瓟妗堬紝涓嶈瑙ｉ噴銆俙;
                    
                    const independentAnswer = await callAI(mathVerifyPrompt, {
                      taskType: 'questionValidation',
                      temperature: 0,
                      timeout: 30000,
                      retries: 0
                    });
                    
                    const answerMatch = questionContent.match(/绛旀[锛?]\s*(.+?)(?:<|$|\n)/);
                    const originalAnswer = answerMatch ? answerMatch[1].trim() : '';
                    
                    if (independentAnswer && originalAnswer && 
                        independentAnswer.trim() !== originalAnswer.trim()) {
                      const normalize = (s) => s.replace(/\s+/g, '').replace(/[锛?]/g, '');
                      if (normalize(independentAnswer) !== normalize(originalAnswer)) {
                        validationNote += `<!-- 鈿狅笍 鐙珛楠岀畻涓嶄竴鑷?-->`;
                      }
                    }
                  } catch {
                    // 鏁板楠岃瘉澶辫触涓嶉樆濉?
                  }
                }
                
                if (validationNote) {
                  const idx = generatedQuestions.indexOf(questionContent);
                  if (idx >= 0) {
                    generatedQuestions[idx] = validationNote + '\n' + questionContent;
                  }
                }
              } catch {
                // 楠岃瘉瑙ｆ瀽澶辫触涓嶉樆濉?
              }
            } catch {
              // 楠岃瘉璋冪敤澶辫触涓嶉樆濉?
            }
            
            // 鉁?鎻愬彇鎽樿
            try {
              const summary = await callAI(
                `鐢?5瀛椾互鍐呮鎷繖閬撻锛?{questionContent}`,
                { taskType: 'generation', temperature: 0.1 }
              );
              generatedContext.push(`绗?{questionPlan.number}棰?${questionPlan.type},${questionPlan.knowledgePoint}): ${summary.trim()}`);
            } catch {
              generatedContext.push(`绗?{questionPlan.number}棰?${questionPlan.type},${questionPlan.knowledgePoint})`);
            }
          } catch (e) {
            console.warn(`绗?{i+1}棰樼敓鎴愬け璐?`, e.message);
            generatedQuestions.push(`<p class="question"><span class="question-number">${questionPlan.number}.</span> 銆愮敓鎴愬け璐ャ€?/p>`);
            generatedContext.push(`绗?{questionPlan.number}棰樸€愮敓鎴愬け璐ャ€慲);
          }
        }
  
        statusText.value = '姝ｅ湪缁勮...';
        progress.value = 88;

        const headerPrompt = `鐢熸垚璇曞嵎澶撮儴HTML锛氬绉?{selectedBooks?.[0]?.subject || ''}锛屽勾绾?{selectedBooks?.[0]?.grade || ''}锛屾€诲垎${totalScore}鍒嗐€傜敤<h1>鏍囬銆俙;

        try {
          const header = await callAI(headerPrompt, { 
            taskType: 'generation', temperature: 0.3 
          });
          content = header + '\n\n' + generatedQuestions.join('\n\n');
        } catch (e) {
          content = generatedQuestions.join('\n\n');
        }
      } else {
        // 闄嶇骇
        statusText.value = '闄嶇骇鐢熸垚涓?..';
        progress.value = 70;
        
        const prompt4 = `璇锋牴鎹摑鍥剧敓鎴愬畬鏁磋祫鏂欍€俓n钃濆浘锛?{blueprint}\n鏍煎紡瑕佹眰锛欻TML锛岄骞茬敤<p class="question">銆俙;
        try {
          content = await callAI(prompt4, { 
            taskType: 'generation',      // 鉁?
            timeout: 180000 
          });
          detectSquishedOutput(content, 'exam-downgrade2');
        } catch (e) {
          throw e;
        }
      }
      
      // ========== 绗簲姝ワ細澶氱淮搴﹁川閲忔牎楠?==========
      statusText.value = '璐ㄩ噺鏍￠獙涓?..';
      progress.value = 90;

      const issues = [];
      
      // ========== 馃敡 鏂板锛氱‖鎬ц鍒欐鏌ワ紙绗竴绾э級 ==========
      const book = selectedBooks?.[0];
      const stageRaw = book?.stage || '';
      const stageMap = { '灏忓': 'primary', '鍒濅腑': 'middle', '楂樹腑': 'high' };
      const hardIssues = HardRuleChecker.check(
        content, 
        parsedBlueprint, 
        book?.subject || '', 
        stageMap[stageRaw] || stageRaw,
        book?.grade || ''
      );
      
      // 鍚堝苟纭€ф鏌ラ棶棰?
      hardIssues.forEach(issue => {
        issues.push(`${issue.severity === 'error' ? '鉂? : '鈿狅笍'} ${issue.detail}`);
      });

      // 鑷姩淇鍙慨澶嶇殑闂
      if (hardIssues.some(i => i.autoFix)) {
        content = HardRuleChecker.autoFix(content, hardIssues);
      }

      // ========== 馃敡 鏂板锛氳秴绾叉娴嬶紙鍩轰簬璇炬爣鐭ヨ瘑杈圭晫锛?=========
      if (book && content.length > 100) {
        const rawSubj = book?.subject || '';
        const stg = book?.stage || '';
        const grd = book?.grade || '';
        const subj = normalizeSubjectName(rawSubj, stg);
        
        const boundaryCheck = checkKnowledgeBoundary(content, subj, stg, grd);
        
        if (boundaryCheck.hasViolations) {
          boundaryCheck.violations.forEach(v => {
            const prefix = v.severity === 'error' ? '鉂? : '鈿狅笍';
            issues.push(`${prefix} 瓒呯翰妫€娴嬶細${v.message}`);
          });
        }
        
        console.log('馃搵 瓒呯翰妫€娴嬪畬鎴?', boundaryCheck.summary);
      }

      // 鍒濆鍖栬川閲忔姤鍛婏紙蹇呴』鍦ㄦ墍鏈変娇鐢ㄤ箣鍓嶅畾涔夛級
      const qualityReport = {
        formatCheck: { passed: true, details: [] },
        coverageCheck: { passed: true, details: [] },
        difficultyCheck: { passed: true, details: [] },
        knowledgeCheck: { passed: true, details: [] },
        templateMatch: { passed: true, details: [] },
        aiReview: { passed: true, details: [] }
      };

      // 璁板綍纭€ф鏌ョ粨鏋?
      const hardIssueSummary = HardRuleChecker.getIssueSummary(hardIssues);
      if (hardIssueSummary.hasErrors) {
        qualityReport.formatCheck.passed = false;
        qualityReport.formatCheck.details.push(`纭€ц鍒欐鏌ュ彂鐜?{hardIssueSummary.errors}涓敊璇痐);
      }
      if (hardIssueSummary.hasWarnings) {
        qualityReport.formatCheck.details.push(`纭€ц鍒欐鏌ュ彂鐜?{hardIssueSummary.warnings}涓鍛奰);
      }

      // 鏍煎紡妫€鏌?
      if (!content.includes('<p class="question"') && !content.includes('<h')) {
        issues.push('鉂?鍙兘鏈繑鍥濰TML鏍煎紡');
        qualityReport.formatCheck.passed = false;
      }

      const questionMatches = content.match(/<p class="question"/g);
      const questionCount = questionMatches ? questionMatches.length : 0;
      if (questionCount === 0) {
        issues.push('鉂?鏈娴嬪埌棰樼洰');
        qualityReport.formatCheck.passed = false;
      }

      // 馃敡 鏂板锛氱瓟妗堝尯鍩熷畬鏁存€ф鏌?
      if (content.includes('answer-section') && parsedBlueprint.length > 0) {
        const answerMatch = content.match(/<div class="answer-section">([\s\S]*?)<\/div>/i);
        if (answerMatch) {
          const answerContent = answerMatch[1];
          const answerMarkers = answerContent.match(/绛旀[锛?]/g) || [];
          const answerCount = answerMarkers.length;
          
          if (answerCount === 0) {
            issues.push('鈿狅笍 绛旀鍖哄煙瀛樺湪浣嗘湭妫€娴嬪埌绛旀鏍囪');
            qualityReport.formatCheck.details.push('绛旀鍖哄煙缂哄皯绛旀鏍囪');
          } else if (answerCount < questionCount * 0.8) {
            issues.push(`鈿狅笍 绛旀鏁伴噺(${answerCount})鏄庢樉灏戜簬棰樼洰鏁伴噺(${questionCount})锛屽彲鑳界己澶遍儴鍒嗙瓟妗坄);
            qualityReport.formatCheck.details.push(`绛旀鏁伴噺${answerCount}锛岄鐩暟閲?{questionCount}`);
          }
          
          const skippedAnswers = (answerContent.match(/绛旀[锛?]\s*鐣?g) || []).length;
          if (skippedAnswers > 0) {
            issues.push(`鈿狅笍 鏈?{skippedAnswers}閬撻鐨勭瓟妗堟爣娉ㄤ负"鐣?锛屽簲鎻愪緵瀹屾暣绛旀`);
          }
        }
      }

      // 馃敡 鏂板锛歀aTeX 鍏紡璇硶鍩虹鏍￠獙
      if (book && ['鏁板', '鐗╃悊', '鍖栧'].includes(book.subject || '')) {
        const dollarCount = (content.match(/\$/g) || []).length;
        if (dollarCount % 2 !== 0) {
          issues.push('鈿狅笍 琛屽唴鍏紡绗﹀彿$鏈棴鍚堬紙濂囨暟涓?锛?);
          qualityReport.formatCheck.details.push('妫€娴嬪埌鏈棴鍚堢殑$鍏紡绗﹀彿');
        }
        
        const doubleDollarCount = (content.match(/\$\$/g) || []).length;
        if (doubleDollarCount % 2 !== 0) {
          issues.push('鈿狅笍 鐙珛鍏紡绗﹀彿$$鏈厤瀵?);
          qualityReport.formatCheck.details.push('妫€娴嬪埌鏈厤瀵圭殑$$鍏紡绗﹀彿');
        }
        
        const latexErrors = [
          { pattern: /\\frac\{\}/, message: '\\frac{} 缂哄皯鍙傛暟' },
          { pattern: /\\sqrt\{\}/, message: '\\sqrt{} 缂哄皯鍙傛暟' },
          { pattern: /\{\\frac/, message: '鎷彿浣嶇疆閿欒锛堝簲鍦╘\frac涔嬪悗锛? },
          { pattern: /[^\\]_\{[^}]*$/, message: '涓嬫爣{}鍙兘鏈棴鍚? },
          { pattern: /[^\\]\^\{[^}]*$/, message: '涓婃爣{}鍙兘鏈棴鍚? }
        ];
        
        for (const error of latexErrors) {
          if (error.pattern.test(content)) {
            issues.push(`鈿狅笍 LaTeX璇硶闂锛?{error.message}`);
          }
        }
      }

      // 鐭ヨ瘑鐐硅鐩栫巼鏍￠獙
      if (parsedBlueprint.length > 0) {
        const coverageResult = checkKnowledgeCoverage(parsedBlueprint, knowledgeMap);
        qualityReport.coverageCheck.details.push(
          `鐭ヨ瘑鐐硅鐩栵細${coverageResult.covered}/${coverageResult.total}锛?{coverageResult.rate}%锛塦
        );
        const rateThreshold = genType === 'exam' ? 90 : (genType === 'practice' ? 80 : 70);
        if (coverageResult.rate < rateThreshold) {
          issues.push(`鈿狅笍 鐭ヨ瘑鐐硅鐩栫巼鍋忎綆锛?{coverageResult.rate}%锛岀洰鏍?{rateThreshold}%锛夛紝鏈鐩栵細${coverageResult.uncovered.slice(0, 5).join('銆?)}${coverageResult.uncovered.length > 5 ? '绛? + coverageResult.uncovered.length + '涓? : ''}`);
          qualityReport.coverageCheck.passed = false;
        }
        if (coverageResult.duplicatedKPs && coverageResult.duplicatedKPs.length > 0) {
          issues.push(`鈿狅笍 閲嶅鑰冩煡锛?{coverageResult.duplicatedKPs.slice(0, 3).join('銆?)}`);
        }

        // 馃敡 鏂板锛氶噸闅剧偣鍔犳潈瑕嗙洊鐜?
        if (coverageResult.keyDifficultyCoverage) {
          const kdc = coverageResult.keyDifficultyCoverage;
          qualityReport.coverageCheck.details.push(
            `閲嶉毦鐐硅鐩栵細${kdc.covered}/${kdc.total}锛?{kdc.rate}%锛塦
          );
          if (kdc.rate < 100) {
            issues.push(`鈿狅笍 閲嶉毦鐐规湭瀹屽叏瑕嗙洊锛岀己澶憋細${kdc.uncovered.join('銆?)}`);
            qualityReport.coverageCheck.passed = false;
          }
        }
        qualityReport.difficultyCheck.details.push(
          `钃濆浘瑙勫垝${parsedBlueprint.length}棰橈紝瀹為檯鐢熸垚${questionCount}棰榒
        );
      }

      // ========== 绗簩绾э細AI绉戝鎬у拰鐭ヨ瘑鐐瑰鏌?==========
      if (content.length > 100 && parsedBlueprint.length > 0) {
        const reviewConfig = await getCurrentEngineConfigEnhanced('review');
        const reviewModelName = getModelDisplayName(reviewConfig.textModel || reviewConfig.model);
        statusText.value = `姝ラ 5/5锛欰I瀹℃煡 [${reviewModelName}]...`;
        
        try {
          const reviewPrompt = `浣犳槸鏁欒偛璐ㄩ噺瀹℃煡涓撳銆傝瀹℃煡浠ヤ笅璇曞嵎鍐呭锛?

銆愬懡棰樿摑鍥俱€?
${parsedBlueprint.map(q => `棰?{q.number}锛?{q.type}锛岀煡璇嗙偣=${q.knowledgePoint}锛岄毦搴?${q.difficulty}锛屽垎鍊?${q.score}`).join('\n')}

銆愮敓鎴愬唴瀹瑰墠1500瀛椼€?
${(() => {
  if (content.length <= 2000) return content;
  const head = content.substring(0, 1000);
  const tail = content.substring(Math.max(0, content.length - 1000));
  return head + '\n...(涓棿閮ㄥ垎宸茬渷鐣ワ紝鍏? + content.length + '瀛?...\n' + tail;
})()}

璇锋鏌ュ苟杩斿洖JSON锛?
{
  "scienceIssues": ["绉戝鎬ч敊璇?", "绉戝鎬ч敊璇?"],
  "knowledgeMatchIssues": ["棰榅鏍囨敞鐭ヨ瘑鐐筜浣嗗疄闄呰€冩煡Z"],
  "difficultyMatchIssues": ["棰榅鏍囨敞闅惧害鍩虹浣嗗疄闄呭亸闅?],
  "optionQualityIssues": ["棰榅閫夐」鏃犲尯鍒嗗害"],
  "overallScore": 8,
  "suggestions": ["鏀硅繘寤鸿1"]
}

鍙繑鍥濲SON銆俙;

          const reviewResult = await callAI(reviewPrompt, { 
            taskType: 'review',
            temperature: 0.1, 
            timeout: 60000 
          });
          try {
            const review = await robustJsonParse(reviewResult, null, 'AI璐ㄩ噺瀹℃煡');
            
            if (review.scienceIssues?.length > 0) {
              review.scienceIssues.forEach(s => issues.push(`馃敩 ${s}`));
              qualityReport.aiReview.details.push(...review.scienceIssues);
            }
            if (review.knowledgeMatchIssues?.length > 0) {
              review.knowledgeMatchIssues.forEach(k => issues.push(`馃摎 ${k}`));
              qualityReport.knowledgeCheck.details.push(...review.knowledgeMatchIssues);
            }
            if (review.difficultyMatchIssues?.length > 0) {
              review.difficultyMatchIssues.forEach(d => issues.push(`馃搹 ${d}`));
              qualityReport.difficultyCheck.details.push(...review.difficultyMatchIssues);
            }
            if (review.overallScore < 6) {
              qualityReport.aiReview.passed = false;
              issues.push(`鈿狅笍 AI缁煎悎璇勫垎鍋忎綆(${review.overallScore}/10)`);
            }
            qualityReport.aiReview.details.push(`缁煎悎璇勫垎: ${review.overallScore}/10`);
            if (review.suggestions?.length > 0) {
              qualityReport.aiReview.details.push(`寤鸿: ${review.suggestions.join('锛?)}`);
            }
          } catch {
            qualityReport.aiReview.details.push('AI瀹℃煡璺宠繃锛堣В鏋愬け璐ワ級');
          }
        } catch (e) {
          console.warn('AI璐ㄩ噺瀹℃煡澶辫触:', e.message);
          qualityReport.aiReview.details.push('AI瀹℃煡璺宠繃锛堣皟鐢ㄥけ璐ワ級');
        }
      }

      // ========== 绗笁绾э細妯℃澘瀵规爣閲忓寲 ==========
      if (selectedTemplates?.length > 0 && selectedTemplates[0]?.analysis?.questionCards?.length > 0) {
        const templateCards = selectedTemplates[0].analysis.questionCards;
        
        const templateTypeDist = {};
        const generatedTypeDist = {};
        templateCards.forEach(c => templateTypeDist[c.type] = (templateTypeDist[c.type] || 0) + 1);
        parsedBlueprint.forEach(q => generatedTypeDist[q.type] = (generatedTypeDist[q.type] || 0) + 1);
        
        const allTypes = [...new Set([...Object.keys(templateTypeDist), ...Object.keys(generatedTypeDist)])];
        let matchScore = 0;
        allTypes.forEach(t => {
          const tCount = templateTypeDist[t] || 0;
          const gCount = generatedTypeDist[t] || 0;
          if (tCount > 0 && gCount > 0) matchScore++;
        });
        const typeMatchRate = allTypes.length > 0 ? Math.round(matchScore / allTypes.length * 100) : 100;
        
        qualityReport.templateMatch.details.push(
          `棰樺瀷鍖归厤搴? ${typeMatchRate}%锛?{matchScore}/${allTypes.length}绫婚鍨嬶級`
        );
        
        // 馃敡 鏂板锛氶骞查暱搴﹀垎甯冨姣?
        const templateStemLengths = templateCards.filter(c => c.stem).map(c => c.stem.length);
        const generatedStemTexts = content.match(/<p class="question"[^>]*>([^<]*)<\/p>/g) || [];
        const generatedStemLengths = generatedStemTexts.map(s => s.replace(/<[^>]+>/g, '').length);
        
        if (templateStemLengths.length > 0 && generatedStemLengths.length > 0) {
          const templateAvgStem = Math.round(templateStemLengths.reduce((a, b) => a + b, 0) / templateStemLengths.length);
          const generatedAvgStem = Math.round(generatedStemLengths.reduce((a, b) => a + b, 0) / generatedStemLengths.length);
          const stemDeviation = Math.abs(generatedAvgStem - templateAvgStem);
          
          qualityReport.templateMatch.details.push(
            `妯℃澘棰樺共骞冲潎${templateAvgStem}瀛楋紝鐢熸垚棰樺共骞冲潎${generatedAvgStem}瀛楋紝鍋忓樊${stemDeviation}瀛梎
          );
          
          if (stemDeviation > templateAvgStem * 0.5) {
            issues.push(`鈿狅笍 棰樺共闀垮害涓庢ā鏉垮亸宸緝澶э紙妯℃澘${templateAvgStem}瀛?vs 鐢熸垚${generatedAvgStem}瀛楋級`);
          }
        }
        
        const templateTotalScore = templateCards.reduce((sum, c) => sum + (c.score || 0), 0);
        const generatedTotalScore = parsedBlueprint.reduce((sum, q) => sum + (q.score || 0), 0);
        if (templateTotalScore > 0) {
          const scoreDeviation = Math.abs(generatedTotalScore - templateTotalScore);
          qualityReport.templateMatch.details.push(
            `妯℃澘鎬诲垎${templateTotalScore}锛岀敓鎴愭€诲垎${generatedTotalScore}锛屽亸宸?{scoreDeviation}鍒哷
          );
          if (scoreDeviation > 10) {
            issues.push(`鈿狅笍 鎬诲垎涓庢ā鏉垮亸宸?{scoreDeviation}鍒哷);
          }
        }
        
        qualityReport.templateMatch.details.push(
          `妯℃澘${templateCards.length}棰橈紝鐢熸垚${parsedBlueprint.length}棰榒
        );
      }

      progress.value = 95;

      // ========== 馃敡 鏂板锛氭湳璇粺涓€鍚庡鐞?==========
      if (book && book.subject) {
        const rawSubj = book?.subject || '';
        const stg = book?.stage || '';
        const subj = normalizeSubjectName(rawSubj, stg);
        const terminologyResult = normalizeTerminology(content, subj);
        
        if (terminologyResult.fixes.length > 0) {
          content = terminologyResult.normalized;
          console.log(`馃摑 鏈缁熶竴瀹屾垚锛?{terminologyResult.fixes.map(f => `"${f.original}"鈫?${f.corrected}"(${f.count}澶?`).join('锛?)}`);
          qualityReport.formatCheck.details.push(
            `鏈缁熶竴锛?{terminologyResult.fixes.length}绉嶆湳璇鏍囧噯鍖朻
          );
        }
      }

      // 鑷姩淇寰幆
      let finalContent = content;
      let finalIssues = issues;
      let finalQualityReport = qualityReport;
      
      const hasQualityIssue = !qualityReport.formatCheck.passed 
        || !qualityReport.coverageCheck.passed 
        || (qualityReport.aiReview && !qualityReport.aiReview.passed);
      
      if (hasQualityIssue && issues.length > 0) {
        const fixConfig = await getCurrentEngineConfigEnhanced('review');
        const fixModelName = getModelDisplayName(fixConfig.textModel || fixConfig.model);
        statusText.value = `璐ㄩ噺鏈揪鏍囷紝姝ｅ湪鑷姩淇 [${fixModelName}]...`;
        progress.value = 92;
        
        try {
          const fixPrompt = `浠ヤ笅鏄竴浠藉凡鐢熸垚鐨勬暀杈呰祫鏂欙紝浣嗗瓨鍦ㄨ川閲忛棶棰橀渶瑕佷慨澶嶃€?

銆愬彂鐜扮殑闂銆?
${issues.join('\n')}

銆愬師鍐呭銆?
${content.substring(0, 5000)}

銆愪慨澶嶈姹傘€?
1. 淇鎵€鏈夋寚鍑虹殑闂
2. 淇濇寔鍘熸湁棰樺瀷缁撴瀯鍜屽垎鍊煎垎甯?
3. 淇濇寔 HTML 鏍煎紡杈撳嚭
4. 鐩存帴杩斿洖淇鍚庣殑瀹屾暣鍐呭锛屼笉瑕佺敤浠ｇ爜鍧楀寘瑁?
5. 鍙慨鏀规湁闂鐨勯儴鍒嗭紝涓嶈鏀瑰姩鍏朵粬鍐呭`;

          const fixedContent = await callAI(fixPrompt, {
            taskType: 'review',
            temperature: 0.2,
            timeout: 120000
          });
          
          if (fixedContent && fixedContent.length > content.length * 0.5) {
            // 馃敡 鏂板锛氫慨澶嶅悗楠岃瘉
            statusText.value = '楠岃瘉淇缁撴灉...';
            progress.value = 95;
            
            // 閲嶆柊杩愯纭€ц鍒欐鏌?
            const reHardIssues = HardRuleChecker.check(
              fixedContent, 
              parsedBlueprint, 
              selectedBooks?.[0]?.subject || '', 
              selectedBooks?.[0]?.stage || '', 
              selectedBooks?.[0]?.grade || ''
            );
            const reSummary = HardRuleChecker.getIssueSummary(reHardIssues);
            
            // 妫€鏌ヤ慨澶嶅悗鏄惁杩樻湁鏍煎紡闂
            const stillHasHtmlIssue = !fixedContent.includes('<p') && !fixedContent.includes('<div');
            const stillHasAnswerIssue = !fixedContent.includes('answer-section');
            
            // 濡傛灉閲嶅ぇ闂宸蹭慨澶嶏紝閲囩敤淇鍚庣殑鍐呭
            if (!reSummary.hasErrors && !stillHasHtmlIssue) {
              finalContent = fixedContent;
              finalIssues = reSummary.hasWarnings 
                ? reHardIssues.filter(i => i.severity === 'warning').map(i => `鈿狅笍 ${i.detail}`)
                : null;
              finalQualityReport = {
                ...qualityReport,
                formatCheck: { passed: !stillHasHtmlIssue, details: stillHasHtmlIssue ? ['淇鍚庝粛缂哄皯HTML鏍囩'] : ['宸茶嚜鍔ㄤ慨澶?] },
                coverageCheck: { passed: true, details: ['宸茶嚜鍔ㄤ慨澶?] },
                aiReview: { 
                  passed: !reSummary.hasWarnings, 
                  details: reSummary.hasWarnings 
                    ? [`淇鍚庝粛鏈?{reSummary.warnings}涓鍛婏細${reHardIssues.filter(i => i.severity === 'warning').map(i => i.detail).join('锛?)}`]
                    : ['宸茶嚜鍔ㄤ慨澶?] 
                }
              };
              statusText.value = reSummary.hasWarnings ? '淇瀹屾垚锛堟湁杞诲井璀﹀憡锛? : '淇瀹屾垚';
            } else {
              // 淇涓嶅厖鍒嗭紝淇濈暀鍘熷唴瀹逛絾鏍囪闂
              finalContent = fixedContent; // 浠嶇劧鐢ㄤ慨澶嶅悗鐨勶紙姣斿師鐗堝ソ锛?
              finalIssues = [
                ...(reSummary.hasErrors ? [`鈿狅笍 鑷姩淇鍚庝粛鏈?{reSummary.errors}涓敊璇紝璇锋墜鍔ㄦ鏌] : []),
                ...(reSummary.hasWarnings ? [`鈿狅笍 鑷姩淇鍚庝粛鏈?{reSummary.warnings}涓鍛奰] : []),
                ...(stillHasHtmlIssue ? ['鈿狅笍 淇鍚庢牸寮忎粛涓嶅畬鏁?] : []),
                ...(stillHasAnswerIssue ? ['鈿狅笍 淇鍚庝粛缂哄皯绛旀鍖哄煙'] : [])
              ];
              statusText.value = '淇涓嶅畬鏁达紝璇锋墜鍔ㄦ鏌?;
            }
          } else {
            statusText.value = '鑷姩淇杩斿洖鍐呭寮傚父锛岃鎵嬪姩妫€鏌?;
          }
        } catch (e) {
          console.warn('鑷姩淇澶辫触:', e.message);
          statusText.value = '鑷姩淇澶辫触锛岃鎵嬪姩妫€鏌?;
        }
      }
      
      progress.value = 100;
      
      // 馃敡 鏂板锛氱敓鎴愯川閲忔憳瑕侊紝鏄剧ず鍦ㄧ姸鎬佹爮
      let summaryParts = ['鐢熸垚瀹屾垚'];
      if (finalQualityReport.aiReview?.details?.length) {
        const scoreDetail = finalQualityReport.aiReview.details.find(d => d.includes('缁煎悎璇勫垎'));
        if (scoreDetail) summaryParts.push(`AI璇勫垎${scoreDetail.replace('缁煎悎璇勫垎: ', '')}`);
      }
      if (finalQualityReport.coverageCheck?.details?.length) {
        const covDetail = finalQualityReport.coverageCheck.details.find(d => d.includes('鐭ヨ瘑鐐硅鐩?));
        if (covDetail) summaryParts.push(covDetail);
      }
      if (finalQualityReport.knowledgeCheck?.details?.length) {
        const kpDetail = finalQualityReport.knowledgeCheck.details.find(d => d.includes('瓒呯翰'));
        if (kpDetail) summaryParts.push(`鈿狅笍瓒呯翰妫€娴媊);
      }
      if (finalIssues && finalIssues.length > 0) {
        const errorCount = finalIssues.filter(i => i.startsWith('鉂?)).length;
        const warnCount = finalIssues.filter(i => i.startsWith('鈿狅笍')).length;
        if (errorCount > 0) summaryParts.push(`鉂?{errorCount}涓敊璇痐);
        if (warnCount > 0) summaryParts.push(`鈿狅笍${warnCount}涓鍛奰);
      } else {
        summaryParts.push('鉁呮棤闂');
      }
      statusText.value = summaryParts.join(' | ');

      return { 
        success: true, 
        content: finalContent,
        blueprint,
        parsedBlueprint,
        contentCards,
        knowledgeMap,
        issues: finalIssues,
        qualityReport: finalQualityReport,
        generatedQuestions
      };
    } catch (error) {
      console.error('鐢熸垚澶辫触:', error);
      return { success: false, error: error.message };
    } finally {
      isGenerating.value = false;
    }
  };

  /**
   * 馃敡 鏂板锛氫负鎸囧畾棰樼洰鐢熸垚鍙樹綋
   * @param {string} originalQuestion - 鍘熼HTML
   * @param {object} questionPlan - 鍘熼瑙勫垝 { type, knowledgePoint, difficulty, score }
   * @param {object} options - 鍙€夐厤缃?
   * @returns {Promise<string>} 鍙樹綋棰樼洰鐨凥TML
   */
  const generateQuestionVariant = async (originalQuestion, questionPlan, options = {}) => {
    const {
      changeData = true,        // 鏄惁鏀瑰彉鏁版嵁
      changeContext = true,     // 鏄惁鏀瑰彉鎯呭
      changeOptions = true,     // 鏄惁鏀瑰彉閫夐」锛堥€夋嫨棰橈級
      changeQuestionType = false // 鏄惁鏀瑰彉棰樺瀷锛堥粯璁や笉鏀癸級
    } = options;

    const variantPrompt = `璇蜂负浠ヤ笅棰樼洰鐢熸垚涓€涓彉浣撻鐩€?

銆愬師棰樸€?
${originalQuestion}

銆愬師棰樿鍒掋€?
- 棰樺瀷锛?{questionPlan.type}
- 鑰冩煡鐭ヨ瘑鐐癸細${questionPlan.knowledgePoint}
- 闅惧害锛?{questionPlan.difficulty}
- 鍒嗗€硷細${questionPlan.score}鍒?

銆愬彉浣撹姹傘€?
${changeQuestionType ? `- 鍙互鏀瑰彉棰樺瀷锛屼絾鏍稿績鐭ヨ瘑鐐逛笉鍙榒 : `- 淇濇寔鐩稿悓棰樺瀷`}
${changeData ? `- 鏀瑰彉棰樼洰涓殑鏁版嵁鍜屾暟鍊糮 : ''}
${changeContext ? `- 鏀瑰彉棰樼洰鎯呭鎴栬儗鏅弿杩癭 : ''}
${changeOptions ? `- 濡傛灉鏄€夋嫨棰橈紝鏀瑰彉閫夐」鍐呭銆侀『搴忓拰閮ㄥ垎閫夐」` : ''}
- 淇濇寔闅惧害涓嶅彉锛?{questionPlan.difficulty}锛?
- 淇濇寔鐩稿悓鐨勭煡璇嗙偣瑕嗙洊
- 蹇呴』鏄竴閬撳叏鏂伴鐩紝涓庡師棰橀噸澶嶅害涓嶈秴杩?0%
- 淇濇寔 HTML 鏍煎紡
- 鏍囨敞锛氥€愮煡璇嗙偣锛?{questionPlan.knowledgePoint}銆戙€愰毦搴︼細${questionPlan.difficulty}銆?

鍙繑鍥炰竴閬撻鐨凥TML浠ｇ爜銆俙;

    return await callAI(variantPrompt, {
      taskType: 'generation',
      temperature: 0.8,
      timeout: 60000
    });
  };

  const extractGraphs = (content) => {
    const matches = content?.match(/\[GRAPH\][\s\S]*?\[\/GRAPH\]/g) || [];
    return matches.map(m => ({ full: m }));
  };

  // ===== 閿欒杈圭晫锛氬畨鍏?AI 璋冪敤鍖呰 =====
  const safeCallAI = async (prompt, options = {}) => {
    try {
      return await callAI(prompt, options);
    } catch (e) {
      if (e.message?.includes('鍙栨秷') || e.message?.includes('abort')) throw e;
      console.error('[safeCallAI] AI 璋冪敤澶辫触:', e.message);
      const friendlyMsg = e.message?.includes('鏈嶅姟涓嶅彲鐢?) ? 'AI 鏈嶅姟鏈惎鍔紝璇锋鏌?Ollama 鎴?DeepSeek 閰嶇疆'
        : e.message?.includes('API Key') ? 'API Key 鏃犳晥锛岃鍦ㄨ缃腑鏇存柊'
        : e.message?.includes('瓒呮椂') ? 'AI 鍝嶅簲瓒呮椂锛岃绋嶅悗閲嶈瘯鎴栭檷浣庡唴瀹归噺'
        : e.message?.includes('浣欓') ? 'API 浣欓涓嶈冻锛岃鍏呭€?
        : `AI 璋冪敤澶辫触: ${e.message}`;
      throw new Error(friendlyMsg);
    }
  };

  const safeCallMultimodal = async (prompt, imageBase64, options = {}) => {
    try {
      return await callMultimodalAI(prompt, imageBase64, options);
    } catch (e) {
      if (e.message?.includes('鍙栨秷') || e.message?.includes('abort')) throw e;
      console.error('[safeCallMultimodal] 澶氭ā鎬佽皟鐢ㄥけ璐?', e.message);
      const friendlyMsg = e.message?.includes('閲嶅惎Ollama')
        ? '妯″瀷寮傚父锛岃閲嶅惎 Ollama 鏈嶅姟鍚庨噸璇?
        : e.message?.includes('绌哄唴瀹?)
        ? 'OCR 璇嗗埆杩斿洖绌虹粨鏋滐紝璇锋鏌ュ浘鐗囪川閲忔垨鍒囨崲寮曟搸'
        : `澶氭ā鎬佽瘑鍒け璐? ${e.message}`;
      throw new Error(friendlyMsg);
    }
  };

    return {
    isGenerating,
    progress,
    statusText,
    abortController,
    callAI,
    safeCallAI,
    callMultimodalAI,
    safeCallMultimodal,
    extractTextRobustly,
    extractChapterTextSequentially,  // 馃幆 鏂板锛氱ǔ瀹氱殑鎵归噺鍘熸枃鎻愬彇
    detectMultiColumnPages,         // 馃搻 鏂板锛氭墜鍔ㄥ鏍忔娴?
    postProcessOCR,
    analyzeTextbookImage,
    analyzeTextbookWithText,  // 馃敡 鏂板锛氱函鏂囨湰 AI 鍒嗘瀽
    analyzeTemplateImageFull,
    extractKnowledgePoints,
    buildGenerationInstruction,
    generate,
    executeGenerationWithBlueprint,
    cancelGeneration,
    extractGraphs,
    generateQuestionVariant,
    smartWait,
    checkModelLoaded,
    checkModelReady,  // 馃敡 鏂板锛氭娴嬫ā鍨嬫槸鍚︾湡姝ｅ氨缁?
    smartWaitForModel  // 馃敡 鏂板锛氭櫤鑳界瓑寰呮ā鍨嬬┖闂?
  };
}   smartWait,
    checkModelLoaded,
    checkModelReady,  // 馃敡 鏂板锛氭娴嬫ā鍨嬫槸鍚︾湡姝ｅ氨缁?
    smartWaitForModel  // 馃敡 鏂板锛氭櫤鑳界瓑寰呮ā鍨嬬┖闂?
  };
}
