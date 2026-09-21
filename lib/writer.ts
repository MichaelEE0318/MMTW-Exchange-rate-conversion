import { db } from './firebase';
import { RateRecord } from './types';

/**
 * 寫入匯率資料到 Firestore
 *   - rates_latest: 每家銀行每幣別只保留一筆（覆寫）
 *   - rates_history: 時間序列，保留 30 天（清理由另一支 job 處理）
 *
 * 使用 batch write 提升效能與原子性；Firestore batch 上限 500 筆。
 */
export async function writeRates(records: RateRecord[]): Promise<void> {
  if (records.length === 0) {
    console.warn('⚠️  無資料可寫入');
    return;
  }

  const CHUNK_SIZE = 200; // 每筆會產生 2 個 write (latest + history)，200 * 2 = 400 < 500

  for (let i = 0; i < records.length; i += CHUNK_SIZE) {
    const chunk = records.slice(i, i + CHUNK_SIZE);
    const batch = db.batch();
    const latestCol = db.collection('rates_latest');
    const historyCol = db.collection('rates_history');

    for (const r of chunk) {
      const latestId = `${r.bank_code}_${r.currency}`;
      batch.set(latestCol.doc(latestId), r);
      batch.set(historyCol.doc(), r);
    }

    await batch.commit();
  }

  console.log(`✅ 寫入 ${records.length} 筆匯率到 Firestore`);
}
