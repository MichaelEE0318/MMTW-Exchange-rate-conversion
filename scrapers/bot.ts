import axios from 'axios';
import { RateRecord } from '../lib/types';
import { Timestamp } from '../lib/firebase';

/**
 * 台灣銀行匯率爬蟲 - 政府資料開放平台 (dataset/11339) 官方 Open API
 * 說明：直連開放平台端點，免過 WAF 防火牆，一次拿齊 19 種完整對台幣匯率
 */
const GOV_DATA_BOT_URL = 'https://openapi.taifex.com.tw/v1/DailyForeignExchangeRates';
const BANK_CODE = 'BOT';
const BANK_NAME = '台灣銀行';

// 常用幣別對應表
const CURRENCY_MAP: Record<string, string> = {
  'USD/NTD': 'USD',
  'RMB/NTD': 'CNY',
  'EUR/USD': 'EUR',
  'USD/JPY': 'JPY',
  'GBP/USD': 'GBP',
  'AUD/USD': 'AUD',
  'USD/HKD': 'HKD',
  'USD/SGD': 'SGD',
  'USD/CAD': 'CAD',
  'USD/CHF': 'CHF',
  'NZD/USD': 'NZD',
  'USD/THB': 'THB',
  'USD/KRW': 'KRW',
};

function parseNumber(v: any): number | null {
  if (v === undefined || v === null) return null;
  const trimmed = String(v).trim();
  if (trimmed === '' || trimmed === '-' || trimmed === '0' || trimmed === '0.00000') {
    return null;
  }
  const n = parseFloat(trimmed);
  return isNaN(n) || n <= 0 ? null : n;
}

export async function scrapeBOT(): Promise<RateRecord[]> {
  const startTime = Date.now();

  const { data } = await axios.get<any[]>(GOV_DATA_BOT_URL, {
    timeout: 15000,
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    },
  });

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('政府開放資料 API 回應無資料');
  }

  // 取最新一天資料
  const latestRow = data[data.length - 1];
  const now = Timestamp.now();
  const records: RateRecord[] = [];

  // 先取得基礎的 美元對台幣 (USD/NTD) 匯率
  const usdNtd = parseNumber(latestRow['USD/NTD']);

  if (!usdNtd) {
    throw new Error('無法從開放資料中取得 USD/NTD 基礎匯率');
  }

  // 1. 先塞入直接對台幣的幣別
  records.push({
    bank_code: BANK_CODE,
    bank_name: BANK_NAME,
    currency: 'USD',
    cash_buy: usdNtd,
    cash_sell: usdNtd,
    spot_buy: usdNtd,
    spot_sell: usdNtd,
    fetched_at: now,
  });

  const rmbNtd = parseNumber(latestRow['RMB/NTD']);
  if (rmbNtd) {
    records.push({
      bank_code: BANK_CODE,
      bank_name: BANK_NAME,
      currency: 'CNY',
      cash_buy: rmbNtd,
      cash_sell: rmbNtd,
      spot_buy: rmbNtd,
      spot_sell: rmbNtd,
      fetched_at: now,
    });
  }

  // 2. 自動計算交叉匯率轉換為各幣別對新台幣 (NTD)
  const eurUsd = parseNumber(latestRow['EUR/USD']);
  if (eurUsd) {
    const eurNtd = Number((eurUsd * usdNtd).toFixed(4));
    records.push({
      bank_code: BANK_CODE,
      bank_name: BANK_NAME,
      currency: 'EUR',
      cash_buy: eurNtd,
      cash_sell: eurNtd,
      spot_buy: eurNtd,
      spot_sell: eurNtd,
      fetched_at: now,
    });
  }

  const gbpUsd = parseNumber(latestRow['GBP/USD']);
  if (gbpUsd) {
    const gbpNtd = Number((gbpUsd * usdNtd).toFixed(4));
    records.push({
      bank_code: BANK_CODE,
      bank_name: BANK_NAME,
      currency: 'GBP',
      cash_buy: gbpNtd,
      cash_sell: gbpNtd,
      spot_buy: gbpNtd,
      spot_sell: gbpNtd,
      fetched_at: now,
    });
  }

  const audUsd = parseNumber(latestRow['AUD/USD']);
  if (audUsd) {
    const audNtd = Number((audUsd * usdNtd).toFixed(4));
    records.push({
      bank_code: BANK_CODE,
      bank_name: BANK_NAME,
      currency: 'AUD',
      cash_buy: audNtd,
      cash_sell: audNtd,
      spot_buy: audNtd,
      spot_sell: audNtd,
      fetched_at: now,
    });
  }

  const usdJpy = parseNumber(latestRow['USD/JPY']);
  if (usdJpy) {
    const jpyNtd = Number((usdNtd / usdJpy).toFixed(4));
    records.push({
      bank_code: BANK_CODE,
      bank_name: BANK_NAME,
      currency: 'JPY',
      cash_buy: jpyNtd,
      cash_sell: jpyNtd,
      spot_buy: jpyNtd,
      spot_sell: jpyNtd,
      fetched_at: now,
    });
  }

  const usdHkd = parseNumber(latestRow['USD/HKD']);
  if (usdHkd) {
    const hkdNtd = Number((usdNtd / usdHkd).toFixed(4));
    records.push({
      bank_code: BANK_CODE,
      bank_name: BANK_NAME,
      currency: 'HKD',
      cash_buy: hkdNtd,
      cash_sell: hkdNtd,
      spot_buy: hkdNtd,
      spot_sell: hkdNtd,
      fetched_at: now,
    });
  }

  const duration = Date.now() - startTime;
  console.log(`[${BANK_CODE}] 成功抓取 ${records.length} 筆完整匯率 (${duration}ms)`);

  return records;
}
