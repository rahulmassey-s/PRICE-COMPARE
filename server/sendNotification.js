// server/sendNotification.js
const express = require('express');
const admin = require('firebase-admin');
const bodyParser = require('body-parser');
// We are removing the 'cors' library and handling it manually for definitive control.
// const cors = require('cors'); 
const { getTokensForTargetGroup, sendNotification } = require('./notification-engine');

// --- Firebase Admin Initialization ---
try {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log('Firebase Admin SDK initialized successfully.');
} catch (error) {
  console.error('Firebase Admin SDK initialization failed:', error);
  // Exit if Firebase can't initialize, as the app is useless without it.
  process.exit(1);
}

// --- Express App Setup ---
const app = express();
const PORT = process.env.PORT || 3001;

// --- Middleware ---

// 1. Custom CORS Middleware: Manually set headers to ensure they are always present.
app.use((req, res, next) => {
  // Allow any origin for now. This is the most permissive setting.
  res.setHeader('Access-Control-Allow-Origin', '*');
  // Allowed methods
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  // Allowed headers
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,Authorization');
  // Allow credentials - important for some auth flows
  res.setHeader('Access-Control-Allow-Credentials', true);

  // Handle preflight OPTIONS request.
  // The browser sends this before a POST/PUT etc. to check if the server allows it.
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204); // 204 No Content - success signal for preflight.
  }

  // Pass to next middleware
  next();
});

// 2. Body Parser: To handle JSON payloads.
app.use(bodyParser.json());


// --- Routes ---

// 1. Health Check Route: To verify the server is running.
app.get('/', (req, res) => {
  res.status(200).send('Notification API Server is up and running!');
});

// 2. Main Notification API Endpoint
app.post('/api/send-notification', async (req, res) => {
  const { target, userId, ...payload } = req.body;
  
  console.log(`Received notification request for target: ${target}`);
  const db = admin.firestore();

  try {
    const userTokenPairs = await getTokensForTargetGroup(target, userId);
    
    if (userTokenPairs.length === 0) {
      return res.status(404).json({ success: false, message: 'No recipients found for the target group.' });
    }
    
    const tokens = userTokenPairs.map(pair => pair.token);
    const report = await sendNotification(tokens, payload);

    // Create the main log entry first to get its ID
    const logRef = db.collection('notifications').doc();
    const logEntry = {
      id: logRef.id,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      target: { name: target, userId: userId || null },
      requestPayload: payload,
      delivery: {
        totalSent: tokens.length,
        successCount: report.successCount,
        failureCount: report.failureCount,
      },
    };
    await logRef.set(logEntry);
    
    // Now, create the detailed per-user logs in a sub-collection
    const batch = db.batch();
    report.responses.forEach((resp, idx) => {
      const userTokenPair = userTokenPairs[idx];
      const detailLogRef = logRef.collection('delivery_details').doc(userTokenPair.userId + '_' + userTokenPair.token.slice(-10));

      batch.set(detailLogRef, {
        userId: userTokenPair.userId,
        token: userTokenPair.token,
        status: resp.success ? 'Success' : 'Failure',
        error: resp.success ? null : resp.error.toJSON(),
      });
    });
    
    await batch.commit();

    if (report.successCount > 0) {
      res.status(200).json({ success: true, message: 'Notification sent successfully.', report });
    } else {
      res.status(500).json({ success: false, message: 'Failed to send notification to any recipients.', report });
    }

  } catch (error) {
    console.error('Unhandled error in /api/send-notification:', error);
    // Also log critical failures to Firestore
     db.collection('notifications').add({
       createdAt: admin.firestore.FieldValue.serverTimestamp(),
       target: { name: target, userId: userId || null },
       requestPayload: payload,
       criticalError: error.message
     }).catch(err => console.error("Failed to write CRITICAL notification log:", err));

    res.status(500).json({ success: false, message: 'An internal server error occurred.' });
  }
});

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`Push Notification API server running on port ${PORT}`);
}); 