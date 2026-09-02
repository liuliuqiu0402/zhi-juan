<template>
  <div
    class="rich-text-editor"
    :style="{ minHeight: minHeight, ...layoutVars }"
  >
    <!-- 增强工具栏 - 参照 WPS Word 开始选项卡 -->
    <div
      v-if="editor"
      class="editor-toolbar-wrapper"
    >
      <div class="editor-toolbar">
        <!-- ═══════ 组0：剪贴板 ═══════ -->
        <button
          title="撤销 (Ctrl+Z)"
          :disabled="!editor.can().undo()"
          @click="editor.chain().focus().undo().run()"
        >
          ↶
        </button>
        <button
          title="重做 (Ctrl+Y)"
          :disabled="!editor.can().redo()"
          @click="editor.chain().focus().redo().run()"
        >
          ↷
        </button>
        <div class="toolbar-divider" />

        <!-- ═══════ 组1：字体 ═══════ -->
        <select
          class="toolbar-select"
          title="字体"
          style="width:90px"
          @change="setFontFamily($event.target.value)"
        >
          <option value="">
            字体
          </option>
          <option
            value="宋体"
            style="font-family:SimSun,宋体"
          >
            宋体
          </option>
          <option
            value="黑体"
            style="font-family:SimHei,黑体"
          >
            黑体
          </option>
          <option
            value="楷体"
            style="font-family:KaiTi,楷体"
          >
            楷体
          </option>
          <option
            value="仿宋"
            style="font-family:FangSong,仿宋"
          >
            仿宋
          </option>
          <option
            value="微软雅黑"
            style="font-family:Microsoft YaHei,微软雅黑"
          >
            微软雅黑
          </option>
          <option
            value="Times New Roman"
            style="font-family:Times New Roman"
          >
            Times New Roman
          </option>
          <option
            value="Arial"
            style="font-family:Arial"
          >
            Arial
          </option>
        </select>

        <select
          class="toolbar-select toolbar-select--sm"
          title="字号"
          style="width:58px"
          @change="setFontSize($event.target.value)"
        >
          <option value="">
            字号
          </option>
          <option value="42pt">
            初号
          </option>
          <option value="36pt">
            小初
          </option>
          <option value="26pt">
            一号
          </option>
          <option value="24pt">
            小一
          </option>
          <option value="22pt">
            二号
          </option>
          <option value="18pt">
            小二
          </option>
          <option value="16pt">
            三号
          </option>
          <option value="15pt">
            小三
          </option>
          <option value="14pt">
            四号
          </option>
          <option value="12pt">
            小四
          </option>
          <option value="10.5pt">
            五号
          </option>
          <option value="9pt">
            小五
          </option>
          <option value="7.5pt">
            六号
          </option>
          <option value="5.5pt">
            七号
          </option>
        </select>

        <button
          title="增大字号"
          @click="changeFontSize(1)"
        >
          A⁺
        </button>
        <button
          title="减小字号"
          @click="changeFontSize(-1)"
        >
          A⁻
        </button>

        <button
          title="清除格式"
          @click="editor.chain().focus().clearNodes().unsetAllMarks().run()"
        >
          <span style="text-decoration:line-through;">T</span><sub>x</sub>
        </button>
        <div class="toolbar-divider" />

        <!-- 加粗/斜体/下划线/删除线 -->
        <button
          :class="{ 'is-active': editor.isActive('bold') }"
          title="加粗 (Ctrl+B)"
          @click="editor.chain().focus().toggleBold().run()"
        >
          <strong>B</strong>
        </button>
        <button
          :class="{ 'is-active': editor.isActive('italic') }"
          title="斜体 (Ctrl+I)"
          @click="editor.chain().focus().toggleItalic().run()"
        >
          <em>I</em>
        </button>
        <button
          :class="{ 'is-active': editor.isActive('underline') }"
          title="下划线 (Ctrl+U)"
          @click="editor.chain().focus().toggleUnderline().run()"
        >
          <u>U</u>
        </button>
        <button
          :class="{ 'is-active': editor.isActive('strike') }"
          title="删除线"
          @click="editor.chain().focus().toggleStrike().run()"
        >
          <s>S</s>
        </button>
        <button
          :class="{ 'is-active': editor.isActive('emphasisDot') }"
          title="加点字/着重号"
          style="font-weight:bold;color:#d32f2f;"
          @click="editor.chain().focus().toggleEmphasisDot().run()"
        >
          ··
        </button>
        <div class="toolbar-divider" />

        <!-- 上标/下标 -->
        <button
          :class="{ 'is-active': editor.isActive('superscript') }"
          title="上标"
          @click="editor.chain().focus().toggleSuperscript().run()"
        >
          X²
        </button>
        <button
          :class="{ 'is-active': editor.isActive('subscript') }"
          title="下标"
          @click="editor.chain().focus().toggleSubscript().run()"
        >
          X₂
        </button>
        <div class="toolbar-divider" />

        <!-- 文字颜色 / 高亮 -->
        <div class="color-picker-wrapper">
          <button
            class="color-btn"
            title="文字颜色"
            :style="{ borderBottomColor: currentTextColor }"
          >
            <span
              class="color-letter"
              :style="{ color: currentTextColor }"
            >A</span>
          </button>
          <input
            type="color"
            class="color-input"
            :value="currentTextColor"
            title="选择文字颜色"
            @input="setTextColor($event.target.value)"
          >
        </div>
        <button
          :class="{ 'is-active': editor.isActive('highlight') }"
          title="高亮"
          @click="editor.chain().focus().toggleHighlight().run()"
        >
          🖍
        </button>

        <!-- 字符边框 -->
        <button
          :class="{ 'is-active': editor.isActive('textBorder') }"
          title="字符边框"
          @click="editor.chain().focus().toggleTextBorder().run()"
        >
          □
        </button>

        <!-- 字符底纹 -->
        <button
          :class="{ 'is-active': editor.isActive('textShading') }"
          title="字符底纹"
          @click="editor.chain().focus().toggleTextShading().run()"
        >
          ⬛
        </button>

        <!-- 格式刷 -->
        <button
          :class="{ 'is-active': formatPainterActive }"
          title="格式刷"
          @click="toggleFormatPainter"
        >
          🖌
        </button>
        <div class="toolbar-divider" />

        <!-- ═══════ 组2：段落 ═══════ -->
        <!-- 样式（含标题 + 正文缩进变体） -->
        <select
          class="toolbar-select"
          :value="currentStyle"
          title="样式 | 正文=默认缩进 | 正文无=无缩进 | 正文4=缩进4字符"
          @change="setParagraphStyle($event.target.value)"
        >
          <option value="paragraph">
            正文
          </option>
          <option value="paragraph-noindent">
            正文 · 无缩进
          </option>
          <option value="paragraph-indent4">
            正文 · 4字符
          </option>
          <optgroup label="── 标题 ──" />
          <option value="1">
            标题 1
          </option>
          <option value="2">
            标题 2
          </option>
          <option value="3">
            标题 3
          </option>
          <option value="4">
            标题 4
          </option>
        </select>
        <div class="toolbar-divider" />

        <!-- 列表 -->
        <button
          :class="{ 'is-active': editor.isActive('bulletList') }"
          title="项目符号（再点一次转文本）"
          @click="toggleBulletListKeepMarkers"
        >
          •≡
        </button>
        <select
          v-model="bulletMarker"
          class="toolbar-select toolbar-select--sm"
          title="项目符号形式"
          style="width:42px"
        >
          <option value="• ">
            •
          </option>
          <option value="○ ">
            ○
          </option>
          <option value="▪ ">
            ▪
          </option>
          <option value="✎ ">
            ✎
          </option>
          <option value="√ ">
            √
          </option>
        </select>
        <button
          :class="{ 'is-active': editor.isActive('orderedList') && !isAlphaOrderedList }"
          title="数字编号（再点一次转文本）"
          @click="toggleOrderedListKeepMarkers"
        >
          1.
        </button>
        <button
          :class="{ 'is-active': isAlphaOrderedList }"
          title="字母编号转文本（a. b. c.）"
          @click="convertAlphaListToText"
        >
          {{ alphaCase }}.
        </button>
        <select
          v-model="alphaCase"
          class="toolbar-select toolbar-select--sm"
          title="字母编号大小写"
          style="width:44px"
        >
          <option value="a">
            a.
          </option>
          <option value="A">
            A.
          </option>
        </select>
        <div class="toolbar-divider" />

        <!-- 缩进微调 -->
        <button
          title="减少缩进"
          @click="decreaseIndent"
        >
          ↞
        </button>
        <button
          title="增加缩进"
          @click="increaseIndent"
        >
          ↠
        </button>
        <div class="toolbar-divider" />

        <!-- 对齐 -->
        <button
          :class="{ 'is-active': editor.isActive({ textAlign: 'left' }) }"
          title="左对齐"
          @click="editor.chain().focus().setTextAlign('left').run()"
        >
          ⫷
        </button>
        <button
          :class="{ 'is-active': editor.isActive({ textAlign: 'center' }) }"
          title="居中"
          @click="editor.chain().focus().setTextAlign('center').run()"
        >
          ⬌
        </button>
        <button
          :class="{ 'is-active': editor.isActive({ textAlign: 'right' }) }"
          title="右对齐"
          @click="editor.chain().focus().setTextAlign('right').run()"
        >
          ⫸
        </button>
        <button
          :class="{ 'is-active': editor.isActive({ textAlign: 'justify' }) }"
          title="两端对齐"
          @click="editor.chain().focus().setTextAlign('justify').run()"
        >
          ⊞
        </button>
        <button
          :class="{ 'is-active': isDistributedActive }"
          title="分散对齐"
          @click="setDistributedAlign"
        >
          ⊡
        </button>
        <div class="toolbar-divider" />

        <!-- 行距 -->
        <select
          class="toolbar-select toolbar-select--sm"
          title="行距"
          style="width:56px"
          @change="setLineSpacing($event.target.value)"
        >
          <option value="">
            行距
          </option>
          <option value="1">
            1.0
          </option>
          <option value="1.15">
            1.15
          </option>
          <option value="1.5">
            1.5
          </option>
          <option value="2">
            2.0
          </option>
          <option value="2.5">
            2.5
          </option>
          <option value="3">
            3.0
          </option>
        </select>
        <div class="toolbar-divider" />

        <!-- ═══════ 组3：插入 ═══════ -->
        <button
          title="插入表格"
          @click="insertTable"
        >
          📊
        </button>
        <button
          title="插入图片"
          @click="triggerImageUpload"
        >
          🖼
        </button>
        <button
          title="分割线"
          @click="editor.chain().focus().setHorizontalRule().run()"
        >
          —
        </button>
        <button
          title="分页符"
          @click="editor.chain().focus().setPageBreak().run()"
        >
          ⏎
        </button>
        <input
          ref="imageInput"
          type="file"
          accept="image/*"
          style="display:none"
          @change="onImageUpload"
        >

        <!-- 缩放指示器 -->
        <span
          class="zoom-indicator"
          :title="`缩放 ${zoomLevel}% | Ctrl+滚轮调节 | 点击重置`"
          @click="resetZoom"
        >{{ zoomLevel }}%</span>
      </div>
    </div>

    <!-- 缩放容器：Ctrl+滚轮缩放编辑区 -->
    <div
      ref="zoomWrapRef"
      class="editor-zoom-wrap"
      :class="{ 'painter-active': formatPainterActive }"
    >
      <editor-content :editor="editor" />
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useEditor, EditorContent } from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';
import OrderedList from '@tiptap/extension-ordered-list';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';

// ⭐ 自定义 Underline：保留 class 属性，确保填空横线 <u class="blank-N"> 等通过 Tiptap 时不丢失 class
const CustomUnderline = Underline.extend({
  addAttributes() {
    return {
      class: {
        default: null,
        parseHTML: element => element.getAttribute('class') || null,
      },
    };
  },
});

// 🔧 自定义 OrderedList：保留 ol 的 type 属性（a/A/i/I）——
//    Tiptap 默认只保留 start，type 被丢弃导致 AI 生成内容中的字母/罗马编号
//    在编辑器里退化为数字编号、工具栏无法联动。保留后：
//    1) 编辑器按 list-style-type 正确显示 a. b. c. / A. B. C. 等
//    2) 导出链路（docxBuilder）读取 type 输出对应字母/罗马文本前缀
//    3) 工具栏字母按钮可通过 isActive('orderedList', { type }) 联动高亮
const CustomOrderedList = OrderedList.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      type: {
        default: null,
        parseHTML: element => element.getAttribute('type') || null,
        renderHTML: attributes => (attributes.type ? { type: attributes.type } : {}),
      },
    };
  },
});
import Highlight from '@tiptap/extension-highlight';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import TextAlign from '@tiptap/extension-text-align';

// 🔧 禁用 TextAlign 内置快捷键（Ctrl+Shift+R/L/E/J），避免与浏览器强制刷新等系统快捷键冲突
const CustomTextAlign = TextAlign.extend({
  addKeyboardShortcuts() {
    return {};
  },
});
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { FontFamily } from '@tiptap/extension-font-family';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import { Extension, Mark, Node } from '@tiptap/core';
import { normalizeRubyTags } from '../utils/rubyNormalizer.js';
import { normalizeWhitespaceCarriers } from '../utils/contentCleaner.js'; // 纯空白装饰标记→填空横线（emphasis-dot 包空位等退化形态，装载/粘贴统一）
import { getMergedSpec } from '../config/layoutSpec.js';

// ══════════════════════════════════════════
// 自定义扩展
// ══════════════════════════════════════════

// 字号扩展
const FontSize = Mark.create({
  name: 'fontSize',
  parseHTML() {
    return [{ tag: 'span[data-font-size]' }];
  },
  renderHTML({ mark }) {
    const val = mark.attrs.fontSize;
    return ['span', { 'data-font-size': val, style: `font-size: ${val}` }, 0];
  },
  addAttributes() {
    return { fontSize: { default: null, parseHTML: el => el.getAttribute('data-font-size') } };
  },
  addCommands() {
    return {
      setFontSize: (fontSize) => ({ commands }) => commands.setMark('fontSize', { fontSize }),
      toggleFontSize: (fontSize) => ({ commands }) => commands.toggleMark('fontSize', { fontSize }),
      unsetFontSize: () => ({ commands }) => commands.unsetMark('fontSize'),
    };
  },
});

// 字符边框扩展
const TextBorder = Mark.create({
  name: 'textBorder',
  parseHTML() { return [{ tag: 'span[data-text-border]' }]; },
  renderHTML() {
    return ['span', { 'data-text-border': '', style: 'border:1.5px solid #333;padding:0 3px;border-radius:2px;' }, 0];
  },
  addCommands() {
    return {
      toggleTextBorder: () => ({ commands }) => commands.toggleMark('textBorder'),
    };
  },
});

// 字符底纹扩展
const TextShading = Mark.create({
  name: 'textShading',
  parseHTML() { return [{ tag: 'span[data-text-shading]' }]; },
  renderHTML() {
    return ['span', { 'data-text-shading': '', style: 'background-color:#ddd;padding:0 2px;' }, 0];
  },
  addCommands() {
    return {
      toggleTextShading: () => ({ commands }) => commands.toggleMark('textShading'),
    };
  },
});

// ⭐ 加点字（着重号）扩展 — mammoth 生成的 <span class="emphasis-dot"> 经此 mark 存活
const EmphasisDot = Mark.create({
  name: 'emphasisDot',
  parseHTML() {
    return [
      { tag: 'span.emphasis-dot' },
      // mammoth 也可能生成 <span style="...着重号...">，兜底匹配
      { tag: 'span[style*="emphasis"]' },
    ];
  },
  renderHTML() {
    return ['span', { class: 'emphasis-dot' }, 0];
  },
  addCommands() {
    return {
      toggleEmphasisDot: () => ({ commands }) => commands.toggleMark('emphasisDot'),
    };
  },
});

// ⭐ 田字格：与无样式模式完全一致——inline-block+relative+absolute居中（经无样式模式验证的最稳定方案）
// 🔧 田字格/米字格仅语文低段存在 → 定档 GRID_CELL primary（12mm），与预览/HTML/docx 同尺寸（曾 1.8em 随字号漂移）
const gridCellMm = () => (getMergedSpec().GRID_CELL?.['tian-zi-ge']?.primary?.widthMm) || 12;
const TianZiGe = Node.create({
  name: 'tianZiGe',
  group: 'inline',
  inline: true,
  content: 'text*',
  parseHTML() { return [{ tag: 'span.tian-zi-ge' }]; },
  renderHTML() {
    return ['span', {
      class: 'tian-zi-ge',
      style: `display:inline-block!important;position:relative!important;width:${gridCellMm()}mm!important;height:${gridCellMm()}mm!important;border:1.5px solid #5B9BD5;font-size:inherit!important;vertical-align:middle;margin:0 1px;box-sizing:border-box!important;background:repeating-linear-gradient(to right,#5B9BD5 0px,#5B9BD5 3px,transparent 3px,transparent 6px) center/100% 0.5px no-repeat,repeating-linear-gradient(to bottom,#5B9BD5 0px,#5B9BD5 3px,transparent 3px,transparent 6px) center/0.5px 100% no-repeat'`,
    }, ['span', { style: 'position:absolute!important;top:50%!important;left:50%!important;transform:translate(-50%,-50%)!important;line-height:1!important;white-space:nowrap!important' }, 0]];
  },
});

// ⭐ 米字格：与无样式模式完全一致（同田字格）
const MiZiGe = Node.create({
  name: 'miZiGe',
  group: 'inline',
  inline: true,
  content: 'text*',
  parseHTML() { return [{ tag: 'span.mi-zi-ge' }]; },
  renderHTML() {
    return ['span', {
      class: 'mi-zi-ge',
      style: `display:inline-block!important;position:relative!important;width:${gridCellMm()}mm!important;height:${gridCellMm()}mm!important;border:1.5px solid #5B9BD5;font-size:inherit!important;font-family:KaiTi,SimSun,serif;vertical-align:middle;margin:0 1px;box-sizing:border-box!important;background:repeating-linear-gradient(to right,#5B9BD5 0px,#5B9BD5 3px,transparent 3px,transparent 6px) center/100% 0.5px no-repeat,repeating-linear-gradient(to bottom,#5B9BD5 0px,#5B9BD5 3px,transparent 3px,transparent 6px) center/0.5px 100% no-repeat,repeating-linear-gradient(to top right,#5B9BD5 0px,#5B9BD5 3px,transparent 3px,transparent 6px) center/0.5px 100% no-repeat,repeating-linear-gradient(to bottom right,#5B9BD5 0px,#5B9BD5 3px,transparent 3px,transparent 6px) center/0.5px 100% no-repeat'`,
    }, ['span', { style: 'position:absolute!important;top:50%!important;left:50%!important;transform:translate(-50%,-50%)!important;line-height:1!important;white-space:nowrap!important' }, 0]];
  },
});

// ⭐ 学科特殊格式标记：保护其他自定义 class（田字格/米字格已提升为 Node）
const PRESERVE_CLASSES = [
  'four-line-three', 'sixian-ge', 'pinyin-line', 'english-line', 'blank-line',
  'blank-1', 'blank-2', 'blank-3', 'blank-4', 'blank-5', 'blank-6', 'blank-7', 'blank-8', 'blank-9', 'blank-10',
  'blank-11', 'blank-12', 'blank-13', 'blank-14', 'blank-15', 'blank-16', 'blank-17', 'blank-18', 'blank-19', 'blank-20',
  'blank-21', 'blank-22', 'blank-23', 'blank-24',
  'stroke-order', 'underline-sentence', 'wavy-underline', 'double-line', 'single-line',
  'oral-box', 'square-box', 'score-box', 'chem-condition', 'wb-item',
  'superscript', 'subscript', 'dashed-line',
  'ruby-char',  // 注音/拼音（由 transformPastedHTML / trySetContent 入口预处理 ruby → span.ruby-char）
];

const PreserveSpan = Mark.create({
  name: 'preserveSpan',
  parseHTML() {
    return PRESERVE_CLASSES.map(cls => ({
      tag: `span.${cls}`,
      getAttrs: el => ({
        preservedClass: cls,
        strokes: el.getAttribute('data-strokes') || null,
        pinyin: el.getAttribute('data-pinyin') || null,  // ruby-char 注音数据
      }),
    }));
  },
  renderHTML({ mark }) {
    const attrs = { class: mark.attrs.preservedClass || '' };
    if (mark.attrs.strokes) attrs['data-strokes'] = mark.attrs.strokes;
    if (mark.attrs.pinyin) attrs['data-pinyin'] = mark.attrs.pinyin;
    return ['span', attrs, 0];
  },
  addAttributes() {
    return {
      preservedClass: { default: '' },
      strokes: { default: null },
      pinyin: { default: null },
    };
  },
});

// 分页符扩展
const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  parseHTML() { return [{ tag: 'div[data-page-break]' }]; },
  renderHTML() {
    return ['div', { 'data-page-break': '', style: 'page-break-after:always;height:0;overflow:hidden;' }];
  },
  addCommands() {
    return {
      setPageBreak: () => ({ commands }) => commands.insertContent({ type: 'pageBreak' }),
    };
  },
});

// 🔧 保留 AI 生成的 <div> 容器（底色、边框、圆角等样式）
//    Tiptap 默认丢弃 <div>，导致 AI 的版面配色全部丢失
const DivWrapper = Node.create({
  name: 'divWrapper',
  group: 'block',
  content: 'block+',
  defining: true,
  parseHTML() {
    return [{
      tag: 'div',
      getAttrs: el => {
        const style = el.getAttribute('style');
        const cls = el.getAttribute('class');
        if (!style && !cls) return false;
        return { divStyle: style || '', divClass: cls || '' };
      },
    }];
  },
  renderHTML({ HTMLAttributes }) {
    const attrs = {};
    if (HTMLAttributes.divStyle) attrs.style = HTMLAttributes.divStyle;
    if (HTMLAttributes.divClass) attrs.class = HTMLAttributes.divClass;
    return ['div', attrs, 0];
  },
  addAttributes() {
    return {
      divStyle: { default: '' },
      divClass: { default: '' },
    };
  },
});

// ═══════════════ 密封线结构保留（sealed-wrapper / seal-zone / seal-note / seal-info / seal-line / seal-char）═══════════════
// 标准结构严格对齐「试卷密封线模板.html」：
//   div.sealed-wrapper（A4 页面壳，padding 即页边距）> [ div.seal-zone（密封区，绝对定位） + div.sealed-content（正文）]
//   seal-zone 内：div.seal-note（提示语）/ div.seal-info（信息栏）/ div.seal-line（空 div，虚线）/ div.seal-char×3（密·封·线）
// ⚠️ seal-line 为空元素，ProseMirror 会丢弃空块 → 必须用 atom 节点保留；
//    seal-zone/seal-note/seal-info/seal-char 有 class，DivWrapper（priority 100）即可保留。
const SealedWrapper = Node.create({
  name: 'sealedWrapper',
  priority: 150,
  group: 'block',
  content: 'block+',
  defining: true,
  parseHTML() { return [{ tag: 'div.sealed-wrapper' }]; },
  renderHTML({ HTMLAttributes }) {
    const attrs = { class: 'sealed-wrapper' };
    if (HTMLAttributes.sealedStyle) attrs.style = HTMLAttributes.sealedStyle;
    return ['div', attrs, 0];
  },
  addAttributes() {
    return {
      sealedStyle: {
        default: null,
        parseHTML: (el) => el.getAttribute('style') || null,
        renderHTML: (a) => (a.sealedStyle ? { style: a.sealedStyle } : {}),
      },
    };
  },
});

// 密封区容器：绝对定位于左侧页边距带（正文内边距外侧），priority 150 > DivWrapper 100
const SealZone = Node.create({
  name: 'sealZone',
  priority: 150,
  group: 'block',
  content: 'block+',
  defining: true,
  parseHTML() { return [{ tag: 'div.seal-zone' }]; },
  renderHTML() { return ['div', { class: 'seal-zone' }, 0]; },
});

// seal-line：空 div（atom 不可编辑）——虚线由 CSS border-left 绘制，必须保留空元素
const SealLineDiv = Node.create({
  name: 'sealLineDiv',
  priority: 150,
  group: 'block',
  atom: true,
  selectable: false,
  parseHTML() { return [{ tag: 'div.seal-line' }]; },
  renderHTML() { return ['div', { class: 'seal-line' }]; },
});

// 作图网格区：空 div（atom 不可编辑）——方格纸由 CSS 绘制，必须保留空元素（编辑区所见即所得）
const SquareGrid = Node.create({
  name: 'squareGrid',
  priority: 150,
  group: 'block',
  atom: true,
  selectable: false,
  parseHTML() { return [{ tag: 'div.square-grid' }]; },
  renderHTML() { return ['div', { class: 'square-grid' }]; },
});

// 花式竖式格：空 div（atom 不可编辑）——括号格由 CSS 绘制，保留空元素（编辑区所见即所得）
const BracketGrid = Node.create({
  name: 'bracketGrid',
  priority: 150,
  group: 'block',
  atom: true,
  selectable: false,
  parseHTML() { return [{ tag: 'div.bracket-grid' }]; },
  renderHTML() { return ['div', { class: 'bracket-grid' }]; },
});

import Paragraph from '@tiptap/extension-paragraph';
import Heading from '@tiptap/extension-heading';

// 🔑 共享的 textIndent 属性定义（paragraph 和 heading 共用）
const textIndentAttr = {
  default: 0,
  parseHTML: el => {
    const style = el.style.textIndent;
    if (!style) return 0;
    // 处理 em 单位：2em → 32px (按 16px 字号)
    const emMatch = style.match(/^(-?[\d.]+)em$/);
    if (emMatch) return parseFloat(emMatch[1]) * 16;
    const px = parseFloat(style);
    return Number.isFinite(px) ? px : 0;
  },
  renderHTML(attrs) {
    const v = attrs.textIndent;
    // 🔑 主题 CSS 用了 forceImportant，inline style 必须加 !important 才能覆盖
    if (v === -1) return { style: 'text-indent: 0 !important;' };
    if (!v || v <= 0) return {};
    return { style: `text-indent: ${v}px !important;` };
  },
};

const CustomParagraph = Paragraph.extend({
  addAttributes() {
    return {
      lineHeight: {
        default: null,
        parseHTML: el => el.style.lineHeight || null,
        renderHTML(attrs) {
          if (!attrs.lineHeight) return {};
          return { style: `line-height: ${attrs.lineHeight}` };
        },
      },
      textIndent: textIndentAttr,
      // 🔧 保留 AI 生成的原始内联样式（颜色、底色、边框等）
      //    rendered: false → 不自动渲染，由 renderHTML 手动合并，避免多属性 style 合并冲突
      nodeStyle: {
        default: null,
        parseHTML: el => el.getAttribute('style') || null,
        rendered: false,
      },
      // 🔧 保留 AI 生成的 class（如 tip/note/warning 等语义类名）
      nodeClass: {
        default: null,
        parseHTML: el => el.getAttribute('class') || null,
        rendered: false,
      },
    };
  },
  renderHTML({ node, HTMLAttributes }) {
    // 🔧 手动合并 nodeStyle，确保与 textIndent/lineHeight/textAlign 的 style 不冲突
    //    textAlign 由 TextAlign 扩展统一管理，nodeStyle 中的旧值必须剔除，否则 CSS 后者覆盖前者
    //    导致用户通过工具栏设置的对齐方式被 AI 原始内联样式覆盖，表现为"有的段落有用有的没用"
    const rawStyle = node.attrs.nodeStyle;
    if (rawStyle) {
      const cleaned = rawStyle
        .replace(/text-indent\s*:\s*[^;]+;?\s*/gi, '')
        .replace(/line-height\s*:\s*[^;]+;?\s*/gi, '')
        .replace(/text-align\s*:\s*[^;]+;?\s*/gi, '')
        .trim();
      if (cleaned) {
        HTMLAttributes.style = HTMLAttributes.style
          ? HTMLAttributes.style + '; ' + cleaned
          : cleaned;
      }
    }
    // 🔧 手动合并 nodeClass
    if (node.attrs.nodeClass) {
      HTMLAttributes.class = node.attrs.nodeClass;
    }
    return ['p', HTMLAttributes, 0];
  },
});

const CustomHeading = Heading.extend({
  addAttributes() {
    return {
      // 🔧 Tiptap v3 extend 浅拷贝，必须显式补回父类 Heading 的 level 属性
      level: {
        default: 1,
        rendered: false
      },
      textIndent: textIndentAttr,
      lineHeight: {
        default: null,
        parseHTML: el => el.style.lineHeight || null,
        renderHTML(attrs) {
          if (!attrs.lineHeight) return {};
          return { style: `line-height: ${attrs.lineHeight}` };
        },
      },
      // 🔧 保留 AI 生成的原始内联样式（颜色、底色、边框等）
      //    rendered: false → 不自动渲染，由 renderHTML 手动合并，避免多属性 style 合并冲突
      nodeStyle: {
        default: null,
        parseHTML: el => el.getAttribute('style') || null,
        rendered: false,
      },
      // 🔧 保留 AI 生成的 class（如 tip/note/warning 等语义类名）
      nodeClass: {
        default: null,
        parseHTML: el => el.getAttribute('class') || null,
        rendered: false,
      },
    };
  },
  renderHTML({ node, HTMLAttributes }) {
    // 🔧 手动合并 nodeStyle，确保与 textIndent/lineHeight/textAlign 的 style 不冲突
    const rawStyle = node.attrs.nodeStyle;
    if (rawStyle) {
      const cleaned = rawStyle
        .replace(/text-indent\s*:\s*[^;]+;?\s*/gi, '')
        .replace(/line-height\s*:\s*[^;]+;?\s*/gi, '')
        .replace(/text-align\s*:\s*[^;]+;?\s*/gi, '')
        .trim();
      if (cleaned) {
        HTMLAttributes.style = HTMLAttributes.style
          ? HTMLAttributes.style + '; ' + cleaned
          : cleaned;
      }
    }
    // 🔧 手动合并 nodeClass
    if (node.attrs.nodeClass) {
      HTMLAttributes.class = node.attrs.nodeClass;
    }
    return [`h${node.attrs.level}`, HTMLAttributes, 0];
  },
});

// 🔧 保留表格单元格的内联样式（背景色、文字颜色、边框等）
const CustomTableCell = TableCell.extend({
  addAttributes() {
    const parentAttrs = this.parent?.() || {};
    return {
      ...parentAttrs,
      cellStyle: {
        default: null,
        parseHTML: el => el.getAttribute('style') || null,
        rendered: false,
      },
    };
  },
  renderHTML({ node, HTMLAttributes }) {
    const rawStyle = node.attrs.cellStyle;
    if (rawStyle) {
      HTMLAttributes.style = rawStyle;
    }
    return ['td', HTMLAttributes, 0];
  },
});

// 🔧 保留表格表头单元格的内联样式
const CustomTableHeader = TableHeader.extend({
  addAttributes() {
    const parentAttrs = this.parent?.() || {};
    return {
      ...parentAttrs,
      cellStyle: {
        default: null,
        parseHTML: el => el.getAttribute('style') || null,
        rendered: false,
      },
    };
  },
  renderHTML({ node, HTMLAttributes }) {
    const rawStyle = node.attrs.cellStyle;
    if (rawStyle) {
      HTMLAttributes.style = rawStyle;
    }
    return ['th', HTMLAttributes, 0];
  },
});

// 🔧 表格保留 class（如 exam-score-table 得分表），编辑器所见即所得完整还原
const CustomTable = Table.extend({
  addAttributes() {
    return {
      ...(this.parent?.() || {}),
      tableClass: {
        default: null,
        parseHTML: el => el.getAttribute('class') || null,
        renderHTML: attrs => (attrs.tableClass ? { class: attrs.tableClass } : {}),
      },
    };
  },
});

// ══════════════════════════════════════════
// 字号常量
// ══════════════════════════════════════════
const FONT_SIZE_OPTIONS = [
  { label: '初号', pt: 42 }, { label: '小初', pt: 36 },
  { label: '一号', pt: 26 }, { label: '小一', pt: 24 },
  { label: '二号', pt: 22 }, { label: '小二', pt: 18 },
  { label: '三号', pt: 16 }, { label: '小三', pt: 15 },
  { label: '四号', pt: 14 }, { label: '小四', pt: 12 },
  { label: '五号', pt: 10.5 }, { label: '小五', pt: 9 },
  { label: '六号', pt: 7.5 }, { label: '七号', pt: 5.5 },
];

const INDENT_STEP = 24;
const imageInput = ref(null);
const zoomWrapRef = ref(null);
const zoomLevel = ref(100);
const formatPainterActive = ref(false);
let painterMarks = null;
let painterNodeAttrs = null;  // 段落级属性（对齐、缩进、行距等）
let isInternalUpdate = false;  // 🔧 防反馈回路：onUpdate → watch → setContent 循环
let updateDebounceTimer = null;  // 🔧 性能优化：防抖 content-change 和 forceTianZiGeStyles（150ms）
let lastEmittedHTML = '';         // 🔧 缓存最后一次 emit 的 HTML，避免重复序列化

// ═══════════════ Ctrl+滚轮缩放 ═══════════════
const applyZoom = () => {
  if (!zoomWrapRef.value) return;
  const pm = zoomWrapRef.value.querySelector('.ProseMirror');
  if (pm) {
    const scale = zoomLevel.value / 100;
    pm.style.transform = `scale(${scale})`;
    // 同步调整宽度补偿缩放，确保内容正确换行
    pm.style.width = `${100 / scale}%`;
  }
};

const resetZoom = () => {
  zoomLevel.value = 100;
  applyZoom();
};

const onEditorWheel = (e) => {
  if (!e.ctrlKey) return;
  e.preventDefault();
  const delta = e.deltaY > 0 ? -5 : 5;
  zoomLevel.value = Math.max(30, Math.min(300, zoomLevel.value + delta));
  applyZoom();
};

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '在此粘贴图文混排内容...' },
  editable: { type: Boolean, default: true },
  minHeight: { type: String, default: '400px' },
  customCSS: { type: String, default: '' },
});

const emit = defineEmits(['update:modelValue', 'content-change']);

// 🔧 作图方格纸/括号格 CSS 变量（取自排版规格库 layoutSpec；静态兜底 CSS 用 var() 读取）
const layoutVars = computed(() => {
  try {
    const spec = getMergedSpec();
    const sg = spec.SQUARE_GRID.primary || { cols: 12, rows: 8, cellMm: 7 };
    const bg = spec.BRACKET_GRID;
    return {
      '--sg-w': `${Math.round(sg.cols * sg.cellMm)}mm`,
      '--sg-h': `${Math.round(sg.rows * sg.cellMm)}mm`,
      '--sg-bg': `${sg.cellMm}mm ${sg.cellMm}mm`,
      '--bg-rh': `${bg.rowHeightMm}mm`,
      '--bg-w': `${bg.widthMm}mm`,
    };
  } catch { return {}; }
});

// 🔧 字母编号大小写：'a' 小写 / 'A' 大写（转文本时按所选大小写生成序号；
//    光标进入 type="a"/"A" 列表时自动同步）。
//    定义在 useEditor 之前：onSelectionUpdate 回调会引用它，避免 TDZ 报错
const alphaCase = ref('a');

const editor = useEditor({
  content: props.modelValue,
  editable: props.editable,
  extensions: [
    StarterKit.configure({
      history: { depth: 100 },
      paragraph: false,
      heading: false,   // 用自定义标题替换
      underline: false, // 排除内置 underline，改用 CustomUnderline（需保留 class 属性）
      orderedList: false, // 排除内置 OrderedList，改用 CustomOrderedList（保留 ol type 属性）
    }),
    CustomOrderedList,
    CustomParagraph,
    CustomHeading,
    Image.configure({ inline: false, allowBase64: true }),
    Placeholder.configure({ placeholder: props.placeholder }),
    CustomUnderline,
    Highlight.configure({ multicolor: true }),
    TextStyle,
    Color,
    CustomTextAlign.configure({ types: ['heading', 'paragraph'] }), // 🔧 不设 defaultAlignment，让主题 CSS 控制对齐
    Subscript,
    Superscript,
    FontFamily,
    FontSize,
    TextBorder,
    TextShading,
    EmphasisDot,
    TianZiGe,
    MiZiGe,
    PreserveSpan,
    CustomTable.configure({ resizable: true }),
    TableRow,
    CustomTableCell,
    CustomTableHeader,
    PageBreak,
    // 🔧 密封线结构保留（priority 150 > DivWrapper 100）：sealed-wrapper 页面壳 + seal-zone 密封区 + seal-line 虚线原子
    SealedWrapper,
    SealZone,
    SealLineDiv,
    SquareGrid,
    BracketGrid,
    DivWrapper,
  ],
  onUpdate: ({ editor }) => {
    isInternalUpdate = true;  // 🔧 标记内部更新，防止 watch 回弹 setContent
    const html = editor.getHTML();
    emit('update:modelValue', html);  // v-model 实时同步（轻量 emit，父组件自行决定是否处理）
    
    // 🔧 性能优化：content-change + forceTianZiGeStyles 防抖 150ms
    //   避免每次按键都序列化 HTML→emit→父组件→localStorage 写入的完整链路
    clearTimeout(updateDebounceTimer);
    lastEmittedHTML = html;
    updateDebounceTimer = setTimeout(() => {
      emit('content-change', lastEmittedHTML);
      isInternalUpdate = false;
      nextTick(() => forceTianZiGeStyles());
    }, 150);
  },
  onSelectionUpdate: ({ editor }) => {
    // 🔧 字母编号列表联动：光标进入 type="a"/"A" 列表时，大小写下拉自动同步
    const olType = editor.getAttributes('orderedList').type;
    if (olType === 'a' || olType === 'A') alphaCase.value = olType;

    // 格式刷应用模式：选区变化时自动应用存储的格式（支持连刷，不自动关闭）
    if (formatPainterActive.value && editor.state.selection.from !== editor.state.selection.to) {
      const { from, to } = editor.state.selection;
      const tr = editor.state.tr;
      let applied = false;

      // 1. 应用段落级属性（对齐、缩进、行距、节点类型）到所有段落
      if (painterNodeAttrs) {
        editor.state.doc.nodesBetween(from, to, (node, pos) => {
          if (node.type.name === 'paragraph' || node.type.name === 'heading') {
            const srcType = painterNodeAttrs._nodeType;
            const targetType = (srcType && srcType !== node.type.name)
              ? editor.schema.nodes[srcType]   // 标题↔正文类型切换
              : null;                           // 同类型，只刷属性
            const newAttrs = { ...node.attrs };
            Object.keys(painterNodeAttrs).forEach(k => {
              if (k === '_nodeType') return;    // _nodeType 由上方单独处理
              newAttrs[k] = painterNodeAttrs[k];
            });
            // 🔧 类型切换时清理不兼容的属性：heading→paragraph 删 level，paragraph→heading 补默认 level
            if (targetType) {
              if (srcType === 'paragraph') delete newAttrs.level;
              else if (srcType === 'heading' && newAttrs.level == null) newAttrs.level = 1;
            }
            tr.setNodeMarkup(pos, targetType, newAttrs);
            applied = true;
          }
        });
      }

      // 2. 应用字符级格式标记
      if (painterMarks) {
        editor.state.doc.nodesBetween(from, to, (node, pos) => {
          if (node.isText) {
            const nodeFrom = Math.max(pos, from);
            const nodeTo = Math.min(pos + node.nodeSize, to);
            if (nodeFrom < nodeTo) {
              painterMarks.forEach(m => {
                if (editor.schema.marks[m.name]) {
                  tr.addMark(nodeFrom, nodeTo, editor.schema.marks[m.name].create(m.attrs));
                  applied = true;
                }
              });
            }
          }
        });
      }

      if (applied) {
        editor.view.dispatch(tr);
        // 🔧 连刷模式：不自动关闭，用户按 Escape 或用鼠标再次点击按钮才退出
      }
    }
  },
  editorProps: {
    attributes: {
      // 🔧 移除 Tailwind Typography 的 prose/prose-sm 类 — 它们硬编码了字号阻碍主题 CSS 生效
      class: 'focus:outline-none p-6'
    },
    // 🔧 粘贴 HTML 预处理：拦截所有 pasted/dropped HTML，在 ProseMirror 解析前转换 ruby 标签
    transformPastedHTML(html) {
      if (!html) return html;
      return normalizeShortHexColors(normalizeColorStyles(normalizeRubyTags(convertClassStylesToInline(normalizeWhitespaceCarriers(html)))));
    },
    handleKeyDown: (view, event) => {
      // Escape 退出格式刷连刷模式
      if (event.key === 'Escape' && formatPainterActive.value) {
        formatPainterActive.value = false;
        painterMarks = null;
        painterNodeAttrs = null;
        return true;
      }
      return false;
    },
    handlePaste: (view, event) => {
      const items = event.clipboardData?.items;
      if (!items) return false;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          const reader = new FileReader();
          reader.onload = (e) => {
            editor.value?.chain().focus().setImage({ src: e.target.result }).run();
          };
          reader.readAsDataURL(blob);
          return true;
        }
      }
      return false;
    }
  }
});

// ═══════════════ 计算属性 ═══════════════
const currentStyle = computed(() => {
  if (!editor.value) return 'paragraph';
  
  // 🔧 直接从选区父节点读取类型（绕过 isActive 的不可靠行为）
  const { $from } = editor.value.state.selection;
  const parentNode = $from.parent;
  
  if (parentNode && parentNode.type.name === 'heading') {
    const level = parentNode.attrs.level;
    if (level >= 1 && level <= 4) return String(level);
  }
  
  // 检测正文缩进状态（textIndent 现在同时注册在 paragraph 和 heading 上）
  const attrs = editor.value.getAttributes('paragraph') || editor.value.getAttributes('heading');
  if (attrs.textIndent === -1) return 'paragraph-noindent';
  if (attrs.textIndent === 64) return 'paragraph-indent4';
  return 'paragraph';
});

const currentTextColor = computed(() => {
  if (!editor.value) return '#000000';
  const attrs = editor.value.getAttributes('textStyle');
  return attrs.color || '#000000';
});

const isDistributedActive = computed(() => {
  if (!editor.value) return false;
  return editor.value.isActive({ textAlign: 'justify' });
});

// ═══════════════ 字体操作 ═══════════════
const setFontFamily = (val) => {
  if (!val) editor.value.chain().focus().unsetFontFamily().run();
  else editor.value.chain().focus().setFontFamily(val).run();
};

const setFontSize = (val) => {
  if (!val) editor.value.chain().focus().unsetFontSize().run();
  else editor.value.chain().focus().setFontSize(val).run();
};

const changeFontSize = (delta) => {
  const attrs = editor.value.getAttributes('fontSize');
  const current = attrs.fontSize ? parseFloat(attrs.fontSize) : 12;
  const newPt = Math.max(5, Math.min(72, current + delta * 2));
  editor.value.chain().focus().setFontSize(`${newPt}pt`).run();
};

const setTextColor = (color) => {
  if (!color || color === '#000000') editor.value.chain().focus().unsetColor().run();
  else editor.value.chain().focus().setColor(color).run();
};

// ═══════════════ 标题 + 正文样式 ═══════════════
const setParagraphStyle = (value) => {
  if (!editor.value) return;
  
  // 标题切换
  if (['1', '2', '3', '4'].includes(value)) {
    // 🔧 textIndent: 0 强制清除缩进——toggleHeading 内部 setNodeMarkup 用 {...old, ...new}
    //    合并属性，会把段落的 textIndent 带进标题，导致标题出现不该有的首行缩进
    editor.value.chain().focus().toggleHeading({ level: parseInt(value), textIndent: 0 }).run();
    return;
  }

  // 正文变体：先确保是 paragraph 类型，再精确设置 textIndent
  const { state, view } = editor.value;
  const { from, to } = state.selection;
  const tr = state.tr;
  let changed = false;

  let indent = 0;
  if (value === 'paragraph-noindent') indent = -1;
  else if (value === 'paragraph-indent4') indent = 64;

  state.doc.nodesBetween(from, to, (node, pos) => {
    // 🔧 只处理 block 级节点（heading/paragraph），跳过 text/inline 节点
    if (node.type.name !== 'heading' && node.type.name !== 'paragraph') return;
    const targetType = state.schema.nodes.paragraph;
    // heading → paragraph（保留 textAlign 等），或 paragraph → paragraph（只改 textIndent）
    const newAttrs = { ...node.attrs };
    delete newAttrs.level;
    newAttrs.textIndent = indent;
    tr.setNodeMarkup(pos, targetType, newAttrs);
    changed = true;
  });

  if (changed) view.dispatch(tr);
};

// ═══════════════ 缩进 ═══════════════
const increaseIndent = () => {
  const { state, view } = editor.value;
  const { from, to } = state.selection;
  const tr = state.tr;
  let changed = false;
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (node.type.name === 'paragraph' || node.type.name === 'heading') {
      const ci = node.attrs?.textIndent || 0;
      tr.setNodeMarkup(pos, null, { ...node.attrs, textIndent: Math.min(ci + INDENT_STEP, 120) });
      changed = true;
    }
  });
  if (changed) view.dispatch(tr);
};

const decreaseIndent = () => {
  const { state, view } = editor.value;
  const { from, to } = state.selection;
  const tr = state.tr;
  let changed = false;
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (node.type.name === 'paragraph' || node.type.name === 'heading') {
      const ci = node.attrs?.textIndent || 0;
      tr.setNodeMarkup(pos, null, { ...node.attrs, textIndent: Math.max(ci - INDENT_STEP, 0) });
      changed = true;
    }
  });
  if (changed) view.dispatch(tr);
};

// ═══════════════ 分散对齐 ═══════════════
const setDistributedAlign = () => {
  const { state, view } = editor.value;
  const { from, to } = state.selection;
  const tr = state.tr;
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (node.type.name === 'paragraph' || node.type.name === 'heading') {
      const attrs = { ...node.attrs, textIndent: node.attrs.textIndent };
      tr.setNodeMarkup(pos, null, attrs);
    }
  });
  view.dispatch(tr);
  editor.value.chain().focus().setTextAlign('justify').run();
};

// ═══════════════ 行距 ═══════════════
const setLineSpacing = (val) => {
  if (!val) return;
  const { state, view } = editor.value;
  const { from, to } = state.selection;
  const tr = state.tr;
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (node.type.name === 'paragraph' || node.type.name === 'heading') {
      tr.setNodeMarkup(pos, null, { ...node.attrs, lineHeight: val });
    }
  });
  view.dispatch(tr);
};

// ═══════════════ 表格 ═══════════════
const insertTable = () => {
  editor.value.chain().focus().insertTable({ rows: 3, cols: 4, withHeaderRow: true }).run();
};

// ═══════════════ 图片 ═══════════════
const triggerImageUpload = () => { imageInput.value?.click(); };

const onImageUpload = (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    editor.value?.chain().focus().setImage({ src: ev.target.result }).run();
  };
  reader.readAsDataURL(file);
  e.target.value = '';
};

// ═══════════════ 列表切换（切回文本时保留标记符号） ═══════════════
// 🔧 改用 DOM 层面直接转换：getHTML → 解析 DOM → <li>→<p>+标记 → setContent
//    避开 ProseMirror 事务系统对 insertText+liftListItem 组合的不可靠行为
// 🔧 项目符号形式可切换：•圆点 / ○空心圆 / ▪方块 / ✎铅笔 / √对勾（转文本时用所选符号）
const bulletMarker = ref('• ');

const toggleBulletListKeepMarkers = () => {
  if (!editor.value) return;

  // 开启列表：正常行为
  if (!editor.value.isActive('bulletList')) {
    editor.value.chain().focus().toggleBulletList().run();
    return;
  }

  convertListToMarkedParagraphs('ul', bulletMarker.value);
};

/** 当前光标是否位于字母编号列表（type="a"/"A"）——用于工具栏联动高亮 */
const isAlphaOrderedList = computed(() => {
  const e = editor.value;
  if (!e) return false;
  return e.isActive('orderedList', { type: 'a' }) || e.isActive('orderedList', { type: 'A' });
});

const toggleOrderedListKeepMarkers = () => {
  if (!editor.value) return;

  if (!editor.value.isActive('orderedList')) {
    editor.value.chain().focus().toggleOrderedList().run();
    return;
  }

  convertListToMarkedParagraphs('ol', null); // null = 自动序号
};

/** 字母编号转文本：把编辑器中的 <ol> 全部转成 a. b. c. 文本段落（无激活态，点击即转） */
const convertAlphaListToText = () => {
  if (!editor.value) return;
  convertListToMarkedParagraphs('ol', alphaCase.value);
};

/**
 * 生成列表标记前缀
 * @param {string|null} marker null=自动序号 / 'a'='A'=字母 / 其他=固定字符串
 * @param {number} idx 0 基序号
 */
const buildListPrefix = (marker, idx) => {
  if (marker === null) return `${idx + 1}. `;
  if (marker === 'a') return `${String.fromCharCode(97 + (idx % 26))}. `;
  if (marker === 'A') return `${String.fromCharCode(65 + (idx % 26))}. `;
  return marker;
};

/**
 * 将编辑器中的 <ul>/<ol> 列表整体转换为带标记的 <p> 段落
 * @param {'ul'|'ol'} listTag
 * @param {string|null} marker 无序列表固定标记（如 '• '），有序列表 null 自动编号，'a'/'A' 字母编号
 */
const convertListToMarkedParagraphs = (listTag, marker) => {
  const fullHtml = editor.value.getHTML();
  const parser = new DOMParser();
  const doc = parser.parseFromString(fullHtml, 'text/html');

  // 自底向上处理嵌套列表：深层的先处理，以免外层 unwrap 时内层结构混乱
  const lists = Array.from(doc.querySelectorAll(listTag));
  lists.sort((a, b) => {
    const depthA = countAncestors(a, listTag);
    const depthB = countAncestors(b, listTag);
    return depthB - depthA; // 深的先
  });

  for (const list of lists) {
    const lis = Array.from(list.querySelectorAll(':scope > li'));
    lis.forEach((li, idx) => {
      const prefix = buildListPrefix(marker, idx);
      prependMarkerToLI(li, prefix);
      // 将 <li> 的子节点搬到父级，然后移除 <li>
      const children = Array.from(li.childNodes);
      li.replaceWith(...children);
    });
    // 将 <ul>/<ol> 的子节点搬到父级，然后移除列表容器
    const children = Array.from(list.childNodes);
    list.replaceWith(...children);
  }

  editor.value.commands.setContent(doc.body.innerHTML);
};

/** 统计 node 在祖先中有多少层同名标签（用于自底向上排序） */
const countAncestors = (node, tagName) => {
  let count = 0;
  let parent = node.parentElement;
  while (parent) {
    if (parent.tagName === tagName.toUpperCase()) count++;
    parent = parent.parentElement;
  }
  return count;
};

/** 在 <li> 的第一个段落/文本节点前插入标记 */
const prependMarkerToLI = (li, prefix) => {
  // 优先找第一个 <p> 子元素
  const firstP = Array.from(li.children).find(
    (child) => child.tagName === 'P',
  );
  if (firstP) {
    // 在 <p> 的文字最前面插入
    const textNode = firstP.firstChild;
    if (textNode && textNode.nodeType === Node.TEXT_NODE) {
      textNode.textContent = prefix + textNode.textContent;
    } else {
      firstP.insertBefore(document.createTextNode(prefix), firstP.firstChild);
    }
  } else {
    // 无 <p> 时直接在 <li> 开头插入文本
    const textNode = li.firstChild;
    if (textNode && textNode.nodeType === Node.TEXT_NODE) {
      textNode.textContent = prefix + textNode.textContent;
    } else {
      li.insertBefore(document.createTextNode(prefix), li.firstChild);
    }
  }
};

// ═══════════════ 格式刷 ═══════════════
const toggleFormatPainter = () => {
  if (formatPainterActive.value) {
    formatPainterActive.value = false;
    painterMarks = null;
    painterNodeAttrs = null;
    return;
  }
  const { from, to } = editor.value.state.selection;
  if (from === to) {
    return; // 没选中任何文字
  }
  const marks = [];
  let nodeAttrs = null;
  editor.value.state.doc.nodesBetween(from, to, (node) => {
    // 收集字符级格式标记
    if (node.marks?.length) {
      node.marks.forEach(m => {
        if (!marks.find(x => x.name === m.type.name)) {
          marks.push({ name: m.type.name, attrs: { ...m.attrs } });
        }
      });
    }
    // 收集段落级属性（对齐、缩进、行距等），取第一个非空段落
    if (!nodeAttrs && (node.type.name === 'paragraph' || node.type.name === 'heading')) {
      const attrs = { ...node.attrs };
      // 保留有实际值的属性，但排除等于默认值的属性
      const isHeading = node.type.name === 'heading';
      const keys = Object.keys(attrs).filter(k => {
        const v = attrs[k];
        if (v == null || v === '') return false;
        // 🔧 标题的 textIndent:0 有意义（标题不应缩进），仅段落跳过默认值
        if (k === 'textIndent' && v === 0 && !isHeading) return false;
        return true;
      });
      if (keys.length > 0) {
        nodeAttrs = {};
        keys.forEach(k => { nodeAttrs[k] = attrs[k]; });
      }
      // 也保留节点类型（段落 vs 标题）
      nodeAttrs = { ...(nodeAttrs || {}), _nodeType: node.type.name };
    }
  });
  if (marks.length || nodeAttrs) {
    painterMarks = marks.length ? marks : null;
    painterNodeAttrs = nodeAttrs;
    formatPainterActive.value = true;
  }
};

// ═══════════════ 注音/拼音预处理：<ruby> 标签转 span.ruby-char ═══════════════
// 策略：所有 HTML 进入 Tiptap/ProseMirror 前，将 <ruby>字<rt>pinyin</rt></ruby>
//       统一转为 <span class="ruby-char" data-pinyin="pinyin">字</span>
//       由 PreserveSpan 保留 class + data-pinyin，CSS ::before 绘制上方拼音
// ═══════════════ class 样式 → 内联 style：将 <style> 块中的 CSS 规则展开到匹配元素上 ═══════════════
// 背景：AI 生成的内容包含 <style>.tip{color:red}</style> + <p class="tip">，但编辑器不解析 <style> 块
//       导致 class 颜色丢失。nodeClass 修复保留了 class 属性，但 CSS 规则仍需转为内联才能生效
// 方案：DOM 预处理 → 解析 <style> 块 → 对每个规则 querySelectorAll → 合并到元素内联 style
const convertClassStylesToInline = (html) => {
  if (!html) return html;
  if (!/<style[^>]*>/i.test(html)) return html;

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const styleElements = doc.querySelectorAll('style');
  if (styleElements.length === 0) return html;

  let allCSS = '';
  styleElements.forEach(el => {
    allCSS += el.textContent + '\n';
    el.remove();
  });
  if (!allCSS.trim()) return html;

  // 解析 CSS 规则：selector { properties }
  const ruleRegex = /([^{]+)\{([^}]+)\}/g;
  let match;
  let modified = false;

  while ((match = ruleRegex.exec(allCSS)) !== null) {
    const rawSelector = match[1].trim();
    const rawProperties = match[2].trim();
    if (!rawSelector || !rawProperties) continue;

    // 跳过 @-规则和伪类/伪元素（无法转为内联）
    if (rawSelector.startsWith('@') || /::?[a-z-]+/i.test(rawSelector)) continue;
    // 跳过 html/body/* 等全局选择器
    if (/^(html|body|\*)$/i.test(rawSelector)) continue;

    try {
      const elements = doc.querySelectorAll(rawSelector);
      if (elements.length === 0) continue;

      const newDecls = rawProperties.split(';').map(d => d.trim()).filter(Boolean);

      elements.forEach(el => {
        modified = true;
        const existing = el.getAttribute('style') || '';
        const existingDecls = existing.split(';').map(d => d.trim()).filter(Boolean);

        // 合并：新声明覆盖同名旧声明
        const merged = new Map();
        existingDecls.forEach(d => {
          const colonIdx = d.indexOf(':');
          if (colonIdx > 0) merged.set(d.substring(0, colonIdx).trim().toLowerCase(), d.trim());
        });
        newDecls.forEach(d => {
          const colonIdx = d.indexOf(':');
          if (colonIdx > 0) merged.set(d.substring(0, colonIdx).trim().toLowerCase(), d.trim());
        });

        el.setAttribute('style', [...merged.values()].join('; '));
      });
    } catch (e) {
      // 跳过无效选择器（querySelectorAll 可能抛出异常）
    }
  }

  return modified ? doc.body.innerHTML : html;
};

// ═══════════════ 短十六进制颜色归一化：#abc → #aabbcc ═══════════════
// 背景：CSS 允许 3 位简写（如 #555），但浏览器 DOM 属性的 color 要求完整 6 位格式
//       不处理会导致 Vue patchDOMProp 警告：The specified value "#555" does not conform...
const normalizeShortHexColors = (html) => {
  if (!html) return html;
  // 匹配 style 属性值中出现的 3 位 hex 颜色（不匹配已经是 6 位的）
  // 模式：#[0-9a-fA-F]{3}(?![0-9a-fA-F])  — 3 位 hex 后面不紧跟另一个 hex 数字
  return html.replace(/#([0-9a-fA-F]{3})(?![0-9a-fA-F])/g, (_, short) => {
    return '#' + short[0] + short[0] + short[1] + short[1] + short[2] + short[2];
  });
};

// ═══════════════ 颜色样式归一化：将 strong/em/u/s 上的 color 移植到内部 span ═══════════════
// 背景：TipTap TextStyle mark 只匹配 <span> 元素，不匹配 <strong>/<em>/<u>/<s>
//       Color 扩展作为 textStyle 的 global attribute 无法从非 span 元素提取颜色
//       导致 <strong style="color:red">text</strong> 的颜色在进入编辑器后丢失
// 方案：DOM 预处理 → 提取 color 从非 span 元素上，注入内层 <span style="color:...">
const normalizeColorStyles = (html) => {
  if (!html) return html;
  // 需要处理的语义标签（TipTap 有对应 Mark 但不支持 style 属性上的 color）
  const COLOR_SEMANTIC_TAGS = ['strong', 'b', 'em', 'i', 'u', 'ins', 's', 'del', 'strike'];
  const selector = COLOR_SEMANTIC_TAGS.map(t => `${t}[style]`).join(',');
  if (!new RegExp(`<(${COLOR_SEMANTIC_TAGS.join('|')})\\b[^>]*\\bcolor\\s*:`, 'i').test(html)) return html;

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const elements = Array.from(doc.querySelectorAll(selector));
  let modified = false;

  for (const el of elements) {
    // 读取计算样式中的 color（支持 rgb/rgba/hex 等格式）
    const colorVal = el.style.color;
    if (!colorVal) continue;

    modified = true;
    // 从原元素上移除 color 属性
    el.style.color = '';
    // 如果 style 已清空，移除 style 属性
    if (!el.getAttribute('style')?.trim()) el.removeAttribute('style');

    // 创建内层 span 承载颜色
    const span = doc.createElement('span');
    span.style.color = colorVal;
    // 将原元素的所有子节点移入 span
    while (el.firstChild) span.appendChild(el.firstChild);
    // 将 span 放回原元素
    el.appendChild(span);
  }

  return modified ? doc.body.innerHTML : html;
};

// ═══════════════ 序号去重：<ol> 自动编号 vs 文本编号 叠杀 ═══════════════
// 场景：AI 生成 <ol><li>14. 某某标题</li></ol> 时，浏览器 + 文本双重编号 → "14. 14. xxx"
// 策略：检测 <ol> 中多数 <li> 是否已自带文本序号，若是则剥离 <ol> 转为 <p> 段落
const normalizeDoubleNumberedLists = (html) => {
  if (!html) return html;
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  let modified = false;

  // 自底向上处理（深层的先处理，避免外层 unwrap 后内层丢失）
  const ols = Array.from(doc.querySelectorAll('ol'));
  ols.sort((a, b) => {
    const depthA = [...a.querySelectorAll('ol')].length;
    const depthB = [...b.querySelectorAll('ol')].length;
    return depthA - depthB;
  });

  for (const ol of ols) {
    const lis = Array.from(ol.querySelectorAll(':scope > li'));
    if (lis.length === 0) continue;

    // 检查多少 <li> 的文本以数字序号开头
    const numberedCount = lis.filter(li => /^\d+[.)、]\s/.test((li.textContent || '').trimStart())).length;
    // 超过半数则判定为"文本已自带编号"，整组剥离 <ol>
    if (numberedCount >= lis.length / 2) {
      modified = true;
      lis.forEach(li => {
        const p = doc.createElement('p');
        // 搬运所有子节点（保留 class / style 等）
        while (li.firstChild) p.appendChild(li.firstChild);
        ol.parentNode.insertBefore(p, ol);
      });
      ol.parentNode.removeChild(ol);
    }
  }

  return modified ? doc.body.innerHTML : html;
};

// ═══════════════ Watchers ═══════════════
// 🔧 修复时序竞态：modelValue 变化 + editor 就绪 → 都要尝试 setContent
//    初始值设为 modelValue，让 editor 就绪时也能触发 ruby 预处理（首次渲染时会绕过 watch）
let pendingContent = props.modelValue || null;

const trySetContent = () => {
  if (!editor.value || pendingContent === null) return;
  // 🔧 载入前预处理：class 样式 → 内联 → ruby 标签 → span.ruby-char
  let processed;
  try {
    processed = normalizeShortHexColors(normalizeColorStyles(normalizeRubyTags(convertClassStylesToInline(normalizeWhitespaceCarriers(pendingContent)))));
    // 🔧 载入前预处理：<ol> 双编号去重
    processed = normalizeDoubleNumberedLists(processed);
  } catch (e) {
    // 🔧 防御：预处理异常时回退原始内容，确保内容始终可加载（不因单点异常导致空白）
    console.warn('编辑器内容预处理失败，使用原始内容:', e);
    processed = pendingContent;
  }
  if (processed !== editor.value.getHTML()) {
    editor.value.commands.setContent(processed, false);
  }
  pendingContent = null;
};

watch(() => props.modelValue, (newVal) => {
  pendingContent = newVal;  // 🔧 始终更新，防止外部变更在内部编辑期间丢失
  if (isInternalUpdate) return;  // 🔧 内部编辑操作触发的回弹，跳过 setContent
  trySetContent();
}, { immediate: true });

// 🔧 editor 就绪后补调（解决 editor 未就绪时 modelValue 已到达的时序问题）
watch(editor, (val) => {
  if (val) trySetContent();
});

watch(() => props.editable, (newVal) => {
  editor.value?.setEditable(newVal);
});

let injectedStyleEl = null;

// 🔧 将 theme CSS 注入编辑器 DOM（提取为独立函数，editor 就绪和主题切换时复用）
const injectThemeCSS = (css) => {
  if (!editor.value) return;
  const editorDom = editor.value.view.dom;
  if (!editorDom) return;
  if (injectedStyleEl) { injectedStyleEl.remove(); injectedStyleEl = null; }
  if (css) {
    injectedStyleEl = document.createElement('style');
    injectedStyleEl.setAttribute('data-theme-css', 'true');
    injectedStyleEl.textContent = css;
    editorDom.parentElement?.insertBefore(injectedStyleEl, editorDom);
  }
};

// 🔑 用 JavaScript CSSOM API 强制加固田字格/米字格样式（setProperty 第三个参数 'important' 保证 !important）
//    这比 renderHTML 的 style 字符串更可靠——直接操作 CSSOM，不受任何 CSS 规则干扰
const forceTianZiGeStyles = () => {
  if (!editor.value) return;
  const root = editor.value.view.dom;
  const grids = root.querySelectorAll('.tian-zi-ge, .mi-zi-ge');
  if (grids.length === 0) return;

  grids.forEach((outer) => {
    const s = outer.style;
    s.setProperty('display', 'inline-block', 'important');
    s.setProperty('position', 'relative', 'important');
    s.setProperty('box-sizing', 'border-box', 'important');
    const innerSpan = outer.querySelector(':scope > span');
    if (innerSpan) {
      // 🔑 从内层文字读取实际计算字号，确保字号变化时格子等比缩放
      const actualFontSize = getComputedStyle(innerSpan).fontSize;
      s.setProperty('font-size', actualFontSize, 'important');
      s.setProperty('width', `${gridCellMm()}mm`, 'important'); // 田字格/米字格仅低段 → 定档 12mm
      s.setProperty('height', `${gridCellMm()}mm`, 'important');
      const si = innerSpan.style;
      si.setProperty('position', 'absolute', 'important');
      si.setProperty('top', '50%', 'important');
      si.setProperty('left', '50%', 'important');
      si.setProperty('transform', 'translate(-50%, -50%)', 'important');
      si.setProperty('line-height', '1', 'important');
      si.setProperty('white-space', 'nowrap', 'important');
      si.removeProperty('width');
      si.removeProperty('text-align');
      si.removeProperty('min-width');
      const allDeepSpans = innerSpan.querySelectorAll('span');
      allDeepSpans.forEach(ds => {
        ds.style.setProperty('text-indent', '0', 'important');
        ds.style.setProperty('padding-left', '0', 'important');
        ds.style.setProperty('padding-right', '0', 'important');
        ds.style.setProperty('margin-left', '0', 'important');
        ds.style.setProperty('margin-right', '0', 'important');
      });
    }
  });
};

// 🔧 关键修复：editor 初始为 null → customCSS watch(immediate) 直接 return，CSS 从未注入
//             需要等 editor 就绪后再注入一次
watch(editor, (val) => {
  if (val && props.customCSS) {
    injectThemeCSS(props.customCSS);
  }
  // 🔑 editor 就绪后强制加固田字格样式（确保初始渲染也正确）
  if (val) {
    nextTick(() => forceTianZiGeStyles());
  }
});

watch(() => props.customCSS, (css, oldCss) => {
  injectThemeCSS(css);
  // 🔑 主题切换时强制 Tiptap 重新渲染，确保田字格/米字格等 Node 使用最新 renderHTML（含 !important）
  //    否则旧 DOM 元素上的内联样式可能缺少 !important，无法防御残留 CSS 规则干扰
  if (css !== oldCss && oldCss !== undefined && editor.value && css) {
    nextTick(() => {
      const html = editor.value.getHTML();
      if (html) {
        isInternalUpdate = true;
        editor.value.commands.setContent(html, false);
        nextTick(() => {
          isInternalUpdate = false;
          // 🔑 重渲染后强制加固（CSSOM API 保证 !important 优先级绝对不被任何 CSS 规则覆盖）
          forceTianZiGeStyles();
        });
      }
    });
  } else if (css && oldCss === undefined && editor.value) {
    // 🔑 首次加载（immediate）：CSS 已注入但未触发重渲染，直接加固
    nextTick(() => forceTianZiGeStyles());
  }
}, { immediate: true });

onBeforeUnmount(() => {
  // 移除缩放事件监听
  zoomWrapRef.value?.removeEventListener('wheel', onEditorWheel, { passive: false });
  editor.value?.destroy();
});

// ═══════════════ 挂载缩放事件 ═══════════════
watch(editor, (val) => {
  if (val && zoomWrapRef.value) {
    zoomWrapRef.value.addEventListener('wheel', onEditorWheel, { passive: false });
  }
}, { immediate: true });

defineExpose({
  editor,
  getHTML: () => editor.value?.getHTML() || '',
  // 🔧 导出专用：组件内部直接解包 editor（绕开父组件对 expose 中 ShallowRef 的解包不确定性），
  //    返回编辑器实时 DOM 的 HTML（td 含 p、用户删除的内容已消失）
  getDomHTML: () => editor.value?.view?.dom?.innerHTML || '',
  getText: () => editor.value?.getText() || '',
  getImages: () => {
    const images = [];
    if (!editor.value) return images;
    editor.value.state.doc.descendants((node) => {
      if (node.type.name === 'image' && node.attrs.src) {
        images.push({ src: node.attrs.src, alt: node.attrs.alt || '' });
      }
    });
    return images;
  },
  replaceImagesWithText: async (imageDescriptions) => {
    let pos = 0;
    if (!editor.value) return;
    editor.value.state.doc.descendants((node, position) => {
      if (node.type.name === 'image') {
        const desc = imageDescriptions[pos] || '[图片]';
        editor.value.chain().setTextSelection(position).deleteSelection().insertContent(desc).run();
        pos++;
      }
    });
  },
  setContent: (html) => { editor.value?.commands.setContent(normalizeShortHexColors(normalizeDoubleNumberedLists(normalizeColorStyles(normalizeRubyTags(convertClassStylesToInline(normalizeWhitespaceCarriers(html)))))), false); },
});
</script>

<style scoped>
.rich-text-editor {
  border: 1px solid #d0d0d0;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

/* 工具栏容器 - 用 overflow:hidden 裁剪 border-radius，内部允许滚动 */
.editor-toolbar-wrapper {
  flex-shrink: 0;
  overflow: hidden;
  border-radius: 5px 5px 0 0;
}

/* ===== 工具栏 ===== */
/* 🔧 左右 padding 16px 与编辑区内容缩进对齐（用户反馈：工具可左右缩进更美观） */
.editor-toolbar {
  display: flex;
  gap: 3px;
  padding: 8px 16px;
  background: #f3f4f6;
  border-bottom: 1px solid #d0d0d0;
  flex-wrap: wrap;
  align-items: center;
}

/* 🔧 工具尺寸调大（用户反馈：工具栏工具视觉太小，触屏/鼠标点击不便） */
.editor-toolbar button {
  padding: 6px 10px;
  border: 1px solid transparent;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.12s;
  min-width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
  color: #333;
}

.editor-toolbar button:hover { background: #e0e3e8; border-color: #c0c4cc; }
.editor-toolbar button:disabled { opacity: 0.35; cursor: not-allowed; }
.editor-toolbar button.is-active { background: #3b82f6; color: #fff; border-color: #2563eb; }

.toolbar-divider {
  width: 1px;
  height: 24px;
  background: #c8ccd4;
  margin: 0 4px;
  flex-shrink: 0;
}

.toolbar-select {
  padding: 4px 6px;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  background: #fff;
  font-size: 14px;
  height: 34px;
  cursor: pointer;
  outline: none;
  color: #333;
}
.toolbar-select:focus { border-color: #3b82f6; }
.toolbar-select--sm { font-size: 13px; width: 64px; }

/* ===== 颜色选择器 ===== */
.color-picker-wrapper { position: relative; display: inline-flex; align-items: center; }
.color-btn { cursor: pointer; position: relative; border-bottom: 2.5px solid #000 !important; }
.color-letter { font-weight: bold; font-size: 15px; }
.color-input {
  position: absolute; top: 0; left: 0;
  width: 100%; height: 100%; opacity: 0; cursor: pointer;
}

/* ===== 编辑器内容 ===== */
.rich-text-editor :deep(.ProseMirror) {
  flex: 1 1 auto;
  min-height: 0;
  padding: 12px 16px;
  line-height: 1.7;
  outline: none;
  overflow-y: auto;
}

/* ===== 编辑器缩放容器 ===== */
.editor-zoom-wrap {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  border-radius: 0 0 5px 5px;
}

/* EditorContent 外层 wrapper 需要 display:contents 或让 ProseMirror 直接参与 flex */
.editor-zoom-wrap :deep(> div) {
  display: flex;
  flex-direction: column;
  min-height: 100%;
}

.editor-zoom-wrap :deep(.ProseMirror) {
  transform-origin: top left;
  word-break: break-word;
  overflow-wrap: break-word;
}

/* 缩放指示器 */
.zoom-indicator {
  font-size: 11px;
  color: var(--text-muted);
  padding: 0 6px;
  min-width: 44px;
  text-align: center;
  cursor: pointer;
  user-select: none;
}
.zoom-indicator:hover { color: #333; }

/* 格式刷激活时编辑区光标变刷子 */
.editor-zoom-wrap.painter-active {
  cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cpath fill='%233b82f6' d='M16.56 3.94a1.49 1.49 0 0 0-2.12 0L3.34 15.03a1.49 1.49 0 0 0 0 2.12l3.54 3.54c.59.58 1.53.58 2.12 0L20.09 9.6a1.49 1.49 0 0 0 0-2.12l-3.53-3.54zM7.05 18.99l-2.12-2.12l9.2-9.19l2.12 2.12l-9.2 9.19z'/%3E%3Cpath fill='%233b82f6' d='M16.56 3.94l2.12 2.12l-1.06 1.06l-2.12-2.12z'/%3E%3C/svg%3E") 4 20, crosshair;
}

.rich-text-editor :deep(.ProseMirror p.is-editor-empty:first-child::before) {
  color: #adb5bd;
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
}

.rich-text-editor :deep(h1),
.rich-text-editor :deep(h2),
.rich-text-editor :deep(h3),
.rich-text-editor :deep(h4) {
  /* 字号由主题 CSS 控制，此处仅保留间距 */
  margin: 0.5em 0 0.3em;
}

.rich-text-editor :deep(img) {
  max-width: 100%; height: auto; display: block;
  margin: 8px 0; border-radius: 4px; cursor: pointer; transition: all 0.2s ease;
}
.rich-text-editor :deep(img.ProseMirror-selectednode) { outline: 3px solid #3b82f6; box-shadow: 0 0 8px rgba(59,130,246,0.5); }
.rich-text-editor :deep(img:hover) { outline: 2px dashed #3b82f6; }

.rich-text-editor :deep(mark) { background-color: #fef08a; padding: 2px 4px; border-radius: 2px; }

.rich-text-editor :deep(table) { border-collapse: collapse; width: 100%; margin: 8px 0; table-layout: auto; }
.rich-text-editor :deep(table td),
.rich-text-editor :deep(table th) { border: 1px solid var(--text-muted); padding: 4px 10px; min-width: 50px; text-align: left; vertical-align: top; }
.rich-text-editor :deep(table th) { background: #f0f4f8; font-weight: 600; }

.rich-text-editor :deep(hr) { border: none; border-top: 1px solid #ccc; margin: 12px 0; }

.rich-text-editor :deep(blockquote) { border-left: 3px solid #3b82f6; padding-left: 12px; color: #555; margin: 8px 0; }
.rich-text-editor :deep(ol), .rich-text-editor :deep(ul) { padding-left: 1.8em; }

/* 🔧 列表 type 显示：ol type 属性对应的字母/罗马编号样式（与导出前缀一致） */
.rich-text-editor :deep(ol[type="a"]) { list-style-type: lower-alpha; }
.rich-text-editor :deep(ol[type="A"]) { list-style-type: upper-alpha; }
.rich-text-editor :deep(ol[type="i"]) { list-style-type: lower-roman; }
.rich-text-editor :deep(ol[type="I"]) { list-style-type: upper-roman; }

/* 🔧 作图网格区 / 花式竖式格兜底（CSS 变量取自排版规格库；主题 CSS 注入后由带 !important 的规则覆盖） */
.rich-text-editor :deep(.square-grid) { width: var(--sg-w, 84mm); height: var(--sg-h, 56mm); border: 1.5px solid #999; margin: 8px 0; background: linear-gradient(#d5d5dc 1px, transparent 1px) 0 0 / var(--sg-bg, 7mm 7mm), linear-gradient(90deg, #d5d5dc 1px, transparent 1px) 0 0 / var(--sg-bg, 7mm 7mm); }
.rich-text-editor :deep(.bracket-grid) { display: grid; grid-template-rows: repeat(3, var(--bg-rh, 10mm)); width: var(--bg-w, 52mm); margin: 8px 0; border-left: 3px solid #333; border-right: 3px solid #333; }
.rich-text-editor :deep(.bracket-grid > div) { border-bottom: 0.5px solid #ccc; }
.rich-text-editor :deep(.bracket-grid > div:last-child) { border-bottom: none; }

/* ===== 特殊排版样式 ===== */
.rich-text-editor :deep(.emphasis-dot) { text-emphasis: dot #d32f2f; -webkit-text-emphasis: dot #d32f2f; text-emphasis-position: under; }
.rich-text-editor :deep(.underline-sentence) { text-decoration: underline; text-decoration-style: solid; text-underline-offset: 3px; text-decoration-thickness: 1.5px; }
.rich-text-editor :deep(.superscript) { vertical-align: super; font-size: smaller; line-height: 0; }
.rich-text-editor :deep(.subscript) { vertical-align: sub; font-size: smaller; line-height: 0; }
.rich-text-editor :deep(ruby) { ruby-position: over; ruby-align: center; }
.rich-text-editor :deep(rt) { font-size: 0.6em; text-align: center; color: #666; font-family: 'Times New Roman', 'Microsoft YaHei', SimSun, serif; }
.rich-text-editor :deep(.wavy-underline) { text-decoration: underline; text-decoration-style: wavy; text-decoration-color: #d32f2f; text-underline-offset: 3px; }
.rich-text-editor :deep(.double-line) { text-decoration: underline; text-decoration-style: double; text-underline-offset: 3px; }
.rich-text-editor :deep(.single-line) { text-decoration: underline; text-decoration-style: solid; text-underline-offset: 3px; }
.rich-text-editor :deep(ruby.radical) rb { font-size: 1em; }
.rich-text-editor :deep(ruby.radical) rt { font-size: 0.5em; color: var(--primary-light); }
.rich-text-editor :deep(.stroke-order) { display: inline-flex; align-items: flex-start; gap: 1px; vertical-align: baseline; }
.rich-text-editor :deep(.stroke-order)::after { content: attr(data-strokes) '画'; font-size: 0.55em; vertical-align: super; color: var(--text-muted); line-height: 1; margin-left: 1px; }
.rich-text-editor :deep(.tian-zi-ge), .rich-text-editor :deep(.mi-zi-ge) { display: inline-block; position: relative; width: 12mm; height: 12mm; border: 1.5px solid #5B9BD5; font-size: inherit !important; vertical-align: middle; margin: 0 1px; box-sizing: border-box; background: repeating-linear-gradient(to right,#5B9BD5 0px,#5B9BD5 3px,transparent 3px,transparent 6px) center/100% 0.5px no-repeat, repeating-linear-gradient(to bottom,#5B9BD5 0px,#5B9BD5 3px,transparent 3px,transparent 6px) center/0.5px 100% no-repeat; } /* 田字格仅低段：定档 12mm（同 inline/导出） */
.rich-text-editor :deep(.tian-zi-ge > span), .rich-text-editor :deep(.mi-zi-ge > span) { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); line-height: 1; white-space: nowrap; }
.rich-text-editor :deep(.mi-zi-ge) { background: repeating-linear-gradient(to right,#5B9BD5 0px,#5B9BD5 3px,transparent 3px,transparent 6px) center/100% 0.5px no-repeat, repeating-linear-gradient(to bottom,#5B9BD5 0px,#5B9BD5 3px,transparent 3px,transparent 6px) center/0.5px 100% no-repeat, repeating-linear-gradient(to top right,#5B9BD5 0px,#5B9BD5 3px,transparent 3px,transparent 6px) center/0.5px 100% no-repeat, repeating-linear-gradient(to bottom right,#5B9BD5 0px,#5B9BD5 3px,transparent 3px,transparent 6px) center/0.5px 100% no-repeat; }
.rich-text-editor :deep(.four-line-three) { display: inline-block; position: relative; padding: 4px 4px; font-family: 'Times New Roman', 'Georgia', SimSun, serif; font-size: inherit !important; line-height: 1; min-width: 18px; text-align: center; vertical-align: middle; text-indent: 0; overflow: visible; }
.rich-text-editor :deep(.four-line-three)::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 1.5em; background: linear-gradient(var(--text-muted), var(--text-muted)) 0 0.1em / 100% 1px no-repeat, linear-gradient(var(--text-muted), var(--text-muted)) 0 0.55em / 100% 1px no-repeat, linear-gradient(#666, #666) 0 1.0em / 100% 1px no-repeat, linear-gradient(var(--text-muted), var(--text-muted)) 0 1.45em / 100% 1px no-repeat; pointer-events: none; }
.rich-text-editor :deep(.pinyin-line) { font-family: 'Times New Roman', 'Microsoft YaHei', SimSun, serif; }
.rich-text-editor :deep(.english-line) { font-family: 'Times New Roman', 'Georgia', serif; }
.rich-text-editor :deep(.sixian-ge) { display: inline-block; position: relative; padding: 4px 4px; font-family: 'Times New Roman', 'Microsoft YaHei', SimSun, serif; font-size: inherit !important; line-height: 1; min-width: 18px; text-align: center; vertical-align: middle; text-indent: 0; overflow: visible; }
.rich-text-editor :deep(.sixian-ge)::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 1.5em; background: linear-gradient(var(--text-muted), var(--text-muted)) 0 0.1em / 100% 1px no-repeat, linear-gradient(var(--text-muted), var(--text-muted)) 0 0.55em / 100% 1px no-repeat, linear-gradient(#666, #666) 0 1.0em / 100% 1px no-repeat, linear-gradient(var(--text-muted), var(--text-muted)) 0 1.45em / 100% 1px no-repeat; pointer-events: none; }
/* 🔧 作文格：auto-fill 按容器宽度放最多整数格子（格子尺寸固定由 CSS 变量 --zwg-cell-w/--zwg-cell-h 控制，
   TypesetModule 按学段注入：小学 12mm / 初中 10mm / 高中 宽7.5×高8mm；默认 12mm），
   与 docx 导出 perRow 计算口径一致——预览/导出行列一致，用户无需在 Word 中手动调列 */
.rich-text-editor :deep(.zuo-wen-ge) { display: grid; grid-template-columns: repeat(auto-fill, var(--zwg-cell-w, 12mm)); gap: 0; border: 1.5px solid var(--text-muted); margin: 8px 0; width: 100%; box-sizing: border-box; }
.rich-text-editor :deep(.zuo-wen-ge span) { display: inline-flex; align-items: center; justify-content: center; width: var(--zwg-cell-w, 12mm); height: var(--zwg-cell-h, 12mm); border: 0.5px solid #ccc; font-family: 'SimSun', 'KaiTi', serif; font-size: inherit !important; line-height: 1; text-align: center; box-sizing: border-box; }
.rich-text-editor :deep(.oral-box) { display: inline-block; border: 1.5px solid #333; padding: 2px 8px; margin: 0 2px; min-width: 40px; text-align: center; vertical-align: middle; font-size: inherit !important; }
/* ⭐ 填空横线/括号空位/整行横线/行尾延伸：已收敛到 src/styles/carrierCss.js（main.js 全局注入，编辑器内自动生效），
   不再在 SFC 深规则里维护副本，避免与全局/导出口径漂移 */
.rich-text-editor :deep(.oral-box.blank) { min-width: 50px; border-style: dashed; color: var(--text-muted); }
.rich-text-editor :deep(.vertical-calculation) { display: inline-block; margin: 8px 16px; font-family: 'Courier New', monospace; }
.rich-text-editor :deep(.vertical-calculation .vc-row) { text-align: right; padding: 1px 8px; letter-spacing: 0.2em; }
.rich-text-editor :deep(.vertical-calculation .vc-row.op) { border-bottom: 1.5px solid #333; padding-bottom: 2px; }
.rich-text-editor :deep(.vertical-calculation .vc-result) { text-align: right; padding: 2px 8px; letter-spacing: 0.2em; font-weight: bold; }
.rich-text-editor :deep(.off-formula) { margin: 8px 0; }
.rich-text-editor :deep(.off-formula .of-line) { text-indent: 1.5em; line-height: 1.8; }
.rich-text-editor :deep(.match-question) { display: flex; gap: 40px; margin: 12px 0; }
.rich-text-editor :deep(.match-question .match-col) { display: flex; flex-direction: column; gap: 10px; }
.rich-text-editor :deep(.match-question .match-item) { padding: 4px 16px; border: 1px solid #ccc; border-radius: 4px; min-width: 80px; text-align: center; }
.rich-text-editor :deep(.word-bank) { display: inline-flex; flex-wrap: wrap; gap: 6px; padding: 8px 12px; border: 1.5px solid #666; border-radius: 4px; margin: 4px 0; background: #fafafa; }
.rich-text-editor :deep(.word-bank .wb-item) { display: inline-block; padding: 2px 10px; font-family: 'Times New Roman', serif; font-size: 0.9em; color: #333; }
.rich-text-editor :deep(.chem-condition) { font-size: 0.7em; vertical-align: super; color: #555; line-height: 1; }
/* 🔧 密封线样式由主题 CSS（sealed_exam）统一提供（模板结构 seal-zone/seal-note/seal-info/seal-line/seal-char，
   绝对定位于左侧页边距带，正文内边距外侧）；编辑器只需保证页壳与密封区不裁切 */
.rich-text-editor :deep(.sealed-wrapper) { position: relative; overflow: visible; }
/* 🔧 密封试卷页壳边距兜底：不依赖主题 CSS 注入时序/关键词命中，编辑器内始终左右 2.5cm、上下 2cm */
.rich-text-editor :deep(.sealed-wrapper) { padding: 20mm 25mm !important; box-sizing: border-box !important; }
.rich-text-editor :deep(.seal-zone) { z-index: 1; }
.rich-text-editor :deep(.seal-note),
.rich-text-editor :deep(.seal-info),
.rich-text-editor :deep(.seal-char) { pointer-events: none; }
.rich-text-editor :deep(.seal-note p),
.rich-text-editor :deep(.seal-info p),
.rich-text-editor :deep(.seal-char p) { margin: 0; }
.rich-text-editor :deep(.exam-notice) { font-size: 12pt; line-height: 1.9; margin: 4pt 0 8pt; }
.rich-text-editor :deep(.exam-notice .notice-title) { font-weight: bold; margin: 0; }
.rich-text-editor :deep(.exam-notice .notice-item) { margin: 0; }
.rich-text-editor :deep(.exam-score-table) { width: 100%; border-collapse: collapse; margin-bottom: 10pt; font-size: 12pt; }
.rich-text-editor :deep(.exam-score-table th), .rich-text-editor :deep(.exam-score-table td) { border: 1px solid #000; text-align: center; padding: 4px 0; }
.rich-text-editor :deep(.exam-score-table th) { font-weight: bold; font-family: '黑体', 'SimHei', sans-serif; }
.rich-text-editor :deep(.score-board) { display: inline-table; border-collapse: collapse; margin: 4px 0; }
.rich-text-editor :deep(.score-board .sb-row) { display: table-row; }
.rich-text-editor :deep(.score-board .sb-label), .rich-text-editor :deep(.score-board .sb-value) { display: table-cell; padding: 4px 16px; border: 1px solid var(--text-muted); text-align: center; }
.rich-text-editor :deep(.score-board .sb-label) { font-size: 0.9em; color: #555; background: #f9f9f9; }
.rich-text-editor :deep(.score-board .sb-value) { font-weight: bold; }
.rich-text-editor :deep(.square-box) { display: inline-flex; align-items: center; justify-content: center; width: 1.8em; height: 1.8em; border: 1.5px solid #333; box-sizing: border-box; text-align: center; vertical-align: middle; margin: 0 1px; font-weight: bold; color: #333; font-size: inherit !important; line-height: 1; }
.rich-text-editor :deep(.score-box) { display: inline-block; border: 1.5px solid #333; padding: 3px 16px; text-align: center; min-width: 60px; font-weight: bold; font-size: inherit !important; }
.rich-text-editor :deep(.dashed-line) { display: inline-block; border-bottom: 1.5px dashed var(--text-muted); min-width: 40px; margin: 0 2px; }
.rich-text-editor :deep(table.periodic-table) { border-collapse: collapse; margin: 8px auto; font-size: 0.75em; }
.rich-text-editor :deep(table.periodic-table td), .rich-text-editor :deep(table.periodic-table th) { border: 1px solid #333; padding: 2px 4px; text-align: center; min-width: 2.5em; }
.rich-text-editor :deep(table.periodic-table .nonmetal) { background: #c8e6c9; }
.rich-text-editor :deep(table.periodic-table .metal) { background: #ffcdd2; }
.rich-text-editor :deep(table.periodic-table .transition) { background: #ffe0b2; }

/* ===== AI 生成语义提示样式（class 保留后生效）===== */
.rich-text-editor :deep(.tip) { color: #e67e22; background: #fff8f0; border-left: 3px solid #e67e22; padding: 6px 12px; margin: 8px 0; border-radius: 0 4px 4px 0; }
.rich-text-editor :deep(.note) { color: #2c3e50; background: #f0f7ff; border-left: 3px solid #3498db; padding: 6px 12px; margin: 8px 0; border-radius: 0 4px 4px 0; }
.rich-text-editor :deep(.warning) { color: #c0392b; background: #fff5f5; border-left: 3px solid #e74c3c; padding: 6px 12px; margin: 8px 0; border-radius: 0 4px 4px 0; }
.rich-text-editor :deep(.summary) { color: #1a6e5c; background: #f0faf7; border-left: 3px solid #1abc9c; padding: 6px 12px; margin: 8px 0; border-radius: 0 4px 4px 0; }
.rich-text-editor :deep(table.periodic-table .noble-gas) { background: #b3e5fc; }
.rich-text-editor :deep(table.periodic-table .lanthanide) { background: #f8bbd0; }
.rich-text-editor :deep(table.periodic-table .actinide) { background: #e1bee7; }
</style>
