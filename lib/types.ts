import type { firestore } from 'firebase-admin';

export interface RateRecord {
  bank_code: string;
  bank_name: string;
  currency: string;
  cash_buy: number | null;
  cash_sell: number | null;
  spot_buy: number | null;
  spot_sell: number | null;
  fetched_at: firestore.Timestamp;
}

export interface ScraperResult {
  bank_code: string;
  success: boolean;
  count: number;
  error?: string;
  duration_ms: number;
}
