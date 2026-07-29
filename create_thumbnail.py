import sys
import os
from PIL import Image

# ✅ 设置编码
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

def create_thumbnail(source_path, dest_path, width=80, height=80):
    try:
        img = Image.open(source_path)
        img.thumbnail((width, height), Image.LANCZOS)
        
        dest_dir = os.path.dirname(dest_path)
        if not os.path.exists(dest_dir):
            os.makedirs(dest_dir)
        
        # 保存为 JPEG，质量 60%，大幅减小文件
        img.save(dest_path, 'JPEG', quality=60)
        return dest_path
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: create_thumbnail.py <source> <dest> [width] [height]")
        sys.exit(1)
    
    source = sys.argv[1]
    dest = sys.argv[2]
    width = int(sys.argv[3]) if len(sys.argv) > 3 else 80
    height = int(sys.argv[4]) if len(sys.argv) > 4 else 80
    
    result = create_thumbnail(source, dest, width, height)
    print(result)