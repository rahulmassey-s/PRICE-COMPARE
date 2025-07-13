import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import * as OneSignal from 'onesignal-node';

// Initialize Firebase Admin SDK
function initializeFirebaseAdmin() {
    if (!admin.apps.length) {
        try {
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY as string);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
            });
        } catch (e) {
            console.error('Firebase Admin initialization error:', e);
            throw new Error('Could not initialize Firebase Admin SDK.');
        }
    }
}
initializeFirebaseAdmin();


// Initialize OneSignal Client
const oneSignalClient = new OneSignal.Client(
    process.env.ONESIGNAL_APP_ID!,
    process.env.ONESIGNAL_REST_API_KEY!
);

export async function POST(request: Request) {
    // Basic secret key check for security
    const secret = request.headers.get('x-internal-secret');
    if (secret !== process.env.INTERNAL_API_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { email, password } = await request.json();

        if (!email || !password) {
            return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
        }

        // 1. Create the user in Firebase Auth
        const userRecord = await admin.auth().createUser({
            email: email,
            password: password,
        });

        const userId = userRecord.uid;
        console.log('Successfully created new user:', userId);
        
        // 2. Send the Welcome Notification via OneSignal
        const notification = {
            contents: { en: "Welcome to Smart Bharat! We're excited to have you." },
            headings: { en: "Welcome Aboard!" },
            include_external_user_ids: [userId],
        };

        const oneSignalResponse = await oneSignalClient.createNotification(notification);
        console.log('Successfully sent welcome notification:', oneSignalResponse.body.id);

        return NextResponse.json({ success: true, userId: userId });

    } catch (error: any) {
        console.error('Error creating user or sending notification:', error);
        return NextResponse.json({ error: 'Failed to process request', details: error.message }, { status: 500 });
    }
} 