"use client";

import { useEffect, useState } from 'react';
import useAuth from '@/hooks/useAuth';

const OneSignalInit = () => {
    const { user } = useAuth();
    const [isSdkReady, setIsSdkReady] = useState(false);

    // Effect 1: Load and initialize the SDK. The empty dependency array `[]` 
    // is the key, ensuring this runs ONLY ONCE when the component first mounts.
    useEffect(() => {
        // A rock-solid guard to prevent this from ever running twice.
        if (document.getElementById('onesignal-sdk-script')) {
            console.log('[DEBUG] OneSignal script tag found. Exiting setup effect.');
            return;
        }

        console.log('[DEBUG] Mounting OneSignalInit. Loading script for the first time...');

        const script = document.createElement('script');
        script.id = 'onesignal-sdk-script'; // Give it an ID to prevent duplicates
        script.src = "https://cdn.onesignal.com/sdks/OneSignalSDK.js";
        script.async = true;
        
        script.onload = () => {
            console.log('[DEBUG] OneSignal script has successfully loaded.');
            window.OneSignal = window.OneSignal || [];
            window.OneSignal.push(() => {
                console.log('[DEBUG] Initializing OneSignal SDK...');
                // --- MOST POWERFUL DIAGNOSTIC ---
                // This will force the SDK to print every internal step.
                window.OneSignal.log.setLevel('trace');
                
                window.OneSignal.init({
                    appId: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID,
                    subdomainName: process.env.NEXT_PUBLIC_ONESIGNAL_SUBDOMAIN_NAME,
                    allowLocalhostAsSecureOrigin: true,
                }).then(() => {
                    console.log('%c[DEBUG] OneSignal SDK Initialization COMPLETE.', 'color: green; font-weight: bold;');
                    setIsSdkReady(true); // Signal that the SDK is now ready to be used.
                });
            });
        };

        document.head.appendChild(script);

    }, []); // THIS IS THE CRITICAL PART.

    // Effect 2: Handle user logic. Runs only when the user's status changes 
    // OR when the SDK has signaled that it's ready.
    useEffect(() => {
        if (!isSdkReady) {
            console.log('[DEBUG] User effect is waiting for the SDK to become ready...');
            return; // Do nothing until the SDK is initialized.
        }

        const processUser = async () => {
            const OneSignal = window.OneSignal;
            console.log('[DEBUG] SDK is ready. Now processing user state.');

            // --- WATCHDOG DIAGNOSTIC ---
            // This will tell us if the SDK is hanging when we ask for permission.
            const permissionPromise = OneSignal.getNotificationPermission();
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('TIMED OUT: getNotificationPermission() did not respond in 5 seconds.')), 5000)
            );

            let permission;
            try {
                console.log('[DEBUG] Asking for notification permission...');
                permission = await Promise.race([permissionPromise, timeoutPromise]);
            } catch (error: any) {
                console.error('%c💥 WATCHDOG ERROR:', 'color: red; font-weight: bold;', error.message);
                return; // Stop execution if we time out.
            }
            // --- END WATCHDOG ---

            console.log(`%c[OneSignal Status Check] Current Permission: ${permission}`, 'color: #007bff; font-weight: bold;');

            if (user?.uid) {
                const externalId = await OneSignal.getExternalUserId();
                if (externalId === user.uid) {
                    console.log(`[LOGIN] User ${user.uid} is already identified. No action needed.`);
                } else {
                    console.log(`[LOGIN] User detected. Identifying as ${user.uid}`);
                    await OneSignal.setExternalUserId(user.uid);
                    if (permission === 'default') {
                        console.log('[LOGIN] Permission is "default", showing subscribe prompt.');
                        OneSignal.showSlidedownPrompt();
                    }
                }
            } else {
                const externalId = await OneSignal.getExternalUserId();
                if (externalId) {
                    console.log(`[LOGOUT] User logged out. Removing ID: ${externalId}`);
                    await OneSignal.removeExternalUserId();
                } else {
                    console.log('[LOGOUT] No user was logged in. No session to clear.');
                }
            }
        };

        processUser();
        
    }, [user, isSdkReady]); // This effect now correctly separates user logic.

    return null; // This is a background component.
};

export default OneSignalInit; 