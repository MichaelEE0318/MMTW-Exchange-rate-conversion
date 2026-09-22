import { chromium, Browser, BrowserContext } from 'playwright';

/**
 * 共用 Playwright browser 管理器
 * - 整個爬蟲流程共用一個 browser instance，減少啟動成本
 * - 每個銀行的爬蟲用獨立的 context（隔離 cookies、cache）
 */

let browser: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
  if (!browser) {
    console.log('🌐 啟動 Chromium...');
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled', // 隱藏自動化痕跡
      ],
    });
  }
  return browser;
}

/**
 * 建立新的 browser context，模擬真實使用者
 */
export async function newContext(): Promise<BrowserContext> {
  const b = await getBrowser();
  const context = await b.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    locale: 'zh-TW',
    timezoneId: 'Asia/Taipei',
    viewport: { width: 1440, height: 900 },
    // 進一步偽裝
    extraHTTPHeaders: {
      'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
    },
  });

  // 隱藏 webdriver 特徵
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  return context;
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
    console.log('🌐 關閉 Chromium');
  }
}
