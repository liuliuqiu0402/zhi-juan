#!/usr/bin/env python3
"""
PDF 原生文字提取（不走 OCR，与网页版 MinerU 配置一致）
接收 PDF 路径，提取原生文字层，返回 JSON 格式文本
用法: python pdf_text_extractor.py <pdf_path> <page_number>

注意：
- 这是网页版 MinerU 使用的方案（关闭 OCR，直接提取原生文字）
- 适用于有原生文字层的 PDF（教材、教辅等）
- 不适用扫描件（扫描件需要用 OCR）
"""
import sys
import json
import pypdfium2

def extract_pdf_text(pdf_path, page_number=0):
    """提取 PDF 指定页的原生文字"""
    try:
        pdf = pypdfium2.PdfDocument(pdf_path)
        
        if page_number < 0 or page_number >= len(pdf):
            return {
                "success": False,
                "error": f"页码 {page_number} 超出范围（共 {len(pdf)} 页）"
            }
        
        page = pdf[page_number]
        textpage = page.get_textpage()
        
        # 提取文字（保留原始格式）
        text = textpage.get_text_range()
        
        pdf.close()
        
        # 清理多余空行
        lines = [line.strip() for line in text.split('\n')]
        lines = [line for line in lines if line]  # 过滤空行
        cleaned_text = '\n'.join(lines)
        
        return {
            "success": True,
            "text": cleaned_text,
            "length": len(cleaned_text),
            "page": page_number,
            "total_pages": len(pdf)
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "用法: python pdf_text_extractor.py <pdf_path> [page_number]"}))
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    page_number = int(sys.argv[2]) if len(sys.argv) > 2 else 0
    
    result = extract_pdf_text(pdf_path, page_number)
    print(json.dumps(result, ensure_ascii=False))
