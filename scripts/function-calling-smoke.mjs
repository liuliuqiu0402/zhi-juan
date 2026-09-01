// function-calling-smoke.mjs
// 最小样例验证：DeepSeek V4-Flash 非思考模式下，function-calling 驱动"教材浏览"工具是否稳定，
// 以及多变多轮请求下前缀缓存命中情况(cache hit)。
//
// 用法（二选一提供 key）：
//   node scripts/function-calling-smoke.mjs --key sk-xxxx                    # DeepSeek 官方
//   $env:DEEPSEEK_API_KEY="sk-xxxx"; node scripts/function-calling-smoke.mjs
//
// 说明：
//   - 使用与生产一致的生成模型 deepseek-v4-flash；思考模式关闭（默认非思考，不传 thinking/reasoner）。
//   - 教材原文用一个小型本地片段库模拟（SemanticRetriever 的占位），模型调用 browse_textbook
//     工具"浏览"到原文后，在后续轮次中据原文命内容。
//   - 每轮打印 usage，观察 prefixCacheHitTokens 是否随前缀稳定而增长（= 缓存命中，成本被压低）。
//   - 覆盖非思考工具调用的两个工程要点：tool_calls 解析 + 非法 JSON 参数的容错。

const key = process.argv.includes('--key')
  ? process.argv[process.argv.indexOf('--key') + 1]
  : (process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_KEY);

if (!key) {
  console.error('✋ 缺少 API Key。请用 --key sk-xxxx 或 环境变量 DEEPSEEK_API_KEY 提供后重试。');
  process.exit(2);
}

const BASE = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';
const MODEL = 'deepseek-v4-flash';
const MAX_ROUNDS = 4;

// 本地"教材片段库"占位（生产端 = semanticRetriever 索引）
const TEXTBOOK = {
  '第3单元·我只养了三只小羊三、四': '《大青树下的小学》…… 强调"爱我中华，赞颂民族团结"的主题；"文中有哪些表示安静的词"是本段考点。',
  '第3单元·默读课文，想想各段讲了什么': '默读策略：先通读把握大意，再逐段概括，找出关键句。',
  '第2单元·作对比': '作对比的说明方法：突出事物的特点，使说明更具体。',
};

const tools = [
  {
    type: 'function',
    function: {
      name: 'browse_textbook',
      description: '浏览教材：按章节名或知识点从教材原文中取回对应片段，供命题取材。',
      parameters: {
        type: 'object',
        properties: {
          chapter: { type: 'string', description: '章节名，如"第3单元·我只养了三只小羊"' },
          knowledge: { type: 'string', description: '需要的知识点关键词' },
        },
        required: ['chapter'],
      },
    },
  },
];

// 稳定前缀：固定指令（不随轮次变）→ 帮助命中前缀缓存
function buildStablePrefix() {
  return [
    '你是语文命题编辑。',
    '【命题范围】按勾选目录取材：第2单元、第3单元。',
    '【蓝图】第一大题：阅读理解（本题须围绕第3单元选文），第二大题：基础知识（第2单元）。',
    '【质量】题目术语严谨，不超出本学段学业质量要求；原创设问，禁止照搬原题。',
    '【取材方式】如需某章原文作依据，调用 browse_textbook 工具浏览教材；以浏览到的【教材原文】为准命题，教材版本以用户所选为准。',
    '【收敛硬约束】每个章节只浏览一次；取到所需的该章原文后，必须立即据此完成命题并停笔（不再发起任何工具调用、不再重复浏览）。严禁对同一章节反复浏览或连续无限调工具。',
  ].join('\n');
}

async function callChat(messages) {
  const resp = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: MODEL, messages, tools, temperature: 0.7 }),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`HTTP ${resp.status}: ${txt.slice(0, 500)}`);
  }
  return resp.json();
}

const usageLine = (u = {}, tag = '') => {
  const hit = u.prompt_cache_hit_tokens ?? u.prompt_tokens_details?.cached_tokens ?? 0;
  const miss = u.prompt_cache_miss_tokens ?? (u.prompt_tokens - hit);
  console.log(`  ${tag} round usage -> input=${u.prompt_tokens} (cacheHit=${hit} cacheMiss=${miss}) output=${u.completion_tokens ?? 0} total=${u.total_tokens}`);
};

async function main() {
  console.log(`🧪 引擎=${BASE} 模型=${MODEL} 思考=关闭(非思考)`);

  const system = buildStablePrefix();
  const messages = [
    { role: 'system', content: system },
    {
      role: 'user',
      content:
        '请按蓝图编写第一大题（阅读理解）。本题围绕第3单元选文，你目前缺少该章原文，请先浏览教材获取素材，再命题。完成第一题后停笔，等我叫你继续。',
    },
  ];

  let final = '';
  const browsed = new Set();
  for (let round = 1; round <= MAX_ROUNDS; round++) {
    const data = await callChat(messages);
    usageLine(data.usage, `[${round}]`);
    const msg = data.choices?.[0]?.message;
    if (!msg) throw new Error('no message in response');

    const calls = Array.isArray(msg.tool_calls) ? msg.tool_calls : [];
    if (calls.length) {
      // 把 assistant 的 tool_calls 原样回传（非思考模式下无需回传 reasoning_content）
      messages.push({ role: 'assistant', content: msg.content ?? null, tool_calls: calls });
      console.log(`  [${round}] 模型发起浏览工具：${calls.map(c => c.function?.name).join(',')}`);
      for (const c of calls) {
        let args;
        try { args = JSON.parse(c.function?.arguments || '{}'); }
        catch (e) {
          // 容错：arguments 可能非合法 JSON —— 项目生产端需在此做校验/重试
          console.warn(`  ⚠️ arguments 非合法 JSON，尝试抓取章节字段：${e.message}`);
          args = { chapter: String(c.function?.arguments || '').match(/[^"]+单元[\s\S]*/)?.[0]?.slice(0, 12) || '第3单元' };
        }
        const key = args.chapter || Object.keys(TEXTBOOK)[0];
        let content;
        if (browsed.has(key)) {
          content = `［提示：章节“${key}”已浏览过，请直接依据已有原文命题，不要重复浏览。］`;
        } else {
          browsed.add(key);
          content = TEXTBOOK[key] || TEXTBOOK[Object.keys(TEXTBOOK)[0]];
        }
        console.log(`  ↳ browse_textbook("${key}") → ${content.length > 20 ? '返回原文片段' : content}`);
        messages.push({ role: 'tool', tool_call_id: c.id, content });
      }
      continue; // 继续下一轮让模型用素材成卷
    }

    final = msg.content || '';
    const usage0 = data.usage;
    const hit = usage0.prompt_cache_hit_tokens ?? usage0.prompt_tokens_details?.cached_tokens ?? 0;
    if (hit > 0) console.log('  ✅ 当前轮前缀命中上下文缓存（输入成本按命中价计）。');
    if (typeof msg.reasoning_content !== 'undefined' && msg.reasoning_content) {
      console.warn('  ⚠️ 检测到思考输出（reasoning_content 非空）——非思考模式不应出现，请复核模型/参数。');
    }
    console.log('\n—— 最终正文（据浏览到的教材原文命题）——');
    console.log(final.slice(0, 600));
    console.log('\n✅ 验证完成：非思考 function-calling 流程握手成功。若浏览器具稳定、缓存命中、无思考残留，即可推进正式实现。');
    return;
  }

  console.error(`✋ 超出轮次上限(${MAX_ROUNDS})，工具循环未收敛。`);
  process.exit(1);
}

main().catch((e) => {
  console.error('❌ 验证失败:', e.message);
  process.exit(1);
});