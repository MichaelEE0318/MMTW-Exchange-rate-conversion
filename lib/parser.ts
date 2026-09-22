/**
 * 解析銀行牌價的數字字串
 * - 空字串、"-"、"0" 都當作「不提供」回傳 null
 * - 移除千分位逗號
 */
export function parseRateNumber(v: string | undefined | null): number | null {
  if (!v) return null;
  const trimmed = v.trim();
  if (trimmed === '' || trimmed === '-' || /^0+\.?0*$/.test(trimmed)) return null;
  const n = parseFloat(trimmed.replace(/,/g, ''));
  return isNaN(n) || n <= 0 ? null : n;
}

/**
 * 從「美金 (USD)」這類字串抓出 3 碼幣別代碼
 */
export function extractCurrencyCode(text: string): string | null {
  const match = text.match(/\(([A-Z]{3})\)/);
  return match ? match[1] : null;
}
