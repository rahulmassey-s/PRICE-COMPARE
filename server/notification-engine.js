const express = require('express');
const bodyParser = require('body-parser');
const webpush = require('web-push');
const admin = require('firebase-admin');
const cors = require('cors');
require('dotenv').config();
require('dotenv').config(); // Automatically find .env.local in the root

console.log("PUBLIC_VAPID_KEY:", process.env.PUBLIC_VAPID_KEY);
console.log("PRIVATE_VAPID_KEY:", process.env.PRIVATE_VAPID_KEY); // Automatically find .env.local in the root

// --- Correct Initialization using Environment Variable ---
let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    } catch (e) {
        console.error('CRITICAL: Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY. Check your .env.local file. It must be a valid JSON string.', e);
        process.exit(1);
    }
} else {
    console.error('CRITICAL: FIREBASE_SERVICE_ACCOUNT_KEY is not defined in .env.local file.');
    process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const app = express();

// Set up CORS before other routes
app.use(cors({
    origin: ['http://localhost:3000', 'https://your-production-site.com'] // Add your production URL
}));

app.use(bodyParser.json());

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

app.post('/subscribe', (req, res) => {
    // Agar subscription nested hai toh usko extract karo
    const { userId, subscription } = req.body;
    let sub = subscription || req.body; // fallback agar direct bheja ho

    console.log("Subscription received:", req.body);

    if (!sub || !sub.endpoint) {
        console.error('Invalid subscription object:', req.body);
        return res.status(400).json({ success: false, message: 'Invalid subscription object. "endpoint" missing.' });
    }

    // UserId bhi save karna hai toh object me add kar do
    if (userId) sub.userId = userId;

    const endpointHash = require('crypto').createHash('sha256').update(sub.endpoint).digest('hex');

    db.collection('subscriptions').doc(endpointHash).set(sub)
    .then(() => res.status(201).json({ success: true, message: 'Subscription added.' }))
    .catch(err => {
        console.error('Error adding subscription:', err);
        res.status(500).json({ success: false, message: 'Failed to add subscription.' });
    });
});

   // Endpoint to provide VAPID public key to frontend
   app.get('/vapid_public_key', (req, res) => {
    res.send(process.env.PUBLIC_VAPID_KEY);
  });

  app.get('/vapid-public-key', (req, res) => {
    res.send(process.env.PUBLIC_VAPID_KEY);
  });

app.post('/send-notification', async (req, res) => {
    const { userId, title, body, icon, url, image, actions } = req.body;

    if (!userId) {
        return res.status(400).json({ success: false, message: 'User ID is required.' });
    }
    // --- Strict validation for image and actions ---
    let validatedImage = undefined;
    if (image && typeof image === 'string' && image.startsWith('https://')) {
        validatedImage = image;
    }
    let validatedActions = undefined;
    if (Array.isArray(actions)) {
        validatedActions = actions.filter(a => a && a.action && a.title);
        if (validatedActions.length === 0) validatedActions = undefined;
    }
    try {
        const querySnapshot = await db.collection('subscriptions').where('userId', '==', userId).get();
        if (querySnapshot.empty) {
            return res.status(404).json({ success: false, message: 'No subscriptions for this user.' });
        }
        const notificationPayload = JSON.stringify({
            title,
            body,
            icon,
            image: validatedImage,
            actions: validatedActions,
            data: { url: url || '/', actions: validatedActions }
        });
        const promises = querySnapshot.docs.map(doc => {
            return webpush.sendNotification(doc.data(), notificationPayload).catch(err => {
                if (err.statusCode === 410 || err.statusCode === 404) doc.ref.delete();
                else console.error('Failed to send to subscription', doc.id, err.body);
            });
        });
        await Promise.all(promises);
        // --- Log to Firestore ---
        await db.collection('notifications').add({
            title,
            body,
            icon: icon || '',
            image: validatedImage || '',
            actions: validatedActions || [],
            url: url || '/',
            userId,
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
            type: 'user',
            status: 'sent'
        });
        res.status(200).json({ success: true, message: 'Notifications sent.' });
    } catch (err) {
        console.error('Error sending user notification:', err);
        res.status(500).json({ success: false, message: 'Failed to send notification.' });
    }
});

app.post('/send-to-all', async (req, res) => {
    const { title, body, icon, url, image, actions } = req.body;
    // --- Strict validation for image and actions ---
    let validatedImage = undefined;
    if (image && typeof image === 'string' && image.startsWith('https://')) {
        validatedImage = image;
    }
    let validatedActions = undefined;
    if (Array.isArray(actions)) {
        validatedActions = actions.filter(a => a && a.action && a.title);
        if (validatedActions.length === 0) validatedActions = undefined;
    }
    const notificationPayload = JSON.stringify({
        title,
        body,
        icon,
        image: validatedImage,
        actions: validatedActions,
        data: { url: url || '/', actions: validatedActions }
    });
    try {
        const subscriptionsSnapshot = await db.collection('subscriptions').get();
        if (subscriptionsSnapshot.empty) {
            return res.status(200).json({ success: true, message: 'No subscriptions to send to.' });
        }
        let successCount = 0;
        let failureCount = 0;
        const promises = subscriptionsSnapshot.docs.map(doc => {
            return webpush.sendNotification(doc.data(), notificationPayload)
                .then(() => successCount++)
                .catch(err => {
                    failureCount++;
                    if (err.statusCode === 410 || err.statusCode === 404) doc.ref.delete();
                    else console.error('Failed to send to subscription', doc.id, err.body);
                });
        });
        await Promise.all(promises);
        // --- Log to Firestore ---
        await db.collection('notifications').add({
            title,
            body,
            icon: icon || '',
            image: validatedImage || '',
            actions: validatedActions || [],
            url: url || '/',
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
            type: 'broadcast',
            status: 'sent'
        });
        res.status(200).json({ success: true, message: `Broadcast finished. Success: ${successCount}, Failures: ${failureCount}.` });
    } catch (error) {
        console.error('Error broadcasting notifications:', error);
        res.status(500).json({ success: false, message: 'Failed to broadcast.' });
    }
});

// --- Unified Notification Function ---
async function sendUnifiedNotification({ userId, title, body, icon, url, image, actions, type = 'booking', status = 'sent' }) {
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

// --- Endpoint: Update Booking Status and Notify ---
app.post('/update-booking-status', async (req, res) => {
    const { userId, bookingId, newStatus } = req.body;
    // 1. (Optional) Update booking status in your DB (not shown here)
    // 2. Send notification
    await sendUnifiedNotification({
        userId,
        title: 'Booking Status Updated',
        body: `Your booking status is now: ${newStatus}`,
        icon: 'https://res.cloudinary.com/dvgilt12w/image/upload/v1749108912/Untitled_design__3___1___1_-removebg-preview_vds2ko.png',
        url: '',
        image: '',
        actions: [],
        type: 'booking',
        status: 'sent'
    });
    res.status(200).json({ success: true, message: 'Booking status updated and notification sent.' });
});

app.post('/schedule-notification', async (req, res) => {
    try {
        const { title, body, icon, image, url, actions, scheduledAt, segment, userIds, createdBy } = req.body;
        if (!title || !body || !scheduledAt) {
            return res.status(400).json({ success: false, message: 'Title, body, and scheduledAt are required.' });
        }
        await db.collection('scheduled_notifications').add({
            title,
            body,
            icon: icon || '',
            image: image || '',
            url: url || '',
            actions: actions || [],
            scheduledAt: new Date(scheduledAt),
            segment: segment || 'all',
            userIds: userIds || [],
            status: 'pending',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: createdBy || null
        });
        res.status(200).json({ success: true, message: 'Notification scheduled.' });
    } catch (err) {
        console.error('Error scheduling notification:', err);
        res.status(500).json({ success: false, message: 'Failed to schedule notification.' });
    }
});

app.post('/schedule-journey', async (req, res) => {
    try {
        const { name, steps } = req.body;
        if (!name || !Array.isArray(steps) || steps.length === 0) {
            return res.status(400).json({ success: false, message: 'Journey name and steps are required.' });
        }
        const batch = db.batch();
        // Create journey doc
        const journeyRef = db.collection('journeys').doc(name);
        batch.set(journeyRef, { name, active: true, createdAt: admin.firestore.FieldValue.serverTimestamp() });
        steps.forEach((step, i) => {
            // --- Day/time-based scheduledAt calculation ---
            let scheduledAt = null;
            if (Array.isArray(step.daysOfWeek) && step.daysOfWeek.length > 0 && Array.isArray(step.timesOfDay) && step.timesOfDay.length > 0) {
                const now = new Date();
                let soonest = null;
                for (let addDays = 0; addDays < 14; addDays++) {
                    const candidate = new Date(now.getTime() + addDays * 86400000);
                    const dayKey = ['sun','mon','tue','wed','thu','fri','sat'][candidate.getDay()];
                    if (step.daysOfWeek.includes(dayKey)) {
                        for (const t of step.timesOfDay) {
                            const [h, m] = t.split(':').map(Number);
                            const candidateTime = new Date(candidate);
                            candidateTime.setHours(h, m, 0, 0);
                            if (candidateTime > now && (!soonest || candidateTime < soonest)) {
                                soonest = candidateTime;
                            }
                        }
                    }
                }
                if (soonest) scheduledAt = soonest;
            }
            // Fallback to delay logic if no days/times set
            if (!scheduledAt) {
                let delayMs = 10 * 60000; // default 10 min
                if (typeof step.delay === 'number' && step.delay > 0 && step.delayUnit) {
                    if (step.delayUnit === 'min') delayMs = step.delay * 60000;
                    else if (step.delayUnit === 'hr') delayMs = step.delay * 3600000;
                    else if (step.delayUnit === 'day') delayMs = step.delay * 86400000;
                }
                scheduledAt = new Date(Date.now() + delayMs);
            }
            batch.set(db.collection('scheduled_notifications').doc(), {
                journeyName: name,
                stepIndex: i,
                title: step.title || '',
                body: step.body || '',
                image: step.image || '',
                icon: step.icon || '',
                actions: step.actions || [],
                url: step.url || '',
                segment: step.segment || 'all',
                delay: typeof step.delay === 'number' ? step.delay : 1,
                delayUnit: typeof step.delayUnit === 'string' && step.delayUnit ? step.delayUnit : 'min',
                daysOfWeek: step.daysOfWeek || [],
                timesOfDay: step.timesOfDay || [],
                scheduledAt,
                status: 'pending',
                type: 'journey',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        });
        await batch.commit();
        res.status(200).json({ success: true, message: 'Journey scheduled.' });
    } catch (err) {
        console.error('Error scheduling journey:', err);
        res.status(500).json({ success: false, message: 'Failed to schedule journey.' });
    }
});

app.post('/schedule-inactive-campaign', async (req, res) => {
    try {
        const { inactiveDuration, inactiveUnit, inactiveTitle, inactiveBody, inactiveImage, inactiveUrl, inactiveSegment, inactiveDays, inactiveTimes } = req.body;
        if (!inactiveDuration || !inactiveUnit || !inactiveTitle || !inactiveBody) {
            return res.status(400).json({ success: false, message: 'All required fields must be provided.' });
        }
        await db.collection('inactive_campaigns').add({
            inactiveDuration,
            inactiveUnit,
            title: inactiveTitle,
            body: inactiveBody,
            image: inactiveImage || '',
            url: inactiveUrl || '',
            segment: inactiveSegment || 'all',
            daysOfWeek: inactiveDays || [],
            timesOfDay: inactiveTimes || [],
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            status: 'active',
        });
        res.status(200).json({ success: true, message: 'Inactive campaign scheduled.' });
    } catch (err) {
        console.error('Error scheduling inactive campaign:', err);
        res.status(500).json({ success: false, message: 'Failed to schedule inactive campaign.' });
    }
});

// Batch update labName in testLabPrices when lab name changes
app.post('/update-lab-name', async (req, res) => {
  const { oldLabName, newLabName } = req.body;
  if (!oldLabName || !newLabName) {
    return res.status(400).json({ error: 'oldLabName and newLabName are required' });
  }
  try {
    const pricesRef = admin.firestore().collection('testLabPrices');
    const snapshot = await pricesRef.where('labName', '==', oldLabName).get();
    if (snapshot.empty) {
      return res.json({ updated: 0 });
    }
    const batch = admin.firestore().batch();
    snapshot.forEach(doc => {
      batch.update(doc.ref, { labName: newLabName });
    });
    await batch.commit();
    res.json({ updated: snapshot.size });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
}); 

module.exports = {
    sendUnifiedNotification,
  };