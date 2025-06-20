"use client";

import { useEffect } from 'react';
import { onMessageListener } from '@/lib/firebase-messaging';
import { useToast } from "@/hooks/use-toast";

const ForegroundNotificationHandler = () => {
  const { toast } = useToast();

  const isDev = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  useEffect(() => {
    // Use callback-based persistent listener
    const unsubscribe = onMessageListener((payload: any) => {
      if (isDev) console.log('Foreground message received:', payload);
      const newNotificationEvent = new CustomEvent('new-notification', {
        detail: payload.data,
      });
      window.dispatchEvent(newNotificationEvent);
      toast({
        title: payload.data.title || "New Notification",
        description: payload.data.body || "You have a new update.",
        variant: 'default',
      });
    });
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [toast]);

  return null;
};

export default ForegroundNotificationHandler; 