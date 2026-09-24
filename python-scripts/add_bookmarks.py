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
        # 🔴 覆盖而不是追加（2026-09-24 用户实证："导出的 PDF 里有两份书签，往下滚动还有一份
        #    带手动添加的全的"）。原因：源 PDF 常常**自带大纲**（或这份源文件本身就是上次生成的
        #    带书签 PDF），pikepdf 的 open_outline() 拿到的是**已有**大纲，直接 append 就会把
        #    旧的一套和新的一套叠在一起 → 阅读器里看到两份。
        #    本工具产出的是"编辑器里那份目录"的唯一权威版本，所以先清空再写。
        outline.root.clear()

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
                parents.clear()          # 新的一级章节：此前所有祖先全部作废
                parents[1] = item
            else:
                parent = parents.get(level - 1)
                if parent:
                    parent.children.append(item)
                else:
                    # 父级不存在（层级跳档，或首项就是子级）→ 退到顶层，
                    # 绝不挂到"过期祖先"上
                    outline.root.append(item)
                # 🔴 关键修正：只保留 <= 当前层级 的祖先，清掉更深的过期条目。
                #    原实现只 pop 2/3，四级、五级祖先永远残留 —— 手动新增的章节
                #    会继承上一章的深层 level，于是被挂到**很早已出现的过期祖先**下，
                #    在书签树里跑到别的章节里去了；用户看到的现象就是
                #    "编辑框里明明有、保存的 PDF 书签里却没有"。
                for k in [k for k in parents if k > level]:
                    parents.pop(k, None)
                parents[level] = item

    pdf.save(output_path)
    pdf.close()


def add_bookmarks_pypdf2(pdf_path, bookmarks, output_path):
    """使用 PyPDF2 添加书签"""
    # 注：此分支是"新建 writer + 逐页搬页"，原 PDF 的大纲不会被搬过来 → 天然就是覆盖语义，
    # 不存在 pikepdf 分支那种"旧大纲残留导致两份书签"的问题，无需额外清空。
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
            parents.clear()              # 新的一级章节：此前所有祖先全部作废
            parents[1] = parent
        else:
            parent_outline = parents.get(level - 1)
            if parent_outline:
                child = writer.add_outline_item(title, target_page, parent=parent_outline)
            else:
                # 父级不存在（层级跳档，或首项就是子级）→ 退到顶层
                child = writer.add_outline_item(title, target_page)
            # 同 pikepdf 分支：清掉比当前层级更深的过期祖先（原因见上）
            for k in [k for k in parents if k > level]:
                parents.pop(k, None)
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