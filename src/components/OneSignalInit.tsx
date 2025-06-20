"use client";
import { useEffect } from 'react';

export default function OneSignalInit() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Load the OneSignal SDK
      if (!window.OneSignal) {
        const script = document.createElement('script');
        script.src = 'https://cdn.onesignal.com/sdks/OneSignalSDK.js';
        script.async = true;
        document.body.appendChild(script);

        script.onload = () => {
          window.OneSignal = window.OneSignal || [];
          window.OneSignal.push(function() {
            window.OneSignal.init({
              appId: '2d41a703-8645-4875-ab7a-283b4e408458',
              notifyButton: { enable: true },
              // Reverted to default setup. No custom service worker paths.
              // OneSignal will manage its own worker files.
            });
          });
        };
      }
    }
  }, []);
  return null;
} 