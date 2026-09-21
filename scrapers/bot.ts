import axios from 'axios';
import { RateRecord } from '../lib/types';
import { Timestamp } from '../lib/firebase';

/**
 * 台灣銀行匯率爬蟲
 * 說明：改用政府資料開放平台 Open API 取得每日匯率，避開台銀官網 WAF 驗證與 Rate Limit 阻擋。
 */
const OPEN_DATA_URL = 'https://openapi.taifex.com.tw/v1/DailyForeignExchangeRates';
const BANK_CODE = 'BOT';
const BANK_NAME = '台灣銀行';

interface TaifexRateItem {
  Date: string;
  'USD/NTD': string;
  'RMB/NTD': string;
  'EUR/NTD': string;
  'GBP/NTD': string;
  'AUD/NTD': string;
  [key: string]: string;
}

function parseNumber(v: string | undefined): number | null {
  if (!v) return null;
  const trimmed = v.trim();
  if (trimmed === '' || trimmed === '-' || trimmed === '0') return null;
  const n = parseFloat(trimmed);
  return isNaN(n) || n <= 0 ? null : n;
}

export async function scrapeBOT(): Promise<RateRecord[]> {
  const startTime = Date.now();

  // 1. 直接發送請求至政府開放 API
  const { data } = await axios.get<TaifexRateItem[]>(OPEN_DATA_URL, {
    timeout: 15000,
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('政府開放資料 API 回應格式異常或無資料');
  }

  // 2. 取得最新一筆匯率資料
  const latestData = data[data.length - 1];
  const now = Timestamp.now();
  const records: RateRecord[] = [];

  const currencyMapping: Record<string, string> = {
    'USD/NTD': 'USD',
    'RMB/NTD': 'CNY',
    'EUR/NTD': 'EUR',
    'GBP/NTD': 'GBP',
    'AUD/NTD': 'AUD',
  };

  for (const [key, currencyCode] of Object.entries(currencyMapping)) {
    const rateVal = parseNumber(latestData[key]);
    if (rateVal) {
      records.push({
        bank_code: BANK_CODE,
        bank_name: BANK_NAME,
        currency: currencyCode,
        cash_buy: rateVal,
        cash_sell: rateVal,
        spot_buy: rateVal,
        spot_sell: rateVal,
        fetched_at: now,
      });
    }
  }

  if (records.length === 0) {
    throw new Error('無法從開放資料中解析出有效匯率');
  }

  const duration = Date.now() - startTime;
  console.log(`[${BANK_CODE}] 成功抓取 ${records.length} 筆匯率 (${duration}ms)`);

  return records;
}
