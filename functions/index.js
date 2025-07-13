const functions = require("firebase-functions");
const admin = require("firebase-admin");
const webpush = require("web-push");

// --- INITIALIZATION ---
admin.initializeApp();
const db = admin.firestore();

// Initialize web-push with VAPID keys from Firebase environment config
const vapidKeys = {
  publicKey: functions.config().push.public_key,
  privateKey: functions.config().push.private_key,
};
webpush.setVapidDetails(
    "mailto:support@smartbharat.com", // Replace with your support email
    vapidKeys.publicKey,
    vapidKeys.privateKey
);

// ===================================================================================
// API ENDPOINT 1: Subscribe a user to push notifications
// ===================================================================================
exports.subscribeToPush = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
  }
  const { subscription } = data;
  const userId = context.auth.uid;

  if (!subscription || !subscription.endpoint) {
    throw new functions.https.HttpsError("invalid-argument", "Missing push subscription object.");
  }

  const userRef = db.collection("users").doc(userId);
  
  return db.runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists) {
        transaction.set(userRef, { pushSubscriptions: [subscription] });
        return { success: true, message: "User created and subscribed successfully." };
    }

    const userData = userDoc.data();
    const existingSubscriptions = userData.pushSubscriptions || [];
    const alreadySubscribed = existingSubscriptions.some(sub => sub.endpoint === subscription.endpoint);

    if (alreadySubscribed) {
        return { success: true, message: "User is already subscribed with this device." };
    }

    transaction.update(userRef, {
        pushSubscriptions: admin.firestore.FieldValue.arrayUnion(subscription),
    });
    
    return { success: true, message: "User subscribed successfully." };
  });
});

// ===================================================================================
// API ENDPOINT 2: Manually send a push to a user
// ===================================================================================
exports.sendPushToUser = functions.https.onCall(async (data, context) => {
    const { userId, payload } = data;
    const userSnap = await db.collection("users").doc(userId).get();

    if (!userSnap.exists) {
        throw new functions.https.HttpsError("not-found", "User not found.");
    }
    
    const user = userSnap.data();
    if (!user.pushSubscriptions || user.pushSubscriptions.length === 0) {
        return { success: false, message: "User has no subscriptions." };
    }

    const pushPromises = user.pushSubscriptions.map(sub => 
        webpush.sendNotification(sub, JSON.stringify(payload)).catch(err => console.error(`Push Error: ${err.statusCode}`))
    );

    await Promise.all(pushPromises);
    return { success: true, message: `Push sent to ${userId}.` };
});

// ===================================================================================
// API ENDPOINT 3: Start a journey for a user
// ===================================================================================
exports.startJourney = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
  }
  const { journeyId } = data;
  const userId = context.auth.uid;

  const journeySnap = await db.collection("journeys").doc(journeyId).get();
  if (!journeySnap.exists) {
      throw new functions.https.HttpsError("not-found", "Journey not found.");
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
          stepIndex: index,
          sendAt,
          message: step.message,
          tag: step.tag || null
      });
  });

  await batch.commit();

  return { success: true, message: `Journey '${journeyId}' successfully scheduled for user ${userId}.` };
});


// ===================================================================================
// SCHEDULED FUNCTION: Runs every 5 minutes
// ===================================================================================
exports.checkScheduledPushes = functions.pubsub.schedule("every 5 minutes").onRun(async (context) => {
  console.log("Checking for scheduled pushes...");

  const now = admin.firestore.Timestamp.now();
  const query = db.collection("scheduled_notifications").where("sendAt", "<=", now).limit(50);
  const duePushesSnap = await query.get();

  if (duePushesSnap.empty) {
    console.log("No pushes due.");
    return null;
  }

  const promises = duePushesSnap.docs.map(doc => processScheduledPush(doc.id, doc.data()));

  await Promise.all(promises);
  console.log(`Processed ${duePushesSnap.size} scheduled pushes.`);
  return null;
});


// ===================================================================================
// HELPER FUNCTION: Processes a single scheduled push.
// ===================================================================================
async function processScheduledPush(docId, pushData) {
    const { userId, message, tag } = pushData;

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
        console.log(`User ${userId} does not have tag '${tag}'. Skipping push.`);
    }

    if (canSend) {
        if (user.pushSubscriptions && user.pushSubscriptions.length > 0) {
            const pushPromises = user.pushSubscriptions.map(sub => 
                webpush.sendNotification(sub, JSON.stringify(message))
            );
            await Promise.all(pushPromises);
            console.log(`Successfully sent push to user ${userId}.`);
        }
    }

    await db.collection("scheduled_notifications").doc(docId).delete();
} 