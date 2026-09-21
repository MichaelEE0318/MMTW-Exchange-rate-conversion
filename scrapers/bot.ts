import axios from 'axios';
import { RateRecord } from '../lib/types';
import { Timestamp } from '../lib/firebase';

/**
 * 匯率爬蟲 - 使用台灣期貨交易所 (TAIFEX) OpenAPI
 * API 文件：https://openapi.taifex.com.tw/#/%E8%B3%87%E6%96%99%E6%9F%A5%E8%A9%A2API/get_DailyForeignExchangeRates
 * 端點：GET /v1/DailyForeignExchangeRates
 */
const TAIFEX_API_URL = 'https://openapi.taifex.com.tw/v1/DailyForeignExchangeRates';
const BANK_CODE = 'BOT';
const BANK_NAME = '台灣銀行';

// 期貨交易所 API 回傳資料型態
interface TaifexDailyRate {
  Date: string; // 日期, 格式: YYYYMMDD
  'USD/NTD'?: string; // 美元／新台幣
  'RMB/NTD'?: string; // 人民幣／新台幣
  'EUR/USD'?: string; // 歐元／美元
  'USD/JPY'?: string; // 美元／日圓
  'GBP/USD'?: string; // 英鎊／美元
  'AUD/USD'?: string; // 澳幣／美元
  'USD/HKD'?: string; // 美元／港幣
  [key: string]: string | undefined;
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

  // 1. 發送 GET 請求至 TAIFEX OpenAPI 端點
  const { data } = await axios.get<TaifexDailyRate[]>(TAIFEX_API_URL, {
    timeout: 15000,
    headers: {
      'Accept': 'application/json',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('期貨交易所 API 回應格式異常或無資料');
  }

  // 2. 取得最新一日的匯率數據
  const latestRow = data[data.length - 1];
  const now = Timestamp.now();
  const records: RateRecord[] = [];

  // 基本對台幣匯率
  const usdNtd = parseNumber(latestRow['USD/NTD']);
  const rmbNtd = parseNumber(latestRow['RMB/NTD']);

  if (usdNtd) {
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
  }

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

  // 3. 透過交叉匯率算出其餘幣別對新台幣 (NTD) 的匯率
  if (usdNtd) {
    // 歐元對台幣 (EUR/NTD) = (EUR/USD) * (USD/NTD)
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

    // 英鎊對台幣 (GBP/NTD) = (GBP/USD) * (USD/NTD)
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

    // 澳幣對台幣 (AUD/NTD) = (AUD/USD) * (USD/NTD)
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

    // 日圓對台幣 (JPY/NTD) = (USD/NTD) / (USD/JPY)
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

    // 港幣對台幣 (HKD/NTD) = (USD/NTD) / (USD/HKD) (若有欄位)
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
  }

  if (records.length === 0) {
    throw new Error('未能從期貨交易所 API 解析出任何有效匯率');
  }

  const duration = Date.now() - startTime;
  console.log(`[${BANK_CODE}] 成功從期貨交易所 API 解析出 ${records.length} 筆匯率 (${duration}ms)`);

  return records;
}
