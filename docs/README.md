# 智卷工坊 · 安装与使用指南

## 📋 系统要求

### 必需环境
- **操作系统**: Windows 10/11 64位
- **Node.js**: >= 18.x (推荐 LTS 版本)
- **Python**: >= 3.9, < 3.13（推荐 3.10 或 3.11）
- **内存**: 8GB 以上（推荐 16GB）
- **硬盘**: 10GB 以上可用空间

**Python 依赖库**（官方清单见项目根目录 `requirements.txt`）:
- PyMuPDF (fitz) - PDF 取字、转图
- Pillow - 图像处理
- numpy - 数值计算
- opencv-python - 分栏检测
- python-docx - Word 导入

安装命令（在项目根目录执行）:
```bash
pip install -r requirements.txt
```

可选：本地 OCR（体积较大，仅"自动 OCR 提取"需要）:
```bash
pip install -r requirements-ocr.txt
```

### 可选环境（用于 AI 功能）
应用支持**多引擎可切换**，任选其一即可（在「系统设置」中选择）：

- **Ollama**: 本地 AI 引擎（支持离线使用）
  - 下载地址: https://ollama.com/download
  - 推荐模型:
    - `qwen2.5:7b` - 文本生成（约 4GB 显存）
    - `qwen3-vl:8b` - 图片识别（约 6GB 显存）
- **云端 API 引擎**（需要网络连接和 API Key，任选）:
  - **DeepSeek**（推荐，生成主力）
  - **火山**（Volcano）
  - **阿里**（Alibaba）
  - **智谱**（Zhipu）
- **PaddleOCR-VL**: 本地 OCR / 图片识别（已随 python-scripts 提供）

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

# 2. 安装 Python 依赖（在项目根目录执行）
pip install -r requirements.txt

# 3. 验证 Python 依赖（可选）
python -c "import fitz, PIL, numpy, cv2, docx; print('依赖安装成功')"
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

#### 方案 B：使用云端 API（DeepSeek / 火山 / 阿里 / 智谱，任选）
1. 注册对应平台账号并获取 API Key（如 DeepSeek: https://platform.deepseek.com）
2. 在应用中配置:
   - 进入「系统设置」
   - 选择 AI 引擎为对应平台（"DeepSeek" / "火山" / "阿里" / "智谱"）
   - 填入 API Key（与 Base URL，如平台要求）
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
│   └── config/            # 配置文件（指令库/蓝图库/规则库等）
├── python-scripts/         # Python 脚本
│   ├── pdf_to_images.py   # PDF 转图片
│   ├── split_columns.py   # 分栏检测
│   └── add_bookmarks.py   # PDF 书签
├── tests/                  # Vitest 单元测试（113 文件 / 1629 用例）
├── docs/                   # 项目文档
├── main.js                 # Electron 主进程
├── preload.js              # 预加载脚本
└── package.json            # Node.js 依赖与脚本
```
详细结构见 [项目结构.md](./项目结构.md)。

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
pip install -r requirements.txt
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
2. **模型选择**（多引擎，在「系统设置」切换）: 
   - 本地（Ollama）：重型任务（命题生成）用较大参数模型、轻量任务（分析提取）用较小模型
   - 云端（DeepSeek / 火山 / 阿里 / 智谱）：按平台提供的模型等级选择，生成主力建议选强模型
   - 图片识别 → 本地 qwen3-vl:8b 或 PaddleOCR-VL
3. **温度调节**:
   - 知识点总结 → 0.1-0.3（低温度，准确）
   - 课时练/试卷 → 0.5-0.7（中等，平衡）
   - 开放性问题 → 0.8-1.0（高温度，创意）

---

**最后更新**: 2026-09-10

**祝您使用愉快！** 🎉
