/**
 * iOS 签名到期倒计时
 *
 * 原理：iOS 免费签名 7 天有效，爱思助手签名→立即安装（间隔可忽略）
 *       因此直接从 App 首次启动时间计算倒计时，无需读取 provisioning profile。
 *
 * 重置：用户重新签名安装后，可手动点击"已续签"重置倒计时。
 */
const INSTALL_TIME_KEY = '__ios_sign_install_time';
const SIGN_DURATION_DAYS = 7;

export interface SignatureInfo {
  expirationDate: string
  expirationTimestamp: number
  daysRemaining: number
  found: boolean
  installTime: number
}

/**
 * 获取签名到期倒计时
 * 首次调用自动记录安装时间，之后基于该时间计算 7 天倒计时
 */
export function getSignCountdown(): SignatureInfo {
  let installTime = 0;
  try {
    const stored = localStorage.getItem(INSTALL_TIME_KEY);
    installTime = stored ? parseInt(stored, 10) : 0;
  } catch { /* ignore */ }

  if (!installTime || installTime < 1000000000000) {
    installTime = Date.now();
    try { localStorage.setItem(INSTALL_TIME_KEY, String(installTime)); } catch {}
  }

  const expireTime = installTime + SIGN_DURATION_DAYS * 86400000;
  const elapsed = Date.now() - installTime;
  const elapsedDays = Math.floor(elapsed / 86400000);
  const daysRemaining = Math.max(0, SIGN_DURATION_DAYS - elapsedDays);

  return {
    installTime,
    daysRemaining,
    found: true,
    expirationDate: new Date(expireTime).toLocaleDateString('zh-CN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    }),
    expirationTimestamp: expireTime,
  };
}

/**
 * 手动重置倒计时（用户在爱思助手重新签名安装后点击）
 */
export function resetInstallTime(): void {
  try {
    localStorage.setItem(INSTALL_TIME_KEY, String(Date.now()));
  } catch { /* ignore */ }
}

/**
 * 获取签名到期信息（兼容旧 API，内部调用 getSignCountdown）
 */
export async function getSignatureExpiration(): Promise<SignatureInfo> {
  return getSignCountdown();
}

/**
 * 清除缓存（安装时间倒计时模式下无缓存概念，保留空实现兼容旧调用）
 */
export function clearSignatureCache(): void {
  // no-op
}

/**
 * 格式化剩余天数显示
 */
export function formatDaysRemaining(days: number): { text: string; color: string; warning: boolean } {
  if (days <= 0) {
    return { text: '已到期！', color: '#e53e3e', warning: true };
  }
  if (days === 1) {
    return { text: '最后 1 天！', color: '#e53e3e', warning: true };
  }
  if (days <= 3) {
    return { text: `${days} 天`, color: '#e53e3e', warning: true };
  }
  if (days <= 7) {
    return { text: `${days} 天`, color: '#38a169', warning: false };
  }
  return { text: `${days} 天`, color: '#38a169', warning: false };
}
