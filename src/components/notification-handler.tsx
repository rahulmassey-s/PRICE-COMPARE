"use client";

import { useEffect } from 'react';
import { requestForToken } from '@/lib/firebase-messaging';
import { auth } from '@/lib/firebase/client';
import { onAuthStateChanged } from 'firebase/auth';

const isDev = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const NotificationHandler = () => {
  useEffect(() => {
    // This effect runs once when the component mounts.
    
    // We wait for the auth state to be confirmed before requesting a token.
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // If the user is logged in, request the notification token.
        if (isDev) console.log("User is logged in. Requesting notification token...");
        requestForToken();
      } else {
        if (isDev) console.log("No user logged in. Not requesting notification token.");
      }
    });

    // Cleanup subscription on component unmount
    return () => unsubscribe();
  }, []);

  return null; // This component does not render anything.
};

export default NotificationHandler; 