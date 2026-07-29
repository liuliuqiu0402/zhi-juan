#!/usr/bin/env python3
"""给 PDF 添加书签（目录）——从 JSON 文件读取书签数据"""
import sys
import json
import os

# 检查依赖
try:
    from pikepdf import Pdf, OutlineItem
    USE_PIKEPDF = True
except ImportError:
    try:
        from PyPDF2 import PdfReader, PdfWriter
        USE_PIKEPDF = False
    except ImportError:
        print("Error: 请安装 pikepdf 或 PyPDF2")
        print("  pip install pikepdf")
        print("  或")
        print("  pip install PyPDF2")
        sys.exit(1)


def add_bookmarks_pikepdf(pdf_path, bookmarks, output_path):
    """使用 pikepdf 添加书签"""
    pdf = Pdf.open(pdf_path)
    total_pages = len(pdf.pages)

    with pdf.open_outline() as outline:
        parents = {}
        for bm in bookmarks:
            title = bm.get('title', 'Untitled')
            page = bm.get('page', 1)
            level = bm.get('level', 1)

            # 页码修正
            target_page = max(0, min(page - 1, total_pages - 1))

            item = OutlineItem(title, target_page)

            if level <= 1:
                outline.root.append(item)
                parents[1] = item
                parents.pop(2, None)
                parents.pop(3, None)
            else:
                parent = parents.get(level - 1)
                if parent:
                    parent.children.append(item)
                else:
                    outline.root.append(item)
                parents[level] = item

    pdf.save(output_path)
    pdf.close()


def add_bookmarks_pypdf2(pdf_path, bookmarks, output_path):
    """使用 PyPDF2 添加书签"""
    reader = PdfReader(pdf_path)
    writer = PdfWriter()
    total_pages = len(reader.pages)

    for page in reader.pages:
        writer.add_page(page)

    if reader.metadata:
        try:
            writer.add_metadata(reader.metadata)
        except Exception as e:
            print(f"[Python] 警告：无法复制PDF元数据: {e}")
            # 不阻塞，继续添加书签

    parents = {}
    for bm in bookmarks:
        title = bm.get('title', 'Untitled')
        page = bm.get('page', 1)
        level = bm.get('level', 1)

        target_page = max(0, min(page - 1, total_pages - 1))

        if level <= 1:
            parent = writer.add_outline_item(title, target_page)
            parents[1] = parent
            parents.pop(2, None)
            parents.pop(3, None)
        else:
            parent_outline = parents.get(level - 1)
            if parent_outline:
                child = writer.add_outline_item(title, target_page, parent=parent_outline)
            else:
                child = writer.add_outline_item(title, target_page)
            parents[level] = child

    with open(output_path, 'wb') as f:
        writer.write(f)


def main():
    if len(sys.argv) < 3:
        print("用法: python add_bookmarks.py <pdf_path> <bookmarks_json_file> [output_path]")
        print("  bookmarks_json_file: 包含书签数据的 JSON 文件路径")
        sys.exit(1)

    pdf_path = sys.argv[1]
    json_file = sys.argv[2]
    output_path = sys.argv[3] if len(sys.argv) > 3 else None

    if not output_path:
        output_path = pdf_path.replace('.pdf', '_带书签.pdf')

    # 检查文件存在
    if not os.path.exists(pdf_path):
        print(f"Error: PDF 文件不存在: {pdf_path}")
        sys.exit(1)
    if not os.path.exists(json_file):
        print(f"Error: 书签 JSON 文件不存在: {json_file}")
        sys.exit(1)

    # 从文件读取书签
    with open(json_file, 'r', encoding='utf-8') as f:
        bookmarks = json.load(f)

    print(f"[Python] pdf_path: {pdf_path}")
    print(f"[Python] json_file: {json_file}")
    print(f"[Python] output_path: {output_path}")
    print(f"[Python] 书签数量: {len(bookmarks)}")

    if USE_PIKEPDF:
        add_bookmarks_pikepdf(pdf_path, bookmarks, output_path)
        print(f"[Python] 使用 pikepdf 完成")
    else:
        add_bookmarks_pypdf2(pdf_path, bookmarks, output_path)
        print(f"[Python] 使用 PyPDF2 完成")

    print(f"[Python] 输出: {output_path}")


if __name__ == '__main__':
    main()