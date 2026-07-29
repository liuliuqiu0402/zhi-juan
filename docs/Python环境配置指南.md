# 智卷工坊 - Python环境配置指南

本文档详细说明如何配置Python环境以支持智卷工坊的PDF处理和图像处理功能。

---

## 📋 系统要求

### Python版本
- **最低版本**: Python 3.9
- **推荐版本**: Python 3.10 或 3.11
- **最高版本**: Python 3.12（暂不支持3.13+）

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
# 双击运行
install.bat
```

### 方式二：手动安装
```bash
# 1. 安装所有依赖
pip install -r requirements.txt

# 2. 验证安装
python check_python_deps.py
```

---

## 📦 依赖清单

项目需要以下Python库：

| 包名 | 版本要求 | 用途 | 导入名称 |
|------|---------|------|---------|
| PyMuPDF | >=1.23.0, <2.0.0 | PDF处理、渲染、书签 | fitz |
| pypdfium2 | >=4.0.0, <5.0.0 | PDF文本提取 | pypdfium2 |
| Pillow | >=10.0.0, <11.0.0 | 图像处理、格式转换 | PIL |
| numpy | >=1.24.0, <2.0.0 | 数值计算、数组处理 | numpy |
| opencv-python | >=4.8.0, <5.0.0 | 计算机视觉、分栏检测 | cv2 |

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

# 或者先更新pip
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

**问题**: numpy 2.x 与某些库不兼容

**解决方案**:
```bash
# 降级到numpy 1.x
pip install "numpy>=1.24.0,<2.0.0"
```

---

## ✅ 验证安装

### 方法一：使用验证脚本（推荐）
```bash
python check_python_deps.py
```

**输出示例**:
```
============================================================
智卷工坊 - Python依赖检查
============================================================

包名                   版本              状态           说明
------------------------------------------------------------
PyMuPDF              1.27.2.3        ✅ 已安装    PDF处理库
pypdfium2            5.8.0           ✅ 已安装    PDF文本提取
Pillow               12.2.0          ✅ 已安装    图像处理库
numpy                2.3.5           ✅ 已安装    数值计算库
opencv-python        4.6.0.66        ✅ 已安装    计算机视觉库

============================================================
✅ 所有依赖已正确安装！

您可以正常使用智卷工坊的所有功能。
============================================================
```

### 方法二：手动验证
```python
python -c "import fitz; import pypdfium2; from PIL import Image; import numpy; import cv2; print('所有依赖安装成功！')"
```

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
python check_python_deps.py

# 退出虚拟环境
deactivate
```

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
1. 运行验证脚本: `python check_python_deps.py`
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

- [requirements.txt](requirements.txt) - Python依赖清单
- [check_python_deps.py](check_python_deps.py) - 依赖验证脚本
- [README.md](README.md) - 项目主文档
- [项目文件夹说明.md](项目文件夹说明.md) - 项目结构说明

---

## 📞 获取帮助

如果遇到问题：

1. 查看错误信息
2. 运行 `python check_python_deps.py` 检查依赖
3. 查阅本文档的"常见问题"部分
4. 在项目Issues中搜索类似问题
5. 提交新的Issue并附上错误日志

---

**最后更新**: 2026年5月21日  
**维护者**: 智卷工坊开发团队
