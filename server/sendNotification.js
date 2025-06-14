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

  try {
    const tokens = await getTokensForTargetGroup(target, userId);

    if (!tokens || tokens.length === 0) {
      console.log('No valid FCM tokens found for the target.');
      return res.status(404).json({ success: false, message: 'No valid FCM tokens found.' });
    }

    const result = await sendNotification(tokens, payload);

    if (result.success) {
      res.status(200).json({ success: true, message: 'Notification sent successfully.' });
    } else {
      res.status(500).json({ success: false, message: 'Failed to send notification.', error: result.error });
    }

  } catch (error) {
    console.error('Unhandled error in /api/send-notification:', error);
    res.status(500).json({ success: false, message: 'An internal server error occurred.' });
  }
});

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`Push Notification API server running on port ${PORT}`);
}); 