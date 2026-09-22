import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

function initFirebase() {
  if (admin.apps.length > 0) return admin.app();

  let credential: admin.credential.Credential;

  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    credential = admin.credential.cert(serviceAccount);
    console.log('🔑 使用環境變數 FIREBASE_SERVICE_ACCOUNT 認證');
  } else {
    const keyPath = resolve(process.cwd(), 'firebase-key.json');
    if (!existsSync(keyPath)) {
      throw new Error(
        `找不到認證：請在專案根目錄放 firebase-key.json，` +
          `或設定環境變數 FIREBASE_SERVICE_ACCOUNT`,
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
