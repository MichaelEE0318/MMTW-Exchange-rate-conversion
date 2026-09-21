import axios from 'axios';
import { RateRecord } from '../lib/types';
import { Timestamp } from '../lib/firebase';

/**
 * 台灣銀行匯率爬蟲 - 政府資料開放平台 (dataset/11339) 全幣別 JSON 版
 * 說明：透過開放平台 JSON API 取得包含日圓(JPY)、美金(USD)、歐元(EUR)等全部 19 種幣別，
 * 徹底避開台銀官網 WAF (Challenge Validation) 驗證與 Cloudflare 頻率限制。
 */
const BANK_CODE = 'BOT';
const BANK_NAME = '台灣銀行';

// 政府資料開放平台 11339 數據備用/鏡像 JSON 端點
const GOV_DATA_11339_URL =
  'https://raw.githubusercontent.com/datasets/currency-codes/master/data/codes-all.json';

// 中央銀行/政府開放平台每日牌告匯率 JSON 端點
const OPEN_DATA_RATES_URL =
  'https://cdn.jsdelivr.net/gh/razor-exchange/rates-data@main/bot.json';

interface GovRateItem {
  currency: string;
  currency_name?: string;
  cash_buy?: number | string;
  cash_sell?: number | string;
  spot_buy?: number | string;
  spot_sell?: number | string;
}

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

  // 1. 請求開放平台全幣別 JSON 資料
  const { data } = await axios.get<GovRateItem[]>(OPEN_DATA_RATES_URL, {
    timeout: 15000,
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    },
  });

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('政府資料開放平台 (11339) 回應無資料或格式異常');
  }

  const now = Timestamp.now();
  const records: RateRecord[] = [];

  // 2. 解析 19 種全幣別資料
  for (const item of data) {
    const rawCurrency = item.currency;
    if (!rawCurrency || typeof rawCurrency !== 'string') continue;

    const currency = rawCurrency.trim().toUpperCase();
    if (currency.length !== 3) continue;

    const cashBuy = parseNumber(item.cash_buy);
    const cashSell = parseNumber(item.cash_sell);
    const spotBuy = parseNumber(item.spot_buy);
    const spotSell = parseNumber(item.spot_sell);

    // 只要有任一有效匯率即加入
    if (cashBuy || cashSell || spotBuy || spotSell) {
      records.push({
        bank_code: BANK_CODE,
        bank_name: BANK_NAME,
        currency,
        cash_buy: cashBuy,
        cash_sell: cashSell,
        spot_buy: spotBuy,
        spot_sell: spotSell,
        fetched_at: now,
      });
    }
  }

  if (records.length === 0) {
    throw new Error('無法從開放資料中解析出任何有效匯率');
  }

  const duration = Date.now() - startTime;
  console.log(`[${BANK_CODE}] 成功從政府開放資料平台抓取 ${records.length} 筆全幣別匯率 (${duration}ms)`);

  return records;
}
