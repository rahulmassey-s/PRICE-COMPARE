"use client";
import { useEffect } from "react";
import { requestForToken } from "@/lib/firebase-messaging";
import { useToast } from "@/hooks/use-toast";

export default function PushNotificationInit() {
  const { toast } = useToast();
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
          } else if (permission === "denied") {
            toast({
              title: "Notifications Blocked",
              description: "Please enable notifications in your browser settings to receive important updates.",
              variant: "destructive",
            });
          }
        });
      } else if (Notification.permission === "granted") {
        navigator.serviceWorker.register("/firebase-messaging-sw.js").then(() => {
          requestForToken();
        });
      }
    }
  }, [toast]);
  return null;
} 