"use client";

import Script from 'next/script';

export default function OneSignalInit() {
  return (
    <Script
      id="onesignal-sdk"
      src="https://cdn.onesignal.com/sdks/OneSignalSDK.js"
      strategy="afterInteractive"
      onLoad={() => {
        window.OneSignal = window.OneSignal || [];
        window.OneSignal.push(function() {
          window.OneSignal.init({
            appId: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID,
            subdomainName: process.env.NEXT_PUBLIC_ONESIGNAL_SUBDOMAIN_NAME,
            notifyButton: { enable: true },
          });
        });
      }}
    />
  );
} 