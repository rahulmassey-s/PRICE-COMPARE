const admin = require('firebase-admin');
let fetch = globalThis.fetch;
if (!fetch) {
  const nf = require('node-fetch');
  fetch = nf.default || nf;
}

const serviceAccount = require('./serviceAccountKey.json');

// Try to get existing app or create a new one with unique name
let firebaseApp;
try {
  firebaseApp = admin.app();
  console.log('Firebase Admin SDK already initialized in refreshDeliveryStats, using existing app.');
} catch (e) {
  // No existing app, create a new one
  firebaseApp = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  }, 'refreshDeliveryStatsApp');
  console.log('Firebase Admin SDK initialized successfully in refreshDeliveryStats with unique name.');
}

const db = firebaseApp.firestore();

const ONE_SIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONE_SIGNAL_API_KEY = process.env.ONESIGNAL_REST_API_KEY;
if (!ONE_SIGNAL_APP_ID || !ONE_SIGNAL_API_KEY) {
  console.error('OneSignal env vars missing');
  process.exit(1);
}

const WINDOW_HOURS = 48; // lookback window
const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

async function refresh() {
  console.log('Delivery refresh job started', new Date().toLocaleString());
  const since = new Date(Date.now() - WINDOW_HOURS * 60 * 60 * 1000);
  try {
    const snap = await db.collection('notifications')
      .where('createdAt', '>=', since)
      .get();
    if (snap.empty) {
      console.log('No recent notifications');
      return;
    }

    for (const doc of snap.docs) {
      const data = doc.data();
      // Skip if we already have non-zero delivery and we fetched <10min ago
      if (data._deliveryLastSync && Date.now() - data._deliveryLastSync.toMillis() < 10 * 60 * 1000) continue;

      const url = `https://onesignal.com/api/v1/notifications/${doc.id}?app_id=${ONE_SIGNAL_APP_ID}`;
      try {
        const res = await fetch(url, {
          headers: { Authorization: `Basic ${ONE_SIGNAL_API_KEY}` },
        });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const json = await res.json();
        const update = {
          delivery: {
            successCount: json.successful || 0,
            failureCount: json.failed || 0,
            converted: json.converted || 0,
          },
          _deliveryLastSync: admin.firestore.FieldValue.serverTimestamp(),
        };
        await doc.ref.set(update, { merge: true });
        console.log('Updated delivery for', doc.id, update.delivery);
      } catch (err) {
        console.warn('Failed to fetch detail for', doc.id, err.message);
      }
    }
  } catch (err) {
    console.error('Delivery refresh error', err);
  }
}

refresh();
setInterval(refresh, INTERVAL_MS); 