import sys
import os
import json
import fitz
import io
from PIL import Image

# 强制设置标准输出为UTF-8编码
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

def fix_encoding(s):
    if sys.platform == 'win32' and isinstance(s, str):
        try:
            return s.encode('latin-1').decode('utf-8')
        except:
            return s
    return s

def pdf_to_images(pdf_path, output_dir, format='jpeg', quality=70, page_range=None, max_width=1500):
    """
    PDF转图片，压缩后输出
    - format: 'jpeg' 或 'png'
    - quality: JPEG质量 1-100
    - max_width: 图片最大宽度，超过会等比缩放
    """
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    doc = fitz.open(pdf_path)
    total_pages = len(doc)
    
    # 解析页码范围
    pages_to_convert = []
    if page_range:
        parts = page_range.split('-')
        if len(parts) == 2:
            start = int(parts[0]) - 1
            end = int(parts[1]) - 1
            pages_to_convert = list(range(max(0, start), min(end + 1, total_pages)))
        else:
            page = int(parts[0]) - 1
            pages_to_convert = [page] if 0 <= page < total_pages else []
    else:
        pages_to_convert = list(range(total_pages))

    for page_num in pages_to_convert:
        page = doc.load_page(page_num)
        
        # 计算缩放比例，确保宽度不超过 max_width
        page_width = page.rect.width
        scale = min(2.0, max_width / page_width * 2.0) if page_width > 0 else 2.0
        mat = fitz.Matrix(scale, scale)
        pix = page.get_pixmap(matrix=mat, colorspace="rgb")
        
        # 先保存为临时PNG
        temp_path = os.path.join(output_dir, f"page_{page_num + 1:03d}_temp.png")
        pix.save(temp_path)
        
        # 用Pillow压缩
        img = Image.open(temp_path)
        
        if img.width > max_width:
            ratio = max_width / img.width
            new_size = (max_width, int(img.height * ratio))
            img = img.resize(new_size, Image.LANCZOS)
        
        # 转为RGB（去掉透明通道）
        if img.mode in ('RGBA', 'P'):
            img = img.convert('RGB')
        
        # 保存为JPEG（比PNG小很多）
        output_path = os.path.join(output_dir, f"page_{page_num + 1:03d}.jpg")
        img.save(output_path, 'JPEG', quality=quality)
        img.save(output_path, format.upper(), quality=quality)
        
        # 删除临时PNG
        os.remove(temp_path)

    doc.close()
    return {"total_pages": total_pages, "converted": len(pages_to_convert), "format": format, "quality": quality}

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"error": "参数不足"}))
        sys.exit(1)

    pdf_path = fix_encoding(sys.argv[1])
    output_dir = fix_encoding(sys.argv[2])
    page_range = fix_encoding(sys.argv[3]) if len(sys.argv) > 3 else None
    
    try:
        result = pdf_to_images(pdf_path, output_dir, format='jpeg', quality=70, page_range=page_range)
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False))
        sys.exit(1)