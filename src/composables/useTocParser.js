export function useTocParser() {
  
  // 全局页码范围计算函数（两阶段自底向上计算）
  // 适用于 parseClipboardText, rebuildTree 和 applyOffset 场景
  const computeEndGlobal = (treeNodes, totalPages) => {
    if (!treeNodes || treeNodes.length === 0) return;

    // 第一阶段：收集所有叶子节点（按全局顺序）
    const allLeafNodes = [];
    const collectLeafNodes = (nodes) => {
      for (const node of nodes) {
        if (!node.children || node.children.length === 0) {
          allLeafNodes.push(node);
        } else {
          collectLeafNodes(node.children);
        }
      }
    };
    collectLeafNodes(treeNodes);

    // 基于叶子节点的全局顺序计算end
    for (let i = 0; i < allLeafNodes.length; i++) {
      const current = allLeafNodes[i];
      current.start = current.page;
      
      let endPage = totalPages;
      // 查找下一个页码更大的叶子节点
      for (let j = i + 1; j < allLeafNodes.length; j++) {
        if (allLeafNodes[j].page > current.page) {
          endPage = allLeafNodes[j].page - 1;
          break;
        }
      }
      
      current.end = Math.max(current.start, endPage);
    }

    // 第二阶段：计算父节点的end（= 最后一个子节点的end）
    const computeParentEnd = (nodes) => {
      for (const node of nodes) {
        if (node.children && node.children.length > 0) {
          computeParentEnd(node.children);
          const lastChild = node.children[node.children.length - 1];
          node.end = lastChild.end;
          node.start = node.page;
        }
      }
    };
    computeParentEnd(treeNodes);
  };

  // 解析剪贴板中的目录文本
  const parseClipboardText = (text, totalPages = 100) => {
    if (!text || !text.trim()) {
      return { success: false, chapters: [], error: '剪贴板为空' };
    }

    // 🔧 规范化：统一处理 \r\n 和 \r 行尾
    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '');
    const lines = normalized.split('\n').filter(l => l.trim());

    console.log(`📋 [parseClipboardText] 共 ${lines.length} 行，前3行:`, lines.slice(0, 3));
    
    // 检测是否为模板格式（Tab 缩进）
    const hasTabs = text.includes('\t');
    const hasMultipleSpaces = lines.some(l => l.match(/^    /)); // 4 个空格缩进
    
    // 新增：检测是否为 CSV 格式（包含逗号且非纯数字/空格行）
    const isCsvFormat = lines.some(l => l.includes(',') && l.split(',').length >= 2);

    let chapters = [];

    // 新增：CSV 格式解析逻辑
    if (isCsvFormat) {
      for (const line of lines) {
        // 跳过说明行或空行
        if (line.includes('━━━━━━━━') || line.includes('📌') || line.includes('使用说明')) continue;
        
        const parts = line.split(',');
        if (parts.length >= 3) {
          const title = parts[0].trim();
          // 过滤掉表头
          if (title === '章节标题') continue;
          
          const page = parseInt(parts[1].trim()) || 1;
          const levelText = parts[2].trim();
          
          // 映射层级
          let level = 0;
          if (levelText.includes('二级')) level = 1;
          else if (levelText.includes('三级')) level = 2;
          
          if (title) {
            chapters.push({
              title,
              page,
              level,
              children: [],
              start: page,
              end: 0
            });
          }
        }
      }
      
      // 如果解析到了 CSV 数据，直接进行后续处理，跳过原有的缩进逻辑
      if (chapters.length > 0) {
        // 构建树形结构
        const root = [];
        const stack = [];
        
        for (const item of chapters) {
          item.start = item.page;
          item.end = totalPages;
          
          while (stack.length > item.level) {
            stack.pop();
          }
          
          if (stack.length === 0) {
            root.push(item);
          } else {
            stack[stack.length - 1].children.push(item);
          }
          stack.push(item);
        }

        // 使用全局计算函数计算页码范围
        computeEndGlobal(root, totalPages);

        return { 
          success: true, 
          chapters: root, 
          flatList: chapters,
          count: chapters.length 
        };
      }
    }

    // 🔧 跟踪上一个有效页码，供无页码子条目继承
    let lastValidPage = 1;

  for (const line of lines) {
      let level = 0;
      let cleanLine = line;
      
      if (hasTabs) {
        // 模板格式：Tab 缩进表示层级
        const tabCount = line.match(/^\t*/)[0].length;
        level = Math.min(tabCount, 2);
        cleanLine = line.replace(/^\t*/, '');
      } else if (hasMultipleSpaces) {
        // 空格缩进格式
        const leadingSpaces = line.match(/^[\s\u3000]*/)[0].length;
        level = Math.min(2, Math.floor(leadingSpaces / 2));
        cleanLine = line.replace(/^[\s\u3000]*/, '');
      } else {
        // 原有逻辑
        const leadingSpaces = line.match(/^[\s\u3000]*/)[0].length;
        level = Math.min(2, Math.floor(leadingSpaces / 2));
        cleanLine = line;
      }
      
      // 匹配 "标题 页码"
      const match = cleanLine.match(/^(.+?)[\s\.]*(\d+)\s*$/);
      
      if (match) {
        const page = parseInt(match[2]);
        lastValidPage = page;
        chapters.push({
          title: match[1].trim(),
          page,
          level,
          children: []
        });
        console.log(`  ✅ [有页码] "${match[1].trim().substring(0, 30)}" → page=${page}, level=${level}, lastValidPage=${lastValidPage}`);
      } else {
        const pageMatch = cleanLine.match(/(\d+)\s*$/);
        if (pageMatch) {
          const page = parseInt(pageMatch[0]);
          lastValidPage = page;
          const title = cleanLine.substring(0, cleanLine.lastIndexOf(pageMatch[0])).trim();
          chapters.push({
            title: title || cleanLine.trim(),
            page,
            level,
            children: []
          });
          console.log(`  📎 [pageMatch] "${(title || cleanLine.trim()).substring(0, 30)}" → page=${page}, lastValidPage=${lastValidPage}`);
        } else {
          // 🔧 无页码：继承上一个有效页码
          chapters.push({
            title: cleanLine.trim(),
            page: lastValidPage,
            level,
            children: []
          });
          console.log(`  ⬆️ [继承页码] "${cleanLine.trim().substring(0, 30)}" → page=${lastValidPage} (继承)`);
        }
      }
    }

    if (chapters.length === 0) {
      return { success: false, chapters: [], error: '未能解析到有效目录' };
    }

    // 构建树形结构
    const root = [];
    const stack = [];
    
    for (const item of chapters) {
      item.start = item.page;
      item.end = totalPages;
      
      while (stack.length > item.level) {
        stack.pop();
      }
      
      if (stack.length === 0) {
        root.push(item);
      } else {
        stack[stack.length - 1].children.push(item);
      }
      stack.push(item);
    }

    // 计算页码范围
    computeEndGlobal(root, totalPages);

    console.log(`📊 [parseClipboardText] 完成: flatList共${chapters.length}条, tree共${root.length}个根节点`);
    console.log(`   flatList前5条:`, chapters.slice(0, 5).map(c => ({ t: c.title?.substring(0, 20), p: c.page, l: c.level })));

    return { 
      success: true, 
      chapters: root, 
      flatList: chapters,
      count: chapters.length 
    };
  };

  // 扁平化目录树
  const flattenOutline = (outline, level = 0) => {
    const result = [];
    const flatten = (nodes, lvl) => {
      for (const node of nodes) {
        const flatNode = {
          title: node.title,
          page: node.page,
          start: node.start,
          end: node.end,
          level: lvl,
          selected: node.selected,
          originalPage: node.originalPage,
          children: node.children || []
        };
        result.push(flatNode);
        if (node.children && node.children.length > 0) {
          flatten(node.children, lvl + 1);
        }
      }
    };
    flatten(outline, level);
    return result;
  };

  // 计算章节数量
  const countChapters = (outline) => {
    if (!outline) return 0;
    let count = 0;
    const countRecursive = (nodes) => {
      for (const node of nodes) {
        count++;
        if (node.children && node.children.length > 0) {
          countRecursive(node.children);
        }
      }
    };
    countRecursive(outline);
    return count;
  };

  // 重新构建树形结构
  const rebuildTree = (flatList, totalPages) => {
    const root = [];
    const stack = [];
    
    const items = flatList.map(item => ({ ...item, children: [] }));
    
    for (const item of items) {
      while (stack.length > item.level) {
        stack.pop();
      }
      
      if (stack.length === 0) {
        root.push(item);
      } else {
        stack[stack.length - 1].children.push(item);
      }
      stack.push(item);
    }

    // 使用全局页码范围计算函数
    computeEndGlobal(root, totalPages);

    return root;
  };

  // 应用页码偏移
  const applyOffset = (originalOutline, offset, totalPages) => {
    if (!originalOutline || originalOutline.length === 0) return [];
    
    const off = offset || 0;
    const apply = (nodes) => {
      return nodes.map(item => ({
        ...item,
        page: (item.page || 1) + off,
        start: (item.page || 1) + off,
        children: item.children ? apply(item.children) : []
      }));
    };
    
    const newOutline = apply(originalOutline);
    
    // 重新计算结束页
    computeEndGlobal(newOutline, totalPages);
    return newOutline;
  };

  return {
    parseClipboardText,
    flattenOutline,
    countChapters,
    rebuildTree,
    applyOffset,
    deepClone // 新增：导出 deepClone
  };
}

// 新增：深拷贝工具函数
export const deepClone = (obj) => {
  return JSON.parse(JSON.stringify(obj));
};

/**
 * 安全地将焦点设置到目录编辑器中的输入框
 * 简化版本：直接使用 setTimeout 确保 DOM 渲染完成后聚焦
 * @param {number} index - 想要聚焦的行索引（可选，默认聚焦第一个）
 * @returns {Promise<boolean>} 是否成功聚焦
 */
export const safeFocusOutlineInput = (index = 0) => {
  return new Promise((resolve) => {
    // ✅ 等待 DOM 渲染完成后再聚焦
    setTimeout(() => {
      const inputs = document.querySelectorAll('.outline-editor-modal .cell-input.title-input');
      
      if (inputs.length > 0 && inputs[index]) {
        const target = inputs[index];
        target.focus();
        target.select();
        console.log(`✅ 聚焦成功`);
        resolve(true);
      } else {
        console.warn('⚠️ 聚焦失败：未找到输入框');
        resolve(false);
      }
    }, 300); // ✅ 等待 300ms 确保 Vue 完全渲染
  });
};

// ... existing code ...

/**
 * 极速聚焦函数（优化版本）
 * 使用更短的延迟和更好的错误处理
 */
export const fastFocusInput = async (index = 0) => {
  return new Promise((resolve) => {
    // ✅ 减少到 100ms，平衡渲染完成和响应速度
    setTimeout(() => {
      const inputs = document.querySelectorAll('.outline-editor-modal .cell-input.title-input');
      
      if (inputs.length > 0 && inputs[index]) {
        const target = inputs[index];
        
        // ✅ 禁用过渡动画
        target.style.transition = 'none';
        target.focus();
        
        // ✅ 再等一小会儿确保焦点稳定
        setTimeout(() => {
          target.select();
          console.log(`✅ 快速聚焦成功: 第${index}行`);
          resolve(true);
        }, 50);
      } else {
        console.warn('⚠️ 快速聚焦失败：未找到输入框');
        resolve(false);
      }
    }, 100);
  });
};

/**
 * 智能聚焦：等待输入框就绪后自动聚焦（解决导入/加载后无法立即编辑问题）
 * @param {number} index - 目标行索引
 * @param {number} maxRetries - 最大重试次数
 * @param {number} retryDelay - 每次重试间隔（毫秒）
 * @returns {Promise<boolean>}
 */
export const smartFocusInput = (index = 0, maxRetries = 20, retryDelay = 50) => {
  return new Promise((resolve) => {
    let retryCount = 0;
    
    const tryFocus = () => {
      const inputs = document.querySelectorAll('.outline-editor-modal .cell-input.title-input');
      
      if (inputs.length > 0 && inputs[index]) {
        const target = inputs[index];
        
        // 确保元素可见且可交互
        if (target.offsetParent !== null && !target.disabled) {
          try {
            // 禁用过渡动画
            target.style.transition = 'none';
            target.focus();
            
            // 延迟选中文本，确保焦点已稳定
            setTimeout(() => {
              try {
                target.select();
                console.log(`✅ 智能聚焦成功: 第${index}行 (重试${retryCount}次)`);
                resolve(true);
              } catch (e) {
                console.log(`✅ 聚焦成功（select失败）: 第${index}行`);
                resolve(true);
              }
            }, 30);
          } catch (e) {
            console.warn(`⚠️ 聚焦异常: ${e.message}`);
            resolve(false);
          }
          return;
        }
      }
      
      retryCount++;
      if (retryCount < maxRetries) {
        // ✅ 关键：使用 setTimeout 而不是 requestAnimationFrame，避免阻塞
        setTimeout(tryFocus, retryDelay);
      } else {
        console.warn(`⚠️ 聚焦超时: 未找到输入框 (已重试${maxRetries}次)`);
        resolve(false);
      }
    };
    
    // ✅ 先等待 Vue 完成初始渲染
    setTimeout(tryFocus, 100);
  });
};

/**
 * 高性能计算页码范围（单次遍历，原地修改）
 * @param {Array} flatList - 扁平化的目录列表
 * @param {Number} totalPages - 总页数
 */
export const fastCalculatePageRanges = (flatList, totalPages) => {
  if (!flatList || flatList.length === 0) return;
  
  const len = flatList.length;
  
  // 第一步：设置所有 start = page
  for (let i = 0; i < len; i++) {
    flatList[i].start = flatList[i].page;
  }
  
  // 第二步：计算 end（单次遍历）
  for (let i = 0; i < len; i++) {
    const current = flatList[i];
    let endPage = totalPages;
    
    // 从当前位置向后查找下一个不同页码的条目
    for (let j = i + 1; j < len; j++) {
      if (flatList[j].page !== current.page) {
        endPage = flatList[j].page - 1;
        break;
      }
    }
    
    current.end = Math.max(current.page, endPage);
  }
};

/**
 * 高性能重建树结构（避免深拷贝，原地构建）
 * @param {Array} flatList - 扁平化的目录列表
 * @param {Number} totalPages - 总页数
 * @returns {Array} 树形结构
 */
export const fastRebuildTree = (flatList, totalPages) => {
  const root = [];
  const stack = [];
  
  for (let i = 0; i < flatList.length; i++) {
    const item = flatList[i];
    
    // 确保 children 是空数组（避免旧引用）
    item.children = [];
    
    // 弹出栈中层级 >= 当前项的节点
    while (stack.length > 0 && stack[stack.length - 1].level >= item.level) {
      stack.pop();
    }
    
    if (stack.length === 0) {
      root.push(item);
    } else {
      stack[stack.length - 1].children.push(item);
    }
    
    stack.push(item);
  }
  
  // 递归计算父节点的 end
  const computeParentEnd = (nodes) => {
    for (const node of nodes) {
      if (node.children && node.children.length > 0) {
        computeParentEnd(node.children);
        const lastChild = node.children[node.children.length - 1];
        node.end = lastChild.end;
      }
    }
  };
  computeParentEnd(root);
  
  return root;
};
