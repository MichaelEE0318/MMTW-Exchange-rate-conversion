import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

/**
 * 初始化 Firebase Admin SDK
 * 優先順序：
 *   1. 環境變數 FIREBASE_SERVICE_ACCOUNT（GitHub Actions 用）
 *   2. 本機 firebase-key.json（開發用）
 */
function initFirebase() {
  if (admin.apps.length > 0) return admin.app();

  let credential: admin.credential.Credential;

  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    // GitHub Actions 模式：從環境變數讀 JSON 字串
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    credential = admin.credential.cert(serviceAccount);
    console.log('🔑 使用環境變數 FIREBASE_SERVICE_ACCOUNT 認證');
  } else {
    // 本機模式：讀 firebase-key.json
    const keyPath = resolve(process.cwd(), 'firebase-key.json');
    if (!existsSync(keyPath)) {
      throw new Error(
        `找不到認證：請在專案根目錄放 firebase-key.json，` +
        `或設定環境變數 FIREBASE_SERVICE_ACCOUNT`
      );
    }
    const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf-8'));
    credential = admin.credential.cert(serviceAccount);
    console.log('🔑 使用本機 firebase-key.json 認證');
  }

  return admin.initializeApp({ credential });
}

initFirebase();

export const db = admin.firestore();
export const Timestamp = admin.firestore.Timestamp;
export const FieldValue = admin.firestore.FieldValue;
