
// src/lib/firebase/client.ts
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  type Auth,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  signInWithEmailAndPassword as firebaseSignInWithEmailAndPassword,
  createUserWithEmailAndPassword as firebaseCreateUserWithEmailAndPassword,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
  signOut as firebaseSignOut,
  signInWithCustomToken as firebaseSignInWithCustomToken,
  // Removed initializeAuth and indexedDBLocalPersistence as they didn't resolve the core issue
  // and might complicate standard initialization.
} from "firebase/auth";
import {
  getFirestore,
  type Firestore,
  Timestamp as FirestoreTimestamp,
  serverTimestamp as firestoreServerTimestamp,
  doc as firestoreDoc,
  getDoc as firestoreGetDoc,
  setDoc as firestoreSetDoc,
  updateDoc as firestoreUpdateDoc,
  collection as firestoreCollection,
  addDoc as firestoreAddDoc,
  query as firestoreQuery,
  where as firestoreWhere,
  getDocs as firestoreGetDocs,
  orderBy as firestoreOrderBy,
  limit as firestoreLimit,
} from "firebase/firestore";
// Removed App Check imports as they were temporarily disabled for debugging.

const firebaseConfig = {
  apiKey: "AIzaSyD5yknpv5YO5yLYBwLG4SUhNVDrLsBPkkA",
  authDomain: "smart-bharat-fa2ee.firebaseapp.com",
  databaseURL: "https://smart-bharat-fa2ee-default-rtdb.firebaseio.com",
  projectId: "smart-bharat-fa2ee",
  storageBucket: "smart-bharat-fa2ee.appspot.com",
  messagingSenderId: "852257413675",
  appId: "1:852257413675:web:662070caca66c1252c286e",
  measurementId: "G-XZPNYSHY42"
};

let app: FirebaseApp;
let authInstance: Auth;
let dbInstance: Firestore;
// let appCheckInstance: AppCheck; // Keep commented out for now

// Initialize Firebase App
try {
  if (getApps().length === 0) {
    console.log("[Firebase Client] Initializing Firebase app with config:", firebaseConfig);
    app = initializeApp(firebaseConfig);
    console.log("[Firebase Client] Firebase app initialized successfully:", app.name);
  } else {
    app = getApps()[0]!;
    console.log("[Firebase Client] Using existing Firebase app:", app.name);
  }
} catch (error) {
  console.error("[Firebase Client] CRITICAL Error initializing Firebase app:", error);
}

// Initialize Firebase Auth
try {
  if (app!) { // Ensure app is initialized
    authInstance = getAuth(app);
    console.log("[Firebase Client] Firebase Auth instance obtained successfully. Instance:", authInstance);
  } else {
    console.error("[Firebase Client] Firebase app not initialized, cannot get Auth instance.");
  }
} catch (e) {
  console.error("[Firebase Client] Error getting Firebase Auth instance:", e);
}

// Initialize Firebase Firestore
try {
  if (app!) { // Ensure app is initialized
    dbInstance = getFirestore(app);
    console.log("[Firebase Client] Firebase Firestore instance obtained successfully.");
  } else {
    console.error("[Firebase Client] Firebase app not initialized, cannot get Firestore instance.");
  }
} catch (e) {
  console.error("[Firebase Client] Error getting Firebase Firestore instance:", e);
}

// App Check Initialization (Keep commented out for now)
/*
try {
  if (app!) {
    const recaptchaSiteKey = "6LcqKjorAAAAAA3ANHPxxkzaPDHoBEuMTnakiPBq"; // YOUR_RECAPTCHA_V3_SITE_KEY
    if (typeof window !== 'undefined' && recaptchaSiteKey && recaptchaSiteKey !== "YOUR_RECAPTCHA_V3_SITE_KEY_HERE") {
      console.log("[Firebase Client] Attempting to initialize App Check with reCAPTCHA v3 site key:", recaptchaSiteKey);
      appCheckInstance = initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(recaptchaSiteKey),
        isTokenAutoRefreshEnabled: true
      });
      console.log("[Firebase Client] Firebase App Check initialized with reCAPTCHA v3 using the provided SITE KEY.");
    } else if (typeof window !== 'undefined' && (!recaptchaSiteKey || recaptchaSiteKey === "YOUR_RECAPTCHA_V3_SITE_KEY_HERE")) {
      console.warn(
        "[Firebase Client] Firebase App Check: reCAPTCHA v3 site key is missing or is a placeholder. " +
        "App Check will not be initialized. Please provide a valid reCAPTCHA v3 Site Key in src/lib/firebase/client.ts."
      );
    }
  } else {
    console.error("[Firebase Client] Firebase app not initialized, cannot initialize App Check.");
  }
} catch (error) {
  console.error("[Firebase Client] Firebase App Check initialization error:", error);
}
*/

console.log("[Firebase Client] Type of imported firebaseOnAuthStateChanged:", typeof firebaseOnAuthStateChanged);
if (typeof firebaseOnAuthStateChanged === 'function') {
    // Log only a portion to avoid overly verbose console output if it's a complex function
    console.log("[Firebase Client] Value of imported firebaseOnAuthStateChanged (partial):", firebaseOnAuthStateChanged.toString().substring(0, 150) + "...");
}

const onAuthStateChangedHandler = (callback: (user: import('firebase/auth').User | null) => void) => {
  console.log("[Firebase Client] onAuthStateChangedHandler called.");

  if (typeof firebaseOnAuthStateChanged !== 'function') {
    console.error("[Firebase Client] firebaseOnAuthStateChanged is NOT a function! Cannot attach listener. Type:", typeof firebaseOnAuthStateChanged);
    return () => {}; // Return an empty unsubscribe function
  }
  if (!authInstance) {
    console.error("[Firebase Client] authInstance is not defined! Cannot attach onAuthStateChanged listener.");
    return () => {};
  }
  
  console.log("[Firebase Client] Pre-check: authInstance valid:", !!authInstance, "firebaseOnAuthStateChanged valid:", typeof firebaseOnAuthStateChanged === 'function');
  console.log("[Firebase Client] authInstance object structure (keys):", authInstance ? Object.keys(authInstance) : "authInstance is null/undefined");


  console.log("[Firebase Client] Attaching onAuthStateChanged listener using the direct imported function.");
  try {
    const unsubscribe = firebaseOnAuthStateChanged(
      authInstance,
      (user) => {
        console.log("[Firebase Client] onAuthStateChanged listener FIRED. User:", user ? user.uid : "No user");
        callback(user);
      },
      (error) => { // Explicit error callback for onAuthStateChanged
        console.error("[Firebase Client] onAuthStateChanged listener ITSELF ERRORED:", error);
        callback(null); // Call callback with null on listener error
      }
    );
    console.log("[Firebase Client] onAuthStateChanged listener attached successfully.");
    return unsubscribe;
  } catch (error) {
    console.error("[Firebase Client] Error DURING direct firebaseOnAuthStateChanged call (setup phase):", error);
    return () => {}; // Return an empty unsubscribe function in case of error during call
  }
};

const signInWithEmailAndPasswordHandler = async (email: string, password: string): Promise<import('firebase/auth').UserCredential> => {
  if (!authInstance) {
    console.error("[Firebase Client] signInWithEmailAndPassword: authInstance is not initialized!");
    throw new Error("Firebase Auth not initialized.");
  }
  if (typeof firebaseSignInWithEmailAndPassword !== 'function') {
     console.error("[Firebase Client] firebaseSignInWithEmailAndPassword is not a function!");
    throw new Error("Firebase SignIn function not available.");
  }
  return firebaseSignInWithEmailAndPassword(authInstance, email, password);
};

const createUserWithEmailAndPasswordHandler = async (email: string, password: string): Promise<import('firebase/auth').UserCredential> => {
  if (!authInstance) {
     console.error("[Firebase Client] createUserWithEmailAndPassword: authInstance is not initialized!");
    throw new Error("Firebase Auth not initialized.");
  }
   if (typeof firebaseCreateUserWithEmailAndPassword !== 'function') {
     console.error("[Firebase Client] firebaseCreateUserWithEmailAndPassword is not a function!");
    throw new Error("Firebase SignUp function not available.");
  }
  return firebaseCreateUserWithEmailAndPassword(authInstance, email, password);
};

const sendPasswordResetEmailHandler = async (email: string): Promise<void> => {
  if (!authInstance) {
    console.error("[Firebase Client] sendPasswordResetEmail: authInstance is not initialized!");
    throw new Error("Firebase Auth not initialized.");
  }
  if (typeof firebaseSendPasswordResetEmail !== 'function') {
     console.error("[Firebase Client] firebaseSendPasswordResetEmail is not a function!");
    throw new Error("Firebase Password Reset function not available.");
  }
  return firebaseSendPasswordResetEmail(authInstance, email);
};

const signOutHandler = async (): Promise<void> => {
  if (!authInstance) {
    console.error("[Firebase Client] signOut: authInstance is not initialized!");
    throw new Error("Firebase Auth not initialized.");
  }
  if (typeof firebaseSignOut !== 'function') {
     console.error("[Firebase Client] firebaseSignOut is not a function!");
    throw new Error("Firebase SignOut function not available.");
  }
  return firebaseSignOut(authInstance);
};

const signInWithCustomTokenHandler = async (customToken: string): Promise<import('firebase/auth').UserCredential> => {
  if (!authInstance) {
    console.error("[Firebase Client] signInWithCustomToken: authInstance is not initialized!");
    throw new Error("Firebase Auth not initialized.");
  }
  if (typeof firebaseSignInWithCustomToken !== 'function') {
    console.error("[Firebase Client] firebaseSignInWithCustomToken is not a function!");
    throw new Error("Firebase Custom Token Sign-in function not available.");
  }
  return firebaseSignInWithCustomToken(authInstance, customToken);
};

export {
  app,
  authInstance as auth, // Keep exporting authInstance as auth for compatibility
  dbInstance as db,
  FirestoreTimestamp as Timestamp,
  firestoreServerTimestamp as serverTimestamp,
  firestoreDoc as doc,
  firestoreGetDoc as getDoc,
  firestoreSetDoc as setDoc,
  firestoreUpdateDoc as updateDoc,
  firestoreCollection as collection,
  firestoreAddDoc as addDoc,
  firestoreQuery as query,
  firestoreWhere as where,
  firestoreGetDocs as getDocs,
  firestoreOrderBy as orderBy,
  firestoreLimit as limit,
  onAuthStateChangedHandler as onAuthStateChanged,
  signInWithEmailAndPasswordHandler as signInWithEmailAndPassword,
  createUserWithEmailAndPasswordHandler as createUserWithEmailAndPassword,
  sendPasswordResetEmailHandler as sendPasswordResetEmail,
  signOutHandler as signOut,
  signInWithCustomTokenHandler as signInWithCustomToken
};

export const isFirebaseInitialized = () => {
  const isAppInitialized = !!app;
  const isAuthInitialized = !!authInstance && typeof firebaseOnAuthStateChanged === 'function';
  const isDbInitialized = !!dbInstance;
  console.log(`[Firebase Client] isFirebaseInitialized check: App=${isAppInitialized}, Auth=${isAuthInitialized}, DB=${isDbInitialized}`);
  return isAppInitialized && isAuthInitialized && isDbInitialized;
};
