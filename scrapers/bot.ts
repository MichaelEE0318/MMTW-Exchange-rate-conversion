import { RateRecord } from '../lib/types.js';
import { Timestamp } from '../lib/firebase.js';
import { newContext } from '../lib/browser.js';
import { parseRateNumber, extractCurrencyCode } from '../lib/parser.js';

/**
 * 台灣銀行匯率爬蟲（Playwright 版）
 *
 * 資料來源：https://rate.bot.com.tw/xrt?Lang=zh-TW
 *
 * 網頁結構：
 *   <table class="table table-striped ...">
 *     <thead>幣別 現金買入 現金賣出 即期買入 即期賣出</thead>
 *     <tbody>
 *       <tr>
 *         <td>美金 (USD)</td>
 *         <td>31.85</td> <td>32.52</td>
 *         <td>32.20</td> <td>32.30</td>
 *         ...
 *       </tr>
 *     </tbody>
 *   </table>
 *
 * 策略：
 *   1. 先嘗試用 Playwright 的 request context 打 CSV 端點（快、便宜）
 *   2. 若失敗（被擋、格式錯），fallback 到 full browser 開 HTML 頁
 */

const BANK_CODE = 'BOT';
const BANK_NAME = '台灣銀行';
const BOT_HTML_URL = 'https://rate.bot.com.tw/xrt?Lang=zh-TW';
const BOT_CSV_URL = 'https://rate.bot.com.tw/xrt/flcsv/0/day';

export async function scrapeBOT(): Promise<RateRecord[]> {
  const startTime = Date.now();

  // 策略 1：Playwright request context 嘗試 CSV（帶 real browser headers）
  const csvResult = await tryFetchCsv();
  if (csvResult && csvResult.length > 0) {
    const duration = Date.now() - startTime;
    console.log(
      `[${BANK_CODE}] ✅ CSV 模式抓到 ${csvResult.length} 筆 (${duration}ms)`,
    );
    return csvResult;
  }

  console.log(`[${BANK_CODE}] ⚠️  CSV 模式失敗，改用瀏覽器渲染 HTML`);

  // 策略 2：Full browser 抓 HTML 表格
  const htmlResult = await scrapeHtml();
  const duration = Date.now() - startTime;
  console.log(
    `[${BANK_CODE}] ✅ HTML 模式抓到 ${htmlResult.length} 筆 (${duration}ms)`,
  );
  return htmlResult;
}

// ─────────────────────────────────────────────
// 策略 1：CSV 端點（用 Playwright request 帶 real browser headers）
// ─────────────────────────────────────────────
async function tryFetchCsv(): Promise<RateRecord[] | null> {
  const context = await newContext();
  try {
    // 先訪問首頁拿 cookie，模擬正常使用者
    const page = await context.newPage();
    await page.goto(BOT_HTML_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(500);

    // 用同一個 context 打 CSV（帶著 cookie）
    const response = await context.request.get(BOT_CSV_URL, {
      headers: {
        Referer: BOT_HTML_URL,
      },
      timeout: 15000,
    });

    if (!response.ok()) return null;

    const csvText = await response.text();
    // 檢查是不是真的 CSV（有時被擋會回傳 HTML 錯誤頁）
    if (!csvText.includes(',') || csvText.includes('<html')) return null;

    return parseCsv(csvText);
  } catch (err) {
    console.log(`[${BANK_CODE}] CSV 嘗試失敗:`, (err as Error).message);
    return null;
  } finally {
    await context.close();
  }
}

function parseCsv(csvText: string): RateRecord[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  const records: RateRecord[] = [];
  const now = Timestamp.now();

  // 台銀 CSV 欄位：幣別, ?, 現金買入, 即期買入, ..., 現金賣出, ..., 即期賣出
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const currency = cols[0]?.trim();
    if (!currency || currency.length !== 3) continue;

    records.push({
      bank_code: BANK_CODE,
      bank_name: BANK_NAME,
      currency,
      cash_buy: parseRateNumber(cols[2]),
      spot_buy: parseRateNumber(cols[3]),
      cash_sell: parseRateNumber(cols[12]),
      spot_sell: parseRateNumber(cols[13]),
      fetched_at: now,
    });
  }
  return records;
}

// ─────────────────────────────────────────────
// 策略 2：開 Chromium 抓 HTML 表格
// ─────────────────────────────────────────────
async function scrapeHtml(): Promise<RateRecord[]> {
  const context = await newContext();
  const page = await context.newPage();

  try {
    await page.goto(BOT_HTML_URL, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    // 等匯率表格出現
    await page.waitForSelector('table.table-striped tbody tr', {
      timeout: 10000,
    });

    // 抓每一列（td 欄位順序見官網）
    const rows = await page.$$eval('table.table-striped tbody tr', (trs) =>
      trs.map((tr) => {
        const tds = Array.from(tr.querySelectorAll('td'));
        return {
          currency_raw: tds[0]?.textContent?.trim() ?? '',
          cash_buy: tds[1]?.textContent?.trim() ?? '',
          cash_sell: tds[2]?.textContent?.trim() ?? '',
          spot_buy: tds[3]?.textContent?.trim() ?? '',
          spot_sell: tds[4]?.textContent?.trim() ?? '',
        };
      }),
    );

    const now = Timestamp.now();
    const records: RateRecord[] = [];

    for (const row of rows) {
      const currency = extractCurrencyCode(row.currency_raw);
      if (!currency) continue;

      records.push({
        bank_code: BANK_CODE,
        bank_name: BANK_NAME,
        currency,
        cash_buy: parseRateNumber(row.cash_buy),
        cash_sell: parseRateNumber(row.cash_sell),
        spot_buy: parseRateNumber(row.spot_buy),
        spot_sell: parseRateNumber(row.spot_sell),
        fetched_at: now,
      });
    }

    return records;
  } finally {
    await context.close();
  }
}
