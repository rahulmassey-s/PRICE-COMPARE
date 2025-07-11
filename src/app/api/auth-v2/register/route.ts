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
    const { name, mobile, otp, sessionId, password } = await request.json();

    if (!name || !mobile || !otp || !sessionId || !password) {
        return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    const twoFactorApiKey = process.env.TWO_FACTOR_API_KEY;
    if (!twoFactorApiKey) {
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    try {
        // --- Step 1: Verify OTP ---
        const verifyUrl = `https://2factor.in/API/V1/${twoFactorApiKey}/SMS/VERIFY/${sessionId}/${otp}`;
        const verifyResponse = await fetch(verifyUrl);
        const verifyData = await verifyResponse.json();

        if (verifyData.Status !== 'Success') {
            return NextResponse.json({ error: 'Invalid OTP' }, { status: 400 });
        }

        // --- Step 2: Create Firebase User ---
        initializeFirebaseAdmin();
        const auth = admin.auth();
        const fullPhoneNumber = `+91${mobile}`;
        
        // This is the "fake email" trick to enable phone+password login
        const email = `${fullPhoneNumber}@smartbharat.com`;

        const userRecord = await auth.createUser({
            email: email,
            emailVerified: true, // Mark as verified since we verified the phone
            phoneNumber: fullPhoneNumber,
            password: password,
            displayName: name,
        });
        
        // --- Step 3: Create user document in Firestore ---
        const firestore = admin.firestore();
        await firestore.collection('users').doc(userRecord.uid).set({
            uid: userRecord.uid,
            displayName: name,
            email: email,
            phoneNumber: fullPhoneNumber,
            role: 'non-member', // Default role
            pointsBalance: 0, // Default points
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return NextResponse.json({ success: true, uid: userRecord.uid });

    } catch (error: any) {
        // Handle cases where user might already exist
        if (error.code === 'auth/email-already-exists' || error.code === 'auth/phone-number-already-exists') {
            return NextResponse.json({ error: 'A user with this mobile number already exists.' }, { status: 409 });
        }
        console.error('Registration Error:', error);
        return NextResponse.json({ error: 'Failed to create user', details: error.message }, { status: 500 });
    }
} 