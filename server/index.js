// Environment variables are set by Render deployment
// No need to load .env file in production

// --- Start of Diagnostic Code ---
console.log(`[DIAGNOSTIC] Is VAPID_PUBLIC_KEY set? ${!!process.env.VAPID_PUBLIC_KEY}`);
console.log(`[DIAGNOSTIC] Is FIREBASE_SERVICE_ACCOUNT_KEY set? ${!!process.env.FIREBASE_SERVICE_ACCOUNT_KEY}`);
// --- End of Diagnostic Code ---


const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const webpush = require("web-push");
const admin = require("firebase-admin");
const cron = require("node-cron");

const app = express();
const port = process.env.PORT || 4000;

// --- MIDDLEWARE ---
app.use(cors());
app.use(bodyParser.json());

// --- FIREBASE ADMIN INITIALIZATION ---
// IMPORTANT: This requires a FIREBASE_SERVICE_ACCOUNT_KEY environment variable.
// The value should be the full JSON string of your service account key.
try {
    const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!serviceAccountString || serviceAccountString.trim() === '') {
        throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY is not set or is empty in the .env file.");
    }
    // The following line is the fix: It ensures the private_key is correctly formatted.
    const formattedString = serviceAccountString.replace(/\\n/g, '\\n');
    const serviceAccount = JSON.parse(formattedString);

    // Try to get existing app or create a new one with unique name
    let firebaseApp;
    try {
        firebaseApp = admin.app();
        console.log("Firebase Admin SDK already initialized, using existing app.");
    } catch (e) {
        // No existing app, create a new one
        firebaseApp = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        }, 'mainServerApp');
        console.log("Firebase Admin SDK initialized successfully with unique name.");
    }
} catch (error) {
    console.error("Firebase Admin SDK initialization failed. Ensure FIREBASE_SERVICE_ACCOUNT_KEY is set correctly.", error);
    process.exit(1); // Exit if Firebase can't init
}

const db = admin.firestore();

// --- WEB PUSH INITIALIZATION ---
// IMPORTANT: Requires VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY environment variables.
try {
    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

    if (!vapidPublicKey || !vapidPrivateKey) {
        throw new Error("VAPID keys are not configured in environment variables.");
    }

    webpush.setVapidDetails(
        "mailto:support@smartbharat.com",
        vapidPublicKey,
        vapidPrivateKey
    );
    console.log("Web Push initialized successfully.");
} catch (error) {
    console.error("Web Push initialization failed.", error);
    process.exit(1);
}

// --- API ROUTES ---

// Endpoint to get the public VAPID key (needed by the frontend)
app.get("/vapid-public-key", (req, res) => {
    res.send(process.env.VAPID_PUBLIC_KEY);
});

// Endpoint to subscribe a user
app.post("/subscribe", async (req, res) => {
    const { userId, subscription } = req.body;

    if (!userId || !subscription) {
        return res.status(400).json({ error: "Missing userId or subscription." });
    }

    try {
        const userRef = db.collection("users").doc(userId);
        // Use set with merge: true. This creates the doc if it doesn't exist,
        // or updates it if it does. This is safer than .update().
        await userRef.set({
            pushSubscriptions: admin.firestore.FieldValue.arrayUnion(subscription),
        }, { merge: true });
        res.status(201).json({ message: "Subscription saved or updated." });
    } catch (error) {
        console.error("Error saving subscription:", error);
        res.status(500).json({ error: "Failed to save subscription." });
    }
});

// Endpoint to send a push directly to a user (for testing)
app.post("/send-push-to-user", async (req, res) => {
    const { userId, payload } = req.body;

    if (!userId || !payload) {
        return res.status(400).json({ error: "Missing userId or payload." });
    }

    try {
        const userSnap = await db.collection("users").doc(userId).get();
        if (!userSnap.exists) {
            return res.status(404).json({ error: "User not found." });
        }
        const user = userSnap.data();

        if (!user.pushSubscriptions || user.pushSubscriptions.length === 0) {
            return res.status(400).json({ error: "User has no subscriptions." });
        }

        const subscriptions = user.pushSubscriptions;
        const payloadString = JSON.stringify(payload);

        // Use Promise.allSettled to handle individual push failures
        const pushResults = await Promise.allSettled(
            subscriptions.map(sub => webpush.sendNotification(sub, payloadString))
        );

        const validSubscriptions = [];
        let hadFailures = false;

        pushResults.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                validSubscriptions.push(subscriptions[index]);
            } else { // status is 'rejected'
                hadFailures = true;
                const error = result.reason;
                console.error(`Failed to send to one subscription:`, error.body || error.message);
                // If the subscription is expired (410), we'll remove it by not adding it to the valid list.
                // For other errors, we keep it, assuming it might be a temporary issue.
                if (error.statusCode !== 410) {
                    validSubscriptions.push(subscriptions[index]);
                }
            }
        });

        // If any subscriptions were removed, update the user in Firestore
        if (validSubscriptions.length < subscriptions.length) {
            console.log(`Pruning ${subscriptions.length - validSubscriptions.length} expired subscriptions for user ${userId}.`);
            await db.collection("users").doc(userId).update({
                pushSubscriptions: validSubscriptions
            });
        }

        // If there were failures but none were due to expired subscriptions, return an error
        if (hadFailures && validSubscriptions.length === subscriptions.length) {
            return res.status(500).json({ error: "Some push notifications failed to send." });
        }
        
        res.status(200).json({ message: "Push notifications processed successfully." });

    } catch (error) {
        // This outer catch is for issues like the user not being found or Firestore errors
        console.error("Error in send-push-to-user endpoint:", error);
        res.status(500).json({ error: "Failed to send push notification." });
    }
});


// Endpoint to start a journey
app.post("/start-journey", async (req, res) => {
    const { userId, journeyId } = req.body;
    if (!userId || !journeyId) {
        return res.status(400).json({ error: "Missing userId or journeyId." });
    }

    try {
        const journeySnap = await db.collection("journeys").doc(journeyId).get();
        if (!journeySnap.exists) {
            return res.status(404).json({ error: "Journey not found." });
        }
        const journey = journeySnap.data();

        const batch = db.batch();
        const now = admin.firestore.Timestamp.now();

        journey.steps.forEach((step, index) => {
            const sendAt = new admin.firestore.Timestamp(now.seconds + step.delaySeconds, now.nanoseconds);
            const scheduledPushRef = db.collection("scheduled_notifications").doc();
            batch.set(scheduledPushRef, {
                userId,
                journeyId,
                sendAt,
                message: step.message,
                tag: step.tag || null,
            });
        });

        await batch.commit();
        res.status(200).json({ message: `Journey '${journeyId}' scheduled for user ${userId}.` });
    } catch (error) {
        console.error("Error starting journey:", error);
        res.status(500).json({ error: "Failed to start journey." });
    }
});

// --- CRON JOB SCHEDULER ---
// Runs every 5 minutes
cron.schedule("*/5 * * * *", async () => {
    console.log("Running cron job: Checking for scheduled pushes...");

    const now = admin.firestore.Timestamp.now();
    const query = db.collection("scheduled_notifications").where("sendAt", "<=", now).limit(50);
    
    try {
        const duePushesSnap = await query.get();
        if (duePushesSnap.empty) {
            console.log("No pushes due.");
            return;
        }

        const promises = duePushesSnap.docs.map(doc => processScheduledPush(doc.id, doc.data()));
        await Promise.all(promises);
        console.log(`Cron job finished: Processed ${duePushesSnap.size} pushes.`);

    } catch (error) {
        console.error("Error in cron job:", error);
    }
});

async function processScheduledPush(docId, pushData) {
    const { userId, message, tag } = pushData;

    try {
        const userSnap = await db.collection("users").doc(userId).get();
        if (!userSnap.exists) {
            console.log(`User ${userId} not found. Deleting push task.`);
            await db.collection("scheduled_notifications").doc(docId).delete();
            return;
        }

        const user = userSnap.data();
        let canSend = true;
        if (tag && (!user.tags || !user.tags.includes(tag))) {
            canSend = false;
        }

        if (canSend && user.pushSubscriptions && user.pushSubscriptions.length > 0) {
            const subscriptions = user.pushSubscriptions;
            const payloadString = JSON.stringify(message);

            const pushResults = await Promise.allSettled(
                subscriptions.map(sub => webpush.sendNotification(sub, payloadString))
            );

            const validSubscriptions = [];
            pushResults.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    validSubscriptions.push(subscriptions[index]);
                } else { // rejected
                    const error = result.reason;
                    console.error(`[CRON] Failed to send to one subscription for user ${userId}:`, error.body || error.message);
                    if (error.statusCode !== 410) {
                        validSubscriptions.push(subscriptions[index]);
                    }
                }
            });

            if (validSubscriptions.length < subscriptions.length) {
                console.log(`[CRON] Pruning ${subscriptions.length - validSubscriptions.length} expired subscriptions for user ${userId}.`);
                await db.collection("users").doc(userId).update({
                    pushSubscriptions: validSubscriptions
                });
            }
        }
    } catch (error) {
        console.error(`Failed to process push for user ${userId}:`, error);
    } finally {
        await db.collection("scheduled_notifications").doc(docId).delete();
    }
}

// --- Unified Notification Function ---
async function sendUnifiedNotification({ userId, title, body, icon, url, image, actions, type = 'booking', status = 'sent' }) {
    // 1. Write to Firestore
    await db.collection('notifications').add({
        title,
        body,
        icon,
        image,
        actions,
        url: url || '/',
        userId,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        type,
        status
    });
    // 2. Send push notification to all user subscriptions
    const userSnap = await db.collection('users').doc(userId).get();
    if (!userSnap.exists) return;
    const user = userSnap.data();
    if (!user.pushSubscriptions || user.pushSubscriptions.length === 0) return;
    const payload = JSON.stringify({ title, body, icon, image, actions, data: { url: url || '/', actions } });
    await Promise.allSettled(
        user.pushSubscriptions.map(sub => webpush.sendNotification(sub, payload))
    );
}

// --- Example: After booking status update, call sendUnifiedNotification ---
// Replace this with your actual booking update logic
app.post('/update-booking-status', async (req, res) => {
    const { userId, bookingId, newStatus } = req.body;
    // 1. Update booking status in your DB (not shown here)
    // 2. Send notification
    await sendUnifiedNotification({
        userId,
        title: 'Booking Status Updated',
        body: `Your booking status is now: ${newStatus}`,
        icon: '',
        url: '',
        image: '',
        actions: [],
        type: 'booking',
        status: 'sent'
    });
    res.status(200).json({ success: true, message: 'Booking status updated and notification sent.' });
});

// --- START SERVER ---
app.listen(port, () => {
    console.log(`Notification server listening on port ${port}`);
}); 