import axios from 'axios';
import { RateRecord } from '../lib/types';
import { Timestamp } from '../lib/firebase';

/**
 * 台灣銀行匯率爬蟲 - 中央銀行全幣別政府開放資料 API
 * 特點：提供完整 19+ 種貨幣對新台幣 (NTD) 的每日牌告匯率，免去 WAF 阻擋與 Rate Limit 問題。
 */
const CBC_API_URL = 'https://openapi.cbc.gov.tw/v1/ExchangeRates/Daily';
const BANK_CODE = 'BOT';
const BANK_NAME = '台灣銀行';

interface CbcRateItem {
  Date: string;
  Currency: string; // 例如: "USD", "JPY", "EUR"
  BuyRate?: string;
  SellRate?: string;
  [key: string]: any;
}

function parseNumber(v: any): number | null {
  if (v === undefined || v === null) return null;
  const trimmed = String(v).trim();
  if (trimmed === '' || trimmed === '-' || trimmed === '0') return null;
  const n = parseFloat(trimmed);
  return isNaN(n) || n <= 0 ? null : n;
}

export async function scrapeBOT(): Promise<RateRecord[]> {
  const startTime = Date.now();

  const { data } = await axios.get<any>(CBC_API_URL, {
    timeout: 15000,
    headers: { 'Accept': 'application/json' },
  });

  // 取得匯率列表資料
  const items: CbcRateItem[] = Array.isArray(data) ? data : data?.data || data?.result || [];

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('中央銀行 Open API 回應格式異常或無資料');
  }

  const now = Timestamp.now();
  const records: RateRecord[] = [];

  for (const item of items) {
    const currency = item.Currency || item['幣別'];
    if (!currency || typeof currency !== 'string') continue;

    const cleanCurrency = currency.trim().toUpperCase();
    if (cleanCurrency.length !== 3) continue;

    const buy = parseNumber(item.BuyRate || item['買入']);
    const sell = parseNumber(item.SellRate || item['賣出']);
    const rate = buy || sell;

    if (rate) {
      records.push({
        bank_code: BANK_CODE,
        bank_name: BANK_NAME,
        currency: cleanCurrency,
        cash_buy: buy || rate,
        cash_sell: sell || rate,
        spot_buy: buy || rate,
        spot_sell: sell || rate,
        fetched_at: now,
      });
    }
  }

  if (records.length === 0) {
    throw new Error('無法從開放資料中解析出有效匯率');
  }

  const duration = Date.now() - startTime;
  console.log(`[${BANK_CODE}] 成功抓取 ${records.length} 筆全幣別匯率 (${duration}ms)`);

  return records;
}
