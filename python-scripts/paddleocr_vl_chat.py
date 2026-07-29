#!/usr/bin/env python3
"""
PaddleOCR-VL 统一多模态脚本
- pipeline 模式：使用 PaddleOCRVL pipeline 做结构化文档解析（OCR 提取）
- chat 模式：使用 transformers VLM 做端到端视觉语言理解（图片描述/问答）

用法:
  pipeline: python paddleocr_vl_chat.py --mode pipeline --prompt "指令" --image "path1"
  chat:     python paddleocr_vl_chat.py --mode chat --prompt "描述这张图" --image "path1"

输出 JSON: {"success": true, "text": "...", "error": null}
"""
import sys
import json
import io
import os
import re
import argparse
import tempfile
import time
import base64 as b64

# PaddlePaddle GPU 内存策略：按需分配而非预分配全部显存，避免初始化卡死
os.environ['FLAGS_allocator_strategy'] = 'auto_growth'

# 通过 PYTHONIOENCODING 环境变量设置 UTF-8（由 main.js spawn 时传入），
# 不要用 io.TextIOWrapper 包装 stdout/stderr —— 当子进程通过 pipe 通信时，
# TextIOWrapper 会启用全缓冲，导致输出卡在缓冲区，Node.js 端收不到数据而超时。
# 脚本自身只需确保 flush 即可。


def init_pipeline(use_gpu=True):
    """初始化 PaddleOCR-VL pipeline，支持 GPU/CPU 自动降级"""
    try:
        from paddleocr import PaddleOCRVL
        import paddle
        
        if not use_gpu:
            print("[PaddleOCR-VL] 强制 CPU 模式", file=sys.stderr)
            paddle.set_device('cpu')
        else:
            gpu_available = paddle.is_compiled_with_cuda() and paddle.device.cuda.device_count() > 0
            if gpu_available:
                gpu_count = paddle.device.cuda.device_count()
                print(f"[PaddleOCR-VL] 初始化 pipeline (GPU=ON, 设备数={gpu_count})...", file=sys.stderr)
                # 打印显存状态
                for i in range(gpu_count):
                    try:
                        mem_info = paddle.device.cuda.mem_info(i)
                        free_mb = mem_info.get('free', 0) / (1024**2)
                        total_mb = mem_info.get('total', 0) / (1024**2)
                        print(f"[PaddleOCR-VL] GPU{i}: 空闲 {free_mb:.0f}MB / 总计 {total_mb:.0f}MB", file=sys.stderr)
                    except Exception:
                        pass
            else:
                print("[PaddleOCR-VL] GPU 不可用，降级到 CPU", file=sys.stderr)
                paddle.set_device('cpu')
        
        print("[PaddleOCR-VL] 正在创建 PaddleOCRVL 实例...", file=sys.stderr)
        t0 = time.time()
        # 显式指定模型路径，避免自动查找时卡在缺失文件
        model_base = os.path.expanduser('~/.paddlex/official_models')
        pipeline = PaddleOCRVL(
            layout_detection_model_dir=os.path.join(model_base, 'PP-DocLayoutV3'),
            vl_rec_model_dir=os.path.join(model_base, 'PaddleOCR-VL-1.6'),
            use_doc_orientation_classify=True,    # 自动校正文档旋转/倒置
            use_doc_unwarping=True,               # 矫正弯曲/倾斜页面，扫描件关键
        )
        elapsed = time.time() - t0
        print(f"[PaddleOCR-VL] pipeline 初始化完成 (耗时 {elapsed:.1f}s)", file=sys.stderr)
        return pipeline
    except ImportError as e:
        print(f"[PaddleOCR-VL] 导入失败: {e}", file=sys.stderr)
        print("[PaddleOCR-VL] 请确认已安装: pip install paddleocr", file=sys.stderr)
        return None
    except Exception as e:
        print(f"[PaddleOCR-VL] 初始化异常: {e}", file=sys.stderr)
        if use_gpu:
            print("[PaddleOCR-VL] GPU 模式失败，尝试 CPU 降级...", file=sys.stderr)
            return init_pipeline(use_gpu=False)
        return None


def embed_images_as_base64(markdown_text, markdown_images):
    """将 Markdown 中的相对路径图片替换为 base64 内嵌图片
    
    PaddleOCR-VL 输出的 <img src="imgs/img_xxx.jpg"> 指向内存中的 PIL Image，
    相对路径在浏览器/编辑器中无效。将 PIL Image 转为 base64 data URI 嵌入。
    限制尺寸 ≤400px 宽、JPEG quality=70，避免 JSON 膨胀。
    """
    if not markdown_images or not markdown_text:
        return markdown_text
    
    try:
        from PIL import Image
    except ImportError:
        return markdown_text  # PIL 不可用时保持原样
    
    result = markdown_text
    for name, pil_img in markdown_images.items():
        try:
            # 限制图片尺寸，避免 base64 过大
            w, h = pil_img.size
            if w > 400:
                ratio = 400.0 / w
                pil_img = pil_img.resize((400, int(h * ratio)), Image.LANCZOS)
            
            buf = io.BytesIO()
            pil_img.convert('RGB').save(buf, format='JPEG', quality=70)
            img_b64 = b64.b64encode(buf.getvalue()).decode('utf-8')
            
            # 替换 Markdown 中的 <img src="...文件名..."> 为 base64
            escaped = re.escape(name)
            result = re.sub(
                r'src="[^"]*' + escaped + r'"',
                f'src="data:image/jpeg;base64,{img_b64}"',
                result,
                count=1
            )
        except Exception:
            pass  # 单张图片失败不影响其他
    
    return result


def extract_text_from_result(res):
    """从 PaddleOCRVLResult 对象中提取文本内容"""
    
    # 方法1: Markdown 直接访问（目录页整合效果最好，不丢数据）
    try:
        md = res.markdown
        if isinstance(md, dict) and md.get('markdown_texts'):
            text = str(md['markdown_texts']).strip()
            images = md.get('markdown_images', {})
            if images:
                text = embed_images_as_base64(text, images)
            return text
    except Exception:
        pass
    
    # 方法2: save_to_markdown 保存后读取（完整保真，比 JSON 块解析可靠）
    try:
        tmp_fd, tmp_path = tempfile.mkstemp(suffix='_ocr')
        os.close(tmp_fd)
        res.save_to_markdown(save_path=tmp_path)
        md_path = tmp_path + '.md'
        if os.path.exists(md_path):
            with open(md_path, 'r', encoding='utf-8') as f:
                text = f.read()
            os.unlink(md_path)
            if text.strip():
                return text.strip()
    except Exception:
        pass
    finally:
        try:
            for p in [tmp_path, tmp_path + '.md']:
                if os.path.exists(p):
                    os.unlink(p)
        except Exception:
            pass
    
    # 方法3: JSON 块解析（Markdown 全部失败时才用，可能丢内容）
    try:
        j = res.json
        if isinstance(j, dict):
            prl = j.get('res', {}).get('parsing_res_list', [])
        else:
            prl = []
        parts = []
        for item in prl:
            if isinstance(item, dict):
                label = item.get('block_label', '')
                content = item.get('block_content', '')
                if content and content.strip():
                    if label == 'table':
                        parts.append(f'[表格]\n{content.strip()}\n[/表格]')
                    else:
                        parts.append(content.strip())
        text = '\n'.join(parts)
        if text.strip():
            return text.strip()
    except Exception:
        pass
    
    # 方法4: save_to_json 保存后读取
    try:
        tmp_fd2, tmp_path2 = tempfile.mkstemp(suffix='_ocr')
        os.close(tmp_fd2)
        res.save_to_json(save_path=tmp_path2)
        json_path = tmp_path2 + '.json'
        if os.path.exists(json_path):
            with open(json_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            os.unlink(json_path)
            # 尝试从 JSON 的 markdown 字段提取
            if isinstance(data, dict):
                for key in ['markdown_texts', 'markdown', 'text']:
                    val = data.get(key, '')
                    if val:
                        return str(val).strip()
                # 尝试 res 子字段
                res_data = data.get('res', {})
                if isinstance(res_data, dict):
                    for key in ['markdown_texts', 'markdown', 'text']:
                        val = res_data.get(key, '')
                        if val:
                            return str(val).strip()
    except Exception:
        pass
    finally:
        try:
            for p in [tmp_path2, tmp_path2 + '.json']:
                if os.path.exists(p):
                    os.unlink(p)
        except Exception:
            pass
    
    # 方法5: 兜底
    try:
        return str(res)
    except Exception:
        return ""


def process_image(pipeline, image_path, prompt=""):
    """处理单张图片，返回识别的文本"""
    if not os.path.exists(image_path):
        return {"path": image_path, "text": "", "length": 0, "error": "文件不存在"}

    try:
        print(f"[PaddleOCR-VL] 处理: {os.path.basename(image_path)}", file=sys.stderr)
        if prompt:
            print(f"[PaddleOCR-VL] 上下文指令: {prompt[:120]}...", file=sys.stderr)

        # 🔧 预处理：高反差灰度化，把灰色页码等浅色文字变深
        processed_path = image_path
        try:
            from PIL import Image, ImageEnhance
            img = Image.open(image_path).convert('L')  # 转灰度
            enhancer = ImageEnhance.Contrast(img)
            img = enhancer.enhance(2.0)  # 对比度翻倍：浅灰→深灰，深色→黑色
            fd, processed_path = tempfile.mkstemp(suffix='_contrast.png')
            os.close(fd)
            img.save(processed_path)
            print(f"[PaddleOCR-VL] 对比度增强完成", file=sys.stderr)
        except Exception as e:
            print(f"[PaddleOCR-VL] 预处理跳过: {e}", file=sys.stderr)

        output = pipeline.predict(processed_path, prompt=prompt if prompt else None)

        if not output:
            return {"path": image_path, "text": "", "length": 0, "warning": "未检测到内容"}

        # 提取所有结果的文本
        text_parts = []
        for res in output:
            extracted = extract_text_from_result(res)
            if extracted:
                text_parts.append(extracted)

        full_text = '\n\n'.join(text_parts)
        
        # 🔧 移除 base64 内嵌图片（>100字符的 data:image URI，对 NLP 无意义且会让 JSON 解析失败）
        full_text = re.sub(r'<img\s+[^>]*src="data:image/[^"]{100,}"[^>]*>', '[图片]', full_text)
        # 🔧 移除残留的 div/span 等空壳标签（仅移除不含文本的 HTML 标签）
        full_text = re.sub(r'<(div|span|p)\b[^>]*>\s*</\1>', '', full_text)

        # 🔧 清理预处理临时文件
        if processed_path != image_path:
            try:
                os.unlink(processed_path)
            except Exception:
                pass

        return {
            "path": image_path,
            "text": full_text,
            "length": len(full_text),
        }

    except Exception as e:
        return {"path": image_path, "text": "", "length": 0, "error": str(e)}


# ==================== Chat 模式（VLM 对话） ====================

# 模型目录：优先使用工作区副本（已修复兼容性问题）
_CHAT_MODEL_DIR = None


def _get_chat_model_dir():
    """获取 chat 模式模型目录，优先工作区副本"""
    global _CHAT_MODEL_DIR
    if _CHAT_MODEL_DIR:
        return _CHAT_MODEL_DIR
    # 工作区副本（已修复 modeling_paddleocr_vl.py L608 inputs_embeds→input_embeds）
    workspace_copy = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'PaddleOCR-VL-model')
    if os.path.isdir(workspace_copy):
        _CHAT_MODEL_DIR = workspace_copy
        return _CHAT_MODEL_DIR
    # 回退到原始路径
    fallback = os.path.join(os.path.expanduser('~'), '.paddlex', 'official_models', 'PaddleOCR-VL-1.6')
    if os.path.isdir(fallback):
        _CHAT_MODEL_DIR = fallback
        return _CHAT_MODEL_DIR
    return None


def init_chat_model():
    """初始化 transformers VLM chat 模型"""
    import torch
    from transformers import AutoModel, AutoProcessor
    
    model_dir = _get_chat_model_dir()
    if not model_dir:
        print("[PaddleOCR-VL Chat] 模型目录不存在", file=sys.stderr)
        return None, None
    
    print(f"[PaddleOCR-VL Chat] 模型目录: {model_dir}", file=sys.stderr)
    print(f"[PaddleOCR-VL Chat] CUDA 可用: {torch.cuda.is_available()}", file=sys.stderr)
    
    free, total = torch.cuda.mem_get_info()
    print(f"[PaddleOCR-VL Chat] GPU 显存: {free/1024**3:.1f}GB 空闲 / {total/1024**3:.1f}GB 总计", file=sys.stderr)
    
    t0 = time.time()
    processor = AutoProcessor.from_pretrained(model_dir, trust_remote_code=True)
    print(f"[PaddleOCR-VL Chat] Processor 加载完成 ({time.time()-t0:.1f}s)", file=sys.stderr)
    
    t0 = time.time()
    model = AutoModel.from_pretrained(
        model_dir,
        trust_remote_code=True,
        dtype=torch.bfloat16,
        device_map='auto'
    )
    elapsed = time.time() - t0
    free2, _ = torch.cuda.mem_get_info()
    print(f"[PaddleOCR-VL Chat] 模型加载完成 ({elapsed:.1f}s), GPU 剩余: {free2/1024**3:.1f}GB", file=sys.stderr)
    
    return processor, model


def chat_inference(processor, model, image, prompt, max_tokens=256):
    """执行 VLM chat 推理"""
    import torch
    from PIL import Image
    
    if isinstance(image, str):
        image = Image.open(image).convert('RGB')
    
    # 限制图片分辨率以加快推理
    w, h = image.size
    max_dim = 800
    if max(w, h) > max_dim:
        ratio = max_dim / max(w, h)
        image = image.resize((int(w * ratio), int(h * ratio)), Image.LANCZOS)
        print(f"[PaddleOCR-VL Chat] 图片缩放: {w}x{h} → {image.size[0]}x{image.size[1]}", file=sys.stderr)
    
    messages = [{
        'role': 'user',
        'content': [
            {'type': 'image', 'image': image},
            {'type': 'text', 'text': prompt}
        ]
    }]
    
    text_prompt = processor.apply_chat_template(messages, add_generation_prompt=True, tokenize=False)
    inputs = processor(text=text_prompt, images=image, return_tensors='pt').to(model.device)
    
    print(f"[PaddleOCR-VL Chat] 输入 tokens: {inputs.input_ids.shape[1]}", file=sys.stderr)
    
    t0 = time.time()
    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=max_tokens,
            do_sample=False,
        )
    elapsed = time.time() - t0
    
    n_new = outputs.shape[1] - inputs.input_ids.shape[1]
    print(f"[PaddleOCR-VL Chat] 生成完成: {n_new} tokens / {elapsed:.1f}s ({n_new/elapsed:.1f} tok/s)", file=sys.stderr)
    
    response = processor.decode(outputs[0], skip_special_tokens=True)
    # 剥离 prompt 部分，只保留模型回复
    if text_prompt in response:
        response = response[len(text_prompt):].strip()
    
    return response


def main_chat(args):
    """Chat 模式入口"""
    image_path = args.image[0]  # chat 模式只处理单张图片
    prompt = args.prompt or '请描述这张图片的内容。'
    max_tokens = args.max_tokens or 256
    
    processor, model = init_chat_model()
    if processor is None or model is None:
        print(json.dumps({
            "success": False,
            "error": "PaddleOCR-VL chat 模型初始化失败"
        }, ensure_ascii=False))
        sys.exit(1)
    
    try:
        text = chat_inference(processor, model, image_path, prompt, max_tokens)
        output = {
            "success": True,
            "text": text,
            "total_length": len(text),
            "page_count": 1,
        }
        print(json.dumps(output, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": f"Chat 推理失败: {e}"
        }, ensure_ascii=False))
        sys.exit(1)


# ==================== 主入口 ====================

def main():
    parser = argparse.ArgumentParser(description='PaddleOCR-VL 统一多模态脚本')
    parser.add_argument('--mode', type=str, default='pipeline',
                        choices=['pipeline', 'chat'],
                        help='运行模式: pipeline（文档解析/OCR）| chat（VLM 对话）')
    parser.add_argument('--prompt', type=str, default='',
                        help='自然语言指令')
    parser.add_argument('--image', type=str, action='append', required=True,
                        help='图片路径（可多次指定；chat 模式只用第一张）')
    parser.add_argument('--max-tokens', type=int, default=None,
                        help='chat 模式最大生成 token 数（默认 256）')
    args = parser.parse_args()

    # chat 模式：走 VLM 对话
    if args.mode == 'chat':
        main_chat(args)
        return

    # pipeline 模式：走文档解析（默认行为，保持向后兼容）
    prompt = args.prompt
    image_paths = args.image

    # 检测环境变量控制 GPU
    use_gpu = os.environ.get('PADDLE_OCR_GPU', '1') == '1'

    # 初始化 pipeline
    pipeline = init_pipeline(use_gpu=use_gpu)
    if pipeline is None:
        print(json.dumps({
            "success": False,
            "error": "PaddleOCR-VL pipeline 初始化失败，请确认已安装: pip install paddleocr"
        }, ensure_ascii=False))
        sys.exit(1)

    # 逐张处理
    pages = []
    all_text_parts = []
    total = len(image_paths)

    for i, img_path in enumerate(image_paths):
        print(f"[PaddleOCR-VL] ({i+1}/{total}): {os.path.basename(img_path)}", file=sys.stderr)
        page_result = process_image(pipeline, img_path, prompt)
        pages.append(page_result)

        if page_result.get("text"):
            all_text_parts.append(page_result["text"])

    # 合并所有页面文本
    full_text = '\n\n---\n\n'.join(all_text_parts)

    output = {
        "success": True,
        "text": full_text,
        "total_length": len(full_text),
        "page_count": len(pages),
        "pages": pages,
    }

    print(json.dumps(output, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": str(e)
        }, ensure_ascii=False))
        sys.exit(1)
