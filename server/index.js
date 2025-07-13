require("dotenv").config();
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
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
    console.log("Firebase Admin SDK initialized successfully.");
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
        await userRef.update({
            pushSubscriptions: admin.firestore.FieldValue.arrayUnion(subscription),
        });
        res.status(201).json({ message: "Subscription saved." });
    } catch (error) {
        console.error("Error saving subscription:", error);
        res.status(500).json({ error: "Failed to save subscription." });
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

        if (canSend && user.pushSubscriptions) {
            const pushPromises = user.pushSubscriptions.map(sub =>
                webpush.sendNotification(sub, JSON.stringify(message))
            );
            await Promise.all(pushPromises);
        }
    } catch (error) {
        console.error(`Failed to process push for user ${userId}:`, error);
    } finally {
        await db.collection("scheduled_notifications").doc(docId).delete();
    }
}

// --- START SERVER ---
app.listen(port, () => {
    console.log(`Notification server listening on port ${port}`);
}); 