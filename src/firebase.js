const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const path = require('path');

const serviceAccountPath = path.join(__dirname, '..', 'firebase-service-account.json');
let credential;

try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    credential = cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON));
  } else {
    credential = cert(require(serviceAccountPath));
  }
  
  initializeApp({ credential });
  console.log('[Firebase] ✅ Admin SDK initialized successfully');
} catch (error) {
  console.error('[Firebase] ❌ Failed to initialize Firebase Admin SDK:', error.message);
}

const db = getFirestore('default');
const auth = getAuth();

module.exports = {
  db,
  auth
};
