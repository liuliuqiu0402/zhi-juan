# 语义深读·产出收件台（54 片）

> 本目录是**收件台**：复核方每完成一片，产出一份 md 存进对应**学科子文件夹**；我方（主控）只在此**读盘→核完整性→登记进度**，不需要属主贴内容或给路径。
> **不预建空文件**——空文件会造成"有文件＝已完成"的误读。目录已按学科建好，文件由产出方写入。

## 一、命名与落盘（硬约定）

1. **路径**：`docs/audit/语义深读产出/<学科>/<学科>-<学段>.md`
   例：`docs/audit/语义深读产出/体育/体育-primary_mid.md`
2. **学段取值（5 档，须逐字）**：`primary_low`／`primary_mid`／`primary_high`／`middle`／`high`
3. **首行必须**：`# 语义深读·<学科> × <学段>｜片自证：实际读到 9 份`，随后列全 **9 个文件名**（防"少读当读完"）
4. **内容顺序**：严格按送审件 `../S4-独立复核-送审件-486面-语义深读-分片.md` §四 模板
5. **两条自检**（错放/漏读会当场露）
   - 文件名首段的学科 **＝** 所在文件夹名（如 `体育-…` 必须在 `体育/` 内）；
   - 首行"片自证"列的 9 个文件名 **＝** 实际所读，且与片键 `<学科>-<学段>` 匹配。
6. **归属只看首行**：收件核对以**首行片自证**定片键，**文件名仅作辅助提示**——名称/位置不合约定会**提示**，但不影响归属，**也不会导致漏片**；首行解析不出的会显式列"**待归属**"，不静默忽略。

## 二、54 片核对表（学科级；片级明细见片清单）

各学科应含片数 **＝** 该学科**实际开设的学段数**（依据 `src/config/promptLibrary.js` 的 `STAGE_SUBJECTS`，5 学段合计 54 片）。

| 学科 | 应含 | 学段（该科开设） | 已收 |
|---|---|---|---|
| 语文 | 5 | primary_low／primary_mid／primary_high／middle／high | 0 |
| 数学 | 5 | primary_low／primary_mid／primary_high／middle／high | 0 |
| 英语 | 5 | primary_low／primary_mid／primary_high／middle／high | 0 |
| 物理 | 2 | middle／high | 0 |
| 化学 | 2 | middle／high | 0 |
| 生物 | 2 | middle／high | 0 |
| 历史 | 2 | middle／high | 0 |
| 地理 | 2 | middle／high | 0 |
| 道德与法治 | 4 | primary_low／primary_mid／primary_high／middle | 0 |
| 思想政治 | 1 | high | 0 |
| 科学 | 4 | primary_low／primary_mid／primary_high／middle | 0 |
| 音乐 | 5 | primary_low／primary_mid／primary_high／middle／high | 0 |
| 美术 | 5 | primary_low／primary_mid／primary_high／middle／high | 0 |
| 体育 | 5 | primary_low／primary_mid／primary_high／middle／high | 2（primary_mid／middle） |
| 信息科技 | 5 | primary_low／primary_mid／primary_high／middle／high | 5（全，已核 1：primary_high） |
| **合计** | **54** | — | **7** |

## 三、收件核对（**机检**，不靠人眼数文件名）

```powershell
node scripts/deepReadIntake.mjs            # 打印并写 _INTAKE-report.txt（下划线前缀＝机器产物）
node scripts/deepReadIntake.mjs --strict   # 除"缺片"外，任一异常（待归属/重复/非期望/份数≠9/名称位置不符）即非零退出
node scripts/deepReadIntake.mjs --sweep    # 归位：散落文件按片键移入 <学科>/<学科>-<学段>.md
node scripts/deepReadIntake.mjs --selftest # 合成样本自证（守卫有牙：别名学段/半角竖线/错名/缺自证都能判）
```

- **归属依据＝文件内容首行"片自证"，不是文件名** ⇒ 命名不统一也不会漏；解析不出的显式列"待归属"，**不静默忽略**。
- 期望集＝`src/config/promptLibrary.js` 的 `STAGE_SUBJECTS`（5 学段合计 54 片）；逐片**双向核对**，六类逐条列出：**缺片／非期望片键／重复片键／待归属／份数≠9／名称与位置不合约定**。
- 学段写法可容错（`middle`＝`初中`、`high`＝`高中`、`primary_low`＝`小学低段`）；**学科名须用 canonical 15 科**，否则列"待归属"。

**我方每批流程**：① 跑核对（`node scripts/deepReadIntake.mjs`）→ ② 先处置异常（待归属/重复/份数≠9 不进入判定）→ ③ 逐片核证〔真错／证伪／不适用〕＋逐字原文证据 → ④ 登记（本表"已收"＋片清单 §片级进度表）→ ⑤ 54 片齐 ＋ 机检层全绿 ⇒ 才谈"486 面收口"。

**核证结论落盘**：`docs/audit/语义深读核证/<学科>-<学段>.md`（`<学科>-<学段>` 与片键同名）；采用三分法：〔真错 必改〕／〔口径须统一 须给向〕／〔未核 不冒充已核〕。首件：`语义深读核证/信息科技-primary_high.md`（第 1 批校准片）。

## 四、纪律

- **一片一文件**（勿把多片合写进同一文件——片键对不上会被列异常）；同名重跑直接覆盖（保留一份）；
- 不得以"片未读完"冒充"片达标"；不得跨片推断；
- 下划线前缀文件（`_INTAKE-report.txt`）＝**机器产物**，非产出；
- 本目录**只放产出**，不放快照（快照在 `../snapshot-all/`）、不放送审件与差集件（在 `../`）。
