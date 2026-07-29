import sys
import json
import fitz  # PyMuPDF
import io

# ✅ 强制设置标准输出为UTF-8编码（解决Windows乱码问题）
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# ✅ Windows编码修复函数
def fix_encoding(s):
    """修复Windows环境下可能的编码问题"""
    if sys.platform == 'win32' and isinstance(s, str):
        try:
            # 尝试从latin-1重新解码为UTF-8
            return s.encode('latin-1').decode('utf-8')
        except:
            return s
    return s

def extract_outline(pdf_path):
    """从PDF中提取书签/目录树"""
    try:
        doc = fitz.open(pdf_path)
        toc = doc.get_toc()  # [[level, title, page], ...]
        
        if not toc:
            return {
                "success": True,
                "outline": [],
                "message": "PDF无书签",
                "count": 0
            }
        
        # 转换为树形结构
        def build_tree(toc_list):
            root = []
            stack = []
            
            for level, title, page in toc_list:
                node = {
                    "title": title,
                    "page": page,
                    "level": level - 1,  # 转为0-based
                    "children": [],
                    "selected": False
                }
                
                # 维护栈结构：确保父节点在栈中
                while stack and stack[-1][0] >= level:
                    stack.pop()
                
                # 将当前节点添加到父节点的children
                if stack:
                    stack[-1][1]["children"].append(node)
                else:
                    root.append(node)
                
                # 将当前节点压入栈
                stack.append((level, node))
            
            return root
        
        outline = build_tree(toc)
        doc.close()
        
        return {
            "success": True,
            "outline": outline,
            "message": f"成功提取 {len(toc)} 个章节",
            "count": len(toc)
        }
        
    except Exception as e:
        return {
            "success": False,
            "outline": [],
            "message": f"提取失败: {str(e)}",
            "count": 0
        }

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({
            "success": False,
            "outline": [],
            "message": "缺少PDF路径参数",
            "count": 0
        }, ensure_ascii=False))
        sys.exit(1)
    
    # ✅ 修复Windows编码问题
    pdf_path = fix_encoding(sys.argv[1])
    result = extract_outline(pdf_path)
    print(json.dumps(result, ensure_ascii=False))
