import { RateRecord } from '../lib/types.js';
import { Timestamp } from '../lib/firebase.js';
import { newContext } from '../lib/browser.js';
import { parseRateNumber, extractCurrencyCode } from '../lib/parser.js';

/**
 * 台灣銀行匯率爬蟲（Playwright + HTML 表格）
 *
 * 資料來源：https://rate.bot.com.tw/xrt?Lang=zh-TW
 *
 * 網頁結構（實測）：
 *   <table title="牌告匯率">
 *     <tbody>
 *       <tr>
 *         <td>美金 (USD)</td>
 *         <td data-table="本行現金買入">31.85</td>
 *         <td data-table="本行現金賣出">32.52</td>
 *         <td data-table="本行即期買入">32.20</td>
 *         <td data-table="本行即期賣出">32.30</td>
 *         ...
 *       </tr>
 *     </tbody>
 *   </table>
 *
 * 策略：
 *   - 用 title="牌告匯率" 定位表格（比 class 穩，改版機率極低）
 *   - 用 data-table 屬性抓欄位（比欄位順序穩）
 *   - CSV 端點已知在 GitHub Actions 海外 IP 被擋，直接跳過
 */

const BANK_CODE = 'BOT';
const BANK_NAME = '台灣銀行';
const BOT_HTML_URL = 'https://rate.bot.com.tw/xrt?Lang=zh-TW';

// 台銀 td 的 data-table 屬性值 → 我們的欄位名
const FIELD_MAP = {
  cash_buy: '本行現金買入',
  cash_sell: '本行現金賣出',
  spot_buy: '本行即期買入',
  spot_sell: '本行即期賣出',
} as const;

export async function scrapeBOT(): Promise<RateRecord[]> {
  const startTime = Date.now();
  const context = await newContext();
  const page = await context.newPage();

  try {
    await page.goto(BOT_HTML_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    // 等表格出現 - 用 title 屬性選取，比 class 穩
    await page.waitForSelector('table[title="牌告匯率"]', {
      timeout: 15000,
    });

    await page.waitForSelector('table[title="牌告匯率"] tbody tr', {
      timeout: 5000,
    });

    const rows = await page.$$eval(
      'table[title="牌告匯率"] tbody tr',
      (trs, fieldMap) => {
        return trs.map((tr) => {
          const firstTd = tr.querySelector('td');
          const currency_raw =
            firstTd?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

          const getByAttr = (attr: string): string => {
            const el = tr.querySelector(`td[data-table="${attr}"]`);
            return el?.textContent?.trim() ?? '';
          };

          return {
            currency_raw,
            cash_buy: getByAttr(fieldMap.cash_buy),
            cash_sell: getByAttr(fieldMap.cash_sell),
            spot_buy: getByAttr(fieldMap.spot_buy),
            spot_sell: getByAttr(fieldMap.spot_sell),
          };
        });
      },
      FIELD_MAP,
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

    // 若一筆都沒抓到，明確 throw 並印出 debug 資訊
    if (records.length === 0) {
      const html = await page.content();
      const snippet = html.slice(0, 800).replace(/\s+/g, ' ');
      throw new Error(
        `解析後 0 筆資料。可能網頁改版，頁面前 800 字：${snippet}`,
      );
    }

    const duration = Date.now() - startTime;
    console.log(`[${BANK_CODE}] ✅ 抓到 ${records.length} 筆匯率 (${duration}ms)`);
    return records;
  } finally {
    await context.close();
  }
}
