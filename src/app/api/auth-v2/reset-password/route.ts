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
    const { mobile, otp, sessionId, newPassword } = await request.json();

    if (!mobile || !otp || !sessionId || !newPassword) {
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

        // --- Step 2: Update Firebase User's Password ---
        initializeFirebaseAdmin();
        const auth = admin.auth();
        const fullPhoneNumber = `+91${mobile}`;
        const expectedEmail = `${fullPhoneNumber}@smartbharat.com`;

        // Find user by phone number to get their UID
        const userRecord = await auth.getUserByPhoneNumber(fullPhoneNumber);
        
        const updates: { password: string; email?: string } = {
            password: newPassword,
        };

        // Self-healing: Check if the email is correct, if not, update it.
        if (userRecord.email !== expectedEmail) {
            updates.email = expectedEmail;
        }

        // Update the password and potentially the email for that user
        await auth.updateUser(userRecord.uid, updates);

        return NextResponse.json({ success: true, message: 'Password updated successfully.' });

    } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
            return NextResponse.json({ error: 'User with this mobile number does not exist.' }, { status: 404 });
        }
        console.error('Password Reset Error:', error);
        return NextResponse.json({ error: 'Failed to reset password', details: error.message }, { status: 500 });
    }
} 