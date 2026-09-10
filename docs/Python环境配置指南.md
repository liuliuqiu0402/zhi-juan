# 智卷工坊 - Python环境配置指南

本文档详细说明如何配置Python环境以支持智卷工坊的PDF处理和图像处理功能。

---

## 📋 系统要求

### Python版本
- **最低版本**: Python 3.9
- **推荐版本**: Python 3.10 或 3.11
- **最高版本**: Python 3.12（暂不支持3.13+）

> 注：本地 OCR（可选）所用的 PaddleOCR-VL 对版本更敏感，建议在其专用环境中使用 3.10。

### 检查Python版本
```bash
python --version
# 或
python3 --version
```

---

## 🚀 快速安装

### 方式一：使用一键脚本（推荐）
```bash
# 双击运行（会按 requirements.txt 安装必备依赖）
install.bat
```

### 方式二：手动安装
```bash
# 1. 安装必备依赖（官方唯一清单：requirements.txt）
pip install -r requirements.txt

# 2. 验证安装（导入无误即成功）
python -c "import fitz, PIL, numpy, cv2, docx; print('依赖安装成功')"
```

### 可选：本地 OCR（PaddleOCR-VL）
```bash
# 体积较大（GB 级），仅"自动 OCR 提取"路径需要；不装不影响其它功能
pip install -r requirements-ocr.txt
```

> ⚠️ **应用如何找到 Python**：应用是直接调用系统 PATH 里的 **第一个 `python`** 来执行上述脚本的（未指定固定路径）。
> 因此若电脑上装了多个 Python，请确认 **PATH 中排在最前的那个**已按 `requirements.txt` 装齐依赖；
> 否则可能出现"装过却仍报缺少依赖"的情况（应用只是没用到你装的那个 Python）。
> 排查：在终端执行 `where python` 查看实际会用到哪个。

---

## 📦 依赖清单

**官方唯一清单**：`requirements.txt`（必备）+ `requirements-ocr.txt`（可选 OCR）。

| 包名 | 版本要求 | 用途 | 导入名称 | 类别 |
|------|---------|------|---------|------|
| PyMuPDF | >=1.23 | PDF 取字、转图、书签 | fitz | 必备 |
| Pillow | >=10.0 | 图像处理、缩略图 | PIL | 必备 |
| numpy | >=1.24 | 分栏检测（数值计算） | numpy | 必备 |
| opencv-python | >=4.8 | 分栏检测 | cv2 | 必备 |
| python-docx | >=1.0 | Word 导入（高保真转换） | docx | 必备 |
| paddleocr / paddlepaddle | 最新版 | 本地 OCR（PaddleOCR-VL） | paddleocr / paddle | 可选 |
| torch / transformers | 最新版 | 本地 OCR 的 chat 路径 | torch | 可选 |
| pypdfium2 | — | PDF 文本提取（**遗留**：对应脚本当前未接入流程） | pypdfium2 | 未使用 |

---

## 🔧 常见问题

### 1. pip命令找不到

**问题**: `'pip' 不是内部或外部命令`

**解决方案**:
```bash
# 方法1: 使用 python -m pip
python -m pip install -r requirements.txt

# 方法2: 添加Python Scripts目录到PATH
# 通常在: C:\Users\用户名\AppData\Local\Programs\Python\Python3xx\Scripts
```

### 2. OpenCV安装失败

**问题**: `opencv-python` 安装时出错

**解决方案**:
```bash
# 尝试安装headless版本（无GUI依赖，体积更小）
pip install opencv-python-headless>=4.8.0,<5.0.0

# 或者先更新pip后重试
python -m pip install --upgrade pip
pip install -r requirements.txt
```

### 3. PyMuPDF安装缓慢

**问题**: PyMuPDF下载速度很慢

**解决方案**:
```bash
# 使用国内镜像源
pip install -i https://pypi.tuna.tsinghua.edu.cn/simple -r requirements.txt

# 或使用其他镜像
pip install -i https://mirrors.aliyun.com/pypi/simple/ -r requirements.txt
```

### 4. 版本冲突

**问题**: 某些包版本不兼容

**解决方案**:
```bash
# 创建虚拟环境（推荐）
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt

# 或在现有环境中强制重新安装
pip install --force-reinstall -r requirements.txt
```

### 5. numpy版本过高

**问题**: numpy 2.x 与个别库不兼容

**解决方案**:
```bash
# requirements.txt 未设 numpy 上限；如遇个别库不兼容，可回退到 1.x
pip install "numpy>=1.24.0,<2.0.0"
```

### 6. 装了依赖但应用仍提示缺失

**问题**: 明明装了包，应用"依赖检测"仍报缺少

**原因**: 电脑上有多个 Python，应用用的是 **PATH 中第一个 `python`**，与你安装时用的可能不是同一个。

**解决方案**:
```bash
# 1. 查看应用实际会用哪个 python
where python

# 2. 用"第一个"那个 python 安装依赖
#    例如路径为 C:\Users\xxx\miniconda3\python.exe，则：
C:\Users\xxx\miniconda3\python.exe -m pip install -r requirements.txt
```

---

## ✅ 验证安装

导入无误即表示依赖可用：

```bash
python -c "import fitz, PIL, numpy, cv2, docx; print('所有依赖安装成功！')"
```

在应用中打开任一 PDF 教材并执行"分析"或"导出"，无报错即表示 Python 侧链路可用。

---

## 💡 最佳实践

### 1. 使用虚拟环境（强烈推荐）

虚拟环境可以避免不同项目的依赖冲突：

```bash
# 创建虚拟环境
python -m venv venv

# 激活虚拟环境 (Windows)
venv\Scripts\activate

# 激活虚拟环境 (macOS/Linux)
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 验证
python -c "import fitz, PIL, numpy, cv2, docx; print('依赖安装成功')"

# 退出虚拟环境
deactivate
```

> 注意：若使用虚拟环境，需让应用用到该环境的 `python`（应用取 PATH 中第一个 `python`）。

### 2. 定期更新依赖

```bash
# 检查可更新的包
pip list --outdated

# 更新所有包
pip install --upgrade -r requirements.txt
```

### 3. 冻结当前环境

如果您想记录当前确切的依赖版本：

```bash
pip freeze > requirements-freeze.txt
```

---

## 🐛 故障排除

### 问题：Python脚本运行时出错

**症状**: 在应用中使用PDF功能时报错

**排查步骤**:
1. 运行验证脚本: `python -c "import fitz, PIL, numpy, cv2, docx; print('依赖正常')"`
2. 检查是否有未安装的包
3. 重新安装缺失的包
4. 重启应用

### 问题：导入错误

**症状**: `ModuleNotFoundError: No module named 'xxx'`

**解决方案**:
```bash
# 确认使用的是正确的Python
where python

# 重新安装特定包
pip uninstall xxx
pip install xxx
```

### 问题：权限错误

**症状**: `PermissionError` 或 `Access denied`

**解决方案**:
```bash
# 使用用户级安装
pip install --user -r requirements.txt

# 或以管理员身份运行命令行
# 右键点击cmd/PowerShell → 以管理员身份运行
```

---

## 📚 相关文档

- [README.md](./README.md) - 安装与使用指南
- [项目文件夹说明.md](./项目文件夹说明.md) - 项目结构说明
- [源头防线总览.md](./源头防线总览.md) - 生成机制总览

---

## 📞 获取帮助

如果遇到问题：

1. 查看错误信息
2. 运行 `python -c "import fitz, PIL, numpy, cv2, docx; print('依赖正常')"` 检查依赖
3. 查阅本文档的"常见问题"部分
4. 在项目Issues中搜索类似问题
5. 提交新的Issue并附上错误日志

---

**最后更新**: 2026年9月10日  
**维护者**: 智卷工坊开发团队
