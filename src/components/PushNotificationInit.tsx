"use client";
import { useEffect } from "react";
import { requestForToken } from "@/lib/firebase-messaging";

export default function PushNotificationInit() {
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "Notification" in window
    ) {
      if (Notification.permission !== "granted") {
        Notification.requestPermission().then((permission) => {
          if (permission === "granted") {
            navigator.serviceWorker.register("/firebase-messaging-sw.js").then(() => {
              requestForToken();
            });
          }
        });
      } else if (Notification.permission === "granted") {
        navigator.serviceWorker.register("/firebase-messaging-sw.js").then(() => {
          requestForToken();
        });
      }
    }
  }, []);
  return null;
} 