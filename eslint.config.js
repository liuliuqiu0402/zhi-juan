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
  }
];
