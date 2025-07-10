import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

// --- Environment Variable Check ---
// Perform a comprehensive check for all required environment variables at the start.
const { ONESIGNAL_APP_ID, ONESIGNAL_REST_API_KEY, FIREBASE_SERVICE_ACCOUNT_KEY } = process.env;

const missingVars: string[] = [];
if (!ONESIGNAL_APP_ID) missingVars.push('ONESIGNAL_APP_ID');
if (!ONESIGNAL_REST_API_KEY) missingVars.push('ONESIGNAL_REST_API_KEY');
if (!FIREBASE_SERVICE_ACCOUNT_KEY) missingVars.push('FIREBASE_SERVICE_ACCOUNT_KEY');

// --- Firebase Admin Initialization Helper ---
// This function initializes the Firebase Admin SDK, ensuring it only runs once.
function initializeFirebaseAdmin() {
    if (missingVars.length > 0) {
        // Don't even attempt to initialize if keys are missing.
        throw new Error(`Server configuration error: The following environment variables are missing or not loaded: ${missingVars.join(', ')}`);
    }

    if (!admin.apps.length) {
        try {
            const serviceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT_KEY!);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
            });
            console.log('Firebase Admin SDK Initialized Successfully.');
        } catch (e: any) {
            // This will catch parsing errors if the service account key is malformed.
            console.error('🔥🔥🔥 Firebase Admin SDK initialization failed:', e);
            throw new Error(`Firebase service account key is malformed. Could not parse. Details: ${e.message}`);
        }
    }
    return admin.app();
}


export async function POST(request: Request) {
    let db: admin.firestore.Firestore;

    // --- Main Logic ---
    try {
        // Step 1: Initialize Firebase Admin. This will throw if env vars are missing.
        const adminApp = initializeFirebaseAdmin();
        db = getFirestore(adminApp);

        // Step 2: Process the request body.
        const requestBody = await request.json();
        const { heading, message, target, imageUrl, iconUrl, launchUrl, buttons, schedule, externalIds } = requestBody;

        if (!heading || !message || !target) {
            return NextResponse.json({ error: 'Heading, message, and target are required' }, { status: 400 });
        }

        // Step 3: Construct the OneSignal payload.
        const notificationPayload: any = {
            app_id: ONESIGNAL_APP_ID,
            headings: { en: heading },
            contents: { en: message },
        };

        if (target === 'external' && externalIds && externalIds.length > 0) {
            notificationPayload.include_external_user_ids = externalIds;
            notificationPayload.channel_for_external_user_ids = "push";
        } else {
            const segments = target === 'members' ? ['members'] : target === 'non-members' ? ['non-members'] : ['Subscribed Users'];
            notificationPayload.included_segments = segments;
        }

        if (imageUrl) notificationPayload.big_picture = imageUrl;
        if (iconUrl) notificationPayload.large_icon = iconUrl;
        if (launchUrl) notificationPayload.url = launchUrl;
        if (buttons && buttons.length > 0) notificationPayload.web_buttons = buttons;
        
        if (schedule) {
            const scheduledDate = new Date(schedule);
            if (!isNaN(scheduledDate.getTime())) {
                notificationPayload.send_after = scheduledDate.toISOString();
            } else {
                console.warn(`Invalid schedule date provided: "${schedule}". Ignoring schedule.`);
            }
        }

        // Step 4: Send the notification via OneSignal.
        const oneSignalResponse = await fetch('https://onesignal.com/api/v1/notifications', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // This is the CORRECTED authorization method for your key type.
                'Authorization': `Bearer ${ONESIGNAL_REST_API_KEY}`
            },
            body: JSON.stringify(notificationPayload)
        });

        const responseData = await oneSignalResponse.json();

        if (!oneSignalResponse.ok) {
            throw new Error(`OneSignal API Error: ${JSON.stringify(responseData.errors)}`);
        }
        
        // Step 5: Log the successful request to Firestore.
        const logData = {
            notificationId: responseData.id || null,
            request: requestBody,
            response: responseData,
            status: responseData.id ? 'sent' : 'sent_no_recipients',
            createdAt: new Date().toISOString(),
        };

        if (responseData.id) {
            await db.collection('notification_logs').doc(responseData.id).set(logData);
            console.log('Notification sent and logged successfully:', responseData.id);
            return NextResponse.json({ success: true, notificationId: responseData.id });
        } else {
            const logResult = await db.collection('notification_logs').add(logData);
            console.warn(`Notification sent but no recipients were found. Logged to ${logResult.id}`);
            return NextResponse.json({ success: true, notificationId: null, message: "Notification sent, but no subscribed users were targeted.", details: responseData.errors });
        }

    } catch (error: any) {
        // This is the final catch-all. It will catch errors from initialization, OneSignal, or Firestore.
        console.error('💥 CRITICAL ERROR in send-notification route:', error.message);
        return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
    }
} 