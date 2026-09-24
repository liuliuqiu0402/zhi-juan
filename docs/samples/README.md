# 导图族样张（docs/samples）

本目录是 **src/utils/diagrams（导图族）出图的实物样张**：6 个图种 + 思维导图的两种版式，共 7 张。

| 文件 | 图种 | 自然尺寸 |
|---|---|---|
| `01-思维导图-左右分布.svg` | mindmap（`layout: balanced`） | 453×187 |
| `02-思维导图-向右生长.svg` | mindmap（`layout: right`） | 291×269 |
| `03-括号图.svg` | brace | 369×269 |
| `04-流程图.svg` | flow | 380×356 |
| `05-时间轴.svg` | timeline | 525×217 |
| `06-鱼骨图.svg` | fishbone | 760×219 |
| `07-概念关系图.svg` | concept | 455×435 |

## 怎么再生成

```bash
node scripts/gen-diagram-samples.mjs
```

生成器直接 import `src/utils/diagrams` 的 `buildDiagramSvg`（纯函数，返回 SVG 字符串），
**不重写任何几何逻辑**——所以样张与生产出图永远同源，改了图种重跑一次即可 diff 出变化。

> 注：node 侧没有 canvas，`createCanvasMeasurer` 返回 null，文字宽度走 `estimateTextWidth` 的估算分支
> （与"无 canvas 的浏览器环境"一致），因此样张可稳定复现、适合进版本库做 diff。

## 为什么只提交 SVG

- SVG 是矢量、纯文本，7 张合计约 21 KB，压缩后约 4 KB——体积可忽略；
- PNG 版只有"肉眼快速看"的价值，体积大（同样 7 张约 450 KB，且已压缩、git 里压不动），
  需要时用浏览器打开 SVG 或临时导出即可，故**不入库**。

## 相关文档

- 图种口径、输入 spec、印刷约定、配套单测：`docs/design/导图族-图种规格.md`
- 出图实现：`src/utils/diagrams/`（`shared.js` 头部有共用能力与契约说明）
- Word 导出为什么要把 SVG 光栅化：`src/utils/docxBuilder.js` 的 `rasterizeSvgsForExport`
