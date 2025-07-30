const { sendUnifiedNotification } = require('./notification-engine');
const admin = require('firebase-admin');
const { getTokensForTargetGroup, sendNotification } = require('./notification-engine');
const cron = require('node-cron');

// Correct path: Load the key from the same directory
const serviceAccount = require('./serviceAccountKey.json'); 

// Initialize Firebase Admin SDK

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    // ...other config
  });
}

const db = admin.firestore();
const messaging = admin.messaging();

const CHECK_INTERVAL_MS = 60 * 1000; // Check every 60 seconds

console.log('Firebase Notification Scheduler started.');
console.log(`Checking for notifications every ${CHECK_INTERVAL_MS / 1000} seconds.`);

/**
 * Fetches FCM tokens based on the target group.
 * @param {string} target - The target group ('All', 'Members', 'User:UID').
 * @param {string} userId - The specific user ID if targeting a single user.
 */
async function getFcmTokensForTarget(target, userId) {
    const tokens = [];
    try {
        if (!target || target === 'All') { // Corrected from 'All Users' to 'All'
            console.log("Fetching tokens for 'All' users.");
            const usersSnapshot = await db.collection('users').get();
            usersSnapshot.forEach(userDoc => {
                const userData = userDoc.data();
                if (userData.fcmToken) tokens.push(userData.fcmToken);
                if (Array.isArray(userData.fcmTokens)) tokens.push(...userData.fcmTokens);
            });
        } else if (target === 'Members') { // Corrected from 'Members Only' to 'Members'
            console.log("Fetching tokens for 'Members'.");
            const usersSnapshot = await db.collection('users').where('role', '==', 'member').get();
            usersSnapshot.forEach(userDoc => {
                const userData = userDoc.data();
                if (userData.fcmToken) tokens.push(userData.fcmToken);
                if (Array.isArray(userData.fcmTokens)) tokens.push(...userData.fcmTokens);
            });
        } else if (target === 'User' && userId) { // Corrected target name
            console.log(`Fetching token for user: ${userId}`);
            const userDoc = await db.collection('users').doc(userId).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                if (userData.fcmToken) tokens.push(userData.fcmToken);
                if (Array.isArray(userData.fcmTokens)) tokens.push(...userData.fcmTokens);
            }
        }
    } catch(err) {
        console.error(`Error fetching tokens for target ${target}:`, err);
    }
    // Remove duplicates and falsy values
    return [...new Set(tokens.filter(Boolean))]; 
}

/**
 * Sends the push notification using FCM.
 * @param {object} notificationData - The notification data from Firestore.
 */
async function sendPushNotification(notificationData) {
    const tokens = await getFcmTokensForTarget(notificationData.target, notificationData.userId);

    if (tokens.length === 0) {
        console.log(`No FCM tokens found for target "${notificationData.target}". Cannot send notification ID: ${notificationData.id}`);
        return { success: false, error: 'No FCM tokens found for the specified target.' };
    }
    
    // Destructure notification fields
    const { title, body, link, imageUrl, actions, type } = notificationData;

    // Construct the FCM message payload
    const message = {
        tokens: tokens,
        webpush: {
            fcm_options: {
              // Use the provided link or a default fallback
              link: link || 'https://price-compare-liart.vercel.app/', 
            },
        },
        data: {
          title: title || 'New Notification',
          body: body || '',
          link: link || '',
          type: type || 'info',
          imageUrl: imageUrl || '',
          // Ensure actions are always a valid JSON string
          actions: actions && actions.length > 0 ? JSON.stringify(actions) : '[]',
        },
    };
    
    try {
        console.log(`Sending notification ID ${notificationData.id} to ${tokens.length} token(s).`);
        const response = await messaging.sendEachForMulticast(message);
        const successCount = response.successCount;
        const failureCount = response.failureCount;

        console.log(`Notification ID ${notificationData.id} sent. Success: ${successCount}, Failure: ${failureCount}`);

        if (failureCount > 0) {
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    // Log details for failed tokens
                    console.error(`Failed to send to token ${tokens[idx]}:`, resp.error);
                }
            });
        }
        return { success: true, successCount, failureCount };

    } catch (error) {
        console.error(`Error sending message for notification ID ${notificationData.id}:`, error);
        return { success: false, error: error.message };
    }
}

/**
 * Checks for and processes due scheduled notifications.
 */
async function checkAndSendScheduledNotifications() {
  console.log('Scheduler: Running check for due notifications...');
  const now = new Date();

  try {
    const querySnapshot = await db.collection('scheduled_notifications')
      .where('scheduledAt', '<=', now)
      .where('status', '==', 'pending')
      .get();

    if (querySnapshot.empty) {
      console.log('Scheduler: No due notifications found.');
      return;
    }

    console.log(`Scheduler: Found ${querySnapshot.docs.length} due notification(s).`);

    for (const doc of querySnapshot.docs) {
      const notification = { id: doc.id, ...doc.data() };
      const { target, userId, ...payload } = notification;

      console.log(`Scheduler: Processing notification ID: ${notification.id} for target: ${target}`);
      
      const tokens = await getTokensForTargetGroup(target, userId);
      
      if (!tokens || tokens.length === 0) {
          console.log(`Scheduler: No tokens for notification ${notification.id}. Marking as failed.`);
          await doc.ref.update({ status: 'Failed', failureReason: 'No tokens found for target group.' });
          continue; // Move to the next notification
      }

      const result = await sendNotification(tokens, payload);

      // Update the notification document based on the outcome
      if (result.success) {
        await doc.ref.update({ status: 'Sent', sentDate: new Date() });
        console.log(`Scheduler: Notification ${notification.id} marked as 'Sent'.`);
      } else {
        await doc.ref.update({ status: 'Failed', failureReason: result.error || 'Failed to send to FCM.' });
        console.log(`Scheduler: Notification ${notification.id} marked as 'Failed'.`);
      }
    }
  } catch (error) {
    console.error('Scheduler: Critical error during check:', error);
  }
}

// Remove setInterval-based scheduling
// Only use cron job for scheduling
// --- CRON JOB SCHEDULER ---
// Runs every 1 minute
cron.schedule('* * * * *', async () => {
    const now = new Date();
    console.log('Scheduler running at', now.toLocaleString());
    try {
        const querySnapshot = await db.collection('scheduled_notifications')
            .where('scheduledAt', '<=', now)
            .where('status', '==', 'pending')
            .get();
        console.log('Due notifications:', querySnapshot.size);
        for (const doc of querySnapshot.docs) {
            const notif = doc.data();
            let userIds = [];
            let segment = notif.segment || 'all';
            // Fetch userIds based on segment
            if (segment === 'all') {
                const usersSnap = await db.collection('users').get();
                userIds = usersSnap.docs.map(u => u.id);
            } else if (segment === 'members') {
                const usersSnap = await db.collection('users').where('role', '==', 'member').get();
                userIds = usersSnap.docs.map(u => u.id);
            } else if (segment === 'non-members') {
                const usersSnap = await db.collection('users').where('role', '==', 'non-member').get();
                userIds = usersSnap.docs.map(u => u.id);
            } else if (Array.isArray(notif.userIds) && notif.userIds.length > 0) {
                userIds = notif.userIds;
            }
            let success = 0, fail = 0;
            for (const userId of userIds) {
                try {
                    await sendUnifiedNotification({
                        userId,
                        title: notif.title,
                        body: notif.body,
                        icon: notif.icon || '',
                        url: notif.url || '',
                        image: notif.image || '',
                        actions: notif.actions || [],
                        type: 'scheduled',
                        status: 'sent',
                    });
                    success++;
                } catch (err) {
                    fail++;
                    console.error('Failed to send scheduled push to', userId, err);
                }
            }
            // Auto-repeat/loop for journey steps if journey is active
            if (notif.type === 'journey' && notif.journeyName) {
                const journeyDoc = await db.collection('journeys').doc(notif.journeyName).get();
                if (journeyDoc.exists && journeyDoc.data().active) {
                    let nextScheduledAt = null;
                    // --- Day/time-based repeat logic ---
                    if (Array.isArray(notif.daysOfWeek) && notif.daysOfWeek.length > 0 && Array.isArray(notif.timesOfDay) && notif.timesOfDay.length > 0) {
                        // Find the next valid day/time AFTER current scheduledAt
                        const lastScheduled = notif.scheduledAt && notif.scheduledAt.toDate ? notif.scheduledAt.toDate() : new Date();
                        let soonest = null;
                        for (let addDays = 1; addDays <= 14; addDays++) { // start from next day
                            const candidate = new Date(lastScheduled.getTime() + addDays * 86400000);
                            const dayKey = ['sun','mon','tue','wed','thu','fri','sat'][candidate.getDay()];
                            if (notif.daysOfWeek.includes(dayKey)) {
                                for (const t of notif.timesOfDay) {
                                    const [h, m] = t.split(':').map(Number);
                                    const candidateTime = new Date(candidate);
                                    candidateTime.setHours(h, m, 0, 0);
                                    if (candidateTime > lastScheduled && (!soonest || candidateTime < soonest)) {
                                        soonest = candidateTime;
                                    }
                                }
                            }
                        }
                        if (soonest) nextScheduledAt = soonest;
                    }
                    // Fallback to delay logic if no days/times set
                    if (!nextScheduledAt) {
                        let delayMs = 10 * 60000; // default 10 min
                        if (typeof notif.delay === 'number' && notif.delay > 0 && notif.delayUnit) {
                            if (notif.delayUnit === 'min') delayMs = notif.delay * 60000;
                            else if (notif.delayUnit === 'hr') delayMs = notif.delay * 3600000;
                            else if (notif.delayUnit === 'day') delayMs = notif.delay * 86400000;
                        }
                        nextScheduledAt = new Date(Date.now() + delayMs);
                    }
                    await db.collection('scheduled_notifications').add({
                        journeyName: notif.journeyName,
                        stepIndex: notif.stepIndex,
                        title: notif.title || '',
                        body: notif.body || '',
                        image: notif.image || '',
                        icon: notif.icon || '',
                        actions: notif.actions || [],
                        url: notif.url || '',
                        segment: notif.segment || 'all',
                        delay: typeof notif.delay === 'number' ? notif.delay : 1,
                        delayUnit: typeof notif.delayUnit === 'string' && notif.delayUnit ? notif.delayUnit : 'min',
                        daysOfWeek: notif.daysOfWeek || [],
                        timesOfDay: notif.timesOfDay || [],
                        scheduledAt: nextScheduledAt,
                        status: 'pending',
                        type: 'journey',
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    });
                }
            }
            // Update status
            await doc.ref.update({ status: 'sent', sentAt: admin.firestore.FieldValue.serverTimestamp(), delivery: { success, fail } });
        }
    } catch (error) {
        console.error('Scheduler error:', error);
    }
}); 

