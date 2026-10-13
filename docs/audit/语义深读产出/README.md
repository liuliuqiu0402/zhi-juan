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
| 体育 | 5 | primary_low／primary_mid／primary_high／middle／high | 1（primary_mid） |
| 信息科技 | 5 | primary_low／primary_mid／primary_high／middle／high | 1（high） |
| **合计** | **54** | — | **2** |

## 三、我方收件流程（每批一次）

1. **列盘**：按 `*/*.md` 逐份取文件名 + 首行自证；
2. **核完整性**：文件数＝对应科学段数？首行自证＝9 份且文件名与片键匹配？**不符即报"未按约定落盘"，不进入判定**；
3. **逐片核证**：给出〔真错／证伪／不适用〕逐条结论，附逐字原文证据；
4. **登记**：更新本表"已收"列与片清单 §片级进度表；
5. **汇总**：54 片齐 ＋ 机检层全绿 ⇒ 才谈"486 面收口"。

## 四、纪律

- **一片一文件**；同名重跑直接覆盖（保留一份）；
- 不得以"片未读完"冒充"片达标"；不得跨片推断；
- 本目录**只放产出**，不放快照（快照在 `../snapshot-all/`）、不放送审件与差集件（在 `../`）。
