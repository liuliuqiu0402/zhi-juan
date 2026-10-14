import pluginVue from 'eslint-plugin-vue';

export default [
  // 全局忽略
  {
    ignores: ['dist/**', 'node_modules/**', 'python-scripts/**', '*.config.js']
  },

  // 基础规则（所有 JS 文件）
  {
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'off'
    }
  },

  // Vue 文件规则
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['src/**/*.vue'],
    languageOptions: {
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    },
    rules: {
      'vue/multi-word-component-names': 'off',
      'vue/no-v-html': 'off',
      'vue/require-default-prop': 'off',
      'vue/require-prop-types': 'warn',
      'vue/no-unused-vars': 'warn'
    }
  },

  // 🔴 2026-10-14（工程级收口·补 lint 门时发现）：`TemplateStructureEditor.vue` **有意**在模板里改
  //    `analysis` 的**字段**（`v-model.number="analysis.总分"`）——它是"**两个抽屉共用同一份 `tpl.analysis` 对象**"
  //    的单一实现（组件头注原文：编辑即保存，@change → emit('persist') → 父级落盘）；改的是**对象字段**、
  //    不是重新赋值 prop，Vue 运行时不告警。**这是明确的设计决定，不是疏漏** ⇒ 按文件豁免该规则
  //    （**只豁免这一条**，其余规则照旧），并登记台账〔421〕，避免"用 disable 掩盖真问题"。
  {
    files: ['src/components/TemplateStructureEditor.vue'],
    rules: { 'vue/no-mutating-props': 'off' },
  }
];
