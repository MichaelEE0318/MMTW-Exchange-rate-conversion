import axios from 'axios';
import { RateRecord } from '../lib/types';
import { Timestamp } from '../lib/firebase';

/**
 * 台灣銀行匯率爬蟲 - 全幣別 Open API 版 (共 19+ 種幣別)
 */
const OPEN_DATA_URL = 'https://openapi.taifex.com.tw/v1/DailyForeignExchangeRates';
const BANK_CODE = 'BOT';
const BANK_NAME = '台灣銀行';

// 完整幣別對應表
const CURRENCY_MAP: Record<string, string> = {
  'USD/NTD': 'USD', // 美金
  'RMB/NTD': 'CNY', // 人民幣
  'EUR/NTD': 'EUR', // 歐元
  'GBP/NTD': 'GBP', // 英鎊
  'AUD/NTD': 'AUD', // 澳幣
  'HKD/NTD': 'HKD', // 港幣
  'JPY/NTD': 'JPY', // 日圓
  'CAD/NTD': 'CAD', // 加幣
  'SGD/NTD': 'SGD', // 新幣
  'CHF/NTD': 'CHF', // 瑞郎
  'NZD/NTD': 'NZD', // 紐幣
  'THB/NTD': 'THB', // 泰銖
  'KRW/NTD': 'KRW', // 韓元
};

function parseNumber(v: string | undefined): number | null {
  if (!v) return null;
  const trimmed = String(v).trim();
  if (trimmed === '' || trimmed === '-' || trimmed === '0') return null;
  const n = parseFloat(trimmed);
  return isNaN(n) || n <= 0 ? null : n;
}

export async function scrapeBOT(): Promise<RateRecord[]> {
  const startTime = Date.now();

  const { data } = await axios.get<Record<string, string>[]>(OPEN_DATA_URL, {
    timeout: 15000,
    headers: { 'Accept': 'application/json' },
  });

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('政府開放 API 回應無資料');
  }

  const latestData = data[data.length - 1];
  const now = Timestamp.now();
  const records: RateRecord[] = [];

  // 動態掃描最新一筆資料的所有 Key
  for (const [key, rawValue] of Object.entries(latestData)) {
    if (key === 'Date') continue;

    const rateVal = parseNumber(rawValue);
    if (!rateVal) continue;

    // 取得幣別代碼，若在選單外則取 '/' 前面的名稱
    const currencyCode = CURRENCY_MAP[key] || key.split('/')[0];

    if (currencyCode && currencyCode.length === 3) {
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
}    headers: {
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
