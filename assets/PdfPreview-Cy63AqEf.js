import{getMultimodalConfig as Fn,getCurrentEngineConfigEnhanced as Qt,getCurrentEngineConfig as ro,apiConfig as Pn}from"./apiConfig-ehGEQFOX.js";import{g as Ys,_ as oo,b as ao}from"./RichTextEditor-D98I9D-D.js";import{g as Y}from"./instructionLib-BV2XjAKd.js";import{u as Ps,r as Ms}from"./requestManager-boI0JHtu.js";import{s as Rt,z as io,_ as co,w as er,o as lo,y as uo,a as po,b as qn,c as Hn,d as dn,t as Es,e as tr,v as nr,p as ts,i as sr,x as fo}from"./index-C0FdZI5F.js";const ji={小学:{语文:{grades:["一年级","二年级","三年级","四年级","五年级","六年级"],competency:"识字与写字、阅读、习作、口语交际、综合性学习"},数学:{grades:["一年级","二年级","三年级","四年级","五年级","六年级"],competency:"数与代数、图形与几何、统计与概率、综合与实践"},英语:{grades:["三年级","四年级","五年级","六年级"],competency:"听、说、读、写、玩演视听"},科学:{grades:["一年级","二年级","三年级","四年级","五年级","六年级"],competency:"科学探究、生命科学、物质科学、地球与宇宙科学、技术与工程"},道德与法治:{grades:["一年级","二年级","三年级","四年级","五年级","六年级"],competency:"道德修养、法治观念、健全人格、责任意识"},信息科技:{grades:["三年级","四年级","五年级","六年级"],competency:"信息意识、计算思维、数字化学习与创新、信息社会责任"}},初中:{语文:{grades:["七年级","八年级","九年级"],competency:"识字与写字、阅读、写作、口语交际、综合性学习、名著导读"},数学:{grades:["七年级","八年级","九年级"],competency:"数与式、方程与不等式、函数、图形与几何、统计与概率、综合与实践"},英语:{grades:["七年级","八年级","九年级"],competency:"语言技能、语言知识、情感态度、学习策略、文化意识"},物理:{grades:["八年级","九年级"],competency:"物质、运动和相互作用、能量、实验探究、科学思维"},化学:{grades:["九年级"],competency:"科学探究、身边的化学物质、物质构成的奥秘、物质的化学变化、化学与社会发展"},生物:{grades:["七年级","八年级"],competency:"生命观念、科学探究、生物与环境、生物多样性"},历史:{grades:["七年级","八年级","九年级"],competency:"唯物史观、时空观念、史料实证、历史解释、家国情怀"},地理:{grades:["七年级","八年级"],competency:"区域认知、综合思维、地理实践力、人地协调观"},道德与法治:{grades:["七年级","八年级","九年级"],competency:"政治认同、道德修养、法治观念、健全人格、责任意识"},信息技术:{grades:["七年级","八年级","九年级"],competency:"信息意识、计算思维、数字化学习与创新、信息社会责任"}},高中:{语文:{grades:["高一","高二","高三"],competency:"语言建构与运用、思维发展与提升、审美鉴赏与创造、文化传承与理解"},数学:{grades:["高一","高二","高三"],competency:"预备知识、函数、几何与代数、概率与统计、数学建模与探究"},英语:{grades:["高一","高二","高三"],competency:"语言能力、文化意识、思维品质、学习能力"},物理:{grades:["高一","高二","高三"],competency:"物理观念、科学思维、科学探究、科学态度与责任"},化学:{grades:["高一","高二","高三"],competency:"宏观辨识与微观探析、变化观念与平衡思想、证据推理与模型认知、科学探究与创新意识、科学精神与社会责任"},生物:{grades:["高一","高二","高三"],competency:"生命观念、科学思维、科学探究、社会责任"},历史:{grades:["高一","高二","高三"],competency:"唯物史观、时空观念、史料实证、历史解释、家国情怀"},地理:{grades:["高一","高二","高三"],competency:"区域认知、综合思维、地理实践力、人地协调观"},思想政治:{grades:["高一","高二","高三"],competency:"政治认同、科学精神、法治意识、公共参与"},信息技术:{grades:["高一","高二","高三"],competency:"信息意识、计算思维、数字化学习与创新、信息社会责任"}}},Li=["语文","数学","英语","物理","化学","生物","历史","地理","道德与法治","思想政治","科学","信息技术"],Gn={exam:{name:"📝 考卷",structure:`一、选择题
二、填空题
三、阅读理解
四、综合题
五、作文`,instruction:"请严格按试卷结构命题，总分、题型、分值需符合配置。具体难度比例见下方学段适配要求。"},practice:{name:"📚 课时练",structure:`一、基础过关
二、能力提升
三、拓展探究`,instruction:'请遵循"基础→能力→拓展"的递进结构。题目紧扣本节知识点，具体难度比例见下方学段适配要求。'},summary:{name:"📖 知识点总结",structure:`一、学习目标
二、核心知识清单
三、易错点辨析
四、典型例题精析
五、重难点星级标注
六、记忆方法/学习技巧`,instruction:"以知识要点整理为核心，通过表格、对比呈现易混点。每个知识点附巩固例题和记忆方法。具体结构根据学科自动调整。"},special:{name:"🎯 专项突破",structure:`一、方法指导
二、典例剖析
三、变式训练
四、真题实战`,instruction:"围绕专项能力深度训练。方法指导精炼，典例典型，变式层层递进。"},errorbook:{name:"🔖 错题本",structure:`一、错题整理
二、错误归因
三、正确解法
四、变式巩固`,instruction:"整理典型错题，分析错误原因，给出正确解法，并附变式练习。"},preview:{name:"🔍 课前预习",structure:`一、学习目标
二、预习任务（阅读/标注/思考）
三、预习检测（3-5道基础题）`,instruction:"以引导学生自主预习为核心。学习目标明确具体，预习任务有可操作性，预习检测紧扣教材原文，题型以填空和简答为主。"},dictation:{name:"✏️ 听写/默写",structure:`一、生字词听写
二、重点词语默写
三、句子/段落默写`,instruction:"生成可直接打印使用的默写练习纸：练习区只显示拼音/释义提示+空白书写区（学生填写），标准答案统一放文末。语文：拼音提示+田字格留空+字典式生字信息；英语：中文释义提示+四线三格/单线留空。每题留足书写空间，练习区不出现答案。"},reading:{name:"📖 阅读训练",structure:`一、短文阅读（1-2篇）
二、阅读理解题（选择+简答）
三、拓展思考`,instruction:"以阅读理解能力训练为核心。选文贴近学段水平，题目涵盖：信息提取、词句理解、主旨概括、推理判断、评价鉴赏。题干精炼，选项有区分度。"},review:{name:"📋 单元/期末复习",structure:`一、知识框架
二、考点梳理
三、典型题析
四、易错聚焦
五、综合自测`,instruction:"以系统化复习为核心，融合知识梳理与自测训练。知识框架层次分明，考点覆盖完整，易错点辨析准确。结构根据学段自动调整。"}},Ni=[{value:"exam",label:"📝 考卷",desc:"正式考试试卷"},{value:"practice",label:"📚 课时练",desc:"日常课时作业"},{value:"summary",label:"📖 知识点总结",desc:"知识归纳整理"},{value:"special",label:"🎯 专项突破",desc:"专题深度训练"},{value:"errorbook",label:"🔖 错题本",desc:"错题整理分析"},{value:"preview",label:"🔍 课前预习",desc:"自主预习引导"},{value:"dictation",label:"✏️ 听写/默写",desc:"生字词/单词听默写"},{value:"reading",label:"📖 阅读训练",desc:"阅读理解专项训练"},{value:"review",label:"📋 单元/期末复习",desc:"系统化复习+自测"}],Di=[{value:"traditional",label:"传统命题",desc:"题型清晰，设问直接"},{value:"unified_context",label:"统一情境",desc:"整份资料一个核心主题"},{value:"context_fusion",label:"情境融合",desc:"每个模块独立小情境"},{value:"big_unit",label:"大单元教学",desc:"打破课时，大概念设计"},{value:"project_based",label:"项目式学习",desc:"项目驱动，综合能力"}],Ii=[{value:"default",label:"默认",desc:"按章节默认范围"},{value:"midterm",label:"期中",desc:"期中考试范围"},{value:"final",label:"期末",desc:"期末考试范围"},{value:"topic",label:"专题",desc:"专题复习范围"}],Fi=[{value:"unit",label:"按单元",desc:"以单元为单位生成"},{value:"lesson",label:"按课",desc:"以课时为单位生成"}],go={政治:"道德与法治",思想品德:"道德与法治",品德与社会:"道德与法治",信息科技:"信息技术",通用技术:"信息技术"},Kt=(e,t)=>{if(!e)return e;const s={primary:"小学",middle:"初中",high:"高中"}[t]||t,r=go[e];return r?e==="政治"&&s==="高中"?"思想政治":r:["政治","思想品德"].includes(e)&&s==="初中"?"道德与法治":["政治","思想品德"].includes(e)&&s==="高中"?"思想政治":e},ho={小学:{数学:{allowedTopics:["整数四则运算","小数加减乘除","分数加减乘除","简易方程","平面图形周长面积","立体图形体积表面积","简单统计图表","正比例反比例","用字母表示数","简单概率"],forbiddenTopics:["有理数混合运算","整式加减乘除","因式分解","分式方程","一元二次方程","二元一次方程组","不等式组","函数概念","一次函数","反比例函数","三角形全等证明","相似三角形","勾股定理证明","圆的性质证明","三角函数","统计与概率深入"],forbiddenMethods:["列方程解应用题（超过一步的方程）","几何证明（小学只需计算，不需证明）",'概率计算（小学只需描述"可能""一定""不可能"）'],fuzzyBoundary:{方程:"仅限形如 x+a=b, ax=b, ax+b=c 的一步简易方程",负数:"仅限了解负数的存在（温度计、海拔等情境），不涉及运算",代数:"仅限用字母表示数和简单代入求值",统计:"仅限条形图、折线图、扇形图的阅读和简单绘制",概率:'仅限"可能""一定""不可能"的定性描述'}},语文:{forbiddenTopics:["文言文翻译（小学仅需诵读，不需逐字翻译）","议论文写作","初中课标推荐的古诗文篇目",'语法术语（如"状语""补语"）','表现手法分析（如"欲扬先抑""托物言志"）'],fuzzyBoundary:{修辞手法:"仅限于比喻、拟人、排比、夸张、设问、反问六种",文言文:"仅限课标推荐的75篇古诗文中的篇目",写作:"以记叙文为主，不要求议论文和说明文"}},英语:{forbiddenTopics:["定语从句","状语从句","被动语态（一般现在时除外）","虚拟语气","非谓语动词","过去完成时","将来进行时"],fuzzyBoundary:{时态:"仅限于一般现在时、现在进行时、一般过去时、一般将来时",词汇量:"课标要求600-700词",写作:"限于30-50词的简单段落"}},科学:{forbiddenTopics:["化学方程式","原子结构","细胞分裂","遗传规律","力学计算","电路计算"],fuzzyBoundary:{实验:"仅限简单观察和记录，不涉及变量控制",探究:"限于教师指导下的简单探究"}}},初中:{数学:{forbiddenTopics:["导数","积分","对数函数","指数函数","幂函数","三角函数图像与性质","解三角形（正弦定理余弦定理）","立体几何（空间向量）","排列组合","二项式定理","概率分布","复数","数学归纳法"],forbiddenMethods:["导数求极值","对数运算（初中仅涉及科学记数法中的10的幂次）","向量法解几何题"],fuzzyBoundary:{函数:"仅限一次函数、二次函数、反比例函数",概率:"仅限列举法求概率，不涉及乘法原理和排列组合",统计:"仅限平均数、中位数、众数、方差的基本计算"}},物理:{forbiddenTopics:["量子力学","相对论","核物理","电磁感应（高中内容）","光的波粒二象性","原子能级"],fuzzyBoundary:{力学:"仅限牛顿三大定律基础应用，不涉及连接体、传送带等复杂模型",电学:"仅限欧姆定律、串并联电路基础"}},化学:{forbiddenTopics:["有机化学（高中内容）","化学反应速率与平衡的定量计算","电离平衡","盐类水解","电化学"],fuzzyBoundary:{化学方程式计算:"仅限一步计算",物质结构:"仅限原子结构示意图，不涉及电子排布规律"}}},高中:{数学:{forbiddenTopics:["微积分（仅限导数基础，不涉及积分）","线性代数","概率论与数理统计","复变函数"],fuzzyBoundary:{导数:"仅限多项式函数的导数计算和简单应用"}},物理:{forbiddenTopics:["量子力学计算","相对论计算","麦克斯韦方程组"],fuzzyBoundary:{}}}},ns=(e,t,n,s)=>{var v,S;if(!e||!t||!n)return{hasViolations:!1,violations:[],fuzzyItems:[]};const r=(v=ho[n])==null?void 0:v[t];if(!r)return{hasViolations:!1,violations:[],fuzzyItems:[]};const o=[],a=[],c=(d,R)=>{const F=["阅读材料","知识拓展","你知道吗","课外阅读","拓展阅读","小资料"],ke=R.indexOf(d);if(ke>0){const b=R.substring(Math.max(0,ke-50),ke+d.length+50);if(F.some(function(Q){return b.includes(Q)}))return!0}return!1};if(r.forbiddenTopics)for(const d of r.forbiddenTopics)e.includes(d)&&(c(d,e)?a.push({topic:d,limit:"拓展阅读材料中提及，非考查内容",severity:"info",message:'"'+d+'"出现在拓展材料中，若为阅读材料可接受'}):o.push({type:"forbidden_topic",keyword:d,severity:"error",message:"明确超纲：出现了"+n+t+'不应涉及的"'+d+'"'}));if(r.forbiddenMethods)for(const d of r.forbiddenMethods){const R=d.split("（")[0].trim();e.includes(R)&&o.push({type:"forbidden_method",keyword:R,severity:"warning",message:`可能使用超纲方法：${d}`})}if(r.fuzzyBoundary){for(const[d,R]of Object.entries(r.fuzzyBoundary))if(e.includes(d)){let F=!1;if(typeof R=="string"&&R.includes("仅限")){const ke=((S=R.match(/仅限(.+)/))==null?void 0:S[1])||"";F=e.length>200&&ke.length<10}a.push({topic:d,limit:R,severity:F?"warning":"info",message:F?`"${d}"可能超出${n}范围：${R}`:`"${d}"在${n}的限定范围内：${R}`})}}return{hasViolations:o.length>0,violations:o,fuzzyItems:a,summary:{errorCount:o.filter(d=>d.severity==="error").length,warningCount:o.filter(d=>d.severity==="warning").length,fuzzyCount:a.filter(d=>d.severity==="warning").length}}},mo={数学:{一次函数:["线性函数","直线函数"],二次函数:["抛物线函数","平方函数"],反比例函数:["倒数函数","双曲线函数"],正比例函数:["正比函数"],一元一次方程:["一次方程","简单方程"],一元二次方程:["二次方程"],二元一次方程组:["联立方程组","线性方程组"],不等式:["不等关系"],勾股定理:["毕达哥拉斯定理","直角三角形定理"],相似三角形:["比例三角形","相似形"],全等三角形:["完全相等三角形"],平行四边形:["平行四边"],圆周角:["圆弧角"],切线:["切线","接触线"],平均数:["平均值","均值"],中位数:["中值","中间数"],众数:["最常见值","多数"],方差:["离散度","偏差平方"],标准差:["均方差"],概率:["可能性","几率","或然率"],命题:["题目","试题","考题"],解答:["求解","计算","解题"],证明:["求证","论证"],已知:["给出","设定","假设"],求:["求解","计算","试求"]},物理:{质量:['重量（在物理语境下应用"质量"）'],重力:["重量","地球引力"],压强:["压力强度"],密度:["比重"],速度:["速率（物理中速度含方向）"],加速度:["速度变化率"],力:["作用力"],功:["做功","机械功"],功率:["做功速率"],电流:["电强度"],电压:["电势差","电位差"],电阻:["阻抗"],欧姆定律:["欧姆定理"]},化学:{化学方程式:["化学反应式","化学式"],化合价:["原子价","氧化数"],相对原子质量:["原子量"],相对分子质量:["分子量"],溶液:["液体混合物"],溶质:["被溶解物"],溶剂:["溶解介质"],pH值:["酸碱度"],酸碱性:["酸碱性质"],置换反应:["取代反应","置换"],复分解反应:["双分解","复分解"],催化剂:["触媒"]},语文:{比喻:["打比方","譬喻"],拟人:["人格化","拟人化"],排比:["排比句","排比修辞"],夸张:["夸大","夸张手法"],设问:["自问自答"],反问:["反诘","反问问"],对偶:["对仗","对子"],借代:["代称","借指"],记叙文:["记叙","叙述文"],议论文:["论说文","议论"],说明文:["说明","解释文"],中心思想:["主题思想","主旨"],写作手法:["表现手法","表达技巧"],修辞手法:["修辞方法","修辞技巧"]},英语:{一般现在时:["简单现在时","现在时态"],一般过去时:["简单过去时","过去时态"],现在完成时:["完成时","完成时态"],定语从句:["关系从句","形容词从句"],主语:["主词"],谓语:["谓词"],宾语:["受词"],状语:["副词短语"],被动语态:["被动式","被动"],主动语态:["主动式","主动"]}},rr=(e,t)=>{if(!e||!t)return{normalized:e,fixes:[]};const n=mo[t];if(!n)return{normalized:e,fixes:[]};let s=e;const r=[];for(const[o,a]of Object.entries(n))for(const c of a)if(!(c.includes("（")||c.includes("）"))&&s.includes(c)){const v=new RegExp(c.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),"g"),S=(s.match(v)||[]).length;s=s.replace(v,o),(s.match(new RegExp(o.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),"g"))||[]).length,S>0&&r.push({original:c,corrected:o,count:S})}return r.length>0&&console.log(`📝 术语规范化：${r.length}种术语被标准化，共${r.reduce((o,a)=>o+a.count,0)}处替换`),{normalized:s,fixes:r}};function _r(e,t){return function(){return e.apply(t,arguments)}}const{toString:yo}=Object.prototype,{getPrototypeOf:qs}=Object,{iterator:gs,toStringTag:Or}=Symbol,ds=(e=>t=>{const n=yo.call(t);return e[n]||(e[n]=n.slice(8,-1).toLowerCase())})(Object.create(null)),tn=e=>(e=e.toLowerCase(),t=>ds(t)===e),hs=e=>t=>typeof t===e,{isArray:Dn}=Array,Nn=hs("undefined");function Jn(e){return e!==null&&!Nn(e)&&e.constructor!==null&&!Nn(e.constructor)&&Gt(e.constructor.isBuffer)&&e.constructor.isBuffer(e)}const Rr=tn("ArrayBuffer");function $o(e){let t;return typeof ArrayBuffer<"u"&&ArrayBuffer.isView?t=ArrayBuffer.isView(e):t=e&&e.buffer&&Rr(e.buffer),t}const wo=hs("string"),Gt=hs("function"),jr=hs("number"),Bn=e=>e!==null&&typeof e=="object",bo=e=>e===!0||e===!1,cs=e=>{if(ds(e)!=="object")return!1;const t=qs(e);return(t===null||t===Object.prototype||Object.getPrototypeOf(t)===null)&&!(Or in e)&&!(gs in e)},vo=e=>{if(!Bn(e)||Jn(e))return!1;try{return Object.keys(e).length===0&&Object.getPrototypeOf(e)===Object.prototype}catch{return!1}},To=tn("Date"),Co=tn("File"),So=e=>!!(e&&typeof e.uri<"u"),xo=e=>e&&typeof e.getParts<"u",ko=tn("Blob"),Po=tn("FileList"),Mo=e=>Bn(e)&&Gt(e.pipe);function Eo(){return typeof globalThis<"u"?globalThis:typeof self<"u"?self:typeof window<"u"?window:typeof global<"u"?global:{}}const or=Eo(),ar=typeof or.FormData<"u"?or.FormData:void 0,Ao=e=>{let t;return e&&(ar&&e instanceof ar||Gt(e.append)&&((t=ds(e))==="formdata"||t==="object"&&Gt(e.toString)&&e.toString()==="[object FormData]"))},_o=tn("URLSearchParams"),[Oo,Ro,jo,Lo]=["ReadableStream","Request","Response","Headers"].map(tn),No=e=>e.trim?e.trim():e.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g,"");function Qn(e,t,{allOwnKeys:n=!1}={}){if(e===null||typeof e>"u")return;let s,r;if(typeof e!="object"&&(e=[e]),Dn(e))for(s=0,r=e.length;s<r;s++)t.call(null,e[s],s,e);else{if(Jn(e))return;const o=n?Object.getOwnPropertyNames(e):Object.keys(e),a=o.length;let c;for(s=0;s<a;s++)c=o[s],t.call(null,e[c],c,e)}}function Lr(e,t){if(Jn(e))return null;t=t.toLowerCase();const n=Object.keys(e);let s=n.length,r;for(;s-- >0;)if(r=n[s],t===r.toLowerCase())return r;return null}const En=typeof globalThis<"u"?globalThis:typeof self<"u"?self:typeof window<"u"?window:global,Nr=e=>!Nn(e)&&e!==En;function Ns(){const{caseless:e,skipUndefined:t}=Nr(this)&&this||{},n={},s=(r,o)=>{if(o==="__proto__"||o==="constructor"||o==="prototype")return;const a=e&&Lr(n,o)||o;cs(n[a])&&cs(r)?n[a]=Ns(n[a],r):cs(r)?n[a]=Ns({},r):Dn(r)?n[a]=r.slice():(!t||!Nn(r))&&(n[a]=r)};for(let r=0,o=arguments.length;r<o;r++)arguments[r]&&Qn(arguments[r],s);return n}const Do=(e,t,n,{allOwnKeys:s}={})=>(Qn(t,(r,o)=>{n&&Gt(r)?Object.defineProperty(e,o,{value:_r(r,n),writable:!0,enumerable:!0,configurable:!0}):Object.defineProperty(e,o,{value:r,writable:!0,enumerable:!0,configurable:!0})},{allOwnKeys:s}),e),Io=e=>(e.charCodeAt(0)===65279&&(e=e.slice(1)),e),Fo=(e,t,n,s)=>{e.prototype=Object.create(t.prototype,s),Object.defineProperty(e.prototype,"constructor",{value:e,writable:!0,enumerable:!1,configurable:!0}),Object.defineProperty(e,"super",{value:t.prototype}),n&&Object.assign(e.prototype,n)},qo=(e,t,n,s)=>{let r,o,a;const c={};if(t=t||{},e==null)return t;do{for(r=Object.getOwnPropertyNames(e),o=r.length;o-- >0;)a=r[o],(!s||s(a,e,t))&&!c[a]&&(t[a]=e[a],c[a]=!0);e=n!==!1&&qs(e)}while(e&&(!n||n(e,t))&&e!==Object.prototype);return t},Ho=(e,t,n)=>{e=String(e),(n===void 0||n>e.length)&&(n=e.length),n-=t.length;const s=e.indexOf(t,n);return s!==-1&&s===n},Uo=e=>{if(!e)return null;if(Dn(e))return e;let t=e.length;if(!jr(t))return null;const n=new Array(t);for(;t-- >0;)n[t]=e[t];return n},zo=(e=>t=>e&&t instanceof e)(typeof Uint8Array<"u"&&qs(Uint8Array)),Ko=(e,t)=>{const s=(e&&e[gs]).call(e);let r;for(;(r=s.next())&&!r.done;){const o=r.value;t.call(e,o[0],o[1])}},Go=(e,t)=>{let n;const s=[];for(;(n=e.exec(t))!==null;)s.push(n);return s},Jo=tn("HTMLFormElement"),Bo=e=>e.toLowerCase().replace(/[-_\s]([a-z\d])(\w*)/g,function(n,s,r){return s.toUpperCase()+r}),ir=(({hasOwnProperty:e})=>(t,n)=>e.call(t,n))(Object.prototype),Qo=tn("RegExp"),Dr=(e,t)=>{const n=Object.getOwnPropertyDescriptors(e),s={};Qn(n,(r,o)=>{let a;(a=t(r,o,e))!==!1&&(s[o]=a||r)}),Object.defineProperties(e,s)},Wo=e=>{Dr(e,(t,n)=>{if(Gt(e)&&["arguments","caller","callee"].indexOf(n)!==-1)return!1;const s=e[n];if(Gt(s)){if(t.enumerable=!1,"writable"in t){t.writable=!1;return}t.set||(t.set=()=>{throw Error("Can not rewrite read-only method '"+n+"'")})}})},Vo=(e,t)=>{const n={},s=r=>{r.forEach(o=>{n[o]=!0})};return Dn(e)?s(e):s(String(e).split(t)),n},Xo=()=>{},Zo=(e,t)=>e!=null&&Number.isFinite(e=+e)?e:t;function Yo(e){return!!(e&&Gt(e.append)&&e[Or]==="FormData"&&e[gs])}const ea=e=>{const t=new Array(10),n=(s,r)=>{if(Bn(s)){if(t.indexOf(s)>=0)return;if(Jn(s))return s;if(!("toJSON"in s)){t[r]=s;const o=Dn(s)?[]:{};return Qn(s,(a,c)=>{const v=n(a,r+1);!Nn(v)&&(o[c]=v)}),t[r]=void 0,o}}return s};return n(e,0)},ta=tn("AsyncFunction"),na=e=>e&&(Bn(e)||Gt(e))&&Gt(e.then)&&Gt(e.catch),Ir=((e,t)=>e?setImmediate:t?((n,s)=>(En.addEventListener("message",({source:r,data:o})=>{r===En&&o===n&&s.length&&s.shift()()},!1),r=>{s.push(r),En.postMessage(n,"*")}))(`axios@${Math.random()}`,[]):n=>setTimeout(n))(typeof setImmediate=="function",Gt(En.postMessage)),sa=typeof queueMicrotask<"u"?queueMicrotask.bind(En):typeof process<"u"&&process.nextTick||Ir,ra=e=>e!=null&&Gt(e[gs]),k={isArray:Dn,isArrayBuffer:Rr,isBuffer:Jn,isFormData:Ao,isArrayBufferView:$o,isString:wo,isNumber:jr,isBoolean:bo,isObject:Bn,isPlainObject:cs,isEmptyObject:vo,isReadableStream:Oo,isRequest:Ro,isResponse:jo,isHeaders:Lo,isUndefined:Nn,isDate:To,isFile:Co,isReactNativeBlob:So,isReactNative:xo,isBlob:ko,isRegExp:Qo,isFunction:Gt,isStream:Mo,isURLSearchParams:_o,isTypedArray:zo,isFileList:Po,forEach:Qn,merge:Ns,extend:Do,trim:No,stripBOM:Io,inherits:Fo,toFlatObject:qo,kindOf:ds,kindOfTest:tn,endsWith:Ho,toArray:Uo,forEachEntry:Ko,matchAll:Go,isHTMLForm:Jo,hasOwnProperty:ir,hasOwnProp:ir,reduceDescriptors:Dr,freezeMethods:Wo,toObjectSet:Vo,toCamelCase:Bo,noop:Xo,toFiniteNumber:Zo,findKey:Lr,global:En,isContextDefined:Nr,isSpecCompliantForm:Yo,toJSONObject:ea,isAsyncFn:ta,isThenable:na,setImmediate:Ir,asap:sa,isIterable:ra};let Be=class Fr extends Error{static from(t,n,s,r,o,a){const c=new Fr(t.message,n||t.code,s,r,o);return c.cause=t,c.name=t.name,t.status!=null&&c.status==null&&(c.status=t.status),a&&Object.assign(c,a),c}constructor(t,n,s,r,o){super(t),Object.defineProperty(this,"message",{value:t,enumerable:!0,writable:!0,configurable:!0}),this.name="AxiosError",this.isAxiosError=!0,n&&(this.code=n),s&&(this.config=s),r&&(this.request=r),o&&(this.response=o,this.status=o.status)}toJSON(){return{message:this.message,name:this.name,description:this.description,number:this.number,fileName:this.fileName,lineNumber:this.lineNumber,columnNumber:this.columnNumber,stack:this.stack,config:k.toJSONObject(this.config),code:this.code,status:this.status}}};Be.ERR_BAD_OPTION_VALUE="ERR_BAD_OPTION_VALUE";Be.ERR_BAD_OPTION="ERR_BAD_OPTION";Be.ECONNABORTED="ECONNABORTED";Be.ETIMEDOUT="ETIMEDOUT";Be.ERR_NETWORK="ERR_NETWORK";Be.ERR_FR_TOO_MANY_REDIRECTS="ERR_FR_TOO_MANY_REDIRECTS";Be.ERR_DEPRECATED="ERR_DEPRECATED";Be.ERR_BAD_RESPONSE="ERR_BAD_RESPONSE";Be.ERR_BAD_REQUEST="ERR_BAD_REQUEST";Be.ERR_CANCELED="ERR_CANCELED";Be.ERR_NOT_SUPPORT="ERR_NOT_SUPPORT";Be.ERR_INVALID_URL="ERR_INVALID_URL";const oa=null;function Ds(e){return k.isPlainObject(e)||k.isArray(e)}function qr(e){return k.endsWith(e,"[]")?e.slice(0,-2):e}function As(e,t,n){return e?e.concat(t).map(function(r,o){return r=qr(r),!n&&o?"["+r+"]":r}).join(n?".":""):t}function aa(e){return k.isArray(e)&&!e.some(Ds)}const ia=k.toFlatObject(k,{},null,function(t){return/^is[A-Z]/.test(t)});function ms(e,t,n){if(!k.isObject(e))throw new TypeError("target must be an object");t=t||new FormData,n=k.toFlatObject(n,{metaTokens:!0,dots:!1,indexes:!1},!1,function(Q,j){return!k.isUndefined(j[Q])});const s=n.metaTokens,r=n.visitor||d,o=n.dots,a=n.indexes,v=(n.Blob||typeof Blob<"u"&&Blob)&&k.isSpecCompliantForm(t);if(!k.isFunction(r))throw new TypeError("visitor must be a function");function S(b){if(b===null)return"";if(k.isDate(b))return b.toISOString();if(k.isBoolean(b))return b.toString();if(!v&&k.isBlob(b))throw new Be("Blob is not supported. Use a Buffer instead.");return k.isArrayBuffer(b)||k.isTypedArray(b)?v&&typeof Blob=="function"?new Blob([b]):Buffer.from(b):b}function d(b,Q,j){let Te=b;if(k.isReactNative(t)&&k.isReactNativeBlob(b))return t.append(As(j,Q,o),S(b)),!1;if(b&&!j&&typeof b=="object"){if(k.endsWith(Q,"{}"))Q=s?Q:Q.slice(0,-2),b=JSON.stringify(b);else if(k.isArray(b)&&aa(b)||(k.isFileList(b)||k.endsWith(Q,"[]"))&&(Te=k.toArray(b)))return Q=qr(Q),Te.forEach(function(Ke,We){!(k.isUndefined(Ke)||Ke===null)&&t.append(a===!0?As([Q],We,o):a===null?Q:Q+"[]",S(Ke))}),!1}return Ds(b)?!0:(t.append(As(j,Q,o),S(b)),!1)}const R=[],F=Object.assign(ia,{defaultVisitor:d,convertValue:S,isVisitable:Ds});function ke(b,Q){if(!k.isUndefined(b)){if(R.indexOf(b)!==-1)throw Error("Circular reference detected in "+Q.join("."));R.push(b),k.forEach(b,function(Te,tt){(!(k.isUndefined(Te)||Te===null)&&r.call(t,Te,k.isString(tt)?tt.trim():tt,Q,F))===!0&&ke(Te,Q?Q.concat(tt):[tt])}),R.pop()}}if(!k.isObject(e))throw new TypeError("data must be an object");return ke(e),t}function cr(e){const t={"!":"%21","'":"%27","(":"%28",")":"%29","~":"%7E","%20":"+","%00":"\0"};return encodeURIComponent(e).replace(/[!'()~]|%20|%00/g,function(s){return t[s]})}function Hs(e,t){this._pairs=[],e&&ms(e,this,t)}const Hr=Hs.prototype;Hr.append=function(t,n){this._pairs.push([t,n])};Hr.toString=function(t){const n=t?function(s){return t.call(this,s,cr)}:cr;return this._pairs.map(function(r){return n(r[0])+"="+n(r[1])},"").join("&")};function ca(e){return encodeURIComponent(e).replace(/%3A/gi,":").replace(/%24/g,"$").replace(/%2C/gi,",").replace(/%20/g,"+")}function Ur(e,t,n){if(!t)return e;const s=n&&n.encode||ca,r=k.isFunction(n)?{serialize:n}:n,o=r&&r.serialize;let a;if(o?a=o(t,r):a=k.isURLSearchParams(t)?t.toString():new Hs(t,r).toString(s),a){const c=e.indexOf("#");c!==-1&&(e=e.slice(0,c)),e+=(e.indexOf("?")===-1?"?":"&")+a}return e}class lr{constructor(){this.handlers=[]}use(t,n,s){return this.handlers.push({fulfilled:t,rejected:n,synchronous:s?s.synchronous:!1,runWhen:s?s.runWhen:null}),this.handlers.length-1}eject(t){this.handlers[t]&&(this.handlers[t]=null)}clear(){this.handlers&&(this.handlers=[])}forEach(t){k.forEach(this.handlers,function(s){s!==null&&t(s)})}}const Us={silentJSONParsing:!0,forcedJSONParsing:!0,clarifyTimeoutError:!1,legacyInterceptorReqResOrdering:!0},la=typeof URLSearchParams<"u"?URLSearchParams:Hs,ua=typeof FormData<"u"?FormData:null,pa=typeof Blob<"u"?Blob:null,fa={isBrowser:!0,classes:{URLSearchParams:la,FormData:ua,Blob:pa},protocols:["http","https","file","blob","url","data"]},zs=typeof window<"u"&&typeof document<"u",Is=typeof navigator=="object"&&navigator||void 0,ga=zs&&(!Is||["ReactNative","NativeScript","NS"].indexOf(Is.product)<0),da=typeof WorkerGlobalScope<"u"&&self instanceof WorkerGlobalScope&&typeof self.importScripts=="function",ha=zs&&window.location.href||"http://localhost",ma=Object.freeze(Object.defineProperty({__proto__:null,hasBrowserEnv:zs,hasStandardBrowserEnv:ga,hasStandardBrowserWebWorkerEnv:da,navigator:Is,origin:ha},Symbol.toStringTag,{value:"Module"})),Ft={...ma,...fa};function ya(e,t){return ms(e,new Ft.classes.URLSearchParams,{visitor:function(n,s,r,o){return Ft.isNode&&k.isBuffer(n)?(this.append(s,n.toString("base64")),!1):o.defaultVisitor.apply(this,arguments)},...t})}function $a(e){return k.matchAll(/\w+|\[(\w*)]/g,e).map(t=>t[0]==="[]"?"":t[1]||t[0])}function wa(e){const t={},n=Object.keys(e);let s;const r=n.length;let o;for(s=0;s<r;s++)o=n[s],t[o]=e[o];return t}function zr(e){function t(n,s,r,o){let a=n[o++];if(a==="__proto__")return!0;const c=Number.isFinite(+a),v=o>=n.length;return a=!a&&k.isArray(r)?r.length:a,v?(k.hasOwnProp(r,a)?r[a]=[r[a],s]:r[a]=s,!c):((!r[a]||!k.isObject(r[a]))&&(r[a]=[]),t(n,s,r[a],o)&&k.isArray(r[a])&&(r[a]=wa(r[a])),!c)}if(k.isFormData(e)&&k.isFunction(e.entries)){const n={};return k.forEachEntry(e,(s,r)=>{t($a(s),r,n,0)}),n}return null}function ba(e,t,n){if(k.isString(e))try{return(t||JSON.parse)(e),k.trim(e)}catch(s){if(s.name!=="SyntaxError")throw s}return(n||JSON.stringify)(e)}const Wn={transitional:Us,adapter:["xhr","http","fetch"],transformRequest:[function(t,n){const s=n.getContentType()||"",r=s.indexOf("application/json")>-1,o=k.isObject(t);if(o&&k.isHTMLForm(t)&&(t=new FormData(t)),k.isFormData(t))return r?JSON.stringify(zr(t)):t;if(k.isArrayBuffer(t)||k.isBuffer(t)||k.isStream(t)||k.isFile(t)||k.isBlob(t)||k.isReadableStream(t))return t;if(k.isArrayBufferView(t))return t.buffer;if(k.isURLSearchParams(t))return n.setContentType("application/x-www-form-urlencoded;charset=utf-8",!1),t.toString();let c;if(o){if(s.indexOf("application/x-www-form-urlencoded")>-1)return ya(t,this.formSerializer).toString();if((c=k.isFileList(t))||s.indexOf("multipart/form-data")>-1){const v=this.env&&this.env.FormData;return ms(c?{"files[]":t}:t,v&&new v,this.formSerializer)}}return o||r?(n.setContentType("application/json",!1),ba(t)):t}],transformResponse:[function(t){const n=this.transitional||Wn.transitional,s=n&&n.forcedJSONParsing,r=this.responseType==="json";if(k.isResponse(t)||k.isReadableStream(t))return t;if(t&&k.isString(t)&&(s&&!this.responseType||r)){const a=!(n&&n.silentJSONParsing)&&r;try{return JSON.parse(t,this.parseReviver)}catch(c){if(a)throw c.name==="SyntaxError"?Be.from(c,Be.ERR_BAD_RESPONSE,this,null,this.response):c}}return t}],timeout:0,xsrfCookieName:"XSRF-TOKEN",xsrfHeaderName:"X-XSRF-TOKEN",maxContentLength:-1,maxBodyLength:-1,env:{FormData:Ft.classes.FormData,Blob:Ft.classes.Blob},validateStatus:function(t){return t>=200&&t<300},headers:{common:{Accept:"application/json, text/plain, */*","Content-Type":void 0}}};k.forEach(["delete","get","head","post","put","patch"],e=>{Wn.headers[e]={}});const va=k.toObjectSet(["age","authorization","content-length","content-type","etag","expires","from","host","if-modified-since","if-unmodified-since","last-modified","location","max-forwards","proxy-authorization","referer","retry-after","user-agent"]),Ta=e=>{const t={};let n,s,r;return e&&e.split(`
`).forEach(function(a){r=a.indexOf(":"),n=a.substring(0,r).trim().toLowerCase(),s=a.substring(r+1).trim(),!(!n||t[n]&&va[n])&&(n==="set-cookie"?t[n]?t[n].push(s):t[n]=[s]:t[n]=t[n]?t[n]+", "+s:s)}),t},ur=Symbol("internals"),Ca=e=>!/[\r\n]/.test(e);function Kr(e,t){if(!(e===!1||e==null)){if(k.isArray(e)){e.forEach(n=>Kr(n,t));return}if(!Ca(String(e)))throw new Error(`Invalid character in header content ["${t}"]`)}}function Un(e){return e&&String(e).trim().toLowerCase()}function Sa(e){let t=e.length;for(;t>0;){const n=e.charCodeAt(t-1);if(n!==10&&n!==13)break;t-=1}return t===e.length?e:e.slice(0,t)}function ls(e){return e===!1||e==null?e:k.isArray(e)?e.map(ls):Sa(String(e))}function xa(e){const t=Object.create(null),n=/([^\s,;=]+)\s*(?:=\s*([^,;]+))?/g;let s;for(;s=n.exec(e);)t[s[1]]=s[2];return t}const ka=e=>/^[-_a-zA-Z0-9^`|~,!#$%&'*+.]+$/.test(e.trim());function _s(e,t,n,s,r){if(k.isFunction(s))return s.call(this,t,n);if(r&&(t=n),!!k.isString(t)){if(k.isString(s))return t.indexOf(s)!==-1;if(k.isRegExp(s))return s.test(t)}}function Pa(e){return e.trim().toLowerCase().replace(/([a-z\d])(\w*)/g,(t,n,s)=>n.toUpperCase()+s)}function Ma(e,t){const n=k.toCamelCase(" "+t);["get","set","has"].forEach(s=>{Object.defineProperty(e,s+n,{value:function(r,o,a){return this[s].call(this,t,r,o,a)},configurable:!0})})}let Jt=class{constructor(t){t&&this.set(t)}set(t,n,s){const r=this;function o(c,v,S){const d=Un(v);if(!d)throw new Error("header name must be a non-empty string");const R=k.findKey(r,d);(!R||r[R]===void 0||S===!0||S===void 0&&r[R]!==!1)&&(Kr(c,v),r[R||v]=ls(c))}const a=(c,v)=>k.forEach(c,(S,d)=>o(S,d,v));if(k.isPlainObject(t)||t instanceof this.constructor)a(t,n);else if(k.isString(t)&&(t=t.trim())&&!ka(t))a(Ta(t),n);else if(k.isObject(t)&&k.isIterable(t)){let c={},v,S;for(const d of t){if(!k.isArray(d))throw TypeError("Object iterator must return a key-value pair");c[S=d[0]]=(v=c[S])?k.isArray(v)?[...v,d[1]]:[v,d[1]]:d[1]}a(c,n)}else t!=null&&o(n,t,s);return this}get(t,n){if(t=Un(t),t){const s=k.findKey(this,t);if(s){const r=this[s];if(!n)return r;if(n===!0)return xa(r);if(k.isFunction(n))return n.call(this,r,s);if(k.isRegExp(n))return n.exec(r);throw new TypeError("parser must be boolean|regexp|function")}}}has(t,n){if(t=Un(t),t){const s=k.findKey(this,t);return!!(s&&this[s]!==void 0&&(!n||_s(this,this[s],s,n)))}return!1}delete(t,n){const s=this;let r=!1;function o(a){if(a=Un(a),a){const c=k.findKey(s,a);c&&(!n||_s(s,s[c],c,n))&&(delete s[c],r=!0)}}return k.isArray(t)?t.forEach(o):o(t),r}clear(t){const n=Object.keys(this);let s=n.length,r=!1;for(;s--;){const o=n[s];(!t||_s(this,this[o],o,t,!0))&&(delete this[o],r=!0)}return r}normalize(t){const n=this,s={};return k.forEach(this,(r,o)=>{const a=k.findKey(s,o);if(a){n[a]=ls(r),delete n[o];return}const c=t?Pa(o):String(o).trim();c!==o&&delete n[o],n[c]=ls(r),s[c]=!0}),this}concat(...t){return this.constructor.concat(this,...t)}toJSON(t){const n=Object.create(null);return k.forEach(this,(s,r)=>{s!=null&&s!==!1&&(n[r]=t&&k.isArray(s)?s.join(", "):s)}),n}[Symbol.iterator](){return Object.entries(this.toJSON())[Symbol.iterator]()}toString(){return Object.entries(this.toJSON()).map(([t,n])=>t+": "+n).join(`
`)}getSetCookie(){return this.get("set-cookie")||[]}get[Symbol.toStringTag](){return"AxiosHeaders"}static from(t){return t instanceof this?t:new this(t)}static concat(t,...n){const s=new this(t);return n.forEach(r=>s.set(r)),s}static accessor(t){const s=(this[ur]=this[ur]={accessors:{}}).accessors,r=this.prototype;function o(a){const c=Un(a);s[c]||(Ma(r,a),s[c]=!0)}return k.isArray(t)?t.forEach(o):o(t),this}};Jt.accessor(["Content-Type","Content-Length","Accept","Accept-Encoding","User-Agent","Authorization"]);k.reduceDescriptors(Jt.prototype,({value:e},t)=>{let n=t[0].toUpperCase()+t.slice(1);return{get:()=>e,set(s){this[n]=s}}});k.freezeMethods(Jt);function Os(e,t){const n=this||Wn,s=t||n,r=Jt.from(s.headers);let o=s.data;return k.forEach(e,function(c){o=c.call(n,o,r.normalize(),t?t.status:void 0)}),r.normalize(),o}function Gr(e){return!!(e&&e.__CANCEL__)}let Vn=class extends Be{constructor(t,n,s){super(t??"canceled",Be.ERR_CANCELED,n,s),this.name="CanceledError",this.__CANCEL__=!0}};function Jr(e,t,n){const s=n.config.validateStatus;!n.status||!s||s(n.status)?e(n):t(new Be("Request failed with status code "+n.status,[Be.ERR_BAD_REQUEST,Be.ERR_BAD_RESPONSE][Math.floor(n.status/100)-4],n.config,n.request,n))}function Ea(e){const t=/^([-+\w]{1,25})(:?\/\/|:)/.exec(e);return t&&t[1]||""}function Aa(e,t){e=e||10;const n=new Array(e),s=new Array(e);let r=0,o=0,a;return t=t!==void 0?t:1e3,function(v){const S=Date.now(),d=s[o];a||(a=S),n[r]=v,s[r]=S;let R=o,F=0;for(;R!==r;)F+=n[R++],R=R%e;if(r=(r+1)%e,r===o&&(o=(o+1)%e),S-a<t)return;const ke=d&&S-d;return ke?Math.round(F*1e3/ke):void 0}}function _a(e,t){let n=0,s=1e3/t,r,o;const a=(S,d=Date.now())=>{n=d,r=null,o&&(clearTimeout(o),o=null),e(...S)};return[(...S)=>{const d=Date.now(),R=d-n;R>=s?a(S,d):(r=S,o||(o=setTimeout(()=>{o=null,a(r)},s-R)))},()=>r&&a(r)]}const ps=(e,t,n=3)=>{let s=0;const r=Aa(50,250);return _a(o=>{const a=o.loaded,c=o.lengthComputable?o.total:void 0,v=a-s,S=r(v),d=a<=c;s=a;const R={loaded:a,total:c,progress:c?a/c:void 0,bytes:v,rate:S||void 0,estimated:S&&c&&d?(c-a)/S:void 0,event:o,lengthComputable:c!=null,[t?"download":"upload"]:!0};e(R)},n)},pr=(e,t)=>{const n=e!=null;return[s=>t[0]({lengthComputable:n,total:e,loaded:s}),t[1]]},fr=e=>(...t)=>k.asap(()=>e(...t)),Oa=Ft.hasStandardBrowserEnv?((e,t)=>n=>(n=new URL(n,Ft.origin),e.protocol===n.protocol&&e.host===n.host&&(t||e.port===n.port)))(new URL(Ft.origin),Ft.navigator&&/(msie|trident)/i.test(Ft.navigator.userAgent)):()=>!0,Ra=Ft.hasStandardBrowserEnv?{write(e,t,n,s,r,o,a){if(typeof document>"u")return;const c=[`${e}=${encodeURIComponent(t)}`];k.isNumber(n)&&c.push(`expires=${new Date(n).toUTCString()}`),k.isString(s)&&c.push(`path=${s}`),k.isString(r)&&c.push(`domain=${r}`),o===!0&&c.push("secure"),k.isString(a)&&c.push(`SameSite=${a}`),document.cookie=c.join("; ")},read(e){if(typeof document>"u")return null;const t=document.cookie.match(new RegExp("(?:^|; )"+e+"=([^;]*)"));return t?decodeURIComponent(t[1]):null},remove(e){this.write(e,"",Date.now()-864e5,"/")}}:{write(){},read(){return null},remove(){}};function ja(e){return typeof e!="string"?!1:/^([a-z][a-z\d+\-.]*:)?\/\//i.test(e)}function La(e,t){return t?e.replace(/\/?\/$/,"")+"/"+t.replace(/^\/+/,""):e}function Br(e,t,n){let s=!ja(t);return e&&(s||n==!1)?La(e,t):t}const gr=e=>e instanceof Jt?{...e}:e;function _n(e,t){t=t||{};const n={};function s(S,d,R,F){return k.isPlainObject(S)&&k.isPlainObject(d)?k.merge.call({caseless:F},S,d):k.isPlainObject(d)?k.merge({},d):k.isArray(d)?d.slice():d}function r(S,d,R,F){if(k.isUndefined(d)){if(!k.isUndefined(S))return s(void 0,S,R,F)}else return s(S,d,R,F)}function o(S,d){if(!k.isUndefined(d))return s(void 0,d)}function a(S,d){if(k.isUndefined(d)){if(!k.isUndefined(S))return s(void 0,S)}else return s(void 0,d)}function c(S,d,R){if(R in t)return s(S,d);if(R in e)return s(void 0,S)}const v={url:o,method:o,data:o,baseURL:a,transformRequest:a,transformResponse:a,paramsSerializer:a,timeout:a,timeoutMessage:a,withCredentials:a,withXSRFToken:a,adapter:a,responseType:a,xsrfCookieName:a,xsrfHeaderName:a,onUploadProgress:a,onDownloadProgress:a,decompress:a,maxContentLength:a,maxBodyLength:a,beforeRedirect:a,transport:a,httpAgent:a,httpsAgent:a,cancelToken:a,socketPath:a,responseEncoding:a,validateStatus:c,headers:(S,d,R)=>r(gr(S),gr(d),R,!0)};return k.forEach(Object.keys({...e,...t}),function(d){if(d==="__proto__"||d==="constructor"||d==="prototype")return;const R=k.hasOwnProp(v,d)?v[d]:r,F=R(e[d],t[d],d);k.isUndefined(F)&&R!==c||(n[d]=F)}),n}const Qr=e=>{const t=_n({},e);let{data:n,withXSRFToken:s,xsrfHeaderName:r,xsrfCookieName:o,headers:a,auth:c}=t;if(t.headers=a=Jt.from(a),t.url=Ur(Br(t.baseURL,t.url,t.allowAbsoluteUrls),e.params,e.paramsSerializer),c&&a.set("Authorization","Basic "+btoa((c.username||"")+":"+(c.password?unescape(encodeURIComponent(c.password)):""))),k.isFormData(n)){if(Ft.hasStandardBrowserEnv||Ft.hasStandardBrowserWebWorkerEnv)a.setContentType(void 0);else if(k.isFunction(n.getHeaders)){const v=n.getHeaders(),S=["content-type","content-length"];Object.entries(v).forEach(([d,R])=>{S.includes(d.toLowerCase())&&a.set(d,R)})}}if(Ft.hasStandardBrowserEnv&&(s&&k.isFunction(s)&&(s=s(t)),s||s!==!1&&Oa(t.url))){const v=r&&o&&Ra.read(o);v&&a.set(r,v)}return t},Na=typeof XMLHttpRequest<"u",Da=Na&&function(e){return new Promise(function(n,s){const r=Qr(e);let o=r.data;const a=Jt.from(r.headers).normalize();let{responseType:c,onUploadProgress:v,onDownloadProgress:S}=r,d,R,F,ke,b;function Q(){ke&&ke(),b&&b(),r.cancelToken&&r.cancelToken.unsubscribe(d),r.signal&&r.signal.removeEventListener("abort",d)}let j=new XMLHttpRequest;j.open(r.method.toUpperCase(),r.url,!0),j.timeout=r.timeout;function Te(){if(!j)return;const Ke=Jt.from("getAllResponseHeaders"in j&&j.getAllResponseHeaders()),nt={data:!c||c==="text"||c==="json"?j.responseText:j.response,status:j.status,statusText:j.statusText,headers:Ke,config:e,request:j};Jr(function(wt){n(wt),Q()},function(wt){s(wt),Q()},nt),j=null}"onloadend"in j?j.onloadend=Te:j.onreadystatechange=function(){!j||j.readyState!==4||j.status===0&&!(j.responseURL&&j.responseURL.indexOf("file:")===0)||setTimeout(Te)},j.onabort=function(){j&&(s(new Be("Request aborted",Be.ECONNABORTED,e,j)),j=null)},j.onerror=function(We){const nt=We&&We.message?We.message:"Network Error",ne=new Be(nt,Be.ERR_NETWORK,e,j);ne.event=We||null,s(ne),j=null},j.ontimeout=function(){let We=r.timeout?"timeout of "+r.timeout+"ms exceeded":"timeout exceeded";const nt=r.transitional||Us;r.timeoutErrorMessage&&(We=r.timeoutErrorMessage),s(new Be(We,nt.clarifyTimeoutError?Be.ETIMEDOUT:Be.ECONNABORTED,e,j)),j=null},o===void 0&&a.setContentType(null),"setRequestHeader"in j&&k.forEach(a.toJSON(),function(We,nt){j.setRequestHeader(nt,We)}),k.isUndefined(r.withCredentials)||(j.withCredentials=!!r.withCredentials),c&&c!=="json"&&(j.responseType=r.responseType),S&&([F,b]=ps(S,!0),j.addEventListener("progress",F)),v&&j.upload&&([R,ke]=ps(v),j.upload.addEventListener("progress",R),j.upload.addEventListener("loadend",ke)),(r.cancelToken||r.signal)&&(d=Ke=>{j&&(s(!Ke||Ke.type?new Vn(null,e,j):Ke),j.abort(),j=null)},r.cancelToken&&r.cancelToken.subscribe(d),r.signal&&(r.signal.aborted?d():r.signal.addEventListener("abort",d)));const tt=Ea(r.url);if(tt&&Ft.protocols.indexOf(tt)===-1){s(new Be("Unsupported protocol "+tt+":",Be.ERR_BAD_REQUEST,e));return}j.send(o||null)})},Ia=(e,t)=>{const{length:n}=e=e?e.filter(Boolean):[];if(t||n){let s=new AbortController,r;const o=function(S){if(!r){r=!0,c();const d=S instanceof Error?S:this.reason;s.abort(d instanceof Be?d:new Vn(d instanceof Error?d.message:d))}};let a=t&&setTimeout(()=>{a=null,o(new Be(`timeout of ${t}ms exceeded`,Be.ETIMEDOUT))},t);const c=()=>{e&&(a&&clearTimeout(a),a=null,e.forEach(S=>{S.unsubscribe?S.unsubscribe(o):S.removeEventListener("abort",o)}),e=null)};e.forEach(S=>S.addEventListener("abort",o));const{signal:v}=s;return v.unsubscribe=()=>k.asap(c),v}},Fa=function*(e,t){let n=e.byteLength;if(n<t){yield e;return}let s=0,r;for(;s<n;)r=s+t,yield e.slice(s,r),s=r},qa=async function*(e,t){for await(const n of Ha(e))yield*Fa(n,t)},Ha=async function*(e){if(e[Symbol.asyncIterator]){yield*e;return}const t=e.getReader();try{for(;;){const{done:n,value:s}=await t.read();if(n)break;yield s}}finally{await t.cancel()}},dr=(e,t,n,s)=>{const r=qa(e,t);let o=0,a,c=v=>{a||(a=!0,s&&s(v))};return new ReadableStream({async pull(v){try{const{done:S,value:d}=await r.next();if(S){c(),v.close();return}let R=d.byteLength;if(n){let F=o+=R;n(F)}v.enqueue(new Uint8Array(d))}catch(S){throw c(S),S}},cancel(v){return c(v),r.return()}},{highWaterMark:2})},hr=64*1024,{isFunction:ss}=k,Ua=(({Request:e,Response:t})=>({Request:e,Response:t}))(k.global),{ReadableStream:mr,TextEncoder:yr}=k.global,$r=(e,...t)=>{try{return!!e(...t)}catch{return!1}},za=e=>{e=k.merge.call({skipUndefined:!0},Ua,e);const{fetch:t,Request:n,Response:s}=e,r=t?ss(t):typeof fetch=="function",o=ss(n),a=ss(s);if(!r)return!1;const c=r&&ss(mr),v=r&&(typeof yr=="function"?(b=>Q=>b.encode(Q))(new yr):async b=>new Uint8Array(await new n(b).arrayBuffer())),S=o&&c&&$r(()=>{let b=!1;const Q=new mr,j=new n(Ft.origin,{body:Q,method:"POST",get duplex(){return b=!0,"half"}}).headers.has("Content-Type");return Q.cancel(),b&&!j}),d=a&&c&&$r(()=>k.isReadableStream(new s("").body)),R={stream:d&&(b=>b.body)};r&&["text","arrayBuffer","blob","formData","stream"].forEach(b=>{!R[b]&&(R[b]=(Q,j)=>{let Te=Q&&Q[b];if(Te)return Te.call(Q);throw new Be(`Response type '${b}' is not supported`,Be.ERR_NOT_SUPPORT,j)})});const F=async b=>{if(b==null)return 0;if(k.isBlob(b))return b.size;if(k.isSpecCompliantForm(b))return(await new n(Ft.origin,{method:"POST",body:b}).arrayBuffer()).byteLength;if(k.isArrayBufferView(b)||k.isArrayBuffer(b))return b.byteLength;if(k.isURLSearchParams(b)&&(b=b+""),k.isString(b))return(await v(b)).byteLength},ke=async(b,Q)=>{const j=k.toFiniteNumber(b.getContentLength());return j??F(Q)};return async b=>{let{url:Q,method:j,data:Te,signal:tt,cancelToken:Ke,timeout:We,onDownloadProgress:nt,onUploadProgress:ne,responseType:wt,headers:$e,withCredentials:Ge="same-origin",fetchOptions:_e}=Qr(b),gt=t||fetch;wt=wt?(wt+"").toLowerCase():"text";let ct=Ia([tt,Ke&&Ke.toAbortSignal()],We),Ze=null;const Pe=ct&&ct.unsubscribe&&(()=>{ct.unsubscribe()});let Ve;try{if(ne&&S&&j!=="get"&&j!=="head"&&(Ve=await ke($e,Te))!==0){let jt=new n(Q,{method:"POST",body:Te,duplex:"half"}),Ht;if(k.isFormData(Te)&&(Ht=jt.headers.get("content-type"))&&$e.setContentType(Ht),jt.body){const[St,it]=pr(Ve,ps(fr(ne)));Te=dr(jt.body,hr,St,it)}}k.isString(Ge)||(Ge=Ge?"include":"omit");const dt=o&&"credentials"in n.prototype,De={..._e,signal:ct,method:j.toUpperCase(),headers:$e.normalize().toJSON(),body:Te,duplex:"half",credentials:dt?Ge:void 0};Ze=o&&new n(Q,De);let qe=await(o?gt(Ze,_e):gt(Q,De));const _t=d&&(wt==="stream"||wt==="response");if(d&&(nt||_t&&Pe)){const jt={};["status","statusText","headers"].forEach(xt=>{jt[xt]=qe[xt]});const Ht=k.toFiniteNumber(qe.headers.get("content-length")),[St,it]=nt&&pr(Ht,ps(fr(nt),!0))||[];qe=new s(dr(qe.body,hr,St,()=>{it&&it(),Pe&&Pe()}),jt)}wt=wt||"text";let cn=await R[k.findKey(R,wt)||"text"](qe,b);return!_t&&Pe&&Pe(),await new Promise((jt,Ht)=>{Jr(jt,Ht,{data:cn,headers:Jt.from(qe.headers),status:qe.status,statusText:qe.statusText,config:b,request:Ze})})}catch(dt){throw Pe&&Pe(),dt&&dt.name==="TypeError"&&/Load failed|fetch/i.test(dt.message)?Object.assign(new Be("Network Error",Be.ERR_NETWORK,b,Ze,dt&&dt.response),{cause:dt.cause||dt}):Be.from(dt,dt&&dt.code,b,Ze,dt&&dt.response)}}},Ka=new Map,Wr=e=>{let t=e&&e.env||{};const{fetch:n,Request:s,Response:r}=t,o=[s,r,n];let a=o.length,c=a,v,S,d=Ka;for(;c--;)v=o[c],S=d.get(v),S===void 0&&d.set(v,S=c?new Map:za(t)),d=S;return S};Wr();const Ks={http:oa,xhr:Da,fetch:{get:Wr}};k.forEach(Ks,(e,t)=>{if(e){try{Object.defineProperty(e,"name",{value:t})}catch{}Object.defineProperty(e,"adapterName",{value:t})}});const wr=e=>`- ${e}`,Ga=e=>k.isFunction(e)||e===null||e===!1;function Ja(e,t){e=k.isArray(e)?e:[e];const{length:n}=e;let s,r;const o={};for(let a=0;a<n;a++){s=e[a];let c;if(r=s,!Ga(s)&&(r=Ks[(c=String(s)).toLowerCase()],r===void 0))throw new Be(`Unknown adapter '${c}'`);if(r&&(k.isFunction(r)||(r=r.get(t))))break;o[c||"#"+a]=r}if(!r){const a=Object.entries(o).map(([v,S])=>`adapter ${v} `+(S===!1?"is not supported by the environment":"is not available in the build"));let c=n?a.length>1?`since :
`+a.map(wr).join(`
`):" "+wr(a[0]):"as no adapter specified";throw new Be("There is no suitable adapter to dispatch the request "+c,"ERR_NOT_SUPPORT")}return r}const Vr={getAdapter:Ja,adapters:Ks};function Rs(e){if(e.cancelToken&&e.cancelToken.throwIfRequested(),e.signal&&e.signal.aborted)throw new Vn(null,e)}function br(e){return Rs(e),e.headers=Jt.from(e.headers),e.data=Os.call(e,e.transformRequest),["post","put","patch"].indexOf(e.method)!==-1&&e.headers.setContentType("application/x-www-form-urlencoded",!1),Vr.getAdapter(e.adapter||Wn.adapter,e)(e).then(function(s){return Rs(e),s.data=Os.call(e,e.transformResponse,s),s.headers=Jt.from(s.headers),s},function(s){return Gr(s)||(Rs(e),s&&s.response&&(s.response.data=Os.call(e,e.transformResponse,s.response),s.response.headers=Jt.from(s.response.headers))),Promise.reject(s)})}const Xr="1.15.0",ys={};["object","boolean","number","function","string","symbol"].forEach((e,t)=>{ys[e]=function(s){return typeof s===e||"a"+(t<1?"n ":" ")+e}});const vr={};ys.transitional=function(t,n,s){function r(o,a){return"[Axios v"+Xr+"] Transitional option '"+o+"'"+a+(s?". "+s:"")}return(o,a,c)=>{if(t===!1)throw new Be(r(a," has been removed"+(n?" in "+n:"")),Be.ERR_DEPRECATED);return n&&!vr[a]&&(vr[a]=!0,console.warn(r(a," has been deprecated since v"+n+" and will be removed in the near future"))),t?t(o,a,c):!0}};ys.spelling=function(t){return(n,s)=>(console.warn(`${s} is likely a misspelling of ${t}`),!0)};function Ba(e,t,n){if(typeof e!="object")throw new Be("options must be an object",Be.ERR_BAD_OPTION_VALUE);const s=Object.keys(e);let r=s.length;for(;r-- >0;){const o=s[r],a=t[o];if(a){const c=e[o],v=c===void 0||a(c,o,e);if(v!==!0)throw new Be("option "+o+" must be "+v,Be.ERR_BAD_OPTION_VALUE);continue}if(n!==!0)throw new Be("Unknown option "+o,Be.ERR_BAD_OPTION)}}const us={assertOptions:Ba,validators:ys},Xt=us.validators;let An=class{constructor(t){this.defaults=t||{},this.interceptors={request:new lr,response:new lr}}async request(t,n){try{return await this._request(t,n)}catch(s){if(s instanceof Error){let r={};Error.captureStackTrace?Error.captureStackTrace(r):r=new Error;const o=(()=>{if(!r.stack)return"";const a=r.stack.indexOf(`
`);return a===-1?"":r.stack.slice(a+1)})();try{if(!s.stack)s.stack=o;else if(o){const a=o.indexOf(`
`),c=a===-1?-1:o.indexOf(`
`,a+1),v=c===-1?"":o.slice(c+1);String(s.stack).endsWith(v)||(s.stack+=`
`+o)}}catch{}}throw s}}_request(t,n){typeof t=="string"?(n=n||{},n.url=t):n=t||{},n=_n(this.defaults,n);const{transitional:s,paramsSerializer:r,headers:o}=n;s!==void 0&&us.assertOptions(s,{silentJSONParsing:Xt.transitional(Xt.boolean),forcedJSONParsing:Xt.transitional(Xt.boolean),clarifyTimeoutError:Xt.transitional(Xt.boolean),legacyInterceptorReqResOrdering:Xt.transitional(Xt.boolean)},!1),r!=null&&(k.isFunction(r)?n.paramsSerializer={serialize:r}:us.assertOptions(r,{encode:Xt.function,serialize:Xt.function},!0)),n.allowAbsoluteUrls!==void 0||(this.defaults.allowAbsoluteUrls!==void 0?n.allowAbsoluteUrls=this.defaults.allowAbsoluteUrls:n.allowAbsoluteUrls=!0),us.assertOptions(n,{baseUrl:Xt.spelling("baseURL"),withXsrfToken:Xt.spelling("withXSRFToken")},!0),n.method=(n.method||this.defaults.method||"get").toLowerCase();let a=o&&k.merge(o.common,o[n.method]);o&&k.forEach(["delete","get","head","post","put","patch","common"],b=>{delete o[b]}),n.headers=Jt.concat(a,o);const c=[];let v=!0;this.interceptors.request.forEach(function(Q){if(typeof Q.runWhen=="function"&&Q.runWhen(n)===!1)return;v=v&&Q.synchronous;const j=n.transitional||Us;j&&j.legacyInterceptorReqResOrdering?c.unshift(Q.fulfilled,Q.rejected):c.push(Q.fulfilled,Q.rejected)});const S=[];this.interceptors.response.forEach(function(Q){S.push(Q.fulfilled,Q.rejected)});let d,R=0,F;if(!v){const b=[br.bind(this),void 0];for(b.unshift(...c),b.push(...S),F=b.length,d=Promise.resolve(n);R<F;)d=d.then(b[R++],b[R++]);return d}F=c.length;let ke=n;for(;R<F;){const b=c[R++],Q=c[R++];try{ke=b(ke)}catch(j){Q.call(this,j);break}}try{d=br.call(this,ke)}catch(b){return Promise.reject(b)}for(R=0,F=S.length;R<F;)d=d.then(S[R++],S[R++]);return d}getUri(t){t=_n(this.defaults,t);const n=Br(t.baseURL,t.url,t.allowAbsoluteUrls);return Ur(n,t.params,t.paramsSerializer)}};k.forEach(["delete","get","head","options"],function(t){An.prototype[t]=function(n,s){return this.request(_n(s||{},{method:t,url:n,data:(s||{}).data}))}});k.forEach(["post","put","patch"],function(t){function n(s){return function(o,a,c){return this.request(_n(c||{},{method:t,headers:s?{"Content-Type":"multipart/form-data"}:{},url:o,data:a}))}}An.prototype[t]=n(),An.prototype[t+"Form"]=n(!0)});let Qa=class Zr{constructor(t){if(typeof t!="function")throw new TypeError("executor must be a function.");let n;this.promise=new Promise(function(o){n=o});const s=this;this.promise.then(r=>{if(!s._listeners)return;let o=s._listeners.length;for(;o-- >0;)s._listeners[o](r);s._listeners=null}),this.promise.then=r=>{let o;const a=new Promise(c=>{s.subscribe(c),o=c}).then(r);return a.cancel=function(){s.unsubscribe(o)},a},t(function(o,a,c){s.reason||(s.reason=new Vn(o,a,c),n(s.reason))})}throwIfRequested(){if(this.reason)throw this.reason}subscribe(t){if(this.reason){t(this.reason);return}this._listeners?this._listeners.push(t):this._listeners=[t]}unsubscribe(t){if(!this._listeners)return;const n=this._listeners.indexOf(t);n!==-1&&this._listeners.splice(n,1)}toAbortSignal(){const t=new AbortController,n=s=>{t.abort(s)};return this.subscribe(n),t.signal.unsubscribe=()=>this.unsubscribe(n),t.signal}static source(){let t;return{token:new Zr(function(r){t=r}),cancel:t}}};function Wa(e){return function(n){return e.apply(null,n)}}function Va(e){return k.isObject(e)&&e.isAxiosError===!0}const Fs={Continue:100,SwitchingProtocols:101,Processing:102,EarlyHints:103,Ok:200,Created:201,Accepted:202,NonAuthoritativeInformation:203,NoContent:204,ResetContent:205,PartialContent:206,MultiStatus:207,AlreadyReported:208,ImUsed:226,MultipleChoices:300,MovedPermanently:301,Found:302,SeeOther:303,NotModified:304,UseProxy:305,Unused:306,TemporaryRedirect:307,PermanentRedirect:308,BadRequest:400,Unauthorized:401,PaymentRequired:402,Forbidden:403,NotFound:404,MethodNotAllowed:405,NotAcceptable:406,ProxyAuthenticationRequired:407,RequestTimeout:408,Conflict:409,Gone:410,LengthRequired:411,PreconditionFailed:412,PayloadTooLarge:413,UriTooLong:414,UnsupportedMediaType:415,RangeNotSatisfiable:416,ExpectationFailed:417,ImATeapot:418,MisdirectedRequest:421,UnprocessableEntity:422,Locked:423,FailedDependency:424,TooEarly:425,UpgradeRequired:426,PreconditionRequired:428,TooManyRequests:429,RequestHeaderFieldsTooLarge:431,UnavailableForLegalReasons:451,InternalServerError:500,NotImplemented:501,BadGateway:502,ServiceUnavailable:503,GatewayTimeout:504,HttpVersionNotSupported:505,VariantAlsoNegotiates:506,InsufficientStorage:507,LoopDetected:508,NotExtended:510,NetworkAuthenticationRequired:511,WebServerIsDown:521,ConnectionTimedOut:522,OriginIsUnreachable:523,TimeoutOccurred:524,SslHandshakeFailed:525,InvalidSslCertificate:526};Object.entries(Fs).forEach(([e,t])=>{Fs[t]=e});function Yr(e){const t=new An(e),n=_r(An.prototype.request,t);return k.extend(n,An.prototype,t,{allOwnKeys:!0}),k.extend(n,t,null,{allOwnKeys:!0}),n.create=function(r){return Yr(_n(e,r))},n}const kt=Yr(Wn);kt.Axios=An;kt.CanceledError=Vn;kt.CancelToken=Qa;kt.isCancel=Gr;kt.VERSION=Xr;kt.toFormData=ms;kt.AxiosError=Be;kt.Cancel=kt.CanceledError;kt.all=function(t){return Promise.all(t)};kt.spread=Wa;kt.isAxiosError=Va;kt.mergeConfig=_n;kt.AxiosHeaders=Jt;kt.formToJSON=e=>zr(k.isHTMLForm(e)?new FormData(e):e);kt.getAdapter=Vr.getAdapter;kt.HttpStatusCode=Fs;kt.default=kt;const{Axios:zi,AxiosError:Ki,CanceledError:Gi,isCancel:Ji,CancelToken:Bi,VERSION:Qi,all:Wi,Cancel:Vi,isAxiosError:Xi,spread:Zi,toFormData:Yi,AxiosHeaders:ec,HttpStatusCode:tc,formToJSON:nc,getAdapter:sc,mergeConfig:rc}=kt,Tr={数学:{小学:{label:"小学数学",contexts:[{name:"校园义卖活动",description:"班级组织义卖活动，同学们负责统计物品价格、计算找零、分配摊位面积",scenes:["统计义卖物品价格","计算找零金额","分配摊位面积","统计义卖总收入"],suitableTopics:["加减法","乘除法","面积计算","统计图表"]},{name:"家庭旅行计划",description:"小明家计划一次周末旅行，需要计算路程、时间、预算等",scenes:["出发时间计算","路程距离计算","住宿费用预算","景点门票总价"],suitableTopics:["时间计算","距离换算","四则运算","估算"]},{name:"趣味运动会",description:"学校举办趣味运动会，需要统计得分、安排比赛顺序、计算成绩",scenes:["接力赛成绩计算","拔河比赛人数分配","跳绳次数统计","总积分排名"],suitableTopics:["加减法","乘除法","统计","比较大小"]},{name:"小小超市管理员",description:"模拟超市购物场景，帮助同学们理解货币计算和商品统计",scenes:["商品价格计算","找零练习","打折促销计算","库存盘点统计"],suitableTopics:["人民币计算","加减法","乘法","统计"]},{name:"手工课的材料准备",description:"手工课上需要准备材料，计算所需材料的数量和费用",scenes:["纸张数量计算","彩带长度测量","材料费用总计","剩余材料统计"],suitableTopics:["测量","加减法","乘除法","长度单位"]}],keywords:["购物","游戏","手工","分享","校园"]},初中:{label:"初中数学",contexts:[{name:"社区环保项目",description:"同学们参与社区环保项目，需要统计数据、设计方案、计算成本",scenes:["垃圾分类统计","绿化面积计算","节水方案设计","碳排放估算"],suitableTopics:["统计","函数","方程","几何面积"]},{name:"科技节创新大赛",description:"学校举办科技创新大赛，参赛作品需要进行数据分析和模型设计",scenes:["模型制作比例","竞赛数据分析","预算优化方案","成绩预测"],suitableTopics:["相似","统计","函数","概率"]},{name:"校园改造计划",description:"学校计划改造操场和图书馆，需要进行测量、预算和方案设计",scenes:["操场跑道的几何设计","图书馆书架排列","能耗评估","预算分配"],suitableTopics:["几何","方程","不等式","统计"]},{name:"城市地铁建设",description:"模拟城市地铁线路规划，运用数学知识解决实际问题",scenes:["地铁票价方案","线路距离计算","客流量统计","最优路线选择"],suitableTopics:["函数","统计","不等式","最值问题"]},{name:"手机套餐选择",description:"帮助同学分析选择最合适的手机套餐方案",scenes:["通话费用计算","流量使用分析","套餐对比","最优方案决策"],suitableTopics:["一次函数","不等式","方案决策","分段函数"]}],keywords:["实践","探究","决策","建模","应用"]},高中:{label:"高中数学",contexts:[{name:"投资理财分析",description:"分析不同投资方案的收益和风险，做出最优投资决策",scenes:["复利计算","风险概率分析","投资组合优化","收益率对比"],suitableTopics:["指数函数","概率","统计","优化"]},{name:"疫情传播模型",description:"运用数学模型分析传染病传播规律，预测发展趋势",scenes:["传播速度分析","感染人数预测","防控措施效果评估","达到峰值时间预测"],suitableTopics:["指数函数","导数","概率","统计"]},{name:"卫星轨道设计",description:"运用解析几何和函数知识设计卫星运行轨道",scenes:["轨道方程建立","近地点远地点计算","速度变化分析","覆盖范围计算"],suitableTopics:["解析几何","函数","导数","三角函数"]},{name:"产品质量控制",description:"工厂生产线上运用统计知识进行产品质量检验和控制",scenes:["抽样方案设计","合格率统计","正态分布分析","控制图绘制"],suitableTopics:["概率","统计","正态分布","假设检验"]}],keywords:["建模","分析","预测","决策","优化"]}},物理:{初中:{label:"初中物理",contexts:[{name:"交通安全探究",description:"从物理角度分析日常交通中的安全问题",scenes:["刹车距离计算","安全带原理分析","超载压强计算","限速的物理依据"],suitableTopics:["运动","力","压强","惯性"]},{name:"厨房中的物理",description:"从厨房中的日常现象出发，探究背后的物理原理",scenes:["高压锅原理","冰箱制冷分析","微波炉加热","抽油烟机安装高度"],suitableTopics:["热学","力学","电学","压强"]},{name:"运动会上的物理",description:"分析体育运动中蕴含的物理知识",scenes:["跳远起跳角度","铅球抛物线","跑步起步加速度","游泳浮力"],suitableTopics:["运动","力","浮力","能量"]},{name:"家庭电路安全",description:"设计安全合理的家庭电路布局方案",scenes:["插座功率分配","保险丝选择","电线规格计算","漏电保护"],suitableTopics:["电学","功率","安全用电"]}],keywords:["实验","探究","应用","安全","生活"]},高中:{label:"高中物理",contexts:[{name:"航天发射任务",description:"运用力学和运动学知识分析火箭发射过程",scenes:["逃逸速度计算","轨道对接方案","微重力实验设计","太阳能帆板展开"],suitableTopics:["万有引力","圆周运动","动量","能量"]},{name:"新能源汽车设计",description:"从能量和效率角度分析新能源汽车的设计原理",scenes:["电池续航计算","能量回收效率","电机功率匹配","车身轻量化"],suitableTopics:["能量","功率","效率","电学"]},{name:"高速铁路工程师",description:"运用力学和电磁学知识设计高速铁路系统",scenes:["转弯半径与速度的关系","电磁制动原理","列车能耗计算","铁轨热胀冷缩分析"],suitableTopics:["圆周运动","电磁感应","能量","热学"]},{name:"智能手机研发",description:"从物理角度分析智能手机的关键技术",scenes:["触摸屏电容原理","电池快充技术","无线充电效率","陀螺仪与加速度计"],suitableTopics:["电容","电磁感应","电学","传感器"]},{name:"核电站技术员",description:"了解核电站工作原理，进行安全评估和效率分析",scenes:["核裂变能量计算","冷却系统设计","辐射防护方案","能量转换效率"],suitableTopics:["原子物理","能量","热学","电磁感应"]},{name:"光纤通信工程师",description:"设计光纤通信系统，运用光学和电磁学知识",scenes:["光纤折射率选择","信号衰减计算","全反射条件分析","光信号调制"],suitableTopics:["光学","折射","电磁波","波的性质"]},{name:"体育科学分析师",description:"为运动员提供科学训练建议，运用力学知识",scenes:["投篮最佳角度计算","跳高助跑速度分析","铅球抛物线优化","短跑起跑力学分析"],suitableTopics:["抛体运动","力学","运动学","能量转换"]},{name:"桥梁结构工程师",description:"设计桥梁结构，进行受力分析和材料选择",scenes:["拱桥受力分析","悬索桥张力计算","桥墩压强计算","风振效应分析"],suitableTopics:["力学","受力分析","压强","振动"]}],keywords:["建模","计算","设计","优化","科技","工程","创新"]}},化学:{初中:{label:"初中化学",contexts:[{name:"水质检测员",description:"模拟水质检测过程，运用化学知识分析水样",scenes:["pH值检测","硬水软化方案","溶解氧测定","净水器原理"],suitableTopics:["溶液","酸碱盐","化学与生活"]},{name:"金属回收站",description:"设计废旧金属分类和回收方案",scenes:["金属活动性鉴别","防锈方案设计","合金性能分析","回收流程优化"],suitableTopics:["金属","化学反应","材料"]},{name:"厨房化学家",description:"通过厨房中的常见现象学习化学原理",scenes:["食盐溶解与结晶","小苏打发面原理","食醋除水垢","纯碱与食盐的区分"],suitableTopics:["溶液","酸碱盐","化学与生活","物质分类"]},{name:"环保小卫士",description:"参与校园环保项目，运用化学知识解决环境问题",scenes:["酸雨形成模拟","污水处理方案设计","白色污染分析","空气净化材料选择"],suitableTopics:["化学与环境","酸碱盐","化学方程式","材料"]},{name:"实验室管理员",description:"帮助化学实验室整理药品、设计实验方案",scenes:["药品分类存放","试剂配制计算","气体制备装置选择","实验安全评估"],suitableTopics:["化学实验","化学计算","气体制备","实验安全"]},{name:"材料研发员",description:"为新产品选择合适的材料，运用化学知识分析材料性能",scenes:["合金材料选择","塑料材质分析","防火材料评估","导电材料对比"],suitableTopics:["金属材料","合成材料","化学性质","材料应用"]},{name:"化肥厂技术员",description:"在化肥厂工作，需要分析化肥成分和配制方案",scenes:["氮肥含氮量计算","复合肥配比设计","土壤酸碱度调节","化肥鉴别"],suitableTopics:["化学计算","化学式","酸碱盐","化学方程式"]}],keywords:["实验","探究","环保","应用","生活","材料"]}},语文:{小学:{label:"小学语文",contexts:[{name:"童话创作坊",description:"创设童话情境，激发学生的阅读和写作兴趣",scenes:["续写童话结尾","角色对话补全","故事道理归纳","想象作文"],suitableTopics:["阅读","写作","口语交际"]},{name:"小小观察家",description:"引导学生观察生活中的细节，培养表达能力",scenes:["植物生长日记","天气变化记录","小动物观察","家人采访"],suitableTopics:["写作","口语交际","综合性学习"]},{name:"传统节日之旅",description:"通过传统节日情境学习古诗和传统文化",scenes:["春节习俗介绍","中秋赏月写诗","端午包粽子","元宵猜灯谜"],suitableTopics:["古诗","阅读","写作","传统文化"]}],keywords:["阅读","写作","观察","想象","表达"]},初中:{label:"初中语文",contexts:[{name:"校园文学社",description:"以校园文学社活动为载体，进行阅读和写作训练",scenes:["名著读后感","诗歌创作比赛","辩论赛准备","人物访谈"],suitableTopics:["阅读","写作","口语交际","综合性学习"]},{name:"文化研学之旅",description:"通过文化研学活动，深入理解传统文化和地域特色",scenes:["名人故居参观","非遗项目体验","地方戏曲欣赏","美食文化探究"],suitableTopics:["阅读","写作","综合性学习","传统文化"]}],keywords:["阅读","写作","文化","思辨","表达"]},高中:{label:"高中语文",contexts:[{name:"时代精神思辨",description:"围绕当代社会热点，进行思辨性阅读和表达训练",scenes:["科技伦理讨论","文化传承辩论","社会责任思考","人生价值探讨"],suitableTopics:["议论文","思辨阅读","写作","综合性学习"]}],keywords:["思辨","议论","文化","时代","价值"]}},英语:{小学:{label:"小学英语",contexts:[{name:"动物园一日游",description:"模拟动物园参观场景，练习动物和颜色相关词汇",scenes:["认识动物名称","描述动物特征","询问和回答路线","写游览日记"],suitableTopics:["词汇","句型","口语交际","写作"]},{name:"生日派对准备",description:"筹备一个生日派对，练习购物和邀请相关英语",scenes:["写邀请函","购买派对用品","点餐对话","感谢卡写作"],suitableTopics:["词汇","句型","写作","口语交际"]}],keywords:["游戏","对话","情景","趣味"]},初中:{label:"初中英语",contexts:[{name:"国际交流生",description:"模拟作为交换生到英语国家学习的情境",scenes:["自我介绍","学校课程讨论","家庭寄宿生活","周末活动安排"],suitableTopics:["口语","阅读","写作","文化意识"]},{name:"环保志愿者",description:"参与国际环保志愿活动，练习英语表达",scenes:["环保海报制作","社区宣传活动","倡议书撰写","成果汇报展示"],suitableTopics:["写作","阅读","口语","综合性学习"]}],keywords:["交流","文化","实践","表达","合作"]}}},Xa=(e,t,n=3)=>{var o,a,c;const s=(o=Tr[e])==null?void 0:o[t];if(!s||!((a=s.contexts)!=null&&a.length)){const v=Object.values(Tr[e]||{})[0];return(c=v==null?void 0:v.contexts)!=null&&c.length?v.contexts.slice(0,n):[]}const r=[...s.contexts].sort(()=>Math.random()-.5);return r.slice(0,Math.min(n,r.length))},Za={小学:{数学:{safe:["加减乘除","分数","小数","图形","面积","周长"],warn:["方程","负数","代数","几何证明"]},语文:{safe:["识字","写字","阅读","作文","古诗"],warn:["文言文","议论文","修辞手法"]}},初中:{数学:{safe:["一次函数","二次函数","勾股定理","相似三角形"],warn:["导数","微积分","对数函数","复数"]},物理:{safe:["力学","电学","光学","热学"],warn:["量子力学","相对论","核物理"]}}};class Zt{static check(t,n,s,r,o,a){if(!t||typeof t!="string"||!t.trim())return[];const c=[];return c.push(...this.checkVocabulary(t,s,r,o)),c.push(...this.checkFullwidthChars(t)),c.push(...this.checkAnswerCompleteness(t)),n&&n.length>0&&c.push(...this.checkQuestionCount(t,n)),c.push(...this.checkHTMLTags(t)),a&&c.push(...this.checkGenTypeSpecific(t,a,n)),c}static checkVocabulary(t,n,s,r){var c;const o=[],a=(c=Za[s])==null?void 0:c[n];if(!(a!=null&&a.warn))return o;for(const v of a.warn)t.includes(v)&&o.push({severity:"warning",type:"超纲词汇",detail:`发现可能超纲词汇："${v}"，请确认是否适用于${s}${r}${n}`,autoFix:!1});return o}static checkFullwidthChars(t){const n=[],s=t.match(/[０-９]/g);return s&&n.push({severity:"error",type:"格式错误",detail:`发现${s.length}个全角数字，应使用半角数字`,autoFix:!0,fixFn:r=>{const o={"０":"0","１":"1","２":"2","３":"3","４":"4","５":"5","６":"6","７":"7","８":"8","９":"9"};return r.replace(/[０-９]/g,a=>o[a]||a)}}),/答案[：:]\s*略/.test(t)&&n.push({severity:"warning",type:"答案不完整",detail:'答案标注为"略"，应提供完整答案',autoFix:!1}),n}static checkAnswerCompleteness(t){return!t.includes("answer-section")&&!t.includes("答案")?[{severity:"warning",type:"缺少答案",detail:"未检测到答案区域，建议补充答案和解析",autoFix:!1}]:[]}static checkQuestionCount(t,n){const s=[],r=t.match(/class="[^"]*question[^"]*"/gi),o=r?r.length:0,a=n.length;return o===0?s.push({severity:"warning",type:"题目标记缺失",detail:'未检测到 class="question" 标记（DeepSeek输出可能使用其他class名），已跳过题目数量校验',autoFix:!1}):Math.abs(o-a)>2&&s.push({severity:"warning",type:"题目数量不一致",detail:`蓝图规划${a}题，实际检测到${o}题`,autoFix:!1}),s}static checkHTMLTags(t){const n=[],s=["div","p","table","ul","ol","h1","h2","h3"];for(const r of s){const o=(t.match(new RegExp(`<${r}[\\s>]`,"g"))||[]).length,a=(t.match(new RegExp(`</${r}>`,"g"))||[]).length;o!==a&&n.push({severity:"warning",type:"HTML标签不平衡",detail:`<${r}> 标签打开${o}次，关闭${a}次（不影响渲染可忽略）`,autoFix:!1})}return n}static checkGenTypeSpecific(t,n,s){const r=[];if(n==="exam"){const o=t.match(/\(\d+分\)|（\d+分）/g);(!o||o.length===0)&&r.push({severity:"warning",type:"缺少分值",detail:"试卷未检测到分值标注，建议每道题标注分数",autoFix:!1})}if(n==="practice"){const o=/基础|巩固/.test(t),a=/提升|拓展|探究/.test(t);!o&&!a&&r.push({severity:"warning",type:"缺少分层",detail:"课时练建议包含基础巩固和能力提升两个层次",autoFix:!1})}if(n==="special"){const o=t.match(/class="[^"]*question[^"]*"/gi),a=o?o.length:0;a>0&&s&&s.length>0&&a<s.length&&r.push({severity:"warning",type:"题目数量偏差",detail:`专项训练蓝图规划${s.length}题，实际检测到${a}题`,autoFix:!1})}return r}static autoFix(t,n){let s=t;for(const r of n)r.autoFix&&r.fixFn&&(s=r.fixFn(s));return s}static getIssueSummary(t){const n=t.filter(r=>r.severity==="error").length,s=t.filter(r=>r.severity==="warning").length;return{total:t.length,errors:n,warnings:s,hasErrors:n>0,hasWarnings:s>0}}}const Ya=[{name:"三角形两边之和大于第三边",check:e=>{const t=/(\d+\.?\d*)\s*(cm|米|分米|m)/g,n=[];let s;for(;(s=t.exec(e))!==null;)n.push(parseFloat(s[1]));if(n.length===3){const[r,o,a]=n.sort((c,v)=>c-v);return r+o>a}return!0},errorMsg:'三角形边长不满足"两边之和大于第三边"',severity:"error"},{name:"概率值范围检查",check:e=>{const t=/概率[为是]?\s*(\d+\.?\d*)/g;let n;for(;(n=t.exec(e))!==null;){const r=parseFloat(n[1]);if(r<0||r>1)return!1}const s=/概率[为是]?\s*(\d+\.?\d*)\s*%/g;for(;(n=s.exec(e))!==null;){const r=parseFloat(n[1]);if(r<0||r>100)return!1}return!0},errorMsg:"概率值超出有效范围（0-1或0%-100%）",severity:"error"},{name:"勾股数合理性检查",check:e=>{const t=/(\d+)\s*[,，]\s*(\d+)\s*[,，]\s*(\d+)/g;let n;for(;(n=t.exec(e))!==null;){const[s,r,o]=[n[1],n[2],n[3]].map(Number).sort((a,c)=>a-c);if(Math.abs(s*s+r*r-o*o)>.01*o*o)return!1}return!0},errorMsg:"勾股数不符合勾股定理",severity:"error"},{name:"百分比之和检查",check:e=>{const t=/(\d+\.?\d*)\s*%/g,n=[];let s;for(;(s=t.exec(e))!==null;)n.push(parseFloat(s[1]));if(n.length>=3){const r=n.reduce((o,a)=>o+a,0);if(r<90||r>110)return!1}return!0},errorMsg:"各部分百分比之和偏离100%过多",severity:"warning"},{name:"年龄合理性检查",check:e=>{const t=/(小明|小红|小华|小刚|小丽|小强|同学|学生).*?(\d+)\s*岁/g;let n;for(;(n=t.exec(e))!==null;){const s=parseInt(n[2]);if(s<5||s>18)return!1}return!0},errorMsg:"题目中人物年龄不符合学生年龄段（5-18岁）",severity:"warning"},{name:"除法除数非零检查",check:e=>!/除以\s*0|÷\s*0/g.test(e),errorMsg:"除法运算中除数为零",severity:"error"},{name:"速度单位合理性检查",check:e=>{const t=/(\d+\.?\d*)\s*(米\/秒|千米\/[小]?时|km\/h|m\/s)/g;let n;for(;(n=t.exec(e))!==null;){const s=parseFloat(n[1]),r=n[2];if((r.includes("米/秒")||r.includes("m/s"))&&s>100)return!1}return!0},errorMsg:"速度值超出合理范围",severity:"warning"},{name:"圆的周长/直径比例检查",check:e=>{const t=/周长[为是]?\s*(\d+\.?\d*).*?直径[为是]?\s*(\d+\.?\d*)/,n=e.match(t);if(n){const s=parseFloat(n[1]),r=parseFloat(n[2]);if(r>0){const o=s/r;if(o<2.5||o>3.7)return!1}}return!0},errorMsg:"圆的周长与直径比例严重偏离π",severity:"error"},{name:"时间计算合理性检查",check:e=>{const t=/(\d+)\s*小时\s*(\d+)\s*分钟/g;let n;for(;(n=t.exec(e))!==null;)if(parseInt(n[2])>=60)return!1;return!0},errorMsg:"时间表示不规范（分钟数≥60）",severity:"warning"},{name:"几何图形内角和检查",check:e=>{const t=/三角形.*?内角.*?(\d+)°.*?(\d+)°.*?(\d+)°/,n=e.match(t);if(n){const o=[1,2,3].reduce((a,c)=>a+parseInt(n[c]),0);if(Math.abs(o-180)>5)return!1}const s=/四边形.*?内角.*?(\d+)°.*?(\d+)°.*?(\d+)°.*?(\d+)°/,r=e.match(s);if(r){const o=[1,2,3,4].reduce((a,c)=>a+parseInt(r[c]),0);if(Math.abs(o-360)>5)return!1}return!0},errorMsg:"几何图形内角和不符合定理",severity:"error"},{name:"负数开偶次方检查",check:e=>!/√\s*\(\s*-\d|√\s*-\d|开方\s*-\d|算术平方根.*?负/g.test(e),errorMsg:"初中阶段出现负数开平方（除非明确说明无解）",severity:"error"},{name:"不等式方向检查",check:e=>{const t=/两边[同都]?[乘除]以\s*-\d+/g,n=/不等号方向/;return t.test(e)&&!n.test(e)?null:!0},errorMsg:"不等式乘除负数后未提醒改变不等号方向",severity:"warning"}],ei=[{name:"速度单位合理性检查",check:e=>{const t=/(\d+\.?\d*)\s*(m\/s|米\/秒|km\/h|千米\/[小]?时)/g;let n;for(;(n=t.exec(e))!==null;){const s=parseFloat(n[1]),r=n[2];if(r.includes("m/s")||r.includes("米/秒")){if(s>340)return!1}else if((r.includes("km/h")||r.includes("千米"))&&s>1224)return!1}return!0},errorMsg:"速度值超出合理范围（超过声速）",severity:"warning"},{name:"密度范围检查",check:e=>{const t=/(\d+\.?\d*)\s*(g\/cm³|kg\/m³|克\/立方厘米)/g;let n;for(;(n=t.exec(e))!==null;){const s=parseFloat(n[1]),r=n[2];if(r.includes("g/cm³")||r.includes("克/立方厘米")){if(s<.001||s>22.6)return!1}else if(r.includes("kg/m³")&&(s<1||s>22600))return!1}return!0},errorMsg:"密度值超出已知物质范围",severity:"warning"},{name:"重力加速度范围检查",check:e=>{const t=/g\s*[=＝取为]?\s*(\d+\.?\d*)\s*(N\/kg|牛\/千克|m\/s²)/g;let n;for(;(n=t.exec(e))!==null;){const s=parseFloat(n[1]);if(s<9||s>10.6)return!1}return!0},errorMsg:"重力加速度g值超出合理范围（9.8±0.8 N/kg）",severity:"warning"},{name:"光速值检查",check:e=>{const t=/光速.*?(\d+\.?\d*)\s*[×xX\*]\s*10\^?(\d+)\s*(m\/s|米\/秒)/g;let n;for(;(n=t.exec(e))!==null;){const s=parseFloat(n[1]);if(parseInt(n[2])===8&&(s<2.5||s>3.5))return!1}return!0},errorMsg:"光速值不准确（真空中约为3.0×10⁸ m/s）",severity:"warning"},{name:"欧姆定律单位检查",check:e=>{const t=/(\d+\.?\d*)\s*(V|伏).*?(\d+\.?\d*)\s*(A|安).*?(\d+\.?\d*)\s*(Ω|欧姆|欧)/,n=e.match(t);if(n){const s=parseFloat(n[1]),r=parseFloat(n[3]),o=parseFloat(n[5]),a=r*o;if(a>0&&Math.abs(s-a)/a>.05)return!1}return!0},errorMsg:"欧姆定律计算不符合 U=IR 关系",severity:"error"},{name:"比热容常见值检查",check:e=>{const t=/水.*?比热容.*?(\d+\.?\d*)\s*[×xX\*]\s*10\^?(\d+)/,n=e.match(t);if(n){const s=parseFloat(n[1]);if(parseInt(n[2])===3&&(s<4||s>4.4))return!1}return!0},errorMsg:"水的比热容值不准确（4.2×10³ J/(kg·℃)）",severity:"warning"}],ti=[{name:"化学方程式原子守恒检查",check:e=>/(\d*[A-Z][a-z]?\d*\s*\+\s*)+(\d*[A-Z][a-z]?\d*)\s*[=→]\s*(\d*[A-Z][a-z]?\d*\s*\+\s*)+(\d*[A-Z][a-z]?\d*)/.test(e)&&!e.includes("配平")?null:!0,errorMsg:"化学方程式可能需要配平检查",severity:"warning"},{name:"化合价合理性检查",check:e=>!/Na\s*[²2]\s*\+|Cl\s*[²2]\s*\+|O\s*[²2]\s*\-/g.test(e),errorMsg:"存在不符合常见化合价的离子",severity:"error"},{name:"常见相对原子质量检查",check:e=>{const t={H:1,C:12,N:14,O:16,Na:23,Mg:24,Al:27,S:32,Cl:35.5,Ca:40,Fe:56,Cu:64},n=/([A-Z][a-z]?).*?相对原子质量[为是]?\s*(\d+\.?\d*)/g;let s;for(;(s=n.exec(e))!==null;){const r=s[1],o=parseFloat(s[2]);if(t[r]&&Math.abs(o-t[r])>.5)return!1}return!0},errorMsg:"常见元素的相对原子质量不准确",severity:"error"},{name:"pH值范围检查",check:e=>{const t=/pH\s*[=＝为]?\s*(\d+\.?\d*)/g;let n;for(;(n=t.exec(e))!==null;){const s=parseFloat(n[1]);if(s<0||s>14)return!1}return!0},errorMsg:"pH值超出标准范围（0-14）",severity:"error"},{name:"金属活动性顺序检查",check:e=>!/(Cu|铜).*?置换.*?(Zn|锌).*?的/g.test(e),errorMsg:"金属活动性顺序错误（活动性弱的金属不能置换活动性强的金属）",severity:"error"}],eo=[{name:"全角数字检查",check:e=>!/[０-９]/.test(e),errorMsg:"存在全角数字，应使用半角数字",severity:"error",autoFix:e=>{const t={"０":"0","１":"1","２":"2","３":"3","４":"4","５":"5","６":"6","７":"7","８":"8","９":"9"};return e.replace(/[０-９]/g,n=>t[n]||n)}},{name:'答案标注为"略"检查',check:e=>!/答案[：:]\s*略/.test(e),errorMsg:'答案标注为"略"，应提供完整答案',severity:"warning"},{name:"括号匹配检查",check:e=>{const t=(e.match(/\(/g)||[]).length,n=(e.match(/\)/g)||[]).length;return t===n},errorMsg:"括号不匹配",severity:"error",autoFix:null},{name:"中英文标点混用检查",check:e=>!/[。！？]\s*[,\.;:]/g.test(e),errorMsg:"中英文标点混用",severity:"warning",autoFix:e=>e.replace(/。\s*,/g,"，").replace(/。\s*\./g,"。").replace(/！\s*,/g,"！").replace(/？\s*,/g,"？")},{name:"多余空格检查",check:e=>!/[\u4e00-\u9fa5]\s{2,}[\u4e00-\u9fa5]/g.test(e),errorMsg:"中文文本中存在多余空格",severity:"warning",autoFix:e=>e.replace(/([\u4e00-\u9fa5])\s{2,}([\u4e00-\u9fa5])/g,"$1 $2")},{name:"选择题选项质量检查",check:e=>/以上\s*都\s*(是|对|正确|不对|不是)/.test(e)?null:!0,errorMsg:'选择题使用了"以上都是/以上都不对"选项，建议替换为具体选项',severity:"warning"},{name:"题干完整性检查",check:e=>{const t=e.replace(/<[^>]+>/g,"").trim();if(/(因为|所以|但是|虽然|然而|而且|因此|于是|并且|或者|不仅|而且)\s*$/.test(t))return!1;const s=t.match(/^\d+[\.、．]\s*(.+)/);return s&&s[1].length<10?null:!0},errorMsg:"题干可能表述不完整（以连词结尾）",severity:"warning"},{name:"选择题选项数量检查",check:e=>{const t=e.match(/[A-D][\.、．]\s*/g);if(t){const n=t.length;if(n>0&&n!==4)return null}return!0},errorMsg:"选择题选项数量异常（非标准4选项）",severity:"warning"},{name:"填空题空格位置检查",check:e=>!/^[\s\d\.、．]*<u>&nbsp;+<\/u>/.test(e),errorMsg:"填空题空格不应出现在句首",severity:"warning"}],ni=[{name:"错别字检查（常见别字）",check:e=>null,errorMsg:"可能存在别字，建议人工核对",severity:"warning"},{name:"标点符号规范检查",check:e=>{const t=/[。！？，、；：]/.test(e),n=/[,]/.test(e),s=/[\.](?!\d)/.test(e);return t&&(n||s)?null:!0},errorMsg:"中英文标点可能混用，建议核对",severity:"warning"},{name:"阅读理解题答案不可直接原文摘抄",check:e=>{if(/阅读|短文|选段|语段/.test(e)){const t=e.match(/答案[：:]\s*(.+?)(?:[。；\n]|$)/);if(t){const n=t[1].trim(),s=e.replace(/答案[：:].*$/,"");if(n.length>10&&s.includes(n))return!1}}return!0},errorMsg:"阅读理解题的答案可能与原文重复（应体现理解而非照抄）",severity:"warning"},{name:"作文题字数要求检查",check:e=>!(/作文|写作|写一[篇段]|习作/.test(e)&&!/\d{2,4}\s*字/.test(e)),errorMsg:"作文题缺少字数要求",severity:"warning"},{name:"古诗词默写范围检查",check:e=>{const t=["琵琶行","长恨歌","蜀道难","离骚","逍遥游"];for(const n of t)if(e.includes(n))return null;return!0},errorMsg:"古诗词可能超出对应学段课标范围",severity:"warning"},{name:"题干表述完整性检查",check:e=>!/(因为|所以|但是|虽然|然而|而且|因此|于是)\s*$/m.test(e),errorMsg:"题干可能表述不完整（以连词结尾）",severity:"warning"},{name:"拼音标注格式检查",check:e=>/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/.test(e)?!0:/[a-z]{2,6}[1-5]/g.test(e)?null:!0,errorMsg:"拼音标注格式建议核实",severity:"warning"}],si=[{name:"选项语法一致性检查",check:e=>{const t=/[A-D][\.、．]\s*(.+?)(?=[A-D][\.、．]|答案|$)/g,n=[];let s;for(;(s=t.exec(e))!==null;)n.push(s[1].trim());if(n.length>=3){const r=n.filter(o=>/^[A-Z]/.test(o)&&/[.!?]$/.test(o)).length;if(r>0&&r<n.length)return!1}return!0},errorMsg:"选择题选项语法结构不一致",severity:"warning"},{name:"词汇难度检查",check:e=>{const t=["sophisticated","phenomenon","contemporary","nevertheless","consequently"];for(const n of t)if(e.toLowerCase().includes(n))return null;return!0},errorMsg:"可能包含超学段词汇",severity:"warning"},{name:"题干完整性检查",check:e=>{const t=e.match(/<p[^>]*question[^>]*>(.+?)<\/p>/g)||[];for(const n of t){let s=n.replace(/<[^>]+>/g,"").trim();if(s=s.replace(/[\u2000-\u200F\u2028-\u202F\u205F\u3000]+/g,"").trim(),s=s.replace(/_{3,}/g,"").trim(),s.length>20&&!/[.?!]$/.test(s)&&!/^(Read|Choose|Fill|Write|Listen|Match|Complete|Answer|Look|Circle|Draw|Find|Tick|Cross|Underline|Put|Make|Check|Select|Rearrange|Correct|Translate|Describe|Explain|Compare|Discuss|Identify|Label|Name|Order|Sort|Spell|Number|Rewrite|Add|Replace|Change)\b/i.test(s))return!1}return!0},errorMsg:"英语题干缺少句末标点",severity:"warning"},{name:"完形填空选项数量检查",check:e=>{if(/完形填空|cloze/i.test(e)){const t=(e.match(/_{2,}/g)||[]).length,n=(e.match(/[A-D][\.、．]/g)||[]).length;if(t>0&&n/t!==4)return!1}return!0},errorMsg:"完形填空每空应有4个选项",severity:"warning"}],ri=[{name:"生物分类名称格式检查",check:e=>{const t=/[A-Z][a-z]+\s[a-z]+/g;return(e.match(t)||[]).length>0&&!/<em>|<i>/.test(e)?null:!0},errorMsg:"生物学名建议用斜体表示",severity:"warning"},{name:"遗传概率范围检查",check:e=>{const t=/概率[为是]?\s*(\d+\.?\d*)\s*[%％]/g;let n;for(;(n=t.exec(e))!==null;){const s=parseFloat(n[1]);if(s<0||s>100)return!1}return!0},errorMsg:"遗传概率超出有效范围（0-100%）",severity:"error"},{name:"生态系统能量流动效率检查",check:e=>{const t=/能量(?:传递|流动)效率[为是约]?\s*(\d+\.?\d*)\s*%/,n=e.match(t);if(n){const s=parseFloat(n[1]);if(s<5||s>25)return!1}return!0},errorMsg:"能量传递效率通常为10%-20%",severity:"warning"},{name:"DNA碱基配对检查",check:e=>{const t=/[ATCG]\s*[=＝]\s*[ATCG]/g,n=["A=T","T=A","C≡G","G≡C","A＝T","T＝A"];let s;for(;(s=t.exec(e))!==null;){const r=s[0].replace(/\s/g,"");if(!n.some(o=>r.includes(o.replace(/[=＝≡]/g,""))))return!1}return!0},errorMsg:"DNA碱基配对不符合A-T、C-G规则",severity:"error"}],oi=[{name:"年代范围检查",check:e=>{const t=/(?:公元前?|前)?\s*(\d{3,4})\s*年/g;let n;for(;(n=t.exec(e))!==null;)if(parseInt(n[1])>2100)return!1;return!0},errorMsg:"历史年代超出合理范围",severity:"error"},{name:"朝代顺序检查",check:e=>{const n=["秦","汉","三国","晋","南北朝","隋","唐","五代十国","宋","元","明","清"].filter(s=>e.includes(s));for(let s=0;s<n.length-1;s++){const r=e.indexOf(n[s]),o=e.indexOf(n[s+1]);if(r>o)return null}return!0},errorMsg:"朝代提及顺序可能有问题",severity:"warning"},{name:"历史人物年代一致性检查",check:e=>{const t=[{person:"秦始皇",notWith:["纸","印刷术","火药"]},{person:"岳飞",notWith:["元朝","蒙古","成吉思汗"]},{person:"林则徐",notWith:["民国","辛亥革命"]}];for(const n of t)if(e.includes(n.person)){for(const s of n.notWith)if(e.includes(s))return null}return!0},errorMsg:"历史人物与事件年代可能不匹配",severity:"warning"},{name:"历史分期术语检查",check:e=>/近代/.test(e)&&/先秦|秦汉|隋唐|宋元|明清/.test(e)?null:!0,errorMsg:'"近代"术语使用需核实（中国近代史一般指1840年后）',severity:"warning"}],ai=[{name:"经纬度范围检查",check:e=>{const t=/(?:纬度|经度)[为是]?\s*(\d+\.?\d*)\s*[°度]/g;let n;for(;(n=t.exec(e))!==null;){const s=parseFloat(n[1]);if(e.includes("纬")&&(s<0||s>90)||e.includes("经")&&(s<0||s>180))return!1}return!0},errorMsg:"经纬度数值超出合理范围",severity:"error"},{name:"比例尺合理性检查",check:e=>{const t=/1\s*[:：]\s*(\d+)/,n=e.match(t);if(n){const s=parseInt(n[1]);if(s<100||s>1e8)return!1}return!0},errorMsg:"地图比例尺超出合理范围",severity:"warning"},{name:"时区计算检查",check:e=>{const t=/时差[为是]?\s*(\d+)\s*(?:小时|个?小时)/,n=e.match(t);return!(n&&parseInt(n[1])>12)},errorMsg:"时区差不应超过12小时",severity:"error"},{name:"海拔高度合理性检查",check:e=>{const t=/海拔\s*(\d+)\s*米/g;let n;for(;(n=t.exec(e))!==null;){const s=parseInt(n[1]);if(s>9e3||s<-500)return!1}return!0},errorMsg:"海拔高度超出地球实际范围",severity:"warning"}],Cr=[{name:"法律条文引用格式检查",check:e=>!(/中华人民共和国/.test(e)&&!/《中华人民共和国/.test(e)),errorMsg:"法律名称应用书名号《》包裹",severity:"warning"},{name:"时政术语规范性检查",check:e=>{const t=["习大大","彭妈妈"];for(const n of t)if(e.includes(n))return!1;return!0},errorMsg:"时政人物称谓应使用规范表述",severity:"error"},{name:"价值观导向检查",check:e=>{const t=[/读书无用/,/金钱至上/,/人不为己/];for(const n of t)if(n.test(e))return null;return!0},errorMsg:"可能存在不当价值观表述，请核实",severity:"warning"},{name:"宪法条款引用检查",check:e=>{const t=/宪法.*?第\s*(\d+)\s*条/,n=e.match(t);if(n){const s=parseInt(n[1]);if(s<1||s>143)return!1}return!0},errorMsg:"宪法条款编号超出范围（共143条）",severity:"error"}],ii=[{name:"温度范围检查（摄氏度）",check:e=>{const t=/(\d+\.?\d*)\s*[°摄]?[氏C度c]/g;let n;for(;(n=t.exec(e))!==null;)if(parseFloat(n[1])<-273)return!1;return!0},errorMsg:"温度低于绝对零度（-273°C）",severity:"error"},{name:"常见动植物名称检查",check:e=>{const t={蜻蛙:"青蛙",密蜂:"蜜蜂",大像:"大象"};for(const[n,s]of Object.entries(t))if(e.includes(n))return!1;return!0},errorMsg:"可能存在动植物名称错别字",severity:"error"},{name:"单位使用规范检查",check:e=>/重量[为是]/.test(e)&&!/[克千克公斤吨gkg]/.test(e)?null:!0,errorMsg:"物理量后缺少单位",severity:"warning"}],ci=[{name:"编程语法关键字拼写检查",check:e=>{const t=["pritn","inpu","fuction","whlie","retrun"];for(const n of t)if(e.includes(n))return!1;return!0},errorMsg:"编程关键字可能存在拼写错误",severity:"error"},{name:"文件大小单位检查",check:e=>{const t=/(\d+\.?\d*)\s*(GB|MB|KB|TB|B)/g;let n;for(;(n=t.exec(e))!==null;){const s=parseFloat(n[1]),r=n[2];if(r==="TB"&&s>100||r==="GB"&&s>1e4)return!1}return!0},errorMsg:"文件大小数值超出常规范围",severity:"warning"},{name:"IP地址格式检查",check:e=>{const t=/(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})/g;let n;for(;(n=t.exec(e))!==null;)for(let s=1;s<=4;s++){const r=parseInt(n[s]);if(r<0||r>255)return!1}return!0},errorMsg:"IP地址每段应在0-255之间",severity:"error"}],li=e=>{const t={数学:Ya,物理:ei,化学:ti,语文:ni,英语:si,生物:ri,历史:oi,地理:ai,道德与法治:Cr,思想政治:Cr,科学:ii,信息技术:ci};return[...eo,...t[e]||[]]},Sr=(e,t)=>{if(!e||typeof e!="string"||!e.trim())return[];const n=li(t),s=[];for(const r of n)try{const o=r.check(e);o===!1?s.push({name:r.name,passed:!1,message:r.errorMsg,severity:r.severity,autoFix:r.autoFix||null}):o===null&&s.push({name:r.name,passed:null,message:r.errorMsg,severity:"warning"})}catch(o){console.warn(`验证规则"${r.name}"执行出错:`,o.message)}return s},xr=(e,t)=>{let n=e;for(const s of t)s.autoFix&&typeof s.autoFix=="function"&&(n=s.autoFix(n));for(const s of eo)s.autoFix&&!s.check(e)&&(n=s.autoFix(n));return n},pn=e=>{if(!e)return"AI";const t={"qwen2.5:14b":"Qwen2.5-14B","qwen2.5:7b":"Qwen2.5-7B","qwen2:7b":"Qwen2-7B","qwen3-vl:8b":"Qwen3-VL-8B","llava:13b":"LLaVA-13B","llava:7b":"LLaVA-7B","deepseek-v4-pro":"DeepSeek-V4-Pro"};for(const[s,r]of Object.entries(t))if(e.includes(s))return r;const n=e.match(/([a-zA-Z0-9]+[.:][0-9]+b)/i);return n?n[1]:e.split(":")[0]||"AI"},ft=async(e,t=null,n="",s="analysis")=>{if(!e||typeof e!="string")throw new Error(`[${n}] AI返回为空或非字符串`);let r=e;r=r.replace(/```json\s*/gi,"").replace(/```\s*/g,"");const o=r.match(/\{[\s\S]*\}|\[[\s\S]*\]/);if(o)r=o[0];else{if(console.error(`[${n}] 未找到JSON结构`),t){const c=await t("请严格按照JSON格式回复，只返回JSON",{taskType:s});return ft(c,null,n+"_retry1",s)}throw new Error(`[${n}] AI返回中未找到JSON结构`)}try{return JSON.parse(r)}catch{console.warn(`[${n}] 首次解析失败，尝试修复`)}let a=r;a=a.replace(/,\s*}/g,"}"),a=a.replace(/,\s*\]/g,"]"),a=a.replace(/([{,]\s*)([a-zA-Z_\u4e00-\u9fa5][a-zA-Z0-9_\u4e00-\u9fa5]*)(\s*:)/g,'$1"$2"$3'),a=a.replace(/'/g,'"'),a=a.replace(/[\x00-\x1F\x7F]/g,""),a=a.replace(/\u201c/g,'"').replace(/\u201d/g,'"');try{return JSON.parse(a)}catch{console.warn(`[${n}] 修复后仍失败，尝试补全截断的JSON`)}if(a.trim().startsWith("["))try{const c=a.lastIndexOf("},");if(c>0){const S=a.substring(0,c+1)+"]",d=JSON.parse(S);return console.warn(`[${n}] 截断修复成功：移除末尾不完整对象，保留${d.length}个元素`),d}const v=a.match(/\[\s*(\{[\s\S]*)$/);if(v){let S=v[1];(S.match(/"/g)||[]).length%2!==0&&(S+='"');const R=(S.match(/\{/g)||[]).length,F=(S.match(/\}/g)||[]).length;for(let ke=F;ke<R;ke++)S+="}";S+="]";try{const ke=JSON.parse(S);return console.warn(`[${n}] 补全修复成功`),ke}catch{console.warn(`[${n}] 补全后仍无法解析`)}}}catch(c){console.warn(`[${n}] 截断修复失败:`,c.message)}if(a.trim().startsWith("{")&&!a.trim().endsWith("}")){let c=a;const v=(c.match(/\{/g)||[]).length,S=(c.match(/\}/g)||[]).length;for(let d=S;d<v;d++)c+="}";try{const d=JSON.parse(c);return console.warn(`[${n}] 对象补全修复成功`),d}catch{console.warn(`[${n}] 对象补全后仍无法解析`)}}if(t)try{const c=await t(`你返回的以下内容不是合法JSON，请修复并重新返回：
${r.substring(0,500)}
错误：JSON格式解析失败，请检查并修复`);return ft(c,null,n+"_retry2")}catch{console.error(`[${n}] 重试失败`)}throw new Error(`[${n}] JSON解析完全失败，请重试`)},kr=e=>{if(!e)return 0;const t=(e.match(/[\u4e00-\u9fa5]/g)||[]).length,n=e.replace(/[\u4e00-\u9fa5]/g,"").length;return Math.ceil(t/1.5+n/4)},fs=(e,t=500)=>{if(!e||e.trim().length===0)return[];const n=[],s=e.split(/\n\s*\n/).filter(r=>r.trim());for(const r of s)if(r.length<=t)n.push(r.trim());else{const o=r.split(new RegExp("(?<=[。！？；\\n])"));let a="";for(const c of o)a.length+c.length>t&&a.length>0?(n.push(a.trim()),a=c):a+=c;a.trim()&&n.push(a.trim())}return n.filter(r=>r.trim().length>0)},rs=(e,t)=>{if(!e||e.length===0)return{coreText:"",extendedText:"",fullContext:""};const n=e.filter(R=>R.isKeyConcept||R.type==="例题"||R.type==="练习"),s=e.filter(R=>!n.includes(R));let r="",o=0;const a=Math.floor(t*.7);for(const R of n){const F=R.text,ke=kr(`[${R.chapterTitle}·${R.type}]
${F}
`);if(o+ke<=a)r+=`[${R.chapterTitle}·${R.type}]
${F}

`,o+=ke;else{const b=a-o;if(b>100){const Q=Math.floor(b*1.2),j=F.substring(0,Q)+"...[核心段过长已截断]";r+=`[${R.chapterTitle}·${R.type}]
${j}

`}break}}let c="",v=0;const S=t-o;for(const R of s){const F=R.text,ke=kr(`[${R.chapterTitle}·${R.type}·参考]
${F}
`);if(v+ke<=S)c+=`[${R.chapterTitle}·${R.type}·参考]
${F}

`,v+=ke;else if(S-v>100){const b=S-v,Q=Math.floor(b*1.2);c+=`[${R.chapterTitle}·${R.type}·参考]
${F.substring(0,Q)}...[略]

`;break}}let d="";return r&&(d+=`【🔴 核心教材原文——必须完整阅读并基于此命题】
${r}`),c&&(d+=`【🟡 补充参考——可辅助理解，但不强制使用】
${c}`),d&&(d+=`⚠️ 请确保题目内容紧扣以上核心原文，知识点的考查必须基于教材中的定义和表述。
`),{coreText:r,extendedText:c,fullContext:d}},os=(e,t,n)=>{if(!e||typeof e!="string")return e;let s=e;const r={"０":"0","１":"1","２":"2","３":"3","４":"4","５":"5","６":"6","７":"7","８":"8","９":"9",Ａ:"A",Ｂ:"B",Ｃ:"C",Ｄ:"D",Ｅ:"E",ａ:"a",ｂ:"b",ｃ:"c",ｄ:"d",ｅ:"e"};for(const[o,a]of Object.entries(r))s=s.replace(new RegExp(o,"g"),a);return t==="语文"?(s=s.replace(/\.{3,}/g,"……").replace(/。{3,}/g,"……").replace(/--+/g,"——").replace(/([\u4e00-\u9fa5])\s*;\s*/g,"$1；").replace(/([\u4e00-\u9fa5])\s*:\s*/g,"$1：").replace(/([\u4e00-\u9fa5])\s*\?\s*/g,"$1？").replace(/([\u4e00-\u9fa5])\s*!\s*/g,"$1！").replace(/\n\s*\d{1,3}\s*$/gm,"").replace(/^\d{1,3}\s*\n/gm,`
`),s):(t==="数学"&&(s=s.replace(/([a-zA-Z\u4e00-\u9fa5])2(?!\d)/g,"$1²").replace(/([a-zA-Z\u4e00-\u9fa5])3(?!\d)/g,"$1³").replace(/V(\d+)/g,"√$1").replace(/v(\d+)/g,"√$1").replace(/(\d+)\/(\d+)/g,"$1/$2").replace(/(\d+)度/g,"$1°").replace(/(\d+)C/g,"$1°C").replace(/[丌兀]|TT/g,"π").replace(/[十†]/g,"+").replace(/[一—]/g,"−").replace(/[xXｘ]/g,"×").replace(/[‡≠]/g,"≠").replace(/>=/g,"≥").replace(/<=/g,"≤").replace(/≈/g,"≈").replace(/--/g,"≈").replace(/A/g,"△").replace(/\|\|/g,"∥").replace(/II/g,"∥").replace(/([a-zA-Z\u4e00-\u9fa5])2(?=[\s,，。；;+\-*/=]|$)/g,"$1²").replace(/([a-zA-Z\u4e00-\u9fa5])3(?=[\s,，。；;+\-*/=]|$)/g,"$1³").replace(/([a-zA-Z\u4e00-\u9fa5])\^(\d)/g,"$1$2").replace(/1\/2/g,"½").replace(/1\/4/g,"¼").replace(/3\/4/g,"¾").replace(/士/g,"±").replace(/干/g,"±").replace(/丰/g,"±").replace(/工/g,"±").replace(/(\d+)0([℃°])/g,"$1$2").replace(/[Aaαａ]/g,"α").replace(/[Bbβｂ]/g,"β").replace(/[Yyγｙ]/g,"γ").replace(/[0OoθΘｏ]/g,"θ").replace(/([+\-*/=])\s*\n\s*(\d)/g,"$1$2")),t==="物理"&&(s=s.replace(/m\/s2/g,"m/s²").replace(/kg\/m3/g,"kg/m³").replace(/N\/kg/g,"N/kg").replace(/J\//g,"J/").replace(/W\//g,"W/").replace(/[aα]/g,"α").replace(/[bβ]/g,"β").replace(/[yγ]/g,"γ").replace(/[0θ]/g,"θ").replace(/[uμ]/g,"μ").replace(/[pρ]/g,"ρ").replace(/F合/g,"F合").replace(/G重/g,"G")),t==="化学"&&(s=s.replace(/H20/g,"H₂O").replace(/C02/g,"CO₂").replace(/S02/g,"SO₂").replace(/N02/g,"NO₂").replace(/NaCl/g,"NaCl").replace(/HCl/g,"HCl").replace(/H2S04/g,"H₂SO₄").replace(/NaOH/g,"NaOH").replace(/CaC03/g,"CaCO₃").replace(/NaHC03/g,"NaHCO₃").replace(/->/g,"→").replace(/<-/g,"←").replace(/<->/g,"↔").replace(/([A-Z][a-z]?\d*)\s*=\s*([A-Z][a-z]?\d*)/g,"$1→$2").replace(/([A-Z][a-z]?\d*)\s*=\s*([A-Z][a-z]?\d*)/g,"$1→$2").replace(/([A-Z][a-z]?)2\+/g,"$1²⁺").replace(/([A-Z][a-z]?)2-/g,"$1²⁻").replace(/([A-Z][a-z]?)3\+/g,"$1³⁺").replace(/加热/g,"△").replace(/高温/g,"高温").replace(/催化剂/g,"催化剂")),n==="小学"&&(s=s.replace(/\[IMG[^\]]*\]/g,"[图]").replace(/\[TABLE[^\]]*\]/g,"[表]").replace(/【[^】]*答案[^】]*】/g,"[答案区域]")),s=s.replace(/([A-D])\.(\S+?)([A-D])\./g,"$1.$2  $3."),s=s.replace(/([A-D])\.(\S+?)([A-D])\./g,"$1.$2  $3."),s=s.replace(/\.{3,}/g,"……"),s=s.replace(/。{3,}/g,"……"),s=s.replace(/--+/g,"——"),s=s.replace(/([\u4e00-\u9fa5])\s*;\s*/g,"$1；"),s=s.replace(/([\u4e00-\u9fa5])\s*:\s*/g,"$1："),s=s.replace(/([\u4e00-\u9fa5])\s*\?\s*/g,"$1？"),s=s.replace(/([\u4e00-\u9fa5])\s*!\s*/g,"$1！"),s)},ui=e=>{if(!e)return e;let t=e;return t=t.replace(/([A-D])\.(\D{2,80}?)([A-D])\./g,(n,s,r,o)=>`${s}.${r}
${o}.`),t=t.replace(/([A-D])\.([A-D])\./g,"$1. $2."),t=t.replace(/([ＡＢＣＤ])\.(\S{2,60}?)([ＡＢＣＤ])\./g,(n,s,r,o)=>{const a=String.fromCharCode(65+"ＡＢＣＤ".indexOf(s)),c=String.fromCharCode(65+"ＡＢＣＤ".indexOf(o));return`${a}.${r}
${c}.`}),t=t.replace(/([√×])\s*([√×])\s*([√×])/g,"$1  $2  $3"),t!==e&&console.log("🔧 模板选项粘连已修复"),t},pi=e=>{if(!e)return e;let t=e;return t=t.replace(/^(\s*[一二三四五六七八九十]+[、．]\s*[^\n]{5,30})$/gm,"[SECTION_TITLE]$1[/SECTION_TITLE]"),t=t.replace(/^(\s*\d{1,3}\.\s+)/gm,"[QUESTION_NUM]$1[/QUESTION_NUM]"),t=t.replace(/^([A-D]\.\s*)/gm,"[OPTION]$1[/OPTION]"),t=t.replace(/(（[^）]*?每小题\d+分[^）]*?）)/g,"[SCORE_INFO]$1[/SCORE_INFO]"),t=t.replace(/((?:参考)?答案[：:]\s*)/g,"[ANSWER_LABEL]$1[/ANSWER_LABEL]"),t=t.replace(/((?:【)?解析[：:]?[】]?\s*)/g,"[EXPLANATION_LABEL]$1[/EXPLANATION_LABEL]"),t=t.replace(/(阅读材料|根据材料|阅读下文)/g,"[MATERIAL]$1[/MATERIAL]"),t};class fi{constructor(){this.segments=[]}indexContentCards(t){this.segments=[];for(const n of t)if(n.segments)for(const s of n.segments)this.segments.push({text:s.text,chapterTitle:n.chapterTitle,type:s.type||"正文",isKeyConcept:s.isKeyConcept||!1,isExample:s.isExample||!1,isExercise:s.isExercise||!1,knowledgePoints:s.knowledgePoints||[],keywords:this._extractKeywords(s.text)});console.log(`📚 语义检索器已索引 ${this.segments.length} 个段落`)}_extractKeywords(t){if(!t)return[];const s=t.replace(/[，。、；：！？\s,\.;:!?\n]+/g," ").trim().replace(/\s+/g,""),r=new Set;for(let a=2;a<=6;a++)for(let c=0;c<=s.length-a;c++)r.add(s.substring(c,c+a));return t.split(/[，。、；：！？\s,\.;:!?\n]+/).filter(a=>a.length>=2&&a.length<=8).forEach(a=>r.add(a)),[...r].filter(a=>!/^[\d\.\-\+\*\/\=<>]+$/.test(a)).slice(0,50)}_keywordSimilarity(t,n){if(!t.length||!n.length)return 0;let s=0;for(const r of t){let o=0;for(const a of n)if(a===r){o=1;break}else if(a.includes(r)||r.includes(a)){const c=Math.min(r.length,a.length)/Math.max(r.length,a.length);o=Math.max(o,c*.7)}o>0&&(s+=o)}return s/Math.max(t.length,n.length)}findRelevant(t,n=3){if(!t||this.segments.length===0)return[];const s=this._extractKeywords(t);return this.segments.map(o=>{const a=this._keywordSimilarity(s,o.keywords);let c=0;o.text&&o.text.includes(t)&&(c+=.3),o.knowledgePoints.some(R=>R&&typeof R=="string"&&(R.includes(t)||t.includes(R)))&&(c+=.4);const v=o.isKeyConcept?.2:0,S=o.isExample||o.isExercise?.1:0,d=a*.5+c+v+S;return{...o,score:d}}).sort((o,a)=>a.score-o.score).slice(0,n).filter(o=>o.score>.1).map(o=>({chapterTitle:o.chapterTitle,text:o.text,type:o.isExample?"例题":o.isExercise?"练习":o.type,relevance:o.score>.5?"high":o.score>.3?"medium":"low"}))}}const js=new fi;class gi{constructor(t=3,n=3e4){this.threshold=t,this.cooldownMs=n,this.failureCount=0,this.lastFailTime=0,this.state="CLOSED"}get isOpen(){return this.state==="CLOSED"?!1:this.state==="OPEN"?Date.now()-this.lastFailTime>this.cooldownMs?(this.state="HALF_OPEN",console.log("🌡️ 熔断器进入半开状态，允许探测..."),!1):!0:!1}success(){this.failureCount=0,this.state="CLOSED"}fail(){this.failureCount++,this.lastFailTime=Date.now(),this.failureCount>=this.threshold&&(this.state="OPEN",console.warn(`🌡️ 熔断器断开！连续 ${this.failureCount} 次失败，冷却 ${this.cooldownMs/1e3} 秒`))}reset(){this.failureCount=0,this.state="CLOSED"}}const hn=new gi(3,3e4),di=async(e,t,n=6e4)=>{var R,F,ke,b,Q,j,Te,tt,Ke,We,nt;const s=e.body.getReader(),r=new TextDecoder;let o="",a="",c="",v=0,S=0,d=Date.now();try{for(;;){if(t!=null&&t.aborted)throw s.cancel(),new Error("aborted");let ne;try{const wt=await Promise.race([s.read(),new Promise((gt,ct)=>{ne=setInterval(()=>{Date.now()-d>n&&(clearInterval(ne),ct(new Error(`SSE 心跳超时：${n/1e3}秒无新数据，流可能已断开`)))},5e3)})]);clearInterval(ne);const{done:$e,value:Ge}=wt;if($e)break;d=Date.now(),c+=r.decode(Ge,{stream:!0});const _e=c.split(`
`);c=_e.pop()||"";for(const gt of _e){const ct=gt.trim();if(!ct||!ct.startsWith("data: "))continue;const Ze=ct.slice(6);if(Ze==="[DONE]"){a=a||"stop";continue}try{const Pe=JSON.parse(Ze),Ve=(ke=(F=(R=Pe.choices)==null?void 0:R[0])==null?void 0:F.delta)==null?void 0:ke.content,dt=(j=(Q=(b=Pe.choices)==null?void 0:b[0])==null?void 0:Q.delta)==null?void 0:j.reasoning_content;Ve&&(o+=Ve,v++),dt&&S++,(tt=(Te=Pe.choices)==null?void 0:Te[0])!=null&&tt.finish_reason&&(a=Pe.choices[0].finish_reason)}catch{Ze.length>10&&console.warn("⚠️ SSE chunk JSON 解析失败:",Ze.slice(0,80))}}}catch(wt){throw ne&&clearInterval(ne),wt}}if(c.trim().startsWith("data: ")&&c.trim()!=="data: [DONE]")try{const wt=(nt=(We=(Ke=JSON.parse(c.trim().slice(6)).choices)==null?void 0:Ke[0])==null?void 0:We.delta)==null?void 0:nt.content;wt&&(o+=wt)}catch{}}finally{s.releaseLock()}return console.log(`📡 SSE 流式接收完成: ${v} 内容chunks + ${S} 推理chunks, ${o.length} 字符, finish_reason=${a||"(无)"}`),{content:o,finishReason:a}},Pr=async(e,t)=>{if(e){const n=new Error(e.message||"网络请求失败");return n.code=e.name==="AbortError"?"ECONNABORTED":"ENOTFOUND",n.originalError=e,n}if(t){let n="";try{n=await t.text()}catch{}const s=new Error(`HTTP ${t.status}: ${n.slice(0,200)}`);return s.response={status:t.status,headers:Object.fromEntries(t.headers.entries()),data:{error:{message:n}}},s.code=t.status>=500?"ESERVER":"ECLIENT",s}return new Error("未知请求错误")},Ln=(e,t,n,s,r)=>{if(!e)return"";const o=e.split(/\n(?=【)/),a=[],c=["【模板精准对标】","【模板真题示例】","【模板量化特征】","【语言风格指纹","【格式排版指纹","【语言风格特征","【模板风格约束","【模板反例约束","【命题约束】","【教材章节确认】","【用户补充指令】","【综合指令】","【情境要求】"];for(const S of o){const d=S.trim();if(!d||c.some(F=>d.startsWith(F)))continue;let R=d;R.length>800&&(R=R.substring(0,700)+"...(已精简)"),a.push(R)}let v=a.join(`
`);return v.length>2500&&(v=v.substring(0,2500)+`
...(后续指令已精简)`),v?`【关键指令摘要】
${v}
`:""},hi=e=>{const t=new Map;for(const n of e)if(!(!n.segments||n.segments.length===0))for(const s of n.segments){const r=s.knowledgePoints||[];for(const o of r){if(!o||typeof o!="string")continue;t.has(o)||t.set(o,[]);const a=t.get(o);a.some(c=>c.text===s.text)||a.push({chapterTitle:n.chapterTitle,text:s.text,type:s.type||""})}}return t},as=(e,t,n=1500)=>{var ne,wt;if(!(e!=null&&e.length))return"";const s=hi(e),r=[...s.keys()],o=new Set,a=new Set;if(t!=null&&t.length)for(const $e of t)$e.knowledgePoint&&(o.add($e.knowledgePoint),$e.knowledgePoint.split(/[，,、\s]+/).filter(_e=>_e.length>=2).forEach(_e=>a.add(_e)));const c=[],v=[],S=new Set,d=new Set;for(const $e of o){if(s.has($e)){d.add($e);for(const Ge of s.get($e))S.has(Ge.text)||(S.add(Ge.text),c.push({...Ge,matchScore:3}));continue}for(const Ge of r)if(!d.has(Ge)&&(Ge.includes($e)||$e.includes(Ge))){d.add(Ge);for(const _e of s.get(Ge))S.has(_e.text)||(S.add(_e.text),v.push({..._e,matchScore:2}))}}if(c.length===0&&v.length===0)for(const $e of r){const _e=$e.split(/[，,、\s]+/).filter(gt=>gt.length>=2).filter(gt=>a.has(gt)).length;if(_e>0)for(const gt of s.get($e))S.has(gt.text)||(S.add(gt.text),v.push({...gt,matchScore:Math.min(_e,3)}))}const R=e.map($e=>$e.chapterTitle||"").join(" "),F=/英语|english|PEP/i.test(R),ke=/语文|课文|生字/i.test(R),b=/数学|math/i.test(R),Q=[...c,...v];for(const $e of Q)F&&((ne=$e.type)!=null&&ne.includes("词汇"))&&($e.matchScore+=2),ke&&((wt=$e.type)!=null&&wt.includes("生字"))&&($e.matchScore+=2),b&&$e.type==="例题"&&($e.matchScore+=1);const j=Q.filter($e=>{var Ge,_e;return $e.type==="词汇表"||$e.type==="生字表"||((Ge=$e.type)==null?void 0:Ge.includes("词汇"))||((_e=$e.type)==null?void 0:_e.includes("生字"))}),Te=Q.filter($e=>!j.includes($e));Te.sort(($e,Ge)=>Ge.matchScore-$e.matchScore);const tt=Math.floor(n*.6);let Ke="",We=0;for(const $e of j){if(We+$e.text.length>tt)break;const Ge=$e.type?` [${$e.type}]`:"";Ke+=`【${$e.chapterTitle}${Ge}】${$e.text}
`,We+=$e.text.length}const nt=n-We;if(nt>0)for(const $e of Te){if(We+$e.text.length>n||$e.matchScore===0&&We>nt*.3)break;const Ge=$e.type?` [${$e.type}]`:"";Ke+=`【${$e.chapterTitle}${Ge}】${$e.text}
`,We+=$e.text.length}if(!Ke){let $e="",Ge=0;for(const _e of e)if(!(!_e.segments||_e.segments.length===0)){for(const gt of _e.segments){if(Ge+gt.text.length>n)break;$e+=`【${_e.chapterTitle}】${gt.text}
`,Ge+=gt.text.length}if(Ge>=n)break}return $e}return Ke},It=e=>{if(!e)return 0;const t=parseInt(e);if(!isNaN(t))return t;const n={一:1,二:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9};for(const[s,r]of Object.entries(n))if(e.includes(s))return e.startsWith("高")?9+r:r;return 0},Mr={preview:(e,t,n)=>{It(n);const s=Y({category:"生成-输出格式",subject:e,stage:t,genType:"preview"});return s.length>0?s.map(o=>o.content).join(`
`):["- 大标题用<h1>，学习目标用<h2>",'- 预习检测题目留空，答案统一放文末<div class="answer-section">中',"- 直接返回HTML片段，不要用<html>、<head>、<body>或```html包裹"].join(`
`)},dictation:(e,t)=>{const n=Y({category:"生成-输出格式",subject:e,stage:t,genType:"dictation"});return n.length>0?n.map(r=>r.content).join(`
`):["- 大标题用<h1>，按字词/句子/段落分节用<h2>",'- 每个听写项用<div class="dictation-item">包裹',"- 练习区：序号+提示+留空书写区（不写答案！）",'- 答案区：标准答案集中放文末<div class="answer-section">中',"- 留空宽度要足够学生手写，至少2-3个全角字符宽","- 直接返回HTML片段，不要用<html>、<head>、<body>或```html包裹"].join(`
`)},reading:()=>{const e=Y({category:"生成-输出格式",genType:"reading"});return e.length>0?e[0].content:['- 大标题用<h1>，短文用<div class="reading-passage">包裹','- 题目用<ol>有序列表，选择题选项用<p class="option">','- 参考答案统一放文末<div class="answer-section">中',"- 直接返回HTML片段，不要用<html>、<head>、<body>或```html包裹"].join(`
`)},summary:()=>{const e=Y({category:"生成-输出格式",genType:"summary"});return e.length>0?e[0].content:["- 大标题用<h1>，小节用<h2>，子标题用<h3>","- 表格用<table>，关键词用<strong>",'- 趣味小练习题目标题留空，答案放文末<div class="answer-section">中',"- 直接返回HTML片段，不要用<html>、<head>、<body>或```html包裹"].join(`
`)},exam:()=>{const e=Y({category:"生成-输出格式",genType:"exam"});return e.length>0?e[0].content:['- 大标题用<h1>，题型标题用<h2>，题干用<p class="question">',`- 题号三级体系（强制性——逐级定义，无歧义）：
        【板块标题】h2标签内的题型板块名用"一、二、三、"（中文数字+顿号），如<h2>一、选择题</h2>
        【独立题目】p.question标签内的每道题用"1. 2. 3."（阿拉伯数字+英文句点），所有题目跨板块连续编号不重置
        【综合题子题】多子题的综合题内部子题用"(1)(2)(3)"（阿拉伯数字+半角圆括号），禁用"①②③"（带圈数字在部分字体中显示异常）
        严禁仅靠缩进区分层级——各级编号格式必须不同且保持稳定，禁止同级混搭`,'- ⛔ 禁止：<p style="margin-left:20px;font-size:14px;">1. 小题</p>（编号重复+缩进+小字号——导出Word后缩进消失导致层级混乱！）','- ✅ 正确示例：题型板块<h2>一、选择题</h2>，下设<p class="question">1. 题目</p>、<p class="question">2. 题目</p>。含子题的综合题：<p class="question">3. 综合题题干，下设：(1) 子题一 (2) 子题二</p>（仅靠编号格式区分层级，统一字号，无缩进）','- ⛔ 严禁使用不带 class 属性的 <p> 标签作为题目容器！所有题目必须用 <p class="question">，禁止用 <p>（无class）、<div> 或其他标签代替题目行',"- 所有题目正文（题干/选项/填空）使用统一字号，禁止因子题嵌套缩小字体",'- 选择题选项用<p class="option">，句中填空横线：<u class="blank-N">&emsp;</u>，题末/句末独立括号：<span class="blank-N">&emsp;</span>。横线与括号互斥，同一空位二选一不可叠加，严禁用___下划线代替','- 答案和解析统一放文末<div class="answer-section">中',"- 直接返回HTML片段，不要用<html>、<head>、<body>或```html包裹"].join(`
`)},errorbook:()=>{const e=Y({category:"生成-输出格式",genType:"errorbook"});return e.length>0?e[0].content:['- 错题用<div class="error-item">包裹，题号用<h3>','- 错误归因用<div class="error-reason">，正解用<div class="correct-solution">','- 变式巩固用<div class="variant-practice">',"- 直接返回HTML片段，不要用<html>、<head>、<body>或```html包裹"].join(`
`)}},mi=ui,yi=pi,$i=e=>{if(!e||e.length<3)return e;const t=[];let n=e;return n=n.replace(/<u\s+class="blank-\d+"[^>]*>[\s\S]*?<\/u>/gi,s=>(t.push(s),`__PPKU${t.length-1}__`)),n=n.replace(/<span\s+class="blank-\d+"[^>]*>[\s\S]*?<\/span>/gi,s=>(t.push(s),`__PPKS${t.length-1}__`)),n=n.replace(/_{3,}/g,s=>{const r=s.length;let o;return r<=3?o=2:r<=4?o=4:r<=6?o=6:r<=8?o=8:o=10,`<u class="blank-${o}">&emsp;</u>`}),n=n.replace(/(?:[（(])((?:\s|&emsp;|\u2003|&nbsp;| )+)(?:[）)])/g,(s,r)=>{const o=(r.match(/&emsp;/gi)||[]).length+(r.match(/\u2003/g)||[]).length,a=(r.match(/&nbsp;| /gi)||[]).length,c=o+a*.25;if(c<=0)return s;let v;return c<=1?v=4:c<=2?v=6:c<=3?v=8:v=10,`<span class="blank-${v}">&emsp;</span>`}),n=n.replace(/__PPKU(\d+)__/g,(s,r)=>t[parseInt(r)]||""),n=n.replace(/__PPKS(\d+)__/g,(s,r)=>t[parseInt(r)]||""),n},Er=e=>{if(!e)return"";const t=F=>{F=F.replace(new RegExp("\\p{Emoji_Presentation}","gu"),""),F=F.replace(new RegExp("\\p{Extended_Pictographic}","gu"),""),F=F.replace(/[\uFE0F\u200D]/g,"");const ke=F.match(/<body[^>]*>([\s\S]*?)<\/body>/i);return ke&&(F=ke[1].trim()),F=F.replace(/<\/?html[^>]*>/gi,""),F=F.replace(/<head[^>]*>[\s\S]*?<\/head>/gi,""),F=F.replace(/<\/?body[^>]*>/gi,""),F=F.replace(/<!DOCTYPE\s+html[^>]*>/gi,""),F=$i(F),F.trim()},n=/```(?:html?|HTML?)?[\s\n]*([\s\S]*?)\n?```/g,s=[];let r;for(;(r=n.exec(e))!==null;)s.push(r[1].trim());if(s.length>0){const F=s.join(`

`);if(F.length>20)return t(F);const ke=e.replace(/```(?:html?|HTML?)?[\s\n]*[\s\S]*?\n?```/g,"").trim(),b=ke.search(/<(!DOCTYPE|html|head|body|h[1-6]|p\b|div|table|ul|ol|span)\b/i);return b>=0?t(ke.substring(b)):""}const o=e.match(/^```html?\s*\n?([\s\S]*?)\n?```\s*$/);if(o)return t(o[1].trim());/^```html?\s*\n/.test(e)&&(e=e.replace(/^```html?\s*\n/,""),e=e.replace(/\n?```\s*$/,""));const a=e.search(/<(!DOCTYPE|html|head|body|h[1-6]|p\b|div|table|ul|ol|span|u\b|a\b|img|br)\b/i);a>0&&a<500&&(e=e.substring(a));const c=e.lastIndexOf(">");if(c>0&&c<e.length-1){const F=e.substring(c+1);!/<[a-zA-Z/]/.test(F)&&F.trim().length>0&&F.replace(/```\s*$/g,"").trim().length<F.length&&(e=e.substring(0,c+1)+(F.includes(`
`)?`
`:""))}const v=e.lastIndexOf("");if(v!==-1){const F=e.substring(v+8);if(F.trim().length>0)return t(F.trim())}const S=e.lastIndexOf("</think>");if(S!==-1){const F=e.substring(S+8);if(F.trim().length>0)return t(F.trim())}const d=e.trim();if(d.startsWith("{")||d.startsWith("["))return t(d);if(e.search(/<(!DOCTYPE|html|head|body|h[1-6]|p\b|div|table|ul|ol|span|u\b|a\b|img|br)\b/i)===-1){const F=e.match(/<(!DOCTYPE\s+html|html[\s>])/i);return F&&F.index>=0?t(e.substring(F.index)):""}return t(e)},zn=(e,t="")=>{if(!e||e.length<100)return{squished:!1,blockCount:0};const n=["<p","<div","<h1","<h2","<h3","<h4","<h5","<h6","<li","<br","<table","<ol","<ul","<section"];let s=0;for(const a of n){const c=new RegExp(a.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),"gi"),v=e.match(c);v&&(s+=v.length)}const r=Math.max(3,Math.floor(e.length/300)),o=s<r;return o&&console.warn(`⚠️ [排版检测] ${t||"未知类型"} 输出可能挤在段落中：${e.length}字仅${s}个块级标签（需≥${r}）`),{squished:o,blockCount:s,minBlocks:r}},jn=()=>{const e=Y({category:"生成-输出前置指令",subject:"",stage:"",genType:""});return e.length>0?e[0].content:`【最终输出指令——优先级最高，覆盖一切其他要求】
⛔ 1. 禁止输出任何前言、确认语、解释性文字！严禁出现"好的""收到""我将""根据"等
⛔ 2. 直接输出纯 HTML 代码！你的回复第一个字符必须是 <
⛔ 3. 输出语言：必须是纯 HTML！严禁使用任何 Markdown 语法！
   ❌ 禁止 ### 标题 | **加粗** | |表格| | ---分隔线 | -列表项
   ✅ 必须 <h1>-<h6> | <strong> | <p> | <br> | <u class="blank-N"> | <span class="blank-N">
   ⚠️ <table> 仅用于数据对比/矩阵型内容，禁止用于日常题目排版或页面布局
⛔ 4. 直接返回完整 HTML 代码，不要用 \`\`\`html 标记包裹`},Kn=(e,t,n,s)=>{const r={preview:`<h1>课前预习标题</h1>

<h2>一、学习目标</h2>
<p>目标1的描述内容</p>
<p>目标2的描述内容</p>

<h2>二、预习任务</h2>
<h3>任务标题</h3>
<p>任务具体内容，每个独立条目一行</p>
<p>另一个独立条目</p>

<h2>三、预习检测</h2>
<p>题目1的题干内容<u class="blank-2">&emsp;</u>（填空用 &lt;u class="blank-N"&gt; 标签）</p>
<p>题目2的题干内容<u class="blank-4">&emsp;</u>（N按答案字数：1/2/4/6/8/10）</p>

<div class="answer-section">
<h2>答案与提示</h2>
<p>题目1答案</p>
<p>题目2答案</p>
</div>`,summary:`<!-- ⚠️ 表格仅用于数据对比（知识清单/辨析/星级标注），日常题干/解析用<p>排版 -->
<h1>知识总结标题</h1>

<h2>一、学习目标</h2>
<p>目标描述</p>

<h2>二、核心知识清单</h2>
<table><tr><th>知识点</th><th>核心内容</th><th>考查方式</th></tr>
<tr><td>知识点名称</td><td>具体内容</td><td>考查形式</td></tr></table>

<h2>三、知识辨析与易错提示</h2>
<table><tr><th>常见错误</th><th>正确理解</th></tr>
<tr><td>错误认知</td><td>正确解释</td></tr></table>

<h2>四、典型例题精析</h2>
<div class="example"><p>题干内容（填空用 <u class="blank-2">&emsp;</u> 标记留空处）</p></div>
<div class="analysis"><p>解析内容</p></div>

<h2>五、重难点星级标注</h2>
<table><tr><th>知识点</th><th>难度</th><th>星级与考点说明</th></tr>
<tr><td>Good morning/afternoon 区分</td><td>重点</td><td>⭐⭐⭐ 高频考点，常结合时间情景图考查</td></tr>
<tr><td>字母 Aa-Dd 书写</td><td>重点</td><td>⭐⭐ 中频考点，注意笔顺和占格</td></tr>
<tr><td>小写 b 和 d 区分</td><td>难点</td><td>⭐⭐⭐ 高频易错点</td></tr></table>

<h2>六、记忆方法 / 学习技巧</h2>
<p>1. <strong>时间轴法：</strong>画一个钟表，上午画太阳写 Good morning，下午画云写 Good afternoon。</p>
<p>2. <strong>字母手势法：</strong>左手比 b（拇指朝上），右手比 d（拇指朝上），b 和 d 面对面。</p>
<p>3. <strong>歌曲法：</strong>唱问候歌帮助记忆。</p>`,dictation:`<h1>听写默写标题</h1>

<h2>一、字词听写</h2>
<div class="dictation-item"><p>1. 拼音提示 <u class="blank-2">&emsp;</u>（横线书写区）</p></div>
<div class="dictation-item"><p>2. 拼音提示 <u class="blank-2">&emsp;</u></p></div>

<h2>二、句子默写</h2>
<div class="dictation-item"><p>1. 给出上句/标题，下句用 <u class="blank-8">&emsp;</u> 书写区</p></div>

<div class="answer-section">
<h2>答案</h2>
<p>答案内容</p>
</div>`,reading:`<h1>阅读训练标题</h1>

<div class="reading-passage">
<p>短文段落1内容</p>
<p>短文段落2内容</p>
</div>

<h2>阅读理解题</h2>
<ol>
<li><p>题目1题干</p><p class="option">A. 选项</p><p class="option">B. 选项</p></li>
<li><p>题目2题干（填空题用 <u class="blank-4">&emsp;</u> 标记留空）</p></li>
</ol>

<div class="answer-section">
<h2>答案与解析</h2>
<p>题目1答案</p>
</div>`,errorbook:`<h1>错题本标题</h1>

<div class="error-item">
<h3>错题1：知识点名称</h3>
<p class="question">原题题干</p>
<div class="error-reason"><h4>❌ 错误归因</h4><p>错误原因分析</p></div>
<div class="correct-solution"><h4>✅ 正确解法</h4><p>正确解题步骤</p></div>
<div class="variant-practice"><h4>🔄 变式巩固</h4><p>变式题目（如有填空用 <u class="blank-2">&emsp;</u> 标记留空处）</p></div>
</div>`,exam:`<h1>试卷标题</h1>
<div class="exam-info"><p>考试信息</p></div>

<h2>一、选择题</h2>
<p class="question">1. 题干内容</p>
<p class="option">A. 选项A</p>
<p class="option">B. 选项B</p>
<p class="option">C. 选项C</p>
<p class="option">D. 选项D</p>

<h2>二、填空题</h2>
<p class="question">2. 题干<u class="blank-2">&emsp;</u>内容</p>

<h2>三、综合题（多级编号示例）</h2>
<p class="question">3. 综合题题干（含子题）：</p>
<p class="question">(1) 子题一的题干内容</p>
<p class="question">(2) 子题二的题干内容</p>

<div class="answer-section">
<h2>答案与解析</h2>
<p>1. 答案 | 2. 答案 | 3.(1) 答案 | 3.(2) 答案</p>
</div>`,practice:`<h1>课时练习标题</h1>
<div class="practice-info"><p>年级 学科 课时练习</p></div>

<h2>一、基础巩固</h2>
<p class="question">1. 题干内容<u class="blank-2">&emsp;</u>（填空用 &lt;u class="blank-N"&gt; 标签）</p>
<p class="question">2. 题干内容</p>
<p class="option">A. 选项A</p>
<p class="option">B. 选项B</p>
<p class="option">C. 选项C</p>
<p class="option">D. 选项D</p>

<h2>二、能力提升</h2>
<p class="question">3. 题干内容</p>
<p class="question">4. 综合题题干（含子题）：</p>
<p class="question">(1) 子题一的题干内容</p>
<p class="question">(2) 子题二的题干内容</p>

<h2>三、拓展探究</h2>
<p class="question">5. 开放性题目内容</p>

<div class="answer-section">
<h2>答案与解析</h2>
<p>1. 答案 | 2. 答案 | 3. 答案 | 4.(1) 答案 | 4.(2) 答案 | 5. 答案</p>
</div>`,special:`<h1>专项训练标题</h1>
<div class="practice-info"><p>年级 学科 专项训练</p></div>

<h2>一、方法指导</h2>
<p>该类题型的解题思路或方法说明</p>

<h2>二、例题精讲</h2>
<p class="question">1. 例题题干</p>
<p class="analysis">解题步骤与思路分析</p>

<h2>三、阶梯训练</h2>
<p class="question">2. 基础题题干<u class="blank-2">&emsp;</u>（填空用 &lt;u class="blank-N"&gt; 标签）</p>
<p class="question">3. 拔高题题干</p>
<p class="question">4. 综合题题干（含子题）：</p>
<p class="question">(1) 子题一</p>
<p class="question">(2) 子题二</p>

<div class="answer-section">
<h2>答案与解析</h2>
<p>1. 答案 | 2. 答案 | 3. 答案 | 4.(1) 答案 | 4.(2) 答案</p>
</div>`},o=r[e]||r.exam,a=Y({category:"生成-输出格式",subject:t||"",stage:n||"",genType:e}),c=a.length>0?`【输出格式规范】
`+a.map(v=>v.content).join(`
`):"";return c+(c?`

`:"")+`【输出结构模板——以下为参考示例，实际内容请根据指令自行设计】
${o}`},Ar=(e,t,n)=>{const{situationAnchor:s="",contextSummary:r="",styleConsistencyHint:o="",materialContext:a="",templateContext:c="",typeRule:v="",integratedContext:S="",selectedTemplates:d,instruction:R="",selectedBooks:F,stage:ke="",diversitySeed:b=""}=n,Q={exam:"你是一位命题专家，请命制一道考试题。",practice:"你是一位教学设计者，请设计一道课时配套练习题。",special:"你是一位专项训练设计者，请设计一道专项训练题。"},j=Q[t]||Q.exam,Te={exam:"基础/中档/提高——三道难度梯度确保考试区分度",practice:"基础巩固/能力提升/拓展探究——三道层级体现教学练评一致性",special:"入门练/进阶练/挑战练——三道阶梯实现专项能力突破"},tt=Te[t]||Te.exam,We={exam:`【考试题质量要求】
- 试题需有合理区分度，基础题确保大多数学生能做对，提高题能区分优秀学生
- 答案必须无争议，不得出现模棱两可的表述
- 综合题应体现知识综合运用能力而非简单堆砌`,practice:`【课时练习质量要求】
- 题目必须与教材内容高度一致，不超纲、不偏题
- 基础巩固题紧贴教材原题，能力提升题在原题基础上适当变式，拓展探究题联系生活实际
- 题量适中，适合学生在当堂或课后完成，单题解答时间约2-5分钟`,special:`【专项训练质量要求】
- 题目必须围绕专项知识点展开，覆盖该知识点的各种考查角度
- 从最简单考查方式开始，逐步增加难度，形成清晰的思维训练梯度
- 典型方法和解题模型要覆盖完整，让学生通过训练掌握解题套路`,review:`【复习资料质量要求】
- 知识框架层次分明，考点梳理完整不遗漏
- 典型题析要涵盖该知识点的所有常见考查角度和变式
- 易错点辨析必须精确，给出错误原因和正确理解
- 综合自测题难度梯度合理，能真实检验复习效果`}[t]||"",nt=(()=>{var Pe,Ve;const _e=d==null?void 0:d[0],gt=(Pe=_e==null?void 0:_e.analysis)==null?void 0:Pe.typeLanguageProfiles;if(!gt||!e.type)return"";const ct=gt[e.type];if(!ct)return"";let Ze=`
【模板语言风格约束——本题型专属】
`;return ct.avgStemLength&&(Ze+=`- 参考题干长度：约${ct.avgStemLength}字（±20%）
`),(Ve=ct.commonPatterns)!=null&&Ve.length&&(Ze+=`- 参考句式开头：${ct.commonPatterns.slice(0,2).join("、")}
`),ct.hasPlease&&(Ze+=`- 该题型在模板中常用"请"引导
`),ct.hasTry&&(Ze+=`- 该题型在模板中常用"试"引导
`),ct.hasKnown&&(Ze+=`- 该题型在模板中常用"已知"陈述
`),ct.avgOptions&&e.type==="选择题"&&(Ze+=`- 参考选项数：${ct.avgOptions}个
`),ct.sampleStem&&(Ze+=`- 典型题干示例：「${ct.sampleStem}」
`),Ze})(),ne=(()=>{var Ve,dt;const _e=d==null?void 0:d[0],gt=(Ve=_e==null?void 0:_e.analysis)==null?void 0:Ve.typeLanguageProfiles;if(gt&&gt[e.type])return"";const Ze=(dt=_e==null?void 0:_e.analysis)==null?void 0:dt.languageStyle;if(!Ze)return"";let Pe=`
【模板全局语言风格约束】
`;return Ze.avgSentenceLength&&(Pe+=`- 参考句长：约${Ze.avgSentenceLength}字
`),Ze.tone&&(Pe+=`- 语气：${Ze.tone}
`),Ze.sampleSentence&&(Pe+=`- 风格参考：「${Ze.sampleSentence}」
`),Pe})(),wt=(()=>{const _e=(F==null?void 0:F.find(gt=>gt.subject))||(F==null?void 0:F[0]);return _e!=null&&_e.subject&&Kt(_e.subject,ke),_e!=null&&_e.grade,R?Ln(R):""})(),$e=t==="exam"?`- 分值：${e.score}分
`:"",Ge=t==="exam"?`- 在这道题后标注：【知识点：${e.knowledgePoint}】【难度：${e.difficulty}】
`:"";return`${j}
${b?`
`+b+`
`:""}
${s}
${r}
${o}
⚠️ 【反雷同指令——每题必须有不同的"面孔"】你的设问方式、场景选择、句式结构必须追求多样性。不要重复使用相同的题干开头句式（如"Read and choose""Look and write"等套话），每道题都应有独特的命题风格和语言表达。
【题目要求】
- 题号：${e.number}
- 题型：${e.type}
- 考查知识点：${e.knowledgePoint}
- 认知层次：${e.cognitiveLevel||"理解"}
- 难度：${e.difficulty}（${tt}）
${$e}- 对应章节：${e.sourceChapter}
${S}

${a}
${c}
${v}
${nt}
${ne}

【防幻觉约束——必须遵守】
1. ⛔ 以"${e.knowledgePoint}"为核心考查点，可自然关联前置知识，但不得偏离主线目标
2. ⛔ 题干中涉及的数据、公式、概念必须与教材一致，不得自行编造
3. ⛔ 答案必须是确定且正确的，不能模棱两可
4. ⛔ 禁止"下列说法正确的是""以上都是/以上都不对"等无信息量设问
5. ⛔ 不得出现科学性错误（数据/公式/概念/单位必须准确）
6. ⛔ 禁止"略""见教材""自行查阅"等占位符

${We}

${wt}
🔴 答案规则：本题需包含答案与解析，用HTML注释包裹：<!-- answer:正确答案 | 解析:解题思路 -->
请只生成这一道题，格式为HTML片段：
- 🔴 字号铁律：所有正文内容（题干/选项/填空/解答区）必须使用统一字号（<p>/<li>标签默认大小），严禁因题目含子题、嵌套层级而缩小任何文字的字号。层级通过编号格式区分，不通过字号区分
- 🔴 若本题为综合题（含多个子小题），子小题编号必须用"(1)(2)(3)"或"①②③"格式

⛔ 【禁止模式——以下写法会导致排版崩溃，严禁使用！】
❌ 错误：<p class="question">${e.number}. 大题</p>
          <p style="margin-left:20px;font-size:14px;">1. 小题</p> ← 编号重复！缩进导出Word丢失！
          <p style="margin-left:20px;font-size:14px;">2. 小题</p> ← 小字号破坏统一排版！
✅ 正确：<p class="question">${e.number}. 大题</p>
          <p class="question">(1) 小题</p> ← 编号格式不同，无需缩进或缩字号
          <p class="question">(2) 小题</p>
- 题号用 <span class="question-number">${e.number}.</span>
- 题干用 <p class="question">
- 选择题选项用 <p class="option">
- 🎯 **填空题标记智能选择**（含手写余量，已上调一档）：根据答案类型和长度选择：
  * 1字→ <u class="blank-2">&emsp;</u>
  * 2字→ <u class="blank-4">&emsp;</u>
  * 3-4字→ <u class="blank-6">&emsp;</u>
  * 5-6字→ <u class="blank-8">&emsp;</u>
  * 7-10字→ <u class="blank-10">&emsp;</u>
  * 10字以上→ <u class="blank-10">&emsp;</u>
- ⛔ **括号内留空（仅选择题/判断题题末）**：必须用 <span class="blank-N">&emsp;</span>，严禁在括号内用 <u>！横线与括号二选一，不可叠加！
  * N按答案字数严格计算（最小取4）：1-2字→4, 3-4字→6, 5-6字→8, 7-10字→10, 10字以上→10
  * ✅ 正确：(<span class="blank-2">&emsp;</span>)  ❌ 错误：(<u class="blank-2">&emsp;</u>) ← 严禁括号内出现下划线！
- 方框：<span class="square-box">&emsp;</span>
- 如果是解答题，留出解答区域
- 🎯 **特殊标记规范**（重要！）：
  * 需要强调的文字用 <strong>加粗</strong>
  * 需要下划线的文字用 <u>下划线</u>
  * 需要删除线的文字用 <del>删除线</del>
  * ⭐ "加点字"处理：用 <span class="emphasis-dot">字</span> 标记，CSS会自动在字下方显示点(·)
    示例：下列词语中，<span class="emphasis-dot">和</span>平的读音...
  * ⭐ "画线句子"处理：用 <u class="underline-sentence">完整句子</u> 标记
    示例：请赏析<u class="underline-sentence">春风又绿江南岸</u>的表达效果
  * ⭐ "上标"处理：用 <sup class="superscript">内容</sup> 或 <span class="superscript">内容</span>
    示例：x<sup class="superscript">2</sup> (x的平方), v<sub class="subscript">0</sub> (初速度)
  * ⭐ "下标"处理：用 <sub class="subscript">内容</sub> 或 <span class="subscript">内容</span>
    示例：H<sub class="subscript">2</sub>O (水), CO<sub class="subscript">3</sub><sup class="superscript">2-</sup> (碳酸根)
  * ⭐ "拼音标注"处理：用 <ruby>汉字<rt>pīnyīn</rt></ruby>
    示例：<ruby>重<rt>zhòng</rt></ruby>量, <ruby>春<rt>chūn</rt></ruby>天
  * ⭐ "特殊数学符号"处理：直接使用Unicode字符，不要用LaTeX或图片
    - 度数：° (如 90°, 45°)
    - 约等于：≈ (如 π ≈ 3.14)
    - 不等于：≠ (如 x ≠ 0)
    - 小于等于：≤ (如 x ≤ 10)
    - 大于等于：≥ (如 x ≥ 5)
    - 正负号：± (如 ±5)
    - 乘号：× (如 3 × 4 = 12)
    - 除号：÷ (如 12 ÷ 3 = 4)
    - 三角形：△ (如 △ABC)
    - 角：∠ (如 ∠ABC = 90°)
    - 平行：∥ (如 AB ∥ CD)
    - 垂直：⊥ (如 AB ⊥ CD)
    - 圆周率：π (如 C = 2πr)
    - 无穷大：∞
    - 根号：√ (如 √2, √(a+b))
- 保留原文的空白缩进和换行
${Ge}只返回这一道题的HTML代码，不要添加\`\`\`html标记。`},mn=async(e,t,n,s)=>{var S,d,R,F,ke;const r=await Qt("analysis"),o=pn(r.textModel||r.model);s&&s(`第一步：逐课提取命题素材 [${o}]...`,5);const a=[];if(!e||e.length===0)return a;const c=(b,Q)=>{if(!b||!Q)return!1;if(Q.length>=4)return b.includes(Q);let j=0;for(;j<b.length;){const Te=b.indexOf(Q,j);if(Te===-1)return!1;const tt=Te>0?b[Te-1]:"",Ke=Te+Q.length<b.length?b[Te+Q.length]:"",We=nt=>nt===""||/[\s,，。；;、：:！!？?（）()【】《》""''\[\]{}]/.test(nt);if(We(tt)&&We(Ke))return!0;j=Te+1}return!1},v=(b,Q=100,j=500)=>{const Te=[];let tt=0;for(;tt<b.length;){const Ke=b[tt];if(Ke.length>=Q)Te.push(Ke),tt++;else{let We=Ke;for(tt++;tt<b.length&&b[tt].length<Q&&We.length+b[tt].length+1<=j;)We+=`
`+b[tt],tt++;Te.push(We)}}return Te};for(const b of e){const Q=b.selectedChapters||[];for(const j of Q){if(!j.rawText&&!j.coreTopics)continue;let Te=j.rawText||"";const tt=De=>{let qe=5381;for(let _t=0;_t<De.length;_t++)qe=(qe<<5)+qe+De.charCodeAt(_t);return(qe>>>0).toString(36)},Ke=j._analyzedTextHash&&tt(Te)===j._analyzedTextHash,We=j._analyzedPlainTextLength||0,nt=Te.length,ne=Te.replace(/<[^>]*>/g,"").length,wt=We>0&&Math.abs(nt-We)<=300&&Math.abs(ne-We)<=300,$e=!Ke&&!wt,Ge=De=>/[\$\^\\]|sqrt|frac|sum|int|lim|alpha|beta|gamma|theta|pi/.test(De);if(Te=Te.replace(/([\$\^\\]|sqrt|frac|sum|int|lim|alpha|beta|gamma|theta|pi)/g,"[FORMULA]$1[/FORMULA]"),/\|.*\|.*\|/.test(Te)&&(Te=Te.replace(/(\|[^\n]+\|)/g,"[TABLE]$1[/TABLE]")),Te=Te.replace(/^(\d+[\.、]\s+.+)$/gm,"[HEADING]$1[/HEADING]"),j.analyzed&&((S=j.knowledgeHierarchy)==null?void 0:S.length)>0&&!$e){console.log(`📦 [Step1捷径] ${j.title}: analyzed=${j.analyzed} hierarchy=${((d=j.knowledgeHierarchy)==null?void 0:d.length)||0}个 textLen=${nt}`);const De=[],qe={};for(const it of j.knowledgeHierarchy)for(const xt of it.coreKnowledge||[]){xt.name&&!De.includes(xt.name)&&(De.push(xt.name),qe[xt.name]=xt.level||xt.cognitiveLevel||"理解");for(const qt of xt.specificConcepts||[])qt&&!De.includes(qt)&&(De.push(qt),qe[qt]="识记")}const _t=De.length>0?De:[j.title],cn=fs(Te,500),Ht=v(cn).map(it=>{const xt=[];for(const $n of j.knowledgeHierarchy)for(const Wt of $n.coreKnowledge||[]){Wt.name&&c(it,Wt.name)&&(xt.includes(Wt.name)||xt.push(Wt.name));for(const nn of Wt.specificConcepts||[])c(it,nn)&&!xt.includes(nn)&&xt.push(nn)}let qt="正文";it.includes("例")||/^例\d+/.test(it)?qt="例题":it.includes("练习")||it.includes("习题")?qt="练习":(it.includes("小结")||it.includes("回顾")||it.includes("总结"))&&(qt="小结");const On=it.match(/[a-zA-Z]+[\s\-—]+[\u4e00-\u9fa5]+/g);return On&&On.length>=3&&(qt="词汇表"),/[\u4e00-\u9fa5]\s+[\u4e00-\u9fa5]/.test(it)&&it.length<200&&!it.includes("。")&&(qt="生字表"),{text:it,knowledgePoints:xt.length>0?xt:[j.title],type:qt,isKeyConcept:xt.length>0,isExample:it.includes("例"),isExercise:it.includes("练习"),suggestedQuestionTypes:[],hasFormula:Ge(it)}}),St=Ht.filter(it=>it.isKeyConcept);a.push({chapterTitle:j.title,summary:j.coreTopics||_t.slice(0,5).join("、"),knowledgePointsForTest:_t.slice(0,20).map(it=>({name:it,cognitiveLevel:qe[it]||"理解"})),adaptableMaterials:St.slice(0,5).map(it=>it.text.substring(0,100)),suggestedQuestionTypes:[...new Set(j.knowledgeHierarchy.flatMap(it=>(it.coreKnowledge||[]).flatMap(xt=>xt.suggestedQuestionTypes||[])))].slice(0,8),segments:Ht,totalSegments:Ht.length,tags:_t.slice(0,10)});continue}const _e=fs(Te,500),gt=v(_e),ct=[];console.log(`🤖 [Step1完整AI] ${j.title}: analyzed=${j.analyzed} hierarchy=${((R=j.knowledgeHierarchy)==null?void 0:R.length)||0}个 segments=${gt.length}(原始${_e.length}) rawText=${Te.length}字`);const Ze=[];if((F=j.knowledgePoints)!=null&&F.length)Ze.push(...j.knowledgePoints);else if((ke=j.knowledgeHierarchy)!=null&&ke.length)for(const De of j.knowledgeHierarchy)for(const qe of De.coreKnowledge||[])Ze.push(qe.name),qe.specificConcepts&&Ze.push(...qe.specificConcepts);const Pe=[...new Set(Ze)].slice(0,20);for(let De=0;De<gt.length;De+=3){const qe=gt.slice(De,De+3),_t=qe.map((sn,h)=>`[段${De+h+1}] ${sn}`).join(`

---

`),cn=Y({category:"分析-知识图谱构建"}).find(sn=>sn.id.includes("candidate_kp_names")),jt=cn?cn.content:"⚠️ 知识点名称必须与以上列表一致的命名风格，不要自创不同名称指代同一概念",Ht=Pe.length>0?`【候选知识点名称——必须从以下列表中选择，或保持命名风格一致】
${Pe.join("、")}
${jt}
`:"",St=b.subject||"",it=b.stage||"",xt=St.includes("语文"),qt=St.includes("数学"),On=St.includes("英语"),$n=St.includes("物理"),Wt=St.includes("化学"),nn=St.includes("生物"),$s=St.includes("科学"),Rn=St.includes("历史"),wn=St.includes("地理"),bn=St.includes("政治")||St.includes("道德")||St.includes("思想"),ws=St.includes("信息"),bs=St.includes("音乐"),vs=St.includes("美术"),Ts=St.includes("体育"),Cs=$n||Wt||nn||$s,Ss=Rn||wn||bn,vn=It(b.grade||""),fn=it.includes("小学"),Tn=it.includes("初中"),Cn=it.includes("高中"),Xn=fn&&vn>0&&vn<=2,Zn=fn&&vn>=3&&vn<=4,Yn=fn&&vn>=5;let ln="";xt?ln=`【语文学科专项提取规则——通读全文，不得遗漏任何知识内容】
- 📝 生字/生词：每个生字独立标注（如"人""口""手"），绝不合并
- 📝 多音字：标注每个读音和组词（如"长(cháng)长短/长(zhǎng)长大"）
- 📝 近义词/反义词：成对标注，注明辨析要点
- 📝 重点词语/成语/俗语/歇后语：逐词标注含义和用法
- 📝 需背诵段落/古诗/名句/文言文：标注篇名和范围
- 📝 课文内容理解：主旨、人物形象、事件脉络、道理、情感
- 📝 修辞手法：比喻、拟人、排比、夸张、反问、设问等
- 📝 标点符号用法与病句修改考点
- 📝 阅读理解考点：词语理解、句子含义、内容概括、结构分析
- 📝 写作/口语交际/综合性学习/名著导读要求
${Xn?`- 🔧 低段(1-2)：拼音、笔画笔顺、偏旁部首、看图写话、简单日记
`:""}${Zn?`- 🔧 中段(3-4)：段落大意、习作、简单修辞、观察日记
`:""}${Yn?`- 🔧 高段(5-6)：文言文入门、说明文阅读、读后感
`:""}${Tn?`- 🔧 初中：文言文实词虚词、古诗词鉴赏、议论文/说明文阅读
`:""}${Cn?`- 🔧 高中：文言文特殊句式、诗歌鉴赏手法、论述类/文学类文本阅读
`:""}`:qt?ln=`【数学学科专项提取规则——通读全文，不得遗漏任何知识内容】
- 🔢 概念/定义：每个数学概念独立标注
- 🔢 公式/定理/运算法则/性质：逐条标注，注明适用条件
- 🔢 计算方法/解题步骤/证明思路：标注关键步骤
- 🔢 例题：标注考查的知识点和解题方法
- 🔢 几何图形：性质、判定、计算公式
- 🔢 统计与概率：数据收集、图表解读、概率计算
- 🔢 应用题类型与解题策略
- 🔢 数学术语/符号/单位
- 🔢 课后练习/习题中考查的题型和能力层次
${Xn?`- 🔧 低段(1-2)：数的认识、20以内加减、图形认识、口算、钟表
`:""}${Zn?`- 🔧 中段(3-4)：乘除法、分数初步、周长面积、简单应用题
`:""}${Yn?`- 🔧 高段(5-6)：小数分数运算、方程、几何计算、复合应用题
`:""}${Tn?`- 🔧 初中：代数运算、几何证明、函数初步、统计与概率
`:""}${Cn?`- 🔧 高中：函数、数列、立体几何、概率统计、导数、向量
`:""}`:On?ln=`【英语学科专项提取规则——通读全文，不得遗漏任何知识内容】
- 📕 词汇表/单词表：每个词条（英文+中文释义）独立标注，逐条列出，不得遗漏任何一个
- 📕 重点句型：每个句型独立标注（如"What's your name?""I like...""There be..."）
- 📕 语法点：时态、语态、句型结构、词性、从句等逐条标注
- 📕 对话/短文：标注主题、关键表达、交际功能
- 📕 发音/拼读规则：自然拼读、音标、重音、连读等
- 📕 听力材料中的关键信息和考查点
- 📕 阅读理解策略与完形填空考点
- 📕 书面表达/写作话题与常用表达
- 📕 文化知识/跨文化交际内容
- 📕 教材各板块：Let's learn/Talk/Spell/Read/Write/Story等全部提取
${Xn?`- 🔧 低段(1-2)：字母、简单单词、日常问候、歌曲歌谣、颜色数字
`:""}${Zn?`- 🔧 中段(3-4)：对话理解、短文阅读、简单语法、词汇拼写
`:""}${Yn?`- 🔧 高段(5-6)：篇章阅读、时态综合、简单写作
`:""}${Tn?`- 🔧 初中：完形填空、阅读理解、书面表达、语法系统
`:""}${Cn?`- 🔧 高中：深层阅读、语法填空、读后续写、概要写作
`:""}`:Cs?ln=`【${$n?"物理":Wt?"化学":nn?"生物":"科学"}学科专项提取规则——通读全文，不得遗漏任何知识内容】
- 🔬 概念/定义/定律/原理：每个独立标注，注明内涵
- 🔬 公式/方程式/化学式：逐条标注${Wt?"，配平和反应条件":""}
- 🔬 实验：目的、器材、步骤、现象、结论、注意事项
- 🔬 计算题考查点和公式应用
- 🔬 图表/数据/示意图的解读要点
- 🔬 ${$n?"力学/电学/光学/热学":Wt?"物质性质、反应类型、元素周期":nn?"细胞、遗传、生态、进化":"物质科学、生命科学、地球科学"}核心知识
- 🔬 科学探究方法：观察、假设、实验、分析、结论
- 🔬 ${nn?"结构与功能关系、分类依据":"物质变化规律、能量转化"}
- 🔬 课后练习/习题中考查的题型和能力
${fn?`- 🔧 小学：观察描述、简单分类、常见现象解释、动手实验
`:""}${Tn?`- 🔧 初中：基础定律、简单计算、实验操作规范、探究报告
`:""}${Cn?`- 🔧 高中：复杂理论推导、定量计算、综合实验设计、科学思维
`:""}`:Ss?ln=`【${Rn?"历史":wn?"地理":"政治/道德与法治/思想政治"}学科专项提取规则——通读全文，不得遗漏任何知识内容】
- 📖 核心概念/原理/定义：每个独立标注
- 📖 ${Rn?"重要事件/人物/时间/导火索/结果/意义":wn?"地理位置/地形/气候/资源/人口/经济":"政治概念/制度/法律/权利/义务/价值观"}
- 📖 ${wn?"地图/图表/数据分析：识图、读图、绘图要点":"材料/图表/数据解读要点"}
- 📖 因果关系/影响意义/启示/教训
- 📖 案例分析/材料解读/情境判断
- 📖 比较异同/归纳总结/评价论述
- 📖 ${Rn?"史料实证/历史解释/时空观念":wn?"区域认知/综合思维/人地协调观":"政治认同/法治意识/公共参与"}
- 📖 课后练习/习题中考查的题型和能力层次
${fn?`- 🔧 小学：常识性了解、行为规范、简单地图识别、身边的社会现象
`:""}${Tn?`- 🔧 初中：系统知识体系、综合分析能力、材料题/简答题
`:""}${Cn?`- 🔧 高中：深度理论理解、多角度分析、论述题/综合探究
`:""}`:ws?ln=`【信息科技学科专项提取规则——通读全文，不得遗漏任何知识内容】
- 💻 概念/术语：每个独立标注
- 💻 操作步骤/流程/命令
- 💻 编程知识点：语法、算法、数据结构
- 💻 软件应用/工具使用
- 💻 信息安全/网络道德
- 💻 项目实践/案例应用
${fn?`- 🔧 小学：计算机基础操作、图形化编程、信息意识
`:""}${Tn?`- 🔧 初中：办公软件、简单编程、网络基础
`:""}${Cn?`- 🔧 高中：算法设计、数据处理、人工智能初步
`:""}`:(bs||vs||Ts)&&(ln=`【${St}学科专项提取规则——通读全文，不得遗漏任何知识内容】
- 核心概念/术语/技法：每个独立标注
- 作品/曲目/运动项目及其要点
- 鉴赏/欣赏/评价要点
- 实践/操作/训练要求
- 课后练习/活动考查的内容`);const Gs=`你是${b.stage||""}${b.grade||""}${b.subject||""}学科命题专家。

【核心任务】通读以下教材段落，标注所有可用于命题的知识内容。必须逐字逐句通读，确保不遗漏段落中的任何知识信息。

${ln}

【通用规则——所有学科都必须遵守】
- ⭐ 教材中加粗/标红/框出/特殊字体标注的内容，必须全部提取
- ⭐ 课后练习/习题中明确要求学生掌握的内容
- ⭐ 段落中明确标记为"重点""难点""考点"的内容
- 🔒 必须逐条标注，绝不将多个知识点合并为一条（如"生字5个"→必须拆成5条独立知识点）
- 🔒 先通读确认段落整体内容类型（正文/词汇表/练习/导语），再逐条精准标注
${Ht}
${_t}

返回 JSON 数组：[{"segmentIndex": ${De+1}, "knowledgePoints": ["知识点1"], "type": "正文|例题|练习|导语|小结|词汇表|生字表", "isKeyConcept": true, "suggestedQuestionTypes": ["题型1"]}]
⚠️ 如果是词汇表/生字表段落，type 必须标注为"词汇表"或"生字表"，并将每个词条作为独立 knowledgePoint 列出，不得合并`;try{const sn=await t(Gs,{taskType:"analysis",temperature:.1,timeout:6e4}),h=await n(sn,null,`分段分析-${j.title}`);if(Array.isArray(h))for(const u of h){const i=(u.segmentIndex||1)-1-De;i>=0&&i<qe.length&&ct.push({text:qe[i],knowledgePoints:u.knowledgePoints||[],type:u.type||"正文",isKeyConcept:u.isKeyConcept||!1,isExample:u.type==="例题"||qe[i].includes("例"),isExercise:u.type==="练习"||qe[i].includes("练习"),suggestedQuestionTypes:u.suggestedQuestionTypes||[],hasFormula:Ge(qe[i])})}}catch(sn){console.warn(`分段分析失败（${j.title}），使用降级策略:`,sn.message);const h=Ze.length>0?Ze:[j.title];for(let u=0;u<qe.length;u++){const i=qe[u],p=h.filter(m=>c(i,m));let P="正文";i.includes("例")||/^例\d+/.test(i)?P="例题":i.includes("练习")||i.includes("习题")?P="练习":(i.includes("小结")||i.includes("回顾"))&&(P="小结"),ct.push({text:i,knowledgePoints:p.length>0?p:[j.title],type:P,isKeyConcept:p.length>0,isExample:P==="例题",isExercise:P==="练习",suggestedQuestionTypes:[],hasFormula:Ge(i)})}}}const Ve=[...new Set(ct.flatMap(De=>De.knowledgePoints).filter(De=>typeof De=="string"&&De.trim()))],dt=ct.filter(De=>De.isKeyConcept);a.push({chapterTitle:j.title,summary:j.coreTopics||Ve.slice(0,5).join("、"),knowledgePointsForTest:Ve.map(De=>({name:De,cognitiveLevel:"理解",sourceText:"",suggestedDifficulty:"基础",hasFormula:(j.formulas||[]).some(qe=>De.includes(qe.replace(/[^a-zA-Z\u4e00-\u9fa5]/g,"").substring(0,4))||qe.includes(De.substring(0,4))),relatedFormulas:(j.formulas||[]).filter(qe=>De.includes(qe.replace(/[^a-zA-Z\u4e00-\u9fa5]/g,"").substring(0,4))||qe.includes(De.substring(0,4))).slice(0,3)})),adaptableMaterials:dt.slice(0,5).map(De=>De.text.substring(0,100)),suggestedQuestionTypes:[...new Set(ct.flatMap(De=>De.suggestedQuestionTypes))].slice(0,5),rawText:Te,segments:ct,totalSegments:ct.length,tags:Ve})}}return a},Mn=async(e,t,n,s,r)=>{var F,ke;const o=await Qt("blueprint"),a=pn(o.textModel||o.model);r&&r(`第二步：构建知识图谱 [${a}]...`,20);let c={knowledgePoints:[],keyDifficulties:[],knowledgeGraph:[],crossChapterLinks:[]};if(e.length===0){const b=((ke=(F=t==null?void 0:t[0])==null?void 0:F.selectedChapters)==null?void 0:ke.length)||0;throw new Error(`知识图谱构建失败：未提取到任何教材素材（已选${b}章）。
可能原因：教材内容为空、图片识别失败、或章节未包含可提取的文字内容。
建议：检查教材文件是否完整，或重新导入教材后重试。`)}const v=e.map(b=>({title:b.chapterTitle,summary:b.summary,kpForTest:b.knowledgePointsForTest||[],keySegmentSamples:(b.segments||[]).filter(Q=>Q.isKeyConcept||Q.isExample||Q.hasFormula).slice(0,5).map(Q=>({type:Q.type,hasFormula:Q.hasFormula||!1,snippet:(Q.text||"").substring(0,50)})),totalSegments:b.totalSegments||0,tagSummary:(b.tags||[]).slice(0,10),suggestedQuestionTypes:b.suggestedQuestionTypes||[]})),S=Y({category:"分析-知识图谱构建"}).find(b=>b.id.includes("input_data_desc")),R=`你是课程与教学专家。请基于以下各课内容，构建层级知识图谱。

【输入数据说明】
${S?S.content:`- kpForTest：每个知识点对象，hasFormula=true表示涉及公式
- suggestedQuestionTypes：该章节各知识点建议的考查题型`}

各课内容概要：
${JSON.stringify(v,null,2)}

请完成：
1. 知识点清单（去重，不超过30个）
2. 重难点判断（不超过8个）
3. 层级知识图谱：单元→大概念(≤5)→核心知识点(≤6)→具体概念(≤4)，每个核心知识标注建议题型(suggestedQuestionTypes)
4. 跨章节关联（不超过10条）

返回JSON：{"knowledgePoints":[""],"keyDifficulties":[""],"knowledgeGraph":[{"unit":"","bigConcepts":[{"name":"","coreKnowledge":[{"name":"","cognitiveLevel":"理解","isKeyPoint":true,"isDifficulty":false,"specificConcepts":[""],"suggestedQuestionTypes":[""],"relatedChapters":[""],"testPriority":1}]}]}],"crossChapterLinks":[{"from":"","to":"","relation":"前置|并列|拓展|应用"}]}`;for(let b=0;b<3;b++)try{const Q=await n(R,{taskType:b>=1?"blueprint":"analysis",temperature:.1,retries:0,forceJson:!0}),j=await s(Q,Te=>n(Te,{taskType:"analysis",temperature:.1}),`第二步-尝试${b+1}`);if(j.knowledgeGraph&&j.knowledgeGraph.length||j.knowledgePoints&&j.knowledgePoints.length){const Te=(j.knowledgePoints||[]).filter(Ke=>typeof Ke=="string"&&Ke.trim()),tt=(j.keyDifficulties||[]).filter(Ke=>typeof Ke=="string"&&Ke.trim());c={knowledgePoints:Te,keyDifficulties:tt,knowledgeGraph:j.knowledgeGraph||[],crossChapterLinks:j.crossChapterLinks||[]},console.log(`✅ 知识图谱构建成功（尝试${b+1}次）`);break}throw new Error("解析结果缺少必要字段")}catch(Q){console.warn(`知识图谱构建尝试${b+1}失败:`,Q.message)}if(!c.knowledgePoints.length&&!c.knowledgeGraph.length)throw new Error(`知识图谱构建失败：AI 连续 3 次返回无效结果。
可能原因：模型响应异常、网络不稳定、或教材内容超出模型处理能力。
建议：减少所选章节数量后重试，或检查网络连接。`);return{knowledgePoints:(c.knowledgePoints||[]).filter(b=>typeof b=="string"&&b.trim()),keyDifficulties:(c.keyDifficulties||[]).filter(b=>typeof b=="string"&&b.trim()),knowledgeGraph:Array.isArray(c.knowledgeGraph)?c.knowledgeGraph:[],crossChapterLinks:Array.isArray(c.crossChapterLinks)?c.crossChapterLinks:[]}},yn=(e,t,n,s)=>{var a;const r={category:"生成-资料类型结构",subject:t,stage:n,genType:e};r.specialSubType="new_standard";const o=Y(r);if(o.length>0){const c=o[0];return!c.subject&&!c.stage&&(t||n)&&console.warn(`[structure-fallback] 「${e}」资料类型结构使用了通用兜底（无学科/学段），建议为 subject="${t}" stage="${n}" 补充专属结构大纲条目。当前匹配: ${c.id}`,c),(c.content||"").replace(/^结构参考[：:]\s*\n?/i,"").trim()}return((a=Gn[e])==null?void 0:a.structure)||""},is=(e,t,n=30)=>{var o;let s="";if(((o=e==null?void 0:e.knowledgeGraph)==null?void 0:o.length)>0){let a=0,c=0;const v=[];for(const S of e.knowledgeGraph){v.push(`📌 ${S.unit||""}`);for(const d of S.bigConcepts||[]){v.push(`  ├─ ${d.name}`);for(const R of d.coreKnowledge||[])a++,a<=n&&(v.push(`  │  ├─ ${R.name}【${R.cognitiveLevel||R.level||"理解"}】`),(R.specificConcepts||[]).forEach(F=>{v.push(`  │  │  └─ ${F}`)}),c++)}}return s=v.join(`
`),a>n&&(s+=`
  ...（共${a}个核心知识点，显示前${c}个，完整覆盖请参考教材原文）`),s}const r=[...new Set((t||[]).flatMap(a=>(a.knowledgePointsForTest||[]).map(c=>typeof c=="string"?c:c.name)).filter(Boolean))];return r.length>0&&(s=`📌 教材知识覆盖（非穷举）
`+r.slice(0,n).map(c=>`  ├─ ${c}`).join(`
`),r.length>n&&(s+=`
  ...（共${r.length}个知识点，显示前${n}个）`)),s};function oc(){const e=Rt(!1),t=Rt(0),n=Rt(""),s=Rt(null),r=Rt(0),o=Rt(0),a=Rt(null);let c=null,v=null,S=null,d=null,R=null,F=null,ke=null,b=!1;const Q={},j={},Te={exam:["综合检测","单元测试卷","学业测评"],practice:["课堂练习","随堂巩固","课时训练"],special:["专项突破","专题训练","强化练习"],preview:["预习导航","课前导学","预习单"],reading:["阅读理解","阅读训练","阅读闯关"],summary:["知识梳理","学习总结","知识归纳"],dictation:["默写训练","默写练习","默写检测"],errorbook:["错题整理","错题集","纠错练习"]},tt=(h,u="_all_")=>{const i=Te[h]||["练习题"],p=`${h}__${u}`;return Q[p]=(Q[p]||0)%i.length,i[Q[p]++]},Ke=h=>{var p;const u=[],i=(h==null?void 0:h.knowledgeGraph)||[];for(const P of i)if((p=P.bigConcepts)!=null&&p.length)for(const m of P.bigConcepts){const $=(m.coreKnowledge||[]).map(g=>typeof g=="string"?g:(g==null?void 0:g.name)||"").filter(Boolean);if($.length===0)continue;const w=/part|lesson|unit|课时|let'?s|story|read|write|spell|grammar|project/i.test(m.name||"");u.push({id:`period_${u.length+1}`,unitName:P.unit||"",periodName:w?m.name:`第${u.length+1}课时`,knowledgePoints:$,kpCount:$.length,_bigConcept:m,_unit:P})}if(u.length>1){const P=[];let m=null;for(const $ of u)$.kpCount<2?m?(m.knowledgePoints=[...m.knowledgePoints,...$.knowledgePoints],m.kpCount=m.knowledgePoints.length,m.periodName=`${m.periodName} + ${$.periodName}`):m={...$}:(m&&($.knowledgePoints=[...m.knowledgePoints,...$.knowledgePoints],$.kpCount=$.knowledgePoints.length,$.periodName=`${m.periodName} + ${$.periodName}`,m=null),P.push($));if(m)if(P.length>0){const $=P[P.length-1];$.knowledgePoints=[...$.knowledgePoints,...m.knowledgePoints],$.kpCount=$.knowledgePoints.length,$.periodName=`${$.periodName} + ${m.periodName}`}else P.push(m);return P}return u},We=async(h,u,i=null)=>{var m;const p=Date.now(),P=i||h*2;for(console.log(`⏰ 开始智能等待：基础${h/1e3}秒，最多${P/1e3}秒`),await new Promise($=>setTimeout($,h/2));Date.now()-p<P;){if((m=s.value)!=null&&m.signal.aborted)return console.log("🔧 智能等待被取消"),!1;if(u&&u()){const $=Date.now()-p;return console.log(`✅ 状态就绪，提前结束等待（已等待${$/1e3}秒，节省${(h-$)/1e3}秒）`),!0}await new Promise($=>setTimeout($,500))}return console.log(`⏰ 达到最大等待时间（${P/1e3}秒），继续执行`),!1},nt=h=>{if(!h)return 0;const u=(h.match(/[\u4e00-\u9fa5]/g)||[]).length,i=h.replace(/[\u4e00-\u9fa5]/g,"").length;return Math.ceil(u/1.5+i/4)},ne=async(h,u={})=>{var Ce,Je,Se,je,Le,ie,C,z,l,we,he,G,ce,Fe,le,M,L,X,_,I,ye,H,B,be,fe,lt,ve;const i=u.taskType||"generation";if(i==="analysis"&&console.log(`🔍 callAI [${i}] 调用参数:`,{timeout:u.timeout,maxTokens:u.maxTokens,temperature:u.temperature,promptLength:(h==null?void 0:h.length)||0}),!u.skipAbortCheck&&e.value&&((Ce=s.value)!=null&&Ce.signal.aborted))throw new Error("生成已取消");const p=await Qt(i,{promptLength:(h==null?void 0:h.length)||0}),P=p.textModel||p.model||"AI",m=pn(P),$=u.maxTokens||p.maxTokens||4096;i==="analysis"&&console.log(`🔍 解析后 maxTokens = ${$} (来源: ${u.maxTokens?"options":p.maxTokens?"config(task)":"fallback(4096)"})`);const w=u.timeout||12e4,g=nt(h),x=/(32b|70b|72b)/i.test(p.textModel||p.model||"")?6e5:3e5,J=Math.min(w+g/1e3*3e4,x);g>5e3&&console.log(`⏰ 动态超时设置: ${J/1e3}秒 (prompt: ${g} tokens, 基础: ${w/1e3}秒)`);const U=u.retries??2,D=u.temperature??p.temperature??.7;let N=h;const q=nt(h),O=p.engine==="deepseek"?1e5:Math.floor($*.7);if(q>O){console.warn(`⚠️ Prompt过长(${q} tokens)，正在智能压缩...`);const ge=N.split(/\n(?=【)/);let ue=[],Ye=[];for(const He of ge)He.startsWith("【教材原文")||He.startsWith("【模板参考")||He.startsWith("【教材参考")?Ye.push(He):ue.push(He);let Qe=ue.join(`
`),ht=nt(Qe);const st=O-ht-200;if(st>500){let He="",ut=0;for(const Xe of Ye){const et=Xe.split(new RegExp("(?<=[。！？\\n])"));let se="";for(const xe of et){const rt=nt(xe);if(ut+rt>st)break;se+=xe,ut+=rt}se&&(He+=se+`
`)}N=Qe+`
`+He,console.log(`📦 智能压缩完成：指令${ht}tokens + 原文${ut}tokens = ${ht+ut}tokens`)}else N=Qe.substring(0,Math.floor(O*1.5)),console.warn(`⚠️ 指令部分已占${ht}tokens，无法容纳原文，仅保留指令`)}let de=null;for(let ge=0;ge<=U;ge++)try{if(p.engine==="ollama"&&ge===0&&(console.log(`🔍 文本分析 [${i}]：检测模型...`),await $e(null,3,"text"),await new Promise(ue=>setTimeout(ue,2e3))),ge>0){const ue=p.engine==="ollama"?5e3:Math.min(2e3*Math.pow(2,ge-1),1e4);console.log(`🔄 文本分析 [${i}] 第${ge}次重试，等待 ${ue/1e3} 秒...`),await new Promise(Ye=>setTimeout(Ye,ue)),(n==null?void 0:n.value)!==void 0&&(n.value=`🔄 正在重试 [${m}]...（第${ge}次）`)}if(p.engine==="ollama"){if(ge===0)try{await kt.get(`${p.baseUrl}/api/tags`,{timeout:5e3})}catch(He){throw console.warn(`⚠️ Ollama 连接失败(${He.message})，请确认 Ollama 已启动`),new Error(`Ollama 服务不可用：${He.message}。请启动 Ollama 后重试。`)}const ue=await kt.post(`${p.baseUrl}/api/generate`,{model:p.textModel,prompt:N,stream:!1,keep_alive:600,...u.forceJson&&!((Je=p.textModel)!=null&&Je.includes("r1"))&&!((Se=p.textModel)!=null&&Se.includes("deepseek"))?{format:"json"}:{},options:{temperature:D,num_predict:$,top_p:Pn.generationSettings.topP||.9,repeat_penalty:Pn.generationSettings.repeatPenalty||1.1,...(je=p.textModel)!=null&&je.includes("r1")||(Le=p.textModel)!=null&&Le.includes("deepseek")?{num_ctx:4096,num_gpu:999}:{}}},{timeout:J,signal:(ie=s.value)==null?void 0:ie.signal});let Ye=ue.data.done,Qe=ue.data.response||"";const ht=u.allowContinuation!==!1,st=!Ye&&Qe.length>10;if(st&&ht){console.log(`🔄 Ollama 输出被截断，尝试续写...（当前长度：${Qe.length}）`);const He=Qe.slice(-300),ut=`【继续】请从上一次输出的最后一个字开始，继续后面的内容。不要重复已有文字。

上一段末尾：${He}

继续：`;let Xe;try{Xe=await kt.post(`${p.baseUrl}/api/generate`,{model:p.textModel,prompt:ut,stream:!1,options:{temperature:Math.max(0,D-.2),num_predict:Math.floor($*.5),top_p:.9,repeat_penalty:1.2}},{timeout:Math.floor(J*.6),signal:(C=s.value)==null?void 0:C.signal});const et=Xe.data.response||"";if(et&&et.length>5){let se=et;const xe=He.slice(-20);if(se.startsWith(xe))se=se.slice(xe.length);else{let rt=!1;for(let Tt=15;Tt>=3;Tt--){const Yt=He.slice(-Tt);if(se.startsWith(Yt)){se=se.slice(Tt),rt=!0,console.log(`🔧 找到重叠(长度${Tt})，已去除`);break}}if(!rt&&se.length>30){const Tt=se.indexOf(`
`);if(Tt>0&&Tt<30){const Yt=se.slice(Tt+1).trim();Yt.length>5&&(se=Yt,console.log("🔧 取换行后内容作为续写"))}}}se.trim().length<3?console.warn("⚠️ 续写内容过短，使用原输出"):(Qe+=se,console.log(`✅ 续写完成，总长度：${Qe.length}`))}else console.warn("⚠️ 续写返回内容过短，使用原输出")}catch(et){console.warn("⚠️ 续写请求失败，使用原输出:",et.message)}}else st&&!ht&&console.warn(`⚠️ Ollama 输出被截断但已禁用续写，长度=${Qe.length}`);return Qe=Er(Qe),Qe}else{let ue=p.baseUrl||"";if(!ue)throw new Error("DeepSeek API 地址未配置，请在设置中填写 API 地址");if(ue.includes("/chat/completions")?console.warn("⚠️ baseUrl 已包含完整路径，直接使用"):ue.endsWith("/v1")?ue=`${ue}/chat/completions`:ue=`${ue.replace(/\/$/,"")}/v1/chat/completions`,console.log(`🔗 DeepSeek API URL: ${ue}`),hn.isOpen){const xe=Math.ceil((hn.lastFailTime+hn.cooldownMs-Date.now())/1e3);throw new Error(`DeepSeek 服务暂时熔断中，请 ${Math.max(1,xe)} 秒后重试`)}const Ye=[];u.systemMessage&&Ye.push({role:"system",content:u.systemMessage}),Ye.push({role:"user",content:N});const Qe={model:p.model,messages:Ye,temperature:D,max_tokens:$,top_p:Pn.generationSettings.topP||.9,stream:!0,...u.forceJson?{response_format:{type:"json_object"}}:{}};let ht;try{ht=await fetch(ue,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${p.apiKey}`},body:JSON.stringify(Qe),signal:(z=s.value)==null?void 0:z.signal})}catch(xe){throw await Pr(xe,null)}if(!ht.ok){const xe=await Pr(null,ht);throw ht.status>=500&&hn.fail(),xe}hn.success();const{content:st,finishReason:He}=await di(ht,(l=s.value)==null?void 0:l.signal);let ut=st,Xe=He;const et=u.allowContinuation!==!1,se=Xe==="length"&&ut.length>10;if(se&&et){console.log(`🔄 DeepSeek 输出被截断，尝试续写...（当前长度：${ut.length}）`);const xe=ut.slice(-300),rt=[{role:"user",content:N},{role:"assistant",content:ut},{role:"user",content:`请从上一次输出的最后一个字开始，继续后面的内容。不要重复已有文字，不要重新开始。
上一段末尾：${xe}`}];try{const Tt=await fetch(ue,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${p.apiKey}`},body:JSON.stringify({model:p.model,messages:rt,temperature:Math.max(0,D-.2),max_tokens:Math.floor($*.5),top_p:.9,stream:!1}),signal:(we=s.value)==null?void 0:we.signal});if(Tt.ok){const rn=((ce=(G=(he=(await Tt.json()).choices)==null?void 0:he[0])==null?void 0:G.message)==null?void 0:ce.content)||"";if(rn&&rn.length>5){let pt=rn;const Oe=xe.slice(-20);if(pt.startsWith(Oe))pt=pt.slice(Oe.length);else{let ot=!1;for(let Re=15;Re>=3;Re--){const mt=xe.slice(-Re);if(pt.startsWith(mt)){pt=pt.slice(Re),ot=!0,console.log(`🔧 找到重叠(长度${Re})，已去除`);break}}if(!ot&&pt.length>30){const Re=pt.indexOf(`
`);if(Re>0&&Re<30){const mt=pt.slice(Re+1).trim();mt.length>5&&(pt=mt,console.log("🔧 取换行后内容作为DeepSeek续写"))}}}pt.trim().length<3?console.warn("⚠️ DeepSeek续写内容过短，使用原输出"):(ut+=pt,console.log(`✅ DeepSeek 续写完成，总长度：${ut.length}`))}else console.warn("⚠️ DeepSeek 续写返回内容过短，使用原输出")}else console.warn("⚠️ DeepSeek 续写请求失败(status="+Tt.status+")，使用原输出")}catch(Tt){console.warn("⚠️ DeepSeek 续写请求失败，使用原输出:",Tt.message)}}else se&&!et&&console.warn(`⚠️ DeepSeek 输出被截断但已禁用续写，长度=${ut.length}`);return ut=Er(ut),ut}}catch(ue){if(de=ue,((Fe=ue.response)==null?void 0:Fe.status)===429){const Ye=parseInt((le=ue.response.headers)==null?void 0:le["retry-after"])||5;console.warn(`⏳ 限流(429)，等待${Ye}秒...`),await new Promise(Qe=>setTimeout(Qe,Ye*1e3))}else{if(((M=ue.response)==null?void 0:M.status)===401)throw console.error("🔑 DeepSeek API Key 无效(401)"),new Error("DeepSeek API Key 无效，请在设置中重新配置");if(((L=ue.response)==null?void 0:L.status)===402)throw console.error("💰 DeepSeek 余额不足(402)"),new Error("DeepSeek 账户余额不足，请充值后重试");if(((X=ue.response)==null?void 0:X.status)===500){console.error("💥 AI 服务器内部错误(500)");const Ye=((I=(_=ue.response.data)==null?void 0:_.error)==null?void 0:I.message)||ue.message||"未知错误";console.error("   错误详情:",Ye);let Qe="请稍后重试";throw Ye.toLowerCase().includes("model")?Qe="模型可能未加载，请检查 Ollama 服务状态":Ye.toLowerCase().includes("memory")||Ye.toLowerCase().includes("oom")?Qe="显存不足，请关闭其他应用或重启 Ollama":Ye.toLowerCase().includes("timeout")&&(Qe="请求超时，请检查网络连接"),new Error(`AI 服务错误: ${Qe}`)}else if(((ye=ue.response)==null?void 0:ye.status)===503||((H=ue.response)==null?void 0:H.status)===502)console.warn(`🌐 DeepSeek 服务暂时不可用(${ue.response.status})，重试中...`);else if(ue.code==="ECONNABORTED")console.warn(`⏰ callAI [${i}] 超时(${J/1e3}秒)，尝试${ge+1}/${U+1}`);else{if(ue.code==="ECONNREFUSED"||ue.code==="ENOTFOUND")throw console.error(`🌐 无法连接到 ${p.engine} 服务(${ue.code})`),new Error(`无法连接到 ${p.engine} 服务，请检查网络和配置`);if(ue.code==="ECONNRESET")throw console.warn("🌐 连接被重置，可能是网络不稳定"),new Error("网络连接不稳定，请检查网络后重试");if((B=ue.message)!=null&&B.includes("JSON")||(be=ue.message)!=null&&be.includes("parse"))throw console.warn("📝 JSON 解析失败"),new Error("AI 返回格式异常，请重试或联系技术支持");if((fe=ue.message)!=null&&fe.includes("aborted")||(lt=ue.message)!=null&&lt.includes("取消"))return console.log("🛑 请求已取消"),null;if((ve=ue.message)!=null&&ve.includes("Ollama 服务不可用"))throw ue;console.warn(`❌ callAI [${i}] 失败(${ue.message})，尝试${ge+1}/${U+1}`)}}if(ge>=U)throw ue}throw de},wt=async()=>{try{const h=await Fn(),u=await fetch(`${h.baseUrl}/api/ps`,{method:"GET",headers:{"Content-Type":"application/json"},signal:AbortSignal.timeout(5e3)});if(!u.ok)return!1;const i=await u.json(),P=((i==null?void 0:i.models)||[]).some(m=>m.name===h.model);return console.log(`📊 模型状态: ${h.model} - ${P?"已在内存":"未加载"}`),P}catch(h){return console.warn("⚠️ 无法检查模型状态:",h.message),!1}},$e=async(h,u=3,i="multimodal")=>{var x,ee,J,U;console.log(`🔍 开始检测${i==="multimodal"?"多模态":"文本"}模型就绪状态...`);const p=Date.now(),P=6e5;let m=1e3,$=0,w=null;const g={multimodal:{psTimeout:5e3,warmupTimeout:2e4,callAITimeout:15e3},text:{callAITimeout:18e4}};for(;Date.now()-p<P;){$++;try{if(i==="multimodal"){const D=await Fn();if(D.engine==="paddleocr_vl")return console.log("✅ PaddleOCR-VL pipeline 模式，跳过 HTTP 检测"),{ready:!0,responseTime:0,attempts:1};$===1&&console.log(`📡 尝试连接多模态模型: ${D.model} @ ${D.baseUrl}`);const N=new AbortController,q=setTimeout(()=>N.abort(),g.multimodal.psTimeout),O=await fetch(`${D.baseUrl}/api/ps`,{method:"GET",signal:N.signal});if(clearTimeout(q),!O.ok)throw new Error(`HTTP ${O.status}`);if(((await O.json()).models||[]).some(Se=>Se.name===D.model||Se.model===D.model)){const Se=Date.now()-p;return console.log(`✅ 多模态模型已在内存中 (等待${Se}ms, 尝试${$}次)`),{ready:!0,responseTime:Se,attempts:$}}else{console.log(`⚠️ 模型未加载，尝试发送预热请求（超时: ${g.multimodal.warmupTimeout/1e3}秒）...`);const Se=new AbortController,je=setTimeout(()=>Se.abort(),g.multimodal.warmupTimeout),Le="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";try{const ie=await fetch(`${D.baseUrl}/api/chat`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:D.model,messages:[{role:"user",content:"OK",images:[Le]}],stream:!1,options:{num_predict:5,temperature:.1}}),signal:Se.signal});if(clearTimeout(je),ie.ok){const C=await ie.json(),z=((x=C.message)==null?void 0:x.content)||C.response||"";if(z&&z.trim().length>0){const l=Date.now()-p;return console.log(`✅ 多模态模型预热成功 (等待${l}ms, 尝试${$}次)`),{ready:!0,responseTime:l,attempts:$}}}else if(ie.status===500){if(console.warn("⚠️ 预热请求返回 HTTP 500，模型可能正在初始化或GPU资源不足"),(ee=window.electronAPI)!=null&&ee.getOllamaGpuStatus)try{const C=await window.electronAPI.getOllamaGpuStatus();console.warn(`💻 GPU状态: ${C.status}, 显存使用: ${C.memoryUsage||"未知"}`)}catch{}}else console.warn(`⚠️ 预热请求返回 HTTP ${ie.status}，模型可能正在加载中`)}catch(ie){clearTimeout(je),console.warn(`⚠️ 预热请求失败: ${ie.message}，模型可能正在加载中`),ie.name==="AbortError"?console.warn("⚠️ 预热请求超时，模型可能需要更长时间加载，请检查系统资源"):ie.message.includes("fetch")&&console.warn("⚠️ 网络连接问题，请确认Ollama服务是否正常运行")}console.log(`⚠️ 第${$}次尝试：模型未就绪`)}}else{const D=await Qt("generation");if(D.engine==="ollama"){console.log(`📡 发送 Ollama 文本模型测试请求（超时: ${g.text.callAITimeout/1e3}秒）...`);try{const N=new AbortController,q=setTimeout(()=>N.abort(),g.text.callAITimeout),O=await fetch(`${D.baseUrl}/api/generate`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:D.textModel,prompt:"OK",stream:!1,options:{temperature:.1}}),signal:N.signal});if(clearTimeout(q),!O.ok)throw new Error(`HTTP ${O.status}`);const de=await O.json();if(de.response&&de.response.trim().length>0){const Ce=Date.now()-p;return console.log(`✅ Ollama 文本模型响应正常 (等待${Ce}ms, 尝试${$}次)`),{ready:!0,responseTime:Ce,attempts:$}}else console.log(`⚠️ 第${$}次尝试返回空响应`)}catch(N){console.warn(`⚠️ 文本模型检测失败: ${N.message}`)}}else if(D.engine==="deepseek"){console.log("📡 测试 DeepSeek API 连接...");try{const N=new AbortController,q=setTimeout(()=>N.abort(),g.text.callAITimeout);let O=D.baseUrl;O.includes("/chat/completions")?console.warn("⚠️ baseUrl 已包含完整路径，直接使用"):O.endsWith("/v1")?O=`${O}/chat/completions`:O=`${O.replace(/\/$/,"")}/v1/chat/completions`,console.log(`🔗 DeepSeek API URL: ${O}`),console.log(`📋 检测模型: ${D.model}`);let de=0;const Ce=await fetch(O,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${D.apiKey.trim()}`},body:JSON.stringify({model:D.model,messages:[{role:"user",content:'请回复"OK"'}],temperature:.1,max_tokens:256,stream:!1}),signal:N.signal});if(clearTimeout(q),Ce.ok){const Je=await Ce.json(),Se=((U=(J=Je.choices)==null?void 0:J[0])==null?void 0:U.message)||{},je=Se.content||"",Le=Se.reasoning_content||"";if(je&&je.trim().length>0||Le){const ie=Date.now()-p;return console.log(`✅ DeepSeek API 连接正常 (等待${ie}ms, 尝试${$}次)`),{ready:!0,responseTime:ie,attempts:$}}else if(de++,console.warn(`⚠️ 第${$}次尝试返回空响应 (连续${de}次)`),console.warn(`📋 响应体预览: ${JSON.stringify(Je).substring(0,500)}`),de>=5){const ie=Date.now()-p;return console.error(`❌ DeepSeek 连续${de}次返回空响应，已熔断。`),console.error("   可能原因：1) 模型名无效  2) API余额不足  3) 模型不支持短提示"),{ready:!1,responseTime:ie,attempts:$,error:new Error(`DeepSeek连续${de}次空响应，请检查模型名(${D.model})和API余额`)}}}else{const Je=await Ce.text();if(console.warn(`⚠️ DeepSeek API 返回 HTTP ${Ce.status}: ${Je.substring(0,200)}`),Ce.status===400)return console.error("❌ DeepSeek API 配置错误（400），请检查："),console.error("   1. API密钥是否正确"),console.error("   2. 模型名称是否正确（应该是 deepseek-v4-pro）"),console.error("   3. API地址是否正确（应该是 https://api.deepseek.com/v1）"),{ready:!1,responseTime:Date.now()-p,attempts:$,error:new Error("DeepSeek API配置错误（HTTP 400），请检查设置")};console.log(`⚠️ 第${$}次尝试失败`)}}catch(N){clearTimeout(timeoutId),console.warn(`⚠️ DeepSeek API 检测失败: ${N.message}`),N.name==="AbortError"?console.warn("⚠️ DeepSeek API 请求超时，请检查网络连接"):N.message.includes("fetch")&&console.warn("⚠️ 无法连接到 DeepSeek API，请检查网络或API地址")}}else console.warn(`⚠️ 未知的文本引擎: ${D.engine}`)}}catch(D){w=D,($<=3||$%10===0)&&console.warn(`⚠️ 第${$}次检测失败: ${D.message}`),$>3&&(m=Math.min(m*1.5,3e3))}await new Promise(D=>setTimeout(D,m))}const T=Date.now()-p;return console.error(`❌ 模型未在${T}ms内就绪 (总尝试次数: ${$})`),w&&(console.error(`最后错误: ${w.message}`),console.error("错误堆栈:",w.stack)),{ready:!1,responseTime:T,attempts:$,error:w}},Ge=async(h=2e3,u=8e3)=>{var w,g;const p=Date.now()-r.value;if(p<0){console.warn(`⚠️ 检测到异常：上次请求时间戳在未来，强制等待${u}ms`),await new Promise(T=>setTimeout(T,u));return}console.log("🔍 实际检测模型就绪状态...");try{const T=await Fn(),x=await fetch(`${T.baseUrl}/api/ps`,{signal:AbortSignal.timeout(3e3)});if(x.ok){const ee=await x.json(),J=T.model,U=(w=ee.models)==null?void 0:w.find(D=>D.name===J||D.model===J);if(U)if(U.expires_at&&new Date(U.expires_at).getTime()>Date.now()){if(console.log("⏰ 模型仍在处理中，需要等待..."),p>2e4){console.warn("⚠️ 模型繁忙超过20秒，尝试强制卸载并重新加载...");try{await fetch(`${T.baseUrl}/api/generate`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:J,keep_alive:0})}),console.log("✅ 模型已卸载，等待3秒后重新加载..."),await new Promise(N=>setTimeout(N,3e3)),await fetch(`${T.baseUrl}/api/chat`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:J,messages:[{role:"user",content:"hi"}],stream:!1})}),console.log("✅ 模型已重新加载");return}catch(N){console.warn("⚠️ 强制卸载失败:",N.message)}}}else{console.log(`✅ 模型已就绪且空闲（距上次请求${(p/1e3).toFixed(1)}秒）`);return}else console.log("⚠️ 模型不在内存中，需要重新加载")}}catch(T){console.warn(`⚠️ 无法检测模型状态: ${T.message}，使用保守等待策略`)}let P=h;if(o.value>6e4?(P=Math.max(h,15e3),console.log(`⚠️ 上次请求耗时${(o.value/1e3).toFixed(1)}秒，保守等待${P}ms`)):o.value>3e4?(P=Math.max(h,1e4),console.log(`⚠️ 上次请求耗时${(o.value/1e3).toFixed(1)}秒，保守等待${P}ms`)):o.value>15e3&&(P=Math.max(h,8e3),console.log(`⚠️ 上次请求耗时${(o.value/1e3).toFixed(1)}秒，保守等待${P}ms`)),p>=P)try{const T=await Fn(),x=await fetch(`${T.baseUrl}/api/ps`,{signal:AbortSignal.timeout(2e3)});if(x.ok){const ee=await x.json(),J=T.model,U=(g=ee.models)==null?void 0:g.find(D=>D.name===J||D.model===J);if(U&&!U.expires_at){console.log("✅ 二次确认：模型已空闲");return}}}catch{}const m=P-p,$=Math.min(m,u);$>0?(console.log(`⏰ 智能等待模型空闲：${$}ms（距上次请求${p}ms）`),await new Promise(T=>setTimeout(T,$))):console.log("✅ 模型已空闲，无需等待")},_e=async(h,u,i={})=>{var m,$;if(!i.skipAbortCheck&&((m=s.value)!=null&&m.signal.aborted))throw console.warn("callMultimodalAI 检测到已取消，中止调用"),new Error("已取消");const P=(i.taskType||"extraction")==="extraction"?"pipeline":"chat";if(!u)return console.error("callMultimodalAI: imageBase64 为空"),"";if(!h)return console.error("callMultimodalAI: prompt 为空"),"";if(!(($=window.electronAPI)!=null&&$.paddleOcrVLChat))return console.error("PaddleOCR-VL API 不可用"),"";try{console.log(`${P==="chat"?"VLM":"OCR"} 调用 PaddleOCR-VL (${P} 模式)`);const w=await window.electronAPI.paddleOcrVLChat(h,[u],{mode:P,maxTokens:P==="chat"?i.maxTokens||256:void 0});return w.success&&w.text?(console.log(`PaddleOCR-VL 完成: ${w.total_length||w.text.length}字`),w.text):(console.error(`PaddleOCR-VL 失败: ${w.error||"无文字返回"}`),"")}catch(w){return console.error(`PaddleOCR-VL 调用异常: ${w.message}`),""}},gt=async(h,u={})=>{var T;const{subject:i="",stage:p="",imagePath:P=""}=u;let m="单栏";if(P&&((T=window.electronAPI)!=null&&T.splitColumns))try{const ee=`${Ys()}/暂存区/_columns_${Date.now()}`,J=await window.electronAPI.splitColumns(P,ee);if(J.columns>1){m=`${J.columns}栏`,console.log(`📐 检测到${m}排版（切割点: ${(J.splits||[]).join(", ")}），等待用户确认切割`);try{await window.electronAPI.deleteDirectory(ee)}catch{}return{text:"",ocrQuality:"pending_column_split",columnType:m,splits:J.splits||[],subImages:J.sub_images||[],imagePath:P,originalBase64:h}}}catch(x){console.warn("⚠️ 栏检测失败，按单栏处理:",x.message)}const $=[`请逐字逐句提取图片中的所有文字。

要求：
1. 只输出原文，不要任何解释、描述、总结
2. 保留所有格式：换行、空格、标点、题号、选项（A.B.C.D.）
3. 过滤无关内容：水印、纯页码、装饰符号
4. 保留有价值内容：章节标题、知识点注释、公式、表格
5. 不确定时加【？】标记，不要猜测

直接输出识别的文字：`,"请识别并输出图片中的所有文字内容。"];let w="";for(let x=0;x<$.length;x++)try{if(w=await _e($[x],h,{taskType:"extraction",maxRetries:1,imagePath:P}),w&&w.trim().length>=50)break;x<$.length-1&&console.log(`⚠️ 单栏 prompt${x+1}提取不足(${(w==null?void 0:w.length)||0}字)，尝试简化prompt...`)}catch(ee){console.warn(`⚠️ 单栏 prompt${x+1}失败:`,ee.message)}if(w&&w.trim()==="DIM"){console.warn("⚠️ OCR 返回 DIM（图片模糊），尝试最后一次降级提取...");try{w=await _e('这张图片可能有些模糊，请尽力提取其中可见的文字。如果确实一个字也看不清，回复"DIM"。不要解释。',h,{taskType:"extraction",maxRetries:0,imagePath:P})}catch(x){console.warn("DIM降级提取也失败了:",x.message)}}w&&i&&(w=os(w,i,p));const g=Pe(w,i);return{text:w||"",ocrQuality:g.quality,columnType:m}},ct=async(h,u={})=>{const{subject:i="",stage:p="",onProgress:P=null,onPageComplete:m=null}=u,$=3,w=50;console.log(` PaddleOCR-VL ${h.length}`);let g="";const T={totalPages:h.length,successPages:0,failedPages:0,retryPages:0,pageDetails:[]};console.log(`
 ${h.length}`),console.log(`${$}${w}
`);for(let x=0;x<h.length;x++){const ee=h[x],J=ee.pageNum;let U="",D=0,N=!1;for(;D<$&&!N;)try{D>0&&(console.log(`${J}${D}...`),await new Promise(de=>setTimeout(de,3e3))),U=await _e(`请逐字逐句提取图片中的所有文字。

要求：
1. 只输出原文，不要任何解释、描述、总结
2. 保留所有格式：换行、空格、标点、题号、选项（A.B.C.D.）
3. 过滤无关内容：水印、纯页码、装饰符号
4. 保留有价值内容：章节标题、知识点注释、公式、表格
5. 不确定时加【？】标记，不要猜测

直接输出识别的文字：`,ee.imageBase64,{taskType:"extraction",maxRetries:0,timeout:12e4,imagePath:ee.imagePath}),U&&U.trim().length>=w?(N=!0,console.log(`✅ 第${J}页：OCR成功 (${U.trim().length}字)`)):(console.warn(`⚠️ 第${J}页：结果过短(${(U==null?void 0:U.trim().length)||0}字)，需要重试`),D++)}catch(O){console.error(`❌ 第${J}页：OCR调用失败 - ${O.message}`),D++}const q={pageNum:J,success:N,retryCount:D,textLength:(U==null?void 0:U.trim().length)||0};N?(i&&(U=os(U,i,p)),g+=(g?`
`:"")+U,T.successPages++,D>0&&T.retryPages++,console.log(`📝 第${J}页：已合并 (累计${g.length}字)`),m&&m(J,U.trim().length)):(T.failedPages++,console.error(`🚨 第${J}页：完全失败（已重试${$}次）`),g+=(g?`
`:"")+`
⚠️[系统错误：第${J}页OCR识别失败，请对照原始PDF手动补充此部分内容]
`),T.pageDetails.push(q),P&&P(x+1,h.length)}return console.log(`
✅ 批量提取完成：成功${T.successPages}页 | 失败${T.failedPages}页 | 重试${T.retryPages}页`),console.log(`📊 总字数：${g.length}
`),{text:g,qualityReport:T}},Ze=async(h,u={})=>{var m;const{subject:i="",stage:p=""}=u,P=[];console.log(`
📐 手动多栏检测：共${h.length}页`);for(const $ of h){const w=$.pageNum;if(!$.imagePath||!((m=window.electronAPI)!=null&&m.splitColumns)){console.warn(`⚠️ 第${w}页：缺少 imagePath 或 splitColumns API，跳过`);continue}try{const T=`${Ys()}/暂存区/_columns_${Date.now()}_${w}`,x=await window.electronAPI.splitColumns($.imagePath,T);try{await window.electronAPI.deleteDirectory(T)}catch{}x.columns>1&&(P.push({page:w,ocrResult:{ocrQuality:"pending_column_split",columnType:`${x.columns}栏`,splits:x.splits||[],subImages:x.sub_images||[]},imageBase64:$.imageBase64,imagePath:$.imagePath,subject:i,stage:p}),console.log(`📐 第${w}页：检测到${x.columns}栏排版`))}catch(g){console.warn(`⚠️ 第${w}页：栏检测失败: ${g.message}`)}}return console.log(`📐 多栏检测完成：${P.length}个多栏页面`),P},Pe=(h,u)=>{if(!h||h.trim().length<5)return{quality:"poor",reason:"文字过少"};const i=h.trim();if(i.length<200)return{quality:"warning",reason:`文字过少(${i.length}字)，可能不完整或非原文内容`};const p=(i.match(/[\u4e00-\u9fa5]/g)||[]).length,P=i.replace(/\s/g,"").length,m=P>0?p/P:0;if(u!=="英语"&&m<.3)return{quality:"poor",reason:`中文字符比例过低(${(m*100).toFixed(0)}%)`};const $=/[□■◆◇○●△▲▽▼☆★♡♥]/g,w=(i.match($)||[]).length;return w>i.length*.05?{quality:"warning",reason:`可能存在识别错误(${w}个异常字符)`}:{quality:"good",reason:"正常"}},Ve=(h,u)=>{if(!h||h.trim().length<5)return{valid:!1,reason:"文字过少"};const i=h.trim(),p=[/^这是/,/^图片中/,/^教材中/,/^该页/,/^本页是/,/^展示/,/^内容为/,/^主要为/,/^描述了/,/^介绍了/,/^这张/,/^这幅/,/^页面/,/^课文/,/^本课/,/^这一页/,/^这部分/,/图片展示/,/内容包含/,/主要讲/];for(const P of p)if(P.test(i))return{valid:!1,reason:`疑似AI描述而非原文（匹配: ${P}）`};return i.includes("纯图片")||i==="NO_TEXT"?{valid:!0,reason:"纯图片页"}:i==="DIM"?{valid:!1,reason:"图片模糊"}:i.length<10?{valid:!1,reason:`内容过短(${i.length}字)`}:{valid:!0,reason:"正常"}},dt=async(h,u,i,p,P="",m={})=>{const $=m.title&&/小结|总结|整理|复习|回顾|知识归纳/.test(m.title),w=m.hasChildren&&m.pageCount<=2&&!$;let g="",T=0;const x=3;for(;T<x;){T++,console.log(`🔄 OCR尝试 ${T}/${x}...`),g=await _e(`请逐字逐句提取图片中的所有文字。

要求：
1. 只输出原文，不要任何解释、描述、总结
2. 保留所有格式：换行、空格、标点、题号、选项（A.B.C.D.）
3. 过滤无关内容：水印、纯页码、装饰符号
4. 保留有价值内容：章节标题、知识点注释、公式、表格
5. 不确定时加【？】标记，不要猜测
6. 图片模糊看不清 → 输出"DIM"
7. 无文字 → 输出"NO_TEXT"
8. 忽略拼音注音（如 zhǎn, dú 等），只提取汉字和标点

直接输出识别的文字：`,h,{taskType:"extraction",timeout:6e5,maxRetries:1,think:!1,imagePath:P})||"",console.log(`📝 OCR返回文本长度: ${(g==null?void 0:g.length)||0}字`),g&&g.length>0&&console.log(`📝 OCR返回文本前100字: ${g.substring(0,100)}`);const J=Ve(g);if(console.log(`✅ OCR验证结果: ${J.valid?"通过":"失败"} - ${J.reason}`),J.valid){console.log(`✅ OCR成功: ${g.length}字`);break}else console.warn("⚠️ OCR验证失败，准备重试...")}Ve(g).valid||(console.warn("⚠️ 标准OCR全部失败，使用降级策略..."),g=await _e('请从这张图片中提取所有可见的文字。如果完全没有文字，只回复"无文字"。不要做任何解释。',h,{taskType:"extraction",maxRetries:0,imagePath:P})||""),g&&u&&(g=os(g,u,i));let ee=Pe(g,u);return console.log("📖 教材原文提取结果长度:",(g==null?void 0:g.length)||0,w?"(导语页)":""),!g||g.trim().length<5?(console.error("❌ 教材原文提取完全失败"),{rawText:g||"",visualDescription:"",formulas:[],coreTopics:"",knowledgePoints:[],knowledgeHierarchy:[],competency:"理解",style:"传统",ocrQuality:"poor"}):(console.log(`📖 OCR质量: ${ee.quality}`),{rawText:g,visualDescription:"",formulas:[],coreTopics:"",knowledgePoints:[],knowledgeHierarchy:[],competency:It(p)<=6?"识记与理解":"应用与分析",style:"传统",ocrQuality:ee.quality,isGuidePage:w})},De=async(h,u,i,p,P)=>{const m=`你是一位${i}${p}${u}学科专家。请从这张教材页面（章节：${P}）中，提取出最核心的知识点。
  要求：
  1. 每个知识点用一句话概括。
  2. 只提取最核心的3-5个知识点。
  3. 每行一个知识点，不要编号。

  请直接输出知识点列表，不要其他内容。`;return(await _e(m,h)).split(`
`).filter(g=>g.trim()&&!g.startsWith("【")&&!g.startsWith("输出")).map(g=>g.replace(/^[-\*•\d\.]\s*/,"").trim())},qe=async(h,u,i,p,P,m,$)=>{var ee;console.log("🧠 开始纯文本 AI 分析...");const w=P&&/小结|总结|整理|复习|回顾|知识归纳/.test(P),g=m&&$<=2&&!w;let T={visualDescription:"",formulas:[],coreTopics:"",knowledgeHierarchy:[]};try{let J=h;J.length>1e4&&console.warn(`⚠️ 原文较长（${J.length}字），将使用完整原文进行分析`);const U=g?`你是一位${i}${p}${u}教学专家。请分析以下教材导语/概述页，提取本单元的核心信息。

【导语原文】
${J}

请提取：
1. **单元主题**：本单元的人文主题或核心主题名称
2. **学习目标**：本单元的主要学习目标或核心要求（3-5条）
3. **关键知识点**：导语中明确提到的知识点或技能点，数量不限，每个必须能在导语中找到对应的原文词句作为依据
4. **语文要素/学科重点**：如果有明确的语文要素（如阅读方法、写作方法）或学科重点，请提取

返回 JSON：
{
  "visualDescription": "",
  "formulas": [],
  "coreTopics": "核心主题词，逗号分隔（3-6个）",
  "knowledgeHierarchy": [
    {
      "bigConcept": "单元主题名称",
      "coreKnowledge": [
        {
          "name": "学习目标或语文要素名称",
          "level": "理解",
          "specificConcepts": ["具体知识点1", "具体知识点2"],
          "suggestedQuestionTypes": ["适合考查的题型1", "适合考查的题型2"]
        }
      ]
    }
  ]
}

只返回 JSON。`:`你是一位${i}${p}${u}学科教学专家。请分析以下教材内容：

【教材原文】
${J}

请完成以下分析任务：

1. **图表描述**：如果有图表，用文字描述；如果没有，返回空字符串
2. **公式提取**：如果有数学/物理/化学公式，用LaTeX格式描述；如果没有，返回空数组
3. **知识点层级结构**：按"大概念 → 核心知识点 → 具体概念"三层结构提取，标注每个知识点的认知层次（识记/理解/应用/分析/评价/创造）

必须返回以下JSON格式：
{
  "visualDescription": "图表描述或空字符串",
  "formulas": ["$公式$ → 含义"],
  "coreTopics": "核心主题词，逗号分隔（3-6个，按概括层级排序）",
  "knowledgeHierarchy": [
    {
      "bigConcept": "大概念名称（如：分数的意义）",
      "coreKnowledge": [
        {
          "name": "核心知识点名称",
          "level": "识记|理解|应用|分析|评价|创造",
          "specificConcepts": ["具体概念1", "具体概念2"],
          "suggestedQuestionTypes": ["适合的题型1", "适合的题型2"]
        }
      ]
    }
  ]
}

${(()=>{const q=u||"",O=i||"",Ce=It(p||""),Je=q.includes("语文"),Se=q.includes("数学"),je=q.includes("英语"),Le=q.includes("物理"),ie=q.includes("化学"),C=q.includes("生物"),z=q.includes("科学"),l=q.includes("历史"),we=q.includes("地理"),he=q.includes("政治")||q.includes("道德")||q.includes("思想"),G=q.includes("信息"),ce=q.includes("音乐"),Fe=q.includes("美术"),le=q.includes("体育"),M=Le||ie||C||z,L=l||we||he,X=O.includes("小学"),_=O.includes("初中"),I=O.includes("高中"),ye=X&&Ce>0&&Ce<=2,H=X&&Ce>=3&&Ce<=4,B=X&&Ce>=5;return Je?`【语文学科专项提取规则——通读全文，不得遗漏任何知识内容】
- 📝 生字/生词：每个生字独立标注（如"人""口""手"），绝不合并
- 📝 多音字：标注每个读音和组词（如"长(cháng)长短/长(zhǎng)长大"）
- 📝 近义词/反义词：成对标注，注明辨析要点
- 📝 重点词语/成语/俗语/歇后语：逐词标注含义和用法
- 📝 需背诵段落/古诗/名句/文言文：标注篇名和范围
- 📝 课文内容理解：主旨、人物形象、事件脉络、道理、情感
- 📝 修辞手法：比喻、拟人、排比、夸张、反问、设问等
- 📝 标点符号用法与病句修改考点
- 📝 阅读理解考点：词语理解、句子含义、内容概括、结构分析
- 📝 写作/口语交际/综合性学习/名著导读要求
- 🔒 必须逐条标注，绝不将多个知识点合并为一条（如"生字5个"→必须拆成5条独立知识点）
${ye?`- 🔧 低段(1-2)：拼音、笔画笔顺、偏旁部首、看图写话、简单日记
`:""}${H?`- 🔧 中段(3-4)：段落大意、习作、简单修辞、观察日记
`:""}${B?`- 🔧 高段(5-6)：文言文入门、说明文阅读、读后感
`:""}${_?`- 🔧 初中：文言文实词虚词、古诗词鉴赏、议论文/说明文阅读
`:""}${I?`- 🔧 高中：文言文特殊句式、诗歌鉴赏手法、论述类/文学类文本阅读
`:""}`:Se?`【数学学科专项提取规则——通读全文，不得遗漏任何知识内容】
- 🔢 概念/定义：每个数学概念独立标注
- 🔢 公式/定理/运算法则/性质：逐条标注，注明适用条件
- 🔢 计算方法/解题步骤/证明思路：标注关键步骤
- 🔢 例题：标注考查的知识点和解题方法
- 🔢 几何图形：性质、判定、计算公式
- 🔢 统计与概率：数据收集、图表解读、概率计算
- 🔢 应用题类型与解题策略
- 🔢 数学术语/符号/单位
- 🔢 课后练习/习题中考查的题型和能力层次
- 🔒 必须逐条标注，绝不将多个知识点合并为一条
${ye?`- 🔧 低段(1-2)：数的认识、20以内加减、图形认识、口算、钟表
`:""}${H?`- 🔧 中段(3-4)：乘除法、分数初步、周长面积、简单应用题
`:""}${B?`- 🔧 高段(5-6)：小数分数运算、方程、几何计算、复合应用题
`:""}${_?`- 🔧 初中：代数运算、几何证明、函数初步、统计与概率
`:""}${I?`- 🔧 高中：函数、数列、立体几何、概率统计、导数、向量
`:""}`:je?`【英语学科专项提取规则——通读全文，不得遗漏任何知识内容】
- 📕 词汇表/单词表：每个词条（英文+中文释义）独立标注为 specificConcept，逐条列出，不得遗漏任何一个
- 📕 重点句型：每个句型独立标注（如"What's your name?""I like...""There be..."）
- 📕 语法点：时态、语态、句型结构、词性、从句等逐条标注
- 📕 对话/短文：标注主题、关键表达、交际功能
- 📕 发音/拼读规则：自然拼读、音标、重音、连读等
- 📕 听力材料中的关键信息和考查点
- 📕 阅读理解策略与完形填空考点
- 📕 书面表达/写作话题与常用表达
- 📕 文化知识/跨文化交际内容
- 📕 教材各板块：Let's learn/Talk/Spell/Read/Write/Story等全部提取
- 🔒 必须逐条标注，绝不将多个词条合并为一条（如"单词5个"→必须拆成5条独立知识点）
- 🔒 先通读确认段落整体内容类型（正文/词汇表/练习/导语），再逐条精准标注
${ye?`- 🔧 低段(1-2)：字母、简单单词、日常问候、歌曲歌谣、颜色数字
`:""}${H?`- 🔧 中段(3-4)：对话理解、短文阅读、简单语法、词汇拼写
`:""}${B?`- 🔧 高段(5-6)：篇章阅读、时态综合、简单写作
`:""}${_?`- 🔧 初中：完形填空、阅读理解、书面表达、语法系统
`:""}${I?`- 🔧 高中：深层阅读、语法填空、读后续写、概要写作
`:""}`:M?`【${Le?"物理":ie?"化学":C?"生物":"科学"}学科专项提取规则——通读全文，不得遗漏任何知识内容】
- 🔬 概念/定义/定律/原理：每个独立标注，注明内涵
- 🔬 公式/方程式/化学式：逐条标注${ie?"，配平和反应条件":""}
- 🔬 实验：目的、器材、步骤、现象、结论、注意事项
- 🔬 计算题考查点和公式应用
- 🔬 图表/数据/示意图的解读要点
- 🔬 ${Le?"力学/电学/光学/热学":ie?"物质性质、反应类型、元素周期":C?"细胞、遗传、生态、进化":"物质科学、生命科学、地球科学"}核心知识
- 🔬 科学探究方法：观察、假设、实验、分析、结论
- 🔬 ${C?"结构与功能关系、分类依据":"物质变化规律、能量转化"}
- 🔬 课后练习/习题中考查的题型和能力
- 🔒 必须逐条标注，绝不将多个知识点合并为一条
- 🔒 先通读确认段落整体内容类型，再逐条精准标注
${X?`- 🔧 小学：观察描述、简单分类、常见现象解释、动手实验
`:""}${_?`- 🔧 初中：基础定律、简单计算、实验操作规范、探究报告
`:""}${I?`- 🔧 高中：复杂理论推导、定量计算、综合实验设计、科学思维
`:""}`:L?`【${l?"历史":we?"地理":"政治/道德与法治/思想政治"}学科专项提取规则——通读全文，不得遗漏任何知识内容】
- 📖 核心概念/原理/定义：每个独立标注
- 📖 ${l?"重要事件/人物/时间/导火索/结果/意义":we?"地理位置/地形/气候/资源/人口/经济":"政治概念/制度/法律/权利/义务/价值观"}
- 📖 ${we?"地图/图表/数据分析：识图、读图、绘图要点":"材料/图表/数据解读要点"}
- 📖 因果关系/影响意义/启示/教训
- 📖 案例分析/材料解读/情境判断
- 📖 比较异同/归纳总结/评价论述
- 📖 ${l?"史料实证/历史解释/时空观念":we?"区域认知/综合思维/人地协调观":"政治认同/法治意识/公共参与"}
- 📖 课后练习/习题中考查的题型和能力层次
- 🔒 必须逐条标注，绝不将多个知识点合并为一条
- 🔒 先通读确认段落整体内容类型，再逐条精准标注
${X?`- 🔧 小学：常识性了解、行为规范、简单地图识别、身边的社会现象
`:""}${_?`- 🔧 初中：系统知识体系、综合分析能力、材料题/简答题
`:""}${I?`- 🔧 高中：深度理论理解、多角度分析、论述题/综合探究
`:""}`:G?`【信息科技学科专项提取规则——通读全文，不得遗漏任何知识内容】
- 💻 概念/术语：每个独立标注
- 💻 操作步骤/流程/命令
- 💻 编程知识点：语法、算法、数据结构
- 💻 软件应用/工具使用
- 💻 信息安全/网络道德
- 💻 项目实践/案例应用
- 🔒 必须逐条标注，绝不将多个知识点合并为一条
${X?`- 🔧 小学：计算机基础操作、图形化编程、信息意识
`:""}${_?`- 🔧 初中：办公软件、简单编程、网络基础
`:""}${I?`- 🔧 高中：算法设计、数据处理、人工智能初步
`:""}`:ce||Fe||le?`【${q}学科专项提取规则——通读全文，不得遗漏任何知识内容】
- 核心概念/术语/技法：每个独立标注
- 作品/曲目/运动项目及其要点
- 鉴赏/欣赏/评价要点
- 实践/操作/训练要求
- 课后练习/活动考查的内容
- 🔒 必须逐条标注，绝不将多个知识点合并为一条`:""})()}

【提取规范】
- 🔧 数量不设硬上限：知识点数量由原文内容密度决定，每有一个独立可教学的要点就提取一个，不遗漏、不凑数
- 🔧 原文引证约束：每个知识点必须能在原文中找到直接依据，不得凭学科经验臆造原文未涉及的内容
- 🔧 禁止拆分凑数：不得把同一个知识点换几种说法拆成多个条目来凑量
- 🔧 粒度标准：specificConcepts 分解到"可独立教学/考查的最小知识点"粒度即可，最多4个；suggestedQuestionTypes 给出1-3个最匹配的题型
- 🔧 主题词按原文篇幅匹配：短文（<5段）2-3个主题词，长文3-6个，以能概括全文核心内容为准
- 🔧 JSON 字段值尽量简短，不要写长句子
- 🔧 所有输出字段必须使用中文（教材原文为英文时，知识点/主题词用中文描述原文含义）`;console.log("🔥 教材特征分析：检查文本模型状态...");let D=!0;try{const q=await $e(null,3,"text");if(q.ready){if(console.log(`✅ 文本模型已就绪，立即开始分析（响应时间: ${q.responseTime}ms）`),q.responseTime>2e4){const O=Math.min(5e3,Math.max(3e3,q.responseTime/10));console.log(`⏳ 模型刚加载完成，额外等待${O/1e3}秒确保完全预热...`),await new Promise(de=>setTimeout(de,O))}}else{if(console.warn(`⚠️ 文本模型未就绪: ${((ee=q.error)==null?void 0:ee.message)||"未知错误"}`),D=!1,q.error&&q.error.message.includes("配置错误"))return console.error("❌ 文本模型配置错误，将跳过特征分析步骤"),{visualDescription:"",formulas:[],coreTopics:"",knowledgePoints:[],knowledgeHierarchy:[],competency:"理解",style:"传统",analysisSkipped:!0,skipReason:q.error.message};const O=Math.max(2e3,Math.min(5e3,q.responseTime/10));await new Promise(de=>setTimeout(de,O))}}catch(q){console.warn("⚠️ 文本模型检测失败，等待3秒后继续...",q.message),D=!1,await new Promise(O=>setTimeout(O,3e3))}if(!D)return console.warn("⚠️ 文本模型不可用，跳过特征分析"),{visualDescription:"",formulas:[],coreTopics:"",knowledgePoints:[],knowledgeHierarchy:[],competency:"理解",style:"传统",analysisSkipped:!0,skipReason:"文本模型不可用"};const N=await ne(U,{taskType:"analysis",temperature:.1,timeout:3e5});console.log(`✅ 教材特征分析完成，响应长度: ${(N==null?void 0:N.length)||0}字`);try{const q=await ft(N,O=>ne(O,{taskType:"analysis",temperature:.1}),"教材特征分析","analysis");T.visualDescription=q.visualDescription||"",T.formulas=q.formulas||[],T.coreTopics=q.coreTopics||"",T.knowledgeHierarchy=q.knowledgeHierarchy||[]}catch(q){console.error("❌ JSON 解析失败:",q.message)}}catch(J){console.error("❌ AI 分析异常:",J.message)}const x=[];if(T.knowledgeHierarchy&&T.knowledgeHierarchy.length>0)for(const J of T.knowledgeHierarchy)for(const U of J.coreKnowledge||[])x.push(U.name),U.specificConcepts&&x.push(...U.specificConcepts);return{...T,knowledgePoints:x,competency:It(p)<=6?"识记与理解":"应用与分析",style:"传统"}},_t=async(h,u,i,p,P="",m="")=>{var N;let $="",w={quality:"unknown",reason:""};if(P&&P.trim().length>=10)$=P,w=Pe($,u),console.log("📖 使用预提取的模板原文，长度:",$.length);else{const q=await gt(h,{subject:u,stage:i,imagePath:m});$=q.text||"",w={quality:q.ocrQuality||"unknown",reason:""},console.log("📖 模板原文提取结果长度:",($==null?void 0:$.length)||0,"栏数:",q.columnType||"未知")}if(!$||$.trim().length<10)return console.error("❌ 模板原文提取完全失败"),{rawText:$||"",structure:[],scoreDistribution:"原文提取失败，请手动填写",questionStyle:"",difficultyLevel:"",questionCards:[],ocrQuality:"poor"};console.log(`📖 OCR质量: ${w.quality} - ${w.reason}`);let g={structure:[],scoreDistribution:"",questionStyle:"",difficultyLevel:"",questionCards:[],languageStyle:null,formatStyle:null};const T=$.length;if(console.log(`📖 模板原文长度: ${T}字`),T<50)return console.warn("⚠️ 模板原文过短，可能OCR失败"),{rawText:$,structure:[],scoreDistribution:"原文过短，请重新上传",questionStyle:"",difficultyLevel:"",questionCards:[],ocrQuality:"poor"};let x=mi($);if($=(q=>{let O=q;return O=O.replace(/\n?\s*[\u4e00-\u9fa5]{2,4}(教育|学校|培训|机构|课堂|网校)[\s\S]{0,10}?\n?/g,""),O=O.replace(/\n?\s*www\.[a-zA-Z0-9.-]+\.[a-z]{2,6}\s*\n?/gi,""),O=O.replace(/\n?\s*\d{3,4}-?\d{7,8}\s*\n?/g,""),O=O.replace(/^\s*第\s*\d+\s*页\s*$/gm,""),O=O.replace(/^\s*Page\s*\d+\s*$/gmi,""),O=O.replace(/^\s*[—―]\s*\d+\s*[—―]\s*$/gm,""),O=O.replace(/^\s*·\s*\d+\s*·\s*$/gm,""),O=O.replace(/^\s*[*=_-]{3,}\s*$/gm,""),O=O.replace(/\n{3,}/g,`

`),O.trim()})($),console.log(`📖 模板原文清理后长度: ${$.length}字`),!P&&T>3e3){const q=$.substring(0,1500),O=$.substring(T-1500);x=q+`
...（共`+T+`字，中间部分省略）...
`+O}const J=[];if(/[A-D]\.[^A-D]*[A-D]\./.test(x)){J.push("选项可能粘连（缺少分隔符）");const q=x;x=x.replace(/([A-D])\.(\D*?)([A-D])\./g,"$1.$2 $3."),x=x.replace(/([A-D])\.(\S)/g,"$1. $2"),x!==q&&(console.log("🔧 选项粘连已自动修复"),J[0]+="（已自动修复）")}const U=(x.match(/[□■◆◇○●△▲▽▼]/g)||[]).length;U>3&&J.push("发现"+U+"个异常字符，公式可能丢失"),J.length>0&&console.warn("⚠️ 模板OCR质量预警:",J.join("；"));try{let O=new Set,de=new Set,Ce=new Set,Je=new Set,Se=[],je=null,Le=null;const ie=[];let C=x;for(;C.length>0;){if(C.length<=2500){ie.push(C);break}let z=C.lastIndexOf("。",2500);z<2500*.5&&(z=C.lastIndexOf(`
`,2500)),z<2500*.3&&(z=2500),ie.push(C.substring(0,z+1)),C=C.substring(z+1)}if(ie.length<=1){console.log("📄 原文长度适中，单次分析");const z=Y({category:"分析-文本分析规范"}),l=Y({category:"分析-分析模板示例"}),we=Y({category:"分析-分析提取要求"}),he=z.find(ge=>ge.id.includes("fmt_note")),G=z.find(ge=>ge.id.includes("core_principle")),ce=z.find(ge=>ge.id.includes("mandatory_rules_full")),Fe=z.find(ge=>ge.id.includes("difficulty_rules_full")),le=l.find(ge=>ge.id.includes("examples_full")),M=l.find(ge=>ge.id.includes("error_examples")),L=we.find(ge=>ge.id.includes("extraction_reqs")),X=he?he.content:`- **加粗文字** 表示重点概念、关键词或考点
- _下划线文字_ 表示需要特别关注的部分
- ==高亮文字== 表示极其重要的考点
- *斜体文字* 表示补充说明或注释
- ~~删除线~~ 表示已删除或不适用的内容
⚠️ 重要：这些格式标记是原文的一部分，请在提取时保留它们的语义信息！`,_=G?G.content:`⚠️ 严禁任何形式的归纳、改写、标准化、总结！
⚠️ 原文写什么就填什么，一个字都不能改！`,I=ce?ce.content:`1. 【大题名称】必须逐字复制原文中的原话，严禁任何归纳、改写、标准化
   - ✅ 正确："一、读下面的语段，按要求完成练习"
   - ❌ 错误："阅读理解题"（这是归纳，禁止！）
   - ✅ 正确："三、语文与生活"
   - ❌ 错误："生活应用题"（这是归纳，禁止！）
   - ✅ 正确："四、材料连贯性文本,完成练习"
   - ❌ 错误："材料分析题"（这是归纳，禁止！）
2. 【题型】必须逐字复制原文中的原话，严禁归类为标准题型
   - ✅ 正确："读下面的语段，按要求完成练习"
   - ❌ 错误："语段分析"（这是归纳，禁止！）
   - ✅ 正确："选择正确的答案"
   - ❌ 错误："选择题"（这是标准化，禁止！）
   - ✅ 正确："语文与生活"
   - ❌ 错误："生活应用"（这是归纳，禁止！）
3. 【设问风格】必须直接引用原文中的原句，不要改写或总结
   - ✅ 正确："根据语段填写词语"
   - ❌ 错误："看拼音写词"（这是改写，禁止！）
   - ✅ 正确："依次填入下面横线段线上的关联词语，恰当的一项是"
   - ❌ 错误："关联词填空"（这是归纳，禁止！）
4. 【难度】需要根据题目内容分析判断（基础/中等/较难）← 唯一可以由AI判断的字段
5. 【分值】只有原文明确标注了才能填写；没有标注的填0，严禁自己估算
6. 【小题序号】必须从原文中逐题提取，原文用什么序号就用什么
7. 【小题数量】必须从原文中逐题提取，原文有几个就填几个`,ye=Fe?Fe.content:`难度分为三个等级：基础、中等、较难

**基础题特征**：
- 直接考查基础知识（如看拼音写词语、词语解释、简单计算）
- 答案唯一且明确，不需要复杂推理
- 示例："根据拼音写出词语""计算下列算式的结果"

**中等题特征**：
- 需要理解上下文或联系多个知识点
- 有一定推理过程，需要分析或比较
- 示例："联系上下文理解词语含义""选择描写方法相同的句子"

**较难题特征**：
- 需要综合运用多个知识点，创造性思维
- 开放性较强，需要深度分析
- 示例："概括母亲对袁隆平成长产生重要影响的三件事""赏析句子的表达效果"

**判断原则**：
1. 如果原文中有明确标注（如"提高题""拓展题"），优先使用原文标注
2. 如果没有标注，根据上述规则分析题目内容后判断
3. 同一道大题下的小题难度可能不同，需分别判断`,H=le?le.content:"",B=M?M.content:`❌ "题型": "阅读理解" → 原文写的是"一、读下面的语段，按要求完成练习"，应该完整复制
❌ "设问风格": "根据短文填空" → 原文写的是"根据语段填写词语"，必须逐字复制
❌ "小题数量": 20 → 原文没有明确说明小题数量，应该根据实际提取的小题计算`,be=L?L.content:`1. 识别每道大题：原文中标注了"一、""二、""第一部分""专项一""第五单元"或类似标记的为大题
2. 大题下的小题逐题提取，包括每小题序号和分值
3. 题型名称直接用原文中的说法，原文写什么就填什么
4. 如果原文没有大题标记，整份试卷视为一道大题，各小题直接提取
5. 所有分值、题数、风格描述都从原文直接取，不要自己编
6. 设问风格：该题型在原文中是如何提问的，原文用什么词就提取什么词`,fe=`你是考试命题专家。请分析以下试卷/教辅材料的原文，提取完整结构。

【格式说明——原文中的标记表示重点内容】
${X}

【核心原则——除难度外，所有字段必须逐字从原文复制】
${_}

【强制规则——违反将导致分析结果作废】
${I}

【难度分析规则——需要根据题目内容判断】
${ye}

【原文内容】（共${T}字）
${x}

【真实教辅资料示例——理解多样性】
${H}

【错误示例——以下提取全部作废】
${B}

【提取要求——除难度外，所有字段直接从原文原样提取，一个字都不要改】
${be}

只返回 JSON：
{
  "结构分析": [
    {
      "大题": "原文中的大题名称，逐字复制",
      "大题分值": 原文中的分值或0,
      "小题数量": 原文中的小题数,
      "每小题分值": 原文中的分值或0,
      "题型": "原文中的题型名称，逐字复制",
      "设问风格": "原文中的设问原句，逐字复制",
      "难度": "根据题目内容分析得出（基础/中等/较难）",
      "小题列表": [
        {"小题序号": "原文中的序号", "分值": 原文中的分值或0}
      ]
    }
  ],
  "总题数": 所有小题数量之和,
  "总分": 所有大题分值之和
}

只返回JSON，不要其他内容。
- 🔧 所有输出字段必须使用中文（即使原文为英文，题型名称等也请用中文描述）`,lt=await ne(fe,{taskType:"generation",temperature:.1,timeout:18e4});try{const ge=await ft(lt,null,"模板结构分析-步骤a");g.结构分析=Array.isArray(ge.结构分析)?ge.结构分析:[],g.总题数=ge.总题数||0,g.总分=ge.总分||0}catch(ge){console.warn("步骤2a解析失败，尝试从原文推断:",ge.message),g.结构分析=[],g.总题数=0,g.总分=0}console.log("🎨 开始提取语言风格...");const ve=`你是考试命题专家。请简要分析以下试卷的语言风格特征。

【原文内容】（截取前500字）
${x.substring(0,500)}

只返回JSON（字段可以为空字符串或null）：
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

只返回JSON。`;console.log("🔥 语言风格分析：检查模型状态...");try{const ge=await $e(null,3,"text");if(ge.ready)console.log(`✅ 文本模型已就绪，立即开始语言风格分析（响应时间: ${ge.responseTime}ms, 尝试${ge.attempts}次）`);else{console.log(`⚠️ 模型未就绪，根据响应时间动态等待... (${ge.responseTime}ms)`);const ue=Math.max(2e3,Math.min(4e3,ge.responseTime/10));await new Promise(Ye=>setTimeout(Ye,ue))}}catch(ge){console.warn("⚠️ 模型检测失败，等待3秒后继续...",ge.message),await new Promise(ue=>setTimeout(ue,3e3))}try{const ge=await ne(ve,{taskType:"generation",temperature:.1,timeout:6e4}),ue=await ft(ge,null,"语言风格提取");g.languageStyle=ue.languageStyle||null,g.formatStyle=ue.formatStyle||null,console.log("✅ 语言风格提取完成")}catch(ge){console.warn("语言风格提取失败，使用默认值:",ge.message),g.languageStyle={avgSentenceLength:35,commonPatterns:["直接设问","情境引入"],connectors:["因此","所以","但是"],contextIntro:"通过生活情境引入",personReference:"第二人称“你”",tone:"亲切、引导性",sampleSentence:"请根据所学知识回答问题"},g.formatStyle={spacingBetweenQuestions:!0,indentation:"首行缩进2字符",scorePosition:"题干末尾括号内",chartDescriptionFormat:"图表下方说明"},console.log("⚠️ 使用默认语言风格")}}else{console.log(`📄 原文较长(${T}字)，分${ie.length}段分析（每段约2500字）`),console.log(`   各段长度: ${ie.map((_,I)=>`段${I+1}:${_.length}字`).join(", ")}`);const z=new Set,l=new Set,we=new Set,he=new Set,G=[],ce=new Array(ie.length).fill(!1);for(let _=0;_<ie.length;_++){const I=ie[_],ye=ie.length>1?`（第${_+1}/${ie.length}段）`:"";let H=0;if(_>0)console.log(`⏰ 第${_+1}段分析前等待5秒，让模型恢复...`),await new Promise(st=>setTimeout(st,5e3));else{console.log("🔥 模板结构分析：检查模型状态...");try{const st=await $e(null,3,"text");if(st.ready)console.log(`✅ 文本分析模型已就绪，立即开始（响应时间: ${st.responseTime}ms, 尝试${st.attempts}次）`);else{console.log(`⚠️ 模型未就绪，根据响应时间动态等待... (${st.responseTime}ms)`);const He=Math.max(2e3,Math.min(5e3,st.responseTime/10));await new Promise(ut=>setTimeout(ut,He))}}catch(st){console.warn("⚠️ 模型检测失败，等待3秒后继续...",st.message),await new Promise(He=>setTimeout(He,3e3))}}const B=Y({category:"分析-文本分析规范"}),be=B.find(st=>st.id.includes("fmt_note")),fe=B.find(st=>st.id.includes("core_principle")),lt=B.find(st=>st.id.includes("mandatory_rules_compact")),ve=B.find(st=>st.id.includes("difficulty_rules_compact")),ge=be?be.content:`- **加粗文字** 表示重点概念、关键词或考点
- _下划线文字_ 表示需要特别关注的部分
- ==高亮文字== 表示极其重要的考点
- *斜体文字* 表示补充说明或注释
- ~~删除线~~ 表示已删除或不适用的内容
⚠️ 重要：这些格式标记是原文的一部分，请在提取时保留它们的语义信息！`,ue=fe?fe.content:`⚠️ 严禁任何形式的归纳、改写、标准化、总结！
⚠️ 原文写什么就填什么，一个字都不能改！`,Ye=lt?lt.content:`1. 【大题名称】必须逐字复制原文中的原话
   - ✅ 正确："一、读下面的语段，按要求完成练习"
   - ❌ 错误："阅读理解题"（这是归纳，禁止！）
   - ✅ 正确："三、语文与生活"
   - ❌ 错误："生活应用题"（这是归纳，禁止！）
2. 【题型】必须逐字复制原文中的原话
   - ✅ 正确："读下面的语段，按要求完成练习"
   - ❌ 错误："语段分析"（这是归纳，禁止！）
   - ✅ 正确："选择正确的答案"
   - ❌ 错误："选择题"（这是标准化，禁止！）
3. 【设问风格】必须直接引用原文中的原句
   - ✅ 正确："根据语段填写词语"
   - ❌ 错误："看拼音写词"（这是改写，禁止！）
4. 【难度】需要根据题目内容分析判断（基础/中等/较难）← 唯一可以由AI判断的字段
5. 【分值】只有原文明确标注了才能填写，没有标注填0
6. 【小题序号】必须从原文中逐题提取，原文用什么序号就用什么
7. 【小题数量】必须从原文中逐题提取，原文有几个就填几个`,Qe=ve?ve.content:`- 基础题：直接考查基础知识（如看拼音写词语、简单计算、词语解释）
- 中等题：需要理解上下文或联系多个知识点（如选择描写方法相同的句子）
- 较难题：需要综合运用多个知识点，创造性思维（如赏析句子表达效果、概括多件事）`,ht=`你是考试命题专家。请分析以下试卷片段${ye}，提取基本结构。

【格式说明——原文中的标记表示重点内容】
${ge}

【核心原则——除难度外，所有字段必须逐字从原文复制】
${ue}

【强制规则】
${Ye}

【难度分析规则】
${Qe}

【原文片段】（共${I.length}字）
${I}

只返回JSON：
{
  "结构分析": [
    {
      "大题": "原文中的大题名称，逐字复制",
      "大题分值": 原文中的分值或0,
      "小题数量": 原文中的小题数,
      "每小题分值": 原文中的分值或0,
      "题型": "原文中的题型名称，逐字复制",
      "设问风格": "原文中的设问原句，逐字复制",
      "难度": "根据题目内容分析得出（基础/中等/较难）",
      "小题列表": [
        {"小题序号": "原文中的序号", "分值": 原文中的分值或0}
      ]
    }
  ],
  "总题数": 所有小题数量之和,
  "总分": 所有大题分值之和
}

只返回JSON，不要其他内容。`;try{const st=await ne(ht,{taskType:"generation",temperature:.1,timeout:9e4}),He=await ft(st,null,`结构分析-段${_+1}`);console.log(`🔍 第${_+1}段解析结果:`,{has结构分析:Array.isArray(He.结构分析),hasStructure:Array.isArray(He.structure),structureLength:((N=He.结构分析)==null?void 0:N.length)||0,keys:Object.keys(He).slice(0,10)}),Array.isArray(He.结构分析)&&He.结构分析.forEach(ut=>{if(ut.题型){const Xe=z.size;z.add(ut.题型),z.size>Xe&&console.log(`   📌 第${_+1}段新增题型: ${ut.题型}`)}G.push(ut)}),Array.isArray(He.structure)&&He.structure.forEach(ut=>z.add(ut)),He.scoreDistribution&&l.add(He.scoreDistribution),He.questionStyle&&we.add(He.questionStyle),He.difficultyLevel&&he.add(He.difficultyLevel),console.log(`✅ 第${_+1}段结构分析完成，累计题型: ${[...z].length}种`)}catch(st){if(console.warn(`第${_+1}段结构分析失败:`,st.message),H===0&&!ce[_]){console.log(`🔄 第${_+1}段使用简化prompt重试（冷启动可能较慢）...`),ce[_]=!0,H++;const Xe=`请从以下试卷片段中提取题型结构。

【规则】
1. 大题名称、题型、设问风格必须逐字复制原文
2. 难度由你判断（基础/中等/较难）
3. 只返回JSON

原文：
${I.substring(0,1e3)}

JSON格式：
{"结构分析": [{"大题": "", "题型": "", "设问风格": "", "难度": "", "小题数量": 0, "小题列表": []}], "总题数": 0, "总分": 0}`;try{const et=await ne(Xe,{taskType:"generation",temperature:.1,timeout:6e4}),se=await ft(et,null,`结构分析-段${_+1}-重试`);Array.isArray(se.结构分析)&&se.结构分析.forEach(xe=>{xe.题型&&z.add(xe.题型),G.push(xe)}),Array.isArray(se.structure)&&se.structure.forEach(xe=>z.add(xe)),se.scoreDistribution&&l.add(se.scoreDistribution),se.questionStyle&&we.add(se.questionStyle),se.difficultyLevel&&he.add(se.difficultyLevel),console.log(`✅ 第${_+1}段简化重试成功，题型: ${[...z].join("、")}`);continue}catch(et){console.warn(`第${_+1}段简化重试也失败:`,et.message)}}const He=[],ut={选择题:["A.","B.","C.","D.","Ａ.","Ｂ.","Ｃ.","Ｄ."],填空题:['<u class="blank-',"______","___","（","(  )"],判断题:["正确","错误","√","×"],计算题:["计算","算一算"],解答题:["解答","解："],应用题:["应用","解决问题"],实验题:["实验","探究"],阅读理解:["阅读","理解"],书面表达:["写作","作文","书面表达"]};for(const[Xe,et]of Object.entries(ut))et.some(se=>I.includes(se))&&He.push(Xe);He.length>0?(He.forEach(Xe=>z.add(Xe)),console.log(`🔧 第${_+1}段降级匹配题型: ${He.join("、")}`)):z.add("未识别题型(段"+(_+1)+")")}}const Fe=[...z].filter(_=>typeof _=="string"&&!_.startsWith("未识别题型"));g.structure=Fe.length>0?Fe:[...z],G.length>0?(g.结构分析=G,console.log(`✅ 合并${G.length}个大题对象`)):(g.结构分析=g.structure.map(_=>({大题:_,题型:_,设问风格:"",难度:"中等",小题数量:0,小题列表:[]})),console.warn("⚠️ 没有收集到大题对象，使用降级方案")),g.总题数=0,g.总分=0,g.structure.length<=1&&ie.length>=3&&(console.warn(`⚠️ 模板有${ie.length}段，但仅识别到${g.structure.length}种题型，可能不完整`),g._structureIncomplete=!0),g.scoreDistribution=[...l].join("；"),g.questionStyle=[...we].join("；"),g.difficultyLevel=[...he].join("；"),console.log("📋 开始提取代表性题卡...");const le=x.substring(0,1500),M=g.structure||[],L=M.length>0?`
【已知题型】（必须为以下每种题型提取题目）
${M.map(_=>_.题型||_).join("、")}`:"",X=`你是考试命题专家。请基于以下试卷片段，提取**每种题型的1道代表性题目**。

【原文内容】（截取前1500字）
${le}
${L}

【重要——提取要求】
1. 每种题型只提取1道题（最多6道题）
2. 优先选择题干完整、有代表性的题目
3. 题干必须逐字复制原文，一个字都不能改
4. options字段：选择题保留A/B/C/D选项，非选择题填空字符串数组
5. score：原文标注了分值的按原文填，未标注的填0
6. questionFeature：概括该题的设问特征，10字以内
7. 如果某题型在原文中找不到，跳过该题型

请提取并只返回JSON：
{
  "questionCards": [
    {
      "number": 1,
      "type": "选择题",
      "stem": "逐字复制的完整题干",
      "options": ["A. xxx", "B. xxx", "C. xxx", "D. xxx"],
      "score": 3,
      "knowledgePoint": "",
      "difficulty": "基础",
      "questionFeature": "设问特征"
    }
  ]
}

只返回JSON。`;console.log("🔥 题卡分析：检查模型状态...");try{const _=await $e(null,3,"text");if(_.ready)console.log(`✅ 模型已就绪，立即开始题卡分析（响应时间: ${_.responseTime}ms, 尝试${_.attempts}次）`);else{console.log(`⚠️ 模型未就绪，根据响应时间动态等待... (${_.responseTime}ms)`);const I=Math.max(2e3,Math.min(5e3,_.responseTime/10));await new Promise(ye=>setTimeout(ye,I))}}catch(_){console.warn("⚠️ 模型检测失败，等待3秒后继续...",_.message),await new Promise(I=>setTimeout(I,3e3))}try{const _=await ne(X,{taskType:"generation",temperature:.1,timeout:12e4}),I=await ft(_,null,"模板结构分析-步骤b");g.questionCards=Array.isArray(I.questionCards)?I.questionCards:[],console.log(`✅ 题卡提取完成，共${g.questionCards.length}道代表性题目`)}catch(_){console.warn("详细题卡分析超时，尝试简化版...",_.message);try{const I=`请从以下试卷中每种题型提取1道代表性题目，只返回题号、题型和题干。

【原文】
${le.substring(0,1e3)}

返回JSON：{"questionCards": [{"number": 1, "type": "选择题", "stem": "题干原文", "options": [], "score": 0, "knowledgePoint": "", "difficulty": "基础", "questionFeature": ""}]}

只返回JSON，每个题干不超过200字。`,ye=await ne(I,{taskType:"generation",temperature:.1,timeout:6e4}),H=await ft(ye,null,"简化题卡分析");g.questionCards=Array.isArray(H.questionCards)?H.questionCards:[],console.log(`⚠️ 使用简化题卡，共${g.questionCards.length}道`)}catch(I){console.error("题卡分析完全失败:",I.message),g.questionCards=[]}}}}catch(q){console.error("模板结构分析失败:",q)}return{rawText:yi($),...g,languageStyle:g.languageStyle||null,formatStyle:g.formatStyle||null,ocrQuality:w.quality}},cn=(h,u,i)=>{const p=Y({category:"生成-年级边界提示",subject:h,stage:u});if(p.length===0)return"";const P=p[0].content,m=P.match(/\[type=(\w+)\]/),$=P.match(/\[startGrade=(\d+)\]/),w=P.match(/\[endGrade=(\d+)\]/);if(!m)return"";const g=m[1],T=P.match(/提示词：(.+)/),x=T?T[1]:"";return x&&(g==="start"&&$&&i>0&&i<parseInt($[1])||g==="end"&&w&&i>0&&i>parseInt(w[1]))?x:""},jt=(h,u,i,p,P="exam")=>{const m=h==="primary"?u?"primary_low":i?"primary_mid":"primary_high":h||"middle";let $=Y({category:"生成-难度配置",stage:m,genType:P});if($.length===0&&P!=="exam"&&($=Y({category:"生成-难度配置",stage:m,genType:"exam"})),$.length>0){const w=$[0].content,g=w.match(/basic=(\d+)/),T=w.match(/medium=(\d+)/),x=w.match(/advanced=(\d+)/);if(g&&T&&x)return{basic:parseInt(g[1]),medium:parseInt(T[1]),advanced:parseInt(x[1])}}return console.warn(`[instructionLib] 未找到匹配的难度配置: gradeSegment=${m}`),null},Ht=(h,u,i)=>{if(h!=="exam")return 0;const p=Y({category:"生成-难度配置",stage:i,genType:"exam"});if(p.length>0){const P=p[0].content,m=P.match(/totalScore_main=(\d+)/),$=P.match(/totalScore_other=(\d+)/),w=P.match(/totalScore=(\d+)/),T=["语文","数学","英语"].includes(u);if(m&&T)return parseInt(m[1]);if($&&!T)return parseInt($[1]);if(w)return parseInt(w[1])}return console.warn(`[instructionLib] 未找到匹配的总分配置: stage=${i}, genType=${h}`),0},St=h=>!h||h.length===0?!0:h.length!==3?!1:h.map(i=>i.name).sort().join(",")==="填空题,解答题,选择题",it=(h,u,i)=>{if(h!=="exam"&&h!=="practice")return[];const p=Y({category:"生成-题型分布建议",subject:u,stage:i,genType:h});return p.length===0||!p[0].typeDist?[]:p[0].typeDist.split(",").map(m=>{const $=m.trim().match(/^(.+):(\d+)-(\d+)$/);if(!$)return null;const[,w,g,T]=$;return{name:w.trim(),selected:!0,count:Math.ceil((parseInt(g)+parseInt(T))/2),score:null}}).filter(Boolean)},xt=(h,u,i,p="")=>{const P=Y({category:"生成-知识点全覆盖",subject:u,stage:i,genType:h,specialSubType:h==="special"?p:""});if(P.length>0){const m=Y({category:"生成-指令块标题",subject:"",stage:"",genType:"coverage_constraint"});return`
⚠️ 【`+(m.length>0?m[0].content:"知识点全覆盖")+"】"+P[0].content}return""},qt=(h,u,i,p="")=>{const P=Y({category:"生成-答案与解析规范",subject:u,genType:h,specialSubType:h==="special"?p:""});if(P.length>0){const m=P.filter(g=>(!g.subject||g.subject==="")&&!g.id.startsWith("block_answer_spec")),$=P.filter(g=>g.subject&&g.subject!==""&&g.subject.split(",").includes(u)),w=[...m];for(const g of $)w.find(T=>T.id===g.id)||w.push(g);if(w.length>0)return w.map(g=>g.content).join(`
`)}return console.warn(`[instructionLib] 未找到匹配的答案与解析规范: genType=${h}, subject=${u}`),""},On=(h,u,i)=>{if(h!=="exam")return"";const p=u?Y({category:"生成-主观题评分标准",subject:u,stage:"",genType:h}):[];return p.length>0?`
【主观题评分标准参考】
`+p[0].content:(console.warn(`[instructionLib] 未找到主观题评分标准: subject=${u}`),"")},$n=(h,u)=>{if(h!=="语文"||!["exam","practice","special","reading"].includes(u))return"";const p=Y({category:"生成-答题模板",subject:"语文",stage:""});return p.length>0?`
【语文阅读理解答题模板——严格按此框架作答】
`+p[0].content:(console.warn("[instructionLib] 未找到语文阅读理解答题模板"),"")},Wt=(h,u,i)=>{if(h!=="exam"||!i)return"";const p=Y({category:"生成-时间分配",genType:h,stage:i});return p.length>0?`
【时间分配建议】${p[0].content}`:(console.warn(`[instructionLib] 未找到匹配的时间分配: stage=${i}, genType=${h}`),"")},nn=(h,u,i,p,P,m,$="")=>{const g=(()=>{const T=Y({category:"生成-质量范例",subject:u,stage:m,genType:h,specialSubType:h==="special"?$:""});if(T.length>0)return`
【质量范例——${T[0].name.replace("【质量范例】","")}】
⚠️ 以下为格式示例，题量数字为示例仅供参考，实际题量由你根据文本内容灵活决定。
${T[0].content}`;const x=Y({category:"生成-质量范例",subject:u,stage:"",genType:h,specialSubType:h==="special"?$:""});return x.length>0?`
【质量范例——${x[0].name.replace("【质量范例】","")}】
⚠️ 以下为格式示例，题量数字为示例仅供参考，实际题量由你根据文本内容灵活决定。
${x[0].content}`:null})();return g||(console.warn(`[instructionLib] 未找到质量范例: genType=${h}, subject=${u}, stage=${i}`),"")},$s=(h,u,i,p,P,m)=>{if(!h)return"";const $=u==="primary"?i?"primary_low":p?"primary_mid":"primary_high":u||"";let w=Y({category:"生成-知识边界",subject:h,stage:u,genType:$});if(w.length===0&&(w=Y({category:"生成-知识边界",subject:h,stage:""})),w.length>0){const g=w[0].content.split(`
`).filter(T=>T.trim().startsWith("-"));if(g.length>0){const T=Y({category:"生成-指令块标题",subject:"",stage:"",genType:"knowledge_boundary"});return`
【`+(T.length>0?T[0].content:"年级知识边界——以下内容严禁出现")+`】
`+g.map(ee=>`- 🚫 ${ee.replace(/^-\s*/,"")}`).join(`
`)}}return console.warn(`[instructionLib] 未找到匹配的知识边界: subject=${h}, gradeSegment=${$}`),""},Rn=h=>{var u,i,p,P,m,$,w,g,T,x;try{const{selectedBooks:ee,selectedTemplates:J,scopeType:U,propositionStyle:D,genTypes:N=["exam"],granularity:q,questionTypes:O,difficultyLevels:de,totalScore:Ce,allowOriginalQuestions:Je,specialSubType:Se="",injectedFragments:je=[],autoFullInstructions:Le=[],mergeChapters:ie=!0,engine:C=""}=h,z=C==="deepseek";let l="";const we=[...new Set((ee||[]).map(E=>E.subject).filter(Boolean))],he=(ee==null?void 0:ee.find(E=>E.subject))||(ee==null?void 0:ee[0]),G=(he==null?void 0:he.subject)||"",ce=(he==null?void 0:he.stage)||"",le={小学:"primary",初中:"middle",高中:"high"}[ce]||ce,M=Kt(G,le),L=we.length>1?"":M,X=(he==null?void 0:he.grade)||"",_=It(X),I=le==="primary"&&_>0&&_<=2,ye=le==="primary"&&_>=3&&_<=4,H=le==="primary"&&_>=5,B=(N==null?void 0:N[0])||"exam",be=le==="primary"?I?"primary_low":ye?"primary_mid":"primary_high":le||"middle",fe=(E,V)=>{const te=Y({category:"生成-指令块标题",subject:"",stage:"",genType:E});return te.length>0?te[0].content:V},lt=Y({category:"生成-角色身份",subject:"",stage:"",genType:B});lt.length>0?l+=`【${fe("role_identity","角色身份")}】
${lt[0].content}

`:console.warn(`[instructionLib] 未找到角色身份: genType=${B}`);const ve=Y({category:"生成-标题格式",subject:"",stage:"",genType:""});ve.length>0&&(l+=`【${fe("title_format","标题格式")}】
${ve[0].content}

`),l+=`【${fe("core_task","核心任务")}】
`;let ge="";const ue=(he==null?void 0:he.selectedChapters)||[];if(U&&U!=="default"){const V={midterm:["期中综合测试","阶段综合测评","中期学业检测"],final:["期末综合测试","学期综合测评","期末学业检测"],topic:["专题复习","专项复习","专题训练"]}[U];if(V){const te=ue.map(y=>y.title).join("|").slice(0,80),f=`scope_${U}__${te}`;j[f]=(j[f]||0)%V.length,ge=V[j[f]++]}}else if(ue.length===1)ge=ue[0].title||"";else if(ue.length>1){const E=ue[0].title||"";let V=E.match(/第([一二三四五六七八九十]+)单元/);if(V)ge=`第${V[1]}单元`;else if(V=E.match(/(Unit|Chapter|Module)\s*(\d+)/i),V)ge=`${V[1]} ${V[2]}`;else{const te=ue.map(oe=>oe.title).filter(Boolean),f=te.length<=2?te.join("·"):te.slice(0,2).join("·")+"等",y=Y({category:"生成-多章节标题",subject:"",stage:"",genType:B});ge=(y.length>0?y[0].content:"{titles}").replace("{titles}",f)}}if(N&&N.length>0)for(const E of N){const V=Gn[E],te=ge||((V==null?void 0:V.name)||"").replace(/[^\u4e00-\u9fa5]/g,"");if(V){const f=Y({category:"生成-核心任务",matchSubject:L,stage:be,genType:E,specialSubType:E==="special"?Se:""}),y=f.length>0?f[0].content:"";if(f.length>0){const K=f[0];!K.subject&&!K.stage&&(M||be)&&console.warn(`[core-task-fallback] 「${E}」核心任务使用了通用兜底（无学科/学段），建议为 subject="${M}" stage="${be}" 补充学段专属核心任务条目。当前匹配: ${K.id}`,K)}l+=`请生成一份「${te}」。${y}
`;const A={category:"生成-资料类型结构",subject:M,stage:be,genType:E};E==="special"&&Se?A.specialSubType=Se:D&&(D==="big_unit"||D==="project_based")?A.specialSubType=D:A.specialSubType="new_standard";const oe=Y(A);if(E==="special"&&oe.length>1&&oe.sort((K,W)=>{const re=(K.specialSubType?2:0)+(K.subject&&K.stage?1:0);return(W.specialSubType?2:0)+(W.subject&&W.stage?1:0)-re}),oe.length>0){let K=oe[0].content.replace(`结构参考：
`,"");if(["exam","practice","special"].includes(E)&&(K=K.replace(/\d+[～\-—]\d+\s*[道题空篇个][，、]?/g,""),K=K.replace(/[（，、]\s*\d+\s*[道题空篇个]/g,re=>re[0]==="（"?"（":""),K=K.replace(/(留|配)\s*\d+[～\-—]?\d*\s*[道题空篇个]/g,"$1"),K=K.replace(/（[，、]+/g,"（"),K=K.replace(/[，、]+\s*）/g,"）"),K=K.replace(/[，、]{2,}/g,"，"),K=K.replace(/控制在[，、]?(?!\d)/g,"控制："),K=K.replace(/\n[，、]/g,`
`),K=K.replace(/\d+[～\-—]\d+\s*字[左右]?/g,""),K=K.replace(/(不超过?|不少于?|至少|至多)\s*\d+\s*字[左右]?/g,""),K=K.replace(/限时(建议)?\s*\d+[～\-—]?\d*\s*(分钟|秒)/g,""),K=K.replace(/正确率目标[≥≤]\s*\d+%/g,""),K=K.replace(/[≥≤]\s*\d+%/g,""),K=K.replace(/每页不(超过|多于)\s*\d+\s*题[，。]?/g,""),K=K.replace(/选项不超过\s*\d+\s*个/g,""),K=K.replace(/[每各][题空]\s*\d+\s*选\s*\d+/g,""),K=K.replace(/(词汇量|文字量)?\s*控制在?\s*\d+\s*[词字]以内/g,""),K=K.replace(/\d+\s*[词字]以内/g,""),K=K.replace(/总字数\s*[≤]\s*\d+\s*字/g,"")),z&&(K=K.replace(/——[^\n]*/g,"")),E==="preview"){const re=I?"2-3":ye?"3-4":"4-5";K=K.replace(/\d+-\d+道基础题/,`${re}道基础题`)}if(E==="reading"&&M==="语文"){const re=I?"1篇":"1-2篇";K=K.replace(/短文阅读（[\d-]+篇/,`短文阅读（${re}`)}l+=`【结构大纲】（以下为各部分组织顺序和考查内容，具体题量根据文本内容灵活决定）：
 ${K}
`}}}else l+=`⚠️ 请在顶部配置栏选择资料类型（考卷/课时练/专项突破/知识点总结），未选择时系统将按默认考卷格式生成。
`;if(B){const E=Y({category:"生成-答案区强制锚定",subject:"",stage:"",genType:B});E.length>0&&E[0].content&&(l+=`
【${fe("answer_anchor","答案区强制锚定")}】
${E[0].content}

`)}if(q&&(l+=`生成粒度：${q==="unit"?"按单元整体设计":"按课时单独设计"}。
`),ee&&ee.length>0){const E=(V,te)=>{if(!V)return"";const f=V.trim(),y=te||"";if(y.includes("英语"))return/unit\s*\d/i.test(f)?"单元":/lesson\s*\d/i.test(f)?"课时":/let.s\s*(learn|talk|spell|play|sing|do|check)/i.test(f)||/story\s*time|read\s*(and|&)\s*write/i.test(f)?"板块":/words|vocabulary|word\s*list/i.test(f)?"📕词汇表":/review|recycle|revision/i.test(f)?"复习":/project|task/i.test(f)?"项目":"";if(y.includes("语文"))return/第[一二三四五六七八九十\d]+课|课文[一二三四五六七八九十\d]*/.test(f)?"课文":/语文园地/.test(f)?"语文园地":/识字/.test(f)?"识字":/习作|写作|作文/.test(f)?"写作":/口语交际/.test(f)?"口语交际":/快乐读书吧|阅读链接|名著导读/.test(f)?"阅读":/综合性学习/.test(f)?"综合":/复习|回顾|总结/.test(f)?"复习":/古诗|诗词|文言文/.test(f)?"古诗文":"";if(y.includes("数学"))return/第[一二三四五六七八九十\d]+单元/.test(f)?"单元":/第[一二三四五六七八九十\d]+节/.test(f)?"节":/整理.*复习|复习.*整理|总复习/.test(f)?"复习":/数学广角|你知道吗/.test(f)?"拓展":/综合.*实践|实践.*活动/.test(f)?"实践":"";if(/物理|化学|生物|科学/.test(y))return/第[一二三四五六七八九十\d]+章/.test(f)?"章":/第[一二三四五六七八九十\d]+节/.test(f)?"节":/实验|探究|活动/.test(f)?"实验":/复习|小结|总结|回顾/.test(f)?"复习":"";if(/历史|地理|政治|道德|思想/.test(y)){if(/第[一二三四五六七八九十\d]+[课章单元]/.test(f)){const A=f.match(/第[一二三四五六七八九十\d]+(课|章|单元)/);return A?A[1]:""}return/探究|活动|讨论/.test(f)?"活动":/复习|总结|回顾/.test(f)?"复习":""}if(/^第[一二三四五六七八九十\d]+[课章节单元]/.test(f)){const A=f.match(/第[一二三四五六七八九十\d]+([课章节单元])/);return A?A[1]:""}return""};l+=`
【教材章节确认——以下章节的所有知识内容需全部覆盖】
`;for(const V of ee){const te=V.selectedChapters||[];if(te.length>0){const y=te.map(A=>{const oe=E(A.title,V.subject||"");return`${oe?`[${oe}]`:""}${A.title}（第${A.start}-${A.end}页）`}).join("、");l+=`《${V.name}》已锁定：${y}
`}else l+=`《${V.name}》（未勾选具体章节）
`;const f=te.filter(y=>{var A;return(A=y.knowledgeHierarchy)==null?void 0:A.length});if(f.length>0){l+=`🎯 知识层级：
`;for(const y of f){let A=0;for(const oe of y.knowledgeHierarchy){A++,l+=`${A}. ${oe.bigConcept}
`;for(const K of oe.coreKnowledge||[]){const W=K.level||K.cognitiveLevel||"";l+=`  - ${K.name}${W?" "+W:""}
`,(u=K.specificConcepts)!=null&&u.length&&(l+=`    具体概念：${K.specificConcepts.join("、")}
`)}}}}}}if(N&&N.length>0){const E=xt(N[0],M,le,Se);if(E){const V=E.replace(/^\n⚠️\s*【.*?】/,"").replace(/\n$/,"").trim();V&&(l+=`${V}
`)}}if(le||M){if(!z){l+=`
【${fe("stage_subject_adapt","学段·学科精准适配")}】
`;const te=Y({category:"生成-学段适配",stage:be,genType:B});te.length>0?l+=te[0].content+`
`:console.warn(`[instructionLib] 未找到学段适配: gradeSegment=${be}`);const f=Y({category:"生成-学科适配",matchSubject:L,stage:be,genType:B});if(f.length>0)for(const y of f)l+=y.content+`
`;else{const y=Y({category:"生成-学科适配",matchSubject:L,stage:le});if(y.length>0)for(const A of y)l+=A.content+`
`;else{const A=Y({category:"生成-学科适配",matchSubject:L});A.length>0?l+=A[0].content+`
`:console.warn(`[instructionLib] 未找到学科适配: subject=${M}, gradeSegment=${be}`)}}}const E=Y({category:"生成-学科特色",matchSubject:L,stage:le,genType:B});if(E.length>0){l+=`【${fe("subject_feature","学科特色")}】
`;for(const te of E)l+=`- ${te.content}
`}X&&(l+=`- 当前年级：${X}
`);const V=cn(M,le,_);V&&(l+=`${V}
`),z||(l+=`
⚠️ 学段约束用于控制题目难度和认知深度（如低段避免抽象推理、高段增加综合分析），但考查的知识内容以教材实际覆盖范围为准——教材有短文阅读则考查阅读，有科学探究则考查探究，不因学段标签限制内容广度。
`)}const Ye=O&&O.length>0&&O.some(E=>E.selected),Qe=de&&de.length>0&&de.some(E=>E.selected),ht=Qe&&de.every(E=>E.percentage!=null),st=St(O),He=B==="exam",ut=B==="exam"||B==="practice"||B==="special",Xe=le&&M?jt(le,I,ye,H,B):null,et=Ce||Ht(B,M,be);if(z?ht||et:Ye||Qe||et){const E=Y({category:"生成-指令块标题",subject:"",stage:"",genType:"type_design"}),V=E.length>0?E[0].content:"题型设计与难度配置";if(l+=`【${V}】
`,Ye&&!z){const f=O.filter(y=>y.selected);l+=`题型与数量分配：
`;for(const y of f)l+=`  - ${y.name}：${y.count}题`,y.score&&(l+=`，每题${y.score}分`),l+=`
`;st&&!ut&&(l+=`（以上为默认题型配置，可根据需要在右侧面板调整）
`)}if(Qe){if(Xe&&!ht)l+=`难度分布（根据${X||le}学段自动适配）：
`,l+=`  - 基础题约占${Xe.basic}%，主要考查教材基本概念和技能的掌握
`,l+=`  - 中档题约占${Xe.medium}%，适当改编教材原题，增加思维含量
`,l+=`  - 提高题约占${Xe.advanced}%，设计探究性或综合性任务
`;else if(ht){const f=de.filter(y=>y.selected);if(l+=`难度分布（手动配置）：
`,f.forEach(y=>{y.name==="基础题"&&(l+=`  - 基础题约占${y.percentage}%，主要考查教材基本概念和技能的掌握
`),y.name==="中档题"&&(l+=`  - 中档题约占${y.percentage}%，适当改编教材原题，增加思维含量
`),y.name==="提高题"&&(l+=`  - 提高题约占${y.percentage}%，设计探究性或综合性任务
`)}),Xe){const y=de.find(K=>K.name==="基础题"),A=de.find(K=>K.name==="中档题"),oe=de.find(K=>K.name==="提高题");y&&A&&oe&&(y.percentage!==Xe.basic||A.percentage!==Xe.medium||oe.percentage!==Xe.advanced)&&(l+=`（💡 指令库推荐配比：基础${Xe.basic}%/中档${Xe.medium}%/提高${Xe.advanced}%）
`)}}else Xe&&(l+=`难度分布（学段自动适配）：
`,l+=`  - 基础题约占${Xe.basic}%，主要考查教材基本概念和技能的掌握
`,l+=`  - 中档题约占${Xe.medium}%，适当改编教材原题，增加思维含量
`,l+=`  - 提高题约占${Xe.advanced}%，设计探究性或综合性任务
`);l+=`难度应有梯度，从易到难排列。
`}et&&(l+=`总分：${et}分`,Ce||(l+=`（${le==="primary"?"小学":le==="middle"?"初中":"高中"}${M}考试标准自动设置，可手动调整）`),l+=`。
`);const te=Wt(B,M,le);te&&(l+=`${te}。
`),B==="exam"&&et&&(l+=`
🔴 分值分配原则（防止凑分——必须遵守）：
`,l+=`- 先定分后出题：先根据每个知识点的考查权重确定分值，再按分值设计题目深度。严禁"先出完题再凑分数"
`,l+=`- 分值对应考查量：1-2分→简单识记/判断/选择，3-4分→理解应用/填空/简答，5-6分→综合运用/多步计算，8分以上→深层探究/论述/写作
`,l+=`- 同题型等分：同一大题下各小题分值必须一致（如选择题统一2分/题、填空题统一3分/题），禁止同一题型内混搭不同分值
`,l+=`- 常见整数值：分值取2/3/4/5/6/8/10等常见整数，严禁出现0.5/1.5/2.5等小数，严禁7/11/13等冷僻分值
`,l+=`- 验算：所有题目分数合计必须严格等于${et}分，偏差为0
`),l+=`
`}if(M){const E=[],V=Y({category:"生成-专项要求",matchSubject:L,stage:be,genType:B,specialSubType:N&&N.includes("special")?Se:""});for(const oe of V)E.push(oe.content);const te=Y({category:"生成-EduRender模板",matchSubject:L,stage:"",genType:""}),f=Y({category:"生成-EduRender模板",subject:"",stage:"",genType:""}),y=[...te];for(const oe of f)y.find(K=>K.id===oe.id)||y.push(oe);const A=["formula","chart","axis","shapes","force","circuit","optics","atom","image"];y.sort((oe,K)=>{const W=A.findIndex(ae=>oe.id.includes(ae)),re=A.findIndex(ae=>K.id.includes(ae));return(W>=0?W:99)-(re>=0?re:99)});for(const oe of y){const K=oe.name.replace("【EduRender模板】","");E.push(`【EduRender Studio——${K}】
${oe.content}`)}V.length===0&&y.length===0&&console.warn(`[instructionLib] 未找到专项要求+EduRender模板: subject=${M}, gradeSegment=${be}`),E.length>0&&(l+=`【${fe("graphic_formula","图形/图表/公式/配图专项指令")}】
`,E.forEach(oe=>{l+=oe+`
`}),l+=`
`)}if(M){const E=N&&N.length===1?N[0]:void 0,V=Y({category:"生成-学科标记",matchSubject:L,stage:"",genType:E}),te=le?Y({category:"生成-学科标记",matchSubject:L,stage:le,genType:E}):[],f=[...V];for(const y of te)f.find(A=>A.id===y.id)||f.push(y);if(f.length>0){for(const y of f)l+=`${y.content}
`;l+=`
`}}if(B==="summary"){const E=Y({category:"生成-输出格式",matchSubject:L,stage:le,genType:"summary"});if(E.length>0){const V=E.map(te=>te.content).join(`
`);l+=`【${fe("format_summary","知识点总结格式规范")}】
${V}
`}else console.warn("[instructionLib] 未找到输出格式: summary")}else if(B==="errorbook"){const E=Y({category:"生成-输出格式",matchSubject:L,stage:le,genType:"errorbook"});if(E.length>0){const V=E.map(te=>te.content).join(`
`);l+=`【${fe("format_errorbook","错题本格式规范")}】
${V}
`}else console.warn("[instructionLib] 未找到输出格式: errorbook")}else if(B==="preview"){const E=Y({category:"生成-输出格式",matchSubject:L,stage:le,genType:"preview"});if(E.length>0){const V=E.map(te=>te.content).join(`
`);l+=`【${fe("format_preview","课前预习格式规范")}】
${V}
`}else console.warn("[instructionLib] 未找到输出格式: preview")}else if(B==="dictation"){const E=Y({category:"生成-输出格式",matchSubject:L,stage:le,genType:"dictation"});if(E.length>0){const V=E.map(te=>te.content).join(`
`);l+=`【${fe("format_dictation","听写/默写格式规范")}】
${V}
`}else console.warn("[instructionLib] 未找到输出格式: dictation")}else if(B==="reading"){const E=Y({category:"生成-输出格式",matchSubject:L,stage:le,genType:"reading"});if(E.length>0){const V=E.map(te=>te.content).join(`
`);l+=`【${fe("format_reading","阅读训练格式规范")}】
${V}
`}else console.warn("[instructionLib] 未找到输出格式: reading")}else{const E=Y({category:"生成-输出格式",matchSubject:L,stage:le,genType:B,specialSubType:B==="special"?Se:""});if(E.length>0){const V=E.map(te=>te.content).join(`
`);l+=`【${fe("format_exam","试卷/练习格式规范")}】
${V}
`}else console.warn(`[instructionLib] 未找到输出格式: genType=${B}`);l+=`
`}if(N&&N.length>0&&L){const E=nn(N[0],L,le,I,X,be,Se);E&&(l+=`
${E}
`)}if(J&&J.length>0){const E=Y({category:"生成-指令块标题",subject:"",stage:"",genType:"template"}),V=E.length>0?E[0].content:"模板精准对标";l+=`【${V}】
`,l+=`请深度对标以下模板的风格特征（题型结构、设问方式、语言表达、难度层次），作为本次生成的质量基准：
`;for(const f of J){const y=f.selectedChapters||[];if(l+=`
📋 《${f.name}》
`,y.length>0)for(const A of y)l+=`  - ${A.title}（第${A.start}-${A.end}页）
`;if(f.analysis){if(!z){const A=f.analysis.结构分析||f.analysis.structure||[];if(A.length>0){l+=`  结构分析：
`;for(const W of A)l+=`    - ${W.大题||W.题型}：${W.小题数量||0}小题，共${W.大题分值||0}分`,W.设问风格&&(l+=`，设问：${W.设问风格}`),W.难度&&(l+=`，难度：${W.难度}`),l+=`
`}const oe=f.analysis.总分||f.analysis.totalScore||0,K=f.analysis.总题数||f.analysis.questionCount||0;oe&&(l+=`  总分：${oe}分
`),K&&(l+=`  总题数：${K}题
`)}if(f.analysis.questionCards&&f.analysis.questionCards.length>0&&!z){const A=f.analysis.questionCards;l+=`
  【模板真题示例——以下为模板典型题目，供参考风格和结构，无需机械模仿】
`;const oe=["选择题","填空题","判断题","解答题","计算题","应用题","简答题"],K=[];for(const ae of oe){const pe=A.filter(Ue=>Ue.type===ae).slice(0,2);if(K.push(...pe),K.length>=5)break}if(K.length<3){for(const ae of A)if(!K.find(me=>me.number===ae.number)&&(K.push(ae),K.length>=3))break}for(const ae of K)l+=`  ▶ 第${ae.number}题（${ae.type}，${ae.difficulty||"未知"}难度，${ae.score||"?"}分）：
`,l+=`    题干：${ae.stem}
`,ae.options&&ae.options.length>0&&(l+=`    选项：${ae.options.map((me,pe)=>String.fromCharCode(65+pe)+". "+me).join("；")}
`),ae.questionFeature&&(l+=`    设问特征：${ae.questionFeature}
`);const W=A.filter(ae=>ae.stem).map(ae=>ae.stem.length);if(W.length>0){const ae=Math.round(W.reduce((Ue,Ie)=>Ue+Ie,0)/W.length),me=Math.min(...W),pe=Math.max(...W);l+=`  题干长度参考：平均${ae}字（范围${me}~${pe}字），供参考，可根据知识点需要灵活调整。
`}const re=A.length;if(re>0){const ae={};A.forEach(Ae=>{ae[Ae.type]=(ae[Ae.type]||0)+1});const me=Object.entries(ae).map(([Ae,Ot])=>`${Ae}占${Math.round(Ot/re*100)}%`).join("，"),pe={};A.forEach(Ae=>{pe[Ae.difficulty]=(pe[Ae.difficulty]||0)+1});const Ue=Object.entries(pe).map(([Ae,Ot])=>`${Ae}占${Math.round(Ot/re*100)}%`).join("，"),Ee=A.filter(Ae=>{var Ot;return Ae.type==="选择题"&&((Ot=Ae.options)==null?void 0:Ot.length)}).map(Ae=>Ae.options.length),ze=Ee.length>0?Math.round(Ee.reduce((Ae,Ot)=>Ae+Ot,0)/Ee.length):4,Z=A.filter(Ae=>{var Ot,gn;return((Ot=Ae.questionFeature)==null?void 0:Ot.includes("情境"))||((gn=Ae.stem)==null?void 0:gn.length)>50}),Ne=Math.round(Z.length/re*100),bt=A.map(Ae=>Ae.difficulty).findIndex(Ae=>Ae==="较难"||Ae==="提高"),Bt=bt>0?`前${bt}题以基础为主，从第${bt+1}题开始出现较难题`:"难度均匀分布";if(l+=`
  【模板量化特征——供参考】
`,l+=`  - 题型分布：${me}
`,l+=`  - 难度分布：${Ue}
`,l+=`  - 难度递进：${Bt}
`,l+=`  - 选择题选项数：${ze}个
`,l+=`  - 情境融入比例：约${Ne}%（${Z.length}/${re}题有情境）
`,(i=f.analysis)!=null&&i.languageStyle){const Ae=f.analysis.languageStyle;l+=`
  【语言风格指纹——供参考】
`,Ae.avgSentenceLength&&(l+=`  - 平均句长：${Ae.avgSentenceLength}字（供参考，可根据知识点需要灵活调整）
`),(p=Ae.commonPatterns)!=null&&p.length&&(l+=`  - 高频句式：${Ae.commonPatterns.join("、")}
`),(P=Ae.connectors)!=null&&P.length&&(l+=`  - 连接词偏好：${Ae.connectors.join("、")}
`),Ae.contextIntro&&(l+=`  - 情境引入方式：${Ae.contextIntro}
`),Ae.personReference&&(l+=`  - 指代方式：${Ae.personReference}
`),Ae.tone&&(l+=`  - 语气特征：${Ae.tone}
`),Ae.sampleSentence&&(l+=`  - 典型句式示例：「${Ae.sampleSentence}」
`)}if((m=f.analysis)!=null&&m.formatStyle){const Ae=f.analysis.formatStyle;l+=`
  【格式排版指纹——供参考】
`,Ae.spacingBetweenQuestions!==void 0&&(l+=`  - 题目间距：${Ae.spacingBetweenQuestions?"题间有空行":"题间紧凑排列"}
`),Ae.indentation&&(l+=`  - 缩进方式：${Ae.indentation}
`),Ae.scorePosition&&B!=="practice"&&(l+=`  - 分数标注位置：${Ae.scorePosition}
`),Ae.chartDescriptionFormat&&(l+=`  - 图表说明格式：${Ae.chartDescriptionFormat}
`)}}}}else l+=`  （请先点击「分析模板」获取模板特征）
`}if(!z&&J&&J.length>0){const f=J[0];if(((w=($=f.analysis)==null?void 0:$.questionCards)==null?void 0:w.length)>0){const y=f.analysis.questionCards,A=y.map(Ee=>Ee.stem||"").filter(Boolean),oe=A.length>0?Math.round(A.reduce((Ee,ze)=>Ee+ze.length,0)/A.length):0,K=A.filter(Ee=>Ee.length<30).length,W=A.filter(Ee=>Ee.length>80).length,re=y.filter(Ee=>{var ze;return((ze=Ee.questionFeature)==null?void 0:ze.includes("直接设问"))||(Ee.stem||"").match(/^(请|试|计算|求解|证明|判断|选择|填空)/)}).length,ae=y.filter(Ee=>{var ze;return((ze=Ee.questionFeature)==null?void 0:ze.includes("情境"))||(Ee.stem||"").length>60}).length;l+=`
  【语言风格特征——供参考】
`,l+=`  - 题干平均长度：${oe}字（短题干≤30字：${K}题，长题干≥80字：${W}题）
`,l+=`  - 设问方式：直接设问${re}题，情境设问${ae}题
`,oe<40?l+=`  - 风格倾向：简洁精炼型，题干短小直接，适合低年级或基础训练
`:oe>70?l+=`  - 风格倾向：情境丰富型，题干包含完整情境描述，适合高年级或综合应用
`:l+=`  - 风格倾向：均衡型，题干长度适中，兼顾情境与效率
`;const me=A.filter(Ee=>Ee.includes("请")).length,pe=A.filter(Ee=>Ee.includes("试")).length,Ue=A.filter(Ee=>Ee.includes("已知")).length;if(me>0||pe>0||Ue>0){l+="  - 语言习惯：";const Ee=[];me>0&&Ee.push(`使用"请"引导（${me}题）`),pe>0&&Ee.push(`使用"试"引导（${pe}题）`),Ue>0&&Ee.push(`使用"已知"陈述（${Ue}题）`),l+=Ee.join("，")+`
`}const Ie=y.filter(Ee=>Ee.answer);if(Ie.length>0){const Ee=Ie.map(Z=>(Z.answer||"").length),ze=Math.round(Ee.reduce((Z,Ne)=>Z+Ne,0)/Ee.length);l+=`  - 答案格式：平均${ze}字，`,ze<10?l+=`简洁型（适合填空/选择）
`:ze<50?l+=`标准型（适合计算/简答）
`:l+=`详细型（适合解答/论述）
`}}}if(l+=`
请参考模板在以下维度的特征进行设计：题型结构、${B!=="practice"?"分值分布、":""}设问风格、语言表达、难度层次。
`,l+=`可适量引用模板中的优秀题目（不超过30%），但大部分题目需基于教材内容重新命题，鼓励在模板基础上进行创新设计。

`,!z){const f=J[0];if((g=f==null?void 0:f.analysis)!=null&&g.languageStyle){const y=f.analysis.languageStyle;l+=`
【${fe("template_style","模板风格参考——逐题生成时可参考")}】
`,y.avgSentenceLength&&(l+=`- 题干平均句长约${y.avgSentenceLength}字
`),(T=y.commonPatterns)!=null&&T.length&&(l+=`- 优先使用句式：${y.commonPatterns.slice(0,3).join("、")}
`),y.tone&&(l+=`- 语气：${y.tone}
`),y.sampleSentence&&(l+=`- 风格参考：「${y.sampleSentence}」
`)}if((x=f==null?void 0:f.analysis)!=null&&x.formatStyle){const y=f.analysis.formatStyle;y.scorePosition&&B!=="practice"&&(l+=`- 分值位置：${y.scorePosition}
`),y.spacingBetweenQuestions!==void 0&&(l+=`- 题间距：${y.spacingBetweenQuestions?"题间空行":"紧凑排列"}
`)}}const te=Y({category:"生成-模板禁止项",stage:le});te.length>0&&(l+=te[0].content+`
`),l+=`
`}if(l+=`
`,!z){const E=Y({category:"生成-题目质量标准",subject:"",stage:"",genType:B}),te=Y({category:"生成-题目质量标准",subject:"",stage:be,genType:B}).filter(A=>!(!A.stage||A.stage===""||A.subject!=="")),y=(M?Y({category:"生成-题目质量标准",matchSubject:L,stage:"",genType:B}):[]).filter(A=>A.subject&&A.subject!=="");E.length>0?(l+=`【${fe("quality_standard","题目质量标准")}】${E[0].content}
`,te.length>0&&te[0].content!==E[0].content&&(l+=te[0].content+`
`),y.length>0&&(l+=`
【${fe("subject_supplement","学科补充标准")}】
${y[0].content}
`)):console.warn(`[instructionLib] 未找到题目质量标准: stage=${le}, subject=${M}`),l+=`
`}if(L){const E=qt(B,L,le,Se),V=On(B,L,le),te=$n(L,B);if(E||V||te){const f=Y({category:"生成-答案与解析规范",subject:"",stage:""}),y=fe("answer_spec","答案与解析规范"),A=f.length>0?`【${y}】${f[0].content}`:`【${y}】以下为教辅级答案质量标准，请严格遵守以确保输出质量对标市面教辅：`;l+=A+`
`,E&&(l+=E+`
`),V&&(l+=V+`
`),te&&(l+=te+`
`),l+=`
`}}if(M){const E=Y({category:"生成-答题模板",matchSubject:L,stage:"",genType:B});E.length>0&&(l+=`【${fe("answer_template","答题模板")}】${E[0].content}

`)}if(!z&&M){const E=Y({category:"生成-术语规范",matchSubject:L,stage:"",genType:B});E.length>0&&(l+=`【${fe("terminology","术语规范")}】${E[0].content}

`)}if(Je){const E=Y({category:"生成-原题引用",subject:"",stage:"",genType:B});E.length>0?l+=`【${fe("original_quote","原题引用")}】${E[0].content}
`:console.warn("[instructionLib] 未找到原题引用条目")}const xe=[],Tt=Y({category:"生成-禁止项",subject:"",stage:"",genType:B}).filter(E=>!E.subject&&!E.stage);if(Tt.length>0&&xe.push(Tt[0].content),L){const V=Y({category:"生成-禁止项",matchSubject:L,stage:"",genType:B}).filter(y=>y.subject&&y.subject.trim()!==""&&!y.stage);V.length>0&&xe.push(V[0].content);const f=Y({category:"生成-禁止项",matchSubject:L,stage:be,genType:B}).filter(y=>y.subject&&y.subject.trim()!==""&&y.stage&&y.stage!=="");f.length>0&&xe.push(f[0].content)}xe.length>0?l+=`【${fe("ban_general","禁止项")}】
${xe.join(`
`)}
`:console.warn("[instructionLib] 未找到任何禁止项"),l+=`
`;const rn=Y({category:"生成-通用约束",subject:"",stage:le,genType:B}).filter(E=>!(z&&E.id==="frag_avoid_direct_copy"||E.id.startsWith("frag_cognitive")&&le==="primary"&&(I&&!E.content.includes("低段（1-2年级）")||ye&&!E.content.includes("中段（3-4年级）")||H&&!E.content.includes("高段（5-6年级）"))));if(rn.length>0){l+=`
【${fe("general_constraint","通用约束")}】
`;for(const E of rn)l+=`- ${E.content}
`}if(M){const E=$s(M,le,I,ye,H,X);E&&(l+=E+`

`)}if((U||D)&&(l+=`【${fe("scope_style","命题范围与风格")}】
`),U){const E=Y({category:"生成-范围标签",genType:U}),V=E.length>0?E[0].content:"默认范围";l+=`范围类型：${V}。
`;const te=ee.reduce((f,y)=>{var A;return f+(((A=y.selectedChapters)==null?void 0:A.length)||0)},0);if(ie&&te>1){const f=Y({category:"生成-范围扩展",genType:U});f.length>0&&(l+=f[0].content.replace("{chapterCount}",te)+`
`)}}if(D){const E=Y({category:"生成-命题风格",genType:D});if(E.length>0?l+=`命题风格：${E[0].content}`:console.warn(`[instructionLib] 未找到命题风格: propositionStyle=${D}`),le&&M&&(D==="context_fusion"||D==="unified_context")){const V=Y({category:"生成-情境方向",matchSubject:L,stage:le});V.length>0&&(l+=`
${V[0].content}。`)}l+=`

`}if((!z||D&&["context_fusion","unified_context"].includes(D))&&(le||M)){const E=Y({category:"生成-情境要求",subject:"",stage:le,genType:B}),V=M?Y({category:"生成-情境要求",matchSubject:L,stage:"",genType:B}):[];if(E.length>0||V.length>0){l+=`【${fe("context_req","情境要求")}】
`,E.length>0&&(l+=`- ${E[0].content}
`);for(const te of V)l+=`- ${te.content}
`;l+=`
`}}if(Le&&Le.length>0){const E=Y({category:"生成-指令块标题",subject:"",stage:"",genType:"supplement"}),V=E.length>0?E[0].content:"资料类型补充约束";l+=`
【${V}】
`;for(const te of Le)l+=`- ${te.content}
`;l+=`
`}const Oe=Y({category:"生成-内容规范",subject:"",stage:"",genType:B}),ot=Y({category:"生成-特殊要求",subject:"",stage:"",genType:B}),Re=[];Oe.length>0&&Re.push(Oe[0].content),ot.length>0&&Re.push(ot[0].content),Re.length>0&&(l+=`【${fe("content_norm","内容与特殊要求")}】
${Re.join(`
`)}

`);const mt=new Set(["生成-学段适配","生成-学科适配","生成-资料类型结构","生成-学科禁止项","生成-情境方向","生成-学科特色","生成-题量控制","生成-难度控制","生成-情境要求","生成-年级边界提示","生成-快捷学段提示","生成-难度配置","生成-核心任务","生成-题型分布建议","生成-命题风格","生成-模板禁止项","生成-范围标签","生成-学科核心素养","生成-禁止项","生成-通用约束","生成-原题引用","生成-内容规范","生成-输出格式","生成-学科标记","生成-EduRender模板","生成-专项要求","生成-题型专项要求","生成-题目质量标准","生成-答案与解析规范","生成-质量范例","生成-知识点全覆盖","生成-主观题评分标准","生成-术语规范","生成-答题模板","生成-特殊要求","生成-知识边界","生成-时间分配","生成-最终输出规则","生成-格式尾约束","生成-指令块标题","生成-角色身份","生成-标题格式","生成-答案区强制锚定","生成-顶层约束","生成-尾约束","生成-范围扩展","生成-多章节标题","分析-文本分析规范","分析-分析模板示例","分析-分析提取要求","分析-知识图谱构建"]),Me=(je||[]).filter(E=>!mt.has(E.category));if(Me.length>0){const E=Me.filter(te=>te.builtin).map(te=>te.category),V=[...new Set(E)];V.length>0&&console.warn("[buildGenerationInstruction] ⚠️ 内置 fragment 穿透双防线！以下 category 需加入 _ui_handledCategories：",V)}if(Me.length>0){const E={},V=new Set;for(const y of Me)V.has(y.content)||(V.add(y.content),E[y.category]||(E[y.category]=[]),E[y.category].push(y));const te=Y({category:"生成-指令块标题",subject:"",stage:"",genType:"user_supplement"}),f=te.length>0?te[0].content:"用户补充指令";l+=`【${f}】
`;for(const y of Object.values(E))for(const A of y)l+=`- ${A.content}
`;l+=`
`}const Mt=Y({category:"生成-顶层约束",subject:"",stage:"",genType:B});Mt.length>0&&!z&&(l+=`
【${fe("top_constraint","顶层约束")}】
${Mt[0].content}

`),z||(l+=`【输出格式重申】请严格遵循上方各节中的输出格式规范与结构要求。输出完整 HTML 文档，禁止 Markdown、禁止前言。

`);const Pt=Y({category:"生成-尾约束",subject:"",stage:"",genType:B});Pt.length>0&&!z&&(l+=`
【${fe("tail_constraint","尾约束")}】
${Pt[0].content}

`);const Lt=Y({category:"生成-格式尾约束",subject:"",stage:"",genType:B});return Lt.length>0&&(l+=`
${Lt[0].content}
`),l}catch(ee){throw console.error("[buildGenerationInstruction] :",ee),ee}},wn=async h=>{var we,he,G,ce,Fe,le,M,L;const{instruction:u,genType:i,selectedBooks:p,contentCards:P,knowledgeMap:m,contextFramework:$,templateInfo:w}=h,g=p==null?void 0:p[0];g!=null&&g.subject,g!=null&&g.stage;const T=i==="exam";let x=0;const ee=u.match(/总分[：:]\s*(\d+)/);ee&&(x=parseInt(ee[1]));const J=await Qt("generation"),U=pn(J.textModel||J.model);n.value=`步骤 3/4：整卷生成 [${U}]...`,t.value=40;let D=`【知识点清单】
`+(((we=m.knowledgePoints)==null?void 0:we.join("、"))||"教材核心知识点")+`
`;D+=`
【重难点】
`+(((he=m.keyDifficulties)==null?void 0:he.join("、"))||"教材重难点")+`
`;const N=m.knowledgeGraph||[];if(N.length>0){const X=N.length,_=N.reduce((I,ye)=>{var H;return I+(((H=ye.bigConcepts)==null?void 0:H.reduce((B,be)=>{var fe;return B+(((fe=be.coreKnowledge)==null?void 0:fe.length)||0)},0))||0)},0);D+=`
【层级知识图谱】（`+X+"个单元，"+_+`个核心知识点）
`,D+=JSON.stringify(N,null,2)+`
`}let q="";if(P&&P.length>0){const X=[];if((G=m==null?void 0:m.knowledgePoints)!=null&&G.length&&X.push(...m.knowledgePoints),(ce=m==null?void 0:m.knowledgeGraph)!=null&&ce.length)for(const I of m.knowledgeGraph)for(const ye of I.bigConcepts||[])for(const H of ye.coreKnowledge||[])H.name&&X.push(H.name),(Fe=H.specificConcepts)!=null&&Fe.length&&X.push(...H.specificConcepts);const _=[...new Set(X)];if(_.length>0){const I=_.map(ye=>({knowledgePoint:ye}));q=as(P,I,6e3),q&&(q=`【🔴 精准原文检索——以下片段为生成题目的强制性依据，命题必须紧扣原文定义与表述，不可脱离原文臆造知识点】
`+q),console.log(`📚 精准原文检索：${_.length} 个 KP → 命中 ${(q.match(/【/g)||[]).length} 个原文片段`)}if(!q){let I="";const ye=P.length,H=Math.max(400,Math.floor(4e3/Math.max(ye,1))),B=Math.max(3e3,ye*400);let be=0;for(const fe of P){if(!fe.segments||fe.segments.length===0)continue;let lt=0;for(const ve of fe.segments){if(lt+ve.text.length>H||be+ve.text.length>B)break;I+=`【${fe.chapterTitle}】${ve.text}
`,lt+=ve.text.length,be+=ve.text.length}if(be>=B)break}q=I||"(教材原文片段)"}}const de={exam:"基础约50%，中档约30%，提高约20%",practice:"基础巩固→能力提升→拓展探究三层递进",special:"入门练→进阶练→挑战练三道阶梯",preview:"从已学知识回顾到新课内容感知，难度以复习和预习为主，不设过度挑战",reading:"从信息提取到深层理解，题目由浅入深层层递进",summary:"从基础概念到综合应用，知识归纳由简到繁",dictation:"从常用字词到重点词汇，按教材出现顺序由易到难排列",errorbook:"从高频错题到易混淆知识点，按错误类型分类整理"}[i]||"题目从易到难排列",Je=((g==null?void 0:g.selectedChapters)||[]).map(X=>X.title).join("|")||"_all_",Se=tt(i,Je),Le=`<!-- ctx:${(p==null?void 0:p.flatMap(X=>(X.selectedChapters||[]).map(_=>{var I;return((I=_.title)==null?void 0:I.slice(0,30))||""})).join("|").slice(0,120))||Date.now().toString(36)}|${Math.random().toString(36).slice(2,6)} -->
`;let ie=u.replace(/\{genTypeLabel\}/g,Se).replace(/\{diffRatio\}/g,de);n.value="步骤 3/4：开始生成整卷...",t.value=42;let C=Le+jn()+`
`;if(C+=ie,C+=`

⚠️ 以上为完整指令，请严格遵循每一个细节要求，生成完整 HTML 资料。

`,C+=D,C+=`

【教材原文】
`,C+=q,C+=`
`,$){const X=$.replace(/蓝图中的每道题/g,"整卷中的每道题").replace(/在 sourceChapter 字段中/g,"在题目中");C+=X+`
`}w&&(C+=w+`
`);const z=3;let l=null;for(let X=0;X<z;X++)try{if(X>0){const fe=Math.min(3e3*Math.pow(2,X-1),15e3);console.log(`🔄 整卷生成第${X+1}次尝试，等待${fe/1e3}秒...`),await new Promise(lt=>setTimeout(lt,fe)),n.value=`步骤 3/4：重试整卷生成 [${U}]...（第${X+1}次）`}if((le=s.value)!=null&&le.signal.aborted)throw new Error("生成已取消");let I=await ne(C,{taskType:"generation",timeout:3e5,allowContinuation:!0,retries:0});I=I.replace(/^\`\`\`html?\s*\n?/i,"").replace(/\n?\`\`\`\s*$/i,"");const ye=I.match(/<body[^>]*>([\s\S]*)<\/body>/i);ye&&(I=ye[1]);let H=I.match(/<p class="question"[^>]*>[\s\S]*?<\/p>/g)||[];if(H.length===0&&(H=I.match(/<(?:p|div|li)\s+class="[^"]*question[^"]*"[^>]*>[\s\S]*?<\/(?:p|div|li)>/g)||[]),H.length===0&&(H=I.match(/<p[^>]*>\s*(?:\d+|[一二三四五六七八九十]+)[\.、．)）]\s*[^<]*<\/p>/g)||[],H.length>0&&console.warn(`⚠️ 题目解析降级：未匹配到 <p class="question">，改用题号模式匹配到 ${H.length} 题`)),H.length===0&&(H=I.match(/<(?:div|li|p)[^>]*>\s*(?:\d+|[一二三四五六七八九十]+)[\.、．)）]\s*[^<]*<\/(?:div|li|p)>/g)||[],H.length>0&&console.warn(`⚠️ 题目解析降级：未匹配到 <p> 题号标签，改用泛化题号模式匹配到 ${H.length} 题`)),H.length===0&&I.length>1e3){const fe=(I.match(/<(?:p|div|h\d|li)\b[^>]*>/g)||[]).length;console.warn(`⚠️ 题目解析完全失败：${I.length} 字符内容中未匹配到任何题目格式标签（块级标签=${fe}）。模型可能未遵守 <p class="question"> 格式规范，请检查生成结果`),H=Array(Math.max(1,Math.floor(fe*.4))).fill("<p>(解析失败，见原始内容)</p>")}const B=H,be=H.map((fe,lt)=>{const ge=fe.replace(/<[^>]+>/g,"").trim().match(/^(\d+)[\.、．]/);return{number:ge?parseInt(ge[1]):lt+1,type:"未知",knowledgePoint:"",difficulty:"基础",score:T&&H.length>0?Math.round(x/H.length):0,sourceChapter:""}});return console.log(`✅ 整卷生成成功：${H.length} 道题，${I.length} 字符`),H.length===0&&I.length>5e3&&console.warn(`⚠️ 题目计数为 0 但内容丰富（${I.length} 字符），HTML 格式可能偏离规范。生成内容本身可能正常，但后续题目统计/质量校验将跳过。`),t.value=85,{success:!0,content:I,generatedQuestions:B,parsedBlueprint:be,blueprint:""}}catch(_){if(console.error(`整卷生成失败 (attempt ${X+1}/${z}):`,_.message),l=_,(M=s.value)!=null&&M.signal.aborted||(L=_.response)!=null&&L.status&&_.response.status>=400&&_.response.status<500&&_.response.status!==429)throw _}throw new Error(`整卷生成失败：已重试${z}次。最后一次错误：${(l==null?void 0:l.message)||"未知错误"}
请检查 DeepSeek API 配置或网络连接后重试。`)},bn=async(h,u,i,p,P=0,m=!1)=>{var w,g,T,x,ee,J,U,D,N,q,O,de,Ce,Je,Se,je,Le,ie,C,z,l,we,he,G,ce,Fe,le,M,L,X,_;!d&&!b&&!ke&&(c=null),!d&&!ke&&(v=null,S=null),b=!1,d=null,R=null,F=null,s.value&&Ps(s.value),s.value=new AbortController,Ms(s.value),e.value=!0,t.value=0;try{if(!i||!Array.isArray(i)||i.length===0)return console.error("❌ 生成失败：未选择教材"),e.value=!1,{success:!1,error:"未选择教材"};if(!((await Qt("generation")).engine==="deepseek")){if(u==="summary")return await ws(h,u,i,p,m);if(u==="errorbook")return await bs(h,u,i,p,m);if(u==="preview")return await Ts(h,u,i,p,m);if(u==="dictation")return await Cs(h,u,i,p,m);if(u==="reading")return await Ss(h,u,i,p,m)}const H=((w=i==null?void 0:i[0])==null?void 0:w.stage)||"";let B,be;if(d)be=d,B=v,d=null,console.log("[逐课时] 复用已缓存的 Step1-2 结果，知识点数:",(g=be.knowledgePoints)==null?void 0:g.length);else if(ke){const f=ke;if(!v||!c)console.log("[逐章] 首次调用，先执行完整 Step1-2 提取..."),B=await mn(i,ne,ft,(y,A)=>{n.value=y,t.value=A}),v=B,be=await Mn(B,i,ne,ft,(y,A)=>{n.value=y,t.value=A}),c=be,B=B.filter(y=>y.chapterTitle===f),be={...be,knowledgePoints:(be.knowledgePoints||[]).filter(y=>y.sourceChapter===f),knowledgeGraph:(be.knowledgeGraph||[]).filter(y=>(y.coreKnowledge||[]).some(A=>A.sourceChapter===f)||y.sourceChapter===f).map(y=>({...y,coreKnowledge:(y.coreKnowledge||[]).filter(A=>A.sourceChapter===f)})).filter(y=>y.coreKnowledge.length>0)};else{B=v.filter(A=>A.chapterTitle===f);const y=c;be={...y,knowledgePoints:(y.knowledgePoints||[]).filter(A=>A.sourceChapter===f),knowledgeGraph:(y.knowledgeGraph||[]).filter(A=>(A.coreKnowledge||[]).some(oe=>oe.sourceChapter===f)||A.sourceChapter===f).map(A=>({...A,coreKnowledge:(A.coreKnowledge||[]).filter(oe=>oe.sourceChapter===f)})).filter(A=>A.coreKnowledge.length>0)}}console.log(`[逐章] 「${f}」过滤后：${B.length} cards, ${(T=be.knowledgePoints)==null?void 0:T.length} KPs`)}else B=await mn(i,ne,ft,(f,y)=>{n.value=f,t.value=y}),be=await Mn(B,i,ne,ft,(f,y)=>{n.value=f,t.value=y});if(js.indexContentCards(B),u==="practice"&&!c){const f=Ke(be);if(f.length>1){console.log(`[课时切分] 检测到 ${f.length} 个课时：`,f.map(A=>`${A.periodName}(${A.kpCount}KP)`).join(", ")),c=be,v=B,S=h,R=i,F=p,a.value={periods:f,knowledgeMap:be,contentCards:B,instruction:h,selectedBooks:i,selectedTemplates:p},e.value=!1;const y={success:!0,needsPeriodConfirm:!0,periods:f};return console.log("[课时切分] generate() 即将返回 needsPeriodConfirm:",JSON.stringify({success:y.success,needsPeriodConfirm:y.needsPeriodConfirm,periodCount:(x=y.periods)==null?void 0:x.length})),y}}const fe=await Qt("blueprint"),lt=pn(fe.textModel||fe.model);n.value=`步骤 3/5：命题规划 [${lt}]...`,t.value=40;let ve="";const ge=u==="exam"||u==="practice"||u==="special"||u==="review",ue=u==="exam";if(p&&p.length>0){const f=p[0];if(ve=`
模板参考：
`,(J=(ee=f.analysis)==null?void 0:ee.structure)!=null&&J.length){const y=f.analysis.结构分析||f.analysis.structure||[];ve+=`结构分析：
`;for(const A of y)ue?ve+=`  ${A.大题||A.题型}：${A.小题数量||0}小题×${A.每小题分值||0}分，共${A.大题分值||0}分`:ve+=`  ${A.大题||A.题型}：${A.小题数量||0}题`,A.设问风格&&(ve+=`，设问：${A.设问风格}`),A.难度&&(ve+=`，难度：${A.难度}`),ve+=`
`}if(ue){const y=((U=f.analysis)==null?void 0:U.总分)||((D=f.analysis)==null?void 0:D.totalScore)||0;y&&(ve+=`总分：${y}分
`)}}let Ye="";const Qe=["unified_context","context_fusion"],ht=h.match(/命题风格[：:]\s*([^\n]+)/),st=ht?ht[1]:"";if(Qe.some(f=>st.includes(f))){n.value="步骤 3/5：构建情境框架...",t.value=42;try{const f=i==null?void 0:i[0],y=(f==null?void 0:f.subject)||"",A=(f==null?void 0:f.stage)||"",oe=Kt(y,A),K=(f==null?void 0:f.grade)||"",W=Xa(oe,A,3);if(W.length>0){const re=W[0];Ye=`
【统一情境框架——所有命题必须在此情境下展开】

📖 情境名称：${re.name}
📝 背景：${re.description}

📋 可用场景（每个场景可容纳多道题）：
${re.scenes.map((ae,me)=>`  场景${me+1}「${ae}」`).join(`
`)}

📚 适合考查知识点：${((N=re.suitableTopics)==null?void 0:N.join("、"))||"教材核心知识点"}

📐 叙事弧线：从简单到复杂递进，场景之间有逻辑连贯性

⚠️ 【关键约束】
1. 蓝图中的每道题必须标注所属场景（在 sourceChapter 字段中注明场景名）
2. 同一场景内的题目要有逻辑连贯性
3. 场景顺序应从简单到复杂，与难度递进匹配
4. 知识点的考查应均匀分布在不同场景中
`,console.log(`✅ 使用学科情境库：${oe}·${A}·${re.name}`)}else{console.log("⚠️ 学科情境库无匹配，AI动态生成...");const re=`你是一位${A}${K}${oe}教学专家。请为一份教辅资料设计一个贯穿全卷的统一情境/主题故事。

【要求】
1. 情境必须与学科内容和学生生活紧密相关
2. 情境应能自然地容纳不同题型和知识点
3. 情境要有故事性或任务性，而非简单的背景装饰

【输出格式】必须返回严格 JSON：
{
  "name": "情境名称（15字以内）",
  "background": "情境背景描述（50字以内）",
  "mainTask": "核心任务或问题（30字以内）",
  "scenes": [
    {
      "name": "场景名称",
      "description": "场景描述（20字以内）",
      "suitableTopics": ["适合考查的知识点1", "知识点2"],
      "suitableTypes": ["适合的题型1", "题型2"]
    }
  ],
  "narrativeArc": "情境叙事弧线描述（如何从开头发展到结尾，30字以内）"
}

要求 scenes 至少3个场景，最多5个。场景之间要有逻辑递进关系。只返回 JSON。`,ae=await ne(re,{taskType:"blueprint",temperature:.5,timeout:6e4});try{const me=await ft(ae,pe=>ne(pe,{temperature:.3,taskType:"generation"}),"情境框架","generation");Ye=`
【统一情境框架——所有命题必须在此情境下展开】

📖 情境名称：${me.name}
📝 背景：${me.background}
🎯 核心任务：${me.mainTask}

📋 可用场景（每个场景可容纳多道题）：
${(me.scenes||[]).map((pe,Ue)=>`  场景${Ue+1}「${pe.name}」：${pe.description}
     → 适合题型：${(pe.suitableTypes||[]).join("、")}
     → 适合知识点：${(pe.suitableTopics||[]).join("、")}`).join(`
`)}

📐 叙事弧线：${me.narrativeArc||"从易到难递进"}

⚠️ 【关键约束】
1. 蓝图中的每道题必须标注所属场景（在 sourceChapter 字段中注明场景名）
2. 同一场景内的题目要有逻辑连贯性
3. 场景顺序应从简单到复杂，与难度递进匹配
4. 知识点的考查应均匀分布在不同场景中
`,console.log("✅ AI情境框架生成成功:",me.name)}catch(me){console.warn("情境框架解析失败，跳过情境融入:",me.message),Ye=""}}}catch(f){console.warn("情境框架生成失败，跳过情境融入:",f.message),Ye=""}}const Xe=(await Qt("generation")).engine==="deepseek";let et="",se=[],xe="",rt=[];if(Xe){n.value="步骤 3/4：整卷生成...",t.value=40;try{const f=await wn({instruction:h,genType:u,selectedBooks:i,selectedTemplates:p,contentCards:B,knowledgeMap:be,contextFramework:Ye,templateInfo:ve});xe=f.content,rt=f.generatedQuestions,se=f.parsedBlueprint,et="",console.log(`✅ 整卷生成完成：${rt.length} 道题，${xe.length} 字符`)}catch(f){throw console.error("整卷生成失败:",f.message),f}}else{const y={exam:"结构化命题蓝图（双向细目表）",practice:"结构化课时练习蓝图",special:"结构化专项训练蓝图",preview:"课前预习内容规划",reading:"阅读理解训练蓝图",summary:"知识总结内容规划",dictation:"听写/默写内容规划",errorbook:"错题整理规划"}[u]||"结构化命题蓝图",A=`${(()=>{const W={exam:"你是一位命题专家",practice:"你是一位教学设计者",special:"你是一位专项训练设计者",preview:"你是一位课前预习设计者",reading:"你是一位阅读理解命题专家",summary:"你是一位知识总结编写者",dictation:"你是一位听写训练设计者",errorbook:"你是一位错题整理专家"},re={exam:"基础/中档/提高——三道难度梯度确保考试区分度",practice:"基础巩固/能力提升/拓展探究——三道层级体现教学练评一致性",special:"入门练/进阶练/挑战练——三道阶梯实现专项能力突破",preview:"从已学回顾到新课感知——以复习和预习为主",reading:"信息提取→词句理解→主旨概括→推理判断→评价鉴赏",summary:"基础概念→综合应用，知识归纳由简到繁",dictation:"按教材出现顺序由易到难排列",errorbook:"高频错题→易混淆知识点，按类型分类整理"};return(W[u]||W.exam)+"。请根据以下信息，生成一份${blueprintTitle}。难度框架："+(re[u]||re.exam)+"。"})()}

【知识点清单】${(()=>{var ae,me,pe;const W=(pe=(me=(ae=i==null?void 0:i[0])==null?void 0:ae.selectedChapters)==null?void 0:me[0])==null?void 0:pe._cognitiveCorrections;let re=be.knowledgePoints.join("、")||"教材核心知识点";if(W!=null&&W.length){const Ue=W.map(Ie=>`"${Ie.knowledgeName}"应为${Ie.correctedLevel}（AI原始判断为${Ie.originalLevel}）`).slice(0,5).join("；");re+=`

⚠️ 以下知识点认知层次已由学科专家修正，请按修正后的层次规划：${Ue}`}return re})()}

【重难点】
${be.keyDifficulties.join("、")||"教材重难点"}

【层级知识图谱】
${(()=>{const W=be.knowledgeGraph||[];let re=JSON.stringify(W,null,2);if(W.length>0){const ae=W.length,me=W.reduce((Ee,ze)=>{var Z;return Ee+(((Z=ze.bigConcepts)==null?void 0:Z.reduce((Ne,Ct)=>{var bt;return Ne+(((bt=Ct.coreKnowledge)==null?void 0:bt.length)||0)},0))||0)},0);re+=`

【说明】以上包含${ae}个单元，共${me}个核心知识点。请基于此完整结构规划命题蓝图，不要遗漏任何单元。`;const pe=nt(re),Ue=(fe==null?void 0:fe.engine)==="deepseek";if(pe>(Ue?1e5:28e3)&&(console.warn(`⚠️ 知识图谱过大（${pe} tokens），可能超出模型上下文窗口`),console.warn("   建议：减少勾选的章节数量，或分多次生成"),re+=`

⚠️ 警告：知识图谱较大（约${pe} tokens），请确保模型上下文窗口足够。`,pe>(Ue?115e3:35e3))){console.warn(`⚠️ 知识图谱极大（${pe} tokens），启用智能精简模式`);const ze=W.map(Z=>({unit:Z.unit,bigConcepts:(Z.bigConcepts||[]).map(Ne=>({name:Ne.name,coreKnowledge:(Ne.coreKnowledge||[]).map(Ct=>({name:Ct.name,level:Ct.level||Ct.cognitiveLevel||"理解",suggestedQuestionTypes:Ct.suggestedQuestionTypes||[],testPriority:Ct.testPriority}))}))}));re=JSON.stringify(ze,null,2),re+=`

【精简说明】由于知识图谱过大，已简化为单元+大概念+知识点名称结构。具体知识点的详细描述请参考上方的【知识点清单】字段。`,re+=`
请基于此完整结构（含所有知识点名称），结合【知识点清单】中的详细信息来规划蓝图。`}}return re})()}

【跨章节关联】
${JSON.stringify(((q=be.crossChapterLinks)==null?void 0:q.slice(0,5))||[],null,2)}

${ve}
${Ye}

${p&&p.length>0?`【模板语言风格参考——蓝图中的每道题可参考以下风格特征】
`+(()=>{var me,pe,Ue,Ie,Ee,ze;let re="";const ae=p==null?void 0:p[0];if((me=ae==null?void 0:ae.analysis)!=null&&me.languageStyle){const Z=ae.analysis.languageStyle;Z.avgSentenceLength&&(re+=`- 题干平均长度目标：${Z.avgSentenceLength}字（±20%）
`),(pe=Z.commonPatterns)!=null&&pe.length&&(re+=`- 推荐设问句式：${Z.commonPatterns.slice(0,3).join("、")}
`),(Ue=Z.connectors)!=null&&Ue.length&&(re+=`- 推荐连接词：${Z.connectors.slice(0,3).join("、")}
`),Z.contextIntro&&(re+=`- 情境引入方式：${Z.contextIntro}
`),Z.tone&&(re+=`- 语气特征：${Z.tone}
`)}if((Ee=(Ie=ae==null?void 0:ae.analysis)==null?void 0:Ie.questionCards)!=null&&Ee.length){const Z=ae.analysis.questionCards,Ne=Z.filter(bt=>bt.stem).map(bt=>bt.stem.length);if(Ne.length>0){const bt=Math.round(Ne.reduce((Ot,gn)=>Ot+gn,0)/Ne.length),Bt=Math.min(...Ne),Ae=Math.max(...Ne);re+=`- 题干字数范围：${Bt}~${Ae}字（模板实际范围）
`}const Ct=Z.filter(bt=>{var Bt;return(Bt=bt.options)==null?void 0:Bt.length});if(Ct.length>0){const bt=Math.round(Ct.reduce((Bt,Ae)=>Bt+Ae.options.length,0)/Ct.length);re+=`- 选择题选项数：${bt}个
`}}if((ze=ae==null?void 0:ae.analysis)!=null&&ze.formatStyle){const Z=ae.analysis.formatStyle;Z.scorePosition&&u!=="practice"&&(re+=`- 分值标注位置：${Z.scorePosition}
`),Z.spacingBetweenQuestions!==void 0&&(re+=`- 题间距：${Z.spacingBetweenQuestions?"有空行":"紧凑"}
`)}return re+=`- 禁止使用以下设问："下列说法正确的是""以下哪个选项是正确的"
`,re+=`- 禁止选项中出现"以上都是""以上都不对"
`,re})()+`
`:""}

【用户指令摘要】
${h}

【命题约束】
${(()=>{var ae;const W=((ae=be.knowledgePoints)==null?void 0:ae.length)||10;return`0. 🔧 题量硬性约束：必须生成至少${Math.min(W,30)}道题（知识点清单共${W}个）。每个知识点至少考查1次，不可遗漏任何知识点。如需控制题量，可将1-2个关联度高的边缘知识点合并为综合题，但不得跳过任何知识点。
`})()}1. 每个知识点至少考查1次，重点知识可从不同角度考查2次
2. 同一知识点不得以相同题型重复考查超过2次
3. 难度分布按学段动态（从指令中已注入的学段适配要求为准）：
${(()=>{const W=i==null?void 0:i[0];if(!W)return"  基础约50%，中档约30%，提高约20%";const ae={小学:"primary",初中:"middle",高中:"high"}[W.stage]||W.stage,me=It(W.grade||""),pe=jt(ae,me>0&&me<=2,me>=3&&me<=4,me>=5);return pe?`  基础约${pe.basic}%，中档约${pe.medium}%，提高约${pe.advanced}%`:"  基础约50%，中档约30%，提高约20%"})()}
4. ⚠️ 题型多样性（强制执行）：同一份资料中至少使用3种不同题型，严禁全部或绝大多数使用选择题——尤其英语/语文科目，必须搭配填空、判断、简答、连线、仿写、补全对话等多样性题型
5. 题目排序：从易到难，同题型集中排列
6. 知识点覆盖率目标：100%（每个知识点至少1题）
7. 🔧 新增：允许2-3道综合题（题量超过15题时），可考查2-3个关联知识点
8. 🔧 新增：综合题的 knowledgePoint 填写 "综合：知识点A、知识点B"
9. 🔧 新增：综合题应放在${{exam:"试卷",practice:"练习",special:"训练",preview:"预习材料",reading:"阅读训练",summary:"知识总结",dictation:"听写训练",errorbook:"错题本",review:"复习资料"}[u]||"资料"}后半部分，cognitiveLevel 至少为"应用"
${u==="exam"?`10. 🔧 新增：综合题分值应高于单一知识点题，建议8-15分
`:""}${u==="exam"?"11. 🔧 分值校验：所有题目的 score 之和必须严格等于指令中标注的「总分」，不得超出或不足。请逐题分配分值后自验：sum(score) === 总分":""}
${(()=>{const W={exam:"12. 【考试卷质量要求】试题需有合理区分度，基础题确保大多数学生能做对，提高题能区分优秀学生；答案必须无争议。",practice:"12. 【课时练质量要求】题目必须与教材内容高度一致，不超纲不偏题；基础巩固→能力提升→拓展探究三层递进，单题解答时间约2-5分钟。",special:"12. 【专项训练质量要求】题目围绕专项知识点展开，覆盖各种考查角度；从最简单到最难形成清晰训练梯度，典型方法覆盖完整。",preview:"12. 【课前预习质量要求】预习任务可操作、可检查；预习检测紧扣教材原文，难度不宜过高，侧重基础感知。",reading:"12. 【阅读训练质量要求】选文贴近学段水平；题目涵盖信息提取、词句理解、主旨概括、推理判断、评价鉴赏五个层级。",summary:"12. 【知识总结质量要求】知识结构完整无遗漏；易错点辨析准确到位；典型例题有完整解析过程。",dictation:"12. 【听写/默写质量要求】练习区只留提示不留答案；按教材顺序排列；书写空间充足。",errorbook:"12. 【错题本质量要求】错题归因准确；正确解法步骤完整；变式巩固题与错题知识点一一对应。",review:"12. 【复习资料质量要求】知识框架层次分明，考点梳理完整不漏；典型题析覆盖全部考查角度；易错辨析精确到位；综合自测难度梯度合理，能真实检验复习效果。"};return(W[u]||W.exam)+`
`})()}

${p&&p.length>0?`【模板反例约束——模板中不会出现的模式，禁止使用】
`+(()=>{var me,pe;const re=p==null?void 0:p[0];let ae="";if((pe=(me=re==null?void 0:re.analysis)==null?void 0:me.questionCards)!=null&&pe.length){const Ue=re.analysis.questionCards,Ie=Ue.filter(Ne=>Ne.stem).map(Ne=>Ne.stem||"");Ie.some(Ne=>Ne.includes("下列说法正确的是")||Ne.includes("以下哪个选项是正确的"))||(ae+=`- ⛔ 模板从未使用"下列说法正确的是"这类无信息量设问，生成时严禁使用
`),Ue.some(Ne=>{var Ct;return(Ct=Ne.options)==null?void 0:Ct.some(bt=>bt.trim()==="以上都是"||bt.trim()==="以上都不对")})||(ae+=`- ⛔ 模板选项从未出现"以上都是""以上都不对"，生成时严禁使用
`);const Z=Ie.map(Ne=>Ne.length).filter(Ne=>Ne>5);if(Z.length>0){const Ne=Math.min(...Z),Ct=Math.max(...Z);ae+=`- 参考题干长度范围：${Ne}~${Ct}字（可根据知识点需要适当调整）
`}}return ae})()+`
`:""}

【防幻觉约束——请遵守以下规则，确保内容准确可靠】
1. 知识点请从上方【知识点清单】中选取，确保与教材一致
2. 🔧 补充规则：请对照上方【知识点清单】，检查是否遗漏了教材中明确要求掌握的必考内容。Step 1 已全面提取（含词汇表、生字表、课后练习等），如【知识点清单】不完整，可基于你的教材知识补充
3. 🔧 以下内容如果在【知识点清单】中缺失，必须补充到蓝图中：
   - 词汇表/Words（英语）
   - 需掌握的生字/词语（语文）
   - 课后练习明确考查的内容
   - 教材中加粗/标红/框出的重点内容
   - 用户锁定的必考知识点
4. 🔧 补充的知识点 knowledgePoint 字段使用原文中的准确名称
5. ⛔ 如果【知识点清单】中只有"同分母分数加减法"，不得生成"异分母分数加减法"或"分数乘除法"的题目
6. ⛔ 知识点的学段范围必须符合教材设定，不得超纲
7. 🔧 知识点覆盖率目标：【知识点清单】中的知识点≥90%需覆盖，补充的必考内容必须100%覆盖
8. 🔧 综合题的 knowledgePoint 必须以"综合："开头，后面列出的知识点可来自【知识点清单】或上述补充的必考内容

【输出格式】必须返回严格的 JSON 数组，每个元素代表一道题：

[
  {
    "number": 1,
    "type": "选择题",
    "knowledgePoint": "分数加减法（同分母）",
    "cognitiveLevel": "理解",
    "difficulty": "基础",${u==="exam"?`
    "score": 3,`:""}
    "sourceChapter": "第3章第1节",
    "contextScene": "场景名称（如使用统一情境则必填）"
  },
  {
    "number": 2,
    "type": "填空题",
    "knowledgePoint": "分数加减法（异分母）",
    "cognitiveLevel": "应用",
    "difficulty": "中档",${u==="exam"?`
    "score": 4,`:""}
    "sourceChapter": "第3章第2节"
  }
]

【强制规则】
- "type" 从以下选：选择题、填空题、判断题、计算题、解答题、应用题、简答题、作图题、实验题
- "cognitiveLevel" 从以下选：识记、理解、应用、分析、评价、创造
- "difficulty" 从以下选：基础、中档、提高
- "knowledgePoint" 必须写具体的概念名称，不得写"综合考查"
- "sourceChapter" 写对应章节名称${u==="exam"?`
- "score" 为本题分值，所有题目 score 之和必须严格等于总分`:`
- 不需要 "score" 字段（${genTypeLabel}不需要标注每题分值）`}
- 只返回 JSON 数组，不要用 Markdown 代码块包裹，不要任何解释文字
- JSON 必须合法可解析，键名用双引号`;et="";try{et=await ne(A,{taskType:"blueprint",timeout:18e4,forceJson:!0})}catch(W){throw console.error("第三步蓝图生成失败",W.message),W}let oe=0;const K=h.match(/总分[：:]\s*(\d+)/);if(K&&(oe=parseInt(K[1])),m){se=[];try{const W=`请将以下命题蓝图解析为JSON数组，每个元素代表一道题：

      ${et}

      返回格式：
      [
        {
          "number": 1,
          "type": "选择题|填空题|解答题|...",
          "knowledgePoint": "考查的知识点",
          "difficulty": "基础|中档|提高",
          "score": 分值数字,
          "sourceChapter": "对应的课文/章节"
        }
      ]

      只返回JSON数组，不要其他内容。`,ae=(await ne(W)).match(/\[[\s\S]*\]/);if(ae&&(se=JSON.parse(ae[0]),u==="exam"&&oe>0&&se.length>0)){const me=se.reduce((pe,Ue)=>pe+(Ue.score||0),0);if(Math.abs(me-oe)>2){console.warn(`[蓝图校验] 明细合计${me}分 ≠ 指令总分${oe}分，按比例自动修正`);const pe=oe/(me||1);se.forEach(Ee=>{Ee.score=Math.round((Ee.score||0)*pe)});const Ue=se.reduce((Ee,ze)=>Ee+(ze.score||0),0),Ie=oe-Ue;Ie!==0&&se.length>0&&(se[se.length-1].score=(se[se.length-1].score||0)+Ie)}}}catch(W){console.warn("蓝图模式解析失败:",W.message)}return t.value=80,n.value="蓝图已生成",e.value=!1,{success:!0,blueprint:et,parsedBlueprint:se,contentCards:B,knowledgeMap:be,content:"",generatedQuestions:[],issues:null,qualityReport:null}}n.value="步骤 4/5：解析命题蓝图...",t.value=60,se=[];try{if(se=await ft(et,async W=>await ne(`以下内容不是合法的 JSON 数组，请修复使其成为合法 JSON 后重新输出，只返回 JSON 数组：
${et.substring(0,1e3)}`,{taskType:"generation",temperature:.1,forceJson:!0}),"蓝图解析"),console.log("✅ 蓝图解析成功，共",se.length,"题"),u==="exam"&&oe>0&&se.length>0){const W=se.reduce((re,ae)=>re+(ae.score||0),0);if(Math.abs(W-oe)>2){console.warn(`[蓝图校验] 明细合计${W}分 ≠ 指令总分${oe}分，按比例自动修正`);const re=oe/(W||1);se.forEach(pe=>{pe.score=Math.round((pe.score||0)*re)});const ae=se.reduce((pe,Ue)=>pe+(Ue.score||0),0),me=oe-ae;me!==0&&se.length>0&&(se[se.length-1].score=(se[se.length-1].score||0)+me),console.log(`[蓝图校验] 修正后明细合计${se.reduce((pe,Ue)=>pe+(Ue.score||0),0)}分 === 指令总分${oe}分`)}}}catch(W){console.warn("蓝图解析失败，将使用传统方式生成:",W.message)}if(xe="",rt=[],se.length>0){const W=se.length;let re="";const ae=h.match(/命题风格[：:]\s*([^\n]+)/),me=ae?ae[1]:"";if(me.includes("统一情境")||me.includes("情境融合")||me.includes("unified_context")||me.includes("context_fusion"))try{const ze=`请为以下试卷设计一个贯穿全卷的统一情境/主题故事。
学科：${((O=i==null?void 0:i[0])==null?void 0:O.subject)||""}
年级：${((de=i==null?void 0:i[0])==null?void 0:de.grade)||""}
总题数：${W}
知识点：${se.map(Ne=>Ne.knowledgePoint).slice(0,5).join("、")}

要求：
1. 取一个情境名称（15字以内）
2. 描述情境背景（50字以内）
3. 列出3-5个可用于不同题目的场景元素

返回JSON：{"name":"情境名称","background":"情境背景","scenes":["场景1","场景2"]}`,Z=await ne(ze,{temperature:.5});try{const Ne=await ft(Z,null,"情境锚点");re=`【统一情境：${Ne.name}】背景：${Ne.background}。可用场景：${(Ne.scenes||[]).join("、")}。请在此情境下命制本题，保持与前后题目的叙事连贯性。`}catch{}}catch(ze){console.warn("情境锚点生成失败:",ze.message)}let pe=[];for(let ze=0;ze<W;ze++){const Z=se[ze],Ne=await Qt("generation"),Ct=pn(Ne.textModel||Ne.model);n.value=`步骤 4/5：生成第${ze+1}/${W}题 [${Ct}]...`,t.value=60+Math.round(ze/W*25);let bt=pe.length>0?`【已生成题目摘要，请避免知识点重复】
${pe.join(`
`)}
`:"",Bt="";if(pe.length>2){const yt=rt.slice(-3),$t=[],at=[];for(const At of yt){const Ut=At.replace(/<[^>]+>/g,"").trim().match(/^\d+[\.、．]\s*(.{1,20})/);Ut&&$t.push(Ut[1]);const Et=(At.match(/<p class="option"/g)||[]).length;Et>0&&at.push(Et)}if($t.length>=2&&$t.every(vt=>$t[0].substring(0,2)===vt.substring(0,2))&&(Bt=`⚠️ 【句式雷同警告——你必须打破此模式】前几题的句式开头高度雷同（均以"${$t[0].substring(0,12)}"开头）。本题必须使用与前几题完全不同的设问方式和句式结构！禁止再用相同句式开头！`),at.length>=2){const At=Math.round(at.reduce((vt,Ut)=>vt+Ut,0)/at.length);at.every(vt=>vt===at[0])&&(Bt+=`
⚠️ 【选项结构雷同警告】前几题选择题全部是${at[0]}个选项，本题必须打破此模式——改变选项数量或改用非选择题型！`)}}const Ae=5e3,Ot=Math.floor(Ae*.45),gn=Math.floor(Ae*.3),xs=Math.floor(Ae*.15);let on="";if(Z.knowledgePoint){const yt=js.findRelevant(Z.knowledgePoint,8);if(yt.length>0){const $t=rs(yt,Ot);if(on=$t.fullContext,on){const at=($t.coreText.match(/\n\[/g)||[]).length,At=($t.extendedText.match(/\n\[/g)||[]).length;console.log(`📚 题${Z.number} 教材上下文：核心${at}段 + 扩展${At}段`)}else on=""}}if(!on&&Z.sourceChapter){const yt=B.find($t=>$t.chapterTitle===Z.sourceChapter);if(yt&&(yt._fullChapterText||yt.rawText||yt.summary)){const $t=yt._fullChapterText||yt.rawText||yt.summary,at=fs($t,500).map(vt=>({chapterTitle:yt.chapterTitle,text:vt,type:"正文",isKeyConcept:!1,isExample:!1,isExercise:!1}));on=rs(at,Ot).fullContext||`【教材参考】
${$t.substring(0,Math.floor(Ot*1.5))}
`}}let Sn="",Js=0;const Bs=((Je=(Ce=p==null?void 0:p[0])==null?void 0:Ce.analysis)==null?void 0:Je.questionCards)||[];if(Bs.length>0){const $t=findBestTemplateSamples(Bs,Z,2);if($t.length>0){Sn=`
【模板参考题——以下为模板典型题目，供参考风格和结构】
`;let at=0;for(let At=0;At<$t.length;At++){const vt=$t[At];let Ut=`
=== 模板真题${At+1}（${vt.type}，${vt.difficulty||"?"}难度，${vt.score||"?"}分）===
`,Et=vt.stem||"";const Dt=Math.floor(gn/2*.8);if(Et.length>Dt){const en=["。","？","！","?","!"];let Nt=-1;for(const Vt of en){const an=Et.lastIndexOf(Vt,Dt);if(an>Dt*.6){Nt=an+1;break}}Nt>0?Et=Et.substring(0,Nt)+"...":Et=Et.substring(0,Dt)+"...（题干过长已截断）"}if(Ut+=`题干：${Et}
`,(Se=vt.options)!=null&&Se.length){const en=vt.options.slice(0,4);Ut+=`选项：${en.map((Nt,Vt)=>`${String.fromCharCode(65+Vt)}. ${Nt}`).join(" | ")}
`}vt.questionFeature&&(Ut+=`设问特征：${vt.questionFeature.substring(0,30)}
`);const xn=nt(Ut);if(Js+xn>gn){at===0&&(Sn+=Ut,at++);break}Sn+=Ut,Js+=xn,at++}at>0?Sn+=`
【注意】以上真题仅作学段题型参考。本题请根据实际知识点和${u==="exam"?"考试要求":u==="practice"?"练习目标":"训练目标"}独立设计题干长度、句式结构和选项数量，无需机械模仿模板样本。`:Sn=""}}bt="",pe.length>0&&(bt=`【已生成题目——下面的题目已生成完毕，你本题必须与之有明显差异】
${pe.slice(-3).join(`
`)}

⚠️ 排重要求——请确认本题与上面已生成题目的差异：
1. 不使用上面已出现过的场景（如上面用了"分蛋糕"，你换"跳绳比赛"或"图书馆"等全新场景）
2. 不使用上面已出现过的设问句式（如上面用了"XX有多少个"，你换"比较XX和YY的差异"或"如果ZZ发生变化，XX会怎样"）
3. 不使用上面已出现过的数据组合（换一组全新数字，不雷同）
`,nt(bt)>xs&&(bt=`【已生成题目】${pe.slice(-2).join("；")}
⚠️ 请确保本题情境、设问方式与上面不同。`,nt(bt)>xs&&(bt=`【上一题】${pe[pe.length-1]}
⚠️ 请确保本题情境、设问方式与上一题不同。`)));const ki=on?(on.match(/核心教材原文/g)||[]).length:0,Pi=on?(on.match(/补充参考/g)||[]).length:0;console.log(`📊 题${Z.number} 上下文使用:
  教材原文: 核心段 + 扩展段 (预算${Ot} tokens)
  模板样本: ${Sn?"已注入":"无"} (预算${gn} tokens)
  已生成摘要: ${nt(bt)} tokens (预算${xs})`);const Qs={选择题:"choice",填空题:"fill",判断题:"truefalse",计算题:"calc",解答题:"answer",应用题:"word_problem",实验题:"experiment"}[Z.type],Ws=Qs?Y({category:"生成-题型专项要求",genType:Qs}):[],to=Ws.length>0?Ws[0].content:"";let In="";Z.knowledgePoint&&Z.knowledgePoint.startsWith("综合：")&&(In=`
⚠️ 这是一道综合题，需要融合以下知识点：${Z.knowledgePoint.replace("综合：","").split(/[、，,]/).map($t=>$t.trim()).join("、")}
`,In+=`请创设一个真实情境，将上述知识点自然融合在一个问题中。
`,In+=`各知识点的考查权重应大致均衡。
`,(Z.cognitiveLevel==="分析"||Z.cognitiveLevel==="评价")&&(In+=`需要体现高阶思维（分析/评价），不止于简单应用。
`));const Vs=["🎲 【场景引导：生活化】请创设贴近学生日常的场景（如购物、分食物、运动计分等），让题目有真实感和代入感。","🎲 【场景引导：校园课堂】请创设校园/课堂场景（如小组比赛、实验操作、课堂问答等），与学校生活关联。","🎲 【场景引导：故事游戏】请将题目包装成简短的小故事、闯关游戏或趣味挑战，增强可读性。","🎲 【场景引导：图表数据】请用表格、统计图、示意图等可视化方式呈现关键信息，考查数据解读能力。",'🎲 【场景引导：探究思辨】请用"为什么...""如果...会怎样""你能发现什么规律"等开放式设问，考查深层理解。',"🎲 【场景引导：对比辨析】请设计需要对比两个易混淆概念/方法的题目，考查辨析能力而非死记硬背。",'🎲 【反套路·去教辅化】请检查你的设问——是否和《53天天练》《黄冈小状元》《典中点》等常见教辅的题目"撞脸"？如果是，必须更换场景和句式，让你的题"不像任何一本教辅"。','🎲 【反套路·原创场景】请避免使用"买东西找零""分糖果""水池注水""小明小红""鸡兔同笼"等已被写烂的应用题场景。改用当下学生真正感兴趣的话题（校园科技节、研学旅行、班级义卖、社团活动、运动比赛等），去掉"小明""小红"这类万能角色名，换成有特点的原创名字。',"🎲 【反套路·去网络化】请检查你的题目——能否在学科网、教习网、菁优网、百度文库上被搜到几乎一样的题？如果换个数字就一模一样，必须推翻重写。你的题应该让搜索引擎找不到第二个。","🎲 【反套路·去AI痕迹】请避免使用DeepSeek/ChatGPT等模型的高频套话：如在当今这个时代、值得注意的是、综上所述、体现了核心价值、是一个值得深思的问题、通过分析不难发现等。用你自然的语言风格写题，不要带AI腔。"],no=Vs[ze%Vs.length],so=Ar(Z,u,{situationAnchor:re,contextSummary:bt,styleConsistencyHint:Bt,materialContext:on,templateContext:Sn,typeRule:to,integratedContext:In,selectedTemplates:p,instruction:h,selectedBooks:i,stage:H,diversitySeed:no});try{if(ze===0){console.log("🔥 题目生成：检查模型状态...");try{const at=await $e(null,3,"text");if(at.ready)console.log(`✅ 文本生成模型已就绪，立即开始（响应时间: ${at.responseTime}ms, 尝试${at.attempts}次）`);else{console.log(`⚠️ 模型未就绪，根据响应时间动态等待... (${at.responseTime}ms)`);const At=Math.max(2e3,Math.min(4e3,at.responseTime/10));await new Promise(vt=>setTimeout(vt,At))}}catch(at){console.warn("⚠️ 模型检测失败，等待3秒后继续...",at.message),await new Promise(At=>setTimeout(At,3e3))}}else console.log(`⏰ 第${ze+1}题之前等待2秒...`),await new Promise(at=>setTimeout(at,2e3));const yt=await ne(so,{taskType:"generation",timeout:12e4,allowContinuation:!0});rt.push(yt);let $t="";try{const at=i==null?void 0:i[0],At=(at==null?void 0:at.subject)||"",vt=(at==null?void 0:at.stage)||"",Ut=Kt(At,vt),Et=Sr(yt,Ut);if(Et.length>0){const Dt=[],xn=[];for(const Nt of Et)if(Nt.passed===!1){const an=`${Nt.severity==="error"?"❌":"⚠️"} [${Nt.name}] ${Nt.message}`;Nt.severity==="error"?Dt.push(an):xn.push(an),$t+=`<!-- ${an} -->
`,console.warn(`题${Z.number}${an}`)}const en=xr(yt,Et);if(en!==yt){const Nt=rt.indexOf(yt);Nt>=0&&(rt[Nt]=en,console.log(`🔧 题${Z.number} 自动修复完成`))}Dt.length>0&&(console.warn(`⚠️ 题${Z.number} 存在 ${Dt.length} 个严重错误，建议人工审查`),$t+=`<!-- ⚠️⚠️⚠️ 本题存在严重规则违反，请人工审查 ⚠️⚠️⚠️ -->
`,$t+=`<!-- 错误列表：
${Dt.join(`
`)}
-->
`,Dt.length>=2&&ze<W&&console.log(`🔄 题${Z.number} 存在多个严重错误，将在自动修复循环中处理`)),xn.length>0&&console.log(`📝 题${Z.number} 存在 ${xn.length} 个警告`)}}catch(at){console.warn("硬性规则验证失败:",at.message)}try{const at=`请审查这道题目，检查知识点匹配度和科学性：

【题目内容】
${yt.replace(/<[^>]+>/g,"").substring(0,500)}

【命题要求】
知识点：${Z.knowledgePoint}
难度：${Z.difficulty}
题型：${Z.type}

请逐一检查并只返回JSON：
{
  "knowledgeMatch": true,
  "knowledgeMatchReason": "题目确实考查了该知识点",
  "hasScienceError": false,
  "scienceErrorDetail": "",
  "answerCorrect": true,
  "suggestion": ""
}`,At=await ne(at,{taskType:"questionValidation",temperature:0,timeout:3e4});try{const vt=await ft(At,null,"题目验证");if(vt.knowledgeMatch||($t=`<!-- ⚠️ 知识点匹配问题：${vt.knowledgeMatchReason||"未知"} -->`,console.warn(`题${Z.number}知识点匹配问题:`,vt.knowledgeMatchReason)),vt.hasScienceError&&($t+=`<!-- ❌ 科学性错误：${vt.scienceErrorDetail||"未知"} -->`,console.error(`题${Z.number}科学性错误:`,vt.scienceErrorDetail)),vt.answerCorrect||($t+="<!-- ⚠️ 答案可能有误 -->",console.warn(`题${Z.number}答案可能有误`)),["计算题","解答题","应用题","选择题","填空题"].includes(Z.type)&&yt.length>20)try{const Et=[/答案[：:]\s*(.+?)(?:<|$|\n)/,/【答案】\s*(.+?)(?:<|$|\n)/,/参考答案[：:]\s*(.+?)(?:<|$|\n)/,/正确[答案选项][：:]\s*(.+?)(?:<|$|\n)/];let Dt="";for(const zt of Et){const un=yt.match(zt);if(un){Dt=un[1].trim();break}}const en=`请计算这道题，先写出关键步骤，然后给出最终答案。

【题目】
${yt.replace(/<[^>]+>/g,"").replace(/【答案】[\s\S]*$/,"").trim().substring(0,600)}

【输出格式】
步骤：
1. ...
2. ...
最终答案：[答案]

如果题目本身有逻辑错误或条件不足导致无法计算，请说明具体问题。`,Nt=await ro("review");let Vt="same",an="";Nt.engine==="ollama"&&Pn.deepseekApiKey?(Vt="deepseek",an=Pn.deepseekApiKey):Nt.engine==="deepseek"&&(Vt="ollama");let kn="";if(Vt==="deepseek")try{if(hn.isOpen)throw console.warn("⚠️ DeepSeek 熔断中，验算跳过"),new Error("DeepSeek 熔断中");let zt=Pn.deepseekBaseUrl||"";zt&&!zt.includes("/chat/completions")&&(zt=zt.endsWith("/v1")?`${zt}/chat/completions`:`${zt.replace(/\/$/,"")}/v1/chat/completions`);const un=await fetch(zt,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${an}`},body:JSON.stringify({model:Pn.deepseekModel,messages:[{role:"user",content:en}],temperature:0,max_tokens:1024})});if(un.ok)kn=((ie=(Le=(je=(await un.json()).choices)==null?void 0:je[0])==null?void 0:Le.message)==null?void 0:ie.content)||"",hn.success();else throw un.status>=500&&hn.fail(),new Error(`DeepSeek 验算失败: HTTP ${un.status}`)}catch(zt){console.warn("DeepSeek 验算失败，降级使用 Ollama:",zt.message),kn=await ne(en,{taskType:"questionValidation",temperature:0,timeout:3e4,retries:0})}else Vt==="ollama"?kn=await ne(en,{taskType:"questionValidation",temperature:0,timeout:3e4,retries:0}):kn=await ne(en,{taskType:"questionValidation",temperature:0,timeout:3e4,retries:0});const Xs=kn.match(/最终答案[：:]\s*(.+?)(?:\n|$)/),es=Xs?Xs[1].trim():kn.split(`
`).pop().trim();if(es&&Dt){const zt=ks=>ks.replace(/\s+/g,"").replace(/[，,]/g,"").replace(/[。.]/g,"").replace(/（/g,"(").replace(/）/g,")").toLowerCase(),un=zt(Dt),Zs=zt(es);un!==Zs?($t+=`
<!-- ⚠️⚠️⚠️ 交叉验算不一致（验算引擎：${Vt}）⚠️⚠️⚠️
  原答案：${Dt}
  验算结果：${es}
  验算过程：
  ${kn.split(`
`).map(ks=>"  "+ks).join(`
`)}
  请务必人工核对！ -->`,console.warn(`题${Z.number}交叉验算不一致 [${Vt}]: 原="${Dt}" 验="${es}"`),Z.difficulty==="基础"&&console.error(`基础题${Z.number}答案可能错误，强烈建议人工审查`)):console.log(`✅ 题${Z.number}交叉验算一致 [${Vt}]`)}}catch(Et){console.warn("数学验算失败（非阻塞）:",Et.message)}if($t){const Et=rt.indexOf(yt);Et>=0&&(rt[Et]=$t+`
`+yt)}}catch{}}catch{}try{const at=await ne(`用30字以内描述这道题的情境、设问方式和关键特征。格式：「情境：XX | 方式：XX | 特征：XX」
${yt}`,{taskType:"generation",temperature:.1});pe.push(`第${Z.number}题(${Z.type},${Z.knowledgePoint}): ${at.trim()}`)}catch{pe.push(`第${Z.number}题(${Z.type},${Z.knowledgePoint})`)}}catch(yt){console.warn(`第${ze+1}题生成失败:`,yt.message),rt.push(`<p class="question"><span class="question-number">${Z.number}.</span> 【生成失败，请重试】</p>`),pe.push(`第${Z.number}题【生成失败】`)}}if(rt.length>2){n.value="正在检查题目重复...",t.value=85;try{const ze=`你是一位严谨的命题审核专家。请检查以下${rt.length}道题是否存在真正意义上的考查点重复。

⚠️ 判定标准（严格）：只有在两道题考查的核心知识点完全相同、解题方法完全一致时，才算重复。
⚠️ 例："两位数加两位数"和"两位数加两位数进位"考查不同难度层次→不算重复
⚠️ 例："阅读理解题A"和"阅读理解题B"即使同属阅读→只要文章不同就不算重复
⚠️ 存疑时请判为不重复（宁可漏判，不可误判）。

${rt.map((Ne,Ct)=>`题${Ct+1}：${Ne.replace(/<[^>]+>/g,"").substring(0,150)}`).join(`
`)}

返回JSON：
{
  "hasDuplicates": true,
  "duplicatePairs": [{"q1": 1, "q2": 3, "reason": "两题都考查分数加减法"}],
  "suggestion": "建议合并或替换其中一题"
}
如果没有重复，返回 {"hasDuplicates": false}

只返回JSON。`,Z=await ne(ze,{taskType:"review",temperature:.1});try{const Ne=await ft(Z,null,"去重检查");if(Ne.hasDuplicates&&((C=Ne.duplicatePairs)==null?void 0:C.length)>0){console.warn("⚠️ 检测到重复题目:",Ne.duplicatePairs);const Ct=`<!-- ⚠️ 去重警告：${Ne.suggestion||"以下题目可能存在重复"} -->
`;rt.unshift(Ct)}}catch{}}catch(ze){console.warn("去重检查失败:",ze.message)}}n.value="正在组装...",t.value=88;const Ue=i==null?void 0:i[0],Ie=(Ue==null?void 0:Ue.subject)||"",Ee=(Ue==null?void 0:Ue.grade)||"";if(u==="practice"||u==="special"){const Z=((Ue==null?void 0:Ue.selectedChapters)||[]).map(Ae=>Ae.title).filter(Boolean).join("、"),Ne=(Ue==null?void 0:Ue.name)||"",bt=tt(u,Z||"_all_");xe=`<h1>${Ne}${Z?" · "+Z:""}</h1>
<div class="practice-info"><p>${Ee} ${Ie} ${bt}</p></div>`+`

`+rt.join(`

`)}else{const ze=`请根据以下信息生成试卷头部（标题、考试信息等）：
      学科：${Ie}
      年级：${Ee}
      总分：${oe||100}分
      题型分布：${se.map(Z=>`${Z.type}×${se.filter(Ne=>Ne.type===Z.type).length}题`).filter((Z,Ne,Ct)=>Ct.indexOf(Z)===Ne).join("，")}

      返回HTML格式的试卷头部，用<h1>标题，用<div class="exam-info">包裱考试信息。`;try{xe=await ne(ze,{taskType:"generation",temperature:.3})+`

`+rt.join(`

`)}catch{xe=rt.join(`

`)}}}else throw new Error(`内容生成失败：命题蓝图解析失败，无法逐题生成。
可能原因：AI 返回的蓝图格式异常，无法提取有效的题目信息。
建议：点击"重试"重新生成，或减少所选章节数量后重试。`);if(u!=="exam"&&se.length>0){const W=[],re=/<!--\s*answer\s*:\s*(.+?)\s*(?:\|\s*解析\s*:\s*(.+?))?\s*-->/gi;let ae;for(let me=0;me<rt.length;me++){const pe=rt[me];for(re.lastIndex=0;(ae=re.exec(pe))!==null;){const Ue=(ae[1]||"").trim(),Ie=(ae[2]||"").trim();W.push({number:((z=se[me])==null?void 0:z.number)||me+1,answer:Ue,explanation:Ie})}}if(W.length>0){let me=`
<div class="answer-section">
<h2>答案与解析</h2>
`;for(const pe of W)me+=`<p><strong>${pe.number}.</strong> ${pe.answer}`,pe.explanation&&(me+=` | <em>解析：${pe.explanation}</em>`),me+=`</p>
`;me+="</div>",xe+=me}else{console.warn("⚠️ 未提取到答案注释，尝试 AI 补生成答案区域...");try{const me=`请根据以下题目内容，生成统一的答案与解析区域。

${rt.map((Ue,Ie)=>`题${Ie+1}：${Ue.replace(/<[^>]+>/g,"").substring(0,200)}`).join(`

`)}

返回格式：
<div class="answer-section">
<h2>答案与解析</h2>
<p><strong>1.</strong> 答案 | <em>解析：解题思路</em></p>
...
</div>

只返回HTML，不要markdown包裹。`,pe=await ne(me,{taskType:"generation",temperature:.1});xe+=`
`+pe}catch(me){console.warn("答案区域生成失败:",me.message)}}}}const Tt=await Qt("review"),Yt=pn(Tt.textModel||Tt.model),rn=Xe?"4/4":"5/5";n.value=`步骤 ${rn}：质量校验 [${Yt}]...`,t.value=85;const pt=[],Oe=i==null?void 0:i[0],ot=(Oe==null?void 0:Oe.stage)||"",Re={小学:"primary",初中:"middle",高中:"high"},mt=Zt.check(xe,se,(Oe==null?void 0:Oe.subject)||"",Re[ot]||ot,(Oe==null?void 0:Oe.grade)||"",u);mt.forEach(f=>{pt.push(`${f.severity==="error"?"❌":"⚠️"} ${f.detail}`)}),mt.some(f=>f.autoFix)&&(xe=Zt.autoFix(xe,mt));const Me={formatCheck:{passed:!0,details:[]},coverageCheck:{passed:!0,details:[]},difficultyCheck:{passed:!0,details:[]},knowledgeCheck:{passed:!0,details:[]},templateMatch:{passed:!0,details:[]}},Mt=Zt.getIssueSummary(mt);if(Mt.hasErrors&&(Me.formatCheck.passed=!1,Me.formatCheck.details.push(`硬性规则检查发现${Mt.errors}个错误`)),Mt.hasWarnings&&Me.formatCheck.details.push(`硬性规则检查发现${Mt.warnings}个警告`),!xe.includes("<h")&&!xe.includes("<p")&&!xe.includes("<div")&&(pt.push("❌ 可能未返回HTML格式"),Me.formatCheck.passed=!1,Me.formatCheck.details.push("缺少HTML标签")),xe.includes("answer-section")||(pt.push("⚠️ 缺少答案区域"),Me.formatCheck.details.push("缺少答案区域")),!xe.includes("<p")&&!xe.includes("<div")&&!xe.includes("<h")&&(pt.push("❌ 可能未返回HTML格式"),Me.formatCheck.passed=!1),!["summary","dictation"].includes(u)){const f=xe.match(/class="[^"]*question[^"]*"/gi),y=f?f.length:0;y===0&&se.length>0&&(pt.push('⚠️ 未检测到 class="question" 标记（AI输出可能使用其他class名），建议人工确认题目完整性'),Me.formatCheck.details.push("未检测到题目class标记")),y>0&&y<5&&(pt.push(`⚠️ 题目数量偏少（${y}题）`),Me.formatCheck.details.push(`题目数量：${y}题`))}if([{pattern:/[０-９]/g,message:"包含全角数字"},{pattern:/答案.{0,5}略/g,message:'答案标注为"略"'}].forEach(({pattern:f,message:y})=>{f.test(xe)&&pt.push(`⚠️ ${y}`)}),Oe&&["数学","物理","化学"].includes(Oe.subject||"")){(xe.match(/\$/g)||[]).length%2!==0&&(pt.push("⚠️ 行内公式符号$未闭合（奇数个$）"),Me.formatCheck.details.push("检测到未闭合的$公式符号")),(xe.match(/\$\$/g)||[]).length%2!==0&&(pt.push("⚠️ 独立公式符号$$未配对"),Me.formatCheck.details.push("检测到未配对的$$公式符号"));const A=[{pattern:/\\frac\{\}/,message:"\\frac{} 缺少参数"},{pattern:/\\sqrt\{\}/,message:"\\sqrt{} 缺少参数"},{pattern:/\{\\frac/,message:"括号位置错误（应在\\frac之后）"},{pattern:/[^\\]_\{[^}]*$/,message:"下标{}可能未闭合"},{pattern:/[^\\]\^\{[^}]*$/,message:"上标{}可能未闭合"}];for(const oe of A)oe.pattern.test(xe)&&pt.push(`⚠️ LaTeX语法问题：${oe.message}`)}t.value=85;const V=i==null?void 0:i[0];if(V&&xe.length>100){const f=(V==null?void 0:V.subject)||"",y=(V==null?void 0:V.stage)||"",A=(V==null?void 0:V.grade)||"",oe=Kt(f,y),K=ns(xe,oe,y,A);if(K.hasViolations&&(K.violations.forEach(W=>{const re=W.severity==="error"?"❌":"⚠️";pt.push(`${re} 超纲检测：${W.message}`)}),K.summary.errorCount>0&&(Me.knowledgeCheck.passed=!1,Me.knowledgeCheck.details.push(`超纲检测发现${K.summary.errorCount}处明确超纲`))),K.fuzzyItems.length>0){const W=K.fuzzyItems.filter(re=>re.severity==="warning");W.length>0&&Me.knowledgeCheck.details.push(`边界模糊检测：${W.map(re=>`"${re.topic}"(${re.limit})`).join("；")}`)}console.log("📋 超纲检测完成:",K.summary)}if((p==null?void 0:p.length)>0){n.value="逐题质量检查...";try{const f=xe.match(/<p class="question"[^>]*>([\s\S]*?)<\/p>/g)||[];for(let y=0;y<Math.min(f.length,se.length);y++){const A=f[y].replace(/<[^>]+>/g,"").trim(),oe=se[y];if(!oe)continue;const K=["下列说法正确的是","以下哪个选项是正确的","以上都是","以上都不对","下列选项中错误的是"];for(const W of K)if(A.includes(W)){pt.push(`⚠️ 题${oe.number}使用了禁止句式："${W}"`);break}}}catch(f){console.warn("逐题质量检查失败:",f.message)}}if(se.length>0){const f=(xe.match(/class="[^"]*question[^"]*"/gi)||[]).length;Me.coverageCheck.details.push(`蓝图规划${se.length}题，实际生成${f}题`);const y=[...new Set(se.map(W=>W.type))],A=[...new Set((xe.match(/<p class="question"[^>]*>([^<]*?)<\/p>/g)||[]).map(W=>W.replace(/<[^>]+>/g,"").substring(0,5)))];Me.templateMatch.details.push(`蓝图题型: ${y.join("、")}，生成检测到${f}题`);const oe={基础:0,中档:0,提高:0};se.forEach(W=>{oe.hasOwnProperty(W.difficulty)&&oe[W.difficulty]++});const K=se.length||1;Me.difficultyCheck.details.push(`规划：基础${Math.round(oe.基础/K*100)}% 中档${Math.round(oe.中档/K*100)}% 提高${Math.round(oe.提高/K*100)}%`)}if((p==null?void 0:p.length)>0&&((he=(we=(l=p[0])==null?void 0:l.analysis)==null?void 0:we.questionCards)==null?void 0:he.length)>0){const f=p[0].analysis.questionCards,y={},A={};f.forEach(Ie=>y[Ie.type]=(y[Ie.type]||0)+1),se.forEach(Ie=>A[Ie.type]=(A[Ie.type]||0)+1);const oe=[...new Set([...Object.keys(y),...Object.keys(A)])];let K=0;oe.forEach(Ie=>{const Ee=y[Ie]||0,ze=A[Ie]||0;Ee>0&&ze>0&&K++});const W=oe.length>0?Math.round(K/oe.length*100):100;Me.templateMatch.details.push(`题型匹配度: ${W}%（${K}/${oe.length}类题型）`);const re=f.filter(Ie=>Ie.stem).map(Ie=>Ie.stem.length),me=(xe.match(/<p class="question"[^>]*>([^<]*)<\/p>/g)||[]).map(Ie=>Ie.replace(/<[^>]+>/g,"").length);if(re.length>0&&me.length>0){const Ie=Math.round(re.reduce((Z,Ne)=>Z+Ne,0)/re.length),Ee=Math.round(me.reduce((Z,Ne)=>Z+Ne,0)/me.length),ze=Math.abs(Ee-Ie);Me.templateMatch.details.push(`模板题干平均${Ie}字，生成题干平均${Ee}字，偏差${ze}字`),ze>Ie*.5&&pt.push(`⚠️ 题干长度与模板偏差较大（模板${Ie}字 vs 生成${Ee}字）`)}const pe=f.reduce((Ie,Ee)=>Ie+(Ee.score||0),0),Ue=se.reduce((Ie,Ee)=>Ie+(Ee.score||0),0);if(pe>0){const Ie=Math.abs(Ue-pe);Me.templateMatch.details.push(`模板总分${pe}，生成总分${Ue}，偏差${Ie}分`),Ie>10&&pt.push(`⚠️ 总分与模板偏差${Ie}分`)}Me.templateMatch.details.push(`模板${f.length}题，生成${se.length}题`)}if(Oe&&Oe.subject){const f=(Oe==null?void 0:Oe.subject)||"",y=(Oe==null?void 0:Oe.stage)||"",A=Kt(f,y),oe=rr(xe,A);oe.fixes.length>0&&(xe=oe.normalized,console.log(`📝 术语统一完成：${oe.fixes.map(K=>`"${K.original}"→"${K.corrected}"(${K.count}处)`).join("；")}`),Me.formatCheck.details.push(`术语统一：${oe.fixes.length}种术语被标准化`))}t.value=100;let te=["生成完成"];if((ce=(G=Me.knowledgeCheck)==null?void 0:G.details)!=null&&ce.length&&Me.knowledgeCheck.details.find(y=>y.includes("超纲"))&&te.push("⚠️超纲检测"),pt&&pt.length>0){const f=pt.filter(A=>A.startsWith("❌")).length,y=pt.filter(A=>A.startsWith("⚠️")).length;f>0&&te.push(`❌${f}个错误`),y>0&&te.push(`⚠️${y}个警告`)}else te.push("✅无问题");return n.value=te.join(" | "),{success:!0,content:xe,blueprint:et,contentCards:B,knowledgeMap:be,issues:pt,qualityReport:Me,generatedQuestions:rt,parsedBlueprint:se}}catch(I){if(console.error("生成失败:",I),P<2)return await new Promise(lt=>setTimeout(lt,2e3)),bn(h,u,i,p,P+1);const{showRetryDialogFn:ye}=io(),H=((le=(Fe=i==null?void 0:i[0])==null?void 0:Fe.selectedChapters)==null?void 0:le.length)||0,be=`AI 连续多次生成失败，重试已耗尽。

当前生成：${((M=i==null?void 0:i[0])==null?void 0:M.name)||((L=i==null?void 0:i[0])==null?void 0:L.fileName)||""}（${H} 个章节）
错误原因：${I.message}

请选择处理方式：`,fe=await ye(be);if(fe==="retry")return bn(h,u,i,p,0);if(fe==="batch")try{n.value="切换到批量生成模式...",t.value=30;const lt=await mn(i,ne,ft,(rt,Tt)=>{n.value=rt,t.value=Tt}),ve=await Mn(lt,i,ne,ft,(rt,Tt)=>{n.value=rt,t.value=Tt}),ge=Array.isArray(ve.knowledgeGraph)?ve.knowledgeGraph:[],ue=Array.isArray(ve.knowledgePoints)?ve.knowledgePoints:[],Ye=Array.isArray(ve.keyDifficulties)?ve.keyDifficulties:[],Qe=`请为以下学科生成命题蓝图（JSON数组），每道题包含 number/type/knowledgePoint/difficulty/score/sourceChapter。

学科：${((X=i==null?void 0:i[0])==null?void 0:X.subject)||""}
年级：${((_=i==null?void 0:i[0])==null?void 0:_.grade)||""}
知识点：${ue.join("、")}
重难点：${Ye.join("、")}

请根据 ${h} 的要求规划题目。只返回JSON数组，不要其他内容。`,ht=await ne(Qe,{taskType:"blueprint",timeout:12e4,forceJson:!0}),st=await ft(ht,null,"batch-blueprint"),He=await fn(JSON.stringify(st),h,i,p),ut=[],Xe=i==null?void 0:i[0],et=(Xe==null?void 0:Xe.stage)||"",se={小学:"primary",初中:"middle",高中:"high"};return Zt.check(He,st,(Xe==null?void 0:Xe.subject)||"",se[et]||et,(Xe==null?void 0:Xe.grade)||"",u).forEach(rt=>{ut.push(`${rt.severity==="error"?"❌":"⚠️"} ${rt.detail}`)}),{success:!0,content:He,blueprint:JSON.stringify(st),parsedBlueprint:st,contentCards:lt,knowledgeMap:ve,issues:ut,qualityReport:{formatCheck:{passed:!0,details:[]}},generatedQuestions:[He],batchMode:!0}}catch(lt){return console.error("批量生成也失败:",lt),{success:!1,error:`批量生成失败：${lt.message}`,retried:!0}}return{success:!1,error:I.message,retried:P>0}}finally{P===0&&(e.value=!1)}},ws=async(h,u,i,p,P=!1)=>{var Se,je,Le,ie;const m=await Qt("analysis"),$=pn(m.textModel||m.model);n.value=`构建知识图谱 [${$}]...`,t.value=10;const w=await mn(i,ne,ft,(C,z)=>{n.value=C,t.value=z}),g=await Mn(w,i,ne,ft,(C,z)=>{n.value=C,t.value=z});let T="";const x=[];for(const C of w)if(C.segments)for(const z of C.segments)x.push({chapterTitle:C.chapterTitle,text:z.text,isKey:z.isKeyConcept});x.sort((C,z)=>(z.isKey?1:0)-(C.isKey?1:0));let ee=0;const J=[];for(const C of x){if(ee+C.text.length>3e3)break;J.push(C),ee+=C.text.length}T=J.map(C=>`【${C.chapterTitle}】${C.text}`).join(`

`);let U="";if(p&&p.length>0){const z=((Se=p[0].analysis)==null?void 0:Se.rawText)||"";z&&(U=z.substring(0,2e3))}let D="";if(((je=g.knowledgeGraph)==null?void 0:je.length)>0?D=g.knowledgeGraph.map(C=>{let z=`📌 单元：${C.unit||""}
`;return(C.bigConcepts||[]).forEach(l=>{z+=`  📌 ${l.name}
`,(l.coreKnowledge||[]).forEach(we=>{z+=`    ├─ ${we.name}【${we.cognitiveLevel||"理解"}】
`,(we.specificConcepts||[]).forEach(he=>{z+=`    │  └─ ${he}
`})})}),z}).join(`
`):D=(g.knowledgePoints||[]).map(C=>`📌 ${C}`).join(`
`),n.value="步骤 1/3：分析知识结构...",t.value=30,P){t.value=50,n.value="知识总结蓝图已生成";const C=i==null?void 0:i[0],z=(C==null?void 0:C.stage)||"",we={小学:"primary",初中:"middle",高中:"high"}[z]||z,he=(C==null?void 0:C.grade)||"",G=(C==null?void 0:C.subject)||"",ce=Kt(G,z),Fe=((Le=w==null?void 0:w[0])==null?void 0:Le.summary)||"",le=yn("summary",ce,we),M=["【知识点总结蓝图】",`学科：${ce}  |  年级：${he}  |  学段：${z}`,`${Fe?"🎯 核心主题："+Fe+`
`:""}生成结构：${le}`,"","【知识结构】",D].join(`
`);return e.value=!1,{success:!0,blueprint:M,parsedBlueprint:(()=>{var X;const L=(g.knowledgePoints||[]).slice(0,15);return L.length===0?(((X=i==null?void 0:i[0])==null?void 0:X.selectedChapters)||[]).map(ye=>ye.title).filter(Boolean).slice(0,10).map((ye,H)=>({number:H+1,type:"知识点",knowledgePoint:ye,difficulty:"基础",score:0,sourceChapter:he})):L.map((_,I)=>({number:I+1,type:"知识点",knowledgePoint:_,difficulty:"基础",score:0,sourceChapter:he}))})(),contentCards:w,knowledgeMap:g,content:"",generatedQuestions:[],issues:null,qualityReport:null}}n.value="步骤 2/3：生成思维导图...",t.value=50;const N=`你是一位教辅编辑专家。请根据以下知识结构，生成一份思维导图。

【知识结构】
${D}

【格式要求】
- 用 HTML 嵌套列表表示思维导图（最多4层）
- 用 <div class="mindmap"> 包裹
- 外层用 <ul>，每个节点用 <li>
- 重要概念用 <strong> 加粗
- 不同层级用不同缩进表示
- 直接返回 HTML 片段，不要用代码块包裹`;let q="";try{q=await ne(N,{taskType:"generation",temperature:.3,timeout:6e4})}catch(C){console.warn("思维导图生成失败:",C.message),q='<div class="mindmap"><ul><li>知识结构</li></ul></div>'}n.value="步骤 3/3：生成知识详解...",t.value=65;const O=i==null?void 0:i[0],de=Kt((O==null?void 0:O.subject)||"",(O==null?void 0:O.stage)||""),Ce=(O==null?void 0:O.stage)||"",Je=jn()+`
【参考资料——以下是生成所需的所有背景信息】
${h}

【知识图谱结构】
${D}

【教材原文参考】
${T.substring(0,3e3)}
${U?`【模板风格参考】
`+U.substring(0,1500)+`
`:""}【已生成的思维导图】
${q}

【生成要求——请生成以下内容，每个板块必须输出具体内容，禁止写"略""见教材""自行查阅"等占位符】
${(()=>{let C=`1. <h2>学习目标</h2>：用学生能理解的语言写2-3条本课/本单元学习目标
2. <h2>核心知识清单</h2>：用 <table> 列出核心知识点，包含三列：知识点 | 核心内容 | 考查方式
3. <h2>知识辨析与易错提示</h2>：用对比表格，左右两列分别列出"常见错误"和"正确理解"，至少3组
4. <h2>典型例题精析</h2>：至少3道例题，每题用 <div class="example"> 包裹题干，<div class="analysis"> 包裹解析（含解题思路+易错提示）`;return de==="语文"?C+=`
5. <h2>写作素材积累</h2>：从课文中提炼好词好句，按类别整理（写景/写人/状物/抒情等）`:["数学","物理","化学"].includes(de)?C+=`
5. <h2>公式/定理速查</h2>：列出本章所有公式和定理，标注适用条件和典型用法`:de==="英语"?(C+=Ce==="小学"?`
5. <h2>语音/发音规则归纳</h2>：归纳自然拼读规律和字母组合发音规则`:`
5. <h2>语音/发音规则归纳</h2>：归纳国际音标、重音、连读、语调等发音要点`,C+=`
6. <h2>词汇句型归纳</h2>：按词性和话题分类整理词汇，列出重点句型和语法点`):["生物","科学"].includes(de)?C+=`
5. <h2>实验/探究梳理</h2>：列出本章的实验名称、实验步骤、实验现象和结论（用表格呈现：实验名称 | 步骤 | 现象 | 结论）`:["历史","地理"].includes(de)?C+=`
5. <h2>图表/时间轴整理</h2>：历史学科整理时间轴（关键事件+时间+影响），地理学科整理地图/图表（区域特征+自然/人文要素对比表）`:["道德与法治","思想政治"].includes(de)&&(C+=`
5. <h2>案例分析归纳</h2>：列出教材中的典型案例，用"案例→知识点→启示"的格式呈现，至少2组`),C+=`
<br>
<h2>五、重难点星级标注</h2>：用 <table> 列出本章所有知识点，三列：知识点 | 难度(基础/重点/难点) | 星级与考点说明（⭐️低频 ⭐️⭐️中频 ⭐️⭐️⭐️高频必考，至少写半句话说明为什么是考点）
<h2>六、记忆方法/学习技巧</h2>：用 <p> 逐条列出2-3个记忆口诀或学习方法建议，每条以序号+<strong>方法名</strong>开头`,Ce==="小学"&&(C+=`
📝 <h2>趣味小练习</h2>：2-3道巩固题，用游戏化/生活化形式呈现（题目留空让学生做，答案放文末）`),C})()}

${Ln(h,u,de,{小学:"primary",初中:"middle",高中:"high"}[Ce]||Ce,(O==null?void 0:O.grade)||"")}

【格式补充】
- 重要公式用 <div class="formula"> 包裹
- 不要包含思维导图（已单独生成）

${(()=>{let C="";if(de){const z=Y({category:"生成-学科标记",subject:de,stage:""}),l=Ce?Y({category:"生成-学科标记",subject:de,stage:Ce}):[],we=[...z];for(const he of l)we.find(G=>G.id===he.id)||we.push(he);we.length>0&&(C=`【学科专用标记规范】
`+we.map(he=>he.content).join(`
`)+`

`)}return C})()}${Kn("summary",de,Ce,((ie=i==null?void 0:i[0])==null?void 0:ie.grade)||"")}`;try{const C=await ne(Je,{taskType:"generation",timeout:18e4});zn(C,"summary");const z=q+`

`+(C||""),l=i==null?void 0:i[0],we=(l==null?void 0:l.stage)||"",he={小学:"primary",初中:"middle",高中:"high"},G=Zt.check(z,[],(l==null?void 0:l.subject)||"",he[we]||we,(l==null?void 0:l.grade)||"",u),ce={formatCheck:{passed:z.includes("<table")&&z.includes("<h2"),details:z.includes("<table")?[]:["缺少表格"]},coverageCheck:{passed:!0,details:[]},knowledgeCheck:{passed:z.length>500,details:[]},aiReview:{passed:G.filter(Fe=>Fe.severity==="error").length===0,details:G.map(Fe=>Fe.detail)}};return t.value=100,n.value="生成完成",{success:!0,content:z,blueprint:"",contentCards:[],knowledgeMap:{},issues:G.map(Fe=>Fe.detail),qualityReport:ce,generatedQuestions:[],parsedBlueprint:[]}}catch(C){return console.error("知识点总结生成失败:",C),{success:!1,error:C.message}}finally{e.value=!1}},bs=async(h,u,i,p,P=!1)=>{var Fe,le;const m=await mn(i,ne,ft,(M,L)=>{n.value=M,t.value=L}),$=await Mn(m,i,ne,ft,(M,L)=>{n.value=M,t.value=L}),w=i==null?void 0:i[0],g=(w==null?void 0:w.subject)||"",T=(w==null?void 0:w.stage)||"",x=(w==null?void 0:w.grade)||"",ee={小学:"primary",初中:"middle",高中:"high"},J=$.knowledgePoints||[],U=$.knowledgeGraph||[];let D=J.length>0?[...new Set(J)].slice(0,30):[];if(D.length===0){const M=(m||[]).flatMap(X=>X.tags||[]),L=(m||[]).flatMap(X=>(X.knowledgePointsForTest||[]).map(_=>typeof _=="string"?_:_.name));D=[...new Set([...M,...L].filter(Boolean))].slice(0,30)}let N=[];if(D.length===0){const M=i==null?void 0:i[0],L=((M==null?void 0:M.selectedChapters)||[]).map(X=>X.title).filter(Boolean);if(L.length===0){console.warn("⚠️ 错题本：无可用知识点且无章节标题，无法生成");const X='<h1>错题本</h1><div class="errorbook-info"><p>⚠️ 未能提取到教材知识点，请先对教材进行「分析教材」操作后再生成错题本。</p></div>';return e.value=!1,{success:!0,content:X,blueprint:"",contentCards:[],knowledgeMap:{},generatedQuestions:[],parsedBlueprint:[],issues:["无法生成：教材未分析，缺少知识点"],qualityReport:{formatCheck:{passed:!1,details:["缺少知识点"]},coverageCheck:{passed:!1,details:[]},knowledgeCheck:{passed:!1,details:["无可用知识点"]},aiReview:{passed:!1,details:["请先分析教材"]}}}}console.warn("⚠️ 错题本：未提取到知识点，使用章节标题作为降级"),N=L.slice(0,6).map(X=>({knowledgePoint:X,errorType:"概念混淆",typicalError:"对该章节核心概念理解不清晰",rootCause:"基础知识掌握不牢固",frequency:"中频"}))}if(P){t.value=50,n.value="错题本蓝图已生成";const M=D.length>0?D:((w==null?void 0:w.selectedChapters)||[]).map(I=>I.title).filter(Boolean).slice(0,15),L=yn("errorbook",g,ee[T]||T),X=is($,m,30),_=["【错题本蓝图】",`学科：${g}  |  年级：${x}  |  学段：${T}`,`结构：${L}`,`候选易错知识点（${M.length}个，非穷举）：${M.join("、")}`,`${X?`
【知识覆盖层级】
`+X:""}`,`预计生成：${Math.min(M.length,8)}道错题分析`].join(`
`);return e.value=!1,{success:!0,blueprint:_,parsedBlueprint:M.slice(0,8).map((I,ye)=>({number:ye+1,type:"错题分析",knowledgePoint:I,difficulty:"中等",score:10,sourceChapter:x})),contentCards:m,knowledgeMap:$,content:"",generatedQuestions:[],issues:null,qualityReport:null}}let q="";const O=[];for(const M of m)if(M.segments)for(const L of M.segments)O.push({chapterTitle:M.chapterTitle,text:L.text,isKey:L.isKeyConcept,isExample:L.isExample});O.sort((M,L)=>(L.isKey?1:0)-(M.isKey?1:0));let de=0;const Ce=[];for(const M of O){if(de+M.text.length>3e3)break;Ce.push(M),de+=M.text.length}q=Ce.map(M=>`【${M.chapterTitle}】${M.text}`).join(`

`);let Je="";if(p&&p.length>0){const L=((Fe=p[0].analysis)==null?void 0:Fe.rawText)||"";L&&(Je=L.substring(0,2e3))}if(n.value="步骤 1/3：识别易错知识点...",t.value=25,D.length>0)try{const M=`你是一位教学经验丰富的学科老师。请从以下知识点中，识别出学生最容易出错的5-8个知识点，并分析错误类型。

【知识点列表】
${D.join("、")}

【教材内容参考】
${q.substring(0,1500)}

请分析每个易错知识点：
1. 典型错误表现（学生常犯的具体错误）
2. 错误类型（概念混淆 / 计算失误 / 审题不清 / 方法不当 / 知识遗漏）
3. 错误根因（为什么学生会犯这个错误）
4. 考查频率（高频 / 中频 / 低频）

返回 JSON 数组：
[
  {
    "knowledgePoint": "知识点名称",
    "errorType": "概念混淆",
    "typicalError": "学生的典型错误描述",
    "rootCause": "错误根因分析",
    "frequency": "高频"
  }
]

只返回 JSON 数组。`,L=await ne(M,{taskType:"analysis",temperature:.2,timeout:6e4});try{N=await ft(L,null,"易错知识点分析"),console.log(`✅ 识别出 ${N.length} 个易错知识点`)}catch{N=D.slice(0,6).map(X=>({knowledgePoint:X,errorType:"概念混淆",typicalError:"对概念理解不清晰",rootCause:"基础知识不扎实",frequency:"中频"}))}}catch(M){console.warn("易错分析失败:",M.message),N=D.slice(0,6).map(L=>({knowledgePoint:L,errorType:"概念混淆",typicalError:"理解偏差",rootCause:"基础不牢",frequency:"中频"}))}n.value="步骤 2/3：构建知识关联...",t.value=45;let Se=[];if(N.length>1)try{const M=`请分析以下易错知识点之间的关联关系，用于推荐变式题。

【易错知识点】
${N.map(X=>X.knowledgePoint).join("、")}

【知识层级】
${JSON.stringify(U.slice(0,3)||[],null,2)}

请标注知识点之间的关联类型：
- 前置依赖（A是B的前置知识）
- 并列关系（A和B是同级知识点）
- 易混淆（A和B容易混淆）

返回 JSON 数组：
[
  {"from": "知识点A", "to": "知识点B", "relation": "前置依赖"},
  ...
]

只返回 JSON 数组。`,L=await ne(M,{taskType:"analysis",temperature:.1,timeout:6e4});try{Se=await ft(L,null,"知识关联")}catch{Se=[]}}catch(M){console.warn("知识关联分析失败:",M.message)}n.value="步骤 3/3：逐题生成错题...",t.value=55;const je=[],Le=Math.min(N.length,8),ie=(()=>{let M="";if(g){const L=Y({category:"生成-学科标记",subject:g,stage:""}),X=T?Y({category:"生成-学科标记",subject:g,stage:T}):[],_=[...L];for(const I of X)_.find(ye=>ye.id===I.id)||_.push(I);_.length>0&&(M=`
【学科专用标记规范】
`+_.map(I=>I.content).join(`
`))}return M})();for(let M=0;M<Le;M++){const L=N[M];n.value=`生成错题 ${M+1}/${Le}...`,t.value=55+Math.round(M/Le*30);const _=Se.filter(H=>H.from===L.knowledgePoint||H.to===L.knowledgePoint).map(H=>H.from===L.knowledgePoint?H.to:H.from),I=[...new Set(_)].slice(0,3),ye=jn()+`

【任务】你是一位${T||""}${x||""}${g||""}老师。请为以下易错知识点生成一道错题分析。

【知识点】${L.knowledgePoint}
【错误类型】${L.errorType||"概念混淆"}
【典型错误表现】${L.typicalError||"理解偏差"}
【错误根因】${L.rootCause||"基础不牢"}
【考查频率】${L.frequency||"中频"}

${I.length>0?"【关联知识点（用于变式题）】"+I.join("、"):""}

【教材内容参考——⚠️仅供核对知识点准确性，严禁复制原文段落】
${q.substring(0,800)}

${Je?`【错题本格式参考——⚠️仅供参考排版风格，严禁复制模板内容】
`+Je.substring(0,500):""}

【生成要求】只生成一道错题，包含以下结构：

<div class="error-item">
  <h3>错题 ${M+1}：${L.knowledgePoint}</h3>
  
  <div class="error-tags">
    <span class="tag tag-error-type">${L.errorType||"概念混淆"}</span>
    <span class="tag tag-frequency">${L.frequency||"中频"}</span>
    <span class="tag tag-difficulty">中等</span>
    <span class="tag tag-score-loss">常见失分：X分</span>
  </div>
  
  <div class="original-question">
    <h4>📝 典型错题</h4>
    <!-- 具体题目（模仿真实考卷中的题） -->
  </div>
  
  <div class="error-analysis">
    <h4>🔍 错误分析</h4>
    <p><strong>典型错误：</strong>${L.typicalError||""}（写出学生具体的错误答案或思路）</p>
    <p><strong>错误根因：</strong>${L.rootCause||""}（分析为什么会犯这个错误）</p>
    <p><strong>避错策略：</strong>（给出2-3条实用的避错方法或检查技巧）</p>
  </div>
  
  <div class="correct-solution">
    <h4>✅ 正确解法</h4>
    <!-- 完整解题过程，分步骤展示，关键步骤标注得分点 -->
  </div>
  
  <div class="variant-practice">
    <h4>🔄 变式巩固</h4>
    <!-- 一道考查同知识点但形式不同的变式题，附答案和解析 -->
    ${I.length>0?"<!-- 可结合关联知识点："+I.join("、")+" -->":""}
  </div>
</div>

【质量约束——必须遵守】
- ⛔ 典型错题必须模仿真实考卷中的题目，具体且有代表性
- ⛔ 错误分析必须具体，写出学生实际的错误答案或思路，不得泛泛而谈
- ⛔ 正确解法必须完整，分步骤展示，关键步骤标注得分点
- ⛔ 变式巩固题必须与典型错题考查同一知识点但形式不同
${(()=>{const B=Y({category:"生成-禁止项",subject:g||"",stage:{小学:"primary",初中:"middle",高中:"high"}[T]||T||"",genType:u});return B.length>0?B.map(be=>be.content).join(`
`):""})()}

【格式规范】
${(()=>{const B=Y({category:"生成-输出格式",subject:g||"",stage:{小学:"primary",初中:"middle",高中:"high"}[T]||T||"",genType:u});return B.length>0?B.map(be=>be.content).join(`
`)+`
`:""})()}
- 用 HTML 格式
- 题干用 <p class="question">，选项用 <p class="option">
- 数学公式用 $...$ 或 $$...$$
- 每个分析段落必须独立用 <p> 或 <div> 包裹，严禁多个分析点挤在同一段落
${ie}
${Ln(h)}
- 只返回上述结构的 HTML 代码，不要用代码块包裹`;try{const H=await ne(ye,{taskType:"generation",temperature:.5,timeout:12e4});je.push(H)}catch(H){console.warn(`第${M+1}道错题生成失败:`,H.message),je.push(`<div class="error-item"><h3>错题 ${M+1}：${L.knowledgePoint}</h3><p>生成失败</p></div>`)}}n.value="正在组装...",t.value=90;let C="";try{const M=`生成错题本头部 HTML：
标题：错题本 - ${((le=i==null?void 0:i[0])==null?void 0:le.name)||"知识点"} 
副标题：涵盖 ${N.length} 个易错知识点
包含生成日期 ${new Date().toLocaleDateString()}

用 <h1> 标题，<div class="errorbook-info"> 包裹信息。只返回 HTML。`;C=await ne(M,{taskType:"generation",temperature:.3,timeout:3e4})}catch{C='<h1>错题本</h1><div class="errorbook-info"><p>易错知识点整理</p></div>'}const z={};N.forEach(M=>{const L=M.errorType||"概念混淆";z[L]=(z[L]||0)+1});const l=`<div class="error-stats">
  <h2>📊 错误类型分布</h2>
  <table>
    <tr><th>错误类型</th><th>数量</th><th>占比</th></tr>
    ${Object.entries(z).map(([M,L])=>`<tr><td>${M}</td><td>${L}</td><td>${Math.round(L/N.length*100)}%</td></tr>`).join(`
`)}
  </table>
</div>`,we=C+`
`+l+`
`+je.join(`
`),he=T||"",G=Zt.check(we,[],g,ee[he]||he,x,u),ce={formatCheck:{passed:we.includes('<div class="error-item">'),details:we.includes('<div class="error-item">')?[]:["缺少错题条目"]},coverageCheck:{passed:!0,details:[]},knowledgeCheck:{passed:we.length>300,details:[]},aiReview:{passed:G.filter(M=>M.severity==="error").length===0,details:G.map(M=>M.detail)}};return t.value=100,n.value="生成完成",{success:!0,content:we,blueprint:"",contentCards:[],knowledgeMap:{},issues:G.map(M=>M.detail),qualityReport:ce,generatedQuestions:[],parsedBlueprint:[]}},vs=async()=>{s.value&&(console.log("🛑 正在发送取消信号..."),s.value.abort(),Ps(s.value),console.log("🛑 已发送取消信号"));try{const h=await Qt("generation"),u=await Fn(),i=[];h.engine==="ollama"&&h.textModel&&i.push({name:h.textModel,baseUrl:h.baseUrl}),u.engine==="ollama"&&u.model&&(i.find(p=>p.name===u.model)||i.push({name:u.model,baseUrl:u.baseUrl}));for(const p of i){n.value="🛑 正在释放显存...",console.log(`🛑 卸载模型: ${p.name}`);try{await kt.post(`${p.baseUrl}/api/generate`,{model:p.name,prompt:"",stream:!1,keep_alive:0},{timeout:3e3})}catch{}try{const{exec:P}=require("child_process");await new Promise(m=>{P(`ollama stop ${p.name}`,{timeout:1e4},($,w,g)=>{$?console.warn(`⚠️ ollama stop ${p.name} 失败:`,$.message):console.log(`✅ ollama stop ${p.name} 成功:`,(w==null?void 0:w.trim())||(g==null?void 0:g.trim())),m()})})}catch{}}}catch(h){console.warn("模型卸载失败:",h.message)}s.value=new AbortController,Ms(s.value),e.value=!1,t.value=0,n.value="显存已释放",setTimeout(()=>{n.value==="显存已释放"&&(n.value="")},2e3)},Ts=async(h,u,i,p,P=!1)=>{var J,U,D;const m=i==null?void 0:i[0],$=(m==null?void 0:m.subject)||"",w=(m==null?void 0:m.stage)||"",g={小学:"primary",初中:"middle",高中:"high"},T=g[w]||w,x=Kt($,T),ee=(m==null?void 0:m.grade)||"";n.value="构建预习框架...",t.value=15;try{const N=await mn(i,ne,ft,(G,ce)=>{n.value=G,t.value=10+ce*.2}),q=await Mn(N,i,ne,ft,(G,ce)=>{n.value=G,t.value=15+ce*.3});let O=(q.knowledgePoints||[]).slice(0,30);if(O.length===0){const G=(N||[]).flatMap(Fe=>Fe.tags||[]),ce=(N||[]).flatMap(Fe=>(Fe.knowledgePointsForTest||[]).map(le=>typeof le=="string"?le:le.name));O=[...new Set([...G,...ce].filter(Boolean))].slice(0,30)}if(O.length===0&&(O=(((J=i==null?void 0:i[0])==null?void 0:J.selectedChapters)||[]).map(ce=>ce.title).filter(Boolean).slice(0,15)),P){t.value=50,n.value="预习蓝图已生成";const G=yn("preview",x,T),ce=is(q,N,30),Fe=((U=N==null?void 0:N[0])==null?void 0:U.summary)||"",le=["【课前预习蓝图】",`学科：${x}  |  年级：${ee}  |  学段：${w}`,`${Fe?"🎯 核心主题："+Fe+`
`:""}预习结构：${G}`,`知识点抽样（${O.length}个，非穷举）：${O.join("、")}`,`${ce?`
【知识层级】
`+ce:""}`,"预计生成：学习目标2-3条 + 预习任务3-5个 + 预习检测3-5题"].join(`
`);return e.value=!1,{success:!0,blueprint:le,parsedBlueprint:O.map((M,L)=>({number:L+1,type:"预习检测",knowledgePoint:M,difficulty:"基础",score:5,sourceChapter:ee})),contentCards:N,knowledgeMap:q,content:"",generatedQuestions:[],issues:null,qualityReport:null}}const de=O.map((G,ce)=>({number:ce+1,type:"预习检测",knowledgePoint:G})),Ce=as(N,de,3e3),Je=Gn[u],Se=w||"小学",je=ee||"",Le=(m==null?void 0:m.selectedChapters)||[];let ie="";if(Le.length===1)ie=`「${Le[0].title}」`;else if(Le.length>1){const G=Le[0].title||"",ce=G.match(/第([一二三四五六七八九十]+)单元/);ie=ce?`第${ce[1]}单元`:`「${G}等」`}n.value="生成课前预习...",t.value=50;const C=jn()+`

【任务】你是一位${Se}${je}${x}教师，请根据以下蓝图和原文，为学生设计一份课前预习资料。

【预习蓝图——⚠️仅供参考，严禁直接复制蓝图数据到输出】
标题：${ie?ie+" ":""}${(Je==null?void 0:Je.name)||"课前预习"}
学科：${x}  |  年级：${je}  |  学段：${Se}
结构：${yn("preview",x,T)}
知识点（非穷举，请结合教材原文覆盖全部内容）：${O.join("、")}

【教材原文片段——⚠️仅供核对知识点准确性，严禁复制原文段落】
${Ce||"（基于蓝图知识点生成）"}

【学科要求】
${(Je==null?void 0:Je.instruction)||"以引导学生自主预习为核心。"}
${x==="语文"?`
- 语文预习四层：识字写字（每个生字独立用<span class="tian-zi-ge">字</span>包裹 + 拼音 + 部首 + 笔画数 + 结构 + 笔顺，多字示例：<span class="tian-zi-ge">蝌</span><span class="tian-zi-ge">蚪</span>）→ 词语积累（释义+多音字+会认/会写区分）→ 句子理解（原文+修辞赏析）→ 段落感知（逐段概括）
- ⚠️ 组词必须是日常常用标准词语，禁止生造（如"袋包""山袋"）
- 课后思考只写问题不附答案
${(()=>{const G=It(ee);return T==="primary"&&G<=2?"- 低段：生字配<ruby>汉字<rt>拼音</rt></ruby>，配情境图 [IMAGE]":""})()}`:x==="英语"?`
- 英语预习四层：单词认知（从教材单词表中提取，每个单词标注音标+中文释义+词性，按词性分类排列）→ 短语积累（从课文中提取常用搭配，给出中文释义和例句）→ 句型理解（提炼核心句型，标注交际场景如"早上见面用""询问年龄用"，给出替换练习框架）→ 对话/段落感知（概括课文大意，标注关键信息点，引导学生关注上下文逻辑）
- ⚠️ 单词必须来自教材原文单词表或课文中出现的词汇，禁止凭空编造单词
- ⚠️ 中文释义必须准确，禁止逐字硬译（如"Good morning"释义应为"早上好"而非"好的早晨"）
- 句型替换练习留空让学生填写，答案放文末
${(()=>{const G=It(ee);return T==="primary"&&G<=4?"- 中段：书写练习配四线三格，配情境图 [IMAGE]，单词配读音提示":T==="primary"?"- 高段：书写练习用单线，增加句子仿写":""})()}`:x==="数学"?`
- 数学预习四层：概念感知（从教材中提取本节核心概念，用生活化语言解释"是什么"，配简单图示说明）→ 算理初探（展示1-2道教材例题的计算过程，标注每一步的含义和依据，引导学生理解"为什么这样算"）→ 方法归纳（总结解题步骤/公式/口诀，用"第一步…第二步…"的形式呈现）→ 尝试练习（2-3道基础题，与例题同类型但数据不同，留空让学生试做）
- ⚠️ 概念解释必须用学生能理解的语言，禁止照搬教材定义
- ⚠️ 例题必须来自教材原文或教材同类题型，禁止超纲编造
- 尝试练习题留空，答案放文末
${(()=>{const G=It(ee);return T==="primary"&&G<=2?"- 低段：配实物图/情境图 [IMAGE]，数字不超100，仅加减法":T==="primary"?"- 中高段：配线段图/示意图，增加估算和验算提示":""})()}`:["物理","化学","生物","科学"].includes(x)?`
- 理科预习四层：概念预读（从教材中提取核心概念/定义/公式，标注关键词，用通俗语言解释含义）→ 实验/现象观察（如教材有实验，描述实验步骤和预期现象，引导学生思考"为什么会这样"；如无实验则描述生活中的相关现象）→ 原理初探（解释概念背后的基本原理，用因果链"因为…所以…"的方式呈现）→ 预习自测（2-3道基础判断题或填空题，考查概念理解，留空让学生试做）
- ⚠️ 概念/公式/定理必须与教材原文一致，禁止自行修改
- ⚠️ 实验步骤必须来自教材，禁止编造
- 预习自测留空，答案放文末`:""}
- 预习检测：${T==="primary"?"5-8道":"3-5道"}基础题，题目留空不写答案
- 🔴 铁律：答案统一放文末<div class="answer-section">中，题目绝不出现答案
- 语言适合${je}学生，预习时间10-15分钟

${Ln(h,u,x,T,ee)}

【格式规范——必须严格遵守】
${(()=>{const G=Y({category:"生成-输出格式",subject:x,stage:T,genType:u});return G.length>0?G.map(ce=>ce.content).join(`
`)+`
`:""})()}- ⚠️ 输出必须是完整的HTML代码，每个板块、每个条目都要有独立的HTML标签包裹
- 🔴 每个板块必须输出具体内容（含例句/例题/释义），禁止写"略""见教材""自行查阅"等占位符
- 大标题用 <h1>，板块标题（一、二、三）用 <h2>
- 每个条目用 <p> 或 <li> 包裹，禁止所有条目挤在一行！
- 需要换行用 <br>，段落间用空行分隔
${x==="语文"?`
【语文学科格式】
- 生字展示：每个生字独立一个 <span class="tian-zi-ge">字</span>，多字示例 <span class="tian-zi-ge">蝌</span><span class="tian-zi-ge">蚪</span>，⚠️ 严禁多个字共用一个 tian-zi-ge
- 🔴 生字必须附带部首、笔画数、结构、笔顺，格式示例：
  <p><span class="tian-zi-ge">蝌</span>（部首：虫，15画，左右结构，笔顺：竖、横折、横、竖、横、点、撇、横、竖、撇、点、横、竖、横）</p>
- ⛔ 禁止只写字和拼音不写部首/笔画/笔顺！每个生字都要有完整的部首、笔画数、结构和笔顺信息
- 词语释义：<strong>词语</strong>：释义内容
- 句子赏析：<div class="example"><p>原文句子</p><p>赏析：...</p></div>
- 🔴 看拼音写词语格式：<p>kē dǒu <u class="blank-2">&emsp;</u> &emsp; dài shǔ <u class="blank-2">&emsp;</u></p>（只写拼音不写汉字！）
- 课后思考只写问题不附答案
`:""}${x==="英语"?`
【英语学科格式】
- 🔤 第一层·单词认知：每个单词用 <p><strong>单词</strong> <span class="phonetic">/音标/</span> <em>词性</em> 中文释义</p>
- 📝 第二层·短语积累：<div class="phrase-group"><p><strong>短语</strong>：中文释义</p><p class="example">例句</p></div>
- 📐 第三层·句型理解：核心句型用 <div class="sentence-pattern"><p class="model">句型结构</p><p class="example">例句</p><p class="usage">交际场景：...</p><p class="drill">替换练习：<u class="blank-4">&emsp;</u>（留空）</p></div>
- 📖 第四层·段落/对话感知：<div class="passage-summary"><p><strong>大意</strong>：...</p><p><strong>关键信息</strong>：...</p></div>
- ${T==="primary"&&It(ee)<=4?'书写区用 <span class="four-line-three english-line">word</span> 四线三格':'书写区用单线 <span class="english-line">word</span>'}
- 单词必须从教材原文单词表提取，中文释义必须准确（禁止逐字硬译）
- 句型交际场景必须具体（"早上见面"而非"问候"），替换练习留空`:""}${["数学","物理","化学","生物","科学"].includes(x)?`
【理科格式】
- 概念定义用 <div class="definition">，公式用 <div class="formula">$...$</div>
- 口算题用 <span class="oral-box">算式</span>
- 竖式计算用 <div class="vertical-calc">，例题必须给出完整解题步骤
${["物理","化学","生物","科学"].includes(x)?`- 实验步骤用 <div class="experiment-steps"><ol><li>步骤</li></ol></div>，实验现象用 <strong>加粗</strong> 标注
`:""}`:""}
- 🔴 填空题格式：<p>题干<u class="blank-2">&emsp;</u>题干</p>（横线留空不填答案！）
- 🔴 括号留空格式：题末括号根据答案字数动态计算宽度！<span class="blank-N">&emsp;</span>（N按答案字数：1-2字→4, 3-4字→6, 5-6字→8, 7-10字→10，⛔严禁括号内用 <u> 标签）
- 答案统一放文末 <div class="answer-section"><h2>答案与提示</h2>...</div>
- ⛔ 严禁：题目中直接写答案、所有内容挤在一个段落、用空格代替换行
${(()=>{const G=It(ee);return T==="primary"&&G<=2?`- 低段配插图：[IMAGE]
TYPE:SD
PROMPT:描述
STYLE:cartoon
[/IMAGE]
`:""})()}

【强制输出格式——最后一条指令】
你必须输出标准HTML代码。每个标题、每个段落、每个条目都必须用独立的HTML标签包裹。不允许纯文本输出。

${Kn("preview",x,T,ee)}

现在请直接输出完整的预习资料HTML：`,z=await ne(C,{taskType:"generation",temperature:.3,timeout:12e4,signal:(D=s.value)==null?void 0:D.signal});zn(z,"preview"),n.value="校验预习资料质量...",t.value=85;const l=Zt.check(z,[],x,g[w]||w,ee,u),we={formatCheck:{passed:z.length>200,details:z.length<=200?["内容过短"]:[]},coverageCheck:{passed:!0,details:[`知识点参考：${(q.knowledgePoints||[]).slice(0,5).join("、")}`]},knowledgeCheck:{passed:z.length>500,details:l.filter(G=>G.severity==="error").map(G=>G.detail)},aiReview:{passed:l.filter(G=>G.severity==="error").length===0,details:l.map(G=>G.detail)}},he=ns(z,x,w,ee);return he.hasViolations&&(we.knowledgeCheck.passed=!1,we.knowledgeCheck.details.push(`超纲检测发现${he.summary.errorCount}处问题`)),t.value=100,n.value="生成完成",e.value=!1,{success:!0,content:z,blueprint:"",contentCards:N,knowledgeMap:q,generatedQuestions:[],parsedBlueprint:[],issues:l.map(G=>G.detail),qualityReport:we}}catch(N){return console.error("课前预习生成失败:",N),{success:!1,error:N.message}}finally{e.value=!1}},Cs=async(h,u,i,p,P=!1)=>{var J;const m=i==null?void 0:i[0],$=(m==null?void 0:m.subject)||"",w=(m==null?void 0:m.stage)||"",g={小学:"primary",初中:"middle",高中:"high"},T=g[w]||w,x=Kt($,T),ee=(m==null?void 0:m.grade)||"";n.value="提取教材生字词...",t.value=20;try{const U=await mn(i,ne,ft,(l,we)=>{n.value=l,t.value=10+we*.2});let D=[];if(U&&U.length>0){const l=U.flatMap(ce=>ce.tags||[]),we=U.flatMap(ce=>(ce.knowledgePointsForTest||[]).map(Fe=>typeof Fe=="string"?Fe:Fe.name)),he=U.map(ce=>ce.summary).filter(Boolean),G=((m==null?void 0:m.selectedChapters)||[]).map(ce=>ce.title).filter(Boolean);D=[...new Set([...l,...we,...he,...G].filter(Boolean))].slice(0,30)}if(D.length===0&&(D=((m==null?void 0:m.selectedChapters)||[]).map(we=>we.title).filter(Boolean).slice(0,15)),P){t.value=50,n.value="听写蓝图已生成";const l=yn("dictation",x,T),we=x==="英语"?"单词/短语听写":x==="语文"?"生字词默写":"听写/默写",he=is({knowledgeGraph:[]},U,30),G=["【听写/默写蓝图】",`学科：${x}  |  年级：${ee}  |  学段：${w}`,`类型：${we}`,`练习结构：${l}`,`词汇抽样（${D.length}个，非穷举）：${D.join("、")}`,`${he?`
【知识覆盖层级】
`+he:""}`].join(`
`);return e.value=!1,{success:!0,blueprint:G,parsedBlueprint:D.map((ce,Fe)=>({number:Fe+1,type:"听写",knowledgePoint:ce,difficulty:"基础",score:2,sourceChapter:ee})),contentCards:U,knowledgeMap:{knowledgePoints:D,keyDifficulties:[],knowledgeGraph:[],crossChapterLinks:[]},content:"",generatedQuestions:[],issues:null,qualityReport:null}}const N=(D==null?void 0:D.map((l,we)=>({number:we+1,type:"听写",knowledgePoint:l})))||[],q=as(U,N,1200),O=Gn[u],de=w||"小学",Ce=ee||"",Je=x==="英语",Se=(m==null?void 0:m.selectedChapters)||[];let je="";if(Se.length===1)je=`「${Se[0].title}」`;else if(Se.length>1){const l=Se[0].title||"",we=l.match(/第([一二三四五六七八九十]+)单元/);je=we?`第${we[1]}单元`:`「${l}等」`}n.value="生成听写/默写内容...",t.value=50;const Le=jn()+`

【任务】你是一位${de}${Ce}${x}教师，请设计一份学生可直接使用的听写/默写练习纸。必须包含多种题型，练习区只显示提示+留空（学生填写），答案统一放文末。

🎯 关键原则：
- 练习区 = 提示+留空（学生填写区），答案区 = 标准答案（文末）
- 必须包含至少2种不同题型方向（如英译汉+汉译英、挖空+翻译等），不能全是一种形式
- 每一题都是学生要动手写的，不能只是"听"

【蓝图——⚠️仅供参考，严禁直接复制蓝图数据到输出】
标题：${je?je+" ":""}${(O==null?void 0:O.name)||"听写默写"}
结构：${yn("dictation",x,T)}
词汇示例（非穷举，请覆盖课文全部词汇+短语+句型）：${D.join("、")}
⚠️ 以上仅为知识点抽样示例，你必须结合【教材原文片段】覆盖课文出现的所有词汇、短语和句型，不限于上述示例

【教材原文片段——⚠️仅供核对知识点准确性，严禁复制原文段落】
${q||"（基于蓝图知识点生成）"}

【学科要求】
${Je?`- 英语默写练习纸，必须包含以下多种题型（至少3种，分节清晰标注标题）：
  ① 英译汉（看英文写中文）：给出英文单词/短语，学生写中文释义
  ② 汉译英（看中文写英文）：给出中文释义+词性提示，学生写英文单词/短语
  ③ 单词挖空默写：给出单词的部分字母提示（如 h_llo、_at、c_t），学生补全缺失字母；挖去关键字母（元音或易错辅音），保留首字母或部分字母作线索
  ④ 句子默写（汉译英）：给出完整中文句子，学生写出对应英文句子
  ⑤ 句子默写（英译汉）：给出英文句子，学生写出中文意思
- ⛔ 关键防漏题规则：每个词汇/短语/句子只能出现在一种题型中，严禁同一内容在多个题型间重复出现（如 hello 出现在英译汉就不能再出现在汉译英或挖空中，否则学生能从其他题型直接抄答案）
- 词汇按难度分配到不同题型：简单词→英译汉，中等词→汉译英，较难词→挖空默写
- 书写区用${T==="primary"&&It(ee)<=4?"四线三格":"单线"}留空，不写答案内容
- 难度递增，同一题型内由易到难排列`:x==="语文"?`- 语文默写练习纸：每个生字给出拼音提示，书写区用田字格留空（学生填字）
- 词语默写给出拼音，词语书写区留空
- 句子/古诗文默写给出上句/标题提示，下句或全文留空
- 每个生字附加部首、笔画、结构、笔顺信息（字典式标注，在字旁独立列出）`:"- 学科默写练习纸：给出概念/公式/术语提示，答案区留空给学生填写"}
- 题量：字词${T==="primary"?"8-15":"10-20"}个，句子${T==="primary"?"2-4":"3-5"}句
- 答案集中放文末<div class="answer-section">中，练习区不出现答案
- 适合${Ce}水平

${Ln(h,u,x,T,ee)}

【格式规范——必须严格遵守】
${(()=>{const l=Y({category:"生成-输出格式",subject:x,stage:T,genType:u});return l.length>0?l.map(we=>we.content).join(`
`)+`
`:""})()}- 🔴 每个板块必须输出具体内容，禁止写"略""见教材""自行查阅"等占位符或空写"听录音写单词"而无具体单词列表
- 输出必须是完整HTML，每个条目用 <p> 或 <div class="dictation-item"> 独立包裹
- 大标题用 <h1>，分节用 <h2>
- 参考答案统一放文末 <div class="answer-section">
- ⛔ 严禁所有内容挤在一个段落
${Mr.dictation(x,T)}
${x==="语文"&&T==="primary"?`【语文学科格式】
生字用<span class="tian-zi-ge">字</span>（HTML），情境图[IMAGE]单独成行
`:""}${Je?`【英语学科格式】
- 写英文用：${T==="primary"&&It(ee)<=4?'<span class="four-line-three english-line">word</span> 四线三格':'<span class="english-line">word</span> 单线'}
- 写中文用：<span class="blank-line">&emsp;&emsp;</span> 普通横线（禁止四线格/田字格）
- 每个单词给出中文释义和词性
`:""}${["数学","物理","化学"].includes(x)?`【理科格式】
- 算式书写工整，竖式计算用 <div class="vertical-calc">
`:""}

【强制输出格式——最后一条指令】
你必须输出标准HTML代码。不允许纯文本输出。

${Kn("dictation",x,T,ee)}

现在请直接输出完整的听写默写练习HTML：`,ie=await ne(Le,{taskType:"generation",temperature:.2,timeout:12e4,signal:(J=s.value)==null?void 0:J.signal});zn(ie,"dictation"),n.value="校验听写内容质量...",t.value=85;const C=Zt.check(ie,[],x,g[w]||w,ee,u),z={formatCheck:{passed:ie.length>100,details:ie.length<=100?["内容过短"]:[]},coverageCheck:{passed:!0,details:[]},knowledgeCheck:{passed:ie.length>300,details:C.filter(l=>l.severity==="error").map(l=>l.detail)},aiReview:{passed:C.filter(l=>l.severity==="error").length===0,details:C.map(l=>l.detail)}};return t.value=100,n.value="生成完成",e.value=!1,{success:!0,content:ie,blueprint:"",contentCards:U,knowledgeMap:{knowledgePoints:[],keyDifficulties:[],knowledgeGraph:[],crossChapterLinks:[]},generatedQuestions:[],parsedBlueprint:[],issues:C.map(l=>l.detail),qualityReport:z}}catch(U){return console.error("听写默写生成失败:",U),{success:!1,error:U.message}}finally{e.value=!1}},Ss=async(h,u,i,p,P=!1)=>{var J,U,D;const m=i==null?void 0:i[0],$=(m==null?void 0:m.subject)||"",w=(m==null?void 0:m.stage)||"",g={小学:"primary",初中:"middle",高中:"high"},T=g[w]||w,x=Kt($,T),ee=(m==null?void 0:m.grade)||"";n.value="提取教材阅读素材...",t.value=20;try{const N=await mn(i,ne,ft,(G,ce)=>{n.value=G,t.value=10+ce*.2}),q=await Mn(N,i,ne,ft,(G,ce)=>{n.value=G,t.value=15+ce*.3});let O=(q.knowledgePoints||[]).slice(0,30);if(O.length===0){const G=(N||[]).flatMap(Fe=>Fe.tags||[]),ce=(N||[]).flatMap(Fe=>(Fe.knowledgePointsForTest||[]).map(le=>typeof le=="string"?le:le.name));O=[...new Set([...G,...ce].filter(Boolean))].slice(0,30)}if(O.length===0&&(O=(((J=i==null?void 0:i[0])==null?void 0:J.selectedChapters)||[]).map(ce=>ce.title).filter(Boolean).slice(0,15)),P){t.value=50,n.value="阅读训练蓝图已生成";const G=is(q,N,30),ce=T==="primary"?"200-400字":T==="middle"?"400-800字":"600-1200字",Fe=((U=N==null?void 0:N[0])==null?void 0:U.summary)||"",le=yn("reading",x,T),M=["【阅读训练蓝图】",`学科：${x}  |  年级：${ee}  |  学段：${w}`,`${Fe?"🎯 核心主题："+Fe+`
`:""}训练结构：${le}`,`选文篇幅：${ce}  |  选文数：1-2篇`,`知识点抽样（${O.length}个，非穷举）：${O.join("、")}`,`${G?`
【知识覆盖层级】
`+G:""}`,`题目类型：信息提取、词句理解、主旨概括、推理判断${T!=="primary"?"、评价鉴赏":""}`].join(`
`);return e.value=!1,{success:!0,blueprint:M,parsedBlueprint:O.map((L,X)=>({number:X+1,type:"阅读理解",knowledgePoint:L,difficulty:"中等",score:5,sourceChapter:ee})),contentCards:N,knowledgeMap:q,content:"",generatedQuestions:[],issues:null,qualityReport:null}}const de=(q.knowledgePoints||[]).map(G=>({number:0,knowledgePoint:G})),Ce=as(N,de,3e3),Je=Gn[u],Se=w||"小学",je=ee||"",Le=(m==null?void 0:m.selectedChapters)||[];let ie="";if(Le.length===1)ie=`「${Le[0].title}」`;else if(Le.length>1){const G=Le[0].title||"",ce=G.match(/第([一二三四五六七八九十]+)单元/);ie=ce?`第${ce[1]}单元`:`「${G}等」`}n.value="生成阅读训练...",t.value=50;const C=jn()+`

【任务】你是一位${Se}${je}${x}教师，请根据以下蓝图和原文，设计一份阅读理解训练。

【训练蓝图——⚠️仅供参考，严禁直接复制蓝图数据到输出】
标题：${ie?ie+" ":""}${(Je==null?void 0:Je.name)||"阅读训练"}
结构：${yn("reading",x,T)}
知识点（非穷举，请结合教材原文覆盖全部内容）：${O.join("、")}

【教材原文片段——⚠️仅供核对知识点准确性，严禁复制原文段落】
${Ce||"（基于蓝图知识点编选短文）"}

【学科要求】
${(Je==null?void 0:Je.instruction)||"以阅读理解能力训练为核心。"}
- 选文：${T==="primary"?"200-400字":T==="middle"?"400-800字":"600-1200字"}，主题贴近教材
- 文体：${x==="语文"?"记叙文/说明文/童话/寓言/散文":x==="英语"?"对话/短文/故事/书信":"根据学科选择"}
- 题目覆盖：信息提取、词句理解、主旨概括、推理判断${T!=="primary"?"、评价鉴赏、写作手法分析":""}
- 题型：选择题${T==="primary"?"40%":"30%"}+简答题${T==="primary"?"60%":"70%"}，${(()=>{const G=It(ee),ce=jt(T,G>0&&G<=2,G>=3&&G<=4,G>=5,u);return ce?`基础${ce.basic}%/提升${ce.medium}%/拓展${ce.advanced}%`:"基础50%/提升30%/拓展20%"})()}
${x==="英语"?`- 英语阅读：生词需给出中文释义，短文须是完整的独立英文文章（不能是“请阅读教材第X页”）
`:""}${T==="primary"&&It(ee)<=2?`- 低段：童话/寓言，配插图，语言通俗
`:""}- 答案统一放文末<div class="answer-section">中

${Ln(h,u,x,T,ee)}

【格式规范——必须严格遵守】
${(()=>{const G=Y({category:"生成-输出格式",subject:x,stage:T,genType:u});return G.length>0?G.map(ce=>ce.content).join(`
`)+`
`:""})()}- 输出必须是完整HTML，短文用 <div class="reading-passage">，题目用 <ol><li>
- 大标题用 <h1>，分节用 <h2>
- 选择题选项用 <p class="option">
- 参考答案统一放文末 <div class="answer-section">
- ⛔ 严禁所有内容挤在一个段落
${Mr.reading()}

【强制输出格式——最后一条指令】
你必须输出标准HTML代码。不允许纯文本输出。

${Kn("reading",x,T,ee)}

现在请直接输出完整的阅读训练HTML：`,z=await ne(C,{taskType:"generation",temperature:.3,timeout:18e4,signal:(D=s.value)==null?void 0:D.signal});zn(z,"reading"),n.value="校验阅读训练质量...",t.value=85;const l=Zt.check(z,[],x,g[w]||w,ee,u),we={formatCheck:{passed:z.length>300,details:z.length<=300?["内容过短"]:[]},coverageCheck:{passed:!0,details:[`知识点参考：${(q.knowledgePoints||[]).slice(0,5).join("、")}`]},knowledgeCheck:{passed:z.length>500,details:l.filter(G=>G.severity==="error").map(G=>G.detail)},aiReview:{passed:l.filter(G=>G.severity==="error").length===0,details:l.map(G=>G.detail)}},he=ns(z,x,w,ee);return he.hasViolations&&(we.knowledgeCheck.passed=!1,we.knowledgeCheck.details.push(`超纲检测发现${he.summary.errorCount}处问题`)),t.value=100,n.value="生成完成",e.value=!1,{success:!0,content:z,blueprint:"",contentCards:N,knowledgeMap:q,generatedQuestions:[],parsedBlueprint:[],issues:l.map(G=>G.detail),qualityReport:we}}catch(N){return console.error("阅读训练生成失败:",N),{success:!1,error:N.message}}finally{e.value=!1}},vn=async(h,u,i,p,P,m,$)=>{var w,g,T,x,ee,J,U,D,N,q,O,de;s.value&&Ps(s.value),s.value=new AbortController,Ms(s.value),e.value=!0,t.value=60;try{let Ce=0;const Je=h.match(/总分[：:]\s*(\d+)/);Je&&(Ce=parseInt(Je[1]));let Se=[];try{const M=`请将以下命题蓝图解析为JSON数组，每个元素代表一道题：

      ${P}

      返回格式：
      [
        {
          "number": 1,
          "type": "选择题|填空题|解答题|...",
          "knowledgePoint": "考查的知识点",
          "difficulty": "基础|中等|较难",
          "score": 分值数字,
          "sourceChapter": "对应的课文/章节"
        }
      ]

      只返回JSON数组，不要其他内容。`,L=await ne(M);Se=await ft(L,X=>ne(X,{temperature:.1}),"蓝图解析(确认模式)"),console.log("✅ 蓝图解析成功，共",Se.length,"题")}catch(M){console.warn("蓝图解析失败，将使用传统方式生成:",M.message)}let je="";const Le=[];if(Se.length>0){const M=Se.length;let L="";const X=h.match(/命题风格[：:]\s*([^\n]+)/),_=X?X[1]:"";if(_.includes("统一情境")||_.includes("情境融合")||_.includes("unified_context")||_.includes("context_fusion"))try{const ye=`请为以下试卷设计一个贯穿全卷的统一情境/主题故事。
学科：${((w=i==null?void 0:i[0])==null?void 0:w.subject)||""}
年级：${((g=i==null?void 0:i[0])==null?void 0:g.grade)||""}
总题数：${M}
知识点：${Se.map(B=>B.knowledgePoint).slice(0,5).join("、")}

要求：
1. 取一个情境名称（15字以内）
2. 描述情境背景（50字以内）
3. 列出3-5个可用于不同题目的场景元素

返回JSON：{"name":"情境名称","background":"情境背景","scenes":["场景1","场景2"]}`,H=await ne(ye,{temperature:.5});try{const B=await ft(H,null,"情境锚点");L=`【统一情境：${B.name}】背景：${B.background}。可用场景：${(B.scenes||[]).join("、")}。请在此情境下命制本题，保持与前后题目的叙事连贯性。`}catch{}}catch(ye){console.warn("情境锚点生成失败:",ye.message)}let I=[];for(let ye=0;ye<M;ye++){const H=Se[ye],B=await Qt("generation"),be=pn(B.textModel||B.model);n.value=`生成第${ye+1}/${M}题 [${be}]...`,t.value=60+Math.round(ye/M*25);let fe=I.length>0?`【已生成题目，请避免知识点重复】
${I.join(`
`)}
`:"",lt="";if(I.length>2){const Oe=Le.slice(-3),ot=[],Re=[];for(const mt of Oe){const Mt=mt.replace(/<[^>]+>/g,"").trim().match(/^\d+[\.、．]\s*(.{1,20})/);Mt&&ot.push(Mt[1]);const Pt=(mt.match(/<p class="option"/g)||[]).length;Pt>0&&Re.push(Pt)}if(ot.length>=2&&ot.every(Me=>ot[0].substring(0,2)===Me.substring(0,2))&&(lt=`⚠️ 【句式雷同警告——你必须打破此模式】前几题的句式开头高度雷同（均以"${ot[0].substring(0,12)}"开头）。本题必须使用与前几题完全不同的设问方式和句式结构！禁止再用相同句式开头！`),Re.length>=2){const mt=Math.round(Re.reduce((Me,Mt)=>Me+Mt,0)/Re.length);Re.every(Me=>Me===Re[0])&&(lt+=`
⚠️ 【选项结构雷同警告】前几题选择题全部是${Re[0]}个选项，本题必须打破此模式——改变选项数量或改用非选择题型！`)}}const ve=5e3,ge=Math.floor(ve*.45),ue=Math.floor(ve*.3),Ye=Math.floor(ve*.15);let Qe="";if(H.knowledgePoint){const Oe=js.findRelevant(H.knowledgePoint,8);if(Oe.length>0){const ot=rs(Oe,ge);if(Qe=ot.fullContext,Qe){const Re=(ot.coreText.match(/\n\[/g)||[]).length,mt=(ot.extendedText.match(/\n\[/g)||[]).length;console.log(`📚 题${H.number} 教材上下文：核心${Re}段 + 扩展${mt}段`)}else Qe=""}}if(!Qe&&H.sourceChapter){const Oe=m.find(ot=>ot.chapterTitle===H.sourceChapter);if(Oe&&(Oe._fullChapterText||Oe.rawText||Oe.summary)){const ot=Oe._fullChapterText||Oe.rawText||Oe.summary,Re=fs(ot,500).map(Me=>({chapterTitle:Oe.chapterTitle,text:Me,type:"正文",isKeyConcept:!1,isExample:!1,isExercise:!1}));Qe=rs(Re,ge).fullContext||`【教材参考】
${ot.substring(0,Math.floor(ge*1.5))}
`}}let ht="",st=0;const He=((x=(T=p==null?void 0:p[0])==null?void 0:T.analysis)==null?void 0:x.questionCards)||[];if(He.length>0){const ot=findBestTemplateSamples(He,H,2);if(ot.length>0){ht=`
【模板参考题——以下为模板典型题目，供参考风格和结构】
`;let Re=0;for(let mt=0;mt<ot.length;mt++){const Me=ot[mt];let Mt=`
=== 模板真题${mt+1}（${Me.type}，${Me.difficulty||"?"}难度，${Me.score||"?"}分）===
`,Pt=Me.stem||"";const Lt=Math.floor(ue/2*.8);if(Pt.length>Lt){const V=["。","？","！","?","!"];let te=-1;for(const f of V){const y=Pt.lastIndexOf(f,Lt);if(y>Lt*.6){te=y+1;break}}te>0?Pt=Pt.substring(0,te)+"...":Pt=Pt.substring(0,Lt)+"...（题干过长已截断）"}if(Mt+=`题干：${Pt}
`,(ee=Me.options)!=null&&ee.length){const V=Me.options.slice(0,4);Mt+=`选项：${V.map((te,f)=>`${String.fromCharCode(65+f)}. ${te}`).join(" | ")}
`}Me.questionFeature&&(Mt+=`设问特征：${Me.questionFeature.substring(0,30)}
`);const E=nt(Mt);if(st+E>ue){Re===0&&(ht+=Mt,Re++);break}ht+=Mt,st+=E,Re++}Re>0?ht+=`
【注意】以上真题仅作学段题型参考。本题请根据实际知识点和${u==="exam"?"考试要求":u==="practice"?"练习目标":"训练目标"}独立设计题干长度、句式结构和选项数量，无需机械模仿模板样本。`:ht=""}}fe="",I.length>0&&(fe=`【已生成题目——下面的题目已生成完毕，你本题必须与之有明显差异】
${I.slice(-3).join(`
`)}

⚠️ 排重要求——请确认本题与上面已生成题目的差异：
1. 不使用上面已出现过的场景（如上面用了"分蛋糕"，你换"跳绳比赛"或"图书馆"等全新场景）
2. 不使用上面已出现过的设问句式（如上面用了"XX有多少个"，你换"比较XX和YY的差异"或"如果ZZ发生变化，XX会怎样"）
3. 不使用上面已出现过的数据组合（换一组全新数字，不雷同）
`,nt(fe)>Ye&&(fe=`【已生成题目】${I.slice(-2).join("；")}
⚠️ 请确保本题情境、设问方式与上面不同。`,nt(fe)>Ye&&(fe=`【上一题】${I[I.length-1]}
⚠️ 请确保本题情境、设问方式与上一题不同。`)));const ut=Qe?(Qe.match(/核心教材原文/g)||[]).length:0,Xe=Qe?(Qe.match(/补充参考/g)||[]).length:0;console.log(`📊 题${H.number} 上下文使用:
          教材原文: 核心段 + 扩展段 (预算${ge} tokens)
          模板样本: ${ht?"已注入":"无"} (预算${ue} tokens)
          已生成摘要: ${nt(fe)} tokens (预算${Ye})`);let et="";H.knowledgePoint&&H.knowledgePoint.startsWith("综合：")&&(et=`
⚠️ 这是一道综合题，需要融合以下知识点：${H.knowledgePoint.replace("综合：","").split(/[、，,]/).map(ot=>ot.trim()).join("、")}
`,et+=`请创设一个真实情境，将上述知识点自然融合在一个问题中。
`,et+=`各知识点的考查权重应大致均衡。
`,(H.cognitiveLevel==="分析"||H.cognitiveLevel==="评价")&&(et+=`需要体现高阶思维（分析/评价），不止于简单应用。
`));const xe={选择题:"choice",填空题:"fill",判断题:"truefalse",计算题:"calc",解答题:"answer",应用题:"word_problem",实验题:"experiment"}[H.type],rt=xe?Y({category:"生成-题型专项要求",genType:xe}):[],Tt=rt.length>0?rt[0].content:"",Yt=["🎲 【场景引导：生活化】请创设贴近学生日常的场景（如购物、分食物、运动计分等），让题目有真实感和代入感。","🎲 【场景引导：校园课堂】请创设校园/课堂场景（如小组比赛、实验操作、课堂问答等），与学校生活关联。","🎲 【场景引导：故事游戏】请将题目包装成简短的小故事、闯关游戏或趣味挑战，增强可读性。","🎲 【场景引导：图表数据】请用表格、统计图、示意图等可视化方式呈现关键信息，考查数据解读能力。",'🎲 【场景引导：探究思辨】请用"为什么...""如果...会怎样""你能发现什么规律"等开放式设问，考查深层理解。',"🎲 【场景引导：对比辨析】请设计需要对比两个易混淆概念/方法的题目，考查辨析能力而非死记硬背。",'🎲 【反套路·去教辅化】请检查你的设问——是否和《53天天练》《黄冈小状元》《典中点》等常见教辅的题目"撞脸"？如果是，必须更换场景和句式，让你的题"不像任何一本教辅"。','🎲 【反套路·原创场景】请避免使用"买东西找零""分糖果""水池注水""小明小红""鸡兔同笼"等已被写烂的应用题场景。改用当下学生真正感兴趣的话题（校园科技节、研学旅行、班级义卖、社团活动、运动比赛等），去掉"小明""小红"这类万能角色名，换成有特点的原创名字。',"🎲 【反套路·去网络化】请检查你的题目——能否在学科网、教习网、菁优网、百度文库上被搜到几乎一样的题？如果换个数字就一模一样，必须推翻重写。你的题应该让搜索引擎找不到第二个。","🎲 【反套路·去AI痕迹】请避免使用DeepSeek/ChatGPT等模型的高频套话：如在当今这个时代、值得注意的是、综上所述、体现了核心价值、是一个值得深思的问题、通过分析不难发现等。用你自然的语言风格写题，不要带AI腔。"],rn=Yt[ye%Yt.length],pt=Ar(H,u,{situationAnchor:L,contextSummary:fe,styleConsistencyHint:lt,materialContext:Qe,templateContext:ht,typeRule:Tt,integratedContext:et,selectedTemplates:p,instruction:h,selectedBooks:i,stage:((J=i==null?void 0:i[0])==null?void 0:J.stage)||"",diversitySeed:rn});try{if(ye===0){console.log("🔥 题目生成：检查模型状态...");try{const Re=await $e(null,3,"text");if(Re.ready)console.log(`✅ 文本生成模型已就绪，立即开始（响应时间: ${Re.responseTime}ms, 尝试${Re.attempts}次）`);else{console.log(`⚠️ 模型未就绪，根据响应时间动态等待... (${Re.responseTime}ms)`);const mt=Math.max(2e3,Math.min(4e3,Re.responseTime/10));await new Promise(Me=>setTimeout(Me,mt))}}catch(Re){console.warn("⚠️ 模型检测失败，等待3秒后继续...",Re.message),await new Promise(mt=>setTimeout(mt,3e3))}}else console.log(`⏰ 第${ye+1}题之前等待2秒...`),await new Promise(Re=>setTimeout(Re,2e3));const Oe=await ne(pt,{taskType:"generation",timeout:12e4,allowContinuation:!0});Le.push(Oe);let ot="";try{const Re=i==null?void 0:i[0],mt=(Re==null?void 0:Re.subject)||"",Me=(Re==null?void 0:Re.stage)||"",Mt=Kt(mt,Me),Pt=Sr(Oe,Mt);if(Pt.length>0){const Lt=[],E=[];for(const te of Pt)if(te.passed===!1){const y=`${te.severity==="error"?"❌":"⚠️"} [${te.name}] ${te.message}`;te.severity==="error"?Lt.push(y):E.push(y),ot+=`<!-- ${y} -->
`,console.warn(`题${H.number}${y}`)}const V=xr(Oe,Pt);if(V!==Oe){const te=Le.indexOf(Oe);te>=0&&(Le[te]=V,console.log(`🔧 题${H.number} 自动修复完成`))}Lt.length>0&&(console.warn(`⚠️ 题${H.number} 存在 ${Lt.length} 个严重错误`),ot+=`<!-- ⚠️⚠️⚠️ 本题存在严重规则违反，请人工审查 ⚠️⚠️⚠️ -->
`,ot+=`<!-- 错误列表：
${Lt.join(`
`)}
-->
`),E.length>0&&console.log(`📝 题${H.number} 存在 ${E.length} 个警告`)}}catch(Re){console.warn("硬性规则验证失败:",Re.message)}try{const Re=`请审查这道题目，检查知识点匹配度和科学性：

【题目内容】
${Oe.replace(/<[^>]+>/g,"").substring(0,500)}

【命题要求】
知识点：${H.knowledgePoint}
难度：${H.difficulty}
题型：${H.type}

请逐一检查并只返回JSON：
{
  "knowledgeMatch": true,
  "knowledgeMatchReason": "题目确实考查了该知识点",
  "hasScienceError": false,
  "scienceErrorDetail": "",
  "answerCorrect": true,
  "suggestion": ""
}`,mt=await ne(Re,{taskType:"questionValidation",temperature:0,timeout:3e4});try{const Me=await ft(mt,null,"题目验证");if(Me.knowledgeMatch||(ot=`<!-- ⚠️ 知识点匹配问题：${Me.knowledgeMatchReason||"未知"} -->`),Me.hasScienceError&&(ot+=`<!-- ❌ 科学性错误：${Me.scienceErrorDetail||"未知"} -->`),Me.answerCorrect||(ot+="<!-- ⚠️ 答案可能有误 -->"),["计算题","解答题","应用题","选择题","填空题"].includes(H.type)&&Oe.length>20)try{const Pt=`请计算这道题的正确结果，只输出最终答案（不需要过程）：

${Oe.replace(/<[^>]+>/g,"").substring(0,800)}

只输出答案，不要解释。`,Lt=await ne(Pt,{taskType:"questionValidation",temperature:0,timeout:3e4,retries:0}),E=Oe.match(/答案[：:]\s*(.+?)(?:<|$|\n)/),V=E?E[1].trim():"";if(Lt&&V&&Lt.trim()!==V.trim()){const te=f=>f.replace(/\s+/g,"").replace(/[，,]/g,"");te(Lt)!==te(V)&&(ot+="<!-- ⚠️ 独立验算不一致 -->")}}catch{}if(ot){const Pt=Le.indexOf(Oe);Pt>=0&&(Le[Pt]=ot+`
`+Oe)}}catch{}}catch{}try{const Re=await ne(`用15字以内概括这道题：${Oe}`,{taskType:"generation",temperature:.1});I.push(`第${H.number}题(${H.type},${H.knowledgePoint}): ${Re.trim()}`)}catch{I.push(`第${H.number}题(${H.type},${H.knowledgePoint})`)}}catch(Oe){console.warn(`第${ye+1}题生成失败:`,Oe.message),Le.push(`<p class="question"><span class="question-number">${H.number}.</span> 【生成失败】</p>`),I.push(`第${H.number}题【生成失败】`)}}if(n.value="正在组装...",t.value=88,u==="practice"||u==="special"){const H=((C==null?void 0:C.selectedChapters)||[]).map(lt=>lt.title).filter(Boolean).join("、"),B=(C==null?void 0:C.name)||"",fe=tt(u,H||"_all_");je=`<h1>${B}${H?" · "+H:""}</h1>
<div class="practice-info"><p>${(C==null?void 0:C.grade)||""} ${(C==null?void 0:C.subject)||""} ${fe}</p></div>

`+Le.join(`

`)}else{const ye=`生成试卷头部HTML：学科${(C==null?void 0:C.subject)||""}，年级${(C==null?void 0:C.grade)||""}，总分${Ce}分。用<h1>标题。`;try{je=await ne(ye,{taskType:"generation",temperature:.3})+`

`+Le.join(`

`)}catch{je=Le.join(`

`)}}}else throw new Error(`内容生成失败：命题蓝图解析失败，无法逐题生成。
可能原因：AI 返回的蓝图格式异常，无法提取有效的题目信息。
建议：点击"重试"重新生成，或减少所选课时数量后重试。`);if(u!=="exam"&&Se.length>0&&Le.length>0){const M=[],L=/<!--\s*answer\s*:\s*(.+?)\s*(?:\|\s*解析\s*:\s*(.+?))?\s*-->/gi;let X;for(let _=0;_<Le.length;_++){const I=Le[_];for(L.lastIndex=0;(X=L.exec(I))!==null;){const ye=(X[1]||"").trim(),H=(X[2]||"").trim();M.push({number:((U=Se[_])==null?void 0:U.number)||_+1,answer:ye,explanation:H})}}if(M.length>0){let _=`
<div class="answer-section">
<h2>答案与解析</h2>
`;for(const I of M)_+=`<p><strong>${I.number}.</strong> ${I.answer}`,I.explanation&&(_+=` | <em>解析：${I.explanation}</em>`),_+=`</p>
`;_+="</div>",je+=_}else{console.warn("⚠️ [确认模式] 未提取到答案注释，尝试 AI 补生成...");try{const I=`请根据以下题目内容，生成统一的答案与解析区域。

${Le.map((H,B)=>`题${B+1}：${H.replace(/<[^>]+>/g,"").substring(0,200)}`).join(`

`)}

返回格式：
<div class="answer-section">
<h2>答案与解析</h2>
<p><strong>1.</strong> 答案 | <em>解析：解题思路</em></p>
...</div>

只返回HTML，不要markdown包裹。`,ye=await ne(I,{taskType:"generation",temperature:.1});je+=`
`+ye}catch(_){console.warn("答案区域生成失败:",_.message)}}}n.value="质量校验中...",t.value=90;const ie=[],C=i==null?void 0:i[0],z=(C==null?void 0:C.stage)||"",l={小学:"primary",初中:"middle",高中:"high"},we=Zt.check(je,Se,(C==null?void 0:C.subject)||"",l[z]||z,(C==null?void 0:C.grade)||"",u);if(we.forEach(M=>{ie.push(`${M.severity==="error"?"❌":"⚠️"} ${M.detail}`)}),we.some(M=>M.autoFix)&&(je=Zt.autoFix(je,we)),C&&je.length>100){const M=(C==null?void 0:C.subject)||"",L=(C==null?void 0:C.stage)||"",X=(C==null?void 0:C.grade)||"",_=Kt(M,L),I=ns(je,_,L,X);I.hasViolations&&I.violations.forEach(ye=>{const H=ye.severity==="error"?"❌":"⚠️";ie.push(`${H} 超纲检测：${ye.message}`)}),console.log("📋 超纲检测完成:",I.summary)}const he={formatCheck:{passed:!0,details:[]},coverageCheck:{passed:!0,details:[]},difficultyCheck:{passed:!0,details:[]},knowledgeCheck:{passed:!0,details:[]},templateMatch:{passed:!0,details:[]}},G=Zt.getIssueSummary(we);G.hasErrors&&(he.formatCheck.passed=!1,he.formatCheck.details.push(`硬性规则检查发现${G.errors}个错误`)),G.hasWarnings&&he.formatCheck.details.push(`硬性规则检查发现${G.warnings}个警告`),!je.includes('<p class="question"')&&!je.includes("<h")&&(ie.push("❌ 可能未返回HTML格式"),he.formatCheck.passed=!1);const ce=je.match(/<p class="question"/g),Fe=ce?ce.length:0;if(Fe===0&&(ie.push("❌ 未检测到题目"),he.formatCheck.passed=!1),C&&["数学","物理","化学"].includes(C.subject||"")){(je.match(/\$/g)||[]).length%2!==0&&(ie.push("⚠️ 行内公式符号$未闭合（奇数个$）"),he.formatCheck.details.push("检测到未闭合的$公式符号")),(je.match(/\$\$/g)||[]).length%2!==0&&(ie.push("⚠️ 独立公式符号$$未配对"),he.formatCheck.details.push("检测到未配对的$$公式符号"));const X=[{pattern:/\\frac\{\}/,message:"\\frac{} 缺少参数"},{pattern:/\\sqrt\{\}/,message:"\\sqrt{} 缺少参数"},{pattern:/\{\\frac/,message:"括号位置错误（应在\\frac之后）"},{pattern:/[^\\]_\{[^}]*$/,message:"下标{}可能未闭合"},{pattern:/[^\\]\^\{[^}]*$/,message:"上标{}可能未闭合"}];for(const _ of X)_.pattern.test(je)&&ie.push(`⚠️ LaTeX语法问题：${_.message}`)}if(he.difficultyCheck.details.push(`蓝图规划${Se.length}题，实际生成${Fe}题`),(p==null?void 0:p.length)>0&&((q=(N=(D=p[0])==null?void 0:D.analysis)==null?void 0:N.questionCards)==null?void 0:q.length)>0){const M=p[0].analysis.questionCards,L={},X={};M.forEach(ve=>L[ve.type]=(L[ve.type]||0)+1),Se.forEach(ve=>X[ve.type]=(X[ve.type]||0)+1);const _=[...new Set([...Object.keys(L),...Object.keys(X)])];let I=0;_.forEach(ve=>{const ge=L[ve]||0,ue=X[ve]||0;ge>0&&ue>0&&I++});const ye=_.length>0?Math.round(I/_.length*100):100;he.templateMatch.details.push(`题型匹配度: ${ye}%（${I}/${_.length}类题型）`);const H=M.filter(ve=>ve.stem).map(ve=>ve.stem.length),be=(je.match(/<p class="question"[^>]*>([^<]*)<\/p>/g)||[]).map(ve=>ve.replace(/<[^>]+>/g,"").length);if(H.length>0&&be.length>0){const ve=Math.round(H.reduce((Ye,Qe)=>Ye+Qe,0)/H.length),ge=Math.round(be.reduce((Ye,Qe)=>Ye+Qe,0)/be.length),ue=Math.abs(ge-ve);he.templateMatch.details.push(`模板题干平均${ve}字，生成题干平均${ge}字，偏差${ue}字`),ue>ve*.5&&ie.push(`⚠️ 题干长度与模板偏差较大（模板${ve}字 vs 生成${ge}字）`)}const fe=M.reduce((ve,ge)=>ve+(ge.score||0),0),lt=Se.reduce((ve,ge)=>ve+(ge.score||0),0);if(fe>0){const ve=Math.abs(lt-fe);he.templateMatch.details.push(`模板总分${fe}，生成总分${lt}，偏差${ve}分`),ve>10&&ie.push(`⚠️ 总分与模板偏差${ve}分`)}he.templateMatch.details.push(`模板${M.length}题，生成${Se.length}题`)}if(t.value=95,C&&C.subject){const M=(C==null?void 0:C.subject)||"",L=(C==null?void 0:C.stage)||"",X=Kt(M,L),_=rr(je,X);_.fixes.length>0&&(je=_.normalized,console.log(`📝 术语统一完成：${_.fixes.map(I=>`"${I.original}"→"${I.corrected}"(${I.count}处)`).join("；")}`),he.formatCheck.details.push(`术语统一：${_.fixes.length}种术语被标准化`))}t.value=100;let le=["生成完成"];if((de=(O=he.knowledgeCheck)==null?void 0:O.details)!=null&&de.length&&he.knowledgeCheck.details.find(L=>L.includes("超纲"))&&le.push("⚠️超纲检测"),ie&&ie.length>0){const M=ie.filter(X=>X.startsWith("❌")).length,L=ie.filter(X=>X.startsWith("⚠️")).length;M>0&&le.push(`❌${M}个错误`),L>0&&le.push(`⚠️${L}个警告`)}else le.push("✅无问题");return n.value=le.join(" | "),{success:!0,content:je,blueprint:P,parsedBlueprint:Se,contentCards:m,knowledgeMap:$,issues:ie,qualityReport:he,generatedQuestions:Le}}catch(Ce){return console.error("生成失败:",Ce),{success:!1,error:Ce.message}}finally{e.value=!1}},fn=async(h,u,i,p)=>{var ee,J,U;n.value="批量生成中...",t.value=70;let P="";const m=3e3;if(i&&i.length>0)for(const D of i){const N=D.selectedChapters||[];for(const q of N)if(q.rawText){const O=q.rawText,de=O.substring(0,Math.floor(m/2)),Ce=O.length>m?`
...（中略）...
`+O.substring(O.length-Math.floor(m/4)):"";if(P+=`【${q.title}】
${de}${Ce}

`,P.length>m*2){P+=`...（后续章节原文已省略）...
`;break}}}let $="";if(p&&p.length>0){const N=p[0].selectedChapters||[];for(const q of N)q.rawText&&($+=q.rawText+`
`)}const w=((ee=i==null?void 0:i[0])==null?void 0:ee.subject)||"",g=((J=i==null?void 0:i[0])==null?void 0:J.stage)||"";(U=i==null?void 0:i[0])!=null&&U.grade;const T=`请根据以下命题蓝图，生成完整的教辅资料。

【命题蓝图】
${h}

${P?`【教材参考原文】
`+P+`
`:""}
${$?`【模板参考原文】
`+$:""}

【核心指令——以下规则从三维度精准注入系统中提取，必须严格遵守】
${u}

【防幻觉约束——生成阶段补充规则】
1. ⛔ 每道题只能考查蓝图中标注的知识点，不得扩展
2. ⛔ 题干中涉及的数据、公式、概念必须与教材原文一致
3. ⛔ 答案必须唯一确定，不得模棱两可
4. ⛔ 禁止使用"下列说法正确的是""以下哪个选项是正确的"等无信息量设问
5. ⛔ 禁止选项中出现"以上都是""以上都不对"
6. ⛔ 禁止出现科学性错误（数据/公式/概念/单位必须准确无误）
7. ⛔ 禁止使用"略""见教材""自行查阅"等占位符代替具体内容
8. ⛔ 选择题所有选项长度相近、风格一致，正确选项随机分布在A/B/C/D中

【格式要求】
- 返回HTML，题干用<p class="question">，选项用<p class="option">
- 每道题必须独立用块级标签包裹，严禁多道题挤在同一段落
- 🔴 题号层级（强制性）：大题用"一、二、三、"（中文数字），小题用"1. 2. 3."（阿拉伯数字），子小题用"(1)(2)(3)"或"①②③"。不同层级必须用不同编号格式，禁止仅靠缩进来区分层级
- 🔴 字号铁律：所有正文（题干/选项/填空/解答区）使用统一字号（<p>标签默认大小），严禁因子题嵌套缩小字体

⛔ 【禁止模式——以下写法会导致排版崩溃，严禁使用！】
❌ 错误（编号重复+缩进+小字号，三个错误叠加）：
  <p class="question">1. 大题题干</p>
  <p style="margin-left:20px;font-size:14px;">1. 小题</p>  ← 编号重复无法区分层级！缩进导出Word丢失！
  <p style="margin-left:20px;font-size:14px;">2. 小题</p>  ← 小字号破坏统一排版！禁止因子题嵌套缩小字体
✅ 正确（编号格式区分层级，统一字号，无缩进）：
  <p class="question">1. 大题题干</p>
  <p class="question">(1) 小题</p>  ← 仅靠编号格式即可区分层级
  <p class="question">(2) 小题</p>

- 🔴 填空横线：<u class="blank-N">&emsp;</u>（N按答案字数：1字→2, 2字→4, 3-4字→6, 5-6字→8, 7-10字→10）
- 🔴 括号留空：选择题/判断题题末括号用 <span class="blank-N">&emsp;</span>（N必须按答案字数动态计算！1-2字→4, 3-4字→6, 5-6字→8, 7-10字→10，⛔严禁括号内用 <u> 标签）

【强制约束】
1. 每道题前标注题号，与蓝图的题号一一对应
2. 每道题后标注【知识点：XXX】【对应课文：XXX】
3. 题型、分值、难度严格按蓝图执行
4. 必须返回标准HTML代码，首行不要用\`\`\`html包裹
5. 答案和解析放在文末<div class="answer-section">中

${Kn("exam",w,g)}`,x=await ne(T,{taskType:"generation",timeout:18e4});return zn(x,"batch-mode"),x};return{isGenerating:e,progress:t,statusText:n,abortController:s,periodConfirm:a,callAI:ne,safeCallAI:async(h,u={})=>{var i,p,P,m,$,w;try{return await ne(h,u)}catch(g){if((i=g.message)!=null&&i.includes("取消")||(p=g.message)!=null&&p.includes("abort"))throw g;console.error("[safeCallAI] AI 调用失败:",g.message);const T=(P=g.message)!=null&&P.includes("服务不可用")?"AI 服务未启动，请检查 Ollama 或 DeepSeek 配置":(m=g.message)!=null&&m.includes("API Key")?"API Key 无效，请在设置中更新":($=g.message)!=null&&$.includes("超时")?"AI 响应超时，请稍后重试或降低内容量":(w=g.message)!=null&&w.includes("余额")?"API 余额不足，请充值":`AI 调用失败: ${g.message}`;throw new Error(T)}},callMultimodalAI:_e,safeCallMultimodal:async(h,u,i={})=>{var p,P,m,$;try{return await _e(h,u,i)}catch(w){if((p=w.message)!=null&&p.includes("取消")||(P=w.message)!=null&&P.includes("abort"))throw w;console.error("[safeCallMultimodal] 多模态调用失败:",w.message);const g=(m=w.message)!=null&&m.includes("重启Ollama")?"模型异常，请重启 Ollama 服务后重试":($=w.message)!=null&&$.includes("空内容")?"OCR 识别返回空结果，请检查图片质量或切换引擎":`多模态识别失败: ${w.message}`;throw new Error(g)}},extractTextRobustly:gt,extractChapterTextSequentially:ct,detectMultiColumnPages:Ze,postProcessOCR:os,analyzeTextbookImage:dt,analyzeTextbookWithText:qe,analyzeTemplateImageFull:_t,extractKnowledgePoints:De,buildGenerationInstruction:Rn,generate:bn,executeGenerationWithBlueprint:vn,generatePracticeByPeriods:async h=>{const u=c,i=v,p=S,P=R,m=F;if(!u||!i||!p)return console.error("[逐课时生成] 缺少缓存数据，请先运行 generate() 检测课时"),c=null,v=null,S=null,a.value=null,e.value=!1,{success:!1,error:"缓存数据缺失"};e.value=!0,t.value=30;const $=[],w=h.length;for(let J=0;J<w;J++){const U=h[J],D=`课时${J+1}/${w}`;n.value=`${D}：${U.periodName} — 命题规划...`,t.value=30+Math.round(J/w*35);const N={knowledgePoints:U.knowledgePoints,keyDifficulties:(u.keyDifficulties||[]).filter(Ce=>U.knowledgePoints.some(Je=>typeof Ce=="string"&&typeof Je=="string"&&(Ce.includes(Je)||Je.includes(Ce)))),knowledgeGraph:[{unit:U.unitName||"",bigConcepts:[{name:U.periodName,coreKnowledge:U.knowledgePoints.map(Ce=>({name:Ce}))}]}],crossChapterLinks:[]};let q=p;w>1&&(q+=`

【课时限定】当前仅生成「${U.periodName}」的课时练习。`,q+=`
本课时包含 ${U.kpCount} 个知识点：${U.knowledgePoints.join("、")}`,q+=`
严格仅考查以上知识点，不涉及本单元其他课时内容。`),d=N;let O;try{O=await bn(q,"practice",P,m,0,!0)}catch(Ce){console.error(`[逐课时] ${D} 蓝图生成失败:`,Ce.message),$.push({periodName:U.periodName,unitName:U.unitName,kpCount:U.kpCount,blueprint:"",parsedBlueprint:[],content:"",error:Ce.message});continue}n.value=`${D}：${U.periodName} — 生成内容...`,t.value=30+Math.round((J+.5)/w*35),d=N;let de;try{de=await bn(q,"practice",P,m,0,!1)}catch(Ce){console.error(`[逐课时] ${D} 内容生成失败:`,Ce.message),$.push({periodName:U.periodName,unitName:U.unitName,kpCount:U.kpCount,blueprint:(O==null?void 0:O.blueprint)||"",parsedBlueprint:(O==null?void 0:O.parsedBlueprint)||[],content:"",error:Ce.message});continue}$.push({periodName:U.periodName,unitName:U.unitName,kpCount:U.kpCount,blueprint:(O==null?void 0:O.blueprint)||"",parsedBlueprint:(O==null?void 0:O.parsedBlueprint)||[],content:(de==null?void 0:de.content)||"",generatedQuestions:(de==null?void 0:de.generatedQuestions)||[],issues:(de==null?void 0:de.issues)||[],qualityReport:(de==null?void 0:de.qualityReport)||null})}c=null,v=null,S=null,R=null,F=null,a.value=null,e.value=!1,t.value=100,n.value=`课时练生成完成（${w} 个课时）`;const g=[],T=[];for(let J=0;J<$.length;J++){const U=$[J];if(!U.content)continue;let D=U.content;const N=D.match(/<div\s+class="answer-section">[\s\S]*?<\/div>(?:\s*<\/div>)?\s*$/i);let q="";N&&(q=N[0],D=D.slice(0,N.index).trimEnd()),g.push({name:U.periodName,content:D}),T.push({name:U.periodName,answer:q})}let x="";for(let J=0;J<g.length;J++){const U=g[J],D=w>1?`<h2 style="margin-top:${J>0?"24px":"0"};border-bottom:1px solid #e0e0e0;padding-bottom:8px;">${U.name}</h2>
`:"";x+=D+U.content,J<g.length-1&&(x+=`
`)}if(T.some(J=>J.answer)){x+=`
<div class="answer-section">
<h2>答案与解析</h2>
`;for(const J of T){if(!J.answer)continue;w>1&&(x+=`<h3>${J.name}</h3>
`);const U=J.answer.replace(/<div\s+class="answer-section">\s*/i,"").replace(/\s*<\/div>\s*$/i,"");x+=U+`
`}x+=`</div>
`}return{success:!0,isMultiPeriod:!0,periodCount:w,periods:$,content:x,generatedQuestions:$.flatMap(J=>J.generatedQuestions||[])}},clearPeriodCache:()=>{c=null,v=null,S=null,R=null,F=null,a.value=null},preserveCacheForNextGenerate:()=>{b=!0},setPerChapterFilter:h=>{ke=h},getTypeDistribution:it,cancelGeneration:vs,extractGraphs:h=>((h==null?void 0:h.match(/\[GRAPH\][\s\S]*?\[\/GRAPH\]/g))||[]).map(i=>({full:i})),generateQuestionVariant:async(h,u,i={})=>{const{changeData:p=!0,changeContext:P=!0,changeOptions:m=!0,changeQuestionType:$=!1}=i,w=`请为以下题目生成一个变体题目。

【原题】
${h}

【原题规划】
- 题型：${u.type}
- 考查知识点：${u.knowledgePoint}
- 难度：${u.difficulty}
${u.score?`- 分值：${u.score}分
`:""}

【变体要求】
${$?"- 可以改变题型，但核心知识点不变":"- 保持相同题型"}
${p?"- 改变题目中的数据和数值":""}
${P?"- 改变题目情境或背景描述":""}
${m?"- 如果是选择题，改变选项内容、顺序和部分选项":""}
- 保持难度不变（${u.difficulty}）
- 保持相同的知识点覆盖
- 必须是一道全新题目，与原题重复度不超过30%
- 保持 HTML 格式
${u.score?`- 标注：【知识点：${u.knowledgePoint}】【难度：${u.difficulty}】
`:""}

只返回一道题的HTML代码。`;return await ne(w,{taskType:"generation",temperature:.8,timeout:6e4})},smartWait:We,checkModelLoaded:wt,checkModelReady:$e,smartWaitForModel:Ge}}const wi={class:"pdf-preview"},bi={class:"pdf-toolbar"},vi=["disabled"],Ti=["disabled"],Ci={class:"page-text"},Si=["max"],Ls=2,xi={__name:"PdfPreview",props:{pdfPath:{type:String,required:!0},page:{type:Number,default:1}},emits:["pageChange"],setup(e,{expose:t,emit:n}){oo.workerSrc=new URL(""+new URL("pdf.worker.min-yatZIOMy.mjs",import.meta.url).href,import.meta.url).toString();const s=n,r=e,o=Rt(null),a=Rt(null),c=Rt(1),v=Rt(1),S=Rt(0);let d=null,R="",F=null;const ke=fo(()=>c.value),b=Rt(!1),Q=Rt(100),j=Rt(null),Te=()=>{b.value=!1;let Pe=parseInt(Q.value)||100;if(Pe>=20&&Pe<=300)c.value=Pe/100;else{Q.value=Math.round(c.value*100);return}Ge()},tt=()=>{b.value=!1,Q.value=Math.round(c.value*100)},Ke=Rt(!1),We=Rt(1),nt=Rt(null),ne=()=>{Ke.value=!1;const Pe=parseInt(We.value)||1,Ve=Math.max(1,Math.min(S.value,Pe));Ve!==v.value&&d&&(v.value=Ve,Ge(),s("pageChange",Ve))},wt=()=>{Ke.value=!1,We.value=v.value},$e=async()=>{if(r.pdfPath){if(R===r.pdfPath&&d){console.log("✅ 复用已缓存的 PDF 文档"),r.page>0&&r.page<=S.value&&(v.value=r.page),await Ge();return}try{d&&(d.destroy(),d=null),console.log("📖 加载PDF:",r.pdfPath);const Pe=r.pdfPath.replace(/\\/g,"/"),Ve=Pe.startsWith("file://")?Pe:"file:///"+Pe;d=await ao({url:Ve,disableAutoFetch:!0,disableStream:!0,cMapUrl:"https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/",cMapPacked:!0}).promise,R=r.pdfPath,S.value=d.numPages,console.log("📖 PDF页数:",S.value),r.page>0&&r.page<=S.value&&(v.value=r.page),await Ge()}catch(Pe){console.error("加载 PDF 失败:",Pe.message)}}},Ge=async()=>{if(!(!d||!o.value)){F&&(F.cancel(),F=null,await new Promise(Pe=>setTimeout(Pe,50)));try{const Pe=await d.getPage(v.value),Ve=16e3;let dt=c.value*Ls,De=Pe.getViewport({scale:dt});if(De.width>Ve||De.height>Ve){const jt=Math.min(Ve/De.width,Ve/De.height);dt=dt*jt,De=Pe.getViewport({scale:dt})}const qe=o.value;qe.width=De.width,qe.height=De.height,qe.style.width=De.width/Ls+"px",qe.style.height=De.height/Ls+"px";const _t=qe.getContext("2d");_t.clearRect(0,0,qe.width,qe.height),_t.imageSmoothingEnabled=!0,_t.imageSmoothingQuality="high",F=Pe.render({canvasContext:_t,viewport:De}),await F.promise,parseFloat(qe.style.width)>1320?(qe.style.maxWidth="1320px",qe.style.height="auto"):qe.style.maxWidth=""}catch(Pe){Pe.name==="RenderingCancelledException"?console.log("渲染已取消"):console.error("渲染页面失败:",Pe)}}},_e=()=>{c.value=Math.min(3,c.value+.1),Ge()},gt=()=>{c.value=Math.max(.2,c.value-.1),Ge()},ct=()=>{c.value=1,Ge()};er(()=>r.pdfPath,(Pe,Ve)=>{Pe!==Ve&&$e()});let Ze=null;return er(()=>r.page,Pe=>{Pe>0&&d&&Pe<=S.value&&(v.value=Pe,Ze&&clearTimeout(Ze),Ze=setTimeout(()=>{Ge()},200))}),lo(()=>{uo($e)}),t({currentPage:v,totalPages:S,setTotalPages:Pe=>{S.value=Pe}}),po(()=>{Ze&&(clearTimeout(Ze),Ze=null),F&&(F.cancel(),F=null),d&&(d.destroy(),d=null)}),(Pe,Ve)=>(qn(),Hn("div",wi,[dn("div",bi,[dn("button",{class:"toolbar-btn",onClick:gt,disabled:c.value<=.5},"−",8,vi),b.value?tr((qn(),Hn("input",{key:1,ref_key:"scaleInputRef",ref:j,type:"number",min:"20",max:"300",class:"scale-input","onUpdate:modelValue":Ve[1]||(Ve[1]=dt=>Q.value=dt),onKeyup:[ts(Te,["enter"]),ts(tt,["escape"])],onBlur:Te},null,544)),[[nr,Q.value]]):(qn(),Hn("span",{key:0,class:"scale-text scale-editable",onClick:Ve[0]||(Ve[0]=dt=>b.value=!0),title:"点击输入缩放比例"},Es(Math.round(ke.value*100))+"%",1)),Ve[5]||(Ve[5]=dn("span",{style:{"font-size":"11px",color:"var(--text-muted)","margin-left":"4px","white-space":"nowrap"}},"20%~300%",-1)),dn("button",{class:"toolbar-btn",onClick:_e,disabled:c.value>=3},"+",8,Ti),dn("button",{class:"toolbar-btn",onClick:ct},"⟲"),dn("span",Ci,[Ve[4]||(Ve[4]=sr(" 第 ",-1)),Ke.value?tr((qn(),Hn("input",{key:1,ref_key:"pageInputRef",ref:nt,type:"number",min:1,max:S.value,class:"page-input","onUpdate:modelValue":Ve[3]||(Ve[3]=dt=>We.value=dt),onKeyup:[ts(ne,["enter"]),ts(wt,["escape"])],onBlur:ne},null,40,Si)),[[nr,We.value]]):(qn(),Hn("span",{key:0,class:"page-editable",onClick:Ve[2]||(Ve[2]=dt=>Ke.value=!0),title:"点击输入页码"},Es(v.value),1)),sr(" / "+Es(S.value)+" 页 ",1)])]),dn("div",{class:"pdf-canvas-container",ref_key:"containerRef",ref:a},[dn("canvas",{ref_key:"canvasRef",ref:o,class:"pdf-canvas"},null,512)],512)]))}},ac=co(xi,[["__scopeId","data-v-346dcd42"]]);export{ac as P,ji as a,Ii as b,Di as c,Fi as d,Gn as e,Ni as g,Li as s,oc as u};
