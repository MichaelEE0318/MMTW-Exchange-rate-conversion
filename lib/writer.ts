import { db } from './firebase.js';
import { RateRecord } from './types.js';

export async function writeRates(records: RateRecord[]): Promise<void> {
  if (records.length === 0) {
    console.warn('⚠️  無資料可寫入');
    return;
  }

  const CHUNK_SIZE = 200;

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
