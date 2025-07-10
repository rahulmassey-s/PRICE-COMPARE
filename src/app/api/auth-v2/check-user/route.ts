import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';

// Helper to initialize Firebase Admin SDK
function initializeFirebaseAdmin() {
    if (!admin.apps.length) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY as string);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
    }
}

export async function POST(request: Request) {
    const { mobile } = await request.json();

    if (!mobile) {
        return NextResponse.json({ error: 'Mobile number is required' }, { status: 400 });
    }

    try {
        initializeFirebaseAdmin();
        const fullPhoneNumber = `+91${mobile}`;
        
        await admin.auth().getUserByPhoneNumber(fullPhoneNumber);
        
        // If the above line does not throw an error, the user exists.
        return NextResponse.json({ exists: true });

    } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
            // This is an expected case, not an error.
            return NextResponse.json({ exists: false });
        }
        // For other errors, log them and return a server error.
        console.error('Error checking user existence:', error);
        return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
    }
} 