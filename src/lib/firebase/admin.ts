import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY as string);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
     console.log('Firebase Admin SDK initialized successfully.');
  } catch (error: any) {
    console.error('Firebase Admin SDK initialization error:', error.stack);
    // Throwing an error here can help debug deployment issues
    // where environment variables might not be set correctly.
    throw new Error('Could not initialize Firebase Admin SDK. Is the FIREBASE_SERVICE_ACCOUNT_KEY environment variable set correctly?');
  }
}

export const adminAuth = admin.auth();
export const firestore = admin.firestore(); 