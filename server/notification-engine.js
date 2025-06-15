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
 * @returns {Promise<{successCount: number, failureCount: number, errors: Array<object>, staleTokens: Array<string>}>} A detailed report of the send operation.
 */
async function sendNotification(tokens, notificationPayload) {
    const messaging = admin.messaging(); // Lazy-load the service

    if (!tokens || tokens.length === 0) {
        console.log("No tokens provided, skipping notification send.");
        return { successCount: 0, failureCount: 0, errors: [{error: "No tokens provided"}], staleTokens: [] };
    }

    // FCM requires all data payload values to be strings.
    const dataPayload = {};
    for (const key in notificationPayload) {
        if (notificationPayload[key] !== null && notificationPayload[key] !== undefined) {
            dataPayload[key] = String(notificationPayload[key]);
        }
    }
    // Ensure actions is a JSON string if it's an object
    if (typeof dataPayload.actions === 'object') {
        dataPayload.actions = JSON.stringify(dataPayload.actions);
    }

    const message = {
        tokens: tokens,
        data: dataPayload,
        webpush: {
            fcm_options: {
              // The link must be a valid URL. Default to the root if not provided.
              link: notificationPayload.link && notificationPayload.link.startsWith('http') ? notificationPayload.link : 'https://labpricecompare.netlify.app/',
            },
        },
    };

    console.log(`Attempting to send notification to ${tokens.length} token(s).`);

    try {
        const response = await messaging.sendEachForMulticast(message);
        
        const report = {
            successCount: response.successCount,
            failureCount: response.failureCount,
            errors: [],
            staleTokens: []
        };

        if (response.failureCount > 0) {
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    const errorInfo = resp.error.toJSON();
                    console.error(`Token failure for ${tokens[idx]}:`, errorInfo);
                    report.errors.push({ token: tokens[idx], error: errorInfo });

                    // Check for errors indicating an invalid or unregistered token
                    if (errorInfo.code === 'messaging/registration-token-not-registered' ||
                        errorInfo.code === 'messaging/invalid-registration-token') {
                        report.staleTokens.push(tokens[idx]);
                    }
                }
            });
        }
        
        // Asynchronously clean up the invalid tokens without waiting
        if (report.staleTokens.length > 0) {
           cleanupInvalidTokens(report.staleTokens);
        }

        console.log(`Notification sent. Report: ${report.successCount} success, ${report.failureCount} failure.`);
        return report;

    } catch (error) {
        console.error('Critical error during sendEachForMulticast:', error);
        return { 
            successCount: 0, 
            failureCount: tokens.length, 
            errors: [{ error: error.message }], 
            staleTokens: [] 
        };
    }
}

module.exports = {
    getTokensForTargetGroup,
    sendNotification
}; 