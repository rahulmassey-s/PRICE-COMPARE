// public/admin/firebase-config.js
console.log("firebase-config.js: Module execution started.");

// Create a global promise that app.js will wait for
let resolveFirebaseConfigInitialization;
window.firebaseConfigInitializationPromise = new Promise(resolve => {
    resolveFirebaseConfigInitialization = resolve;
});
console.log("firebase-config.js: Initialization promise created on window object.");

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import {
    getAuth,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword, // If you plan to add admin creation via admin panel
    signOut,
    GoogleAuthProvider, // Example if you add Google Sign-in
    signInWithPopup
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import {
    getFirestore,
    collection,
    doc,
    addDoc,
    getDocs,
    getDoc,
    updateDoc,
    deleteDoc,
    setDoc, // Crucial for site settings
    query,
    where,
    orderBy,
    limit,
    serverTimestamp,
    Timestamp
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import {
    getStorage,
    ref,
    uploadBytes,
    getDownloadURL,
    deleteObject
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-storage.js";

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

let appInstance;
let authInstance;
let dbInstance;
let storageInstance;

let firebaseAuthFunctions = {};
let firebaseFirestoreFunctions = {};
let firebaseStorageFunctions = {};
let firebaseConfigLoaded = false;

try {
    appInstance = initializeApp(firebaseConfig);
    console.log("firebase-config.js: Firebase App instance created.", appInstance);

    authInstance = getAuth(appInstance);
    console.log("firebase-config.js: Firebase Auth instance created.", authInstance);

    dbInstance = getFirestore(appInstance);
    console.log("firebase-config.js: Firebase Firestore instance created.", dbInstance);

    storageInstance = getStorage(appInstance);
    console.log("firebase-config.js: Firebase Storage instance created.", storageInstance);

    firebaseAuthFunctions = {
        onAuthStateChanged,
        signInWithEmailAndPassword,
        createUserWithEmailAndPassword,
        signOut,
        GoogleAuthProvider,
        signInWithPopup
    };
    console.log("firebase-config.js: FirebaseAuthFunctions object populated.");

    firebaseFirestoreFunctions = {
        collection,
        doc,
        addDoc,
        getDocs,
        getDoc,
        updateDoc,
        deleteDoc,
        setDoc, // Ensured setDoc is here
        query,
        where,
        orderBy,
        limit,
        serverTimestamp,
        Timestamp
    };
    console.log("firebase-config.js: FirebaseFirestoreFunctions object populated.", firebaseFirestoreFunctions);

    firebaseStorageFunctions = {
        ref,
        uploadBytes,
        getDownloadURL,
        deleteObject
    };
    console.log("firebase-config.js: FirebaseStorageFunctions object populated.");

    firebaseConfigLoaded = true;
    console.log("firebase-config.js: Firebase config fully loaded and all services/functions prepared for export. firebaseConfigLoaded set to true.");

} catch (error) {
    console.error("CRITICAL ERROR in firebase-config.js during Firebase initialization:", error);
    firebaseConfigLoaded = false; // Ensure flag is false on error
    // Optionally, display an error on the page itself if possible here
    const body = document.body;
    if (body) {
        const errorDiv = document.createElement('div');
        errorDiv.textContent = `CRITICAL Firebase Init Error in firebase-config.js: ${error.message}. Check console.`;
        errorDiv.style.color = 'red';
        errorDiv.style.backgroundColor = 'black';
        errorDiv.style.padding = '20px';
        errorDiv.style.position = 'fixed';
        errorDiv.style.top = '0';
        errorDiv.style.left = '0';
        errorDiv.style.width = '100%';
        errorDiv.style.zIndex = '99999';
        body.prepend(errorDiv);
    }
}

// Resolve the global promise to signal app.js
if (resolveFirebaseConfigInitialization) {
    console.log("firebase-config.js: About to resolve initialization promise with services and loaded status.");
    resolveFirebaseConfigInitialization({
        appInstance,
        authInstance,
        dbInstance,
        storageInstance,
        firebaseAuthFunctions,
        firebaseFirestoreFunctions,
        firebaseStorageFunctions,
        firebaseConfigLoaded // Pass the status
    });
    console.log("firebase-config.js: Initialization promise resolved.");
} else {
    console.error("CRITICAL: resolveFirebaseConfigInitialization was not defined! Promise signaling will fail.");
}

// Still export them for direct import if needed, though app.js will primarily use the promise payload
export {
    appInstance,
    authInstance,
    dbInstance,
    storageInstance,
    firebaseAuthFunctions,
    firebaseFirestoreFunctions,
    firebaseStorageFunctions,
    firebaseConfigLoaded
};
