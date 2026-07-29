#!/usr/bin/env python3
"""检测图片分栏并切割为单栏子图（支持空白分隔、竖线分隔、混合排版）"""
import sys
import json
import os
from PIL import Image
import numpy as np
import cv2


def detect_vertical_lines(arr, width, height, min_line_length_ratio=0.4):
    """使用 Canny 边缘检测 + 霍夫变换检测纵向竖线"""
    # 转 uint8（0-255）
    if arr.dtype != np.uint8:
        arr_uint8 = arr.astype(np.uint8)
    else:
        arr_uint8 = arr
    
    # Canny 边缘检测
    edges = cv2.Canny(arr_uint8, 50, 150)
    
    # 霍夫直线检测
    min_line_length = int(height * min_line_length_ratio)
    lines = cv2.HoughLinesP(edges, 1, np.pi / 2, threshold=100,
                            minLineLength=min_line_length, maxLineGap=20)
    
    vertical_line_positions = []
    if lines is not None:
        for line in lines:
            x1, y1, x2, y2 = line[0]
            # 只保留接近垂直的线（斜率在 ±5 度以内）
            if abs(x1 - x2) < 10 and abs(y1 - y2) > height * 0.3:
                vertical_line_positions.append((x1 + x2) // 2)
    
    # 去重：合并距离小于15px的临近线
    vertical_line_positions.sort()
    merged = []
    for x in vertical_line_positions:
        if not merged or x - merged[-1] > 15:
            merged.append(x)
    
    return merged


def detect_columns(image_path, min_column_width=200):
    """检测图片中的分栏并切割子图（融合方差法和竖线检测）"""
    img_gray = Image.open(image_path).convert('L')
    width, height = img_gray.size
    arr = np.array(img_gray)
    
    # ========== 方法一：像素方差法（检测空白分隔） ==========
    col_variances = []
    for x in range(width):
        col = arr[:, x]
        col_variances.append(float(np.var(col)))
    
    # 自适应阈值：基于方差的中位数和标准差
    var_mean = float(np.mean(col_variances))
    var_std = float(np.std(col_variances))
    # 低方差 = 空白区域，阈值设在中位数和均值之间偏保守的位置
    variance_threshold = max(var_mean * 0.15, var_mean - var_std * 0.5, 5.0)
    
    blank_columns = []
    in_blank = False
    blank_start = 0
    
    for x, var in enumerate(col_variances):
        if var < variance_threshold and not in_blank:
            in_blank = True
            blank_start = x
        elif var >= variance_threshold and in_blank:
            in_blank = False
            gap_width = x - blank_start
            if gap_width >= 12:  # 至少12px宽的空白才算有效间隙
                blank_columns.append((blank_start, x))
    
    # 处理末尾未闭合的空白
    if in_blank:
        if width - blank_start >= 12:
            blank_columns.append((blank_start, width))
    
    # ========== 方法二：竖线检测（检测分隔线） ==========
    vertical_lines = detect_vertical_lines(arr, width, height, min_line_length_ratio=0.4)
    
    # ========== 融合两种方法的结果 ==========
    blank_splits = []
    for start, end in blank_columns:
        gap_width = end - start
        # 排除页面边缘的空白（页边距）
        if start > 30 and end < width - 30:
            if gap_width >= 20:
                # 宽空白：取中点
                blank_splits.append((start + end) // 2)
            elif gap_width >= 12:
                # 窄空白但有竖线佐证：也取为切割点
                nearby_line = any(abs((start + end) // 2 - vl) < 30 for vl in vertical_lines)
                if nearby_line:
                    blank_splits.append((start + end) // 2)
    
    # 竖线中不在空白区域的，也加入（有竖线但周围不空白的，说明是实线分隔）
    for vl in vertical_lines:
        if 30 < vl < width - 30:
            too_close = any(abs(vl - bs) < 15 for bs in blank_splits)
            if not too_close:
                blank_splits.append(vl)
    
    # 排序去重
    blank_splits = sorted(set(blank_splits))
    
    # 过滤：相邻切割点之间至少要有 min_column_width
    filtered_splits = []
    prev = 0
    for sp in blank_splits:
        if sp - prev >= min_column_width:
            filtered_splits.append(sp)
            prev = sp
    blank_splits = filtered_splits
    
    # ========== 构建切割区域 ==========
    if len(blank_splits) == 0:
        return {"columns": 1, "splits": [], "regions": [(0, 0, width, height)], "sub_images": []}
    
    splits = [0] + blank_splits + [width]
    regions = []
    for i in range(len(splits) - 1):
        x1 = splits[i]
        x2 = splits[i + 1]
        if x2 - x1 >= min_column_width:
            regions.append((x1, 0, x2, height))
    
    # 如果切割后只剩1栏或更少，返回单栏
    if len(regions) <= 1:
        return {"columns": 1, "splits": [], "regions": [(0, 0, width, height)], "sub_images": []}
    
    result = {
        "columns": len(regions),
        "splits": blank_splits,
        "regions": regions,
        "sub_images": []
    }
    
    # ========== 切割子图并压缩转 Base64 返回（避免中文路径乱码） ==========
    import base64
    from io import BytesIO
    
    img_color = Image.open(image_path)
    for i, (x1, y1, x2, y2) in enumerate(regions):
        sub_img = img_color.crop((x1, y1, x2, y2))
        
        # 🔧 智能压缩：宽度超过 800px 的缩小到 800px（保持长宽比），保障 OCR 精度
        orig_w, orig_h = sub_img.size
        max_width = 800
        if orig_w > max_width:
            ratio = max_width / orig_w
            new_h = int(orig_h * ratio)
            sub_img = sub_img.resize((max_width, new_h), Image.LANCZOS)
        
        # 🔧 转为 JPEG 格式（压缩率 85%），比 PNG 小很多
        buffer = BytesIO()
        # 如果是纯图表/扫描件，RGB 模式；如果不是转成 RGB
        if sub_img.mode != 'RGB':
            sub_img = sub_img.convert('RGB')
        sub_img.save(buffer, format='JPEG', quality=85)
        sub_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
        result["sub_images"].append(sub_base64)
        
        # 🔧 打印压缩后大小（调试用）
        compressed_kb = len(buffer.getvalue()) / 1024
        print(f"  └─ 第{i+1}栏: {orig_w}×{orig_h} → {sub_img.size[0]}×{sub_img.size[1]}, JPEG {compressed_kb:.0f}KB", file=sys.stderr)
    
    # 同时保存到磁盘（供调试）
    try:
        os.makedirs(output_dir, exist_ok=True)
        for i, (x1, y1, x2, y2) in enumerate(regions):
            sub_img = img_color.crop((x1, y1, x2, y2))
            sub_path = os.path.join(output_dir, f"col_{i+1}.png")
            sub_img.save(sub_path)
    except:
        pass
    
    return result


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print(json.dumps({"error": "用法: python split_columns.py <image_path> <output_dir>"}))
        sys.exit(1)
    
    image_path = sys.argv[1]
    output_dir = sys.argv[2]
    
    result = detect_columns(image_path)
    print(json.dumps(result, ensure_ascii=False))