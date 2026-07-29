// ==================== 学科硬性规则验证器 ====================

/**
 * 数学验证规则
 */
const mathValidators = [
  {
    name: '三角形两边之和大于第三边',
    check: (questionText) => {
      // 提取所有数值边长（匹配"X cm"、"X米"等）
      const sidePattern = /(\d+\.?\d*)\s*(cm|米|分米|m)/g;
      const sides = [];
      let match;
      while ((match = sidePattern.exec(questionText)) !== null) {
        sides.push(parseFloat(match[1]));
      }
      
      // 如果恰好有3个边长，验证三角形不等式
      if (sides.length === 3) {
        const [a, b, c] = sides.sort((x, y) => x - y);
        return a + b > c;
      }
      return true; // 无法提取则不检查
    },
    errorMsg: '三角形边长不满足"两边之和大于第三边"',
    severity: 'error'
  },
  {
    name: '概率值范围检查',
    check: (questionText) => {
      // 提取概率值
      const probPattern = /概率[为是]?\s*(\d+\.?\d*)/g;
      let match;
      while ((match = probPattern.exec(questionText)) !== null) {
        const p = parseFloat(match[1]);
        if (p < 0 || p > 1) {
          return false;
        }
      }
      
      // 检查百分比形式的概率
      const percentPattern = /概率[为是]?\s*(\d+\.?\d*)\s*%/g;
      while ((match = percentPattern.exec(questionText)) !== null) {
        const p = parseFloat(match[1]);
        if (p < 0 || p > 100) {
          return false;
        }
      }
      
      return true;
    },
    errorMsg: '概率值超出有效范围（0-1或0%-100%）',
    severity: 'error'
  },
  {
    name: '勾股数合理性检查',
    check: (questionText) => {
      // 检查常见的勾股数引用是否正确
      const pythagoreanPattern = /(\d+)\s*[,，]\s*(\d+)\s*[,，]\s*(\d+)/g;
      let match;
      while ((match = pythagoreanPattern.exec(questionText)) !== null) {
        const [a, b, c] = [match[1], match[2], match[3]].map(Number).sort((x, y) => x - y);
        // 允许1%的误差
        if (Math.abs(a * a + b * b - c * c) > 0.01 * c * c) {
          return false;
        }
      }
      return true;
    },
    errorMsg: '勾股数不符合勾股定理',
    severity: 'error'
  },
  {
    name: '百分比之和检查',
    check: (questionText) => {
      // 检查统计图中各部分百分比之和是否合理
      const percentPattern = /(\d+\.?\d*)\s*%/g;
      const percentages = [];
      let match;
      while ((match = percentPattern.exec(questionText)) !== null) {
        percentages.push(parseFloat(match[1]));
      }
      
      // 如果百分比数量≥3，检查总和是否在90-110之间
      if (percentages.length >= 3) {
        const sum = percentages.reduce((a, b) => a + b, 0);
        if (sum < 90 || sum > 110) {
          return false;
        }
      }
      return true;
    },
    errorMsg: '各部分百分比之和偏离100%过多',
    severity: 'warning'
  },
  // ⬇️ 新增规则1：年龄合理性检查
  {
    name: '年龄合理性检查',
    check: (questionText) => {
      // 匹配中文人名 + 年龄的常见模式
      const agePattern = /(小明|小红|小华|小刚|小丽|小强|同学|学生).*?(\d+)\s*岁/g;
      let match;
      while ((match = agePattern.exec(questionText)) !== null) {
        const age = parseInt(match[2]);
        // 学生年龄通常在5-18岁之间
        if (age < 5 || age > 18) {
          return false;
        }
      }
      return true;
    },
    errorMsg: '题目中人物年龄不符合学生年龄段（5-18岁）',
    severity: 'warning'
  },

  // ⬇️ 新增规则2：除法除数不能为零
  {
    name: '除法除数非零检查',
    check: (questionText) => {
      // 匹配 "除以0" 或 "÷0" 或 "÷ 0"
      const divideByZeroPattern = /除以\s*0|÷\s*0/g;
      if (divideByZeroPattern.test(questionText)) {
        return false;
      }
      return true;
    },
    errorMsg: '除法运算中除数为零',
    severity: 'error'
  },

  // ⬇️ 新增规则3：速度单位合理性检查（从物理验证器调整用于数学题）
  {
    name: '速度单位合理性检查',
    check: (questionText) => {
      // 检查数学应用题中的速度值是否合理
      const speedPattern = /(\d+\.?\d*)\s*(米\/秒|千米\/[小]?时|km\/h|m\/s)/g;
      let match;
      while ((match = speedPattern.exec(questionText)) !== null) {
        const value = parseFloat(match[1]);
        const unit = match[2];
        
        // 步行速度通常1-2m/s，汽车不超过50m/s
        if (unit.includes('米/秒') || unit.includes('m/s')) {
          if (value > 100) return false; // 超过360km/h，不现实
        }
      }
      return true;
    },
    errorMsg: '速度值超出合理范围',
    severity: 'warning'
  },
    // ⬇️ 新增：圆的周长与直径比例检查
  {
    name: '圆的周长/直径比例检查',
    check: (questionText) => {
      // 匹配 "周长...直径..." 模式并提取数值
      const relationPattern = /周长[为是]?\s*(\d+\.?\d*).*?直径[为是]?\s*(\d+\.?\d*)/;
      const match = questionText.match(relationPattern);
      if (match) {
        const circumference = parseFloat(match[1]);
        const diameter = parseFloat(match[2]);
        // 周长/直径 应在 π±0.5 范围内（即 2.64~3.64）
        if (diameter > 0) {
          const ratio = circumference / diameter;
          if (ratio < 2.5 || ratio > 3.7) {
            return false;
          }
        }
      }
      return true;
    },
    errorMsg: '圆的周长与直径比例严重偏离π',
    severity: 'error'
  },

  // ⬇️ 新增：时间计算合理性检查
  {
    name: '时间计算合理性检查',
    check: (questionText) => {
      // 检查 "小时" 和 "分钟" 的换算是否合理
      // 例如：2小时70分钟（应为3小时10分钟）
      const timePattern = /(\d+)\s*小时\s*(\d+)\s*分钟/g;
      let match;
      while ((match = timePattern.exec(questionText)) !== null) {
        const minutes = parseInt(match[2]);
        if (minutes >= 60) {
          return false;
        }
      }
      return true;
    },
    errorMsg: '时间表示不规范（分钟数≥60）',
    severity: 'warning'
  },

  // ⬇️ 新增：几何图形内角和检查
  {
    name: '几何图形内角和检查',
    check: (questionText) => {
      // 检查三角形内角和
      const triangleAnglePattern = /三角形.*?内角.*?(\d+)°.*?(\d+)°.*?(\d+)°/;
      const triangleMatch = questionText.match(triangleAnglePattern);
      if (triangleMatch) {
        const sum = [1, 2, 3].reduce((s, i) => s + parseInt(triangleMatch[i]), 0);
        if (Math.abs(sum - 180) > 5) {
          return false;
        }
      }
      
      // 检查四边形内角和
      const quadAnglePattern = /四边形.*?内角.*?(\d+)°.*?(\d+)°.*?(\d+)°.*?(\d+)°/;
      const quadMatch = questionText.match(quadAnglePattern);
      if (quadMatch) {
        const sum = [1, 2, 3, 4].reduce((s, i) => s + parseInt(quadMatch[i]), 0);
        if (Math.abs(sum - 360) > 5) {
          return false;
        }
      }
      return true;
    },
    errorMsg: '几何图形内角和不符合定理',
    severity: 'error'
  },

  // ⬇️ 新增：负数开偶次方检查
  {
    name: '负数开偶次方检查',
    check: (questionText) => {
      // 在初中数学范围内，负数不能开偶次方
      // 匹配 √(-N) 或 ³√ 等
      const negRootPattern = /√\s*\(\s*-\d|√\s*-\d|开方\s*-\d|算术平方根.*?负/g;
      if (negRootPattern.test(questionText)) {
        return false;
      }
      return true;
    },
    errorMsg: '初中阶段出现负数开平方（除非明确说明无解）',
    severity: 'error'
  },

  // ⬇️ 新增：不等式方向检查
  {
    name: '不等式方向检查',
    check: (questionText) => {
      // 检查乘以/除以负数时的不等式方向
      const inequalityPattern = /两边[同都]?[乘除]以\s*-\d+/g;
      const directionPattern = /不等号方向/;
      // 如果提到了乘以负数，但没提到改变方向，标记为警告
      if (inequalityPattern.test(questionText) && !directionPattern.test(questionText)) {
        return null; // 不确定，返回null
      }
      return true;
    },
    errorMsg: '不等式乘除负数后未提醒改变不等号方向',
    severity: 'warning'
  }
];

/**
 * 物理验证规则
 */
const physicsValidators = [
  {
    name: '速度单位合理性检查',
    check: (questionText) => {
      // 检查是否有不合理的速度值（如步行速度超过20m/s）
      const speedPattern = /(\d+\.?\d*)\s*(m\/s|米\/秒|km\/h|千米\/[小]?时)/g;
      let match;
      while ((match = speedPattern.exec(questionText)) !== null) {
        const value = parseFloat(match[1]);
        const unit = match[2];
        
        if (unit.includes('m/s') || unit.includes('米/秒')) {
          if (value > 340) return false; // 超过声速
        } else if (unit.includes('km/h') || unit.includes('千米')) {
          if (value > 1224) return false; // 超过声速
        }
      }
      return true;
    },
    errorMsg: '速度值超出合理范围（超过声速）',
    severity: 'warning'
  },
  {
    name: '密度范围检查',
    check: (questionText) => {
      const densityPattern = /(\d+\.?\d*)\s*(g\/cm³|kg\/m³|克\/立方厘米)/g;
      let match;
      while ((match = densityPattern.exec(questionText)) !== null) {
        const value = parseFloat(match[1]);
        const unit = match[2];
        
        // 常见物质密度范围检查
        if (unit.includes('g/cm³') || unit.includes('克/立方厘米')) {
          if (value < 0.001 || value > 22.6) return false; // 已知最密物质是锇 22.59
        } else if (unit.includes('kg/m³')) {
          if (value < 1 || value > 22600) return false;
        }
      }
      return true;
    },
    errorMsg: '密度值超出已知物质范围',
    severity: 'warning'
  },
    // ⬇️ 新增：重力加速度范围检查
  {
    name: '重力加速度范围检查',
    check: (questionText) => {
      // 检查 g 值是否在 9.8±0.8 范围内
      const gPattern = /g\s*[=＝取为]?\s*(\d+\.?\d*)\s*(N\/kg|牛\/千克|m\/s²)/g;
      let match;
      while ((match = gPattern.exec(questionText)) !== null) {
        const gValue = parseFloat(match[1]);
        if (gValue < 9.0 || gValue > 10.6) {
          return false;
        }
      }
      return true;
    },
    errorMsg: '重力加速度g值超出合理范围（9.8±0.8 N/kg）',
    severity: 'warning'
  },

  // ⬇️ 新增：光的传播速度检查
  {
    name: '光速值检查',
    check: (questionText) => {
      const lightPattern = /光速.*?(\d+\.?\d*)\s*[×xX\*]\s*10\^?(\d+)\s*(m\/s|米\/秒)/g;
      let match;
      while ((match = lightPattern.exec(questionText)) !== null) {
        const base = parseFloat(match[1]);
        const power = parseInt(match[2]);
        // 光速约为 3.0×10^8 m/s
        if (power === 8 && (base < 2.5 || base > 3.5)) {
          return false;
        }
      }
      return true;
    },
    errorMsg: '光速值不准确（真空中约为3.0×10⁸ m/s）',
    severity: 'warning'
  },

  // ⬇️ 新增：欧姆定律单位检查
  {
    name: '欧姆定律单位检查',
    check: (questionText) => {
      // 检查 U=IR 时，各物理量单位是否匹配
      // 电流单位用A，电压用V，电阻用Ω
      const ohmPattern = /(\d+\.?\d*)\s*(V|伏).*?(\d+\.?\d*)\s*(A|安).*?(\d+\.?\d*)\s*(Ω|欧姆|欧)/;
      const match = questionText.match(ohmPattern);
      if (match) {
        const voltage = parseFloat(match[1]);
        const current = parseFloat(match[3]);
        const resistance = parseFloat(match[5]);
        // U = I * R，允许5%误差
        const expectedVoltage = current * resistance;
        if (expectedVoltage > 0 && Math.abs(voltage - expectedVoltage) / expectedVoltage > 0.05) {
          return false;
        }
      }
      return true;
    },
    errorMsg: '欧姆定律计算不符合 U=IR 关系',
    severity: 'error'
  },

  // ⬇️ 新增：比热容常见值检查
  {
    name: '比热容常见值检查',
    check: (questionText) => {
      // 检查水的比热容是否为 4.2×10³ J/(kg·℃)
      const waterPattern = /水.*?比热容.*?(\d+\.?\d*)\s*[×xX\*]\s*10\^?(\d+)/;
      const match = questionText.match(waterPattern);
      if (match) {
        const base = parseFloat(match[1]);
        const power = parseInt(match[2]);
        if (power === 3 && (base < 4.0 || base > 4.4)) {
          return false;
        }
      }
      return true;
    },
    errorMsg: '水的比热容值不准确（4.2×10³ J/(kg·℃)）',
    severity: 'warning'
  }
];

/**
 * 化学验证规则
 */
const chemistryValidators = [
  {
    name: '化学方程式原子守恒检查',
    check: (questionText) => {
      // 简单检查：如果提到"配平"但方程式明显不平衡，标记警告
      const equationPattern = /(\d*[A-Z][a-z]?\d*\s*\+\s*)+(\d*[A-Z][a-z]?\d*)\s*[=→]\s*(\d*[A-Z][a-z]?\d*\s*\+\s*)+(\d*[A-Z][a-z]?\d*)/;
      // 这个正则只是近似匹配，真正的原子守恒需要复杂解析
      // 这里做一个简化检查：检测是否有"="或"→"但没有"配平"二字
      if (equationPattern.test(questionText) && !questionText.includes('配平')) {
        return null; // 不确定，返回null表示跳过检查
      }
      return true;
    },
    errorMsg: '化学方程式可能需要配平检查',
    severity: 'warning'
  },
  {
    name: '化合价合理性检查',
    check: (questionText) => {
      // 检查是否有明显错误的化合价（如Na²⁺）
      const wrongValence = /Na\s*[²2]\s*\+|Cl\s*[²2]\s*\+|O\s*[²2]\s*\-/g;
      if (wrongValence.test(questionText)) {
        return false;
      }
      return true;
    },
    errorMsg: '存在不符合常见化合价的离子',
    severity: 'error'
  },
    // ⬇️ 新增：相对原子质量常见值检查
  {
    name: '常见相对原子质量检查',
    check: (questionText) => {
      const commonAtoms = {
        'H': 1, 'C': 12, 'N': 14, 'O': 16, 'Na': 23, 
        'Mg': 24, 'Al': 27, 'S': 32, 'Cl': 35.5, 'Ca': 40, 'Fe': 56, 'Cu': 64
      };
      
      // 匹配 "X的相对原子质量为Y" 模式
      const atomPattern = /([A-Z][a-z]?).*?相对原子质量[为是]?\s*(\d+\.?\d*)/g;
      let match;
      while ((match = atomPattern.exec(questionText)) !== null) {
        const symbol = match[1];
        const mass = parseFloat(match[2]);
        if (commonAtoms[symbol] && Math.abs(mass - commonAtoms[symbol]) > 0.5) {
          return false;
        }
      }
      return true;
    },
    errorMsg: '常见元素的相对原子质量不准确',
    severity: 'error'
  },

  // ⬇️ 新增：pH值范围检查
  {
    name: 'pH值范围检查',
    check: (questionText) => {
      const phPattern = /pH\s*[=＝为]?\s*(\d+\.?\d*)/g;
      let match;
      while ((match = phPattern.exec(questionText)) !== null) {
        const ph = parseFloat(match[1]);
        if (ph < 0 || ph > 14) {
          return false;
        }
      }
      return true;
    },
    errorMsg: 'pH值超出标准范围（0-14）',
    severity: 'error'
  },

  // ⬇️ 新增：金属活动性顺序检查
  {
    name: '金属活动性顺序检查',
    check: (questionText) => {
      // 检查是否有明显违反活动性顺序的置换反应
      // K Ca Na Mg Al Zn Fe Sn Pb (H) Cu Hg Ag Pt Au
      const displacementPattern = /(Cu|铜).*?置换.*?(Zn|锌).*?的/g;
      // 铜不能置换锌（锌比铜活泼）
      if (displacementPattern.test(questionText)) {
        return false;
      }
      return true;
    },
    errorMsg: '金属活动性顺序错误（活动性弱的金属不能置换活动性强的金属）',
    severity: 'error'
  }
];

/**
 * 通用验证规则（所有学科适用）
 */
const commonValidators = [
  {
    name: '全角数字检查',
    check: (questionText) => {
      return !/[０-９]/.test(questionText);
    },
    errorMsg: '存在全角数字，应使用半角数字',
    severity: 'error',
    autoFix: (text) => {
      const map = { '０': '0', '１': '1', '２': '2', '３': '3', '４': '4', 
                    '５': '5', '６': '6', '７': '7', '８': '8', '９': '9' };
      return text.replace(/[０-９]/g, c => map[c] || c);
    }
  },
  {
    name: '答案标注为"略"检查',
    check: (questionText) => {
      return !/答案[：:]\s*略/.test(questionText);
    },
    errorMsg: '答案标注为"略"，应提供完整答案',
    severity: 'warning'
  },
    // ⬇️ 新增：括号不匹配检查
  {
    name: '括号匹配检查',
    check: (questionText) => {
      const openCount = (questionText.match(/\(/g) || []).length;
      const closeCount = (questionText.match(/\)/g) || []).length;
      return openCount === closeCount;
    },
    errorMsg: '括号不匹配',
    severity: 'error',
    autoFix: null // 无法自动修复，需人工检查
  },

  // ⬇️ 新增：中文标点混用检查
  {
    name: '中英文标点混用检查',
    check: (questionText) => {
      // 检查中文句号后面是否用了英文逗号等混用情况
      const mixedPattern = /[。！？]\s*[,\.;:]/g;
      if (mixedPattern.test(questionText)) {
        return false;
      }
      return true;
    },
    errorMsg: '中英文标点混用',
    severity: 'warning',
    autoFix: (text) => {
      // 自动替换常见混用
      return text
        .replace(/。\s*,/g, '，')
        .replace(/。\s*\./g, '。')
        .replace(/！\s*,/g, '！')
        .replace(/？\s*,/g, '？');
    }
  },

  // ⬇️ 新增：多余空格检查
  {
    name: '多余空格检查',
    check: (questionText) => {
      // 检查中文文本中是否有连续空格
      const multipleSpacesPattern = /[\u4e00-\u9fa5]\s{2,}[\u4e00-\u9fa5]/g;
      if (multipleSpacesPattern.test(questionText)) {
        return false;
      }
      return true;
    },
    errorMsg: '中文文本中存在多余空格',
    severity: 'warning',
    autoFix: (text) => {
      // 将中文之间的连续空格替换为单个空格
      return text.replace(/([\u4e00-\u9fa5])\s{2,}([\u4e00-\u9fa5])/g, '$1 $2');
    }
  },

  // ⬇️ 新增：选择题选项质量检查
  {
    name: '选择题选项质量检查',
    check: (questionText) => {
      // 检测是否使用了"以上都是""以上都不对"
      if (/以上\s*都\s*(是|对|正确|不对|不是)/.test(questionText)) {
        // 不直接判定为失败，因为高中可能允许，但标记为警告
        return null;
      }
      return true;
    },
    errorMsg: '选择题使用了"以上都是/以上都不对"选项，建议替换为具体选项',
    severity: 'warning'
  },
  // ⬇️ 新增：题干完整性检查
  {
    name: '题干完整性检查',
    check: (questionText) => {
      // 从 HTML 中提取纯文本
      const plainText = questionText.replace(/<[^>]+>/g, '').trim();
      
      // 检查是否以连词结尾（表述不完整）
      const incompleteEndings = /(因为|所以|但是|虽然|然而|而且|因此|于是|并且|或者|不仅|而且)\s*$/;
      if (incompleteEndings.test(plainText)) {
        return false;
      }
      
      // 检查题干是否过短（少于10个字）
      const questionMatch = plainText.match(/^\d+[\.、．]\s*(.+)/);
      if (questionMatch && questionMatch[1].length < 10) {
        return null; // 可能是填空题或特殊题型
      }
      
      return true;
    },
    errorMsg: '题干可能表述不完整（以连词结尾）',
    severity: 'warning'
  },
  // ⬇️ 新增：选择题选项数量检查
  {
    name: '选择题选项数量检查',
    check: (questionText) => {
      // 检测选项数量（通过 A. B. C. D. 模式）
      const optionMatches = questionText.match(/[A-D][\.、．]\s*/g);
      if (optionMatches) {
        const optionCount = optionMatches.length;
        // 选择题通常4个选项，但不是绝对的
        if (optionCount > 0 && optionCount !== 4) {
          return null; // 不确定，可能是特殊题型
        }
      }
      return true;
    },
    errorMsg: '选择题选项数量异常（非标准4选项）',
    severity: 'warning'
  },
  // ⬇️ 新增：填空题空格位置检查
  {
    name: '填空题空格位置检查',
    check: (questionText) => {
      // 检测填空是否在句首（不好的命题习惯）
      const blankAtStart = /^[\s\d\.、．]*<u>&nbsp;+<\/u>/;
      if (blankAtStart.test(questionText)) {
        return false;
      }
      return true;
    },
    errorMsg: '填空题空格不应出现在句首',
    severity: 'warning'
  }
];

/**
 * 语文验证规则
 */
const chineseValidators = [
  {
    name: '错别字检查（常见别字）',
    check: (questionText) => {
      // 常见别字映射：别字 → 正字
      const typoMap = {
        '的': null, '地': null, '得': null, // 这三个单独处理
        '在': '再',
        '坐': '座',
        '做': '作',
        '侯': '候',
        '即': '既',
        '竞': '竟',
        '像': '象',
        '予': '预',
        '兰': '蓝',
        '克': '刻',
        '查': '察',
        '需': '须',
        '带': '戴',
        '到': '倒',
      };
      // 只做标记不阻止，因为这些需要上下文判断
      return null;
    },
    errorMsg: '可能存在别字，建议人工核对',
    severity: 'warning'
  },
  {
    name: '标点符号规范检查',
    check: (questionText) => {
      // 检查中英文标点混用
      const hasChinesePeriod = /[。！？，、；：]/.test(questionText);
      const hasEnglishComma = /[,]/.test(questionText);
      const hasEnglishPeriod = /[\.](?!\d)/.test(questionText); // 排除小数点
      
      if (hasChinesePeriod && (hasEnglishComma || hasEnglishPeriod)) {
        return null; // 不确定，返回null让AI审查
      }
      return true;
    },
    errorMsg: '中英文标点可能混用，建议核对',
    severity: 'warning'
  },
  {
    name: '阅读理解题答案不可直接原文摘抄',
    check: (questionText) => {
      // 匹配"阅读"相关的题目
      if (/阅读|短文|选段|语段/.test(questionText)) {
        // 如果答案与题干原文完全一致，标记
        const answerMatch = questionText.match(/答案[：:]\s*(.+?)(?:[。；\n]|$)/);
        if (answerMatch) {
          const answer = answerMatch[1].trim();
          const body = questionText.replace(/答案[：:].*$/, '');
          if (answer.length > 10 && body.includes(answer)) {
            return false;
          }
        }
      }
      return true;
    },
    errorMsg: '阅读理解题的答案可能与原文重复（应体现理解而非照抄）',
    severity: 'warning'
  },
  {
    name: '作文题字数要求检查',
    check: (questionText) => {
      // 匹配作文题
      if (/作文|写作|写一[篇段]|习作/.test(questionText)) {
        // 检查是否有字数要求
        if (!/\d{2,4}\s*字/.test(questionText)) {
          return false;
        }
      }
      return true;
    },
    errorMsg: '作文题缺少字数要求',
    severity: 'warning'
  },
  {
    name: '古诗词默写范围检查',
    check: (questionText) => {
      // 小学古诗词不应超出课标推荐篇目
      const primaryNonStandard = ['琵琶行', '长恨歌', '蜀道难', '离骚', '逍遥游'];
      for (const poem of primaryNonStandard) {
        if (questionText.includes(poem)) {
          return null; // 需要上下文判断学段
        }
      }
      return true;
    },
    errorMsg: '古诗词可能超出对应学段课标范围',
    severity: 'warning'
  },
  {
    name: '题干表述完整性检查',
    check: (questionText) => {
      // 检查是否有不完整的句子（以"因为""所以"等结尾）
      const incompleteEndings = /(因为|所以|但是|虽然|然而|而且|因此|于是)\s*$/m;
      if (incompleteEndings.test(questionText)) {
        return false;
      }
      return true;
    },
    errorMsg: '题干可能表述不完整（以连词结尾）',
    severity: 'warning'
  },
  {
    name: '拼音标注格式检查',
    check: (questionText) => {
      // 如果出现拼音，检查是否用了正确的格式
      if (/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/.test(questionText)) {
        return true; // 有声调标记，格式正确
      }
      // 如果出现纯拼音，检查是否规范
      const pinyinPattern = /[a-z]{2,6}[1-5]/g;
      if (pinyinPattern.test(questionText)) {
        return null; // 数字标调法，可接受
      }
      return true;
    },
    errorMsg: '拼音标注格式建议核实',
    severity: 'warning'
  }
];

/**
 * 英语验证规则
 */
const englishValidators = [
  {
    name: '选项语法一致性检查',
    check: (questionText) => {
      // 选择题选项应该语法结构一致
      const optionPattern = /[A-D][\.、．]\s*(.+?)(?=[A-D][\.、．]|答案|$)/g;
      const options = [];
      let match;
      while ((match = optionPattern.exec(questionText)) !== null) {
        options.push(match[1].trim());
      }
      if (options.length >= 3) {
        // 检查是否全是句子或全是短语
        const sentenceCount = options.filter(o => /^[A-Z]/.test(o) && /[.!?]$/.test(o)).length;
        if (sentenceCount > 0 && sentenceCount < options.length) {
          return false;
        }
      }
      return true;
    },
    errorMsg: '选择题选项语法结构不一致',
    severity: 'warning'
  },
  {
    name: '词汇难度检查',
    check: (questionText) => {
      // 小学英语中不应出现高中词汇
      const advancedWords = ['sophisticated', 'phenomenon', 'contemporary', 'nevertheless', 'consequently'];
      for (const word of advancedWords) {
        if (questionText.toLowerCase().includes(word)) {
          return null;
        }
      }
      return true;
    },
    errorMsg: '可能包含超学段词汇',
    severity: 'warning'
  },
  {
    name: '题干完整性检查',
    check: (questionText) => {
      // 英语题干应以问号、句号结尾，或指令明确
      const stems = questionText.match(/<p[^>]*question[^>]*>(.+?)<\/p>/g) || [];
      for (const stem of stems) {
        let text = stem.replace(/<[^>]+>/g, '').trim();
        // 🔧 去除句末填空标记（&emsp;、下划线、空格），避免"It's ___" 被误判为缺少标点
        text = text.replace(/[\u2000-\u200F\u2028-\u202F\u205F\u3000]+/g, '').trim();  // Unicode 空白
        text = text.replace(/_{3,}/g, '').trim();  // 下划线填空
        if (text.length > 20 && !/[.?!]$/.test(text)) {
          // 🔧 指令型题干（祈使句：Read/Choose/Fill 等）不需要句末标点
          const instructionStarters = /^(Read|Choose|Fill|Write|Listen|Match|Complete|Answer|Look|Circle|Draw|Find|Tick|Cross|Underline|Put|Make|Check|Select|Rearrange|Correct|Translate|Describe|Explain|Compare|Discuss|Identify|Label|Name|Order|Sort|Spell|Number|Rewrite|Add|Replace|Change)\b/i;
          if (!instructionStarters.test(text)) {
            return false;
          }
        }
      }
      return true;
    },
    errorMsg: '英语题干缺少句末标点',
    severity: 'warning'
  },
  {
    name: '完形填空选项数量检查',
    check: (questionText) => {
      if (/完形填空|cloze/i.test(questionText)) {
        // 完形填空每空应有4个选项
        const blankCount = (questionText.match(/_{2,}/g) || []).length;
        const optionCount = (questionText.match(/[A-D][\.、．]/g) || []).length;
        if (blankCount > 0 && optionCount / blankCount !== 4) {
          return false;
        }
      }
      return true;
    },
    errorMsg: '完形填空每空应有4个选项',
    severity: 'warning'
  }
];

/**
 * 生物验证规则
 */
const biologyValidators = [
  {
    name: '生物分类名称格式检查',
    check: (questionText) => {
      // 属名、种名应为斜体或拉丁文格式
      const scientificNamePattern = /[A-Z][a-z]+\s[a-z]+/g;
      const matches = questionText.match(scientificNamePattern) || [];
      // 如果在中文文本中出现未标记的学名，提示
      if (matches.length > 0 && !/<em>|<i>/.test(questionText)) {
        return null;
      }
      return true;
    },
    errorMsg: '生物学名建议用斜体表示',
    severity: 'warning'
  },
  {
    name: '遗传概率范围检查',
    check: (questionText) => {
      const probPattern = /概率[为是]?\s*(\d+\.?\d*)\s*[%％]/g;
      let match;
      while ((match = probPattern.exec(questionText)) !== null) {
        const p = parseFloat(match[1]);
        if (p < 0 || p > 100) {
          return false;
        }
      }
      return true;
    },
    errorMsg: '遗传概率超出有效范围（0-100%）',
    severity: 'error'
  },
  {
    name: '生态系统能量流动效率检查',
    check: (questionText) => {
      // 能量传递效率通常为10%-20%
      const efficiencyPattern = /能量(?:传递|流动)效率[为是约]?\s*(\d+\.?\d*)\s*%/;
      const match = questionText.match(efficiencyPattern);
      if (match) {
        const efficiency = parseFloat(match[1]);
        if (efficiency < 5 || efficiency > 25) {
          return false;
        }
      }
      return true;
    },
    errorMsg: '能量传递效率通常为10%-20%',
    severity: 'warning'
  },
  {
    name: 'DNA碱基配对检查',
    check: (questionText) => {
      // A=T, C≡G 规则
      const basePattern = /[ATCG]\s*[=＝]\s*[ATCG]/g;
      const validPairs = ['A=T', 'T=A', 'C≡G', 'G≡C', 'A＝T', 'T＝A'];
      let match;
      while ((match = basePattern.exec(questionText)) !== null) {
        const pair = match[0].replace(/\s/g, '');
        if (!validPairs.some(v => pair.includes(v.replace(/[=＝≡]/g, '')))) {
          return false;
        }
      }
      return true;
    },
    errorMsg: 'DNA碱基配对不符合A-T、C-G规则',
    severity: 'error'
  }
];

/**
 * 历史验证规则
 */
const historyValidators = [
  {
    name: '年代范围检查',
    check: (questionText) => {
      // 检查历史年代是否合理（公元前3000年-至今）
      const yearPattern = /(?:公元前?|前)?\s*(\d{3,4})\s*年/g;
      let match;
      while ((match = yearPattern.exec(questionText)) !== null) {
        const year = parseInt(match[1]);
        if (year > 2100) {
          return false;
        }
      }
      return true;
    },
    errorMsg: '历史年代超出合理范围',
    severity: 'error'
  },
  {
    name: '朝代顺序检查',
    check: (questionText) => {
      // 检查是否有明显朝代顺序错误
      const dynastyOrder = ['秦', '汉', '三国', '晋', '南北朝', '隋', '唐', '五代十国', '宋', '元', '明', '清'];
      const found = dynastyOrder.filter(d => questionText.includes(d));
      // 检查提及的朝代是否按顺序出现
      for (let i = 0; i < found.length - 1; i++) {
        const idx1 = questionText.indexOf(found[i]);
        const idx2 = questionText.indexOf(found[i + 1]);
        if (idx1 > idx2) {
          return null; // 提及顺序反了但不一定是错误（可能在比较）
        }
      }
      return true;
    },
    errorMsg: '朝代提及顺序可能有问题',
    severity: 'warning'
  },
  {
    name: '历史人物年代一致性检查',
    check: (questionText) => {
      // 检查常见跨朝代错误搭配
      const anachronisms = [
        { person: '秦始皇', notWith: ['纸', '印刷术', '火药'] },
        { person: '岳飞', notWith: ['元朝', '蒙古', '成吉思汗'] },
        { person: '林则徐', notWith: ['民国', '辛亥革命'] },
      ];
      for (const item of anachronisms) {
        if (questionText.includes(item.person)) {
          for (const term of item.notWith) {
            if (questionText.includes(term)) {
              return null;
            }
          }
        }
      }
      return true;
    },
    errorMsg: '历史人物与事件年代可能不匹配',
    severity: 'warning'
  },
  {
    name: '历史分期术语检查',
    check: (questionText) => {
      // 检查"近代""现代"使用是否合理
      if (/近代/.test(questionText) && /先秦|秦汉|隋唐|宋元|明清/.test(questionText)) {
        return null;
      }
      return true;
    },
    errorMsg: '"近代"术语使用需核实（中国近代史一般指1840年后）',
    severity: 'warning'
  }
];

/**
 * 地理验证规则
 */
const geographyValidators = [
  {
    name: '经纬度范围检查',
    check: (questionText) => {
      const coordPattern = /(?:纬度|经度)[为是]?\s*(\d+\.?\d*)\s*[°度]/g;
      let match;
      while ((match = coordPattern.exec(questionText)) !== null) {
        const value = parseFloat(match[1]);
        // 纬度0-90，经度0-180
        if (questionText.includes('纬') && (value < 0 || value > 90)) {
          return false;
        }
        if (questionText.includes('经') && (value < 0 || value > 180)) {
          return false;
        }
      }
      return true;
    },
    errorMsg: '经纬度数值超出合理范围',
    severity: 'error'
  },
  {
    name: '比例尺合理性检查',
    check: (questionText) => {
      const scalePattern = /1\s*[:：]\s*(\d+)/;
      const match = questionText.match(scalePattern);
      if (match) {
        const scale = parseInt(match[1]);
        if (scale < 100 || scale > 100000000) {
          return false;
        }
      }
      return true;
    },
    errorMsg: '地图比例尺超出合理范围',
    severity: 'warning'
  },
  {
    name: '时区计算检查',
    check: (questionText) => {
      // 时区差不超过12小时
      const timeDiffPattern = /时差[为是]?\s*(\d+)\s*(?:小时|个?小时)/;
      const match = questionText.match(timeDiffPattern);
      if (match) {
        const diff = parseInt(match[1]);
        if (diff > 12) {
          return false;
        }
      }
      return true;
    },
    errorMsg: '时区差不应超过12小时',
    severity: 'error'
  },
  {
    name: '海拔高度合理性检查',
    check: (questionText) => {
      const altitudePattern = /海拔\s*(\d+)\s*米/g;
      let match;
      while ((match = altitudePattern.exec(questionText)) !== null) {
        const altitude = parseInt(match[1]);
        // 地球最高点约8848米，最低点约-430米
        if (altitude > 9000 || altitude < -500) {
          return false;
        }
      }
      return true;
    },
    errorMsg: '海拔高度超出地球实际范围',
    severity: 'warning'
  }
];

/**
 * 道德与法治/思想政治验证规则
 */
const politicsValidators = [
  {
    name: '法律条文引用格式检查',
    check: (questionText) => {
      // 法律名称应用书名号
      if (/中华人民共和国/.test(questionText) && !/《中华人民共和国/.test(questionText)) {
        return false;
      }
      return true;
    },
    errorMsg: '法律名称应用书名号《》包裹',
    severity: 'warning'
  },
  {
    name: '时政术语规范性检查',
    check: (questionText) => {
      // 检查常见不规范表述
      const irregularTerms = ['习大大', '彭妈妈'];
      for (const term of irregularTerms) {
        if (questionText.includes(term)) {
          return false;
        }
      }
      return true;
    },
    errorMsg: '时政人物称谓应使用规范表述',
    severity: 'error'
  },
  {
    name: '价值观导向检查',
    check: (questionText) => {
      // 检查是否有负面价值导向的表述
      const negativePatterns = [
        /读书无用/,
        /金钱至上/,
        /人不为己/,
      ];
      for (const pattern of negativePatterns) {
        if (pattern.test(questionText)) {
          return null; // 可能是辨析题，需人工判断
        }
      }
      return true;
    },
    errorMsg: '可能存在不当价值观表述，请核实',
    severity: 'warning'
  },
  {
    name: '宪法条款引用检查',
    check: (questionText) => {
      // 宪法条款格式：第X条
      const constitutionPattern = /宪法.*?第\s*(\d+)\s*条/;
      const match = questionText.match(constitutionPattern);
      if (match) {
        const article = parseInt(match[1]);
        if (article < 1 || article > 143) {
          return false;
        }
      }
      return true;
    },
    errorMsg: '宪法条款编号超出范围（共143条）',
    severity: 'error'
  }
];

/**
 * 科学（小学）验证规则
 */
const scienceValidators = [
  {
    name: '温度范围检查（摄氏度）',
    check: (questionText) => {
      const tempPattern = /(\d+\.?\d*)\s*[°摄]?[氏C度c]/g;
      let match;
      while ((match = tempPattern.exec(questionText)) !== null) {
        const temp = parseFloat(match[1]);
        // 地球表面 -90°C 到 60°C，实验中 -273°C 到数千°C
        if (temp < -273) {
          return false;
        }
      }
      return true;
    },
    errorMsg: '温度低于绝对零度（-273°C）',
    severity: 'error'
  },
  {
    name: '常见动植物名称检查',
    check: (questionText) => {
      // 小学科学中动植物的常见错误名称
      const wrongNames = {
        '蜻蛙': '青蛙',
        '密蜂': '蜜蜂',
        '大像': '大象',
      };
      for (const [wrong, correct] of Object.entries(wrongNames)) {
        if (questionText.includes(wrong)) {
          return false;
        }
      }
      return true;
    },
    errorMsg: '可能存在动植物名称错别字',
    severity: 'error'
  },
  {
    name: '单位使用规范检查',
    check: (questionText) => {
      // 小学科学中应使用中文单位或标准符号
      if (/重量[为是]/.test(questionText) && !/[克千克公斤吨gkg]/.test(questionText)) {
        return null;
      }
      return true;
    },
    errorMsg: '物理量后缺少单位',
    severity: 'warning'
  }
];

/**
 * 信息技术验证规则
 */
const itValidators = [
  {
    name: '编程语法关键字拼写检查',
    check: (questionText) => {
      // 常见编程关键字拼写错误
      const keywords = ['print', 'input', 'if', 'else', 'for', 'while', 'return', 'function'];
      const commonTypos = ['pritn', 'inpu', 'fuction', 'whlie', 'retrun'];
      for (const typo of commonTypos) {
        if (questionText.includes(typo)) {
          return false;
        }
      }
      return true;
    },
    errorMsg: '编程关键字可能存在拼写错误',
    severity: 'error'
  },
  {
    name: '文件大小单位检查',
    check: (questionText) => {
      // 检查文件大小是否合理
      const sizePattern = /(\d+\.?\d*)\s*(GB|MB|KB|TB|B)/g;
      let match;
      while ((match = sizePattern.exec(questionText)) !== null) {
        const value = parseFloat(match[1]);
        const unit = match[2];
        if (unit === 'TB' && value > 100) return false;
        if (unit === 'GB' && value > 10000) return false;
      }
      return true;
    },
    errorMsg: '文件大小数值超出常规范围',
    severity: 'warning'
  },
  {
    name: 'IP地址格式检查',
    check: (questionText) => {
      const ipPattern = /(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})/g;
      let match;
      while ((match = ipPattern.exec(questionText)) !== null) {
        for (let i = 1; i <= 4; i++) {
          const num = parseInt(match[i]);
          if (num < 0 || num > 255) {
            return false;
          }
        }
      }
      return true;
    },
    errorMsg: 'IP地址每段应在0-255之间',
    severity: 'error'
  }
];

/**
 * 根据学科获取对应的验证规则
 * @param {string} subject - 学科名称
 * @returns {Array} 验证规则数组
 */
export const getValidatorsForSubject = (subject) => {
  const validatorMap = {
    '数学': mathValidators,
    '物理': physicsValidators,
    '化学': chemistryValidators,
    '语文': chineseValidators,
    '英语': englishValidators,
    '生物': biologyValidators,    
    '历史': historyValidators,    
    '地理': geographyValidators,    
    '道德与法治': politicsValidators,
    '思想政治': politicsValidators,    
    '科学': scienceValidators,    
    '信息技术': itValidators,    
  };
  
  return [...commonValidators, ...(validatorMap[subject] || [])];
};

/**
 * 执行所有硬性规则检查
 * @param {string} content - 题目内容
 * @param {string} subject - 学科名称
 * @returns {Array} 检查结果数组
 */
export const runHardValidators = (content, subject) => {
  // 🔧 防御：content 必须是非空字符串
  if (!content || typeof content !== 'string' || !content.trim()) {
    return [];
  }
  const validators = getValidatorsForSubject(subject);
  const results = [];
  
  for (const validator of validators) {
    try {
      const passed = validator.check(content);
      if (passed === false) { // 明确失败
        results.push({
          name: validator.name,
          passed: false,
          message: validator.errorMsg,
          severity: validator.severity,
          autoFix: validator.autoFix || null
        });
      } else if (passed === null) { // 不确定
        results.push({
          name: validator.name,
          passed: null,
          message: validator.errorMsg,
          severity: 'warning'
        });
      }
    } catch (e) {
      console.warn(`验证规则"${validator.name}"执行出错:`, e.message);
    }
  }
  
  return results;
};

/**
 * 应用自动修复
 * @param {string} content - 原始内容
 * @param {Array} validationResults - 验证结果数组
 * @returns {string} 修复后的内容
 */
export const applyAutoFixes = (content, validationResults) => {
  let fixed = content;
  const validators = []; // 重新获取以访问 autoFix 函数
  
  for (const result of validationResults) {
    if (result.autoFix && typeof result.autoFix === 'function') {
      fixed = result.autoFix(fixed);
    }
  }
  
  // 也检查通用规则
  for (const validator of commonValidators) {
    if (validator.autoFix && !validator.check(content)) {
      fixed = validator.autoFix(fixed);
    }
  }
  
  return fixed;
};

export default {
  getValidatorsForSubject,
  runHardValidators,
  applyAutoFixes,
  mathValidators,
  physicsValidators,
  chemistryValidators,
  commonValidators
};