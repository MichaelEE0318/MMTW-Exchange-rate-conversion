import type { firestore } from 'firebase-admin';

export interface RateRecord {
  /** 銀行代碼（例：BOT, MEGA, ESUN） */
  bank_code: string;
  /** 銀行中文名 */
  bank_name: string;
  /** 幣別代碼（例：USD, JPY） */
  currency: string;
  /** 現金買入（銀行用現金向客戶買外幣的價格） */
  cash_buy: number | null;
  /** 現金賣出（銀行賣現金外幣給客戶的價格） */
  cash_sell: number | null;
  /** 即期買入 */
  spot_buy: number | null;
  /** 即期賣出 */
  spot_sell: number | null;
  /** 抓取時間 */
  fetched_at: firestore.Timestamp;
}

export interface ScraperResult {
  bank_code: string;
  success: boolean;
  count: number;
  error?: string;
  duration_ms: number;
}
