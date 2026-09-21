import axios from 'axios';
import { RateRecord } from '../lib/types';
import { Timestamp } from '../lib/firebase';

// 替換為你的 Cloudflare Worker 專屬網址
const BOT_CSV_URL = 'https://bot-rate-proxy.bot-rate-proxy.y2010yam.workers.dev';

const BANK_CODE = 'BOT';
const BANK_NAME = '台灣銀行';

const COL = {
  CURRENCY: 0,
  CASH_BUY: 2,
  SPOT_BUY: 3,
  CASH_SELL: 12,
  SPOT_SELL: 13,
} as const;

function parseNumber(v: string | undefined): number | null {
  if (!v) return null;
  const trimmed = v.trim();
  if (trimmed === '' || trimmed === '-' || trimmed === '0' || trimmed === '0.00000') {
    return null;
  }
  const n = parseFloat(trimmed);
  return isNaN(n) || n <= 0 ? null : n;
}

export async function scrapeBOT(): Promise<RateRecord[]> {
  const startTime = Date.now();

  // 從環境變數讀取 Key
  const proxyApiKey = process.env.PROXY_API_KEY;
  if (!proxyApiKey) {
    throw new Error('未設定環境變數 PROXY_API_KEY');
  }

  const { data } = await axios.get<string>(BOT_CSV_URL, {
    responseType: 'text',
    timeout: 15000,
    headers: {
      'X-API-KEY': proxyApiKey, // 帶上自訂標頭進行驗證
    },
  });

  const cleanData = data.replace(/^\ufeff/, '').trim();
  const lines = cleanData.split(/\r?\n/);

  if (lines.length < 2 || cleanData.startsWith('<')) {
    throw new Error('台銀回應非 CSV 格式，可能遭阻擋或代理伺服器異常');
  }

  const records: RateRecord[] = [];
  const now = Timestamp.now();

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim());
    const currency = cols[COL.CURRENCY];

    if (!currency || currency.length !== 3) continue;

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

  if (records.length === 0) {
    throw new Error('無法從 CSV 解析出任何有效的幣別匯率');
  }

  const duration = Date.now() - startTime;
  console.log(`[${BANK_CODE}] 成功抓取 ${records.length} 筆匯率 (${duration}ms)`);

  return records;
}
export async function scrapeBOT(): Promise<RateRecord[]> {
  const startTime = Date.now();

  const { data } = await axios.get<string>(BOT_CSV_URL, {
    responseType: 'text',
    timeout: 15000,
    headers: {
     'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });

  const cleanData = data.replace(/^\ufeff/, '').trim();
  const lines = cleanData.split(/\r?\n/);

  // 防護：如果抓到的是 HTML 或是無效字串
  if (lines.length < 2 || cleanData.startsWith('<')) {
    throw new Error('台銀回應非 CSV 格式，可能遭阻擋或網址異動');
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
