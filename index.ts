import { scrapeBOT } from './scrapers/bot.js';
import { writeRates } from './lib/writer.js';
import { closeBrowser } from './lib/browser.js';
import { RateRecord, ScraperResult } from './lib/types.js';

interface Scraper {
  code: string;
  fn: () => Promise<RateRecord[]>;
}

const scrapers: Scraper[] = [
  { code: 'BOT', fn: scrapeBOT },
  // Phase 2 加入：MEGA, ESUN, CATHAY, CTBC, SINOPAC, TAISHIN, FIRST, HNCB, TCB
];

async function runScraper(s: Scraper): Promise<ScraperResult> {
  const start = Date.now();
  try {
    const records = await s.fn();
    await writeRates(records);
    return {
      bank_code: s.code,
      success: true,
      count: records.length,
      duration_ms: Date.now() - start,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`❌ [${s.code}] 失敗: ${msg}`);
    return {
      bank_code: s.code,
      success: false,
      count: 0,
      error: msg,
      duration_ms: Date.now() - start,
    };
  }
}

async function main() {
  console.log(`🚀 開始抓取匯率 (${new Date().toISOString()})`);
  console.log(`   共 ${scrapers.length} 家銀行`);
  console.log('─'.repeat(50));

  try {
    // 並行執行；共用一個 browser instance
    const results = await Promise.all(scrapers.map(runScraper));

    console.log('─'.repeat(50));
    console.log('📊 執行摘要：');

    const success = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);
    const totalRecords = success.reduce((sum, r) => sum + r.count, 0);

    console.table(
      results.map((r) => ({
        銀行: r.bank_code,
        狀態: r.success ? '✅' : '❌',
        筆數: r.count,
        耗時ms: r.duration_ms,
        錯誤: r.error ?? '',
      })),
    );

    console.log(
      `\n✨ 完成：${success.length}/${results.length} 家成功，共 ${totalRecords} 筆`,
    );

    if (failed.length > 0) {
      process.exitCode = 1;
    }
  } finally {
    // 確保 browser 一定關閉，避免 CI 掛住
    await closeBrowser();
  }
}

main().catch((err) => {
  console.error('💥 主程式崩潰:', err);
  closeBrowser().finally(() => process.exit(1));
});
