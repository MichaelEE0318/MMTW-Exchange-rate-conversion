import { scrapeBOT } from './scrapers/bot';
import { writeRates } from './lib/writer';
import { RateRecord, ScraperResult } from './lib/types';

/**
 * 匯率爬蟲主進入點
 *
 * Phase 1: 只跑台銀（BOT）
 * Phase 2 會加入其餘 9 家：兆豐、玉山、國泰、中信、永豐、台新、第一、華南、合庫
 */

interface Scraper {
  code: string;
  fn: () => Promise<RateRecord[]>;
}

const scrapers: Scraper[] = [
  { code: 'BOT', fn: scrapeBOT },
  // Phase 2 會在這裡加入其他銀行
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

  // 並行執行所有爬蟲（獨立失敗不影響其他）
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
    `\n✨ 完成：${success.length}/${results.length} 家成功，共 ${totalRecords} 筆資料`,
  );

  // 若有任何失敗，回傳非零 exit code（GitHub Actions 會顯示紅色）
  if (failed.length > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('💥 主程式崩潰:', err);
  process.exit(1);
});
