import axios from 'axios';
import { RateRecord } from '../lib/types';
import { Timestamp } from '../lib/firebase';

/**
 * 台灣銀行匯率爬蟲
 *
 * 資料來源：台銀官方 CSV 端點
 * https://rate.bot.com.tw/xrt/flcsv/0/day
 *
 * CSV 格式（節錄）：
 *   幣別,現金買入,現金賣出,即期買入,即期賣出,遠期10天...
 *   USD,31.85,32.52,32.20,32.30,...
 */

const BOT_CSV_URL = 'https://rate.bot.com.tw/xrt/flcsv/0/day';
const BANK_CODE = 'BOT';
const BANK_NAME = '台灣銀行';

// 台銀 CSV 的欄位索引（0-based）
const COL = {
  CURRENCY: 0,
  CASH_BUY: 2,
  CASH_SELL: 12,
  SPOT_BUY: 3,
  SPOT_SELL: 13,
} as const;

function parseNumber(v: string | undefined): number | null {
  if (!v) return null;
  const trimmed = v.trim();
  // 台銀對某些幣別的現金匯率會顯示為 0 或 "-"，代表不提供
  if (trimmed === '' || trimmed === '-' || trimmed === '0') return null;
  const n = parseFloat(trimmed);
  return isNaN(n) || n <= 0 ? null : n;
}

export async function scrapeBOT(): Promise<RateRecord[]> {
  const startTime = Date.now();

  const { data } = await axios.get<string>(BOT_CSV_URL, {
    responseType: 'text',
    timeout: 15000,
    headers: {
     'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    },
  });

  const lines = data.trim().split('\n');
  console.log('抓取的 Raw CSV 前 200 字：', csvText.slice(0, 200));
  if (lines.length < 2) {
    throw new Error('台銀 CSV 資料為空或格式異常');
  }

  const records: RateRecord[] = [];
  const now = Timestamp.now();

  // 跳過標題列
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const currency = cols[COL.CURRENCY]?.trim();

    if (!currency || currency.length !== 3) continue; // 幣別必為 3 碼

    records.push({
      bank_code: BANK_CODE,
      bank_name: BANK_NAME,
      currency,
      cash_buy: parseNumber(cols[COL.CASH_BUY]),
      cash_sell: parseNumber(cols[COL.CASH_SELL]),
      spot_buy: parseNumber(cols[COL.SPOT_BUY]),
      spot_sell: parseNumber(cols[COL.SPOT_SELL]),
      fetched_at: now,
    });
  }

  const duration = Date.now() - startTime;
  console.log(`[${BANK_CODE}] 抓到 ${records.length} 筆匯率 (${duration}ms)`);

  return records;
}
