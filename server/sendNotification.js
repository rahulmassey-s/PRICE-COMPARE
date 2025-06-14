// server/sendNotification.js
const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
const bodyParser = require('body-parser');
const { getTokensForTargetGroup, sendNotification } = require('./notification-engine');

// --- Firebase Admin Initialization ---
// It's crucial that this is initialized before the engine is used.
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// --- Express App Setup ---
const app = express();
const corsOptions = {
  origin: ['https://labpricecompare.netlify.app', 'http://localhost:9002'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(bodyParser.json());
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});
const PORT = process.env.PORT || 3001;

// --- API Endpoint ---
app.post('/api/send-notification', async (req, res) => {
  const { target, userId, ...payload } = req.body;
  
  console.log(`Received request to send notification to target: ${target}`);

  try {
    const tokens = await getTokensForTargetGroup(target, userId);

    if (!tokens || tokens.length === 0) {
      console.log('No valid FCM tokens found for the selected target.');
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

app.listen(PORT, () => {
  console.log(`Push Notification API server running on port ${PORT}`);
}); 