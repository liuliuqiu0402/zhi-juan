// ==================== 主题定义 ====================
import { convertFormulasInHtml } from './utils/wordExporter.js';
import { getMergedSpec, normalizeStage3 } from './config/layoutSpec.js';

export const themes = [
  // 我的样式
  {
    id: 'original_standard',
    name: '📝 我的标准样式',
    description: '原始标准样式',
    type: 'preset',
    group: '我的样式',
    stage: 'high',
    category: 'exam',
    colorTheme: 'original',
    titleFont: 'SimHei, Microsoft YaHei, sans-serif',
    bodyFont: 'SimSun, Microsoft YaHei, sans-serif',
    titleColor: '#1e3a6f',
    heading1Color: '#1e3a6f',
    heading2Color: '#2b5ea7',
    heading3Color: '#3a7bd5',
    bodyColor: '#000000',
    bodySize: 12,
    lineHeight: 1.6,
    pageMargin: '20px',
    tableHeaderBg: '#1e3a6f',
    tableHeaderColor: '#ffffff',
    tableOddRowBg: '#f5f9ff',
    tableEvenRowBg: '#ffffff',
    styles: {
      '.main-title': { textAlign: 'center', fontSize: '18pt', fontWeight: 'bold', marginBottom: '12pt', color: '#1e3a6f' },
      '.heading1': { fontSize: '14pt', fontWeight: 'bold', marginTop: '10pt', marginBottom: '6pt', color: '#1e3a6f' },
      '.heading2': { fontSize: '13pt', fontWeight: 'bold', marginTop: '8pt', marginBottom: '4pt', color: '#2b5ea7' },
      '.heading3': { fontSize: '12pt', fontWeight: 'bold', marginTop: '6pt', marginBottom: '3pt', color: '#3a7bd5' },
      '.normal-paragraph': { fontSize: '12pt', lineHeight: '1.6', marginBottom: '6pt' },
      '.indent-2': { textIndent: '2em' }
    }
  },
  {
    id: 'original_warm',
    name: '🔴 我的暖色样式',
    description: '暖色系样式',
    type: 'preset',
    group: '我的样式',
    stage: 'high',
    category: 'exam',
    colorTheme: 'warm',
    titleFont: 'SimHei, Microsoft YaHei, sans-serif',
    bodyFont: 'SimSun, Microsoft YaHei, sans-serif',
    titleColor: '#b85c00',
    heading1Color: '#b85c00',
    heading2Color: '#d47a00',
    heading3Color: '#e89a00',
    bodyColor: '#000000',
    bodySize: 12,
    lineHeight: 1.6,
    pageMargin: '20px',
    tableHeaderBg: '#b85c00',
    tableHeaderColor: '#ffffff',
    tableOddRowBg: '#fff5e6',
    tableEvenRowBg: '#ffffff',
    styles: {
      '.main-title': { textAlign: 'center', fontSize: '18pt', fontWeight: 'bold', marginBottom: '12pt', color: '#b85c00' },
      '.heading1': { fontSize: '14pt', fontWeight: 'bold', marginTop: '10pt', marginBottom: '6pt', color: '#b85c00' },
      '.heading2': { fontSize: '13pt', fontWeight: 'bold', marginTop: '8pt', marginBottom: '4pt', color: '#d47a00' },
      '.heading3': { fontSize: '12pt', fontWeight: 'bold', marginTop: '6pt', marginBottom: '3pt', color: '#e89a00' },
      '.normal-paragraph': { fontSize: '12pt', lineHeight: '1.6', marginBottom: '6pt' },
      '.indent-2': { textIndent: '2em' }
    }
  },
  {
    id: 'original_fresh',
    name: '🌿 我的清新样式',
    description: '清新绿色系样式',
    type: 'preset',
    group: '我的样式',
    stage: 'high',
    category: 'exam',
    colorTheme: 'fresh',
    titleFont: 'SimHei, Microsoft YaHei, sans-serif',
    bodyFont: 'SimSun, Microsoft YaHei, sans-serif',
    titleColor: '#2e7d32',
    heading1Color: '#2e7d32',
    heading2Color: '#43a047',
    heading3Color: '#66bb6a',
    bodyColor: '#000000',
    bodySize: 12,
    lineHeight: 1.6,
    pageMargin: '20px',
    tableHeaderBg: '#2e7d32',
    tableHeaderColor: '#ffffff',
    tableOddRowBg: '#e8f5e9',
    tableEvenRowBg: '#ffffff',
    styles: {
      '.main-title': { textAlign: 'center', fontSize: '18pt', fontWeight: 'bold', marginBottom: '12pt', color: '#2e7d32' },
      '.heading1': { fontSize: '14pt', fontWeight: 'bold', marginTop: '10pt', marginBottom: '6pt', color: '#2e7d32' },
      '.heading2': { fontSize: '13pt', fontWeight: 'bold', marginTop: '8pt', marginBottom: '4pt', color: '#43a047' },
      '.heading3': { fontSize: '12pt', fontWeight: 'bold', marginTop: '6pt', marginBottom: '3pt', color: '#66bb6a' },
      '.normal-paragraph': { fontSize: '12pt', lineHeight: '1.6', marginBottom: '6pt' },
      '.indent-2': { textIndent: '2em' }
    }
  },
  // 小学
  {
    id: 'primary_exam',
    name: '📝 小学试卷',
    description: '小学试卷标准样式',
    type: 'preset',
    group: '小学',
    stage: 'primary',
    category: 'exam',
    colorTheme: 'original',
    titleFont: 'SimHei, Microsoft YaHei, sans-serif',
    bodyFont: 'SimSun, Microsoft YaHei, sans-serif',
    titleColor: '#000000',
    heading1Color: '#000000',
    heading2Color: '#000000',
    heading3Color: '#000000',
    bodyColor: '#000000',
    bodySize: 14, // 🔧 学段适配：小学大字（四号）
    lineHeight: 1.8,
    pageMargin: '20px',
    tableHeaderBg: '#1e3a6f',
    tableHeaderColor: '#ffffff',
    tableOddRowBg: '#f5f9ff',
    tableEvenRowBg: '#ffffff',
    styles: {
      '.main-title': { textAlign: 'center', fontSize: '20pt', fontWeight: 'bold', marginBottom: '14pt', color: '#000000' },
      '.heading1': { fontSize: '16pt', fontWeight: 'bold', marginTop: '12pt', marginBottom: '8pt', color: '#000000' },
      '.heading2': { fontSize: '14pt', fontWeight: 'bold', marginTop: '10pt', marginBottom: '6pt', color: '#000000' },
      '.heading3': { fontSize: '13pt', fontWeight: 'bold', marginTop: '8pt', marginBottom: '4pt', color: '#000000' },
      '.normal-paragraph': { fontSize: '14pt', lineHeight: '1.8', marginBottom: '8pt' },
      '.indent-2': { textIndent: '2em' }
    }
  },
  {
    id: 'primary_practice',
    name: '📚 小学课时练',
    description: '小学课时练习样式',
    type: 'preset',
    group: '小学',
    stage: 'primary',
    category: 'practice',
    colorTheme: 'fresh',
    titleFont: 'SimHei, Microsoft YaHei, sans-serif',
    bodyFont: 'SimSun, Microsoft YaHei, sans-serif',
    titleColor: '#2e7d32',
    heading1Color: '#2e7d32',
    heading2Color: '#43a047',
    heading3Color: '#66bb6a',
    bodyColor: '#000000',
    bodySize: 12,
    lineHeight: 1.8,
    pageMargin: '20px',
    tableHeaderBg: '#2e7d32',
    tableHeaderColor: '#ffffff',
    tableOddRowBg: '#e8f5e9',
    tableEvenRowBg: '#ffffff',
    styles: {
      '.main-title': { textAlign: 'center', fontSize: '20pt', fontWeight: 'bold', marginBottom: '14pt', color: '#2e7d32' },
      '.heading1': { fontSize: '16pt', fontWeight: 'bold', marginTop: '12pt', marginBottom: '8pt', color: '#2e7d32' },
      '.heading2': { fontSize: '14pt', fontWeight: 'bold', marginTop: '10pt', marginBottom: '6pt', color: '#43a047' },
      '.heading3': { fontSize: '13pt', fontWeight: 'bold', marginTop: '8pt', marginBottom: '4pt', color: '#66bb6a' },
      '.normal-paragraph': { fontSize: '14pt', lineHeight: '1.8', marginBottom: '8pt' },
      '.indent-2': { textIndent: '2em' }
    }
  },
  {
    id: 'primary_summary',
    name: '📖 小学知识点',
    description: '小学知识点总结样式',
    type: 'preset',
    group: '小学',
    stage: 'primary',
    category: 'summary',
    colorTheme: 'warm',
    titleFont: 'SimHei, Microsoft YaHei, sans-serif',
    bodyFont: 'SimSun, Microsoft YaHei, sans-serif',
    titleColor: '#b85c00',
    heading1Color: '#b85c00',
    heading2Color: '#d47a00',
    heading3Color: '#e89a00',
    bodyColor: '#000000',
    bodySize: 12,
    lineHeight: 1.8,
    pageMargin: '20px',
    tableHeaderBg: '#b85c00',
    tableHeaderColor: '#ffffff',
    tableOddRowBg: '#fff5e6',
    tableEvenRowBg: '#ffffff',
    styles: {
      '.main-title': { textAlign: 'center', fontSize: '20pt', fontWeight: 'bold', marginBottom: '14pt', color: '#b85c00' },
      '.heading1': { fontSize: '16pt', fontWeight: 'bold', marginTop: '12pt', marginBottom: '8pt', color: '#b85c00' },
      '.heading2': { fontSize: '14pt', fontWeight: 'bold', marginTop: '10pt', marginBottom: '6pt', color: '#d47a00' },
      '.heading3': { fontSize: '13pt', fontWeight: 'bold', marginTop: '8pt', marginBottom: '4pt', color: '#e89a00' },
      '.normal-paragraph': { fontSize: '14pt', lineHeight: '1.8', marginBottom: '8pt' },
      '.indent-2': { textIndent: '2em' }
    }
  },
  // 初中
  {
    id: 'middle_exam',
    name: '📝 初中试卷',
    description: '初中试卷标准样式',
    type: 'preset',
    group: '初中',
    stage: 'middle',
    category: 'exam',
    colorTheme: 'original',
    titleFont: 'SimHei, Microsoft YaHei, sans-serif',
    bodyFont: 'SimSun, Microsoft YaHei, sans-serif',
    titleColor: '#000000',
    heading1Color: '#000000',
    heading2Color: '#000000',
    heading3Color: '#000000',
    bodyColor: '#000000',
    bodySize: 12,
    lineHeight: 1.6,
    pageMargin: '20px',
    tableHeaderBg: '#1e3a6f',
    tableHeaderColor: '#ffffff',
    tableOddRowBg: '#f5f9ff',
    tableEvenRowBg: '#ffffff',
    styles: {
      '.main-title': { textAlign: 'center', fontSize: '18pt', fontWeight: 'bold', marginBottom: '12pt', color: '#000000' },
      '.heading1': { fontSize: '14pt', fontWeight: 'bold', marginTop: '10pt', marginBottom: '6pt', color: '#000000' },
      '.heading2': { fontSize: '13pt', fontWeight: 'bold', marginTop: '8pt', marginBottom: '4pt', color: '#000000' },
      '.heading3': { fontSize: '12pt', fontWeight: 'bold', marginTop: '6pt', marginBottom: '3pt', color: '#000000' },
      '.normal-paragraph': { fontSize: '12pt', lineHeight: '1.6', marginBottom: '6pt' },
      '.indent-2': { textIndent: '2em' }
    }
  },
  {
    id: 'middle_practice',
    name: '📚 初中课时练',
    description: '初中课时练习样式',
    type: 'preset',
    group: '初中',
    stage: 'middle',
    category: 'practice',
    colorTheme: 'fresh',
    titleFont: 'SimHei, Microsoft YaHei, sans-serif',
    bodyFont: 'SimSun, Microsoft YaHei, sans-serif',
    titleColor: '#2e7d32',
    heading1Color: '#2e7d32',
    heading2Color: '#43a047',
    heading3Color: '#66bb6a',
    bodyColor: '#000000',
    bodySize: 12,
    lineHeight: 1.6,
    pageMargin: '20px',
    tableHeaderBg: '#2e7d32',
    tableHeaderColor: '#ffffff',
    tableOddRowBg: '#e8f5e9',
    tableEvenRowBg: '#ffffff',
    styles: {
      '.main-title': { textAlign: 'center', fontSize: '18pt', fontWeight: 'bold', marginBottom: '12pt', color: '#2e7d32' },
      '.heading1': { fontSize: '14pt', fontWeight: 'bold', marginTop: '10pt', marginBottom: '6pt', color: '#2e7d32' },
      '.heading2': { fontSize: '13pt', fontWeight: 'bold', marginTop: '8pt', marginBottom: '4pt', color: '#43a047' },
      '.heading3': { fontSize: '12pt', fontWeight: 'bold', marginTop: '6pt', marginBottom: '3pt', color: '#66bb6a' },
      '.normal-paragraph': { fontSize: '12pt', lineHeight: '1.6', marginBottom: '6pt' },
      '.indent-2': { textIndent: '2em' }
    }
  },
  {
    id: 'middle_summary',
    name: '📖 初中知识点',
    description: '初中知识点总结样式',
    type: 'preset',
    group: '初中',
    stage: 'middle',
    category: 'summary',
    colorTheme: 'warm',
    titleFont: 'SimHei, Microsoft YaHei, sans-serif',
    bodyFont: 'SimSun, Microsoft YaHei, sans-serif',
    titleColor: '#b85c00',
    heading1Color: '#b85c00',
    heading2Color: '#d47a00',
    heading3Color: '#e89a00',
    bodyColor: '#000000',
    bodySize: 12,
    lineHeight: 1.6,
    pageMargin: '20px',
    tableHeaderBg: '#b85c00',
    tableHeaderColor: '#ffffff',
    tableOddRowBg: '#fff5e6',
    tableEvenRowBg: '#ffffff',
    styles: {
      '.main-title': { textAlign: 'center', fontSize: '18pt', fontWeight: 'bold', marginBottom: '12pt', color: '#b85c00' },
      '.heading1': { fontSize: '14pt', fontWeight: 'bold', marginTop: '10pt', marginBottom: '6pt', color: '#b85c00' },
      '.heading2': { fontSize: '13pt', fontWeight: 'bold', marginTop: '8pt', marginBottom: '4pt', color: '#d47a00' },
      '.heading3': { fontSize: '12pt', fontWeight: 'bold', marginTop: '6pt', marginBottom: '3pt', color: '#e89a00' },
      '.normal-paragraph': { fontSize: '12pt', lineHeight: '1.6', marginBottom: '6pt' },
      '.indent-2': { textIndent: '2em' }
    }
  },
  // 高中
  {
    id: 'high_exam',
    name: '📝 高中试卷',
    description: '高中试卷标准样式',
    type: 'preset',
    group: '高中',
    stage: 'high',
    category: 'exam',
    colorTheme: 'original',
    titleFont: 'SimHei, Microsoft YaHei, sans-serif',
    bodyFont: 'SimSun, Microsoft YaHei, sans-serif',
    titleColor: '#000000',
    heading1Color: '#000000',
    heading2Color: '#000000',
    heading3Color: '#000000',
    bodyColor: '#000000',
    bodySize: 10.5, // 🔧 学段适配：高中五号，更接近真题卷面
    lineHeight: 1.4,
    pageMargin: '20px',
    tableHeaderBg: '#1e3a6f',
    tableHeaderColor: '#ffffff',
    tableOddRowBg: '#f5f9ff',
    tableEvenRowBg: '#ffffff',
    styles: {
      '.main-title': { textAlign: 'center', fontSize: '18pt', fontWeight: 'bold', marginBottom: '12pt', color: '#000000' },
      '.heading1': { fontSize: '14pt', fontWeight: 'bold', marginTop: '10pt', marginBottom: '6pt', color: '#000000' },
      '.heading2': { fontSize: '13pt', fontWeight: 'bold', marginTop: '8pt', marginBottom: '4pt', color: '#000000' },
      '.heading3': { fontSize: '12pt', fontWeight: 'bold', marginTop: '6pt', marginBottom: '3pt', color: '#000000' },
      '.normal-paragraph': { fontSize: '10.5pt', lineHeight: '1.4', marginBottom: '5pt' },
      '.indent-2': { textIndent: '2em' }
    }
  },
  {
    id: 'high_practice',
    name: '📚 高中课时练',
    description: '高中课时练习样式',
    type: 'preset',
    group: '高中',
    stage: 'high',
    category: 'practice',
    colorTheme: 'fresh',
    titleFont: 'SimHei, Microsoft YaHei, sans-serif',
    bodyFont: 'SimSun, Microsoft YaHei, sans-serif',
    titleColor: '#2e7d32',
    heading1Color: '#2e7d32',
    heading2Color: '#43a047',
    heading3Color: '#66bb6a',
    bodyColor: '#000000',
    bodySize: 12,
    lineHeight: 1.5,
    pageMargin: '20px',
    tableHeaderBg: '#2e7d32',
    tableHeaderColor: '#ffffff',
    tableOddRowBg: '#e8f5e9',
    tableEvenRowBg: '#ffffff',
    styles: {
      '.main-title': { textAlign: 'center', fontSize: '18pt', fontWeight: 'bold', marginBottom: '12pt', color: '#2e7d32' },
      '.heading1': { fontSize: '14pt', fontWeight: 'bold', marginTop: '10pt', marginBottom: '6pt', color: '#2e7d32' },
      '.heading2': { fontSize: '13pt', fontWeight: 'bold', marginTop: '8pt', marginBottom: '4pt', color: '#43a047' },
      '.heading3': { fontSize: '12pt', fontWeight: 'bold', marginTop: '6pt', marginBottom: '3pt', color: '#66bb6a' },
      '.normal-paragraph': { fontSize: '12pt', lineHeight: '1.5', marginBottom: '6pt' },
      '.indent-2': { textIndent: '2em' }
    }
  },
  {
    id: 'high_summary',
    name: '📖 高中知识点',
    description: '高中知识点总结样式',
    type: 'preset',
    group: '高中',
    stage: 'high',
    category: 'summary',
    colorTheme: 'warm',
    titleFont: 'SimHei, Microsoft YaHei, sans-serif',
    bodyFont: 'SimSun, Microsoft YaHei, sans-serif',
    titleColor: '#b85c00',
    heading1Color: '#b85c00',
    heading2Color: '#d47a00',
    heading3Color: '#e89a00',
    bodyColor: '#000000',
    bodySize: 12,
    lineHeight: 1.5,
    pageMargin: '20px',
    tableHeaderBg: '#b85c00',
    tableHeaderColor: '#ffffff',
    tableOddRowBg: '#fff5e6',
    tableEvenRowBg: '#ffffff',
    styles: {
      '.main-title': { textAlign: 'center', fontSize: '18pt', fontWeight: 'bold', marginBottom: '12pt', color: '#b85c00' },
      '.heading1': { fontSize: '14pt', fontWeight: 'bold', marginTop: '10pt', marginBottom: '6pt', color: '#b85c00' },
      '.heading2': { fontSize: '13pt', fontWeight: 'bold', marginTop: '8pt', marginBottom: '4pt', color: '#d47a00' },
      '.heading3': { fontSize: '12pt', fontWeight: 'bold', marginTop: '6pt', marginBottom: '3pt', color: '#e89a00' },
      '.normal-paragraph': { fontSize: '12pt', lineHeight: '1.5', marginBottom: '6pt' },
      '.indent-2': { textIndent: '2em' }
    }
  },
  // 特殊
  {
    id: 'teaching_plan',
    name: '📋 教案设计',
    description: '教案设计标准样式',
    type: 'preset',
    group: '特殊',
    stage: 'high',
    category: 'plan',
    colorTheme: 'academic',
    titleFont: 'SimHei, Microsoft YaHei, sans-serif',
    bodyFont: 'SimSun, Microsoft YaHei, sans-serif',
    titleColor: '#5e35b1',
    heading1Color: '#5e35b1',
    heading2Color: '#7e57c2',
    heading3Color: '#9575cd',
    bodyColor: '#000000',
    bodySize: 12,
    lineHeight: 1.6,
    pageMargin: '20px',
    tableHeaderBg: '#5e35b1',
    tableHeaderColor: '#ffffff',
    tableOddRowBg: '#ede7f6',
    tableEvenRowBg: '#ffffff',
    styles: {
      '.main-title': { textAlign: 'center', fontSize: '18pt', fontWeight: 'bold', marginBottom: '12pt', color: '#5e35b1' },
      '.heading1': { fontSize: '14pt', fontWeight: 'bold', marginTop: '10pt', marginBottom: '6pt', color: '#5e35b1' },
      '.heading2': { fontSize: '13pt', fontWeight: 'bold', marginTop: '8pt', marginBottom: '4pt', color: '#7e57c2' },
      '.heading3': { fontSize: '12pt', fontWeight: 'bold', marginTop: '6pt', marginBottom: '3pt', color: '#9575cd' },
      '.normal-paragraph': { fontSize: '12pt', lineHeight: '1.6', marginBottom: '6pt' },
      '.indent-2': { textIndent: '2em' },
      // 📋 教案设计专属样式
      '.teaching-section': {
        border: '1px solid #d1c4e9',
        borderRadius: '6px',
        padding: '12px 16px',
        marginBottom: '14px',
        background: '#faf8ff'
      },
      '.teaching-section h3': {
        fontSize: '13pt',
        fontWeight: 'bold',
        color: '#5e35b1',
        marginBottom: '8px',
        paddingBottom: '4px',
        borderBottom: '2px solid #d1c4e9'
      },
      '.objective-list': {
        paddingLeft: '1.5em',
        lineHeight: '1.8'
      },
      '.objective-list li': {
        marginBottom: '4px'
      },
      '.key-points': {
        background: '#ede7f6',
        padding: '10px 14px',
        borderRadius: '4px',
        borderLeft: '4px solid #5e35b1',
        marginBottom: '10px',
        fontSize: '12pt',
        lineHeight: '1.7'
      },
      '.difficult-points': {
        background: '#fff3e0',
        padding: '10px 14px',
        borderRadius: '4px',
        borderLeft: '4px solid #ff8f00',
        marginBottom: '10px',
        fontSize: '12pt',
        lineHeight: '1.7'
      },
      '.process-step': {
        display: 'flex',
        gap: '10px',
        alignItems: 'flex-start',
        marginBottom: '10px',
        padding: '8px 14px',
        background: '#f5f5f5',
        borderRadius: '4px'
      },
      '.step-number': {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '28px',
        height: '28px',
        borderRadius: '50%',
        background: '#5e35b1',
        color: '#ffffff',
        fontWeight: 'bold',
        fontSize: '11pt',
        flexShrink: '0'
      },
      '.step-content': {
        flex: '1',
        fontSize: '12pt',
        lineHeight: '1.7'
      },
      '.board-design': {
        background: '#f9f9f9',
        border: '1px solid #ccc',
        borderRadius: '6px',
        padding: '12px 16px',
        marginTop: '12px',
        fontFamily: 'SimSun, Microsoft YaHei, sans-serif',
        fontSize: '12pt',
        lineHeight: '1.8'
      },
      '.homework-section': {
        background: '#fff8e1',
        border: '1px dashed #ffb300',
        borderRadius: '6px',
        padding: '10px 14px',
        marginTop: '12px',
        fontSize: '12pt',
        lineHeight: '1.7'
      },
      '.reflection': {
        background: '#e8eaf6',
        borderLeft: '4px solid #5e35b1',
        padding: '8px 14px',
        marginTop: '12px',
        fontSize: '11pt',
        fontStyle: 'italic',
        color: '#555555'
      }
    }
  },
  {
    id: 'error_book',
    name: '🔖 错题本',
    description: '错题本样式',
    type: 'preset',
    group: '特殊',
    stage: 'high',
    category: 'errorbook',
    colorTheme: 'warm',
    titleFont: 'SimHei, Microsoft YaHei, sans-serif',
    bodyFont: 'SimSun, Microsoft YaHei, sans-serif',
    titleColor: '#c62828',
    heading1Color: '#c62828',
    heading2Color: '#e53935',
    heading3Color: '#ef5350',
    bodyColor: '#000000',
    bodySize: 12,
    lineHeight: 1.6,
    pageMargin: '20px',
    tableHeaderBg: '#c62828',
    tableHeaderColor: '#ffffff',
    tableOddRowBg: '#ffebee',
    tableEvenRowBg: '#ffffff',
    styles: {
      '.main-title': { textAlign: 'center', fontSize: '18pt', fontWeight: 'bold', marginBottom: '12pt', color: '#c62828' },
      '.heading1': { fontSize: '14pt', fontWeight: 'bold', marginTop: '10pt', marginBottom: '6pt', color: '#c62828' },
      '.heading2': { fontSize: '13pt', fontWeight: 'bold', marginTop: '8pt', marginBottom: '4pt', color: '#e53935' },
      '.heading3': { fontSize: '12pt', fontWeight: 'bold', marginTop: '6pt', marginBottom: '3pt', color: '#ef5350' },
      '.normal-paragraph': { fontSize: '12pt', lineHeight: '1.6', marginBottom: '6pt' },
      '.indent-2': { textIndent: '2em' },
      // 🔖 错题本专属样式
      '.error-item': {
        border: '1px solid #e0e0e0',
        borderRadius: '6px',
        padding: '12px 16px',
        marginBottom: '16px',
        background: '#ffffff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        borderLeft: '4px solid #c62828'
      },
      '.original-question': {
        background: '#fafafa',
        padding: '10px 14px',
        borderRadius: '4px',
        marginBottom: '10px',
        borderLeft: '3px solid #ffcdd2',
        fontSize: '12pt',
        lineHeight: '1.6'
      },
      '.error-reason': {
        background: '#fff3e0',
        padding: '8px 14px',
        borderRadius: '4px',
        marginBottom: '10px',
        fontSize: '12pt',
        lineHeight: '1.6'
      },
      '.correct-solution': {
        background: '#e8f5e9',
        padding: '10px 14px',
        borderRadius: '4px',
        marginBottom: '10px',
        borderLeft: '3px solid #4caf50',
        fontSize: '12pt',
        lineHeight: '1.6'
      },
      '.variant-practice': {
        background: '#e3f2fd',
        padding: '10px 14px',
        borderRadius: '4px',
        borderLeft: '3px solid #2196f3',
        fontSize: '12pt',
        lineHeight: '1.6'
      },
      '.tag': {
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: '12px',
        fontSize: '10pt',
        fontWeight: 'bold',
        marginRight: '6px'
      },
      '.tag-concept': { background: '#ffebee', color: '#c62828' },
      '.tag-calculation': { background: '#fff3e0', color: '#e65100' },
      '.tag-careless': { background: '#fce4ec', color: '#880e4f' },
      '.tag-method': { background: '#e8eaf6', color: '#283593' },
      // 📝 订正区域（右侧双栏布局）
      '.correction-layout': {
        display: 'flex',
        gap: '16px',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box'
      },
      '.correction-left': {
        flex: '1 1 300px',
        minWidth: '0',
        overflow: 'hidden',
        wordBreak: 'break-word'
      },
      '.correction-right': {
        flex: '0 1 220px',
        maxWidth: '280px',
        background: '#fff8e1',
        border: '1px dashed #ffb300',
        borderRadius: '6px',
        padding: '12px',
        fontSize: '11pt',
        lineHeight: '1.7',
        overflow: 'auto'
      },
      '.correction-title': {
        fontSize: '13pt',
        fontWeight: 'bold',
        color: '#e65100',
        marginBottom: '8px',
        borderBottom: '1px solid #ffe0b2',
        paddingBottom: '4px'
      }
    }
  },
  {
    id: 'study_note',
    name: '📒 学霸笔记',
    description: '学霸笔记样式',
    type: 'preset',
    group: '特殊',
    stage: 'high',
    category: 'summary',
    colorTheme: 'fresh',
    titleFont: 'SimHei, Microsoft YaHei, sans-serif',
    bodyFont: 'SimSun, Microsoft YaHei, sans-serif',
    titleColor: '#00695c',
    heading1Color: '#00695c',
    heading2Color: '#00897b',
    heading3Color: '#26a69a',
    bodyColor: '#000000',
    bodySize: 12,
    lineHeight: 1.6,
    pageMargin: '20px',
    tableHeaderBg: '#00695c',
    tableHeaderColor: '#ffffff',
    tableOddRowBg: '#e0f2f1',
    tableEvenRowBg: '#ffffff',
    styles: {
      '.main-title': { textAlign: 'center', fontSize: '18pt', fontWeight: 'bold', marginBottom: '12pt', color: '#00695c' },
      '.heading1': { fontSize: '14pt', fontWeight: 'bold', marginTop: '10pt', marginBottom: '6pt', color: '#00695c' },
      '.heading2': { fontSize: '13pt', fontWeight: 'bold', marginTop: '8pt', marginBottom: '4pt', color: '#00897b' },
      '.heading3': { fontSize: '12pt', fontWeight: 'bold', marginTop: '6pt', marginBottom: '3pt', color: '#26a69a' },
      '.normal-paragraph': { fontSize: '12pt', lineHeight: '1.6', marginBottom: '6pt' },
      '.indent-2': { textIndent: '2em' },
      // 📒 学霸笔记专属样式
      '.note-callout': {
        background: '#e0f2f1',
        borderLeft: '4px solid #00695c',
        padding: '10px 14px',
        borderRadius: '4px',
        marginBottom: '10px',
        fontSize: '12pt',
        lineHeight: '1.7'
      },
      '.note-tip': {
        background: '#fff8e1',
        borderLeft: '4px solid #ffb300',
        padding: '8px 14px',
        borderRadius: '4px',
        marginBottom: '8px',
        fontSize: '11pt',
        lineHeight: '1.6'
      },
      '.note-warning': {
        background: '#ffebee',
        borderLeft: '4px solid #c62828',
        padding: '8px 14px',
        borderRadius: '4px',
        marginBottom: '8px',
        fontSize: '11pt',
        lineHeight: '1.6'
      },
      '.note-summary': {
        background: 'linear-gradient(135deg, #e0f2f1 0%, #e8f5e9 100%)',
        border: '2px solid #00695c',
        borderRadius: '8px',
        padding: '14px 18px',
        marginTop: '16px',
        marginBottom: '16px',
        fontSize: '12pt',
        lineHeight: '1.7'
      },
      '.note-example': {
        background: '#f5f5f5',
        border: '1px solid #e0e0e0',
        borderRadius: '6px',
        padding: '10px 14px',
        marginBottom: '10px',
        fontSize: '12pt',
        lineHeight: '1.7'
      },
      '.note-formula': {
        display: 'inline-block',
        background: '#e8eaf6',
        border: '1px solid #c5cae9',
        borderRadius: '4px',
        padding: '4px 12px',
        fontFamily: 'Times New Roman, serif',
        fontSize: '12pt',
        margin: '2px 0'
      },
      '.highlight-box': {
        background: '#ffff8d',
        padding: '2px 6px',
        borderRadius: '2px',
        fontWeight: 'bold'
      }
    }
  },
  {
    id: 'sealed_exam',
    name: '📜 密封线试卷',
    description: '带密封线和考生信息栏的正式试卷样式',
    type: 'preset',
    group: '特殊',
    stage: 'high',
    category: 'exam',
    colorTheme: 'original',
    titleFont: 'SimHei, Microsoft YaHei, sans-serif',
    bodyFont: 'SimSun, Microsoft YaHei, sans-serif',
    titleColor: '#1e3a6f',
    heading1Color: '#1e3a6f',
    heading2Color: '#2b5ea7',
    heading3Color: '#3a7bd5',
    bodyColor: '#000000',
    bodySize: 12,
    lineHeight: 1.5,
    pageMargin: '20px',
    tableHeaderBg: '#1e3a6f',
    tableHeaderColor: '#ffffff',
    tableOddRowBg: '#f5f9ff',
    tableEvenRowBg: '#ffffff',
    sealedLine: true, // 密封线标记
    styles: {
      '.main-title': { textAlign: 'center', fontSize: '18pt', fontWeight: 'bold', marginBottom: '12pt', color: '#1e3a6f' },
      '.heading1': { fontSize: '14pt', fontWeight: 'bold', marginTop: '10pt', marginBottom: '6pt', color: '#1e3a6f' },
      '.heading2': { fontSize: '13pt', fontWeight: 'bold', marginTop: '8pt', marginBottom: '4pt', color: '#2b5ea7' },
      '.heading3': { fontSize: '12pt', fontWeight: 'bold', marginTop: '6pt', marginBottom: '3pt', color: '#3a7bd5' },
      '.normal-paragraph': { fontSize: '12pt', lineHeight: '1.5', marginBottom: '6pt' },
      '.indent-2': { textIndent: '2em' },
      // 📜 密封线试卷专属样式
      // 标准试卷样式（A4 + 上下 2cm、左右 2.35cm 页边距）：
      //   .sealed-wrapper = A4 页面壳（上下 2cm、左右 2.35cm 边距，正文不被挤压，虚线不贴正文）；
      //   .seal-zone 绝对定位于左侧页边距内（纸边 0~20mm，正文内边距外侧）；
      //   虚线在 19mm、与上下边距对齐（20~277mm）；线(上1/4=84mm)/封(中=148mm)/密(下1/4=213mm) 均匀嵌在虚线上（右缘贴线）；
      //   提示语/信息栏向密封线靠拢（x=8mm）并垂直居中于上下边距中间（两组间留 6mm 间距）；
      //   .seal-note/.seal-info/.seal-char 逆时针旋转 90°（字头朝左、从下往上读）；
      //   字号分级：提示语 12pt bold、信息栏 12pt、密/封/线 10.5pt bold（与导出端一致）
      '.sealed-wrapper': {
        position: 'relative',
        padding: '20mm 25mm',
        minHeight: '100%',
        boxSizing: 'border-box'
      },
      '.sealed-wrapper > .seal-zone': {
        position: 'absolute',
        left: '0',
        top: '0',
        bottom: '0',
        width: '20mm',
        boxSizing: 'border-box'
      },
      '.seal-zone > .seal-line': {
        position: 'absolute',
        top: '20mm',
        bottom: '20mm',
        right: '1mm',
        borderLeft: '1.4px dashed #000'
      },
      '.seal-zone > .seal-note': {
        position: 'absolute',
        left: '8mm',
        top: '76.2mm',
        transformOrigin: 'left top',
        transform: 'rotate(-90deg)',
        whiteSpace: 'nowrap',
        fontSize: '12pt',
        fontWeight: 'bold',
        lineHeight: '1'
      },
      '.seal-zone > .seal-info': {
        position: 'absolute',
        left: '8mm',
        top: '254.7mm',
        transformOrigin: 'left top',
        transform: 'rotate(-90deg)',
        whiteSpace: 'nowrap',
        fontSize: '12pt',
        lineHeight: '1'
      },
      '.seal-zone > .seal-char': {
        position: 'absolute',
        right: '1mm',
        fontSize: '10.5pt',
        fontWeight: 'bold',
        lineHeight: '1',
        transformOrigin: 'center',
        transform: 'rotate(-90deg)'
      },
      '.seal-zone > .seal-char.s-top': {
        top: '82.4mm'
      },
      '.seal-zone > .seal-char.s-mid': {
        top: '146.6mm'
      },
      '.seal-zone > .seal-char.s-bot': {
        top: '210.9mm'
      },
      '.seal-zone p': {
        margin: '0'
      },
      '.sealed-wrapper > .sealed-content': {
        marginLeft: '0',
        boxSizing: 'border-box'
      },
      // 📜 卷面固定件：注意事项 + 题号得分表（排版模块统一注入，字号对齐模板 12pt）
      '.exam-notice': {
        fontSize: '12pt',
        lineHeight: '1.9',
        margin: '4pt 0 8pt'
      },
      '.exam-notice .notice-title': {
        fontWeight: 'bold',
        margin: '0'
      },
      '.exam-notice .notice-item': {
        margin: '0'
      },
      '.exam-score-table': {
        width: '100%',
        borderCollapse: 'collapse',
        marginBottom: '10pt',
        fontSize: '12pt'
      },
      '.exam-score-table th, .exam-score-table td': {
        border: '1px solid #000',
        textAlign: 'center',
        padding: '2px 0',
        lineHeight: '1.15'
      },
      '.exam-score-table th': {
        fontWeight: 'bold',
        fontFamily: "'黑体','SimHei',sans-serif"
      },
      '.exam-info': {
        display: 'flex',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '8px',
        margin: '15px 0',
        padding: '10px 14px',
        border: '1px solid #999',
        background: '#fafafa',
        borderRadius: '4px',
        fontSize: '11pt'
      },
      '.exam-info .info-item': {
        display: 'flex',
        gap: '4px',
        alignItems: 'baseline'
      },
      '.exam-info .info-label': {
        fontWeight: 'bold',
        color: '#1e3a6f'
      },
      '.exam-info .info-value': {
        borderBottom: '1px solid #333',
        minWidth: '60px',
        padding: '0 8px'
      },
      '.score-table': {
        width: '100%',
        borderCollapse: 'collapse',
        margin: '15px 0'
      },
      '.score-table td, .score-table th': {
        border: '1px solid #333',
        padding: '6px 8px',
        textAlign: 'center',
        fontSize: '11pt'
      },
      '.score-table th': {
        background: '#e8eaf6',
        fontWeight: 'bold'
      },
      '.score-table .total-score': {
        fontWeight: 'bold',
        fontSize: '13pt',
        color: '#c62828'
      }
    }
  }  
];

// ==================== 自定义主题存储 ====================
const STORAGE_KEY = 'custom_themes';

export const loadCustomThemes = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    console.error('加载自定义主题失败:', e);
    return [];
  }
};

export const saveCustomThemes = (themes) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(themes));
  } catch (e) {
    console.error('保存自定义主题失败:', e);
  }
};

// ==================== 获取所有主题 ====================
export const getAllThemes = () => {
  const customThemes = loadCustomThemes();
  return [...themes, ...customThemes];
};

// ==================== 根据ID获取主题 ====================
export const getThemeById = (id) => {
  const allThemes = getAllThemes();
  return allThemes.find(t => t.id === id);
};

// ==================== 添加自定义主题 ====================
export const addCustomTheme = (themeData) => {
  const customThemes = loadCustomThemes();
  const newTheme = {
    ...themeData,
    id: 'custom_' + Date.now(),
    type: 'custom',
    group: '自定义',
    titleFont: themeData.titleFont || 'SimHei, Microsoft YaHei, sans-serif',
    bodyFont: themeData.bodyFont || 'SimSun, Microsoft YaHei, sans-serif',
    bodySize: themeData.bodySize || 14,
    lineHeight: themeData.lineHeight || 1.6,
    pageMargin: themeData.pageMargin || '20px',
    styles: themeData.styles || {}
  };
  
  // 根据颜色主题设置颜色
  const colorThemes = {
    original: { title: '#1e3a6f', heading1: '#1e3a6f', heading2: '#2b5ea7', heading3: '#3a7bd5', tableHeader: '#1e3a6f', tableOdd: '#f5f9ff' },
    warm: { title: '#b85c00', heading1: '#b85c00', heading2: '#d47a00', heading3: '#e89a00', tableHeader: '#b85c00', tableOdd: '#fff5e6' },
    fresh: { title: '#2e7d32', heading1: '#2e7d32', heading2: '#43a047', heading3: '#66bb6a', tableHeader: '#2e7d32', tableOdd: '#e8f5e9' },
    academic: { title: '#5e35b1', heading1: '#5e35b1', heading2: '#7e57c2', heading3: '#9575cd', tableHeader: '#5e35b1', tableOdd: '#ede7f6' }
  };
  
  const colors = colorThemes[themeData.colorTheme] || colorThemes.original;
  newTheme.titleColor = colors.title;
  newTheme.heading1Color = colors.heading1;
  newTheme.heading2Color = colors.heading2;
  newTheme.heading3Color = colors.heading3;
  newTheme.tableHeaderBg = colors.tableHeader;
  newTheme.tableOddRowBg = colors.tableOdd;
  newTheme.tableHeaderColor = '#ffffff';
  newTheme.tableEvenRowBg = '#ffffff';
  newTheme.bodyColor = '#000000';
  
  customThemes.push(newTheme);
  saveCustomThemes(customThemes);
  return newTheme;
};

// ==================== 更新自定义主题 ====================
export const updateCustomTheme = (id, themeData) => {
  const customThemes = loadCustomThemes();
  const index = customThemes.findIndex(t => t.id === id);
  if (index !== -1) {
    customThemes[index] = { ...customThemes[index], ...themeData };
    saveCustomThemes(customThemes);
    return true;
  }
  return false;
};

// ==================== 删除自定义主题 ====================
export const deleteCustomTheme = (id) => {
  const customThemes = loadCustomThemes();
  const filtered = customThemes.filter(t => t.id !== id);
  saveCustomThemes(filtered);
  return true;
};

// ==================== 默认主题ID ====================
export const defaultThemeId = 'original_standard';

// ==================== 主题选项（用于下拉菜单） ====================
export const themeOptions = [
  // 我的样式组
  { value: 'original_standard', label: '📝 我的标准样式', group: '我的样式' },
  { value: 'original_warm', label: '🔴 我的暖色样式', group: '我的样式' },
  { value: 'original_fresh', label: '🌿 我的清新样式', group: '我的样式' },
  // 小学组
  { value: 'primary_exam', label: '📝 小学试卷', group: '小学' },
  { value: 'primary_practice', label: '📚 小学课时练', group: '小学' },
  { value: 'primary_summary', label: '📖 小学知识点', group: '小学' },
  // 初中组
  { value: 'middle_exam', label: '📝 初中试卷', group: '初中' },
  { value: 'middle_practice', label: '📚 初中课时练', group: '初中' },
  { value: 'middle_summary', label: '📖 初中知识点', group: '初中' },
  // 高中组
  { value: 'high_exam', label: '📝 高中试卷', group: '高中' },
  { value: 'high_practice', label: '📚 高中课时练', group: '高中' },
  { value: 'high_summary', label: '📖 高中知识点', group: '高中' },
  // 特殊类型
  { value: 'teaching_plan', label: '📋 教案设计', group: '特殊' },
  { value: 'error_book', label: '🔖 错题本', group: '特殊' },
  { value: 'study_note', label: '📒 学霸笔记', group: '特殊' },
  { value: 'sealed_exam', label: '📜 密封线试卷', group: '特殊' }
];

// ==================== 智能标题识别规则 ====================
// 层级标准（对齐中文教育文档规范）：
//   H1 — 文档主标题：第X章/课/单元（文档级大标题，不包含"一、"编号前缀）
//   H2 — 一级章节：一、/二、/（一）/Unit 1/Chapter 1/专题X/第X节（大板块）
//   H3 — 二级子节：1./2./(1)/①/1.1/A. （题目组/小节）
//   H4 — 三级细节：a./(1)/⑴（选项级/细节标题）
export const headingDetectionRules = {
  // 一级标题（文档级：第X章/课/单元/节）
  heading1: [
    /^第[0-9一二三四五六七八九十]+(?:章|节|单元|课)[\s\u00A0]*/,  // 第X章/单元/课/节（多字匹配+可选空格）
  ],
  // 二级标题（大板块：中文"一、"、英文Unit/Chapter、专题）
  heading2: [
    /^[一二三四五六七八九十]+[、．.]/,                     // 一、选择题
    /^[（(][一二三四五][）)][\s\u00A0]*/,                 // (一)
    /^第[0-9]+[节][\s\u00A0]+/,                          // 第X节 xxx
    /^Unit\s+[0-9]+/i,                                    // Unit 1
    /^Chapter\s+[0-9]+/i,                                 // Chapter 1
    /^Module\s+[0-9]+/i,                                  // Module 1
    /^专题[一二三四五六七八九十0-9]+/,                        // 专题一
    /^Lesson\s+[0-9]+/i,                                  // Lesson 1
    /^Section\s+[0-9]+/i,                                 // Section 1
    /^第[0-9一二三四五六七八九十]+部分[\s\u00A0]*/,       // 第一部分
  ],
  // 三级标题（子节/题目组：阿拉伯数字、大写字母）
  heading3: [
    /^[0-9]+[\、．.][\s\u00A0]*[^0-9]/,                  // 1. xxx / 1、xxx
    /^[（(][0-9]+[）)][\s\u00A0]*/,                       // (1)
    /^[0-9]+\.[0-9]+[\s\u00A0]*/,                        // 1.1
    /^[A-Z][\.、．][\s\u00A0]/,                             // A. xxx
  ],
  // 四级标题（细节级：圈号/小写字母/括号数字 — 可能是正文，需短文本确认）
  heading4: [
    /^[①②③④⑤⑥⑦⑧⑨⑩][\s\u00A0]*/,                  // ①
    /^[a-z][\.、．][\s\u00A0]/,                           // a. xxx
    /^[⑴⑵⑶⑷⑸⑹⑺⑻⑼⑽][\s\u00A0]*/,                  // ⑴
    /^\([0-9]+\)[\s\u00A0]*/,                             // (1)
  ]
};

// ==================== 将Markdown/纯文本转换为HTML ====================
export const markdownToHtml = (content) => {
  let html = content;
  
  // 标题（🔧 修复：只匹配行首的 #，且 # 后必须有空格，避免匹配 #1 等编号）
  html = html.replace(/^###\s+(.*$)/gim, '<h3 class="heading2">$1</h3>');
  html = html.replace(/^##\s+(.*$)/gim, '<h2 class="heading1">$1</h2>');
  html = html.replace(/^#\s+(.*$)/gim, '<h1 class="main-title">$1</h1>');
  
  // 粗体、斜体
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  
  // 转换 $...$ 公式标记为可读文本
  html = convertFormulasInHtml(html);
  
  // 列表（🔧 修复：更精确的列表匹配）
  html = html.replace(/^\s*-\s+(.*$)/gim, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
  
  // 段落
  const paragraphs = html.split('\n\n');
  html = paragraphs.map(p => {
    if (p.startsWith('<h') || p.startsWith('<ul')) return p;
    return `<p class="normal-paragraph indent-2">${p}</p>`;
  }).join('\n');
  
  // 换行
  html = html.replace(/\n/g, '<br>');
  
  return html;
};

// ==================== 智能识别并转换 HTML 标题标签 ====================
// ⚠️ Tiptap 解析 HTML 时按 schema 只保留属性，class 会被全部丢弃
//    所以这里必须把匹配的 <p>/<div> 直接替换为真的 <h1>/<h2>/<h3> 标签
//    这样 Tiptap 才能解析为 Heading 节点，主题 CSS 的 h1/h2 选择器才能命中
export const convertHtmlToHeadings = (htmlContent) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');
  
  // 🔧 从内联样式推断是否为标题（mammoth 常生成 <p style="font-weight:bold;text-align:center;font-size:16pt">）
  const styleLooksLikeHeading = (el) => {
    const style = (el.getAttribute('style') || '').toLowerCase();
    if (!style) return null;
    // 粗体 + 居中 或 字体明显偏大（≥14pt） → 大概率是标题
    const isBold = /font-weight\s*:\s*(bold|[6-9]00)/.test(style);
    const isCentered = /text-align\s*:\s*center/.test(style);
    const hasLargeFont = /font-size\s*:\s*(1[4-9]|[2-9]\d)\s*pt/.test(style);
    if ((isBold && isCentered) || (hasLargeFont && isBold)) return true;
    // 单独居中 + 大字号也算标题候选
    if (isCentered && hasLargeFont) return true;
    return null;
  };

  // 🔧 内容判断：检测文本是否像正文（而非标题）
  //    避免把正则匹配到但实质是正文的段落误升为标题
  const looksLikeBodyContent = (text) => {
    if (!text) return false;
    // 长文本（>60字）→ 极大概率是正文
    if (text.length > 60) return true;
    // 句末标点是正文强特征（。！？…）
    if (/[。！？…]$/.test(text.trim())) return true;
    // 包含明显的主谓结构 → 正文（有"的"/"是"/"在"等虚词 + 较长）
    if (text.length > 35 && /[的是在了着]/g.test(text) && text.length > 35) return true;
    // 多句文本（包含至少2个句号/问号）→ 正文段落
    if ((text.match(/[。！？]/g) || []).length >= 2) return true;
    return false;
  };

  // 递归遍历所有块级元素，对匹配标题模式的元素替换标签
  const processElement = (el) => {
    // 只处理块级元素或可能是伪标题的元素
    const tag = el.tagName?.toLowerCase();
    if (!['p', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'b', 'li'].includes(tag)) {
      // 递归处理子元素
      for (const child of [...el.children]) {
        processElement(child);
      }
      return;
    }
    
    // 已经是真正的标题标签，跳过
    if (/^h[1-6]$/.test(tag)) return;
    
    const text = el.textContent.trim();
    if (!text || text.length > 120) return; // 太长的文字不可能是标题
    
    // 🔧 第一遍：文本模式匹配（编号型标题）
    let detectedLevel = null;
    
    for (let pattern of headingDetectionRules.heading1) {
      if (pattern.test(text)) {
        detectedLevel = 1;
        break;
      }
    }
    
    if (!detectedLevel) {
      for (let pattern of headingDetectionRules.heading2) {
        if (pattern.test(text)) {
          detectedLevel = 2;
          break;
        }
      }
    }
    
    if (!detectedLevel) {
      for (let pattern of headingDetectionRules.heading3) {
        if (pattern.test(text)) {
          detectedLevel = 3;
          break;
        }
      }
    }
    
    if (!detectedLevel) {
      for (let pattern of headingDetectionRules.heading4) {
        if (pattern.test(text)) {
          // 四级标题是最易误判的（①/a./(1) 可能只是正文内编号），只当短文本时才是标题
          if (text.length <= 30) {
            detectedLevel = 4;
          }
          break;
        }
      }
    }
    
    // 🔧 第二遍：内联样式匹配（mammoth 生成的粗体居中段落 → 标题）
    if (!detectedLevel && styleLooksLikeHeading(el)) {
      // 纯样式标题默认为二级标题（最常见场景：章节名用 Word 样式而非编号）
      detectedLevel = 2;
    }
    
    // 🔧 第三遍：子元素包裹检测（<p><strong>标题文字</strong></p>）
    if (!detectedLevel && (tag === 'p' || tag === 'div')) {
      const firstChild = el.children[0];
      if (firstChild && (firstChild.tagName === 'STRONG' || firstChild.tagName === 'B')) {
        const strongText = firstChild.textContent.trim();
        // 如果 strong 包裹的文字占比超过 70%，很可能是标题
        if (strongText.length > 0 && strongText.length / text.length > 0.7) {
          for (let pattern of headingDetectionRules.heading1) {
            if (pattern.test(strongText)) { detectedLevel = 1; break; }
          }
          if (!detectedLevel) {
            for (let pattern of headingDetectionRules.heading2) {
              if (pattern.test(strongText)) { detectedLevel = 2; break; }
            }
          }
          if (!detectedLevel) {
            for (let pattern of headingDetectionRules.heading3) {
              if (pattern.test(strongText)) { detectedLevel = 3; break; }
            }
          }
          // 粗体包裹 + 短文本（≤30字）也视为标题
          if (!detectedLevel && strongText.length <= 30) {
            detectedLevel = 2;
          }
        }
      }
    }
    
    // 🔧 正文否决：即使正则匹配到标题模式，如果内容特征像正文（句末标点/长句/多句），
    //             不做标题提升。例如 "① 这是一个包含完整句子并且以句号结尾的内容。" → 保持为 p
    if (detectedLevel && looksLikeBodyContent(text)) {
      detectedLevel = null;
    }
    
    // 替换标签
    if (detectedLevel) {
      const newEl = doc.createElement(`h${detectedLevel}`);
      // 保留内部 HTML（包括 <strong>、<span> 等行内元素）
      newEl.innerHTML = el.innerHTML;
      // 🔧 保留原元素的 inline style（text-align 等 — Tiptap TextAlign 扩展可解析）
      const origStyle = el.getAttribute('style');
      if (origStyle) {
        newEl.setAttribute('style', origStyle);
      }
      el.replaceWith(newEl);
    } else if (tag === 'div' || tag === 'li') {
      // 🔧 div/li 不是标题但可能包含子标题，递归处理子元素
      for (const child of [...el.children]) {
        processElement(child);
      }
    }
    // p/span/strong/b 不是标题就不用递归（子元素是行内的，保持原样即可）
  };
  
  // 从 body 的直接子元素开始处理
  for (const child of [...doc.body.children]) {
    processElement(child);
  }

  const result = doc.body.innerHTML;
  console.log(`📐 [convertHtmlToHeadings] 完成，输入=${htmlContent.length}字符，输出=${result.length}字符`);
  return result;
};

// ==================== 智能识别并应用标题样式（仅用于导出预览，不适合 Tiptap 编辑器） ====================
export const applyIntelligentHeadings = (htmlContent) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');
  const elements = doc.body.children;
  
  let inContext = false;
  
  for (let el of elements) {
    const text = el.textContent.trim();
    if (!text) continue;
    
    // 跳过已标记的元素
    if (el.classList.contains('main-title') || 
        el.classList.contains('heading1') || 
        el.classList.contains('heading2') || 
        el.classList.contains('heading3')) continue;
    
    // 检测标题级别
    let detectedLevel = null;
    
    for (let pattern of headingDetectionRules.heading1) {
      if (pattern.test(text)) {
        detectedLevel = 'heading1';
        inContext = true;
        break;
      }
    }
    
    if (!detectedLevel) {
      for (let pattern of headingDetectionRules.heading2) {
        if (pattern.test(text)) {
          detectedLevel = inContext ? 'heading2' : 'heading1';
          break;
        }
      }
    }
    
    if (!detectedLevel) {
      for (let pattern of headingDetectionRules.heading3) {
        if (pattern.test(text)) {
          detectedLevel = 'heading3';
          break;
        }
      }
    }
    
    // 应用样式
    if (detectedLevel) {
      el.classList.add(detectedLevel);
    } else {
      // 正文
      if (!el.classList.contains('normal-paragraph')) {
        el.classList.add('normal-paragraph');
        el.classList.add('indent-2');
      }
    }
  }
  
  return doc.body.innerHTML;
};

// ==================== 主题标题样式查询 ====================
/**
 * 获取指定层级标题对应的主题样式（用于 DOCX 导出等场景）
 * @param {Object} theme - 主题对象
 * @param {number} level - 标题层级 1-4
 * @returns {Object|null} { fontSize, fontWeight, color, textAlign, fontFamily } 或 null
 * 
 * 标题 → CSS类映射（与 applyThemeToContent 中 HTML 原生元素映射一致）:
 *   h1/一级 → .main-title
 *   h2/二级 → .heading1
 *   h3/三级 → .heading2
 *   h4/四级 → .heading3
 */
export const getThemeHeadingStyle = (theme, level) => {
  if (!theme) return null;
  
  const selectorMap = {
    1: '.main-title',
    2: '.heading1',
    3: '.heading2',
    4: '.heading3'
  };
  
  const selector = selectorMap[level];
  if (!selector) return null;
  
  const style = theme.styles?.[selector];
  if (!style) return null;
  
  // 返回标准化样式对象
  return {
    fontSize: style.fontSize || `${theme.bodySize}pt`,
    fontWeight: style.fontWeight || 'normal',
    color: style.color || theme.bodyColor || '#333333',
    textAlign: style.textAlign || 'left',
    // 如果主题定义了标题字体则使用标题字体，否则回退到正文字体
    fontFamily: theme.titleFont || theme.bodyFont || 'SimHei, Microsoft YaHei, sans-serif'
  };
};

// ==================== 应用主题到HTML内容 ====================
export const applyThemeToContent = (content, themeId, options = {}) => {
  const { isHtmlContent = false, forceImportant = false, stage: stageOpt } = options;
  const theme = getThemeById(themeId);
  // 🔧 作文格尺寸按学段（来自排版规格库 ZUOWEN_CELL：主12/初10/高7.5×8；每行格数 CSS auto-fill 自动排满）
  const stage = theme?.stage || stageOpt || 'middle';
  const zwgKey = normalizeStage3(stage);
  const ZC = getMergedSpec().ZUOWEN_CELL;
  const zwgMm = ZC[zwgKey].heightMm;   // 格高（主/初正方、高8mm）
  const zwgMmW = ZC[zwgKey].widthMm;   // 格宽（主12/初10/7.5）
  // 🔧 方格纸/括号格尺寸（来自排版规格库 SQUARE_GRID / BRACKET_GRID）
  const spec = getMergedSpec();
  const sg = spec.SQUARE_GRID.primary || { cols: 12, rows: 8, cellMm: 7 };
  const sgW = Math.round(sg.cols * sg.cellMm);
  const sgH = Math.round(sg.rows * sg.cellMm);
  const bg = spec.BRACKET_GRID;
  const sgBg = `${sg.cellMm}mm ${sg.cellMm}mm`;
  // 🔧 书写格尺寸按学段（来自排版规格库 GRID_CELL：田字格/米字格 主12/初9/高8mm；四线三格/拼音格行高 9/8mm）
  const GRD = spec.GRID_CELL || {};
  const gcKey = GRD['tian-zi-ge']?.[zwgKey] ? zwgKey : (GRD['tian-zi-ge']?.middle ? 'middle' : 'primary');
  const tzW = GRD['tian-zi-ge']?.[gcKey]?.widthMm ?? 10;
  const tzH = GRD['tian-zi-ge']?.[gcKey]?.heightMm ?? 10;
  const mzW = GRD['mi-zi-ge']?.[gcKey]?.widthMm ?? tzW;
  const mzH = GRD['mi-zi-ge']?.[gcKey]?.heightMm ?? tzH;
  const fltH = GRD['four-line-three']?.[gcKey]?.lineHeightMm ?? 9;
  const pyH = GRD['pinyin-line']?.[gcKey]?.lineHeightMm ?? 9;
  
  // 🔧 无样式：不应用任何主题 CSS，仅返回纯净 HTML 包装
  if (!theme) {
    const styleTag = `<style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: SimSun, 'Microsoft YaHei', serif; font-size: 12pt; line-height: 1.6; margin: 20px; background: white; color: #1e1e1e; }
      ul, ol { padding-left: 2em; }
      li { display: list-item; }
      h1, h2, h3, h4 { page-break-after: avoid; }
      table, figure, pre, blockquote { page-break-inside: avoid; }
      .no-print { display: none !important; }
      /* 田字格（无样式模式也需渲染，⭐ inline-block + text-align 居中 + line-height，保证无内层span时也能居中；尺寸按学段 GRID_CELL mm） */
      .tian-zi-ge { display: inline-block; position: relative; width: ${tzW}mm; height: ${tzH}mm; border: 1.5px solid #5B9BD5; vertical-align: middle; margin: 2px 4px; font-size: inherit !important; box-sizing: border-box; text-align: center; line-height: ${tzH}mm; background: repeating-linear-gradient(to right,#5B9BD5 0px,#5B9BD5 3px,transparent 3px,transparent 6px) center/100% 0.5px no-repeat,repeating-linear-gradient(to bottom,#5B9BD5 0px,#5B9BD5 3px,transparent 3px,transparent 6px) center/0.5px 100% no-repeat; }
      .tian-zi-ge>span { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); line-height: 1; white-space: nowrap; }
      /* 四线三格 + 其他特殊格式（行高按学段 GRID_CELL mm） */
      .four-line-three { display: inline-block; position: relative; padding: 4px 4px; font-family: 'Times New Roman', 'Georgia', SimSun, serif; font-size: inherit !important; line-height: 1; min-width: 18px; text-align: center; vertical-align: middle; text-indent: 0; }
      .four-line-three::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: ${fltH}mm; background: linear-gradient(#999,#999) 0 ${(fltH * 0.067).toFixed(1)}mm/100% 1px no-repeat, linear-gradient(#999,#999) 0 ${(fltH * 0.367).toFixed(1)}mm/100% 1px no-repeat, linear-gradient(#666,#666) 0 ${(fltH * 0.667).toFixed(1)}mm/100% 1px no-repeat, linear-gradient(#999,#999) 0 ${(fltH * 0.967).toFixed(1)}mm/100% 1px no-repeat; pointer-events: none; }
      .sixian-ge { display: inline-block; position: relative; padding: 4px 4px; font-family: 'Times New Roman', 'Microsoft YaHei', SimSun, serif; font-size: inherit !important; line-height: 1; min-width: 18px; text-align: center; vertical-align: middle; text-indent: 0; }
      .sixian-ge::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: ${fltH}mm; background: linear-gradient(#999,#999) 0 ${(fltH * 0.067).toFixed(1)}mm/100% 1px no-repeat, linear-gradient(#999,#999) 0 ${(fltH * 0.367).toFixed(1)}mm/100% 1px no-repeat, linear-gradient(#666,#666) 0 ${(fltH * 0.667).toFixed(1)}mm/100% 1px no-repeat, linear-gradient(#999,#999) 0 ${(fltH * 0.967).toFixed(1)}mm/100% 1px no-repeat; pointer-events: none; }
      .mi-zi-ge { display: inline-block; position: relative; width: ${mzW}mm; height: ${mzH}mm; border: 1.5px solid #5B9BD5; vertical-align: middle; margin: 0 1px; font-size: inherit !important; font-family: 'KaiTi', 'SimSun', serif; box-sizing: border-box; text-align: center; line-height: ${mzH}mm; background: repeating-linear-gradient(to right,#5B9BD5 0px,#5B9BD5 3px,transparent 3px,transparent 6px) center/100% 0.5px no-repeat,repeating-linear-gradient(to bottom,#5B9BD5 0px,#5B9BD5 3px,transparent 3px,transparent 6px) center/0.5px 100% no-repeat,repeating-linear-gradient(to top right,#5B9BD5 0px,#5B9BD5 3px,transparent 3px,transparent 6px) center/0.5px 100% no-repeat,repeating-linear-gradient(to bottom right,#5B9BD5 0px,#5B9BD5 3px,transparent 3px,transparent 6px) center/0.5px 100% no-repeat; }
      .mi-zi-ge>span { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); line-height: 1; white-space: nowrap; }
      .oral-box { display: inline-block; border: 1.5px solid #999; padding: 2px 6px; min-width: 3em; text-align: center; font-size: inherit !important; }
      .square-box { display: inline-block; border: 2px solid #333; padding: 2px 8px; min-width: 2em; text-align: center; font-size: inherit !important; }
      .zuo-wen-ge { display: grid; grid-template-columns: repeat(auto-fill, ${zwgMmW}mm); gap: 0; border: 1.5px solid #999; margin: 8px 0; width: 100%; }
      .zuo-wen-ge span { display: inline-flex; align-items: center; justify-content: center; width: ${zwgMmW}mm; height: ${zwgMm}mm; border: 0.5px solid #e0e0e0; font-size: inherit !important; }
      .square-grid { width: ${sgW}mm; height: ${sgH}mm; border: 1.5px solid #999; margin: 8px 0; background: linear-gradient(#d5d5dc 1px, transparent 1px) 0 0 / ${sgBg} no-repeat, linear-gradient(90deg, #d5d5dc 1px, transparent 1px) 0 0 / ${sgBg}; }
      .bracket-grid { display: grid; grid-template-rows: repeat(3, ${bg.rowHeightMm}mm); width: ${bg.widthMm}mm; margin: 8px 0; border-left: 3px solid #333; border-right: 3px solid #333; }
      .bracket-grid > div { border-bottom: 0.5px solid #ccc; }
      .bracket-grid > div:last-child { border-bottom: none; }
      /* 填空横线 */
      u[class*="blank-"] { display: inline-block; text-align: center; text-decoration: none; border-bottom: 1.5px solid #333; padding: 0 2px; font-size: inherit !important; min-width: 1em; }
      u.blank-1 { min-width: 1em; } u.blank-2 { min-width: 2em; }
      u.blank-3 { min-width: 3em; } u.blank-4 { min-width: 4em; }
      u.blank-5 { min-width: 5em; } u.blank-6 { min-width: 6em; }
      u.blank-8 { min-width: 8em; } u.blank-10 { min-width: 10em; }
      /* 括号间距——仅占宽度，无下划线 */
      span[class*="blank-"] { display: inline-block; }
    </style>`;
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${styleTag}
</head>
<body>
  ${content}
</body>
</html>`;
  }
  
  // 构建样式
  let styleTag = `<style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: ${theme.bodyFont};
      font-size: ${theme.bodySize}pt;
      line-height: ${theme.lineHeight};
      margin: ${theme.pageMargin};
      background: white;
      color: #1e1e1e;
    }
    ul, ol { padding-left: 2em; }
    li { display: list-item; }
  `;
  
  // 🔧 默认表格表头样式：预览中底纹由编辑器 CSS 提供（.rich-text-editor :deep(table th) { background: #f0f4f8 }），
  //    导出时编辑器 CSS 不会带入，因此在此显式声明默认底纹。
  //    如果主题 styles 中包含 th 规则（如 th { backgroundColor: '#xxx' }），后面的 CSS 会自然覆盖此默认值。
  styleTag += `th { background-color: #f0f4f8; font-weight: 600; }\n`;
  
  // 添加所有样式规则
  if (theme.styles) {
    for (const [selector, rules] of Object.entries(theme.styles)) {
      styleTag += `${selector} { `;
      for (const [prop, value] of Object.entries(rules)) {
        // 转换驼峰为连字符
        const cssProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
        styleTag += `${cssProp}: ${value}; `;
      }
      styleTag += `}\n`;
    }
  }
  
  // 添加列表样式
  styleTag += `
    ul, ol { margin-left: 2em; }
    li { font-family: ${theme.bodyFont}; font-size: ${theme.bodySize}pt; }
    .no-bullet { list-style: none !important; }
    .text-bullet { list-style: none !important; }
    .text-bullet::before { content: attr(data-marker); margin-right: 0.5em; }
  `;
  
  // ========== 特殊标记样式（全学科通用） ==========
  styleTag += `
    /* ⭐ 田字格/米字格 - 小学语文（inline-block + text-align 居中，无内层span也能居中；尺寸按学段 GRID_CELL mm） */
    .tian-zi-ge { display: inline-block; position: relative; width: ${tzW}mm; height: ${tzH}mm; border: 1.5px solid #999; vertical-align: middle; margin: 2px 4px; font-size: inherit !important; box-sizing: border-box; text-align: center; line-height: ${tzH}mm; background: linear-gradient(to right,transparent calc(50% - 0.5px),#ccc calc(50% - 0.5px),#ccc calc(50% + 0.5px),transparent calc(50% + 0.5px)),linear-gradient(to bottom,transparent calc(50% - 0.5px),#ccc calc(50% - 0.5px),#ccc calc(50% + 0.5px),transparent calc(50% + 0.5px)); }
    .tian-zi-ge>span { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); line-height: 1; white-space: nowrap; }
    .mi-zi-ge { display: inline-block; position: relative; width: ${mzW}mm; height: ${mzH}mm; border: 1.5px solid #999; vertical-align: middle; margin: 0 1px; font-size: inherit !important; font-family: 'KaiTi', 'SimSun', serif; box-sizing: border-box; text-align: center; line-height: ${mzH}mm; background: linear-gradient(to right,transparent calc(50% - 0.5px),#ccc calc(50% - 0.5px),#ccc calc(50% + 0.5px),transparent calc(50% + 0.5px)),linear-gradient(to bottom,transparent calc(50% - 0.5px),#ccc calc(50% - 0.5px),#ccc calc(50% + 0.5px),transparent calc(50% + 0.5px)),linear-gradient(to top right,transparent calc(50% - 0.5px),#ccc calc(50% - 0.5px),#ccc calc(50% + 0.5px),transparent calc(50% + 0.5px)),linear-gradient(to bottom right,transparent calc(50% - 0.5px),#ccc calc(50% - 0.5px),#ccc calc(50% + 0.5px),transparent calc(50% + 0.5px)); }
    .mi-zi-ge>span { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); line-height: 1; white-space: nowrap; }
    /* ⭐ 四线三格 - 英语（行高按学段 GRID_CELL mm） */
    .four-line-three { display: inline-block; position: relative; padding: 4px 4px; font-family: 'Times New Roman', 'Georgia', SimSun, serif; font-size: inherit !important; line-height: 1; min-width: 18px; text-align: center; vertical-align: middle; text-indent: 0; }
    .four-line-three::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: ${fltH}mm; background: linear-gradient(#999,#999) 0 ${(fltH * 0.067).toFixed(1)}mm/100% 1px no-repeat, linear-gradient(#999,#999) 0 ${(fltH * 0.367).toFixed(1)}mm/100% 1px no-repeat, linear-gradient(#666,#666) 0 ${(fltH * 0.667).toFixed(1)}mm/100% 1px no-repeat, linear-gradient(#999,#999) 0 ${(fltH * 0.967).toFixed(1)}mm/100% 1px no-repeat; pointer-events: none; }
    .sixian-ge { display: inline-block; position: relative; padding: 4px 4px; font-family: 'Times New Roman', 'Microsoft YaHei', SimSun, serif; font-size: inherit !important; line-height: 1; min-width: 18px; text-align: center; vertical-align: middle; text-indent: 0; }
    .sixian-ge::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: ${fltH}mm; background: linear-gradient(#999,#999) 0 ${(fltH * 0.067).toFixed(1)}mm/100% 1px no-repeat, linear-gradient(#999,#999) 0 ${(fltH * 0.367).toFixed(1)}mm/100% 1px no-repeat, linear-gradient(#666,#666) 0 ${(fltH * 0.667).toFixed(1)}mm/100% 1px no-repeat, linear-gradient(#999,#999) 0 ${(fltH * 0.967).toFixed(1)}mm/100% 1px no-repeat; pointer-events: none; }
    /* ⭐ 填空横线 */
    u[class*="blank-"] { display: inline-block; text-align: center; text-decoration: none; border-bottom: 1.5px solid #333; padding: 0 1px; font-size: inherit !important; min-width: 1em; }
    u.blank-1 { min-width: 1em; } u.blank-2 { min-width: 2em; }
    u.blank-3 { min-width: 3em; } u.blank-4 { min-width: 4em; }
    u.blank-5 { min-width: 5em; } u.blank-6 { min-width: 6em; }
    u.blank-8 { min-width: 8em; } u.blank-10 { min-width: 10em; }
    /* 括号间距——仅占宽度 */
    span[class*="blank-"] { display: inline-block; }
    /* ⭐ 口算框 / 方框 */
    .oral-box { display: inline-block; border: 1.5px solid #999; padding: 1px 3px; min-width: 3em; text-align: center; font-size: inherit !important; }
    .square-box { display: inline-block; border: 2px solid #333; padding: 1px 4px; min-width: 2em; text-align: center; font-size: inherit !important; }
    /* ⭐ 加点字 - 语文（text-emphasis 每字下方自动加点） */
    .emphasis-dot {
      text-emphasis: dot #d32f2f;
      -webkit-text-emphasis: dot #d32f2f;
      text-emphasis-position: under;
    }
    /* ⭐ 画线句子 - 语文 */
    .underline-sentence {
      text-decoration: underline;
      text-decoration-style: solid;
      text-underline-offset: 3px;
      text-decoration-thickness: 1.5px;
    }
    /* ⭐ 上标 - 数学/物理/化学 */
    .superscript {
      vertical-align: super;
      font-size: smaller;
      line-height: 0;
    }
    /* ⭐ 下标 - 数学/物理/化学 */
    .subscript {
      vertical-align: sub;
      font-size: smaller;
      line-height: 0;
    }
    /* ⭐ 拼音标注 - 小学语文（使用拼音体） */
    ruby {
      ruby-position: over;
      ruby-align: center;
    }
    rt {
      font-size: 0.6em;
      text-align: center;
      color: #666;
      font-family: 'Times New Roman', 'Microsoft YaHei', SimSun, serif;
    }

    /* ===== 新增强大排版样式 ===== */

    /* ⭐ 波浪线 - 语文病句修改 */
    .wavy-underline {
      text-decoration: underline;
      text-decoration-style: wavy;
      text-decoration-color: #d32f2f;
      text-underline-offset: 3px;
    }

    /* ⭐ 双线格 - 语文 */
    .double-line {
      text-decoration: underline;
      text-decoration-style: double;
      text-underline-offset: 3px;
    }

    /* ⭐ 单线格 - 语文 */
    .single-line {
      text-decoration: underline;
      text-decoration-style: solid;
      text-underline-offset: 3px;
    }

    /* ⭐ 部首标注 - 小学语文 */
    ruby.radical rb {
      font-size: 1em;
    }
    ruby.radical rt {
      font-size: 0.5em;
      color: #2b5ea7;
    }

    /* ⭐ 笔画笔顺 - 小学语文 */
    .stroke-order {
      display: inline-flex;
      align-items: flex-start;
      gap: 1px;
      vertical-align: baseline;
    }
    .stroke-order::after {
      content: attr(data-strokes) '\u753B';
      font-size: 0.55em;
      vertical-align: super;
      color: #888;
      line-height: 1;
      margin-left: 1px;
    }

    /* ⭐ 田字格 - 小学语文（⭐ inline-block + text-align 居中 + line-height，无内层span也能居中） */
    .tian-zi-ge {
      display: inline-block;
      position: relative;
      width: 1.8em;
      height: 1.8em;
      border: 1.5px solid #999;
      font-size: inherit !important;
      vertical-align: middle;
      margin: 2px 4px;
      box-sizing: border-box;
      text-align: center;
      line-height: 1.8em;
      background:
        linear-gradient(to right, transparent calc(50% - 0.5px), #ccc calc(50% - 0.5px), #ccc calc(50% + 0.5px), transparent calc(50% + 0.5px)),
        linear-gradient(to bottom, transparent calc(50% - 0.5px), #ccc calc(50% - 0.5px), #ccc calc(50% + 0.5px), transparent calc(50% + 0.5px));
    }
    .tian-zi-ge > span {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      line-height: 1;
      white-space: nowrap;
    }

    /* ⭐ 米字格 - 小学语文（同上结构 + 对角虚线 + text-align 居中） */
    .mi-zi-ge {
      display: inline-block;
      position: relative;
      width: 1.8em;
      height: 1.8em;
      border: 1.5px solid #999;
      font-family: 'KaiTi', 'SimSun', serif;
      font-size: inherit !important;
      vertical-align: middle;
      margin: 0 1px;
      box-sizing: border-box;
      text-align: center;
      line-height: 1.8em;
      background:
        linear-gradient(to right, transparent calc(50% - 0.5px), #ccc calc(50% - 0.5px), #ccc calc(50% + 0.5px), transparent calc(50% + 0.5px)),
        linear-gradient(to bottom, transparent calc(50% - 0.5px), #ccc calc(50% - 0.5px), #ccc calc(50% + 0.5px), transparent calc(50% + 0.5px)),
        linear-gradient(to top right, transparent calc(50% - 0.5px), #ccc calc(50% - 0.5px), #ccc calc(50% + 0.5px), transparent calc(50% + 0.5px)),
        linear-gradient(to bottom right, transparent calc(50% - 0.5px), #ccc calc(50% - 0.5px), #ccc calc(50% + 0.5px), transparent calc(50% + 0.5px));
    }
    .mi-zi-ge > span {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      line-height: 1;
      white-space: nowrap;
    }

    /* ⭐ 四线三格 - 英语/拼音（伪元素绘制4条等距线） */
    .four-line-three {
      display: inline-block;
      position: relative;
      padding: 4px 4px;
      font-family: 'Times New Roman', 'Georgia', SimSun, serif;
      font-size: inherit !important;
      line-height: 1;
      min-width: 18px;
      text-align: center;
      vertical-align: middle;
      text-indent: 0;
      overflow: visible;
    }
    .four-line-three::before {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      top: 0;
      height: 1.5em;
      background:
        linear-gradient(#999, #999) 0 0.1em / 100% 1px no-repeat,
        linear-gradient(#999, #999) 0 0.55em / 100% 1px no-repeat,
        linear-gradient(#666, #666) 0 1.0em / 100% 1px no-repeat,
        linear-gradient(#999, #999) 0 1.45em / 100% 1px no-repeat;
      pointer-events: none;
    }

    /* ⭐ 四线格（sixian-ge）- 拼音四线格别名，与 four-line-three 视觉一致 */
    .sixian-ge {
      display: inline-block;
      position: relative;
      padding: 4px 4px;
      font-family: 'Times New Roman', 'Microsoft YaHei', SimSun, serif;
      font-size: inherit !important;
      line-height: 1;
      min-width: 18px;
      text-align: center;
      vertical-align: middle;
      text-indent: 0;
      overflow: visible;
    }
    .sixian-ge::before {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      top: 0;
      height: 1.5em;
      background:
        linear-gradient(#999, #999) 0 0.1em / 100% 1px no-repeat,
        linear-gradient(#999, #999) 0 0.55em / 100% 1px no-repeat,
        linear-gradient(#666, #666) 0 1.0em / 100% 1px no-repeat,
        linear-gradient(#999, #999) 0 1.45em / 100% 1px no-repeat;
      pointer-events: none;
    }

    /* ⭐ 拼音格 - 使用 Times New Roman（拼音体专用） */
    .pinyin-line {
      font-family: 'Times New Roman', 'Microsoft YaHei', SimSun, serif;
    }
    /* ⭐ 英语书写格 - 使用 Times New Roman 印刷体（英语字母专用） */
    .english-line {
      font-family: 'Times New Roman', 'Georgia', serif;
    }

    /* ⭐ 作文格（尺寸取上方 ZUOWEN_CELL 变量：小学 12mm / 中考 10mm / 高考 宽7.5×高8mm；每行格数按容器宽度自动排满） */
    .zuo-wen-ge {
      display: grid;
      grid-template-columns: repeat(auto-fill, ${zwgMmW}mm);
      gap: 0;
      border: 1.5px solid #999;
      margin: 8px 0;
      width: 100%;
    }
    .zuo-wen-ge span {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: ${zwgMmW}mm;
      height: ${zwgMm}mm;
      border: 0.5px solid #ccc;
      font-family: 'SimSun', 'KaiTi', serif;
      font-size: inherit !important;
      line-height: ${zwgMm}mm;
      text-align: center;
    }

    /* ⭐ 作图网格区（数学操作题作答方格纸：尺寸取排版规格库 SQUARE_GRID） */
    .square-grid {
      width: ${sgW}mm;
      height: ${sgH}mm;
      border: 1.5px solid #999;
      margin: 8px 0;
      background:
        linear-gradient(#d5d5dc 1px, transparent 1px) 0 0 / ${sgBg},
        linear-gradient(90deg, #d5d5dc 1px, transparent 1px) 0 0 / ${sgBg};
    }

    /* ⭐ 花式竖式格（低段数学竖式计算括号格：行高/宽度取排版规格库 BRACKET_GRID） */
    .bracket-grid {
      display: grid;
      grid-template-rows: repeat(3, ${bg.rowHeightMm}mm);
      width: ${bg.widthMm}mm;
      margin: 8px 0;
      border-left: 3px solid #333;
      border-right: 3px solid #333;
    }
    .bracket-grid > div {
      border-bottom: 0.5px solid #ccc;
    }
    .bracket-grid > div:last-child {
      border-bottom: none;
    }

    /* ⭐ 口算框 - 小学数学 */
    .oral-box {
      display: inline-block;
      border: 1.5px solid #333;
      padding: 2px 8px;
      margin: 0 2px;
      min-width: 40px;
      text-align: center;
      vertical-align: middle;
      font-size: inherit !important;
    }
    .oral-box.blank {
      min-width: 50px;
      border-style: dashed;
      color: #999;
    }

    /* ⭐ 竖式计算 - 小学数学 */
    .vertical-calculation {
      display: inline-block;
      margin: 8px 16px;
      font-family: 'Courier New', monospace;
    }
    .vertical-calculation .vc-row {
      text-align: right;
      padding: 1px 8px;
      letter-spacing: 0.2em;
    }
    .vertical-calculation .vc-row.op {
      border-bottom: 1.5px solid #333;
      padding-bottom: 2px;
    }
    .vertical-calculation .vc-row.op::before {
      content: attr(data-op);
      float: left;
      margin-left: -4px;
    }
    .vertical-calculation .vc-result {
      text-align: right;
      padding: 2px 8px;
      letter-spacing: 0.2em;
      font-weight: bold;
    }

    /* ⭐ 脱式计算等号对齐 - 小学数学 */
    .off-formula {
      margin: 8px 0;
    }
    .off-formula .of-line {
      text-indent: 1.5em;
      line-height: 1.8;
    }

    /* ⭐ 连线题 - 英语/语文 */
    .match-question {
      display: flex;
      gap: 40px;
      margin: 12px 0;
    }
    .match-question .match-col {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .match-question .match-item {
      padding: 4px 16px;
      border: 1px solid #ccc;
      border-radius: 4px;
      cursor: pointer;
      min-width: 80px;
      text-align: center;
    }
    .match-question .match-item:hover {
      background: #f0f4ff;
      border-color: #2b5ea7;
    }

    /* ⭐ 词库框 - 完形填空 */
    .word-bank {
      display: inline-flex;
      flex-wrap: wrap;
      gap: 6px;
      padding: 8px 12px;
      border: 1.5px solid #666;
      border-radius: 4px;
      margin: 4px 0;
      background: #fafafa;
    }
    .word-bank .wb-item {
      display: inline-block;
      padding: 2px 10px;
      font-family: 'Times New Roman', serif;
      font-size: 0.9em;
      color: #333;
    }

    /* ⭐ 化学反应条件 - 化学 */
    .chem-condition {
      font-size: 0.7em;
      vertical-align: super;
      color: #555;
      line-height: 1;
    }

    /* ⭐ 密封线/装订线：标准试卷样式（A4 + 上下 2cm、左右 2.35cm 页边距）——
       页面壳 .sealed-wrapper 自带边距（正文不被挤压，虚线不贴正文）；
       密封区 .seal-zone 绝对定位于左侧页边距内（纸边 0~20mm），在正文内边距外侧；
       虚线在 19mm、与上下边距对齐（20~277mm）；线(上1/4=84mm)/封(中=148mm)/密(下1/4=213mm) 均匀嵌在虚线上（右缘贴线）；
       提示语/信息栏向密封线靠拢（x=8mm）并垂直居中于上下边距中间（两组间留 6mm 间距）；
       .seal-note/.seal-info/.seal-char 逆时针旋转 90°（字头朝左、从下往上读）；
      字号分级：提示语 12pt bold、信息栏 12pt、密/封/线 10.5pt bold */
    .sealed-wrapper {
      position: relative;
      padding: 20mm 25mm;
      min-height: 100%;
      box-sizing: border-box;
    }
    .sealed-wrapper > .seal-zone {
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 20mm;
      box-sizing: border-box;
    }
    .seal-zone > .seal-line {
      position: absolute;
      top: 20mm;
      bottom: 20mm;
      right: 1mm;
      border-left: 1.4px dashed #000;
    }
    .seal-zone > .seal-note {
      position: absolute;
      left: 8mm;
      top: 76.2mm;
      transform-origin: left top;
      transform: rotate(-90deg);
      white-space: nowrap;
      font-size: 12pt;
      font-weight: bold;
      line-height: 1;
    }
    .seal-zone > .seal-info {
      position: absolute;
      left: 8mm;
      top: 254.7mm;
      transform-origin: left top;
      transform: rotate(-90deg);
      white-space: nowrap;
      font-size: 12pt;
      line-height: 1;
    }
    .seal-zone > .seal-char {
      position: absolute;
      right: 1mm;
      font-size: 10.5pt;
      font-weight: bold;
      line-height: 1;
      transform-origin: center;
      transform: rotate(-90deg);
    }
    .seal-zone > .seal-char.s-top { top: 82.4mm; }
    .seal-zone > .seal-char.s-mid { top: 146.6mm; }
    .seal-zone > .seal-char.s-bot { top: 210.9mm; }
    .sealed-wrapper > .sealed-content {
      margin-left: 0;
      box-sizing: border-box;
    }
    .seal-zone p {
      margin: 0;
    }
    /* 📜 卷面固定件：注意事项 + 题号得分表（字号对齐模板 12pt） */
    .exam-notice {
      font-size: 12pt;
      line-height: 1.9;
      margin: 4pt 0 8pt;
    }
    .exam-notice .notice-title {
      font-weight: bold;
      margin: 0;
    }
    .exam-notice .notice-item {
      margin: 0;
    }
    .exam-score-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 10pt;
      font-size: 12pt;
    }
    .exam-score-table th,
    .exam-score-table td {
      border: 1px solid #000;
      text-align: center;
      padding: 2px 0;
      line-height: 1.15;
    }
    .exam-score-table th {
      font-weight: bold;
      font-family: '黑体', 'SimHei', sans-serif; /* 黑体真粗体：一/二/三等加粗肉眼可见（SimSun 假粗不可见） */
    }

    /* ⭐ 评分栏 - 表格形式（横竖线全有） */
    .score-board {
      display: inline-table;
      border-collapse: collapse;
      margin: 4px 0;
    }
    .score-board .sb-row {
      display: table-row;
    }
    .score-board .sb-label, .score-board .sb-value {
      display: table-cell;
      padding: 4px 16px;
      border: 1px solid #999;
      text-align: center;
    }
    .score-board .sb-label {
      font-size: 0.9em;
      color: #555;
      background: #f9f9f9;
    }
    .score-board .sb-value {
      font-weight: bold;
    }

    /* ⭐ 方框填空 - 数学填数字/符号 */
    .square-box {
      display: inline-block;
      border: 2px solid #333;
      min-width: 1.6em;
      height: 1.6em;
      text-align: center;
      line-height: 1.6em;
      vertical-align: middle;
      margin: 0 1px;
      padding: 0 3px;
      font-weight: bold;
      color: #333;
      font-size: inherit !important;
    }

    /* ⭐ 得分框 */
    .score-box {
      display: inline-block;
      border: 1.5px solid #333;
      padding: 3px 16px;
      text-align: center;
      min-width: 60px;
      font-weight: bold;
      font-size: inherit !important;
    }

    /* ⭐ 辅助线虚线 - 数学几何 */
    .dashed-line {
      display: inline-block;
      border-bottom: 1.5px dashed #999;
      min-width: 40px;
      margin: 0 2px;
    }

    /* ⭐ 元素周期表 - 化学 */
    table.periodic-table {
      border-collapse: collapse;
      margin: 8px auto;
      font-size: 0.75em;
    }
    table.periodic-table td,
    table.periodic-table th {
      border: 1px solid #333;
      padding: 2px 4px;
      text-align: center;
      min-width: 2.5em;
    }
    table.periodic-table .nonmetal { background: #c8e6c9; }
    table.periodic-table .metal { background: #ffcdd2; }
    table.periodic-table .transition { background: #ffe0b2; }
    table.periodic-table .noble-gas { background: #b3e5fc; }
    table.periodic-table .lanthanide { background: #f8bbd0; }
    table.periodic-table .actinide { background: #e1bee7; }

    /* ═══ 补充排版样式：dictation/reading/errorbook/summary  ═══ */

    /* 听写条目 */
    .dictation-item { display: flex; align-items: center; gap: 12px; padding: 8px 0; border-bottom: 1px dashed #ddd; min-height: 2.5em; }
    /* 间距 */
    .spacer { display: inline-block; width: 2em; }
    /* 阅读短文 */
    .reading-passage { padding: 16px 20px; background: #fafafa; border-left: 3px solid #2b5ea7; margin: 12px 0; line-height: 1.9; text-indent: 2em; }
    /* 作答空白 */
    .answer-blank { min-height: 3em; border-bottom: 1px dashed #bbb; margin: 8px 0; color: #999; font-size: 0.85em; }
    /* 拓展思考 */
    .extended-thinking { padding: 12px 16px; background: #fef9e7; border: 1px solid #f0c78e; border-radius: 6px; margin: 12px 0; }
    /* 思维导图 */
    .mindmap { padding: 16px; background: #f8f9ff; border: 1px solid #d0d7f0; border-radius: 8px; margin: 12px 0; }
    .mindmap ul { list-style: none; padding-left: 1.5em; margin: 4px 0; }
    .mindmap li { margin: 3px 0; position: relative; }
    .mindmap li::before { content: '\\25CF'; position: absolute; left: -1.2em; font-size: 0.6em; top: 0.4em; }
    /* 例题 + 解析 */
    .example { padding: 12px 16px; background: #f0f4ff; border-left: 3px solid #2b5ea7; margin: 10px 0; }
    .analysis { padding: 10px 16px; background: #e8f5e9; border-left: 3px solid #4caf50; margin: 8px 0 12px 0; font-size: 0.92em; }
    /* 公式 */
    .formula { text-align: center; padding: 8px; margin: 8px 0; font-family: 'Times New Roman', serif; font-style: italic; }
    /* 答案区域 */
    .answer-section { margin-top: 24px; padding: 16px; border-top: 2px solid #333; background: #fafafa; page-break-before: always; }
    /* 记忆技巧 */
    .memory-tips { padding: 12px 16px; background: #fff3e0; border: 1px solid #ffb74d; border-radius: 6px; margin: 12px 0; }
    /* 趣味练习 */
    .fun-practice { padding: 12px 16px; background: #e8f5e9; border: 1px solid #81c784; border-radius: 8px; margin: 12px 0; }
    /* 写作素材 */
    .writing-material { padding: 12px 16px; background: #fce4ec; border: 1px solid #f48fb1; border-radius: 6px; margin: 12px 0; }
    /* 公式速查 */
    .formula-ref { padding: 10px 14px; background: #e3f2fd; border: 1px solid #90caf9; border-radius: 6px; margin: 8px 0; }
    /* 错题标签 */
    .error-tags { display: flex; gap: 6px; flex-wrap: wrap; margin: 6px 0; }
    .tag { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 0.8em; font-weight: 500; }
    .tag-concept, .tag-error-type { background: #ffebee; color: #c62828; }
    .tag-frequency { background: #e3f2fd; color: #1565c0; }
    .tag-difficulty { background: #fff3e0; color: #e65100; }
    .tag-score-loss { background: #fce4ec; color: #880e4f; }
    /* 错题归因+分析 */
    .error-reason { padding: 8px 12px; background: #fff8e1; border-radius: 4px; margin: 6px 0; }
    .error-analysis { padding: 8px 12px; background: #fce4ec; border-radius: 4px; margin: 6px 0; }
    /* 题目编号 */
    .question-number { font-weight: bold; margin-right: 6px; display: inline-block; min-width: 1.8em; }
  `;
  
  // ========== 打印专用CSS ==========
  // 🔧 密封线试卷（sealed_exam）：页面壳 .sealed-wrapper 自带 2cm 页边距 →
  //    @page 边距必须为 0，否则 20mm + 20mm 叠加成 40mm（正文被推得太深）
  const sealTheme = themeId === 'sealed_exam';
  styleTag += `
    @page {
      size: A4;
      margin: ${sealTheme ? 0 : '20mm'};
    }
    @media print {
      body {
        margin: 0;
        padding: 10mm;
      }
      /* 🔧 密封线试卷：页面壳 .sealed-wrapper 自带 A4 页边距（上下左右统一 2cm），
         打印/PDF 时取消 body 兜底留白，密封区才能落在纸边 20mm（正文内边距外侧，对齐模板布局） */
      body:has(.sealed-wrapper) {
        margin: 0 !important;
        padding: 0 !important;
      }
      h1, h2, h3, h4 { page-break-after: avoid; }
      table, figure, pre, blockquote { page-break-inside: avoid; }
      .no-print { display: none !important; }
    }
  `;
  
  // 🔧 HTML 模式：追加原生元素选择器，让主题样式也能匹配 h1/h2/p/table 等标签
  //    同时将 class 选择器的核心属性映射到原生标签，确保 Word/AI 内容也能享受主题
  if (isHtmlContent) {
    const mainTitleStyle = theme.styles?.['.main-title'] || {};
    const heading1Style = theme.styles?.['.heading1'] || {};
    const heading2Style = theme.styles?.['.heading2'] || {};
    const heading3Style = theme.styles?.['.heading3'] || {};
    const normalParaStyle = theme.styles?.['.normal-paragraph'] || {};
    const toCss = (obj) => Object.entries(obj)
      .map(([k, v]) => `${k.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${v}`)
      .join('; ');

    // 🔧 构建 .normal-paragraph 的完整属性（含主题 body 回退默认值）
    //    这样 p 选择器可以继承主题的 颜色/字重/字体/对齐 等全部样式
    const normalParaFull = {
      fontSize: `${theme.bodySize}pt`,
      lineHeight: `${theme.lineHeight}`,
      fontFamily: theme.bodyFont,
      color: theme.bodyColor || '#1e1e1e',
      fontWeight: 'normal',
      textAlign: 'left',
      marginBottom: '6pt',
      ...normalParaStyle,
    };
    const { marginBottom: _mb, ...paraStylesForCSS } = normalParaFull;
    const normalParaCSS = toCss(paraStylesForCSS);
    const pMarginBottom = normalParaFull.marginBottom || '6pt';
  
    styleTag += `
      /* 🔧 HTML 内容模式 - 原生元素样式（从主题 heading 类映射） */
      h1 { ${toCss(mainTitleStyle)} }
      h2 { ${toCss(heading1Style)} }
      h3 { ${toCss(heading2Style)} }
      h4 { ${toCss(heading3Style)} }
      /* 段距标准配置：段前 0、段后 6pt（教辅惯例，段距统一由段后控制） */
      p { ${normalParaCSS}; margin: 0 0 ${pMarginBottom}; text-indent: 2em; }
      /* 居中/右对齐/两端对齐段落不缩进 */
      p[style*="text-align: center"],
      p[style*="text-align: right"],
      p[style*="text-align: justify"] { text-indent: 0; }
      li { ${normalParaCSS}; }
      table { border-collapse: collapse; width: 100%; margin: 8px 0; }
      /* 🔧 表格内容左缩进 0.3 字符：避免文字紧贴单元格左边框（与导出 tcMar left 对应）
         行高 2.08em：Word 多倍行距 1.6 的等价行盒（25pt），CSS 行距上下均分、文字在行盒内垂直居中（导出用 atLeast 行距对齐此行为） */
      table td, table th { border: 1px solid #999; padding: 4px 8px; padding-left: calc(8px + 0.3em); font-size: ${normalParaFull.fontSize}; line-height: 2.08; }
      /* 🔧 表格单元格内段落：取消正文段距/首行缩进/大行距，保持表格紧凑
         否则被上面的 p 规则撑高（line-height 1.6~1.8 + margin 0.3em + 缩进 2em 全进表格） */
      table td p, table th p { margin: 0; text-indent: 0; line-height: 2.08; }
      img { max-width: 100%; height: auto; }
      ul, ol { margin: 0.3em 0 0.3em 2em; }
      /* 🔧 语义标签（Tiptap 保留元素标签，这些选择器生效） */
      u, ins { text-decoration: underline; text-underline-offset: 3px; text-decoration-thickness: 1.5px; }
      /* 填空横线：按答案字数精确控宽，1em≈1个汉字 */
      u[class*="blank-"] { display: inline-block; text-align: center; font-size: inherit !important; min-width: 1em; }
      u.blank-1 { min-width: 1em; } u.blank-2 { min-width: 2em; }
      u.blank-3 { min-width: 3em; } u.blank-4 { min-width: 4em; }
      u.blank-5 { min-width: 5em; } u.blank-6 { min-width: 6em; }
      u.blank-8 { min-width: 8em; } u.blank-10 { min-width: 10em; }
      /* 括号间距：仅占宽度，无下划线 */
      span[class*="blank-"] { display: inline-block; text-align: center; }
      span.blank-1 { min-width: 1em; } span.blank-2 { min-width: 2em; }
      span.blank-3 { min-width: 3em; } span.blank-4 { min-width: 4em; }
      span.blank-5 { min-width: 5em; } span.blank-6 { min-width: 6em; }
      span.blank-8 { min-width: 8em; } span.blank-10 { min-width: 10em; }
      strong, b { font-weight: bold; }
      em, i { font-style: italic; }
      s, del, strike { text-decoration: line-through; }
    `;
  }
  
  styleTag += '</style>';
  
  // 🔧 强制 !important：覆盖 AI 生成内容中的内联样式
  //    ⚠️ color 除外：AI 标注的颜色（如红色重点、蓝色标题）必须优先于主题色
  if (forceImportant) {
    styleTag = styleTag.replace(
      /([-\w]+)\s*:\s*([^;{}!]+)(?=\s*[;}])/g,
      (match, prop, value) => {
        if (/^\s*color\s*$/i.test(prop)) return match;
        return `${prop}: ${value} !important`;
      }
    );
  }
  
  // 🔧 HTML 模式：跳过智能标题识别（已有结构化标签），直接使用原内容
  let processedContent;
  if (isHtmlContent) {
    processedContent = content;
  } else {
    processedContent = applyIntelligentHeadings(content);
  }
  
  // 转换 $...$ 公式标记为可读文本
  processedContent = convertFormulasInHtml(processedContent);
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${styleTag}
</head>
<body>
  ${processedContent}
</body>
</html>`;
};

// ==================== 主题内容自动包装 ====================
/**
 * 密封线文本 → 标准字段序列（用于新结构“竖虚线 + 横排文字嵌入”排版）
 * 标准版式（与预览/导出一致；逆时针旋转 90°、从下往上读）：
 *   1. 提示语“密封线内不要答题”在最上（顶部）
 *   2. 考生信息（学校/班级/姓名/学号…）合并为一行，居下
 *   3. “密/封/线”三字在最下，固定按“线 上 → 密 下”输出 → 从下往上读正好是“密封线”
 * 幂等：已归一化的字段序列再次分类结果不变。
 */
export const classifySealTokens = (tokens) => {
  const tip = [];
  const info = [];
  const seal = [];
  const other = [];
  for (const tk of tokens) {
    if (!tk) continue;
    if (/不要答题|^密封线内/.test(tk)) tip.push(tk);
    else if (tk === '密' || tk === '封' || tk === '线') seal.push(tk);
    else if (tk === '密封线') seal.push('密', '封', '线');
    else if (/^(学校|班级|姓名|学号|考生|考号)[:：]/.test(tk)) info.push(tk);
    else other.push(tk);
  }
  const fields = [];
  if (tip.length) fields.push(tip.join('　'));
  if (info.length) fields.push(info.join('　'));
  ['线', '封', '密'].forEach((c) => {
    if (seal.includes(c)) fields.push(c);
  });
  fields.push(...other);
  return fields;
};

/**
 * 密封线原始文本 → 字段 token 数组
 * 🔧 无空格粘连拆断：旧内容可能形如「密封线学校：＿＿＿班级：＿＿＿密封线内不要答题」
 * 在字段前缀 / 提示语前插入全角空格分隔，避免整串作为一个超长字段（导出端文本框横铺整页）
 */
export const tokenizeSealText = (text) => {
  const separated = String(text || '').replace(/(?<=[^\s　])(?=(?:学校|班级|姓名|学号|考生|考号)[:：]|密封线内)/g, '　');
  return separated.replace(/[\r\n]+/g, '　').split(/[\s　]+/).map((t) => t.trim()).filter(Boolean);
};

/**
 * 密封线文本 → 字段序列（标准版式，见 classifySealTokens）
 * 旧文本为空格分隔的整条（如“密封线　学校：＿＿＿　班级：＿＿＿　姓名：＿＿＿　学号：＿＿＿　密封线内不要答题”）：
 *   拆分为：提示（…不要答题）→ 信息字段（学校/班级/姓名/学号…，合并一行）→ 密封线三字（线上密下）
 */
export const splitSealText = (text) => {
  if (!text) return ['密封线'];
  const fields = classifySealTokens(tokenizeSealText(text));
  return fields.length ? fields : ['密封线'];
};

/**
 * 密封线后续页字段：多页试卷仅第一页需要填写考生信息（学校/班级/姓名/学号），
 * 后续页密封线只保留"密/封/线"三字（或整条"密封线"），虚线照常填满整页。
 */
export const splitSealContinuation = (fields) => {
  const arr = Array.isArray(fields) ? fields : splitSealText(fields || '');
  const sealOnly = arr.filter((f) => f === '密' || f === '封' || f === '线' || f === '密封线');
  return sealOnly.length ? sealOnly : ['密封线'];
};

/** HTML 转义（密封线字段文本） */
const escHtml = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * 密封线字段序列 → 模板结构 seal-zone HTML（严格对齐「试卷密封线模板.html」）：
 *   密封区绝对定位于左侧页边距带（12mm 起、宽 32mm 至 44mm），正文内边距外侧；
 *   提示语（seal-note）上中部、信息栏（seal-info）底部、密/封/线（seal-char）写在折线上（线上密下），
 *   全部逆时针旋转 90°（从下往上读）；虚线由 seal-line 提供（右缘 dashed）。
 */
export const buildSealZoneHTML = (fields) => {
  const list = Array.isArray(fields) ? fields : splitSealText(fields || '');
  // ⚠️ 多字字段可能粘有密封线字符（如"密封线内不要答题封""学号：＿密"），剥离尾部密/封/线
  const stripSealSuffix = (s) => String(s || '').replace(/[密封线]+$/g, '');
  // 🔧 学校/班级/姓名/学号 后的下划线统一为 8 个全角 ＿（"再长一些且一致"），预览与导出一致
  const normalizeBlanks = (s) => String(s || '').replace(/＿+/g, '＿＿＿＿＿＿＿＿');
  const tip = stripSealSuffix(list.find((f) => /不要答题|^密封线内/.test(f)) || '密封线内不要答题');
  const info = normalizeBlanks(stripSealSuffix(list.find((f) => /^(学校|班级|姓名|学号|考生|考号)[:：]/.test(f)) || ''));
  // 标准试卷密封线必含"密/封/线"三字（写在折线上，线上密下）；源文本未显式给出时补全
  const chars = ['线', '封', '密'].filter((c) => list.includes(c));
  const effChars = chars.length ? chars : ['线', '封', '密'];
  const infoHtml = info ? `\n    <div class="seal-info">${escHtml(info)}</div>` : '';
  const topChar = effChars.includes('线') ? '<div class="seal-char s-top">线</div>' : '';
  const midChar = effChars.includes('封') ? '<div class="seal-char s-mid">封</div>' : '';
  const botChar = effChars.includes('密') ? '<div class="seal-char s-bot">密</div>' : '';
  return `<div class="seal-zone">
    <div class="seal-note">${escHtml(tip)}</div>${infoHtml}
    <div class="seal-line"></div>
    ${topChar}${midChar}${botChar}
  </div>`;
};

/**
 * 旧密封线结构 → 标准模板结构（.sealed-wrapper > [.seal-zone + .sealed-content]）
 * 输入兼容：
 *   a. 旧 flex 结构：.sealed-wrapper > [.sealed-line/.seal-line（.sl-text/.sl-dash 交替）+ 正文兄弟]
 *   b. 旧横向结构：.sealed-line 文本 + 信息栏/提示横向 <p>（以密封特征开头）
 *   c. 顶层裸 .sealed-line/.seal-line（无 wrapper）
 * 输出统一为模板结构（严格对齐「试卷密封线模板.html」）；已是 seal-zone 结构的部分幂等跳过。
 */
const convertLegacySealToTemplate = (html) => {
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  // c. 顶层裸 .sealed-line/.seal-line → 包进 sealed-wrapper
  const bareLines = Array.from(tpl.content.querySelectorAll(':scope > .sealed-line, :scope > .seal-line'));
  if (bareLines.length) {
    const w = document.createElement('div');
    w.className = 'sealed-wrapper';
    const box = document.createElement('div');
    box.className = 'sealed-content';
    let moved = 0;
    for (const c of Array.from(tpl.content.children)) {
      if (bareLines.includes(c)) continue;
      box.appendChild(c);
      moved += 1;
    }
    bareLines.forEach((b) => w.appendChild(b));
    if (moved) w.appendChild(box);
    tpl.content.replaceChildren(w);
  }
  // a/b. wrapper 内的旧结构 → seal-zone + sealed-content
  const wrappers = Array.from(tpl.content.querySelectorAll('.sealed-wrapper'));
  wrappers.forEach((w) => {
    if (w.querySelector(':scope > .seal-zone')) return; // 已是模板结构，幂等跳过
    let sealEl = null;
    const extras = [];
    for (const c of Array.from(w.children)) {
      const cCls = c.classList || [];
      const cText = (c.textContent || '').replace(/[\r\n]+/g, '').trim();
      if (cCls.contains('sealed-line') || cCls.contains('seal-line')) sealEl = c;
      else if (/^(密封线内|学校[:：]|班级[:：]|姓名[:：]|学号[:：]|考生[:：]|考号[:：])/.test(cText)) extras.push(c);
    }
    if (!sealEl && !extras.length) return;
    // 收集字段：.sl-text 序列（新 flex）或整段文本（旧横向）+ 外部密封特征 p
    const slTexts = sealEl
      ? Array.from(sealEl.querySelectorAll('.sl-text')).map((el) => (el.textContent || '').trim()).filter(Boolean)
      : [];
    const raw = (slTexts.length ? slTexts.join('　') : (sealEl ? (sealEl.textContent || '') : ''))
      + (extras.length ? '　' + extras.map((e) => (e.textContent || '').trim()).join('　') : '');
    extras.forEach((e) => e.remove());
    if (sealEl) sealEl.remove();
    const fields = classifySealTokens(tokenizeSealText(raw || '密封线'));
    const zone = document.createElement('div');
    zone.innerHTML = buildSealZoneHTML(fields);
    const zoneEl = zone.firstElementChild;
    // 内容容器：已有 .sealed-content 保留，其余兄弟收进容器
    let contentBox = w.querySelector(':scope > .sealed-content');
    if (!contentBox) {
      contentBox = document.createElement('div');
      contentBox.className = 'sealed-content';
      let moved = 0;
      for (const c of Array.from(w.children)) {
        contentBox.appendChild(c);
        moved += 1;
      }
      if (moved) w.appendChild(contentBox);
    } else {
      for (const c of Array.from(w.children)) {
        if (c === contentBox) continue;
        contentBox.appendChild(c);
      }
    }
    w.prepend(zoneEl);
  });
  return tpl.innerHTML;
};

/**
 * 模板 .paper 页面结构 → 标准 sealed-wrapper 页面壳
 * 输入为「试卷密封线模板.html」整页：.paper > [.seal-zone + .content(正文) + 页脚…]
 * 输出：.sealed-wrapper > [.seal-zone + .sealed-content(正文)]
 * 幂等：已在 .sealed-wrapper 内的 .seal-zone 跳过。
 */
const wrapTemplateSealPaper = (html) => {
  if (!/seal-zone/.test(html)) return html;
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  const zones = Array.from(tpl.content.querySelectorAll('.seal-zone'));
  zones.forEach((zone) => {
    if (zone.closest('.sealed-wrapper')) return; // 幂等
    const wrapper = document.createElement('div');
    wrapper.className = 'sealed-wrapper';
    const paper = zone.closest('.paper');
    // parentNode 兼容 DocumentFragment（模板顶层 seal-zone 时 parentElement 为 null）
    const host = paper || zone.parentNode;
    const contentEl = host && host.children
      ? Array.from(host.children).find((c) => c.classList && c.classList.contains('content'))
      : null;
    const siblings = host ? Array.from(host.children || []).filter((c) => c !== zone) : [];
    zone.remove();
    wrapper.appendChild(zone);
    if (contentEl) {
      contentEl.classList.remove('content');
      contentEl.classList.add('sealed-content');
      wrapper.appendChild(contentEl);
    } else {
      const contentBox = document.createElement('div');
      contentBox.className = 'sealed-content';
      let moved = 0;
      siblings.forEach((c) => {
        if (c === contentEl) return;
        if (c.nodeType === 1 || (c.nodeType === 3 && (c.textContent || '').trim())) { contentBox.appendChild(c); moved += 1; }
      });
      if (moved) wrapper.appendChild(contentBox);
    }
    if (paper) {
      paper.replaceWith(wrapper);
    } else if (host) {
      host.insertBefore(wrapper, host.firstChild);
    }
  });
  return tpl.innerHTML;
};

/**
 * 密封线结构归一化 → 标准模板结构（.sealed-wrapper > [.seal-zone + .sealed-content]）：
 * 0. 旧 flex 结构（sealed-wrapper + sealed-line/.sl-text/.sl-dash）→ seal-zone 模板结构
 * 1. 模板 .paper 页面结构（.paper > .seal-zone + .content）→ sealed-wrapper 页面壳
 * 2. 已是模板结构 → 幂等返回
 * 幂等；正文 p（不以密封特征开头）不受影响。
 * 注：模板结构 = 密封区绝对定位于左侧页边距带（正文内边距外侧），提示语/信息栏/密·封·线
 *     按「试卷密封线模板.html」绝对定位，预览、编辑、导出（docxBuilder 表格方案）共用同一结构。
 */
export const normalizeSealStructure = (html) => {
  if (!html || typeof html !== 'string') return html;
  // 无密封特征 → 原样返回
  if (!/(sealed-wrapper|sealed-line|seal-line|seal-zone|seal-note|seal-info|seal-char|密封线|学校[:：]|班级[:：]|姓名[:：]|学号[:：]|考生[:：]|考号[:：])/.test(html)) return html;
  // 旧 flex 结构（sealed-wrapper + sealed-line/seal-line + sl-text/sl-dash）→ 模板结构（seal-zone）
  html = convertLegacySealToTemplate(html);
  // 模板 .paper 页面结构（.paper > .seal-zone + .content）→ sealed-wrapper 页面壳（幂等）
  html = wrapTemplateSealPaper(html);
  return html;
};


/**
 * 大题标题分值提取：明细式"（共X题，每题X分，共X分）"或兜底总分式"（X分）"
 */
const parseSectionScore = (text) => {
  // ① 规范格式："（共6题，每题2分，共12分）" —— 共X题…共Y分
  const detail = text.match(/[（(]\s*共\s*\d{1,3}\s*题[^）)]*?共\s*(\d{1,3})\s*分[)）]/);
  if (detail) return parseInt(detail[1], 10);
  // ② 括号内"共N分"（覆盖 AI 常见写法："（每空2分，共20分）""（每题2分，共20分）""（共20分）""（满分20分）"）
  const total = text.match(/[（(][^）)]*?共\s*(\d{1,3})\s*分\s*[)）]/);
  if (total) return parseInt(total[1], 10);
  // ③ 括号内最末分值："（10分）""（每题2分，共8分）" → 取括号内最后一个"X分"
  const last = text.match(/[（(][^）)]*?(\d{1,3})\s*分\s*[)）]/);
  return last ? parseInt(last[1], 10) : null;
};

/**
 * 解析正文大题标题（一、二、三…）→ [{ num:'一', name:'…', score:N }]
 * 仅识别"汉字序号＋、"开头且带分值标注的行；跳过答案区（answer-section）内的标题
 */
export const parseExamSections = (html) => {
  if (!html || typeof html !== 'string') return [];
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  const sections = [];
  for (const el of Array.from(tpl.content.querySelectorAll('p, h1, h2, h3, h4'))) {
    if (el.closest('.answer-section')) continue;
    const text = (el.textContent || '').trim();
    const numMatch = text.match(/^([一二三四五六七八九十]+)、/);
    if (!numMatch) continue;
    const score = parseSectionScore(text);
    if (score == null) continue; // 无分值标注不视为大题（如答案页标题/正文短句）
    sections.push({ num: numMatch[1], name: text.replace(/[（(].*?分[)）]$/, '').trim(), score });
  }
  return sections;
};

/**
 * 卷面固定件：注意事项 + 题号得分表（由排版模块统一生成，全学段全学科 exam 生效）
 * 注意事项为通用卷面规范（不依赖学科内容）；"本试卷共＿页"由人工/导出补填
 * 行高统一由 CSS（.exam-score-table padding:2px + line-height:1.15）控制——
 * 内联 padding 在编辑/预览注入 CSS 时会覆盖主题规则导致行高偏高，且与 Word 导出不一致
 */
export const buildExamShell = (sections, stage) => {
  const headCells = sections.map((s) => `<th>${s.num}</th>`).join('');
  const scoreCells = sections.map(() => `<td></td>`).join('');
  return `<div class="exam-shell">
  <div class="exam-notice">
    <p class="notice-title">注意事项：</p>
    <p class="notice-item">1．答题前，请将密封线内的学校、班级、姓名、学号填写清楚。</p>
    <p class="notice-item">2．请在各题目的答题区域内作答，超出答题区域书写的答案无效。</p>
    <p class="notice-item">3．本试卷共＿页。</p>
  </div>
  <table class="exam-score-table">
    <tr><th>题号</th>${headCells}<th>总分</th></tr>
    <tr><td>得分</td>${scoreCells}<td></td></tr>
  </table>
</div>`;
};

/**
 * 注入/重排卷面固定件（注意事项 + 题号得分表），对齐正规试卷顺序：
 *   卷首信息（标题/副标题/卷首导入语） → 注意事项 → 题号得分表 → 正文大题
 *   - 无固定件：在第一个大题标题之前新建注入（卷首语自然留在卷首区，不夹在得分框与正文之间）；
 *   - 已有固定件（旧版烘焙在内容里位置不对）：自动重排到第一个大题之前（幂等）；
 *   无大题结构的普通文档不注入
 */
export const injectExamShell = (html, stage) => {
  if (!html || typeof html !== 'string') return html || '';
  const sections = parseExamSections(html);
  if (!sections.length) return html;
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  let shellNode = tpl.content.querySelector('.exam-shell');
  const isNew = !shellNode;
  if (!shellNode) {
    const holder = document.createElement('div');
    holder.innerHTML = buildExamShell(sections, stage);
    shellNode = holder.firstElementChild;
  }
  let anchor = null;
  for (const el of Array.from(tpl.content.querySelectorAll('p, h1, h2, h3, h4'))) {
    if (el.closest('.answer-section')) continue;
    const text = (el.textContent || '').trim();
    if (/^[一二三四五六七八九十]+、/.test(text) && parseSectionScore(text) != null) {
      anchor = el;
      break;
    }
  }
  if (!anchor) {
    if (isNew) tpl.content.appendChild(shellNode);
    return tpl.innerHTML;
  }
  // 🔧 防重复（旧资料/旧版 AI 自带固定件）：移除无 .exam-shell class 的旧注意事项 + 题号得分表残片，
  //    使旧资料重新打开排版预览时不再出现双份固定件（无需重新生成资料）。
  //    识别特征（低误删）：① .exam-notice/.notice-title/.notice-item 类节点（不在 shell 内）；② 两行结构的"题号+得分"表；
  //    ③ anchor 之前、文本以"注意事项"开头或以"答题前/请在各题/本试卷共/答案无效"开头的段落（旧 AI 无 class 输出）
  //    ⛔ 排除 .score-board（每大题评分栏，不是固定件）与 .exam-shell 内部节点
  const NOTICE_RE = /^注意事项[:：]?/;
  const NOTICE_ITEM_RE = /^[1-4][．.、]\s*(答题前|请在各题|本试卷共|考试结束|答案无效|超出答题区域)/;
  const beforeAnchor = (el) => {
    if (!anchor) return true;
    // DOCUMENT_POSITION_FOLLOWING：el 位于 anchor 之后 → 跳过（只处理第一个大题之前的旧固定件）
    return !(anchor.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING);
  };
  for (const el of Array.from(tpl.content.querySelectorAll('.exam-notice, .notice-title, .notice-item, .exam-score-table, table, p, h1, h2, h3, h4'))) {
    if (el.closest('.exam-shell')) continue;
    if (el.closest('.score-board')) continue;
    if (!beforeAnchor(el)) continue;
    const cls = el.classList;
    if (cls.contains('exam-notice') || cls.contains('notice-title') || cls.contains('notice-item') || cls.contains('exam-score-table')) {
      el.remove();
      continue;
    }
    if (el.tagName === 'TABLE') {
      const rows = Array.from(el.querySelectorAll('tr')).filter((r) => (r.textContent || '').trim());
      if (rows.length <= 2) {
        const head = rows[0] ? rows[0].textContent : '';
        const body = rows[1] ? rows[1].textContent : '';
        if (head.includes('题号') && (head.includes('得分') || body.includes('得分'))) el.remove();
      }
      continue;
    }
    // 旧 AI 注意事项段落（无 class）：仅删小段落（p/h），不删可能含正文的 div 容器
    if (el.tagName === 'P' || /^H[1-4]$/.test(el.tagName)) {
      const text = (el.textContent || '').trim();
      if (NOTICE_RE.test(text) || NOTICE_ITEM_RE.test(text)) el.remove();
    }
  }
  // 🔧 正规试卷顺序：固定件（注意事项+得分表）紧贴第一个大题之前；
  //    标题/副标题/卷首语等卷首内容自然在其上方（insertBefore 已就位时幂等无变化）
  //    ⚠️ parentNode 兼容 DocumentFragment（template.content 顶层元素 parentElement 为 null，会抛 TypeError）
  const parent = anchor.parentNode || tpl.content;
  parent.insertBefore(shellNode, anchor);
  return tpl.innerHTML;
};

/**
 * 根据主题 ID，给 HTML 内容包上结构化外壳
 * 解决 Word/AI 生成内容不含主题 class 导致特殊布局不生效的问题
 */
export const wrapContentForTheme = (html, themeId) => {
  if (!html || typeof html !== 'string') return html || '';

  // 🔧 密封线结构归一化（旧结构信息栏横向 p → 并入 sealed-line 整体竖排），幂等
  html = normalizeSealStructure(html);
  
  // 🔧 无样式：不需要包装
  if (!themeId) return html;
  
  const theme = getThemeById(themeId);
  if (!theme) return html;
  
  switch (theme.id) {
    // 📜 试卷类主题（密封线试卷 + 小初高三个试卷主题）统一应用密封线包装与卷面固定件
    case 'sealed_exam':
    case 'primary_exam':
    case 'middle_exam':
    case 'high_exam': {
      // 🔧 重构为标准试卷结构：sealed-wrapper > [seal-zone（模板密封区）+ sealed-content（正文）]。
      //    AI 可能只输出"孤儿 sealed-line（仅含密封线）"并把标题/正文放在其外，
      //    若不重构，密封线会独立显示在页面顶部、标题出现在其下方（排版固定内容下方）。
      //    幂等：已标准化的结构（sealed-wrapper + seal-zone）重构后结果一致，不嵌套包装。
      const tpl = document.createElement('template');
      tpl.innerHTML = html;
      let zoneEl = tpl.content.querySelector('.seal-zone');
      if (!zoneEl) {
        // 无密封区：收集旧密封线字段（.sealed-line/.seal-line/.sl-text 或密封特征 p）构建默认区
        const legacyLine = tpl.content.querySelector('.sealed-line, .seal-line');
        const extraTexts = Array.from(tpl.content.querySelectorAll('p, div'))
          .map((el) => (el.textContent || '').trim())
          .filter((t) => /^(密封线内|学校[:：]|班级[:：]|姓名[:：]|学号[:：]|考生[:：]|考号[:：])/.test(t));
        const slTexts = legacyLine
          ? Array.from(legacyLine.querySelectorAll('.sl-text')).map((el) => (el.textContent || '').trim()).filter(Boolean)
          : [];
        const raw = (slTexts.length ? slTexts.join('　') : (legacyLine ? (legacyLine.textContent || '') : ''))
          + (extraTexts.length ? '　' + extraTexts.join('　') : '');
        const zone = document.createElement('div');
        zone.innerHTML = buildSealZoneHTML(splitSealText(raw || '密封线'));
        zoneEl = zone.firstElementChild;
      }
      const contentNodes = [];
      for (const n of Array.from(tpl.content.childNodes)) {
        if (n.nodeType === 3) {
          if ((n.textContent || '').trim()) contentNodes.push(n);
          continue;
        }
        if (n.nodeType !== Node.ELEMENT_NODE) continue;
        if (n.classList.contains('sealed-wrapper')) {
          // 展开已有 wrapper：跳过其中的 seal-zone，其余内容按文档顺序收进新 wrapper
          for (const c of Array.from(n.children)) {
            if (c.classList.contains('seal-zone')) continue;
            contentNodes.push(c);
          }
          continue;
        }
        if (n === zoneEl || n.classList.contains('seal-zone')) continue;
        // 密封特征段落（学校/班级/姓名/学号/密封线内…）已并入密封区字段，不进入正文
        const nText = (n.textContent || '').replace(/[\r\n]+/g, '').trim();
        if (/^(密封线内|学校[:：]|班级[:：]|姓名[:：]|学号[:：]|考生[:：]|考号[:：])/.test(nText)) continue;
        contentNodes.push(n);
      }
      const wrapper = document.createElement('div');
      wrapper.className = 'sealed-wrapper';
      const contentBox = document.createElement('div');
      contentBox.className = 'sealed-content';
      contentNodes.forEach((node) => contentBox.appendChild(node));
      wrapper.appendChild(zoneEl);
      wrapper.appendChild(contentBox);
      // 🔧 replaceChildren：清空 fragment 全部子节点（含残留的旧 wrapper 空壳）并放入新 wrapper
      tpl.content.replaceChildren(wrapper);
      let out = tpl.innerHTML;
      // 🔧 密封线结构归一化（幂等）+ 卷面固定件（注意事项 + 题号得分表，幂等注入；旧内容重新打开自动补齐）
      out = normalizeSealStructure(out);
      out = injectExamShell(out, theme.stage);
      return out;
    }
    
    case 'error_book':
      return `<div class="correction-layout">
        <div class="correction-left">${html}</div>
        <div class="correction-right">
          <div class="correction-title">订正区</div>
          <p class="no-indent" style="color:#999;font-size:10pt;">在此记录正确答案与解题思路</p>
        </div>
      </div>`;
    
    case 'teaching_plan':
      return wrapTeachingSections(html);
    
    case 'study_note':
      return `<div class="note-layout">${html}</div>`;
    
    default:
      return html;
  }
};

/**
 * 🔧 特殊主题编辑器 CSS：将 class 选择器布局转为 .ProseMirror 伪元素实现
 *    Tiptap 丢弃 div/class，但 .ProseMirror 是编辑器真实 DOM 元素
 *    通过伪元素 ::before/::after 在编辑区表面渲染密封线、订正区等特殊布局
 */
export const getSpecialThemeEditorCSS = (themeId) => {
  const theme = getThemeById(themeId);
  if (!theme) return '';

  switch (theme.id) {
    case 'sealed_exam':
      // 📜 密封线由真实 DOM 结构承载（SealedWrapper/SealedLine 节点保留 div/class，
      //    主题 CSS 的 .sealed-wrapper/.sealed-line 规则直接生效），
      //    不再用 ::before/::after 伪元素覆盖渲染（曾导致预览出现两条虚线、文字重叠）。
      //    编辑区 Word 式页面感：页壳至少一页高（密封线贯穿首页 20~277mm）、
      //    左右边距 2.5cm 由 .sealed-wrapper padding 提供、密封区绝对定位于边距外侧。
      return `
        .ProseMirror {
          overflow: visible !important;
        }
        .ProseMirror .sealed-wrapper {
          position: relative !important;
          min-height: 257mm !important;
        }
        .ProseMirror .seal-zone {
          z-index: 1;
        }
        .ProseMirror .seal-zone > .seal-line {
          top: 20mm !important;
          bottom: auto !important;
          height: 257mm !important;
        }
      `;

    case 'error_book':
      return `
        /* 🔖 错题本 — 编辑区左侧红色标识条 + 底部订正区提示 */
        .ProseMirror {
          position: relative !important;
          border-left: 4px solid #c62828 !important;
          padding-left: 16px !important;
        }
        .ProseMirror::after {
          content: "📝 订正区 — 在此记录正确答案与解题思路" !important;
          display: block !important;
          margin-top: 24px !important;
          padding: 14px 18px !important;
          background: #fff8e1 !important;
          border: 2px dashed #ffb300 !important;
          border-radius: 8px !important;
          font-size: 12pt !important;
          font-weight: bold !important;
          line-height: 1.7 !important;
          color: #e65100 !important;
          text-align: center !important;
          pointer-events: none !important;
        }
      `;

    case 'teaching_plan':
      return `
        /* 📋 教案设计 — h2 区块化展示 */
        .ProseMirror h2 {
          border: 1px solid #d1c4e9 !important;
          border-radius: 6px !important;
          padding: 10px 16px !important;
          margin-top: 14px !important;
          margin-bottom: 8px !important;
          background: #faf8ff !important;
        }
        .ProseMirror h3 {
          font-size: 13pt !important;
          font-weight: bold !important;
          color: #5e35b1 !important;
          padding-bottom: 4px !important;
          border-bottom: 2px solid #d1c4e9 !important;
        }
      `;

    case 'study_note':
      return `
        /* 📒 学霸笔记 — 左侧绿色标识条 */
        .ProseMirror {
          border-left: 4px solid #00695c !important;
          padding-left: 16px !important;
        }
      `;

    default:
      return '';
  }
};

/**
 * 教案设计专用：按 <h2> 边界切分，每段包 <div class="teaching-section">（仅导出使用）
 */
function wrapTeachingSections(html) {
  const parts = html.split(/(<h2[^>]*>[\s\S]*?<\/h2>)/i);
  
  if (parts.length <= 2) {
    return `<div class="teaching-section">${html}</div>`;
  }
  
  let result = '';
  if (parts[0] && parts[0].trim()) {
    result += parts[0];
  }
  
  for (let i = 1; i < parts.length; i += 2) {
    const heading = parts[i] || '';
    const content = parts[i + 1] || '';
    result += `<div class="teaching-section">${heading}${content}</div>`;
  }
  
  return result;
}

// ==================== 导出配置 ====================
export default {
  themes,
  getAllThemes,
  getThemeById,
  addCustomTheme,
  updateCustomTheme,
  deleteCustomTheme,
  applyThemeToContent,
  wrapContentForTheme,
  normalizeSealStructure,
  parseExamSections,
  buildExamShell,
  injectExamShell,
  getSpecialThemeEditorCSS,
  markdownToHtml,
  applyIntelligentHeadings,
  getThemeHeadingStyle,
  headingDetectionRules,
  defaultThemeId,
  themeOptions
};