const admin = require('firebase-admin');

// The db and messaging services are initialized inside the functions below
// to ensure they are only called *after* admin.initializeApp() has run.

/**
 * Removes invalid or unregistered FCM tokens from the 'users' collection.
 * @param {Array<string>} tokensToRemove - A list of FCM tokens that failed.
 */
async function cleanupInvalidTokens(tokensToRemove) {
    if (!tokensToRemove || tokensToRemove.length === 0) {
        return;
    }
    const db = admin.firestore(); // Lazy-load the service
    console.log(`Cleaning up ${tokensToRemove.length} invalid token(s).`);
    
    // This is an expensive operation, but necessary for hygiene.
    // It iterates over all users, which is acceptable for a small user base.
    // For larger scale, tokens should be stored in their own collection for easier lookup.
    const usersSnapshot = await db.collection('users').get();
    const batch = db.batch();

    usersSnapshot.forEach(userDoc => {
        const userData = userDoc.data();
        const userRef = userDoc.ref;
        let userTokens = userData.fcmTokens || [];
        
        // Filter out the bad tokens from the user's token array
        const newTokens = userTokens.filter(token => !tokensToRemove.includes(token));

        // If tokens were removed, update the document
        if (newTokens.length < userTokens.length) {
            console.log(`Removing invalid tokens from user ${userDoc.id}`);
            batch.update(userRef, { fcmTokens: newTokens });
        }
    });

    try {
        await batch.commit();
        console.log('Successfully cleaned up invalid tokens.');
    } catch (error) {
        console.error('Error during token cleanup batch commit:', error);
    }
}

/**
 * Fetches FCM tokens for a given target group.
 * @param {string} target - The target audience ('All', 'Members', 'User').
 * @param {string} [userId] - The user's ID, required if target is 'User'.
 * @returns {Promise<Array<string>>} A list of unique, valid FCM tokens.
 */
async function getTokensForTargetGroup(target, userId) {
    const db = admin.firestore(); // Lazy-load the service
    const tokens = new Set();
    let usersSnapshot;

    try {
        switch (target) {
            case 'All':
                console.log("Fetching tokens for 'All' users.");
                usersSnapshot = await db.collection('users').get();
                break;
            case 'Members':
                console.log("Fetching tokens for 'Members'.");
                usersSnapshot = await db.collection('users').where('role', '==', 'member').get();
                break;
            case 'User':
                if (!userId) {
                    console.error("User ID is required for 'User' target.");
                    return [];
                }
                console.log(`Fetching token for user: ${userId}`);
                const userDoc = await db.collection('users').doc(userId).get();
                if (userDoc.exists) {
                    usersSnapshot = { docs: [userDoc] };
                }
                break;
            default:
                console.log(`Unknown target group: ${target}. Defaulting to 'All'.`);
                usersSnapshot = await db.collection('users').get();
                break;
        }

        if (usersSnapshot) {
            usersSnapshot.docs.forEach(doc => {
                const data = doc.data();
                if (Array.isArray(data.fcmTokens)) {
                    data.fcmTokens.forEach(token => token && tokens.add(token));
                } else if (data.fcmToken) { // Legacy support
                    tokens.add(data.fcmToken);
                }
            });
        }
    } catch (err) {
        console.error(`Error fetching tokens for target ${target}:`, err);
    }

    console.log(`Found ${tokens.size} unique tokens.`);
    return Array.from(tokens);
}


/**
 * Sends a notification payload to a list of tokens and handles failures.
 * @param {Array<string>} tokens - The list of FCM tokens to send to.
 * @param {object} notificationPayload - The data payload for the notification.
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function sendNotification(tokens, notificationPayload) {
    const messaging = admin.messaging(); // Lazy-load the service

    if (!tokens || tokens.length === 0) {
        console.log("No tokens provided, skipping notification send.");
        return { success: false, error: "No tokens found." };
    }

    const message = {
        tokens: tokens,
        webpush: {
            fcm_options: {
              link: notificationPayload.link || 'https://price-compare-liart.vercel.app/',
            },
        },
        data: {
          title: notificationPayload.title || 'New Notification',
          body: notificationPayload.body || '',
          link: notificationPayload.link || '',
          type: notificationPayload.type || 'info',
          imageUrl: notificationPayload.imageUrl || '',
          actions: JSON.stringify(notificationPayload.actions || []),
        },
    };

    try {
        console.log(`Attempting to send notification to ${tokens.length} token(s).`);
        const response = await messaging.sendEachForMulticast(message);
        console.log(`FCM response: ${response.successCount} successful, ${response.failureCount} failed.`);

        if (response.failureCount > 0) {
            const tokensToDelete = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    const error = resp.error;
                    console.error(`Token failure for ${tokens[idx]}:`, error.message);
                    // Check for errors indicating an invalid or unregistered token
                    if (error.code === 'messaging/registration-token-not-registered' ||
                        error.code === 'messaging/invalid-registration-token') {
                        tokensToDelete.push(tokens[idx]);
                    }
                }
            });

            // Asynchronously clean up the invalid tokens
            if (tokensToDelete.length > 0) {
               cleanupInvalidTokens(tokensToDelete);
            }
        }

        return { success: response.successCount > 0 };

    } catch (error) {
        console.error('Critical error sending notification:', error);
        return { success: false, error: error.message };
    }
}

module.exports = {
    getTokensForTargetGroup,
    sendNotification
}; 