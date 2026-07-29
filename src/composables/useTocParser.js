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

// ==================== 智能目录解析器（新增） ====================

/**
 * 解析 AI 返回的带坐标的目录数据
 * @param {Array} rawItems - AI 返回的原始条目数组
 * @param {Number} imageHeight - 图片高度（用于过滤页眉页脚）
 * @param {Number} imageWidth - 图片宽度
 * @returns {Array} 解析后的树形目录结构
 */
export const parseAiTocResult = (rawItems, imageHeight = 800, imageWidth = 600) => {
  if (!rawItems || rawItems.length === 0) return [];
  
  // 第一步：区域过滤（剔除页眉页脚）
  const headerThreshold = imageHeight * 0.08; // 顶部 8% 为页眉
  const footerThreshold = imageHeight * 0.92; // 底部 8% 为页脚
  
  const filteredItems = rawItems.filter(item => {
    return item.y > headerThreshold && item.y < footerThreshold;
  });
  
  // 第二步：分栏检测
  const xValues = filteredItems.map(item => item.x);
  const clusters = detectClusters(xValues);
  const isDoubleColumn = clusters.length >= 2;
  
  // 第三步：阅读顺序排序
  let sortedItems = [];
  
  if (isDoubleColumn) {
    // 双栏：按 Y 坐标排序后，交替排列
    const sortedByY = [...filteredItems].sort((a, b) => a.y - b.y);
    const leftColumn = [];
    const rightColumn = [];
    
    sortedByY.forEach(item => {
      if (item.x < clusters[1].center) {
        leftColumn.push(item);
      } else {
        rightColumn.push(item);
      }
    });
    
    const maxLen = Math.max(leftColumn.length, rightColumn.length);
    for (let i = 0; i < maxLen; i++) {
      if (i < leftColumn.length) sortedItems.push(leftColumn[i]);
      if (i < rightColumn.length) sortedItems.push(rightColumn[i]);
    }
  } else {
    // 单栏：直接按 Y 坐标排序
    sortedItems = [...filteredItems].sort((a, b) => a.y - b.y);
  }
  
  // 第四步：层级计算（通过 X 坐标偏移量）
  const xOffsets = sortedItems.map(item => item.x);
  const minX = Math.min(...xOffsets);
  const levelClusters = detectLevelClusters(xOffsets);
  
  const chapters = sortedItems.map((item, index) => {
    const offset = item.x - minX;
    let level = 0;
    
    for (let i = 0; i < levelClusters.length; i++) {
      if (offset <= levelClusters[i].threshold) {
        level = i;
        break;
      }
      level = levelClusters.length - 1;
    }
    
    return {
      title: item.text,
      page: parseInt(item.page) || 1,
      level: Math.min(level, 2),
      children: [],
      start: parseInt(item.page) || 1,
      end: 0
    };
  });
  
  // 构建树形结构
  const root = [];
  const stack = [];
  
  for (const item of chapters) {
    while (stack.length > item.level) stack.pop();
    if (stack.length === 0) {
      root.push(item);
    } else {
      stack[stack.length - 1].children.push(item);
    }
    stack.push(item);
  }
  
  // 计算页码范围
  // 注意：此处假设 flattenOutline 已在当前文件或引入作用域中可用
  // 如果 flattenOutline 是外部导入，请确保已 import
  const flatList = typeof flattenOutline === 'function' 
    ? flattenOutline(root) 
    : root.reduce((acc, node) => {
        // 简易 fallback，如果 flattenOutline 不可用
        acc.push(node);
        if (node.children) acc.push(...node.children);
        return acc;
      }, []);

  for (let i = 0; i < flatList.length; i++) {
    const nextItem = flatList[i + 1];
    if (nextItem) {
      flatList[i].end = nextItem.page > flatList[i].page ? nextItem.page - 1 : flatList[i].page;
    } else {
      flatList[i].end = 999; // 最后一章暂时给大值，后续用总页数修正
    }
  }
  
  return root;
};

/**
 * 检测 X 坐标的聚类（判断分栏）
 */
const detectClusters = (values) => {
  if (values.length < 2) return [{ center: values[0] || 0, threshold: 999 }];
  
  const sorted = [...values].sort((a, b) => a - b);
  const gaps = [];
  
  for (let i = 1; i < sorted.length; i++) {
    gaps.push({ gap: sorted[i] - sorted[i - 1], index: i });
  }
  
  gaps.sort((a, b) => b.gap - a.gap);
  
  // 如果最大的间隙超过平均值的 3 倍，认为是分栏
  const avgGap = gaps.reduce((sum, g) => sum + g.gap, 0) / gaps.length;
  const maxGap = gaps[0]?.gap || 0;
  
  if (maxGap > avgGap * 3 && maxGap > 50) {
    const splitIndex = gaps[0].index;
    const leftCluster = sorted.slice(0, splitIndex);
    const rightCluster = sorted.slice(splitIndex);
    
    return [
      { center: leftCluster.reduce((a, b) => a + b, 0) / leftCluster.length },
      { center: rightCluster.reduce((a, b) => a + b, 0) / rightCluster.length }
    ];
  }
  
  return [{ center: sorted.reduce((a, b) => a + b, 0) / sorted.length, threshold: 999 }];
};

/**
 * 检测层级聚类（通过 X 偏移量判断缩进层级）
 */
const detectLevelClusters = (xOffsets) => {
  const unique = [...new Set(xOffsets)].sort((a, b) => a - b);
  const minX = unique[0];
  const offsets = unique.map(x => x - minX);
  
  // 简单的阈值判断：偏移量 < 20 为一级，20-50 为二级，> 50 为三级
  return [
    { threshold: 20, level: 0 },
    { threshold: 50, level: 1 },
    { threshold: 999, level: 2 }
  ];
};

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
 * 快速计算单个节点的页码范围（不重建树）
 * 用于增量更新场景，避免全量重建的性能开销
 */
export const quickCalculateRange = (flatList, index, totalPages) => {
  if (!flatList || flatList.length === 0) return;
  
  const item = flatList[index];
  if (!item) return;
  
  // 计算当前项的 start
  item.start = item.page;
  
  // 计算当前项的 end
  let endPage = totalPages;
  for (let j = index + 1; j < flatList.length; j++) {
    if (flatList[j].page !== item.page) {
      endPage = flatList[j].page - 1;
      break;
    }
  }
  item.end = Math.max(item.start, endPage);
  
  // 如果修改的是前面的项，需要重新计算后续受影响项的范围
  for (let i = index + 1; i < flatList.length; i++) {
    const nextItem = flatList[i];
    nextItem.start = nextItem.page;
    
    let nextEnd = totalPages;
    for (let j = i + 1; j < flatList.length; j++) {
      if (flatList[j].page !== nextItem.page) {
        nextEnd = flatList[j].page - 1;
        break;
      }
    }
    nextItem.end = Math.max(nextItem.start, nextEnd);
  }
};

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
