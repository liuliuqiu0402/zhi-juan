/**
 * 签名状态检查工具
 * 调用原生 AppSignature 插件读取 embedded.mobileprovision 中的到期时间
 * 非 iOS 平台返回 fallback 数据
 */

export interface SignatureInfo {
  /** 到期时间，格式 yyyy-MM-dd HH:mm:ss，null 表示无法读取 */
  expirationDate: string | null
  /** 到期时间戳（毫秒） */
  expirationTimestamp: number
  /** 剩余天数，-1 表示无法读取 */
  daysRemaining: number
  /** 是否找到签名文件 */
  found: boolean
}

let cachedInfo: SignatureInfo | null = null
let lastCheckTime = 0
const CACHE_TTL = 60 * 1000 // 1 分钟内不重复查询

/**
 * 获取签名到期信息
 * 仅在 iOS 原生环境可用，其他平台返回空结果
 */
export async function getSignatureExpiration(): Promise<SignatureInfo> {
  const now = Date.now()
  if (cachedInfo && now - lastCheckTime < CACHE_TTL) {
    return cachedInfo
  }

  // 只在 iOS 原生环境尝试调用插件
  try {
    const { Capacitor } = await import('@capacitor/core')
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios') {
      // @ts-expect-error 本地 Capacitor 插件，无 npm 类型声明
      const result = await Capacitor.Plugins.AppSignature.getExpiration()
      cachedInfo = result as SignatureInfo
      lastCheckTime = now
      return cachedInfo
    }
  } catch {
    // 非 iOS 环境或无插件，返回空结果
  }

  // 桌面端 / Web / Android fallback
  cachedInfo = {
    expirationDate: null,
    expirationTimestamp: 0,
    daysRemaining: -1,
    found: false,
  }
  lastCheckTime = now
  return cachedInfo
}

/**
 * 清除缓存，强制下次重新读取
 */
export function clearSignatureCache(): void {
  cachedInfo = null
  lastCheckTime = 0
}

/**
 * 格式化剩余天数显示
 */
export function formatDaysRemaining(days: number): { text: string; color: string; warning: boolean } {
  if (days < 0) {
    return { text: '未知', color: '#999', warning: false }
  }
  if (days === 0) {
    return { text: '今日到期！', color: '#e53e3e', warning: true }
  }
  if (days === 1) {
    return { text: `${days} 天（明天到期！）`, color: '#e53e3e', warning: true }
  }
  if (days <= 3) {
    return { text: `${days} 天`, color: '#e53e3e', warning: true }
  }
  if (days <= 7) {
    return { text: `${days} 天`, color: '#dd6b20', warning: false }
  }
  return { text: `${days} 天`, color: '#38a169', warning: false }
}
