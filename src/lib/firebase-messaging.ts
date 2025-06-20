import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { auth, db } from './firebase/client';
import { doc, updateDoc, arrayUnion, setDoc } from 'firebase/firestore';

let requestForToken: any = async () => null;
let onMessageListener: any = (cb?: (payload: any) => void) => {};

const isDev = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

if (
  typeof window !== 'undefined' &&
  (window.location.protocol === 'https:' || window.location.hostname === 'localhost') &&
  'serviceWorker' in navigator &&
  'Notification' in window
) {
  const { initializeApp, getApps, getApp } = require('firebase/app');
  const { getMessaging, getToken, onMessage } = require('firebase/messaging');
  const firebaseConfig = {
    apiKey: "AIzaSyD5yknpv5YO5yLYBwLG4SUhNVDrLsBPkkA",
    authDomain: "smart-bharat-fa2ee.firebaseapp.com",
    projectId: "smart-bharat-fa2ee",
    messagingSenderId: "852257413675",
    appId: "1:852257413675:web:662070caca66c1252c286e",
  };
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

  let messaging: any;
  try {
    messaging = getMessaging(app);
  } catch (e) {
    messaging = null;
  }

  requestForToken = async () => {
    if (!messaging) return null;
    try {
      const currentToken = await getToken(messaging, {
        vapidKey: 'BOPBzgwcS34L9G4GuxxhjqKkbXdtILkCjTrA7qg5fP2Ylmg93j1USfgcWUniC-qbByJbtyL241mgHMImq2KKQ28',
        serviceWorkerRegistration: await navigator.serviceWorker.ready,
      });
      if (currentToken) {
        if (isDev) console.log('FCM Token:', currentToken);
        const user = auth.currentUser;
        if (user && db) {
          try {
            // Ensure user doc exists before updating
            await setDoc(doc(db, 'users', user.uid), {}, { merge: true });
            await updateDoc(doc(db, 'users', user.uid), {
              fcmTokens: arrayUnion(currentToken),
            });
            if (isDev) console.log('FCM token saved to Firestore for user:', user.uid);
          } catch (err) {
            console.error('Error saving FCM token to Firestore:', err);
          }
        }
      }
      return currentToken;
    } catch (err) {
      console.error('An error occurred while retrieving token. ', err);
      return null;
    }
  };

  // Persistent foreground notification listener
  onMessageListener = (cb?: (payload: any) => void) => {
    if (!messaging) return () => {};
    return onMessage(messaging, (payload: any) => {
      if (cb) cb(payload);
    });
  };
}

// Helper to force-save a token for manual testing
export async function saveTokenToFirestore(token: string) {
  const user = auth.currentUser;
  if (user && db) {
    try {
      await setDoc(doc(db, 'users', user.uid), {}, { merge: true });
      await updateDoc(doc(db, 'users', user.uid), {
        fcmTokens: arrayUnion(token),
      });
      console.log('FCM token manually saved to Firestore for user:', user.uid);
    } catch (err) {
      console.error('Error manually saving FCM token to Firestore:', err);
    }
  } else {
    console.warn('No user logged in or db not initialized.');
  }
}

export { requestForToken, onMessageListener }; 