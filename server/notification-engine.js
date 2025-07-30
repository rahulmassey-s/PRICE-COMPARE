const webpush = require('web-push');
const admin = require('firebase-admin');

console.log("PUBLIC_VAPID_KEY:", process.env.PUBLIC_VAPID_KEY);
console.log("PRIVATE_VAPID_KEY:", process.env.PRIVATE_VAPID_KEY);

// Initialize webpush
const publicVapidKey = process.env.PUBLIC_VAPID_KEY;
const privateVapidKey = process.env.PRIVATE_VAPID_KEY;

if (!publicVapidKey || !privateVapidKey) {
    console.error("CRITICAL: VAPID keys not found. Check your .env.local file.");
    process.exit(1);
}

webpush.setVapidDetails(
  'mailto:test@example.com',
  publicVapidKey,
  privateVapidKey
);

// --- Unified Notification Function ---
async function sendUnifiedNotification({ userId, title, body, icon, url, image, actions, type = 'booking', status = 'sent' }) {
    // Get Firebase app instance
    const firebaseApp = admin.app();
    const db = firebaseApp.firestore();
    
    // 1. Write to Firestore
    await db.collection('notifications').add({
        title,
        body,
        icon: icon || '',
        image: image || '',
        actions: actions || [],
        url: url || '/',
        userId,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        type,
        status
    });
    // 2. Send push notification to all user subscriptions
    const querySnapshot = await db.collection('subscriptions').where('userId', '==', userId).get();
    if (querySnapshot.empty) return;
    const notificationPayload = JSON.stringify({ title, body, icon, image, actions, data: { url: url || '/', actions } });
    await Promise.allSettled(
        querySnapshot.docs.map(doc => webpush.sendNotification(doc.data(), notificationPayload))
    );
}

// Function to get tokens for target group
async function getTokensForTargetGroup(target, userId) {
  // Get Firebase app instance
  const firebaseApp = admin.app();
  const db = firebaseApp.firestore();
  
  const tokens = [];
  try {
    if (!target || target === 'All') {
      console.log("Fetching tokens for 'All' users.");
      const usersSnapshot = await db.collection('users').get();
      usersSnapshot.forEach(userDoc => {
        const userData = userDoc.data();
        if (userData.fcmToken) tokens.push({ userId: userDoc.id, token: userData.fcmToken });
        if (Array.isArray(userData.fcmTokens)) {
          userData.fcmTokens.forEach(token => {
            tokens.push({ userId: userDoc.id, token });
          });
        }
      });
    } else if (target === 'Members') {
      console.log("Fetching tokens for 'Members'.");
      const usersSnapshot = await db.collection('users').where('role', '==', 'member').get();
      usersSnapshot.forEach(userDoc => {
        const userData = userDoc.data();
        if (userData.fcmToken) tokens.push({ userId: userDoc.id, token: userData.fcmToken });
        if (Array.isArray(userData.fcmTokens)) {
          userData.fcmTokens.forEach(token => {
            tokens.push({ userId: userDoc.id, token });
          });
        }
      });
    } else if (target === 'User' && userId) {
      console.log(`Fetching token for user: ${userId}`);
      const userDoc = await db.collection('users').doc(userId).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        if (userData.fcmToken) tokens.push({ userId: userDoc.id, token: userData.fcmToken });
        if (Array.isArray(userData.fcmTokens)) {
          userData.fcmTokens.forEach(token => {
            tokens.push({ userId: userDoc.id, token });
          });
        }
      }
    }
  } catch(err) {
    console.error(`Error fetching tokens for target ${target}:`, err);
  }
  return tokens;
}

// Function to send notification
async function sendNotification(tokens, payload) {
  if (tokens.length === 0) {
    return { successCount: 0, failureCount: 0, responses: [] };
  }
  
  const message = {
    tokens: tokens.map(t => t.token),
    webpush: {
      fcm_options: {
        link: payload.link || 'https://price-compare-liart.vercel.app/',
      },
    },
    data: {
      title: payload.title || 'New Notification',
      body: payload.body || '',
      link: payload.link || '',
      type: payload.type || 'info',
      imageUrl: payload.imageUrl || '',
      actions: payload.actions && payload.actions.length > 0 ? JSON.stringify(payload.actions) : '[]',
    },
  };
  
  try {
    console.log(`Sending notification to ${tokens.length} token(s).`);
    const messaging = admin.messaging();
    const response = await messaging.sendEachForMulticast(message);
    const successCount = response.successCount;
    const failureCount = response.failureCount;
    
    const responses = response.responses.map((resp, idx) => ({
      success: resp.success,
      error: resp.success ? null : resp.error
    }));
    
    return { successCount, failureCount, responses };
  } catch (error) {
    console.error('Error sending notification:', error);
    return { successCount: 0, failureCount: tokens.length, responses: tokens.map(() => ({ success: false, error })) };
  }
}

module.exports = {
    sendUnifiedNotification,
    getTokensForTargetGroup,
    sendNotification
};