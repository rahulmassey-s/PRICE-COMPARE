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
 * Fetches FCM tokens for a given target group, associating them with user IDs.
 * @param {string} target - The target audience ('All', 'Members', 'User').
 * @param {string} [userId] - The user's ID, required if target is 'User'.
 * @returns {Promise<Array<{userId: string, token: string}>>} A list of objects, each with a userId and a token.
 */
async function getTokensForTargetGroup(target, userId) {
    const db = admin.firestore(); // Lazy-load the service
    const userTokenPairs = [];
    let usersSnapshot;

    // If a specific userId is provided, ALWAYS target only that user.
    // This overrides any 'target' group like 'All' or 'Members'.
    if (userId) {
        console.log(`Targeting specific user due to provided userId: ${userId}`);
        try {
            const userDoc = await db.collection('users').doc(userId).get();
            if (userDoc.exists) {
                usersSnapshot = { docs: [userDoc] };
            } else {
                console.error(`User with ID ${userId} not found.`);
                return []; // Return empty if the specific user doesn't exist
            }
        } catch (err) {
            console.error(`Error fetching specific user ${userId}:`, err);
            return [];
        }
    } else {
        // Original logic for handling target groups if no specific userId is given
        try {
            switch (target) {
                case 'All':
                case 'Members':
                    console.log(`Fetching tokens for '${target}' users.`);
                    let query = db.collection('users');
                    if (target === 'Members') {
                        query = query.where('role', '==', 'member');
                    }
                    usersSnapshot = await query.get();
                    break;
                case 'User':
                    // This case is now redundant if userId is handled above, but kept for safety.
                    if (!userId) {
                        console.error("User ID is required for 'User' target.");
                        return [];
                    }
                    break; // Should have been handled by the primary userId check
                default:
                    console.log(`Unknown target group: ${target}. Defaulting to 'All'.`);
                    usersSnapshot = await db.collection('users').get();
                    break;
            }
        } catch (err) {
            console.error(`Error fetching tokens for target group ${target}:`, err);
            return []; // Return empty on error
        }
    }

    if (usersSnapshot) {
        usersSnapshot.docs.forEach(doc => {
            const data = doc.data();
            const currentUserId = doc.id;
            // Handle both array of tokens and single legacy token
            const tokens = Array.isArray(data.fcmTokens) ? data.fcmTokens : (data.fcmToken ? [data.fcmToken] : []);
            
            tokens.forEach(token => {
                if (token) {
                    userTokenPairs.push({ userId: currentUserId, token: token });
                }
            });
        });
    }

    console.log(`Found ${userTokenPairs.length} user-token pairs for the operation.`);
    // A user might have multiple tokens, so we don't deduplicate here.
    return userTokenPairs;
}


/**
 * Sends a notification payload to a list of tokens and handles failures.
 * @param {Array<string>} tokens - The list of FCM tokens to send to.
 * @param {object} notificationPayload - The data payload for the notification.
 * @returns {Promise<{successCount: number, failureCount: number, responses: Array<object>, errors: Array<object>, staleTokens: Array<string>}>} A detailed report of the send operation.
 */
async function sendNotification(tokens, notificationPayload) {
    const messaging = admin.messaging(); // Lazy-load the service

    if (!tokens || tokens.length === 0) {
        console.log("No tokens provided, skipping notification send.");
        return { successCount: 0, failureCount: 0, responses: [], errors: [{error: "No tokens provided"}], staleTokens: [] };
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

    // --- Ensure required fields are always present ---
    if (!dataPayload.title) dataPayload.title = 'Update';
    if (!dataPayload.body) dataPayload.body = 'You have a new notification.';
    if (!dataPayload.icon) dataPayload.icon = '/icons/icon-192x192.png';
    if (!dataPayload.link) dataPayload.link = '/';

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

    // --- Add robust logging for debugging ---
    console.log('FCM Payload Sent:', JSON.stringify(message, null, 2));

    console.log(`Attempting to send notification to ${tokens.length} token(s).`);

    try {
        const response = await messaging.sendEachForMulticast(message);
        // --- Log FCM response ---
        console.log('FCM Response:', JSON.stringify(response, null, 2));
        
        const report = {
            successCount: response.successCount,
            failureCount: response.failureCount,
            responses: response.responses,
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
            responses: [],
            errors: [{ error: error.message }], 
            staleTokens: [] 
        };
    }
}

module.exports = {
    getTokensForTargetGroup,
    sendNotification
}; 