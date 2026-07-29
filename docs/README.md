# 智卷工坊 · 安装与使用指南

## 📋 系统要求

### 必需环境
- **操作系统**: Windows 10/11 64位
- **Node.js**: >= 18.x (推荐 LTS 版本)
- **Python**: >= 3.9, < 3.13（推荐 3.10 或 3.11）
- **内存**: 8GB 以上（推荐 16GB）
- **硬盘**: 10GB 以上可用空间

**Python 依赖库**:
- PyMuPDF (fitz) - PDF处理
- pypdfium2 - PDF文本提取
- Pillow - 图像处理
- numpy - 数值计算
- opencv-python - 计算机视觉

安装命令: `pip install -r requirements.txt`

### 可选环境（用于 AI 功能）
- **Ollama**: 本地 AI 引擎（支持离线使用）
  - 下载地址: https://ollama.com/download
  - 推荐模型:
    - `qwen2.5:7b` - 文本生成（约 4GB 显存）
    - `qwen3-vl:8b` - 图片识别（约 6GB 显存）
- **DeepSeek API**: 云端 AI 服务（需要网络连接和 API Key）

---

## 🚀 快速开始

### 1. 安装依赖

#### 方式一：使用一键安装脚本（推荐）
```bash
# 双击运行
install.bat
```

#### 方式二：手动安装
```bash
# 1. 安装 Node.js 依赖
npm install

# 2. 安装 Python 依赖
pip install -r requirements.txt

# 3. 验证 Python 依赖（可选）
python check_python_deps.py
```

### 2. 启动应用

#### 开发模式
```bash
# 双击运行
start.bat

# 或命令行执行
npm start
```

#### 生产模式（打包后）
```bash
# 1. 构建安装包
build.bat

# 2. 安装包位于 release\ 目录
```

---

## ⚙️ 首次使用配置

### 1. 激活应用
- 启动应用后会显示激活界面
- 输入激活码完成验证
- 如需获取激活码，请联系客服

### 2. 配置 AI 引擎

#### 方案 A：使用 Ollama（本地，推荐）
```bash
# 1. 安装 Ollama
# 访问 https://ollama.com/download 下载并安装

# 2. 拉取推荐模型
ollama pull qwen2.5:7b
ollama pull qwen3-vl:8b

# 3. 启动 Ollama 服务
ollama serve

# 4. 在应用中刷新模型列表
# 进入「系统设置」→ 点击「刷新模型列表」
```

#### 方案 B：使用 DeepSeek（云端）
1. 注册 DeepSeek 账号: https://platform.deepseek.com
2. 获取 API Key
3. 在应用中配置:
   - 进入「系统设置」
   - 选择 AI 引擎为 "DeepSeek"
   - 填入 API Key
   - 保存设置

### 3. 检查 GPU 状态
```bash
# 运行 GPU 检测脚本
check_gpu.bat
```

---

## 📁 项目结构

```
wisdom-workshop/
├── src/                    # 前端源代码
│   ├── components/        # Vue 组件
│   ├── modules/           # 功能模块
│   ├── stores/            # Pinia 状态管理
│   ├── composables/       # 组合式函数
│   └── config/            # 配置文件
├── python-scripts/         # Python 脚本
│   ├── pdf_to_images.py   # PDF 转图片
│   ├── split_columns.py   # 分栏检测
│   └── add_bookmarks.py   # PDF 书签
├── main.js                 # Electron 主进程
├── preload.js              # 预加载脚本
├── package.json            # Node.js 依赖
└── requirements.txt        # Python 依赖
```

---

## 🔧 常见问题

### Q1: 启动时报错 "Cannot find module 'pinia'"
**解决方案:**
```bash
npm install pinia
```

### Q2: PDF 转图片失败
**解决方案:**
```bash
pip install PyMuPDF Pillow
```

### Q3: Ollama 服务未运行
**解决方案:**
```bash
# 启动 Ollama
ollama serve

# 检查状态
curl http://localhost:11434/api/tags
```

### Q4: 生成速度慢或显存不足
**解决方案:**
1. 切换到更小的模型（如 qwen2.5:7b → qwen2.5:3b）
2. 使用 DeepSeek 云端 API
3. 关闭其他占用显存的程序

### Q5: 数据存储在哪里？
**默认路径:**
- Windows: `C:\Users\[用户名]\Documents\智卷工坊数据\`
- 可在「系统设置」中自定义存储路径

---

## 📞 技术支持

- **官网**: [待定]
- **客服微信**: [待定]
- **技术邮箱**: [待定]
- **GitHub**: [待定]

---

## 📄 许可证

本项目为商业软件，需要激活码才能使用完整功能。

---

## 🎯 核心功能

1. **教材库管理** - 上传、解析、管理 PDF/Word 教材
2. **模板库管理** - 对标教辅范本，AI 学习风格
3. **智能生成** - 基于教材和模板生成高质量教辅
4. **排版导出** - 专业排版主题，一键导出 Word/PDF
5. **草稿箱** - 批量处理文件，排队生成
6. **历史记录** - 查看和管理生成的教辅文档

---

## 💡 使用技巧

1. **目录提取**: 使用微信截图(Alt+A)框选目录页，Ctrl+C 复制后导入
2. **模型选择**: 
   - 重型任务（命题生成）→ 14B 模型
   - 轻量任务（分析提取）→ 7B 模型
   - 图片识别 → qwen3-vl:8b
3. **温度调节**:
   - 知识点总结 → 0.1-0.3（低温度，准确）
   - 课时练/试卷 → 0.5-0.7（中等，平衡）
   - 开放性问题 → 0.8-1.0（高温度，创意）

---

**祝您使用愉快！** 🎉
